# ThermiGraph AI — JavaScript Version

**Live demo:** https://bright-quokka-334504.netlify.app/

A plain HTML/CSS/JavaScript rebuild of the ThermiGraph dashboard. Same numbers,
same sections, same design system as the Streamlit version (v6.3.13), but with
full JavaScript freedom: smooth count-up metrics, staggered fade-in, native
deck.gl 3D map transitions, and no Streamlit frame.

## v28.1 (2026-11-19) — Alert wording, Arabic strings, doubled word (JS only)

Built from v28. Only the three fixes below; no other behaviour changed.
Font stays 16px.

- Section 2 alert texts now name the effective limit that triggers
  them (`alertCritical` / `alertHigh` are templates with `{limit}`
  and `{workload}`), instead of the hardcoded 28.0 / 26.0 NIOSH
  base limits. Trigger thresholds unchanged (critical above
  effLimit + 2.5, high above effLimit).
- Arabic now covers the Section 2 effective-limit explainer and the
  Section 4 shift-plan cells: the rationale is rendered from
  structured parts (`effectiveWorkLimit` returns a 4th element) via
  new i18n templates, the hydration protocol is translated at render
  time (same four fixed texts + bolus suffix), and the shift
  explanations are built from templates with Arabic trigger tags.
  i18n keys: 259 → 268 in both languages, 0 missing in either.
  The triage-table hydration protocol uses the same translation
  (live Groq free text passes through unchanged).
- Doubled word fixed: the rationale no longer reads "acclimatised
  acclimatisation"; it now reads "acclimatisation -0.0 C".
- Service worker cache: thermigraph-v28.1. Public v27 link:
  https://bright-quokka-334504.netlify.app/ (v28.1 not yet deployed).

## v28 (2026-11-19) — Final pre-deadline fix (JS only)

Built from v27. Final build before the 20 November deadline. Font stays
16px, effective-limit labels, gauge glow, and Arabic all kept from v27.

- Triage now sends `spike_c: state.spike` (the main spike slider) instead
  of the phone-only demo slider value.
- Global compare (`computeCompareSites`) now takes sun exposure and uses
  it in the WBGT estimate (open_sun / high_albedo / shaded), so the
  compare table matches the simulator.
- Client-side PII redaction backup for the triage worker summary: a
  summary without "[Worker - Anonymised]" is redacted before rendering.
  The Worker already enforces this server-side; correctly anonymised
  summaries are unchanged.
- Section 2 spike alert thresholds are now the effective limit
  (critical above effLimit + 2.5, high above effLimit) instead of
  fixed 28.0 / 26.0. At first load (Mussafah 18.8 °C vs eff 25.5 °C)
  the alert stays hidden. Alert texts unchanged.
- README stale contradictions corrected: live Groq triage via the
  Cloudflare Worker (not deterministic fallback), and Python v19
  coupled logic exists in workspace/thermigraph/ (GitHub sync is a
  separate push step).
- Service worker cache: thermigraph-v28. Public v27 link:
  https://bright-quokka-334504.netlify.app/ (v28 superseded by v28.1, neither deployed yet).

## v23 (2026-11-18) — Honest live vs forecast labelling (JS only)

Built from v22-worker (larger font, Cloudflare Worker live triage). No new
backend, no fake sensor data, no API key in the code.

- Section 1: green LIVE badge — "LIVE · Source: Open-Meteo · Updated every
  60s · As of <live time>" — plus the WBGT honesty line: "WBGT estimate from
  live air temperature, humidity, solar and wind (Liljegren formula) — not a
  physical WBGT meter reading."
- Section 3: Observed vs Forecast legend chips (green Observed, amber
  Forecast) and a Source column in the 6-day strain table: past 3 days +
  today = Observed, next 2 days = Forecast. The chart has a dotted vertical
  marker where the forecast starts. All numbers and math unchanged.
- Section 4: caption "Proactive plan — based on live WBGT now plus forecast
  hours". The shift table already recomputes on every Auto-Poll / loadAll
  (loadAll → loadActive → renderSection3 → renderSection4); no wiring change
  was needed.
- All 8 new strings exist in EN and AR (245 keys each, 0 missing).
- Worker URL, larger font (html 18px), Arabic toggle, Case 4 and Groq triage
  all kept from v22-worker. Service worker cache: thermigraph-v23.

## v22 (2026-11-18) — Coupled effective limits, hydration, live GPS + auto-poll

The NIOSH limit is no longer a fixed number. v22 couples it to the crew:
workload, acclimatisation and the multi-day debt the crew already carries
lower the limit the dashboard actually enforces, so the same WBGT can be
safe on Day 1 and unsafe on Day 3 for the same crew (Python v19 parity,
implemented from the v19 spec — the workspace Python files do not yet
contain this coupled logic, so the JS is the reference implementation).

