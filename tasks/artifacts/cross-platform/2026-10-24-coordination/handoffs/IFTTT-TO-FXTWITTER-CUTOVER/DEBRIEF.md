# IFTTT → FxTwitter cutover: explainer and scaffolding plan for Codex

- **Written:** 2026-11-06 by Claude Code (desktop) in `/Users/tim/Code/fhfhockey.com` on `octoberBranch`, HEAD `85f2b2b704b9987e822c0801e56c2ac55febc224`.
- **Requested by:** TJ, in Claude chat: *"I am planning to get rid of the IFTTT pipeline, and we need to start scaffolding and implementing a shift to use the newly implemented twitter scraper instead of the IFTTT reliance."*
- **Companion document:** `handoffs/X-TIMELINE-SHADOW/DEBRIEF.md`, which records how the scraper was built, the decisions behind it, its file hashes, and the v4 addendum. This document does not repeat it. It explains how the two pipelines differ and lays out how to move every IFTTT job onto the scraper.
- **Related Codex gate:** `IFTTT-ACTIVATION`.
- **Status:**
  - The scraper runs in production in **shadow mode only**. Nothing downstream reads it, apart from the new swipe trainer, which only reads it.
  - IFTTT is still the live intake.
  - Nothing in this plan has been implemented.
- **Not committed:** none of the scraper files are committed. That includes `supabase/functions/x-timeline-poll/*`, the two `supabase/migrations/202611060*` files, the `supabase/config.toml` edit and `web/__tests__/lib/xTimelineFxtwitter.test.ts`. They exist only as uncommitted changes in the canonical checkout, so check `git status` before you rely on them.

---

## 1. The short version

The live pipeline is: **IFTTT applet → a webhook route per account → a pending row in a queue table → a processor parses it → snapshots, lines, goalies, injuries, forecasts.**

The scraper already does the first step better:
- it posts no later than IFTTT, and usually earlier;
- it has the full text;
- it has the original author of each repost;
- it has the quoted post;
- it costs nothing, and needs no login and no Twitter API.

The cutover is therefore a **change of intake only**. The scraper should insert the same pending rows into the **same queue tables**, so that everything downstream of the queue stays as it is.

The recommended approach is per account, behind a switch kept in the database. Each account moves from `ifttt` to `fxtwitter` on its own, can be rolled back the same way, and has its IFTTT applet turned off only after it is verified.

## 2. Why FxTwitter (the decision, briefly)

- **Rejected:** TJ's five candidate repos.
  - twscrape and Scweet need cookies from a logged-in X account.
  - x-timeline-scraper reads only the logged-in Home feed.
  - data-scrape doesn't work.
  - Xquik is paid.
- **The official X API is ruled out by TJ.**
- **FxTwitter's public JSON API** (`api.fxtwitter.com`) needs no login and has no cost. It returns structured repost and quote data: the original's id, author, full text and time.
- **Its weakness is reliability.** It has no SLA, and about 40% of requests come back as a random 404. Retries hide most of that, and after retries 6.7–13.3% of account reads per run still fail. Because each run reads a 20-post page, a missed run is recovered on the next one.
- **Fallbacks:**
  - self-host FxTwitter, which is MIT-licensed;
  - twscrape with a burner account, which needs TJ to supply cookies and would run on TJ's Mac.

**Shadow results so far:**
- **Coverage:** 103 of 106 rows checked against IFTTT. The 3 misses are 1 reply to another account and 2 posts that were deleted before the shadow started.
- **Speed:** in the live window the shadow was **first in 14 of 16** cases, a median of 3.5 minutes ahead of IFTTT.
- **Own posts:** they land about 0.8 minutes after posting, against about 3.3 minutes for IFTTT.

A scheduled read-only check on **2026-11-08 at 10:00 local** measures coverage and lag again, then asks TJ whether to cut over. The suggested bar is coverage of at least 98% with a p90 lag of 6 minutes or less.

## 3. How each pipeline works

### 3a. IFTTT today

