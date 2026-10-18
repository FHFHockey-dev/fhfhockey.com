# Exact-five power-play units: contracts, key, oracle and proposal (S-17)

Lane S-17, handoff `planned/04-exact-five-power-play-groups.md`. Offline only. There were no hosted DB, provider, Vercel or NST calls, no ingestion and no git mutation. A passing fixture is not real-data acceptance.

## 1. What already exists (inspected contracts)

| Surface | File | What it really is | Consequence for exact-five |
|---|---|---|---|
| Validated shift + PBP strength | `web/lib/projections/ingest/shifts.ts` | `buildShiftStrengthUpserts` (`:423`) is the strict gate. It requires final PBP, `typeCode 517` rows, positive duration, exact `end - start = duration`, a zero-end sentinel only at the played period end (`:527`), shifts inside the played period, both teams present, and full situation coverage per shift. A failure throws, so the game is held. | **Reuse as the hold.** Exact-five must only run on games that pass this. |
| PBP situation timeline | same, `buildSituationTimelineForPeriod` (`:138`, not exported) | It builds a piecewise-constant timeline from event `situationCode`s. When several events share a second, the last by sort order wins (`:252`). It must cover 0 to the played end with no gaps. | Manpower is **event-sampled**. A penalty that expires between events leaves the code stale until the next event. |
| Coarse strength | same, `strengthForTeam` (`:94`) | `pp` / `pk` / `es` come only from skater-count comparison. Goalie digits are ignored, so 6v5 with an extra attacker is labelled `pp`, and 5v4, 5v3 and 4v3 all collapse into `pp`. | The `pp` label **cannot** qualify a five-skater unit. |
| Relationship segments | same, `buildShiftRelationshipStrengthSegments` (`:649`) | Splits each validated shift by `pp` vs. non-`pp` (`pk` is folded into `es_shifts`, see `shift-charts.ts:867`). | Same coarsening. |
| Line Combination Matrix | `web/pages/api/v1/db/shift-charts.ts:887-952` | `time_spent_with` is a **pairwise** overlap summed over every pair of shift rows, at **all strengths**, split by same vs. mixed position type. | Pairwise only. Five pairwise-linked players may never be on together (fixture 1006). Summing over shift pairs would double count duplicate rows. |
| Raw stints | `web/lib/supabase/Upserts/nhlShiftStints.ts:195-268` | A boundary sweep producing simultaneous on-ice sets. It dedupes only exact duplicates (`:136-164`) and is lenient: `end <= start` falls back to duration. There is no `type_code` filter; goal rows are dropped only because they lack a duration. It carries no position, goalie or strength information. | It shows that simultaneous sets can be built, but it **bypasses** the strict gate, so exact-five does not build on it. |
| Unit TOI | `supabase/migrations/20260622150500_create_team_unit_toi.sql`, `web/lib/rankings/teamUnitToiBuilder.ts` | Pooled **player-seconds** (`toi_basis = pooled_player_seconds`). Its 5v5 is inferred from the active skater count (`:336`). | Not clock time, so never a unit-TOI denominator. |
| "PP units" today | `web/pages/api/v1/db/update-power-play-combinations/[gameId].ts:127-131` | Players are sorted by PPTOI and **sliced into groups of five** (0–4, 5–9, 10+). | Not observed membership. A PP1 built this way may never have shared the ice. |
| Reported units | `web/lib/lines/types.ts:49` (`PPDecision`, `SelectedLineUnit`, `LineClaim`) | Tweet and line-report claims with provenance, binding and certainty. | A separate source. It is joined for display, never overwritten (§5). |
| Goalie identity | `nhl_api_game_roster_spots.position_code` | Roster-bound position, including `G`. | The only goalie evidence in the shift rows, cross-checked against the situation digits. |

Not verified: live coverage of `nhl_api_shift_rows`, `nhl_api_game_roster_spots` and PBP for any season; how often the timeline lags at penalty expiry; and whether stored raw rows ever include duration-bearing non-517 rows.

## 2. Canonical identity and interval semantics

- **Unit key:** `x5:` followed by the five distinct positive integer player ids in ascending numeric order, for example `x5:7-9-42-110-1001`. `buildExactFiveUnitKey` and `parseExactFiveUnitKey` round-trip it, and the parser rejects non-canonical strings.
- **The key carries no context.** Team, game, season and manpower travel beside it. The aggregation identity is `(teamId, manpower, unitKey)`, and each observation is bound to `gameId` and `gameDate`, so a key is valid only for the team and game it was observed in.
- **Intervals** are half-open `[start, end)` in whole seconds since period start and never cross a period. Fixture 1002 shows one unit over P1 1100–1200 and P2 0–20: two intervals, 120 seconds.
- **Presence** is the union of a player's own rows, so duplicates and overlaps count once. Fixture 1003 has 150 overlapping seconds and is credited 100.
- **Unit time** is the measure of the instants when exactly those five skaters were on. A team's intervals within one game are disjoint, so the per-game sum is exact. The summary refuses a repeated game result.
- **Never** sum pooled player-seconds (5 × 60 = 300 for a 60-second unit) or pairwise overlaps (more than 60) as unit time. Both are asserted in tests.

