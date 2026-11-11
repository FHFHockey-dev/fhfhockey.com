# Audit W3: Player cards & homepage stats (M-CARD-001 to 035) and Trade value (M-TRD-001 to 005)

Auditor: Claude (Fable), 2026-11-11, at commit `aeff5fab7` on `octoberBranch`. No code changed. Paths are under `web/` unless stated.

## 0. Brief

- **Questions.** (1) Is each displayed number on the homepage game cards, the player cards, the stats leaderboards, the Player vs Player post and the trade pages computed as its label says? (2) Do the homepage readers follow decisions 1, 42, 43, 45 and 64? (3) Which leads in the packets are real, and which are refuted?
- **Reference standards.** Ratio-of-sums pooling for rates and percentages (NHL.com, Natural Stat Trick: events × 60 ÷ TOI minutes; SH% = G ÷ SOG; IPP = points ÷ on-ice GF; xGF% = xGF ÷ (xGF + xGA)). Midrank percentile = 100 × (below + ½ equal) ÷ N. No-vig two-way edge = model probability − de-vigged market probability. Replacement-level reasoning for uneven trades (the VORP idea used in decisions 76–77). Maximum bipartite matching for slot coverage.
- **Fixtures and data.** Production reads on 2026-11-11 (section 5): 112 team-games of `forge_team_game_strength` against `wgo_team_stats` (2026-11-01 to 11-08); 151 FORGE game-score rows; `game_prediction_history`; goalie season totals; one NST game-log date. Algebra on the code for the rest. No tests were run.
- **Done when** every entry has a verdict with file:line and reach, each defect has a fix, a test and a priority, and the last section can be handed to a fix agent.

## 1. Summary

| Verdict | Player cards & homepage (35) | Trade value (5) |
|---|---:|---:|
| Sound | 15 | 3 |
| Mis-specified | 3 | 2 |
| Wrong | 1 | 0 |
| Covered by an earlier audit | 15 | 0 |
| Not assessed (image geometry, no hockey claim) | 1 | 0 |

**No P0.** Nothing in these two families shows a wrong hockey number to a production user today. The one live defect is the homepage pulse line, which is unlabelled decoration.

Top 5 by user impact:

1. **Homepage pulse draws June's playoff data (D1, P1, live).** With no 2026-27 predictions, the "pulse" under "Real-time analytics" is built from 10 rows of two Stanley Cup Final games (2026-06-14 and 06-17), and it plots distance from 50%, not model-vs-market edge.
2. **Homepage has no "predictions unavailable" state and a rounding gap in its pick (D2, P1, conditional).** Decision 42 and 43 readers. Nothing shows today because there is no production model; it matters the day one is promoted.
3. **Top Adds week mode mixes a 5-game projection with a games-left bonus and scores unknowns as zero (D3, P1, live).** Adds to the NaN defect already filed as team-ratings D14.
4. **Player vs Player compares totals built from a partly observed NST window (D4, P2, live share tool).** A player with 9 of 10 NST games shows a 9-game ixG total beside a 10-game total and gets a "higher" flag.
5. **Trade comparisons name a winner on uneven sides (D6, P2, dormant: page is 404 in production).** A 2-for-1 always favours the two-player side on raw sums.

The packet's headline lead for M-CARD-019 ("picks the less-negative edge") is **refuted for normal inputs**: see the table.

## 2. Per-entry table

Reach: live / conditional (needs a flag or a table state) / dormant (no production route) / research.

