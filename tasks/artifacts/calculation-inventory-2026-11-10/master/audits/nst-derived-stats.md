# Audit: NST-derived stats (M-NST-001 to M-NST-034)

Wave 1, pass W1-2. Audited 2026-11-10 against `octoberBranch` at `3c03df7dc` plus the dirty working tree. No code was changed. Line numbers are from the current checkout.

**How this was done.** I read every file in the packet's scope: the parity core (`web/lib/supabase/Upserts/nhlNstParityMetrics.ts`), event inclusion, strength state, parser, stints, attribution, the event-feature builders, and the production caller in `web/lib/underlying-stats/playerStatsLandingServer.ts`. Two read-only research agents covered the NST operations entries (018, 019, 027) and the radar, team-share and validation entries (006, 017, 033, 034); I then checked their decisive lines in code myself. For the event-feature entries that overlap the xG packet (008 to 015, 030) I confirmed the mechanics in code and took the sizes from `audits/xg-part1.md`.

**Measured sample ("the sample").** I ran the production function `buildPlayerStatsNativeGameParity` locally on six stored games (2025020965, 2025020982, 2025021003, 2025021018, 2025021119, 2025021140; 2026-03-03 to 03-26), with the same scalar columns production selects, and compared the output with the stored Natural Stat Trick rows for the same 216 skater-games and 13 goalie-games. The script and its output are in the session scratchpad only.

**Owner decisions (TJ, 2026-11-10, in chat).** Verdicts and priorities below already apply them.

1. A metric in the on-ice table is meant to equal NST's. On-ice tables count every attempt or chance by the player's team while he is on the ice; individual tables count the player's own.
2. The goalie column is whatever NST labels it: GSAA. GSAx can be derived later.
3. Leading and Trailing include one-goal margins.
4. Hide the bucket xG, then fix it.
5. A penalty-shot infraction is not a penalty in a player's totals.
6. An NST job may burst only when it needs fewer than 40 unique URLs.

## 1. Summary

| Verdict | Count | Entries |
|---|---:|---|
| Sound | 11 | 007, 008, 012, 013, 015, 023, 024, 026, 029, 032, 033 |
| Mis-specified | 9 | 001, 002, 009, 011, 016, 018, 019, 031, 034 |
| Wrong | 14 | 003, 004, 005, 006, 010, 014, 017, 020, 021, 022, 025, 027, 028, 030 |
| Undetermined | 0 | — |

The count layer is good. Goals, assists, points, shots, iCF, iFF, on-ice CF/FF/SF/GF, zone starts, zone faceoffs, and goalie shots, saves and goals against all match NST within one or two events per player-game. The problems are in what is layered on top: the xG, the danger classes, the score-state filter, and several definitions that carry NST's names.

### Top 5 findings by user impact

1. **Score-state filters return nothing for skaters (M-NST-028, new, P0).** The filter reads `home_score` and `away_score` off each event, but the NHL feed carries them on goal events only (49 of 2,042 events in the sample). Every other event and every time segment has a null score and fails the filter. In the sample, time on ice was 0 seconds in all six score states and only 1% to 4% of shot attempts passed. The landing server drops rows with zero TOI (`playerStatsLandingServer.ts:2462`, `:2869`), so Tied, Leading, Trailing, Within 1, Up 1 and Down 1 come out empty. Production stores no score-state summaries at all: the 225 stored summary rows for 2026-03-10 are all-scores only.
2. **The xG on the underlying-stats pages is 45% above NST's, and every goal is worth exactly 0.25 (M-NST-005, triage C4 confirmed and sized, P0).** Sample: 69.1 xG against 46 goals and 47.5 NST xG. Blocked shots supply 19.9 of it (29%). The goal floor adds 6.0; the largest pre-floor value is 0.25, so the floor sets every goal to 0.25. Player-game xGF% differs from NST by a median of 10 points and 25 points at the 90th percentile. xGF% is the default sort of the on-ice tables (`web/components/underlying-stats/playerStatsColumns.ts:361-362`).
3. **"GSAA" is not GSAA (M-NST-020, P0).** The column is heuristic xGA minus GA. Against NST's GSAA for the same 13 goalie-games it differs by 0.96 goals a game on average, sums to +3.0 where NST sums to −8.8, and has the opposite sign for 4 goalies.
4. **HDCF, SCF and Rush Attempts carry NST names but different definitions (M-NST-004, 014, 021, P0 under owner decision 1).** On-ice HDCF runs 9% to 11% under NST with only 25% of player-games matching; goalie HD shots against are 39% under; rush attempts are 1.9 times NST's.
5. **The player radar ranks forwards against the wrong cohort (M-NST-006, confirmed against stored data, P0).** The comparison filters on `LW` and `RW`, but the stored codes are `L` and `R` (2025-26: C 298, L 165, R 152, D 325). "Versus forwards" therefore means centres only (298 of 615), and "versus position" is empty for every winger. The radar's "HDCF/60" is also the individual count, not on-ice.

