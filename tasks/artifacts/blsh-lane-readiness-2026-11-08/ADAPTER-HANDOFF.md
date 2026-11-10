# BLSH actual adapter handoff — November 9 sprint

**20:49 UTC successor:** [REVIEW-AND-RUNTIME.md](REVIEW-AND-RUNTIME.md) records a reproduced and corrected pre-dispatch timing defect, **63 runner + 29 adapter tests**, actual loader imports and four TLS checks after candidate imports. Current pins are in `ADAPTER-CHECKS.json`; the original sprint runner/test/check receipt is preserved under `review-baseline-2026-11-09/`. The sprint results below are historical. Independent acceptance and the actual capture execution environment are still pending.

The actual adapter is wired and locally verified. `web/scripts/blsh/nativeProcessCaptureAdapter.ts` calls the merged canonical NST client, shared admission and job lifecycle. It has no CLI or automatic invocation. No live capture, ledger operation, production change or release occurred. The API can reach production when explicitly called; execution remains separately authorized.

## Implemented integration

- Use the actual `maxResponseBytes`, `maxAdmissionCalls` and `operationHook` options. NST traffic stays in `fetchNstTextByUrl`, retaining its authenticated route, shared/local controls and redactor. The runner's two-attempt control is shared across both pages; retries and query-key fallback stay off.
- Route every admission POST and NST GET through the pre-dispatch runner. Check the hook's exact method, URL and first-attempt index before calling `perform`. Consume the owner's sanitized admission settlement (`httpStatus`, `valid`, `allowed`, `waitMs`); do not invent a retained raw receipt's version/scope/TTL. The pinned shared validator establishes the existing one-second permit contract, and both the core and client enforce expiry.
- Attach the canonical client's exact returned parser text to its original body-completion witness. Match actual response facts; retain no regenerated retrieval clock. Reject a literal or URL-encoded credential echo before retaining the page, without rewriting the client's text or logging a credential. This local check does not establish every possible redaction form or runtime TLS provenance.
- Reuse `runNstJob` with its existing RPC injection. Preserve disabled/enabled behavior, token/context, begin/finish/hold ordering, uncertain outcomes and one error-path hold. Schedule and lifecycle HTTP use the same dispatcher with bounded body consumption and abort signals. A lifecycle acknowledgement must match its expected status and original token.
- Durably record the lifecycle job token in the **private** STARTED receipt before transmission. Finish and hold must reference the same token. This preserves the concrete reconciliation target if begin is uncertain; no extra status lookup or retry is made. Service credentials and full RPC bodies are not retained.
- Check the exact project, existing lifecycle mode and credential presence before any transport and again throughout execution. Code does not change environment variables or activation flags. The shared helper's reserved `.invalid` test origins are not accepted by this specific pilot adapter; tests mock fetch at the exact proposed production-shaped origin.

The runner still limits the proposal to November 7, 2026: one official schedule GET, then individual/on-ice NST pages, one admission per page, 22-second pacing, and no follow-up after failure. The normal disabled/enabled paths use 5/7 operations; uncertain finish plus hold reaches at most 8. Failed permits and uncertain mutations are not refunded or retried.

Accepted decoded body bounds are 1 MiB for schedule, 2 MiB per NST page, and 64 KiB for the adapter's lifecycle RPCs. Packet retention remains 8 MiB including sources/metadata, with at most 5,000 table data rows per page. **Admission RPC JSON is still read inside the shared client's existing `response.json()` path; this integration does not add or claim a 64 KiB admission-response bound.** No exact incoming/wire-byte limit is claimed. Work remains bounded to 120 seconds, plus the existing at-most-five-second hold allowance.

## Provenance reconciliation

Parent identified PR #419. Its local merge object is `83cba85f8` ("NST client controls, admission pin, Sko goalie seam"). The inspected current NST client/shared-admission/lifecycle/origin-helper and sKO contract/interpreter blobs match that merge. The merge commit itself is not an ancestor of `octoberBranch`; no branch sync, merge or Git mutation was performed during this sprint.

The earlier NST mailbox pins predate commit `96101713a`, which added the production-project guard. The updated capture source set therefore includes `admissionOrigin.ts` and refreshed shared-admission/lifecycle pins, alongside the merged client. Exact current source hashes, redactor section hash and test pins are in `ADAPTER-CHECKS.json` and the current enclosing manifest. The old `RUNNER-CHECKS.json`, initial reconciliation and original proposal receipt remain historical evidence; they are not relabeled as current executions.

## Checks actually run

- **55 runner tests + 29 actual-adapter tests passed** in the final combined run (84 total, 7.34 seconds).
- **22 trade UI tests passed**, including a new integration test through the actual merged observation-only goalie interpreter.
- Scoped ESLint and full `NODE_OPTIONS=--max-old-space-size=8192 npx tsc --noEmit` passed. Node was `v22.23.4`; diff whitespace passed.
- No build, browser run, full application suite or provider/database request was needed for this script integration.

The adapter tests run the actual NST client, shared-admission and lifecycle modules. Only HTTP and the local file ledger are replaced; all credentials are synthetic. They cover both modes and exact endpoints/tokens, preserved local-control calls, raw-versus-redacted parser text, original clocks, stale source pins, project/mode refusal and drift, all failure stages, one-call denial/invalidity/expiry, response limits, redirects, body abort, credential echoes, uncertain finish/hold, private reconciliation references and retained file hashes. The initial adapter run had one failed fixture assertion: a bare synthetic Response did not model fetch-signal cancellation. The corrected fixture models that transport linkage; no failed run is counted as a final pass.

The new UI regression uses an explicitly synthetic goalie and the real `interpretPlayer` without a forecast. Unknown participation remains unknown; forecast numbers remain withheld in the actual trade component. This verifies the consumer seam without manufacturing an official goalie trace. No shared sKO/NST files were edited. The trade component implementation itself is unchanged from this lane's earlier selection fix.

## Remaining gates and safe next step

1. Parent/independent reviewer reviews the exact adapter/runner candidate, pins and operation accounting. The final code is local and uncommitted. Source hashes identify bytes; they do not self-certify the executed runtime or every transport assertion.
2. Establish the intended execution runtime's non-secret mode/project, TLS verification and redaction evidence. The owner reported lifecycle off from earlier release/readback evidence, not a fresh runtime verification. The adapter rejects a mismatch instead of changing mode or target. `TLSVerified` remains null in current output.
3. TJ separately approves one exact candidate under `FRESH-CAPTURE-PROPOSAL.md`: exact date/URLs/project, actual mode, source hashes and the documented ledger effects. Recreate the strict plan immediately before that authorized execution; it expires after 15 minutes. The old preparation function still refuses execution. There is no live command in this handoff.
4. Source/model acceptance, complete current-player membership, official per-player frames and serving remain separate. Two NST pages cannot complete the first pass or authorize the stale snapshot. No source acceptance or score is produced here; baseline weight 1.0 is unchanged.
5. The goalie observation-only seam is resolved. Its owner confirmed **non-retention** of an official current-season goalie packet and an admitted forecast envelope. A real goalie trace requires separately approved bounded evidence collection; do not restart the historical search or substitute fixture/derived output. The descriptive personal-reference block is not an accepted retrospective goalie method.

Checkpoint writing began at 15:31 UTC, before the requested 15:50 cutoff. The lane finishes by the 15:55 hard stop; final stop time and exact remaining state are recorded in its ongoing diary.