| ID | Verdict | Evidence | Reach | Downstream |
|---|---|---|---|---|
| M-CARD-001 | Mis-specified (minor): "PP points /60" divides by all-situation TOI. Rest sound. D8 | `lib/player-cards/analysisSnapshot.ts:53-76` | dormant (`PlayerAnalysisStudio` imported only by its test) | Analysis card |
| M-CARD-002 | Sound | `components/player-cards/CurrentPlayerCard.tsx:10-15`; `analysisSnapshot.ts:78-83` | live (`/player-cards`) | Recent vs Previous card |
| M-CARD-003 | Not assessed: image processing, no hockey quantity | `lib/player-cards/alphaOutline.ts`, `portraitTreatment.ts` (not read) | live | Card artwork |
| M-CARD-004 | Covered by W2-9 BLSH (M-BLSH-002; Astra reach section) | `lib/player-cards/analysisEvidence.ts` | dormant; Codex-owned | Analysis card |
| M-CARD-005 | Covered by team-ratings D14 (NaN) **plus D3 here** | `lib/dashboard/topAddsRanking.ts:64-96` | live | FORGE Top Adds, player page |
| M-CARD-006 | Sound | `lib/player-cards/currentNhl.ts:47-58,96-108` | live | Current card, production chart |
| M-CARD-007 | Sound. NST `toi` confirmed in seconds (section 5) | `lib/player-cards/aggregation.ts:42-58`; `registry.ts:10-23` | conditional (fixtures only; `liveData=false`) | NST cards |
| M-CARD-008 | Sound (ATOI × 60 × GP is the pooled sum again; redundant, not lossy) | `lib/player-cards/observedView.ts:22-23` | dormant | Observed card |
| M-CARD-009 | Sound under the owner-approved policy of 2026-11-01 (no sample floor) | `lib/player-cards/ranking.ts:8-19` | conditional (synthetic pool only) | Card ranks |
| M-CARD-010 | Sound (fail-closed; UTC date basis is declared) | `lib/player-cards/windows.ts:61-106` | conditional (fixtures) | NST cards |
| M-CARD-011 | Sound. "Pace/84" is labelled; GP = 0 is guarded | `components/WiGO/PerGameStatsTable.tsx:67-70,100-101` | live | WiGO |
| M-CARD-012 | Sound (same identity as 008) | `lib/player-cards/interactionSnapshot.ts:20-22` | live on synthetic fixtures | Share card |
| M-CARD-013 | Mis-specified: D4 | `lib/socialShare/modules/playerVsPlayer.ts:160-175,185-190` | live (share tool) | Player vs Player post |
| M-CARD-014 | Mis-specified: mixed units on one raw axis. D8 | `components/player-cards/PlayerAnalysisCard.tsx:49` (packet location; not re-read) | dormant | Analysis card |
| M-CARD-015 | Covered by W2-9 BLSH (retained snapshot; Astra reach section) | `lib/player-cards/retainedBlsh.ts` | dormant; Codex-owned | Analysis card |
| M-CARD-016 | Sound as arithmetic. Band cut-offs (0.75 / 1.25, ±2, 25 / 75) are presentation choices (rule 12); `luck_pressure` itself is covered by sustainability-part1 | `lib/dashboard/playerInsightContext.ts:6-11,59-75` | live | FORGE dashboard cards |
| M-CARD-017 | Sound | `lib/dashboard/playerOwnership.ts:54-62` | live | Ownership readers |
| M-CARD-018 | Sound. SOG matched NHL totals in 104 of 112 team-games; no null buckets (section 5). xG reader covered by xg-part1 D1 | `lib/homepageGameAnalytics.ts:188-197,199-241,243-300` | live | Homepage game cards |
| M-CARD-019 | Sound arithmetic; lead refuted. Decision 42/43 reader gaps: D2 | `lib/homepageGameAnalytics.ts:109-134`; `components/HomePage/HomepageDesktopGameSlates.tsx:50-80` | conditional (0 production models) | Homepage game cards |
| M-CARD-020 | **Wrong**: D1 | `lib/homepagePulse.ts:60-74,155-198,206-216` | live | Homepage hero line |
| M-CARD-021 | Sound (clamp only) | `lib/homepageVisitors.ts:22-45` | live | Homepage hero line |
| M-CARD-022 | Sound; clipping is labelled | `components/player-cards/ProductionGameChart.tsx:5-27` | live | Production chart |
| M-CARD-023 | Sound (date join uses an explicit source date; same-date ambiguity rejected) | `lib/player-cards/nstCapture.ts:37-80` | dormant | Observed cards |
| M-CARD-024 | Covered by fantasy-scoring 036 (sound) **plus D5 here** | `lib/NHL/statsPageFetch.ts:52-56,212-250,334-349` | live | `/stats` |
| M-CARD-025 to 035 | Covered by M-CARD-007 (one function, eleven registry rows). Each matches decision 9: IPP = points ÷ on-ice GF, xG% = xGF ÷ (xGF + xGA), on-ice rates use on-ice TOI | `lib/player-cards/registry.ts:11-22` | conditional | NST cards |
| M-TRD-001 | Mis-specified: D6 | `lib/buyLowSellHigh/trade.ts:73-96,112-168` | dormant (`pages/buy-low-sell-high/trade.tsx:12-13` is 404 in production) | Trade comparison |
| M-TRD-002 | Sound. Counts are identities; slot matching covered by rso-roster-optimizer 034 (maximum matching) | `lib/tradeAnalyzer/offer.ts:83-103`; `slotFeasibility.ts:72-106` | live (`/trade-analyzer`) | Trade Analyzer |
| M-TRD-003 | Sound (fail-closed; no production caller) | `lib/tradeValue/valuationComponents.ts:12-68`; `valuationRequest.ts:106-136` | dormant | none |
| M-TRD-004 | Mis-specified: D6, D7 | `components/blshTrade/retrospective.ts:20-55` | dormant (same 404 page) | Trade comparison |
| M-TRD-005 | Sound (validation and de-duplication only) | `lib/tradeValue/observationEvidence.ts:8-44` | dormant | none |

