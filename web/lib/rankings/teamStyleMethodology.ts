export type TeamRunAndGunPaceAxis = "high_event" | "balanced_event" | "low_event";
export type TeamRunAndGunControlAxis =
  | "controls_play"
  | "balanced_control"
  | "chasing_play";

export type TeamRunAndGunProfile = {
  eventRate: number | null;
  xgForPercentage: number | null;
  paceAxis: TeamRunAndGunPaceAxis | null;
  controlAxis: TeamRunAndGunControlAxis | null;
};

export type TeamLuckComponents = {
  finishingLuck: number | null;
  saveLuck: number | null;
  netGoalsAboveExpected: number | null;
};

export type TeamGameContextComponents = {
  oneGoalGameRate: number | null;
  homeRoadPointPctGap: number | null;
  powerPlayOpportunityRate: number | null;
  penaltiesTakenPer60: number | null;
};

export type TeamSourcePendingMetricContract = {
  metricKey: string;
  label: string;
  status: "source_pending";
  reason: string;
  requiredFields: string[];
};

export const TEAM_STYLE_SOURCE_CONTRACT = {
  currentLabel: "raw_contextual_5v5",
  publishLabel: "Raw/contextual 5v5 team style",
  adjustedTargetLabel: "Score- and venue-adjusted 5v5 team style",
  currentStatus:
    "Current helper formulas are product-safe only as raw/contextual descriptors until a verified score- and venue-adjusted aggregate source is wired.",
  requiredAdjustedInputs: [
    "score-state-adjusted 5v5 xGF and xGA",
    "venue-adjusted 5v5 xGF and xGA",
    "score-state-adjusted 5v5 FF and FA",
    "team-game sample counts and league event-rate baselines",
  ],
  formulaDecisions: {
    shotQuality: "xGF / FF",
    eventRate: "xGF + xGA per team game",
    control: "xGF%",
    luck: "(GF - xGF) + (xGA - GA)",
  },
  caveats: [
    "Do not label current team-style helpers as adjusted.",
    "Use score- and venue-adjusted 5v5 aggregates before publishing coach/style labels as adjusted team traits.",
    "Keep event rate separate from control so high-event weak-control teams are not mislabeled as run-and-gun in a positive sense.",
  ],
} as const;

export const TEAM_SOURCE_PENDING_METRIC_CONTRACTS: TeamSourcePendingMetricContract[] = [
  {
    metricKey: "home_road_point_pct_gap",
    label: "Home Edge",
    status: "source_pending",
    reason:
      "The current wgo_team_stats source publishes point percentage but not the verified home/road split column needed for this metric.",
    requiredFields: [
      "team id",
      "game id",
      "home/road flag",
      "point percentage or game result by venue",
    ],
  },
  {
    metricKey: "forward_top_load_index",
    label: "Forward Top Load",
    status: "source_pending",
    reason:
      "Verified forward-line TOI share by team/game is not published in the current rankings source contract.",
    requiredFields: [
      "team id",
      "game id",
      "line number",
      "line TOI seconds",
      "team forward TOI seconds",
    ],
  },
  {
    metricKey: "defense_pair_top_load_index",
    label: "Defense Pair Top Load",
    status: "source_pending",
    reason:
      "Verified defense-pair TOI share by team/game is not published in the current rankings source contract.",
    requiredFields: [
      "team id",
      "game id",
      "pair number",
      "pair TOI seconds",
      "team defense TOI seconds",
    ],
  },
  {
    metricKey: "pp1_pp2_usage_share",
    label: "PP1/PP2 Usage Share",
    status: "source_pending",
    reason:
      "Power-play unit membership exists as contextual labels, but verified PP unit TOI share is not published.",
    requiredFields: [
      "team id",
      "game id",
      "power-play unit number",
      "unit PP TOI seconds",
      "team PP TOI seconds",
    ],
  },
];

function finite(value: number | null | undefined): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function finitePositive(value: number | null | undefined): number | null {
  const number = finite(value);
  return number != null && number > 0 ? number : null;
}

function round(value: number, decimals = 6) {
  return Number(value.toFixed(decimals));
}

export function calculateTeamExpectedGoalsForPercentage(args: {
  xgFor: number | null;
  xgAgainst: number | null;
}) {
  const xgFor = finite(args.xgFor);
  const xgAgainst = finite(args.xgAgainst);
  if (xgFor == null || xgAgainst == null || xgFor + xgAgainst <= 0) {
    return null;
  }
  return round((xgFor / (xgFor + xgAgainst)) * 100);
}

export function calculateTeamShotQuality(args: {
  xgFor: number | null;
  fenwickFor: number | null;
}) {
  const xgFor = finite(args.xgFor);
  const fenwickFor = finitePositive(args.fenwickFor);
  if (xgFor == null || fenwickFor == null) return null;
  return round(xgFor / fenwickFor);
}

