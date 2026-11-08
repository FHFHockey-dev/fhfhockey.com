# FORGE rebuild connection guard

- Scope: diagnose the IPv6-only guard connection and prepare a bounded, fail-closed local fix; no rebuild or production writes without direct approval and no-parallel-job confirmation.
- Where: canonical checkout, octoberBranch; start HEAD 8ea0515e70748774f6a1380d48378e706e5ede78. Own only this diary and the guard changes/tests/handoff under tasks/artifacts/forge-pp-fix-2026-11-07.
- Read: AGENTS.md, Library CODEX-HANDOFF.md, rebuild script, REBUILD-SIZING.md, parked Claude forge-pp-fix diary, Supabase skill. Preserve substantial unrelated working-tree changes.
- Initial missing items reported before edits: exact project pooler setting, current IPv6 reachability, original run log, direct production approval and no-parallel-job confirmation.
- Current: existing guard queries current-database pg_stat_activity, holds one pg Client, waits 15s up to 20 times above 40. Need retain server-side measurement and fail closed.
- Next: inspect local pooler metadata / existing monitoring RPC definitions, verify relevant docs, implement isolated guard and mocked tests.
- Blockers: production rebuild approval/no-parallel confirmation not established in trusted user history. No production calls yet.
- Gotcha: session pooler transport does not make pg_stat_activity a pooler-client count; query still executes on PostgreSQL. Do not change shared env or guess a regional pooler endpoint.

## Checkpoint 23:55 UTC
- Exact project-linked session pooler found in supabase/.temp/pooler-url; matches project-ref and parked data-checks diary. No existing connection-count RPC found in the relevant local code/migration trees.
- Patched only the artifact script: guard-only URL override, matching project/database/session port, verified TLS, 10s timeouts, fail-closed count validation, read-only preflight and preserved 20 x 15s wait semantics. Dynamic imports keep rebuild code out of preflight/plan.
- Added artifact Node tests: 16/16 pass; --plan returns 49 dates. No dependency/config changes.
- DNS outside sandbox: direct host has AAAA only; Mac getaddrinfo(AF_INET6) fails. Initial sandbox DNS blocked, then read-only network escalation succeeded.
- One pooler preflight reached TLS but failed before authentication/query with self-signed certificate in chain. Need trusted Supabase root CA, not certificate-verification bypass. No database queries/writes completed.
- Next: obtain official CA, repeat the corrected read-only preflight once, then focused typecheck and handoff. Production write approval/no-parallel condition still pending.

## Handoff checkpoint 23:59 UTC
- Obtained official production CA from URL in Supabase dashboard source; /tmp/forge-prod-ca-2021.crt only, no shared trust/config edit. Earlier community-suggested URL returned 404. Corrected preflight retained verified TLS.
- Live preflight 23:57:32Z passed: 28 current-database backends, threshold 40, ready=true, exit 0. One count SELECT plus session settings; zero data writes. Direct IPv6 TCP probe returned errno 65 No route to host.
- Final offline tests 16/16 pass; focused typecheck against clean released a68f9b3d2 export passes; --plan 49 dates; diff check passes. Test-only assertion narrowing error fixed before final pass.
- Deliverables: patched rebuild script, sibling Node test, CONNECTION-GUARD-RESULTS.md with exact invocation, certificate provenance, hashes, observations and next step. Clean export /tmp/forge-guard-verify-mw2sizw3/web.
- Pending: direct production-run approval and fresh no-parallel-job confirmation. No Claude contact, no rebuild/postcheck, no commit/push/deploy. Keep diary while the production handoff is pending.

## 2026-11-08 approval and outage hold
- Trusted parent-thread transcript supplies direct Tim approval ("yes") for the bounded 2026-09-19..2026-11-06 FORGE rebuild, conditional on no parallel production job. Approval blocker resolved; do not ask again for this scope. 2025-26 remains untouched.
- Later steering: database reportedly down again; Lines processing is a possible, unverified cause. Hold all rebuild/production writes until health is restored, cause/mitigation understood, and absence of parallel production jobs independently confirmed.
- No rebuild was started. No production requests or writes made during this hold. Prior count=28 is stale and cannot clear it. Guard remains mandatory.
- Updated CONNECTION-GUARD-RESULTS.md to preserve approval and current blockers. Next: await incident-resolution evidence and no-parallel confirmation; then revalidate prepared local artifacts and use the existing guard before any approved rebuild work.

## 2026-11-08 coordination-plan request
- Parent reports read-only observations at 01:18–01:19 UTC: final rolling chunk succeeded 00:37:58 (1,830 rows), no running cron/unfinished route-runner rows, DB responsive at 17 backends. Treat these as supplied point-in-time evidence, not an exclusive window or new execution clearance.
- P3 reportedly disabled/deployed 00:26; independent flag/deployment/traffic verification incomplete. Recurring writers remain enabled.
- Scope now: document a concrete minimally disruptive coordination/load-guard plan and evidence needed to clear the hold. No code edits, job pauses, production changes, rebuild, or new production checks.
- Initial local finding: current guard samples only before each date; web/vercel.json includes every-minute routes, so a momentarily empty jobs table cannot ensure a writer-free 6–13 minute run.
- Next: inspect canonical schedule and relevant audit/lease semantics, then record the plan and required interpretation of no-parallel work.

## Coordination plan checkpoint
- Created COORDINATION-AND-LOAD-PLAN.md. Strict no-other-writer condition cannot be inferred from snapshots while independent writers remain eligible. Proposed least-disruptive alternative requires an explicit overlap-policy decision: serialize discretionary/heavy/conflicting writers, name permitted routine jobs, retain health/load gates. Default remains hold.
- Evidence needed: serving deployment + effective LINES_OBSERVATIONS_ENABLED + natural traffic drop; recent stable DB metrics/incident explanation; drained HTTP/SQL/local/queue work; current schedules/owner coordination; fresh bounded samples. Cron submissions and terminal audit tables do not establish absence of active HTTP work.
- Proposed execution after clearance: small-date pilot then one date per invocation; local-only game/pre-persist guard plus graceful stop/deadline (planned, NOT implemented). Preserve >40/15s/20 waits, scoped dates, single process, no version bump. Clarified guard timeouts do not cover REST writes and client exit does not prove rollback.
- Read-only local inspection only. Script unchanged, no production calls, no job pauses/settings, no Claude messages. Decision and mitigation/exclusion evidence pending; task remains on hold.
