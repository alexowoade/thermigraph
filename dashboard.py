# ThermiGraph dashboard: app.py for Streamlit, dark clinical view.
# Run with: streamlit run dashboard.py
# It brings Modules 1 to 4 together on one screen:
# live WBGT for 3 zones, strain timeline chart, field-log triage,
# heat spike simulator, and a downloadable compliance report.
#
# All WBGT values are PROTOTYPE ESTIMATES from weather data,
# not calibrated meter readings.

from collections import defaultdict

import pandas as pd
import requests
import streamlit as st

from physics_engine import estimate_wbgt, niosh_check
from triage import SAMPLE_LOG, TriageResult

ZONES = {
    "Mussafah": (24.3613, 54.5038),
    "KEZAD / Khalifa Port": (24.7880, 54.6947),
    "Ruwais": (24.0916, 52.6527),
}


def fetch_live(lat, lon):
    """Live current reading plus solar for one zone."""
    url = "https://api.open-meteo.com/v1/forecast"
    params = {
        "latitude": lat,
        "longitude": lon,
        "current": "temperature_2m,relative_humidity_2m,wind_speed_10m",
        "hourly": "shortwave_radiation",
        "timezone": "Asia/Dubai",
        "forecast_days": 1,
    }
    response = requests.get(url, params=params, timeout=30)
    response.raise_for_status()
    data = response.json()
    current = data["current"]
    hour = current["time"][:13]
    hour_index = [t[:13] for t in data["hourly"]["time"]].index(hour)
    solar = data["hourly"]["shortwave_radiation"][hour_index]
    wbgt, wet_bulb, globe = estimate_wbgt(
        current["temperature_2m"],
        current["relative_humidity_2m"],
        solar,
    )
    return current, solar, wbgt, wet_bulb, globe


def fetch_timeline():
    """Hourly WBGT for Mussafah, past 3 days plus next 2 days."""
    lat, lon = ZONES["Mussafah"]
    url = "https://api.open-meteo.com/v1/forecast"
    params = {
        "latitude": lat,
        "longitude": lon,
        "hourly": "temperature_2m,relative_humidity_2m,shortwave_radiation",
        "timezone": "Asia/Dubai",
        "past_days": 3,
        "forecast_days": 3,
    }
    response = requests.get(url, params=params, timeout=30)
    response.raise_for_status()
    data = response.json()
    hourly = data["hourly"]
    rows = []
    for i, time_text in enumerate(hourly["time"]):
        wbgt, _, _ = estimate_wbgt(
            hourly["temperature_2m"][i],
            hourly["relative_humidity_2m"][i],
            hourly["shortwave_radiation"][i],
        )
        rows.append({"time": time_text, "WBGT estimate": wbgt})
    return pd.DataFrame(rows)


st.set_page_config(page_title="ThermiGraph AI", layout="wide")
st.title("ThermiGraph AI")
st.caption(
    "Temporal Biometeorological and Field-Triage Engine. "
    "WBGT values are prototype estimates from weather data, "
    "not calibrated meter readings."
)

# --- Live WBGT, 3 zones ---
st.header("Live WBGT, 3 zones")
live = {}
for name, (lat, lon) in ZONES.items():
    current, solar, wbgt, wet_bulb, globe = fetch_live(lat, lon)
    live[name] = (current, solar, wbgt)

cols = st.columns(3)
for col, name in zip(cols, ZONES):
    current, solar, wbgt = live[name]
    col.metric(
        f"{name} WBGT estimate",
        f"{wbgt:.1f} C",
        f"{current['temperature_2m']} C, {current['relative_humidity_2m']}% RH",
    )

map_rows = pd.DataFrame(
    [
        {"lat": lat, "lon": lon, "zone": name}
        for name, (lat, lon) in ZONES.items()
    ]
)
st.map(map_rows)

# --- Heat spike simulator ---
st.header("Heat spike simulator")
spike = st.slider(
    "Simulate Extreme Heat / Dust Spike, added degrees C",
    0,
    10,
    0,
    1,
    help="Adds degrees to the live Mussafah temperature, then recomputes WBGT. "
    "This is what makes the multi-day collapse story visible in November.",
)
current, solar, wbgt = live["Mussafah"]
spiked_wbgt, _, _ = estimate_wbgt(
    current["temperature_2m"] + spike,
    current["relative_humidity_2m"],
    solar,
)
st.metric("Mussafah WBGT with spike", f"{spiked_wbgt:.1f} C", f"+{spike} C spike")
for line in niosh_check(spiked_wbgt):
    st.write(line)
