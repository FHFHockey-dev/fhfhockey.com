# C7 ticket 33: review of `4f9fb95c3`, `d9614eeaf`, `46bc91caf`

**Reviewer:** Claude C7 lane session (not the author). Read-only: no edits, no Git mutations, no `GIT_DIR`, no live reads.
- I reviewed the **commits** (`git archive` snapshots at `/private/tmp/c7-r33`), not the working tree, because RSO-PRIVACY is editing it.
- Tests ran under the outbound network-deny preload.
- Evidence is in `r33-evidence/`.

| Commit | Verdict |
| --- | --- |
| `4f9fb95c3` offline Yahoo daily acceptance suite (34 tests) | **Accept** (notes E1, E2) |
| `d9614eeaf` Y1: `rules:false` names the unverified rule facts | **Accept** (note Y-a) |
| `46bc91caf` FORGE provenance: model identity hashes, review evidence refs | **Accept**, safe for production writers (notes F1–F3) |

## Tests

| Run | Result |
| --- | --- |
| **Commit `46bc91caf`** (it contains all three): the Yahoo suite, `rosterPlanning.test.ts`, `rsoUsePolicy.test.ts`, `rosterScheduleData/planning.test.ts`, plus the 4 fixture-touched files | **608/608** |
| **Y1 parent** (`4f9fb95c3` source, with `d9614eeaf` tests) | **110/112.** The 2 changed tests fail: "names the unverified rule facts whenever capabilities.rules is false" and "reads nested roster collections … (empty: false)". |
| **Provenance parent** (`d9614eeaf` source, with `46bc91caf` tests and fixtures) | **376/382**, and `rosterScheduleData/planning.test.ts` **fails to load** (`forgeModelIdentity is not a function`). The 6 failures are "counts a review only with both evidence references" (empty, blank and missing, for each ref). |
| **Consumer-only parent** (parent `rosterScheduleData/planning.ts`; producer and tests from the commit) | **113/114.** "binds a revision's declared hashes" fails, because the parent always binds `null`. The 5 "leaves both hashes unknown" cases pass on the parent too, as expected: they are guard tests, and the parent was already always unknown. |
| **`4f9fb95c3`** (test-only, new file) | It can't fail on its parent, so I checked it with mutations and controls instead (below). |
| **My Yahoo controls** (`dailyAcceptance.yahoo.c7.test.ts`, the suite plus 6 cases) | **40/40** |
| **Mutation:** both freshness guards removed from `planningConfirmations.ts` | **33/34.** "withholds stale evidence" fails. With only the 120 s guard removed, the result is 34/34, because the `expires <= completed` guard still rejects the stale read. The guards are redundant, so this isn't a test gap. |

## `4f9fb95c3`: does the suite assert the contract, or echo the implementation?

**It asserts the contract.** The real loaders (`loadYahooPlanningSnapshot`, `loadYahooPlanningConfirmations`) run against a private-read mock world, and the expected values come from the fixtures, not from the code under test.

**(e) Goalie evidence:**
- **Positive case:** a fresh `is_starting` mark sets start chances to 1/0. Saves are checked against an independent oracle (`26 × chance`), the per-start `conditionalStats` are unchanged, the interim label is kept, `expiresAt` is exactly observed + 120 s, and the input isn't mutated.
- **Withheld cases** assert output forecasts `toEqual` the untouched input: wrong game, started game, unknown mark, two contradictory starters, contradicting a confirmed starter, and **a saved label only** (a stored `startingStatus` with no fresh mark).
- **Stale, expired cache age and wrong principal** must reject the whole read, so a stale mark can't be applied.

| # | Severity | Note |
| --- | --- | --- |
| **E1** | Info | **The three "rejects" cases use a bare `.rejects.toThrow()`,** so any throw would pass. My control pins the codes: stale and expired give `yahoo_confirmations_unavailable`, and wrong principal gives `team_unavailable` (the owner-scoped `external_teams` lookup). All three pass, so they reject for the right reason today. Pinning `{ code }` in the suite would keep it that way. |
| **E2** | Info | **"Wrong game" changes the planner's game id**, which tests a forecast-to-game mismatch. It doesn't test a Yahoo mark that belongs to a different game. My controls cover that: a mark **dated another day**, a **week-coverage** mark, and a mark whose **Yahoo team differs from the planner team** (a traded goalie). All three are withheld (`yahooStartingStatus` requires date coverage for today, and the loader requires `editorial_team_abbr` to match). Worth adding to the suite. |

## `d9614eeaf` Y1: are the named facts complete against what the planner treats as unknown?

**Yes.** Here is each unknown field the Yahoo import produces in `LeagueRules`, and where it's named:

