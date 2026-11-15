# ThermiGraph Module 2: strain_timeline.py
# 6-day strain timeline for Mussafah.
# Past 3 days plus today plus the next 2 days, from Open-Meteo.
# No API key needed.
#
# IMPORTANT: the Cumulative Thermal Strain Index below is a
# PROTOTYPE SCORE, not a clinical diagnosis. It is a simple
# running total so a crew's strain over several days is visible.
# A real safety decision needs a real WBGT meter and a clinician.

from collections import defaultdict

import requests

from physics_engine import estimate_wbgt

LATITUDE = 24.3613
LONGITUDE = 54.5038
PLACE = "Mussafah"

# Night minimum above this means the body did not cool down
# overnight, so recovery debt is flagged.
RECOVERY_DEBT_NIGHT_MIN = 28.0


def daily_points(max_wbgt, recovery_debt):
    """Simple prototype points for one day."""
    if max_wbgt > 28.0:
        points = 3
    elif max_wbgt > 26.0:
        points = 2
    elif max_wbgt > 25.0:
        points = 1
    else:
        points = 0
    if recovery_debt:
        points += 1
    return points


def main():
    url = "https://api.open-meteo.com/v1/forecast"
    params = {
        "latitude": LATITUDE,
        "longitude": LONGITUDE,
        "hourly": "temperature_2m,relative_humidity_2m,wind_speed_10m,shortwave_radiation",
        "timezone": "Asia/Dubai",
        "past_days": 3,
        "forecast_days": 3,
    }
    response = requests.get(url, params=params, timeout=30)
    response.raise_for_status()
    data = response.json()

    hourly = data["hourly"]
    winds = hourly.get("wind_speed_10m", [10.0] * len(hourly["time"]))

    # Group every hour by its date.
    by_day = defaultdict(list)
    for i, time_text in enumerate(hourly["time"]):
        day = time_text[:10]
        by_day[day].append(i)

    print(f"{PLACE} strain timeline")
    print("Past 3 days plus today plus next 2 days")
    print("Cumulative Thermal Strain Index is a prototype score.")
    print()

    cumulative = 0
    for day in sorted(by_day):
        indexes = by_day[day]
        temps = [hourly["temperature_2m"][i] for i in indexes]
        max_wbgt = 0.0
        hours_over_heavy = 0
        night_temps = []

        for i in indexes:
            time_text = hourly["time"][i]
            hour = int(time_text[11:13])
            temp_c = hourly["temperature_2m"][i]
            humidity = hourly["relative_humidity_2m"][i]
            solar = hourly["shortwave_radiation"][i]
            wbgt, _, _ = estimate_wbgt(temp_c, humidity, solar, winds[i])
            if wbgt > max_wbgt:
                max_wbgt = wbgt
            if wbgt > 26.0:
                hours_over_heavy += 1
            if hour < 6:
                night_temps.append(temp_c)

        night_min = min(night_temps) if night_temps else min(temps)
        recovery_debt = night_min > RECOVERY_DEBT_NIGHT_MIN
        points = daily_points(max_wbgt, recovery_debt)
        cumulative += points

        debt_text = "YES" if recovery_debt else "no"
        print(f"{day}: max temp {max(temps):.1f} C, night min {night_min:.1f} C")
        print(f"  max WBGT estimate {max_wbgt:.1f} C, hours over heavy limit: {hours_over_heavy}")
        print(f"  Nocturnal Recovery Debt: {debt_text}, day points {points}, cumulative {cumulative}")

    print()
    print(f"Red line: cumulative 12 over these 6 days.")
    if cumulative >= 12:
        print("Flag: cumulative strain is high, crew is crossing the red line.")
    else:
        print("Flag: cumulative strain is below the red line on live November data.")
        print("Use the heat spike simulator later to show the collapse story.")


if __name__ == "__main__":
    main()