Why the M-CARD-019 lead fails: the model's two probabilities sum to 1 and so do the two no-vig market probabilities, so `homeEdge = −awayEdge`. Taking the larger always picks the non-negative side. Both edges can be negative only if stored probabilities do not sum to 1, which the code does not check (folded into D2).

## 3. Defects

### D1 (P1, live). The homepage pulse is five months stale and switches meaning — M-CARD-020
- **What.** `fetchHomepagePulse` reads public `game_prediction_history` rows with no lower date bound and no model filter (`homepagePulse.ts:206-216`). When today has no rows, `selectHomepagePulseSlateDates` takes the two most recent dates of any age (`:60-74`). With fewer than two market observations it plots `|p − 0.5|` (model confidence) instead of `|p − market|` (`:187-198`).
- **Magnitude (2026-11-11).** The latest public rows are 2026-06-17 and 2026-06-14: 5 rows each, one game each, 0 market snapshots for June. The line on today's homepage is 10 June playoff predictions from the placeholder model, values 0.084 to 0.103.
- **Why it matters.** It sits under "Real-time analytics" (`HomepageGamesSection.tsx:964`). The line is `aria-hidden` with no axis or value, so no wrong number is read, which keeps it out of P0. It is also the placeholder model of decision 1.
- **Fix.** In `selectHomepagePulseSlateDates`, accept only today's slate (or a stated maximum age such as 2 days) and return no points otherwise; `HomepagePulse` already falls back to the visitors series or renders nothing. Drop the `|p − 0.5|` fallback, or return it as a separately named series. Filter to production model versions, as `fetchPublicGamePredictions` does.
- **Test.** Fixture with rows dated 147 days before `currentDate` returns `[]`. Fixture with one market observation returns `[]` (or the named confidence series), never a mixed series.
- **Readers.** `pages/index.tsx:519`, `pages/api/v1/homepage/pulse.ts:17`, `components/HomePage/HomepagePulse.tsx`.

### D2 (P1, conditional). Homepage readers of decisions 42 and 43 — M-CARD-019
- **No unavailable state.** With no production model the win-probability and Edge slots are silently empty (`homepageGamePresentation.ts:98-109`). Decision 42 asks for a notice. Today: 0 production model versions and 0 non-FORGE prediction rows since 2026-10-01.
- **Pick does not follow the displayed number.** Desktop compares raw probabilities but prints rounded ones (`HomepageDesktopGameSlates.tsx:66-80`): 0.504 against 0.496 prints "BOS 50%". Decision 43 makes a displayed 50% a tie. `favoredTeamAbbreviation` gives exact ties to the home team (`homepageGameAnalytics.ts:111-113`); it is returned by the API but no component reads it.
- **Mobile percentages can sum to 101** (0.505 and 0.495 round to 51 and 50; `HomepageGamesSection.tsx:376,426`).
- **Edge label.** "Edge BOS +3.2pp" does not say model against market, and an edge under 0.05 prints "+0.0pp". The edge is not checked for probabilities that fail to sum to 1.
- **Fix.** One helper that returns the displayed pair (round home, away = 100 − home), the pick from the displayed pair, and "tie" at 50. Add the decision 42 notice to both slate components. Label the edge "Model vs market". Withhold the edge when either pair does not sum to 1 within 0.001.
- **Test.** Table test at 0.504/0.496 (tie), 0.505/0.495 (51/49, home), 0.5/0.5 (tie); a no-prediction fixture renders the notice; a pair summing to 0.97 yields no edge.

