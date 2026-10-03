import supabase from "lib/supabase/server";
import { projectionInputHash, type ForgeCapturedReadReceipt, type ProjectionInputRead } from "./inputCapture";
import type { ForgeIssuedContextV1 } from "./issuedContext";
import { BOARD_CATEGORIES, boardSkaterForecast, completeBoardSkaterStatsFromProjection } from "./starterBoardScoring";

export type ForgeIssuedTargetManifest = {
  version: "forge-issued-targets-v1";
  outputHash: string;
  unmappedOutputs: number;
  opportunities: Array<{ playerId: number; nhlPlayerId: number; gameId: number; teamId: number; seasonId: number;
    population: "skater" | "goalie"; conditioning: "unconditional" | "conditional_playing" | "conditional_start" | "legacy_unclassified";
    targetKeys: string[] }>;
};

/** Output presence only: this compact receipt never grants serving or model readiness. */
export function capturedIssuedTargets(contexts: ForgeIssuedContextV1[],
  writes: Array<Array<{ method: string; args: unknown[] }>>): ForgeIssuedTargetManifest {
  const rows = new Map<string, { table: string; row: any }>();
  for (const operations of writes) {
    const table = String(operations[0]?.args[0]);
    if (!["forge_player_projections", "forge_goalie_projections"].includes(table)) continue;
    const value = operations.find(op => ["upsert", "insert"].includes(op.method))?.args[0];
    for (const row of Array.isArray(value) ? value : value ? [value] : []) {
      if (row.horizon_games !== 1) continue;
      rows.set(`${table}:${row.game_id}:${row.team_id}:${row.player_id ?? row.goalie_id}`, { table, row });
    }
  }
  let unmappedOutputs = 0;
  const opportunities: ForgeIssuedTargetManifest["opportunities"] = [];
  for (const { table, row } of rows.values()) {
    const goalie = table === "forge_goalie_projections";
    const candidates = goalie ? row.uncertainty?.daily_board_candidates ?? [] : [row];
    for (const candidate of candidates) {
      const nhlPlayerId = goalie ? candidate.playerId : row.player_id;
      const contextsForGame = contexts.filter(context => context.game.id === row.game_id);
      const context = contextsForGame.length === 1 ? contextsForGame[0] : undefined;
      const identities = context?.roster.filter(member => member.nhlId === nhlPlayerId && member.teamId === row.team_id) ?? [];
      if (identities.length !== 1) { unmappedOutputs++; continue; }
      const prediction = goalie ? null : boardSkaterForecast(completeBoardSkaterStatsFromProjection(row), row.uncertainty);
      const values = goalie ? candidate.conditional : prediction?.conditional ?? prediction?.expected ?? prediction?.legacy;
      opportunities.push({ playerId: identities[0].canonicalId, nhlPlayerId, gameId: row.game_id,
        teamId: row.team_id, seasonId: identities[0].seasonId, population: goalie ? "goalie" : "skater",
        conditioning: goalie ? "conditional_start" : prediction!.conditioning,
        targetKeys: BOARD_CATEGORIES.filter(key => (key.endsWith("_GOALIE") === goalie)
          && typeof values?.[key] === "number" && Number.isFinite(values[key])).sort() });
    }
  }
  return { version: "forge-issued-targets-v1", outputHash: projectionWritesHash(writes), unmappedOutputs,
    opportunities: opportunities.sort((a, b) => a.gameId - b.gameId || a.teamId - b.teamId || a.playerId - b.playerId) };
}

/** Whitelist retained receipts. Missing/malformed legacy lineage stays unknown. */
export function parseForgeIssuedTargets(value: unknown, gameId: number): ForgeIssuedTargetManifest | null {
  const manifest = value as ForgeIssuedTargetManifest | null;
  const positiveId = (id: unknown) => typeof id === "number" && Number.isSafeInteger(id) && id > 0;
  if (!manifest || manifest.version !== "forge-issued-targets-v1" || typeof manifest.outputHash !== "string"
    || !/^[a-f0-9]{64}$/.test(manifest.outputHash)
    || !Number.isSafeInteger(manifest.unmappedOutputs) || manifest.unmappedOutputs < 0
    || !Array.isArray(manifest.opportunities) || manifest.opportunities.length > 1500) return null;
  const seen = new Set<string>();
  const opportunities: ForgeIssuedTargetManifest["opportunities"] = [];
  for (const row of manifest.opportunities) {
    if (!row || ![row.playerId, row.nhlPlayerId, row.gameId, row.teamId, row.seasonId].every(positiveId)
      || !["skater", "goalie"].includes(row.population)
      || !["unconditional", "conditional_playing", "conditional_start", "legacy_unclassified"].includes(row.conditioning)
      || !Array.isArray(row.targetKeys) || row.targetKeys.length > 20
      || row.targetKeys.some(key => typeof key !== "string" || !/^[A-Z][A-Z0-9_]{0,63}$/.test(key)
        || (key.endsWith("_GOALIE") || key === "GOALIE_MINUTES") !== (row.population === "goalie"))
      || new Set(row.targetKeys).size !== row.targetKeys.length) return null;
    // A captured multi-game run carries one shared manifest in each game revision.
    if (row.gameId !== gameId) continue;
    const key = `${row.playerId}:${row.teamId}`;
    if (seen.has(key)) return null;
    seen.add(key);
    opportunities.push({ playerId: row.playerId, nhlPlayerId: row.nhlPlayerId, gameId: row.gameId,
      teamId: row.teamId, seasonId: row.seasonId, population: row.population,
      conditioning: row.conditioning, targetKeys: [...row.targetKeys].sort() });
  }
  return { version: "forge-issued-targets-v1", outputHash: manifest.outputHash,
    unmappedOutputs: manifest.unmappedOutputs, opportunities };
}