- **logic.js — coupled logic.** `ACCLIMATIZATION_PENALTY`:
  acclimatised 0.0 / partial 1.5 / unacclimatised 2.5 °C.
  `estimateWBGT(..., exposure)` now takes `open_sun` (default),
  `high_albedo` (globe +1.5 °C) or `shaded` (globe = air temperature,
  WBGT = 0.7 wet bulb + 0.3 dry bulb). Shaded < open sun < high albedo
  at the same air temperature. No sentinel value anywhere (no -999).
  `effectiveWorkLimit(workload, acclimatization, cumulativeStrain,
  debtDays)` returns `[effLimit, totalPenalty, rationale]`: base Light
  30 / Moderate 28 / Heavy 26 / Very heavy 25 °C, minus the
  acclimatisation penalty, minus a debt penalty of 1.0 °C if strain
  >= 12, else 0.5 °C if debtDays >= 2 or strain >= 8.
  `workRestCoupled(wbgt, effLimit)` and `hydrationProtocol(wbgt,
  effLimit, debtDays)` judge against the effective limit: 1000 mL/hr
  chilled ORS every 15 min above effLimit + 2, 750 mL/hr every 20 min
  above the limit, 500 mL/hr every 30 min within 1 °C of it, 350 mL/hr
  baseline, plus a 500 mL pre-shift morning ORS bolus when debtDays
  >= 1. `computeTimelineAndStrain` counts hours over the effective
  limit and returns it with its rationale; `computeShiftSchedule`
  returns rows with `hydration` and `explanation` (PROACTIVE HALT /
  PROACTIVE 30/30 PACING / PRE-THRESHOLD BUFFER / Safe continuous
  window / SHADE BREAK 13-15) plus `effectiveLimit` /
  `limitRationale`; `deterministicTriageFallback` takes the full
  context and adds `hydrationProtocol` and `explainableCorrelation`,
  escalating Moderate to High with "PROACTIVE ESCALATION (Moderate ->
  High)" when the WBGT is above the effective limit and the crew
  carries compound strain. New preset: Case 4, Tariq, unacclimatised
  new cohort on Day 3 with mild headache, fatigue, 1 cup of water
  since 7am and poor sleep. All old exports and default arguments
  are kept, so v21 calls still work unchanged.
- **Section 2 controls.** Workload, acclimatisation and exposure
  selectors, a "Use My Live Worksite GPS" button (geolocation sets a
  Custom worksite and reloads; failure shows a status message and
  keeps the current worksite, never crashes), a "Live Auto-Poll
  (60s)" ON/OFF toggle (60 s `setInterval`, one interval per page
  life, reloads live telemetry while ON), and a telemetry heartbeat
  line showing the live Open-Meteo round-trip, e.g. "Live Open-Meteo
  stream (214 ms RTT, 14:32:10 UTC)".
- **Section 4 + Section 5.** The shift table gains Hydration
  Protocol and Explainable Schedule Adjustment columns. Triage shows
  the hydration protocol and the explainable correlation for every
  result, and re-runs automatically when a coupled selector changes.
- **Arabic.** Every new label, column, button and status is translated
  in both dictionaries (0 missing either way, verified in Node).
  Numbers, formulas, units, author names, journals, DOIs and worker
  notes stay English / as entered, pinned LTR exactly as in v21.
  Section 11 now says acclimatisation IS modelled (v22); age and
  medical history are still not modelled.
- **Honest limits, updated in v28.** Live triage on this static site is
  live Groq triage via the Cloudflare Worker (openai/gpt-oss-120b), with the
  deterministic offline fallback only on Worker failure — there is no API key in
  the JS. WBGT is still estimated from weather
  telemetry, not measured with a globe meter. The coupled logic is
  verified against the spec in Node (see Verify v22 below); Python v19 coupled
  logic exists in workspace/thermigraph/ (effective_work_limit,
  hydration_protocol, coupled triage/shift), GitHub sync is a separate push step.

## Verify v22 (2026-11-18, local only — NOT deployed, NOT pushed)

- `node --check app.js logic.js sw.js`: all OK.
- Local serve (`python3 -m http.server`, port 8933): all 11 files 200 —
  index.html 30,857 B, app.js 156,487 B, logic.js 39,816 B, styles.css,
  sw.js, manifest.webmanifest, icon.svg, icon-192.png, icon-512.png,
  og-image.png, README.md 32,991 B.
- Node smoke test (`/tmp/v22_smoke.js`, all PASS):
  `effectiveWorkLimit("Heavy","unacclimatised",14,3)` = `[22.5, 3.5,
  "Effective Heavy limit 22.5 C = NIOSH base 26.0 C - 3.5 C
  (unacclimatised acclimatisation -2.5 C; cumulative strain 14 >= 12
  (red line crossed) -1.0 C)"]`; `workRestCoupled(25,22.5)` =
  `[0, 60, "NO OUTDOOR WORK"]`; `hydrationProtocol(29,26,2)` = `[1000,
  "1000 mL/hr chilled ORS, every 15 min + 500 mL pre-shift morning
  ORS bolus (nocturnal debt)"]`; `estimateWBGT` at 36 °C / 50% RH /
  700 W/m²: shaded 30.0 °C < open sun 32.8 °C < high albedo 33.1 °C,
  and the default exposure equals open sun; Case 4 triage escalates
  to High with "PROACTIVE ESCALATION (Moderate -> High)" in
  `explainableCorrelation`; the Case 1 sample note still returns
  Critical with default arguments; old 3-argument calls to
  `computeTimelineAndStrain` / `computeShiftSchedule` still work
  (shift effective limit 26.0 °C with no debt context).
