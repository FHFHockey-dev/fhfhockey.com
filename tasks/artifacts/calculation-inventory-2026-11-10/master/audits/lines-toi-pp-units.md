# Audit W2: Lines / TOI / PP units (M-LINE-001 to 043)

Auditor: Claude (Fable), 2026-11-11, `octoberBranch` at `3e81061cb`. Audit only: no code, migration, cron or deployment was changed. Packet: [../packets/lines-toi-pp-units.md](../packets/lines-toi-pp-units.md).

## 0. Brief (written before the audit)

TRIAGE gives this packet one line: "PP units are TOI rank slices, not co-deployment; PP timing assumes 20-minute periods; penalty code mapping is a no-op." Section 4 lists no owner-intent gap for this family, so intent comes from code comments, decision 59 and the upstream audits.

**Questions**

1. Is "power-play time" one quantity on this site? Three producers exist: the penalty-box simulation (`getPowerPlayBlocks`), the PBP situation-code split (`strengthForTeam`), and the legacy per-penalty rows (`pp_timeframes`). Which readers use which, and how far apart are they?
2. Are PP1/PP2 labels in `powerPlayCombinations` observed co-deployment or a ranking artefact? What do the tallies, trend chips and rankings rows inherit?
3. Are stored line combinations (all-strength greedy clustering) the lines a reader would recognise from 5v5 deployment?
4. Do "% TOI with" figures share one denominator across the shift-charts route and the Date Range Matrix?
5. Does the ES/PP/PK split meet decision 59 (mutually exclusive, reconciles to total TOI, OT and extra-attacker defined, unknown explicit)?
6. Are the three triage claims true as stated?
7. Are the lineup-source heuristics (confidence, authority, thresholds) labelled honestly as heuristics rather than probabilities?

**Reference standards** (by name; no invented citations)

- NHL play-by-play `situationCode` (away goalie, away skaters, home skaters, home goalie) and the NHL rulebook's penalty rules (minor ends on a power-play goal, major does not, coincidental penalties, at most two served at once).
- NHL.com boxscore team power-play time on ice, as stored in `teamGameStats.powerPlayToi`. This is the oracle used for the PP clock.
- Natural Stat Trick conventions: PP TOI% = player PP TOI / team PP TOI; line and pair "TOI together" at 5v5 in clock seconds; strength states that keep empty-net and 4v4 apart.
- Daily Faceoff / LeftWingLock: line cards as slot grids with confirmed vs projected labels and PP1/PP2 as named five-man units.
- NHL goaltending statistics: SV% = saves / shots against, GAA = goals against x 60 / minutes, both pooled over the span.
- Standard American-odds conversion and proportional de-vig (already audited in W1-10).
- Standard precision and recall for extraction evaluation.

**Fixtures and data**

- Repo tests and fixtures named in the packet; four focused Vitest files were run.
- Bounded read-only production reads of `powerPlayCombinations`, `forge_player_game_strength`, `teamGameStats`, `team_unit_toi`, `lineCombinations`, `nhl_api_shift_rows` for regular-season game ids 2026020001 to 2026020260. No jsonb column was read.

**Done-criteria**

Every entry has a verdict with file:line evidence; each of the three triage claims is confirmed or refuted; each defect has a fix, a test and a reach label (live, conditional, dormant, research); magnitudes are dated samples with their size; entries already audited upstream are cited, not redone.

## 1. Summary

**Verdict counts (43 entries):** sound 20 · mis-specified 16 · wrong 7 · undetermined 0.

Wrong: M-LINE-001, 019, 022, 034, 035, 037, 038. Two pairs are the same code under two ids (019/034, and 002/004 among the mis-specified), and 037/038 are one defect, so the seven are five distinct defects.

**The three triage claims**

