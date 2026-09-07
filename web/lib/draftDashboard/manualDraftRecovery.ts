import {
  isSessionCsvEntry,
  validateCustomCsvEntries,
  type SessionCsvEntry,
} from "./csvImportSession";
import { validateKeeperBatch } from "./keepers";
import { validatePickTradeBatch } from "./pickTrades";
import { normalizeDraftOrderPattern } from "./draftOrder";

export const MANUAL_DRAFT_RECOVERY_VERSION = 4;

export type ManualDraftUndoEntry = {
  players: unknown[];
  pickNumber: number;
  positionOverrides: Record<string, string>;
};

export type ManualDraftRecoveryRecord = {
  v: typeof MANUAL_DRAFT_RECOVERY_VERSION;
  ts: number;
  isSnakeDraft: boolean;
  configured: boolean;
  settings: Record<string, unknown>;
  draftedPlayers: unknown[];
  draftHistory: ManualDraftUndoEntry[];
  currentPick: number;
  myTeamId: string;
  customTeamNames: Record<string, string>;
  forwardGrouping: "split" | "fwd";
  baselineMode: "remaining" | "full";
  personalizeReplacement: boolean;
  needWeightEnabled: boolean;
  needAlpha: number;
  prorate84?: boolean;
  riskSd?: number;
  goalieScoringCategories?: Record<string, number>;
  sourceControls: Record<string, unknown>;
  goalieSourceControls: Record<string, unknown>;
  keepers: unknown[];
  pickTrades: unknown[];
  positionOverrides: Record<string, string>;
  preserveExactCategoryWeights: boolean;
  csvMetadata: Array<Pick<SessionCsvEntry, "id" | "label" | "headers" | "resolution">>;
  customCsvEntries?: SessionCsvEntry[];
};

export type ManualDraftRecoveryWriteInput = Omit<
  ManualDraftRecoveryRecord,
  "v" | "ts" | "prorate84" | "riskSd" | "customCsvEntries"
> & {
  ts?: number;
  prorate84: boolean;
  riskSd: number;
  customCsvEntries?: SessionCsvEntry[];
};

export function readManualDraftAnalysisPreferences(
  storage: Pick<Storage, "getItem">,
) {
  const currentProrate = storage.getItem("projections.prorate84");
  const risk = Number.parseFloat(storage.getItem("projections.riskSd") || "12");
  return {
    prorate84:
      currentProrate == null
        ? storage.getItem("projections.prorate82") === "true"
        : currentProrate === "true",
    riskSd: Number.isFinite(risk) ? Math.max(2, Math.min(40, risk)) : 12,
  };
}

