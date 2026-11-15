# ThermiGraph dashboard logic: dashboard_logic.py
# Pure business logic for the Streamlit dashboard, kept free of Streamlit
# imports so it can be unit-tested with plain pytest (no Streamlit needed).
#
# Functions:
# - compute_timeline_and_strain: Module 2, 6-day strain timeline + chart data.
# - compute_shift_schedule: Module 4, tomorrow shift plan + prevention KPIs.
# - compute_compare_sites: Global compare-sites table (all worksites side by side).
# - cost_of_inaction: Transparent cost-of-inaction estimator (labelled estimate).
# - wbgt_iso_cross_check: Optional ISO 7243 cross-check via pythermalcomfort.

from collections import defaultdict
from datetime import date, timedelta

import pandas as pd

from physics_engine import estimate_wbgt
from shift_optimizer import work_rest
from strain_timeline import RECOVERY_DEBT_NIGHT_MIN, daily_points


def compute_timeline_and_strain(hourly: dict, spike_c: float):
    """Computes hourly WBGT chart data and Module 2 daily cumulative strain table."""
    chart_rows = []
    by_day = defaultdict(list)
    winds = hourly.get("wind_speed_10m", [10.0] * len(hourly["time"]))

    for i, time_text in enumerate(hourly["time"]):
        day = time_text[:10]
        by_day[day].append(i)
        temp_spiked = hourly["temperature_2m"][i] + spike_c
        wbgt, _, _ = estimate_wbgt(
            temp_spiked,
            hourly["relative_humidity_2m"][i],
            hourly["shortwave_radiation"][i],
            winds[i],
        )
        chart_rows.append({"time": time_text, "WBGT estimate (C)": round(wbgt, 2)})

    daily_rows = []
    cumulative = 0
    debt_days_count = 0
    for day in sorted(by_day):
        indexes = by_day[day]
        temps = [hourly["temperature_2m"][i] + spike_c for i in indexes]
        max_wbgt = 0.0
        hours_over_heavy = 0
        night_temps = []

        for i in indexes:
            hour = int(hourly["time"][i][11:13])
            temp_c = hourly["temperature_2m"][i] + spike_c
            humidity = hourly["relative_humidity_2m"][i]
            solar = hourly["shortwave_radiation"][i]
            wbgt, _, _ = estimate_wbgt(temp_c, humidity, solar, winds[i])
            if wbgt > max_wbgt:
                max_wbgt = wbgt
            if wbgt > 26.0:
                hours_over_heavy += 1
            if hour < 6:
                night_temps.append(temp_c)

        night_min = min(night_temps) if night_temps else min(temps)
        recovery_debt = night_min > RECOVERY_DEBT_NIGHT_MIN
        if recovery_debt:
            debt_days_count += 1
        points = daily_points(max_wbgt, recovery_debt)
        cumulative += points

        daily_rows.append(
            {
                "Date": day,
                "Max Temp (C)": round(max(temps), 1),
                "Night Min (C)": round(night_min, 1),
                "Max WBGT Est. (C)": round(max_wbgt, 1),
                "Hours > Heavy Limit (26C)": hours_over_heavy,
                "Nocturnal Recovery Debt (>28C)": "YES (+1 pt)" if recovery_debt else "No",
                "Daily Strain Points": points,
                "Cumulative Strain Index": cumulative,
            }
        )

    return pd.DataFrame(chart_rows), pd.DataFrame(daily_rows), cumulative, debt_days_count


def compute_shift_schedule(hourly: dict, spike_c: float):
    """Computes Module 4 tomorrow shift schedule (06:00 to 17:00) and prevention KPIs."""
    all_days = sorted({t[:10] for t in hourly["time"]})
    tomorrow_text = all_days[4] if len(all_days) > 4 else (date.today() + timedelta(days=1)).isoformat()
    winds = hourly.get("wind_speed_10m", [10.0] * len(hourly["time"]))
    schedule_rows = []
    unsafe_heavy_hours_prevented = 0
    total_cooling_rest_minutes = 0

    for i, time_text in enumerate(hourly["time"]):
        day = time_text[:10]
        hour = int(time_text[11:13])
        if day != tomorrow_text or hour < 6 or hour > 17:
            continue

        temp_c = hourly["temperature_2m"][i] + spike_c
        humidity = hourly["relative_humidity_2m"][i]
        solar = hourly["shortwave_radiation"][i]
        wbgt, _, _ = estimate_wbgt(temp_c, humidity, solar, winds[i])

        if wbgt > 26.0:
            unsafe_heavy_hours_prevented += 1

        if 13 <= hour < 15:
            protocol = "SHADE BREAK (No outdoor work)"
            crew = "All Crews — Mandatory Shaded Rest"
            total_cooling_rest_minutes += 60
        else:
            _, rest_mins, protocol = work_rest(wbgt)
            total_cooling_rest_minutes += rest_mins
            if wbgt > 28.0:
                crew = "All Crews — Work Suspended (Over Limit)"
            elif hour < 10:
                crew = "Crew A (Heavy Labour Window)"
            elif hour < 12:
                crew = "Crew A (Light Work Only)"
            else:
                crew = "Crew B (Afternoon Light Rotation)"

        schedule_rows.append(
            {
                "Hour": f"{hour:02d}:00",
                "Projected Temp (C)": round(temp_c, 1),
                "Projected WBGT (C)": round(wbgt, 1),
                "Work / Rest Ratio": protocol,
                "Anonymised Crew Assignment": crew,
            }
        )
    return (
        tomorrow_text,
        pd.DataFrame(schedule_rows),
        unsafe_heavy_hours_prevented,
        total_cooling_rest_minutes,
    )


