"""
MÓDULO DE INTEGRACIÓN DE SIMULACIÓN MARCIANA PARA API Y FRONTEND
================================================================
Conecta la física del "Traje Espacial Marciano" (biocápsula de hidrogel de alginato + glicerol + quitosano),
la dinámica de fluidos de Fick a 6.1 hPa, el ciclo térmico diurno/nocturno de Marte y la vía bioquímica
de metabolización de regolito por sideróforos con el Gemelo Digital Web.
"""

import numpy as np
try:
    from shapely.geometry import Polygon, Point
    HAS_SHAPELY = True
except ImportError:
    HAS_SHAPELY = False

from main_mars import MartianFungalCA, generate_martian_regolith_terrain

def point_in_poly(x, y, poly_pts):
    """Ray casting point in polygon test."""
    n = len(poly_pts)
    inside = False
    p1x, p1y = poly_pts[0]
    for i in range(n + 1):
        p2x, p2y = poly_pts[i % n]
        if y > min(p1y, p2y) and y <= max(p1y, p2y):
            if x <= max(p1x, p2x):
                if p1y != p2y:
                    xinters = (y - p1y) * (p2x - p1x) / (p2y - p1y) + p1x
                if p1x == p2x or x <= xinters:
                    inside = not inside
        p1x, p1y = p2x, p2y
    return inside

