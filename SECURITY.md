# Security Policy

## Reporting a vulnerability

If you find a security vulnerability in ThermiGraph, please report it
privately. Do not open a public GitHub issue for a vulnerability.

- Email: [your email]
- Replace `[your email]` with a real contact address before publishing.
  No email address is invented here.
- Include: what you found, where (file and line if you can), steps to
  reproduce, and what you think the impact is. Screenshots are welcome;
  do not include real personal data or a real API key in your report.

**Acknowledgement: within 72 hours.** We will acknowledge your report
within 72 hours and tell you what happens next (fix, mitigation, or
why it is not a vulnerability). If you do not hear back within 72
hours, please send a follow-up to the same address.

Please do not publicly disclose a vulnerability until a fix is
available or 90 days have passed since your report, whichever is
sooner.

## Scope

In scope:

- The Python code in this repo (`dashboard.py`, `dashboard_logic.py`,
  `physics_engine.py`, `strain_timeline.py`, `shift_optimizer.py`,
  `triage.py`, `fetch_mussafah.py`).
- The Streamlit dashboard and the hosted demo.
- **Secrets handling, in particular: `GEMINI_API_KEY` must never be
  committed.** The key lives in a local `.env` file (see `.env.example`)
  or in Streamlit secrets, and `.env` is git-ignored. If you find a key
  in the repo, in an issue, or in a screenshot, report it as a
  vulnerability so it can be revoked.
- Privacy: name redaction (`redact_worker_name()` in `triage.py`) and
  the no-persistent-storage rule in `docs/data-governance.md`. A bypass
  that exposes a real worker name in the dashboard output is in scope.

Out of scope:

- **Rate limiting and denial of service.** The hosted demo is a small
  prototype with no rate limiting; flooding it, or Open-Meteo, or the
  Gemini API, is out of scope. Please do not test DoS against the
  live demo.
- Vulnerabilities in third-party services (Open-Meteo, Google Gemini,
  Streamlit Community Cloud, Netlify, GitHub) - report those to the
  relevant provider.
- Social engineering, phishing, or physical security.
- Findings that require a real API key, real worker data, or access to
  a private deployment to reproduce. This repo contains no real
  personal data; do not introduce any while testing.

## What we will not do with your report

We will not use a report to identify or penalise a worker. Reports
about the redaction or anonymisation logic are about the code, not
about any person.
