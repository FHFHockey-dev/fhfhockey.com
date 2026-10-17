import { z } from "zod";
import type { GameExpectation, GameExpectationsResponse, GameExpectationTarget } from "./gameExpectations";

// A type-checked wire literal keeps server resolution code out of browser imports.
const GAME_EXPECTATIONS_VERSION: GameExpectationsResponse["version"] = "forge-game-expectations-v1";

export const GAME_EXPECTATION_VIEW_VERSION = "forge-game-expectations-view-v2" as const;
// Bound the complete envelope below the hosted payload ceiling; never omit rows.
export const GAME_EXPECTATION_VIEW_LIMITS = Object.freeze({ bytes: 4_000_000, players: 2048,
  playerGames: 50000, catalogEntries: 10000 });
export class GameExpectationViewLimitError extends Error {
  constructor() { super("This forecast window is too large to display. Choose a shorter window."); }
}
type Participation = NonNullable<GameExpectationTarget["participation"]>;
type DisplayParticipation = Omit<Participation, "model"> & {
  model?: Omit<NonNullable<Participation["model"]>, "inputHash" | "evidenceHashes">;
};
export type GameExpectationDisplayTarget = Omit<GameExpectationTarget, "participation"> & { participation: DisplayParticipation | null };
type DisplayGame = Omit<GameExpectation, "targets" | "startParticipation"> & {
  targets: Record<string, GameExpectationDisplayTarget>; startParticipation?: DisplayParticipation | null;
};
type Player = GameExpectationsResponse["players"][number];
export type GameExpectationDisplayResponse = Omit<GameExpectationsResponse, "players"> & {
  players: Array<Omit<Player, "games"> & { games: DisplayGame[] }>;
};
type Schedule = Pick<GameExpectation, "gameId" | "date" | "scheduledAt" | "team" | "opponent" | "homeTeam" | "awayTeam" | "scheduleRevision">;
type TargetMetadata = Omit<GameExpectationDisplayTarget, "sources" | "participation" | "participationRevisionId" | "limitations"> & {
  sources: number[]; limitations: number;
};
type Target = [metadata: number, participation: number | null, revision: number | null];
type Model = Omit<NonNullable<DisplayParticipation["model"]>, "limitations"> & { limitations: number };
type WireParticipation = Omit<DisplayParticipation, "model" | "revisionId"> & { revisionId: number; model?: number };
// References keep repeated per-game metadata out of the wire payload. All clocks
// and admission flags remain in the catalogs; no values are recomputed here.
type GameRef = [schedule: number, roster: number | null, appearance: number | null, start: number | null,
  role: number, limitations: number, targets: number, startParticipation: number | null | false];
