import type { NextApiRequest, NextApiResponse } from "next";

import { requireApiUser } from "lib/api/requireApiUser";
import { getDraftProFeatureFlags } from "lib/draft-pro/features";
import { loadDraftProAccess } from "lib/draft-pro/server";
import { getFantraxAdp, getFantraxLeagueInfo, getFantraxPlayerIds } from "lib/integrations/fantrax/client";
import { getFantraxConnections } from "lib/integrations/fantrax/server";

type FantraxPlayer = { id: string; name: string; team: string | null; positions: string[]; adp: number | null };
let cached: { expiresAt: number; players: FantraxPlayer[] } | null = null;
let pending: Promise<FantraxPlayer[]> | null = null;
const leaguePositionsCache = new Map<string, { expiresAt: number; positions: Record<string, string[]> }>();

async function loadPlayers(): Promise<FantraxPlayer[]> {
  if (cached && cached.expiresAt > Date.now()) return cached.players;
  if (!pending) {
    pending = (async () => {
      const [adpRows, playerIds] = await Promise.all([getFantraxAdp(), getFantraxPlayerIds()]);
      const adpById = new Map(adpRows.map((row) => [row.id, row.ADP]));
      const players = Object.entries(playerIds).map(([id, player]) => ({
        id,
        name: player.name,
        team: player.team ?? null,
        positions: player.position?.split(/[,/]/).map((position) => position.trim()).filter(Boolean) ?? [],
        adp: adpById.get(id) ?? null,
      }));
      cached = { players, expiresAt: Date.now() + 30 * 60 * 1000 };
      return players;
    })().finally(() => { pending = null; });
  }
  return pending;
}

async function loadLeaguePositions(externalLeagueKey: string): Promise<Record<string, string[]>> {
  const existing = leaguePositionsCache.get(externalLeagueKey);
  if (existing && existing.expiresAt > Date.now()) return existing.positions;
  const payload = await getFantraxLeagueInfo(externalLeagueKey) as { playerInfo?: Record<string, { eligiblePos?: string }> };
  const positions = Object.fromEntries(Object.entries(payload.playerInfo ?? {}).flatMap(([id, player]) => {
    if (typeof player?.eligiblePos !== "string") return [];
    return [[id, player.eligiblePos.split(/[,/]/).map((position) => position.trim()).filter(Boolean)]];
  }));
  if (Object.keys(positions).length) leaguePositionsCache.set(externalLeagueKey, { positions, expiresAt: Date.now() + 30 * 60 * 1000 });
  return positions;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  res.setHeader("Cache-Control", "private, no-store");
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ error: "Method not allowed." });
  }
  const user = await requireApiUser(req, res, {
    onUnauthorized: (message) => res.status(401).json({ error: message }),
  });
  if (!user) return;
  try {
    const access = await loadDraftProAccess(user.id, {
      now: new Date(), flags: getDraftProFeatureFlags(), patreonVerificationAvailable: true,
    });
    if (!access.eligible) return res.status(403).json({ error: "Draft Pro access is required." });
    const basePlayers = await loadPlayers();
    if (req.query.includeLeaguePositions !== "1") return res.status(200).json({ players: basePlayers, hasLeagueEligibility: false });
    try {
      const connections = await getFantraxConnections({ userId: user.id });
      const requestedLeagueId = typeof req.query.leagueId === "string" ? req.query.leagueId : connections.defaultExternalLeagueId;
      const league = connections.accounts.flatMap((account) => account.leagues).find((entry) => entry.id === requestedLeagueId);
      if (!league) return res.status(200).json({ players: basePlayers, hasLeagueEligibility: false });
      const leaguePositions = await loadLeaguePositions(league.externalLeagueKey);
      if (!Object.keys(leaguePositions).length) return res.status(200).json({ players: basePlayers, hasLeagueEligibility: false });
      const players = basePlayers.map((player) => ({ ...player, positions: leaguePositions[player.id] ?? player.positions }));
      return res.status(200).json({ players, hasLeagueEligibility: true });
    } catch {
      return res.status(200).json({ players: basePlayers, hasLeagueEligibility: false });
    }
  } catch {
    return res.status(502).json({ error: "Fantrax player data is temporarily unavailable." });
  }
}
