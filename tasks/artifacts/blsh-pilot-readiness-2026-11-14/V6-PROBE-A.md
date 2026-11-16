# v6 deployment check, part A: read-only (approval `tj.20261116.v6-probe-A`)

Deployment: `dpl_23ZsbjhAhM1Eb4utVV9gSby6Xeqi` (`fhfhockey`, production, region iad1, READY), commit `89284e9c4`. The Vercel CLI that ran the build was 65.14.0, with Next.js 15.5.22.

| PROBE-LIST item | Result | Evidence |
| --- | --- | --- |
| 10. Does the build bundle the `web/scripts/blsh` imports from `web/lib`? | **PASS** | The build log shows "Checking validity of types", "Created all serverless functions" and "Build Completed", with no error. |
| 13. Any storage policies specific to `blsh-native-packets`? | **PASS** | `storage.objects` has 4 policies, none of which names the bucket. The `anon` and `authenticated` "deny" policies are RESTRICTIVE, and the only PERMISSIVE policies are for `service_role`. RLS is on. |
| 1. Are system environment variables exposed? | **Likely default, unconfirmed** | TJ, 2026-11-16: the dashboard has no such toggle. Vercel's current UI appears to expose system variables by default. Part B confirms it directly: v6 refuses without `VERCEL_DEPLOYMENT_ID`. |
| M1. Is Fluid compute on? Does the route deploy as its own 250 s function? | **FAIL: Fluid is ON** (TJ, dashboard, 2026-11-16) | Concurrent requests can share v6's instance. **Scheduling is blocked** until the M1 fix is designed, reviewed and deployed. The fix is ticketed to the v6 lane as M1-FIX-DESIGN. |

Items 2–9 and 11–12 need part B, which includes a route call and needs its own approval.

**Scheduling stays blocked** until items 1 and M1 are settled and part B passes.

## Part B timing (Chef, 2026-11-16)

TJ approved part B after the M1 deploy (`tj.20261116.v6-probe-B`). The route's gate 1 stops with a 200 `pilot_fence` skip for capture dates before 2026-11-19, and with a 409 outside 12:00–12:30Z, before any environment or runtime check. So part B is useful only on **2026-11-19 12:05–12:30Z**, or later, with the switch off. A 200 `skipped: "disabled"` would then confirm gate 2 (system env, `VERCEL_ENV`, credentials, no lifecycle key) and gate 3 (CA store hashable, dispatcher).

**Correction to what TJ was told:** with the switch off, part B does **not** run the gate-5.5 self-test, and the response does not return the runtime facts. The self-test first runs on the first enabled invocation, where a failure is a free 503 before any claim.

**Auth:** cron bearer only (`withOperationalRouteAuth`). Each call writes one `cron_job_audit` row.
