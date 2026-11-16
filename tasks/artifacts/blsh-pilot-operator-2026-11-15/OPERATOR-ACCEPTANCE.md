# BLSH native-input pilot: operator acceptance

Prepared 2026-11-15 ~02:10Z by session `local_017907a3`, the Claude NST operator lane, started by BLSH Chef `local_56526db8`. No live action was taken.

## Decision: **accepted, with conditions**

I accept the operator role for **one** BLSH native-input pilot. The pilot is one invocation of the successor `web/scripts/blsh/nativeProcessCaptureBootstrap.ts --run <receipt>` from `/Users/tim/Code/fhfhockey.com/web`, with these proposed values:

| Item | Proposed value |
| --- | --- |
| Source date | 2026-11-11 |
| Start window | 2026-11-17 14:05:00–14:06:00 UTC (09:05 EST) |
| Output | `/Users/tim/Library/Application Support/fhfh-blsh-native-20261117T140500Z` |
| HTTP attempts | at most five |

**This acceptance does not reserve the slot or authorize a run.** The run needs TJ's specific approval of the exact successor hashes, slot, output, launcher and five-call budget. Until then, the operator does nothing live.

The operator never verifies their own run. Claude Chef `local_56526db8` (or Scout) verifies the packet offline with `verify-packet.mjs`.

**Status at 2026-11-15 ~02:25Z:** the presence-only probe of `web/.env.local` passed (TJ-approved): both keys present, project pinned, lifecycle absent, so disabled. Credentials are therefore available to a Claude operator through the launcher design. This is not yet a receipt for the successor candidate.

## What the operator will do

1. **T−1 day.** Re-run the credential-free checks on the **successor** bootstrap hash (RUNTIME-RECEIPT-PLAN §2). The `--check` that passed on 11-15 was for the expired bootstrap `d4d2fcac…`.
2. **T−1 day.** If TJ approves the exact command by pop-up, run the presence-only probe and gather the pre-approval evidence (RUNTIME-RECEIPT-PLAN §3–4). Write `PREAPPROVAL-RUNTIME-EVIDENCE.json`. This is evidence for the approval only. The authoritative runtime/TLS receipt is the runner's in-process `RUNTIME.json` (§4a).
3. **After TJ's specific approval.** Create the private authorization JSON (0600) at the approved path, with the receipt IDs from RUNTIME-RECEIPT-PLAN §6.
4. **T−20 to T−5 min.** Re-check the slot (SLOT-CLEARANCE §5). At about 14:03Z, run the G3 dependency-tree check with `--loaded` (RUNTIME-RECEIPT-PLAN §3b), saving its stdout verbatim for the attestation (§3c). It must print `match` with `loaded.uncovered: []`.
5. **At the slot.** Make one start through the approved launcher, then take no further action.
6. **Immediately after the capture exits (T+0).** Rerun the **same** G3 `--loaded` command and save its stdout verbatim (RUNTIME-RECEIPT-PLAN §3c). It is offline and credential-free and takes about a second.
7. **Afterwards.** Write the operator attestation (RUNTIME-RECEIPT-PLAN §3c): both G3 stdouts with their UTC timestamps and exit codes, plus `dyldKeysPresent: false`. Record the exit status and hand the untouched directory and the attestation to the verifier. **No conversion unless both T−0 and T+0 print `match` with `loaded.uncovered: []`.** A T+0 refusal means the packet is quarantined and reported, never retried. Make no follow-up remote call.

## How an agent session hits a 60-second window (**TJ approved the design 2026-11-15, relayed by Chef**)

