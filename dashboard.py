# ThermiGraph dashboard: dashboard.py for Streamlit, clinical view (v6.3.1).
# Run with: streamlit run dashboard.py
# v6.3.1 restores from v6.2.2 and adds the Dual-Theme (Clinical Daylight / Obsidian Dark):
#   - Full compliance report content restored (was 2 lines in v6.3)
#   - Tab 5 demo slider restored (phone reacts live)
#   - Wi-Fi session-state fallback restored for live + active site
#   - Compare-Sites current WBGT fixed (was using raw air temp for non-UAE sites)
#   - Illustrative cost-of-inaction label restored
#   - Metric deltas restored
# Business logic lives in dashboard_logic.py so it can be unit-tested without Streamlit.

from datetime import date, timedelta
import os
from pathlib import Path

from dotenv import load_dotenv
import pandas as pd
import requests
import streamlit as st

from dashboard_logic import (
    compute_compare_sites,
    compute_shift_schedule,
    compute_timeline_and_strain,
    cost_of_inaction,
    wbgt_iso_cross_check,
)
from physics_engine import estimate_wbgt, niosh_check
from triage import SCENARIO_PRESETS, run_field_triage

# Primary Host-Country Pilot Corridor (Abu Dhabi)
ZONES = {
    "Mussafah (UAE)": (24.3613, 54.5038),
    "KEZAD / Khalifa Port (UAE)": (24.7880, 54.6947),
    "Ruwais (UAE)": (24.0916, 52.6527),
}

GLOBAL_SITES = {
    "Mussafah (UAE — Host Pilot)": (24.3613, 54.5038),
    "KEZAD / Khalifa Port (UAE — Host Pilot)": (24.7880, 54.6947),
    "Ruwais (UAE — Host Pilot)": (24.0916, 52.6527),
    "Lagos — Lekki Industrial Zone (Nigeria / West Africa)": (6.4402, 4.0193),
    "Delhi NCR — Industrial Belt (India / South Asia)": (28.6139, 77.2090),
    "Houston — Petrochemical Corridor (USA / North America)": (29.7355, -95.2638),
    "Custom Global GPS Coordinates (Any Worksite Worldwide)": None,
}

COMPARE_SITES = {
    "Mussafah (UAE)": (24.3613, 54.5038),
    "Lagos (Nigeria)": (6.4402, 4.0193),
    "Delhi NCR (India)": (28.6139, 77.2090),
    "Houston (USA)": (29.7355, -95.2638),
}


@st.cache_data(ttl=600)
def fetch_live_raw(lat: float, lon: float):
    """Cached Open-Meteo current reading plus hourly solar for any global coordinate."""
    url = "https://api.open-meteo.com/v1/forecast"
    params = {
        "latitude": lat,
        "longitude": lon,
        "current": "temperature_2m,relative_humidity_2m,wind_speed_10m",
        "hourly": "shortwave_radiation",
        "timezone": "auto",
        "forecast_days": 1,
    }
    response = requests.get(url, params=params, timeout=30)
    response.raise_for_status()
    data = response.json()
    current = data["current"]
    hour = current["time"][:13]
    try:
        hour_index = [t[:13] for t in data["hourly"]["time"]].index(hour)
        solar = data["hourly"]["shortwave_radiation"][hour_index] or 0.0
    except ValueError:
        solar = 0.0
    return current, solar


@st.cache_data(ttl=600)
def fetch_hourly_raw(lat: float, lon: float):
    """Cached hourly temp, RH, wind, solar for past 3 + next 3 days globally."""
    url = "https://api.open-meteo.com/v1/forecast"
    params = {
        "latitude": lat,
        "longitude": lon,
        "hourly": "temperature_2m,relative_humidity_2m,wind_speed_10m,shortwave_radiation",
        "timezone": "auto",
        "past_days": 3,
        "forecast_days": 3,
    }
    response = requests.get(url, params=params, timeout=30)
    response.raise_for_status()
    return response.json()["hourly"]


def resolve_gemini_key():
    try:
        if "GEMINI_API_KEY" in st.secrets:
            return st.secrets["GEMINI_API_KEY"]
    except Exception:
        pass
    load_dotenv()
    load_dotenv(Path.home() / "thermigraph" / ".env")
    return os.environ.get("GEMINI_API_KEY")


def wbgt_color(wbgt_c: float):
    if wbgt_c > 28.0:
        return [244, 63, 94, 215]
    if wbgt_c > 26.0:
        return [249, 115, 22, 215]
    if wbgt_c > 25.0:
        return [245, 158, 11, 215]
    return [16, 185, 129, 215]


# ---------------------------------------------------------------------------
# Page setup and sidebar controls (Theme, Language, Layout)
# ---------------------------------------------------------------------------
st.set_page_config(
    page_title="ThermiGraph AI — Biometeorological Command Center",
    page_icon="🌡️",
    layout="wide",
    initial_sidebar_state="expanded",
)

with st.sidebar:
    st.markdown('<div class="tg-kicker">Display & Locale</div>', unsafe_allow_html=True)
    theme_choice = st.radio("UI Theme", ["☀️ Clinical Daylight", "🌙 Obsidian Dark"], index=0)
    lang = st.radio("Language / اللغة", ["English", "العربية"], index=0)
    layout_mode = st.radio(
        "Navigation Layout",
        ["Full 10-Section Scroll", "Tabbed Command Center"],
        index=0,
    )
    if st.button("🔄 Refresh live data"):
        st.cache_data.clear()
        st.rerun()

is_dark = theme_choice == "🌙 Obsidian Dark"

