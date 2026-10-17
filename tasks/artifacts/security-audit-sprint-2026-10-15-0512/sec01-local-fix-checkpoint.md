# SEC-01 local fix checkpoint and resume handoff

Stopped immediately on TJ's explicit “checkpoint all. 3%” instruction. This is an unfinished, unreviewed local draft, not an accepted or verified fix. No further tests, passes, or delegations were started after the stop request.

## Ownership and boundaries

Parent task: 01a10d0c-2480-73ea-aa65-3be0547bd0d5. Canonical checkout: /Users/tim/Code/fhfhockey.com on octoberBranch. Own only proxy route/helper and nearest tests; another worker owns Host-header bypass. Read AGENTS.md, mise-en-place.md and the named findings report. Existing extensive dirty tree was inspected and preserved. No other branch/worktree created. No credentials/settings/network config/database/RLS work, real exploit/production requests, installation, push, or deployment. No child agents started. No processes left running by this task.

## Exact implementation files

- Modified: web/pages/api/cors/index.ts (was clean at task entry).
- Added: web/lib/NHL/corsProxy.ts.
- Added: web/__tests__/pages/api/cors.test.ts.
- Unchanged browser helper: web/lib/cors-fetch.ts.
- Checkpoint artifacts: this file, sec01-local-fix-draft.patch, sec01-cors-original.ts.txt, and initial notes /tmp/fhfh-sec01-checkpoint.md.

## Context diary and completed evidence

1. Confirmed original route accepted caller query URL and method, fetched anonymously, followed default redirects, and had no DNS/address or size/time policy.
2. Inspected every direct browser cors-fetch import and indirect fetchWithCache consumers. Verified browser destinations are api-web.nhle.com and api.nhle.com. Server-side cors-fetch bypasses the proxy and remains unchanged.
3. Added one mock-only regression, then ran from web/: npm test -- --run __tests__/pages/api/cors.test.ts. Result: FAILED as expected on the original route, received 200 instead of expected 400. Fetch was replaced with an in-memory Response for synthetic http://127.0.0.1:7777/synthetic plus query method DELETE; zero network requests. This is reproduction evidence, not a passing fix test.
4. Applied the draft route/helper patch. Stopped before executing any post-fix checks.

Verified caller resources:
- components/ShiftChart/data.ts: boxscore, play-by-play, shiftcharts, schedule/date.
- components/LinemateMatrix/index.tsx and hooks/useGoals.tsx: gamecenter resources and shiftcharts.
- pages/game/[gameId].tsx: boxscore, landing, team summary and powerplay.
- pages/index.tsx and components/HomePage/useHomepageGames.ts: schedule, standings/date or now, landing.
- components/TeamLandingPage/goalieTrends.js, components/GoalieShareChart/index.tsx, components/WiGO/OpponentGamelog.tsx: club-schedule-season, goalie summary, season.
- components/TeamDashboard/TeamDashboard.tsx: club schedule, goalie summary and advanced.
- pages/goalies.js: goalie summary pagination (limit 100), season.
- hooks/useTeamSummary.ts and utils/fetchCurrentSeason.ts: team summary and season.
- lib/gameGoalProjections/fetchData.ts: score/date.

## Draft behavior and tradeoffs

The URL query is retained for compatibility but accepts only canonical HTTPS origins for those two fixed NHL hosts, exact path patterns, known statistics query keys with no duplicates, and GET only. Rejects arrays, credentials, nonstandard ports (even explicit :443 via canonical spelling), fragments, controls, backslashes, alternate host spelling and normalized path tricks. Shiftcharts requires a single numeric 10-digit gameId expression. Stats limit is 1–100; start has up to six digits; maximum URL 8192 characters and query value 2048 characters. The remaining NHL stats expressions still support existing caller predicates; this is not a full provider query grammar.

Transport changes from global fetch to the existing node-fetch v2 dependency. A per-request HTTPS Agent invokes a custom DNS lookup at socket connection time, requests IPv4 answers, rejects empty/failing/mixed private or reserved answers, and returns the exact checked address to TLS with the original hostname retained. No second lookup between policy and connection. IPv6-only upstream service deliberately fails closed; no IPv6 transition fallback. Redirects use node-fetch redirect:error. A 10-second AbortController deadline spans request and body; node-fetch's 4 MiB decoded-body size limit bounds JSON/HTML response reading. Agent/timer are cleaned in finally. Error response hides raw transport details. No caller rate limit introduced; anonymous allowed-upstream usage remains a separate availability concern.

These statements describe intended source behavior, not test-verified behavior. Public IPv4 selection may reduce availability if an upstream becomes IPv6-only. Verify legitimate response sizes under local fixtures. No live provider availability or latency test occurred.

## Pending verification and independent-review handoff

Resume only after explicit direction to continue; current instruction is stop/checkpoint.

1. Inspect saved patch and actual files for correctness and small scope; original route snapshot is retained in sec01-cors-original.ts.txt. Test import resolves through web aliases. Review exact canonical URL checks, path coverage, DNS/private range policy, HTTPS hostname verification, redirect behavior and time/size cleanup.
2. Before running new tests, mock node-fetch (the new transport) and node:dns lookup. Existing regression only stubs global fetch because it was authored against the original route; extend it to guarantee NO real network requests in all cases. Do not test via application requests or production. Avoid re-running the whole historical safe-local-checks.cjs because it asserts old vulnerable behavior and belongs to the audit artifact.
3. Add targeted tests for accepted real caller URL patterns/queries, HTTP method and repeated query rejection, IP literals/numeric encodings, userinfo/suffix-host/port/fragment/control/backslash/dot or encoded path tricks, disallowed paths/query keys, unsupported protocols; rejection must precede transport.
4. Add mock DNS tests for public IPv4 pinning, each private/link-local/loopback/reserved range, mixed public/private answers, empty/error answers, IPv6/mapped answers, and rejection of unknown hostnames. Test actual passed agent lookup behavior so there is no precheck-then-fetch rebinding race. Family 4 should prevent Node auto-family all:true semantics, but confirm with local Node 22.11.0 types/mocks.
5. Add node-fetch request mocks for redirect rejection, deadline abort, size overflow/body failure, cleanup, success JSON and retained HTML/error handling. Can exercise real node-fetch Response reading from synthetic streams for size limits without opening sockets.
6. Run focused route/helper tests, existing lib/cors-fetch.test.ts and relevant ShiftChart/LinemateMatrix caller tests. Then scoped lint and/or TypeScript checks as warranted. No build. Commands available from web/: npm test -- --run <specific files>; npx tsc --noEmit; npx eslint pages/api/cors/index.ts lib/NHL/corsProxy.ts __tests__/pages/api/cors.test.ts. Node was observed v22.11.0 as required.
7. Have Chef independently review final tested diff before acceptance. No independent review has happened. Do not claim SEC-01 remediated until the remaining verification is complete.

Checks state: original mock reproduction FAILED expected regression assertion (confirmed vulnerable source); post-fix tests NOT RUN; lint/typecheck NOT RUN; independent review NOT RUN; browser/live checks NOT RUN by design. Blocker: user-directed quota checkpoint, no technical blocker established yet.


## Resumed work checkpoint

Resumed local tests/type/lint completed; stopped again under the explicit Standard-speed verification gate. See `sec01-resumed-checkpoint.md` and `sec01-local-fix-resumed-manifest.json` for current exact state. Independent review remains pending.