export type ForgeInputSnapshot = {
  version: "forge-inputs-v1";
  runId: string;
  slateDate: string;
  decisionAsOf: string;
  inputCutoff: string;
  capturedAt: string;
  codeVersion: string;
  modelMode: "baseline" | "candidate";
  modelEnvironment?: Record<string, string | null>;
  seasonBootstrapApplied?: boolean;
  inputProvenance?: { rolling_player_history_contract: string; issuedContexts?: ForgeIssuedContextV1[];
    capturedReads?: ForgeCapturedReadReceipt; issuedTargets?: ForgeIssuedTargetManifest };
  deterministicSeed?: number;
  dailyBoardEvidence?: import("./dailyBoardEvidence").DailyBoardEvidence;
  horizonGames: number;
  gameIds: number[];
  replayClassification: "captured_live" | "historical_reconstruction";
  controlledScenario?: { classification: "controlled_news_fixture"; fixtureHash: string };
  reads: ProjectionInputRead[];
  outputHash: string;
  goalieStarts: Array<Record<string, unknown>>;
};

export function capturedGoalieStarts(reads: ProjectionInputRead[], writes: Array<Array<{ method: string; args: unknown[] }>> = []): Array<Record<string, unknown>> {
  const result = new Map<string, Record<string, unknown>>();
  for (const read of reads) {
    if (read.request[0]?.args[0] !== "goalie_start_projections") continue;
    const ids = Object.fromEntries(read.request.filter((op) => op.method === "eq")
      .map((op) => [String(op.args[0]), op.args[1]]));
    const data = (read.result as any)?.data;
    if (!Array.isArray(data)) continue;
    for (const row of data) {
      const value = { ...ids, ...row };
      if (!value.game_id || !value.team_id || !value.player_id) continue;
      const key = `${value.game_id}:${value.team_id}:${value.player_id}`;
      result.set(key, { ...result.get(key), ...value });
    }
  }
  for (const operations of writes) {
    if (operations[0]?.args[0] !== "forge_goalie_projections") continue;
    const row = operations.find((op) => op.method === "upsert")?.args[0] as any;
    const candidates = row?.uncertainty?.daily_board_candidates ?? [];
    const previous = new Map(result);
    if (candidates.length) {
      for (const key of result.keys()) if (key.startsWith(`${row.game_id}:${row.team_id}:`)) result.delete(key);
    }
    for (const candidate of candidates) {
      const key = `${row.game_id}:${row.team_id}:${candidate.playerId}`;
      result.set(key, { ...previous.get(key), game_id: row.game_id, team_id: row.team_id,
        game_date: row.as_of_date, player_id: candidate.playerId, start_probability: candidate.startingProbability,
        confirmed_status: candidate.probabilityStatus === "confirmed_evidence" && candidate.startingProbability === 1 });
    }
  }
  return [...result.values()];
}

export function projectionWritesHash(writes: Array<Array<{ method: string; args: unknown[] }>>): string {
  const tables = new Set(["forge_player_projections", "forge_team_projections", "forge_goalie_projections"]);
  const rows = writes.filter((ops) => tables.has(String(ops[0]?.args[0]))).flatMap((ops) => {
    const write = ops.find((op) => op.method === "upsert" || op.method === "insert");
    const values = Array.isArray(write?.args[0]) ? write.args[0] : [write?.args[0]];
    return values.map((row: any) => ({
      table: ops[0].args[0],
      row: Object.fromEntries(Object.entries(row ?? {}).filter(([key]) => !["updated_at", "created_at"].includes(key))),
    }));
  });
  return projectionInputHash(rows.sort((a, b) => projectionInputHash(a).localeCompare(projectionInputHash(b))));
}

export async function saveForgeInputSnapshot(snapshot: ForgeInputSnapshot): Promise<string> {
  const payloadHash = projectionInputHash(snapshot);
  // Player Forecasts tables are not in the legacy generated Database type yet.
  const { data, error } = await (supabase as any).from("player_forecast_source_observations").insert({
    provider: "forge",
    dataset_key: "forge-run-inputs-v1",
    entity_kind: "projection_run",
    entity_key: snapshot.runId,
    observed_at: snapshot.decisionAsOf,
    available_at: snapshot.capturedAt,
    payload_hash: payloadHash,
    payload: snapshot as any,
    metadata: { replayClassification: snapshot.replayClassification, outputHash: snapshot.outputHash },
  }).select("id").single();
  if (error) throw error;
  return data.id;
}

export async function publishForgeGameRevisions(runId: string, snapshotId: string): Promise<number> {
  const { data, error } = await (supabase as any).rpc("publish_forge_game_revisions", {
    p_run_id: runId,
    p_snapshot_id: snapshotId,
  });
  if (error) throw error;
  return Number(data ?? 0);
}

export type ForgeGameRevision = {
  id: string;
  game_id: number;
  run_id: string;
  decision_as_of: string;
  published_at: string;
  payload: {
    players: any[]; teams: any[]; goalies: any[]; goalieStarts?: any[]; modelMode?: string; codeVersion?: string; inputProvenance?: ForgeInputSnapshot["inputProvenance"];
    inputCutoff?: string; calculatedAt?: string;
    evidence?: import("./dailyBoardEvidence").DailyBoardEvidence;
    previousRevision?: { id: string; codeVersion: string; modelMode: string; players: any[]; goalies: any[] } | null;
  };
};

export async function loadForgeGameRevisions(date: string): Promise<ForgeGameRevision[]> {
  const { data, error } = await (supabase as any).rpc("read_forge_game_revisions", { p_slate_date: date });
  if (error) throw error;
  return data ?? [];
}
