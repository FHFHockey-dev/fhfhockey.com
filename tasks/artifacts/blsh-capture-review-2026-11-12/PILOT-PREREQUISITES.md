# BLSH pilot prerequisites — follow-up, November 12, 2026

**Preparation only. No execution authority.** **Later local closure:** [BOOTSTRAP-HANDOFF.md](BOOTSTRAP-HANDOFF.md) records the implemented, independently reviewed bootstrap and final offline checks. The bootstrap-search findings below describe the state before that implementation. The proposed slot now permits one start from 14:05 inclusive to 14:06 exclusive, with work ending before 14:08 UTC. This follow-up narrows the missing facts in [PILOT-AUTHORIZATION.md](PILOT-AUTHORIZATION.md). The corrected code remains local on `octoberBranch`, base `24b1cb4d3048a3dba8234cf92c62e8f2b72f877f`; all 17 source/test pins still match. No source, manifest, production setting or admission state was changed.

## Concrete proposed operator, slot and output

| Item | Proposal | Evidence and remaining decision |
| --- | --- | --- |
| Execution operator | Claude NST custodian `local_3bb2755d`, with Scout coordinating; current Claude Chef `local_78a99adf` confirms availability or names a replacement | [NST owner handoff](../blsh-lane-readiness-2026-11-08/NST-OWNER-HANDOFF.md) confirms custody and prior executor. The November 9 controls handback identifies the same implementer. This establishes suitability, not a current assignment, availability or authority. The old `local_c4e6c533` Chef is historical routing. |
| Start slot | **2026-11-13 14:05:00–14:06:00 UTC**, one start with work ending before 14:08:00 UTC under the 120-second work budget | A proposed reservation, not a verified safe or booked window. It is outside the saved 08:25–10:05 NST exclusion period and more than an hour after the 10:05–10:55 FORGE schedule. Require current Chef/custodian clearance for re-normalization, DB health, other manual NST work and any changed restrictions before approval. No automatic reschedule or repeat. |
| Private output | `/Users/tim/Library/Application Support/fhfh-blsh-native-20261113T140500Z` | The exact child is absent. Its resolved parent exists, is a real directory owned by the current user, mode **0700**, outside Git and ephemeral temporary storage. Its displayed ACL contains only a deny-delete entry, no extra read grant. Metadata only was inspected; no directory/file created or contents listed. Operator must accept this path and use a host/session allowed to write there. Fsync/storage behavior remains enforced by the runner before dispatch, not certified by this metadata check. |

The proposed day still satisfies the fixed November 7 date constraint. The candidate becomes stale at **2026-11-15T00:00:00Z**. If prerequisites cannot be settled for this slot, stop and revise the packet; do not silently change the date or schedule.

The saved schedule [cron-schedule.md](../../TASKS/cron-operations/cron-schedule.md) lists active NST calls at 08:30, 08:45, 09:15 and 09:55 UTC. The [November 10 Chef mailbox](../cross-platform/2026-10-24-coordination/CLAUDE-TO-CODEX.md) reports the 10:05 gamelog path too; [web/vercel.json](../../../web/vercel.json) records FORGE invocations through 10:55. These are saved/local schedules, not a live inventory or proof that no other caller runs. Preserve all jobs and shared admission. A five-call pilot must stop on its first denial, including post-burst cooldown; no polling for headroom.

The **November 12 15:51:16Z** incident entry in that mailbox reports a 15:44–15:50 DB saturation during strength-v2 re-normalization, recovery at 15:50:30 and that particular run stopped pending a slower plan and TJ approval. The current task still warns re-normalization is active. Therefore the old stop notice does **not** clear the proposed slot or authorize a health probe. Current coordination is required; no production request was used to check it.

## Bootstrap and configured process

The bounded source search across `web/scripts`, `web/lib` and `web/pages` found only the definitions of `runNativeProcessCapture` and `createNativeProcessCaptureAdapter` outside tests. At that inspection there was no invoking bootstrap or npm capture command in those surfaces; the later local bootstrap is linked above. The old preparation executor still throws. This is a missing local implementation artifact, not an unresolved runtime failure.

The operator should supply or commission **one reviewed, one-shot local bootstrap** before pilot approval. Its review must bind:

- cwd `/Users/tim/Code/fhfhockey.com/web`, the Node 22.23.4 binary and installed loader hashes in [RUNTIME-IDENTIFICATION.json](RUNTIME-IDENTIFICATION.json), CommonJS/Node ts-node overrides, `NODE_PATH=.` and disabled loader cache;
- exact nine source-role hashes from [CORRECTION-CHECKS.json](CORRECTION-CHECKS.json), without refreshing expected hashes from possibly changed files at execution time;
- the confirmed existing project/mode, one freshly prepared November 7 plan, the exact output path and **one awaited runner call**; no retry, extra preflight, environment mutation, automatic `.env` loading or additional provider/DB action;
- a mock-only check of the bootstrap's wiring and error exit; no real adapter factory invoked merely to check configuration, because that factory immediately reads credentials;
- a hash of the exact bootstrap and a reviewed invocation added to the final authorization.

No bootstrap was created during that inspection-only stage. The later two-file bootstrap implementation is the reviewed successor; none of the reproduction/import scripts is a live launcher.

