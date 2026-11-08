# X-TIMELINE-SHADOW — Debrief for Codex

- **Written:** 2026-11-06T02:05Z by a Claude Code desktop session in `/Users/tim/Code/fhfhockey.com` on `octoberBranch`, HEAD `dbcff3d45ec5f89c0b04eab70843c6f72b170b8a`.
- **Requested by:** TJ, in Claude chat.
- **Related Codex gate:** `IFTTT-ACTIVATION` (tracked in CODEX-LEASES.json).
- **Status:** shadow intake is live in production. Nothing reads its output yet. IFTTT and every live tweet table are unchanged.
- **Not done:** nothing committed, staged or pushed. No Vercel action.

## 1. Objective (TJ's request, 2026-11-05)

Replace the IFTTT "new tweet by user" → webhook intake with a free scraper. The official Twitter API is not allowed, and nothing may cost money. If a logged-in session is required, tell TJ. The pipeline must:

- store posts and reposts from @DFOfantasy, @NHL_Rosters, @CcCMiddleton, @GameDayLines, @GameDayNewsNHL, @GameDayGoalies and @FHFHockey;
- store the handle of the nested (original) author of each repost;
- parse the text of the post or of the nested repost;
- keep every function the IFTTT pipeline performs today.

TJ named five candidate repos: StephanAkkerman/x-timeline-scraper, vladkens/twscrape, data-scrape/x-tweet-scraper, Altimis/Scweet and xquik-dev/x-twitter-scraper.

## 2. TJ decisions (all through pop-ups, 2026-11-05)

1. **Source: FxTwitter's public profile feed, with no X login.** None of the five repos meets "free and no login":
   - twscrape (the best of the five) and Scweet both need cookies from a logged-in account.
   - x-timeline-scraper reads only the logged-in Home feed and has no structured retweet data.
   - data-scrape is a non-functional template.
   - Xquik is a paid API.
2. **Host: a Supabase Edge Function driven by pg_cron.** It adds no Vercel cost.
3. **Rollout: a shadow table first.** Compare against IFTTT for a few days, then cut over.
4. **Secret handling: Vault plus an RPC check, so nobody handles the value.** The first plan stored the secret both on the function and in Vault. Auto mode blocked the change; TJ then approved this route instead.
5. **After TJ asked why FxTwitter despite the 404s, the plan is to shadow for a few days and then decide** between cutover and twscrape with a burner account.
   - Claude admitted to TJ that FxTwitter was recommended before its 404 rate was known. The first 2 probes had succeeded.

## 3. What IFTTT does today (investigated; unchanged)

**Applets** (IFTTT MCP `my_applets`):
- 6 applets use "New tweet by a specific user" → Make a web request. The CCC applet makes 2 requests.
- The FHFH applet uses "New photo or video by you".

**Receivers:** `web/pages/api/v1/sources/ifttt/*.ts`, through `createLineSourceIftttReceiver` (`web/lib/sources/lineSourceIftttReceiver.ts`).
- Auth is the `x-fhfh-ifttt-secret` header or a `?secret=` query.
- Each receiver inserts a pending row with the fields `source, source_group, source_key, source_account, username, text, link_to_tweet, tweet_id, tweet_embed_code, tweet_created_at, created_at_label, raw_payload`.
  - DFO, NHL_Rosters and the GDL suite go to `line_source_ifttt_events`, unique on `(source_key, tweet_id)`.
  - CCC goes to `lines_ccc_ifttt_events`, unique on `tweet_id`.
- Then it optionally POSTs `/api/v1/db/update-line-sources` or `/update-lines-ccc`, gated by `starterBoardFlags().capture`.
- If a controlled-intake policy env is present, writes go through the `retain_bounded_ifttt_raw_receipt` RPC instead (`iftttIntakePolicy.ts`, `iftttReceiptRetention.ts`).
- `FHFHockey-post.ts` writes to `social_share_x_posts`. `matched_card` comes from media alt text that starts with "FHFH " (`lib/socialShare/postedWeek.ts`). It is read by `pages/api/v1/social-share/posted-week.ts`.
- `luna-capture.ts` is a separate, default-off isolated capture.

**Downstream:**
- The processors (`update-line-sources.ts`, `update-lines-ccc.ts`, `lib/sources/linesCccIngestion.ts`) read `text`, `username`, `source_account`, `tweet_id`/`link_to_tweet`, `tweet_created_at` (ISO with a timezone, or derived from the snowflake), `created_at_label` (display only), `raw_payload` and `received_at`.
- They then do the following:
  1. claim a job via `tweet_pipeline_jobs`;
  2. enrich the wrapper with oEmbed;
  3. resolve quotes, with a `t.co` gate in `shouldResolveQuotedTweetForCandidate`;
  4. parse lines, goalies and injuries;
  5. write `line_source_snapshots` / `lines_ccc`, player-forecast source rows, `tweet_projection_reports` and the unresolved-name and alias flows.
