# F4 receipt: team, goalie and game-prediction admission (PROV-GUARD slice 5)

**Base** HEAD `c0ebd63f7303acd60d2d2ffbc1072978e552cf88` · **Uncommitted.**

No production or provider reads, migrations, capture activation, deploys, pushes or git mutations. Tests ran offline (socket/fetch blocker).

**Files:** only the F4 grant plus my existing PROV-GUARD files. One adjacent artifact: `__tests__/pages/api/v1/forge/__snapshots__/goalies.test.ts.snap`, which gains only the new `diagnostics.runProof`.

## Admission follows the real dependency

| Output | Depends on | Admission |
|---|---|---|
| `forge_team_projections` | Skater heads summed per team (`skater-stage.ts` blends the season prior, then team totals at ~:2828) | Same proof as the run's skaters |
| `forge_goalie_projections` | Opponent team shots derived from skater lines (`goalie-stage.ts:189`), even with direct goalie bootstrap off | Same proof as the run |
| Game predictions | `forge_team_projections` goals and shots via `featureBuilder.ts` (read ~:2912, chosen ~:1255, used ~:1960), persisted in feature snapshots and served from storage | Proof status of the snapshot's team-projection run, **read now** |

**Missing proof means `unproven`, never "contaminated".**

**`contradicted`** is the only positive signal. It means a verified-clean producer, either a listed release SHA in the snapshot's `codeVersion` or a listed closure stamp, captured the run and withheld the claim. That code withholds it only when its own reads included a fantasy or unaudited source.

**Not attempted:** detecting "actually pundit-derived" output beyond that would require reading `payload.reads`, the full captured transcript, which is out of scope.

## Path matrix