export type GameExpectationView = Omit<GameExpectationsResponse, "version" | "players" | "limitations"> & {
  version: typeof GAME_EXPECTATION_VIEW_VERSION; sourceVersion: typeof GAME_EXPECTATIONS_VERSION;
  players: Array<Omit<Player, "games" | "totals" | "ratios"> & { games: GameRef[]; aggregate: number }>;
  limitations: number;
  catalogs: { schedules: Schedule[]; rosters: string[]; sources: GameExpectationTarget["sources"];
    participation: WireParticipation[]; models: Model[]; revisions: string[]; targetMetadata: TargetMetadata[]; targets: Target[]; targetSets: Array<Record<string, number>>;
    limitations: string[][]; roles: GameExpectation["powerPlayRole"][]; aggregates: Array<Pick<Player, "totals" | "ratios">> };
};
function intern<T>() {
  const values: T[] = [], indexes = new Map<string, number>();
  return { values, add(value: T) {
    const key = JSON.stringify(value), existing = indexes.get(key);
    if (existing !== undefined) return existing;
    if (values.length >= GAME_EXPECTATION_VIEW_LIMITS.catalogEntries) throw new GameExpectationViewLimitError();
    const index = values.length; values.push(value); indexes.set(key, index); return index;
  } };
}
function wireBytes(value: unknown) { return new TextEncoder().encode(JSON.stringify(value)).byteLength; }
function displayParticipation(value: Participation): DisplayParticipation {
  if (!value.model) return { ...value };
  const { inputHash: _inputHash, evidenceHashes: _evidenceHashes, ...model } = value.model;
  return { ...value, model };
}
/** Encode only an already-admitted shared response. This does not admit sources. */
export function buildGameExpectationView(response: GameExpectationsResponse): GameExpectationView {
  if (response.version !== GAME_EXPECTATIONS_VERSION) throw new Error("Unsupported shared forecast response.");
  if (response.players.length > GAME_EXPECTATION_VIEW_LIMITS.players
    || response.players.reduce((sum, player) => sum + player.games.length, 0) > GAME_EXPECTATION_VIEW_LIMITS.playerGames) {
    throw new GameExpectationViewLimitError();
  }
  const schedules = intern<Schedule>(), rosters = intern<string>(), sources = intern<GameExpectationTarget["sources"][number]>();
  const participation = intern<WireParticipation>(), models = intern<Model>(), revisions = intern<string>();
  const targetMetadata = intern<TargetMetadata>(), targets = intern<Target>(), targetSets = intern<Record<string, number>>();
  const limitations = intern<string[]>(), roles = intern<GameExpectation["powerPlayRole"]>(), aggregates = intern<Pick<Player, "totals" | "ratios">>();
  const participant = (value: Participation) => {
    const display = displayParticipation(value), { model, ...metadata } = display;
    return participation.add({ ...metadata, revisionId: revisions.add(display.revisionId),
      ...(model ? { model: models.add({ ...model, limitations: limitations.add(model.limitations) }) } : {}) });
  };
  const players = response.players.map(({ games, totals, ratios, ...player }) => ({ ...player,
    aggregate: aggregates.add({ totals, ratios }), games: games.map(game => {
      const { gameId, date, scheduledAt, team, opponent, homeTeam, awayTeam, scheduleRevision } = game;
      const set = Object.fromEntries(Object.entries(game.targets).map(([key, target]) => {
        const { participation: receipt, participationRevisionId, ...metadata } = target;
        return [key, targets.add([targetMetadata.add({ ...metadata, sources: target.sources.map(source => sources.add(source)),
          limitations: limitations.add(target.limitations) }), receipt ? participant(receipt) : null,
          participationRevisionId === null ? null : revisions.add(participationRevisionId)])];
      }));
      return [schedules.add({ gameId, date, scheduledAt, team, opponent, homeTeam, awayTeam, scheduleRevision }),
        game.rosterRevision === null ? null : rosters.add(game.rosterRevision), game.appearanceProbability, game.startProbability,
        roles.add(game.powerPlayRole), limitations.add(game.limitations), targetSets.add(set),
        game.startParticipation === undefined ? false : game.startParticipation === null ? null
          : participant(game.startParticipation)] as GameRef;
    }) }));
  const view: GameExpectationView = { ...response, version: GAME_EXPECTATION_VIEW_VERSION, sourceVersion: GAME_EXPECTATIONS_VERSION,
    players, limitations: limitations.add(response.limitations), catalogs: { schedules: schedules.values, rosters: rosters.values,
      sources: sources.values, participation: participation.values, models: models.values, revisions: revisions.values,
      targetMetadata: targetMetadata.values, targets: targets.values, targetSets: targetSets.values,
      limitations: limitations.values, roles: roles.values, aggregates: aggregates.values } };
  if (wireBytes({ success: true, data: view }) > GAME_EXPECTATION_VIEW_LIMITS.bytes) throw new GameExpectationViewLimitError();
  return view;
}

const index = z.number().int().nonnegative(), number = z.number().finite(), probability = number.min(0).max(1).nullable();
const clock = z.string().refine(value => Number.isFinite(Date.parse(value))), nullableClock = clock.nullable();
const strings = z.array(z.string()), uses = z.object({ assignment: z.boolean(), totals: z.boolean(), comparison: z.boolean(), conditionalTieBreak: z.boolean() }).strict();
const source = z.object({ sourceId: z.string(), kind: z.enum(["baseline", "detailed"]), methodVersion: z.string(),
  sourceWatermark: z.string(), cutoffAt: clock, issuedAt: clock, expiresAt: clock }).strict();
