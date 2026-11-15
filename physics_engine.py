# ThermiGraph Module 1: physics_engine.py
# Live WBGT estimate for Mussafah, from Open-Meteo weather data.
# No API key needed.
#
# IMPORTANT: this is a PROTOTYPE ESTIMATE, not a calibrated meter
# reading. The wet bulb is calculated with the Stull formula.
# The black globe temperature is approximated from shortwave solar
# radiation adjusted for convective wind cooling. A real safety
# decision needs a calibrated WBGT meter on site.

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


def wet_bulb_stull(temp_c: float, humidity: float) -> float:
    """Wet bulb temperature in C, Stull (2011) empirical formula."""
    rh = max(5.0, min(99.9, float(humidity)))
    ta = float(temp_c)
    return (
        ta * math.atan(0.151977 * math.sqrt(rh + 8.313659))
        + math.atan(ta + rh)
        - math.atan(rh - 1.676331)
        + 0.00391838 * (rh ** 1.5) * math.atan(0.023101 * rh)
        - 4.686035
    )


def estimate_wbgt(
    temp_c: float,
    humidity: float,
    solar_w_m2: float,
    wind_kmh: float = 10.0,
):
    """Outdoor WBGT estimate in C with convective wind adjustment on black globe.

    WBGT = 0.7 * wet bulb + 0.2 * black globe + 0.1 * dry bulb
    At the reference wind speed of 10 km/h, wind_factor == 1.0.
    Stagnant air (<10 km/h) increases radiant globe heating; higher wind cools the globe.
    """
    wet_bulb = wet_bulb_stull(temp_c, humidity)
    effective_wind_kmh = max(2.0, float(wind_kmh))
    wind_factor = (10.0 / effective_wind_kmh) ** 0.35
    solar_increment = min(18.0, max(0.0, float(solar_w_m2)) * 0.02 * wind_factor)
    black_globe = float(temp_c) + solar_increment
    wbgt = 0.7 * wet_bulb + 0.2 * black_globe + 0.1 * float(temp_c)
    return wbgt, wet_bulb, black_globe


def niosh_check(wbgt: float):
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

    hour = current["time"][:13]
    hour_index = [t[:13] for t in data["hourly"]["time"]].index(hour)
    solar = data["hourly"]["shortwave_radiation"][hour_index]

    wbgt, wet_bulb, black_globe = estimate_wbgt(temp_c, humidity, solar, wind)

    print(f"{PLACE} live reading")
    print(f"Time: {current['time']}")
    print(f"Temperature: {temp_c} C")
    print(f"Humidity: {humidity} %")
    print(f"Wind: {wind} km/h")
    print(f"Solar radiation: {solar} W/m2")
    print(f"Wet bulb (Stull): {wet_bulb:.1f} C")
    print(f"Black globe (wind-adjusted estimate): {black_globe:.1f} C")
    print(f"WBGT estimate: {wbgt:.1f} C")
    print("NIOSH, acclimatised, continuous work:")
    for line in niosh_check(wbgt):
        print(line)
    print("Note: prototype estimate from weather data, not a meter reading.")


if __name__ == "__main__":
    main()