### D3 (P1, live). Top Adds: horizon mismatch and unknowns scored as zero — M-CARD-005
- **Week mode.** Projections are requested at horizon 5 (`TopAddsRail.tsx:220,407`), so `projectionSupportScore` is a next-5-team-games total whatever is left in the week, and `scheduleContextScore` then adds 1.5 per game remaining (`topAddsRanking.ts:69-78`). A team with 2 games left is credited with 5 games of production plus a 2-game bonus. Tonight mode is consistent.
- **Unknown as zero (rule 5, decision 48).** `row.pts ?? 0`, `ppp ?? 0`, `sog ?? 0`, `delta ?? 0` (`TopAddsRail.tsx:558-563`), and on the player page `ownership ?? 0` (`pages/forge/player/[playerId].tsx:346-348`), which awards the full +8 "low ownership" bonus when ownership is stale or missing. Unknown uncertainty carries no penalty.
- **Units.** `delta × 5` is ownership percentage points; the other terms are fantasy-point-like. The weights are unvalidated (rule 12). The UI calls it "Add score", which is honest, but the components are shown as if commensurable.
- **Fix.** Week mode: sum per-game projections over the games actually left in the week (decision 28: per-game values, no horizon scalar) and drop the per-game schedule bonus, or keep the bonus and use a one-game projection. Return `null` components and an "incomplete" flag for missing inputs and rank those below complete rows. Fold `extractUncertaintyPenalty` into the scorer (the D14 fix).
- **Test.** Two identical players, 2 and 4 games left: the score ratio follows games left, not 5 + bonus. A candidate with `pts` missing has `total === null` and sorts after complete rows.

### D4 (P2, live share tool). Player vs Player totals over a partly observed window — M-CARD-013
- **What.** For NST metrics a side is admitted at 90% coverage (`playerVsPlayer.ts:163`). On the Totals basis the value is the sum of known games (`:169`), and `higher` is withheld only when appearance counts differ (`:186`), not when observed counts differ. Nine of ten NST games gives a 9-game ixG total compared with a 10-game total: about 10% low for a steady player, and the flag can flip. Per-appearance and per-60 are covered-subset rates with coverage printed in the notes, which rule 16 allows.
- **Fix.** On Totals, set `higher = null` and print "partial total (9 of 10)" when `observed < expected` on either side. Rule 13.
- **Test.** Oriented fixture: A has 10 games of 0.30 ixG, B has 10 of 0.32 with one NST row missing. Today B total 2.88 < A 3.00 with `higher: "a"`; expected `higher: null`.

### D5 (P2, live). Stats-page goalie leaders: hidden qualifier, order-dependent ties — M-CARD-024
- **Hidden qualifier.** The minimum is `floor(0.25 × average team GP)` (`statsPageFetch.ts:245-248`): 4 GP on 2026-11-11 (average 18.25). The page does not print it. A 4-start goalie is tied for fifth in QS%.
- **Ties (rule 20).** Top five is a plain sort and slice (`:334-349`). Today two goalies share QS% .750 for fifth place; the lower `goalie_id` is shown and the other vanishes.
- **Wrong-season threshold.** If the current season has no goalie rows, the loader falls back to the latest earlier season (`:161-187`) but still applies the current season's threshold.
- **Basis.** QS% is per start; the qualifier counts appearances. QS% here is the NHL-supplied column, a second source next to decision 40's "one shared implementation".
- **Fix.** Print "min N GP" beside the goalie boards; show ties at the cut (or break by starts, then name); compute the threshold from the season actually shown; qualify QS% on `games_started`. Route the QS% source to the decision 40 lane.
- **Test.** Two goalies tied at fifth both appear or follow a stated tie-break regardless of input order; fallback-season fixture uses that season's threshold.

