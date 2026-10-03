const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
require("@next/env").loadEnvConfig(process.cwd());
const output = process.argv[2];
if (!output) throw new Error("An output JSON path is required.");
const startedAt = new Date().toISOString();
const startedMs = Date.now();
const reads = new Map();
let blockedNonReadRequests = 0;
const originalFetch = globalThis.fetch;
globalThis.fetch = async (input, init) => {
  const method = (init?.method ?? (input instanceof Request ? input.method : "GET")).toUpperCase();
  if (method !== "GET" && method !== "HEAD") {
    blockedNonReadRequests++;
    throw new Error("Read-only validation blocked a non-read HTTP request.");
  }
  const url = new URL(input instanceof Request ? input.url : String(input));
  const response = await originalFetch(input, init);
  const key = `${method} ${url.pathname} ${response.status}`;
  reads.set(key, (reads.get(key) ?? 0) + 1);
  return response;
};
async function main() {
  const { recomputePlayerRowsForValidation } = require("lib/supabase/Upserts/fetchRollingPlayerAverages");
  const request = { playerId: 8471215, season: 20252026, startDate: "2026-04-12",
    endDate: "2026-04-12", strengths: ["all"], skipDiagnostics: false };
  const result = await recomputePlayerRowsForValidation(request);
  const fields = ["player_id", "game_id", "game_date", "season", "strength_state", "games_played",
    "season_games_played", "season_participation_games", "season_team_games_available", "toi_seconds_avg_season",
    "points_avg_season", "pp_points_avg_season", "pp_toi_seconds_avg_season", "goals_per_60_season",
    "goals_per_60_goals_season", "goals_per_60_toi_seconds_season"];
  const rows = result.rows.map(row => Object.fromEntries(fields.map(field => [field, row[field] ?? null])));
  const unexpectedRows = rows.filter(row => row.player_id !== request.playerId || row.season !== request.season
    || row.game_date !== request.startDate || row.strength_state !== "all");
  if (unexpectedRows.length) throw new Error("Validation returned rows outside the requested output scope.");
  const sourceHashes = Object.fromEntries(Object.keys(require.cache)
    .filter(file => file.startsWith(process.cwd() + path.sep) && !file.includes(path.sep + "node_modules" + path.sep))
    .map(file => [path.relative(process.cwd(), file), crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex")]));
  const receipt = { startedAt, completedAt: new Date().toISOString(), elapsedMs: Date.now() - startedMs,
    mode: "existing validation helper; GET/HEAD-only network; main/writer endpoints/upserts not invoked",
    nodeVersion: process.version, request, rows, diagnostics: result.diagnostics,
    readRequests: Object.fromEntries(reads), blockedNonReadRequests, sourceHashes,
    sourceHashesTiming: "current source file bytes at receipt completion; not immutable loader pins",
    limits: ["Current dry-run output is not historical producer attribution or deployed parity.",
      "The helper loads its full game ledger and prior player history; only one requested player/date/strength can be emitted.",
      "No publication, stored-row repair, full-population completeness or model evaluation is certified."] };
  fs.writeFileSync(output, JSON.stringify(receipt, null, 2));
  console.log(JSON.stringify({ output, rows: receipt.rows, elapsedMs: receipt.elapsedMs, blockedNonReadRequests }));
}
main().catch(error => { console.error(JSON.stringify({ failed: true, code: error?.code ?? null,
  message: error?.message ?? "Read-only validation failed", blockedNonReadRequests, elapsedMs: Date.now() - startedMs }));
  process.exitCode = 1; });
