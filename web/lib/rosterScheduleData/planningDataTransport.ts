import { z } from "zod";
import type { PlanningData } from "../rosterScheduleOptimizer/planningTypes";
import type { ContributionParticipation } from "../player-forecasts/contributions";

export const PLANNING_DATA_TRANSPORT_VERSION = "planning-data-transport-v1" as const;
export const PLANNING_DATA_TRANSPORT_LIMITS = Object.freeze({ bytes: 4_000_000, rows: 50000, players: 5000, catalog: 10000 });
export class PlanningDataTransportLimitError extends Error {
  constructor() { super("This planning range is too large to display. Choose a shorter range."); }
}
type Model = NonNullable<ContributionParticipation["model"]>;
type ModelMetadata = Omit<Model, "inputHash" | "evidenceHashes">;
type WireParticipation = Omit<ContributionParticipation, "model"> & { model?: [metadata: number, inputHash: string, evidence: number[]] };
export type PlanningDataTransport = { version: typeof PLANNING_DATA_TRANSPORT_VERSION;
  data: Omit<PlanningData, "participationSources"> & { participationSources?: WireParticipation[] };
  catalogs: { models: ModelMetadata[]; hashes: string[] } };
const finite = z.number().finite(), index = finite.int().nonnegative(), positive = index.positive();
const clock = z.string().refine(value => Number.isFinite(Date.parse(value))), strings = z.array(z.string());
const uses = z.object({ assignment: z.boolean(), totals: z.boolean(), comparison: z.boolean(), conditionalTieBreak: z.boolean() }).strict();
const powerPlayRole = z.discriminatedUnion("status", [
  z.object({ value: z.null(), source: z.null(), status: z.literal("unavailable"), reason: z.literal("current_role_evidence_unavailable") }).strict(),
  z.object({ value: z.null(), source: z.null(), status: z.literal("not_applicable"), reason: z.literal("not_applicable") }).strict(),
]);
const model = z.object({ version: z.enum(["skater-participation-frequency-v1", "goalie-appearance-frequency-v1",
  "skater-frozen-window-appearance-frequency-v1", "goalie-frozen-window-appearance-frequency-v1", "goalie-frozen-window-start-frequency-v1",
  "skater-roster-observation-appearance-frequency-v1", "goalie-roster-observation-appearance-frequency-v1", "goalie-roster-observation-start-frequency-v1"]),
  event: z.enum(["positive_minutes", "official_starter"]), probabilityStatus: z.literal("uncalibrated_model"), calibration: z.literal("unavailable"),
  inputHash: z.string(), evidenceHashes: strings, numerator: finite.nonnegative(), denominator: finite.nonnegative(),
  selectedGameIds: z.array(positive), limitations: strings }).strict();
const participant = z.object({ playerId: positive, nhlPlayerId: positive, seasonId: positive, gameId: positive, teamId: positive,
  scheduledAt: clock.optional(), basis: z.enum(["appearance", "start"]), probability: finite.min(0).max(1), revisionId: z.string(),
  released: z.boolean(), allowedUses: uses.optional(), scheduleRevision: z.string(), rosterRevision: z.string(),
  issuedAt: clock, cutoffAt: clock, expiresAt: clock, competitionId: z.string().optional(), model: model.optional() }).strict();
const wireParticipant = participant.omit({ model: true }).extend({ model: z.tuple([index, z.string(), z.array(index)]).optional() }).strict();
const source = z.object({ kind: z.enum(["baseline", "detailed"]), sourceId: z.string(), policyVersion: z.string(), released: z.boolean(),
  allowedUses: uses.optional(), playerId: positive, nhlPlayerId: positive, seasonId: positive, teamId: positive,
  gameId: positive.optional(), scheduledAt: clock.optional(), targetKey: z.string(), unit: z.enum(["count", "minutes"]),
  basis: z.enum(["per_appearance", "per_start", "per_team_game", "unconditional_game"]), mean: finite,
  participationIntegrated: z.boolean(), issuedAt: clock, cutoffAt: clock, expiresAt: clock, catalogExpiresAt: clock.optional(),
  sourceWatermark: z.string(), scheduleRevision: z.string(), rosterRevision: z.string(), legacyAvailabilityAdjustment: z.boolean().optional(),
  limitations: strings.optional() }).strict();
