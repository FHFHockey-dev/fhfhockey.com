# C2 receipt: NEWS-PUBLIC-UNVERIFIED-COPY-20261024 (isolated candidate)

- **Lane and grant:** C2 (Claude session `local_d396b1e2…`). Grant `CODEX-C2-NEWS-COPY-20261024` (CODEX-20261024-022 and -024), two files, isolated candidate only.
- **Status:** candidate patch only. It is not self-certified, and C7 review is next.
- **What did not happen:** no reader, validator or public-gate change, no homepage layout change, no metadata-proposal integration, no canonical write, no Git, no production access, no network access.

## Base and pins

- **HEAD:** `2a5092d37`.
- **Baselines:** canonical and snapshot were both verified before editing, and both match the grant. No competing declared writer was found in CLAUDE-/CODEX-LEASES.

| File (web/) | Canonical (unchanged) | Candidate |
| --- | --- | --- |
| components/NewsFeed/NewsCard.tsx | 29e36122471afc47cc85fd5678d528ee3b68338b5e0836bbc63579cb80f3315d | c517e65adab1bb1b76097f7ac403f3f4d4781ae5b46f204aba334dc4c4d627c7 |
| components/NewsFeed/NewsCard.test.tsx | 21f1e4feaa47763690c224d51d8710821dbd6d1dd4827f0c9566c679cde28591 | 49afc689051a6f097f3edf4edd43827f2fe474ecad1cb7b7b4df63e87bcc6170 |

- **Patch:** `C2-NEWS-COPY.patch`, sha256 `ded81fc5afb8ba7d7e935b51ad98539b45bc008d68e16b315256e7506e2e86a3`.
  - +46/−2.
  - `git apply --check` against canonical passes (check only).
  - It is independent of the metadata patches; R1 touches different files.

## Change

- **Before:** `NewsCard.tsx` rendered the reader's internal `presentation.unresolvedReason` ("Subject-to-claim evidence unavailable") verbatim on non-lineup cards.
- **After:** the same condition renders `We couldn't verify the player details in this report.` in the same `<p>`.
  - The condition is unchanged: `!lineup && presentation.unresolvedReason`.
  - No markup, class or layout change.
- **Why one message:** the reader returns a single reason for every fallback. That covers a missing or empty interpretation, unresolved entries, and any failed player/state/modality/evidence check. So the card claims no finer cause.
- **Unchanged:**
  - the reader string in `newsFeed.ts` (still asserted by `newsFeed.test.ts:242`);
  - the generic "Source report" heading and the safe passage (`getPublicNewsItemDetails`);
  - attribution and "Original source pending";
  - suppression of player/claim chips;
  - lineup cards.
- **Original-post link:** still rendered only when `getPublicNewsSourceAttribution(...).url` is set. The new copy does not mention the link, so no dead action is implied when it is absent.

## Reproduction (retained sanitized fixtures)

- **Fixtures:**
  - The existing captured Barzal card in `NewsCard.test.tsx` (id `cac51da7…`).
  - The 11 rows of the retained sanitized receipt `lib/sources/fixtures/homepageNewsReceipt.json`, run through `sanitizePublicNewsFeedItem` and then `NewsCard`.
- **Unmodified card:** **13 failed / 26 passed (39)** (`news-copy-evidence/card-tests-before-fix.log`).
  - All 11 retained cards plus Barzal show the jargon instead of plain copy.
  - The valid-link control also fails, because its copy is missing.
- **Candidate:** **39/39** (`card-tests-after-fix.log`).

New assertions:

- **Each retained card:**
  - heading "Source report";
  - the plain copy exactly once;
  - no "subject-to-claim"/"claim evidence" text;
  - the passage is visible;
  - no `Name · … report` player chip;
  - the original-post link `href` equals the reader's attribution URL, or the link is absent.
  - All 11 receipt rows are in the no-link branch (ID-only `i/web` URLs; `card-link-branches.log`).
- **Valid-link control:** a valid direct-author URL keeps its original-post link next to the copy.
- **Verified-claim control:** a card the reader verifies shows its chip and **no** unverified copy, so the copy follows the actual state.
- **Lineup cards:** never show the copy.

## Checks

| Check | Result |
| --- | --- |
| NewsCard suite (jsdom, repo setup, `env -i`, network guard, one fork worker, scratch cache) | 39/39 |
| Neighbours: all `components/HomePage/*.test.tsx`, homepageNewsCompatibility, newsFeed, tweetNewsAutomation, tweetPatternReview, tweetLunaReview | **251/251** across 12 files |
| ESLint (2 files) | exit 0 |
| Scoped tsc (2 files) | exit 0 |
| Whole-project `tsc --noEmit` (snapshot with all C2 candidates, under the heavy lock 17:46:20–17:47:19Z) | **exit 0, 0 errors** (`news-copy-evidence/full-tsc-run.txt`) |

## Limits

- **Screenshot:** none. The change is text-only, in an existing element. Rendering the homepage from the snapshot would need production Supabase/NHL reads, which are not authorized.
- **Other label:** the homepage injuries table has its own "Claim unavailable" label (`HomepageStandingsInjuriesSection.tsx`). It is outside this grant and unchanged.
- **TJ's row:** not identified. No production read was made, so which check failed for that row is unknown. The copy is accurate for every fallback cause.