const model = z.object({ version: z.string(), event: z.enum(["positive_minutes", "official_starter"]),
  probabilityStatus: z.literal("uncalibrated_model"), calibration: z.literal("unavailable"), sampleSize: index.nullable(), limitations: index }).strict();
const participant = z.object({ revisionId: index, basis: z.enum(["appearance", "start"]), probability,
  cutoffAt: clock, issuedAt: clock, expiresAt: clock, model: index.optional() }).strict();
const targetMetadata = z.object({ expected: number.nullable(), conditional: number.nullable(), basis: z.string().nullable(), unit: z.enum(["count", "minutes"]),
  allowedUses: uses, sourceKind: z.enum(["baseline", "detailed", "blended"]).nullable(), sourceIds: strings, methodVersions: strings,
  sourceWatermarks: strings, cutoffAt: nullableClock, issuedAt: nullableClock, expiresAt: nullableClock, sources: z.array(index),
  reasons: strings, limitations: index }).strict();
const aggregate = z.object({ expected: number.nullable(), coveredSum: number.nullable(), coveredGames: index, requiredGames: index,
  unit: z.enum(["count", "minutes"]).nullable(), reason: z.string().nullable() }).strict();
const ratio = z.object({ value: number.nullable(), numerator: z.string(), denominator: z.string(),
  interpretation: z.literal("ratio_of_expected_totals"), reason: z.string().nullable() }).strict();
const catalog = <T extends z.ZodTypeAny>(schema: T) => z.array(schema).max(GAME_EXPECTATION_VIEW_LIMITS.catalogEntries);
const viewSchema = z.object({ version: z.literal(GAME_EXPECTATION_VIEW_VERSION), sourceVersion: z.literal(GAME_EXPECTATIONS_VERSION),
  readAsOf: clock, manifestId: z.string().nullable(), baselineChecksum: z.string().nullable(), limitations: index,
  scope: z.object({ seasonId: index, startDate: z.string(), endDate: z.string(), timeZone: z.string(), mode: z.enum(["calendar", "next_n"]),
    games: z.number().int().min(1).max(20), playerIds: strings.optional() }).strict(),
  players: z.array(z.object({ playerId: z.string(), nhlPlayerId: index.nullable(), teamId: index.nullable(), name: z.string(), team: z.string().nullable(),
    playerClass: z.enum(["skater", "goalie"]), positions: strings, scheduledOpportunities: index, requestedGames: index.nullable(),
    horizonComplete: z.boolean(), expectedAppearances: number.nullable(), expectedStarts: number.nullable(), aggregate: index,
    games: z.array(z.tuple([index, index.nullable(), probability, probability, index, index, index, z.union([index, z.null(), z.literal(false)])])) }).strict()).max(GAME_EXPECTATION_VIEW_LIMITS.players),
  catalogs: z.object({ schedules: catalog(z.object({ gameId: z.string(), date: z.string(), scheduledAt: clock, team: z.string(),
    opponent: z.string(), homeTeam: z.string(), awayTeam: z.string(), scheduleRevision: z.string() }).strict()), rosters: catalog(z.string()),
    sources: catalog(source), participation: catalog(participant), models: catalog(model), revisions: catalog(z.string()),
    targetMetadata: catalog(targetMetadata), targets: catalog(z.tuple([index, index.nullable(), index.nullable()])), targetSets: catalog(z.record(index)),
    limitations: catalog(strings), roles: catalog(z.object({ value: z.null(), source: z.null(), status: z.enum(["unavailable", "not_applicable"]),
      reason: z.enum(["current_role_evidence_unavailable", "not_applicable"]) }).strict()),
    aggregates: catalog(z.object({ totals: z.record(aggregate), ratios: z.record(ratio) }).strict()) }).strict() }).strict();
