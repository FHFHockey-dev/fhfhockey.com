import type { TweetPlayerEvent } from "./tweetPlayerEvents";
import { normalizeIdentityName, resolvePlayerIdentity, type PlayerIdentity } from "./playerIdentity";

export const TWEET_INTERPRETATION_VERSION = "2026-10-13.1";
export type EvidenceSpan = { start: number; end: number; text: string };
export type TweetUnit = {
  situation: "es_forward" | "es_defense" | "pp" | "pk" | "goalie" | "scratch" | "injury";
  number: number | null;
  explicitNumber: boolean;
  players: Array<{ playerId: number; name: string }>;
  evidence: EvidenceSpan[];
  group: string | null;
  complete: boolean;
};
export type TweetInterpretation = {
  version: string;
  rosterRevision?: string;
  identityContext?: { basis: "current_membership"; sourcePublishedAt: string | null; eventRosterRevision: string };
  formation?: { forwards: 11; defense: 7 };
  units: TweetUnit[];
  excludedUnits?: TweetUnit[];
  events?: TweetPlayerEvent[];
  relationships?: Array<{
    kind: "substitution" | "swap" | "continuity" | "alternatives";
    playerIds: number[];
    subjects?: Array<EvidenceSpan & { playerId: number | null; candidates: number[] }>;
    situation: "pp" | null;
    number: number | null;
    certainty: "reported" | "projected";
    evidence: EvidenceSpan;
    reviewReason: "incomplete_replacement" | "unresolved_reference" | "ambiguous_identity";
  }>;
  unresolved: Array<EvidenceSpan & { reason: "missing_player" | "ambiguous" | "invalid_extraction"; number?: number | null; situation?: TweetUnit["situation"] | null; candidates?: number[] }>;
  context: "camp" | "practice" | "game" | "unknown";
  certainty: "projected" | "confirmed" | "reported";
};

export function tweetPipelineFlags() {
  return {
    interpretation: process.env.TWEET_PIPELINE_INTERPRETATION_ENABLED === "true",
    publishing: process.env.TWEET_PIPELINE_INTERPRETATION_ENABLED === "true" && process.env.TWEET_PIPELINE_PUBLISHING_ENABLED === "true",
  };
}

const PROSE = /\b(?:news|gm|president|montreal|montréal|nashville|edmonton|colorado|los angeles|utah|vegas|toronto|islanders|all|star|so not|babes)\b/i;

type EvenStrengthRow = "es_forward" | "es_defense";

export function playerPositionRole(player: Pick<PlayerIdentity, "position">): EvenStrengthRow | "goalie" | null {
  const position = player.position?.toUpperCase();
  return ["C", "L", "R", "LW", "RW", "F"].includes(position ?? "") ? "es_forward" : position === "D" ? "es_defense" : position === "G" ? "goalie" : null;
}

function resolveRowIdentity(rawName: string, roster: PlayerIdentity[], row?: EvenStrengthRow | null): ReturnType<typeof resolvePlayerIdentity> {
  const key = normalizeIdentityName(rawName);
  const surnames = [...new Map(roster.filter((player) => normalizeIdentityName(player.lastName) === key)
    .map((player) => [player.playerId, player])).values()];
  if (surnames.length > 1) {
    // A bare surname alias must not outrank another player's surname. Row position
    // disambiguates only when every candidate has known, matching team membership.
    const forwards = ["C", "L", "R", "LW", "RW", "F"];
    const knownPositions = [...forwards, "D", "G"];
    if (row && surnames.every((player) => player.teamId != null && player.teamId === surnames[0]!.teamId
      && knownPositions.includes(player.position?.toUpperCase() ?? ""))) {
      const eligible = surnames.filter((player) => row === "es_forward"
        ? forwards.includes(player.position!.toUpperCase()) : player.position!.toUpperCase() === "D");
      if (eligible.length === 1) return resolvePlayerIdentity(rawName, eligible);
    }
    return { status: "ambiguous", candidates: surnames };
  }
  return resolvePlayerIdentity(rawName, roster);
}

