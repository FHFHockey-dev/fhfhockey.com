# External fantasy input audit: live FORGE run (2026-10-26)

**Verdict: an external fantasy input exists, so I stopped after the audit (ticket rule 3). No code changed.** When the season bootstrap is enabled, the live skater stage reads four third-party fantasy projection tables and blends them into every skater's goals, assists, **shots on goal**, PP points, hits and blocks. That makes the FORGE-QUAL first target (skater SOG) directly affected. Goalies do not read them.

Method: a static read of the code at `octoberBranch` `46bc91caf`. Every `.from()` / `.rpc()` call (and the variable table names) is listed for the modules the live run uses: `lib/projections/run-forge-projections.ts`, `stages/*`, `queries/*`, `seasonBootstrap.ts`, `dailyBoardEvidence.ts`, `acceptedNews.ts`, `issuedContext.ts` and the completeness servers. No production, DB or env reads were made, so whether production currently has the bootstrap enabled is **not verified** (see §4). Paths are under `web/`.

## 1. The external fantasy input

**What reads it, and what it reads**
- `loadSeasonBootstrap(playerIds, seasonId, cutoffDate, population, allowCurrentFantasy)` (`lib/projections/seasonBootstrap.ts:168-211`).
- When `allowCurrentFantasy` is true and `seasonId === FANTASY_PROJECTION_SEASON_ID` (20262027, `lib/fantasy-projections/contracts.ts:1`), it reads every `PROJECTION_SOURCES_CONFIG` source of that population whose `defaultSelected !== false` (`seasonBootstrap.ts:171-172`, `:188-191`).

**Sources read**, from `lib/projectionsConfig/projectionSourcesConfig.ts`:

| Source | Table | Line |
|---|---|---|
| Apples & Ginos | `PROJECTIONS_20262027_AG_SKATERS` | `:66` |
| Cullen | `PROJECTIONS_20262027_CULLEN_SKATERS` | `:104` |
| DTZ | `PROJECTIONS_20262027_DTZ_SKATERS` | `:128` |
| 5v5 | `PROJECTIONS_20262027_5V5_SKATERS` | `:152` |

- These are uploaded third-party fantasy projections (`upload_batch_id`), labelled "public fantasy projection" in the run's own limitations (`seasonBootstrap.ts:203`, `:205`).
- The Blake and Nate A&G component tables are `defaultSelected: false`, so they are not read.

**Who passes `true`:** only the skater stage, at both call sites: `lib/projections/stages/skater-stage.ts:1559` and `:1713`. The goalie stage passes `false` (`lib/projections/stages/goalie-stage.ts:180-182`), so goalie priors use only NHL appearance history.

**How it enters the forecast**
- `fantasySourcePerGame` maps each source row to per-game stats, including `SHOTS_ON_GOAL: "shots"` (`seasonBootstrap.ts:25`, `:30`).
- `averageBootstrapStats` averages the sources (`:57`, `:208`).
- `bootstrapSkaterLine` (`:117-140`) then calls `blendSeasonBootstrap` (`:95-113`) on the skater's line at `skater-stage.ts:2808-2820`. The blend replaces `goalsEs/Pp`, `assistsEs/Pp`, `shotsEs/Pp`, hits and blocks. Those are exactly the stored `proj_*` heads.

**Weight:** `fantasyWeight = (1 − min(1, currentSeasonGames / 20)) × 0.6` (`SEASON_BOOTSTRAP_POLICY.fantasyShare = 0.6`, `transitionGames = 20`, `seasonBootstrap.ts:6-7`, `:96-98`).
- At about 9 games played (late October) a skater's line is roughly 45% organic, 33% external fantasy projection and 22% previous-season NHL history.
- The weight reaches 0 only at 20 current-season games. Call-ups and injured players keep a nonzero weight later into the season.

**Gating:** this happens only when `seasonBootstrap` is true. That requires all of:
- `compute`;
- a live run (no `decisionAsOf`);
- horizon 1;
- `STARTER_BOARD_SEASON_BOOTSTRAP_ENABLED === "true"`;
- `asOfDate` on or after today in New York.

Source: `lib/projections/run-forge-projections.ts:443-445`. The run records the flag as `seasonBootstrapApplied` and in `modelEnvironment` (`:529`, `:399-403`).

