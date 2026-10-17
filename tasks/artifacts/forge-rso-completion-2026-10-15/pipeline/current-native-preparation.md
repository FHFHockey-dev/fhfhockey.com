# Current native appearance preparation

Implemented locally, default unreleased. No genuine input capture, provider request, database read/write, publication, model fitting or deployment was performed by this worker. Actual named case supplied by the lead: FHFH2026-27 / FHFHTJ,19 identities retained; freshness/schedule/provider context are not established by these synthetic tests.

## Skaters

`current-appearance-skater-rates-v1` explicitly selects the latest20 verified current-season regular-season positive-minute appearances and uses recency weights0.9^appearanceAge. Missing target values contribute neither numerator nor denominator; their appearance age still advances. There is no external projection or prior-season fallback. The existing `skater-baseline-rates-v1` policy/hash and prior requirement remain unchanged.

Supported whole-game receipt targets: G,A,points,SOG,HIT,BLK,PIM. TOI minutes comes from the exact verified final-boxscore receipt's positive appearanceSeconds/60. PPP uses a known original boxscore PPP field or the existing strict original landing derivation; no unknown PP/PK component becomes zero. Participation is not supplied. PIM and TOI contributions retain minute units. Players with an explicit empty current history remain listed with missing targets when other players have supported rates; an entirely unsupported bundle fails clearly rather than publishing empty forecasts.

Existing entry point from `web/`:

```sh
NODE_PATH=. ./node_modules/.bin/ts-node --transpile-only --compiler-options '{"module":"commonjs","moduleResolution":"node"}' scripts/preview-native-baseline.ts --inputs CURRENT_NATIVE_SKATER_OBSERVATIONS.json --scope REVIEWED_SCOPE.json --expires-at PRE_GAME_EXPIRY --out NEW_PRIVATE_PREVIEW.json
```

The native path selects this method only when the observation payload explicitly declares the new policy/version and correct `currentAppearanceDefinitionHash(seasonId)` from `baselineRates.ts`. Bounds:1–50skaters,1–20future scoped games, up to200 retained appearances/player (latest20selected),32MiB input file,64KiB scope file, current capture within24hours, pregame expiry within24hours, exclusive new0600 output file. Old preview bounds stay1–2skaters/1–10games.

Exact TypeScript source shape: exported `NativeSkaterBaselineObservation` in `baselineGeneration.ts`:

```ts
{
  provider: "fhfh", dataset_key: "baseline-inputs-v1", entity_kind: "player",
  entity_key: `${seasonId}:${canonicalPlayerId}`,
  available_at: capturedAt,
  payload_hash: playerForecastSourcePayloadHash(payload),
  payload: {
    basis: "captured_current", capturedAt,
    policyVersion: "current-appearance-skater-rates-v1",
    definitionHash: currentAppearanceDefinitionHash(seasonId),
    playerId: canonicalPlayerId, nhlPlayerId, teamId: currentTeamId, rosterRevision,
    projections: [],
    appearances: [
      baselineAppearanceFromBoxscore({
        rawRow, game, nhlPlayerId, teamId: historicalTeamId,
        cutoffAt: capturedAt, population: "skater"
      }) // omit null nonappearances; retain all missingness separately in capture inventory
    ],
    derivedPowerPlayPoints: undefined, // optional original matching landings, never synthetic PP zeros
    limitations: []
  }
}
```

`rawRow` must retain original `{id,game_id,season_id,payload_hash,fetched_at,payload}` and original boxscore content; `game` must retain canonical `{id,seasonId,date,type:2,startTime,homeTeamId,awayTeamId}`. The appearance object must come from `baselineAppearanceFromBoxscore`, including retained `finalBoxscore` receipt and contentHash, and must reproduce exactly. Historical team membership comes from the original boxscore, separately from current roster binding. Capture cutoff is the actual current read receipt, not an invented historical availability date. Under this new explicit method, original native receipts replace the old processed PBP/shift historical-manifest dependency; selected-history population completeness remains explicitly unverified.

For PPP, optional `derivedPowerPlayPoints` is `{version:"native-power-play-points-inputs-v1",landings:[{rawRow:{id,endpoint:"landing",game_id,season_id,fetched_at,payload_hash,payload},contentHash}]}` matched one-to-one to every supplied appearance. Existing `deriveNativePowerPlayPoints` rejects incomplete/misbound landing evidence.

