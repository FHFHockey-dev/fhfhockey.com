import { normalizeIdentityName, resolvePlayerIdentity, type PlayerIdentity } from "lib/sources/playerIdentity";
import type { TweetUnit } from "lib/sources/tweetInterpretation";
import { instant } from "./types";

export type EventMembership = { playerId: number; teamId: number; from: string; until: string | null; evidenceId: string };
export type ApprovedEventAlias = { raw: string; playerId: number; approvedAt: string; evidenceId: string };

/** Resolve against intervals at the claimed event, never today's roster alone. */
export function resolveEventUnit(unit: TweetUnit, args: { teamId: number; effectiveAt: string | null; players: PlayerIdentity[]; memberships: EventMembership[]; aliases: ApprovedEventAlias[] }) {
  const at = instant(args.effectiveAt), reasons: string[] = [], evidence: string[] = [];
  if (at == null) return { unit, reasons: ["identity_event_time_unresolved"], evidence };
  const members = args.memberships.filter((row) => instant(row.from) != null && instant(row.from)! <= at && (!row.until || instant(row.until) != null && instant(row.until)! > at));
  const roster = args.players.map((player) => {
    const teams = new Set(members.filter((row) => row.playerId === player.playerId).map((row) => row.teamId));
    return { ...player, aliases: args.aliases.filter((alias) => alias.playerId === player.playerId && instant(alias.approvedAt) != null).map((alias) => alias.raw), teamId: teams.size === 1 ? [...teams][0] : null };
  });
  const resolved = unit.players.map((player, index) => {
    const raw = unit.evidence[index]?.text ?? player.name;
    const result = resolvePlayerIdentity(raw, roster, args.teamId);
    if (result.status !== "matched") { reasons.push(`identity:${raw}:${result.status}`); return player; }
    if (result.player.playerId !== player.playerId) { reasons.push(`identity:${raw}:interpretation_mismatch`); return player; }
    evidence.push(...members.filter((row) => row.playerId === player.playerId && row.teamId === args.teamId).map((row) => row.evidenceId));
    if (result.basis === "alias") evidence.push(...args.aliases.filter((alias) => alias.playerId === player.playerId && normalizeIdentityName(alias.raw) === normalizeIdentityName(raw)).map((alias) => alias.evidenceId));
    return { playerId: result.player.playerId, name: result.player.fullName };
  });
  return { unit: { ...unit, players: resolved }, reasons, evidence: [...new Set(evidence)] };
}
