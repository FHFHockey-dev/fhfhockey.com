import { projectionInputHash } from "./inputCapture";
import type { ForgeInputSnapshot } from "./gameRevisions";
import { boardGoalieForecast, boardSkaterForecast, boardSkaterStatsFromProjection, DEFAULT_BOARD_SCORING, scoreBoardStats, type BoardStats } from "./starterBoardScoring";

/** Private export only: source contains captured queries and must never enter a public response. */
export type FrozenBoardSource = {
  game: { id: number; date: string; type: number; homeTeamId: number; awayTeamId: number };
  frozen: { game_id: number; revision_id: string; scheduled_start_at: string; frozen_at: string };
  revision: { id: string; game_id: number; run_id: string; input_snapshot_id: string; slate_date: string;
    decision_as_of: string; published_at: string; payload: { players: any[]; goalies: any[]; codeVersion: string; modelMode: string } };
  observation: { id: string; provider: string; dataset_key: string; entity_key: string; available_at: string;
    payload_hash: string; payload: ForgeInputSnapshot };
};

function time(value: string): number {
  if (typeof value !== "string" || !/(?:Z|[+-]\d\d:\d\d)$/i.test(value) || !Number.isFinite(Date.parse(value))) {
    throw new Error("A timezone-qualified provenance timestamp is required");
  }
  return Date.parse(value);
}

export function validateBoardExportScope(date: string, gameId: number) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !Number.isFinite(Date.parse(date)) || new Date(date).toISOString().slice(0, 10) !== date
    || !Number.isSafeInteger(gameId) || gameId <= 0) throw new Error("One valid slate date and game ID are required");
  if (date >= "2026-01-03" && date <= "2026-04-16") throw new Error("Protected research holdout cannot be exported by the daily board");
}

