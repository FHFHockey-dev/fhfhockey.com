import type { NhlShotFeatureRow } from "../supabase/Upserts/nhlShotFeatureBuilder";

export type DatasetSplit = "train" | "validation" | "test";

export type EncodedBaselineExample = {
  rowId: string;
  gameId: number;
  eventId: number;
  seasonId: number | null;
  gameDate: string | null;
  split: DatasetSplit;
  label: 0 | 1;
  strengthState: string | null;
  isReboundShot: boolean;
  isRushShot: boolean;
  features: number[];
};

export type EncodedBaselineDataset = {
  featureKeys: string[];
  categoricalLevels: Record<string, string[]>;
  splitAssignments: Array<{ gameId: number; split: DatasetSplit }>;
  splitCounts: Record<DatasetSplit, number>;
  examples: EncodedBaselineExample[];
};

export const NUMERIC_FEATURE_KEYS = [
  "homeScoreDiffBeforeEvent",
  "awayScoreDiffBeforeEvent",
  "ownerScoreDiffBeforeEvent",
  "possessionEventCount",
  "possessionDurationSeconds",
  "shooterPreviousShiftGapSeconds",
  "shooterPreviousShiftDurationSeconds",
  "ownerAveragePreviousShiftGapSeconds",
  "ownerAveragePreviousShiftDurationSeconds",
  "opponentAveragePreviousShiftGapSeconds",
  "opponentAveragePreviousShiftDurationSeconds",
  "ownerForwardCountOnIce",
  "ownerDefenseCountOnIce",
  "opponentForwardCountOnIce",
  "opponentDefenseCountOnIce",
  "reboundLateralDisplacementFeet",
  "reboundDistanceDeltaFeet",
  "reboundAngleChangeDegrees",
  "normalizedX",
  "normalizedY",
  "shotDistanceFeet",
  "shotAngleDegrees",
  "periodNumber",
  "periodSecondsElapsed",
  "gameSecondsElapsed",
  "timeSincePreviousEventSeconds",
  "distanceFromPreviousEvent",
  "ownerPowerPlayAgeSeconds",
  "shooterShiftAgeSeconds",
  "eastWestMovementFeet",
  "northSouthMovementFeet",
] as const;

export const DEFAULT_NUMERIC_FEATURE_KEYS = [
  "normalizedX",
  "normalizedY",
  "shotDistanceFeet",
  "shotAngleDegrees",
  "periodNumber",
  "periodSecondsElapsed",
  "gameSecondsElapsed",
  "timeSincePreviousEventSeconds",
  "distanceFromPreviousEvent",
  "ownerPowerPlayAgeSeconds",
  "shooterShiftAgeSeconds",
  "eastWestMovementFeet",
  "northSouthMovementFeet",
] as const satisfies readonly NumericFeatureKey[];

export const BOOLEAN_FEATURE_KEYS = [
  "previousEventSameTeam",
  "isReboundShot",
  "isRushShot",
  "isFlurryShot",
  "isEmptyNetEvent",
  "isOvertimeEvent",
  "isShortSideMiss",
  "crossedRoyalRoad",
  "ownerGoalieOnIce",
  "opponentGoalieOnIce",
  "isDefensemanShooter",
  "possessionRegainedFromOpponent",
  "possessionEnteredOffensiveZone",
  "isLateGameClose",
  "isLateGameTrailing",
  "isLateGameLeading",
  "isFinalFiveMinutes",
  "isFinalTwoMinutes",
] as const;

export const CATEGORICAL_FEATURE_KEYS = [
  "shotType",
  "strengthState",
  "strengthExact",
  "zoneCode",
  "previousEventTypeDescKey",
  "missReasonBucket",
  "ownerSkaterDeploymentBucket",
  "opponentSkaterDeploymentBucket",
  "skaterRoleMatchupBucket",
  "shooterRosterPosition",
  "shooterPositionGroup",
  "shooterHandedness",
  "goalieCatchHand",
  "shooterGoalieHandednessMatchup",
  "possessionStartTypeDescKey",
  "possessionStartZoneCode",
  "possessionRegainEventTypeDescKey",
  "ownerScoreDiffBucket",
  "scoreEffectsGameTimeSegment",
  "ownerScoreDiffByGameTimeBucket",
] as const;

