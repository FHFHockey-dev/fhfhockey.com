# Smallest native forecast release path

This is a proposal, not permission to execute a producer, write the database, refresh a cache or deploy. The implemented local producer preview/API/page and both consumer integrations are independently useful engineering work. Their synthetic checks do not constitute genuine issuance or release evidence. The private BLK pilot, all private model experiments and reserved evaluations are separate and are not inputs.

## Implemented local path

`scripts/preview-native-baseline.ts` → existing `dryRunNativeSkaterBaselineBundle` → unreleased bundle with original native input hashes and capture clocks. No database object can be accessed by this preview. Its output is a draft with an actual preview generation time; its draft `issuedAt` must not later be represented as an earlier public release time.

`loadPlanningData` → existing native bundle release/provenance loader and atomic revision admission → existing `resolvePlanningContributions` → `buildGameExpectations`. The new reader does not grant permissions or issue forecasts. FORGE uses `/api/v1/forge/forecasts` and `/forge/forecasts`. Start Chart can call `loadGameExpectations` directly for its selected date; RSO retains the original per-game `PlanningData` and resolver path.

The version is `forge-game-expectations-v1`. Next-N selects up to ten distinct scheduled team games from a bounded discovery range containing today. Calendar mode covers at most 21 dates in the requested timezone. Every opportunity retains game/player/NHL/team identities, schedule/roster revisions, per-target methods, source IDs, original individual source clocks and separate participation receipt clocks. Target-level validity clocks are composite. Conditional per-appearance/per-start values are not summed into expected totals. Missing heads and incomplete horizons are null; ratio outputs are ratios of summed expected primitives.

## Existing methods and actual support requirements

The native historical-rate wrapper uses existing `skater-baseline-rates-v1`, with all external projections rejected. Its unchanged ability method uses the most recent up-to-82 previous-season appearances as the history prior, 20 appearance-equivalents of prior weight, and up-to-20 current-season appearances with 0.9 decay. A target requires a supported prior; current-season rows alone do not silently invent that prior. This is explicitly provisional and unvalidated for predictive quality. No research M1/M2/M3 selection or tuning is involved.

| Heads | Conditional ability support | Unconditional expectation requirement |
|---|---|---|
| G, A, points, SOG, HIT, BLK, PIM | Genuine native final positive-TOI boxscore components, verified historical membership, correct target units and current capture; target-specific missingness retained | Actual admitted game-specific participation, plus allowed totals/assignment/comparison uses. Current roster membership alone is insufficient. |
| PPP | Complete native PP goal/assist-credit derivation and reconciled original landing/boxscore receipts | Same participation/use gates. Missing landing evidence stays unavailable. |
| Skater TOI | The historical-rate bundle does not support this head. The existing native game producer can emit conditional minutes when its own source requirements pass. | Same game-specific participation gate; do not substitute opportunity count or multiply a previous game's minutes. |
| Goalie SV/SA/GA/minutes | Separate existing native goalie component method, coherent appearance basis and valid original components; not part of the two-skater canary | Released matching appearance/start evidence with explicit conditioning. The existing game producer's model start weights are uncalibrated and assume zero non-start relief; those limitations must remain visible. |
| W/SO and other unsupported heads | Separate official outcome/start/eligibility support is required | No zero fill or inherited authorization from a supported volume head. |

For the existing native game producer, `boardSkaterForecast` can integrate its supported eight skater heads only when original same-game, same-player confirmed full-strength lineup or explicit-out evidence is independently reconstructed and matches the stored evidence IDs/scalar. A confirmed PP role, generic return, roster row or legacy availability multiplier does not establish participation. Unknown participation therefore remains a real semantic/data gate. There is no requirement to beat a challenger before honestly labeling an admitted method experimental.

No current genuine tuple was decoded or verified in this task. Therefore **no unconditional head is certified usable now from these checks**. This differs from saying the existing producer cannot produce one once its specific source/evidence requirements are satisfied.

## Bounded metadata observations and immediate blockers

The connected project was identified as `fhfhockey.com` / `fyhftlxokyjtpndbkfse`. Exactly two SQL reads returned schedule/identity/roster/revision metadata only; no outcome or forecast bodies were read and no writes occurred. See `canary-metadata.json`.

The separate candidate game is **2026020112**, Vancouver at Florida, season **20262027**, scheduled **2026-10-15 23:00 UTC**. It is outside the seven known October 15 private-pilot game IDs. At the observed 19:10:03 UTC clock, both schedule receipts were still dated **2026-10-14 00:12:54.911 UTC**, older than the existing 36-hour reader threshold. A new read does not refresh that upstream cache.

Two metadata candidates were returned: canonical **7807 / NHL 8483433 (Jack Devine)** has matching team 13 metadata but native history/participation support was not inspected. Canonical **8466 / NHL 8478147 (Bokondji Imama)** has roster team 13 versus identity team 5 and is **withheld**. They are not an admitted competing pair. No historical repair, identity update or cache refresh was invoked. Do not publish these candidates merely because this metadata exists.

