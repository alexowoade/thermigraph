# ThermiGraph Module 3: triage.py
# Privacy-preserving clinical field-log triage with multilingual crew broadcasts
# and deterministic fallback so demos never fail offline or without an API key.

import os
import re
import sys
from pathlib import Path
from typing import cast

from dotenv import load_dotenv
from pydantic import BaseModel, Field

load_dotenv()
load_dotenv(Path.home() / "thermigraph" / ".env")

SAMPLE_LOG = (
    "Ahmed, 34, concrete crew Mussafah, 2pm. Says dizzy and headache "
    "since 11am, drank only 1 bottle of water all morning, helmet "
    "strap broken, vest torn, sweating stopped, supervisor says he "
    "vomited once, still on site."
)

SCENARIO_PRESETS = {
    "Case 1: Acute CNS Heat Stroke & Anhydrosis (Critical Red Flag)": SAMPLE_LOG,
    "Case 2: Early Renal Strain / Dehydration & Muscle Cramps (High Risk)": (
        "Ramesh, 41, rebar crew KEZAD Berth 3, 1:15pm. Reporting painful calf "
        "and abdominal muscle cramps, dark concentrated urine, and orthostatic "
        "lightheadedness. Portable shade tarp tore at 11:30am; water cooler 350m away."
    ),
    "Case 3: Multilingual Field Note (Arabic / Hindi-Urdu / English)": (
        "Bilal, 29, scaffolding crew Ruwais, 12:10pm. العامل يشعر بدوار شديد وصداع "
        "(worker feels severe dizziness and headache), tez dhoop mein kaam kar raha tha, "
        "water flask empty since 10am, cooling fan at rest tent not working."
    ),
}


class TriageResult(BaseModel):
    """Structured occupational triage row with multilingual field broadcasts."""

    worker_summary: str = Field(
        description="Anonymised one-line summary: replace any personal name with '[Worker - Anonymised]', plus age, crew, location, and time."
    )
    symptom_severity: str = Field(
        description="Low, Moderate, High, or Critical."
    )
    symptoms: list[str] = Field(description="Clinical symptoms extracted from the note.")
    hydration_status: str = Field(
        description="Hydration, urine markers, and sweating/anhydrosis status from the note."
    )
    equipment_friction: str = Field(
        description="Broken PPE, missing shade, or water access barriers reported."
    )
    osha_risk_tier: str = Field(
        description="Low, Medium, High, or Critical, with a short clinical/occupational reason."
    )
    immediate_action: str = Field(
        description="Single most urgent non-diagnostic triage and cooling action in plain words."
    )
    arabic_crew_alert: str = Field(
        description="Short actionable crew safety broadcast translated into Arabic."
    )
    hindi_urdu_crew_alert: str = Field(
        description="Short actionable crew safety broadcast in romanized Hindi/Urdu."
    )


def redact_worker_name(summary_text: str, raw_note: str = "") -> str:
    """Hard privacy guard ensuring personal names are always replaced with [Worker - Anonymised]."""
    cleaned = summary_text
    # Detect a leading name in the raw note (e.g. 'Ahmed, 34' or 'Ramesh, 41'),
    # or a name after a common field label (e.g. 'worker: Hassan' or 'name - Ali').
    for pattern in (
        r"^\s*([A-Z][a-zA-Z]{2,})\s*,",
        r"(?i)(?:worker|name|patient)\s*[:\-]\s*([A-Z][a-zA-Z]{2,})",
    ):
        m = re.search(pattern, raw_note)
        if m:
            cleaned = re.sub(
                rf"\b{re.escape(m.group(1))}\b",
                "[Worker - Anonymised]",
                cleaned,
                flags=re.IGNORECASE,
            )
    # Common-name list as a last line of defence (case-insensitive, so
    # ALL-CAPS names like MOHAMMED or ALI are caught too).
    for common_name in (
        "Ahmed",
        "Ramesh",
        "Bilal",
        "Mohammed",
        "Mohammad",
        "Ali",
        "Suresh",
        "Tariq",
        "Ravi",
        "Kumar",
        "Singh",
        "Hassan",
    ):
        cleaned = re.sub(
            rf"\b{common_name}\b", "[Worker - Anonymised]", cleaned, flags=re.IGNORECASE
        )
    if "[Worker - Anonymised]" not in cleaned:
        cleaned = f"[Worker - Anonymised] — {cleaned}"
    return cleaned


