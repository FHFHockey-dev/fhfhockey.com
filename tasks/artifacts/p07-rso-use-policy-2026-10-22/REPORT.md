# P07 implementation checkpoint — held

**17 source/test files are pinned; 541 focused tests, application TypeScript, scoped lint and diff checks pass. Do not integrate this draft.** One separately preserved C08 oracle fails: an editable manifest can claim that an unreviewed native revision is an approved bridge revision. Independent acceptance has not occurred.

## Implemented locally

- Added a trusted, empty production target/use review catalog and exact scope matcher. Reviews bind component, model mode, code, configuration/artifact, target, horizon, conditioning, participation lineage and input cutoff interval; uses are independent. Revoked, missing, expired, future or ambiguous reviews deny use.
- Applied RSO permission checks after actual source admission and bridge selection. A present denied native row remains present, so denial cannot turn into empty admission and activate the bridge.
- Explicitly separated RSO callers (public data route and Yahoo adapter) from the shared Start Chart reader. Existing bridge construction and qualified native rate/participation admission remain unchanged.
- Propagated target permissions and policy identity through raw and retained contribution resolution, planner, transport and saved schema. Review expiry uses the current clock rather than the old saved valuation clock. The data route uses private/no-store for responses carrying policy identity.
- Preserved existing planner assertions with explicitly fictional reviewed fixture scopes. Added capacity/lock/realized-result denial cases, independent target/use and zero-versus-null cases, once-only participation weighting, revocation, saved-claim rejection and native-rate controls.

The original goalie15 and skaterHITS3 cases failed before the adapter change and now pass on the actual imported loader. No production review entries or historical requalification were fabricated. The actual producer contract currently lacks the reviewed configuration/artifact identity needed for a future positive detailed review; bindings intentionally retain null instead of substituting captured-read hashes.

## Concrete hold

`restrictRsoForecast` currently preserves the legitimate bridge via `forecastManifest.rsoUsePolicy.bridgeRevisionIds`. That list is produced correctly by the server-selected bridge branch, but JSON/save/worker transport makes it editable. A client can omit target bindings and name a native revision in that list. The function then returns its permissive flags. The artifact-only [oracle](bridge-claim-oracle.test.ts) reproduces this without database, browser or network access; [failure](evidence/schema-and-bridge-oracle.log).

**Pending action:** replace that serialized bridge exception with a trusted source-selection boundary that survives the actual saved/worker path, without disabling the approved bridge. A source/model label, revision prefix, public checksum, `released` flag or schema validation cannot establish this authority. Either rebind retained inputs to a current trusted server-selected read at the consumption boundary or use a verifiable server-issued receipt. The choice must account for offline saved work, worker transfer, revocation and existing response budgets. No new signing secret, storage, migration or production configuration was added. Whether an existing boundary can support this without new infrastructure remains unresolved; no schema change is asserted as necessary.

This is an implementation/design gap, not an automatic approval denial or a capacity failure. The next owner should inspect the current read/reload/worker ingress before extending the lease. Parent owns that coordination and independent review. P05/P02 files were not edited. Do not treat this packet as locally accepted or release-ready.

## Verification actually run

Node22.11.0/npm10.9.0; isolated extraction of the preserved combined archive, existing dependencies reused, environment cleared, synthetic settings, network denied.

| Check | Result |
|---|---|
| Original actual adapter regression before patch | 2failed, as expected; `evidence/adapter-before.log` |
| Final eight focused suites | **541passed**; `evidence/focused-final.log` |
| Saved bridge impersonation oracle | **1failed**; `evidence/schema-and-bridge-oracle.log` |
| Application TypeScript | Passed; `evidence/typecheck-final.log` |
| Scoped ESLint | Passed, no diagnostics; `evidence/lint.log` |
| Scoped diff whitespace | Passed |

The initial six-suite run was356passed/1failed because an API mock expected the old options; corrected. The initial planner run was66passed/77failed because its synthetic forecasts lacked the new review scope. Adding explicit fictional scopes preserved all existing algorithm assertions. The initial TypeScript run found four errors in new fixtures; adding the required legacy-source reason and using the existing contribution-context shape resolved them. All initial logs remain available. Counts above are final unique cases, not summed reruns. The unchanged770-case sprint suite was not rerun.

Application TypeScript excludes the four preserved external reviewer fixtures already excluded by the combined packet; it is not a claim about arbitrary artifact files. The separately corrected NST fixture is referenced in the original combined packet's follow-up document; its historical archive was not rewritten.

## Acceptance limits and inventory

- C01/C03: actual loader denial and no bridge escalation tested; callers' explicit intent tested. No live Yahoo request.
- C02: legitimate server-selected bridge, source/off controls and wire behavior retained; saved authority is the C08 hold above.
- C04: same admitted revision remains unchanged in the explicit shared/Start Chart loader path. No new browser/rank-rendering execution.
- C05/C06/C07: synthetic exact review matcher and actual resolver controls pass. Positive review through the production adapter remains held on missing producer identity/review evidence. No accuracy claim.
- C08: native retained revocation/expiry/flags and JSON schema cases pass; bridge impersonation fails. No worker/browser execution.
- C09: policy identity changes manifest identity and responses are no-store. No new policy queries; no hosted/cache deployment experiment.
- C10: legal capacity, manager locks and realized inputs survive denial; whole-plan quality is unavailable. UI rendering is unverified.
- Q01–Q04 predictive qualification and operational rollout remain separate, open gates.

[CANDIDATE.json](CANDIDATE.json) lists exact17changed-file hashes, checks and the pinned overlay. [LEASE.md](LEASE.md) is the complete19-file reservation; `resolvedPlanningForecast.ts` and `refreshForecastInputs.test.ts` are reserved but unchanged. `rosterPlanning.ts` is explicitly included; its accepted A5 actual-points logic was preserved. [packet.patch](packet.patch) is relative to the exact pre-edit [BASELINE.json](BASELINE.json)/`baseline/`, not to a moving Git HEAD. `after/` and `source-overlay.tar.gz` preserve the fixed draft for independent architecture review. [VERIFY.md](VERIFY.md) provides reproduction steps.

No production/NST/provider/database/model request, credential access, migration, installation, dependency/lockfile edit, commit, push, merge, build or deployment was performed. Unrelated concurrent files and accepted archives remain outside this packet.
