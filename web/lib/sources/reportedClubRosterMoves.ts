import { teamHashtagsByAbbreviation, teamsInfo } from "../teamsInfo";
import { bulletinNamesClub, datedClubByline, readClubMedicalBulletin } from "./clubMedicalBulletin";
import { normalizeIdentityName } from "./playerIdentity";
import type { TweetNewsRosterEvidence } from "./tweetNewsRosterEvidence";
import { tweetPublicationFromUrl } from "./tweetPublicationTime";

type Move = "placed_on_ir" | "activated_off_ir" | "recalled" | "reassigned" | "claimed_off_waivers";
type Span = { start: number; end: number; text: string };
type ReportedMove = { move: Move; subject: Span; evidence: Span; retroactive: string | null; clubName?: string | null;
  reportedDestination?: { teamId: number; name: string } };

export function hasMixedMedicalMoves(text: string) {
  return /\b(?:IR|injured reserve)\b/iu.test(text) && /\b(?:recalled|reassigned|claimed off waivers)\b/iu.test(text);
}

// A club speaking in the first person must also own the dated original byline.
const pairedRecall = /^(?:RT @[\w]{1,15}:\s*)?Roster Move:\s*We have recalled ([\p{L}.'’ -]+?) from the @[\w]{1,15} and placed ([\p{L}.'’ -]+?) on IR with an (?:upper|lower)[- ]body injury\.(?: https:\/\/t\.co\/\w+)?$/iu;
const affiliateAssignment = /^(?:RT @[\w]{1,15}:\s*)?The #(\w{1,15}) has activated (?:forward|defen[cs]eman) ([\p{L}.'’ -]+?) from injured reserve and reassigned (?:forward|defen[cs]eman) ([\p{L}.'’ -]+?) to the @\w{1,15}\.(?: (?:Forward|Defen[cs]eman) ([\p{L}.'’ -]+?) has been claimed off waivers by the ([\p{L} -]+)\.)?$/iu;
const clubPlacementAndRecall = /^(?:RT @\w{1,15}:\s*)?(?:With ([\p{L}.'’-]+(?: [\p{L}.'’-]+){1,3}) expected to miss some time, )?#(\w{1,15}) (?:has|have) placed ([\p{L}.'’-]+(?: [\p{L}.'’-]+){0,3}) on (?:injured reserve|IR) and recalled (?:[CLRDFG]|forward|defen[cs]eman|goaltender) ([\p{L}.'’-]+(?: [\p{L}.'’-]+){1,3})\.?$/iu;