def deterministic_triage_fallback(note: str, wbgt_c: float = 28.5) -> TriageResult:
    """Rule-based clinical fallback parser guaranteeing 100% uptime without an API key."""
    lower = note.lower()

    # Extract age/location/time context without personal name.
    # Try the anchored "Name, age" pattern first (precise), fall back to the
    # first two-digit number. The anchored pattern is preferred because a
    # bare \b(\d{2})\b search can pick up a time (e.g. "11" in "11:30am")
    # if it ever appears before the age in a custom note.
    age_match = re.search(r"^\s*[A-Z][a-z]+\s*,\s*(\d{1,2})\b", note) or re.search(
        r"\b(\d{2})\b", note
    )
    age_str = f"Age {age_match.group(1)}" if age_match else "Adult worker"
    loc_str = "Global Site"
    for loc in ("Mussafah", "KEZAD", "Ruwais", "Lagos", "Delhi", "Houston"):
        if loc.lower() in lower:
            loc_str = loc
            break

    symptoms = []
    if any(k in lower for k in ("dizzy", "dizziness", "lightheaded", "دوار")):
        symptoms.append("Orthostatic dizziness / vertigo")
    if any(k in lower for k in ("headache", "صداع")):
        symptoms.append("Heat headache")
    if any(k in lower for k in ("sweating stopped", "no sweat", "anhydrosis", "dry skin")):
        symptoms.append("Anhydrosis (sweating stopped — red flag)")
    if any(k in lower for k in ("vomit", "vomited", "nausea")):
        symptoms.append("Vomiting / GI distress")
    if any(k in lower for k in ("cramp", "cramps")):
        symptoms.append("Heat muscle cramps (electrolyte depletion)")
    if any(k in lower for k in ("dark urine", "concentrated urine")):
        symptoms.append("Dark urine (early renal hypoperfusion / AKI warning)")
    if not symptoms:
        symptoms.append("General thermal fatigue under high ambient WBGT")

    red_flag = any(
        k in lower for k in ("sweating stopped", "vomited", "vomit", "faint", "collapse", "confus")
    )
    high_flag = any(
        k in lower for k in ("cramp", "dark urine", "dizzy", "dizziness", "دوار")
    )

    if red_flag or wbgt_c >= 30.0:
        severity = "Critical"
        tier = f"Critical — Acute heat-stroke red flags (anhydrosis/emesis) at {wbgt_c:.1f} C WBGT"
        action = (
            "STOP WORK IMMEDIATELY: Initiate rapid active cooling (ice packs to neck/axillae/groin, "
            "chilled water misting) and trigger urgent emergency medical evacuation."
        )
    elif high_flag or wbgt_c >= 27.5:
        severity = "High"
        tier = f"High — Symptomatic heat exhaustion / renal dehydration strain at {wbgt_c:.1f} C WBGT"
        action = (
            "Move worker to shaded cooling station immediately, administer 500 mL oral rehydration salts (ORS), "
            "and refer to on-site occupational clinic for vital-sign and renal hydration check."
        )
    else:
        severity = "Moderate"
        tier = f"Medium — Preventive thermal strain monitoring at {wbgt_c:.1f} C WBGT"
        action = "Enforce 30/30 shaded rest rotation and provide 250 mL electrolyte water every 20 minutes."

    if "sweating stopped" in lower:
        hydration = "Severe dehydration; drank only 1 bottle of water all morning and sweating has stopped (thermoregulatory failure)."
    elif "dark urine" in lower or "cramp" in lower:
        hydration = "Electrolyte and fluid deficit indicated by muscle cramps and dark concentrated urine."
    else:
        hydration = "Suboptimal morning water intake reported under elevated solar load."

    friction_items = []
    if "helmet" in lower or "vest" in lower:
        friction_items.append("damaged helmet strap / torn safety vest")
    if "shade" in lower or "tarp" in lower:
        friction_items.append("damaged portable shade canopy")
    if "350m" in lower or "400m" in lower or "empty" in lower:
        friction_items.append("water station distance / empty flask barrier")
    if "fan" in lower:
        friction_items.append("inoperative rest-tent cooling fan")
    friction = (
        "; ".join(friction_items).capitalize() + " increasing thermal and operational risk."
        if friction_items
        else "Standard field PPE; monitor radiant solar exposure."
    )

    return TriageResult(
        worker_summary=f"[Worker - Anonymised], {age_str}, {loc_str} industrial crew (Site WBGT: {wbgt_c:.1f} C)",
        symptom_severity=severity,
        symptoms=symptoms,
        hydration_status=hydration,
        equipment_friction=friction,
        osha_risk_tier=tier,
        immediate_action=action,
        arabic_crew_alert=(
            f"تنبيه السلامة الحرارية ({loc_str} - WBGT {wbgt_c:.1f}°C): "
            "توقف عن العمل الشاق فوراً، انتقل إلى منطقة الظل والتبريد، واشرب محلول الجفاف. الإبلاغ محمي بالكامل دون أي خصم."
        ),
        hindi_urdu_crew_alert=(
            f"Garmi Safety Alert ({loc_str} - WBGT {wbgt_c:.1f}°C): "
            "Turant chhaon (shade) mein aayein aur ORS paani piyein. Chakkar ya cramp hone par supervisor ko batayein—koi salary cut nahi hoga."
        ),
    )


