# C3 ticket 5: truthful refund copy (F1), deadline tense (O2) and private-safe panel messages (O3)

- **Lane / session:** Claude C3, `local_d400a595-ead2-4f50-80a6-862b4414be6e`. Input: C7 review `handoffs/C7/RECEIPT-C3-4.md`.
- **Scope:** only `DraftProPanel.tsx` and `.test.tsx`, in `/private/tmp/fhfh-c3-isolated/web`. The server-side items (C3-4-O1) are still boundary requests and were not edited.
- **Not done:** no canonical write, no Git action, no refund, no real request retried, no Stripe, Supabase or Patreon contact.
- **Server:** :3120 ran from the snapshot only and is now stopped.
- **Snapshot drift** (`evidence-5/SNAPSHOT-AFTER-5.sha256`): exactly the six files granted across tickets 1–5.

## Delta patch

`C3-PANEL-MESSAGES.delta.patch` has sha256 `9f0491557d8dde968b3147defca035d905fac4e23227f0cea7a5c6d878526521` (+146/−27). It applies on top of the ticket-4 candidate.

| Path | Delta base (ticket-4 candidate) | Candidate |
| --- | --- | --- |
| web/components/account/DraftProPanel.tsx | d6b35f7ce331b5f5b1d17ff1c5e428f29e82615e6be8e590c2031e9356768732 | 1ffa98c5f74468845d0f4e0c71defc6132bc6783620dfe1e0577690c08a88bb5 |
| web/components/account/DraftProPanel.test.tsx | 5b580269be2ec40abe4021ef4001e875e6496b263928eba847317f439c85bb6e | e32bd9d5f3563c529bcc5737bba6c0aef9afc0e4c5c5f537470e1b4b2f9ccbe4 |

- **Chain check:** I took fresh copies of the canonical baselines (`09f2e94b…`, `257b5053…`) and applied `C3-REFUND-PRIVATE-ERRORS.patch` (`c53cc8a7…`) followed by this delta, using `patch -p1` in a temporary directory without Git. The result reproduces both candidate hashes exactly.
- **Canonical files untouched:** all seven C3-related canonical files keep their baseline hashes.
- **Candidate copy:** `candidate-5/` holds the post-delta files.
- **Integration:** `DraftProPanel.tsx` still needs Codex's exact file transfer, because it is pinned in the accepted billing packet and in release r1.

## Changes

### F1: refund copy is truthful
`refundFailureMessage` now gives a specific claim only when **both** the HTTP status **and** its known `error.code` match:
- 400 with `validation_error`;
- 404 with `purchase_not_found`;
- 409 with `refund_request_exists`;
- 422 with `refund_window_closed`.

401 maps to "sign in again" on status alone. No response gets the connection copy. Everything else gets the generic "couldn't be confirmed" copy.

**Remaining limit (C3-4-O1 boundary).** The current route stamps `refund_window_closed` on *any* error carrying `statusCode` 422, and `purchase_not_found` on any 404. A duck-typed configuration error relabelled that way cannot be told apart on the client. Screenshot 02 shows this. It closes only when the route trusts branded errors only.

### O2: deadline tense
The notice now reads "The request window **ends** {date} Eastern" while `deadline > now`, and "**ended**" afterwards. The date formatting is unchanged.

### O3: other paths use fixed, private-safe copy
A `PanelMessage` error class marks the panel's own authored copy. The catch handlers show `PanelMessage` text and nothing else; anything else (server text, browser `TypeError`, parse errors, `[object Object]`) falls back to fixed copy for that path. None of these routes return error codes, so apart from 401 and 429 no specific claim is made.

| Path | Copy now |
| --- | --- |
| Account load | 401: "sign in again to view Draft Pro". Otherwise: "account details are unavailable, refresh to try again". The existing "Authentication required." text for a missing session is kept. |
| Access-code / recovery-code redeem | 401: sign in again. 429: "too many attempts, wait a minute". Other non-2xx: "That code couldn't be redeemed…". No response: "We couldn't reach FHFH…". |
| Redeem succeeded but every account refresh failed | "Your code was accepted, but your access couldn't be refreshed…". The old copy rethrew the refresh error, which was private text and wrongly implied the code failed. |
| Checkout verify | 401: the existing sign-in copy. 429: the existing wait copy. Otherwise: "Your purchase status couldn't be checked. Check purchase status again…". The manual retry button is unchanged. |
| Patreon connect | 401: sign in again. Otherwise: "Patreon connection couldn't be started…". Patreon refresh already used fixed copy. |

