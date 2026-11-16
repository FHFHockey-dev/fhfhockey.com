# BLSH native-input pilot: approval packet v3 (candidate v5, 2026-11-15)

Supersedes v2 (candidate v4) and v1 (expired). Every hash below was re-checked by Chef on disk, and every suite count was rerun by Chef.

## Recommendation: **NOT YET, offline work complete and independently reviewed.** The full day-of set (capture, launcher, integrity, operator runbook, request reader, post-capture chain) is APPROVED in RECHECK-9/10/12, with dress rehearsals green. The 11-18 fallback is ready (REVIEW-2). What remains is TJ's separate approvals A0–A4 in **APPROVAL-SHEET.md**, which supersedes §9 below, plus the Scout/Codex slot reply.

---

## 1. Exact capture candidate (v5)

| Item | sha256 |
| --- | --- |
| `SUCCESSOR.patch` (not yet applied; Scout owns `web/scripts/blsh/**`) | `e8be50de132887be4e4c33b086003a1f639ba554f23c85f08d27d5a780d7752f` |
| Bootstrap | `dbf69c474bedefd9…` |
| Runner / adapter | `a74cbb0a59d4b352…` / `aa6237bdb8d977cb…`; the other roles are unchanged (CANDIDATE.json) |
| Verifier / pins | `b86af692e5c4b3b9…` / `a2a1e694dfa79ba9…` |
| Node | `/usr/local/bin/node` v22.23.4, `daa77e22…`; default CA store = bundled roots |
| Live transport | npm `undici` 7.29.0, loaded by cheerio at runner load (v5 HANDOFF "Corrections") |
| Dependency tree (G3) | baseline `4534fd65c30d7c6e…`, tree `76c7d466725ea132…`, 42 packages, 1,634 files, including undici 7.29.0. Checked at T−1 and T−0; any difference refuses |
| Launcher | `tools/nst-pilot-launcher.py` `31c370c3110ddb5d…` (RECHECK-9 CLOSED). Start line: `/usr/bin/env -i PATH=/usr/bin:/bin /usr/bin/python3 -I …/nst-pilot-launcher.py --run <receipt>` at ~14:04Z; it refuses outside 14:03–14:05Z, sleeps to 14:05:05Z, reruns G3, makes one `execve` |
| Offline evidence | Export 209/228: the 19 failures are all `bootstrap_wrong_checkout`; a copy relocated to the canonical path passes 228/228. Rehearsal and tampers as expected |

**Safeguards:**
- the freshness rule is untouched;
- 0 retries; 22 s spacing; disabled mode;
- any `NST_JOB_LIFECYCLE_ENABLED` is refused;
- per-operation TLS observation (resumed and keep-alive bound);
- `RUNTIME.json` with launch proof;
- a per-dispatch CA-store recheck;
- dispatcher identity: the registry must be empty before the pinned imports, then the same object at every dispatch;
- 0700/0600 output with the manifest last.

## 2. Evidence bridge and official frames

| Item | Value |
| --- | --- |
| Bridge | `tasks/artifacts/blsh-evidence-bridge-2026-11-15/`, bound to v5 (vendored in `approved/v5/`); SHA256SUMS 29/29; **Chef rerun 21/21** |
| Fetch tool | `acquire-boxscores.mjs` `aa8a9cb7e90b057e53524f3ebabc261f32f67b06eac79b4e75d64298e432b107`; self-contained (node: builtins only, empty execArgv); ids only from an approved v5 conversion |
| Independent review | REVIEW, RECHECK, RECHECK-2 (DO NOT APPROVE e075b90a), RECHECK-3 (APPROVE 4f8a0888, v4 only), **RECHECK-4: APPROVE `aa8a9cb7…`** |
| `APPROVED_ACQUISITION_TOOLS` | Still **empty**. Adding the hash is a reviewed change by a lane other than the bridge author (G4) |

## 3. Date, slot, outputs, expiry

