# Recovered pipeline reconciliation and bounded implementation

Status: implemented locally with synthetic engineering evidence; not deployed, admitted, published or verified with fresh genuine inputs. Checklist 1.1–1.5 and 3.1 remain open for genuine coverage/production evidence. No sealed/private outcomes, databases, provider endpoints, fitting, publication or activation were used.

## Reuse decisions

- `web/lib/player-forecasts/contracts.ts`: retain revision/conditioning/component-manifest contracts. Its `PLAYER_FORECAST_MAX_HORIZON=10` belongs to existing forecast production and is not silently changed by the consumer's newly accepted 20-game request.
- `web/lib/fantasy-projections/evaluator.ts`: reuse `evaluatePortableSeasonGame` and its artifact-contract checks, context calculation, arithmetic reconciliation and deterministic component hashes. `aggregateSeasonGames` retains per-game component hashes; existing consumer aggregation independently reports missing horizons/targets and ratios of expected primitives.
- Exact incompatibilities: the portable evaluator treats absent conditional rates as zero, clamps invalid/unknown probabilities to zero, and defaults absent goalie start probability to zero. That is incompatible with public unknown-preserving semantics. New `seasonGameContributions.ts` checks original primitive support before exposing each native target; missing support remains null. Unknown pStart remains null. The ordinary season count mixture is appearance-conditional, including goalies; pStart is separate. Do not multiply these unconditional means by pStart again or claim they assume no relief.
- `admin.ts`: retain validation, immutable atomic publish and atomic rollback functions. Seasonal `player_forecast_season_*` releases are a distinct store from native admitted FORGE revisions; moving a seasonal release pointer is not native admission. No admin operation ran.
- `seasonJobs.ts`: retain deterministic daily scope keys, bounded claims/leases, affected-team/player copy-on-write recomputation and artifact fallback handling. No new recurring infrastructure or job activation is needed for this local adaptation; no jobs ran.
- `modeling/player_forecasts/season.py`: retain target-specific recency-weighted exposure empirical Bayes core, chronological model selection and arithmetic reconciliation. Established scoring G/A components use total TOI; PP components use PP TOI, SH components use PK TOI; deployment uses games played. Do not replace authoritative all-situations estimates with incompletely covered strength sums.
- `rookies.py`: retain learned league-transition/roster-probability separation and population-prior fallback where verified official landing support or validation support is missing.
- Corrected August 28 audit and later runbook: the historical four-season 2022–23 through 2025–26 exposure audit, local current release13/ROS10 and prior cross-language/browser evidence are historical reports. They are not current native source receipts, fresh output, or hosted acceptance. 2025–26 has already been consumed for model development; do not call it blind data.

## Local executable producer path

The existing `web/scripts/preview-native-baseline.ts` default native path remains available. Its explicit optional `--season-artifact` path now takes reviewed `SeasonGameBinding[]` in `--inputs`, validates identity/game scope, evaluates the recovered portable artifact, preserves its original training cutoff and checksum, and writes the same exclusive private local preview file. All generated candidates have denied allowedUses; output is `unreleased_preview` and `publicUsesApproved=false`. This is production preparation, not a fresh native release or a substitute for admission.

From `web/` with individually approved, non-private input files:

```sh
NODE_PATH=. ./node_modules/.bin/ts-node --transpile-only --compiler-options '{"module":"commonjs","moduleResolution":"node"}' scripts/preview-native-baseline.ts --inputs REVIEWED_SEASON_GAME_BINDINGS.json --scope REVIEWED_GAME_SCOPE.json --expires-at PRE_GAME_ISO_TIMESTAMP --out NEW_PRIVATE_PREVIEW.json --season-artifact VERIFIED_PORTABLE_SEASON_ARTIFACT.json
```

Scope retains the existing `{seasonId,scheduleRevision,games:[{gameId,scheduledAt}],players:[{playerId,nhlPlayerId,teamId,rosterRevision}]}` shape. Bindings additionally declare opponentTeamId, isHome and observedAt. Original artifact trainingCutoffAt <= binding observedAt <= issuedAt < expiresAt <= scheduledAt is required. Up to50 players,20 scoped games and1000 distinct bound player-game candidates are accepted. These are preparation bounds, not proof of complete league coverage. The existing scope game shape lacks team membership: coverage therefore explicitly reports `teamScheduleCoverage=unavailable_scope_has_no_game_team_membership` and the universe as `explicit_reviewed_bindings`, plus scope players/games with no reviewed binding. It cannot certify every expected team player-game from this scope; an upstream complete team schedule/roster manifest is still required.

## Required target map

All methods below describe runnable seasonal producer capability. This pass has no genuine current artifact/capture/roster inputs and makes no fresh-output claim for any target.

| Required target | Reused seasonal method / exact native mapping | Required original support |
|---|---|---|
| G | evaluated all-situations GOALS | GOALS |
| A | evaluated PRIMARY_ASSISTS + SECONDARY_ASSISTS | both original rates |
| PPP | evaluated PP_GOALS + PP_ASSISTS | both original rates |
| SOG/HIT/BLK/PIM | evaluated original SHOTS_ON_GOAL/HITS/BLOCKED_SHOTS/PENALTY_MINUTES | corresponding finite nonnegative original rate |
| TOI | evaluated TOTAL_TOI seconds /60 -> TIME_ON_ICE_PER_GAME minutes | explicit TOTAL_TOI |
| PP role | existing portable deployment metadata retained in evaluator; not promoted into a verified native role receipt | current role/deployment evidence still required |
| participation | original playProbability, bounded [0,1] | unknown stays null; no appearance confirmation/calibration claim |
| pStart | original startProbability [0,playProbability] | absent/inconsistent stays null |
| SA/GA | evaluated SHOTS_AGAINST_GOALIE / GOALS_AGAINST_GOALIE | respective original rates |
| SV | evaluated SA-GA | both original rates; reject incoherent counts |
| W/SO | evaluated WINS_GOALIE / SHUTOUTS_GOALIE | original rates; conditional means cannot exceed1 |
| goalie minutes | evaluated TOTAL_TOI seconds /60 -> GOALIE_MINUTES | explicit rate, <=65 conditional minutes; never infer minutes |
| SV% | shared aggregate sum(SV)/sum(SA) | all requested games' admitted primitives and positive denominator |
| GAA | shared aggregate60*sum(GA)/sum(minutes) | all requested games' admitted primitives and positive denominator |

