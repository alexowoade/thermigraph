# ThermiGraph Module 1, step 2
# Live weather for Mussafah, Abu Dhabi, from Open-Meteo.
# No API key needed.

import requests

url = "https://api.open-meteo.com/v1/forecast"
params = {
    "latitude": 24.3613,
    "longitude": 54.5038,
    "current": "temperature_2m,relative_humidity_2m,wind_speed_10m",
    "hourly": "temperature_2m,relative_humidity_2m,wind_speed_10m,shortwave_radiation",
    "timezone": "Asia/Dubai",
    "forecast_days": 3,
}

response = requests.get(url, params=params, timeout=30)
response.raise_for_status()
data = response.json()

current = data["current"]
print("Mussafah live reading")
print("Temperature:", current["temperature_2m"], "C")
print("Humidity:", current["relative_humidity_2m"], "%")
print("Wind:", current["wind_speed_10m"], "km/h")
print("Time:", current["time"])
