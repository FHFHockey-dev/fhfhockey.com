# CR011 / CR051 proof boundary — original fixture preserved

Both unchanged cases declare one synthetic verified original `9900000000000000001`, author `fixture_a`, retained receipt `offline-fixture:retained:9900000000000000002` and one publication clock. Record a's whole `sourceText` is “Jordan Staal will not play tonight.”; record b's is “… tomorrow.” The subject/predicate offsets are identical and each record has a generic `unique_1_to_1_fixture_alignment` marker. There is no retained full-document text containing both lexical occurrences, nor an explicit new-occurrence target/allocation proof.

CR011 requires distinct occurrence IDs as well as distinct game scenarios. CR051 requires distinct game scenarios/effects for the same team/date. The reducer already produces two distinct game scenarios. The registry refuses to invent a second source occurrence across different text versions of the same original; that still blocks the required new occurrence/effect. CR011 also gives record b an effective time after its validUntil, which reinforces that an action claim cannot be inferred merely from this scenario-isolation case.

The new candidate's structural validator accepts a separately supplied full retained document only when its exact subject/predicate/clause spans are valid and disjoint and both snippets match that original identity. It rejects overlap, truncated/changed bytes, wrong original and missing proof. A synthetic positive unit document demonstrates this contract; concatenating the two acceptance snippets in the runner would manufacture a missing precondition, so it is not done.

Precise offline question for the fixture/contract owner:

> Do CR011/CR051 represent two independent lexical clauses in one retained original document, or two edited/excerpt versions of one clause? For the former, supply an explicit retained full-document/version and two disjoint anchor mappings, or an approved equivalent new-occurrence proof. For the latter, explain which identity/transition policy permits distinct occurrence/effect allocation while preserving the same original/receipt and the unchanged oracle. Different game IDs alone cannot provide lexical provenance. Please request any missing fixture context before recommending a mapping.

This is an unresolved offline proof/policy contract, not a reason for a production read. The original fixture and assertions remain unchanged; both cases continue to fail honestly. No new dispatch, compensation or correction policy is inferred.
