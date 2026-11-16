# Future Health gallery screenshots - checklist

Live site: https://chipper-halva-04403d.netlify.app/
Target: 6 desktop shots + 3 mobile shots, all JPG, 1440 px wide
(desktop), uploaded via Future Health Edit Project > Gallery. Take the
shots on the live site, not on localhost, so the gallery matches what
a judge sees. Check the live WBGT numbers and the date in each shot
before saving - do not reuse a shot from another day and present it
as today's reading.

## Before you start

1. Open the live site in Chrome. Press F11 for fullscreen (hide the
   browser chrome). If the page has a cookie/banner bar, dismiss it
   first.
2. Wait for the live data to load (Mussafah / KEZAD / Ruwais cards show
   numbers, not spinners). If a section shows an error banner, stop -
   fix the site first, do not screenshot the error.
3. Set the browser zoom to 100%. On Linux, use the window at
   1440 px wide or wider, then resize/crop to exactly 1440 px wide
   when exporting (see "Export" below).
4. Keep the heat-spike slider at +0 C unless a shot says otherwise.
   Write down the live values visible in each shot (WBGT, date, site)
   so the Future Health captions are accurate.

## The 6 desktop shots

### 01_hero.png - Hero / Section 1, live WBGT

- What to show: the top of the dashboard - title, the three Abu Dhabi
  host-zone cards (Mussafah, KEZAD, Ruwais) with live WBGT, and the
  NIOSH limit line.
- Steps: load the live site, scroll to the very top, fullscreen (F11),
  screenshot the full viewport.
- Pass check: all three sites show a number; the "estimate, not a meter
  reading" label is visible; no spinner, no error banner.
- Caption idea: "Live WBGT estimate, Mussafah / KEZAD / Ruwais - weather-derived, not a meter reading."

### 02_strain_red.png - Strain timeline, red gauge >= 12

- What to show: Section 3 (Multi-Day Physiological Debt) with the
  cumulative strain gauge at or above the red line of 12, and the
  6-day strain chart.
- Steps: scroll to Section 3. Move the Heat Spike Simulator slider to
  **+8 C**. Wait for the chart and gauge to update. Confirm the
  cumulative index reads **>= 12** and the gauge/chart shows red.
  Screenshot that section (full viewport, chart and gauge both in
  frame).
- Pass check: spike slider visibly reads +8 C; cumulative >= 12;
  red state visible. If November live data plus +8 C does not reach
  12, do not fake it - note the actual value and retake with the
  slider at the lowest value that does reach 12, and say so in the
  caption.
- Caption idea: "Heat spike +8 C: 6-day cumulative strain crosses the red line (12)."

### 03_triage.png - Triage, Case 1, Arabic/Hindi broadcasts

- What to show: Section 5 (Structured Clinical Extraction) with
  **Case 1** selected - Critical severity, symptoms including stopped
  sweating and vomiting, and the Arabic and Hindi/Urdu crew broadcasts.
- Steps: scroll to Section 5, select "Case 1: Acute CNS Heat Stroke &
  Anhydrosis (Critical Red Flag)". Run triage. Wait for the result
  table and both broadcast boxes. Screenshot the section.
- Pass check: worker summary shows `[Worker - Anonymised]`, not a
  name; severity reads Critical; both broadcast boxes are visible.
  Note which engine ran (Gemini or Deterministic Fallback) and say so
  in the caption if it matters.
- Caption idea: "Case 1 triage: Critical, name redacted, Arabic + Hindi/Urdu crew broadcasts."

### 04_worker.png - Worker view (Section 10)

- What to show: Section 10 (Last-Mile Field Equity) - the worker-facing
  view: one number, one action, one promise.
- Steps: scroll to Section 10. If there is a language/theme control,
  leave it on the default. Screenshot the section full viewport.
- Pass check: the single WBGT number and the single action are
  readable at a glance; no supervisor-only detail crowds the frame.
