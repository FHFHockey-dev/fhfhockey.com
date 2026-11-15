import { minimumRequiredMs, runPregameCapture, type CaptureBudget, type CaptureDeps, type CaptureReport, type CaptureRequest } from "./custody";
import { ackDeadlineMicros, decideStart } from "./deadline";
import type { CaptureRpc, LookupRow, TerminalOutcome } from "./rpc";
import { MICROS_PER_MS } from "./time";

/**
 * Per-game pregame slate queue (FORGE step 4). OFFLINE BUILD: nothing here is hosted, scheduled or enabled.
 *
 * planSlate is pure: slate games + budget → a dispatch time per game, or a reason it cannot fit.
 * runSlate executes a plan on an injected clock. It calls runPregameCapture-shaped deps once per dispatch and ends every
 * game in exactly one terminal outcome, never claiming a game twice:
 *   - on (re-)entry it looks up (game, policy) first; an existing claim is never re-claimed, only resolved;
 *   - an ambiguous mutation (claim, save, outcome) is never retried; it is settled by lookup and, for an orphaned claim,
 *     by the database sweep once the claim's T−60 + grace has passed;
 *   - a game that cannot fit is recorded never_dispatched by the queue (null claim id; the database refuses that record
 *     if any claim exists), never claimed late.
 */

/** Statuses that may still be captured. Anything else (PPD, CNCL, LIVE, FINAL, OFF, CRIT…) is never dispatched. */
export const PREGAME_STATUSES: ReadonlySet<string> = new Set(["FUT", "PRE"]);

export interface SlateGame {
  gameId: number; slateDate: string;
  /** Official scheduled puck drop. */
  scheduledStart: string;
  /** Latest scheduled start observed (a reschedule may move it earlier); the earliest known start always wins. */
  currentScheduledStart?: string | null;
  status: string;
}

export interface SlateQueueConfig {
  budget: CaptureBudget;
  /** Maximum captures in flight at once. */
  concurrency: number;
  /** Preferred margin before the latest safe dispatch. Staggering only ever moves a dispatch earlier. */
  leadMs: number;
  /** Minimum spacing between any two dispatches (keeps simultaneous starts from hitting the database together). */
  staggerMs: number;
}
export const DEFAULT_SLATE_SETTINGS = { concurrency: 2, leadMs: 10 * 60_000, staggerMs: 30_000 } as const;

export interface PlannedGame {
  game: SlateGame;
  /** Conservative acknowledgement deadline: T−60 of the earliest known start. */
  deadlineMs: number;
  /** Last instant a dispatch can still pin (≤ readMs) and then claim with requiredMs before the deadline. */
  latestDispatchAt: number;
  dispatchAt: number;
  slot: number;
}
export interface SkippedGame { game: SlateGame; reason: string }
export interface SlatePlan { plannedAt: number; dispatches: PlannedGame[]; skipped: SkippedGame[] }

export function deadlineMsOf(game: SlateGame): number {
  return Number(ackDeadlineMicros({ scheduledStart: game.scheduledStart, currentScheduledStart: game.currentScheduledStart }) / MICROS_PER_MS);
}

/** The pin runs before the claim and is not part of requiredMs, so a worker slot is held for pin + required. */
export function slotOccupancyMs(budget: CaptureBudget): number {
  return budget.readMs + budget.requiredMs;
}
export function latestDispatchAtOf(game: SlateGame, budget: CaptureBudget): number {
  return deadlineMsOf(game) - budget.requiredMs - budget.readMs - budget.skewToleranceMs;
}

export function assertSlateConfig(config: SlateQueueConfig): void {
  const minimum = minimumRequiredMs(config.budget);
  if (config.budget.requiredMs < minimum) throw new Error(`slate_budget_inconsistent:required_${config.budget.requiredMs}_lt_${minimum}`);
  if (!Number.isInteger(config.concurrency) || config.concurrency < 1 || config.concurrency > 8) throw new Error("slate_concurrency_out_of_range");
  for (const [name, value] of [["leadMs", config.leadMs], ["staggerMs", config.staggerMs]] as const) {
    if (!Number.isFinite(value) || value < 0) throw new Error(`slate_${name}_invalid`);
  }
}

