# Independent review: source observation and captured windows

No blocking finding in the exact reviewed change. This approves local additive diagnostics only, not source admission or a release.

## Source review

- Read the complete gate diff, pinned original gate, new tests, raw input validation and sorting, and the original 66-comparison parity harness. The same native-byte acceptance, row binding, transport/scope declaration, official identity/exposure and original observation chronology checks remain. The only separated predicate is per-member event age.
- Existing v1 `qualified`, `reasons` and `provenance` still include that predicate. In particular, an older row can pass `sourceObservation` while its v1 current-use decision stays withheld. Neither freshness result establishes acceptance of a source model or baseline.
- `qualifyCurrentInputs` sorts captured rows by player/date/source ID before window selection. Selection takes the last five captured records before qualification; an invalid or held latest member cannot be replaced with an older passing member.
- Every window has `membershipScope: last_five_captured_WGO_records`, `completeLatestFiveEstablished: false` and `currentUseQualified: false`, plus the explicit missing-census reason. Recency is server-UTC-day diagnostic metadata, not a claim of complete appearances. A short window may have all its captured members qualified, but is still explicitly short and unadmitted.
- The real acceptance list stays empty. Canonical NST client remains unchanged at SHA-256 `48d82fc40ca06d9abe4675f4a1896add55c4e53d4dee661bbe082d424c944e4f`. No production caller was added in this two-file diff.

## Independent verification

`node tasks/artifacts/blsh-freshness-independent-review-2026-11-07/review.cjs` passes nine additional synthetic scenarios: shuffled feeds, separate players, empty capture, duplicate player dates, invalid latest date, future latest event, missing latest witness, a zero-day event-age policy and empty acceptance.

Across three evaluation times and accepted/closed synthetic policies, all **54 complete v1-output comparisons** match the pinned original implementation after removing only new fields. Every returned captured window remains incomplete and unadmitted; caller request bytes are unchanged. The review checks all **14 entries** in the implementer's final manifest. All match.

The script reuses the existing synthetic fixture constructors but supplies independent cases/assertions. It loads the actual current and pinned original source, permits only expected pure imports, and rejects fetch. It does not read real source packets or reserve outcomes. This is not independent provider evidence.

Reused, not repeated: the implementer's 59 gate tests, seven New York timezone regressions, 66 original parity cases, focused types and scoped lint. No full application suite, browser or build was justified by these diagnostics with no runtime caller. No database/provider request, receipt acceptance, score, snapshot activation, source edit, commit or deployment occurred during review.

## Remaining boundary

Source observation is ready for later controlled integration, not for use as a recommendation gate. A versioned current-use path still needs independently bound complete latest-five appearance membership, fresh native evidence and an admitted method/reference. The isolated two-page capture pilot does not establish a complete window census. Do not infer completeness from numeric WGO/NST agreement or fill missing appearances with zeros.
