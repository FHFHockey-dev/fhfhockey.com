# C3 ticket 4: refund consumer and private-safe errors (second serial scope)

- **Lane / session:** Claude C3, `local_d400a595-ead2-4f50-80a6-862b4414be6e`.
- **Snapshot:** `/private/tmp/fhfh-c3-isolated/web`, the same one as tickets 1–3.
- **Not done:** no canonical write, no Git action, no refund started, no real request retried, no Stripe or Supabase contact, no production action. Any pending sandbox-refund approval was not touched.
- **Server:** :3120 ran from the snapshot only and is now stopped.
- **Earlier patches unchanged:** the cancel-reload, sign-out cleanup and UUID patches and their files are as they were. The snapshot drift (`evidence-4/SNAPSHOT-AFTER-4.sha256`) is exactly the six files granted across tickets 1–4.

## Which consumer

The prior sweep (`tasks/artifacts/codex-2026-10-20/DRAFT-PRO-STATUS.md`: 3 files, 37 tests) excluded the account refund path. Its UI consumer is `submitRefund` in `web/components/account/DraftProPanel.tsx`. This is account/billing consumer UI only. On the baseline it rendered `body.error.message` from the route, or the raw browser `Error.message`, as-is.

**Recorded before editing.** These canonical baselines match the pre-edit snapshot manifest.

| Path | Baseline (canonical, unchanged) | Candidate |
| --- | --- | --- |
| web/components/account/DraftProPanel.tsx | 09f2e94b2d0ab90d15604b5d6b67dd46f8418ac5c1f55a4b7c5717fc4d586d77 | d6b35f7ce331b5f5b1d17ff1c5e428f29e82615e6be8e590c2031e9356768732 |
| web/components/account/DraftProPanel.test.tsx | 257b5053bd7612cc2994b3f5e0d4edd816fd6908841abcb19a4642bbce5c09cc | 5b580269be2ec40abe4021ef4001e875e6496b263928eba847317f439c85bb6e |

**Ownership note.** `DraftProPanel.tsx` at `09f2e94b…` is pinned in the accepted billing-sales-rollout packet and in the frozen release-readiness r1 candidate. That is the same situation InSeasonPanel was in. The current Codex transfers (003, 012) do not name these two paths, so **integration needs Codex's exact file transfer**. This receipt is an isolated candidate only.

**Patch.** `C3-REFUND-PRIVATE-ERRORS.patch` has sha256 `c53cc8a71557c8f8d58681d73508823c01f0b08aed2fcbb79b2defe1e1f4d177` (+82/−4). It is independent of the other three C3 patches. `patch -p1` on fresh copies of the canonical baselines reproduces both candidate hashes exactly; this was done in a temporary directory, without Git. `candidate-4/` holds the post-patch files.

## Fix (presentation only)

`refundFailureMessage(status, code)` returns fixed plain-language copy. Server, browser and parser text never reaches the page.

| Condition | Copy shown |
| --- | --- |
| 401 / `authentication_required`, or no session | Sign in again |
| 400 / `validation_error` | Check the form (purchase, reason, 10 to 2,000 characters) |
| 409 / `refund_request_exists` | An open request already exists |
| 422 / `refund_window_closed` | 7-day window closed, contact support |
| 404 / `purchase_not_found` | Not eligible, contact support |
| No response (network failure, timeout, abort) | Couldn't reach FHFH, so the request wasn't confirmed |
| Anything else (5xx, unreadable body, a 2xx with no `data`) | Couldn't be confirmed, try later or contact support |

**What stays the same:**
- The request body, endpoint and headers are unchanged.
- One user submit sends one POST. There are no automatic retries and no new timeout or abort.
- After a failure the form keeps its values and the submit button re-enables, so a manual retry still works.
- The Support link (`mailto:tim@fhfhockey.com`) and the policy links are unchanged.
- Success copy is unchanged. A 2xx with no readable `data` is no longer treated as success, so a malformed request is never added to the list.

**Wording choice.** The copy says "wasn't confirmed" or "couldn't be confirmed", never "nothing was sent". A lost response or a 5xx can happen after the server has saved the request.

## Tests

**Reproduction against the baseline** (`evidence-4/REFUND-REPRODUCTION-BEFORE-FIX.*`): **12 failed, 25 passed.** The baseline DOM rendered these texts verbatim:
- `Failed to fetch`
- `RESEND_API_KEY is not configured.`
- `duplicate key value violates unique constraint "draft_pro_refund_requests_pkey" for tim@example.com`
- `Purchase 9f1c for user 7d2a not found in draft_pro_purchases`
- `invalid JWT: … token is expired`
- `Expected string, received number at path explanation`
- `Conflict on refund row r_8812`
- `Unexpected token '<' … is not valid JSON`
- `Unexpected end of JSON input`
- `Authentication required.`

The timeout case was the exception: in jsdom the DOMException is not an `Error`, so the baseline showed its generic fallback there and failed only on the expected copy.

