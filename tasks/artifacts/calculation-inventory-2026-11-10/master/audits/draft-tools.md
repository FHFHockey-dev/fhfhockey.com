# Math audit · Draft tools (M-DRF-001 to 051)

Wave 2 · audited 2026-11-11 on `octoberBranch` (started at 3e81061cb, finished at 356d79a53) · read-only, no code changed.
Packet: [../packets/draft-tools.md](../packets/draft-tools.md). Binding context: OWNER-DECISIONS 1–68, BATCH-A and BATCH-BC cross-cutting rules 1–12, TRIAGE C32/C33 and section 4 item 11.

## 0. Brief (written before the audit)

**Questions**

1. Value over replacement (M-DRF-027): what is the replacement level, does it stay put during a draft, and does it treat UTIL, bench and multi-position players in a defensible way?
2. VONA: does the code compute "value over next available" as the community defines it?
3. VBD and the recommendation score (M-DRF-026, C32): what are the effective weights, and can the blend rank a worse player above a better one at the same position?
4. Need weighting (M-DRF-025, 028): are position and category needs on a common scale, and how large is the boost next to the value it adjusts?
5. Category value (M-DRF-031, 033): which pool sets the z-scores, and do decisions 55 and 62 hold in the draft readers?
6. Availability (M-DRF-030): is the survival maths right, and is the ADP it rests on fit for that use?
7. Projection inputs (M-DRF-007 to 010, 021 to 023, 032): are units, blends, pacing and the accuracy score right and honestly labelled?
8. Draft Ranker (M-DRF-001, 012 to 015, 044, 045) and mock drafts (M-DRF-002, 004, 024, 034, 041, 049, 050): are the models internally sound, and what is live?

**Reference standards** (by name; no page citations claimed)

- **VBD**: Joe Bryant, "Value Based Drafting" (Footballguys). Value = projection minus one baseline player at the position.
- **VORP**: replacement = the best player freely available once every team's starting slots are filled (first non-starter).
- **VOLS**: baseline = the last starter (teams × starters at the position).
- **VONA**: the player's value minus the best player at his position expected to be available at the manager's *next* pick.
- **Category z-scores**: z over the rostered pool, rates converted to impact (Art McGee, *How to Value Players for Rotisserie Baseball*), as already adopted in [fantasy-scoring.md](fantasy-scoring.md) D2 and decision 62.
- **Bradley-Terry** paired-comparison model with a Gaussian prior (MAP estimate).
- **Forecast accuracy**: decision 65 (squared error or deviance first; MAE secondary).
- **Normal tail**: Abramowitz and Stegun 26.2.17.
- **Int**: internal consistency and honest labelling, where no community formula exists.

**Fixtures and data**

- Real 2026-27 projection values: 399 AG skaters and 74 DTZ goalies, scored with the FHFH default weights, with the projection tables' own position strings (query Q5 in section 6). ADP in the fixture is **synthetic** (value rank plus seeded noise), because the Yahoo join returned no matches.
- A 12-team league: C2, LW2, RW2, D4, G2, UTIL1, bench 4.
- Catalog and count reads for reach (what is deployed, what has rows).

**Done when** every entry has a verdict with file:line evidence, each defect has a magnitude or a stated reason it has none, a fix and a test, and upstream audits are cited instead of repeated.

## 1. Summary

| Verdict | Count | Entries |
|---|---:|---|
| Sound | 22 | 007, 008, 009, 011, 014, 015, 016, 018, 019, 022, 032, 034, 035, 037, 040, 043, 045, 046, 047, 048, 049, 050 |
| Mis-specified | 23 | 001, 002, 003, 004, 005, 006, 010, 012, 013, 017, 023, 027, 028, 029, 030, 031, 036, 038, 039, 041, 042, 044, 051 |
| Wrong | 6 | 020, 021, 024, 025, 026, 033 |
| Undetermined | 0 | — |

Total 51. Four of the Sound entries (015, 046, 048, 049) were checked against the packet description and call sites only, not line by line. Five entries are cited from earlier audits rather than re-audited: 001, 002, 004, 047 (sql-cross-cut) and 033 (fantasy-scoring).

**Top 5 by user impact**

