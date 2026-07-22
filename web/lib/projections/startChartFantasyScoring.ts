import { computeSkaterFantasyPoints } from "lib/projections/accuracy/fantasyPoints";
import { DEFAULT_SKATER_FANTASY_POINTS } from "lib/projectionsConfig/fantasyPointsConfig";

export type StartChartFantasyScoringContract = {
  version: string;
  label: string;
  weights: {
    goals: number;
    assists: number;
    powerPlayPoints: number;
    shotsOnGoal: number;
    hits: number;
    blockedShots: number;
  };
};

export const START_CHART_FANTASY_SCORING_CONTRACT: StartChartFantasyScoringContract =
  {
    version: "fhfh-default-skater-v1",
    label: "FHFH default skater",
    weights: {
      goals: DEFAULT_SKATER_FANTASY_POINTS.GOALS,
      assists: DEFAULT_SKATER_FANTASY_POINTS.ASSISTS,
      powerPlayPoints: DEFAULT_SKATER_FANTASY_POINTS.PP_POINTS,
      shotsOnGoal: DEFAULT_SKATER_FANTASY_POINTS.SHOTS_ON_GOAL,
      hits: DEFAULT_SKATER_FANTASY_POINTS.HITS,
      blockedShots: DEFAULT_SKATER_FANTASY_POINTS.BLOCKED_SHOTS,
    },
  };

export function computeStartChartFantasyPoints(stats: {
  goals: number;
  assists: number;
  powerPlayPoints: number;
  shotsOnGoal: number;
  hits: number;
  blockedShots: number;
}): number {
  return Number(
    computeSkaterFantasyPoints({
      goals: stats.goals,
      assists: stats.assists,
      ppPoints: stats.powerPlayPoints,
      shots: stats.shotsOnGoal,
      hits: stats.hits,
      blockedShots: stats.blockedShots,
    }).toFixed(3),
  );
}

export function formatStartChartFantasyScoringContract(
  contract: StartChartFantasyScoringContract,
): string {
  const { weights } = contract;
  return `${contract.label} [${contract.version}] (G=${weights.goals}, A=${weights.assists}, PPP=${weights.powerPlayPoints}, SOG=${weights.shotsOnGoal}, HIT=${weights.hits}, BLK=${weights.blockedShots})`;
}
