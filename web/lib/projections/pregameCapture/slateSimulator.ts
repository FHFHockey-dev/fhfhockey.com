/**
 * TEST/REHEARSAL-ONLY multi-game slate simulator. Never used by a live path.
 *
 * One FakeCustodyDb per game (the fixture is single-game and its claim ids restart at claim-1, so everything routes by
 * game id), a virtual timer clock shared by every game, synthetic strict reads, the fixture TSA, and a sweep that mirrors
 * forge_pregame_capture_sweep_v1 (migration 20261115000000): orphaned claims past ack_deadline + grace close as
 * qualified (qualified witness), saved_without_valid_witness (artifact present) or save_unknown (fenced, nothing saved).
 */
import { runPregameCapture, type CaptureBudget, type CaptureDeps } from "./custody";
import { dbText, FakeClock, FakeCustodyDb } from "./__fixtures__/fakeCustody";
import { mintTimeStampResponse, testTsaTrust } from "./__fixtures__/testTsa";
import type { CaptureRpc, SweepRow } from "./rpc";
import { MICROS_PER_MS } from "./time";
import { DEFAULT_SLATE_SETTINGS, type SlateCustody, type SlateExecutorDeps, type SlateGame } from "./slateQueue";

export const SIM_POLICY = "pregame-native-v1";
/** Same numbers as the pilot budget (forge-pregame-capture.ts PILOT_BUDGET). */
export const SIM_BUDGET: CaptureBudget = { readMs: 120_000, saveWaitMs: 20_000, tsaTimeoutMs: 10_000, skewToleranceMs: 2_000, rpcMs: 10_000, requiredMs: 240_000 };
const MIN = 60_000;
const REV = "c".repeat(64);
const macrotask = () => new Promise<void>((resolve) => setImmediate(resolve));
const forever = () => new Promise<never>(() => {});

/** Virtual time: sleeps register timers; drive() fires them in order once all in-flight work has gone idle. */
export class SimClock extends FakeClock {
  private timers: Array<{ at: number; seq: number; resolve: () => void }> = [];
  private seq = 0;
  until(at: number): Promise<void> {
    return new Promise((resolve) => { this.timers.push({ at: Math.max(at, this.ms), seq: this.seq++, resolve }); });
  }
  sleep(ms: number) { return this.until(this.ms + ms); }
  /** A killed process: its pending timers never fire. */
  kill() { this.timers = []; }
  /** Runs `work` to completion in virtual time. Returns settled:false if it stalls with no timer left (a hung/killed process). */
  async drive<T>(work: Promise<T>): Promise<{ settled: true; value: T } | { settled: false }> {
    let state: { done: false } | { done: true; value?: T; error?: unknown; failed: boolean } = { done: false };
    work.then((value) => { state = { done: true, value, failed: false }; }, (error) => { state = { done: true, error, failed: true }; });
    for (let fired = 0; fired < 100_000; fired++) {
      await macrotask(); await macrotask();
      if (state.done) {
        if (state.failed) throw state.error;
        return { settled: true, value: state.value as T };
      }
      if (!this.timers.length) return { settled: false };
      this.timers.sort((a, b) => a.at - b.at || a.seq - b.seq);
      const next = this.timers.shift()!;
      this.ms = Math.max(this.ms, next.at);
      next.resolve();
    }
    throw new Error("sim_runaway");
  }
}

export interface SimScenario {
  pinMs?: number; readMs?: number;
  tsaDown?: boolean;
  transportRefusal?: string;
  /** In-process: the save commits but its response is lost (custody settles by claim id). */
  saveResponseLost?: boolean;
  /** Process death: right after the claim commits, right after the save commits, or while the save never commits. */
  killAt?: "after_claim" | "after_save_commit" | "save_never_commits";
  pinFailures?: number;
}

export interface SimGameSpec { gameId: number; start: string; status?: string; slateDate?: string }