def compute_compare_sites(site_hourly: dict, spike_c: float = 0.0, site_current_wbgt: dict | None = None):
    """Builds the global compare-sites table from each site's hourly forecast.

    site_hourly maps a site display name to its Open-Meteo hourly dict.
    site_current_wbgt maps a site display name to its LIVE current WBGT
    (from fetch_live_raw). The live value is required for a correct
    "Current WBGT" column: the hourly forecast's last hour is two days in
    the future, so using it as "current" would show a future night value
    instead of the live reading.
    Returns a DataFrame with one row per site: current WBGT, 6-day max WBGT,
    nocturnal debt days, and a risk tier. All values use the same physics
    and thresholds as the main dashboard, so the table agrees with it.
    """
    rows = []
    for site_name, hourly in site_hourly.items():
        winds = hourly.get("wind_speed_10m", [10.0] * len(hourly["time"]))
        max_wbgt = 0.0
        debt_days = 0
        by_day = defaultdict(list)
        for i, time_text in enumerate(hourly["time"]):
            by_day[time_text[:10]].append(i)
        # Current WBGT: use the live reading passed in by the dashboard.
        # Fall back to the middle of the window (approximately now) only if
        # no live value was supplied.
        if site_current_wbgt and site_name in site_current_wbgt:
            current_wbgt = site_current_wbgt[site_name]
        else:
            mid = len(hourly["time"]) // 2
            current_wbgt, _, _ = estimate_wbgt(
                hourly["temperature_2m"][mid] + spike_c,
                hourly["relative_humidity_2m"][mid],
                hourly["shortwave_radiation"][mid],
                winds[mid],
            )
        for day, indexes in sorted(by_day.items()):
            night_temps = []
            for i in indexes:
                hour = int(hourly["time"][i][11:13])
                temp_c = hourly["temperature_2m"][i] + spike_c
                wbgt, _, _ = estimate_wbgt(
                    temp_c,
                    hourly["relative_humidity_2m"][i],
                    hourly["shortwave_radiation"][i],
                    winds[i],
                )
                if wbgt > max_wbgt:
                    max_wbgt = wbgt
                if hour < 6:
                    night_temps.append(temp_c)
            if night_temps and min(night_temps) > RECOVERY_DEBT_NIGHT_MIN:
                debt_days += 1
        if max_wbgt > 28.0:
            tier = "Critical"
        elif max_wbgt > 26.0:
            tier = "High"
        elif max_wbgt > 25.0:
            tier = "Moderate"
        else:
            tier = "Low"
        rows.append(
            {
                "Site": site_name,
                "Current WBGT (C)": round(current_wbgt, 1),
                "6-Day Max WBGT (C)": round(max_wbgt, 1),
                "Debt Days": f"{debt_days} / 6",
                "Risk Tier": tier,
            }
        )
    return pd.DataFrame(rows)


def cost_of_inaction(workers: int, days: int, wbgt_c: float):
    """Transparent cost-of-inaction estimator.

    Model (clearly labelled as an estimate, not epidemiology):
    - Excess WBGT above the 26 C heavy-work limit drives heat-exhaustion
      incidence at 0.3 cases per 1,000 workers per day per degree of excess.
      At 31 C WBGT, 1,500 workers, 5 days this gives about 11 cases,
      matching the order of magnitude in ILO heat-stress reporting.
    - About 8% of heat-exhaustion cases escalate to hospitalisation.
    - Cost: $400 per heat-exhaustion case (lost productivity + clinic visit),
      $4,000 per hospitalisation (emergency care + lost days).
    - ThermiGraph's enforced rest schedule is assumed to cut projected
      cases by 65% (rest breaks + shade + early triage).
    Returns a dict with the projected cases, hospitalisations, cost, and
    cases/cost prevented. All numbers are estimates for planning only.
    """
    excess = max(0.0, wbgt_c - 26.0)
    daily_rate_per_1000 = 0.3 * excess
    cases = daily_rate_per_1000 * (workers / 1000.0) * days
    hospitalisations = cases * 0.08
    cost = cases * 400.0 + hospitalisations * 4000.0
    cases_prevented = cases * 0.65
    cost_prevented = cost * 0.65
    return {
        "excess_wbgt_c": round(excess, 1),
        "projected_cases": round(cases, 1),
        "projected_hospitalisations": round(hospitalisations, 1),
        "projected_cost_usd": round(cost, 0),
        "cases_prevented": round(cases_prevented, 1),
        "cost_prevented_usd": round(cost_prevented, 0),
    }


def wbgt_iso_cross_check(twb_c: float, tg_c: float, tdb_c: float):
    """Cross-checks ThermiGraph WBGT against pythermalcomfort (ISO 7243).

    pythermalcomfort's wbgt() implements the same ISO 7243 weighted sum
    (0.7 Twb + 0.2 Tg + 0.1 Tdb) from the same wet-bulb and globe inputs,
    so agreement confirms the final combination follows the standard.
    Returns (iso_wbgt_or_None, available_bool). If pythermalcomfort is not
    installed, returns (None, False) and the caller shows a graceful note.
    """
    try:
        from pythermalcomfort.models import wbgt as pt_wbgt

        # with_solar_load=True selects the outdoor ISO 7243 formula
        # (0.7 Twb + 0.2 Tg + 0.1 Tdb). The default indoor form drops the
        # dry-bulb term and would disagree by ~1 C.
        result = pt_wbgt(twb=twb_c, tg=tg_c, tdb=tdb_c, with_solar_load=True)
        # pythermalcomfort returns a WBGT object or a float depending on version.
        value = float(result.wbgt) if hasattr(result, "wbgt") else float(result)
        return value, True
    except Exception:
        return None, False