type NumericFeatureKey = (typeof NUMERIC_FEATURE_KEYS)[number];
type BooleanFeatureKey = (typeof BOOLEAN_FEATURE_KEYS)[number];
type CategoricalFeatureKey = (typeof CATEGORICAL_FEATURE_KEYS)[number];

export type BaselineFeatureSelection = {
  numericKeys?: NumericFeatureKey[];
  booleanKeys?: BooleanFeatureKey[];
  categoricalKeys?: CategoricalFeatureKey[];
};

export type BaselineFeatureFamilyName = "first_pass_v1" | "expanded_v2";

export type BaselineSplitConfig = {
  trainRatio?: number;
  validationRatio?: number;
  testRatio?: number;
};

export type BaselineDatasetBuildOptions = {
  featureFamily?: BaselineFeatureFamilyName;
  featureSelection?: BaselineFeatureSelection;
  splitConfig?: BaselineSplitConfig;
  seed?: number;
};

export const DEFAULT_BOOLEAN_FEATURE_KEYS = [
  "previousEventSameTeam",
  "isReboundShot",
  "isRushShot",
  "isFlurryShot",
  "isEmptyNetEvent",
  "isOvertimeEvent",
  "isShortSideMiss",
  "crossedRoyalRoad",
] as const satisfies readonly BooleanFeatureKey[];

export const DEFAULT_CATEGORICAL_FEATURE_KEYS = [
  "shotType",
  "strengthState",
  "strengthExact",
  "zoneCode",
  "previousEventTypeDescKey",
  "missReasonBucket",
] as const satisfies readonly CategoricalFeatureKey[];

export const EXPANDED_V2_NUMERIC_FEATURE_KEYS = [
  ...DEFAULT_NUMERIC_FEATURE_KEYS,
  "homeScoreDiffBeforeEvent",
  "awayScoreDiffBeforeEvent",
  "ownerScoreDiffBeforeEvent",
  "possessionEventCount",
  "possessionDurationSeconds",
] as const satisfies readonly NumericFeatureKey[];

export const EXPANDED_V2_BOOLEAN_FEATURE_KEYS = [
  ...DEFAULT_BOOLEAN_FEATURE_KEYS,
  "isDefensemanShooter",
  "possessionRegainedFromOpponent",
  "possessionEnteredOffensiveZone",
  "isLateGameClose",
  "isLateGameTrailing",
] as const satisfies readonly BooleanFeatureKey[];

export const EXPANDED_V2_CATEGORICAL_FEATURE_KEYS = [
  ...DEFAULT_CATEGORICAL_FEATURE_KEYS,
  "shooterRosterPosition",
  "shooterPositionGroup",
  "possessionStartTypeDescKey",
  "possessionStartZoneCode",
  "possessionRegainEventTypeDescKey",
  "ownerScoreDiffBucket",
] as const satisfies readonly CategoricalFeatureKey[];

export const BASELINE_FEATURE_FAMILY_PRESETS = {
  first_pass_v1: {
    numericKeys: [...DEFAULT_NUMERIC_FEATURE_KEYS],
    booleanKeys: [...DEFAULT_BOOLEAN_FEATURE_KEYS],
    categoricalKeys: [...DEFAULT_CATEGORICAL_FEATURE_KEYS],
  },
  expanded_v2: {
    numericKeys: [...EXPANDED_V2_NUMERIC_FEATURE_KEYS],
    booleanKeys: [...EXPANDED_V2_BOOLEAN_FEATURE_KEYS],
    categoricalKeys: [...EXPANDED_V2_CATEGORICAL_FEATURE_KEYS],
  },
} satisfies Record<
  BaselineFeatureFamilyName,
  {
    numericKeys: NumericFeatureKey[];
    booleanKeys: BooleanFeatureKey[];
    categoricalKeys: CategoricalFeatureKey[];
  }
>;

const FORBIDDEN_BASELINE_FEATURE_INPUT_KEYS = new Set(["shotEventType"]);
const FORBIDDEN_BASELINE_FEATURE_KEY_PREFIXES = ["shotEventType:"];

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function normalizeCategoricalValue(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const normalized = value.trim();
  return normalized.length > 0 ? normalized : null;
}

