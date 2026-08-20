export const FANTASY_PROJECTION_SEASON_ID = 20262027;
export const FANTASY_PROJECTION_V3_CONTRACT_VERSION =
  "player-forecasts-research-v3-season";
export const FANTASY_PROJECTION_V3_CONTRACT_CHECKSUM =
  "29c6766f63ba9a8dbf8890cb6a388418945134b70217d58e9d8645b34dc36b93";
export const FANTASY_PROJECTION_V4_CONTRACT_VERSION =
  "player-forecasts-research-v4-season-fantasy";
export const FANTASY_PROJECTION_V4_CONTRACT_CHECKSUM =
  "e0b10f508d4f3e96b93cb3b203930e05d15c1f75dcc969030e4a04f20de18150";
export const FANTASY_PROJECTION_V5_CONTRACT_VERSION =
  "player-forecasts-research-v5-season-advanced";
export const FANTASY_PROJECTION_V5_CONTRACT_CHECKSUM =
  "9b91e7d1de540664f404cc518222e61fcb837127a25916ee735f37d7a185a435";
export const FANTASY_PROJECTION_CONTRACT_VERSION =
  FANTASY_PROJECTION_V3_CONTRACT_VERSION;
export const FANTASY_PROJECTION_CONTRACT_CHECKSUM =
  FANTASY_PROJECTION_V3_CONTRACT_CHECKSUM;
export const FANTASY_PROJECTION_SUPPORTED_CONTRACTS: Readonly<Record<string, string>> = {
  [FANTASY_PROJECTION_V3_CONTRACT_VERSION]: FANTASY_PROJECTION_V3_CONTRACT_CHECKSUM,
  [FANTASY_PROJECTION_V4_CONTRACT_VERSION]: FANTASY_PROJECTION_V4_CONTRACT_CHECKSUM,
  [FANTASY_PROJECTION_V5_CONTRACT_VERSION]: FANTASY_PROJECTION_V5_CONTRACT_CHECKSUM,
};
export const FANTASY_PROJECTION_BETA_LABEL =
  "2026–27 beta — model plus editorial review";

export const SKATER_PRIMITIVE_TARGETS = [
  "GAMES_PLAYED",
  "TOTAL_TOI",
  "EV_TOI",
  "PP_TOI",
  "PK_TOI",
  "GOALS",
  "PRIMARY_ASSISTS",
  "SECONDARY_ASSISTS",
  "PLUS_MINUS",
  "SHOTS_ON_GOAL",
  "HITS",
  "BLOCKED_SHOTS",
  "PENALTY_MINUTES",
  "PP_GOALS",
  "PP_ASSISTS",
  "SH_GOALS",
  "SH_ASSISTS",
  "FACEOFFS_WON",
  "FACEOFFS_LOST",
] as const;

export const GOALIE_PRIMITIVE_TARGETS = [
  "GAMES_PLAYED",
  "GAMES_STARTED",
  "TOTAL_TOI",
  "WINS_GOALIE",
  "LOSSES_GOALIE",
  "OTL_GOALIE",
  "SHOTS_AGAINST_GOALIE",
  "GOALS_AGAINST_GOALIE",
  "SHUTOUTS_GOALIE",
] as const;

export const SKATER_DERIVED_TARGETS = [
  "ASSISTS",
  "POINTS",
  "PP_POINTS",
  "SH_POINTS",
] as const;

export const GOALIE_DERIVED_TARGETS = [
  "SAVES_GOALIE",
  "SAVE_PERCENTAGE",
  "GOALS_AGAINST_AVERAGE",
] as const;

export const SKATER_FANTASY_V4_PRIMITIVE_TARGETS = [
  "TAKEAWAYS",
  "GIVEAWAYS",
  "MISSED_SHOTS",
  "PENALTIES_DRAWN",
  "PENALTIES_TAKEN",
  "GAME_WINNING_GOALS",
  "OVERTIME_GOALS",
  "EMPTY_NET_GOALS",
  "EMPTY_NET_POINTS",
  "EV_GOALS",
  "EV_PRIMARY_ASSISTS",
  "EV_SECONDARY_ASSISTS",
  "PP_PRIMARY_ASSISTS",
  "PP_SECONDARY_ASSISTS",
  "SH_PRIMARY_ASSISTS",
  "SH_SECONDARY_ASSISTS",
  "EN_PRIMARY_ASSISTS",
  "EN_SECONDARY_ASSISTS",
] as const;

