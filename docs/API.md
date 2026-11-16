# ThermiGraph API Reference

Python modules at the repo root. All signatures below were read from the
actual files on 16 November 2026; nothing here is invented. Pure logic
lives in `dashboard_logic.py` and `physics_engine.py` with no Streamlit
imports, so it can be tested with plain pytest.

Live demo: https://chipper-halva-04403d.netlify.app/
Repo: https://github.com/alexowoade/thermigraph

> All WBGT values are weather-derived **estimates**, not calibrated meter
> readings. The Cumulative Thermal Strain Index is a **prototype score**,
> not a clinical threshold. Triage output is preventive occupational
> triage, not a medical diagnosis.

## `physics_engine.py` - Module 1, live WBGT estimate

Constants: `LATITUDE = 24.3613`, `LONGITUDE = 54.5038`, `PLACE = "Mussafah"`.
`NIOSH_LIMITS = {"Light": 30.0, "Moderate": 28.0, "Heavy": 26.0, "Very heavy": 25.0}`
(acclimatised workers, continuous work, NIOSH 2016-106).

### `wet_bulb_stull(temp_c: float, humidity: float) -> float`

Wet-bulb temperature in C by the Stull (2011) empirical formula. Humidity
is clamped to 5.0-99.9% inside the function.

Example:

```python
from physics_engine import wet_bulb_stull
wet_bulb_stull(38.0, 55.0)  # 30.2 C
```

### `estimate_wbgt(temp_c: float, humidity: float, solar_w_m2: float, wind_kmh: float = 10.0)`

Outdoor WBGT estimate in C. Returns a 3-tuple
`(wbgt, wet_bulb, black_globe)` - note the function has no return
annotation in the source. Formula: `WBGT = 0.7 * wet bulb + 0.2 * black
globe + 0.1 * dry bulb`. Black globe is `temp + min(18, solar * 0.02 *
(10 / max(wind, 2)) ** 0.35)`; at the reference wind of 10 km/h the wind
factor is 1.0, stagnant air raises the globe, higher wind cools it.

Example:

```python
from physics_engine import estimate_wbgt
wbgt, twb, tg = estimate_wbgt(38.0, 55.0, 800.0, 10.0)
```

### `niosh_check(wbgt: float)`

Returns a list of one string per workload, `OK` or `OVER LIMIT`, e.g.
`"  Heavy: OVER LIMIT (29.1 > 26)"`. Takes a single WBGT value.

Example:

```python
from physics_engine import niosh_check
niosh_check(29.1)
# ['  Light: OK (29.1 <= 30)', '  Moderate: OVER LIMIT (29.1 > 28)', ...]
```

## `strain_timeline.py` - Module 2, 6-day strain timeline

Constant: `RECOVERY_DEBT_NIGHT_MIN = 28.0` - a night minimum above 28 C
(hours 00:00-05:59) flags Nocturnal Recovery Debt. Window: past 3 days +
today + next 2 days, from Open-Meteo.

### `daily_points(max_wbgt, recovery_debt)`

Prototype points for one day. Returns an `int`: 3 points if max WBGT >
28, 2 if > 26, 1 if > 25, else 0, plus 1 if `recovery_debt` is true.
No type annotations in the source.

Example:

```python
from strain_timeline import daily_points
daily_points(29.0, True)  # 4
```

`main()` prints the 6-day timeline and the cumulative index; the red line
is cumulative >= 12. There is no other public function in this module -
the DataFrame version lives in `dashboard_logic.compute_timeline_and_strain`.

## `shift_optimizer.py` - Module 4, shift optimiser

### `work_rest(wbgt)`

Returns a 3-tuple `(work_minutes, rest_minutes, label)`: WBGT > 28 gives
`(0, 60, "NO OUTDOOR WORK")`; > 26 gives `(30, 30, "30 work / 30 rest")`;
> 25 gives `(45, 15, "45 work / 15 rest")`; otherwise
`(60, 0, "60 work / 0 rest")`. No type annotations in the source.