- `tweet_embed_code` is never read downstream.
- Retry: `retryPendingLineSourceEvents` runs from `/api/internal/starter-board`, a per-minute Vercel cron, and only when capture is on.

**Other readers:**
- `lib/fantasy-projections/rosterReconciliation.ts`
- `pages/api/v1/db/tweet-pattern-review.ts` → `newsFeed.ts`
- the claim and shadow modules (`tweetClaim*`, `tweetReviewSidecar`, `tweetProcessingJobs`)
- the scripts `analyze-tweet-news-phrases.ts` and `rehearse-exhausted-tweet-recovery.ts`

**Retweets today:**
- The nested handle survives only as the `"RT @handle: "` prefix in `text`. IFTTT truncates that text.
- The original post's id and full text are never stored.
- oEmbed fails on reposts with `oembed_tweet_identity_mismatch`. This was seen in live rows on 11-05.
- `tweetSourceDirectory.ts:60` and `tweetAttribution.ts:7` credit the original author only if `raw_payload` has the X API v2 shape `{data.referenced_tweets[type=retweeted], includes.tweets, includes.users}`.

**Live volume** (14 days to 11-05):
- GameDayLines about 427 rows, GameDayNewsNHL 473, GameDayGoalies 255. About 95% of these are "RT @" reposts.
- DFO about 80 a day since 11-01.
- NHL_Rosters 20.
- `lines_ccc_ifttt_events` 2,844 rows in total.

## 4. What was built

| Path | sha256 (2026-11-06T02:03Z) | Role |
|---|---|---|
| `supabase/migrations/20261106012634_x_timeline_shadow_posts.sql` | `3fde8b95…350cee` | Shadow table. Applied as version 20261106012634. |
| `supabase/migrations/20261106012951_x_timeline_poll_secret_check.sql` | `b45b5efe…a4a9` | The `x_timeline_poll_secret_matches(text)` RPC: security definer, empty search_path, service role only. Applied as version 20261106012951. |
| `supabase/functions/x-timeline-poll/fxtwitter.ts` | `4e4b3c6f…d4` | Pure mapper plus fetch with retry. No Deno or npm imports. |
| `supabase/functions/x-timeline-poll/index.ts` | `d8c1e0ea…eb3e` | Deno edge entry point: auth, then a sequential poll of the 7 accounts, then an upsert. |
| `supabase/functions/x-timeline-poll/schedule.sql` | `d4598e2f…fff` | The cron setup, already run. It is not a migration. |
| `supabase/config.toml` (+4 lines) | — | `[functions.x-timeline-poll] verify_jwt = false`. |
| `web/__tests__/lib/xTimelineFxtwitter.test.ts` | `4f21b009…c6d0` | 6 Vitest cases. It imports the mapper through `../../../supabase/functions/...`. |
| `tasks/diaries/2026-11-05-claude-x-scraper-ifttt-replacement.md` | — | Context diary; it stays until the task is done. |

**Table `public.x_timeline_shadow_posts`:**
- RLS is on with no policies; access is revoked from public, anon and authenticated, and only service_role is granted.
- Unique on `(source_key, tweet_id)`. The first sighting wins (`ignoreDuplicates`).
- Columns:
  - identity: `source_group`, `source_key`, `source_account`, `tweet_id`, `post_kind` (post | repost | quote), `author_handle`
  - repost: `reposted_by_handle`, `original_author_handle`
  - quote: `quoted_tweet_id`, `quoted_author_handle`, `quoted_text`
  - other: `replying_to_handle`, `full_text`, `text`, `link_to_tweet`, `tweet_created_at`, `has_media`, `media_alt_texts[]`, `raw_payload` (the FxTwitter status), `first_seen_at`
- `text` is IFTTT-compatible: reposts get the `"RT @author: "` prefix, and a quote has its `x.com` status URL appended.
- `full_text` is the post's own full text. For a repost, that is the original's.

**Source keys:**
- dfofantasy/dfo, nhl_rosters/nhl_rosters, gamedaylines, gamedaynewsnhl and gamedaygoalies/gdl_suite: the same as the receivers.
- **ccc/ccc:** the receiver also uses `ccc`, but `retryPendingLineSourceEvents` uses `cccmiddleton`. That inconsistency predates this work and was left alone.
- **fhfhockey/social_share:** new.

