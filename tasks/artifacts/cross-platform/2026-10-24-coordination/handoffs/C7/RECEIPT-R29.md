# C7 ticket 29 — review of RSO wave-1 commits `e5975452c`, `649421f09`, `0f8a09fff`

**Reviewer:** Claude C7 lane session (not the author). Read-only: no `web/` edits, no Git mutations, no `GIT_DIR`, no live reads.
- I reviewed the **commits**, not the working tree (RSO-RECON is editing it).
- Tests ran under the outbound network-deny preload, against `git archive 0f8a09fff` at `/private/tmp/c7-r29`.
- One read-only research subagent inspected the FORGE writer code; I spot-checked its key claims myself.
- Evidence is in `r29-evidence/`.

| Commit | Verdict |
| --- | --- |
| `e5975452c` forgeDailyBridge: unknown supplements stay unknown; goalie shares bound to team and season | **Accept with limits** (B1 medium, B2–B4) |
| `649421f09` RosterScheduleOptimizer test race | **Accept** |
| `0f8a09fff` offline daily acceptance suite | **Accept** |

## Tests

| Run | Result |
| --- | --- |
| `forgeDailyBridge.test.ts` at `0f8a09fff` | **58/58** |
| Same tests, bridge source reverted to `e5975452c^` | **42/58.** The 16 new tests fail: PP-TOI boundaries 0 s/6 s/7 s/120 s/null, unknown season rates, no-totals skaters, rows that record a stat, team and season binding, and others. |
| `dailyAcceptance.manual.test.ts` plus `planning.test.ts` | **173/173**: 28 acceptance, including the 2 `it.fails`, which pass while D1 and D2 exist, plus 145 planning |
| My goalie-binding controls (`bridgeC7.test.ts`, the owner fixture plus 3 cases) | 3/3 after correcting my own expectations. Run 1 (`c7-goalie-run1.log`) expected 0.7 and found **1.0**, which is finding B1. |

`649421f09` (test-only) and `0f8a09fff` (a new file) have no meaningful parent run. For the flake I didn't reproduce the injected-delay race.

## 1. Does every null flow to withheld or incomplete? Yes.

- **In the bridge:**
  - `round(null)` returns `null` (`forgeDailyBridge.ts:44`).
  - Season-rated stats are `rates?.[key] ?? null`, and GWG is `null` unless `gwgShare` is finite (`skaterStats`).
  - Players without season rows get **no** league fallback, so their entry is absent and their stats are `null`, counted in a new limitation line.
  - Rows that don't record a stat no longer count it as 0 (`seasonRates`, the per-key `{games,total}`).
- **Points (`planning.ts` `gameForecastPoints`):** every weighted, applicable key must be `finite`, or the total is `null`. Weight-0 and non-applicable keys are skipped. There is no NaN path (`finite(total)` is checked). Unweighted keys don't withhold anything.
- **Category totals (`planning.ts:866-880`):** a non-finite stat adds its key to `missing`, which then becomes `stats[key] = null`. `categoryValue` returns `null`, the category result is `"unknown"`, and a limitation reads "Projected KEY is incomplete."
- **Plan value:** a `null` game value adds "projected outcome is incomplete", and the acceptance suite asserts `projectedValue` is `null` and `comparisonEligible` is false for a missing head.
- **No zero regressions.** The only remaining explicit 0s are deliberate:
  - PP heads with stored PP TOI ≤ 6 s (the declared policy);
  - `PLUS_MINUS`'s league mean of 0;
  - a rate actually read as 0 (tested: "a rate read as zero stays 0").
- **PK heads:** these are no longer zero-filled, since `modeledHeadTotals` doesn't model them; TOI treats a missing PK TOI as 0 only inside the TOI sum. The writer always stores PK as `null`, so this matches.
- **UI:** I didn't browser-check it, but these values reach the UI only through the same null-aware plan fields.

## 2. Coverage risk: what the FORGE writers actually store

From the writer code at `0f8a09fff` (subagent research, spot-checked):
- **Writer:** `web/lib/projections/stages/skater-stage.ts:3201-3232`, persisted via `persistForgePlayerProjectionRows` into `forge_player_projections`.
- **PP TOI:** `proj_toi_pp_seconds: Math.round(p.toiPp * teamHorizonTotalScalar)` (`:3212`). Always an integer; **never null** in current code. `toiPp` is NaN-guarded with `safeNumber`.
- **PP heads:** `proj_goals_pp`, `proj_assists_pp` and `proj_shots_pp` are always numbers (0 or tiny when PP TOI is 0).
- **PK:** `proj_toi_pk_seconds`, `proj_*_pk` are always `null` (`:3213…`).
- **Schema:** all of these columns are nullable with no default (`production_schema_baseline.sql:8451-8460`).

**So "FORGE writes null PP TOI for non-PP skaters" doesn't happen in current runs, and current rows lose no forecasts.**