/** Find a unique complete segmentation, retaining original offsets and compound names. */
export function segmentPlayerRow(text: string, roster: PlayerIdentity[], row?: EvenStrengthRow | null): Array<EvidenceSpan & { player: PlayerIdentity }> | null {
  const solutions: Array<Array<EvidenceSpan & { player: PlayerIdentity }>> = [];
  const visit = (offset: number, hits: Array<EvidenceSpan & { player: PlayerIdentity }>) => {
    if (solutions.length > 1 || hits.length > 6) return;
    const separator = text.slice(offset).match(/^[\s,;/\\•–—−-]+/u)?.[0] ?? "";
    const start = offset + separator.length;
    if (start === text.length) { if (hits.length) solutions.push(hits); return; }
    for (let end = text.length; end > start; end--) {
      if (end < text.length && !/[\s,;/\\•–—−-]/u.test(text[end]!)) continue;
      const raw = text.slice(start, end).trimEnd();
      if (!raw || raw.length > 70) continue;
      const result = resolveRowIdentity(raw, roster, row);
      if (result.status !== "matched" || hits.some((hit) => hit.player.playerId === result.player.playerId)) continue;
      visit(start + raw.length, [...hits, { start, end: start + raw.length, text: raw, player: result.player }]);
    }
  };
  if (text.length <= 200) visit(0, []);
  const unique = new Map(solutions.map((hits) => [hits.map((hit) => hit.player.playerId).join(","), hits]));
  return unique.size === 1 ? [...unique.values()][0]! : null;
}

