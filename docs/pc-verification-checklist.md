# ThermiGraph — PC verification checklist (90 minutes)

Run these on the PC in `~/thermigraph`, venv at `~/thermigraph/venv`.
Do NOT run `git add .` — it stages venv and other untracked files.
Stage only the named files, check `git status` before and after.

## 1. Tests (5 min)

```
cd ~/thermigraph
~/thermigraph/venv/bin/python -m pytest -v
```

Expected: test_thermigraph.py 17 passed, test_validation.py 9 passed, total 26 passed.
If the count differs, update README and Devpost to the actual number.
Do not report a number you have not seen print on your own machine.

## 2. Ruff (10 min)

```
~/thermigraph/venv/bin/python -m ruff check .
```

Fixed already in this workspace, with the corrections:
- B905 dashboard.py:507 — `zip(cols, ZONES, strict=True)`
- B007 dashboard_logic.py:176 — unused `day` renamed to `_day`
- E402 test_thermigraph.py:118/120/122 — mid-file imports moved to the top
- I001 test_thermigraph.py:4 — import grouping fixed (stdlib, blank, pytest, blank, local)

Verified in the VM 2026-11-16: `ruff check ~/workspace/thermigraph/` — `All checks passed!`
Still re-run on the PC venv, it is the authoritative run.
If ruff is not installed in the venv: `~/thermigraph/venv/bin/pip install ruff`

## 3. Mypy (15 min)

```
~/thermigraph/venv/bin/python -m mypy physics_engine.py strain_timeline.py shift_optimizer.py triage.py dashboard_logic.py
```

Fixed already in this workspace, with the corrections:
- triage.py:250 — `response.parsed is None` check, then `cast(TriageResult, response.parsed)`
- dashboard_logic.py:256 — pythermalcomfort import marked `# type: ignore[import-untyped]`, plus `mypy.ini` with `ignore_missing_imports = True`
- physics_engine.py:44 — `wet_bulb_stull` return wrapped in `float(...)`, mypy flagged it as returning Any under `warn_return_any`

Verified in the VM 2026-11-16: `mypy physics_engine.py strain_timeline.py shift_optimizer.py triage.py dashboard_logic.py` — `Success: no issues found in 5 source files`
Still re-run on the PC venv, it is the authoritative run.
If mypy is not installed: `~/thermigraph/venv/bin/pip install mypy`
Do not use `# type: ignore` without a comment explaining why.

## 4. Lighthouse via PageSpeed Insights (15 min, browser only)

1. Deploy v16 first, then open https://pagespeed.web.dev/
2. Paste https://chipper-halva-04403d.netlify.app/
3. Click Analyze, screenshot the Accessibility score circle
4. Save as `docs/lighthouse.png`
5. Add to README near the top:
   `Lighthouse accessibility score: [XX]/100 (measured via PageSpeed Insights, 2026-11-16).`
6. If score is below 90, fix contrast / alt text / aria-labels first, then re-run.
   Note: light theme `--text-2` is already #334155 in v15/v16. The #94a3b8 value is the dark theme, on a dark background, not on white.

## 5. Mobile 375px (30 min, Chrome DevTools on PC)

1. Open the Netlify URL in Chrome
2. F12, Ctrl+Shift+M, select "iPhone SE"
3. Walk all sections top to bottom, screenshot anything broken
4. Take 3 mobile screenshots: hero, map, worker view
5. Upload to Devpost gallery as mobile_hero.jpg, mobile_map.jpg, mobile_worker.jpg
6. Also test on a real phone against the live Netlify URL. DevTools emulates, it is not perfect.

## 6. Arabic re-scope (5 min, done in README)

README now has a Language support section: page chrome, navigation, hero, and
crew broadcasts are bilingual English/Arabic with RTL flip. Body copy, tables,
chart labels, and the worker view remain in English. Full Arabic body
translation is Future work. Use that wording in Devpost, not "Full Arabic UI".

## 7. Liljegren note (5 min, done)

`liljegren-note.md` now has a "Why this wasn't shipped" paragraph.
`thermofeel` and `pywbgt` are listed as not yet verified. Do not install them
on that claim alone. A correct implementation is 4-8 hours, listed as Future work.

## 8. Commit and push (5 min, safe staging only)

```
cd ~/thermigraph
git status
git add README.md liljegren-note.md mypy.ini docs/pc-verification-checklist.md physics_engine.py test_thermigraph.py test_validation.py triage.py dashboard.py dashboard_logic.py
git status
git commit -m "Verification pass: ruff, mypy, lighthouse, mobile, honest limits"
git push
```

Check `git status` again after staging. If venv, __pycache__, or .env appear
staged, unstage them before committing. Never run `git add .`
