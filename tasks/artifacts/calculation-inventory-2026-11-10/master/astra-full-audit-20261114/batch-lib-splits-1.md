# Splits and legacy weekly goalie writer

Frozen `89da739cb45d7d572ed59bfa0b209c79c5d99299`. Four complete source reads, 1,608 lines, 499 ledger entries. Hashes in `batch-lib-splits-1-manifest.json`. Verdict: accept with findings. Probe: `splits1-probe.cjs` and `splits1-probe-output.json`; supplied Vitest source read, not run.

## AFULL-SPLIT1-01 — P1 — missing skater measurements become measured zeros

- **Location/claim:** `web/lib/splits/splitsServer.ts:159–161,473–490,720–820`; rule 21 and denominator qualification apply to all skater totals/rates, including nullable PP clocks.
- **Evidence/scenario:** exact `buildSkaterRows` with one supported row but `goals_es`, hits, blocks and PP seconds null returns goals/hits/blocks 0, PP seconds/GP 0 and PP share 0. `safeNumber` discards missingness in both totals and clocks. An empty player matchup also returns GP 0 and P/GP 0, a numeric rate without a denominator. Landing skater aggregation repeats nullable-count conversion.
- **Fix:** track field-specific coverage and supported appearances; preserve unknown totals, rates and shares, and return null for a zero-denominator rate. Use the strict penalty-shot adapter when split support is required, without re-adding legacy PS counts.
- **Readers/tests:** Splits API roster/landing, skater table and PP displays. Existing supplied tests concentrate on goalie missingness and do not pin these skater cases. Probe reproduces the failure; no hosted observation.

## AFULL-SPLIT1-02 — P1 — PP share denominator includes unrelated teams

- **Location/claim:** `splitsServer.ts:684–691,790–791,1123–1139,1167–1172`; a player's PP ice share must use the selected team's matching PP clock.
- **Evidence/scenario:** selected NJD skater has 60 PP seconds against TOR, NJD has 120: share 0.5. Adding another team's 600 PP seconds against TOR changes it to **0.083**. The reducer filters opponent only. `includeLanding` defaults true and loads league-wide `teamStrengthRows`; the roster builder receives that entire set. This makes the same roster metric depend on whether unrelated landing data was requested.
- **Fix:** pass and require selected team identity, then align team/game support before summing clocks. Test both `includeLanding` modes with identical selected-team evidence and unrelated-team rows.
- **Readers/tests:** Splits selected-team skater PP% and any reader of its API roster. The exact pure builder probe confirms the 50%→8.3% change; existing supplied tests omit it.

## AFULL-SPLIT1-03 — P1 — team results substituted for individual goalie decisions

- **Location/claim:** `splitsServer.ts:891–973,1046–1056`; goalie W/L/OTL must use the credited individual result; decision 40 restricts **Quality Starts** to the starter, not every result.
- **Evidence/scenario:** two appearing goalies, starter 2 and reliever 3, team WIN. Aggregation always records W=1 for 2 and W=0 for 3. For a game in which the official result belongs to the reliever, these values are wrong: official wins/losses are not even selected by `fetchOfficialGoalieGameLogs`. The supplied test explicitly expects the starter to receive the win and thus pins the flawed shortcut. The exact probe reproduces this assignment; it is a synthetic scenario, not a claim about a particular NHL game.
- **Related missingness:** absent credited starter leaves QS unavailable but exposes starts/W/L/OTL as zero. Absent team result is also indistinguishable from known no-decision.
- **Fix:** read qualified per-goalie result fields and aggregate those independently of start/QS eligibility; retain unknown decisions/starts with coverage. Extend the existing test with a reliever credited with a decision and missing official labels.
- **Readers:** Splits goalie roster W/L/OTL/GS and derived QS denominator. Existing shared Vollman classification itself remains intact.

## AFULL-SPLIT1-04 — P1 — goalie numerator mixes game types with a regular-season QS baseline

- **Location/claim:** `splitsServer.ts:272–285,986–998,1018–1030,1152–1156`; matchup counts/rates and the QS reference must share season/game-type scope.
- **Evidence/scenario:** the game query selects every game type in the current season; matchup game IDs and landing rows retain all of them. Only the league QS baseline filters `type === 2`. In the exact `buildGoalieRows` probe, one type-1 game (4 GA/60 min) and one type-2 game (1 GA/60 min) yield GP 2, GA 5, GAA 2.5. Restricting to type 2 gives GP 1, GA 1, GAA 1. The nonregular start would also be classified against the regular-season league baseline.
- **Fix:** define and apply one game-type/finality universe before both goalie totals and reference calculations; expose separate scopes if nonregular games are intentionally offered. Add actual membership assertions to the existing suite.
- **Readers/tests:** goalie landing leaders, matchup roster, QS/QS%, GAA and save percentage. Probe uses an in-memory client for the two named tables only; source services are never contacted. Stored finality is not selected either; live incomplete-game admission remains an additional source risk pending the producer trace.

## AFULL-SPLIT1-05 — P1 — standalone weekly writer has no bounded write gate

- **Location/claim:** `web/lib/supabase/GoaliePage/updateWeeklyData.ts:25–75,93`; executable writers need explicit bounds, dry-run/write gating and safe resume behavior (§4.5).
- **Evidence:** full frozen source, plus bounded context reads of `goaliePageWeeks.js`, `fetchGoalieDataForWeek.js` and `upsertGoalieData.js`. The entrypoint calls itself at module load, fetches every week of a dynamically selected season, and immediately upserts `goalie_page_weeks` by `index + 1`; it has no date/game/run manifest, dry-run, approval flag or completed-week exclusion. Child upserts also write goalie/player and league average rows by week ID alone. No script invocation was performed and no active schedule or package-script caller was found in the targeted caller check.
- **Scenario:** invoking the entrypoint with configured service credentials starts provider calls and rewrites weeks 1 onward without a preview. Selecting a new season reuses the same week IDs and replaces earlier week dates/stat keys. A later write error is caught and returned, so a partial update can still exit successfully.
- **Fix:** retire the legacy entrypoint if superseded, or require an explicit bounded, season-qualified plan and dry-run default, qualified inputs, resumable checkpoints and nonzero failure status before any write. Do not run it for audit verification.
- **Readers:** `goalie_page_weeks`, `goalie_page_stats`, `league_averages_goalies` and their weekly consumers. Missing write guards meet the prompt's P1 definition despite no demonstrated scheduled execution; this is not a production-write incident claim.

## Retained checks and limits

- Shared goalie save-percentage pooling and Vollman classification survive. Nullable goalie ratios/clock support are tracked independently; measured zero shots, positive-clock zero events, penalty-shot zero-duration appearances, unknown participation and possible relief shutout exclusions remain distinct.
- Valid versioned PS counts are added once to skater all-situation totals; legacy markers do not double-add them. Seconds-to-GAA conversion is per 3,600 seconds, and public fraction outputs are rounded consistently.
- Team options normalize strings and preserve explicit unavailable values; alphabetical defaults are deterministic. Current-roster membership is used for historical grouping, leaving trade-history attribution and current-roster-only PP shot denominators as limitations requiring a separately scoped provenance check; no new verified trade finding is claimed.
- The first probe failed on the inert server proxy's `__esModule` metadata access, before exercising code. Allowing that harmless import marker while keeping real accesses denied resolved the harness issue. The extended game-type probe uses only an in-memory two-table client. No application imports, environment reads, real DB/provider requests, Vitest, build, server or page load occurred. The weekly entrypoint was never imported.