export function createManualDraftRecoveryRecord(
  input: ManualDraftRecoveryWriteInput,
): ManualDraftRecoveryRecord {
  const { ts, customCsvEntries, ...record } = input;
  return {
    v: MANUAL_DRAFT_RECOVERY_VERSION,
    ts: Number.isFinite(ts) ? Number(ts) : Date.now(),
    ...record,
    riskSd: Math.max(2, Math.min(40, record.riskSd)),
    ...(customCsvEntries ? { customCsvEntries } : {}),
  };
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === "object" && !Array.isArray(value);

const isStringRecord = (value: unknown) =>
  isRecord(value) && Object.values(value).every((item) => typeof item === "string");

const isNumberRecord = (value: unknown) =>
  isRecord(value) && Object.values(value).every((item) => Number.isFinite(item));

const isUndoEntry = (value: unknown): value is ManualDraftUndoEntry =>
  isRecord(value) &&
  Array.isArray(value.players) &&
  Number.isInteger(value.pickNumber) &&
  isStringRecord(value.positionOverrides ?? {});

const isCsvMetadata = (
  value: unknown,
): value is ManualDraftRecoveryRecord["csvMetadata"][number] =>
  isRecord(value) &&
  typeof value.id === "string" &&
  value.id.startsWith("custom_csv_") &&
  typeof value.label === "string";

function validateSettings(settings: Record<string, unknown>) {
  if (
    !Number.isInteger(settings.teamCount) ||
    !Array.isArray(settings.draftOrder) ||
    !settings.draftOrder.every((id) => typeof id === "string") ||
    new Set(settings.draftOrder).size !== settings.draftOrder.length ||
    settings.draftOrder.length !== settings.teamCount ||
    !isNumberRecord(settings.rosterConfig) ||
    !isNumberRecord(settings.scoringCategories)
  )
    return "Draft recovery data has invalid settings.";
  return undefined;
}

function validatePlayers(
  players: unknown[],
  settings: Record<string, unknown>,
  positionOverrides: Record<string, string>,
  additionalPlayerIds: Iterable<string> = [],
) {
  const teamCount = settings.teamCount as number;
  const teamIds = new Set(settings.draftOrder as string[]);
  const ids = new Set<string>(additionalPlayerIds);
  const picks = new Set<number>();
  for (const player of players) {
    if (
      !isRecord(player) ||
      typeof player.playerId !== "string" ||
      !teamIds.has(player.teamId as string) ||
      !Number.isInteger(player.pickNumber) ||
      (player.pickNumber as number) < 1 ||
      player.round !== Math.ceil((player.pickNumber as number) / teamCount) ||
      player.pickInRound !== ((player.pickNumber as number) - 1) % teamCount + 1 ||
      ids.has(player.playerId) ||
      picks.has(player.pickNumber as number)
    )
      return "Draft recovery data has invalid or duplicate picks.";
    ids.add(player.playerId);
    picks.add(player.pickNumber as number);
  }
  if (Object.keys(positionOverrides).some((id) => !ids.has(id)))
    return "Draft recovery data has a slot override for a missing player.";
  return undefined;
}

/**
 * Normalize the old snapshot/session/bookmark shapes into one compact record.
 * CSV rows are optional portable attachments and are never part of durable state.
 */
export function adaptManualDraftRecovery(value: unknown): {
  record?: ManualDraftRecoveryRecord;
  error?: string;
} {
  if (!isRecord(value)) return { error: "Draft recovery data is not an object." };
  if (typeof value.v === "number" && value.v > MANUAL_DRAFT_RECOVERY_VERSION)
    return { error: "Draft recovery data uses a newer unsupported version." };
  const settings = isRecord(value.settings)
    ? value.settings
    : isRecord(value.draftSettings)
      ? value.draftSettings
      : undefined;
  if (!settings || !Array.isArray(value.draftedPlayers))
    return { error: "Draft recovery data is missing settings or picks." };
  const settingsError = validateSettings(settings);
  if (settingsError) return { error: settingsError };
  const currentPick = value.currentPick;
  if (typeof currentPick !== "number" || !Number.isInteger(currentPick) || currentPick < 1)
    return { error: "Draft recovery data has an invalid current pick." };
  const validCurrentPick = currentPick as number;
  const draftHistory = Array.isArray(value.draftHistory)
    ? value.draftHistory.map((entry) => ({
        ...(isRecord(entry) ? entry : {}),
        positionOverrides: isRecord(entry) ? entry.positionOverrides ?? {} : {},
      }))
    : [];
  if (!draftHistory.every(isUndoEntry))
    return { error: "Draft recovery data has invalid undo history." };
  const positionOverrides = value.positionOverrides ?? {};
  if (!isStringRecord(positionOverrides))
    return { error: "Draft recovery data has invalid slot overrides." };
  const customTeamNames = value.customTeamNames ?? {};
  if (!isStringRecord(customTeamNames))
    return { error: "Draft recovery data has invalid team names." };
  const csvMetadata = Array.isArray(value.csvMetadata)
    ? value.csvMetadata
    : Array.isArray(value.customCsvList)
      ? value.customCsvList.map((entry) => {
          if (!isRecord(entry)) return entry;
          const { id, label, headers, resolution } = entry;
          return { id, label, headers, resolution };
        })
      : Array.isArray(value.customSourceMetadata)
        ? value.customSourceMetadata
        : [];
  if (!Array.isArray(csvMetadata))
    return { error: "Draft recovery data has invalid custom source metadata." };
  if (
    !csvMetadata.every(isCsvMetadata) ||
    new Set(csvMetadata.map((entry) => entry.id)).size !== csvMetadata.length
  )
    return { error: "Draft recovery data has invalid or duplicate custom source metadata." };
  const customCsvEntries = Array.isArray(value.customCsvEntries)
    ? value.customCsvEntries as SessionCsvEntry[]
    : Array.isArray(value.customCsvList)
      ? value.customCsvList as SessionCsvEntry[]
      : undefined;
  if (
    customCsvEntries &&
    (!customCsvEntries.every(isSessionCsvEntry) ||
      validateCustomCsvEntries(customCsvEntries))
  )
    return { error: "Draft recovery data has invalid or duplicate imported projection rows." };
  const teamCount = settings.teamCount as number;
  const rosterConfig = settings.rosterConfig as Record<string, number>;
  if (
    (value.keepers !== undefined && !Array.isArray(value.keepers)) ||
    (value.pickTrades !== undefined && !Array.isArray(value.pickTrades))
  )
    return { error: "Draft recovery data has malformed keepers or traded picks." };
  const roundCount = Object.values(rosterConfig).reduce(
    (sum, value) => sum + value,
    0,
  );
  const keeperResult = validateKeeperBatch(value.keepers || [], {
    teamCount,
    roundCount,
    teamIds: settings.draftOrder as string[],
    playerIds: [
      ...value.draftedPlayers.flatMap((player) =>
        isRecord(player) && typeof player.playerId === "string"
          ? [player.playerId]
          : [],
      ),
      ...(Array.isArray(value.keepers)
        ? value.keepers.flatMap((keeper) =>
            isRecord(keeper) && typeof keeper.playerId === "string"
              ? [keeper.playerId]
              : [],
          )
        : []),
    ],
    draftedPlayers: value.draftedPlayers.filter(
      (player) => isRecord(player) && !player.isKeeper,
    ) as any[],
    rosterCapacity: roundCount,
  });
  if (!keeperResult.ok)
    return { error: `Draft recovery data has invalid keepers: ${keeperResult.errors.join(" ")}` };
  const noPickKeeperIds = keeperResult.keepers
    .filter((keeper) => keeper.cost === "none")
    .map((keeper) => keeper.playerId);
  const playersError = validatePlayers(
    value.draftedPlayers,
    settings,
    positionOverrides as Record<string, string>,
    noPickKeeperIds,
  );
  if (playersError) return { error: playersError };
  for (const entry of draftHistory) {
    const undoError = validatePlayers(
      entry.players,
      settings,
      entry.positionOverrides as Record<string, string>,
      noPickKeeperIds,
    );
    if (undoError) return { error: `Draft undo history: ${undoError}` };
  }
  const tradeResult = validatePickTradeBatch(
    Array.isArray(value.pickTrades)
      ? value.pickTrades
      : isRecord(value.pickOwnerOverrides)
        ? Object.entries(value.pickOwnerOverrides).map(([key, currentTeamId]) => {
            const [round, pickInRound] = key.split("-").map(Number);
            return { round, pickInRound, currentTeamId };
          })
        : [],
    {
      draftOrder: settings.draftOrder as string[],
      roundCount,
      orderPattern: normalizeDraftOrderPattern(
        {
          mode: typeof settings.draftOrderMode === "string"
            ? settings.draftOrderMode as any
            : undefined,
          reversedRounds: Array.isArray(settings.reversedRounds)
            ? settings.reversedRounds as number[]
            : undefined,
        },
        roundCount,
        value.isSnakeDraft !== false,
      ),
      keepers: keeperResult.keepers,
      draftedPlayers: value.draftedPlayers,
    },
  );
  if (!tradeResult.ok)
    return { error: `Draft recovery data has invalid traded picks: ${tradeResult.errors.join(" ")}` };
  if (value.prorate84 !== undefined && typeof value.prorate84 !== "boolean")
    return { error: "Draft recovery data has an invalid proration preference." };
  if (value.riskSd !== undefined && !Number.isFinite(value.riskSd))
    return { error: "Draft recovery data has an invalid availability-risk preference." };
  return {
    record: {
      v: MANUAL_DRAFT_RECOVERY_VERSION,
      ts: Number.isFinite(value.ts) ? Number(value.ts) : Date.now(),
      isSnakeDraft: value.isSnakeDraft !== false,
      configured: value.configured !== false,
      settings,
      draftedPlayers: value.draftedPlayers,
      draftHistory: draftHistory as ManualDraftUndoEntry[],
      currentPick: validCurrentPick,
      myTeamId: typeof value.myTeamId === "string" ? value.myTeamId : "",
      customTeamNames: customTeamNames as Record<string, string>,
      forwardGrouping: value.forwardGrouping === "fwd" ? "fwd" : "split",
      baselineMode: value.baselineMode === "full" ? "full" : "remaining",
      personalizeReplacement: value.personalizeReplacement === true,
      needWeightEnabled: value.needWeightEnabled === true,
      needAlpha: Number.isFinite(value.needAlpha) ? Number(value.needAlpha) : 0.5,
      ...(typeof value.prorate84 === "boolean" ? { prorate84: value.prorate84 } : {}),
      ...(Number.isFinite(value.riskSd)
        ? { riskSd: Math.max(2, Math.min(40, Number(value.riskSd))) }
        : {}),
      ...(isNumberRecord(value.goalieScoringCategories)
        ? { goalieScoringCategories: value.goalieScoringCategories as Record<string, number> }
        : isNumberRecord(value.goaliePointValues)
          ? { goalieScoringCategories: value.goaliePointValues as Record<string, number> }
          : {}),
      sourceControls: isRecord(value.sourceControls) ? value.sourceControls : {},
      goalieSourceControls: isRecord(value.goalieSourceControls)
        ? value.goalieSourceControls
        : {},
      keepers: keeperResult.keepers,
      pickTrades: tradeResult.trades,
      positionOverrides: positionOverrides as Record<string, string>,
      preserveExactCategoryWeights: value.preserveExactCategoryWeights === true,
      csvMetadata: csvMetadata as ManualDraftRecoveryRecord["csvMetadata"],
      ...(customCsvEntries ? { customCsvEntries } : {}),
    },
  };
}

export function parseManualDraftRecovery(raw: string | null) {
  if (!raw) return { error: "No saved draft." };
  try {
    return adaptManualDraftRecovery(JSON.parse(raw));
  } catch {
    return { error: "Draft recovery data is corrupt." };
  }
}
