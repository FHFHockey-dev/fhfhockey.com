# 2026-11-09 · Claude · X poller run capture and 207s

## Scope
Why x_timeline_poll_runs misses poller runs; 207s by source; were posts or downstream processing missed. Durable
monitoring fix with tests. No replay, no production data repair, no deploy until TJ reviews the plan.

## Where
- octoberBranch, uncommitted. Files:
  - supabase/migrations/20261109150000_x_timeline_poll_runs_run_key.sql (new, NOT applied)
  - supabase/tests/x_timeline_poll_runs_run_key.py (new)
  - web/lib/cron/xPollerHealth.ts and .test.ts
  - migration-authority.json row 122 pending, plus counts in supportedBaselineMigration.test.ts and super-goal-final-summary.md
- Findings and plan: tasks/artifacts/x-poller-run-capture-2026-11-09/findings.md

## State / checks
- Root cause: pg_net restarts its response ids (4 resets since 11-06). The capture's PK (response_id, source_key) plus
  "on conflict do nothing" drops reused-id runs. In 08:10–14:10 on 11-09: 45 of 180 bodies captured, 135 dropped.
- 207s: FxTwitter 404 x3 only, about 7.5% of account reads, longest streak 3 runs. Queue parity 0 missing. One CCC post
  was 5 h late (feed omission). 5 Lines processor failures are not intake.
- Checks: local PG15 9/9; vitest 31 + baseline 21 pass; typecheck 0; eslint 0.

## Next
TJ reviews plan section 5. Apply the migration only on approval; the catch-up insert is a separate approval.

## Gotchas
- pg_net ids repeat. Key captured runs by (run_at, response_id).
- Live capture body md5 7631439c… equals the 20261106201221 file.

## Apply (2026-11-09)
- TJ pop-up: migration + catch-up. The Supabase plugin's apply_migration came back "declined", so nothing was applied.
- TJ (2nd pop-up): TJ applies the file himself in the SQL editor. After that: readback (constraint, body md5
  3b62975669b20c3840a135fdab1d8a15, proconfig, grants), then the approved catch-up insert, then rename the file to the
  ledger version and set authority row 122 to applied.
- Done: TJ applied it about 14:30 UTC. Readback OK (pk, md5 3b629756…, search_path, grants). The ledger row was inserted with TJ's
  pop-up approval. The catch-up inserted 136 runs / 952 rows; then 180/180 bodies were captured. Authority row 122 applied
  (85/28/9). File header now says applied (new sha c32631e1…). Tests: baseline + health 32 pass, PG15 9/9.