export const GOALIE_FANTASY_V4_PRIMITIVE_TARGETS = [
  "QUALITY_STARTS_GOALIE",
] as const;

export const SKATER_ADVANCED_V5_PRIMITIVE_TARGETS = [
  "SHOT_ATTEMPTS",
  "UNBLOCKED_SHOT_ATTEMPTS",
  "EXPECTED_GOALS",
  "EXPECTED_PRIMARY_ASSISTS",
  "EXPECTED_SECONDARY_ASSISTS",
  "HIGH_DANGER_SHOTS",
  "MID_RANGE_SHOTS",
  "LONG_RANGE_SHOTS",
  "RUSH_SHOTS",
  "REBOUND_SHOTS",
  "REBOUNDS_CREATED",
  "ON_ICE_SHOT_ATTEMPTS_FOR",
  "ON_ICE_SHOT_ATTEMPTS_AGAINST",
  "ON_ICE_UNBLOCKED_ATTEMPTS_FOR",
  "ON_ICE_UNBLOCKED_ATTEMPTS_AGAINST",
  "ON_ICE_EXPECTED_GOALS_FOR",
  "ON_ICE_EXPECTED_GOALS_AGAINST",
] as const;

export const GOALIE_ADVANCED_V5_PRIMITIVE_TARGETS = [
  "EXPECTED_GOALS_AGAINST_GOALIE",
  "HIGH_DANGER_SHOTS_AGAINST_GOALIE",
  "HIGH_DANGER_GOALS_AGAINST_GOALIE",
  "MID_RANGE_SHOTS_AGAINST_GOALIE",
  "MID_RANGE_GOALS_AGAINST_GOALIE",
  "LONG_RANGE_SHOTS_AGAINST_GOALIE",
  "LONG_RANGE_GOALS_AGAINST_GOALIE",
] as const;

export const TEAM_ADVANCED_V5_TARGETS = [
  "TEAM_SHOT_ATTEMPTS_FOR",
  "TEAM_SHOT_ATTEMPTS_AGAINST",
  "TEAM_UNBLOCKED_ATTEMPTS_FOR",
  "TEAM_UNBLOCKED_ATTEMPTS_AGAINST",
  "TEAM_EXPECTED_GOALS_FOR",
  "TEAM_EXPECTED_GOALS_AGAINST",
  "TEAM_HIGH_DANGER_SHOTS_FOR",
  "TEAM_HIGH_DANGER_SHOTS_AGAINST",
  "TEAM_PACE",
] as const;

export const SKATER_EXPANDED_DERIVED_TARGETS = [
  "EV_ASSISTS",
  "EV_POINTS",
  "SHOOTING_PERCENTAGE",
  "FACEOFF_PERCENTAGE",
  "POINTS_PER_GAME",
  "TOI_PER_GAME",
  "EXPECTED_ASSISTS",
  "ON_ICE_CF_PERCENTAGE",
  "ON_ICE_FF_PERCENTAGE",
  "ON_ICE_XGF_PERCENTAGE",
] as const;

export const GOALIE_EXPANDED_DERIVED_TARGETS = [
  "RELIEF_APPEARANCES_GOALIE",
  "START_PERCENTAGE_GOALIE",
  "WIN_PERCENTAGE_GOALIE",
  "GOALS_SAVED_ABOVE_EXPECTED",
  "HIGH_DANGER_SAVES_GOALIE",
  "MID_RANGE_SAVES_GOALIE",
  "LONG_RANGE_SAVES_GOALIE",
  "HIGH_DANGER_SAVE_PERCENTAGE_GOALIE",
  "MID_RANGE_SAVE_PERCENTAGE_GOALIE",
  "LONG_RANGE_SAVE_PERCENTAGE_GOALIE",
] as const;

export const SKATER_SCORING_TARGETS = [
  ...SKATER_PRIMITIVE_TARGETS,
  ...SKATER_DERIVED_TARGETS,
  ...SKATER_FANTASY_V4_PRIMITIVE_TARGETS,
  ...SKATER_ADVANCED_V5_PRIMITIVE_TARGETS,
  ...SKATER_EXPANDED_DERIVED_TARGETS,
] as const;

