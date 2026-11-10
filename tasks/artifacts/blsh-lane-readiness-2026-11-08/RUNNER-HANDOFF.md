# BLSH durable runner — local implementation, November 9

**Historical core handback (01:04 UTC).** The later sprint wires the actual merged NST adapter and supersedes the pending-interface statements below. Current implementation, checks and limits: [ADAPTER-HANDOFF.md](ADAPTER-HANDOFF.md) and `ADAPTER-CHECKS.json`. Preserve the earlier receipt as history.

Implemented `web/scripts/blsh/nativeProcessCaptureRunner.ts` and its adjacent test on `octoberBranch`. This is a working orchestration/retention core with a mocked adapter, not another plan-only function. It has no live adapter, credential reader, shared-client import or CLI. The existing preparation function still refuses live execution. Nothing in this handoff authorizes capture or a ledger write.

## Implemented behavior

- Rebuild the strict preparation plan, pin source snapshots, and reject changed URLs/date, stale planning clock, wrong project or changed lifecycle mode before transport. Only the proposed November 7, 2026 date and production origin `fyhftlxokyjtpndbkfse.supabase.co` qualify. A later date needs a revised proposal/code review; no silent substitution.
- Consume one official schedule response and require the one target day, nonempty completed regular-season slate, current season and coherent unique game/team identities. Reject ambiguous/escaped duplicate JSON keys, postponed/live games and missing finality. This is a date witness, not per-player appearance evidence.
- Count every hooked GET/RPC attempt before dispatch. Persist its STARTED receipt first. Block duplicates, wrong order, overlap, further calls after failure and calls beyond the deadline. One shared admission call per page; validate and record allowed/denied/invalid/expired receipts. An admitted request must start inside the existing one-second permit window.
- Sequence individual then on-ice, at least 22 seconds between NST starts. Carry one request control with two attempts/planned requests, retries zero, query fallback false, provider timeout 15 seconds and body limit 2 MiB. Dispatch exposes the exact URL, method, redirect refusal, abort signal and body limit to the adapter. Schedule limit is 1 MiB; RPC limit is 64 KiB. Work stops at 120 seconds; existing enabled lifecycle gets at most five more seconds for cleanup.
- Retain the canonical client's exact returned parser bytes and original observed body-completion clock. The adapter can attach redacted parser text to the original dispatch witness after the client returns; it cannot change the recorded clock or transport facts. Keep raw schedule bytes. Reject invalid UTF-8, empty/non-table pages and more than 5,000 table data rows.
- Write new private directories/files, fsync each file and directory, retain the first page before requesting the second, and cap the whole packet at 8 MiB including source/operation metadata. Publish a flushed/fsynced temporary manifest through an atomic no-replace hard link, after provider/retention and lifecycle settlement. Mid-write or pre-publication fsync failure leaves no new final manifest. A collision preserves the existing file. A filesystem error after the atomic link can leave a complete manifest alongside a failed operation result: inspect the retained packet, never automatically rerun it.
- Preserve safe operation outcomes and successful pages on failure. Do not copy arbitrary exception text, request headers, credentials or RPC bodies into receipts. An abort-ignoring adapter is marked unsettled; the core does not claim it cancelled successfully or start overlapping cleanup.

The output remains `packet_complete_pending_review`, with `independentlyAccepted: false`, `advancedAdmission: false`, `score: null`, `TLSVerified: null`, unknown model/publication facts and `liveAdapterAvailable: false`. It is not a `NativeReceipt`, source acceptance or a runtime snapshot. Baseline weight 1.0 is unchanged.

## Exact interface for Claude NST and BLSH integration

`NativeCaptureAdapter` is the only transport dependency. Its `schedule`, `withJob` and `nst` methods receive the runner's `CaptureDispatch`. **Every actual HTTP attempt, including body consumption and lifecycle cleanup, must pass through that dispatcher.** No hook may be invoked after an already-sent request merely to produce accounting. A transport that calls hidden fetches cannot satisfy the bounded contract; these local tests do not certify any unimplemented adapter.

