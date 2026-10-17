# Independent finite fixture review

Date: 2026-10-16
Snapshot reviewed: copy of `ifttt-cloud-next-fixtures-20261016` in this review directory. Author files were not modified.

## Result

No blocking semantic label/text mismatch was found in the 15 cases and 40 selected claims. Accept as **provisional research annotations and a candidate offline regression specification**, subject to the limits below. This review is not human adjudication, authenticated ground truth, application execution, or a performance evaluation.

## Checks reproduced

- `python validate_fixture_pack.py`: passed, 205 schema/integrity checks; 15 cases, 40 claim spans, 17 source groups, 36 retained raw records.
- `sha256sum -c SHA256SUMS`: every listed delivered file passed.
- Independent cross-check: 36 distinct raw export IDs; 29 text variants; variant character counts, occurrence-to-text-slot references, and retained ingress/parsed text and null slots agreed.
- JSONL has 36 LF-delimited records, a final LF, and no CRLF boundaries. Strict parsing succeeded.
- No original-corpus revalidation was run in this review. The supplied full-source receipt remains an author-produced receipt. Portable checks establish consistency against the embedded evidence, not fresh authentication of the external sources.

## Acceptance boundaries

1. **Negation and temporal scope:** NX001–NX007 correctly keep not-ruled-out, historical denial, conditional participation, game-specific exclusion, and training-camp absence distinct. NX006 reports an asserted Game 2 exclusion and an unresolved Game 3 status; it does not verify either underlying event. No game IDs or player IDs should be inferred from these labels.
2. **Role and certainty:** NX008–NX010 preserve skater extras, goalie lists, starter-crease observations, doubtful participation, and full practice separately. These are contextual role annotations. Practice section layout and surname familiarity are not independently verified roster bindings, and a starter's-net observation is not explicit start confirmation.
3. **Source attribution:** NX011's quote metadata and the other reporter URL support separate retained post candidates, not independent information sources or an established common game. NX012's two relay IDs and identical text support retaining both occurrences while holding origin resolution; neither timestamp order nor text equality establishes a canonical original.
4. **Edits and disputes:** NX013 is exact RT-prefix removal within retained text views, not authenticated edit history. NX014 has an explicit but hedged correction without a resolved prior target. NX015's differing retrospective counterfactual prognoses do not supply a strict, same-game IN-versus-OUT dispute. The broad `disputed_vs_confirmed_out` family name must not be counted as actual coverage of that missing dispute.
5. **Execution:** The pack declares implementation execution unrun. `expected_effects.actual_dispatch_count: 0` belongs to expected offline behavior, not a measured receiver/dispatcher result. Do not publish accuracy, recall, confirmed outcomes, safe live behavior, or integration acceptance from this review.

## Worthwhile missing cases

- **Distinct Unicode coordinate systems:** None of the 29 source variants contains a non-BMP character, and all 40 evidence spans have identical code-point and UTF-16 coordinates. Add a separately identified test with an emoji or another supplementary-plane character before the evidence span. The present checks cannot expose the common error of using code-point offsets as UTF-16 offsets in such text.
- **Self-contained line-separator parsing regression:** The portable 36-row JSONL contains zero literal U+2028 or U+2029 characters. Its LF parsing works, but the README's G005417 line-separator case is only checked by the optional full-source run. A separately retained or clearly synthetic portable case would test this behavior without the original corpus. Do not alter existing source bytes to manufacture it.
- Already disclosed, consequential missing coverage remains unchanged: independently authenticated edit lineage and a genuinely game-bound source dispute. Neither can be fabricated from the selected historical records.

No network, database, Mac, production system, or sealed outcomes were accessed. No source, oracle, fixture expectation, or application file was changed.