| | UTC | Eastern |
| --- | --- | --- |
| Source date | **2026-11-11**: games 2026020293–298, all OFF in retained DRM step-5 evidence | — |
| Capture start window | **2026-11-17 14:05:00–14:06:00** (work ends before 14:08) | 09:05:00–09:06:00 EST |
| Capture output | `/Users/tim/Library/Application Support/fhfh-blsh-native-20261117T140500Z` | |
| Frame output | `/Users/tim/Library/Application Support/fhfh-blsh-boxscores-20261111`; fixed, must not pre-exist; run right after conversion | |
| Source-date expiry | 2026-11-19 00:00 | 2026-11-18 19:00 |
| Gate-evaluation deadline | at most 24 h after the earliest retrieval (≈ 2026-11-18 14:05), and an evaluation UTC date ≤ 2026-11-18 | ≈ 09:05 |

The slot is **not reserved**. A missed slot means stop, and a new slot means a new bootstrap.

## 4. Call budgets (concurrency 1, 0 retries, 0 redirects)

**Capture: 5 calls.**
1. GET `api-web.nhle.com/v1/schedule/2026-11-11`
2. POST `fyhftlxokyjtpndbkfse…/rpc/nst_admit_attempt_v1`
3. GET NST individual (`stdoi=std`, `fd=td=2026-11-11`)
4. POST admission
5. GET NST on-ice (`stdoi=oi`)

At most **2 production writes** (legacy admission). 22 s NST spacing, 120 s work, 15 s per provider call and 5 s per admission call. The NST windows 40/80/100/180 are shared across all callers.

**Frames: 6 calls, approved separately.** GET `api-web.nhle.com/v1/gamecenter/{2026020293..298}/boxscore`. 15 s per request, 120 s total, 4 MiB per body, 1 s spacing, hard cap 16. No NST, DB or credentials.

## 5. People

| Role | Who | Status |
| --- | --- | --- |
| Capture operator | Claude NST session `local_017907a3` | Accepted, with conditions |
| Converter + frame fetch | Claude Chef (this lane), in place from the fixed paths | Proposed |
| Independent reviewer | `local_548117af` (fills `reviewSHA256` after the real run) | Active |
| Policy installer | A non-bridge policy owner | **Unnamed** |

## 6. Gates