1. **Source accuracy shows 0% for every source during the season (D1, P0).** The default "total" mode compares full-season projections with season-to-date actuals. A source that is exactly right per game scores 0% at 15 of 84 games (executed).
2. **The recommendation score can rank a worse player above a better one at the same position (D2, P0 in draft season).** VONA carries 51% of the baseline weight and is a drop-off measure, not VONA. Fixture: 10 to 47 same-eligibility inversions among the top 60 available, up to 12 fantasy points.
3. **Replacement level falls as the draft goes on (D3, P1).** Fixture: C replacement 273 → 164 between pick 1 and pick 193; a defenseman's VORP rises 34 → 56 with no change in his projection. Team VORP and the draft-winner badge read it.
4. **Forward replacement is overstated because multi-position players sit in every pool (D4, P1).** Fixture: 267 to 273 at C/LW/RW against 247 for a true 84-forward assignment, so the top defenseman out-VORPs the top centre (170 against 165; 170 against 191 on a pooled-forward baseline).
5. **Need weighting is on the wrong scale (D5, P1).** The boost is half the best score in the pool. Fixture: the best centre drops from 19th to 97th when C is full. Category needs are raw count deficits for six hard-coded skater categories.

Reach today: the 2026-27 projection tables have rows (318, 399 and 74 in the three tables counted), so the Draft Dashboard computes all of this now. Traffic is low outside draft season (TRIAGE row 15).

## 2. Per-entry table

Reach labels follow rule 8: **live**, **conditional**, **dormant**. "Fixture" means the 473-player fixture in section 0. Paths are under `web/` unless they start with `supabase/`.

