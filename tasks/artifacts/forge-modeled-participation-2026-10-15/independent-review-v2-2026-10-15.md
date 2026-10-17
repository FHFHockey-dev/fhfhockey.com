# Independent re-review — modeled participation clock corrections

Date: October 15, 2026.

Verdict: **ACCEPT the exact corrected 15-file source candidate for bounded integration.** Both P2 findings are resolved. No remaining actionable findings were identified in this focused re-review. This accepts implementation mechanics; it does not qualify genuine denominator evidence, a model's predictive quality, a forecast release, or any live/public action.

The original rejection remains intact at both `independent-review.md` and `rejected-v1/independent-review.md`, SHA-256 `6dbe4aa1ab9d17b04ce44747bee41792c99e52178e23b4f2d5eaf2b86b5dfcd3`. This sidecar supersedes that rejection only for the corrected candidate pins below.

## Corrections checked

1. `modeledSkaterParticipation.ts:74–76` now rejects historical outcome evidence whose `availableAt` **or** `capturedAt` precedes its game's scheduled start. It uses the same microsecond helper as the existing builder. Subsequent generic evidence validation still rejects malformed clocks and future evidence. Builder regressions cover both clocks separately, one-microsecond pre-start evidence, and timezone-equivalent boundary clocks. The store regression supplies a newly hashed bad packet to exercise replay rejection, followed by a valid equivalent-offset control. This closes the pregame-outcome provenance finding without claiming that scheduled start proves a final horn or authentic outcome.

2. `contributions.ts:166–204` selects microsecond clock parsing for the versioned modeled branch, including common cutoff/issuance/expiry checks. Its modeled checks use exact target-start equality, issuance before start, expiry no later than start, a positive validity interval, and microsecond-scaled 24-hour durations. The non-modeled branch retains millisecond precision; the added clock-validity checks fail closed on malformed comparison times. The new dependency is the existing pure `evidenceTime` helper, with no server client or circular import introduced. Resolver regressions cover one-microsecond target, issue, cutoff and expiry failures, equivalent offsets, and a short positive microsecond validity interval. This closes the consumer precision finding.

No changes outside the five correction paths were found in the 15-file candidate. The other ten hashes remain identical to the initially reviewed frozen source, so the prior bounded assessment of estimator selection, unknown handling, default-disabled exact ID/hash release admission, receipt replay, catalog revocation, denied uses, model labeling and confirmation isolation remains applicable.

## Exact accepted current pins

| Path | SHA-256 |
| --- | --- |
| `web/__tests__/pages/forge/forecasts.test.tsx` | `2ae6242241dc46f24232595cc8c133696e5294f6617ae075e8d8695d15635884` |
| `web/lib/player-forecasts/contributions.ts` | `7ac1106ff00e94251b6921b6ef2e264b145af9ced28b14ea65dfae46b8efa35a` |
| `web/lib/player-forecasts/gameExpectations.test.ts` | `b315b0088f1603f1660a05f8dfb65b8cf74c2dafdecab2aae954b774fdd03266` |
| `web/lib/player-forecasts/gameExpectations.ts` | `e00bf2c58aba1eed1d6b2616b063163564daa69a9044465eb37025f9304bc573` |
| `web/lib/player-forecasts/modeledSkaterParticipation.test.ts` | `434e7f462888be98018972423aec3731015c524b03d0e77f81f8ca152fd6ba4b` |
| `web/lib/player-forecasts/modeledSkaterParticipation.ts` | `157352da47f39e0884b6878e360b84c3861b80da52f2446e98c454c07dd79de0` |
| `web/lib/player-forecasts/modeledSkaterParticipationStore.test.ts` | `c22afe3401daae98cc97e72d1f6bbb58e35b7b4a003ae45aa8a0273b36e92548` |
| `web/lib/player-forecasts/modeledSkaterParticipationStore.ts` | `4abb54e1ea19c90b06b3c35381b38f189c1476b62cdcc99f8336f385c78949c0` |
| `web/lib/player-forecasts/planningContributions.test.ts` | `5f605900cff4cd6b313137705c768c4e539ba3b8426a314f520f3d1812e9dc07` |
| `web/lib/player-forecasts/planningContributions.ts` | `7e07a8da35da81192bdf668e620f12640c9b14e39d1316b81d21bc4f3270d240` |
| `web/lib/player-forecasts/resolvedPlanningForecast.ts` | `4ecc5d722108b2c62f3addfbb84c894c2ee0463c98c26fcdfbe94a430411b69f` |
| `web/lib/rosterScheduleData/planning.test.ts` | `ce998b93f5eb61ae34a304688d9e01debde00057edaaa1249270eb7a46b49a26` |
| `web/lib/rosterScheduleData/planning.ts` | `f2df56c6063c69ea3a0d42ab5f38bcf8b4279131b2db5ec54c4d4aaa9f90551b` |
| `web/lib/rosterScheduleOptimizer/planningTypes.ts` | `23f919cf4661619cfa53e9b9d0fb41d67028d730dbf4ce6f2f3a3418e83c44f0` |
| `web/pages/forge/forecasts.tsx` | `19ffa38c502c28f8023894ae14a2463ec260fdf291470802451ec01e45be61a3` |

Evidence bindings:

- Current `candidate.sha256`: `c91fee51de5bf2e1fedbc49858d5d7d719a60d6b8ad00cd8b4e186dc613c3e18`.
- Exact five-path `clock-corrections.patch`: `e741646d9ba92d0b7f7d081c5b65990175fe4b79d3c4fd06d26cfbea4cb6bc0e`.
- Preserved initial `rejected-v1/candidate.sha256`: `a706d34a8ba34219424d35e28c329629e7af201d4ae350f20dd3610e9dca4e75`.

All 15 current files match the current manifest. Each correction before-copy matches its rejected manifest pin, and independent offline application of all five correction hunks reproduces the corresponding current files byte-for-byte. The set of changed manifest entries equals exactly the five patch paths; the remaining ten entries are unchanged.

## Verification and limits

The author reports 223 passing focused tests across four affected files and a passing five-path ESLint check. The correction source and regression assertions were inspected; these checks were not rerun by the reviewer. No model, test, producer, compiler, build, browser, worker, genuine input analysis, private artifact read, database/provider/network operation or source edit occurred in this re-review. This sidecar is the only reviewer-written file.

Source truth and completeness remain external release prerequisites. A `complete` flag and hashes cannot independently prove a full current-club regular-season opportunity enumeration, dated eligibility, actual outcomes or original pre-cutoff availability. Receipt replay proves deterministic arithmetic over supplied inputs. The synthetic regressions establish mechanics and fail-closed boundaries, not genuine issuance or forecast quality. No all-appearance penalty-minute or confirmed-lineup claim is established.

The RSO transport and SC adapter reviews remain separately scoped. A coordinated TypeScript result for the final combined frozen tree is still required; the earlier successful compiler receipt predates this candidate. FORGE retains sole combined compiler ownership. No release membership, model fitting, data acquisition, publication, production write or deployment authority is added by this acceptance.
