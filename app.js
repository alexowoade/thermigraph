// ThermiGraph AI — app.js (JavaScript version)
// The dashboard itself: fetches live Open-Meteo data in the browser, runs the
// logic from logic.js, and renders all 11 sections. No Streamlit, no server.
// v14 (2026-11-16): strain chart unclipped, Section 11 Clinical Evidence
// & Validation added, Abu Dhabi map re-fitted, scroll fade shortened
// with a safety fallback so no section stays pale or blank.
// v15 (2026-11-16): language toggle extended — all 11 headings (s11 was
// missing), hero tagline/pills, kickers, top-bar and action buttons,
// footer, RTL dir flip, persisted in localStorage "thermigraph_lang".
// Body text, tables, chart and map labels stay English; see README v15
// for exactly what is bilingual and what remains.
// The map is Leaflet with CartoDB Voyager / Dark Matter tiles (the same
// basemaps the Streamlit version uses). If Plotly fails to load, the chart
// degrades to a note and the rest of the dashboard keeps working.
//
// How the page is organised:
//   state  — theme, language, active site, spike, cached data, triage result
//   fetch  — Open-Meteo live + hourly, with a last-good cache in localStorage
//   render — one function per section, re-run when state changes
//   map    — Leaflet, a real Abu Dhabi basemap with one circle per zone
//             (bigger = hotter, colour = NIOSH status). deck.gl drew a blank
//             box and the 2D canvas drew bars with no geography, so Leaflet
//             is what finally shows a map.
//   chart  — Plotly.js strain chart (with a fallback note if the CDN fails)

// PWA strings (v20): the install button and status follow the page
// language (Arabic for the local workforce). Defined BEFORE the IIFE so
// applyLang() can call pwaT() during boot; the PWA block at the bottom of
// this file only owns the button behaviour (v19: always visible, never
// disappears after a click).
var PWA_T = {
  en: { install: "Install app", installed: "Installed", ready: "App ready to install", available: "Install available", dismissed: "Install dismissed \u2014 click Install app to try again", menu: "Install: use your browser menu > Install app / Add to Home Screen", installedMsg: "App installed", swFailed: "Install unavailable: service worker failed", noSw: "Install unavailable: no service worker support" },
  ar: { install: "\u062a\u062b\u0628\u064a\u062a \u0627\u0644\u062a\u0637\u0628\u064a\u0642", installed: "\u062a\u0645 \u0627\u0644\u062a\u062b\u0628\u064a\u062a", ready: "\u0627\u0644\u062a\u0637\u0628\u064a\u0642 \u062c\u0627\u0647\u0632 \u0644\u0644\u062a\u062b\u0628\u064a\u062a", available: "\u0627\u0644\u062a\u062b\u0628\u064a\u062a \u0645\u062a\u0627\u062d", dismissed: "\u062a\u0645 \u062a\u062c\u0627\u0647\u0644 \u0627\u0644\u062a\u062b\u0628\u064a\u062a \u2014 \u0627\u0646\u0642\u0631 \u0639\u0644\u0649 \u062a\u062b\u0628\u064a\u062a \u0627\u0644\u062a\u0637\u0628\u064a\u0642 \u0644\u0644\u0645\u062d\u0627\u0648\u0644\u0629 \u0645\u062c\u062f\u062f\u0627\u064b", menu: "\u0644\u0644\u062a\u062b\u0628\u064a\u062a: \u0627\u0633\u062a\u062e\u062f\u0645 \u0642\u0627\u0626\u0645\u0629 \u0627\u0644\u0645\u062a\u0635\u0641\u062d > \u062a\u062b\u0628\u064a\u062a \u0627\u0644\u062a\u0637\u0628\u064a\u0642 / \u0625\u0636\u0627\u0641\u0629 \u0625\u0644\u0649 \u0627\u0644\u0634\u0627\u0634\u0629 \u0627\u0644\u0631\u0626\u064a\u0633\u064a\u0629", installedMsg: "\u062a\u0645 \u062a\u062b\u0628\u064a\u062a \u0627\u0644\u062a\u0637\u0628\u064a\u0642", swFailed: "\u0627\u0644\u062a\u062b\u0628\u064a\u062a \u063a\u064a\u0631 \u0645\u062a\u0627\u062d: \u0641\u0634\u0644 \u0639\u0627\u0645\u0644 \u0627\u0644\u062e\u062f\u0645\u0629", noSw: "\u0627\u0644\u062a\u062b\u0628\u064a\u062a \u063a\u064a\u0631 \u0645\u062a\u0627\u062d: \u0627\u0644\u0645\u062a\u0635\u0641\u062d \u0644\u0627 \u064a\u062f\u0639\u0645 \u0639\u0627\u0645\u0644 \u0627\u0644\u062e\u062f\u0645\u0629" }
};
function pwaT(k) { var lang = (document.documentElement.lang === "ar") ? "ar" : "en"; var t = PWA_T[lang] || PWA_T.en; return (t && t[k]) || PWA_T.en[k] || k; }