theme_css = f"""
    <style>
    @import url('https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;600;700&family=Noto+Sans+Arabic:wght@400;600;700&family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap');

    :root {{
        --bg-obsidian: {"#060911" if is_dark else "#f8fafc"};
        --glass-surface: {"rgba(15, 23, 42, 0.68)" if is_dark else "rgba(255, 255, 255, 0.88)"};
        --glass-border: {"rgba(255, 255, 255, 0.08)" if is_dark else "rgba(15, 23, 42, 0.10)"};
        --glass-border-hover: {"rgba(56, 189, 248, 0.45)" if is_dark else "rgba(14, 165, 233, 0.45)"};
        --text-primary: {"#f8fafc" if is_dark else "#0f172a"};
        --text-secondary: {"#94a3b8" if is_dark else "#475569"};
        --card-bg: {"rgba(15, 23, 42, 0.75)" if is_dark else "#ffffff"};
    }}

    html, body, [class*="css"] {{
        font-family: 'Plus Jakarta Sans', 'Noto Sans Arabic', -apple-system, BlinkMacSystemFont, sans-serif !important;
        color: var(--text-primary);
    }}

    .stApp {{
        background: {"linear-gradient(180deg, #060911 0%, #0b1120 100%)" if is_dark else "linear-gradient(180deg, #f8fafc 0%, #e2e8f0 100%)"} !important;
    }}

    .block-container {{
        padding-top: 1.5rem !important;
        padding-bottom: 3.5rem !important;
        max-width: 1400px !important;
    }}

    section[data-testid="stSidebar"] {{
        background: {"rgba(8, 13, 25, 0.88)" if is_dark else "rgba(241, 245, 249, 0.92)"} !important;
        backdrop-filter: blur(22px) !important;
        border-right: 1px solid var(--glass-border) !important;
    }}

    .tg-hero {{
        padding: 1.8rem 2.2rem;
        border-radius: 22px;
        background: {"linear-gradient(135deg, rgba(15, 23, 42, 0.85) 0%, rgba(15, 23, 42, 0.50) 100%)" if is_dark else "linear-gradient(135deg, rgba(255, 255, 255, 0.95) 0%, rgba(241, 245, 249, 0.85) 100%)"};
        backdrop-filter: blur(20px);
        border: 1px solid var(--glass-border);
        box-shadow: 0 20px 40px -12px rgba(0, 0, 0, {"0.65" if is_dark else "0.12"});
        margin-bottom: 1.5rem;
        animation: tgFadeUp 0.6s ease both;
    }}

    div[data-testid="stVerticalBlockBorderWrapper"] {{
        animation: tgFadeUp 0.5s ease both;
    }}

    .tg-badge-row {{
        display: flex;
        flex-wrap: wrap;
        gap: 0.55rem;
        align-items: center;
        margin-bottom: 0.75rem;
    }}

    .tg-pill {{
        display: inline-flex;
        align-items: center;
        gap: 0.45rem;
        padding: 0.28rem 0.78rem;
        border-radius: 999px;
        font-size: 0.72rem;
        font-weight: 600;
        text-transform: uppercase;
        background: {"rgba(56, 189, 248, 0.13)" if is_dark else "rgba(2, 132, 199, 0.10)"};
        color: {"#7dd3fc" if is_dark else "#0284c7"};
        border: 1px solid {"rgba(56, 189, 248, 0.30)" if is_dark else "rgba(2, 132, 199, 0.25)"};
    }}

    .tg-pulse {{
        width: 8px;
        height: 8px;
        border-radius: 50%;
        background: #10b981;
        box-shadow: 0 0 10px #10b981;
        animation: tgPulse 2s infinite;
    }}

    @keyframes tgPulse {{
        0% {{ transform: scale(0.95); opacity: 0.8; }}
        50% {{ transform: scale(1.25); opacity: 1; }}
        100% {{ transform: scale(0.95); opacity: 0.8; }}
    }}

    @keyframes tgFadeUp {{
        from {{ opacity: 0; transform: translateY(10px); }}
        to {{ opacity: 1; transform: translateY(0); }}
    }}

    .tg-hero-title {{
        font-size: 2.35rem;
        font-weight: 800;
        letter-spacing: -0.03em;
        line-height: 1.15;
        margin: 0 0 0.4rem 0;
        background: {"linear-gradient(95deg, #ffffff 0%, #bae6fd 55%, #38bdf8 100%)" if is_dark else "linear-gradient(95deg, #0f172a 0%, #0369a1 100%)"};
        -webkit-background-clip: text;
        -webkit-text-fill-color: transparent;
    }}

    .tg-hero-tagline {{
        font-size: 1.05rem;
        font-weight: 600;
        color: {"#e2e8f0" if is_dark else "#334155"};
        margin: 0 0 0.35rem 0;
    }}

    .tg-hero-sub {{
        font-size: 0.88rem;
        color: var(--text-secondary);
        margin: 0;
        line-height: 1.5;
    }}

    h1, h2, h3 {{
        color: var(--text-primary) !important;
        letter-spacing: -0.02em !important;
        font-weight: 700 !important;
    }}

    /* Widget labels must follow the theme: the native Streamlit theme is
       dark (config.toml), so without this the radio/select/slider labels
       render light-on-light and vanish in Clinical Daylight mode. */
    div[data-testid="stWidgetLabel"] *,
    div[data-testid="stRadio"] label *,
    div[data-testid="stSelectbox"] label *,
    div[data-testid="stSlider"] label *,
    div[data-testid="stNumberInput"] label *,
    div[data-testid="stTextArea"] label * {{
        color: var(--text-primary) !important;
    }}

    .tg-kicker {{
        font-size: 0.73rem;
        font-weight: 700;
        text-transform: uppercase;
        letter-spacing: 0.09em;
        color: {"#38bdf8" if is_dark else "#0284c7"};
        margin-bottom: 0.15rem;
    }}

    div[data-testid="stMetric"] {{
        background: var(--card-bg) !important;
        backdrop-filter: blur(16px) !important;
        border: 1px solid var(--glass-border) !important;
        border-radius: 16px !important;
        padding: 1.15rem 1.3rem !important;
        box-shadow: 0 10px 28px -8px rgba(0, 0, 0, {"0.45" if is_dark else "0.08"}) !important;
    }}

    div[data-testid="stMetricLabel"] {{
        font-size: 0.77rem !important;
        font-weight: 600 !important;
        text-transform: uppercase !important;
        color: var(--text-secondary) !important;
    }}

    div[data-testid="stMetricValue"] {{
        font-family: 'JetBrains Mono', monospace !important;
        font-size: 1.85rem !important;
        font-weight: 700 !important;
        color: var(--text-primary) !important;
    }}

    .tg-glass-card {{
        background: var(--card-bg);
        border: 1px solid var(--glass-border);
        border-radius: 16px;
        padding: 1.2rem 1.4rem;
        margin-bottom: 1rem;
        box-shadow: 0 12px 30px -10px rgba(0, 0, 0, {"0.5" if is_dark else "0.06"});
    }}

    .tg-niosh-grid {{
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(165px, 1fr));
        gap: 0.6rem;
        margin-top: 0.6rem;
    }}

    .tg-niosh-chip {{
        padding: 0.62rem 0.85rem;
        border-radius: 12px;
        font-family: 'JetBrains Mono', monospace;
        font-size: 0.82rem;
        border: 1px solid var(--glass-border);
        background: {"rgba(15, 23, 42, 0.75)" if is_dark else "#f1f5f9"};
    }}

    .tg-chip-ok {{
        border-left: 3px solid #10b981;
        color: {"#a7f3d0" if is_dark else "#047857"};
    }}

    .tg-chip-over {{
        border-left: 3px solid #f43f5e;
        color: {"#fecdd3" if is_dark else "#be123c"};
        background: {"rgba(244, 63, 94, 0.10)" if is_dark else "#ffe4e6"};
    }}

    .stTabs [data-baseweb="tab-list"] {{
        gap: 0.45rem;
        background: {"rgba(15, 23, 42, 0.65)" if is_dark else "rgba(226, 232, 240, 0.7)"};
        padding: 0.42rem;
        border-radius: 14px;
        border: 1px solid var(--glass-border);
        margin-bottom: 1.2rem;
    }}

    .stTabs [data-baseweb="tab"] {{
        border-radius: 10px;
        padding: 0.55rem 1rem;
        font-weight: 600;
        font-size: 0.86rem;
        color: var(--text-secondary);
    }}

    .stTabs [aria-selected="true"] {{
        background: {"linear-gradient(135deg, rgba(56, 189, 248, 0.24), rgba(96, 165, 250, 0.24))" if is_dark else "#ffffff"} !important;
        color: var(--text-primary) !important;
        border: 1px solid rgba(56, 189, 248, 0.38) !important;
    }}

    div.stButton button, div[data-testid="stButton"] button,
    button[data-testid="stBaseButton-secondary"], button[data-testid="stBaseButton-primary"],
    div.stDownloadButton button, div[data-testid="stDownloadButton"] button {{
        background: linear-gradient(135deg, #0284c7 0%, #1d4ed8 100%) !important;
        background-image: linear-gradient(135deg, #0284c7 0%, #1d4ed8 100%) !important;
        color: #ffffff !important;
        font-weight: 600 !important;
        border-radius: 12px !important;
        padding: 0.6rem 1.3rem !important;
        opacity: 1 !important;
    }}

    div.stButton button:hover, div.stButton button:focus, div.stButton button:active, div.stButton button:disabled,
    div[data-testid="stButton"] button:hover, div[data-testid="stButton"] button:focus, div[data-testid="stButton"] button:active, div[data-testid="stButton"] button:disabled,
    button[data-testid="stBaseButton-secondary"]:hover, button[data-testid="stBaseButton-secondary"]:focus, button[data-testid="stBaseButton-secondary"]:active, button[data-testid="stBaseButton-secondary"]:disabled,
    button[data-testid="stBaseButton-secondary"][data-hovered],
    button[data-testid="stBaseButton-primary"]:hover, button[data-testid="stBaseButton-primary"]:focus, button[data-testid="stBaseButton-primary"]:active, button[data-testid="stBaseButton-primary"]:disabled,
    button[data-testid="stBaseButton-primary"][data-hovered],
    div.stDownloadButton button:hover, div.stDownloadButton button:focus, div.stDownloadButton button:active, div.stDownloadButton button:disabled,
    div[data-testid="stDownloadButton"] button:hover, div[data-testid="stDownloadButton"] button:focus, div[data-testid="stDownloadButton"] button:active, div[data-testid="stDownloadButton"] button:disabled {{
        background: linear-gradient(135deg, #0369a1 0%, #1e40af 100%) !important;
        background-image: linear-gradient(135deg, #0369a1 0%, #1e40af 100%) !important;
        color: #ffffff !important;
        border: none !important;
        opacity: 1 !important;
        box-shadow: 0 8px 20px rgba(2, 132, 199, 0.35) !important;
    }}

    .tg-phone-shell {{
        max-width: 440px;
        margin: 0.5rem auto 1rem auto;
        border-radius: 32px;
        padding: 1.5rem 1.4rem;
        background: {"linear-gradient(165deg, rgba(15, 23, 42, 0.95) 0%, rgba(9, 13, 24, 0.98) 100%)" if is_dark else "#ffffff"};
        border: 2px solid rgba(255, 255, 255, 0.14);
        box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.35);
    }}

    .tg-phone-notch {{
        width: 96px;
        height: 6px;
        border-radius: 999px;
        background: {"rgba(255, 255, 255, 0.18)" if is_dark else "#cbd5e1"};
        margin: 0 auto 1.2rem auto;
    }}
    </style>
    """
