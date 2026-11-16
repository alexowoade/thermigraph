# ThermiGraph vs commercial heat-stress tools

Date: 16 November 2026. Prices checked 16 November 2026; prices change, so
re-check before quoting a price to anyone. Where a price could not be verified
from a seller or manufacturer page, it is marked "approx, unverified" or omitted.

## The one sentence that matters

**ThermiGraph is a weather-derived WBGT estimate, not a meter replacement,
not a diagnosis, and not a compliance certificate.** It estimates WBGT from
Open-Meteo temperature, humidity, wind and solar radiation (Stull wet bulb +
wind-adjusted black-globe approximation). A high-risk safety decision needs a
calibrated on-site WBGT meter, and a sick worker needs a clinician, not a
dashboard. ThermiGraph's job is earlier, cheaper, wider coverage: forecast,
multi-day strain, shift planning and field-note triage before anyone is on
site with a meter.

## At a glance

| Tool | What it measures | Price (checked 2026-11-16) | Needs hardware? | Multi-day strain? | Shift plan? | Field-note triage? |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **ThermiGraph (this repo)** | WBGT *estimate* from weather data; NIOSH limits; 6-day strain | Free / open prototype; no API key for weather; optional Gemini key for live triage | No | Yes, 6-day Cumulative Thermal Strain Index (prototype score, red line 12) | Yes, work/rest + Crew A/B rotation | Yes, Gemini or offline deterministic fallback, EN/AR/HI-UR broadcasts |
| Kestrel 5400 Heat Stress Tracker | Measured WBGT, TWL, heat index, globe, wet bulb, wind, etc. (15 measurements) | **$549 USD** (Forestry Suppliers / GlobalTestSupply sale price; $553.95 Magid, $565 National Firefighter; list $686) | Yes, handheld meter | No | No (gives readings; supervisor decides) | No |
| Extech HT30 Heat Stress WBGT Meter | Measured WBGT, black globe, air temp, humidity, heat index | **$219 USD** list (extech.com); $199.99 at Northern Tool | Yes, handheld meter | No | No | No |
| TSI QUESTemp 34 (QT-34) | Measured WBGT (area monitor, sensor bar + globe), wet/dry bulb, humidity, heat index | **$3,940 USD** (alkaline battery, 1 sensor bar, 2-inch globe, Bomark Instruments); $4,475 with 6-inch globe; $6,615 with 3 sensor bars | Yes, area monitor | No (logs readings; no strain score) | No | No |
| UAE MOHRE Midday Break | A *rule*, not a device: no outdoor work in direct sun 12:30-15:00, 15 June-15 September | No price (law) | No | No | No, it is a fixed time window, not WBGT-based | No |
| OSHA-NIOSH Heat Safety Tool app | Heat index (real-time + hourly forecast) for a location; OSHA/NIOSH precautions | **Free** (CDC/NIOSH) | No | No | Hourly forecast only, no crew rotation | No (lists symptoms/first aid) |
| NIOSH / OSHA calculators (web) | NIOSH REL/RAL work limits; OSHA heat-index guidance | Free (public guidance) | No | No | No | No |

Sources for prices:

- Kestrel 5400, $549: https://www.forestry-suppliers.com/p/89652/48221/kestrel-5400-heat-stress-tracker?layout=standard and https://www.globaltestsupply.com/category/humidity-heat-stress-meters/sort:ProductProperties.inventory/direction:desc (sale $549, regular $686). Also $553.95: https://www.magidglove.com/kestrel-5400-heat-stress-tracker-k-0854ora ; $565: https://www.nationalfirefighter.com/store/p/4394-Kestrel-5400-Heat-Stress-Tracker.aspx
- Extech HT30, $219: https://www.extech.com/products/ht30/?vertical=condition+monitoring&segment=solutions ; $199.99: https://www.northerntool.com/products/extech-instruments-heat-stress-monitor-model-ht30-163942
- TSI QUESTemp 34, $3,940: https://www.bomarkinstruments.com/product/questemp-34-alkaline-battery-includes-standard-accessories-1-sensor-bar-assembly-and-2-inch-style-globe-sensor/
- OSHA-NIOSH Heat Safety Tool, free, and note that CDC says the app "is not receiving updates at this time": https://www.cdc.gov/niosh/heat-stress/communication-resources/app.html
- MOHRE Midday Break, 12:30-15:00, 15 June-15 September, Ministerial Resolution No. 44 of 2022: https://triuneme.com/is-the-uae-midday-break-enough/ and https://www.rostiko.com/blog/uae-labour-law-for-employers . Fine figures (AED 5,000 per worker, up to AED 50,000) are reported by secondary sources only and were **not** verified against an official MOHRE page in this check; do not quote them as official.

## Kestrel 5400

