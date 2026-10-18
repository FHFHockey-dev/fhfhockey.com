# Security candidates A and B — continued review, 2026-10-17

Checkout `/Users/tim/Code/fhfhockey.com`, branch `octoberBranch`, HEAD `ceceb407a29b45f2e5b0c090ecfcff0c27e15d4c`. Repairs are uncommitted. Nothing was committed, pushed or deployed. No request reached FHFH production, Supabase or the NHL API. The exact hashes, commands and results are in `manifest.json`, and the logs are in `evidence/`.

## 1. Reconciliation with release 457435eb

Both candidates shipped in release `457435eb3010c5b3dd92d2e1a46d9c75d851780a` (deployment `dpl_6ccUfnYgqnueRsNEbSESqZmSbzPu`). Each shipped file was byte-identical to its saved pin:

| Increment in `proposed-release-manifest-v4.json` | Path | Released SHA-256 (= pin = HEAD before this work) |
| --- | --- | --- |
| ssrf-proxy | `web/pages/api/cors/index.ts` | `592944a9…c064` |
| ssrf-proxy | `web/lib/NHL/corsProxy.ts` | `f3236baf…fe50` |
| ssrf-proxy | `web/lib/NHL/corsProxy.test.ts` | `458a7ef2…44d0` |
| ssrf-proxy | `web/__tests__/pages/api/cors.test.ts` | `a3ca8483…e89e` |
| admin-bypass | `web/utils/adminOnlyMiddleware.ts` | `491c123b…924f` |
| admin-bypass | `web/__tests__/utils/adminOnlyMiddleware.test.ts` | `baf3783a…ac05c` |

The task text names `web/tests/utils/adminOnlyMiddleware.test.ts`. That path does not exist; the pinned test is at `web/__tests__/…`. No later change touched these six paths between the release and this work.

**Deployed evidence:**
- Candidate A: one smoke request, `/api/cors?url=http://127.0.0.1`, returned the expected 400. That request proves only that the deployed route rejects a literal non-NHL URL. It does not show DNS pinning, redirect handling, deadlines or size limits on the Vercel runtime. The release doesn't record which Node version Vercel used.
- Candidate B: there is no deployed evidence, and none is meaningful. The repaired code path only activates under `NODE_ENV=development`, which Vercel production never sets.

## 2. Candidate A: NHL proxy SSRF

### Properties verified (no defect found)
- **URL policy** (`parseNhlProxyUrl`):
  - Only `https:` is accepted, on exactly `api-web.nhle.com` or `api.nhle.com`.
  - Credentials, ports (including an explicit `:443`), fragments, backslashes and control characters are rejected.
  - Non-canonical spellings are rejected: uppercase, trailing dot, percent-encoded host, dot segments, or an encoded path. The raw path must equal the WHATWG-normalised path.
  - Paths come from a fixed regex or set. Stats query keys and values are bounded.
  - node-fetch v2.7.0 reparses the serialized href with legacy `url.parse`. The host is followed immediately by `/` and contains no userinfo, so I found no host differential.
- **Destinations:** the IPv4 blocklist matches the IANA special-purpose registry entries relevant here (0/8, 10/8, 100.64/10, 127/8, 169.254/16, 172.16/12, 192.0.0/24, 192.0.2/24, 192.88.99/24, 192.168/16, 198.18/15, 198.51.100/24, 203.0.113/24, 224/4 and 240/4, which includes broadcast). IPv6 is never dialled.
- **DNS and rebinding:** a mixed answer, an empty answer or a DNS error rejects the whole lookup.
  - **Verified on the real Node 22.11.0 stack** (`evidence/realstack-check.log`). Node's TLS/net path calls `lookupNhlAddress` exactly once per connection with `{all:true,family:4}`. A blocked answer fails before connecting. With the blocklist forced open, the socket dialled exactly the checked address: `ECONNREFUSED 127.0.0.1:443`.
  - No second resolution exists, so there is no TOCTOU window. Every DNS answer in that check was loopback, so no external traffic was possible.
  - The earlier 130-test receipt mocked `https.request` and could not show this.
- **Limits:**
  - `size` is enforced on node-fetch's decoded stream, so it applies after gzip, deflate or brotli.
  - The 10 s `AbortController` covers DNS, headers and body. Abort destroys the body, and `finally` clears the timer and destroys the per-request Agent.
  - Compressed input that produces no output is bounded only by the deadline. That is acceptable because only the two NHL hosts can be dialled.
- **Errors:** non-GET requests get 405. A policy rejection, or a repeated `url` or `method` parameter, gets 400. Upstream failures get 502, and transport errors get a fixed 502 body. Upstream non-2xx responses were already 502 before the release, so client handling of 429 is unchanged.
- **Callers:** I mapped every browser-side `lib/cors-fetch` caller: game, ShiftChart, LinemateMatrix, homepage, goalies, GoalieShareChart, TeamLandingPage, WiGO, team summary, power-play blocks and current season.
  - Every URL family fits the allowlist, including the `limit=100` pagination in `pages/goalies.js` and the raw `[{"…"}]`, `'`, `<=` and space characters in stats queries.
  - Server-side callers (cron, API routes, `getServerSideProps`) use the non-proxy branch and are outside this boundary.

