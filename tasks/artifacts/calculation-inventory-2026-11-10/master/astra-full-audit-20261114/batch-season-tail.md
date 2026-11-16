# season.py tail audit — lines3115–5656, target89da739cb

**Partial-file ownership:** this worker read every line3115–5656 (2542lines), `train_season_artifact` through EOF. Chef owns1–3114 and whole-file completion. The TSV covers46 functions/internal closures plus11 tail configuration assignments (57rows). No whole-file audited claim is made here.

Entire source size255390bytes; SHA256 `04b8421f9f2da96246bc8561ade9cc58c192459dbd9aa185ecd8d977f2904265`; independently byte-compared to89da739cb, equal. Actual worker Astra/high was verified earlier. No application imports, model training, provider/network/DB/production calls, or application/test edits.

## Provisional findings — all P2 dormant/local

### AFULL-SEASON-10 — a partial settlement authorizes fabricated absence zeros

- **Location:** `season.py:5124-5127,5186-5198` and `verify_season_settlement_bundle:5207-5267`; direct reader `web/scripts/import-player-forecast-season-settlement.ts:212-244`.
- **Claim checked:** unknown participation/counts remain unknown; absence zeros require a complete official source, not merely a final game label.
- **Evidence:** exact-source synthetic fixture in `/tmp/astra-season-tail/probe.py`; one final game, player pool maps players1/2, frozen skaters file has only player1. Producer emits1 outcome and `completedGames=[{gameId:1,…}]`; verifier returns `valid:true,issues:[]`. No completeness receipt/count or full eligible-player comparison is required.
- **Wrong behavior:** importer treats every completedGames marker as proof of complete boxscore absence. For an existing forecast of missing player2, its source at222 creates every primitive as0 and labels source `nhl_gamecenter_complete_boxscore_absence`. In this fixture player2's absence could be missing data; the producer supplies no evidence to distinguish it from DNP. Importer code was read, **not executed**; no stored production zero is asserted.
- **Suggested fix:** carry and verify immutable complete-boxscore/participation certification per game before adding it to an absence-authorizing collection; keep known outcomes usable without certifying missing players. Importer must preserve unknown absence where certification is unavailable. Version changed settlement semantics and preserve issued history.
- **Readers:** local-only settlement importer, then outcome-revision/scoring/current-view consumers. Local-only guard at importer61-69 checked; no release activation claimed. Existing full-data settlement tests never remove a whole player's source while keeping a forecast for that player.

### AFULL-SEASON-11 — current actuals admit started/nonfinal games

- **Location:** `season.py:5047-5080`; caller5346-5349 in current-view projection. Contrast settlement's final-status guard5115-5116.
- **Claim checked:** function docstring says “Completed pre-cutoff actuals”; governing finality contract requires final data admission.
- **Evidence/scenario:** exact-source fixture has a game start21:00, row available21:30, cutoff22:00, schedule/game status `started`, goals1. `_actuals_by_player` returns goals1 as an actual; `build_season_settlement_bundle` on the same fixture returns0 outcomes. Actuals examines start/availability but no final status. Chef separately source-confirmed head GAME/SKATER/GOALIE SQL has season/type constraints, not game-state finality; upstream provider-writer behavior/current data prevalence remains unverified.
- **Wrong behavior:** partial live-game counts can become completed season actuals and be added to the current projection; the past-start game is absent from future projected components. Timestamp availability alone is not completion.
- **Suggested fix:** use the same admitted final-game identities and qualified outcome availability for actual sums and settlement; preserve incomplete outcomes as pending/unknown. Add a started-versus-final fixture with identical timestamps/counts.
- **Readers:** `project_season_release(view='current')` player aggregates. TS event path reads active settlement revisions separately; its complete finality behavior is outside this batch. No live serving impact asserted.

### AFULL-SEASON-12 — excluded players get Python forecasts, disagreeing with TS recompute

- **Location:** `season.py:5355-5360`; verifier5580-5656; twin reader `seasonJobs.ts:947-958`.
- **Claim checked:** frozen population/pool intent remains consistent across initial Python release and incremental TS calculation.
- **Evidence/scenario:** artifact has player1, team1, `poolStatus='excluded'`, playProbability1, GOALS rate1, and one future team game. Python ROS project emits1 game output, expected_games1 and goals1. Synthetic bundle with32team records passes `verify_season_release_bundle` (`valid:true,issues:[]`). TS source explicitly sets remainingGames=[] when poolStatus==='excluded'.
- **Wrong behavior:** Python loops all artifact players and selects games solely by teamId; only later team-roster aggregation excludes this poolStatus. Thus initial and recomputed player totals disagree under the same exclusion intent. Current artifact producer commonly emits active/prospect/unsigned statuses; no current excluded artifact prevalence is claimed.
- **Suggested fix:** apply the common poolStatus eligibility rule before constructing Python player components; retain actuals/empty-remaining semantics as the contract requires. Add excluded player initial/event parity and admission checks.
- **Readers:** local season importer, stored initial game/player aggregates and TS season event recompute. TS comparison is source-based; no TS/runtime/DB invocation occurred.