| Surface | Latest | Explicit `runId` | Fallback | Persisted reuse | Serving |
|---|---|---|---|---|---|
| `/api/v1/projections/teams` | Proven latest, else labelled 404 (`external_input_provenance_unproven`) | Must be a succeeded release with proof, else 422, **before** any row read. Replaces the never-claimed run-metrics check | n/a | n/a | `runProof` |
| `/api/v1/projections/goalies` | Same as teams | Same as teams | n/a | n/a | `runProof` |
| `/api/v1/forge/goalies` | Proven latest | Succeeded, released and proven before rows; failed and running runs are refused | Up to 30 released succeeded runs, **filtered by proof** before any row count or read, latest date first | n/a | `diagnostics.runProof`. **:441 fix:** a missing starter chance, shots against, saves, GA or shutout chance stays `null`, never 0 |
| Game predictions, new feature snapshots (`featureBuilder`) | Contradicted runs are never used; unproven runs are used (today's visibility) unless the flag is on | n/a | Next-newest admissible row | n/a | `forgeProjection.proofStatus` and `proofBasis` are recorded in the snapshot |
| Game predictions, backfill reuse (`workflow.existingFeatureSnapshotId`) | n/a | n/a | n/a | Reused only if its FORGE run is admissible **now**: contradicted triggers a rebuild, unproven reuses (unless the flag is on) | n/a |
| Game predictions, public serving (`publicPredictions`) | n/a | n/a | n/a | n/a | Each prediction carries `forgeInputProvenance {status: proven \| unproven \| contradicted \| not_used, home, away}`. Only contradicted is withheld (unproven too with the flag), counted in `withheldForForgeProvenance` |

A failed proof read on the prediction paths leaves runs **unproven**. It never proves them and never hides predictions by default. The API endpoints fail closed as before.

Shared helpers in `externalInputProof.ts`:
- `requireExternalInputProvenRun`: an explicit run must be a succeeded release with proof. Players, teams and goalies use it, and it also tightens players.
- `classifyExternalInputProof` and `classifyExternalInputProofRows`.

## TJ's open choice: `GAME_PREDICTIONS_REQUIRE_FORGE_PROOF`

Unset, or anything but `"true"`, is the **default** and keeps today's visibility.

**What turning it on would change:**
1. New feature snapshots stop using FORGE team projections from unproven runs. Goals and shots fall back to the next proven row; if none exists, they are `null` with the existing `forge_projection_fallback` flag.
2. Backfill rebuilds stored snapshots that used unproven runs instead of reusing them.
3. `/api/v1/game-predictions/latest` (`publicPredictions`) withholds every stored prediction whose snapshot used an unproven FORGE run.

**Release risk if it's on:** production capture is off, so nearly every stored prediction that used FORGE team projections is unproven today. They would disappear from the predictions page and the homepage analytics until runs from a verified closure (after a release) produce new snapshots.

## Callers affected by the team and goalie refusal

These change from "served unproven" to a labelled 404/422 or a proven fallback.

| Endpoint | Callers |
|---|---|
| `/api/v1/projections/teams` | `components/GameGrid/utils/useTeamForecasts.ts` → **GameGrid** team forecasts (and `lib/predictions/legacyQuarantine.ts` lists it) |
| `/api/v1/forge/goalies` | `components/forge-dashboard/GoalieRiskCard.tsx` (**/FORGE** dashboard), `lib/dashboard/dataFetchers.ts` (**/trends** and dashboards), `lib/dashboard/commandCenterData.ts` (command center) |
| `/api/v1/projections/goalies` | Deprecated alias; listed in `legacyQuarantine.ts` and `compatibilityInventory.ts` |
| Crons | None call these endpoints (`vercel.json`). The game-prediction forecast cron (`/api/v1/game-predictions/forecast`) builds features through `featureBuilder`, so only the contradicted-run exclusion applies by default |

With capture off, these readers serve only runs from a verified closure or release (538100d41). Until such runs exist they show their existing unavailable or empty state.

## Producer closure

F4 files are all outside the closure.
- **This state (HEAD `c0ebd63f7` plus PROV-GUARD's files):** `4c06fd9e…9993`. VERIFIED with `--tree`: 193 modules, 0 findings. Receipt sha256 `75779f58…97a5`. **Now listed.** It equals the earlier worktree value, because Astra F3's `rsoUsePolicy.ts` has since been committed (`9e66c7e20`).
- `6613c9ef…0616` (the bundle-proof tree on `c5829aa9e`) stays listed.
- FORGE-RESERVE's uncommitted closure edits will change the integrated identity. Re-verify the final SHA and list it.

## Checks

| Check | Result |
|---|---|
| Focused vitest: 44 files (proof, allowlist, identity, apiHelpers, run fence, resume, module-imports, all `forge/*` and `projections/*` routes, start-chart, ledger, `lib/game-predictions`, `nhl-predictions` page, game-prediction routes, `lib/dashboard`), UTC and America/New_York | **passed**: 650, 1 skipped, in each |
| Whole-project tsc on HEAD `c0ebd63f7` plus this lane's 31 files, in a `/private/tmp` export, under the heavy lock | **passed**: exit 0 (the working tree also holds other lanes' uncommitted edits) |
| eslint on this lane's changed files | **passed**: exit 0 |

## Files (this lane, uncommitted: V2/V3 plus F4)
- `45d31d338d7b3b1ab83ff0acd195bbf3c1b06146dfb67fcb38ab3e61489674ec`  web/next.config.js
- `2da61a46b89df70669c454f08fbefd3a0803655a92226f0c8020aad9b9d3c456`  web/scripts/verify-forge-release-sha.ts
- `04827fe65985045df96861dd550908d19d12daeba37c28bf32d67858a1249720`  web/lib/projections/forgeProducerIdentity.ts
- `e7a82e251eadce07df936f9a59268bf7dc21c8576f02b1edc0e3202ce489bb5b`  web/lib/projections/forgeProducerIdentity.test.ts
- `4fdecdac4945c386baabc6387c6a448ce008e34f221091e596a16d138fedd586`  web/lib/projections/externalInputProof.ts
- `86ffc799e48f324db316eb3b880139d03808ad8e6e6181fab6f6950bf1dc028e`  web/lib/projections/externalInputProof.fixtures.ts
- `3a0fc653822d3a0922aae79454df9db1ced881891ec3374bebac0afaac2aab1c`  web/lib/projections/externalInputProof.test.ts
- `d3bbdaa6117471da445c08e5fe3549d2c7e97d23d713303b5519b69bedc70cb3`  web/lib/projections/verifiedForgeReleases.ts
- `97595103e632f86ef60d5803a58d5852105cf6500a235668daf6d9b9729a328b`  web/lib/projections/verifiedForgeReleases.test.ts
- `dc62d685b38c5137b2710c18a0b329565cecd090d7cd7de7d11ddb6e2a93c865`  web/lib/projections/releasedRunFence.test.ts
- `6e82e20488b8f19cb841587f8b188071ea0dacd00fde60a698e2873b15a2699c`  web/pages/api/v1/forge/players.ts
- `72e701f3c297a5f78afd1c708a092fd3386891e6474f9ee71b3ecca19fadd5c1`  web/__tests__/pages/api/v1/forge/players.test.ts
- `899c3af8dec949f605d16963513c88d19b25cb9ddb6ba9b99473ac91de38bfe7`  web/pages/api/v1/projections/players.ts
- `299b3e4dafb8ca585d74cf0d9bc0af5ae4b7b3273b23bb6f34b140ee193ff725`  web/__tests__/pages/api/v1/projections/players.test.ts
- `801de23bdb170799b3d14b43b2193d8c937774bd00d17588098c6c050d581561`  web/__tests__/pages/api/v1/projections/explicitRunAdmission.test.ts
- `b5bbe2e5b3a64f8368dc409ad11207420af36811c0342e9cbfd49220c3d3f98e`  web/pages/api/v1/start-chart.ts
- `9601527da7de26fd44f555af069edd1225eef29695bab3f603c5f298083b5b67`  web/__tests__/pages/api/v1/start-chart.test.ts
- `078c65c01ab2020f8b09aa227653cc27ff2b339878657ab4f77ee7478ad4e291`  web/pages/api/v1/db/forge-served-forecast-snapshot.ts
- `6bdb2c3708b9da204a27f87bfbc13de3766956ecba438ca25e036921583fc983`  web/__tests__/pages/api/v1/db/forge-served-forecast-snapshot.test.ts
- `22cf63a21a766df5cc85ebda6266c4ca58ea4723beacf02b34f6ad8970b543e7`  web/pages/api/v1/projections/teams.ts
- `0f6ad32a3a96cfacf740515e47806008b29d45a1a04de9a3b5725190d86ca2c6`  web/pages/api/v1/projections/goalies.ts
- `fbec078339934cf71697731f5719477fdfc7e8cc3d63328c885f55db75ba3f0e`  web/__tests__/pages/api/v1/projections/goalies.test.ts
- `91e7a16f5c2793841e1a71bb3d92327c729ca4ee8e0d1c3e7a6ad91542d82cae`  web/pages/api/v1/forge/goalies.ts
- `cc39e006387d9ac6a980f70632ae118cc317b5cc1f087c3674eab602f6a1e6d6`  web/__tests__/pages/api/v1/forge/goalies.test.ts
- `07abdd31088ce4a97e9e6e64034917f1595bc2dc16910921e4027e8c72661ab5`  web/__tests__/pages/api/v1/forge/__snapshots__/goalies.test.ts.snap
- `6858f52d23abf9cf31bf4f59000d3c04d540deaf0042a75f681ab969a76b1c14`  web/lib/game-predictions/featureBuilder.ts
- `b569b0d7c4e952a7366b70e2be0e72efd95a45170735bd0f2ced4ec0c0d842ba`  web/lib/game-predictions/featureBuilder.test.ts
- `01e50c2cff2062a3de72f3c14035cdac8d483fb7a314a0cb458d73caae26259d`  web/lib/game-predictions/workflow.ts
- `716f1e54ffd3449016544b70870bb30e75b8972887c27de3f1ba2c2717b52d92`  web/lib/game-predictions/workflow.test.ts
- `0645dbfe87cdcff5593638f2dfcc489e7ae2fd3a7574334cbfead205646836ae`  web/lib/game-predictions/publicPredictions.ts
- `164f4049fde8460625b62af05284a14708c7a87fbafa500961197eb039af8743`  web/lib/game-predictions/publicPredictions.test.ts
- `75779f58cbd44549a7fc0bfbecc01b09a2cd10c4e06f0a5cca768a867fc697a5`  tasks/artifacts/projection-table-audit-2026-10-26/release-verification/closure-4c06fd9e2b5a5d880f594cb2668b81eaa0c54553de525a73f477d4eebf909993.json
- `367a4cc0493f545fe72f0c4da7b0e5f1857fe8c4073c15cf3ae824ed2426b8c6`  tasks/artifacts/projection-table-audit-2026-10-26/release-verification/closure-6613c9ef43129584230e5c6f70adc2691b3af501edcc8574d297d23b10920616.json
- `c7ce6343bc8ee48a644c4facbd514605401c46ca20e20c65a947b01878372036`  tasks/artifacts/projection-table-audit-2026-10-26/release-verification/538100d41ee87e721d2764b694f7bac8c2f2bb34.json
- `014006353ec248c06c0c5b575d3aabb9dfde5436134c01aee6ff530bbb6959c0`  tasks/artifacts/projection-table-audit-2026-10-26/release-verification/bd337d97aefd959832b3466037d163f320a23d99.json