| Claim | Result |
|---|---|
| "PP units are TOI rank slices, not co-deployment" | **Half right.** `sortByPPTOI` picks the highest-PP-TOI skater as a pivot and takes the five with the most shared PP time with that pivot (`web/components/LinemateMatrix/index.tsx:555-603`). It is a co-deployment heuristic, not a rank slice. The inventory text for M-LINE-021 and the comment at `web/lib/socialShare/trends.ts:148-149` describe it wrongly. The real weaknesses are the fixed size of five and no minimum time. |
| "PP timing assumes 20-minute periods" | **Refuted for the current code.** Blocks and the writer's cross-period arithmetic share one 1,200 s-per-period axis (`web/utils/getPowerPlayBlocks.ts:300-314`, `[gameId].ts:141-152`), and regular-season overtime starts at 3,600 s on that axis. Measured against NHL.com team PP time: 488 of 501 team-games within 5 s. |
| "Penalty code mapping is a no-op" | **Confirmed, but dormant.** `playTypeKeyToCode` receives `MIN`/`MAJ` and returns `""` (`web/utils/extractPPDetails.ts:81-83,204-214`). The only reader of `pp_timeframes` reads game scores, not the PP rows (`web/lib/game-predictions/evaluation.ts:439-442`). |

**Top 5 findings by user impact**

1. **FORGE "PP TOI" overstates power-play time by about a fifth, and readers divide it by NHL PP time** (M-LINE-037/038, 019/034, 033). Sample of 316 team-games (ids 2026020101 to 2026020260, read 2026-11-11): skater PP player-seconds per NHL PP second were 5.96 from `forge_player_game_strength.toi_pp_seconds` against 4.97 from the penalty-box simulation; five is the ceiling. In 77 of the 316 team-games at least one skater's FORGE PP time exceeded his team's whole NHL PP time, which the TimeOnIce chart then caps at 100%. This extends W1-6 D15 with the magnitude it left open.
2. **Line-card goalie SV% and GAA are averages of per-game ratios** (M-LINE-022). A full shutout plus a 10-minute relief appearance (1 save on 3 shots) shows .667 and 6.00 where the pooled figures are .939 and 1.71. A missing game outcome counts as a win.
3. **Stored "lines" come from all-strength shared ice time** (M-LINE-009, 020, 031, and everything that reads `lineCombinations`). In 320 team-games the stored first line equalled the most-used 5v5 trio 217 times (68%), and that trio was neither stored line 1 nor line 2 in 50 (16%). The top stored pair equalled the top 5v5 pair 224 times (70%). The definitions differ by design (highest-TOI pivot against most-used trio), so this measures disagreement, not an error rate.
4. **PP unit labels carry no minimum time and force five skaters per unit** (M-LINE-012, 021, and readers 002/004, 016, 042). In 501 team-games, 153 of 2,366 "unit 2" rows (6.5%) had under 20 seconds of PP time. The tallies count each as a game "on PP2"; the trend card can read the flip as a promotion or demotion.
5. **"% TOI with" has two denominators under one name** (M-LINE-008, 020, 031): game length in `shift_charts.percent_toi_with`, the player's own TOI in the Date Range Matrix. Both are all strengths, and `shift_charts.es_shifts` contains penalty-kill time.

**Good news worth recording.** The penalty-box simulation rewritten on 2026-11-01 (`d793446f9`) reproduces NHL.com team PP time, and the stored rows were backfilled: 420 of 433 team-games before 11-01 and 68 of 68 from 11-01 are within 5 s. The 10:00-against-2:54 Ottawa case recorded at `web/lib/socialShare/modules/lastNightsStandouts.ts:104-108` describes the old code. Nine team-games before 11-01 are still more than 60 s off.

## 2. Per-entry table

Reach labels follow rule 8: live, conditional, dormant, research. "Sample A" is the PP clock check, "Sample B" the FORGE PP check, "Sample C" the line check (section 5).

