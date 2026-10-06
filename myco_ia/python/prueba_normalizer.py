import numpy as np

def generate_terrain_with_soilgrids_baseline(grid_size=120, sg_data=None):
    """
    Genera la matriz de idoneidad (suitability) combinando la línea base 
    de SoilGrids (para la celda/región) con variaciones de sensores locales del robot.
    
    sg_data: Diccionario con los datos extraídos de la API de SoilGrids:
             {'ph': 7.8, 'om': 1.64, 'sand': 53.9, 'silt': 26.9, 'clay': 19.3}
    """
    if sg_data is None:
        # Valores por defecto de respaldo basados en tu consulta
        sg_data = {'ph': 7.8, 'om': 1.64, 'sand': 53.9, 'silt': 26.9, 'clay': 19.3}

    y_coords, x_coords = np.ogrid[:grid_size, :grid_size]
    
    # 1. Materia Orgánica (%): Usamos el baseline de SoilGrids (1.64%) como ancla
    # y simulamos la variación local captada por el sensor óptico del robot.
    base_om = sg_data['om']
    organic_matter = np.random.uniform(base_om * 0.7, base_om * 1.3, (grid_size, grid_size))
    # Añadir micro-focos fértiles detectados por el robot en ruta
    organic_matter += 1.2 * np.exp(-((x_coords - 40)**2 + (y_coords - 50)**2) / 300)
    organic_matter = np.clip(organic_matter, 0.1, 5.0)

    # 2. Humedad (%): Dinámica del terreno (captada por sensor capacitivo)
    moisture = np.random.uniform(35.0, 60.0, (grid_size, grid_size))
    # Zona de depresión con mayor humedad local
    moisture += 25.0 * np.exp(-((x_coords - 90)**2 + (y_coords - 80)**2) / 400)
    moisture = np.clip(moisture, 10.0, 100.0)

    # 3. Compactación (MPa): Derivada de la textura Loam de SoilGrids
    # Un suelo Franco (Loam) tiene una dureza base moderada (~1.5 MPa)
    # Texturas con más arcilla o arena varían esta base física.
    base_compaction = 1.0 + (0.02 * sg_data['clay']) - (0.01 * sg_data['sand'] * 0.1)
    compaction = np.full((grid_size, grid_size), base_compaction)
    
    # Ruido del terreno y obstáculos mecánicos reales detectados por el robot (ej. rocas)
    compaction += np.random.uniform(-0.2, 0.3, (grid_size, grid_size))
    compaction[50:55, 30:70] = 3.4  # Franja compacta / obstáculo
    compaction = np.clip(compaction, 0.5, 3.5)

    # 4. Normalización ponderada para el autómata celular
    # Normalizar MO (Asumiendo rango esperado 0% a 5%)
    n_mo = np.clip(organic_matter / 5.0, 0.0, 1.0)
    
    # Normalizar Humedad (Óptimo biológico para micelio: 40% - 70%)
    n_h = np.ones_like(moisture)
    low_moisture = moisture < 40.0
    high_moisture = moisture > 70.0
    n_h[low_moisture] = np.clip(moisture[low_moisture] / 40.0, 0.0, 1.0)
    n_h[high_moisture] = np.clip(1.0 - (moisture[high_moisture] - 70.0) / 30.0, 0.0, 1.0)

    # Normalizar Compactación (Inversa: de 0.5 a 3.5 MPa)
    n_c = 1.0 - np.clip((compaction - 0.5) / 3.0, 0.0, 1.0)

    # 5. Índice Compuesto Final con Criterio de Ponderación Híbrido:
    # 35% Materia Orgánica (Soporte nutritivo)
    # 40% Humedad (Factor crítico para el crecimiento hifal)
    # 25% Compactación (Viabilidad de penetración mecánica)
    soil_suitability_index = (0.35 * n_mo) + (0.40 * n_h) + (0.25 * n_c)
    
    # El pH de 7.8 (alcalino moderado) se puede usar como un factor global de penalización leve (ej. -5% de velocidad hifal)
    if sg_data['ph'] > 7.5:
        soil_suitability_index *= 0.95 

    return np.clip(soil_suitability_index, 0.0, 1.0), {
        "organic_matter": organic_matter,
        "moisture": moisture,
        "compaction": compaction
    }

# --- Prueba rápida con tus datos de SoilGrids ---
soil_grids_output = {
    'ph': 7.80, 'om': 1.64, 
    'sand': 53.9, 'silt': 26.9, 'clay': 19.3
}

suitability_map, raw_sensors = generate_terrain_with_soilgrids_baseline(grid_size=120, sg_data=soil_grids_output)
print("Matriz de idoneidad generada exitosamente para el autómata celular.")
print(f"Idoneidad promedio en la parcela: {np.mean(suitability_map):.3f}")