Close behind: **penalty classes** (M-NST-003, triage C5, P0). Over two weeks of league play, 26 of 811 player penalties (3.2%) sit in the wrong column. "Major" shows 83 where 63 is right, and "Misconduct" shows 6, all of them double minors, where 20 is right.

### Answers to the brief's questions

**Where is the heuristic xG shown?** Four copies of the 0.18 / 0.08 / 0.02 heuristic exist:

| Copy | Location | Feeds |
|---|---|---|
| Parity | `web/lib/supabase/Upserts/nhlNstParityMetrics.ts:407-419` | Player pages: ixG, on-ice xGF, xGA, xGF%, xGF/60; goalie xG Against and "GSAA" |
| PBP-only fallback | `web/lib/underlying-stats/playerStatsLandingServer.ts:2345-2360` | The same columns for games without shift data |
| Goalie danger split | `playerStatsLandingServer.ts:3443-3452` | HDGSAA, MDGSAA, LDGSAA. Differs from the others: only high-danger goals are floored and there is no rebound or rush bonus, so the three do not add up to total xGA |
| Team | `web/lib/underlying-stats/teamStatsSummaryRefresh.ts:481-515`, used at `:657` | Team underlying-stats xGF, xGA, xGF% |

**Should it survive?** No (owner decision 4). Hide these columns now; bring xG back only from a clean trained model.

**Which labels promise NST parity but differ?** See section 2a.

**Do score-state filters work when scores are null?** No. See finding 1.

**Is the penalty classification right?** No. See D3.

## 2. Per-entry table

"NST" is Natural Stat Trick's glossary and the stored `nst_gamelog_*` rows. "Match" is the share of player-games with identical values in the sample. `P.ts` is `web/lib/supabase/Upserts/nhlNstParityMetrics.ts`; `Upserts/` is `web/lib/supabase/Upserts/`.

