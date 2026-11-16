# BLSH bootstrap — local candidate, not pilot approval

Implemented only [nativeProcessCaptureBootstrap.ts](../../../web/scripts/blsh/nativeProcessCaptureBootstrap.ts) and [its test](../../../web/scripts/blsh/nativeProcessCaptureBootstrap.test.ts). Existing runner, adapter, shared NST files, manifests and production settings were not changed in this increment. The original runner correction remains local. Source/runtime inputs remain pinned, with the Browserless declaration changes outside this candidate.

Bootstrap SHA-256: **`d4d2fcac52ffd272307b97bcbe79a008d888f7ee05f96526888cdcea2a34c97f`**. Test SHA-256: **`47a531687a925dfe4dc045444d4894c7798e572f5b55b1b1078f223672816533`**. Exact checks and exits are recorded in [BOOTSTRAP-CHECKS.json](BOOTSTRAP-CHECKS.json).

## Behavior and scope

No arguments or `--check` perform local checks only: exact checkout/bootstrap path, Node 22.23.4 binary, loader arguments/configuration, four dependency entries/manifests, tsconfig, nine source-role hashes and their actual CommonJS resolution, and absent output under a user-owned 0700 parent. It reads only allowlisted non-secret environment values. It does not import the capture modules, inspect credential presence/values, create the output directory or invoke transport.

`--run <absolute authorization.json>` is the only execution path. A bounded regular, non-symlink, user-owned **0600** JSON file must record the exact externally approved bootstrap hash, project, disabled mode, output, proposed slot, five-attempt limit and references to the human approval, coordinator clearance, configured runtime and admission evidence. Unknown/missing fields, mismatches and future approval clocks fail before adapter construction. No `.env` loading or environment changes occur. **A hand-written receipt cannot establish actual permission; the owner must obtain and retain the referenced approvals/evidence first.** No valid authorization file was created in this task.

The fixed proposed start window is **2026-11-13 14:05:00 inclusive to 14:06:00 UTC exclusive**. With the runner's 120-second monotonic work deadline, work ends before **14:08 UTC** (synchronous OS calls can only be rejected on return, as already documented). This refines the earlier single instant/14:07 proposal; the final user approval must cover this actual window. There is no automatic scheduling or reschedule. Source date remains November 7; changing the proposed slot, output or source date requires a reviewed successor and revised approval.

After the gates, the bootstrap loads the pinned preparation/runner/adapter, rebuilds one fresh exact plan, constructs one adapter and awaits one runner call. It rechecks the start window and non-secret mode/project after imports and adapter construction. Errors are sanitized by the CLI; capture errors retain the packet and never trigger a retry. A second run attempt in the same process fails. Across processes, the existing exclusive output directory prevents another capture after packet creation; a pre-output failure has no durable attempt marker, so operators must obey the no-retry approval rather than treat a new process as permission.

## Actual check-only invocation verified

From `/Users/tim/Code/fhfhockey.com/web`, this exact empty-environment command was run successfully. It is an offline check, not a live invocation:

```sh
/usr/bin/env -i PATH=/usr/local/bin:/usr/bin:/bin NODE_PATH=. DISABLE_V8_COMPILE_CACHE=1 TS_NODE_COMPILER_OPTIONS='{"module":"commonjs","moduleResolution":"node"}' /usr/local/bin/node --require ./node_modules/ts-node/register/transpile-only scripts/blsh/nativeProcessCaptureBootstrap.ts --check
```

[Observed result](BOOTSTRAP-OFFLINE-CHECK.json): exact bootstrap hash, nine source pins, Node v22.23.4, project unset, disabled default, no credential inspection/network/output. That empty environment is deliberately **not** a configured capture process and does not establish the live runtime's mode or credential availability.