if spiked_wbgt > 28.0:
    st.error("Spiked WBGT is over the moderate limit. Heavy work must stop.")
elif spike > 0:
    st.warning("Spike is on. Watch the cumulative strain rise in the timeline below.")

# --- Strain timeline ---
st.header("Strain timeline, Mussafah")
timeline = fetch_timeline()
st.line_chart(timeline.set_index("time"))

daily = []
by_day = defaultdict(list)
for _, row in timeline.iterrows():
    by_day[row["time"][:10]].append(row["WBGT estimate"])
for day in sorted(by_day):
    daily.append(
        {"day": day, "max WBGT estimate": max(by_day[day])}
    )
st.dataframe(pd.DataFrame(daily), use_container_width=True)
st.caption("Cumulative Thermal Strain Index is a prototype score. See strain_timeline.py for the running total.")

# --- Field-log triage ---
st.header("Field-log triage")
note = st.text_area("Supervisor note, typed text", SAMPLE_LOG, height=120)
if st.button("Run triage"):
    import os
    from pathlib import Path

    from dotenv import load_dotenv
    from google import genai
    from google.genai import types

    # Streamlit Cloud: key comes from st.secrets. Local PC: key comes
    # from the SpecToCart .env file. Either way, the key is never printed.
    api_key = None
    try:
        api_key = st.secrets.get("GEMINI_API_KEY")
    except Exception:
        api_key = None
    if not api_key:
        load_dotenv(Path.home() / "spectocart" / ".env")
        api_key = os.environ.get("GEMINI_API_KEY")
    if not api_key:
        st.error("GEMINI_API_KEY is not set.")
    else:
        with st.spinner("Calling Gemini, this can take up to 90 seconds..."):
            client = genai.Client(api_key=api_key)
            prompt = (
                "You are a field triage assistant for outdoor workers in heat. "
                "Read this messy supervisor note and return only structured triage. "
                "Do not diagnose a disease, do not invent facts that are not in the note.\n\n"
                f"Note: {note}"
            )
            response = client.models.generate_content(
                model="gemini-3.6-flash",
                contents=prompt,
                config=types.GenerateContentConfig(
                    response_mime_type="application/json",
                    response_schema=TriageResult,
                ),
            )
            result = response.parsed
        st.table(
            pd.DataFrame(
                [
                    {"Field": "Worker", "Value": result.worker_summary},
                    {"Field": "Symptom Severity", "Value": result.symptom_severity},
                    {"Field": "Symptoms", "Value": ", ".join(result.symptoms)},
                    {"Field": "Hydration", "Value": result.hydration_status},
                    {"Field": "Equipment Friction", "Value": result.equipment_friction},
                    {"Field": "OSHA Risk Tier", "Value": result.osha_risk_tier},
                    {"Field": "Immediate Action Required", "Value": result.immediate_action},
                ]
            )
        )
        st.caption("Gemini extraction from a typed note, not a medical diagnosis.")

# --- Compliance report ---
st.header("Compliance report")
report_lines = ["ThermiGraph AI, compliance report, prototype"]
report_lines.append("")
for name in ZONES:
    current, solar, wbgt = live[name]
    report_lines.append(
        f"{name}: {current['time']}, {current['temperature_2m']} C, "
        f"{current['relative_humidity_2m']}% RH, WBGT estimate {wbgt:.1f} C"
    )
report_lines.append("")
report_lines.append(f"Heat spike simulator: +{spike} C, spiked WBGT {spiked_wbgt:.1f} C")
report_lines.append("")
report_lines.append("NIOSH, acclimatised, continuous work, spiked WBGT:")
report_lines.extend(niosh_check(spiked_wbgt))
report_lines.append("")
report_lines.append("Note: prototype estimates from weather data, not meter readings.")
report_text = "\n".join(report_lines)
st.download_button(
    "Download compliance report",
    report_text,
    file_name="thermigraph-report.txt",
)
