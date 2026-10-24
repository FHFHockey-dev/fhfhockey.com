# Task10 R1 independent acceptance

**Accepted for the pinned combined local P07 R2 + task10 candidate. T10-C1 is closed.** Both prior failing mounted-UI assertions now pass. No new defect was reproduced in this narrow recheck. Browser, full FHFH tree and production qualification remain separate.

## Correction and evidence

The only production change adds `LOSSES_GOALIE` and `GAMES_STARTED` to `GOALIE_STATS` at `web/lib/rosterScheduleOptimizer/planning.ts:85`. The existing `applies` predicate now excludes these known goalie-only weights from skater totals. It does not change the fallback for unknown stats, missing applicable values, source admission or display math.

The original independent fixture is unchanged. A current approved skater game with `GOALS=1`, `ASSISTS=2`, weights `GOALS×3 + ASSISTS×2` plus either goalie-only weight now renders **7.0**, rather than an unavailable dash. Five other goalie-category controls also pass. The retained owner regressions reflect those same assertions; the correction does not weaken expectations.

Independent checks: **22 passed, zero failed**.

- 19 selected classification/UI cases: the two prior failures, five cross-class controls, missing applicable inputs, observed zeros, negative goalie values, unknown-stat rejection, and actual UI invalidation after rejected, replayed, revoked or expired refreshes.
- Three unchanged authority cases: serialized accepted output remains displayable but cannot authorize a restored execution without a fresh read; denied/mixed-basis contributions remain withheld; unchanged C08 rejects client-created manifest authority.
- The 46 unselected cases in the first command were excluded by an explicit test-name filter for this bounded recheck. No failed assertion was disabled. The owner's 248-test run was not duplicated or relabeled as independent evidence.

Exact commands and logs: `COMMANDS.md`, `classification.log`, `authority.log`. Confidence in closure: **high**.

## Snapshot proof

- Candidate: `tasks/artifacts/task10-display-2026-10-22/r1/CANDIDATE.json`.
- Observed branch/HEAD: `octoberBranch`, `b9f993b3522376805f82eeda1c84b7df39c7129f`. The handoff mentions an earlier observed HEAD; acceptance follows verified bytes, not that mutable Git context.
- Planner SHA-256: `d1300a64ac98d97765b9daff8017f3fe8341aa8757984ff176a177fc3a2674f2`.
- All **3,379 fixed files** verified before private test-config adjustment. All **39 combined candidate pins** match the tested and canonical files at the end boundary. Exactly three files differ from the prior review: planner, scorer tests and mounted-points tests; the other 36 are unchanged.
- All **eight P07 R2 delta pins** remain unchanged. Both independent reviewer fixtures are byte-identical to the prior review. `START-HASHES.json`, `FIXED-SNAPSHOT.json`, `END-HASHES.json` and `VERIFICATION.json` retain the proof. The sole difference from the owner's full fixed manifest is the execution-only Vitest cache path.

## Acceptance limits

This additive review closes the prior combined scoring hold and preserves the earlier P07 authority/expiry acceptance. It does not alter historical reports or native-target approvals.

No browser retry occurred. The previous Chromium MachPort permission denial remains the explicit independent-browser gate; existing owner screenshots are historical evidence only. Full application/worker browser execution and production behavior remain unqualified.

TypeScript, lint, broad planner/full-suite checks and deployment were not repeated for this two-key production correction. The owner's R1 scoped lint and 248-case receipts remain owner evidence; unrelated full-tree work is outside this snapshot. No application edits, services, network calls, credentials, migrations, commits, pushes, deployment or heavy-lock actions occurred. No current-turn action was denied, pending or uncertain.

The requested independent local recheck is complete. Preserve these exact source pins through any later combined release-candidate qualification.