export function calculateRunAndGunProfile(args: {
  xgFor: number | null;
  xgAgainst: number | null;
  gamesCount?: number | null;
  leagueAverageEventRate?: number | null;
  highEventMultiplier?: number;
  lowEventMultiplier?: number;
  controlThresholdPct?: number;
}): TeamRunAndGunProfile {
  const xgFor = finite(args.xgFor);
  const xgAgainst = finite(args.xgAgainst);
  const gamesCount = finitePositive(args.gamesCount ?? 1);
  const leagueAverageEventRate = finitePositive(args.leagueAverageEventRate);
  const highEventMultiplier = args.highEventMultiplier ?? 1.1;
  const lowEventMultiplier = args.lowEventMultiplier ?? 0.9;
  const controlThresholdPct = args.controlThresholdPct ?? 55;
  const xgForPercentage = calculateTeamExpectedGoalsForPercentage({
    xgFor,
    xgAgainst,
  });

  if (xgFor == null || xgAgainst == null || gamesCount == null) {
    return {
      eventRate: null,
      xgForPercentage,
      paceAxis: null,
      controlAxis: null,
    };
  }

  const eventRate = round((xgFor + xgAgainst) / gamesCount);
  const paceAxis =
    leagueAverageEventRate == null
      ? null
      : eventRate >= leagueAverageEventRate * highEventMultiplier
        ? "high_event"
        : eventRate <= leagueAverageEventRate * lowEventMultiplier
          ? "low_event"
          : "balanced_event";
  const controlAxis =
    xgForPercentage == null
      ? null
      : xgForPercentage >= controlThresholdPct
        ? "controls_play"
        : xgForPercentage <= 100 - controlThresholdPct
          ? "chasing_play"
          : "balanced_control";

  return {
    eventRate,
    xgForPercentage,
    paceAxis,
    controlAxis,
  };
}

export function calculateTeamLuckComponents(args: {
  goalsFor: number | null;
  goalsAgainst: number | null;
  xgFor: number | null;
  xgAgainst: number | null;
}): TeamLuckComponents {
  const goalsFor = finite(args.goalsFor);
  const goalsAgainst = finite(args.goalsAgainst);
  const xgFor = finite(args.xgFor);
  const xgAgainst = finite(args.xgAgainst);
  if (
    goalsFor == null ||
    goalsAgainst == null ||
    xgFor == null ||
    xgAgainst == null
  ) {
    return {
      finishingLuck: null,
      saveLuck: null,
      netGoalsAboveExpected: null,
    };
  }

  const finishingLuck = round(goalsFor - xgFor);
  const saveLuck = round(xgAgainst - goalsAgainst);
  return {
    finishingLuck,
    saveLuck,
    netGoalsAboveExpected: round(finishingLuck + saveLuck),
  };
}

function average(values: Array<number | null | undefined>) {
  let total = 0;
  let count = 0;
  for (const value of values) {
    const number = finite(value);
    if (number == null) continue;
    total += number;
    count += 1;
  }
  return count > 0 ? round(total / count) : null;
}

export function calculateTeamGameContextComponents(args: {
  games: Array<{
    goalsFor: number | null;
    goalsAgainst: number | null;
    pointPct: number | null;
    homeRoad: string | null;
    powerPlayOpportunitiesPerGame: number | null;
    penaltiesTakenPer60: number | null;
  }>;
}): TeamGameContextComponents {
  const scoredGames = args.games.filter(
    (game) => finite(game.goalsFor) != null && finite(game.goalsAgainst) != null,
  );
  const oneGoalGameRate =
    scoredGames.length > 0
      ? round(
          (scoredGames.filter(
            (game) =>
              Math.abs((finite(game.goalsFor) ?? 0) - (finite(game.goalsAgainst) ?? 0)) <=
              1,
          ).length /
            scoredGames.length) *
            100,
        )
      : null;

  const homePointPct = average(
    args.games
      .filter((game) => game.homeRoad?.toLowerCase() === "home")
      .map((game) => game.pointPct),
  );
  const roadPointPct = average(
    args.games
      .filter((game) => game.homeRoad?.toLowerCase() === "road")
      .map((game) => game.pointPct),
  );

  return {
    oneGoalGameRate,
    homeRoadPointPctGap:
      homePointPct == null || roadPointPct == null
        ? null
        : round((homePointPct - roadPointPct) * 100),
    powerPlayOpportunityRate: average(
      args.games.map((game) => game.powerPlayOpportunitiesPerGame),
    ),
    penaltiesTakenPer60: average(args.games.map((game) => game.penaltiesTakenPer60)),
  };
}