st.markdown(theme_css, unsafe_allow_html=True)

AR = {
    "title": "ثرميغراف — محرك الإجهاد الحراري",
    "subtitle": "محرك الأرصاد الحيوية والفرز الميداني | تحدي الابتكار الصحي الرقمي 2026",
    "s1": "1. قياسات WBGT المباشرة (ممر أبوظبي التجريبي)",
    "s2": "2. محدد موقع العمل العالمي ومحاكي موجة الحر",
    "s3": "3. الإجهاد الحراري التراكمي لمدة 6 أيام",
    "s4": "4. مُحسِّن الورديات والراحة",
    "s5": "5. فرز سجلات الميدان بالذكاء الاصطناعي",
    "s6": "6. تقرير الامتثال القابل للتنزيل",
    "s7": "7. مقارنة المواقع العالمية",
    "s8": "8. الأثر والعائد على الاستثمار",
    "s9": "9. حاسبة تكلفة التقاعس",
    "s10": "10. عرض العامل",
}
EN = {
    "title": "ThermiGraph AI",
    "subtitle": "Temporal Biometeorological and Field-Triage Engine | Future Health Digital Innovation Challenge 2026.",
    "s1": "1. Live WBGT Telemetry (Abu Dhabi Host Pilot Corridor)",
    "s2": "2. Global Worksite Selector & Heat Spike Simulator",
    "s3": "3. Cumulative Strain Over 6 Days & Nocturnal Recovery Debt",
    "s4": "4. Automated Shift & Work-Rest Optimizer",
    "s5": "5. AI Field-Log Triage & Multilingual Crew Dispatch (Privacy-Preserving)",
    "s6": "6. Exportable Compliance & Triage Report",
    "s7": "7. Global Compare-Sites View",
    "s8": "8. Impact / ROI Panel (Pilot Scale)",
    "s9": "9. Cost-of-Inaction Calculator",
    "s10": "10. Worker-Facing View",
}
T = AR if lang == "العربية" else EN


