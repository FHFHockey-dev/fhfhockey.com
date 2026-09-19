import { fetchNhlPlayerIdentity, importNhlIdentity } from "lib/sources/nhlProspectIdentity";
import type { NextApiResponse } from "next";

import { fetchPlayerIdentityDirectory, fetchRegisteredPlayerIdentities, rosterSeasonForDate } from "lib/sources/playerIdentity";
import { fetchRosterEntriesByTeam } from "lib/sources/lineSourceProcessing";
import { tweetPipelineFlags } from "lib/sources/tweetInterpretation";
import { normalizePlayerNameAlias } from "lib/sources/playerNameAliases";
import { verifyPlayerAliasReviewToken } from "lib/sources/playerAliasReviewToken";
import serviceRoleClient from "lib/supabase/server";
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
  if (req.query.nhlId != null) {
    if (!tweetPipelineFlags().interpretation) return res.status(409).json({ success: false, message: "NHL lookup requires the new identity pipeline." });
    const identity = await fetchNhlPlayerIdentity(Number(req.query.nhlId), true);
    return res.json({ success: true, lookup: identity });
  }
  const limit = parseLimit(req.query.limit);
  const unresolvedId = Array.isArray(req.query.unresolvedId)
    ? req.query.unresolvedId[0]
    : req.query.unresolvedId;
  let unresolvedQuery = req.supabase
    .from("lineup_unresolved_player_names" as any)
    .select(
      "id, raw_name, normalized_name, team_id, team_abbreviation, source, source_url, tweet_id, context_text, status, metadata, created_at"
    );

  if (typeof unresolvedId === "string" && unresolvedId.trim()) {
    unresolvedQuery = unresolvedQuery.eq("id", unresolvedId.trim());
    if (!req.hasValidReviewToken) {
      unresolvedQuery = unresolvedQuery.eq("status", "pending");
    }
  } else {
    unresolvedQuery = unresolvedQuery.eq("status", "pending");
  }

  const { data: unresolvedRows, error: unresolvedError } = await unresolvedQuery
    .order("created_at", { ascending: false })
    .limit(limit);
  if (unresolvedError) throw unresolvedError;

  const registered = tweetPipelineFlags().interpretation ? await fetchRegisteredPlayerIdentities(req.supabase) : [];
  const directory = await fetchPlayerIdentityDirectory(req.supabase, registered);
  const players: PlayerOption[] = directory.map((player) => ({
    id: player.playerId, fullName: player.fullName, lastName: player.lastName,
    position: player.position ?? null, team_id: player.teamId ?? null,
  })).sort((a, b) => a.fullName.localeCompare(b.fullName));

  return res.json({
    success: true,
    unlinkedProspects: registered.filter((identity) => !identity.nhl_player_id),
    unresolvedNames: unresolvedRows ?? [],
    membershipReviewEnabled: tweetPipelineFlags().interpretation,
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
  if (!Number.isSafeInteger(playerId) || playerId <= 0) {
    return res.status(400).json({
      success: false,
      message: "Missing playerId."
    });
  }

  const { data: unresolved, error: unresolvedError } = await req.supabase
    .from("lineup_unresolved_player_names" as any)
    .select("id, raw_name, normalized_name, team_id, metadata")
    .eq("id", unresolvedId)
    .single();
  if (unresolvedError) throw unresolvedError;

  if (body.importNhlIdentity === true) {
    if (!tweetPipelineFlags().interpretation) return res.status(409).json({ success: false, message: "Prospect imports require the new identity pipeline." });
    // Re-fetch server-side; never trust a browser-supplied name or team association.
    const imported = await importNhlIdentity(req.supabase, await fetchNhlPlayerIdentity(playerId, true));
    if (imported.status === "review") return res.status(409).json({ success: false, message: `Identity needs review: ${imported.reason}` });
    if (!imported.availableToPipeline) return res.status(409).json({ success: false, message: "Identity recorded, but NHL profile details are incomplete. It remains pending for review." });
  }

  const { data: player, error: playerError } = await req.supabase
    .from("players")
    .select("id, fullName")
    .eq("id", playerId)
    .single();
  if (playerError) throw playerError;

  let membershipConfirmed = true;
  if (tweetPipelineFlags().interpretation && unresolved.team_id) {
    const seasonId = rosterSeasonForDate();
    if (body.membershipSourceUrl) {
      let evidenceUrl: URL;
      try { evidenceUrl = new URL(body.membershipSourceUrl); } catch { return res.status(400).json({ success: false, message: "Enter a valid NHL roster or camp source URL." }); }
      if (evidenceUrl.protocol !== "https:" || evidenceUrl.username || evidenceUrl.password || !(evidenceUrl.hostname === "nhl.com" || evidenceUrl.hostname.endsWith(".nhl.com") || evidenceUrl.hostname === "api-web.nhle.com")) {
        return res.status(400).json({ success: false, message: "Camp membership needs an HTTPS NHL.com or NHL API source." });
      }
      const membership = await req.supabase.from("tweet_player_memberships").upsert({
        player_id: playerId, team_id: unresolved.team_id, season_id: seasonId, membership_kind: "camp",
        source_url: evidenceUrl.toString(), verified_at: new Date().toISOString(), expires_at: new Date(Date.now() + 30 * 86400_000).toISOString(),
      }, { onConflict: "player_id,team_id,season_id,membership_kind" });
      if (membership.error) throw membership.error;
    } else {
      const roster = await fetchRosterEntriesByTeam({ supabase: req.supabase, teamIds: [unresolved.team_id], seasonId });
      membershipConfirmed = (roster.get(unresolved.team_id) ?? []).some((entry) => entry.playerId === playerId);
    }
  }

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
      status: membershipConfirmed ? "resolved" : "pending",
      ...(!membershipConfirmed ? { metadata: { ...unresolved.metadata, reviewKind: "missing_membership", identityResolved: true } } : {}),
      resolved_player_id: playerId,
      resolved_alias_id: aliasRow?.id ?? null,
      updated_at: new Date().toISOString()
    })
    .eq("id", unresolvedId);
  if (updateError) throw updateError;

  if (tweetPipelineFlags().interpretation) {
    const { error } = await req.supabase.from("tweet_pipeline_jobs").upsert({
      job_key: `alias-replay:${unresolvedId}`, status: "pending", attempts: 0, lease_expires_at: null, next_attempt_at: new Date().toISOString(),
      payload: { normalizedName: unresolved.normalized_name, teamId: unresolved.team_id, playerId, alias, afterId: null },
      updated_at: new Date().toISOString(),
    }, { onConflict: "job_key" });
    if (error) throw error;
  }

  return res.json({
    success: true,
    message: membershipConfirmed ? `Saved alias "${alias}" for ${player.fullName}.` : `Identity saved for ${player.fullName}. This name remains pending until roster or camp membership is verified.`
  });
}

