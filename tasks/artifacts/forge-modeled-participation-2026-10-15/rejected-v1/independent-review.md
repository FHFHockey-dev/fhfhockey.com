# Independent review — modeled skater participation

Verdict: **REJECT pending two P2 clock corrections.** This is a bounded source review of the frozen 15-file increment. No genuine inputs, outcomes, private artifacts, model execution or live actions were used. No other actionable findings were identified within the inspected slice.

## P2 — reject historical outcome evidence captured before the game

Location: `web/lib/player-forecasts/modeledSkaterParticipation.ts:80–83`, following the history validation at lines 62–75 and before resolved-label admission at lines 101–104.

Historical outcome evidence is checked for valid timestamps and an upper bound at the input cutoff. It has no lower bound against its own game's scheduled start. An opportunity with `occurred=true`, `eligible=true`, a resolved positive/zero/nonappearance label, and an outcome evidence capture before that game is consequently treated as resolved and can contribute to a numeric probability. A hash pins this impossible provenance but does not correct it; store replay invokes the same builder and therefore reproduces the same error.

Source-level reproducer using the existing synthetic builder fixture: leave the third historical game scheduled at `2026-10-14T00:00:00Z`, and set only its `outcomeEvidence` to `{ id: "synthetic-pre-game-outcome", hash: "b".repeat(64), availableAt: "2026-10-13T23:59:59Z", capturedAt: "2026-10-13T23:59:59Z" }`. Both clocks pass every current evidence check, all selected label checks still pass, and the builder reaches the numeric frequency branch with no reason added. This trace was inspected, not executed.

Require the exact historical outcome evidence's capture/availability chronology to be compatible with the associated game rather than merely preceding the forecast cutoff. At minimum, a captured pregame body cannot prove a resolved historical outcome. Add focused builder and rehashed/replayed store cases, including a one-microsecond pre-start case and valid timezone-equivalent boundary controls. Do not infer a final horn from the scheduled start; evidence authenticity/finality still requires its separate source proof/review.

## P2 — preserve microsecond target identity in modeled consumer validation

Location: `web/lib/player-forecasts/contributions.ts:191–194`, particularly the newly added modeled `scheduledAt` comparison at line 191.

The builder/store preserve source-clock ordering with `timestampMicros`, but the new modeled consumer guard compares target starts using `Date.parse` through `milliseconds()`. That truncates fractional precision below a millisecond. A modeled receipt for a target one microsecond away from the current opportunity therefore passes this purported exact identity check. The same modeled branch also relies on millisecond issuance/expiry comparisons, so its boundary behavior differs from the replayed receipt clocks.

Source-level reproducer using `modeledParticipation()` in `planningContributions.test.ts`: change only `scheduledAt` from `2026-10-08T23:00:00Z` to `2026-10-08T23:00:00.000001Z`, retaining the same identifiers and revisions. The two `Date.parse` results are equal, so the new guard does not withhold the mismatched modeled context and the otherwise valid native baseline remains eligible for multiplication. No model was executed during this review.

Use the existing microsecond comparison for modeled target equality and related modeled issuance/expiry boundary checks, keeping scope bounded to the new branch. Add negative one-microsecond target/clock cases and positive equivalent-offset/short-positive-interval controls. No broad legacy clock refactor is requested.

## Other inspected properties and acceptance boundaries

The declared estimator uses supplied current-club opportunities, explicit eligible/occurred states, the last at most 20 eligible games within the declared 60-day window, a 14-day recent-eligible-game condition, and bounded fresh scope/issuance receipts. Selected unknown labels remain unknown; absent history is not converted into a zero. Known ineligible/cancelled rows are excluded. Endpoint frequencies are labeled uncalibrated model estimates rather than confirmation.

Completeness and source authenticity remain external attestations: `history.complete` plus source identities/hashes do not mechanically demonstrate that the independently captured regular-season schedule contains every opportunity or that eligibility/labels are authentic. The reviewed source documentation discloses this. Any genuine release must independently establish those facts; the synthetic appeared/nonappeared fixtures cannot establish them.

The store defaults disabled, reads bounded exact ID/hash allowlists, checks row/bundle binding, hashes payload bytes, replays receipt arithmetic, preserves owner/review references as release prerequisites, withholds conflicting player/game releases, and emits sanitized receipt context rather than original historical inputs. An allowlist and nonempty review reference are trust gates, not independent source proof. No persistence-writing path was added here.

