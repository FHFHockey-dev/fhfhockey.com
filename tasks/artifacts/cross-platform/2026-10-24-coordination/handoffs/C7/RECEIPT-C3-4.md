# C7 independent review — C3-4 refund consumer, private-safe errors

**Reviewer:** Claude C7 lane session (not the author). Read-only: no source edit, no Git, no server, no refund or Stripe/Supabase contact. Evidence is in `r9-evidence/c3-4/`.

**Verdict: accepted with limits.**

What holds:
- No server, browser or parser text, and no private detail, can render.
- The refund request is unchanged.
- Retry and Support stay valid.
- The 11 screenshots are distinct.

The limit is that the plain-language copy is chosen from the HTTP **status alone**, so some failures get a specific, possibly false, claim (C3-4-F1).

## Pins

- **Patch:** `C3-REFUND-PRIVATE-ERRORS.patch` `c53cc8a7…f177`, which matches.
- **Canonical:** `DraftProPanel.tsx` `09f2e94b…` and `.test.tsx` `257b5053…` are **unchanged** (baseline).
- **My scratch copy** (applied on top of the C3 ticket 1–3 files): `d6b35f7c…` and `5b580269…`, equal to C3's table.

## Executed

**Base (pre-patch DraftProPanel): 25 owner tests pass; 2 of my 6 controls fail** (`c3r4-base*.json`).
- **S1 sentinel sweep:** for **15 of 18** statuses, the server's error message text is rendered verbatim. A 2xx with no `data` even shows "submitted for case-by-case review".
- **S2:** thrown values render.

**Patched: 43/43 pass** (`c3r4.json`): DraftProPanel 37 (C3's own count) plus my 6.

| Control | Result |
| --- | --- |
| **S1 sentinel sweep** across statuses 200–503, with a unique sentinel in `error.code`, `error.message`, `error.details`, a top-level `hint` and `statusText` | **0 leaks.** A 2xx with no `data` now says "couldn't be confirmed", never "submitted". |
| **S2** thrown string, plain object, `Error` | No sentinel text renders. |
| **S4 request shape** | One POST per submit to `/api/v1/account/draft-pro/refund-requests`, with `Authorization: Bearer …` and JSON, and body `{purchaseId, reason, explanation}`. **Identical to the base**, so refund semantics are unchanged. |
| **S3 status-only probe** | An **infrastructure 404 with an HTML body** gives "This purchase isn't eligible…". A **409 whose code isn't `refund_request_exists`** gives "already has an open refund request". A **422 whose code isn't `refund_window_closed`** gives "The 7-day … window … has closed". See F1. |

**Code read (diff):**
- `refundFailureMessage(status, code)` returns fixed strings; the response body is read only for `error.code` (never rendered).
- `failure.status` is set before `response.json()`, so parse failures map correctly.
- There are no automatic retries. The form keeps its values and submit re-enables. The `mailto:` Support link is unchanged.

**Screenshots** (`evidence-4/browser-ticket4-fixed/`):
- 11 PNGs with **11 distinct** SHA-256 values, matching C3's table. `RESULTS.json` shows all 21 checks pass.
- I viewed 05 (config error on 422), 06 (500 with DB and email), 07 (404 with IDs) and 11 (retry confirmed). Each overlay names its state and fixture reply, and the page text is the fixed copy only.
- The overlay intentionally quotes the fixture; the leak check runs before the overlay is added.
- The other 7 are verified by their distinct hashes and the per-state `shown` text in `RESULTS.json`.

## Findings (for C3 and the API owner)

**C3-4-F1 (low–medium, truthfulness): specific claims are chosen by status OR code.**
- In `refundFailureMessage`, 404, 409 and 422 produce specific factual statements (not eligible / open request exists / window closed) on **status alone**.
- An unrelated 404 (a missing route or proxy) or a 422 or 409 with a different code tells the user something that may be false.
- C3's own browser evidence shows it: state 05, "422 forwarding a configuration error", displays "The 7-day refund request window for this purchase has closed".
- Today the library raises 404/422/409 only for the matching reasons (`refunds.ts:104,109,134`), but the route duck-types `statusCode` (`refund-requests.ts:26-29`), so the risk is real.
- **Fix (client, C3):** show the specific copy only when `error.code` matches. Otherwise use the generic "couldn't be confirmed" copy. 401 → sign in is fine on status alone.

**C3-4-O1 (carried boundary, API owner):** C3's server-side requests stand: trust only branded refund errors in the route, use fixed per-code messages including 409, and use a branded error type in `refunds.ts`.

**C3-4-O2 (pre-existing, outside the patch):** after an open request exists, the panel shows "Refund eligibility: eligible. The request window **ended** {date} Eastern." even when that date is in the future (screenshot 11: activated 10/22, "ended October 29"). Source: `DraftProPanel.tsx:371`. This is wrong tense and confusing; it goes to the panel owner.

**C3-4-O3 (carried):** other DraftProPanel paths still render raw messages (account load, redeem, checkout verify, Patreon connect), as C3 recorded.

## Ownership

`DraftProPanel.tsx` is pinned in the accepted billing-sales-rollout packet and the release-readiness r1 candidate. Integration needs Codex's exact file transfer (C3 notes this).
