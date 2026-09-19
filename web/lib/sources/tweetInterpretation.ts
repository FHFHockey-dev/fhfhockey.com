import type { TweetPlayerEvent } from "./tweetPlayerEvents";
import { normalizeIdentityName, resolvePlayerIdentity, type PlayerIdentity } from "./playerIdentity";

export const TWEET_INTERPRETATION_VERSION = "2026-09-18.1";
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
  units: TweetUnit[];
  events?: TweetPlayerEvent[];
  unresolved: Array<EvidenceSpan & { reason: "missing_player" | "ambiguous" | "invalid_extraction" }>;
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

/** Find a unique complete segmentation, retaining original offsets and compound names. */
export function segmentPlayerRow(text: string, roster: PlayerIdentity[]): Array<EvidenceSpan & { player: PlayerIdentity }> | null {
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
      const result = resolvePlayerIdentity(raw, roster);
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
    context: /\b(camp|practice groups?|split squad)\b/i.test(text) ? "camp" : /\b(practice|morning skate)\b/i.test(text) ? "practice" : /\b(tonight|vs\.?|against|warmups?)\b/i.test(text) ? "game" : "unknown",
    certainty: /\bconfirmed\b/i.test(text) ? "confirmed" : /\b(projected|expected)\b/i.test(text) ? "projected" : "reported",
  };
  const introduction = text.split("\n", 1)[0] ?? "";
  const initialSituation: TweetUnit["situation"] | null = /\b(power[ -]?play|pp[12])\b/i.test(introduction) ? "pp" : /\b(penalty kill|pk[12])\b/i.test(introduction) ? "pk" : null;
  let situation: TweetUnit["situation"] | null = initialSituation;
  let number: number | null = null;
  let explicitNumber = false;
  let group: string | null = null;
  let pending: TweetUnit | null = null;
  let offset = 0;
  let sawStructure = /\b(lines?|lineup|pairings?|units?|rushes|camp)\b/i.test(text);
  const flush = () => { if (pending) result.units.push(pending); pending = null; };
  for (const rawLine of text.split("\n")) {
    const lineStart = offset;
    offset += rawLine.length + 1;
    let line = rawLine.trim();
    if (!line) { flush(); number = null; explicitNumber = false; continue; }
    const groupMatch = line.match(/\b(?:group|squad)\s*([a-z0-9]+)\b/i);
    if (groupMatch) { flush(); group = groupMatch[1]!.toLowerCase(); number = null; explicitNumber = false; situation = initialSituation; }
    const heading = line.match(/^(?:(pp|power[ -]?play|pk|penalty kill|forwards?|defen[cs]e(?: pairs?)?|goalies?|scratches?|injur(?:ed|ies)|even[ -]strength)\s*([12])?\s*[:–—-]?\s*)/i);
    if (heading) {
      flush(); sawStructure = true;
      const label = heading[1]!.toLowerCase();
      situation = /^(pp|power)/.test(label) ? "pp" : /^(pk|penalty)/.test(label) ? "pk" : /^goal/.test(label) ? "goalie" : /^scratch/.test(label) ? "scratch" : /^injur/.test(label) ? "injury" : /^defen/.test(label) ? "es_defense" : "es_forward";
      number = heading[2] ? Number(heading[2]) : null;
      explicitNumber = number != null;
      line = line.slice(heading[0].length).trim();
      if (!line) continue;
    }
    if (/^(?:RT\s+@|#|https?:)/i.test(line)) { flush(); continue; }
    const hits = segmentPlayerRow(line, roster);
    if (!hits) {
      flush();
      // Unknown names are reviewable only in an established structured block.
      if (sawStructure && !PROSE.test(line) && /^[\p{L}.'’\s–—/-]+$/u.test(line) && line.length < 90 && /[-–—/]/.test(line)) {
        const tokens = line.split(/\s+[-–—]\s+|\s*[/]\s*/);
        if (tokens.length === 1 && /[-–—]/.test(line)) {
          result.unresolved.push({ start: lineStart + rawLine.indexOf(line), end: lineStart + rawLine.indexOf(line) + line.length, text: line, reason: "invalid_extraction" });
          continue;
        }
        for (const token of tokens) {
          const resolution = resolvePlayerIdentity(token, roster);
          if (resolution.status !== "matched") result.unresolved.push({ start: lineStart + rawLine.indexOf(token), end: lineStart + rawLine.indexOf(token) + token.length, text: token, reason: resolution.status === "ambiguous" ? "ambiguous" : "missing_player" });
        }
      }
      continue;
    }
    const players = hits.map((hit) => ({ playerId: hit.player.playerId, name: hit.player.fullName }));
    const evidence = hits.map(({ start, end, text: value }) => ({ start: lineStart + rawLine.indexOf(line) + start, end: lineStart + rawLine.indexOf(line) + end, text: value }));
    if (situation === "pp" || situation === "pk") {
      const count = situation === "pp" ? 5 : 4;
      if (pending && pending.players.length + players.length > count) flush();
      pending ??= { situation, number, explicitNumber, players: [], evidence: [], group, complete: false };
      pending.players.push(...players); pending.evidence.push(...evidence);
      pending.complete = pending.players.length === count && new Set(pending.players.map((player) => player.playerId)).size === count;
      if (pending.players.length >= count) { flush(); number = null; explicitNumber = false; }
      continue;
    }
    if (situation === "scratch" || situation === "injury") {
      result.units.push({ situation, number: null, explicitNumber: false, players, evidence, group, complete: true });
      continue;
    }
    const kind = hits.length === 3 ? "es_forward" : hits.length === 2 ? "es_defense" : hits.length === 1 && hits[0]!.player.position === "G" ? "goalie" : null;
    if (!kind) continue;
    sawStructure = true;
    result.units.push({ situation: kind, number: result.units.filter((unit) => unit.situation === kind && unit.group === group).length + 1,
      explicitNumber: false, players, evidence, group, complete: true });
  }
  flush();
  for (const kind of ["pp", "pk"] as const) {
    for (const groupId of new Set(result.units.map((unit) => unit.group))) {
      const units = result.units.filter((unit) => unit.situation === kind && unit.group === groupId && unit.complete);
      if (units.length === 2 && units.every((unit) => unit.number == null)) units.forEach((unit, index) => { unit.number = index + 1; });
    }
  }
  return result;
}

export function identityMentionPresent(text: string, name: string): boolean {
  const needle = normalizeIdentityName(name).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`(?:^|[^\\p{L}])${needle}(?=$|[^\\p{L}])`, "u").test(normalizeIdentityName(text));
}
