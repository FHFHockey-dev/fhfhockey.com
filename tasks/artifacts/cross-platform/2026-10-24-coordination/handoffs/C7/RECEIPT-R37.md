# C7 ticket 37: review of `8b1b17828` (Start Chart: hide the private Yahoo lineup when a refresh is denied)

**Verdict: accept with limits. F1 should be fixed before release.**
- TJ's rule holds for the JSON responses the API route actually returns (401/403 clear; 500 and network failures keep the comparison; lapsed entitlement is read-only).
- **F1:** a 401 or 403 whose body **isn't JSON** keeps the private lineup, which fails the ticket's "non-JSON 401/403 still clears" requirement.
- The unit tests are mutation-meaningful.
- The `start-chart.spec.ts` edits adapt copy, mocks and the current menu markup without weakening any assertion.

**Reviewer:** Claude C7 lane session (not the author). Read-only: no edits, no Git mutations, no `GIT_DIR`, no live reads.
- I reviewed the **commit** (`git archive 8b1b17828` at `/private/tmp/c7-r37`), not the working tree.
- Tests ran under the outbound network-deny preload.
- Evidence is in `r37-evidence/`.

## Tests

| Run | `StarterBoardYahoo.test.tsx` |
| --- | --- |
| **Commit** | **10/10** |
| **Parent component** (`8b1b17828^`) | **7/10.** The 3 "hides the private lineup when a refresh is denied with …" cases fail (403 ×2, 401). |
| **Mutation A:** `if (denied) setData(null)` removed | **7/10**, the same 3 fail |
| **Mutation B:** every failed response treated as denied (`denied = true`) | **9/10.** "keeps the last comparison with the error after a 500 provider error" fails. The network-failure case can't catch this mutation, because the throw happens before `denied` is set. |
| **My controls** (`StarterBoardYahoo.c7.test.tsx`, the suite plus 4 cases) | **11/14.** The 2 non-JSON 401/403 cases **fail at the commit** (F1). The late-abort case failed to run because of **my harness**: the refresh button is renamed "Loading Yahoo…" and disabled while busy, so the UI can't start a superseding request. I assessed that property by code instead (below). The in-flight success case passes. |
| **E2E** `start-chart.spec.ts` | Not run (the worker reports 18/18). Diff read only. |

## `denied` logic (`components/StarterBoardYahoo.tsx:32-50`)

| Property | Evidence | Result |
| --- | --- | --- |
| **401/403 clears the private lineup** | `denied = status === 401 \|\| 403`, then `throw`. The `catch` runs `setData(null)` when the request isn't aborted. The API route (`pages/api/v1/account/yahoo/starter-board.ts:21-25`) always answers 401/403 with JSON. | Holds for JSON |
| **A non-JSON 401/403 still clears** | **No.** `denied` is assigned **after** `await response.json()` (`:41-42`). A non-JSON body (an HTML 401 or 403 from a proxy, firewall or deployment-protection page) throws a `SyntaxError` first, so `denied` stays `false` and the lineup stays visible beside the error. My controls fail for both 401 and 403. | **F1** |
| **Other failures keep the last comparison** | 500 and network `TypeError` keep the data and show the error (tests pass). Mutation B confirms the 500 case guards it. | Holds |
| **An aborted request never clears** | The `catch` checks `controller.signal.aborted` before anything else, and the success path returns on abort. Aborts come from unmounting (sign-out, or switching account via `key={user.id}`, which also discards state) and from `load()` superseding a request. The button is disabled while busy, so in practice supersession comes only from unmounting. | Holds (by code) |
| **A successful in-flight refresh never blanks** | `load()` clears only `error`, not `data`, at the start. Control: while a successful second refresh is pending, "C: Private Center" stays visible, and stays after it resolves. | Holds |
| **Lapsed entitlement is read-only** | `canSync` false makes `load()` return early, and the button is disabled. The test asserts the lineup stays visible, the disabled click sends no request (`fetch` called once), and "Saved evidence" remains. A **server-side** 403 for lost access still clears, by TJ's rule ("Draft Pro access is required." is one of the tested 403s). | Holds |

**F1 fix (2 lines):** set `denied` right after `fetch` resolves, before parsing, and parse defensively, for example `const payload = await response.json().catch(() => ({}))`. Add a non-JSON 401/403 case to the suite; my control cases can be copied.

## Unit-test changes

- **Old test:** "retains the comparison on a failed refresh and when entitlement is lost". Its failed refresh had no `status`; it was the 403-like "Access could not be verified".
- **Now split into:**
  - 3 denial cases (401/403), which assert the alert text and that the lineup, team name and "Saved evidence" are gone;
  - 2 retention cases (500, network);
  - a lapsed-entitlement case, which no longer does a failing refresh first and now also asserts the disabled click sends nothing.
- These are stricter, not weaker. The only behaviour the old test asserted that's now reversed is "keep on access denied", and that reversal is TJ's rule.

## `start-chart.spec.ts` drift fixes

| Change | Weakened? |
| --- | --- |
| A mock for `/api/v1/account/provider-sync**` (eligible): the panel is now gated on provider-sync access (fd58ba245). | No (setup) |
| Summary copy: "Draft Pro" became "Premium sync"; the sign-in link became "Sign in to check premium sync access". Both match the component text (`StarterBoardYahoo.tsx:13,53`). | No (copy) |
| Desktop Sign Out: `menuitem` became `button` (exact). Mobile: the "Account & league settings" disclosure is opened first. | No (current menu markup; the same action) |
| Denied and expired loop, sign-out and late-response checks (`toHaveCount(0)` for the private lineup) | Unchanged |