Ratios are ratios of expected totals, not E(realized ratio). Original model/artifact version and training cutoff are kept; no fresh issue clock disguises old input provenance. The synthetic adapter fixture uses `synthetic-season-v1`; it establishes transport/semantics only, not predictive quality. Artifact-specific training periods, sample support and per-target evidence must be retained alongside a real reviewed artifact before promotion; this adapter does not fabricate them.

## Source-confirmed upstream gaps

- Ordinary native `skater-stage.ts` explicitly writes PK TOI/SOG/G/A null and no ordinary proj_pim head. `RollingRow`/`ROLLING_ROW_SELECT_CLAUSE` do not provide PIM/PK support. A mapper cannot legitimately turn these into complete native counts.
- `completeBoardSkaterStatsFromProjection` now requires all ES/PP/PK components; incomplete native full-game G/A/SOG remain unknown. Recovered seasonal all-situations G/A avoids that specific decomposition defect only in the explicit seasonal preparation path, and does not repair the native upstream source.
- Recovered seasonal contracts support goalie W/SO/TOTAL_TOI but that is not evidence ordinary native goalie production currently supplies them. Current native goalie support and fresh participation/pStart remain genuine-output gaps.
- Native detailed contribution admission remains bounded by forecast-calendar-v1 (default14/max21 days). The shared reader now accepts1–20 scheduled team games within the existing60-day next-N discovery window; it does not extend admission or imply20 expected appearances. A realistic20-game horizon can legitimately return unknown totals with coveredSum/coveredGames only for admitted rows.
- Actual current roster and eligible candidate scope, retained source-page completeness, current schedule membership and genuine generated/missing/stale/excluded/failed rows were not read by this offline task. Reference849/652/197 counts are not a release-universe inventory.

## Verification receipt

Before cap changes, the two new 20-game regressions failed on both original10-game caps. After changes,18 shared expectation tests pass. The20-game fixture preserves shortened producer admission:20 scheduled opportunities,7 admitted detailed rows across the default14-day calendar, unknown full total, and explicit partial sum; expired sources and future cutoffs stay unavailable.

Current commands/results:

```sh
# repository root: isolated source/fixture mechanics, no fitting or genuine outcome reads
python3 -m pytest modeling/player_forecasts/tests/test_harness.py -k 'season or rookie' -q
# 30 passed,168 deselected
# web/: recovered TS pipeline contract/evaluator/admin/jobs regressions
npm test -- lib/fantasy-projections/fantasyProjections.test.ts --run
# exercised together with initial shared tests:31 passed,1 skipped (golden artifact path not supplied)
# web/: new adapter, shared view, CLI and unchanged native preview regressions
npm test -- lib/player-forecasts/gameExpectations.test.ts scripts/preview-native-baseline.test.ts --run
# 26 passed on final adapter/CLI sources, including original goalie GA>SA at zero participation
```

The adapter test exercises recovered evaluator -> existing local preview -> shared expectation view on the same revision/source watermark. Default permissions deny totals; only a clearly labeled synthetic approval in the test exercises numeric compatibility. Goalie fixtures separately check SA=SV+GA, minutes conversion, SV%/GAA, pStart separation and missing minutes/start. Original goalie GA>SA is rejected before evaluation, even when appearance probability is zero. CLI fixture writes one temporary exclusive output file; no database access is available.

Initial TypeScript check exhausted the default4GB Node heap, so it did not establish type safety. The8GB retry completed with6 errors in other owners' RSO/FORGE test files and none in this worker's files; typecheck is failed, not green. No build/deploy was performed.

Final receipt:26 targeted TS tests passed after the final adapter/coverage changes;30 filtered Python source-fixture checks passed;31 recovered TS pipeline checks passed with1 golden-artifact skip. Owned source files are pinned in `source-pins.sha256`. Direct trailing-whitespace inspection passed for all six owned files (they are pre-existing/new untracked files, so tracked-only diff checks would not inspect their bytes). Typecheck remains failed on6 other-owner test errors; no claim of full repository type safety.

Review correction: `prepareSeasonGameContribution` now checks the embedded portable prior `fhfhPlayerId` against the binding, independently of the artifact dictionary key. Existing preview regression changes the embedded identity only and verifies rejection; `npm test -- scripts/preview-native-baseline.test.ts --run` passed8 tests after correction. Source pins refreshed.

Superseding execution status (2026-10-16): the recovered prior-only producer has now generated genuine Fiala ability from20authorized prior boxscores/landings. Current-native and credited-goalie policies provide the remaining roster ability heads. The latest complete partial receipt is `current-native-preparation.md`; checklist3.1 is reconciled, while actual release/consumer acceptance stays open. Earlier synthetic-only or pending-source statements are historical; no legacy release was used to bypass native admission.
