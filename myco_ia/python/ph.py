import requests
#https://soilgrids.org
def get_soilgrids_data(lat, lon):
    """
    Consulta la API REST de SoilGrids v2.0 para un par de coordenadas (lat, lon).
    Extrae pH (phh2o) y Carbono Orgánico del Suelo (soc) para la capa superficial (0-5 cm).
    """
    url = "https://rest.isric.org/soilgrids/v2.0/properties/query"
    
    # Parámetros de la consulta
    params = {
        "lon": lon,
        "lat": lat,
        "property": ["phh2o", "soc"], # pH en agua y Carbono Orgánico
        "depth": ["0-5cm", "5-15cm"], # Capas superficiales de interés agrícola
        "value": ["mean"]            # Obtenemos el valor promedio estimado
    }
    
    response = requests.get(url, params=params)
    
    if response.status_code == 200:
        data = response.json()
        results = {}
        
        # Procesar las propiedades devueltas
        properties = data.get("properties", {}).get("layers", [])
        for prop in properties:
            name = prop["name"]
            # Tomamos la primera profundidad (0-5 cm)
            depth_data = prop["depths"][0]
            value_mean = depth_data["values"]["mean"]
            
            # Aplicar factores de conversión oficiales de SoilGrids
            if name == "phh2o":
                # Factor de conversión: el valor guardado se divide entre 10
                results["ph"] = value_mean / 10.0
            elif name == "soc":
                # Factor de conversión para Carbono Orgánico (decigramos/kg a g/kg)
                results["soil_organic_carbon_g_kg"] = value_mean / 10.0
                # Estimación aproximada de materia orgánica multiplicando SOC por 1.724
                results["estimated_organic_matter_percent"] = (value_mean / 10.0) * 1.724 / 10.0

        return results
    else:
        raise Exception(f"Error en la consulta a SoilGrids: {response.status_code} - {response.text}")


def get_soil_texture_soilgrids(lat, lon):
    """Consulta la API de SoilGrids para obtener arena, limo y arcilla (0-5 cm)."""
    url = "https://rest.isric.org/soilgrids/v2.0/properties/query"
    params = {
        "lon": lon,
        "lat": lat,
        "property": ["sand", "silt", "clay"],
        "depth": ["0-5cm"],
        "value": ["mean"]
    }
    
    response = requests.get(url, params=params)
    if response.status_code == 200:
        data = response.json()
        texture = {}
        for prop in data.get("properties", {}).get("layers", []):
            name = prop["name"]
            texture[name] = prop["depths"][0]["values"]["mean"] / 10.0 # Convertir g/kg a %
        return texture
    else:
        raise Exception(f"Error en SoilGrids: {response.status_code}")

def classify_usda_texture(sand, silt, clay):
    """
    Clasifica el tipo de suelo según el Triángulo Textural del USDA.
    Recibe porcentajes de arena, limo y arcilla (que deben sumar ~100%).
    """
    # Normalizar por seguridad si la suma difiere ligeramente de 100
    total = sand + silt + clay
    if total > 0:
        sand = (sand / total) * 100
        silt = (silt / total) * 100
        clay = (clay / total) * 100

    # Algoritmo de clasificación USDA basado en polígonos del triángulo
    if clay >= 40:
        if silt >= 40:
            return "Silty Clay (Arcillo-Limoso)"
        elif sand <= 45:
            return "Clay (Arcilloso)"
        else:
            return "Sandy Clay (Arcillo-Arenoso)"
            
    elif clay >= 27 and clay < 40:
        if sand <= 20:
            return "Silty Clay Loam (Franco-Arcillo-Limoso)"
        elif sand > 45:
            return "Sandy Clay Loam (Franco-Arcillo-Arenoso)"
        else:
            return "Clay Loam (Franco-Arcilloso)"
            
    elif clay >= 7 and clay < 27:
        if silt >= 50:
            return "Silty Loam (Franco-Limoso)"
        elif silt >= 28 and silt < 50 and sand <= 52:
            return "Loam (Franco)"
        elif sand > 52 and silt + 1.5 * clay < 50:
            return "Sandy Loam (Franco-Arenoso)"
        else:
            return "Loam (Franco)"
            
    else: # clay < 7
        if silt >= 50:
            return "Silt (Limoso)"
        elif silt >= 30 and silt < 50:
            return "Loam (Franco)"
        elif sand > 85:
            return "Sand (Arenoso)"
        elif sand > 70:
            return "Loamy Sand (Arena Franca)"
        else:
            return "Sandy Loam (Franco-Arenoso)"

if __name__ == "__main__":
    latitud = 30.376907  # Coordenada de ejemplo (zona norte de México)
    longitud = -107.909174

    try:
        soil_info = get_soilgrids_data(latitud, longitud)
        print("Datos extraídos de SoilGrids para la superficie (0-5 cm):")
        print(f"- pH del suelo (H2O): {soil_info.get('ph'):.2f}")
        print(f"- Carbono Orgánico (g/kg): {soil_info.get('soil_organic_carbon_g_kg'):.2f}")
        print(f"- Materia Orgánica estimada (%): {soil_info.get('estimated_organic_matter_percent'):.2f}%")
      
        tex = get_soil_texture_soilgrids(latitud, longitud)
        sand_p = tex.get('sand', 0)
        silt_p = tex.get('silt', 0)
        clay_p = tex.get('clay', 0)
        usda_class = classify_usda_texture(sand_p, silt_p, clay_p)
        print(f"Coordenadas: ({latitud}, {longitud})")
        print(f"- Arena: {sand_p:.1f}%")
        print(f"- Limo:  {silt_p:.1f}%")
        print(f"- Arcilla: {clay_p:.1f}%")
        print(f"--> Clasificación USDA: {usda_class}")

    except Exception as e:
        print(e)