## Goalie wins integration

Reviewer-owned `goalieBaselineRates.ts` supplies explicit `native-goalie-appearance-win-rates-v1`, `nativeGoalieWinDefinitionHash` and `buildNativeGoalieWinRates`. This worker wired exact reproduction into `nativeContributionAdmission.ts` and the existing preview CLI:

```sh
NODE_PATH=. ./node_modules/.bin/ts-node --transpile-only --compiler-options '{"module":"commonjs","moduleResolution":"node"}' scripts/preview-native-baseline.ts --inputs CURRENT_NATIVE_GOALIE_OBSERVATIONS.json --scope REVIEWED_SCOPE.json --expires-at PRE_GAME_EXPIRY --out NEW_PRIVATE_PREVIEW.json --goalie-wins true
```

Exported `NativeGoalieWinObservation` in the preview script uses the same envelope with `dataset_key:"goalie-baseline-inputs-v1"`; payload declares the win policy/hash, native goalie identity, capturedAt, projections:[] and original goalie appearance receipts from `baselineAppearanceFromBoxscore(...population:"goalie")`. Bounds1–20goalies,1–20games,200retained appearances; original helper selects latest20current appearances. W is per positive-minute appearance including relief, not per start. No appearance or start probability is inferred. SO and unsupported volume/minutes remain missing. Any missing selected decision/context withholds W rather than shrinking its denominator. Original boxed goalie proof includes endpoint:"boxscore", matching startTimeUTC, final period metadata, team scores, positions, explicit starter/decision labels and coherent SV+GA=SA.

Both paths produce unreleased bundles with no public allowedUses. Existing exact policy approval, review, release allowlist and source-content reproduction remain necessary. Synthetic admission tests explicitly mock prior approval only to exercise source reproduction; they are not real approval or release evidence.

## Existing capture functions for reuse

- `baselineAppearanceFromBoxscore`, `verifyBaselineBoxscoreReceipt`: exact native identity/finality/count/time proof.
- `deriveNativePowerPlayPoints`: receipt-backed PPP; `deriveNativeGoalieOutcomes`: explicit observed goalie decisions, deliberately no inferred SO.
- `captureCurrentSkaterBaselineInputs` / `captureCurrentGoalieBaselineInputs`: existing1–20identity,8-second bounded stored-input read orchestration. They also read old projection/history/PBP metadata and retain legacy policy definitions, so new-policy native-only capture should use their source helpers without claiming their old payload is the new method.
- `readStableCurrentInputs`: two-pass consistency; `readBounded`, `readBaselineBoxscores`: bounded existing stored rows. These are not provider-fetch routines.

Forthcoming capture must declare its named19 roster, exact current team/game schedule, maximum source requests/bytes, original capture clocks, historical selection/exclusions, partial-page accounting and no-write scope before execution. No expired SOG canary or protected outcome/archive is an input. The root owns the live-data capture/coverage inventory.

## Verification

- After skater increment: `npm test -- scripts/preview-native-baseline.test.ts lib/player-forecasts/contributions.test.ts lib/player-forecasts/nativeContributionAdmission.test.ts --run`:131passed.
- After W glue: native admission21passed; preview10passed. The preview test exercises explicit CLI output and mutually exclusive mode flags, default denied uses and missing SO.
- Prior common-shared expectation tests18passed, including seasonal adapter identity fix and20scheduled-game unknown handling.
- Typecheck initially found one test fixture literal widened to string; fixed by explicitly typing the native payload. The already-started8GiB check completed exit0 before final volume glue; lead owns final integrated typecheck.
- Direct whitespace check and source pins retained in `source-pins.sha256`; dirty pre-existing tracked changes were preserved. No whole app build or release performed.

Outstanding: genuine current source/roster/game coverage; authentic SO support; genuine appearance/start probabilities; native approval/publication and same-revision consumer readback. Missing nonzero weighted targets must withhold complete named-league points (G3,A2,PPP1,SOG.2,HIT.2,BLK.25; goalieW4,SV.2,GA−1,SO3).


## Coherent native goalie volume followup

