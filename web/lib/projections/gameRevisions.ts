import supabase from "lib/supabase/server";
import { projectionInputHash, type ProjectionInputRead } from "./inputCapture";

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
  inputProvenance?: unknown;
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
    players: any[]; teams: any[]; goalies: any[]; goalieStarts?: any[]; modelMode?: string; codeVersion?: string; inputProvenance?: unknown;
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
