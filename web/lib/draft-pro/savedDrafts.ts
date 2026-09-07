import { z } from "zod";

import { bookmarkImportError } from "lib/draftDashboard/settingsValidation";
import type { SessionCsvEntry } from "lib/draftDashboard/csvImportSession";

import {
  DRAFT_PRO_MAX_PRIVATE_IMPORT_BYTES,
  DRAFT_PRO_SCHEMA_VERSION,
  draftProSnapshotSchema,
  type DraftProSnapshot,
} from "./contracts";

/**
 * The dashboard's browser-session format is deliberately adapted here instead
 * of being stored as an opaque browser blob. Import rows are intentionally
 * omitted: they are persisted and restored through private-import records.
 */
const browserSnapshotSchema = z.object({
  v: z.literal(2),
  draftSettings: z.record(z.unknown()),
  draftedPlayers: z.array(z.record(z.unknown())).max(500),
  keepers: z.array(z.record(z.unknown())).max(200).default([]),
  pickOwnerOverrides: z.record(z.string()).default({}),
  pickTrades: z.array(z.record(z.unknown())).max(200).optional(),
  positionOverrides: z.record(z.string()).default({}),
  customTeamNames: z.record(z.string()).default({}),
  currentPick: z.number().int().positive(),
  isSnakeDraft: z.boolean(),
  myTeamId: z.string().min(1),
  baselineMode: z.enum(["remaining", "full"]),
  needWeightEnabled: z.boolean(),
  needAlpha: z.number().finite().min(0).max(1),
  forwardGrouping: z.enum(["split", "fwd"]),
  personalizeReplacement: z.boolean(),
  goaliePointValues: z.record(z.number().finite()),
  sourceControls: z.record(z.object({ isSelected: z.boolean(), weight: z.number().finite().min(0).max(2) })),
  goalieSourceControls: z.record(z.object({ isSelected: z.boolean(), weight: z.number().finite().min(0).max(2) })),
  customCsvList: z.array(z.object({
    id: z.string().regex(/^custom_csv_/),
    label: z.string().min(1).max(160),
    headers: z.array(z.object({ original: z.string(), standardized: z.string(), selected: z.boolean() })).optional(),
    resolution: z.record(z.unknown()).optional(),
  }).passthrough()).default([]),
  favorites: z.array(z.union([z.string().max(100), z.number().int()])).max(1000).default([]),
  notes: z.array(z.object({ id: z.string().max(100), text: z.string().max(5000) })).max(500).default([]),
  tiers: z.record(z.unknown()).default({}),
  fantraxLeagueOverride: z.unknown().nullable().optional(),
  espnLeagueOverride: z.unknown().nullable().optional(),
  preserveExactCategoryWeights: z.boolean().optional(),
  configured: z.boolean().optional(),
}).strict();

export type BrowserDraftSnapshot = z.input<typeof browserSnapshotSchema>;

export type NormalizedPrivateImport = {
  id?: string;
  name: string;
  rows: Record<string, unknown>[];
  mapping: NonNullable<SessionCsvEntry["headers"]>;
  sourceId: string;
};

export function privateImportBytes(imports: readonly NormalizedPrivateImport[]) {
  return new TextEncoder().encode(JSON.stringify(imports.map((entry) => ({
    name: entry.name,
    rows: entry.rows,
    mapping: entry.mapping,
    sourceId: entry.sourceId,
  })))).byteLength;
}

export function toNormalizedPrivateImports(entries: readonly SessionCsvEntry[]): NormalizedPrivateImport[] {
  return entries.map((entry) => {
    if (!Array.isArray(entry.rows)) throw new Error(`Private import rows are missing for ${entry.label}. Save was not started.`);
    const candidate = { name: entry.label, rows: entry.rows, mapping: entry.headers ?? [], sourceId: entry.id };
    try { JSON.stringify(candidate); } catch { throw new Error(`Private import rows for ${entry.label} are invalid.`); }
    return candidate;
  });
}

