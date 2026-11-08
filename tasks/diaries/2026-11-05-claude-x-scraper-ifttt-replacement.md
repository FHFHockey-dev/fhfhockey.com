# 2026-11-05 · Claude · Replace IFTTT tweet intake with a free scraper

## Scope
Replace the IFTTT "new tweet by user" → webhook intake for @DFOFantasy, @NHL_Rosters, @CcCMiddleton, @GameDayLines,
@GameDayNewsNHL, @GameDayGoalies and @FHFHockey with a free scraper. Store posts and reposts, the nested repost author's
handle, and parsed text, and keep everything downstream working. No Twitter API, no cost. Tell TJ if a login is needed.

## Where
- Branch octoberBranch. Nothing edited yet apart from this diary.
- Receivers: web/pages/api/v1/sources/ifttt/*.ts → web/lib/sources/lineSourceIftttReceiver.ts (insert a pending row,
  then optionally POST /api/v1/db/update-line-sources or /api/v1/db/update-lines-ccc).
- FHFHockey-post.ts → social_share_x_posts. matched_card comes from media alt text that starts with "FHFH ".
- Tables: line_source_ifttt_events (unique source_key,tweet_id), lines_ccc_ifttt_events (unique tweet_id). DDL is in
  web/sql/ratings/008, 012.
- IFTTT applets: 6 use "New tweet by a specific user"; FHFH uses "New photo or video by you". The CCC applet makes 2 web requests.

## State / checks
- Live volume over 14 days: GDL suite about 1,150 rows, mostly "RT @x:" reposts. DFO about 80 a day since 11-01.
- Today the nested handle exists only as the "RT @x:" text prefix. The original's id and full text are never stored,
  and oEmbed fails on reposts (oembed_tweet_identity_mismatch).
- Attribution code (tweetSourceDirectory.ts:60, tweetAttribution.ts:7) credits a repost to the original author only when
  raw_payload has the X v2 shape {data.referenced_tweets[retweeted], includes.tweets, includes.users}.
- Probed FxTwitter /2/profile/{handle}/statuses twice, no login. Reposts come back as the original post (original id,
  author.screen_name, full text) plus reposted_by. The wrapper repost id and the repost time are not returned.
  "FHFHockey" returned 404 and "fhfhockey" returned 200. Alt text on own media is unverified.
- Five repos: twscrape is the best of the list but needs cookies from a logged-in account. Scweet also needs cookies.
  x-timeline-scraper reads only the Home feed. data-scrape does not work. Xquik is paid.

## Decisions (TJ, 2026-11-05)
FxTwitter with no login; a Supabase Edge Function on pg_cron; a shadow table first, then cutover.

## Built (local, uncommitted)
- supabase/migrations/20261106011935_x_timeline_shadow_posts.sql (shadow table, service role only).
- supabase/functions/x-timeline-poll/{fxtwitter.ts, index.ts, schedule.sql}; supabase/config.toml sets verify_jwt=false.
- web/__tests__/lib/xTimelineFxtwitter.test.ts: 5 tests pass. `npm run typecheck` exits 0.
- Live dry run (Node, mapper only, no writes): all 7 accounts map. Repost handles, quotes and alt text come through.
  FxTwitter returns about 40% random 404s and caps the page at 20, so up to 3 retries per account (about 24s a run).
- Prod has pg_cron 1.4, pg_net 0.8.0 and vault; 72 cron jobs already exist.

## Production (TJ approved 2026-11-05)
- Migration 20261106012634 (shadow table) and 20261106012951 (x_timeline_poll_secret_matches RPC) applied. Local
  files are renamed to match.
- The secret was generated inside Postgres into Vault 'x_timeline_poll_secret'; nobody has seen the value. Auto mode
  blocked the RPC migration at first because it departed from the approved plan; TJ then approved the Vault route.
- Edge function x-timeline-poll v2 is deployed with verify_jwt=false. Unauthenticated and wrong-secret probes both get 401.
- cron job 400 'x-timeline-poll' runs every 2 minutes. Stop it with: select cron.unschedule('x-timeline-poll');

- First 3 cron runs (01:32, 01:34, 01:36 UTC) succeeded. Run 1 inserted 139 rows across all 7 accounts. In run 3, 3 of
  7 accounts missed after 3 attempts each (HTTP 207); 21 account reads over the 3 runs, 18 OK.
- TJ asked why FxTwitter: it was recommended before the 404 rate was known. TJ chose to shadow for a few days, then decide.

- v3 deployed (decodes &amp;/&lt;/&gt; as IFTTT did); 6 rows corrected. New posts land 0–1 minute after posting.
- Codex debrief at tasks/artifacts/cross-platform/2026-10-24-coordination/handoffs/X-TIMELINE-SHADOW/DEBRIEF.md, with
  receipt CLAUDE-X-TIMELINE-SHADOW-20261106 in CLAUDE-TO-CODEX.md.

## Coverage check 2026-11-06 14:18 UTC (read-only, TJ asked)
- Live window 01:32–14:18 UTC: IFTTT had 17 rows and the shadow caught 16. The 1 miss is a CCC reply to another
  account; FxTwitter's feed leaves those out. The shadow saw it first in 14 of 16: median 3.5 min ahead of IFTTT,
  worst case 1.7 min behind. It has no rows IFTTT lacks.
- Backfill spans: 87/89. The 2 misses were deleted posts (X oEmbed 404; a control post gave 200).
- Gap: FxTwitter sometimes returns a repost as the wrapper itself (author = the reposter, text "RT @x: …"
  truncated). mapFxStatus stores that as a 'post' with no original_author_handle. 2 rows (GlobeKPD on GDG/GDN).
  Fix: parse the RT prefix and fetch /2/status/{id}, which returns the full original.
- Health: pg_net keeps only 6h of responses. Over those 180 runs, 6.7–13.3% of reads failed after retries, all 404s.
  Longest miss streak was 4 runs (DFO). Cron 384/384 runs. Peak IFTTT volume: CCC 18 posts in 10 min vs a 20-post page.
- FHFH: both social_share posts were captured. Neither has alt text, so the "FHFH " card match is untested.

## Wrapper-repost fix (local, TJ said "fix it" 2026-11-06)
- fxtwitter.ts: mapFxStatus treats "RT @x: " text by the account as a repost (keeps the nested handle, strips the
  prefix). New fetchFxStatus, isRepostWrapper and mapFxWrappedRepost. index.ts fetches /2/status/{wrapper id} once
  per new wrapper and stores the full original keyed by its id, with raw_payload.repost_wrapper_id. If that fetch
  fails, it stores the wrapper as is.
- 9/9 tests pass; `npm run typecheck` exits 0. The live mapper run hydrates the GlobeKPD wrapper to the full
  original 2118475992247447555. The PostgREST or() filter parses (anon gets 42501, a bad query gets PGRST100).
  There is no Deno locally, so index.ts is not typechecked.
- TJ approved deploy + fix. v4 deployed at 14:45:45 UTC (verify_jwt=false). Both wrapper rows were updated in place
  to the full original 2118475992247447555 (@GlobeKPD), with raw_payload.repost_wrapper_id set to the wrapper id.
- Verified: the 14:48 run returned 200, all 7 ok; GDG/GDN saw 19 (known wrapper skipped), 0 hydrated, 0 inserted, 0 wrapper
  rows left. Debrief addendum added with the new hashes.

## Next
The scheduled task 'x-shadow-coverage-check' runs once on 2026-11-08 at 10:00 local (read-only review, then a pop-up
for TJ). Around 2026-11-08: measure coverage and lag against IFTTT. Match on tweet_id for own posts, and on "RT @handle:" plus
text for reposts. Then TJ picks cutover or a twscrape fallback. After a few days of shadow data, compare coverage against IFTTT and plan the cutover: columns for the nested
handle in the live queues, a v2-shaped raw_payload for attribution, t.co gating in shouldResolveQuotedTweetForCandidate,
and turning the 7 applets off.

## Gotchas
- Downstream quote resolution only runs when text contains a literal t.co link, and parsers strip the "RT @x:" prefix.
  Synthesize IFTTT-compatible text.
- The unique key for reposts differs: IFTTT stored the wrapper id, FxTwitter gives the original id. A parallel run into
  the same table would double-process reposts.
- tweet_created_at must be ISO with a timezone.

## Cutover debrief (TJ asked, 2026-11-06)
- TJ plans to retire IFTTT. Wrote handoffs/IFTTT-TO-FXTWITTER-CUTOVER/DEBRIEF.md: reuse the queue tables, a per-account
  provider switch table (migration needs approval), enqueue only first sightings after switched_at, synthesised v2
  raw_payload for attribution, quote gate change, phases P0 scaffolding → P2 NHL_Rosters canary → DFO → GDL → CCC →
  FHFH → applets off. Receipt CLAUDE-IFTTT-TO-FXTWITTER-CUTOVER-20261106 in CLAUDE-TO-CODEX.md.
- Read-only prod check: queue tables have no source-value constraint (source default 'ifttt'); processors select by
  received_at, so original-time reposts still process. Retry skips everything while an intake pilot is configured.
- P0 built locally (TJ "Claude starts P0"): fxtwitter.ts queue mappers, index.ts switched-account enqueue,
  migration 20261106200000_tweet_intake_providers.sql (NOT applied), receiver switch, fxtwitterQueuePayload.ts quote
  handoff in both processors. Tests 15/20/56 pass, typecheck 0, eslint 0, index.ts shim-typecheck 0. Nothing deployed.
  Next (each needs TJ approval): deploy v5 → apply migration → web release → P1 parity → switch nhl_rosters.
- 2026-11-06 (TJ "Deploy v5 + migration"): edge function x-timeline-poll v5 deployed 17:49:34 UTC
  (verify_jwt=false; local sha256 fxtwitter.ts d80a9bd8…97ce, index.ts 02503cc0…5420; deployed source read back and
  matches). The tweet_intake_providers migration was DECLINED twice by the apply_migration permission check, even after
  TJ chose "Retry, I'll approve". It is not applied, so v5 should report providers "not_installed" (shadow only).
- About 18:05 UTC: TJ applied tweet_intake_providers by hand in the SQL editor. Verified: 7 rows all ifttt, RLS on,
  service_role-only grants, trigger present, advisor INFO only. Not in migration history: run
  `supabase migration repair --status applied 20261106200000` at commit time.
- 18:15 UTC P1 parity (TJ "Start P1 replay"): web/scripts/x-timeline-parity-replay.ts (read-only). 78/79 IFTTT rows
  paired (miss = CCC reply), 78/78 identical extraction, reposts credited 42/42 scraper vs 0/42 IFTTT, quotes carried
  10/10. Report handoffs/IFTTT-TO-FXTWITTER-CUTOVER/P1-PARITY-2026-11-06.md(+.json). Typecheck 0, eslint 0.
  Next: web release (Vercel build, approval) → P2 nhl_rosters canary; check post-oEmbed attribution there.
- Release plan (TJ "Plan the release", 2026-11-06): 14 lane files, base files identical on origin/master 4cd22f493 and
  octoberBranch. Excluded: web/scripts/x-timeline-parity-replay.ts (needs the uncommitted trainer lib), tasks/ docs.
  Pattern as #407/#409/#410: commit on octoberBranch → chef/release-x-timeline-p0 = origin/master + files in a scratch
  tree → gate (focused, unit, typecheck, lint; no UI so no build/e2e) → TJ approval → push branch, PR, squash-merge →
  expect fhfhockey READY + 3 CANCELED → smoke ≤5 GETs → octoberBranch merge -s ours + push. Migrations are idempotent;
  20261106200000 needs `migration repair` for CLI history. No Codex reply on lane ownership yet.
- TJ "Prepare candidate": lane commit 68b6b45bd on octoberBranch (14 files, author TJ, no attribution, not pushed).
  Candidate chef/release-x-timeline-p0 d34c81332 = origin/master 4cd22f493 + the same 14 files, in scratch clone
  rtree-x-timeline (node_modules symlinked; deps/config identical to master). Gate running (scratchpad gate-xt.sh).
  PR text in scratchpad pr-x-timeline.md. Waiting on the gate, then TJ release approval.
- Gate 1 on d34c81332: typecheck 0, lint 0 errors, but 3 unit failures from this lane: DFOFantasy/NHL-Rosters route
  tests (switch lookup ran before the source-account 400) and supportedBaselineMigration (new migrations unregistered).
  Fixed on octoberBranch e8c40ed16 (receiver check after validation; authority rows 110-112, counts 112/74/29/9, test +
  summary). Candidate amended to 5562a7ceb (17 files; master counts 108/71/29/8). 20261106200000 is "unknown" (not in
  ledger) until an approved migration repair. Gate 2 running.
- Gate 2 on 5562a7ceb green: focused 8 files/158; unit 16,113 passed, 61 skipped, 0 failed; typecheck 0; lint 0
  errors. PR text updated (scratchpad pr-x-timeline.md). Waiting on TJ release approval. Nothing pushed.
- Released #411 (TJ "Release it"): PR https://github.com/FHFHockey-dev/fhfhockey.com/pull/411, squash-merged as master
  70798d8c0 (tree == gated 5562a7ceb). Vercel: fhfhockey.com CANCELED, fhfhockey/cms/functions BUILDING at merge.
- TJ chose "Reword it, then push": unpushed octoberBranch commits rebuilt with commit-tree (same trees, authors and dates;
  only e3eeb7017's Co-Authored-By line dropped): e3eeb7017->058c21591, 68b6b45bd->3e31a0f38, e8c40ed16->bb6963fd3
  (1c5a3d7ea unchanged). The /trends superstyle session's notes may still name e3eeb7017.
- #411 live: fhfhockey dpl_Bj129CgSHD5pvizUeHQJeJ9Su6HQ READY 18:41:53 UTC, aliased fhfhockey.com; fhfhockey.com,
  cms and functions CANCELED (1 build). Smoke 2 GETs: / 200, NHL-Rosters webhook GET 405. A GameDayNewsNHL IFTTT
  delivery at 18:43:10 (after READY) was stored as source 'ifttt' and processed (rejected, normal parse outcome).
- The /trends session added 8cd3a7c43 (also Co-Authored-By) during the sync; reworded the same way -> dc66e20a8.
  octoberBranch synced as 55843f9ca (merge -s ours origin/master 70798d8c0, tree unchanged), pushed at 18:46:44 UTC.
- P2 canary (TJ "Switch NHL_Rosters"): tweet_intake_providers nhl_rosters -> 'fxtwitter' at 2026-11-06 18:50:10 UTC
  (trigger set switched_at). Rollback: update public.tweet_intake_providers set provider='ifttt' where
  source_key='nhl_rosters';  Scheduled task x-shadow-coverage-check (11-08 10:00 local) rewritten to add the
  canary checks (queued once, IFTTT dropped, processing mix, snapshots/attribution) and ask TJ: P3 DFO / wait / roll back.
- TJ chose "Fast stages": switch DFO + the 3 GameDay accounts once NHL_Rosters shows a few processed posts and one
  credited repost; CCC after a replies/burst probe; FHFH after its P6 writer. Auto mode blocked a scheduled check that
  could switch accounts unattended; replaced by read-only task x-canary-3pm-check (15:00 local 11-06).
- Safety-net thread started: local_c3bcbbcc-e312-49d9-96ff-4c2254a0a947 (x-safety-net): fallback scraper + IFTTT
  auto-failback design.
- Email watchdog (TJ chose the Supabase watchdog): migration 20261106210000_x_timeline_watchdog.sql (alert state table +
  public.x_timeline_watchdog(mode run|dry_run|test_email), Resend via pg_net, Vault 'resend_api_key' +
  'x_timeline_alert_recipient'), cron line appended to schedule.sql (*/5). Registered as pending (113/74/29/10);
  manifest test passes. Detection SELECTs verified read-only on live data (nothing firing). NOT applied: TJ adds the two
  Vault secrets, runs the migration and the cron line by hand. Uncommitted.