def H(key: str, suffix: str = ""):
    return f"{T[key]}{suffix}"


st.markdown(
    f"""
    <div class="tg-hero">
        <div class="tg-badge-row">
            <span class="tg-pill"><span class="tg-pulse"></span> Open-Meteo Live Telemetry</span>
            <span class="tg-pill">ISO 7243 · NIOSH Physics</span>
            <span class="tg-pill">Privacy-by-Design Triage</span>
        </div>
        <h1 class="tg-hero-title">{T["title"]}</h1>
        <p class="tg-hero-tagline">
            From a single hot hour to a 6-day physiological debt — ThermiGraph catches heat collapse before Day 3.
        </p>
        <p class="tg-hero-sub">
            {T["subtitle"]} WBGT values are prototype estimates from weather telemetry, not calibrated on-site globe meter readings.
        </p>
    </div>
    """,
    unsafe_allow_html=True,
)

# ---------------------------------------------------------------------------
# Section 1 pre-fetch — with session-state fallback (FIX #3)
# ---------------------------------------------------------------------------
live = {}
try:
    for name, (lat, lon) in ZONES.items():
        current, solar = fetch_live_raw(lat, lon)
        wbgt, wet_bulb, globe = estimate_wbgt(
            current["temperature_2m"],
            current["relative_humidity_2m"],
            solar,
            current["wind_speed_10m"],
        )
        live[name] = (current, solar, wbgt, wet_bulb, globe)
    st.session_state["last_good_live"] = live
except Exception:
    if "last_good_live" in st.session_state:
        st.warning(
            "⚠️ Open-Meteo unreachable — showing last-good cached Abu Dhabi telemetry. "
            "Click 'Refresh live data' in the sidebar to retry."
        )
        live = st.session_state["last_good_live"]
    else:
        st.error(
            "Live telemetry is unavailable right now (Open-Meteo could not be reached). "
            "Check network connection and click Rerun."
        )
        st.stop()