**Unchanged:** all requests and their bodies, the retry loop and its delays, the state transitions (`accessCodeState`, `checkoutState`, retry availability), the success paths and the Support link.

**Updated tests.** Three existing tests expected server text and now expect the fixed copy:
- the account-load alert, which expected "Account unavailable";
- redeem with HTTP 400 and 429, which expected "Code could not be redeemed.".

## Tests

### Reproduction against the ticket-4 panel
`evidence-5/T5-REPRODUCTION-BEFORE-FIX.*`: **24 failed, 36 passed**. The baseline rendered:
- false specific claims for an unrelated or proxy 404, a 409 with another code, a 422 with its own config code, and a bare 400;
- "ended October 26, 2026" for a future deadline;
- "Failed to fetch";
- `[object Object]` (Patreon);
- `Stripe checkout is not configured. STRIPE_SECRET_KEY unset`;
- "Invalid or expired session.";
- `relation "draft_pro_purchases" does not exist; user tim@example.com`;
- `invalid JWT: token is expired`;
- `cs_live_a1b2 belongs to user 7d2a`.

### New and updated cases in `DraftProPanel.test.tsx`
- **F1:** seven refund cases:
  - a 422 configuration error with its own code;
  - a 422 with no code;
  - an authentic closed window (422 with `refund_window_closed`);
  - an unrelated proxy 404 with an HTML body;
  - a 404 with a different code;
  - a 409 with a different code;
  - a 400 without the validation code.

  The specific claim text is asserted absent where the code doesn't match.
- **O2:** "ends" for an open request 36 hours before the deadline, and "ended" 36 hours after it.
- **O3:**
  - account load: network, HTML 502, private 500, and 401;
  - redeem: network, private 500, a recovery code owned by another account (403), and 401. The code is kept and the button re-enabled.
  - accepted-but-refresh-failed;
  - checkout verify: config 503, network, and 429, with the retry button present;
  - Patreon connect: 500, network, and 401, with the button re-enabled.

### Results
- `DraftProPanel`: **60/60**.
- All four suites (DraftProPanel, InSeasonPanel, rollout, AuthProviderContext): **141/141** (60 + 49 + 7 + 25).
- **Mutation checks** (`T5-MUTATION-CHECKS.log`). All seven are caught:
  - status-only window claim: 2 fail;
  - code-or-status not-eligible: 2 fail;
  - status-only open request: 1 fails;
  - `panelMessage` trusting any `Error`: 5 fail;
  - always past tense: 1 fails;
  - rethrowing the raw refresh error: 1 fails;
  - no 429 mapping for redeem: 1 fails.
- **ESLint:** exit 0.
- **Whole-project `tsc`**, run under the heavy lock and released afterwards: **exit 2**, with only the two errors that were already there (`lib/sources/tweetLunaReview.test.ts:192`, `scripts/review-ifttt-luna.ts:22`).
  - My first tsc attempt found the lock held by another owner. I didn't steal it; I retried once it was free.

## Browser (:3120 snapshot, real `/account` page, full-page screenshots)

`evidence-5/panel-capture-5.cjs` serves every endpoint from a scripted per-path queue, or a browser abort, and blocks other hosts.
- **Account replies repeat**, because the panel loads the account more than once on mount.
- **State 11 only fails account refreshes after the redeem POST.**
- **Waits are scoped to the form or section alert**, because Next's route announcer is also `role="alert"`.
- **The check runs before the overlay is added**, because the overlay quotes the fixture on purpose.

| Run | Checks passed | Distinct screenshots |
| --- | --- | --- |
| Baseline, ticket-4 panel (`browser-ticket5-baseline`) | **3/14**. The only passes are the correct past tense, the documented relabel limit, and the distinct-hash check. | 13/13 |
| Fixed (`browser-ticket5-fixed`) | **14/14** | 13/13 |

