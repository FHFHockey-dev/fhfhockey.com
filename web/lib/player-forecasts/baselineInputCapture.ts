import type { SupabaseClient } from "@supabase/supabase-js";

import { baselineDefinitionHash, baselineProjectionSchemas, unavailableProjectionTable,
  validBaselineSeasonId, type BaselineProjectionSchema, type BaselineProjectionReceipt } from "./baselinePolicy";
import type { CapturedBaselinePlayerInput } from "./baselineGeneration";
import { capturePlayerForecastSourceObservation, playerForecastSourcePayloadHash } from "./sourceSnapshot";
import { baselineAppearanceFromBoxscore, baselineHistoricalGameHash, baselineProjectionContentHash, baselineProjectionFromRow,
  validateBaselineHistoricalScope, verifyBaselineBoxscoreReceipt, MissingBaselineBoxscoreError,
  baselineHistoricalSources, baselineHistoricalSourceLimitations, verifyBaselineHistoricalSources,
  baselineProjectionSelectionReceipt, baselineProjectionSelectionLimitations, verifyBaselineProjectionSelection,
  BASELINE_NORMALIZATION_COLUMNS, BASELINE_HISTORICAL_ROSTER_COLUMNS,
  type BaselineProjectionSelection } from "./baselineSourceLineage";
import { parseTimeOnIceSeconds } from "./settlement";
import { acceptedNewsSupersedes } from "../projections/acceptedNews";
import { readForecastQuery } from "./scopeReads";

const PAGE_SIZE = 500;
const MAX_ROWS = 5000;
const MAX_PLAYERS = 20;

type PlayerRequest = { playerId: number; nhlPlayerId: number; teamId: number; rosterRevision: string };
type CaptureDb = SupabaseClient<any>;

/** Only an absent versioned table is an optional source; all other read failures reject. */
export async function readBaselineProjectionRows(db: CaptureDb,
  schemas: readonly BaselineProjectionSchema[], nhlIds: number[],
  selection?: BaselineProjectionSelection, deadlineMs = Date.now() + 8000) {
  const sources: Array<{ schema: BaselineProjectionSchema; rows: any[];
    status: BaselineProjectionReceipt["status"] }> = [];
  if (selection && Object.keys(selection).some(id => !schemas.some(schema => schema.id === id))) {
    throw new Error("Projection selection contains a source outside the pinned baseline policy");
  }
  for (const schema of schemas) {
    if (!schema.tableName) {
      sources.push({ schema, rows: [], status: "no_versioned_schema" });
      continue;
    }
    const columns = [...new Set(["player_id", "upload_batch_id", schema.appearanceColumn,
      ...(schema.startColumn ? [schema.startColumn] : []),
      ...schema.statMappings.map(mapping => mapping.dbColumnName)])].join(",");
    const selected = selection?.[schema.id];
    if (selected && Object.entries(selected).some(([id, row]) => !nhlIds.includes(Number(id))
      || !row.rowId?.trim() || !/^[a-f0-9]{64}$/.test(row.contentHash))) throw new Error("Invalid baseline projection selection");
    const { data, error, count } = await readForecastQuery<any>(deadlineMs, signal => {
      let query = db.from(schema.tableName!).select(columns, { count: "exact" }).in("player_id", nhlIds);
      if (selected) query = query.in("upload_batch_id", Object.values(selected).map(row => row.rowId));
      query = query.order("player_id").order("upload_batch_id").limit(MAX_PLAYERS + 1);
      return typeof query.abortSignal === "function" ? query.abortSignal(signal) : query;
    });
    if (unavailableProjectionTable(error)) {
      sources.push({ schema, rows: [], status: "table_unavailable" });
      continue;
    }
    if (error || !Array.isArray(data) || !Number.isSafeInteger(count) || count! < 0
      || count! > MAX_PLAYERS || data.length !== count) {
      throw new Error(`Baseline projection capture incomplete: ${schema.id}`);
    }
    if (selected && (data.length !== Object.keys(selected).length || data.some(row => {
      const wanted = selected[Number(row.player_id)];
      return !wanted || String(row.upload_batch_id) !== wanted.rowId
        || baselineProjectionContentHash(schema, row) !== wanted.contentHash;
    }))) throw new Error("Selected baseline projection version is missing or changed");
    sources.push({ schema, rows: data, status: "available" });
  }
  return sources;
}

