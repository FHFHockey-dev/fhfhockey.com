import {
  buildAggregatedPlayers, fetchScopedCardStats, normalizeAggregateRows,
  type AggregateReductionScope, type AggregatedMatrixPlayers, type FetchAggregatedDataRequest, type ShiftChartRow,
} from "components/DateRangeMatrix/fetchAggregatedData";
import { teamsInfo } from "lib/teamsInfo";
import { fetchAllSupabasePages } from "lib/supabase/pagination";
import { PROJECTION_INPUT_MATERIALIZER_VERSION } from "lib/projections/ingest/projectionInputPersistence";
import { SHIFT_RELATIONSHIP_ALGORITHM_VERSION } from "lib/projections/relationshipMaterialization";
import { getRelationshipPlayerType, normalizeRelationshipPrimaryPosition } from "lib/projections/relationshipPlayerPosition";
import { calculateCompletedGameLengthSeconds } from "lib/projections/gameLength";
import { analyzeDeploymentGame, type DeploymentAnalysis, type DeploymentShiftRow, type MatrixStrength } from "./observedDeployment";
import type { DeploymentMatrixResponse, MatrixGameCoverage, WireMatrixPlayer } from "./types";

type Row = Record<string, any>;
type DatabaseReader = { from(table: string): any };
const strengths: MatrixStrength[] = ["all", "fiveOnFive", "otherEs", "pp", "pk"];
const HASH = /^[a-f0-9]{64}$/;
const MANIFEST_FIELDS = "game_id,input_status,input_fingerprint,input_version,input_materializer_version,pbp_raw_payload_id,pbp_raw_payload_hash,pbp_raw_snapshot_version,shift_raw_payload_id,shift_raw_payload_hash,shift_raw_snapshot_version,expected_strength_rows,observed_strength_rows,relationship_status,relationship_input_fingerprint,relationship_fingerprint,relationship_version,relationship_algorithm_version,expected_relationship_rows,observed_relationship_rows";
const HEAD_FIELDS = "game_id,endpoint,raw_payload_id,payload_hash,snapshot_version";
const ROW_FIELDS = "id,game_id,game_type,game_date,season_id,player_id,player_first_name,player_last_name,team_id,team_abbreviation,opponent_team_id,opponent_team_abbreviation,home_or_away,game_toi,game_length,total_es_toi,total_pp_toi,total_pk_toi,primary_position,display_position,player_type,line_combination,pairing_combination,time_spent_with,time_spent_with_mixed,shifts,pp_shifts,es_shifts";
const positive = (value: unknown): value is number => typeof value === "number" && Number.isSafeInteger(value) && value > 0;
const date = (value: unknown): value is string => typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value) &&
  Number.isFinite(Date.parse(`${value}T00:00:00Z`)) && new Date(`${value}T00:00:00Z`).toISOString().slice(0, 10) === value;

export class MatrixScopeError extends Error {}

export function validateMatrixRequest(request: FetchAggregatedDataRequest) {
  if (!positive(request.teamId) || !positive(request.seasonId) || !date(request.startDate) || !date(request.endDate) ||
    request.startDate > request.endDate || !["regularSeason", "playoffs"].includes(request.seasonType) ||
    ![undefined, "", "home", "away"].includes(request.homeOrAway) ||
    request.opponentTeamAbbreviation != null && typeof request.opponentTeamAbbreviation !== "string") {
    throw new MatrixScopeError("Select a valid team, season and inclusive date range.");
  }
  const team = Object.entries(teamsInfo).find(([, entry]) => entry.id === request.teamId);
  const opponent = request.opponentTeamAbbreviation?.trim().toUpperCase() || null;
  if (!team || opponent && !teamsInfo[opponent]) throw new MatrixScopeError("Select a recognized team and opponent.");
  if (request.gameIds && (!Array.isArray(request.gameIds) || !request.gameIds.length || request.gameIds.length > 200 || request.gameIds.some(id => !positive(id)))) {
    throw new MatrixScopeError("Invalid game scope.");
  }
  return { team, opponent, gameType: request.seasonType === "regularSeason" ? 2 : 3 } as const;
}