async function playerNameAliasesHandler(req: any, res: NextApiResponse) {
  try {
    if (req.method === "GET") {
      return await handleGet(req, res);
    }
    if (req.method === "POST") {
      return await handlePost(req, res);
    }
    res.setHeader("Allow", "GET, POST");
    return res.status(405).json({
      success: false,
      message: "Method not allowed."
    });
  } catch (error) {
    return res.status(400).json({ success: false, message: error instanceof Error ? error.message : "Player identity request failed." });
  }
}

const adminHandler = adminOnly(playerNameAliasesHandler);

function getStringValue(value: unknown): string | null {
  if (Array.isArray(value)) return typeof value[0] === "string" ? value[0] : null;
  return typeof value === "string" ? value : null;
}

export default async function handler(req: any, res: NextApiResponse) {
  const body = typeof req.body === "string" ? JSON.parse(req.body || "{}") : req.body ?? {};
  const unresolvedId =
    req.method === "GET"
      ? getStringValue(req.query.unresolvedId)
      : getStringValue(body.unresolvedId);
  const reviewToken =
    req.method === "GET"
      ? getStringValue(req.query.reviewToken)
      : getStringValue(body.reviewToken);

  if (
    verifyPlayerAliasReviewToken({
      token: reviewToken,
      unresolvedId,
    })
  ) {
    req.body = body;
    req.supabase = serviceRoleClient;
    req.hasValidReviewToken = true;
    return playerNameAliasesHandler(req, res);
  }

  return adminHandler(req, res);
}
