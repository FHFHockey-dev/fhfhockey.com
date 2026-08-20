import {
  FANTASY_PROJECTION_SUPPORTED_CONTRACTS,
  FANTASY_PROJECTION_V4_CONTRACT_VERSION,
  FANTASY_PROJECTION_V5_CONTRACT_VERSION,
  GOALIE_ADVANCED_V5_PRIMITIVE_TARGETS,
  GOALIE_FANTASY_V4_PRIMITIVE_TARGETS,
  GOALIE_PRIMITIVE_TARGETS,
  reconcileProjectionValues,
  SKATER_ADVANCED_V5_PRIMITIVE_TARGETS,
  SKATER_FANTASY_V4_PRIMITIVE_TARGETS,
  SKATER_PRIMITIVE_TARGETS,
  type FantasyProjectionPopulation,
  type ProjectionValues,
} from "./contracts";

export type SeasonValidationIssue = {
  code: string;
  message: string;
  fhfhPlayerId?: number;
  teamId?: number;
};

export type SeasonDraftPlayer = {
  fhfhPlayerId: number;
  teamId: number | null;
  population: FantasyProjectionPopulation;
  expectedGames: number;
  expectedStarts: number | null;
  modelValues: ProjectionValues;
  publishedValues: ProjectionValues;
  p10: ProjectionValues;
  p50: ProjectionValues;
  p90: ProjectionValues;
  deployment: Record<string, unknown>;
};

function nearlyEqual(left: number, right: number): boolean {
  return Math.abs(left - right) <= 1e-6 * Math.max(1, Math.abs(left), Math.abs(right));
}

