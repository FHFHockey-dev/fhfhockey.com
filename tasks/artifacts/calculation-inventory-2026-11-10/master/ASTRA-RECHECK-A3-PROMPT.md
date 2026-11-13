# Astra recheck: A3-01 and A3-02 only (2026-11-13)

You are **Astra**. This is a short, independent recheck of the two P2 findings from your addendum 3 (`master/astra/ASTRA-FIX-SPRINT-AUDIT-ADDENDUM-436-438-2026-11-13.md`). Don't reopen the full audit, and don't wait for tomorrow's cron checks.

**Pinned commit:** octoberBranch `5fbb2d3a2b9f4324d9df6d6358089908f9a8aa01` (local; not pushed or released, because these are operational artifacts, not application code).

**Ground rules:** read-only and offline. No production calls, reruns, edits, commits or pushes. Ask TJ any question by pop-up. Never print secrets. Never set GIT_DIR.

All paths are under `tasks/artifacts/calculation-inventory-2026-11-10/master/production/penalty-shot-rebuild-2026-11-13/`.

## 1. A3-01: strict landing checker
**Claim:**
- `verify-landing-strict.py` (`fe7b50c3a`) replaces `verify-landing.py`.
- `--selftest` rejects your original false-pass fixture (ES 999, goalie SA/SV/GA missing, goalie GP 999) for all 8 games. It also rejects duplicate rows, missing rows and non-200 responses.
- The TJ-approved live run returned ALL_OK with exactly 24 GETs.
- The saved responses are in `landing-verify-20261113T184529Z/` (24 bodies plus `result.json`).

**Verify:**
- The self-test rejects the false-pass fixture.
- The 24 saved responses reconcile with the stored expectations: shooter all-strengths and ES rows, goalie row, GP 1, each player exactly once.
- For the canary 2026020065, cite the original run log for its pre-refresh totals: `run/summary-run.jsonl` line 2, sha256 `4003ac05191993e492aadd9e16d1b1465d957966ebcf8db4332e894123386bd1`. That file is gitignored and on disk only; ask TJ if you can't reach it.
- Don't treat that log as a surviving ES baseline. It has no ES row, and the canary's before snapshot was overwritten. The ES-unchanged evidence is the 7 non-canary before/after snapshots; for the canary there is only the original readback in `PRODUCTION-QUEUE.md`.
- Records: `18e3ec7b4`.

## 2. A3-02: runners never overwrite evidence on resume
**Claim:**
- F15 commits: `f3b411463`, `9cc43a0b6`, `6d24ba51e`, `bfeabb283`, `f4c8cc701`.
- Runners: `summary-refresh.py`, `team-refresh.py`, `ps-rebuild.py`.
- Tests: `test_summary_refresh.py`, `test_team_refresh.py`, `test_ps_rebuild.py`. The Chef reran them: 33 passed.

**Verify:**
- All three runners preserve the completed game's original snapshot on resume and snapshot only pending games. The resume tests use one completed and one pending game. The PS runner's final read-only totals check reads the completed game but must not baseline or snapshot it.
- Team runner, execute path (`ResumeExecutePath` in `test_team_refresh.py`):
  - it diffs only pending games, against the original `team-diff-approved.json`;
  - a changed diff stops (exit 6) before any write or snapshot;
  - a per-game diff response that doesn't confirm a dry run with zero writes stops (exit 2) before any write or snapshot: dryRun missing or false, rowsUpserted ≠ 0, or truncated;
  - in both cases the done file and the approved diff stay byte-identical.

## Output
Return:
- pass or fail per finding, with the commit, the tests you ran and their counts, and any remaining gap;
- your summary handed to TJ, or written to `master/astra/ASTRA-RECHECK-A3-2026-11-13.md`.

Keep tomorrow's 10:05Z (FORGE reserve rows) and 10:15Z (cron 283 power v4) checks separate.
