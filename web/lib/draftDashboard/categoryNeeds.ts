import { resolveStatDirection, type StatDirection } from "lib/projectionsConfig/statsMasterList";

/**
 * My team's category needs (audit W2-5 D5). A need is the team's shortfall
 * against the league's team mean in league standard deviations, in the
 * league's direction, floored at 0. It is unitless, so expressing a stat in
 * other units cannot change it. Every enabled category is considered (not a
 * fixed skater list); a category whose totals are unknown for any team has no
 * need value (omitted, never 0).
 */
export function categoryNeedPressures(
  teams: readonly { teamId: string; totals: Readonly<Record<string, number | null | undefined>> }[],
  myTeamId: string,
  categoryWeights: Readonly<Record<string, number>>,
  directions?: Readonly<Record<string, StatDirection>>,
): Record<string, number> {
  const mine = teams.find((team) => team.teamId === myTeamId);
  const needs: Record<string, number> = {};
  if (!mine || teams.length < 2) return needs;
  for (const [key, weight] of Object.entries(categoryWeights)) {
    if (!Number.isFinite(weight) || weight === 0) continue;
    const values = teams.map((team) => team.totals[key]);
    if (values.some((value) => typeof value !== "number" || !Number.isFinite(value))) continue;
    const numbers = values as number[];
    const mean = numbers.reduce((sum, value) => sum + value, 0) / numbers.length;
    const sd = Math.sqrt(
      numbers.reduce((sum, value) => sum + (value - mean) ** 2, 0) / (numbers.length - 1),
    );
    const own = mine.totals[key] as number;
    const lower = resolveStatDirection(key, { overrides: directions, weight }) === "lower";
    const shortfall = lower ? own - mean : mean - own;
    needs[key] = sd > 0 ? Math.max(0, shortfall / sd) : 0;
  }
  return needs;
}
