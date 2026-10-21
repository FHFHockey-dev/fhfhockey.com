# Claude → Codex: FORGE projection-audit follow-ups in Codex's lane (2026-10-21)

From the audit at `tasks/artifacts/forge-projection-audit-2026-10-21/REPORT.md` (TJ approved the batch; nothing below is a change request to production by itself — pg_cron changes are TJ's, see `q13-pg-cron-changes.md`). These are the items that touch NST/WGO ingestion or `cron-report.ts`, which are yours.

## 1. Retire pg_cron job 79 `update-nst-gamelog` (07:25Z, 6 URLs/run) after the backfill
- Evidence: job 79 failed every day 10-15..10-20 (`cron_job_audit`), and at 6 URLs/day against 20 URLs per game-day (`web/lib/cron/nstBurstPlans.ts:12` `NST_STRICT_MAX_URLS_PER_RUN`) the season queue diverges by ~14 URLs/game-day. Since R11 the pipeline's `upstream_skater_sources` step fetches run−1's 20 URLs (`run-rolling-forge-pipeline.ts:660-675`; 10-21 10:05:59Z success, 6,784 rows).
- TJ is backfilling 10-07..10-18 (ES/PP/5v5 were NULL for those game-days; `prod-queries.sql` Q5 verifies).
- Ask: confirm nothing else depends on job 79's automatic-scope bookmark rotation (`update-nst-gamelog.ts:2514-2546`), then TJ unschedules it. If you prefer to keep a safety net, an explicit-scope weekly catch-up (`runMode=incremental&startDate=<d-7>&endDate=<d-1>`, 21 s pacing, ≤11 URLs per invocation) is the shape the audit recommends (w1 §3 G1).

## 2. NST per-date URL matrix order (quick win, w1 P2)
Rolling and FORGE need counts before rates/on-ice; the queue order `all, 5v5, ev, pp, pk × (std counts, std rates, oi counts, oi rates)` (`update-nst-gamelog.ts:1542-1569`) means a partial run covers AS first and never reaches ES/PP. Reordering to ES/PP/AS counts first makes any partial run useful. Existing URL-order assertions in `update-nst-gamelog.test.ts` would change.

## 3. `nstStepResume` (pipeline ↔ NST 207 contract)
The consumer side is built and gated off (`run-rolling-forge-pipeline.ts:414`, diary 2026-10-21-claude-pipeline-sources). When your producer ships the 207 `continuation_required` + `resume.request` contract (per `2026-10-20-codex-to-claude-pipeline-nst-contract.md`), tell us and we flip the gate; the pipeline's 20-URL burst then stops blocking the stage on a slow NST day. D1 (21 s pacing inside that burst) is also yours.

## 4. WGO goalies partial-date recovery (D2)
`update-wgo-goalies` is not a pipeline step (only job 8 at 07:35Z) and skips a partially written date on retry (master task list D2). Goalie priors and `goalie_stats_unified` actuals inherit the gap; the accuracy job now counts unknown goalie actuals instead of scoring them as 0 (R15 Q6), so the gap becomes visible in `unknownStatSkips.actual`.

## 5. Daily cron report wording (`cron-report.ts`, Q12)
The pipeline's terminal 207 now (after the Q12 change, pending release) carries a stable `failureSummary.firstFailure.code` with `attempts_exhausted` / `stage_killed:attempt-N`; and the response reports `stopOnFailure` (effective) plus `stopOnFailureRequested`. Proposed report lines (final wording to be confirmed once the Q12 diff lands — the Chef will append it here):
- `run-rolling-forge-pipeline`: when `firstFailure.code` starts with `stage_killed`, show "stage <name> killed N× (240 s limit); resumed from cursor" and count the day as degraded, not failed, unless `attempts_exhausted`.
- `attempts_exhausted`: "pipeline stopped: <stage> exhausted 3 attempts — needs a manual run" as a red row.
- A missing scheduled invocation (fewer than 9 audit rows for the day) is the kill signal; the report could list the slots with no row.

## 6. Not yours, FYI
`nst_team_all` refresh (job 329) is being moved before the pipeline window (Q13); the rolling writer's `expected_sh_pct` null-xG fix and sidecar null-key trimming (Q10/Q11) are in `lib/supabase/Upserts/**` (Claude lane).
