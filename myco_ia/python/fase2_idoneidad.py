import numpy as np
try:
    from shapely.geometry import Polygon, Point
    HAS_SHAPELY = True
except ImportError:
    HAS_SHAPELY = False

from main import FungalSoilMeasurementCA

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

def idw_interpolation(known_coords, known_values, grid_x, grid_y, power=2.0, default_val=0.5):
    """
    Interpolación por Distancia Inversa Ponderada (IDW) 2D.
    known_coords: lista de (x, y) normalizadas [0, 1]
    known_values: array 1D con los valores medidos
    grid_x, grid_y: matrices 2D generadas con np.meshgrid
    """
    if len(known_coords) == 0:
        return np.full(grid_x.shape, default_val, dtype=float)
    
    if len(known_coords) == 1:
        return np.full(grid_x.shape, known_values[0], dtype=float)
        
    num_pts = len(known_coords)
    weights_sum = np.zeros_like(grid_x, dtype=float)
    vals_sum = np.zeros_like(grid_x, dtype=float)
    eps = 1e-6
    
    for i in range(num_pts):
        kx, ky = known_coords[i]
        val = known_values[i]
        d = np.sqrt((grid_x - kx)**2 + (grid_y - ky)**2) + eps
        w = 1.0 / (d ** power)
        weights_sum += w
        vals_sum += w * val
        
    return np.where(weights_sum > 0, vals_sum / weights_sum, default_val)