export function exportFrozenBoardForecasts(source: FrozenBoardSource) {
  const { game, frozen, revision, observation } = source;
  validateBoardExportScope(game.date, game.id);
  const snapshot = observation.payload;
  if (frozen.game_id !== game.id || revision.game_id !== game.id || revision.id !== frozen.revision_id
    || revision.slate_date !== game.date || revision.input_snapshot_id !== observation.id
    || observation.provider !== "forge" || observation.dataset_key !== "forge-run-inputs-v1"
    || observation.entity_key !== revision.run_id || snapshot.runId !== revision.run_id
    || snapshot.slateDate !== game.date || snapshot.version !== "forge-inputs-v1"
    || snapshot.replayClassification !== "captured_live" || snapshot.controlledScenario || snapshot.horizonGames !== 1
    || ![1, 2].includes(game.type) || !snapshot.codeVersion || snapshot.codeVersion !== revision.payload.codeVersion
    || snapshot.modelMode !== revision.payload.modelMode || projectionInputHash(snapshot) !== observation.payload_hash) {
    throw new Error("Frozen revision, captured input identity or live forecast contract mismatch");
  }
  const start = time(frozen.scheduled_start_at), cutoff = time(snapshot.decisionAsOf), issued = time(revision.published_at);
  if (!(time(snapshot.inputCutoff) <= cutoff && time(revision.decision_as_of) === cutoff
    && cutoff <= time(snapshot.capturedAt) && time(snapshot.capturedAt) <= time(observation.available_at)
    && time(observation.available_at) <= issued && issued < start && start <= time(frozen.frozen_at))) {
    throw new Error("Forecast was not captured and published before the frozen game start");
  }
  if (!snapshot.reads.length) throw new Error("Captured input reads are required");
  let latestRead = 0, gameCaptured = false;
  const membership = new Map<number, Set<number>>();
  const positions = new Map<number, string>();
  for (const read of snapshot.reads) {
    const received = time(read.receivedAt);
    if (received > cutoff) throw new Error("Input receipt is after the declared prediction cutoff");
    latestRead = Math.max(latestRead, received);
    const result = read.result as { data?: any[]; error?: unknown } | null;
    if (read.failure || result?.error || !Array.isArray(result?.data)) continue;
    const table = read.request[0]?.args[0];
    const filters = new Map(read.request.filter((op) => op.method === "eq").map((op) => [op.args[0], op.args[1]]));
    for (const row of result.data) {
      if (table === "games" && row.id === game.id && row.date === game.date && row.homeTeamId === game.homeTeamId && row.awayTeamId === game.awayTeamId) gameCaptured = true;
      const id = table === "players" ? row.id : table === "rosters" && filters.get("is_current") === true ? row.playerId : null;
      const team = table === "players" ? row.team_id ?? filters.get("team_id") : filters.get("teamId");
      if (!Number.isSafeInteger(id) || id <= 0 || !Number.isSafeInteger(team) || Number(team) <= 0) continue;
      membership.set(id, new Set([...(membership.get(id) ?? []), Number(team)]));
      if (typeof row.position === "string") positions.set(id, row.position);
    }
  }
  if (!gameCaptured || game.homeTeamId === game.awayTeamId) throw new Error("Game-time teams are not supported by the captured schedule");
  const exclusions: Array<{ playerId: number; reason: string; target?: string }> = [];
  const rows: Array<Record<string, any>> = [];
  const players = new Set<number>();
  const rowIds = new Set<string>();
  const emit = (playerId: number, teamId: number, population: "skater" | "goalie", conditioning: string, stats: BoardStats, segments: Record<string, unknown>) => {
    for (const [target, estimate] of Object.entries(stats)) {
      if (estimate == null || !Number.isFinite(estimate)) { exclusions.push({ playerId, target, reason: "missing_projection" }); continue; }
      const identity = `${playerId}:${target}:${conditioning}`;
      if (rowIds.has(identity)) throw new Error("Duplicate frozen forecast target");
      rowIds.add(identity);
      rows.push({ contractVersion: "starter-board-evaluation-v1", game_id: game.id, game_date: game.date, game_type: game.type,
        player_id: playerId, team_id: teamId, opponent_team_id: teamId === game.homeTeamId ? game.awayTeamId : game.homeTeamId,
        population, target_key: target, conditioning, estimates: { forge: estimate }, segments,
        snapshot_hash: observation.payload_hash, historical_team_membership_verified: true, membership_basis: "captured_pregame_team_records",
        evidence_classification: "captured_live", checkpoint: "frozen_final_pregame", revision_id: revision.id,
        model_id: `forge:${snapshot.modelMode}:${snapshot.codeVersion}`, model_code_version: snapshot.codeVersion,
        cutoff_at: snapshot.decisionAsOf, source_query_cutoff_at: snapshot.inputCutoff,
        maximum_feature_available_at: new Date(latestRead).toISOString(), issued_at: revision.published_at,
        scheduled_start_at: frozen.scheduled_start_at,
        ...(target === "FANTASY_POINTS" ? { scoring_weights: DEFAULT_BOARD_SCORING[population] } : {}),
      });
    }
  };
  const include = (playerId: number, teamId: number) => {
    if (!Number.isSafeInteger(playerId) || playerId <= 0 || ![game.homeTeamId, game.awayTeamId].includes(teamId)) throw new Error("Invalid frozen player identity");
    if (players.has(playerId)) throw new Error("Player appears more than once in frozen player pool");
    players.add(playerId);
    const teams = membership.get(playerId);
    if (teams?.size !== 1 || !teams.has(teamId)) { exclusions.push({ playerId, reason: "pregame_membership_missing_or_conflicting" }); return false; }
    return true;
  };
  const emitStats = (id: number, team: number, population: "skater" | "goalie", conditioning: string, stats: BoardStats | null, segments: Record<string, unknown>) => {
    if (!stats) return;
    emit(id, team, population, conditioning, { ...stats, FANTASY_POINTS: scoreBoardStats(stats, DEFAULT_BOARD_SCORING[population]).points }, segments);
  };
  for (const row of revision.payload.players) {
    if (row.run_id !== revision.run_id || row.game_id !== game.id || row.horizon_games !== 1) throw new Error("Player projection does not belong to the frozen run");
    if (!include(row.player_id, row.team_id)) continue;
    const forecast = boardSkaterForecast(boardSkaterStatsFromProjection(row), row.uncertainty);
    const segments = { position: positions.get(row.player_id) ?? "unavailable", uncertain_lineup: forecast.conflicts.length > 0 || forecast.probabilityStatus === "missing" };
    if (forecast.conditioning === "legacy_unclassified") { exclusions.push({ playerId: row.player_id, reason: "unclassified_production_conditioning" }); continue; }
    emitStats(row.player_id, row.team_id, "skater", "conditional_playing", forecast.conditional, segments);
    emitStats(row.player_id, row.team_id, "skater", "unconditional", forecast.expected, segments);
    if (forecast.participationProbability != null) emit(row.player_id, row.team_id, "skater", "probability", { participation: forecast.participationProbability }, segments);
    else exclusions.push({ playerId: row.player_id, target: "participation", reason: "participation_estimate_missing" });
  }
  for (const row of revision.payload.goalies) {
    if (row.run_id !== revision.run_id || row.game_id !== game.id || row.horizon_games !== 1) throw new Error("Goalie projection does not belong to the frozen run");
    const candidates = row.uncertainty?.daily_board_candidates;
    if (!Array.isArray(candidates)) { exclusions.push({ playerId: row.goalie_id, reason: "goalie_scenarios_missing" }); continue; }
    for (const candidate of candidates) {
      if (!include(candidate.playerId, row.team_id)) continue;
      const forecast = boardGoalieForecast(candidate);
      if (!forecast) { exclusions.push({ playerId: candidate.playerId, reason: "goalie_projection_missing" }); continue; }
      const segments = { position: "G", uncertain_lineup: forecast.probabilityStatus !== "confirmed_evidence" };
      emitStats(candidate.playerId, row.team_id, "goalie", "conditional_start", forecast.conditional, segments);
      emitStats(candidate.playerId, row.team_id, "goalie", "unconditional", forecast.expected, segments);
      emit(candidate.playerId, row.team_id, "goalie", "probability", { goalie_start: candidate.startingProbability }, segments);
    }
  }
  rows.sort((a, b) => a.player_id - b.player_id || a.target_key.localeCompare(b.target_key) || a.conditioning.localeCompare(b.conditioning));
  return { rows, manifest: { version: "starter-board-issued-forecasts-v1", gameId: game.id, gameDate: game.date, gameType: game.type,
    revisionId: revision.id, inputSnapshotHash: observation.payload_hash, sourceHash: projectionInputHash(source),
    codeVersion: snapshot.codeVersion, issuedAt: revision.published_at, frozenAt: frozen.frozen_at, targetRows: rows.length,
    projectedPlayers: players.size, evaluatedPlayers: new Set(rows.map((row) => row.player_id)).size,
    exclusions, promotionEligible: false, completeParticipationCandidatePool: false,
    limitations: ["Export covers the frozen serving forecast pool, not a complete participation candidate list.",
      "Missing participation and comparator estimates remain unavailable; no calibration or promotion is implied.",
      "Pregame team records establish recorded membership, not independent certification of provider freshness.",
      "Goalie unconditional forecasts retain the serving model's zero-relief-minutes assumption."] } };
}

