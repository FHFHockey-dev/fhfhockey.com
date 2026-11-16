# 2026-11-15 Claude — FORGE pregame slate queue (step 4, offline)

- **Scope:** pure planner + executor over `runPregameCapture`, simulator tests, `forge-pregame-slate.ts` (plan / --rehearse), SLATE-QUEUE-PACKET.md. Offline only. Started by Chef `local_e8064f61`.
- **Where:** octoberBranch, new files only. Claims are in CLAUDE-TO-CODEX.md `CLAUDE-FORGE-SLATE-QUEUE-CLAIM-20261115`; that file is left uncommitted because it holds other sessions' edits.
- **Commits:** 005ad051d (module + tests), ae3346d11 (script, packet, slot-choice fix), then the forward-fallback/typecheck-fix commit (see git log).
- **Checks:** vitest pregameCapture folder + script 147/147; npm run typecheck exit 0 (the first run failed on SimClock.drive narrowing; fixed).
- **Gotchas:**
  - Pin time is outside requiredMs, so the slot is held for 360 s.
  - The planner bug fixed: during a replan, a fallback candidate (start when a busy slot frees) beat a free slot at the preferred time.
  - FakeCustodyDb is single-game, so the sim routes by game id.
  - SQL sweep semantics mean a process death after the save ends saved_without_valid_witness.
- **Next:** TJ decisions in the packet §4. No live mode exists.

## Round 2 (Chef, TJ decisions, ~20:25Z): stop rules, --execute, launcher, run plan for 0329 + 0330
- Commits: 7039032b0 (stop rules), aedec2c0d (--execute + wiring rehearsal), then launcher + packet run plan.
- Checks: 161/161 in the capture folder + both scripts; --rehearse ok, networkAttempts 0, 12 execute-wiring checks.
- Gotchas:
  - The shell gate is real I/O, so in the rehearsal it runs once for real and the virtual run replays its answer.
  - A stop records never_dispatched (permanent) for undispatched games.
  - The gate for the second game runs while the first capture is in flight, which risks load_gate_closed_twice.
- Nothing live has run. Chef verifies the clean export and brings TJ the approval.