### Defects and findings

| ID | Severity | Finding | Status |
| --- | --- | --- | --- |
| A-1 | Medium (functional), no security impact | The released helper refused **all** redirects, including same-host redirects between allowlisted resources. Third-party NHL API references describe the allowlisted `/v1/{schedule,standings,score}/now` resources as answering 307 → `/v1/…/YYYY-MM-DD`. The browser caller `components/HomePage/useHomepageGames.ts` fetches `standings/now` through the proxy. Under the released code that becomes a 502 and team records silently disappear. The pre-release route used global `fetch` and followed redirects without limit. **Not verified live** (no NHL traffic allowed). | Repaired |
| A-2 | Low / informational | The route validates the raw string (≤ 8192 characters), but the helper revalidates the serialized href. Percent-encoding can push a long stats query over 8192, which yields 502 instead of 400. | Not changed |
| A-3 | Residual (out of scope) | Anyone can still relay requests for allowlisted NHL resources anonymously, including stats `cayenneExp`/`sort` strings up to 2048 characters, from FHFH's egress. There is no rate limit. This is an upstream-abuse and cost exposure, not SSRF. | Documented |

**Repro of A-1:** `lib/NHL/corsProxy.test.ts`, "follows one now-to-dated redirect…", and `__tests__/pages/api/cors.test.ts`, "relays a now resource through one approved dated redirect". Both fail against the released helper (`evidence/proxy-red.log`).

**Repair** (`1-proxy-redirect.patch`, helper only; the route is unchanged):
- node-fetch now runs with `redirect: "manual"`. At most **one** 301, 302, 303, 307 or 308 redirect is followed.
- The resolved `Location` must pass the same `parseNhlProxyUrl` policy. A missing, invalid or unapproved Location, or a second redirect, throws `Unsupported NHL redirect`, and the route maps that to its fixed 502.
- Each hop opens a new socket through the same pinned `lookupNhlAddress`, so DNS is checked again on the hop. All hops share the one 10 s deadline, and each hop has the 4 MiB decoded cap.
- The redirect body is consumed before the next hop. In node-fetch v2, an unconsumed body keeps its abort listener, and an abort or premature close then emits `error` on a stream with no listener, which is an uncaught exception.

**Regression tests added:**
- Unapproved destinations: metadata IP, `http:` downgrade, an explicit port, a lookalike host, userinfo, an unapproved path, a fragment, `[::1]` and an unparseable Location.
- A missing Location.
- A relative and an absolute approved hop.
- A second redirect.
- DNS rebinding to 169.254.169.254 on the hop.
- A stalled hop hitting the shared deadline.
- Route-level allowed and denied redirects.

## 3. Candidate B: local admin Host-spoof bypass

**Trust boundary as shipped:**
- `invokedByLocalDev` hands the service-role client to every `adminOnly` route when three things hold: exactly `NODE_ENV=development`, a socket peer in {`127.0.0.1`, `::1`, `::ffff:127.0.0.1`}, and a local Host.
- Production, test and unset environments never grant. The bearer and cron paths are unchanged.
- I confirmed in installed Next 15.5.22 (`base-server.js:565-568`) that dev handles API routes on the original request. When absent, `x-forwarded-for`, `-host`, `-proto` and `-port` are **filled** from the socket and Host using `??=`, so a direct local request carries only loopback or local values.

| ID | Severity | Finding | Status |
| --- | --- | --- | --- |
| B-1 | High where it applies (requires a dev server reachable through a relay) | A header-adding relay that presents `Host: localhost` delivers a remote, unauthenticated caller on a loopback socket. Examples: ngrok, cloudflared, localtunnel, Tailscale Funnel or VS Code tunnels with host rewrite, or a local reverse proxy. The released guard grants the service-role client on every admin route. It acts on whichever Supabase project the local env targets, which can be production. The relay's own `X-Forwarded-For` (the remote IP) was ignored. | Repaired (deny-only) |
| B-2 | Low (fails closed) | The `::1` Host branch was dead code, because `split(":")[0]` of `[::1]:3000` is `[`. The parser also accepted any suffix after `localhost:` (for example `localhost:3000:evil`). | Repaired |
| B-3 | Residual, not fixable with these request fields | A relay that adds no forwarding headers, or forwards Host as localhost without them, is indistinguishable from a local browser. Examples: `ssh -L/-R`, socat, kubectl or VS Code TCP port-forwarding. So is any SSRF or other process on the dev machine. | Documented |
| B-4 | Informational | The role lookup `from("users").select("role").maybeSingle()` has no user filter. It relies on the RLS policy `auth.uid() = user_id`, which is the only SELECT policy in the repo baseline (`20260716112908_production_schema_baseline.sql:40065`). The deployed policy was not inspected. Adding `.eq("user_id", user.id)` would remove the dependency, but changes the mocked chain used by many route tests. | Recommended separately |
| B-5 | Informational | The cron secret is compared with `===`, which is not constant-time. A remote timing attack is impractical, so no change was made. | Not changed |

