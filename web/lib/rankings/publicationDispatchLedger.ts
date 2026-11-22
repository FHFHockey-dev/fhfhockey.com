import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "lib/supabase/database-generated.types";
import { DAILY_RANKINGS_SEASON, rankingCadenceEnabled } from "./dailyPublicationPolicy";

type Client = SupabaseClient<Database>;
type Mode = "scheduled" | "manual_rankings" | "manual_composites";
type Status = "running" | "complete" | "blocked" | "failed" | "ambiguous";

export type RankingDispatchClaim = {
  outcome: "claimed" | "busy" | "duplicate" | "protected";
  id: string | null;
  priorCutoff: string | null;
  reason?: string | null;
};
export class RankingDispatchConflict extends Error {}

// The migration's RPCs are intentionally absent from the generated hosted schema
// until deployment. Keep the untyped boundary here and validate the claim receipt.
async function rpc(client: Client, name: string, args: Record<string, unknown>): Promise<unknown> {
  const dispatch = client as unknown as {
    rpc(name: string, args: Record<string, unknown>): PromiseLike<{ data: unknown; error: { message: string } | null }>;
  };
  const result = await dispatch.rpc(name, args);
  if (result.error) throw new Error(`Rankings ledger ${name}: ${result.error.message}`);
  return result.data;
}

async function claim(client: Client, args: {
  season: number; date: string; mode: Mode; protect: boolean; dates: (string | null)[];
}): Promise<RankingDispatchClaim> {
  const result = await rpc(client, "claim_ranking_publication_dispatch", {
    p_season: args.season, p_date: args.date, p_mode: args.mode, p_protect: args.protect,
    p_write_dates: args.dates,
  }) as RankingDispatchClaim | null;
  if (!result || !["claimed","busy","duplicate","protected"].includes(result.outcome) ||
      (result.outcome === "claimed" && !result.id) ||
      (result.priorCutoff !== null && typeof result.priorCutoff !== "string")) {
    throw new Error("Invalid Rankings ledger claim receipt.");
  }
  return result;
}

export function claimRankingDispatch(client: Client, args: { season: number; date: string }) {
  return claim(client, { ...args, mode: "scheduled", protect: true, dates: [args.date] });
}

export async function latestRankingPublicationCutoff(client: Client, season: number, through?: string | null): Promise<string | null> {
  const data = await rpc(client, "latest_ranking_publication_cutoff", { p_season: season, p_through: through ?? null });
  if (data !== null && typeof data !== "string") throw new Error("Invalid Rankings ledger cutoff.");
  return data;
}

export async function recordRankingDispatch(client: Client, args: {
  id: string; stage: string; status: Status; reason?: string | null; evidence?: Record<string, unknown>;
}): Promise<void> {
  await rpc(client, "record_ranking_publication_dispatch", {
    p_id: args.id, p_stage: args.stage, p_status: args.status,
    p_reason: args.reason ?? null, p_evidence: args.evidence ?? {},
  });
}

type ManualReceipt = {
  marked: boolean; complete?: boolean; status?: string; rowsUpserted: number; dbWrittenRows: number | null;
};

export async function withManualRankingDispatch<T extends ManualReceipt>(
  client: Client,
  args: {
    mode: Exclude<Mode, "scheduled">;
    season: number;
    strength: string;
    touchesPublishedScope: boolean;
    dates: (string | null)[];
    knownPrewriteFailure?: (error: unknown) => boolean;
  },
  publish: () => Promise<T>,
): Promise<T> {
  // Only the 2026-27 5v5 writers can touch the scheduled pair. This includes
  // custom/unmarked requests because the row primary keys omit sample floors.
  if (args.season !== DAILY_RANKINGS_SEASON || args.strength !== "5v5") return publish();
  const dates = [...new Set(args.dates.map(date => date ?? null))];
  const date = dates.filter((d): d is string => d !== null).sort().at(-1) ?? new Date().toISOString().slice(0,10);
  const lock = await claim(client, {
    season: args.season, date, mode: args.mode,
    protect: args.touchesPublishedScope && rankingCadenceEnabled(process.env.RANKINGS_DAILY_PUBLICATION), dates,
  });
  if (lock.outcome !== "claimed" || !lock.id) {
    throw new RankingDispatchConflict(lock.reason ?? `Rankings dispatch is ${lock.outcome}.`);
  }
  const id = lock.id;
  let result: T;
  try {
    result = await publish();
  } catch (error) {
    await recordRankingDispatch(client, {
      id, stage: args.mode, status: args.knownPrewriteFailure?.(error) ? "blocked" : "ambiguous",
      reason: error instanceof Error ? error.message : "Manual publication failed.",
    });
    throw error;
  }
  const incomplete = result.dbWrittenRows !== result.rowsUpserted ||
    (result.marked && (result.complete === false || result.status === "writing"));
  await recordRankingDispatch(client, {
    id, stage: args.mode, status: incomplete ? "ambiguous" : "complete",
    reason: incomplete ? "Incomplete manual publication needs reconciliation." : null,
    evidence: { dates, rowsUpserted: result.rowsUpserted, dbWrittenRows: result.dbWrittenRows },
  });
  return result;
}
