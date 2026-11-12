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

/** Goalie decision/outcome heads (decision 121: no game-context multiplier). */
export const GOALIE_OUTCOME_TARGETS = [
  "WINS_GOALIE",
  "LOSSES_GOALIE",
  "OTL_GOALIE",
  "SHUTOUTS_GOALIE",
  "QUALITY_STARTS_GOALIE",
] as const;

export type ProjectionReconciliationClamp = {
  target: string;
  rule:
    | "ev_derived_from_total"
    | "non_ev_scaled_to_total"
    | "goals_against_capped_at_shots_against"
    | "decisions_scaled_to_appearances"
    | "shutouts_capped_at_starts"
    | "quality_starts_capped_at_starts";
  before: number;
  after: number;
};

const CLAMP_TOLERANCE = 1e-9;

/**
 * Reconciles derived heads from primitive heads.
 *
 * Unknowns stay unknown (rule 5): a non-finite input is dropped, a derived sum
 * is emitted only when every component is present, and a ratio with an
 * unknown or zero denominator is omitted rather than reported as 0.
 *
 * `enforceCoherence` (means and single realisations only, never quantile
 * endpoints) caps GA at SA, scales W+L+OTL to appearances, and caps SO and QS
 * at credited starts (decisions 40, 63). Every binding clamp, and every EV head
 * replaced by the total-minus-components rule, is reported in `clamps`.
 */
