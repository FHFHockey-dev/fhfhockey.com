# A1/U2 historical SOG consistency — synthetic research contract

Version: `sog-historical-descriptive-research-v1`, 2026-10-22. **A1 here is the research task in the October 20 master list, not audit issue A1.** This is an executable specification and fictional fixture package, not application implementation, forecast validation or a release candidate. It is the one bounded follow-up to [the readiness report](../REPORT.md); other hypotheses keep their existing prerequisites and owners.

## Question and scope

For the selected player's historical log window, how often did an observed appearance contain at least 2, 3 or 4 official SOG, and what was the distribution of observed SOG? Describe supplied observations only. No next-game probability, betting recommendation, calibrated consistency score, forecast adjustment, expected value or trade-value inference follows.

First scope: one skater, one season, one explicit regular-season or playoff population, all-strength official SOG counts. Do not substitute attempts, Fenwick, xG, team SOG or per-60 rates. No goalie, opponent/home-away split, strength split, role weighting or additional category is included.

## Existing conventions reused and integration gaps

`SOURCE-REFERENCES.json` pins the actual local source bytes inspected. The package does not import the application or rerun its tests.

| Existing source | Convention and relationship to this package |
| --- | --- |
| `web/components/PlayerStats/playerStatsContract.ts:16–24` | Eastern league calendar date (`America/New_York`). Dates in these fixtures are already normalized league dates; they are not converted using the machine's timezone. |
| Same file, `:42–78` | Reuse the page's provider season bounds (or its existing Sep 1–Aug 31 fallback) and selected season. Do not derive a different season window for this widget. The package takes those bounds as inputs and checks both season ID and date. |
| Same file, `:80–99` | Sort log ascending and select last10/20/30; season/custom keeps caller-scoped rows. The new frequency denominator is calculated **after** that fixed log window. Unknown or zero-shot rows do not cause older rows to enter the window. |
| Same file, `:101–105`; `PlayerStatsSummary.tsx:22–32` | An appearance requires `Number(games_played) > 0`. The normalized per-game domain here is numeric `1`, `0`, or `null`; positive aggregate GP values or strings require adapter normalization/rejection, not implicit coercion in this arithmetic. This preserves the existing predicate for admitted per-game values. |
| Same file, `:108–176` | Missing provider rows are not proof of absence; future/same-day schedule entries are not missed games. Keep confirmed nonappearances and unconfirmed schedule context outside SOG observations. |
| Same file, `:185–235`; `types.ts:29–30` | Missing numeric values are not zero. `shots` is a nullable count. Existing summary shots are totals; this new mean is total **observed** SOG divided by observed-SOG appearances, not by all appearances when counts are missing. |
| `web/pages/stats/player/[playerId].tsx:813–818,1041–1055` | Current log selects date/stats without stable game ID or team-at-game metadata; its fallback can come from another season. Neither is enough for this specification's identity/coverage admission. A separately scoped adapter must supply identity/finality/source coverage, retain team stints and reject wrong-season fallback. Do not wire this reference function straight into the page. |

Extra conservative scope for the first slice: only qualified final games **strictly before** `asOfDate`; exclude the current Eastern calendar day even if a game has just finished. Label the panel “Through [previous Eastern day].” This is an explicit daily-complete scope, not a claim that the existing page excludes every same-day log row. If the page supports same-day final data, integration must coordinate its window and wording rather than silently show different periods under one label. Intraday participation/finality is outside this slice.

The date cutoff is an event-date rule. It does not prove the stats were available at a past decision time. This panel is retrospective, using the currently admitted snapshot; it must not be reused as a leakage-safe backtest without publication/receipt clocks and revision policy.

## Input admission and window ordering

The test packet explicitly supplies `playerId`, `seasonId`, `phase`, `seasonWindow`, `asOfDate`, `window`, `populationCoverage`, `unconfirmedScheduleGames` and `rows`. These are fictional assertions, not discovered source quality. `populationCoverage` describes the **requested scope** after accounting for pagination, upstream errors and missing game-log support; a short successful query alone cannot certify completeness. The unconfirmed schedule count is contextual, not an estimate of missing appearances, and must be scoped to the same window by an eventual adapter.

