# Native NST boundary handoff

Updated after the November 9 bounded adapter sprint. Claude's controls are merged and BLSH's actual adapter is wired/mock-verified; see [ADAPTER-HANDOFF.md](ADAPTER-HANDOFF.md). Do not start collection or production work from this note.

## Exact shared-file decision

**Custody confirmed: Claude.** `CLAUDE-CHEF-ACK-CODEX-BLSH-CONTINUATION-20261108-03` identifies Chef `local_c4e6c533`, NST executor `local_3bb2755d`, and TJ's November 7 transfer of `web/lib/nst/**`. The recorded November 8 decision keeps BLSH/RSO with Codex. The old Codex lease still names `01a19780-b73c-7334-9e53-4b7fda61201c`; the original owner/root coordinator must append its release receipt and `07-nst.md`. That administrative gap no longer makes current custody unknown. BLSH claims no shared NST path and has edited neither client nor its test.

Historical optional body patch, now integrated by Claude in PR #419:

- Base: `web/lib/nst/client.ts`, SHA-256 `48d82fc40ca06d9abe4675f4a1896add55c4e53d4dee661bbe082d424c944e4f`.
- Candidate: `../blsh-native-capture-preparation-2026-11-07/nativeProcessCaptureClient.candidate.ts`, SHA-256 `99ad45c5ffc88f8ccb24b2d69f5fbad7c6dbcb800fcbd1962c0ab6c7f8945388`.
- Patch: `../blsh-native-capture-preparation-2026-11-07/nativeProcessCaptureClient.patch`, SHA-256 `827445c19e2791dfc0fb1c7255581a559097e29fd8d37312322f0e51cf64d3f0`.
- [Exact contract and prior checks](../blsh-native-capture-preparation-2026-11-07/HANDOFF.md), [review](../blsh-native-capture-preparation-2026-11-07/LOCAL-REVIEW.md). The earlier applicability check passed against the base; do not reapply it to the integrated successor. Current source/dependency pins are in `ADAPTER-CHECKS.json`, including the subsequent admission-origin guard. The optional cap bounds accepted decoded response bytes, not wire bytes.

## Historical evidence request closed by non-retention

Chef's acknowledgment explicitly reports **no retained NST raw response bodies or original clocks for the requested handoff**. The November 1 request (`CODEX-BLSH-NST-EXACT-OWNER-EVIDENCE-REQUEST-20261101`) is therefore answered by non-retention. Stop searching for those historical bytes. Stored-row verification and an in-memory cache cannot recreate the missing receipt or its original retrieval clock.

The next evidence must be a new source observation under the [bounded fresh-capture proposal](FRESH-CAPTURE-PROPOSAL.md), with new clocks and immutable retention. Do not refresh/re-date the old request or use a new capture as proof of the old source state.

## Later capture is still separate

The older preparation execute function still throws. The new actual adapter is an explicitly constructed API with no CLI or automatic invocation. Its current output is pending review, not a `NativeReceipt`, source acceptance or score. It binds exact client-returned parser text, the original body-completion witness and current source hashes, and retains private lifecycle references and partial failures. Runtime TLS and independent source review remain open.

The proposed pilot fixes candidate date 2026-11-07, one official NHL schedule GET and two sequential NST date/group GETs, no retry, 15-second provider timeout, 120-second work deadline plus at most five seconds for the existing hold path, and 2 MiB accepted decoded input per NST page. Recreate the strict local plan against the execution clock; the old example is expired. Official completion verification occurs before NST admission and may stop the run.

**Two NST attempts is not two external calls or two writes.** The merged `maxAdmissionCalls: 1` option now enforces one admission POST per page, while the adapter's hook accounts for each attempt before transmission. Counting official schedule and existing begin/finish/hold, the ceiling is eight application-level operations, including at most five production Supabase RPCs (five operations total in existing disabled lifecycle mode). The proposal specifies legacy `last_untracked_at`, permit-ledger and optional job-row effects. Both local/global controls and 39/minute, 22-second pacing remain in place; no alternate key, local-only ledger or client bypass.

The [current review handoff](REVIEW-AND-RUNTIME.md) records the corrected pre-dispatch timing fence, 63 runner tests, 29 adapter tests, scoped lint and full TypeScript passing; the earlier 22 UI tests remain valid at unchanged pins. Adapter tests use the real client/admission/lifecycle with mocked HTTP and local ledger. The hook consumes sanitized settlements rather than raw RPC bodies. Schedule and lifecycle bodies are bounded; shared admission JSON retains its existing parse path, so no new admission-body byte cap is claimed. Local loader/TLS probes passed; the configured capture environment and independent acceptance remain open.

The code-interface request is resolved by `CLAUDE-NST-CLIENT-OPERATION-CONTROLS-20261109-08`, the merged origin guard and this BLSH integration. Next: independent review of the exact candidate, intended-runtime mode/TLS/redaction evidence, then TJ's separate execution approval. The owner-reported disabled lifecycle mode was inferred from earlier release/readback evidence, not freshly verified here. The original owner/root coordinator retains historical lease-record cleanup. No shared code is transferred to BLSH, and no live execution, policy adoption or deployment is authorized by this note.
