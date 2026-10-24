# Luna R1 independent correction review

**Qualified local acceptance: R1 is closed for the exact corrected bytes below. No new finding was identified in this two-file correction.** This accepts the offline grammatical-slot repair, not production integration, paid/model evaluation or release.

The only runtime change is `web/lib/sources/tweetIdentityReplacementReview.ts:27`: the outgoing occurrence must start exactly at `incoming.evidence.end + " will take ".length`. That strictly strengthens the former ordering check. Exact source-span validation, distinct IDs, whole-clause equality, accepted apostrophe variants, unit validation, immutable source retention, literal default-off behavior and every effect hold remain unchanged. The correction does not broaden the grammar.

## Original defect and valid controls

Both original independent counterexamples now return `held`:

- `Milo North will take spot's spot`, annotated with outgoing noun `spot` at `[28,32)` instead of the possessive subject at `[21,25)`.
- `Milo North will take will's spot`, annotated with predicate `will` at `[11,15)` instead of the possessive subject at `[21,25)`.

Both corresponding correct-slot controls at `[21,25)` return `reviewable_held`, preserving the exact outgoing evidence and all five false authority flags. The original reviewer setup and two regression bodies are present verbatim in the nearest application test. The complete original 11-control review file also remained byte-identical and was run independently. Original pre-fix failures remain in the prior review receipt; they were not rewritten or counted as current failures.

## Checks actually run

- Reconstructed the prior pinned review archive in a new isolated source copy, then applied the exact `correction.patch`. All **17** source/configuration files matched the expected candidate and canonical tree before and after verification.
- **34 owner tests passed:** 16 temporal projection + 18 replacement. **All 11 original reviewer controls passed.** Total **45 passing executions**, with two R1 regressions intentionally executed in both suites. This count is not a claim of 45 independent new cases.
- Scoped TypeScript **exit 0** and two-file ESLint **exit 0**, no diagnostics.
- Of the prior **55** checked pins, **53 are unchanged** and only the two intended helper/test pins changed. All **40 retained trial pins** remain intact. The original review-test SHA-256 is `2eb47699a268abdaffe8043e8d4aad540fa6600f8565f9abb4981939332b53cb`.
- All checks used Node **22.11.0**, npm **10.9.0**, Vitest **3.2.7**, existing dependencies, an empty inherited environment, inert npm configuration, `envDir:false`, one worker, and the previously pinned fetch/HTTP/TCP/TLS denial preload. No network-denial diagnostic appeared.

The owner packet began at `fd58ba2452c0175b201e50285df156cb7f91b4f4`, then recorded `87ab20cbd6059d2e2116843f303ed00b4902c2ac`. This independent pass started and ended on `octoberBranch` at **`a6e9f8b61903ed4bb2bba6b21bf8597f51ac85d0`**. Concurrent commits are therefore explicit, not mistaken for the reviewed snapshot. The two corrected files remain working-tree modifications; hashes identify the accepted bytes.

| File | Accepted SHA-256 |
| --- | --- |
| `web/lib/sources/tweetIdentityReplacementReview.ts` | `2be0e11a013683992ab449c6806311bd9c7bece0dce2be3a0b79e1399ee6516a` |
| `web/lib/sources/tweetIdentityReplacementReview.test.ts` | `3abe7656f8c7fae3f8474749cd9f4297ea428c8ea57efe8b83fe031028db8451` |

Correction patch SHA-256: `ed584d5e242458530c23e4e1eeb835bcfd09a37b9835d7b857d857115c18b5f6`.

The retained independent `reviewed-source.tar.gz` SHA-256 is `77d9b5eae0df0ba0a3d6299bd83306dcdc3148cf862810aa2249ad453fe5fed7`. It contains the reviewed source/configuration closure and original review controls, without dependencies, caches, environment files or credentials. Start/end integrity receipts record all compared hashes and the scoped Git status.

## Remaining qualification limits

Earlier-source snapshot reuse remains an **open integration gate**. A projection created for a later causal cutoff must not supply an earlier source request without regenerating it or enforcing the same source-publication instant and retaining mode lineage. The unchanged characterization still passes; R1 does not resolve that limitation.

Default-off behavior and all publication, alias-write, status-change, replacement-execution and provider-dispatch flags remain false. The retained RNH and unknown-history behavior, source context, heading/membership rejection and temporal controls passed unchanged. No paid model or real-world accuracy claim follows from these synthetic checks. Historical membership/alias validity, native multi-subject semantics, prior-slot/game applicability and live rollout gates remain separate.

No full suite/compiler, browser, build, database, model/service call or production request was run. No application or owner-packet files were edited by this reviewer; no dependency, Git, deployment or external-service mutation occurred. No execution denial, pending approval or uncertain action remains. Re-review any later change to the accepted bytes before relying on this acceptance.
