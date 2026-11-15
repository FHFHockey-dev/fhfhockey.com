# FORGE pregame slate queue — decision packet (step 4)

**Status: built and tested offline only.** Nothing is hosted, scheduled, flagged, deployed or applied. There is no live mode: `forge-pregame-slate.ts --execute` is refused by the parser. Everything below that would run against production is a decision for TJ.

## 1. What was built

| Piece | File | What it does |
|---|---|---|
| Planner (pure) | `web/lib/projections/pregameCapture/slateQueue.ts` `planSlate` | Slate games + budget → one dispatch time per game, or a `never_dispatched` reason. |
| Executor | same file, `runSlate` | Runs the plan on an injected clock and calls `runPregameCapture` once per dispatch. Ends every game in one terminal outcome. |
| Simulator (test/rehearsal only) | `slateSimulator.ts` | One `FakeCustodyDb` per game, a virtual timer clock, the fixture TSA, and a sweep that mirrors `forge_pregame_capture_sweep_v1`. |
| Tests | `slateQueue.test.ts` (12), `web/scripts/forge-pregame-slate.test.ts` (3) | See §3. |
| Script | `web/scripts/forge-pregame-slate.ts` | `--plan` (default; no env, credentials or network) and `--rehearse` (offline; `fetch` trapped and counted). |

No existing FORGE file was edited. The queue reuses `custody.ts`, `deadline.ts` (`ackDeadlineMicros`, `decideStart`) and the `CaptureRpc` contract unchanged.

### Timing rules
- **Deadline:** T−60 of the *earliest* known start (scheduled or a rescheduled-earlier current start), from `deadline.ts`.
- **Latest safe dispatch:** `T−60 − requiredMs − readMs − skew`. The pin runs **before** the claim and is not inside `requiredMs` (240 s), so the queue reserves pin time (≤ 120 s) on top. With the pilot budget, that is T−66 min 2 s.
- **Preferred dispatch:** latest safe dispatch − lead (default 10 min, so about T−76).
- **Concurrency cap** (default 2): enforced on live in-flight count, not only on the plan. A worker slot is held for pin + required = 6 min.
- **Stagger:** at least 30 s between any two dispatches. Simultaneous starts are scheduled backward, so a busy slot only ever moves a dispatch **earlier**.
- **Late planning:** if the backward pass would strand a game that still fits (late planning, a gate delay), an earliest-deadline-first pass from now is used instead, provided it strands fewer games.
- **Can't fit:** a game that can't fit (past the latest safe dispatch, no free slot, not `FUT`/`PRE`, removed from the slate, load gate never opens) is recorded `never_dispatched` by the queue with a null claim id and a reason. It is never claimed late.
- **Last check before dispatch:** the queue applies `decideStart` again on its own clock, so a late claim is never even attempted.

### Outcome guarantees
- **Re-entry looks up first.** Every game's (game, policy) is looked up before anything is dispatched. A prior outcome ends it; a prior claim is never claimed again.
- **No ambiguous mutation is retried.** Claim, save and outcome follow `runPregameCapture`'s rules. A queue `never_dispatched` record whose response is lost is confirmed by lookup, not resent.
- **Re-dispatch** happens only where no claim can exist: a pin failure, or a definitive `binding_mismatch` refusal. Up to 2 attempts, and only while the game still fits.
- **Orphans** (ambiguous claim, duplicate, unsettled save, a capture that threw, an outcome not recorded) wait until T−60 + grace (120 s; the SQL needs at least 60 s). The queue then calls the sweep (limit 100, at most 3 passes) and confirms by lookup.
- **"No claim" ends** (`no_claim_after_window`): a game is closed `never_dispatched` this way only after the claim window has closed. The database refuses that record if any claim exists.

### Process death: in-process vs re-entry
| Case | Result |
|---|---|
| Save response lost, process alive | Settled by claim id → **qualified** (one save) |
| Save never commits, process alive | Fenced → **save_unknown** |
| Process dies right after the claim | Re-entry: no new claim; sweep → **save_unknown** |
| Process dies after the save commits, before settle | Re-entry: no new claim; sweep → **saved_without_valid_witness** |

The last row differs from "save_unknown or settled qualified" on purpose. The SQL sweep cannot qualify bytes that were never witnessed, and re-entry does not resume verification: that would need the in-memory packet hashes, so it would no longer be an independent check.

## 2. Hosting options (decision for TJ)

All three run the same `runSlate`. What differs is how long one process lives. A slate needs its process alive from the first dispatch (about T−76 of the earliest game) through the last game's T−60 + grace (sweep wait). That is often 4–6 hours.

| | **A. Operator Mac (recommended first)** | B. `webhooks/` long-running service | C. Vercel cron route |
|---|---|---|---|
| Fits one-process lifetime | Yes, with `caffeinate`, like the pilots | Yes | **No.** `web/vercel.json` caps `pages/api/**` at `maxDuration: 240` s. One capture needs up to 360 s (pin + 240 s). The queue would have to be re-entered by many cron ticks (lookup-first re-entry makes that safe), with one capture per invocation and a stage per tick. |
| Vercel cost | None | None (separate host; check its plan) | Runtime billed per tick (function duration × memory), plus one deployment to add the route. AGENTS.md treats both as costly. |
| Credentials | `web/.env.local`, read by `operator/launch-capture.sh` for that process only (pilot pattern) | Service-role key stored on that host: a new standing secret | Already in Vercel env, but it would then run unattended in production |
| Network gate | `operator/gate.sh` (DNS + load) can run before each dispatch as the load gate | Needs its own gate | Needs its own gate |
| Attendance | Attended or semi-attended; Mac sleep/DNS is the risk (pilot 2 stopped on local DNS) | Unattended | Unattended |