| ID | Verdict | Evidence | Ref | Magnitude | Downstream · reach |
|---|---|---|---|---|---|
| 001 Draft-ranking seed and order keys | Mis-specified | Cited: [sql-cross-cut.md](sql-cross-cut.md) row M-DRF-001 and D15 (two ADP sources on one ordinal scale). Not re-audited | Int | Not measured | Draft Ranker · live (87 rankings, 27,226 entries, exact counts 2026-11-11) |
| 002, 004 Mock-draft ADP | Mis-specified | Cited: sql-cross-cut row M-DRF-002/004 and D5. Re-checked: no `mock_draft*` table or function in `pg_tables`/`pg_proc` on 2026-11-11 | ADP = mean pick over all drafts | None | `lib/mockDraft/api.ts` · **not deployed** |
| 003 Ownership and ADP movement | Mis-specified | `pages/api/v1/transactions/ownership-trends.ts:183-200`: `deltaPct` is percentage points for ownership and relative percent for ADP | Int | Label only | TransactionTrends, FORGE rail · live |
| 005 Standings value, steals, draft winner | Mis-specified | `components/DraftDashboard/DraftSummaryModal.tsx:258-277`, `:202-236`; `LeagueStandings.tsx:58-75`; `lib/draftDashboard/roundRankHistory.ts:37` | Int | D3, D9 | Draft summary, standings · live |
| 006 Value bands, run forecast | Mis-specified | `components/DraftDashboard/ProjectionsTable.tsx:924-975` (bands over the filtered view); `:1269-1271` tooltip | Int | D10 | Projections table · live |
| 007 Actual-stat units | Sound | `hooks/useProcessedProjectionsData.tsx:1158-1195`. Live path is numeric: `wgo_skater_stats_totals.toi_per_game` is double precision, so seconds ÷ 60 = minutes. The `mm:ss` string branch returns seconds and never runs | Int | None live | Projections · live |
| 008 Yahoo ADP parsing | Sound | Parsing only. Data caveat in D7: 300 of 1,611 season-2026 rows have an ADP, maximum 158.0 | — | D7 | ADP readers · live |
| 009 Projected fantasy points | Sound | `lib/draftDashboard/fantasyPointRecalculation.ts:26-71`; defaults `lib/projectionsConfig/fantasyPointsConfig.ts:8-33`. Arithmetic right. Labelling gap in D11 | Int | D11 | Everything in points leagues · live |
| 010 Diff % and round summaries | Mis-specified | `fantasyPointRecalculation.ts:17-24`, `:56`; actuals are current-season totals (`useProcessedProjectionsData.tsx:609-650`) | Int | D1 | Projections table · live |
| 011 Draft Pro DUST wrapper | Sound | Gates only; core maths cited to [rso-roster-optimizer.md](rso-roster-optimizer.md) | — | — | Draft Pro · conditional |
| 012 Community Bradley-Terry | Mis-specified | `lib/draft-ranker/communityModel.ts:120-124`, `:261-276`, `:285-325`. Gradient and curvature are right; the prior scale is not | BT + Gaussian prior | D8 | Community snapshot · live (947 preferences, 71 snapshots) |
| 013 Discovery signals | Mis-specified | `lib/draft-ranker/discovery.ts:262-285` (ADP pick against projection rank); `discoveryServer.ts:374` sets `projectionRankGain: null` | Int | Not measured | Discovery · conditional (0 signal rows) |
| 014 Assisted placement | Sound | `lib/draft-ranker/placementEngine.ts:116-148`. Rule-based; "confidence" is a question count and says so | Int | — | Draft Ranker · live |
| 015 Pair queue | Sound (description-level) | Selection rules, no estimate | — | — | Draft Ranker · live |
| 016 Category boosts | Sound | `lib/draftDashboard/categoryBoosts.ts:4` | — | — | Draft Pro · conditional |
| 017 Team category totals and ranks | Mis-specified | Aggregation from components is right (`lib/draftDashboard/categoryStandings.ts:58-110`, `:122-240`). Direction ignores the provider sign (`:263-268`): cited, BATCH-BC W1-12 D6 | Decision 55 | Cited | Standings · live |
| 018 Pick arithmetic | Sound | `lib/draftDashboard/draftOrder.ts:55-95`; `lib/mockDraft/engine.ts:64-73` | — | — | Draft order · live |
| 019 Positional tiers | Sound | `lib/draftDashboard/positionalTiers.ts:14-79`. Exact 1-D k-means; the silhouette terms are right for contiguous groups. The 5%-width split and 1.5/0.5 advice cut-offs are labelled product heuristics (rule 12) | k-means, silhouette | — | Tiers, mock Pro bots · conditional |
| 020 Schedule metrics | Wrong (contract) | `lib/draftDashboard/scheduleMetrics.ts:50`: off-night = 8 or fewer games, fixed | Decision 53 | Cited: BATCH-BC off-night row | Draft schedule columns · live |
| 021 Source accuracy | **Wrong** | `lib/draftDashboard/sourceAccuracy.ts:73-94`; default mode `components/DraftDashboard/ProjectionSourceAccuracy.tsx:15` | Decision 65 | D1 | Source accuracy panel · live |
| 022 Source rank impact | Sound | Packet description; exact `=== "G"` test is a minor trap | — | — | Source analysis · live |
| 023 Source blend | Mis-specified | `lib/draftDashboard/sourceWeights.ts:40-58`; `useProcessedProjectionsData.tsx:1080-1137` | Int | D12 | Every projected stat · live |
| 024 Mock bot pick model | Wrong (conditional) | `lib/mockDraft/engine.ts:216-225`, `:253-254` read `config.roster[pos]`; slots use the grouped config (`:74-81`) | Int | D13 | Mock drafts · conditional (ADP RPC not deployed) |
| 025 Roster needs, team VORP | **Wrong** | `components/DraftDashboard/DraftDashboard.tsx:2616-2646`, `:2488-2491` | Int | D5, D3 | Recommendations, summary · live |
| 026 Recommendation score | **Wrong** | `hooks/usePlayerRecommendations.ts:73`; `hooks/useVORPCalculations.ts:253` | VBD, VONA | D2 | Suggested Picks, My Roster · live |
| 027 VORP, VOLS, VONA, VBD | Mis-specified | `hooks/useVORPCalculations.ts:92-106`, `:125-153`, `:216-227`, `:253` | VORP, VOLS, VONA | D2, D3, D4 | Every draft table · live |
| 028 Personalised recommendations | Mis-specified | `lib/draft-pro/recommendations.ts:163-179`, `:119-146` | Int | D5 | Draft Pro, My Roster · live |
| 029 Scenario and report adapters | Mis-specified | Inherits the moving VORP (D3); saved `rawVorp` is not comparable across pick states | Int | D3 | Draft Pro · conditional |
| 030 Availability | Mis-specified | `lib/draftDashboard/availability.ts:13-30`. Survival ratio and tail formula are right. One SD for every ADP, on truncated ADP | A&S 26.2.17 | D7 | Risk column, tiers advice · live |
| 031 Player values, position weights | Mis-specified | `lib/draftDashboard/playerValues.ts:93-98`; `positionWeights.ts:37`; starts fallback `:63-76` | Int | D14 | VORP, tiers, mocks · live |
| 032 84-game pacing | Sound | `lib/projectionsConfig/proration.ts:13`, `:62-81`. 84 is the 2026-27 schedule. Opt-in. Fixture: 399 AG skaters, most already at 84 GP | — | Note in D14 | Points leagues · live |
| 033 Category z-scores | **Wrong** | Cited: [fantasy-scoring.md](fantasy-scoring.md) D2 and D6 (M-FSC-013). Draft-specific reach in D6 below | McGee; decision 62 | Cited | Category leagues · live |
| 034 Roster feasibility | Sound | `lib/mockDraft/feasibility.ts:5-93`. Dinic is right; held flow can't be undone by later augmentation; grouping is valid because `fits` reads positions only | Max-flow | — | Mock drafts · conditional |
| 035 Source weight slider | Sound | `components/DraftDashboard/ProjectionSourceSettings.tsx:46-70`. A lone source set below 1 still has share 1 (`sourceWeights.ts:3-19`) | — | — | Settings · live |
| 036 Source weight migration | Mis-specified | `lib/draftDashboard/sourceControlPreferences.ts:71-93`: migrated percents become fractions; a new default source enters at weight 1 | Int | Up to 3× the share of a migrated 0.33 source | Returning users · conditional |
| 037 Social-share movers | Sound | `lib/socialShare/trends.ts:230-240`. Missing previous value is "no mover", not 0 (rule 5 kept) | — | — | Social share · live |
| 038 Legacy projections page | Mis-specified | Packet description: round = ceil(ADP ÷ 12) for every league | Int | — | Legacy page · dormant |
| 039, 051 Compare modal | Mis-specified | `components/DraftDashboard/ComparePlayersModal.tsx:139-146`, `:151-158`, `:204-209` | Int | D10 | Compare modal · live |
| 040 CSV name match | Sound | `components/DraftDashboard/ImportCsvModal.tsx:130-146`, `:1034-1037` | Levenshtein | — | CSV import · live |
| 041 Mock adapter | Mis-specified | `lib/mockDraft/adapter.ts`: a z-sum is labelled `projectedPoints` in category leagues | Int | Label | Mock drafts · conditional |
| 042 Free-path risk boost | Mis-specified | `components/DraftDashboard/SuggestedPicks.tsx:405-414` | Int | D2 | Suggested Picks · live |
| 043 Goalie sample SD | Sound | `components/GoaliePage/goalieCalculations.ts:146-154` (n − 1) | — | — | Goalie page · live |
| 044 Evidence bands, top-250 admission | Mis-specified | `communityModel.ts:382-392` | Int | D8 | Community ranks · live |
| 045 Order-key health | Sound | `lib/draft-ranker/health.ts:15-50` | — | — | Health check · live |
| 046, 048 Roster grouping, progress | Sound (description-level) | Counting and largest-remainder split (`lib/draftDashboard/forwardGrouping.ts:102-131` read) | — | — | Dashboard · live |
| 047 Player search similarity | Sound | Cited: sql-cross-cut row M-DRF-047 | — | — | Search · live |
| 049, 050 Mock personalities, lookahead, softmax | Sound | `engine.ts:367-399`: softmax over a feasible shortlist is right. Constants are bot behaviour, labelled as personalities, uncalibrated (rule 12). 049 description-level | Int | — | Mock drafts · conditional |

