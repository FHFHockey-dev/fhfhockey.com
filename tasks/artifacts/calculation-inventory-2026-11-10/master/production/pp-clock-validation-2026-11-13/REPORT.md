# PP clock validation (decision 144; decision 71; L8 W2-P0-13)

Lane F11, 2026-11-13. A separate validation lane: not part of tonight's release or the Astra snapshot. **PP share stays labelled unavailable sitewide; nothing here changes that.** Nothing was written to production. The only application code changes are C3 (`a98eda63f`), C1 + C2 (`de4650c77`) and the decision-152 Penalty Summary registry (section 10), each made later at the Chef's request; no serving path changed.

## Headline

- **The reconstructed clock matches the official NHL team PP time to the second on 2,493 of 2,500 comparable team-games (99.72%)** across 2025-26 and 2026-27 (preseason, regular season and playoffs). Two more differ by 1 s. Five differ by 28 s to 2:00, all in coincident-penalty scrums with fights, majors or misconducts. In each of those five, every interior situation code agrees with the clock, so the gap is NHL accounting that stored evidence can't settle. They are withheld, and the raw values are kept.
- **The decision-144 risk cases all reconcile** (counts are comparable team-games in games with that feature): overtime PP 172/172 exact; shootout games 207/207; 5-on-3 454/456; penalty expiry across a period 921/924; pulled goalie during a PP 343/346, plus 2 within 1 s; double minors 205/206; coincident penalties 1,115/1,120.
- **Legacy placeholder "00:00":** 3,728 team-game rows hold "00:00" even though the team had at least one PP opportunity. 2025-26 has 881 in the regular season (games 2025020467–476 and 2025020657–021095, dated 2025-12-09 to 2025-12-10 and 2026-01-04 to 2026-03-20), and 2024-25 has 2,392. The clock confirms real PP time in all 879 that it can check. **They can't be repaired from stored evidence:** right-rail is not stored, the stored boxscore and landing payloads carry no PP TOI, and the HTML summary is only memory-cached. 2026-27 regular season has none.
- **Smallest verified display scope:** per-game player PP time and PP share for **2026-27 regular-season team-games that pass the rules below: 607 of 618 show a share, 9 show "not applicable" (verified zero), and 2 are withheld** (2026020036 team 68 and 2026020153 team 9). 307 of the 309 games qualify for both teams. Season-to-date windows for teams 68 and 9 would be a labelled covered subset, or unknown. **After decision 152 (section 10), those two qualify on the NHL Penalty Summary: 618 of 618 pass the clock check, 609 show a share and 9 show "not applicable".**
- **Numerator (decision 152 Part B, section 11):** stored `powerPlayCombinations` agrees with shifts ∩ qualified intervals on 593 of 609 team-games. The 16 that don't have three causes (stale pre-11-01 rows, missing overtime shifts in the feed at write time, and production's older clock); none is a formula error. The recommendation is to store the output of the same calculation from one writer that reads stored shifts and PBP. Several readers need many games of history, so computing on demand doesn't fit them.
- **Three code gaps stood between the contract and that scope.** All three are now fixed: C3 in `a98eda63f` (11-13 release), C1 and C2 in `de4650c77` (TJ approved through the Chef, 11-13). Section 8 has the offline re-run.
  1. `buildTeamPpClock` never compares against the official total. On `octoberBranch` it would mark 5 mismatched team-games and 856 placeholder-row team-games `qualified`.
  2. The situation-code audit is stricter than the clock at stoppage events. It rejects 117 team-games that agree with the official total, 40 of them in 2026-27 regular season.
  3. Match penalties recorded as `MAT`/15 are unsupported, so 4 games error out. A what-if run treating them as 5-minute majors gives 8/8 exact matches.

## Premise check: repository state on 2026-11-13

- The brief described the flag as `PP_CLOCK_QUALIFIED = false`. On `octoberBranch`, commit `24b1cb4d3` (2026-11-12, "Qualify DRM strength clocks…") replaced L8's simulation with `web/lib/projections/penaltyClock.ts` (source `fhfh-nhl-penalty-context-clock-v2`) and set `PP_CLOCK_QUALIFIED = true` in `web/utils/getPowerPlayBlocks.ts:439`. The per-game `qualified` is now complete PBP && 0 situation-code disagreements. Correction: this note first said `master` had neither change; that came from a stale local `master` ref. `origin/master` `4d9b6a10d` (release #433) contains both, so the v2 clock is live in production through `ingest/shifts.ts` in the projection-input build.
- What users see is unchanged: `/api/toi` returns `powerPlayStatus.available = false` (`web/pages/api/toi.ts:130`), and the rolling writer passes `teamPpClock: null` (`web/lib/supabase/Upserts/fetchRollingPlayerAverages.ts:1166`). There is still no `team_pp_clock` table.
- This report validates the v2 clock, because that is the one any enablement would serve. L8's v1 (`7deb81304`) is superseded and wasn't re-run.

## Method (stored evidence only)

- **Official reference:** `teamGameStats.powerPlayToi` and `powerPlay` (G/Opp), written by `web/pages/api/v1/db/update-stats/[gameId].ts:487-503`. It is taken from right-rail and falls back to the HTML Penalty Summary row "Power Plays (Goals-Opp./PPTime)". Every failure path writes `"00:00"` (`:488`, `:529`, `:535`, `:544`, `:554`, `:586`). `powerPlay` defaults to `"0/0"`, and both columns are `NOT NULL` with those same defaults.
- **Clock:** the production `buildTeamPpClock()` was bundled unmodified from `web/utils/getPowerPlayBlocks.ts` and run on play objects rebuilt from the scalar columns of `nhl_api_pbp_events` (no `details` or `raw_event` jsonb read).
- **Reads:** bounded `SELECT`s only, paged 10 games per query. Each page ran the `pg_stat_activity` gate in the same session: stop if more than 5 queries are active or any has run longer than 10 s. The gate never tripped. The only jsonb read was a single-game probe of two payloads (`09-repair-source-probe.sql`), which returned matching paths only. No NHL or NST calls were made.
- **Scope of play-by-play:** stored PBP exists only for 2025-26 (1,394 games) and 2026-27 (338 games). Earlier seasons can be classified by their official row only.

## 1. Coverage by class

### Official rows, every past game (`03-classify-teamgamestats.sql`)

Classes:
- **nonzero:** PP time > 0 with at least one opportunity.
- **"00:00" + "0/0":** a candidate no-PP game; unverified without PBP.
- **placeholder:** "00:00" with at least one opportunity.
- **malformed:** unparseable text, goals > opportunities, or a clock longer than the game.
- **missing row:** a past game in `games` with no row for that team.

| Season | Type | nonzero | "00:00" + "0/0" | placeholder | malformed | missing row | total |
|---|---|--:|--:|--:|--:|--:|--:|
| 2026-27 | reg | 609 | 9 | 0 | 0 | 0 | 618 |
| 2026-27 | pre | 119 | 3 | 8 | 0 | 0 | 130 |
| 2025-26 | playoff | 162 | 2 | 0 | 0 | 46 | 210 |
| 2025-26 | reg | 1,691 | 52 | 881 | 0 | 0 | 2,624 |
| 2025-26 | pre | 186 | 4 | 18 | 0 | 0 | 208 |
| 2024-25 | playoff | 167 | 5 | 0 | 0 | 38 | 210 |
| 2024-25 | reg | 164 | 68 | 2,392 | 0 | 0 | 2,624 |
| 2024-25 | pre | 0 | 1 | 207 | 0 | 2 | 210 |
| 2023-24 | playoff | 172 | 2 | 2 | 0 | 30 | 206 |
| 2023-24 | reg | 2,476 | 54 | 94 | 0 | 0 | 2,624 |
| 2023-24 | pre | 193 | 2 | 27 | 0 | 0 | 222 |
| 2015-16 to 2022-23 | all | 18,245 | 402 | 99 | 0 | 2,214 | 20,960 |
| before 2015-16 | all | 0 | 0 | 0 | 0 | 26,688 | 26,688 |

No malformed rows and no "time > 0 with 0 opportunities" rows exist in any season. The full per-season table is in `results/03-teamgamestats-class-by-season.txt`.

### Validated classes where PBP exists (`05-compare-clock.ts` → `results/team-game-results.csv`)

