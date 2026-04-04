import type { NhlShotFeatureRow } from "../supabase/Upserts/nhlShotFeatureBuilder";
import {
  buildShiftStints,
  findShiftStintAtTime,
  type NhlShiftStint,
} from "../supabase/Upserts/nhlShiftStints";
import { buildShooterPositionGroup } from "./rosterPosition";

type PositionCode = "L" | "R" | "C" | "D" | "G";

type TeamDeploymentCounts = {
  forwardCount: number;
  defenseCount: number;
  goalieCount: number;
  unknownSkaterCount: number;
};

export type DeploymentContext = {
  ownerForwardCountOnIce: number | null;
  ownerDefenseCountOnIce: number | null;
  opponentForwardCountOnIce: number | null;
  opponentDefenseCountOnIce: number | null;
  ownerGoalieOnIce: boolean | null;
  opponentGoalieOnIce: boolean | null;
  ownerSkaterDeploymentBucket: string | null;
  opponentSkaterDeploymentBucket: string | null;
  skaterRoleMatchupBucket: string | null;
};

type ShiftRowLike = {
  game_id: number;
};

function emptyDeploymentContext(): DeploymentContext {
  return {
    ownerForwardCountOnIce: null,
    ownerDefenseCountOnIce: null,
    opponentForwardCountOnIce: null,
    opponentDefenseCountOnIce: null,
    ownerGoalieOnIce: null,
    opponentGoalieOnIce: null,
    ownerSkaterDeploymentBucket: null,
    opponentSkaterDeploymentBucket: null,
    skaterRoleMatchupBucket: null,
  };
}

function summarizeTeamDeployment(
  playerIds: number[],
  positionByPlayerId: ReadonlyMap<number, PositionCode>
): TeamDeploymentCounts {
  const counts: TeamDeploymentCounts = {
    forwardCount: 0,
    defenseCount: 0,
    goalieCount: 0,
    unknownSkaterCount: 0,
  };

  for (const playerId of playerIds) {
    const position = positionByPlayerId.get(playerId) ?? null;
    const positionGroup = buildShooterPositionGroup(position);

    if (position === "G") {
      counts.goalieCount += 1;
      continue;
    }

    if (positionGroup === "forward") {
      counts.forwardCount += 1;
      continue;
    }

    if (positionGroup === "defense") {
      counts.defenseCount += 1;
      continue;
    }

    counts.unknownSkaterCount += 1;
  }

  return counts;
}

function buildSkaterDeploymentBucket(counts: TeamDeploymentCounts): string {
  const base = `${counts.forwardCount}F-${counts.defenseCount}D`;
  return counts.unknownSkaterCount > 0
    ? `${base}+${counts.unknownSkaterCount}U`
    : base;
}

export function buildDeploymentContextForShot(
  row: Pick<
    NhlShotFeatureRow,
    "eventOwnerTeamId" | "gameId" | "periodNumber" | "periodSecondsElapsed"
  >,
  stints: NhlShiftStint[],
  positionByPlayerId: ReadonlyMap<number, PositionCode>
): DeploymentContext {
  if (
    row.eventOwnerTeamId == null ||
    row.periodNumber == null ||
    row.periodSecondsElapsed == null
  ) {
    return emptyDeploymentContext();
  }

  const stint = findShiftStintAtTime(stints, row.periodNumber, row.periodSecondsElapsed);
  if (!stint) {
    return emptyDeploymentContext();
  }

  const ownerTeam = stint.teams.find((team) => team.teamId === row.eventOwnerTeamId) ?? null;
  const opponentTeam =
    stint.teams.find((team) => team.teamId !== row.eventOwnerTeamId) ?? null;

  if (!ownerTeam || !opponentTeam) {
    return emptyDeploymentContext();
  }

  const ownerCounts = summarizeTeamDeployment(ownerTeam.playerIds, positionByPlayerId);
  const opponentCounts = summarizeTeamDeployment(opponentTeam.playerIds, positionByPlayerId);
  const ownerBucket = buildSkaterDeploymentBucket(ownerCounts);
  const opponentBucket = buildSkaterDeploymentBucket(opponentCounts);

  return {
    ownerForwardCountOnIce: ownerCounts.forwardCount,
    ownerDefenseCountOnIce: ownerCounts.defenseCount,
    opponentForwardCountOnIce: opponentCounts.forwardCount,
    opponentDefenseCountOnIce: opponentCounts.defenseCount,
    ownerGoalieOnIce: ownerCounts.goalieCount > 0,
    opponentGoalieOnIce: opponentCounts.goalieCount > 0,
    ownerSkaterDeploymentBucket: ownerBucket,
    opponentSkaterDeploymentBucket: opponentBucket,
    skaterRoleMatchupBucket: `${ownerBucket}_vs_${opponentBucket}`,
  };
}

export function buildShiftStintsByGameId<T extends ShiftRowLike>(
  shiftRows: T[]
): Map<number, NhlShiftStint[]> {
  const grouped = new Map<number, T[]>();

  for (const row of shiftRows) {
    const current = grouped.get(row.game_id) ?? [];
    current.push(row);
    grouped.set(row.game_id, current);
  }

  return new Map(
    Array.from(grouped.entries()).map(([gameId, rows]) => [gameId, buildShiftStints(rows as never)])
  );
}
