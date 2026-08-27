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

export const START_CHART_POSITIONS = ["C", "LW", "RW", "D", "G"] as const;
export type StartChartPosition = (typeof START_CHART_POSITIONS)[number];
export type StartChartPositionRanks = Partial<
  Record<StartChartPosition, number>
>;

export type StartChartRankingContract = {
  version: string;
  scope: "eligible_position";
  tieMethod: "competition";
  scoreFields: {
    skater: "proj_fantasy_points";
    goalie: "start_probability";
  };
  unavailable: {
    categoryMode: true;
    riskP75: true;
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

export const START_CHART_RANKING_CONTRACT: StartChartRankingContract = {
  version: "start-chart-ranking-v2",
  scope: "eligible_position",
  tieMethod: "competition",
  scoreFields: {
    skater: "proj_fantasy_points",
    goalie: "start_probability",
  },
  unavailable: {
    categoryMode: true,
    riskP75: true,
  },
};

export function addStartChartPositionRanks<
  T extends {
    player_id: number;
    row_key?: string;
    game_id?: number;
    team_id?: number | null;
    positions: string[];
    proj_fantasy_points: number | null;
    start_probability?: number | null;
  },
>(players: T[]): Array<T & { position_ranks: StartChartPositionRanks }> {
  const ranksByRow = new Map<T, StartChartPositionRanks>();

  START_CHART_POSITIONS.forEach((position) => {
    const ranked = players
      .filter((player) => player.positions.includes(position))
      .map((player) => ({
        player,
        score:
          position === "G"
            ? player.start_probability
            : player.proj_fantasy_points,
      }))
      .filter(
        (
          row,
        ): row is {
          player: T;
          score: number;
        } => typeof row.score === "number" && Number.isFinite(row.score),
      )
      .sort(
        (left, right) =>
          right.score - left.score ||
          left.player.player_id - right.player.player_id ||
          (left.player.game_id ?? 0) - (right.player.game_id ?? 0) ||
          (left.player.team_id ?? 0) - (right.player.team_id ?? 0) ||
          (left.player.row_key ?? "").localeCompare(right.player.row_key ?? ""),
      );

    let previousScore: number | null = null;
    let competitionRank = 0;
    ranked.forEach(({ player, score }, index) => {
      if (previousScore === null || score !== previousScore) {
        competitionRank = index + 1;
        previousScore = score;
      }
      const rowRanks = ranksByRow.get(player) ?? {};
      rowRanks[position] = competitionRank;
      ranksByRow.set(player, rowRanks);
    });
  });

  return players.map((player) => ({
    ...player,
    position_ranks: ranksByRow.get(player) ?? {},
  }));
}

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