export function reconcileProjectionValuesWithClamps(
  rawValues: Readonly<Record<string, number | null | undefined>>,
  population: FantasyProjectionPopulation,
  options: { enforceCoherence?: boolean } = {},
): { values: ProjectionValues; clamps: ProjectionReconciliationClamp[] } {
  const enforceCoherence = options.enforceCoherence ?? true;
  const clamps: ProjectionReconciliationClamp[] = [];
  const values: ProjectionValues = {};
  for (const [key, value] of Object.entries(rawValues)) {
    if (typeof value === "number" && Number.isFinite(value)) values[key] = Number(value);
  }
  const has = (...keys: string[]) => keys.every((key) => key in values);
  const setSum = (target: string, keys: string[]) => {
    if (has(...keys)) {
      values[target] = projectionNumber(keys.reduce((total, key) => total + values[key], 0));
    } else {
      delete values[target];
    }
  };
  const setRatio = (target: string, numerator: number | undefined, denominator: number | undefined) => {
    if (numerator != null && denominator != null && denominator > 0) {
      values[target] = projectionNumber(numerator / denominator);
    } else {
      delete values[target];
    }
  };
  const cap = (target: string, limit: number, rule: ProjectionReconciliationClamp["rule"]) => {
    if (values[target] > limit + CLAMP_TOLERANCE) {
      clamps.push({ target, rule, before: projectionNumber(values[target]), after: projectionNumber(limit) });
      values[target] = projectionNumber(limit);
    }
  };

  if (population === "goalie") {
    if (enforceCoherence) {
      if (has("SHOTS_AGAINST_GOALIE", "GOALS_AGAINST_GOALIE")) {
        cap("GOALS_AGAINST_GOALIE", Math.max(0, values.SHOTS_AGAINST_GOALIE), "goals_against_capped_at_shots_against");
      }
      const decisions = ["WINS_GOALIE", "LOSSES_GOALIE", "OTL_GOALIE"].filter((key) => key in values);
      if (has("GAMES_PLAYED") && decisions.length) {
        const total = decisions.reduce((sum, key) => sum + Math.max(0, values[key]), 0);
        const appearances = Math.max(0, values.GAMES_PLAYED);
        if (total > appearances + CLAMP_TOLERANCE) {
          const scale = total > 0 ? appearances / total : 0;
          for (const key of decisions) {
            const after = projectionNumber(Math.max(0, values[key]) * scale);
            clamps.push({ target: key, rule: "decisions_scaled_to_appearances", before: projectionNumber(values[key]), after });
            values[key] = after;
          }
        }
      }
      const startLimit = has("GAMES_STARTED") ? values.GAMES_STARTED : has("GAMES_PLAYED") ? values.GAMES_PLAYED : null;
      if (startLimit != null && has("SHUTOUTS_GOALIE")) {
        cap("SHUTOUTS_GOALIE", Math.max(0, startLimit), "shutouts_capped_at_starts");
      }
      if (has("GAMES_STARTED", "QUALITY_STARTS_GOALIE")) {
        cap("QUALITY_STARTS_GOALIE", Math.max(0, values.GAMES_STARTED), "quality_starts_capped_at_starts");
      }
    }
    if (has("SHOTS_AGAINST_GOALIE", "GOALS_AGAINST_GOALIE")) {
      values.SAVES_GOALIE = projectionNumber(
        Math.max(0, values.SHOTS_AGAINST_GOALIE - values.GOALS_AGAINST_GOALIE),
      );
    } else {
      delete values.SAVES_GOALIE;
    }
    setRatio("SAVE_PERCENTAGE", values.SAVES_GOALIE, values.SHOTS_AGAINST_GOALIE);
    setRatio(
      "GOALS_AGAINST_AVERAGE",
      has("GOALS_AGAINST_GOALIE") ? 3600 * values.GOALS_AGAINST_GOALIE : undefined,
      values.TOTAL_TOI,
    );
    if (has("GAMES_PLAYED", "GAMES_STARTED")) {
      values.RELIEF_APPEARANCES_GOALIE = projectionNumber(
        Math.max(0, values.GAMES_PLAYED - values.GAMES_STARTED),
      );
    } else {
      delete values.RELIEF_APPEARANCES_GOALIE;
    }
    setRatio("START_PERCENTAGE_GOALIE", values.GAMES_STARTED, values.GAMES_PLAYED);
    setRatio("WIN_PERCENTAGE_GOALIE", values.WINS_GOALIE, values.GAMES_STARTED);
    if ("EXPECTED_GOALS_AGAINST_GOALIE" in values) {
      if (has("GOALS_AGAINST_GOALIE")) {
        values.GOALS_SAVED_ABOVE_EXPECTED = projectionNumber(
          values.EXPECTED_GOALS_AGAINST_GOALIE - values.GOALS_AGAINST_GOALIE,
        );
      } else {
        delete values.GOALS_SAVED_ABOVE_EXPECTED;
      }
    }
    for (const danger of ["HIGH_DANGER", "MID_RANGE", "LONG_RANGE"] as const) {
      const shotsTarget = `${danger}_SHOTS_AGAINST_GOALIE`;
      const goalsTarget = `${danger}_GOALS_AGAINST_GOALIE`;
      if (!has(shotsTarget, goalsTarget)) {
        delete values[`${danger}_SAVES_GOALIE`];
        delete values[`${danger}_SAVE_PERCENTAGE_GOALIE`];
        continue;
      }
      const shots = values[shotsTarget];
      const goals = Math.min(shots, values[goalsTarget]);
      const saves = Math.max(0, shots - goals);
      values[goalsTarget] = projectionNumber(goals);
      values[`${danger}_SAVES_GOALIE`] = projectionNumber(saves);
      setRatio(`${danger}_SAVE_PERCENTAGE_GOALIE`, saves, shots);
    }
    return { values, clamps };
  }

  const strengthComponents = [
    "EV_GOALS", "PP_GOALS", "SH_GOALS", "EMPTY_NET_GOALS",
    "EV_PRIMARY_ASSISTS", "PP_PRIMARY_ASSISTS", "SH_PRIMARY_ASSISTS",
    "EN_PRIMARY_ASSISTS", "EV_SECONDARY_ASSISTS", "PP_SECONDARY_ASSISTS",
    "SH_SECONDARY_ASSISTS", "EN_SECONDARY_ASSISTS",
  ];
  if (strengthComponents.every((target) => target in values)) {
    // Contract: the fitted total is authoritative and EV is derived as total
    // minus the non-EV components (W3-5 F5). A fitted EV head is used as-is
    // when it already agrees; when it does not, the replacement is reported.
    const reconcileStrengthFamily = (
      totalTarget: string,
      evTarget: string,
      nonEvTargets: [string, string, string],
    ): void => {
      const componentTotal = [evTarget, ...nonEvTargets].reduce(
        (total, target) => total + Math.max(0, values[target]),
        0,
      );
      const authoritativeTotal = Math.max(0, values[totalTarget] ?? componentTotal);
      const nonEvTotal = nonEvTargets.reduce(
        (total, target) => total + Math.max(0, values[target]),
        0,
      );
      const fittedEv = values[evTarget];
      if (nonEvTotal > authoritativeTotal && nonEvTotal > 0) {
        const scale = authoritativeTotal / nonEvTotal;
        for (const target of nonEvTargets) {
          const after = projectionNumber(Math.max(0, values[target]) * scale);
          if (Math.abs(after - values[target]) > CLAMP_TOLERANCE) {
            clamps.push({ target, rule: "non_ev_scaled_to_total", before: projectionNumber(values[target]), after });
          }
          values[target] = after;
        }
        values[evTarget] = 0;
      } else {
        values[evTarget] = projectionNumber(authoritativeTotal - nonEvTotal);
      }
      if (Math.abs(values[evTarget] - fittedEv) > CLAMP_TOLERANCE) {
        clamps.push({
          target: evTarget,
          rule: "ev_derived_from_total",
          before: projectionNumber(fittedEv),
          after: values[evTarget],
        });
      }
      values[totalTarget] = projectionNumber(authoritativeTotal);
    };
    reconcileStrengthFamily("GOALS", "EV_GOALS", ["PP_GOALS", "SH_GOALS", "EMPTY_NET_GOALS"]);
    reconcileStrengthFamily(
      "PRIMARY_ASSISTS",
      "EV_PRIMARY_ASSISTS",
      ["PP_PRIMARY_ASSISTS", "SH_PRIMARY_ASSISTS", "EN_PRIMARY_ASSISTS"],
    );
    reconcileStrengthFamily(
      "SECONDARY_ASSISTS",
      "EV_SECONDARY_ASSISTS",
      ["PP_SECONDARY_ASSISTS", "SH_SECONDARY_ASSISTS", "EN_SECONDARY_ASSISTS"],
    );
    setSum("PP_ASSISTS", ["PP_PRIMARY_ASSISTS", "PP_SECONDARY_ASSISTS"]);
    setSum("SH_ASSISTS", ["SH_PRIMARY_ASSISTS", "SH_SECONDARY_ASSISTS"]);
    setSum("EMPTY_NET_POINTS", ["EMPTY_NET_GOALS", "EN_PRIMARY_ASSISTS", "EN_SECONDARY_ASSISTS"]);
  }
  setSum("ASSISTS", ["PRIMARY_ASSISTS", "SECONDARY_ASSISTS"]);
  setSum("POINTS", ["GOALS", "ASSISTS"]);
  setSum("PP_POINTS", ["PP_GOALS", "PP_ASSISTS"]);
  setSum("SH_POINTS", ["SH_GOALS", "SH_ASSISTS"]);
  setSum("EV_ASSISTS", ["EV_PRIMARY_ASSISTS", "EV_SECONDARY_ASSISTS"]);
  setSum("EV_POINTS", ["EV_GOALS", "EV_ASSISTS"]);
  setRatio("SHOOTING_PERCENTAGE", values.GOALS, values.SHOTS_ON_GOAL);
  setRatio(
    "FACEOFF_PERCENTAGE",
    values.FACEOFFS_WON,
    has("FACEOFFS_WON", "FACEOFFS_LOST") ? values.FACEOFFS_WON + values.FACEOFFS_LOST : undefined,
  );
  setRatio("POINTS_PER_GAME", values.POINTS, values.GAMES_PLAYED);
  setRatio("TOI_PER_GAME", values.TOTAL_TOI, values.GAMES_PLAYED);
  if ("EXPECTED_PRIMARY_ASSISTS" in values || "EXPECTED_SECONDARY_ASSISTS" in values) {
    setSum("EXPECTED_ASSISTS", ["EXPECTED_PRIMARY_ASSISTS", "EXPECTED_SECONDARY_ASSISTS"]);
  }
  for (const [label, forKey, againstKey] of [
    ["ON_ICE_CF_PERCENTAGE", "ON_ICE_SHOT_ATTEMPTS_FOR", "ON_ICE_SHOT_ATTEMPTS_AGAINST"],
    ["ON_ICE_FF_PERCENTAGE", "ON_ICE_UNBLOCKED_ATTEMPTS_FOR", "ON_ICE_UNBLOCKED_ATTEMPTS_AGAINST"],
    ["ON_ICE_XGF_PERCENTAGE", "ON_ICE_EXPECTED_GOALS_FOR", "ON_ICE_EXPECTED_GOALS_AGAINST"],
  ] as const) {
    if (!(forKey in values) && !(againstKey in values)) continue;
    setRatio(
      label,
      values[forKey],
      has(forKey, againstKey) ? values[forKey] + values[againstKey] : undefined,
    );
  }
  return { values, clamps };
}

