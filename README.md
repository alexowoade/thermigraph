# ThermiGraph AI — Client-Side JavaScript Command Center (v13)

**Live Deployment:** https://chipper-halva-04403d.netlify.app/

A 100% client-side HTML/CSS/JavaScript implementation of the **ThermiGraph AI** command center. It maintains exact mathematical parity with the Python/Streamlit backend (v6.3.13) while delivering smooth count-up metric animations, instant slider responsiveness, interactive dual-corridor Leaflet maps, and offline `localStorage` resilience.

---

## 1. Architecture & File Structure

- **`index.html`** — Responsive 10-section command center layout, semantic HTML5 structure, and CDN integrations (Leaflet 1.9.4 and Plotly.js 2.35.2).
- **`styles.css`** — Dual-theme glassmorphic design system supporting **Clinical Daylight** and **Obsidian Dark**, responsive grid layouts, animated strain gauges, pulsing map rings, and the mobile worker handset frame.
- **`logic.js`** — Pure, zero-DOM biometeorological and clinical business logic ported directly from the Python modules (`physics_engine.py`, `strain_timeline.py`, `shift_optimizer.py`, `dashboard_logic.py`, and `triage.py`). Uses half-to-even banker's rounding (`roundTo`) to guarantee zero numerical drift against Python.
- **`app.js`** — Asynchronous Open-Meteo telemetry client with 1-hour `localStorage` caching, reactive state management across all 10 sections, and fault-tolerant rendering with automatic card fallbacks if external map or chart CDNs are blocked.

**Python Reference Suite (v6.3.13):**

- **`physics_engine.py`** — Stull wet-bulb approximation, convective wind-adjusted black-globe temperature, ISO 7243 WBGT calculation, and NIOSH acclimatised threshold evaluation.
- **`strain_timeline.py`** — 6-day Cumulative Thermal Strain Index (0-4 daily points) and Nocturnal Recovery Debt (> 28.0 °C overnight minimum) engine.
- **`shift_optimizer.py`** — Work-rest rotation planner for anonymised crews (Crew A, Crew B); heavy labour scheduled 06:00 to 10:00, shade break 12:30 to 15:00, prevented unsafe-hour calculations.
- **`triage.py`** — Privacy-preserving clinical field-log parser with automated PII scrubbing ([Worker - Anonymised]), Arabic and Hindi/Urdu crew broadcasts, and deterministic offline fallback.
- **`dashboard_logic.py`** — Core state aggregation, cost-of-inaction calculator, and compliance report generator.
- **`dashboard.py`** — Streamlit command center interface (the Python entry point).
- **`test_thermigraph.py`** — Automated pytest verification suite (15 passing tests).
- **`fetch_mussafah.py`** — Live Open-Meteo telemetry smoke checker.
- **`requirements.txt`** — Python dependencies (streamlit, google-genai, pytest, plotly, pythermalcomfort).

---

## 2. Key Interactive Capabilities

1. **Dual-Corridor Interactive Geospatial Maps (Leaflet + OpenStreetMap / Esri Satellite):**
   - **Section 1 (Abu Dhabi Host Pilot Corridor):** Plots live WBGT estimates across **Mussafah**, **KEZAD / Khalifa Port**, and **Ruwais** with dynamic circle sizing, NIOSH risk-tier color coding, click-to-inspect telemetry popups, pulsing heat rings, and a Street / Satellite layer toggle.
   - **Section 7 (Global Compare-Sites World Map):** Plots all four sentinel corridors (**Mussafah**, **Lagos**, **Delhi NCR**, and **Houston**) side by side under identical physics and thresholds.
2. **Real-Time Heat Spike Simulator & 6-Day Debt Scrubber (Sections 2 & 3):**
   - One-click preset buttons and a `+0 °C to +10 °C` anomaly slider dynamically recompute Stull wet-bulb, convective wind-adjusted black-globe, and ISO 7243 WBGT across a 144-hour rolling window.
   - An interactive **6-Day Timeline Scrubber** (`Day 1` to `Day 6`) steps through daily strain accumulation and highlights Nocturnal Recovery Debt (overnight minimum temperatures above 28.0 °C) on the table.
3. **Before / After Shift Schedule Optimizer (Section 4):**
   - Generates tomorrow's work-rest rotation for anonymised crews (`Crew A`, `Crew B`) and includes an interactive `0% to 100%` **Before / After Schedule Slider** that dynamically scales prevented unsafe heavy-work hours and mandatory cooling minutes.
4. **Privacy-Preserving Multilingual Triage & Compliance Audit (Sections 5 & 6):**
   - Parses English, Arabic, and Hindi/Urdu supervisor field notes into structured clinical triage tables, scrubs personal worker names to `[Worker - Anonymised]`, generates Arabic and Hindi/Urdu crew broadcasts, and exports a timestamped `.txt` compliance report.
5. **Pilot Economics, Cost-of-Inaction & Last-Mile Worker Handset (Sections 8, 9 & 10):**
   - Scroll-triggered animated counters quantify Abu Dhabi pilot ROI (`4,500` workers protected, `450` physical meters replaced, `$540,000` annual hardware savings), paired with an interactive Cost-of-Inaction calculator and a live **Worker Mobile Alert** handset view.

---

## 3. Local Run, Static Deployment & Verification

No build step, backend server, or paid API key is required to run the client-side web app:

```bash
# Run locally with any static HTTP server
python3 -m http.server 8000
# Open http://localhost:8000 in your browser
```

To deploy on **Netlify**, drag and drop the repository folder containing `index.html`, `styles.css`, `logic.js`, and `app.js` onto https://app.netlify.com/drop.

Run the Python reference suite and its 15 automated pytest tests:

```bash
pip install -r requirements.txt
pytest test_thermigraph.py -v
streamlit run dashboard.py
```