export async function readBounded(db: CaptureDb, table: string, select: string,
  orderColumn: string, tieColumn: string, configure: (query: any) => any,
  deadlineMs = Date.now() + 8000): Promise<any[]> {
  const rows: any[] = [];
  let expectedCount: number | null = null;
  for (;;) {
    const offset = rows.length;
    const query = configure(db.from(table).select(select, { count: "exact" })).order(orderColumn, { ascending: false })
      .order(tieColumn, { ascending: true })
      .range(offset, offset + PAGE_SIZE - 1);
    const { data, error, count } = await readForecastQuery<any>(deadlineMs, signal =>
      typeof query.abortSignal === "function" ? query.abortSignal(signal) : query);
    if (error || !Array.isArray(data) || !Number.isSafeInteger(count) || count < 0
      || expectedCount !== null && count !== expectedCount || data.length > PAGE_SIZE
      || offset + data.length > count || !data.length && offset < count) {
      throw new Error(`Baseline capture read failed or changed during pagination: ${table}`);
    }
    if (count > MAX_ROWS) throw new Error(`Baseline capture exceeded ${MAX_ROWS} ${table} rows.`);
    expectedCount = count;
    rows.push(...data);
    if (rows.length === count) return rows;
  }
}

/** Logs are diagnostics; historical roster opportunities independently discover appearances. */
export async function discoverBaselineHistoricalGames(db: CaptureDb, histories: Record<string, any>[],
  rosters: Record<string, any>[], scope: { nhlIds: number[]; seasonId: number; upperDate: string }, deadlineMs: number) {
  validateBaselineHistoricalScope(histories, rosters, scope);
  const games = new Map<number, Record<string, any>>(histories.map(row => [row.gameId, row.games]));
  const missingIds = [...new Set(rosters.map(row => row.game_id).filter(id => !games.has(id)))].sort((a, b) => a - b);
  if (games.size + missingIds.length > 3000) throw new Error("Baseline historical game scope exceeds 3000 games");
  for (let offset = 0; offset < missingIds.length; offset += 100) {
    const batch = missingIds.slice(offset, offset + 100);
    const rows = await readBounded(db, "games", "id,date,seasonId,type,startTime,homeTeamId,awayTeamId",
      "id", "id", query => query.in("id", batch), deadlineMs);
    if (rows.length !== batch.length || new Set(rows.map(row => row.id)).size !== rows.length
      || rows.some(row => !batch.includes(row.id))) throw new Error("Baseline historical canonical game scope is incomplete");
    for (const game of rows) {
      baselineHistoricalGameHash(game, scope);
      games.set(game.id, game);
    }
  }
  const discovered = [...histories], known = new Set(histories.map(row => `${row.gameId}:${row.playerId}`));
  let excludedNonRegularRosterRows = 0;
  for (const roster of rosters) {
    const game = games.get(roster.game_id)!;
    if (roster.season_id !== game.seasonId || roster.game_date !== game.date
      || ![game.homeTeamId, game.awayTeamId].includes(roster.team_id)) {
      throw new Error("Baseline historical roster context conflicts with its canonical game");
    }
    if (game.type !== 2) { excludedNonRegularRosterRows += 1; continue; }
    const key = `${roster.game_id}:${roster.player_id}`;
    if (!known.has(key)) {
      discovered.push({ gameId: roster.game_id, playerId: roster.player_id, games: game, normalizedLogMissing: true });
      known.add(key);
    }
  }
  return { histories: discovered, excludedNonRegularRosterRows };
}

/** Read only known historical games; missing manifests remain explicit, never a completeness claim. */
export async function readBaselineHistoricalManifests(db: CaptureDb, histories: Record<string, any>[], deadlineMs: number) {
  const gameIds = [...new Set(histories.map(row => row.gameId))].sort((a, b) => a - b);
  if (gameIds.length > 3000) throw new Error("Baseline historical manifest scope exceeds 3000 games");
  const manifests: Record<string, any>[] = [];
  for (let offset = 0; offset < gameIds.length; offset += 100) {
    const batch = gameIds.slice(offset, offset + 100);
    const rows = await readBounded(db, "nhl_api_game_normalization_status", BASELINE_NORMALIZATION_COLUMNS.join(","),
      "game_id", "game_id", query => query.in("game_id", batch), deadlineMs);
    if (new Set(rows.map(row => row.game_id)).size !== rows.length || rows.some(row => !batch.includes(row.game_id))) {
      throw new Error("Baseline historical manifest read is duplicated or outside its scope");
    }
    manifests.push(...rows);
  }
  return manifests;
}

