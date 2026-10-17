import { randomUUID } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { runProjectionV2ForDate } from "./run-forge-projections";
import { starterBoardCanaryGameIds, starterBoardFlags, starterBoardScopeAllowed } from "./starterBoardFlags";
import { prepareForecastCadence, type ForecastCadenceInput } from "lib/fantasy-projections/seasonJobs";

export const STARTER_BOARD_LATENCY = { coalescingMs: 30_000, dispatchMs: 60_000, computeMs: 150_000, visibleMs: 60_000 } as const;

export type StarterBoardJob = { game_id: number; claimed_version: number; first_accepted_at: string };

/** Opt-in coordinator only. Existing news dispatch remains unchanged. Source
 * receipts must come from the bounded upstream completion check, not a clock. */
export async function enqueueStarterBoardCadence(db: SupabaseClient<any>, input: ForecastCadenceInput) {
  const flags = starterBoardFlags();
  if (!flags.capture || !flags.compute || !flags.scheduler) throw new Error("Starter Board cadence is not enabled");
  if (!starterBoardScopeAllowed(input.games.map(game => game.gameId))) throw new Error("Game is outside the Starter Board canary scope");
  // Per-game durable SQL receipts are authoritative. A caller's stale or
  // global morning receipt must not accidentally suppress another game.
  const plan = prepareForecastCadence({ ...input, previous: [] });
  const deadlineMs = Date.now() + 30_000;
  const results: Array<{ gameId: number; key: string; outcome: string; reasons?: string[] }> = [];
  for (const slot of plan.slots) {
    const games = slot.gameId === null ? input.games : input.games.filter(game => game.gameId === slot.gameId);
    for (const game of games) {
      const reasons = [...slot.reasons];
      if (Date.parse(game.startsAt) <= input.now.getTime()) reasons.push("game_started");
      if (reasons.length) { results.push({ gameId: game.gameId, key: slot.key, outcome: "held", reasons }); continue; }
      if (Date.now() >= deadlineMs) {
        results.push({ gameId: game.gameId, key: slot.key, outcome: "held", reasons: ["coordinator_deadline"] });
        return { ...plan, results, stopped: true };
      }
      const controller = new AbortController();
      let timer: ReturnType<typeof setTimeout> | undefined;
      try {
        const request = db.rpc("enqueue_forge_cadence_slot", {
          p_game_id: game.gameId, p_date: input.date, p_kind: slot.kind,
          p_start_time: new Date(game.startsAt).toISOString(),
          p_required_sources: input.requiredSources, p_sources: input.sources,
        }).abortSignal(controller.signal);
        const { data, error } = await Promise.race([request, new Promise<never>((_, reject) => {
          timer = setTimeout(() => { controller.abort(); reject(new Error("Cadence enqueue deadline exceeded")); }, Math.min(5000, deadlineMs - Date.now()));
        })]);
        if (error || controller.signal.aborted || !data || !["enqueued", "deduplicated", "held"].includes(data.outcome)) {
          results.push({ gameId: game.gameId, key: slot.key, outcome: "unknown", reasons: ["enqueue_readback_required"] });
          return { ...plan, results, stopped: true };
        }
        results.push({ gameId: game.gameId, key: slot.key, outcome: data.outcome,
          ...(data.reason ? { reasons: [data.reason] } : {}) });
      } catch {
        results.push({ gameId: game.gameId, key: slot.key, outcome: "unknown", reasons: ["enqueue_readback_required"] });
        return { ...plan, results, stopped: true };
      } finally { clearTimeout(timer); controller.abort(); }
    }
  }
  return { ...plan, results, stopped: false };
}

export async function claimStarterBoardJobs(db: SupabaseClient<any>, limit = 16) {
  if (!starterBoardFlags().compute || !starterBoardFlags().capture) throw new Error("Starter Board computation and capture are not enabled");
  const gameIds = starterBoardCanaryGameIds();
  const owner = randomUUID();
  const { data: jobs, error } = await db.rpc("claim_starter_board_jobs", { p_owner: owner, p_limit: limit, p_game_ids: gameIds });
  if (error) throw error;
  return { owner, jobs: (jobs ?? []) as StarterBoardJob[] };
}