export const GOALIE_SCORING_TARGETS = [
  ...GOALIE_PRIMITIVE_TARGETS,
  ...GOALIE_DERIVED_TARGETS,
  ...GOALIE_FANTASY_V4_PRIMITIVE_TARGETS,
  ...GOALIE_ADVANCED_V5_PRIMITIVE_TARGETS,
  ...GOALIE_EXPANDED_DERIVED_TARGETS,
] as const;

export type FantasyProjectionView = "opening" | "current" | "ros";
export type FantasyProjectionPopulation = "forward" | "defense" | "goalie";
export type FantasyProjectionPosition = "C" | "L" | "R" | "D" | "G";
export type FantasyProjectionRosterStatus =
  | "active_nhl"
  | "injured_nhl"
  | "affiliate"
  | "prospect_reserve"
  | "unsigned"
  | "unresolved";
export type ProjectionValues = Record<string, number>;

function projectionNumber(value: number): number {
  return Number(value.toFixed(10));
}

export type ProjectionRating = {
  value: number;
  confidence: number;
  sampleGames?: number;
  modelVersion?: string;
};

export type ProjectionDeployment = {
  mostLikelyRole?: Record<string, string | number | null>;
  roleProbabilities?: Record<string, Record<string, number>>;
  confidence?: number;
  expectedEvToi?: number;
  expectedPpToi?: number;
  expectedPkToi?: number;
  expectedTotalToi?: number;
  alternatives?: Array<{
    role: string;
    probability: number;
  }>;
};

export type FantasyProjectionRelease = {
  id: string;
  seasonId: number;
  view: FantasyProjectionView;
  releaseNumber: number;
  label: string;
  beta: boolean;
  issuedAt: string;
  cutoffAt: string;
  artifactChecksum: string;
  contractVersion: string;
  contractChecksum: string;
  rosterRevisionHash: string;
  scheduleRevisionHash: string;
  sourceHighWatermark: string;
  releaseHash: string;
  active: boolean;
  metricSetVersion: string;
  rosterObservedAt: string | null;
  transactionCutoffAt: string | null;
  healthStatus: "healthy" | "held" | "stale" | "unknown";
  healthSummary: Record<string, unknown>;
};

export type FantasyProjectionRookieProfile = {
  rookie: boolean;
  rosterProbability: number | null;
  sourceCoverage: string[];
  nhleMethod: string | null;
  sourceLeague?: string | null;
};

export type FantasyProjectionPlayer = {
  id: string;
  releaseId: string;
  fhfhPlayerId: number;
  teamId: number | null;
  teamAbbreviation: string | null;
  playerName: string;
  position: FantasyProjectionPosition;
  population: FantasyProjectionPopulation;
  poolStatus: "verified_active" | "active_prospect" | "unsigned_relevant" | "review_required";
  rosterStatus: FantasyProjectionRosterStatus;
  rosterConfidence: number;
  sourceFreshAt: string | null;
  rookieProfile: FantasyProjectionRookieProfile;
  expectedGames: number;
  expectedStarts: number | null;
  expectedToi: ProjectionValues;
  ratings: Record<string, ProjectionRating | number>;
  deployment: ProjectionDeployment;
  modelValues: ProjectionValues;
  publishedValues: ProjectionValues;
  p10: ProjectionValues;
  p50: ProjectionValues;
  p90: ProjectionValues;
  adjustmentDelta: ProjectionValues;
  adjusted: boolean;
  fallbackFlags: string[];
  provenance: Record<string, unknown>;
};

export type FantasyProjectionTeam = {
  id: string;
  releaseId: string;
  teamId: number;
  teamName: string;
  abbreviation: string;
  modelRatings: Record<string, ProjectionRating | number>;
  publishedRatings: Record<string, ProjectionRating | number>;
  deployment: Record<string, unknown>;
  rosterCounts: Record<string, number>;
  modelValues: ProjectionValues;
  publishedValues: ProjectionValues;
  p10: ProjectionValues;
  p50: ProjectionValues;
  p90: ProjectionValues;
  adjustmentDelta: ProjectionValues;
  adjusted: boolean;
  confidence: number;
  provenance: Record<string, unknown>;
};

export type FantasyProjectionPlayersResponse = {
  success: true;
  betaLabel: string;
  release: FantasyProjectionRelease;
  players: FantasyProjectionPlayer[];
};