## 3. Defects

Magnitudes are dated samples from the fixture in section 0 (473 players, 2026-11-11) unless stated. They are not population rates (rule 1).

### D1 · Accuracy and diff % compare a full season with a partial one · P0 (M-DRF-021, 010)

- **What.** Actuals are current-season totals. Projections are full-season totals. `calculateSourceAccuracy` in its default "total" mode, the fantasy-point diff % and the round summaries all subtract one from the other.
- **Also.** The error is |projected − actual| ÷ max(|actual|, 0.01), averaged over every stat with equal weight, and the score is 100 minus that, clamped at 0. That is a percentage error, which decision 65 ranks below squared error or deviance, and it explodes on zero actuals.
- **Magnitude (executed).**
  - A source exactly right per game, at 15 of 84 games: mean error 460%, accuracy **0%**. Per-game mode gives 100%.
  - One projected short-handed goal against an actual of 0 is a 10,000% error. Added to 900 good observations it cuts the score from about 93.7 to 82.6.
- **Fix.** Default to like-for-like: per-game rates, or actuals paced to the projected games. Score with squared error per stat (or Poisson deviance for counts), standardised by the stat's spread, and report MAE second. Drop the 0.01 floor. Label total-mode diff % "season to date against full-season projection" or hide it until the season ends.
- **Test.** Identity: a source whose per-game rates equal the actual rates scores the maximum at any games-played count. A zero actual changes the score by a bounded amount.
- **Readers.** Source accuracy panel; projections table diff columns and round summary rows.

### D2 · The recommendation score is dominated by a mislabelled VONA · P0 in draft season (M-DRF-026, 027, 042; C32 confirmed)

