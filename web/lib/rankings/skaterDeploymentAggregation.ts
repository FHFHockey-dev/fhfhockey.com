import { resolveTrustedLineAssignment } from "lib/supabase/Upserts/rollingPlayerLineContextContract";

export type SkaterDeploymentWindow = "season" | "last5" | "last10" | "last20";

export type SkaterPositionGroup = "forward" | "defense";

export type EvDeploymentBucket =
  | "L1"
  | "L2"
  | "L3"
  | "L4"
  | "P1"
  | "P2"
  | "P3";

export type SpecialTeamsDeploymentBucket =
  | "PP1"
  | "PP2"
  | "PP3"
  | "PK1"
  | "PK2";

export type DeploymentConfidence = "high" | "mixed" | "low";

export type LineCombinationSourceRow = {
  forwards: number[];
  defensemen: number[];
  goalies: number[];
};

export type SkaterDeploymentContextRow = {
  playerId: number;
  teamId: number;
  gameId: number | null;
  gameDate: string;
  positionGroup: SkaterPositionGroup | null;
  lineComboGroup?: string | null;
  lineComboSlot?: number | null;
  lineCombination?: LineCombinationSourceRow | null;
  evToiPerGameSeconds?: number | null;
  evToiRankInPositionGroup?: number | null;
  ppUnit?: number | null;
  ppToiPerGameSeconds?: number | null;
  pkToiPerGameSeconds?: number | null;
};

export type SkaterDeploymentAggregate = {
  playerId: number;
  teamId: number;
  window: SkaterDeploymentWindow;
  teamGamesAvailable: number;
  gamesTracked: number;
  evDeploymentBucket: EvDeploymentBucket | null;
  ppDeploymentBucket: SpecialTeamsDeploymentBucket | null;
  pkDeploymentBucket: SpecialTeamsDeploymentBucket | null;
  deploymentConfidence: DeploymentConfidence;
  roleConsistencyShare: number;
  averageEvToiPerGameSeconds: number | null;
  averagePpToiPerGameSeconds: number | null;
  averagePkToiPerGameSeconds: number | null;
  source: "lineCombinations" | "rolling_player_game_metrics" | "ev_toi_fallback";
};

function finiteNumber(value: unknown): number | null {
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  return value;
}

function average(values: Array<number | null | undefined>): number | null {
  const finiteValues = values.filter(
    (value): value is number => typeof value === "number" && Number.isFinite(value),
  );
  if (finiteValues.length === 0) return null;
  const sum = finiteValues.reduce((total, value) => total + value, 0);
  return Number((sum / finiteValues.length).toFixed(6));
}

function mostCommon<T extends string>(values: T[]): {
  value: T | null;
  count: number;
  share: number;
} {
  if (values.length === 0) {
    return { value: null, count: 0, share: 0 };
  }

  const counts = new Map<T, number>();
  for (const value of values) {
    counts.set(value, (counts.get(value) ?? 0) + 1);
  }

  let bestValue: T | null = null;
  let bestCount = 0;
  for (const [value, count] of counts) {
    if (count > bestCount) {
      bestValue = value;
      bestCount = count;
    }
  }

  return {
    value: bestValue,
    count: bestCount,
    share: Number((bestCount / values.length).toFixed(4)),
  };
}

export function normalizeEvDeploymentBucket(args: {
  lineComboGroup: string | null | undefined;
  lineComboSlot: number | null | undefined;
}): EvDeploymentBucket | null {
  const slot = finiteNumber(args.lineComboSlot);
  if (slot == null || slot <= 0) return null;

  if (args.lineComboGroup === "forward") {
    return `L${Math.min(4, Math.max(1, Math.floor(slot)))}` as EvDeploymentBucket;
  }

  if (args.lineComboGroup === "defense") {
    return `P${Math.min(3, Math.max(1, Math.floor(slot)))}` as EvDeploymentBucket;
  }

  return null;
}

export function normalizeProjectionEvenStrengthRoleToRankingsBucket(
  role: string | null | undefined,
): EvDeploymentBucket | null {
  if (role === "L1" || role === "L2" || role === "L3" || role === "L4") {
    return role;
  }

  if (role === "D1") return "P1";
  if (role === "D2") return "P2";
  if (role === "D3") return "P3";

  return null;
}

export function normalizePpDeploymentBucket(
  ppUnit: number | null | undefined,
): SpecialTeamsDeploymentBucket | null {
  const unit = finiteNumber(ppUnit);
  if (unit == null || unit <= 0) return null;
  return `PP${Math.min(3, Math.max(1, Math.floor(unit)))}` as
    | "PP1"
    | "PP2"
    | "PP3";
}

export function normalizePkDeploymentBucket(
  pkToiPerGameSeconds: number | null | undefined,
): SpecialTeamsDeploymentBucket | null {
  const toi = finiteNumber(pkToiPerGameSeconds);
  if (toi == null || toi <= 0) return null;
  return toi >= 90 ? "PK1" : "PK2";
}

