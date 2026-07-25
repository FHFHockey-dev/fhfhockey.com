import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database, Json } from "lib/supabase/database-generated.types";

type YahooDraftAnalysis = {
  average_cost?: unknown;
  average_pick?: unknown;
  average_round?: unknown;
  percent_drafted?: unknown;
  [key: string]: unknown;
};

export type YahooPlayerSource = {
  display_position?: unknown;
  draft_analysis?: YahooDraftAnalysis | null;
  editorial_player_key?: unknown;
  editorial_team_abbr?: unknown;
  editorial_team_full_name?: unknown;
  eligible_positions?: Json;
  headshot?: { url?: unknown } | null;
  injury_note?: unknown;
  name?: { full?: unknown } | null;
  percent_owned?: unknown;
  player_id?: unknown;
  player_key?: unknown;
  position_type?: unknown;
  status?: unknown;
  status_full?: unknown;
  uniform_number?: unknown;
  [key: string]: unknown;
};

export type YahooPlayerAtomicPayload = {
  [key: string]: Json | undefined;
  average_draft_cost: number | null;
  average_draft_pick: number | null;
  average_draft_round: number | null;
  current_date: string;
  display_position: string | null;
  draft_analysis: Json;
  editorial_player_key: string | null;
  editorial_team_abbreviation: string | null;
  editorial_team_full_name: string | null;
  eligible_positions: Json;
  full_name: string | null;
  game_id: string | null;
  headshot_url: string | null;
  injury_note: string | null;
  last_updated: string;
  percent_drafted: number | null;
  percent_ownership: number | null;
  player_id: string | null;
  player_key: string;
  player_name: string | null;
  position_type: string | null;
  season: number | null;
  snapshot_status: "observed" | "omitted";
  status: string | null;
  status_full: string | null;
  uniform_number: number | null;
};

export type YahooPlayerAtomicReceipt = {
  draftHistoryUpserted: number;
  ownershipHistoryUpserted: number;
  ownershipOmitted: number;
  processed: number;
};

function optionalString(value: unknown): string | null {
  return value == null || value === "" ? null : String(value);
}

function optionalNumber(value: unknown): number | null {
  if (value == null || value === "") return null;
  const parsed = typeof value === "string" ? parseFloat(value) : Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function optionalInteger(value: unknown): number | null {
  const parsed = optionalNumber(value);
  return parsed == null ? null : Math.trunc(parsed);
}

export function extractYahooPercentOwned(percentOwned: unknown): number | null {
  if (percentOwned == null) return null;

  if (Array.isArray(percentOwned)) {
    const item = percentOwned.find(
      (entry) =>
        entry &&
        typeof entry === "object" &&
        ("value" in entry || "Value" in entry),
    ) as { value?: unknown; Value?: unknown } | undefined;
    return optionalNumber(item?.value ?? item?.Value);
  }

  if (typeof percentOwned === "object") {
    const item = percentOwned as { value?: unknown; Value?: unknown };
    return optionalNumber(item.value ?? item.Value);
  }

  return optionalNumber(percentOwned);
}

export function prepareYahooPlayerAtomicPayload(
  player: YahooPlayerSource,
  currentDate: string,
  gameId?: string,
  season?: number,
): YahooPlayerAtomicPayload {
  const ownership = extractYahooPercentOwned(player.percent_owned);
  const fullName = optionalString(player.name?.full);
  const draftAnalysis = (player.draft_analysis ?? null) as Json;

  return {
    player_key: String(player.player_key ?? ""),
    player_id: optionalString(player.player_id),
    player_name: fullName,
    draft_analysis: draftAnalysis,
    average_draft_pick: optionalNumber(player.draft_analysis?.average_pick),
    average_draft_round: optionalNumber(player.draft_analysis?.average_round),
    average_draft_cost: optionalNumber(player.draft_analysis?.average_cost),
    percent_drafted: optionalNumber(player.draft_analysis?.percent_drafted),
    editorial_player_key: optionalString(player.editorial_player_key),
    editorial_team_abbreviation: optionalString(player.editorial_team_abbr),
    editorial_team_full_name: optionalString(player.editorial_team_full_name),
    eligible_positions: player.eligible_positions ?? [],
    display_position: optionalString(player.display_position),
    headshot_url: optionalString(player.headshot?.url),
    injury_note: optionalString(player.injury_note),
    full_name: fullName,
    percent_ownership: ownership,
    snapshot_status: ownership == null ? "omitted" : "observed",
    game_id: gameId ?? null,
    season: season ?? null,
    position_type: optionalString(player.position_type),
    status: optionalString(player.status),
    status_full: optionalString(player.status_full),
    last_updated: new Date().toISOString(),
    uniform_number: optionalInteger(player.uniform_number),
    current_date: currentDate,
  };
}

export function dedupeYahooPlayerPayloads(
  payloads: YahooPlayerAtomicPayload[],
): YahooPlayerAtomicPayload[] {
  const byPlayerKey = new Map<string, YahooPlayerAtomicPayload>();
  for (const payload of payloads) {
    byPlayerKey.set(payload.player_key, payload);
  }
  return Array.from(byPlayerKey.values());
}

export async function persistYahooPlayerPayloadBatch(
  client: SupabaseClient<Database>,
  payloads: YahooPlayerAtomicPayload[],
): Promise<YahooPlayerAtomicReceipt> {
  const { data, error } = await client.rpc("upsert_yahoo_players_atomic", {
    players_data: payloads,
  });

  if (error) {
    throw new Error("Yahoo player persistence failed.");
  }

  const receipt = data as Partial<YahooPlayerAtomicReceipt> | null;
  if (
    receipt?.processed !== payloads.length ||
    !Number.isFinite(receipt.ownershipHistoryUpserted) ||
    !Number.isFinite(receipt.draftHistoryUpserted) ||
    !Number.isFinite(receipt.ownershipOmitted)
  ) {
    throw new Error("Yahoo player persistence receipt is invalid.");
  }

  return receipt as YahooPlayerAtomicReceipt;
}