| ID | Verdict | Evidence | Reference | Magnitude | Downstream / reach |
|---|---|---|---|---|---|
| 001 `vw_pp_unit_share_recent` | **Wrong** | Audited in [sql-cross-cut](sql-cross-cut.md) row M-LINE-001 and W1-3 D18: denominator is summed player PP seconds; `percentageOfPP` above 1 is divided by 100 | NST PP TOI% | Share tops out near 0.2 | Dormant: no reader |
| 002 deployment tallies (SQL) | Mis-specified | Audited in sql-cross-cut D7. Adds here: the PP group inherits unit labels with no time floor (row 012) | Daily Faceoff slot grids | See sql-cross-cut; plus 6.5% of unit-2 rows under 20 s (Sample A) | Live: player page, starter board, draft ranker, `season.py` |
| 003 DRM line builder | Mis-specified | `web/components/DateRangeMatrix/lineCombinationHelper.ts:21-33`: weights 4/3/2/1 and 3/2/1 are unexplained; `:56-66` falls back from shared seconds to a percentage in the same sort | Line usage frequency | Not measured | Live: `/drm` |
| 004 deployment tallies (route) | Mis-specified | Same function as 002 | — | — | Live |
| 005 Beat-reporter confidence | Sound | `web/lib/lines/beatReporterInference.ts:91-97,151-166`: share x log volume, documented as a 0–1 heuristic (`:41`) | — | — | Live: admin review only |
| 006 American odds | Sound | `web/lib/sources/oddsSourceIngestion.ts:270-276`; vig included by design. Duplicates are W1-10 D9 | Standard conversion | — | Live: odds ingestion |
| 007 Trainer confidence | Sound | `web/lib/sources/tweetSwipeTrainer.ts:548-640`: additive penalties and caps, bounded 0–100, each penalty listed to the reviewer. Uncalibrated, and not presented as a probability | — | — | Live: review tooling |
| 008 DRM aggregation | Mis-specified | `web/components/DateRangeMatrix/fetchAggregatedData.ts:1203-1227`: `percentToiWith` = shared / own TOI; `percentOfSeason` = shared / summed game length of the window, not the season. Source seconds are all strengths | NST "TOI% with" at 5v5 | Not measured | Live: `/drm`, team pages |
| 009 Linemate matrix and `lineCombinations` | Mis-specified | `web/components/LinemateMatrix/index.tsx:517-553`: pivot = highest total TOI, mates by all-strength shared seconds. Goalies stored in boxscore order (`update-line-combinations/[id].ts:112-126`). Overflow lead refuted: JS arrays grow, and PP arrays read undefined as "not PP" (`utilities.ts:81-96`) | NST 5v5 line TOI | Sample C: L1 = top 5v5 trio in 217/320; top trio in neither L1 nor L2 in 50/320; D1 match 224/320 | Live: `/lines`, tallies, FORGE goalie prior, Discord webhooks |
| 010 Replay model | Sound | `web/components/ShiftChart/model.ts:132-141,337-343,387-413`: merged half-open intervals; PP mode intersects with own-team blocks; goalies excluded | NHL shift charts | — | Live: `/shiftChart` |
| 011 Exact-five PP units | Sound | `web/lib/exactFivePp/exactFivePpUnits.ts:213-232` classifies with goalie digits and keeps unknown seconds explicit; 30 tests pass. Merge lead not examined | NST PP unit TOI | — | Research: no production caller |
| 012 PP unit assignment and usage | Mis-specified | Units: `LinemateMatrix/index.tsx:555-603`, `[gameId].ts:176-180`. `percentageOfPP` is the unit index (`powerPlayCombinationMetrics.ts:39-40`; W1-3 D18). `pp_share_of_team` is sound (`:61-64`) | NST PP TOI% | Sample A: implied team PP time within 5 s of NHL in 488/501; unit-2 rows under 20 s: 153/2,366 | Live: rolling `pp_share_pct`, tallies, PowerPlayCombos, rankings, social share |
| 013 `team_unit_toi.unit_share` | Sound | sql-cross-cut row M-LINE-013 | — | — | Live |
| 014 DRM cell shade | Mis-specified | `web/components/DateRangeMatrix/index.tsx:543-545`: opacity = share x 1.5, so every pair above 66.7% looks the same; mixed share silently replaces a zero same-position share. `:299-305` divides by roster length with no guard and the result is unused | — | Presentation only | Live: `/drm` |
| 015 Trainer tone bands | Sound | `web/components/TweetSwipeTrainer/TrainerCard.tsx:56`; duplicate of the library constant | — | — | Live |
| 016 Social-share deployment | Mis-specified | `web/lib/socialShare/trends.ts:151-173,206-226`: PP step compares unit labels from 012. The "L5 / 5" lead is refuted: the row needs 10 season games (`:209`). L5 overlaps the season baseline, which is stated | — | Not measured per card; exposure is the 6.5% above | Live: social-share trend layer |
| 017 Shadow adapter budget | Sound | Inventory description only; I did not re-derive `adapter.mjs` | — | — | Conditional on `config.enabled` |
| 018 Identity evaluation | Sound | Counts only, no rate published (inventory description; not re-derived) | Entity-linking precision/recall | — | Research |
| 019 `/api/toi` series | **Wrong** | `web/pages/api/toi.ts:136-154`: numerator is FORGE `toi_pp_seconds` (situation-code split), denominator is NHL team PP time; capped at 100; missing FORGE row becomes 0 | NST PP TOI% | Sample B: 77 of 316 team-games have a skater above his team's NHL PP time | Live: TimeOnIce chart |
| 020 Shift-chart overlap and lines | Mis-specified | `web/pages/api/v1/db/shift-charts.ts:919-962`: all-strength overlap; `:952-955` divides by game length. Lines by total TOI pivot (`:455-500`). Local `getPairwiseTOI` gets one player's shifts and its result is never used (`:382-411,966-978`) | NST 5v5 TOI together | See Sample C for the same method on `lineCombinations` | Live: `shift_charts` → DRM, FORGE |
| 021 PP assignment (second inventory entry) | Mis-specified | Same code as 012. Inventory method text ("top 5 by PP TOI") is wrong | — | — | Live |
| 022 Line changes and goalie card | **Wrong** | `web/components/LineCombinations/utilities.ts:517-528`: SV% and GAA are means of per-game ratios, divided by `stats.length` even when a row is skipped at `:520`; `:523` counts a missing outcome as a win, and the team's result is credited to any goalie who appeared. Query-order lead refuted (`:256`) | NHL SV% and GAA, pooled | Fixture arithmetic: .667 / 6.00 shown against .939 / 1.71 | Live per inventory: `/lines/[abbreviation]` GoalieCard |
| 023 Authority weights | Sound | `web/lib/lines/authority.ts:46`: ordinal tiers used lexicographically (`reconcile.ts:83`), so only the order matters. Aggregator = unknown = 1 is an owner rule (`:5-44`) | Team > beat > aggregator | — | Live |
| 024 Claim decision | Sound | Categorical policy with fixture cases (inventory description; not re-derived) | Confirmed vs projected | — | Live |
| 025 PP carry-forward | Sound | `web/lib/lines/reconcile.ts:158-175`: swap applied only when it fits; three-game staleness is a stated policy constant | — | — | Live |
| 026 Entry selection | Sound | `reconcile.ts:71-90`: context, then authority, then recency; equal-rank disagreement is a conflict, not a pick | Warmup > skate > practice | — | Live |
| 027 Injury confidence | Sound | Ordinal labels from phrase rules (inventory description; not re-derived) | — | — | Live |
| 028 First arrival | Mis-specified | `web/lib/sources/lineSourceFirstArrival.ts:40-47`: compares post time for some rows with our observation time for others | — | Not measured | Live: timing reports |
| 029 Claim precision/recall | Sound | `web/lib/sources/tweetClaimEvaluation.ts:49-76`: micro-averaged TP/FP/FN over single-label documents; null when undefined | Standard precision/recall | — | Research |
| 030 News auto-publish gate | Mis-specified | `web/lib/sources/tweetNewsInference.ts:271-276`: fixed thresholds on a model's self-reported confidence, with no calibration evidence in the repo | — | Not measured | Live: news automation |
| 031 Shift-chart pairs (route) | Mis-specified | Same code as 020. `:868-876`: `es_shifts` holds every non-PP interval, so it includes penalty kill. The route's own ES total is not stored (`shiftChartRelationshipPayload.ts:5-38`), so `total_es_toi` comes only from the ingest path | Decision 59 | — | Live |
| 032 PP TOI% chart bands | Sound | `web/components/PlayerPPTOIPerGameChart/PPTOIChart.tsx:391-400`: presentation thresholds; each segment takes the earlier point's colour | — | — | Live |
| 033 PowerPlayCombos card | Mis-specified | `web/components/PowerPlayCombos/PowerPlayCombos.tsx:475-503`: games counted from NHL rows; PP shots and PP TOI from FORGE rows that may be missing; FORGE PP TOI is the inflated one | — | Sample B: unit-1 skaters average +25 s per game in FORGE against the simulation (n = 1,561; median +3, 90th percentile +97) | Live: `/lines`, game pages |
| 034 `/api/toi` (second entry) | **Wrong** | Same code as 019 | — | — | Live |
| 035 `pp_timeframes` | **Wrong** | `extractPPDetails.ts:81-83,204-214`: type code maps to `""`, so no power play ends on a goal; `:74-90` ignores the block's own end and uses the nominal penalty length; `:139-178` writes a cross-period power play three times; misconducts with duration ≥ 2 count (`getPowerPlayBlocks.ts:200-202`); regular season only (`powerPlayTimeFrame.ts:61`) | NHL penalty rules | Not measured: the column is jsonb | Dormant for the PP rows: the one reader takes scores only (`evaluation.ts:439-442`) |
| 036 PP blocks (simulation) | Sound | `web/utils/getPowerPlayBlocks.ts:317-473`: per-second penalty box, minors end on an advantaged goal, majors run, same-stoppage cancelling, two served at most, shootout excluded | NHL rules; NHL.com team PP TOI | Sample A: 488/501 within 5 s; 9/433 before 11-01 over 60 s; 0/68 after | Live: PP writer, matrix PP mode, replay shading |
| 037 ES/PP/PK split | **Wrong** | Audited as W1-6 M-FRG-058 / D15: raw skater counts make 6v5 a power play (`web/lib/projections/ingest/shifts.ts:112-124`). The three buckets do reconcile to shift length | NHL `situationCode`; decision 59 | Sample B, new: 5.96 against 4.97 skaters per NHL PP second; median team excess 34 s, 90th percentile 162 s | Live: `shift_charts` totals, FORGE strength tables, rolling PP fallback |
| 038 Situation timeline | **Wrong** | Same defect: a segment keeps the last event's code until the next event (`shifts.ts:262-290`); W1-2 D8 | — | Included in Sample B; not separated from the 6v5 effect | Live |
| 039 On-ice attribution | Sound | Audited as W1-2 M-NST-024 | NST attribution | See W1-2 | Live: xG features |
| 040 Shift stints | Sound | Audited as W1-1 M-XG-056 and W1-2 M-NST-029. Note: a boundary second always resolves to the outgoing players (`nhlShiftStints.ts:270-286`), which suits goals and penalties but not faceoffs | — | Not measured for faceoffs | Live |
| 041 5v5 lines and pairs | Sound | `web/lib/rankings/teamUnitToiBuilder.ts:288-327`: a segment counts when both teams have five skaters and the team has exactly 3F + 2D; seconds are pooled player-seconds and labelled so (`:254`). Goalie presence is not checked | NST 5v5 line TOI | Sample C: mean 2,856 s of qualifying 5v5 clock per team-game; home/away gap mean 20 s, max 478 s; no partial coverage in 320 | Live: rankings team matrix |
| 042 PP unit rows | Mis-specified | `teamUnitToiBuilder.ts:407-432`: sums PPTOI by stored unit label; the pool is player-seconds including unit 3 | NST PP unit TOI | Inherits 012 | Live: `teamMatrix.ts:909-915` |
| 043 Cleanup and nightly plan | Mis-specified | `web/lib/rankings/teamUnitToiNightly.ts:47-62`: a game is "complete" when each team has a top line and a top pair, whatever the coverage | — | Sample C found no partial rows; the 478 s gap game still counted complete | Live: nightly job |

