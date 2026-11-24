import { teamsInfo } from "../teamsInfo";
import { sourceLocalDate } from "../lines/binding";
import { NHL_TEAM_TIMEZONES_BY_ID } from "../xg/travelFatigue";
import type { PlayerIdentity } from "./playerIdentity";
import type { EvidenceSpan } from "./tweetInterpretation";
import type { TweetPlayerEvent } from "./tweetPlayerEvents";
import type { TweetRosterNameMatch } from "./tweetNameInference";
import { tweetPublicationFromUrl } from "./tweetPublicationTime";

export type ReportedLineupEntry = { playerId: number; playerName: string; evidence: EvidenceSpan };

/** Read the player list from a direct, club-specific game participation report. */
export function playingTonightSubjects(text: string, teamId: number | null | undefined): string[] {
  const match = /^([\p{L}\p{M}.'’ ,&-]+?) will play tonight for (?:the )?([\p{L} .'-]+?)[.!]?$/iu.exec(text);
  if (!match || !teamId) return [];
  const team = Object.values(teamsInfo).find(club => club.id === teamId);
  if (!team || ![team.name, team.location, team.shortName, team.abbrev].some(name => name?.toLowerCase() === match[2]!.toLowerCase())) return [];
  return match[1]!.split(/\s*(?:,\s*(?:and\s+)?|&|\band\b)\s*/i);
}

