# C2 receipt: NEWS-SOURCE-PRESENTATION sync metadata loss (isolated snapshot, proposal)

- **Lane and ID:** C2 (Claude session `local_d396b1e2…`). NEWS-SOURCE-PRESENTATION follow-up 1 of 3: sync metadata loss.
  - Not addressed: the accepted-public producer/loader contract.
  - Not addressed: duplicate-source identity.
- **Status:** reproduced. A smallest-correction **proposal** is in the snapshot. It is not self-certified, and C7 review is next.
- **Held decision:** applying this lets a valid retained interpretation reach the existing public claim validator (see "Authority note"). That decision belongs to the release owner, Codex/TJ. Nothing was applied to canonical.
- **What did not happen:** no Git write, no network access, no production access, no historical repair, no dedup, no schema, homepage or `newsFeed.ts` change, no claim-validator change.

## Base and pins

- **HEAD:** `2a5092d37`.
- **Canonical files, read-only and unchanged:**
  - `web/pages/api/v1/db/tweet-pattern-review.ts` `0145984ba46c82bc09698b047b00a395018b0e9488acd52cb5f1d9c616083445` (git `M`; matches the lease).
  - `web/lib/homepageNewsCompatibility.test.tsx` `48321a8a5add55a9e9f4534cfd751dcf2e68d62b8576b696860a70288fde7ca7` (git `??`; same as the snapshot manifest).
  - `web/lib/newsFeed.ts` `de831779…218d`.
  - `lib/sources/tweetPatternReview.ts` `96d441ee…`.
- **Snapshot:** `/private/tmp/fhfh-c2-isolated/web`. Manifest `SNAPSHOT-MANIFEST.sha256` (`de744d55…`) was written before any edit.
- **Patch:** `C2-NEWS-METADATA.patch`, sha256 `4ac0b4967609c1d58838677973ec3fd7d99f5415953c17bc97d23ed80538fdad`.
  - 2 files, +66/−7.
  - `git apply --check` against canonical passes (check only).

| File (web/) | Canonical | Candidate |
| --- | --- | --- |
| pages/api/v1/db/tweet-pattern-review.ts | 0145984b… | bfc5027f879f968d71d2952641f4db2980aa12941f93e52e78354907816d9506 |
| lib/homepageNewsCompatibility.test.tsx | 48321a8a… | fa640fb68b4c576f4869532db7561f88fbcbd0abc3de18f2e431054aaf749c1c |

## Defect (demonstrated, writer side)

- **The two source queries drop `metadata`:** `syncTweetPatternReviewItems` selects source columns from `lines_ccc` and `line_source_snapshots` without `metadata`.
- **The builders rebuild metadata without interpretation:** `buildLinesCccCandidate` and `buildLineSourceSnapshotCandidate` rebuild review metadata without it.
- **Where the interpretation came from:** ingestion stores it in the source row's `metadata.interpretation` (`linesCccIngestion.ts` row builder spreads `source.metadata`).
- **The path:** source row → review item (lost here) → `buildTweetNewsAutomationCandidate`, which spreads review metadata → `news_feed_items.metadata` → `fetchNewsFeedItems` → `sanitizePublicNewsFeedItem`, which keeps `interpretation` → JSON → `getPublicNewsClaimPresentation`.
- **Result:** a valid retained interpretation can never reach the reader.
- This matches Codex's task-4 diagnosis (RECEIPT-FOLLOWUP §2). It is reproduced here end to end, not just at the writer.

## Original failure (unmodified writer, final test file)

`news-evidence/news-tests-before-fix.log`: **4 failed, 46 passed (50).**

- **Lines_ccc and line_source_snapshots end to end:** a source row with a valid interpretation goes through the real sync writer, the real automation candidate and the real `fetchNewsFeedItems` loader to JSON. The result is `claims: []` (expected one Victor Hedman `out` claim). This applies to both source tables.
- **Writer:** `review.metadata.interpretation` is `undefined` for the held-interpretation and replacement cases.
- **Setup note:** the existing `lib/sources/playerIdentity` mock lacked an export (`normalizeIdentityName`) that the automation builder needs. It is now a partial mock. `fetchPlayerIdentityDirectory` still throws, as before.

