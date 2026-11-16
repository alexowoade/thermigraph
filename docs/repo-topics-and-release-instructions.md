# Repo topics, description, social preview, release, domain and uptime

Repo: https://github.com/alexowoade/thermigraph
Live site: https://chipper-halva-04403d.netlify.app/
Video: https://youtu.be/iv_KnkdgBH0 (2:53)

Do NOT run the tag/push commands in this file until the maintainer
says so. This file is instructions only. Do NOT create any accounts
while following it - if a step needs an account you do not have, stop
and ask.

## 1. GitHub repo description

Set this as the repo description (GitHub repo page > gear icon next
to "About", or Settings > General):

```
Temporal biometeorological and field-triage engine for outdoor heat stress - WBGT, 6-day strain, multilingual field triage.
```

## 2. GitHub topics

Add these 10 topics, in this order (repo page > gear icon next to
"About" > Topics). GitHub allows up to 20 topics; these are the 10
chosen. Do not add extra topics without checking they describe the
repo:

```
occupational-health
heat-stress
wbgt
niosh
iso-7243
streamlit
gemini
open-meteo
climate-health
uae
```

## 3. Social preview image (1600 x 640)

GitHub shows this image when the repo link is shared (Settings >
General > Social preview).

Steps:

1. Take the hero screenshot `01_hero.jpg` from
   `docs/screenshots-checklist.md` (Section 1, live WBGT, three Abu
   Dhabi sites). If it does not already show the title clearly, take
   a fresh shot of the top of the live site at 1600 px wide.
2. Crop/resize it to exactly **1600 x 640 px** (wide banner, not
   square). Keep the title and at least one live WBGT number readable;
   crop from the bottom, not the sides, if you must lose content.
   Terminal option (ImageMagick, if installed):
   `convert 01_hero.jpg -resize 1600x640^ -gravity center -extent 1600x640 social-preview.jpg`
   Check the result at full size before uploading.
3. GitHub repo page > gear icon next to "About" > Social preview >
   Upload the 1600x640 image. Save.
4. Verify: paste the repo URL into a fresh message / link preview and
   confirm the banner appears. GitHub caches previews, so a stale
   image can take a while to update; that is normal.

## 4. v1.0.0 tag and release draft (commands only - DO NOT RUN YET)

Do not tag or push until the maintainer confirms the release contents
(all docs in this batch merged, README section 8 replaced, tests
passing on `main`).

Commands, to run from the repo root on the maintainer's machine:

```bash
git status
git log --oneline -5
pytest -v
git tag -a v1.0.0 -m "ThermiGraph v1.0.0 - Future Health Digital Innovation Challenge 2026, Population Health prototype"
git push origin v1.0.0
```

Then create the release on GitHub: repo page > Releases > Draft a new
release > Choose tag `v1.0.0` > Release title `v1.0.0` > paste the
description below > Publish release.

Release description draft:

```
ThermiGraph v1.0.0 - Temporal biometeorological and field-triage engine for outdoor heat stress.

Future Health Digital Innovation Challenge 2026, Population Health track, Prototype stage.
Live demo: https://chipper-halva-04403d.netlify.app/
Demo video (2:53): https://youtu.be/iv_KnkdgBH0

What is in this release:
- Live WBGT estimate from Open-Meteo (Stull wet bulb, wind-adjusted black globe), NIOSH 2016 limits.
- 6-day Cumulative Thermal Strain Index with Nocturnal Recovery Debt (night min > 28 C), red line 12 (prototype score).
- Work/rest shift optimiser with Crew A / Crew B rotation and recommended 12:30-15:00 shade break.
- Multilingual field-log triage (Gemini gemini-3.6-flash, or deterministic offline fallback), with name redaction and Arabic + Hindi/Urdu crew broadcasts.
- Multi-site comparison, cost-of-inaction estimator, ISO 7243 cross-check.
- 15 pytest tests + 8 validation tests.

What this release is not:
- Not a calibrated meter reading, not a medical diagnosis, not a compliance certificate.
- No real pilot, real crew, or expert reviewer is claimed. Evidence brief: clinical-evidence-brief.md at the repo root.
```

## 5. Custom domain - do NOT buy

Do **not** buy a custom domain for ThermiGraph. A domain costs about
$15/year, and this prototype does not need one. Keep the Netlify
subdomain (`https://chipper-halva-04403d.netlify.app/`) as the live
URL. If a domain is ever bought in future, keep the Netlify subdomain
working as a redirect to it - do not break the URL already submitted
to the challenge and already in the video and Future Health.

## 6. Uptime monitor (UptimeRobot, free tier)

Purpose: know if the live Netlify site goes down before a judge finds
out. No account creation is part of this task - the maintainer creates
the account if they choose to.

Instructions for the maintainer:

1. Create a free UptimeRobot account (https://uptimerobot.com - free
   plan, 50 monitors).
2. Add a monitor: Monitor Type **HTTP(s)**, Friendly Name
   `ThermiGraph live site`, URL
   `https://chipper-halva-04403d.netlify.app/`, Monitoring Interval
   **5 minutes**.
3. Set the alert contact to an email the maintainer actually reads.
4. Verify: the monitor should show Up within a few minutes. If it
   shows Down, open the URL in a browser first - a monitor can report
   Down for a slow free-tier cold start that a real visitor would
   still reach.
5. Do not point the monitor at the Streamlit Community Cloud app or
   at any URL that needs a login.

Note: the Netlify site is a static JavaScript build; the Python
Streamlit app is a separate deployment. This monitor covers the
submitted live site only.
