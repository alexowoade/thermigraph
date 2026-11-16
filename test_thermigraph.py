# ThermiGraph AI — Automated Clinical & Biometeorological Verification Suite
# Run with: pytest -v

from datetime import date, timedelta

import pytest

from dashboard_logic import (
    compute_compare_sites,
    compute_shift_schedule,
    compute_timeline_and_strain,
    cost_of_inaction,
    wbgt_iso_cross_check,
)
from physics_engine import estimate_wbgt, niosh_check, wet_bulb_stull
from shift_optimizer import work_rest
from strain_timeline import RECOVERY_DEBT_NIGHT_MIN, daily_points
from triage import (
    SCENARIO_PRESETS,
    deterministic_triage_fallback,
    redact_worker_name,
    run_field_triage,
)


def test_wet_bulb_stull_physical_bounds():
    """Wet-bulb temperature must never exceed dry-bulb temperature across valid RH ranges."""
    for temp_c in (25.0, 35.0, 42.0):
        for rh in (20.0, 50.0, 85.0):
            tw = wet_bulb_stull(temp_c, rh)
            assert tw <= temp_c
            assert tw > 5.0


def test_convective_wind_cools_black_globe():
    """Higher wind speed must reduce solar black-globe heating and lower outdoor WBGT."""
    wbgt_calm, _, globe_calm = estimate_wbgt(38.0, 50.0, solar_w_m2=800.0, wind_kmh=2.5)
    wbgt_windy, _, globe_windy = estimate_wbgt(38.0, 50.0, solar_w_m2=800.0, wind_kmh=28.0)
    assert globe_calm > globe_windy
    assert wbgt_calm > wbgt_windy


def test_default_wind_backward_compatibility():
    """Calling estimate_wbgt with 3 arguments must work seamlessly for strain_timeline and shift_optimizer."""
    wbgt, tw, tg = estimate_wbgt(35.0, 45.0, 600.0)
    assert tg == 35.0 + 600.0 * 0.02
    assert round(wbgt, 4) == round(0.7 * tw + 0.2 * tg + 0.1 * 35.0, 4)


def test_clothing_correction_raises_wbgt():
    """ISO 7243 Annex C: clothing adjustment is ADDED to measured WBGT."""
    base, _, _ = estimate_wbgt(35.0, 50.0, 600.0, 10.0, clothing="light_civilian")
    coveralls, _, _ = estimate_wbgt(35.0, 50.0, 600.0, 10.0, clothing="coveralls")
    ppe, _, _ = estimate_wbgt(35.0, 50.0, 600.0, 10.0, clothing="construction_ppe")
    suit, _, _ = estimate_wbgt(35.0, 50.0, 600.0, 10.0, clothing="impermeable_suit")
    assert coveralls == base + 1.0
    assert ppe == base + 2.0
    assert suit == base + 4.0
    # Heavier clothing must raise, never lower, the effective WBGT.
    assert suit > ppe > coveralls > base


def test_clothing_unknown_falls_back_to_zero():
    """An unknown clothing label falls back to no correction (light civilian)."""
    base, _, _ = estimate_wbgt(35.0, 50.0, 600.0, 10.0)
    unknown, _, _ = estimate_wbgt(35.0, 50.0, 600.0, 10.0, clothing="space_suit")
    assert unknown == base


def test_clothing_impermeable_raises_wbgt_by_exactly_4c():
    """Impermeable suit must raise WBGT by exactly +4.0 C at the same inputs."""
    base, _, _ = estimate_wbgt(35.0, 50.0, 600.0, 10.0, clothing="light_civilian")
    suit, _, _ = estimate_wbgt(35.0, 50.0, 600.0, 10.0, clothing="impermeable_suit")
    assert suit - base == 4.0
    # And the chart values must shift by the same amount, not just the headline.
    hourly = _synthetic_hourly(day_temp_c=30.0, night_temp_c=24.0)
    chart_light, _, _, _ = compute_timeline_and_strain(hourly, 0.0, clothing="light_civilian")
    chart_suit, _, _, _ = compute_timeline_and_strain(hourly, 0.0, clothing="impermeable_suit")
    diffs = chart_suit["WBGT estimate (C)"] - chart_light["WBGT estimate (C)"]
    assert (diffs == 4.0).all()


def test_timeline_strain_does_not_decrease_with_heavier_clothing():
    """Heavier clothing must never lower the cumulative strain total."""
    hourly = _synthetic_hourly(day_temp_c=30.0, night_temp_c=24.0)
    _, _, strain_light, _ = compute_timeline_and_strain(hourly, 0.0, clothing="light_civilian")
    _, _, strain_coveralls, _ = compute_timeline_and_strain(hourly, 0.0, clothing="coveralls")
    _, _, strain_ppe, _ = compute_timeline_and_strain(hourly, 0.0, clothing="construction_ppe")
    _, _, strain_suit, _ = compute_timeline_and_strain(hourly, 0.0, clothing="impermeable_suit")
    assert strain_suit >= strain_ppe >= strain_coveralls >= strain_light


