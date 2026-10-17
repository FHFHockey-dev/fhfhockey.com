# Native goalie win mean: bounded local increment

Implemented only in `web/lib/player-forecasts/goalieBaselineRates.ts` and the nearest existing `goalieBaseline.test.ts`. Existing `goalie-baseline-rates-v1` calculations and source IDs remain unchanged.

New opt-in executable API:

```ts
NATIVE_GOALIE_WIN_POLICY_VERSION // native-goalie-appearance-win-rates-v1
nativeGoalieWinDefinitionHash(seasonId)
buildNativeGoalieWinRates(input: Parameters<typeof buildGoalieBaselineRates>[0]): GoalieBaselineRateSnapshot
```

Requires zero projection inputs, at most 200 captured appearance rows, and existing canonical identity/cutoff validation. Selects the latest 20 current regular-season appearances. Each selected original final boxscore is authenticated and its starter/decision receipt rederived. A missing decision or invalid auxiliary outcome context withholds the entire mean; no missing observation becomes zero or disappears from its denominator. Original selected-player content, identity or volume disagreement is fatal. Exact `W` credits count one, exact `L`/`O` count zero, and relief wins remain in the positive-minute appearance population. The rate is an equal-weight mean over that declared captured window; historical population completeness and predictive qualification remain unverified.

`buildGoalieContributionBundle` accepts homogeneous snapshots under the new policy, emits only its W target with `basis=per_appearance`, `participationIntegrated=false`, and keeps sources/manifests unreleased. New-policy definition hash is distinct; old/new snapshots cannot share a bundle. The established source-ID recipe remains `baseline:hash({snapshot,teamId,rosterRevision,targetKey})`. Pipeline owner received the API for exact native-admission reproduction and producer glue; that separate integration is outside this worker's edits.

No pStart or appearance probability is inferred. A downstream appearance probability of 0.8 with rate 0.5 produces 0.4 expected W even when pStart is 0.6; absent appearance probability leaves W unknown. This does not complete the league's W4/GA−1/SV0.2/SO3 points projection: SO and genuine future participation remain missing.

## Exact shutout source gap

`baselineInputCapture.ts:156,179` reads retained raw records only with `endpoint="boxscore"`. `nativeGoalieOutcomes.ts` verifies explicit goalie `starter`/`decision` and returns `shutoutCredit:null` with `SHUTOUTS_GOALIE` missing. `goalieBaselineInputCapture.ts` has no separately authenticated credited-shutout source. No existing selected field establishes official individual SO credit; GA=0, a team shutout, start status, and win decision cannot substitute.

Smallest defensible future extension: one optional **explicit official credited-outcome receipt** on the existing native outcome input, containing canonical NHL player, game, season and historical team identity; official individual credited SO value 0 or 1; declared provider/endpoint and immutable raw row/content hash; original fetch/capture clocks. Authenticate and bind it to the same final game/player and cutoff, then expose that explicit credit. A missing receipt must remain null. Do not create a generic mapper or assume an NHL JSON field before an actual approved original source schema is supplied and verified.

Required read scope, if later authorized: identify a retained official per-goalie/per-game credited-SO source for the exact selected current-season window (at most 20 positive-minute appearances for each expressly selected goalie; no private/held-out outcomes). Read the original raw payload and source metadata plus identity join, retain zero and one credits explicitly, record unknown/unavailable/mismatch, and authenticate fetched/available time no later than the capture cutoff. Existing capture provides no such source; this implementation made no live calls and cannot name a verified provider route or claim its availability.

## Verification

- `npm test -- --run lib/player-forecasts/goalieBaseline.test.ts`: 40 passed. Covers unchanged legacy rates; new version/hash; unreleased bundle; W and L means; relief W; missing starter/decision; one missing row withholding a two-row denominator; forged content, duplicate games and projection inputs; exact W+L mean 0.5; appearance-versus-start multiplication.
- `npx eslint lib/player-forecasts/goalieBaselineRates.ts lib/player-forecasts/goalieBaseline.test.ts --report-unused-disable-directives-severity warn`: passed.
- Targeted `git diff --check`: passed.
- No broad suite, build, database read/write, source fetching, publication, model fitting or private outcome access.

Initial W increment pins (superseded by the additive volume increment below):

```text
81d43bc2583bf73db25e859324391ed495cf7e213a64bb65560818323dd7cf41 goalieBaselineRates.ts
9aea270b38fe6b7c43aac9f7b4b0da9669f62691bfe0084cee3db4b7a3e32124 goalieBaseline.test.ts
```

## Additive current-only volume increment

Added a separate `native-goalie-appearance-volume-rates-v1` policy, `nativeGoalieVolumeDefinitionHash(seasonId)`, and `buildNativeGoalieVolumeRates` in the same module. Original W and legacy policy outputs remain unchanged. The new policy shares the bounded current positive-minute window and authenticates every selected original boxscore, then computes SV, GA, SA and minutes over one equal-weight joint appearance denominator, including relief. It requires SA=SV+GA and 0<minutes<=65 in every selected appearance; missing/unbound components reject the result instead of reducing a target-specific denominator. Its homogeneous bundles remain unreleased. SO and W are explicitly absent from this volume snapshot; future participation/pStart remain unsupplied.

The nearest suite now passes **43 tests**, adding a current-only full/relief pair with joint means SV18/GA1/SA19/minutes45, original-content/missing-receipt rejection, the regular-season minute bound, and downstream appearance conditioning with missing participation left unknown. The existing resolver does not manufacture a start probability from a volume-only source. Initial test expectations that a volume-only resolved forecast would retain the original start probability failed; they were corrected to match the existing unknown-preserving semantics. No product source changed to satisfy that expectation. Targeted ESLint and diff whitespace checks passed. Pipeline owner received the frozen API for preview/admission glue; no further review or live execution was performed.

Current worker source pins:

```text
60b53c2647e109acfcd5058b237e3b16b94847dac9b9e12e0afb32208c71f764 goalieBaselineRates.ts
e922bafa6acd6644e5d389ba565d6843919a1db185f0a65ed72ce7d8de2b6fc9 goalieBaseline.test.ts
```