**B3 (low-medium, historical runs):**
- From `6e14053ff` (2026-10-11) to `cb8ed5217` (2026-10-24), the writer passed rows through `applySupportedSkaterConversionHeads`. That set `proj_goals_pp`/`proj_assists_pp` to **null** when the skater had no PP conversion denominator, while PP TOI stayed numeric.
- A skater with no PP rolling metrics defaults to **120 s** before allocation (`:2111-2114`). After allocation, call-ups, recent trades, or teams without an official PP-usage map can keep PP TOI well above 6 s.
- If the bridge reads such runs, those skaters now get **no forecast** ("unknown"); before, they got 0 PP production.
- Size unknown offline. A bounded, ask-first read would settle it: count rows with `proj_goals_pp IS NULL AND proj_toi_pp_seconds > 6` in the runs the bridge reads.

**B4 (info, by design):** removing the league-rate fallback means skaters with **no season totals** (rookies, call-ups) now have unknown PIM, +/-, SH points, GWG and faceoffs. In a points league that weights any of those, their totals are withheld; in category leagues those categories are incomplete. This is honest, and counted in the new limitation line.

## 3. Goalie trade and season binding

- **Binding:** a share row counts only if it is finite, `row.team_id === goalie.nhlTeamId`, and `Math.floor(game_id / 1e6) === Math.floor(seasonId / 1e4)`. NHL ids `YYYYTTNNNN` give `YYYY`, so `2026020095` gives 2026, matching `20262027`.
- **Owner tests:** cover the current team, a traded goalie's newer old-team row being ignored, another season's row being ignored (`2025030417`), and the stale-share limitation count.
- **My G2:**
  - a malformed 8-digit id (`20260201`) is ignored;
  - a **preseason** id from the same year (`2026010050`) counts as this season. That is acceptable, but preseason deployment rarely reflects the regular-season role.
- **This game first:** `exactShares` keyed by `game_id:player` is preferred over the latest bound row.

| # | Severity | Finding |
| --- | --- | --- |
| **B1** | **Medium** (pre-existing rule, now hit more often) | **When a teammate's share is unknown, the known goalie becomes a certain starter.** Without an exact FORGE row, start probabilities are renormalised over the goalies **with** a share: `shares.get(id) / (mass || 1)` (bridge `known` branch; the same in `e5975452c^:440-442`). The new binding makes unknown teammates more common: a traded-in goalie with no current-team row, or a goalie without `nhlTeamId`. The incumbent's 0.7 share then becomes **1.0**. **My G3:** g1 has a 0.7 row for TOR, and g2's only row is from his old team; the result is `[g1: 1, g2: null]`. That gives a certain start, more confidence than the evidence supports, against the commit's own "unknown stays unknown" intent. **Fix:** when any rostered goalie on the team lacks a bound share, keep the known goalies' raw shares unnormalised, or withhold the team's start probabilities. |
| **B2** | Low | **A goalie with no `nhlTeamId` is silently left out.** He is absent from `goalieTeams` (and from `goaliesByTeam`), so all his rows are "unbound", but `staleShareGoalies` counts only goalies **with** a team id. **My G1:** the "another team or season" note doesn't count him. Combined with B1, his teammate then shows 1.0. Count him in a limitation, e.g. "N goalies have no current NHL team; start chances unknown". |

## 4. `649421f09`: a real fix, not a mask

The test used to call `releaseCache` as soon as `releaseProvider` existed. Under load the app issues the stored-eligibility read **after** the provider request (it waits on the `/data` generation), so `releaseCache` could still be unassigned. The fix waits for **both** resolvers to exist before releasing. The assertions are unchanged (no "Reading stored Yahoo positions" text, `eligibilityVerified` becomes true), and the product code is untouched. It corrects a wrong ordering assumption in the test; nothing is skipped, retried or loosened.

## 5. `0f8a09fff`: do the acceptance scenarios assert the contract? Yes, mostly.

- **Independent oracles, not echoes of internal results.** Examples:
  - 13 active slots filled only via the C/LW player;
  - `projectedValue` computed from fixture lines (`value()`/`fp()`) rather than read from the planner;
  - a move submitted after puck drop credits only the next day;
  - a next-day league's effective time is exactly 04:00Z;
  - unknown timing can't make a move legal;
  - a missing head gives `projectedValue` `null` while schedule capacity stays at 13;
  - no automatic must-keep;
  - a protection isn't a lock;
  - refresh never replaces selected moves, and Undo restores them.
- **D1** (reserve moves not rechecked on refresh) and **D2** (projected goalie starts after the minimum) are pinned as `it.fails`, with a written defect report (`tasks/artifacts/rso-wave1-2026-10-25/MANUAL/DEFECTS.md`) giving the expected-vs-actual and the code lines. Their setup assertions pass; only the defect assertion fails, which is the right pinning.
- **Note (info):** several cases assert exact limitation strings (e.g. "Next-day acquisition stream is effective too early."), which ties them to copy. That is acceptable for a contract suite, but copy edits will need test updates.
