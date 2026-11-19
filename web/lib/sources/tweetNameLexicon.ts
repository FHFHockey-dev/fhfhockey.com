import { normalizeIdentityName, resolvePlayerIdentity, type PlayerIdentity, type PlayerSlotRole } from "./playerIdentity";

/** Respect spelling holds on this post's roster, preserving the canonical resolver's last entry for each ID. */
export function resolveTweetRosterIdentity(rawName: string, players: Array<PlayerIdentity & { reviewOnlyNames?: readonly string[] }>,
  teamId?: number | null, role?: PlayerSlotRole | null) {
  const key = normalizeIdentityName(rawName);
  if (!players.some(player => player.reviewOnlyNames?.includes(key))) return resolvePlayerIdentity(rawName, players, teamId, role);
  const byId = new Map(players.map(player => [player.playerId, player]));
  return resolvePlayerIdentity(rawName, [...byId.values()].filter(player => !player.reviewOnlyNames?.includes(key)), teamId, role);
}

/** Unicode code point edit distance with a small bound; transpositions cost two edits. */
export function boundedDistance(left: string, right: string, bound: number): number | null {
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
export function canonicalAcronymMatches(mention: string, fullName: string): boolean {
  if (!/^(?:\p{Lu}\p{M}*\.?){3,5}$/u.test(mention.trim().normalize("NFC"))) return false;
  const tokens = fullName.normalize("NFC").match(/\p{L}[\p{L}\p{M}]*(?:[’'][\p{L}\p{M}]+)*/gu) ?? [];
  if (tokens.length < 3 || tokens.length > 5) return false;
  return normalizeIdentityName(tokens.map(token => [...token][0]).join("")) === normalizeIdentityName(mention);
}