**Prior record:**
- The label was claimed on 2026-10-17 (`0de97e77d`), justified as "the stages disable external fantasy inputs at every season-bootstrap call".
- It was withdrawn on 2026-10-24 (`cb8ed5217`).
- The guard test `lib/projections/nativeInputEligibility.test.ts:37-51` now pins Release C's policy: skaters `true`, goalies `false`. Its comment reads "Release C skaters retain legacy inputs and must not claim native exclusion".
- `lib/projections/apiHelpers.test.ts:77-79` says "stages still blend external fantasy priors; that provenance must stay ineligible".

So the withheld label is correct today.

## 2. Every other input, classified

"Derived" means an FHFH table computed from the sources named. Its own writer was **not** traced end to end in this audit, so its classification rests on the table's role and name. Those rows are marked *(writer not traced)*.

| Input (table / RPC) | Read at | Feeds | Class |
|---|---|---|---|
| `games`, `teams`, `players`, `rosters` | `queries/skater-queries.ts:42`, `:72`; `queries/goalie-queries.ts:100`, `:166`; `queries/team-context-queries.ts:107`, `:121`, `:322`, `:565`; `stages/skater-stage.ts:1280`, `:1299`; `stages/preflight-stage.ts:82`; `issuedContext.ts:59`, `:77`, `:89` | schedule, rosters, identity | NHL first-party |
| `skatersGameStats`, `goaliesGameStats` | `seasonBootstrap.ts:177` | the bootstrap's previous-season history prior | NHL first-party (game stats) |
| `wgo_skater_stats`, `wgo_goalie_stats`, `wgo_team_stats` | `queries/skater-queries.ts:511`; `queries/goalie-queries.ts:220`, `:285`; `queries/team-context-queries.ts:130`, `:390` | rates, TOI, team context | NHL first-party (NHL.com stats API) |
| `pbp_games`, `pbp_plays`, `shift_charts`, `nhl_api_shift_rows` | `pbpCompletenessServer.ts:129-201`; `shiftChartCompletenessServer.ts:109`, `:131`, `:162` | input completeness gates | NHL first-party |
| `lineCombinations` | `queries/line-combo-queries.ts:55` | lines, PP units | derived from NHL gamecenter boxscore (`pages/api/v1/db/update-line-combinations/[id].ts:40`, `:119`) |
| `forge_goalie_game`, `forge_team_game_strength` | `queries/goalie-queries.ts:68-278`; `queries/team-context-queries.ts:46`, `:487`, `:529` | strength-split history | derived from NHL PbP and shifts *(writer not traced)* |
| `rolling_player_game_metrics` | `queries/skater-queries.ts:362`; `stages/skater-stage.ts:408` | rolling rates and deployment | derived (NHL, NST, line context) *(writer not traced)*. No fantasy, ownership or rank column is selected in the run's queries (`rg` over `queries/*`). |
| `player_stats_unified` | `queries/skater-queries.ts:569` | season rates | derived view over NHL and NST stats *(writer not traced)* |
| `sustainability_trend_bands` | `queries/skater-queries.ts:644` | regression bands | FHFH model-derived *(writer not traced)* |
| RPC `forge_league_skater_physical_totals` | `queries/skater-queries.ts:466` | league hits and blocks priors | derived from NHL stats *(not traced)* |
| `nst_team_all`, `nst_team_stats` | `queries/team-context-queries.ts:432`, `:459` | team xG and shot context | third-party **hockey analytics** (Natural Stat Trick, computed from NHL data). Not a fantasy input. |
| `nhl_team_data`, `nhl_xg_team_rolling_aggregates` | `queries/team-context-queries.ts:362`, `:373`, `:295` | team strength priors | FHFH xG model on NHL data *(writer not traced)* |
| `goalie_start_projections` | `queries/goalie-queries.ts:367`; `stages/skater-stage.ts:3436` | goalie start shares | FHFH model-derived (goalie start pipeline) *(its inputs not traced)* |
| `forge_roster_events` | `stages/preflight-stage.ts:127` | injuries, call-ups, line changes, goalie confirmations | admin-entered events (`pages/api/v1/forge/roster-events.ts:85`, admin-only) |
| `player_forecast_lineup_snapshots`, `_goalie_start_observations`, `_observation_conflicts`, `_lineup_assignments`, `_conflict_resolutions`; `forge_board_news_events` | `dailyBoardEvidence.ts:180-186`; `acceptedNews.ts:23` | accepted lineup and goalie news | third-party **news** (IFTTT-relayed reports with `source_key` / `source_url`). These are factual status reports, not fantasy valuations. |
| `market_prices_daily`, `prop_market_prices_daily` | `queries/market-queries.ts:169`, `:198` | **output only**: market-edge flags written after the projection rows (`stages/skater-stage.ts:3285` persist, then `:3292-3375`; `stages/goalie-stage.ts:825`, then `:838-905`) | third-party sportsbook prices. They don't feed the forecast. |
| `forge_runs`, RPCs `begin_forge_*_run`, `fhfh_player_identities`, `roster_optimizer_team_games` | `queries/run-lifecycle-queries.ts`; `run-forge-projections.ts`; `issuedContext.ts:73`, `:93` | run control, identity and schedule context | FHFH control and NHL schedule |