## Proposed correction (smallest)

- **Query (`tweet-pattern-review.ts`):** both source selects add `interpretation:metadata->interpretation`.
  - This is the PostgREST JSON-path idiom already used on the same source tables (`player-name-aliases.ts:37`).
  - Only that subtree is transferred, so there is no extra payload from the rest of the source metadata.
- **Type:** both source row types gain `interpretation: unknown`.
- **Builders:** both add `interpretation: row.interpretation ?? null` to review metadata.
  - Other source metadata (lineage, temporal review, etc.) is not copied.
  - When the source no longer has an interpretation, `null` replaces an earlier one in the existing `{...existing, ...candidate}` merge, so stale interpretations do not persist.
- **Out of scope:** the IFTTT event tables have no interpretation and are untouched. There is no schema or reader change.

## Checks after the fix (Node 22.11.0, `env -i`, network-guard preload, one fork worker, cache in scratch, jsdom plus the repo setup file)

| Check | Result |
| --- | --- |
| `lib/homepageNewsCompatibility.test.tsx` | **50/50** (46 existing + 4 new) |
| Neighbour suites: newsFeed, tweetNewsAutomation, tweetPatternReview, tweetLunaReview (C2 Luna candidate) | **157/157** across 5 files |
| Scoped tsc (writer + test) | exit 0 |
| ESLint (2 files) | 0 errors; 1 pre-existing `no-img-element` warning in the test mock |
| Whole-project `tsc --noEmit -p tsconfig.json`, snapshot containing both C2 slices, 8 GB heap, under `/private/tmp/fhfh-heavy.lock` | **exit 0, 0 errors**. Lock taken free with noclobber at 16:26:32Z and released at 16:27:25Z; never stolen. `news-evidence/full-tsc-run.txt` |

What the new tests assert:

- **Admission:** a valid interpretation now survives to JSON and is admitted only by the **existing, unchanged** validator.
- **Validator still gates:** an interpretation with `unresolved` entries, or with evidence not bound to the blurb, still yields no claims.
- **Attribution unchanged:** source attribution is identical with and without the interpretation, and repeated sanitization is idempotent.
- **No leakage:** `rawLineageMarker` and `temporalReview` never reach the review row or the JSON, and the bare `metadata` column is not selected.
- **No stale data:** a later sync without an interpretation replaces the earlier one with `null`.

## Authority note (held)

- **The patch only restores data flow.** The public reader (`newsFeed.ts:42`) already treats `metadata.interpretation` as its versioned event contract, so this patch grants no new code-level authority.
- **But public claims could appear.** Once applied and re-synced, published homepage/news cards whose retained interpretation passes the strict validator would show claims, where they show "Claim unavailable" today.
- **Codex's position:** COMPATIBILITY-PROPOSAL says public admission should verify a trusted acceptance record rather than metadata alone, and the accepted-public producer/loader contract is held.
- **So, before integration, choose one:**
  - **(a)** Accept this patch as-is, meaning metadata.interpretation remains the public contract.
  - **(b)** Use an authority-neutral variant: same select, but the builders write `retainedInterpretation` instead of `interpretation`. That fixes the loss without anything reaching the public DTO, which keeps only `interpretation`/`lineupCard`/`automation.summary`. The public effect would wait for the loader contract.
- **Side effect to review:** `lib/newsLineupPresentation.ts:38` also reads `metadata.interpretation`. For lineup-category cards, retained `units` (including `units: []`) take precedence over a legacy `lineupCard`. Codex's DIAGNOSIS already calls this precedence a contract question. With (a) it becomes reachable. With (b) it does not.

## Not done / limits

- No historical repair: existing review/news rows change only on their next normal sync.
- No dedup. Duplicate-source identity is untouched.
- No live or production data. Whether live source rows actually hold interpretation is unknown.
- No browser run, build or full suite.
- C7 review needed.