### Database load (all options)
The production DB has been overloaded before (Lines P3, 2026-11-07, twice). Each capture is roughly the one-game pilot's read set: up to 600 calls, 96 MB cap, 120 s.
- The cap of 2 bounds concurrent read load to about 2× one pilot.
- The 30 s stagger keeps pins and claims apart.
- Every PostgREST call is still bound by the **8 s statement timeout**. Pilot 1 failed `source_failed` on exactly this (trend bands, now fixed). A slow DB therefore shows up as `source_failed`, not as a hang.
- The load gate is checked before **every** dispatch. A closed gate delays the dispatch while it still fits, then ends `never_dispatched: load_gate_closed:<reason>`.
- Proposal: back the gate with the same signal `gate.sh` uses.

## 3. Evidence (offline)

`cd web && npx vitest run lib/projections/pregameCapture/slateQueue.test.ts scripts/forge-pregame-slate.test.ts`: 18/18. `npm run typecheck` (under the heavy lock): result in the final commit message.

**Scenarios covered:**
- 3 games at the same start, cap 2. Two captures genuinely overlap (max in flight is exactly 2), all qualified, each acknowledgement ≤ T−60, and none dispatched later than planned.
- A start-time change after planning:
  - 30 min earlier → re-planned and qualified early;
  - moved to 70 min out → `never_dispatched`, zero claim calls.
- A late-added game picked up on refresh. One added too late → `never_dispatched`.
- Crash between save and settle: in-process → qualified; process death → re-entry → sweep.
- Crash after the claim, with re-entry: one claim call in total → `save_unknown`.
- TSA outage → `saved_without_valid_witness`. Transport refusal → `source_failed`, no save. Postponed → `never_dispatched` with a null claim id. A 110 s pin with zero lead still qualifies.
- Load gate: closed then open → dispatched later. Never open → `never_dispatched`. A gate blip during a contended wave (3 games, cap 2) drops no game.
- Late planning with contention (3 same-start games, planned at T−75) fits all three.
- A lost claim response is found by lookup (one claim call; sweep → `save_unknown`). A lost `never_dispatched` record response is confirmed by lookup, not resent.
- A pin failure is re-dispatched. Re-running a finished slate does nothing (all `prior_run`, no new claim).
- **Invariant on every scenario:** exactly one recorded outcome per game, at most one claim call, and at most one save.

`--rehearse` runs three of these slates through the same path and reports `networkAttempts: 0`.

**Not covered:**
- Real PostgREST latency, the real schedule source for `refreshSlate`, a real load-gate signal, and the real sweep SQL (mirrored, not executed).
- The `no_claim_after_window`, `run_threw` and failed-lookup branches have no dedicated test.
- **Refresh timing:** the schedule is re-read only at a dispatch wave and once before settling. An earlier reschedule or a late add for the first or only game is not seen before that game's original dispatch time, by which point it may no longer fit.
- **Short refresh:** an empty refresh is ignored. A refresh that succeeds but omits a pending game closes it as `removed_from_slate` permanently (see the postponed/removed question in §4).

## 4. Decisions for TJ

1. **Hosting:** A (operator Mac) for the queue pilot, B later if it proves out, C not recommended (240 s cap and per-tick cost). *(Recommended: A.)*
2. **Credentials:** same as the pilots. The service-role key is read from `web/.env.local` into that process only, never printed. No new standing secret until hosting moves off the Mac.
3. **Schedule:**
   - **Launch:** the queue is launched once per slate by the operator, about 30 min before the earliest game's preferred dispatch (about T−106 of the first puck drop).
   - **Lifetime:** it runs until the last game's T−60 + 2 min.
   - **Refreshes:** the schedule is re-read before each dispatch wave and once before settling.
   - No cron.
4. **Pilot subset:** 2–3 games of one slate, ideally 2 with the **same start**, to exercise the cap and stagger, plus 1 later game.
5. **Stop conditions (whole queue). PROPOSED, NOT BUILT:** `runSlate` implements only the per-game rules above. These would be added before a live queue:
   - **Pause dispatch on any of:**
     - an unresolved game;
     - a `save_unknown`;
     - two `source_failed` in a row;
     - a closed load gate at two consecutive dispatches;
     - DNS failure in the gate;
     - a statement-timeout (57014) refusal.
   - **Then:** finish resolution (lookup and sweep) and stop. Captures already claimed are never abandoned.
6. **Open questions:**
   - **Global sweep:** `forge_pregame_capture_sweep_v1` closes *any* orphaned claim past its deadline, not just this slate's (limit 100). Acceptable, or should a slate-scoped sweep RPC be added (needs a migration)?
   - **Postponed or removed games:** recording `never_dispatched` closes that (game, policy) **permanently**. A postponed game replayed later under the same game id could not be captured under `pregame-native-v1`. Record it, or leave such games unrecorded?
   - **`claim_failed` with no claim found:** today the queue treats it as ambiguous and closes it only after the claim window. That costs the capture but is safe. A re-claim would be faster but retries a mutation whose server-side fate is unknown. *(Recommended: keep the current behaviour.)*
   - **Lead:** 10 min by default, so the dispatch is about T−76. The pilot packet only bounded launches at or before T−64. Keep 10?
