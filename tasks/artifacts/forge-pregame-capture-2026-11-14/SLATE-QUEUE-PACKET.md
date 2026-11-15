# FORGE pregame slate queue — decision packet and run plan (step 4)

**Status: built and rehearsed offline only.** Nothing is hosted, scheduled, flagged, deployed or applied. `--execute` exists but has not been run, and nothing here touched the network, credentials or production. Tonight's live pilot (§5) needs TJ's run approval on a clean export, which Chef brings.

## 0. TJ's decisions (2026-11-15)

| Question | Decision |
|---|---|
| Hosting | **Operator Mac** (`operator/launch-slate.sh`). No cron, no Vercel route. |
| Pilot | **Tonight:** `2026020329` + `2026020330`, both 02:00Z (T−60 01:00Z) |
| Stop rules | Built **before** the pilot (§3) |
| Postponed or removed games | **Record `never_dispatched`** (closes that game for `pregame-native-v1` permanently) |
| `claim_failed` with no claim found | **Keep as is:** treated as ambiguous; closed only after the claim window; never re-claimed |
| Lead | **10 min** |
| Global sweep | **OK for the pilot** |

## 1. What was built

| Piece | File | What it does |
|---|---|---|
| Planner (pure) | `web/lib/projections/pregameCapture/slateQueue.ts` `planSlate` | Slate games + budget → one dispatch time per game, or a `never_dispatched` reason. |
| Executor | same file, `runSlate` | Runs the plan on an injected clock and calls `runPregameCapture` once per dispatch. Ends every game in one terminal outcome. Whole-queue stop rules. |
| Simulator (test/rehearsal only) | `slateSimulator.ts` | One `FakeCustodyDb` per game, a virtual timer clock, the fixture TSA, and a sweep that mirrors `forge_pregame_capture_sweep_v1`. |
| Script | `web/scripts/forge-pregame-slate.ts` | `--plan` (default; no env or network), `--rehearse` (offline; `fetch` trapped and counted), `--execute` (gated live run). |
| Launcher | `operator/launch-slate.sh` | Runs `gate.sh` first. Credentials go only into that process and are never printed. `caffeinate -i` keeps the Mac awake. |

No existing FORGE file was edited. The queue reuses `custody.ts`, `deadline.ts`, `runner.ts` (`captureDeps`, `httpTsaClient`) and `rpc.ts` (`supabaseCaptureRpc`) unchanged.

### Timing rules
- **Deadline:** T−60 of the *earliest* known start (scheduled, or a current start that moved earlier), from `deadline.ts`.
- **Latest safe dispatch:** `T−60 − requiredMs − readMs − skew`, which is **T−66 min 2 s** with the pilot budget. The pin runs before the claim and is not inside `requiredMs` (240 s).
- **Preferred dispatch:** the latest safe dispatch minus the lead (10 min), so about **T−76**.
- **Concurrency:** the cap is **2**. `--execute` refuses more. The cap is enforced on the live in-flight count, and a slot is held for pin + required = 6 min.
- **Stagger:** at least 30 s between dispatches. Simultaneous starts are scheduled backward, so dispatches only move earlier. If that would strand a game that still fits (late launch, gate delay), an earliest-deadline-first pass from now is used instead.
- **Games that can't fit:** past the latest safe dispatch, not `FUT`/`PRE`, removed, moved off the slate date, or held by the gate until too late. These are recorded `never_dispatched` with a null claim id and a reason. They are never claimed late, and `decideStart` is re-checked on the queue's clock just before every dispatch.

### Outcome guarantees
- **Lookup first:** on every (re-)entry, each game's (game, policy) is looked up before anything is dispatched. A prior outcome ends it; a prior claim is never claimed again.
- **No ambiguous mutation is retried.** A lost `never_dispatched` record is confirmed by lookup, not resent.
- **Re-dispatch** happens only where no claim can exist: a pin failure, or a definitive `binding_mismatch`. At most 2 attempts.
- **Orphans** wait until T−60 + 120 s, then the sweep runs (limit 100, at most 3 passes), and a lookup confirms.
- **Process death:**

  | Case | Result |
  |---|---|
  | Save response lost, process alive | Settled by claim id → **qualified** |
  | Save never commits, process alive | Fenced → **save_unknown** |
  | Process dies right after the claim | Re-entry, sweep → **save_unknown** |
  | Process dies after the save commits | Re-entry, sweep → **saved_without_valid_witness** |

  The sweep cannot qualify unwitnessed bytes, and re-entry does not resume verification, because that would no longer be an independent check.

