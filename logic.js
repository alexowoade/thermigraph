// ThermiGraph AI — logic.js
// Pure business logic for the JavaScript version of the ThermiGraph dashboard.
// This file has NO DOM and NO network calls, so it can be tested with plain Node.
// It is a faithful port of the Python modules:
//   physics_engine.py  (WBGT estimate, Stull wet bulb, NIOSH limits)
//   strain_timeline.py (daily strain points, nocturnal recovery debt)
//   shift_optimizer.py (work-rest ratios, shade break)
//   dashboard_logic.py (6-day timeline, shift schedule, compare-sites, cost model)
//   triage.py          (deterministic offline triage fallback, no API key needed)
//
// A "port" means the same inputs give the same numbers as the Python version.
// The verification script (verify/test_logic.js) checks that with Node.
//
// Works in the browser (window.ThermiGraphLogic) and in Node (module.exports).
(function (root, factory) {
    if (typeof module === "object" && module.exports) {
        module.exports = factory();
    } else {
        root.ThermiGraphLogic = factory();
    }
})(typeof self !== "undefined" ? self : this, function () {
    "use strict";

    // ------------------------------------------------------------------
    // Helpers
    // ------------------------------------------------------------------
    // Round to N decimals the way Python's round() does: half-to-even
    // (banker's rounding). JS Math.round rounds half up, which would give
    // 11.3 where Python gives 11.2 for 11.25. This keeps the numbers identical.
    function roundTo(x, decimals) {
        const p = Math.pow(10, decimals);
        const v = x * p;
        const f = Math.floor(v);
        const diff = v - f;
        if (diff > 0.5) return (f + 1) / p;
        if (diff < 0.5) return f / p;
        return (f % 2 === 0 ? f : f + 1) / p; // exactly .5: round to even
    }

    // ------------------------------------------------------------------
    // Sites (same coordinates as dashboard.py)
    // ------------------------------------------------------------------
    const ZONES = {
        "Mussafah (UAE)": [24.3613, 54.5038],
        "KEZAD / Khalifa Port (UAE)": [24.7880, 54.6947],
        "Ruwais (UAE)": [24.0916, 52.6527],
    };

    const GLOBAL_SITES = {
        "Mussafah (UAE — Host Pilot)": [24.3613, 54.5038],
        "KEZAD / Khalifa Port (UAE — Host Pilot)": [24.7880, 54.6947],
        "Ruwais (UAE — Host Pilot)": [24.0916, 52.6527],
        "Lagos — Lekki Industrial Zone (Nigeria / West Africa)": [6.4402, 4.0193],
        "Delhi NCR — Industrial Belt (India / South Asia)": [28.6139, 77.2090],
        "Houston — Petrochemical Corridor (USA / North America)": [29.7355, -95.2638],
        "Custom Global GPS Coordinates (Any Worksite Worldwide)": null,
    };

    const COMPARE_SITES = {
        "Mussafah (UAE)": [24.3613, 54.5038],
        "Lagos (Nigeria)": [6.4402, 4.0193],
        "Delhi NCR (India)": [28.6139, 77.2090],
        "Houston (USA)": [29.7355, -95.2638],
    };

    // ------------------------------------------------------------------
    // Module 1 — physics_engine.py
    // ------------------------------------------------------------------
    // NIOSH recommended limits, acclimatised workers, continuous work.
    const NIOSH_LIMITS = {
        "Light": 30.0,
        "Moderate": 28.0,
        "Heavy": 26.0,
        "Very heavy": 25.0,
    };

    // Clothing adjustment (C), ISO 7243 Annex C, simplified — same values
    // as Python physics_engine.py CLOTHING_CORRECTION. Effective WBGT =
    // raw WBGT + correction: heavier / less permeable clothing RAISES the
    // effective heat strain. Subtracting it would understate the risk.
    const CLOTHING_CORRECTION = {
        "light_civilian": 0.0,
        "coveralls": 1.0,
        "construction_ppe": 2.0,
        "impermeable_suit": 4.0,
    };

    // Acclimatisation penalty (C) applied to the NIOSH limit — v22
    // coupled logic, Python v19 parity. An unacclimatised worker's
    // safe limit is 2.5 C lower than an acclimatised worker's.
    const ACCLIMATIZATION_PENALTY = {
        "acclimatised": 0.0,
        "partial": 1.5,
        "unacclimatised": 2.5,
    };

    // Wet bulb temperature in C, Stull (2011) empirical formula.
    function wetBulbStull(tempC, humidity) {
        const rh = Math.max(5.0, Math.min(99.9, Number(humidity)));
        const ta = Number(tempC);
        return (
            ta * Math.atan(0.151977 * Math.sqrt(rh + 8.313659))
            + Math.atan(ta + rh)
            - Math.atan(rh - 1.676331)
            + 0.00391838 * Math.pow(rh, 1.5) * Math.atan(0.023101 * rh)
            - 4.686035
        );
    }

    // Outdoor WBGT estimate in C with convective wind adjustment on black globe.
    // WBGT = 0.7 * wet bulb + 0.2 * black globe + 0.1 * dry bulb (open sun)
    // In shade: WBGT = 0.7 * wet bulb + 0.3 * dry bulb (globe = dry bulb).
    // exposure: "open_sun" (default), "high_albedo" (globe + 1.5 C, e.g.
    // bright concrete / sand reflecting extra solar load), "shaded".
    // At the reference wind speed of 10 km/h, windFactor == 1.0.
    // Returns [wbgt, wetBulb, blackGlobe]. No sentinel value is used:
    // a missing input is an error in the caller, never a sentinel value.
    function estimateWBGT(tempC, humidity, solarWm2, windKmh, clothing, exposure) {
        if (windKmh === undefined) windKmh = 10.0;
        if (clothing === undefined) clothing = "light_civilian";
        if (exposure === undefined) exposure = "open_sun";
        const wetBulb = wetBulbStull(tempC, humidity);
        const effectiveWind = Math.max(2.0, Number(windKmh));
        const windFactor = Math.pow(10.0 / effectiveWind, 0.35);
        let blackGlobe;
        let wbgtRaw;
        if (exposure === "shaded") {
            blackGlobe = Number(tempC);
            wbgtRaw = 0.7 * wetBulb + 0.3 * Number(tempC);
        } else {
            const solarIncrement = Math.min(18.0, Math.max(0.0, Number(solarWm2)) * 0.02 * windFactor);
            blackGlobe = Number(tempC) + solarIncrement;
            if (exposure === "high_albedo") blackGlobe += 1.5;
            wbgtRaw = 0.7 * wetBulb + 0.2 * blackGlobe + 0.1 * Number(tempC);
        }
        const correction = CLOTHING_CORRECTION[clothing] !== undefined ? CLOTHING_CORRECTION[clothing] : 0.0;
        const wbgt = wbgtRaw + correction;
        return [wbgt, wetBulb, blackGlobe];
    }

    // One line per workload: OK or OVER LIMIT. Same text as Python niosh_check.
    function nioshCheck(wbgt) {
        const lines = [];
        for (const work of Object.keys(NIOSH_LIMITS)) {
            const limit = NIOSH_LIMITS[work];
            if (wbgt <= limit) {
                lines.push("  " + work + ": OK (" + wbgt.toFixed(1) + " <= " + limit.toFixed(0) + ")");
            } else {
                lines.push("  " + work + ": OVER LIMIT (" + wbgt.toFixed(1) + " > " + limit.toFixed(0) + ")");
            }
        }
        return lines;
    }

    // Map colour for a WBGT value (same thresholds as dashboard.py wbgt_color).
    // Returns [r, g, b, a] with a = 215.
    function wbgtColor(wbgtC) {
        if (wbgtC > 28.0) return [244, 63, 94, 215];
        if (wbgtC > 26.0) return [249, 115, 22, 215];
        if (wbgtC > 25.0) return [245, 158, 11, 215];
        return [16, 185, 129, 215];
    }

    // ------------------------------------------------------------------
    // Module 2 — strain_timeline.py
    // ------------------------------------------------------------------
    // Night minimum above this means the body did not cool down overnight.
    const RECOVERY_DEBT_NIGHT_MIN = 28.0;

    // Simple prototype points for one day.
    function dailyPoints(maxWbgt, recoveryDebt) {
        let points;
        if (maxWbgt > 28.0) points = 3;
        else if (maxWbgt > 26.0) points = 2;
        else if (maxWbgt > 25.0) points = 1;
        else points = 0;
        if (recoveryDebt) points += 1;
        return points;
    }

    // ------------------------------------------------------------------
    // Module 4 — shift_optimizer.py
    // ------------------------------------------------------------------
    // Returns [workMinutes, restMinutes, label].
    function workRest(wbgt) {
        if (wbgt > 28.0) return [0, 60, "NO OUTDOOR WORK"];
        if (wbgt > 26.0) return [30, 30, "30 work / 30 rest"];
        if (wbgt > 25.0) return [45, 15, "45 work / 15 rest"];
        return [60, 0, "60 work / 0 rest"];
    }

    // ------------------------------------------------------------------
    // v22 coupled logic — Python v19 parity.
    // The NIOSH limit is no longer a fixed number: it is lowered by the
    // worker's acclimatisation and by the multi-day debt the crew is
    // already carrying, so the same WBGT can be safe on Day 1 and
    // unsafe on Day 3 for the same crew.
    // ------------------------------------------------------------------
    // Effective work limit for one workload, given who is working and
    // what debt they carry. Returns [effLimit, totalPenalty, rationale].
    //   base: Light 30 / Moderate 28 / Heavy 26 / Very heavy 25 (NIOSH).
    //   acclimatisation penalty: acclimatised 0.0 / partial 1.5 /
    //     unacclimatised 2.5 C.
    //   debt penalty: 1.0 C if cumulativeStrain >= 12, else 0.5 C if
    //     debtDays >= 2 or cumulativeStrain >= 8, else 0.0 C.
    function effectiveWorkLimit(workload, acclimatization, cumulativeStrain, debtDays) {
        if (workload === undefined) workload = "Heavy";
        if (acclimatization === undefined) acclimatization = "acclimatised";
        if (cumulativeStrain === undefined) cumulativeStrain = 0;
        if (debtDays === undefined) debtDays = 0;
        const base = NIOSH_LIMITS[workload] !== undefined ? NIOSH_LIMITS[workload] : NIOSH_LIMITS["Heavy"];
        const acclimPen = ACCLIMATIZATION_PENALTY[acclimatization] !== undefined ? ACCLIMATIZATION_PENALTY[acclimatization] : 0.0;
        let debtPen = 0.0;
        let debtWhy = "no multi-day debt penalty";
        let debtKind = "none";
        if (cumulativeStrain >= 12) {
            debtPen = 1.0;
            debtWhy = "cumulative strain " + cumulativeStrain + " >= 12 (red line crossed)";
            debtKind = "redline";
        } else if (debtDays >= 2 || cumulativeStrain >= 8) {
            debtPen = 0.5;
            debtWhy = "multi-day debt: " + debtDays + " nocturnal debt day(s), cumulative strain " + cumulativeStrain;
            debtKind = "multiday";
        }
        const totalPen = roundTo(acclimPen + debtPen, 1);
        const effLimit = roundTo(base - totalPen, 1);
        // v28.1: the old text read "<state> acclimatisation" (e.g.
        // "acclimatised acclimatisation") — one word is enough, the
        // penalty value itself says how much was subtracted.
        const rationale = "Effective " + workload + " limit " + effLimit.toFixed(1) + " C = NIOSH base " +
            base.toFixed(1) + " C - " + totalPen.toFixed(1) + " C (acclimatisation -" +
            acclimPen.toFixed(1) + " C; " + debtWhy + " -" + debtPen.toFixed(1) + " C)";
        // v28.1: structured parts so app.js can render the same
        // rationale in Arabic (i18n templates) without re-parsing
        // the English string. Returns [effLimit, totalPen,
        // rationale, parts]; the 4th element is new, the first
        // three are unchanged.
        const parts = { workload: workload, effLimit: effLimit, base: base, totalPen: totalPen, acclimPen: acclimPen, debtPen: debtPen, debtKind: debtKind, debtStrain: cumulativeStrain, debtDays: debtDays };
        return [effLimit, totalPen, rationale, parts];
    }

    // Work/rest ratio against the EFFECTIVE limit, not the fixed NIOSH
    // limit. Returns [workMinutes, restMinutes, label] with the same
    // labels as workRest(). Bands are relative to effLimit:
    //   wbgt > effLimit + 2.0 -> stop; wbgt > effLimit -> 30/30;
    //   wbgt > effLimit - 1.0 -> 45/15; otherwise 60/0.
    function workRestCoupled(wbgt, effLimit) {
        if (wbgt > effLimit + 2.0) return [0, 60, "NO OUTDOOR WORK"];
        if (wbgt > effLimit) return [30, 30, "30 work / 30 rest"];
        if (wbgt > effLimit - 1.0) return [45, 15, "45 work / 15 rest"];
        return [60, 0, "60 work / 0 rest"];
    }

    // Hydration protocol against the EFFECTIVE limit. Returns
    // [mlPerHour, text]. The text is the protocol as written in Python:
    //   1000 mL/hr chilled ORS, every 15 min (wbgt > effLimit + 2)
    //   750 mL/hr chilled ORS, every 20 min (wbgt > effLimit)
    //   500 mL/hr ORS, every 30 min (wbgt > effLimit - 1)
    //   350 mL/hr baseline (otherwise)
    // Plus, when debtDays >= 1: " + 500 mL pre-shift morning ORS
    // bolus (nocturnal debt)".
    function hydrationProtocol(wbgt, effLimit, debtDays) {
        if (debtDays === undefined) debtDays = 0;
        let ml, text;
        if (wbgt > effLimit + 2.0) {
            ml = 1000;
            text = "1000 mL/hr chilled ORS, every 15 min";
        } else if (wbgt > effLimit) {
            ml = 750;
            text = "750 mL/hr chilled ORS, every 20 min";
        } else if (wbgt > effLimit - 1.0) {
            ml = 500;
            text = "500 mL/hr ORS, every 30 min";
        } else {
            ml = 350;
            text = "350 mL/hr baseline hydration";
        }
        if (debtDays >= 1) text += " + 500 mL pre-shift morning ORS bolus (nocturnal debt)";
        return [ml, text];
    }

    // ------------------------------------------------------------------
    // dashboard_logic.py — computeTimelineAndStrain
    // ------------------------------------------------------------------
    // hourly: { time: [...], temperature_2m: [...], relative_humidity_2m: [...],
    //           wind_speed_10m: [...], shortwave_radiation: [...] }
    // spikeC: degrees added to every temperature.
    // Returns { chartRows, dailyRows, totalStrain, debtDays }.
    // chartRows: [{ time, wbgt }] with wbgt rounded to 2 decimals.
    // dailyRows: [{ date, maxTemp, nightMin, maxWbgt, hoursOverHeavy,
    //               recoveryDebt ("YES (+1 pt)" or "No"), points, cumulative }]
    // hourly: { time: [...], temperature_2m: [...], relative_humidity_2m: [...],
    //           wind_speed_10m: [...], shortwave_radiation: [...] }
    // spikeC: degrees added to every temperature.
    // v22: exposure / workload / acclimatization are threaded through so
    // hoursOverHeavy counts hours above the EFFECTIVE limit for this
    // crew, not the fixed 26 C Heavy limit. Defaults keep v21 behaviour
    // (open sun, Heavy, acclimatised -> effective limit 26.0 C).
    // Returns { chartRows, dailyRows, totalStrain, debtDays,
    //           effectiveLimit, limitRationale }.
    function computeTimelineAndStrain(hourly, spikeC, clothing, exposure, workload, acclimatization) {
        if (clothing === undefined) clothing = "light_civilian";
        if (exposure === undefined) exposure = "open_sun";
        if (workload === undefined) workload = "Heavy";
        if (acclimatization === undefined) acclimatization = "acclimatised";
        // The effective limit needs the running strain, which is only
        // known after the daily loop. v21 counted hours over the fixed
        // Heavy limit; v22 counts them over the effective limit for the
        // crew's final debt state, so Day 3 hours are judged by the
        // limit the crew is actually working under by then. First pass:
        // collect daily maxima and debt with the base (acclimatisation
        // only) limit, then apply the debt penalty once the totals are
        // known and recount hours over the final effective limit.
        const n = hourly.time.length;
        const winds = hourly.wind_speed_10m || new Array(n).fill(10.0);
        const chartRows = [];
        const byDay = {}; // day string -> [indexes]
        for (let i = 0; i < n; i++) {
            const day = hourly.time[i].slice(0, 10);
            if (!byDay[day]) byDay[day] = [];
            byDay[day].push(i);
            const tempSpiked = hourly.temperature_2m[i] + spikeC;
            const wbgt = estimateWBGT(
                tempSpiked,
                hourly.relative_humidity_2m[i],
                hourly.shortwave_radiation[i],
                winds[i],
                clothing,
                exposure
            )[0];
            chartRows.push({ time: hourly.time[i], wbgt: roundTo(wbgt, 2) });
        }

        const dailyRows = [];
        let cumulative = 0;
        let debtDaysCount = 0;
        const days = Object.keys(byDay).sort();
        for (const day of days) {
            const indexes = byDay[day];
            const temps = indexes.map(function (i) { return hourly.temperature_2m[i] + spikeC; });
            let maxWbgt = 0.0;
            const nightTemps = [];
            for (const i of indexes) {
                const hour = parseInt(hourly.time[i].slice(11, 13), 10);
                const tempC = hourly.temperature_2m[i] + spikeC;
                const humidity = hourly.relative_humidity_2m[i];
                const solar = hourly.shortwave_radiation[i];
                const wbgt = estimateWBGT(tempC, humidity, solar, winds[i], clothing, exposure)[0];
                if (wbgt > maxWbgt) maxWbgt = wbgt;
                if (hour < 6) nightTemps.push(tempC);
            }
            const nightMin = nightTemps.length ? Math.min.apply(null, nightTemps) : Math.min.apply(null, temps);
            const recoveryDebt = nightMin > RECOVERY_DEBT_NIGHT_MIN;
            if (recoveryDebt) debtDaysCount += 1;
            const points = dailyPoints(maxWbgt, recoveryDebt);
            cumulative += points;
            dailyRows.push({
                date: day,
                maxTemp: roundTo(Math.max.apply(null, temps), 1),
                nightMin: roundTo(nightMin, 1),
                maxWbgt: roundTo(maxWbgt, 1),
                hoursOverHeavy: 0, // filled below, over the final effective limit
                recoveryDebt: recoveryDebt ? "YES (+1 pt)" : "No",
                points: points,
                cumulative: cumulative,
            });
        }
        // Final effective limit for this crew over this window, then
        // recount hours over it (same hourly WBGTs as the chart rows).
        const eff = effectiveWorkLimit(workload, acclimatization, cumulative, debtDaysCount);
        const effLimit = eff[0];
        for (let d = 0; d < dailyRows.length; d++) {
            const day = dailyRows[d].date;
            let hoursOver = 0;
            for (const i of byDay[day]) {
                if (chartRows[i].wbgt > effLimit) hoursOver += 1;
            }
            dailyRows[d].hoursOverHeavy = hoursOver;
        }
        return { chartRows: chartRows, dailyRows: dailyRows, totalStrain: cumulative, debtDays: debtDaysCount, effectiveLimit: effLimit, limitRationale: eff[2] };
    }

    // ------------------------------------------------------------------
    // dashboard_logic.py — computeShiftSchedule
    // ------------------------------------------------------------------
    // Tomorrow is the 5th day in the sorted 6-day window (allDays[4]),
    // because past_days=3 gives 3 past days + today + 2 future days.
    // Returns { tomorrow, rows, preventedHours, coolingMinutes }.
    // rows: [{ hour, temp, wbgt, protocol, crew }]
    // Returns { tomorrow, rows, preventedHours, coolingMinutes,
    //           effectiveLimit, limitRationale }.
    // rows: [{ hour, temp, wbgt, protocol, crew, hydration, hydrationMl,
    //          explanation }]
    // v22: the schedule is coupled — work/rest, hydration and the
    // prevented-hours count all use the EFFECTIVE limit for this crew
    // (workload + acclimatisation + cumulative strain + debt days),
    // not the fixed 26 C Heavy limit. Defaults keep v21 behaviour.
    // explanation is one of: PROACTIVE HALT / PROACTIVE 30/30 PACING /
    // PRE-THRESHOLD BUFFER / Safe continuous window / SHADE BREAK 13-15.
    function computeShiftSchedule(hourly, spikeC, clothing, workload, acclimatization, cumulativeStrain, debtDays, exposure) {
        if (clothing === undefined) clothing = "light_civilian";
        if (workload === undefined) workload = "Heavy";
        if (acclimatization === undefined) acclimatization = "acclimatised";
        if (cumulativeStrain === undefined) cumulativeStrain = 0;
        if (debtDays === undefined) debtDays = 0;
        if (exposure === undefined) exposure = "open_sun";
        const eff = effectiveWorkLimit(workload, acclimatization, cumulativeStrain, debtDays);
        const effLimit = eff[0];
        const allDays = Array.from(new Set(hourly.time.map(function (t) { return t.slice(0, 10); }))).sort();
        let tomorrowText;
        if (allDays.length > 4) {
            tomorrowText = allDays[4];
        } else {
            const d = new Date();
            d.setDate(d.getDate() + 1);
            tomorrowText = d.toISOString().slice(0, 10);
        }
        const n = hourly.time.length;
        const winds = hourly.wind_speed_10m || new Array(n).fill(10.0);
        const rows = [];
        let preventedHours = 0;
        let coolingMinutes = 0;
        for (let i = 0; i < n; i++) {
            const timeText = hourly.time[i];
            const day = timeText.slice(0, 10);
            const hour = parseInt(timeText.slice(11, 13), 10);
            if (day !== tomorrowText || hour < 6 || hour > 17) continue;
            const tempC = hourly.temperature_2m[i] + spikeC;
            const humidity = hourly.relative_humidity_2m[i];
            const solar = hourly.shortwave_radiation[i];
            const wbgt = estimateWBGT(tempC, humidity, solar, winds[i], clothing, exposure)[0];
            if (wbgt > effLimit) preventedHours += 1;
            const hyd = hydrationProtocol(wbgt, effLimit, debtDays);
            let protocol, crew, explanation, expKind;
            if (hour >= 13 && hour < 15) {
                protocol = "SHADE BREAK (No outdoor work)";
                crew = "All Crews — Mandatory Shaded Rest";
                explanation = "SHADE BREAK 13-15 — mandatory shaded rest 13:00-15:00, the hottest window, regardless of WBGT";
                expKind = "SHADE";
                coolingMinutes += 60;
            } else {
                const wr = workRestCoupled(wbgt, effLimit);
                coolingMinutes += wr[1];
                protocol = wr[2];
                if (wr[0] === 0) {
                    crew = "All Crews — Work Suspended (Over Limit)";
                    explanation = "PROACTIVE HALT — WBGT " + wbgt.toFixed(1) + " C is above the effective " + workload +
                        " limit " + effLimit.toFixed(1) + " C (" + eff[2] + "); no outdoor work";
                    expKind = "HALT";
                } else if (wr[0] === 30) {
                    crew = hour < 10 ? "Crew A (Heavy Labour Window)" : (hour < 12 ? "Crew A (Light Work Only)" : "Crew B (Afternoon Light Rotation)");
                    explanation = "PROACTIVE 30/30 PACING — WBGT " + wbgt.toFixed(1) + " C is above the effective " +
                        workload + " limit " + effLimit.toFixed(1) + " C; 30 min work / 30 min shaded rest";
                    expKind = "PACING";
                } else if (wr[0] === 45) {
                    crew = hour < 10 ? "Crew A (Heavy Labour Window)" : (hour < 12 ? "Crew A (Light Work Only)" : "Crew B (Afternoon Light Rotation)");
                    explanation = "PRE-THRESHOLD BUFFER — WBGT " + wbgt.toFixed(1) + " C is within 1 C of the effective " +
                        workload + " limit " + effLimit.toFixed(1) + " C; 45 min work / 15 min shaded rest";
                    expKind = "BUFFER";
                } else {
                    crew = hour < 10 ? "Crew A (Heavy Labour Window)" : (hour < 12 ? "Crew A (Light Work Only)" : "Crew B (Afternoon Light Rotation)");
                    explanation = "Safe continuous window — WBGT " + wbgt.toFixed(1) + " C is below the effective " +
                        workload + " limit " + effLimit.toFixed(1) + " C; continuous work";
                    expKind = "SAFE";
                }
            }
            rows.push({
                hour: String(hour).padStart(2, "0") + ":00",
                temp: roundTo(tempC, 1),
                wbgt: roundTo(wbgt, 1),
                protocol: protocol,
                crew: crew,
                hydration: hyd[1],
                hydrationMl: hyd[0],
                explanation: explanation,
                // v28.1: structured parts so app.js can render the
                // same explanation in Arabic (i18n templates).
                // The English `explanation` string above is unchanged.
                explanationParts: { kind: expKind, wbgt: wbgt, workload: workload, effLimit: effLimit, rationaleParts: eff[3] },
            });
        }
        return { tomorrow: tomorrowText, rows: rows, preventedHours: preventedHours, coolingMinutes: coolingMinutes, effectiveLimit: effLimit, limitRationale: eff[2], limitRationaleParts: eff[3] };
    }

    // ------------------------------------------------------------------
    // dashboard_logic.py — computeCompareSites
    // ------------------------------------------------------------------
    // siteHourly: { siteName: hourlyDict }. siteCurrentWbgt: { siteName: wbgt }.
    // siteCurrentSolar: { siteName: solar W/m2 } (live, may be missing).
    // Returns rows: [{ site, currentWbgt, solar, maxWbgt, debtDays, tier }]
    function computeCompareSites(siteHourly, spikeC, siteCurrentWbgt, clothing, exposure, siteCurrentSolar) {
        if (spikeC === undefined) spikeC = 0.0;
        if (clothing === undefined) clothing = "light_civilian";
        if (exposure === undefined) exposure = "open_sun";
        const rows = [];
        for (const siteName of Object.keys(siteHourly)) {
            const hourly = siteHourly[siteName];
            const n = hourly.time.length;
            const winds = hourly.wind_speed_10m || new Array(n).fill(10.0);
            let maxWbgt = 0.0;
            let debtDays = 0;
            const byDay = {};
            for (let i = 0; i < n; i++) {
                const day = hourly.time[i].slice(0, 10);
                if (!byDay[day]) byDay[day] = [];
                byDay[day].push(i);
            }
            let currentWbgt;
            if (siteCurrentWbgt && siteCurrentWbgt[siteName] !== undefined) {
                currentWbgt = siteCurrentWbgt[siteName];
            } else {
                const mid = Math.floor(n / 2);
                currentWbgt = estimateWBGT(
                    hourly.temperature_2m[mid] + spikeC,
                    hourly.relative_humidity_2m[mid],
                    hourly.shortwave_radiation[mid],
                    winds[mid],
                    clothing,
                    exposure
                )[0];
            }
            // Current solar radiation (W/m2). Prefer the live reading passed
            // in (it matches the current hour exactly); fall back to the
            // hourly value at the middle index.
            let solar = 0;
            if (siteCurrentSolar && siteCurrentSolar[siteName] !== undefined && siteCurrentSolar[siteName] !== null) {
                solar = Math.round(siteCurrentSolar[siteName]);
            } else {
                const midSolar = Math.floor(n / 2);
                solar = (hourly.shortwave_radiation && hourly.shortwave_radiation[midSolar] != null)
                    ? Math.round(hourly.shortwave_radiation[midSolar]) : 0;
            }
            for (const day of Object.keys(byDay).sort()) {
                const nightTemps = [];
                for (const i of byDay[day]) {
                    const hour = parseInt(hourly.time[i].slice(11, 13), 10);
                    const tempC = hourly.temperature_2m[i] + spikeC;
                    const wbgt = estimateWBGT(
                        tempC,
                        hourly.relative_humidity_2m[i],
                        hourly.shortwave_radiation[i],
                        winds[i],
                        clothing,
                        exposure
                    )[0];
                    if (wbgt > maxWbgt) maxWbgt = wbgt;
                    if (hour < 6) nightTemps.push(tempC);
                }
                if (nightTemps.length && Math.min.apply(null, nightTemps) > RECOVERY_DEBT_NIGHT_MIN) debtDays += 1;
            }
            let tier;
            if (maxWbgt > 28.0) tier = "Critical";
            else if (maxWbgt > 26.0) tier = "High";
            else if (maxWbgt > 25.0) tier = "Moderate";
            else tier = "Low";
            rows.push({
                site: siteName,
                currentWbgt: roundTo(currentWbgt, 1),
                solar: solar,
                maxWbgt: roundTo(maxWbgt, 1),
                debtDays: debtDays + " / 6",
                tier: tier,
            });
        }
        return rows;
    }

    // ------------------------------------------------------------------
    // dashboard_logic.py — costOfInaction
    // ------------------------------------------------------------------
    // Transparent estimate, not epidemiology. Same model as Python.
    // Returns { excess, cases, hospitalisations, cost, casesPrevented, costPrevented }.
    function costOfInaction(workers, days, wbgtC) {
        const excess = Math.max(0.0, wbgtC - 26.0);
        const dailyRatePer1000 = 0.3 * excess;
        const cases = dailyRatePer1000 * (workers / 1000.0) * days;
        const hospitalisations = cases * 0.08;
        const cost = cases * 400.0 + hospitalisations * 4000.0;
        const casesPrevented = cases * 0.65;
        const costPrevented = cost * 0.65;
        return {
            excess: roundTo(excess, 1),
            cases: roundTo(cases, 1),
            hospitalisations: roundTo(hospitalisations, 1),
            cost: roundTo(cost, 0),
            casesPrevented: roundTo(casesPrevented, 1),
            costPrevented: roundTo(costPrevented, 0),
        };
    }

    // ------------------------------------------------------------------
    // triage.py — deterministic offline fallback (no API key)
    // ------------------------------------------------------------------
    const SAMPLE_LOG =
        "Ahmed, 34, concrete crew Mussafah, 2pm. Says dizzy and headache " +
        "since 11am, drank only 1 bottle of water all morning, helmet " +
        "strap broken, vest torn, sweating stopped, supervisor says he " +
        "vomited once, still on site.";

    const SCENARIO_PRESETS = {
        "Case 1: Acute CNS Heat Stroke & Anhydrosis (Critical Red Flag)": SAMPLE_LOG,
        "Case 2: Early Renal Strain / Dehydration & Muscle Cramps (High Risk)":
            "Ramesh, 41, rebar crew KEZAD Berth 3, 1:15pm. Reporting painful calf " +
            "and abdominal muscle cramps, dark concentrated urine, and orthostatic " +
            "lightheadedness. Portable shade tarp tore at 11:30am; water cooler 350m away.",
        "Case 3: Multilingual Field Note (Arabic / Hindi-Urdu / English)":
            "Bilal, 29, scaffolding crew Ruwais, 12:10pm. العامل يشعر بدوار شديد وصداع " +
            "(worker feels severe dizziness and headache), tez dhoop mein kaam kar raha tha, " +
            "water flask empty since 10am, cooling fan at rest tent not working.",
        "Case 4: Unacclimatised New Cohort + Multi-Day Cumulative Strain (Proactive Escalation)":
            "Tariq, 27, steel-fixing crew Mussafah, Day 3 on site, 11:30am. Mild headache " +
            "and fatigue, drank only 1 cup of water since 7am, slept poorly last night, " +
            "still on site. New to this site and not yet acclimatised; the crew has " +
            "carried multi-day heat strain with warm nights all week.",
    };

    // Rule-based clinical fallback parser. Same rules and same wording as Python.
    // v22: coupled — the severity is judged against the EFFECTIVE limit
    // for this crew (workload + acclimatisation + cumulative strain +
    // debt days), not the fixed NIOSH limit, and a worker who looks
    // "Moderate" on symptoms alone is escalated to High when the WBGT
    // is already above that effective limit and the crew carries
    // compound strain (strain >= 8, a debt day, or not acclimatised).
    // Returns { workerSummary, symptomSeverity, symptoms, hydrationStatus,
    //           equipmentFriction, oshaRiskTier, immediateAction,
    //           arabicCrewAlert, hindiUrduCrewAlert, hydrationProtocol,
    //           hydrationMl, explainableCorrelation }.
    // hydrationProtocol is the protocol text; hydrationMl is mL/hr.
    function deterministicTriageFallback(note, wbgtC, cumulativeStrain, debtDays, acclimatization, workload, clothing) {
        if (wbgtC === undefined) wbgtC = 28.5;
        if (cumulativeStrain === undefined) cumulativeStrain = 0;
        if (debtDays === undefined) debtDays = 0;
        if (acclimatization === undefined) acclimatization = "acclimatised";
        if (workload === undefined) workload = "Heavy";
        if (clothing === undefined) clothing = "light_civilian";
        const eff = effectiveWorkLimit(workload, acclimatization, cumulativeStrain, debtDays);
        const effLimit = eff[0];
        const hyd = hydrationProtocol(wbgtC, effLimit, debtDays);
        const lower = note.toLowerCase();

        let ageStr = "Adult worker";
        const ageMatch = note.match(/^\s*[A-Z][a-z]+\s*,\s*(\d{1,2})\b/) || note.match(/\b(\d{2})\b/);
        if (ageMatch) ageStr = "Age " + ageMatch[1];
        let locStr = "Global Site";
        const locs = ["Mussafah", "KEZAD", "Ruwais", "Lagos", "Delhi", "Houston"];
        for (const loc of locs) {
            if (lower.indexOf(loc.toLowerCase()) !== -1) { locStr = loc; break; }
        }

        const symptoms = [];
        const hasAny = function (keys) {
            for (const k of keys) if (lower.indexOf(k) !== -1) return true;
            return false;
        };
        if (hasAny(["dizzy", "dizziness", "lightheaded", "دوار"])) symptoms.push("Orthostatic dizziness / vertigo");
        if (hasAny(["headache", "صداع"])) symptoms.push("Heat headache");
        if (hasAny(["sweating stopped", "no sweat", "anhydrosis", "dry skin"])) symptoms.push("Anhydrosis (sweating stopped — red flag)");
        if (hasAny(["vomit", "vomited", "nausea"])) symptoms.push("Vomiting / GI distress");
        if (hasAny(["cramp", "cramps"])) symptoms.push("Heat muscle cramps (electrolyte depletion)");
        if (hasAny(["dark urine", "concentrated urine"])) symptoms.push("Dark urine (early renal hypoperfusion / AKI warning)");
        if (symptoms.length === 0) symptoms.push("General thermal fatigue under high ambient WBGT");

        const redFlag = hasAny(["sweating stopped", "vomited", "vomit", "faint", "collapse", "confus"]);
        const highFlag = hasAny(["cramp", "dark urine", "dizzy", "dizziness", "دوار"]);
        // Compound strain: the crew is already carrying multi-day debt
        // or the worker is not acclimatised, so a WBGT above the
        // effective limit is not a borderline call — it is the trigger.
        const compoundFlag = (cumulativeStrain >= 8 || debtDays >= 1 || acclimatization !== "acclimatised");
        const aboveEffLimit = wbgtC > effLimit;

        let severity, tier, action;
        let escalated = false;
        if (redFlag || wbgtC >= 30.0) {
            severity = "Critical";
            tier = "Critical — Acute heat-stroke red flags (anhydrosis/emesis) at " + wbgtC.toFixed(1) + " C WBGT";
            action = "STOP WORK IMMEDIATELY: Initiate rapid active cooling (ice packs to neck/axillae/groin, " +
                "chilled water misting) and trigger urgent emergency medical evacuation.";
        } else if (highFlag || wbgtC >= 27.5 || (aboveEffLimit && compoundFlag)) {
            // Proactive escalation: symptoms alone would read Moderate
            // (no high flag, WBGT below 27.5), but the WBGT is already
            // above this crew's effective limit while they carry
            // compound strain, so Moderate would understate the risk.
            escalated = (!highFlag && wbgtC < 27.5 && aboveEffLimit && compoundFlag);
            severity = "High";
            tier = "High — Symptomatic heat exhaustion / renal dehydration strain at " + wbgtC.toFixed(1) + " C WBGT";
            action = "Move worker to shaded cooling station immediately, administer 500 mL oral rehydration salts (ORS), " +
                "and refer to on-site occupational clinic for vital-sign and renal hydration check.";
        } else {
            severity = "Moderate";
            tier = "Medium — Preventive thermal strain monitoring at " + wbgtC.toFixed(1) + " C WBGT";
            action = "Enforce 30/30 shaded rest rotation and provide 250 mL electrolyte water every 20 minutes.";
        }

        // Explainable correlation: why this WBGT, for this crew, on
        // this day, gives this severity. Always present, in plain words.
        let explainableCorrelation = "WBGT " + wbgtC.toFixed(1) + " C vs effective " + workload + " limit " +
            effLimit.toFixed(1) + " C (" + eff[2] + "); cumulative strain " + cumulativeStrain +
            " / 12, nocturnal debt " + debtDays + " day(s), acclimatisation " + acclimatization +
            "; red flag " + (redFlag ? "present" : "absent") + ", high flag " + (highFlag ? "present" : "absent") +
            ", compound strain " + (compoundFlag ? "present" : "absent") + ".";
        if (escalated) {
            explainableCorrelation = "PROACTIVE ESCALATION (Moderate -> High): symptoms alone would read " +
                "Moderate (no high flag, WBGT below 27.5 C), but WBGT " + wbgtC.toFixed(1) + " C is above the " +
                "effective " + workload + " limit " + effLimit.toFixed(1) + " C (" + eff[2] + ") while the crew " +
                "carries compound strain (cumulative strain " + cumulativeStrain + " / 12, nocturnal debt " +
                debtDays + " day(s), acclimatisation " + acclimatization + "), so the risk is escalated to High " +
                "before symptoms worsen.";
        }

        let hydration;
        if (lower.indexOf("sweating stopped") !== -1) {
            hydration = "Severe dehydration; drank only 1 bottle of water all morning and sweating has stopped (thermoregulatory failure).";
        } else if (lower.indexOf("dark urine") !== -1 || lower.indexOf("cramp") !== -1) {
            hydration = "Electrolyte and fluid deficit indicated by muscle cramps and dark concentrated urine.";
        } else {
            hydration = "Suboptimal morning water intake reported under elevated solar load.";
        }

        const frictionItems = [];
        if (lower.indexOf("helmet") !== -1 || lower.indexOf("vest") !== -1) frictionItems.push("damaged helmet strap / torn safety vest");
        if (lower.indexOf("shade") !== -1 || lower.indexOf("tarp") !== -1) frictionItems.push("damaged portable shade canopy");
        if (lower.indexOf("350m") !== -1 || lower.indexOf("400m") !== -1 || lower.indexOf("empty") !== -1) frictionItems.push("water station distance / empty flask barrier");
        if (lower.indexOf("fan") !== -1) frictionItems.push("inoperative rest-tent cooling fan");
        let friction;
        if (frictionItems.length) {
            const joined = frictionItems.join("; ");
            friction = joined.charAt(0).toUpperCase() + joined.slice(1) + " increasing thermal and operational risk.";
        } else {
            friction = "Standard field PPE; monitor radiant solar exposure.";
        }

        return {
            workerSummary: "[Worker - Anonymised], " + ageStr + ", " + locStr + " industrial crew (Site WBGT: " + wbgtC.toFixed(1) + " C)",
            symptomSeverity: severity,
            symptoms: symptoms,
            hydrationStatus: hydration,
            equipmentFriction: friction,
            oshaRiskTier: tier,
            immediateAction: action,
            arabicCrewAlert: "تنبيه السلامة الحرارية (" + locStr + " - WBGT " + wbgtC.toFixed(1) + "°C): " +
                "توقف عن العمل الشاق فوراً، انتقل إلى منطقة الظل والتبريد، واشرب محلول الجفاف. الإبلاغ محمي بالكامل دون أي خصم.",
            hindiUrduCrewAlert: "Garmi Safety Alert (" + locStr + " - WBGT " + wbgtC.toFixed(1) + "°C): " +
                "Turant chhaon (shade) mein aayein aur ORS paani piyein. Chakkar ya cramp hone par supervisor ko batayein—koi salary cut nahi hoga.",
            hydrationProtocol: hyd[1],
            hydrationMl: hyd[0],
            explainableCorrelation: explainableCorrelation,
            effectiveLimit: effLimit,
            limitRationale: eff[2],
        };
    }

    // ------------------------------------------------------------------
    // Public API
    // ------------------------------------------------------------------
    return {
        roundTo: roundTo,
        ZONES: ZONES,
        GLOBAL_SITES: GLOBAL_SITES,
        COMPARE_SITES: COMPARE_SITES,
        NIOSH_LIMITS: NIOSH_LIMITS,
        CLOTHING_CORRECTION: CLOTHING_CORRECTION,
        ACCLIMATIZATION_PENALTY: ACCLIMATIZATION_PENALTY,
        effectiveWorkLimit: effectiveWorkLimit,
        workRestCoupled: workRestCoupled,
        hydrationProtocol: hydrationProtocol,
        wetBulbStull: wetBulbStull,
        estimateWBGT: estimateWBGT,
        nioshCheck: nioshCheck,
        wbgtColor: wbgtColor,
        RECOVERY_DEBT_NIGHT_MIN: RECOVERY_DEBT_NIGHT_MIN,
        dailyPoints: dailyPoints,
        workRest: workRest,
        computeTimelineAndStrain: computeTimelineAndStrain,
        computeShiftSchedule: computeShiftSchedule,
        computeCompareSites: computeCompareSites,
        costOfInaction: costOfInaction,
        SAMPLE_LOG: SAMPLE_LOG,
        SCENARIO_PRESETS: SCENARIO_PRESETS,
        deterministicTriageFallback: deterministicTriageFallback,
    };
});
