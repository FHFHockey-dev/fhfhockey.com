# SEC-02 resumed review and release handoff

Reviewed on 2026-10-15 after TJ resumed the security repairs. This review examined the saved implementation afresh before any application edit; no additional application changes were needed. No separate agent was spawned. Final acceptance belongs to the release coordinator.

## Decision and exact scope

The two-file patch is ready for coordinator acceptance as a fix for the reported **Host-only bypass from a non-loopback socket peer**. It is not a guarantee that the original caller behind a trusted local forwarding process is local.

Accepted candidate files and SHA-256:

| File | SHA-256 |
| --- | --- |
| `web/utils/adminOnlyMiddleware.ts` | `491c123b5e765546bcda1e81c0b0ae7d197d58413236a399d458ec80177c924f` |
| `web/__tests__/utils/adminOnlyMiddleware.test.ts` | `baf3783a3103f06b5db2a28779636b56c454e2bcbace76986a9545c7067ac05c` |

Both hashes exactly match the saved pre-resume checkpoint. Base HEAD remains `a8f58de6178e282acd3a71851c66f4a56b119f14` on `octoberBranch`. Only these application files are owned by this task; the SSRF proxy and other dirty changes were not edited. The saved `admin-bypass-fix.patch` remains current. All work is uncommitted; this task did not stage files.

## Security review

- The new development predicate requires exact `NODE_ENV=development`, an exact socket peer of `127.0.0.1`, `::1`, or `::ffff:127.0.0.1`, and the existing localhost Host restriction. Missing socket or address fails closed. It does not resolve client-supplied hostnames or consult forwarded/client-IP headers to grant access.
- Every request accepted by the new development predicate would have been accepted by the old predicate: explicit development is a subset of non-production, and the existing Host condition is retained. The added peer condition only restricts access. No new grant, credential, environment variable, permission, package, or security setting was introduced.
- A forged localhost Host and forged forwarded IP headers cannot make a non-loopback socket peer pass. The original unauthenticated reproduction now returns 401 before the handler runs or receives the privileged client. The normal remote bearer path is unchanged: rejected tokens return 401; missing/non-admin roles return 403; a verified admin role reaches the handler. Existing cron-secret matching and its missing/blank-secret denial are unchanged.
- Production, test, unset and empty environment modes never satisfy the development predicate, even with a loopback socket and localhost Host. Normal admin and cron authorization still work in production.
- Review followed the Supabase skill's auth/security guidance. The existing `getUser()` verification and role query were preserved; no session metadata, browser-controlled role claim or new auth mechanism was substituted. Both clients are mocked in the focused tests. No database query was run because this task authorizes local code/tests only.

## Local-proxy trust boundary

A reverse proxy, tunnel or other local process can make a remote original caller arrive over a loopback socket. The predicate deliberately authenticates the **immediate peer** for the existing local development exception; it cannot prove an end-to-end original identity through an arbitrary relay. Do not use this exception as authorization for untrusted traffic forwarded by a local process. Public/network-facing environments need the normal admin/cron authorization path; `NODE_ENV=production` already disables the exception.

Installed Next.js source was checked rather than assuming a transport model: `web/node_modules/next/dist/server/lib/router-server.js` passes the same request object to the render handler (`requestHandler(req, res)`, around line 240). `web/node_modules/next/dist/server/base-server.js` fills `x-forwarded-*` headers on normal direct requests (around lines 565–568). Thus blanket rejection of forwarded headers would reject ordinary local Next.js requests and would not establish trustworthy original identity. Header values are not used to bypass the socket check.

`web/package.json` development commands and `web/scripts/dev-stable.mjs` bind to `0.0.0.0`. They were inspected and left unchanged under the task's scope/settings restriction. A direct non-loopback connection to that listener now requires real authorization despite a spoofed Host. A local relay remains the explicit residual trust assumption. Neither deployed reachability nor any live proxy configuration was inspected.

No code change can distinguish an arbitrary local relay from another local process using only these identical request fields. Supporting an untrusted local relay while retaining an unauthenticated local bypass would need a separate authenticated boundary or a separately agreed removal of the exception. Neither was silently introduced here.

## Checks actually completed

| Check | Result and evidence |
| --- | --- |
| Regression against original guard | Expected failure: 13 failed / 24 tests; `admin-bypass-red.log` preserves the Host spoof reproduction. |
| Focused guard and operational-auth tests | Passed: 93 tests in 2 files (27 + 66); `admin-bypass-green.log`. Their source hashes still match that run, so successful tests were reused rather than repeated. |
| Focused ESLint on guard and nearest test | Passed, exit 0; `admin-bypass-lint.log` has no diagnostic output. Command from `web/`: `./node_modules/.bin/eslint --report-unused-disable-directives-severity warn utils/adminOnlyMiddleware.ts __tests__/utils/adminOnlyMiddleware.test.ts`. |
| Isolated TypeScript check | Passed, zero diagnostics using TypeScript 5.7.3 and the parsed `web/tsconfig.json` compiler options. Root files were the guard, nearest test, `next-bootstrap.d.ts` and `yahoo-fantasy.d.ts`; imported dependencies were included, `noEmit=true`, `incremental=false`. See `admin-bypass-types.log`. This is not a full-tree compiler run. |
| Final two-file diff/whitespace review | Passed: actual saved diff read on resume and `git diff --check -- web/utils/adminOnlyMiddleware.ts web/__tests__/utils/adminOnlyMiddleware.test.ts` returned exit 0. No application files changed afterward. |

No full-tree compiler, build or browser server was started, so no competing compiler/build needed coordination. No full-tree lint/suite or browser/production check was claimed. An attempted read-only process listing was denied by the sandbox; all task-started commands returned completion, and this task has no running session or server. The Supabase changelog Markdown could not be rendered by the web reader; no Supabase API/signature/configuration change was made. The existing `getUser` reference page was accessible.

## Coordinator next action

Review and accept the exact two-file candidate above with the stated local-process trust boundary, or explicitly request a stronger development-auth contract if an untrusted local relay must be supported. No code/test/type/lint failure remains in this scoped candidate. General deployment exposure, live proxy configuration and final independent/coordinator acceptance remain unverified. Do not push, deploy or change settings based on this handoff alone.