**New cases in `DraftProPanel.test.tsx`:**
- 10 mocked failure modes: network, timeout, an HTML outage, a configuration error forwarded on a 422, a 500 with private details, a 404 with internal IDs, a 401 with an expired JWT, a 400 Zod error, a 409, and an unreadable 201.
- Each one asserts four things:
  - the fixed copy is shown;
  - no private text is visible;
  - the panel made exactly 2 fetches: the account load and one refund POST;
  - submit re-enables, the explanation is kept, and the Support link is intact.
- A missing-session case (sign-in copy, no POST).
- A manual retry after a network failure that then succeeds (3 fetches, success copy, error cleared).

**Final:** DraftProPanel, InSeasonPanel, rollout and AuthProviderContext together pass **118/118** (37 + 49 + 7 + 25).

**Mutation checks** (`REFUND-MUTATION-CHECKS.log`):
- Appending server text to the message: 12 fail.
- Treating a 2xx with no data as success: 1 fails.
- Mapping network failures to the generic copy: 3 fail.
- Dropping the sign-in mapping: 1 fails.
- One mutant survived: "parse JSON without fallback". That showed the `.catch(() => null)` I had added was redundant, because the status is recorded before parsing. I removed it, and the final candidate parses with a plain `response.json()`.

**Static checks:**
- ESLint: exit 0.
- Whole-project `tsc`, run under the heavy lock and released afterwards: **exit 2**, with only the two errors that were already there (`lib/sources/tweetLunaReview.test.ts:192`, `scripts/review-ifttt-luna.ts:22`).

## Browser (:3120 snapshot, real `/account?section=draft-pro`)

The account load is a fixture. The refund POST answers from a scripted queue (`route.abort("failed" | "timedout")` or `route.fulfill`) and never reaches Next. Every other host is aborted. The script is `evidence-4/refund-capture-4.cjs`.

- **Baseline** (`browser-ticket4-baseline`): all **9** failure states showed raw or private text. In Chromium the timeout also surfaced as "Failed to fetch".
- **Fixed** (`browser-ticket4-fixed`): **21/21 checks pass**:
  - no raw or private text in any state;
  - retry available in every state;
  - the Support link is valid;
  - one POST per submit (10 in total);
  - all 11 screenshots are distinct.
- **How the check works.** The private-text check scans the page before the evidence overlay is added, because the overlay quotes the fixture reply on purpose.

| State | File | SHA-256 |
| --- | --- | --- |
| Refund form before submit | 01-form-ready.png | 97345c38b35c590aa3ca874c5f451e69ede2fbbc517c42b35373a44e06ac8246 |
| Network failure (Failed to fetch) | 02-network-failure.png | 9b43ae0d8c978fc1f4e97a4b03471c3d7310c37b0dce139f70b80ffda4371744 |
| Request timed out | 03-timeout.png | 0651597996535281a4e612afba81ee4d765fbf67cf274f1235b75e30f85fda6f |
| 503 outage with HTML body | 04-outage-html.png | 5f6af8870fb15db082ec25589d8116b704383f8ea735b9b9119325b347148ddc |
| 422 forwarding a configuration error | 05-config-error.png | 564af6dfa1debbfd0a686467a90fe1150b8ac95a0fa5b93d167fcdd592fb6a64 |
| 500 with database and email details | 06-server-private.png | c5f49481b69d2e65b7dccf58fea9bdccfd4ddfe6044fa62e668030e40129c47a |
| 404 with internal identifiers | 07-not-found.png | 01793470739a58720b70c026e0dfd3445fc7bf7fe2f7f3cdc794f0e6191da0c5 |
| 401 expired authentication | 08-auth-expired.png | 7090776eceb2e5ea17e9ce12d24d3d1446abbff53a3c9d7d810004650b35195e |
| 400 validation error | 09-validation.png | 34de3c14c161c28b87ba46a863284921793617c1ac414243796964d48f7b9436 |
| 409 existing open request | 10-open-request.png | 78ab8c26bc9e67724e02c08c333c0203d344aa6ae712ae661a8d3902bf91e7b8 |
| Manual retry confirmed (fixture 201) | 11-retry-confirmed.png | 712cdb1dabb643a75536381ed9e8f00e51b6b6e6e617460c13e8b69c6fe5e7e5 |

## Boundary requests (server side, not edited)

**1. `web/pages/api/v1/account/draft-pro/refund-requests.ts`** (`2dd517c0…`):
- It duck-types `statusCode`, so any error carrying 404 or 422 forwards its `message` verbatim.
- It maps the library's authored 409 `refund_request_exists` to a generic 500.
- It forwards the first Zod issue text on a 400.

Suggested fix: trust only branded refund errors and return fixed messages per code, including 409. Plus route tests. This is outside the lease, and refund semantics are not touched.

**2. `web/lib/draft-pro/account/refunds.ts`** (`262f10bd…`) creates plain `Error`s with `statusCode` assigned. It should use a branded error type, like `DraftProRequestError` in the earlier sweep. Same owner.

**The client fix does not depend on either change.** It never displays server text.

## Not in scope / follow-ups noted

Other `DraftProPanel` paths still render raw server or browser messages:
- the account load alert (`body.error.message`, line ~107);
- access-code redeem;
- checkout verify;
- the Patreon connect error.

They are not the refund consumer, so they were left alone and are recorded here for triage.