def render_s1_s2():
    st.markdown('<div class="tg-kicker">Host Country Telemetry</div>', unsafe_allow_html=True)
    st.header(H("s1"))
    cols = st.columns(3)
    for col, name in zip(cols, ZONES):
        current, solar, wbgt, wet_bulb, globe = live[name]
        col.metric(
            f"{name} WBGT Estimate",
            f"{wbgt:.1f} °C",
            f"Air: {current['temperature_2m']}°C | RH: {current['relative_humidity_2m']}% | Wind: {current['wind_speed_10m']} km/h",
        )

    first_current = next(iter(live.values()))[0]
    st.caption(f"Live readings as of {first_current['time']} (local site time, Open-Meteo).")

    map_rows = pd.DataFrame(
        [
            {
                "lat": lat,
                "lon": lon,
                "zone": name,
                "wbgt": live[name][2],
                "color": wbgt_color(live[name][2]),
            }
            for name, (lat, lon) in ZONES.items()
        ]
    )
    try:
        import pydeck as pdk

        layer = pdk.Layer(
            "ColumnLayer",
            data=map_rows,
            get_position=["lon", "lat"],
            get_elevation="wbgt",
            elevation_scale=3000,
            radius=12000,
            extruded=True,
            disk_resolution=24,
            get_fill_color="color",
            pickable=True,
            opacity=0.9,
            transitions={"getElevation": 800, "getFillColor": 800},
        )
        # Zone-name labels float above each column top.
        label_data = [
            {"position": [row["lon"], row["lat"], row["wbgt"] * 3000 + 8000], "name": row["zone"]}
            for _, row in map_rows.iterrows()
        ]
        halo_colour = [6, 9, 17, 255] if is_dark else [255, 255, 255, 255]
        text_colour = [226, 232, 240, 255] if is_dark else [15, 23, 42, 255]
        halo_layer = pdk.Layer(
            "TextLayer",
            data=label_data,
            get_position="position",
            get_text="name",
            get_size=20,
            get_color=halo_colour,
            get_alignment_baseline="center",
            font_weight=700,
        )
        text_layer = pdk.Layer(
            "TextLayer",
            data=label_data,
            get_position="position",
            get_text="name",
            get_size=16,
            get_color=text_colour,
            get_alignment_baseline="center",
            font_weight=700,
        )
        view = pdk.ViewState(latitude=24.5, longitude=54.0, zoom=6.0, pitch=45, bearing=0)
        map_style = (
            "https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json"
            if is_dark
            else "https://basemaps.cartocdn.com/gl/voyager-gl-style/style.json"
        )
        st.pydeck_chart(pdk.Deck(layers=[layer, halo_layer, text_layer], initial_view_state=view, map_style=map_style))
        st.caption("3D bars rise from each pilot zone — taller means hotter (bar height scales with live WBGT). Colour is the NIOSH status.")
        st.caption("Bar colours by current WBGT: green < 25 °C, amber 25–26 °C, orange 26–28 °C, red > 28 °C.")
    except Exception:
        st.map(map_rows[["lat", "lon"]])

    st.markdown("<br>", unsafe_allow_html=True)
    st.markdown('<div class="tg-kicker">Global Sentinel Simulation</div>', unsafe_allow_html=True)
    st.header(H("s2"))
    preset_col, reset_col = st.columns(2)
    with preset_col:
        if st.button("▶ Lagos +6°C demo", help="One click to the most dramatic state: Lagos with a +6°C heat spike."):
            st.session_state["site_select"] = "Lagos — Lekki Industrial Zone (Nigeria / West Africa)"
            st.session_state["spike_slider"] = 6
            st.rerun()
    with reset_col:
        if st.button("↺ Back to Mussafah", help="Reset the worksite to Mussafah and the spike to +0°C."):
            st.session_state["site_select"] = "Mussafah (UAE — Host Pilot)"
            st.session_state["spike_slider"] = 0
            st.rerun()
    selected_site_label = st.selectbox(
        "Select Active Worksite for Deep-Dive Simulation, 6-Day Strain Timeline & Shift Plan",
        list(GLOBAL_SITES.keys()),
        index=0,
        key="site_select",
    )
    if GLOBAL_SITES[selected_site_label] is None:
        c_lat, c_lon = st.columns(2)
        active_lat = c_lat.number_input("Custom Latitude", value=6.4402, min_value=-60.0, max_value=70.0, format="%.4f")
        active_lon = c_lon.number_input("Custom Longitude", value=4.0193, min_value=-180.0, max_value=180.0, format="%.4f")
        active_site_name = f"Custom Site ({active_lat:.2f}, {active_lon:.2f})"
    else:
        active_lat, active_lon = GLOBAL_SITES[selected_site_label]
        active_site_name = selected_site_label.split(" (")[0]

    try:
        active_current, active_solar = fetch_live_raw(active_lat, active_lon)
        st.session_state["last_good_active"] = (active_current, active_solar, active_site_name)
    except Exception:
        if "last_good_active" in st.session_state:
            active_current, active_solar, cached_name = st.session_state["last_good_active"]
            st.warning(f"⚠️ Live telemetry for {active_site_name} unavailable — showing last-good reading from {cached_name}.")
        else:
            st.error(f"Live telemetry for {active_site_name} is unavailable.")
            st.stop()

    spike = st.slider(
        "Simulate Extreme Heatwave Anomaly (+°C added to live telemetry)",
        0,
        10,
        0,
        1,
        key="spike_slider",
        help="Adds degrees to live and hourly temperatures at the active worksite.",
    )
    spiked_wbgt, spiked_tw, spiked_tg = estimate_wbgt(
        active_current["temperature_2m"] + spike,
        active_current["relative_humidity_2m"],
        active_solar,
        active_current["wind_speed_10m"],
    )

    s_col1, s_col2 = st.columns([1, 2])
    with s_col1:
        st.metric(
            f"{active_site_name} WBGT (with spike)",
            f"{spiked_wbgt:.1f} °C",
            f"+{spike} °C anomaly | Wet-Bulb: {spiked_tw:.1f}°C | Globe: {spiked_tg:.1f}°C",
        )
    with s_col2:
        niosh_lines = niosh_check(spiked_wbgt)
        chips_html = "".join(
            f'<div class="tg-niosh-chip {"tg-chip-ok" if "OK" in ln else "tg-chip-over"}">{ln.strip()}</div>'
            for ln in niosh_lines
        )
        st.markdown(
            f"""
            <div class="tg-glass-card">
                <div class="tg-kicker">NIOSH Work-Intensity Limits (Acclimatised, Continuous Work)</div>
                <div class="tg-niosh-grid">{chips_html}</div>
            </div>
            """,
            unsafe_allow_html=True,
        )

    iso_wbgt, iso_available = wbgt_iso_cross_check(
        spiked_tw, spiked_tg, active_current["temperature_2m"] + spike
    )
    if iso_available:
        delta = abs(iso_wbgt - spiked_wbgt)
        st.caption(f"WBGT cross-check — ThermiGraph estimate {spiked_wbgt:.1f} °C / ISO 7243 {iso_wbgt:.1f} °C (agreement within {delta:.2f} °C).")
    else:
        st.caption("ISO 7243 cross-check unavailable (pythermalcomfort not installed).")

    if spiked_wbgt > 28.0:
        st.error("CRITICAL: Spiked WBGT exceeds the 28.0 °C Moderate limit. Heavy and moderate continuous outdoor work must stop.")
    elif spiked_wbgt > 26.0:
        st.warning("HIGH STRAIN: Spiked WBGT exceeds the 26.0 °C Heavy work limit. Strict work-rest micro-rotations required.")

    return active_lat, active_lon, active_site_name, spike, spiked_wbgt


