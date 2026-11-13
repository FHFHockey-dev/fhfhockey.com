# PP clock validation (decision 144; decision 71; L8 W2-P0-13)

Lane F11, 2026-11-13. A separate validation lane: not part of tonight's release or the Astra snapshot. **PP share stays labelled unavailable sitewide; nothing here changes that.** No application code was changed and nothing was written to production.

## Headline

- **The reconstructed clock matches the official NHL team PP time to the second on 2,493 of 2,500 comparable team-games (99.72%)** across 2025-26 and 2026-27 (preseason, regular season and playoffs). Two more differ by 1 s. Five differ by 28 s to 2:00, all in coincident-penalty scrums with fights, majors or misconducts. In each of those five, every interior situation code agrees with the clock, so the gap is NHL accounting that stored evidence can't settle. They are withheld, and the raw values are kept.
- **The decision-144 risk cases all reconcile** (counts are comparable team-games in games with that feature): overtime PP 172/172 exact; shootout games 207/207; 5-on-3 454/456; penalty expiry across a period 921/924; pulled goalie during a PP 343/346, plus 2 within 1 s; double minors 205/206; coincident penalties 1,115/1,120.
- **Legacy placeholder "00:00":** 3,728 team-game rows hold "00:00" even though the team had at least one PP opportunity. 2025-26 has 881 in the regular season (games 2025020467–476 and 2025020657–021095, dated 2025-12-09 to 2025-12-10 and 2026-01-04 to 2026-03-20), and 2024-25 has 2,392. The clock confirms real PP time in all 879 that it can check. **They can't be repaired from stored evidence:** right-rail is not stored, the stored boxscore and landing payloads carry no PP TOI, and the HTML summary is only memory-cached. 2026-27 regular season has none.
- **Smallest verified display scope:** per-game player PP time and PP share for **2026-27 regular-season team-games that pass the rules below: 607 of 618 show a share, 9 show "not applicable" (verified zero), and 2 are withheld** (2026020036 team 68 and 2026020153 team 9). 307 of the 309 games qualify for both teams. Season-to-date windows for teams 68 and 9 would be a labelled covered subset, or unknown.
- **Three code gaps stand between today's contract and that scope** (none fixed here):
  1. `buildTeamPpClock` never compares against the official total. On `octoberBranch` it would mark 5 mismatched team-games and 856 placeholder-row team-games `qualified`.
  2. The situation-code audit is stricter than the clock at stoppage events. It rejects 117 team-games that agree with the official total, 40 of them in 2026-27 regular season.
  3. Match penalties recorded as `MAT`/15 are unsupported, so 4 games error out. A what-if run treating them as 5-minute majors gives 8/8 exact matches.

## Premise check: repository state on 2026-11-13

- The brief described the flag as `PP_CLOCK_QUALIFIED = false`. On `octoberBranch`, commit `24b1cb4d3` (2026-11-12, "Qualify DRM strength clocks…") replaced L8's simulation with `web/lib/projections/penaltyClock.ts` (source `fhfh-nhl-penalty-context-clock-v2`) and set `PP_CLOCK_QUALIFIED = true` in `web/utils/getPowerPlayBlocks.ts:439`. The per-game `qualified` is now complete PBP && 0 situation-code disagreements. `master` has neither change.
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

- **C1, `web/utils/getPowerPlayBlocks.ts` `buildTeamPpClock`:**
  - Take the official reference (`powerPlayToi`, `powerPlay`) as an input.
  - Return `officialSeconds`, `officialClass` and `diffSeconds`.
  - Set `qualified` only when rules 1–4 hold.
  - Map "00:00"/"0/0" plus a clock of 0 to a verified "not applicable" state.
- **C2, same file, `auditPpBlocksAgainstSituationCodes`:** skip period-start, period-end, game-end, stoppage, penalty and goal events, and any second with a penalty or goal, to match the clock's own observation rules. Test cases: 2026020002, 2026020058, 2026020093.
- **C3, `web/lib/projections/penaltyClock.ts` `unitsForPenalty`:** accept `MAT` with duration 15 (the match major and the game-misconduct minutes recorded together) as one 5-minute major. Verified 8/8 exact on the 4 stored games.
- **C4, storage (L8 proposal; owned by L4a; needs a migration and a production step):**
  - A `team_pp_clock` table holding seconds, spans, source, official seconds, official class, difference, qualified flag, reason and audit counts.
  - It would be written by `update-power-play-combinations/[gameId].ts`, which already builds these blocks.
- **C5, `web/pages/api/v1/db/update-stats/[gameId].ts:487-503` and `getPPTOI`:** stop writing "00:00" on failure. Keep the value unknown, which needs a nullable column or a status column (a migration), so that new placeholders stop appearing.
- **C6, readers (owned by L4b and L6):**
  - `/api/toi` serves `powerPlayStatus.available = true` per qualified game, with "not applicable" for a verified zero.
  - `fetchRollingPlayerAverages` passes `teamPpClock` only for qualified games, with windows per rule 7.
- **C7, numerator:** `powerPlayCombinations.PPTOI` (shifts ∩ blocks) is already the right definition. It needs a per-game coverage contract, because a missing row is currently unknown, not 0 (L8 note).

## Open items for the owner (Chef to route)

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
node $S/compare.mjs $S/classes-2025-2027.csv $S/pbp $S/out          # → team-game-results.csv, summary.json
# 06-inspect-games.ts: same build; node inspect.mjs <classes.csv> <pbp_dir> <gameId>...
# 10-fetch-shifts.sh + 11-shift-numerator-check.ts: same pattern for the numerator check
```

Raw PBP and shift pages stay outside the repository (about 550k and 230k rows). Only the per-team-game results and the summaries are committed in `results/`.