An agent session cannot wake itself unless it uses a scheduler. ScheduleWakeup, cron and loops are excluded by the 11-12 execution plan ("no scheduler, retry loop"). Proposal:
- **Wake-up:** TJ (or the parent Chef) sends this session one message at about **13:45Z on 11-17**. Without that message, the run does not happen and the slot lapses. That counts as a stop, not a failure.
- **One start:** at about 14:04:00Z, the operator first checks the shell with the builtin `export -p | grep -c -E 'DYLD_|DEVELOPER_DIR'`, which must print 0. It then issues **one** launcher command, prefixed with `/usr/bin/env -i PATH=/usr/bin:/bin` so that `DEVELOPER_DIR` cannot redirect the `/usr/bin/python3` shim (RECHECK-8): `/usr/bin/env -i PATH=/usr/bin:/bin /usr/bin/python3 -I …/tools/nst-pilot-launcher.py --run <receipt> > …/attestation/launcher.log 2>&1`, `tools/nst-pilot-launcher.py` (sha256 `31c370c3…`; exact command and gates in RUNTIME-RECEIPT-PLAN §1a). The launcher refuses unless the time is between 14:03:00 and 14:05:00Z. It sleeps until 14:05:05Z (at most 125 s), runs the pinned G3 check again, re-reads the clock, then makes exactly one `execve` of node.
  - If the clock is outside 14:05:00–14:05:50Z at exec time, it exits without starting node.
  - The bootstrap's own `bootstrap_outside_approved_slot` check stays the final gate.
  - This wait-then-exec is a change to the 11-12 plan and must be named in TJ's approval.
- **Background run:** the command runs in the background so the harness's 2-minute foreground limit cannot cut it. There is no retry: a nonzero exit is final.

## Conditions under which I refuse to start (any one → no start, stop, report)

**Approval and candidate**
1. There is no TJ approval naming the exact successor bootstrap, runner and adapter hashes, slot, output path, launcher hash and five-call ceiling. Approval inferred from another lane, a mailbox entry or a note does not count.
2. Successor hashes are missing, or any of the 9 runtime pins, the Node SHA, the tsconfig or the dependency hashes differ from the approved values (`--check` fails).
3. The bootstrap still hard-codes a slot or output other than the approved one.
4. The output directory already exists, its parent is not 0700, or it is not user-owned.

**Configured process**

5. The T−1 probe v2 (RUNTIME-RECEIPT-PLAN §3a) was not approved by TJ's pop-up, was not run on the **successor** bootstrap, or reports `pass: false`. That covers any of these:
   - a missing or empty `NST_KEY` or `SUPABASE_SERVICE_ROLE_KEY`;
   - a project other than `pinned`;
   - `NST_JOB_LIFECYCLE_ENABLED` **present in the env file with any value**: it must be `absent_disabled`, because `checkRuntime` needs `adapterEnvironmentPresence.NST_JOB_LIFECYCLE_ENABLED === false`;
   - duplicate capture-path keys;
   - `--check` failing;
   - the bridge's `checkRuntime` vetoing the predicted `RUNTIME.json`. Examples: `runtime_override_env_present`, `runtime_default_ca_store_not_bundled`, `runtime_node_binary_not_pinned`, `runtime_override_exec_argv`, `runtime_receipt_incoherent`, `runtime_adapter_environment_shape`, `runtime_adapter_environment_absent`, `runtime_launch_override_present`, `runtime_launch_unlisted_ts_node_keys`, `runtime_bootstrap_not_candidate`, `runtime_lifecycle_key_present`, `runtime_global_dispatcher_invalid`;
   - the v5 dispatcher prediction failing: a dispatcher registered before the imports, or not exactly `{present: true, constructorName: "Agent", sameAsRunnerLoad: true}` after loading the pinned `cheerio`.
6. The child env would contain anything beyond the allowlist. That includes any of the 15 `RUNTIME.json.environmentPresence` keys:
   - `NODE_EXTRA_CA_CERTS`, `NODE_TLS_REJECT_UNAUTHORIZED`, `NODE_OPTIONS`, `NODE_USE_SYSTEM_CA`, `NODE_USE_ENV_PROXY`;
   - `SSL_CERT_FILE`, `SSL_CERT_DIR`;
   - `HTTPS_PROXY`, `HTTP_PROXY`, `ALL_PROXY`, `NO_PROXY` and their lower-case forms;
   - plus `OPENSSL_CONF`.

   This operator's own shell **does** carry `NODE_USE_SYSTEM_CA`, so inheriting it is never allowed; see RUNTIME-RECEIPT-PLAN §1.