export function interpretTweetUnits(text: string, roster: PlayerIdentity[]): TweetInterpretation {
  const result: TweetInterpretation = {
    version: TWEET_INTERPRETATION_VERSION,
    rosterRevision: roster.map((player) => [player.playerId, player.fullName, player.lastName, player.teamId, player.position, ...(player.aliases ?? [])].join(":")).sort().join("|"),
    units: [], unresolved: [],
    context: /\b(camp|practice groups?|split squad)\b/i.test(text) ? "camp" : /\b(practice|morning skate)\b/i.test(text) ? "practice" : /\b(tonight|today|this afternoon|vs\.?|against|warmups?|starting goal(?:ie|tender)|in (?:net|goal)|gets? the start|starts)\b/i.test(text) ? "game" : "unknown",
    certainty: /\bconfirmed\b/i.test(text) ? "confirmed" : /\b(projected|expected)\b/i.test(text) ? "projected" : "reported",
  };
  if (/\b11\s*(?:f\b|forwards?\b)[^\n]{0,30}7\s*(?:d\b|defen[cs]emen\b)/i.test(text)) result.formation = { forwards: 11, defense: 7 };
  const introduction = text.split("\n", 1)[0] ?? "";
  const initialSituation: TweetUnit["situation"] | null = /\b(power[ -]?play|pp(?:\s*[12])?)\b/i.test(introduction) ? "pp" : /\b(penalty kill|pk[12])\b/i.test(introduction) ? "pk" : null;
  let situation: TweetUnit["situation"] | null = initialSituation;
  let number: number | null = null;
  let explicitNumber = false;
  let group: string | null = null;
  let sectionRole: EvenStrengthRow | "goalie" | null = null;
  let explicitEsHeading = false;
  let pending: TweetUnit | null = null;
  let offset = 0;
  const ordinals = new Map<string, number>();
  let sawStructure = /\b(lines?|lineup|pairings?|units?|rushes|camp|morning skate)\b/i.test(text)
    || text.split("\n").filter((line) => /^[\p{L}.'’\s–—/-]+$/u.test(line) && /[-–—/]/.test(line)).length > 1;
  const flush = () => { if (pending) result.units.push(pending); pending = null; };
  for (const rawLine of text.split("\n")) {
    const lineStart = offset;
    offset += rawLine.length + 1;
    let line = rawLine.trim();
    if (!line) {
      flush(); number = null; explicitNumber = false; sectionRole = null; explicitEsHeading = false;
      if (situation !== "pp" && situation !== "pk") situation = null;
      continue;
    }
    const groupMatch = line.match(/\b(?:group|squad)\b\s+([a-z0-9]+)\b/i);
    if (groupMatch) { flush(); group = groupMatch[1]!.toLowerCase(); number = null; explicitNumber = false; situation = initialSituation; sectionRole = null; explicitEsHeading = false; }
    // Parse the relay body without changing original evidence positions.
    line = line.replace(/^RT\s+@[^:]+:\s*/i, "");
    const inlineHeading = line.match(/^(?:[\p{L}#@]+\s+)+(pp\s*[12]\s*:)/iu);
    if (inlineHeading) line = line.slice(inlineHeading[0].indexOf(inlineHeading[1]!));
    const heading = line.match(/^(?:(pp|power[ -]?play|pk|penalty kill|forwards?|defen[cs]e(?: pairs?)?|goalies?|scratches?|extras?|injur(?:ed|ies)|even[ -]strength|[fdg](?=\s*\d?\s*:))\s*([1-9])?\s*[:–—-]?\s*)/i);
    if (heading && !/\b(?:rotation|rotating|correction|corrected|contradictory|contradicting)\b/i.test(line)) {
      flush(); sawStructure = true;
      const label = heading[1]!.toLowerCase();
      situation = /^(pp|power)/.test(label) ? "pp" : /^(pk|penalty)/.test(label) ? "pk" : /^goal|^g$/.test(label) ? "goalie" : /^(scratch|extra)/.test(label) ? "scratch" : /^injur/.test(label) ? "injury" : /^defen|^d$/.test(label) ? "es_defense" : "es_forward";
      explicitEsHeading = situation === "es_forward" || situation === "es_defense";
      sectionRole = explicitEsHeading ? situation as EvenStrengthRow : null;
      number = heading[2] ? Number(heading[2]) : null;
      explicitNumber = number != null;
      line = line.slice(heading[0].length).trim();
      if (!line) continue;
    }
    line = line.replace(/^🥅\s*/u, "");
    if (/^(?:RT\s+@|#|@|https?:)/i.test(line)) { flush(); continue; }
    const extras = line.match(/^(.+?)\s+(?:are|is)\s+(?:the\s+)?extras?[.!]?$/i);
    if (extras) line = extras[1]!.trim();
    const lineSituation = extras ? "scratch" : situation;
    const slashParts = line.includes("/") ? line.split(/\s*\/\s*/).map((part) => segmentPlayerRow(part, roster)) : null;
    // One resolved player per slash slot is a row delimiter. Multiple players in
    // one slot remain alternatives, rather than being merged into a full unit.
    const simpleSlash = slashParts?.every((part) => part?.length === 1);
    let hits = !slashParts || simpleSlash ? segmentPlayerRow(line, roster) : null;
    const roles = hits?.map((hit) => playerPositionRole(hit.player)) ?? [];
    const positiveRole = roles.length && roles.every((role) => role === roles[0]) ? roles[0] : null;
    const reviewShape: EvenStrengthRow | null = sawStructure && /[-–—/]/.test(line)
      ? line.split(/[-–—/]/).length >= 3 ? "es_forward" : "es_defense" : null;
    let rowKind: EvenStrengthRow | null = null;
    if (lineSituation !== "pp" && lineSituation !== "pk" && lineSituation !== "scratch" && lineSituation !== "injury") {
      if (explicitEsHeading) rowKind = sectionRole as EvenStrengthRow;
      else if (positiveRole === "es_forward" || positiveRole === "es_defense") rowKind = positiveRole;
      else if (positiveRole !== "goalie") rowKind = sectionRole === "es_forward" || sectionRole === "es_defense" ? sectionRole : reviewShape;
    }
    const identityRow = rowKind ?? (lineSituation === "es_forward" || lineSituation === "es_defense" ? lineSituation : null);
    if (identityRow && (!slashParts || simpleSlash)) hits = segmentPlayerRow(line, roster, identityRow);
    if (lineSituation === "goalie") rowKind = null;
    // Positions and explicit sections govern admission; length only locates a
    // review row. Rejected short rows cannot consume the other section's slots.
    const rowRole = hits?.length && hits.every((hit) => playerPositionRole(hit.player) === playerPositionRole(hits![0]!.player)) ? playerPositionRole(hits[0]!.player) : null;
    if (!explicitEsHeading && hits?.length === 1 && rowRole === "es_forward" && lineSituation !== "pp" && lineSituation !== "pk" && lineSituation !== "scratch" && lineSituation !== "injury") continue;
    const kind: EvenStrengthRow | "goalie" | null = lineSituation === "goalie" ? "goalie" : rowKind ?? (hits?.length === 1 && rowRole === "goalie" ? "goalie" : null);
    const scopedTeams = new Set(hits?.map((hit) => hit.player.teamId).filter((team) => team != null));
    const positionValid = hits?.every((hit) => Number.isSafeInteger(hit.player.playerId) && hit.player.playerId > 0
      && (lineSituation === "pp" || lineSituation === "pk" ? ["es_forward", "es_defense"].includes(playerPositionRole(hit.player) ?? "") : lineSituation === "scratch" || lineSituation === "injury" ? true : playerPositionRole(hit.player) === kind)) && scopedTeams.size <= 1;
    const shortRow = hits && kind && (kind === "es_forward" ? hits.length !== 3 && !(result.formation && hits.length === 2) : kind === "es_defense" ? hits.length !== 2 && !(result.formation && hits.length === 1) : hits.length !== 1);
    if (rowKind) {
      const key = `${group}:${rowKind}`;
      if ((!shortRow || explicitNumber) && (hits || reviewShape || heading && explicitEsHeading)) ordinals.set(key, explicitNumber && number != null ? number : (ordinals.get(key) ?? 0) + 1);
    }
    const sourceRowNumber = rowKind ? (!shortRow || explicitNumber ? ordinals.get(`${group}:${rowKind}`) ?? null : null) : number;
    if (!hits) {
      flush();
      if (sawStructure && lineSituation === "goalie" && /^[\p{L}.'’\s-]+$/u.test(line) && line.length < 90) {
        const start = lineStart + rawLine.indexOf(line);
        result.unresolved.push({ start, end: start + line.length, text: line, situation: "goalie", reason: "missing_player", candidates: [] });
      }
      if (sawStructure && slashParts && !simpleSlash && lineSituation !== "scratch" && line.length < 90) {
        result.relationships ??= [];
        result.relationships.push({ kind: "alternatives", playerIds: [], situation: situation === "pp" ? "pp" : null, number: rowKind ? ordinals.get(`${group}:${rowKind}`)! : number,
          certainty: "projected", evidence: { start: lineStart + rawLine.indexOf(line), end: lineStart + rawLine.indexOf(line) + line.length, text: line }, reviewReason: "ambiguous_identity" });
      }
      // Unknown names are reviewable only in an established structured block.
      if (sawStructure && !PROSE.test(line) && /^[\p{L}.'’\s–—/-]+$/u.test(line) && line.length < 90 && /[-–—/]/.test(line)) {
        const compactHyphen = line.match(/^([\p{L}.'’]+)-([\p{L}.'’]+)$/u);
        const tokens = line.includes("/") ? line.split(/\s*[/]\s*/).flatMap((alternative) => {
          const segmented = segmentPlayerRow(alternative, roster);
          if (segmented) return segmented.map((hit) => hit.text);
          return alternative.split(/[-–—]/).map((token) => token.trim());
        }) : compactHyphen ? [compactHyphen[1]!, compactHyphen[2]!] : line.split(/\s+[-–—]\s+/);
        if (tokens.length === 1 && /[-–—]/.test(line)) {
          const ambiguous = line.split(/[-–—]/).map((token) => token.trim()).flatMap((token) => {
            const resolution = resolveRowIdentity(token, roster, identityRow);
            return resolution.status === "ambiguous" ? [{ token, candidates: resolution.candidates.map((candidate) => candidate.playerId) }] : [];
          });
          if (ambiguous.length) for (const { token, candidates } of ambiguous) {
            const start = lineStart + rawLine.indexOf(line) + line.indexOf(token);
            result.unresolved.push({ start, end: start + token.length, text: token, candidates, number: rowKind ? ordinals.get(`${group}:${rowKind}`) : number, situation: rowKind ?? situation, reason: "ambiguous" });
          }
          result.unresolved.push({ start: lineStart + rawLine.indexOf(line), end: lineStart + rawLine.indexOf(line) + line.length, text: line, number: rowKind ? ordinals.get(`${group}:${rowKind}`) : number, situation: rowKind ?? situation, reason: "invalid_extraction" });
          continue;
        }
        if (line.includes("/") && result.relationships?.at(-1)?.evidence.text === line) {
          const relation = result.relationships.at(-1)!;
          relation.subjects = tokens.map((token) => {
            const resolution = resolvePlayerIdentity(token, roster);
            return { text: token, start: lineStart + rawLine.indexOf(token), end: lineStart + rawLine.indexOf(token) + token.length,
              playerId: resolution.status === "matched" ? resolution.player.playerId : null,
              candidates: resolution.status === "matched" ? [resolution.player.playerId] : resolution.candidates.map((candidate) => candidate.playerId) };
          });
          relation.playerIds = relation.subjects.flatMap((subject) => subject.playerId == null ? [] : [subject.playerId]);
        }
        let tokenOffset = 0;
        for (const token of tokens) {
          const resolution = resolvePlayerIdentity(token, roster);
          const tokenStart = line.indexOf(token, tokenOffset); tokenOffset = tokenStart + token.length;
          if (resolution.status !== "matched") result.unresolved.push({ start: lineStart + rawLine.indexOf(line) + tokenStart, end: lineStart + rawLine.indexOf(line) + tokenStart + token.length, text: token, number: rowKind ? ordinals.get(`${group}:${rowKind}`) : number, situation: rowKind ?? lineSituation, candidates: resolution.candidates.map((candidate) => candidate.playerId), reason: resolution.status === "ambiguous" ? "ambiguous" : "missing_player" });
        }
      }
      continue;
    }
    const players = hits.map((hit) => ({ playerId: hit.player.playerId, name: hit.player.fullName }));
    const evidence = hits.map(({ start, end, text: value }) => ({ start: lineStart + rawLine.indexOf(line) + start, end: lineStart + rawLine.indexOf(line) + end, text: value }));
    if ((kind || lineSituation === "pp" || lineSituation === "pk") && (!positionValid || shortRow)) {
      flush();
      const rejectedSituation = lineSituation === "pp" || lineSituation === "pk" ? lineSituation : kind ?? lineSituation!;
      result.unresolved.push({ start: lineStart + rawLine.indexOf(line), end: lineStart + rawLine.indexOf(line) + line.length, text: line, situation: rejectedSituation, number: sourceRowNumber, candidates: players.map((player) => player.playerId), reason: "invalid_extraction" });
      const rejected: TweetUnit = { situation: rejectedSituation, number: sourceRowNumber, explicitNumber, players, evidence, group, complete: false };
      if (shortRow) (result.excludedUnits ??= []).push(rejected); else result.units.push(rejected);
      if (rowKind) { number = null; explicitNumber = false; }
      continue;
    }
    if (lineSituation === "pp" || lineSituation === "pk") {
      const count = lineSituation === "pp" ? 5 : 4;
      if (pending && pending.players.length + players.length > count) flush();
      pending ??= { situation: lineSituation, number, explicitNumber, players: [], evidence: [], group, complete: false };
      pending.players.push(...players); pending.evidence.push(...evidence);
      pending.complete = pending.players.length === count && new Set(pending.players.map((player) => player.playerId)).size === count;
      if (pending.players.length >= count) { flush(); number = null; explicitNumber = false; }
      continue;
    }
    if (lineSituation === "scratch" || lineSituation === "injury") {
      result.units.push({ situation: lineSituation, number: null, explicitNumber: false, players, evidence, group, complete: scopedTeams.size <= 1 });
      continue;
    }
    if (!kind) {
      if (hits.some((hit) => !playerPositionRole(hit.player))) result.unresolved.push({ start: evidence[0]!.start, end: evidence.at(-1)!.end, text: line, reason: "invalid_extraction", candidates: players.map((player) => player.playerId) });
      continue;
    }
    if (!rowKind && (kind === "es_forward" || kind === "es_defense")) {
      ordinals.set(`${group}:${kind}`, result.units.filter((unit) => unit.situation === kind && unit.group === group).length + 1);
    }
    sawStructure = true;
    if (!explicitEsHeading) sectionRole = kind;
    result.units.push({ situation: kind, number: rowKind === kind ? ordinals.get(`${group}:${kind}`)! : result.units.filter((unit) => unit.situation === kind && unit.group === group).length + 1,
      explicitNumber, players, evidence, group, complete: true });
    if (rowKind) { number = null; explicitNumber = false; }
  }
  flush();
  const relations: Array<{ kind: "substitution" | "swap" | "continuity"; match: RegExpMatchArray | null }> = [
    { kind: "substitution", match: text.match(/([^.:\n]+) will take ([^.:\n]+?)[’']s spot on the (first|second) unit power[ -]?play[^.\n]*/i) },
    { kind: "swap", match: text.match(/(?:Looks like )?([^.:\n]+?) and ([^.:\n]+?) have switched spots/i) },
    { kind: "continuity", match: text.match(/\bSame PP units\b/i) },
  ];
  for (const { kind, match } of relations) {
    if (!match) continue;
    const names = kind === "continuity" ? [] : [match[1]!.replace(/^.*RT\s+@[^:]+:\s*/i, "").trim().replace(/^Looks like\s+/i, ""), match[2]!.trim()];
    const resolutions = names.map((name) => resolvePlayerIdentity(name, roster));
    result.relationships ??= [];
    result.relationships.push({ kind, playerIds: resolutions.flatMap((resolution) => resolution.status === "matched" ? [resolution.player.playerId] : []),
      situation: kind === "swap" ? null : "pp", number: kind === "substitution" ? (match[3]!.toLowerCase() === "first" ? 1 : 2) : null,
      certainty: kind === "swap" ? "projected" : "reported",
      evidence: { start: match.index!, end: match.index! + match[0].length, text: match[0] },
      reviewReason: resolutions.some((resolution) => resolution.status !== "matched") ? "ambiguous_identity" : kind === "substitution" ? "incomplete_replacement" : "unresolved_reference" });
  }
  for (const kind of ["pp", "pk"] as const) {
    for (const groupId of new Set(result.units.map((unit) => unit.group))) {
      const units = result.units.filter((unit) => unit.situation === kind && unit.group === groupId && unit.complete);
      if (units.length === 2 && units.every((unit) => unit.number == null)) units.forEach((unit, index) => { unit.number = index + 1; });
    }
  }
  // Standard projected lineups use four forward triplets and three defense pairs.
  // Explicit nonstandard or conflicting evidence remains available for review.
  const es = result.units.filter((unit) => unit.situation === "es_forward" || unit.situation === "es_defense");
  const esIds = es.flatMap((unit) => unit.players.map((player) => player.playerId));
  const scratched = new Set(result.units.filter((unit) => unit.situation === "scratch").flatMap((unit) => unit.players.map((player) => player.playerId)));
  const exception = /\b(?:11\s*f\b|11\s*forwards?\b|7\s*d\b|7\s*defen[cs]emen\b|rotat(?:ion|ing|e|es)|correct(?:ion|ed)|contradict(?:ory|ing)|alternat(?:es?|ing))\b/i.test(text)
    || new Set(esIds).size !== esIds.length || esIds.some((id) => scratched.has(id))
    || result.relationships?.some((relation) => relation.situation === null);
  if (result.context !== "camp" && !exception) {
    result.units = result.units.filter((unit) => {
      const limit = unit.situation === "es_forward" ? 4 : unit.situation === "es_defense" ? 3 : null;
      if (unit.group != null || limit == null || (unit.number ?? 0) <= limit) return true;
      (result.excludedUnits ??= []).push(unit);
      return false;
    });
  }
  return result;
}

/** Accept a whole declared formation, never a cardinality-only approximation. */
export function completeEvenStrengthUnits(interpretation: TweetInterpretation, group: string | null = null): TweetUnit[] {
  const units = interpretation.units.filter((unit) => unit.group === group && (unit.situation === "es_forward" || unit.situation === "es_defense"));
  const forwards = units.filter((unit) => unit.situation === "es_forward");
  const defense = units.filter((unit) => unit.situation === "es_defense");
  if (interpretation.formation && (interpretation.formation.forwards !== 11 || interpretation.formation.defense !== 7)) return [];
  const expectedF = interpretation.formation ? [3, 3, 3, 2] : [3, 3, 3, 3];
  const expectedD = interpretation.formation ? [2, 2, 2, 1] : [2, 2, 2];
  const matches = (rows: TweetUnit[], expected: number[]) => rows.length === expected.length && expected.every((size, index) => {
    const row = rows.find((unit) => unit.number === index + 1);
    return row?.complete && row.players.length === size && row.players.every((player) => Number.isSafeInteger(player.playerId) && player.playerId > 0);
  });
  if (!matches(forwards, expectedF) || !matches(defense, expectedD)) return [];
  const ids = units.flatMap((unit) => unit.players.map((player) => player.playerId));
  const scratched = interpretation.units.filter((unit) => unit.situation === "scratch").flatMap((unit) => unit.players.map((player) => player.playerId));
  return new Set(ids).size === 18 && !ids.some((id) => scratched.includes(id)) ? [...forwards, ...defense] : [];
}

export function identityMentionPresent(text: string, name: string): boolean {
  const needle = normalizeIdentityName(name).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`(?:^|[^\\p{L}])${needle}(?=$|[^\\p{L}])`, "u").test(normalizeIdentityName(text));
}

/** Historical comparison does not date an independently asserted current unit. */
export function requiresRelativeGameDateReview(text: string): boolean {
  const withoutComparison = text.replace(/\b(?:same|unchanged)(?: as)? (?:yesterday|last year)\b/gi, "");
  return /\b(tomorrow|yesterday)\b/i.test(withoutComparison);
}