Example:

```python
from shift_optimizer import work_rest
work_rest(27.0)  # (30, 30, '30 work / 30 rest')
```

`main()` prints tomorrow's 06:00-17:00 plan: heavy labour 06:00-10:00,
Crew A / Crew B rotation, recommended shade break 12:30-15:00 (in
November this is a recommendation, not a claim that the UAE summer
Midday Break law applies in November).

## `triage.py` - Module 3, field-log triage

### `TriageResult` (Pydantic model)

Fields: `worker_summary` (anonymised one line), `symptom_severity`
(Low/Moderate/High/Critical), `symptoms` (list of str),
`hydration_status`, `equipment_friction`, `osha_risk_tier`
(Low/Medium/High/Critical with a reason), `immediate_action`,
`arabic_crew_alert`, `hindi_urdu_crew_alert`.

Preset notes: `SAMPLE_LOG` (Case 1) and `SCENARIO_PRESETS` (Cases 1-3).

### `redact_worker_name(summary_text: str, raw_note: str = "") -> str`

Hard privacy guard: replaces a detected personal name with
`[Worker - Anonymised]`, using a leading-name pattern, a
`worker:`/`name:`/`patient:` label pattern, and a common-name list
(Ahmed, Ramesh, Bilal, Mohammed, Mohammad, Ali, Suresh, Tariq, Ravi,
Kumar, Singh, Hassan). If no marker is found it prefixes the summary
with `[Worker - Anonymised] — `.

Example:

```python
from triage import redact_worker_name
redact_worker_name("Ahmed, 34, concrete crew", "Ahmed, 34, concrete crew Mussafah")
# '[Worker - Anonymised], 34, concrete crew'
```

### `deterministic_triage_fallback(note: str, wbgt_c: float = 28.5) -> TriageResult`

Rule-based parser, no API key, no network. Severity: Critical if a red
flag (sweating stopped, vomit, faint, collapse, confusion) or WBGT >=
30; High if cramps/dark urine/dizziness or WBGT >= 27.5; otherwise
Moderate. Always returns a `TriageResult` with Arabic and romanized
Hindi/Urdu crew broadcasts.

Example:

```python
from triage import deterministic_triage_fallback
r = deterministic_triage_fallback("Worker dizzy, sweating stopped, vomited once", 29.2)
r.symptom_severity  # 'Critical'
```

### `run_field_triage(note: str, wbgt_c: float = 28.5, spike_c: float = 0.0, api_key: str | None = None) -> tuple[TriageResult, str]`

Runs Gemini structured triage if `api_key` is given, otherwise the
deterministic fallback. Returns `(result, engine_mode)` where
`engine_mode` is e.g. `"Gemini Structured GenAI (gemini-3.6-flash)"`,
`"Deterministic Clinical Fallback Engine (Offline / No-Key Mode)"` or
`"... (API Fallback)"`. With a key it tries `gemini-3.6-flash` then
`gemini-2.5-flash` (note: 2.5-flash is retired and 404s in practice;
3.6-flash is the working model) and falls back on any failure. The
returned summary is passed through `redact_worker_name()`.

Example:

```python
from triage import run_field_triage, SAMPLE_LOG
result, mode = run_field_triage(SAMPLE_LOG, wbgt_c=29.2, spike_c=4.0)
result.symptom_severity, mode
```

## `dashboard_logic.py` - pure dashboard logic (no Streamlit imports)

### `compute_timeline_and_strain(hourly: dict, spike_c: float)`

Computes hourly WBGT chart data and the Module 2 daily strain table from
an Open-Meteo `hourly` dict. Returns
`(chart_df, daily_df, cumulative, debt_days_count)` - two pandas
DataFrames, the cumulative strain index (int) and the count of recovery-
debt days. `hourly` needs `time`, `temperature_2m`,
`relative_humidity_2m`, `shortwave_radiation` and (optionally)
`wind_speed_10m` (defaults to 10.0).

