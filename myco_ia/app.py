import os
import sys
import numpy as np
from flask import Flask, request, jsonify
from flask_cors import CORS
from shapely.geometry import Polygon, Point
# Agregar el directorio actual y python/ al sys.path para imports limpios
current_dir = os.path.dirname(os.path.abspath(__file__))
python_dir = os.path.join(current_dir, "python")
if python_dir not in sys.path:
    sys.path.append(python_dir)

from ph import get_soilgrids_data, get_soil_texture_soilgrids, classify_usda_texture
from clima import get_current_weather, API_KEY as DEFAULT_OWM_KEY
from clima_marte import estimate_mars_climate, calculate_mars_dem
from ruteo_rovers import planificar_mision_muestreo



app = Flask(__name__)
CORS(app)

OWM_API_KEY = os.environ.get("OPENWEATHER_API_KEY", DEFAULT_OWM_KEY)

def calculate_polygon_grid(coords, resolution_meters=250):
    """
    Dada una lista de coordenadas [lng, lat] (GeoJSON) o [lat, lng],
    calcula la bounding box, genera la rejilla a ~250m por píxel (resolución SoilGrids)
    y filtra los puntos que quedan dentro del polígono.
    
    Retorna:
      - valid_points: lista de dicts [{'lat': float, 'lon': float}]
      - centroid: {'lat': float, 'lon': float}
      - area_approx_m2: float
    """
    if not coords or len(coords) < 3:
        raise ValueError("Se requieren al menos 3 vértices para formar un polígono.")

    # Normalizar si viene en formato [[lng, lat], ...] de GeoJSON/Turf
    # Shapely espera [(x, y)] = [(lon, lat)]
    poly_pts = []
    for pt in coords:
        if isinstance(pt, (list, tuple)) and len(pt) >= 2:
            lon = float(pt[0])
            lat = float(pt[1])
            # Si el usuario mandó [lat, lon] por equivocación (latitud típica ~ -90 a 90, longitud -180 a 180)
            # En GeoJSON estándar de Mapbox/Turf: [lng, lat]
            # Detectamos si lon está fuera de rango o si lat > 90
            poly_pts.append((lon, lat))

    # Cerrar polígono si no está cerrado
    if poly_pts[0] != poly_pts[-1]:
        poly_pts.append(poly_pts[0])

    poly = Polygon(poly_pts)
    if not poly.is_valid:
        poly = poly.buffer(0)

    centroid_pt = poly.centroid
    centroid = {"lat": round(float(centroid_pt.y), 6), "lon": round(float(centroid_pt.x), 6)}

    minx, miny, maxx, maxy = poly.bounds
    # 1 grado de latitud ~ 111,000 metros
    deg_step = resolution_meters / 111000.0

    # Si el polígono es más pequeño que 250m x 250m, tomamos el centroide
    width_deg = maxx - minx
    height_deg = maxy - miny

    valid_points = []

    if width_deg < deg_step and height_deg < deg_step:
        # Menor a un píxel de SoilGrids (6.25 ha) -> Un solo punto de muestreo representativo
        valid_points.append(centroid)
    else:
        # Generar cuadrícula de muestreo
        lats = np.arange(miny, maxy + (deg_step * 0.5), deg_step)
        lons = np.arange(minx, maxx + (deg_step * 0.5), deg_step)

        for lat in lats:
            for lon in lons:
                p = Point(lon, lat)
                if poly.contains(p):
                    valid_points.append({"lat": round(float(lat), 6), "lon": round(float(lon), 6)})

        # Si por la forma irregular ningún punto de la rejilla cayó adentro, incluir al menos el centroide
        if not valid_points:
            valid_points.append(centroid)

    # Limitar para evitar rate-limits abusivos de SoilGrids (máximo 12 puntos estratégicos para el muestreo)
    if len(valid_points) > 12:
        step_stride = int(np.ceil(len(valid_points) / 12.0))
        valid_points = valid_points[::step_stride]

    return valid_points, centroid


