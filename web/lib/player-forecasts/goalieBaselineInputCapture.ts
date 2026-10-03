import type { SupabaseClient } from "@supabase/supabase-js";

import { baselineDefinitionHash, baselineProjectionSchemas, validBaselineSeasonId,
  type BaselineProjectionReceipt } from "./baselinePolicy";
import { discoverBaselineHistoricalGames, readBaselineBoxscores, readBaselineProjectionRows, readBounded,
  readStableCurrentInputs, readBaselineHistoricalManifests } from "./baselineInputCapture";
import { baselineAppearanceFromBoxscore, baselineProjectionFromRow, verifyBaselineBoxscoreReceipt,
  MissingBaselineBoxscoreError, baselineHistoricalSources, baselineHistoricalSourceLimitations,
  baselineProjectionSelectionReceipt, baselineProjectionSelectionLimitations, verifyBaselineProjectionSelection,
  verifyBaselineHistoricalSources, BASELINE_HISTORICAL_ROSTER_COLUMNS,
  type BaselineHistoricalSourceReceipt, type BaselineProjectionSelection, type BaselineProjectionSelectionReceipt } from "./baselineSourceLineage";
import type { GoalieAppearanceInput, GoalieProjectionInput } from "./goalieBaselineRates";
import { capturePlayerForecastSourceObservation, playerForecastSourcePayloadHash } from "./sourceSnapshot";

type GoalieRequest = { playerId: number; nhlPlayerId: number; teamId: number; rosterRevision: string };
export type CapturedGoalieInput = GoalieRequest & {
  sourceWatermark: string;
  definitionHash: string;
  limitations?: string[];
  historicalSources?: BaselineHistoricalSourceReceipt;
  projectionSelection?: BaselineProjectionSelectionReceipt;
  projectionSources: BaselineProjectionReceipt[];
  projections: GoalieProjectionInput[];
  appearances: GoalieAppearanceInput[];
};
const count = (value: unknown): number | null => value !== null && value !== undefined && value !== ""
  && Number.isFinite(Number(value)) && Number(value) >= 0 ? Number(value) : null;

