# Independent native source review

Source-only review; no edits, test reruns, database/provider calls, publication, or fixture admission. Reviewed pipeline/current-native-preparation.md and matching pipeline pins for the four owned native/skater files; goalie helper pinned independently below (not present in pipeline source-pins.sha256).

No blocking source finding in the bounded paths reviewed.

- Current skater path verifies exact original boxscore appearances before deriving minutes, applies the explicit current policy hash, keeps missing target observations out of target numerator/denominator while retaining original recency age, supplies per-appearance conditional means only, and preserves missing targets. Legacy policy remains separate.
- Native goalie W and volume use separate explicit policy hashes. W withholds the entire selected-window rate when any selected outcome is unknown, including relief rows lacking a decision; this can leave genuine W unavailable and must remain a declared coverage gap. Volume uses a common positive-minute appearance denominator with coherent SV+GA=SA and minutes. Neither supplies SO, pStart or appearance probability.
- Native contribution admission delegates first to exact release allowlist/policy/review admission, then reproduces original content hashes, player/season/current-team/roster identity, target rates, units, basis and source IDs. Preview paths explicitly deny database access, emit unreleased bundles and do not grant public uses. Source-confirmed default denial is not production approval evidence.
- Named-roster completeness, actual current receipt coverage, capture authenticity outside retained data, real native transport, approval/publication and genuine shared consumer readback remain unverified. No source review can close those product gates.
- Passive Download planning evidence footer uses only in-memory snapshot/provider/manager inputs, Blob/ObjectURL download and notice state; no auth, fetch, provider refresh, account save, intent edit or workspace mutation is called. It revokes the object URL in finally. No independent execution rerun; lead reported export regression passed.

Reviewed SHA-256 values:

```json
{
  "web/lib/player-forecasts/baselineRates.ts": "0e03df70d0e7c4e834cfd5ae8eb49ab442823eea90f3c4785d8714b3c67b13df",
  "web/lib/player-forecasts/goalieBaselineRates.ts": "60b53c2647e109acfcd5058b237e3b16b94847dac9b9e12e0afb32208c71f764",
  "web/lib/player-forecasts/baselineGeneration.ts": "024dd887e7a93b9e4eb0bd2279a799a3db80beb298809f17db5d6a1ccae49ce9",
  "web/lib/player-forecasts/nativeContributionAdmission.ts": "5501faa1ddd4842e1354ecc24870ab569af47af72ba28af92c81aeecb5181914",
  "web/scripts/preview-native-baseline.ts": "a3f3b90196cbda6cc0205c6fa410596f93c8653587d6c36a885479df3038ab6f",
  "web/components/RosterScheduleOptimizer/RosterScheduleOptimizer.tsx": "5f0a700c5edf0a12e0a5ec3a11243611e2a5eb882322c38c268e61b5975b149a"
}
```