- **What.**
  1. Score = 0.7 × VBD + 0.3 × VONA, and VBD = 0.6 VORP + 0.3 VONA + 0.1 VOLS. Expanded: **value − 0.42 × replacement − 0.07 × last starter − 0.51 × next baseline**. C32's weights are right.
  2. The "next baseline" is the player at index (own rank at the position + expected players taken), floored (`useVORPCalculations.ts:219-226`). That is the drop-off below the player. Standard VONA compares him with the best player expected at the manager's next pick, which is negative for anyone who is not the best at his position.
  3. Because the baseline depends on the player's own rank, two players at the same position get different baselines, and a cliff below the worse one can lift him over the better one.
  4. The free path then adds 0.25 × (1 − availability) × VBD, which Pro results don't get, so the two paths rank the same inputs differently.
- **Magnitude (executed).**
  - VONA is never negative. It is exactly 0 for 89 of 473 players at pick 1 with 22 picks to wait, and for 202 of 473 with 11 picks (every defenseman and goalie, because fewer than one is expected to go).
  - Same-eligibility pairs among the top 60 available where the lower-valued player gets the higher score: 10 (pick 1), 25 (pick 37), 47 (pick 85), 21 (pick 133). Largest inverted gap 12 fantasy points. On VBD alone: 3 to 11.
  - At pick 1 with 11 to wait, a 435-point centre ranks above a 438-point centre.