def calculate_suitability_matrix(grid_size, sg_data, weather_data):
    """
    Genera la matriz del terreno para el autómata celular y el gemelo digital
    combinando SoilGrids + Clima en tiempo real + Sensores del robot simulados.
    """
    y_coords, x_coords = np.ogrid[:grid_size, :grid_size]

    # 1. Materia Orgánica (%)
    base_om = float(sg_data.get('om', 1.64))
    organic_matter = np.random.uniform(base_om * 0.75, base_om * 1.25, (grid_size, grid_size))
    # Microfocos fértiles detectados
    organic_matter += 1.2 * np.exp(-((x_coords - int(grid_size * 0.35))**2 + (y_coords - int(grid_size * 0.45))**2) / (grid_size * 2.5))
    organic_matter = np.clip(organic_matter, 0.1, 5.0)

    # 2. Humedad (%) influenciada por OpenWeather (humedad ambiental y si llovió)
    base_moisture = 45.0
    if weather_data:
        if weather_data.get('has_rained', False) or (weather_data.get('rain_1h_mm', 0) > 0):
            base_moisture += 20.0
        # Correlación con humedad ambiental
        env_hum = weather_data.get('humidity_percent', 50)
        base_moisture += (env_hum - 50) * 0.15

    base_moisture = float(np.clip(base_moisture, 25.0, 75.0))
    moisture = np.random.uniform(base_moisture - 10.0, base_moisture + 10.0, (grid_size, grid_size))
    # Zona de drenaje/depresión
    moisture += 15.0 * np.exp(-((x_coords - int(grid_size * 0.75))**2 + (y_coords - int(grid_size * 0.7))**2) / (grid_size * 3))
    moisture = np.clip(moisture, 10.0, 95.0)

    # 3. Compactación (MPa) derivada de la textura (arcilla vs arena)
    clay_pct = float(sg_data.get('clay', 20.0))
    sand_pct = float(sg_data.get('sand', 50.0))
    base_compaction = 1.0 + (0.02 * clay_pct) - (0.01 * sand_pct * 0.1)
    compaction = np.full((grid_size, grid_size), base_compaction)
    compaction += np.random.uniform(-0.2, 0.25, (grid_size, grid_size))
    
    # Franja compacta / posible obstáculo físico
    obs_y1, obs_y2 = int(grid_size * 0.42), int(grid_size * 0.47)
    obs_x1, obs_x2 = int(grid_size * 0.25), int(grid_size * 0.65)
    compaction[obs_y1:obs_y2, obs_x1:obs_x2] = 3.3
    compaction = np.clip(compaction, 0.5, 3.5)

    # 4. Normalizaciones
    n_mo = np.clip(organic_matter / 5.0, 0.0, 1.0)

    # Humedad: óptimo 40% - 70%
    n_h = np.ones_like(moisture)
    n_h[moisture < 40.0] = np.clip(moisture[moisture < 40.0] / 40.0, 0.0, 1.0)
    n_h[moisture > 70.0] = np.clip(1.0 - (moisture[moisture > 70.0] - 70.0) / 30.0, 0.0, 1.0)

    # Compactación (inversa: 0.5 a 3.5 MPa)
    n_c = 1.0 - np.clip((compaction - 0.5) / 3.0, 0.0, 1.0)

    # Ponderación 35% MO, 40% Humedad, 25% Compactación
    suitability = (0.35 * n_mo) + (0.40 * n_h) + (0.25 * n_c)

    # Modificador por temperatura OpenWeather
    if weather_data:
        temp = weather_data.get('temperature_c', 22.0)
        # El micelio crece óptimamente entre 18°C y 26°C. Si hay frío extremo o calor extremo > 35°C penalizar
        if temp < 10.0 or temp > 35.0:
            suitability *= 0.88
        elif temp < 15.0 or temp > 30.0:
            suitability *= 0.94

    # Modificador por pH SoilGrids
    ph_val = float(sg_data.get('ph', 7.0))
    if ph_val > 7.5:
        suitability *= 0.95
    elif ph_val < 5.5:
        suitability *= 0.92

    # Obstáculo impenetrable
    suitability[compaction >= 3.2] = 0.0
    suitability = np.clip(suitability, 0.0, 1.0)

    # Deducir puntos óptimos recomendados para inyección de cápsulas de micelio
    # Buscamos las celdas con mayor idoneidad que no sean bordes
    flat_indices = np.argsort(suitability.ravel())[::-1]
    recommended_capsules = []
    min_dist_sq = (grid_size * 0.18) ** 2

    for idx in flat_indices:
        r, c = divmod(idx, grid_size)
        if r < 5 or r >= grid_size - 5 or c < 5 or c >= grid_size - 5:
            continue
        # Verificar distancia mínima con los ya seleccionados
        too_close = False
        for cap in recommended_capsules:
            d2 = (r - cap["grid_y"])**2 + (c - cap["grid_x"])**2
            if d2 < min_dist_sq:
                too_close = True
                break
        if not too_close:
            suit_val = round(float(suitability[r, c]), 3)
            # Determinar dosis sugerida
            dosis = "ALTO" if suit_val >= 0.75 else ("MEDIO" if suit_val >= 0.5 else "MINIMO")
            recommended_capsules.append({
                "grid_x": int(c),
                "grid_y": int(r),
                "suitability": suit_val,
                "dosis_sugerida": dosis,
                "moisture_pct": round(float(moisture[r, c]), 1),
                "compaction_mpa": round(float(compaction[r, c]), 2),
                "organic_matter_pct": round(float(organic_matter[r, c]), 2)
            })
            if len(recommended_capsules) >= 5:
                break

    return suitability, {
        "organic_matter_mean": round(float(np.mean(organic_matter)), 2),
        "moisture_mean": round(float(np.mean(moisture)), 1),
        "compaction_mean": round(float(np.mean(compaction)), 2),
        "suitability_mean": round(float(np.mean(suitability)), 3),
        "recommended_capsules": recommended_capsules
    }


