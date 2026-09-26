import type { NextApiRequest, NextApiResponse } from "next";

import { requireApiUser } from "lib/api/requireApiUser";
import { fantraxEligiblePositions, type FantraxDisplayPlayer } from "lib/draftDashboard/fantraxDisplay";
import { getFantraxAdp, getFantraxLeagueInfo, getFantraxPlayerIds } from "lib/integrations/fantrax/client";
import { respondWithFantraxError } from "lib/integrations/fantrax/http";
import { fantraxPlayerName } from "lib/integrations/fantrax/playerIdentity";
import { getFantraxConnections } from "lib/integrations/fantrax/server";

type PlayerData = { players: FantraxDisplayPlayer[]; eligibilityLoaded: boolean };
const cached = new Map<string, { data: PlayerData; expiresAt: number }>();
const pending = new Map<string, Promise<PlayerData>>();

async function playerData(leagueKey: string) {
  const prior = cached.get(leagueKey);
  if (prior && prior.expiresAt > Date.now()) return prior.data;
  if (!pending.has(leagueKey)) pending.set(leagueKey, (async () => {
    const [catalog, adpRows, leagueInfo] = await Promise.all([
      getFantraxPlayerIds(), getFantraxAdp(),
      getFantraxLeagueInfo(leagueKey).catch(() => null),
    ]);
    const playerInfo = leagueInfo && typeof leagueInfo === "object" && "playerInfo" in leagueInfo
      ? leagueInfo.playerInfo as Record<string, { eligiblePos?: unknown }>
      : null;
    const adpById = new Map(adpRows.map((row) => [row.id, row.ADP]));
    const players = Object.entries(catalog).flatMap(([id, player]) => {
      const name = fantraxPlayerName(player);
      if (player.fantraxId !== id || !name) return [];
      const adp = adpById.get(id);
      const eligiblePos = playerInfo?.[id]?.eligiblePos;
      const eligiblePositions = fantraxEligiblePositions(eligiblePos);
      return [{
        id,
        name,
        team: player.team && player.team !== "(N/A)" ? player.team : null,
        position: player.position,
        eligiblePositions,
        adp: adp != null && adp > 0 && adp < 10000 ? adp : null,
      }];
    });
    const data = { players, eligibilityLoaded: Boolean(playerInfo) };
    if (cached.size >= 8 && !cached.has(leagueKey)) {
      const oldest = cached.keys().next().value;
      if (oldest) cached.delete(oldest);
    }
    cached.set(leagueKey, { data, expiresAt: Date.now() + 30 * 60_000 });
    return data;
  })());
  try { return await pending.get(leagueKey)!; } finally { pending.delete(leagueKey); }
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ error: "Method Not Allowed" });
  }
  const user = await requireApiUser(req, res);
  if (!user) return;
  try {
    const leagueId = typeof req.query.externalLeagueId === "string" ? req.query.externalLeagueId : "";
    const connections = await getFantraxConnections({ userId: user.id });
    const league = connections.accounts.flatMap((account) => account.leagues).find((candidate) => candidate.id === leagueId);
    if (!league) return res.status(404).json({ error: "Choose a linked Fantrax league first." });
    return res.status(200).json(await playerData(league.externalLeagueKey));
  } catch (error) {
    return respondWithFantraxError(res, error, "Fantrax player data is unavailable. Draft picks can still sync.");
  }
}
