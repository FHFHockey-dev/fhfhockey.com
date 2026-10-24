# C3 ticket 3: strict request IDs (C3-O1) and distinct state evidence (C3-O2)

- **Lane / session:** Claude C3, `local_d400a595-ead2-4f50-80a6-862b4414be6e`. It uses the same snapshot (`/private/tmp/fhfh-c3-isolated/web`) and the same leases as before: CODEX-20261024-003 and -012.
- **Input:** the C7 review, `handoffs/C7/RECEIPT-C3.md`.
- **What was not done:** no canonical write, no Git action, no server edit, no remote call and no production action.
- **Server lifecycle:** :3120 ran only from the snapshot and is now stopped.
- **Changed files:** the snapshot drift (`evidence-3/SNAPSHOT-AFTER-3.sha256`) shows exactly the four files granted across tickets 1 and 2.

## Delta patch

`C3-UUID-HARDENING.delta.patch` has sha256 `a258a6ac9bbee84547a95acbb93a53ecc6a9c71245bf7517d2bf64f6e838f67e` (+16/−4). It applies **on top of the ticket-1 candidate**.

| Path | Delta base (ticket-1 candidate) | Candidate |
| --- | --- | --- |
| web/components/account/InSeasonPanel.tsx | 9987664256fd615d6b47cb41d019edd7c9515456e8c02808d42d741e239776ea | 498942abc03a689680235849041146ec028bad0e002958c297473287e538b41b |
| web/components/account/InSeasonPanel.test.tsx | 646b3379e105e0ae3777c196db148fcd9af1366faa757102ccb3ebeae4b3e535 | 714946518f80fda0e2e15017904e2dd68be227f64bd616f9c184fac7b59bcd60 |

- **Chain check (temporary directory, `patch -p1`, no Git):** I took fresh copies of the five canonical baselines and applied `C3-CANCEL-RELOAD` (`c500b580…`), then `C3-AUTH-SIGNOUT-CLEANUP` (`5ad23a50…`), then this delta. The result reproduces every candidate hash exactly:
  - `InSeasonPanel.tsx` `498942ab…`
  - `.test.tsx` `71494651…`
  - `.rollout.test.tsx` `b63510f7…` (unchanged)
  - `browser-auth.ts` `6c4f86fe…`
  - `AuthProviderContext.test.tsx` `9173deb1…`
- **Canonical files are unchanged:** `e5cde334…`, `d21fd263…`, `b63510f7…`, `7f4cae98…`, `7e9bb5e5…`.
- **File copy:** `candidate-3/` holds the two post-delta files.

## C3-O1: strict request IDs

**Change:**
- I added `cancellationRequestId = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/`.
- **On restore**, this check replaces the old `/^[a-f0-9-]{36}$/`.
- **On send**, `cancel()` now generates a new ID with `crypto.randomUUID()` unless the in-memory entry passes the strict check. Before, it reused any existing entry.

**Lowercase, not case-insensitive.** The orchestrator suggested matching case-insensitively. I made it lowercase-only, for two reasons:
- `crypto.randomUUID()` always emits lowercase v4 IDs.
- The current server route (`/^[a-f0-9-]{36}$/`, no `i` flag) rejects uppercase.

If uppercase IDs were restored, a retry would always get a 400. They are therefore treated as invalid and replaced.

**Regressions in `InSeasonPanel.test.tsx`.** These cases join the existing fail-safe `it.each`; the sent ID must not appear in the seeded value and must match the strict v4 shape:
- a 36-dash string;
- a version-1 UUID;
- an uppercase v4 ID.

There is also a new case: a real `crypto.randomUUID()` ID that is stored, then restored and sent after a reload.

**Reproduction against the ticket-1 component** (`evidence-3/UUID-REPRODUCTION-BEFORE-FIX.*`):
- The 36-dash case and the version-1 case **failed**, 2 failed and 47 passed.
- The uppercase case already passed, because the old regex was lowercase-only. It is kept as a guard.