| ID | Verdict | Evidence | Reference | Magnitude | Downstream |
|---|---|---|---|---|---|
| M-NST-001 | Mis-specified | Formulas right (`P.ts:427-430`, `:1621-1674`). PDO is the sum of two 0–100 percentages | NST PDO; the stored NST column is on a 1.0 scale | CF% differs from NST by 0.58 points on average. PDO is 100 times the stored NST value | Per-game percentages have no production reader; the landing server recomputes from summed counts |
| M-NST-002 | Mis-specified | `P.ts:1312-1355`, `:1391-1395`. A block is credited for any `blocked-shot` event | NST individual counts | Goals, assists, points 100% match; shots 98%; iCF and iFF 97%. Shots blocked 194 against 171; 21 of the 194 are `teammate-blocked` | Player individual tables |
| M-NST-003 | Wrong | `P.ts:1357-1364` classifies by minutes; `penalty_type_code` is stored and unused | NHL rules 16 to 23. NST counts a double minor as one minor (52 against our 50 in the sample) | 3.2% of penalties misfiled. A penalty-shot infraction (0 minutes) falls into the misconduct branch | Minor, Major, Misconduct columns and per-60s |
| M-NST-004 | Wrong | `P.ts:399-405`, `:421-425`: wedges of 20 ft / 35° and 40 ft / 50°; blocked shots are bucketed by where the block happened | NST and War-On-Ice: zone value 1 to 3, +1 rush, +1 rebound, −1 blocked; chance at 2, high danger at 3 | iSCF 61% match; iHDCF 57% match and 10% low | iSCF, iHDCF, SCF, HDCF, MD, LD, goalie danger splits |
| M-NST-005 | Wrong | `P.ts:407-419`; `shot.xgValue` is never supplied (`playerStatsLandingServer.ts:1078-1092`) | Evolving-Hockey, MoneyPuck, NST: unblocked shots, outcome never an input | See finding 2. On unblocked shots without the floor the mean is 0.076 against a 0.081 goal rate, so the constants are roughly centred; the floor and the blocked shots are the error | Every xG column on player, goalie and team underlying-stats pages |
| M-NST-006 | Wrong | Arithmetic right (`web/lib/nst/radarSeasonStats.ts:30-35`). Cohort filter `["C","LW","RW"]` and `L→LW` mapping (`web/components/PlayerStats/PlayerRadarChart.tsx:214-225`, `:362-366`) against stored `L` / `R`. "HDCF/60" is individual (`radarSeasonStats.ts:64`; label at `web/components/PlayerStats/types.ts:490`). The player's own row skips the sample minimum (`radarSeasonStats.ts:190`) | Owner decision 1; NST HDCF is on-ice | See finding 5. A 10-minute player can rank 100th percentile, or N+1 of N. One unpaginated read per view (`:149`) against a 1,000-row cap, with 940 skaters last season | `/stats/player/[id]` radar |
| M-NST-007 | Sound | `P.ts:432-435`, `:1678-1749` | NST per-60 | None in the formula | No production reader; the landing server computes its own per-60 |
| M-NST-008 | Sound | `Upserts/nhlScoreState.ts:138-190`: running score taken before each event | NST "close" is a different definition from `isLateGameClose` | Not in the production model family | Shot features; goalie score-state filter. It is the fix for D1 |
| M-NST-009 | Mis-specified | "Royal road" is any same-team previous event on the other side of centre with both x ≥ 25, no time limit and no pass (`Upserts/nhlContextualFeatures.ts:277-300`) | Royal road is a tracked-pass concept | Fires on 33% of shots (xg-part1) and adds 0.02 heuristic xG | Heuristic xG, model features |
| M-NST-010 | Wrong | Every shot in a sequence of two or more is flagged, including the first (`Upserts/nhlFlurries.ts:211-228`) | MoneyPuck flurry adjustment | No effect on parity numbers; sized in xg-part1 D2 | Trained model only |
| M-NST-011 | Mis-specified | A "possession" is a run of same-owner events; an opposing hit ends it (`Upserts/nhlPossessionChains.ts:123-129`). Raw zone codes are read as owner-relative (`:197-220`), but a blocked shot's code is defender-relative, so a block marks "non-offensive zone seen" and the next attempt reads as a zone entry | — | Not measured. Not in the production model family | `expanded_v2` model features |
| M-NST-012 | Sound | `Upserts/nhlPriorEventContext.ts:21-37` | — | — | Rebounds, movement |
| M-NST-013 | Sound | Immediately previous same-team attempt, same period, 0 < gap ≤ 3 s (`Upserts/nhlRebounds.ts:194-207`). The freeze label takes any stoppage (`:144-152`; xg-part1 D15) | NST 3 s rebound | Rebounds created 74 against 75, 98.6% match. Goalie rebound attempts against 60 against 74 | Rebounds Created; heuristic +0.03 |
| M-NST-014 | Wrong | 10 s window; sources limited to takeaway, faceoff win, opposing giveaway or block (`Upserts/nhlRush.ts:91-120`). A blocked shot's zone is inverted to offensive, so block-then-rush never qualifies (`:81-89`, `:217-242`) | NST rush: within 4 s of any neutral or defensive zone event | Rush attempts 38 against 20; goalie rush attempts against 28 against 17 | Rush Attempts columns; heuristic +0.02 |
| M-NST-015 | Sound | `Upserts/nhlCoordinates.ts:37-88`. Faceoff zone codes are owner-relative in 362 of 362 sample faceoffs, as `P.ts:444-454` assumes | Standard rink coordinates | The behind-net angle fold is xg-part1 M-XG-013 | Buckets, zone starts |
| M-NST-016 | Mis-specified | Strength changes only at the next event (`P.ts:588-652`); "all" uses full shift length, splits use overlap (`:926-984`) | NST TOI by strength | All-situations TOI ratio 1.002, 92% match. 5v5 −1.8%, power play +3.7%, penalty kill +3.3%; about 17 s per player-game | Every per-60 by strength; PP and PK rates read about 3.5% low |
| M-NST-017 | Wrong | Zone-start percentages are skipped when any count is 0, and `|| null` turns a real 0 into null (`web/hooks/usePlayerStats.ts:295-299`, `:336-346`) | — | None: no importers | Dead code |
| M-NST-018 | Mis-specified | Not live (needs `catchupScope`). Reserves 18 attempts a paced step when about 9 fit, never refunded; burst mode clears fewer units a day than paced (20 against 24) | Repo NST policy | `MAX_STEPS = 7` is unreachable; a 140-unit backlog takes about 6 days | Goalie catch-up, when enabled |
| M-NST-019 | Mis-specified | `web/lib/nst/goalieFreshness.ts:103-107` returns `not_due` before 13:00 UTC whatever the gap's age; a permanent gap turns "healthy" on day 15; zero expected games is "healthy" | — | Harmless today because the report runs at 13:00 | Cron report subject line |
| M-NST-020 | Wrong | `gsaa = xga − goals_against` (`P.ts:1780-1781`; again at `playerStatsLandingServer.ts:5085-5088`); xGA includes missed shots | Owner decision 2; Hockey-Reference GSAA | Shots, saves, goals against 100% match. See finding 3 (correlation with NST GSAA 0.92). xGA 49.0 against NST 44.3; 13.4 is from missed shots and 6.0 from the goal floor. HD shots against 80 against 132 | Goalie tables: GSAA, GSAA/60, xG Against, HD/MD/LD columns |
| M-NST-021 | Wrong | `P.ts:1406-1466`. Shot counts are right; danger and chance counts use the wedge | Owner decision 1; NST on-ice counts | CF, CA, FF, FA, SF, SA, GF, GA totals within 0.5%; 5v5 totals exact. HDCF 0.91, LDCF 0.87, MDCF 1.07 of NST. SCF total 0.99 but only 28% match | On-ice tables |
| M-NST-022 | Wrong | Percentages put neutral-zone counts in the denominator (`P.ts:1665-1672`) | NST: OZ / (OZ + DZ) for both | Counts 97% to 100% match. OZS% is 18 points off NST on average, OZFO% 16. Recomputed NST's way they are 0.2 and 0.1 off | Not shown on any page today |
| M-NST-023 | Sound | `P.ts:1605` | NST IPP | — | Page IPP is recomputed downstream |
| M-NST-024 | Sound | `Upserts/nhlOnIceAttribution.ts:48-88` | NST on-ice attribution | 5v5 CF 84% match, CA 96%, largest gap 2 | All on-ice counts |
| M-NST-025 | Wrong | The pattern `/penalty[- ]shot/` (`Upserts/nhlEventInclusion.ts:33`, `:95-99`) matches nothing the feed sends. The attempt has no reason text; the infraction is `ps-hooking-on-breakaway` | Policy excludes penalty shots (`tasks/TASKS/xg-model/docs/definitions-and-parity.md:206`) | 2 of 2 penalty shots in a three-week window were not excluded. Situation code `0101` or `1010` files them as empty-net, and the players on the shift chart get the attempt | On-ice counts, empty-net splits, model `isEmptyNetEvent` |
| M-NST-026 | Sound | Parser at `Upserts/nhlPlayByPlayParser.ts:188-266` | — | The stored path bypasses it: `time_remaining_seconds` is not in the select list, so overtime is always 300 s (triage C38, M-UST-073) | All timing |
| M-NST-027 | Wrong | Semi-burst allows 78 planned requests: `web/lib/cron/nstRateLimitPolicy.ts:122-124`, `web/lib/nst/sharedAdmission.ts:78`, `functions/api/fetch_team_table.py:323`, and the deployed `nst_admit_attempt_budget_v1` (`between 1 and 78`) | Owner decision 6; AGENTS.md | No admitted sequence breaks a window (caps 39 / 80 / 100 / 180, 22 s spacing), but a 78 burst leaves 2 requests for every other caller in that 5 minutes | Every NST fetch |
| M-NST-028 | Wrong | `P.ts:646-647`, `:845-846`, `:807-809`; scores are stored on goals only. "Leading" and "Trailing" mean two or more (`:782-800`) | Owner decision 3; NST score states | See finding 1 | Score-state filter on player pages |
| M-NST-029 | Sound | `Upserts/nhlShiftStints.ts:84-286` | — | See 024 | Attribution, TOI |
| M-NST-030 | Wrong | `includes("short")` files the NHL reason `short` as short-side; `above-crossbar` hits "crossbar" before "over" (`Upserts/nhlMissReasons.ts:36-49`) | NHL miss reasons | No parity effect | Diagnostics |
| M-NST-031 | Mis-specified | Rows carry no `xgValue` or `dangerBucket`, so the fallbacks always run; blocked shots have no goalie id (194 of 194) | — | Blocked shots count for skater xG but not goalie xGA | Parity, model |
| M-NST-032 | Sound | `Upserts/nhlStrengthState.ts:64-90`; `P.ts:688-738` | NST strength definitions | 5v5 counts match NST exactly in total | All splits |
| M-NST-033 | Sound | `web/lib/stats/percentUnits.ts:118-150`; rows are per-date, so the last 10 rows are the last 10 games | NST team shares; PDO on 1.000 | Label issues only: PP and PK CF% are coloured against a 48% to 52% band; the "Playoffs" toggle changes nothing | Team dashboard |
| M-NST-034 | Mis-specified | Only nine count metrics can block; every on-ice and TOI drift is an approved exception (`Upserts/nhlXgValidation.ts:580-598`); the script compares no percentage, xG, SCF, HDCF or GSAA (`web/scripts/run-nhl-xg-release-validation.ts:47-91`) | — | Saved run of 2026-03-31: 0 blocking, 1,021 approved exceptions. Units also differ: stored NST goalie SV% is 0–1 and goalie TOI is minutes | Release gate |