Example:

```python
from dashboard_logic import compute_timeline_and_strain
chart, daily, cumulative, debt_days = compute_timeline_and_strain(hourly, spike_c=5.0)
```

### `compute_shift_schedule(hourly: dict, spike_c: float)`

Computes tomorrow's shift schedule (06:00-17:00) and prevention KPIs.
Returns `(tomorrow_text, schedule_df, unsafe_heavy_hours_prevented,
total_cooling_rest_minutes)`. Tomorrow is the 5th day in the hourly
window when available, otherwise today + 1 day. Hours 13:00-14:59 are
the shade break.

Example:

```python
from dashboard_logic import compute_shift_schedule
tomorrow, schedule, prevented, rest_mins = compute_shift_schedule(hourly, spike_c=0.0)
```

### `compute_compare_sites(site_hourly: dict, spike_c: float = 0.0, site_current_wbgt: dict | None = None)`

Builds the global compare-sites table. `site_hourly` maps a site display
name to its Open-Meteo hourly dict; `site_current_wbgt` maps a site name
to its live current WBGT (required for a correct "Current WBGT" column -
without it the function falls back to the middle hour of the window).
Returns a DataFrame with one row per site: `Site`, `Current WBGT (C)`,
`6-Day Max WBGT (C)`, `Debt Days` ("n / 6"), `Risk Tier`
(Low/Moderate/High/Critical, thresholds 25/26/28 C on 6-day max).

Example:

```python
from dashboard_logic import compute_compare_sites
table = compute_compare_sites({"Mussafah": mussafah_hourly, "Lagos": lagos_hourly},
                              site_current_wbgt={"Mussafah": 22.1, "Lagos": 27.4})
```

### `cost_of_inaction(workers: int, days: int, wbgt_c: float)`

Transparent cost-of-inaction **estimator** (labelled estimate, not
epidemiology). Model, from the docstring: excess WBGT above the 26 C
heavy-work limit drives heat-exhaustion incidence at 0.3 cases per 1,000
workers per day per degree of excess; about 8% escalate to
hospitalisation; $400 per case, $4,000 per hospitalisation; the enforced
rest schedule is assumed to cut cases by 65%. Returns a dict with
`excess_wbgt_c`, `projected_cases`, `projected_hospitalisations`,
`projected_cost_usd`, `cases_prevented`, `cost_prevented_usd`.

Example:

```python
from dashboard_logic import cost_of_inaction
cost_of_inaction(1500, 5, 31.0)
# {'excess_wbgt_c': 5.0, 'projected_cases': 11.2, 'projected_hospitalisations': 0.9,
#  'projected_cost_usd': 8100.0, 'cases_prevented': 7.3, 'cost_prevented_usd': 5265.0}
```

### `wbgt_iso_cross_check(twb_c: float, tg_c: float, tdb_c: float)`

Cross-checks ThermiGraph WBGT against `pythermalcomfort` (ISO 7243,
outdoor formula, `with_solar_load=True`). Returns
`(iso_wbgt_or_None, available_bool)` - `(None, False)` if
`pythermalcomfort` is not installed or the call fails. The caller shows
a graceful note in that case.

Example:

```python
from dashboard_logic import wbgt_iso_cross_check
iso_wbgt, available = wbgt_iso_cross_check(30.5, 44.0, 38.0)
```

## Tests

- `test_thermigraph.py`: 15 tests (Stull bounds, wind cooling, NIOSH
  limits, recovery debt, shift rules, redaction, offline fallback,
  dashboard integration, compare-sites, cost model, ISO cross-check).
- `test_validation.py`: 8 tests (known Stull value, WBGT weights, live
  Mussafah estimate, NIOSH limits, work/rest ratios, daily points,
  recovery-debt threshold, `TriageResult` model).

Run: `pytest -v`