// This single-subject bulletin repeats its heading in the predicate and names the opponent and weekday.
// Keep the trailing transport link outside the literal evidence.
const EXPECTED_BULLETIN = /^(([\p{L}.'’ -]+): Line Change: ([\p{L}.'’ -]+) is expected to draw (?:back )?into the line-?up vs\.? ([\p{L}.'’ -]+) on (Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday)\.?)(?: https:\/\/t\.co\/[A-Za-z0-9]+)?$/iu;

export function expectedLineupBulletin(text: string) {
  const match = EXPECTED_BULLETIN.exec(text);
  if (!match || !match[2]!.endsWith(" " + match[3]!)) return null;
  return { evidence: { start: 0, end: match[1]!.length, text: match[1]! }, fullName: match[2]!, surname: match[3]!,
    opponent: match[4]!, weekday: match[5]! };
}

export function bulletinNamesOpponent(label: string, id: number) {
  const club = Object.values(teamsInfo).find(team => team.id === id);
  return !!club && [club.name, club.shortName, club.location, club.abbrev].some(name => name?.toLowerCase() === label.toLowerCase());
}

export function expectedLineupFitsGame(report: NonNullable<ReturnType<typeof expectedLineupBulletin>>, teamId: number, opponentId: number, date: string) {
  if (opponentId === teamId || !bulletinNamesOpponent(report.opponent, opponentId)) return false;
  return new Date(date + "T12:00:00Z").toLocaleDateString("en-US", { weekday: "long", timeZone: "UTC" }) === report.weekday;
}

export function expectedLineupEvent(text: string, args: { rosters: Map<number, PlayerIdentity[]>; teamId: number; opponentId: number;
  publishedAt: string; gameDate: string; postId: string; review: TweetRosterNameMatch[] }): TweetPlayerEvent | null {
  const report = expectedLineupBulletin(text);
  if (!report) return null;
  const { teamId, opponentId, publishedAt, gameDate } = args;
  const postTime = tweetPublicationFromUrl(`https://x.com/DFOFantasy/status/${args.postId}`);
  if (!postTime || Math.floor(Date.parse(postTime) / 1000) !== Math.floor(Date.parse(publishedAt) / 1000)) return null;
  const matches = [...args.rosters.values()].flat().filter(player => player.fullName === report.fullName);
  if (matches.length !== 1 || matches[0]!.lastName !== report.surname || matches[0]!.teamId !== teamId
    || !expectedLineupFitsGame(report, teamId, opponentId, gameDate)) return null;
  const date = sourceLocalDate(publishedAt, NHL_TEAM_TIMEZONES_BY_ID[teamId]);
  if (!date || date !== gameDate) return null;
  const player = matches[0]!;
  const surnameStart = report.fullName.length + ": Line Change: ".length;
  if (args.review.some(hit => hit.reason !== "ambiguous_name" || hit.rawName !== player.lastName
    || hit.start !== surnameStart || hit.end !== surnameStart + player.lastName.length
    || (hit.teamId != null && hit.teamId !== teamId) || !hit.candidatePlayerIds.includes(player.playerId))) return null;
  return { playerId: player.playerId, playerName: player.fullName, teamId, kind: "participation", state: "projected", modality: "tentative",
    availability: "uncertain", availabilityScope: "game", resolutionBasis: "full_name", evidence: report.evidence, effectiveDate: date,
    times: { observation: publishedAt, reference: null, applicability: "unresolved" }, timeline: null, timelines: [] };
}

/** Keep the literal, full-name declaration. A substring of a question or an expectation is insufficient. */
export function reportedLineupEntries(text: string, changes: unknown, events: unknown, opponentId: number): ReportedLineupEntry[] {
  const opponent = Object.values(teamsInfo).find(team => team.id === opponentId);
  if (!opponent || !Array.isArray(changes) || !Array.isArray(events) || /\b(?:if|unless|could|might|may|would|expected|projected|projections?|possible|looks? like|perhaps|likely|no decision|uncertain|practice|warmups?|yesterday|tomorrow|previous|last (?:game|night)|correct(?:ion|ed)|update|instead|retracted|disregard|incorrect|false|hypothetical|unconfirmed|rumou?r|speculation)\b|[?“”"]/i.test(text)) return [];
  const opponentNames = [opponent.name, opponent.shortName, opponent.abbrev, opponent.shortName.split(" ").at(-1)!].map(s => s.toLowerCase());
  for (const cue of text.matchAll(/\b(?:against|vs\.?|versus)\s+(?:the\s+)?#?/gi)) {
    const named = text.slice(cue.index + cue[0].length).toLowerCase();
    if (!opponentNames.some(name => named.startsWith(name) && !/^\p{L}/u.test(named.slice(name.length)))) return [];
  }
  return changes.flatMap(change => {
    if (change?.kind !== "draws_in" || change.situation !== "lineup" || change.playersIn?.length !== 1
      || change.playersOut?.length !== 0 || change.unresolved?.length !== 0) return [];
    const player = change.playersIn[0], span = change.evidence, name = player?.evidence;
    if (!span || !name || !Number.isSafeInteger(player.playerId) || player.playerId <= 0 || typeof player.name !== "string" || !player.name.includes(" ") || player.name !== name.text
      || !Number.isSafeInteger(span.start) || span.start < 0 || span.start !== name.start || name.end !== name.start + name.text.length
      || span.end !== span.start + span.text?.length || text.slice(span.start, span.end) !== span.text
      || text.slice(name.start, name.end) !== player.name || !/^\s+draws\s+(?:back\s+)?into\s+the\s+line[ -]?up$/i.test(text.slice(name.end, span.end))) return [];
    // The statement must start a sentence or a list item. Check its continuation for conditions or a different day.
    const before = text.slice(0, span.start).replace(/^RT @\w+:\s*/i, "").split(/[.!;\n]/u).at(-1)!.trim();
    const after = text.slice(span.end).split(/[.!;\n]/u, 1)[0]!.trim();
    if ((before && !/^[-•–]$/u.test(before)) || !/^(?:tonight(?: against (?:the )?[\p{L} -]+)?(?:, while .+)?|for the injured [\p{L}.'’ -]+|\(he hasn['’]t played since [\p{L}\d ]+\))?$/iu.test(after)) return [];
    if (events.some(event => event?.playerId === player.playerId && (event.reviewReason || event.modality === "tentative"
      || event.availability === "out" || event.availability === "uncertain"))) return [];
    const later = text.slice(span.end);
    const surname = player.name.split(" ").at(-1)!;
    if (later.toLowerCase().includes(surname.toLowerCase()) || /\b(?:he|actually)\b[^.!?;\n]{0,45}\b(?:out|won['’]t|will not|scratched|unlikely)\b/i.test(later)) return [];
    if (changes.some(other => Array.isArray(other?.playersOut) && other.playersOut.some((p: {playerId?: number} | null) => p?.playerId === player.playerId))) return [];
    return [{ playerId: player.playerId, playerName: player.name, evidence: { start: span.start, end: span.end, text: span.text } }];
  });
}
