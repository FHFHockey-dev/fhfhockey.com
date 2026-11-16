# BLSH Nov 17 pilot: day-of runbook

Prepared 2026-11-15 by the operator session `local_017907a3`, for Chef `local_56526db8` and TJ. Offline: nothing here has been run live. A scripted, scratch-only rehearsal of this whole sequence is `tools/dress-rehearsal.sh` (§6).

This file gives **order, commands, expected output and stop rules**. The reasons and full rules live in:
- `RUNTIME-RECEIPT-PLAN.md`: §1a launcher, §3a probe v2, §3b G3, §3c attestation, §4 pre-approval evidence, §6 receipt IDs.
- `OPERATOR-ACCEPTANCE.md`: steps 1–7, "One start", stop conditions 1–12.
- `SLOT-CLEARANCE.md` §5 (activity recheck) and `ADMISSION-CONTROL.md` §4–5.

**Who acts:**
- **TJ:** approvals.
- **Chef** (`local_56526db8`): relaying TJ's wake-up message, owner confirmations, receiving the handoff and conversion.
- **Operator** (this session): every command below.

**Every stop rule means: stop, run nothing further, report to Chef.** There is never a retry, a re-date or a second start (OPERATOR-ACCEPTANCE "What I will not do").

**Command conventions:**
- Each command is self-contained, because the operator's shell keeps no variables between commands.
- Paths are absolute. `O` is `/Users/tim/Code/fhfhockey.com/tasks/artifacts/blsh-pilot-operator-2026-11-15`.

**Rule: no rehearsal or test suite on a slot date (RECHECK-11 B1).** On 2026-11-17 and 2026-11-18 UTC, the only launcher invocation is the §3 start line.
- Never run `tools/dress-rehearsal.sh`, `tools/test-nst-pilot-launcher.py` (either variant) or any reviewer repro script that loads a launcher on those days. Inside its window, any of them could take the real lock or read the real `.env.local`, and so consume the pilot.
- Both tools enforce this themselves: their first statement refuses on those UTC dates (exit 3).
- On every other day their real-script cases run a scratch copy of the launcher whose only two changed lines are `ENV_FILE` and `LOCK_PATH`. They never use the real lock or env file.

## 0. Before T−1: approvals that must exist (TJ)

| # | Approval | Status 2026-11-15 |
|---|---|---|
| A0 | Admission recheck SQL run once (ADMISSION-CONTROL §4), **or** "admission state unknown, accepted by TJ" | pending |
| A1 | T−1 probe v2 pop-up for the exact command in step T−1.2 | pending (at T−1) |
| A2 | Final run approval naming: bootstrap `dbf69c47…`, runner `a74cbb0a…`, adapter `aa6237bd…`, launcher `31c370c3…`, G3 `912041a5…` with baseline `4534fd65…`, receipt writer and attestation tool hashes (§7), slot 2026-11-17 14:05:00Z, output `…/fhfh-blsh-native-20261117T140500Z`, five HTTP attempts, wait-then-exec, the receipt path (§5) and an `approvalReference` ID | pending |

## 1. T−1: 2026-11-16 (operator, after the approvals named)

