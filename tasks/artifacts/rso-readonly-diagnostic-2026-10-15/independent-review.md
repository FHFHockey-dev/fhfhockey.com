# Independent review — prepared local RSO diagnostic

Verdict: **ACCEPT for bounded preparation, with the locality finding resolved.** No remaining actionable findings in the five reviewed files. This is source-review acceptance only. The diagnostic remains excluded from the release candidate and is not authorized to execute, establish a session, start a server, access an account, or deploy.

Reviewed on October 15, 2026 in the canonical checkout. No application/test source was edited. No tests, compiler, build, browser, diagnostic, database, provider, or network requests were executed by this reviewer. Verification comprised source/dependency inspection, SHA-256 comparisons, and offline reconstruction of the five added files from the patch.

## Resolved finding

The initial P2 finding was a Host-only locality check at `web/lib/rosterScheduleOptimizer/diagnostic.ts:8`, consumed by the HTML and context routes. A remote peer could supply a loopback Host header and pass that former guard. This did not establish an owner-authentication bypass: the context endpoint still required normal authentication and owner verification.

The corrected helper at lines 8–9 also requires the server-observed peer to be `127.0.0.1`, `::1`, or `::ffff:127.0.0.1`. Both call sites pass `req.socket.remoteAddress` before authentication/data work: HTML route line 10 and context route line 14. An unknown peer or remote peer fails closed; forwarded headers are not trusted. The new API regression checks spoofed localhost Host from a remote peer against both routes, and the helper fixture covers remote/unknown peers. This resolves the finding for direct connections. The documented prohibition on proxies/tunnels remains necessary because a local proxy would itself appear as a loopback peer.

## Inspected behavior

- Standalone API-served HTML bypasses `_app`, AuthProvider, optimizer effects, and the browser auth SDK. It has no external scripts/assets, uses a nonce CSP, and sends a private no-store response.
- Mounting the HTML performs no account request. The explicit approval/one-use control reads the existing exact project session key without storage mutations, refresh, session creation, or token import. Missing/malformed/expired/soon-expiring sessions stop locally. The sole same-origin GET omits cookies, rejects redirects, and has no retries. Credentials and thrown errors are not rendered.
- The context endpoint checks locality, GET method and absence of scope overrides before reads. It awaits normal Bearer verification, then a fresh matching owner record and the existing verified-owner predicate before cached data access. It does not invoke entitlement/grant or user-record creation helpers.
- At most five logical backend operations are awaited sequentially: session verification, owner verification, cached league, cached owned team, and the exact workspace. League/team ambiguity, season mismatch, account/key/ownership mismatch, query errors and invalid saved context/version stop rather than repair data. No explicit provider call, persistence mutation, RPC, save or restore exists in the inspected path.
- The response constructs a limited summary. Raw workspace/snapshot/metadata, connected-account identifiers, email and credentials are not exported. The payload hash and counts are explicitly not a restorable backup. Cached imported facts remain distinct from current provider authority; current provider matchup/dates/timezone stay null. October 12–18 remains a working assumption. Missing rows and failed reads remain distinct.

Direct dependency inspection included the existing `requireApiUser`, verified-owner predicate, token-client construction and lazy server client. No new authorization or persistence side effect was identified along the calls used here.

## Exact accepted pins

| Path | SHA-256 |
| --- | --- |
| `web/lib/rosterScheduleOptimizer/diagnostic.ts` | `c9c8d0343942bfd7919ac126a86d3995f0ac78aff2dc18daf83f72e104e05af8` |
| `web/lib/rosterScheduleOptimizer/diagnostic.test.ts` | `3b711619fb017bb3e39e957a5f8b5a02e608e2af12d83310e1ee38ab50b2232a` |
| `web/pages/api/v1/roster-schedule-optimizer/diagnostic.ts` | `98e98ec4e506e053650698404e1871fe0dd601d0bb9373631674387590c72719` |
| `web/pages/api/v1/roster-schedule-optimizer/diagnostic-context.ts` | `7c75581903fe53a721519f6072df7f81db4d3169984a7b369057e223d207a625` |
| `web/__tests__/pages/api/v1/roster-schedule-optimizer/diagnostic-context.test.ts` | `2c1590e5e483bb354f15b6aaa14743073f335b205b47a39fd212085aecdb0328` |

Packet hashes observed at review:

- `diagnostic.patch`: `3e3c56dd2e25e792451b2c40c44b6507e50cf3acd22a012126e94738c955b16f`
- `receipt.json`: `e23fba515751ee6ac0341d9dafa276cd4fdb79778e39df563f8f3bc5fee8b23a`
- `HANDOFF.md`: `65bc1e76348838105007bc9eda4fd9e86f50fd89ede0feeb264deffaee6381dc`

All five source hashes matched the receipt. The patch contains exactly these five additions from `/dev/null`; independent offline reconstruction reproduced every current file byte-for-byte.

## Verification and remaining boundaries

The retained author receipt reports 20/20 focused offline tests and clean scoped ESLint after the socket correction. The source/tests and receipt were inspected; these checks were not rerun by the reviewer. No aggregate TypeScript result is claimed for this addition; the earlier pre-diagnostic compiler pass does not cover it.

No live auth/storage compatibility, actual localhost owner session, real data response, SDK transport-request count, or deployment behavior has been observed. Five backend reads means five logical operations in this handler, not a demonstrated total of lower-level network requests or database engine reads. The browser timeout does not prove cancellation of server work. The one-use control is per page instance and provides no cross-run rate limit; uncertainty must stop the run rather than trigger refresh/retry.

Any execution still requires separate exact-origin/port approval for one HTML GET and one diagnostic GET, with the bounded backend operations disclosed, a pre-existing valid normal local owner session, and a direct loopback connection. Starting a server or establishing a session is outside this prepared packet. This review changes neither release membership nor real-account, preservation/restore, or qualified-forecast gates.
