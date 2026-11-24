# Entity sustainability producer (team + goalie) — diary

## Scope
Producer for `entity_sustainability_scores_daily` + `entity_sustainability_bands_daily` (team, goalie) so /trendsSandbox
shows a genuine form reading for all 32 teams on every season date (off days carry the team's rolling window, as-of the date).
Dry-run only. No prod writes, cron, migration, deploy or commit without TJ OK. Started from session local_f610a5bf.

## Where
Branch octoberBranch (shared checkout). Owned files (new): web/lib/sustainability/entityProducer*.ts,
web/pages/api/v1/sustainability/rebuild-entity-scores.ts, web/scripts/dry-run-entity-sustainability.ts.
Not touching trendsSandbox.tsx, sandbox.module.scss, trendsSandbox.test.tsx, vars.scss.

## Trace confirmed (2026-11-23)
- No writer in repo or git history (`git log -S` only shows the reader commit a156da58b and baselines). No cron in web/vercel.json.
  PRD three-pillars 7.3 is ticked but nothing writes the unified tables. Both tables 0 rows.
- Inputs (DB, no NST calls): nst_team_gamelogs_as_counts season 20262027 per-game rows (gp=1) 2026-09-29..11-22, 32 teams,
  abbreviations = teamsInfo keys. wgo_goalie_stats 20262027 per game (filter date >= season start: 2 junk June rows), 78 goalies;
  every in-season appearance has a nst_gamelog_goalie_all_counts row (xg_against) and a players FK.
- seasons.20262027 startDate 2026-09-29 (regular season, 84 games).
- Windows the page offers: l3, l5, l10, l20.

## Gotchas
- 20252026 nst team rows have gp up to 82 (cumulative rows mixed in) — producer reads current season only.
- Reader resolveUnifiedSnapshotDate falls back to the latest snapshot when none <= requested date (borrows another date) — follow-up, not this lane.

## State (2026-11-23 11:40)
- Implemented (uncommitted): entityProducer.ts, entityProducerData.ts (read-only), entityProducerWrite.ts (only writer),
  entityProducerReport.ts, route rebuild-entity-sustainability.ts (dry by default, <=62 dates, not scheduled),
  scripts/dry-run-entity-sustainability.ts; reader tweak in entitySurfaceServer.ts (comparisons skip carried-forward rows).
- Checks: entityProducer.test.ts 13 pass; route test 4 pass; entitySurfaceServer.test.ts 15 pass; lib/sustainability 215 pass;
  npm run typecheck exit 0; eslint on touched files exit 0.
- Dry run (DB reads only, no writes) through 2026-11-22: 32/32 teams all windows on 11-22 (22 off-day incl NJD), 78/78 goalies,
  0 row-check problems; z SD ~1; states ~16/67/17. Hand-over + JSON in the shared notes folder.

## Decisions
- Score scale 0.4 (team) / 0.6 (goalie) from dry-run SDs; goalie saves + SA/60 use league residual spread (Poisson over-dispersed, SD 1.3-1.6).
- Expectation state = results vs process (team GF% vs xGF%; goalie sv% vs xG-expected sv%), |z|>=1.

## Update 2026-11-23 (after advisor review)
- Reader fixes in entitySurfaceServer.ts (unified path): comparisons skip carried-forward rows; histories take newest N
  (old ascending+limit would freeze charts ~2027-03-08); no forward fallback (NJD 2026-09-29 showed 11-22 reading).
- Schedule gate uses lib/games/gameFinality (PPD/CNCL dropped); end capped at today (US Eastern).
- Goalie GAA/SA60/saves: Poisson x league over-dispersion (league-residual mixed window lengths: saves z SD 1.16->0.68).
- Real rows read back through the reader via scratch script (outside repo): EDM 11-22 l5 found, 6 bands, 55-day histories.
- Checks: sustainability suites 44 files pass except cron-audit-wrappers (2 fails from another session's vercel.json entry);
  typecheck 0; lint 0.

## Next
TJ sign-off on formula; then approved backfill (dryRun=false) and cron/release. Follow-up: reader falls back to a later snapshot when none <= requested date.

## TJ decisions 2026-11-23 (pop-up)
- Goalie save%/QS% in percent; goalie readings stop after 30 idle days; keep labelled league-prior baseline.
- Applied + verified: tests 43 files / 267 pass; typecheck 0; lint 0; dry run 32/32 teams (22 off-day), 74 goalies + 4 stale skips on 11-22, 0 row problems.
- Still open (TJ): sign-off on weights/threshold/scales, approved backfill (dryRun=false), cron + release. Nothing committed.

## Backfill (TJ approved 2026-11-23 ~12:35 EST via pop-up: formula sign-off + "Backfill now")
- New: web/scripts/backfill-entity-sustainability.ts (rehearsal unless --write; FK check; paced; read-back counts).
  Writer now writes bands before scores and supports pauseMs.
- Rehearsal: 2026-09-29..11-22, 55 dates, 148,008 rows, 371 chunks, FKs all present.
- Write started 12:35 EST from this Mac (DB only, no Vercel, no NST), pause 250 ms.
- Write done 12:39 EST, exit 0, 237 s. Read-back = computed: team 6,852 / 41,112; goalie 14,316 / 85,728.
  SQL check 2026-11-22: 32 teams in l3/l5/l10/l20, 22 off-day; EDM l5 12.25 stable, NJD l5 35.13 stable.
- Not done: live page not opened (no prod requests authorised); no cron (dates after 11-22 need a rerun).
- Committed (TJ OK, 11-23): bc23e04cc on octoberBranch, 12 files (producer, route, scripts, tests, reader fixes). Not pushed; diary left out.
- Next: release (master reconcile + deploy) and daily cron each need TJ's approval; until then rerun the backfill script for dates after 11-22.