Each normalized row has canonical player/game/team-at-game IDs, a league date, season, phase, explicit finality, `games_played` and `shots`. All source observations and exclusions must retain their provenance outside this narrow numeric summary. Missing/invalid raw source fields must reach normalization with an unavailable reason, not be converted via `Number(null)` or `Number("")`. The reference accepts explicit `null` for unavailable SOG/participation and rejects malformed numeric inputs rather than deciding provider-specific parsing policy. It permits no finite-fractional, negative, infinite, boolean or string SOG counts, nor per-game GP beyond 0/1/null.

Order:

1. Validate normalized identities/fields. A packet is for one canonical player, across all their team stints.
2. Deduplicate by canonical player + game identity, **before** selecting last N. Exact repeated observations collapse and are counted. Conflicting SOG, missingness, GP, team, date, phase, season or finality reject the packet. Do not sum duplicates, choose the largest count, or silently take the last row. A separately qualified upstream correction/receipt policy must resolve revisions before invocation.
3. Apply season ID and the existing season date bounds, the selected regular/playoff phase, strict historical day/finality scope, and custom dates inclusively if selected. Report exclusion counts. Exclusion counters are mutually exclusive in this precedence order.
4. Sort ascending by league date; stable game ID resolves same-date ordering. Distinct IDs do not by themselves prove distinct real events: the adapter must certify identity, not generate IDs from rows. If same-date events make the existing page's boundary ambiguous, resolve the canonical event ordering upstream rather than choosing the newest SOG observation.
5. Apply last10/20/30 to those log games. Season/custom retains the scoped log. GP=0 or GP=null log rows occupy their existing selected-log slot; the panel must not label that as “10 appearances” unless all ten are confirmed appearances. Do not backfill missing SOG with an eleventh row.
6. Within that fixed selection, separate confirmed appearances (`GP=1`), confirmed nonappearances (`GP=0`) and unknown participation (`GP=null`). Positive SOG on a known nonappearance is contradictory and rejected. SOG alone cannot turn unknown participation into a confirmed appearance.
7. Within confirmed appearances, observed SOG is any valid count including zero. Null SOG remains missing. Sum and evaluate only observed SOG, retaining all coverage counts separately.

Trade handling: retain the same canonical player's appearances from every team within the selected scope. No “current team only” filter, season-total/TOT row, summed team-stint aggregate or roster-availability inference is admitted. Duplicate identities across team joins are not two appearances. List team-at-game contexts and label a mixed-team sample; a trade does not itself create an arbitrary statistical split or weight.

## Arithmetic and output contract

Let `L` be selected log games, `A` confirmed appearances, `U` unknown participation, `X` confirmed nonappearances, `N` appearances with known SOG, and `M` confirmed appearances missing SOG. Invariants: `L=A+U+X`, `A=N+M`. Unconfirmed schedule games are separate because their appearance status is not established.

For threshold `t` in **2, 3, 4**, let `H_t` be the number of the N observed appearances with SOG **greater than or equal to** t. Return `hits=H_t`, `denominator=N`, and `frequency=H_t/N` when N>0, otherwise null. Preserve exact integer numerator/denominator; percentages are display formatting only. `0 <= H_4 <= H_3 <= H_2 <= N`.

Return total observed SOG and mean `sum(SOG)/N`, both null for N=0. A known all-zero sample returns genuine zero mean and zero frequencies. The histogram uses disjoint bins **0, 1, 2, 3, 4+**, each with count/N and the same missingness disclosure; bin counts sum to N and proportions sum to 1 for N>0. Compute the mean from original counts, never by replacing every 4+ count with 4. Threshold rows overlap; they are not histogram bins.

Support is explicit:

| State | Meaning and display |
| --- | --- |
| `complete` | N>0; source asserts complete requested population; selected participation and SOG are known; no unconfirmed schedule games. This means complete descriptive support, not reliable prediction. |
| `partial` | N>0 but source completeness is partial/unknown, selected participation/SOG is missing, or schedule context is unconfirmed. Rates describe the known subset only. Always show N, A, M, U and the source limitation as relevant. Do not present them as frequencies for the full requested period. |
| `no_appearances` | N=0, A=0 and the scope is otherwise complete/confirmed. Show “No recorded appearances in this window,” no zero percentage. |
| `unavailable` | N=0 with missing SOG, unknown participation/population or unconfirmed schedule support. Say what is missing; do not claim the player did not play. |

`windowFill` is independent: last10 with only two certified available log games is short, even when their data are complete. Return requested and selected counts. When source coverage is partial/unknown, the short sample is not proof of an early-season/new-player history. No minimum N here magically establishes statistical reliability and no small sample is hidden to fabricate confidence.