### 2a. Labels that are not the community metric

| Label on the page | What it is today | Action under the owner decisions |
|---|---|---|
| xGF, xGA, xGF%, ixG, xG Against | Danger-bucket constant on every attempt, goals set to 0.25 | Hide (D2) |
| GSAA, GSAA/60, HDGSAA, MDGSAA, LDGSAA | Bucket xGA minus goals against | Compute NST's GSAA (D4) |
| HDCF, HDCA, HDCF%, iHDCF, HD Shots Against | Attempts within 20 ft and 35° | Implement NST's definition (D5) |
| SCF, SCA, SCF%, iSCF | Attempts within 40 ft and 50° | Implement NST's definition (D5) |
| Rush Attempts, Rush Attempts Against | 10 s after a turnover or faceoff win outside the offensive zone | Implement NST's definition (D5) |
| Minor, Major, Misconduct | Bucketed by minutes | Fix (D3) |
| Leading, Trailing | Margin of two or more | Any lead, any deficit (D1) |
| Shots Blocked | Includes blocks of a teammate's shot | Exclude `teammate-blocked` (D9) |
| OZS%, OZFO% (not displayed yet) | Neutral zone in the denominator | OZ / (OZ + DZ) (D12) |
| Radar "HDCF/60" | Individual | On-ice value, or relabel "iHDCF/60" (D6) |