### D6 (P2, dormant). Trade verdicts on uneven sides — M-TRD-001, M-TRD-004
- **What.** `compareTrade` marks uneven sides as a non-blocking issue and still writes "the receive side is ahead by X fantasy points" (`trade.ts:139-141,157-159`). `retrospectiveComparison` sums per-game rates per side and prints "Receive − give" with no uneven-side note at all (`retrospective.ts:44-54`; `BlshTradeComparison.tsx:282-284`). Two 2.0-points-per-game players beat one 3.5 player by 0.5 on paper, although the single player frees a roster slot.
- **Fix.** Keep both side totals; when the counts differ, withhold the net and the ahead/behind sentence and say why. Do not invent a replacement value (decisions 76–77 need a league-aware reference).
- **Test.** 2-for-1 fixture: `rows[0].net === null`, summary contains no "ahead"/"behind"; even trade unchanged. Also `net === 0` should read "level", not "ahead by 0.00".

### D7 (P2, dormant). Retrospective per-game rate assumes a fully observed track — M-TRD-004
`recordedPerGame = headline.observed ÷ window.games` (`retrospective.ts:28`). If the headline track covers fewer games than the window, the rate is understated. Astra's A1 found exactly this masking problem in arm C. Undetermined on real data (fixtures only). Fix with A1: divide by the track's own observed game count, or withhold.

### D8 (P2, dormant). Analysis card labels — M-CARD-001, M-CARD-014
"PP points /60" uses all-situation TOI (`analysisSnapshot.ts:56`): label it "PP points per 60 total minutes" or divide by `ppToiSeconds`. The radar scales counts, minutes, xG and percentages by one maximum; the caption says "raw count shape, not percentiles", but the shape only reflects unit size. Give each axis its own stated scale before the Studio is mounted.

## 4. Owner questions not already answered

1. **Homepage pulse.** Remove it when there is no current slate (recommended), or keep an always-on line that is labelled as site visitors only?
2. **Stats-page goalie qualifier.** Keep the house rule (a quarter of average team games, by appearances) and print it (recommended), or switch to a starts-based minimum?
3. **Top Adds week score.** Should it be an estimate of fantasy points over the rest of the week (recommended; then demand and ownership become separate columns), or stay a blended "Add score" with labelled presentation weights?
4. **Uneven trades.** Withhold the verdict until a league-aware replacement level exists (recommended), or show raw sums with a stronger warning? This is the Codex BLSH lane's call to implement.

## 5. Limits and reproduction

- No tests, browser session or build were run. Verdicts on M-CARD-014 and the UI copy come from the packet location and grep, not a full read. M-CARD-003, 004 and 015 were not read.
- `pg_stat_activity` before the reads showed one other active backend: the Supabase Realtime `walsender` (a standing replication stream, 870 s), not a query. I treated it as outside the 10-second rule; no user query was active.
- All reads were on project `fhfhockey.com`, 2026-11-11, read-only, no jsonb columns:
  - SOG: `forge_team_game_strength` (`game_date` 2026-11-01..11-08; `shots_es + shots_pp + shots_pk`) joined on `(game_id, team_id)` to `wgo_team_stats.shots_for_per_game` (same dates). 112 team-games: 104 equal, 6 over (largest +4), 2 under by 1, 0 rows with a null bucket.
  - FORGE scores: `game_prediction_outputs` where `model_name='forge'`, `model_version='market-context-v1'`, `snapshot_date >= '2026-10-25'`: 151 rows, mean home 3.10, mean away 3.06, range 2.03 to 4.12. Per-game scale; no multi-game totals.
  - `game_prediction_model_versions` with `status='production'`: 0. Non-FORGE outputs since 2026-10-01: 0.
  - `game_prediction_history` (`is_public`, pregame, `snapshot_date >= '2026-06-10'`) grouped by date: 06-11, 06-14, 06-17, 5 rows and 1 game each; `|p − 0.5|` 0.084 to 0.103. Market snapshots for 2026-06-10..30: 0.
  - `nst_gamelog_as_counts.toi` on `date_scraped='2026-11-05'`: 396 rows, 155 to 1,989 (seconds).
  - `nhl_standings_details`, season 20262027, latest date 2026-11-11: 32 teams, mean GP 18.25. `wgo_goalie_stats_totals` season 20262027, `games_played >= 3`, top 12 by `quality_starts_pct`.
  - xG registry champion `…cfg9bac2706` has 0 aggregate rows for game ids 2026020200–2026020280.