An `observedSpan` reports selected first/last log dates, not completeness of every intervening day. Source-level complete/partial/unknown status and all exclusions remain visible in the report. No synthetic confidence interval, smoothing, weighting or imputed shots is included.

## Hand-derived fixture expectations

| Fictional observed/unknown sample | N / confirmed appearances | Mean observed SOG | Hits at 2+/3+/4+ | Frequencies | Interpretation |
| --- | --- | --- | --- | --- | --- |
| 3, 3 | 2 / 2 | 3 | 2 / 2 / 0 | 100% / 100% / 0% | Same mean as next row, different distribution. |
| 0, 6 | 2 / 2 | 3 | 1 / 1 / 1 | 50% / 50% / 50% | Zero is a real appearance. |
| 0, 1, 2, 3, 4, 6 | 6 / 6 | 16/6 | 4 / 3 / 2 | 66.7% / 50% / 33.3% | Bins 0/1/2/3/4+ have counts 1/1/1/1/2. |
| 0, null, 4; all GP=1 | 2 / 3 | 2 | 1 / 1 / 1 | 50% each among known SOG | Partial; not 1/3 and not complete-window 50%. |
| 0, 0; both GP=1 | 2 / 2 | 0 | 0 / 0 / 0 | 0% each | Distinct from no observations. |
| null, null; both GP=1 | 0 / 2 | null | 0 / 0 / 0 with N=0 | null each | SOG unavailable, not zero. |
| Last10 selects 0, eight 3s, null; older 9 excluded | 9 / 10 | 24/9 | 8 / 8 / 0 | 8/9, 8/9, 0 | Never extend to eleven log games to fill missing SOG. |

Other cases verify exact/conflicting duplicates, reversed input, all-zero and empty populations, official nonappearances, unknown participation even with a shot count, current/future/nonfinal rows, wrong seasons/playoffs, inclusive custom bounds, last20/30, cross-team stints, invalid normalization and source completeness independent of numeric completeness.

## Proposed player-page presentation, not built

Place one “Historical shots on goal” panel under the existing selected-player Trends/Advanced context. Reuse season, regular/playoff, date/window and source status; do not create an independent invisible filter. Initial daily-complete scope needs a visible cutoff as described above. A compact count-first presentation is sufficient:

> Historical shots on goal · Through Oct 21 (Eastern)  
> Last 10 log games: 6 available appearances, SOG known for all 6  
> Average 2.67 SOG · 2+: 4 of 6 (66.7%) · 3+: 3 of 6 (50%) · 4+: 2 of 6 (33.3%)  
> Distribution: 0 → 1 game; 1 → 1; 2 → 1; 3 → 1; 4+ → 2.  
> Historical frequency in this sample, not the chance of reaching the threshold next game.

For the partial example: “SOG known for 2 of 3 recorded appearances; 1 missing. 3+: 1 of 2 observed appearances (50%).” Unknown participation/source omissions require their own sentence, not just a smaller denominator. No-observation states show an explained dash/message instead of 0%. Mixed-team context shows the included stints and warns that role/team context changed; it does not claim a causal difference.

Provide the same counts and explanatory text without a chart. If a histogram is later added, use labeled disjoint bins and accessible text; use exact counts in tooltips and do not render unknown games as zero-height bars. Keep the card out of forecast ranking, “hot/cold” classification and trade advice. Descriptive frequency alone cannot support those claims.

## Local reproduction and remaining gates

From the repository root, with existing Node 22.11.0 and no install:

```sh
node --test tasks/artifacts/research-backlog-readiness-2026-10-22/sog/sog-contract.test.mjs
```

`fixtures.mjs` exports reusable fictional packets. `reference-arithmetic.mjs` is test-only reference arithmetic with no application consumer. Tests import only those files plus Node's built-in `test`, `assert`, `crypto`, and `fs`; fs reads only the pinned application source files and source-reference receipt. They do not load environment files or execute application/provider/database code. The source hash test detects drift and requires a fresh compatibility check; do not update hashes just to pass.

See `VERIFICATION.md` for actual results. These tests certify this specification's synthetic arithmetic and consistency only. Before implementation: resolve stable identity/team-at-game/finality and complete population metadata with the player-page owner, choose exact normalized adapter/test placement, coordinate the same-day cutoff and existing window, preserve unsupported states, and review copy. Later application tests/browser checks and any release are separate. No private data, source acquisition, forecasts, fitting or new research lane was used or authorized here.