| State | Ticket-4 panel showed | Now shows | File | SHA-256 (fixed) |
| --- | --- | --- | --- | --- |
| Refund 422 config error with its own code (re-capture of ticket-4 state 05) | "…window for this purchase has closed…" | "Your refund request couldn't be confirmed right now…" | 01-refund-config-422.png | 97158b1cf30429684855a9e0619006c74da35bdca6457f0e5d270c87b0870594 |
| Refund 422 relabelled by the route (known O1 limit) | window closed | window closed (unchanged; client cannot tell) | 02-refund-relabelled-422.png | b0771d6541fb8225d0c1124c9d338270d4321f8c4ee3db0fe620b08009f816d0 |
| Refund: unrelated proxy 404 | "This purchase isn't eligible…" | generic "couldn't be confirmed" | 03-refund-proxy-404.png | 832ec7dc63eb16423587cee4e73c6a280a7b99f377804c2fb3638481125a0fbc |
| Refund 409 with a different code | "already has an open refund request" | generic "couldn't be confirmed" | 04-refund-409-other-code.png | eba5aea55726c3f5cb46d1ee70db7b0f4cda1e8a9e2d06e3c81acc93c4f14f52 |
| Window notice, deadline in 36 h | "window **ended** October 26, 2026" | "window **ends** October 26, 2026" | 05-window-ends.png | f04ee5efd8c1df925ef94a109a56ba6e1a0f29ddf114e7cb0332dc13c6bc5223 |
| Window notice, deadline 36 h ago | "ended October 23" | "ended October 23" | 06-window-ended.png | b18616593f868dbb76f0ad9d456b53f0a4ddce497f5888588e0b3b02037afe5a |
| Account load 500 with private details | relation / email text | "account details are unavailable…" | 07-account-private-500.png | 32eb1366330259bdc3e9a072dcadc73e7f6cb21a2c12d13cd3c17211675e9996 |
| Account load 401 | "invalid JWT: token is expired" | "Your sign-in has expired…" | 08-account-401.png | d57509c35f2a708088b9c8624a61024634dadece75cc080439e0a40a85a86d70 |
| Access-code network failure | "Failed to fetch" | "We couldn't reach FHFH…" | 09-redeem-network.png | 95592215a8227dfae685722baa8956174f0b6213c650aac564f57eb212136d8f |
| Recovery code 403 naming another account | "cs_live_a1b2 belongs to user 7d2a" | "That code couldn't be redeemed…" | 10-recovery-403.png | 15d24caaf5c66a08b2f459cbc2110ae5e6718376d5b131e5043a3b17d73dc87b |
| Code accepted, every refresh fails | relation / email text | "Your code was accepted, but your access couldn't be refreshed…" | 11-redeem-refresh-fails.png | 3c3383dcc1d5e1615efb7d3441df0ee372f078b0cf4436edf977986f4e428138 |
| Checkout verify 503 config error | "STRIPE_SECRET_KEY unset" | "Your purchase status couldn't be checked…", plus the retry button | 12-checkout-config-503.png | 3bd302baabcf73ddae4e63e4e831ff11b1194e43f069711401360e04a2ea628d |
| Patreon connect 500 | "[object Object]" | "Patreon connection couldn't be started…" | 13-patreon-connect-500.png | 5469bca8b87aa4aeedf514ac1f2c2b9ae25d3fa8070f84b5742abdde9619495b |

**Capture artifact.** In full-page captures the sticky site header and the fixed overlay render at the scroll position, partway down the image. The page's own message is in its normal place (under the form or section).

## Boundary requests (carried, not edited)

- **C3-4-O1:**
  - `refund-requests.ts` should trust branded refund errors only, with fixed per-code messages including 409 and no forwarded Zod text.
  - `refunds.ts` should use a branded error type.
  - Once the route stops relabelling duck-typed errors, F1's remaining limit (state 02) disappears with no client change.
- **Error codes for the redeem, checkout-verify and Patreon routes:** these routes return bare strings with no codes. If specific user-facing reasons are wanted (for example "this recovery code belongs to another account"), they need stable codes, and then the client can map them.