async function boundedRows(query: (from: number, to: number) => any, max: number) {
  const rows = await fetchAllSupabasePages<Row>(({ from, to }) => query(from, to), { limit: max + 1 });
  if (rows.length > max) throw new MatrixScopeError("This selection is too large; choose a narrower date range.");
  return rows;
}
function uniqueBy(rows: Row[], key: (row: Row) => string | number) {
  const map = new Map<string | number, Row>();
  for (const row of rows) {
    const id = key(row);
    if (map.has(id)) throw new Error("Duplicate source identity in matrix data");
    map.set(id, row);
  }
  return map;
}
const identity = (row: Row | undefined, fields: string) => row == null ? null : JSON.stringify(fields.split(",").map(key => row[key] ?? null));

function verifiedZeroToiPlayers(game: Row, roster: Map<string | number, Row>, head: Row | undefined,
  afterHead: Row | undefined, source: Row | undefined): Set<number> {
  const none = new Set<number>();
  if (!head || !positive(head.raw_payload_id) || !positive(head.snapshot_version) || !HASH.test(head.payload_hash ?? "") ||
    identity(head, HEAD_FIELDS) !== identity(afterHead, HEAD_FIELDS) || !source || source.id !== head.raw_payload_id ||
    source.game_id !== game.id || source.endpoint !== "boxscore" || source.payload_hash !== head.payload_hash ||
    Number(source.source_game_id) !== game.id || source.source_date !== game.date || Number(source.source_season) !== game.seasonId ||
    Number(source.source_game_type) !== game.type || Number(source.home_id) !== game.homeTeamId || Number(source.away_id) !== game.awayTeamId ||
    !["FINAL", "OFF"].includes(source.game_state)) return none;
  const players: Row[] = [];
  for (const [side, teamId] of [["homeTeam", game.homeTeamId], ["awayTeam", game.awayTeamId]] as const) {
    const groups = source.player_stats?.[side];
    for (const group of ["forwards", "defense", "goalies"]) {
      if (!Array.isArray(groups?.[group])) return none;
      for (const player of groups[group]) {
        if (!player || !positive(player.playerId)) return none;
        players.push({ ...player, teamId });
      }
    }
  }
  if (new Set(players.map(player => player.playerId)).size !== players.length) return none;
  const byId = new Map(players.map(player => [player.playerId, player]));
  // A truncated or mismatched final boxscore cannot establish nonparticipation.
  for (const member of roster.values()) {
    const player = byId.get(member.player_id);
    if (!player || player.teamId !== member.team_id || player.sweaterNumber !== member.sweater_number ||
      normalizeRelationshipPrimaryPosition(player.position) !== normalizeRelationshipPrimaryPosition(member.position_code)) return none;
  }
  return new Set(players.filter(player => ["0:00", "00:00"].includes(player.toi) && player.shifts === 0 &&
    ["goals", "assists", "points", "sog", "hits", "blockedShots", "takeaways", "giveaways"].every(field => player[field] === 0))
    .map(player => player.playerId));
}

