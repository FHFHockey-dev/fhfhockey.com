# FxTwitter migration verification — November 7, 2026

- Scope: Read-only reconciliation of the requested remainder migration against current Supabase receipts and the existing Claude owner. No source changes, deployment, credentials, or external communication.
- Where: Canonical checkout /Users/tim/Code/fhfhockey.com, current commit 691819d58. Many existing modifications, including Claude fallback files, are preserved.
- Checkpoint: Historical seven-source cutover supersedes the scheduled remainder work. Current social-share table still has nine historical rows; current primary and fallback receipts are being checked.
- Next: Verify current providers, gap scope, owner diary, and pending social event.

## Verified checkpoint, 20:05–20:12 UTC
- Supabase: all 7 provider rows are fxtwitter; x-timeline-poll v8 and x-timeline-ingest v1 are ACTIVE. Prior 2 hours of persisted account reads have 0 enqueue errors; intermittent failed reads remain; no active watchdog alerts.
- Six lineup/news accounts: 165 stored scraper rows since source boundaries, 165 FxTwitter queue rows, 0 missing keys, 0 duplicate keys. The Gulls post 2118897727937359955 was queued 03:24:05 and rejected. This is coverage of stored scraper rows, not proof every X post was captured.
- Downstream statuses: 127 processed, 36 rejected, 2 failed. The two failed DFO rows are Zach Hyman 2119125998478430401 and Alex Turcotte 2119127128704975146; both have accepted injury snapshots, so this is downstream processing, not an intake gap. No replay performed.
- NHL_Rosters repost 2119120779908383083 is processed; snapshot source_handle renlavoietva, author_name Renaud Lavoie, provenance relayAccount NHL_Rosters. This resolves the prior first-processed-repost evidence gap.
- Social writer: still 9 historical rows. Since switch, 6 reposts and 1 media-less quote were observed, none eligible. Existing Claude diary records 18:04 E2E check as NOT YET. Await next actual own-media/card post; no failure proved.
- Existing fallback owner diary: observations migration and ingest deployed about 18:10/18:13; GitHub workflow on master 194d55e72. Independently verified master SHA, 0 Actions variables, 0 Actions secrets, 0 workflow runs and 0 observations. Shadow remains gated off, live fallback unproven. Do not collide with owner or handle cookies/secrets without action-time approval.
- Poller/writer code is now in commit c26c3add3, reachable from remote octoberBranch; earlier uncommitted status is stale. Hosted ingest adaptation remains modified/untracked in owner's checkout.
- No source switch, database write, replay, dependency install, external communication, build, deploy, or credential changes performed. Only this diary was written.
- Final downstream check: both failed DFO jobs exhausted 8 attempts at failure_stage projection_storage. They require diagnosis and a separately approved scoped replay; this review did not change them. Report handed to parent for coordination with the existing parser/lineup owner.

## Follow-up: downstream failure diagnosis
- Parent requested read-only diagnosis of the two DFO projection_storage failures and current impact, coordinated against the existing Claude lane. No code change or replay authorized. Existing Claude modifications are preserved.

## Downstream diagnosis complete, 20:09 UTC
- Exact audit error: duplicate key on player_forecast_lineup_assign_snapshot_id_unit_type_unit_nu_key, 10 DFO route failures from 17:54:16 to 18:12:29. Database constraint is UNIQUE NULLS NOT DISTINCT (snapshot_id, unit_type, unit_number, slot_number, player_id, raw_player_name).
- Root cause: each DFO post parses two injury claims for the same player (header availability unknown, return sentence uncertain). sourceObservations.ts assignmentsFor maps both to the identical injury/null/slot 1/observed assignment. Pure local reproduction of the actual function returned two identical rows for each player. No database writes or endpoint invocations used.
- Partial state: both raw snapshots, projection reports, two player events per post and derived source snapshots exist. Neither derived injury forecast lineup snapshot exists; atomic capture rolls its snapshot/assignments back on the duplicate error. Raw jobs exhausted 8 attempts and remain failed. Other DFO work is proceeding: 8 processed and 1 rejected after 18:13; latest audit runs succeed.
- Existing ownership reconciled from diaries and dirty diffs: Claude X chef local_1fb55d9b, lineup lane local_a60d6104; adjacent roster-last-seen work owns identity/parser files but not sourceObservations.ts. No note found addressing this duplicate-assignment defect. No external-Claude message was sent: parent has not supplied user approval for that communication.
- Recommended narrow fix: deduplicate identical forecast assignments before atomic capture, keep both evidence claims upstream and retain uniqueness/transaction protections. Test this same-player header+return pattern, exact retries, and conflicting assignment statuses without silently picking a winner. After local proof, release and a replay limited to the two IDs each need appropriate approval. Do not blindly re-run or modify stored evidence.

## Local fix scope
- Parent requested the narrowly scoped local assignment deduplication fix and tests. Owned files: web/lib/player-forecasts/sourceObservations.ts and its existing playerForecasts.test.ts, both clean at start. No source parser changes, push, deployment, database repair, or replay.

## Local fix checkpoint
- sourceObservations.ts now deduplicates only identical interpreted assignments, including assignment_status in the identity. Original interpretation events are not mutated; differing statuses remain distinct. Legacy no-interpretation path unchanged.
- Two real-pattern regression tests failed before the fix, then passed. Existing playerForecasts.test.ts: 85/85 pass. New tests cover Hyman/Turcotte parsing, unchanged source claims, stable mocked atomic-capture retry payload, and preservation of conflicting statuses. Focused eslint passed. Typecheck and adjacent suites pending.
- Final checks: 254 tests passed across playerForecasts (85), projectedLineups (58), and tweetInterpretation (111); focused eslint passed; npm run typecheck passed; git diff --check passed. No production or remote checks run.
- Final scope: two code/test files, 42 insertions and 1 deletion. No source claims changed, migrations added, commits, pushes, deploys, or replays. Existing unrelated modifications preserved. Parent receives local handoff; live jobs remain unchanged until a separately authorized release/replay.