```
X post ──► IFTTT applet ("New tweet by a specific user", 6 applets; FHFH: "New photo or video by you")
             │  POST JSON {text, UserName, LinkToTweet, CreatedAt, TweetEmbedCode} + x-fhfh-ifttt-secret
             ▼
web/pages/api/v1/sources/ifttt/<Account>-tweet.ts   (Vercel function, one per account)
  → createLineSourceIftttReceiver (web/lib/sources/lineSourceIftttReceiver.ts:218)
      • controlled-intake policy? → retain_bounded_ifttt_raw_receipt RPC (iftttIntakePolicy.ts, iftttReceiptRetention.ts)
      • else upsert pending row (source='ifttt') into
          line_source_ifttt_events  (DFO, NHL_Rosters, GDL suite; unique source_key,tweet_id)
          lines_ccc_ifttt_events    (CCC; unique tweet_id; no source_key/source_group columns)
      • if starterBoardFlags().capture → POST /api/v1/db/update-line-sources | update-lines-ccc (immediate)
             ▼
Safety net: Vercel cron /api/internal/starter-board (every minute) → retryPendingLineSourceEvents()
  (lineSourceIftttReceiver.ts:143): ≤5 pending rows per source, current Eastern day by received_at,
  skipped entirely when iftttIntakePilotConfigured()
             ▼
Processors: update-line-sources.ts / update-lines-ccc.ts + lib/sources/linesCccIngestion.ts
  claim job (tweet_pipeline_jobs, key ingest:<table>:<id>) → oEmbed enrich → quote resolve (t.co gate)
  → legacy classify + interpretation parse (TWEET_PIPELINE_INTERPRETATION_ENABLED=true in prod)
  → line_source_snapshots / lines_ccc, player-forecast sources, tweet_projection_reports,
    unresolved names → alias flow, claim registry / review sidecar

FHFHockey: ifttt/FHFHockey-post.ts → social_share_x_posts (matched_card from media alt text "FHFH …")
```

**Known IFTTT weaknesses that the cutover removes:**
- A repost arrives only as truncated text starting "RT @x: …".
- The original's id and full text are never stored.
- oEmbed fails on reposts with `oembed_tweet_identity_mismatch`.
- Repost attribution works only when `raw_payload` has the X v2 shape, and IFTTT never sends that shape.

### 3b. FxTwitter today (shadow)

```
pg_cron job 400 'x-timeline-poll' */2 * * * *  → net.http_post (secret from Vault 'x_timeline_poll_secret')
             ▼
Supabase Edge Function x-timeline-poll v4 (supabase/functions/x-timeline-poll/index.ts)
  for each of 7 accounts, sequential, 100 s budget:
    GET api.fxtwitter.com/2/profile/{handle}/statuses?count=20   (retry 404/429/5xx ×3)
    mapFxProfileFeed → rows   (fxtwitter.ts, pure, Vitest-tested from web/)
    wrapper-form reposts → GET /2/status/{id} once → full original (v4)
    upsert x_timeline_shadow_posts on (source_key, tweet_id), ignoreDuplicates (first sighting wins)
```

`x_timeline_shadow_posts` is readable by the service role only. Its rows hold:
- `post_kind` (post, repost or quote) and `author_handle`;
- for reposts, `reposted_by_handle` and `original_author_handle`;
- for quotes, `quoted_tweet_id`, `quoted_author_handle` and `quoted_text`;
- `replying_to_handle`;
- `full_text`, the clean text;
- `text`, an IFTTT-compatible version: `"RT @author: "` added to reposts, and the quote's `x.com` URL appended;
- `link_to_tweet`, `tweet_created_at` (ISO, with timezone), `has_media` and `media_alt_texts[]`;
- `raw_payload`, the FxTwitter status (wrapper reposts also carry `repost_wrapper_id`);
- `first_seen_at`.

**Volumes:**
- **IFTTT queues, last 7 days:** DFO 344 rows, GameDayNewsNHL 239, CCC 223, GameDayLines 195, GameDayGoalies 119, NHL_Rosters 27.
- **Shadow table:** about 205 rows since 2026-11-06 01:32 UTC, including the first run's backfill of 139.

## 4. Field-by-field: IFTTT queue row ← shadow row

