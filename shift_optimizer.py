# ThermiGraph Module 4: shift_optimizer.py
# Shift optimizer v1 for Mussafah, for tomorrow.
# Uses the live WBGT estimate from physics_engine.py.
#
# Rules in v1, all labelled as prototype guidance:
# - Heavy labour is scheduled 06:00 to 10:00, when WBGT is lowest.
# - Work-rest ratio follows the hourly WBGT estimate:
#   WBGT <= 25: 60 work / 0 rest, 25 to 26: 45 / 15,
#   26 to 28: 30 / 30, over 28: no outdoor work.
# - Shade break 12:30 to 15:00. In the UAE the legal Midday Break
#   is 12:30 to 15:00 from 15 June to 15 September. In November
#   this is a recommended shade break in this prototype, not a
#   claim that the summer law applies in November.
# - Crews are anonymised: Crew A and Crew B, no names.
# - This is prototype guidance from weather data, not a meter
#   reading and not a medical or legal decision.

from datetime import date, timedelta

import requests

from physics_engine import estimate_wbgt

LATITUDE = 24.3613
LONGITUDE = 54.5038
PLACE = "Mussafah"


def work_rest(wbgt):
    """Return work minutes, rest minutes, and a short label."""
    if wbgt > 28.0:
        return 0, 60, "NO OUTDOOR WORK"
    if wbgt > 26.0:
        return 30, 30, "30 work / 30 rest"
    if wbgt > 25.0:
        return 45, 15, "45 work / 15 rest"
    return 60, 0, "60 work / 0 rest"


def main(clothing: str = "light_civilian"):
    tomorrow = date.today() + timedelta(days=1)
    tomorrow_text = tomorrow.isoformat()

    url = "https://api.open-meteo.com/v1/forecast"
    params: dict[str, str | float | int] = {
        "latitude": LATITUDE,
        "longitude": LONGITUDE,
        "hourly": "temperature_2m,relative_humidity_2m,wind_speed_10m,shortwave_radiation",
        "timezone": "Asia/Dubai",
        "forecast_days": 3,
    }
    response = requests.get(url, params=params, timeout=30)
    response.raise_for_status()
    data = response.json()
    hourly = data["hourly"]
    winds = hourly.get("wind_speed_10m", [10.0] * len(hourly["time"]))

    print(f"{PLACE} shift plan for {tomorrow_text} (clothing: {clothing})")
    print("Heavy labour 06:00 to 10:00. Crews are anonymised: Crew A, Crew B.")
    print("Shade break 12:30 to 15:00, recommended in November.")
    print()

    for i, time_text in enumerate(hourly["time"]):
        day = time_text[:10]
        hour = int(time_text[11:13])
        if day != tomorrow_text:
            continue
        if hour < 6 or hour > 17:
            continue

        temp_c = hourly["temperature_2m"][i]
        humidity = hourly["relative_humidity_2m"][i]
        solar = hourly["shortwave_radiation"][i]
        wbgt, _, _ = estimate_wbgt(temp_c, humidity, solar, winds[i], clothing=clothing)

        if 13 <= hour < 15:
            print(f"{hour:02d}:00  WBGT {wbgt:.1f} C  SHADE BREAK, no outdoor work")
            continue

        work, rest, label = work_rest(wbgt)
        if hour < 10:
            crew = "Crew A, heavy labour"
        elif hour < 12:
            crew = "Crew A, light work only"
        else:
            crew = "Crew B, light work only"
        print(f"{hour:02d}:00  WBGT {wbgt:.1f} C  {label}  {crew}")

    print()
    print("Cooling schedule: water and shade at every rest break.")
    print("Rotate Crew A to rest after 10:00, Crew B takes the afternoon.")
    print("Note: prototype guidance from weather data, not a meter reading.")


if __name__ == "__main__":
    main()
