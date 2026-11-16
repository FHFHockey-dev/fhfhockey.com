// @vitest-environment node
import { describe, expect, it } from "vitest";
import { DEFAULT_SLATE_SETTINGS, latestDispatchAtOf, planSlate, runSlate, slotOccupancyMs, type SlateGame, type SlateRunResult } from "./slateQueue";
import { minutes, SIM_BUDGET, SIM_POLICY, SlateSim } from "./slateSimulator";
import { parseInstantMicros } from "./time";

const START = "2026-11-21T00:30:00Z";
const START_MS = Date.parse(START);
const iso = (ms: number) => new Date(ms).toISOString();
const CONFIG = { budget: { ...SIM_BUDGET }, ...DEFAULT_SLATE_SETTINGS };
const game = (gameId: number, start = START, status = "FUT"): SlateGame => ({ gameId, slateDate: "2026-11-20", scheduledStart: start, status });

async function drive(sim: SlateSim, work: Promise<SlateRunResult>): Promise<SlateRunResult> {
  const run = await sim.clock.drive(work);
  if (!run.settled) throw new Error("executor stalled");
  return run.value;
}
const byId = (result: SlateRunResult) => Object.fromEntries(result.results.map((r) => [r.gameId, r]));
/** Witnessed acknowledgement bound for a qualified game is at or before T−60 of its (current) start. */
function ackWithinDeadline(sim: SlateSim, gameId: number) {
  const db = sim.db(gameId);
  const claim = [...db.claims.values()][0];
  const witness = db.witnesses.get(claim.id)!;
  return parseInstantMicros(witness.ackUpper) <= BigInt(Date.parse(db.game.scheduledStart) - minutes(60)) * BigInt(1000);
}

describe("slate planner (pure)", () => {
  it("staggers three simultaneous starts across a cap of 2 without overlapping a slot, all before the latest safe dispatch", () => {
    const now = START_MS - minutes(180);
    const plan = planSlate([game(1), game(2), game(3)], CONFIG, now);
    expect(plan.skipped).toEqual([]);
    expect(plan.dispatches).toHaveLength(3);
    const occupancy = slotOccupancyMs(SIM_BUDGET);
    const latest = latestDispatchAtOf(game(1), SIM_BUDGET);
    expect(latest).toBe(START_MS - minutes(60) - SIM_BUDGET.requiredMs - SIM_BUDGET.readMs - SIM_BUDGET.skewToleranceMs);
    for (const d of plan.dispatches) {
      expect(d.dispatchAt).toBeLessThanOrEqual(latest - DEFAULT_SLATE_SETTINGS.leadMs);
      expect(d.dispatchAt).toBeGreaterThanOrEqual(now);
    }
    const times = plan.dispatches.map((d) => d.dispatchAt).sort((a, b) => a - b);
    for (let i = 1; i < times.length; i++) expect(times[i] - times[i - 1]).toBeGreaterThanOrEqual(DEFAULT_SLATE_SETTINGS.staggerMs);
    for (const slot of [0, 1]) {
      const inSlot = plan.dispatches.filter((d) => d.slot === slot).map((d) => d.dispatchAt).sort((a, b) => a - b);
      for (let i = 1; i < inSlot.length; i++) expect(inSlot[i] - inSlot[i - 1]).toBeGreaterThanOrEqual(occupancy);
    }
  });

  it("never plans a late claim: past-deadline, non-pregame and over-capacity games are skipped with a reason", () => {
    const now = START_MS - minutes(68);
    const plan = planSlate([game(1), game(2), game(3), game(4, iso(START_MS + minutes(120)), "PPD"), game(5, iso(START_MS - minutes(5)))],
      { ...CONFIG, concurrency: 1, leadMs: 0 }, now);
    const skipped = Object.fromEntries(plan.skipped.map((s) => [s.game.gameId, s.reason]));
    expect(skipped[4]).toBe("status:PPD");
    expect(skipped[5]).toBe("no_time_before_t_minus_60");
    expect(Object.values(skipped).filter((r) => r === "no_capacity_before_deadline")).toHaveLength(2);
    expect(plan.dispatches).toHaveLength(1);
    expect(plan.dispatches[0].dispatchAt).toBeLessThanOrEqual(plan.dispatches[0].latestDispatchAt);
  });

  it("planning late with contention still fits every game that can start as soon as possible (forward fallback)", () => {
    const now = START_MS - minutes(75);
    const plan = planSlate([game(1), game(2), game(3)], CONFIG, now);
    expect(plan.skipped).toEqual([]);
    expect(plan.dispatches).toHaveLength(3);
    for (const d of plan.dispatches) expect(d.dispatchAt).toBeLessThanOrEqual(d.latestDispatchAt);
  });

  it("uses the earliest known start (a reschedule earlier tightens the window) and rejects bad configuration", () => {
    const moved = { ...game(1), currentScheduledStart: iso(START_MS - minutes(30)) };
    const plan = planSlate([moved], CONFIG, START_MS - minutes(180));
    expect(plan.dispatches[0].deadlineMs).toBe(START_MS - minutes(90));
    expect(() => planSlate([game(1)], { ...CONFIG, budget: { ...SIM_BUDGET, requiredMs: 60_000 } }, 0)).toThrow("slate_budget_inconsistent");
    expect(() => planSlate([game(1), game(1)], CONFIG, 0)).toThrow("slate_duplicate_game");
    expect(() => planSlate([game(1)], { ...CONFIG, concurrency: 0 }, 0)).toThrow("slate_concurrency_out_of_range");
  });
});

