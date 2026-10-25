import { fetchNhlPlayerIdentity, importNhlIdentity } from "lib/sources/nhlProspectIdentity";
import type { NextApiResponse } from "next";

import { fetchPlayerIdentityDirectory, fetchRegisteredPlayerIdentities, normalizeIdentityName, rosterSeasonForDate } from "lib/sources/playerIdentity";
import { fetchRosterEntriesByTeam } from "lib/sources/lineSourceProcessing";
import { tweetPipelineFlags } from "lib/sources/tweetInterpretation";
import { normalizePlayerNameAlias } from "lib/sources/playerNameAliases";
import { verifyPlayerAliasReviewToken } from "lib/sources/playerAliasReviewToken";
import { aliasReviewNameCandidates, capturedAliasReviewPlayers, getAliasReviewOccurrence, preferredAliasReviewCandidate } from "lib/sources/playerAliasReview";
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

async function hasAmbiguousSurnameAlias(supabase: any, aliases: Array<{ alias: string; lastName?: string }>) {
  const surnames = aliases.filter((part) => part.lastName && normalizeIdentityName(part.alias) === normalizeIdentityName(part.lastName)).map((part) => normalizeIdentityName(part.alias));
  if (!surnames.length) return false;
  const directory = await fetchPlayerIdentityDirectory(supabase);
  return surnames.some((surname) => directory.filter((identity) => normalizeIdentityName(identity.lastName) === surname).length > 1);
}

