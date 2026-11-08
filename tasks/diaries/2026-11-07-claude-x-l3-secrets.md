# 2026-11-07 · Claude · X intake Layer 3 secrets walkthrough + first shadow run + FHFH social-share e2e

## Scope
Chef local_c4e6c533 lane. (1) Guide TJ to set, one at a time: Vault `x_timeline_ingest_secret`, GH secret
`X_INGEST_SECRET`, GH secret `X_BURNER_COOKIES`, repo variable `X_TWSCRAPE_SHADOW_ENABLED=true`. Never touch
`X_TIMELINE_INGEST_LIVE`. (2) First scheduled run: gh run view (read-only) + compare.sql read-only. (3) FHFH social-share
e2e on TJ's next real card post (read-only). (4) Goalie reports null source_account: diagnose, fix only in X-lane files.
No P7. No secrets in chat or here.

## Where
octoberBranch, /Users/tim/Code/fhfhockey.com. Repo FHFHockey-dev/fhfhockey.com. Supabase project fyhftlxokyjtpndbkfse.

## Pre-approved read-only queries (written before running)
- Q1 compare: tools/x-twscrape-fallback/compare.sql verbatim.
- Q2 coverage: select source_key, count(*), min(first_observed_at), max(first_observed_at), max(tweet_created_at)
  from public.x_timeline_twscrape_observations group by 1 order by 1;
- Q4 social-share e2e: select tweet_id, posted_at, matched_card, left(alt_text,60) alt, created_at,
  (select count(*) from public.social_share_x_posts) total, (select count(distinct tweet_id) from public.social_share_x_posts) distinct_ids
  from public.social_share_x_posts order by posted_at desc limit 5; plus
  select tweet_id, post_kind, tweet_created_at, first_seen_at, has_media from public.x_timeline_shadow_posts
  where source_key='fhfhockey' and first_seen_at > '2026-11-07 18:04+00' order by first_seen_at desc limit 10;
- Q3 FxTwitter freshness: select source_key, max(first_seen_at), max(tweet_created_at) from public.x_timeline_shadow_posts
  group by 1 order by 1;

## State
- Start ~20:00 UTC: repo has 0 Actions variables, 0 secrets (gh list).
- TJ set all four himself (pop-ups): Vault secret created (SQL editor); GH secrets X_INGEST_SECRET 21:27:38Z,
  X_BURNER_COOKIES 21:48:46Z; variable X_TWSCRAPE_SHADOW_ENABLED=true 21:51:59Z (first try landed as a secret; TJ
  moved it, stray secret gone). Names checked with gh secret/variable list only. X_TIMELINE_INGEST_LIVE untouched.

## Item 2 run 1: 42418517265 (schedule, 22:00:22Z, 26 s) FAILED
- Unit tests OK; anchors call OK (ingest secret valid); cookie pool built. First X UserTweets -> HTTP 403, twscrape
  locked the burner 15 min -> all 7 read_failed NoAccountError -> exit 1. Q2: 0 observation rows.
- Schedule dropped 22:07 + 22:22. TJ pop-up: one manual run. Run 2 = 42421419683 (workflow_dispatch 22:36:40Z):
  same HttpStatusError 403 on UserTweets (curl backend), burner locked, 7/7 read_failed. Persistent, not transient.
- Unknown: bad/expired cookies vs X blocking GitHub runner IPs vs twscrape 0.21.0 request signing. Untested: a real
  read from a residential IP with these cookies.

## Item 3 (Q4 run ~22:00 UTC): NOT YET
- social_share_x_posts 9 rows / 9 distinct, newest 11-06 16:37. fhfhockey shadow rows since 18:04: 3 reposts + 1 quote
  2119144294061666691 (19:05:46, has_media false) -> none eligible. No real card post yet; stop here per brief.

## Item 4: goalie social-share cards show no X handle (diagnosis, code only, no DB read)
- Cards read player_forecast_goalie_start_observations.source_account (goalieInventory.sources -> dailyBoardEvidence
  sourceKey = source_account ?? source_key -> riskyStarts.sourceHandle; 'validated_events' is a PIPELINE_SOURCE -> null).
- Root cause: web/lib/sources/tweetProjectionStorage.ts:245 builds the goalie/injury event rows with
  source_key 'validated_events', source_account: null; persistProjectionSourceSnapshots keeps child.source_account (null);
  capturePlayerForecastSourceRows only substitutes the quoted author for quoted_oembed posts. So every non-quote
  interpreted goalie report lands with source_account null. The X lane already provides the handle (fxtwitter.ts
  toLinesCccRow source_account = account.handle), so it is not an intake bug.
- Proposed fix (not X-lane; Lines/tweet pipeline owner): set source_account to the reporter handle
  (quoted author for quotes, else source.sourceAccount / handle from the original URL) instead of null; keep
  source_key 'validated_events'. Side effect: resolver then separates reporters (conflicts become detectable), so
  goalieInventory.sources/riskyStarts tests + capture_starter_board_goalies conflict expectations need review. Not implemented.

## Parked (TJ pop-up 22:38Z: "Turn off, park it")
- TJ deleted X_TWSCRAPE_SHADOW_ENABLED; gh variable list empty 22:39Z. Secrets X_INGEST_SECRET + X_BURNER_COOKIES kept.
  Vault secret kept. Ingest v1 untouched. 2 runs total (1 schedule, 1 manual), 1 X request each.
- Item 2 NOT green (0 observations, compare.sql not meaningful). Item 3 NOT YET (no real card post). Item 4 proposed only.

## Next (when un-parked)
- Find the 403 cause: a one-off local read on TJ's Mac (residential IP, cookies typed into a hidden prompt) separates
  GitHub IP block from bad cookies/twscrape signing; a fresh burner login if cookies. Then re-add the variable.
- Item 3 trigger: re-run Q4 (read-only) after TJ's next real FHFH card post (own post/quote WITH media from fhfhockey);
  green = one new social_share_x_posts row, posted_at = X tweet_created_at, matched_card set, total = distinct.
- Item 4 closed: fix landed in fe7eb77be (Lines follow-ups lane), per Chef.
- Local read runs only if TJ asks.
