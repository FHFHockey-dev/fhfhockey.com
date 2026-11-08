# Yahoo ownership: loop completes; sampled provider values absent

## Confirmed

- November 7 08:40 run enumerated and persisted all 1,610 current player profiles. It recorded 579 ownership observations and 1,031 missing values, with zero failed rows, provider-omitted players, deferred rows, retries, or rate-limit events.
- Code enumerates a complete player-key snapshot, then reads 25 keys per batch: 65 batches for this run. A resume-after-last-ID cursor cannot recover this run's missing percentages because no tail was skipped.
- A bounded read-only database query grouped the 1,610 keys into five ordered bands. Every band had refreshed profiles and a mixture of present/missing stored percentages. Updates ran from 08:40:02.554 to 08:40:43.713, including final key `477.p.9603`.
- Fresh public API reads of five missing samples and one control returned every requested profile. Both the production combined resource and dedicated `percent_owned` resource omit `value` for Nesterenko, Kaiser, McDonough, Tverberg, and Struble. Frank Nazar returns explicit `value: 9` in both. Raw XML likewise omits the value element, ruling out JSON flattening for these samples.
- The missing objects contain week 6 and `delta: "0"`. A change of zero is not an ownership percentage.
- The current database's 853 stored percentages are not 853 current observations. The atomic writer preserves last-known percentages when the provider omits a new value; only 579 received current observation receipts.

The raw public API responses and hashes are beside this report in `source-comparison.json` and its three referenced files. No credentials or private league data were used. The existing October 29 retained comparison also found the same omission in canonical JSON, so this is recurring rather than a newly stopped loop.

## Practical remedy

1. Do not replay all players or add an ID cursor as a fix for these missing values. Those changes address interruption, which was not observed here.
2. Before implementing fallback, compare a small sample through the official authenticated Yahoo API using approved account access. That source has not been tested here. If it returns explicit numeric values, recover only omitted keys, preserve per-key source/date, validate 0–100, and accept only receipt-confirmed writes.
3. If the official API also omits values, obtain an explicit Yahoo display/source value or documented missing-value contract. Do not infer all 1,031 are zero from five low-ownership samples or `delta: 0`.
4. Continue keeping unavailable ownership separate from failed profile collection. An older cached percentage must not be stamped as newly observed.

No runtime patch was made because none of the tested alternative public resources supplied the missing values. No production writer, refresh, authenticated request, deployment, or build was invoked. Earlier focused regression verification passed 97 tests. This follow-up used five public Yahoo read-only requests and one bounded database SELECT; two initial Node DNS failures preceded the successful standard curl transport. The public Yahoo Sports player page and official developer guide did not provide a usable ownership fallback or missing-means-zero contract.

## Existing authenticated access check

The follow-up was limited to existing connected plugins or an established session, with no new login, credential access, credential creation, or production writes. Plugin discovery returned no Yahoo Fantasy integration. A read-only check in the connected Chrome profile loaded Yahoo Fantasy signed out with an explicit Sign in link. Therefore, there was no established Yahoo browser session to use. Repository authenticated API code would need stored OAuth secrets; those were not read, used, or refreshed. The authenticated six-player comparison remains unrun and requires approved access before continuing.

## Existing application OAuth integration capability

Code-only inspection confirmed that current authenticated routes do not expose a bounded global `percent_owned` comparison. `providerClient.ts` allowlists draft/settings/team/roster/planning/league-availability resources. Its `/ownership` resource identifies a league team's owner/waiver state, which is a different metric from global rostered percentage. The token manager can refresh credentials and update account/session status; team-roster and discovery paths also persist cache or discovery state. The global `manual-refresh-yahoo-token` route explicitly refreshes/stores tokens. None was invoked for this diagnostic.

The smallest controlled next step is a local six-key probe through the existing OAuth grant, with token refresh disabled, no database writes, abort on expired token or HTTP 401, and output restricted to player identity and ownership values. This does not require new credentials or expanded access, but execution needs approval to use the existing stored token for that one request to Yahoo. Alternatively, a redacted official-API response for the same six keys is sufficient evidence. There is no reason to trigger production refresh or rerun all 1,610 players.