function generationProblem(manifest: Row | undefined, heads: Map<string | number, Row>, gameId: number): string | null {
  if (!manifest || manifest.input_status !== "complete") return "Qualified game inputs are missing or pending.";
  if (manifest.relationship_status !== "complete") return "Shared-time calculations are missing or pending.";
  if (manifest.input_materializer_version !== PROJECTION_INPUT_MATERIALIZER_VERSION ||
    manifest.relationship_algorithm_version !== SHIFT_RELATIONSHIP_ALGORITHM_VERSION) return "Stored calculations need the current qualified source version.";
  if (!HASH.test(manifest.input_fingerprint ?? "") || !HASH.test(manifest.relationship_fingerprint ?? "") ||
    manifest.relationship_input_fingerprint !== manifest.input_fingerprint || !positive(manifest.input_version) || !positive(manifest.relationship_version)) {
    return "Stored source and shared-time generations do not match.";
  }
  for (const [endpoint, prefix] of [["play-by-play", "pbp"], ["shiftcharts", "shift"]]) {
    const head = heads.get(`${gameId}:${endpoint}`);
    if (!head || !positive(head.raw_payload_id) || !positive(head.snapshot_version) || !HASH.test(head.payload_hash ?? "") || head.raw_payload_id !== manifest[`${prefix}_raw_payload_id`] ||
      head.payload_hash !== manifest[`${prefix}_raw_payload_hash`] || head.snapshot_version !== manifest[`${prefix}_raw_snapshot_version`]) {
      return "Calculations do not match the latest retained source snapshot.";
    }
  }
  if (!positive(manifest.expected_strength_rows) || manifest.expected_strength_rows > 100 ||
    manifest.observed_strength_rows !== manifest.expected_strength_rows ||
    manifest.expected_relationship_rows !== manifest.expected_strength_rows || manifest.observed_relationship_rows !== manifest.expected_strength_rows) {
    return "Stored player-row coverage is incomplete.";
  }
  return null;
}

function wire(players: AggregatedMatrixPlayers): Record<number, WireMatrixPlayer> {
  return Object.fromEntries(Object.entries(players).map(([id, player]) => [id, {
    ...player,
    regularSeasonData: { ...player.regularSeasonData, gamesPlayed: [...player.regularSeasonData.gamesPlayed] },
    playoffData: { ...player.playoffData, gamesPlayed: [...player.playoffData.gamesPlayed] },
  }]));
}