export const FANTASY_PROJECTION_SUMMARY_ENCODING = "player-summary-v1" as const;

export type FantasyProjectionPlayerSummaryTuple = [
  fhfhPlayerId: number,
  teamId: number | null,
  teamAbbreviation: string | null,
  playerName: string,
  position: FantasyProjectionPosition,
  population: FantasyProjectionPopulation,
  poolStatus: FantasyProjectionPlayer["poolStatus"],
  rosterStatus: FantasyProjectionRosterStatus,
  rosterConfidence: number,
  sourceFreshAt: string | null,
  rookie: 0 | 1,
  primaryRating: number,
  deploymentConfidence: number,
  roles: Array<string | number | null>,
  adjusted: 0 | 1,
  fallbackFlags: string[],
  values: number[],
];

export type FantasyProjectionCompactPlayersResponse = {
  success: true;
  betaLabel: string;
  release: FantasyProjectionRelease;
  encoding: typeof FANTASY_PROJECTION_SUMMARY_ENCODING;
  metricKeys: string[];
  players: FantasyProjectionPlayerSummaryTuple[];
};

export function expandFantasyProjectionSummary(
  payload: FantasyProjectionCompactPlayersResponse,
): FantasyProjectionPlayersResponse {
  if (payload.encoding !== FANTASY_PROJECTION_SUMMARY_ENCODING) {
    throw new Error("Unsupported fantasy-projection summary encoding.");
  }
  return {
    success: true,
    betaLabel: payload.betaLabel,
    release: payload.release,
    players: payload.players.map((row) => {
      const [
        fhfhPlayerId,
        teamId,
        teamAbbreviation,
        playerName,
        position,
        population,
        poolStatus,
        rosterStatus,
        rosterConfidence,
        sourceFreshAt,
        rookie,
        primaryRating,
        deploymentConfidence,
        roles,
        adjusted,
        fallbackFlags,
        values,
      ] = row;
      const publishedValues = Object.fromEntries(
        payload.metricKeys.map((key, index) => [key, Number(values[index] ?? 0)]),
      );
      const ratingKey =
        population === "goalie"
          ? "goaltending"
          : population === "defense"
            ? "defense"
            : "offense";
      const [forwardLine, defensePair, powerPlayUnit, penaltyKillUnit, goalieOrder] = roles;
      return {
        id: String(fhfhPlayerId),
        releaseId: payload.release.id,
        fhfhPlayerId,
        teamId,
        teamAbbreviation,
        playerName,
        position,
        population,
        poolStatus,
        rosterStatus,
        rosterConfidence,
        sourceFreshAt,
        rookieProfile: {
          rookie: rookie === 1,
          rosterProbability: null,
          sourceCoverage: [],
          nhleMethod: null,
          sourceLeague: null,
        },
        expectedGames: publishedValues.GAMES_PLAYED ?? 0,
        expectedStarts:
          population === "goalie" ? publishedValues.GAMES_STARTED ?? 0 : null,
        expectedToi: {
          total: publishedValues.TOTAL_TOI ?? 0,
          evenStrength: publishedValues.EV_TOI ?? 0,
          powerPlay: publishedValues.PP_TOI ?? 0,
          penaltyKill: publishedValues.PK_TOI ?? 0,
        },
        ratings: { [ratingKey]: primaryRating },
        deployment: {
          confidence: deploymentConfidence,
          mostLikelyRole: Object.fromEntries(
            [
              ["forwardLine", forwardLine],
              ["defensePair", defensePair],
              ["powerPlayUnit", powerPlayUnit],
              ["penaltyKillUnit", penaltyKillUnit],
              ["goalieOrder", goalieOrder],
            ].filter((entry) => entry[1] != null),
          ),
        },
        modelValues: {},
        publishedValues,
        p10: {},
        p50: {},
        p90: {},
        adjustmentDelta: {},
        adjusted: adjusted === 1,
        fallbackFlags,
        provenance: {},
      };
    }),
  };
}

export type FantasyProjectionPlayerDetailResponse = {
  success: true;
  betaLabel: string;
  release: FantasyProjectionRelease;
  player: FantasyProjectionPlayer;
  releaseHistory: Array<{
    view: FantasyProjectionView;
    releaseNumber: number;
    issuedAt: string;
    publishedValues: ProjectionValues;
    teamAbbreviation: string | null;
  }>;
};