### AFULL-SEASON-13 — goalie binary outcome quantiles exceed possible support

- **Location:** `season.py:4664-4711,4783-4831`; TS twin `evaluator.ts:470-526,613-683`.
- **Claim checked:** W/L/OTL/SO/QS are per-game binary outcome counts; decision65 does not permit imposing one unsuitable distribution on all stats, and L15 requires coherent outcome/interval treatment.
- **Evidence/scenario:** goalie plays/starts with probability1; WINS mean.8, supplied variance.16 (a valid Bernoulli(.8) moment pair). Evaluator outputs p10=.2873793738, p50=.8, p90=1.3126206262. Bernoulli quantiles are0,1,1, and no one-game win count can exceed1. This is reproduced with exact evaluator/quantile source; no fit performed.
- **Wrong behavior:** generic conditional Normal quantiles apply to outcome heads; only GP/GS get explicit per-game support bounds. The TS twin has the same branch, so numeric parity alone cannot detect it. The existing no-context-multiplier test checks means, not outcome quantile support. Mean clamp telemetry does not fix this interval.
- **Suggested fix:** give binary outcome heads a coherent binary/credited-start-or-appearance treatment and bounded support; leave unqualified probability/interval claims withheld. Version any changed experiment/contract; do not retroactively replace issued history. A bound alone prevents impossible output but does not prove calibration.
- **Readers:** Python/TS per-game outputs and stored release/game quantiles; downstream joint aggregates also depend on the outcome moment contract. No production exposure or calibrated-forecast claim made.

## Head findings: exact tail reach and containment

- **Missing team context:**3348 accepts `_team_contexts`;3880 roster-adjusts it;3903 stores it as artifact.teams. Evaluator4742-4744 and targetMultiplier4331-4382 consume team/opponent numerical multipliers. Project5445-5476 serializes all team ratings and goal differential even with sampleGames0 (confidence0). A reader might hide zero-confidence ratings, but that does not remove their artifact/model presence. This supports Chef's head finding; no duplicate ID.
- **Trade participation denominator:**3327-3343 caps population prior ratios at1;3603-3617 uses raw appearance/opportunity totals for player EB probability then caps only the result at.995. An inflated denominator ratio therefore reaches playProbability and game/aggregate means; the cap does not restore missing opportunities. Chef owns minimal head fixture.
- **Later assist correction with old source timestamp:** `_actuals_by_player:5066-5072` and settlement5118-5123 trust `source_available_at`. Settlement5149-5168 writes it into observedAt/availableAt/sourceRevisionKey, and5170-5174 labels it immutable Gamecenter capture availability. Direct importer280-283 stores those supplied timestamps. Thus Chef's retained-old-timestamp correction reaches both actuals and settlement provenance; no real correction was fetched here.
- **All-null season-total audit:**3303-3313 rejects each exposure target/population with observed_rows≤0. Chef confirmed `_weighted_exposure_summary` excludes null target/exposure, so an all-null source's optimistic audit label is contained before artifact creation. Do not claim wrong fitted output from that fixture. Mixed valid/missing support still needs target-specific analysis in the owning helper, rather than assuming containment covers every case.
- **MAE/coverage policy:** tail3263-3280 calls the head tournament and retains its policies in selectionEvidence3904. Exposure override3300-3327 and3483-3525 then substitutes some served rates/baselines, with source basis explicitly disclosed. This is related to Chef's existing ADV-07/season selection evidence gap; no new proper-score finding is duplicated.

## Reviewed logic and important limits