## 3. Defects

Priorities: P0 = user-visible wrong numbers now.

**D1. FORGE PP TOI is not power-play time, and readers treat it as if it were (P0, live).** M-LINE-019, 033, 034, 037, 038.
- Root cause is W1-6 D15 (one strength classifier; close PP segments at penalty expiry). This audit adds the magnitude (Sample B) and the reader list.
- Readers to fix or relabel, each with its own selection test (rule 4): `web/pages/api/toi.ts:136-154`; `PowerPlayCombos.tsx:475-503`; `lib/splits/splitsServer.ts:676-682,780` (from W1-6); FORGE strength tables; the rolling PP-share fallback.
- Fix for `/api/toi` now, without waiting for D15: take the numerator and denominator from one source. `powerPlayCombinations.PPTOI` with `pp_share_of_team` already matches NHL team PP time. Remove the 100% cap and return null, not 0, when the row is missing (rule 5).
- Decision 59 follow-through: define where 6v5, 4v4, 3v3 and penalty-expiry lag go, with an explicit other/unknown bucket, and never relabel stored rows as true ES or PP.
- Tests: on a frozen fixture with 90 s of `1560` and one minor, team PP player-seconds ÷ 5 equals the simulated PP clock; the `/api/toi` share equals `pp_share_of_team` x 100 for the same game; a missing row yields null.

