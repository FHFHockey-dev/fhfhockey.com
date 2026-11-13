# Decision 152 packet: PP share (Chef, 2026-11-13 ~20:05Z)

PP share stays **withheld**. Nothing here approves serving it or writing repairs. Evidence: `REPORT.md` §10–11, F11 commits `db0310fa3` (Part A) and `9c3541aa8` (Part B). The Chef checked the counts against `results/after-d152/`.

## 1. Five-game reference exception (Part A): verified
`buildTeamPpClock` judges one of the 5 registered team-games against its NHL Penalty Summary only when all of these hold:
- the `teamGameStats` check would otherwise fail;
- PBP is complete and the audit is 0;
- the clock equals the summary to the second;
- the stored `teamGameStats` row still reads exactly as recorded.

In every other case the old verdict stands.

The output names `referenceSource` and keeps both totals plus the reason, URL, page sha256 and fetch time. The stored total is never changed.

- **Tests:** 74 pass.
- **Offline re-run:** exactly the 5 registered team-games change.
- **Production effect:** none yet. `buildTeamPpClock` has no production caller, and the registry isn't released (it's excluded from the item 1 candidate).

## 2. The 16 mismatches: three causes, no single one
These are 2026-27 regular-season team-games: **593 of 609 agree** (PPTOI within 2 s, share within 0.005, same players).

| Group | Rows / team-games | Cause | Evidence |
|---|---|---|---|
| A | 15 rows / 11 | Stale rows from the pre-11-01 clock. The 11-07 re-run kept them because the writer deletes a row only when it can prove a player's shifts complete. | The re-run's `kept_unproven` sums to exactly 15 (Chef recount). This group includes the "above the clock" row, 2026020197 t24. |
| B | 18 rows / 4 | Overtime PP seconds were missing from the live NHL shift feed the writer read on 11-07. The stored shifts loaded on 11-12 have them. | The team denominator equals the clock, and players are short by exactly the OT part of a span. |
| C | 5 rows + 5 missing / 1 | The writer's older block function ends 2026020131 t18's PP after 29 s; the qualified clock and the official total give 120 s. | The two disagree on only this team-game (608/609 agree). |

None of these is a formula error. All three come from the stored table's inputs and the writer's version.

**Correction to F11's report (§11.3):** the qualified clock (`buildTeamPpClock`, C1–C3) is already on master, via #434 and #436. Only Part A is unreleased. The gap is that the writer `update-power-play-combinations/[gameId].ts` still calls the older default `getPowerPlayBlocks(plays)` on live NHL data.

## 3. Cost: on demand vs stored (full page and cron)
| Surface | On demand | Verdict |
|---|---|---|
| Rolling writer (daily, ~576 players) | The PBP of every career game, per player: about 165k rows / 9 MB each | **Not feasible** |
| Planning deployment chips (32 games, 2 s deadline) | ~10.5k PBP + ~25k shift rows, over 1–2 s cold | **Misses the deadline** |
| Social share modules, SQL lineup tallies | A SQL function can't compute it | **Needs stored units** |
| `/lines/[abbr]` PowerPlayCombos | ~75× today's bytes, 0.3–0.6 s cold, computed in the browser | Worse than stored |
| `/api/toi` season window | +5.6–6.8k PBP rows, 0.4–0.55 s cold | Feasible, but slower |
| LinemateMatrix, `/shiftChart` PP | ~1.1k stored rows, under 100 ms. Today it makes 3 uncached NHL calls per view on the old clock. | On demand is cheaper than today |
| `team_unit_toi` nightly writer | +13k PBP rows, ~0.5 s | Feasible |

Compute is 12 ms per game (p99 15 ms) locally, and every input read uses an index.

## 4. Recommendation: store the output of the same calculation, from one writer
Several readers need per-game values across many games, and three of them can't compute on demand. So compute shifts ∩ qualified PP intervals once per team-game and store it; readers then read one source of truth. This **replaces** today's calculation; it isn't a one-off rebuild of the 14 games.

### Exact next step: offline build for review (F11, no production action)
1. **Writer:** `update-power-play-combinations/[gameId].ts` reads the stored PBP, the stored shift rows and `teamGameStats`, with no live NHL calls and no shift-fallback code (Codex owns that).
   - It calls `buildTeamPpClock` (including the Part A registry), then intersects shifts with the qualified spans.
   - It replaces each team-game's rows as a set in one transaction, which clears group A's stale rows.
   - A dry-run mode reports the exact diff.
2. **Migration file only, not applied:**
   - `powerPlayCombinations` gains `calculation_version` and `computed_at`;
   - a new table `pp_team_game_clock` (game, team, clock seconds, qualified, reason, reference source, official and summary seconds, audit counts, version, computed_at) that readers gate on.
3. **Tests:** fixtures for groups A, B and C; the availability rules (a qualified 0 is not applicable; an unqualified clock, missing inputs, skater-seconds below 3× the clock, or a player or unit above the clock stay unavailable, never capped); and transactional replace.
4. **Ownership:** claim the files in the mailbox first. No reader changes.

### Then, each with its own approval
1. Migration apply.
2. Release the writer and Part A.
3. Refresh dry run: it must change exactly the 16 team-games (delete 15, update 18, update 5, insert 5).
4. Bounded refresh: 31 calls of 10 games, concurrency 1, at least 5 s apart, guard first, readback, and stop on the first mismatch.
5. Served-value verification.
6. Reader gates.
7. The separate decision to show PP share.
