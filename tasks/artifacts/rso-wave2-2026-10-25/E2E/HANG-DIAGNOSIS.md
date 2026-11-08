# RSO-HANG diagnosis: "Checking access for provider synchronization…" stall on production 538100d41 (2026-10-26, Claude)

No canonical-tree edits. Repro ran offline in `/private/tmp` git-archive copies of **538100d41** and **bd337d97a**, each served on isolated :3160 (`PLAYWRIGHT_ISOLATED_NEXT=1`, server cwd verified). All `/api/**` and Supabase REST calls were mocked; every non-loopback request was aborted. Probe spec and logs are in `E2E/hang/`. The archives are deleted.

## TJ's signature
- the stall text "Checking access for provider synchronization…";
- Source "Yahoo saved view";
- the only `/api` call is `GET …/workspace`: no `/access`, no `/data` or `yahoo-current-data`, no console errors;
- 0 NHL games;
- context `[yahoo, 20262027, manual, manual, 2026-10-26, 2026-11-01, America/New_York]`.

## Results (538100d41, signed-in fixture principal, TJ's localStorage keys)
| Variant | Access status shown | Source | `/api` calls | Matches TJ? |
|---|---|---|---|---|
| TJ keys, online | "Select an owned team before refreshing provider inputs." | Yahoo | `/access` **and** `/workspace` | No (access resolves) |
| TJ keys plus a saved server record | same | Yahoo | `/access`, `/workspace` | No |
| **TJ keys with `navigator.onLine === false`** | **"Checking access for provider synchronization…" (never resolves)** | **Yahoo saved view** | **only `/workspace`** | **Yes, exactly** |
| Stale preservation journal in sessionStorage | none (network suspended) | Manual | none | No |

**Pre-release bd337d97a** with the same workspace in its device-wide key and `onLine === false` gives the **identical signature**: "Checking access…", "Yahoo saved view", only `/workspace`. So the stall is **not introduced by release 4**.

## Root cause (code at 538100d41)
1. **The access check stalls when the browser reports offline.**
   - In `web/components/RosterScheduleOptimizer/RosterScheduleOptimizer.tsx:411-413`, the access effect sets `setCheckingAccess(true)`, then `load()` returns early on `navigator.onLine === false` (or a non-idle preservation phase) **without clearing `checkingAccess`**.
   - The status at `:396` checks `!canSync ? checkingAccess ? "Checking access…"` before the offline branch, so "You are offline…" is never shown. With `canSync` false, Source shows "Yahoo saved view".
   - The account read (`:447+`, `GET /workspace`) does not check `navigator.onLine`, which is why it is the only request. Planning reads are gated by `allowRead: … && online && !planHeld` (`online` from `:145`/`:213`), so no `/data` either. It recovers only on an `online` event or visibility change, which doesn't fire while the browser keeps reporting offline.
2. **0 NHL games, independently:** the stored context is Yahoo with `leagueId`/`teamId` "manual" and an empty roster. `inputSnapshot` (`:598-617`) has no provider snapshot and `retainedScheduleSnapshot` has nothing to retain, so it is `null` and no planning read runs, even when online and access resolves (the online variant shows "Select an owned team…"). Release 4's ownerless migration (233f59b52, TJ-approved) dropped TJ's pre-release device-wide Yahoo workspace (team, roster), so TJ's account slot now has only this team-less Yahoo context. That is expected after the migration: select the owned team again, or continue manually.

## Confirmation from TJ's Chrome
**Confirmed 2026-10-26 (AskUserQuestion): TJ reports `navigator.onLine` is `false` on the RSO tab.** The root cause above holds. Why Chrome reports offline on that machine (VPN or virtual network adapter, OS connectivity probe) is outside the app; the fix makes RSO not hang on it.

### Original check (kept for reference)
The offline flag reproduces the signature exactly and nothing else I tried does, but I can't observe TJ's browser. On the RSO tab, in the DevTools console:
- `navigator.onLine`: **false confirms the root cause.**
- `sessionStorage.getItem("fhfh:rso:preservation:v1")`: should be `null`.
If `navigator.onLine` is `true`, the remaining candidate is `supabase.auth.getSession()` never resolving inside the access load's `authHeaders()` (`:54`, awaited before the `/access` fetch). That isn't reproducible offline with mocked auth.

## Minimal fix (not applied; awaiting confirmation)
- `RosterScheduleOptimizer.tsx:413`: when the access load skips because the browser is offline or preservation is held, **clear the checking state and say why**, rather than leaving "Checking access…" up:
  ```ts
  if (navigator.onLine === false || preservationRef.current.phase !== "idle") { setCheckingAccess(false); return; }
  ```
  With `checkingAccess` false and `online` false, the existing status shows the offline or upsell text. Retry stays on `online`/visibility as today.
- Optional hardening: show "Select an owned team or continue manually" in place of the empty week when a provider context has no team (`teamId === "manual"`), so a team-less Yahoo context never looks like a hang.
- Regression test: a component test with `navigator.onLine === false` asserting the status is not stuck on "Checking access…".

## Fix applied (TJ's go-ahead, 2026-10-26; uncommitted)
| File | sha256 |
|---|---|
| web/components/RosterScheduleOptimizer/RosterScheduleOptimizer.tsx | 7917cbc69cdb993e4fa742610a14b2fa7881c49593d373a8184bb7100a4b025e |
| web/__tests__/components/RosterScheduleOptimizer/RosterScheduleOptimizer.test.tsx | 0453faa277dd38b598091dcae819de4f7900c50c4cc3df08488218703abfe601 |

- **Access load:** when skipped because the browser reports offline or preservation is held, it now calls `setCheckingAccess(false)` before returning. When a retry (`online` or visibility event) does run, it sets `setCheckingAccess(true)` so reconnecting shows "Checking…" rather than the upsell.
- **Status order:** the "You are offline…" reason is now checked **before** the access branch. Without this, an offline paying user would have seen the premium upsell once "checking" ended.
- **Regression test** (component test, "does not stay on checking access while the browser reports offline, then checks once back online"):
  - offline at mount: shows the offline reason, never "Checking access…", sends no `/access` request, and keeps Refresh disabled;
  - after an `online` event: `/access` is fetched and the reason leaves offline/checking.
  - **Mutation check:** against HEAD's unfixed component (a `/private/tmp` git-archive copy, since deleted), it fails with exactly TJ's symptom: received "Checking access for provider synchronization…" (`hang/rso-offline-mut.log`).

| Check | UTC | America/New_York |
|---|---|---|
| RSO suites (`lib/rosterScheduleOptimizer`, `__tests__/components/RosterScheduleOptimizer`, `components/RosterScheduleOptimizer`, `hooks`, `lib/in-season`) | **1633/1633** | **1633/1633** |
| eslint (both files) | 0 errors; the same 6 existing react-hooks warnings | |
| Whole-project `tsc --noEmit` under `/private/tmp/fhfh-heavy.lock` | exit 0, 0 errors | |

Not changed: while a preservation hold is active, the skipped check now ends on the access fallback text (upsell) in place of "Checking…". Holds have their own notices, but a dedicated "paused while preservation holds this plan" reason would be clearer if wanted. The team-less Yahoo context (0 games) is unchanged; TJ needs to select the owned team or continue manually.