The reviewer added separate `native-goalie-appearance-volume-rates-v1` with `nativeGoalieVolumeDefinitionHash(seasonId)` and `buildNativeGoalieVolumeRates`. This worker wired it into the same source reproduction/admission and existing preview via `--goalie-volume true`. It is mutually exclusive with `--goalie-wins` and `--season-artifact`. Use the same goalie observation envelope above, changing only payload.policyVersion and definitionHash. Exported `NativeGoalieObservation` describes either explicit policy; `NativeGoalieWinObservation` is retained as an alias.

SV,GA,SA and minutes share one verified current positive-minute appearance denominator; SA=SV+GA, minutes>0 and<=65. No prior, external projection, win, SO, participation or pStart is inferred. W and volume are separate immutable policy bundles over the same original receipt cutoff, not a changed legacy policy. Neither path alone establishes complete goalie points while SO has a nonzero league weight.

Final targeted glue check: `npm test -- scripts/preview-native-baseline.test.ts lib/player-forecasts/nativeContributionAdmission.test.ts --run`:33passed (11preview/22admission), exercising both explicit goalie policies. Source unit and original proof tampering are rejected. Existing contribution suite102passed after current-only skater changes. No repeated global typecheck launched after the completed supporting check; lead owns integration verification. Sources frozen after pins.

## Offline roster assembly and capture boundary

`currentRosterNativeInputs.ts` reuses original native boxscore/landing validators to assemble explicit current-native observations from bounded retained HTTP receipts. Every supplied roster identity/game is accounted for; historical membership comes from both original team lists, and unknown/absent history remains explicit. No empty-history observation is invented. HTTP source IDs are `http:<original body SHA256>`; PPP and goalie outcome validators accept only that exact bound identity or existing numeric database IDs. Current-club schedule discovery remains an incomplete historical sample, especially for trades.

Existing CLI now accepts explicit `--roster-scope` with collector receipt/failure arrays; original SOG mode is unchanged and is not executed for this goal. Final11capture/CLI tests and scoped lint pass; goalieHTTPidentity regression suite23tests passes. Final integrated typecheck exits0 (`integrated-tsc-native-assembly.log`). Root source review confirms private output, source identity/hash/finality checks and no network in assembly. Public uses remain denied.

Source acquisition is a distinct pending action described in `../native-source-capture-proposal.md`. Its finite collector passed9synthetic tests, and independent review accepted its final hash after repairing hard timeout enforcement. No genuine source body has yet been acquired by this increment; those tests are not a supported full-roster production bundle.

## Superseding genuine capture receipt

The preceding pending-capture statements describe the earlier implementation-only increment. The user subsequently approved the exact development allocation and a separate bounded recovery after the first transport failure. Recovery completed at2026-10-16T03:20:06.786080Z:120successful original HTTP responses,0failures,1,568,242bytes. No database writes, publishing, evaluation or activation occurred. Original v1 failure and v2 bytes/ledgers remain private and unchanged.

The actual retained19-player roster yielded16skater observations and2goalie observations per W/volume policy. Kevin Fiala9572 remains in coverage with no positive-minute history in the finite allocated sample; absence is not zero ability or independently verified injury.15offline producer runs generated154unreleased conditional sources. All source values are finite/nonnegative;16skater counter checks and2goalie counter/minute/win checks passed. Current-club historical discovery does not prove complete history, particularly after trades.

Private evidence root: `/Users/tim/Documents/FHFH-private/forge-rso-completion-20261016-v1/`. `genuine-native-coverage-v2.json` binds `native-assembled-inputs-v2.json`, the producer execution report and original capture receipts by SHA256. Next1/10/20team-game metadata binds19/190/380roster slots; conditional means cover18/180/360slots. Admitted public forecasts remain0. The executable `../verify-genuine-previews.ts` passed against these genuine retained inputs: shared game expectations and StartChart withhold public expected/conditional totals, ratios and points under the unchanged denied-use/partial-input state. Private output `genuine-shared-contract-denial-v2.json` is negative-admission evidence, not published-feed acceptance.

Outstanding actual inputs include prior ability for Fiala, authentic goalie SO credits, current participation/start and role evidence, current provider verification and evaluated-candidate scope. Schedule metadata has no authoritative completeness witness. All publication/release gates remain pending.

## Explicit credited shutout support