export type FantasyProjectionTeamsResponse = {
  success: true;
  betaLabel: string;
  release: FantasyProjectionRelease;
  teams: FantasyProjectionTeam[];
};

export function reconcileProjectionValues(
  rawValues: ProjectionValues,
  population: FantasyProjectionPopulation,
): ProjectionValues {
  const values = Object.fromEntries(
    Object.entries(rawValues).map(([key, value]) => [
      key,
      Number.isFinite(value) ? Number(value) : 0,
    ]),
  );
  if (population === "goalie") {
    values.SAVES_GOALIE = projectionNumber(Math.max(
      0,
      (values.SHOTS_AGAINST_GOALIE ?? 0) -
        (values.GOALS_AGAINST_GOALIE ?? 0),
    ));
    values.SAVE_PERCENTAGE =
      (values.SHOTS_AGAINST_GOALIE ?? 0) > 0
        ? projectionNumber(values.SAVES_GOALIE / values.SHOTS_AGAINST_GOALIE)
        : 0;
    values.GOALS_AGAINST_AVERAGE =
      (values.TOTAL_TOI ?? 0) > 0
        ? projectionNumber(
            (3600 * (values.GOALS_AGAINST_GOALIE ?? 0)) / values.TOTAL_TOI,
          )
        : 0;
    values.RELIEF_APPEARANCES_GOALIE = projectionNumber(Math.max(
      0,
      (values.GAMES_PLAYED ?? 0) - (values.GAMES_STARTED ?? 0),
    ));
    values.START_PERCENTAGE_GOALIE =
      (values.GAMES_PLAYED ?? 0) > 0
        ? projectionNumber((values.GAMES_STARTED ?? 0) / values.GAMES_PLAYED)
        : 0;
    values.WIN_PERCENTAGE_GOALIE =
      (values.GAMES_STARTED ?? 0) > 0
        ? projectionNumber((values.WINS_GOALIE ?? 0) / values.GAMES_STARTED)
        : 0;
    values.GOALS_SAVED_ABOVE_EXPECTED = projectionNumber(
      (values.EXPECTED_GOALS_AGAINST_GOALIE ?? 0) -
        (values.GOALS_AGAINST_GOALIE ?? 0),
    );
    for (const danger of ["HIGH_DANGER", "MID_RANGE", "LONG_RANGE"] as const) {
      const shots = values[`${danger}_SHOTS_AGAINST_GOALIE`] ?? 0;
      const goals = values[`${danger}_GOALS_AGAINST_GOALIE`] ?? 0;
      const saves = Math.max(0, shots - goals);
      values[`${danger}_SAVES_GOALIE`] = projectionNumber(saves);
      values[`${danger}_SAVE_PERCENTAGE_GOALIE`] =
        shots > 0 ? projectionNumber(saves / shots) : 0;
    }
    return values;
  }

  const strengthComponents = [
    "EV_GOALS", "PP_GOALS", "SH_GOALS", "EMPTY_NET_GOALS",
    "EV_PRIMARY_ASSISTS", "PP_PRIMARY_ASSISTS", "SH_PRIMARY_ASSISTS",
    "EN_PRIMARY_ASSISTS", "EV_SECONDARY_ASSISTS", "PP_SECONDARY_ASSISTS",
    "SH_SECONDARY_ASSISTS", "EN_SECONDARY_ASSISTS",
  ];
  if (strengthComponents.every((target) => target in values)) {
    values.GOALS = projectionNumber(
      values.EV_GOALS + values.PP_GOALS + values.SH_GOALS + values.EMPTY_NET_GOALS,
    );
    values.PRIMARY_ASSISTS = projectionNumber(
      values.EV_PRIMARY_ASSISTS + values.PP_PRIMARY_ASSISTS +
        values.SH_PRIMARY_ASSISTS + values.EN_PRIMARY_ASSISTS,
    );
    values.SECONDARY_ASSISTS = projectionNumber(
      values.EV_SECONDARY_ASSISTS + values.PP_SECONDARY_ASSISTS +
        values.SH_SECONDARY_ASSISTS + values.EN_SECONDARY_ASSISTS,
    );
    values.PP_ASSISTS = projectionNumber(
      values.PP_PRIMARY_ASSISTS + values.PP_SECONDARY_ASSISTS,
    );
    values.SH_ASSISTS = projectionNumber(
      values.SH_PRIMARY_ASSISTS + values.SH_SECONDARY_ASSISTS,
    );
    values.EMPTY_NET_POINTS = projectionNumber(
      values.EMPTY_NET_GOALS + values.EN_PRIMARY_ASSISTS + values.EN_SECONDARY_ASSISTS,
    );
  }
  values.ASSISTS = projectionNumber(
    (values.PRIMARY_ASSISTS ?? 0) + (values.SECONDARY_ASSISTS ?? 0),
  );
  values.POINTS = projectionNumber((values.GOALS ?? 0) + values.ASSISTS);
  values.PP_POINTS = projectionNumber(
    (values.PP_GOALS ?? 0) + (values.PP_ASSISTS ?? 0),
  );
  values.SH_POINTS = projectionNumber(
    (values.SH_GOALS ?? 0) + (values.SH_ASSISTS ?? 0),
  );
  values.EV_ASSISTS = projectionNumber(
    (values.EV_PRIMARY_ASSISTS ?? 0) + (values.EV_SECONDARY_ASSISTS ?? 0),
  );
  values.EV_POINTS = projectionNumber((values.EV_GOALS ?? 0) + values.EV_ASSISTS);
  values.SHOOTING_PERCENTAGE =
    (values.SHOTS_ON_GOAL ?? 0) > 0
      ? projectionNumber((values.GOALS ?? 0) / values.SHOTS_ON_GOAL)
      : 0;
  const faceoffs = (values.FACEOFFS_WON ?? 0) + (values.FACEOFFS_LOST ?? 0);
  values.FACEOFF_PERCENTAGE =
    faceoffs > 0 ? projectionNumber((values.FACEOFFS_WON ?? 0) / faceoffs) : 0;
  values.POINTS_PER_GAME =
    (values.GAMES_PLAYED ?? 0) > 0
      ? projectionNumber(values.POINTS / values.GAMES_PLAYED)
      : 0;
  values.TOI_PER_GAME =
    (values.GAMES_PLAYED ?? 0) > 0
      ? projectionNumber((values.TOTAL_TOI ?? 0) / values.GAMES_PLAYED)
      : 0;
  values.EXPECTED_ASSISTS = projectionNumber(
    (values.EXPECTED_PRIMARY_ASSISTS ?? 0) +
      (values.EXPECTED_SECONDARY_ASSISTS ?? 0),
  );
  const share = (forKey: string, againstKey: string): number => {
    const forValue = values[forKey] ?? 0;
    const againstValue = values[againstKey] ?? 0;
    return forValue + againstValue > 0
      ? projectionNumber(forValue / (forValue + againstValue))
      : 0;
  };
  values.ON_ICE_CF_PERCENTAGE = share(
    "ON_ICE_SHOT_ATTEMPTS_FOR",
    "ON_ICE_SHOT_ATTEMPTS_AGAINST",
  );
  values.ON_ICE_FF_PERCENTAGE = share(
    "ON_ICE_UNBLOCKED_ATTEMPTS_FOR",
    "ON_ICE_UNBLOCKED_ATTEMPTS_AGAINST",
  );
  values.ON_ICE_XGF_PERCENTAGE = share(
    "ON_ICE_EXPECTED_GOALS_FOR",
    "ON_ICE_EXPECTED_GOALS_AGAINST",
  );
  return values;
}

