# Diary: BLSH pilot operator (Claude NST operator lane)

- **Scope:** operator side only for one future BLSH native-input pilot: acceptance, slot clearance (2026-11-17 14:05Z), runtime/TLS receipt plan, admission/control evidence. No live run, no `--run`, no provider/NST/DB/ledger call, no web/** or mailbox edits, no git mutations.
- **Session:** local_017907a3 (child of BLSH Chef local_56526db8).
- **Where:** `tasks/artifacts/blsh-pilot-operator-2026-11-15/`; octoberBranch, shared checkout, nothing committed.

## Log
- 2026-11-15 ~02:00Z: read plan/authorization/approval packet/blockers, both mailboxes (latest), lease files (stale: Claude 11-12, Codex 11-04), vercel.json (32 crons), cron-schedule.md, session list.
- Ran credential-free `--check` under `env -i` (TMPDIR=scratch): exit 0, project unset, lifecycle disabled. NOTE: this is the EXPIRED bootstrap d4d2fcac (slot 11-13); must re-run on the successor hash.
- Runtime probe: node v22.23.4 sha daa77e22..., OpenSSL 3.5.9, undici 6.29.1, TLS 1.2-1.3, 116 bundled roots, system/extra CA 0.
- Gotcha: local NST ledger path follows TMPDIR. Real ledger dir exists under DARWIN_USER_TEMP_DIR (/var/folders/.../T/fhfhockey-nst-budget-501); /tmp has none. A run under env -i without TMPDIR would use a fresh substitute ledger.
- Gotcha: forbidden-var list omits OPENSSL_CONF etc.; an allowlist-built env closes that by construction.

## Next
- Finish the extra credential-free checks, write the 4 files, ask TJ about the presence-only probe, report to parent.

## Pending approvals
- TJ: presence-only env probe (not yet asked).

## Checkpoint ~02:30Z
- Extra checks: on-demand NST API routes (CareerAverages, SustainabilityStats, Teams/[abbr], fetch_team_table) use the shared admission client: an unschedulable residual risk. This shell carries NODE_USE_SYSTEM_CA (forbidden), so the launcher env must be built from an allowlist. Budget body MD5 re-derived as 5e854308…557b. No later admission migration. Enforced=true in the legacy wrapper raises before any write.
- CA hash 98c3b150 (11-12) not reproduced (method unknown); my method's hash is 5aab51f9; same Node binary.
- TJ approved the presence probe (pop-up). Ran once on .env.local: PASS (keys present, project pinned, lifecycle absent, --check project pinned). Evidence in evidence/.
- Wrote OPERATOR-ACCEPTANCE (accepted, conditional), SLOT-CLEARANCE (UNKNOWN: scheduled evidence clear; no alternative, contingency 11-18), RUNTIME-RECEIPT-PLAN (launcher = design change for TJ), ADMISSION-CONTROL (read-only SQL proposal, not run).

## Next / pending
- Parent: post coordination asking TJ, Scout/Codex (H1, Astra live audit, Browserless), FORGE and Rankings owners to confirm nothing runs 13:45–14:15Z on 11-17.
- TJ approvals: (a) launcher + wait-then-exec design change; (b) optional bounded admission read (ADMISSION-CONTROL §4) or explicit acceptance of the unknown; (c) final run approval with successor hashes.
- Operator: at T−1 day, re-run --check and the probe on the successor; at T−minus, run the §5 recheck.

## Checkpoint: design change from Chef
- Chef local_56526db8 changed the design: the runner writes the authoritative RUNTIME.json in-process, bound to STARTED.startedAtUTC, plus per-operation TLS facts. My T−1 probe is pre-approval evidence only, never TLSVerified provenance.
- Updated RUNTIME-RECEIPT-PLAN: title, banner, §4 renamed to PREAPPROVAL-RUNTIME-EVIDENCE.json, new §4a (in-process receipt plus operator comparison as veto-only), §6 runtimeReceipt ID. Also updated OPERATOR-ACCEPTANCE step 2.
- RUNTIME.json field names are not yet in the successor HANDOFF.md, which only names the blocked TLS variant's `.tls` fields. Re-sync when updated.

## Checkpoint: final successor HANDOFF (SUCCESSOR.patch 40dd64bc…)
- Refreshed RUNTIME-RECEIPT-PLAN (exact RUNTIME.json and tls field names; §3a; §7 hashes) and OPERATOR-ACCEPTANCE (conditions 5 and 6).
- Gap found and fixed: the old plan passed NST_JOB_LIFECYCLE_ENABLED through verbatim, but checkRuntime requires the key to be absent, so `=false` would veto the packet after five live calls. Rule is now: key present → refuse.
- New tools (v1 untouched): env-presence-probe-v2.py 92289210…, runtime-snapshot.cjs f9c64be4…, check-predicted-runtime.mjs 58669d6e… (imports the bridge's checkRuntime, convert.mjs 197f3e17…). Credential-free tests: baseline pass; each override/CA/origin/lifecycle/missing-key fault vetoed with the expected code. execArgv/node pin are covered by --check.
- v2 has NOT been run with credentials; it needs a TJ pop-up at T−1 on the successor bootstrap.
- Doc hashes: RUNTIME-RECEIPT-PLAN f1782a72…, OPERATOR-ACCEPTANCE 8e58e8e3….

## Checkpoint: G3 dependency-tree gate (TJ chose "hash the dependency tree", via Chef)
- Built tools/dependency-tree-hash.mjs (cf43a102…), offline and read-only. v4 sources come from a scratch git archive of a9551076 + SUCCESSOR.patch 66b4eb30…; no checkout edits; node_modules untouched.
- Baseline evidence/DEPENDENCY-TREE-BASELINE.json e278b666…: 42 packages, 1,634 files, tree 76c7d466…473a. All 4 DEPENDENCIES pins and 9 role pins match; regeneration is deterministic.
- Tests (scratch copy only): match ×2; refuse on byte change, outside symlink, nested extra file, pinned entry change, removed dep, and the probe-shaped invocation. The canonical tree currently refuses (bootstrap_differs_from_baseline) until the patch is applied, as expected.
- Probe v2 wired (dc43f480…); pass now needs dependencyTree "match". T−0 command documented. Probe v2 end to end is still not run (needs a TJ pop-up).
- Docs: RUNTIME-RECEIPT-PLAN 34741663…, OPERATOR-ACCEPTANCE f465463f….
- Gotcha: the check binds files only before launch; load-time hashing would need runner code (successor lane).

## Checkpoint: v5 rebaseline (SUCCESSOR.patch e8be50de…)
- v5 export: bootstrap dbf69c47…, runner a74cbb0a…, adapter aa6237bd… (match Chef's figures). The v4 baseline moved to evidence/superseded/.
- New G3 baseline 4534fd65…; closure unchanged (42 packages / 1,634 files / tree 76c7d466…). npm undici 7.29.0 is in the closure (required by cheerio, 210 files, pkg 3f736889…). The registry is unset before cheerio and holds an Agent after.
- The bridge changed underneath me (197f3e17 → eea43c7f → 54e3d624 at 11:17): it now requires launch and globalDispatcher and takes a 5th bootstrapSHA256 argument. A key-set mismatch I first saw was a transient read of the mid-update bridge, not a real one.
- Updated runtime-snapshot.cjs (1c246594…) to the v5 shape (launch + globalDispatcher) and check-predicted-runtime.mjs (8d78225b…) to pass the expected-pins _bootstrapSHA256 and apply the verifier's dispatcher rule. Probe v2 is now 6628ec01…. All isolation/fault tests pass (see DEPENDENCY-TREE-TESTS.md).
- Docs: RUNTIME-RECEIPT-PLAN bd39a955…, OPERATOR-ACCEPTANCE 1e4e32fb….

## Checkpoint: loaded-file coverage (RECHECK-4 item 3, option 1)
- New tools/list-loaded-modules.cjs (b47e0a67…): a launcher-identical load of bootstrap/prep/runner/adapter (no factory or dispatch) that reads require.cache with no hooks. dependency-tree-hash.mjs gains --loaded (274f9969…) to classify each file.
- v5 result: 256 loaded = 9 roles + 1 bootstrap + 245 package files (34 paths / 32 names) + 1 harness; 0 uncovered. G3 baseline unchanged (4534fd65…, byte-identical). Evidence LOADED-MODULES-COVERAGE-v5.json 99f37b90….
- Refusals: an extra package loaded from memory-cache → loaded_file_uncovered; an unpinned lib file → uncovered + role mismatch; a NODE_PATH shadow → dependency_unresolved. Canonical refuses until apply.
- Probe v2 now 2177714d… (--loaded). The T−0 command gains --loaded and TMPDIR=$(mktemp -d)/. Docs: plan c79305c6…, acceptance 4f53ae62….
- Note: RECHECK-4 calls G3 "undici-only"; it covers all 42 closure packages.

## Checkpoint: RECHECK-6 R0–R3 (ticket from Chef, offline)
- R0 (High): G3 required typescript from the checked tree before hashing it (forged typescript.js → forged "match"). Fix: the tool holds TYPESCRIPT_PIN (5.7.3, 129 files, pkg 3556c8c4…, entry 0fba5508…), hashes node_modules/typescript builtins-only first (both modes), and compiles the exact hashed Buffer via vm.compileFunction with a builtins-only require. The --loaded child is spawned only after the tree matched. DYLD_* in env refuses. Compare stdout gains startedAtUTC/finishedAtUTC, checkerTypeScript, dyldKeysPresent. Tool 912041a5…; baseline 4534fd65… unchanged (regenerated byte-identical).
- Tests: tools/test-g3-r0.sh (add109fe…). control/control-loaded match; undici refuse; tsforged(+loaded) refuse typescript_package_hash_mismatch; canary marker absent in compare and generate modes; symlinked typescript refuse; DYLD refuse. Reviewer's g3-self-check.sh unchanged → control match, undici refuse, tsforged refuse.
- Canonical web/ is now applied v5 (bootstrap dbf69c47…). The T−0 command on canonical gives match, 256/0 uncovered. Stale "canonical refuses until apply" text corrected.
- R1/R2: new RUNTIME-RECEIPT-PLAN §3c (attestation/ dir; identical T−0 and T+0 command with date -u stamps, verbatim stdout and exit; OPERATOR-ATTESTATION.json fields; no conversion unless both match; a T+0 refusal = quarantine). No downstream reader of an attestation exists (grep), so there is no key-set collision.
- R3 interim: the launcher plan refuses any DYLD_* (prefix) in its own env or the env file; probe v2 (6218eba8…) folds it into pass. web/scripts/blsh is untouched; the bootstrap-side refusal stays pending with TJ.
- Docs: plan d33bc4df…, acceptance d1a28184…, tests doc 0b9a26cc…. Probe v2 is still not run with credentials.
- Next: Chef relays to the reviewer; T−1 probe v2 pop-up; launcher still unwritten.
- Follow-up after review: test-g3-r0.sh now asserts 20 cases (all earlier mutation cases rerun on 912041a5…) and exits 1 on any mismatch → 20/20 PASS (script 7d711e2e…). The T−0/T+0 command also writes a shasum of the tool and baseline. Stale "successor not checked" text was corrected (its --check and prediction were not rerun after apply; they are T−1 steps). Gotcha: /usr/bin/python3 is SIP-protected, so DYLD_* is stripped from its env and the probe's own-env DYLD check is blind (documented); G3's node does see DYLD_*. Own shell: 0 DYLD_* keys. Docs: plan (see §7 / report), tests doc 1cf8256a….
- R3 decided by TJ (via Chef, 11-15): keep v5; R3 closed for the Nov 17 pilot by the launcher DYLD refusal + attestation dyldKeysPresent:false; bootstrap-side refusal queued for the next candidate. Plan and acceptance updated; the probe v2 docstring still says 'interim' (left alone so its hash does not churn).

## Checkpoint: launcher built (TJ approved the design via Chef; review = RECHECK-8)
- tools/nst-pilot-launcher.py e31ac61c…: /usr/bin/python3 -I (SIP stub; DYLD purged), --run <receipt> only. Gates: own-env lifecycle/DYLD → .env.local parsed (DYLD, lifecycle, dup, missing/empty, value shape, origin) → private receipt → getconf TMPDIR + ledger dir → window 14:03–14:05Z on 11-17 → sleep to 14:05:05 → pinned G3 --loaded (912041a5/4534fd65) → exec window 14:05:00–14:05:50 → one os.execve. Value-free logs.
- Added beyond Chef's enumerated list: G3 inside the launcher (the plan §3b already said "the launcher must run it too"), receipt privacy, origin and value-shape checks.
- Tests tools/test-nst-pilot-launcher.py 42e47ada…: 31/31 PASS, no fake secret in any output. Never read .env.local, never ran the bootstrap.
- Gotchas: the xcrun python shim injects CPATH/SDKROOT/etc. (not passed on); node adds __CF_USER_TEXT_ENCODING itself; /usr/bin/env and printenv are SIP and blind to DYLD_*. My earlier "own shell 0 DYLD" check used env and was blind → redone with the builtin `export -p`: 0.
- Docs: plan §1a new, §3b, §3c, §7 (98dfd0fe…); acceptance (cf972ab7…).
- Next: Chef → RECHECK-8; the final run approval must name launcher e31ac61c….
- Revision after review + RECHECK-7 (e5e176a0…): the window gate now runs BEFORE .env.local is opened (outside the slot the credentials file is never read). Launcher 1bc56fab…; tests 84ef919a… 34/34 PASS (adds production constants, the real main() → outside_start_window, and an absent file outside the window). Probe v2 bf39d6ae… adds the names-only value-shape check. Plan §1a lists the additions beyond the approved list, the hash coupling, the RECHECK-7 dyldKeysPresent wording and the converter precondition.

## Checkpoint: RECHECK-8 fixes (d214bff1…), offline
- Blocking: DEVELOPER_DIR redirects the /usr/bin/python3 shim → the invocation is now `/usr/bin/env -i PATH=/usr/bin:/bin /usr/bin/python3 -I …` (plan §1a, acceptance "One start"); the pre-start builtin check also covers DEVELOPER_DIR; a T−1 sys.executable check is added.
- Launcher 31c370c3…: builtins-only guard before any import (not_isolated / unexpected_interpreter; exec line records pythonIsolated + pythonExecutable); env file opened O_NOFOLLOW|O_NONBLOCK and fstat'd on the same fd (regular, own uid, no group/other); lock attestation/launcher-20261117T1405Z.lock O_CREAT|O_EXCL taken after the window gate and before the env read, never removed.
- Tests 2c01f08a…: 49/49 PASS under env -i; no fake secret in any output. Includes PYTHONPATH hashlib/json without -I → not_isolated, no marker, no traceback, and DEVELOPER_DIR bare (redirected) vs env -i (real).
- Real web/.env.local, stat only (no read): regular, 0600, uid 501, 1 link → passes the new gate.
- Stop item 11 split into wake-up (by 14:04:30Z) / start window / exec window.
- Gotcha: the lock dir is attestation/, created by the T−0 command, so T−0 must run first or the launcher refuses launcher_lock_unavailable.
- Docs: plan 3d09b802…, acceptance f5984419….

## Checkpoint: push-button readiness (RUNBOOK + dress rehearsal), offline
- New: RUNBOOK.md (T−1, T−0, the start, T+0, TJ inputs); tools/write-authorization-receipt.py 15a70300… (mirrors the bootstrap readAuthorization; O_EXCL 0600; constants read from the bootstrap source); tools/operator-attestation.py d252d358… (write --dir / check; recomputes from verbatim outputs); tools/dress-rehearsal.sh c162a273….
- Rehearsal: 22 PASS / 3 SKIP (admission SQL, probe v2 creds, mailbox/session checks) / 0 FAIL. Real G3 T−0/T+0 on canonical; the production start line refuses outside_start_window today; seam launcher at a fake 14:04 with real G3 → one stub exec; attestation accept; rejects a T+0 mismatch (real G3 refusal on a mutated scratch closure), a hand-set bothMatch, a DYLD env file, and a contaminated shell. No real paths created.
- No launcher defect found; launcher unchanged (31c370c3…).
- TJ inputs: A0 admission, A1 probe pop-up, A2 final approval + approvalReference, receipt path, probe output as pre-approval evidence (§4 items 4/7 not tooled), who sends the wake-up.
- Revision after review: the rehearsal (6bab1050…) now extracts and runs the RUNBOOK's 10 fenced blocks verbatim (paths and placeholders substituted only), rehearses probe v2 through a seam on a fake env file (all four children real → pass true), and compares the receipt with the bootstrap test fixture. Result 22 PASS / 3 SKIP / 0 FAIL. RUNBOOK adds T−1.5 (sandbox/egress = TJ input), says 14:02Z governs over "about 14:03Z", and corrects the /tmp wording; plan §1a gate 7 wording too.

## Checkpoint: TJ/Chef decisions built (egress, snapshot, strict attestation, wake-up, receipt path, 11-18 fallback), offline
- Egress: tools/egress-connect-check.mjs c61c7fe7… (Node, bundled CA = capture trust store; TCP+TLS only; 5 s; refuses overrides before DNS). Loopback tests 32abcddc… 13/13 (0 application bytes). Never run against the real hosts.
- Snapshot: tools/preapproval-runtime-snapshot.cjs 642adbaf… (OpenSSL 3.5.9, undici 6.29.1/npm 7.29.0, TLSv1.2–1.3, CA default=bundled=116, noOverrides).
- Attestation becd44e0…: --candidate v5-1117|v5-1118; binds argv0 /usr/local/bin/node, cwd canonical web/, and the 14:05:00–14:05:50Z window on the candidate date. Only a check() expect seam relaxes argv0/cwd (rehearsal).
- Fallback: baseline DEPENDENCY-TREE-BASELINE-1118.json e9c7ec5a… (byte-identical to the successor lane's PREDICTED-DEPENDENCY-TREE.json; only sources.bootstrapSHA256 differs); launcher-1118 2670353d… (diff: date, lock name, baseline pin, docstring). Receipt writer 5e206059… and probe v2 dabbbd5b… take a candidate argument.
- Tests: launcher suite d90999ec… 49/49 for both 1117 and 1118 (1118 refuses the v5 canonical tree at gate 7, as expected). Rehearsal b01ea793…: 1117 25 PASS/2 SKIP/0 FAIL; 1118 26/2/0 (pre-apply probe veto only runtime_bootstrap_not_candidate).
- Launcher 31c370c3 unchanged. RUNBOOK 6a03c58d… (T−1.2b, T−1.5 egress, wake-up via Chef, §5 decided/open, §8 fallback delta); plan 1f60bea3….

## Checkpoint: RECHECK-11 §B + fallback M2/L1 fixes (offline)
- B1: date guard as the FIRST statement of dress-rehearsal.sh and test-nst-pilot-launcher.py (both variants via one file each): refuses 2026-11-17/18 UTC, exit 3 (simulated). Real-script cases and the rehearsal's §3 start line now run a scratch launcher copy whose only changed lines are ENV_FILE and LOCK_PATH; case() asserts no real env/lock path. RUNBOOK rule added. Launchers unchanged (31c370c3 / 2670353d).
- B2: operator-attestation check orders T−0 end ≤ exec atUTC and capture end ≤ T+0 start (de0982a6…); rehearsal N.5/N.6.
- B3: plan gate 7 / §3c describe the launcher's g3 WRAPPER line; §3c notes the bridge's check-attestation reads it (C1 is the bridge lane's fix); test/probe hashes refreshed; probe v2 scratch is now mkdtemp (246bf6b4…); snapshot wording (fd9019e3…).
- M2/L1: RUNBOOK §8 stop check first (new block, also scans abandoned-20261117/; lock/launcher.log/capture.exit never moved); 11-18 slot re-clearance line.
- Results: suites 49/49 ×2; rehearsals 1117 28/2/0, 1118 31/2/0. Tests 33aa7cb4…, rehearsal 49377aa0….

## 2026-11-16 ~01:48Z checkpoint: T−1 checks run (A1)
- TJ approved by direct pop-up "Approve both" for probe v2 246bf6b4 (Chef's relay named the superseded bf39d6ae) and the egress check c61c7fe7.
- All PASS. Evidence in evidence/: PREAPPROVAL-RUNTIME-EVIDENCE.json 991b4aea… (pass true, v5-1117, G3 match, valuesPrinted false), PREAPPROVAL-RUNTIME-SNAPSHOT.json 3b081f39… (noOverrides true), G3-T-1-20261116.stdout d432a6bb… (match, 0 diffs, tree 76c7d466…), EGRESS-CONNECT-20261116.jsonl 9b81df3a… (3× ok). Interpreter CLT python3; .env.local Regular File|600|501|1.
- runtimeReceipt: blsh-preapproval-runtime-20261116.991b4aea48b6.3b081f39bccf
- Next: T−0 on 11-17 at TJ's ~13:45Z wake-up via Chef. No rehearsal/test suites on 11-17/18.
- Chef confirmed 11-16: admissionReceipt blsh-admission-20261116.565ad253fc30 (ADMISSION-READ-20261116.json, matches my hash). Idle until TJ wake-up ~13:45Z 11-17.