Separate policy `native-goalie-appearance-shutout-rates-v1` now reproduces original, hash-bound per-game goalie-summary credits against the selected native boxscores. Every selected positive-minute appearance must have exactly one coherent credited row; missing or ambiguous evidence withholds the entire SO mean. Zero GA never implies a shutout. `preview-native-baseline.ts --goalie-shutouts true` is mutually exclusive with the other explicit modes and defaults to denied public use.

Worker verification:105outcome/baseline/admission tests and12preview tests passed; the strengthened denominator regression then passed the44baseline tests. Scoped ESLint passed all8owned files. These are synthetic checks; actual summary schema and outputs await the separately proposed two-read approval. Any subsequent summary capture requires a new actual cutoff and newly reproduced appearance receipts, preserving earlier observations rather than backdating the source.

## Prior ability reuse and PIM unit correction

The existing `skater-baseline-rates-v1` method supports prior-only ability: with projections=[] and no current appearances, it returns the previous-season per-target mean over up to82known appearances. No new fallback method is needed. Original replayable prior boxscores plus matching captured historical roster membership and the existing `baseline-history-sources-v1` receipt are mandatory. PBP/shift normalization may be null only with the exact existing missing-normalization limitations. A normalized research label alone is insufficient. PPP needs an explicit original field or matching original landings; this legacy path does not produce TOI. No prior Fiala source body has been acquired or read for this increment, and population coverage remains unverified.

Inspection found legacy PIM mislabeled as count. Producer and exact native admission now consistently require minutes. The existing contribution/admission suites passed126tests, including producer-to-admission proof of corrected legacy PIM and denial of an old count-unit payload without reinterpretation. Scoped ESLint and whitespace checks passed. This correction follows the successful integrated credited-SO typecheck; it does not claim another global typecheck. Source SHA256: `baselineGeneration.ts`76e077a8aa05afe4a2caaffa94004470aedb5a39215ee05ee8845b9ef0076622; `nativeContributionAdmission.ts`dc416a240c0f5d06ed540ab8ae50474d06c80e823ff8033610b9551bdcd8f3d0.

## Superseding genuine ability receipt, 2026-10-16 04:06 UTC

All separately approved remaining reads/captures completed. The ten hosted reads returned83rows in62.872seconds; all five pregame-evidence queries returned zero qualifying rows. Twenty authorized original Fiala boxscores were hash-verified (761896bytes), and20matching landing GETs retained222877bytes. The existing prior-only baseline generated10conditional sources, including all seven required skater scoring heads; Fiala TOI remains unsupported. Both goalie summary reads are complete, including the separately authorized Oettinger continuation; authentic credited-SO means now cover both goalies. Earlier pending statements above are historical. No successful read was repeated.

Private `genuine-shared-contract-denial-v3.json` verifies166unreleased sources:154current sources,2credited-SO sources and10Fiala prior sources. All19players have every nonzero-weight ability target under the retained league rules. Independent weighted per-appearance sums are diagnostics, not daily expectations or recommendations. Shared next1/10/20scheduled-game checks account for19/190/380bindings; public numeric forecasts remain zero under unchanged denial and incomplete input status. Sources preserve their individual materialization times; no common production revision was issued.

Fiala's verified Yahoo cache row reports IR/Injured Reserve/Lower Leg, but its merge timestamp cannot establish when those fields were observed. The new injury diagnostic preserves the cached report separately from verified current injury. Actual assembly records finite-sample absence and unknown injury freshness; it does not claim verified season-wide absence or zero ability. The injury/capture suite passed24tests; integrated TypeScript passed in `integrated-tsc-injury-so.log`. The prior preview's20-game bound passed13tests and scoped lint.

Remaining inputs: complete independently witnessed historical opportunity frames and dated eligibility/positive or negative participation labels; current provider and evaluated-candidate scope; authoritative future schedule completeness; supported current role/pStart, Fiala TOI, and approved publication/readback. Confirmed lineups are not a prerequisite to a labeled modeled estimate. Existing skater frequency machinery is reused; a separate goalie appearance integration is being verified, with relief included and pStart kept distinct. No new release, DDL, credential operation, provider refresh, deployment, activation or evaluation was performed.

## Modeled appearance integration verified locally

Added `goalie-appearance-frequency-v1` using the existing finite opportunity validator: complete independent60-day club frame, latest20eligible opportunities, explicit dated historical eligibility, positive/zero/verified nonappearance labels. Positive minutes include relief. Target eligibility is observed at cutoff, with an explicit continuation assumption; it is not a future roster guarantee. Unknown evidence withholds the probability. pStart remains separate. Current-native skater means now accept the existing skater-frequency model through an explicit policy allowlist.

