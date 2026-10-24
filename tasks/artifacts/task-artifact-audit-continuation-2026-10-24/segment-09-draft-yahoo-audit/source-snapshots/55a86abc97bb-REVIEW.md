# S05-R1 independent re-review — 2026-10-24

**ACCEPT WITH LIMITS — original P2 S05-R1 resolved** for the exact two-file lifecycle correction. The unchanged hidden-token-refresh reproducer passes. **11 focused tests passed / 8 intentionally skipped**; scoped TypeScript and ESLint passed. All **148 owner pins plus the EVIDENCE receipt** match and remain unchanged. No new implementation defect was reproduced within this correction. Original failures and review packets remain intact; Scout retains acceptance.

## Exact pins and scope

| File | Before SHA-256 | Corrected SHA-256 |
| --- | --- | --- |
| `web/lib/forge-testing-grounds/TestingGroundsOwnerGate.tsx` | `741008b25f39935a3bafcd34d83908f34e97d2802da34cd8f40893e7d4f2c529` | `3bcd1c56aae644f7ea7f0caaaf7053d38feb03a33d5ed4412dc54592b8dc5f4c` |
| `web/lib/forge-testing-grounds/TestingGroundsOwnerGate.test.tsx` | `36c1b6b5bb1802f3bfb10a21f70f55be0f0421ef6d7dfece9d839866958a74fd` | `ad376e0cb335723bed1a741a24a418e2d88012f539260405a48b8848f34c4eee` |

The two retained `before/` copies match original pins; freshly generated before/after diff equals `correction.patch` exactly. Receipt hashes:

- HANDOFF.md: `5cbacd13d0b30702533370bd6d4e5cb3b16123344ac40670816bd7d4d575d9f7`
- EVIDENCE.json: `4296eeabffca1b43eeff677cf6f90524e45473ffe5ac5ed3ed290ab44c5f85ad`
- correction.patch: `18a2e562b2d8db33ca18764724f86037cbfdb4bbdd5eaaea967bbca91cd4663b`

The original reviewer control file remains SHA-256 **`a8ad74b144108e085fcc497a7d32698b3264c0662e8403b688c95ff3aadd3f42`**. Its original failing log remains `a1af9aa32ad3185b3db355c9f8e5a4f3427dc717147f1b6595fe5dc91f646d0a`. Both are protected in this packet's start/end pin checks. No original test or owner application file was edited by this reviewer.

## What the correction proves locally

The gate now requires an alive effect, matching session generation, visible document and cleared pagehide latch before access requests and before asynchronous success/error acceptance. A hidden auth event still withdraws prior authorization but cannot release lifecycle withdrawal. `pagehide` remains authoritative even when `visibilityState` says visible. Only `pageshow` clears that latch; a visible return reads the current session and performs a fresh access verification rather than restoring an old grant.

The focused set exercised:

- Unchanged original hidden-token-refresh failure, unchanged late-JSON logout control, and unchanged account-switch/late-initial-session/late-success logout controls.
- Owner's four new lifecycle controls: initially hidden mount and visible return; stale pre-hide JSON after visible return; pagehide restoration with visible or hidden pageshow. These check aborts, no hidden requests and current-session verification on return.
- Two independent adjacent controls in [lifecycle-controls.test.tsx](lifecycle-controls.test.tsx): a pending session read completed during pagehide cannot issue a request or use a hidden auth token; pageshow reads a fresh session. An old rejected fetch after a newly granted visible return cannot replace that grant with unavailable state or reflect its private error text.

This is the synthetic workspace's client lifecycle boundary. It does not prove native BFCache/browser event delivery, live Supabase session validity or server authorization, and it does not claim a real/sealed-data disclosure existed in the original bug.

## Commands and outcomes

Node 22.11.0 / npm 10.9.0 / Vitest 3.2.7, cwd `web/`, no `GIT_DIR`; mocked auth client and fetch only. One test worker, isolated reviewer cache. No server/browser or application request.

```text
npm test -- --run --config ../tasks/artifacts/forge-testing-grounds-2026-10-24/slice-05-r1-review/review.vitest.config.mts --maxWorkers=1 --no-file-parallelism
exit 0: 11 passed / 8 skipped, 3 files; 2.272 s command wall time

npx --no-install tsc --noEmit --project ../tasks/artifacts/forge-testing-grounds-2026-10-24/slice-05-r1/tsconfig.json
exit 0; 1.636 s command wall time

npx --no-install eslint lib/forge-testing-grounds/TestingGroundsOwnerGate.tsx lib/forge-testing-grounds/TestingGroundsOwnerGate.test.tsx
exit 0; 1.399 s command wall time
```

[COMMANDS.json](COMMANDS.json) and individual logs record exact checks. The first request was refused before any check because `/private/tmp/fhfh-heavy.lock` already existed; [COMMANDS.lock-refusal.json](COMMANDS.lock-refusal.json) preserves that original result. No lock was stolen or bypassed. A subsequent read-only observation found it absent, after which each check acquired/released only its own lock. No test failed in the successful bounded run, and no check remains blocked.

Owner's original config-path harness failure and later successful nine-test/static results remain unchanged in the frozen `checks.log`. The original slice05 failed reproducer, packets and all preserved source/dependency/evidence pins remain intact. No broad suite was repeated.

## Unchanged gates

Live owner activation remains independently blocked, **0 of 1 approved verification reads used**. This review used none, changed no owner configuration and performed no reload. The supported private verification transport, inherited profile/settings-write containment and existing-server ownership remain separate unresolved activation constraints. The denied static startup was not retried or worked around.

Server owner policy/API resource ownership and sealing findings from the original review remain unchanged. Default runner/store actions remain inactive. The correction adds no single-use request-budget enforcement, safe read-adapter validation, persistent runner, hosted integration, live data acceptance or model/provider authorization. No shared auth/config, credentials, migrations, packages, Git/index/refs, source repairs, production calls, server/browser slots or new workers were involved. Scope is S05-R1 only.