| Boundary | Owner / action | Required evidence |
| --- | --- | --- |
| `web/lib/nst/**` body/admission controls | Claude NST `local_3bb2755d`, through Chef `local_c4e6c533` | Integrate reviewed bounded streaming and opt-in single-admission cap with defaults unchanged; return concrete field names and a pre-dispatch hook covering each admission and provider attempt/body |
| Existing job lifecycle | BLSH adapter with NST owner review | Reuse `runNstJob` and its RPC injection for begin/finish/hold; preserve its uncertainty and occupancy semantics, actual mode and deadline. Do not replace it with the test simulation |
| Canonical authenticated provider call | BLSH adapter after owner interface agreement | Call `fetchNstTextByUrl` with the actual shared/local controls. Attach its exact returned redacted text to the observed NST body-completion witness. No alternate fetch/cache/key or budget store |
| Schedule transport | BLSH adapter | One bounded, abortable GET using the dispatch URL/limits and actual response facts; original bytes retained. No extra lookups |
| Producer/TLS/secret review | NST owner and independent reviewer | Source hashes for the executable adapter/client/redactor, runtime certificate-verification evidence and credential-echo tests. Current null TLS evidence cannot be promoted by a boolean claim |
| Live candidate | BLSH integrates, parent reviews, TJ authorizes execution separately | Exact runner/adapter/shared-source pins, existing non-secret mode/project, mocked full-adapter checks for every hidden path, then one bounded execution request under FRESH-CAPTURE-PROPOSAL.md |

`maxAdmissionCalls: 1` is currently a **port requirement**, not a claim that this property exists in canonical `NstRequestOptions`. Do not cast it into the existing shared client and assume enforcement. The canonical shared-admission loop still has no count cap. The pending interface request is `CODEX-BLSH-RUNNER-INTERFACE-20261109-06` in the existing local mailbox. The completed core does not resolve that integration gate.

The runner snapshots itself, preparation, adapter, client, budget, admission, lifecycle and rate-policy files against supplied exact hashes. A file hash identifies bytes; independent review must establish that those bytes were the code actually executed, every transport path uses the dispatcher, the existing runtime mode/target matches, and body streaming/abort/authentication/redaction obey the contract. These pins are not self-authentication or execution approval.

## Verification

Run from `web/`:

```text
npm test -- --run scripts/blsh/nativeProcessCaptureRunner.test.ts
npx eslint scripts/blsh/nativeProcessCaptureRunner.ts scripts/blsh/nativeProcessCaptureRunner.test.ts
NODE_OPTIONS=--max-old-space-size=8192 npx tsc --noEmit
```

The final focused run passed **53 tests** in 4.88 seconds (4.568 seconds of tests); scoped ESLint passed. Exact source pins, full TypeScript outcome and command receipts are in `RUNNER-CHECKS.json` and the enclosing manifest. Initial TypeScript failures exposed this repository's Buffer/Uint8Array declaration mismatch and local inference issues; the successor uses explicit byte views and typed records. Those failed runs are not hidden or called passes.

Tests block real fetch/sockets and real NST client/budget/admission/lifecycle imports. They exercise both lifecycle modes (5/7 calls), all seven failure points including the eighth hold after uncertain finish, denied/expired/malformed permits, duplicate calls, schedule ambiguity, exact URLs, source pins, target/mode/scope refusal, 22-second pacing, timeout/stalled/unsettled adapters, body/row/packet limits, original clocks and canonical-text attachment, first-page preservation, and injected write/fsync/collision failures. No provider, database, shared/local ledger or reserve access occurred. These are tests of the core against a simulated contract, not proof of production transport, global admission, TLS, source/model acceptance or goalie/application serving.

## Other lane work and next step

The already-verified trade selector fix remains available (21 tests and its recorded type/lint checks); it supports retrospective evidence without a forecast. No further trade change is needed for capture integration. The goalie blocker remains the Claude-owned observation-only interpreter seam and a retained current-season complete team-game/official boxscore/starter/outcome packet, with the full admitted forecast envelope where available. No shared goalie/Sko files or reserve-reading helper were touched.

Next action is a concrete adapter/interface response from Claude NST, followed by BLSH wiring and full mocked adapter verification. The two-page pilot can then be proposed with exact code for separate execution approval. It cannot supply complete latest-five membership, qualify the current source/method, replace the stale runtime candidate or authorize deployment by itself.