/**
 * Backward list scheduling: latest deadlines are placed first at their preferred time (latest safe dispatch − lead);
 * each earlier game takes the slot that lets it start latest without overlapping a later capture. A game that would
 * have to start before `now` (or before a running capture frees its slot) is skipped with a reason.
 * `busyUntil` holds, per slot, when a capture already running frees it.
 */
export function planSlate(games: SlateGame[], config: SlateQueueConfig, now: number, busyUntil: number[] = []): SlatePlan {
  assertSlateConfig(config);
  const ids = new Set<number>();
  for (const game of games) {
    if (ids.has(game.gameId)) throw new Error(`slate_duplicate_game:${game.gameId}`);
    ids.add(game.gameId);
  }
  const occupancy = slotOccupancyMs(config.budget);
  const skipped: SkippedGame[] = [];
  const feasible: Array<{ game: SlateGame; deadlineMs: number; latestDispatchAt: number }> = [];
  for (const game of games) {
    if (!PREGAME_STATUSES.has(game.status)) { skipped.push({ game, reason: `status:${game.status}` }); continue; }
    let deadlineMs: number;
    try { deadlineMs = deadlineMsOf(game); } catch { skipped.push({ game, reason: "start_unparseable" }); continue; }
    const latestDispatchAt = latestDispatchAtOf(game, config.budget);
    if (latestDispatchAt < now) { skipped.push({ game, reason: "no_time_before_t_minus_60" }); continue; }
    feasible.push({ game, deadlineMs, latestDispatchAt });
  }
  feasible.sort((a, b) => b.latestDispatchAt - a.latestDispatchAt || b.game.gameId - a.game.gameId);

  const nextBusy = Array.from({ length: config.concurrency }, () => Number.POSITIVE_INFINITY);
  const frontFree = Array.from({ length: config.concurrency }, (_, s) => Math.max(now, busyUntil[s] ?? now));
  const assigned: number[] = [];
  const conflict = (t: number) => assigned.find((other) => Math.abs(other - t) < config.staggerMs);
  const dispatches: PlannedGame[] = [];
  for (const entry of feasible) {
    // A slot that keeps the full lead always wins (latest such time); otherwise the earliest fallback time wins.
    let best: { at: number; slot: number; fallback: boolean } | null = null;
    for (let slot = 0; slot < config.concurrency; slot++) {
      let fallback = false;
      const ceiling = Math.min(entry.latestDispatchAt, nextBusy[slot] - occupancy);
      // Preferred: as late as the lead allows, moved earlier to respect the stagger.
      let at = Math.min(entry.latestDispatchAt - config.leadMs, ceiling);
      for (let hit = conflict(at); hit !== undefined; hit = conflict(at)) at = hit - config.staggerMs;
      if (at < frontFree[slot]) {
        // Not enough room for the full lead: start as soon as the slot is free, moved later to respect the stagger.
        fallback = true;
        at = frontFree[slot];
        for (let hit = conflict(at); hit !== undefined; hit = conflict(at)) at = hit + config.staggerMs;
        if (at > ceiling) continue;
      }
      const better = !best || (best.fallback && !fallback) || (best.fallback === fallback && (fallback ? at < best.at : at > best.at));
      if (better) best = { at, slot, fallback };
    }
    if (!best) { skipped.push({ game: entry.game, reason: "no_capacity_before_deadline" }); continue; }
    nextBusy[best.slot] = best.at;
    assigned.push(best.at);
    dispatches.push({ game: entry.game, deadlineMs: entry.deadlineMs, latestDispatchAt: entry.latestDispatchAt, dispatchAt: best.at, slot: best.slot });
  }
  dispatches.sort((a, b) => a.dispatchAt - b.dispatchAt || a.game.gameId - b.game.gameId);
  return { plannedAt: now, dispatches, skipped };
}

// ---------------------------------------------------------------------------------------------------------------
// Executor
// ---------------------------------------------------------------------------------------------------------------

export type SlateCustody = Pick<CaptureRpc, "lookup" | "recordOutcome" | "sweep">;
export type LoadGate = (game: SlateGame) => Promise<{ open: boolean; reason?: string }>;

