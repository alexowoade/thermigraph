# ThermiGraph - Frequently Asked Questions

Prototype stage, Future Health Digital Innovation Challenge 2026,
Population Health track. Live demo: https://chipper-halva-04403d.netlify.app/

## 1. Why Open-Meteo? Why not a paid weather API?

Open-Meteo is free, needs no API key, and gives exactly what the WBGT
estimate needs: hourly temperature, relative humidity, 10 m wind speed
and shortwave solar radiation, for any latitude/longitude, past 3 days
plus forecast. That means a judge, a student or a small contractor can
clone the repo and run the whole thing with `pip install -r
requirements.txt` and no account, no key and no bill. A paid API would
add a key, a quota and a failure mode for no extra accuracy at this
prototype stage - the limiting factor is not the weather feed, it is
that a weather feed is not a globe thermometer on site. If a deployment
ever needs a contracted weather provider, the fetch layer is the one
place to swap; the physics in `physics_engine.py` does not change.

## 2. Why not just buy a Kestrel?

A Kestrel 5400 (about $549, verified 16 November 2026 - see
`docs/commercial-comparison.md`) is the right tool for a real reading
at one spot at one moment, and ThermiGraph does not replace it. What a
Kestrel cannot do is forecast tomorrow, add up strain over 6 days,
plan a crew rotation, compare six sites, or read a supervisor's field
note in three languages. ThermiGraph is the planning layer *around* a
meter: it tells you which day and which crew are at risk before anyone
is on site, and the meter verifies the reading when it matters. The
honest setup is both - ThermiGraph to plan, a calibrated meter to
verify. Any safety decision that depends on a single number should use
the meter, not this estimate.

## 3. How is this different from a heat-index app?

Heat index combines temperature and humidity to say how hot it feels
at rest, in the shade. It ignores solar radiation and wind, and it says
nothing about a body doing heavy work. WBGT adds radiant heat (the black
globe) and wind, and NIOSH ties WBGT to work limits by workload
(Light 30 C, Moderate 28 C, Heavy 26 C, Very heavy 25 C). ThermiGraph
also goes beyond a single number: a 6-day cumulative strain timeline
with overnight recovery debt, a work/rest shift plan, multi-site
comparison, and field-note triage. A heat-index app answers "is it hot
now?"; ThermiGraph tries to answer "which crew, on which day, is
heading for collapse, and what do we change?"

## 4. How is this different from NIOSH / OSHA calculators?

It is not a different standard - it *uses* the same one. The NIOSH
limits in `physics_engine.py` are the NIOSH 2016-106 Recommended
Exposure Limits, and the WBGT formula is the ISO 7243 outdoor formula
(0.7 wet bulb + 0.2 globe + 0.1 dry bulb), cross-checked against
`pythermalcomfort` in `dashboard_logic.py`. A NIOSH/OSHA calculator
gives you a limit for a WBGT you supply. ThermiGraph supplies the
estimated WBGT from live weather, applies the limit, then adds the
parts no calculator has: the 6-day strain timeline, the shift
optimiser, the multilingual triage, and the cost-of-inaction estimate.
It does not claim OSHA compliance and it is not a compliance
certificate - see question 7.

## 5. What happens to a worker's name and note? Is this private?

The field note is processed in memory for the current session only.
ThermiGraph has **no persistent storage**: no database, no account, no
saved notes. Names are redacted by `redact_worker_name()` in
`triage.py` to `[Worker - Anonymised]` before the summary is shown, and
shift planning uses `Crew A` / `Crew B` only, never individual names.
When a Gemini key is set, the note is sent to Google's Gemini API as
part of that API request; there is no other third party. When no key is
set, or the API fails, the deterministic fallback runs locally and
nothing leaves the machine. Full detail: `docs/data-governance.md`.
Do not paste real names or real medical details into the public demo.

## 6. Is ThermiGraph a medical device? Does it diagnose?

No, on both counts. ThermiGraph is a **preventive occupational
risk-stratification prototype**, not a medical device and not a
diagnosis. The triage output (`TriageResult`) flags red flags - stopped
sweating, vomiting, dizziness, cramps, dark urine - and routes the
worker to shade, cooling, oral rehydration and the on-site clinic or
emergency services. The Cumulative Thermal Strain Index is a prototype
score (red line 12), not a published clinical cutoff. A sick worker
needs a clinician; a high strain score is a reason to escalate, not a
diagnosis. Nothing in this repo is intended for clinical use, and no
clinical claim beyond the cited sources in
`clinical-evidence-brief.md` (repo root) is made.

## 7. Does ThermiGraph certify compliance - with the UAE Midday Break, NIOSH, OSHA, or ISO 7243?

No. ThermiGraph implements the NIOSH limits and the ISO 7243 WBGT
formula, and it models the UAE MOHRE Midday Break window (12:30-15:00,
15 June-15 September) as a recommended shade break - but implementing a
standard is not certifying compliance with it. Compliance depends on
real on-site measurements, real procedures, real training and real
records, none of which a weather estimate can provide. In November the
12:30-15:00 window in the prototype is a *recommendation*, not a claim
that the summer law applies in November. Do not present a ThermiGraph
screenshot or report as a compliance certificate.

## 8. What happens if Gemini is down, or there is no API key?

Nothing breaks. `run_field_triage()` in `triage.py` falls back to
`deterministic_triage_fallback()`, a rule-based parser that runs
locally, offline, with no key and no network. It extracts the same
fields (severity, symptoms, hydration, equipment friction, risk tier,
immediate action, Arabic and Hindi/Urdu broadcasts) from keywords in
the note and the current WBGT. The dashboard labels which engine
produced the result - "Gemini Structured GenAI (gemini-3.6-flash)" or
"Deterministic Clinical Fallback Engine (Offline / No-Key Mode)" - so a
judge can see exactly which path ran. All 10 dashboard sections stay
functional without a key; the live Gemini path only adds freer
language understanding, not a different decision structure. Note:
`gemini-2.5-flash` is retired and returns 404; `gemini-3.6-flash` is
the model that works live.
