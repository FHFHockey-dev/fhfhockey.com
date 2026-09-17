import { randomUUID } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { runProjectionV2ForDate } from "./run-forge-projections";
import { starterBoardCanaryGameIds, starterBoardFlags, starterBoardScopeAllowed } from "./starterBoardFlags";

export const STARTER_BOARD_LATENCY = { coalescingMs: 30_000, dispatchMs: 60_000, computeMs: 150_000, visibleMs: 60_000 } as const;

export type StarterBoardJob = { game_id: number; claimed_version: number; first_accepted_at: string };

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
export async function dispatchStarterBoardJobs(db: SupabaseClient<any>, origin: string, secret: string, request = fetch) {
  const url = new URL("/api/v1/db/drain-starter-board", origin);
  if (url.protocol !== "https:" && !(process.env.NODE_ENV !== "production" && ["localhost", "127.0.0.1"].includes(url.hostname))) {
    throw new Error("A trusted HTTPS worker origin is required");
  }
  if (!secret.trim()) throw new Error("Scheduler authentication is missing");
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
  return { dispatched: jobs.length, failed: results.filter((item) => !item.ok).length, results };
}
