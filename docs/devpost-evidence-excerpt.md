# Devpost paste-ready excerpt - "Clinical evidence" section

Copy the text below into the Devpost project story under a
"Clinical evidence" heading. Do not add a quote, a reviewer, a pilot,
or a real user - none is claimed.

---

## Clinical evidence

ThermiGraph is a prototype. Its evidence is published sources plus
passing tests - not a meter reading, not a diagnosis, and not a real
pilot. The full brief is in the repo at `clinical-evidence-brief.md`
(repo root).

### What it proves

- **The WBGT formula is the international standard formula.**
  Outdoor WBGT = 0.7 x natural wet bulb + 0.2 x black globe + 0.1 x dry
  bulb (ISO 7243). Source: Liljegren, J.C., Carhart, R.A., Lawday, P.,
  Tschopp, S., and Sharp, R. "Modeling the wet bulb globe temperature
  using standard meteorological measurements." *Journal of Occupational
  and Environmental Hygiene*, 2008, 5(10), 645-655.
  doi:10.1080/15459620802310770
- **The work limits match NIOSH 2016.** Recommended Exposure Limits,
  acclimatised workers, continuous work: Light 30 C, Moderate 28 C,
  Heavy 26 C, Very heavy 25 C. Source: NIOSH Criteria for a Recommended
  Standard: Occupational Exposure to Heat and Hot Environments, NIOSH
  Publication No. 2016-106.
- **The multi-day AKI claim is supported by peer-reviewed field
  studies.** In a study of 192 farmworkers in Florida summer heat, 53%
  started the workday dehydrated, 81% were dehydrated after a day of
  work, and one third had acute kidney injury at least once during the
  three summer workdays monitored; the odds of AKI increased 47% for
  each 5-degree increase in heat index. Source: "Heat Exposure, Rest
  Breaks, Dehydration, and Heat-Related Illness Among Agricultural
  Workers in Florida Summer Heat." *Journal of Health Care for the Poor
  and Underserved*, 2025, 36(2), 590-604. doi:10.1353/hpu.2025.a959115
- **The code passes its tests.** 15 pytest tests in
  `test_thermigraph.py` (Stull bounds, wind cooling, NIOSH limits,
  recovery debt, shift rules, name redaction, offline fallback,
  dashboard integration, compare-sites, cost model, ISO cross-check)
  plus 8 validation tests in `test_validation.py` (known Stull value,
  WBGT 0.7/0.2/0.1 weights, live Mussafah estimate, NIOSH limits,
  work/rest ratios, daily points, recovery-debt threshold,
  `TriageResult` model). Run them with `pytest -v`.

### What it does NOT prove

- **Not equal to a calibrated meter.** WBGT here is estimated from
  Open-Meteo weather data (Stull wet bulb; black globe approximated
  from solar radiation with a wind adjustment). It is not a reading
  from a calibrated on-site globe thermometer, and it does not capture
  local radiant heat from asphalt, furnaces or enclosed machinery.
- **Not a diagnosis.** Triage output is preventive occupational
  triage, not a medical diagnosis. The Cumulative Thermal Strain Index
  (red line 12) is a prototype score, not a published clinical cutoff.
- **No real pilot is claimed.** No real crew, no real shift, no real
  meter reading and no expert reviewer are claimed. The brief's
  expert-review section is intentionally blank, to be completed only
  by a real reviewer with name, qualification, organisation and date.

---

End of excerpt. Full brief: `clinical-evidence-brief.md` at the repo root.