The additive goalie release store is disabled without exact ID:payload-hash pins and unchanged native public-use admission. Frozen skater producer/store bytes are unchanged. Focused verification passed294tests, plus40unchanged skater receipt/store tests; scoped lint and diff checks passed. Independent source review found no blocking defect (`../consumer/goalie-participation-review.md`); root inspected the integration and `integrated-tsc-goalie-participation.log` passed. These tests establish implementation behavior only. No genuine complete eligibility/opportunity frame is known from the FORGE owner, so no probability has been manufactured or released.

## Superseding prior TOI receipt, 2026-10-16 04:32 UTC

Fiala's20already-authorized original prior boxscores all contain verified positive appearanceSeconds. The new explicit `native-prior-appearance-skater-rates-v1` reuses unchanged legacy count means and adds arithmetic prior minutes over exactly those20appearances. Every selected appearance must carry authenticated positive minutes; missing minutes cannot silently remove a denominator row. Oldv1output bytes are regression-pinned, and native replay/unit/model compatibility are explicit for the new policy. No new source acquisition, role estimate, fitting or comparative evaluation was needed.

Worker verification:143focused tests passed, scoped ESLint and diff checks passed. Actual new private `fiala-prior-toi-preview-v1/preview.json` has11heads, all10old count means identical, original source receipt hashes/clocks unchanged, fresh materialization and denied public uses. Root reran `verify-genuine-previews.ts` with this new preview replacing the old Fiala preview:167sources, all19weighted ability targets complete,19/190/380bindings with public totals correctly withheld (`genuine-shared-contract-denial-v4.json`). Full integrated typecheck for this follow-up is pending the coordinated compiler slot; the preceding passing typecheck applies to the earlier goalie checkpoint. This new increment is outside the frozen release checkpoint.

Verification housekeeping: an initial worker `npx tsx` invocation attempted an npm-cache install before cancellation; no repository manifest/lockfile or application dependency changed. Subsequent checks used already-installed tooling. Failed vite-node startups were replaced by local esbuild bundling; no source request, database operation or evaluation ran during those startups.

## Superseding materialization and callable handoff assessment, 2026-10-16

The default-dry-run `materializeNativeInputs` now reproduces the exact retained six-policy selection: 81 native inputs for 584 heads and 1,260 participation inputs, preserving the 100 null model outputs. Its private compatibility request is 63,725,090 bytes; the dry-run result is 42,535,281 bytes across 208 immutable rows, largest 8,374,913 bytes. All 961 original or explicitly derived parents are retained. The 1,341-item input manifest exactly matches the selected publication inputs. Existing published input IDs/envelopes and original cutoffs remain unchanged. The 53 focused tests, scoped lint, and independent source review passed. This is retained development-scope compatibility, not actual durable closure or current overnight readiness.

No application API route accepts or returns this packet. The producer is a standalone server SDK function: maximum 64 MiB serialized request/rows, 320 immutable rows, 1,024 declared parents, 1,500 participation inputs, 100 roster identities, and 8 MiB per stored row. Existing acquisition assembly remains at 60 games and 120 supplied original HTTP responses. Storage calls target only `player_forecast_source_observations`, with an 8-second per-call and 180-second shared execution deadline, no acquisition/retries/automatic activation. Individual stored envelopes, rather than the whole 63.7 MB file, are passed to the SDK. These are serialized-data and deadline bounds; no measured process-heap or hosted runtime acceptance is claimed. The checked-in function does not yet provide bounded standalone file loading.

The remaining executable handoff is concrete. Existing capture and preview CLIs never invoke the materializer or observed cadence coordinator. Also, the exact combined publication selection contains 108 rows (99 native plus 9 participation), measuring 35,355,173 compact UTF-8 bytes; the unchanged publisher accepts at most 33,554,432 bytes. Thus a single call to `publishObservedNativeBaselineCadence` cannot currently publish and select this whole scope. Native and participation plans fit separately, but separately calling the current coordinator would not produce one complete four-pin-set head.