| # | Gate | State |
| --- | --- | --- |
| G1 | v5 applied in the canonical checkout | **Applied by Chef at TJ's direction (2026-11-15), uncommitted**, on HEAD `eb0a07e9`. Role hashes match the candidate. Capture suites **228/228**; credential-free `--check` exit 0 (9 pins, bootstrap `dbf69c47…`, project pinned, lifecycle disabled, 0 network, output absent); G3 tree **match** with 256 loaded files and **0 uncovered**. Bridge **17/21**: the 4 failures (tests 3, 14, 18, 19) share one cause, `successorSources()` re-applying the patch onto a tree that already has it. That's a suite precondition, not a tool or bridge defect. The bridge lane fixed the setup. **Chef rerun: 21/21** on the applied tree (`g1-canonical/BRIDGE-TESTS-postapply.log`), fetch tool unchanged at `aa8a9cb7`. Bridge SHA256SUMS `003b5750…` 29/29. **RECHECK-5: APPROVE** the test-only change (`b3d52342…`); the RECHECK-4 tool approval stands. Reviewer check of RECHECK-4 precondition 2 (module integrity) against the G3 evidence is requested | **Done** |
| G2 | Slot 2026-11-17 13:45–14:15Z | FORGE, Rankings, Astra **clear**; **TJ: `/db/runner` and manual routes clear, kept free** (pop-up 2026-11-15). Scout/Codex (Goalie H1, Browserless) **no reply**; the T−0 activity check still applies | **Mostly clear; Scout/Codex pending** |
| G3 | Runtime integrity | **Offline: CLOSED** (RECHECK-9 `f52e7453…`): launcher `31c370c3…`, plan `3d09b802…`, acceptance `f5984419…`, G3 tool `912041a5…`, baseline `4534fd65…`. Coverage is complete; typescript is verified before it runs; the attested T−0/T+0 match is required; `DYLD_*`/`DEVELOPER_DIR` are blocked by the `env -i` start line; isolated Python only; lock; private `.env.local`. At **T−1 (11-16)**: the probe v2 `bf39d6ae…` (needs TJ's pop-up), the interpreter check, and a re-stat of `.env.local` | **T−1 pending** |
| G4 | Approved acquisition tool | **Done offline.** `APPROVED_ACQUISITION_TOOLS = [aa8a9cb7…]` in `frames.mjs` `8b57ffbf…`, set by Chef (non-author) at TJ's direction; tests adapted by the author (SUMS `3f50a7c4…`, 21/21 Chef rerun). **RECHECK-10 (`1914be4f…`): APPROVE.** A one-byte-different tool is still refused. Custody: hand-written acquisition folders carrying the real tool bytes now yield production frames. TJ still approves the 6 GETs separately, after an approved conversion | **Done; 6 GETs need approval** |
| G5 | Admission-control state | **Confirmed 2026-11-15** (TJ-approved, one read-only request; `admission/ADMISSION-READ-20261115.json`, sha256 `b015ed09…`). `nst_job_control.enforced = false`; all 3 admission function bodies match the repo migrations (budget `5e854308…`, attempt `7e1851c4…`, job `a56ce3d4…`); ACLs `postgres` + `service_role` only; not security definer. A same-query recheck on 11-16 closes the 2-day gap: approval 0 | **Confirmed; 11-16 recheck needs approval** |
| G6 | Optional: an admission-ledger cross-check for ops 2 and 4 as an outside witness | **TJ decision** |

## 7. What counts as what

- **Qualified evidence, if everything passes:** a *candidate* acceptance-policy entry for the 2026-11-11 rows, filled in after review and installed by a non-bridge owner.
  - "TLS verified" here means consistent with a verified run of the pinned code. Trusting it depends on custody: a hand-written packet still converts (Q1, unchanged in kind).
  - Expected holds: rows on dotted-code teams; on-ice markup unproven on real bytes.
- **Diagnostic only:** a verified packet without reviewed frames, or evaluated after the deadline; any FAILED, partial or vetoed output.
- **Stays gated even if it passes:**
  - five-game windows: the gate's constants never admit them, and current use needs all five games within 6 days (0/644 in the Nov 1 snapshot);
  - the public preview and trade page;
  - arm-C method admission;
  - snapshot activation, scores, prices;
  - deploys and flags.

## 8. Abort criteria

The operator stops and does not retry if any of these occurs:
- a pin, launch-proof, lifecycle-key, override, dispatcher, slot or output mismatch;
- a G3 tree or in-process coverage difference;
- a schedule that is not the exact 2026-11-11 slate with everything OFF or FINAL;
- a permit that is denied, invalid or expired;
- any HTTP, TLS, redirect, shape, timeout, cap or fsync failure;
- a CA-store or dispatcher change;
- unexpected NST or DB activity at T−0.

A STARTED operation without its SETTLED operation counts as possibly sent.

## 9. Approval wording: three separate approvals, plus the G5 read

Each is approved on its own, in this order. One does not imply the next.

> **0. Admission recheck (G5), T−1.** Approve one more run of the same read-only SQL request (ADMISSION-CONTROL.md §4) to project `fyhftlxokyjtpndbkfse` on 2026-11-16: 3 s statement timeout; function hashes, ACLs and the `enforced` flag only; no application rows.

> **1. Day-before probe, T−1.** Approve probe v2 `bf39d6ae…` (presence-only, no values), the interpreter check and a `.env.local` re-stat in the configured process on 2026-11-16, plus the G3 tree and `--loaded` checks. No network calls.

> **2. Capture.** Approve one BLSH native-input pilot:
> - operated by `local_017907a3` through launcher `31c370c3…` (start line per RUNTIME-RECEIPT-PLAN §1a; G3 tool `912041a5…`, baseline `4534fd65…`, T−0 and T+0 match attested);
> - starting 2026-11-17 14:05:00–14:06:00 UTC (09:05 ET);
> - bootstrap `dbf69c47…` from SUCCESSOR.patch `e8be50de…` as applied by Scout;
> - source date 2026-11-11;
> - output `…/fhfh-blsh-native-20261117T140500Z`;
> - at most 5 ordered HTTP attempts, including at most 2 production admission transactions, with no retries.
>
> **3. Frames, after conversion.** Approve, separately, tool `aa8a9cb7…`: 6 boxscore GETs for games 2026020293–298, output `…/fhfh-blsh-boxscores-20261111`, run right after conversion and before 2026-11-18 14:05 UTC.
>
> This approval authorizes nothing else.

Nothing was run live. No reservation, provider or production call, ledger write, push, deploy, flag change or commit was made.
