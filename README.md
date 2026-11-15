# ThermiGraph AI — JavaScript Version

A plain HTML/CSS/JavaScript rebuild of the ThermiGraph dashboard. Same numbers,
same sections, same design system as the Streamlit version (v6.3.13), but with
full JavaScript freedom: smooth count-up metrics, staggered fade-in, native
deck.gl 3D map transitions, and no Streamlit frame.

## Files

- `index.html` — page structure, all 10 sections, CDN links (fonts, Plotly)
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

## Deploy (Netlify Drop, free)

1. Download and unzip `thermigraph-js.zip` (the 4 files above, at the root).
2. Open https://app.netlify.com/drop in your browser.
3. Drag the unzipped `thermigraph-js` folder onto the page.
4. Netlify gives you a public link (something like `https://random-name-123456.netlify.app`).
5. Open the link and check: the 3 zone cards load live, the 3D map shows tilted bars,
   the Lagos +6°C button jumps to Lagos with a red strain banner, and the triage runs.

No build step, no server, no API key. Open-Meteo is free and keyless. The triage
runs on the deterministic offline fallback (no Gemini key in the deployed version,
by the user's decision), exactly like the Streamlit deployment.

## Verify

`verify/` holds the proof that the JavaScript logic matches the Python logic:
- `make_fixture.py` — builds a deterministic 6-day fixture and the Python results.
- `test_logic.js` — runs `logic.js` on the same fixture. Result: **0 diffs**.
- `smoke_live.js` — fetches real Open-Meteo data and runs the logic on it.
  Live check 2026-11-14: Mussafah WBGT 21.9 °C, strain 8/12 at spike 0,
  strain 24/12 at spike +6, Lagos +6 WBGT 34.9 °C. These match the Streamlit
  version's known live values.

## Rollback

The Streamlit version (v6.3.13) is untouched and remains the safe submission.
If this JavaScript version has any problem, keep using the Streamlit link.