The smallest remaining integration is a bounded two-stage standalone adapter, reusing existing functions: materialize exact inputs and emit verified closure IDs first; after genuinely later output issuance and existing policy/review validation, publish the native and participation batches within their existing limits, journal their combined immutable identity, then CAS one complete four-pin-set selection only after every batch has exact durable readback. Keep the head and original admission checks unchanged, reject duplicate/replaced policy ambiguities, and do not turn per-batch success into whole-slot completion. This requires a small multi-batch handoff in the cadence/publication adapter plus bounded file argument loading; it does not require a new scheduler or rate method. Previously issued retained bundles cannot be relabeled as post-closure outputs.

Fresh required acquisition scopes/cutoffs, actual later output preparation/review, reviewed head schema application, explicit timezone/morning-cadence configuration, and operational source/publication/consumer readback remain distinct activation gates. Protected current-period outcomes are not allocated by the development compatibility packet. The opted-in head outer-timeout concern is also still open: it can reject the whole planning call rather than yielding ordinary partial data; default environment-pin mode is unaffected. No application changes, network calls, database writes, model runs, or new tests were performed for this assessment.

## Superseding executable standalone handoff

The measured combined plan now fits an explicit 48 MiB standalone publication total bound, with the original 320-row, 8 MiB-per-row and admission guards retained. This supersedes the multi-batch proposal above; no multi-batch framework was added. `web/scripts/native-baseline-cadence.ts` provides `materialize` and `publish` stages. Both default to dry-run, require exact file SHA256 arguments and a new private output directory, and emit compact console receipts. The publish input is `native-cadence-command-v1` containing `cadenceInput`, exact `producerReceiptIds`, and `catalogHead` CAS expectations; `--proof` supplies the exact closed materialization stage result. It reconstructs that proof, checks the acquisition/input manifest and original output issuance ordering, and then reuses `publishObservedNativeBaselineCadence`. A previously published output issued before the new closure is rejected without changing its clocks. This runner supports one combined materialization source for the complete selected method scope.

Execution additionally requires the exact supported database origin, explicit execution intent, and exact approved publication package hash. Only execution loads existing normal server configuration in memory. Its request-local SDK fetch permits the source-observation table, exact catalog-head read, and exact CAS RPC; no provider capture, account endpoint, scheduler, migration or unrelated table is allowed. Requests are serial with no retries/redirects, durable intent before reservation, 1,320-request maximum, 8 seconds per request, 180 seconds total, 64 MiB total upload, 48 MiB per response and 256 MiB aggregate download. Every inserted envelope remains at most 8 MiB. Original headers/credentials are not retained. Actual execution has not been attempted, so these limits do not claim hosted throughput acceptance.

Materialization now reconciles same-run durable reports/closures before writes. A report-only interruption resumes its original closure clock; a committed but unacknowledged closure becomes complete only after exact parent reproduction/readback. An unavailable or conflicting run returns unknown. Distinct runs reuse content-stable originals/parent groups, and explicit existing native rows retain their published IDs and immutable envelopes under the hosted semantic uniqueness constraint. Tests cover both interruption cases and already-closed reruns, the real SDK through injected transport, exact scopes, stale outputs, durable-intent deadline advancement and the publication capacity boundary.

Run from `web/` with installed tooling (no dependency acquisition):

```sh
NODE_PATH="$PWD" NODE_OPTIONS=--max-old-space-size=8192 ./node_modules/.bin/ts-node --transpile-only --compiler-options '{"module":"CommonJS","moduleResolution":"node"}' scripts/native-baseline-cadence.ts materialize --input PRIVATE_REQUEST --input-sha256 EXACT_SHA256 --out NEW_PRIVATE_DIRECTORY
```

For `publish`, use `--input PRIVATE_CADENCE_COMMAND --input-sha256 EXACT_SHA256 --proof PRIVATE_CLOSED_STAGE --proof-sha256 EXACT_SHA256 --out NEW_PRIVATE_DIRECTORY`. These commands stay dry-run without the separate execution arguments. The actual retained 63,725,090-byte request ran through the standalone materialize CLI successfully with zero network requests and zero insert attempts; private `native-cadence-cli-compatibility-v1/receipt.json` records that result. The earlier raw `ts-node` invocation failed alias resolution before work; supplying the repository's `NODE_PATH` resolved it without installations. No new acquisition, current overnight closure, public environment activation or hosted schema application is claimed.