/** Current read receipt only; it does not reconstruct a historical publication time. */
export async function captureCurrentGoalieBaselineInputs(args: {
  db: SupabaseClient<any>; seasonId: number; players: GoalieRequest[]; now?: () => Date;
  projectionSelection?: BaselineProjectionSelection;
}): Promise<{ basis: "captured_current"; capturedAt: string; cutoffAt: string;
  players: CapturedGoalieInput[]; limitations: string[] }> {
  if (typeof window !== "undefined") throw new Error("Goalie baseline capture is server-only.");
  if (!validBaselineSeasonId(args.seasonId) || args.players.length < 1 || args.players.length > 20
    || new Set(args.players.map((row) => row.playerId)).size !== args.players.length
    || new Set(args.players.map((row) => row.nhlPlayerId)).size !== args.players.length
    || args.players.some((row) => !Number.isSafeInteger(row.playerId) || row.playerId <= 0
      || !Number.isSafeInteger(row.nhlPlayerId) || row.nhlPlayerId <= 0
      || !Number.isSafeInteger(row.teamId) || row.teamId <= 0 || !row.rosterRevision.trim())) {
    throw new Error("Goalie capture requires one to 20 explicit canonical goalies.");
  }
  const clock = args.now ?? (() => new Date());
  const beganAt = clock();
  if (!Number.isFinite(beganAt.getTime())) throw new Error("Goalie capture clock is invalid.");
  const upperDate = beganAt.toISOString().slice(0, 10);
  const nhlIds = args.players.map((row) => row.nhlPlayerId);
  const deadlineMs = Date.now() + 120000;
  const sourceConfigs = baselineProjectionSchemas("goalie", args.seasonId);
  const definitionHash = baselineDefinitionHash("goalie", args.seasonId);
  const projectionSelectionIntent = args.projectionSelection ? structuredClone(args.projectionSelection) : undefined;
  const { projectionRows, histories, rosters, rawBoxscores, historicalSources, excludedNonRegularRosterRows } = await readStableCurrentInputs(async () => {
    const projectionRows = await readBaselineProjectionRows(args.db, sourceConfigs, nhlIds, projectionSelectionIntent, deadlineMs);
    const logs = await readBounded(args.db, "goaliesGameStats",
      "playerId,gameId,saveShotsAgainst,goalsAgainst,toi,games!inner(id,date,seasonId,type,startTime,homeTeamId,awayTeamId)",
      "gameId", "playerId", (query) => query.in("playerId", nhlIds)
        .in("games.seasonId", [args.seasonId - 10001, args.seasonId])
        .eq("games.type", 2).lte("games.date", upperDate), deadlineMs);
    const rosters = await readBounded(args.db, "nhl_api_game_roster_spots",
      BASELINE_HISTORICAL_ROSTER_COLUMNS.join(","), "game_id", "player_id",
      (query) => query.in("player_id", nhlIds)
        .in("season_id", [args.seasonId - 10001, args.seasonId]).lte("game_date", upperDate), deadlineMs);
    const { histories, excludedNonRegularRosterRows } = await discoverBaselineHistoricalGames(args.db, logs, rosters,
      { nhlIds, seasonId: args.seasonId, upperDate }, deadlineMs);
    const manifests = await readBaselineHistoricalManifests(args.db, histories, deadlineMs);
    const historicalSources = nhlIds.map(id => baselineHistoricalSources(histories, rosters, manifests,
      { nhlIds, seasonId: args.seasonId, upperDate }, id));
    const rawBoxscores = await readBaselineBoxscores(args.db, histories, beganAt.toISOString(), deadlineMs);
    return { projectionRows, histories, rosters, rawBoxscores, historicalSources, excludedNonRegularRosterRows };
  });
  const capturedAt = clock().toISOString();
  if (Date.parse(capturedAt) < beganAt.getTime() || capturedAt.slice(0, 10) !== upperDate) {
    throw new Error("Goalie capture crossed its UTC cutoff date; retry with a new cutoff.");
  }
  const rosterByGamePlayer = new Map(rosters.map((row) => [`${row.game_id}:${row.player_id}`, row]));
  const rawByGame = new Map(rawBoxscores.map(row => [Number(row.game_id), row]));
  let missingHistoricalTeams = 0;
  let normalizedDisagreements = 0;
  let recoveredAppearances = 0;
  const players = args.players.map((player): CapturedGoalieInput => {
    let playerMissingTeams = 0, playerRecovered = 0, playerDisagreements = 0;
    const historySources = historicalSources.find(row => row.nhlPlayerId === player.nhlPlayerId)!;
    const projectionSelection = baselineProjectionSelectionReceipt(projectionRows, player.nhlPlayerId,
      args.seasonId, projectionSelectionIntent);
    const projectionSources = projectionRows.map(({ schema, rows, status }) => ({
      sourceId: schema.id, tableName: schema.tableName, status,
      rowCount: rows.filter(row => Number(row.player_id) === player.nhlPlayerId).length,
    }));
    const projections = projectionRows.flatMap(({ schema, rows }) => {
      const sourceId = schema.id;
      const matching = rows.filter((row) => Number(row.player_id) === player.nhlPlayerId);
      if (matching.length > 1) throw new Error(`Ambiguous goalie projection row: ${sourceId}`);
      const row = matching[0];
      if (!row) return [];
      const captured = baselineProjectionFromRow(schema, row, args.seasonId, capturedAt, true);
      return captured ? [captured] : [];
    });
    const appearances = histories.flatMap((row) => {
      if (Number(row.playerId) !== player.nhlPlayerId || !row.games || Number(row.games.type) !== 2) return [];
      const roster = rosterByGamePlayer.get(`${row.gameId}:${player.nhlPlayerId}`);
      if (!roster || Number(roster.season_id) !== Number(row.games.seasonId)
        || roster.game_date !== row.games.date || !Number.isSafeInteger(Number(roster.team_id))) {
        playerMissingTeams += 1;
        return [];
      }
      const raw = rawByGame.get(Number(row.gameId));
      if (row.games.date === upperDate && (!raw || !["FINAL", "OFF"].includes(raw.payload?.gameState))) return [];
      if (!raw) throw new MissingBaselineBoxscoreError(Number(row.gameId), Number(row.games.seasonId), player.nhlPlayerId);
      const appearance = baselineAppearanceFromBoxscore({ rawRow: raw, game: row.games,
        nhlPlayerId: player.nhlPlayerId, teamId: Number(roster.team_id), cutoffAt: capturedAt, population: "goalie" });
      if (!appearance) return [];
      const match = /^(\d+)\/(\d+)$/.exec(String(row.saveShotsAgainst));
      const [minutes, seconds] = String(row.toi).split(":").map(Number);
      if (row.normalizedLogMissing) playerRecovered += 1;
      else if (!match || Number(match[1]) !== appearance.saves || Number(match[2]) !== appearance.shotsAgainst
        || count(row.goalsAgainst) !== appearance.goalsAgainst || minutes + seconds / 60 !== appearance.toiMinutes) {
        playerDisagreements += 1;
      }
      return [appearance];
    });
    missingHistoricalTeams += playerMissingTeams; recoveredAppearances += playerRecovered;
    normalizedDisagreements += playerDisagreements;
    const limitations = ["Current read receipt only; original projection publication and box-score correction times are unknown.",
      "Historical discovery covers captured roster/log sources; row counts do not establish source completeness.",
      ...baselineHistoricalSourceLimitations(historySources),
      ...baselineProjectionSelectionLimitations(projectionSelection),
      ...(playerMissingTeams ? [`Excluded ${playerMissingTeams} goalie appearances without verified historical team membership.`] : []),
      ...(playerRecovered ? [`Recovered ${playerRecovered} goalie appearances without normalized logs.`] : []),
      ...(playerDisagreements ? [`Retained boxscores supersede ${playerDisagreements} disagreeing normalized goalie rows.`] : [])];
    verifyBaselineHistoricalSources(historySources, appearances, player.nhlPlayerId, args.seasonId, capturedAt, limitations);
    verifyBaselineProjectionSelection(projectionSelection, projections, projectionSources,
      player.nhlPlayerId, args.seasonId, capturedAt, "goalie", limitations);
    const sourceWatermark = playerForecastSourcePayloadHash({ basis: "captured_current", capturedAt,
      playerId: player.playerId, nhlPlayerId: player.nhlPlayerId,
      teamId: player.teamId, rosterRevision: player.rosterRevision,
      definitionHash, projectionSources, projections, projectionSelection, appearances, historicalSources: historySources, limitations });
    return { ...player, definitionHash, projectionSources, sourceWatermark, projections, appearances,
      projectionSelection, historicalSources: historySources, limitations };
  });
  return { basis: "captured_current", capturedAt, cutoffAt: capturedAt, players,
    limitations: ["Current read receipt only; original projection publication and box-score correction times are unknown.",
      "Independent sources form a captured version set, not a transactional snapshot.",
      "Historical discovery covers captured roster/log sources; row counts do not establish source completeness.",
      ...(recoveredAppearances ? [`Recovered ${recoveredAppearances} goalie appearances without normalized logs.`] : []),
      ...(excludedNonRegularRosterRows ? [`Excluded ${excludedNonRegularRosterRows} non-regular-season roster opportunities.`] : []),
      ...(normalizedDisagreements ? [`Retained boxscores supersede ${normalizedDisagreements} disagreeing normalized goalie rows.`] : []),
      ...projectionRows.filter(row => row.status !== "available").map(row =>
        `Projection source ${row.schema.id} unavailable for ${args.seasonId}: ${row.status}.`),
      ...(missingHistoricalTeams ? [`Excluded ${missingHistoricalTeams} goalie appearances without verified historical team membership.`] : [])] };
}