- **Fix.** Define VONA once as value − best expected at the position at the next pick (baseline index = expected taken, the same for every player at the position; interpolate, don't floor). Then pick one blend: either VBD already includes VONA, or the score adds it, not both. The owner sets the weights (question 1).
- **Test.** Dominance: for two available players with identical eligibility, higher value never gets a lower score. VONA of the best player at a position with k expected taken equals value minus the (k+1)th value.
- **Readers.** Suggested Picks, My Roster recommendations, VBD column and bands, Draft Pro recommendation candidates.

### D3 · Replacement level moves during the draft · P1 (M-DRF-027, 025, 005, 029)

- **What.** The dashboard passes `baselineMode: "remaining"` by default and never personalises the global metrics (`DraftDashboard.tsx:588-590`, `:2332-2347`). The replacement index stays at teams × (starters + UTIL share) while the pool it indexes shrinks (`useVORPCalculations.ts:125-153`). The intent was a remaining-pool baseline; the index needed to shrink with the slots already filled.
- **Magnitude (executed).** Replacement value by players taken (0, 48, 96, 144, 192): C 273, 239, 204, 177, 164; D 165, 160, 156, 147, 143; G 199, 192, 174, 138, 135. The 30th defenseman's VORP: 34, 39, 43, 52, 56. "Full" mode stays at 273 / 165 / 199.
- **Effect.** VORP inflates as the draft goes on and unevenly by position. Already-drafted players' VORP changes after the pick, so team VORP, "top VORP pick" and the draft-winner score (60% points, 40% team VORP, `DraftSummaryModal.tsx:258-277`) depend on when you look. Saved Draft Pro scenarios aren't comparable over time.
- **Fix.** Freeze each drafted player's VORP at the full-pool baseline for team totals and awards. For the live board, either use the full-pool baseline or reduce each position's index by league-wide filled starter slots. The optional "personalised" mode subtracts *my* filled slots × teams (`:127-135`), which assumes every team is built like mine; use real league fills.
- **Test.** A drafted player's stored VORP is unchanged by later picks. Remaining-pool replacement at the end of a full draft equals the best undrafted player.

### D4 · Per-position pools overstate forward replacement; bench and UTIL rules are undocumented · P1 (M-DRF-027)

- **What.** Each multi-position forward sits in every pool he is eligible for (`forwardGrouping.ts:133-158`), and each pool is cut at its own index. UTIL is split one third each to C, LW and RW and never to D (`useVORPCalculations.ts:61`, `:95-105`). Bench slots are ignored.
- **Magnitude (fixture).** 149 of 285 forwards are multi-eligible, so the C, LW and RW pools hold 149, 150 and 152 players. Replacement comes out at 273 / 267 / 273. Filling 84 forward starter slots (12 × 7) from one forward pool gives 247: forward VORP is understated by 20 to 26 points. Result: top defenseman VORP 170 against top centre 165, and 7 of the top 12 by VORP are defensemen. On the pooled baseline the centre leads 191 to 170.
- **Caveat.** Positions here are the projection table's strings, not Yahoo eligibility. Real Yahoo eligibility may have fewer multi-position players.
- **Fix.** Compute replacement by an assignment (fill C, LW, RW, D, G, then UTIL from the best remaining skater) rather than independent pools. State the bench rule: decision 62 asks for "rostered positions, slots, bench, goalie requirements".
- **Test.** The number of players above replacement across positions equals the number of starting slots in the league.

### D5 · Need weighting is unscaled · P1 (M-DRF-025, 028)

- **What.**
  1. `recommendationScore = rankScore + alpha × fit × max|score in pool|` (`recommendations.ts:172-179`), alpha default 0.5. The scale is the single best player, not the spread among realistic picks.
  2. Category needs are `max(0, league mean − my total)` in raw counts for six hard-coded skater categories (`DraftDashboard.tsx:2620-2646`). `categoryFit` multiplies those by z-scores and its comment says callers pass normalised pressure (`recommendations.ts:137-139`). Hits and shots (hundreds) outweigh power-play points (tens); goalie categories and any other league category never register.
  3. The category z-scores for fit come from the candidate pool, a different population from the league valuation (`:163-168`).
- **Magnitude (executed, points league, 60 taken).** Best score 62.4; 10th 39.7; 25th 31.6; 50th 21.0. Boost at full fit: 31.2, the whole gap between 1st and 25th. With needs C 0, LW 0.5, RW 1, D 0.75, G 1, the best centre goes from 19th to 97th. Item 2 was read, not executed.
- **Reach.** Suggested Picks' free path forces need weighting off (`SuggestedPicks.tsx:311`). My Roster passes the toggle, and the Draft Pro endpoint uses it.
- **Fix.** Scale the boost by a robust spread (for example the score gap across the next round of picks). Express each category need as a standardised gap (my total against the league spread) for every scored category, by direction (decision 55).
- **Test.** With alpha at its default, a player 3 rounds worse never passes one who fills no need. Doubling the unit of a category (hits counted in pairs) changes no rank.

### D6 · Category leagues: draft readers of the z-score defects · P1 (M-DRF-033, 031, 017, 005, 006)

Cited, not re-audited: fantasy-scoring D2 (whole-pool z, shrink against unshrunk SD, missing = average) and D6 (direction). What this packet adds:

- The pool is every projected player passed in, drafted or not (`playerValues.ts:44-87`), so decision 62's league-aware pool is not met in VORP, tiers or mocks.
- Standings value in category leagues is the **mean** z-sum per rostered player (`LeagueStandings.tsx:58-75`, `roundRankHistory.ts:37`), so adding any below-average bench player lowers a team's standing.
- The draft winner still uses fantasy points in category leagues (`DraftSummaryModal.tsx:258-277`).
- The Score tooltip says "percentile-weighted composite (0–100)" (`ProjectionsTable.tsx:1269-1271`); the value is a weighted z-sum.
- Position weights multiply a signed z-sum (`playerValues.ts:93-98`), so a weight above 1 pushes a below-average player further down.

Fix and test follow fantasy-scoring D2; add "team category value is a sum over starting slots" and correct the tooltip.

### D7 · Availability rests on truncated ADP and one spread · P2 (M-DRF-030, 008)

- **What.** The survival ratio S(later) ÷ S(now) and the tail approximation are right. The model gives every player the same SD of 12 picks, and Yahoo ADP only exists for drafted players.
- **Magnitude.** DB sample 2026-11-11, `yahoo_players` season 2026: 1,611 rows, 300 with an ADP, maximum 158.0, median 130.1. So half the players with an ADP sit between 130 and 158. Executed: ADP 158 at pick 200 with 11 picks to wait gives 2.3% available, although such a player has by definition lasted 42 picks past his ADP. Players with no ADP return null (unknown kept unknown).
- **Label.** The code says "ADP heuristic… not a calibrated room forecast" (`availability.ts:20`), which is honest.
- **Fix.** Let the spread grow with ADP and fit it to draft results when mock or league data exists; cap or flag the estimate once the pick is well past the ADP range. Until then keep the heuristic label on the risk column.
- **Test.** Algebraic: zero opposing picks returns 1; the ratio is monotone in opposing picks. Calibration needs held-out drafts (rule 11).

### D8 · Community ranking: prior scale and admission · P2 (M-DRF-012, 044)

- **What.**
  1. The prior mean is ln((F + 1 − r) ÷ r) with F = the larger of the candidate count and the highest ADP (`communityModel.ts:120-124`, `:261-266`). Candidates are every player identity (`communityServer.ts:157-215`): 4,378 by table statistics, against at most 300 ranked. Ranked players are squeezed into a narrow band of the scale.
  2. Top-250 admission: a market-ranked player stays in until he is "established", then must clear model rank + stability buffer ≤ 250 (`:382-392`). Gaining evidence can remove a player near the cut-off while unreviewed neighbours stay.
- **Magnitude (algebra, not executed).** With prior weight 4 and ridge 0.25, one comparison moves each player about 0.11 in score. Near rank 150 the prior spacing is about 0.0065 per rank at F = 4,378, so about 17 ranks; at F = 300 it would be about 8. At 20 users the smallest buffer is about 17 ranks.
- **Fix.** Set F to the ranked field. Decide whether admission should be monotone in evidence (question 4).
- **Test.** Adding unranked candidates with no comparisons changes no ranked player's order or score gap.

### D9 · Steals and reaches use raw pick differences · P2 (M-DRF-005)

Pick − ADP in absolute picks (`DraftSummaryModal.tsx:202-236`). Late rounds have the widest spread, so the "biggest steal" is nearly always a late pick. Fix: divide by an ADP-dependent spread, or compare rounds. Not measured.

### D10 · Display percentiles · P2 (M-DRF-006, 039, 051)

- Value and VBD colour bands are computed over the filtered, sorted view (`ProjectionsTable.tsx:924-975`), so a filter changes a player's colour.
- Compare modal: a missing stat is drawn at the 50th percentile and a missing per-game rate as 0 (`ComparePlayersModal.tsx:151-158`, `:204-209`), against rule 5. The pool mixes skaters and goalies. Lower-is-better stats top out at 100 − 100/n while higher-is-better reach 100.
- Fix: band over the undrafted pool at the player's position; show "no data".

### D11 · Default weights are not labelled · P2 (M-DRF-009; decision 54)

No "FHFH default" text exists under `components/DraftDashboard` (grep, 2026-11-11). Decision 54 requires the label, the active scoring source and a flag for unmappable league categories. Fix: add the label and source line next to the weights.

### D12 · Source blend averages rates and renormalises per stat · P2 (M-DRF-023)

Each stat is a weighted mean over the sources that have it (`sourceWeights.ts:40-58`). SV%, GAA and TOI per game are averaged directly, and a player's goals and assists can come from different source mixes, so points need not equal goals + assists. Team category totals already rebuild rates from components where they can (`categoryStandings.ts:160-230`). Fix: blend counting components, derive rates, and flag partial coverage. Not measured.

### D13 · Mock bots under forward grouping · P1 when mock drafts ship (M-DRF-024)

- **What (read, not executed).** With `grouping: "fwd"` and a roster keyed C/LW/RW (the schema allows it, `lib/mockDraft/contracts.ts:27-38`), players carry position `FWD` but `config.roster.FWD` is undefined. The replacement baseline index becomes 0 (the best forward), and every forward already held counts as surplus at −0.25 each (`engine.ts:216-225`, `:253-254`). Slots are built from the grouped config (`:74-81`), so the two disagree.
- **Fix.** Read the effective roster config in both places. **Test.** A bot in a grouped league and one in the equivalent split league value the first forward pick alike.
- The remaining constants (0.28, 0.22, 0.15, temperatures) are uncalibrated bot behaviour; keep them labelled as such (rule 12).

### D14 · Smaller items · P2

- **Goalie starts fallback** uses games played when starts are missing (`playerValues.ts:63-76`), feeding the GAA shrink in M-DRF-033.
- **Pacing list** omits scorable keys such as game-winning goals and defense points (`proration.ts:17-33`), so a league that scores them gets a part-paced total. Pacing a 20-game projection to 84 removes injury and role risk; it is opt-in.
- **Position weight** takes the highest weight across a player's eligible positions (`positionWeights.ts:37`).
- **Discovery** compares an ADP pick number with a projection rank (`discovery.ts:262-285`), and the projection branch of the opportunity signal is dead (`discoveryServer.ts:374`).
- **Source-weight migration** (M-DRF-036) and the dormant 12-team round rule (M-DRF-038).

## 4. Owner questions (not answered by decisions 1–68)

1. **Recommendation blend.** Once VONA is fixed, what should the score be: VORP only, or VORP plus a stated share of VONA? The current effective 51% on VONA was not chosen by anyone.
2. **Replacement level.** Fixed full-pool baseline, or a remaining-pool baseline that tracks league fills? And do bench slots count toward replacement depth?
3. **UTIL.** Should UTIL go to the best remaining skater including defensemen, rather than a fixed third each to C, LW and RW?
4. **Community top 250.** Should gaining evidence ever remove a player from the public list, or should admission only tighten for players the market does not already rank?
5. **Draft winner in category leagues.** What should replace fantasy points there: summed category value, or projected category ranks?
6. **Source accuracy.** Which stats count, and with what weights: all stats equally, or the league's scored stats?

## 5. Not defects, for the record

- `NHL_REGULAR_SEASON_GAMES = 84` is right for 2026-27.
- The Dinic feasibility check, k-means tiers, snake arithmetic and the Bradley-Terry gradient are correct.
- No deletion is proposed for any legacy path (rule 6).

## 6. Limits

- **Fixture, not production replay.** Values are real projections from one skater source and one goalie source under FHFH default weights; ADP is synthetic. Counts of inversions and rank moves are for this fixture and league shape only.
- **Not executed:** D5 item 2, D8, D9, D12, D13. They are code readings with algebra where shown.
- **Description-level only:** M-DRF-015, 046, 048, 049, and the unread parts of 006, 013, 022, 038, 041.
- **Table statistics are stale.** `pg_stat_user_tables.n_live_tup` showed 0 for the draft-ranker and projection tables that exact counts show are populated. Only the exact counts below are evidence; the 4,378 identity figure is a statistic, not a count.
- **No Yahoo eligibility.** The Yahoo join in Q4 matched nothing (cause not investigated), so multi-position rates use projection-table positions.
- No jsonb was read. No NST, NHL or Yahoo calls. `pg_stat_activity` showed 1 active query before the reads.

**Queries (2026-11-11, project `fhfhockey.com`, read-only)**

- Q1 activity: `select count(*) filter (where state='active'), max(now()-query_start) … from pg_stat_activity`.
- Q2 catalog: `pg_tables` where name ilike '%mock%' (none); `pg_proc` where name ilike '%mock_draft%' or '%draft_ranking%' (four draft-ranking functions, no mock).
- Q3 ADP: `select season, count(*), count(*) filter (where average_draft_pick>0), max(average_draft_pick), percentile_cont(0.5) … from yahoo_players group by season` → 2025: 1,494 / 320 / 192.0 / 131.6; 2026: 1,611 / 300 / 158.0 / 130.1; null season: 1,333 / 191 / 192.0 / 96.0.
- Q4 exact counts: `draft_ranker_pair_preferences` 947, `draft_rankings` 87, `draft_ranking_entries` 27,226, `fhfh_player_external_identities` 7,955, `draft_ranker_community_snapshots` 71, `draft_ranker_discovery_signals` 0; `PROJECTIONS_20262027_CULLEN_SKATERS` 318, `…_AG_SKATERS` 399, `…_DTZ_GOALIES` 74.
- Q5 fixture: from `PROJECTIONS_20262027_AG_SKATERS`, `"Position"` and 3·Goals + 2·Assists + PP_Points + 0.2·Shots_on_Goal + 0.2·Hits + 0.25·Blocked_Shots; from `PROJECTIONS_20262027_DTZ_GOALIES`, 'G' and −Goals_Against_Goalie + 0.2·Saves_Goalie + 3·Shutouts_Goalie + 4·Wins_Goalie; rounded to whole points, ordered by value descending (473 rows).
- Q6 column types: `information_schema.columns` for `wgo_skater_stats_totals.toi_per_game` (double precision) and `wgo_goalie_stats_totals.save_pct` (numeric).

**Scratch script (not in the repo).** A Vitest file run from `web/__tests__/` and then deleted. To re-run:

1. Build players from Q5: id = row order, `displayPosition` and `eligiblePositions` from the position string, `fantasyPoints.projected` = value, empty `combinedStats`.
2. Synthetic ADP = value rank + (2 + 0.08 × rank) × a standard normal draw from a linear congruential generator seeded 20261111 (Box-Muller); keep ADP for the 300 lowest, null for the rest.
3. Draft state "k taken" removes the k lowest-ADP players. Call `useVORPCalculations` through `renderHook` with the league in section 0, `picksUntilNext` 11 or 22, default baseline mode.
4. M1 prints `replacementByPos` at k = 0, 48, 96, 144, 192 and one defenseman's VORP. M2 counts, among the 60 highest-valued available players, pairs with identical `displayPosition` where higher value has lower `baselineScore` from `buildRecommendationCandidates` (and lower `vbd`). M4 calls `buildPersonalizedRecommendations` at k = 60 with alpha 0 and with alpha 0.5 and needs {C 0, LW 0.5, RW 1, D 0.75, G 1}. M5 calls `calculateSourceAccuracy` on hand-built players (84-game projection against 15 games at the same rates; a 1-against-0 short-handed goal). M6 calls `estimatePlayerAvailability` at the ADP and pick pairs quoted in D7.
