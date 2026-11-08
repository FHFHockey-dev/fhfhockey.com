# 2026-11-03 Claude — sKO model v3 bump

Scope: bump sustainability score model v2 -> v3 in code/tests/README; write (not run) DEPLOY-SQL.md.
Where: octoberBranch; web/lib/sustainability/{runtimeContract,config}.ts + tests; tasks/artifacts/sko-model-v3-2026-11-03/DEPLOY-SQL.md.

## Decisions
- Config hash MUST change: buildSustainabilityConfigIdentity hashes modelVersion. v3 = fnv1a_e11d5c91 (v2 recomputed = fnv1a_91691726, script check).
- Config revision 2 -> 3 (activate_sustainability_config RPC requires exact +1).
- Provenance version stays v2: it versions the source-cutoffs JSON shape (score.ts buildScoreSourceCutoffs), unchanged.
- Trend band version stays v2: bands.ts/bandCalculator.ts untouched by 3ec83cb0b/7a051dfc5; bands read player_stats_unified only.
- Historical migration test keeps v2 pins (asserts the 2026-07-25 migration file text).
- No new supabase migration file added (a db push would apply it); open question for TJ.

## Readers
- No reader filters sustainability_scores by model_version; latest snapshot_date wins. v2 rows for past dates remain in history.

## State
- (update below)
- Edits done: runtimeContract.ts (v3, fnv1a_e11d5c91), config.ts (seed revision 3; weights error message no longer says "v2"), 7 test files, web/README.md.
- DEPLOY-SQL.md written (RPC activate rev 3, rollback flip, order: after 11:35 UTC code first then SQL, before next 10:42).
- Tests: 215/219 pass; 4 handler tests (rebuild-priors x2, rebuild-window-z, rebuild-trend-bands) 503 from another lane's uncommitted lib/cron/withCronJobAudit.ts + sandbox-blocked audit insert. Stub via scratch setup file did not take effect (vi.mock outside root). Lint on changed files: exit 0.
- Gotcha: zsh does not word-split $FILES in sed; loop instead.
- Committed 7483f2921 (explicit pathspecs). Typecheck exit 2, errors only in other lanes (buyLowSellHigh currentProcessEvidence.server*, WigoComparisonMatrix.tsx, retainedBlsh.test.ts, plus WiGO/StatsTableRowChart.tsx).
- Next: TJ approves code deploy, then DEPLOY-SQL.md sections 1-3 in the same window (after 11:35 UTC, before 10:42 UTC). Keep this diary until the flip lands.