## Actual materialization and read-only recovery preparation

The first hosted materialization acknowledged all 127 new immutable rows, including report `c751c63d-31b6-4b94-a77b-efc4d3d829c4` and closure `0018bcbf-2200-444d-a242-fd78cde606b2`, but returned unknown during reconstruction. Its 879 successful requests ended after approximately 120 seconds; this was not a deadline failure. PostgREST rendered a typed outer timestamp with an equivalent offset spelling while the authenticated original payload retained `Z`. Reconstruction now consistently uses the original payload `capturedAt` string after exact-instant validation, including initial manifest construction; existing published envelopes remain unchanged. The targeted alternate-format and same-run regressions passed, scoped lint passed, and the lead's integrated compiler passed. The first unknown receipt remains unchanged.

Private `native-cadence-readonly-reconciliation-v1/manifest.json` pins an independently reviewed GET-only recovery script (SHA256 `dfed9eb9565a1f7579238e5fcb4742641c68e7fbc88a36d665af45325a368412`). Its actual plan-only run reproduced the existing report/closure hashes and original closure clock `2026-10-16T08:48:28.198Z`, with zero credential reads or network calls. Explicit execution allows at most 209 source-observation GETs through the existing bounded transport; every other method is denied before transport reservation or network. Success requires exact durable reconstruction, zero writes and the original closure identity/clock. Recovery execution remains the lead's next action; no recovery network call was made by this worker.

No additional publication adapter is needed. After successful recovery, prepare genuinely later-issued same-method outputs from the exact retained inputs and original cutoffs, reproduce existing native and participation builders, and create their exact immutable publication plan through the existing policy/review preparation. Original expiry bounds and unsupported outputs remain intact. New candidate envelopes require their actual independent review and hash-bound release preparation; an older reviewed plan cannot be relabeled as post-closure output. The standalone `publish` stage already reconstructs the closed proof and exact required acquisition scope before the journaled publisher and coherent four-pin-set CAS. Its prepared head table/RPC SQL still requires separate hosted schema/security review and application before selection can execute. No source capture, new model method, or scheduler framework is required for this retained development-scope handoff. This does not establish current overnight acquisition or natural 08:00 New York execution; protected current-period data and operational acceptance remain separate gates. The previously reported opted-in outer head timeout was separately fixed by the lead: it clears unavailable catalog pins and preserves bounded ordinary planning inputs. Five deadline regressions, scoped lint, independent review and integrated TypeScript passed; see read-receipt.md. Actual hosted head activation remains unverified.

## Cadence dependency confirmed after actual recovery

The lead's GET-only recovery succeeded: 209 GETs, zero writes/uploads, 45,303,697 response bytes, unchanged original closure/report and 1,341-item manifest. The independent terminal audit confirmed all 208 original stage rows and clocks. No replacement outputs were generated afterward: zero native or participation builder calls, no new plan, no publication or selection. An empty private `native-postclosure-publication-preparation-v1` directory was created before the lead stopped duplicate generation; it contains no outputs.

The minimal next cadence input must explicitly declare the genuine required acquisition scope/cutoff, New York date, required source keys and canonical games for that date. Compute its closure binding with `nativeCadenceClosureScope` before materialization. The recovered compatibility closure instead contains scope hash `25ca87f96d0f09f36970f2962c4b157716fe7ffdf2ee73fedd0ddf28f60719d6`, deliberately derived from the development compatibility purpose; its original acquisition hash `93a595e3d99a17fb7ccb48ad947bd46fb9d5cb490c8bf4c837db45663adaa732` and cutoff `2026-10-16T07:26:22.705Z` must not be relabeled as current overnight acquisition. `validateCadenceCommand` and the durable observer both require the exact cadence binding, so a command against this closure would correctly fail before publication.

Today's morning slot is due at `2026-10-16T12:00:00.000Z` (08:00 America/New_York). Natural publication requires actual later issuance at or after that due time and verified closure, still within original pregame/source validity. No future or backdated clock is permissible. Genuine required input acquisition/closure, the due clock, reviewed newly built outputs and hosted selector-schema readiness are separate remaining dependencies; no additional slot, bypass or model method is needed. The existing stored 584 native heads and 1,160 participation sources remain the independently exercised consumer evidence. This dependency inspection does not close natural cadence or current production readiness.


## Actual read-only reconciliation terminal receipt