6a. **Any `DYLD_*` key** (prefix match) is present in the launcher's own environment or in the env file (RECHECK-6 R3). dyld honours these for `/usr/local/bin/node`, so `DYLD_INSERT_LIBRARIES` would load native code that neither `require.cache` nor G3 can see. The attestation records `dyldKeysPresent: false`. TJ decided on 2026-11-15 (via Chef) that this launcher refusal plus the attestation closes R3 for the Nov 17 pilot on v5. The bootstrap-side refusal is queued for the next candidate.
7. `TMPDIR` in the child is not the real user temp dir (`getconf DARWIN_USER_TEMP_DIR`), so the local NST ledger would be a substitute. The same applies if the real ledger directory `…/T/fhfhockey-nst-budget-501` is missing.
8a. **G3 dependency tree:** the T−1 probe or the T−0 check reports anything other than `match` (and, for conversion, the T+0 rerun too; see step 7) against the **v5** `evidence/DEPENDENCY-TREE-BASELINE.json` (sha256 `4534fd65…1bb3`, tree `76c7d466…473a`, 42 packages / 1,634 files, including npm `undici` 7.29.0, the live transport). The v4 baseline in `superseded/` is never used. It also covers **any loaded file outside coverage**: `--loaded` lists every `require.cache` file of a launcher-identical load of the capture modules, and anything that is not a pinned role, the candidate bootstrap or a file in a G3 package directory refuses (`loaded_file_uncovered:<path>`). The v5 result: 256 loaded, 0 uncovered. That includes a changed, added or removed package, a bootstrap dependency or role pin mismatch, a bootstrap differing from the v4 baseline, an unresolved dependency or a symlink outside the tree. Since RECHECK-6 R0 it also covers `node_modules/typescript` differing from the pin held in the tool (`typescript_package_hash_mismatch`, checked before any tree code runs) and `dyld_env_present`. Never re-baseline to make a check pass. A legitimate tree change needs a new baseline reviewed by the parent and re-approved by TJ.
8. This tool process cannot be shown to have network egress to the three hosts, or write access to the output parent, under the harness's sandbox at slot time. In that case, stop rather than run in a degraded sandbox.

**Production activity**

9. The T-minus recheck (SLOT-CLEARANCE §5) finds any of these:
   - unknown or active production activity;
   - a new mailbox entry claiming production, NST or DB time on 11-17 that is not resolved;
   - a running Codex H1, Astra live-audit, FORGE capture-pilot or `/db/runner` NST job;
   - an incident or stop notice.
10. Admission/control evidence is still unknown, and TJ has not explicitly accepted that unknown (ADMISSION-CONTROL §4).

**Timing**

11. **Timing of the start.** These are three different times:
    - **Wake-up message:** TJ's or Chef's message reaches this session no later than **14:04:30Z**. Later than that, the operator cannot reliably issue the command before the start window closes, so there is no start.
    - **Start window:** the launcher command must be issued inside **14:03:00–14:05:00Z**, else the launcher refuses `outside_start_window`.
    - **Exec window:** the launcher itself execs node only inside **14:05:00–14:05:50Z**, after its sleep and G3, else it refuses `outside_exec_window`.

    Any miss is a stop, not a retry.
12. Any earlier BLSH `--run` attempt exists for this candidate, including a partial or uncertain one.

## What I will not do

- No second attempt, no re-date, and no alternate output.
- No `--env-file`, no sourcing of env files into a shell, no secrets in argv, and no printed values.
- No flag change, ledger clear, burst, status poll, readback or cleanup RPC.
- No push, deploy or git mutation.