- Watchdog live (~19:25 UTC): TJ added Vault secrets (names verified only), ran the migration and the cron line, and
  sent a test email: Resend 200 with an id (request 1801). Readback: cron x-timeline-watchdog */5 active; function
  security definer, empty search_path, execute service_role only; dry_run clean, email_configured true. Not in the
  ledger, so the authority row is now "unknown" (113 records; 74 applied, 30 unknown, 9 pending); manifest test passes.
  Repairs pending (approval): 20261106200000 and 20261106210000.
- Loud alerts (TJ: warning emojis on errors): migration 20261106220000_x_timeline_watchdog_loud_alerts.sql replaces the
  function. 🚨 ACTION NEEDED / ⏰🚨 STILL BROKEN subjects, red HTML banner, what-to-do with the exact IFTTT fallback SQL;
  ✅ Resolved and 🧪 TEST stay calm; new mode test_alert sends a [SAMPLE] alert. Verified on a throwaway local
  PostgreSQL 15 with stubbed net/vault: 29 scenario checks pass (scratchpad pgtest/scenarios.sql; server stopped).
  Registered pending (114 records); manifest test passes. Not applied: TJ runs it by hand.
- TJ asked for an orchestrator thread: local_c95982ca-ff34-464f-824e-9e7487ba37b1 (cron-report-chef): cron report
  errors, FxTwitter health/coverage section, tweet-review + alias backlog status.
