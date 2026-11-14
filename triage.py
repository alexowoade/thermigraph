# ThermiGraph Module 3: triage.py
# Field-log triage, typed text only in v1.
# Gemini reads a messy supervisor note and returns a structured
# triage table. No voice notes in v1.
#
# The Gemini key is loaded from ~/spectocart/.env, the same key
# used for SpecToCart. The key is never printed and never copied
# into this file. One Gemini call per run.

import os
import sys
from pathlib import Path

from dotenv import load_dotenv
from google import genai
from google.genai import types
from pydantic import BaseModel, Field

# Load the key from the SpecToCart .env file, if it is there.
load_dotenv(Path.home() / "spectocart" / ".env")
# Also allow a ThermiGraph .env file, if the user makes one later.
load_dotenv(Path.home() / "thermigraph" / ".env")

SAMPLE_LOG = (
    "Ahmed, 34, concrete crew Mussafah, 2pm. Says dizzy and headache "
    "since 11am, drank only 1 bottle of water all morning, helmet "
    "strap broken, vest torn, sweating stopped, supervisor says he "
    "vomited once, still on site."
)


class TriageResult(BaseModel):
    """One structured triage row, from one messy field note."""

    worker_summary: str = Field(description="One line: who, where, when.")
    symptom_severity: str = Field(
        description="Low, Moderate, High, or Critical."
    )
    symptoms: list[str] = Field(description="Symptoms found in the note.")
    hydration_status: str = Field(
        description="What the note says about drinking water and sweating."
    )
    equipment_friction: str = Field(
        description="Broken or missing kit, and how it adds risk."
    )
    osha_risk_tier: str = Field(
        description="Low, Medium, High, or Critical, with a short reason."
    )
    immediate_action: str = Field(
        description="The single most urgent action, in plain words."
    )


def main():
    api_key = os.environ.get("GEMINI_API_KEY")
    if not api_key:
        print("GEMINI_API_KEY is not set. Triage needs a Gemini key.")
        print("The key is in ~/spectocart/.env, check it with a yes/no test only.")
        sys.exit(1)

    # Use the sample note, or a note passed on the command line.
    if len(sys.argv) > 1:
        note = " ".join(sys.argv[1:])
    else:
        note = SAMPLE_LOG

    client = genai.Client(api_key=api_key)

    prompt = (
        "You are a field triage assistant for outdoor workers in heat. "
        "Read this messy supervisor note and return only structured triage. "
        "Do not diagnose a disease, do not invent facts that are not in the note. "
        "If a fact is missing, say so in that field.\n\n"
        f"Note: {note}"
    )

    response = client.models.generate_content(
        model="gemini-3.6-flash",
        contents=prompt,
        config=types.GenerateContentConfig(
            response_mime_type="application/json",
            response_schema=TriageResult,
        ),
    )

    result = response.parsed
    print("Field-log triage")
    print(f"Note: {note}")
    print()
    print(f"Worker: {result.worker_summary}")
    print(f"Symptom Severity: {result.symptom_severity}")
    print(f"Symptoms: {', '.join(result.symptoms)}")
    print(f"Hydration: {result.hydration_status}")
    print(f"Equipment Friction: {result.equipment_friction}")
    print(f"OSHA Risk Tier: {result.osha_risk_tier}")
    print(f"Immediate Action Required: {result.immediate_action}")
    print()
    print("Note: Gemini extraction from a typed note, not a medical diagnosis.")


if __name__ == "__main__":
    main()
