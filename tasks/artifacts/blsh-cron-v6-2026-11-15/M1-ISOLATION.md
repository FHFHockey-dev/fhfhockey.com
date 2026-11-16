# M1: in-process isolation of the capture route (V6-REVIEW c0789453)

**Superseded in part (2026-11-15):** TJ confirmed Fluid compute is ON. See `M1-FIX-DESIGN.md` for the fix options and the recommendation, a context-tagged v6 observer. The "narrowed observer" option below is strictly weaker.

## The risk

- **The observer:** v5's TLS observer (`withTlsObservation`, imported unchanged) subscribes to the process-wide `undici:client:sendHeaders` channel for the duration of one action. It requires **exactly one** event, and that event must match.
- **What breaks it:** any other undici request in the same Node process during an admission call (about 1 s) or an NST GET (up to 15 s) adds an event. The run then fails **after** that call was spent.
- **Outcome:** it fails closed (no false evidence), but D is burned.

## What this lane changed (primary fix: isolation)

**`web/vercel.json`** gets one new entry, `"pages/api/v1/db/blsh-native-capture.ts": { "maxDuration": 250 }`. The route itself exports `config = { maxDuration: 250 }`.
- **Unchanged:** `ignoreCommand`, the `pages/api/**/*.ts` glob (240) and every cron.
- **The test:** `handler.test.ts` pins this exact `functions` object.

**What Vercel's documentation says** (fetched 2026-11-15):

1. **A distinct configuration means a separate function.** "Configure separate functions for Next.js pages API with vercel.json … Each route is bundled separately because it has a different configuration."
   - The value must differ from the glob's 240, or the route may share a function with the rest of `pages/api`.
   - Function code has the highest precedence ("Settings in your function code always take top priority"). The route's exported 250 decides, and `vercel.json` carries the same value.
   - **What this removes:** other routes' invocations from the capture's process. For example, the every-minute crons `/api/internal/starter-board` and `/api/internal/yahoo-live-draft` at 12:05, and other `adminOnly` routes.

2. **It does not guarantee zero in-function concurrency.** Under Fluid compute, "multiple invocations [can] share a single function instance", and "this in-function-concurrency is especially effective when multiple requests target the same function".
   - Fluid is enabled per project (dashboard **Functions → Fluid Compute**) or per deployment (`"fluid": true|false` in `vercel.json`).
   - The docs show **no per-function switch** that turns optimized concurrency off.
   - So after isolation, the remaining exposure is a **concurrent invocation of this same route** during a capture:
     - **the 12:20 backup trigger:** it doesn't overlap, because the capture ends long before 12:20;
     - **a stray or hostile request to `/api/v1/db/blsh-native-capture` with any bearer:** `adminOnly`'s JWT path makes two `supabase-js` calls on the global fetch;
     - **any second cron trigger.**

## What decides it (added to PROBE-LIST, item M1)

- **Is Fluid compute on** for the fhfhockey project's production deployments? Check the dashboard setting, and whether `vercel.json` sets `fluid`; it does not today.
- **After the inert deploy:** does the build output list `blsh-native-capture` as its own function? Check the deployment's function list, read-only.
- **If Fluid is off:** each invocation runs in its own instance, and isolation is complete.
- **If Fluid is on, two options, both for TJ:**
  - **(a) Turn Fluid off for the project** (`"fluid": false`, or the dashboard). That changes cost and cold-start behaviour for every route, so it is a project decision, not this lane's.
  - **(b) Accept the residual risk.** Requests to this exact path at 12:05–12:07 are rare; a stray one burns that day's date and nothing else. The 12:52 watchdog-assert makes any loss visible.

## Option (not implemented; needs Chef): a v6-local observer that counts only matching events

- **What it is:** a copy of `withTlsObservation` in `web/lib/blsh/nativeCaptureV6/`. It ignores events whose origin, path or method differ from the action's, and still requires exactly one matching event.
- **What it fixes:** concurrent requests to **other** origins, such as Yahoo, NHL GameCenter or Sanity, would no longer fail the run.
- **Trade-offs:**
  - A concurrent request to the **same** origin and path still matches and fails the run, as a duplicate. Examples: a second admission RPC to the Supabase project, or the same NST URL.
  - A concurrent `supabase-js` call is on the same origin with a **different** path (for example `/auth/v1/user` or `/rest/v1/users`), so it would be ignored. That is correct, because it is not our request.
  - It would no longer be the reviewed v5 observer byte for byte. It needs its own review, and the bridge's statement that "the observer is v5's" changes.
  - The pinned v5 adapter stays untouched either way.
- **Recommendation:** isolation first (done), and the probe decides on Fluid. Use the narrowed observer only if the probe shows Fluid on and TJ declines option (a).
