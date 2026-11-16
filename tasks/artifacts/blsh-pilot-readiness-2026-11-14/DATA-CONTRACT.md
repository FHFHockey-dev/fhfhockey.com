# BLSH data contract on a bounded cohort (2026-11-15 UTC)

**Verdict:** the production-versus-support contract behaves as specified on real retained data:
- identities reconcile;
- complete five-game windows reproduce the retained selection exactly;
- measured zeros stay numeric;
- native inputs with unknown semantics are held, never guessed.

**Nothing here is current or showable.** The retained capture is the Nov 1 read, which is stale. A one-date native pilot can contribute at most one game per player, and the qualification gate cannot consume the runner's packet as written (gap B2 in BLOCKERS.md).

## Cohort and inputs (aggregate only; no names or IDs leave the private files)

- **Request:** `~/Documents/Codex/2026-10-27/task-3/current-refresh-reader-20261101-01/live-read-01/capture/CURRENT-REQUEST.json`, sha256 `c6d1d13d…92c12ba2`. Events through 2026-10-31, as-of 2026-11-01T19:57Z. This hash equals the context file's `captureSHA256`, so the pair is bound.
- **Contexts:** `…/production-context-02/CONTEXTS.json`, sha256 `7336bfc3…94b29325`. 740 profiles, 644 with five source IDs.
- **Cohort rules (mechanical, not chosen for coverage).** Neither cohort was widened.
  - **Pool A:** the 25 lowest player IDs among the 644 five-ID profiles. ID-list sha256 `22e2b857…ebeb394`. This pool is complete by construction, so it proves the selection logic, not coverage.
  - **Pool B:** the 25 lowest player IDs among all 740 profiles. This pool includes short windows.
- **Code path:** the real `qualifyCurrentInputs` (`web/lib/buyLowSellHigh/currentInput.ts:227`) via `cohort/cohort-check.ts` (`COHORT_POOL=five|all`). Output is in `cohort/COHORT-RESULT-five.json` and `COHORT-RESULT-all.json`.

## Results against TJ's checklist

Claude re-verified every code citation and test title below by grep (sign lines, UI copy and 8 test titles), not only relayed them from the research pass.

| Contract point | Evidence | Result |
| --- | --- | --- |
| Player identity reconciliation | A: 322 WGO records; B: 291. Exactly one WGO row per player/date, an exact regular-season calendar match, GP=1, positive TOI | **A 322/322, B 291/291 identity-qualified**; 0 orphan native rows |
| Complete five-game windows | Latest five identity-qualified games per player | A: 25/25 complete (by construction). **B: 22 complete, 3 short.** Both pools are **25/25 identical** to the retained context's `sourceIds`, including the short ones. A short window is never padded |
| Season / strength / as-of scope | `seasonId 20262027`; `populationScope: captured_WGO_records_only`; `asOfKind: presence_proven_by_capture_not_original_publication` | Scope is explicit. Native feeds declare strength, date meaning and TOI unit as `unknown` |
| Official vs native kept distinct | WGO (official) and the NST individual/on-ice feeds are separate tracks with separate checks and reasons | Official production complete A 316/322, B 286/291. **Native qualified 0 in both pools**: all held for `unqualified_strength_scope` / `date_meaning` / `exposure_unit`, plus 21 and 26 `no_matching_process_record`. Fail-closed, as required |
| Stale / unknown | Freshness at the frozen as-of: 239 stale, 83 fresh. All of it is stale today (event age > 7 days); the server-side gate re-evaluates freshness at server time (`currentProcessEvidence.server.ts:125-130`) | Stale evidence is labelled, not activated. **No stale snapshot was activated** |
| Measured zero vs missing | A: 83 measured-zero shot records; B: 80. **Real missing cases:** A has 6 records and B has 5 that lack ES, PP and SH on-ice goals-for/against, **all inside latest-five windows** | Zeros stay numeric. Missing fields mark that production track unqualified with explicit `missing_or_invalid_*` reasons and are never zero-filled. Downstream score handling is pinned by `supportGap.test.ts` "treats missing as not zero and zero as measured" and `displayProfile.test.ts` "keeps a measured zero numeric…" |
| Mapper sign | Support gap = expected − observed, positive = buy-low (`supportGap.ts:278,294`; `productionReference.ts:288`). Opportunity z = observed − expected, positive = sell-high (`opportunity.ts:163`). Sko = forecast − recent (`skoElement/interpret.ts:568`) | Pinned by `supportGap.test.ts` "separates the gap sign from research-list membership" and the `researchSnapshot.test.ts` sign-drift cases. **There are three conventions**, so every surface must carry its own named sign and units |
| Display-arm decision | TJ at 2026-10-29T13:15:25Z: "TJ selected **arm A (2022-24 development reference) with the official-receipt overlay** … labelled provisional and stale" (`CLAUDE-TO-CODEX.md`, CLAUDE-20261029-124). Enforced at `researchSnapshot.ts:263,284`; pinned snapshot `2026-10-28.arm-a-canonical-repaired.v2.json` | Used as recorded. Arm C (weighted personal baseline) is **not** admitted as the method; that qualification is unfinished |
| Framing | Claims are forced false (`displayProfile.ts:305,394`). UI copy: "not a probability, price or ROI" and "not demonstrated discounts or premiums" | Production-versus-support evidence only. One soft spot is noted as B6 in BLOCKERS.md |

**Contract suites on the current tree:** 9 files, **328 passed, 110 skipped** (`cohort/CONTRACT-SUITES.log`). The 110 skipped are opt-in retained empirical cases gated by `BLSH_RETAINED_TEST_ROOT`. They were not enabled here, so their claims are not made.

## What one native pilot packet can and cannot qualify

- **Can, once B1 and B2 are closed and an independent review passes:**
  - transport and parser shape for the two NST pages;
  - that the URL scope is exactly one date, all strengths and counts;
  - official game-level finality for that date.

  The result is a candidate for the empty native acceptance policy. It is not admission.
- **Cannot:**
  - a five-game window (one date gives at most one game per player);
  - per-player official frames, which the gate requires and the pilot doesn't capture;
  - TLS-verified receipts (the runner records `TLSVerified: null` by design);
  - admitted forecasts, scores, a stale-snapshot refresh or trade prices.
- **Even if the pilot passes, these stay gated:**
  - the public BLSH preview and the trade page (`trade.tsx:12-13`, `notFound` in production);
  - arm-C method admission;
  - the acceptance policy (`CLOSED_PROCESS_EVIDENCE_POLICY` is empty);
  - snapshot activation;
  - any market or price language.
