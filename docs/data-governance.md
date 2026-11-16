# ThermiGraph - Data Governance

Date: 16 November 2026. Prototype stage, Future Health Digital Innovation
Challenge 2026, Population Health track.

## Short version

- **No persistent storage.** ThermiGraph does not save worker notes, triage
  results, names, or health data to disk, a database, or a cloud store.
  Field notes are processed in memory for the current session only and are
  not written to a file by the app. (The compliance report the dashboard
  can export contains anonymised crew-level figures, not worker names.)
- **No real worker data.** All field notes in the demo are scripted
  scenarios (Cases 1-3 in `triage.py`). No real crew, no real shift, and no
  real patient is claimed.
- **Names are redacted before display.** `redact_worker_name()` in
  `triage.py` replaces personal names with `[Worker - Anonymised]`.
- **Crews are anonymised.** Shift planning uses `Crew A` and `Crew B`
  only, never individual names.
- **Gemini sees the note only as part of an API request** when a key is
  present and live triage is used. There is no other third party.
- **No API keys are committed.** `GEMINI_API_KEY` lives in a local `.env`
  (see `.env.example`) or in Streamlit secrets, never in the repo.

## What data flows where

| Data | Source | Where it goes | Stored? |
| :--- | :--- | :--- | :--- |
| Weather (temp, humidity, wind, solar) | Open-Meteo API, free, no key (`https://api.open-meteo.com/v1/forecast`) | In-memory, per request, for Mussafah / KEZAD / Ruwais / Lagos / Delhi / Houston or a custom GPS | No |
| Field note (typed or preset scenario) | Supervisor typing in the dashboard, or a preset in `triage.py` | In-memory to the triage engine (Gemini if a key is set, otherwise the deterministic fallback in the same process) | No |
| Triage result (severity, symptoms, tier, action, broadcasts) | `triage.py` (`TriageResult`) | Displayed in the dashboard for the current session; included in the exportable compliance report only in anonymised form | No, except if the user downloads the report themselves |
| Worker name | The field note, if the supervisor typed one | Replaced by `redact_worker_name()` with `[Worker - Anonymised]` before the summary is shown | No |
| Crew assignment | `shift_optimizer.py` / `dashboard_logic.py` | `Crew A` / `Crew B` labels only | No |
| Gemini API key | Local `.env` or Streamlit secrets | Sent only to Google's Gemini API as the credential for the request | Never committed; `.env` is git-ignored |
| Site / GPS chosen by the user | Dashboard selector | Sent to Open-Meteo as latitude/longitude for that request | No |

## Name redaction - `redact_worker_name()`

In `triage.py`:

```python
redact_worker_name(summary_text: str, raw_note: str = "") -> str
```

It detects a leading name in the raw note (for example `Ahmed, 34` or
`Ramesh, 41`), or a name after a label such as `worker:` / `name:` /
`patient:`, and replaces it with `[Worker - Anonymised]`. A common-name
list (Ahmed, Ramesh, Bilal, Mohammed, Mohammad, Ali, Suresh, Tariq, Ravi,
Kumar, Singh, Hassan) is applied case-insensitively as a second line of
defence. If no name marker is found, the function prefixes the summary
with `[Worker - Anonymised] — ` so the output is never shown with an
unredacted name in the summary field.

Limits, stated honestly: this is regex redaction of the *summary*, not a
guarantee that no name can appear anywhere in free text. A supervisor who
pastes a name into a note in an unusual form may see it in the raw-note
echo. Do not paste real names into the demo. The demo scenarios use
scripted names (Ahmed, Ramesh, Bilal) precisely so the redaction can be
shown working.

## Crew anonymisation

Shift planning never uses individual names. `shift_optimizer.py` and
`dashboard_logic.py` assign only `Crew A` and `Crew B` (for example
"Crew A (Heavy Labour Window)", "Crew B (Afternoon Light Rotation)").
The cost-of-inaction model (`cost_of_inaction()` in `dashboard_logic.py`)
works on headcounts, not people.

## Gemini and third parties

- When `GEMINI_API_KEY` is set, `run_field_triage()` in `triage.py` sends
  the field note to Google's Gemini API (models tried in order:
  `gemini-3.6-flash`, then `gemini-2.5-flash`) as part of that API request,
  with a prompt that instructs the model to replace names with
  `[Worker - Anonymised]` and not to diagnose a disease. The note is
  processed by Google under the terms of the Gemini API account in use;
  ThermiGraph does not add any other recipient.
- When no key is set, or the API call fails, the deterministic fallback
  (`deterministic_triage_fallback()`) runs locally in the same process.
  No note leaves the machine in fallback mode.
- **No other third party receives any data.** Open-Meteo receives only
  latitude/longitude and the requested weather variables. No analytics,
  no tracking, no advertising SDK is in this repo.

## No persistent storage - what that means in practice

- There is no database, no user account, no login, and no server-side
  store in this prototype.
- Closing the browser tab ends the session; nothing about the field note
  is kept by the app.
- The only file the dashboard writes is the compliance report
  (`thermigraph-compliance-report.txt`), and only when the user clicks to
  export it. That report contains anonymised, crew-level figures.
- Logs: Streamlit/Netlify hosting logs (if the hosted demo is used) are
  the hosting provider's standard request logs, not a ThermiGraph store.
  Do not paste real personal data into the hosted demo.

## Retention

Because nothing is stored, there is nothing to retain or delete on a
schedule. If a future version adds storage, this document must be updated
first, with a named store, a retention period, and a deletion route.

## Clinical evidence

The evidence behind the WBGT formula, NIOSH limits, ISO 7243 and the
multi-day AKI claim is in the brief at the repo root:

`clinical-evidence-brief.md` (repo root, **not** `docs/`)

That brief states what the evidence proves and what it does not prove.
In particular: the WBGT value is a weather-derived estimate, not a meter
reading; triage is preventive occupational triage, not a medical
diagnosis; and the Cumulative Thermal Strain Index red line (12) is a
prototype score, not a published clinical cutoff.

## Contact

Data-governance questions: [your email]

Replace `[your email]` with a real contact address before publishing.
No email address is invented here.
