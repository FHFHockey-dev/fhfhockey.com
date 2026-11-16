# BLSH native-input pilot: approval packet v2 (2026-11-15)

Supersedes PILOT-APPROVAL-PACKET.md (v1, the expired Nov 7 / Nov 13 candidate).

## Recommendation: **NOT YET.** Hold the live run until gates G1–G6 close; then approve exactly the call budget below.

The candidate, operator and bridge are ready offline. A live run now would still produce **no** gate-acceptable evidence, because official per-player frames are blocked: the acquisition tool is not built, reviewed or approved. The frames must also land within 24 h of the capture (gate `:213-214`). Running before G4 closes means spending live calls on a packet that expires unqualifiable.

---

## 1. Exact candidate (v4)

| Item | Value |
| --- | --- |
| Patch | `tasks/artifacts/blsh-successor-candidate-2026-11-15/SUCCESSOR.patch` sha256 `66b4eb3004e49d6698e2d53e8e41245653d41ce7a96cc0c82d26241c8b9af85d`. Not applied: Scout owns `web/scripts/blsh/**` |
| Base | octoberBranch `a955107671ee7c1b2521891393a6bad6d95e9f89`; pinned paths unchanged at handoff; `git apply --check` passes |
| Bootstrap | `a224d62e0cdb1d9e5111e936c2451ec1e7cb4836d2402c110ba5309066cd51e7` |
| Runner / adapter | `6a7341dc…a3233a` / `aa6237bd…947be0`; the other 7 runtime roles are unchanged (CANDIDATE.json `runtimeRoleSHA256`) |
| Verifier / pins | `rehearsal/verify-packet.mjs` `04a632ba…`; `expected-pins.json` `f2f639ea…` |
| Node | `/usr/local/bin/node` v22.23.4, sha256 `daa77e22…`; default CA store = bundled roots (reviewer-verified) |
| Offline evidence | Export suites 205/223, all 18 failures `bootstrap_wrong_checkout`, the expected export limit; a copy differing only in the path literal passes 223/223. Rehearsal and every tamper case as expected (successor HANDOFF.md) |

**Safeguards kept:**
- the freshness rule (`nativeProcessCapturePreparation.ts:48`) is untouched;
- 0 retries; 22 s NST spacing;
- disabled lifecycle mode; any `NST_JOB_LIFECYCLE_ENABLED` is refused;
- 0700/0600 output with the manifest written last.

**Additions:**
- per-operation TLS observation, with resumed-session and keep-alive binding;
- an in-packet `RUNTIME.json` with launch proof;
- a per-dispatch CA-store recheck.

## 2. Date, slot, output, expiry

| | UTC | Eastern |
| --- | --- | --- |
| Source date | **2026-11-11**, verified complete: games 2026020293–298 all OFF in DRM step-5 evidence; game 299 is Nov 12 | — |
| Start window | **2026-11-17 14:05:00–14:06:00** (one start; work ends before 14:08) | 09:05:00–09:06:00 EST |
| Output | `/Users/tim/Library/Application Support/fhfh-blsh-native-20261117T140500Z` (absent; created 0700 by the runner) | |
| Source date expiry | 2026-11-19 00:00 | 2026-11-18 19:00 |
| Evaluation deadline | ~2026-11-18 14:05, at most 24 h after the earliest retrieval; evaluation date ≤ 2026-11-18 | ~09:05 |

The slot is **not reserved**. A missed slot means stop; a new slot means a new bootstrap.

## 3. Five-call budget (the only remote calls; concurrency 1; 0 retries; 0 redirects)

1. GET `https://api-web.nhle.com/v1/schedule/2026-11-11`
2. POST `https://fyhftlxokyjtpndbkfse.supabase.co/rest/v1/rpc/nst_admit_attempt_v1` (individual)
3. GET NST individual (`stdoi=std`, `fd=td=2026-11-11`, all strengths, counts)
4. POST admission again (on-ice)
5. GET NST on-ice (`stdoi=oi`)

**Limits:**
- at most **2 production writes**: the legacy admission transactions, which can update permit state even on a denial;
- at least 22 s between NST GETs;
- 120 s total work;
- 15 s per provider call and 5 s per admission call;
- caps of 1, 2 and 8 MiB and 5,000 rows.

NST limits (40/1m, 80/5m, 100/15m, 180/h) are shared across all callers.