Root's reviewed recovery completed successfully:209 serial GET200, zero writes/uploads,45,303,697bytes in30.266seconds. Original206input rows/report/closure,1341-item manifest and08:48:28.198Z closure clock reproduce exactly. Independent actual-ledger/stage audit SHA cf710ec3a9289222865848e43917be007cecc72aa74857b06387519db761b164; private receipt cf8975354dcd1ed0866c000525b232abbe30b00a1a8e7890daef081df167d19e. First unknown receipt is preserved. This closes retained-development materialization mechanics only; it does not replace the correctly scoped current acquisition/cadence and authenticated release requirements above. No duplicate forecast generation, head DDL/CAS, deployment or activation followed.

## Retained daily acquisition preflight, October 16

The lead's existing daily contract was reused unchanged (SHA256 `72b89ee4b5ad85c492474a002b7551383107cdd9b8c067ba0faa601c7f2c7dfb`): 69 declared players, 29 clubs, 1,380 next-20 scheduled slots without missing slots, and the two canonical October 16 New York games. The earlier missing-roster finding is corrected by retained original CAR and NSH receipts, captured at `06:29:21.757519Z` and `06:29:22.091024Z`, respectively. Their hashes begin `e328d8ce` and `069ed618`. All 29 original season-roster bodies were hash-verified and passed the existing roster observation helper; all 69 declared NHL IDs are listed. This establishes captured current membership, not historical eligibility or guaranteed future appearance.

Private `daily-acquisition-contract-20261016-v1/retained-preflight.json` (SHA256 `d146e8c27548b72b28ac9c38b5ba96b3f5ac81d14e882e5d44f0bb8f99f6f89e`) supersedes the missing-source findings without modifying the original plan/verification. It pins four already captured Yahoo originals, the exact 69 verified mappings, all roster receipts, and an executable default-dry-run materialization request. The 63,749,217-byte request has SHA256 `44fd7762582253f246cb266131ad2629650f02744839bcb5eac7f46fe9c9a6cb`, 963 required parents and source key `native-daily-selected-inputs`. The native observations and all 1,260 participation inputs remain byte-equivalent in canonical content; existing unsupported/null outputs are not filled. Only two missing declared roster parents, a new run/source identity, and the correctly computed cadence binding were added. Its cutoff remains the actual latest selected native input availability `2026-10-16T07:26:22.705Z`; original raw roster captures are earlier and retain their separate clocks.

The new request's exact required acquisition binding and two canonical daily games produce cadence scope hash `27a0a92025f59aa5da9f3595a09ab36707e3eb81718ad9eb2ab92cb69f6a21c1`. This is a newly prepared request, not an alteration or renaming of the recovered compatibility closure. No producer call, materialization execution, forecast generation, credential read or network request was performed for this preflight. Its runnable dry-run command is retained in the private packet. Existing standalone bounds remain 64 MiB request/upload, 1,024 parents, 320 immutable rows, 8 MiB per canonical row, serial requests, 8 seconds per request, 180 seconds total, no retry/redirect, 48 MiB response and 256 MiB aggregate download. These are not public API body limits.

No new source GET is mandatory for this exact retained snapshot and approved frozen-method scope. The original Yahoo capture remains a captured 19-player roster and partial 50-player candidate universe, not live account state or complete available-player inventory. Existing known conflict observations stay true/null; absent injury fields do not become healthy. Missing PP role, confirmed starter status, historical labels and model support remain explicit unknowns; the approved whole-game mean and finite-window appearance/start methods accept those missing outputs. They do not require new protected outcomes or whole-season history. A live membership/ownership change, claim requiring newer manager allowance, stale evidence, or expiry is an explicit new leaf/action requiring the corresponding supported observation; none is invented here merely to close an acquisition checklist.

Next sequence is exact-scope review, bounded default dry-run, durable journal/preimage checks, scoped materialization and exact closure verification, actual due-time output preparation/review, guarded publication/selection, then genuine shared-consumer readback. Morning due remains 12:00Z; T−15 slots are October 17 at 00:45Z and 01:45Z. Existing forecast/catalog expiries must be checked at each slot and cannot be extended or relabeled. This scope can honestly close acquisition of its declared retained inputs when exercised; it cannot assert every upstream job, refreshed training history, natural overnight execution, or production activation.
