# Bounded integration ownership

Owner: existing Luna delegated worker. Base: octoberBranch 431ffcd673b42ad4a149dc3f9dfb03005dbec75a.

New files only: web/lib/sources/tweetLunaReview.ts, tweetLunaTransport.ts, tweetLunaLocalStore.ts, tweetLunaReview.test.ts, fixtures/tweetLunaAdjudicatedLibrary.json; web/scripts/review-ifttt-luna.ts; this artifact directory and task diary. Any additional paths require an updated declaration before editing. Existing deterministic routes, retained Decisions reference, R1 corrections, other workers' files, migrations and dependencies remain untouched.

Acceptance: one finite integration suite covering disabled behavior, source/identity/game/time bindings, grader provenance, contradictions/retractions, replay, timeout/invalid output and aggregate budget enforcement; relevant existing boundary tests once; narrow static checks. No production accuracy claim from mocks. Previously exposed S01–S10 are development cases; retain their mixed human/assistant label provenance and missing canonical/game data.

Post-retention manual caller first; no automatic webhook fan-out. Hosted polling/source export and shared durable budget store remain deployment decisions. No new migration or credentials. Release coordination stays with 01a1637a-4222-70c0-8439-cb3cc46b20c4; no independent commit/push/deploy.