export interface SlateExecutorDeps {
  policyId: string; codeVersion: string; config: SlateQueueConfig;
  now(): number;
  sleepUntil(ms: number): Promise<void>;
  /** Queue-owned custody calls: lookup, never_dispatched records and the orphan sweep. */
  custody: SlateCustody;
  /** Capture deps for one game (production: the same writer/verifier for every game). */
  captureDeps(game: SlateGame): CaptureDeps;
  run?(deps: CaptureDeps, request: CaptureRequest): Promise<CaptureReport>;
  /** Checked before every dispatch; a closed gate delays the dispatch while it still fits, then never_dispatched. */
  loadGate: LoadGate;
  /** Optional schedule re-read before a dispatch wave (start-time changes, postponements, late additions). */
  refreshSlate?(): Promise<SlateGame[]>;
  refreshIntervalMs?: number;
  gateRetryMs?: number;
  /** Re-dispatches allowed only where no claim can exist (pin failure, definitive binding refusal). */
  maxDispatchAttempts?: number;
  retryDelayMs?: number;
  /** forge_pregame_capture_sweep_v1 bounds: grace ≥ 60 s, limit 1–100. */
  sweepGraceSeconds?: number;
  sweepAttempts?: number;
  sweepRetryMs?: number;
  log?(event: Record<string, unknown>): void;
}

export type ResultSource = "capture" | "queue" | "sweep" | "prior_run" | "lookup";
export interface GameResult {
  gameId: number;
  /** Confirmed terminal outcome (null only when custody could not be confirmed; listed in `unresolved`). */
  outcome: TerminalOutcome | null;
  source: ResultSource | null;
  reason: string | null;
  claimId: string | null;
  dispatches: number;
  dispatchedAt: number[];
  plannedDispatchAt: number | null;
  reports: Array<{ outcome: TerminalOutcome | null; reason: string | null; outcomeRecorded: boolean }>;
}
export interface SlateRunResult { results: GameResult[]; unresolved: number[]; maxInFlight: number; sweeps: number; refreshes: number }

type Phase = "pending" | "running" | "resolve" | "done";
interface GameState {
  game: SlateGame; phase: Phase; result: GameResult;
  dispatchAt: number; latestDispatchAt: number; deadlineMs: number;
  /** Why the game needs resolution (an ambiguous or unrecorded step); resolution never re-claims. */
  pendingReason: string | null;
  /** A never_dispatched decision waiting to be recorded once no claim can exist. */
  closeReason: string | null;
}

const NO_CLAIM_RETRYABLE = [/^pin_failed:/, /^claim_refused:binding_mismatch$/];