What it does well: a real, calibrated, handheld WBGT measurement at the
exact spot and moment, plus Thermal Work Limit (TWL), heat index, globe and
wet-bulb temperatures, wind and 15 measurements in total. It is the reference
a safety officer trusts on site.

What it does not do: it measures *now, here*. It does not forecast tomorrow,
does not add up strain over 6 days, does not plan a crew rotation, and does
not read a supervisor's field note. One meter covers one spot; a site with
three zones needs three meters (or one meter carried between them), plus
calibration and batteries.

ThermiGraph vs Kestrel: complementary, not competing. ThermiGraph plans the
day and flags the week; the Kestrel verifies the reading on the ground.
ThermiGraph never claims the Kestrel's accuracy.

## Extech HT30

What it does well: a compact, cheaper handheld WBGT meter (WBGT 0-50 C,
black globe 0-80 C, in/out sun function, RS-232 interface). Good for a
single-point spot check.

What it does not do: same limits as the Kestrel at a smaller scale - one
spot, one moment, no forecast, no strain timeline, no shift plan, no triage,
no multi-site comparison. Accuracy is lower than a full area monitor
(WBGT +/- 2 C per the manufacturer's specification summary).

ThermiGraph vs HT30: ThermiGraph covers every site and the next 2 days for
free; the HT30 gives a real reading at one point for about $200-219.

## TSI QUESTemp 34

What it does well: an area heat-stress monitor - the most accurate portable
option in this list, with a sensor bar and globe, data logging, and (with
extra sensor bars) multi-point WBGT. The standard for a fixed monitoring
station.

What it does not do: it costs about $3,940 for the base unit (more with
extra sensors), needs wick/sensor maintenance and periodic calibration
(standard calibration listed at $375 by the same seller), and still only
measures where it sits. No forecast, strain score, shift optimiser or
triage.

ThermiGraph vs QUESTemp 34: a QUESTemp 34 is the instrument you would use
to *validate* ThermiGraph's estimate at a site. ThermiGraph is the layer
that turns readings (real or estimated) into a plan.

## UAE MOHRE Midday Break

MOHRE is the UAE Ministry of Human Resources and Emiratisation. (Not
"MOHAWK" - that spelling is wrong; do not use it.) Its Midday Break bans
work directly under the sun in open places from **12:30 to 15:00 every day
from 15 June to 15 September** (Ministerial Resolution No. 44 of 2022).
It is time-based only: it has no temperature or WBGT trigger, and it does
not cover May, October, or a hot November day.

ThermiGraph models the same 12:30-15:00 window year-round as a *recommended
shade break* in the prototype (`shift_optimizer.py`), and says so plainly:
in November it is a recommendation, not a claim that the summer law applies
in November. ThermiGraph adds what the rule cannot: WBGT-based work/rest
ratios (45/15, 30/30, stop above 28 C) for the hours outside the break, and
a 6-day view so a crew is not sent out on day 4 already in debt.

ThermiGraph does **not** certify compliance with the Midday Break or with
any labour law. It is not a compliance certificate.

## NIOSH / OSHA apps and calculators

- **OSHA-NIOSH Heat Safety Tool app** (free, iOS/Android): real-time heat
  index and hourly forecast for the user's location, with OSHA/NIOSH
  precautions, symptoms and first aid. It is heat-index based, not WBGT
  based; NIOSH itself recommends WBGT for exposure limits. CDC notes the
  app is not receiving updates at this time (checked 2026-11-16).
- **NIOSH Criteria 2016-106**: the WBGT Recommended Exposure Limits (RELs)
  ThermiGraph implements (Light 30 C, Moderate 28 C, Heavy 26 C, Very heavy
  25 C, acclimatised, continuous work). A calculator gives a limit; it does
  not run a site.
- **OSHA heat guidance / General Duty Clause**: enforcement and guidance,
  not a live tool.

ThermiGraph vs these: ThermiGraph *uses* the NIOSH limits (same numbers,
same source) but adds a WBGT estimate where no meter exists, a 6-day strain
timeline, a shift plan, multi-site comparison and multilingual triage.
It does not replace NIOSH/OSHA guidance and does not claim OSHA compliance.

## What ThermiGraph is, and is not

- **Is:** a free prototype planning layer - live WBGT estimate, 6-day
  cumulative strain, work/rest shift plan, multilingual field-note triage,
  multi-site comparison, cost-of-inaction estimate. All labelled as
  estimates in the code and the dashboard.
- **Is not:** a calibrated meter, a medical device, a diagnosis, a
  compliance certificate, or proof that a real crew was protected. No real
  pilot, real meter reading, or real patient is claimed anywhere in this
  repo. See `../clinical-evidence-brief.md` (repo root) for exactly what
  the evidence does and does not prove.
- **The honest combination:** use ThermiGraph to plan and to flag risk
  early, and use a calibrated meter (Kestrel, Extech, QUESTemp or
  equivalent) to verify on site before a high-risk decision.