export function validateSeasonDraft(args: {
  contractVersion: string;
  contractChecksum: string;
  scheduleGameCount: number;
  gamesPerTeam: Record<string, number>;
  rosterCounts: Record<string, { forwards: number; defensemen: number; goalies: number }>;
  waivedTeamIds?: number[];
  players: SeasonDraftPlayer[];
}): SeasonValidationIssue[] {
  const issues: SeasonValidationIssue[] = [];
  if (
    FANTASY_PROJECTION_SUPPORTED_CONTRACTS[args.contractVersion] !==
    args.contractChecksum
  ) {
    issues.push({
      code: "contract_mismatch",
      message: "Runtime and an approved season research contract do not match.",
    });
  }
  if (args.scheduleGameCount !== 1344) {
    issues.push({
      code: "schedule_game_count",
      message: `Expected 1,344 games; found ${args.scheduleGameCount}.`,
    });
  }
  const teamEntries = Object.entries(args.gamesPerTeam);
  if (teamEntries.length !== 32 || teamEntries.some(([, count]) => count !== 84)) {
    issues.push({
      code: "schedule_team_count",
      message: "Exactly 32 teams with 84 games each are required.",
    });
  }

  const waived = new Set(args.waivedTeamIds ?? []);
  for (const rawTeamId of Object.keys(args.gamesPerTeam)) {
    const teamId = Number(rawTeamId);
    const counts = args.rosterCounts[rawTeamId] ?? {
      forwards: 0,
      defensemen: 0,
      goalies: 0,
    };
    if (
      !waived.has(teamId) &&
      (counts.forwards < 12 || counts.defensemen < 6 || counts.goalies < 2)
    ) {
      issues.push({
        code: "roster_incomplete",
        teamId,
        message: `Team ${teamId} has ${counts.forwards} F, ${counts.defensemen} D, and ${counts.goalies} G.`,
      });
    }
  }

  for (const player of args.players) {
    if (
      !Number.isFinite(player.expectedGames) ||
      player.expectedGames < 0 ||
      player.expectedGames > 84
    ) {
      issues.push({
        code: "expected_games_invalid",
        fhfhPlayerId: player.fhfhPlayerId,
        message: "Expected games must be within [0,84].",
      });
    }
    if (
      player.population === "goalie" &&
      (player.expectedStarts == null ||
        player.expectedStarts < 0 ||
        player.expectedStarts > player.expectedGames)
    ) {
      issues.push({
        code: "expected_starts_invalid",
        fhfhPlayerId: player.fhfhPlayerId,
        message: "Goalie starts must be within [0, expected games].",
      });
    }
    const fantasyBatch = [
      FANTASY_PROJECTION_V4_CONTRACT_VERSION,
      FANTASY_PROJECTION_V5_CONTRACT_VERSION,
    ].includes(args.contractVersion);
    const advancedBatch =
      args.contractVersion === FANTASY_PROJECTION_V5_CONTRACT_VERSION;
    const required = player.population === "goalie"
      ? [
          ...GOALIE_PRIMITIVE_TARGETS,
          ...(fantasyBatch ? GOALIE_FANTASY_V4_PRIMITIVE_TARGETS : []),
          ...(advancedBatch ? GOALIE_ADVANCED_V5_PRIMITIVE_TARGETS : []),
        ]
      : [
          ...SKATER_PRIMITIVE_TARGETS,
          ...(fantasyBatch ? SKATER_FANTASY_V4_PRIMITIVE_TARGETS : []),
          ...(advancedBatch ? SKATER_ADVANCED_V5_PRIMITIVE_TARGETS : []),
        ];
    for (const target of required) {
      if (!Number.isFinite(player.publishedValues[target])) {
        issues.push({
          code: "target_missing",
          fhfhPlayerId: player.fhfhPlayerId,
          message: `Missing finite ${target}.`,
        });
      }
    }
    const reconciled = reconcileProjectionValues(
      player.publishedValues,
      player.population,
    );
    for (const [target, expected] of Object.entries(reconciled)) {
      if (!nearlyEqual(player.publishedValues[target] ?? expected, expected)) {
        issues.push({
          code: "derived_identity_invalid",
          fhfhPlayerId: player.fhfhPlayerId,
          message: `${target} does not reconcile with its primitive targets.`,
        });
      }
      const low = player.p10[target];
      const median = player.p50[target];
      const high = player.p90[target];
      if (
        !Number.isFinite(low) ||
        !Number.isFinite(median) ||
        !Number.isFinite(high) ||
        low > median ||
        median > high
      ) {
        issues.push({
          code: "quantile_order_invalid",
          fhfhPlayerId: player.fhfhPlayerId,
          message: `${target} must satisfy p10 <= p50 <= p90.`,
        });
      }
    }
    const roleProbabilities = player.deployment.roleProbabilities;
    if (roleProbabilities && typeof roleProbabilities === "object") {
      for (const [family, rawDistribution] of Object.entries(
        roleProbabilities as Record<string, unknown>,
      )) {
        if (
          !rawDistribution ||
          typeof rawDistribution !== "object" ||
          Array.isArray(rawDistribution)
        ) {
          issues.push({
            code: "role_probability_invalid",
            fhfhPlayerId: player.fhfhPlayerId,
            message: `${family} must be a role-probability distribution.`,
          });
          continue;
        }
        const probabilities = Object.values(
          rawDistribution as Record<string, unknown>,
        ).map(Number);
        if (
          probabilities.length === 0 ||
          probabilities.some(
            (probability) =>
              !Number.isFinite(probability) || probability < 0 || probability > 1,
          )
        ) {
          issues.push({
            code: "role_probability_invalid",
            fhfhPlayerId: player.fhfhPlayerId,
            message: `${family} probabilities must each be within [0,1].`,
          });
          continue;
        }
        const total = probabilities.reduce((sum, probability) => sum + probability, 0);
        if (!nearlyEqual(total, 1)) {
          issues.push({
            code: "role_probability_sum_invalid",
            fhfhPlayerId: player.fhfhPlayerId,
            message: `${family} probabilities must sum to 1.`,
          });
        }
      }
    }
  }
  return issues;
}