## 3. Manpower qualification

At every instant, for each team, the PBP class must agree with the shift census:

| Class | Rule (own / opponent) | Treatment |
|---|---|---|
| `5v4` | goalie 1/1, skaters 5/4 | qualifies |
| `5v3` | goalie 1/1, skaters 5/3 | qualifies, kept **separate** from 5v4 |
| `4v3` | goalie 1/1, skaters 4/3 | excluded (not a five-skater unit), reported |
| `own_net_empty` | own goalie 0 | excluded (extra attacker), reported |
| `opponent_net_empty` | opponent goalie 0 | excluded, reported |
| `other_advantage` | any other advantage | excluded, reported |
| `even`, `shorthanded` | — | not PP |

Inside a qualifying class, a second is attributed only if the shift census shows exactly one goalie per team, exactly 5 own skaters, and the expected 4 or 3 opponent skaters, with every on-ice player's position known. Otherwise the second is **unknown**, with the first failing reason in this order:

1. `unknown_position`
2. `goalie_presence_conflict`
3. `team_skater_count_mismatch`
4. `opponent_skater_count_mismatch`

Every qualifying second is attributed or unknown, never both. The cross-check is what fixes PBP lag: in fixture 1007 the penalized skater returns 30 seconds before the next event, and those 30 seconds become `opponent_skater_count_mismatch` instead of 5v4 time. Diagnostics `shiftOnlyAdvantageSeconds` (shifts show 5 vs. 4/3 while PBP doesn't) and `duplicateShiftSeconds` are reported, not attributed.

**Game holds:** the whole game is excluded with reasons and no intervals for:
- `shift_validation_not_passed`
- `pbp_not_final`
- `roster_scope_unbound`
- `upstream_hold` (the upstream text is kept verbatim)
- `invalid_shift_interval`
- `shift_team_not_in_game`
- `invalid_situation_timeline`

Exact-five never repairs a held game.

## 4. Files, fixtures and oracle results

New files only:
- `web/lib/exactFivePp/exactFivePpUnits.ts`: the pure library (key, classification, per-game sweep, summary).
- `web/lib/exactFivePp/exactFivePpOracle.ts`: the independent oracle. It samples every whole second and runs a direct point-in-interval test on raw rows. It shares no code with the library and has no union or boundary sweep.
- `web/lib/exactFivePp/exactFivePpFixtures.ts`: 9 hand-computed synthetic games plus a seeded noisy generator.
- `web/lib/exactFivePp/exactFivePpUnits.test.ts`: 30 tests.

| Fixture | Covers | Hand-computed home result |
|---|---|---|
| 1001 | transition, one-player substitution, full change | A 60, B 30, C 30; shift-only advantage 10 |
| 1002 | period boundary | A 120 in two intervals |
| 1003 | duplicate and overlapping rows | A 100; duplicates 150 |
| 1004 | missing shift | A 70; unknown team count 30 |
| 1005 | 5v3 → 5v4 → extra attacker → opponent empty net → 4v3 | A 5v3 30, A 5v4 70; excluded 30/30/40 |
| 1006 | every pair of {101..105} shares ice, never all five | 4 other keys, 30 each; the target key is absent |
| 1007 | PBP lag at penalty expiry | A 120; unknown opponent count 30 |
| 1008 | upstream shift hold | excluded, no intervals |
| 1009 | missing goalie shift, unrostered skater | A 30; unknown goalie 20 and position 50 |

The multi-game summary gives unit A (5v4) 570 seconds over 7 games, first 2026-10-01, latest 2026-10-17 (game 1009). The home denominator is 880 seconds of 5v4 and 30 of 5v3, 130 seconds are unknown, and coverage is 780/910. Game 1008 is listed as excluded.

Checks actually run (local):
- `npx vitest run lib/exactFivePp/exactFivePpUnits.test.ts`: **30/30 passed**. This includes oracle agreement on all 8 included fixtures for both teams, and on **300 seeded noisy games** (a non-vacuity guard requires more than 20 games with attributed units).
- `npx eslint lib/exactFivePp`: clean.
- A targeted `tsc --noEmit --strict` over the four files: clean. The full-project `tsc` was not run.
- **Mutation check** on scratchpad copies, 308 games each:

  | Mutation | Mismatches |
  |---|---|
  | drop the opponent-count check | 128 |
  | drop the goalie check | 158 |
  | closed-interval boundary bug | 203 |
  | 5v3 mislabelled as 5v4 | 231 |
  | skip the per-player union | 0 |

  Skipping the union is an *equivalent* mutant for membership, because boundaries include every raw edge. The union only feeds `duplicateShiftSeconds`, which fixture 1003 asserts.

## 5. API/UI contract proposal (not built)

Proposed read-only route: `GET /api/v1/teams/{teamId}/pp-units/observed?season=&from=&to=&manpower=5v4|5v3`. The response follows.

```jsonc
{
  "version": "exact_five_pp_v1",
  "source": "observed_shifts",           // never "reported"
  "team": { "teamId": 10, "window": { "from": "...", "to": "...", "seasonId": 20262027 } },
  "denominators": {
    "gamesInWindow": 12, "gamesIncluded": 11,
    "gamesExcluded": [{ "gameId": 0, "holdReasons": ["shift_validation_not_passed"] }],
    "pbpQualifyingSeconds": { "5v4": 0, "5v3": 0 },
    "attributedSeconds": { "5v4": 0, "5v3": 0 },
    "unknownSeconds": { "team_skater_count_mismatch": 0, "...": 0 },
    "attributionCoverage": 0.0,           // attributed / qualifying; null if no PP
    "excludedAdvantageSeconds": { "4v3": 0, "own_net_empty": 0, "opponent_net_empty": 0, "other_advantage": 0 }
  },
  "units": [{
    "unitKey": "x5:...", "playerIds": [], "manpower": "5v4",
    "sharedClockSeconds": 0, "shareOfAttributed": 0.0,
    "gameCount": 0, "firstGameDate": "...", "latestGameDate": "...", "latestGameId": 0
  }],
  "reported": [{                          // joined, never merged
    "unitNumber": 1, "decisionId": "...", "designation": "reported",
    "playerIds": [], "claimSources": [{ "author": "...", "sourceUrl": "...", "originalPublishedAt": "..." }],
    "observedMatch": { "unitKey": "x5:...", "sharedClockSeconds": 0 } | null,
    "observedStatus": "matched" | "partial_overlap" | "not_observed" | "insufficient_coverage"
  }]
}
```

UI and copy rules:
- Label the view "Observed exact-five PP units (past games)". Show clock time as `m:ss`, plus games, latest appearance and coverage.
- Never call a unit "PP1". Unit ranks come from observed clock time, not from the reported unit number.
- The reported card keeps the original author, URL and time from `LineClaim` untouched.
- When the two sources disagree, show both, with `observedStatus` and the reason. `not_observed` does not disprove a reported unit, and `insufficient_coverage` applies when unknown or excluded seconds or missing games could hide it. Neither source overrides the other.
- Show the heuristic disclaimer: past shared-five usage describes history, not the next lineup.
- Keep it apart from the Date Range Matrix (pairwise) and `team_unit_toi` (pooled), and label each surface's basis.

## 6. Bounded implementation proposal (next steps, each needs approval)

1. **Adapter (small, local):** export `buildSituationTimelineForPeriod` from `shifts.ts`, or add a sibling exporter. Then write `buildExactFiveInputFromValidatedGame(gameId, pbp, shiftRows, rosterSpots)`. It calls `buildShiftStrengthUpserts` and maps a throw to `upstream_hold`, keeps only `typeCode === 517`, applies the zero-end sentinel the same way, and reads positions from `nhl_api_game_roster_spots`. It touches `shifts.ts`, which is outside this lane.
2. **Offline replay** on locally cached raw payloads only, if any exist. No fetch.
3. **Storage** (later, needs a migration approval): `team_pp_exact_five_intervals(game_id, team_id, period, start_s, end_s, unit_key, manpower, version, source hashes)` plus a per-game coverage row. Intervals rather than totals, so windows re-aggregate exactly.
4. **Route and UI** per §5, with reported-unit joins read-only from the line snapshots.

## 7. Measured coverage plan

Metrics computed per game and team, all from the library outputs (no new logic):
- `attributionCoverage` = attributed / PBP-qualifying seconds, by manpower.
- Unknown seconds by reason. The rate of the lag signature (`opponent_skater_count_mismatch` right before a PBP 5v4 → 5v5 change) estimates event-sampling lag.
- `shiftOnlyAdvantageSeconds`, the converse disagreement.
- Excluded games by hold reason, as a share of games in the window.
- The share of a team's attributed time held by its top observed key, for comparison against the PPTOI-slice "unit 1" from `powerPlayCombinations`. This measures how often the top-5-by-PPTOI slice is never a real five.

Measurement stages:
- **A.** Offline fixtures. Done.
- **B.** Local replay over any cached raw payloads already on disk. No fetch.
- **C.** A read-only Supabase sample. ❓ Needs TJ approval: about 20 final games across 10 teams of the current season, at most 5 sequential reads per table at concurrency 1, no writes.

Acceptance gates before any public display: median `attributionCoverage` ≥ 0.9 for 5v4, and unknown seconds itemised. Below the gate, the UI shows "insufficient coverage" instead of units. The thresholds are a proposal for TJ.

## 8. Remaining decisions (for TJ / Chef)

1. Should unknown seconds near PBP changes be trimmed by penalty-expiry inference (penalty start + duration, or a PP goal on a minor)? This lane keeps them unknown.
2. 4v3 and 6v4/6v5: should they be shown as separate four- and six-skater groups, or stay excluded?
3. Whether, and how, to apply the adapter's one-line export to `shifts.ts` (outside lane ownership).
4. Approval for the stage-C read-only sample.
5. The coverage gate threshold, and whether 5v3 is shown at all, given small samples.
6. Storage: a new table vs. derive on read (needs a migration decision).