**D2. Line-card goalie SV%, GAA and record (P0, live per inventory).** M-LINE-022.
- Fix: SV% = Σ saves / Σ shots against; GAA = Σ GA x 3600 / Σ TOI seconds; skip rows consistently in numerator and denominator; a missing outcome is unknown, not a win. Decide whether the record is the team's result in games the goalie appeared in or the goalie's own decision (owner question 3).
- Test: the two-game fixture above returns .939 and 1.71; a game with no outcome leaves the record unchanged and is flagged.

**D3. Line combinations use all-strength shared time (P1, live).** M-LINE-009, 020, 031, and readers 002/004.
- Fix: cluster on 5v5 shared seconds. `team_unit_toi` already holds observed 5v5 trios and pairs from the same shift rows. Keep the stored all-strength arrays and add the 5v5 result alongside them (rule 6), then move readers one at a time.
- Readers: `/lines`, `player_lineup_deployment_tallies`, FORGE line-combo goalie prior, Discord webhooks, social-share line chips, DRM line counts.
- Test: on a frozen game where a PP1 forward shares more total time with his PP mates than with his 5v5 wingers, line 1 is the 5v5 trio. Do not assert a match rate; 68% is a dated sample.

**D4. PP unit labels (P1, live).** M-LINE-012, 021, 042, and readers 002/004, 016.
- Fix: keep the pivot method but add a minimum PP time (or share of team PP time) for unit 1 and 2 membership, and send the rest to an explicit "incidental" label. The threshold is a parameter to validate against `lib/exactFivePp` observed five-man groups, not a value to assert (rule 12). Correct the method description in `trends.ts:146-150`.
- Test: a skater with 5 s of PP time in a game is not on PP2 in the tallies and produces no PP step on the trend card.