export async function persistCapturedGoalieBaselineInputs(args: {
  db: SupabaseClient<any>; seasonId: number;
  capture: Pick<Awaited<ReturnType<typeof captureCurrentGoalieBaselineInputs>>,
    "basis" | "capturedAt" | "cutoffAt" | "players">;
  dryRun?: boolean;
}): Promise<{ dryRun: boolean; receipts: Array<{ playerId: number; payloadHash: string; inserted: boolean }> }> {
  if (typeof window !== "undefined") throw new Error("Goalie baseline input persistence is server-only.");
  const { capture } = args;
  if (!validBaselineSeasonId(args.seasonId)
    || capture.basis !== "captured_current" || capture.capturedAt !== capture.cutoffAt
    || !Number.isFinite(Date.parse(capture.capturedAt)) || !capture.players.length
    || capture.players.length > 20
    || new Set(capture.players.map(player => player.nhlPlayerId)).size !== capture.players.length) {
    throw new Error("Invalid current goalie capture receipt.");
  }
  const payloads = capture.players.map((player) => {
    const payload = { basis: capture.basis, capturedAt: capture.capturedAt,
      playerId: player.playerId, nhlPlayerId: player.nhlPlayerId,
      teamId: player.teamId, rosterRevision: player.rosterRevision,
      definitionHash: player.definitionHash, projectionSources: player.projectionSources,
      projections: player.projections, appearances: player.appearances,
      ...(player.projectionSelection ? { projectionSelection: player.projectionSelection } : {}),
      ...(player.historicalSources ? { historicalSources: player.historicalSources } : {}),
      ...(player.limitations ? { limitations: player.limitations } : {}) };
    const payloadHash = playerForecastSourcePayloadHash(payload);
    if (player.definitionHash !== baselineDefinitionHash("goalie", args.seasonId)) {
      throw new Error("Goalie capture candidate definition is missing or incompatible.");
    }
    for (const projection of player.projections) {
      const schema = baselineProjectionSchemas("goalie", args.seasonId).find(row => row.id === projection.sourceId);
      const derived = schema && projection.sourcePayload
        ? baselineProjectionFromRow(schema, projection.sourcePayload, args.seasonId, projection.availableAt, true) : null;
      if (!derived || Number(projection.sourcePayload?.player_id) !== player.nhlPlayerId
        || playerForecastSourcePayloadHash(derived) !== playerForecastSourcePayloadHash(projection)) {
        throw new Error("Goalie projection values are not bound to selected source content");
      }
    }
    for (const appearance of player.appearances) verifyBaselineBoxscoreReceipt(appearance, player.nhlPlayerId, capture.capturedAt, "goalie");
    verifyBaselineHistoricalSources(player.historicalSources, player.appearances,
      player.nhlPlayerId, args.seasonId, capture.capturedAt, player.limitations ?? []);
    verifyBaselineProjectionSelection(player.projectionSelection, player.projections, player.projectionSources,
      player.nhlPlayerId, args.seasonId, capture.capturedAt, "goalie", player.limitations ?? []);
    if (payloadHash !== player.sourceWatermark
      || [...player.projections, ...player.appearances].some((row) =>
        !Number.isFinite(Date.parse(row.availableAt))
        || Date.parse(row.availableAt) > Date.parse(capture.capturedAt))) {
      throw new Error("Goalie capture payload does not match its source watermark or receipt.");
    }
    return { playerId: player.playerId, payload, payloadHash };
  });
  if (new Set(payloads.map((row) => row.playerId)).size !== payloads.length) {
    throw new Error("Goalie capture contains duplicate canonical players.");
  }
  if (args.dryRun ?? true) return { dryRun: true,
    receipts: payloads.map((row) => ({ playerId: row.playerId, payloadHash: row.payloadHash, inserted: false })) };
  const receipts: Array<{ playerId: number; payloadHash: string; inserted: boolean }> = [];
  for (const row of payloads) {
    const result = await capturePlayerForecastSourceObservation({
      supabase: args.db, provider: "fhfh", datasetKey: "goalie-baseline-inputs-v1",
      entityKind: "player", entityKey: `${args.seasonId}:${row.playerId}`,
      sourceRevisionKey: row.payloadHash, observedAt: capture.capturedAt,
      availableAt: capture.capturedAt, payload: row.payload,
      metadata: { basis: capture.basis, seasonId: args.seasonId },
    });
    receipts.push({ playerId: row.playerId, payloadHash: result.payloadHash, inserted: result.inserted });
  }
  return { dryRun: false, receipts };
}
