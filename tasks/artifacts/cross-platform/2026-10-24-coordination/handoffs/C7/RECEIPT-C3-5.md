# C7 independent review — C3 ticket 5 (C3-4 F1, O2, O3)

**Reviewer:** Claude C7 lane session (not the author). Read-only: I didn't edit the snapshot or canonical source, made no Git writes, ran no server, and made no Stripe/Supabase/Patreon contact. Evidence is in `r11-evidence/c3-5/`.

**Verdict: accepted.**
- **F1:** specific refund claims now require a matching `error.code`, and 401 alone asks the user to sign in.
- **O2:** the deadline tense is correct on both sides of now.
- **O3:** account load, redeem, checkout verify and Patreon connect render only fixed, private-safe copy, with behaviour unchanged.

The route-relabel limit stays server-side (a boundary request, correctly carried).

## Pins

- **Canonical, unchanged:** `DraftProPanel.tsx` `09f2e94b…` and `.test.tsx` `257b5053…`.
- **Delta:** `C3-PANEL-MESSAGES.delta.patch` `9f049155…6521`.
- **My scratch copy:** canonical + C3-4 (`d6b35f7c…`/`5b580269…`) + this delta gives `1ffa98c5…`/`e32bd9d5…`, **byte-identical** to `/private/tmp/fhfh-c3-isolated/web` and to C3's table.

## Executed

**157/157 pass** (`c3r5.json`).
- Owner tests: DraftProPanel 60, InSeasonPanel 49, rollout 7, AuthProviderContext 25. That is 141, reproducing C3's 141/141.
- My 16 controls.

| Control | Result |
| --- | --- |
| **S1 account load** | For 400/401/403/404/500/502/503 replies carrying sentinels in `error.code`, `error.message`, `message`, `detail` and `statusText`, plus thrown `TypeError`/string/object: **0 leaks**. 401 → "sign in again"; all others → "account details are unavailable". |
| **S2 redeem** | 400/401/403/429/500, a 200 not-redeemed reply, a 502 HTML parse failure and a network failure: **0 leaks**. The code is kept and Redeem re-enables. The copy matches the cause: 429 → wait a minute; 401 → sign in; the 502 HTML reply → "couldn't be redeemed" (not "couldn't reach"); network → "couldn't reach". |
| **S3 checkout verify** | 400/401/403/409/429/500/503: **0 leaks**. 401 → the sign-in copy; 429 → the wait copy; all others → "Your purchase status couldn't be checked". |
| **S4 Patreon connect** | 500, 401, network, and a nested error object: **0 leaks** and no `[object Object]`. The button re-enables. |
| **F1 refund** | A proxy 404 (HTML), a 404 with another code, a 409 with another code, a 422 with its own config code, and 400/422 with no code all show the **generic** "couldn't be confirmed" copy. 401 → sign in. An authentic 422 `refund_window_closed` still shows the window-closed copy. |
| **T1 tense** | Deadline +90 s → "ends"; −90 s → "ended"; +400 d → "ends". |

**Code read:**
- `PanelMessage` marks the panel's own authored copy. Each `panelMessage(error, fallback)` shows `PanelMessage` text only, so server text never reaches the page.
- `refundFailureMessage` requires status **and** code for 400/404/409/422.
- There is no change to requests, bodies, retry loops, state transitions or the Support link.

## Screenshots (`evidence-5/browser-ticket5-fixed/`)

- **13 state PNGs, 13 distinct SHA-256 values**, each matching its `RESULTS.json` entry.
- `RESULTS.json` has **14/14** checks: 13 per-state plus "every state screenshot is distinct". So the "14 browser states" in the ticket are 13 states and 14 checks.
- The baseline run shows 3/14, as C3 reports.
- **I viewed 02, 05 and 10:**
  - 02: the route relabels a config error as `refund_window_closed`, so the panel still says the window closed. This is the documented boundary limit, labelled as such in the overlay.
  - 05: "The request window **ends** October 26, 2026 Eastern" with the deadline in 36 h.
  - 10: a 403 naming another account shows only "That code couldn't be redeemed…", and the code stays in the field.

  Each overlay matches its claimed state, and the page text is the fixed copy.
- **The other 10** are verified by distinct hashes plus per-state results.

## Typecheck

- `evidence-5/TYPESCRIPT-5.log`: whole-project `tsc` **exit 2** with exactly **2** errors, `lib/sources/tweetLunaReview.test.ts(192,40)` and `scripts/review-ifttt-luna.ts(22,35)`. Those are the known Luna errors fixed by C2's Luna R1 patch, which this snapshot lacks.
- **Nothing new.** I didn't rerun it.

## Observations (not blockers)

- **C3-5-O1 (pre-existing, display):**
  - An unparseable deadline renders "The request window ended **Unavailable** Eastern."
  - The notice and the purchase picker print the raw reason code (e.g. `window_closed`, `eligible`).

  Both predate this patch and are cosmetic. They go to the panel owner.
- **C3-5-O2 (carried boundary, API owner):** the route stamps `refund_window_closed` on any `statusCode` 422 and `purchase_not_found` on any 404 (`refund-requests.ts:26-29`). Screenshot 02 is the visible consequence; it closes once the route trusts branded errors only.
- **C3-5-O3:** the deadline tense is computed when the panel renders. It doesn't flip if the page stays open across the deadline. That is acceptable.
- **Integration:** `DraftProPanel.tsx` needs Codex's exact file transfer (it is pinned in the billing packet and release r1).