**Static checks run on the code:** no ownership, ADP, provider-ranking or fantasy-platform (Yahoo/ESPN) value is read by the run's queries or stages (`rg -i "yahoo|ownership|fantasy|adp|rank"` over `lib/projections/queries/*`). The only fantasy-projection reads are the bootstrap sources in §1.

## 3. Consequences for the FORGE-QUAL plan

- With the bootstrap on, every live skater revision's SOG is partly a blend of external fantasy projections. Claiming `excluded_from_native_inputs_v1` for such a run would be false.
- So `consumerRevisionAdmission.ts:88-90` correctly keeps those revisions out of RSO and Start Chart, and the D2 target can't yet produce a positive readback.
- With the bootstrap **off**, the live run reads no fantasy source: goalies never do, and the skater call is skipped. Such a run would honestly qualify for the label.

## 4. Options for TJ (no change made)

1. **Claim the label only when the run actually read no fantasy source (recommended).**
   - The live writer would pass `externalFantasyInputsExcluded: true` only when `seasonBootstrap` is false.
   - Better still, it would derive the claim from the run's own captured read transcript: claim it only if no `PROJECTION_SOURCES_CONFIG` table appears in `capture.reads`. An allowlist test would enforce this.
   - The claim stays honest whatever the env flag is. Whether to switch the bootstrap off in production is then a separate operational and model choice.
   - Code lane: `run-forge-projections.ts` and its tests. Unverified offline: the production value of `STARTER_BOARD_SEASON_BOOTSTRAP_ENABLED`. The run's own snapshot (`modelEnvironment`, `seasonBootstrapApplied`) would show it in one bounded read.
2. **Change the model: skaters stop reading fantasy sources** (`allowCurrentFantasy = false`, as goalies already do). This is a Release C policy change that `nativeInputEligibility.test.ts:37-51` pins. Under the FORGE-QUAL reset rule it means a new code version and a new scope, and it needs retrospective evidence that early-season SOG doesn't get worse without the fantasy prior.
3. **Wait out the transition.** The fantasy weight falls to 0 at 20 games played, around mid-November for regulars. It never reaches 0 for low-GP players, and the reads still happen, so this can't justify the label by itself. Not recommended.
4. **Redefine the contract to allow declared fantasy priors.** This contradicts the contract's name and the Release C decision. Not recommended.

## 4a. Follow-up applied (2026-10-26, TJ chose option 1)
- The **live** snapshot, which publishes revisions, now claims `excluded_from_native_inputs_v1` only when `readsExcludeExternalFantasy(capture.reads)` holds. The never-published reconstruction snapshot still never claims, which keeps the offline native qualifier's premise unchanged. That requires every captured read to be in `FORGE_AUDITED_INPUT_SOURCES`, and none to be a `PROJECTION_SOURCES_CONFIG` / `PROJECTIONS_*` table, even a failed read.
- The run-start `forge_runs.metrics.input_provenance` is written before any read and never claims. So the public projection APIs that gate on it (`pages/api/v1/projections/{players,goalies,teams}.ts`) still refuse these runs.
- Bootstrap and model behaviour are unchanged. See FORGE-QUAL/RECEIPT-2.md.
- **Additional run sources found by the receipt's static import-graph scan,** all NHL first-party or FHFH:
  - `seasons` and `expected_goals` (`lib/NHL/server/index.ts:250`, `:495`);
  - `forge_latest_rolling_rows` (RPC) and `rolling_player_metric_support_payloads` (`lib/projections/queries/skater-queries.ts:182`, `:414`);
  - `player_forecast_source_observations` and `read_forge_game_revisions` (FHFH snapshots and revisions).
- **One bounded read would show production's bootstrap state** (not run; needs TJ approval):
  - Query: `player_forecast_source_observations`, filtered to `provider = 'forge'` and `dataset_key = 'forge-run-inputs-v1'`, ordered by `available_at desc`, `limit 1`.
  - Columns: `available_at`, `payload->seasonBootstrapApplied`, `payload->modelEnvironment->STARTER_BOARD_SEASON_BOOTSTRAP_ENABLED`.
  - Cost: 1 request, 1 row, select only.

