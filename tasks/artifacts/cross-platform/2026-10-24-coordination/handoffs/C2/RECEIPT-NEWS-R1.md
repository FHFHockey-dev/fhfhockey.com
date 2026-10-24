# C2 receipt R1: NEWS-SOURCE-PRESENTATION sync metadata loss, authority-neutral candidate (variant b)

- **Lane and ID:** C2 (Claude session `local_d396b1e2…`). NEWS-SOURCE-PRESENTATION follow-up 1 of 3: sync metadata loss.
- **Basis:** the orchestrator's decision (`local_88650158…`, 2026-10-24) to build variant (b) as the candidate. The lane grants no public-claim authority. The accepted-public producer/loader contract stays held, and Codex's COMPATIBILITY-PROPOSAL requires trusted acceptance records, not metadata alone.
- **Supersedes:** RECEIPT-NEWS.md is superseded as the candidate. It remains the record of variant (a).
- **Status:** candidate patch only. It is not self-certified, and C7 review is next. The Luna slice (RECEIPT-LUNA.md) is unchanged.
- **What did not happen:** no Git write, no canonical edit, no network access, no production access, no historical repair, no dedup, no schema, homepage, `newsFeed.ts` or claim-validator change.

## Base and pins

- **HEAD:** `2a5092d37`. All canonical files below are read-only and unchanged:
  - `web/pages/api/v1/db/tweet-pattern-review.ts` `0145984ba46c82bc09698b047b00a395018b0e9488acd52cb5f1d9c616083445` (git `M`; lease pin).
  - `web/lib/homepageNewsCompatibility.test.tsx` `48321a8a5add55a9e9f4534cfd751dcf2e68d62b8576b696860a70288fde7ca7` (git `??`).
  - `web/lib/newsFeed.ts` `de831779…218d`.
  - `web/lib/newsLineupPresentation.ts` `96aea921…`.
- **Snapshot:** `/private/tmp/fhfh-c2-isolated/web`. Manifest `SNAPSHOT-MANIFEST.sha256` (`de744d55…`) was written before any edit.
  - The snapshot now holds R1.
  - Variant (a) bytes are kept as `C2-NEWS-METADATA.patch` and in scratch.
- **Patch:** `C2-NEWS-METADATA-R1.patch`, sha256 `c7f29a2cdd9d762cccbb9c266b1b5969f164e015d6aef6b975ab4d608bdae04e`.
  - 2 files, +69/−7.
  - It is a full patch against the canonical baselines, not a delta on variant (a).
  - `git apply --check` against canonical passes (check only).
- **Lease note:** the patch touches `web/lib/homepageNewsCompatibility.test.tsx`, which is **not** in C2's original lease list. The edit is snapshot-only; it is the nearest existing sync-writer/loader test. Integration needs that file's owner (the accepted NEWS six-path packet) to agree.

| File (web/) | Canonical | R1 candidate |
| --- | --- | --- |
| pages/api/v1/db/tweet-pattern-review.ts | 0145984b… | 9c4f95ab257e088e0cbacb3dbdae36a1f85b2fa3f2cc6a13bb6cf176aea0aaea |
| lib/homepageNewsCompatibility.test.tsx | 48321a8a… | 2c9c2e1fb1f5f5e4bd86c9199fd10cad980683d44e6da4dff889c8822043d3fe |

## Change (writer only)

- **Query:** both source selects (`lines_ccc`, `line_source_snapshots`) add `interpretation:metadata->interpretation`.
  - This is the existing PostgREST JSON-path idiom (`player-name-aliases.ts:37`).
  - Only that subtree is transferred.
- **Type:** the row types gain `interpretation: unknown`.
- **Builders:** both write `retainedInterpretation: row.interpretation ?? null` into review metadata. This is a new key; the reader never sees `interpretation`.
  - Other source metadata (lineage, temporal review) is not copied.
  - `null` replaces an earlier value in the `{...existing, ...candidate}` merge, so a stale copy cannot persist.