export function reconcileProjectionValues(
  rawValues: Readonly<Record<string, number | null | undefined>>,
  population: FantasyProjectionPopulation,
): ProjectionValues {
  return reconcileProjectionValuesWithClamps(rawValues, population).values;
}

/**
 * Rebuilds derived quantile endpoints from primitive endpoints. These are
 * marginal bounds, not joint quantiles (rule 26): callers that have a joint
 * distribution (aggregateSeasonGames draws) must not pass it through here.
 * A derived interval whose inputs are unknown in any endpoint is omitted.
 */
export function reconcileProjectionQuantiles(
  rawQuantiles: { p10: ProjectionValues; p50: ProjectionValues; p90: ProjectionValues },
  population: FantasyProjectionPopulation,
): { p10: ProjectionValues; p50: ProjectionValues; p90: ProjectionValues } {
  const endpoint = (values: ProjectionValues) =>
    reconcileProjectionValuesWithClamps(values, population, { enforceCoherence: false }).values;
  const p10 = endpoint(rawQuantiles.p10);
  const p50 = endpoint(rawQuantiles.p50);
  const p90 = endpoint(rawQuantiles.p90);
  const known = (...targets: string[]) =>
    targets.every((target) => target in p10 && target in p50 && target in p90);
  const drop = (target: string) => {
    delete p10[target];
    delete p50[target];
    delete p90[target];
  };
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
    if (!known(numerator, denominator) || !(p50[denominator] > 0)) return drop(target);
    const median = p50[numerator] / p50[denominator];
    setInterval(
      target,
      ratio(p10[numerator], p90[denominator], median),
      median,
      ratio(p90[numerator], p10[denominator], median),
      0,
      maximum,
    );
  };
  const shareInterval = (target: string, forTarget: string, againstTarget: string) => {
    if (!known(forTarget, againstTarget) || !(p50[forTarget] + p50[againstTarget] > 0)) {
      return drop(target);
    }
    const median = p50[forTarget] / (p50[forTarget] + p50[againstTarget]);
    setInterval(
      target,
      ratio(p10[forTarget], p10[forTarget] + p90[againstTarget], median),
      median,
      ratio(p90[forTarget], p90[forTarget] + p10[againstTarget], median),
      0,
      1,
    );
  };
  const savesInterval = (target: string, shotsTarget: string, goalsTarget: string) => {
    if (!known(shotsTarget, goalsTarget)) {
      drop(target);
      return null;
    }
    const lower = Math.max(0, p10[shotsTarget] - p90[goalsTarget]);
    const median = Math.max(0, p50[shotsTarget] - p50[goalsTarget]);
    const upper = Math.max(median, p90[shotsTarget] - p10[goalsTarget]);
    setInterval(target, lower, median, upper, 0);
    return { lower, median, upper };
  };

  if (population === "goalie") {
    const saves = savesInterval("SAVES_GOALIE", "SHOTS_AGAINST_GOALIE", "GOALS_AGAINST_GOALIE");
    if (saves && p50.SHOTS_AGAINST_GOALIE > 0) {
      setInterval(
        "SAVE_PERCENTAGE",
        ratio(saves.lower, p90.SHOTS_AGAINST_GOALIE, 0),
        saves.median / p50.SHOTS_AGAINST_GOALIE,
        ratio(saves.upper, p10.SHOTS_AGAINST_GOALIE, 1),
        0,
        1,
      );
    } else {
      drop("SAVE_PERCENTAGE");
    }
    if (known("GOALS_AGAINST_GOALIE", "TOTAL_TOI") && p50.TOTAL_TOI > 0) {
      const median = (3600 * p50.GOALS_AGAINST_GOALIE) / p50.TOTAL_TOI;
      setInterval(
        "GOALS_AGAINST_AVERAGE",
        ratio(3600 * p10.GOALS_AGAINST_GOALIE, p90.TOTAL_TOI, 0),
        median,
        ratio(3600 * p90.GOALS_AGAINST_GOALIE, p10.TOTAL_TOI, median),
        0,
      );
    } else {
      drop("GOALS_AGAINST_AVERAGE");
    }
    if (known("GAMES_PLAYED", "GAMES_STARTED")) {
      setInterval(
        "RELIEF_APPEARANCES_GOALIE",
        Math.max(0, p10.GAMES_PLAYED - p90.GAMES_STARTED),
        Math.max(0, p50.GAMES_PLAYED - p50.GAMES_STARTED),
        Math.max(0, p90.GAMES_PLAYED - p10.GAMES_STARTED),
        0,
      );
    } else {
      drop("RELIEF_APPEARANCES_GOALIE");
    }
    ratioInterval("START_PERCENTAGE_GOALIE", "GAMES_STARTED", "GAMES_PLAYED", 1);
    ratioInterval("WIN_PERCENTAGE_GOALIE", "WINS_GOALIE", "GAMES_STARTED", 1);
    if ("EXPECTED_GOALS_AGAINST_GOALIE" in rawQuantiles.p50) {
      if (known("EXPECTED_GOALS_AGAINST_GOALIE", "GOALS_AGAINST_GOALIE")) {
        setInterval(
          "GOALS_SAVED_ABOVE_EXPECTED",
          p10.EXPECTED_GOALS_AGAINST_GOALIE - p90.GOALS_AGAINST_GOALIE,
          p50.EXPECTED_GOALS_AGAINST_GOALIE - p50.GOALS_AGAINST_GOALIE,
          p90.EXPECTED_GOALS_AGAINST_GOALIE - p10.GOALS_AGAINST_GOALIE,
        );
      } else {
        drop("GOALS_SAVED_ABOVE_EXPECTED");
      }
    }
    for (const danger of ["HIGH_DANGER", "MID_RANGE", "LONG_RANGE"] as const) {
      const shotsTarget = `${danger}_SHOTS_AGAINST_GOALIE`;
      if (!(shotsTarget in rawQuantiles.p50)) continue;
      const percentageTarget = `${danger}_SAVE_PERCENTAGE_GOALIE`;
      const dangerSaves = savesInterval(
        `${danger}_SAVES_GOALIE`,
        shotsTarget,
        `${danger}_GOALS_AGAINST_GOALIE`,
      );
      if (dangerSaves && p50[shotsTarget] > 0) {
        setInterval(
          percentageTarget,
          ratio(dangerSaves.lower, p90[shotsTarget], 0),
          dangerSaves.median / p50[shotsTarget],
          ratio(dangerSaves.upper, p10[shotsTarget], 1),
          0,
          1,
        );
      } else {
        drop(percentageTarget);
      }
    }
  } else {
    if (known("GOALS", "SHOTS_ON_GOAL") && p50.SHOTS_ON_GOAL > 0) {
      setInterval(
        "SHOOTING_PERCENTAGE",
        ratio(p10.GOALS, p90.SHOTS_ON_GOAL, 0),
        p50.GOALS / p50.SHOTS_ON_GOAL,
        ratio(p90.GOALS, p10.SHOTS_ON_GOAL, 1),
        0,
        1,
      );
    } else {
      drop("SHOOTING_PERCENTAGE");
    }
    if (known("FACEOFFS_WON", "FACEOFFS_LOST") && p50.FACEOFFS_WON + p50.FACEOFFS_LOST > 0) {
      setInterval(
        "FACEOFF_PERCENTAGE",
        ratio(p10.FACEOFFS_WON, p10.FACEOFFS_WON + p90.FACEOFFS_LOST, 0),
        p50.FACEOFFS_WON / (p50.FACEOFFS_WON + p50.FACEOFFS_LOST),
        ratio(p90.FACEOFFS_WON, p90.FACEOFFS_WON + p10.FACEOFFS_LOST, 1),
        0,
        1,
      );
    } else {
      drop("FACEOFF_PERCENTAGE");
    }
    ratioInterval("POINTS_PER_GAME", "POINTS", "GAMES_PLAYED");
    // NHL regular-season games cannot exceed 65 minutes, including overtime.
    // Cross-bound ratio intervals can otherwise become physically impossible
    // for low-GP prospects when the lower GP bound approaches one game.
    ratioInterval("TOI_PER_GAME", "TOTAL_TOI", "GAMES_PLAYED", 65 * 60);
    for (const [label, forKey, againstKey] of [
      ["ON_ICE_CF_PERCENTAGE", "ON_ICE_SHOT_ATTEMPTS_FOR", "ON_ICE_SHOT_ATTEMPTS_AGAINST"],
      ["ON_ICE_FF_PERCENTAGE", "ON_ICE_UNBLOCKED_ATTEMPTS_FOR", "ON_ICE_UNBLOCKED_ATTEMPTS_AGAINST"],
      ["ON_ICE_XGF_PERCENTAGE", "ON_ICE_EXPECTED_GOALS_FOR", "ON_ICE_EXPECTED_GOALS_AGAINST"],
    ] as const) {
      if (forKey in rawQuantiles.p50) shareInterval(label, forKey, againstKey);
    }
  }

  const targets = new Set([...Object.keys(p10), ...Object.keys(p50), ...Object.keys(p90)]);
  for (const target of targets) {
    if (!(target in p50)) {
      drop(target);
      continue;
    }
    const median = p50[target];
    p10[target] = projectionNumber(Math.min(p10[target] ?? median, median));
    p90[target] = projectionNumber(Math.max(p90[target] ?? median, median));
  }
  return { p10, p50, p90 };
}