**Final:**
- `InSeasonPanel` + rollout + `AuthProviderContext`: **81/81 passed** (49 + 7 + 25).
- ESLint: exit 0.
- Whole-project `tsc`, run under the heavy lock, which was released afterwards: **exit 2**, with only the two errors that were already there (`lib/sources/tweetLunaReview.test.ts:192`, `scripts/review-ifttt-luna.ts:22`).

**Limit:** the send-side check is defensive. With restore already filtered, no UI path can put a non-UUID into memory, so no test can isolate that line.

### Boundary request (not edited, outside this lease)

`web/pages/api/v1/account/in-season/cancel.ts` validates `requestId` with `/^[a-f0-9-]{36}$/`, so the route would still accept a 36-dash string as a claim key. The matching server change is to require the same lowercase v4 shape there, plus a route test that rejects a 36-dash body with 400. The current route test is not in this lease.

- **Compatibility:** every ID the shipped client has ever generated comes from `crypto.randomUUID()`, so all of them pass the stricter check.
- **Owner:** this needs the billing/API owner's exact transfer.

## C3-O2: distinct state evidence

I re-captured the states on snapshot :3120, using the real `/account?section=in-season` page. All traffic was served by fixtures or aborted, and the cancel POST was aborted to simulate a lost response.

Each screenshot carries a fixed overlay showing:
- the state label;
- the auth owner;
- the raw `sessionStorage` entry (or "absent");
- the DOM status and alert text;
- whether the cancel button is present;
- every request ID sent so far.

**All 8 checks pass**, and all 9 hashes are distinct. The script is `evidence-3/state-capture-3.cjs`; the results and hashes are in `evidence-3/browser-ticket3/RESULTS.json`.

| State | File | SHA-256 |
| --- | --- | --- |
| Lost response (owner A) | 01-lost-response.png | daf7a3c3555da50309d8ed8198f1ab01e703c7bfc717fd3ed3788b76beac74a7 |
| After reload, before retry (A) | 02-after-reload.png | 872ebc79a5c17fd43a43ce04f14db3d27943b00b498f67202a9d0b0ffdd804cf |
| After reload, retry reuses ID (A) | 03-after-reload-retry.png | 1dd0f28fe8fda3f8f69aa0083b37f94c279b26d781f4926c5352cf07b3fd3c1b |
| After account switch to B, A's entry discarded | 04-after-account-switch.png | a082474e54e8b80700506f23f9068693a03840945975b1c3d2e10393c3318c79 |
| After the app's menu sign-out (key absent) | 05-after-app-signout.png | fc75509565e95aac192857ede5d5fb8f4d122490ddc0cfa3734fdeaa1ae2b34d |
| Same owner after sign-out, new ID | 06-same-owner-after-signout.png | 96b5b73b4cf60059ba31d2254a46419ca9b7d803750ae434e0ec4bee150d7e0a |
| Corrupt stored state dropped | 07-corrupt-state.png | 4c45c92516ba47612f8f7e5644f78b505ffa74fe7acf4474a19175c3e55976d4 |
| Expired (25 h) entry, not eligible for restore | 08-expired-state.png | 4671df52f173ea62466c1cd660c659945d8be293cabebdac53d697992719d952 |
| 36-dash non-UUID replaced (O1) | 09-non-uuid-rejected.png | 00ccbd4eb094df34013b40a12cc09e56f69ccee07a4232dd943fb96cc958c344 |

The earlier `evidence/browser-*` and `evidence-2/browser-ticket2` folders are left as they were. Their PNGs are mostly byte-identical, as C7 found, so their claims rest on their `RESULTS.json` files. This set supersedes them as visual evidence.

## Limits carried forward

- The 24-hour age limit decides whether a saved ID can be restored. It does not guarantee the entry is deleted in every tab.
- If a session ends outside the app's sign-out and no panel event fires, the entry stays in that tab. It is still owner-scoped and cannot be used by another account.
- A duplicated tab copies sessionStorage, so both tabs reuse the same ID; the server dedupes it.
- No real cancellation, refund, Stripe or Supabase call was made.
- The refund consumer and private-safe errors (the second scope) are still not started.
- Integration still needs the release owner.