/** Discover latest metadata first; retrieve each selected payload once, in bounded batches. */
export async function readBaselineBoxscores(db: CaptureDb, histories: any[], cutoffAt: string, deadlineMs: number) {
  const gameIds = [...new Set(histories.map(row => Number(row.gameId)).filter(Number.isSafeInteger))].sort((a, b) => a - b);
  if (gameIds.length > 3000) throw new Error("Baseline boxscore scope exceeds 3000 games");
  const latest = new Map<number, any>();
  const seen = new Set<number>();
  let metadataCount = 0;
  for (let offset = 0; offset < gameIds.length; offset += 100) {
    const batch = gameIds.slice(offset, offset + 100);
    const rows = await readBounded(db, "nhl_api_game_payloads_raw",
      "id,game_id,season_id,payload_hash,fetched_at", "fetched_at", "id",
      query => query.in("game_id", batch).eq("endpoint", "boxscore").lte("fetched_at", cutoffAt), deadlineMs);
    metadataCount += rows.length;
    if (metadataCount > 100000) throw new Error("Baseline boxscore metadata scope exceeds 100000 rows");
    for (const row of rows) {
      const id = Number(row.id), gameId = Number(row.game_id);
      if (!Number.isSafeInteger(id) || id <= 0 || seen.has(id) || !batch.includes(gameId)
        || !/^[a-f0-9]{64}$/i.test(String(row.payload_hash)) || acceptedNewsSupersedes(row.fetched_at, cutoffAt)) {
        throw new Error("Baseline boxscore metadata identity/cutoff is inconsistent");
      }
      seen.add(id);
      const prior = latest.get(gameId);
      if (!prior || acceptedNewsSupersedes(row.fetched_at, prior.fetched_at)) latest.set(gameId, row);
      else if (!acceptedNewsSupersedes(prior.fetched_at, row.fetched_at)
        && prior.payload_hash !== row.payload_hash) throw new Error("Conflicting baseline boxscore versions at one timestamp");
    }
  }
  const ids = [...latest.values()].map(row => Number(row.id)).sort((a, b) => a - b);
  const payloads: any[] = [];
  const payloadIds = new Set<number>();
  for (let offset = 0; offset < ids.length; offset += 50) {
    const batch = ids.slice(offset, offset + 50);
    const rows = await readBounded(db, "nhl_api_game_payloads_raw",
      "id,game_id,season_id,payload_hash,payload,fetched_at", "id", "id",
      query => query.in("id", batch).eq("endpoint", "boxscore"), deadlineMs);
    if (rows.length !== batch.length) throw new Error("Selected baseline boxscore payloads are incomplete");
    for (const row of rows) {
      const prior = latest.get(Number(row.game_id));
      if (!batch.includes(Number(row.id)) || payloadIds.has(Number(row.id)) || !prior
        || Number(row.id) !== Number(prior.id) || row.fetched_at !== prior.fetched_at
        || row.payload_hash !== prior.payload_hash || Number(row.season_id) !== Number(prior.season_id)) {
        throw new Error("Selected baseline boxscore version changed during reads");
      }
      payloadIds.add(Number(row.id)); payloads.push(row);
    }
  }
  return payloads;
}

/** A changing source cannot be represented by one current-capture receipt. */
export async function readStableCurrentInputs<T>(read: () => Promise<T>): Promise<T> {
  const first = await read();
  const firstHash = playerForecastSourcePayloadHash(first);
  const second = await read();
  if (firstHash !== playerForecastSourcePayloadHash(second)) {
    throw new Error("Baseline capture changed during reads; retry with a new cutoff.");
  }
  return second;
}


const finite = (value: unknown): number | null => value !== null && value !== undefined && value !== ""
  && Number.isFinite(Number(value)) ? Number(value) : null;