The inspected catalog/resolved-forecast paths distinguish an explicit empty catalog from retained reconstruction, preserve conditional native means when participation is withheld, recheck permissions and exact revision fields, and restrict the modeled branch to the compatible native skater per-appearance policy. The game-expectation view redacts denied probability/sample size and omits numerator/selected-game details from its model summary. The page labels estimates and unavailable calibration; no new confirmation promotion was identified. These observations do not override the two clock findings.

## Exact reviewed candidate pins

These are reviewed/rejected candidate hashes, not accepted release hashes:

| Path | SHA-256 |
| --- | --- |
| `web/__tests__/pages/forge/forecasts.test.tsx` | `2ae6242241dc46f24232595cc8c133696e5294f6617ae075e8d8695d15635884` |
| `web/lib/player-forecasts/contributions.ts` | `8f5df1df2b8e7d3a4662596c6b0a2adf57794c60e214910a14b635e53d465de1` |
| `web/lib/player-forecasts/gameExpectations.test.ts` | `b315b0088f1603f1660a05f8dfb65b8cf74c2dafdecab2aae954b774fdd03266` |
| `web/lib/player-forecasts/gameExpectations.ts` | `e00bf2c58aba1eed1d6b2616b063163564daa69a9044465eb37025f9304bc573` |
| `web/lib/player-forecasts/modeledSkaterParticipation.test.ts` | `dda30c4d714f51323eb280633407af62068e6f64677784e0d798592044327972` |
| `web/lib/player-forecasts/modeledSkaterParticipation.ts` | `9f075f2f3b0ba206b895d3df5ae51a21802896fb43fccccbd36b09e13faaa059` |
| `web/lib/player-forecasts/modeledSkaterParticipationStore.test.ts` | `85f3825477442c30075f8554b151aedb131397d2a2e4dbfc2f68c053a61c3d0f` |
| `web/lib/player-forecasts/modeledSkaterParticipationStore.ts` | `4abb54e1ea19c90b06b3c35381b38f189c1476b62cdcc99f8336f385c78949c0` |
| `web/lib/player-forecasts/planningContributions.test.ts` | `902b67b98573bb68af0af60ed5a2535699564d00169ea16a172525036d0cfc88` |
| `web/lib/player-forecasts/planningContributions.ts` | `7e07a8da35da81192bdf668e620f12640c9b14e39d1316b81d21bc4f3270d240` |
| `web/lib/player-forecasts/resolvedPlanningForecast.ts` | `4ecc5d722108b2c62f3addfbb84c894c2ee0463c98c26fcdfbe94a430411b69f` |
| `web/lib/rosterScheduleData/planning.test.ts` | `ce998b93f5eb61ae34a304688d9e01debde00057edaaa1249270eb7a46b49a26` |
| `web/lib/rosterScheduleData/planning.ts` | `f2df56c6063c69ea3a0d42ab5f38bcf8b4279131b2db5ec54c4d4aaa9f90551b` |
| `web/lib/rosterScheduleOptimizer/planningTypes.ts` | `23f919cf4661619cfa53e9b9d0fb41d67028d730dbf4ce6f2f3a3418e83c44f0` |
| `web/pages/forge/forecasts.tsx` | `19ffa38c502c28f8023894ae14a2463ec260fdf291470802451ec01e45be61a3` |

Artifact pins:

- `candidate.sha256`: `a706d34a8ba34219424d35e28c329629e7af201d4ae350f20dd3610e9dca4e75`
- `change.patch`: `74809990c2198f80ac1520ee608dca5f06e5823e16d4e9b6fd391cbb44dd05e1`
- `before.json`: `15add442879d239549de39a575adf7c00862f4058a5714926ef633a5fad63861`

All 15 current hashes match the manifest. Offline application of the patch against retained before copies (or absent files for the four additions) reproduces every current file exactly. All declared before hashes applicable to changed files match. The page pair has retained before copies used by reconstruction but is not listed in `before.json`; its reviewed delta is still exact.

## Verification actually performed

Read-only diff/source/test/necessary local dependency inspection, SHA-256 checks, and offline textual patch reconstruction. This report is the only reviewer-written file. No test, model, producer, numeric genuine-input analysis, compiler, build, browser, database/provider/network operation or worker execution occurred.

The author reports 211 focused tests across six nearest files and a passing 15-path ESLint check. These checks were not rerun by this reviewer; the two new clock reproducers were assessed statically. No full TypeScript result applies to this new frozen tree. Correction, focused regression evidence and same-peer re-review are required before bounded acceptance; genuine release/forecast qualification remains separate.
