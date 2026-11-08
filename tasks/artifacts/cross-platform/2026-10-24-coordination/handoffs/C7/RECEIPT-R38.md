# C7 ticket 38: review of `5356dc616` (RSO: never trust navigator.onLine to block loads; never stick on Checking access)

**Verdict: accept.** TJ's rule holds:
- requests are attempted regardless of `navigator.onLine`;
- "You are offline" appears only after a fetch rejects with a `TypeError`;
- the access check always settles;
- timed upkeep still pauses while the flag is false.

**Duplicate loads:** this change doesn't cause any. Every first load makes exactly **one** provider request, including under `StrictMode`, so today's doubled reads aren't explained by this path (D1). One info note (S1) on a preservation-held edge.

**Reviewer:** Claude C7 lane session (not the author). Read-only: no edits, no Git mutations, no `GIT_DIR`, no live reads.
- I reviewed the **commit** (`git archive 5356dc616` at `/private/tmp/c7-r38`).
- Tests ran under the outbound network-deny preload with `TZ=UTC`.
- Evidence is in `r38-evidence/`.

## Tests

| Run | `RosterScheduleOptimizer.test.tsx` |
| --- | --- |
| **Commit** | **212/212** |
| **Parent component** (`5356dc616^`), with the commit's tests | **207/212.** 5 fail: "attempts the first load despite a misreported offline flag…", "loads access and planning data while the browser misreports offline", "shows offline only after a request actually fails to reach the network", "never leaves Checking access up when the check hangs", and "drains a dispatched account save…" (its new "paused while preservation holds" text). |
| **My controls** (the suite plus 8 cases), commit / parent | Offline and abort cases: **4/4** at the commit; at the parent the `TypeError` offline case fails. **Provider-request counts** (below): read from probe assertions, so those cases "fail" by design to report the count. |
| **E2E** | Not run (the worker reports 55/55 in both time zones). |

**Provider requests on first load** (connected Yahoo workspace, access granting `rso_sync` and `rso_auto_upkeep`, 200 ms after the first request):

| | `navigator.onLine` true | `navigator.onLine` false |
| --- | --- | --- |
| Commit, plain render | **1** | **1** |
| Commit, `<StrictMode>` | **1** | **1** |
| Parent, plain or `StrictMode` | 1 | **0** (the TJ bug: nothing loads) |

## Checks

| Question | Evidence | Result |
| --- | --- | --- |
| **Can "Checking access…" persist?** | <ul><li>**Preservation held:** `load()` sets `checkingAccess` to false and returns (`:417`), and the refresh reason now shows "Provider refresh is paused while preservation holds this plan." first (tested).</li><li>**`getSession` or the access fetch never resolves:** every await is raced against a 15 s deadline, which also aborts the attempt; the catch settles to `accessError` (tested with fake timers: it shows "checking" at 1 s and "disabled until access can be verified" at 16 s).</li><li>**Aborted request:** the effect cleanup aborts and the next effect run settles (control: a pending check aborted by an account switch settles for the new account, with no offline text).</li><li>**Unmount mid-load:** `current()` is false, so no state is set; nothing is left to display.</li><li>**Overlapping loads** (visibility, `online`, 5-minute interval): the generation counter lets only the newest settle, and each has its own deadline.</li></ul> | Holds (S1) |
| **Is "offline" shown only for genuine network failures?** | `trackedFetch` (`:198-209`) converts only a fetch **`TypeError`** into `NetworkFailure` (and `networkFailed`). HTTP statuses resolve and **clear** `networkFailed`. Abort errors (`DOMException`) and timeouts aren't `TypeError`s. Controls: provider `TypeError` shows offline; HTTP 503 and 401 don't. | Holds |
| **Timed upkeep still pauses while the flag is false; first load and explicit Refresh attempt** | `scheduleNext` and the `availability` handler still check `navigator.onLine === false`. `refresh(initial = true)` skips the flag only for the effect's first call. `refreshProvider` (explicit Refresh) no longer checks it. The suite case keeps reads at 2 through 10 minutes of `offline`, then an explicit click gives 3, and the `online` event right after adds none. | Holds |
| **Duplicate provider loads?** | <ul><li>**Initial load plus an `online` event:** the effect's `refreshing` flag, `refreshProvider`'s in-flight dedupe (`providerPending` for the same key and user), and `nextAutoAt` after a settle stop a second request (tested: reads stay 1 after `online`).</li><li>**Re-runs after `settledProviderRefresh`:** `refresh(true)` still respects `nextAutoAt` and cooldown. Failures also set `nextAutoAt` (backoff), so a failing first load while the flag is false can't loop.</li><li>**`StrictMode` double mount:** 1 request (table).</li></ul> | No duplicates from this change (D1) |

## Notes

| # | Severity | Note |
| --- | --- | --- |
| **D1** | Info | **The doubled reads aren't reproduced here.** The component makes one `/provider` request per first load in every mode I measured. If the real-account run counted Yahoo reads **server-side**, the doubling probably sits behind `/provider` (for example, the roster and settings reads inside one snapshot) or in the `/data` and eligibility reads, not in this client path. It's worth checking the run's request log by route before attributing it. |
| **S1** | Low (by code) | **`checkingAccess` starts `true`** (`:134`). When `networkSuspended` is true from mount (a saved preservation journal), the access effect returns before any `load()`, so `checkingAccess` never settles while suspended. The refresh reason is unaffected (planHeld takes precedence). But the status-rail notice (`:1034`) still prints "Checking access for provider synchronization…" if the held workspace is non-manual, has **no roster**, and there's no `accessError`. That's narrow, since held backups normally carry a roster. A one-line fix: `setCheckingAccess(false)` before the `networkSuspended` early return. |
| **N1** | Info | Any fetch `TypeError` is treated as offline, including CORS or extension-blocked requests and invalid header values. That's acceptable ("the request could not be made"), but the copy says "You are offline". |