export class SlateSim {
  readonly clock: SimClock;
  readonly dbs = new Map<number, FakeCustodyDb>();
  readonly scenarios = new Map<number, SimScenario>();
  readonly status = new Map<number, string>();
  readonly slateDates = new Map<number, string>();
  /** Game ids the schedule source currently lists (refreshSlate reads this). */
  readonly listed = new Set<number>();
  inFlight = 0;
  maxInFlight = 0;

  constructor(nowMs: number) { this.clock = new SimClock(nowMs); }

  addGame(spec: SimGameSpec, scenario: SimScenario = {}): FakeCustodyDb {
    const db = new FakeCustodyDb(this.clock, { gameId: spec.gameId, scheduledStart: spec.start, homeTeamId: 6, awayTeamId: 30, homeAbbrev: "BOS", awayAbbrev: "MIN" });
    this.dbs.set(spec.gameId, db);
    this.scenarios.set(spec.gameId, scenario);
    this.status.set(spec.gameId, spec.status ?? "FUT");
    this.slateDates.set(spec.gameId, spec.slateDate ?? "2026-11-20");
    this.listed.add(spec.gameId);
    return db;
  }
  db(gameId: number): FakeCustodyDb {
    const db = this.dbs.get(gameId);
    if (!db) throw new Error(`sim_unknown_game:${gameId}`);
    return db;
  }
  /** A reschedule: the schedule source and the database both move. */
  moveStart(gameId: number, start: string) {
    const db = this.db(gameId);
    db.game.scheduledStart = start;
    db.currentStartMs = Date.parse(start);
  }
  slate(): SlateGame[] {
    return [...this.listed].map((gameId) => ({ gameId, slateDate: this.slateDates.get(gameId)!, scheduledStart: this.db(gameId).game.scheduledStart,
      status: this.status.get(gameId)! }));
  }
  claimCalls(gameId: number) { return this.db(gameId).calls.filter((call) => call === "claim").length; }
  saveCalls(gameId: number) { return this.db(gameId).calls.filter((call) => call === "save").length; }

  custody(): SlateCustody {
    return {
      lookup: (gameId, policyId) => this.db(gameId).rpc().lookup(gameId, policyId),
      recordOutcome: (gameId, policyId, claimId, outcome, metadata) => this.db(gameId).rpc().recordOutcome(gameId, policyId, claimId, outcome, metadata),
      sweep: async (graceSeconds, limit) => this.sweep(graceSeconds, limit),
    };
  }

  /** Mirrors forge_pregame_capture_sweep_v1 across every game's database. */
  sweep(graceSeconds: number, limit: number): SweepRow[] {
    if (!Number.isInteger(graceSeconds) || graceSeconds < 60 || limit < 1 || limit > 100) throw new Error("capture_sweep_bounds");
    const swept: SweepRow[] = [];
    for (const db of this.dbs.values()) {
      for (const claim of db.claims.values()) {
        if (swept.length >= limit) return swept;
        if (claim.ackDeadlineMs + graceSeconds * 1000 >= this.clock.ms) continue;
        const key = `${claim.args.gameId}/${claim.args.policyId}`;
        if (db.outcomes.has(key)) continue;
        const verdict = db.witnesses.get(claim.id)?.verdict ?? null;
        const outcome = verdict === "qualified" ? "qualified" : db.artifacts.has(claim.id) ? "saved_without_valid_witness" : "save_unknown";
        if (outcome === "save_unknown") db.fences.add(claim.id);
        db.outcomes.set(key, { outcome, claimId: claim.id, metadata: { reason: "swept_orphaned_claim", witness: verdict } });
        swept.push({ claimId: claim.id, gameId: claim.args.gameId, policyId: claim.args.policyId, outcome });
      }
    }
    return swept;
  }

