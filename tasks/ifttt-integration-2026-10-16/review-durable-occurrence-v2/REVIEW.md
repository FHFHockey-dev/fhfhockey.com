# Independent durable occurrence v2 checkpoint

Verdict: **applicability corrections required; R15 remains open.** The repaired supplied fixture dates pass the unchanged reviewer contract. The new receipt validator still accepts inconsistent raw applicability clocks, an oversized source span and a timezone-less publication. The owner identified these adjacent issues during the frozen review and requested a bounded reproduction and early release before database reruns.

Reviewed manifest: `../durable-occurrence-increment/owned-source-v2-sha256.json`, **59 pins**, SHA256 **440b7b20c0da108de71db8680c98a36ab9e1f77b048e5efcd5e7cd51ff6b0d66**. All pins matched before and after the focused run, immediately before explicit release. Exact bytes are preserved in `frozen-source/` and `frozen-owned-source-sha256.json`. All 424 earlier manifested reviewer files were rehashed unchanged. No prior evidence was overwritten.

## Checks executed

- `independent-fixture-contract.test.ts` is byte-identical to the previous reviewer test. With the corrected versioned fixture JSON, **3/3 pass**: supplied dates agree with applicability/Eastern effective day, complete-source SHA256s match, and positive clocks remain causal. This supports R14's supplied-date repair. It does not independently verify every projection mismatch branch.
- `independent-applicability-negatives.test.ts`: **1 passed, 4 failed**. Total across both files: **4 passed, 4 failed; exit 1**. Network-denial setup was enabled. Full results are in `focused.log`, `focused-results.json` and `evidence-summary.json`.

The four failed negative assertions reproduce:

1. A valid explicit receipt for **2026-10-17T23:00:00Z**, combined with raw `semantic.effectiveAt` **2026-10-16T23:00:00Z**, is returned as `status:"verified"` by `datedTweetClaimBinding`.
2. The same receipt with raw effectiveAt **2026-10-17T22:00:00Z** is also verified. Checking only the date would not resolve this mismatch.
3. `explicitTweetClaimGameApplicability` accepts a governing clause with `end:999` against a 40-character source. `slice` clamps the endpoint, allowing its text equality check to pass.
4. The constructor accepts publication `2026-10-16T15:00:00` without an offset. The source contract requires an offset-bearing instant; host-dependent `Date.parse` interpretation is insufficient.

The timezone-less **23:00 start** negative passed (it was rejected in this host timezone). No failure is claimed for that probe. Source inspection shows no explicit offset check for start or publication; the start probe can reject incidentally because local parsing changes its Eastern date. Add a daytime timezone-less start regression in the correction matrix so rejection does not depend on crossing midnight.

The initial release message incorrectly described five failed negatives. A prompt correction to the owner reported the actual four-failure/four-pass JSON result, including the start-probe distinction. The logs and assertions were not changed to hide the outcome.

Required repair: compare the explicit receipt's exact start with raw semantic applicability, require the complete clause span within source bounds, and require offset-bearing publication/start clocks. Fix the pure positive's raw effectiveAt to match its future receipt. Retain these five reviewer assertions unchanged for the next pinned rerun, alongside valid positive and missing/conflicting-proof controls.

Run from `web/`:

```sh
npm test -- --run ../tasks/ifttt-integration-2026-10-16/review-durable-occurrence-v2/independent-fixture-contract.test.ts ../tasks/ifttt-integration-2026-10-16/review-durable-occurrence-v2/independent-applicability-negatives.test.ts --config ../tasks/ifttt-integration-2026-10-16/review-durable-occurrence-v2/vitest.review.config.mjs
```

## Explicitly incomplete review boundaries

The new SQL guard and exact CR036/CR039/CR040/CR052 harness were read. The guard checks a bounded unique proposed evidence-version array and requires every prior canonical evidence row to remain identical before raw/qualification commit. The harness translates the original already-bound records and uses synthetic dated/history fixtures, a forced evidence key collision, a pre-commit fault, acknowledgement readback and a real two-worker CAS race.

**Neither the SQL guard nor the four exact cases was independently executed or accepted in this checkpoint.** The newly found applicability blocker justified releasing the candidate before spending database reruns on bytes the owner was ready to repair. Their reported 4 tests/14 original assertions remain author evidence pending the corrected pin. The repaired older registry harness was inspected to install the third migration; its current rerun is also still pending independent verification.

The owner reports normal original pure results 41/43 cases and 194/196 assertions, with original CR011/CR051 ambiguity and nine pure persistence deferrals preserved. That CLI was not independently rerun here. The original oracle hash in the frozen candidate remains `d9fe45ca44042673ff0381cd0f1981074b196da99fb6fdf9da573ac5df84fd8b`. No four-case result is silently treated as full-52 acceptance.

Next review should independently run the repaired applicability/fixture contracts, valid explicit-proof actual CR011/CR051 positives, missing/conflicting proof negatives, current three-migration registry/qualification suites, and SQL evidence collision/deletion/duplicate controls plus the faithful four-case DSL mapping. Exact CR037/CR041/CR042–CR044 parent/consumer contracts remain separate. Automatic multi-game NLP, authentic future identity/source evidence, real receipt/writer/consumer history, prospective performance and operational approval gates remain open.

## Ownership and release

This reviewer wrote only `tasks/ifttt-integration-2026-10-16/review-durable-occurrence-v2/*`. No implementation source/test/SQL file was edited, staged or committed. The owner remains the only known IFTTT implementation writer; unrelated repository changes were preserved. Frozen review snapshots are audit evidence, excluded from runtime/release inputs.

**All 59 source pins were explicitly released** after the final matching hash check and focused reproduction. No test/compiler/database process remains running in this reviewer thread. No database, aggregate compiler, build, browser, hosted read, migration, ingestion, real dispatch/replay, scheduler/forecast activation, push, deployment or credentials action occurred. There is no uncertain external outcome or new approval denial from this checkpoint.

Review artifacts remain stable after their manifest is generated. Current source may subsequently change under the owner's released ownership; this verdict remains attached to the frozen manifest above.
