import { teamsInfo } from "../teamsInfo";
import { datedClubByline } from "./clubMedicalBulletin";
import { reportedAbsenceDate } from "./reportedGameAbsence";
import type { EvidenceSpan } from "./tweetInterpretation";
import type { PlayerIdentity } from "./playerIdentity";
import type { TweetPlayerEvent } from "./tweetPlayerEvents";

export const BILINGUAL_GAME_CLAIM_VERSION = "2026-11-23.15";

type Status = "in" | "out" | "starter";
type Clause = { lang: "fr" | "en"; status: Status; subject: EvidenceSpan; predicate: EvidenceSpan; evidence: EvidenceSpan;
  opponent: string | null; body: string | null; position: string | null; sameGame: boolean };
const span = (text: string, start: number, end: number): EvidenceSpan => ({ start, end, text: text.slice(start, end) });

// Parse the whole clause. A qualifier, other day, question or trailing correction requires a new reading.
function readClause(text: string, start: number, end: number, joined: boolean): Clause | null {
  const raw = text.slice(start, end);
  const m = /^(?:(Forward|Defenseman|Defenceman|Goaltender|L['’]attaquant|Le défenseur|Le gardien) )?([\p{Lu}][\p{L}\p{M}’'-]*(?: [\p{Lu}][\p{L}\p{M}’'-]*){1,3})(?: \((upper body|lower body|haut du corps|bas du corps)\))? (.+)$/u.exec(raw);
  if (!m) return null;
  const [role, name, injury, words] = [m[1], m[2]!, m[3], m[4]!];
  const fr = /^(?:sera en uniforme ce soir(?: face aux? (.+))?|sera le gardien partant|ne jouera pas ce soir|ne participera (?:pas )?au match de ce soir)$/u.exec(words);
  const en = /^(?:draws (?:back )?into the line-?up tonight(?: against (?:the )?(.+))?|will get the start in (?:net|goal)|will not play (?:tonight|in tonight['’]s game))$/u.exec(words);
  if (!fr && !en) return null;
  const opponent = (fr ?? en)?.[1] ?? null;
  if (opponent && !/^[\p{Lu}][\p{L}’'-]*(?: [\p{Lu}][\p{L}’'-]*){0,3}$/u.test(opponent)) return null;
  const status = /^(?:sera en uniforme|draws )/.test(words) ? "in" : /^(?:sera le gardien|will get the start)/.test(words) ? "starter" : "out";
  const s = start + (role ? role.length + 1 : 0);
  return { lang: fr ? "fr" : "en", status, subject: span(text, s, s + name.length), predicate: span(text, end - words.length, end),
    evidence: span(text, start, end), opponent, sameGame: status !== "starter" || joined,
    body: injury ? (/^(?:upper|haut)/.test(injury) ? "upper" : "lower") : null,
    position: role ? (/attaquant|Forward/.test(role) ? "F" : /gardien|Goaltender/.test(role) ? "G" : "D") : null };
}

export function readBilingualGameReport(text: string) {
  if (text.length > 1200 || !/\b(?:sera|jouera|participera)\b/u.test(text) || !/\b(?:line-?up tonight|start in net|will not play)\b/u.test(text)) return null;
  const wrapper = /^RT @([\w]{1,15}):[ \t]+/u.exec(text);
  const body = text.slice(wrapper?.[0].length ?? 0).replace(/\s+https:\/\/t\.co\/[\w]+\s*$/u, "").trimEnd();
  const pieces = [...body.matchAll(/(?:^|\.\s+|, (?:tandis que|while) )([^.\n,]+?)(?=\.\s+|, (?:tandis que|while) |\.$|$)/gu)];
  if (!pieces.length || pieces.map(p => p[0]).join("") !== body.replace(/\.$/u, "")) return null;
  const clauses: Clause[] = [];
  for (const piece of pieces) {
    const start = (wrapper?.[0].length ?? 0) + piece.index + piece[0].length - piece[1]!.length;
    const clause = readClause(text, start, start + piece[1]!.length, piece[0].startsWith(", "));
    if (!clause || piece[0].startsWith(", ") && !piece[0].startsWith(clause.lang === "fr" ? ", tandis que " : ", while ")) return null;
    clauses.push(clause);
  }
  const en = clauses.findIndex(c => c.lang === "en");
  if (en <= 0 || clauses.length !== en * 2 || clauses.slice(en).some(c => c.lang !== "en")) return null;
  const french = clauses.slice(0, en), english = clauses.slice(en);
  const names = new Set(french.map(c => c.subject.text));
  if (names.size !== en || new Set(english.map(c => c.subject.text)).size !== en || english.some(c => !names.has(c.subject.text))) return null;
  const opponents = new Set(clauses.flatMap(c => c.opponent ? [c.opponent] : []));
  const pairs = english.flatMap(c => {
    const f = french.find(other => other.subject.text === c.subject.text)!;
    if (f.status !== c.status || f.body !== c.body || f.position !== c.position || f.opponent !== c.opponent
      || !c.sameGame || !f.sameGame || opponents.size > 1) return [];
    if (c.status === "starter") {
      const preceding = english[english.indexOf(c) - 1], translated = french[french.indexOf(f) - 1];
      if (!preceding?.opponent || preceding.status !== "in" || preceding.opponent !== translated?.opponent || preceding.subject.text !== translated.subject.text) return [];
    }
    return [{ name: c.subject.text, status: c.status, english: c, french: f }];
  });
  return { names: [...names], pairs, opponent: opponents.size === 1 ? [...opponents][0]! : null, wrapper: wrapper?.[1] ?? null };
}
export type BilingualPair = NonNullable<ReturnType<typeof readBilingualGameReport>>["pairs"][number];

export function pairedEventStatus(e: TweetPlayerEvent): Status | null {
  if (e.availabilityScope !== "game" || e.observation || e.reviewReason || e.modality !== "affirmative" || e.resolutionBasis !== "full_name") return null;
  if (e.kind === "goalie" && e.goalieRole === "starter" && e.state === "confirmed") return "starter";
  if (e.kind === "participation" && e.availability === "available" && e.state === "will_play") return "in";
  return e.kind === "participation" && e.availability === "out" && e.state === "ruled_out" ? "out" : null;
}

export function bilingualRosterPosition(pair: BilingualPair, positions: readonly string[]) {
  const role = pair.status === "starter" ? "G" : pair.english.position;
  if (role === "F") return positions.some(p => ["L", "R", "C", "LW", "RW", "F"].includes(p));
  return !role || positions.includes(role);
}

export function bulletinFitsMatchup(opponent: string | null, teamId: number, opponentId: number, author: string | null, posted: string) {
  const club = Object.values(teamsInfo).find(t => t.id === teamId), other = Object.values(teamsInfo).find(t => t.id === opponentId);
  if (!club || !other || teamId === opponentId) return false;
  // The NHL handle ledger uses the club's French name. Both spellings identify team 8.
  const ledgerName = club.abbrev === "MTL" && club.name === "Montréal Canadiens" ? "Canadiens Montréal" : club.name;
  return opponent ? [other.name, other.shortName, other.shortName.split(" ").at(-1), other.abbrev].some(n => n === opponent)
    : !!author && datedClubByline(author.toLowerCase(), ledgerName, club.abbrev, posted);
}

/** Replace only the subjects addressed by both paragraphs, after resolving them on the publication roster. */
export function bilingualGameEvents(text: string, players: PlayerIdentity[], games: ReadonlyMap<number, number>,
  publishedAt: string, gameDate: string, author: string | null, review: readonly { start: number; end: number }[]) {
  const report = readBilingualGameReport(text);
  if (!report || (report.wrapper && report.wrapper.toLowerCase() !== author?.toLowerCase())) return null;
  const events = report.pairs.flatMap((pair): TweetPlayerEvent[] => {
    const matches = players.filter(p => p.fullName === pair.name);
    if (matches.length !== 1 || !bilingualRosterPosition(pair, [matches[0]!.position ?? ""])) return [];
    const player = matches[0]!, team = player.teamId, game = team && games.get(team);
    if (!team || !game || reportedAbsenceDate(publishedAt, team, "tonight") !== gameDate) return [];
    const sides = [...games].filter(([, id]) => id === game).map(([id]) => id), opponent = sides.find(id => id !== team);
    if (sides.length !== 2 || !opponent || !bulletinFitsMatchup(report.opponent, team, opponent, author, publishedAt)
      || [pair.french, pair.english].some(c => review.some(r => r.start < c.subject.end && c.subject.start < r.end))) return [];
    return [{ playerId: player.playerId, playerName: pair.name, teamId: team, kind: pair.status === "starter" ? "goalie" : "participation",
      state: pair.status === "starter" ? "confirmed" : pair.status === "in" ? "will_play" : "ruled_out", availabilityScope: "game", effectiveDate: gameDate,
      availability: pair.status === "in" ? "available" : pair.status === "out" ? "out" : "unknown", modality: "affirmative", resolutionBasis: "full_name",
      ...(pair.status === "starter" ? { goalieRole: "starter" as const } : {}), evidence: pair.english.evidence, translatedEvidence: pair.french.evidence,
      claimAnchor: { subjectSpan: pair.english.subject, predicateSpan: pair.english.predicate }, timeline: null, timelines: [],
      times: { observation: publishedAt, reference: gameDate, applicability: "unresolved" } }];
  });
  return { names: report.names, events };
}
