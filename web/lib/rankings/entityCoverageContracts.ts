export type RankingEntityCoverageStatus =
  | "live"
  | "source_verified_api_not_live"
  | "planned";

export type RankingEntitySourceContract = {
  entity: "goalie" | "team";
  status: RankingEntityCoverageStatus;
  verifiedAt: string;
  currentUiState: "not_selectable" | "planned_only" | "live";
  sourceSummary: string;
  verifiedSources: Array<{
    name: string;
    kind: "table" | "view" | "materialized_view";
    rowCount: number | null;
    latestDate: string | null;
    ownership: string;
    rankingUse: string;
  }>;
  liveRankingGates: readonly string[];
  initialMetricPlan: Array<{
    metricKey: string;
    label: string;
    source: string;
    availabilityTarget: "available" | "planned";
    notes: string;
  }>;
  caveats: readonly string[];
};

export const GOALIE_RANKING_SOURCE_CONTRACT: RankingEntitySourceContract = {
  entity: "goalie",
  status: "live",
  verifiedAt: "2026-06-09",
  currentUiState: "live",
  sourceSummary:
    "Goalie ranking sources exist, are populated, and now power the live goalie rankings matrix.",
  verifiedSources: [
    {
      name: "wgo_goalie_stats",
      kind: "table",
      rowCount: 139893,
      latestDate: "2026-06-06",
      ownership: "official goalie game-log ingestion",
      rankingUse:
        "games played, starts, saves, shots against, save percentage, quality starts, rest splits, and workload denominators",
    },
    {
      name: "goalie_stats_unified",
      kind: "materialized_view",
      rowCount: 10050,
      latestDate: "2026-06-06",
      ownership: "existing unified WGO plus NST goalie source surface",
      rankingUse:
        "latest per-goalie descriptive source for GSAx/GSAA, xG against, save percentage, quality starts, and strength-specific NST goalie fields",
    },
    {
      name: "goalie_start_projections",
      kind: "table",
      rowCount: 7565,
      latestDate: "2026-06-09",
      ownership: "shared goalie-prior table written by update-goalie-projections-v2",
      rankingUse:
        "starter probability, recent/season start share, projected GSAA/60, and confirmed-status context",
    },
  ],
  liveRankingGates: [
    "Extend the rankings entity parser/types beyond skaters without breaking the existing skater matrix contract.",
    "Build a goalie latest-snapshot reader over existing goalie sources instead of creating a redundant rankings table.",
    "Define goalie peer groups for workload/deployment buckets before calculating percentiles.",
    "Expose goalie-specific sample confidence from starts, games played, and shots faced.",
    "Keep starter probability separate from descriptive goalie talent metrics in the UI.",
  ],
  initialMetricPlan: [
    {
      metricKey: "goalie_gsaa_per_60",
      label: "GSAA/60",
      source: "goalie_stats_unified.nst_*_rates_gsaa_per_60",
      availabilityTarget: "available",
      notes:
        "Use only after the snapshot reader proves strength-specific NST fields are populated for the selected date/window.",
    },
    {
      metricKey: "goalie_gsax",
      label: "GSAx",
      source: "goalie_stats_unified.nst_*_counts_xg_against and goals_against",
      availabilityTarget: "available",
      notes:
        "Prefer explicit xG-against minus goals-against semantics when a precomputed GSAx field is absent.",
    },
    {
      metricKey: "goalie_xga_per_shot_against",
      label: "xGA/Shot",
      source:
        "goalie_stats_unified.nst_5v5_counts_xg_against and nst_5v5_counts_shots_against",
      availabilityTarget: "available",
      notes:
        "Shot-quality workload context. Higher values indicate harder chances faced, not pure goalie talent.",
    },
    {
      metricKey: "goalie_value_signal",
      label: "Value Signal",
      source: "goalie_stats_unified 5v5 GSAx and GSAA",
      availabilityTarget: "available",
      notes:
        "Documented non-WAR saved-goals signal from available cumulative 5v5 GSAx and GSAA.",
    },
    {
      metricKey: "goalie_high_danger_save_percentage",
      label: "HD SV%",
      source:
        "goalie_stats_unified.nst_5v5_counts_hd_saves and hd_shots_against",
      availabilityTarget: "available",
      notes:
        "Source-backed high-danger save context from NST counts; still sample-sensitive.",
    },
    {
      metricKey: "goalie_relative_save_percentage",
      label: "Relative SV%",
      source:
        "goalie_stats_unified 5v5 saves/shots with same-team other-goalie baseline",
      availabilityTarget: "available",
      notes:
        "Selected-window 5v5 relative save signal. Rows stay null until the goalie and same-team other-goalie baseline samples are available.",
    },
    {
      metricKey: "goalie_under_pressure_profile",
      label: "Under Pressure",
      source: "pressure-quadrant source rows not yet published",
      availabilityTarget: "planned",
      notes:
        "Keep source-pending until pressure bucket labels and save outcomes are available.",
    },
    {
      metricKey: "goalie_quality_start_pct",
      label: "QS%",
      source: "wgo_goalie_stats.quality_start / games_started",
      availabilityTarget: "available",
      notes:
        "Use starts as the denominator and show low-start sample warnings.",
    },
    {
      metricKey: "goalie_really_bad_start_rate",
      label: "RBS%",
      source: "goalie_stats_unified plus goalieMethodology.isGoalieReallyBadStart",
      availabilityTarget: "available",
      notes:
        "Use starts as the denominator, modern GSAx thresholds when xG source rows exist, and lower-is-better percentile semantics.",
    },
    {
      metricKey: "goalie_start_share",
      label: "Start Share",
      source: "goalie_start_projections.l10_start_pct and season_start_pct",
      availabilityTarget: "available",
      notes:
        "Role/deployment signal, not a talent score.",
    },
    {
      metricKey: "goalie_steal_rate",
      label: "Steal Rate",
      source: "wgo_goalie_stats plus goalieMethodology.isGoalieStealGame",
      availabilityTarget: "available",
      notes:
        "First API path aggregates wins, starts, and 5v5 GSAx through goalieMethodology.isGoalieStealGame.",
    },
  ],
  caveats: [
    "Goalie performance is volatile; rankings need heavier uncertainty language than skater rankings.",
    "Starter probability is lineup/role context and should not be blended into save-performance percentiles without clear labeling.",
    "Some historical unified-view rows have null team_id and null NST xG fields, so the snapshot reader must surface partial-source states.",
  ],
};