## 2. `--execute` wiring

- **Gates** (`assertSlateLiveGates`). All are checked before anything is built:
  - `FORGE_PREGAME_CAPTURE_ENABLED="true"`;
  - `--approval` equals `FORGE_PREGAME_CAPTURE_APPROVAL`;
  - `--confirm-game-ids` equals the `--games` ids **exactly**: same set, no extras, no repeats;
  - `--slate-date`, and every game on it;
  - a 40-hex `--code-version`;
  - a `--tsa-profile` with a pinned policy;
  - `--out` is a new directory;
  - `--gate` is an existing file;
  - `--concurrency` ≤ 2.
- **Schedule check at launch:** a read-only schedule read must show the **same start** for every game as `--games`. Otherwise the run is refused before `--out` is created.
- **Per-game captures:** `runner.captureDeps`, with separate writer and verifier clients, the DigiCert TSA client, the native collector, and the pilot budget and transport limits (the same wiring as `runPrivatePregameCapture`).
- **Queue custody:** a third client, `supabaseCaptureRpc`, used for `lookup`, `recordOutcome` (`never_dispatched` only) and `sweep`.
- **Load gate:** `/bin/zsh operator/gate.sh` is run before every dispatch wave, with a 60 s timeout. Exit 0 is open; anything else is closed, with its stderr as the reason.
- **Schedule refresh:**
  - Read-only. It reads `games` (`id,date,seasonId,startTime`) and `roster_optimizer_team_games` (`source_game_id,team_id,start_time,game_status,schedule_status`) for **these ids only**.
  - Incomplete data throws, and the queue keeps its last schedule. An empty refresh is ignored.
  - Status mapping: a date other than the slate date → `MOVED`; a schedule status other than OK → `SCHEDULE:…`; otherwise the single `game_status`.
- **Receipts in `--out`** (mode 0700, files 0600). Metadata only; packets stay in custody:
  - `slate-events.jsonl`: plan, dispatch, terminal and stop events;
  - `slate-receipt.json`: per-game outcome, source, reason, claim id and dispatch times.

## 3. Stop rules (built; `runSlate` `stopRules`)

On the first trigger the queue:
1. stops dispatching;
2. records `never_dispatched` (`queue_stopped:<trigger>`) for every game not yet dispatched (permanent, per TJ);
3. lets in-flight captures finish;
4. settles every claim (lookup, then the sweep after T−60 + 120 s);
5. returns `stopped: { trigger, gameId, detail, at }`.

A claimed game is never abandoned.

| Trigger | Fires when |
|---|---|
| `ambiguous_game` | A capture ends without a confirmed outcome: ambiguous or lost claim, duplicate, settle failed, outcome not recorded, or the run threw |
| `save_unknown` | A capture records `save_unknown` |
| `source_failed_twice` | Two consecutive capture outcomes are `source_failed` (any other outcome resets the count) |
| `load_gate_closed_twice` | The gate is closed at two consecutive dispatch waves (an open check resets the count) |
| `gate_dns_failure` | Any closed gate whose reason is DNS (`cannot resolve`, `ENOTFOUND`, `EAI_AGAIN`, `getaddrinfo`): stops at once |
| `statement_timeout` | Any capture reason containing `57014` or `statement timeout` |

**Pilot risk:** the gate for the second game runs about 30 s after the first capture starts. `gate.sh` counts other active queries (> 5, or any > 10 s, means busy). If the first capture's reads trip it at two consecutive waves, the queue stops, and the second game is recorded `never_dispatched` permanently. One closed wave only delays it by 60 s.

## 4. Evidence (offline)

- `cd web && npx vitest run lib/projections/pregameCapture/slateQueue.test.ts scripts/forge-pregame-slate.test.ts`: 24/24 (20 queue, 4 script).
- `npm run typecheck` under the heavy lock: exit 0. The result is in the commit that adds this run plan.
- **Queue scenarios:**
  - 3 same-start games, cap 2: exactly 2 overlap, all qualified, acknowledgement ≤ T−60, none dispatched later than planned.
  - Start-time changes (earlier and still fits; no longer fits).
  - Late-added games.
  - Crashes between save and settle, and after the claim, with re-entry.
  - TSA outage; transport refusal; postponed game; slow pin.
  - Gate delay and gate blip.
  - Late planning with contention.
  - Lost claim response; lost `never_dispatched` response.
  - Pin re-dispatch; re-entry after completion.
