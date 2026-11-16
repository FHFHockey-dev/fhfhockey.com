# BLSH native-input pilot: approval packet (2026-11-15 UTC / 2026-11-14 ET)

## Recommendation: **NO-GO, blocked.** Do not approve a run.

The pinned candidate cannot execute. Its slot (2026-11-13 14:05Z) has passed, and its source date (2026-11-07) has been stale under the code's own 8-day rule since 2026-11-15T00:00Z, which was reproduced offline. No operator has accepted, no window is cleared, and no configured-process or TLS receipt exists.

**The one next decision (TJ):** name the operator. Recommended: **TJ**, running the one bootstrap command from the configured `web/` shell. The window, verifier and limits below are pre-filled proposals, and once an operator is named, Scout can build the successor candidate against exact constants.

---

## 1. Operator and window

| Field | Value | Status |
| --- | --- | --- |
| Proposed operator | **TJ**, running the one command in the configured local shell, which holds the credentials Claude must not load | **Not accepted yet.** The 11-12 proposal (`local_3bb2755d`) is not among the 80 most recent sessions, archived included, and never replied to `CODEX-BLSH-CUSTODIAN-COORDINATION-20261112`. Treat it as unavailable |
| Proposed source date | **2026-11-14 (Saturday)**: regular season, all teams, skaters, all strengths, counts | Proposal; needs the successor candidate (B1). **Slate not verified offline**: games had not finished when this was written. The live schedule check is the gate, and it stops before NST if the day is empty or not final |
| Proposed start window | **2026-11-17 14:05:00–14:06:00 UTC** = **09:05:00–09:06:00 ET** (EST). One start; work ends before **14:08 UTC / 09:08 ET** | Not reserved. Outside the saved 08:25–10:05 UTC NST band; no 14:xx UTC NST cron in `web/vercel.json`; custodian must clear it against current NST/DB work |
| Hard expiry | Approval covers only that one-minute window. The date itself expires **2026-11-22 00:00 UTC / 2026-11-21 19:00 ET**. A missed slot means stop; a new slot needs a new bootstrap | Code-enforced (`bootstrap` slot check, `preparation:48`) |

## 2. Exact candidate and artifacts

| Item | Value |
| --- | --- |
| Rehearsed (current, **expired**) bootstrap | `web/scripts/blsh/nativeProcessCaptureBootstrap.ts` sha256 `d4d2fcac52ffd272307b97bcbe79a008d888f7ee05f96526888cdcea2a34c97f` |
| Runner / adapter | `5ef3a631…94099eb` / `0162fb52…c5368`. All 9 runtime roles match (`PIN-RECHECK.json`) |
| Pin state at HEAD in `PIN-RECHECK.json` | 17/19 source and 8/8 evidence pins match. The 2 drifted UI pins (`BlshTradeComparison`, `adc77310d`) are re-verified and are not on the capture path |
| **Successor candidate** | **Does not exist yet.** Its runner, adapter and bootstrap hashes must replace the three above before approval |
| Rehearsal | `REHEARSAL.md`; `rehearsal/RESULTS.jsonl` sha256 `8592d13a4fa0ed9585dcd235ca70261e500e7d3347ece18a3706b59c510fe5bd`; `verify-packet.mjs` `7816ec6a…a9f565`; `rehearse.ts` `e01f8772…69ba9`; `run-rehearsal.sh` `02318b14…a2525` |
| Contract check | `DATA-CONTRACT.md`; `cohort/COHORT-RESULT-five.json`, `COHORT-RESULT-all.json`; `cohort-check.ts` `9fdfa1e8…d6a1ac`; 9 contract suites, 328 passed / 110 opt-in skipped |

## 3. Sources, calls and duration (unchanged design, successor date)

These are the only remote operations, run with concurrency one, zero retries and zero redirects:
1. GET `https://api-web.nhle.com/v1/schedule/<date>`
2. POST `…fyhftlxokyjtpndbkfse.supabase.co/rest/v1/rpc/nst_admit_attempt_v1`
3. GET NST individual (`stdoi=std`, `fd=td=<date>`)
4. POST admission again
5. GET NST on-ice (`stdoi=oi`)

Limits:
- **Maximum 5 HTTP attempts**, including failures.
- **Maximum 2 production writes**: legacy admission transactions, which can update `last_untracked_at` and the permit state even on a denial.
- At least 22 s between NST calls; NST limits 40/1m, 80/5m, 100/15m and 180/h hold across all callers.
- **120 s maximum work**; 15 s per provider call; 5 s per admission call.
- Existing disabled lifecycle mode only. No flag change, browser service or query-key fallback.

Approved sources still needed: the NHL schedule endpoint, the two fixed NST URLs and the production admission RPC, all in `PILOT-AUTHORIZATION.md` (frozen URL shape; only the date changes).

## 4. Output, retention and verification

- **Written to:** one new private directory under `/Users/tim/Library/Application Support/` (0700 parent), for example `fhfh-blsh-native-20261117T140500Z`. It is created by the runner at 0700, with files at 0600, and is never pre-created. Retained privately and never committed, uploaded or deleted until disposition.
- **Independent verifier:** **Claude Chef (this lane).** If TJ is not the operator, Scout verifies instead; the operator never verifies their own run. The verifier runs `verify-packet.mjs <dir> <successor-pins.json>` offline, then do a manual credential and privacy review. A run must not be verified by its own operator.

## 5. Abort criteria (any one ends the run; no retry, re-poll, second process or changed date)

- Any pin, runtime, project, mode, slot, path or receipt mismatch before transport.
- Schedule absent, empty, ambiguous or duplicate-keyed, wrong season or type, or any game not `OFF`/`FINAL` with state `OK`: stop before NST admission.
- An admission that is denied, invalid or expired: no NST GET.
- An HTTP, TLS, redirect, shape, timeout, byte-cap, row-cap or fsync failure, or any uncertain transport.
- An operator seeing unexpected NST, DB or incident activity at slot time.
- Any operation STARTED without SETTLED afterwards: count it as **possibly dispatched**, never as unsent.

## 6. What counts as what

| Class | Outputs |
| --- | --- |
| **Qualified evidence** | **None from this pilot as built.** It needs the B2 bridge, TLS provenance, per-player official frames, an independent review and a non-empty acceptance policy. Only then can a verified packet become a *candidate* native-input acceptance for one date |
| **Diagnostic** | A `complete_pending_review` packet that passes `verify-packet.mjs`: it proves transport, redaction, parser shape, URL scope, finality, spacing and fail-closed retention on real responses. Also: FAILED or partial packets and operation journals |
| **Stays gated even if it passes** | Public BLSH preview and trade page (production 404); arm-C method admission (arm A + overlay remains the recorded display decision); acceptance policy; snapshot activation or refresh; forecasts and scores; any price, discount or market claim; ledger changes; flags; deploys |

## 7. Approval wording (fill in only after B1, B3 and B4 close)

> Approve one BLSH native-input pilot operated by **[operator]**, starting in **[slot] UTC ([ET])**, using bootstrap sha256 **[successor]**, runner **[…]**, adapter **[…]**, source date **[date]**, output **[path]**, disabled lifecycle mode, at most five ordered HTTP attempts including at most two production admission transactions, no retries, verified independently by **[verifier]**. This approval authorizes nothing else.

No live capture, outreach, provider or production call, ledger write, refresh, push, deploy or flag change was made in preparing this packet.