**D5. "% TOI with" has two definitions and `es_shifts` holds PK (P1, live).** M-LINE-008, 020, 031.
- Fix: name the denominators (`pct_of_game_with`, `pct_of_own_toi_with`), state "all strengths" on the DRM, and rename or split `es_shifts` under decision 59 without rewriting history. Remove the dead `getPairwiseTOI` block in a separate cleanup decision.
- Test: for one fixture pair, both percentages recompute from shared seconds, own TOI and game length.

**D6. `pp_timeframes` rows are wrong (P2, dormant).** M-LINE-035.
- No reader uses the PP rows today, so nothing user-visible is wrong. Either stop computing them or build them from `getPowerPlayBlocks`. No deletion without a dependency inventory (rule 6). The table also stores full play-by-play per game; that is a storage question, not a math one.
- Test if kept: a minor with a power-play goal at 0:45 has duration 45; a power play that crosses a period is written once.

**D7. `vw_pp_unit_share_recent` (P2, dormant).** M-LINE-001. Owned by sql-cross-cut D16 and W1-3 D18.

**D8. Heuristics presented near probabilities (P2).** M-LINE-028 (mixed clocks in first-arrival), M-LINE-030 (thresholds on self-reported confidence), M-LINE-014 (shade saturates), M-LINE-003 (unexplained weights), M-LINE-043 (completeness = a top unit exists).
- Fixes: compare like clocks or mark the bucket "observed only"; measure auto-publish precision per category on adjudicated labels before trusting 0.86–0.95; scale the shade to the displayed maximum; record the weights as presentation choices; require the 5v5 clock to be within a stated tolerance between the two teams before marking a game complete.

## 4. Owner questions (not answered by decisions 1–60)