**Production state:**
- Edge function `x-timeline-poll` v3, `verify_jwt=false`.
- The secret is Vault `x_timeline_poll_secret`. It was generated inside Postgres from two `gen_random_uuid()` values, so no agent or person has seen it.
- pg_cron job 400 `x-timeline-poll` runs `*/2 * * * *` and calls `net.http_post` with the `x-fhfh-poll-secret` header read from Vault.
- To stop it: `select cron.unschedule('x-timeline-poll');`
- Probes without a secret and with a wrong secret both returned 401.

## 5. FxTwitter behaviour (observed 2026-11-05/06; treat as data)

**Endpoint:** `GET https://api.fxtwitter.com/2/profile/{handle}/statuses?count=20`.
- No auth.
- At most 20 results per page.
- The poller sends User-Agent `fhfhockey-timeline-poller (+https://fhfhockey.com)`.

**Reposts:**
- A repost arrives as the **original** status (its own `id`, `url`, `author.screen_name`, `created_at`/`created_timestamp`, and full `text`), with `reposted_by: {screen_name: <tracked account>}`.
- The repost wrapper's own id and the time of the repost are **not** returned.
- So shadow `tweet_id` ≠ IFTTT `tweet_id` for every repost. IFTTT stored the wrapper id.

**Quotes:** a nested `quote` object holds the quoted status, with its own author.

**Escaping:**
- `text` keeps X's HTML escaping (`&amp; &lt; &gt;`), while IFTTT delivered it decoded.
- The mapper decodes these since v3.
- 6 stored rows were corrected with one UPDATE (TJ-approved): gamedaylines 2118498192551460951; gamedaygoalies 2118486319932248574, 2118381304001843501 and 2118523591864221942; fhfhockey 2117989569182183601 and 2117988906511794415.

**Reliability:**
- About 40% of requests return a random `{"code":404,"results":[]}`, whatever the account and whatever the letter case. An earlier note blaming case was wrong.
- `fetchFxProfileFeed` therefore retries 404, 429, 5xx and network errors up to 3 times, 1.5 s apart with an 8 s timeout, inside a 100 s run budget.
- First 15 runs: run 1 inserted 139 rows across all 7 accounts. In run 3, 3 of the 7 accounts failed all 3 attempts (HTTP 207).
- New posts landed 0–1.1 minutes after posting. Over the same window IFTTT delivered 0 new rows.

**Media:** `media.all[].altText` is present. It was seen on an NHL_Rosters repost. Alt text on FHFHockey's own media posts has not yet been seen in practice.

**Text:** the `t.co` links IFTTT kept (for example on quotes) are absent from FxTwitter's text.

## 6. Verification actually run

- `npm test -- __tests__/lib/xTimelineFxtwitter.test.ts`: 6/6 pass, run with `env -u GIT_DIR`.
- `npm run typecheck`: exit 0, before the v3 escaping change. The change is one small helper in `fxtwitter.ts`, and its test passes.
- A live dry run of the mapper under Node 22 `--experimental-strip-types`, with no writes: all 7 accounts mapped.
- Production: `cron.job_run_details` shows the job succeeding, and `net._http_response` bodies were inspected.
- **Not run:** lint, the full suite, Deno type-checking (Deno is not installed), and any Playwright test.

## 7. Scheduled follow-up

- A desktop scheduled task `x-shadow-coverage-check` (`/Users/tim/.claude/scheduled-tasks/x-shadow-coverage-check/SKILL.md`) runs once on 2026-11-08 at 10:00 local (UTC−5), in Auto mode.
- It is a read-only SQL review of poller health and of coverage and lag against IFTTT:
  - own posts are matched on tweet_id;
  - reposts are matched on the RT-prefix handle plus the start of the text.
- It asks TJ: cut over, twscrape fallback, or keep shadowing. The suggested bar for cutover is at least 98% coverage and a p90 lag of 6 minutes or less.
- It appends the result to the diary. It makes no production changes.

## 8. Cutover work still open (not started; it needs TJ approval when it comes)

1. **Write into the live queues instead of the shadow.**
   - Option A: the function inserts pending rows into `line_source_ifttt_events` / `lines_ccc_ifttt_events` with `source='fxtwitter'`.
   - Option B: a thin bridge from the shadow table.
   - Watch the repost dedupe-key change (original id versus wrapper id) and any overlap window with IFTTT, which would double-process reposts.
