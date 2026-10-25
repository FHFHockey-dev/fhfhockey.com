import { playersReady } from "./players";
import type { StreamNight } from "./matchups";
import type { SharePlayer, SocialShareSnapshot } from "./types";

/**
 * Targeted Matchups player picks (TJ, ticket 22): up to 3 skaters from the TILT team of one cherry-picked night.
 * - Goal storm → scorers (season goals per GP); shot storm → shooters (SOG/GP); shots-against storm (opponent
 *   SF/GP and tilt team SA/GP both league top third, TJ's pop-up) → blockers (BLK/GP). There is no hits tilt
 *   yet (TJ's pop-up: no team-hits source).
 * - Two or more tilts: picks alternate across them, best remaining first; a player who is also the best remaining
 *   fit for another tilt covers both. Tired, soft-defense and off-night tags alone drive nothing: such nights use
 *   the strongest primary tilt (the pairing with the best combined league ranks).
 * - Season totals only, from the existing bounded skater read. A player with unknown data for a role is never
 *   picked for it; fewer than 3 qualifying players means fewer cards, never filler.
 */
export const TARGETS_PER_NIGHT = 3;
export type TargetRole = "scorer" | "shooter" | "blocker";
export type TargetPick = { player: SharePlayer; roles: TargetRole[]; stat: string };

const ROLE_FOR = { goals: "scorer", shots: "shooter", blocks: "blocker" } as const;
const rate: Record<TargetRole, (player: SharePlayer) => number | null> = {
  scorer: player => (player.goals == null ? null : player.goals / player.gamesPlayed),
  shooter: player => (player.shots == null ? null : player.shots / player.gamesPlayed),
  blocker: player => (player.blocks == null ? null : player.blocks / player.gamesPlayed),
};
const statText: Record<TargetRole, (value: number) => string> = {
  scorer: value => `${value.toFixed(2)} G/GP`, shooter: value => `${value.toFixed(1)} SOG/GP`, blocker: value => `${value.toFixed(1)} BLK/GP`,
};
export const ROLE_LABELS: Record<TargetRole, string> = { scorer: "Scorer", shooter: "Shooter", blocker: "Blocker" };

/** The tilt roles of a night, in storm order; with no storm, the strongest primary pairing by combined ranks. */
export function targetRoles(night: StreamNight): TargetRole[] {
  const e = night.evidence, storms = (["goals", "shots", "blocks"] as const).filter(key => e[key]?.storm);
  if (storms.length) return storms.map(key => ROLE_FOR[key]);
  const strength = (["goals", "shots", "blocks"] as const).flatMap(key => {
    const pair = e[key];
    return pair?.team && pair.opponent ? [{ key, score: pair.team.rank / pair.team.of + pair.opponent.rank / pair.opponent.of }] : [];
  }).sort((a, b) => a.score - b.score)[0];
  return strength ? [ROLE_FOR[strength.key]] : [];
}

/** Server ranking pool: the top TARGETS_PER_NIGHT candidates for each tilt role of a night (enough for any pick order). */
export function targetCandidates(snapshot: SocialShareSnapshot, night: StreamNight): SharePlayer[] {
  if (!playersReady(snapshot)) return [];
  const pool = (snapshot.players?.players ?? []).filter(player => player.team === night.team.abbreviation && player.group !== "G");
  return targetRoles(night).flatMap(role => pool.filter(player => rate[role](player) !== null).sort((a, b) => rate[role](b)! - rate[role](a)! || a.nhlId - b.nhlId).slice(0, TARGETS_PER_NIGHT));
}

export const targetKey = (night: Pick<StreamNight, "team" | "id">) => `${night.team.abbreviation}:${night.id}`;

export function targetPicks(snapshot: SocialShareSnapshot, night: StreamNight, trusted: boolean): TargetPick[] {
  if (!trusted || !playersReady(snapshot)) return [];
  // A trimmed live layer carries the server's picks; without them (an older edition) it shows none, never a guess.
  if (snapshot.players?.selectedDates) {
    const byId = new Map(snapshot.players.players.map(player => [player.nhlId, player]));
    return (snapshot.players.targets?.[targetKey(night)] ?? []).flatMap(({ id, roles }) => {
      const player = byId.get(id), value = player && roles.length ? rate[roles[0]](player) : null;
      return player && value !== null ? [{ player, roles, stat: statText[roles[0]](value) }] : [];
    });
  }
  const roles = targetRoles(night);
  const pool = (snapshot.players?.players ?? []).filter(player => player.team === night.team.abbreviation && player.group !== "G");
  const ranked = Object.fromEntries(roles.map(role => [role, pool.filter(player => rate[role](player) !== null)
    .sort((a, b) => rate[role](b)! - rate[role](a)! || a.nhlId - b.nhlId)])) as Record<TargetRole, SharePlayer[]>;
  const picks: TargetPick[] = [], taken = new Set<number>();
  const best = (role: TargetRole) => ranked[role].find(player => !taken.has(player.nhlId));
  for (let progressed = true; progressed && picks.length < TARGETS_PER_NIGHT;) {
    progressed = false;
    for (const role of roles) {
      if (picks.length >= TARGETS_PER_NIGHT) break;
      const player = best(role);
      if (!player) continue;
      // The pick also covers any other tilt it is currently the best remaining fit for.
      const covers = [role, ...roles.filter(other => other !== role && best(other) === player)];
      picks.push({ player, roles: covers, stat: statText[role](rate[role](player)!) });
      taken.add(player.nhlId);
      progressed = true;
    }
  }
  return picks;
}