1. **Which PP clock is canonical?** The penalty-box simulation matches NHL.com team PP time. Should every "PP TOI" and "PP share" on the site use it, with FORGE's strength split kept only as a modelling input under decision 59?
2. **What is a "line"?** Most-used 5v5 trio (NST style), or the all-strength grouping around the highest-TOI forward that is stored today?
3. **Goalie record on the line card:** the team's record in games he appeared in, or his own decisions?
4. **PP2 membership:** is there a minimum (seconds or share) below which a skater is "incidental PP", not PP2? Is a third unit ever shown?
5. **Extra-attacker time for a skater:** under decision 59, does 6v5 go to ES, to its own bucket, or to "other"? Same question for 4v4 and 3v3.
6. **`pp_timeframes`:** keep and repair, or retire once its score reader moves to another table?

## 5. Limits and reproducibility

**Not done**

- No NHL, NST or Yahoo call. The NHL oracle is the stored `teamGameStats.powerPlayToi`.
- `pp_timeframes` contents and all jsonb columns were not read, so D6 has no measured magnitude.
- M-LINE-017, 018, 024 and 027 were judged from the inventory description; their code was not re-derived. M-LINE-011 was judged from its classifier and its passing tests; the interval-merge lead was not examined.
- The 6v5 and penalty-expiry effects inside Sample B were not separated.
- The faceoff note on M-LINE-040 is a reading of the code, not a measurement.
- Sample C compares two different definitions of "line 1"; it bounds disagreement only.
- All magnitudes are dated samples (rule 1), not population rates. The queries below are the manifest; no scratch script exists outside this file.

**Tests run (2026-11-11, `web/`):** `npm test -- lib/exactFivePp/exactFivePpUnits.test.ts lib/rankings/teamUnitToiBuilder.test.ts lib/supabase/Upserts/powerPlayCombinationMetrics.test.ts __tests__/pages/api/v1/db/update-power-play-combinations-game.test.ts` → 4 files, 83 tests passed.

**Database reads (project `fyhftlxokyjtpndbkfse`, read-only, 2026-11-11).** `pg_stat_activity` showed 0 active queries before the reads.

Sample A, PP clock against NHL (game ids 2026020001–2026020260; 501 team-games with a parseable NHL value):

```sql
with pp as (
  select p."gameId" g, f.team_id t, f.game_date d,
         sum(p."PPTOI") player_secs,
         max(case when p.pp_share_of_team>0 then p."PPTOI"/p.pp_share_of_team end) implied_team,
         max(p."PPTOI") max_player,
         count(*) filter (where p.unit=2) n2,
         count(*) filter (where p.unit=2 and p."PPTOI"<20) n2_lt20
  from "powerPlayCombinations" p
  join forge_player_game_strength f on f.game_id=p."gameId" and f.player_id=p."playerId"
  where p."gameId" between 2026020001 and 2026020260
  group by 1,2,3
), j as (
  select pp.*, (split_part(tg."powerPlayToi",':',1)::int*60+split_part(tg."powerPlayToi",':',2)::int) nhl_team
  from pp join "teamGameStats" tg on tg."gameId"=pp.g and tg."teamId"=pp.t
  where tg."powerPlayToi" ~ '^\d+:\d\d$'
)
select (d < date '2026-11-01') before_nov1, count(*) team_games,
  count(*) filter (where abs(implied_team-nhl_team)<=5) within5,
  count(*) filter (where abs(implied_team-nhl_team)>60) over60,
  round(avg(player_secs/nullif(nhl_team,0))::numeric,2) skaters_per_nhl_sec,
  sum(n2_lt20) n2_lt20, sum(n2) n2_total
from j group by 1;
```

Result: before 11-01: 433 team-games, 420 within 5 s, 9 over 60 s, 4.91 skaters per second, 135 of 2,050 unit-2 rows under 20 s. From 11-01: 68, 68, 0, 5.00, 18 of 316. Game dates in the sample run 2026-09-29 to 2026-11-05.

Sample B, FORGE PP against the simulation and NHL (game ids 2026020101–2026020260; skaters only; 316 team-games):

