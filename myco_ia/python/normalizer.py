import numpy as np

def normalize_soil_parameters(organic_matter, moisture, compaction, 
                              mo_limits=(0.0, 5.0),       # Porcentaje de MO (%)
                              moisture_range=(30.0, 70.0), # Rango óptimo de humedad (%)
                              compaction_limits=(0.5, 3.5)): # Resistencia / compactación (MPa)
    """
    Normaliza y combina las 3 capas sensoriales del suelo en un índice compuesto
    de idoneidad (0.0 a 1.0) ponderando equitativamente cada una al 33.33% (1/3).
    
    1. Materia Orgánica (Directa): Más carbono/MO = mayor idoneidad.
    2. Humedad (Óptimo / Trapezoidal): Óptimo en moisture_range; decae en sequía (<min) o saturación/anoxia (>max).
    3. Compactación (Inversa): Mayor dureza/MPa = menor idoneidad física.
    """
    organic_matter = np.asarray(organic_matter, dtype=float)
    moisture = np.asarray(moisture, dtype=float)
    compaction = np.asarray(compaction, dtype=float)

    # 1. Normalizar Materia Orgánica (Relación Directa)
    mo_min, mo_max = mo_limits
    n_mo = np.clip((organic_matter - mo_min) / (mo_max - mo_min), 0.0, 1.0)
    
    # 2. Normalizar Humedad (Rango óptimo trapezoidal / campana)
    h_min, h_max = moisture_range
    n_h = np.zeros_like(moisture, dtype=float)
    
    # Zona óptima (máxima viabilidad = 1.0)
    ideal_mask = (moisture >= h_min) & (moisture <= h_max)
    n_h[ideal_mask] = 1.0
    
    # Penalización por sequía (< h_min)
    low_mask = moisture < h_min
    if h_min > 0:
        n_h[low_mask] = np.clip(moisture[low_mask] / h_min, 0.0, 1.0)
    
    # Penalización por anegamiento / encharcamiento (> h_max hasta 100%)
    high_mask = moisture > h_max
    if h_max < 100.0:
        n_h[high_mask] = np.clip(1.0 - (moisture[high_mask] - h_max) / (100.0 - h_max), 0.0, 1.0)
    
    # 3. Normalizar Compactación (Relación Inversa: mayor compactación = menor avance de hifas)
    c_min, c_max = compaction_limits
    n_c = 1.0 - np.clip((compaction - c_min) / (c_max - c_min), 0.0, 1.0)
    
    # 4. Índice Compuesto: Suma ponderada con 33.33% cada una
    soil_suitability_index = (0.3333 * n_mo) + (0.3333 * n_h) + (0.3333 * n_c)
    
    return np.clip(soil_suitability_index, 0.0, 1.0)

def generate_multi_sensor_terrain(grid_size=120):
    """
    Genera matrices sintéticas simuladas de los 3 sensores de suelo:
    - Materia Orgánica (%)
    - Humedad (%)
    - Compactación (MPa)
    y retorna la matriz de idoneidad normalizada junto con los datos crudos.
    """
    y_coords, x_coords = np.ogrid[:grid_size, :grid_size]
    
    # 1. Materia Orgánica (%) típica: 0.5% a 5.0%
    organic_matter = np.random.uniform(0.5, 2.5, (grid_size, grid_size))
    # Focos fértiles
    organic_matter += 2.2 * np.exp(-((x_coords - 30)**2 + (y_coords - 30)**2) / 450)
    organic_matter += 1.8 * np.exp(-((x_coords - 90)**2 + (y_coords - 85)**2) / 600)
    organic_matter = np.clip(organic_matter, 0.0, 5.0)

    # 2. Humedad (%) típica: 20% a 90%
    moisture = np.random.uniform(35.0, 65.0, (grid_size, grid_size))
    # Zona árida/seca
    moisture -= 25.0 * np.exp(-((x_coords - 20)**2 + (y_coords - 70)**2) / 400)
    # Zona saturada/encharcada
    moisture += 30.0 * np.exp(-((x_coords - 100)**2 + (y_coords - 30)**2) / 350)
    moisture = np.clip(moisture, 0.0, 100.0)

    # 3. Compactación (MPa) típica: 0.8 a 3.5 MPa
    compaction = np.random.uniform(1.0, 2.2, (grid_size, grid_size))
    # Roca / lecho ultracompactado impenetrable (franja central)
    compaction[45:55, 20:80] = 3.5
    compaction = np.clip(compaction, 0.5, 3.5)

    # Normalización compuesta
    suitability = normalize_soil_parameters(organic_matter, moisture, compaction)
    
    # Forzar obstáculo absoluto (valor <= 0.02) en la franja impenetrable
    suitability[45:55, 20:80] = 0.0

    return suitability, {
        "organic_matter": organic_matter,
        "moisture": moisture,
        "compaction": compaction
    }