## 3. Defects

Priority: **P0** user-visible wrong numbers, **P1** wrong or misleading with lower reach, **P2** latent.

### P0

**D1. Score-state filter passes only goal events; Leading and Trailing exclude one-goal margins** (M-NST-028)
- Fix: carry the running score forward before filtering. `buildScoreStateContexts` already computes the pre-event score; use it for events and stamp each strength segment with the score after its starting event. Define leading as any positive margin and trailing as any negative one, so Up 1 is a subset of Leading.
- Test: with scores on goal events only, tied + leading + trailing TOI equals all-scores TOI; a one-goal lead counts as Leading.

**D2. Heuristic xG** (M-NST-005, 031; xg-part1 D6)
- Fix: hide the xG columns on the player, goalie and team underlying-stats pages and move the on-ice default sort off `xgfPct`. Then delete the four copies and feed trained-model values through `shot.xgValue` once a clean model is promoted (xg-part1 D1 to D5).
- Test: a shot scores the same xG whether or not it is a goal; a blocked shot adds 0; HD + MD + LD xGA equals total xGA.

**D3. Penalty classes** (M-NST-003)
- Fix: classify by `penalty_type_code`: MIN and BEN minor, MAJ major, MIS, GAM and MAT misconduct. Skip PS entirely (owner decision 5).
- Test: a 4-minute MIN is one minor; a 10-minute MIS is a misconduct; a PS adds nothing to a player's totals.