/** Decode a display contract, never a server-admission object with invented proofs. */
export function decodeGameExpectationView(input: unknown): GameExpectationDisplayResponse {
  if (wireBytes({ success: true, data: input }) > GAME_EXPECTATION_VIEW_LIMITS.bytes) throw new GameExpectationViewLimitError();
  try {
    const view = viewSchema.parse(input) as GameExpectationView, c = view.catalogs;
    if (view.players.reduce((sum, player) => sum + player.games.length, 0) > GAME_EXPECTATION_VIEW_LIMITS.playerGames
      || new Set(view.players.map(player => player.playerId)).size !== view.players.length) throw new Error("cardinality");
    const ref = <T>(values: T[], id: number): T => { if (!Number.isSafeInteger(id) || id < 0 || id >= values.length) throw new Error("reference"); return values[id]; };
    const decodedModels = c.models.map(value => ({ ...value, limitations: ref(c.limitations, value.limitations) }));
    const decodedParticipation = c.participation.map(value => ({ ...value, revisionId: ref(c.revisions, value.revisionId),
      ...(value.model === undefined ? {} : { model: ref(decodedModels, value.model) }) })) as DisplayParticipation[];
    const decodedMetadata = c.targetMetadata.map(value => ({ ...value, sources: value.sources.map(id => ref(c.sources, id)),
      limitations: ref(c.limitations, value.limitations) }));
    const decodedTargets = c.targets.map(value => ({ ...ref(decodedMetadata, value[0]),
      participation: value[1] === null ? null : ref(decodedParticipation, value[1]),
      participationRevisionId: value[2] === null ? null : ref(c.revisions, value[2]) }));
    const targetKeys = { skater: ["GOALS", "ASSISTS", "POINTS", "PP_POINTS", "SHOTS_ON_GOAL", "HITS", "BLOCKED_SHOTS", "PENALTY_MINUTES", "TIME_ON_ICE_PER_GAME"],
      goalie: ["SAVES_GOALIE", "GOALS_AGAINST_GOALIE", "SHOTS_AGAINST_GOALIE", "GOALIE_MINUTES", "WINS_GOALIE", "SHUTOUTS_GOALIE"] };
    const decodedSets = c.targetSets.map(set => Object.fromEntries(Object.entries(set).map(([key, id]) => {
      if (![...targetKeys.skater, ...targetKeys.goalie].includes(key)) throw new Error("target");
      return [key, ref(decodedTargets, id)];
    })));
    const { catalogs: _catalogs, sourceVersion, ...metadata } = view;
    return { ...metadata, version: sourceVersion, limitations: ref(c.limitations, view.limitations), players: view.players.map(player => {
      const { aggregate: aggregateId, games, ...identity } = player;
      if (new Set(games.map(game => ref(c.schedules, game[0]).gameId)).size !== games.length
        || player.scheduledOpportunities !== games.length) throw new Error("game_identity");
      const aggregate = ref(c.aggregates, aggregateId), requiredTotals = targetKeys[player.playerClass];
      const requiredRatios = player.playerClass === "goalie" ? ["SAVE_PERCENTAGE", "GOALS_AGAINST_AVERAGE"] : [];
      if (Object.keys(aggregate.totals).length !== requiredTotals.length
        || requiredTotals.some(key => !Object.prototype.hasOwnProperty.call(aggregate.totals, key))
        || Object.keys(aggregate.ratios).length !== requiredRatios.length
        || requiredRatios.some(key => !Object.prototype.hasOwnProperty.call(aggregate.ratios, key))) throw new Error("aggregate_targets");
      return { ...identity, ...aggregate, games: games.map(game => {
        const set = ref(decodedSets, game[6]), required = targetKeys[player.playerClass];
        if (Object.keys(set).length !== required.length || required.some(key => !Object.prototype.hasOwnProperty.call(set, key))) throw new Error("missing_target");
        return { ...ref(c.schedules, game[0]), rosterRevision: game[1] === null ? null : ref(c.rosters, game[1]),
          appearanceProbability: game[2], startProbability: game[3], powerPlayRole: ref(c.roles, game[4]),
          limitations: ref(c.limitations, game[5]), targets: set,
          ...(game[7] === false ? {} : { startParticipation: game[7] === null ? null : ref(decodedParticipation, game[7]) }) };
      }) };
    }) };
  } catch { throw new Error("Invalid forecast display response. Please reload."); }
}
