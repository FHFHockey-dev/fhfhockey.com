# Ops health, cron accuracy and DB maintenance — 2026-10-17

Session scope: truthful cron reporting (A), current data health (B), database
optimization and security proposals (C). Production access was bounded and
read-only (`BEGIN READ ONLY; SET LOCAL statement_timeout='8s'`, LIMIT, no
EXPLAIN ANALYZE, no writes, DDL, grants, cron edits or function invocations).

Companion files:

- `production-plans.md` — one approval-ready plan per production operation.
- `evidence.md` — every dated observation with the query shape that produced it.
- `proposed-sql/` — SQL for the plans. Not migrations; only the P-B change has been executed.
- `live-cron-job-2026-10-17.json` — live `cron.job` id/name/schedule/active (no commands).

## Status vocabulary

| Term | Meaning here |
| --- | --- |
| code complete | Edited in the canonical checkout and passing the focused tests listed below |
| reviewed | Reviewed by someone other than the author. **Nothing is reviewed yet.** |
| deployed | On the Vercel production deployment. **Nothing from this session is deployed.** |
| executed | Run against production. **Only P-B (job 374 → `38 10 * * *` + CONCURRENTLY) was executed, 2026-10-17 ~21:20 UTC; read back 21:32 UTC. Recovery is not verified until 2026-10-18.** |
| live-verified | Observed working in production after deployment/execution. **Nothing yet.** |

## Prioritized issue register

Evidence class: **confirmed** (directly observed in production or code today),
**historical** (true earlier, not current), **hypothesis** (consistent with the
evidence but not proven), **unknown** (not determinable with the bounded reads).