The current shell was rechecked using an allowlist of **non-secret** variables only: Node `v22.23.4`, `/usr/local/bin/node`, `darwin arm64`; public Supabase project unset; lifecycle unset (disabled default); NODE_OPTIONS, custom-CA/proxy variables and TLS bypass absent. Credential presence and values were not inspected. This remains an **unconfigured shell**, not the future capture process. The adapter's existing environment check would reject the missing project before capture, and mode is checked again at operation boundaries.

The execution owner must provide the same non-secret classification from the actual intended configured process: exact pinned project, existing disabled lifecycle mode, runtime/loader resolution, normal TLS verification, no unexpected preload/proxy/custom trust changes. The owner confirms credential availability privately; no credential needs to enter a handoff. Do not set a flag or copy Vercel settings into this shell to satisfy the draft. No `.env`, keychain, credential file, process environment dump or production configuration was opened here.

## Admission evidence located and reconciled

The earlier draft-file-only assessment was incomplete. There is later saved evidence:

1. [NST writer diary](../../diaries/2026-11-07-claude-nst-writer.md), November 7 approximately 23:25/23:30 UTC: successful shared admission and lifecycle installation/readback; 17 function bodies matched, budget MD5 prefix `b1821941`, both controls false, service-role-only execution. This is historical owner-reported evidence, not a readback performed by BLSH.
2. [Chef diary](../../diaries/2026-11-07-claude-orchestrator-inventory-release.md), November 9 approximately 15:40 UTC: explicitly reports migration `20261109015836` **applied**, budget MD5 prefix **`5e854308`**.
3. [Chef mailbox](../cross-platform/2026-10-24-coordination/CLAUDE-TO-CODEX.md), `CLAUDE-CHEF-FORGE-NST-PERSISTENCE-20261110-14`: a separately dated follow-up says the post-burst migration went live November 9 approximately 14:45 UTC and reports successful subsequent NST cron runs.
4. Local [post-burst SQL](../../../supabase/migrations/20261109015836_nst_admission_post_burst_gap.sql) SHA-256 is `52c611205361d41a97c9cf06bee7ff7ee15488d7a72456bc3ad1948c7cd6f4aa`. MD5 of its dollar-quoted `nst_admit_attempt_budget_v1` body is **`5e8543085513e308b92ce55b0090557b`**, matching the saved reported prefix. Its `DRAFT, NOT APPLIED` header is stale relative to those reports; no header, SQL or migration-authority edit was made.

Thus the best saved contract is the **post-burst** budget: 39/minute, 80/5 minutes, 100/15 minutes, 180/hour, normal 22-second spacing and 60-second cooldown after burst activity. This pilot requests no burst. The legacy wrapper still records `last_untracked_at` and calls that budget; a budget denial may therefore still write the legacy timestamp. This is already included in the draft's two-production-transaction ceiling.

Remaining evidence is narrower: the custodian must confirm no later contract/control change or provide an already-retained exact deployed-body/ACL/control receipt. A matching eight-character MD5 prefix and historical reports are not a new full-hash readback, present enforcement-state proof or current runtime-mode proof. If existing evidence is insufficient, a separately authorized bounded readback must precede the pilot approval; it is not included in the five calls. No SQL was executed and migration authority was not consulted or changed.

## Exact decisions for the coordinating Chef

1. Confirm `local_3bb2755d` as execution operator, or name its current replacement; obtain current clearance for the proposed **November 13 14:05–14:06 UTC** start window from the production/re-normalization coordinator. Historical availability and the incident's stop notice are insufficient.
2. Accept the implemented [bootstrap handoff](BOOTSTRAP-HANDOFF.md) and bind its exact path, invocation and SHA-256 to final approval. Local implementation and independent review are complete; no capture approval is implied.
3. Obtain an allowlisted non-secret receipt from the actual configured process, preserving its existing mode, plus custodian confirmation of the post-burst admission contract and control state. The present inspection shell cannot supply those facts.
4. Accept the proposed private output path, or provide an exact alternate with equivalent privacy/durability. No output creation is authorized by this draft.
5. Only after these are concrete, present the five-attempt authorization to TJ. Any enabled-mode runtime, changed date/pin/project or extra remote check needs a revised explicit scope.

Suggested owner handoff text (prepared, **not sent**):

> BLSH's corrected runner is independently reviewed and mocked/offline verified. Please confirm whether Claude NST `local_3bb2755d` can operate one separately approved five-call pilot at 2026-11-13 14:05 UTC, coordinated with re-normalization and current NST restrictions. Supply the intended one-shot bootstrap path/invocation/hash and non-secret project, existing lifecycle mode and runtime/TLS profile; no credential values. Proposed private output is `/Users/tim/Library/Application Support/fhfh-blsh-native-20261113T140500Z`, currently absent under a user-owned 0700 parent. Reconcile the saved post-burst install report (`5e854308` on November 9; local body `5e8543085513e308b92ce55b0090557b`) with any later changes and retained control/ACL evidence. Request any missing bootstrap, receipt or configuration excerpt before advising execution. Do not run capture, fetch providers, query/change production or alter flags for this request. Return availability, exact facts and unresolved decisions so Scout can prepare TJ's final approval packet.

All checks here were static/local metadata or saved-artifact reads. No live request, credentials, ledger/database operation, bootstrap execution, pilot, deployment or schedule change occurred.
