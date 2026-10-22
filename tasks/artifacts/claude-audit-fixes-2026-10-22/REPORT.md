# A1–A4 / A6 local fix handoff

Fourteen application/test files are changed locally on `octoberBranch`, base HEAD `a811b0762ffe29006c3df7eaa4c19bf18deecda3`. The owned canonical files match the tested snapshot. No commit, push, branch/worktree change, dependency change, migration, production request, external-model call, or deployment occurred. Existing dirty work was preserved. Parent retains A5/A10 and A7–A9; this task dispatched no workers.

## Implemented behavior

- **A1:** `fetchLatestSkaterContextProfiles` selects dates strictly before the target slate. Tests cover extreme target-day values, prior zeros, missing history, capture/replay, and rejection of an old inclusive capture signature. Stage and reconstruction callers use the slate date, so the shared query now enforces the intended boundary.
- **A2:** exact-game admission runs independently of the latest line's completeness. A complete current-game line survives a newer missing-assists line, with its original source and values; no next-game forecast is fabricated.
- **A3:** absent actuals remain unknown unless an explicit final, complete receipt covers that game, team and player class. Known actual rows settle individually; missing weighted heads remain null. Revalidation clears unsupported prior settlement fields and later actual arrival recovers them. The live route has no authoritative completeness receipt and supplies none. It therefore cannot infer DNP from unrelated rows.
- **A4:** building the snapshot now produces an independent identified-player universe, including debutants with no forecast/history. Pure scoring accepts this separate settled universe: two dressed players/one forecast gives 0.5; duplicates across sources do not enlarge it; a known empty denominator differs from unknown. With no persisted universe, the scoreboard returns null coverage/dressed denominator and an explicit unavailable status. Per-source errors are labeled unpaired samples. **Durable coverage remains held**, as explained below.
- **A6:** a completed partial invocation stores `stage_handoff` through the existing resumable failed-state transition; it consumes zero failed attempts. Expired running leases are classified independently of checkpoint timing. Each killed owner gets one deterministic companion receipt in `projection_pipeline_state`; repeated/concurrent observers and an interrupted recorder cannot increment the same death twice. Legacy aggregate counts remain included. No generic lease RPC or canonical ingestion recovery guarantees were changed.

## Verification actually run

All execution used Node **22.11.0**, npm, a source-only `/tmp` snapshot, synthetic `.invalid` configuration, blocked sockets/HTTP(S), and blocked unmocked fetch. No local env files or credentials were copied. Commands and receipts are in [VERIFY.md](VERIFY.md) and `evidence/`.

| Check | Result |
|---|---|
| Original temporal + edge reproductions | 7 failed before fixes, as expected; includes A5/A7 owned by parent workers |
| Temporal/bridge/candidate/reconstruction batch, 6 files | 296 passed |
| Ledger/snapshot/settle/scoreboard + pipeline initial batch | 64 passed, 6 failed; all 4 ledger/route suites passed; pipeline handoff assertions/zero-attempt consumer corrected |
| Pipeline + query final retest, 2 files | 156 passed: pipeline 49, queries 107 |
| Fixed-contract A2/A3/A4/A6 edge assertions | 4 passed; 2 unrelated cases skipped by test filter |
| TypeScript, `npx --no-install tsc --noEmit --incremental false`, 8 GiB heap | Passed, exit 0 |
| ESLint over all 14 owned files | Passed, exit 0, no warnings/errors |
| Scoped `git diff --check` | Passed |

Reusing unaffected successful receipts, the final owned candidate has **366 passing existing-suite cases plus 5 passing synthetic assertions**. This is not a full suite, production validation, model qualification, or release approval.

The preserved queue's original reproductions were not edited. The snapshot-only temporal mock gained `lt` support. The snapshot-only A4 reproduction now supplies the independently built/settled universe to `scoreLedger`; the numerical oracle remains 2 dressed / 1 covered / 0.5. Calling the old two-argument API intentionally yields unknown coverage, because the old inputs do not contain the missing player. These adaptations are included in the fixed archive for independent inspection.

