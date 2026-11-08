# Occurrence identity correction candidate — pure, unwired, review pending

All 41 accepted v4 pins remain unchanged. The release coordinator captured those bytes separately and released live holds. New `web/lib/sources/tweetClaimOccurrenceIdentity.ts` and its test are excluded from that release; no runtime path imports or invokes this module. No staged SQL, deployment flag, consumer, dispatch or historical row changed.

The new ledger allocates a token once from a caller-retained namespace/counter, keeps immutable derivation fingerprints, and appends original bindings after exact unique retained-receipt/text/subject/predicate proof. Native r3 occurrence IDs and old evidence are retained. It rejects proof/author/post/clock conflicts, same-ID payload changes, missing anchor readback and ambiguous convergence of multiple already allocated provisional roots. No source identity is inferred from game IDs or author-looking text.

The task-local runner's optional `--occurrence-identity-candidate` mode projects the new ledger's allocated ID as canonical `sourceClaimId` for the provisional-upgrade path; it separately exposes `nativeSourceClaimId`. The original 52-case JSON and assertions are unchanged. Baseline v4 results remain preserved and still fail CR019. The new composed **pure candidate** passes unchanged CR019's four assertions: one stable allocated token, distinct interpretation versions, no old-row replacement and one hypothetical initial effect under explicit synthetic absence proof. This is field/API projection from a real retained ledger, not substitution of a fixture record label or literal expected ID. Independent review must assess that mapping explicitly.

Candidate results: 43 pure cases, 196 assertions; **41 cases / 194 assertions pass**. CR011 source-occurrence distinction and CR051 effect distinction remain failed. The nine exact persistence DSL gates remain deferred. Full acceptance is false and the command exits 1. Baseline and candidate files are separate under `../offline-completion/`.

Cross-text proof work: `verifyDistinctOccurrenceDocument` checks an explicitly supplied retained original document, consistent original identity/clock, exact clause/subject/predicate spans and disjoint occurrences. A positive synthetic full-document fixture passes; overlapping/wrong-original/truncated evidence rejects. Unchanged CR011/CR051 provide snippets from different text versions of the same original, generic one-to-one markers and different game scopes, without the full-document/new-occurrence proof. They stay held. The validator cannot authenticate operator-supplied evidence or manufacture missing original text.

## Checks and limits

- 10/10 new focused identity/proof tests passed (`identity-tests.log`).
- Targeted strict TypeScript check of the new pure module and its type dependency passed (`targeted-typecheck.log`); scoped ESLint passed (`eslint.log`). No aggregate compiler/build started.
- Original assertions executed in candidate mode with the two declared failures retained (`../offline-completion/acceptance-identity-candidate-*`). Baseline 40/43 cases and its three failures remain in `baseline-v4-*`.
- No database/network/dispatcher is used by these checks. The prior catalog `execute_sql` call was rejected by automatic approval review before execution; query two was not attempted. See `../offline-completion/CATALOG-READ-BLOCKED.md`.

This candidate is not yet connected to the durable context/commit RPC. Storage integration must persist/reload the identity state and allocator under the existing global context CAS, include the entire linked component when checking prior effects, and prove restart/concurrency/ack-loss behavior before exposing this ID as an operational canonical field. Multiple already allocated provisional-root convergence remains held until component-wide proof and legacy receipt policy exist. An identity token alone never clears history or releases an effect. No exactly-once guarantee is made.

The next technical review covers proof validation, immutable/ambiguous cases, the unchanged CR019 field projection and the two unresolved cross-text fixtures. Further runtime/storage edits require a new pin and independent review; current v4 acceptance is not extended automatically.
