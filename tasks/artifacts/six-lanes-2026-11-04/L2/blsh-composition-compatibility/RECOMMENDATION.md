# BLSH candidate API compatibility: minimal composition correction

**Recommend deferring only the independent `BlshPlayerDetail.tsx` research UI slice from this release candidate, restoring that candidate path to the exact release-base blob.** Keep the canonical audited component unchanged for its later research-preview integration. Also update the candidate's one stale preview-test contract-version assertion to v0.2, matching the separately accepted sKO contract. Neither correction has been applied.

Candidate: `d33b122da84f7e36c661484178fb5c837017126d`; parent/base: `03c53add225fea452c2e2e92515aab08e56c3c3d`.

## Direct evidence

- Composer `composition-01/evidence/tsc.log` reports exactly the caller mismatch at preview line 141: `record`, `row`, `target`, `inCurrentList` versus detail's `profile`, `snapshot` API.
- Candidate `BuyLowSellHighPreview.tsx`, its test, preview page and detail SCSS are **byte-identical to release base**. The caller uses the legacy default detail with an `InterpretationRecord` and watchlist row. The page renders fixture preview with no snapshot prop.
- The selected current detail's default export instead consumes a historical `BlshResearchProfile`. The audited extra explanation belongs to named `CurrentBlshPlayerDetail`, which consumes a different `DisplayProfile`/`DisplaySnapshot` pair. These are distinct contracts, not aliases that can be fixed by renaming caller props.
- Candidate-wide bounded symbol search in components/pages/lib found **no external caller of `CurrentBlshPlayerDetail` or `ProductionTrackComparison`**. The only external detail import is the legacy preview default. Therefore the audited named research UI is currently unreachable in this candidate.
- The current canonical preview is the new snapshot-driven implementation and calls both the historical default and named current detail. Including it alone would move the incompatibility to the base page. Its matching page imports `researchSnapshot.server`, which is **absent in both release base and candidate**. That reader/pinned snapshot/preview/test chain is not a narrow caller fix and must not be silently imported.
- The base preview test at line 93 literally expects `contract sko-interpretation-v0.1`; selected contract/fixture records now emit v0.2. This directly evidenced one-line expectation mismatch belongs to the accepted sKO version change. It is not a newly run test failure; no test execution was performed here.

## Proposed exact correction

`PROPOSED-CANDIDATE-ONLY.patch` is against the candidate, **not the current canonical source**:

1. `web/components/buyLowSellHigh/BlshPlayerDetail.tsx`: replace candidate blob with exact parent/base bytes, SHA256 **`8d599804461848e162fa566bea5e571375f45f965bbc54afbbc3b3475613fb3b`**. This is a selective composition exclusion, not deletion or reversion of canonical work. Candidate/current before SHA256 is `6419b05cec243ed5f3f66b40ad7d79b4a3bcba2fd61994bf93d99f5bd8d92a03`.
2. `web/components/buyLowSellHigh/BuyLowSellHighPreview.test.tsx`: change only the literal `contract sko-interpretation-v0.1` to `contract sko-interpretation-v0.2`. Keep the actual fixture/source-clock assertion and all interaction assertions intact. Exact before/after and patch hashes are in `PINS.json`.

No caller/page/style/loader/snapshot edit is proposed. The source copy `release-base-BlshPlayerDetail.tsx` is an artifact for custodian comparison only.

### Behavior retained/lost

Retained: existing fixture watchlist detail, per-target gaps, opportunity/duration, variability, evidence/forecast clocks, missingness, limitations, focus-on-open, Escape/Close and return-focus flow; the base caller/test matches that detail API. The sKO v0.2 data additions are additive to these legacy reads; no narrowed shape was identified in the direct component accesses. Other accepted BLSH parser/card/market and sKO/VuDu contract/UI corrections remain included.

Deferred from this release only: the audited named research detail's FP headline, direction-withheld text and assessment/market/opportunity explanation. Those currently have no reachable candidate caller, so deferral removes no working candidate UI behavior. Their canonical audited source stays available and must be carried into the separately reviewed research-preview pipeline later. This does not assert real data or current recommendation readiness.

## Alternatives evaluated

- **Preserve legacy default plus named research component:** technically separable by restoring the base default, retaining `ProductionTrackComparison` and `CurrentBlshPlayerDetail` plus their helpers/imports (or adding a dual-prop dispatch adapter). However, this creates a new composed module carrying a large unreachable research subtree and its dependency burden purely to preserve an unused export. It requires fresh component behavior checks and is larger than excluding this independent slice. Not recommended for this release correction.
- **Include only the current caller:** not safe/narrow. Current caller requires snapshot props, matching page/reader/pinned bytes and tests, while replacing the fixture-based preview workflow. This is the unreleased pipeline the ticket excludes. Do not cast an InterpretationRecord into a display snapshot or manufacture the missing source data.
- **Defer detail only:** smallest faithful option, restores a known caller/component contract and keeps the accepted model/data corrections. The one stale version test remains a necessary narrow companion when the accepted sKO v0.2 contract stays included.

## Ownership and remaining verification

Chef must accept the narrower inclusion and authorize the preview-test expectation hunk (new composition path relative to this correction). Custodian alone updates the export/index/ref and manifest; L2 has no such authority. Current canonical detail and its owner custody remain untouched. Do not apply this patch to canonical because its current caller intentionally uses the research API.

After composition, use the existing candidate verification flow and the focused `components/buyLowSellHigh/BuyLowSellHighPreview.test.tsx` cases for detail open, disclosure, Escape/Close focus and selected-but-unranked behavior. Type success alone does not accept those interactions. No heavy checks, app writes, export edits, browser/server operations, provider/data access or Git mutations were performed by L2 in this inspection.