## Approved official-API probe result

At 2026-11-07T20:02:54Z, the user-approved check loaded only the existing global access token and optional expiry metadata in process, then issued one request to the official six-key `percent_owned` resource. Yahoo returned HTTP 401. No expiry timestamp was stored, so the precise cause (expired, revoked, or invalid token) is unknown. The probe stopped without retry or refresh. Credentials were not printed, saved, or returned; database writes remained zero. The safe result is `oauth-six-key-result.json`.

The official source has therefore not supplied a successful comparison. A fallback cannot yet be justified, and 100% coverage cannot be guaranteed even if authentication succeeds. Continuing requires separate authorization to refresh or reauthorize the existing Yahoo connection, then repeating this six-player check before any local fallback implementation.

## Approved refresh attempt and unresolved outcome

The user approved refreshing the existing authorization and repeating the same sample. One POST was sent to the existing application refresh route at20:04:40Z. The caller timed out after120seconds. Read-only Vercel logs confirm the request reached production and raised an unhandled `YahooGlobalCredentialError: Yahoo refreshed credentials are invalid` in the SDK refresh callback. Database metadata remained unchanged since August13; no new refresh audit was found.

The installed SDK does not check OAuth refresh response status and does not catch asynchronous callback rejection. A rejected grant and a valid access-token response missing a replacement refresh token can reach the same failure. Therefore provider-side rotation is unknown despite unchanged stored credentials. At the parent's instruction, no second refresh or ownership sample was sent. The safe receipt records the uncertainty in `oauth-refresh-result.json`. A safe local error-handling correction can be prepared independently, but it cannot establish what Yahoo returned during that first attempt or guarantee coverage.


## Local-only refresh hardening

The manual refresh route now delegates to an explicitly awaited OAuth refresh helper instead of the SDK's unhandled callback. Each invocation performs at most one token request, follows no redirects, and has a ten-second deadline covering the response/body and persistence. HTTP/OAuth errors, invalid JSON or token shapes, transport failures, and storage failures produce fixed redacted diagnostics. A missing replacement refresh token on a successful response preserves the existing refresh token; a supplied blank/null/non-string token is rejected. Success is sent only after the storage operation resolves. A timeout or ambiguous failure reports `refreshOutcome: unknown`; neither refresh nor storage is retried. An already-started database write may still finish after a storage timeout, which is why that outcome remains uncertain.

This is a separate local candidate, not part of Astra's goalie/FORGE/report work. It does not repair the prior unknown provider outcome, recover ownership values, deploy anything, or authorize another external request.

### Reauthorization path and limitation

There is no maintained global-credential reauthorization callback or user-facing reconnect control wired to `yahoo_api_credentials`. The existing account flow starts with authenticated `POST /api/v1/account/yahoo/connect`, binds OAuth state/PKCE to that user/browser, and returns through `/api/v1/account/yahoo/callback`. It stores the resulting authorization through `upsert_connected_account_tokens_secure` for that user's `connected_accounts` row. The account page at `/account?section=connected-accounts` shows **Connect Yahoo Fantasy** only when no account row exists; it does not show a reconnect button for an existing row. Do not tell the user that clicking Refresh Yahoo Data repairs the global credential.

A future global reauthorization would need an explicitly approved operator authorization-code flow for the same existing Yahoo client, with its registered redirect URI verified, followed by secure persistence to the existing global credential row. That operator flow is not implemented by this patch, and no working global reauthorization URL can be supplied from the inspected code. Do not copy per-user tokens into the global row or disconnect an account as a workaround. A separately approved diagnostic could use a known-valid per-user authorization instead, but it would be a different credential path from the six-player probe already approved.


Verification for the separate local refresh patch: 54 targeted tests passed, targeted ESLint passed, git diff --check passed, and `npm run typecheck` passed with the repository's configured 8GB heap. Bare `npx tsc --noEmit` initially exhausted its default 4GB heap. `local-refresh-hardening.patch` contains only the five owned source/test files; `local-refresh-hardening-verification.json` records their hashes and checks. No build, commit, deployment, additional provider request, or production mutation was performed during this local fix.
