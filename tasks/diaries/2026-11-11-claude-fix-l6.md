# Diary: fix lane L6 (rolling player averages and trends), 2026-11-11

## Scope
Brief: tasks/artifacts/calculation-inventory-2026-11-10/master/fix-lanes/L6.md. Chef: local_78a99adf. Local edits only; rolling/FORGE runs held on nst_persistence_unconfirmed.

## Where
octoberBranch, sole checkout. Owned files per brief.

## Log
- Start: read _COMMON, L6 brief, digest, decisions 16/17/18/23/59/61/71/75/80, BA §W1-3, W2 §W2-4, W3 §W3-3/6/7.
- Claim: no Codex claim on L6 paths since 11-10 (last 60 lines of CODEX-TO-CLAUDE checked). Appended CLAUDE-FIX-L6-CLAIM-20261111.

## Next
Locate adapters/fallback (P0 #9).

## Blockers / approvals
None yet.
- P0 #9 (11-11 ~17:40): fixed in `web/lib/trends/playerTrendCalculator.ts`: playoff adapter keeps seconds, shots/ixG fallback = count×3600÷seconds, version → player-trend-v3-toi-seconds. Tests in playerTrendCalculator.test.ts: 6 fail on HEAD, 8/8 pass after (fixture TOI 20 → 1200 s, reason: source is seconds).
- Ticket to Chef: ownership of unowned `pages/api/v1/trends/{player-trends,skater-power,goalie-power}.ts` + tests (player-trends.test.ts pins the minutes defect; D10 percentiles live in skater/goalie-power). Pending.
- Producer (11-11 ~18:10): new `rollingRatioMetricSpecs.ts` (shared specs; xSH% scale 100; no-denominator → null for shooting_pct/primary_points_pct/ipp, D14), producer reads NST `iff`; xSH% = ixG ÷ iFF (decision 17); scale contract 0–100; season/3ya/career support pairs from paired ratio components (rule 13; cf/ff complements); cf/ff_pct and primary_points_pct no longer zero unknown sides. New `web/lib/rollingPlayerWindowCountSupport.ts`: versioned `windowCountSupport` in support payload (last5/10/20 appearance gameIds/dates + [num, den, obs] per ratio metric + per-game components for calendar windows). No new wide columns (unknown wide keys would break upserts). 3 producer tests fail on HEAD, pass after; 70/70.
- Gotcha: any new top-level output key that is not prunable (`_all`, `_last3`, `_3ya`, `_career`, `_avg_`) and not a real wide column would fail the upsert; route new data through the support payload.
- Unrelated: nhl*.test.ts failures in Upserts belong to L1's in-progress edits.
- Checkpoint 1 committed 6b2023387 (22 files). Reported to Chef; L5 contract in side-session-notes/<chef>/L6-window-count-contract.md. Typecheck: only L14 (lib/xg/aggregates.ts) + L1 (nhlNstParityMetrics.ts) errors. Page test (served reader) fails on HEAD, passes after.
- Next: D6 PP share denominator, D5 availability (decision 16), D10 (blocked on ownership ticket).
- 11-11 ~19:00: D6 consumer side (resolvePpShareComponents takes a team PP clock for every dressed game; producer passes null until L8's decision-71 clock exists → blocked on L8 for data). D5 availability rewritten to decision 16 (team-of-record slots by date, appearance-bounded stint proxy, incumbent starts at team's first game, regular season only via games.type, no clamp, unknown team → null scope). D10 mid-rank percentiles in skater/goalie-power (ownership granted in FIX-LANES.md). player-trends.test.ts updated to seconds. All new tests fail on HEAD. 46 files / 400 tests pass; eslint 0.
- Note for readers: season/3ya/career/lastN team_games_available and availability ratios can now be null (unknown team of record); counts of games played stay numbers.
- Checkpoint 2 committed f7ab9bca9 (14 files). Typecheck exit 0 (full repo). Readers of tests: 46 + 19 files pass. Production steps note: side-session-notes/<chef>/L6-production-steps.md.
- State: all brief findings fixed or blocked (D6 data source on L8). Follow-ups: HotColdCard top-4/bottom-4 overlap on small filtered lists (not in brief); pages/trendsDebug.tsx shows old xSH% formula text (unowned).
- Next: final report to Chef; lane done unless Chef returns findings.
- Follow-ups fixed in 522feb4db (HotColdCard exclusive sides; trendsDebug xSH% text). Typecheck exit 0. Final note sent to Chef. Lane done; keep diary until Chef records the rebuild steps.

## Reopens (11-11, after close)
- e00e2e9a7: oz_start_pct pair unknown when OZ or DZ is unknown (rule 5); test fails on HEAD.
- 51ab213f3: windowCountSupport.currentSeason (current-season-v1): truncated last5/10/20 with requested + actual n; seasonTotals.ratio (expected_sh_pct = Σ ixG, Σ iFF, matched games). Optional in the type so L5's fixture compiles; typecheck 0.
- Chef verified both; lane closed again. Diary stays until the rebuild steps are recorded.