def run_field_triage(
    note: str,
    wbgt_c: float = 28.5,
    spike_c: float = 0.0,
    api_key: str | None = None,
) -> tuple[TriageResult, str]:
    """Runs Gemini structured triage if key is available, else deterministic clinical fallback."""
    if not api_key:
        return (
            deterministic_triage_fallback(note, wbgt_c),
            "Deterministic Clinical Fallback Engine (Offline / No-Key Mode)",
        )

    try:
        from google import genai
        from google.genai import types

        client = genai.Client(api_key=api_key)
        prompt = (
            "You are an occupational heat-safety field triage assistant. "
            f"Current site WBGT estimate is {wbgt_c:.1f} C (with +{spike_c} C spike). "
            "Read this messy supervisor note (which may contain English, Arabic, or Hindi/Urdu phrases) "
            "and return only structured triage.\n"
            "PRIVACY RULE: Replace any personal worker name with '[Worker - Anonymised]' in worker_summary.\n"
            "CLINICAL BOUNDARY: Do not diagnose a disease; provide safe occupational triage routing, "
            "immediate supervisor actions, and concise Arabic and romanized Hindi/Urdu crew safety broadcasts.\n\n"
            f"Note: {note}"
        )
        for model_name in ("gemini-3.6-flash", "gemini-2.5-flash"):
            try:
                response = client.models.generate_content(
                    model=model_name,
                    contents=prompt,
                    config=types.GenerateContentConfig(
                        temperature=0.1,
                        response_mime_type="application/json",
                        response_schema=TriageResult,
                    ),
                )
                if response.parsed is None:
                    continue
                parsed = cast(TriageResult, response.parsed)
                parsed.worker_summary = redact_worker_name(parsed.worker_summary, note)
                return parsed, f"Gemini Structured GenAI ({model_name})"
            except Exception:
                continue
    except Exception:
        pass

    return (
        deterministic_triage_fallback(note, wbgt_c),
        "Deterministic Clinical Fallback Engine (API Fallback)",
    )


def main():
    api_key = os.environ.get("GEMINI_API_KEY")
    note = " ".join(sys.argv[1:]) if len(sys.argv) > 1 else SAMPLE_LOG
    result, engine_mode = run_field_triage(note, wbgt_c=29.2, spike_c=4.0, api_key=api_key)

    print(f"Field-log triage [{engine_mode}]")
    print(f"Note: {note}\n")
    print(f"Worker (Anonymised): {result.worker_summary}")
    print(f"Symptom Severity: {result.symptom_severity}")
    print(f"Symptoms: {', '.join(result.symptoms)}")
    print(f"Hydration: {result.hydration_status}")
    print(f"Equipment Friction: {result.equipment_friction}")
    print(f"OSHA Risk Tier: {result.osha_risk_tier}")
    print(f"Immediate Action Required: {result.immediate_action}")
    print(f"Arabic Broadcast: {result.arabic_crew_alert}")
    print(f"Hindi/Urdu Broadcast: {result.hindi_urdu_crew_alert}\n")
    print("Note: Preventive occupational triage only, not a medical diagnosis.")


if __name__ == "__main__":
    main()