/**
 * @deprecated W3-5 F6/PR3: a missing or null value silently scores as 0.
 * Use `fantasyProjectionTotalNullable`; L10 migrates the readers.
 */
export function fantasyProjectionTotal(
  values: ProjectionValues,
  scoring: Record<string, number>,
): number {
  return Object.entries(scoring).reduce((total, [key, weight]) => {
    const value = Number(values[key] ?? 0);
    return total + (Number.isFinite(value) && Number.isFinite(weight) ? value * weight : 0);
  }, 0);
}

// ---------------------------------------------------------------------------
// Nullable projection contract (W3-5 F6/PR3, rule 5). A value that is absent,
// null or non-finite is unknown, never 0. Readers (L10) move to these exports;
// the legacy number-only shapes above stay for issued v1 payloads.
// ---------------------------------------------------------------------------

export type NullableProjectionValues = Record<string, number | null>;

/** A finite number, or null for null, undefined, "", NaN and ±Infinity. */
export function nullableProjectionNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export type FantasyProjectionTotal = {
  /** Weighted total, or null when any non-zero-weighted value is unknown. */
  value: number | null;
  complete: boolean;
  /** Non-zero-weighted keys whose value is absent, null or non-finite. */
  missingKeys: string[];
  /** Keys whose scoring weight is not a finite number. */
  invalidWeightKeys: string[];
};