export function isEligibleBaselineTrainingRow(row: NhlShotFeatureRow): boolean {
  return (
    row.isUnblockedShotAttempt &&
    !row.isPenaltyShotEvent &&
    !row.isShootoutEvent
  );
}

function createDeterministicRandom(seed: number): () => number {
  let state = seed >>> 0;

  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let result = Math.imul(state ^ (state >>> 15), 1 | state);
    result ^= result + Math.imul(result ^ (result >>> 7), 61 | result);
    return ((result ^ (result >>> 14)) >>> 0) / 4294967296;
  };
}

function resolveFeatureSelection(
  selection: BaselineFeatureSelection = {},
  featureFamily: BaselineFeatureFamilyName = "first_pass_v1"
): {
  numericKeys: NumericFeatureKey[];
  booleanKeys: BooleanFeatureKey[];
  categoricalKeys: CategoricalFeatureKey[];
} {
  const preset = BASELINE_FEATURE_FAMILY_PRESETS[featureFamily];
  const numericKeys = selection.numericKeys?.length
    ? selection.numericKeys
    : [...preset.numericKeys];
  const booleanKeys = selection.booleanKeys?.length
    ? selection.booleanKeys
    : [...preset.booleanKeys];
  const categoricalKeys = selection.categoricalKeys?.length
    ? selection.categoricalKeys
    : [...preset.categoricalKeys];

  const forbiddenInputs = [...numericKeys, ...booleanKeys, ...categoricalKeys].filter((key) =>
    FORBIDDEN_BASELINE_FEATURE_INPUT_KEYS.has(String(key))
  );
  if (forbiddenInputs.length) {
    throw new Error(
      `Forbidden baseline feature inputs were requested: ${Array.from(new Set(forbiddenInputs)).join(", ")}.`
    );
  }

  return {
    numericKeys: Array.from(new Set(numericKeys)),
    booleanKeys: Array.from(new Set(booleanKeys)),
    categoricalKeys: Array.from(new Set(categoricalKeys)),
  };
}

function normalizeSplitConfig(
  splitConfig: BaselineSplitConfig = {}
): Required<BaselineSplitConfig> {
  const trainRatio = splitConfig.trainRatio ?? 0.7;
  const validationRatio = splitConfig.validationRatio ?? 0.15;
  const explicitTestRatio = splitConfig.testRatio;
  const testRatio =
    explicitTestRatio ?? Math.max(0, 1 - trainRatio - validationRatio);

  const ratios = [trainRatio, validationRatio, testRatio];
  if (ratios.some((ratio) => !Number.isFinite(ratio) || ratio < 0)) {
    throw new Error("Split ratios must be finite numbers greater than or equal to 0.");
  }

  const ratioSum = trainRatio + validationRatio + testRatio;
  if (ratioSum <= 0) {
    throw new Error("At least one split ratio must be greater than 0.");
  }

  return {
    trainRatio: trainRatio / ratioSum,
    validationRatio: validationRatio / ratioSum,
    testRatio: testRatio / ratioSum,
  };
}

function buildChronologicalGameSplitAssignments(
  rows: NhlShotFeatureRow[],
  splitConfig: BaselineSplitConfig = {},
  seed = 42
): Array<{ gameId: number; split: DatasetSplit }> {
  const { trainRatio, validationRatio } = normalizeSplitConfig(splitConfig);
  const random = createDeterministicRandom(seed);
  const games = Array.from(
    new Map(
      rows.map((row) => [
        row.gameId,
        {
          gameId: row.gameId,
          gameDate: row.gameDate ?? "9999-12-31",
        },
      ])
    ).values()
  );
  const randomizedWithinDate = new Map<string, Array<(typeof games)[number]>>();
  for (const game of games) {
    const bucket = randomizedWithinDate.get(game.gameDate) ?? [];
    bucket.push(game);
    randomizedWithinDate.set(game.gameDate, bucket);
  }

  const orderedGames = Array.from(randomizedWithinDate.entries())
    .sort((left, right) => left[0].localeCompare(right[0]))
    .flatMap(([, sameDateGames]) =>
      sameDateGames
        .map((game) => ({
          game,
          randomOrder: random(),
        }))
        .sort((left, right) => {
          if (left.randomOrder !== right.randomOrder) {
            return left.randomOrder - right.randomOrder;
          }

          return left.game.gameId - right.game.gameId;
        })
        .map((entry) => entry.game)
    );

  const totalGames = orderedGames.length;
  const rawTrain = Math.floor(totalGames * trainRatio);
  const rawValidation = Math.floor(totalGames * validationRatio);
  const trainCount = Math.max(1, rawTrain);
  const validationCount = Math.max(
    totalGames >= 3 ? 1 : 0,
    Math.min(rawValidation, Math.max(totalGames - trainCount - 1, 0))
  );

  return orderedGames.map((game, index) => {
    if (index < trainCount) {
      return { gameId: game.gameId, split: "train" as const };
    }

    if (index < trainCount + validationCount) {
      return { gameId: game.gameId, split: "validation" as const };
    }

    return { gameId: game.gameId, split: "test" as const };
  });
}