async function buildAliasReviews(supabase: any, rows: any[], players: PlayerOption[]) {
  const keys = [...new Set(rows.map((row) => row.metadata?.captureKey).filter((key) => typeof key === "string"))].slice(0, 50);
  const snapshots = keys.length ? await supabase.from("line_source_snapshots")
    .select("capture_key, snapshot_date, tweet_posted_at, team_id, roster_revision:metadata->interpretation->>rosterRevision")
    .in("capture_key", keys).limit(keys.length) : { data: [], error: null };
  if (snapshots.error) throw snapshots.error;
  const contexts = rows.map((row) => {
    const snapshot = snapshots.data?.find((value: any) => value.capture_key === row.metadata?.captureKey && value.team_id === row.team_id);
    const sourceTime = snapshot?.tweet_posted_at ?? row.metadata?.sourcePublishedAt ?? row.metadata?.captureKey?.match(/(?:^|:)(\d{4}-\d{2}-\d{2})(?=:|$)/)?.[1] ?? null;
    const validTime = typeof sourceTime === "string" && Number.isFinite(Date.parse(sourceTime)) ? sourceTime : null;
    const captured = capturedAliasReviewPlayers(snapshot?.roster_revision);
    const occurrence = getAliasReviewOccurrence(row);
    const names = aliasReviewNameCandidates(occurrence?.text ?? row.raw_name, captured.length ? captured : players);
    return { row, sourceTime: validTime, sourceDate: validTime?.slice(0, 10) ?? null, seasonId: validTime ? rosterSeasonForDate(validTime) : null, names, captured: captured.length > 0, occurrence };
  });
  const ids = [...new Set(contexts.flatMap((context) => context.names.map((player) => player.id)))];
  const seasons = [...new Set(contexts.map((context) => context.seasonId).filter(Boolean))];
  const membershipRows = ids.length && seasons.length ? await supabase.from("rosters")
    .select("playerId,teamId,seasonId,created_at,ended_at,is_current").in("playerId", ids.slice(0, 500)).in("seasonId", seasons).limit(1000) : { data: [], error: null };
  if (membershipRows.error) throw membershipRows.error;
  return contexts.map((context) => {
    const time = context.sourceTime ? Date.parse(context.sourceTime) : null;
    const candidates = context.names.filter((player) => {
      if (time == null || membershipRows.data?.length === 1000) return false;
      const active = (membershipRows.data ?? []).filter((membership: any) => Number(membership.playerId) === player.id && Number(membership.seasonId) === context.seasonId
        && Date.parse(membership.created_at) <= time && (membership.ended_at ? Date.parse(membership.ended_at) > time : membership.is_current === true));
      const teams = new Set(active.map((membership: any) => Number(membership.teamId)));
      return teams.size === 1 && teams.has(context.row.team_id) && (!context.captured || player.team_id === context.row.team_id);
    }).map((player) => ({ ...player, team_id: context.row.team_id, position: context.captured ? player.position : null }));
    const preference = preferredAliasReviewCandidate(context.row, candidates, context.occurrence);
    const effectiveName = context.occurrence?.text ?? context.row.raw_name;
    const surnameCandidates = aliasReviewNameCandidates(effectiveName, players);
    const ambiguousSurname = surnameCandidates.length > 1 && surnameCandidates.every((player) => normalizeIdentityName(player.lastName) === normalizeIdentityName(effectiveName));
    return { sourceDate: context.sourceDate, sourcePublishedAt: context.sourceTime, seasonId: context.seasonId, teamId: context.row.team_id, candidates,
      preferredPlayerId: preference.playerId, preferenceReason: preference.basis, ambiguousSurname,
      scopeMessage: candidates.length ? "Candidates have roster intervals supporting the recorded source time, team and season." : "No dated roster support for this source scope. Current team labels do not establish historical membership." };
  });
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
      "id, raw_name, normalized_name, team_id, team_abbreviation, source, source_url, tweet_id, context_text, status, metadata, resolved_player_id, resolved_alias_id, created_at"
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
  const reviews = await buildAliasReviews(req.supabase, unresolvedRows ?? [], players);

  return res.json({
    success: true,
    unlinkedProspects: registered.filter((identity) => !identity.nhl_player_id),
    unresolvedNames: (unresolvedRows ?? []).map((row: any, index: number) => ({ ...row, review: reviews[index] })),
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

  if (action === "split") {
    const parts: Array<{ playerId: number; alias: string }> = Array.isArray(body.parts)
      ? body.parts.map((part: any) => ({ playerId: Number(part?.playerId), alias: typeof part?.alias === "string" ? part.alias.trim() : "" }))
      : [];
    if (parts.length !== 2 || parts.some((part) => !Number.isSafeInteger(part.playerId) || part.playerId <= 0 || !normalizePlayerNameAlias(part.alias))) {
      return res.status(400).json({ success: false, message: "Choose two players and provide both aliases." });
    }
    if (parts[0].playerId === parts[1].playerId) {
      return res.status(400).json({ success: false, message: "Choose two different players." });
    }
    const { data: unresolved, error: unresolvedError } = await req.supabase.from("lineup_unresolved_player_names" as any)
      .select("id, raw_name, team_id, metadata").eq("id", unresolvedId).single();
    if (unresolvedError) throw unresolvedError;
    const playerIds = parts.map((part: any) => Number(part.playerId));
    const { data: players, error: playersError } = await req.supabase.from("players").select("id, fullName, lastName").in("id", playerIds);
    if (playersError) throw playersError;
    if (!players || players.length !== 2) return res.status(400).json({ success: false, message: "Both players must exist." });
    if (await hasAmbiguousSurnameAlias(req.supabase, parts.map((part) => ({ alias: part.alias, lastName: players.find((player: any) => Number(player.id) === part.playerId)?.lastName })))) {
      return res.status(409).json({ success: false, message: "Use initials or full names for shared surnames; a split must not learn blanket surname aliases." });
    }
    let membershipConfirmed = true;
    if (tweetPipelineFlags().interpretation && unresolved.team_id) {
      const roster = await fetchRosterEntriesByTeam({ supabase: req.supabase, teamIds: [unresolved.team_id], seasonId: rosterSeasonForDate() });
      membershipConfirmed = playerIds.every((playerId) => (roster.get(unresolved.team_id) ?? []).some((entry) => entry.playerId === playerId));
    }
    const aliases = parts.map((part: any) => ({ alias: String(part.alias).trim(), normalized_alias: normalizePlayerNameAlias(String(part.alias)), player_id: Number(part.playerId), player_name: players.find((player: any) => Number(player.id) === Number(part.playerId))?.fullName, team_id: unresolved.team_id ?? null, source: "manual", updated_at: new Date().toISOString() }));
    const { error: aliasError } = await req.supabase.from("lineup_player_name_aliases" as any).upsert(aliases, { onConflict: "normalized_alias,player_id" });
    if (aliasError) throw aliasError;
    const { error: updateError } = await req.supabase.from("lineup_unresolved_player_names" as any).update({
      status: membershipConfirmed ? "resolved" : "pending",
      resolved_player_id: playerIds[0], resolved_alias_id: null,
      metadata: { ...unresolved.metadata, savedAlias: null, identityResolved: true, reviewKind: membershipConfirmed ? "invalid_extraction" : "missing_membership", splitPlayerIds: playerIds, splitAliases: aliases.map((alias: any) => alias.alias) },
      updated_at: new Date().toISOString(),
    }).eq("id", unresolvedId);
    if (updateError) throw updateError;
    return res.json({ success: true, message: `Saved separate aliases for ${aliases.map((alias: any) => alias.player_name).join(" and ")}.${membershipConfirmed ? "" : " Membership still needs review."} This does not confirm a lineup or defense pairing.` });
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
    .select("id, raw_name, normalized_name, team_id, context_text, metadata")
    .eq("id", unresolvedId)
    .single();
  if (unresolvedError) throw unresolvedError;

  if (body.importNhlIdentity === true && action !== "assign_occurrence") {
    if (!tweetPipelineFlags().interpretation) return res.status(409).json({ success: false, message: "Prospect imports require the new identity pipeline." });
    // Re-fetch server-side; never trust a browser-supplied name or team association.
    const imported = await importNhlIdentity(req.supabase, await fetchNhlPlayerIdentity(playerId, true));
    if (imported.status === "review") return res.status(409).json({ success: false, message: `Identity needs review: ${imported.reason}` });
    if (!imported.availableToPipeline) return res.status(409).json({ success: false, message: "Identity recorded, but NHL profile details are incomplete. It remains pending for review." });
  }

  const { data: player, error: playerError } = await req.supabase
    .from("players")
    .select("id, fullName, lastName")
    .eq("id", playerId)
    .single();
  if (playerError) throw playerError;

  const alias = typeof body.alias === "string" && body.alias.trim() ? body.alias.trim() : unresolved.raw_name;
  const normalizedAlias = normalizePlayerNameAlias(alias);

  if (action === "assign_occurrence") {
    if (!getAliasReviewOccurrence(unresolved)) return res.status(409).json({ success: false, message: "The exact source occurrence is unavailable. Review the ambiguous context before assigning." });
    const directory = await fetchPlayerIdentityDirectory(req.supabase);
    const [review] = await buildAliasReviews(req.supabase, [unresolved], directory.map((identity) => ({ id: identity.playerId, fullName: identity.fullName, lastName: identity.lastName, position: identity.position ?? null, team_id: identity.teamId ?? null })));
    const supported = review.candidates.some((candidate) => candidate.id === playerId);
    const metadata = { ...unresolved.metadata, resolutionScope: "occurrence", identityResolved: true, savedAlias: null, reviewKind: supported ? null : "missing_membership" };
    delete metadata.splitPlayerIds; delete metadata.splitAliases;
    const { error } = await req.supabase.from("lineup_unresolved_player_names").update({ status: supported ? "resolved" : "pending", resolved_player_id: playerId, resolved_alias_id: null, metadata, updated_at: new Date().toISOString() }).eq("id", unresolvedId);
    if (error) throw error;
    return res.json({ success: true, message: `Assigned this occurrence to ${player.fullName}.${supported ? "" : " Dated membership still needs review."} No surname alias was learned.` });
  }

  if (player.lastName && normalizeIdentityName(alias) === normalizeIdentityName(player.lastName)) {
    if ((unresolved.metadata?.candidates?.length ?? 0) > 1 || await hasAmbiguousSurnameAlias(req.supabase, [{ alias, lastName: player.lastName }])) {
      return res.status(409).json({ success: false, message: "This surname has multiple identities. Assign this occurrence instead of learning a blanket alias." });
    }
  }

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

  const reviewMetadata = { ...unresolved.metadata };
  delete reviewMetadata.splitPlayerIds;
  delete reviewMetadata.splitAliases;
  delete reviewMetadata.resolutionScope;
  const { error: updateError } = await req.supabase
    .from("lineup_unresolved_player_names" as any)
    .update({
      status: membershipConfirmed ? "resolved" : "pending",
      metadata: { ...reviewMetadata, reviewKind: membershipConfirmed ? null : "missing_membership", identityResolved: true, savedAlias: alias },
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