/**
 * Fantasy total over nullable values. A key with weight 0 never matters;
 * any other weighted key with an unknown value makes the total unknown
 * (value null, complete false) instead of contributing 0.
 */
export function fantasyProjectionTotalNullable(
  values: Readonly<Record<string, number | null | undefined>>,
  scoring: Readonly<Record<string, number>>,
): FantasyProjectionTotal {
  let total = 0;
  const missingKeys: string[] = [];
  const invalidWeightKeys: string[] = [];
  for (const key of Object.keys(scoring).sort()) {
    const weight = scoring[key];
    if (!Number.isFinite(weight)) {
      invalidWeightKeys.push(key);
      continue;
    }
    if (weight === 0) continue;
    const value = nullableProjectionNumber(values[key]);
    if (value === null) {
      missingKeys.push(key);
      continue;
    }
    total += value * weight;
  }
  const complete = missingKeys.length === 0 && invalidWeightKeys.length === 0;
  return {
    value: complete ? projectionNumber(total) : null,
    complete,
    missingKeys,
    invalidWeightKeys,
  };
}

/** Compact summary whose values keep null (unknown) instead of 0. */
export const FANTASY_PROJECTION_SUMMARY_ENCODING_V2 = "player-summary-v2" as const;

export type FantasyProjectionPlayerSummaryTupleV2 = [
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
  values: Array<number | null>,
];