- **Downstream:** automation spreads review metadata into `news_feed_items.metadata`, so `retainedInterpretation` is also kept there. `sanitizePublicNewsFeedItem` emits only `interpretation`, `lineupCard` and `automation.summary`, so the key never reaches the public DTO, JSON, homepage, claim presentation or `newsLineupPresentation`.
- **What R1 does not do:** it does not make the homepage show claims from retained metadata. That waits for the held accepted-public loader contract.

## Original failure and controls (final test file, three writers)

| Writer | Result | Meaning |
| --- | --- | --- |
| Canonical (unmodified) | 5 failed / 46 passed (`r1-tests-original-writer.log`) | Loss reproduced: `retainedInterpretation` is `undefined` (lines 282, 293, 298). The byte-identity assertion (line 291) **passes**, so today's public view is the baseline. |
| Variant (a), `interpretation` key | 5 failed / 46 passed (`r1-tests-variant-a-writer.log`) | The byte-identity assertion **fails** at line 291. The test detects a public change. |
| **R1** | **51/51** (`r1-tests-r1-writer.log`) | Interpretation preserved for review; public views unchanged. |

New regressions (5), all on the real path: sync writer → automation candidate → `fetchNewsFeedItems` → JSON.

- **Preservation:** per source table, the interpretation is retained for review only.
  - `review.metadata.retainedInterpretation` equals the source.
  - Only the JSON-path subtree is selected, not bare `metadata`.
  - Neither the review item nor the news item gets an `interpretation` key.
  - Lineage and temporal review are not copied.
- **Byte identity:** per source table, the public view is compared with a source that has no interpretation, using one serialized string. It covers:
  - the loaded DTO;
  - the DTO after a second `sanitizePublicNewsFeedItem`;
  - `getPublicNewsClaimPresentation`;
  - `readNewsLineupPresentation`;
  - the `buildHomepageInjuryUpdates` row.
  - It must be `toBe`-identical. Claims stay `[]` even though the retained interpretation would pass the validator. `retainedInterpretation` and `rawLineageMarker` never appear.
- **Stale copy:** an earlier retained interpretation is replaced by `null` once the source no longer has one.

**Cross-writer byte check** (`news-r1-evidence/cross-writer/`; scratch dump test, not in the patch): the same source row with a valid interpretation goes through the canonical writer and through the R1 writer.

- The public view is **byte-identical**: 2,192 bytes, sha256 prefix `0be4e78102e4f884`, for both `lines_ccc` and `line_source_snapshots`.
- Sensitivity control: variant (a) produces 2,922 bytes and contains the Victor Hedman claim.

## Checks

| Check | Result |
| --- | --- |
| Neighbour suites: homepageNewsCompatibility, newsFeed, tweetNewsAutomation, tweetPatternReview, tweetLunaReview (C2 Luna candidate). Node 22.11.0, `env -i`, network-guard preload, one fork worker, cache in scratch | **158/158** across 5 files |
| Scoped tsc (writer + test) | exit 0 |
| ESLint (2 files) | 0 errors; 1 pre-existing `no-img-element` warning in the test mock |
| Whole-project `tsc --noEmit -p tsconfig.json`, snapshot holding Luna + R1, 8 GB heap, under `/private/tmp/fhfh-heavy.lock` | **exit 0, 0 errors**. Lock taken free with noclobber at 16:47:52Z and released at 16:48:52Z; never stolen. `news-r1-evidence/full-tsc-run.txt` |

## Alternative kept on record: variant (a)

- **What it is:** `C2-NEWS-METADATA.patch` / RECEIPT-NEWS.md write the same value under `interpretation`.
- **Effect:** the existing public validator would then admit valid retained events, and claims could appear on the homepage after re-sync. It would also make `newsLineupPresentation` units precedence reachable.
- **When it fits:** the release owner may pick it if metadata.interpretation is accepted as the public contract.
- **Switching later:** R1 → (a) is a one-key rename in the two builders. A reader could also adopt `retainedInterpretation` once the accepted-public loader contract exists.

## Not done / limits

- No historical repair: existing rows gain `retainedInterpretation` only on their next normal sync.
- No dedup. Duplicate-source identity is untouched.
- No live or production data. Whether live source rows hold interpretation is unknown.
- No browser run, build or full suite.
- C7 review needed.
