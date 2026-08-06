type ProjectionLearningMetrics = {
  players_considered: number;
  goal_rate_recent_players: number;
  assist_rate_recent_players: number;
  goal_rate_recent_share: number;
  assist_rate_recent_share: number;
};

type ProjectionDataQualityMetrics = {
  skater_pool_projected_teams: number;
  skater_pool_projected_count_sum: number;
  skater_pool_projected_count_avg: number | null;
};

export type ProjectionMetricsFinalizationTarget = {
  player_rows: number;
  team_rows: number;
  goalie_rows: number;
  learning: ProjectionLearningMetrics;
  data_quality: ProjectionDataQualityMetrics;
  finished_at?: string;
  timed_out?: boolean;
};

export function runMetricsFinalizationStage(args: {
  metrics: ProjectionMetricsFinalizationTarget;
  playerRowsUpserted: number;
  teamRowsUpserted: number;
  goalieRowsUpserted: number;
  learningCounters: {
    players: number;
    goalRecent: number;
    assistRecent: number;
  };
  timedOut: boolean;
  finishedAt?: string;
}): void {
  const {
    metrics,
    playerRowsUpserted,
    teamRowsUpserted,
    goalieRowsUpserted,
    learningCounters,
    timedOut,
  } = args;

  metrics.player_rows = playerRowsUpserted;
  metrics.team_rows = teamRowsUpserted;
  metrics.goalie_rows = goalieRowsUpserted;
  metrics.learning.players_considered = learningCounters.players;
  metrics.learning.goal_rate_recent_players = learningCounters.goalRecent;
  metrics.learning.assist_rate_recent_players = learningCounters.assistRecent;
  metrics.learning.goal_rate_recent_share =
    learningCounters.players > 0
      ? learningCounters.goalRecent / learningCounters.players
      : 0;
  metrics.learning.assist_rate_recent_share =
    learningCounters.players > 0
      ? learningCounters.assistRecent / learningCounters.players
      : 0;
  metrics.data_quality.skater_pool_projected_count_avg =
    metrics.data_quality.skater_pool_projected_teams > 0
      ? Number(
          (
            metrics.data_quality.skater_pool_projected_count_sum /
            metrics.data_quality.skater_pool_projected_teams
          ).toFixed(3),
        )
      : null;
  metrics.finished_at = args.finishedAt ?? new Date().toISOString();
  metrics.timed_out = timedOut;
}