def render_s3_s4(active_lat, active_lon, active_site_name, spike):
    st.markdown('<div class="tg-kicker">Multi-Day Physiological Debt</div>', unsafe_allow_html=True)
    st.header(H("s3", f" ({active_site_name})"))
    try:
        hourly_active = fetch_hourly_raw(active_lat, active_lon)
        st.session_state["last_good_hourly"] = hourly_active
    except Exception:
        if "last_good_hourly" in st.session_state:
            hourly_active = st.session_state["last_good_hourly"]
            st.warning(f"⚠️ Hourly forecast for {active_site_name} unavailable — showing last-good 6-day window.")
        else:
            st.error(f"Hourly forecast for {active_site_name} is unavailable.")
            st.stop()

    chart_df, daily_df, total_strain, debt_days = compute_timeline_and_strain(hourly_active, spike)
    chart_df["time"] = pd.to_datetime(chart_df["time"])

    plotted = False
    try:
        import plotly.express as px

        fig = px.line(chart_df, x="time", y="WBGT estimate (C)", title="Hourly WBGT estimate, 6-day window")
        fig.update_traces(line=dict(color="#0284c7" if not is_dark else "#38bdf8", width=2.6))
        fig.add_hline(y=26.0, line_dash="dash", line_color="#f59e0b", annotation_text="Heavy limit 26 °C")
        fig.add_hline(y=28.0, line_dash="dash", line_color="#f43f5e", annotation_text="Moderate limit 28 °C")
        fig.update_layout(
            height=340,
            margin=dict(l=60, r=10, t=40, b=10),
            paper_bgcolor="rgba(0,0,0,0)",
            plot_bgcolor="rgba(0,0,0,0)",
            font=dict(color="#334155" if not is_dark else "#e2e8f0", family="Plus Jakarta Sans"),
        )
        st.plotly_chart(fig, use_container_width=True)
        plotted = True
    except Exception:
        pass
    if not plotted:
        st.line_chart(chart_df.set_index("time"))
    st.dataframe(daily_df, use_container_width=True)

    if total_strain >= 12:
        st.error(f"RED LINE CROSSED: 6-Day Cumulative Thermal Strain Index is {total_strain} (Threshold: 12). Multi-day thermal debt and failed overnight cooling indicate high risk of acute heat exhaustion and renal strain.")
    else:
        st.info(f"6-Day Cumulative Thermal Strain Index: {total_strain} / 12 (Below red-line collapse threshold at +{spike}°C spike). Increase the Heat Spike Simulator slider to observe multi-day thermal debt accumulation.")
    # Visual strain gauge: bar fills to the red line at 12 (scale 0-24 max)
    gauge_colour = "#f43f5e" if total_strain >= 12 else ("#f59e0b" if total_strain >= 8 else "#10b981")
    gauge_fill = min(total_strain / 24.0 * 100.0, 100.0)
    st.markdown(
        f"""
        <div style="margin: 0.6rem 0 0.2rem 0;">
            <div style="display: flex; justify-content: space-between; align-items: baseline;">
                <span style="font-size: 0.85rem; font-weight: 600; color: var(--text-secondary);">CUMULATIVE STRAIN</span>
                <span style="font-family: 'JetBrains Mono', monospace; font-size: 1.4rem; font-weight: 700; color: {gauge_colour};">{total_strain} / 12</span>
            </div>
            <div style="position: relative; height: 14px; border-radius: 999px; background: {"rgba(255,255,255,0.12)" if is_dark else "rgba(15,23,42,0.12)"}; margin-top: 4px;">
                <div style="width: {gauge_fill:.0f}%; height: 100%; border-radius: 999px; background: {gauge_colour}; transition: width 0.6s ease, background-color 0.6s ease;"></div>
                <div style="position: absolute; left: 50%; top: -4px; width: 3px; height: 22px; background: #f43f5e; border-radius: 2px;"></div>
            </div>
            <div style="display: flex; justify-content: space-between; font-family: 'JetBrains Mono', monospace; font-size: 0.75rem; color: var(--text-secondary); margin-top: 4px;">
                <span>0</span><span style="color: #f43f5e; font-weight: 600;">Red line 12</span><span>24 max</span>
            </div>
        </div>
        """,
        unsafe_allow_html=True,
    )
    st.caption("Cumulative Thermal Strain Index is an explainable prototype risk score (0–4 points/day from peak WBGT + Nocturnal Recovery Debt >28°C), not a clinical diagnosis.")

    st.markdown("<br>", unsafe_allow_html=True)
    st.markdown('<div class="tg-kicker">Dynamic Crew Rotation</div>', unsafe_allow_html=True)
    st.header(H("s4", f" ({active_site_name})"))
    tomorrow_date, shift_df, prevented_hrs, cooling_mins = compute_shift_schedule(hourly_active, spike)

    kpi1, kpi2, kpi3 = st.columns(3)
    kpi1.metric("Unsafe Heavy-Work Hours Prevented", f"{prevented_hrs} hrs / 12-hr shift", "Hours > 26.0 °C WBGT auto-restricted")
    kpi2.metric("Mandatory Cooling & Shade", f"{cooling_mins} mins", f"{round(cooling_mins / 60, 1)} hrs total recovery time")
    kpi3.metric("Active Nocturnal Debt Days (>28°C)", f"{debt_days} / 6 days", "Overnight recovery failure flag")

    st.markdown(f"**Projected Schedule for `{tomorrow_date}` (at +{spike}°C spike):** Heavy labour restricted to `06:00–10:00`. Crews anonymised (`Crew A`, `Crew B`).")
    st.dataframe(shift_df, use_container_width=True)
    return total_strain, debt_days, prevented_hrs, cooling_mins


