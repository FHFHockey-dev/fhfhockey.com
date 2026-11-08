# E02 boundary diagnosis — invalid offset, unchanged contract

**The model's quote and offsets do not agree.** The quote is an exact, meaningful source excerpt and its `ruled_out` wording matches the frozen expectation. Its numeric end offset is wrong. This is not a semantically equivalent valid evidence object or a scorer false failure. No validator, label, prompt, schema or runtime correction is justified by this case.

## Independent source calculation

Original supplied source, unchanged in the retained packet and frozen submitted request:

```text
SYN Avery Keeper will not start tonight.
```

The complete source has 40 UTF-16 code units. Every character is ASCII: byte, code-point and UTF-16 counts agree, with no surrogate pair, combining mark, hidden Unicode normalization or line-ending issue. The model's quote `Avery Keeper will not start tonight.` occurs exactly once, starting at 4, and has 36 code units. Therefore its exclusive end is **4 +36 =40**.

| Evidence | Source slice / result |
| --- | --- |
| Observed `[4,38)` + full quote including period | Slice is `Avery Keeper will not start tonigh`; missing `t.`; invalid |
| `[4,39)` + full quote including period | Slice excludes the period; invalid text/offset pairing |
| `[4,40)` + full quote including period | Exact match; valid frozen full-quote variant |
| `[4,39)` + quote without period | Exact match; valid frozen punctuation variant |

The last two variants were already permitted in the frozen labels before the paid response. The diagnosis did not add an evidence alternative or infer an expected status from validator acceptance.

## Schema, validator and scorer

The strict schema requires numeric `start`/`end` and quoted `text`, but JSON Schema cannot prove that these three values identify the same substring. The response was schema-shaped and provider-completed; the application must perform the binding check.

`exactIdentitySpan` requires safe integer boundaries, source bounds, surrogate/grapheme boundaries and exact `source.slice(start,end) === text`. The observed numbers are in range and on character boundaries, but the substring equality is false. `validateLunaGoalieStatuses` therefore correctly returns `goalie_subject_binding_invalid` before accepting the proposal. The retained result is held, so the scorer's positive label cannot pass. It is not losing a valid result because of punctuation or array order.

`diagnose.ts` reproduced the **exact frozen request hash and original retained held result**, using the saved provider body through real transport/caller/admission with fake credentials, a network-denial preload and disposable synthetic ledgers. Four explicit offline variants produced the outcomes above. Changing only the end to 40 passes the unchanged validator/scorer; removing the period and using end 39 also passes. Valid controls retain `verified:false`, null game binding and human/source/time/conflict holds. These controls are not new model predictions and do not replace the paid result.

Original proposal text SHA256: `152916c970409b56ed1d1e3ac754b0bc1b78d98e12a194d890a00e2350d85c3d`.

Frozen submitted request hash: `a008002a2f52e504b17262b7907edc00494d834e58c9420c7a3450406dfd3ed2`.

## Changes and verification

The only application-file change is four regression cases in `web/lib/sources/tweetLunaReview.test.ts`: exact observed output with a checksum, wrong end 39 while retaining the period, explicit end 40 counterfactual and the already valid no-period/end 39 equivalent. They distinguish corrupt offsets from acceptable quotation variants without broadening the contract.

**143/143 focused tests passed.** Scoped TypeScript covering the test and diagnostic script passed; test-file ESLint passed. The focused suite retains existing wording, identity, negation, correction, injection, budget-stop and full offline rehearsal cases. The standalone saved-response diagnosis passed all four variants. Logs and `OFFLINE-DIAGNOSIS.json` retain exact results. Full application suites/builds were not needed for a test-only change.

`PROPOSED-FIELD-CORRECTION.json` records a single unapplied diagnostic correction to the **raw proposal's** `goalieStatuses[0].evidence.end`: 38→40. It binds the original proposal hash, packet/source revision, review key, occurrence and package. It is explicitly counterfactual, not an accepted human correction, automatic repair, training signal or publishing decision. Both the original raw response and held review remain unchanged.

## Missing context and safe next steps

No additional report, identity candidate, model explanation or hockey context is needed to calculate this boundary. The model's reason for choosing 38 remains unknown. The supplied quote and the source suffice to prove the mismatch; a semantic reading cannot make inconsistent coordinates exact.

Trusted goalie acceptance still needs the existing independent source authenticity, game/source-time binding, conflict/retraction and human-review checks. This fictional synthetic case has no verified real game context. Correcting a character offset does not supply those facts or authorize a real starter-status change.

Keep the original held result and the strict validator. A reviewer may inspect the prepared correction; no production correction mechanism or swipe UI was implemented. If reducing model offset errors becomes a separate task, explicitly design/review how quoted evidence is bound to supplied source spans, including unique/duplicate quotations, subject boundaries, Unicode, negation and corrections. Do not silently normalize, fuzzy-match or repair arbitrary model evidence merely to pass this test.

The paid ledger remains byte-identical and disabled: three consumed calls, at most 17 remaining within the same 20-call cap, aggregate exposure $0.263485646 of $1, with the historical $0.254394800 uncertain reservation preserved. No paid calls or retries occurred. Any further paid diagnostic needs a separately reviewed continuation; this evidence calculation does not authorize E02 to be rerun or E03 to begin.

All previous execution/preparation artifacts and runtime files remain pinned and unchanged; only the nearest test changes. E02 and the other examples remain exposed synthetic development material, not independent holdout evidence. No model-accuracy improvement, deployment or production readiness is claimed.