def calcular_matriz_fase2(puntos_medicion, poligono_coordenadas, matriz_dem=None, 
                          grid_size=40, entorno='tierra', cfu_concentration=0.85, 
                          num_inyecciones=3):
    """
    Calcula la Matriz de Idoneidad (I_suelo) y selecciona los puntos óptimos de inyección
    de biocápsulas para el autómata celular, siguiendo estrictamente la arquitectura de mejoras.txt:
    
    1. Normalización Base [0.0, 1.0]:
       - Humedad: función trapezoidal (óptimo 30% a 70%).
       - Materia Orgánica / Nutrientes: relación directa lineal (0.0% a 5.0%).
       - Compactación: relación inversa (0.5 MPa = 1.0 blando, 3.5 MPa = 0.0 impenetrable).
    2. Fusión Multicapa y Modificadores:
       - I_base = 0.35 * n_mo + 0.40 * n_h + 0.25 * n_c
       - Estrés Térmico (confort 18°C - 26°C, leve: 0.94, extremo: 0.88).
       - Estrés pH (alcalino >7.5: 0.95, ácido <5.5: 0.92).
    3. Restricciones Topográficas (DEM):
       - Obstáculos mecánicos o pendiente forzados a idoneidad 0.0 (Estado 4).
    4. Algoritmo de Inyección:
       - Filtrado de bordes, selección de máximos y distanciamiento espacial radial.
    """
    # Validar y parsear polígono
    poly_pts = []
    if poligono_coordenadas and len(poligono_coordenadas) >= 3:
        for pt in poligono_coordenadas:
            if isinstance(pt, (list, tuple)) and len(pt) >= 2:
                poly_pts.append((float(pt[0]), float(pt[1])))
        if poly_pts[0] != poly_pts[-1]:
            poly_pts.append(poly_pts[0])
    else:
        poly_pts = [(0.0, 0.0), (1.0, 0.0), (1.0, 1.0), (0.0, 1.0), (0.0, 0.0)]

    poly = None
    if HAS_SHAPELY:
        try:
            poly = Polygon(poly_pts)
            if not poly.is_valid:
                poly = poly.buffer(0)
            min_lng, min_lat, max_lng, max_lat = poly.bounds
        except Exception:
            poly = None

    if poly is None:
        min_lng = min(p[0] for p in poly_pts)
        min_lat = min(p[1] for p in poly_pts)
        max_lng = max(p[0] for p in poly_pts)
        max_lat = max(p[1] for p in poly_pts)

    span_lng = max(max_lng - min_lng, 1e-5)
    span_lat = max(max_lat - min_lat, 1e-5)

    # Rejilla de coordenadas normalizadas en [0.0, 1.0]
    xs = np.linspace(0.0, 1.0, grid_size)
    ys = np.linspace(0.0, 1.0, grid_size)
    grid_x, grid_y = np.meshgrid(xs, ys)

    # Máscara binaria del polígono (1 si está dentro, 0 si está fuera)
    inside_mask = np.zeros((grid_size, grid_size), dtype=bool)
    for r in range(grid_size):
        for c in range(grid_size):
            pt_lng = min_lng + xs[c] * span_lng
            pt_lat = min_lat + (1.0 - ys[r]) * span_lat  # Y invertida para norte
            if poly is not None:
                inside_mask[r, c] = poly.contains(Point(pt_lng, pt_lat))
            else:
                inside_mask[r, c] = point_in_poly(pt_lng, pt_lat, poly_pts)

    # Parsear puntos medidos
    known_coords = []
    vals_hum = []
    vals_temp = []
    vals_ph = []
    vals_mo = []
    vals_comp = []

    if puntos_medicion and len(puntos_medicion) > 0:
        for pt in puntos_medicion:
            p_lng = float(pt.get("lng", min_lng + 0.5 * span_lng))
            p_lat = float(pt.get("lat", min_lat + 0.5 * span_lat))
            
            # Normalizar a coordenadas de grid [0, 1]
            norm_x = np.clip((p_lng - min_lng) / span_lng, 0.0, 1.0)
            norm_y = np.clip(1.0 - (p_lat - min_lat) / span_lat, 0.0, 1.0)
            known_coords.append((norm_x, norm_y))

            # Humedad (%)
            h_raw = float(pt.get("humedad", 55.0))
            vals_hum.append(h_raw)

            # Temperatura (°C)
            t_raw = float(pt.get("temperatura", 24.0 if entorno == 'tierra' else -55.0))
            vals_temp.append(t_raw)

            # pH
            ph_raw = float(pt.get("ph", 6.8 if entorno == 'tierra' else 8.4))
            vals_ph.append(ph_raw)

            # Materia Orgánica (%) estimada por Sensor TCS34725
            tcs = pt.get("sensor_tcs34725") or pt.get("tcs") or {}
            preset = tcs.get("tipo_preset", "")
            if "humus" in preset or "optimo" in preset:
                mo_val = 4.8
            elif "arcilla" in preset or "franco" in preset:
                mo_val = 2.4
            elif "salino" in preset or "pobre" in preset:
                mo_val = 0.8
            elif "regolito" in preset or "marte" in preset:
                mo_val = 0.3
            else:
                lux = float(tcs.get("lux", 250.0))
                mo_val = float(np.clip(5.0 * (1.0 - lux / 600.0), 0.2, 5.0))
            vals_mo.append(mo_val)

            # Compactación estimada (0.5 a 3.5 MPa)
            elev = float(pt.get("elevacion_m") or pt.get("elevacion") or 1470.0)
            # Zonas más altas o escarpadas tienen mayor compactación rocosa
            comp_val = float(np.clip(1.2 + (abs(elev) % 5.0) * 0.4, 0.8, 3.2))
            vals_comp.append(comp_val)

    # 1. INTERPOLACIÓN IDW ESPACIAL DE CAPAS
    raw_humedad = idw_interpolation(known_coords, vals_hum, grid_x, grid_y, default_val=50.0)
    raw_temp = idw_interpolation(known_coords, vals_temp, grid_x, grid_y, default_val=24.0 if entorno == 'tierra' else -55.0)
    raw_ph = idw_interpolation(known_coords, vals_ph, grid_x, grid_y, default_val=6.8 if entorno == 'tierra' else 8.4)
    raw_mo = idw_interpolation(known_coords, vals_mo, grid_x, grid_y, default_val=2.5)
    raw_comp = idw_interpolation(known_coords, vals_comp, grid_x, grid_y, default_val=1.5)

    # Añadir suave modulación espacial realista para celdas no idénticas
    modulation = 0.08 * np.sin(grid_x * 6.28) * np.cos(grid_y * 6.28)
    raw_humedad = np.clip(raw_humedad + (modulation * 20.0), 0.0, 100.0)
    raw_mo = np.clip(raw_mo + (modulation * 1.5), 0.0, 5.0)
    raw_comp = np.clip(raw_comp - (modulation * 0.6), 0.5, 3.5)

    # ─── 2. NORMALIZACIÓN BASE ADIMENSIONAL [0.0, 1.0] ───
    # A) Humedad: Función Trapezoidal (30% a 70% = 1.0)
    n_h = np.zeros((grid_size, grid_size), dtype=float)
    opt_mask = (raw_humedad >= 30.0) & (raw_humedad <= 70.0)
    n_h[opt_mask] = 1.0
    
    # Sequía (< 30%)
    dry_mask = raw_humedad < 30.0
    n_h[dry_mask] = np.clip(raw_humedad[dry_mask] / 30.0, 0.0, 1.0)
    
    # Anegamiento (> 70%)
    flood_mask = raw_humedad > 70.0
    n_h[flood_mask] = np.clip(1.0 - (raw_humedad[flood_mask] - 70.0) / 30.0, 0.0, 1.0)

    # B) Materia Orgánica / Nutrientes: Relación Directa Monótona (0.0% a 5.0%)
    n_mo = np.clip(raw_mo / 5.0, 0.0, 1.0)

    # C) Compactación: Relación Inversa (0.5 MPa = 1.0 blando, 3.5 MPa = 0.0 impenetrable)
    n_c = 1.0 - np.clip((raw_comp - 0.5) / (3.5 - 0.5), 0.0, 1.0)

    # ─── 3. FUSIÓN MULTICAPA PONDERADA ───
    # I_base = 35% MO + 40% Humedad + 25% Compactación
    i_base = (0.35 * n_mo) + (0.40 * n_h) + (0.25 * n_c)

    # ─── 4. MODIFICADORES DE ESTRÉS BIOLÓGICO ───
    # A) Modificador de Temperatura (Zona de confort 18°C a 26°C)
    f_temp = np.ones((grid_size, grid_size), dtype=float)
    if entorno == 'tierra':
        # Confort total 18-26°C -> 1.0
        mild_stress = ((raw_temp >= 14.0) & (raw_temp < 18.0)) | ((raw_temp > 26.0) & (raw_temp <= 30.0))
        severe_stress = (raw_temp < 14.0) | (raw_temp > 30.0)
        f_temp[mild_stress] = 0.94
        f_temp[severe_stress] = 0.88
    else:
        # En Marte las temperaturas son extremadamente bajas (-90 a 20°C)
        mild_stress = (raw_temp >= -20.0) & (raw_temp <= 20.0)
        severe_stress = raw_temp < -20.0
        f_temp[mild_stress] = 0.92
        f_temp[severe_stress] = 0.84

    # B) Modificador de pH (Óptimo neutro 5.5 a 7.5 -> 1.0)
    f_ph = np.ones((grid_size, grid_size), dtype=float)
    alkaline_stress = raw_ph > 7.5
    acidic_stress = raw_ph < 5.5
    f_ph[alkaline_stress] = 0.95
    f_ph[acidic_stress] = 0.92

    # Aplicar modificadores
    i_mod = i_base * f_temp * f_ph

    # ─── 5. RESTRICCIONES TOPOGRÁFICAS (DEM & OBSTÁCULOS) ───
    obstaculos_mask = np.zeros((grid_size, grid_size), dtype=bool)

    # A) Celda fuera del polígono
    obstaculos_mask[~inside_mask] = True

    # B) Compactación mecánica severa (> 3.2 MPa)
    obstaculos_mask[raw_comp >= 3.2] = True

    # C) Si hay matriz DEM, calcular gradiente/pendiente
    if matriz_dem and isinstance(matriz_dem, list) and len(matriz_dem) > 1:
        dem_arr = np.array(matriz_dem, dtype=float)
        # Resamplear DEM a grid_size si tiene diferente tamaño
        if dem_arr.shape != (grid_size, grid_size):
            from scipy.ndimage import zoom
            zoom_factor = (grid_size / dem_arr.shape[0], grid_size / dem_arr.shape[1])
            dem_arr = zoom(dem_arr, zoom_factor, order=1)
        
        # Gradiente espacial
        gy, gx = np.gradient(dem_arr)
        slope_deg = np.rad2deg(np.arctan(np.sqrt(gx**2 + gy**2)))
        # Pendiente severa (> 25°) es barrera infranqueable para el micelio
        obstaculos_mask[slope_deg > 25.0] = True

    # Forzar idoneidad 0.0 en obstáculos
    i_final = np.clip(i_mod, 0.0, 1.0)
    i_final[obstaculos_mask] = 0.0

    # ─── 6. ALGORITMO DE DECISIÓN DE INYECCIÓN (seed_pos) ───
    # A) Filtrado de bordes (excluir margen de 4 celdas)
    border_margin = 4
    search_mask = np.zeros((grid_size, grid_size), dtype=bool)
    search_mask[border_margin:grid_size - border_margin, border_margin:grid_size - border_margin] = True
    search_mask = search_mask & (~obstaculos_mask) & inside_mask

    # B) Selección de máximos con distanciamiento radial mínimo
    min_radial_distance = int(grid_size * 0.22)  # ~9 celdas para cuadrícula de 40
    puntos_inyeccion = []
    
    # Copia para enmascarar radios ya cubiertos
    viable_suitability = i_final.copy()
    viable_suitability[~search_mask] = -1.0

    for idx_inj in range(num_inyecciones):
        best_flat_idx = int(np.argmax(viable_suitability))
        best_val = float(viable_suitability.flat[best_flat_idx])
        
        if best_val < 0.25:
            # Ya no hay focos viables con idoneidad aceptable
            break

        best_y, best_x = np.unravel_index(best_flat_idx, (grid_size, grid_size))
        
        # Calcular coordenadas geográficas exactas
        inj_lng = min_lng + (best_x / (grid_size - 1)) * span_lng
        inj_lat = min_lat + (1.0 - best_y / (grid_size - 1)) * span_lat

        # Radio biológico derivado de UFC
        vigor = float(np.clip(cfu_concentration, 0.1, 1.0))
        r_inicial = int(np.floor(vigor * 2.5))
        celdas_iniciales = 1 if r_inicial == 0 else (5 if r_inicial == 1 else 13)

        puntos_inyeccion.append({
            "id": idx_inj + 1,
            "grid_x": int(best_x),
            "grid_y": int(best_y),
            "lng": round(float(inj_lng), 6),
            "lat": round(float(inj_lat), 6),
            "idoneidad": round(best_val, 3),
            "cfu_vigor": round(vigor, 2),
            "radio_inicial": r_inicial,
            "celdas_iniciales": celdas_iniciales,
            "motivo": f"Foco nutricional óptimo #{idx_inj + 1} con {round(best_val * 100, 1)}% de viabilidad edafológica",
        })

        # Enmascarar vecindario circular de exclusión para distanciamiento
        y_coords, x_coords = np.ogrid[:grid_size, :grid_size]
        dist_from_seed = np.sqrt((x_coords - best_x)**2 + (y_coords - best_y)**2)
        viable_suitability[dist_from_seed <= min_radial_distance] = -1.0

    # ─── 7. SIMULACIÓN DE AVANCE DEL AUTÓMATA (SNAPSHOTS) ───
    # Si tenemos al menos 1 punto de inyección, simular la propagación
    sim_snapshots = {}
    if len(puntos_inyeccion) > 0:
        first_seed = (puntos_inyeccion[0]["grid_x"], puntos_inyeccion[0]["grid_y"])
        sim = FungalSoilMeasurementCA(
            soil_measurements=i_final, 
            seed_pos=first_seed, 
            cfu_concentration=cfu_concentration
        )
        
        # Inocular también las semillas secundarias si existen
        for s in puntos_inyeccion[1:]:
            sim.inoculate((s["grid_x"], s["grid_y"]), cfu_concentration=cfu_concentration)

        sim_snapshots["step_0"] = sim.grid.tolist()
        
        for step_i in range(1, 41):
            sim.step()
            if step_i in [5, 15, 30, 40]:
                sim_snapshots[f"step_{step_i}"] = sim.grid.tolist()

    # ─── 8. RESUMEN ESTADÍSTICO Y RETORNO ───
    inside_cells = i_final[inside_mask]
    avg_suitability = float(np.mean(inside_cells)) if len(inside_cells) > 0 else 0.0
    max_suitability = float(np.max(inside_cells)) if len(inside_cells) > 0 else 0.0
    viable_pct = float(np.sum(inside_cells >= 0.40) / len(inside_cells) * 100) if len(inside_cells) > 0 else 0.0
    obstacle_pct = float(np.sum(obstaculos_mask[inside_mask]) / len(inside_cells) * 100) if len(inside_cells) > 0 else 0.0

    return {
        "success": True,
        "grid_size": grid_size,
        "entorno": entorno,
        "matriz_idoneidad": np.round(i_final, 3).tolist(),
        "capa_humedad": np.round(n_h, 3).tolist(),
        "capa_nutrientes": np.round(n_mo, 3).tolist(),
        "capa_compactacion": np.round(n_c, 3).tolist(),
        "capa_temperatura_factor": np.round(f_temp, 3).tolist(),
        "capa_ph_factor": np.round(f_ph, 3).tolist(),
        "capa_obstaculos": obstaculos_mask.astype(int).tolist(),
        "semillas_inyeccion": puntos_inyeccion,
        "estadisticas": {
            "idoneidad_promedio": round(avg_suitability, 3),
            "idoneidad_maxima": round(max_suitability, 3),
            "area_viable_pct": round(viable_pct, 1),
            "area_obstaculos_pct": round(obstacle_pct, 1),
            "total_celdas": grid_size * grid_size,
        },
        "simulacion_automata": sim_snapshots,
    }
