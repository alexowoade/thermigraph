# ThermiGraph AI — CHANGELOG

## v6.3.13 — Animations (2026-11-14)

All three animations from the user's request, no JavaScript (Streamlit does not run custom JS):
- **Fade-in on load**: new `tgFadeUp` keyframes (opacity 0 + 10px rise to full); hero fades in over 0.6s, glass cards over 0.5s. Runs once on load.
- **Smooth 3D map columns**: `ColumnLayer` now has `transitions={"getElevation": 800, "getFillColor": 800}`, so the bars grow/shrink and shift colour smoothly over 0.8s when WBGT changes (spike slider, refresh) instead of jumping. Validated: the transitions serialise correctly in the Deck JSON.
- **Smooth strain gauge**: the gauge fill now has `transition: width 0.6s ease, background-color 0.6s ease`, so it glides to its new length and colour. Note: Streamlit rebuilds this block on each change, so the glide may not always animate; harmless if it jumps.
- No logic changed; 15 tests pass.

## v6.3.12 — 3D Map (2026-11-14)

At the user's request, the Section 1 map is now a real 3D map (buttons stay blue, per the user's "leave it"). The flat circles are replaced by deck.gl `ColumnLayer` 3D bars: each pilot zone gets an extruded column whose height scales with live WBGT (taller = hotter, elevation_scale 3000) and whose colour is the NIOSH status (green/amber/orange/red). The view is tilted (pitch 45, zoom 6.0) so the depth reads. Zone-name labels now float above each column top (3D position, WBGT*3000 + 8000) with the same halo. Basemap unchanged (Voyager daylight / Dark Matter dark). Validated by building the Deck JSON in pydeck (ColumnLayer + 2 TextLayers, pitch 45, label heights 79,400–82,400). No logic changed; 15 tests pass.

## v6.3.11 — Button Selector Fix (2026-11-14)

Root cause found by reading Streamlit 1.67.0's own button code. The preset buttons have `help` tooltips, and the tooltip adds a wrapper layer around the button, so the button is a grandchild of the `.stButton` div, not a direct child. All our button CSS used the direct-child selector `div.stButton > button`, which never matched those buttons at all, so Streamlit's default dark styling showed and our hover rules did nothing. The sidebar Refresh button has no tooltip, so it was a direct child and our CSS worked on it, which is why it was blue while the preset buttons were black. Fix: descendant selectors (space, not `>`) plus targeting the button's own `data-testid="stBaseButton-secondary/primary"` directly, and covering React Aria's `data-hovered` attribute as well as `:hover` / `:focus` / `:active` / `:disabled`, with `opacity: 1 !important`. No logic changed; 15 tests pass. Live browser test before this fix confirmed the preset works functionally (Lagos click: dropdown to Lagos, spike 6, WBGT 35.1 °C; Back click: Mussafah, spike 0, WBGT 22.6 °C) and that the hover defect was real (both buttons pale with invisible text on hover, restored on mouse-away).

## v6.3.10 — Button Click Fix (2026-11-14)

Follow-up to v6.3.9: the text still disappeared on CLICK (not just hover). Clicking triggers a rerun, and during that moment Streamlit can fade/disable the button, so the hover-only fix was not enough. Strengthened the rule: it now targets the buttons via `data-testid` as well as the class, covers `:hover` / `:focus` / `:active` / `:disabled`, and forces `opacity: 1 !important` so the button can never fade out. Same darker-blue gradient, white text. No logic changed; 15 tests pass.

## v6.3.9 — Button Hover Fix (2026-11-14)

Bug found from the user's screenshot: hovering a button made its white text faint/invisible. Cause: the button CSS had no `:hover` rule, so Streamlit's own hover styling took over and turned the button pale while the text stayed white. Fix: an explicit `:hover` / `:focus` / `:active` rule for `stButton` and `stDownloadButton` (higher specificity, `!important`) that keeps a blue gradient, just a darker shade on hover, with white text. Applies to every button (preset buttons, Refresh, download). No logic changed; 15 tests pass.

## v6.3.8 — Readable Map Labels (2026-11-14)