export async function readFrozenBoardSource(db: any, date: string, gameId: number): Promise<FrozenBoardSource> {
  validateBoardExportScope(date, gameId);
  const [gameResult, frozenResult] = await Promise.all([
    db.from("games").select("id,date,type,homeTeamId,awayTeamId").eq("id", gameId).eq("date", date).single(),
    db.from("forge_final_pregame_revisions").select("game_id,revision_id,scheduled_start_at,frozen_at").eq("game_id", gameId).single(),
  ]);
  if (gameResult.error || frozenResult.error || !gameResult.data || !frozenResult.data) throw new Error("Game or immutable final-pregame selection is unavailable");
  const revision = await db.from("forge_game_revisions").select("id,game_id,run_id,input_snapshot_id,slate_date,decision_as_of,published_at,payload")
    .eq("id", frozenResult.data.revision_id).eq("game_id", gameId).single();
  if (revision.error || !revision.data) throw new Error("Frozen game revision is unavailable");
  const observation = await db.from("player_forecast_source_observations").select("id,provider,dataset_key,entity_key,available_at,payload_hash,payload")
    .eq("id", revision.data.input_snapshot_id).eq("provider", "forge").eq("dataset_key", "forge-run-inputs-v1").single();
  if (observation.error || !observation.data) throw new Error("Immutable FORGE input snapshot is unavailable");
  return { game: gameResult.data, frozen: frozenResult.data, revision: revision.data, observation: observation.data };
}