export type FantasyProjectionCompactPlayersResponseV2 = {
  success: true;
  betaLabel: string;
  release: FantasyProjectionRelease;
  encoding: typeof FANTASY_PROJECTION_SUMMARY_ENCODING_V2;
  metricKeys: string[];
  players: FantasyProjectionPlayerSummaryTupleV2[];
};

export type FantasyProjectionNullablePlayer = Omit<
  FantasyProjectionPlayer,
  | "expectedGames"
  | "expectedStarts"
  | "expectedToi"
  | "modelValues"
  | "publishedValues"
  | "p10"
  | "p50"
  | "p90"
  | "adjustmentDelta"
> & {
  expectedGames: number | null;
  expectedStarts: number | null;
  expectedToi: NullableProjectionValues;
  modelValues: NullableProjectionValues;
  publishedValues: NullableProjectionValues;
  p10: NullableProjectionValues;
  p50: NullableProjectionValues;
  p90: NullableProjectionValues;
  adjustmentDelta: NullableProjectionValues;
};

export type FantasyProjectionNullablePlayersResponse = {
  success: true;
  betaLabel: string;
  release: FantasyProjectionRelease;
  players: FantasyProjectionNullablePlayer[];
};

/**
 * Expands a v1 or v2 compact summary without turning null or absent values
 * into 0. A v1 payload may already carry writer-side zeros (`summaryNumber`);
 * those stay as issued (rule 21) and only JSON null / absent become null.
 */