## 4b. Model change applied (TJ redirect, 2026-10-26: "We should not be using fantasy projection tables at all from the draft dashboard")
- **Removed:** the fantasy-projection branch of `loadSeasonBootstrap`, meaning its `allowCurrentFantasy` parameter, the `PROJECTION_SOURCES_CONFIG` / `FANTASY_PROJECTION_SEASON_ID` imports and `fantasySourcePerGame`.
- **Now:** both skater calls and the goalie call use only the NHL previous-season appearance prior. The history prior keeps its Release C weight, 0.4 × (1 − GP/20). The former 0.6 fantasy share is dropped, not reassigned. So every skater now gets what Release C already gave a skater with no projection rows.
- **Disclosures** keep `fantasyWeight: 0` and `sourceIds: []` so existing readers (Start Chart contract, page and backtest) still parse them.
- **Draft dashboard untouched:** `lib/projectionsConfig`, `lib/fantasy-projections` and draft code are unchanged.
- **Version:** per TJ, the release `codeVersion` (git sha) marks the change. A new `codeVersion` gives a new `artifactHash`, so the FORGE-QUAL scope resets under D4 and is pinned to the first post-release revision. `modelMode` and the bootstrap disclosure version are unchanged.
- **Claim:** live runs now read no fantasy source, so the read-log-derived exclusion claim comes out true. The allowlist test enforces this, and the boundary test fails if any `lib/projections` module references the fantasy config or tables.
- **Evidence still owed: early-season SOG retrospective.** No offline evidence yet shows that dropping the 33–60% fantasy prior doesn't worsen early-season shots on goal. It needs captured data. The bounded read-only reads below are **not run** and need TJ approval; they exclude the sealed Oct 23–30 block entirely.

  | # | Read | Rows (estimate) | Requests |
  |---|---|---|---|
  | E1 | `player_forecast_source_observations` with `provider='forge'`, `dataset_key='forge-run-inputs-v1'`, `payload->>'seasonBootstrapApplied' = 'true'`, `payload->>'slateDate'` 2026-10-07..2026-10-22, columns `id, available_at, payload` (the payload holds the captured reads, including the fantasy rows; large) | ≈1–2 per slate, ≤32 | ≤32, one per row |
  | E2 | RPC `read_forge_game_revisions(p_slate_date)` for each of those slates (the issued SOG) | ≤16 games per slate | ≤16 |
  | E3 | `forge_player_game_strength` for those game ids: `game_id, player_id, shots_es, shots_pp, shots_pk, updated_at` | ≤ about 10k | ≤10, 1000-row pages |

  Total: at most about 58 sequential requests. E1 payload size is the main cost.
  - **Offline analysis afterwards:** recompute each run's skater SOG with the history-only prior and score both against E3, on the same metrics as D4 (bias, slope, ΔMAE versus the season-rate baseline).
  - **The replay needs a harness change:** `replayProjectionInputs` requires every captured read to be consumed (`lib/projections/inputCapture.ts:64-70`), and the new code no longer consumes the fantasy reads. So the counterfactual needs a replay mode that tolerates exactly those unconsumed `PROJECTIONS_*` reads (an offline tool change in its own lane).
  - **Out of scope here but in reach of the same directive:** the native baseline stack still builds its frozen means from these four sources (`lib/player-forecasts/baselinePolicy.ts:20-35` and the baseline capture, rate and lineage modules). It needs its own TJ decision.

## 5. Not covered
- The upstream writers of the derived tables marked *(writer not traced)*, and the goalie start pipeline's own inputs.
- Whether production currently runs with the bootstrap enabled.
- Data content: whether the configured tables actually hold rows for current players.

## Addendum (L9a, 2026-11-12)
- `nhl_xg_model_registry`: read by `fetchActiveXgModel` (`lib/xg/modelRegistry.ts`) from `lib/projections/queries/team-context-queries.ts` to pin the in-house team xG prior to the single active approved model (L14 selector, decision 99). In-house model registry, not a fantasy source.
- `nhl_xg_shot_features`: reachable only through `lib/xg/modelRegistry.ts` → `lib/xg/shotFeaturePersistence.ts` imports; the FORGE run does not call it. In-house xG features, not a fantasy source.
- Also new since this audit, already in the audited set: `forge_goalie_game` and `goalie_start_projections` reads in `lib/projections/opponentGoalieQuality.ts` (opponent-goalie save quality, W1 P0 #21).