**Repro of B-1:** the request has a loopback peer `127.0.0.1`, `Host: localhost:3000`, `X-Forwarded-For: 203.0.113.7` and `X-Forwarded-Host: abc123.tunnel.example`, with no Authorization header. The released guard ran the handler with the service-role client. The repaired guard returns 401 and never calls the handler. The test is "denies an unauthenticated tunneled request…", plus 12 other red cases in `evidence/admin-red.log`.

**Repair** (`2-admin-relay.patch`):
- The Host must match `^(localhost|127.0.0.1|[::1])(:\d{1,5})?$` exactly.
- New `hasOnlyLocalForwarding`. A request keeps the local exception only if all of these hold:
  - no `Forwarded` or `Via` header;
  - `X-Forwarded-Host`, if present, is a local Host;
  - every comma-separated `X-Forwarded-For` or `X-Real-IP` entry is a loopback address.
- These headers are client-controlled, so they are used **only to withdraw** the exception and can never grant it. Ordinary local requests still pass, including Next-filled values for `127.0.0.1`, `::1` and `::ffff:127.0.0.1`, and bracketed `[::1]:3000` now works.
- Grep showed that no other test reaches `invokedByLocalDev` = true (only the RSO diagnostic test sets a loopback peer, and that test uses its own predicate). The four route-auth suites still pass.

**Intended trust boundary after the repair:**
- In development, any process that can open a TCP connection to the dev server from the same host, and that carries no evidence of relaying another origin, is treated as an admin.
- That is a "trusted single-user workstation" assumption. Do not expose the dev server through a relay or tunnel that strips forwarding headers.
- `next dev` binds `0.0.0.0` (`package.json`, `scripts/dev-stable.mjs`, unchanged). LAN peers reach it but must now authenticate.
- Network-facing deployments rely only on bearer-plus-role or the cron secret. `NODE_ENV=production` disables the exception.

## 4. Accept / reject

- **Candidate A as released:**
  - **Accept** as the SSRF fix. Destination control is removed, and connection-time pinning is now verified on the real socket stack.
  - **Accept the A-1 repair** for the next release, conditioned on one bounded live check of `/api/cors?url=https://api-web.nhle.com/v1/standings/now` inside an authorized smoke budget. That check confirms both the NHL redirect behaviour and the repair.
  - Until that release, production still refuses NHL redirects. Do not describe the repair as deployed.
- **Candidate B as released:**
  - **Accept for its stated scope** (a direct Host spoof from a non-loopback peer).
  - **Reject as a complete local-trust boundary**, because of B-1.
  - **Accept the B-1/B-2 repair** as a deny-only narrowing, keeping B-3 as the explicit residual.
  - Production behaviour is unaffected either way.
- **What this review does not establish:** it does not show the site is secure. No full-tree tsc, full unit suite, build, browser, live NHL or production check was run. The database RPC revocation was out of scope and untouched.

## 5. Checks run (all from `web/`)

| Check | Result |
| --- | --- |
| Red run: new proxy tests vs the released helper | 36 failed / 94 passed (expected) |
| Red run: new admin tests vs the released guard | 13 failed / 35 passed (expected) |
| Focused green run: 10 files (proxy, cors-fetch, ShiftChart, LinemateMatrix, homepage, admin guard, three route-auth suites) | **274 / 274 passed** |
| Real-socket pinning check (loopback-only DNS) | Passed |
| Scoped ESLint on the six candidate files | Exit 0 |
| Scoped TypeScript program (6 files + root `.d.ts`, 787 sources) | 0 diagnostics |
| `git diff --check` | Clean |

**How the red runs were done:** I temporarily replaced the helper or guard with its HEAD blob, ran the tests, restored my version, and re-hashed it to confirm the restore.

**Follow-ups, not done here:**
- The RSO `diagnosticLocalOnly` predicate may carry the same relay residual. That code is RSO-owned and excluded from this task.
- B-4: bind the role query to the verified user ID.
- A-3: rate-limit the public proxy.

## 6. Update 2026-10-18 (S-08)

The patches were regenerated as `1-proxy-redirect.patch`, `2-admin-relay.patch` and `3-admin-role-binding.patch`. Patch 3 binds the role lookup to the verified user id (finding B-4). Applied in order to `ceceb407a`, the three patches reproduce the current bytes. The commit order, messages, test commands and results are in `COMMIT-PLAN.md`.
