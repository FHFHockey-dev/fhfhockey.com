# Local read-only diagnostic — prepared, not executed

Five new source/test files are pinned in `receipt.json` and `diagnostic.patch`. No existing application, auth, persistence, waiver-pair or release-manifest files were edited. The release coordinator has been notified; this diagnostic is excluded from the current release. Independent review is pending.

## Boundary

The normal Pages Router wrapper mounts AuthProvider, which invokes `ensureUserRecords`; the normal shared browser auth client also auto-refreshes tokens. This diagnostic therefore serves standalone HTML from `/api/v1/roster-schedule-optimizer/diagnostic`, bypassing `_app`, RSO, analytics and all ordinary page effects. Both diagnostic routes return 404 unless NODE_ENV is development and Host and actual socket peer are loopback. No dev server was started; this route has not been loaded in a live browser.

The browser reads only the exact existing Supabase project session key, matching `lib/supabase/client.ts` and the installed SDK's storage-key derivation. It does not initialize that singleton, call getSession, refresh, subscribe to auth, modify storage or print the session. The existing server `requireApiUser` verifies the normal Bearer token; the existing verified-owner predicate limits access further. Missing, malformed, expired or soon-expiring sessions fail before sending a request. An existing production login is not a localhost login; there is no token-copy/import workaround.

One approval checkbox and one-use button permit one same-origin application GET, with redirects rejected and no retries. Its backend performs at most five awaited reads: verify session, verify owner, stored league by exact name, stored owned team by exact name and league/account binding, existing workspace by exact principal/context. No Yahoo calls, grant helpers, provider refresh, inserts, updates, RPCs, preservation receipts or restore operations. The browser has a 15-second timeout; an aborted client response does not prove the bounded backend stopped, so do not rerun after uncertainty. No cross-run rate limit is claimed; refreshing the page is outside the one-run approval.

Fixed case: `2026-27 FHFH`, `FHFH TJ`, stored provider season `2026`, internal season `20262027`, October 12–18. These dates remain an owner working assumption. Cached game key, IDs and imported week are reported with provenance. Current provider matchup/dates/timezone remain null. Saved timezone is distinctly labeled, not promoted to provider authority.

The report includes request counts, per-read attempt/status/times, returned HTTP status, principal/context, row existence/version/update time, workspace payload hash and intent/roster counts. Raw workspace, snapshot, league/team metadata, email, cookies and credentials are not exported. It is not a full original-row backup and cannot authorize later save/restore. Absence is distinguished from failure; neither is silently repaired.

## Offline verification

20/20 tests across the two new files passed after correcting the independent reviewer’s Host-only locality finding; scoped ESLint passed. Tests use synthetic HTML/DOM, network spies and mocked API dependencies; no real auth/data clients are invoked. These verify no reads at mount, approval/one-shot behavior, no storage mutations, expired/missing session stop, generic errors/no retries, changed-principal rejection, local-only route gating, bounded sequential identity/baseline reads, ambiguity/binding/season failure stops, unknown provider context, missing-row versus query-error distinction and sanitized summary output. The first command used the wrong file-creation cwd and discovered no tests; after correcting the paths the focused run passed. No aggregate tsc, build or browser/server execution was performed.

## Minimal run instruction — only after separate exact-scope approval

Use a direct loopback connection, with no proxy or tunnel. On the approved existing **local origin with an already valid normal owner session**, open `/api/v1/roster-schedule-optimizer/diagnostic` directly. Confirm the displayed fixed names/dates and the approval checkbox, then click **Read baseline once**. Copy only the rendered JSON result. Stop on blocked, failed, timeout or unknown response; do not refresh/retry, sign in, transfer tokens, open RSO or run provider refresh as a workaround.

Approval must name the local origin/port and authorize one HTML GET plus one diagnostic application GET (maximum five backend reads). Starting a development server or establishing a local session, if needed, requires its own approved scope. Execution remains pending; preparation does not approve account access or storage/auth writes. The response may leave current provider dates/timezone and full preservation evidence open.