**D4. "GSAA" is xGA minus GA** (M-NST-020)
- Fix: GSAA = shots against × league SV% − goals against, with league SV% taken over the same season, strength and date range as the row. Compute it at the aggregate level. Do not sum stored NST per-game values: each is relative to that single day's league SV% (.890, .901 and .930 on three dates in the sample), so they do not add up to a season figure.
- Test: a goalie at league-average SV% has GSAA 0 whatever the shot locations.

**D5. Danger, scoring-chance and rush definitions** (M-NST-004, 014, 021)
- Fix: implement NST's definitions. Zone value 1, 2 or 3 by location; +1 for a rush (within 4 s of any event in the neutral or defensive zone, no stoppage between); +1 for a rebound (within 3 s of a blocked, missed or saved attempt, no stoppage between); −1 if blocked. A score of 2 or more is a scoring chance and 3 or more is high danger. Treat a blocked shot's zone code as defender-relative. Take the zone polygons from the War-On-Ice definition and tune against stored NST rows with the comparison used in this audit.
- Test: on the six sample games, HDCF, SCF and rush attempts match NST within a stated tolerance, for example 90% of player-games exact.

**D6. Radar cohorts and labels** (M-NST-006)
- Fix: filter on the stored codes (`C`, `L`, `R`, `D`); apply the sample minimum to the player or show "small sample"; make "HDCF/60" on-ice or relabel it; say "all situations"; page the view reads.
- Test: a left-wing fixture row lands in the left-wing cohort; rank never exceeds cohort size.

### P1

**D7. Penalty-shot detection is inert** (M-NST-025)
- Fix: detect by situation code `0101` or `1010` outside the shootout, or by a PS penalty at the same clock time.
- Test: the stored events of game 2025021094 at 12:35 of the second period are excluded from on-ice counts and not flagged empty-net.

**D8. Strength TOI drifts at penalty expiry** (M-NST-016)
- Fix: build strength intervals from penalty start and end times, or add boundaries at penalty expiry.
- Test: team power-play seconds equal the penalty time served in a fixture game.

