import type { PlanningPlayer, PlanningSnapshot } from "./planningTypes";
import { normalizeEligibility } from "./eligibility";

export type CachedYahooEligibility = {
  playerId: string; nhlId: number; providerId: string; positions: string[];
  playerClass: "skater" | "goalie"; asOf: string;
};
export type YahooEligibilityReceipt = {
  seasonId: number; source: "yahoo_players"; scope: "Yahoo default positions";
  expiresAt: string; players: CachedYahooEligibility[]; limitations: string[];
  status: "ready" | "partial" | "error";
};

/** Existing update-yahoo-players job106 runs at 08:40 UTC daily; not a new TTL. */
export function yahooEligibilityCycle(now: Date) {
  const due = new Date(now); due.setUTCHours(8, 40, 0, 0);
  if (due > now) due.setUTCDate(due.getUTCDate() - 1);
  return { due: due.getTime(), expiresAt: new Date(due.getTime() + 86400000).toISOString() };
}
export function cachedYahooPlayer(player: PlanningPlayer, receipt: YahooEligibilityReceipt | null, seasonId: number, now = new Date()): PlanningPlayer {
  if (!receipt || receipt.source !== "yahoo_players" || receipt.scope !== "Yahoo default positions" || receipt.seasonId !== seasonId
    || receipt.expiresAt !== yahooEligibilityCycle(now).expiresAt || player.eligibilityVerified === true) return player;
  const entry = receipt.players.find(entry => entry.playerId === player.id);
  if (!entry || entry.nhlId !== player.nhlId || entry.playerClass !== player.playerClass || !Number.isFinite(Date.parse(entry.asOf))
    || Date.parse(entry.asOf) < yahooEligibilityCycle(now).due || Date.parse(entry.asOf) > now.getTime()
    || !normalizeEligibility(entry.positions).valid) return player;
  return { ...player, eligiblePositions: entry.positions, eligibilityVerified: true };
}

/** Cache can improve provisional retained analysis; a live league snapshot always wins. */
export function withCachedYahooEligibility(snapshot: PlanningSnapshot, receipt: YahooEligibilityReceipt | null, now = new Date()): PlanningSnapshot {
  if (!receipt || !snapshot.evidence.roster || snapshot.context.provider !== "yahoo" || !snapshot.id.startsWith("retained:")
    || receipt.seasonId !== snapshot.context.seasonId || Date.parse(receipt.expiresAt) <= now.getTime()) return snapshot;
  return { ...snapshot, players: snapshot.players.map(player => player.nhlTeamId && player.rosterRevision
    ? cachedYahooPlayer(player, receipt, snapshot.context.seasonId, now) : player), evidence: { ...snapshot.evidence, roster: { ...snapshot.evidence.roster!,
    limitations: [...snapshot.evidence.roster!.limitations, ...receipt.limitations] } } };
}