The eventual reviewed live invocation has the same cwd, Node binary and `--require ./node_modules/ts-node/register/transpile-only` arguments, using `scripts/blsh/nativeProcessCaptureBootstrap.ts --run /absolute/private/authorization.json`. The operator supplies an already configured environment consistent with the verified loader profile; the bootstrap does not source files or populate credentials/flags. No live invocation was executed. Do not copy the empty-environment check as a configured run, and do not load secrets to satisfy this handoff.

## Authorization receipt shape — documentation only

This deliberately invalid example is not an authorization file. Placeholder values and `approvedBy: PENDING` fail validation. After specific user approval, the operator records genuine references and exact timestamp/hash rather than using fixture strings.

```json
{
  "version": "fhfh.blsh.native-pilot-authorization.v1",
  "approvedBy": "PENDING",
  "approvedAtUTC": "<actual approval ISO UTC timestamp>",
  "approvalReference": "<specific user approval reference>",
  "operator": "<confirmed operator ID>",
  "bootstrapSHA256": "d4d2fcac52ffd272307b97bcbe79a008d888f7ee05f96526888cdcea2a34c97f",
  "slotStartUTC": "2026-11-13T14:05:00.000Z",
  "outputDirectory": "/Users/tim/Library/Application Support/fhfh-blsh-native-20261113T140500Z",
  "supabaseOrigin": "https://fyhftlxokyjtpndbkfse.supabase.co",
  "lifecycleMode": "disabled",
  "maximumHTTPAttempts": 5,
  "coordinationReceipt": "<current coordinator clearance ID>",
  "runtimeReceipt": "<actual configured-process receipt ID>",
  "admissionReceipt": "<current custodian contract/control receipt ID>"
}
```

Reference fields accept 1–200 characters from letters, digits, `.`, `_`, `:`, `-`; no raw credentials, headers, SQL results or unrestricted upstream strings belong in this file. Keep the receipt private, at most 16 KiB. It is a local guard recording external facts, not a signature verifier or an automatic approval service.

## Review and verification

The initial 28 offline tests passed. Independent review found that CommonJS could prefer an unpinned sibling `.js` while only `.ts` was hashed. Four added regression cases (runner, adapter, preparation, transitive client) all failed before correction, resolving a mocked successful run instead of rejecting. The correction binds Node's actual extensionless resolution to each of the nine pinned `.ts` files before import.

The first corrected suite failed 14 tests because Vitest lacks ts-node's `.ts` resolution hook. The harness now preserves real Node resolution first and models only the configured hook's `.ts` fallback. Final **32 tests pass** with synthetic approval, mocked adapter/runner and blocked transports. The real CLI check separately verifies actual ts-node resolution. No real adapter factory or runner was called during these checks. The actual CLI also rejected `--invalid` with the expected fixed message and exit 1 in the empty environment ([refusal log](BOOTSTRAP-CLI-REFUSAL.log)); it failed before prerequisite or runtime-module loading. See the [independent review](BOOTSTRAP-INDEPENDENT-REVIEW.md) and check receipt for final closure and limitations.

The prior 204 distinct capture/sKO/UI tests remain earlier evidence at unchanged pins; they were not rerun or relabeled as new bootstrap execution. No further full application suite, build, provider TLS probe or production read is warranted by this local entry point.

## Remaining gates

Bootstrap implementation is ready for local integration once its final review/check receipt is accepted. The [five-call authorization draft](PILOT-AUTHORIZATION.md) still needs operator assignment and slot clearance, actual configured-process/mode evidence, current admission/control confirmation, acceptance of the private path and specific user approval. Scout delivered the exact [custodian handoff](CUSTODIAN-HANDOFF.md) once to `CODEX-TO-CLAUDE.md` under `CODEX-BLSH-CUSTODIAN-COORDINATION-20261112`; file delivery and quoted-text parity are verified. Custodian acknowledgment, slot clearance and pilot approval remain pending. The latest previously inspected incoming Claude mailbox ends with the November 12 DB incident, while current room history reports ongoing normalization/I/O-or-lock wait. No current safe execution window has been established.