(function () {
    "use strict";
    const L = window.ThermiGraphLogic;
    if (!L) {
        document.body.innerHTML = "<p style='padding:2rem;font-family:sans-serif'>ThermiGraph could not start: logic.js did not load. Please reload the page.</p>";
        return;
    }

    // Failure rule (learned 2026-11-14): a map error must NEVER stop the data
    // from loading. renderMap() is wrapped in try/catch, boot() runs every
    // step in its own try/catch and always calls loadAll(), and any uncaught
    // error is shown visibly in the status banner instead of failing silently
    // with a blank page.
    function reportError(msg) {
        try {
            const b = document.getElementById("statusBanner");
            if (b) {
                b.hidden = false;
                b.textContent = tf("pageError", { msg: msg });
                b.style.background = "rgba(244,63,94,0.10)";
                b.style.borderColor = "rgba(244,63,94,0.4)";
                b.style.color = "var(--red)";
            }
        } catch (e) { /* never let the reporter itself throw */ }
    }
    window.addEventListener("error", function (ev) {
        reportError(ev.message || "unknown error");
    });

    // ------------------------------------------------------------------
    // Text (EN / AR) — v20 FULL Arabic translation (2026-11-16).
    // The toggle now translates ALL user-facing text: hero, all 11
    // headings, kickers, buttons, labels, captions, footers, Section 11
    // evidence prose, NIOSH limits, work/rest rules, shift / strain /
    // compare table headers, cost calculator, triage labels, the
    // worker view, the compliance report, chart labels and map zone
    // names (Mussafah مصفح, KEZAD كيزاد, Ruwais الرويس). Author names,
    // journal titles, years, DOIs, the WBGT formula, worker notes and
    // symptom names stay in English / as entered, pinned LTR with
    // .tg-keep-ltr or a U+2066..U+2069 isolate, so the v18/v19 bidi
    // bugs (C° 21.7, +0C reversed, full stops jumping) do not return.
    // English is the default and the fallback for any missing key.
    // Language persists in localStorage key "thermigraph_lang"
    // (deliberately NOT "tg_..." so Refresh, which clears tg_* cache
    // keys, does not wipe the language choice).
    // ------------------------------------------------------------------
    const EN = {
        title: "ThermiGraph AI",
        subtitle: "Temporal Biometeorological and Field-Triage Engine | Future Health Digital Innovation Challenge 2026.",
        disclaimer: "WBGT values are prototype estimates from weather telemetry, not calibrated on-site globe meter readings.",
        tagline: "From a single hot hour to a 6-day physiological debt — ThermiGraph catches heat collapse before Day 3.",
        refresh: "🔄 Refresh live data",
        themeLight: "☀️ Light",
        themeDark: "🌙 Dark",
        footer: "ThermiGraph AI — Prototype for the Future Health Digital Innovation Challenge 2026. Live data: Open-Meteo. WBGT values are prototype estimates from weather telemetry, not calibrated on-site globe meter readings. Not a medical device.",
        pill1: "Open-Meteo Live Telemetry",
        pill2: "ISO 7243 · NIOSH Physics",
        pill3: "Privacy-by-Design Triage",
        kicker1: "Host Country Telemetry",
        kicker2: "Global Sentinel Simulation",
        kicker3: "Multi-Day Physiological Debt",
        kicker4: "Dynamic Crew Rotation",
        kicker5: "Structured Clinical Extraction",
        kicker6: "Audit & Governance Trail",
        kicker7: "Cross-Continental Benchmarking",
        kicker8: "Health System & Employer Economics",
        kicker9: "Interactive Actuarial Model",
        h2s1: "1. Live WBGT Telemetry (Abu Dhabi Host Pilot Corridor)",
        h2s2: "2. Global Worksite Selector & Heat Spike Simulator",
        h2s3: "3. Cumulative Strain Over 6 Days & Nocturnal Recovery Debt",
        h2s4: "4. Automated Shift & Work-Rest Optimizer",
        h2s5: "5. AI Field-Log Triage & Multilingual Crew Dispatch (Privacy-Preserving)",
        h2s6: "6. Exportable Compliance & Triage Report",
        h2s7: "7. Global Compare-Sites View",
        h2s8: "8. Impact / ROI Panel (Pilot Scale)",
        h2s9: "9. Cost-of-Inaction Calculator",
        h2s10: "10. Worker-Facing View",
        h2s11: "11. Clinical Evidence & Validation",
        kicker10: "Last-Mile Field Equity",
        kickerDemo: "Live Demo Control",
        kicker11: "Evidence & Limits",
        clothingLabel: "Clothing / PPE (ISO 7243 Annex C)",
        workloadLabel: "Workload (NIOSH base limit)",
        workloadLight: "Light (30 °C)",
        workloadModerate: "Moderate (28 °C)",
        workloadHeavy: "Heavy (26 °C)",
        workloadVeryHeavy: "Very heavy (25 °C)",
        acclimLabel: "Acclimatisation (lowers the effective limit)",
        acclimAcclimatised: "Acclimatised (−0.0 °C)",
        acclimPartial: "Partially acclimatised (−1.5 °C)",
        acclimUnacclimatised: "Unacclimatised (−2.5 °C)",
        exposureLabel: "Sun exposure (globe temperature)",
        exposureOpenSun: "Open sun",
        exposureHighAlbedo: "High albedo (bright concrete / sand, globe +1.5 °C)",
        exposureShaded: "Shaded (globe = air temperature)",
        gpsBtn: "📍 Use My Live Worksite GPS",
        autoPollOn: "🔴 Live Auto-Poll (60s): ON",
        autoPollOff: "⚪ Live Auto-Poll (60s): OFF",
        gpsFailed: "Live GPS failed: {msg} — keeping the current worksite.",
        gpsUnsupported: "Live GPS is not supported by this browser — keeping the current worksite.",
        gpsOk: "Live GPS worksite set: {lat}, {lon}.",
        telemetryLive: "Live Open-Meteo stream ({ms} ms RTT, {time} UTC)",
        lagosBtn: "▶ Lagos +6°C demo",
        mussafahBtn: "↺ Back to Mussafah",
        triageBtn: "🚀 Run triage",
        reportBtn: "⬇️ Download compliance report (.txt)",
        s1: "1. Live WBGT Telemetry (Abu Dhabi Host Pilot Corridor)",
        s2: "2. Global Worksite Selector & Heat Spike Simulator",
        s3: "3. Cumulative Strain Over 6 Days & Nocturnal Recovery Debt",
        s4: "4. Automated Shift & Work-Rest Optimizer",
        s5: "5. AI Field-Log Triage & Multilingual Crew Dispatch (Privacy-Preserving)",
        s6: "6. Exportable Compliance & Triage Report",
        s7: "7. Global Compare-Sites View",
        s8: "8. Impact / ROI Panel (Pilot Scale)",
        s9: "9. Cost-of-Inaction Calculator",
        s10: "10. Worker-Facing View",
        s11: "11. Clinical Evidence & Validation",
        docTitle: "ThermiGraph AI — Biometeorological Command Center",
        installApp: "Install app",
        installed: "Installed",
        pwaReady: "App ready to install",
        pwaAvailable: "Install available",
        pwaDismissed: "Install dismissed — click Install app to try again",
        pwaMenuFallback: "Install: use your browser menu > Install app / Add to Home Screen",
        pwaInstalled: "App installed",
        pwaSwFailed: "Install unavailable: service worker failed",
        pwaNoSw: "Install unavailable: no service worker support",
        tourBtn: "▶ Play the story — guided demo tour",
        tourPrev: "← Back",
        tourNext: "Next →",
        tourNextLast: "Finish ✓",
        tourExit: "✕ Exit tour",
        tourStep: "Step {i} of {n}",
        s1cap1: "Real map of the Abu Dhabi host pilot corridor. One circle per zone: bigger means hotter (circle size scales with live WBGT). Colour is the NIOSH status.",
        s1cap2: "Bar colours by current WBGT: green < <span class=\"tg-keep-ltr\">25 °C</span>, amber <span class=\"tg-keep-ltr\">25–26 °C</span>, orange <span class=\"tg-keep-ltr\">26–28 °C</span>, red > <span class=\"tg-keep-ltr\">28 °C</span>.",
        siteLabel: "Select Active Worksite for Deep-Dive Simulation, 6-Day Strain Timeline & Shift Plan",
        customLat: "Custom Latitude",
        customLon: "Custom Longitude",
        spikeLabel: "Simulate Extreme Heatwave Anomaly (<span class=\"tg-keep-ltr\">+°C</span> added to live telemetry)",
        nioshTitle: "NIOSH Work-Intensity Limits (Acclimatised, Continuous Work)",
        nioshTitleAccl: "NIOSH Work-Intensity Limits (Acclimatised, Continuous Work)",
        nioshTitleUnaccl: "NIOSH Work-Intensity Limits (Unacclimatised, Continuous Work)",
        isoCaption: "WBGT follows the ISO 7243 weighting (<span class=\"tg-keep-ltr\">0.7 wet bulb + 0.2 globe + 0.1 dry bulb</span>).",
        s3cap: "Cumulative Thermal Strain Index is an explainable prototype risk score (<span class=\"tg-keep-ltr\">0–4</span> points/day from peak WBGT + Nocturnal Recovery Debt <span class=\"tg-keep-ltr\">>28°C</span>), not a clinical diagnosis.",
        daySliderLabel: "📅 Drag through the 6 days — watch the strain build",
        baLabel: "⚖️ Before / after — drag to apply the rest schedule",
        ba0: "<span class=\"tg-keep-ltr\">0%</span> — no rest schedule",
        ba100: "<span class=\"tg-keep-ltr\">100%</span> — full rest schedule",
        s4cap: "The two numbers above scale with the slider: at <span class=\"tg-keep-ltr\">0%</span> nothing is prevented, at <span class=\"tg-keep-ltr\">100%</span> the full schedule is applied.",
        caseLabel: "Select Clinical Field Scenario Preset (or customize note below)",
        noteLabel: "Supervisor field note (EN/AR/HI — worker names auto-redacted)",
        s5cap: "Boundary: structured extraction for preventive occupational triage only — not a medical diagnosis. Names redacted at the crew level.",
        s6body: "Download the full compliance report: live zone telemetry, the active worksite and spike, the 6-day strain index, the shift plan, the latest anonymised triage, and the scope disclosures.",
        s7body: "One table, four sentinel corridors, same physics and thresholds. This is the argument that ThermiGraph is global.",
        s7cap: "World map: one circle per sentinel corridor, bigger means hotter (circle size scales with live WBGT). Colour is the NIOSH status. Current WBGT is the live reading; 6-day max and debt days use the same rolling window and thresholds as Section 3.",
        s8body: "Pilot-scale estimates for the Abu Dhabi host corridor. All figures are planning estimates, clearly labelled.",
        s8cap: "Estimates for planning only. Hardware cost = published price of a calibrated <span class=\"tg-keep-ltr\">150 mm</span> black-globe WBGT meter; case rates follow ILO occupational heat-stress reporting.",
        coWorkersLabel: "Exposed workers",
        coDaysLabel: "Exposure days",
        coWbgtLabel: "Site WBGT (<span class=\"tg-keep-ltr\">°C</span>)",
        s9cap: "Illustrative model, not epidemiology: incidence <span class=\"tg-keep-ltr\">0.3</span> cases / <span class=\"tg-keep-ltr\">1,000</span> workers / day / °C above <span class=\"tg-keep-ltr\">26 °C</span> heavy-work limit; <span class=\"tg-keep-ltr\">8%</span> hospitalise; <span class=\"tg-keep-ltr\">$400</span> per case, <span class=\"tg-keep-ltr\">$4,000</span> per hospitalisation; enforced rest cuts projected cases <span class=\"tg-keep-ltr\">65%</span>. Real deployment would calibrate against site-specific HSE records and ILO/WHO regional baselines.",
        s10body: "The same data, stripped for the worker holding the phone. One number, one action, one promise.",
        demoLabel: "🎬 Demo slider — drag to watch the phone react",
        phoneEyebrow: "Worker Mobile Alert",
        phoneAction: "💧 <b>Drink 1 cup of ORS now, then rest in shade.</b>",
        phonePromise: "🛡️ <b>Reporting symptoms will not affect your pay.</b>",
        s10cap: "Worker view is a mock: same live WBGT as the supervisor dashboard, reduced to one status, one action, and the non-punitive promise.",
        gaugeLabel: "Cumulative Strain",
        gaugeRedline: "Red line <span class=\"tg-keep-ltr\">12</span>",
        gaugeMax: "<span class=\"tg-keep-ltr\">24</span> max",
        zoneWbgtLabel: "{zone} WBGT Estimate",
        zoneDelta: "Air: {air}°C | RH: {rh}% | Wind: {wind} km/h",
        liveCaption: "Live readings as of {time} (local site time, Open-Meteo).",
        liveBadge: "LIVE",
        liveSource: "Source: Open-Meteo · Updated every 60s · As of {time}",
        wbgtEstimate: "WBGT estimate from live air temperature, humidity, solar and wind (Stull wet-bulb + wind-adjusted solar globe) — not a physical WBGT meter reading.",
        spikedLabel: "{site} WBGT (with spike)",
        // v28.1: the alert texts now name the EFFECTIVE limit that
        // triggers them (the alert already fired on it),
        // not the hardcoded 28.0 / 26.0 NIOSH base limits.
        alertCritical: "CRITICAL: Spiked WBGT exceeds the {limit} °C effective {workload} limit by more than 2.5 °C. Heavy and moderate continuous outdoor work must stop.",
        alertHigh: "HIGH STRAIN: Spiked WBGT exceeds the {limit} °C effective {workload} limit. Strict work-rest micro-rotations required.",
        // v28.1: effective-limit rationale + shift explanations as
        // templates, so Arabic can render them (they were English-only
        // strings built in logic.js). The English templates reproduce
        // the logic.js strings byte for byte.
        effRationale: "Effective {workload} limit {eff} C = NIOSH base {base} C - {pen} C (acclimatisation -{acclimPen} C; {debt} -{debtPen} C)",
        effDebtRedline: "cumulative strain {n} >= 12 (red line crossed)",
        effDebtMultiday: "multi-day debt: {days} nocturnal debt day(s), cumulative strain {n}",
        effDebtNone: "no multi-day debt penalty",
        shiftExpShade: "SHADE BREAK 13-15 — mandatory shaded rest 13:00-15:00, the hottest window, regardless of WBGT",
        shiftExpHalt: "PROACTIVE HALT — WBGT {wbgt} C is above the effective {workload} limit {eff} C ({rationale}); no outdoor work",
        shiftExpPacing: "PROACTIVE 30/30 PACING — WBGT {wbgt} C is above the effective {workload} limit {eff} C; 30 min work / 30 min shaded rest",
        shiftExpBuffer: "PRE-THRESHOLD BUFFER — WBGT {wbgt} C is within 1 C of the effective {workload} limit {eff} C; 45 min work / 15 min shaded rest",
        shiftExpSafe: "Safe continuous window — WBGT {wbgt} C is below the effective {workload} limit {eff} C; continuous work",
        chartTitle: "Hourly WBGT estimate, 6-day window",
        chartHeavy: "Heavy limit {limit} °C",
        chartModerate: "Moderate limit 28 °C",
        chartUnavailable: "Strain chart unavailable (chart library did not load). The table below has the same 6-day data.",
        strainThDate: "Date",
        strainThMaxTemp: "Max Temp (°C)",
        strainThNightMin: "Night Min (°C)",
        strainThMaxWbgt: "Max WBGT Est. (°C)",
        strainThHoursOver: "Hours > Heavy Limit ({limit}°C)",
        strainThDebt: "Nocturnal Recovery Debt (>28°C)",
        strainThPoints: "Daily Strain Points",
        strainThCumulative: "Cumulative Strain Index",
        strainThSource: "Source",
        strainObserved: "Observed",
        strainForecast: "Forecast",
        strainLegend: "Past 3 days + today so far: Observed (live Open-Meteo). Next 2 days: Forecast. Today mixes observed hours so far with forecast hours later today.",
        strainRed: "RED LINE CROSSED: 6-Day Cumulative Thermal Strain Index is {total} (Threshold: 12). Multi-day thermal debt and failed overnight cooling indicate high risk of acute heat exhaustion and renal strain.",
        strainBelow: "6-Day Cumulative Thermal Strain Index: {total} / 12 (Below red-line collapse threshold at +{spike}°C spike). Increase the Heat Spike Simulator slider to observe multi-day thermal debt accumulation.",
        dayReadout: "Day {day} ({date}): max WBGT {wbgt} °C, night min {night} °C, {points} strain points, cumulative {cum} / 12",
        dayReadoutRed: " — RED LINE CROSSED",
        dayReadoutHint: "Drag the slider to step through each day.",
        kpiPreventedLabel: "Unsafe Heavy-Work Hours Prevented",
        kpiPreventedDelta: "Hours > {limit} °C WBGT auto-restricted",
        kpiCoolingLabel: "Mandatory Cooling & Shade",
        kpiCoolingDelta: "{h} hrs total recovery time",
        kpiDebtLabel: "Active Nocturnal Debt Days (>28°C)",
        kpiDebtDelta: "Overnight recovery failure flag",
        shiftCaption: "Proactive plan — based on live WBGT now plus forecast hours",
        shiftIntro: "Projected Schedule for <code>{tomorrow}</code> (at +{spike}°C spike): Heavy labour restricted to <code>06:00–10:00</code>. Crews anonymised (<code>Crew A</code>, <code>Crew B</code>).",
        shiftThHour: "Hour",
        shiftThTemp: "Projected Temp (°C)",
        shiftThWbgt: "Projected WBGT (°C)",
        shiftThRatio: "Work / Rest Ratio",
        shiftThCrew: "Anonymised Crew Assignment",
        shiftThHydration: "Hydration Protocol",
        shiftThExplanation: "Explainable Schedule Adjustment",
        triageHydrationProtocol: "Hydration Protocol (coupled)",
        triageCorrelation: "Explainable Correlation",
        baPreventedDelta: "Hours > {limit} °C WBGT auto-restricted · {pct}% of schedule applied",
        baCoolingDelta: "{h} hrs total recovery time · {pct}% of schedule applied",
        triageEngine: "Active Triage Engine: {engine}",
        triageWorker: "Worker (Anonymised)",
        triageSeverity: "Symptom Severity",
        triageSymptoms: "Extracted Symptoms",
        triageHydration: "Hydration & Sweating Status",
        triageFriction: "PPE / Equipment Friction",
        triageTier: "Occupational Risk Tier",
        triageAction: "Immediate Action Required",
        triageArBroadcast: "Arabic Crew Broadcast (العربية)",
        triageHiBroadcast: "Hindi/Urdu Crew Broadcast",
        compareThSite: "Site",
        compareThCurrent: "Current WBGT (°C)",
        compareThSolar: "Solar (W/m²)",
        compareThMax: "6-Day Max WBGT (°C)",
        compareThDebt: "Debt Days",
        compareThTier: "Risk Tier",
        compareUnavailable: "Compare-sites table unavailable (Open-Meteo unreachable for one or more sites).",
        costCasesLabel: "Projected heat-exhaustion cases",
        costCasesDelta: "without intervention (est.)",
        costHospLabel: "Projected hospitalisations",
        costHospDelta: "~8% of cases (est.)",
        costCostLabel: "Projected cost",
        costCostDelta: "productivity + care (est.)",
        costPreventedLabel: "Prevented by ThermiGraph",
        costPreventedDelta: "{amount} saved (est.)",
        phoneHot: "HOT — STOP HEAVY WORK",
        phoneHigh: "HIGH STRAIN — REST OFTEN",
        phoneOk: "OK — WORK NORMALLY",
        roi1label: "Workers currently protected",
        roi1delta: "3 zones × 1,500 per zone (est.)",
        roi2label: "Physical WBGT meters replaced",
        roi2delta: "at $1,200 per unit (est.)",
        roi3label: "Annual hardware savings (est.)",
        roi3delta: "no per-site hardware",
        roi4label: "Heat-illness cases prevented / year",
        roi4delta: "ILO rate × exposure hours (est.)",
        clothingLight: "Light civilian (+0 °C)",
        clothingCoveralls: "Coveralls (+1 °C)",
        clothingPPE: "Construction PPE (+2 °C)",
        clothingSuit: "Impermeable suit (+4 °C)",
        loading: "Loading live telemetry from Open-Meteo…",
        pageError: "Page error: {msg} — the data below may be incomplete. Please click Refresh live data.",
        cacheWarning: "⚠️ Open-Meteo unreachable — showing last-good cached Abu Dhabi telemetry. Click 'Refresh live data' to retry.",
        liveUnavailable: "Live telemetry is unavailable right now (Open-Meteo could not be reached). Check network connection and click Refresh.",
        activeUnavailable: "Live telemetry for {site} unavailable — showing last-good reading.",
        hourlyUnavailable: "Hourly forecast for {site} unavailable — showing last-good 6-day window.",
        activeUnavailable2: "Live telemetry for {site} is unavailable.",
        hourlyUnavailable2: "Hourly forecast for {site} is unavailable.",
        mapUnavailable: "Map unavailable (map library did not load). Values are live.",
        mapFailed: "Map could not start. Values below are live.",
        compareMapFailed: "compare map failed: {msg}",
        loadingValue: "live value loading…",
        mapWbgt: "WBGT estimate",
        mapAir: "Air",
        mapRh: "RH",
        mapWind: "Wind",
        mapCurrent: "Current WBGT",
        mapTier: "Risk tier",
        mapAria1: "Map of the Abu Dhabi pilot corridor showing live WBGT for Mussafah, KEZAD and Ruwais. One circle per zone: bigger means hotter, colour is the NIOSH status.",
        mapAria2: "World map showing live WBGT for the four sentinel corridors: Mussafah, Lagos, Delhi and Houston. One circle per site: bigger means hotter, colour is the NIOSH status.",
        chartAria: "Chart of cumulative thermal strain over 6 days, with the red line at 12 points",
        s11intro: "ThermiGraph is a prototype. This section states what the science supports, what the code has been tested for, and what is not proven. No expert quote, clinician name, or real pilot is claimed here.",
        s11hFormula: "WBGT formula",
        s11formula: "Outdoors, in direct sun: WBGT = <span class=\"tg-keep-ltr\">0.7 × natural wet bulb + 0.2 × black globe + 0.1 × dry bulb</span>. In shade or indoors: WBGT = <span class=\"tg-keep-ltr\">0.7 × natural wet bulb + 0.3 × black globe</span>. ThermiGraph uses the outdoor weighting, with wet bulb by the Stull formula and black globe estimated from solar radiation. That is a prototype simplification of the Liljegren model below, not a calibrated meter reading.",
        s11hNiosh: "NIOSH work limits",
        s11niosh: "Recommended Exposure Limits, acclimatised workers, continuous work: Light <span class=\"tg-keep-ltr\">30 °C</span>, Moderate <span class=\"tg-keep-ltr\">28 °C</span>, Heavy <span class=\"tg-keep-ltr\">26 °C</span>, Very heavy <span class=\"tg-keep-ltr\">25 °C</span>. Unacclimatised workers are <span class=\"tg-keep-ltr\">2–3 °C</span> lower. Above the limit, NIOSH prescribes work/rest scheduling: <span class=\"tg-keep-ltr\">45 work / 15 rest</span>, then <span class=\"tg-keep-ltr\">30 / 30</span>, then <span class=\"tg-keep-ltr\">15 / 45</span>, then stop. Since v22 ThermiGraph uses the effective limit, not the acclimatised limit: base NIOSH limit minus the acclimatisation penalty (<span class=\"tg-keep-ltr\">0 / 1.5 / 2.5 °C</span>) and the multi-day debt penalty (<span class=\"tg-keep-ltr\">0.5 / 1.0 °C</span>).",
        s11hMulti: "Multi-day strain and kidney injury",
        s11multi: "The ThermiGraph claim is that heat stroke and acute kidney injury come from multi-day cumulative strain, not a single hot afternoon. In the Florida farmworker study below, over half of workers started the day dehydrated, <span class=\"tg-keep-ltr\">81%</span> were dehydrated after a day of work, and one third had acute kidney injury at least once during three summer workdays. The odds of acute kidney injury rose <span class=\"tg-keep-ltr\">47%</span> for each <span class=\"tg-keep-ltr\">5-degree</span> increase in heat index, and kidney injury prevalence rose from <span class=\"tg-keep-ltr\">21%</span> to <span class=\"tg-keep-ltr\">43%</span> over three years in fernery workers. That supports tracking strain over 6 days and flagging failed overnight recovery when the night minimum stays above <span class=\"tg-keep-ltr\">28 °C</span>.",
        s11hValid: "Validation tests: <span class=\"tg-keep-ltr\">9 / 9</span> passed",
        s11validIntro: "Validation tests passed in the 2026-11-21 check, run with no network, no Groq, and no patient data:",
        s11v1: "Stull wet bulb: <span class=\"tg-keep-ltr\">29.1 °C, 43% RH</span> gives a wet bulb of <span class=\"tg-keep-ltr\">20.3 °C</span>.",
        s11v2: "WBGT formula: <span class=\"tg-keep-ltr\">0.7 / 0.2 / 0.1</span> weighting on fixed wet bulb, globe and dry bulb inputs.",
        s11v3: "Live Mussafah WBGT estimate: <span class=\"tg-keep-ltr\">25.4 °C</span> at <span class=\"tg-keep-ltr\">29.1 °C, 43% RH, 631 W/m²</span> solar.",
        s11v4: "NIOSH limits: Light <span class=\"tg-keep-ltr\">30</span>, Moderate <span class=\"tg-keep-ltr\">28</span>, Heavy <span class=\"tg-keep-ltr\">26</span>, Very heavy <span class=\"tg-keep-ltr\">25 °C</span>.",
        s11v5: "Work/rest ratios: <span class=\"tg-keep-ltr\">60/0</span> up to <span class=\"tg-keep-ltr\">25 °C</span>, <span class=\"tg-keep-ltr\">45/15</span> at <span class=\"tg-keep-ltr\">25–26 °C</span>, <span class=\"tg-keep-ltr\">30/30</span> at <span class=\"tg-keep-ltr\">26–28 °C</span>, no outdoor work above <span class=\"tg-keep-ltr\">28 °C</span>.",
        s11v6: "Daily strain points: <span class=\"tg-keep-ltr\">1 point</span> at <span class=\"tg-keep-ltr\">25.4 °C</span>, <span class=\"tg-keep-ltr\">3 points</span> above <span class=\"tg-keep-ltr\">28 °C</span>, plus <span class=\"tg-keep-ltr\">1 point</span> for recovery debt.",
        s11v7: "Recovery debt: night minimum above <span class=\"tg-keep-ltr\">28 °C</span> flags yes, at or below <span class=\"tg-keep-ltr\">28 °C</span> flags no.",
        s11v8: "Triage model: the sample note returns Critical, with vomiting and stopped sweating in the symptoms.",
        s11v9: "Psychrometric table agreement: Stull wet bulb matches the published ASHRAE table within <span class=\"tg-keep-ltr\">0.7 °C</span> across <span class=\"tg-keep-ltr\">10 points</span> at <span class=\"tg-keep-ltr\">35 °C, 10–100% RH</span>, largest deviation <span class=\"tg-keep-ltr\">0.64 °C</span>.",
        s11hLimits: "Limitations, in plain words",
        s11l1: "WBGT is estimated from weather data, not measured with a globe meter.",
        s11l2: "Globe temperature is estimated from solar radiation, not measured.",
        s11l3: "Clothing correction (ISO 7243 Annex C, <span class=\"tg-keep-ltr\">+0 / +1 / +2 / +4 °C</span>) IS applied via the Clothing / PPE selector in Section 2. Acclimatisation IS now modelled via the Section 2 selector (effective limit, v22). Age and medical history are still not modelled.",
        s11l4: "The cumulative score of 12 is a prototype score, not a clinical threshold.",
        s11l5: "Triage is structured extraction from a typed note, not a medical diagnosis.",
        s11l6: "No real crew, no real shift, and no real meter reading are claimed.",
        s11expert: "Expert review: none yet. No clinician has reviewed this prototype. That section will only be filled by a real reviewer, with name, qualification, organisation and date, and only with their consent.",
        s11hRefs: "References",
        navLiveMap: "1. Live Map",
        navSimulator: "2. Simulator",
        navStrain: "3. 6-Day Strain",
        navShift: "4. Shift Plan",
        navTriage: "5. AI Triage",
        navGlobal: "7. Global",
        navRoi: "8. ROI",
        navWorker: "10. Worker App",
        navEvidence: "11. Evidence",
        triageLoading: "⚡ Live Groq AI analyzing telemetry & 6-day debt…",
        effBannerLabel: "Effective limit",
    };
    const AR = {
        title: "ثرميغراف — محرك الإجهاد الحراري",
        subtitle: "محرك الأرصاد الحيوية والفرز الميداني | تحدي الابتكار الصحي الرقمي 2026",
        disclaimer: "قيم WBGT تقديرات أولية من قياسات الطقس، وليست قراءات معايرة من مقياس كروي في الموقع.",
        tagline: "من ساعة حارة واحدة إلى دين فسيولوجي يمتد 6 أيام — ثرميغراف يكشف انهيار الحرارة قبل اليوم الثالث.",
        refresh: "🔄 تحديث البيانات المباشرة",
        themeLight: "☀️ فاتح",
        themeDark: "🌙 داكن",
        footer: "ثرميغراف — نموذج أولي لتحدي الابتكار الصحي الرقمي 2026. البيانات المباشرة: Open-Meteo. قيم WBGT تقديرات أولية من قياسات الطقس، وليست قراءات معايرة من مقياس كروي في الموقع. ليس جهازاً طبياً.",
        pill1: "قياسات Open-Meteo المباشرة",
        pill2: "فيزياء ISO 7243 · NIOSH",
        pill3: "فرز يحفظ الخصوصية",
        kicker1: "قياسات البلد المضيف",
        kicker2: "محاكاة الحارس العالمي",
        kicker3: "الدين الفسيولوجي متعدد الأيام",
        kicker4: "تدوير الطاقم الديناميكي",
        kicker5: "الاستخراج السريري المنظم",
        kicker6: "سجل التدقيق والحوكمة",
        kicker7: "المقارنة عبر القارات",
        kicker8: "اقتصاديات النظام الصحي وأصحاب العمل",
        kicker9: "نموذج اكتواري تفاعلي",
        kicker10: "العدالة الميدانية للعامل",
        kickerDemo: "التحكم في العرض التجريبي المباشر",
        h2s1: "1. قياسات WBGT المباشرة (ممر أبوظبي التجريبي المضيف)",
        h2s2: "2. محدد موقع العمل العالمي ومحاكي موجة الحر",
        h2s3: "3. الإجهاد التراكمي على مدى 6 أيام ودين الاسترداد الليلي",
        h2s4: "4. مُحسِّن الورديات والراحة الآلي",
        h2s5: "5. فرز سجلات الميدان بالذكاء الاصطناعي والإرسال متعدد اللغات للطاقم (يحافظ على الخصوصية)",
        h2s6: "6. تقرير الامتثال والفرز القابل للتصدير",
        h2s7: "7. عرض المقارنة العالمية بين المواقع",
        h2s8: "8. لوحة الأثر والعائد على الاستثمار (على نطاق تجريبي)",
        h2s9: "9. حاسبة كلفة التقاعس",
        h2s10: "10. عرض العامل",
        h2s11: "11. الأدلة السريرية والتحقق",
        kicker11: "الأدلة والحدود",
        clothingLabel: "الملابس / معدات الوقاية (ISO 7243 الملحق ج)",
        workloadLabel: "شدة العمل (الحد الأساسي لـ NIOSH)",
        workloadLight: "خفيف (30 °C)",
        workloadModerate: "متوسط (28 °C)",
        workloadHeavy: "شاق (26 °C)",
        workloadVeryHeavy: "شاق جداً (25 °C)",
        acclimLabel: "التأقلم (يخفض الحد الفعال)",
        acclimAcclimatised: "متأقلم (−0.0 °C)",
        acclimPartial: "متأقلم جزئياً (−1.5 °C)",
        acclimUnacclimatised: "غير متأقلم (−2.5 °C)",
        exposureLabel: "التعرض للشمس (درجة حرارة الكرة السوداء)",
        exposureOpenSun: "شمس مفتوحة",
        exposureHighAlbedo: "انعكاس عالٍ (خرسانة / رمل ساطع، الكرة +1.5 °C)",
        exposureShaded: "مظلل (الكرة = درجة حرارة الهواء)",
        gpsBtn: "📍 استخدام GPS موقع العمل المباشر",
        autoPollOn: "🔴 التحديث التلقائي المباشر (60 ث): يعمل",
        autoPollOff: "⚪ التحديث التلقائي المباشر (60 ث): متوقف",
        gpsFailed: "فشل GPS المباشر: {msg} — يتم الاحتفاظ بموقع العمل الحالي.",
        gpsUnsupported: "هذا المتصفح لا يدعم GPS المباشر — يتم الاحتفاظ بموقع العمل الحالي.",
        gpsOk: "تم تعيين موقع العمل المباشر: {lat}، {lon}.",
        telemetryLive: "بث Open-Meteo المباشر ({ms} مللي ثانية، {time} UTC)",
        lagosBtn: "▶ لاغوس +6°م عرض تجريبي",
        mussafahBtn: "↺ العودة إلى مصفح",
        triageBtn: "🚀 تشغيل الفرز",
        reportBtn: "⬇️ تنزيل تقرير الامتثال (.txt)",
        s1: "1. قياسات WBGT المباشرة (ممر أبوظبي التجريبي)",
        s2: "2. محدد موقع العمل العالمي ومحاكي موجة الحر",
        s3: "3. الإجهاد الحراري التراكمي لمدة 6 أيام",
        s4: "4. مُحسِّن الورديات والراحة",
        s5: "5. فرز سجلات الميدان بالذكاء الاصطناعي",
        s6: "6. تقرير الامتثال القابل للتنزيل",
        s7: "7. مقارنة المواقع العالمية",
        s8: "8. الأثر والعائد على الاستثمار",
        s9: "9. حاسبة تكلفة التقاعس",
        s10: "10. عرض العامل",
        s11: "11. الأدلة السريرية والتحقق",
        docTitle: "ثرميغراف — مركز القيادة للأرصاد الحيوية",
        installApp: "تثبيت التطبيق",
        installed: "تم التثبيت",
        pwaReady: "التطبيق جاهز للتثبيت",
        pwaAvailable: "التثبيت متاح",
        pwaDismissed: "تم تجاهل التثبيت — انقر على تثبيت التطبيق للمحاولة مجدداً",
        pwaMenuFallback: "للتثبيت: استخدم قائمة المتصفح > تثبيت التطبيق / إضافة إلى الشاشة الرئيسية",
        pwaInstalled: "تم تثبيت التطبيق",
        pwaSwFailed: "التثبيت غير متاح: فشل عامل الخدمة",
        pwaNoSw: "التثبيت غير متاح: المتصفح لا يدعم عامل الخدمة",
        tourBtn: "▶ تشغيل القصة — جولة تجريبية موجّهة",
        tourPrev: "رجوع →",
        tourNext: "التالي ←",
        tourNextLast: "إنهاء ✓",
        tourExit: "✕ إنهاء الجولة",
        tourStep: "الخطوة {i} من {n}",
        s1cap1: "خريطة حقيقية لممر أبوظبي التجريبي. دائرة واحدة لكل منطقة: كلما كبرت الدائرة كان الجو أحرّ (حجم الدائرة يتناسب مع WBGT المباشر). اللون يدل على حالة NIOSH.",
        s1cap2: "ألوان الأشرطة حسب WBGT الحالي: أخضر أقل من <span class=\"tg-keep-ltr\">25 °C</span>، كهرماني <span class=\"tg-keep-ltr\">25–26 °C</span>، برتقالي <span class=\"tg-keep-ltr\">26–28 °C</span>، أحمر أكثر من <span class=\"tg-keep-ltr\">28 °C</span>.",
        siteLabel: "اختر موقع العمل النشط لمحاكاة المعمّقة وجدول الإجهاد لمدة 6 أيام وخطة الورديات",
        customLat: "خط العرض المخصص",
        customLon: "خط الطول المخصص",
        spikeLabel: "محاكاة شذوذ موجة حر شديدة (<span class=\"tg-keep-ltr\">+°C</span> تُضاف إلى القياسات المباشرة)",
        nioshTitle: "حدود NIOSH لشدة العمل (عمّال متأقلمون، عمل متواصل)",
        nioshTitleAccl: "حدود NIOSH لشدة العمل (عمّال متأقلمون، عمل متواصل)",
        nioshTitleUnaccl: "حدود NIOSH لشدة العمل (عمّال غير متأقلمين، عمل متواصل)",
        isoCaption: "يتبع WBGT ترجيح ISO 7243 (<span class=\"tg-keep-ltr\">0.7 البصيلة الرطبة + 0.2 الكرة السوداء + 0.1 البصيلة الجافة</span>).",
        s3cap: "مؤشر الإجهاد الحراري التراكمي هو درجة خطر أولية قابلة للتفسير (<span class=\"tg-keep-ltr\">0–4</span> نقاط/يوم من ذروة WBGT + دين الاستشفاء الليلي فوق <span class=\"tg-keep-ltr\">28°C</span>)، وليس تشخيصاً سريرياً.",
        daySliderLabel: "📅 مرّر عبر الأيام الستة — وشاهد الإجهاد يتراكم",
        baLabel: "⚖️ قبل / بعد — اسحب لتطبيق جدول الراحة",
        ba0: "<span class=\"tg-keep-ltr\">0%</span> — بدون جدول راحة",
        ba100: "<span class=\"tg-keep-ltr\">100%</span> — جدول راحة كامل",
        s4cap: "يتغير الرقمان أعلاه مع المنزلق: عند <span class=\"tg-keep-ltr\">0%</span> لا يُمنع شيء، وعند <span class=\"tg-keep-ltr\">100%</span> يُطبَّق الجدول كاملاً.",
        caseLabel: "اختر سيناريو الحالة السريرية الميدانية (أو عدّل الملاحظة أدناه)",
        noteLabel: "ملاحظة المشرف الميدانية (إنجليزي/عربي/هندي — تُحجب أسماء العمال تلقائياً)",
        s5cap: "الحد: استخراج منظم للفرز المهني الوقائي فقط — وليس تشخيصاً طبياً. تُحجب الأسماء على مستوى الطاقم.",
        s6body: "نزّل تقرير الامتثال الكامل: القياسات المباشرة للمناطق، وموقع العمل النشط والموجة، ومؤشر الإجهاد لمدة 6 أيام، وخطة الورديات، وآخر فرز مجهول الهوية، وإفصاحات النطاق.",
        s7body: "جدول واحد، أربعة ممرات حارسة، نفس الفيزياء والحدود. هذه هي الحجة بأن ثرميغراف عالمي.",
        s7cap: "خريطة العالم: دائرة واحدة لكل ممر حارس، كلما كبرت كان أحرّ (حجم الدائرة يتناسب مع WBGT المباشر). اللون يدل على حالة NIOSH. WBGT الحالي هو القراءة المباشرة؛ وأقصى WBGT خلال 6 أيام وأيام الدين تستخدم نفس النافذة المتداولة والحدود كما في القسم 3.",
        s8body: "تقديرات على نطاق تجريبي لممر أبوظبي المضيف. جميع الأرقام تقديرات تخطيطية، ومصنّفة بوضوح.",
        s8cap: "تقديرات للتخطيط فقط. تكلفة الأجهزة = السعر المنشور لمقياس WBGT معايَر بكرة سوداء <span class=\"tg-keep-ltr\">150 mm</span>؛ ومعدلات الحالات تتبع تقارير منظمة العمل الدولية عن الإجهاد الحراري المهني.",
        coWorkersLabel: "العمال المعرضون",
        coDaysLabel: "أيام التعرض",
        coWbgtLabel: "WBGT في الموقع (<span class=\"tg-keep-ltr\">°C</span>)",
        s9cap: "نموذج توضيحي، وليس علم وبائيات: معدل الحدوث <span class=\"tg-keep-ltr\">0.3</span> حالة / <span class=\"tg-keep-ltr\">1,000</span> عامل / يوم / درجة مئوية فوق حد العمل الشاق <span class=\"tg-keep-ltr\">26 °C</span>؛ <span class=\"tg-keep-ltr\">8%</span> يدخلون المستشفى؛ <span class=\"tg-keep-ltr\">$400</span> للحالة، و<span class=\"tg-keep-ltr\">$4,000</span> لكل دخول مستشفى؛ والراحة الإلزامية تخفض الحالات المتوقعة بنسبة <span class=\"tg-keep-ltr\">65%</span>. النشر الحقيقي سيُعاير وفق سجلات السلامة والصحة المهنية الخاصة بالموقع والخطوط المرجعية الإقليمية لمنظمة العمل الدولية / منظمة الصحة العالمية.",
        s10body: "نفس البيانات، مبسطة للعامل الذي يحمل الهاتف. رقم واحد، وإجراء واحد، ووعد واحد.",
        demoLabel: "🎬 منزلق العرض — اسحب لترى رد فعل الهاتف",
        phoneEyebrow: "تنبيه العامل على الجوال",
        phoneAction: "💧 <b>اشرب كوباً واحداً من محلول الإماهة الفموية (ORS) الآن، ثم استرح في الظل.</b>",
        phonePromise: "🛡️ <b>الإبلاغ عن الأعراض لن يؤثر على أجرك.</b>",
        s10cap: "عرض العامل نموذج تجريبي: نفس WBGT المباشر في لوحة المشرف، مختصراً في حالة واحدة وإجراء واحد والوعد بعدم العقاب.",
        gaugeLabel: "الإجهاد التراكمي",
        gaugeRedline: "الخط الأحمر <span class=\"tg-keep-ltr\">12</span>",
        gaugeMax: "<span class=\"tg-keep-ltr\">24</span> كحد أقصى",
        zoneWbgtLabel: "تقدير WBGT في {zone}",
        zoneDelta: "الهواء: {air}°C | الرطوبة: {rh}% | الرياح: {wind} كم/ساعة",
        liveCaption: "قراءات مباشرة حتى {time} (التوقيت المحلي للموقع، Open-Meteo).",
        liveBadge: "مباشر",
        liveSource: "المصدر: Open-Meteo · يُحدَّث كل 60 ثانية · حتى {time}",
        wbgtEstimate: "تقدير WBGT من درجة حرارة الهواء المباشرة والرطوبة والإشعاع الشمسي والرياح (بصيلة رطبة Stull + كرة شمسية معدلة للرياح) — وليس قراءة من مقياس WBGT فيزيائي.",
        spikedLabel: "WBGT في {site} (مع الموجة)",
        alertCritical: "حرج: تجاوز WBGT بعد الموجة الحد الفعال للعمل {workload} \u2066{limit} °C\u2069 بأكثر من 2.5 °C. يجب إيقاف العمل الشاق والمتوسط المتواصل في الخارج.",
        alertHigh: "إجهاد مرتفع: تجاوز WBGT بعد الموجة الحد الفعال للعمل {workload} \u2066{limit} °C\u2069. يلزم تناوب صارم للعمل والراحة على فترات قصيرة.",
        effRationale: "الحد الفعال للعمل {workload} \u2066{eff} °C\u2069 = حد NIOSH الأساسي \u2066{base} °C\u2069 - \u2066{pen} °C\u2069 (التأقلم -\u2066{acclimPen} °C\u2069؛ {debt} -\u2066{debtPen} °C\u2069)",
        effDebtRedline: "الإجهاد التراكمي \u2066{n}\u2069 ≥ 12 (تم تجاوز الخط الأحمر)",
        effDebtMultiday: "دين متعدد الأيام: \u2066{days}\u2069 أيام دين ليلي، الإجهاد التراكمي \u2066{n}\u2069",
        effDebtNone: "لا توجد غرامة دين متعدد الأيام",
        shiftExpShade: "استراحة الظل 13-15 — استراحة إلزامية في الظل 13:00-15:00، وهي أشد فترة حرارة، بغض النظر عن WBGT",
        shiftExpHalt: "إيقاف استباقي — WBGT \u2066{wbgt} °C\u2069 أعلى من الحد الفعال للعمل {workload} \u2066{eff} °C\u2069 ({rationale})؛ لا عمل في الخارج",
        shiftExpPacing: "إيقاع استباقي 30/30 — WBGT \u2066{wbgt} °C\u2069 أعلى من الحد الفعال للعمل {workload} \u2066{eff} °C\u2069؛ 30 دقيقة عمل / 30 دقيقة استراحة في الظل",
        shiftExpBuffer: "هامش ما قبل الحد — WBGT \u2066{wbgt} °C\u2069 ضمن 1 °C من الحد الفعال للعمل {workload} \u2066{eff} °C\u2069؛ 45 دقيقة عمل / 15 دقيقة استراحة في الظل",
        shiftExpSafe: "نافذة عمل متواصل آمنة — WBGT \u2066{wbgt} °C\u2069 أقل من الحد الفعال للعمل {workload} \u2066{eff} °C\u2069؛ عمل متواصل",
        chartTitle: "تقدير WBGT بالساعة، نافذة 6 أيام",
        chartHeavy: "حد العمل الشاق \u2066{limit} °C\u2069",
        chartModerate: "حد العمل المتوسط \u206628 °C\u2069",
        chartUnavailable: "مخطط الإجهاد غير متاح (لم تُحمّل مكتبة المخططات). الجدول أدناه يحتوي على نفس بيانات الأيام الستة.",
        strainThDate: "التاريخ",
        strainThMaxTemp: "أقصى درجة حرارة (°C)",
        strainThNightMin: "أدنى درجة حرارة ليلاً (°C)",
        strainThMaxWbgt: "أقصى تقدير WBGT (°C)",
        strainThHoursOver: "ساعات فوق حد العمل الشاق ({limit}°C)",
        strainThDebt: "دين الاستشفاء الليلي (>28°C)",
        strainThPoints: "نقاط الإجهاد اليومية",
        strainThCumulative: "مؤشر الإجهاد التراكمي",
        strainThSource: "المصدر",
        strainObserved: "ملاحَظ",
        strainForecast: "متوقَّع",
        strainLegend: "الأيام الثلاثة الماضية + اليوم حتى الآن: ملاحَظ (Open-Meteo مباشرة). اليومان التاليان: متوقَّع. اليوم يمزج الساعات الملاحَظة حتى الآن مع ساعات متوقَّعة لاحقاً اليوم.",
        strainRed: "تم تجاوز الخط الأحمر: مؤشر الإجهاد الحراري التراكمي لمدة 6 أيام هو {total} (الحد: 12). الدين الحراري متعدد الأيام وفشل التبريد الليلي يشيران إلى خطر مرتفع للإنهاك الحراري الحاد والإجهاد الكلوي.",
        strainBelow: "مؤشر الإجهاد الحراري التراكمي لمدة 6 أيام: {total} / 12 (أدنى من حد الانهيار عند موجة \u2066+{spike}°C\u2069). ارفع منزلق محاكي موجة الحر لملاحظة تراكم الدين الحراري متعدد الأيام.",
        dayReadout: "اليوم {day} ({date}): أقصى WBGT \u2066{wbgt} °C\u2069، أدنى درجة ليلاً \u2066{night} °C\u2069، \u2066{points}\u2069 نقطة إجهاد، التراكمي \u2066{cum}\u2069 / 12",
        dayReadoutRed: " — تم تجاوز الخط الأحمر",
        dayReadoutHint: "اسحب المنزلق للتنقل بين الأيام.",
        kpiPreventedLabel: "ساعات العمل الشاق غير الآمنة التي تم منعها",
        kpiPreventedDelta: "ساعات فوق \u2066{limit} °C\u2069 WBGT مقيّدة تلقائياً",
        kpiCoolingLabel: "التبريد والظل الإلزامي",
        kpiCoolingDelta: "{h} ساعة إجمالي وقت الاستشفاء",
        kpiDebtLabel: "أيام دين الاستشفاء الليلي النشطة (>28°C)",
        kpiDebtDelta: "مؤشر فشل الاستشفاء الليلي",
        shiftCaption: "خطة استباقية — مبنية على WBGT المباشر الآن إضافة إلى ساعات متوقَّعة",
        shiftIntro: "الجدول المتوقع ليوم <code>{tomorrow}</code> (عند موجة \u2066+{spike}°C\u2069): العمل الشاق مقيّد من <code>06:00–10:00</code>. الأطقم مجهولة الهوية (<code>الطاقم أ</code>، <code>الطاقم ب</code>).",
        shiftThHour: "الساعة",
        shiftThTemp: "درجة الحرارة المتوقعة (°C)",
        shiftThWbgt: "WBGT المتوقع (°C)",
        shiftThRatio: "نسبة العمل / الاستراحة",
        shiftThCrew: "إسناد الطاقم (مجهول الهوية)",
        shiftThHydration: "بروتوكول الترطيب",
        shiftThExplanation: "تعديل الجدول القابل للتفسير",
        triageHydrationProtocol: "بروتوكول الترطيب (مترابط)",
        triageCorrelation: "الارتباط القابل للتفسير",
        baPreventedDelta: "ساعات فوق \u2066{limit} °C\u2069 WBGT مقيّدة تلقائياً · تم تطبيق \u2066{pct}%\u2069 من الجدول",
        baCoolingDelta: "{h} ساعة إجمالي وقت الاستشفاء · تم تطبيق \u2066{pct}%\u2069 من الجدول",
        triageEngine: "محرك الفرز النشط: {engine}",
        triageWorker: "العامل (مجهول الهوية)",
        triageSeverity: "شدة الأعراض",
        triageSymptoms: "الأعراض المستخلصة",
        triageHydration: "حالة الترطيب والتعرق",
        triageFriction: "معدات الوقاية / احتكاك المعدات",
        triageTier: "مستوى الخطر المهني",
        triageAction: "الإجراء الفوري المطلوب",
        triageArBroadcast: "بث الطاقم بالعربية",
        triageHiBroadcast: "بث الطاقم بالهندية/الأردية",
        compareThSite: "الموقع",
        compareThCurrent: "WBGT الحالي (°C)",
        compareThSolar: "الإشعاع الشمسي (واط/م²)",
        compareThMax: "أقصى WBGT خلال 6 أيام (°C)",
        compareThDebt: "أيام الدين",
        compareThTier: "مستوى الخطر",
        compareUnavailable: "جدول مقارنة المواقع غير متاح (تعذّر الوصول إلى Open-Meteo لموقع أو أكثر).",
        costCasesLabel: "الحالات المتوقعة للإنهاك الحراري",
        costCasesDelta: "بدون تدخل (تقدير)",
        costHospLabel: "حالات الدخول إلى المستشفى المتوقعة",
        costHospDelta: "نحو 8% من الحالات (تقدير)",
        costCostLabel: "التكلفة المتوقعة",
        costCostDelta: "الإنتاجية + الرعاية (تقدير)",
        costPreventedLabel: "ما يمنعه ثرميغراف",
        costPreventedDelta: "تم توفير {amount} (تقدير)",
        phoneHot: "حار — توقف عن العمل الشاق",
        phoneHigh: "إجهاد مرتفع — استرح كثيراً",
        phoneOk: "بخير — اعمل بشكل طبيعي",
        roi1label: "العمال المحميون حالياً",
        roi1delta: "3 مناطق × 1,500 عامل لكل منطقة (تقدير)",
        roi2label: "أجهزة قياس WBGT الفيزيائية المستبدلة",
        roi2delta: "بسعر 1,200 دولار للجهاز (تقدير)",
        roi3label: "وفورات الأجهزة السنوية (تقدير)",
        roi3delta: "بدون أجهزة لكل موقع",
        roi4label: "حالات أمراض الحرارة التي تُمنع / سنة",
        roi4delta: "معدل منظمة العمل الدولية × ساعات التعرض (تقدير)",
        clothingLight: "ملابس مدنية خفيفة (\u2066+0 °C\u2069)",
        clothingCoveralls: "أفرول — ملابس عمل كاملة (\u2066+1 °C\u2069)",
        clothingPPE: "معدات الوقاية الشخصية للبناء (\u2066+2 °C\u2069)",
        clothingSuit: "بدلة غير منفذة (\u2066+4 °C\u2069)",
        loading: "جارٍ تحميل القياسات المباشرة من Open-Meteo…",
        pageError: "خطأ في الصفحة: {msg} — قد تكون البيانات أدناه غير مكتملة. يرجى النقر على تحديث البيانات المباشرة.",
        cacheWarning: "⚠️ تعذّر الوصول إلى Open-Meteo — تُعرض آخر قياسات محفوظة لممر أبوظبي. انقر على تحديث البيانات المباشرة لإعادة المحاولة.",
        liveUnavailable: "القياسات المباشرة غير متاحة حالياً (تعذّر الوصول إلى Open-Meteo). تحقق من الاتصال بالإنترنت وانقر على تحديث.",
        activeUnavailable: "القياسات المباشرة لموقع {site} غير متاحة — تُعرض آخر قراءة محفوظة.",
        hourlyUnavailable: "التوقعات بالساعة لموقع {site} غير متاحة — تُعرض آخر نافذة 6 أيام محفوظة.",
        activeUnavailable2: "القياسات المباشرة لموقع {site} غير متاحة.",
        hourlyUnavailable2: "التوقعات بالساعة لموقع {site} غير متاحة.",
        mapUnavailable: "الخريطة غير متاحة (لم تُحمّل مكتبة الخرائط). القيم مباشرة.",
        mapFailed: "تعذّر تشغيل الخريطة. القيم أدناه مباشرة.",
        compareMapFailed: "فشلت خريطة المقارنة: {msg}",
        loadingValue: "جارٍ تحميل القيمة المباشرة…",
        mapWbgt: "تقدير WBGT",
        mapAir: "الهواء",
        mapRh: "الرطوبة",
        mapWind: "الرياح",
        mapCurrent: "WBGT الحالي",
        mapTier: "مستوى الخطر",
        mapAria1: "خريطة ممر أبوظبي التجريبي تُظهر WBGT المباشر لمصفح وكيزاد والرويس. دائرة واحدة لكل منطقة: كلما كبرت كان الجو أحرّ، واللون يدل على حالة NIOSH.",
        mapAria2: "خريطة العالم تُظهر WBGT المباشر للممرات الحارسة الأربعة: مصفح ولاغوس ودلهي وهيوستن. دائرة واحدة لكل موقع: كلما كبرت كان الجو أحرّ، واللون يدل على حالة NIOSH.",
        chartAria: "مخطط الإجهاد الحراري التراكمي على مدى 6 أيام، مع الخط الأحمر عند 12 نقطة",
        s11intro: "ثرميغراف نموذج أولي. يوضح هذا القسم ما يدعمه العلم، وما تم اختبار الكود عليه، وما لم يُثبت بعد. لا يُدَّعى هنا أي اقتباس من خبير أو اسم طبيب أو تجربة حقيقية.",
        s11hFormula: "معادلة WBGT",
        s11formula: "في الخارج، تحت الشمس المباشرة: WBGT = <span class=\"tg-keep-ltr\">0.7 × البصيلة الرطبة الطبيعية + 0.2 × الكرة السوداء + 0.1 × البصيلة الجافة</span>. وفي الظل أو في الداخل: WBGT = <span class=\"tg-keep-ltr\">0.7 × البصيلة الرطبة الطبيعية + 0.3 × الكرة السوداء</span>. يستخدم ثرميغراف الترجيح الخارجي، مع البصيلة الرطبة بمعادلة ستول والكرة السوداء المقدَّرة من الإشعاع الشمسي. هذا تبسيط أولي لنموذج ليليغرين أدناه، وليس قراءة معايرة من مقياس.",
        s11hNiosh: "حدود NIOSH للعمل",
        s11niosh: "حدود التعرض الموصى بها، للعمال المتأقلمين، في العمل المتواصل: خفيف <span class=\"tg-keep-ltr\">30 °C</span>، متوسط <span class=\"tg-keep-ltr\">28 °C</span>، شاق <span class=\"tg-keep-ltr\">26 °C</span>، شاق جداً <span class=\"tg-keep-ltr\">25 °C</span>. والعمال غير المتأقلمين أقل بمقدار <span class=\"tg-keep-ltr\">2–3 °C</span>. وفوق الحد، توصي NIOSH بجدولة العمل والراحة: <span class=\"tg-keep-ltr\">45 عمل / 15 استراحة</span>، ثم <span class=\"tg-keep-ltr\">30 / 30</span>، ثم <span class=\"tg-keep-ltr\">15 / 45</span>، ثم التوقف. ومنذ الإصدار v22 يستخدم ثرميغراف الحد الفعال، وليس حد المتأقلمين: الحد الأساسي لـ NIOSH ناقص جزاء التأقلم (<span class=\"tg-keep-ltr\">0 / 1.5 / 2.5 °C</span>) وجزاء الدين متعدد الأيام (<span class=\"tg-keep-ltr\">0.5 / 1.0 °C</span>).",
        s11hMulti: "الإجهاد متعدد الأيام وإصابة الكلى",
        s11multi: "يدّعي ثرميغراف أن ضربة الشمس وإصابة الكلى الحادة تأتيان من الإجهاد التراكمي متعدد الأيام، وليس من ظهيرة حارة واحدة. وفي دراسة عمال المزارع في فلوريدا أدناه، بدأ أكثر من نصف العمال يومهم وهم يعانون الجفاف، وأصيب <span class=\"tg-keep-ltr\">81%</span> بالجفاف بعد يوم عمل، وأصيب ثلثهم بإصابة كلى حادة مرة واحدة على الأقل خلال ثلاثة أيام عمل صيفية. وارتفعت احتمالات إصابة الكلى الحادة بنسبة <span class=\"tg-keep-ltr\">47%</span> مع كل زيادة <span class=\"tg-keep-ltr\">5 درجات</span> في مؤشر الحرارة، وارتفع انتشار إصابة الكلى من <span class=\"tg-keep-ltr\">21%</span> إلى <span class=\"tg-keep-ltr\">43%</span> خلال ثلاث سنوات لدى عمال السراخس. وهذا يدعم تتبع الإجهاد على مدى 6 أيام وتنبيه فشل الاستشفاء الليلي عندما يبقى الحد الأدنى الليلي فوق <span class=\"tg-keep-ltr\">28 °C</span>.",
        s11hValid: "اختبارات التحقق: <span class=\"tg-keep-ltr\">9 / 9</span> ناجحة",
        s11validIntro: "نجحت اختبارات التحقق في فحص 2026-11-21، وأُجريت دون شبكة ودون Groq ودون بيانات مرضى:",
        s11v1: "البصيلة الرطبة بمعادلة ستول: <span class=\"tg-keep-ltr\">29.1 °C, 43% RH</span> تعطي بصيلة رطبة قدرها <span class=\"tg-keep-ltr\">20.3 °C</span>.",
        s11v2: "معادلة WBGT: ترجيح <span class=\"tg-keep-ltr\">0.7 / 0.2 / 0.1</span> على مدخلات ثابتة للبصيلة الرطبة والكرة السوداء والبصيلة الجافة.",
        s11v3: "تقدير WBGT المباشر في مصفح: <span class=\"tg-keep-ltr\">25.4 °C</span> عند <span class=\"tg-keep-ltr\">29.1 °C, 43% RH, 631 W/m²</span> من الإشعاع الشمسي.",
        s11v4: "حدود NIOSH: خفيف <span class=\"tg-keep-ltr\">30</span>، متوسط <span class=\"tg-keep-ltr\">28</span>، شاق <span class=\"tg-keep-ltr\">26</span>، شاق جداً <span class=\"tg-keep-ltr\">25 °C</span>.",
        s11v5: "نسب العمل/الراحة: <span class=\"tg-keep-ltr\">60/0</span> حتى <span class=\"tg-keep-ltr\">25 °C</span>، و<span class=\"tg-keep-ltr\">45/15</span> عند <span class=\"tg-keep-ltr\">25–26 °C</span>، و<span class=\"tg-keep-ltr\">30/30</span> عند <span class=\"tg-keep-ltr\">26–28 °C</span>، ولا عمل في الخارج فوق <span class=\"tg-keep-ltr\">28 °C</span>.",
        s11v6: "نقاط الإجهاد اليومية: <span class=\"tg-keep-ltr\">1</span> نقطة عند <span class=\"tg-keep-ltr\">25.4 °C</span>، و<span class=\"tg-keep-ltr\">3</span> نقاط فوق <span class=\"tg-keep-ltr\">28 °C</span>، إضافة إلى <span class=\"tg-keep-ltr\">1</span> نقطة لدين الاستشفاء.",
        s11v7: "دين الاستشفاء: الحد الأدنى الليلي فوق <span class=\"tg-keep-ltr\">28 °C</span> يعني نعم، وعند <span class=\"tg-keep-ltr\">28 °C</span> أو أقل يعني لا.",
        s11v8: "نموذج الفرز: الملاحظة النموذجية تعيد نتيجة حرجة، مع القيء وتوقف التعرق ضمن الأعراض.",
        s11v9: "مطابقة جدول القياسات النفسية: البصيلة الرطبة بمعادلة ستول تطابق الجدول المنشور لـ ASHRAE ضمن <span class=\"tg-keep-ltr\">0.7 °C</span> عبر <span class=\"tg-keep-ltr\">10</span> نقاط عند <span class=\"tg-keep-ltr\">35 °C، ورطوبة نسبية 10–100%</span>، وأكبر انحراف <span class=\"tg-keep-ltr\">0.64 °C</span>.",
        s11hLimits: "الحدود، بكلمات بسيطة",
        s11l1: "يُقدَّر WBGT من بيانات الطقس، ولا يُقاس بمقياس كروي.",
        s11l2: "تُقدَّر درجة حرارة الكرة السوداء من الإشعاع الشمسي، ولا تُقاس.",
        s11l3: "تصحيح الملابس (ISO 7243 الملحق ج، <span class=\"tg-keep-ltr\">+0 / +1 / +2 / +4 °C</span>) يُطبَّق فعلاً عبر محدد الملابس / معدات الوقاية في القسم 2. التأقلم يُنمذج الآن فعلاً عبر محدد القسم 2 (الحد الفعال، v22). أما العمر والتاريخ الطبي فلا يُنمذجان بعد.",
        s11l4: "الدرجة التراكمية 12 هي درجة أولية، وليست حداً سريرياً.",
        s11l5: "الفرز استخراج منظم من ملاحظة مكتوبة، وليس تشخيصاً طبياً.",
        s11l6: "لا يُدَّعى وجود طاقم حقيقي أو وردية حقيقية أو قراءة مقياس حقيقية.",
        s11expert: "مراجعة الخبراء: لا يوجد بعد. لم يراجع أي طبيب سريري هذا النموذج الأولي. ولن يُملأ هذا القسم إلا بمراجع حقيقي، مع الاسم والمؤهل والمنظمة والتاريخ، وبموافقته فقط.",
        s11hRefs: "المراجع",
        navLiveMap: "1. الخريطة المباشرة",
        navSimulator: "2. المحاكي",
        navStrain: "3. الإجهاد 6 أيام",
        navShift: "4. خطة الوردية",
        navTriage: "5. الفرز بالذكاء الاصطناعي",
        navGlobal: "7. عالمي",
        navRoi: "8. العائد",
        navWorker: "10. تطبيق العامل",
        navEvidence: "11. الأدلة",
        triageLoading: "⚡ الذكاء الاصطناعي المباشر من Groq يحلل القياسات وديون 6 أيام…",
        effBannerLabel: "الحد الفعال",
    };

    // v20 helpers: lookup with EN fallback, placeholder fill, and the
    // Arabic names for zones / sites / clothing / cases. Numbers, units,
    // formulas and dates stay LTR: tables and metric values are pinned
    // with .tg-keep-ltr (v19), and Arabic prose that embeds a number
    // carries a U+2066..U+2069 isolate around it in the AR strings.
    function isAr() { return state.lang === "ar"; }
    function t(key) { const T = isAr() ? AR : EN; const v = T[key]; return v !== undefined ? v : (EN[key] !== undefined ? EN[key] : key); }
    function tf(key, map) { let s = t(key); if (map) for (const k of Object.keys(map)) s = s.split("{" + k + "}").join(String(map[k])); return s; }
    const ZONE_AR = { "Mussafah (UAE)": "مصفح (Mussafah)", "KEZAD / Khalifa Port (UAE)": "كيزاد / ميناء خليفة (KEZAD)", "Ruwais (UAE)": "الرويس (Ruwais)" };
    const SITE_AR = { "Mussafah (UAE — Host Pilot)": "مصفح (الإمارات — الموقع التجريبي المضيف)", "KEZAD / Khalifa Port (UAE — Host Pilot)": "كيزاد / ميناء خليفة (الإمارات — الموقع التجريبي المضيف)", "Ruwais (UAE — Host Pilot)": "الرويس (الإمارات — الموقع التجريبي المضيف)", "Lagos — Lekki Industrial Zone (Nigeria / West Africa)": "لاغوس — منطقة ليكي الصناعية (نيجيريا / غرب أفريقيا)", "Delhi NCR — Industrial Belt (India / South Asia)": "دلهي — الحزام الصناعي (الهند / جنوب آسيا)", "Houston — Petrochemical Corridor (USA / North America)": "هيوستن — ممر البتروكيماويات (الولايات المتحدة / أمريكا الشمالية)", "Custom Global GPS Coordinates (Any Worksite Worldwide)": "إحداثيات GPS مخصصة (أي موقع عمل في العالم)" };
    const COMPARE_AR = { "Mussafah (UAE)": "مصفح (الإمارات)", "Lagos (Nigeria)": "لاغوس (نيجيريا)", "Delhi NCR (India)": "دلهي (الهند)", "Houston (USA)": "هيوستن (الولايات المتحدة)" };
    const WORK_AR = { "Light": "خفيف", "Moderate": "متوسط", "Heavy": "شاق", "Very heavy": "شاق جداً" };
    // v28.1: definite forms, used when the workload sits inside an
    // Arabic phrase ("الحد الفعال للعمل الشاق", not "للعمل شاق").
    const WORK_AR_DEF = { "Light": "الخفيف", "Moderate": "المتوسط", "Heavy": "الشاق", "Very heavy": "الشاق جداً" };
    const SEV_AR = { "Critical": "حرجة", "High": "عالية", "Moderate": "متوسطة", "Low": "منخفضة" };
    const TIER_AR = { "Critical": "حرجة", "High": "عالية", "Moderate": "متوسطة", "Low": "منخفضة" };
    const CASE_AR = { "Case 1: Acute CNS Heat Stroke & Anhydrosis (Critical Red Flag)": "الحالة 1: ضربة شمس حادة مع توقف التعرق (علامة حرجة)", "Case 2: Early Renal Strain / Dehydration & Muscle Cramps (High Risk)": "الحالة 2: إجهاد كلوي مبكر / جفاف وتشنجات عضلية (خطر مرتفع)", "Case 3: Multilingual Field Note (Arabic / Hindi-Urdu / English)": "الحالة 3: ملاحظة ميدانية متعددة اللغات (العربية / الهندية-الأردية / الإنجليزية)", "Case 4: Unacclimatised New Cohort + Multi-Day Cumulative Strain (Proactive Escalation)": "الحالة 4: مجموعة جديدة غير متأقلمة + إجهاد تراكمي متعدد الأيام (تصعيد استباقي)" };
    const CLOTHING_AR = { "light_civilian": "ملابس مدنية خفيفة", "coveralls": "أفرول — ملابس عمل كاملة", "construction_ppe": "معدات الوقاية الشخصية للبناء", "impermeable_suit": "بدلة غير منفذة" };
    const SHORT_AR = { "Mussafah": "مصفح", "KEZAD": "كيزاد", "Ruwais": "الرويس", "Lagos": "لاغوس", "Delhi": "دلهي", "Houston": "هيوستن" };
    const PROTOCOL_AR = { "NO OUTDOOR WORK": "لا عمل في الخارج", "30 work / 30 rest": "30 عمل / 30 استراحة", "45 work / 15 rest": "45 عمل / 15 استراحة", "60 work / 0 rest": "60 عمل / 0 استراحة", "SHADE BREAK (No outdoor work)": "استراحة الظل (لا عمل في الخارج)" };
    const CREW_AR = { "All Crews — Work Suspended (Over Limit)": "جميع الأطقم — توقف العمل (تجاوز الحد)", "Crew A (Heavy Labour Window)": "الطاقم أ (نافذة العمل الشاق)", "Crew A (Light Work Only)": "الطاقم أ (أعمال خفيفة فقط)", "Crew B (Afternoon Light Rotation)": "الطاقم ب (تناوب بعد الظهر للأعمال الخفيفة)", "All Crews — Mandatory Shaded Rest": "جميع الأطقم — استراحة إلزامية في الظل" };
    const TRIAGE_AR = {
        "Critical": { tier: "حرجة — علامات حمراء لضربة شمس حادة (توقف التعرق / القيء)", action: "أوقف العمل فوراً: ابدأ التبريد النشط السريع (كمادات ثلج على الرقبة والإبطين والفخذين، ورذاذ ماء مبرّد) واطلب الإخلاء الطبي الطارئ." },
        "High": { tier: "عالية — إجهاد حراري مع جفاف وإجهاد كلوي", action: "انقل العامل فوراً إلى محطة تبريد مظللة، وقدّم 500 مل من محلول الإماهة الفموية (ORS)، وأحله إلى العيادة المهنية في الموقع لفحص العلامات الحيوية والترطيب الكلوي." },
        "Moderate": { tier: "متوسطة — مراقبة وقائية للإجهاد الحراري", action: "طبّق تناوب الراحة في الظل 30/30 وقدّم 250 مل من الماء المزوّد بالإلكتروليت كل 20 دقيقة." },
    };
    const ENGINE_AR = "محرك الفرز السريري الحتمي (دون اتصال / دون مفتاح)";
    function zoneName(name) { return isAr() ? (ZONE_AR[name] || name) : name; }
    function siteName(label) { return isAr() ? (SITE_AR[label] || label) : label; }
    function compareName(name) { return isAr() ? (COMPARE_AR[name] || name) : name; }
    function shortAr(name) {
        if (!isAr()) return name;
        if (SHORT_AR[name]) return SHORT_AR[name];
        if (name.indexOf("Custom Site") === 0) return "موقع مخصص " + name.slice("Custom Site".length);
        return name;
    }
    // Triage result content is derived from the typed note, so symptoms /
    // hydration / friction stay as entered (English). Only the fixed
    // wrapper (worker summary, tier, action) is translated.
    // v28: client-side PII redaction backup for the triage worker summary.
    // The Cloudflare Worker already enforces "[Worker - Anonymised]"
    // server-side; this is defence in depth and must never alter a
    // correctly anonymised summary (it already contains the marker).
    function redactWorkerSummary(s) {
        if (!s) return s;
        if (s.indexOf("[Worker - Anonymised]") !== -1) return s;
        const comma = s.indexOf(",");
        if (comma > 0) {
            const head = s.slice(0, comma).trim();
            if (/^[A-Z][a-z]+ [A-Z][a-z]+$/.test(head)) return "[Worker - Anonymised]" + s.slice(comma);
        }
        return "[Worker - Anonymised] - " + s;
    }
    function translateSummary(s) {
        s = redactWorkerSummary(s);
        if (!isAr() || !s) return s;
        return s.replace("[Worker - Anonymised]", "[عامل — مجهول الهوية]")
            .replace("Adult worker", "عامل بالغ").replace("Global Site", "موقع عالمي")
            .replace("Age ", "العمر ").replace(" industrial crew (Site WBGT: ", " طاقم صناعي (WBGT في الموقع: ")
            .replace(" C)", " °C)");
    }
    function translateTierAction(r) {
        if (!isAr()) return { tier: r.oshaRiskTier, action: r.immediateAction };
        const tr = TRIAGE_AR[r.symptomSeverity];
        if (!tr) return { tier: r.oshaRiskTier, action: r.immediateAction };
        return { tier: tr.tier + " — WBGT " + state.spikedWbgt.toFixed(1) + " °C", action: tr.action };
    }
    // v28.1: hydration protocol strings are built in logic.js in
    // English (four fixed texts + an optional bolus suffix). Map
    // them to Arabic at render time, like PROTOCOL_AR. Unknown text
    // (e.g. a live Groq triage protocol) passes through unchanged.
    const HYDRATION_AR = {
        "1000 mL/hr chilled ORS, every 15 min": "1000 مل/ساعة محلول إماهة فموية مبرّد، كل 15 دقيقة",
        "750 mL/hr chilled ORS, every 20 min": "750 مل/ساعة محلول إماهة فموية مبرّد، كل 20 دقيقة",
        "500 mL/hr ORS, every 30 min": "500 مل/ساعة محلول إماهة فموية، كل 30 دقيقة",
        "350 mL/hr baseline hydration": "350 مل/ساعة ترطيب أساسي",
    };
    const HYDRATION_BOLUS_EN = " + 500 mL pre-shift morning ORS bolus (nocturnal debt)";
    const HYDRATION_BOLUS_AR = " + 500 مل جرعة صباحية من محلول الإماهة الفموية قبل الوردية (دين ليلي)";
    function translateHydration(text) {
        if (!isAr() || !text) return text;
        let base = text, hasBolus = false;
        if (text.slice(-HYDRATION_BOLUS_EN.length) === HYDRATION_BOLUS_EN) {
            base = text.slice(0, -HYDRATION_BOLUS_EN.length);
            hasBolus = true;
        }
        const ar = HYDRATION_AR[base];
        if (!ar) return text;
        return ar + (hasBolus ? HYDRATION_BOLUS_AR : "");
    }
    // v28.1: render the effective-limit rationale from the structured
    // parts logic.js returns (effectiveWorkLimit [3]). The English
    // template reproduces the logic.js rationale string byte for byte;
    // the Arabic template is the same breakdown in Arabic.
    function rationaleDebtText(p) {
        if (p.debtKind === "redline") return tf("effDebtRedline", { n: p.debtStrain });
        if (p.debtKind === "multiday") return tf("effDebtMultiday", { days: p.debtDays, n: p.debtStrain });
        return t("effDebtNone");
    }
    function rationaleText(effInfoOrParts) {
        const p = Array.isArray(effInfoOrParts) ? effInfoOrParts[3] : effInfoOrParts;
        if (!p) return Array.isArray(effInfoOrParts) ? effInfoOrParts[2] : "";
        return tf("effRationale", {
            workload: isAr() ? (WORK_AR_DEF[p.workload] || p.workload) : p.workload,
            eff: p.effLimit.toFixed(1), base: p.base.toFixed(1), pen: p.totalPen.toFixed(1),
            acclimPen: p.acclimPen.toFixed(1), debt: rationaleDebtText(p), debtPen: p.debtPen.toFixed(1),
        });
    }
    // v28.1: render a shift-schedule explanation from its structured
    // parts (computeShiftSchedule rows carry explanationParts). The
    // English templates reproduce the logic.js strings byte for byte.
    function shiftExplanationText(row) {
        const p = row.explanationParts;
        if (!p) return row.explanation || "";
        const workload = isAr() ? (WORK_AR_DEF[p.workload] || p.workload) : p.workload;
        const base = { wbgt: p.wbgt.toFixed(1), workload: workload, eff: p.effLimit.toFixed(1) };
        if (p.kind === "SHADE") return t("shiftExpShade");
        if (p.kind === "HALT") return tf("shiftExpHalt", Object.assign({}, base, { rationale: rationaleText(p.rationaleParts) }));
        if (p.kind === "PACING") return tf("shiftExpPacing", base);
        if (p.kind === "BUFFER") return tf("shiftExpBuffer", base);
        return tf("shiftExpSafe", base);
    }
    // Map tooltip / popup labels, with the number pinned LTR.
    function mapLabel(name, wbgt) {
        const n = zoneName(name);
        return isAr() ? (n + " — <span dir=\"ltr\">" + wbgt.toFixed(1) + " °C</span>") : (name + " — " + wbgt.toFixed(1) + " °C");
    }
    function mapPopup(r) {
        const num = "<span dir=\"ltr\">" + r.wbgt.toFixed(1) + " °C</span>";
        if (!isAr()) {
            return "<b>" + esc(r.zone) + "</b><br>" + t("mapWbgt") + ": <b>" + r.wbgt.toFixed(1) + " °C</b>" +
                (r.air !== undefined ? "<br>" + t("mapAir") + ": " + r.air.toFixed(1) + " °C · " + t("mapRh") + ": " + r.rh.toFixed(0) + "% · " + t("mapWind") + ": " + r.wind.toFixed(1) + " km/h" : "");
        }
        return "<b>" + esc(zoneName(r.zone)) + "</b><br>" + t("mapWbgt") + ": <b>" + num + "</b>" +
            (r.air !== undefined ? "<br>" + t("mapAir") + ": <span dir=\"ltr\">" + r.air.toFixed(1) + " °C</span> · " + t("mapRh") + ": <span dir=\"ltr\">" + r.rh.toFixed(0) + "%</span> · " + t("mapWind") + ": <span dir=\"ltr\">" + r.wind.toFixed(1) + " km/h</span>" : "");
    }
    function compareLabel(site, wbgt) {
        const n = compareName(site);
        if (wbgt === undefined || wbgt === null) return isAr() ? (n + " — " + t("loadingValue")) : (site + " — live value loading…");
        return isAr() ? (n + " — <span dir=\"ltr\">" + wbgt.toFixed(1) + " °C</span>") : (site + " — " + wbgt.toFixed(1) + " °C");
    }
    function comparePopup(site, wbgt, tier) {
        const n = compareName(site);
        if (wbgt === undefined || wbgt === null) return "<b>" + esc(n) + "</b><br>" + t("loadingValue");
        const tierAr = isAr() ? (TIER_AR[tier] || tier) : tier;
        return isAr()
            ? ("<b>" + esc(n) + "</b><br>" + t("mapCurrent") + ": <b><span dir=\"ltr\">" + wbgt.toFixed(1) + " °C</span></b><br>" + t("mapTier") + ": " + esc(tierAr))
            : ("<b>" + esc(site) + "</b><br>" + t("mapCurrent") + ": <b>" + wbgt.toFixed(1) + " °C</b><br>" + t("mapTier") + ": " + esc(tierAr));
    }

    // Saved language ("en" default). Read once at boot; invalid values fall back to "en".
    function savedLang() {
        try {
            const v = localStorage.getItem("thermigraph_lang");
            return v === "ar" ? "ar" : "en";
        } catch (e) { return "en"; }
    }

    // ------------------------------------------------------------------
    // State
    // ------------------------------------------------------------------
    const state = {
        theme: "light",
        lang: savedLang(),
        siteLabel: "Mussafah (UAE — Host Pilot)",
        spike: 0,
        demoSpike: 0,
        clothing: "light_civilian",
        workload: "Heavy",
        acclimatization: "acclimatised",
        exposure: "open_sun",
        autoPoll: true,
        lastLatencyMs: 0,
        autoPollTimer: null,
        customLat: 24.3613,
        customLon: 54.5038,
        live: null,          // { zoneName: { current, solar, wbgt, wetBulb, globe } }
        liveTime: "",
        activeLive: null,    // { current, solar } for the active site
        activeHourly: null,  // hourly dict for the active site
        activeName: "Mussafah",
        spikedWbgt: 0,
        spikedTw: 0,
        spikedTg: 0,
        totalStrain: 0,
        debtDays: 0,
        preventedHours: 0,
        coolingMinutes: 0,
        shiftTomorrow: "",
        triage: null,        // { result, engine }
        compareRows: null,
        chartDrawn: false,
        dailyRows: null,    // Section 3 daily strain rows (for the day scrubber)
        dayScrub: 6,        // Section 3 scrubber position (1-6, default last day)
        tourIndex: -1,      // guided tour step (-1 = not running)
        map: null,           // Leaflet map instance (Section 1, Abu Dhabi corridor)
        mapTile: null,       // Leaflet tile layer (swapped on theme change)
        mapSat: null,        // Leaflet satellite tile layer
        mapMarkers: {},      // zone name -> Leaflet circleMarker
        mapRings: {},        // zone name -> pulsing ring marker
        compareMap: null,    // Leaflet map instance (Section 7, world compare sites)
        compareMapTile: null,
        compareMapSat: null,
        compareMapMarkers: {},
        compareMapRings: {},
        compareMapFitted: false, // true once the Section 7 view is fitted to all sites
    };

    // Short helpers
    function $(id) { return document.getElementById(id); }
    function el(tag, cls, text) {
        const n = document.createElement(tag);
        if (cls) n.className = cls;
        if (text !== undefined && text !== null) n.textContent = text;
        return n;
    }
    function esc(s) {
        return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
    }

    // ------------------------------------------------------------------
    // Number animation: count a metric smoothly to its new value.
    // This is the JavaScript-only richness Streamlit cannot do: the number
    // glides instead of jumping when the spike slider moves.
    // ------------------------------------------------------------------
    function animateNumber(node, to, decimals, suffix) {
        if (!node) return;
        const from = parseFloat(node.dataset.value || "0");
        const start = performance.now();
        const dur = 600;
        function frame(now) {
            // Clamp p to [0, 1]: if the clock ever jumps backwards, the
            // easing must not explode into a huge negative number.
            const p = Math.max(0, Math.min(1, (now - start) / dur));
            const eased = 1 - Math.pow(1 - p, 3); // ease-out cubic
            const v = from + (to - from) * eased;
            node.textContent = v.toFixed(decimals) + (suffix || "");
            if (p < 1) requestAnimationFrame(frame);
            else node.dataset.value = String(to);
        }
        node.dataset.value = String(to);
        requestAnimationFrame(frame);
    }

    // ------------------------------------------------------------------
    // Open-Meteo fetching (no key needed) + last-good cache
    // ------------------------------------------------------------------
    const OM_BASE = "https://api.open-meteo.com/v1/forecast";
    // v22: record the round-trip time of every Open-Meteo call and
    // show it in the telemetry heartbeat (Section 2), so a judge can
    // see the stream is live, not a cached screenshot.
    function updateHeartbeat() {
        const node = $("telemetryHeartbeat");
        if (!node) return;
        const time = new Date().toISOString().slice(11, 19);
        node.textContent = tf("telemetryLive", { ms: state.lastLatencyMs, time: time });
        // v25 polish: brief green flash on every live poll so the
        // 60 s Open-Meteo stream is visibly ticking.
        node.classList.remove("tg-heartbeat-tick");
        void node.offsetWidth;
        node.classList.add("tg-heartbeat-tick");
    }
    async function omFetch(params) {
        const q = new URLSearchParams(params);
        const t0 = (typeof performance !== "undefined" && performance.now) ? performance.now() : Date.now();
        const res = await fetch(OM_BASE + "?" + q.toString());
        const t1 = (typeof performance !== "undefined" && performance.now) ? performance.now() : Date.now();
        state.lastLatencyMs = Math.round(t1 - t0);
        updateHeartbeat();
        if (!res.ok) throw new Error("Open-Meteo HTTP " + res.status);
        return res.json();
    }
    function cacheGet(key) {
        try {
            const raw = localStorage.getItem(key);
            if (!raw) return null;
            const obj = JSON.parse(raw);
            if (Date.now() - obj.at > 3600 * 1000) return null; // older than 1 hour
            return obj.data;
        } catch (e) { return null; }
    }
    function cacheSet(key, data) {
        try { localStorage.setItem(key, JSON.stringify({ at: Date.now(), data: data })); } catch (e) { /* storage full/blocked */ }
    }

    // Live reading + solar for one coordinate (mirrors Python fetch_live_raw).
    async function fetchLiveRaw(lat, lon) {
        const data = await omFetch({
            latitude: lat, longitude: lon,
            current: "temperature_2m,relative_humidity_2m,wind_speed_10m",
            hourly: "shortwave_radiation", timezone: "auto", forecast_days: "1",
        });
        const current = data.current;
        const hour = current.time.slice(0, 13);
        let solar = 0.0;
        try {
            const idx = data.hourly.time.map(function (t) { return t.slice(0, 13); }).indexOf(hour);
            solar = (idx >= 0 && data.hourly.shortwave_radiation[idx] != null) ? data.hourly.shortwave_radiation[idx] : 0.0;
        } catch (e) { solar = 0.0; }
        return { current: current, solar: solar };
    }

    // 6-day hourly window: past 3 + today + next 2 (mirrors fetch_hourly_raw).
    async function fetchHourlyRaw(lat, lon) {
        const data = await omFetch({
            latitude: lat, longitude: lon,
            hourly: "temperature_2m,relative_humidity_2m,wind_speed_10m,shortwave_radiation",
            timezone: "auto", past_days: "3", forecast_days: "3",
        });
        return data.hourly;
    }

    function showStatus(msg, isError) {
        const b = $("statusBanner");
        if (!msg) { b.hidden = true; b.textContent = ""; return; }
        b.hidden = false;
        b.textContent = msg;
        b.style.background = isError ? "rgba(244,63,94,0.10)" : "rgba(245,158,11,0.10)";
        b.style.borderColor = isError ? "rgba(244,63,94,0.4)" : "rgba(245,158,11,0.4)";
        b.style.color = isError ? "var(--red)" : "";
    }

    // ------------------------------------------------------------------
    // Active site resolution
    // ------------------------------------------------------------------
    function activeCoords() {
        const coords = L.GLOBAL_SITES[state.siteLabel];
        if (coords) return { lat: coords[0], lon: coords[1], name: state.siteLabel.split(" (")[0] };
        return { lat: state.customLat, lon: state.customLon, name: "Custom Site (" + state.customLat.toFixed(2) + ", " + state.customLon.toFixed(2) + ")" };
    }
    // v19 FIX: the Custom Latitude/Longitude fields showed Lagos (6.4402 /
    // 4.0193) while the worksite was Mussafah. They are hidden unless
    // Custom is selected, and when shown they are filled with the active
    // site's coordinates (Mussafah by default), never the Lagos defaults.
    function syncCustomGpsInputs() {
        const isCustom = L.GLOBAL_SITES[state.siteLabel] === null;
        $("customGps").hidden = !isCustom;
        if (isCustom) {
            $("customLat").value = String(state.customLat);
            $("customLon").value = String(state.customLon);
        }
    }

    // ------------------------------------------------------------------
    // Rendering — Section 1 (live zones + 3D map)
    // ------------------------------------------------------------------
    const ZONE_TO_SITE = {
        "Mussafah (UAE)": "Mussafah (UAE — Host Pilot)",
        "KEZAD / Khalifa Port (UAE)": "KEZAD / Khalifa Port (UAE — Host Pilot)",
        "Ruwais (UAE)": "Ruwais (UAE — Host Pilot)",
    };

    function zoneRiskMeta(wbgt) {
        if (wbgt > 28.0) return { cardCls: "risk-red", badgeCls: "tg-badge-red", label: isAr() ? "حرج" : "CRITICAL" };
        if (wbgt > 26.0) return { cardCls: "risk-orange", badgeCls: "tg-badge-amber", label: isAr() ? "مرتفع" : "HIGH" };
        if (wbgt > 25.0) return { cardCls: "risk-amber", badgeCls: "tg-badge-amber", label: isAr() ? "حذر" : "CAUTION" };
        return { cardCls: "", badgeCls: "tg-badge-green", label: isAr() ? "آمن" : "SAFE" };
    }

    function renderZoneCards() {
        const wrap = $("zoneCards");
        wrap.innerHTML = "";
        if (!state.live) return;
        for (const name of Object.keys(L.ZONES)) {
            const z = state.live[name];
            const meta = zoneRiskMeta(z.wbgt);
            const card = el("div", "tg-metric tg-zone-interactive" + (meta.cardCls ? " " + meta.cardCls : ""));
            card.setAttribute("role", "button");
            card.tabIndex = 0;
            card.title = isAr() ? "انقر لفحص هذا الموقع في المحاكي" : "Click to inspect this corridor in the simulator";

            const header = el("div", "tg-zone-header");
            const label = el("div", "tg-metric-label", tf("zoneWbgtLabel", { zone: zoneName(name) }));
            const pill = el("span", "tg-badge " + meta.badgeCls, meta.label);
            header.appendChild(label);
            header.appendChild(pill);

            const value = el("div", "tg-metric-value tg-keep-ltr");
            const delta = el("div", "tg-metric-delta tg-keep-ltr",
                tf("zoneDelta", { air: z.current.temperature_2m, rh: z.current.relative_humidity_2m, wind: z.current.wind_speed_10m }));
            const hint = el("div", "tg-zone-hint", isAr() ? "انقر للتحليل ←" : "Click to inspect →");

            const selectZone = async function () {
                const targetSite = ZONE_TO_SITE[name];
                if (!targetSite) return;
                state.siteLabel = targetSite;
                $("siteSelect").value = targetSite;
                syncCustomGpsInputs();
                await loadActive();
                const s2 = $("section2");
                if (s2) s2.scrollIntoView({ behavior: "smooth", block: "start" });
            };
            card.addEventListener("click", selectZone);
            card.addEventListener("keydown", function (ev) {
                if (ev.key === "Enter" || ev.key === " ") { ev.preventDefault(); selectZone(); }
            });

            card.appendChild(header);
            card.appendChild(value);
            card.appendChild(delta);
            card.appendChild(hint);
            wrap.appendChild(card);
            animateNumber(value, z.wbgt, 1, " °C");
        }
        $("liveCaption").innerHTML = tf("liveCaption", { time: '&nbsp;<span class="tg-keep-ltr">' + state.liveTime + "</span>" });
        const ls = $("liveSource");
        if (ls) ls.innerHTML = tf("liveSource", { time: '&nbsp;<span class="tg-keep-ltr">' + state.liveTime + "</span>" });
    }

    function zoneRows() {
        if (!state.live) return [];
        return Object.keys(L.ZONES).map(function (name) {
            const lat = L.ZONES[name][0], lon = L.ZONES[name][1];
            const wbgt = state.live[name].wbgt;
            const cur = state.live[name].current || {};
            return { lat: lat, lon: lon, zone: name, wbgt: wbgt, color: L.wbgtColor(wbgt),
                air: cur.temperature_2m, rh: cur.relative_humidity_2m, wind: cur.wind_speed_10m };
        });
    }

    // Satellite tiles (Esri World Imagery, free, no key) for the map's
    // street / satellite toggle.
    function leafletSatUrl() {
        return "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}";
    }

    // ------------------------------------------------------------------
    // Leaflet map — a REAL Abu Dhabi basemap with one circle per zone.
    // Why Leaflet: deck.gl rendered a blank box, and the 2D canvas drew bars
    // but no geography, so the user saw floating green bars and no map.
    // Leaflet is a small, battle-tested 2D map library (no WebGL, no API
    // key) and the CartoDB Voyager / Dark Matter tiles are the same basemaps
    // the Streamlit version uses, so both versions show the same map.
    // One circle per zone: bigger means hotter, colour is the NIOSH status.
    // ------------------------------------------------------------------
    // Tile source: OpenStreetMap standard tiles (free, no API key).
    // CARTO's raster tiles were used first, but they now return watermarked
    // "API KEY REQUIRED" tiles, so the map background was blank white with
    // that watermark on every tile. OSM needs no key and works in both themes.
    function leafletTileUrl(isDark) {
        return "https://tile.openstreetmap.org/{z}/{x}/{y}.png";
    }

    // Show the zone cards in place of the map, with a visible reason.
    // Used both when Leaflet fails to load and when the map throws: a map
    // failure must never break the data load or leave a silent blank box.
    function showMapFallback(reason) {
        const container = $("mapContainer");
        const fallback = $("mapFallback");
        container.hidden = true;
        fallback.hidden = false;
        fallback.innerHTML = "";
        for (const r of zoneRows()) {
            const card = el("div", "tg-zone-card");
            const c = "rgba(" + r.color[0] + "," + r.color[1] + "," + r.color[2] + ",1)";
            card.innerHTML = "<div class='tg-zone-name'>" + esc(r.zone) + "</div>" +
                "<div class='tg-zone-wbgt' style='color:" + c + "'>" + r.wbgt.toFixed(1) + " °C</div>" +
                "<div class='tg-metric-delta'>" + esc(reason) + "</div>";
            fallback.appendChild(card);
        }
        if (!zoneRows().length) {
            fallback.innerHTML = "<p class='tg-body'>" + esc(reason) + "</p>";
        }
    }

    // Fit the Section 1 map to the three Abu Dhabi zones. Called once when
    // the map is created and again after the box settles, so the zones are
    // spread out and their labels do not overlap.
    function fitAbuDhabi() {
        if (!state.map) return;
        const zb = Object.keys(L.ZONES).map(function (n) { return [L.ZONES[n][0], L.ZONES[n][1]]; });
        // v14 FIX (live check 2026-11-16): Ruwais, the southernmost zone,
        // was cut off at the bottom edge of the map in the first viewport.
        // Root cause: fitBounds padding was only 36 px, so the Ruwais
        // circle and its pulsing ring sat right on the bottom edge.
        // Fix: 70 px padding on all sides (zooms out slightly so every
        // circle, ring and label has clear space), and re-fit after the
        // page settles (see the extra 900 ms timeout in renderMap).
        state.map.fitBounds(window.L.latLngBounds(zb), { padding: [70, 70] });
    }

    function renderMap() {
        const container = $("mapContainer");
        const fallback = $("mapFallback");
        if (typeof window.L === "undefined" || !window.L.map) {
            // Leaflet did not load (CDN blocked): show the zone cards.
            showMapFallback(t("mapUnavailable"));
            return;
        }
        try {
        container.hidden = false;
        fallback.hidden = true;
        const isDark = state.theme === "dark";
        if (!state.map) {
            state.map = window.L.map(container, { scrollWheelZoom: false });
            state.mapTile = window.L.tileLayer(leafletTileUrl(isDark), {
                maxZoom: 19,
                attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
            }).addTo(state.map);
            state.mapSat = window.L.tileLayer(leafletSatUrl(), {
                maxZoom: 19,
                attribution: "Tiles &copy; Esri &mdash; Source: Esri, Maxar, Earthstar Geographics",
            });
            window.L.control.layers({ "Street": state.mapTile, "Satellite": state.mapSat }).addTo(state.map);
            // v25 polish: dark-mode Street tiles get the dark filter;
            // Satellite stays full colour.
            state.mapBaseStreet = true;
            container.classList.toggle("tg-map-dark-tiles", isDark);
            state.map.on("baselayerchange", function (ev) {
                state.mapBaseStreet = (ev.name === "Street");
                container.classList.toggle("tg-map-dark-tiles", state.theme === "dark" && state.mapBaseStreet);
            });
            state.mapMarkers = {};
            state.mapRings = {};
            // Leaflet needs the box to have its final size; re-check after
            // the page settles and whenever the window resizes.
            window.addEventListener("resize", function () { if (state.map) { state.map.invalidateSize(); fitAbuDhabi(); } });
            setTimeout(function () { if (state.map) { state.map.invalidateSize(); fitAbuDhabi(); } }, 300);
            // v14: second re-fit after the fade-in finishes, so the map
            // is fitted to its final settled size, not its mid-animation size.
            setTimeout(function () { if (state.map) { state.map.invalidateSize(); fitAbuDhabi(); } }, 900);
            // Fit the view to the three Abu Dhabi zones so they are spread
            // out and their labels do not overlap (a fixed zoom on the whole
            // peninsula bunched them at the edge with hidden labels).
            fitAbuDhabi();
        } else {
            state.mapTile.setUrl(leafletTileUrl(isDark));
            container.classList.toggle("tg-map-dark-tiles", isDark && state.mapBaseStreet !== false);
        }
        for (const r of zoneRows()) {
            const c = "rgb(" + r.color[0] + "," + r.color[1] + "," + r.color[2] + ")";
            // Radius in px: ~22 at WBGT 21.9, ~46 at WBGT 34.9.
            const radius = Math.round(14 + Math.max(0, r.wbgt - 15) * 1.6);
            const label = mapLabel(r.zone, r.wbgt);
            // Click popup: the zone's live numbers, so a judge can tap a dot
            // and see the details without scrolling to the cards above.
            const popup = mapPopup(r);
            // Pulse speed: hotter zones pulse faster (1.2s red, 1.8s amber, 2.4s green).
            const pulseDur = r.wbgt > 28 ? "1.2s" : (r.wbgt > 26 ? "1.8s" : "2.4s");
            if (!state.mapMarkers[r.zone]) {
                const marker = window.L.circleMarker([r.lat, r.lon], {
                    radius: radius, color: c, weight: 2, fillColor: c, fillOpacity: 0.55,
                }).addTo(state.map);
                marker.bindTooltip(label, {
                    permanent: true, direction: "top",
                    offset: window.L.point(0, -radius - 8), className: "tg-map-label",
                });
                marker.bindPopup(popup);
                state.mapMarkers[r.zone] = marker;
                // Pulsing ring around the dot: a larger, hollow circle that
                // fades in and out via the tg-pulse-ring CSS animation.
                const ring = window.L.circleMarker([r.lat, r.lon], {
                    radius: radius + 10, color: c, weight: 2, fillColor: c, fillOpacity: 0,
                    className: "tg-pulse-ring", interactive: false,
                }).addTo(state.map);
                try { const ringEl = ring.getElement(); if (ringEl) ringEl.style.animationDuration = pulseDur; } catch (e) { /* ignore */ }
                state.mapRings[r.zone] = ring;
            } else {
                const marker = state.mapMarkers[r.zone];
                marker.setLatLng([r.lat, r.lon]);
                marker.setRadius(radius);
                marker.setStyle({ color: c, fillColor: c });
                marker.bindPopup(popup);
                const tt = marker.getTooltip();
                if (tt) {
                    tt.setContent(label);
                    tt.options.offset = window.L.point(0, -radius - 8);
                }
                const ring = state.mapRings[r.zone];
                if (ring) {
                    ring.setLatLng([r.lat, r.lon]);
                    ring.setRadius(radius + 10);
                    ring.setStyle({ color: c, fillColor: c });
                    try { const ringEl = ring.getElement(); if (ringEl) ringEl.style.animationDuration = pulseDur; } catch (e) { /* ignore */ }
                }
            }
        }
        // v14: re-fit once the markers are in place, so Ruwais is never
        // left on the bottom edge after a data refresh.
        fitAbuDhabi();
        } catch (e) {
            // A map failure must never break the data load: clear the broken
            // map, show the error visibly, and fall back to the zone cards.
            state.map = null; state.mapTile = null; state.mapMarkers = {};
            reportError("map failed: " + (e && e.message ? e.message : e));
            showMapFallback(t("mapFailed"));
        }
    }

    // ------------------------------------------------------------------
    // Rendering — Section 2 (site selector, spike, NIOSH)
    // ------------------------------------------------------------------
    function renderSection2() {
        const a = state.activeLive;
        if (!a) return;
        // v26 fix: first-load banner gap. Every caller renders Section 2
        // before Section 3, but the banner's effective limit reads
        // state.totalStrain / state.debtDays, which Section 3 is the one
        // that computes (initial state is 0/0, so the banner said 26.0 C
        // while the shift plan already used 25.5 C). Recompute the strain
        // here first, with the exact same call renderSection3 uses, so
        // the banner and the shift plan always agree, on first load and
        // after every control change. Pure function; renderSection3
        // recomputes it again right after, harmlessly.
        if (state.activeHourly) {
            const _sr = L.computeTimelineAndStrain(state.activeHourly, state.spike, state.clothing, state.exposure, state.workload, state.acclimatization);
            state.totalStrain = _sr.totalStrain;
            state.debtDays = _sr.debtDays;
        }
        const c = a.current;
        const res = L.estimateWBGT(c.temperature_2m + state.spike, c.relative_humidity_2m, a.solar, c.wind_speed_10m, state.clothing, state.exposure);
        state.spikedWbgt = res[0]; state.spikedTw = res[1]; state.spikedTg = res[2];
        $("spikeValue").textContent = "+" + state.spike + " °C";
        const metric = $("spikedMetric");
        metric.innerHTML = "";
        const label = el("div", "tg-metric-label tg-keep-ltr", tf("spikedLabel", { site: shortAr(state.activeName) }));
        const value = el("div", "tg-metric-value tg-keep-ltr");
        const clothingCorr = L.CLOTHING_CORRECTION[state.clothing] || 0;
        const delta = el("div", "tg-metric-delta tg-keep-ltr",
            isAr()
                ? ("شذوذ " + "\u2066" + "+" + state.spike + " °C" + "\u2069" + " | الملابس: " + "\u2066" + "+" + clothingCorr.toFixed(0) + " °C" + "\u2069" + " (ISO 7243 الملحق ج) | البصيلة الرطبة: " + "\u2066" + state.spikedTw.toFixed(1) + "°C" + "\u2069" + " | الكرة السوداء: " + "\u2066" + state.spikedTg.toFixed(1) + "°C" + "\u2069")
                : ("+" + state.spike + " °C anomaly | Clothing: +" + clothingCorr.toFixed(0) + " °C (ISO 7243 Annex C) | Wet-Bulb: " + state.spikedTw.toFixed(1) + "°C | Globe: " + state.spikedTg.toFixed(1) + "°C"));
        metric.appendChild(label); metric.appendChild(value); metric.appendChild(delta);
        if (state.siteJustChanged) {
            value.textContent = state.spikedWbgt.toFixed(1) + " °C";
            value.dataset.value = String(state.spikedWbgt);
            state.siteJustChanged = false;
        } else {
            animateNumber(value, state.spikedWbgt, 1, " °C");
        }
        // v24: effective limit — acclimatisation + multi-day debt penalty
        // subtracted from every NIOSH base limit, so the chips flip live
        // when a judge changes Acclimatisation. effInfo = [effLimit, totalPen, rationale].
        const effInfo = L.effectiveWorkLimit(state.workload, state.acclimatization, state.totalStrain, state.debtDays);
        // v25 fix 2: the NIOSH heading must match the coupled chips —
        // ACCLIMATISED or UNACCLIMATISED, in the active language.
        const nioshTitleEl = $("nioshTitleEl");
        if (nioshTitleEl) nioshTitleEl.textContent = t(state.acclimatization === "unacclimatised" ? "nioshTitleUnaccl" : "nioshTitleAccl");
        const effBanner = $("effectiveLimitBanner");
        if (effBanner) {
            // v28.1: the rationale is rendered from its structured
            // parts, so Arabic gets the translated breakdown.
            effBanner.innerHTML = "<span>" + esc(t("effBannerLabel")) + ": <b>" + effInfo[0].toFixed(1) + " °C</b></span><span>" + esc(rationaleText(effInfo)) + "</span>";
        }
        // NIOSH chips (translated workload + status; numbers stay LTR,
        // chips stay in Light -> Very heavy order in both languages).
        const chips = $("nioshChips");
        chips.innerHTML = "";
        for (const work of Object.keys(L.NIOSH_LIMITS)) {
            const limit = L.NIOSH_LIMITS[work] - effInfo[1];
            const ok = state.spikedWbgt <= limit;
            const wName = isAr() ? WORK_AR[work] : work;
            const status = isAr() ? (ok ? "ضمن الحد" : "تجاوز الحد") : (ok ? "OK" : "OVER LIMIT");
            const chip = el("div", "tg-niosh-chip tg-keep-ltr " + (ok ? "tg-chip-ok" : "tg-chip-over"),
                "  " + wName + ": " + status + " (" + state.spikedWbgt.toFixed(1) + " " + (ok ? "<=" : ">") + " " + limit.toFixed(1) + ")");
            chips.appendChild(chip);
        }
        // Alert — thresholds are the effective limit, not fixed 28/26:
        // critical above effLimit + 2.5, high above effLimit.
        // v28.1: the text names that same effective limit.
        const alert = $("spikeAlert");
        const alertWorkload = isAr() ? (WORK_AR_DEF[state.workload] || state.workload) : state.workload;
        if (state.spikedWbgt > effInfo[0] + 2.5) {
            alert.hidden = false;
            alert.className = "tg-alert tg-alert-error";
            alert.textContent = tf("alertCritical", { limit: effInfo[0].toFixed(1), workload: alertWorkload });
        } else if (state.spikedWbgt > effInfo[0]) {
            alert.hidden = false;
            alert.className = "tg-alert tg-alert-warn";
            alert.textContent = tf("alertHigh", { limit: effInfo[0].toFixed(1), workload: alertWorkload });
        } else {
            alert.hidden = true;
        }
        // Keep the cost calculator's WBGT in sync with the spiked value.
        $("coWbgt").value = state.spikedWbgt.toFixed(1);
        renderCost();
        renderPhone();
    }

    // ------------------------------------------------------------------
    // Rendering — Section 3 (chart, strain table, gauge)
    // ------------------------------------------------------------------
    function renderSection3() {
        const h = state.activeHourly;
        if (!h) return;
        const r = L.computeTimelineAndStrain(h, state.spike, state.clothing, state.exposure, state.workload, state.acclimatization);
        state.totalStrain = r.totalStrain;
        state.debtDays = r.debtDays;
        state.dailyRows = r.dailyRows;
        renderChart(r.chartRows);
        // Strain table
        const wrap = $("strainTableWrap");
        wrap.innerHTML = "";
        const table = el("table", "tg-table tg-keep-ltr");
        const thead = document.createElement("thead");
        thead.innerHTML = "<tr><th>" + t("strainThDate") + "</th><th>" + t("strainThSource") + "</th><th>" + t("strainThMaxTemp") + "</th><th>" + t("strainThNightMin") + "</th><th>" + t("strainThMaxWbgt") + "</th><th>" + tf("strainThHoursOver", { limit: r.effectiveLimit.toFixed(1) }) + "</th><th>" + t("strainThDebt") + "</th><th>" + t("strainThPoints") + "</th><th>" + t("strainThCumulative") + "</th></tr>";
        const tbody = document.createElement("tbody");
        // v23: last 2 rows of the 6-day window are the next 2 days = Forecast;
        // past 3 days + today = Observed (live Open-Meteo). Numbers unchanged.
        r.dailyRows.forEach(function (d, idx) {
            const src = idx >= r.dailyRows.length - 2 ? t("strainForecast") : t("strainObserved");
            const tr = document.createElement("tr");
            tr.innerHTML = "<td>" + esc(d.date) + "</td><td>" + esc(src) + "</td><td>" + d.maxTemp.toFixed(1) + "</td><td>" + d.nightMin.toFixed(1) + "</td><td>" +
                d.maxWbgt.toFixed(1) + "</td><td>" + d.hoursOverHeavy + "</td><td>" + esc(isAr() ? (d.recoveryDebt.indexOf("YES") === 0 ? "نعم (\u2066+1\u2069 نقطة)" : "لا") : d.recoveryDebt) + "</td><td>" +
                d.points + "</td><td><b>" + d.cumulative + "</b></td>";
            tbody.appendChild(tr);
        });
        table.appendChild(thead); table.appendChild(tbody);
        wrap.appendChild(table);
        // Banner
        const banner = $("strainBanner");
        if (r.totalStrain >= 12) {
            banner.hidden = false;
            banner.className = "tg-alert tg-alert-error";
            banner.textContent = tf("strainRed", { total: r.totalStrain });
        } else {
            banner.hidden = false;
            banner.className = "tg-alert tg-alert-info";
            banner.textContent = tf("strainBelow", { total: r.totalStrain, spike: state.spike });
        }
        // Gauge (width + colour glide smoothly via CSS transition)
        const colour = r.totalStrain >= 12 ? "#f43f5e" : (r.totalStrain >= 8 ? "#f59e0b" : "#10b981");
        const fill = Math.min(r.totalStrain / 24.0 * 100.0, 100.0);
        const fillEl = $("gaugeFill");
        fillEl.style.width = fill.toFixed(0) + "%";
        fillEl.style.background = colour;
        // v25 polish: pulsing crimson glow once the red line is crossed.
        fillEl.classList.toggle("is-critical", r.totalStrain >= 12);
        banner.classList.toggle("is-critical", r.totalStrain >= 12);
        const numEl = $("gaugeNumber");
        numEl.textContent = r.totalStrain + " / 12";
        numEl.style.color = colour;
        // Re-apply the day scrubber to the fresh table.
        renderDayScrub();
        // Section 4 depends on the same hourly data.
        renderSection4(h);
    }

    function renderChart(chartRows) {
        const node = $("strainChart");
        if (typeof window.Plotly === "undefined") {
            node.innerHTML = "<div class='tg-chart-note'>" + esc(t("chartUnavailable")) + "</div>";
            return;
        }
        const isDark = state.theme === "dark";
        const x = chartRows.map(function (r) { return r.time; });
        const y = chartRows.map(function (r) { return r.wbgt; });
        const fontCol = isDark ? "#e2e8f0" : "#334155";
        const lineCol = isDark ? "#38bdf8" : "#0284c7";
        const data = [{ x: x, y: y, type: "scatter", mode: "lines", name: "WBGT estimate (C)", line: { color: lineCol, width: 2.6 } }];
        // v27: the amber Heavy line is the EFFECTIVE Heavy limit for this
        // crew (workload + acclimatisation + cumulative strain + debt),
        // the same value renderSection2 / renderSection4 use. renderChart
        // is only called from renderSection3, after state.totalStrain /
        // state.debtDays are set, so this matches the banner and the
        // shift plan. The red 28.0 C line stays the Moderate BASE limit.
        const effLimit = L.effectiveWorkLimit(state.workload, state.acclimatization, state.totalStrain, state.debtDays)[0];
        // v14 FIX (live check 2026-11-16): the chart was clipped — top peaks
        // cut flat, the "31" y-axis label half-cut, x-axis date labels
        // half-cut, and the 26/28 °C limit labels running off the right
        // edge. Root causes: fixed height 340 with margin b:10 / r:10,
        // no explicit y-axis range (Plotly autoscaled tight to the data,
        // so the highest points touched the top edge), and limit labels
        // anchored at paper x=1 with no right margin to hold them.
        // Fix: taller chart (420), generous margins on all sides, an
        // explicit y-axis range padded 2 °C beyond the data and both
        // limit lines, limit labels moved INSIDE the plot (x=0.98 paper,
        // right-anchored, with a semi-transparent background), and
        // angled x-axis ticks so date labels do not get cut at the bottom.
        const yDataMin = y.length ? Math.min.apply(null, y.concat([effLimit])) : 20;
        const yDataMax = y.length ? Math.max.apply(null, y.concat([28.0])) : 28;
        const yMin = Math.floor(yDataMin - 2);
        const yMax = Math.ceil(yDataMax + 2);
        const labelBg = isDark ? "rgba(15,23,42,0.85)" : "rgba(255,255,255,0.85)";
        const layout = {
            title: { text: t("chartTitle"), font: { color: fontCol, family: "Plus Jakarta Sans" } },
            height: 420,
            autosize: true,
            margin: { l: 60, r: 30, t: 55, b: 60 },
            paper_bgcolor: "rgba(0,0,0,0)",
            plot_bgcolor: "rgba(0,0,0,0)",
            font: { color: fontCol, family: "Plus Jakarta Sans" },
            xaxis: {
                gridcolor: isDark ? "rgba(255,255,255,0.08)" : "rgba(15,23,42,0.08)",
                tickangle: -30,
                tickfont: { size: 10 },
                nticks: 6,
                automargin: true
            },
            yaxis: {
                gridcolor: isDark ? "rgba(255,255,255,0.08)" : "rgba(15,23,42,0.08)",
                range: [yMin, yMax],
                autorange: false,
                automargin: true
            },
            shapes: [
                { type: "line", x0: 0, x1: 1, xref: "paper", y0: effLimit, y1: effLimit, line: { color: "#f59e0b", dash: "dash" } },
                { type: "line", x0: 0, x1: 1, xref: "paper", y0: 28.0, y1: 28.0, line: { color: "#f43f5e", dash: "dash" } },
                // v23: vertical marker where the forecast starts (5th day of the 6-day window). Presentation only, no data change.
                ...(function () {
                    const days = Array.from(new Set(chartRows.map(function (rr) { return rr.time.slice(0, 10); }))).sort();
                    if (days.length < 5) return [];
                    const fs = days[4] + "T00:00";
                    return [{ type: "line", x0: fs, x1: fs, y0: 0, y1: 1, yref: "paper", line: { color: "#f59e0b", dash: "dot", width: 2 } }];
                })(),
            ],
            annotations: [
                { x: 0.98, xref: "paper", y: effLimit, text: tf("chartHeavy", { limit: effLimit.toFixed(1) }), showarrow: false, xanchor: "right", yanchor: "middle", bgcolor: labelBg, bordercolor: "#f59e0b", borderwidth: 1, font: { color: "#f59e0b", size: 11 } },
                { x: 0.98, xref: "paper", y: 28.0, text: t("chartModerate"), showarrow: false, xanchor: "right", yanchor: "middle", bgcolor: labelBg, bordercolor: "#f43f5e", borderwidth: 1, font: { color: "#f43f5e", size: 11 } },
                // v23: "Forecast" label on the forecast-start marker.
                ...(function () {
                    const days = Array.from(new Set(chartRows.map(function (rr) { return rr.time.slice(0, 10); }))).sort();
                    if (days.length < 5) return [];
                    return [{ x: days[4] + "T00:00", y: 1, yref: "paper", text: t("strainForecast"), showarrow: false, xanchor: "left", yanchor: "top", bgcolor: labelBg, bordercolor: "#f59e0b", borderwidth: 1, font: { color: "#f59e0b", size: 11 } }];
                })(),
            ],
        };
        const config = { responsive: true, displayModeBar: false };
        if (state.chartDrawn) Plotly.react(node, data, layout, config);
        else { Plotly.newPlot(node, data, layout, config); state.chartDrawn = true; }
    }

    // ------------------------------------------------------------------
    // Rendering — Section 4 (shift schedule)
    // ------------------------------------------------------------------
    function shiftRowMeta(protocol) {
        if (protocol.indexOf("SHADE BREAK") === 0) return { trCls: "tg-shift-shade", badgeCls: "tg-badge-blue" };
        if (protocol === "NO OUTDOOR WORK") return { trCls: "tg-shift-stop", badgeCls: "tg-badge-red" };
        if (protocol.indexOf("30 work") === 0) return { trCls: "tg-shift-half", badgeCls: "tg-badge-amber" };
        if (protocol.indexOf("45 work") === 0) return { trCls: "", badgeCls: "tg-badge-amber" };
        return { trCls: "", badgeCls: "tg-badge-green" };
    }

    // v28.1: takes the whole row — the explanation is built from
    // its structured parts (Arabic templates) or the logic.js
    // string (English), then the leading trigger tag is highlighted.
    function formatShiftExplanation(row) {
        const text = shiftExplanationText(row);
        const safe = esc(text);
        const triggers = isAr() ? [
            { key: "إيقاف استباقي", cls: "tg-trig-red" },
            { key: "إيقاع استباقي 30/30", cls: "tg-trig-amber" },
            { key: "هامش ما قبل الحد", cls: "tg-trig-amber" },
            { key: "استراحة الظل 13-15", cls: "tg-trig-blue" },
            { key: "نافذة عمل متواصل آمنة", cls: "tg-trig-green" },
        ] : [
            { key: "PROACTIVE HALT", cls: "tg-trig-red" },
            { key: "PROACTIVE 30/30 PACING", cls: "tg-trig-amber" },
            { key: "PRE-THRESHOLD BUFFER", cls: "tg-trig-amber" },
            { key: "SHADE BREAK 13-15", cls: "tg-trig-blue" },
            { key: "Safe continuous window", cls: "tg-trig-green" },
        ];
        for (const tr of triggers) {
            if (safe.indexOf(tr.key) === 0) {
                return "<span class='tg-trigger-tag " + tr.cls + "'>" + tr.key + "</span>" + safe.slice(tr.key.length);
            }
        }
        return safe;
    }

    function renderSection4(hourly) {
        const s = L.computeShiftSchedule(hourly, state.spike, state.clothing, state.workload, state.acclimatization, state.totalStrain, state.debtDays, state.exposure);
        state.preventedHours = s.preventedHours;
        state.coolingMinutes = s.coolingMinutes;
        state.shiftTomorrow = s.tomorrow;
        state.effectiveLimit = s.effectiveLimit;
        state.limitRationale = s.limitRationale;
        state.limitRationaleParts = s.limitRationaleParts;
        setMetric($("kpiPrevented"), t("kpiPreventedLabel"), s.preventedHours + (isAr() ? " ساعة / وردية 12 ساعة" : " hrs / 12-hr shift"), tf("kpiPreventedDelta", { limit: s.effectiveLimit.toFixed(1) }));
        setMetric($("kpiCooling"), t("kpiCoolingLabel"), s.coolingMinutes + (isAr() ? " دقيقة" : " mins"), tf("kpiCoolingDelta", { h: (s.coolingMinutes / 60).toFixed(1) }));
        setMetric($("kpiDebt"), t("kpiDebtLabel"), state.debtDays + (isAr() ? " / 6 أيام" : " / 6 days"), t("kpiDebtDelta"));
        $("shiftIntro").innerHTML = tf("shiftIntro", { tomorrow: esc(s.tomorrow), spike: state.spike });
        const wrap = $("shiftTableWrap");
        wrap.innerHTML = "";
        const table = el("table", "tg-table tg-keep-ltr");
        const thead = document.createElement("thead");
        thead.innerHTML = "<tr><th>" + t("shiftThHour") + "</th><th>" + t("shiftThTemp") + "</th><th>" + t("shiftThWbgt") + "</th><th>" + t("shiftThRatio") + "</th><th>" + t("shiftThCrew") + "</th><th>" + t("shiftThHydration") + "</th><th>" + t("shiftThExplanation") + "</th></tr>";
        const tbody = document.createElement("tbody");
        for (const row of s.rows) {
            const meta = shiftRowMeta(row.protocol);
            const tr = document.createElement("tr");
            if (meta.trCls) tr.className = meta.trCls;
            const protoText = isAr() ? (PROTOCOL_AR[row.protocol] || row.protocol) : row.protocol;
            const crewText = isAr() ? (CREW_AR[row.crew] || row.crew) : row.crew;
            tr.innerHTML =
                "<td><b>" + esc(row.hour) + "</b></td>" +
                "<td>" + row.temp.toFixed(1) + "</td>" +
                "<td><b>" + row.wbgt.toFixed(1) + "</b></td>" +
                "<td><span class='tg-badge " + meta.badgeCls + "'>" + esc(protoText) + "</span></td>" +
                "<td>" + esc(crewText) + "</td>" +
                "<td>" + esc(translateHydration(row.hydration)) + "</td>" +
                "<td>" + formatShiftExplanation(row) + "</td>";
            tbody.appendChild(tr);
        }
        table.appendChild(thead); table.appendChild(tbody);
        wrap.appendChild(table);
        // Re-apply the before / after slider to the fresh KPIs.
        renderBeforeAfter();
    }

    function setMetric(node, label, valueText, delta) {
        node.innerHTML = "";
        node.appendChild(el("div", "tg-metric-label", label));
        node.appendChild(el("div", "tg-metric-value", valueText));
        node.appendChild(el("div", "tg-metric-delta", delta));
    }

    // ------------------------------------------------------------------
    // Rendering — Section 5 (triage)
    // ------------------------------------------------------------------
    function renderTriageResult() {
        const wrap = $("triageTableWrap");
        wrap.innerHTML = "";
        if (!state.triage) return;
        const r = state.triage.result;
        $("triageEngine").hidden = false;
        const engName = state.triage.engine.indexOf("Deterministic") !== -1 ? (isAr() ? ENGINE_AR : state.triage.engine) : state.triage.engine;
        $("triageEngine").textContent = tf("triageEngine", { engine: engName });
        const ta = translateTierAction(r);
        const rows = [
            [t("triageWorker"), translateSummary(r.workerSummary)],
            [t("triageSeverity"), r.symptomSeverity],
            [t("triageSymptoms"), r.symptoms.join(", ")],
            [t("triageHydration"), r.hydrationStatus],
            [t("triageHydrationProtocol"), translateHydration(r.hydrationProtocol || "")],
            [t("triageCorrelation"), r.explainableCorrelation || ""],
            [t("triageFriction"), r.equipmentFriction],
            [t("triageTier"), ta.tier],
            [t("triageAction"), ta.action],
            [t("triageArBroadcast"), r.arabicCrewAlert],
            [t("triageHiBroadcast"), r.hindiUrduCrewAlert],
        ];
        const table = el("table", "tg-table tg-keep-ltr");
        const tbody = document.createElement("tbody");
        for (const pair of rows) {
            const tr = document.createElement("tr");
            const sev = pair[0] === t("triageSeverity") ? severityBadge(pair[1]) : esc(pair[1]);
            tr.innerHTML = "<td><b>" + esc(pair[0]) + "</b></td><td>" + sev + "</td>";
            tbody.appendChild(tr);
        }
        table.appendChild(tbody);
        wrap.appendChild(table);
    }
    function severityBadge(sev) {
        const cls = (sev === "Critical" || sev === "Severe") ? "tg-badge-red" : (sev === "High" ? "tg-badge-amber" : "tg-badge-green");
        return "<span class='tg-badge " + cls + "'>" + esc(isAr() ? (SEV_AR[sev] || sev) : sev) + "</span>";
    }

    // ------------------------------------------------------------------
    // Rendering — Section 7 (compare sites)
    // ------------------------------------------------------------------
    // ------------------------------------------------------------------
    // Section 7 world map — the four sentinel corridors on one map.
    // Section 1 only shows the three Abu Dhabi zones, so Lagos, Delhi and
    // Houston were invisible on any map. This map plots all four compare
    // sites (Mussafah, Lagos, Delhi, Houston) with the same circle logic:
    // bigger means hotter, colour is the NIOSH status.
    // ------------------------------------------------------------------
    function renderCompareMap() {
        const container = $("compareMapContainer");
        if (!container) return;
        if (typeof window.L === "undefined" || !window.L.map) {
            // Leaflet did not load: leave the container empty; the table below
            // still shows the sites and values.
            return;
        }
        try {
            const isDark = state.theme === "dark";
            if (!state.compareMap) {
                state.compareMap = window.L.map(container, { scrollWheelZoom: false });
                state.compareMapTile = window.L.tileLayer(leafletTileUrl(isDark), {
                    maxZoom: 19,
                    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
                }).addTo(state.compareMap);
                state.compareMapSat = window.L.tileLayer(leafletSatUrl(), {
                    maxZoom: 19,
                    attribution: "Tiles &copy; Esri &mdash; Source: Esri, Maxar, Earthstar Geographics",
                });
                window.L.control.layers({ "Street": state.compareMapTile, "Satellite": state.compareMapSat }).addTo(state.compareMap);
                // v25 polish: dark-mode Street tiles get the dark filter;
                // Satellite stays full colour.
                state.compareMapBaseStreet = true;
                container.classList.toggle("tg-map-dark-tiles", isDark);
                state.compareMap.on("baselayerchange", function (ev) {
                    state.compareMapBaseStreet = (ev.name === "Street");
                    container.classList.toggle("tg-map-dark-tiles", state.theme === "dark" && state.compareMapBaseStreet);
                });
                state.compareMapMarkers = {};
                state.compareMapRings = {};
                window.addEventListener("resize", function () { if (state.compareMap) state.compareMap.invalidateSize(); });
                setTimeout(function () { if (state.compareMap) state.compareMap.invalidateSize(); }, 300);
            } else {
                state.compareMapTile.setUrl(leafletTileUrl(isDark));
                container.classList.toggle("tg-map-dark-tiles", isDark && state.compareMapBaseStreet !== false);
            }
            // Live WBGT and risk tier per site, from the compare table rows (if loaded).
            const wbgtBySite = {};
            const tierBySite = {};
            if (state.compareRows) {
                for (const r of state.compareRows) { wbgtBySite[r.site] = r.currentWbgt; tierBySite[r.site] = r.tier; }
            }
            const bounds = [];
            for (const site of Object.keys(L.COMPARE_SITES)) {
                const lat = L.COMPARE_SITES[site][0], lon = L.COMPARE_SITES[site][1];
                const wbgt = wbgtBySite[site];
                const hasLive = (wbgt !== undefined && wbgt !== null);
                const color = hasLive ? L.wbgtColor(wbgt) : [148, 163, 184]; // grey while loading
                const c = "rgb(" + color[0] + "," + color[1] + "," + color[2] + ")";
                const radius = hasLive ? Math.round(14 + Math.max(0, wbgt - 15) * 1.6) : 14;
                const label = compareLabel(site, hasLive ? wbgt : null);
                const popup = comparePopup(site, hasLive ? wbgt : null, tierBySite[site] || "");
                const pulseDur = hasLive ? (wbgt > 28 ? "1.2s" : (wbgt > 26 ? "1.8s" : "2.4s")) : "2.4s";
                bounds.push([lat, lon]);
                if (!state.compareMapMarkers[site]) {
                    const marker = window.L.circleMarker([lat, lon], {
                        radius: radius, color: c, weight: 2, fillColor: c, fillOpacity: 0.55,
                    }).addTo(state.compareMap);
                    marker.bindTooltip(label, {
                        permanent: true, direction: "top",
                        offset: window.L.point(0, -radius - 8), className: "tg-map-label",
                    });
                    marker.bindPopup(popup);
                    state.compareMapMarkers[site] = marker;
                    const ring = window.L.circleMarker([lat, lon], {
                        radius: radius + 10, color: c, weight: 2, fillColor: c, fillOpacity: 0,
                        className: "tg-pulse-ring", interactive: false,
                    }).addTo(state.compareMap);
                    try { const ringEl = ring.getElement(); if (ringEl) ringEl.style.animationDuration = pulseDur; } catch (e) { /* ignore */ }
                    state.compareMapRings[site] = ring;
                } else {
                    const marker = state.compareMapMarkers[site];
                    marker.setLatLng([lat, lon]);
                    marker.setRadius(radius);
                    marker.setStyle({ color: c, fillColor: c });
                    marker.bindPopup(popup);
                    const tt = marker.getTooltip();
                    if (tt) {
                        tt.setContent(label);
                        tt.options.offset = window.L.point(0, -radius - 8);
                    }
                    const ring = state.compareMapRings[site];
                    if (ring) {
                        ring.setLatLng([lat, lon]);
                        ring.setRadius(radius + 10);
                        ring.setStyle({ color: c, fillColor: c });
                        try { const ringEl = ring.getElement(); if (ringEl) ringEl.style.animationDuration = pulseDur; } catch (e) { /* ignore */ }
                    }
                }
            }
            // Fit the view to all four sites so Lagos, Delhi and Houston are
            // visible at once. Only re-fit when the map is first created, so
            // the user's own pan/zoom is not reset on every data refresh.
            if (bounds.length && !state.compareMapFitted) {
                state.compareMap.fitBounds(window.L.latLngBounds(bounds), { padding: [24, 24] });
                state.compareMapFitted = true;
            }
        } catch (e) {
            // A map failure must never break the table below it.
            reportError("compare map failed: " + (e && e.message ? e.message : e));
            state.compareMap = null; state.compareMapTile = null; state.compareMapMarkers = {};
        }
    }

    function renderCompare() {
        const wrap = $("compareTableWrap");
        wrap.innerHTML = "";
        renderCompareMap();
        if (!state.compareRows) {
            wrap.innerHTML = "<p class='tg-body'>" + esc(t("compareUnavailable")) + "</p>";
            return;
        }
        const table = el("table", "tg-table tg-keep-ltr");
        const thead = document.createElement("thead");
        thead.innerHTML = "<tr><th>" + t("compareThSite") + "</th><th>" + t("compareThCurrent") + "</th><th>" + t("compareThSolar") + "</th><th>" + t("compareThMax") + "</th><th>" + t("compareThDebt") + "</th><th>" + t("compareThTier") + "</th></tr>";
        const tbody = document.createElement("tbody");
        for (const r of state.compareRows) {
            const badge = r.tier === "Critical" ? "tg-badge-red" : (r.tier === "High" ? "tg-badge-amber" : (r.tier === "Moderate" ? "tg-badge-blue" : "tg-badge-green"));
            const tr = document.createElement("tr");
            tr.innerHTML = "<td>" + esc(compareName(r.site)) + "</td><td>" + r.currentWbgt.toFixed(1) + "</td><td>" + (r.solar !== undefined && r.solar !== null ? r.solar : "—") + "</td><td>" + r.maxWbgt.toFixed(1) + "</td><td>" + esc(isAr() ? r.debtDays.replace(" / 6", " / 6 أيام") : r.debtDays) + "</td><td><span class='tg-badge " + badge + "'>" + esc(isAr() ? (TIER_AR[r.tier] || r.tier) : r.tier) + "</span></td>";
            tbody.appendChild(tr);
        }
        table.appendChild(thead); table.appendChild(tbody);
        wrap.appendChild(table);
    }

    // ------------------------------------------------------------------
    // Rendering — Section 9 (cost of inaction)
    // ------------------------------------------------------------------
    function renderCost() {
        const workers = parseInt($("coWorkers").value, 10) || 1500;
        const days = parseInt($("coDays").value, 10) || 5;
        const wbgt = parseFloat($("coWbgt").value);
        if (isNaN(wbgt)) return;
        const c = L.costOfInaction(workers, days, wbgt);
        const wrap = $("coResults");
        wrap.innerHTML = "";
        const items = [
            [t("costCasesLabel"), c.cases.toFixed(1), t("costCasesDelta")],
            [t("costHospLabel"), c.hospitalisations.toFixed(1), t("costHospDelta")],
            [t("costCostLabel"), "$" + Math.round(c.cost).toLocaleString("en-US"), t("costCostDelta")],
            [t("costPreventedLabel"), c.casesPrevented.toFixed(1) + (isAr() ? " حالة" : " cases"), tf("costPreventedDelta", { amount: "$" + Math.round(c.costPrevented).toLocaleString("en-US") })],
        ];
        for (const item of items) {
            const m = el("div", "tg-metric");
            m.appendChild(el("div", "tg-metric-label", item[0]));
            m.appendChild(el("div", "tg-metric-value", item[1]));
            m.appendChild(el("div", "tg-metric-delta", item[2]));
            wrap.appendChild(m);
        }
    }

    // ------------------------------------------------------------------
    // Rendering — Section 10 (worker phone)
    // ------------------------------------------------------------------
    function renderPhone() {
        const a = state.activeLive;
        if (!a) return;
        const c = a.current;
        const wbgt = L.estimateWBGT(c.temperature_2m + state.demoSpike, c.relative_humidity_2m, a.solar, c.wind_speed_10m, state.clothing, state.exposure)[0];
        $("demoValue").textContent = "+" + state.demoSpike + " °C";
        const status = wbgt > 28.0 ? t("phoneHot") : (wbgt > 26.0 ? t("phoneHigh") : t("phoneOk"));
        const colour = wbgt > 28.0 ? "#f43f5e" : (wbgt > 26.0 ? "#f59e0b" : "#10b981");
        const st = $("phoneStatus");
        st.textContent = status;
        st.style.color = colour;
        $("phoneWbgt").textContent = shortAr(state.activeName) + " — " + wbgt.toFixed(1) + " °C";
        $("phoneShell").style.borderColor = colour;
    }

    // ------------------------------------------------------------------
    // Section 6 — compliance report download (same content as Streamlit)
    // ------------------------------------------------------------------
    function buildReport() {
        if (isAr()) return buildReportAr();
        const lines = [
            "ThermiGraph AI — Occupational Heat & Biometeorological Compliance Report (Prototype)",
            "=".repeat(80),
            "",
            "1. LIVE ZONE TELEMETRY (Abu Dhabi Host Pilot, Open-Meteo):",
        ];
        if (state.live) {
            for (const name of Object.keys(L.ZONES)) {
                const z = state.live[name];
                lines.push("  - " + name + ": " + z.current.time + " | Air " + z.current.temperature_2m + " C | " +
                    "RH " + z.current.relative_humidity_2m + "% | Wind " + z.current.wind_speed_10m + " km/h | " +
                    "Solar " + z.solar + " W/m2 | WBGT Est. " + z.wbgt.toFixed(1) + " C");
            }
        }
        const coords = activeCoords();
        lines.push(
            "",
            "2. ACTIVE WORKSITE: " + state.activeName + " (" + coords.lat.toFixed(4) + ", " + coords.lon.toFixed(4) + ")",
            "   HEAT SPIKE: +" + state.spike + " C anomaly -> Spiked WBGT " + state.spikedWbgt.toFixed(1) + " C",
            "   CLOTHING / PPE: " + state.clothing + " (+" + (L.CLOTHING_CORRECTION[state.clothing] || 0).toFixed(0) + " C, ISO 7243 Annex C)",
            "   WORKLOAD: " + state.workload + " | ACCLIMATISATION: " + state.acclimatization + " | EXPOSURE: " + state.exposure,
            "   EFFECTIVE LIMIT: " + (state.effectiveLimit !== undefined ? state.effectiveLimit.toFixed(1) : L.effectiveWorkLimit(state.workload, state.acclimatization, state.totalStrain, state.debtDays)[0].toFixed(1)) + " C (" + (state.limitRationale || L.effectiveWorkLimit(state.workload, state.acclimatization, state.totalStrain, state.debtDays)[2]) + ")",
            "   NIOSH Acclimatised Continuous Work Thresholds:",
            ...L.nioshCheck(state.spikedWbgt),
            "",
            "3. 6-DAY CUMULATIVE THERMAL STRAIN INDEX: " + state.totalStrain + " / 12 (Red-line threshold = 12)",
            "   Active Nocturnal Recovery Debt Days (>28C): " + state.debtDays + " / 6 days",
            "   Unsafe Heavy-Work Hours Prevented Tomorrow: " + state.preventedHours + " hrs | Cooling/Shade Scheduled: " + state.coolingMinutes + " mins",
        );
        if (state.triage) {
            const tr = state.triage.result;
            lines.push(
                "",
                "4. LATEST ANONYMISED FIELD-LOG TRIAGE:",
                "  - Worker Summary: " + tr.workerSummary,
                "  - Severity / Risk Tier: " + tr.symptomSeverity + " | " + tr.oshaRiskTier,
                "  - Immediate Action: " + tr.immediateAction,
                "  - Hydration Protocol: " + (tr.hydrationProtocol || ""),
                "  - Explainable Correlation: " + (tr.explainableCorrelation || ""),
                "  - Arabic Broadcast: " + tr.arabicCrewAlert,
                "  - Hindi/Urdu Broadcast: " + tr.hindiUrduCrewAlert,
            );
        }
        lines.push(
            "",
            "5. SCOPE & CLINICAL DISCLOSURES:",
            "  - WBGT values are mathematical estimates (Stull wet-bulb + wind-adjusted solar globe), not calibrated physical globe thermometer readings.",
            "  - Triage outputs support preventive workplace safety, not clinical diagnosis.",
            "  - Worker logs are anonymised at crew level; outputs must never be used punitively.",
        );
        return lines.join("\n");
    }

    // v20: the downloaded .txt report is in Arabic when Arabic is
    // active, with the same numbers and the same structure. Numbers,
    // units and the WBGT formula stay in Latin/Western digits.
    function buildReportAr() {
        const lines = [
            "ثرميغراف — تقرير الامتثال للحرارة المهنية والأرصاد الحيوية (نموذج أولي)",
            "=".repeat(80),
            "",
            "1. القياسات المباشرة للمناطق (ممر أبوظبي التجريبي، Open-Meteo):",
        ];
        if (state.live) {
            for (const name of Object.keys(L.ZONES)) {
                const z = state.live[name];
                lines.push("  - " + zoneName(name) + ": " + z.current.time + " | الهواء " + z.current.temperature_2m + " °C | " +
                    "الرطوبة " + z.current.relative_humidity_2m + "% | الرياح " + z.current.wind_speed_10m + " كم/ساعة | " +
                    "الإشعاع الشمسي " + z.solar + " واط/م2 | تقدير WBGT " + z.wbgt.toFixed(1) + " °C");
            }
        }
        const coords = activeCoords();
        const nioshLines = [];
        for (const work of Object.keys(L.NIOSH_LIMITS)) {
            const limit = L.NIOSH_LIMITS[work];
            const ok = state.spikedWbgt <= limit;
            nioshLines.push("  " + WORK_AR[work] + ": " + (ok ? "ضمن الحد" : "تجاوز الحد") + " (" + state.spikedWbgt.toFixed(1) + " " + (ok ? "<=" : ">") + " " + limit.toFixed(0) + ")");
        }
        lines.push(
            "",
            "2. موقع العمل النشط: " + shortAr(state.activeName) + " (" + coords.lat.toFixed(4) + ", " + coords.lon.toFixed(4) + ")",
            "   موجة الحر: +" + state.spike + " °C شذوذ -> WBGT بعد الموجة " + state.spikedWbgt.toFixed(1) + " °C",
            "   الملابس / معدات الوقاية: " + (CLOTHING_AR[state.clothing] || state.clothing) + " (+" + (L.CLOTHING_CORRECTION[state.clothing] || 0).toFixed(0) + " °C, ISO 7243 الملحق ج)",
            "   شدة العمل: " + (WORK_AR[state.workload] || state.workload) + " | التأقلم: " + state.acclimatization + " | التعرض: " + state.exposure,
            "   الحد الفعال: " + (state.effectiveLimit !== undefined ? state.effectiveLimit.toFixed(1) : L.effectiveWorkLimit(state.workload, state.acclimatization, state.totalStrain, state.debtDays)[0].toFixed(1)) + " °C",
            "   حدود NIOSH للعمال المتأقلمين في العمل المتواصل:",
            ...nioshLines,
            "",
            "3. مؤشر الإجهاد الحراري التراكمي لمدة 6 أيام: " + state.totalStrain + " / 12 (حد الخط الأحمر = 12)",
            "   أيام دين الاستشفاء الليلي النشطة (>28°C): " + state.debtDays + " / 6 أيام",
            "   ساعات العمل الشاق غير الآمنة التي تم منعها غداً: " + state.preventedHours + " ساعة | التبريد/الظل المجدول: " + state.coolingMinutes + " دقيقة",
        );
        if (state.triage) {
            const tr = state.triage.result;
            const ta = translateTierAction(tr);
            lines.push(
                "",
                "4. آخر فرز ميداني مجهول الهوية:",
                "  - ملخص العامل: " + translateSummary(tr.workerSummary),
                "  - الشدة / مستوى الخطر: " + (SEV_AR[tr.symptomSeverity] || tr.symptomSeverity) + " | " + ta.tier,
                "  - الإجراء الفوري: " + ta.action,
                "  - بروتوكول الترطيب: " + (tr.hydrationProtocol || ""),
                "  - الارتباط القابل للتفسير: " + (tr.explainableCorrelation || ""),
                "  - بث الطاقم بالعربية: " + tr.arabicCrewAlert,
                "  - بث الطاقم بالهندية/الأردية: " + tr.hindiUrduCrewAlert,
            );
        }
        lines.push(
            "",
            "5. النطاق والإفصاحات السريرية:",
            "  - قيم WBGT تقديرات رياضية (البصيلة الرطبة بمعادلة ستول + الكرة السوداء المعدلة بالإشعاع الشمسي)، وليست قراءات مقياس كروي فيزيائي معايَر.",
            "  - مخرجات الفرز تدعم السلامة المهنية الوقائية، وليست تشخيصاً سريرياً.",
            "  - سجلات العمال مجهولة الهوية على مستوى الطاقم؛ ويجب ألا تُستخدم المخرجات أبداً للعقاب.",
        );
        return lines.join("\n");
    }

    // Recompute the Section 1 zone WBGTs from the already-fetched live
    // readings when the clothing selector changes — no network refetch.
    // renderMap() updates the existing markers in place, so this is safe.
    function applyClothingToLive() {
        if (!state.live) return;
        for (const name of Object.keys(L.ZONES)) {
            const z = state.live[name];
            if (!z || !z.current) continue;
            const wbgt = L.estimateWBGT(z.current.temperature_2m, z.current.relative_humidity_2m, z.solar, z.current.wind_speed_10m, state.clothing, state.exposure);
            z.wbgt = wbgt[0]; z.wetBulb = wbgt[1]; z.globe = wbgt[2];
        }
        renderZoneCards();
        renderMap();
    }

    // ------------------------------------------------------------------
    // Data loading
    // ------------------------------------------------------------------
    async function loadZones() {
        const live = {};
        let usedCache = false;
        for (const name of Object.keys(L.ZONES)) {
            const lat = L.ZONES[name][0], lon = L.ZONES[name][1];
            const key = "tg_live_" + name;
            try {
                const raw = await fetchLiveRaw(lat, lon);
                const wbgt = L.estimateWBGT(raw.current.temperature_2m, raw.current.relative_humidity_2m, raw.solar, raw.current.wind_speed_10m, state.clothing, state.exposure);
                live[name] = { current: raw.current, solar: raw.solar, wbgt: wbgt[0], wetBulb: wbgt[1], globe: wbgt[2] };
                cacheSet(key, live[name]);
            } catch (e) {
                const cached = cacheGet(key);
                if (cached) { live[name] = cached; usedCache = true; }
                else throw e;
            }
        }
        state.live = live;
        state.liveTime = live[Object.keys(live)[0]].current.time;
        if (usedCache) showStatus(t("cacheWarning"));
        renderZoneCards();
        renderMap();
    }

    async function loadActive() {
        const coords = activeCoords();
        // v25 fix 4: remember whether the site just changed, so
        // renderSection2 can set the new WBGT instantly instead of
        // animating up from the old site's value (which briefly showed
        // e.g. Lagos 26.1 C on the way to the true 34.3 C).
        state.siteJustChanged = !!state.activeName && state.activeName !== coords.name;
        state.activeName = coords.name;
        const liveKey = "tg_active_live_" + coords.lat.toFixed(4) + "_" + coords.lon.toFixed(4);
        const hourlyKey = "tg_active_hourly_" + coords.lat.toFixed(4) + "_" + coords.lon.toFixed(4);
        try {
            const raw = await fetchLiveRaw(coords.lat, coords.lon);
            state.activeLive = raw;
            cacheSet(liveKey, raw);
        } catch (e) {
            const cached = cacheGet(liveKey);
            if (cached) { state.activeLive = cached; showStatus(tf("activeUnavailable", { site: shortAr(state.activeName) })); }
            else { showStatus(tf("activeUnavailable2", { site: shortAr(state.activeName) }), true); return; }
        }
        try {
            const hourly = await fetchHourlyRaw(coords.lat, coords.lon);
            state.activeHourly = hourly;
            cacheSet(hourlyKey, hourly);
        } catch (e) {
            const cached = cacheGet(hourlyKey);
            if (cached) { state.activeHourly = cached; showStatus(tf("hourlyUnavailable", { site: shortAr(state.activeName) })); }
            else { showStatus(tf("hourlyUnavailable2", { site: shortAr(state.activeName) }), true); return; }
        }
        renderSection2();
        renderSection3();
    }

    async function loadCompare() {
        const siteHourly = {};
        const siteCurrent = {};
        const siteSolar = {};
        try {
            for (const siteName of Object.keys(L.COMPARE_SITES)) {
                const lat = L.COMPARE_SITES[siteName][0], lon = L.COMPARE_SITES[siteName][1];
                const hk = "tg_cmp_hourly_" + siteName, lk = "tg_cmp_live_" + siteName;
                try {
                    siteHourly[siteName] = await fetchHourlyRaw(lat, lon);
                    cacheSet(hk, siteHourly[siteName]);
                } catch (e) {
                    siteHourly[siteName] = cacheGet(hk);
                    if (!siteHourly[siteName]) throw e;
                }
                if (state.live && state.live[siteName]) {
                    siteCurrent[siteName] = state.live[siteName].wbgt;
                    siteSolar[siteName] = state.live[siteName].solar;
                } else {
                    try {
                        const raw = await fetchLiveRaw(lat, lon);
                        siteCurrent[siteName] = L.estimateWBGT(raw.current.temperature_2m, raw.current.relative_humidity_2m, raw.solar, raw.current.wind_speed_10m, state.clothing, state.exposure)[0];
                        siteSolar[siteName] = raw.solar;
                        cacheSet(lk, siteCurrent[siteName]);
                    } catch (e) {
                        const cached = cacheGet(lk);
                        if (cached !== null && cached !== undefined) siteCurrent[siteName] = cached;
                        else throw e;
                    }
                }
            }
            state.compareRows = L.computeCompareSites(siteHourly, state.spike, siteCurrent, state.clothing, state.exposure, siteSolar);
        } catch (e) {
            state.compareRows = null;
        }
        renderCompare();
    }

    async function loadAll() {
        showStatus(t("loading"));
        try {
            await loadZones();
        } catch (e) {
            showStatus(t("liveUnavailable"), true);
            return;
        }
        showStatus("");
        await loadActive();
        loadCompare(); // runs in the background; the table fills in when ready
    }

    // ------------------------------------------------------------------
    // Theme + language
    // ------------------------------------------------------------------
    function setThemeLabel() {
        const T = state.lang === "ar" ? AR : EN;
        const btn = $("themeToggle");
        if (btn) btn.textContent = state.theme === "dark" ? T.themeLight : T.themeDark;
    }
    function applyTheme() {
        document.documentElement.dataset.theme = state.theme;
        setThemeLabel();
        renderMap();
        if (state.activeHourly) renderSection3(); // re-draws the chart in the new colours
    }
    // Rebuild a <select>'s options in the current language, keeping
        // the English value as the option value so state never changes.
    function rebuildSelect(id, labels, displayFn) {
        const sel = $(id);
        if (!sel) return;
        const cur = sel.value;
        sel.innerHTML = "";
        for (const label of labels) {
            const opt = document.createElement("option");
            opt.value = label; opt.textContent = displayFn ? displayFn(label) : label;
            sel.appendChild(opt);
        }
        sel.value = cur;
    }
    function applyLang() {
        const T = state.lang === "ar" ? AR : EN;
        document.documentElement.lang = state.lang === "ar" ? "ar" : "en";
        document.documentElement.dir = state.lang === "ar" ? "rtl" : "ltr";
        document.title = T.docTitle;
        $("heroTitle").textContent = T.title;
        $("heroSubtitle").textContent = T.subtitle + " " + T.disclaimer;
        for (let i = 1; i <= 11; i++) {
            const h = $("h-s" + i);
            if (h) { h.textContent = T["s" + i]; h.dir = "auto"; }
        }
        // Every static element marked data-i18n="key" takes its text from the dict.
        document.querySelectorAll("[data-i18n]").forEach(function (n) {
            const v = T[n.getAttribute("data-i18n")];
            if (typeof v === "string") n.textContent = v;
        });
        // data-i18n-html: strings that embed a number/formula pinned LTR
        // with <span class="tg-keep-ltr">, so Arabic prose never flips them.
        document.querySelectorAll("[data-i18n-html]").forEach(function (n) {
            const v = T[n.getAttribute("data-i18n-html")];
            if (typeof v === "string") n.innerHTML = v;
        });
        // data-i18n-aria: accessible names (maps, chart).
        document.querySelectorAll("[data-i18n-aria]").forEach(function (n) {
            const v = T[n.getAttribute("data-i18n-aria")];
            if (typeof v === "string") n.setAttribute("aria-label", v);
        });
        $("heroTitle").dir = "auto";
        $("langToggle").textContent = state.lang === "ar" ? "English" : "العربية";
        setThemeLabel();
        // v20: the toggle must re-render every dynamically built section,
        // otherwise tables / charts / maps stay in the old language until
        // the next data load. Rebuild the selects first (values stay English).
        try {
            rebuildSelect("siteSelect", Object.keys(L.GLOBAL_SITES), siteName);
            rebuildSelect("caseSelect", Object.keys(L.SCENARIO_PRESETS), function (n) { return isAr() ? (CASE_AR[n] || n) : n; });
            // Clothing options are static HTML with data-i18n keys; the
            // loop above already translated them.
            syncCustomGpsInputs();
            if (state.live) { renderZoneCards(); renderMap(); }
            if (state.activeLive) renderSection2();
            if (state.activeHourly) { renderSection3(); renderSection4(state.activeHourly); }
            renderCompare();
            if (state.triage) renderTriageResult();
            renderCost();
            renderPhone();
            // Install button + status are owned by the PWA block below
            // (top-level globals); re-translate them in place, never hide.
            var ib = document.getElementById("installBtn");
            if (ib && typeof window.pwaT === "function") ib.textContent = ib.disabled ? window.pwaT("installed") : window.pwaT("install");
            // v22: keep the auto-poll toggle label and the telemetry
            // heartbeat in the new language.
            var ap = document.getElementById("btnAutoPoll");
            if (ap) ap.textContent = t(state.autoPoll ? "autoPollOn" : "autoPollOff");
            updateHeartbeat();
            var pkey = document.body.getAttribute("data-pwa-key");
            if (pkey && typeof window.pwaT === "function" && typeof window.setPwaStatus === "function") window.setPwaStatus(window.pwaT(pkey), pkey);
        } catch (e) { reportError("language re-render failed: " + e.message); }
        try { localStorage.setItem("thermigraph_lang", state.lang); } catch (e) { /* storage blocked */ }
    }

    // ------------------------------------------------------------------
    // Wiring
    // ------------------------------------------------------------------
    function initControls() {
        // Site select (display name follows the language; value stays English)
        // v28.2 FIX: clear before appending. applyLang() already rebuilt this
        // select during boot (rebuildSelect), so appending here without
        // clearing doubled every option (Mussafah, KEZAD, Ruwais, Lagos,
        // Delhi, Houston, Custom all appeared twice).
        const sel = $("siteSelect");
        sel.innerHTML = "";
        for (const label of Object.keys(L.GLOBAL_SITES)) {
            const opt = document.createElement("option");
            opt.value = label; opt.textContent = siteName(label);
            sel.appendChild(opt);
        }
        sel.value = state.siteLabel;
        sel.addEventListener("change", function () {
            // Capture the coords of the site we are leaving, so Custom starts
            // there (Mussafah by default), not at the old Lagos defaults.
            const prev = activeCoords();
            state.siteLabel = sel.value;
            const isCustom = L.GLOBAL_SITES[state.siteLabel] === null;
            if (isCustom) {
                state.customLat = prev.lat; state.customLon = prev.lon;
            }
            syncCustomGpsInputs();
            loadActive();
        });
        $("customLat").addEventListener("change", function () {
            state.customLat = parseFloat($("customLat").value) || 24.3613;
            if (L.GLOBAL_SITES[state.siteLabel] === null) loadActive();
        });
        $("customLon").addEventListener("change", function () {
            state.customLon = parseFloat($("customLon").value) || 54.5038;
            if (L.GLOBAL_SITES[state.siteLabel] === null) loadActive();
        });
        // Preset buttons
        $("btnLagos").addEventListener("click", function () {
            state.siteLabel = "Lagos — Lekki Industrial Zone (Nigeria / West Africa)";
            sel.value = state.siteLabel;
            $("customGps").hidden = true;
            state.spike = 6;
            $("spikeSlider").value = "6";
            state.demoSpike = 6;
            $("demoSlider").value = "6";
            loadActive();
        });
        $("btnMussafah").addEventListener("click", function () {
            state.siteLabel = "Mussafah (UAE — Host Pilot)";
            sel.value = state.siteLabel;
            $("customGps").hidden = true;
            state.spike = 0;
            $("spikeSlider").value = "0";
            state.demoSpike = 0;
            $("demoSlider").value = "0";
            loadActive();
        });
        // Spike slider
        $("spikeSlider").addEventListener("input", function () {
            state.spike = parseInt($("spikeSlider").value, 10);
            state.demoSpike = state.spike;
            $("demoSlider").value = String(state.spike);
            renderSection2();
            renderSection3();
            loadCompare();
        });
        // Clothing / PPE selector (ISO 7243 Annex C): re-render the WBGT
        // cards, chart, timeline, shift plan and compare table in place.
        $("clothingSelect").addEventListener("change", function () {
            state.clothing = $("clothingSelect").value || "light_civilian";
            applyClothingToLive();
            renderSection2();
            renderSection3();
            renderPhone();
            loadCompare();
        });
        // v22: coupled crew context — workload, acclimatisation and sun
        // exposure change the effective limit, so the strain timeline,
        // shift plan and triage all re-render in place (no refetch).
        function rerenderCoupled() {
            applyClothingToLive();
            renderSection2();
            renderSection3();
            renderPhone();
            // v25 fix 3: a workload / acclimatisation / exposure change
            // must NOT recompute the triage result — that silently
            // replaced a live Groq result with the deterministic
            // fallback (severity Mild -> High) without a Run. The
            // existing result stays on screen until the user clicks
            // Run triage or the hero showcase runs it again.
        }
        $("workloadSelect").addEventListener("change", function () {
            state.workload = $("workloadSelect").value || "Heavy";
            rerenderCoupled();
        });
        $("acclimSelect").addEventListener("change", function () {
            state.acclimatization = $("acclimSelect").value || "acclimatised";
            rerenderCoupled();
        });
        $("exposureSelect").addEventListener("change", function () {
            state.exposure = $("exposureSelect").value || "open_sun";
            rerenderCoupled();
        });
        // v22: Live GPS — use the device position as a Custom worksite.
        // On failure show a status message and keep the current worksite;
        // never crash, never clear the data already on screen.
        $("btnLiveGps").addEventListener("click", function () {
            if (!navigator.geolocation) {
                showStatus(t("gpsUnsupported"));
                return;
            }
            navigator.geolocation.getCurrentPosition(function (pos) {
                state.customLat = pos.coords.latitude;
                state.customLon = pos.coords.longitude;
                state.siteLabel = "Custom Global GPS Coordinates (Any Worksite Worldwide)";
                $("siteSelect").value = state.siteLabel;
                syncCustomGpsInputs();
                showStatus(tf("gpsOk", { lat: state.customLat.toFixed(4), lon: state.customLon.toFixed(4) }));
                loadActive();
            }, function (err) {
                showStatus(tf("gpsFailed", { msg: (err && err.message) ? err.message : "permission denied" }));
            });
        });
        // v22: Live Auto-Poll — reload live telemetry every 60 s while ON.
        // The toggle flips state.autoPoll and the button label; the
        // interval itself is started once in boot().
        $("btnAutoPoll").addEventListener("click", function () {
            state.autoPoll = !state.autoPoll;
            $("btnAutoPoll").textContent = t(state.autoPoll ? "autoPollOn" : "autoPollOff");
            if (state.autoPoll) loadAll();
        });
        // Demo slider (phone only)
        $("demoSlider").addEventListener("input", function () {
            state.demoSpike = parseInt($("demoSlider").value, 10);
            renderPhone();
        });
        // Triage (preset names translated; the note text itself is
        // left exactly as written, worker names and all)
        // Same fix as the site select above: clear before appending.
        // applyLang() already rebuilt this select during boot
        // (rebuildSelect), so appending here without clearing doubled
        // every case (all 4 scenario presets appeared twice).
        const caseSel = $("caseSelect");
        caseSel.innerHTML = "";
        for (const name of Object.keys(L.SCENARIO_PRESETS)) {
            const opt = document.createElement("option");
            opt.value = name; opt.textContent = isAr() ? (CASE_AR[name] || name) : name;
            caseSel.appendChild(opt);
        }
        $("noteInput").value = L.SCENARIO_PRESETS[caseSel.value];
        caseSel.addEventListener("change", function () {
            $("noteInput").value = L.SCENARIO_PRESETS[caseSel.value];
        });
        var TRIAGE_WORKER_URL = "https://thermigraph-triage.alexowoade.workers.dev";
        $("btnTriage").addEventListener("click", async function () {
            const btn = $("btnTriage");
            const prevLabel = btn.textContent;
            btn.disabled = true;
            btn.textContent = t("triageLoading");
            try {
                const note = $("noteInput").value;
                if (TRIAGE_WORKER_URL) {
                    // v25 polish: skeleton shimmer while the Worker answers.
                    // renderTriageResult() clears the wrap on both the live
                    // and the fallback path, so it never stays on screen.
                    $("triageTableWrap").innerHTML = "<div class='tg-glass-card'><div class='tg-skeleton' style='width:60%'></div><div class='tg-skeleton' style='width:95%'></div><div class='tg-skeleton' style='width:80%'></div></div>";
                    try {
                        const ctrl = new AbortController();
                        const timer = setTimeout(function () { ctrl.abort(); }, 25000);
                        const resp = await fetch(TRIAGE_WORKER_URL, {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({ note: note, wbgt_c: state.spikedWbgt, spike_c: state.spike || 0, cumulative_strain: state.totalStrain, debt_days: state.debtDays, acclimatization: state.acclimatization, workload: state.workload, clothing: state.clothing }),
                            signal: ctrl.signal,
                        });
                        clearTimeout(timer);
                        if (resp.ok) {
                            const data = await resp.json();
                            state.triage = { result: data.result, engine: data.engine };
                            renderTriageResult();
                            return;
                        }
                    } catch (e) { /* fall through to the deterministic fallback */ }
                }
                const result = L.deterministicTriageFallback(note, state.spikedWbgt, state.totalStrain, state.debtDays, state.acclimatization, state.workload, state.clothing, state.exposure);
                state.triage = { result: result, engine: "Deterministic Clinical Fallback Engine (Offline / No-Key Mode)" };
                renderTriageResult();
            } finally {
                btn.disabled = false;
                btn.textContent = prevLabel;
            }
        });
        // Report download
        $("btnReport").addEventListener("click", function () {
            const blob = new Blob([buildReport()], { type: "text/plain;charset=utf-8" });
            const a = document.createElement("a");
            a.href = URL.createObjectURL(blob);
            a.download = "thermigraph-compliance-report.txt";
            document.body.appendChild(a);
            a.click();
            setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
        });
        // Cost calculator
        ["coWorkers", "coDays", "coWbgt"].forEach(function (id) {
            $(id).addEventListener("input", renderCost);
        });
        // Rich feature 1 — guided demo tour (click-to-advance only, never auto).
        $("btnTour").addEventListener("click", startTour);
        $("tourNext").addEventListener("click", function () {
            if (state.tourIndex >= TOUR_STEPS.length - 1) exitTour();
            else goTourStep(state.tourIndex + 1);
        });
        $("tourPrev").addEventListener("click", function () { goTourStep(state.tourIndex - 1); });
        $("tourExit").addEventListener("click", exitTour);
        // Rich feature 3 — 6-day timeline scrubber.
        $("daySlider").addEventListener("input", renderDayScrub);
        // Rich feature 4 — before / after slider.
        $("baSlider").addEventListener("input", renderBeforeAfter);
        // Theme / language / refresh
        $("themeToggle").addEventListener("click", function () {
            state.theme = state.theme === "dark" ? "light" : "dark";
            applyTheme();
        });
        $("langToggle").addEventListener("click", function () {
            state.lang = state.lang === "ar" ? "en" : "ar";
            applyLang();
        });
        $("refreshBtn").addEventListener("click", function () {
            try {
                Object.keys(localStorage).filter(function (k) { return k.indexOf("tg_") === 0; }).forEach(function (k) { localStorage.removeItem(k); });
            } catch (e) { /* ignore */ }
            state.chartDrawn = false;
            loadAll();
        });
    }

    // ------------------------------------------------------------------
    // Rich feature 1 — Guided demo tour (presenter mode).
    // Abu Dhabi is primary: the tour starts AND ends in Mussafah. Lagos is
    // only the dramatic middle beat ("global proof"), then we come home.
    // The tour NEVER advances on its own: only the Next / Back buttons move
    // it. No timers, no auto-advance.
    // ------------------------------------------------------------------
    function applySitePreset(label, spike) {
        state.siteLabel = label;
        $("siteSelect").value = label;
        $("customGps").hidden = true;
        state.spike = spike;
        $("spikeSlider").value = String(spike);
        state.demoSpike = spike;
        $("demoSlider").value = String(spike);
        loadActive();
    }
    const TOUR_AR = [
        { title: "1. القاعدة: أبوظبي، مباشرة الآن", text: "هذا هو ممر التجربة المضيف: مصفح وكيزاد والرويس، مباشرة من Open-Meteo. أبوظبي هي موقعنا الرئيسي، وكل شيء يبدأ هنا." },
        { title: "2. الحالة الدرامية: لاغوس، تجاوزت الخط الأحمر", text: "نفس الفيزياء، مدينة مختلفة. لاغوس عند +6°م تجاوزت الخط الأحمر. هذا هو الدليل العالمي، لكن أبوظبي تبقى الوطن." },
        { title: "3. ستة أيام من الدين، وليست ظهيرة حارة واحدة", text: "يتراكم الإجهاد يوماً بعد يوم ويتجاوز الخط الأحمر قبل اليوم الثالث، لأن الليالي لا تبرد أبداً. اسحب منزلق الأيام للتنقل بينها." },
        { title: "4. عامل يبلغ عن أعراض", text: "يعمل الفرز على ملاحظة الميدان في ثوانٍ. لا يُخزَّن أي اسم، فقط اسم الطاقم. اضغط تشغيل الفرز لترى ذلك." },
        { title: "5. الحل: جدول راحة يوفر ساعات", text: "يقيد المُحسِّن العمل الشاق بالصباح البارد ويضيف استراحات تبريد. اسحب منزلق قبل / بعد لترى الساعات التي يوفرها." },
        { title: "6. العائد، عودة إلى أبوظبي", text: "على نطاق التجربة في ممر أبوظبي: 4,500 عامل محمي، و540,000 دولار من الأجهزة المستبدلة. ننتهي حيث بدأنا، في الوطن." },
    ];
    const TOUR_STEPS = [
        { target: "section1", title: "1. Home base: Abu Dhabi, live right now",
          text: "This is the host pilot corridor: Mussafah, KEZAD and Ruwais, live from Open-Meteo. Abu Dhabi is our primary site, everything starts here.",
          action: function () { applySitePreset("Mussafah (UAE — Host Pilot)", 0); } },
        { target: "section2", title: "2. The dramatic one: Lagos, already over the red line",
          text: "Same physics, different city. Lagos at +6°C is already past the red line. This is the global proof, but Abu Dhabi is still home.",
          action: function () { applySitePreset("Lagos — Lekki Industrial Zone (Nigeria / West Africa)", 6); } },
        { target: "section3", title: "3. Six days of debt, not one hot afternoon",
          text: "The strain builds day by day and crosses the red line before Day 3, because the nights never cool down. Drag the day slider to step through it.",
          action: function () { $("daySlider").value = "1"; renderDayScrub(); } },
        { target: "section5", title: "4. A worker reports symptoms",
          text: "Triage runs on the field note in seconds. No name is stored, only the crew label. Press Run triage to see it.",
          action: function () { try { $("btnTriage").click(); } catch (e) { /* ignore */ } } },
        { target: "section4", title: "5. The fix: a rest schedule that saves hours",
          text: "The optimizer restricts heavy work to the cool morning and adds cooling breaks. Drag the before / after slider to see the hours it saves.",
          action: function () { $("baSlider").value = "0"; renderBeforeAfter(); } },
        { target: "section8", title: "6. The payoff, back in Abu Dhabi",
          text: "Pilot scale for the Abu Dhabi corridor: 4,500 workers protected, $540,000 of hardware replaced. We end where we started, at home.",
          action: function () { applySitePreset("Mussafah (UAE — Host Pilot)", 0); } },
    ];
    function goTourStep(i) {
        if (i < 0 || i >= TOUR_STEPS.length) return;
        state.tourIndex = i;
        // Clear the previous highlight.
        document.querySelectorAll(".tg-tour-highlight").forEach(function (n) { n.classList.remove("tg-tour-highlight"); });
        const step = TOUR_STEPS[i];
        try { if (step.action) step.action(); } catch (e) { reportError("tour step action failed: " + e.message); }
        const target = document.getElementById(step.target);
        if (target) {
            target.scrollIntoView({ behavior: "smooth", block: "start" });
            target.classList.add("tg-tour-highlight");
        }
        $("tourTitle").textContent = isAr() && TOUR_AR[i] ? TOUR_AR[i].title : step.title;
        $("tourText").textContent = isAr() && TOUR_AR[i] ? TOUR_AR[i].text : step.text;
        $("tourStep").textContent = tf("tourStep", { i: i + 1, n: TOUR_STEPS.length });
        $("tourPrev").disabled = (i === 0);
        $("tourNext").textContent = (i === TOUR_STEPS.length - 1) ? t("tourNextLast") : t("tourNext");
    }
    function startTour() {
        $("tourBar").hidden = false;
        goTourStep(0);
    }
    function exitTour() {
        $("tourBar").hidden = true;
        document.querySelectorAll(".tg-tour-highlight").forEach(function (n) { n.classList.remove("tg-tour-highlight"); });
        state.tourIndex = -1;
    }

    // ------------------------------------------------------------------
    // Rich feature 3 — 6-day timeline scrubber (Section 3).
    // Drag the day slider to step through each day: the readout shows that
    // day's numbers and the matching table row is highlighted.
    // ------------------------------------------------------------------
    function renderDayScrub() {
        const slider = $("daySlider");
        if (!slider || !state.dailyRows || !state.dailyRows.length) return;
        const day = Math.max(1, Math.min(6, parseInt(slider.value, 10) || 6));
        state.dayScrub = day;
        $("dayValue").textContent = isAr() ? ("اليوم " + day) : ("Day " + day);
        const d = state.dailyRows[day - 1];
        if (!d) return;
        const daySrc = (day - 1) >= state.dailyRows.length - 2 ? t("strainForecast") : t("strainObserved");
        $("dayReadout").textContent = tf("dayReadout", { day: day, date: d.date, wbgt: d.maxWbgt.toFixed(1), night: d.nightMin.toFixed(1), points: d.points, cum: d.cumulative }) + " · " + daySrc + (d.cumulative >= 12 ? t("dayReadoutRed") : "");
        // Highlight the matching table row.
        const rows = document.querySelectorAll("#strainTableWrap tbody tr");
        rows.forEach(function (tr, idx) { tr.classList.toggle("tg-row-active", idx === day - 1); });
    }

    // ------------------------------------------------------------------
    // Rich feature 4 — Before / after slider (Section 4).
    // Scales the prevented-hours and cooling-minutes KPIs with the slider:
    // 0% = no rest schedule, 100% = full schedule applied.
    // ------------------------------------------------------------------
    function renderBeforeAfter() {
        const slider = $("baSlider");
        if (!slider) return;
        const pct = Math.max(0, Math.min(100, parseInt(slider.value, 10) || 0));
        $("baValue").textContent = pct + "%";
        const prevented = (state.preventedHours || 0) * pct / 100;
        const cooling = (state.coolingMinutes || 0) * pct / 100;
        setMetric($("kpiPrevented"), t("kpiPreventedLabel"),
            prevented.toFixed(1) + (isAr() ? " ساعة / وردية 12 ساعة" : " hrs / 12-hr shift"), tf("baPreventedDelta", { pct: pct, limit: (state.effectiveLimit !== undefined ? state.effectiveLimit : 26.0).toFixed(1) }));
        setMetric($("kpiCooling"), t("kpiCoolingLabel"),
            Math.round(cooling) + (isAr() ? " دقيقة" : " mins"), tf("baCoolingDelta", { h: (cooling / 60).toFixed(1), pct: pct }));
    }

    // ------------------------------------------------------------------
    // Rich feature 5 — Animated counters (Section 8 impact numbers).
    // v14 FIX (live check 2026-11-16): screenshots caught the ROI
    // numbers mid-count (2,163 workers / $259,548 instead of the final
    // 4,500 / $540,000), because the count-up started 400 ms after a
    // slow 0.9 s fade. Now the fade is 0.35 s (see styles.css), the
    // counter starts 100 ms after the section becomes visible and
    // finishes in 1.0 s, so a judge scrolling normally sees the final
    // values, not a half-counted number.
    // ------------------------------------------------------------------
    function animateCounter(el) {
        if (!el || el.dataset.counted) return;
        el.dataset.counted = "1";
        const target = parseFloat(el.dataset.count) || 0;
        const prefix = el.dataset.prefix || "";
        const start = performance.now();
        const dur = 1000;
        function frame(now) {
            const p = Math.max(0, Math.min(1, (now - start) / dur));
            const eased = 1 - Math.pow(1 - p, 3);
            el.textContent = prefix + Math.round(target * eased).toLocaleString("en-US");
            if (p < 1) requestAnimationFrame(frame);
            else el.textContent = prefix + Math.round(target).toLocaleString("en-US");
        }
        requestAnimationFrame(frame);
    }
    function initCounters() {
        // Set every counter to its zero state; the count-up starts when its
        // section scrolls into view (initScrollReveal calls animateCounter).
        document.querySelectorAll("[data-count]").forEach(function (el) {
            const prefix = el.dataset.prefix || "";
            el.textContent = prefix + "0";
        });
    }

    // ------------------------------------------------------------------
    // Rich feature 6 — Scroll-in animations.
    // Sections fade and slide up the first time they scroll into view.
    // v14 FIX (live check 2026-11-16): Sections 6 and 8 rendered very
    // pale / low-contrast on scroll, with a large pale blank area below
    // Section 8 before Sections 9-10 faded in. Root causes: a 0.9 s
    // fade, plus a stacked per-section delay of up to 60 ms x 11
    // sections (set in boot), plus an IntersectionObserver threshold
    // of 0.12 that only fired once 12% of a section was visible, so a
    // fast scroll or a screenshot caught sections mid-fade at low
    // opacity. Fix: the CSS fade is now 0.35 s with no delay (see
    // styles.css), the observer fires earlier (threshold 0.05, with
    // a 120 px root margin so the fade starts before the section
    // enters the viewport), counters start 100 ms after reveal, and
    // a 1,200 ms safety fallback reveals every section even if the
    // observer never fires (for example in a screenshot or headless
    // check), so no section can stay pale or blank.
    // ------------------------------------------------------------------
    function initScrollReveal() {
        const nodes = document.querySelectorAll(".tg-anim");
        if (!nodes.length) return;
        function reveal(node) {
            node.classList.add("tg-visible");
            setTimeout(function () {
                node.querySelectorAll("[data-count]").forEach(animateCounter);
            }, 100);
        }
        if (typeof IntersectionObserver === "undefined") {
            nodes.forEach(function (n) { reveal(n); });
            return;
        }
        const obs = new IntersectionObserver(function (entries) {
            for (const entry of entries) {
                if (!entry.isIntersecting) continue;
                reveal(entry.target);
                obs.unobserve(entry.target);
            }
        }, { threshold: 0.05, rootMargin: "120px 0px 120px 0px" });
        nodes.forEach(function (n) { obs.observe(n); });
        // Safety fallback: never leave a section invisible.
        setTimeout(function () {
            nodes.forEach(function (n) { reveal(n); });
        }, 1200);
    }

    // ------------------------------------------------------------------
    // Boot
    // ------------------------------------------------------------------
    function boot() {
        // Each step runs in its own try/catch so one failure (for example a
        // map error) cannot stop the rest, and the live data load always runs.
        try {
            // Stagger the load fade-in: hero first, then each section in turn.
            const animated = document.querySelectorAll(".tg-anim");
            animated.forEach(function (node, i) {
                node.style.setProperty("--anim-order", String(i));
            });
        } catch (e) { reportError("animation setup failed: " + e.message); }
        try { applyTheme(); } catch (e) { reportError("theme failed: " + e.message); }
        try { applyLang(); } catch (e) { reportError("language failed: " + e.message); }
        try { initControls(); } catch (e) { reportError("controls failed: " + e.message); }
        try { renderCost(); } catch (e) { reportError("cost calculator failed: " + e.message); }
        try { initCounters(); } catch (e) { reportError("counters failed: " + e.message); }
        try { initScrollReveal(); } catch (e) { reportError("scroll reveal failed: " + e.message); }
        // v22: 60 s live auto-poll (ON by default). One interval for the
        // life of the page; the toggle only flips state.autoPoll, it
        // never creates a second interval.
        try {
            if (!state.autoPollTimer) {
                state.autoPollTimer = setInterval(function () {
                    if (state.autoPoll) loadAll();
                }, 60000);
            }
        } catch (e) { reportError("auto-poll failed: " + e.message); }
        loadAll();
    }

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", boot);
    } else {
        boot();
    }
})();

