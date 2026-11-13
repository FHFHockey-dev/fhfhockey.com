# Astra recheck: A3-01 and A3-02 (2026-11-13)

Astra's result, as relayed by TJ, for `ASTRA-RECHECK-A3-PROMPT.md` (prompt commit `2f0941fc7`). It was run read-only and offline at `5fbb2d3a2`: no production calls, rebuild reruns, repository edits or pushes.

**Both findings pass at `5fbb2d3a2`.**

- **A3-01: PASS** (`fe7b50c3a`).
  - All five checker self-tests passed, including rejection of the original false-pass fixture for all eight games.
  - All 24 saved responses replayed: the HTTP 200 receipts, required fields, GP 1 and exactly one subject row all reconcile with the expectations.
- **A3-02: PASS** (fixes through `f4c8cc701`).
  - 33 tests passed: 11 summary, 12 team, 10 PS.
  - Completed-game evidence is preserved.
  - Team diff failures stop with exit 6 or 2 before any snapshot or write, and leave the done file and the approved diff byte-identical.
  - The PS final check reads completed games without re-baselining or snapshotting them.

**Canary log:** `production/penalty-shot-rebuild-2026-11-13/run/summary-run.jsonl` line 2 is accessible. Its SHA-256 matches exactly: `4003ac05191993e492aadd9e16d1b1465d957966ebcf8db4332e894123386bd1`.

**Remaining historical gap:** the canary's original ES baseline is still lost.
- The other seven games' ES before/after snapshots match.
- The canary's ES-unchanged evidence remains the original recorded readback, `production/PRODUCTION-QUEUE.md` line 332.
