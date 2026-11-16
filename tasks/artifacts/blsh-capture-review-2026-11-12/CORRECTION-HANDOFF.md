# BLSH local capture correction — November 12, 2026

The local correction is ready for Chef integration: all three initial findings and both additional reviewer findings are closed. The final capture suite passes **87 runner + 29 actual-adapter tests (116)**. Current sKO/trade fixtures pass **66 + 22**, for **204 distinct passing cases** across the four suites. Independent follow-up found no remaining issues in its bounded scope; final lint and full configured typecheck passed. **No live capture is authorized or performed.**

## Exact candidate and ownership

Canonical checkout: `/Users/tim/Code/fhfhockey.com`, `octoberBranch`, base HEAD `24b1cb4d3048a3dba8234cf92c62e8f2b72f877f`, with an uncommitted two-file diff:

- `web/scripts/blsh/nativeProcessCaptureRunner.ts`: SHA-256 `5ef3a631cdc4abb8a6a8f5a2f3a379c75640fa82fb7b563a0feb9444c94099eb`.
- `web/scripts/blsh/nativeProcessCaptureRunner.test.ts`: SHA-256 `bfb68aac3aff5d5d2882a34138d42d7602fec5d3c0051a3bbfe0a80526d95b0b`.

[CORRECTION-CHECKS.json](CORRECTION-CHECKS.json) holds all current source/test hashes and the exact nine-role `captureRuntimeSourceSHA256` map. The adapter and shared NST sources are unchanged. Earlier November 9 `ADAPTER-CHECKS.json`, original review receipts and `REPRO.cjs` remain historical; the old probe intentionally rejects changed capture pins. Use this successor record for the current local correction.

Only this lane's runner/test and owned artifacts/diary changed. No sKO, trade UI, DateRangeMatrix, shared styling, sprint receipt, migration authority or servedForecastLedger file was edited. No branch/worktree, index/ref, commit or publication action was taken.

## Corrected behavior

1. **Journal durability:** fsync the output directory's parent after creating it, and the packet directory after every STARTED record. The job token is retained before begin. Failure stops the associated dispatch. The existing permit/deadline checks run after these durability operations.
2. **Request spacing:** track actual NST dispatch using `performance.now()` and wait/check at least 22 seconds of elapsed time. UTC completion clocks remain unchanged. Forward/backward wall adjustments cannot shorten local elapsed pacing.
3. **Run deadline:** initialize wall/monotonic clocks at function entry, before plan validation and source reads. The same 120-second work deadline constrains startup, operations, retention and publication. Enabled-mode cleanup is bounded to the original +125-second limit. Individual timeouts use the smaller remaining budget.
4. **Publication overruns:** check again after final manifest-directory sync and temporary-name removal. On failure, remove only the completion marker this invocation successfully linked, preserve payload/source/journal files, and write a partial failure receipt. If marker removal/durability cannot be established, `completionMarkerUncertain: true` records that uncertainty. An existing colliding marker is never deleted.

Synchronous OS filesystem calls cannot be preempted by JavaScript timers. The runner rejects an elapsed overrun when control returns; this is not a guarantee that a blocked OS call physically returns within 120 seconds. No subsequent provider action or successful completion is allowed after an observed expiry. Failure receipts and best-effort marker withdrawal can also require disk I/O; unavailable storage remains uncertain, never successful by inference. A failed invocation or FAILED receipt vetoes acceptance even if a marker could not be removed.

## Current sKO reconciliation

Three November 9 combined pins changed in commit `0f3614cb96`: `contract.ts`, `interpret.ts` and `fixtures.ts` under `web/lib/skoElement/`. Their current hashes are recorded rather than copied from the old receipt. They are outside the capture runtime graph.

The current v0.3 interpreter adds target admission clocks, source/permission/coverage checks, exact game membership, explicit unknown opportunity states and separate signed comparisons. Fixture issuance cutoffs now precede each issuance's read time; role evidence has known-at clocks and reference provenance. Current code preserves the forecast-optional observation path: missing forecasts produce `no_forecast`, unknown participation withholds observed ratios, and inadmissible expected values cannot be recovered through trade totals.

Verified against current code: all **66 interpreter tests** (including future issuance, denied comparisons, missing expiry, unknown membership and observation-only cases) and **22 trade UI tests**, including the merged observation-only goalie seam. This reconciles local consumer compatibility; it does not admit a real forecast, validate real goalie inputs or establish deployed behavior. No shared source changes were needed.

## Verification and review

- **Passed:** final 116-case runner/adapter suite, 11.93 seconds, [FINAL-RUNNER-TESTS.log](FINAL-RUNNER-TESTS.log).
- **Passed:** current 66-case sKO interpreter and 22-case trade UI suites; adapter also passed in that earlier combined run, [CORRECTION-TESTS.log](CORRECTION-TESTS.log). Overlapping adapter runs are counted once.
- **Regression evidence:** 20 new cases failed before the initial correction; four additional cases failed before the independent-review correction. Those negative runs also reported 10 and two asynchronous expected-rejection assertion errors; they are not passing checks. All 24 regressions now pass. Logs: [initial before](REGRESSIONS-BEFORE.log), [review before](REVIEW-REGRESSIONS-BEFORE.log).
- **Passed:** scoped ESLint after the final correction, [LINT.log](LINT.log); owned source diff whitespace.
- **Passed:** final successor full configured 8 GiB `npm run typecheck`, exit 0, [TYPECHECK.log](TYPECHECK.log). Initial-correction typecheck also passed; it was repeated because the independent review changed the candidate.
- **Independent review complete:** [INDEPENDENT-REVIEW.md](INDEPENDENT-REVIEW.md) records the first review's two reproduced deadline gaps and closes both against the exact successor hashes. No remaining findings were established in the bounded follow-up. Chef read that report and inspected the final diff and evidence. No source edits by the reviewer. Model/effort were explicitly requested as `gpt-6.1-sol` / `medium`; runtime metadata does not expose actual settings or a verified Chef/worker hierarchy. The documented unavailable-runtime fallback was recorded, not presented as verified staffing.
- **Not run:** browser, production builds, TLS/provider probes, real capture, database/ledger access, forecasts, migrations or deployment. Tests use mocks/fixtures; independent reproduction blocked real transports.

## Remaining gates

1. Coordinating Chef integrates the exact locally verified two-file successor; the implementing lane's review and final typecheck are complete. No deployment or production acceptance is implied.
2. Execution owner/NST custodian identifies the actual invocation, public project, existing lifecycle mode, loader/dependency/runtime pins and non-secret TLS/redaction configuration. No capture CLI exists; the old preparation executor remains closed.
3. After those gates and coordination around active production re-normalization, TJ separately approves an exact pilot candidate, date/URLs, project, lifecycle mode, 5/7/8 operation ceilings and listed admission-ledger writes. This local correction grants no capture authority.
4. The proposal fixes November 7. A freshly generated plan lasts 15 minutes, and the fixed date fails the current age guard from `2026-11-15T00:00:00.000Z`. A later run needs a newly reviewed date/URL proposal, never silent substitution.
5. Complete per-player/team-game membership, original official goalie inputs, source/method qualification and real application serving remain separate. The two-page pilot only supplies new unverified observations. Confirmed historical non-retention stays closed; baseline weight 1.0 and default-closed evidence acceptance are unchanged.
