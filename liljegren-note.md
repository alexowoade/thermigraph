# Liljegren method — note (2026-11-16)

## What was checked

- `pythermalcomfort` 4.8.1 is installed in the test venv (`~/.venvs/tg-venv`).
  It is NOT installed in the system `python3` on this VM.
- Its `models.wbgt` signature, read from the installed package:
  `wbgt(twb, tg, tdb=None, with_solar_load=False, round_output=True) -> WBGT`.
  It takes a wet-bulb temperature as an **input** and returns the ISO 7243
  weighted sum (0.7 Twb + 0.2 Tg + 0.1 Tdb with solar load). This matches the
  usage already in `dashboard_logic.py::wbgt_iso_cross_check`, which passes
  `twb=`, `tg=`, `tdb=` with `with_solar_load=True`. That cross-check test
  (`test_iso_cross_check_agrees_with_thermigraph`) passes locally.
- Its `psychrometrics.wet_bulb_tmp(tdb, rh)` exists, but its docstring says
  it calculates "the wet-bulb temperature using the Stull equation
  [Stull2011]". Verified numerically: `wet_bulb_tmp(tdb=35, rh=50)` =
  26.595, identical to `wet_bulb_stull(35, 50)` = 26.595.

## Why no `method="liljegren"` was added

The Liljegren et al. (2008) method is a full iterative energy-balance model
that computes natural wet-bulb and globe temperature from air temperature,
humidity, wind and solar radiation. `pythermalcomfort` does **not** expose
such a function: its `wbgt()` needs the wet bulb supplied, and its only
wet-bulb-from-(T, RH) function is Stull again. Adding a `method="liljegren"`
option backed by `wet_bulb_tmp` would just compare Stull to Stull and fake
an independent method, so it was not added. Implementing Liljegren 2008
from scratch was out of scope here: it would need verification against
published reference values before it could be trusted.

## Why this wasn't shipped

pythermalcomfort's `wbgt()` takes natural wet bulb as input, and its wet-bulb
helper uses Stull. A `method="liljegren"` flag routed through that function
would compute Stull wet bulb, apply the same 0.7/0.2/0.1 weighting, and label
the result "Liljegren" — a name on top of unchanged behavior. That is the same
class of mistake as substituting a wrong product in a procurement pipeline:
plausible on the surface, false underneath.

A correct implementation is 4–8 hours and requires either a library that
implements the Liljegren heat-balance solver (`thermofeel`, `pywbgt` — not yet
verified) or a hand-written iterative solver tested against the published
reference outputs. It is listed as Future work. Until then, the README labels
the WBGT as a prototype simplification of Liljegren, which is accurate.

## Current state

- Stull (2011) remains the only wet-bulb method in `estimate_wbgt()`.
- No `test_liljegren_agrees_with_stull_within_2c` test was added, for the
  reason above.
- The ISO 7243 cross-check via `pythermalcomfort.models.wbgt` in
  `dashboard_logic.py` is unchanged and passing.