```sql
with j as (
  select f.game_id g, f.team_id t, f.toi_pp_seconds fpp, coalesce(pc."PPTOI",0) blk, pc.unit,
    (split_part(tg."powerPlayToi",':',1)::int*60+split_part(tg."powerPlayToi",':',2)::int) nhl_team
  from forge_player_game_strength f
  join players pl on pl.id=f.player_id and pl.position<>'G'
  left join "powerPlayCombinations" pc on pc."gameId"=f.game_id and pc."playerId"=f.player_id
  join "teamGameStats" tg on tg."gameId"=f.game_id and tg."teamId"=f.team_id and tg."powerPlayToi" ~ '^\d+:\d\d$'
  where f.game_id between 2026020101 and 2026020260
), tg as (select g,t,max(nhl_team) nhl_team, sum(fpp) sum_fpp, sum(blk) sum_blk, max(fpp) max_fpp, max(blk) max_blk from j group by 1,2)
select count(*) n,
  round(sum(sum_fpp)::numeric/sum(nhl_team),2) pooled_forge,
  round(sum(sum_blk)::numeric/sum(nhl_team),2) pooled_blk,
  count(*) filter (where max_fpp>nhl_team) forge_player_over_team,
  count(*) filter (where max_blk>nhl_team) blk_player_over_team,
  percentile_cont(0.5) within group (order by sum_fpp/5.0-nhl_team) med_excess_s,
  percentile_cont(0.9) within group (order by sum_fpp/5.0-nhl_team) p90_excess_s
from tg;
-- unit-1 skaters: select count(*), avg(fpp), avg(blk), avg(fpp-blk), percentiles of fpp-blk from j where unit=1;
```

Result: 316 team-games; pooled 5.96 (FORGE) against 4.97 (simulation); a skater above team NHL PP time in 77 (FORGE) against 1 (simulation); median excess 33.5 s, 90th percentile 161.6 s. Unit-1 skaters (n = 1,561): FORGE mean 236.0 s, simulation 210.8 s, mean gap +25.3 s, median +3, 90th percentile +97. A further 537 skater-games had FORGE PP time and no simulation row (mean 21 s).

Sample C, stored lines against observed 5v5 units (game ids 2026020101–2026020260; `team_unit_toi` snapshot 2026-11-08; 320 team-games):

```sql
with snap as (select max(snapshot_date) s from team_unit_toi where season_id=20262027),
u as (select game_id, team_id, unit_type, unit_number,
        (select array_agg(x::bigint order by x) from unnest(player_ids) x) pids,
        team_unit_pool_toi_seconds, unit_share, coverage_status
      from team_unit_toi, snap
      where season_id=20262027 and snapshot_date=snap.s and game_id between 2026020101 and 2026020260),
lc as (select "gameId" g, "teamId" t,
        (select array_agg(x::bigint order by x) from unnest(forwards[1:3]) x) l1,
        (select array_agg(x::bigint order by x) from unnest(forwards[4:6]) x) l2,
        (select array_agg(x::bigint order by x) from unnest(defensemen[1:2]) x) d1
       from "lineCombinations" where "gameId" between 2026020101 and 2026020260)
select
 (select count(*) from u f1 join lc on lc.g=f1.game_id and lc.t=f1.team_id where f1.unit_type='forward_line' and f1.unit_number=1 and f1.pids=lc.l1) l1_match,
 (select count(*) from u f1 join lc on lc.g=f1.game_id and lc.t=f1.team_id where f1.unit_type='forward_line' and f1.unit_number=1 and f1.pids in (lc.l1, lc.l2)) l1_or_l2_match,
 (select count(*) from u d join lc on lc.g=d.game_id and lc.t=d.team_id where d.unit_type='defense_pair' and d.unit_number=1 and d.pids=lc.d1) d1_match;
-- pools: forward pool / 3 per team-game; home/away gap per game.
```

Result: 320 team-games; L1 match 217; L1 or L2 match 270; D1 match 224; mean top-line share 0.232; mean qualifying 5v5 clock 2,856 s (minimum 2,027); home/away gap mean 20.1 s, maximum 478 s; no partial coverage rows; about 49 distinct forward trios per team-game.

Shift sentinel check (game ids 2026020201–2026020240): 30,131 `nhl_api_shift_rows`, none with `end_seconds = 0`, none with end ≤ start, none where end − start ≠ duration, none past 1,200 s; highest period 4.
