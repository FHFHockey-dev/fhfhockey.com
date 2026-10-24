# C2 receipt: NEWS-SOURCE-PRESENTATION duplicate-source identity (isolated proposal)

- **Lane and ID:** C2 (Claude session `local_d396b1e2…`). NEWS-SOURCE-PRESENTATION follow-up 3 of 3: duplicate-source identity.
- **Status:** reproduced. The smallest identity-consumer fix is a **proposal** in the snapshot. It is not self-certified, and C7 review is next.
- **Held decision:** whether recorded snapshot→event provenance may define review identity is a contract decision for Codex/TJ before integration.
- **What did not happen:** no text-equality dedup, no historical repair or re-keying of existing rows, no schema, reader, homepage or validator change, no canonical write, no Git, no production access, no network access.

## Base and pins

- **Base:** this patch is a **delta on top of R1** (`C2-NEWS-METADATA-R1.patch`), because both touch the same two files.
  - Patch: `C2-NEWS-DUP-on-R1.patch`, sha256 `5414faf07b5715df2a544b73cba9708e91c6b7f475eb10ed7310d7145fc4355e`, +68/−13.
  - Base hashes are the R1 candidates: writer `9c4f95ab…`, test `2c9c2e1f…`.
  - Applying canonical + R1 + DUP was checked with `patch` in scratch; the result is byte-identical to the snapshot for both files.
- **Canonical, read-only and unchanged:** writer `0145984b…`, test `48321a8a…`.
- **Lease note:** like R1, this touches `web/lib/homepageNewsCompatibility.test.tsx`, which is outside C2's original lease list (snapshot only).

| File (web/) | R1 base | DUP candidate |
| --- | --- | --- |
| pages/api/v1/db/tweet-pattern-review.ts | 9c4f95ab… | 376ccd819d810c2203f2a349faf83836a32e480694f4b020d8cb23891f86609e |
| lib/homepageNewsCompatibility.test.tsx | 2c9c2e1f… | 7a19eabc5ca165217d93ba38ac11bf7cae99aac341cae5315e18fbbbf3d286d7 |

## Finding

- **Identity rule:** a review item's identity is `${sourceScope}:${tweetId ?? statusIdFromUrl ?? sourceRowKey}` (`tweetPatternReview.ts:282`).
- **The sync already expects collapsing:** when a snapshot and its event share a key, the snapshot wins (priority 4 over 1).
- **But linkless events don't collapse:** an IFTTT event with no post ID or status URL keys on its own row ID. The snapshot built from it (`buildLinesCccSourceFromIftttEvent`) keys on its capture key or a later-recovered post ID.
- **The link exists but is unused:** that snapshot records `metadata.iftttEventId = event.id` (`linesCccIngestion.ts:1507`) and takes `observed_at = event.received_at`. `tweetClaimRegistry.ts:68` already treats `iftttEventId` as source lineage. The review sync ignores it, so one capture produces **two review identities**, then two news projections.
- **Match with the receipt:** the retained homepage receipt shows exactly this signature. Several projections share one exact `observed_at`, with one carrying a post ID and the others linkless:
  - Marner, 23:33:15;
  - Edmonton ×3, 16:57:27;
  - Pittsburgh ×3, 15:53:24.
- **What the receipt can't show:** its rows carry no source-table or row keys, so it cannot prove this path was the live cause. That needs retained source rows, which I did not query.

## Original failure (R1 writer, synthetic rows)

`news-dup-evidence/dup-tests-r1-writer.log`: **3 failed / 53 passed (56).**

- A linkless `line_source_ifttt_events` row plus the `line_source_snapshots` row naming it → **2** review identities (expected 1).
- Same, but the snapshot recovered post ID `2113311716893463008` → **2** identities (expected only `gamedaynewsnhl:2113311716893463008`).
- Two distinct events with **identical text**, each with its snapshot → **4** identities (expected 2).

Controls that pass both before and after:

- an event carrying its own, different post ID stays separate (no conflation);
- an event that no snapshot names keeps its own key.

## Proposed correction (smallest, consumer only)

- **Query:** the two snapshot queries select `ifttt_event_id:metadata->>iftttEventId`, the same JSON-path idiom as R1. The row types gain that field.
- **Mapping:** `syncTweetPatternReviewItems` builds `eventTable:eventId → snapshot dedupe key` from the fetched snapshots:
  - `lines_ccc` ↔ `lines_ccc_ifttt_events`;
  - `line_source_snapshots` ↔ `line_source_ifttt_events`.
- **Re-keying rule:** an event candidate takes its snapshot's key **only if the event has no post ID of its own** (`tweet_id ?? statusIdFromUrl(tweet_url)`). The existing priority merge then keeps the snapshot.
- **Unchanged:**
  - candidate order and merge rules;
  - author and provenance fields (the snapshot candidate is used as-is; the event row stays in its table);
  - text is never compared.
- **Scope:** future syncs only. Existing duplicate review and news rows stay as they are. An event whose snapshot falls outside the same sync batch (`perSourceLimit`) keeps its own key, as today.

## Checks (snapshot = Luna + R1 + DUP + NewsCard copy)

| Check | Result |
| --- | --- |
| homepageNewsCompatibility (56) | **56/56** (`dup-tests-dup-writer.log`) |
| Neighbours: NewsCard, all HomePage tests, newsFeed, tweetNewsAutomation, tweetPatternReview, tweetLunaReview, tweetClaimRegistry, lineSource*, linesCcc* | **352 passed, 15 skipped / 367** across 18 files. The skips are `tweetClaimRegistry`'s disposable-Postgres block (`describe.runIf(IFTTT_POSTGRES_BIN)`) |
| ESLint (2 files) | 0 errors; 1 pre-existing `no-img-element` warning |
| Scoped tsc (writer + test) | exit 0 |
| **Whole-project** `tsc --noEmit -p tsconfig.json`, 8 GB heap, under `/private/tmp/fhfh-heavy.lock` | **exit 0, 0 errors**. Lock taken free with noclobber at 17:46:20Z and released at 17:47:19Z; never stolen. `news-dup-evidence/full-tsc-run.txt` |

## Not covered / held

- **Other duplicate shapes:** same post captured under **different source scopes** (e.g. `cccmiddleton` vs a `line_source` key), wrapper versus original post IDs, and linkless records with no recorded event linkage. These still produce separate identities.
  - The first two are identity-contract questions: which post or scope is the identity.
  - The last can only be matched by text, which is excluded.
  - No change proposed.
- **Existing rows:** existing duplicate projections need historical repair, which is out of scope.
- **Not run:** no live data, browser or full suite. C7 review is needed.