export async function runSlate(deps: SlateExecutorDeps, initialGames: SlateGame[]): Promise<SlateRunResult> {
  assertSlateConfig(deps.config);
  const run = deps.run ?? runPregameCapture;
  const graceSeconds = deps.sweepGraceSeconds ?? 120;
  if (!Number.isInteger(graceSeconds) || graceSeconds < 60) throw new Error("slate_sweep_grace_below_60s");
  const refreshIntervalMs = deps.refreshIntervalMs ?? 60_000;
  const gateRetryMs = deps.gateRetryMs ?? 60_000;
  const maxAttempts = deps.maxDispatchAttempts ?? 2;
  const retryDelayMs = deps.retryDelayMs ?? 30_000;
  const log = deps.log ?? (() => {});
  const occupancy = slotOccupancyMs(deps.config.budget);

  const states = new Map<number, GameState>();
  const running = new Map<number, { startedAt: number; done: Promise<void> }>();
  let maxInFlight = 0, sweeps = 0, refreshes = 0, lastRefresh = Number.NEGATIVE_INFINITY, finalRefreshDone = false;

  const finish = (state: GameState, outcome: TerminalOutcome, source: ResultSource, reason: string | null, claimId?: string | null) => {
    state.phase = "done";
    Object.assign(state.result, { outcome, source, reason, ...(claimId !== undefined ? { claimId } : {}) });
    log({ event: "terminal", gameId: state.game.gameId, outcome, source, reason });
  };
  const toResolve = (state: GameState, reason: string, claimId?: string | null) => {
    state.phase = "resolve"; state.pendingReason = reason;
    if (claimId) state.result.claimId = claimId;
  };
  const lookup = async (gameId: number): Promise<LookupRow | null> => {
    for (let attempt = 0; attempt < 3; attempt++) {
      try { return await deps.custody.lookup(gameId, deps.policyId); } catch { /* a read: safe to repeat */ }
    }
    return null;
  };
  /** Applies a lookup: a recorded outcome ends the game; an existing claim is never re-claimed. Returns true if handled. */
  const absorb = (state: GameState, row: LookupRow | null, source: ResultSource, reason: string): boolean => {
    if (row?.outcome) { finish(state, row.outcome, source, reason, row.claimId); return true; }
    if (row?.claimId) { toResolve(state, reason, row.claimId); return true; }
    return false;
  };

  const newState = (game: SlateGame): GameState => ({
    game, phase: "pending", dispatchAt: Number.POSITIVE_INFINITY, latestDispatchAt: Number.NEGATIVE_INFINITY, deadlineMs: Number.NaN,
    pendingReason: null, closeReason: null,
    result: { gameId: game.gameId, outcome: null, source: null, reason: null, claimId: null, dispatches: 0, dispatchedAt: [], plannedDispatchAt: null, reports: [] },
  });
  const updateTimes = (state: GameState) => {
    try { state.deadlineMs = deadlineMsOf(state.game); state.latestDispatchAt = latestDispatchAtOf(state.game, deps.config.budget); } catch { /* skipped by the planner */ }
  };

  /** Re-entry: look up every new game before anything else; a prior outcome or claim is never dispatched again. */
  const admit = async (games: SlateGame[]) => {
    for (const game of games) {
      const state = newState(game);
      states.set(game.gameId, state);
      updateTimes(state);
      // A failed lookup still dispatches: the database's one-claim rule refuses a duplicate claim.
      absorb(state, await lookup(game.gameId), "prior_run", "found_on_entry");
    }
  };

  const replan = () => {
    const pending = [...states.values()].filter((s) => s.phase === "pending");
    const busyUntil = [...running.values()].map((r) => r.startedAt + occupancy).sort((a, b) => a - b);
    const plan = planSlate(pending.map((s) => s.game), deps.config, deps.now(), busyUntil);
    for (const skip of plan.skipped) {
      const state = states.get(skip.game.gameId)!;
      state.phase = "resolve"; state.closeReason = skip.reason;
    }
    for (const planned of plan.dispatches) {
      const state = states.get(planned.game.gameId)!;
      state.dispatchAt = planned.dispatchAt; state.latestDispatchAt = planned.latestDispatchAt; state.deadlineMs = planned.deadlineMs;
      state.result.plannedDispatchAt ??= planned.dispatchAt;
    }
    log({ event: "plan", at: plan.plannedAt, dispatches: plan.dispatches.map((p) => [p.game.gameId, p.dispatchAt]), skipped: plan.skipped.map((s) => [s.game.gameId, s.reason]) });
  };

  const refresh = async (force = false) => {
    if (!deps.refreshSlate || (!force && deps.now() - lastRefresh < refreshIntervalMs)) return false;
    lastRefresh = deps.now();
    let games: SlateGame[];
    try { games = await deps.refreshSlate(); } catch (error) { log({ event: "refresh_failed", error: String(error) }); return false; }
    refreshes += 1;
    const seen = new Set(games.map((g) => g.gameId));
    await admit(games.filter((g) => !states.has(g.gameId)));
    for (const game of games) {
      const state = states.get(game.gameId)!;
      if (state.phase === "pending") { state.game = game; updateTimes(state); }
    }
    for (const state of states.values()) {
      if (state.phase === "pending" && !seen.has(state.game.gameId)) { state.phase = "resolve"; state.closeReason = "removed_from_slate"; }
    }
    return true;
  };

  const handleReport = (state: GameState, report: CaptureReport) => {
    state.result.reports.push({ outcome: report.outcome, reason: report.reason, outcomeRecorded: report.outcomeRecorded });
    if (report.claimId) state.result.claimId = report.claimId;
    const reason = report.reason ?? "";
    if (report.outcome && report.outcomeRecorded) return finish(state, report.outcome, "capture", report.reason, report.claimId);
    if (report.outcome) return toResolve(state, `outcome_unconfirmed:${report.outcome}:${reason}`, report.claimId);
    if (!report.claimId && NO_CLAIM_RETRYABLE.some((pattern) => pattern.test(reason))) {
      // No claim was committed: re-dispatch while it still fits, otherwise close as never_dispatched.
      const retryAt = deps.now() + retryDelayMs;
      if (state.result.dispatches < maxAttempts && retryAt <= state.latestDispatchAt) { state.phase = "pending"; state.dispatchAt = retryAt; return; }
      state.phase = "resolve"; state.closeReason = `dispatch_failed:${reason}`; return;
    }
    // Ambiguous claim, duplicate, unsettled save, or anything else: never claim again; settle by lookup and sweep.
    toResolve(state, reason || "capture_returned_no_outcome", report.claimId);
  };

  const dispatch = (state: GameState) => {
    state.phase = "running";
    state.result.dispatches += 1;
    const startedAt = deps.now();
    state.result.dispatchedAt.push(startedAt);
    const request: CaptureRequest = { gameId: state.game.gameId, slateDate: state.game.slateDate, policyId: deps.policyId, codeVersion: deps.codeVersion,
      scheduledLaunchAt: new Date(state.dispatchAt).toISOString() };
    const done = (async () => {
      try { handleReport(state, await run(deps.captureDeps(state.game), request)); }
      catch (error) { state.result.reports.push({ outcome: null, reason: `run_threw:${String(error).slice(0, 120)}`, outcomeRecorded: false }); toResolve(state, "run_threw"); }
      finally { running.delete(state.game.gameId); }
    })();
    running.set(state.game.gameId, { startedAt, done });
    maxInFlight = Math.max(maxInFlight, running.size);
    log({ event: "dispatch", gameId: state.game.gameId, at: startedAt, attempt: state.result.dispatches });
  };

  /** Local refusal just before dispatch: the same rule as the claim, on the queue's clock, so no late claim is attempted. */
  const fitsNow = (state: GameState) => decideStart(
    { scheduledStart: state.game.scheduledStart, currentScheduledStart: state.game.currentScheduledStart },
    { nowUpper: BigInt(Math.ceil(deps.now() + deps.config.budget.skewToleranceMs)) * MICROS_PER_MS,
      readMs: deps.config.budget.readMs, saveMs: deps.config.budget.requiredMs, verifyMs: 0, marginMs: 0 });

  await admit(initialGames);
  replan();

  for (;;) {
    let due = [...states.values()].filter((s) => s.phase === "pending" && s.dispatchAt <= deps.now());
    if (due.length && running.size < deps.config.concurrency && await refresh()) {
      replan();
      due = [...states.values()].filter((s) => s.phase === "pending" && s.dispatchAt <= deps.now());
    }
    due.sort((a, b) => a.dispatchAt - b.dispatchAt || a.game.gameId - b.game.gameId);
    for (const state of due) {
      if (running.size >= deps.config.concurrency) break;
      const decision = fitsNow(state);
      if (!decision.ok) { state.phase = "resolve"; state.closeReason = `local_${decision.reason}`; continue; }
      let gate: { open: boolean; reason?: string };
      try { gate = await deps.loadGate(state.game); } catch (error) { gate = { open: false, reason: `gate_error:${String(error).slice(0, 60)}` }; }
      if (!gate.open) {
        const retryAt = deps.now() + gateRetryMs;
        if (retryAt <= state.latestDispatchAt) state.dispatchAt = retryAt;
        else { state.phase = "resolve"; state.closeReason = `load_gate_closed:${gate.reason ?? "closed"}`; }
        continue;
      }
      dispatch(state);
    }
    const pending = [...states.values()].filter((s) => s.phase === "pending");
    const waits: Promise<unknown>[] = [...running.values()].map((r) => r.done);
    const futureDispatch = pending.map((s) => s.dispatchAt).filter((t) => t > deps.now());
    const capFull = running.size >= deps.config.concurrency;
    if (futureDispatch.length && !(capFull && pending.some((s) => s.dispatchAt <= deps.now()))) waits.push(deps.sleepUntil(Math.min(...futureDispatch)));
    if (!waits.length) {
      if (pending.length) continue; // due now with a free slot
      // Last chance for a late-added game before the queue settles what is left.
      if (!finalRefreshDone) {
        finalRefreshDone = true;
        if (await refresh(true)) { replan(); continue; }
      }
      break;
    }
    await Promise.race(waits);
  }

  // Resolution: every game not yet terminal ends by lookup, a queue never_dispatched record, or the sweep.
  const unresolvedStates = () => [...states.values()].filter((s) => s.phase === "resolve");
  for (const state of unresolvedStates()) {
    if (state.closeReason === null) continue;
    // Close without a claim. Lookup first; a possibly-lost claim (none here) is never assumed absent.
    if (absorb(state, await lookup(state.game.gameId), "lookup", state.closeReason)) continue;
    try {
      await deps.custody.recordOutcome(state.game.gameId, deps.policyId, null, "never_dispatched", { reason: state.closeReason, source: "slate_queue" });
      finish(state, "never_dispatched", "queue", state.closeReason, null);
    } catch {
      // Never resent: confirm by lookup.
      const row = await lookup(state.game.gameId);
      if (!absorb(state, row, "lookup", state.closeReason)) state.pendingReason = `never_dispatched_unconfirmed:${state.closeReason}`;
    }
  }
  // Claimed or ambiguous games: wait until the database sweep may close them (T−60 + grace), sweep, confirm by lookup.
  const ambiguous = unresolvedStates().sort((a, b) => a.deadlineMs - b.deadlineMs);
  for (const state of ambiguous) {
    const first = await lookup(state.game.gameId);
    // The sweep is global: an earlier game's sweep may already have closed this claim.
    if (first?.outcome) { finish(state, first.outcome, first.claimId && sweeps > 0 ? "sweep" : "lookup", state.pendingReason, first.claimId); continue; }
    if (first?.claimId) state.result.claimId = first.claimId;
    const sweepAt = (Number.isFinite(state.deadlineMs) ? state.deadlineMs : deps.now()) + graceSeconds * 1000 + 1000;
    if (deps.now() < sweepAt) await deps.sleepUntil(sweepAt);
    const attempts = deps.sweepAttempts ?? 3;
    for (let attempt = 0; attempt < attempts && state.phase !== "done"; attempt++) {
      const row = await lookup(state.game.gameId);
      if (row?.outcome) { finish(state, row.outcome, row.claimId ? "sweep" : "lookup", state.pendingReason, row.claimId); break; }
      if (!row?.claimId) {
        // No claim after the claim window closed: nothing can still commit; close without a claim.
        state.closeReason = `no_claim_after_window:${state.pendingReason}`;
        try {
          await deps.custody.recordOutcome(state.game.gameId, deps.policyId, null, "never_dispatched", { reason: state.closeReason, source: "slate_queue" });
          finish(state, "never_dispatched", "queue", state.closeReason, null);
        } catch {
          const confirm = await lookup(state.game.gameId);
          if (confirm?.outcome) finish(state, confirm.outcome, "lookup", state.closeReason, confirm.claimId);
        }
        break;
      }
      // Idempotent and bounded: it skips any (game, policy) that already has an outcome.
      try { sweeps += 1; await deps.custody.sweep(graceSeconds, 100); } catch { /* confirmed by the next lookup */ }
      const after = await lookup(state.game.gameId);
      if (after?.outcome) { finish(state, after.outcome, "sweep", state.pendingReason, after.claimId); break; }
      if (attempt + 1 < attempts) await deps.sleepUntil(deps.now() + (deps.sweepRetryMs ?? 60_000));
    }
    if (state.phase !== "done") state.result.reason = state.pendingReason;
  }

  const results = [...states.values()].map((s) => s.result).sort((a, b) => a.gameId - b.gameId);
  return { results, unresolved: results.filter((r) => r.outcome === null).map((r) => r.gameId), maxInFlight, sweeps, refreshes };
}
