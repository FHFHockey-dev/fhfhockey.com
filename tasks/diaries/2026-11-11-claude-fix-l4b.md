# L4b fix lane diary (2026-11-11)

## Scope
Fix lane L4b: WiGO readers, ratings, writer, player radar. Brief: tasks/artifacts/calculation-inventory-2026-11-10/master/fix-lanes/L4b.md. Findings: W1 P0 #8 (radar 5v5), W3-1 D3, A3, D4, D5, A1/A2, D9/D11/D12, W2-1 D9 reader, L4a reader tickets (NULL unknown, percent_games, percentile-rank zeros), L1 house labels, decision 85 label, decision 90 mid-rank.

## Where
octoberBranch, sole checkout. Claim line appended to CLAUDE-TO-CODEX.md (no Codex claims on owned paths in last 60 lines of CODEX-TO-CLAUDE.md).

## State / checks
- Start: read brief, decisions, W3-1, BA W1-2 C, L4a handover.

- W1 P0 #8 radar (uncommitted): radarSeasonStats.ts reads nst_seasonlong_5v5_rates / _5v5_counts_oi (views do NOT exist yet; ticket to Chef for L4a, msg 3507ff62); player and cohort share view/season/minimum; player counted once (no N+1 of N); mid-rank via utils/calculatePercentiles calculateRankingResult (decision 90); HDCF/60 on-ice (decision 9); skater WGO all-situation stats unranked; goalie path stays WGO, labelled "All situations"; below-minimum note. Proof: restored HEAD sources → 31 of 56 tests fail; mine → 56/56 pass.
- percent_games (mig 133): radar never reads it; no change.

- Claim line: committed in HEAD by another lane's commit ff6cae9d8 (it swept CLAUDE-TO-CODEX.md); nothing left to commit there.
- A1 writer (calculate-wigo-stats.ts): addKnown, null-propagating seasonal sums; 1 test fails on HEAD.
- A2 reader: derivePer60 removed; unit + rendered matrix test fail on HEAD.
- A3/D3/D9 ratings: calculateWigoRatings withholds partial ratings (coverage), no one-side overall/ST, PP/PK minutes floor (provisional 30 min, unvalidated) + F/D via fetchSkaterPositionGroups (wgo_skater_stats_totals). 5 fail on HEAD (shimmed exports).
- A3/D3 panel: RateStatPercentiles per-stat finite cohort + size, PP/PK minutes slider + F/D; 5 fail on HEAD. PlayerRatingsDisplay coverage note + floor note; 2 fail on HEAD. 3 old display tests pinned the A3 defect (fixtures with 1 of N weighted stats) → withAllWeightedStats helper.
- D4: true percentile of PP+PK standing; 2 fail on HEAD (model + rendered card, fixture file teamPerformanceDrivers.fixture.ts).
- D5: isRegularSeasonGameOf (game id season+type 02) in shared calendar; selected-stat log reconciled to ledger (gap for absent NST). 6 unit + 1 rendered (ConsistencyChart) fail on HEAD.
- D11 writer: GP from WGO, IPP null over mismatched games, recent PP% pooled by PP time; 2 fail on HEAD. D12 DIFF title + help; PP% labelled NHL-reported unqualified (L8); decision 85 Game Score label.
- percentile-rank.ts: nulls for no games, numeric mid-rank (old sorted as text); 2 fail on HEAD.
- Checks: vitest 62 files / 604 tests pass; eslint changed files exit 0; npm run typecheck exit 2, only lib/projections/queries/skater-queries.ts (another lane's dirty file). No .module.scss edits.

## Next
E2E wigo-one-page (fixture, isolated next, port 3100) for layout fit; commit; report to Chef.

## Blockers
- Radar reads nst_seasonlong_5v5_rates / _5v5_counts_oi: views don't exist yet → L4a ticket to Chef. Until applied the skater radar shows "No 5v5 comparison data".

## Production steps (for Chef)
1. L4a: write+apply 5v5 season views before deploying L4b.
2. L4a migrations 125/126/133 can apply (readers render NULL as unknown).
3. Bounded calculate-wigo-stats rebuild after deploy (A1/D11 writer fixes).
4. Split-half validation of the 30-min PP/PK floor (bounded read); floor labelled provisional meanwhile.

## Insights
- NST `es` season views = sit=ev (even strength), not 5v5. No 5v5 season view exists; only nst_gamelog_5v5_* tables.
- Live radar ranks only `advanced` stat lists (types.ts, L17) → all NST for skaters; goalie advanced stats are not in STAT_CALCULATION_METHODS, so goalie radar ranks nothing live.