def render_s5_s6(active_lat, active_lon, active_site_name, spike, spiked_wbgt, total_strain, debt_days, prevented_hrs, cooling_mins):
    st.markdown('<div class="tg-kicker">Structured Clinical Extraction</div>', unsafe_allow_html=True)
    st.header(H("s5"))
    selected_case = st.selectbox("Select Clinical Field Scenario Preset (or customize note below)", list(SCENARIO_PRESETS.keys()))
    note = st.text_area("Supervisor field note (EN/AR/HI — worker names auto-redacted)", SCENARIO_PRESETS[selected_case], height=110)

    if st.button("🚀 Run triage"):
        api_key = resolve_gemini_key()
        with st.spinner(f"Synthesizing field note with live {active_site_name} WBGT..."):
            result, engine_mode = run_field_triage(note=note, wbgt_c=spiked_wbgt, spike_c=spike, api_key=api_key)
            st.session_state["triage_result"] = result
            st.session_state["triage_engine"] = engine_mode

    if "triage_result" in st.session_state:
        result = st.session_state["triage_result"]
        engine_mode = st.session_state.get("triage_engine", "Structured Clinical Engine")
        st.caption(f"Active Triage Engine: `{engine_mode}`")
        st.table(
            pd.DataFrame(
                [
                    {"Field": "Worker (Anonymised)", "Value": result.worker_summary},
                    {"Field": "Symptom Severity", "Value": result.symptom_severity},
                    {"Field": "Extracted Symptoms", "Value": ", ".join(result.symptoms)},
                    {"Field": "Hydration & Sweating Status", "Value": result.hydration_status},
                    {"Field": "PPE / Equipment Friction", "Value": result.equipment_friction},
                    {"Field": "Occupational Risk Tier", "Value": result.osha_risk_tier},
                    {"Field": "Immediate Action Required", "Value": result.immediate_action},
                    {"Field": "Arabic Crew Broadcast (العربية)", "Value": result.arabic_crew_alert},
                    {"Field": "Hindi/Urdu Crew Broadcast", "Value": result.hindi_urdu_crew_alert},
                ]
            )
        )
        st.caption("Boundary: structured extraction for preventive occupational triage only — not a medical diagnosis. Names redacted at the crew level.")

    st.markdown("<br>", unsafe_allow_html=True)
    st.markdown('<div class="tg-kicker">Audit & Governance Trail</div>', unsafe_allow_html=True)
    st.header(H("s6"))

    # FIX #1 — full report content restored
    report_lines = [
        "ThermiGraph AI — Occupational Heat & Biometeorological Compliance Report (Prototype)",
        "=" * 80,
        "",
        "1. LIVE ZONE TELEMETRY (Abu Dhabi Host Pilot, Open-Meteo):",
    ]
    for name in ZONES:
        current, solar, wbgt, wet_bulb, globe = live[name]
        report_lines.append(
            f"  - {name}: {current['time']} | Air {current['temperature_2m']} C | "
            f"RH {current['relative_humidity_2m']}% | Wind {current['wind_speed_10m']} km/h | "
            f"Solar {solar} W/m2 | WBGT Est. {wbgt:.1f} C"
        )
    report_lines.extend(
        [
            "",
            f"2. ACTIVE WORKSITE: {active_site_name} ({active_lat:.4f}, {active_lon:.4f})",
            f"   HEAT SPIKE: +{spike} C anomaly -> Spiked WBGT {spiked_wbgt:.1f} C",
            "   NIOSH Acclimatised Continuous Work Thresholds:",
            *niosh_check(spiked_wbgt),
            "",
            f"3. 6-DAY CUMULATIVE THERMAL STRAIN INDEX: {total_strain} / 12 (Red-line threshold = 12)",
            f"   Active Nocturnal Recovery Debt Days (>28C): {debt_days} / 6 days",
            f"   Unsafe Heavy-Work Hours Prevented Tomorrow: {prevented_hrs} hrs | Cooling/Shade Scheduled: {cooling_mins} mins",
        ]
    )
    if "triage_result" in st.session_state:
        tr = st.session_state["triage_result"]
        report_lines.extend(
            [
                "",
                "4. LATEST ANONYMISED FIELD-LOG TRIAGE:",
                f"  - Worker Summary: {tr.worker_summary}",
                f"  - Severity / Risk Tier: {tr.symptom_severity} | {tr.osha_risk_tier}",
                f"  - Immediate Action: {tr.immediate_action}",
                f"  - Arabic Broadcast: {tr.arabic_crew_alert}",
                f"  - Hindi/Urdu Broadcast: {tr.hindi_urdu_crew_alert}",
            ]
        )
    report_lines.extend(
        [
            "",
            "5. SCOPE & CLINICAL DISCLOSURES:",
            "  - WBGT values are mathematical estimates (Stull wet-bulb + wind-adjusted solar globe), not calibrated physical globe thermometer readings.",
            "  - Triage outputs support preventive workplace safety, not clinical diagnosis.",
            "  - Worker logs are anonymised at crew level; outputs must never be used punitively.",
        ]
    )
    st.download_button(
        "⬇️ Download compliance report (.txt)",
        "\n".join(report_lines),
        file_name="thermigraph-compliance-report.txt",
    )


def render_s7_s8_s9(spike, spiked_wbgt):
    st.markdown('<div class="tg-kicker">Cross-Continental Benchmarking</div>', unsafe_allow_html=True)
    st.header(H("s7"))
    st.markdown("One table, four sentinel corridors, same physics and thresholds. This is the argument that ThermiGraph is global.")
    try:
        compare_hourly = {}
        compare_current = {}
        for site_name, (clat, clon) in COMPARE_SITES.items():
            compare_hourly[site_name] = fetch_hourly_raw(clat, clon)
            if site_name in live:
                compare_current[site_name] = live[site_name][2]
            else:
                # FIX #4 — compute real WBGT for non-cached sites, not raw temperature
                c_cur, c_sol = fetch_live_raw(clat, clon)
                c_wbgt, _, _ = estimate_wbgt(
                    c_cur["temperature_2m"],
                    c_cur["relative_humidity_2m"],
                    c_sol,
                    c_cur["wind_speed_10m"],
                )
                compare_current[site_name] = c_wbgt
        compare_df = compute_compare_sites(compare_hourly, spike, compare_current)
        st.dataframe(compare_df, use_container_width=True)
        st.caption("Current WBGT is the live reading; 6-day max and debt days use the same rolling window and thresholds as Section 3.")
    except Exception:
        st.warning("Compare-sites table unavailable (Open-Meteo unreachable for one or more sites).")

    st.markdown("<br>", unsafe_allow_html=True)
    st.markdown('<div class="tg-kicker">Health System & Employer Economics</div>', unsafe_allow_html=True)
    st.header(H("s8"))
    st.markdown("Pilot-scale estimates for the Abu Dhabi host corridor. All figures are planning estimates, clearly labelled.")
    imp1, imp2, imp3, imp4 = st.columns(4)
    imp1.metric("Workers currently protected", "4,500", "3 zones × 1,500 per zone (est.)")
    imp2.metric("Physical WBGT meters replaced", "450", "at $1,200 per unit (est.)")
    imp3.metric("Annual hardware savings (est.)", "$540,000", "no per-site hardware")
    imp4.metric("Heat-illness cases prevented / year", "~180", "ILO rate × exposure hours (est.)")
    st.caption("Estimates for planning only. Hardware cost = published price of a calibrated 150 mm black-globe WBGT meter; case rates follow ILO occupational heat-stress reporting.")

    st.markdown("<br>", unsafe_allow_html=True)
    st.markdown('<div class="tg-kicker">Interactive Actuarial Model</div>', unsafe_allow_html=True)
    st.header(H("s9"))
    co1, co2, co3 = st.columns(3)
    co_workers = co1.number_input("Exposed workers", min_value=10, max_value=100000, value=1500, step=100)
    co_days = co2.number_input("Exposure days", min_value=1, max_value=365, value=5, step=1)
    co_wbgt = co3.number_input("Site WBGT (°C)", min_value=20.0, max_value=45.0, value=float(round(spiked_wbgt, 1)), step=0.5)
    co_result = cost_of_inaction(int(co_workers), int(co_days), float(co_wbgt))
    co_a, co_b, co_c, co_d = st.columns(4)
    co_a.metric("Projected heat-exhaustion cases", f"{co_result['projected_cases']:.1f}", "without intervention (est.)")
    co_b.metric("Projected hospitalisations", f"{co_result['projected_hospitalisations']:.1f}", "~8% of cases (est.)")
    co_c.metric("Projected cost", f"${co_result['projected_cost_usd']:,.0f}", "productivity + care (est.)")
    co_d.metric("Prevented by ThermiGraph", f"{co_result['cases_prevented']:.1f} cases", f"${co_result['cost_prevented_usd']:,.0f} saved (est.)")
    # FIX #6 — illustrative label restored
    st.caption(
        "Illustrative model, not epidemiology: incidence 0.3 cases / 1,000 workers / day / °C above 26 °C heavy-work limit; "
        "8% hospitalise; $400 per case, $4,000 per hospitalisation; enforced rest cuts projected cases 65%. "
        "Real deployment would calibrate against site-specific HSE records and ILO/WHO regional baselines."
    )


