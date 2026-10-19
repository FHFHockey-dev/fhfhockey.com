import type { SupabaseClient } from "@supabase/supabase-js";
import { normalizeEligibility } from "./eligibility";
import { withinDeadline } from "lib/rosterScheduleData/planningInputs";

import { yahooEligibilityCycle, type YahooEligibilityReceipt } from "./yahooEligibility";

const utcTimestamp = (value: unknown) => {
  if (typeof value !== "string") return NaN;
  // The existing writer supplies ISO UTC to a timestamp WITHOUT timezone column.
  const normalized = value.replace(" ", "T");
  return Date.parse(/(?:Z|[+-]\d{2}:?\d{2})$/.test(normalized) ? normalized : normalized + "Z");
};
export async function readYahooEligibilityCache(db: SupabaseClient<any>, seasonId: number, playerIds: string[], now = new Date()): Promise<YahooEligibilityReceipt> {
  const cycle = yahooEligibilityCycle(now);
  const receipt: YahooEligibilityReceipt = { seasonId, source: "yahoo_players", scope: "Yahoo default positions",
    expiresAt: cycle.expiresAt, players: [], status: "partial", limitations: ["Cached Yahoo default positions; current league roster, rules, locks and availability still require provider verification."] };
  if (!playerIds.length) return receipt;
  try {
    return await withinDeadline(Date.now() + 8000, async signal => {
      const season = Number(String(seasonId).slice(0, 4));
      const game = await db.from("yahoo_game_keys").select("game_id,game_key,code,season").eq("code", "nhl").eq("season", season).abortSignal(signal).limit(2);
      if (game.error || game.data?.length !== 1) throw new Error("game context");
      const gameKey = String(game.data[0].game_key ?? game.data[0].game_id ?? "");
      if (!/^\d+$/.test(gameKey) || Number(game.data[0].season) !== season) throw new Error("game context");
      const context = `yahoo:game:${gameKey}:season:${season}`;
      const identities = await db.from("fhfh_player_external_identities").select("external_player_id,fhfh_player_id")
        .eq("provider", "yahoo").eq("context_key", context).eq("season_id", seasonId).eq("verification_status", "verified")
        .in("fhfh_player_id", playerIds).abortSignal(signal).limit(playerIds.length * 2 + 1);
      if (identities.error || !Array.isArray(identities.data) || identities.data.length > playerIds.length * 2) throw new Error("identity coverage");
      const keys = [...new Set<string>(identities.data.map((row: any) => String(row.external_player_id)))].filter(key => new RegExp(`^${gameKey}\\.p\\.\\d+$`).test(key));
      if (!keys.length) return receipt;
      const [reverse, canonical, cached] = await Promise.all([
        db.from("fhfh_player_external_identities").select("external_player_id,fhfh_player_id")
          .eq("provider", "yahoo").eq("context_key", context).eq("season_id", seasonId).eq("verification_status", "verified")
          .in("external_player_id", keys).abortSignal(signal).limit(keys.length * 2 + 1),
        db.from("fhfh_player_identities").select("id,nhl_player_id").eq("verification_status", "verified")
          .is("merged_into_id", null).in("id", playerIds).abortSignal(signal).limit(playerIds.length + 1),
        db.from("yahoo_players").select("player_key,player_id,game_id,season,eligible_positions,position_type,last_updated")
          .eq("game_id", Number(gameKey)).eq("season", season).in("player_key", keys).abortSignal(signal).limit(keys.length + 1),
      ]);
      if ([reverse, canonical, cached].some(result => result.error || !Array.isArray(result.data))
        || (reverse.data?.length ?? 0) > keys.length * 2 || (canonical.data?.length ?? 0) > playerIds.length || (cached.data?.length ?? 0) > keys.length) throw new Error("cache coverage");
      const reverseRows = reverse.data ?? [], canonicalRows = canonical.data ?? [], cachedRows = cached.data ?? [];
      for (const id of playerIds) {
        const matches = identities.data.filter((row: any) => String(row.fhfh_player_id) === id);
        const identity = matches.length === 1 ? matches[0] : null;
        const key = identity && String(identity.external_player_id);
        if (!key || !keys.includes(key)) continue;
        const owners = reverseRows.filter((row: any) => row.external_player_id === key);
        if (owners.length !== 1) continue;
        if (String(owners[0].fhfh_player_id) !== id) {
          receipt.limitations.push("Forward and reverse Yahoo identity owners disagree; affected positions remain unverified.");
          continue;
        }
        const players = canonicalRows.filter((row: any) => String(row.id) === id);
        const rows = cachedRows.filter((row: any) => row.player_key === key);
        const row = rows.length === 1 ? rows[0] : null;
        const nhlId = players.length === 1 ? Number(players[0].nhl_player_id) : NaN;
        if (!row || !Number.isSafeInteger(nhlId) || nhlId <= 0 || row.game_id !== Number(gameKey) || row.season !== season
          || String(row.player_id) !== key.split(".p.")[1] || !Array.isArray(row.eligible_positions)) continue;
        const asOf = utcTimestamp(row.last_updated);
        const positions = row.eligible_positions.map((position: any) => position?.position);
        if (positions.some((position: unknown) => typeof position !== "string")) continue;
        const eligibility = normalizeEligibility(positions);
        if (!eligibility.valid || asOf < cycle.due || asOf > now.getTime()
          || !Number.isFinite(asOf) || row.position_type !== (eligibility.playerClass === "goalie" ? "G" : "P")) continue;
        receipt.players.push({ playerId: id, nhlId, providerId: key, positions: [...eligibility.positions],
          playerClass: eligibility.playerClass!, asOf: new Date(asOf).toISOString() });
      }
      if (receipt.players.length < playerIds.length) receipt.limitations.push("Some cached positions are missing, stale or have unresolved identity; those players remain unverified.");
      receipt.status = receipt.players.length === playerIds.length ? "ready" : "partial";
      return receipt;
    });
  } catch { receipt.limitations.push("Stored Yahoo eligibility could not be read; no cached positions were admitted."); receipt.players = []; receipt.status = "error"; }
  return receipt;
}