export const TEAM_RANKING_SOURCE_CONTRACT: RankingEntitySourceContract = {
  entity: "team",
  status: "live",
  verifiedAt: "2026-06-09",
  currentUiState: "live",
  sourceSummary:
    "Team ranking sources exist, are populated, and now power the live team rankings matrix with raw/contextual style caveats.",
  verifiedSources: [
    {
      name: "team_power_ratings_daily",
      kind: "table",
      rowCount: 7763,
      latestDate: "2026-06-09",
      ownership: "scheduled team power rating pipeline",
      rankingUse:
        "offense, defense, pace, xGF/60, xGA/60, special-teams tiers, goalie rating, and trend context",
    },
    {
      name: "team_underlying_stats_summary",
      kind: "table",
      rowCount: 174020,
      latestDate: "2026-04-07",
      ownership: "team underlying stats summary pipeline",
      rankingUse:
        "strength, score-state, venue, event counts, and opponent-context source for future adjusted team style",
    },
    {
      name: "nst_team_stats",
      kind: "table",
      rowCount: 64,
      latestDate: null,
      ownership: "season-level NST team stats ingestion",
      rankingUse:
        "season-level control, shot quality, goal share, and raw team-style context",
    },
    {
      name: "wgo_team_stats",
      kind: "table",
      rowCount: null,
      latestDate: "2026-06-06",
      ownership: "official team game-log ingestion",
      rankingUse:
        "one-goal game rate, home/road point-percentage split, power-play opportunities, and penalty context",
    },
    {
      name: "games",
      kind: "table",
      rowCount: null,
      latestDate: "2026-06-22",
      ownership: "official game schedule/identity ingestion",
      rankingUse:
        "homeTeamId and awayTeamId venue identity for WGO team game rows",
    },
    {
      name: "team_unit_toi",
      kind: "table",
      rowCount: 12929,
      latestDate: "2026-06-22",
      ownership: "derived durable aggregate from NHL shift rows and power-play combination rows",
      rankingUse:
        "forward top-load, defense-pair top-load, and PP1/PP2 usage-share metrics from pooled player-seconds",
    },
  ],
  liveRankingGates: [
    "Extend rankings entity parser/types to teams without overloading player-specific request fields.",
    "Build a team latest-snapshot reader over existing team_power_ratings_daily and team_underlying_stats_summary.",
    "Label team style as raw/contextual until score- and venue-adjusted aggregates are wired.",
    "Define team peer groups separately from skater deployment buckets.",
    "Surface stale-source metadata when team_underlying_stats_summary lags current team_power_ratings_daily.",
  ],
  initialMetricPlan: [
    {
      metricKey: "team_offense_rating",
      label: "Offense Rating",
      source: "team_power_ratings_daily.off_rating",
      availabilityTarget: "available",
      notes: "Can be live once team rows and percentile calculation are implemented.",
    },
    {
      metricKey: "team_defense_rating",
      label: "Defense Rating",
      source: "team_power_ratings_daily.def_rating",
      availabilityTarget: "available",
      notes: "Confirm directionality before display because defensive scales may be inverted.",
    },
    {
      metricKey: "team_xgf60",
      label: "xGF/60",
      source: "team_power_ratings_daily.xgf60",
      availabilityTarget: "available",
      notes: "Raw team chance-generation rate.",
    },
    {
      metricKey: "team_xga60",
      label: "xGA/60",
      source: "team_power_ratings_daily.xga60",
      availabilityTarget: "available",
      notes: "Lower is better; label as raw until adjusted model gates are met.",
    },
    {
      metricKey: "team_style_badge",
      label: "Team Style",
      source: "nst_team_stats plus team_underlying_stats_summary",
      availabilityTarget: "available",
      notes:
        "Publish as raw/contextual only until score- and venue-adjusted aggregates are verified.",
    },
    {
      metricKey: "team_one_goal_game_rate",
      label: "1-Goal Game Rate",
      source: "wgo_team_stats.goals_for and goals_against",
      availabilityTarget: "available",
      notes:
        "Current game-context style metric; share of team games decided by one goal or fewer.",
    },
    {
      metricKey: "team_home_road_point_pct_gap",
      label: "Home Edge",
      source: "wgo_team_stats.point_pct joined to games.homeTeamId/awayTeamId",
      availabilityTarget: "available",
      notes:
        "Home point-percentage minus road point-percentage; context, not pure coaching talent.",
    },
    {
      metricKey: "team_pp_opportunity_rate",
      label: "PP Opp/G",
      source: "wgo_team_stats.pp_opportunities_per_game",
      availabilityTarget: "available",
      notes: "Special-teams opportunity context from verified team game logs.",
    },
    {
      metricKey: "team_penalties_taken_per_60",
      label: "Penalties/60",
      source: "wgo_team_stats.penalties_taken_per_60",
      availabilityTarget: "available",
      notes:
        "Discipline context with lower-is-better ranking semantics; not labeled as adjusted coaching talent.",
    },
    {
      metricKey: "team_forward_top_load_index",
      label: "Forward Top Load",
      source: "team_unit_toi forward_line unit_number=1",
      availabilityTarget: "available",
      notes:
        "Durable aggregate derives 5v5 forward trio overlap from NHL shift rows using pooled player-seconds; coverage is partial when shifts cannot resolve complete position groups.",
    },
    {
      metricKey: "team_defense_pair_top_load_index",
      label: "Defense Pair Top Load",
      source: "team_unit_toi defense_pair unit_number=1",
      availabilityTarget: "available",
      notes:
        "Durable aggregate derives 5v5 defense pair overlap from NHL shift rows using pooled player-seconds; coverage is partial when shifts cannot resolve complete position groups.",
    },
    {
      metricKey: "team_pp1_pp2_usage_share",
      label: "PP1/PP2 Usage Share",
      source: "team_unit_toi power_play unit_number in (1,2)",
      availabilityTarget: "available",
      notes:
        "Durable aggregate combines power-play unit membership and PPTOI into team/game unit shares using pooled player-seconds.",
    },
  ],
  caveats: [
    "Team power ratings are current through 2026-06-09, while team_underlying_stats_summary currently lags at 2026-04-07.",
    "Current team-style methodology is raw/contextual, not score- and venue-adjusted.",
    "Forward/defense unit-usage coverage is partial because strict 5v5 overlap requires complete position-resolved shift rows.",
    "Team views need their own request model because skater fields such as position, deployment, and selectedPlayerId do not apply.",
  ],
};

export const RANKING_ENTITY_COVERAGE_CONTRACTS = [
  GOALIE_RANKING_SOURCE_CONTRACT,
  TEAM_RANKING_SOURCE_CONTRACT,
] as const;
