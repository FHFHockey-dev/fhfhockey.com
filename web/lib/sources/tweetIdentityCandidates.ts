import { normalizeIdentityName, resolvePlayerIdentity } from "./playerIdentity";
import { snapshotRowAtSource, type IdentitySnapshotRow, type PlayerIdentityIndex } from "./playerIdentitySnapshot";

export const IDENTITY_CANDIDATE_LIMIT = 40;
export const IDENTITY_WIDENED_LIMIT = 80;
export type IdentityCandidate = {
  row: IdentitySnapshotRow;
  basis: "full_name" | "alias" | "surname" | "initial" | "acronym" | "fuzzy" | "context";
  nameDistance: number | null;
  teamEvidence: "supported" | "conflicting" | "unknown";
  positionEvidence: "supported" | "conflicting" | "unknown";
  activeTeamIds: number[];
  eligibleAliasTexts: string[];
};
export type IdentityCandidateSet = {
  candidates: IdentityCandidate[]; pass: 0 | 1; totalCandidates: number; omittedCount: number; truncated: boolean;
  quality: "exact" | "weak" | "missing"; exactStatus: "matched" | "ambiguous" | "conflicting_membership" | "missing_player";
  directoryHash: string; completeness: PlayerIdentityIndex["snapshot"]["content"]["completeness"];
};

/** Unicode code point edit distance with a small bound; transpositions cost two edits. */
function boundedDistance(left: string, right: string, bound: number): number | null {
  const a = [...left], b = [...right];
  if (Math.abs(a.length - b.length) > bound) return null;
  let prior = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const next = [i];
    for (let j = 1; j <= b.length; j++) next[j] = Math.min(next[j - 1]! + 1, prior[j]! + 1,
      prior[j - 1]! + Number(a[i - 1] !== b[j - 1]));
    if (Math.min(...next) > bound) return null;
    prior = next;
  }
  return prior[b.length]! <= bound ? prior[b.length]! : null;
}

/** Canonical-name hypothesis only, never a verified alias. Keep apostrophes within a token. */
function canonicalAcronymMatches(mention: string, fullName: string): boolean {
  if (!/^(?:\p{Lu}\p{M}*\.?){3,5}$/u.test(mention.trim().normalize("NFC"))) return false;
  const tokens = fullName.normalize("NFC").match(/\p{L}[\p{L}\p{M}]*(?:[’'][\p{L}\p{M}]+)*/gu) ?? [];
  if (tokens.length < 3 || tokens.length > 5) return false;
  return normalizeIdentityName(tokens.map(token => [...token][0]).join("")) === normalizeIdentityName(mention);
}

/** Retrieval proposes possibilities. Context ranks but never removes a lexical candidate. */
export function retrieveTweetIdentityCandidates(args: {
  index: PlayerIdentityIndex; mention: string; publishedAt: string;
  teamId?: number | null; position?: string | null; pass?: 0 | 1;
}): IdentityCandidateSet {
  const pass = args.pass ?? 0, key = normalizeIdentityName(args.mention);
  if (pass !== 0 && pass !== 1) throw new Error("identity_widening_limit");
  const views = args.index.snapshot.content.rows.map(row => ({ row, ...snapshotRowAtSource(row, args.index, args.publishedAt) }));
  const compactInitial = normalizeIdentityName(args.mention.replace(/^(\s*\p{L})\.(?!\p{L}\.)(?=\p{L})/u, "$1 "));
  const exactIds = new Set([...(args.index.byName[key] ?? []), ...(args.index.byName[compactInitial] ?? [])]);
  const exact = resolvePlayerIdentity(args.mention, views.filter(view => exactIds.has(view.row.canonicalId)).map(view => view.identity));
  const exactPlayers = exact.status === "matched" ? [exact.player] : exact.candidates;
  const exactById = new Set(exactPlayers.map(player => player.playerId));
  const ranked: Array<{ candidate: IdentityCandidate; score: number }> = [];
  for (const view of views) {
    const { row, identity, teamIds } = view;
    const basis = exactById.has(row.nhlPlayerId) ? resolvePlayerIdentity(args.mention, [identity]) : null;
    let matchBasis: IdentityCandidate["basis"] | null = basis?.status === "matched" ? basis.basis : null;
    let distance: number | null = matchBasis ? 0 : null;
    if (!matchBasis && canonicalAcronymMatches(args.mention, row.fullName)) matchBasis = "acronym";
    if (!matchBasis && [...key].length >= 5 && key.length <= 200) {
      const bound = pass === 1 && [...key].length >= 9 ? 2 : 1;
      const names = [identity.fullName, identity.lastName, ...(identity.aliases ?? [])].map(normalizeIdentityName);
      const distances = names.map(name => boundedDistance(key, name, bound)).filter((d): d is number => d !== null);
      if (distances.length) { distance = Math.min(...distances); matchBasis = "fuzzy"; }
    }
    // Team-only suggestions are a last resort and carry no identity evidence.
    if (!matchBasis && pass === 1 && args.teamId != null && teamIds.includes(args.teamId)) matchBasis = "context";
    if (!matchBasis) continue;
    const teamEvidence = teamIds.length > 1 ? "conflicting" : args.teamId == null || !teamIds.length ? "unknown"
      : teamIds.includes(args.teamId) ? "supported" : "conflicting";
    const positionEvidence = !args.position || !row.positions.length ? "unknown"
      : row.positions.includes(args.position.toUpperCase()) ? "supported" : "conflicting";
    const rank = { full_name: 60, alias: 50, initial: 40, surname: 40, acronym: 30, fuzzy: 20, context: 0 }[matchBasis];
    // Candidate rows are source-time projections; withheld aliases must not leak through metadata.
    ranked.push({ candidate: { row: { ...row, aliases: view.aliases }, basis: matchBasis, nameDistance: distance, teamEvidence, positionEvidence, activeTeamIds: teamIds,
      eligibleAliasTexts: view.aliases.map(alias => alias.text) },
      score: rank - (distance ?? 0) + Number(teamEvidence === "supported") + Number(positionEvidence === "supported") });
  }
  ranked.sort((a, b) => b.score - a.score || a.candidate.row.nhlPlayerId - b.candidate.row.nhlPlayerId);
  const limit = pass === 0 ? IDENTITY_CANDIDATE_LIMIT : IDENTITY_WIDENED_LIMIT;
  const candidates = ranked.slice(0, limit).map(item => item.candidate);
  return { candidates, pass, totalCandidates: ranked.length, omittedCount: Math.max(0, ranked.length - limit),
    truncated: ranked.length > limit, exactStatus: exact.status,
    quality: exact.status === "matched" ? "exact" : ranked.length ? "weak" : "missing",
    directoryHash: args.index.snapshot.hash, completeness: args.index.snapshot.content.completeness };
}
