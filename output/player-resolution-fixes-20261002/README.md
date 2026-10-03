# Isolated resolver workflow fixes

Implemented and self-reviewed in `/tmp/fhfh-player-resolution-fixes`, branch `chef/player-resolution-workflow-fixes`, based on HEAD `73af9d051ecc755dd3695f5265bf5837bbfc7a4e`. The shared checkout's resolver source, stylesheet, existing dirty regression file and API route remain byte-for-byte unchanged. No commits, builds, merges, pushes, deployments, migrations, live alias assignments or real saves occurred. The local verification server was stopped.

## Changes

Only three application/test files differ in the isolated worktree:

- `web/pages/db/player-aliases.tsx`: preserves the original dropdown retention fix; discards obsolete queue and NHL lookup responses; guards all save actions synchronously against duplicate clicks; keeps mutation actions disabled until refresh finishes; preserves a draft on a newly selected queue item; includes review tokens for split saves; handles Ignore failures; clears loading in every current read outcome; offers a read-only refresh retry after a completed save; retains resolved/ignored history across pending-only queue reloads; rejects multi-hyphen or same-player splits.
- `web/pages/db/player-aliases.module.scss`: allows controls/grid items to shrink, stacks split fields on mobile and wraps action buttons. All checked controls fit at 320, 390 and 768px. Existing colors/type/panel conventions are reused.
- `web/__tests__/pages/db/player-aliases.test.tsx`: includes the original five audited regression cases plus 19 new async, save, token, error, retry, membership, scope and lifecycle cases.

Queue switching remains available during a mutation, so reviewers can start the next draft. A second mutation waits for the first mutation and its refresh to finish. Failed saves preserve choices. Successful saves followed by failed reads offer “Retry queue refresh,” which performs only GET and cannot duplicate the completed POST. Completion history is recorded only when the pending response confirms that the saved row has left the pending set; identity saves that remain pending for membership review do not inflate resolved progress.

Deep-linked `unresolvedId` reviews preserve their existing authorization scope and reach a completion state. They do not silently load the broader queue. The original unrestricted queue still advances automatically. The existing API count remains the fetched queue size, not a server-wide total; no API or authorization contract was expanded.

## Verification

| Check | Final result |
| --- | --- |
| `npm test -- __tests__/pages/db/player-aliases.test.tsx` | 24/24 passed |
| `NODE_OPTIONS=--max-old-space-size=8192 npx --no-install tsc --noEmit` | Passed |
| `npx --no-install eslint pages/db/player-aliases.tsx __tests__/pages/db/player-aliases.test.tsx` | Passed, zero warnings |
| Final complete browser matrix | 31/31 passed, Chromium 148.0.7778.96 |
| `git diff --check` | Passed |
| Incremental patch apply check against the shared dirty files | Passed; no patch applied |
| Cumulative patch reverse apply check against the isolated worktree | Passed; no patch applied |

The browser matrix reuses the audit harness, with expectations updated for intentional item-scoped completion, refresh serialization and exactly-two-part validation. It includes positive NHL lookup/import payload coverage, initial read response ordering and same-player split validation in addition to the previous scenarios. Final cases have zero page exceptions and zero unhandled rejections. Expected console resource failures come from blocked fonts/analytics and deliberate mock HTTP errors. Native select typeahead, Enter, Tab focus and actual element bounds were checked at 320, 390 and 768px; no scrollWidth-only shortcut was used. The 320px screenshot was visually inspected.

Browser integration at `/tmp/player-resolution-fixes-20261002/integration/web` consists of the original hash-pinned dirty audit baseline with only these three final files overlaid. Next dev regenerated `next-env.d.ts` in this verification copy; that declaration is outside the worktree patch. All 3,387 manifest entries were checked, with no other source differences. It runs on `http://127.0.0.1:3218` using Node 22.11.0 and copied existing dependencies; no dependency install or version change. All resolver GET/POST responses were mocked before navigation, service workers blocked, other API/non-GET/external traffic blocked, and dummy local Supabase configuration used. No production credentials or saved browser profile were loaded. `provenance.json`, `checks.json`, `receipt-final.json` and screenshots hold the evidence.

## Patches and review gate

- `incremental-from-audit.patch`: new workflow fixes and tests relative to the audited dirty resolver files. This patch is appropriate for integrating into the shared checkout after checking the recorded preimage hashes. `git apply --check` passed against those exact shared files; it has not been applied.
- `cumulative-from-head.patch`: complete three-file resolver change relative to repository HEAD, including the previously uncommitted dropdown fix and full regression file. Use it for a clean checkout of the recorded HEAD; do not apply both patches.
- `provenance.json`: base HEAD, branch/worktree, audit and final hashes, integration overlay parity, and shared source integrity.

Self-review checked guarded response acceptance, synchronous save locking before asynchronous authentication, failure release, retry without another POST, completion metadata deduplication, membership remaining pending, preserved item-token scope, unmount handling, option retention and mobile containment. It found an effect dependency warning; stable callbacks and explicit retry intent resolved it before the final checks.

**Independent review remains pending.** The blanket Max instruction was superseded by economical High/Medium guidance. [AGENTS.md](/Users/tim/Code/fhfhockey.com/AGENTS.md) and [mise-en-place.md](/Users/tim/Code/fhfhockey.com/mise-en-place.md) require actual model/effort verification before delegation and a lead effort strictly above each reviewer. The supported `read_thread` response exposes thread identity/status/cwd but no model or effort, and `CODEX_MODEL`/`CODEX_REASONING_EFFORT` are unavailable. No reviewer was created or falsely described as verified. A lead with verified High (or higher) effort can assign a Medium independent reviewer to these exact patches and receipts; review must remain local and must preserve the same ownership/action limits.

Live production authentication, deployed source parity and real database save/transaction behavior remain unverified. No server changes were made to solve these UI defects; backend idempotency and transactional split saves remain separate work.

## Reproduce

```sh
cd /tmp/fhfh-player-resolution-fixes/web
npm test -- __tests__/pages/db/player-aliases.test.tsx
NODE_OPTIONS=--max-old-space-size=8192 npx --no-install tsc --noEmit
npx --no-install eslint pages/db/player-aliases.tsx __tests__/pages/db/player-aliases.test.tsx
```

```sh
cd /tmp/player-resolution-fixes-20261002/integration/web
NEXT_TELEMETRY_DISABLED=1 NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:39999 NEXT_PUBLIC_SUPABASE_PUBLIC_KEY=mock-local-anon SUPABASE_URL=http://127.0.0.1:39999 SUPABASE_SERVICE_ROLE_KEY=mock-local-service CMS_URL=http://127.0.0.1:39999 npm run dev:stable -- -H 127.0.0.1 -p 3218
```

```sh
AUDIT_RECEIPT=receipt-final.json node /tmp/player-resolution-fixes-20261002/verify.cjs
```

The durable harness copy expects an adjacent `integration/web/node_modules`; the preserved `/tmp` execution folder has that baseline. macOS may require the same supported sandbox escalation approved for this audit. No sandbox-disabling flags were used.
