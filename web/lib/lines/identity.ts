import { normalizeIdentityName, resolvePlayerIdentity, rosterSeasonForDate, type PlayerIdentity } from "lib/sources/playerIdentity";
import type { TweetInitialsEvidence, TweetUnit } from "lib/sources/tweetInterpretation";
import { canonicalAcronymMatches } from "lib/sources/tweetNameLexicon";
import { timestampMicros } from "lib/projections/evidenceTime";
import { sourceLocalDate } from "./binding";
import { instant } from "./types";

export type EventMembership = { playerId: number; teamId: number; seasonId?: number | null; from: string; until: string | null; evidenceId: string };
export type ApprovedEventAlias = { raw: string; playerId: number; approvedAt: string; revisedAt?: string; evidenceId: string };

function membershipInstant(value: string | null) {
  if (!value) return null;
  const ms = instant(value);
  return ms == null ? null : timestampMicros(value) ?? BigInt(ms) * BigInt(1000);
}

/** Resolve against intervals at the claimed event, never today's roster alone. */
export function resolveEventUnit(unit: TweetUnit, args: { teamId: number; effectiveAt: string | null; players: PlayerIdentity[]; memberships: EventMembership[]; aliases: ApprovedEventAlias[]; sourcePublishedAt?: string | null; uniqueInitials?: TweetInitialsEvidence[] }) {
  const at = membershipInstant(args.effectiveAt), reasons: string[] = [], evidence: string[] = [];
  if (at == null) return { unit, reasons: ["identity_event_time_unresolved"], evidence };
  const day = sourceLocalDate(args.effectiveAt, "America/New_York");
  const season = day ? rosterSeasonForDate(day) : null;
  const members = args.memberships.filter((row) => {
    // A club can leave last season's roster row open after the player's transfer.
    if (row.seasonId != null && row.seasonId !== season) return false;
    const start = membershipInstant(row.from), end = membershipInstant(row.until);
    return start != null && start <= at && (!row.until || end != null && end > at);
  });
  const published = membershipInstant(args.sourcePublishedAt ?? null);
  const aliases = published == null ? args.aliases : args.aliases.filter(alias => {
    const revised = membershipInstant(alias.revisedAt ?? alias.approvedAt);
    return revised != null && revised <= published;
  });
  const roster = args.players.map((player) => {
    const teams = new Set(members.filter((row) => row.playerId === player.playerId).map((row) => row.teamId));
    return { ...player, aliases: aliases.filter((alias) => alias.playerId === player.playerId && instant(alias.approvedAt) != null).map((alias) => alias.raw), teamId: teams.size === 1 ? [...teams][0] : null };
  });
  const resolved = unit.players.map((player, index) => {
    const span = unit.evidence[index];
    const raw = span?.text ?? player.name;
    let result = resolvePlayerIdentity(raw, roster, args.teamId);
    if (result.status === "missing_player" && span) {
      const hit = args.uniqueInitials?.find((entry) => entry.teamId === args.teamId && entry.playerId === player.playerId
        && entry.start === span.start && entry.end === span.end && entry.text === raw);
      const member = hit && roster.find((entry) => entry.teamId === hit.teamId && entry.playerId === hit.playerId);
      if (member && canonicalAcronymMatches(raw, member.fullName)) {
        result = { status: "matched", player: member, basis: "initial" };
        evidence.push(`tweet_initials:${hit.teamId}:${hit.playerId}:${hit.start}-${hit.end}`);
      }
    }
    if (result.status !== "matched") { reasons.push(`identity:${raw}:${result.status}`); return player; }
    // playerId 0 marks a name the interpretation left unassigned (a swap literal); only an assigned id can mismatch.
    if (player.playerId > 0 && result.player.playerId !== player.playerId) { reasons.push(`identity:${raw}:interpretation_mismatch`); return player; }
    evidence.push(...members.filter((row) => row.playerId === player.playerId && row.teamId === args.teamId).map((row) => row.evidenceId));
    if (result.basis === "alias") evidence.push(...aliases.filter((alias) => alias.playerId === player.playerId && normalizeIdentityName(alias.raw) === normalizeIdentityName(raw)).map((alias) => alias.evidenceId));
    return { playerId: result.player.playerId, name: result.player.fullName };
  });
  return { unit: { ...unit, players: resolved }, reasons, evidence: [...new Set(evidence)] };
}