describe("slate executor (simulated custody, virtual clock, fixture TSA)", () => {
  it("captures three games with the same start under a cap of 2: all qualified by T−60, never more than 2 in flight", async () => {
    const sim = new SlateSim(START_MS - minutes(180));
    // Long reads (110 s) so staggered captures genuinely overlap.
    for (const id of [1, 2, 3]) sim.addGame({ gameId: id, start: START }, { readMs: 110_000 });
    const result = await drive(sim, runSlate(sim.executorDeps(), sim.slate()));
    expect(result.unresolved).toEqual([]);
    expect(result.results.map((r) => r.outcome)).toEqual(["qualified", "qualified", "qualified"]);
    expect(sim.maxInFlight).toBe(2);
    // Re-planning around a running capture never pushes a game past its planned dispatch.
    for (const r of result.results) expect(r.dispatchedAt[0]).toBeLessThanOrEqual(r.plannedDispatchAt!);
    expect(result.maxInFlight).toBe(2);
    for (const id of [1, 2, 3]) expect(ackWithinDeadline(sim, id)).toBe(true);
    expect(sim.invariants()).toEqual([]);
  });

  it("a schedule read that ends after a dispatch instant never pushes the due game behind a later one (pilot 0329/0330)", async () => {
    // Live pilot: the wave's schedule read finished 325 ms after 0329's slot, the re-plan saw its preferred time as past and
    // the stagger pushed it 60 s, behind 0330. Unchanged reads must keep the plan; a changed read must keep the due game's turn.
    for (const lateAdd of [false, true]) {
      const sim = new SlateSim(START_MS - minutes(180));
      for (const id of [329, 330]) sim.addGame({ gameId: id, start: START }, { readMs: 110_000 });
      const deps = sim.executorDeps({ refreshSlate: async () => { await sim.clock.sleep(325); return sim.slate(); } });
      const planned = Object.fromEntries(planSlate(sim.slate(), deps.config, sim.clock.ms).dispatches.map((d) => [d.game.gameId, d.dispatchAt]));
      expect(planned[330] - planned[329]).toBe(DEFAULT_SLATE_SETTINGS.staggerMs);
      if (lateAdd) void sim.clock.until(planned[329]).then(() => { sim.addGame({ gameId: 331, start: iso(START_MS + minutes(60)) }); });
      const result = byId(await drive(sim, runSlate(deps, sim.slate())));
      expect(result[329].dispatchedAt[0]).toBeLessThanOrEqual(planned[329] + 1_000);
      expect(result[330].dispatchedAt[0]).toBeGreaterThan(result[329].dispatchedAt[0]);
      expect(result[330].dispatchedAt[0]).toBeLessThanOrEqual(planned[330] + 1_000);
      expect(sim.maxInFlight).toBe(2);
      if (lateAdd) expect(result[331].outcome).toBe("qualified");
      for (const id of [329, 330]) expect(result[id].outcome).toBe("qualified");
      expect(sim.invariants()).toEqual([]);
    }
  });

  it("re-plans a start-time change after planning: an earlier start that still fits is captured early; one that no longer fits is never claimed", async () => {
    const sim = new SlateSim(START_MS - minutes(180));
    sim.addGame({ gameId: 1, start: START });
    sim.addGame({ gameId: 2, start: iso(START_MS + minutes(60)) });
    sim.addGame({ gameId: 3, start: iso(START_MS + minutes(60)) });
    const deps = sim.executorDeps();
    const initial = planSlate(sim.slate(), deps.config, sim.clock.ms);
    const originalPlan2 = initial.dispatches.find((d) => d.game.gameId === 2)!.dispatchAt;
    // After planning, before game 1's wave: game 2 moves 30 min earlier; game 3 moves to puck drop in 70 minutes.
    void sim.clock.until(START_MS - minutes(100)).then(() => {
      sim.moveStart(2, iso(START_MS + minutes(30)));
      sim.moveStart(3, iso(sim.clock.ms + minutes(70)));
    });
    const result = byId(await drive(sim, runSlate(deps, sim.slate())));
    expect(result[1].outcome).toBe("qualified");
    expect(result[2].outcome).toBe("qualified");
    expect(result[2].dispatchedAt[0]).toBeLessThan(originalPlan2);
    expect(ackWithinDeadline(sim, 2)).toBe(true);
    expect(result[3]).toMatchObject({ outcome: "never_dispatched", source: "queue", claimId: null });
    expect(result[3].reason).toBe("no_time_before_t_minus_60");
    expect(sim.claimCalls(3)).toBe(0);
    expect(sim.invariants()).toEqual([]);
  });

  it("picks up a late-added game on refresh, and records never_dispatched for one added too late to fit", async () => {
    const sim = new SlateSim(START_MS - minutes(180));
    sim.addGame({ gameId: 1, start: START });
    sim.addGame({ gameId: 2, start: iso(START_MS + minutes(30)) });
    const deps = sim.executorDeps();
    const initialSlate = sim.slate();
    void sim.clock.until(START_MS - minutes(90)).then(() => {
      sim.addGame({ gameId: 4, start: iso(START_MS + minutes(60)) });
      sim.addGame({ gameId: 5, start: iso(sim.clock.ms + minutes(62)) });
    });
    const result = byId(await drive(sim, runSlate(deps, initialSlate)));
    expect(result[4].outcome).toBe("qualified");
    expect(result[5]).toMatchObject({ outcome: "never_dispatched", source: "queue" });
    expect(sim.claimCalls(5)).toBe(0);
    expect(sim.invariants()).toEqual([]);
  });

  it("settles a save whose response was lost in-process by claim id: one save, settled, qualified", async () => {
    const sim = new SlateSim(START_MS - minutes(180));
    sim.addGame({ gameId: 1, start: START }, { saveResponseLost: true });
    const result = byId(await drive(sim, runSlate(sim.executorDeps(), sim.slate())));
    expect(result[1].outcome).toBe("qualified");
    expect(sim.db(1).calls).toContain("settle");
    expect(sim.invariants()).toEqual([]);
  });

  it("after a process death between save and settle, re-entry never re-claims; the sweep closes it from custody state", async () => {
    const sim = new SlateSim(START_MS - minutes(180));
    sim.addGame({ gameId: 1, start: START }, { killAt: "after_save_commit" });
    sim.addGame({ gameId: 2, start: START }, { killAt: "save_never_commits" });
    const first = await sim.clock.drive(runSlate(sim.executorDeps(), sim.slate()));
    expect(first.settled).toBe(false); // the process hung with both captures in flight
    sim.clock.kill();
    expect(sim.db(1).artifacts.size).toBe(1);
    expect(sim.db(2).artifacts.size).toBe(0);
    sim.scenarios.set(1, {});
    sim.scenarios.set(2, {});
    const result = byId(await drive(sim, runSlate(sim.executorDeps(), sim.slate())));
    // Committed bytes without a witness: saved_without_valid_witness (the sweep cannot qualify an unwitnessed save).
    expect(result[1]).toMatchObject({ outcome: "saved_without_valid_witness", source: "sweep" });
    // Nothing committed: fenced and save_unknown.
    expect(result[2]).toMatchObject({ outcome: "save_unknown", source: "sweep" });
    expect(sim.db(2).fences.size).toBe(1);
    for (const id of [1, 2]) expect(sim.claimCalls(id)).toBe(1);
    // Swept only after T−60 + grace.
    expect(sim.clock.ms).toBeGreaterThan(START_MS - minutes(60) + 120_000);
    expect(sim.invariants()).toEqual([]);
  });

  it("after a process death right after the claim, re-entry looks the claim up and never claims again", async () => {
    const sim = new SlateSim(START_MS - minutes(180));
    sim.addGame({ gameId: 1, start: START }, { killAt: "after_claim" });
    sim.addGame({ gameId: 2, start: iso(START_MS + minutes(120)) });
    const first = await sim.clock.drive(runSlate(sim.executorDeps(), [sim.slate()[0]]));
    expect(first.settled).toBe(false);
    sim.clock.kill();
    sim.scenarios.set(1, {});
    const result = byId(await drive(sim, runSlate(sim.executorDeps(), sim.slate())));
    expect(result[1]).toMatchObject({ outcome: "save_unknown", source: "sweep" });
    expect(result[1].dispatches).toBe(0);
    expect(result[2].outcome).toBe("qualified");
    expect(sim.claimCalls(1)).toBe(1);
    expect(sim.invariants()).toEqual([]);
  });

  it("ends a mixed slate in exactly one outcome per game: TSA outage, transport refusal, postponement, slow pin", async () => {
    const sim = new SlateSim(START_MS - minutes(180));
    sim.addGame({ gameId: 1, start: START }, { tsaDown: true });
    sim.addGame({ gameId: 2, start: START }, { transportRefusal: "http_status:503" });
    sim.addGame({ gameId: 3, start: iso(START_MS + minutes(30)), status: "PPD" });
    sim.addGame({ gameId: 4, start: iso(START_MS + minutes(30)) }, { pinMs: 110_000 });
    sim.addGame({ gameId: 5, start: iso(START_MS + minutes(30)) });
    const result = byId(await drive(sim, runSlate(sim.executorDeps({ config: { ...CONFIG, leadMs: 0 } }), sim.slate())));
    expect(result[1]).toMatchObject({ outcome: "saved_without_valid_witness", source: "capture" });
    expect(result[1].reason).toContain("tsa_failed:ECONNRESET");
    expect(result[2]).toMatchObject({ outcome: "source_failed", source: "capture", reason: "transport_refused:http_status:503" });
    expect(sim.saveCalls(2)).toBe(0);
    expect(result[3]).toMatchObject({ outcome: "never_dispatched", source: "queue", reason: "status:PPD" });
    expect(sim.db(3).outcomes.get(`3/${SIM_POLICY}`)?.claimId).toBeNull();
    expect(result[4].outcome).toBe("qualified"); // a 110 s pin is outside requiredMs and still fits with zero lead
    expect(result[5].outcome).toBe("qualified");
    expect(sim.invariants()).toEqual([]);
  });

  it("holds a dispatch behind a closed load gate, then dispatches; a gate that never opens ends never_dispatched", async () => {
    const sim = new SlateSim(START_MS - minutes(180));
    sim.addGame({ gameId: 1, start: START });
    sim.addGame({ gameId: 2, start: iso(START_MS + minutes(60)) });
    const openAt = START_MS - minutes(72); // planned dispatch is ~T−76 min
    const deps = sim.executorDeps({
      stopRules: { gateClosedInARow: Number.POSITIVE_INFINITY }, // this test exercises the per-game delay, not the stop rule
      loadGate: async (g) => (g.gameId === 2 ? { open: false, reason: "db_load_high" } : { open: sim.clock.ms >= openAt, reason: "db_load_high" }),
    });
    const result = byId(await drive(sim, runSlate(deps, sim.slate())));
    expect(result[1].outcome).toBe("qualified");
    expect(result[1].dispatchedAt[0]).toBeGreaterThanOrEqual(openAt);
    expect(result[1].dispatchedAt[0]).toBeGreaterThan(result[1].plannedDispatchAt!);
    expect(result[2]).toMatchObject({ outcome: "never_dispatched", reason: "load_gate_closed:db_load_high" });
    expect(sim.claimCalls(2)).toBe(0);
    expect(sim.invariants()).toEqual([]);
  });

  it("a load-gate blip during a contended wave delays dispatch without dropping any game", async () => {
    const sim = new SlateSim(START_MS - minutes(180));
    for (const id of [1, 2, 3]) sim.addGame({ gameId: id, start: START }, { readMs: 110_000 });
    const openAt = START_MS - minutes(76);
    const result = await drive(sim, runSlate(sim.executorDeps({ stopRules: { gateClosedInARow: Number.POSITIVE_INFINITY },
      loadGate: async () => ({ open: sim.clock.ms >= openAt, reason: "db_load_high" }) }), sim.slate()));
    expect(result.results.map((r) => r.outcome)).toEqual(["qualified", "qualified", "qualified"]);
    expect(Math.min(...result.results.map((r) => r.dispatchedAt[0]))).toBeGreaterThanOrEqual(openAt);
    expect(sim.maxInFlight).toBeLessThanOrEqual(2);
    expect(sim.invariants()).toEqual([]);
  });

  it("settles a lost claim response by lookup (never re-claimed) and a lost never_dispatched record by lookup (never resent)", async () => {
    const sim = new SlateSim(START_MS - minutes(180));
    sim.addGame({ gameId: 1, start: START }).hooks.afterClaimCommit = () => { throw new Error("fetch failed: socket hang up"); };
    sim.addGame({ gameId: 2, start: START, status: "PPD" }).hooks.afterOutcomeCommit = () => { throw new Error("fetch failed"); };
    const result = byId(await drive(sim, runSlate(sim.executorDeps(), sim.slate())));
    expect(result[1]).toMatchObject({ outcome: "save_unknown", source: "sweep" });
    expect(result[1].reports[0].reason).toBe("claim_ambiguous_left_for_sweeper");
    expect(sim.claimCalls(1)).toBe(1);
    expect(result[2]).toMatchObject({ outcome: "never_dispatched", source: "lookup", reason: "status:PPD" });
    expect(sim.db(2).calls.filter((c) => c === "recordOutcome")).toHaveLength(1);
    expect(sim.invariants()).toEqual([]);
  });

  it("re-dispatches after a pin failure (no claim exists) and does nothing on re-entry after the slate is complete", async () => {
    const sim = new SlateSim(START_MS - minutes(180));
    sim.addGame({ gameId: 1, start: START }, { pinFailures: 1 });
    const first = byId(await drive(sim, runSlate(sim.executorDeps(), sim.slate())));
    expect(first[1]).toMatchObject({ outcome: "qualified", dispatches: 2 });
    const again = byId(await drive(sim, runSlate(sim.executorDeps(), sim.slate())));
    expect(again[1]).toMatchObject({ outcome: "qualified", source: "prior_run", dispatches: 0 });
    expect(sim.claimCalls(1)).toBe(1);
    expect(sim.invariants()).toEqual([]);
  });
});