const subjectName = String.raw`[\p{L}.'’-]+(?: [\p{L}.'’-]+){1,3}?`;
const role = String.raw`(?:(?:forward|defen[cs]eman|goaltender) )?`;
const reserve = String.raw` (?:on|in) (?:injured reserve|IR)`;
const recallDetail = String.raw`(?: from (?:the )?[@\p{L}.'’-]+(?: [\p{L}.'’-]+){0,2}(?: \(AHL\))?| for the road trip)?`;
const detailPattern = `(${reserve}|${recallDetail})`;
const actsOnPlayer = new RegExp(String.raw`^(placed|recalled) ${role}(${subjectName})${detailPattern}$`, "iu");
const playerMove = new RegExp(String.raw`^${role}(${subjectName}) (?:has been )?(placed|recalled)${detailPattern}$`, "iu");
const activeSubject = /^(?:(?:the )?((?!they\b)#?[\p{L}][\p{L} -]*?) (?:has|have) |(they[’']ve|they have) )(?=placed |recalled )/iu;
const placedDetail = new RegExp("^" + reserve + "$", "iu");
// Limit the optional origin to a named place or account. A trailing qualification changes the claim.
const recalledDetail = /^(?: from (?:the )?(?:@\w{1,15}|\p{Lu}[\p{L}.'’-]*(?: \p{Lu}[\p{L}.'’-]*){0,2})(?: \(AHL\))?| for the road trip)?$/u;

function twoSentenceMoves(text: string, author: string) {
  const body = text.replace(/^RT @\w{1,15}:\s*/iu, "").replace(/\s+https:\/\/t\.co\/\w+\s*$/u, "").trim();
  const sentences = body.split(/(?<=\.)\s+|[\r\n]+/u).map(line => line.trim()).filter(Boolean);
  if (sentences.length !== 2) return null;
  let club: string | undefined;
  let offset = text.indexOf(body);
  const moves: ReportedMove[] = [];
  for (const sentence of sentences) {
    const line = sentence.replace(/\.$/u, "");
    const actor = activeSubject.exec(line);
    if (actor?.[2] && !club) return null;
    const named = actor?.[1]?.toLowerCase();
    if (named && moves.length && named !== club) return null;
    club ??= named;
    const start = text.indexOf(sentence, offset);
    const predicate = line.slice(actor?.[0].length ?? 0);
    const match = actor ? actsOnPlayer.exec(predicate) : playerMove.exec(predicate);
    if (!match) return null;
    const verb = match[actor ? 1 : 2]!.toLowerCase();
    const name = match[actor ? 2 : 1]!;
    const detail = match[3]!;
    if (!(verb === "placed" ? placedDetail : recalledDetail).test(detail)) return null;
    const subjectStart = start + (actor?.[0].length ?? 0) + predicate.indexOf(name);
    moves.push({ move: verb === "placed" ? "placed_on_ir" : "recalled", retroactive: null,
      subject: { text: name, start: subjectStart, end: subjectStart + name.length },
      evidence: { text: sentence, start, end: start + sentence.length } });
    offset = start + sentence.length;
  }
  if (moves[0]!.move === moves[1]!.move || moves[0]!.subject.text === moves[1]!.subject.text) return null;
  return { handle: club ?? author.toLowerCase(), basis: club ? "club_text" as const : "byline" as const, moves };
}

export function reportedClubRosterMoves(text: string, originalAuthor: string) {
  const bulletin = readClubMedicalBulletin(text);
  if (bulletin) {
    const moves: ReportedMove[] = [{ move: "recalled", subject: bulletin.recalled, evidence: bulletin.recallEvidence, retroactive: null }];
    for (const update of bulletin.updates) if (update.move) moves.push({ ...update, move: update.move });
    return { handle: bulletin.handle, basis: "named" as const, moves };
  }
  const placement = clubPlacementAndRecall.exec(text);
  if (placement) {
    const [, lead, handle, placed, recalled] = placement;
    const conjunction = text.toLowerCase().indexOf(" and recalled ");
    // The short subject can refer back only to the same explicitly introduced player.
    const subject = lead && lead.endsWith(" " + placed) ? lead : placed!;
    const start = subject === lead ? text.indexOf(lead) : text.lastIndexOf(subject, conjunction);
    const recallStart = text.lastIndexOf(recalled!);
    const moves: ReportedMove[] = [
      { move: "placed_on_ir", subject: { start, end: start + subject.length, text: subject },
        evidence: { start, end: conjunction, text: text.slice(start, conjunction) }, retroactive: null },
      { move: "recalled", subject: { start: recallStart, end: recallStart + recalled!.length, text: recalled! },
        evidence: { start: conjunction + 5, end: text.length, text: text.slice(conjunction + 5) }, retroactive: null },
    ];
    return { handle: handle!.toLowerCase(), basis: "hashtag" as const, moves };
  }
  const paired = pairedRecall.exec(text);
  const affiliate = paired ? null : affiliateAssignment.exec(text);
  if (!paired && !affiliate) return hasMixedMedicalMoves(text) ? twoSentenceMoves(text, originalAuthor) : null;
  const separator = paired ? " and placed " : " and reassigned ";
  const split = text.toLowerCase().indexOf(separator);
  const end = paired ? text.split(/ https:\/\//u, 1)[0]!.length : text.indexOf(".", text.toLowerCase().indexOf(" to the @", split)) + 1;
  const clauses = [{ start: 0, end: split }, { start: split + 5, end }];
  const kinds: Move[] = paired ? ["recalled", "placed_on_ir"] : ["activated_off_ir", "reassigned"];
  const moves: ReportedMove[] = kinds.map((move, i) => {
    const name = paired ? paired[i + 1]! : affiliate![i + 2]!;
    const clause = clauses[i]!, evidence = { ...clause, text: text.slice(clause.start, clause.end) };
    const start = text.lastIndexOf(name, clause.end - name.length);
    return { move, subject: { start, end: start + name.length, text: name }, evidence, retroactive: null };
  });
  const claimant = affiliate?.[5], name = affiliate?.[4];
  if (name && claimant) {
    const clubs = Object.values(teamsInfo).filter(team => team.name.toLowerCase() === claimant.toLowerCase());
    if (clubs.length === 1) {
      const start = text.indexOf(name, end), club = clubs[0]!;
      moves.push({ move: "claimed_off_waivers", subject: { start, end: start + name.length, text: name },
        evidence: { start: end + 1, end: text.length, text: text.slice(end + 1) }, retroactive: null,
        reportedDestination: { teamId: club.id, name: club.name } });
    }
  }
  return { handle: affiliate ? affiliate[1]!.toLowerCase() : originalAuthor.toLowerCase(),
    basis: paired ? "byline" as const : "hashtag" as const, moves };
}

export function rosterMoveClub(report: NonNullable<ReturnType<typeof reportedClubRosterMoves>>, teamId: number, publishedAt: string) {
  const club = Object.values(teamsInfo).find(t => t.id === teamId);
  if (!club || report.moves.some(m => m.clubName && m.clubName.toLowerCase() !== club.shortName.toLowerCase())) return false;
  if (report.basis === "club_text") {
    const names = [club.name, club.shortName, "#" + club.abbrev, ...(teamHashtagsByAbbreviation[club.abbrev] ?? [])];
    return names.some(name => name.toLowerCase() === report.handle);
  }
  if (report.basis === "hashtag") return teamHashtagsByAbbreviation[club.abbrev]?.some(tag => tag.toLowerCase() === "#" + report.handle) ?? false;
  return (report.basis === "byline" ? datedClubByline : bulletinNamesClub)(report.handle, club.name, club.abbrev, publishedAt);
}

/** Join the literal object of each verb to a unique player in this source's dated intake evidence. */
export function selectClubRosterMoves(roster: TweetNewsRosterEvidence | null, teamId: number | null,
  url: string | null, postId: string | null) {
  if (!roster?.publishedAt || !hasMixedMedicalMoves(roster.text)) return [];
  const named = /^https:\/\/(?:x|twitter)\.com\/([\w]{1,15})\/status\/(\d+)$/iu.exec(url ?? "");
  const clock = tweetPublicationFromUrl(url);
  if (!named || named[2] !== postId || !clock || Math.floor(Date.parse(clock) / 1000) !== Math.floor(Date.parse(roster.publishedAt) / 1000)) return [];
  const wrapped = /^RT @([\w]{1,15}):/iu.exec(roster.text);
  if (wrapped && wrapped[1]!.toLowerCase() !== named[1]!.toLowerCase()) return [];
  const reported = reportedClubRosterMoves(roster.text, named[1]!);
  if (!reported || !teamId || !rosterMoveClub(reported, teamId, roster.publishedAt)) return [];
  return reported.moves.flatMap(move => {
    const { start, end, text } = move.subject;
    if (roster.text.slice(start, end) !== text || roster.reviewSpans.some(s => s.start < end && s.end > start)) return [];
    const matches = roster.players.filter(p => normalizeIdentityName(p.fullName) === normalizeIdentityName(text));
    if (matches.length !== 1 || matches[0]!.team_id !== teamId) return [];
    const player = matches[0]!;
    return [{ ...move, playerId: player.id, playerName: player.fullName, teamId: player.team_id }];
  });
}

export function clubRosterMoveLabel(move: ReportedMove) {
  if (move.move === "recalled") return "Recalled";
  if (move.move === "reassigned") return "Reassigned";
  if (move.move === "claimed_off_waivers") {
    return move.reportedDestination ? `Claimed off waivers by ${move.reportedDestination.name}` : "Claimed off waivers";
  }
  if (move.move === "activated_off_ir") return "Activated off IR";
  return move.retroactive ? `Placed on IR · retroactive to ${move.retroactive}` : "Placed on IR";
}