| ID | Pri | Class | Issue | Owner / next step |
| --- | --- | --- | --- | --- |
| OPS-01 | P1 | confirmed | Sustainability score Vercel offsets 250/500 are skipped as `source_already_processed` after offset 0 writes; only 250 skaters were scored on 2026-10-12, -13, -14, -15 and -17 (all three ran only on 10-16, 642 players). Every run reports `success`. The skater list surface resolves the newest `snapshot_date`, so it shows ~250 players. | `web/lib/sustainability/incremental.ts` + `rebuild-score.ts` (outside this session's edit scope). Plan P-G. |
| OPS-02 | P1 | confirmed | 2026-10-17 `rebuild-sustainability-baselines` (job 326, 10:40) timed out reading `player_totals_unified` while job 374 ran a **non-concurrent** `REFRESH MATERIALIZED VIEW internal_stats.player_totals_unified` (10:41:00.58–10:41:11.44, 10.85 s vs 3–4 s on 10-12…10-16). The baseline run always lasts 68–71 s from ~10:40:01, so it straddles 10:41 daily; the PostgREST `authenticator` 8 s `statement_timeout` decides whether the lock wait fails. **Partial write**: 400 of ~968 baselines committed for 2026-10-17 (4 batches, last 10:40:53); window-z then covered 266 players and scores 250. | Local code patch done (truthful partial-write receipt). Production plan P-B (reschedule + CONCURRENTLY). Recovery plan P-C. |
| OPS-03 | P1 | confirmed | `update-shift-charts` failed 14/14 days (2026-10-04 → 10-17). Since 10-12: `Conflicting relationship position for player 8483678`. Root cause: two Vancouver players named Elias Pettersson (C and D); `shift-charts.ts` matches `yahoo_positions` by `full_name` only and takes the first (`427.p.7520`, C) for the D. The throw aborts the whole run. `shift_charts` holds 34 of 68 games played since 2026-10-07 (max 10-15). | `web/pages/api/v1/db/shift-charts.ts` (outside scope). Plan P-H. |
| OPS-04 | P1 | confirmed | `ingest-projection-inputs` fails daily with `INVALID_PROJECTION_RAW_SHIFT_ROWS` (duplicate raw interval) and is pinned at `resumeFromDate 2026-09-26` (0/14 games). Downstream `run-projection-v2` (weekly, 10:12) and `run-projection-accuracy` (11:30) fail preflight freshness daily. This is the "raw duplicates" candidate. | FORGE session. Do not touch before the 2026-10-20 07:00–13:00 ET run. |
| OPS-05 | P1 | confirmed | NST skater gamelog is falling behind: each scheduled run stops early after ~108 s, persists 6 URLs and defers the rest; deferred grew 334 → 354 → 374 (10-15 → 10-17). Freshness: `nst_gamelog_as_counts` max `date_scraped` 2026-10-13 (5 of 10 game dates since 10-07); `nst_gamelog_5v5_counts` and `nst_gamelog_pp_counts` none since 2026-10-02. Goalie gamelog is current (10-16). | NST owner. Plan P-I (keep ≥21 s spacing). |
| OPS-06 | P1 | confirmed | 2026-10-17 morning report warned "missing daily-cron-report": static inventory listed job 234 `active:true` at 21:15 while live `cron.job` 234 is inactive (last run 2026-10-15 21:15). Inventory is the only active/schedule/name drift against live. | **Code complete** (inventory + tests). Needs release (plan P-A). |
| OPS-07 | P2 | confirmed | `public.cron_job_audit` (175k rows, 306 MB) has **no indexes and no primary key**, and anon/authenticated can read every row (`Enable read access for all users`, `USING (true)`). Every report page and ad-hoc read is a full scan; any anon-key holder can read operational receipts and trigger 306 MB scans (bounded by anon 3 s timeout). | Plan P-D. |
| OPS-08 | P2 | confirmed | Live active pg_cron jobs 394 `player-forecasts-daily-seed`, 396 `player-forecasts-settlement` (hourly), 397 `player-forecasts-queue-drain` (*/5) are absent from the static inventory, so the report can never call them missing. | Plan P-J (inventory addition, needs a decision on SQL-wrapper receipts). |
| OPS-09 | P2 | confirmed | The daily report's expected-run set is pg_cron only (`cron-schedule.md`); the 27 Vercel crons in `web/vercel.json` (sustainability offsets, odds, forecasts, the report itself) are never "expected", so a stopped Vercel cron is invisible. `lib/cron/combinedCronInventory.ts` already parses both sources. | Follow-up design (not started). |
| OPS-10 | P2 | confirmed | `update-line-sources` failed 32 of 13,223 runs in 72 h (`Forecast schedule scope is incomplete or inconsistent`), at 00/14/15/21 UTC. `update-lines-ccc` had 1 timeout. Not traced further. | IFTTT/lines session owns `web/lib/sources/*`. |
| OPS-11 | P2 | confirmed | 101 public tables grant anon INSERT/UPDATE/DELETE with no anon write policy (RLS is the only barrier). All 395 public tables have RLS on; no permissive `true` write policy exists for anon/authenticated; 143 tables have RLS with no policy (service-role only). | Plan P-K (inventory first). |
| OPS-12 | P3 | confirmed | ~50 exact duplicate index groups, ~400 MB reclaimable (largest: `wgo_skater_stats` 97 MB; NST gamelog tables carry 2–3 identical unique/composite indexes each; `player_baselines` has `idx_baselines_player_date` duplicating its PK). Grouping ignored `indoption` (DESC), so a few are near-duplicates. | Plan P-E. |
| OPS-13 | P3 | confirmed | Postgres image `15.1.1.19` (server_version 15.1). Outstanding minor/security releases. | Plan P-F (do not start). |
| OPS-14 | P3 | confirmed | 194 of 496 FKs unindexed; only 3 on children >100k rows, most reference tiny static parents (`teams` 62 rows). Only `rolling_player_game_metrics(game_id)` (6.5 GB) might justify an index, pending workload evidence. | No bulk action recommended. |
| OPS-15 | P3 | hypothesis | Non-concurrent `REFRESH` of `internal_stats.player_stats_unified` (job 248, 07:50) and of `player_totals_unified` (374) briefly blocks every reader, including anon site traffic with a 3 s timeout. | Covered for 374 by P-B; 248 optional. |
| H-01 | — | historical | Yahoo partial coverage (2026-10-04, run 177006). Last three receipts (10-15…10-17) wrote 1,599–1,600 rows with no partial markers. | None. |
| H-02 | — | historical | Combined-reporting candidate `chef/cron-reporting-combined-20261004` (`da549b9ae2e2`, base `438fc5250d3b`): not an ancestor of HEAD and patch-ids differ, but every hunk is present in current code (exact query matching via `canonicalRoute`, Yahoo partial → UNKNOWN, ownership counts, export-skip reasons, entry-first route precedence, benchmark scope). Disposition 2026-10-12: `superseded_or_uncertain_alternative`. **Nothing cherry-picked.** The quoted patch SHA-256 prefix `e8d5e6368a5f…` was not reproduced by `git diff`, `--binary`, `--full-index` or `format-patch` (got `187a34cf…`, `a3cac823…`, `070e0e78…`). | None. |
| U-01 | — | unknown | Why the 10-17 refresh took 10.85 s (IO contention from the concurrent baseline reads is plausible). | Not needed for the fix. |
| U-02 | — | unknown | Why all three score offsets ran on 10-16 (10-16 rows apparently lacked a parseable `sourceCutoffs.observed`). | P-G author should check. |
| U-03 | — | unknown | The exact Vercel production deployment SHA. Inferred `master` = `457435eb3`, which carries the same stale inventory; not verified (no Vercel access used). | Confirm before P-A. |

Closed work preserved, not redone: RPC revocation on
`truncate_rolling_player_game_metrics` (read back: anon/authenticated EXECUTE
false), evening report job 234 stays inactive, 2026-10-15 schedule repair not
replayed.

## Local patches (code complete, not reviewed, not deployed)

| Path | Change |
| --- | --- |
| `tasks/TASKS/cron-operations/cron-schedule.md` | Job 234 `active:false`; dated 2026-10-17 reconciliation note; schedule-floor comments now name the Vercel 13:00 UTC cron as the sole daily report; historical SQL snippet labelled. |
| `web/lib/cron/combinedCronInventory.test.ts` | Active pg_cron count 56 → 55, total 83 → 82; asserts the only `/api/v1/db/cron-report` schedule is the Vercel `0 13 * * *` cron. |
| `web/__tests__/pages/api/v1/db/cron-report.test.ts` | New cases: disabled schedule excluded while an active expected job is still reported missing (it.each reproduces the incident with job 234 active and shows the fix); UTC slots across midnight and the report hour under `TZ=America/New_York`; identical inventory rows deduplicated while same-name schedules stay distinct; generated briefing with rejected/thrown email transport vs. generation failure before rendering; long plain-text diagnostics bounded to ≤300 chars keeping the leading cause; skipped score receipt (real 10-17 shape) and failed baseline kept out of success. Existing coverage already held exact query matching and Yahoo partial → UNKNOWN (lines 526–528). |
| `web/pages/api/v1/db/sustainability/rebuild-baselines.ts` | Counts committed upserts; success and dry-run responses add `rowsUpserted`; the 500 response adds `snapshot_date`, `processed`, `rowsUpserted`, `partialWrite`. The audit wrapper now records the committed count as `rows_affected` (previously always null). Query shape, batching, schedule and write semantics are unchanged. |
| `web/__tests__/pages/api/v1/db/sustainability/rebuild-baselines.test.ts` | In-memory Supabase mock (no network); a later-batch totals timeout reports 100 committed rows and `partialWrite:true`; success reports 150; dry run reports 0 and never upserts. |

`cron-report.ts` itself needed no change: inactive JSON entries were already
excluded; the defect was the inventory data.

Not changed on purpose: `select=*` on `player_totals_unified` (4,327 rows,
9 MB; `buildBaselinePayload` spreads totals rows and reads metric keys
dynamically, so narrowing is not provably safe and width is not the cause).

## Commands run (from `web/`)

| Command | Result |
| --- | --- |
| `npx vitest run lib/cron/combinedCronInventory.test.ts lib/cron/cronInventory.test.ts lib/cron/nstCoordination.test.ts __tests__/pages/api/v1/db/cron-report.test.ts` (after inventory edit, before test update) | 1 expected failure (56 → 55 active pg_cron), 106 passed |
| `npx vitest run __tests__/pages/api/v1/db/sustainability/rebuild-baselines.test.ts lib/cron/combinedCronInventory.test.ts` | passed, 45 tests |
| `npx vitest run __tests__/pages/api/v1/db/cron-report.test.ts` | passed, 63 tests |
| `npx eslint <the four changed .ts files>` | passed (exit 0) |
| `NODE_OPTIONS=--max-old-space-size=8192 npx tsc --noEmit` (single full run, whole tree including other sessions' in-progress edits) | passed (exit 0, no diagnostics) |

Not run: `npm run build`, `next dev`, E2E, any Vercel build or deployment.

## Notes for other sessions

- The inventory edit changes `tasks/TASKS/cron-operations/cron-schedule.md`,
  which `web/vercel.json`'s `ignoreCommand` treats as a web build trigger.
- OPS-03 (shift charts) and OPS-04 (projection inputs) feed the FORGE chain.
  Both predate this session and were left untouched.