/** Read retained facts only. No NHL fetch, ingestion, writes or live-game observer. */
export async function readDeploymentMatrix(database: DatabaseReader, request: FetchAggregatedDataRequest, now = new Date()): Promise<DeploymentMatrixResponse> {
  const { team: [abbreviation, team], opponent, gameType } = validateMatrixRequest(request);
  const games = await boundedRows((from, to) => {
    let query = database.from("games").select("id,date,seasonId,type,homeTeamId,awayTeamId")
      .eq("seasonId", request.seasonId).eq("type", gameType).gte("date", request.startDate).lte("date", request.endDate);
    if (request.homeOrAway) query = query.eq(request.homeOrAway === "home" ? "homeTeamId" : "awayTeamId", request.teamId);
    else query = query.or(`homeTeamId.eq.${request.teamId},awayTeamId.eq.${request.teamId}`);
    if (opponent) query = query.or(`homeTeamId.eq.${teamsInfo[opponent].id},awayTeamId.eq.${teamsInfo[opponent].id}`);
    if (request.gameIds) query = query.in("id", request.gameIds);
    return query.order("id", { ascending: true }).range(from, to);
  }, 200);
  uniqueBy(games, row => row.id);
  for (const game of games) {
    if (!positive(game.id) || !date(game.date) || game.date < request.startDate || game.date > request.endDate ||
      game.seasonId !== request.seasonId || game.type !== gameType || !positive(game.homeTeamId) || !positive(game.awayTeamId) ||
      game.homeTeamId === game.awayTeamId || ![game.homeTeamId, game.awayTeamId].includes(request.teamId) ||
      request.homeOrAway === "home" && game.homeTeamId !== request.teamId ||
      request.homeOrAway === "away" && game.awayTeamId !== request.teamId ||
      opponent && (game.homeTeamId === request.teamId ? game.awayTeamId : game.homeTeamId) !== teamsInfo[opponent].id ||
      request.gameIds && !request.gameIds.includes(game.id)) throw new Error("Invalid scheduled game scope");
  }
  const gameIds = games.map(game => game.id);
  const loadManifests = (ids: number[]) => ids.length ? boundedRows((from, to) => database.from("projection_game_materialization_status")
    .select(MANIFEST_FIELDS).in("game_id", ids).order("game_id", { ascending: true }).range(from, to), 200) : Promise.resolve([]);
  const loadHeads = (ids: number[]) => ids.length ? boundedRows((from, to) => database.from("nhl_api_game_payload_snapshot_heads")
    .select(HEAD_FIELDS).in("game_id", ids).in("endpoint", ["play-by-play", "shiftcharts"])
    .order("game_id", { ascending: true }).order("endpoint", { ascending: true }).range(from, to), 400) : Promise.resolve([]);
  const [manifestRows, headRows] = await Promise.all([loadManifests(gameIds), loadHeads(gameIds)]);
  const manifests = uniqueBy(manifestRows, row => row.game_id);
  const heads = uniqueBy(headRows, row => `${row.game_id}:${row.endpoint}`);
  const pbpIds = headRows.filter(row => row.endpoint === "play-by-play" && positive(row.raw_payload_id)).map(row => row.raw_payload_id);
  const rawRows = pbpIds.length ? await boundedRows((from, to) => database.from("nhl_api_game_payloads_raw")
    .select("id,game_id,endpoint,payload_hash,game_state:payload->>gameState,source_game_id:payload->>id,source_game_type:payload->>gameType,source_date:payload->>gameDate,source_season:payload->>season,home_id:payload->homeTeam->>id,away_id:payload->awayTeam->>id,final_period:payload->periodDescriptor->>number,final_period_type:payload->gameOutcome->>lastPeriodType,time_remaining:payload->clock->>timeRemaining")
    .in("id", pbpIds).order("id", { ascending: true }).range(from, to), 200) : [];
  const raw = uniqueBy(rawRows, row => row.id);
  const coverage: DeploymentMatrixResponse["coverage"] = { inputRows: 0, rosterRows: 0, skippedRows: 0,
    scheduledGames: games.length, knownFinalGames: 0, acceptedGames: 0, games: [], unrepresentedFiveOnFiveSeconds: 0, excludedSpecialTeamsSeconds: 0 };
  const candidates: Row[] = [];
  const finalGameLengths = new Map<number, number>();
  for (const game of games) {
    const head = heads.get(`${game.id}:play-by-play`);
    const snapshot = head ? raw.get(head.raw_payload_id) : undefined;
    const receipt: MatrixGameCoverage = { gameId: game.id, date: game.date, state: "unverified", reason: "Game completion has not been verified from a retained source." };
    coverage.games.push(receipt);
    if (!snapshot || snapshot.game_id !== game.id || snapshot.endpoint !== "play-by-play" || snapshot.payload_hash !== head?.payload_hash ||
      Number(snapshot.source_game_id) !== game.id || snapshot.source_date !== game.date || Number(snapshot.source_season) !== request.seasonId ||
      Number(snapshot.home_id) !== game.homeTeamId || Number(snapshot.away_id) !== game.awayTeamId || Number(snapshot.source_game_type) !== gameType) continue;
    if (!["FINAL", "OFF"].includes(snapshot.game_state)) {
      if (["FUT", "PRE", "LIVE", "CRIT"].includes(snapshot.game_state)) {
        receipt.state = "notFinal"; receipt.reason = "The latest retained source does not describe a completed game.";
      }
      continue;
    }
    coverage.knownFinalGames++;
    try {
      finalGameLengths.set(game.id, calculateCompletedGameLengthSeconds({ gameType,
        periodDescriptor: { number: Number(snapshot.final_period) },
        gameOutcome: { lastPeriodType: snapshot.final_period_type }, clock: { timeRemaining: snapshot.time_remaining } }));
    } catch {
      receipt.state = "invalid"; receipt.reason = "The retained final game clock could not be qualified."; continue;
    }
    const problem = generationProblem(manifests.get(game.id), heads, game.id);
    if (problem) {
      receipt.state = manifests.get(game.id)?.relationship_status === "complete" ? "stale" : "missing";
      receipt.reason = problem;
    } else candidates.push(game);
  }
  const candidateIds = candidates.map(game => game.id);
  const [shiftRows, rosterRows] = candidateIds.length ? await Promise.all([
    boundedRows((from, to) => database.from("shift_charts").select(ROW_FIELDS).in("game_id", candidateIds)
      .order("game_id", { ascending: true }).order("id", { ascending: true }).range(from, to), 20_000),
    boundedRows((from, to) => database.from("nhl_api_game_roster_spots")
      .select("game_id,player_id,team_id,position_code,source_play_by_play_hash,first_name,last_name,sweater_number")
      .in("game_id", candidateIds).order("game_id", { ascending: true }).order("player_id", { ascending: true }).range(from, to), 20_000),
  ]) : [[], []];
  const representedPlayers = new Set(shiftRows.map(row => `${row.game_id}:${row.player_id}`));
  const missingRosterGameIds = [...new Set(rosterRows.filter(member =>
    normalizeRelationshipPrimaryPosition(member.position_code) !== "G" &&
    !representedPlayers.has(`${member.game_id}:${member.player_id}`)).map(member => member.game_id))];
  const loadBoxscoreHeads = () => missingRosterGameIds.length ? boundedRows((from, to) => database.from("nhl_api_game_payload_snapshot_heads")
    .select(HEAD_FIELDS).in("game_id", missingRosterGameIds).eq("endpoint", "boxscore")
    .order("game_id", { ascending: true }).range(from, to), 200) : Promise.resolve([]);
  const boxscoreHeadRows = await loadBoxscoreHeads();
  const boxscoreHeads = uniqueBy(boxscoreHeadRows, row => row.game_id);
  const boxscoreIds = boxscoreHeadRows.map(head => head.raw_payload_id).filter(positive);
  const boxscoreRows = boxscoreIds.length ? await boundedRows((from, to) => database.from("nhl_api_game_payloads_raw")
    .select("id,game_id,endpoint,payload_hash,game_state:payload->>gameState,source_game_id:payload->>id,source_game_type:payload->>gameType,source_date:payload->>gameDate,source_season:payload->>season,home_id:payload->homeTeam->>id,away_id:payload->awayTeam->>id,player_stats:payload->playerByGameStats")
    .in("id", boxscoreIds).order("id", { ascending: true }).range(from, to), 200) : [];
  const boxscores = uniqueBy(boxscoreRows, row => row.id);
  // A second manifest/head read detects publication or capture while the rows were being read.
  const [afterManifestRows, afterHeadRows, afterBoxscoreHeadRows] = await Promise.all([
    loadManifests(candidateIds), loadHeads(candidateIds), loadBoxscoreHeads(),
  ]);
  const afterBoxscoreHeads = uniqueBy(afterBoxscoreHeadRows, row => row.game_id);
  const afterManifests = uniqueBy(afterManifestRows, row => row.game_id);
  const afterHeads = uniqueBy(afterHeadRows, row => `${row.game_id}:${row.endpoint}`);
  const scope: AggregateReductionScope = { teamId: request.teamId, teamAbbreviation: abbreviation, franchiseId: team.franchiseId,
    seasonId: request.seasonId, gameType: String(gameType) as "2" | "3", startDate: request.startDate, endDate: request.endDate,
    gameIds: new Set(gameIds), homeOrAway: request.homeOrAway || null, opponentTeamAbbreviation: opponent };
  type NormalizedRow = ReturnType<typeof normalizeAggregateRows>["rows"][number];
  const rowsByStrength: Record<MatrixStrength, NormalizedRow[]> = { all: [], fiveOnFive: [], otherEs: [], pp: [], pk: [] };
  const pairsByStrength: Record<MatrixStrength, Array<{ gameId: number; firstPlayerId: number; secondPlayerId: number; seconds: number }>> = { all: [], fiveOnFive: [], otherEs: [], pp: [], pk: [] };
  const units: DeploymentMatrixResponse["units"] = [];
  const fallback = new Map();
  const accepted: number[] = [];
  for (const game of candidates) {
    const receipt = coverage.games.find(entry => entry.gameId === game.id)!;
    const manifest = manifests.get(game.id)!;
    const gameRows = shiftRows.filter(row => row.game_id === game.id);
    const ownRows = gameRows.filter(row => row.team_id === request.teamId);
    coverage.inputRows += ownRows.length;
    if (identity(manifest, MANIFEST_FIELDS) !== identity(afterManifests.get(game.id), MANIFEST_FIELDS) ||
      ["play-by-play", "shiftcharts"].some(endpoint => identity(heads.get(`${game.id}:${endpoint}`), HEAD_FIELDS) !== identity(afterHeads.get(`${game.id}:${endpoint}`), HEAD_FIELDS))) {
      receipt.state = "stale"; receipt.reason = "Sources changed while this game was being read. Reload to use one generation.";
      coverage.skippedRows += ownRows.length; continue;
    }
    try {
      if (gameRows.length !== manifest.expected_strength_rows) throw new Error("Expected player rows are missing.");
      const roster = uniqueBy(rosterRows.filter(row => row.game_id === game.id), row => row.player_id);
      if (!roster.size) throw new Error("Historical roster evidence is missing.");
      const zeroToiPlayers = verifiedZeroToiPlayers(game, roster, boxscoreHeads.get(game.id), afterBoxscoreHeads.get(game.id),
        boxscores.get(boxscoreHeads.get(game.id)?.raw_payload_id));
      const verifiedNonparticipants: number[] = [];
      for (const entry of roster.values()) {
        if (entry.source_play_by_play_hash !== manifest.pbp_raw_payload_hash || !positive(entry.player_id) ||
          ![game.homeTeamId, game.awayTeamId].includes(entry.team_id) || !normalizeRelationshipPrimaryPosition(entry.position_code)) throw new Error("Historical roster evidence is incomplete or stale.");
        if (normalizeRelationshipPrimaryPosition(entry.position_code) !== "G" && !gameRows.some(row => row.player_id === entry.player_id)) {
          if (!zeroToiPlayers.has(entry.player_id)) throw new Error("A roster skater has no qualified shift record; absence is not zero ice time.");
          verifiedNonparticipants.push(entry.player_id);
        }
      }
      for (const row of gameRows) {
        const member = roster.get(row.player_id);
        const primary = member && normalizeRelationshipPrimaryPosition(member.position_code);
        if (!member || !primary || member.team_id !== row.team_id || getRelationshipPlayerType(primary) !== row.player_type ||
          row.game_date !== game.date || row.season_id !== request.seasonId || Number(row.game_type) !== gameType ||
          row.opponent_team_id !== (row.team_id === game.homeTeamId ? game.awayTeamId : game.homeTeamId)) throw new Error("Shift identity does not match the historical game roster.");
        const gameClock = typeof row.game_length === "string" && /^(\d+):([0-5]\d)$/.exec(row.game_length);
        if (!gameClock || Number(gameClock[1]) * 60 + Number(gameClock[2]) !== finalGameLengths.get(game.id)) throw new Error("Shift game length does not match the retained final game clock.");
        row.primary_position = primary;
        // Eligibility labels are not evidence of the position occupied in this historical game.
        row.display_position = primary;
        row.line_combination = null; row.pairing_combination = null;
      }
      const analyzed: DeploymentAnalysis = analyzeDeploymentGame({ gameId: game.id, gameType,
        homeTeamId: game.homeTeamId, awayTeamId: game.awayTeamId, rows: gameRows as DeploymentShiftRow[] });
      const normalized = normalizeAggregateRows(ownRows as ShiftChartRow[], { ...scope, gameIds: new Set([game.id]) });
      if (normalized.skippedRows || normalized.rows.length !== ownRows.length || !normalized.rows.length) throw new Error("Shared-time row validation failed.");
      const ownIds = new Set(ownRows.map(row => row.player_id));
      const actualPairs = new Map(normalized.pairGameFacts.map(pair => [[pair.firstPlayerId, pair.secondPlayerId].sort((a, b) => a - b).join(":"), pair.seconds]));
      const derivedPairs = analyzed.pairsByStrength.all.filter(pair => ownIds.has(pair.firstPlayerId));
      if (derivedPairs.some(pair => actualPairs.get(`${pair.firstPlayerId}:${pair.secondPlayerId}`) !== pair.seconds) ||
        [...actualPairs].some(([key, seconds]) => seconds > 0 && !derivedPairs.some(pair => `${pair.firstPlayerId}:${pair.secondPlayerId}` === key && pair.seconds === seconds))) throw new Error("Stored shared time does not match the retained shift intervals.");
      const gameFallback = new Map();
      for (const member of roster.values()) if (ownIds.has(member.player_id)) gameFallback.set(member.player_id, {
        id: member.player_id, fullName: `${member.first_name ?? ""} ${member.last_name ?? ""}`.trim(), position: member.position_code, sweater_number: member.sweater_number,
      });
      // Qualify metadata before committing this game's rows. A malformed name or
      // sweater number must exclude one game, not fail the complete selection later.
      buildAggregatedPlayers(normalized.rows, normalized.pairGameFacts, gameFallback, request.seasonType, scope);
      for (const strength of strengths) {
        rowsByStrength[strength].push(...normalized.rows.map(row => ({ ...row, gameToiSeconds: analyzed.totalsByStrength[strength][row.playerId] })));
        pairsByStrength[strength].push(...analyzed.pairsByStrength[strength].filter(pair => ownIds.has(pair.firstPlayerId)).map(pair => ({ ...pair, gameId: game.id })));
      }
      for (const [playerId, member] of gameFallback) fallback.set(playerId, member);
      units.push(...analyzed.units.filter(unit => unit.teamId === request.teamId));
      coverage.unrepresentedFiveOnFiveSeconds += analyzed.formationCoverage.unrepresentedFiveOnFiveSecondsByTeam[request.teamId] ?? 0;
      coverage.excludedSpecialTeamsSeconds += analyzed.formationCoverage.excludedSpecialTeamsSecondsByTeam[request.teamId] ?? 0;
      receipt.state = "accepted"; receipt.reason = "Qualified source generation, historical roster and interval totals agree.";
      if (verifiedNonparticipants.length) receipt.verifiedZeroToiPlayers = verifiedNonparticipants;
      accepted.push(game.id);
    } catch (error) {
      receipt.state = "invalid"; receipt.reason = error instanceof Error ? error.message : "Game data could not be qualified.";
      coverage.skippedRows += ownRows.length;
    }
  }
  const players = Object.fromEntries(strengths.map(strength => [strength, buildAggregatedPlayers(rowsByStrength[strength], pairsByStrength[strength], fallback, request.seasonType, scope)])) as Record<MatrixStrength, AggregatedMatrixPlayers>;
  coverage.rosterRows = Object.keys(players.all).length;
  coverage.acceptedGames = accepted.length;
  const cardStats = await fetchScopedCardStats(accepted, players.all, request.seasonType, database as any);
  return { byStrength: Object.fromEntries(strengths.map(strength => [strength, wire(players[strength])])) as DeploymentMatrixResponse["byStrength"],
    units, matchedGameIds: accepted, cardStats, checkedAt: now.toISOString(), coverage };
}