const rows = <T extends z.ZodTypeAny>(shape: T) => z.array(shape).max(PLANNING_DATA_TRANSPORT_LIMITS.rows);
// The surrounding data is passed through unchanged. Transport checks shape and
// identity, while the existing shared resolver remains the authority for use.
const dataShape = z.object({ players: z.array(z.object({ id: z.string(), nhlId: positive.nullable(), name: z.string(),
  teamAbbreviation: z.string().nullable(), eligiblePositions: strings, playerClass: z.enum(["skater", "goalie"]),
  availability: z.enum(["free_agent", "waivers", "rostered", "manager_available", "unknown"]), ownership: finite.nullable(),
  canDrop: z.boolean().nullable(), holdValue: finite.nullable(), reserveEligibility: z.array(z.enum(["IR", "IR+", "NA"])) }).passthrough()).max(PLANNING_DATA_TRANSPORT_LIMITS.players),
  games: rows(z.object({ id: z.string(), teamAbbreviation: z.string(), opponent: z.string(), date: z.string(), startsAt: clock.nullable(),
    home: z.boolean(), status: z.enum(["scheduled", "live", "final", "postponed", "cancelled"]) }).passthrough()),
  forecasts: rows(z.object({ playerId: z.string(), gameId: z.string(), revisionId: z.string(), stats: z.record(finite.nullable()),
    allowedUses: uses.optional(), appearanceProbability: finite.min(0).max(1).nullable().optional(),
    powerPlayRole: powerPlayRole.optional(),
    startProbability: finite.min(0).max(1).nullable(), confirmedStart: z.boolean(), conditioning: z.literal("unconditional"),
    issuedAt: clock, cutoffAt: clock.optional(), expiresAt: clock.optional(), modelVersion: z.string().nullable(), limitations: strings,
    startParticipation: participant.optional() }).passthrough()),
  baselineSources: rows(source).optional(),
  participationSources: rows(z.unknown()).optional(), forecastManifest: z.object({ version: z.literal("planning-forecasts-v1"), id: z.string(),
    seasonId: positive, asOf: clock }).passthrough().optional(),
  evidence: z.record(z.object({ source: z.string(), asOf: clock.nullable(), seasonId: positive.nullable(),
    completeness: z.enum(["complete", "partial", "unknown"]), limitations: strings }).strict()),
  matchupWeeks: rows(z.object({ gameKey: z.string(), week: positive, startDate: z.string(), endDate: z.string() }).strict()).optional() }).strict();
const transportShape = z.object({ version: z.literal(PLANNING_DATA_TRANSPORT_VERSION), data: dataShape,
  catalogs: z.object({ models: z.array(model.omit({ inputHash: true, evidenceHashes: true })).max(PLANNING_DATA_TRANSPORT_LIMITS.catalog),
    hashes: strings.max(PLANNING_DATA_TRANSPORT_LIMITS.catalog) }).strict() }).strict();
function checkJson(value: unknown, depth = 0): void {
  if (depth > 32) throw new Error("depth");
  if (typeof value === "number" && !Number.isFinite(value)) throw new Error("finite");
  if (value && typeof value === "object") for (const [key, item] of Object.entries(value)) {
    if (["__proto__", "prototype", "constructor"].includes(key)) throw new Error("key");
    checkJson(item, depth + 1);
  }
}
function validateData(value: unknown, compressed = false) {
  checkJson(value); const data = dataShape.parse(value);
  if (new Set(data.players.map(row => row.id)).size !== data.players.length
    || new Set(data.games.map(row => `${row.id}:${row.teamAbbreviation}`)).size !== data.games.length) throw new Error("duplicate_identity");
  for (const receipt of data.participationSources ?? []) (compressed ? wireParticipant : participant).parse(receipt);
  return data;
}
function enforceBytes(data: unknown) {
  if (new TextEncoder().encode(JSON.stringify({ success: true, data })).byteLength > PLANNING_DATA_TRANSPORT_LIMITS.bytes) throw new PlanningDataTransportLimitError();
}
function intern<T>() {
  const values: T[] = [], indexes = new Map<string, number>();
  return { values, add(value: T) { const key = JSON.stringify(value), found = indexes.get(key); if (found !== undefined) return found;
    if (values.length >= PLANNING_DATA_TRANSPORT_LIMITS.catalog) throw new PlanningDataTransportLimitError();
    const id = values.length; values.push(value); indexes.set(key, id); return id; } };
}
/** Lossless serialization only: no forecast admission, filtering, or permission changes. */
export function encodePlanningDataTransport(data: PlanningData): PlanningDataTransport {
  validateData(data); const models = intern<ModelMetadata>(), hashes = intern<string>();
  const { participationSources, ...metadata } = data;
  const sources = participationSources?.map(({ model: proof, ...receipt }): WireParticipation => {
    if (!proof) return receipt;
    const { inputHash, evidenceHashes, ...metadata } = proof;
    return { ...receipt, model: [models.add(metadata), inputHash, evidenceHashes.map(hash => hashes.add(hash))] };
  });
  const result: PlanningDataTransport = { version: PLANNING_DATA_TRANSPORT_VERSION,
    data: { ...metadata, ...(sources === undefined ? {} : { participationSources: sources }) }, catalogs: { models: models.values, hashes: hashes.values } };
  enforceBytes(result); return result;
}
export function decodePlanningDataTransport(input: unknown): PlanningData {
  enforceBytes(input);
  try {
    checkJson(input);
    // Older cached responses have the same raw PlanningData contract; never
    // manufacture release flags, model fields, clocks or missing arrays.
    if (!input || typeof input !== "object" || !("version" in input)) return validateData(input) as PlanningData;
    const wire = transportShape.parse(input) as PlanningDataTransport; validateData(wire.data, true);
    const ref = <T>(catalog: T[], id: number) => { if (!Number.isSafeInteger(id) || id < 0 || id >= catalog.length) throw new Error("reference"); return catalog[id]; };
    const sources = wire.data.participationSources?.map(({ model: proof, ...receipt }): ContributionParticipation => !proof ? receipt : {
      ...receipt, model: { ...ref(wire.catalogs.models, proof[0]), inputHash: proof[1], evidenceHashes: proof[2].map(id => ref(wire.catalogs.hashes, id)) } });
    return validateData({ ...wire.data, ...(sources === undefined ? {} : { participationSources: sources }) }) as PlanningData;
  } catch { throw new Error("Invalid planning response. Please reload."); }
}