function encodeNumericFeature(
  row: NhlShotFeatureRow,
  key: NumericFeatureKey
): number {
  const value = row[key];
  return isFiniteNumber(value) ? value : 0;
}

function encodeBooleanFeature(
  row: NhlShotFeatureRow,
  key: BooleanFeatureKey
): number {
  const value = row[key];
  return value === true ? 1 : 0;
}

export function buildEncodedBaselineDataset(
  shotRows: NhlShotFeatureRow[],
  options: BaselineDatasetBuildOptions = {}
): EncodedBaselineDataset {
  const eligibleRows = shotRows.filter(isEligibleBaselineTrainingRow);
  if (!eligibleRows.length) {
    throw new Error("No eligible shot-feature rows were available for baseline training.");
  }

  const { numericKeys, booleanKeys, categoricalKeys } = resolveFeatureSelection(
    options.featureSelection,
    options.featureFamily
  );
  const splitAssignments = buildChronologicalGameSplitAssignments(
    eligibleRows,
    options.splitConfig,
    options.seed ?? 42
  );
  const splitByGameId = new Map(
    splitAssignments.map((assignment) => [assignment.gameId, assignment.split])
  );

  const categoricalLevels = Object.fromEntries(
    categoricalKeys.map((key) => {
      const levels = Array.from(
        new Set(
          eligibleRows
            .map((row) => normalizeCategoricalValue(row[key]))
            .filter((value): value is string => value != null)
        )
      ).sort();

      return [key, levels];
    })
  ) as Record<CategoricalFeatureKey, string[]>;

  const featureKeys = [
    ...numericKeys,
    ...booleanKeys,
    ...categoricalKeys.flatMap((key) =>
      categoricalLevels[key].map((level) => `${key}:${level}`)
    ),
  ];

  const forbiddenFeatureKeys = featureKeys.filter((featureKey) =>
    FORBIDDEN_BASELINE_FEATURE_KEY_PREFIXES.some((prefix) => featureKey.startsWith(prefix))
  );
  if (forbiddenFeatureKeys.length) {
    throw new Error(
      `Forbidden baseline feature keys were generated: ${Array.from(new Set(forbiddenFeatureKeys)).join(", ")}.`
    );
  }

  const splitCounts: Record<DatasetSplit, number> = {
    train: 0,
    validation: 0,
    test: 0,
  };

  const examples = eligibleRows.map((row) => {
    const split = splitByGameId.get(row.gameId) ?? "test";
    splitCounts[split] += 1;

    const features = [
      ...numericKeys.map((key) => encodeNumericFeature(row, key)),
      ...booleanKeys.map((key) => encodeBooleanFeature(row, key)),
      ...categoricalKeys.flatMap((key) => {
        const value = normalizeCategoricalValue(row[key]);
        return categoricalLevels[key].map((level) => (value === level ? 1 : 0));
      }),
    ];

    return {
      rowId: `${row.gameId}:${row.eventId}`,
      gameId: row.gameId,
      eventId: row.eventId,
      seasonId: row.seasonId ?? null,
      gameDate: row.gameDate ?? null,
      split,
      label: row.isGoal ? 1 : 0,
      strengthState: row.strengthState ?? null,
      isReboundShot: row.isReboundShot === true,
      isRushShot: row.isRushShot === true,
      features,
    } satisfies EncodedBaselineExample;
  });

  return {
    featureKeys,
    categoricalLevels,
    splitAssignments,
    splitCounts,
    examples,
  };
}
