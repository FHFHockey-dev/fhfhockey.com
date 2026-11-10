> Historical loading-only handoff. Current confirmation/loading candidate, current authorization and final pins supersede the state below: see `CONFIRMATION-HANDOFF.md` and `CANDIDATE.json`. Original loading pins are preserved in `LOADING-CANDIDATE.json`.

# Local RSO loading and access recovery

Verified local candidate on `octoberBranch`, base `11e4192d36ecc4ac4b338f9ab48e529c7049c618`. Not committed, pushed or deployed. Exact nine source/test paths and SHA-256 hashes are in `CANDIDATE.json`. Preserve other dirty lanes and the previously pending three-file workspace schema change.

## Diagnosis and measured evidence

The existing November 10 localhost trace shows page compilation/availability at 15:53:25.798 took 9.238 seconds. The initial access route started compiling at 15:53:35.416 and took 18.457 seconds, exceeding the existing 15-second client timeout. Its aborted request has no completed request span. The next access request at 15:58:35.390 took 0.400 seconds: exactly the existing five-minute interval explains the long unverified-to-verified gap. These are retained development-server spans, not end-to-end click timings.

The first current Yahoo planning-data request took 24.493 seconds including 16.955 seconds of route compilation. The recovered provider request took 16.462 seconds including 5.425 seconds of route compilation. Remaining time includes handler/upstream work; this evidence cannot attribute it solely to Yahoo. No new real requests were initiated to investigate.

The existing localhost tab had already recovered when inspected: provider refresh enabled, planning inputs confirmed, numeric Best Fit points visible. The confirmation action only records review; it is not a projection-fetch or numeric-display gate. A regression now explicitly proves Net Pts appear before confirmation and remain unchanged afterward while move selection is correctly disabled until review. Retained/unverified inputs, unknown data, unsupported scoring, forecast admission, actual roster slots, selected moves, and refresh choices retain their existing safeguards.

## Change

- Lightweight RSO-specific route feedback in the shared app appears while the route bundle is pending and clears on completion/cancellation. It preserves the currently mounted page.
- The RSO route loads the heavy workspace dynamically, with accessible initial-HTML/loading skeleton instead of a blank client-only slot.
- A timed-out or transiently failed access check retries once after three seconds in a visible tab. Failure continues to withhold provider access; subsequent manual retry is available. Successful denials and HTTP 403 are not automatically retried. Superseded attempts are aborted, stale completions ignored, timers cleaned up, and preservation holds respected.
- No paid-entitlement shortcut was introduced: the route also supplies account-save/upkeep capabilities and the measured failure was compilation, not evidence of a broken entitlement or session.

## Verification

- 274 focused Vitest tests passed across RSO component, real admitted grid points, route composition, and shared app telemetry/navigation; 3 additional transient-status cases passed (277 distinct cases).
- TypeScript passed. Focused lint passed (6 existing RSO hook-dependency warnings; changed tests clean). Scoped diff whitespace check passed.
- 4 Chromium cases passed: deliberately held route and workspace chunks; access timeout/recovery with selected-plan preservation; 20-slot desktop workspace; mobile tabs without overflow.
- Navigation feedback appeared in 27.66 ms under the held-chunk test. This measures immediate feedback, not a claimed 28 ms full load. The recovery case uses a synthetic clock: deadline at 15 seconds, retry after 3 seconds, no provider request before verified access.
- Skeleton and desktop screenshots visually inspected. Browser screenshots/results and sanitized retained timings are in this directory.
- Initial sandbox browser startup could not bind loopback (EPERM, no browser execution). A scoped test escalation succeeded. First browser attempt stopped on a test-only exact-name selector; corrected to include the descriptive link name, and all 4 then passed. No automatic-review rejection remains. Earlier Terminal UI inspection was denied by the app tool restriction; no retry was attempted, and the retained trace supplied the required evidence.
- Test browser/server used synthetic credentials, fixture responses, external browser request blocking and a Node loopback-only guard. Two npm registry version-check attempts were blocked before transport. The isolated test server is stopped; `web/next-env.d.ts` matches its pre-test bytes.

## Next step and boundaries

TJ confirmed the localhost RSO tab closed before edits to prevent hot reload from issuing fresh authenticated/provider requests. Cookies, login and saved inputs were not cleared. Local implementation is ready for TJ to reopen and privately test. No cookie reset or relogin is indicated by the evidence.

No fresh authenticated acceptance was performed after edits. An agent-run live check would need specific authorization for the application's existing authentication verification/possible token refresh and Yahoo provider refresh behavior. No new deployment is authorized by this task. A future release needs exact-candidate review and the repository's normal release coordination; do not bundle other dirty changes. This local issue is separate from the prior missing-points provenance repair `47df3e6`, already released and smoked earlier today, and from the independently reported FORGE NST persistence job failures.