- Primitive unknowns stay omitted through `_finite_or_none`, reconciliation, mean aggregation and explicit-null actuals. Derived sums require all components; positive denominators required. Empty remaining schedules represent zero future contribution, with explicit-null actual totals still unknown.
- GP/GS conditional counts are1 with zero conditional variance; p(1−p) is propagated, with GS≤GP. Expected-assist aliases carry source moments and source actuals. Variance fallback uses the already-adjusted mean once; supplied variance follows the documented mean-ratio convention, not an asserted universal m² law.
- Per-game derived intervals are explicitly marginal endpoint bounds; aggregate quantiles come from shared deterministic draws, with actuals added before derived heads. The256 draws/.65 loading/.4225 primitive correlation and independent-games assumption are disclosed. This is an engineering assumption, not calibrated scientific evidence. No simulation fitting/calibration run occurred.
- EV replacements are reported as clamps, with total authoritative and non-EV scaled if necessary. The existing residual-overwrite test matches this declared source contract; whether to adopt a different derive-or-use policy belongs to Chef/owner decisions, not an unapproved worker edit.
- Schedule rest uses the declared NHL date, falling back to Eastern puck-drop date. Stable team deployment uses expected TOI and player-ID ties; PP/PK units withheld. Per-player training artifact still contains heuristic role distributions and confidence; display suppression at zero confidence remains a downstream-reader question.
- Training code was read fully but **never called**. Admission verifies audit artifacts; rows are selected by season, artifact trainingCutoffAt is a fixed string, and player/roster/deployment context uses freeze data. No training-source or prospective qualification claim is inferred from its self-generated three golden vectors.
- Python/TS admission differs at helper boundaries: TS evaluator verifies artifact metadata/player team and aggregate population; Python helpers rely on callers. Also TS finiteOrNull/Number coercion is less strict for booleans/null deployment values than Python. These are bounded reader observations, not separately reproduced findings here; whole TS files remain pending their scope review.
- Release verifier checks hashes/counts/coherence/order, not source completeness, selection quality, original availability or every semantic pool rule. Its synthetic pass is narrow integrity evidence only.

## Execution and reading receipts

`PYTHONDONTWRITEBYTECODE=1 python3 -I /tmp/astra-season-tail/probe.py` → **exit0**. Exact AST function/constant nodes from inspected source were compiled with standard-library globals. Exact I/O helpers were reused via AST, not application imports. No `train_season_artifact` execution. New fixture artifacts live under `/tmp/astra-season-tail/fixture-24k97ngc`; probe outputs are `/tmp/astra-season-tail/results.json`. The report's scenarios are sufficient to recreate them if temporary files disappear.

All assigned source ranges read in order:3115-3650,3651-4160,4161-4665,4666-5180,5181-5656. No unread tail section. Prior test readings and51 successful cases were reused, not rerun. Chef's head probe was read for context only and not executed. Scope pin/hash equality and TSV completeness/whitespace were checked separately.

Supplemental read manifest follows. Hash/size cover whole files for identification; ranges describe the actual bounded reading, **not** whole-file audit. Earlier io.py/test reading receipts reside in prior worker reports.

| Source | Read extent | Bytes | SHA256 |
|---|---|---:|---|
| `web/lib/fantasy-projections/evaluator.ts` | 175–250,461–700,705–953; symbol search only elsewhere | 35348 | `baff7db4e61e5d8051ff6a2d9270b66d0267c7da4ca77e4aaf82770427805a5b` |
| `web/lib/fantasy-projections/seasonJobs.ts` | 430–480,922–1040; symbol search elsewhere | 51359 | `7ae6fa74480caca9e68d70e572871a90479db663e173c1a9e097a43413573ffb` |
| `web/scripts/import-player-forecast-season.ts` | 110–190,245–350; timestamp/field searches elsewhere | 24446 | `a74605c3f1ce033cbcac25b046977c035ea4bd7e1d206dbd63ef1d706c75ded5` |
| `web/scripts/import-player-forecast-season-settlement.ts` | 60–285; field searches elsewhere | 14850 | `a0055e303ec4a37adea83c7e407bc894e50f138ecc9c07fa03c33eee552fc6a0` |
| `modeling/player_forecasts/contract.py` | 1–35 constants used by exact-source probe | 4142 | `69a3b57121afbcae45d2dcc0b3e3a5716d3e30ee6842895b702f2f898b04720b` |
| `modeling/player_forecasts/season.py` | support constants25–115 plus assigned3115–5656; root owns head numerical audit | 255390 | `04b8421f9f2da96246bc8561ade9cc58c192459dbd9aa185ecd8d977f2904265` |
| `modeling/player_forecasts/io.py` | prior full safety read; exact helper AST reused without module import | 1733 | `9a2f72ce5b1271157a7c9409dec65550010de292034f350ab4f593f1b60d2b8f` |
| `/tmp/astra-season-head-probe.py` | 1–90 requested; full existing short probe text returned; read only | 3607 | `ff2bba152202035f7da2fecc5024c79c3ce61bcf33cf518a11029378766c4939` |

Chef owns final acceptance and whole-file integration. No tail-source section pending; TS full-file readers, real source completeness, current hosted reach, training and predictive qualification remain outside this bounded batch.