The basemap country/city names were faint by design (CartoDB mutes labels so data stands out). Three fixes, all in the Section 1 map:
- **Bold zone-name labels** drawn on the map as pydeck TextLayers: Mussafah, KEZAD, Ruwais in bold 16px (dark navy in daylight, light slate in dark mode) over a larger 20px halo in the background colour, placed just above each circle so they never cover the data. Both layers validated by building the Deck JSON in pydeck (3 layers, all 3 names present).
- **Light basemap switched Positron → Voyager** (CartoDB style with darker labels and more colour); dark mode keeps Dark Matter.
- **Zoom 5.5 → 6.5** so all labels render bigger.
- No logic changed; 15 tests pass.

## v6.3.7 — Full Scroll First (2026-11-14)

One-line change at the user's request: the Navigation Layout radio now lists "Full 10-Section Scroll" first and "Tabbed Command Center" second, so the full scroll is the default view. The layout check is by option string, so nothing else changes. Note: the Tab 5 demo slider only exists in tabbed mode; in scroll mode the phone follows the main spike slider in Section 2. No logic changed; 15 tests pass.

## v6.3.6 — Strain Gauge, Light Map, Footer (2026-11-14)

Three design additions from the user's request, no colour or font changes:
- **Strain gauge bar** in `render_s3_s4`: the strain index is now a visual bar (scale 0–24) with the number in JetBrains Mono, coloured green below 8, amber 8–11, red at/above 12, and a red tick marking the red line at 12 (50% of the bar). Pure HTML, no logic change.
- **Light map basemap**: the pydeck map now uses CartoDB Positron in Clinical Daylight and Dark Matter in Obsidian Dark (was a dark map in both themes, a black rectangle on the light page). Loads from CartoCDN; the existing try/except still falls back to `st.map` if pydeck fails.
- **Footer**: one caption line at the bottom of the page in both layouts — prototype, challenge name, Open-Meteo data, estimates disclaimer, "Not a medical device".
- No logic changed; 15 tests pass.

## v6.3.5 — Lagos Demo Preset + Chart Label Fix (2026-11-14)

Two additions from the user's design review, both in `render_s1_s2` / `render_s3_s4`:
- **One-click Lagos +6°C demo preset**: two buttons above the worksite selector. "▶ Lagos +6°C demo" sets the site to Lagos and the spike to +6 in one click (via `st.session_state` keys `site_select` / `spike_slider`, set before the widgets are created, then `st.rerun()`); "↺ Back to Mussafah" resets to Mussafah +0. Tab 5 demo slider follows the main spike, so it defaults to 6 after the preset.
- **Chart y-axis label unclipped**: Plotly left margin `l=10` → `l=60`, so the vertical axis title reads "WBGT estimate (C)" in full instead of "stimate (C)".
- No logic changed; 15 tests pass.

## v6.3.4 — Section 3 Heading Reworded (2026-11-14)

One-line wording fix from the user's screenshot review: "3. 6-Day Cumulative Strain Timeline" put the section number and the window length side by side, risking a split-second misread. Now "3. Cumulative Strain Over 6 Days & Nocturnal Recovery Debt". Arabic heading already read "over 6 days", unchanged. No logic changed; 15 tests pass.

## v6.3.3 — Light-Mode Widget Labels Visible (2026-11-14)

Root cause found from the user's screenshot: `.streamlit/config.toml` sets a dark base theme (`textColor #e2e8f0`), so Streamlit's native widget labels render light. In Clinical Daylight mode the CSS paints backgrounds light, so the sidebar radio labels and option text were light-on-light and invisible. Fix: theme-aware CSS forcing widget labels and radio/select/slider/number/text-area option text to `var(--text-primary)`, which flips dark/light with the theme. Dark mode unchanged (primary is near-white there). No logic changed; 15 tests pass.

## v6.3.2 — Medical Blue Accent (2026-11-14)

Verified an outside palette review claim-by-claim against the v6.3.1 code. Applied Change A only (medical blue), skipped Change B (glow reduction) per the review's own advice for tight time. Review errors found: the `--accent-cyan` / `--accent-blue` / `--shadow-card-hover` variables it cites do not exist (colours are literals); the "3 radial background glows" do not exist; the phone shadow it quotes as 0.55 is actually 0.35. Changes: button gradient #06b6d4 → #0284c7, #2563eb → #1d4ed8; pills dark rgba(6,182,212) → rgba(56,189,248), light rgba(14,165,233) → rgba(2,132,199); pill text dark #67e8f9 → #7dd3fc; tab-selected gradient to sky/blue rgba(56,189,248)/rgba(96,165,250); phone ORS box rgba(6,182,212,0.1) → rgba(2,132,199,0.1). Kicker, hero title and chart line already used the review's suggested blues, unchanged. No neon cyan remains. No logic changed; 15 tests pass.