| Queue column | IFTTT value today | From the scraper | Notes |
|---|---|---|---|
| `source` | `'ifttt'` (default) | `'fxtwitter'` | Nothing filters on this value today. `newsFeed.ts:180` only lists `"ifttt"` among relay labels. |
| `source_group`, `source_key` | from the route config | `source_group`, `source_key` | Same keys. The CCC table has neither column. |
| `source_account` | config or body | `source_account` | |
| `username` | IFTTT `UserName` | `source_account` | |
| `text` | IFTTT text: reposts truncated to "RT @x: …" | `text` | Full text with the IFTTT-style prefix. Parsers strip `RT @x:` themselves. |
| `link_to_tweet` | the **wrapper** URL for reposts | `link_to_tweet` (the **original's** URL) | oEmbed on the original works, where it failed on the wrapper. |
| `tweet_id` | the **wrapper** id for reposts | `tweet_id` (the **original's** id) | **This changes the dedupe key.** See §6.1. |
| `tweet_created_at` | the wrapper's time | the **original's** time | FxTwitter does not give the time of the repost. Processors pick rows by `received_at`, so an old original is still processed. |
| `created_at_label` | IFTTT `CreatedAt` | formatted `tweet_created_at` | Display only. |
| `tweet_embed_code` | IFTTT embed | `null` | Nothing downstream reads it. |
| `raw_payload` | the IFTTT body | `{provider:'fxtwitter', fx:<status>, data, includes}` | Build the X-v2-shaped `data` and `includes` so repost attribution works. See §6.3. |
| `received_at` | `now()` | `now()` at enqueue | Drives the processors' current-day window. |
| `processing_status` | `'pending'` | `'pending'` | |

## 5. Every IFTTT touchpoint, and whether the cutover changes it

If the queue tables are reused (recommended), most code needs **no change**: it is keyed on the table names, not on IFTTT.

| Area | Files | Needs a change? |
|---|---|---|
| Receivers | `web/pages/api/v1/sources/ifttt/{DFOFantasy,NHL-Rosters,ccc,gamedaylines,gamedaygoalies,gamedaynewsnhl}-tweet.ts`, `lineSourceIftttReceiver.ts` | **Yes:** honour the per-account switch, and acknowledge without inserting once an account is switched. Delete them in the final phase. |
| FHFH | `ifttt/FHFHockey-post.ts`, `lib/socialShare/postedWeek.ts` → `social_share_x_posts`; read by `api/v1/social-share/posted-week.ts` | **Yes:** a scraper-fed writer. See §6.6. |
| Luna capture | `ifttt/luna-capture.ts`, `lib/sources/lunaHosted/*`, `api/internal/luna-*` | It is off by default and isolated. Decide whether to retire it or point it at the scraper; this belongs to the Codex Luna lane. |
| Controlled intake | `iftttIntakePolicy.ts`, `iftttReceiptRetention.ts`, RPC `retain_bounded_ifttt_raw_receipt` | **Decide.** Does `IFTTT-ACTIVATION` still apply to the scraper? While a pilot is configured, `retryPendingLineSourceEvents` processes **nothing**. |
| Retry / trigger | `retryPendingLineSourceEvents` (`lineSourceIftttReceiver.ts:143`), cron `/api/internal/starter-board` | No change needed if the scraper only enqueues. It already picks up pending rows every minute when `STARTER_BOARD_CAPTURE_ENABLED` is on. Pre-existing quirk: it passes `sourceKey: "cccmiddleton"`, while the CCC queue has no `source_key` column. |
| Processors | `api/v1/db/update-line-sources.ts`, `update-lines-ccc.ts`, `lib/sources/linesCccIngestion.ts` | **Small changes:** relax the quote gate (§6.4). Optionally skip oEmbed when the scraper already supplies full text. |
| Attribution | `tweetSourceDirectory.ts` (`tweetClaimAttribution`, around line 60), `tweetAttribution.ts:7` | No change if `raw_payload` carries the v2 shape (§6.3). Otherwise extend them to read `raw_payload.fx`. |
| Jobs / claims / review | `tweetProcessingJobs.ts`, `tweetClaimRegistry.ts`, `tweetClaimEvaluationIntake.ts`, `tweetClaimRawAcknowledgment.ts`, `tweetReviewSidecar*.ts`, the SQL check `raw_table in ('line_source_ifttt_events','lines_ccc_ifttt_events')` | **No change** if the table names stay. Renaming the tables would touch all of these, the job keys `ingest:<table>:<id>` and the SQL constraints, so don't rename them. |
| Readers | `lib/fantasy-projections/{rosterReconciliation,admin,readiness,rosterIntegrity}.ts`, `lib/newsFeed.ts`, `api/v1/db/tweet-pattern-review.ts`, `api/v1/db/replay-player-aliases.ts`, `api/v1/player-forecasts/jobs/season-roster.ts`, `lib/player-forecasts/currentRosterInjuryEvidence.ts` (`provider:"ifttt"` is an evidence label, not the queue column) | No change if the tables stay. Re-check any code that counts rows by `source='ifttt'` (none found). |
| Swipe trainer (new, uncommitted) | `lib/sources/tweetSwipeTrainerServer.ts` reads `x_timeline_shadow_posts` | No change. |
| Scripts | `scripts/analyze-tweet-news-phrases.ts`, `rehearse-exhausted-tweet-recovery.ts`, `forge-producer-closure.ts` | No change. |
| Generated types | `lib/supabase/database-generated.types.ts` | Regenerate only if a migration adds tables or columns. |

## 6. Design decisions and gotchas the implementation must handle

### 6.1 Dedupe across the switch (the main risk)

For reposts, IFTTT stored the wrapper's id, while the scraper stores the original's id. If both pipelines write to the same queue for the same account, every repost is **processed twice**.

The fix:
- At any moment, each account has exactly **one active provider**.
- The scraper enqueues **only first sightings made after the account's `switched_at`**. That means shadow rows it has just inserted (the upsert should `select()` the inserted rows). Posts seen before the switch came in through IFTTT already.
- The shadow table works as the dedupe ledger and as a replay log.

### 6.2 Per-account provider switch (needs a migration, which needs TJ's approval)

Suggested table:

`tweet_intake_providers(source_key text primary key, provider text check (provider in ('ifttt','fxtwitter')), switched_at timestamptz, note text)`

- Access: the service role only, with RLS on and no policies, like the shadow table.
- **Seed:** all 7 accounts as `ifttt`.
- **The scraper** reads it at the start of each run.
- **The receiver** reads it on each webhook. For a switched account it returns `200 {ignored:"provider_fxtwitter"}`, so IFTTT does not retry or flag errors.
- Switching an account, or rolling it back, is then a one-row update. No Vercel env change or redeploy is needed. Env changes are risky here: unchanged-code redeploys are cancelled by the Ignored Build Step.

### 6.3 Repost attribution

`tweetClaimAttribution` credits the original author only when all of these hold:
- `raw_payload.data.id === tweet_id`;
- `data.referenced_tweets` contains a `{type:'retweeted', id}` entry;
- `includes.tweets` holds that tweet, with `text`, `author_id` and `created_at`;
- `includes.users` holds `{id (numeric), username}`;
- the tweet text matches the row text once `RT @x:` and URLs are removed.

FxTwitter gives `author.id` (numeric), `screen_name`, `text` and `created_at`, so the scraper can build that shape:

```jsonc
{ "provider": "fxtwitter", "fx": { /* status */ },
  "data": { "id": "<tweet_id>", "referenced_tweets": [{ "type": "retweeted", "id": "<tweet_id>" }] },
  "includes": { "tweets": [{ "id": "<tweet_id>", "text": "<full_text>", "author_id": "<author.id>", "created_at": "<iso>" }],
                "users":  [{ "id": "<author.id>", "username": "<original_author_handle>" }] } }
```

Add a unit test that runs `tweetClaimAttribution` on a mapped repost and expects `relationship: "retweet"` with the original author. Relay accounts are excluded by `isNewsRelayAccount`, which is the intended behaviour.

### 6.4 Quote resolution gate

`shouldResolveQuotedTweetForCandidate` (`update-line-sources.ts:123`, `update-lines-ccc.ts:81`) only fires when the text contains a literal `t.co` link. FxTwitter text has no `t.co` links; the shadow appends the quote's `x.com/<h>/status/<id>` URL instead. Two options:
- **(a)** Also accept an `x.com` or `twitter.com` status URL in that gate.
- **(b) Recommended:** pre-fill the quoted id, author and text from the scraper, and skip the oEmbed quote fetch.

Also check `isWrapperTextInsufficientWithoutQuote` (`linesCccIngestion.ts:281`) and `shouldPreferQuotedTweetText` (`linesCccIngestion.ts:1922`).

### 6.5 Processing trigger and cost

- **Simplest option:** the scraper only enqueues, and the existing per-minute starter-board cron processes the rows. That adds **no new Vercel invocations**. The cost is latency: at most about 1 minute plus the 2-minute poll.
- **Optional:** the edge function POSTs to the processor for each account with new rows, as IFTTT's immediate path did. That is one Vercel invocation per run with news, so get TJ's approval first.
- **Precondition:** `STARTER_BOARD_CAPTURE_ENABLED` is on in production, and no controlled-intake pilot env is set. Verify both in Vercel env metadata, read-only.

### 6.6 FHFHockey to `social_share_x_posts`

- **Source:** the scraper sees FHFH's own posts as `post_kind='post'`, with `media_alt_texts`.
- **Matching:** the matched card comes from alt text that starts with "FHFH " (`lib/socialShare/postedWeek.ts`). The Deno function cannot import `web/lib`, so move the pure matcher into a shared pure module, the way `fxtwitter.ts` is shared. Alternatively, run a small SQL or web-side bridge.
- **Untested:** neither FHFH post in the shadow so far had alt text, so alt-text matching from FxTwitter is unproven. Test it on TJ's next card post before switching.

### 6.7 Coverage gaps to accept or close

- **Replies:** FxTwitter's profile feed leaves out replies to other accounts. One CCC reply was missed this way. Whether an FxTwitter replies endpoint exists has **not** been checked; probe it before switching CCC.
- **Bursts:** the page holds 20 posts. CCC's peak was 18 posts in 10 minutes, so a burst during a run of 404s could overflow the page. Mitigation if needed: page with the cursor on a miss, or poll CCC every minute on game nights.
- **Repost time:** the time of the repost itself is unknown. `tweet_created_at` is the original's time. Nothing that orders by `received_at` is affected.
- **Wrapper reposts:** handled since v4. They are hydrated once through `/2/status/{id}`.
- **Escaping:** `&amp; &lt; &gt;` are decoded since v3, matching IFTTT.

## 7. Phased plan

Each phase ends with a verification step. Production steps need TJ's approval through a pop-up.

**P0 Scaffolding.** No change in behaviour, everything local and tested.
1. In `fxtwitter.ts`, add pure functions: `toQueueRow(shadowRow, table)` and `toV2Payload(shadowRow)`. Extend `web/__tests__/lib/xTimelineFxtwitter.test.ts`.
2. Add an attribution test: a mapped repost run through `tweetClaimAttribution` gives `retweet` with the original author (§6.3).
3. Change the quote gate (§6.4), with tests in the processors' nearest test files.
4. Write the migration for `tweet_intake_providers`, seeded all `ifttt`. **Approval is needed before applying it.**
5. In the receiver, read the switch and acknowledge-and-ignore when an account is switched, with tests in `lineSourceIftttReceiver.test.ts`.
6. In `index.ts`, read the switch and enqueue new first sightings for switched accounts only. With every account on `ifttt`, deploying this is a no-op. **Deploying the edge function needs approval.**

**P1 Parity replay.** Local, with no production writes.

Map the last N days of shadow rows to queue rows, then run the processors' parse functions on them locally, with the interpretation flag on. Compare against the snapshots that the matching IFTTT rows produced: lines, goalies, injuries and attribution. Write the result as a parity report under `tasks/artifacts/`. The new swipe-trainer answer key (`/db/tweet-pattern-review?mode=trainer`, `web/scripts/tweet-trainer-regression.ts`) can score both sources.

**P2 Canary: NHL_Rosters.** It has the lowest volume, about 4 a day.
- Switch it to `fxtwitter`.
- Leave its IFTTT applet **on**, so a rollback is instant. The receiver now ignores it.
- Verify over 48 hours:
  - every new shadow row has exactly one queue row;
  - rows reach `processed` or `rejected` at the IFTTT baseline rate;
  - no duplicate snapshots;
  - attribution is correct.

**P3 DFOFantasy.** It has the most own posts plus goalie starts. Same checks as P2.

**P4 The GDL suite: GameDayLines, GameDayNewsNHL and GameDayGoalies.**
- These are about 95% reposts, so this phase proves repost attribution and full text.
- Watch oEmbed: it should now succeed on original URLs.

**P5 CCC.** Do it after the replies probe and the burst decision (§6.7). It uses the CCC table, keyed on `tweet_id` with no source key.

**P6 FHFHockey to `social_share_x_posts`.** See §6.6.

**P7 Retire IFTTT.**
1. Once every account has run cleanly for 7 days or more, turn off the 7 applets. The IFTTT MCP `disable_applet` can do this, or TJ can do it by hand; **TJ approves either way**.
2. After a further stable period, remove the receivers and IFTTT-only code in a later release, along with the `iftttIntakePolicy` decision. That release is a Vercel build, so it needs approval.
3. Keep the queue table names.

**Rollback at any phase:**
1. Set the account's provider back to `ifttt`. If its applet was turned off, turn it back on.
2. Replay whatever was missed from `x_timeline_shadow_posts`, using `first_seen_at` between the switch and the rollback.

## 8. Acceptance criteria for the whole cutover

- On the 2026-11-08 check, coverage against IFTTT is at least 98% and p90 lag is 6 minutes or less, or TJ explicitly accepts the gaps.
- For every switched account, each new first sighting gives exactly one pending row, and that row reaches a terminal status.
- No repost is processed twice across a switch.
- Repost rows credit the original author, and quote rows resolve the quoted post without `t.co`.
- `social_share_x_posts` gets FHFH card posts with the right `matched_card`.
- All 7 IFTTT applets are off, with no rise in failed or rejected processing compared with the IFTTT baseline.

## 9. Approvals and guardrails

- **Ask TJ first, through a pop-up, before:**
  - any migration;
  - deploying an edge function;
  - any production write beyond the poller's normal inserts;
  - switching an account;
  - turning off an applet;
  - any Vercel build or deploy.
- **No Twitter API, no paid services, no X login,** unless TJ changes this. The twscrape fallback needs his cookies.
- **Keep the scraper free:** about 22,000 edge-function calls a month, within the Supabase quota. Don't add per-row Vercel calls.
- **The poll secret** lives only in Vault (`x_timeline_poll_secret`). Never read it out or print it.
- **Tests:** run Vitest with `env -u GIT_DIR`, use `npm run typecheck` (not plain `npx tsc`), and read its exit code. Deno isn't installed locally, so `index.ts` is not type-checked here.
- **To stop the poller:** `select cron.unschedule('x-timeline-poll');`

## 10. Who owns what, and requests to Codex

- **Claude** built and currently owns `supabase/functions/x-timeline-poll/*`, the two shadow migrations and `web/__tests__/lib/xTimelineFxtwitter.test.ts`. Coordinate through the mailbox before editing them, or take them over by lease.
- **Please register a lease or steer** for `IFTTT-TO-FXTWITTER-CUTOVER`, and say which lane owns:
  - the processors, `web/lib/sources/*` and `IFTTT-ACTIVATION` / controlled intake;
  - Luna capture;
  - the receivers.
- **Please review** §6.1 (dedupe across the switch) and §6.3 (the synthesised v2 payload) before P0 lands.
- **A recommended P0 split:**
  - scraper-side mapping and the switch read: Claude, or whoever takes the lease;
  - the receiver switch, quote gate and attribution test: the owner of the processors and receivers.

## Addendum 2026-11-06: P0 scaffolding built (local, uncommitted, nothing deployed or applied)

TJ chose "Claude starts P0". Every piece is inert until TJ approves the deploy, migration and switch steps below.

| File | Change |
|---|---|
| `supabase/functions/x-timeline-poll/fxtwitter.ts` | New pure functions. `queueTableFor` maps CCC → `lines_ccc_ifttt_events`, FHFH → none, everything else → `line_source_ifttt_events`. `toV2Payload` builds the §6.3 shape for full-original reposts only, never for wrappers or own posts. `toQueueRow` produces the receiver's row shape with `source:'fxtwitter'` and `raw_payload {provider, fx, quote, data?, includes?}`. `rowsToEnqueue` returns rows first seen at or after `switched_at`. |
| `supabase/functions/x-timeline-poll/index.ts` | Reads `tweet_intake_providers` once per run. For each switched account it re-sends that account's due page rows to the queue with an `ignoreDuplicates` upsert, which retries on its own. The response gains `providers: ok \| not_installed \| unavailable` and `enqueued` / `enqueueError` per account. `unavailable` makes the run a 207, because a switched account's IFTTT deliveries are being dropped. |
| `supabase/migrations/20261106200000_tweet_intake_providers.sql` | The §6.2 table. A trigger sets `switched_at` whenever `provider` changes. Access is service role only. It seeds all 7 accounts as `ifttt`. **Not applied.** |
| `web/lib/sources/lineSourceIftttReceiver.ts` | `activeTweetIntakeProvider(sourceKey)`. A switched account gets `200 {processingStatus:"ignored_provider_fxtwitter"}` with no write. A missing table, a missing row or a read error falls back to `ifttt`. The controlled-intake pilot path is skipped, so the receiver does not touch the switch there and `IFTTT-ACTIVATION` keeps its own rules. |
| `web/lib/sources/fxtwitterQueuePayload.ts` (new) | `quotedTweetFromFxtwitterPayload(raw_payload)` turns the scraper's `quote` into a `LinesCccResolvedQuotedTweet` with `retrievalStatus:"fxtwitter_payload"`. |
| `web/lib/sources/linesCccIngestion.ts` | The `retrievalStatus` union gains `"fxtwitter_payload"`. This is a one-line change. |
| `web/pages/api/v1/db/update-line-sources.ts`, `update-lines-ccc.ts` | §6.4 option (b): a scraper row's quote is applied directly, without the t.co lookup or oEmbed. IFTTT rows behave as before. |
| `web/__tests__/lib/xTimelineFxtwitter.test.ts`, `web/lib/sources/lineSourceIftttReceiver.test.ts` | +6 and +2 tests. One proves `tweetClaimAttribution` returns `relationship:"retweet"` with the original author's numeric id for a mapped repost. |

**Checks run:**
- Vitest, run with `env -u GIT_DIR`: `xTimelineFxtwitter` 15/15, `lineSourceIftttReceiver` 20/20, `linesCccIngestion` 56/56.
- `npm run typecheck`: exit 0.
- eslint on the 7 changed web files: exit 0.
- `index.ts` type-checked for the first time, using a temporary Deno shim with web's supabase-js types: exit 0. This is not a real `deno check`.

**Known gaps:**
- A wrapper repost's hydrated original is enqueued only in the run that first stores it. Later runs drop known wrappers from `rows`, so if that run's enqueue fails, the post is not retried.
- In the overlap window, a repost that IFTTT delivered just before the switch but the shadow first saw just after it could be queued twice. The shadow is usually first, so this is rare. Own posts are deduped by id.

**Order for the approval-gated steps, P0 → P2:**
1. Deploy edge function v5. It is inert, reporting `providers:"not_installed"`.
2. Apply the migration. All accounts are `ifttt`, so nothing changes.
3. Release the web changes (receiver and processors). This is a Vercel build. The receiver must ignore switched accounts **before** any switch, unless the applet for that account is turned off instead.
4. P1 parity replay.
5. P2: `update tweet_intake_providers set provider='fxtwitter' where source_key='nhl_rosters';`

### Production status 2026-11-06 17:50 UTC

- **Edge function `x-timeline-poll` v5 is deployed** (TJ approved), with `verify_jwt=false`. I read back the deployed source; it matches the local `fxtwitter.ts` (sha256 `d80a9bd8…97ce`) and `index.ts` (`02503cc0…5420`).
- **First v5 run, 17:50:**
  - `providers:"not_installed"`, so the poller is shadow-only as intended.
  - 6 of 7 accounts read fine. The run returned 207 only because CCC got 3 random FxTwitter 404s.
  - No `enqueued` field appeared, because no account is switched.
- **Migration `20261106200000_tweet_intake_providers.sql` is NOT applied.** The `apply_migration` tool call was declined twice, even after TJ chose to retry and approve. TJ may apply the file by hand. Nothing depends on it until an account is switched.
- **Update, about 18:05 UTC: TJ applied the migration by hand** in the Supabase SQL editor ("Success. No rows returned").
  - Verified read-only: 7 rows, all `ifttt`; RLS is on; grants go to `service_role` only (plus the `postgres` owner); the trigger `tweet_intake_providers_touch` is present.
  - The security advisor shows only the INFO-level `rls_enabled_no_policy`, the same as the other service-role queue tables.
  - **Migration history:** the editor does not record the migration, so `supabase_migrations` has no 20261106200000 entry. When the files are committed, run `supabase migration repair --status applied 20261106200000` before any `db push`.

## Addendum 2026-11-06 18:15 UTC: P1 parity replay done

See `P1-PARITY-2026-11-06.md`, with raw data in `P1-PARITY-2026-11-06.json`. The script is `web/scripts/x-timeline-parity-replay.ts`; it is read-only and uncommitted. The run passes typecheck and eslint.

- **Coverage:** the shadow has 78 of 79 IFTTT rows since 01:30 UTC. The miss is a CCC reply to another account.
- **Parsing:** extraction was identical for all 78 pairs.
- **Reposts:** all 42 are credited to their original author through the scraper, against 0 through IFTTT.
- **Quotes:** all 10 carry their quoted post without the `t.co` lookup.
- **Open:** the replay skips oEmbed enrichment. Check repost attribution after enrichment in the P2 canary.

**Next gated step:** the web release of the receiver and processor changes, which is a Vercel build and needs TJ's approval. Then P2 can switch `nhl_rosters`.

## Addendum 2026-11-06 18:48 UTC: P0 released as #411

- **PR and merge:** https://github.com/FHFHockey-dev/fhfhockey.com/pull/411 was squash-merged as master `70798d8c0`. Its tree equals the gated candidate `5562a7ceb`, which is master `4cd22f493` plus 17 files: the P0 files, the receiver ordering fix and migration-authority rows 106–108.
- **Gate:**
  - Focused suites: 8 files, 158 tests pass.
  - Unit suite: 16,113 pass.
  - Typecheck: exit 0.
  - Lint: 0 errors.
  - The first gate run had caught two problems, both fixed before release. The switch lookup ran before the route's 400 checks. The migrations were missing from `migration-authority.json`.
- **Vercel:** `fhfhockey` `dpl_Bj129CgSHD5pvizUeHQJeJ9Su6HQ` went READY at 18:41:53 UTC and serves fhfhockey.com. `fhfhockey.com`, `cms` and `functions` were CANCELED, so this was one build.
- **Smoke:** `/` returned 200, and a GET to the NHL-Rosters webhook returned 405. A live IFTTT delivery at 18:43 was stored and processed normally.
- **octoberBranch:** synced as `55843f9ca` (`merge -s ours`, tree unchanged) and pushed. No deployment or GitHub status followed. Unpushed commits were reworded first to drop AI attribution lines, as TJ approved. In octoberBranch, the P0 commits are now `3e31a0f38` and `bb6963fd3`.
- **The live state is unchanged:** all accounts are still on `ifttt`. The next step is P2: switch `nhl_rosters`, which needs TJ's approval, then watch post-oEmbed repost attribution.
- **Migration history:** `20261106200000` is still marked `unknown` in the migration authority until an approved `supabase migration repair`.

## Addendum 2026-11-06 18:50 UTC: P2 canary started

- **Switch:** `nhl_rosters` is set to `fxtwitter` in `tweet_intake_providers`, with `switched_at` 18:50:10 UTC; TJ approved it. All other accounts stay on `ifttt`.
- **Rollback:**

  ```sql
  update public.tweet_intake_providers set provider='ifttt' where source_key='nhl_rosters';
  ```

- **Verification:** the scheduled read-only check `x-shadow-coverage-check` (2026-11-08 at 10:00 local) now covers the canary. It checks that each post is queued exactly once, that IFTTT deliveries are dropped, the processing mix, and snapshot attribution. Then it asks TJ: switch DFO, wait, or roll back.

## Addendum 2026-11-06 19:20 UTC: staged plan, safety net and email watchdog

- **Staged plan (TJ):**
  1. DFO and the three GameDay accounts switch once NHL_Rosters has processed a few posts and one repost is credited to its original author.
  2. CCC switches after a probe of FxTwitter replies and the burst handling.
  3. FHFHockey switches after its P6 writer is built.
- **Tonight's check:** the read-only scheduled check `x-canary-3pm-check` runs at 15:00 local on 11-06. Auto mode refused a version that could switch accounts unattended.
- **Safety net:** a fallback scraper plus automatic failback to IFTTT, in session `local_c3bcbbcc-e312-49d9-96ff-4c2254a0a947` (x-safety-net).
- **Watchdog:** the migration `20261106210000_x_timeline_watchdog.sql` holds the state table and the function `public.x_timeline_watchdog(mode)`. pg_cron runs it every 5 minutes; the line is in `schedule.sql`.
  - It emails through Resend from `x-poller@fhfhockey.com` when:
    - the poller has produced no result for 12 minutes;
    - every account failed in each of the last 3 runs;
    - a switched account failed in each of the last 8 runs;
    - the switch table is unreadable;
    - a switched account's queue insert failed in each of the last 3 runs.
  - It sends one email per incident, a reminder every 6 hours, and a recovery email.
  - It uses the Vault secrets `resend_api_key` and `x_timeline_alert_recipient`.
  - Not applied yet: TJ will run it by hand. It is registered as `pending` in the migration authority.
- **Watchdog went live at about 19:25 UTC.** TJ added the two Vault secrets, ran the migration and the cron line by hand, and sent a test email; Resend returned 200.
- **Readback:**
  - cron `x-timeline-watchdog` is active, running every 5 minutes;
  - the function is security definer with an empty search_path, and only service_role can execute it;
  - a dry run is clean.
- **Migration authority:** row 113 is set to `unknown`, because the migration is not in the ledger. Both hand-applied migrations need an approved `supabase migration repair`: 20261106200000 and 20261106210000.
- **2026-11-06, TJ: IFTTT is being removed entirely. It is not a fallback.** The fallback is a single layer-2 scraper from TJ's list, chosen by three criteria: free, least friction, and no always-on host.
  - The x-safety-net session has been steered accordingly.
  - The phase plan in §7 changes to match. Retiring IFTTT (P7) now means removing the receivers, applets and IFTTT-only code once every account is on the scraper. Rollbacks go to the fallback scraper, not to IFTTT.
- **Loud alert emails** (`20261106220000_x_timeline_watchdog_loud_alerts.sql`, approved by TJ, pending manual apply): they have no IFTTT step. Instead they say that missed posts are queued when FxTwitter answers again (up to 20 per account), and to start the fallback scraper if the outage lasts hours.

## Addendum 2026-11-06 20:05 UTC: poller v6 live; first canary posts; stale feeds

- **v6 deployed** (TJ approved), with gap recovery and support for a mirror. FXTWITTER_MIRROR_BASE is not set yet, so the fallback path makes v5's 3 public attempts.
  - First run, 20:00: status 200, all 7 accounts OK.
  - Two NHL_Rosters posts were queued through the scraper; the first processed in 3 seconds.
  - No IFTTT rows for nhl_rosters arrived after the switch.
- **New risk: a stale FxTwitter profile feed.** CCC's 19:42 starting-goalies post was missing from the profile feed at about 20:00, whose newest post was from 19:16, although reads succeeded.
  - A poller-only design cannot see this.
  - It needs a cross-check: occasionally union the mirror's page 1, or have the Pi's twscrape check periodically. This was routed to x-safety-net.
  - **Block CCC's switch** until a cross-check exists, and weigh the risk for the other accounts.
- **2026-11-07 00:05 UTC, poller v7:** queue rows carry `raw_payload.first_seen_at`, the shadow's first-sighting time, for the Lines engine (ticket from the Lines IGA chef, approved by TJ). Verified on nhl_rosters row 2118857705532121311.

## Addendum 2026-11-07 03:23 UTC: every line account is on the scraper

- **Why:** TJ's IFTTT credits ran out, so all six line accounts now use `fxtwitter`. nhl_rosters had been switched since 11-06 18:50; the other five switched at 03:23.
- **switched_at backdated** to each account's last IFTTT delivery + 1 ms, so posts IFTTT never delivered are queued. There was one: a CCC repost, queued at 03:24.
- **Verified:** the 03:24 run returned 200, every account was OK, and the queues filled.
- **Still open:**
  - **P6, FHFHockey to `social_share_x_posts`:** not built, so FHFH card posts go unrecorded while IFTTT is down.
  - **Stale-feed risk, highest for CCC:** the mirror and Pi cross-check aren't live yet.
  - **P7, removing IFTTT:** applets, receivers and IFTTT-only code.

## Addendum 2026-11-07 03:40 UTC: P6, the FHFHockey social-share writer

- **Poller v8 is deployed and fhfhockey is switched.** It writes own posts and quotes that carry media, never reposts, to `social_share_x_posts`, upserting on tweet_id with ignoreDuplicates.
  - `posted_at` is the X timestamp.
  - The card match uses `_shared/socialShareCard.ts`, an exact copy of postedWeek's rules; a parity test fails if they drift.
- **Verified:**
  - On real data, the scraper's eligibility rule picks exactly the 3 posts IFTTT stored since 11-04.
  - The first runs after the switch wrote 0 rows: no duplicates.
- **Pending:** end-to-end proof on TJ's next card post (scheduled read-only check, 11-07 13:00 ET).
- **Known limit:** FxTwitter has not exposed alt text on FHFH media yet. IFTTT's rows had none either, so matched_card stays null for now.