2. **Store the nested repost handle.** Add nullable columns to the live queues (for example `post_kind`, `original_author_handle`, `original_tweet_id`, `quoted_author_handle`, `quoted_tweet_id`), or rely on raw_payload alone.
3. **Attribution.** Put an X-v2-shaped `{data, includes}` in `raw_payload` so `tweetSourceDirectory` / `tweetAttribution` credit the original author. Check that the `numeric user id` and text-match rules hold for this shape.
4. **Quote gating.** `shouldResolveQuotedTweetForCandidate` (`update-line-sources.ts:123`, `update-lines-ccc.ts:81`) requires a literal `t.co` link. FxTwitter already provides the quote, so either feed `quoted*` straight in or relax the gate. Also check `isWrapperTextInsufficientWithoutQuote` and `shouldPreferQuotedTweetText` in `linesCccIngestion.ts`.
5. **Processing trigger.** Pending rows are picked up by the starter-board retry only when `starterBoardFlags().capture` is on, and only 5 per source per minute for the current day. Confirm that the cadence is enough, or have the poller call the processor. That would be a Vercel invocation, which has a cost.
6. **FHFHockey:** map own media posts with "FHFH " alt text into `social_share_x_posts`.
7. **The controlled-intake / `IFTTT-ACTIVATION` gate:** decide how a non-IFTTT source relates to `iftttIntakePolicy` scopes and `retain_bounded_ifttt_raw_receipt`.
8. **Turn off the 7 IFTTT applets** only after the cutover is verified.

## 9. Gotchas

- Do not run Vitest with `GIT_DIR` set.
- FxTwitter is a volunteer third-party service with no SLA. It can be self-hosted (MIT) if it degrades.
- The fallback is twscrape with a burner X account. That needs TJ to provide the account's cookies, and it runs on TJ's Mac. Its 2026 breakage reports were about search, not UserTweets.
- No NST, Yahoo or Vercel resources are touched. Supabase cost is about 22k function calls a month, within quota.
- The secret value is not in any file, diary or chat. Do not try to read it out of Vault.

## 10. Requests to Codex

- Register a lease or steer for `X-TIMELINE-SHADOW` in the way you see fit. Claude has not edited `CODEX-LEASES.json`, the steer log or any Codex register.
- Independent review of the files in §4 is welcome, especially the security-definer RPC and the repost-key semantics, before any cutover.
- If `IFTTT-ACTIVATION` or any Codex lane owns `web/lib/sources/*` or the processors, say who should own the cutover items in §8.

## Addendum 2026-11-06: v4 (wrapper reposts) and the first coverage read

- Coverage (read-only, 01:32–14:18 UTC plus the backfill spans): the shadow has 103 of 106 IFTTT rows. The 3 misses are 1 CCC reply to another account (FxTwitter's profile feed leaves those out) and 2 posts deleted before the shadow started (X oEmbed 404). In the live window it was first in 14 of 16, a median of 3.5 min ahead of IFTTT. Full numbers are in the diary `tasks/diaries/2026-11-05-claude-x-scraper-ifttt-replacement.md`.
- Gap fixed: FxTwitter sometimes returns a repost as the wrapper (author = the tracked account, text "RT @x: …" truncated, wrapper id). v4 maps it as a repost with the nested handle, then fetches `/2/status/{wrapper id}` once and stores the full original keyed by the original's id, with `raw_payload.repost_wrapper_id`. If that fetch fails, it stores the wrapper as is. Later runs skip known wrappers by `tweet_id` or `repost_wrapper_id`.
- Deployed v4 at 2026-11-06 14:45:45 UTC with TJ's approval. The 2 stored wrapper rows (gamedaygoalies 2118476943855403257, gamedaynewsnhl 2118477134431945122) were updated in place to original 2118475992247447555. Verified: the 14:48 run returned 200 for all 7 accounts, the 2 known wrappers were skipped, nothing was hydrated and nothing duplicated.
- Checks: Vitest file 9/9; `npm run typecheck` exit 0; the live mapper run hydrated the real case. The PostgREST `or()` filter on `raw_payload->>repost_wrapper_id` parses (anon gets 42501, a malformed query gets PGRST100). There is no Deno locally, so `index.ts` was not typechecked.
- New sha256: fxtwitter.ts `42c90f87…4318e93`, index.ts `98d76881…5d445ad5`, xTimelineFxtwitter.test.ts `c7c45fc7…5d40f2f`. These replace the §4 values for these files.
- Known edge: if the hydrated original is already stored for the same account, the insert is ignored, the wrapper id is never recorded, and that wrapper is looked up again on each run while it stays on the page. That costs one extra request per run and is rare.