export function serializeSavedDraft(browserSnapshot: BrowserDraftSnapshot): DraftProSnapshot {
  const parsed = browserSnapshotSchema.parse(browserSnapshot);
  const bookmarkError = bookmarkImportError({
    v: 3,
    settings: parsed.draftSettings,
    draftedPlayers: parsed.draftedPlayers,
    keepers: parsed.keepers,
    pickOwnerOverrides: parsed.pickOwnerOverrides,
    pickTrades: parsed.pickTrades,
    currentPick: parsed.currentPick,
    isSnakeDraft: parsed.isSnakeDraft,
    myTeamId: parsed.myTeamId,
    sourceControls: parsed.sourceControls,
    goalieSourceControls: parsed.goalieSourceControls,
    goalieScoringCategories: parsed.goaliePointValues,
    customTeamNames: parsed.customTeamNames,
  });
  if (bookmarkError) throw new Error(bookmarkError);

  return draftProSnapshotSchema.parse({
    settings: {
      draftSettings: parsed.draftSettings,
      currentPick: parsed.currentPick,
      isSnakeDraft: parsed.isSnakeDraft,
      configured: parsed.configured !== false,
    },
    picks: parsed.draftedPlayers,
    keepers: parsed.keepers,
    trades: parsed.pickTrades ?? Object.entries(parsed.pickOwnerOverrides).map(([key, currentTeamId]) => {
      const [round, pickInRound] = key.split("-").map(Number);
      return { round, pickInRound, currentTeamId };
    }),
    team: { myTeamId: parsed.myTeamId, customTeamNames: parsed.customTeamNames, positionOverrides: parsed.positionOverrides },
    sourceWeights: { skater: parsed.sourceControls, goalie: parsed.goalieSourceControls, goaliePointValues: parsed.goaliePointValues },
    // Metadata only. The rows are independently saved as normalized private imports.
    importMappings: parsed.customCsvList.map(({ id, label, headers, resolution }) => ({ id, label, headers: headers ?? [], resolution: resolution ?? {} })),
    favorites: parsed.favorites,
    notes: parsed.notes,
    tiers: parsed.tiers,
    recommendationPreferences: {
      baselineMode: parsed.baselineMode,
      needWeightEnabled: parsed.needWeightEnabled,
      needAlpha: parsed.needAlpha,
      forwardGrouping: parsed.forwardGrouping,
      personalizeReplacement: parsed.personalizeReplacement,
      fantraxLeagueOverride: parsed.fantraxLeagueOverride ?? null,
      espnLeagueOverride: parsed.espnLeagueOverride ?? null,
      preserveExactCategoryWeights: parsed.preserveExactCategoryWeights === true,
    },
  });
}

export function assertPrivateImportBounds(imports: readonly NormalizedPrivateImport[]) {
  const bytes = privateImportBytes(imports);
  if (bytes > DRAFT_PRO_MAX_PRIVATE_IMPORT_BYTES) {
    throw new Error("Normalized private imports exceed the 10 MiB per-draft limit.");
  }
  return bytes;
}

export function restoreBrowserSnapshot(snapshot: DraftProSnapshot, imports: readonly NormalizedPrivateImport[]) {
  const parsed = draftProSnapshotSchema.parse(snapshot);
  const metadata = z.array(z.object({ id: z.string(), label: z.string(), headers: z.array(z.unknown()), resolution: z.unknown() })).parse(parsed.importMappings);
  const importsBySource = new Map(imports.map((entry) => [entry.sourceId, entry]));
  const missing = metadata.filter((entry) => !importsBySource.has(entry.id));
  if (missing.length) throw new Error(`Private import data is missing for ${missing.map((entry) => entry.label).join(", ")}. The draft was not restored.`);
  const settings = z.object({ draftSettings: z.record(z.unknown()), currentPick: z.number().int().positive(), isSnakeDraft: z.boolean(), configured: z.boolean() }).parse(parsed.settings);
  const team = z.object({ myTeamId: z.string(), customTeamNames: z.record(z.string()), positionOverrides: z.record(z.string()) }).parse(parsed.team);
  const weights = z.object({ skater: z.record(z.unknown()), goalie: z.record(z.unknown()), goaliePointValues: z.record(z.number()) }).parse(parsed.sourceWeights);
  const preferences = z.object({ baselineMode: z.enum(["remaining", "full"]), needWeightEnabled: z.boolean(), needAlpha: z.number(), forwardGrouping: z.enum(["split", "fwd"]), personalizeReplacement: z.boolean(), fantraxLeagueOverride: z.unknown().nullable(), espnLeagueOverride: z.unknown().nullable(), preserveExactCategoryWeights: z.boolean() }).parse(parsed.recommendationPreferences);
  return {
    v: 2 as const,
    draftSettings: settings.draftSettings,
    draftedPlayers: parsed.picks,
    keepers: parsed.keepers,
    pickOwnerOverrides: {},
    pickTrades: parsed.trades,
    positionOverrides: team.positionOverrides,
    customTeamNames: team.customTeamNames,
    currentPick: settings.currentPick,
    isSnakeDraft: settings.isSnakeDraft,
    myTeamId: team.myTeamId,
    baselineMode: preferences.baselineMode,
    needWeightEnabled: preferences.needWeightEnabled,
    needAlpha: preferences.needAlpha,
    forwardGrouping: preferences.forwardGrouping,
    personalizeReplacement: preferences.personalizeReplacement,
    goaliePointValues: weights.goaliePointValues,
    sourceControls: weights.skater,
    goalieSourceControls: weights.goalie,
    customCsvList: metadata.map((entry) => {
      const source = importsBySource.get(entry.id)!;
      return { id: source.sourceId, label: source.name, headers: source.mapping, rows: source.rows, resolution: entry.resolution };
    }),
    favorites: parsed.favorites,
    notes: parsed.notes,
    tiers: parsed.tiers,
    fantraxLeagueOverride: preferences.fantraxLeagueOverride,
    espnLeagueOverride: preferences.espnLeagueOverride,
    preserveExactCategoryWeights: preferences.preserveExactCategoryWeights,
    configured: settings.configured,
    schemaVersion: DRAFT_PRO_SCHEMA_VERSION,
  };
}
