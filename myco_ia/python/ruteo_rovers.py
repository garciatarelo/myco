import numpy as np
from shapely.geometry import Polygon, Point
from sklearn.cluster import KMeans
from scipy.optimize import linear_sum_assignment

def haversine_m(lat1, lon1, lat2, lon2):
    """Distancia en metros entre dos coordenadas geográficas."""
    R = 6371000.0  # Radio terrestre en metros
    phi1 = np.radians(lat1)
    phi2 = np.radians(lat2)
    delta_phi = np.radians(lat2 - lat1)
    delta_lambda = np.radians(lon2 - lon1)

    a = np.sin(delta_phi / 2.0)**2 + np.cos(phi1) * np.cos(phi2) * np.sin(delta_lambda / 2.0)**2
    c = 2.0 * np.arctan2(np.sqrt(a), np.sqrt(1.0 - a))
    return float(R * c)

def latlon_to_grid(lat, lon, minx, miny, maxx, maxy, nrows, ncols):
    """Convierte [lat, lon] a índices de celda [r, c] de la matriz DEM."""
    # minx = minLng, maxx = maxLng, miny = minLat, maxy = maxLat
    # Fila 0 es el Norte (maxy), Fila nrows-1 es el Sur (miny)
    c = int(np.clip(round(((lon - minx) / max(1e-9, maxx - minx)) * (ncols - 1)), 0, ncols - 1))
    r = int(np.clip(round(((maxy - lat) / max(1e-9, maxy - miny)) * (nrows - 1)), 0, nrows - 1))
    return r, c

def grid_to_latlon(r, c, minx, miny, maxx, maxy, nrows, ncols):
    """Convierte celda [r, c] de la matriz DEM a coordenadas [lat, lon]."""
    lon = minx + (c / max(1, ncols - 1)) * (maxx - minx)
    lat = maxy - (r / max(1, nrows - 1)) * (maxy - miny)
    return round(float(lat), 6), round(float(lon), 6)

def calcular_costo_tramo_fisico(p1, p2, matriz_dem, bounds, nrows, ncols, resolucion_m_celda=1.0, max_slope_deg=25.0):
    """
    Implementa la función física exacta de mejoras.txt (líneas 89-136, 153-154).
    Calcula distancia, desnivel DEM, velocidad adaptativa, tiempo y energía en Joules.
    """
    minx, miny, maxx, maxy = bounds
    r1, c1 = latlon_to_grid(p1["lat"], p1["lng"], minx, miny, maxx, maxy, nrows, ncols)
    r2, c2 = latlon_to_grid(p2["lat"], p2["lng"], minx, miny, maxx, maxy, nrows, ncols)

    distancia_m = haversine_m(p1["lat"], p1["lng"], p2["lat"], p2["lng"])
    if distancia_m < 0.1:
        distancia_m = 0.1

    alt_a = float(matriz_dem[r1, c1])
    alt_b = float(matriz_dem[r2, c2])
    delta_h = float(alt_b - alt_a)

    pendiente = delta_h / max(distancia_m, 0.1)
    angulo_deg = float(np.degrees(np.arctan(abs(pendiente))))

    # Restricción de ángulo de volcadura (mejoras.txt líneas 153-154)
    es_infactible = angulo_deg > max_slope_deg

    velocidad_base = float(p1.get("velocidad_m_s", 0.5))
    if pendiente > 0.1:  # Subida fuerte
        velocidad_efectiva = velocidad_base * 0.6
    elif pendiente < -0.1:  # Bajada
        velocidad_efectiva = velocidad_base * 0.8
    else:  # Terreno plano
        velocidad_efectiva = velocidad_base

    tiempo_viaje = distancia_m / max(0.05, velocidad_efectiva)

    # Gasto energético (Joules estimados)
    k_base = 5.0  # Joules por metro en plano
    k_pendiente = 25.0  # Joules extra por metro de desnivel positivo
    energia_trayecto = (distancia_m * k_base) + (max(0.0, delta_h) * k_pendiente)

    # Tiempo estático de sensores en cada parada
    tiempo_medicion_sensores = 15.0

    costo_total_tiempo = tiempo_viaje + tiempo_medicion_sensores

    # Función de costo ponderada con penalización por volcadura
    penalizacion_pendiente = 1000.0 if es_infactible else 0.0
    costo_optimizacion = (energia_trayecto * 0.4) + (costo_total_tiempo * 0.6) + penalizacion_pendiente

    return {
        "distancia_m": round(distancia_m, 2),
        "delta_h_m": round(delta_h, 2),
        "alt_inicio_m": round(alt_a, 1),
        "alt_fin_m": round(alt_b, 1),
        "pendiente_pct": round(pendiente * 100.0, 1),
        "angulo_deg": round(angulo_deg, 1),
        "es_infactible": es_infactible,
        "velocidad_efectiva_m_s": round(velocidad_efectiva, 2),
        "tiempo_viaje_s": round(tiempo_viaje, 1),
        "tiempo_total_s": round(costo_total_tiempo, 1),
        "energia_j": round(energia_trayecto, 1),
        "costo_score": round(costo_optimizacion, 2)
    }

