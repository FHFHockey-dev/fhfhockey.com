# C-PATREON handoff

Status: F5 locally implemented and verified; F4 blocked by the schema fence. Uncommitted on `octoberBranch`, observed HEAD `8a6ac8adccee73fae8e07045c86b374ce8c98008`.

Runtime: own `CODEX_THREAD_ID=01a1566f-b472-76f3-b641-9364f51ba5e8` matching session `turn_context` reports `gpt-6.1-sol`, `effort=high`. No subworkers.

## Exact changed/created files

- Changed `web/lib/integrations/patreon/oauth.ts`: reject all raw ASCII control characters, backslashes, offsite paths, and parsed paths that would serialize with a leading `//`. Validate against a fixed same-origin URL base. Build callback query parameters with URL parsing so existing query parameters and fragments survive and status parameters precede the fragment.
- Changed `web/lib/integrations/patreon/oauth.test.ts`: extend existing coverage for offsite/backslash/control variants, normalized dot-segment network-path variants, malformed runtime inputs, legitimate internal paths, signed-state round trips, queries, and fragments.
- Created `tasks/codex-sprint-2026-10-19/security-patreon/HANDOFF.md` (this report).

The owned connect/callback routes and existing route test file were inspected but remain unchanged. No fenced file was changed.

## Verification

- PASS, exit 0: from `web/`, `npm test -- lib/integrations/patreon/oauth.test.ts __tests__/pages/api/v1/account/patreon/routes.test.ts` — 2 files, 12 tests (7 OAuth + 5 routes), synthetic/mocked inputs only. Ran twice: the second run followed a serializer guard and regression cases for normalized leading `//`; final result was 12/12 at 19:13:14 local time.
- PASS, exit 0: `git diff --check -- web/lib/integrations/patreon/oauth.ts web/lib/integrations/patreon/oauth.test.ts`.
- Final diff inspected for collateral changes.
- Global type/lint checks left to Chef. No build, install, network, hosted/provider request, database query, schema edit, Git mutation, or browser flow was performed. Existing tests emit a Node `punycode` deprecation warning.

Final SHA-256:

```text
ede33e20f277fc2ef1b3e5fb995e295eb8a46b7e7523c054f3cdf70e225dd1fd  web/lib/integrations/patreon/oauth.ts
860fac0c4cbc85b19a7f4a8fdfcbfa49bc1de8b43991fd9117eb3a966c1ec315  web/lib/integrations/patreon/oauth.test.ts
```

## F4 dependency and bounded proposal

Current Patreon state remains signed, self-contained, and time-limited; it has no durable consume operation, initiating-browser binding, or callback authenticated-user comparison. Transferred/missing-cookie/mismatched-user/replayed transactions are therefore **not** newly rejected by this patch. F4 remains open; no partial cookie-only protection or single-use claim was added, following the ticket's fallback instruction.

Source evidence: `web/lib/integrations/yahoo/oauth.ts` uses `create_yahoo_oauth_transaction` and `consume_yahoo_oauth_transaction`, an HttpOnly SameSite=Lax callback-path browser cookie, and durable atomic consumption. `supabase/migrations/20260824152127_yahoo_live_draft_production_hardening.sql:18-49,167-233` defines the Yahoo-specific store/RPCs, including required PKCE material and no provider discriminator. The inspected migration/type search exposes only Yahoo OAuth transaction infrastructure. Reusing it for Patreon would cross provider ownership and lacks an explicit provider binding. Existing Patreon helpers/routes expose no suitable durable transaction store. This is source evidence only; hosted schema availability was not checked.

Needed follow-up, requiring explicit fence relaxation for a separate migration/type change:

1. Add a Patreon-specific durable transaction table and service-only create/atomic-consume operation (or separately approve a provider-scoped generic design). Persist random state hash, browser-binding hash, initiating authenticated user ID, validated return path, fixed trusted callback URI, created/expiry timestamps, and consumed timestamp; use short expiry (at most the existing 15 minutes), RLS, and restricted grants. Do not store raw state or browser-binding cookie values. Do not invent Patreon PKCE support.
2. On authenticated initiation, create the durable transaction before returning the provider URL and set a fresh secure HttpOnly SameSite=Lax browser-binding cookie scoped to the callback. Preserve existing response cookies.
3. On callback, resolve a verified authenticated user and atomically consume only a matching provider/state hash, cookie hash, user ID, unexpired/unconsumed row before token exchange or account linking. Fail closed for missing cookie/auth, transferred state, user mismatch, expiry, replay, and concurrent consumption; clear the binding cookie on terminal outcomes while preserving session cookies. Cancellation/error callbacks must also consume the transaction safely. A retry starts a new transaction.
4. Add synthetic mocked route/helper tests proving every rejection occurs before exchange/linking, plus isolated database atomic/concurrent-consume tests under separately authorized local schema setup. No provider/hosted verification is implied.

The Supabase skill was read for the storage inspection; its external-doc/database-query workflow was not used because the ticket explicitly bans network/hosted calls and schema implementation. No Supabase API change was implemented.

Ownership: released all owned files to Chef for review. No commands/sessions remain running. Acceptance remaining: Chef review/global checks and F4 migration-dependent work. Next action: review this bounded F5 diff; schedule F4 only after the migration/type ownership fence is explicitly relaxed.