def render_s10(active_site_name, spiked_wbgt):
    st.markdown('<div class="tg-kicker">Last-Mile Field Equity</div>', unsafe_allow_html=True)
    st.header(H("s10"))
    st.markdown("The same data, stripped for the worker holding the phone. One number, one action, one promise.")
    worker_status = "HOT — STOP HEAVY WORK" if spiked_wbgt > 28.0 else ("HIGH STRAIN — REST OFTEN" if spiked_wbgt > 26.0 else "OK — WORK NORMALLY")
    worker_colour = "#f43f5e" if spiked_wbgt > 28.0 else ("#f59e0b" if spiked_wbgt > 26.0 else "#10b981")
    st.markdown(
        f"""
        <div class="tg-phone-shell" style="border-color: {worker_colour};">
            <div class="tg-phone-notch"></div>
            <div style="font-size: 0.75rem; text-transform: uppercase; color: #94a3b8; margin-bottom: 4px;">Worker Mobile Alert</div>
            <div style="font-size: 1.55rem; font-weight: 800; color: {worker_colour};">{worker_status}</div>
            <div style="font-family: 'JetBrains Mono', monospace; font-size: 2rem; font-weight: 700; margin: 10px 0; color: var(--text-primary);">
                {active_site_name} — {spiked_wbgt:.1f} °C
            </div>
            <div style="font-size: 1.05rem; padding: 10px; border-radius: 12px; background: rgba(2,132,199,0.1); margin-bottom: 8px;">
                💧 <b>Drink 1 cup of ORS now, then rest in shade.</b>
            </div>
            <div style="font-size: 1.05rem; padding: 10px; border-radius: 12px; background: rgba(16, 185, 129, 0.1);">
                🛡️ <b>Reporting symptoms will not affect your pay.</b>
            </div>
        </div>
        """,
        unsafe_allow_html=True,
    )
    st.caption("Worker view is a mock: same live WBGT as the supervisor dashboard, reduced to one status, one action, and the non-punitive promise.")


# ---------------------------------------------------------------------------
# Layout renderer
# ---------------------------------------------------------------------------
if layout_mode == "Tabbed Command Center":
    t1, t2, t3, t4, t5 = st.tabs(
        ["🌍 1–2. Telemetry", "📈 3–4. Strain & Shift", "🤖 5–6. Triage & Audit", "🌐 7–9. Compare & ROI", "📱 10. Worker View"]
    )
    with t1:
        active_lat, active_lon, active_site_name, spike, spiked_wbgt = render_s1_s2()
    with t2:
        total_strain, debt_days, prevented_hrs, cooling_mins = render_s3_s4(active_lat, active_lon, active_site_name, spike)
    with t3:
        render_s5_s6(active_lat, active_lon, active_site_name, spike, spiked_wbgt, total_strain, debt_days, prevented_hrs, cooling_mins)
    with t4:
        render_s7_s8_s9(spike, spiked_wbgt)
    with t5:
        # FIX #2 — demo slider inside Tab 5 so the phone reacts live
        st.markdown('<div class="tg-kicker">Live Demo Control</div>', unsafe_allow_html=True)
        demo_spike = st.slider(
            "🎬 Demo slider — drag to watch the phone react",
            0, 10, int(spike), 1,
            help="Independent of Tab 1's slider. Drag to preview how the worker-facing alert changes at different heat spikes.",
        )
        try:
            demo_current, demo_solar = fetch_live_raw(active_lat, active_lon)
        except Exception:
            demo_current, demo_solar = st.session_state.get("last_good_active", ({"temperature_2m": 35.0, "relative_humidity_2m": 60.0, "wind_speed_10m": 10.0}, 600.0))[:2]
        demo_wbgt, _, _ = estimate_wbgt(
            demo_current["temperature_2m"] + demo_spike,
            demo_current["relative_humidity_2m"],
            demo_solar,
            demo_current["wind_speed_10m"],
        )
        render_s10(active_site_name, demo_wbgt)
else:
    active_lat, active_lon, active_site_name, spike, spiked_wbgt = render_s1_s2()
    st.markdown("---")
    total_strain, debt_days, prevented_hrs, cooling_mins = render_s3_s4(active_lat, active_lon, active_site_name, spike)
    st.markdown("---")
    render_s5_s6(active_lat, active_lon, active_site_name, spike, spiked_wbgt, total_strain, debt_days, prevented_hrs, cooling_mins)
    st.markdown("---")
    render_s7_s8_s9(spike, spiked_wbgt)
    st.markdown("---")
    render_s10(active_site_name, spiked_wbgt)

# ---------------------------------------------------------------------------
# Footer — sits below the tabs in tabbed mode, at the end in full-scroll mode
# ---------------------------------------------------------------------------
st.markdown("---")
st.caption(
    "ThermiGraph AI — Prototype for the Future Health Digital Innovation Challenge 2026. "
    "Live data: Open-Meteo. WBGT values are prototype estimates from weather telemetry, "
    "not calibrated on-site globe meter readings. Not a medical device."
)