| Planner input left unknown | Named by |
| --- | --- |
| `acquisitionTiming: "unknown"` (always) | New: "when an add takes effect (same-day or next-day)" |
| `waivers` absent (mode and FAAB) | New: "waiver mode and FAAB budget" |
| `periods` present, with the reset instant assumed at league-local midnight | New: "the exact weekly add reset time …" (only when periods exist) |
| `periods` empty, `acquisitionCost: null` | Existing: "Verify remaining acquisitions, reset periods and counting rules …" |
| `goalieMinimum.required === null` | New: "whether the league has a goalie minimum" |
| `required > 0`: `counts` and `penalty` are `"unknown"` | New: "how the goalie minimum counts … and its penalty" |
| `required > 0` and `credited === null` | Existing: "Verify … goalie minimum progress …" |
| Missing time zone; weekly lineup locks | Existing `unsupported` lines |

- **No side effects on health gates:** the new line is always present, so `evidence.roster.limitations` is never empty for a Yahoo league. But roster `completeness` is computed separately (fresh, mapped, non-empty), so the HIR alert, which is gated on roster `complete`, is unaffected.
- **Y-a (info):**
  - Yahoo's **season** add cap (`max_adds`) is neither parsed nor named. The planner doesn't model a season limit at all, so it isn't an unknown the planner relies on. A one-line mention would close it if the beta wants exhaustiveness.
  - The test uses an exact `toEqual` on the copy, so copy edits will need test updates.

## `46bc91caf` FORGE provenance (TJ D3/D5)

| Check | Evidence | Result |
| --- | --- | --- |
| **Hash canonicalisation is deterministic** | Producer `projectionInputHash` (`inputCapture.ts:28-38`) and consumer `playerForecastSourcePayloadHash` (`sourceSnapshot.ts:30-46`) use the **same algorithm**: recursive key sort with `localeCompare`, arrays kept in order, `JSON.stringify`, sha256. The test asserts the env hash is independent of key order and equals the consumer function's result, that `artifactHash` changes with `codeVersion`, and that `configurationHash` changes with any env value. `projectionModelEnvironment()` is now read **once** and shared by the snapshot and the identity, so the two can't drift within a run. | Holds (F1) |
| **Old revisions stay unknown** | `revisionModelIdentity` (`rosterScheduleData/planning.ts:48-57`) is all or nothing. It returns `null`/`null` unless all of these hold: version `forge-model-identity-v1`, artifact `no_fitted_artifact`, both hashes are 64-hex, `payload.codeVersion` is a string, and `artifactHash` recomputes from `{ codeVersion, configurationHash }`. Tested: no identity, another code version's artifact, another version, a fitted-artifact claim, and a malformed hash. | Holds |
| **Nothing grants an allowed use** | `RSO_USE_POLICY.reviews` is still `[]` (asserted). A binding with valid hashes resolves to `deniedRsoUses()` with `reviewId: null` (new test). Reviews now also need **non-blank** `prospectiveEvidenceRef` and `ownerApprovalRef` (`rsoUsePolicy.ts:71`), so a review missing either is ignored. That fails 6/6 on the parent. Binding hashes are only an input to matching; the deny-by-default path is unchanged. | Holds |
| **The four out-of-lease test files got fixture fields only** | The diffs of `planningContributions.test.ts`, `candidatePlanMetrics.test.ts`, `executionAdapter.test.ts` and `rosterScheduleOptimizer/planning.test.ts` each add exactly `prospectiveEvidenceRef` and `ownerApprovalRef` to one existing fictional review literal. No assertion changed. They are needed: without the refs, those positive-review fixtures would now be denied. | Holds |
| **Safe for production writers once released** | `modelIdentity` goes into `snapshot.inputProvenance`. The live publisher (`20260916012353_starter_board_game_revisions.sql:59`) already copies `snapshot->'inputProvenance'` whole into the jsonb `payload`, so there is **no new column and no migration**. The public reader returns `payload` unchanged. Revision admission (`consumerRevisionAdmission.ts:56-90`) reads only `capturedReads`, `issuedContexts` and the external-fantasy contract, with no key whitelist that would reject an extra field. The local-execution replay guard compares payloads from the **same** snapshot, so they stay equal. New runs get new snapshot hashes (expected, and forward only). Old readers ignore the extra key. | Safe |

| # | Severity | Note |
| --- | --- | --- |
| **F1** | Info (hardening) | **Both hash functions sort keys with `localeCompare`,** which depends on the locale. The keys are fixed ASCII names, and producer and consumer share the algorithm, so I see no practical risk. A code-unit comparison would make the hash independent of the host's locale. This would change existing hashes, so it's not for this commit. |
| **F2** | Info | **The binding's `codeVersion` comes from `forecast.modelVersion`,** while `artifactHash` is verified against `payload.codeVersion`. If these ever differed, a binding would pair one code version with another's artifact hash. That can't grant anything (there are no reviews, and a review must match every field), but it's worth asserting equality when the first real review is written. Not traced further. |
| **F3** | Info | **The `ForgeInputSnapshot.inputProvenance` type doesn't declare `modelIdentity`** (it passes TypeScript through the spread). The replay or reconstruction snapshot (`run-forge-projections.ts:607`) has no identity, so anything built from it stays unknown, which is conservative. `configurationHash` covers the 8 listed env keys, and `modelMode` is bound separately. Whether those keys fully define the model is a FORGE-QUAL scope question, not a defect here. |
