import { normalizeIdentityName } from "./playerIdentity";

export type AliasReviewName = {
  raw_name: string;
  context_text: string | null;
  team_id: number | null;
  metadata?: {
    contextAlias?: string | null;
    reason?: string | null;
    reviewKind?: string | null;
    evidence?: { start: number; end: number; text?: string; origin?: "parser" | "unique_token" | "contextual_row" };
    situation?: string | null;
    sourceOrdinal?: number | null;
    captureKey?: string;
    sourcePublishedAt?: string | null;
    candidates?: number[];
  } | null;
};

export type AliasReviewPlayer = { id: number; fullName: string; lastName: string; position: string | null; team_id: number | null };
export type AliasReviewOccurrence = { start: number; end: number; text: string; row: string; line: number; basis: "offset" | "unique_token" | "contextual_row" };

function escapePattern(value: string) { return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"); }

export function findAliasReviewOccurrences(name: string, text: string): AliasReviewOccurrence[] {
  if (!name.trim()) return [];
  const pattern = new RegExp(`(?<![\\p{L}\\p{N}])${name.trim().split(/\s+/).map(escapePattern).join("[ \\t]+")}(?![\\p{L}\\p{N}])`, "giu");
  return Array.from(text.matchAll(pattern)).map((match) => {
    let start = match.index!;
    const end = start + match[0].length;
    const rowStart = text.lastIndexOf("\n", start - 1) + 1;
    const initial = text.slice(rowStart, start).match(/(?:^|[^\p{L}\p{N}])([A-Z]\.\s*)$/u);
    if (!/^[A-Z]\.\s*/i.test(name) && initial) start -= initial[1].length;
    const rowEnd = text.indexOf("\n", end);
    return { start, end, text: text.slice(start, end), row: text.slice(rowStart, rowEnd < 0 ? text.length : rowEnd), line: text.slice(0, start).split("\n").length, basis: "unique_token" as const };
  });
}

export function aliasReviewRole(row: AliasReviewName): "es_forward" | "es_defense" | null {
  const metadata = row.metadata;
  if (metadata?.reason === "invalid_extraction" || metadata?.reviewKind === "invalid_extraction") return null;
  const legacy = metadata?.reason?.match(/^(line|pair)_\d+_null_id$/);
  const role = metadata?.situation ?? (legacy ? legacy[1] === "line" ? "es_forward" : "es_defense" : null);
  return role === "es_forward" || role === "es_defense" ? role : null;
}

export function getAliasReviewOccurrence(row: AliasReviewName): AliasReviewOccurrence | null {
  const text = row.context_text ?? "";
  const target = row.metadata?.contextAlias || row.raw_name;
  const matches = findAliasReviewOccurrences(target, text);
  const evidence = row.metadata?.evidence;
  if (evidence && Number.isSafeInteger(evidence.start) && Number.isSafeInteger(evidence.end) && evidence.start >= 0 && evidence.end > evidence.start && evidence.end <= text.length) {
    const exact = matches.find((match) => (match.start === evidence.start || match.start < evidence.start && match.end === evidence.end) && match.end === evidence.end);
    if (exact && (!evidence.text || normalizeIdentityName(text.slice(evidence.start, evidence.end)) === normalizeIdentityName(evidence.text))) return { ...exact, basis: evidence.origin === "unique_token" || evidence.origin === "contextual_row" ? evidence.origin : "offset" };
    // Whole invalid extractions may contain several names; their offsets still identify the review target.
    if (normalizeIdentityName(text.slice(evidence.start, evidence.end)) === normalizeIdentityName(target)) {
      const rowStart = text.lastIndexOf("\n", evidence.start - 1) + 1;
      const rowEnd = text.indexOf("\n", evidence.end);
      return { ...evidence, text: text.slice(evidence.start, evidence.end), row: text.slice(rowStart, rowEnd < 0 ? text.length : rowEnd), line: text.slice(0, evidence.start).split("\n").length, basis: "offset" };
    }
  }
  if (matches.length === 1) return matches[0];
  const role = aliasReviewRole(row);
  const legacy = row.metadata?.reason?.match(/^(?:line|pair)_(\d+)_null_id$/);
  const ordinal = row.metadata?.sourceOrdinal ?? (legacy ? Number(legacy[1]) : null);
  if (role && ordinal && ordinal > 0) {
    const rows = text.split("\n").map((line, index) => ({ line, number: index + 1 })).filter(({ line }) => {
      if (/https?:|^RT\s|\b(?:lines?|pairs?|practice|lineup)\b/i.test(line)) return false;
      const tokens = line.trim().split(/\s+[-–—]\s+|\s*\/\s*/);
      return tokens.length === (role === "es_forward" ? 3 : 2);
    });
    const line = rows[ordinal - 1]?.number;
    const candidates = matches.filter((match) => match.line === line);
    if (candidates.length === 1) return { ...candidates[0], basis: "contextual_row" };
  }
  return null;
}

export function aliasReviewNameCandidates(name: string, players: AliasReviewPlayer[]): AliasReviewPlayer[] {
  const key = normalizeIdentityName(name);
  const full = players.filter((player) => normalizeIdentityName(player.fullName) === key);
  if (full.length) return full;
  const initial = players.filter((player) => normalizeIdentityName(`${player.fullName[0]} ${player.lastName}`) === key);
  return initial.length ? initial : players.filter((player) => normalizeIdentityName(player.lastName) === key);
}

export function capturedAliasReviewPlayers(revision: unknown): AliasReviewPlayer[] {
  if (typeof revision !== "string") return [];
  return revision.split("|").flatMap((entry) => {
    const [id, fullName, lastName, team, position] = entry.split(":");
    if (!Number.isSafeInteger(Number(id)) || Number(id) <= 0 || !fullName || !lastName || !/^\d+$/.test(team)) return [];
    return [{ id: Number(id), fullName, lastName, team_id: Number(team), position: position || null }];
  });
}

export function preferredAliasReviewCandidate(row: AliasReviewName, candidates: AliasReviewPlayer[], occurrence: AliasReviewOccurrence | null): { playerId: number | null; basis: string } {
  if (!occurrence || row.metadata?.reason === "invalid_extraction" || row.metadata?.reviewKind === "invalid_extraction") return { playerId: null, basis: "No reliable single-player occurrence." };
  const named = aliasReviewNameCandidates(occurrence.text, candidates);
  const role = aliasReviewRole(row);
  const rowTokens = occurrence.row.trim().split(/\s+[-–—]\s+|\s*\/\s*/);
  if (role && (rowTokens.length === 2 || rowTokens.length === 3) && rowTokens.length !== (role === "es_forward" ? 3 : 2)) return { playerId: null, basis: "Parsed role contradicts the source row; review manually." };
  const eligible = role ? named.filter((player) => role === "es_defense" ? player.position?.toUpperCase() === "D" : ["C", "L", "R", "LW", "RW", "F"].includes(player.position?.toUpperCase() ?? "")) : [];
  if (named.length === 1) return role && named[0].position && eligible.length === 0
    ? { playerId: null, basis: "Source initial and parsed role conflict; review manually." }
    : { playerId: named[0].id, basis: "Source name or initial matches one dated team candidate. Review before assigning." };
  if (named.length > 1 && named.every((player) => player.team_id === row.team_id && ["C", "L", "R", "LW", "RW", "F", "D", "G"].includes(player.position?.toUpperCase() ?? "")) && eligible.length === 1) return { playerId: eligible[0].id, basis: `Parsed ${role === "es_forward" ? "forward line" : "defense pair"} favors this candidate. Review before assigning.` };
  return { playerId: null, basis: "Name or role remains ambiguous; no player was selected automatically." };
}