**T−1.1 Admission recheck (only with A0's run approval).** Run the ADMISSION-CONTROL §4 SQL once, read-only, through the Supabase MCP `execute_sql`. Save the returned rows verbatim to `$O/evidence/ADMISSION-RECHECK-20261116.json`.
- **Expect:** three function rows, the budget body MD5 `5e8543085513e308b92ce55b0090557b`, ACL `{postgres=X/postgres,service_role=X/postgres}`, and `enforced = false`.
- **admissionReceipt:** `blsh-admission-20261116.` plus the first 12 hex characters of `shasum -a 256 $O/evidence/ADMISSION-RECHECK-20261116.json`. If TJ accepted the unknown instead, it is `blsh-admission-historical-5e854308.unverified`.
- **Stop:** any ADMISSION-CONTROL §4 stop rule.

**T−1.2 Probe v2 (only with A1's pop-up, which names this exact command).**

```bash
cd /Users/tim/Code/fhfhockey.com/web && /usr/bin/env -i PATH=/usr/bin:/bin /usr/bin/python3 -I /Users/tim/Code/fhfhockey.com/tasks/artifacts/blsh-pilot-operator-2026-11-15/tools/env-presence-probe-v2.py .env.local /Users/tim/Code/fhfhockey.com/web/scripts/blsh/nativeProcessCaptureBootstrap.ts v5-1117 > /Users/tim/Code/fhfhockey.com/tasks/artifacts/blsh-pilot-operator-2026-11-15/evidence/PREAPPROVAL-RUNTIME-EVIDENCE.json; echo "exit=$?"
```

- **Expect:** `exit=0`, and a single JSON line with `"pass": true` and `"candidate": "v5-1117"`. That line includes `dependencyTreeCheck.dependencyTree: "match"`, `predictedRuntimeCheck.checkRuntime: "pass"`, `dyldKeysPresent: false` and `valueShapeSuspectKeys: []`. The probe prints enums and booleans only.
- **Stop:** `pass: false` (OPERATOR-ACCEPTANCE condition 5).

**T−1.2b Runtime snapshot (credential-free; RUNTIME-RECEIPT-PLAN §4 items 4 and 7).** It runs in the launcher's env shape without the two secret keys, with the capture's exact `execArgv`:

```bash
cd /Users/tim/Code/fhfhockey.com/web && /usr/bin/env -i PATH=/usr/bin:/bin TMPDIR="$(mktemp -d)/" NODE_PATH=. DISABLE_V8_COMPILE_CACHE=1 TS_NODE_COMPILER_OPTIONS='{"module":"commonjs","moduleResolution":"node"}' NEXT_PUBLIC_SUPABASE_URL=https://fyhftlxokyjtpndbkfse.supabase.co /usr/local/bin/node --require ./node_modules/ts-node/register/transpile-only /Users/tim/Code/fhfhockey.com/tasks/artifacts/blsh-pilot-operator-2026-11-15/tools/preapproval-runtime-snapshot.cjs > /Users/tim/Code/fhfhockey.com/tasks/artifacts/blsh-pilot-operator-2026-11-15/evidence/PREAPPROVAL-RUNTIME-SNAPSHOT.json; echo "exit=$?"
```

- **Expect:** `exit=0`, and a JSON object with:
  - `noOverrides: true` and the explicit no-override `statement`;
  - OpenSSL `3.5.9`, Node-bundled undici `6.29.1` and npm undici `7.29.0` (resolved from cheerio);
  - TLS `TLSv1.2`–`TLSv1.3`;
  - CA counts `{default: 116, bundled: 116, system: 0, extra: 0}`, as of 2026-11-15.
- **Stop:** `noOverrides: false`, or exit nonzero.
- **runtimeReceipt:** `blsh-preapproval-runtime-20261116.<sha12 of PREAPPROVAL-RUNTIME-EVIDENCE.json>.<sha12 of PREAPPROVAL-RUNTIME-SNAPSHOT.json>`, where each sha12 is the first 12 hex characters of `shasum -a 256`. It matches `^[A-Za-z0-9._:-]{1,200}$`.

**T−1.3 Interpreter check.**

```bash
/usr/bin/env -i PATH=/usr/bin:/bin /usr/bin/python3 -I -c 'import sys; print(sys.executable)'
```

- **Expect:** `/Library/Developer/CommandLineTools/usr/bin/python3`.
- **Stop:** anything else. The launcher would refuse `unexpected_interpreter` at the slot.

**T−1.4 `.env.local` re-stat (metadata only, no read).**

```bash
stat -f '%HT|%Lp|%u|%l' /Users/tim/Code/fhfhockey.com/web/.env.local
```

- **Expect:** `Regular File|600|501|1`.
- **Stop:** anything else. The launcher would refuse `env_file_not_private_regular_file`. TJ decides whether to fix the file; the operator never changes it.

**T−1.5 Egress, connect-only (TJ decided 2026-11-15; run as part of approval A1, with the probe pop-up; OPERATOR-ACCEPTANCE condition 8).**

```bash
/usr/bin/env -i PATH=/usr/bin:/bin /usr/local/bin/node /Users/tim/Code/fhfhockey.com/tasks/artifacts/blsh-pilot-operator-2026-11-15/tools/egress-connect-check.mjs --run; echo "exit=$?"
```

- **What it does:** for `api-web.nhle.com`, `fyhftlxokyjtpndbkfse.supabase.co` and `data.naturalstattrick.com` in turn, it makes one TCP connect and one TLS handshake on port 443, with full verification against Node's bundled CA store (the capture's trust store; certificate chain and hostname). It then closes at once.
  - No HTTP bytes and no application data are ever sent, so there is no NST URL request and nothing against the NST budget.
  - The timeout is 5 s, with one attempt per host.
  - It refuses before any DNS lookup if a CA, TLS, proxy or preload override is present.
- **Expect:** three lines, `{"host": …, "result": "ok"}` for each host, then `exit=0`.
- **Stop:** any `fail` or any refusal. A blocked write under `~/Library/Application Support/` would first show at the 13:58Z receipt step, which is safe because it is before any live call.
- **Offline tests** (loopback only): `tools/test-egress-connect-check.mjs`, 13/13 PASS.

## 2. T−0 morning: 2026-11-17, 13:45–14:03Z

**13:45Z: wake-up (TJ → Chef → operator).** TJ messages Chef at about 13:45Z on 11-17, and Chef relays it as one message to this session. If none has arrived by **14:04:30Z**, the slot lapses (OPERATOR-ACCEPTANCE stop condition 11).

**13:45–13:58Z: activity recheck (operator), SLOT-CLEARANCE §5.**
1. **Mailboxes:** re-read both from the last-seen headings.
2. **Sessions:** `list_sessions`.
3. **Cron files**, read-only git:

   ```bash
   cd /Users/tim/Code/fhfhockey.com && git log --since=2026-11-15T00:00:00Z --oneline -- web/vercel.json tasks/TASKS/cron-operations/cron-schedule.md; git diff --stat -- web/vercel.json tasks/TASKS/cron-operations/cron-schedule.md; echo "end"
   ```

   **Expect:** only `end`.
4. **Owner confirmations:** check they are recorded by Chef.

Write the results as `$O/evidence/TMINUS-RECORD-20261117.md`. **coordinationReceipt:** `blsh-slot-20261117T1405Z.tminus.` plus the first 12 hex characters of its sha256.

**Stop:** any SLOT-CLEARANCE §5 stop item (OPERATOR-ACCEPTANCE condition 9).

**13:58Z: receipt (operator).** Create it with the receipt writer, using A2's approval time and reference and the three receipt IDs above. Fill in the four `<…>` values; nothing else changes.

```bash
/usr/bin/env -i PATH=/usr/bin:/bin /usr/bin/python3 -I /Users/tim/Code/fhfhockey.com/tasks/artifacts/blsh-pilot-operator-2026-11-15/tools/write-authorization-receipt.py --out "/Users/tim/Library/Application Support/fhfh-blsh-authorization-20261117T140500Z.json" --candidate v5-1117 --approved-at <A2 time, e.g. 2026-11-16T18:00:00.000Z> --approval-reference <A2 reference> --runtime-receipt <T−1.2 ID> --coordination-receipt <13:58 ID> --admission-receipt <T−1.1 ID>
```

- **Expect:** `{"receipt": "written", "mode": "0o600", "bootstrapSHA256": "dbf69c47…", …}`.
- **Stop:** any `{"receipt": "refuse", …}`. The writer mirrors the bootstrap's `readAuthorization` contract (14 fields, fixed scope, ID regex, 0600, ≤16 KiB). It refuses a non-candidate bootstrap and an existing receipt.

**~14:02:00Z: G3 at T−0 (operator).** OPERATOR-ACCEPTANCE step 4 and plan §3b/§3c say "about 14:03Z"; this runbook's 14:02:00Z governs, so that every T−0 check is done before the 14:03:30Z start. This must be the first process that touches the tree today (RECHECK-7). It also creates `$O/attestation/`, which the launcher's lock needs. This is the RUNTIME-RECEIPT-PLAN §3c command with `P=T-0`:

```bash
A=/Users/tim/Code/fhfhockey.com/tasks/artifacts/blsh-pilot-operator-2026-11-15/attestation; P=T-0; mkdir -p "$A"
shasum -a 256 /Users/tim/Code/fhfhockey.com/tasks/artifacts/blsh-pilot-operator-2026-11-15/tools/dependency-tree-hash.mjs /Users/tim/Code/fhfhockey.com/tasks/artifacts/blsh-pilot-operator-2026-11-15/evidence/DEPENDENCY-TREE-BASELINE.json > "$A/g3-$P.inputs-sha256"
cd /Users/tim/Code/fhfhockey.com/web && date -u +%Y-%m-%dT%H:%M:%SZ > "$A/g3-$P.shell-start-utc" && env -i PATH=/usr/bin:/bin TMPDIR="$(mktemp -d)/" /usr/local/bin/node /Users/tim/Code/fhfhockey.com/tasks/artifacts/blsh-pilot-operator-2026-11-15/tools/dependency-tree-hash.mjs --baseline /Users/tim/Code/fhfhockey.com/tasks/artifacts/blsh-pilot-operator-2026-11-15/evidence/DEPENDENCY-TREE-BASELINE.json --loaded > "$A/g3-$P.stdout"; echo $? > "$A/g3-$P.exit"; date -u +%Y-%m-%dT%H:%M:%SZ > "$A/g3-$P.shell-end-utc"; cat "$A/g3-$P.exit" "$A/g3-$P.stdout"
```

- **Expect:** `0`, then one line with `"dependencyTree":"match"`, tree `76c7d466…`, `"loaded":{"files":256,…,"uncovered":[]}` and `"differences":[]`.
- **Stop:** anything else (OPERATOR-ACCEPTANCE condition 8a). Never re-baseline.

**~14:02:30Z: shell and output checks (operator).**

```bash
A=/Users/tim/Code/fhfhockey.com/tasks/artifacts/blsh-pilot-operator-2026-11-15/attestation; export -p | grep -c -E 'DYLD_|DEVELOPER_DIR' > "$A/shell-dyld-devdir.count"; cat "$A/shell-dyld-devdir.count"; ls -d "/Users/tim/Library/Application Support/fhfh-blsh-native-20261117T140500Z" "/Users/tim/Library/Application Support/fhfh-blsh-native-20261118T140500Z" 2>&1; stat -f '%Lp|%u' "/Users/tim/Library/Application Support"
```

- **Expect:** `0`, then two "No such file or directory" lines, then `700|501`.
- **Stop:** a nonzero count (RUNTIME-RECEIPT-PLAN §1a), an existing output directory or a different parent mode (conditions 4 and 12).

## 3. ~14:03:30–14:04:00Z: the one start (operator)

One command, run **in the background**, only after every step above passed. This is the §1a start line, wrapped so the exit code and end time land in the attestation folder:

```bash
A=/Users/tim/Code/fhfhockey.com/tasks/artifacts/blsh-pilot-operator-2026-11-15/attestation; ( /usr/bin/env -i PATH=/usr/bin:/bin /usr/bin/python3 -I /Users/tim/Code/fhfhockey.com/tasks/artifacts/blsh-pilot-operator-2026-11-15/tools/nst-pilot-launcher.py --run "/Users/tim/Library/Application Support/fhfh-blsh-authorization-20261117T140500Z.json" > "$A/launcher.log" 2>&1; echo $? > "$A/capture.exit"; date -u +%Y-%m-%dT%H:%M:%SZ > "$A/capture.ended-utc" )
```

- **Expect in `launcher.log`:**
  - at about 14:05:05Z, a `{"launcher": "g3", "exitCode": 0, …match…}` line;
  - then `{"launcher": "exec", "atUTC": "2026-11-17T14:05:0…Z", "launcherSHA256": "31c370c3…", "envKeys": [8 names], "dyldKeysPresent": false, "pythonIsolated": true, …}`;
  - then the capture's own output.
- **The launcher's own gates** (§1a) are the stop rules here. A `{"launcher": "refuse", …}` line is final, with no second start. The lock makes a second launcher refuse anyway.
- **While it runs:** wait for the background completion notice and touch nothing. The capture ends by about 14:06–14:07Z.

## 4. T+0: right after the capture exits (operator)

**G3 rerun.** The same command as at T−0 with `P=T+0`:

```bash
A=/Users/tim/Code/fhfhockey.com/tasks/artifacts/blsh-pilot-operator-2026-11-15/attestation; P=T+0
shasum -a 256 /Users/tim/Code/fhfhockey.com/tasks/artifacts/blsh-pilot-operator-2026-11-15/tools/dependency-tree-hash.mjs /Users/tim/Code/fhfhockey.com/tasks/artifacts/blsh-pilot-operator-2026-11-15/evidence/DEPENDENCY-TREE-BASELINE.json > "$A/g3-$P.inputs-sha256"
cd /Users/tim/Code/fhfhockey.com/web && date -u +%Y-%m-%dT%H:%M:%SZ > "$A/g3-$P.shell-start-utc" && env -i PATH=/usr/bin:/bin TMPDIR="$(mktemp -d)/" /usr/local/bin/node /Users/tim/Code/fhfhockey.com/tasks/artifacts/blsh-pilot-operator-2026-11-15/tools/dependency-tree-hash.mjs --baseline /Users/tim/Code/fhfhockey.com/tasks/artifacts/blsh-pilot-operator-2026-11-15/evidence/DEPENDENCY-TREE-BASELINE.json --loaded > "$A/g3-$P.stdout"; echo $? > "$A/g3-$P.exit"; date -u +%Y-%m-%dT%H:%M:%SZ > "$A/g3-$P.shell-end-utc"; cat "$A/g3-$P.exit" "$A/g3-$P.stdout"
```

- **Expect:** the same as at T−0.
- **If it refuses:** the packet is **quarantined**. Still write the attestation, but report it as a refusal (§3c).

**Attestation and the conversion rule.**

```bash
/usr/bin/env -i PATH=/usr/bin:/bin /usr/bin/python3 -I /Users/tim/Code/fhfhockey.com/tasks/artifacts/blsh-pilot-operator-2026-11-15/tools/operator-attestation.py write --candidate v5-1117 --dir /Users/tim/Code/fhfhockey.com/tasks/artifacts/blsh-pilot-operator-2026-11-15/attestation
/usr/bin/env -i PATH=/usr/bin:/bin /usr/bin/python3 -I /Users/tim/Code/fhfhockey.com/tasks/artifacts/blsh-pilot-operator-2026-11-15/tools/operator-attestation.py check --candidate v5-1117 /Users/tim/Code/fhfhockey.com/tasks/artifacts/blsh-pilot-operator-2026-11-15/attestation/OPERATOR-ATTESTATION.json
```

- **Expect:** `{"attestation": "written", "bothMatch": true, "dyldKeysPresent": false, …}`, then `{"conversion": "accept", "reasons": []}`.
- **How `check` decides:**
  - It recomputes every verdict from the verbatim stdouts and log lines.
  - It binds the exec line to the real capture: `argv0` `/usr/local/bin/node`, `cwd` the canonical `web/`, and an exec time inside 2026-11-17 14:05:00–14:05:50Z.
  - It takes the candidate from its own argument and rejects a file written for another candidate.
  - It requires T−0 G3 to end at or before the exec, and T+0 G3 to start at or after the capture ended.
- **Otherwise:** `{"conversion": "reject", "reasons": […]}` means **no conversion**. Report the reasons.

**Handoff to Chef (operator → Chef, one message).** It contains:
- the capture exit code;
- the attestation path and its sha256;
- the conversion verdict;
- the untouched output directory path.

The operator does not verify, convert or touch the packet (OPERATOR-ACCEPTANCE: "The operator never verifies their own run"). **Chef checks `OPERATOR-ATTESTATION.json` with the `check` command before running `convert.mjs`** (§3c, RECHECK-7).

## 5. TJ's inputs

**Decided (2026-11-15, relayed by Chef):**
- **Egress:** the connect-only check at T−1.5, run with approval A1.
- **Pre-approval evidence:** the snapshot tool (T−1.2b) covers RUNTIME-RECEIPT-PLAN §4 items 4 and 7.
- **Attestation:** `check` binds `argv0`, `cwd` and the date (Chef's call).
- **Wake-up:** TJ messages Chef at about 13:45Z, and Chef relays it.
- **Receipt path:** accepted, `/Users/tim/Library/Application Support/fhfh-blsh-authorization-20261117T140500Z.json`.
- **Fallback:** finished now (§8).

**Still open:**
1. **A0:** run the admission SQL (through the MCP `execute_sql`, as proposed), or accept the unknown state.
2. **A1:** the T−1 pop-up for probe v2 **and** the egress connect-check, naming both exact commands.
3. **A2:** the final run approval, with the hashes in §7, an **`approvalReference`** ID matching `^[A-Za-z0-9._:-]{1,200}$`, and its time, which becomes `approvedAtUTC`.

**For Chef:** the hash coupling. The attestation tool pins both launchers and both baselines, and the receipt writer pins both bootstraps. Changing any of them means re-hashing these tools.

## 6. Dress rehearsal (offline)

**Two rehearsals, never on a slot date:** `tools/dress-rehearsal.sh <empty scratch dir>` rehearses 11-17. `tools/dress-rehearsal.sh <empty scratch dir> 1118` rehearses the fallback, applying the §8 delta to the same blocks.

**How it runs:**
- **Verbatim blocks:** it extracts this file's thirteen fenced command blocks and runs them verbatim. The §8 stop check runs in the 1118 rehearsal only, together with a negative case: a planted 11-17 lock inside `abandoned-20261117/` gives `1`. The §3 start line runs against the scratch launcher copy, never the real lock or env file. The only substitutions are the attestation folder → scratch, the receipt and snapshot output paths → scratch, and the receipt's `<…>` placeholders → rehearsal IDs.
- **Never run:** the egress block. It would reach the real hosts; its loopback tests stand in.
- **Probe v2** runs through a seam because it reads `.env.local`: its `parse` is redirected to a fake env file, `open` refuses the real path, and its four children run for real.
- **The launcher at a fake 14:04:00Z** uses the real `launch()` with a fake 0600 env file, a fake clock and a node stub as the exec target. Its gate-7 G3 is the real pinned one.
- **Temp folders:** G3 makes empty `mkdtemp` folders under the shell's temp folder, or `/tmp` under `env -i`. Everything else is written to scratch.

**The attestation check is strict.** The real CLI `check` **rejects** the rehearsal's own attestation, with exactly `launcher_argv0_not_real_node` and `launcher_cwd_not_canonical_web`, because the stub is not `/usr/local/bin/node`. It is accepted only through the explicit seam: `check(path, candidate, expect={stub, fake web})`.

**Negatives**, all **rejected**:
- a T+0 mismatch, from a real G3 refusal on a scratch closure with `undici` changed;
- the same attestation with `bothMatch` hand-set to `true`;
- a `DYLD_*` key in the env file, where the real launcher refuses and nothing execs;
- a contaminated operator shell;
- a wrong candidate, a v5-1117 file checked as v5-1118 or the reverse.

**Results (2026-11-15 ~22:00Z, after the RECHECK-11 B and fallback M2/L1 fixes):**

| Run | Result |
|---|---|
| `dress-rehearsal.sh … 1117` | 28 PASS, 2 SKIP, 0 FAIL |
| `dress-rehearsal.sh … 1118` | 31 PASS, 2 SKIP, 0 FAIL |
| Launcher suite, 1117 and 1118 | 49/49 each |
| Egress loopback tests | 13/13, unchanged |

- **New cases:**
  - the scratch launcher copy (only `ENV_FILE` and `LOCK_PATH` differ);
  - the §8 stop check, including a planted lock in `abandoned-20261117/`;
  - two ordering negatives: T−0 ending after the exec, and T+0 starting before the capture ended.
- **Slot-date guards:** simulated for 2026-11-17 and 2026-11-18, both tools exit 3 before doing anything; 2026-11-16 continues.
- **Skipped:** the admission SQL, and the mailbox and session checks. The egress block is never run.

## 8. RUNBOOK-1118: the 2026-11-18 fallback (delta only)

**When.** Only if the 11-17 slot is abandoned or missed **before any launcher start**. If the 11-17 launcher started, the pilot is consumed: there is no fallback, and its lock, `launcher.log` or output directory will show it. Timing limits are in fallback HANDOFF §1: the evaluation must run the same UTC day, by 2026-11-18T23:59:59Z.

**Preconditions (not the operator's):**
- `FALLBACK.patch` (`209b34eb…`) is applied to canonical `web/` by its owner, so the bootstrap is `849009ee…`.
- The bridge and frames knock-ons in fallback HANDOFF §3 are done by their lanes.
- New approvals:
  - **A1-1118:** the probe and egress pop-up.
  - **A2-1118:** naming bootstrap `849009ee…`, expected pins `3f61f9d4…`, launcher-1118 (§7), G3 baseline `e9c7ec5a…`, output `…/fhfh-blsh-native-20261118T140500Z` and the 1118 receipt path.
  - **A0** carries over unless TJ says otherwise.

**Dates.**
- T−1 is 2026-11-17 and T−0 is 2026-11-18, with the same clock times.
- The wake-up is TJ → Chef → operator at about 13:45Z on 11-18.
- The launcher-1118 windows are the same times on 11-18.

**Exact substitutions in §1–§4** (`tools/dress-rehearsal.sh <scratch> 1118` applies exactly these):

| In the 11-17 blocks | For 11-18 |
|---|---|
| `tools/nst-pilot-launcher.py` | `tools/nst-pilot-launcher-1118.py` |
| `evidence/DEPENDENCY-TREE-BASELINE.json` | `evidence/DEPENDENCY-TREE-BASELINE-1118.json` |
| `--candidate v5-1117`, and probe v2's last argument `v5-1117` | `v5-1118` |
| `fhfh-blsh-authorization-20261117T140500Z.json` | `fhfh-blsh-authorization-20261118T140500Z.json` |
| `evidence/PREAPPROVAL-RUNTIME-EVIDENCE.json`, `evidence/PREAPPROVAL-RUNTIME-SNAPSHOT.json` | `…-1118.json` |

**Receipt IDs:** `…20261116…` becomes `…20261117…`, and `blsh-slot-20261117T1405Z` becomes `blsh-slot-20261118T1405Z`. The output check block is unchanged: **both** output directories must be absent.

**First, before anything else on 11-18: did the 11-17 launcher start? (stop check, M2).**

```bash
A=/Users/tim/Code/fhfhockey.com/tasks/artifacts/blsh-pilot-operator-2026-11-15/attestation; ls -d "$A/launcher-20261117T1405Z.lock" "$A/launcher.log" "$A/capture.exit" "$A/abandoned-20261117/launcher-20261117T1405Z.lock" "$A/abandoned-20261117/launcher.log" "$A/abandoned-20261117/capture.exit" "/Users/tim/Library/Application Support/fhfh-blsh-native-20261117T140500Z" 2>/dev/null | wc -l | tr -d ' '
```

- **Expect:** `0`.
- **Anything else means the 11-17 launcher started**, which consumes the pilot: **stop, no fallback**. The check looks in `attestation/` and also inside `attestation/abandoned-20261117/`.
- **The lock, `launcher.log` and `capture.exit` are never moved, renamed or deleted, on any day.**

**Then: the attestation folder.** The same `attestation/` folder is used, because launcher-1118's lock is `attestation/launcher-20261118T1405Z.lock`.
- **Only after the stop check prints `0`:** move the 11-17 **T−0 files only** into `attestation/abandoned-20261117/`, never deleting them. Those are `g3-T-0.*` and `shell-dyld-devdir.count`. Nothing else moves.

**Slot re-clearance for 11-18 (L1).** Run the SLOT-CLEARANCE §5 recheck again for 2026-11-18, 13:45–14:03Z:
- the mailboxes, `list_sessions` and the cron-file git check;
- Chef re-posts the owner-confirmation request for 13:45–14:15Z **on 11-18**, and the confirmations must be recorded.

The 11-17 confirmations do not carry over. The result is `evidence/TMINUS-RECORD-20261118.md` and `coordinationReceipt` `blsh-slot-20261118T1405Z.tminus.<sha12>`.

**Rehearsed before the patch is applied.** Canonical `web/` still carries v5, so `dress-rehearsal.sh … 1118` points three things at a scratch `git archive 348a122d6` with `FALLBACK.patch` applied (bootstrap `849009ee…`):
- the G3 blocks, with `--sources`;
- the receipt block, with `--bootstrap`;
- the probe's bootstrap argument.

Before the apply, probe v2 is expected to give `pass: false` with exactly `runtime_bootstrap_not_candidate`, because its prediction reads the canonical v5 bootstrap. Everything else is expected to pass.

## 7. Hashes

| File | sha256 |
|---|---|
| `tools/nst-pilot-launcher.py` (11-17; unchanged) | `31c370c3110ddb5d4cf90e730e9650639e36bd442959f7a7c791bbc28926197b` |
| `tools/nst-pilot-launcher-1118.py` (fallback) | `2670353dff80d47a642fd657cfa22449a703acdbc6068a33971692f2621cd444` |
| `tools/dependency-tree-hash.mjs` | `912041a513f0dabf034797d6c4d93fcb2a22ded6d2019f44463ce82f56103bf4` |
| `evidence/DEPENDENCY-TREE-BASELINE.json` (v5) | `4534fd65c30d7c6e86ac84fd0664074074c039980ba207d5f5928277a52c1bb3` |
| `evidence/DEPENDENCY-TREE-BASELINE-1118.json` (fallback; only `sources.bootstrapSHA256` differs) | `e9c7ec5a8afc627c231331a7c7ace6488064ee414244947a078325b7a4ccd7e9` |
| `tools/env-presence-probe-v2.py` (candidate argument) | `246bf6b43d3282693ea71f1f4509a7eb4398585342d746aa4d41e4b4608e7867` |
| `tools/preapproval-runtime-snapshot.cjs` | `fd9019e3e1a24d47ef5366b3bc04fee128c45290ee69f955faf40f37139b9da0` |
| `tools/egress-connect-check.mjs` | `c61c7fe7bfa65df9f26dca8c0ba072e4697c642596cb508deb76b95d0af05d4f` |
| `tools/test-egress-connect-check.mjs` | `32abcddc75c74e717e565b3644a4966766dd352ce215188843a9105a9ae955bf` |
| `tools/write-authorization-receipt.py` (candidate table) | `5e2060596446d1813ac80fb03a9f14b839903874dbf3651b631ef3242129e469` |
| `tools/operator-attestation.py` (candidates; `argv0`, `cwd`, date and G3/exec ordering bound) | `de0982a6bb6be1afc591cabc5a3e8fcbb80e674897f51c8eb5c7be66d023762b` |
| `tools/test-nst-pilot-launcher.py` (variant argument) | `33aa7cb4730199af4391b0570d8b2eedf0ef944cb2f461754fd7cc73e796f0c7` |
| `tools/dress-rehearsal.sh` (1117 and 1118) | `49377aa0a6f71be30df66597401cfadef574802bcf6101ca691d13b3aae1d70a` |

This file's own hash is reported to Chef; a file cannot contain its own hash.
