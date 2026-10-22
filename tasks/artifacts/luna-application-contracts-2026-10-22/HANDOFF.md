# Luna local application contracts — independent-review packet

**Implemented locally, owner-tested, awaiting independent review.** Five new application/test/fixture files; no existing application file modified. Canonical `octoberBranch`, starting HEAD `d3f057c6c849d5d5474bc912a6f461f617c65b15`. Concurrent work is preserved. No staging, commit, push, deployment, credentials, external service, paid call, live alias/data write, intake wiring, replay or swap occurred.

## Exact diff

| Added path | Behavior |
| --- | --- |
| `web/lib/sources/playerIdentitySnapshotEvidence.ts` | Pure bounded schema-validated saved-evidence projection into the existing snapshot contract. |
| `web/lib/sources/playerIdentitySnapshotEvidence.test.ts` | 16 cases for temporal modes, unknown evidence, canonical namespaces, scopes/conflicts, bounds and immutable provenance. |
| `web/lib/sources/tweetIdentityReplacementReview.ts` | Separate literal-default-off two-subject review packet; explicit clause validation, no extractor or effects. |
| `web/lib/sources/tweetIdentityReplacementReview.test.ts` | 14 cases using a retained S06 development source with scripted replies and synthetic negative controls. |
| `web/lib/sources/fixtures/tweetIdentitySavedEvidence.json` | Public-player fields from the previously approved saved export and owner confirmation; canonical `knownAt` added from the export's actual observation timestamp. No private league/account fields or credentials. |

`application.patch` contains only these five additions. `CANDIDATE.json` and `SHA256SUMS` pin exact bytes, base commit, verification and preservation. The patch depends on the existing local identity snapshot/proposal modules; it is not a standalone release candidate. The prior artifact prototypes, sealed trial inputs and results remain unchanged.

## Saved-evidence adapter

`projectSavedPlayerIdentityEvidence(input, options)` accepts a strict bounded import: at most 20 players, 100 related alias/membership records combined, and 256,000 serialized UTF-8 bytes. Invalid schemas, clocks, duplicate/cross-namespace/foreign links, unsupported fields or overflow fail closed. No rows are silently paginated, truncated or guessed. The existing snapshot validator is reused, including its per-player bounds. Provenance declarations are retained supplied evidence; this function does not independently authenticate them.

Evaluation mode is mandatory and strict:

- `causal_as_of`: the knowledge cutoff is the original source publication time; no later `reviewedAt` field is accepted.
- `retrospective`: the caller supplies a review cutoff at/after source publication and at/before the snapshot bound.

Both modes are explicit in the returned immutable packet/hash and snapshot provenance. Canonical rows, aliases and memberships each carry `knownAt`; effective intervals are separate and never synthesized from database creation or confirmation timestamps. Missing/late canonical knowledge withholds that canonical row and its associated records. Missing effective alias/membership intervals stay in the sidecar/audit but do not enter dated eligibility. Scope, conflicts, omitted records and truncation remain visible. Current positions remain directory attributes, not historical role proof.

This closes a limitation found while porting the artifact prototype: merely labeling a filter causal is insufficient if October-observed canonical records are still offered as September-known data. The safe saved export proves observation on October 20, not earlier availability. Accordingly, the real **causal-as-of fixture contains zero eligible canonical rows**, with explicit `known_after_cutoff` reasons; the **retrospective fixture contains both canonical players**. This means earlier canonical availability is unavailable in these saved records, not that those players were unknown in reality. Synthetic tests independently exercise pre-source known canonical data and genuinely dated evidence. No retrospective result is relabeled causal.

RNH remains owner-confirmed and globally verified in the retained evidence. Its historical valid interval remains unavailable, so strict historical snapshots withhold that alias even retrospectively. **The existing live nickname mapping is untouched and requires no repeat confirmation or write.** The adapter has no caller that could alter or disable its present use. Roster database-record intervals are preserved as metadata and do not become source-time membership proof.

## Two-subject review packet

