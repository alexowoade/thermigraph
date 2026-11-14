# ThermiGraph Module 1: physics_engine.py
# Live WBGT estimate for Mussafah, from Open-Meteo weather data.
# No API key needed.
#
# IMPORTANT: this is a PROTOTYPE ESTIMATE, not a calibrated meter
# reading. The wet bulb is calculated with the Stull formula.
# The black globe temperature is only approximated from solar
# radiation (globe = air temp + solar * 0.02). A real safety
# decision needs a real WBGT meter on site.

import math

import requests

LATITUDE = 24.3613
LONGITUDE = 54.5038
PLACE = "Mussafah"

# NIOSH recommended limits, acclimatised workers, continuous work.
NIOSH_LIMITS = {
    "Light": 30.0,
    "Moderate": 28.0,
    "Heavy": 26.0,
    "Very heavy": 25.0,
}


def wet_bulb_stull(temp_c, humidity):
    """Wet bulb temperature in C, Stull formula."""
    return (
        temp_c * math.atan(0.151977 * math.sqrt(humidity + 8.313659))
        + math.atan(temp_c + humidity)
        - math.atan(humidity - 1.676331)
        + 0.00391838 * (humidity ** 1.5) * math.atan(0.023101 * humidity)
        - 4.686035
    )


def estimate_wbgt(temp_c, humidity, solar_w_m2):
    """Outdoor WBGT estimate in C.

    WBGT = 0.7 * wet bulb + 0.2 * black globe + 0.1 * dry bulb
    """
    wet_bulb = wet_bulb_stull(temp_c, humidity)
    black_globe = temp_c + solar_w_m2 * 0.02
    wbgt = 0.7 * wet_bulb + 0.2 * black_globe + 0.1 * temp_c
    return wbgt, wet_bulb, black_globe


def niosh_check(wbgt):
    """Return one line per workload: OK or OVER LIMIT."""
    lines = []
    for work, limit in NIOSH_LIMITS.items():
        if wbgt <= limit:
            lines.append(f"  {work}: OK ({wbgt:.1f} <= {limit:.0f})")
        else:
            lines.append(f"  {work}: OVER LIMIT ({wbgt:.1f} > {limit:.0f})")
    return lines


def main():
    url = "https://api.open-meteo.com/v1/forecast"
    params = {
        "latitude": LATITUDE,
        "longitude": LONGITUDE,
        "current": "temperature_2m,relative_humidity_2m,wind_speed_10m",
        "hourly": "temperature_2m,relative_humidity_2m,wind_speed_10m,shortwave_radiation",
        "timezone": "Asia/Dubai",
        "forecast_days": 3,
    }
    response = requests.get(url, params=params, timeout=30)
    response.raise_for_status()
    data = response.json()

    current = data["current"]
    temp_c = current["temperature_2m"]
    humidity = current["relative_humidity_2m"]
    wind = current["wind_speed_10m"]

    # Hourly solar radiation is by the hour, current time is by 15 min,
    # so match on the hour part, for example 12:15 matches 12:00.
    hour = current["time"][:13]
    hour_index = [t[:13] for t in data["hourly"]["time"]].index(hour)
    solar = data["hourly"]["shortwave_radiation"][hour_index]

    wbgt, wet_bulb, black_globe = estimate_wbgt(temp_c, humidity, solar)

    print(f"{PLACE} live reading")
    print(f"Time: {current['time']}")
    print(f"Temperature: {temp_c} C")
    print(f"Humidity: {humidity} %")
    print(f"Wind: {wind} km/h")
    print(f"Solar radiation: {solar} W/m2")
    print(f"Wet bulb (Stull): {wet_bulb:.1f} C")
    print(f"Black globe (estimated): {black_globe:.1f} C")
    print(f"WBGT estimate: {wbgt:.1f} C")
    print("NIOSH, acclimatised, continuous work:")
    for line in niosh_check(wbgt):
        print(line)
    print("Note: prototype estimate from weather data, not a meter reading.")


if __name__ == "__main__":
    main()