def planificar_mision_muestreo(poligono_coords, matriz_dem_raw, rovers_config, opciones=None):
    """
    Planifica la estrategia de muestreo por clusters de elevación y cálculo de rutas
    para la flota de rovers basándose estrictamente en mejoras.txt.
    """
    if opciones is None:
        opciones = {}

    matriz_dem = np.array(matriz_dem_raw, dtype=float)
    nrows, ncols = matriz_dem.shape

    # 1. Crear geometría Shapely
    poly_pts = []
    for pt in poligono_coords:
        if isinstance(pt, (list, tuple)) and len(pt) >= 2:
            poly_pts.append((float(pt[0]), float(pt[1])))  # [lng, lat]
    if poly_pts[0] != poly_pts[-1]:
        poly_pts.append(poly_pts[0])

    poly = Polygon(poly_pts)
    if not poly.is_valid:
        poly = poly.buffer(0)

    minx, miny, maxx, maxy = poly.bounds
    bounds = (minx, miny, maxx, maxy)

    # 2. Análisis Topográfico de la Parcela (Min, Max, Zonas)
    elev_validas = []
    # Muestrear celdas interiores para distribución de elevación
    for r in range(nrows):
        for c in range(ncols):
            lat, lon = grid_to_latlon(r, c, minx, miny, maxx, maxy, nrows, ncols)
            if poly.contains(Point(lon, lat)):
                elev_validas.append(matriz_dem[r, c])

    if not elev_validas:
        elev_validas = matriz_dem.flatten().tolist()

    elev_min = float(np.min(elev_validas))
    elev_max = float(np.max(elev_validas))
    rango_h = max(0.5, elev_max - elev_min)

    umbral_baja = elev_min + 0.33 * rango_h
    umbral_alta = elev_min + 0.67 * rango_h

    zonas_info = {
        "zona_baja_m": [round(elev_min, 1), round(umbral_baja, 1)],
        "zona_media_m": [round(umbral_baja, 1), round(umbral_alta, 1)],
        "zona_alta_m": [round(umbral_alta, 1), round(elev_max, 1)],
        "desnivel_total_m": round(rango_h, 1)
    }

    # 3. Determinar número de puntos de muestreo recomendados
    n_rovers = max(1, len(rovers_config))
    # Entre 6 y 16 puntos por rover según tamaño
    puntos_por_rover = opciones.get("puntos_por_rover", 8)
    n_puntos_total = max(n_rovers * 4, min(64, n_rovers * puntos_por_rover))

    # 4. Generar candidatos estratégicos en la malla (Zona Alta, Media, Baja + Baja pendiente)
    # Buscamos cubrir:
    # - Zona Alta: 20-30% puntos (lomas, seco, radiación)
    # - Zona Media: 40-50% puntos (zigzag, gradiente estable)
    # - Zona Baja: 25-35% puntos (humedad, escorrentía, materia orgánica)
    candidatos = []
    max_slope_deg = opciones.get("max_slope_deg", 25.0)

    # Generamos una cuadrícula densa para filtrar candidatos
    step_r = max(1, nrows // 16)
    step_c = max(1, ncols // 16)

    for r in range(0, nrows, step_r):
        for c in range(0, ncols, step_c):
            lat, lon = grid_to_latlon(r, c, minx, miny, maxx, maxy, nrows, ncols)
            p = Point(lon, lat)
            if poly.contains(p):
                elev = float(matriz_dem[r, c])
                
                # Clasificar zona
                if elev <= umbral_baja:
                    zona = "baja"
                elif elev >= umbral_alta:
                    zona = "alta"
                else:
                    zona = "media"

                # Calcular pendiente local aproximada
                r_prev = max(0, r - 1)
                r_next = min(nrows - 1, r + 1)
                c_prev = max(0, c - 1)
                c_next = min(ncols - 1, c + 1)
                dh_y = matriz_dem[r_next, c] - matriz_dem[r_prev, c]
                dh_x = matriz_dem[r, c_next] - matriz_dem[r, c_prev]
                dist_local_m = haversine_m(lat, lon, lat + 0.0001, lon)
                grad_m = np.sqrt(dh_x**2 + dh_y**2) / max(0.5, dist_local_m * 2)
                ang_local_deg = float(np.degrees(np.arctan(grad_m)))

                if ang_local_deg <= max_slope_deg:
                    candidatos.append({
                        "lat": lat,
                        "lng": lon,
                        "elevacion_m": round(elev, 1),
                        "zona": zona,
                        "pendiente_deg": round(ang_local_deg, 1),
                        "r": r,
                        "c": c
                    })

    if not candidatos:
        # Fallback al centroide si polígono es muy pequeño
        cent = poly.centroid
        candidatos.append({
            "lat": round(cent.y, 6),
            "lng": round(cent.x, 6),
            "elevacion_m": round(float(matriz_dem[nrows//2, ncols//2]), 1),
            "zona": "media",
            "pendiente_deg": 1.0,
            "r": nrows//2,
            "c": ncols//2
        })

    # Sub-seleccionar la cantidad deseada balanceando zonas de elevación
    cand_baja = [c for c in candidatos if c["zona"] == "baja"]
    cand_media = [c for c in candidatos if c["zona"] == "media"]
    cand_alta = [c for c in candidatos if c["zona"] == "alta"]

    target_alta = max(1, int(round(n_puntos_total * 0.25)))
    target_baja = max(2, int(round(n_puntos_total * 0.30)))
    target_media = max(2, n_puntos_total - target_alta - target_baja)

    puntos_seleccionados = []

    def submuestrear(lista, cant):
        if not lista:
            return []
        if len(lista) <= cant:
            return lista
        step = len(lista) / float(cant)
        return [lista[int(i * step)] for i in range(cant)]

    puntos_seleccionados.extend(submuestrear(cand_baja, target_baja))
    puntos_seleccionados.extend(submuestrear(cand_media, target_media))
    puntos_seleccionados.extend(submuestrear(cand_alta, target_alta))

    # Si aún faltan puntos para llegar a n_puntos_total, tomar del resto
    if len(puntos_seleccionados) < n_puntos_total and len(candidatos) > len(puntos_seleccionados):
        ya_estan = set((p["lat"], p["lng"]) for p in puntos_seleccionados)
        restantes = [c for c in candidatos if (c["lat"], c["lng"]) not in ya_estan]
        faltan = n_puntos_total - len(puntos_seleccionados)
        puntos_seleccionados.extend(submuestrear(restantes, faltan))

    # 5. Clustering espacial de puntos entre los K rovers
    puntos_mat = np.array([[p["lng"], p["lat"]] for p in puntos_seleccionados])
    k_clusters = min(n_rovers, len(puntos_seleccionados))

    if k_clusters > 1:
        kmeans = KMeans(n_clusters=k_clusters, random_state=42, n_init=10).fit(puntos_mat)
        labels = kmeans.labels_
        centroides_clusters = kmeans.cluster_centers_
    else:
        labels = np.zeros(len(puntos_seleccionados), dtype=int)
        centroides_clusters = np.mean(puntos_mat, axis=0, keepdims=True)

    # 6. Asignar cada cluster al Rover correspondiente
    # Consideramos el punto de inicio de cada rover si está especificado
    rovers_normalizados = []
    palette = ["#00e5ff", "#f59e0b", "#ec4899", "#10b981", "#8b5cf6", "#ef4444"]

    for idx, r in enumerate(rovers_config):
        color = r.get("color") or palette[idx % len(palette)]
        # Punto de inicio
        p_ini = r.get("punto_inicio")
        lat_ini, lng_ini = None, None
        if isinstance(p_ini, (list, tuple)) and len(p_ini) >= 2:
            lng_ini, lat_ini = float(p_ini[0]), float(p_ini[1])
        elif isinstance(p_ini, dict):
            lat_ini = float(p_ini.get("lat", 0))
            lng_ini = float(p_ini.get("lng", p_ini.get("lon", 0)))
        
        rovers_normalizados.append({
            "id": r.get("id", idx + 1),
            "nombre": r.get("nombre", f"Rover #{idx + 1}"),
            "modelo": r.get("modelo", "Myco-v1"),
            "modo": r.get("modo", "lectura"),
            "bateria": r.get("bateria", 80),
            "color": color,
            "lat_ini": lat_ini,
            "lng_ini": lng_ini,
            "velocidad_m_s": float(r.get("velocidad_m_s", 0.5))
        })

    # Si hay puntos de inicio en los rovers, usamos asignación óptima Hungarian
    cost_matrix = np.zeros((n_rovers, k_clusters))
    for i, rov in enumerate(rovers_normalizados):
        for j, c_pt in enumerate(centroides_clusters):
            if rov["lat_ini"] is not None and rov["lng_ini"] is not None:
                cost_matrix[i, j] = haversine_m(rov["lat_ini"], rov["lng_ini"], c_pt[1], c_pt[0])
            else:
                cost_matrix[i, j] = 0.0

    rover_to_cluster = {}
    if n_rovers <= k_clusters:
        row_ind, col_ind = linear_sum_assignment(cost_matrix)
        for r_i, c_j in zip(row_ind, col_ind):
            rover_to_cluster[r_i] = c_j
    else:
        for r_i in range(n_rovers):
            rover_to_cluster[r_i] = r_i % k_clusters

    # Agrupar puntos asignados a cada rover
    clusters_por_rover = {r_i: [] for r_i in range(n_rovers)}
    for p_idx, cluster_id in enumerate(labels):
        # Encontrar qué rover tiene este cluster
        assigned_rover_idx = None
        for r_i, c_j in rover_to_cluster.items():
            if c_j == cluster_id:
                assigned_rover_idx = r_i
                break
        if assigned_rover_idx is None:
            assigned_rover_idx = cluster_id % n_rovers
        clusters_por_rover[assigned_rover_idx].append(puntos_seleccionados[p_idx])

    # 7. Resolver TSP con Gradiente y Costo Físico para cada Rover (mejoras.txt líneas 7-9)
    rutas_resultado = []
    clusters_resultado = []

    total_distancia_flota_m = 0.0
    total_tiempo_flota_s = 0.0
    total_energia_flota_j = 0.0

    for r_idx, rov in enumerate(rovers_normalizados):
        pts_rover = clusters_por_rover.get(r_idx, [])
        cluster_centroide = {
            "lat": float(np.mean([p["lat"] for p in pts_rover])) if pts_rover else poly.centroid.y,
            "lng": float(np.mean([p["lng"] for p in pts_rover])) if pts_rover else poly.centroid.x,
        }

        # Punto de inicio del rover
        if rov["lat_ini"] is not None and rov["lng_ini"] is not None:
            start_node = {"lat": rov["lat_ini"], "lng": rov["lng_ini"], "velocidad_m_s": rov["velocidad_m_s"]}
        else:
            # Si no tiene punto de inicio fijado, empieza en el punto más bajo o de acceso seguro
            if pts_rover:
                sorted_by_elev = sorted(pts_rover, key=lambda x: x["elevacion_m"])
                start_node = {"lat": sorted_by_elev[0]["lat"], "lng": sorted_by_elev[0]["lng"], "velocidad_m_s": rov["velocidad_m_s"]}
            else:
                start_node = {"lat": poly.centroid.y, "lng": poly.centroid.x, "velocidad_m_s": rov["velocidad_m_s"]}

        # Heurística TSP con Gradiente:
        # 1. Empieza en start_node.
        # 2. Visita los puntos minimizando el costo físico de energía y pendiente de mejoras.txt.
        # 3. Prefiere recorridos que suben gradualmente y descienden en zigzag.
        ruta_waypoints = []
        puntos_pendientes = list(pts_rover)
        nodo_actual = start_node
        
        # Iniciar waypoint 0 (Base / Inicio)
        r_ini_dem, c_ini_dem = latlon_to_grid(start_node["lat"], start_node["lng"], minx, miny, maxx, maxy, nrows, ncols)
        alt_inicial = float(matriz_dem[r_ini_dem, c_ini_dem])

        waypoint_inicio = {
            "tipo": "inicio",
            "indice": 0,
            "lat": round(start_node["lat"], 6),
            "lng": round(start_node["lng"], 6),
            "elevacion_m": round(alt_inicial, 1),
            "zona": "baja" if alt_inicial <= umbral_baja else ("alta" if alt_inicial >= umbral_alta else "media"),
            "distancia_tramo_m": 0.0,
            "delta_h_tramo_m": 0.0,
            "pendiente_tramo_pct": 0.0,
            "angulo_deg": 0.0,
            "tiempo_tramo_s": 0.0,
            "energia_tramo_j": 0.0,
            "acum_dist_m": 0.0,
            "acum_tiempo_s": 0.0,
            "acum_energia_j": 0.0,
            "estado_seguridad": "seguro"
        }
        ruta_waypoints.append(waypoint_inicio)

        dist_acum = 0.0
        tiempo_acum = 0.0
        energia_acum = 0.0
        max_angulo = 0.0

        paso = 1
        while puntos_pendientes:
            # Evaluar costo físico a todos los candidatos restantes
            mejor_candidato_idx = None
            mejor_costo = float("inf")
            mejor_tramo_info = None

            for i_cand, cand in enumerate(puntos_pendientes):
                costo_info = calcular_costo_tramo_fisico(
                    nodo_actual, cand, matriz_dem, bounds, nrows, ncols, max_slope_deg=max_slope_deg
                )
                if costo_info["costo_score"] < mejor_costo:
                    mejor_costo = costo_info["costo_score"]
                    mejor_candidato_idx = i_cand
                    mejor_tramo_info = costo_info

            cand_elegido = puntos_pendientes.pop(mejor_candidato_idx)

            dist_acum += mejor_tramo_info["distancia_m"]
            tiempo_acum += mejor_tramo_info["tiempo_total_s"]
            energia_acum += mejor_tramo_info["energia_j"]
            if mejor_tramo_info["angulo_deg"] > max_angulo:
                max_angulo = mejor_tramo_info["angulo_deg"]

            ruta_waypoints.append({
                "tipo": "medicion",
                "indice": paso,
                "lat": cand_elegido["lat"],
                "lng": cand_elegido["lng"],
                "elevacion_m": cand_elegido["elevacion_m"],
                "zona": cand_elegido["zona"],
                "distancia_tramo_m": mejor_tramo_info["distancia_m"],
                "delta_h_tramo_m": mejor_tramo_info["delta_h_m"],
                "pendiente_tramo_pct": mejor_tramo_info["pendiente_pct"],
                "angulo_deg": mejor_tramo_info["angulo_deg"],
                "tiempo_tramo_s": mejor_tramo_info["tiempo_total_s"],
                "energia_tramo_j": mejor_tramo_info["energia_j"],
                "acum_dist_m": round(dist_acum, 1),
                "acum_tiempo_s": round(tiempo_acum, 1),
                "acum_energia_j": round(energia_acum, 1),
                "estado_seguridad": "inviable_alerta" if mejor_tramo_info["es_infactible"] else "seguro"
            })
            nodo_actual = cand_elegido
            paso += 1

        # Acumular a métricas globales de la flota
        total_distancia_flota_m += dist_acum
        total_tiempo_flota_s += tiempo_acum
        total_energia_flota_j += energia_acum

        # Coordenadas ordenadas para pintar en Mapbox (GeoJSON LineString [lng, lat])
        coordenadas_linea = [[wp["lng"], wp["lat"]] for wp in ruta_waypoints]

        # Estimación de consumo de batería (Asumiendo batería típica rover 500 Wh = 1,800,000 J)
        energia_wh = round(energia_acum / 3600.0, 2)
        bateria_pct_usada = round((energia_acum / 1800000.0) * 100.0, 1)

        rutas_resultado.append({
            "rover_id": rov["id"],
            "rover_nombre": rov["nombre"],
            "modelo": rov["modelo"],
            "modo": rov["modo"],
            "color": rov["color"],
            "bateria_actual": rov["bateria"],
            "punto_inicio": {
                "lat": start_node["lat"],
                "lng": start_node["lng"]
            },
            "metricas": {
                "distancia_total_m": round(dist_acum, 1),
                "tiempo_total_min": round(tiempo_acum / 60.0, 1),
                "tiempo_total_seg": round(tiempo_acum, 0),
                "energia_total_j": round(energia_acum, 1),
                "energia_total_wh": energia_wh,
                "bateria_estimada_gasto_pct": bateria_pct_usada,
                "puntos_medicion_count": len(pts_rover),
                "pendiente_max_deg": round(max_angulo, 1),
                "factible": max_angulo <= max_slope_deg
            },
            "coordenadas_ruta": coordenadas_linea,
            "waypoints": ruta_waypoints
        })

        clusters_resultado.append({
            "cluster_id": r_idx,
            "rover_id": rov["id"],
            "rover_nombre": rov["nombre"],
            "color": rov["color"],
            "centroide": cluster_centroide,
            "puntos_count": len(pts_rover),
            "puntos": pts_rover
        })

    return {
        "success": True,
        "resumen_mision": {
            "total_rovers": n_rovers,
            "total_puntos_medicion": len(puntos_seleccionados),
            "distancia_total_flota_m": round(total_distancia_flota_m, 1),
            "tiempo_estimado_flota_min": round(total_tiempo_flota_s / 60.0, 1),
            "energia_total_flota_j": round(total_energia_flota_j, 1),
            "energia_total_flota_wh": round(total_energia_flota_j / 3600.0, 2),
            "zonas_elevacion": zonas_info,
            "max_slope_seguridad_deg": max_slope_deg
        },
        "clusters": clusters_resultado,
        "rutas_rovers": rutas_resultado
    }
