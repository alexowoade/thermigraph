# ThermiGraph AI

Temporal Biometeorological and Field-Triage Engine. A prototype for the
Future Health Digital Innovation Challenge 2026, Track: Population Health.

Heat illness comes from multi-day cumulative strain, not one hot afternoon:
thermal and cardiovascular debt builds over days, overnight recovery fails
on hot nights, and the worker collapses on day three.

## What it does

- Live WBGT estimates for three Abu Dhabi industrial zones (Mussafah,
  KEZAD / Khalifa Port, Ruwais) from Open-Meteo, free, no key.
- Heat spike simulator: add degrees to the live temperature and watch the
  WBGT and NIOSH tier change.
- Strain timeline: hourly WBGT for Mussafah, past 3 days plus next 2 days.
- Field-log triage: Gemini reads a messy supervisor note and returns a
  structured triage table. Needs a Gemini API key.
- Compliance report download.

WBGT values are prototype estimates from weather data, not calibrated
meter readings.

## Run locally

```bash
pip install -r requirements.txt
streamlit run dashboard.py
```

## Deploy on Streamlit Community Cloud

1. Push this repo to GitHub.
2. Go to https://share.streamlit.io, sign in with GitHub.
3. New app, pick this repo, branch main, main file `dashboard.py`.
4. In the app Settings, Secrets, add your Gemini key:
   `GEMINI_API_KEY = "your key here"`

The key is never in the repo. Without it, the WBGT, timeline, spike
simulator and report still work. Only the triage button needs the key.
