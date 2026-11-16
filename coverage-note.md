# Coverage note (2026-11-16)

Measured with `~/.venvs/tg-venv/bin/python -m pytest --cov=. --cov-report=term-missing -q`
in `~/workspace/thermigraph/`. 26 tests passed, 0 failed.

## Measured numbers

| Module | Statements | Missed | Coverage |
| --- | --- | --- | --- |
| bench.py | 14 | 14 | 0% |
| dashboard.py | 316 | 316 | 0% |
| dashboard_logic.py | 129 | 7 | 95% |
| fetch_mussafah.py | 12 | 12 | 0% |
| physics_engine.py | 57 | 27 | 53% |
| shift_optimizer.py | 55 | 39 | 29% |
| strain_timeline.py | 70 | 50 | 29% |
| test_thermigraph.py | 145 | 0 | 100% |
| test_validation.py | 67 | 15 | 78% |
| triage.py | 121 | 39 | 68% |
| **TOTAL** | **986** | **519** | **47%** |

## Modules below 60%

- **bench.py (0%)** — benchmark script, not imported by tests. Expected.
- **dashboard.py (0%)** — the Streamlit app itself; not imported by tests
  (tests cover `dashboard_logic.py` instead, which is at 95%).
- **fetch_mussafah.py (0%)** — live-network fetch script, not imported by tests.
- **physics_engine.py (53%)** — the uncovered lines (92-128) are `main()`,
  the live Open-Meteo fetch/print path, which tests deliberately do not run.
  The pure functions (`wet_bulb_stull`, `estimate_wbgt`, `niosh_check`)
  are covered.
- **shift_optimizer.py (29%)** — only `work_rest` is exercised; the shift
  schedule builders (lines 41-92, 96) have no direct unit tests.
- **strain_timeline.py (29%)** — only `daily_points` is exercised directly;
  the timeline builders (lines 42-107, 111) have no direct unit tests.

## No badge

No coverage badge is claimed: total measured coverage is 47% with
`--cov=.`, which includes the Streamlit app, benchmark and fetch scripts
that tests intentionally do not execute. The core logic module
(`dashboard_logic.py`) is at 95%.
