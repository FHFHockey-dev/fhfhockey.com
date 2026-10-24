# C7 independent review — NEWS-SOURCE-PRESENTATION R1 (C2 variant (b), authority-neutral)

**Reviewer:** Claude C7 lane session (not the author). Read-only: no canonical edit, no Git, no server, no network, no production. Evidence is in `r5-evidence/news-r1/`.

**Verdict: accepted.** The sync metadata loss is fixed for review storage, and public output is unchanged. Two notes:

- No claim authority is granted.
- Integration still needs agreement from the owner of `homepageNewsCompatibility.test.tsx`, because C2's lease didn't include that file. C2 discloses this.

## Pins

- **Patch:** `C2-NEWS-METADATA-R1.patch` `c7f29a2c…e04e`, which matches.
- **Scratch baselines** (my own rsync of the canonical working tree):
  - `tweet-pattern-review.ts` `0145984b…`
  - `homepageNewsCompatibility.test.tsx` `48321a8a…`
  - `newsFeed.ts` `de831779…`
  - `newsLineupPresentation.ts` `96aea921…`

  All match C2's receipt.
- **After `git apply`:** writer `9c4f95ab…`, test `2c9c2e1f…`. Both match.

## Original failures, reproduced

I ran the R1 test file with the **canonical** writer swapped back in (`0145984b…`). Of 51 tests in `homepageNewsCompatibility.test.tsx`, **5 fail** (the orchestrator expected 4; C2 reported 5):

- "preserves the retained … interpretation" for `lines_ccc` and for `line_source_snapshots`;
- "leaves every public … view" for both tables;
- "does not keep an earlier retained" interpretation.

My N2 control fails the same way on the base: the review row lacks `retainedInterpretation`.

## After R1: 115/115 pass

- homepageNewsCompatibility: 51.
- newsFeed: 30.
- tweetNewsAutomation: 29.
- tweetPatternReview: 2.
- C7 controls: 3.

Together with C2's Luna file this reproduces C2's 158. All runs used the offline guard, with the cache in scratch.

## Authority and public byte identity: independently traced

- **Writer:** it selects only the `interpretation:metadata->interpretation` JSON subtree and writes it as `retainedInterpretation` in review metadata. The automation candidate carries that key into `news_feed_items.metadata`, which is **storage only**: my N2 shows `retainedInterpretation` among the candidate's metadata keys.
- **Public loader:** `sanitizePublicNewsFeedItem` (`newsFeed.ts:472`) is an **allowlist**. It emits only `interpretation`, `lineupCard` and `automation.summary`.
- **Readers of `news_feed_items` in source:**
  - the automation writer;
  - the admin-only editor (`news-feed-items.ts`, `adminOnly`);
  - `fetchNewsFeedItems`, which is sanitized;
  - `fetchLatestPlayerNewsFlags`.

  The last one feeds the **raw, unsanitized** row into `getPublicNewsClaimPresentation`. The owner's tests don't cover this path, so I added N1/N2.
- **Presentation functions:** `getPublicNewsClaimPresentation` and `newsLineupPresentation` read only `metadata.interpretation` and `metadata.lineupCard`. Nothing in `web/` reads a `retainedInterpretation` metadata key; the only `rg` hit is an unrelated local variable in `tweetSourceClaimRegistry.ts`.

| C7 control | Result |
| --- | --- |
| N1: raw player-flags path, item metadata `{retainedInterpretation: <validator-passing Hedman event>}` | **0 flags**. Sensitivity check: the same object under `interpretation` gives 1 flag, so the path is live. |
| N2 ×2: real R1 writer → `buildTweetNewsAutomationCandidate` → news item → `fetchLatestPlayerNewsFlags` and `fetchNewsFeedItems`, for `lines_ccc` and `line_source_snapshots` | The review keeps the interpretation. **0 player flags.** The public JSON contains neither `retainedInterpretation` nor `rawLineageMarker`, and no claim. |

C2's own byte-identity tests (DTO, re-sanitized DTO, claim presentation, lineup presentation, homepage row) pass. C2's cross-writer dump (2,192 bytes, identical) is their evidence; I didn't rerun it.

## Limits

- **Admin visibility:** `retainedInterpretation` now sits in `news_feed_items.metadata` storage, where admin tooling that shows raw metadata can see it. This is by design.
- **Not done:** no historical repair (rows gain the key only on their next sync), no dedup, and no live data check of whether real source rows hold an interpretation.
- **Not run:** browser, build or full suite.
- **Switching later:** variant (a) remains a one-key rename, and adopting it would be a deliberate public-contract decision.