## Remaining gates — do not mark release-ready

1. **A1 historical validity:** the hydration verdict used current-database reconstructions of earlier slates, predates the final combined candidate, and does not establish input availability at historical decision time. An old inclusive query capture no longer matches the corrected query signature. This task did not relabel or refilter historical captures to invent a corrected result. No exact final combined-candidate capture satisfying the corrected evidence contract was supplied here. Its model/cohort requalification is pending; date exclusion also does not prove historical data vintage.
2. **A3 finality/completeness:** a future trusted receipt must identify game, team, player class, final status, complete ingestion, and provenance. Row presence/counts are insufficient. The code supports such evidence offline but no producer/storage integration is implemented or assumed. Historical ledger zeros outside the existing three-day replay window remain unaudited. Any actual cleanup/recompute requires separately authorized bounded operational work.
3. **A4 storage — held, not applied:** persist the independent snapshot membership and a complete-snapshot receipt keyed by served date/game, separately from prediction source rows. Preserve the actual participation evidence/provenance and page/count completeness. Read this universe into both daily and pooled scoring; never reconstruct a historical denominator from current rosters or emitted forecasts. The existing ledger source constraint has no universe source. No source label was overloaded, no migration file was added, and no schema/data call ran. Until an approved storage contract is implemented, API coverage must remain unavailable. The optional SQL scoreboard view is unchanged and is not qualified for coverage.
4. **A6 rollout/concurrency:** fixtures exercise the existing revision/owner lease protocol, including races and interrupted accounting; no real database concurrency or killed-process execution was run. New owner-keyed receipts reuse the current table/RPC without schema changes (one small row per observed dead owner, bounded by the stage retry cap). Old short handoffs and legacy aggregate counters have no owner history; deploy only with a reviewed quiescent/new-run transition, not a mixed-version takeover. Do not claim historical aggregate entries have been retroactively deduplicated.
5. Parent must independently review the exact owned snapshot, reconcile A5/A10 and A7–A9, and pin the combined candidate. This archive deliberately retains those other packets at the baseline rather than silently importing concurrent changes.

## Review deliverables

- [CHANGED-FILES.json](CHANGED-FILES.json): exact 14-file inventory with pre-edit and fixed SHA-256 hashes.
- [owned-fixes.patch](owned-fixes.patch): patch against the actual pre-edit dirty snapshot, not a guessed clean release tree.
- [FIXED-SNAPSHOT.json](FIXED-SNAPSHOT.json): every archived source/reproduction hash, base SHA, Node version, and archive hash.
- [fixed-source.tar.gz](fixed-source.tar.gz): reproducible 3,357-file source snapshot, no dependencies, env files or credentials.
- Source tree used for checks: `/tmp/fhfh-queue-check-ah_xhhr5/isolation/snapshot/web`.

Direct checkpoint notification through the local Codex thread API targeted parent `01a15411-3560-7632-8d31-1dd2447ba00e` and returned `thread not found`; it did not deliver and was not retried. Commentary/artifacts were maintained, and this final handoff uses the platform's automatic parent notification. No safety/approval denial occurred.

## Accepted adjacent packet added to integration inventory

Parent subsequently accepted A5/A10 for local integration following [independent review](../claude-audit-independent-review-2026-10-22/a5-a10-yahoo/REVIEW.md). All seven reviewed source/dependency hashes were checked again and still match; no packet source or review artifact was edited. The accepted changes are `web/lib/integrations/yahoo/rosterPlanning.ts` and its test. Independent evidence is 138 suite cases plus the original A5 assertion (139 unique assertions). Absent-player DNP semantics remain excluded.

[INTEGRATION-INVENTORY.json](INTEGRATION-INVENTORY.json) now records 16 changed files across this task's packet and accepted A5/A10, with five Yahoo dependency fences. It is an integration inventory, not a combined tested snapshot or release approval. The original fixed archive remains unchanged; A7–A9 and final combined-candidate pinning remain parent-owned. No application checks were rerun for this metadata-only update.
