import type { SharePlayer } from "./types";

/**
 * Hot and cold streaks next to the L5 "Recent form" line (TJ, ticket 18). One tunable config.
 * - Hot (any one): points in ≥ 4 of the last 5 GP; ≥ 0.85 P/GP over L5; L5 TOI ≥ 15% above the pre-L5 season
 *   average (TJ chose 15% from his 10–15% range); L5 PP TOI ≥ 35% above the pre-L5 average. On the Specialists
 *   card also > 2 HIT/GP, > 2 BLK/GP, > 2.5 SOG/GP or > 0.5 PPP/GP over L5.
 * - Cold (TJ chose the mirrored opposites): points in ≤ 1 of 5; ≤ 0.25 P/GP; TOI down ≥ 15%; PP TOI down ≥ 35%.
 * - Goalies (TJ: goalies too; rules proposed by SS1 and confirmed by TJ 2026-10-25): hot = quality starts in ≥ 4 of 5
 *   or L5 SV% ≥ .930; cold = quality starts in ≤ 1 of 5 or L5 SV% ≤ .870.
 * Pre-L5 baselines exclude the L5 games: (season total − L5 total) ÷ (season GP − 5). Fewer than 5 recent games
 * shows no icon; a criterion with missing data simply doesn't fire, so missing data never yields an icon. Hot wins
 * when a player meets both.
 */
export const STREAK = {
  games: 5,
  /** Pre-L5 games needed before the TOI and PP TOI rules apply. */
  minPreGames: 3,
  /** A pre-L5 PP TOI below this (seconds per game) is too small to compare against. */
  ppToiMinBaselineSeconds: 30,
  hot: { pointGames: 4, pointsPerGame: 0.85, toiRise: 0.15, ppToiRise: 0.35 },
  /** Specialists card only; strictly greater than. */
  specialists: { hitsPerGame: 2, blocksPerGame: 2, shotsPerGame: 2.5, ppPointsPerGame: 0.5 },
  cold: { pointGames: 1, pointsPerGame: 0.25, toiDrop: 0.15, ppToiDrop: 0.35 },
  goalie: { hot: { qualityStarts: 4, savePct: 0.93 }, cold: { qualityStarts: 1, savePct: 0.87 } },
} as const;

export type StreakContext = "pickup" | "specialist" | "tier";
export type Streak = { kind: "hot" | "cold"; reasons: string[] };

const EPSILON = 1e-9;
const pct = (ratio: number) => `${ratio >= 0 ? "+" : "−"}${Math.round(Math.abs(ratio) * 100)}%`;
/** L5 vs pre-L5 change, or null when either side is missing or the baseline is too small. */
const change = (l5: number | null | undefined, pre: number | null | undefined, minBaseline = 1) =>
  l5 == null || pre == null || !Number.isFinite(l5) || !Number.isFinite(pre) || pre < minBaseline ? null : l5 / pre - 1;

export function streakOf(player: Pick<SharePlayer, "group" | "recent">, context: StreakContext): Streak | null {
  const recent = player.recent;
  if (!recent || recent.games < STREAK.games) return null;
  if (recent.kind === "goalie") {
    const savePct = recent.shotsAgainst > 0 ? recent.saves / recent.shotsAgainst : null, sv = (value: number) => `${value.toFixed(3).replace(/^0/, "")} SV%`;
    const hot = [...(recent.qualityStarts >= STREAK.goalie.hot.qualityStarts ? [`${recent.qualityStarts}/5 QS`] : []), ...(savePct !== null && savePct >= STREAK.goalie.hot.savePct - EPSILON ? [sv(savePct)] : [])];
    if (hot.length) return { kind: "hot", reasons: hot };
    const cold = [...(recent.qualityStarts <= STREAK.goalie.cold.qualityStarts ? [`${recent.qualityStarts}/5 QS`] : []), ...(savePct !== null && savePct <= STREAK.goalie.cold.savePct + EPSILON ? [sv(savePct)] : [])];
    return cold.length ? { kind: "cold", reasons: cold } : null;
  }
  const games = recent.games, perGame = (total: number | null) => (total === null ? null : total / games);
  const ppg = perGame(recent.points), pointGames = recent.pointGames ?? null;
  const toi = change(recent.toiSeconds, recent.toiPreSeconds), pp = change(recent.ppToiSeconds, recent.ppToiPreSeconds, STREAK.ppToiMinBaselineSeconds);
  const hot: string[] = [];
  if (pointGames !== null && pointGames >= STREAK.hot.pointGames) hot.push(`${pointGames}/5 P`);
  if (ppg !== null && ppg >= STREAK.hot.pointsPerGame - EPSILON) hot.push(`${ppg.toFixed(1)} P/GP`);
  if (toi !== null && toi >= STREAK.hot.toiRise - EPSILON) hot.push(`TOI ${pct(toi)}`);
  if (pp !== null && pp >= STREAK.hot.ppToiRise - EPSILON) hot.push(`PP TOI ${pct(pp)}`);
  if (context === "specialist") {
    const s = STREAK.specialists, sog = perGame(recent.shots), ppp = perGame(recent.ppPoints);
    if (recent.hitsPerGame !== null && recent.hitsPerGame > s.hitsPerGame + EPSILON) hot.push(`${recent.hitsPerGame.toFixed(1)} HIT/GP`);
    if (recent.blocksPerGame !== null && recent.blocksPerGame > s.blocksPerGame + EPSILON) hot.push(`${recent.blocksPerGame.toFixed(1)} BLK/GP`);
    if (sog !== null && sog > s.shotsPerGame + EPSILON) hot.push(`${sog.toFixed(1)} SOG/GP`);
    if (ppp !== null && ppp > s.ppPointsPerGame + EPSILON) hot.push(`${ppp.toFixed(1)} PPP/GP`);
  }
  if (hot.length) return { kind: "hot", reasons: hot };
  const cold: string[] = [];
  if (pointGames !== null && pointGames <= STREAK.cold.pointGames) cold.push(`${pointGames}/5 P`);
  if (ppg !== null && ppg <= STREAK.cold.pointsPerGame + EPSILON) cold.push(`${ppg.toFixed(1)} P/GP`);
  if (toi !== null && toi <= -STREAK.cold.toiDrop + EPSILON) cold.push(`TOI ${pct(toi)}`);
  if (pp !== null && pp <= -STREAK.cold.ppToiDrop + EPSILON) cold.push(`PP TOI ${pct(pp)}`);
  return cold.length ? { kind: "cold", reasons: cold } : null;
}
