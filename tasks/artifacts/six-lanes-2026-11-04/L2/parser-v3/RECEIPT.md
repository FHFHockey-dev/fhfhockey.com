# Isolated mapper-v3 parser candidate

Prepared only under L2's artifact namespace. No shared parser/test application, snapshot replacement, repackaging, arm-C adoption, protected history, source qualification, or runtime data operations. Latest shared parser/test audit modifications were read and preserved. All four baseline pins (parser, test, mapper, opportunity contract) still match at final preparation; `git apply --check` passed.

## Exact candidate

- Patch: `mapper-v3.patch` (only `web/lib/buyLowSellHigh/researchSnapshot.ts` and its existing test).
- Parser baseline: `76721610cf1be0f699279696603517c1b92547d1e85944e150098370a31babd3`.
- Test baseline: `3cd79a94f1ff6b896c48cd41dd59a1e0a3ea9a33fe54abdc378927071e6ab69c`.
- Candidate hashes and patch hash: `PATCH-PINS.json`; latest dependency source hashes: `BASELINE-PINS.json`.
- Candidate parser/test copies beside the patch are isolated test inputs, not application sources.

## Semantic acceptance

1. Explicitly recognize the observed mapper-v1 legacy artifacts and mapper v3; reject unknown versions. Keep existing arm-A-only reference/chronology/source-custody rules unchanged. Preserve the audit's numeric-sign and withheld-list guards. Both retained legacy arm-A snapshots still parse without mutation.
2. V3 requires the mapper's fixed list metadata (20 personal games, five-game window, top 25 per F/D, provisional minimum). It verifies supplied headline/track roles and numeric equality, list eligibility/direction, position ranks/top-N, null withheld ranks and direction disclosures. Gate-specific withholding reasons cannot contradict visible history/window/headline evidence. It does not infer unavailable underlying source-axis history status from the display payload.
3. Verify supplied overall ranks against directed headline gap and player-ID ties; verify contiguous position ranks agree with overall ordering. A map indexed by supplied rank checks the sequence; no output reranking, score calculation, field repair, or snapshot mutation occurs.
4. Recount supplied v3 withholding/direction, per-position and opportunity totals. Existing general population counts remain checked. This is consistency validation, not evidence that a source population is complete.
5. Require opportunity to remain provisional, retrospective, non-forecast, untrusted and non-list-affecting. Unattached evidence requires explicit unavailable metadata, no numeric payload, no tracks/changes/headline/listCheck. **The current mapper intentionally produces null listCheck for unattached opportunity even on listed rows**; the older handoff's unconditional listed-row requirement is not applied.
6. Attached opportunity verifies version/ordered tracks, complete available comparisons, explicit unavailable comparisons, supplied gap arithmetic and observed-window agreement, assessment/headline equality, finite/null changes and provisional listCheck consistency. A balanced/contradictory opportunity assessment does not disqualify a valid BL/SH list member. Missing expected/gap/z/direction cannot become zero. Unavailable comparisons may retain observed production or a scale, matching the current mapper; those are not claimed to be available expectations.

## Actual checks

All checks used local files; no application/provider endpoints or real data acquisition.

- Isolated Vitest config uses the web dependency installation, Node environment, only the candidate existing test file, and existing retained display fixtures. The added tests use small synthetic v3 metadata on arm-A display examples, not newly admitted Profiles. Final command from `web/`: `npx vitest --run --config ../tasks/artifacts/six-lanes-2026-11-04/L2/parser-v3/vitest.config.mjs --maxWorkers=1 --reporter=dot` — **64 passed / 1 file**, 4.60 s. Includes legacy checks, zero-valued attached comparison, unattached listed rows, thin-history abstention, immutability and rejection mutations across gates/ranks/counts/opportunity. Initial candidate had 63 passing tests; one further gate-reason regression was then added and the changed file rerun.
- `node ../tasks/artifacts/six-lanes-2026-11-04/L2/parser-v3/check-types.cjs` from `web/` — **0 diagnostics**. Uses actual web compiler options and only candidate parser/test roots plus their imported dependency graph; redirects their relative type/test-module resolution to canonical dependencies. This is not a full repository typecheck. First invocation used a wrong relative working-directory path and failed before loading; corrected invocation passed.
- `npx eslint --stdin --stdin-filename lib/buyLowSellHigh/researchSnapshot.ts < ../tasks/artifacts/six-lanes-2026-11-04/L2/parser-v3/researchSnapshot.ts` and the equivalent test-file command — **passed**, exit 0 using canonical lint configuration.
- `git apply --check tasks/artifacts/six-lanes-2026-11-04/L2/parser-v3/mapper-v3.patch` — **passed**, no application. Shared-file SHA comparisons against captured baseline — **passed**.