@app.route("/health", methods=["GET"])
def health():
    return jsonify({
        "status": "online",
        "service": "Myco IA & Cellular Automata Engine",
        "env": "conda:escuela"
    })


@app.route("/api/calcular-terreno", methods=["POST"])
def calcular_terreno():
    """
    Endpoint principal para calcular condiciones de terreno:
    Recibe:
    {
      "poligono_coordenadas": [[lng, lat], ...],
      "entorno": "tierra" | "marte",
      "grid_size": 120 (opcional)
    }
    """
    try:
        body = request.get_json(force=True) or {}
        coords = body.get("poligono_coordenadas", [])
        entorno = body.get("entorno", "tierra").lower()
        grid_size = int(body.get("grid_size", 120))

        if not coords or len(coords) < 3:
            return jsonify({
                "success": False,
                "error": "Debes proporcionar al menos 3 coordenadas para calcular el terreno."
            }), 400

        # 1. Malla de muestreo a 250m y centroide
        sampling_points, centroid = calculate_polygon_grid(coords, resolution_meters=250)

        # 2. Consultar Clima en tiempo real (OpenWeather) con el centroide
        weather_data = None
        weather_error = None
        if entorno == "tierra":
            try:
                weather_data = get_current_weather(centroid["lat"], centroid["lon"], OWM_API_KEY)
            except Exception as e:
                weather_error = str(e)
                # Respaldo climático si la API OWM falla
                weather_data = {
                    "temperature_c": 22.0,
                    "humidity_percent": 45,
                    "rain_1h_mm": 0.0,
                    "has_rained": False,
                    "description": "condiciones estimadas de respaldo"
                }
        else:
            # Marte: Modelo del Mars Climate Database (LMD / MCD v6.2)
            try:
                mcd_res = estimate_mars_climate(
                    lat=centroid["lat"],
                    lon=centroid["lon"],
                    alt_m=float(body.get("altura_sobre_suelo", 2.0)),
                    ls_deg=float(body.get("ls_marte", 120.5)),
                    local_hour=float(body.get("hora_local", 14.0))
                )
                weather_data = {
                    "fuente": mcd_res["fuente"],
                    "temperature_c": mcd_res["temperatura"]["aire_sensor_c"],
                    "temperature_k": mcd_res["temperatura"]["aire_sensor_k"],
                    "temperature_surface_c": mcd_res["temperatura"]["superficie_suelo_c"],
                    "pressure_pa": mcd_res["presion_atmosferica"]["presion_pa"],
                    "presion_kpa": mcd_res["presion_atmosferica"]["presion_kpa"],
                    "humidity_percent": 0,
                    "rain_1h_mm": 0.0,
                    "has_rained": False,
                    "uv_flux_w_m2": mcd_res["radiacion_y_atmosfera"]["flujo_uv_w_m2"],
                    "uv_index": mcd_res["radiacion_y_atmosfera"]["indice_uv_equivalente"],
                    "description": f"MCD LMD: {mcd_res['temperatura']['aire_sensor_c']}°C a 2m, Presión {mcd_res['presion_atmosferica']['presion_pa']} Pa",
                    "detalles_mcd": mcd_res
                }
            except Exception as e:
                weather_error = str(e)
                weather_data = {
                    "temperature_c": -62.0,
                    "temperature_k": 211.15,
                    "humidity_percent": 0,
                    "rain_1h_mm": 0.0,
                    "has_rained": False,
                    "description": "Atmósfera marciana tenue (CO2, radiación UV)"
                }

        # 3. Consultar datos de suelo SoilGrids para los puntos de muestreo
        soil_samples = []
        sg_global = {
            "ph": 7.8,
            "om": 1.64,
            "sand": 53.9,
            "silt": 26.9,
            "clay": 19.3,
            "usda_class": "Loam (Franco)"
        }

        if entorno == "tierra":
            # Iterar los puntos de muestreo (hasta el límite de 12 para evitar 429)
            # Primero consultamos el centroide que es el ancla
            try:
                c_props = get_soilgrids_data(centroid["lat"], centroid["lon"])
                c_text = get_soil_texture_soilgrids(centroid["lat"], centroid["lon"])
                sand = c_text.get("sand", 53.9)
                silt = c_text.get("silt", 26.9)
                clay = c_text.get("clay", 19.3)
                usda = classify_usda_texture(sand, silt, clay)

                sg_global = {
                    "ph": round(float(c_props.get("ph", 7.8)), 2),
                    "om": round(float(c_props.get("estimated_organic_matter_percent", 1.64)), 2),
                    "soc_g_kg": round(float(c_props.get("soil_organic_carbon_g_kg", 9.5)), 2),
                    "sand": round(float(sand), 1),
                    "silt": round(float(silt), 1),
                    "clay": round(float(clay), 1),
                    "usda_class": usda
                }

                soil_samples.append({
                    "lat": centroid["lat"],
                    "lon": centroid["lon"],
                    "is_centroid": True,
                    **sg_global
                })

                # Si hay más puntos de muestreo (parcela grande), muestreamos hasta 3 adicionales para variación espacial
                for pt in sampling_points[:3]:
                    if pt["lat"] != centroid["lat"] or pt["lon"] != centroid["lon"]:
                        try:
                            pt_props = get_soilgrids_data(pt["lat"], pt["lon"])
                            pt_text = get_soil_texture_soilgrids(pt["lat"], pt["lon"])
                            p_sand = pt_text.get("sand", sand)
                            p_silt = pt_text.get("silt", silt)
                            p_clay = pt_text.get("clay", clay)
                            soil_samples.append({
                                "lat": pt["lat"],
                                "lon": pt["lon"],
                                "is_centroid": False,
                                "ph": round(float(pt_props.get("ph", sg_global["ph"])), 2),
                                "om": round(float(pt_props.get("estimated_organic_matter_percent", sg_global["om"])), 2),
                                "sand": round(float(p_sand), 1),
                                "silt": round(float(p_silt), 1),
                                "clay": round(float(p_clay), 1),
                                "usda_class": classify_usda_texture(p_sand, p_silt, p_clay)
                            })
                        except Exception:
                            # Continuar si un punto secundario excede timeout
                            pass

            except Exception as e:
                # Si falla SoilGrids en vivo, usar fallback físico y avisar
                soil_samples.append({
                    "lat": centroid["lat"],
                    "lon": centroid["lon"],
                    "is_centroid": True,
                    **sg_global,
                    "note": f"Estimación base regional: {str(e)}"
                })
        else:
            # Marte: Regolito de Marte (Jezero Crater simulación física)
            sg_global = {
                "ph": 8.5,
                "om": 0.05,
                "soc_g_kg": 0.1,
                "sand": 68.0,
                "silt": 22.0,
                "clay": 10.0,
                "usda_class": "Sandy Loam (Regolito Marciano)"
            }
            soil_samples.append({
                "lat": centroid["lat"],
                "lon": centroid["lon"],
                "is_centroid": True,
                **sg_global
            })

        # 4. Generar Matriz de Idoneidad para el Autómata Celular y Deducción de Cápsulas
        suitability_matrix, metrics = calculate_suitability_matrix(
            grid_size=grid_size,
            sg_data=sg_global,
            weather_data=weather_data
        )

        # Matriz simplificada reducida a 24x24 para preview visual rápido en frontend
        subsample = max(1, grid_size // 24)
        preview_grid = suitability_matrix[::subsample, ::subsample].round(2).tolist()

        return jsonify({
            "success": True,
            "entorno": entorno,
            "centroid": centroid,
            "grid_resolution_meters": 250,
            "sampling_points_count": len(sampling_points),
            "sampling_points": sampling_points,
            "soil_samples": soil_samples,
            "soil_summary": sg_global,
            "clima": weather_data,
            "clima_error": weather_error,
            "metrics": metrics,
            "preview_grid": preview_grid,
            "grid_dimensions": {"width": grid_size, "height": grid_size}
        })

    except Exception as e:
        import traceback
        traceback.print_exc()
        return jsonify({
            "success": False,
            "error": str(e)
        }), 500


@app.route("/api/clima-marte", methods=["POST", "GET"])
def clima_marte():
    """
    Endpoint dedicado para consultar condiciones climatológicas en Marte
    usando la parametrización de la base de datos Mars Climate Database (LMD / Jussieu):
    https://www-mars.lmd.jussieu.fr (mejoras.txt).

    Acepta tanto JSON (POST) como Query Params (GET):
    - latitud: float (ej. 18.38)
    - longitud: float (ej. 77.58)
    - altura_sobre_suelo: float (ej. 2.0 m)
    - ls_marte: float (ej. 120.5 grados)
    - hora_local: float (ej. 14.0 LTST)
    - poligono_coordenadas: opcional [[lng, lat], ...]
    """
    try:
        if request.method == "POST":
            data = request.get_json(force=True, silent=True) or {}
        else:
            data = request.args.to_dict()

        # Determinar coordenadas
        lat = None
        lon = None

        if "latitud" in data:
            lat = float(data["latitud"])
        elif "lat" in data:
            lat = float(data["lat"])

        if "longitud" in data:
            lon = float(data["longitud"])
        elif "lon" in data:
            lon = float(data["lon"])
        elif "lng" in data:
            lon = float(data["lng"])

        # Si pasaron poligono_coordenadas pero no latitud/longitud directa, calcular centroide
        coords = data.get("poligono_coordenadas", [])
        if (lat is None or lon is None) and coords and len(coords) >= 3:
            _, centroid = calculate_polygon_grid(coords, resolution_meters=250)
            lat = centroid["lat"]
            lon = centroid["lon"]

        if lat is None or lon is None:
            return jsonify({
                "success": False,
                "error": "Debes proporcionar latitud y longitud o poligono_coordenadas de la parcela marciana."
            }), 400

        alt_m = float(data.get("altura_sobre_suelo", data.get("alt", 2.0)))
        ls_deg = float(data.get("ls_marte", data.get("ls", 120.5)))
        local_hour = float(data.get("hora_local", data.get("hour", 14.0)))

        resultado = estimate_mars_climate(
            lat=lat,
            lon=lon,
            alt_m=alt_m,
            ls_deg=ls_deg,
            local_hour=local_hour
        )

        return jsonify({
            "success": True,
            "data": resultado,
            **resultado
        }), 200

    except Exception as e:
        import traceback
        traceback.print_exc()
        return jsonify({
            "success": False,
            "error": f"Error calculando clima marciano MCD: {str(e)}"
        }), 500


@app.route("/api/dem-marte", methods=["POST"])
def endpoint_dem_marte():
    """
    Endpoint para calcular automáticamente la elevación topográfica y la matriz DEM
    de Marte con base en el datum oficial MOLA (Mars Orbiter Laser Altimeter).
    Sustituye la necesidad de descargas manuales o configuración de teselas por parte del usuario.
    """
    try:
        data = request.get_json(force=True) or {}
        coords = data.get("poligono_coordenadas")
        if not coords or len(coords) < 3:
            return jsonify({
                "success": False,
                "error": "Se requieren al menos 3 coordenadas en poligono_coordenadas."
            }), 400

        grid_size = int(data.get("grid_size", 16))
        preset_alt = data.get("preset_mola_alt")
        if preset_alt is not None:
            preset_alt = float(preset_alt)

        res = calculate_mars_dem(coords, grid_size=grid_size, preset_alt=preset_alt)
        return jsonify(res), 200

    except Exception as e:
        import traceback
        traceback.print_exc()
        return jsonify({
            "success": False,
            "error": f"Error generando DEM marciano MOLA: {str(e)}"
        }), 500


@app.route("/api/escalar-dem", methods=["POST"])
def escalar_dem():
    """
    Endpoint para escalar e interpolar la Malla DEM conforme a las hectáreas
    y el espaciado operativo del robot (mejoras.txt).
    
    Recibe:
    {
      "matriz_dem": [[elev, ...], ...],  # matriz base 16x16 o similar
      "hectareas": 2.5,
      "espaciado_robot_metros": 1.0,
      "factor_escala": 2 o 4,
      "metodo": "cubic" | "linear"
    }
    """
    try:
        from scipy.interpolate import griddata

        body = request.get_json(force=True) or {}
        matriz_in = body.get("matriz_dem", [])
        hectareas = float(body.get("hectareas", 1.0))
        espaciado = float(body.get("espaciado_robot_metros", 1.0))
        factor_escala = int(body.get("factor_escala", 2))
        metodo = body.get("metodo", "cubic")

        if not matriz_in or not isinstance(matriz_in, list):
            return jsonify({"success": False, "error": "matriz_dem es requerida y debe ser un array 2D."}), 400

        matriz_np = np.array(matriz_in, dtype=float)
        filas_orig, cols_orig = matriz_np.shape

        # 1. Cálculo dimensional físico según mejoras.txt
        area_m2 = hectareas * 10000.0
        lado_estimado = float(np.sqrt(area_m2))
        n_celdas_ideal = int(np.ceil(lado_estimado / espaciado))

        # 2. Coordenadas de la malla original
        x_orig = np.arange(cols_orig)
        y_orig = np.arange(filas_orig)
        xx_orig, yy_orig = np.meshgrid(x_orig, y_orig)

        puntos = np.column_stack((xx_orig.ravel(), yy_orig.ravel()))
        valores = matriz_np.ravel()

        # Filtrar valores válidos
        mascara = ~np.isnan(valores) & (valores != 0)
        if not np.any(mascara):
            mascara = np.ones_like(valores, dtype=bool)

        puntos_validos = puntos[mascara]
        valores_validos = valores[mascara]

        # 3. Nueva malla de alta resolución interpolada
        nuevas_filas = filas_orig * factor_escala
        nuevas_cols = cols_orig * factor_escala

        x_nuevo = np.linspace(0, cols_orig - 1, nuevas_cols)
        y_nuevo = np.linspace(0, filas_orig - 1, nuevas_filas)
        xx_nuevo, yy_nuevo = np.meshgrid(x_nuevo, y_nuevo)

        # 4. Interpolación cúbica o lineal con SciPy
        try:
            matriz_fina = griddata(puntos_validos, valores_validos, (xx_nuevo, yy_nuevo), method=metodo)
        except Exception:
            # Fallback a lineal si cúbico presenta colinealidad
            matriz_fina = griddata(puntos_validos, valores_validos, (xx_nuevo, yy_nuevo), method="linear")

        # Rellenar bordes con la media o nearest
        if np.any(np.isnan(matriz_fina)):
            matriz_nearest = griddata(puntos_validos, valores_validos, (xx_nuevo, yy_nuevo), method="nearest")
            matriz_fina = np.where(np.isnan(matriz_fina), matriz_nearest, matriz_fina)

        matriz_fina = np.nan_to_num(matriz_fina, nan=float(np.nanmean(valores_validos)))
        matriz_fina = np.round(matriz_fina, 1)

        # Métricas de relieve calculadas sobre la matriz interpolada
        min_elev = float(np.min(matriz_fina))
        max_elev = float(np.max(matriz_fina))
        avg_elev = float(np.mean(matriz_fina))
        diff_elev = float(max_elev - min_elev)

        # Matriz de pendientes locales (gradiente)
        dy, dx = np.gradient(matriz_fina)
        pendientes_pct = np.sqrt(dx**2 + dy**2) * 100.0 / max(1.0, (lado_estimado / nuevas_cols))
        avg_slope = float(np.mean(pendientes_pct))

        return jsonify({
            "success": True,
            "analisis_dimensiones": {
                "hectareas": hectareas,
                "area_m2": area_m2,
                "lado_estimado_metros": round(lado_estimado, 2),
                "espaciado_robot_metros": espaciado,
                "n_celdas_recomendado": n_celdas_ideal,
            },
            "interpolacion": {
                "metodo": metodo,
                "factor_escala": factor_escala,
                "dimensiones_originales": {"filas": filas_orig, "columnas": cols_orig},
                "dimensiones_interpoladas": {"filas": nuevas_filas, "columnas": nuevas_cols},
                "total_celdas": nuevas_filas * nuevas_cols,
            },
            "metricas": {
                "min_m": round(min_elev, 1),
                "max_m": round(max_elev, 1),
                "avg_m": round(avg_elev, 1),
                "desnivel_m": round(diff_elev, 1),
                "pendiente_media_pct": round(avg_slope, 1)
            },
            "matriz_interpolada_2d": matriz_fina.tolist()
        })

    except Exception as e:
        import traceback
        traceback.print_exc()
        return jsonify({"success": False, "error": str(e)}), 500


@app.route("/api/calcular-rutas-mediciones", methods=["POST"])
def endpoint_calcular_rutas_mediciones():
    """
    Endpoint para calcular clusters y rutas óptimas de medición para la flota de rovers
    basado en la topografía DEM (mejoras.txt), zonas de elevación y puntos de inicio.
    """
    try:
        data = request.get_json() or {}
        coords = data.get("poligono_coordenadas")
        if not coords or len(coords) < 3:
            return jsonify({"success": False, "error": "Se requieren al menos 3 coordenadas para el polígono."}), 400

        matriz_dem = data.get("matriz_dem")
        if not matriz_dem or not isinstance(matriz_dem, list) or len(matriz_dem) == 0:
            # Fallback a una matriz base 16x16 plana con suave gradiente si no se envió DEM aún
            base_alt = float(data.get("altitud_base", 1470.0))
            matriz_dem = np.full((16, 16), base_alt)
            # Agregar suave pendiente para simulación coherente
            for i in range(16):
                matriz_dem[i, :] += (i * 0.2)
            matriz_dem = matriz_dem.tolist()

        rovers = data.get("rovers", [])
        puntos_inicio = data.get("puntos_inicio_escaneo", [])

        # Si no pasaron rovers pero pasaron puntos de inicio con rover asignado, armar la lista
        if (not rovers or len(rovers) == 0) and puntos_inicio and len(puntos_inicio) > 0:
            rovers = []
            palette = ["#00e5ff", "#f59e0b", "#ec4899", "#10b981", "#8b5cf6"]
            for idx, pt in enumerate(puntos_inicio):
                rovers.append({
                    "id": pt.get("robot_id") or idx + 1,
                    "nombre": pt.get("robot_nombre") or f"Rover #{idx + 1}",
                    "modelo": pt.get("robot_modelo") or "Myco Rover",
                    "modo": pt.get("robot_modo") or "lectura",
                    "bateria": pt.get("robot_bateria") or 85,
                    "punto_inicio": [pt.get("lng"), pt.get("lat")],
                    "color": palette[idx % len(palette)]
                })

        # Si aún no hay rovers configurados, crear al menos 1 rover de exploración por defecto
        if not rovers or len(rovers) == 0:
            rovers = [{
                "id": 1,
                "nombre": "Myco-01 (Principal)",
                "modelo": "Myco-v1 Pro",
                "modo": "lectura",
                "bateria": 90,
                "punto_inicio": coords[0],
                "color": "#00e5ff"
            }]

        opciones = {
            "puntos_por_rover": int(data.get("puntos_por_rover", 8)),
            "max_slope_deg": float(data.get("max_slope_deg", 25.0))
        }

        resultado = planificar_mision_muestreo(coords, matriz_dem, rovers, opciones)
        return jsonify(resultado), 200

    except Exception as e:
        import traceback
        traceback.print_exc()
        return jsonify({"success": False, "error": f"Error calculando rutas y clusters: {str(e)}"}), 500


if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5001))
    print(f" Iniciando Myco IA Flask Server en http://127.0.0.1:{port}")
    app.run(host="0.0.0.0", port=port, debug=True)
