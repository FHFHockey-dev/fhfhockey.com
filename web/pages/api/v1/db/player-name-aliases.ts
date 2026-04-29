import type { NextApiResponse } from "next";

import { getCurrentSeason } from "lib/NHL/server";
import { normalizePlayerNameAlias } from "lib/sources/playerNameAliases";
import adminOnly from "utils/adminOnlyMiddleware";

type PlayerOption = {
  id: number;
  fullName: string;
  lastName: string;
  position: string | null;
  team_id: number | null;
};

function parseLimit(value: string | string[] | undefined): number {
  const rawValue = Array.isArray(value) ? value[0] : value;
  const parsed = rawValue ? Number.parseInt(rawValue, 10) : 50;
  return Number.isFinite(parsed) ? Math.min(Math.max(parsed, 1), 200) : 50;
}

async function handleGet(req: any, res: NextApiResponse) {
  const limit = parseLimit(req.query.limit);
  const unresolvedId = Array.isArray(req.query.unresolvedId)
    ? req.query.unresolvedId[0]
    : req.query.unresolvedId;
  let unresolvedQuery = req.supabase
    .from("lineup_unresolved_player_names" as any)
    .select(
      "id, raw_name, normalized_name, team_id, team_abbreviation, source, source_url, tweet_id, context_text, status, metadata, created_at"
    )
    .eq("status", "pending");

  if (typeof unresolvedId === "string" && unresolvedId.trim()) {
    unresolvedQuery = unresolvedQuery.eq("id", unresolvedId.trim());
  }

  const { data: unresolvedRows, error: unresolvedError } = await unresolvedQuery
    .order("created_at", { ascending: false })
    .limit(limit);
  if (unresolvedError) throw unresolvedError;

  const currentSeason = await getCurrentSeason();
  const { data: rosterRows, error: rosterError } = await req.supabase
    .from("rosters")
    .select("teamId, players!inner(id, fullName, lastName, position)")
    .eq("seasonId", currentSeason.seasonId)
    .eq("is_current", true);
  if (rosterError) throw rosterError;

  const players = (rosterRows ?? [])
    .map((row: any): PlayerOption | null => {
      const player = row.players;
      if (!player) return null;
      return {
        id: Number(player.id),
        fullName: String(player.fullName ?? ""),
        lastName: String(player.lastName ?? ""),
        position: player.position ?? null,
        team_id: Number(row.teamId)
      };
    })
    .filter((player: PlayerOption | null): player is PlayerOption => Boolean(player))
    .sort((left: PlayerOption, right: PlayerOption) => left.fullName.localeCompare(right.fullName));

  return res.json({
    success: true,
    unresolvedNames: unresolvedRows ?? [],
    players
  });
}

async function handlePost(req: any, res: NextApiResponse) {
  const body = typeof req.body === "string" ? JSON.parse(req.body) : req.body ?? {};
  const unresolvedId = typeof body.unresolvedId === "string" ? body.unresolvedId : null;
  const action = typeof body.action === "string" ? body.action : "resolve";

  if (!unresolvedId) {
    return res.status(400).json({
      success: false,
      message: "Missing unresolvedId."
    });
  }

  if (action === "ignore") {
    const { error } = await req.supabase
      .from("lineup_unresolved_player_names" as any)
      .update({
        status: "ignored",
        updated_at: new Date().toISOString()
      })
      .eq("id", unresolvedId);
    if (error) throw error;
    return res.json({ success: true, message: "Name ignored." });
  }

  const playerId = Number(body.playerId);
  if (!Number.isFinite(playerId)) {
    return res.status(400).json({
      success: false,
      message: "Missing playerId."
    });
  }

  const { data: unresolved, error: unresolvedError } = await req.supabase
    .from("lineup_unresolved_player_names" as any)
    .select("id, raw_name, normalized_name, team_id")
    .eq("id", unresolvedId)
    .single();
  if (unresolvedError) throw unresolvedError;

  const { data: player, error: playerError } = await req.supabase
    .from("players")
    .select("id, fullName")
    .eq("id", playerId)
    .single();
  if (playerError) throw playerError;

  const alias = typeof body.alias === "string" && body.alias.trim()
    ? body.alias.trim()
    : unresolved.raw_name;
  const normalizedAlias = normalizePlayerNameAlias(alias);

  const { data: aliasRow, error: aliasError } = await req.supabase
    .from("lineup_player_name_aliases" as any)
    .upsert(
      {
        alias,
        normalized_alias: normalizedAlias,
        player_id: playerId,
        player_name: player.fullName,
        team_id: unresolved.team_id ?? null,
        source: "manual",
        updated_at: new Date().toISOString()
      },
      {
        onConflict: "normalized_alias,player_id"
      }
    )
    .select("id")
    .single();
  if (aliasError) throw aliasError;

  const { error: updateError } = await req.supabase
    .from("lineup_unresolved_player_names" as any)
    .update({
      status: "resolved",
      resolved_player_id: playerId,
      resolved_alias_id: aliasRow?.id ?? null,
      updated_at: new Date().toISOString()
    })
    .eq("id", unresolvedId);
  if (updateError) throw updateError;

  return res.json({
    success: true,
    message: `Saved alias "${alias}" for ${player.fullName}.`
  });
}

export default adminOnly(async (req: any, res: NextApiResponse) => {
  if (req.method === "GET") {
    return handleGet(req, res);
  }
  if (req.method === "POST") {
    return handlePost(req, res);
  }
  res.setHeader("Allow", "GET, POST");
  return res.status(405).json({
    success: false,
    message: "Method not allowed."
  });
});
