# ThermiGraph AI

**Temporal Biometeorological & Field-Triage Engine for Outdoor Worker Heat Safety**

[Live PWA](https://bright-quokka-334504.netlify.app/) · [Demo Video (2 min)](https://youtu.be/fzsy-Sr8Sdk) · [Source Code](https://github.com/alexowoade/thermigraph)

ThermiGraph AI is a zero-hardware, zero-login Progressive Web App (PWA) built for the **Future Health Digital Innovation Challenge 2026**. Outdoor workers rarely collapse from a single hot afternoon in isolation—decompensation builds across consecutive shifts when overnight minimum temperatures stay above **28.0 °C** (*Nocturnal Recovery Debt*), triggering acute collapse on Day 3. ThermiGraph couples live weather telemetry, multi-day thermal strain modeling, proactive shift/hydration optimization, and privacy-preserving multilingual AI field triage into a single browser dashboard.

---

## Core Modules

1. **Live Environmental Telemetry & Coupled WBGT Physics (`logic.js`)**
   - Streams 60-second live weather telemetry (air temperature, relative humidity, 10 m wind speed, and shortwave solar irradiance) from **Open-Meteo** with optional browser GPS geolocation and zero API keys required.
   - Covers the **Abu Dhabi Pilot Corridor** (*Mussafah, KEZAD / Khalifa Port, Ruwais*), **Global Sentinel Sites** (*Lagos, Delhi NCR, Houston*), and custom coordinates worldwide.
   - Computes weather-derived WBGT estimates using **Stull's (2011) wet-bulb equation** and a convective wind-adjusted solar black-globe approximation, dynamically adjusted for **ISO 7243 Annex C PPE** (`+0` to `+4 °C`), **sun exposure** (`open_sun`, `high_albedo`, `shaded`), **NIOSH workload** (`25–30 °C` base limits), **crew acclimatisation** (`0.0`, `-1.5`, `-2.5 °C`), and a `+0` to `+10 °C` heatwave anomaly simulator.

2. **6-Day Cumulative Thermal Strain & Nocturnal Recovery Debt**
   - Tracks a rolling 6-day window distinguishing **Observed** days (past 3 days + today) from **Forecast** days (next 2 days), with an interactive day scrubber.
   - Flags **Nocturnal Recovery Debt** whenever overnight minimums exceed **28.0 °C** and tracks cumulative progression against a prototype red line of **12**.
   - Feeds strain directly back into crew thresholds (`effectiveWorkLimit`), applying `-0.5 °C` to `-1.0 °C` debt penalties so the same temperature triggers stricter protections on Day 3 than Day 1.

3. **Coupled Shift & Quantitative Hydration Optimizer**
   - Generates an hourly work-rest plan (`06:00–17:00`) for anonymised crews (`Crew A` / `Crew B`), front-loading heavy tasks into cooler hours, enforcing dynamic work-rest rotations (`60/0`, `45/15`, `30/30`, `NO OUTDOOR WORK`), and scheduling a preventive midday shade break (`12:30–15:00`).
   - Prescribes quantitative **ORS hydration protocols** (`350`, `500`, `750`, or `1,000 mL/hr` plus a `500 mL` pre-shift morning ORS bolus when nocturnal debt is active) alongside explainable hourly rationale and an interactive before/after slider.

4. **Privacy-Preserving Multilingual AI Field-Note Triage**
   - Parses unstructured supervisor field notes via live **Groq AI** (`openai/gpt-oss-120b`) hosted on a serverless **Cloudflare Worker** (`https://thermigraph-triage.alexowoade.workers.dev`), with automatic failover to a deterministic offline rule engine if the network or worker is unreachable. No API keys exist in client-side code.
   - Correlates symptoms with live WBGT, cumulative strain, and acclimatisation (supporting proactive risk escalation), enforces server-side and client-side PII redaction (`[Worker - Anonymised]`), and generates non-punitive **Arabic** and **Hindi/Urdu** crew safety broadcasts.

---

## Additional Capabilities

- **Bilingual English / Arabic RTL Interface:** Full EN/AR translation (268 keys, 0 missing) with right-to-left layout switching while keeping numbers, formulas, data tables, and sliders cleanly pinned left-to-right.
- **Installable Offline PWA:** Includes `manifest.webmanifest` and a service worker (`sw.js`) caching the application shell and last-known Open-Meteo readings for low-connectivity sites.
- **Dual Interactive Maps & Global Solar Benchmark:** Leaflet maps (OpenStreetMap Street + Esri Satellite toggle) for the Abu Dhabi corridor and four-continent comparison table with live solar irradiance (`W/m²`).
- **Worker Phone View & Compliance Export:** Simplified single-screen worker alert view with a non-punitive pay protection message, plus downloadable English or Arabic `.txt` governance reports.

---

## Architecture

```text
Open-Meteo API (60s telemetry: temp, RH, wind, solar) + Opt-in Browser GPS
        │
        ▼
Weather-Derived WBGT Physics (Stull wet-bulb + wind-adjusted solar globe)
+ ISO 7243 PPE · Sun Exposure · NIOSH Workload · Acclimatisation
        │
        ├──► 6-Day Cumulative Thermal Strain Index (Red Line 12) + Nocturnal Debt (>28 °C)
        │         └──► Feeds dynamic effectiveWorkLimit() into Shift & Triage
        │
        ├──► Auto-Shift & ORS Hydration Optimizer (Crew A/B, Explainable Adjustments)
        │
        ├──► AI Field-Note Triage (Cloudflare Worker → Groq | Offline Deterministic Failover)
        │         └──► [Worker - Anonymised] Redaction + Arabic / Hindi-Urdu Broadcasts
        │
        └──► Bilingual EN/AR PWA Dashboard (Netlify · Zero Login · Offline Shell)

```

---

## Quick Start & Verification

No build step, bundler, or API key is required to run the frontend locally.

```bash
# 1. Clone the repository
git clone https://github.com/alexowoade/thermigraph.git
cd thermigraph

# 2. Serve locally
python3 -m http.server 8000
# Open http://localhost:8000 in your browser

```

### Syntax & Parity Verification

```bash
# Check JavaScript syntax
node --check logic.js app.js sw.js

```

*(A mirrored Python/Streamlit reference implementation with automated `pytest` tests is maintained alongside this frontend for cross-engine parity verification.)*

---

## Project Structure

```text
├── index.html             # Single-page dashboard layout (11 sections, PWA/OG meta tags)
├── styles.css             # Clinical Daylight / Obsidian Dark themes, RTL & mobile rules
├── logic.js               # Pure biometeorological physics, strain, shift, hydration & offline triage
├── app.js                 # Live Open-Meteo ingestion, Groq worker calls, Leaflet maps, Plotly & i18n
├── sw.js                  # Service worker for offline shell & weather caching
├── manifest.webmanifest   # PWA installation manifest
├── og-image.png           # Open Graph preview image (1200x630)

```

---

## Clinical Boundaries, Privacy & Limitations

* **Weather-Derived Estimates, Not Calibrated Hardware:** WBGT outputs are mathematical estimates derived from open meteorological telemetry, not readings from a calibrated 150 mm black-globe thermometer, and do not measure enclosed furnace or localized radiant machinery heat.
* **Occupational Guidance, Not Medical Diagnosis:** All triage verdicts, shift plans, and the Cumulative Thermal Strain Index (red line = 12) are preventive occupational heat-stress guidance—not clinical diagnoses or validated medical devices. Supervisors must review and approve all actions and escalate critical flags to medical personnel.
* **Strict Non-Punitive Privacy:** No login, persistent worker database, or individual biometric surveillance is used. Worker names are redacted to `[Worker - Anonymised]`, schedules operate strictly at the crew level (`Crew A` / `Crew B`), and no personal records are stored.
* **Honest Validation Status:** No real worker pilot, physical WBGT sensor dataset, or clinician endorsement is claimed. Pilot-scale figures in the dashboard (4,500 workers, ~$540,000 estimated hardware outlay across 450 meters, ~180 cases/year) are labelled planning estimates; the next step is a prospective on-site validation pilot alongside a calibrated WBGT meter.

---

## Data Sources, Third-Party Libraries & License

* **Weather Telemetry:** [Open-Meteo](https://open-meteo.com/) (free, keyless public API)
* **AI Inference & Serverless Proxy:** [Groq](https://groq.com/) (`openai/gpt-oss-120b`) via [Cloudflare Workers](https://workers.cloudflare.com/) (server-side API key only)
* **Mapping & Charts:** [Leaflet](https://leafletjs.com/) (BSD-2-Clause), [OpenStreetMap](https://www.openstreetmap.org/) (ODbL), Esri World Imagery, and [Plotly.js](https://plotly.com/javascript/) (MIT)
* **Hosting:** [Netlify](https://www.netlify.com/)

Original code by **Alex Owoade**, released under the **MIT License**.