describe("slate executor stop rules (pause dispatch, settle every claim, stop)", () => {
  const later = iso(START_MS + minutes(120));
  async function stopRun(build: (sim: SlateSim) => void, overrides: Parameters<SlateSim["executorDeps"]>[0] = {}) {
    const sim = new SlateSim(START_MS - minutes(180));
    build(sim);
    const result = await drive(sim, runSlate(sim.executorDeps(overrides), sim.slate()));
    expect(sim.invariants()).toEqual([]);
    expect(result.unresolved).toEqual([]);
    return { sim, result, games: byId(result) };
  }

  it("stops on a save_unknown: later games are never dispatched", async () => {
    const { result, games, sim } = await stopRun((sim) => {
      sim.addGame({ gameId: 1, start: START }).hooks.beforeSave = () => { throw new Error("fetch failed: ETIMEDOUT"); };
      sim.addGame({ gameId: 2, start: later });
    });
    expect(result.stopped).toMatchObject({ trigger: "save_unknown", gameId: 1 });
    expect(games[1].outcome).toBe("save_unknown");
    expect(games[2]).toMatchObject({ outcome: "never_dispatched", source: "queue", reason: "queue_stopped:save_unknown" });
    expect(sim.claimCalls(2)).toBe(0);
  });

  it("stops after two source_failed in a row, not after one", async () => {
    const { result, games } = await stopRun((sim) => {
      sim.addGame({ gameId: 1, start: START }, { transportRefusal: "http_status:503" });
      sim.addGame({ gameId: 2, start: iso(START_MS + minutes(30)) }, { transportRefusal: "http_status:503" });
      sim.addGame({ gameId: 3, start: later });
    });
    expect(result.stopped).toMatchObject({ trigger: "source_failed_twice", gameId: 2 });
    expect([games[1].outcome, games[2].outcome]).toEqual(["source_failed", "source_failed"]);
    expect(games[3].reason).toBe("queue_stopped:source_failed_twice");
    const once = await stopRun((sim) => {
      sim.addGame({ gameId: 1, start: START }, { transportRefusal: "http_status:503" });
      sim.addGame({ gameId: 2, start: later });
    });
    expect(once.result.stopped).toBeNull();
    expect(once.games[2].outcome).toBe("qualified");
  });

  it("stops on a statement-timeout refusal (57014)", async () => {
    const { result, games } = await stopRun((sim) => {
      sim.addGame({ gameId: 1, start: START }, { transportRefusal: "http_status:500:57014 canceling statement due to statement timeout" });
      sim.addGame({ gameId: 2, start: later });
    });
    expect(result.stopped).toMatchObject({ trigger: "statement_timeout", gameId: 1 });
    expect(games[1].outcome).toBe("source_failed");
    expect(games[2].reason).toBe("queue_stopped:statement_timeout");
  });

  it("stops when the load gate is closed at two consecutive dispatch waves, and at once on a DNS failure", async () => {
    const closed = await stopRun((sim) => {
      sim.addGame({ gameId: 1, start: START });
      sim.addGame({ gameId: 2, start: later });
    }, { loadGate: async () => ({ open: false, reason: "GATE FAIL: busy (active=9 longest=12s lock_waits=0)" }) });
    expect(closed.result.stopped).toMatchObject({ trigger: "load_gate_closed_twice", gameId: 1 });
    expect(closed.games[1]).toMatchObject({ outcome: "never_dispatched", reason: "queue_stopped:load_gate_closed_twice", dispatches: 0 });
    expect(closed.games[2].reason).toBe("queue_stopped:load_gate_closed_twice");
    let checks = 0;
    const dns = await stopRun((sim) => { sim.addGame({ gameId: 1, start: START }); },
      { loadGate: async () => { checks += 1; return { open: false, reason: "GATE FAIL: cannot resolve db.example.supabase.co" }; } });
    expect(dns.result.stopped).toMatchObject({ trigger: "gate_dns_failure" });
    expect(checks).toBe(1);
    expect(dns.games[1].dispatches).toBe(0);
  });

  it("stops on an ambiguous game but never abandons claims: the in-flight capture finishes and the orphan is swept", async () => {
    const { result, games, sim } = await stopRun((sim) => {
      // Game 1 dispatches first (stagger) and is still reading when game 2's claim response is lost.
      sim.addGame({ gameId: 1, start: START }, { readMs: 110_000 });
      sim.addGame({ gameId: 2, start: START }).hooks.afterClaimCommit = () => { throw new Error("fetch failed: socket hang up"); };
      sim.addGame({ gameId: 3, start: later });
    });
    expect(result.stopped).toMatchObject({ trigger: "ambiguous_game", gameId: 2 });
    expect(games[1].outcome).toBe("qualified");
    expect(games[1].dispatchedAt[0]).toBeLessThan(result.stopped!.at);
    expect(games[2]).toMatchObject({ outcome: "save_unknown", source: "sweep" });
    expect(games[3]).toMatchObject({ outcome: "never_dispatched", reason: "queue_stopped:ambiguous_game" });
    expect(sim.claimCalls(2)).toBe(1);
  });
});