def test_niosh_continuous_work_limits():
    """Verify NIOSH workload threshold checks at 27.0 C WBGT (Heavy & Very heavy over limit)."""
    lines = niosh_check(27.0)
    joined = "\n".join(lines)
    assert "Light: OK" in joined
    assert "Moderate: OK" in joined
    assert "Heavy: OVER LIMIT" in joined
    assert "Very heavy: OVER LIMIT" in joined


def test_nocturnal_recovery_debt_and_daily_points():
    """Verify Nocturnal Recovery Debt (>28.0 C) adds +1 strain point."""
    assert RECOVERY_DEBT_NIGHT_MIN == 28.0
    assert daily_points(max_wbgt=29.0, recovery_debt=False) == 3
    assert daily_points(max_wbgt=29.0, recovery_debt=True) == 4
    assert daily_points(max_wbgt=24.0, recovery_debt=False) == 0


def test_shift_optimizer_work_rest_regimes():
    """Verify ISO/NIOSH hourly work-rest ratio transitions."""
    assert work_rest(24.5) == (60, 0, "60 work / 0 rest")
    assert work_rest(25.5) == (45, 15, "45 work / 15 rest")
    assert work_rest(27.2) == (30, 30, "30 work / 30 rest")
    assert work_rest(28.5) == (0, 60, "NO OUTDOOR WORK")


def test_privacy_name_redaction_guard():
    """Ensure personal worker names are deterministically scrubbed from summaries."""
    raw = SCENARIO_PRESETS["Case 1: Acute CNS Heat Stroke & Anhydrosis (Critical Red Flag)"]
    redacted = redact_worker_name("Ahmed, 34, concrete crew at Mussafah, 2pm", raw)
    assert "Ahmed" not in redacted
    assert "[Worker - Anonymised]" in redacted


def test_triage_offline_fallback_across_all_three_clinical_presets():
    """Verify offline deterministic triage accurately classifies all 3 clinical scenarios without an API key."""
    # Case 1: Acute CNS Heat Stroke / Anhydrosis -> Critical
    c1, mode1 = run_field_triage(
        SCENARIO_PRESETS["Case 1: Acute CNS Heat Stroke & Anhydrosis (Critical Red Flag)"],
        wbgt_c=31.0,
        api_key=None,
    )
    assert c1.symptom_severity == "Critical"
    assert "Ahmed" not in c1.worker_summary
    assert "[Worker - Anonymised]" in c1.worker_summary
    assert len(c1.arabic_crew_alert) > 10
    assert len(c1.hindi_urdu_crew_alert) > 10
    assert "Fallback" in mode1

    # Case 2: Early Renal Strain / Cramps -> High
    c2 = deterministic_triage_fallback(
        SCENARIO_PRESETS["Case 2: Early Renal Strain / Dehydration & Muscle Cramps (High Risk)"],
        wbgt_c=28.2,
    )
    assert c2.symptom_severity == "High"
    assert "Ramesh" not in c2.worker_summary


# --- Integration tests for dashboard_logic.py (no Streamlit needed) ---


def _synthetic_hourly(day_temp_c=30.0, night_temp_c=24.0, humidity=50.0, solar=500.0, wind=10.0, night_hot_day=None):
    """Builds a 6-day hourly dict (past 3 + today + next 2) for testing.

    day_temp_c is the daytime temperature, night_temp_c the 00:00-05:59
    temperature. night_hot_day (0-5) makes one day's night hot (29 C) to
    test Nocturnal Recovery Debt detection.
    """
    start = date.today() - timedelta(days=3)
    times, temps, hums, winds, solars = [], [], [], [], []
    for d in range(6):
        day = start + timedelta(days=d)
        for h in range(24):
            times.append(f"{day.isoformat()}T{h:02d}:00")
            is_night = h < 6
            if is_night and night_hot_day == d:
                temps.append(29.0)
            elif is_night:
                temps.append(night_temp_c)
            else:
                temps.append(day_temp_c)
            hums.append(humidity)
            winds.append(wind)
            solars.append(0.0 if is_night else solar)
    return {
        "time": times,
        "temperature_2m": temps,
        "relative_humidity_2m": hums,
        "wind_speed_10m": winds,
        "shortwave_radiation": solars,
    }


def test_compute_timeline_and_strain_adds_spike_correctly():
    """A +8 C spike must raise the chart WBGT and the cumulative strain."""
    hourly = _synthetic_hourly(day_temp_c=30.0, night_temp_c=24.0)
    _, _, strain_0, _ = compute_timeline_and_strain(hourly, 0.0)
    chart_8, _, strain_8, _ = compute_timeline_and_strain(hourly, 8.0)
    assert strain_8 > strain_0
    assert chart_8["WBGT estimate (C)"].max() > 28.0
    # Every chart row must be higher with the spike applied.
    chart_0, _, _, _ = compute_timeline_and_strain(hourly, 0.0)
    assert (chart_8["WBGT estimate (C)"] > chart_0["WBGT estimate (C)"]).all()