| Season | Type | match | ±1-2 s | mismatch | verified no-PP | placeholder (clock > 0) | clock error | official row missing | no PBP | total |
|---|---|--:|--:|--:|--:|--:|--:|--:|--:|--:|
| 2026-27 | reg | 606 | 1 | 2 | 9 | 0 | 0 | 0 | 0 | 618 |
| 2026-27 | pre | 54 | 0 | 0 | 2 | 4 | 2 | 0 | 68 | 130 |
| 2025-26 | reg | 1,672 | 1 | 2 | 52 | 879 | 18 | 0 | 0 | 2,624 |
| 2025-26 | playoff | 161 | 0 | 1 | 2 | 0 | 0 | 46 | 0 | 210 |
| 2025-26 | pre | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 208 | 208 |

- **Verified no-PP** means official "00:00" and "0/0", the clock built from complete PBP is 0, and the situation codes agree. All 65 candidate rows where PBP exists verified. None hid real PP time.
- **Placeholder (clock > 0)** confirms the failed-fetch default: the team had real PP time. The two remaining 2025-26 placeholders sit in clock-error game 2025020998.

## 2. Discrepancies by cause

| Cause | Team-games | Games | Evidence | Disposition |
|---|--:|--:|---|---|
| Exact match | 2,493 | — | — | qualifies |
| 1 s at a goal/expiry boundary | 2 | 2 | 2025020241 t23 (−1), 2026020050 t19 (−1). Both had a pulled goalie in the PP and the PP ended on a goal. Second-resolution stamps. | qualifies within ±2 s |
| Coincident-penalty scrum accounting | 5 | 5 | 2026020036 t68 +28; 2026020153 t9 −120; 2025021248 t8 +94; 2025021097 t20 +31; 2025030112 t6 −120. All have multi-player coincident minors with fights, majors or misconducts. The clock agrees with every interior situation code (aligned audit 0). In 2026020036 the codes show 5-on-4 in both windows (P1 03:31–05:31 and P2 14:01–14:29, the residual PP after a 2-for-1), but the NHL records "1/1, 02:00". | withhold; raw kept |
| Legacy placeholder "00:00" | 883 | 448 | Official "00:00" with ≥ 1 opportunity; the clock has real PP time. 879 rows in 2025-26 reg, 4 in 2026-27 pre. | unverifiable; withhold |
| Clock refuses: unsupported `MAT`/15 | 8 | 4 | 2025020222, 2025020461, 2025021128, 2025021181. Treated as a 5-minute major, all 8 match exactly (`results/whatif-mat15-as-major-team-game-results.csv`). | code fix C3 |
| Clock refuses: no history consistent with the codes | 12 | 6 | Expiry 1 s earlier than the second-resolution clock: 2025020129, 2025020998. Two identical roughing minors on one player at one second (events 83 and 1251), released by a goal per the codes: 2025021250. Multi-penalty 5-on-3/4-on-3 sequences: 2025020463, 2025021180, 2026010021. | withhold (correct); see open item O3 |
| Incomplete PBP | 4 | 2 | 2026010020, 2026010022 (preseason); their official rows are placeholders too | withhold |
| No stored PBP | 276 | 138 | 2025-26 preseason (all 104 games); 34 games of 2026-27 preseason | withhold |
| Official row missing | 46 | 23 | 2025-26 playoffs | withhold |

Shootouts never enter the clock; all 207 comparable team-games in shootout games match. "Pulled goalie" means a goalie pulled during a clock PP second, on either side.

## 3. Situation-code audit findings

The shipped audit (`auditPpBlocksAgainstSituationCodes`) skips only events on a span's first or last second. It flagged 142 team-games: 71 games, including 23 in 2026-27 (3 of them preseason). Every flagged event was a stoppage-type event whose code is transitional:
- a penalty logged at the final horn, with game-end and period-end coded 1550 or 1541 at 60:00 (2026020002, 2026020038, 2026020166);
- a stale code on a penalty or stoppage logged inside an active PP (2026020058 P2 19:28);
- the second of two coincident penalties carrying the first one's post-change code (2026020093 P1 03:18).

The clock itself already refuses those observations (`penaltyClock.ts`: no constraint from period-start, period-end, game-end or stoppage events, or at seconds with an expiry, assessment or goal). An *aligned* audit that skips the same observations (analysis-only, in `05-compare-clock.ts`) finds **0 disagreements on all 3,448 team-games where the clock builds**. That recovers 117 team-games that agree with the official total, without letting any mismatch through.

## 4. Numerator coverage (shifts ∩ clock), 2026-27 regular season (`11-shift-numerator-check.ts`)

- Shift normalization is `complete` (expected = observed shift and event rows) for all 309 games (`results/normalization-status-2025-2027.csv`). For 2025-26 only one game has a status row, so its numerator coverage is unverified.
- Over 190,129 clock PP seconds in 309 games, the advantaged team has more players on the ice (goalies included) in **99.95%** of seconds. The mean is 5.99 players for the PP team, and 6v5 accounts for 96%.
- One game is below 95%: 2026020287, at 89.8%. Team 8's penalized player keeps a shift row from P3 19:03 to 20:00 while the codes read 1541. That is a penalty-kill-side shift artifact. The PP team's numerator is unaffected, and the official clock matches (05:18).
- Player PP seconds are each player's shifts ∩ the clock's spans, unioned per second, so player ≤ clock holds by construction. An impossible share can therefore only come from a numerator built on another classifier (FORGE `toi_pp_seconds`), which stays a labelled model input only.

## 5. Qualification rules (proposed)

A (game, team) PP clock qualifies for display when all of these hold:

1. **Official reference present:** the `teamGameStats` row exists and is well formed, and is not a placeholder. A placeholder is "00:00" with ≥ 1 opportunity, or "00:00"/"0/0" while the clock is > 0.
2. **Complete clock:** stored PBP passes `hasCompletePenaltyClockSource`, and `buildPenaltyClock` returns a unique history (no throw).
3. **Situation codes agree:** the aligned audit has 0 disagreements.
4. **Official total agrees:** |clock − official| ≤ 2 s.
   - Display the clock's seconds, because its intervals are what the shifts are intersected with. Store the official seconds and the difference beside them.
   - Withhold anything over 2 s with its raw values; never adjust or cap.