## Remaining gate

Chef/L1 must grant exact custody for both shared files before application. Recheck baseline pins immediately before applying. If granted unchanged, apply the reviewed patch and run the canonical focused test file; shared-path execution remains distinct from this isolated evidence. No full build/broad audit is warranted. Source Profiles/repackaging, preview list UX, retained-card repins and arm-C policy remain separate pending work, not solved or authorized by parser acceptance.

## Chef review correction — supersedes the initial candidate

Chef found the initial candidate's available-opportunity arithmetic reversed the canonical sign. The initial balanced zero-gap fixture could not expose it; the earlier 64-pass result did not establish sign correctness. Canonical `opportunity.ts:157–164` uses **observed minus expected**, with **z = gap / scale**; the mapper copies this without sign conversion. The score headline's support-minus-observed convention remains separately unchanged.

The bounded correction now requires:

- available comparison `gap` matches `observed - expected`;
- finite **strictly positive scale**, and finite z matching `gap / scale`;
- non-balanced `buy_low_evidence` requires negative z, and `sell_high_evidence` positive z;
- balanced remains permitted without inventing the unsaved threshold/band, including a valid nonzero -0.2-z case.

Added ten cases: nonzero below/above production for **both per-game and adjusted** comparisons (gap/z -2 or +2), reversed gap, reversed z, wrong z ratio, zero/negative scale, reversed non-balanced direction, zero-z non-balanced direction, and nonzero balanced acceptance. Both direction cases preserve list/rank/score bytes and opportunity remains non-gating, including above-production context contradicting a BL list.

Corrected final verification, using the same isolated commands above: **74 tests passed / 1 file**, 4.23 s; targeted compiler graph **0 diagnostics**; both canonical-config stdin lint checks **passed**; corrected patch applicability **passed**. Shared parser/test/mapper/opportunity hashes still match the original baseline. No shared application.

Corrected parser SHA256: `dc4cbb57a93a6e2cdae66d48b0519704c17f0a7d49451bfa546eafeb885b2cb7`.
Corrected test SHA256: `a34517a7cdb23dd91e6980bf16d40ea1751ebfce75b06895a553d4a687099c14`.
`mapper-v3.patch` and `PATCH-PINS.json` now identify this corrected candidate; prior candidate hashes are superseded. Custody handbacks are reported received by Chef, but the application grant remains pending corrected review.

## Installed after explicit Chef grant

Chef accepted the corrected patch and granted only the two shared parser/test paths after both owner handbacks. All four captured source/dependency pins matched immediately before application; patch SHA matched. Applied the exact reviewed patch, preserving the earlier audit diff. Installed hashes are the corrected candidate hashes above and in `INSTALL-RECEIPT.json`.

Acquired `/private/tmp/fhfh-heavy.lock` atomically while absent, ran exactly one canonical command from `web/`: `npm test -- --run lib/buyLowSellHigh/researchSnapshot.test.ts --maxWorkers=1 --reporter=dot`. **74 tests passed / 1 file**, exit 0, 5.01 s. Full output: `CANONICAL-TEST.log`. Own lock was released after completion; no competing lock removed. Existing punycode warning only.

Scoped `git diff --check` passed. Post-test installed parser/test and unchanged mapper/opportunity dependency hashes verified. Prior isolated type/lint evidence reused for identical bytes; no broad rerun. Only the granted two application files changed in this step. Current snapshot, model/scoring, source qualification, arm-C adoption and other application files remain untouched by L2. Ready for Chef/L3 hash review; local and uncommitted, not released.