## v6.3.1 — Dual-Theme + Restored Features (2026-11-14)

Adopted from an outside dual-theme proposal at the user's request. New: Clinical Daylight (default) / Obsidian Dark theme toggle in the sidebar, redesigned hero with badges, glass cards, NIOSH status chips, tab styling, phone shell. Heading rule is plain (no green accent). Restored and verified present in this version: full 5-section compliance report, Tab 5 demo slider (phone flips live), Wi-Fi session-state fallback for live/active/hourly fetches, Compare-Sites computes real WBGT for non-UAE sites, metric deltas, illustrative cost-of-inaction label. Note: the NIOSH "OK" chips still carry a green left border as a status indicator, and the hero has a small green pulse dot. Logic modules untouched; 15 tests pass.

## v6.2.4 — Heading Accent Removed (2026-11-14)

- **Green h2 accent removed entirely**: the short bar from v6.2.3 was still distracting, so the accent and its left padding are gone. Headings are now plain bold light text. No logic changed.

## v6.2.3 — Heading Accent Fix (2026-11-14)

- **Green heading bar capped to one line**: the `h2` accent was an inset box-shadow, which spans the full height of the element, so on the two-line Section 1 heading it drew a long green bar. Replaced with a background gradient sized `4px 1.2em`, top-left, no-repeat, so the accent is only as tall as the first line. No logic changed.

## v6.2.2 — Review Fixes (2026-11-14)

Verified claim-by-claim against the code from an outside v6.2 review. Applied 4, rejected 1, corrected 2 false premises.

- **Wi-Fi-drop resilience (accepted)**: the three `st.stop()` fetch failures (zones, active site, hourly) now fall back to the last good reading in `session_state` with a warning badge, instead of halting the page with a red error and blank sections below. Only stops if there is no cached reading at all (first run).
- **Plotly transparent canvas (accepted)**: chart `paper_bgcolor` and `plot_bgcolor` set to transparent with a light font, so it sits inside the glass card instead of a solid rectangle. (The review claimed the code set them to `rgba(15,23,42,...)` — it never did; the only `update_layout` set height and margins.)
- **Tab 5 demo slider (accepted)**: a "Demo — drag the heat and watch the phone react" slider inside the worker tab, defaulting to the main spike value, so the phone flips green to amber to red live. It drives only the phone display; the rest of the dashboard still follows the main spike slider in Tab 1.
- **Cost model labelled illustrative (accepted)**: caption now says explicitly that parameter values are chosen for planning demonstration, not derived from a specific study, and that real deployment would calibrate against site HSE records and ILO/WHO baselines. The "planning estimates, not epidemiology" disclosure was already there.
- **Site selector + spike stay in Tab 1 (rejected the sidebar move)**: the review claimed changing them would kick the judge out of Tab 2. Streamlit preserves the active tab across reruns, so that does not happen; at most the scroll position jumps. Moving the slider to the sidebar would also hide the demo's main control, which the same review elsewhere says must stay prominent. Contradiction resolved in favour of prominence.
- **wbgt_iso_cross_check signature (review claim FALSE)**: definition is `(twb_c, tg_c, tdb_c)` and the call passes `(spiked_tw, spiked_tg, dry-bulb + spike)`. They match exactly, and the live browser check rendered the cross-check caption, so no TypeError exists.
- **Review praise table partly fabricated**: "hero banner with badges", "NIOSH chips", and "hover elevation on metric cards" do not exist in the code (grep: 0 matches). The map, fonts, tabs, and phone bezel praise is accurate.

## v6.2.1 — Display Fixes (2026-11-14)

Two minor defects found in the v6.2 browser verification, both fixed. No logic changed.