/** Read only a bounded current snapshot; the receipt is captured after all reads finish. */
export async function captureCurrentSkaterBaselineInputs(args: {
  db: CaptureDb;
  seasonId: number;
  players: PlayerRequest[];
  projectionSelection?: BaselineProjectionSelection;
  now?: () => Date;
}): Promise<{
  basis: "captured_current";
  capturedAt: string;
  cutoffAt: string;
  players: CapturedBaselinePlayerInput[];
  limitations: string[];
}> {
  if (typeof window !== "undefined") throw new Error("Baseline input capture is server-only.");
  const { db, seasonId } = args;
  if (!validBaselineSeasonId(seasonId)
    || args.players.length < 1 || args.players.length > MAX_PLAYERS
    || new Set(args.players.map((player) => player.playerId)).size !== args.players.length
    || new Set(args.players.map((player) => player.nhlPlayerId)).size !== args.players.length
    || args.players.some((player) => !Number.isSafeInteger(player.playerId) || player.playerId <= 0
      || !Number.isSafeInteger(player.nhlPlayerId) || player.nhlPlayerId <= 0
      || !Number.isSafeInteger(player.teamId) || player.teamId <= 0 || !player.rosterRevision.trim())) {
    throw new Error("Baseline capture requires one to 20 explicit canonical skaters.");
  }
  const clock = args.now ?? (() => new Date());
  const beganAt = clock();
  if (!Number.isFinite(beganAt.getTime())) throw new Error("Baseline capture clock is invalid.");
  const upperDate = beganAt.toISOString().slice(0, 10);
  const nhlIds = args.players.map((player) => player.nhlPlayerId);
  const deadlineMs = Date.now() + 120000;
  const sourceConfigs = baselineProjectionSchemas("skater", seasonId);
  const definitionHash = baselineDefinitionHash("skater", seasonId);
  const projectionSelectionIntent = args.projectionSelection ? structuredClone(args.projectionSelection) : undefined;

  const { projectionRows, histories, rosterRows, rawBoxscores, historicalSources, excludedNonRegularRosterRows } = await readStableCurrentInputs(async () => {
    const projectionRows = await readBaselineProjectionRows(db, sourceConfigs, nhlIds, projectionSelectionIntent, deadlineMs);
    const logs = await readBounded(db, "skatersGameStats",
      "playerId,gameId,goals,assists,points,plusMinus,pim,hits,blockedShots,powerPlayGoals,powerPlayPoints,shorthandedGoals,shPoints,shots,faceoffs,toi,games!inner(id,date,seasonId,type,startTime,homeTeamId,awayTeamId)",
      "gameId", "playerId",
      (query) => query.in("playerId", nhlIds).in("games.seasonId", [seasonId - 10001, seasonId])
        .eq("games.type", 2).lte("games.date", upperDate), deadlineMs);
    const rosterRows = await readBounded(db, "nhl_api_game_roster_spots",
      BASELINE_HISTORICAL_ROSTER_COLUMNS.join(","),
      "game_id", "player_id",
      (query) => query.in("player_id", nhlIds).in("season_id", [seasonId - 10001, seasonId])
        .lte("game_date", upperDate), deadlineMs);
    const { histories, excludedNonRegularRosterRows } = await discoverBaselineHistoricalGames(db, logs, rosterRows,
      { nhlIds, seasonId, upperDate }, deadlineMs);
    const manifests = await readBaselineHistoricalManifests(db, histories, deadlineMs);
    const historicalSources = nhlIds.map(id => baselineHistoricalSources(histories, rosterRows, manifests,
      { nhlIds, seasonId, upperDate }, id));
    const rawBoxscores = await readBaselineBoxscores(db, histories, beganAt.toISOString(), deadlineMs);
    return { projectionRows, histories, rosterRows, rawBoxscores, historicalSources, excludedNonRegularRosterRows };
  });
  const capturedAt = clock().toISOString();
  if (Date.parse(capturedAt) < beganAt.getTime() || capturedAt.slice(0, 10) !== upperDate) {
    throw new Error("Baseline capture crossed its UTC cutoff date; retry with a new cutoff.");
  }
  const rosterByGamePlayer = new Map(rosterRows.map((row) => [`${row.game_id}:${row.player_id}`, row]));
  const rawByGame = new Map(rawBoxscores.map(row => [Number(row.game_id), row]));
  let missingHistoricalTeams = 0;
  let normalizedDisagreements = 0;
  let recoveredAppearances = 0;
  const players = args.players.map((player): CapturedBaselinePlayerInput => {
    let playerMissingTeams = 0, playerRecovered = 0, playerDisagreements = 0;
    const historySources = historicalSources.find(row => row.nhlPlayerId === player.nhlPlayerId)!;
    const projectionSelection = baselineProjectionSelectionReceipt(projectionRows, player.nhlPlayerId,
      seasonId, projectionSelectionIntent);
    const projectionSources = projectionRows.map(({ schema, rows, status }) => ({
      sourceId: schema.id, tableName: schema.tableName, status,
      rowCount: rows.filter(row => Number(row.player_id) === player.nhlPlayerId).length,
    }));
    const projections = projectionRows.flatMap(({ schema, rows }) => {
      const sourceId = schema.id;
      const matching = rows.filter((row) => Number(row.player_id) === player.nhlPlayerId);
      if (matching.length > 1) throw new Error(`Ambiguous baseline projection row: ${sourceId}`);
      const row = matching[0];
      if (!row) return [];
      const captured = baselineProjectionFromRow(schema, row, seasonId, capturedAt);
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
        nhlPlayerId: player.nhlPlayerId, teamId: Number(roster.team_id), cutoffAt: capturedAt, population: "skater" });
      if (!appearance) return [];
      const normalized: Record<string, number | null> = { GOALS: finite(row.goals), ASSISTS: finite(row.assists),
        POINTS: finite(row.points), PLUS_MINUS: finite(row.plusMinus), HITS: finite(row.hits),
        BLOCKED_SHOTS: finite(row.blockedShots), PENALTY_MINUTES: finite(row.pim), SHOTS_ON_GOAL: finite(row.shots),
        PP_GOALS: finite(row.powerPlayGoals), PP_POINTS: finite(row.powerPlayPoints), SH_GOALS: finite(row.shorthandedGoals),
        SH_POINTS: finite(row.shPoints) };
      if (row.normalizedLogMissing) playerRecovered += 1;
      else if (parseTimeOnIceSeconds(row.toi) !== (appearance.finalBoxscore as any).appearanceSeconds
        || Object.entries(normalized).some(([key, value]) => value != null
          && appearance.targets[key] != null && value !== appearance.targets[key])) playerDisagreements += 1;
      return [appearance];
    });
    missingHistoricalTeams += playerMissingTeams; recoveredAppearances += playerRecovered;
    normalizedDisagreements += playerDisagreements;
    const limitations = ["Current read receipt only; original projection publication and box-score correction times are unknown.",
      "Historical discovery covers captured roster/log sources; row counts do not establish source completeness.",
      ...baselineHistoricalSourceLimitations(historySources),
      ...baselineProjectionSelectionLimitations(projectionSelection),
      ...(playerMissingTeams ? [`Excluded ${playerMissingTeams} appearances without verified historical team membership.`] : []),
      ...(playerRecovered ? [`Recovered ${playerRecovered} appearances without normalized logs.`] : []),
      ...(playerDisagreements ? [`Retained boxscores supersede ${playerDisagreements} disagreeing normalized appearance rows.`] : [])];
    verifyBaselineHistoricalSources(historySources, appearances, player.nhlPlayerId, seasonId, capturedAt, limitations);
    verifyBaselineProjectionSelection(projectionSelection, projections, projectionSources,
      player.nhlPlayerId, seasonId, capturedAt, "skater", limitations);
    const sourceWatermark = playerForecastSourcePayloadHash({ basis: "captured_current",
      capturedAt, playerId: player.playerId, nhlPlayerId: player.nhlPlayerId,
      teamId: player.teamId, rosterRevision: player.rosterRevision,
      definitionHash, projectionSources, projections, projectionSelection, appearances, historicalSources: historySources, limitations });
    return { ...player, definitionHash, projectionSources, sourceWatermark, projections, appearances,
      projectionSelection, historicalSources: historySources, limitations };
  });
  return { basis: "captured_current", capturedAt, cutoffAt: capturedAt, players,
    limitations: ["Current read receipt only; original projection publication and box-score correction times are unknown.",
      "Observations use retained boxscore components only; unsupported PP/SH/faceoff components remain missing.",
      "Independent sources form a captured version set, not a transactional snapshot.",
      "Historical discovery covers captured roster/log sources; row counts do not establish source completeness.",
      ...(recoveredAppearances ? [`Recovered ${recoveredAppearances} appearances without normalized logs.`] : []),
      ...(excludedNonRegularRosterRows ? [`Excluded ${excludedNonRegularRosterRows} non-regular-season roster opportunities.`] : []),
      ...(normalizedDisagreements ? [`Retained boxscores supersede ${normalizedDisagreements} disagreeing normalized appearance rows.`] : []),
      ...projectionRows.filter(row => row.status !== "available").map(row =>
        `Projection source ${row.schema.id} unavailable for ${seasonId}: ${row.status}.`),
      ...(missingHistoricalTeams ? [`Excluded ${missingHistoricalTeams} appearances without verified historical team membership.`] : [])] };
}

