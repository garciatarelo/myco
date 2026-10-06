import requests

def get_current_weather(lat, lon, api_key):
    """
    Consulta la API One Call 3.0 de OpenWeatherMap para obtener temperatura y registro de lluvia
    usando las coordenadas geográficas (lat, lon).
    """
    url = "https://api.openweathermap.org/data/3.0/onecall"
    params = {
        "lat": lat,
        "lon": lon,
        "appid": api_key,
        "units": "metric",  # Para obtener la temperatura en grados Celsius (°C)
        "lang": "es"        # Descripción del clima en español
    }
    
    response = requests.get(url, params=params)
    
    if response.status_code == 200:
        data = response.json()
        
        # En One Call 3.0, los datos del clima actual se encuentran en "current"
        current = data.get("current", {})
        
        # 1. Extraer temperatura y humedad ambiental
        temperature = current.get("temp")
        humidity = current.get("humidity")
        
        # 2. Extraer datos de lluvia
        # En One Call, 'rain' en 'current' contiene '1h' (volumen en mm para la última hora)
        rain_data = current.get("rain", {})
        rain_1h = rain_data.get("1h", 0.0)
        
        has_rained_recently = rain_1h > 0.0
        
        # 3. Descripción general del estado del tiempo
        weather_list = current.get("weather", [])
        weather_desc = weather_list[0].get("description", "desconocido") if weather_list else "desconocido"
        
        return {
            "temperature_c": temperature,
            "humidity_percent": humidity,
            "rain_1h_mm": rain_1h,
            "has_rained": has_rained_recently,
            "description": weather_desc
        }
    else:
        raise Exception(f"Error al consultar OpenWeatherMap: {response.status_code} - {response.text}")

API_KEY = "6938066117edc6952c95c676b7c8bd57"

if __name__ == "__main__":
    latitud = 30.376907
    longitud = -107.909174

    try:
        clima = get_current_weather(latitud, longitud, API_KEY)
        print(f"Condiciones meteorológicas actuales:")
        print(f"- Estado: {clima['description'].capitalize()}")
        print(f"- Temperatura: {clima['temperature_c']} °C")
        print(f"- Humedad ambiental: {clima['humidity_percent']}%")
        print(f"- Lluvia última hora: {clima['rain_1h_mm']} mm")
        print(f"- ¿Ha llovido recientemente?: {'Sí' if clima['has_rained'] else 'No'}")
        
    except Exception as e:
        print(e)