export async function computeStarterBoardJob(db: SupabaseClient<any>, job: StarterBoardJob, owner: string) {
    if (!starterBoardFlags().compute || !starterBoardFlags().capture) throw new Error("Starter Board computation and capture are not enabled");
    if (!starterBoardScopeAllowed([job.game_id])) throw new Error("Game is outside the Starter Board canary scope");
    const deadlineMs = Date.now() + STARTER_BOARD_LATENCY.computeMs;
    let runId: string | null = null;
    let failure: string | null = null;
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 15_000);
      let lookup;
      try {
        lookup = await db.from("games").select("date").eq("id", job.game_id).abortSignal(controller.signal).single();
      } finally { clearTimeout(timeout); }
      const { data: game, error: gameError } = lookup;
      if (gameError) throw gameError;
      if (!game || Date.now() >= deadlineMs) throw new Error("Game lookup exhausted the computation budget");
      const result = await runProjectionV2ForDate(game.date, {
        gameIds: [Number(job.game_id)], horizonGames: 1, deadlineMs,
        boardLease: { owner, version: job.claimed_version },
      });
      runId = result.runId;
      if (result.timedOut || result.publishedGames !== 1) throw new Error("Game computation did not publish a complete pregame revision");
    } catch (error) {
      if ((error as any)?.code === "P0002") return { gameId: job.game_id, runId, error: null, duplicate: true, freshnessBreached: false };
      failure = error instanceof Error ? error.message : String(error);
    }
    const { error: finishError } = await db.rpc("finish_starter_board_job", {
      p_game_id: job.game_id, p_owner: owner, p_run_id: runId, p_error: failure,
    });
    // Let every claimed game settle even when one lease has expired. Returning
    // early here could abandon the other computations in this request.
    if (finishError) failure = [failure, `Queue completion failed: ${finishError.message}`].filter(Boolean).join("; ");
    return { gameId: job.game_id, runId, error: failure,
      freshnessBreached: Date.now() - Date.parse(job.first_accepted_at) > 300_000 };
}

export async function drainStarterBoardQueue(db: SupabaseClient<any>, limit = 4) {
  const { owner, jobs } = await claimStarterBoardJobs(db, limit);
  const results = await Promise.all(jobs.map((job) => computeStarterBoardJob(db, job, owner)));
  return { processed: results.length, failed: results.filter((result) => result.error).length, results };
}

/** Each game receives its own function budget; the dispatcher awaits all receipts. */
export async function dispatchStarterBoardJobs(db: SupabaseClient<any>, origin: string, secret: string, request = fetch,
  cadenceInput?: ForecastCadenceInput) {
  const url = new URL("/api/v1/db/drain-starter-board", origin);
  if (url.protocol !== "https:" && !(process.env.NODE_ENV !== "production" && ["localhost", "127.0.0.1"].includes(url.hostname))) {
    throw new Error("A trusted HTTPS worker origin is required");
  }
  if (!secret.trim()) throw new Error("Scheduler authentication is missing");
  const cadence = cadenceInput ? await enqueueStarterBoardCadence(db, cadenceInput) : null;
  if (cadence?.stopped) return { dispatched: 0, failed: 1, results: [], cadence };
  const { owner, jobs } = await claimStarterBoardJobs(db);
  const results = await Promise.all(jobs.map(async (job) => {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 200_000);
    try {
      const response = await request(url, { method: "POST", redirect: "error", headers: {
        Authorization: `Bearer ${secret}`, "Content-Type": "application/json",
      }, body: JSON.stringify({ job, owner }), signal: controller.signal });
      return { gameId: job.game_id, ok: response.ok, status: response.status };
    } catch {
      // The worker may still be running. Its fenced lease owns retry eligibility.
      return { gameId: job.game_id, ok: false, status: null };
    } finally {
      clearTimeout(timeout);
    }
  }));
  return { dispatched: jobs.length, failed: results.filter((item) => !item.ok).length, results,
    ...(cadence ? { cadence } : {}) };
}
