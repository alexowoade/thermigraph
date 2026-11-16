# Contributing to ThermiGraph

Thank you for considering a contribution. ThermiGraph is a prototype
for the Future Health Digital Innovation Challenge 2026, Population
Health track. It is a planning and triage tool, not a medical device
and not a compliance certificate - please keep every contribution
inside that boundary.

## Setup

```bash
git clone https://github.com/alexowoade/thermigraph.git
cd thermigraph
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
```

Then edit `.env` and add your own Gemini key:

```
GEMINI_API_KEY=<redacted>
```

Never commit `.env`. Never paste a real key into an issue, a PR, or
chat. On Streamlit Cloud, set `GEMINI_API_KEY` under App Settings >
Secrets instead of using a file. Without a key the app still works:
`triage.py` falls back to the deterministic offline engine.

Run the app:

```bash
streamlit run dashboard.py
```

## Tests

```bash
pytest -v
```

There are 15 tests in `test_thermigraph.py` and 8 validation tests in
`test_validation.py`. Run the full suite before opening a PR, and add
a test for any change to physics, strain, shift rules, triage or the
cost model. A PR that changes a number without a test will be asked
for one.

Individual modules can be checked directly:

```bash
python3 physics_engine.py
python3 strain_timeline.py
python3 shift_optimizer.py
python3 triage.py
```

## Code style

- **Type hints and docstrings** on every new public function. Existing
  functions that lack annotations should gain them when you touch
  them; do not reformat unrelated files in the same PR.
- **Keep pure logic in `dashboard_logic.py` and `physics_engine.py`.**
  No Streamlit imports in those files - that is what makes them
  unit-testable with plain pytest. UI code belongs in `dashboard.py`.
- Keep the prototype labels honest: WBGT values are estimates, the
  strain index is a prototype score, triage is not a diagnosis. Do not
  remove or soften a limitation label to make a result look stronger.
- No real names, no real worker data, no real patient data, ever. Demo
  scenarios use scripted names so `redact_worker_name()` can be shown
  working.
- Python style: readable over clever. Follow the existing file layout;
  do not introduce a new framework or dependency without saying why in
  the PR description.

## Pull requests

1. Fork the repo and create a branch from `main` with a descriptive
   name (for example `fix/wbgt-wind-factor`).
2. Make one focused change per PR. Small PRs are reviewed faster.
3. Run `pytest -v` and paste the result in the PR description.
4. Update the docs if your change affects them: `docs/API.md` for a
   signature change, `docs/FAQ.md` for a behaviour change a user
   would notice, and the clinical evidence brief (see below) for a
   clinical change.
5. Open the PR against `main` and describe: what changed, why, how
   you tested it, and what you did *not* change.

## Clinical claims rule

This is the most important rule in this file.

**Any change to physics, triage, or NIOSH thresholds needs an evidence
brief update.** That means:

- A change to the WBGT formula, the Stull wet-bulb calculation, the
  black-globe approximation, or the wind adjustment in
  `physics_engine.py`.
- A change to the NIOSH limits, the work/rest ratios in
  `shift_optimizer.py` (`work_rest()`), the recovery-debt threshold
  (28 C) or the strain points / red line (12) in `strain_timeline.py`.
- A change to triage severity, risk tiers, or the immediate-action
  wording in `triage.py`.

For such a change, update `clinical-evidence-brief.md` (repo root) in
the same PR: cite the source (author, year, journal/standard, DOI or
publication number), state what the source proves and what it does
not prove, and update the validation tests. A claim without a cited
source will not be merged. Do not invent an expert quote, a reviewer,
a pilot, or a real user to support a change.

## Code of conduct

Please read `CODE_OF_CONDUCT.md`. Be kind, be precise, and do not
present demo, saved, or estimated data as a live result.