export function expandFantasyProjectionSummaryNullable(
  payload:
    | FantasyProjectionCompactPlayersResponse
    | FantasyProjectionCompactPlayersResponseV2,
): FantasyProjectionNullablePlayersResponse {
  if (
    payload.encoding !== FANTASY_PROJECTION_SUMMARY_ENCODING &&
    payload.encoding !== FANTASY_PROJECTION_SUMMARY_ENCODING_V2
  ) {
    throw new Error("Unsupported fantasy-projection summary encoding.");
  }
  return {
    success: true,
    betaLabel: payload.betaLabel,
    release: payload.release,
    players: (payload.players as FantasyProjectionPlayerSummaryTupleV2[]).map((row) => {
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
      const publishedValues: NullableProjectionValues = Object.fromEntries(
        payload.metricKeys.map((key, index) => [
          key,
          nullableProjectionNumber(values?.[index]),
        ]),
      );
      const known = (key: string): number | null => publishedValues[key] ?? null;
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
        expectedGames: known("GAMES_PLAYED"),
        expectedStarts: population === "goalie" ? known("GAMES_STARTED") : null,
        expectedToi: {
          total: known("TOTAL_TOI"),
          evenStrength: known("EV_TOI"),
          powerPlay: known("PP_TOI"),
          penaltyKill: known("PK_TOI"),
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