- Next: confirm the scheduled capture (first run 14:30) keeps parity, read-only. Commit and release only when TJ asks; the web report change ships with the next web release.
- Committed by Chef (local_c4e6c533) as 0e6fd60a8 on octoberBranch: migration, PG15 proof, xPollerHealth(+test), findings
  and the 3 registry files (with Chef's row-120 flip). Local, not pushed; ships in the next gated release with TJ's OK.
  Chef owns those files now. Only this diary stays here.

## Checkpoint 2026-11-09 ~15:55 UTC (Chef: TJ landing)
- Shipped: 0e6fd60a8 (Chef's commit) is live in release #424 (master 7f91fc449). The migration was applied before that and has a ledger row.
- Verified read-only after the fix: 6 capture runs since 14:30, 0 failures. Since 14:24: 40 poller job runs, 34 captured.
  The 6 missing runs all fall in 15:14–15:28, when pg_net restarted again: its ids went back to 1, net._http_response
  was emptied (oldest row now 15:28) and the uncaptured bodies were lost. This confirms a restart empties pg_net; it was
  unverified before. Runs after the restart reuse ids 1, 3, 4… and are captured correctly, so the fix works.
- Remaining loss: up to ~15 min of runs per pg_net restart (capture every 15 min).

## Next (each needs TJ's OK)
1. Optional: capture every 5 min (cron.alter_job on 'x-timeline-poll-capture'; the capture took ≤0.96 s). It cuts the
   restart loss to ≤5 min. Also update the schedule.sql line.
2. Optional: the poller writes its own run row (durable even across pg_net restarts). Changes and redeploys x-timeline-poll.
3. Report wording: the cron report's longest-gap warning now names posts stored during the gap, so the restart gap
   should read as a capture gap. Check the next daily report.
- Separate findings, not this lane: 5 Lines processor failures 11-08 (4 CCC, 1 DFO, no error text); 1 CCC post 5 h late
  (FxTwitter feed omission); twscrape shadow still off (0 observations, secrets not set).
- This diary is uncommitted on purpose; retire it after step 3 is checked.

## News-feed ticket (Chef, TJ pop-up: code only), 2026-11-09 ~20:30 UTC
- Commit 7e92b8e2e on octoberBranch (not pushed): web/pages/api/v1/db/auto-news-feed-items.ts + new
  web/__tests__/pages/api/v1/db/auto-news-feed-items.test.ts (6 tests; all 6 fail on the old code).
- Causes:
  - Duplicate key: DFO relay review df64c2f6 has its own draft card 8b6cfc89 (created 19:00, original_tweet_id null).
    The review sync later set its source_url to AGrossNewsday/2119866822602494164, already held by published card
    ac68024e (review 50c55520, 19:30). The UPDATE set the same original, hit 23505 and aborted the run (19:33, 20:02).
    It would repeat every run.
  - 2.5–3.5 min runs: every run rewrote all ~280 candidates (update + players delete/insert, ~840 sequential writes),
    after the review sync upserts ~1,086 review rows.
  - Churn: updates were unconditional, and metadata.automation.generatedAt changes every run.
  - 16:00 timeout: the review sync's read of line_source_snapshots (500 rows with raw_payload + metadata, no
    observed_at index) during DB stress.
  - update-line-sources 15:04–15:27: upstream timeouts and a schema-cache error in the DB restart window; all 1,235 runs
    since succeeded. Its rate rose to ~300/h because the starter-board cron's capture calls 5 processors every minute
    (retryPendingLineSourceEvents). That is another lane's code.
- Checks: 6 nearby files, 121 tests pass; eslint 0. npm run typecheck exit 2, only in another lane's untracked
  scripts/player-summaries-{backup,rollback}.ts (node:util parseArgs).
- Not done, for TJ: optional archive of duplicate draft 8b6cfc89; index migration on line_source_snapshots/lines_ccc
  (observed_at desc); review sync still upserts every row every run.
- Chef/TJ follow-ups: 7e92b8e2e released once the gate is green (Chef handles it). Chef archived 8b6cfc89.
- Index draft committed as 5ab13bce5 (not applied): 20261109213000_line_source_observed_at_indexes.sql, PG15 proof 8/8,
  registry row 124 pending (counts 124/86/28/10), coordinated with wgo-timeouts (row 123). Prod reads timed out around
  20:40 UTC (DB stress?), so facts are from earlier in the day.
- PROD DB UNREACHABLE since ~20:34 UTC (Chef). No production queries until Chef says it's back. Reported my reads to Chef:
  ~20:10–20:28 investigation SELECTs. The heaviest was a nested-loop LIKE join of news_feed_items with
  tweet_pattern_review_items (~20:15–20:20). The line_source_snapshots raw_payload/metadata size read over the newest
  500 ran ~20:24–20:26. Two reads between 20:31 and 20:38 failed to connect and never ran.

## News "couldn't verify" ticket (Chef; TJ pop-up 2026-11-09: grant public claim authority, carry interpretations)
- Code: tweetNewsAutomation publicClaimInterpretation (version/events/unresolved from metadata.retainedInterpretation)
  into card metadata.interpretation; newsFeed getPublicNewsClaimPresentation: no interpretation → no line; failing →
  line; valid with no events → no line. Tests updated: newsFeed, NewsCard, newsReviewBoundary (now asserts carry).
  224 tests in 13 files pass; typecheck 0; eslint 0.
- Planned bounded reads (read hygiene: pg_stat_activity first; stop if active > 5 or any query > 10 s):
  Q0 select count(*) filter (where state='active'), max(now()-query_start) filter (where state='active') from pg_stat_activity;
  Q1 select indexdef from pg_indexes where tablename='news_feed_items';
  Q2 aggregate over published news_feed_items with published_at >= now()-45 days (LIMIT-bounded CTE of ≤ 2,000 ids),
     joined by primary key to tweet_pattern_review_items.metadata->'retainedInterpretation' (no raw payloads): counts of
     has-interpretation / version / events>0 / unresolved=0 / all evidence texts inside the blurb.
- Committed a70dece64 (code, tests, backfill plan). Reads ran: Q0 (2 active), Q1 indexes, Q2 share aggregate
  (≤ 2,000 cards), plus one ≤ 500-card evidence-failure aggregate. Share for 0–7 d: 19% claims / 42% unverified /
  39% no line. Remaining failures: evidence text with a URL (97/263 events), full name missing from the evidence (61/263);
  both are strict-check rules, TJ's call. Backfill must run after the release. Next: TJ approves the backfill; optionally
  decide on URL-normalized evidence matching.
- TJ (via Chef pop-up): release a70dece64 ~22:05 UTC; loosen both rules; backfill waits for the next session.
- Committed 7d05e867b (21:20 UTC): URL-stripped evidence/blurb match, unique surname with a resolved playerId (context =
  events + card player rows). 226 tests, typecheck 0, eslint 0. New estimates: 0–7 d 49% claims / 12% unverified /
  39% no line; 7–14 d 65% / 9% / 26%.
- Next session: run the backfill plan after release, with TJ's approval. The plan's share table and rule note predate
  7d05e867b, so update them.

## CHECKPOINT 2026-11-09 ~21:40 UTC (TJ going offline; Chef shipping a70dece64 + 7d05e867b)
State:
- Live or shipping: 0e6fd60a8 (poller run capture key; migration 20261109150000 applied + ledger row; capture now */5,
  job 402, by Chef). 7e92b8e2e (news-feed duplicate-original + skip unchanged). a70dece64 + 7d05e867b (card claim
  fields + loosened rules), shipping about 22:05 UTC.
- Expected after release: about 49% of last-7-day cards show claims, 12% "couldn't verify", 39% no line (SQL estimate).
  The cron refreshes the cards for the newest 300 review rows within 14 days on its own.

Next session (each needs TJ's pop-up):
1. Backfill older published cards: tasks/artifacts/news-claims-interpretation-2026-11-09/backfill-plan.md. Run it only
   after the release is live. Update its share table and rule note first (they predate 7d05e867b). Dry count → backup
   table → batches of 200, concurrency 1, pg_stat_activity check between batches → readback; rollback from the backup.
2. Confirm after release, read-only: news_feed_items with metadata.interpretation are rising, no auto-news-feed
   failures, duplicateOriginalCount/unchangedCount in the summaries, and run time well under 2.5 min.
Open items:
- Review sync (syncTweetPatternReviewItems) still upserts every review row (~1,086) every run, bumping updated_at.
  Skipping unchanged rows would cut most of the remaining run time and WAL.
- The starter-board cron's capture (retryPendingLineSourceEvents) calls 5–6 line-source processors every minute,
  ~1,500 Vercel calls/h since ~14:30 UTC 11-09. Its owner should check cost and cadence.
- Index draft 20261109213000 (registry row 124, pending, commit 5ab13bce5), not applied. The plain form works through
  apply_migration; the header has the CONCURRENTLY form.
- X twscrape shadow still has 0 observations (secrets not set). One CCC post was 5 h late on 11-09 (feed omission).
Read hygiene: follow LANE-RULES (pg_stat_activity first; no unbounded LIKE joins or bulk detoasting). My unbounded
LIKE join and the raw_payload size read ran shortly before the 20:34 outage.
