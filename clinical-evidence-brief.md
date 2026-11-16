# ThermiGraph AI - Clinical Evidence Brief
Prototype stage, Future Health Digital Innovation Challenge
Date: 16 November 2026
Status: Evidence brief, not a medical diagnosis and not a safety certification.

## What this brief proves, and what it does not

Proves:
- The WBGT formula used is the international standard formula.
- The work limits used match NIOSH 2016.
- The multi-day AKI claim is supported by peer-reviewed field studies.
- The code passes the validation tests listed below.

Does NOT prove:
- That the weather-derived WBGT estimate equals a calibrated on-site meter reading.
- That the triage output is a medical diagnosis.
- That a real crew was protected in a real shift. No real pilot is claimed here.

## 1. WBGT formula

Outdoors, in direct sun:
WBGT = 0.7 x natural wet bulb + 0.2 x black globe + 0.1 x dry bulb

In shade or indoors:
WBGT = 0.7 x natural wet bulb + 0.3 x black globe

Source: Liljegren, J.C., Carhart, R.A., Lawday, P., Tschopp, S., and Sharp, R.
Modeling the wet bulb globe temperature using standard meteorological
measurements. Journal of Occupational and Environmental Hygiene,
2008, 5(10), 645-655. doi:10.1080/15459620802310770

Liljegren et al. (2008) is a physically based model, based on standard
meteorological data, well calibrated and validated. It solves the heat
balance of the globe and the wet bulb, rather than curve fitting a
simple approximation.

ThermiGraph v1 uses a prototype simplification of this model:
wet bulb by the Stull formula, black globe estimated from solar
radiation as air temperature + solar x 0.02. This is labelled in the
code and in the dashboard as a prototype estimate, not a meter reading.
A full Liljegren iterative implementation was checked on 2026-11-16 and NOT added: pythermalcomfort `wbgt()` takes wet bulb as an input, and its only wet-bulb-from-(temperature, humidity) function is documented as Stull, so a Liljegren method backed by it would be Stull-vs-Stull, not a real Liljegren model. See `liljegren-note.md`. Stull remains the only method, and that is stated here rather than claimed otherwise.

## 2. Work limits

NIOSH Criteria for a Recommended Standard: Occupational Exposure to
Heat and Hot Environments, NIOSH Publication No. 2016-106.

Recommended Exposure Limits, acclimatised workers, continuous work:
- Light, under 180 W: 30 C
- Moderate, 180-300 W: 28 C
- Heavy, 300-415 W: 26 C
- Very heavy, over 415 W: 25 C

Unacclimatised workers are 2-3 C lower. As WBGT rises above the
limit, NIOSH prescribes work/rest scheduling, 45 work / 15 rest,
then 30 / 30, then 15 / 45, then stop. ThermiGraph uses the
acclimatised limits above, and the 45/15 and 30/30 steps.

## 3. ISO 7243

ISO 7243, Hot environments - Estimation of the heat stress on working
man, based on the WBGT index, first published 1982.

Review: Parsons, K. ISO 7243 and its Global Application.
Industrial Health, 2006, 44, 368-379.
The standard, and the WBGT index, has validity, reliability and
usability. It is limited by estimating metabolic heat and the
effects of clothing.

ThermiGraph follows ISO 7243 for the WBGT index and for the
reference values. Clothing adjustment IS now modelled, simplified, from 2026-11-16: effective WBGT = raw WBGT + correction, light civilian 0, coveralls +1, construction PPE +2, impermeable suit +4 C (ISO 7243 Annex C, simplified). Heavier PPE raises effective WBGT. Acclimatisation, age, and medical history are still not modelled.

## 4. Multi-day cumulative strain and kidney injury

Claim in ThermiGraph: heat stroke and acute kidney injury come
from multi-day cumulative strain, not a single hot afternoon.

Field evidence:
- In a study of 192 farmworkers in Florida summer heat, over half
  (53%) started the workday dehydrated, 81% were dehydrated after
  a day of work, and one third had acute kidney injury at least
  once during the three summer workdays monitored. The odds of AKI
  increased 47% for each 5 degree increase in heat index.
  Heat damage may be cumulative over time. A study of fernery
  workers found AKI prevalence increased from 21% to 43% over
  three years.
  Source: Heat Exposure, Rest Breaks, Dehydration, and Heat-Related
  Illness Among Agricultural Workers in Florida Summer Heat.
  Journal of Health Care for the Poor and Underserved, 2025,
  36(2), 590-604. doi:10.1353/hpu.2025.a959115

- Repeated subclinical heat stress causes cumulative damage.
  Each episode scars nephrons, and over years this adds to
  chronic kidney disease. Workers in outdoor labour have
  2-3 times higher risk of CKD than indoor workers of the
  same age, sex and socioeconomic status in longitudinal studies.
  See also: Heatwaves and Occupational Health, Climate, 2026,
  14, 83. doi:10.3390/cli14040083. That review finds recurrent
  subclinical AKI, dehydration-driven vasopressin activation,
  and cumulative renal damage under repetitive occupational
  heat exposure, with kidney biopsies showing chronic
  interstitial nephritis in sugarcane workers.

This supports the ThermiGraph design choice: track strain
over 6 days, flag failed overnight recovery when the night
minimum stays above 28 C, and add strain day after day.
It does NOT prove that the ThermiGraph score of 12 is a
clinical threshold. The score of 12 is a prototype score,
chosen to make the timeline readable, not a published
clinical cutoff. That must stay labelled as a prototype score.

## 5. Validation tests to add

- Stull wet bulb: check against known psychrometric values.
- WBGT formula: check 0.7 / 0.2 / 0.1 weighting on a fixed
  wet bulb, globe and dry bulb input.
- NIOSH limits: check Light 30, Moderate 28, Heavy 26,
  Very heavy 25, acclimatised.
- Work/rest: check 45/15 at 25-26 C, 30/30 at 26-28 C,
  no outdoor work above 28 C.
- Recovery debt: check night minimum above 28 C flags YES,
  at or below 28 C flags no.
- Triage: check the Ahmed sample note returns Critical,
  with vomiting and stopped sweating in the symptoms list.

No test in this list uses real patient data.

## 6. Expert review - to be completed only by a real reviewer

Placeholder only. Do NOT fill this in with an invented name.

Reviewer name:
Qualification:
Organisation:
Date:
What was reviewed:
What was found:
What must change before clinical use:

A review here must be a real person, with consent, who has
read the code and the brief above. A quote without a name,
qualification and date does not count as clinical proof.

## 7. Limitations, in plain words

- WBGT is estimated from weather data, not measured with a globe meter.
- Globe temperature is estimated from solar radiation, not measured.
- Clothing is modelled only as a simplified +0/+1/+2/+4 C correction. Acclimatisation, age, and medical history are not modelled.
- The cumulative score is a prototype score, not a clinical threshold.
- Triage is Gemini extraction from a typed note, not a diagnosis.
- No real crew, no real shift, and no real meter reading are claimed.
