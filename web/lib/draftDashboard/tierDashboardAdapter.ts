import type { UseVORPParams } from "hooks/useVORPCalculations";
import { categoryAppliesToRole } from "lib/scoring/categoryScores";
import { getDefaultFantasyPointsConfig } from "lib/projectionsConfig/fantasyPointsConfig";
import { getProratedStat, canProrateStat, PRORATABLE_SKATER_STAT_KEYS } from "lib/projectionsConfig/proration";
import { getRosterPositions } from "./forwardGrouping";
import { buildPlayerValues } from "./playerValues";
import { buildPositionTiers, type TierPlayer } from "./positionalTiers";

type Input = Pick<UseVORPParams, "players" | "draftSettings" | "leagueType" | "categoryWeights" | "forwardGrouping" | "prorate84" | "fantasyPointSettings" | "positionWeightMultipliers"> & { goaliePointValues: Record<string, number> };

export function buildDashboardTiers(input: Input) {
  const { values, eligibility } = buildPlayerValues(input);
  const positions = getRosterPositions(input.forwardGrouping ?? "split", input.draftSettings.rosterConfig);
  const pools: Record<string, TierPlayer[]> = Object.fromEntries(positions.map(position => [position, []]));
  for (const player of input.players) {
    const id = String(player.playerId);
    const eligible = eligibility.get(id) ?? [];
    const role = eligible.includes("G") ? "goalie" : "skater";
    const weights = input.leagueType === "categories"
      ? input.categoryWeights ?? {}
      : { ...getDefaultFantasyPointsConfig(role), ...(role === "goalie" ? input.goaliePointValues : input.fantasyPointSettings) };
    const keys = Object.keys(weights).filter(key => weights[key] !== 0 && (input.leagueType !== "categories" || categoryAppliesToRole(key, role)));
    const stat = (key: string) => getProratedStat(player, key, input.leagueType !== "categories" && role === "skater" && Boolean(input.prorate84));
    const finite = (value: unknown): value is number => typeof value === "number" && Number.isFinite(value);
    const complete = (input.leagueType === "categories" || finite(player.fantasyPoints?.projected)) && keys.length > 0 && keys.every(key => {
      if (!finite(stat(key))) return false;
      if (input.leagueType !== "categories" && input.prorate84 && role === "skater" && PRORATABLE_SKATER_STAT_KEYS.has(key) && !canProrateStat(player, key)) return false;
      if (input.leagueType === "categories" && key === "SAVE_PERCENTAGE") {
        const shots = stat("SHOTS_AGAINST_GOALIE") ?? ((finite(stat("SAVES_GOALIE")) && finite(stat("GOALS_AGAINST_GOALIE"))) ? Number(stat("SAVES_GOALIE")) + Number(stat("GOALS_AGAINST_GOALIE")) : null);
        return finite(shots) && shots > 0;
      }
      if (input.leagueType === "categories" && key === "GOALS_AGAINST_AVERAGE") {
        return ["GAMES_STARTED", "STARTS_GOALIE", "GAMES_STARTED_GOALIE", "GAMES_GOALIE", "GAMES_PLAYED_GOALIE", "GP_GOALIE"].some(key => finite(stat(key)) && Number(stat(key)) > 0);
      }
      return true;
    });
    const row = { id, name: player.fullName || id, value: complete && finite(values.get(id)) ? values.get(id)! : null, adp: player.yahooAvgPick };
    for (const position of eligible) pools[position]?.push(row);
  }
  return positions.map(position => buildPositionTiers(position, pools[position]));
}