`prepareTweetIdentityReplacementReview` returns disabled before reading inputs unless `enabled === true`. It requires trusted locally prepared request context, reuses the existing identity response validator, schema-checks explicit caller annotations, and keeps distinct occurrence/ID/source/directory/span bindings. It accepts only the previously specified literal `X will take Y’s spot` grammar, with optional explicit first/second power-play unit. This is validation of supplied annotations, not automatic extraction expansion.

The output preserves both identities, full original text/clocks/provenance, exact evidence and literal quote. The relation is `replacement_wording_for_review`; governing context and claim certainty remain `unassessed`. This prevents a clipped conditional/practice context from being presented as a qualified future event. Unit PP1/PP2 comes only from exact unit wording; absent unit stays null. Every result remains held for unsupported native multi-player semantics, governing context, prior-slot, game applicability and independent source-time membership. It creates no remove/add effects or native Decisions statement.

Publication, alias writing, status changes, replacement execution and provider dispatch are all false. There is no transport, environment activation, storage, callback, route or worker caller. A bounded import scan found no non-test caller of either new module. Returned successful packets and their source/subjects are recursively frozen; inputs are not mutated. The reference adapter and existing single-player/temporal gates are unchanged.

The S06 application test constructs a **new local request against the new retrospective fixture**, then supplies a scripted identity reply. It does not reuse or rebind the historical paid response, consume owner labels as hints, dispatch a provider request or claim new model evidence. Negative controls include reversed subjects, missing/invalid IDs, duplicate occurrences, tampered source/directory/spans, missing/invented units, Unicode, hostile trailing text, extra authority and consistently rebound conditional wording.

## Verification actually run

Node 22.11.0/npm 10.9.0 with existing dependencies:

- **30/30 tests across two files passed**: 16 projection + 14 review-packet tests. These are current application tests; prior 30 artifact tests and 252 readiness tests are not added to this count.
- **Scoped TypeScript exit 0**, covering both new modules/tests and their imported type closure using `tsconfig.json` here.
- **Targeted ESLint exit 0**, four TypeScript files, no diagnostics.
- Final logs contain no network-denial diagnostics. Execution used an empty inherited environment, inert npm config, disabled npm background checks, `envDir:false` and the existing fetch/HTTP/TCP/TLS denial preload.
- Patch parsed successfully; source whitespace checked. All **40 reviewed trial pins** still match. Reference SHA256 remains `055bc80ccf9874de8a976da6106bc34af15e424d6b905d39fccf57ecfd2b92a1`.

The first test pass had 28 passing/two failing controls because the scripted reply reused frozen request spans. Cloning the scripted reply before mutation fixed the test fixture; final source behavior did not need relaxation. `tests-first-run.log` preserves that evidence. A model-capacity interruption was resumed after checking the two partial modules; no duplicate implementation was created.

The final commands are captured in `VERIFY.sh` (run with `sh tasks/artifacts/luna-application-contracts-2026-10-22/VERIFY.sh` from the repository root). Its three command bodies/environment match those executed; the script itself was syntax-checked rather than rerunning already passing checks. It rewrites only this packet's test logs/results when deliberately rerun. `tests.log`, `test-results.json`, `tsc.log` and `lint.log` are the current receipts.

No full application compiler, full suite, build, browser, database or real-model evaluation was run. There are no production callers, existing source changes or dependency changes requiring broader execution for this isolated slice. Independent review is pending; owner checks do not substitute for it.

## Review focus and remaining limits

Check strict import bounds, canonical/alias knowledge timing versus effective validity, namespace/link validation, explicit mode/hash binding, unknown historical metadata, source/subject/clause binding, immutable outputs and literal default-off behavior. Verify the five source hashes and all retained pins before relying on test receipts.

No blocker remains for the authorized local slice. Missing historical membership/alias-validity evidence remains unknown. Automatic extraction/shared-heading scope, native two-subject operations and deterministic native statements, prior-slot/game qualification, representative adjudicated evaluation and live rollout remain separate work. No accuracy, fewer-email or automatic-swap claim follows from this packet.