The minimum next approval is a **read-only canary scope preparation**, scoped to game 2026020112 if it is still pregame, otherwise a newly explicitly approved future game. Proposed ceiling: **five sequential metadata reads, at most 256 KiB returned**, with no numeric outcomes, source bodies, retries, account data or changes. Select exactly two unique verified/unmerged skaters whose current identity and unique current-season roster team agree with a game side; inspect only native-history support metadata, original participation assertion metadata and the existing revision/fence metadata. Stop on stale/conflicting scope, unavailable support, a started game, active private-pilot resource conflict or exhausted bounds. Pin the exact returned IDs, game/schedule/roster/source revisions and intended targets before requesting numeric source capture or issuance. Do not carry this game's approval to another game silently.

Any upstream schedule refresh or identity repair is a separate proposed write scope, not part of those five reads. Prefer another already coherent candidate over repairing historical membership for a canary.

## Exact producer entry points after scope/input approval

From `web/`, with Node 22 and a fresh private output path:

```sh
NODE_PATH=. npx ts-node --transpile-only --compiler-options '{"module":"commonjs","moduleResolution":"node","target":"ES2022"}' scripts/preview-native-baseline.ts --inputs APPROVED_NATIVE_OBSERVATIONS_JSON --scope REVIEWED_GAME_SCOPE_JSON --expires-at REVIEWED_PREGAME_EXPIRY --out NEW_PRIVATE_PREVIEW_JSON
```

Inputs are 1–2 original `NativeSkaterBaselineObservation` objects, at most 32 MiB, each with its original actual capture clock, no external projections, verified original final boxscores and historical-source receipt. The scope is at most 64 KiB with exact season/schedule revision, players/NHL IDs/team/roster revisions and 1–10 future game IDs/start times. The capture must be no more than 24 hours old; expiry must be within 24 hours and no later than the first game. The command cannot acquire those inputs, invent missing participation, call the database, release a bundle or overwrite an output. It produces the exact supported category coverage and proposed source/input hashes for review.

Do **not** use `captureCurrentSkaterBaselineInputs` unchanged as a native-only acquisition command: its legacy comparison capture still reads annual external projection tables. The native preview rejects any such projection rows. Supply separately approved original native observations; do not substitute the private research materializations.

The existing full native game producer command, once a current exact code artifact and bounded scope are approved, is:

```sh
NODE_PATH=. npx ts-node --transpile-only --compiler-options '{"module":"commonjs","moduleResolution":"node","target":"ES2022"}' scripts/run-forge-local.ts --date 2026-10-15 --game-id 2026020112 --out NEW_PRIVATE_SCOPE_PREVIEW --max-requests 10 --max-writes 1 --runtime-ms 30000 --request-timeout-ms 8000
```

This is a **read-only code/scope preview**, not model execution. It retains `code.json` and existing revision metadata. Do not run it after the game starts or without separate scoped read approval; hosted fence availability and ownership remain to be checked. Its `--write --artifact ...` mode performs real producer/database work and is not authorized here. A later exact invocation should bind the expected prior revision and a fresh operation UUID, retain existing locking/failure guards, execute once with concurrency one, and use separately approved read/write/row/byte/runtime ceilings. HTTP write-count limits alone are not a row or byte budget; those payload bounds and measured capacity must be established before issuance. No blind retry after an uncertain commit.

## Publication and readback proposal

For a conditional native-rate canary, the publication set can be bounded to **two original input observations plus one policy observation, one independent validation-review observation and one released bundle observation**: five new immutable observation rows maximum, no update/delete or historical repair. Every row and payload byte count must be hash-pinned in a concrete publication manifest after the real inputs exist. The proposed initial public use is only `conditionalTieBreak`; it does not authorize expected totals or primary comparisons. Existing `PLAYER_FORECAST_BASELINE_RELEASE_IDS` activation is a separately approved serving configuration change. The public loader must reproduce the native rates from the exact original input hashes and verify both policy/review receipts. An honest original prospective issuance/readback receipt can support those approval references; a retrospective score or synthetic test cannot impersonate one. No superiority threshold is introduced.

For usable unconditional totals/league-ranked recommendations, use the existing native atomic game producer only when the scope's real participation and category support are present; otherwise publication remains conditional. Same-source expected values must read back identically on FORGE, Start Chart and RSO. Next-N/week unconditional coverage additionally requires each selected game's own valid participation/source context; one current game's confirmation is not reused for future games.

After separately authorized publication/activation/deployment if needed, propose **at most three sequential read-only application requests**, one each to the new FORGE view, Start Chart's matching calendar view and RSO's matching shared data view. Stop on the first identity, clock, value, permission, unit or coverage mismatch. Compare game/player/target values and individual source hashes/clocks; no account requests or refresh endpoints. This request budget does not itself authorize publication, deployment or a genuine account session.