- Magnitudes are dated samples (rule 1), not rates.

## 6. Final analysis and fix-agent handoff

### Final analysis

These two families are mostly display arithmetic, and the arithmetic is careful. The player-card code pools numerators and denominators before dividing, refuses missing inputs instead of zero-filling them, keeps units declared, and withholds ranks until a full population exists. The trade-value library computes nothing a user sees and fails closed. Fifteen entries repeat code that earlier audits already judged.

What is wrong sits at the edges, where a display keeps going after its data has stopped. The homepage pulse has no age limit, so with no 2026-27 game model it shows two June playoff games, and it quietly swaps "disagreement with the market" for "distance from a coin flip". The homepage game cards have no state for "no model", which decision 42 requires, and their pick is taken from unrounded numbers while rounded ones are printed, which decision 43 forbids. Top Adds scores a missing projection or ownership as zero and, in week mode, adds a games-left bonus to a projection that already covers five games.

The upstream corrections change two things here. Astra showed the game-page Poisson chart is not rendered and that health already reports a missing model, so the homepage is the surface where the missing model is actually felt: the fix is the decision 42 notice, not a new alert. Astra's BLSH review established that the trade page is a 404 in production and runs on fixtures, that the family is Codex-owned, and that a partially observed track must not borrow full-window exposure (A1). So the trade findings (D6, D7) are dormant and go to the Codex lane, and D7 is the same masking problem seen from the trade view. I found nothing that disagrees with either Astra review. I disagree with the packet lead on M-CARD-019: the edge selection is correct for complementary probabilities.

### Recommendations, in priority order

1. **D1, homepage pulse (P1).** Change `selectHomepagePulseSlateDates` and `buildHomepagePulsePoints` in `lib/homepagePulse.ts`; add a production-model filter in `fetchHomepagePulse`. Readers: `pages/index.tsx:519`, `pages/api/v1/homepage/pulse.ts`, `components/HomePage/HomepagePulse.tsx` (check its empty-series path). Test: stale rows return `[]`; fewer than two market observations never yields a confidence series under the edge name. Update `lib/homepagePulse.test.ts`, whose offseason-fallback case encodes the current behaviour.
2. **D2, homepage decisions 42 and 43 (P1).** Add one display helper in `components/HomePage/homepageGamePresentation.ts` (displayed pair, pick, tie) and use it in `HomepageGamesSection.tsx` (mobile) and `HomepageDesktopGameSlates.tsx` (`getEdgeMetric`). Add the unavailable notice to both. In `lib/homepageGameAnalytics.ts` `analyticsFromPrediction`, make `favoredTeamAbbreviation` undefined on a tie and withhold the edge when a pair does not sum to 1. Readers: also `pages/api/v1/games/index.js`. Test: the table test in D2 plus a no-prediction render test.
3. **D3, Top Adds (P1).** Change `scoreTopAddsCandidate` in `lib/dashboard/topAddsRanking.ts` and its four callers: `components/forge-dashboard/TopAddsRail.tsx`, `components/forge-command-center/TopAddsWatchlist.tsx`, `pages/FORGE.tsx:368`, `pages/forge/player/[playerId].tsx:338`. Do it in the same change as team-ratings D14. Test: D3's two cases, plus the D14 NaN case at each caller.
4. **D5, stats leaders (P2).** `lib/NHL/statsPageFetch.ts` (`loadMinGamesThreshold`, the four goalie sorts) and the board headers in `pages/stats/index.tsx` and `components/StatsPage/MobileTabInterface.tsx`. Test: tie at fifth; fallback season.
5. **D4, Player vs Player (P2).** `metricSide` and `comparePlayerWindows` in `lib/socialShare/modules/playerVsPlayer.ts`; the card renderer that prints `shown`. Test: D4's oriented fixture.
6. **D6, D7, trade comparison (P2, Codex lane).** `compareTrade` in `lib/buyLowSellHigh/trade.ts`; `retrospectivePlayer` and `retrospectiveComparison` in `components/blshTrade/retrospective.ts`; `BlshTradeComparison.tsx` summary and `RetrospectivePanel`. Test: D6's 2-for-1 fixture; a headline track with fewer observed games than the window.
7. **D8, analysis card labels (P2).** `ANALYSIS_FIELDS` and `reading` in `lib/player-cards/analysisSnapshot.ts`; `components/player-cards/PlayerAnalysisCard.tsx`. Only before the Studio is routed.