// PWA v19: service worker + in-page install button.
// v17/v18 hid installBtn until beforeinstallprompt fired. In the user's
// own session the button WAS there and worked, then DISAPPEARED after
// the click -- so the bug is the disappearing after the click, not a
// missing prompt. Fix (user-corrected 2026-11-16):
//  - The button is ALWAYS visible (no hidden attribute in index.html,
//    and this code never sets hidden on it or on any other control).
//  - Accepted: button stays visible as a persistent "Installed" state
//    (disabled, text "Installed"), nothing else changes.
//  - Dismissed: button stays fully visible and clickable again, status
//    "Install dismissed — click Install app to try again".
//  - No deferred prompt on a later click: button stays visible, status
//    shows the browser-menu fallback, never hides anything.
//  - appinstalled: same persistent "Installed" state, never hidden.
//  Top-bar buttons (theme, language, Refresh) and the site/clothing
//  selects are never hidden by this code at any point.
var deferredInstallPrompt = null;
var installBtn = document.getElementById('installBtn');
var pwaStatus = document.getElementById('pwaStatus');
// PWA strings live above the IIFE (see top of file) so applyLang()
// can use pwaT() during boot, before the PWA block below runs.
function setPwaStatus(text, key) { if (pwaStatus) { pwaStatus.textContent = text; } document.body.setAttribute('data-pwa-status', text || ''); if (key) document.body.setAttribute('data-pwa-key', key); }
function setInstallButtonInstalled() {
  if (!installBtn) return;
  installBtn.hidden = false;           // never hidden, even when installed
  installBtn.disabled = true;
  installBtn.textContent = pwaT('installed');
  document.body.setAttribute('data-installable', 'installed');
}
if ('serviceWorker' in navigator) {
  window.addEventListener('load', function () {
    navigator.serviceWorker.register('./sw.js').then(function (reg) {
      document.body.setAttribute('data-sw', 'registered');
      setPwaStatus(pwaT('ready'), 'ready');
      console.log('Service worker registered:', reg.scope);
    }).catch(function (err) {
      document.body.setAttribute('data-sw', 'failed');
      setPwaStatus(pwaT('swFailed'), 'swFailed');
      console.warn('Service worker registration failed:', err);
    });
  });
} else {
  setPwaStatus(pwaT('noSw'), 'noSw');
}
window.addEventListener('beforeinstallprompt', function (e) {
  e.preventDefault();
  deferredInstallPrompt = e;
  document.body.setAttribute('data-installable', 'yes');
  if (installBtn) { installBtn.hidden = false; installBtn.disabled = false; }
  setPwaStatus(pwaT('available'), 'available');
});
if (installBtn) {
  installBtn.addEventListener('click', function () {
    if (installBtn.disabled) return; // already installed: do nothing, stay visible
    if (!deferredInstallPrompt) {
      // No prompt captured (already dismissed once, or Chrome did not
      // fire it): keep the button visible and point at the browser menu.
      setPwaStatus(pwaT('menu'), 'menu');
      return;
    }
    deferredInstallPrompt.prompt();
    deferredInstallPrompt.userChoice.then(function (choice) {
      if (choice.outcome === 'accepted') {
        setPwaStatus(pwaT('installedMsg'), 'installedMsg');
        setInstallButtonInstalled();
      } else {
        setPwaStatus(pwaT('dismissed'), 'dismissed');
        // Button stays fully visible and clickable again.
        installBtn.hidden = false; installBtn.disabled = false;
        installBtn.textContent = pwaT('install');
      }
      deferredInstallPrompt = null;
    });
  });
}
window.addEventListener('appinstalled', function () {
  setPwaStatus(pwaT('installedMsg'), 'installedMsg');
  setInstallButtonInstalled();
});
