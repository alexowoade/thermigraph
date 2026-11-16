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
                b.textContent = "Page error: " + msg + " — the data below may be incomplete. Please click Refresh live data.";
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
    // Text (EN / AR) — same strings as the Streamlit dashboard.
    // v15 SCOPE (honest): the toggle translates the page chrome — hero,
    // all 11 section headings, all kickers, hero pills, the top-bar and
    // main action buttons, and the footer — and flips the page to RTL.
    // It does NOT translate the body paragraphs, captions, tables,
    // chart labels, map tooltips, triage extraction, or Section 11
    // evidence text: those are rendered dynamically in JS (or are
    // clinical text that must not be machine-translated without review).
    // A full flip needs every render function to look strings up in
    // this dictionary plus a translator review of the clinical copy.
    // What IS fully bilingual already: the triage crew broadcasts
    // (Arabic + Hindi/Urdu) in logic.js deterministicTriageFallback.
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
        kicker10: "Last-Mile Field Equity",
        kickerDemo: "Live Demo Control",
        kicker11: "Evidence & Limits",
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
        kicker11: "الأدلة والحدود",
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
    };

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
        customLat: 6.4402,
        customLon: 4.0193,
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
    async function omFetch(params) {
        const q = new URLSearchParams(params);
        const res = await fetch(OM_BASE + "?" + q.toString());
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

    // ------------------------------------------------------------------
    // Rendering — Section 1 (live zones + 3D map)
    // ------------------------------------------------------------------
    function renderZoneCards() {
        const wrap = $("zoneCards");
        wrap.innerHTML = "";
        if (!state.live) return;
        for (const name of Object.keys(L.ZONES)) {
            const z = state.live[name];
            const card = el("div", "tg-metric");
            const label = el("div", "tg-metric-label", name + " WBGT Estimate");
            const value = el("div", "tg-metric-value");
            const delta = el("div", "tg-metric-delta",
                "Air: " + z.current.temperature_2m + "°C | RH: " + z.current.relative_humidity_2m + "% | Wind: " + z.current.wind_speed_10m + " km/h");
            card.appendChild(label); card.appendChild(value); card.appendChild(delta);
            wrap.appendChild(card);
            animateNumber(value, z.wbgt, 1, " °C");
        }
        $("liveCaption").textContent = "Live readings as of " + state.liveTime + " (local site time, Open-Meteo).";
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
            showMapFallback("Map unavailable (map library did not load). Values are live.");
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
        }
        for (const r of zoneRows()) {
            const c = "rgb(" + r.color[0] + "," + r.color[1] + "," + r.color[2] + ")";
            // Radius in px: ~22 at WBGT 21.9, ~46 at WBGT 34.9.
            const radius = Math.round(14 + Math.max(0, r.wbgt - 15) * 1.6);
            const label = r.zone + " — " + r.wbgt.toFixed(1) + " °C";
            // Click popup: the zone's live numbers, so a judge can tap a dot
            // and see the details without scrolling to the cards above.
            const popup = "<b>" + esc(r.zone) + "</b><br>WBGT estimate: <b>" + r.wbgt.toFixed(1) + " °C</b>" +
                (r.air !== undefined ? "<br>Air: " + r.air.toFixed(1) + " °C · RH: " + r.rh.toFixed(0) + "% · Wind: " + r.wind.toFixed(1) + " km/h" : "");
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
            showMapFallback("Map could not start. Values below are live.");
        }
    }

    // ------------------------------------------------------------------
    // Rendering — Section 2 (site selector, spike, NIOSH)
    // ------------------------------------------------------------------
    function renderSection2() {
        const a = state.activeLive;
        if (!a) return;
        const c = a.current;
        const res = L.estimateWBGT(c.temperature_2m + state.spike, c.relative_humidity_2m, a.solar, c.wind_speed_10m);
        state.spikedWbgt = res[0]; state.spikedTw = res[1]; state.spikedTg = res[2];
        $("spikeValue").textContent = "+" + state.spike + " °C";
        const metric = $("spikedMetric");
        metric.innerHTML = "";
        const label = el("div", "tg-metric-label", state.activeName + " WBGT (with spike)");
        const value = el("div", "tg-metric-value");
        const delta = el("div", "tg-metric-delta",
            "+" + state.spike + " °C anomaly | Wet-Bulb: " + state.spikedTw.toFixed(1) + "°C | Globe: " + state.spikedTg.toFixed(1) + "°C");
        metric.appendChild(label); metric.appendChild(value); metric.appendChild(delta);
        animateNumber(value, state.spikedWbgt, 1, " °C");
        // NIOSH chips
        const chips = $("nioshChips");
        chips.innerHTML = "";
        for (const ln of L.nioshCheck(state.spikedWbgt)) {
            const ok = ln.indexOf("OK") !== -1;
            const chip = el("div", "tg-niosh-chip " + (ok ? "tg-chip-ok" : "tg-chip-over"), ln.trim());
            chips.appendChild(chip);
        }
        // Alert
        const alert = $("spikeAlert");
        if (state.spikedWbgt > 28.0) {
            alert.hidden = false;
            alert.className = "tg-alert tg-alert-error";
            alert.textContent = "CRITICAL: Spiked WBGT exceeds the 28.0 °C Moderate limit. Heavy and moderate continuous outdoor work must stop.";
        } else if (state.spikedWbgt > 26.0) {
            alert.hidden = false;
            alert.className = "tg-alert tg-alert-warn";
            alert.textContent = "HIGH STRAIN: Spiked WBGT exceeds the 26.0 °C Heavy work limit. Strict work-rest micro-rotations required.";
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
        const r = L.computeTimelineAndStrain(h, state.spike);
        state.totalStrain = r.totalStrain;
        state.debtDays = r.debtDays;
        state.dailyRows = r.dailyRows;
        renderChart(r.chartRows);
        // Strain table
        const wrap = $("strainTableWrap");
        wrap.innerHTML = "";
        const table = el("table", "tg-table");
        const thead = document.createElement("thead");
        thead.innerHTML = "<tr><th>Date</th><th>Max Temp (°C)</th><th>Night Min (°C)</th><th>Max WBGT Est. (°C)</th><th>Hours &gt; Heavy Limit (26°C)</th><th>Nocturnal Recovery Debt (&gt;28°C)</th><th>Daily Strain Points</th><th>Cumulative Strain Index</th></tr>";
        const tbody = document.createElement("tbody");
        for (const d of r.dailyRows) {
            const tr = document.createElement("tr");
            tr.innerHTML = "<td>" + esc(d.date) + "</td><td>" + d.maxTemp.toFixed(1) + "</td><td>" + d.nightMin.toFixed(1) + "</td><td>" +
                d.maxWbgt.toFixed(1) + "</td><td>" + d.hoursOverHeavy + "</td><td>" + esc(d.recoveryDebt) + "</td><td>" +
                d.points + "</td><td><b>" + d.cumulative + "</b></td>";
            tbody.appendChild(tr);
        }
        table.appendChild(thead); table.appendChild(tbody);
        wrap.appendChild(table);
        // Banner
        const banner = $("strainBanner");
        if (r.totalStrain >= 12) {
            banner.hidden = false;
            banner.className = "tg-alert tg-alert-error";
            banner.textContent = "RED LINE CROSSED: 6-Day Cumulative Thermal Strain Index is " + r.totalStrain + " (Threshold: 12). Multi-day thermal debt and failed overnight cooling indicate high risk of acute heat exhaustion and renal strain.";
        } else {
            banner.hidden = false;
            banner.className = "tg-alert tg-alert-info";
            banner.textContent = "6-Day Cumulative Thermal Strain Index: " + r.totalStrain + " / 12 (Below red-line collapse threshold at +" + state.spike + "°C spike). Increase the Heat Spike Simulator slider to observe multi-day thermal debt accumulation.";
        }
        // Gauge (width + colour glide smoothly via CSS transition)
        const colour = r.totalStrain >= 12 ? "#f43f5e" : (r.totalStrain >= 8 ? "#f59e0b" : "#10b981");
        const fill = Math.min(r.totalStrain / 24.0 * 100.0, 100.0);
        const fillEl = $("gaugeFill");
        fillEl.style.width = fill.toFixed(0) + "%";
        fillEl.style.background = colour;
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
            node.innerHTML = "<div class='tg-chart-note'>Strain chart unavailable (chart library did not load). The table below has the same 6-day data.</div>";
            return;
        }
        const isDark = state.theme === "dark";
        const x = chartRows.map(function (r) { return r.time; });
        const y = chartRows.map(function (r) { return r.wbgt; });
        const fontCol = isDark ? "#e2e8f0" : "#334155";
        const lineCol = isDark ? "#38bdf8" : "#0284c7";
        const data = [{ x: x, y: y, type: "scatter", mode: "lines", name: "WBGT estimate (C)", line: { color: lineCol, width: 2.6 } }];
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
        const yDataMin = y.length ? Math.min.apply(null, y.concat([26.0])) : 20;
        const yDataMax = y.length ? Math.max.apply(null, y.concat([28.0])) : 28;
        const yMin = Math.floor(yDataMin - 2);
        const yMax = Math.ceil(yDataMax + 2);
        const labelBg = isDark ? "rgba(15,23,42,0.85)" : "rgba(255,255,255,0.85)";
        const layout = {
            title: { text: "Hourly WBGT estimate, 6-day window", font: { color: fontCol, family: "Plus Jakarta Sans" } },
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
                { type: "line", x0: 0, x1: 1, xref: "paper", y0: 26.0, y1: 26.0, line: { color: "#f59e0b", dash: "dash" } },
                { type: "line", x0: 0, x1: 1, xref: "paper", y0: 28.0, y1: 28.0, line: { color: "#f43f5e", dash: "dash" } },
            ],
            annotations: [
                { x: 0.98, xref: "paper", y: 26.0, text: "Heavy limit 26 °C", showarrow: false, xanchor: "right", yanchor: "middle", bgcolor: labelBg, bordercolor: "#f59e0b", borderwidth: 1, font: { color: "#f59e0b", size: 11 } },
                { x: 0.98, xref: "paper", y: 28.0, text: "Moderate limit 28 °C", showarrow: false, xanchor: "right", yanchor: "middle", bgcolor: labelBg, bordercolor: "#f43f5e", borderwidth: 1, font: { color: "#f43f5e", size: 11 } },
            ],
        };
        const config = { responsive: true, displayModeBar: false };
        if (state.chartDrawn) Plotly.react(node, data, layout, config);
        else { Plotly.newPlot(node, data, layout, config); state.chartDrawn = true; }
    }

    // ------------------------------------------------------------------
    // Rendering — Section 4 (shift schedule)
    // ------------------------------------------------------------------
    function renderSection4(hourly) {
        const s = L.computeShiftSchedule(hourly, state.spike);
        state.preventedHours = s.preventedHours;
        state.coolingMinutes = s.coolingMinutes;
        state.shiftTomorrow = s.tomorrow;
        setMetric($("kpiPrevented"), "Unsafe Heavy-Work Hours Prevented", s.preventedHours + " hrs / 12-hr shift", "Hours > 26.0 °C WBGT auto-restricted");
        setMetric($("kpiCooling"), "Mandatory Cooling & Shade", s.coolingMinutes + " mins", (s.coolingMinutes / 60).toFixed(1) + " hrs total recovery time");
        setMetric($("kpiDebt"), "Active Nocturnal Debt Days (>28°C)", state.debtDays + " / 6 days", "Overnight recovery failure flag");
        $("shiftIntro").innerHTML = "Projected Schedule for <code>" + esc(s.tomorrow) + "</code> (at +" + state.spike + "°C spike): Heavy labour restricted to <code>06:00–10:00</code>. Crews anonymised (<code>Crew A</code>, <code>Crew B</code>).";
        const wrap = $("shiftTableWrap");
        wrap.innerHTML = "";
        const table = el("table", "tg-table");
        const thead = document.createElement("thead");
        thead.innerHTML = "<tr><th>Hour</th><th>Projected Temp (°C)</th><th>Projected WBGT (°C)</th><th>Work / Rest Ratio</th><th>Anonymised Crew Assignment</th></tr>";
        const tbody = document.createElement("tbody");
        for (const row of s.rows) {
            const tr = document.createElement("tr");
            tr.innerHTML = "<td>" + esc(row.hour) + "</td><td>" + row.temp.toFixed(1) + "</td><td>" + row.wbgt.toFixed(1) + "</td><td>" + esc(row.protocol) + "</td><td>" + esc(row.crew) + "</td>";
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
        $("triageEngine").textContent = "Active Triage Engine: " + state.triage.engine;
        const rows = [
            ["Worker (Anonymised)", r.workerSummary],
            ["Symptom Severity", r.symptomSeverity],
            ["Extracted Symptoms", r.symptoms.join(", ")],
            ["Hydration & Sweating Status", r.hydrationStatus],
            ["PPE / Equipment Friction", r.equipmentFriction],
            ["Occupational Risk Tier", r.oshaRiskTier],
            ["Immediate Action Required", r.immediateAction],
            ["Arabic Crew Broadcast (العربية)", r.arabicCrewAlert],
            ["Hindi/Urdu Crew Broadcast", r.hindiUrduCrewAlert],
        ];
        const table = el("table", "tg-table");
        const tbody = document.createElement("tbody");
        for (const pair of rows) {
            const tr = document.createElement("tr");
            const sev = pair[0] === "Symptom Severity" ? severityBadge(pair[1]) : esc(pair[1]);
            tr.innerHTML = "<td><b>" + esc(pair[0]) + "</b></td><td>" + sev + "</td>";
            tbody.appendChild(tr);
        }
        table.appendChild(tbody);
        wrap.appendChild(table);
    }
    function severityBadge(sev) {
        const cls = sev === "Critical" ? "tg-badge-red" : (sev === "High" ? "tg-badge-amber" : "tg-badge-green");
        return "<span class='tg-badge " + cls + "'>" + esc(sev) + "</span>";
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
                state.compareMapMarkers = {};
                state.compareMapRings = {};
                window.addEventListener("resize", function () { if (state.compareMap) state.compareMap.invalidateSize(); });
                setTimeout(function () { if (state.compareMap) state.compareMap.invalidateSize(); }, 300);
            } else {
                state.compareMapTile.setUrl(leafletTileUrl(isDark));
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
                const label = hasLive ? (site + " — " + wbgt.toFixed(1) + " °C") : (site + " — live value loading…");
                const popup = hasLive
                    ? ("<b>" + esc(site) + "</b><br>Current WBGT: <b>" + wbgt.toFixed(1) + " °C</b><br>Risk tier: " + esc(tierBySite[site] || ""))
                    : ("<b>" + esc(site) + "</b><br>Live value loading…");
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
            wrap.innerHTML = "<p class='tg-body'>Compare-sites table unavailable (Open-Meteo unreachable for one or more sites).</p>";
            return;
        }
        const table = el("table", "tg-table");
        const thead = document.createElement("thead");
        thead.innerHTML = "<tr><th>Site</th><th>Current WBGT (°C)</th><th>6-Day Max WBGT (°C)</th><th>Debt Days</th><th>Risk Tier</th></tr>";
        const tbody = document.createElement("tbody");
        for (const r of state.compareRows) {
            const badge = r.tier === "Critical" ? "tg-badge-red" : (r.tier === "High" ? "tg-badge-amber" : (r.tier === "Moderate" ? "tg-badge-blue" : "tg-badge-green"));
            const tr = document.createElement("tr");
            tr.innerHTML = "<td>" + esc(r.site) + "</td><td>" + r.currentWbgt.toFixed(1) + "</td><td>" + r.maxWbgt.toFixed(1) + "</td><td>" + esc(r.debtDays) + "</td><td><span class='tg-badge " + badge + "'>" + esc(r.tier) + "</span></td>";
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
            ["Projected heat-exhaustion cases", c.cases.toFixed(1), "without intervention (est.)"],
            ["Projected hospitalisations", c.hospitalisations.toFixed(1), "~8% of cases (est.)"],
            ["Projected cost", "$" + Math.round(c.cost).toLocaleString("en-US"), "productivity + care (est.)"],
            ["Prevented by ThermiGraph", c.casesPrevented.toFixed(1) + " cases", "$" + Math.round(c.costPrevented).toLocaleString("en-US") + " saved (est.)"],
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
        const wbgt = L.estimateWBGT(c.temperature_2m + state.demoSpike, c.relative_humidity_2m, a.solar, c.wind_speed_10m)[0];
        $("demoValue").textContent = "+" + state.demoSpike + " °C";
        const status = wbgt > 28.0 ? "HOT — STOP HEAVY WORK" : (wbgt > 26.0 ? "HIGH STRAIN — REST OFTEN" : "OK — WORK NORMALLY");
        const colour = wbgt > 28.0 ? "#f43f5e" : (wbgt > 26.0 ? "#f59e0b" : "#10b981");
        const st = $("phoneStatus");
        st.textContent = status;
        st.style.color = colour;
        $("phoneWbgt").textContent = state.activeName + " — " + wbgt.toFixed(1) + " °C";
        $("phoneShell").style.borderColor = colour;
    }

    // ------------------------------------------------------------------
    // Section 6 — compliance report download (same content as Streamlit)
    // ------------------------------------------------------------------
    function buildReport() {
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
                const wbgt = L.estimateWBGT(raw.current.temperature_2m, raw.current.relative_humidity_2m, raw.solar, raw.current.wind_speed_10m);
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
        if (usedCache) showStatus("⚠️ Open-Meteo unreachable — showing last-good cached Abu Dhabi telemetry. Click 'Refresh live data' to retry.");
        renderZoneCards();
        renderMap();
    }

    async function loadActive() {
        const coords = activeCoords();
        state.activeName = coords.name;
        const liveKey = "tg_active_live_" + coords.lat.toFixed(4) + "_" + coords.lon.toFixed(4);
        const hourlyKey = "tg_active_hourly_" + coords.lat.toFixed(4) + "_" + coords.lon.toFixed(4);
        try {
            const raw = await fetchLiveRaw(coords.lat, coords.lon);
            state.activeLive = raw;
            cacheSet(liveKey, raw);
        } catch (e) {
            const cached = cacheGet(liveKey);
            if (cached) { state.activeLive = cached; showStatus("⚠️ Live telemetry for " + state.activeName + " unavailable — showing last-good reading."); }
            else { showStatus("Live telemetry for " + state.activeName + " is unavailable.", true); return; }
        }
        try {
            const hourly = await fetchHourlyRaw(coords.lat, coords.lon);
            state.activeHourly = hourly;
            cacheSet(hourlyKey, hourly);
        } catch (e) {
            const cached = cacheGet(hourlyKey);
            if (cached) { state.activeHourly = cached; showStatus("⚠️ Hourly forecast for " + state.activeName + " unavailable — showing last-good 6-day window."); }
            else { showStatus("Hourly forecast for " + state.activeName + " is unavailable.", true); return; }
        }
        renderSection2();
        renderSection3();
    }

    async function loadCompare() {
        const siteHourly = {};
        const siteCurrent = {};
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
                } else {
                    try {
                        const raw = await fetchLiveRaw(lat, lon);
                        siteCurrent[siteName] = L.estimateWBGT(raw.current.temperature_2m, raw.current.relative_humidity_2m, raw.solar, raw.current.wind_speed_10m)[0];
                        cacheSet(lk, siteCurrent[siteName]);
                    } catch (e) {
                        const cached = cacheGet(lk);
                        if (cached !== null && cached !== undefined) siteCurrent[siteName] = cached;
                        else throw e;
                    }
                }
            }
            state.compareRows = L.computeCompareSites(siteHourly, state.spike, siteCurrent);
        } catch (e) {
            state.compareRows = null;
        }
        renderCompare();
    }

    async function loadAll() {
        showStatus("Loading live telemetry from Open-Meteo…");
        try {
            await loadZones();
        } catch (e) {
            showStatus("Live telemetry is unavailable right now (Open-Meteo could not be reached). Check network connection and click Refresh.", true);
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
    function applyLang() {
        const T = state.lang === "ar" ? AR : EN;
        document.documentElement.lang = state.lang === "ar" ? "ar" : "en";
        document.documentElement.dir = state.lang === "ar" ? "rtl" : "ltr";
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
        $("heroTitle").dir = "auto";
        $("langToggle").textContent = state.lang === "ar" ? "English" : "العربية";
        setThemeLabel();
        try { localStorage.setItem("thermigraph_lang", state.lang); } catch (e) { /* storage blocked */ }
    }

    // ------------------------------------------------------------------
    // Wiring
    // ------------------------------------------------------------------
    function initControls() {
        // Site select
        const sel = $("siteSelect");
        for (const label of Object.keys(L.GLOBAL_SITES)) {
            const opt = document.createElement("option");
            opt.value = label; opt.textContent = label;
            sel.appendChild(opt);
        }
        sel.value = state.siteLabel;
        sel.addEventListener("change", function () {
            state.siteLabel = sel.value;
            const isCustom = L.GLOBAL_SITES[state.siteLabel] === null;
            $("customGps").hidden = !isCustom;
            if (isCustom) { state.customLat = parseFloat($("customLat").value) || 6.4402; state.customLon = parseFloat($("customLon").value) || 4.0193; }
            loadActive();
        });
        $("customLat").addEventListener("change", function () {
            state.customLat = parseFloat($("customLat").value) || 6.4402;
            if (L.GLOBAL_SITES[state.siteLabel] === null) loadActive();
        });
        $("customLon").addEventListener("change", function () {
            state.customLon = parseFloat($("customLon").value) || 4.0193;
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
        // Demo slider (phone only)
        $("demoSlider").addEventListener("input", function () {
            state.demoSpike = parseInt($("demoSlider").value, 10);
            renderPhone();
        });
        // Triage
        const caseSel = $("caseSelect");
        for (const name of Object.keys(L.SCENARIO_PRESETS)) {
            const opt = document.createElement("option");
            opt.value = name; opt.textContent = name;
            caseSel.appendChild(opt);
        }
        $("noteInput").value = L.SCENARIO_PRESETS[caseSel.value];
        caseSel.addEventListener("change", function () {
            $("noteInput").value = L.SCENARIO_PRESETS[caseSel.value];
        });
        $("btnTriage").addEventListener("click", function () {
            const note = $("noteInput").value;
            const result = L.deterministicTriageFallback(note, state.spikedWbgt);
            state.triage = { result: result, engine: "Deterministic Clinical Fallback Engine (Offline / No-Key Mode)" };
            renderTriageResult();
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
        $("tourTitle").textContent = step.title;
        $("tourText").textContent = step.text;
        $("tourStep").textContent = "Step " + (i + 1) + " of " + TOUR_STEPS.length;
        $("tourPrev").disabled = (i === 0);
        $("tourNext").textContent = (i === TOUR_STEPS.length - 1) ? "Finish ✓" : "Next →";
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
        $("dayValue").textContent = "Day " + day;
        const d = state.dailyRows[day - 1];
        if (!d) return;
        $("dayReadout").textContent = "Day " + day + " (" + d.date + "): max WBGT " + d.maxWbgt.toFixed(1) +
            " °C, night min " + d.nightMin.toFixed(1) + " °C, " + d.points + " strain points, cumulative " +
            d.cumulative + " / 12" + (d.cumulative >= 12 ? " — RED LINE CROSSED" : "");
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
        setMetric($("kpiPrevented"), "Unsafe Heavy-Work Hours Prevented",
            prevented.toFixed(1) + " hrs / 12-hr shift", "Hours > 26.0 °C WBGT auto-restricted · " + pct + "% of schedule applied");
        setMetric($("kpiCooling"), "Mandatory Cooling & Shade",
            Math.round(cooling) + " mins", (cooling / 60).toFixed(1) + " hrs total recovery time · " + pct + "% of schedule applied");
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
        loadAll();
    }

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", boot);
    } else {
        boot();
    }
})();

// PWA v16: register service worker for installable offline shell. Live weather is network-first.
if ('serviceWorker' in navigator) {
  window.addEventListener('load', function () {
    navigator.serviceWorker.register('./sw.js').catch(function (err) { console.warn('Service worker registration failed:', err); });
  });
}