- i18n: EN and AR dictionaries have identical key sets (237 keys
  each, 0 missing either way, checked in Node). All new Section 2
  ids (`btnLiveGps`, `btnAutoPoll`, `telemetryHeartbeat`,
  `workloadSelect`, `acclimSelect`, `exposureSelect`) present in
  index.html.
- Greps: `AIza` 0; `-999` 0 in .js/.html; `installBtn.hidden = true`
  0 (the literal string `installBtn.hidden` occurs 3 times, all
  `= false`, inherited unchanged from v21 — that is the v19 fix that
  keeps the button visible, never hides it); `gemini` occurs twice,
  both in README.md prose inherited verbatim from v21 ("live Gemini
  behaviour", "no Gemini key in the deployed version") — no Gemini
  string in any .js or .html file, and no API key anywhere.
- NOT verified in a live browser: headless Chrome cannot start in
  this VM, so the GPS button, the 60 s auto-poll tick, the heartbeat
  line and the Arabic rendering of the new controls are verified by
  code + key wiring only. Check them on a real phone/browser after
  deploy. No zip was created.

## v20 (2026-11-16) — Full Arabic translation for the local UAE workforce

The Arabic toggle now translates ALL user-facing text, not just the page
chrome. Translated: all 11 headings, hero, buttons, labels, captions and
footer; Section 11 evidence prose, limitations and validation list; NIOSH
limits and work/rest rules; shift, strain and compare table headers;
cost calculator; triage labels (severity, tier and action templates);
worker view; the downloaded compliance report (.txt, Arabic when Arabic
is active); chart title and limit labels; map zone names (Mussafah مصفح,
KEZAD كيزاد, Ruwais الرويس — English name kept in parentheses);
clothing and worksite selector options; the guided tour; and the PWA
install button and status.

Fix found during verification (2026-11-16): the PWA string table was first
defined after the app IIFE, so `pwaT()` threw at boot in Arabic mode
(`PWA_T` was still `undefined`) and the language re-render reported an
error. The table and `pwaT()` now live before the IIFE; boot verified with
no error in both languages (DOM-stub smoke test, see verification below).

Kept in English / as entered, pinned LTR: author names, journal titles,
years, DOIs, the WBGT formula, worker notes and symptom names, numbers,
units (°C, %, km/h, W/m²), dates and ≤ signs. Numbers inside Arabic
prose carry a U+2066..U+2069 isolate, or a <span class="tg-keep-ltr">
in HTML strings, so the v18/v19 bidi bugs (C° 21.7, +0C reversed, full
stops jumping to the line start) do not come back. Tables stay
.tg-keep-ltr on purpose: their headers are Arabic but their columns and
numbers never reverse. English is the default and the fallback for any
missing key; language still persists in localStorage thermigraph_lang.

What did NOT change: WBGT physics, clothing corrections (+0/+1/+2/+4),
strain thresholds, NIOSH limits, live Open-Meteo data, the v19 PWA
install behaviour (button always visible, never disappears after a
click), chart/map behaviour, or any test / price / expert claim. No
expert, pilot or price was invented. Triage symptom content stays as
entered in the note; only the fixed labels, tier and action templates
are translated. The triage crew broadcasts were already Arabic.

Known trade-offs (honest): metric values are numbers-first and pinned
LTR, so an Arabic KPI value reads e.g. "9.0 ساعة / وردية 12 ساعة".
Section 11 references stay in English (authors, journals, DOIs).
The triage hydration / friction text stays in English because it is
derived from the typed note. A native-speaker review of the Arabic
clinical copy is still recommended before judging.

## v19 (2026-11-16) — Arabic RTL fix, Install button never disappears, Custom GPS fix

BUG 1 — Arabic RTL: a browser check confirmed nothing is rotated 180 degrees,
but in Arabic mode the English-untranslated content broke: trailing full stops
jumped to the start of the line, "21.7 °C" rendered as "C° 21.7", "+0 °C" as
"C° 0+", Section 1 cards reversed (Ruwais first), NIOSH pills reversed (Very
heavy first), Section 3 table columns reversed. Root cause: html dir=rtl
flipped all English body text, numbers and formulas. Fix: Arabic chrome
(headings, labels, buttons) stays RTL, but English blocks are pinned LTR
with a new .tg-keep-ltr class (direction: ltr; unicode-bidi: isolate;
text-align: left) applied to Section 11, the Section 2 NIOSH box and WBGT
formula, Section 1 zone cards and map, the Section 3 chart and table,
the shift / triage / compare tables, the ROI numbers and the phone WBGT,
plus html[dir="rtl"] rules so those containers do not reverse flex/grid
order. The chart itself does not flip. English body text is NOT translated
to Arabic; that is future work, as stated before.

BUG 2 — Install app button disappearing after the click (user-corrected):
in the user's own session the button WAS there, worked when clicked, and
THEN disappeared. Do NOT assume beforeinstallprompt never fired. Fix: the
button is ALWAYS visible (no hidden attribute, and the code never sets
hidden on it or on any other control). Accepted: it stays visible as a
persistent "Installed" state (disabled, text "Installed"). Dismissed: it
stays fully visible and clickable again, status "Install dismissed — click
Install app to try again". No deferred prompt on a later click: it stays
visible and shows "Install: use your browser menu > Install app / Add to
Home Screen". appinstalled gives the same persistent "Installed" state.
Top-bar buttons (theme, language, Refresh) and the site/clothing selects
are never hidden by this code.

BUG 3 (incidental, same check): Custom Latitude/Longitude showed Lagos
6.4402 / 4.0193 while the worksite was Mussafah. The fields are hidden
unless Custom is selected, and when shown they are filled with the active
site's coordinates (Mussafah 24.3613 / 54.5038 by default), never the
Lagos defaults. Service worker cache bumped to thermigraph-v19.

## v18 (2026-11-16) — Clothing / PPE wired into both dashboards + OG image

Clothing correction (ISO 7243 Annex C, simplified) was in the Python physics
engine since the all-31 run but appeared nowhere in either dashboard UI.
v18 threads it through: Python `estimate_wbgt(..., clothing=...)` now flows
through `dashboard_logic.py` (`compute_timeline_and_strain`,
`compute_shift_schedule`, `compute_compare_sites`), `strain_timeline.py`
and `shift_optimizer.py` mains, and the Streamlit dashboard has a
"Clothing / PPE (ISO 7243 Annex C)" selectbox in Section 1/2 that re-renders
the zone cards, the spiked WBGT, the strain timeline, the shift plan, the
compare table, the worker phone demo and the compliance report. JS
`logic.js` has the same `CLOTHING_CORRECTION` and `estimateWBGT(...,
clothing)`, and the v18 dashboard has a clothing `<select>` in Section 2
next to the spike slider that re-renders the WBGT cards, chart, timeline,
shift plan and compare table in place (no network refetch for the zone cards).
Effective WBGT = raw WBGT + correction (light 0, coveralls +1, construction
PPE +2, impermeable suit +4 C). The sign is ADD, never subtract. Default is
light civilian, so existing behaviour is unchanged when nothing is picked.
Section 11 now says the clothing correction IS applied via the selector;
acclimatisation, age and medical history are still not modelled.
OG image: `og-image.png` (1200x630) now exists in the deploy root, matching
the og:image / twitter meta tags already in index.html.


## v17 (2026-11-16) — Arabic chrome, mobile 375px, accessibility pass, OG tags

### 1. Arabic UI — PARTIAL, by design (not a full flip)
What the toggle did in v14: it swapped only the hero title, the hero
subtitle, and section headings s1–s10. Heading s11 was missing entirely,
there was no RTL direction change, and the choice did not persist.
What v17 does: the toggle now translates the page chrome — hero title,
tagline and pills, all 11 section headings (s11 added), all 11 kickers,
the Refresh / Lagos / Mussafah / Run triage / Download report buttons,
the theme button label, and the footer — flips the page to RTL
(`document.documentElement.dir = "rtl"`, `lang="ar"`), and persists the
choice in localStorage key `thermigraph_lang`. The key is deliberately
NOT prefixed `tg_`, so Refresh (which clears `tg_*` cache keys) does not
wipe the language choice. Markers are `data-i18n="key"` in index.html,
looked up in the EN/AR dictionaries in app.js (38 keys each, identical
key sets — verified in Node, see "Verify v17"). The Arabic subtitle now
gets an Arabic disclaimer, not the English one appended to it.
What is bilingual already, unchanged: the triage crew broadcasts
(Arabic + Hindi/Urdu) in `logic.js` `deterministicTriageFallback`.
What REMAINS English, and why: body paragraphs, captions, all tables
and their headers, chart labels, map tooltips/popups, triage extraction
fields, the worker phone view, tour steps, and all of Section 11
evidence text. Those strings are rendered dynamically in JS (about 100
call sites) or are clinical text that must not be machine-translated
without a reviewer. A full flip is a separate workstream: every render
function must look strings up in the dictionary, plus a translator
review of the clinical copy. Do NOT describe v17 as "fully Arabic".

### 2. Mobile (375px iPhone SE width)
New `@media (max-width: 768px)` block in styles.css: metric grids
(.tg-metric-grid, -3, -4), NIOSH chips, and the cost form grid stack to
1 column; both maps use `height: 60vh; min-height: 300px` instead of a
fixed 420px (the old 640px rule forcing the map to 340px is removed);
`.tg-table-wrap` keeps `overflow-x: auto` with touch scrolling and
tables get `min-width: 540px` so they scroll inside their wrapper
instead of widening the page; `body { overflow-x: hidden }` with an
`overflow-x: clip` override so the sticky top bar keeps working; large
buttons go full-width, slider rows wrap, phone shell max-width 100%.
The strain chart deliberately keeps its 440px container (v14 unclipping
fix): Plotly draws 420px tall, so shrinking the box on mobile would
re-clip it. The chart is tall on a phone, not clipped.

### 3. Accessibility — manual pass (Lighthouse NOT measured)
No Lighthouse score is claimed: the headless Chrome in this VM refuses
to start ("Hatch WebGL domain policy is required for browser startup")
and `npx lighthouse` needs that same Chrome, so no score was measured.
Manual pass done in v17: light-theme `--text-2` darkened #475569 to
#334155 (there is no `--text-secondary` variable in this codebase;
`--text-2` is its equivalent and `--text-3` was already #334155);
light-theme badge text darkened to AA-safe values (amber #92400e,
green #047857, blue #0369a1, red #be123c) — badges already carry words
(Critical / High / Moderate / OK) and NIOSH chips already say OK /
OVER LIMIT, so colour was never the only signal; `:focus-visible`
outline (3px accent) added globally; `aria-label` added to every
button that had only an icon or a title (theme, language, refresh,
tour controls, Lagos/Mussafah, triage, report — 14 aria-labels in
index.html); `role="img"` + descriptive `aria-label` on both maps and
the strain chart; every form input already had a `<label for>` (spike,
day, before/after and demo sliders, site/case selects, GPS, cost
inputs, field note) — verified, no label added or needed.

### 4. OG image meta tags — tags added, image NOT created
index.html head now has og:title, og:description, og:type, og:url,
og:image `https://bright-quokka-334504.netlify.app/og-image.png`,
twitter:card `summary_large_image`, twitter:title and
twitter:description. NO og-image.png exists in this folder and none was
faked: the file must be created before the preview works. To create it:
make a 1200x630 PNG (screenshot the live dashboard hero, or export a
title card reading "ThermiGraph AI — Live WBGT, 6-day strain, field
triage" over the Abu Dhabi map), save it as `og-image.png` in the
deploy root (the same folder as index.html), then redeploy. Until that
file is deployed, link previews will show no image — do not claim the
preview works until it has been checked in a real link preview.

### 5. ISO cross-check note — no fake caption added
The JS site correctly has ONLY the ISO 7243 weighting caption in
Section 2: "WBGT follows the ISO 7243 weighting (0.7 wet bulb + 0.2
globe + 0.1 dry bulb)." No JS cross-check caption was added, because
there is no cross-check running in the JS code. The Python Streamlit
version has a pythermalcomfort cross-check; the JS version has the
weighting caption. In Devpost, label the two URLs by what each one
actually shows: Streamlit = pythermalcomfort cross-check, JS =
ISO 7243 weighting caption. Do not claim either one does the other's
check.

### 6. Deploy — corrected instructions
Deploy ONLY by dragging the unzipped `thermigraph-js-v17` folder onto
the EXISTING site's deploys page:
https://app.netlify.com/sites/bright-quokka-334504/deploys
Never use the Netlify Drop homepage (that creates a new site) and never
use netlify-cli. One production deploy costs 15 Netlify credits: confirm
the remaining quota before deploying (74.6 of 300 credits remained for
the period ending 12 Dec 2026, about 5 deploys left, per the standing
rule set 2026-11-15 — re-check the live balance first, do not deploy on
a stale number). After deploying, check the live site: the 3 zone cards
load live, the strain chart shows full peaks and labels, all 3 map
zones are visible, Section 11 is present, the Arabic toggle flips the
chrome to RTL, and at 375px wide there is no horizontal scroll.

## Files

- `index.html` — page structure, all 11 sections, CDN links (fonts, Plotly)
- `styles.css` — the design system (Clinical Daylight / Obsidian Dark themes, glass cards, animations)
- `logic.js` — pure physics + triage + optimizer logic, no DOM. Ported from the Python
  modules and verified to match them exactly (see `verify/`).
- `app.js` — fetches live Open-Meteo data in the browser and renders the dashboard.
  The map is Leaflet with CartoDB Voyager / Dark Matter tiles (the same basemaps
  the Streamlit version uses), one circle per zone: bigger means hotter, colour
  is the NIOSH status. deck.gl was removed after it rendered a blank box with no
  canvas on the live Netlify site (2026-11-14); a plain 2D canvas replacement drew
  bars but no geography, so the user saw floating green bars and no map, and was
  replaced by Leaflet the same day. ROOT CAUSE found 2026-11-14: the IIFE aliases
  ThermiGraphLogic as `L`, which shadowed Leaflet's global `L`, so `L.map()` threw
  "L.map is not a function" at boot and killed boot() before the live data ever
  loaded (blank page, no error, Refresh button dead). Fixed by using `window.L`
  explicitly for every Leaflet call, plus a failure rule: renderMap() is wrapped
  in try/catch, boot() runs every step in its own try/catch and always calls
  loadAll(), and any uncaught error is shown visibly in the status banner.
  VERIFIED in Node with a stub DOM + stub Leaflet: BOOT_OK (1 map, 3 markers,
  zone cards populated, no error). See verify/test_boot.js. Live inspection of
  v4 (2026-11-14) confirmed the page works: zone cards live (Mussafah 21.8 /
  KEZAD 22.1 / Ruwais 21.3 C), 3 green circles with correct tooltips, zoom
  controls, triage runs (Deterministic Fallback, No-Key Mode), refresh works.
  BUT the map background was blank white with "API KEY REQUIRED /
  carto.com/basemaps/apikey" watermarked on every tile: CARTO's raster tile
  endpoints now require an API key. FIX v5: tile source switched to
  OpenStreetMap standard tiles (free, no key, works in both themes); the exact
  Abu Dhabi tiles at zoom 8 return 200 with real map data (~15 KB each). Section
  1's map only plotted the three Abu Dhabi zones, so Lagos, Delhi and Houston
  were invisible on any map (they only appeared in the Section 7 table and the
  Section 2 dropdown). FIX v6: Section 7 ("Global Compare-Sites View") now has
  its own world map plotting all four compare sites (Mussafah, Lagos, Delhi,
  Houston) with the same circle logic, fitted to show them all at once; Section
  1's map now fits its view to the three Abu Dhabi zones instead of a fixed zoom
  on the whole peninsula, so their labels no longer overlap. VERIFIED in Node
  (verify/test_boot.js): BOOT_OK, 2 maps, 7 markers (3 UAE + 4 compare sites).

- v7 (rich demo features, 2026-11-14): all six built, Abu Dhabi primary
  throughout. (1) Guided demo tour: a "Play the story" button in the hero opens
  a bottom bar with 6 steps; it NEVER advances on its own, only Next/Back
  buttons move it. The story starts AND ends in Mussafah (Abu Dhabi); Lagos
  is only the middle dramatic beat ("global proof"). Steps: Abu Dhabi live,
  Lagos +6, strain timeline, triage, shift optimizer, Abu Dhabi impact payoff.
  (2) Interactive maps: click any dot for a popup with live numbers; each dot
  has a pulsing ring (hotter = faster pulse, 1.2s red / 1.8s amber / 2.4s
  green); both maps have a Street / Satellite layer toggle (OSM + Esri World
  Imagery, free, no key). (3) 6-day timeline scrubber in Section 3: drag to
  step through each day, the readout shows that day's numbers and the matching
  table row highlights. (4) Before/after slider in Section 4: scales the
  prevented-hours and cooling-minutes KPIs from 0% (no schedule) to 100%
  (full schedule). (5) Animated counters: the Section 8 impact numbers count
  up from zero the first time they scroll into view. (6) Scroll animations:
  sections fade and slide up as they scroll into view (IntersectionObserver,
  with a no-observer fallback that shows everything). VERIFIED in Node
  (verify/test_boot.js): BOOT_OK, 2 maps, 4 tile layers, 2 layer controls,
  14 markers (7 main + 7 pulse rings), 7 popups, tour starts in Abu Dhabi and
  Next goes to Lagos, day scrubber Day 3 readout correct, before/after 50%
  label correct. LIVE CHECK (2026-11-14, shared tab): v7 is live, 5 of 6
  features worked (tour, map popup/satellite, day scrubber, before/after
  slider all confirmed with exact values; the Section 7 world map and Section 1
  Abu Dhabi map both confirmed). Counters/scroll animations were NOT seen
  moving: the numbers were already at final values when the check looked.
  FIX v8: the count-up was 0.9s and started at the same time as the section
  fade, so it finished while the section was still invisible and only ran
  once. Now the count-up is 1.6s and starts 400ms AFTER its section fades
  in; the fade is 0.9s with a 24px rise (was 0.6s / 14px). VERIFIED in Node
  (verify/test_counters.js): COUNTER_OK, counters start at 0, Section 8 gets
  tg-visible on scroll into view, mid-count at ~700ms reads 2,057 / 206 /
  $246,843 / ~82, final values 4,500 / 450 / $540,000 / ~180. The live check
  also left the site on Lagos at +6 C (tour exited at step 3); press
  "Back to Mussafah" to reset to Abu Dhabi.

- v9 (code cleanups, 2026-11-14, from an outside code audit, verified
  claim-by-claim against the real files before applying): (1) app.js
  reportError string changed from "Please tell Muse." to "Please click
  Refresh live data." so judges inspecting the source see a clean,
  self-contained artifact. (2) styles.css .tg-map-label fixed two
  undefined CSS variables: color var(--text-primary) is now var(--text),
  font-family var(--font-sans) is now var(--font-ui). :root defines
  --text and --font-ui only; the old names fell back to Leaflet's dark
  default text, which washed out against the dark card in dark mode.
  Verified: node --check OK for logic.js and app.js; zero occurrences
  of "Please tell Muse", "--text-primary" or "--font-sans" remain.
  Pre-recording cache trick (verified): localStorage keys are
  tg_active_live_<lat>_<lon> and tg_active_hourly_<lat>_<lon>, 1-hour
  expiry. Clicking Lagos +6 then Back to Mussafah warms the cache for
  both corridors, so the demo steps load from local storage with no
  network wait.

- v10 (tour video-sync fixes, 2026-11-14, from a frame-by-frame review
  of the recorded demo video, verified against the video and the code
  before applying): (1) styles.css .tg-tour-bar moved from bottom-center
  (680px wide) to bottom-right (420px wide) so it no longer covers the
  triage table rows or the Arabic/Hindi-Urdu broadcast rows. (2) app.js
  TOUR_STEPS Step 3 (section3) now sets daySlider to "1" and calls
  renderDayScrub(), so the strain scrubber starts at Day 1 and drags
  forward to Day 6 instead of starting at Day 6 and dragging backwards.
  (3) app.js TOUR_STEPS Step 5 (section4) now sets baSlider to "0" and
  calls renderBeforeAfter(), so the before/after slider starts at 0%.
  Verified: node --check OK for logic.js and app.js; boot test BOOT_OK.
  Re-record camera moves (for the next take): Step 3 drag Day 1 to Day 6
  left-to-right; Step 4 scroll down one notch after triage so the Arabic
  and Hindi/Urdu rows are fully visible; Step 5 keep Section 4 top in
  view (or zoom to 90%) so the KPI cards and the slider fit on screen
  together, and drag the slider all the way to 100%.

- v11 (tour bar to top-right, 2026-11-14, from a screenshot the user
  sent of the v10 recording): the tour bar at bottom-right was covering
  the right end of the Before/After slider in Section 4 while it was
  being dragged. Moved .tg-tour-bar from bottom-right to top-right
  (top: 4.5rem, below the dashboard header) so it never overlaps the
  slider or the tables. Verified: node --check OK; boot test BOOT_OK.
  NOTE: the user's screenshot also showed the browser was NOT in full
  screen (tabs, address bar, bookmarks bar and Windows taskbar all
  visible), so that take will need the browser chrome cropped off again
  or a re-take in full screen.

- v12 (slim tour bar, 2026-11-14, user said the tour bar still took up
  too much screen and hid the figures): .tg-tour-bar is now a slim pill
  (border-radius 999px, padding 0.45rem 0.7rem, width auto) with the title
  and description text hidden (display: none). Only the Back / Next /
  Exit buttons and the step number remain, so the figures underneath stay
  visible. The tour still works the same way. Verified: node --check OK;
  boot test BOOT_OK.

- v13 (tour removed from the UI, 2026-11-14, user decision): the tour
  bar still took up too much screen, and the description text was not
  needed for judges (the voiceover explains each beat). The guided tour
  is removed from the UI: `#btnTour` and `#tourBar` are both hidden in
  styles.css. The tour JS stays in app.js so it can be restored later.
  The demo is now driven by scrolling to each section and using its own
  controls (site buttons, spike slider, day slider, triage button,
  before/after slider, worker slider). Verified: node --check OK; boot
  test BOOT_OK.

- v14 (2026-11-16, fixes from the live check of
  https://chipper-halva-04403d.netlify.app/ on 2026-11-16):
  (1) Strain chart (§3) unclipped: Plotly height 340 → 420, margins
  t:55 b:60 l:60 r:30, explicit y-axis range padded 2 °C beyond the
  data and both limit lines, limit labels moved inside the plot
  (x=0.98 paper, right-anchored, with a background), x-axis ticks
  angled -30°, chart container min-height 340 → 440 px.
  (2) New §11 Clinical Evidence & Validation: Liljegren et al. 2008,
  NIOSH 2016 Publication No. 2016-106, ISO 7243 (Parsons 2006),
  Florida farmworker AKI study 2025, validation tests 8/8 passed,
  and the limitations. No expert quote, clinician name, or real
  pilot is claimed.
  (3) Abu Dhabi map: fitBounds padding 36 → 70 px, map height
  460 → 420 px, re-fit after markers render and again at 900 ms,
  so Ruwais is fully visible.
  (4) Scroll fade: 0.9 s + stacked delay → 0.35 s, no delay,
  observer threshold 0.12 → 0.05 with a 120 px root margin, plus a
  1,200 ms safety fallback that reveals every section, so Sections
  6 and 8 can no longer stay pale or blank. Counters start 100 ms
  after reveal and finish in 1.0 s. No change to the spike slider,
  triage sample note, ROI numbers, or live Groq triage behaviour
  (live Groq via the Cloudflare Worker, deterministic fallback only
  on Worker failure, no key in JS).
  Verified: see "Verify v14" below.

## Deploy (existing Netlify site bright-quokka-334504)

Do NOT use the Netlify Drop homepage — that creates a new site.
Do NOT use netlify-cli. Drag the unzipped `thermigraph-js-v17` folder
onto the existing site's deploys page ONLY:
https://app.netlify.com/sites/bright-quokka-334504/deploys
One production deploy costs 15 Netlify credits. Confirm your
remaining quota before deploying. After deploying, check the live
site: the 3 zone cards load live, the strain chart shows full
peaks and labels, all 3 map zones are visible, Section 11 is
present, the Arabic toggle flips the chrome to RTL, and at 375px
wide there is no horizontal scroll. The Lagos +6°C button jumps to
Lagos with a red strain banner.

No build step, no server, no API key. Open-Meteo is free and keyless. The triage
runs on live Groq via the Cloudflare Worker (openai/gpt-oss-120b), with the
deterministic offline fallback only if the Worker fails.

## Verify

`verify/` holds the proof that the JavaScript logic matches the Python logic:
- `make_fixture.py` — builds a deterministic 6-day fixture and the Python results.
- `test_logic.js` — runs `logic.js` on the same fixture. Result: **0 diffs**.
- `smoke_live.js` — fetches real Open-Meteo data and runs the logic on it.
  Live check 2026-11-14: Mussafah WBGT 21.9 °C, strain 8/12 at spike 0,
  strain 24/12 at spike +6, Lagos +6 WBGT 34.9 °C. These match the Streamlit
  version's known live values.

## Verify v17 (2026-11-16, local only — NOT deployed)
- `node --check app.js logic.js`: both OK.
- Local serve (`python3 -m http.server`, port 8932): index.html 200
  (24,535 bytes), app.js 200, styles.css 200, logic.js 200. Open-Meteo
  reachable from this VM (200).
- i18n wiring (Node check against the real files): 22 `data-i18n`
  markers in index.html, all present in both EN and AR dicts; 38 keys
  each, identical key sets; headings s1–s11 complete in both languages;
  RTL `dir` assignment and `thermigraph_lang` persistence confirmed in
  app.js source. The toggle was NOT click-tested in a live browser: the
  headless Chrome in this VM refuses to start (see below), so the RTL
  flip is verified by code + key wiring, not by a rendered click.
- Mobile CSS (parsed styles.css): the 768px block contains 1-column
  grids, map `60vh` / `min-height: 300px`, table `overflow-x: auto`,
  and body `overflow-x: hidden/clip`. NOT verified by a rendered 375px
  layout: headless Chrome could not start in this environment, so no
  screenshot or scrollWidth measurement was possible. Check on a real
  phone (or the parent agent's browser) after deploy.
- Lighthouse: NOT measured. `npx lighthouse` was started; it needs the
  same headless Chrome, which refuses to start here. No accessibility
  score is claimed — see the manual pass in the v17 changelog above.

## Rollback

The Streamlit version (v6.3.13) is untouched and remains the safe submission.
If this JavaScript version has any problem, keep using the Streamlit link.


## v17 - PWA (installable mobile app)
- Added manifest.webmanifest, sw.js, icon.svg, icon-192.png, icon-512.png.
- Theme colour #0f172a, display standalone, start_url ./index.html.
- Service worker caches the app shell, network-first for Open-Meteo live weather, so the last live values show offline.
- Install: on Android Chrome, menu > Install app / Add to Home screen. On iPhone Safari, Share > Add to Home Screen.
- No app store, no native code, no account. Deploy is the same drag to the bright-quokka-334504 deploys page, 15 credits.
- PWA was NOT click-tested in a real browser in this VM (headless Chrome blocked). Check install prompt on a real phone after deploy.

## v17 - PWA install fix (the one partial item in v16)
- Root cause: v16 registered a service worker and linked a manifest, but had NO
  beforeinstallprompt listener and NO install button, so Chrome's install offer
  was never surfaced in the page, and live SW registration was not observable.
- Fix: in-page "Install app" button in the top bar (id installBtn, hidden until
  beforeinstallprompt fires), beforeinstallprompt is captured and shown on click,
  appinstalled hides the button, and a #pwaStatus line plus body data-sw /
  data-installable attributes make registration observable in the DOM.
- Manifest: added id, categories, lang, and a maskable 512 icon entry.
- Service worker cache bumped to thermigraph-v17.
- Install still also works via browser menu > Install app / Add to Home Screen.
- Verified locally in VM: node --check OK, http 200 for manifest, sw.js, icons.
  Install prompt itself must be checked in a real Chrome browser after deploy,
  it only fires on a secure origin / localhost with the manifest + SW + icons all valid.

## v21 - Sliders pinned left-to-right
- In Arabic RTL mode the browser flipped range sliders, so +0 started on the
  right and +10 was on the left. Per the user, all sliders now always run
  left-to-right in both languages: minimum on the left, maximum on the right.
- Fix: input[type="range"], .tg-slider { direction: ltr; unicode-bidi: isolate; }
  plus the same rule under html[dir="rtl"]. Applies to #spikeSlider, #demoSlider,
  #daySlider, #baSlider, and any other range input on the page.
- Slider labels, value text, and surrounding layout stay Arabic RTL as before.
  No slider values, ranges, steps, behaviour, translation, physics, clothing,
  PWA, or chart code changed. SW cache bumped to thermigraph-v21.
