# Bounded production repair — data repair not executed; schedules applied

## Scope

Target Supabase project `fyhftlxokyjtpndbkfse` (fhfhockey.com), season 20262027. Exactly 92 distinct games listed in `REPAIR-SCOPE.json`, spanning 30 dates from 2026-10-01 to 2026-11-11: 86 with overlapping intervals and six with pending relationships. This is an observed repair set, not an authorization for a season-wide or indefinite backfill. Recheck the six pending games at execution time and avoid unnecessary work if another authorized process has finished them.

Local code is uncommitted on the shared `octoberBranch`; it is not a release SHA. Assemble this exact diff into the normal accepted release candidate, preserving concurrent work. Before any approved deployment/push, confirm candidate SHA and target project/environment/branch, inventory every linked Vercel project's build trigger, and reuse an existing suitable build. No remote build has been requested. Dollar cost and build count across companion projects remain unverified until that release inventory; do not promise a one-build release.

## Current release and source gate

The local strength-clock repair and mathematical validation now pass (`MATH-AUDIT.md`). Deployment and historical writes are still unapproved. The 92 IDs above remain the original overlap/pending incident set, not the full strength-timing repair population. Enumerate old input/relationship generations before proposing that wider bounded repair.

`PREPARED-REPAIR-ROWS.json` contains five locally verified games, including complete official HTML source envelopes for 2026020009 and 2026020205. Their original JSON snapshots remain immutable. Fresh JSON fixes the older 0009 discrepancy but still disagrees for seven 0205 skaters; a JSON-only refresh is insufficient for that game. Publish the selected source through the existing raw-source/input transaction and bind relationships to the returned generation. Do not patch individual seconds, reuse an old manifest for a new source, or mark a simulation/fixture as a completed database write.

## Order and bounds

1. Deploy the approved interval-union/reader/version changes through the normal release workflow. No SQL schema change is required. Do not deploy only the relationship calculation while keeping the old strength producer.
2. For each listed game, read and pin the current stored PBP/shift snapshots, source hashes and manifest. Prepare corrected strength and relationship rows locally and compare with prior rows. Require identity, period, TOI, mirrored pair and source-version checks. Save before/after receipts; stop on drift or any new unexpected defect instead of silently expanding scope.
3. Rebuild input strength first using the v3 penalty-clock input materializer, then v5 relationships against its returned fingerprint/version. The existing source/RPC contracts must be used; never directly patch numeric TOI columns or label a pending generation complete. Prefer existing immutable snapshots to new NHL fetches when the raw heads and receipt guards permit it. Keep concurrency one and process at most eight games before reviewing receipts; cap the entire run at the 92 approved IDs.
4. Rebuild affected derived player/team/goalie rows for those exact games after their relationships finish. Use the existing `preparePlayerGameStrengthV2`, `prepareTeamGameStrengthV2`, `prepareGoalieGameV2` and `persistProjectionGameDerivedV1` contracts. Avoid indiscriminately invoking the date-wide endpoint: an affected date can include untouched v1/v3 games, which should not be silently swept into this repair. Exact-game execution tooling must be reviewed before the first write; the included offline replay is deliberately not a production writer.
5. **Completed with explicit user approval:** applied `PROPOSED-SCHEDULE.sql` on November 12, verified at 14:48:20 UTC (`CRON-APPLIED.json`); do not rerun the historical guarded SQL. The following describes the approved change: Keep input job 363 at 09:45 UTC; move relationship job 16 from 07:45 to 09:55; move derived job 305 from 09:50 to 10:05. At current Eastern standard time that is 4:45 → 4:55 → 5:05 a.m. Changes affect two existing schedules, retain all coverage/commands/authentication, and add no recurring invocations. Update the repository cron inventory only after observing successful application. Do not change the independent team-unit schedule.

For the stored-snapshot approach, the core repair requires at most three primary materialization transactions per game (276 across 92 IDs), plus bounded preflight/receipt reads. Exact prune/write counts depend on prepared manifests; current application caps are 100 strength rows and 1,000 PBP plays per game. Reuse unchanged raw snapshots; no NST calls are needed. A provider-refresh fallback, broad snapshot rebuild, additional downstream recompute, or retry beyond the approved IDs/batches needs a revised bound before execution. No exact execution-time or dollar estimate is established yet; historical seven-game relationship execution took about 11 seconds, which is evidence about that run only.

## Acceptance and stop conditions

- All repaired games have complete current input and relationship receipts bound to the same generation; expected/observed counts match. Derived receipts match those inputs after the downstream rebuild.
- No affected completed row has missing/invalid game clocks; player TOI is positive and at most game length; shared TOI is symmetric and at most both players' TOI; ES + PP + PK equals total TOI; canonical intervals do not overlap.
- Four demonstrated goalie corrections match captured NHL boxscores. Preserve any genuinely unresolved source disagreement rather than forcing a match.
- Verify actual cron order on the next scheduled cycle through run records. If a stage fails, report its failure and retain pending status; do not repeatedly invoke endpoints to poll progress.
- After database checks, an approved web smoke test may make at most five sequential read-only requests to the selected DRM/page path and existing cheap read paths, stopping once conclusive. Inspect behavior first; ingestion, refresh and cron routes are not smoke tests.
- Stop the first batch on unexpected source/version drift, wrong scope, failed invariant, failed CAS or materialization. Do not blindly retry a failed write. Raw snapshots are retained for diagnosis; rolling back application code must not incorrectly certify old totals under the new version.

Production execution is still gated by repository `AGENTS.md`: deployment, non-dry-run recomputes and schedule changes require explicit authorization. Exact release inventory and exact-game writer preparation remain pre-execution requirements; this plan does not claim they are already complete.
