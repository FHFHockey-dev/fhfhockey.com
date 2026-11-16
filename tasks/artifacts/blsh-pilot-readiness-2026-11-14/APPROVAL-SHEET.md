# BLSH pilot: approval sheet (final offline state, 2026-11-15)

Details: PILOT-APPROVAL-PACKET-v3.md; the operator's `RUNBOOK.md`; the bridge's `post-capture/POST-CAPTURE.md`; the reader's `RUNBOOK.md`.

Each approval is given **separately, in order**, by TJ in chat. None of them implies the next.

**This sheet authorizes nothing.**

## The reviewed set

| Part | Hashes | Review |
| --- | --- | --- |
| v5 capture code | commit `348a122d6` (local, not pushed). Bootstrap `dbf69c47…`, runner `a74cbb0a…`, adapter `aa6237bd…` | Suites 228/228 |
| Launcher | `31c370c3…` (11-17) | RECHECK-9 **CLOSED** |
| G3 integrity | tool `912041a5…`, baseline `4534fd65…` | RECHECK-7, RECHECK-9 |
| Operator day-of | RUNBOOK `236aace4…`; attestation `de0982a6…`; egress check; snapshot; receipt writer | RECHECK-12 **APPROVE** |
| Request reader | `run_live_read.py` `c23eb286…`, scope `d84a9547…`, RUNBOOK `8e27a427…` | RECHECK-12 **APPROVE** |
| Bridge | pins `a2a1e694…`, verifier `b86af692…`, boxscore tool `aa8a9cb7…`, `frames.mjs` `8b57ffbf…`, POST-CAPTURE `c1ae5d46…`, SUMS `5e701ee7…` | RECHECK-4/10/12 **APPROVE** |
| 11-18 fallback (parked) | patch `209b34eb…`, bootstrap `849009ee…`, launcher `2670353d…`. The boxscore-tool swap is gated | REVIEW-2 **ready** |

**Dress rehearsals (Chef reruns):**
- operator: 0 failures;
- post-capture: 36/36;
- bridge suite: 21/21;
- reader: 77/0.

**Never on 11-17 or 11-18:** rehearsals and suites (they are date-guarded).

## 11-16 (T−1)

**A0. Admission recheck.**
- **What:** one read-only SQL request (ADMISSION-CONTROL §4).
- **Pass:** `enforced = false`; bodies `5e854308…`, `7e1851c4…`, `a56ce3d4…`; ACL `postgres` and `service_role` only.

**A1. Day-before checks** (operator RUNBOOK T−1):
- probe v2 `246bf6b4…`;
- runtime snapshot;
- interpreter path check;
- `.env.local` re-stat;
- G3 `--loaded`;
- **egress connect-only check**: a TCP and TLS handshake, no HTTP bytes, to `api-web.nhle.com`, the Supabase host and the NST host.

## 11-17

**Wake-up:** at about 13:45Z (08:45 ET), TJ messages Chef, and Chef relays to the operator.

**A2. Capture** (slot 14:05:00–14:06:00Z):
- **Operator:** `local_017907a3`, starting launcher `31c370c3…` at about 14:04Z with the documented `/usr/bin/env -i … python3 -I …` line.
- **Source date:** 2026-11-11.
- **Output:** `…/fhfh-blsh-native-20261117T140500Z`.
- **Limit:** at most 5 ordered HTTP attempts, at most 2 of them production admission transactions, and 0 retries.
- **Before conversion:** attested T−0 and T+0 G3 runs both report `match`, and `dyldKeysPresent: false`.

**A3. Request read** (right after conversion, about 14:10Z):
- **What:** one bounded, read-only Supabase read, using reader scope `d84a9547…` and the reader RUNBOOK command.
- **Limits:** at most 35 statements, at most 10,000 WGO rows for 2026-10-14 to 2026-11-11, at most 8 MiB, 5 s per statement, at most 150 s.
- **Role:** it connects as the owner role, because the repo has no read-only login role. Read-only is enforced by the reader's code; the custody residual is stated.

**A4. Boxscores:**
- **What:** tool `aa8a9cb7…`, 6 GETs for games 2026020293–298.
- **Output:** `…/fhfh-blsh-boxscores-20261111`.
- **When:** after an approved conversion. Evaluate by 2026-11-18, within 24 h of the earliest evidence.

## After the run

- The independent reviewer fills `reviewSHA256` on the *candidate* entry.
- **Scout/Codex** installs it, as a separate TJ-approved change.
- **These stay gated:** five-game windows, the public trade page, arm C, scores and prices, deploys and flags.

## If 11-17 is missed

Stop. The 11-18 fallback runs only on a separate TJ approval of its own hashes, plus re-clearance of the slot.
- **Evaluation:** it must happen on the same UTC day, which leaves about 9 h 53 m.
- **Boxscore tool:** the swap to the staged tool `b4b563f4…` needs its own review and approval.