- **Triage result no longer truncated**: the triage table (`st.table`) cut the Occupational Risk Tier value off mid-sentence because the column was too narrow. The result is now rendered as labelled markdown rows inside a glass container, so long values wrap in full.
- **Section-heading accent no longer clips numerals**: the green `border-left` on `h2` partly cut the leading numeral (e.g. the "1" in "10."). Replaced with an inset `box-shadow` accent, which draws inside the element box and cannot overlap the text.
- Not defects, left as-is: the Plotly chart has TWO threshold lines (28 °C red, 26 °C amber/orange) as coded; the Section 9 WBGT input displays 23.40 correctly (the raw float repr `23.399999...` is normal binary float storage, not a display bug).

## v6.2 — Enterprise Command-Center Restyle (2026-11-14)

Presentation-only rebuild on top of frozen v6.1 logic. No physics, triage, compare-sites, report, or test logic changed.

- **Obsidian/slate palette** (`#060911` / `#0f172a`) with semantic risk colours: Emerald `#10b981` safe, Amber `#f59e0b` caution, Rose `#f43f5e` critical. Map markers and the worker status now use the same palette.
- **Typography**: Plus Jakarta Sans (UI), JetBrains Mono (WBGT readouts, temperatures, dollar figures), Noto Sans Arabic (Arabic toggle and crew broadcasts, via font fallback).
- **5-tab chapter navigation** (default): 1. Live Telemetry & Simulator, 2. 6-Day Strain & Shift Plan, 3. AI Triage & Audit, 4. Global Compare & ROI, 5. Worker Handset View. Tab labels switch to Arabic with the language toggle.
- **"Full 10-section scroll" sidebar toggle**: one click restores the single-page layout so a judge or a verification script can inspect all 10 sections without clicking tabs. Same render functions run in the same order either way.
- **Glass cards**: translucent blurred rounded containers for the telemetry, simulator, chart, KPI, impact, and calculator blocks.
- **Section 10 phone bezel**: the worker view is wrapped in a mobile handset frame (notch + screen) to show the equity pitch visually.
- **`.streamlit/config.toml`**: 6-line dark theme (base dark, emerald primary, obsidian background) so Streamlit Community Cloud renders dark tables and chrome instead of white.
- **Metric values fixed**: v6.1 forced every metric value red (`#b91c1c`), which made even safe WBGT readings look alarming. v6.2 renders numbers in light slate with JetBrains Mono; risk is conveyed only by the status colours.
- **15 tests still passing** (logic untouched; dashboard.py compiles clean).

## v6.1 — Compare-Sites Current WBGT Fix (2026-11-14)

- `compute_compare_sites` used the LAST hour of the hourly forecast as "Current WBGT". That hour is two days in the future (a night hour), so Mussafah showed 21.7 °C in the compare table while Sections 1/2/10 showed the live 24.2 °C. Fixed: the dashboard now passes the LIVE current WBGT for each compare site (from `fetch_live_raw`, cached) into `compute_compare_sites`.
- Verified live: Mussafah 23.9 °C in both Section 1 and Section 7 (exact match); Lagos 29.3 °C, Delhi 23.9 °C, Houston 10.2 °C (all live readings).
- Triage Case 1 verified on live Gemini `gemini-3.6-flash` (Critical, broadcasts present) after the SpectoCart `.env` fallback removal.

## v6 — Competitive Review Edition (2026-11-14)

All P1/P2 review items added.