/** Immutable captured inputs may be persisted only through an explicit non-dry-run call. */
export async function persistCapturedBaselineInputs(args: {
  db: CaptureDb;
  seasonId: number;
  capture: Awaited<ReturnType<typeof captureCurrentSkaterBaselineInputs>>;
  dryRun?: boolean;
}): Promise<{ dryRun: boolean; receipts: Array<{ playerId: number; payloadHash: string; inserted: boolean }> }> {
  if (typeof window !== "undefined") throw new Error("Baseline input persistence is server-only.");
  const { capture } = args;
  if (!validBaselineSeasonId(args.seasonId)
    || capture.basis !== "captured_current" || capture.capturedAt !== capture.cutoffAt
    || !Number.isFinite(Date.parse(capture.capturedAt)) || !capture.players.length
    || capture.players.length > MAX_PLAYERS
    || new Set(capture.players.map(player => player.nhlPlayerId)).size !== capture.players.length) {
    throw new Error("Invalid current baseline capture receipt.");
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
    if (player.definitionHash !== baselineDefinitionHash("skater", args.seasonId)) {
      throw new Error("Baseline capture candidate definition is missing or incompatible.");
    }
    for (const projection of player.projections) {
      const schema = baselineProjectionSchemas("skater", args.seasonId).find(row => row.id === projection.sourceId);
      const derived = schema && projection.sourcePayload
        ? baselineProjectionFromRow(schema, projection.sourcePayload, args.seasonId, projection.availableAt) : null;
      if (!derived || Number(projection.sourcePayload?.player_id) !== player.nhlPlayerId
        || playerForecastSourcePayloadHash(derived) !== playerForecastSourcePayloadHash(projection)) {
        throw new Error("Baseline projection values are not bound to selected source content");
      }
    }
    for (const appearance of player.appearances) verifyBaselineBoxscoreReceipt(appearance, player.nhlPlayerId, capture.capturedAt, "skater");
    verifyBaselineHistoricalSources(player.historicalSources, player.appearances,
      player.nhlPlayerId, args.seasonId, capture.capturedAt, player.limitations ?? []);
    verifyBaselineProjectionSelection(player.projectionSelection, player.projections, player.projectionSources,
      player.nhlPlayerId, args.seasonId, capture.capturedAt, "skater", player.limitations ?? []);
    if (payloadHash !== player.sourceWatermark
      || [...player.projections, ...player.appearances].some((row) =>
        !Number.isFinite(Date.parse(row.availableAt))
        || Date.parse(row.availableAt) > Date.parse(capture.capturedAt))) {
      throw new Error("Baseline capture payload does not match its source watermark or receipt.");
    }
    return { playerId: player.playerId, payload, payloadHash };
  });
  if (new Set(payloads.map((row) => row.playerId)).size !== payloads.length) {
    throw new Error("Baseline capture contains duplicate canonical players.");
  }
  if (args.dryRun ?? true) return { dryRun: true,
    receipts: payloads.map((row) => ({ playerId: row.playerId, payloadHash: row.payloadHash, inserted: false })) };
  const receipts: Array<{ playerId: number; payloadHash: string; inserted: boolean }> = [];
  for (const row of payloads) {
    const result = await capturePlayerForecastSourceObservation({
      supabase: args.db, provider: "fhfh", datasetKey: "baseline-inputs-v1",
      entityKind: "player", entityKey: `${args.seasonId}:${row.playerId}`,
      sourceRevisionKey: row.payloadHash, observedAt: capture.capturedAt,
      availableAt: capture.capturedAt, payload: row.payload,
      metadata: { basis: capture.basis, seasonId: args.seasonId },
    });
    receipts.push({ playerId: row.playerId, payloadHash: result.payloadHash, inserted: result.inserted });
  }
  return { dryRun: false, receipts };
}