**D9. Shots Blocked counts teammate blocks** (M-NST-002)
- Fix: skip events whose reason is `teammate-blocked`.
- Test: a teammate-blocked event adds iCF for the shooter and no block for anyone.

**D10. NST semi-burst breaks the written rule** (M-NST-027)
- Fix: cap burst eligibility at 39 in `canUseNstSemiBurst`, `sharedAdmission.ts`, `fetch_team_table.py` and the deployed `nst_admit_attempt_budget_v1`. The last is a production change and needs approval. Commit the base admission function to a migration; it is in none today.
- Test: a 40-request plan paces at 21 s in TypeScript, Python and SQL.

**D11. Release gate cannot fail on on-ice or TOI drift** (M-NST-034)
- Fix: per-metric tolerances that block (±1 count, ±2 s TOI); compare the xG, danger and percentage families; convert goalie SV% and TOI units; exit non-zero on failure.
- Test: a ±3 CF drift is a blocking failure.

### P2

| ID | Entry | Defect | Fix | Test |
|---|---|---|---|---|
| D12 | 022 | OZS% and OZFO% include the neutral zone | OZ / (OZ + DZ) | Matches the stored NST value on a fixture row |
| D13 | 001 | PDO scale differs from the stored NST column | Use NST's 1.0 scale | Unit test on scale |
| D14 | 011 | Possession zone-entry flag fires after a blocked shot; opposing hits split chains | Invert the zone for blocked shots; ignore hits as chain breaks | A block then a second attempt is not a zone entry |
| D15 | 018 | Attempt reservations never refunded; burst slower than paced | Reserve what fits; refund on finish | A 30-unit cohort clears in one day |
| D16 | 019 | `not_due` ignores gap age; permanent gaps age out as healthy | Gate on the gap's date; keep an exemption list | 02:00 UTC with a 9-day gap is critical |
| D17 | 009, 010, 030 | Royal-road label, flurry look-ahead, miss-reason buckets | See xg-part1 D21, D2, D14 | See xg-part1 |
| D18 | 017 | Dead hook with zero-handling bugs | Delete | — |

## 4. Questions for the owner

The six questions from the first draft are answered above. Two remain:

1. D10 needs a change to a deployed database function. Approve it as its own step, or bundle it with the next NST release?
2. The radar compares all-situations shares. Keep that and label it, or move the radar to 5v5?

## 5. Limits

- **Sample size.** Six games. Count-family matches are solid at that size. The danger-bucket goal rates and the goalie figures (13 goalie-games) are sample values only.
- **Own goals.** None occurred in the sample and my run did not pass own-goal ids, so the own-goal branches (a goal for with no shot for) are read from code only.
- **Score-state result on the live page.** Shown from code, data and the absence of stored score-state summaries. I did not load the page.
- **NST definitions** in D5 are from memory of the glossary and from the stored NST values; no NST page was fetched. The War-On-Ice zone polygons were not reconstructed, so no NST-definition prototype was scored against the sample.
- **Possession chains (011)** were read but not measured.
- **Sizes for 009, 010 and 030** are taken from xg-part1; I confirmed only the mechanics.
- **NST admission.** The deployed function was checked for its caps, spacing and burst range by pattern, not read in full. Which jobs actually send 40 to 78 planned requests was not traced.
- **Radar row cap.** The 1,000-row cap is the repo's `supabase/config.toml` value; the hosted setting was not read.
- **No tests were run.**

Database reads made, all with 0 other active queries beforehand: catalog (`pg_indexes`, `information_schema.columns`, `pg_class`, `pg_proc` pattern matches); grouped counts for one game's events; scalar event and shift columns for six games by game id; NST gamelog rows for those games' players by date and player id; a two-week grouped count of penalties; penalty-shot events in a three-week window and the events at two clock times; payload sizes and path shapes (not contents) of stored summaries for one game and one date; position-code counts for one season of `wgo_skater_stats_totals`. No jsonb was returned. No writes.