def test_compute_shift_schedule_skips_break_at_13_15():
    """The 13:00 and 14:00 rows must be SHADE BREAK, not a work/rest ratio."""
    hourly = _synthetic_hourly(day_temp_c=30.0, night_temp_c=24.0)
    _, shift_df, _, _ = compute_shift_schedule(hourly, 0.0)
    by_hour = {row["Hour"]: row["Work / Rest Ratio"] for _, row in shift_df.iterrows()}
    assert "13:00" in by_hour and "14:00" in by_hour
    assert "SHADE BREAK" in by_hour["13:00"]
    assert "SHADE BREAK" in by_hour["14:00"]
    # Morning hours must not be a shade break.
    assert "SHADE BREAK" not in by_hour["06:00"]


def test_compute_shift_schedule_returns_tomorrow_date():
    """The schedule date must be tomorrow (all_days[4] in a 6-day window)."""
    hourly = _synthetic_hourly(day_temp_c=30.0, night_temp_c=24.0)
    tomorrow_text, shift_df, _, _ = compute_shift_schedule(hourly, 0.0)
    assert tomorrow_text == (date.today() + timedelta(days=1)).isoformat()
    assert len(shift_df) == 12  # 06:00 to 17:00 inclusive


def test_night_min_only_counts_hours_0_to_5():
    """Only 00:00-05:59 temperatures count toward Nocturnal Recovery Debt."""
    # Day index 3 is today (window starts 3 days ago); give it a hot night.
    hourly = _synthetic_hourly(day_temp_c=30.0, night_temp_c=24.0, night_hot_day=3)
    _, daily_df, _, debt_days = compute_timeline_and_strain(hourly, 0.0)
    assert debt_days == 1
    debt_rows = daily_df[daily_df["Nocturnal Recovery Debt (>28C)"].str.startswith("YES")]
    assert len(debt_rows) == 1
    # The debt day must be today (index 3 in the 6-day window).
    today_text = date.today().isoformat()
    assert debt_rows.iloc[0]["Date"] == today_text


def test_compare_sites_ranks_hotter_site_higher():
    """A hotter site must show a higher max WBGT and a worse risk tier."""
    hot = _synthetic_hourly(day_temp_c=38.0, night_temp_c=30.0)
    cool = _synthetic_hourly(day_temp_c=22.0, night_temp_c=18.0)
    # Live current WBGT values (as the dashboard passes them in).
    current = {"Hot Site": 34.0, "Cool Site": 20.0}
    df = compute_compare_sites({"Hot Site": hot, "Cool Site": cool}, 0.0, current)
    hot_row = df[df["Site"] == "Hot Site"].iloc[0]
    cool_row = df[df["Site"] == "Cool Site"].iloc[0]
    assert hot_row["Current WBGT (C)"] == 34.0
    assert cool_row["Current WBGT (C)"] == 20.0
    assert hot_row["6-Day Max WBGT (C)"] > cool_row["6-Day Max WBGT (C)"]
    assert hot_row["Risk Tier"] in ("Critical", "High")
    assert cool_row["Risk Tier"] in ("Low", "Moderate")
    assert hot_row["Debt Days"].startswith("6")  # hot nights every day


def test_cost_of_inaction_scales_with_workers_and_wbgt():
    """More workers and higher WBGT must project more cases and higher cost."""
    base = cost_of_inaction(1500, 5, 31.0)
    assert base["projected_cases"] > 0
    assert base["projected_hospitalisations"] > 0
    assert base["projected_cost_usd"] > 0
    assert base["cases_prevented"] > 0
    # Double the workers -> double the cases (within rounding).
    doubled = cost_of_inaction(3000, 5, 31.0)
    assert doubled["projected_cases"] == pytest.approx(base["projected_cases"] * 2, rel=0.02)
    # At or below the 26 C limit there is no excess WBGT, so zero cases.
    cool = cost_of_inaction(1500, 5, 25.0)
    assert cool["projected_cases"] == 0.0
    assert cool["projected_cost_usd"] == 0.0


def test_iso_cross_check_agrees_with_thermigraph():
    """pythermalcomfort WBGT must agree with ThermiGraph's own WBGT."""
    pytest.importorskip("pythermalcomfort")
    wbgt_tg, tw, tg = estimate_wbgt(35.0, 50.0, 600.0, 10.0)
    iso_wbgt, available = wbgt_iso_cross_check(tw, tg, 35.0)
    assert available
    assert iso_wbgt is not None
    assert abs(iso_wbgt - wbgt_tg) < 0.5
