# C7 independent review — C2 ticket 3: NewsCard copy and duplicate-source identity

**Reviewer:** Claude C7 lane session (not the author). Read-only: no canonical edit, no Git, no server, no network, no production. Evidence is in `r9-evidence/c2-t3/`.

| Packet | Verdict |
| --- | --- |
| NEWS COPY (`C2-NEWS-COPY.patch` `ded81fc5…6a3`) | **Accepted.** Honest, plain copy. No validator, public-gate or layout change; badges stay suppressed. |
| NEWS DUP (`C2-NEWS-DUP-on-R1.patch` `5414faf0…355e`) | **Accepted as a proposal** (identity contract held). No text-equality dedup and no history repair, and the held question is stated correctly. Integration waits for the Codex/TJ contract decision. |

## Pins

- **Canonical, unchanged:**
  - `NewsCard.tsx` `29e36122…`, `NewsCard.test.tsx` `21f1e4fe…`
  - writer `tweet-pattern-review.ts` `0145984b…`, `homepageNewsCompatibility.test.tsx` `48321a8a…`
- **Scratch build:** canonical + R1 (writer `9c4f95ab…`, test `2c9c2e1f…`), then DUP, then COPY.
- **Results:** writer `376ccd81…`, test `7a19eabc…`, `NewsCard.tsx` `c517e65a…`, `NewsCard.test.tsx` `49afc689…`. All equal C2's tables.
- **Nit:** `git apply` warns that the DUP patch adds a blank line at EOF.

## Executed

**Candidate: 131/131 pass** (`t3.json`).
- homepageNewsCompatibility 56, NewsCard 39, newsFeed 30, tweetPatternReview 2. That is 127; C2's 56 and 39 are reproduced.
- My 4 controls.

**Base, with the R1 writer (pre-DUP) and the canonical `NewsCard.tsx`** (`t3-base.json`):
- homepageNewsCompatibility **3 failed**; this reproduces C2's DUP originals (linkless event + snapshot gives 2 identities; recovered post ID gives 2; identical-text events give 4).
- NewsCard **13 failed**; this reproduces C2's COPY originals (11 retained receipt cards + Barzal + valid-link control).
- My X2 failed as well (3 identities).

## NEWS COPY

- **The change:** one string. On non-lineup cards with `presentation.unresolvedReason`, the `<p>` now shows "We couldn't verify the player details in this report." instead of the reader's internal label "Subject-to-claim evidence unavailable".
  - Same condition (`!lineup && presentation.unresolvedReason`), same element, no class or markup change.
- **Honest:** the reader returns one reason for every fallback cause, so the copy claims nothing finer.
  - A verified-claim control shows its chip and **no** unverified copy.
  - Lineup cards never show it.
- **Untouched:**
  - the reader, its string (`newsFeed.ts`, still asserted in `newsFeed.test.ts`) and the claim validator/public gate;
  - attribution, "Original source pending" and the original-post link logic;
  - player/claim chip suppression (C2's retained-card test asserts no `Name · … report` chip).
- **Limit:** no screenshot. C2 notes a homepage render would need production reads. The change is text-only in an existing element, so I didn't run a browser either.

## NEWS DUP

**Mechanism.**
- The snapshot queries add `ifttt_event_id:metadata->>iftttEventId`.
- A map `eventTable:eventId → snapshot dedupe key` re-keys an IFTTT event candidate **only when the event has no post ID of its own**. The existing priority merge then keeps the snapshot.
- Text is never compared, and author and provenance fields are unchanged.

**Provenance is real and server-written.**
- `buildLinesCccSourceFromIftttEvent` sets `metadata.iftttEventId = event.id` (`linesCccIngestion.ts:1507`).
- It is used by `update-lines-ccc.ts` and by `update-line-sources.ts`, which spreads the candidate's metadata into `line_source_snapshots` (`:217`).
- `tweetClaimRegistry.ts:68` already treats it as lineage.
- Event candidates key on `source_table` `lines_ccc_ifttt_events` / `line_source_ifttt_events` with `source_row_key = row.id` (`tweet-pattern-review.ts:593-594,653-654`), which matches the map keys.

| C7 control | Result |
| --- | --- |
| X1 table scoping | A `lines_ccc` snapshot naming `evt-1` does **not** re-key a `line_source_ifttt_events` event `evt-1`: 2 identities. |
| X2 two snapshots naming one event | 2 identities, and the event joins one of them (the base gave 3). Which snapshot it joins depends on the order of the last map write. That is acceptable, since both snapshots are the same source. |
| X3 identical text, no provenance link | Stays 2 identities, so no text equality. |
| X4 the event's own post ID equals the snapshot's | 1 identity via the normal key. |

**No history repair:** future syncs only. Existing duplicate review and news rows are untouched (code and receipt).

**Held question, correctly stated.** "Whether recorded snapshot→event provenance may define review identity" is a contract decision for Codex/TJ. C2 also correctly leaves these as identity-contract questions with no change:
- cross-scope duplicates (e.g. `cccmiddleton` vs `line_source`);
- wrapper vs original post IDs;
- linkless rows with no recorded event link (only text could match those, and that's excluded).

**Limits:**
- An event whose snapshot falls outside the same sync batch (`perSourceLimit`) keeps its own key.
- The live cause of the homepage duplicates isn't proven: the receipt rows lack source-table keys, as C2 says.

## Ownership notes

- R1 and DUP both edit `web/lib/homepageNewsCompatibility.test.tsx`, which is outside C2's original lease. Integration needs that file owner's agreement.
- DUP must be applied **after** R1.