- **One test per stop trigger,** including "not after one `source_failed`" and "the in-flight capture still finishes and the orphan is swept".
- **Invariant on every scenario:** exactly one recorded outcome per game, at most one claim call, at most one save.
- **`--rehearse`:** `networkAttempts: 0`. It covers 4 queue slates plus 12 execute-wiring checks:
  - six gate refusals before any part is built;
  - shell gate exit codes (open, busy, missing script);
  - both games qualified through `executeSlate`, with the real `scheduleReader` over a fake client;
  - schedule reads limited to the two tables;
  - receipts written with no packet bytes;
  - a closed gate stopping with zero claims;
  - a schedule that differs from `--games` refused.

**Not covered offline:**
- `buildLiveParts` itself: real Supabase clients, DigiCert, `gate.sh`/`pgpool.sh` against production. The one-game pilots exercised the same runner wiring (pilot 3 qualified).
- Real PostgREST latency, and the real sweep SQL (mirrored, not executed).
- **Refresh timing:** the schedule is re-read only at dispatch waves and once before settling.

## 5. Run plan for tonight (pilot)

**Games:** `2026020329` and `2026020330`. Slate date **2026-11-15 (ET)**. Puck drop **02:00:00Z / 21:00 ET**. **T−60 = 01:00:00Z / 20:00 ET**. Plan output (`--plan --now 2026-11-16T00:10:00Z`):

| Game | Planned dispatch | Latest safe dispatch | T−60 (ack deadline) | Slot |
|---|---|---|---|---|
| 2026020329 | **00:43:28Z / 19:43:28 ET** | 00:53:58Z / 19:53:58 ET | 01:00:00Z / 20:00:00 ET | 1 |
| 2026020330 | **00:43:58Z / 19:43:58 ET** | 00:53:58Z / 19:53:58 ET | 01:00:00Z / 20:00:00 ET | 0 |

- **Launch window:**
  - Launch after Chef's clean-export check and TJ's approval, at least 30 min after the approval (pilot rule), ideally **00:10–00:35Z (19:10–19:35 ET)**.
  - A later launch (up to about 00:53Z) still dispatches both at once, using the forward fallback.
  - Do not launch after 00:53Z: the queue would record both games `never_dispatched`.
- **Expected end:** about 00:50Z if both captures finish cleanly. If a claim is orphaned, the queue waits for the sweep at **01:02:01Z / 20:02:01 ET**.
- **Exact launch command** (TJ present; from the repository root; `<export>` is Chef's verified clean export; `<sha>` is its 40-hex commit; `<token>` is TJ's approval token; `<out>` is a new directory):

  ```
  tasks/artifacts/forge-pregame-capture-2026-11-14/operator/launch-slate.sh <export>/web <sha> 2026-11-15 <token> <out> 2026020329@2026-11-16T02:00:00Z,2026020330@2026-11-16T02:00:00Z
  ```

  This expands to `forge-pregame-slate.ts --execute --games … --confirm-game-ids 2026020329,2026020330 --slate-date 2026-11-15 --approval <token> --code-version <sha> --tsa-profile digicert-g4-v1 --out <out> --gate operator/gate.sh --concurrency 2`.
- **Before launch, stop if:**
  - `gate.sh` fails;
  - either game's start in `games` is not 02:00:00Z (the script refuses anyway);
  - the export is not the approved SHA;
  - it is past 00:53Z.
- **During the run:** the stop rules (§3) act automatically. The operator does not interrupt a running capture. If the process dies, re-launch with a **new** `--out`: re-entry looks up first and never re-claims.
- **After the run:** keep `slate-receipt.json` and `slate-events.jsonl`. Re-verify each qualified witness offline, as for pilot 3.

## 6. Still open (after the pilot)

- Hosting beyond the Mac (the `webhooks/` service) and a slate-scoped sweep RPC, which would need a migration.
- Whether a stop should leave undispatched games unrecorded, so they can be re-run, instead of recording `never_dispatched` (today: recorded, per TJ's removed-games decision).