### Directional suggestions (not defects)

- Card ranks have no sample floor by approved policy. When an observed population is admitted, a one-shot 100% shooter will rank first in SH%; consider showing the sample beside the rank (Wave 2 question 11 covers floors elsewhere).
- The recent-versus-previous card shows a raw L5 difference. A note on typical game-to-game spread would stop readers over-reading it.
- `pooledMetric` rejects a whole card when a game has more points than on-ice goals for. That can happen legitimately (an assist recorded after the passer has left the ice). Consider marking only IPP undefined.
- Card windows use UTC dates by declared contract. Rule 19 prefers NHL schedule dates; change it as a versioned contract before observed data is admitted.
- "Pace/84" is right for 2026-27. If the WiGO season selector shows an 82-game season, take the season length from the season record.
- FORGE "Proj" on the homepage averages 3.10 home against 3.06 away. The small home edge belongs to decision 27 (venue terms), not to this lane.
- SOG from strength buckets differs from the NHL total in 8 of 112 team-games (up to +4). Decisions 59 and 70 (exclusive strength totals that reconcile) own that; the homepage would be simpler reading the official total.

### Context a fix agent needs

- **Decisions that apply.** 1, 42, 43 (homepage); 28 and 48 (Top Adds horizon and missing projections); 40 (QS%); 76–77 (no invented replacement value in trades); rules 4, 5, 13, 16, 20.
- **Scales.** Homepage probabilities are 0–1 and the edge is ×100 percentage points. The embedded `model_vs_market_edge` is a 0–1 fraction (`baselineModel.ts:1387-1390`), the same unit as the snapshot edge, so there is no unit mix in the pulse. Card percentages are 0–100; goalie `save_pct` and `quality_starts_pct` are 0–1 and `goalieRatio` nulls anything above 1. NST and NHL card TOI are seconds; ATOI is minutes.
- **Nulls.** The card code treats missing as missing on purpose. Do not replace a fail-closed null with a partial ratio (rule 16). `sumTarget` returns 0 for a side with no applicable players; that is intended.
- **Traps.** `leagueValuationComponents` compares a total with a float sum by `!==`; it fails closed, leave it. `lib/homepagePulse.test.ts` and `lib/homepageGameAnalytics.test.ts` assert today's behaviour (offseason fallback, home wins ties) and must change with the fix. A second `next dev` needs `PLAYWRIGHT_ISOLATED_NEXT=1`.
- **Ownership.** `lib/buyLowSellHigh/**`, `components/blshTrade/**`, `lib/player-cards/retainedBlsh.ts` and `analysisEvidence.ts` are the Codex BLSH lane: send D6 and D7 there, do not edit. Top Adds overlaps the team-ratings lane (D14).
- **Do not change.** `CARD_RANK_POLICY` (owner-approved), the fail-closed checks in `currentNhl.ts`, the production-404 gates on the BLSH pages, and `PLAYER_CARD_CAPABILITIES.liveData`.
- **Production actions.** None. Every fix is code and tests only: no migration, backfill, rebuild or env change. Promoting a game model later is its own approval (decision 1).
- **Suggested lanes.** (a) Homepage lane: D1 and D2, one Opus agent. (b) Top Adds: D3 joined to the lane that takes team-ratings D14. (c) Share and stats display: D4 and D5. (d) Codex BLSH lane: D6 and D7. (e) D8 waits for the player-cards owner to route the Studio.