- TJ: "NO IFTTT fallback. We are removing IFTTT completely." Fallback = one layer-2 scraper from his list (free, least
  friction, not always-on). Steer sent to x-safety-net (queued). Loud-alerts email reworded: no IFTTT step; says missed
  posts are queued when FxTwitter answers again (up to 20/account) and to start the fallback scraper if it lasts hours.
  Re-tested locally: 28/28 checks (earlier "29" was a miscount). TJ approved the email design. Still to run by hand.
- x-safety-net handover (TJ approved design v2: L2 self-hosted FxEmbed mirror on Cloudflare, L3 twscrape + burner on
  TJ's Pi, no IFTTT). Reviewed index.ts.proposed (notes folder) + _shared/*: shim tsc 0, tests 37/37, no-mirror path ==
  v5. Must-fix found and sent back: recoverGap adds unstored rows OLDER than the stored boundary on the boundary page
  (probe: 14 stale rows) -> stale posts would be enqueued for switched accounts. Also flagged gap paging can starve the
  100 s budget. Not applied yet; config.toml [functions.x-timeline-ingest] waits too. Live failed reads after retries
  16-19% per half hour (was 7-13%).
- Cron-report lane 2 (local_10cd8715) proposed persisting poller runs: migration 20261106230000_x_timeline_poll_runs.sql
  (their file) + capture job every 15 min. Replied OK with 3 amendments: add via/gap_state/gap_pages for v6; count
  missed runs from cron.job_run_details (job 'x-timeline-poll'), not the 720/day cadence; keep their match filter. I add
  the authority row (pending) and the schedule.sql cron line once they say the file is final. TJ applies by hand.
- x-safety-net: TJ re-confirmed L3 = twscrape on his Pi (declined GitHub Actions; the Pi is new, walkthrough B0
  added) and the FxEmbed mirror. No-login alternatives re-checked dead (Nitter 410, xcancel 451, vxtwitter CF,
  syndication stale). Decided: Pi takeover keeps its own x_timeline_account_health RPC (6-min single-account rule),
  not alert_state. Re-sent the gap-recovery must-fix; offered a "fallback serving" info email later.
- Safety-net fix round 2: boundary fix OK (stops at first stored row; test added); "incomplete" now "deferred" (store
  nothing, retry next run); GAP_PAGES_PER_RUN 6 + half-budget cutoff. Sent back one more must-fix: deferral is
  unbounded (page 1 fine but cursor pages failing -> account stores nothing forever). Asked for a 6-minute cap based
  on the account's newest first_seen_at, then store page 1 and report unrecovered/abandoned, with 3 tests.
  Patch still not applied.
- Registered for the cron-report lanes (both pending): row 115 20261106230000_x_timeline_poll_runs.sql (lane 2, sha
  69ad4787..., refresh when final) and row 116 20261106233000_cron_job_audit_report_index.sql (lane 1, b6750726...).
  Counts 116 records / 12 pending; manifest test passes. The test had been failing while both files were unregistered.
- Safety-net round 3: deferral removed (fresh page never held; failures/budget -> "abandoned", older posts may be lost;
  GAP_PAGES_PER_RUN 16, stop paging past half budget). Reviewed and APPLIED locally: x-timeline-poll/index.ts = proposed
  v6 (sha 7b02bf69...), config.toml [functions.x-timeline-ingest] verify_jwt=false. Tests 80/80 (safety-net 24,
  fxtwitter 15, receiver 20, manifest 21); Deno-shim tsc 0 for poll and ingest. npm run typecheck exit 2 only in
  cron-report.test.ts (cron-report lane, in progress). Not deployed: v6 deploy needs TJ approval.
- TJ "Deploy v6 now": x-timeline-poll v6 deployed ~19:59 UTC (index 7b02bf69, fxtwitter d80a9bd8, _shared fxSources
  f920da3e, fxGapRecovery 1d050df8, xTimelineStore 0fd7586c; verify_jwt=false). First v6 run 20:00: 200, all 7 ok,
  via=public, no gaps. Canary: first 2 NHL_Rosters posts via scraper (2118795302694174841 processed in 3 s;
  2118795702604312803 pending at 20:02); 0 IFTTT nhl_rosters rows since the switch. Reposts still unverified.
- New failure mode: STALE FxTwitter profile feed. CCC 19:42 "NHL Starting Goalies" (2118791055374225476) is absent
  from /2/profile/CcCMiddleton/statuses at ~20:00 (newest 19:16) though /2/status/{id} returns it and reads succeed.
  Invisible to the poller/watchdog. Sent to x-safety-net (mirror union / Pi cross-check) and cron lane 2.
- Lane 2 final: row 115 sha c62595ff (3 tables), cron line 'x-timeline-poll-capture' (*/15) added to schedule.sql.
- Lane 1 hand-applied 20261106233000 (cron_job_audit index; TJ pop-up). Verified read-only (valid, ready, 25 MB, def
  matches; not in ledger). Row 116 -> unknown; counts 116/74 applied/31 unknown/11 pending; manifest test passes.
  Ledger repairs pending TJ: 20261106200000, 20261106210000, 20261106233000.
- Lane 2 applied 20261106230000 (TJ) ~20:12 UTC via apply_migration; the ledger recorded it as 20261106201221
  (x_timeline_poll_runs). Row 115 -> unknown with that evidence (116/74/32/10; manifest test passes). Asked lane 2 to
  git mv the file to 20261106201221_x_timeline_poll_runs.sql and update REPORT_SECTIONS_MIGRATION + test strings in one
  change; then I mark row 115 applied. Capture cron jobid 402 */15 live (line already in schedule.sql).
- Lane 2 renamed the poll-runs migration to its ledger version (bfc6036e4). Row now
  20261106201221_x_timeline_poll_runs.sql, order 113, applied (exact receipt). Counts 116/75 applied/31 unknown/10
  pending; manifest test passes; schedule.sql comment updated. Asked lane 2 to add a feed-staleness warning (IFTTT
  newest more than 20 min newer than the shadow's newest sighting) for accounts still on IFTTT.
- position-aware-names (local_9ac129f2, started by swipe-trainer) applied 20261106204707_lineup_player_name_alias_
  position_group (ledger exact; column + F/D/G check verified). Registered as applied, row sorted after 201221. Counts
  117/76 applied/31 unknown/10 pending; manifest test passes (it had been failing on the unregistered file).
- Lines IGA chef ticket (TJ-approved): queue rows now carry raw_payload.first_seen_at (toQueueRow 3rd arg; storeAndEnqueue
  passes it from its first_seen lookup). fxtwitter.ts 37e8fd38, _shared/xTimelineStore.ts 42febbc6. Tests 39/39, shim
  tsc 0 (poll + ingest), eslint 0. Local only: ships with the next poller deploy (v7, TJ approval). Uncommitted.
- TJ "Deploy v7 now": x-timeline-poll v7 deployed ~00:05 UTC 11-07 (fxtwitter 37e8fd38, xTimelineStore 42febbc6; other
  files as v6). Runs 00:04/00:06: 200, all 7 ok. Verified: nhl_rosters 2118857705532121311 queued 00:08:03 with
  raw_payload.first_seen_at set, processed. Lines chef told. Code uncommitted.
- 2026-11-07 03:23 UTC (TJ: IFTTT credits exhausted, migrate all): switched dfofantasy, ccc, gamedaylines,
  gamedaynewsnhl, gamedaygoalies to fxtwitter, then backdated each switched_at to its last IFTTT delivery + 1 ms (DFO
  01:03:31, GDG 00:42:20, GDN 02:08:29, GDL 02:25:33, CCC 02:45:19). Only gap post: CCC repost 2118897727937359955
  (Gulls AHL lineup), enqueued by the 03:24 run, processed (rejected: non-NHL, expected). 03:24 run: 200, all ok,
  every line account reports enq. fhfhockey NOT switched: its social_share_x_posts writer (P6) isn't built, so FHFH card
  posts aren't recorded while IFTTT is down (last social_share post 11-06 16:37).
- P6 FHFH social-share writer (TJ: preserve matching + timestamps, dedupe vs IFTTT, verify a real post end to end):
  fxtwitter.ts toSocialShareRow (own post/quote with media, never reposts; posted_at = X timestamp; alt = first
  "FHFH " alt else first alt; matched_card via shared matcher); _shared/socialShareCard.ts = exact copy of postedWeek's
  ALT_TEXT_RULES/matchPostedCard (postedWeek now exports ALT_TEXT_RULES; parity test fails on drift); index.ts upserts
  social_share_x_posts on tweet_id ignoreDuplicates only for a switched fhfhockey; result socialWritten/socialError.
  Tests 103/103, shim tsc 0 (poll+ingest), eslint 0, npm run typecheck 0. Read-only real-data check: eligible scraper
  posts == IFTTT rows since 11-04 (3/3, none extra/missing); times differ only by IFTTT's minute rounding (18-45 s).
  Not deployed; fhfhockey not switched. Pending TJ approval, then end-to-end proof on his next real card post.
- TJ "Deploy v8 + switch": x-timeline-poll v8 deployed ~03:33 UTC 11-07 (index 554a8c13, fxtwitter 5ef50c4b,
  _shared/socialShareCard aa615e08; other _shared unchanged); fhfhockey switched 03:33:23. social_share_x_posts had 9
  rows. Runs 03:34/03:36: fhfhockey 404s (writer skipped). Runs 03:38 (200, 7 ok) and 03:40: fhfhockey ok,
  socialWritten 0, rows still 9 -> dedupe vs IFTTT verified on the 3 overlapping posts. NOT called live yet: a real
  new card post must pass end to end. Read-only scheduled check 'fhfh-social-share-e2e-check' at 13:00 ET 11-07.
- Scheduled read-only check 'x-canary-3pm-check', run 2026-11-07 14:18 UTC (SELECTs only). Window: since 11-06 18:50:10.
  1 Poller: x_timeline_poll_runs 581 runs (18:52 -> 14:14); providers 'ok' every run; 0 enqueue errors. 252 runs
    returned 207 (partial): per-account failed reads, all 404 after 3 attempts: nhl_rosters 45/581 (7.7%), dfo 51,
    fhfh 56, gdl 57, ccc 60, gdn 60, gdg 63. Longest failure streak 2 runs (4 min) on every account; steady ~5-10%
    per hour, no worsening trend. (net._http_response only keeps 08:20+; 77/180 were 207 there.)
  2 Queued once: 6 shadow nhl_rosters rows first seen after the switch, 6 fxtwitter queue rows; 0 missing, 0 dupes,
    0 queue rows without a shadow row.
  3 IFTTT dropped: 0 nhl_rosters ifttt rows after 18:51 (last ifttt 11-06 17:19:14).
  4 Processed: 4 processed / 2 rejected / 0 pending (lag 2-62 s). IFTTT previous 7 days: 20 processed / 7 rejected.
  5 Repost credit: no nhl_rosters repost since the switch (6 own posts; newest post 00:06:58 UTC, about 14 h quiet,
    not checked for staleness). Other account: GDN fxtwitter repost 2118920212221161472 snapshot source_handle =
    DylanLoucks4 (original author), author_name Dylan Loucks; rejected (rejected_ambiguous). metadata has no
    attribution/original keys; tweet_projection_reports has only attribution_attempts/next_attempt_at, and payload
    has originalUrl/originalPublishedAt; no report for any repost. Credit is in source_handle only, on a rejected row.
  Recommendation: the staged choice is moot, because every account was switched at 03:23 (TJ). By the rules it would
    be "switch DFO + GameDay" (1-4 clean, 4 processed, a repost credited via source_handle). Next step: keep
    nhl_rosters on fxtwitter (no rollback) and confirm credit on the first PROCESSED repost. Nothing changed.
- Scheduled read-only check 'fhfh-social-share-e2e-check', run 2026-11-07 18:04 UTC (SELECTs only). Result: NOT YET -
  no real FHFH card post since the switch. Re-run after TJ's next card post.
  1 Scraper rows: 0 social_share_x_posts rows with provider fxtwitter; table still 9 rows (newest 11-06 16:42:34).
  2 Completeness: 3 fhfhockey shadow rows first seen after 03:33:23 (newest 16:36 UTC), all post_kind repost; 0 eligible
    (own post/quote with media) -> nothing missing.
  3 Duplicates: count 9 = distinct 9. Reposts written by the scraper: 0.
  4 Poller (net._http_response keeps 12:04+ only): 180 results, fhfhockey ok 169/180 (93.9%); 11 failures all 404 after
    3 attempts, isolated (none consecutive). socialWritten 0, no socialError values.
  5 Card match: not testable (no scraper rows, so alt_text not observed yet).

## Checkpoint 2026-11-07 ~19:45 UTC (orchestrator inventory, read-only)
- Poller v6/v7/v8 + social-share writer are committed in c26c3add3 (on origin/octoberBranch). Nothing in
  x-timeline-poll is dirty.
- Layer 3 moved to GitHub Actions (child x-fallback-gha): master 194d55e72 (7 files), migration 20261107181046
  applied, x-timeline-ingest v1 deployed (shadow only). Its other files are uncommitted on octoberBranch.
- Lineup alert (child lineup-ingestion-alert): parser fix 040c59341 local, not pushed. Grandchild roster-last-seen
  migration 20261107192933 applied with TJ's approval; reader + tie-break uncommitted.
- Still pending: 20261106220000 loud alerts (authority: pending), 20261106210000 + 20261106233000 (unknown).
- Inventory report: side-session-notes/local_c4e6c533.../inventories/x-intake-ifttt-replacement.md