**Separately approved later:** the official-frame acquisition, **6 GETs** (one boxscore per 2026-11-11 game, ids taken only from the packet's verified schedule).

## 4. People

| Role | Who | Status |
| --- | --- | --- |
| Operator | Claude NST session `local_017907a3` | **Accepted, with conditions** (OPERATOR-ACCEPTANCE.md) |
| Packet verifier and converter | Claude Chef (this lane), running the v4 verifier and bridge directly on the fixed output path | Proposed |
| Independent evidence reviewer | `local_548117af` (did REVIEW.md and RECHECK.md); fills `reviewSHA256` | Proposed |
| Policy installer | A policy owner other than the bridge lane | **Unnamed** |

## 5. Gates before approval

| # | Gate | Owner | State |
| --- | --- | --- | --- |
| G1 | Apply v4 in the canonical checkout, then canonical suites, `--check` and bridge 17/17 | Scout (`web/scripts/blsh/**`) | Requested in the mailbox; **pending** |
| G2 | Slot clearance for 2026-11-17 13:45–14:15Z | Lanes + TJ | FORGE **clear**, Rankings **clear**, Astra **clear**; Scout/Codex (Goalie H1, Browserless) **pending**; TJ `/db/runner` **pending** |
| G3 | Runtime: T−1 probe v2 in the configured process (presence-only) and a `node_modules` integrity method | Operator + TJ | Probe ready; **needs TJ's pop-up at T−1**. Integrity method: **TJ chose hashing the dependency tree** (2026-11-15). Baseline and closure hash are being built by the operator lane, and T−1/T−0 refuse on any difference. No `npm ci`, and the bootstrap's dependency pins stay valid |
| G4 | Official-frame acquisition tool: gaps 4a–c closed, tool built, independently reviewed, hash added to `APPROVED_ACQUISITION_TOOLS` by a reviewed change | Bridge lane → reviewer | **In progress** (ticket sent) |
| G5 | Admission/control: current deployed contract evidence; it is historical only (MD5 prefix `5e854308`) | NST custodian / TJ | **Unknown**; a bounded read needs its own approval, or TJ accepts the unknown explicitly |
| G6 | Optional outside witness: match the admission-ledger rows for ops 2 and 4 after the run | TJ | Decision; it would be a production read |

## 6. What counts as what

- **Qualified evidence, if everything passes:** for the 2026-11-11 rows only, a *candidate* acceptance-policy entry. It needs the bridge conversion of a verified packet plus reviewed frames, filled in by the independent reviewer. A non-bridge owner then installs it.
  - "TLS verified" means internally consistent with a verified run by the pinned code. With custody (Q1) it is an attestation, not independent proof.
  - Expected holds: rows on dotted-code teams; on-ice markup unproven until the real bytes are seen.
- **Diagnostic only:**
  - a verified packet without reviewed frames, or evaluated after ~2026-11-18 14:05Z;
  - any FAILED, partial or vetoed packet.
- **Stays gated even if it passes:**
  - five-game windows: the gate's constants (`:262`, `:266`) never admit them, and current use needs all five games within 6 days;
  - the public BLSH preview and trade page (production 404);
  - arm-C method admission (arm A + overlay remains the recorded display decision);
  - snapshot activation, scores, and any price or market claim;
  - deploys and flags.

## 7. Abort criteria (the operator stops; no retry, no second process, no changed date)

- Any v4 pin, runtime, launch-proof, lifecycle-key, override, slot or output mismatch.
- A schedule that is not exactly the 2026-11-11 slate with every game OFF or FINAL.
- Any denied, invalid or expired permit.
- Any HTTP, TLS, redirect, shape, timeout, cap or fsync failure, or a CA-store change between dispatches.
- Unexpected NST or DB activity at the T-minus recheck.
- Any STARTED operation without its SETTLED operation counts as **possibly sent**.

## 8. Approval wording (only after G1–G5 close)

> Approve one BLSH native-input pilot:
> - operated by Claude NST session `local_017907a3`;
> - starting 2026-11-17 14:05:00–14:06:00 UTC (09:05 ET);
> - using bootstrap `a224d62e…` from SUCCESSOR.patch `66b4eb30…` as applied by Scout;
> - source date 2026-11-11;
> - output `…/fhfh-blsh-native-20261117T140500Z`;
> - at most five ordered HTTP attempts, including at most two production admission transactions, with no retries.
>
> Separately approve the reviewed frame-acquisition tool `[hash]`: 6 boxscore GETs within `[window]`. This approval authorizes nothing else.

Nothing was run live. No reservation, provider or production call, ledger write, push, deploy, flag change or commit was made.