export function assignEvDeploymentBucketFromToiRank(args: {
  positionGroup: SkaterPositionGroup | null | undefined;
  evToiRankInPositionGroup: number | null | undefined;
}): EvDeploymentBucket | null {
  const rank = finiteNumber(args.evToiRankInPositionGroup);
  if (rank == null || rank <= 0) return null;

  if (args.positionGroup === "forward") {
    const slot = Math.ceil(rank / 3);
    return `L${Math.min(4, Math.max(1, slot))}` as EvDeploymentBucket;
  }

  if (args.positionGroup === "defense") {
    const slot = Math.ceil(rank / 2);
    return `P${Math.min(3, Math.max(1, slot))}` as EvDeploymentBucket;
  }

  return null;
}

export function resolveEvDeploymentBucket(
  row: SkaterDeploymentContextRow,
): {
  bucket: EvDeploymentBucket | null;
  source: "lineCombinations" | "rolling_player_game_metrics" | "ev_toi_fallback";
} {
  if (row.lineCombination) {
    const assignment = resolveTrustedLineAssignment({
      row: row.lineCombination,
      playerId: row.playerId,
    });
    const bucket = normalizeEvDeploymentBucket({
      lineComboGroup: assignment.lineCombo.positionGroup,
      lineComboSlot: assignment.lineCombo.slot,
    });
    if (bucket) return { bucket, source: "lineCombinations" };
  }

  const rollingBucket = normalizeEvDeploymentBucket({
    lineComboGroup: row.lineComboGroup,
    lineComboSlot: row.lineComboSlot,
  });
  if (rollingBucket) {
    return { bucket: rollingBucket, source: "rolling_player_game_metrics" };
  }

  return {
    bucket: assignEvDeploymentBucketFromToiRank({
      positionGroup: row.positionGroup,
      evToiRankInPositionGroup: row.evToiRankInPositionGroup,
    }),
    source: "ev_toi_fallback",
  };
}

function confidenceFor(args: {
  gamesTracked: number;
  teamGamesAvailable: number;
  roleConsistencyShare: number;
  hasDeployment: boolean;
}): DeploymentConfidence {
  if (!args.hasDeployment || args.gamesTracked <= 0) return "low";
  const coverage =
    args.teamGamesAvailable > 0
      ? args.gamesTracked / args.teamGamesAvailable
      : args.gamesTracked > 0
        ? 1
        : 0;

  if (coverage >= 0.7 && args.roleConsistencyShare >= 0.7) return "high";
  if (coverage >= 0.4 && args.roleConsistencyShare >= 0.4) return "mixed";
  return "low";
}

export function buildSkaterDeploymentAggregate(args: {
  playerId: number;
  teamId: number;
  window: SkaterDeploymentWindow;
  teamGamesAvailable: number;
  rows: SkaterDeploymentContextRow[];
}): SkaterDeploymentAggregate {
  const scopedRows = args.rows
    .filter((row) => row.playerId === args.playerId && row.teamId === args.teamId)
    .sort((a, b) => b.gameDate.localeCompare(a.gameDate))
    .slice(0, Math.max(0, args.teamGamesAvailable));

  const evAssignments = scopedRows.map(resolveEvDeploymentBucket);
  const evBuckets = evAssignments
    .map((assignment) => assignment.bucket)
    .filter((bucket): bucket is EvDeploymentBucket => bucket != null);
  const ppBuckets = scopedRows
    .map((row) => normalizePpDeploymentBucket(row.ppUnit))
    .filter((bucket): bucket is SpecialTeamsDeploymentBucket => bucket != null);
  const pkBuckets = scopedRows
    .map((row) => normalizePkDeploymentBucket(row.pkToiPerGameSeconds))
    .filter((bucket): bucket is SpecialTeamsDeploymentBucket => bucket != null);
  const evMode = mostCommon(evBuckets);
  const ppMode = mostCommon(ppBuckets);
  const pkMode = mostCommon(pkBuckets);

  const source =
    evAssignments.find((assignment) => assignment.bucket)?.source ??
    "ev_toi_fallback";

  return {
    playerId: args.playerId,
    teamId: args.teamId,
    window: args.window,
    teamGamesAvailable: args.teamGamesAvailable,
    gamesTracked: scopedRows.length,
    evDeploymentBucket: evMode.value,
    ppDeploymentBucket: ppMode.value,
    pkDeploymentBucket: pkMode.value,
    deploymentConfidence: confidenceFor({
      gamesTracked: scopedRows.length,
      teamGamesAvailable: args.teamGamesAvailable,
      roleConsistencyShare: evMode.share,
      hasDeployment: evMode.value != null,
    }),
    roleConsistencyShare: evMode.share,
    averageEvToiPerGameSeconds: average(
      scopedRows.map((row) => row.evToiPerGameSeconds),
    ),
    averagePpToiPerGameSeconds: average(
      scopedRows.map((row) => row.ppToiPerGameSeconds),
    ),
    averagePkToiPerGameSeconds: average(
      scopedRows.map((row) => row.pkToiPerGameSeconds),
    ),
    source,
  };
}