def simular_laboratorio_marte(
    poligono_coordenadas=None,
    matriz_dem=None,
    grid_size=40,
    cfu_concentration=0.85,
    humectant_capacity=120.0,
    chitosan_shield=0.85,
    modo_tiempo="ciclo_sol",         # "ciclo_sol" (24h dinámico) | "fijo_manual"
    sol_hour=14,                     # 0 a 23 horas Sol (si modo fijo)
    temperatura_manual=None,         # Si se fija temperatura manualmente (°C)
    temp_mean=-25.0,
    temp_amp=40.0,
    perchlorates_factor=1.0,
    iron_oxides_factor=1.0,
    total_steps=24,                  # 24 steps = 1 Sol marciano completo
    num_inyecciones=2,
    puntos_inyeccion_custom=None,
    bake_habitat_flag=False,
    target_density=0.70
):
    """
    Ejecuta la simulación de laboratorio astrobiológico del traje espacial marciano
    y produce matrices y snapshots cronológicos para la interfaz interactiva.
    """
    grid_size = int(max(20, min(80, grid_size)))
    cfu = float(np.clip(cfu_concentration, 0.1, 1.0))
    humectant = float(np.clip(humectant_capacity, 20.0, 300.0))
    chitosan = float(np.clip(chitosan_shield, 0.1, 1.0))
    
    # 1. Delimitar polígono y máscara dentro/fuera
    poly_pts = []
    if poligono_coordenadas and len(poligono_coordenadas) >= 3:
        for pt in poligono_coordenadas:
            if isinstance(pt, (list, tuple)) and len(pt) >= 2:
                poly_pts.append((float(pt[0]), float(pt[1])))
        if poly_pts[0] != poly_pts[-1]:
            poly_pts.append(poly_pts[0])
    else:
        poly_pts = [(0.0, 0.0), (1.0, 0.0), (1.0, 1.0), (0.0, 1.0), (0.0, 0.0)]

    min_lng = min(p[0] for p in poly_pts)
    min_lat = min(p[1] for p in poly_pts)
    max_lng = max(p[0] for p in poly_pts)
    max_lat = max(p[1] for p in poly_pts)
    span_lng = max(1e-6, max_lng - min_lng)
    span_lat = max(1e-6, max_lat - min_lat)

    inside_mask = np.zeros((grid_size, grid_size), dtype=bool)
    for gy in range(grid_size):
        for gx in range(grid_size):
            cx = min_lng + (gx + 0.5) / grid_size * span_lng
            cy = min_lat + (gy + 0.5) / grid_size * span_lat
            inside_mask[gy, gx] = point_in_poly(cx, cy, poly_pts)
            
    if not np.any(inside_mask):
        inside_mask[:, :] = True

    # 2. Generar o calibrar capas del regolito marciano
    _, raw_layers = generate_martian_regolith_terrain(grid_size)
    
    # Modular factores ambientales
    iron_oxides = np.clip(raw_layers["iron_oxides"] * iron_oxides_factor, 0.05, 1.0)
    perchlorates = np.clip(raw_layers["perchlorates"] * perchlorates_factor, 0.1, 1.0)
    
    # Integrar DEM si está disponible (pendientes > 25° o crestas de cráter = roca)
    obstacles = np.zeros((grid_size, grid_size), dtype=bool)
    if matriz_dem and isinstance(matriz_dem, list) and len(matriz_dem) > 2:
        dem_arr = np.array(matriz_dem, dtype=float)
        # Remuestrear DEM al grid_size
        dh, dw = dem_arr.shape
        gy_idx = (np.arange(grid_size) * (dh - 1) / (grid_size - 1)).astype(int)
        gx_idx = (np.arange(grid_size) * (dw - 1) / (grid_size - 1)).astype(int)
        resampled_dem = dem_arr[np.ix_(gy_idx, gx_idx)]
        
        dy, dx = np.gradient(resampled_dem)
        slope_mag = np.sqrt(dx**2 + dy**2)
        slope_thresh = np.percentile(slope_mag, 92) # 8% con mayor pendiente como roca basáltica
        obstacles[slope_mag >= slope_thresh] = True
    else:
        obstacles = raw_layers["obstacles"]

    # Forzar que fuera del polígono no haya actividad
    obstacles[~inside_mask] = True

    regolith_data = {
        "iron_oxides": iron_oxides,
        "perchlorates": perchlorates,
        "moisture": np.zeros((grid_size, grid_size), dtype=float),
        "obstacles": obstacles
    }

    # 3. Selección o asignación de puntos de inyección ("Trajes Espaciales")
    seeds = []
    if puntos_inyeccion_custom and len(puntos_inyeccion_custom) > 0:
        for p in puntos_inyeccion_custom:
            gx = int(np.clip(p.get("grid_x", p.get("x", grid_size // 2)), 0, grid_size - 1))
            gy = int(np.clip(p.get("grid_y", p.get("y", grid_size // 2)), 0, grid_size - 1))
            seeds.append((gx, gy))
    else:
        # Algoritmo voraz de selección en base a menor perclorato y presencia de óxidos de hierro
        viability = (iron_oxides * 0.6) + (1.0 - perchlorates) * 0.4
        viability[obstacles] = -1.0
        # Excluir bordes
        viability[:3, :] = -1.0; viability[-3:, :] = -1.0
        viability[:, :3] = -1.0; viability[:, -3:] = -1.0
        
        flat_sorted = np.argsort(viability.ravel())[::-1]
        min_dist_sq = (grid_size * 0.28) ** 2
        
        for idx in flat_sorted:
            if viability.ravel()[idx] < 0:
                break
            sy, sx = divmod(idx, grid_size)
            if all((sx - px)**2 + (sy - py)**2 >= min_dist_sq for px, py in seeds):
                seeds.append((sx, sy))
                if len(seeds) >= num_inyecciones:
                    break

    if not seeds:
        seeds = [(grid_size // 2, grid_size // 2)]

    # 4. Instanciar el Autómata Celular Marciano
    sim = MartianFungalCA(
        regolith_layers=regolith_data,
        grid_size=grid_size,
        seed_pos=seeds[0],
        cfu_concentration=cfu,
        humectant_capacity=humectant,
        sol_length=24
    )
    sim.chitosan_shield = chitosan

    # Inocular semillas adicionales
    for s_pt in seeds[1:]:
        sim.inoculate(s_pt, cfu_concentration=cfu, humectant_capacity=humectant)

    # 5. Ejecutar la simulación paso a paso registrando telemetría y snapshots
    snapshots = {}
    sol_timeline = []

    steps_to_run = int(max(1, min(72, total_steps)))

    # Snapshot inicial (Inyección en t=0)
    st0 = sim.get_stats()
    snapshots["step_0"] = {
        "step": 0,
        "sol": 1,
        "sol_hour": 0,
        "temp_celsius": round(st0["temp_celsius"], 1),
        "vitality": round(st0["vitality"], 2),
        "estado_termico": "NOCHE_DORMANCIA" if st0["vitality"] <= 0 else "DIA_ACTIVO",
        "grid": sim.grid.tolist(),
        "hydration": np.round(sim.hydration, 3).tolist(),
        "chelated_iron": np.round(sim.chelated_iron, 3).tolist(),
        "active_tips": st0["active_tips"],
        "dormant_tips": st0["dormant_tips"],
        "mature_mycelium": st0["mature_mycelium"],
        "humectant_reserve": round(sim.humectant_reserve, 1)
    }

    # Definir pasos de snapshot a registrar (ej. cada 4 horas del Sol + final)
    key_steps = {4, 6, 8, 12, 16, 20, 24}
    if steps_to_run > 24:
        key_steps.update({36, 48, 60, 72})
    key_steps.add(steps_to_run)

    for current_step in range(1, steps_to_run + 1):
        # Si el usuario eligió modo manual fijo de temperatura, sobrescribir la función térmica
        if modo_tiempo == "fijo_manual":
            if temperatura_manual is not None:
                sim.get_temperature = lambda step=None: float(temperatura_manual)
            else:
                # Fijar hora específica
                h_angle = (2.0 * np.pi * sol_hour / 24.0) - (np.pi / 2.0)
                forced_t = temp_mean + temp_amp * np.sin(h_angle)
                sim.get_temperature = lambda step=None: float(forced_t)

        sim.step()
        st = sim.get_stats()
        
        sol_timeline.append({
            "step": current_step,
            "hour": st["sol_hour"],
            "temp": round(st["temp_celsius"], 1),
            "vitality": round(st["vitality"], 2),
            "active_tips": st["active_tips"],
            "dormant_tips": st["dormant_tips"],
            "mycelium": st["mature_mycelium"]
        })

        if current_step in key_steps or current_step == steps_to_run:
            snapshots[f"step_{current_step}"] = {
                "step": current_step,
                "sol": st["sol"],
                "sol_hour": st["sol_hour"],
                "temp_celsius": round(st["temp_celsius"], 1),
                "vitality": round(st["vitality"], 2),
                "estado_termico": "NOCHE_DORMANCIA" if st["vitality"] <= 0 else "DIA_ACTIVO",
                "grid": sim.grid.tolist(),
                "hydration": np.round(sim.hydration, 3).tolist(),
                "chelated_iron": np.round(sim.chelated_iron, 3).tolist(),
                "active_tips": st["active_tips"],
                "dormant_tips": st["dormant_tips"],
                "mature_mycelium": st["mature_mycelium"],
                "humectant_reserve": round(sim.humectant_reserve, 1)
            }

    # 6. Formatear semillas con coordenadas GPS simuladas en la parcela
    semillas_info = []
    for idx, (sx, sy) in enumerate(seeds):
        lng_pt = min_lng + (sx + 0.5) / grid_size * span_lng
        lat_pt = min_lat + (sy + 0.5) / grid_size * span_lat
        semillas_info.append({
            "id": idx + 1,
            "grid_x": int(sx),
            "grid_y": int(sy),
            "lng": round(lng_pt, 6),
            "lat": round(lat_pt, 6),
            "cfu_g": int(cfu * 100000),
            "gel_alginato_u": round(humectant, 1),
            "radio_oasis": int(np.floor(cfu * 2.8))
        })

    # Si se solicitó la fase de horneado estructural
    bake_data = None
    if bake_habitat_flag:
        bake_data = sim.bake_habitat(target_density=target_density)

    final_st = sim.get_stats()
    current_temp = final_st["temp_celsius"]
    vitality = final_st["vitality"]

    # 7. Retorno unificado
    return {
        "success": True,
        "entorno": "marte",
        "grid_size": grid_size,
        "telemetria_sol": {
            "sol_actual": final_st["sol"],
            "sol_hour": final_st["sol_hour"],
            "temp_celsius": round(current_temp, 1),
            "vitality": round(vitality, 2),
            "es_noche": bool(vitality <= 0.0),
            "estado_termico": "NOCHE_DORMANCIA" if vitality <= 0.0 else "DIA_METABOLISMO_ACTIVO",
            "reserva_humectante": round(sim.humectant_reserve, 1),
            "capacidad_inicial_gel": round(sim.initial_humectant_capacity, 1),
            "porcentaje_gel_restante": round((sim.humectant_reserve / max(1.0, sim.initial_humectant_capacity)) * 100.0, 1),
            "percloratos_neutralizados_pct": round(final_st["perchlorate_cleared_pct"], 2),
            "hierro_fe2_quelado_total": round(final_st["chelated_iron_total"], 2),
            "hifas_maduras_total": final_st["mature_mycelium"],
            "puntas_activas": final_st["active_tips"],
            "puntas_dormantes": final_st["dormant_tips"],
            "baked_biocomposite": final_st.get("baked_biocomposite", 0),
            "is_baked": sim.is_baked,
            "biomass_density_pct": final_st.get("biomass_density_pct", 0.0),
            "total_azucares": round(final_st.get("total_sugars", 0.0), 1),
            "horneado_info": bake_data
        },
        "hiperparametros_aplicados": {
            "cfu_concentration": cfu,
            "cfu_valor_ufc_g": int(cfu * 100000),
            "humectant_capacity": humectant,
            "chitosan_shield": chitosan,
            "modo_tiempo": modo_tiempo,
            "sol_hour": sol_hour,
            "temperatura_manual": temperatura_manual,
            "total_steps": steps_to_run,
            "bake_habitat_flag": bake_habitat_flag,
            "target_density": target_density
        },
        "semillas_inyeccion": semillas_info,
        "matriz_grid": sim.grid.tolist(),
        "capa_hidratacion": np.round(sim.hydration, 3).tolist(),
        "capa_azucares": np.round(sim.nutrients, 3).tolist(),
        "capa_cianobacterias": np.round(sim.cyanobacteria, 3).tolist(),
        "capa_melanina": np.round(sim.melanin, 3).tolist(),
        "capa_percloratos": np.round(sim.perchlorates, 3).tolist(),
        "capa_hierro_quelado": np.round(sim.chelated_iron, 3).tolist(),
        "capa_sideroforos": np.round(sim.siderophores, 3).tolist(),
        "capa_oxidos_basales": np.round(sim.iron_oxides, 3).tolist(),
        "capa_obstaculos": sim.obstacles.astype(int).tolist(),
        "snapshots_temporales": snapshots,
        "timeline_sol": sol_timeline
    }
