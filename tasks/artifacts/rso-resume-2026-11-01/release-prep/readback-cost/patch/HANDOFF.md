# Isolated Start Chart auxiliary-read patch — ready for custody review

The patch is complete and tested in a disposable export of `c3897d3273ca46ea25a9f2737f09c835e5ec7325`. It is **not installed or committed**. TJ subsequently approved dispatch: the exact request is now posted under `RSO-START-CHART-BOUNDS-CUSTODY-REQUEST-20261101`; see `DISPATCH.json`. Canonical route/test bytes and the existing admission candidate remain unchanged. Exact original/proposed hashes and patch hash are in `DELIVERY.json`; `source.patch` passes `git apply --check --whitespace=error` against an original two-file copy.

Only these held paths are proposed:

- `web/pages/api/v1/start-chart.ts`
- `web/__tests__/pages/api/v1/start-chart.test.ts`

Behavior:

- CTPI is filtered by resolved season. The existing 30-day, at-most-32-team scope permits at most 960 rows and two 500-row pages. Exact counts must be finite, within scope, stable and complete; duplicate keys, overflow or incomplete pages fail as unavailable auxiliary context. A two-second abort deadline bounds the helper. The count request adds database work; no CPU reduction is claimed without measurement.
- Yahoo fallback uses one shared two-second budget for the base-player lookup, exact-date ownership and at most five historical 1,000-row pages. Each of the first two reads requests at most 501 rows as an overflow sentinel and accepts at most 500. Thus the fallback issues at most seven database calls. The preceding mapping/RPC capability reads are separate; this is not a whole-route CPU/time cap.
- At exhaustion/error, known observations—including zero—remain. Unresolved ownership stays null and the existing degraded-context status is used. Forecast rows and ranking are preserved. No arbitrary historical date cutoff was introduced.

Verification: nine new targeted cases pass; the complete route file passes **123 tests with one existing skip**. Scoped TypeScript checking (route/test dependency graph) and two-file ESLint pass. The original route failed eight new cases; the exact-date positive passed. The initial timeout harness still had only `Date` faked, so it was corrected to fake timers explicitly; both corrected timeout cases fail on the original route and pass on the proposal. Logs remain in this directory. No unrelated RSO suites or builds were rerun.

The proposal and its assertions were tested using inert environment values, the network guard, one Vitest worker, and the shared heavy-test lease. No environment files were loaded and no production/provider/database call occurred. The test export has no Git checkout or editing branch; it is recorded in `EXPORT.json`.

## Custody handoff — dispatched with TJ's authorization

> Claude session1e668672: PROV-GUARD retains the two exact paths above. Please review `tasks/artifacts/rso-resume-2026-11-01/release-prep/readback-cost/patch/DELIVERY.json` and `source.patch`. Either apply these exact proposed bytes under your custody, or explicitly allocate these two paths to the RSO Codex lane for installation after checking that the original hashes still match. Git custody stays with you. This is a separate, locally tested auxiliary-read change for the next coordinated release batch; do not fold it into or supersede the pending four-file RSO admission delivery without an explicit reconciliation. Return the accepted hashes or precise changes needed. No push, remote build, deploy, activation, current configuration lookup or data repair is requested.

TJ's approval was relayed by Scout, and the hash-bound request was appended once and read back. Claude's stated session reset is November 1 at17:20 America/New_York /22:20 UTC. One follow-up is scheduled for22:21 UTC; no immediate response or automatic transfer is inferred. Installing/committing this proposal remains **pending the owner's response**, not a denied or attempted operation. Any current file drift invalidates direct application and must be reconciled before installation.