- **Dashboard logic extracted** into `dashboard_logic.py` (Streamlit-free, unit-testable).
- **Custom CSS / branding** and hero tagline: "From a single hot hour to a 6-day physiological debt — ThermiGraph catches heat collapse before Day 3."
- **Colour-coded pydeck map** (green / amber / orange / red by WBGT), with `st.map` fallback.
- **Refresh live data button** in the sidebar (clears the 10-minute Open-Meteo cache).
- **Data-as-of caption** under Section 1 (live reading timestamp, Open-Meteo provenance).
- **Interactive Plotly strain chart** with red threshold lines at 26 °C and 28 °C, falling back to the plain line chart if Plotly is absent.
- **ISO 7243 cross-check** via `pythermalcomfort` (optional; graceful note when not installed). Verified: with `with_solar_load=True` the cross-check agrees with ThermiGraph within 0.5 °C.
- **Arabic UI toggle** in the sidebar (title and section headers switch to Arabic).
- **Section 7: Global Compare-Sites view** — one table, four sentinel corridors, same physics and thresholds.
- **Section 8: Impact / ROI panel** — 4,500 workers protected, 450 meters replaced, $540,000 annual hardware savings, ~180 cases prevented per year (all labelled planning estimates).
- **Section 9: Cost-of-Inaction calculator** — transparent model (0.3 cases per 1,000 workers per day per °C above 26 °C; 8% hospitalise; $400 per case, $4,000 per hospitalisation; 65% reduction from the rest schedule).
- **Section 10: Worker-facing view** — one status, one action, one promise ("Reporting symptoms will not affect your pay").
- **Real wind wired into the standalone CLIs** (`strain_timeline.py`, `shift_optimizer.py`).
- **7 new integration tests** (15 total, all passing): spike propagation, shade break at 13:00/14:00, tomorrow date, night-min hours 0–5 only, compare-sites ranking, cost-model scaling, ISO cross-check agreement.
- **Deployment files**: `.gitignore`, `.env.example`, `LICENSE` (MIT), `Dockerfile`, GitHub Actions CI (`pytest` on push to `main`).
- **Requirements pinned**: `streamlit==1.67.0`, `google-genai==3.3.0`, `pytest==9.2.0`; optional `pythermalcomfort>=4.0`, `plotly>=6.0`.
- **README**: regulatory mapping table (NIOSH, ISO 7243, UAE Labour Law, OSHA, ILO), Mermaid architecture and data-flow diagrams, testimonial placeholder (no fabricated quote).
- **7-slide pitch deck** and demo video script added (see `pitch/`).

## v5.1 — P0 Review Fixes (2026-11-14)

- `fetch_live_raw` guarded against a missing-hour `ValueError` and null solar.
- Age regex hardened (anchored "Name, age" first, old search as fallback).
- `redact_worker_name` strengthened (field-label pattern + 12-name list; fixed the mid-sentence Hassan leak).
- Spectocart `.env` fallback removed from `dashboard.py` and `triage.py` (key must live in `~/thermigraph/.env` or Streamlit secrets).
- "72-hour" language unified to "6-day" in `strain_timeline.py` and the README.
- Open-Meteo fetches wrapped with a clean error message instead of a traceback.
- Model order unchanged: `gemini-3.6-flash` first (the review claim that it "does not exist" is false, proven live; `gemini-2.5-flash` is the one that 404s).
- 8 tests still passing.

## v5 — Global Health Edition (2026-11-14)

- Global Worksite Selector (Lagos, Delhi, Houston, custom GPS) with `timezone="auto"`.
- Abu Dhabi pilot zones stay front and center in Section 1.
- Triage fallback location changed to "Global Site".
- README updated to v5 (8-file table, Global Selector, KPIs, offline fallback, wind-adjusted globe formula).
- Chart fix: time column converted to datetime before `line_chart` (fixes the invisible line and garbled Y-axis); Section 3 heading corrected to "6-Day".

## v4 — Heavyweight Edition (2026-11-14)

- Wind cooling in `physics_engine.py` (`wind_kmh` parameter, backward compatible).
- `triage.py` rebuilt: 3 clinical scenarios, deterministic offline fallback, hard name redaction, Arabic + Hindi/Urdu broadcasts.
- 3 Path-to-Pilot KPI cards; scenario selector; multilingual dispatch.
- `test_thermigraph.py` added (8 pytest tests, all passing).
- Deploy ZIP fixed to include all 9 files.

## v3 (2026-11-14)

- Triage table persists in `st.session_state` (survives slider moves and downloads).
- Shift schedule tomorrow derived from the hourly data itself (`all_days[4]`), fixing UTC drift.
- README expanded to 81 lines (Assumptions, Clinical Boundaries, Privacy by Design, Responsible AI Governance).
- Model fallback loop (gemini-3.6-flash first, then gemini-2.5-flash).

## v2 (2026-11-14)

- All 4 modules wired into the dashboard; spike drives timeline and shift plan.
- `@st.cache_data(ttl=600)` on both fetchers.
- `resolve_gemini_key()` checks Streamlit secrets, repo `.env`, `~/thermigraph/.env`, `~/spectocart/.env`.
- Triage prompt redacts names and passes live/spiked WBGT.
- Model kept at `gemini-3.6-flash` (the review claim to switch to 2.5-flash was wrong; 2.5-flash 404s).

## v1 (2026-11-14)

- First working Streamlit dashboard: 3 live zones, heat spike slider, strain timeline, triage box, compliance report download.
- Modules 1–4 complete on the PC.