- Caption idea: "Worker view: one number, one action, one promise."

### 05_cost.png - Cost of inaction (Sections 8-9)

- What to show: Section 8 (Health System & Employer Economics) and/or
  Section 9 (Interactive Actuarial Model) - projected cases, cost,
  and cases/cost prevented.
- Steps: scroll to Sections 8-9. Use the default worker count and WBGT
  unless the caption says otherwise. Screenshot the panel.
- Pass check: the "estimate / planning only" label is visible; the
  numbers match the inputs shown.
- Caption idea: "Cost of inaction: planning estimate, not epidemiology."

### 06_map.png - Compare sites / map (Section 7)

- What to show: Section 7 (Cross-Continental Benchmarking) - the
  compare-sites table and the site map, all sites side by side with
  the same physics and thresholds.
- Steps: scroll to Section 7. Wait for every site row to load.
  Screenshot the table and map together if they fit; otherwise take
  the table as the shot and the map as a supporting crop.
- Pass check: every site row shows Current WBGT, 6-Day Max WBGT,
  Debt Days and Risk Tier; no blank rows.
- Caption idea: "One table, six sites, same physics and thresholds."

## The 3 mobile shots

Use Chrome DevTools device toolbar (Ctrl+Shift+M) or a real phone.
Target width 390 px (iPhone 14 / Pixel class). Save as JPG, 1440 px
wide is not required for mobile - export at the device width, and
note "mobile" in the filename.

- **m01_hero_mobile.jpg** - Section 1 on mobile: live WBGT cards
  stacked, readable, no horizontal overflow.
- **m02_strain_mobile.jpg** - Section 3 on mobile with the spike
  slider visible; chart readable without sideways scrolling.
- **m03_triage_mobile.jpg** - Section 5 on mobile, Case 1 result:
  severity and immediate action visible, broadcasts readable.

Pass check for all mobile shots: no text cut off at the right edge,
no horizontal scrollbar, buttons reachable.

## Capture tools (Linux)

- **Chrome fullscreen:** F11. Screenshot a viewport with
  Ctrl+Shift+S in some builds, or use the OS tool below.
- **Flameshot (recommended):** `flameshot gui` - drag the area,
  save as PNG. Install: `sudo apt install flameshot`.
- **GNOME Screenshot / Snipping:** `gnome-screenshot -w` for the
  active window, or use the screenshot key (Print Screen) and crop.
- Do not photograph the screen with a phone. Do not screenshot a
  screenshot.

## Export

1. Open each PNG in an image editor (e.g. GIMP) or convert from the
   terminal. Resize desktop shots to **1440 px wide** (height scales
   proportionally, do not stretch). Export as **JPG, quality 85**.
2. Terminal option (ImageMagick, if installed):
   `convert 01_hero.png -resize 1440x -quality 85 01_hero.jpg`
   Check the output opens and the text is still readable.
3. Name the files exactly: `01_hero.jpg`, `02_strain_red.jpg`,
   `03_triage.jpg`, `04_worker.jpg`, `05_cost.jpg`, `06_map.jpg`,
   `m01_hero_mobile.jpg`, `m02_strain_mobile.jpg`,
   `m03_triage_mobile.jpg`.
4. Delete any shot with a spinner, an error banner, a cut-off chart,
   or a stale date. Retake it; do not upload it "for now".

## Upload to Future Health

1. Future Health > your ThermiGraph project > **Edit Project**.
2. Scroll to **Gallery** (images/video). Upload the 6 desktop shots
   first, in order 01-06, then the 3 mobile shots.
3. Add a caption to each image (use the caption ideas above, corrected
   to the actual values in the shot).
4. Keep the video (https://youtu.be/iv_KnkdgBH0, 2:53) as the first
   gallery item if Future Health orders video first; do not remove it to
   make room for images.
5. Save, then open the public project page in a private/incognito
   window and check every image loads and every caption is correct.