export function reconcileProjectionQuantiles(
  rawQuantiles: { p10: ProjectionValues; p50: ProjectionValues; p90: ProjectionValues },
  population: FantasyProjectionPopulation,
): { p10: ProjectionValues; p50: ProjectionValues; p90: ProjectionValues } {
  const p10 = reconcileProjectionValues(rawQuantiles.p10, population);
  const p50 = reconcileProjectionValues(rawQuantiles.p50, population);
  const p90 = reconcileProjectionValues(rawQuantiles.p90, population);
  const ratio = (numerator: number, denominator: number, fallback: number) =>
    denominator > 0 ? numerator / denominator : fallback;
  const setInterval = (
    target: string,
    lower: number,
    median: number,
    upper: number,
    minimum = Number.NEGATIVE_INFINITY,
    maximum = Number.POSITIVE_INFINITY,
  ) => {
    const center = Math.min(maximum, Math.max(minimum, median));
    p10[target] = projectionNumber(
      Math.min(center, Math.min(maximum, Math.max(minimum, lower))),
    );
    p50[target] = projectionNumber(center);
    p90[target] = projectionNumber(
      Math.max(center, Math.min(maximum, Math.max(minimum, upper))),
    );
  };
  const ratioInterval = (
    target: string,
    numerator: string,
    denominator: string,
    maximum = Number.POSITIVE_INFINITY,
  ) => {
    const median = ratio(p50[numerator] ?? 0, p50[denominator] ?? 0, 0);
    setInterval(
      target,
      ratio(p10[numerator] ?? 0, p90[denominator] ?? 0, median),
      median,
      ratio(p90[numerator] ?? 0, p10[denominator] ?? 0, median),
      0,
      maximum,
    );
  };
  const shareInterval = (target: string, forTarget: string, againstTarget: string) => {
    const medianFor = p50[forTarget] ?? 0;
    const medianAgainst = p50[againstTarget] ?? 0;
    const median = ratio(medianFor, medianFor + medianAgainst, 0);
    const lowerFor = p10[forTarget] ?? 0;
    const upperFor = p90[forTarget] ?? 0;
    const lowerAgainst = p10[againstTarget] ?? 0;
    const upperAgainst = p90[againstTarget] ?? 0;
    setInterval(
      target,
      ratio(lowerFor, lowerFor + upperAgainst, median),
      median,
      ratio(upperFor, upperFor + lowerAgainst, median),
      0,
      1,
    );
  };

  if (population === "goalie") {
    const lowerSaves = Math.max(
      0,
      (p10.SHOTS_AGAINST_GOALIE ?? 0) - (p90.GOALS_AGAINST_GOALIE ?? 0),
    );
    const medianSaves = Math.max(
      0,
      (p50.SHOTS_AGAINST_GOALIE ?? 0) - (p50.GOALS_AGAINST_GOALIE ?? 0),
    );
    const upperSaves = Math.max(
      medianSaves,
      (p90.SHOTS_AGAINST_GOALIE ?? 0) - (p10.GOALS_AGAINST_GOALIE ?? 0),
    );
    setInterval("SAVES_GOALIE", lowerSaves, medianSaves, upperSaves, 0);
    setInterval(
      "SAVE_PERCENTAGE",
      ratio(lowerSaves, p90.SHOTS_AGAINST_GOALIE ?? 0, 0),
      ratio(medianSaves, p50.SHOTS_AGAINST_GOALIE ?? 0, 0),
      ratio(upperSaves, p10.SHOTS_AGAINST_GOALIE ?? 0, 1),
      0,
      1,
    );
    setInterval(
      "GOALS_AGAINST_AVERAGE",
      ratio(3600 * (p10.GOALS_AGAINST_GOALIE ?? 0), p90.TOTAL_TOI ?? 0, 0),
      ratio(3600 * (p50.GOALS_AGAINST_GOALIE ?? 0), p50.TOTAL_TOI ?? 0, 0),
      ratio(
        3600 * (p90.GOALS_AGAINST_GOALIE ?? 0),
        p10.TOTAL_TOI ?? 0,
        p50.GOALS_AGAINST_AVERAGE ?? 0,
      ),
      0,
    );
    setInterval(
      "RELIEF_APPEARANCES_GOALIE",
      Math.max(0, (p10.GAMES_PLAYED ?? 0) - (p90.GAMES_STARTED ?? 0)),
      Math.max(0, (p50.GAMES_PLAYED ?? 0) - (p50.GAMES_STARTED ?? 0)),
      Math.max(0, (p90.GAMES_PLAYED ?? 0) - (p10.GAMES_STARTED ?? 0)),
      0,
    );
    ratioInterval("START_PERCENTAGE_GOALIE", "GAMES_STARTED", "GAMES_PLAYED", 1);
    ratioInterval("WIN_PERCENTAGE_GOALIE", "WINS_GOALIE", "GAMES_STARTED", 1);
    setInterval(
      "GOALS_SAVED_ABOVE_EXPECTED",
      (p10.EXPECTED_GOALS_AGAINST_GOALIE ?? 0) - (p90.GOALS_AGAINST_GOALIE ?? 0),
      (p50.EXPECTED_GOALS_AGAINST_GOALIE ?? 0) - (p50.GOALS_AGAINST_GOALIE ?? 0),
      (p90.EXPECTED_GOALS_AGAINST_GOALIE ?? 0) - (p10.GOALS_AGAINST_GOALIE ?? 0),
    );
    for (const danger of ["HIGH_DANGER", "MID_RANGE", "LONG_RANGE"] as const) {
      const shotsTarget = `${danger}_SHOTS_AGAINST_GOALIE`;
      const goalsTarget = `${danger}_GOALS_AGAINST_GOALIE`;
      const savesTarget = `${danger}_SAVES_GOALIE`;
      const lower = Math.max(0, (p10[shotsTarget] ?? 0) - (p90[goalsTarget] ?? 0));
      const median = Math.max(0, (p50[shotsTarget] ?? 0) - (p50[goalsTarget] ?? 0));
      const upper = Math.max(median, (p90[shotsTarget] ?? 0) - (p10[goalsTarget] ?? 0));
      setInterval(savesTarget, lower, median, upper, 0);
      setInterval(
        `${danger}_SAVE_PERCENTAGE_GOALIE`,
        ratio(lower, p90[shotsTarget] ?? 0, 0),
        ratio(median, p50[shotsTarget] ?? 0, 0),
        ratio(upper, p10[shotsTarget] ?? 0, 1),
        0,
        1,
      );
    }
  } else {
    setInterval(
      "SHOOTING_PERCENTAGE",
      ratio(p10.GOALS ?? 0, p90.SHOTS_ON_GOAL ?? 0, 0),
      ratio(p50.GOALS ?? 0, p50.SHOTS_ON_GOAL ?? 0, 0),
      ratio(p90.GOALS ?? 0, p10.SHOTS_ON_GOAL ?? 0, 1),
      0,
      1,
    );
    const lowerFaceoffs = (p10.FACEOFFS_WON ?? 0) + (p90.FACEOFFS_LOST ?? 0);
    const medianFaceoffs = (p50.FACEOFFS_WON ?? 0) + (p50.FACEOFFS_LOST ?? 0);
    const upperFaceoffs = (p90.FACEOFFS_WON ?? 0) + (p10.FACEOFFS_LOST ?? 0);
    setInterval(
      "FACEOFF_PERCENTAGE",
      ratio(p10.FACEOFFS_WON ?? 0, lowerFaceoffs, 0),
      ratio(p50.FACEOFFS_WON ?? 0, medianFaceoffs, 0),
      ratio(p90.FACEOFFS_WON ?? 0, upperFaceoffs, 1),
      0,
      1,
    );
    ratioInterval("POINTS_PER_GAME", "POINTS", "GAMES_PLAYED");
    ratioInterval("TOI_PER_GAME", "TOTAL_TOI", "GAMES_PLAYED");
    shareInterval(
      "ON_ICE_CF_PERCENTAGE",
      "ON_ICE_SHOT_ATTEMPTS_FOR",
      "ON_ICE_SHOT_ATTEMPTS_AGAINST",
    );
    shareInterval(
      "ON_ICE_FF_PERCENTAGE",
      "ON_ICE_UNBLOCKED_ATTEMPTS_FOR",
      "ON_ICE_UNBLOCKED_ATTEMPTS_AGAINST",
    );
    shareInterval(
      "ON_ICE_XGF_PERCENTAGE",
      "ON_ICE_EXPECTED_GOALS_FOR",
      "ON_ICE_EXPECTED_GOALS_AGAINST",
    );
  }

  const targets = new Set([...Object.keys(p10), ...Object.keys(p50), ...Object.keys(p90)]);
  for (const target of targets) {
    const median = Number(p50[target] ?? 0);
    p10[target] = projectionNumber(Math.min(Number(p10[target] ?? median), median));
    p90[target] = projectionNumber(Math.max(Number(p90[target] ?? median), median));
  }
  return { p10, p50, p90 };
}

export function fantasyProjectionTotal(
  values: ProjectionValues,
  scoring: Record<string, number>,
): number {
  return Object.entries(scoring).reduce((total, [key, weight]) => {
    const value = Number(values[key] ?? 0);
    return total + (Number.isFinite(value) && Number.isFinite(weight) ? value * weight : 0);
  }, 0);
}