5. **Verified zero:** official "00:00" and "0/0" plus rules 2 and 3 with a clock of 0. Show "not applicable", never 0%.
6. **Numerator coverage:** the game's shift normalization is `complete`. Monitor the per-game "PP team has more players on the ice" share, and flag a game under 95% for review.
7. **Windows:** Σ player PP seconds ÷ Σ clock seconds over the dressed games (rule 26). If any dressed game is withheld, the window is unknown or a labelled covered subset with its coverage (rule 13).
8. **Impossible share** (player > clock, or a unit's shared on-ice time > clock): withhold and log it; never cap.

## 6. Smallest verified display scope

- **Scope:** per-game player (or defined-unit) PP time and PP share, **2026-27 regular season only (game type 2)**, for (game, team) pairs that pass rules 1–6. Counts are in the headline.
- **Out of scope for now:**
  - 2026-27 preseason: 34 games have no PBP and 2 have incomplete PBP.
  - 2025-26: 899 of 2,624 regular-season team-games would be withheld (mostly placeholders), and its shift coverage isn't recorded.
  - Every season before 2025-26: no stored PBP.

## 7. Code that would enable it (not done; for the owning lanes)

- **C1, `web/utils/getPowerPlayBlocks.ts` `buildTeamPpClock`** (**implemented in `de4650c77`**; see section 8):
  - Take the official reference (`powerPlayToi`, `powerPlay`) as an input.
  - Return `officialSeconds`, `officialClass` and `diffSeconds`.
  - Set `qualified` only when rules 1–4 hold.
  - Map "00:00"/"0/0" plus a clock of 0 to a verified "not applicable" state.
- **C2, same file, `auditPpBlocksAgainstSituationCodes`:** skip period-start, period-end, game-end, stoppage, penalty and goal events, and any second with a penalty or goal, to match the clock's own observation rules. Test cases: 2026020002, 2026020058, 2026020093. **Implemented in `de4650c77`.**
- **C3, `web/lib/projections/penaltyClock.ts` `unitsForPenalty`:** accept `MAT` with duration 15 (the match major and the game-misconduct minutes recorded together) as one 5-minute major. Verified 8/8 exact on the 4 stored games. **Implemented in `a98eda63f`**, with a regression test from stored game 2025021128 in `web/utils/getPowerPlayBlocks.test.ts`.
- **C4, storage (L8 proposal; owned by L4a; needs a migration and a production step):**
  - A `team_pp_clock` table holding seconds, spans, source, official seconds, official class, difference, qualified flag, reason and audit counts.
  - It would be written by `update-power-play-combinations/[gameId].ts`, which already builds these blocks.
- **C5, `web/pages/api/v1/db/update-stats/[gameId].ts:487-503` and `getPPTOI`:** stop writing "00:00" on failure. Keep the value unknown, which needs a nullable column or a status column (a migration), so that new placeholders stop appearing.
- **C6, readers (owned by L4b and L6):**
  - `/api/toi` serves `powerPlayStatus.available = true` per qualified game, with "not applicable" for a verified zero.
  - `fetchRollingPlayerAverages` passes `teamPpClock` only for qualified games, with windows per rule 7.
- **C7, numerator:** `powerPlayCombinations.PPTOI` (shifts ∩ blocks) is already the right definition. It needs a per-game coverage contract, because a missing row is currently unknown, not 0 (L8 note).

## 8. After C1 + C2 (`de4650c77`): offline re-run

`05-compare-clock.ts` now passes each team's stored official record into `buildTeamPpClock`, so `qualified` and `reason` in `results/after-c1-c2/` are the production verdict. Same stored PBP and classes as sections 1–3, no database reads. The code also includes C3, so the 8 MAT/15 team-games now build. Sections 1–7 and `results/*.csv` keep the pre-fix numbers.

**What the contract now does**
- `buildTeamPpClock` takes `official: { powerPlayToi, powerPlay } | null` (the `teamGameStats` row) and returns `official: { class, seconds, diffSeconds }`.
- It qualifies only with complete PBP, 0 audit disagreements and |clock − official| ≤ 2 s (`PP_CLOCK_OFFICIAL_TOLERANCE_SECONDS`; O1 still open).
- Missing, malformed and placeholder rows never qualify, and neither does an official "00:00"/"0/0" while the clock has PP time. A qualified clock of 0 is a verified no-PP game ("not applicable").
- The first failing check gives the reason: no PBP, clock refusal, incomplete PBP, situation-code disagreement, then the official record.
- `PP_CLOCK_QUALIFIED`, `/api/toi` and the rolling writer are unchanged.

**Qualified team-games by stored official class** (qualified / total):

| Season | Type | nonzero | zero ("0/0") | placeholder | missing row | Withheld, by reason |
|---|---|---|---|---|---|---|
| 2025-26 | pre | 0 / 186 | 0 / 4 | 0 / 18 | – | 208 no PBP |
| 2025-26 | reg | 1,681 / 1,691 | 52 / 52 | 0 / 881 | – | 879 placeholder; 10 clock refusal; 2 official differs |
| 2025-26 | playoff | 161 / 162 | 2 / 2 | – | 0 / 46 | 46 no PBP; 1 official differs |
| 2026-27 | pre | 54 / 119 | 2 / 3 | 0 / 8 | – | 68 no PBP; 4 incomplete PBP; 2 clock refusal |
| 2026-27 | reg | 607 / 609 | 9 / 9 | – | – | 2 official differs |
| **All** | | **2,503 / 2,767** | **65 / 70** | **0 / 907** | **0 / 46** | |

- **Never qualified:** the 5 mismatches (2026020036 t68 +28, 2026020153 t9 −120, 2025021248 t8 +94, 2025021097 t20 +31, 2025030112 t6 −120, each with reason "The clock differs from the official team PP total by …") and all 883 confirmed placeholders (879 with the placeholder reason; the 4 in 2026-27 preseason report incomplete PBP first). The old code qualified 856 of those placeholders and all 5 mismatches.
- **Newly qualified:** 117 team-games that agree with the official total (113 exact, 3 verified zeros, 1 within 2 s) that the old audit rejected, plus the 8 MAT/15 exact matches from C3.
- **Audit cross-check:** on all 3,456 built clocks the shipped audit now finds 0 disagreements and equals the analysis-only aligned audit.
- **2026-27 regular season:** 616 of 618 team-games qualify (607 with PP time, 9 verified zero) and 307 of 309 games qualify for both teams, as section 6 predicted.
- The 46 missing-row team-games (2025-26 playoffs, 23 games) have no stored PBP either, so "no PBP" is their first reason.

**Tests** (`web/utils/getPowerPlayBlocks.test.ts`, stored fixtures):
- C2: 2026020002, 2026020058 and 2026020093 have no disagreements and both teams qualify on their official totals. A recoded interior faceoff is still flagged.
- C1: 2026020036 home qualifies, and away is withheld at +28 s. 2025020665 is a placeholder on both sides. Tolerance, missing, malformed and official-zero variants run on 2026020093.
- Each fixture is the game's penalties, goals, period markers, the events the old audit flagged, and one interior event per PP span; each rebuilds the full game's spans exactly. All 16 new or changed tests fail on the previous module.

## 9. Decision 151: O1 counts and the O4 Penalty Summary check

TJ decided O1–O4 on 2026-11-13 (decision 151). PP share stays withheld; nothing here enables it, and no raw total was changed.

### O1: the clock check vs PP share that can display (2026-27 regular season, `14-share-coverage.ts`)

| Stage | Team-games |
|---|---|
| Clock check passes (complete PBP, audit 0, within 2 s inclusive of a verified official total) | **616 of 618** |
| – with PP time | 607 |
| – verified zero ("not applicable") | 9 |
| Clock withheld (2026020036 t68, 2026020153 t9; see O4) | 2 |
| **PP share can display, numerator = player shifts ∩ qualified intervals** | **607 of 607** |
| PP share can display from today's stored numerator (`powerPlayCombinations`) | 591 of 607 |

- **Recomputed numerator (decision 144's definition):** stored shift rows ∩ the clock's spans for that team.
  - Shift normalization is complete in all 309 games. Every team-game has at least 3 skater-seconds per clock second (the route's own rule, `MIN_SKATERS_PER_PP_SECOND`); the minimum is 3.97.
  - No player and no stored unit (all members on the ice together) exceeds the clock. Nothing is capped.
  - Shift rows carry no position, so a player with any shift of 300 s or more counts as a goalie: 575 team-games have one, 32 have two.
- **Stored numerator** (`powerPlayCombinations`, which the rolling writer reads; 7,190 rows, read under the gate by `12-fetch-pp-combinations.sh`):
  - Rows exist for all 607. In 16 team-games (14 games) they don't agree with the qualified clock, so those can't display from the table as it stands:
    - **Above the clock:** 2026020197 t24 stores 49 s of player PP time against a 43 s clock. Under decision 151 that is withheld, never capped or excused by the tolerance.
    - **Wrong denominator:** 12 have `pp_share_of_team` denominators other than the clock, mostly mixed within one team-game (e.g. 2026020004 t23: 119 s and 240 s). That fits stale rows from an earlier block version kept beside newer ones, because the route keeps rows it can't prove stale.
    - **PPTOI differs:** 15 have a player PPTOI more than 2 s from shifts ∩ clock (up to 120 s in 2026020192 t2 and 2026020197 t23).
    - **Missing skaters:** 2026020131 t18 has 5 skaters with PP time and no row, and a 29 s denominator against a 120 s clock.
  - A reader can display these only after the 14 games' rows are rebuilt (`update-power-play-combinations`, a production write; not done), or by computing shifts ∩ qualified intervals itself.
- Results: `results/after-c1-c2/share-coverage-2026-27-regular.csv` and `share-coverage-summary.json`.

### O4: NHL HTML Penalty Summaries for the five scrum games

`13-fetch-penalty-summaries.sh` made exactly 5 requests to nhl.com (the Game Summary page that holds the Penalty Summary, the same URL as `lib/NHL/htmlReports.ts`), one at a time, 10 s apart, all HTTP 200. There were no other provider calls and no database writes. `15-parse-penalty-summary.py` reads the pages; the raw HTML stays in scratch. Per-team values are in `results/after-c1-c2/o4-penalty-summary-check.csv`.

| Game | Team | Clock | Stored `teamGameStats` | NHL Penalty Summary (by strength) | Clock − summary | Stored − summary |
|---|---|---|---|---|---|---|
| 2026020036 | 68 (away) | 148 s | 02:00, 1/1 | 1-2/02:28 (5v4 1-2/02:28) | **0** | −28 s |
| 2026020153 | 9 (home) | 626 s | 12:26, 1/9 | 1-7/10:26 (5v4 1-7/10:26) | **0** | +120 s |
| 2025021248 | 8 (home) | 840 s | 12:26, 0/7 | 0-7/14:00 (5v4 0-6/14:00) | **0** | −94 s |
| 2025021097 | 20 (home) | 595 s | 09:24, 2/7 | 2-7/09:55 (5v4 1-5/09:35, 5v3 1-1/00:20) | **0** | −31 s |
| 2025030112 | 6 (away) | 492 s | 10:12, 1/6 | 1-5/08:12 (5v4 1-5/08:09, 5v3 0-1/00:03) | **0** | +120 s |

The goaltender table's PP team totals equal each summary row. The other team in each game matches on all three sources (5/5).

**What each summary explains:**
- **2026020036 t68:** two Utah power plays.
  - P1 3:31 interference: 2:00.
  - P2 14:01: Cuylle's boarding and roughing minors against Sergachev's cross-checking. One pair cancels and the extra minor gives a 5-on-4, which Utah scores on at 14:29 (0:28).
  - The stored row (1/1, 02:00) leaves out that 28-second power play.
- **2026020153 t9:** seven power plays, 10:26.
  - The list has offsetting fighting majors (P1 10:05, P3 2:17) and equal roughing pairs that create no power play (P1 15:32 two each; P3 3:35 two each plus misconducts).
  - Other entries: a P1 20:00 helmet minor on team 9 carried into P2, and at P3 18:46 two away minors against one home minor (74 s to the end).
  - The stored row counts 2 more power plays and 2:00 more. These records can't show which ones; a coincidental pair counted as a power play is the likely cause (inference).
- **2025021248 t8:** no PP goals (0-7), so every power play ran its full length.
  - 4:00 for the P1 3:48 double minor plus five 2:00 minors = 14:00, which is the clock's six spans.
  - The scrums at P2 3:33 and P2 17:34 each leave one extra minor. The stored 12:26 is 94 s short.
- **2025021097 t20:** 09:35 at 5-on-4 plus 0:20 at 5-on-3, the 5-on-3 ending in a goal.
  - The P3 11:14 interference major (with a hooking minor and a game misconduct) gives team 20 the advantage until a home minor at 14:04 evens it.
  - The P3 16:39 tripping minor adds the 5-on-3.
  - The clock's spans (120 + 120 + 99 + 170 + 86) give 09:55. The stored 09:24 is 31 s short.
- **2025030112 t6 (playoffs):** 08:09 at 5-on-4 plus 0:03 at 5-on-3 (the P1 8:43 and 10:40 minors overlap by 3 s).
  - The clock's spans (237 + 120 + 15 + 120) give 08:12.
  - The P3 2:26 scrum (offsetting majors, two visitor minors against one) is a team-7 power play, and P3 6:14 (three each) is coincidental.
  - The stored row has one more power play and 2:00 more, which the summary doesn't support.

**Verdict:**
- All five reconcile with the NHL Penalty Summary. The clock equals the summary total to the second, the PBP is complete and the audit finds 0 disagreements.
- In every case the stored right-rail total is the outlier.
- Per decision 151 they **stay withheld**: the raw clock and the stored totals are unchanged, and C1 still compares against `teamGameStats`, which disagrees.
- Releasing them needs an owner call on whether a verified Penalty Summary total can serve as the official reference, and how to record it without overwriting the raw row. That would be a repair; it isn't done here.

## 10. Decision 152: the NHL Penalty Summary as the reference for the five scrum team-games

TJ's decision 152 accepts the NHL HTML Penalty Summary as the official reference for these five team-games only, and only where it reconciles exactly. PP share stays withheld; no serving path changed.

**Code** (`web/utils/ppPenaltySummaryRegistry.ts`, `getPowerPlayBlocks.ts`, `getPowerPlayBlocks.test.ts`):
- The registry has one entry per team-game: 2026020036 t68, 2026020153 t9, 2025021248 t8, 2025021097 t20 and 2025030112 t6.
- Each entry keeps the stored `teamGameStats` values, the Penalty Summary cell, decision 152, the reason, the source URL, the page's sha256 and its fetch time (UTC).
- `buildTeamPpClock` uses an entry only when every one of these holds; otherwise the `teamGameStats` verdict stands:
  - the stored row still reads exactly as recorded in the entry;
  - the play-by-play is complete;
  - the audit finds 0 disagreements;
  - the clock equals the Penalty Summary total to the second.
- The output now says which reference was used (`referenceSource`: `teamGameStats` or `nhlPenaltySummary`).
- `official` still describes the stored row, which is never changed. `penaltySummary` carries the registry entry with the clock − summary difference, or null when the team-game has no entry.
- Tests from stored fixtures cover:
  - each of the 5 qualifies through the registry with its stored total kept, and the other team in each game stays on `teamGameStats`;
  - a clock ±1 s off the summary keeps the old verdict;
  - a missing or changed stored row makes the entry inapplicable;
  - incomplete play-by-play stays withheld even when the clock equals the summary;
  - the same plays under an unregistered game id keep the old verdict;
  - a verified zero stays "not applicable";
  - each registry entry's URL matches `buildNhlGameSummaryReportUrl`.

**Offline re-run** (`05-compare-clock.ts` on the same stored inputs; `results/after-d152/`):
- Exactly 5 of 3,790 team-games change, the five registered ones; nothing else moves. Qualified goes from 2,568 to 2,573.
- 2026-27 regular season: 618 of 618 team-games pass the clock check (609 with PP time, 9 verified zero), and 309 of 309 games qualify for both teams.
- `14-share-coverage.ts` on these results: 609 of 609 can display a share from shifts within the qualified PP intervals, with no player or unit time above the clock. 593 of 609 are consistent in the stored `powerPlayCombinations` table; the 16 that aren't are unchanged from section 9.

## 11. Decision 152 Part B: the PP share numerator (read-only)

TJ's decision 152: the numerator is player shifts (or shared unit intervals) within the qualified team PP intervals. It replaces the stored `powerPlayCombinations` calculation; there is no one-off rebuild. **Nothing here was written, wired or enabled.** All reads were guarded (hygiene gate, 10 s statement timeout, scalar columns or one extracted field, paged by game), with no NHL or NST calls. One audit query hit the 10 s timeout and was cancelled; it was replaced by weekly index-only reads, not retried.

### 11.1 Computed vs stored, 2026-27 regular season (`16-numerator-compare.ts`)

The comparison covers the 609 team-games that pass the clock check with PP time (the 607 plus the two scrum team-games from section 10). "Computed" means stored shift rows within the qualified v2 clock intervals, skaters only.

| Measure | Result |
|---|---|
| Team-games where every player agrees (PPTOI within 2 s, share within 0.005, same players) | **593 of 609** |
| Stored rows that agree | 7,152 of 7,190 |
| Stored unit labels reproduced by the writer's own rule (pivot plus the 4 with the most shared PP time, then PP2 the same way) | 7,172 of 7,190; all 18 misses are inside the 16 team-games below |
| Team-games that disagree | 16, in 14 games |

**No single cause explains all 16.** There are three groups, each traced with the stored rows' `created_at`, the writer's `cron_job_audit` runs and the three writer clock versions:
- **pre-11-01:** `getPowerPlayBlocks` at `d793446f9^`, production until 11-01.
- **11-01:** `d793446f9`, production from 11-01 until the v2 penalty clock shipped in #430 (11-12).
- **v2:** the penalty clock in production since #430 (11-12); `buildTeamPpClock` qualification (C1–C3) shipped in #434 and #436 (11-13).

**A. Stale pre-11-01 rows: 15 rows in 11 team-games.**
- Team-games: 2026020004 t23, 068 t5, 073 t30, 077 t5, 081 t14, 163 t12, 177 t14, 187 t22, 192 t18, 197 t24 and 207 t19.
- Each row's player has 0 PP seconds under both the 11-01 and v2 clocks. Its PPTOI and implied denominator match the pre-11-01 clock exactly, and it was created between 09-30 and 10-30.
- On 11-07 (21:29–21:30 UTC), a bounded re-run of every game dated 09-29 to 10-30 (32 batch calls; three more on 11-01 covered 10-31; `results/after-d152/writer-repair-runs.csv`) rewrote the other rows with the 11-01 writer.
- It kept these rows because the writer deletes a row only when the boxscore proves the player's shifts complete. The run's own `keptUnproven` counts are 2, 1, 4, 3, 1, 1, 2 and 1 by date: 15, exactly these rows.
- This group includes the "above the clock" case: 2026020197 t24 stores 49 s with a 120 s pre-11-01 denominator, against a 43 s clock.

**B. Overtime PP missing from player time: 18 rows in 4 team-games.**
- Team-games: 2026020161 t52, 174 t29, 192 t2 and 197 t23.
- The stored team denominator equals the clock, but the players on the ice in overtime are short by exactly the OT part of a PP span: 16, 44, 120 and 120 s.
- Production's own code (`master` `getPairwiseTOI` with `master` blocks, `19-production-pairwise-check.ts`) gives the full time on the stored shifts (378, 203, 356 and 448 s). So the shift feed the writer read live from the NHL on 11-07 lacked those OT seconds.
- The stored shift rows were loaded later, on 11-12. That feed isn't stored, so why it lacked the OT seconds is unknown.

**C. The 11-01 clock ends a PP early: 1 team-game (2026020131 t18).**
- The 11-01 clock gives one block, P1 8:11–8:40 (29 s). The v2 clock and the official total give 120 s.
- The stored rows hold 5 players at 29 s with share 1.0, and the other 5 skaters are missing.
- The 11-01 clock differs from v2 on this team-game only (608 of 609 agree). The row was written by the 11-07 re-run, before v2 shipped.

None of the three is an arithmetic error in the share formula. All three come from the stored table's inputs and versions (the pre-11-01 clock, a live feed at write time, and the 11-01 clock). Computing from stored shifts within the qualified intervals clears all 16 without a rebuild.

**An existing store already holds the same numbers.**
- `forge_player_game_strength.toi_pp_seconds` equals the computed numerator for **all 7,195** player-games (exact, 0 s). Those rows were updated on 11-12 and 11-13.
- *Corrected 11-13:* production's shift-chart writer (`lib/projections/ingest/shifts.ts` on `origin/master`) has used the same `buildPenaltyClock` since #430 (11-12), which explains the exact match. An earlier draft of this paragraph read a stale local `master` ref (11-10, situation codes).
- It is not gated by `buildTeamPpClock`, so a reader of it still needs the team-game qualification.

### 11.2 Cost of computing on demand, per page load

Measured with `17-cost-probe.sql` (`EXPLAIN ANALYZE`, 3 runs: team 2 cold and warm, team 10 cold; outputs in `results/after-d152/cost-probe-*.txt`) and `18-compute-timing.ts`. The existing indexes serve every input read: the PBP index `(game_id, sort_order)`, the shift indexes `(game_id, team_id, …)` and `(game_id, player_id, …)`, and the `teamGameStats` primary key. No sequential scans.

| Unit of work | Rows | Bytes | DB time, cold | DB time, warm |
|---|---|---|---|---|
| One team-game: PBP | 328–329 | 17.5–17.8 KB | 11–48 ms | <1 ms |
| One team-game: team shifts | 393–398 | 7.9 KB | 2–46 ms | <1 ms |
| One team-game: official row | 2 | — | 4–5 ms | <0.1 ms |
| One player season (18–21 games): player shifts | 450–556 | 9–11 KB | 253–432 ms | <1 ms |
| One player or team season: PBP | 5,630–6,757 | 304–363 KB | 414–554 ms | ~10 ms |
| One team season: team shifts | 6,952–7,920 | 195–222 KB | 614–1,247 ms | ~8 ms |
| *Today, stored:* one game | 25–29 | 0.8 KB | 3–6 ms | <0.1 ms |
| *Today, stored:* one player season | 17–20 | 0.4 KB | 24 ms | 0.2 ms |
| *Today, stored:* one player, all games (no index starts with `playerId`) | 88 | — | 59–82 ms | 1.3 ms |

Compute, the clock plus the audit for both teams plus intervals ∩ shifts, takes **12 ms per game** (p50 11.7, p99 14–15, max 19.5 ms) on this machine for all 309 games. A serverless function is likely 2–3× slower (an estimate, not measured).

**Per surface**

1. **`/lines/[abbr]` PowerPlayCombos** (every view, client-side, no cache).
   - Today: 2 `powerPlayCombinations` reads, about 70–85 rows and ~2 KB. It uses `unit`, plus PPTOI for ordering only.
   - On demand, for the current game plus the last 5 games of one team: about 2,000 PBP rows (~107 KB), 2,400 shift rows (~47 KB) and 12 official rows, in 3 batched queries.
   - Cost: roughly 0.3–0.6 s cold DB time (scaled from the season probes) or under 10 ms warm, plus about 40 ms of compute. That is about 75× the bytes, and today it would run in the browser.
2. **LinemateMatrix on `/lines/[abbr]` and `/lines/line-combo/[gameId]`, and the `/shiftChart` PP mode.**
   - Today: **3 uncached NHL requests per view** through `/api/cors` (shift charts, boxscore, play-by-play), with PP computed locally on the penalty clock without `buildTeamPpClock` qualification.
   - From stored rows instead: one game's PBP plus both teams' shifts (~1,130 rows, ~35 KB), under 100 ms cold or ~2 ms warm, and ~12 ms of compute. That is cheaper than today.
3. **`/charts` → `/api/toi`** (2 POSTs per load; PP needed in one).
   - Today it already reads the window's `forge_player_game_strength.toi_pp_seconds`, which equals the computed numerator, and `teamGameStats`. PP is withheld.
   - On demand for a season window it adds the window's PBP (5,600–6,800 rows, 300–360 KB, 0.4–0.55 s cold) plus 18–21 × ~7 ms of compute for the clock. Computing from shifts instead of FORGE adds the player's 450–556 shift rows.
4. **Rolling writer** (daily for the previous day's ~16 games × ~36 skaters; weekly over 14 days).
   - Today: per player, `powerPlayCombinations` by `playerId` in chunks of 100 career games.
   - On demand it would need the PBP of every career game for every player: about 165k rows (~9 MB) for a 500-game career, repeated for each of up to ~576 players a day. **Not feasible.**
5. **`team_unit_toi` writer** (nightly, at most 40 games).
   - Today it reads the shift rows plus `powerPlayCombinations`.
   - On demand it adds about 13k PBP rows (~0.7 MB) and ~0.5 s of compute. Feasible for a batch job.
6. **Planning deployment chips** (`lib/rosterScheduleData/planning.ts`; unit only, 32 games, 2 s deadline).
   - On demand: about 10.5k PBP rows plus about 25k shift rows. That is over 1–2 s cold, which **misses the deadline**.
7. **Social share modules** (unit only, up to 24 games or each skater's newest game) and the SQL `refresh_player_lineup_deployment_tallies` (season-wide unit join).
   - They need stored units. A SQL function can't compute this on demand.

### 11.3 Recommendation: (b) store the output of the same calculation, from one writer

On-demand computing suits one-game surfaces (item 2 is even cheaper than today). It doesn't suit the readers that need per-game values across many games: rolling history, planning, social share and the SQL tallies. Several readers need the same numbers, so the source of truth should be computed once per team-game and stored. This replaces today's calculation; it isn't a rebuild of the old one.

**Store** (proposal for separate approval; nothing done):
- **`powerPlayCombinations`, same columns** so readers keep working, with these definitions:
  - `PPTOI` = shifts ∩ qualified spans (skaters);
  - `pp_share_of_team` = PPTOI / qualified clock seconds;
  - `unit` = today's pivot and shared-PP-time rule, computed from the same intervals;
  - the unit-relative fields as today.
  - Add `calculation_version` and `computed_at`. Today `created_at` never changes on upsert, which is why section 11.1 needed the audit log.
- **New `pp_team_game_clock`** (game_id, team_id): `clock_seconds`, `qualified`, `unqualified_reason`, `reference_source`, official and Penalty Summary seconds, audit counts, `calculation_version`, `computed_at`. Readers gate on this row.

**Writer:**
- Rework `update-power-play-combinations/[gameId].ts` to read the stored `nhl_api_pbp_events`, `nhl_api_shift_rows` (type 517) and `teamGameStats` instead of live NHL HTTP.
- Call `buildTeamPpClock`, then intersect shifts with the qualified spans.
- When the inputs are complete (normalization complete, skater-seconds ≥ 3 × clock), replace the team-game's rows as a set in one transaction. That removes stale rows like group A. Otherwise write the clock row as unavailable and leave player rows unread.
- Run after that day's PBP, shift and `teamGameStats` loads.
- *Corrected 11-13:* `buildTeamPpClock` and C1–C3 are already in production (#434 and #436; the v2 penalty clock since #430). `getPowerPlayBlocks.ts` on `origin/master` equals `octoberBranch` before `db0310fa3`, so only the Part A registry is unreleased. The gap is the writer: it calls the default `getPowerPlayBlocks(plays)`, the unqualified clock, and never `buildTeamPpClock`. An earlier draft read a stale local `master` ref.

**Bounded refresh** (for TJ's separate approval), 2026-27 regular season, 309 games:
1. Dry-run first. It should change exactly the 16 team-games:
   - delete 15 stale rows (A);
   - update 18 rows (B);
   - update 5 rows and insert 5 (C).
2. Then 31 calls of 10 games each, concurrency 1, at least 5 s apart, with the hygiene gate before each call.
3. Reads are about 1,130 rows per game from the database. No NHL or NST calls.
4. After each call, read back:
   - the row count per team-game against the dry run;
   - share ≤ 1 and PPTOI ≤ clock;
   - units 1–3, with PP1 and PP2 at most 5 players each.
5. Stop on the first mismatch.
6. After that, the existing nightly schedule (08:05 UTC cron, last 3 days) keeps it current.

**Availability rules:**
- A qualified clock of 0 is **not applicable**, never 0%.
- These stay **unavailable**, never capped:
  - an unqualified clock;
  - missing PBP, shifts or official row;
  - incomplete shifts (skater-seconds < 3 × clock);
  - a player or unit above the clock;
  - a share above 100%.
- Readers show the reason.
- PP share stays withheld until the served values are verified.

**Reader changes to coordinate (named, not made):**
- `components/LinemateMatrix/index.tsx` and `utilities.ts` (PP mode), and `components/ShiftChart/model.ts`, should read the stored, qualified clock rather than computing on the unqualified clock from live NHL data.
- PowerPlayCombos needs only a gate on the clock row.
- `/api/toi` and the rolling writer need the clock row for the denominator.
- None of this touches `components/LineCombinations/utilities.ts`.

## 12. Decision 152: the stored-calculation writer (built offline; nothing applied or released)

TJ approved building the section 11.3 recommendation offline for review. **PP share stays withheld.** There is no apply, release, refresh, reader change or production write. The only database read was one guarded, bounded read for the fixture game 2026020163 (its 29 stored rows and the roster positions of the four fixture games).

**Writer** (`web/pages/api/v1/db/update-power-play-combinations/[gameId].ts`):
- It reads only stored rows: `games` (home, away and type), `nhl_api_pbp_events`, `nhl_api_shift_rows` (type 517), `nhl_api_game_roster_spots` (to tell goalies from skaters) and `teamGameStats`. It makes no live NHL calls and has no shift fallback.
- Per team: `buildTeamPpClock`, which includes the Part A registry, gives the clock and its qualification. Skater shifts are intersected with that team's clock spans. Units use the existing `sortByPPTOI` rule on shared PP time. Share is PPTOI divided by the qualified clock.
- **Unavailable** (clock row with its reason, no player rows):
  - an unqualified clock;
  - no roster with a goalie;
  - a shift player not in the roster;
  - a shift row with no period, start or end;
  - skater-seconds below 3 × the clock;
  - an impossible value.
- A qualified clock of 0 is **not applicable**. Nothing is capped.
- The game's player rows and both clock rows go to `replace_power_play_game_v1` in **one call** (one transaction).
- `?dryRun=true` returns the exact diff (inserted, deleted, updated with before and after values, unchanged) and writes nothing.
- The batch route's call is unchanged. `keptUnproven` is always 0, because the replace keeps no row it didn't recompute.

**Migration** `supabase/migrations/20261113220000_pp_team_game_clock.sql`, **not applied**:
- It adds `calculation_version` and `computed_at` to `powerPlayCombinations`.
- It creates `pp_team_game_clock` (availability, reason, clock, reference source, official and Penalty Summary seconds, audit counts, skater-seconds) with CHECKs, RLS and read grants.
- It adds `replace_power_play_game_v1` (invoker security, empty search path, `service_role` only). It refuses any player row for a team-game that isn't available, PPTOI above the clock or not summing to skater-seconds, a share other than PPTOI / clock (including a capped one), more than 5 players in PP1 or PP2, duplicate players and foreign teams.
- Authority row 149 is pending; `supportedBaselineMigration.test.ts` and the super-goal summary count are updated to 149.

**Tests:**
- **Postgres proof** (`supabase/tests/f11_pp_team_game_clock.py`, disposable PostgreSQL 15): RESULT OK, 28 checks.
  - Before the migration no replace exists.
  - After it, one call takes the game's 12 earlier rows out and puts 10 in. Group A's stale rows are gone and group B's overtime seconds are restored.
  - 12 bad payloads are each refused, including two failures raised after the delete, and the stored set stays unchanged every time.
  - A qualified zero is stored as not applicable. The rollback restores the schema exactly.
- **Vitest** (`update-power-play-combinations-game.test.ts`, 17 tests, real stored fixtures):
  - **Group A**, 2026020163: the 3 stale players get no row, and the other 26 rows equal the stored rows exactly.
  - **Group B**, 2026020174 team 29: 203, 169, 161 and 158 s including 44 s of overtime, with the stored units.
  - **Group C**, 2026020131 team 18: 120 s with all 10 skaters (112 s at most per player), not 29 s with 5.
  - **Availability:**
    - a zero clock is not applicable;
    - each of seven unavailable causes is reported with its reason and no player rows;
    - duplicated shift rows don't push a player above the clock.
  - **Write path:**
    - the dry run writes nothing, reads only the six stored tables and makes no network call;
    - a write is one RPC call with no row-by-row delete or upsert;
    - a refused replace writes nothing.

**Dry-run diff, fixture 2026020163:**

| Change | Rows |
|---|---|
| Deleted | 3: 8476958 (unit 3, 34 s, share 0.141667), 8478970 (unit 3, 34 s, 0.141667), 8480336 (unit 2, 41 s, 0.170833). These are the team-12 group-A rows. |
| Updated | 0 |
| Inserted | 0 |
| Unchanged | 26 |

Both clock rows are available: home 22 at 297 s (skater-seconds 1,485) and away 12 at 126 s (630).

**Write gate (TJ, 11-13):**
- Writes stay off until TJ approves them. Both routes and the writer function check `PP_STORED_CALCULATION_WRITES_ENABLED`; anything but `"true"` (unset by default) is off.
- **Off:**
  - a non-dry-run call reads and writes nothing (no replace RPC);
  - it answers `success: true, skipped: true, reason: "pp_stored_calculation_writes_disabled"`;
  - it is audited as **skipped**, not as a failure (decision 42); this includes the nightly cron 388 call;
  - the rolling-forge pipeline treats it as a successful step.
- **Dry runs** work either way.
- **On:** the writer above.
- **TJ's accepted tradeoff:** from the release of this code until TJ approves writes and sets the flag, new games get **no `powerPlayCombinations` rows**. Readers that use them (rolling writer, Lines, planning, social share) see those games as missing.

**Release order, for separate approval:** apply the migration (TJ's pop-up), then release the writer (writes off), then run the bounded refresh from section 11.3 (dry run first; the write phase needs the flag set on its target). Readers stay withheld until the served values are verified. Reader changes are named in section 11.3 and are not part of this build.

## 13. Decision 152: dry-run tooling for the refresh (built offline; not run)

TJ wants the full dry-run diff before any refresh. Nothing here ran against a database, a route or a provider.

**Batch route** (`update-power-play-combinations/index.ts`):
- **`dryRun=true`** passes the flag to every game. The response carries every game's full result: its two clock rows, the computed player rows and the diff (deleted rows, updated rows with before and after values, inserted rows, unchanged count), plus totals.
- **Full diffs, never truncated.** At the 60-game cap that is about 0.5 MB, well under the response limit.
- **A dry run writes nothing at all.** A complete, successful dry run skips even its `cron_job_audit` row, through `withCronJobAudit`'s `skipAuditWhenNoOp`, on both the batch route and `[gameId]`, as F9's and F15's routes do. A failed dry run, a non-2xx response and every real write keep their audit row, so the nightly cron is unchanged.
- **`concurrency`** takes a whole number from 1 to 4; anything else is refused before any read. The default is unchanged.
- **The 60-game cap** still applies to `gameIds`.
- **The nightly cron (388) call is unchanged:** the same two-argument writer call at the same concurrency, and the same response shape (a test pins the exact keys).

**Runner** `20-refresh-runner.py` (not run):
- **Scope:** the frozen list `results/after-d152/refresh-batches-2026-27-regular.json` (309 games, 618 team-games, 31 batches of up to 10), pinned by its sha256.
- **`dry` phase:**
  - each batch runs with `dryRun=true&concurrency=1`, one call at a time, at least 5 s apart, with `hygiene.sh` before each;
  - it saves `dry-run.json` and prints its sha256;
  - it checks the result against section 11.1. Exactly the 16 team-games may change: the 15 deletes, the 23 PP-time or share updates and the 5 inserts, all as listed. Other fields may change only inside those 16 (unit averages).
  - It expects 618 qualified clock rows with the after-c1-c2 seconds, 609 available and 9 not applicable. Anything else exits 4.
- **`write` phase:**
  - it runs only with that dry-run file and its approved sha256;
  - it uses the same batches at concurrency 1, at least 5 s apart;
  - after each call it reads the batch back over bounded `psql`: rows, values, clock availability and `calculation_version`;
  - it stops on the first mismatch and prints the resume point (`--start-batch`).
- **Stops:** any non-200, any call over 60 s, a failed or skipped game, or a busy database. The only HTTP target is `--base-url`, and provider hosts are refused.
- **Offline self-check:**
  - a synthetic dry run built from the Part B data passes the check;
  - an extra change outside the 16, an unavailable clock and a missing delete each stop it;
  - a wrong dry-run hash is refused before any call.

**What the target must be:**
- **For the dry run:** a deployment running this writer, batch route and the Part A registry. Production today has none of them. Either release the code first or run a local dev server on loopback against the production database: a successful dry run only reads.
- **For the write phase:** migration 20261113220000 must also be applied first.
- Each of these steps needs its own approval.

## 14. Decision 152: the local dry run (TJ approved; before migration 149 or any release)

**Candidate:** `8f73d2931`. The writer, the batch route and their whole import closure are identical in the working tree.

**Nothing was written:** no production write, no audit row, no cron change and no NHL or NST call.

**Read-only, enforced by the database:**
- The pooler drops `PGOPTIONS` startup options: a test session showed `transaction_read_only = off` and a 2 min timeout.
- So each export session instead ran `SET default_transaction_read_only = on`, then `START TRANSACTION READ ONLY` with a local 10 s statement timeout. All 31 session logs show `transaction_read_only = on` and `10s`.
- A write attempted inside such a transaction is refused (`cannot execute CREATE TABLE in a read-only transaction`, rolled back).
- **Disclosure:** before that, my first probe ran `create temporary table` outside a read-only transaction. It was a session-only temporary table, dropped at disconnect, and touched no stored data.

**Export** (`21-export-dry-run-inputs.py`):
- 31 frozen batches, one at a time, at least 5 s apart, with the hygiene gate passing before each; each took 1–4 s.
- Scalar columns only:

  | Source | Rows |
  |---|---|
  | `games` | 309 |
  | `nhl_api_pbp_events` | 99,128 |
  | `nhl_api_shift_rows` (type 517) | 231,749 |
  | `nhl_api_game_roster_spots` | 12,360 |
  | `teamGameStats` | 618 |
  | `powerPlayCombinations` | 7,190 |

- The raw CSVs stay outside the repository. `results/after-d152/local-dry-run/export-manifest.json` records every file's sha256 and row count.
- **Export hash** (sha256 of the manifest): `bbcba75cebc65e45edd51d201e3f9fef05e20ab37d0280e4d4106bd41805c145`.

**Dry run** (`22-local-dry-run.ts`):
- The candidate batch route ran unchanged, with `dryRun=true&concurrency=1`, against a fake client that answers only from the export.
- Only the auth, audit and off-season wrappers were stubbed (`22-local-dry-run.stubs.ts`), so no Supabase client or service key exists in the bundle. Migration 149 wasn't needed, because a dry run reads no new table.
- All 31 batches returned 200 in 0.13–0.21 s each.
- **Dry-run sha256** (`results/after-d152/local-dry-run/dry-run.json`, in the refresh runner's format with its gate included): `db94a9de864b9dfa8fa69f24c6be9045dd037ed1937393c3b03dd69d9ec4f15c`.

**Reconciliation, all 618 team-games** (`23-reconcile-local-dry-run.py`, which applies the runner's own gate):

| Result | Team-games |
|---|---|
| Unchanged | **593** |
| Changed | **16** |
| Not applicable (zero clock, no player rows) | **9** |
| Flagged | **0** |

- **Clocks:** 618 rows, all qualified with the expected seconds: 609 available, 9 not applicable, 0 unavailable.
- **The 16 changed team-games** match section 11.1 exactly:
  - **15 deletes:** the stale pre-11-01 rows;
  - **23 PP-time or share updates:** the overtime rows, and 2026020131 t18's 5 rows going from 29 s to their full time;
  - **5 inserts:** 2026020131 t18's missing skaters.
- **14 further updates** are within the 16 and are expected: teammates in the overtime team-games whose unit average moved. Only `percentageOfPP`, `pp_unit_usage_index`, `pp_unit_relative_toi` and `pp_vs_unit_avg` change: 2026020161 t52 (3), 2026020174 t29 (6), 2026020192 t2 (1) and 2026020197 t23 (4). No player changes unit anywhere.
- No other row in the season changes. The 2 Part A team-games qualify on the Penalty Summary and are unchanged.
- **TJ approved this dry-run file** (2026-11-13T20:54Z, in the F11 session): TJ typed "approved", then picked "Dry-run file only" in the pop-up. The approval covers `dry-run.json` sha256 `db94a9de864b9dfa8fa69f24c6be9045dd037ed1937393c3b03dd69d9ec4f15c` and nothing else.
- **Status, 2026-11-13, per the Chef** (TJ approved each step by pop-up in the Chef session):
  - Migration 149 was applied atomically at 20:36:48Z with a clean readback; the authority file shows 115 applied and 6 pending.
  - Release #441 (master `f5c7adc2d`, writer code identical to `8f73d2931`) shipped with writes gated off: build 20:49:42Z, smoke test 5/5.
  - TJ then set `PP_STORED_CALCULATION_WRITES_ENABLED=true` in Production. A clean-export CLI production deploy of `f5c7adc2d` was running at the time of this note.
- **The refresh is not approved.** (`20-refresh-runner.py write --dry-run results/after-d152/local-dry-run/dry-run.json --dry-run-sha256 db94a9de…`.) The Chef brings it to TJ after the deploy is verified. This lane doesn't run it unless told who does.
- **Once the redeploy is live, nightly cron 388 writes with the new writer.** It covers dates from today minus 2 to today, so it may write some frozen games (from 11-12) before the refresh. It uses the same calculation, so the refresh's readback still holds as long as their stored inputs haven't changed since the export.

## 15. Decision 152: PP share reader gates (built offline for TJ's serving review; not released or served)

According to the Chef, the refresh is done: 31 of 31 batches matched `db94a9de`, and production has 7,180 stamped 2026-27 rows and 618 clock rows. Every reader below sits behind one server-side flag, **`PP_SHARE_SERVING_ENABLED`**. Unset, or anything but exactly `"true"`, keeps today's behaviour: PP share withheld.

**Shared rules** (`web/lib/ppShare/serving.ts`), the same for every reader:
- The team-game's `pp_team_game_clock` row decides:
  - **available** (clock above 0): PP time and share, where share = stored PPTOI / `clock_seconds`. In an available team-game the stored set is complete, so a skater with no row had 0 s.
  - **not_applicable** (a qualified 0): **"N/A"**, never 0%.
  - **unavailable, or no row:** the row's reason, or "No stored PP clock for this team-game yet."
- A missing player value, or player PP time above the clock, is withheld with its reason. **Nothing is capped.**
- **Live PP views** (LinemateMatrix, ShiftChart) are shown only when their own team PP seconds equal the stored qualified clock. Otherwise the disagreement is the reason.

**Readers:**
- **`/api/toi` and the TOI chart:**
  - Each game point gets stored PP minutes and share (%) from the player's team clock row (the team comes from FORGE's row for that game), plus `powerPlayShareStatus`. `powerPlayStatus.available` becomes true.
  - The chart plots N/A and withheld games as gaps and adds one note, for example "N/A for 1 game with no power play. Withheld for 1 game: (reason)".
  - With serving off, the response is unchanged (pinned) and the PP tables are never read.
- **Rolling writer** (`fetchRollingPlayerAverages` and `rollingPlayerPpShareContract.resolveServedPpShareComponents`):
  - With serving on, `pp_share_pct`'s denominator is the clock row's seconds for every dressed game, with no builder-share or WGO fallback.
  - A missing stored row adds 0 of the clock. N/A adds 0 of 0. An unavailable game, a missing clock row or a player above the clock adds nothing.
  - With serving off, no clock rows are read and the components are unchanged.
- **PowerPlayCombos (Lines):** one gate request covers the current game plus its 5-game history.
  - The units show only when the current team-game is available. N/A and unavailable show the label or the reason instead.
  - The history keeps only available games.
  - A failed gate request fails closed, with the units withheld and a reason shown.
- **LinemateMatrix PP mode and ShiftChart's replay matrix:**
  - These still compute pairs from live shift data, but a team's grid shows only when that team's stored clock is available and equals the view's own PP seconds (`getTOIData`'s new `ppSecondsByTeam`; `model.ts` `ppSecondsByTeam`). N/A and unavailable teams show the label or the reason.
  - While the clock loads, PP mode says "Checking the stored power-play clock..." rather than showing ungated values.
  - The PP and PK bands on the replay timeline are unchanged: they show manpower context, not a share.
- **Client gate:** `GET /api/v1/pp-share/team-game-clock?gameIds=…` (at most 60 games) returns `{ servingEnabled, clocks }`.
  - With serving off it reads nothing.
  - Its answer is cached for up to about 5 minutes, so a flag change takes that long to reach the client readers.

**Untouched:** `LineCombinations/utilities.ts`, `pages/lines/[abbreviation].tsx` (the gate sits inside PowerPlayCombos), and shift ingestion and fallback. No stylesheet changed: the new messages reuse each component's existing status styles.

**Serving-off differences** (the rendered output and API JSON are otherwise unchanged):
- the three client readers make one cached gate request;
- LinemateMatrix and ShiftChart in PP mode show "Checking…" until it answers.

**Checks:**
- 12 files, 220 tests:
  - shared rules 10 and API route 7;
  - `/api/toi` 15 and TOI chart 4;
  - rolling contract and writer 90;
  - PowerPlayCombos 16;
  - LinemateMatrix, Replay and model 34;
  - the decision-152 writer suites, unchanged.
- `npm run typecheck` exit 0; ESLint on all 20 changed files exit 0.

**Not done:** turning serving on in production, a release, and any check of real served pages. That is TJ's serving review.

## 16. Decision 152: serving-review evidence for the reader gates (TJ's acceptance criteria)

**1. Serving off leaves the rolling writer's stored output unchanged, field for field.**
- `fetchRollingPlayerAverages.ppServingPin.test.ts` runs the writer's real `main` in dry-run mode over a fixture window: one player, six games, every clock outcome, PP rows present. It captures the 60 rows it would upsert (ranking and support).
- The baseline, `__fixtures__/rolling-pp-share-flag-off-baseline.json`, was recorded by running the same harness against the writer before the gates. Both files at `05c43f981^` are identical to `origin/master`.
- **Serving off:** the rows equal the baseline exactly, and `pp_team_game_clock` is never read.
- **Serving on:** the only changed leaves, nested support payloads included, are `pp_share_pct` fields.
- No other writer was touched in the reader-gate work.

**2a. Qualified team-game 2026020131, team 18 (`decision152CrossSurface.test.tsx`)**
- This uses real stored rows: full PBP, the 743 type-517 shift rows, roster spots and official totals from the read-only export, plus shooter and scorer ids from one bounded read-only read.
- The stored rows themselves come from the decision-152 writer run on those same inputs.
- Every surface, with serving on:

| Surface | Clock | Per-player PP seconds | What it shows |
|---|---|---|---|
| Stored calculation (`powerPlayCombinations`) | 120 s, available, `teamGameStats` | PP1: 8475158 112, 8474564 111, 8476539 110, 8474600 110, 8476887 109. PP2: 8476869 11, 8480246 10, 8477021 10, 8484241 9, 8479525 8. | share = PPTOI / 120: 0.933333, 0.925, 0.916667, 0.916667, 0.908333, then 0.091667, 0.083333, 0.083333, 0.075, 0.066667 |
| `/api/toi` | 120 s | the same seconds (PP minutes × 60) | the same shares as %: 93.33, 92.50, 91.67, 91.67, 90.83, 9.17, 8.33, 8.33, 7.50, 6.67; status available |
| LinemateMatrix PP mode | live 120 s = stored 120 s, available | the same seconds (matrix diagonal) | the team-18 grid; PP1 average 110.4 s, PP2 9.6 s, a 92.0% / 8.0% split |
| Shift chart model (served) | qualified 120 s = stored, available | the same seconds | the same grid |
| Lines PowerPlayCombos | available | not shown (the stored PPTOI only orders players) | PP1 = 8474564, 8474600, 8475158, 8476539, 8476887; PP2 = the other five |

- **Finding: the shift chart's PP bands are wrong today.**
  - The replay's play parser drops situation codes, so its power-play bands give team 18 **29 s**, the 11-01 clock's wrong value. This is production behaviour today, and serving off keeps it (pinned).
  - With serving on, the PP-mode matrix uses a new qualified set of intervals: the same clock as the stored calculation, with the game's own teams. That set gives 120 s.
  - The timeline's PP bands still use today's intervals even with serving on. Switching them is a separate decision.

**2b. Zero-PP team-game 2026020038, team 55** (official "00:00", "0/0")

| Surface | What it shows |
|---|---|
| Stored calculation | not applicable, clock 0, no player rows |
| `/api/toi` | share null and status `not_applicable` for every team-55 skater; PP minutes 0, which is the team's actual PP time, not a share |
| LinemateMatrix PP mode | "Team 55: N/A: no power play in this game.", with no 0.0% cell |
| Shift chart | "(team): N/A: no power play in this game." |
| Lines PowerPlayCombos | "N/A: no power play in this game.", with no units |

No surface shows 0% as a share. Both live views also compute 0 s for team 55.

**3.** No shift ingestion or shift-fallback code is touched. Every surface reads stored shift rows only, put into the live feed's shape inside the test.

**Checks:** 14 files, 224 tests (the 220 earlier plus the pin 2 and cross-surface 2); typecheck exit 0; ESLint exit 0. No `.module.scss` changed.

## Open items for the owner (Chef to route)

Decided in decision 151 (2026-11-13): O1 ±2 s inclusive; O2 and O3 stay withheld; O4 read-only check done (section 9). Decision 152 (2026-11-13) accepts the Penalty Summary for the five O4 team-games (section 10). The original wording is kept below.

- **O1. Tolerance.** Rule 4 uses ±2 s; the two cases at 1 s are boundary rounding. The alternative is exact match only, which withholds 2 more team-games (1 of them in 2026-27).
- **O2. Placeholder seasons.** 2025-26 has 879 team-games with real PP time but no official total. Decision 144 requires the official comparison, so they stay withheld. Qualifying them on complete PBP plus the aligned audit alone would be a new owner decision; repairing them needs a re-fetch, which is out of scope here.
- **O3. The six clock-refusal games.** Two fail on 1-second-early expiries; the clock could tolerate a ±1 s observation at an expiry. They stay withheld until then.
- **O4. Mismatch adjudication.** The 5 scrum games can only be settled against the NHL HTML Penalty Summary, which isn't stored. They stay withheld with their raw values.

## Reproduce

Run from the repository root. `$S` is any scratch directory.

```bash
D=tasks/artifacts/calculation-inventory-2026-11-10/master/production/pp-clock-validation-2026-11-13
$D/hygiene.sh                                   # gate: exit 3 when busy
sed "s#OUT_CLASSES#$S/classes-2025-2027.csv#" $D/03-run-summary.sql > $S/03-run.sql && cp $D/03-classify-teamgamestats.sql $S/ && (cd $S && $TMPDIR/pgpool.sh -f 03-run.sql)
$D/04-fetch-pbp.sh $S/classes-2025-2027.csv 20262027 $S/pbp 10
$D/04-fetch-pbp.sh $S/classes-2025-2027.csv 20252026 $S/pbp 10
web/node_modules/.bin/esbuild $D/05-compare-clock.ts --bundle --platform=node --format=esm --tsconfig=web/tsconfig.json --loader:.scss=empty --outfile=$S/compare.mjs
node $S/compare.mjs $S/classes-2025-2027.csv $S/pbp $S/out          # → team-game-results.csv, summary.json (results/after-c1-c2 since de4650c77)
# 06-inspect-games.ts: same build; node inspect.mjs <classes.csv> <pbp_dir> <gameId>...
# 10-fetch-shifts.sh + 11-shift-numerator-check.ts: same pattern for the numerator check
# 12-fetch-pp-combinations.sh <classes.csv> 20262027 2 $S/ppcombos  (guarded, read-only)
# 14-share-coverage.ts: same build; node share.mjs <after-c1-c2/team-game-results.csv> $S/pbp $S/shifts $S/ppcombos results/normalization-status-2025-2027.csv <out>
# 13-fetch-penalty-summaries.sh $S/o4-html  (exactly 5 nhl.com requests, 10 s apart; decision 151 only)
# python3 -I 15-parse-penalty-summary.py $S/o4-html/GS-<gameId>.HTM
# decision 152: rebuild compare.mjs at the registry commit, rerun into $S/out-d152, then share.mjs on it (results/after-d152)
# 16-fetch-numerator-provenance.sh <classes.csv> $S/provenance  (guarded; created_at + writer audit runs)
# 16-numerator-compare.ts: build with the aliases in its header; node numerator.mjs <after-d152 results> $S/pbp2026 $S/shifts $S/ppcombos $S/provenance <out>
# 17-cost-probe.sql: hygiene.sh, then psql -v game= -v team= -v player= -v games= -f 17-cost-probe.sql
# 18-compute-timing.ts and 19-production-pairwise-check.ts: build and run as their headers say
```

Raw PBP and shift pages stay outside the repository (about 550k and 230k rows). Only the per-team-game results and the summaries are committed in `results/`.