  captureDeps(game: SlateGame): CaptureDeps {
    const db = this.db(game.gameId);
    const scenario = this.scenarios.get(game.gameId) ?? {};
    const clock = this.clock;
    const real = db.rpc();
    const writer: CaptureRpc = {
      ...real,
      claim: async (args) => {
        const row = await real.claim(args);
        if (scenario.killAt === "after_claim" && row.outcome === "claimed") await forever();
        return row;
      },
      save: async (...args) => {
        if (scenario.killAt === "save_never_commits") { db.calls.push("save"); await forever(); }
        const row = await real.save(...args);
        if (scenario.killAt === "after_save_commit") await forever();
        return row;
      },
    };
    if (scenario.saveResponseLost) db.hooks.afterSaveCommit = () => { clock.advance(16_000); throw new Error("fetch failed: socket hang up"); };
    return {
      writer, verifier: db.rpc(), trust: testTsaTrust(), budget: { ...SIM_BUDGET },
      tsa: {
        stamp: async (request) => {
          if (scenario.tsaDown) throw new Error("ECONNRESET");
          await clock.sleep(400);
          return mintTimeStampResponse(request, { genTimeMicros: BigInt(clock.ms) * MICROS_PER_MS, accuracyMillis: 500 });
        },
      },
      pin: async () => {
        await clock.sleep(scenario.pinMs ?? 3_000);
        if ((scenario.pinFailures ?? 0) > 0) { scenario.pinFailures! -= 1; throw new Error("fetch failed: ECONNRESET"); }
        return { gameId: game.gameId, slateDate: game.slateDate, homeTeamId: 6, awayTeamId: 30, homeAbbrev: "BOS", awayAbbrev: "MIN",
          scheduledStart: db.game.scheduledStart, calendarRevision: REV };
      },
      collect: async (binding) => {
        await clock.sleep(scenario.readMs ?? 20_000);
        return {
          reads: [
            { request: [{ method: "from", args: ["games"] }, { method: "eq", args: ["id", binding.gameId] }], result: { data: [{ id: binding.gameId }], error: null }, receivedAt: dbText(clock.ms - 5_000, 0, 456) },
            { request: [{ method: "from", args: ["goalie_start_projections"] }, { method: "eq", args: ["game_id", binding.gameId] }], result: { data: [], error: null }, receivedAt: dbText(clock.ms, 0, 0) },
          ],
          candidates: { skaters: [1, 2], goalies: [3], reserves: [] },
          transport: { calls: 2, httpCalls: 2, rows: 1, bytes: 512, stampToleranceMs: 5_000, refusals: scenario.transportRefusal ? [scenario.transportRefusal] : [] },
          calendarRevision: REV, seasonBootstrapApplied: false,
        };
      },
      modelEnvironment: () => ({ FORGE_SKATER_MODEL_MODE: "v2" }),
      now: () => clock.ms,
      nonce: () => BigInt(0x5eed),
    };
  }

  executorDeps(overrides: Partial<SlateExecutorDeps> = {}): SlateExecutorDeps {
    return {
      policyId: SIM_POLICY, codeVersion: "0123456789abcdef0123456789abcdef01234567",
      config: { budget: { ...SIM_BUDGET }, ...DEFAULT_SLATE_SETTINGS },
      now: () => this.clock.ms,
      sleepUntil: (at) => this.clock.until(at),
      custody: this.custody(),
      captureDeps: (game) => this.captureDeps(game),
      run: async (deps, request) => {
        this.inFlight += 1;
        this.maxInFlight = Math.max(this.maxInFlight, this.inFlight);
        try { return await runPregameCapture(deps, request); } finally { this.inFlight -= 1; }
      },
      loadGate: async () => ({ open: true }),
      refreshSlate: async () => this.slate(),
      refreshIntervalMs: 0,
      ...overrides,
    };
  }

  /** Every game ends in exactly one recorded outcome; no game is claimed (or saved) more than once. */
  invariants(): string[] {
    const problems: string[] = [];
    for (const [gameId, db] of this.dbs) {
      if (db.outcomes.size !== 1) problems.push(`${gameId}:outcomes=${db.outcomes.size}`);
      if (this.claimCalls(gameId) > 1 || db.claims.size > 1) problems.push(`${gameId}:claims=${this.claimCalls(gameId)}/${db.claims.size}`);
      if (this.saveCalls(gameId) > 1) problems.push(`${gameId}:saves=${this.saveCalls(gameId)}`);
    }
    return problems;
  }
}

export const minutes = (n: number) => n * MIN;
