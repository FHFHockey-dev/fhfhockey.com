# Claude GS lane: goalie share official starts (offline slice)

- Scope: take over Codex goalie-share packet (CODEX-086, TRANSFER-MANIFEST goalie_share). Lease GS = 6 files only + tasks/artifacts/claude-lanes-2026-10-25/GS/. No Git, no live reads, no model activation.
- Where: /Users/tim/Code/fhfhockey.com, octoberBranch, lease base_head ac98431aa.
- Pins: all six SHA-256 matched the lease baselines at start (16:4x ET).
- Decision: slice = null-safe official starts per team game in the chart data layer (`gamesStarted` from the same NHL goalie/summary isGame rows the canonical writer reads). Withhold a team window's starts unless every team game has exactly one starter and every row has a 0/1 label. TJ pop-up answer: "Tooltip line" (pie stays appearance share).
- Out of lease (recorded, not touched): null-to-zero prior coercion lives in projections stages; trade/team binding in RSO bridge; calibration needs data.
- Implemented: `gamesStarted` on GoalieGameRow (optional) and GoalieData (number|null); tooltip "Starts: X of Y team games" / "Starts: Unavailable"; intro sentence. Tests: 4 data-layer cases (+6 withholding variants), 1 component tooltip case (Doughnut mock now captures options).
- Checks: GS/run-checks.sh (mkdir lock at /private/tmp/fhfh-heavy.lock, network blocked via offline.cjs, scoped tsconfig) — results in GS/*.log.
- Gotcha: lock is a directory with OWNER file; c3-cron-repro held it ~16:42Z.
- Checks done: vitest 47/47 (3 files), scoped tsc exit 0 (after a fixture type fix), eslint 0 errors / 2 pre-existing img warnings. Lock released.
- Handoff: GS/RECEIPT.md lists 4 changed paths + hashes; task-only.patch saved. No commit (orchestrator commits). workloadEvidence.* unchanged.
- Ticket 2 (after commit f951732dc): appearance count = one per unique row (explicit 0 only excluded); fixes null gamesPlayed undercount. 48 tests, scoped tsc and lint pass. GS/RECEIPT-2.md. Not committed.
- Ticket 3 (after 5660dcdd0): de-duplicated slice colours in index.tsx (PHI/TOR/PIT/OTT palettes repeat a colour). 49 tests, scoped tsc and lint pass. GS/RECEIPT-3.md. Not committed.
- Ticket 4: pins unchanged; no in-lease defect of real value left, so no edits (GS/RECEIPT-4.md lists the rejected candidates). GS lane can close.
- Next (outside lease): null-safe prior transport in projection stages, team/trade clocks, authoritative FORGE starter contract, calibration.
