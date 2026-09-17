import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, realpathSync, writeFileSync } from "node:fs";
import { dirname, resolve, sep } from "node:path";
import { loadEnvConfig } from "@next/env";
import { exportFrozenBoardForecasts, readFrozenBoardSource, validateBoardExportScope, type FrozenBoardSource } from "../lib/projections/starterBoardDataset";

const hash = (value: string | Uint8Array) => createHash("sha256").update(value).digest("hex");

async function main() {
  const [date, rawGameId, destination, sourceFlag, sourcePath, ...extra] = process.argv.slice(2);
  if (!date || !rawGameId || !destination || extra.length || (sourceFlag && (sourceFlag !== "--source" || !sourcePath))) {
    throw new Error("Usage: export-starter-board-forecasts.ts DATE GAME_ID PRIVATE_OUTPUT_DIRECTORY [--source PRIVATE_CAPTURE.json]");
  }
  const gameId = Number(rawGameId);
  validateBoardExportScope(date, gameId);
  const root = realpathSync(resolve(__dirname, "../.."));
  const output = resolve(destination);
  // Require an existing parent so symlinks are resolved before any write or network read.
  const parent = realpathSync(dirname(output));
  if (parent === root || parent.startsWith(`${root}${sep}`) || (existsSync(output) && realpathSync(output).startsWith(`${root}${sep}`))) {
    throw new Error("Private forecast artifacts must be outside the repository");
  }
  let source: FrozenBoardSource;
  if (sourcePath) source = JSON.parse(readFileSync(sourcePath, "utf8"));
  else {
    loadEnvConfig(resolve(__dirname, ".."), true, { info() {}, error() {} });
    const origin = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").origin;
    const network = globalThis.fetch;
    const tables = new Set(["games", "forge_final_pregame_revisions", "forge_game_revisions", "player_forecast_source_observations"]);
    globalThis.fetch = (input, init) => {
      const url = new URL(typeof input === "string" || input instanceof URL ? input : input.url);
      const method = (init?.method ?? (input instanceof Request ? input.method : "GET")).toUpperCase();
      if (url.origin !== origin || method !== "GET" || !tables.has(url.pathname.replace(/^\/rest\/v1\//, ""))) {
        throw new Error("Read-only forecast export rejected a request");
      }
      return network(input, { ...init, redirect: "error", signal: AbortSignal.timeout(15_000) });
    };
    const { default: db } = await import("../lib/supabase/server");
    try { source = await readFrozenBoardSource(db, date, gameId); }
    finally { globalThis.fetch = network; }
  }
  if (source.game.id !== gameId || source.game.date !== date) throw new Error("Source capture does not match requested game");
  const exported = exportFrozenBoardForecasts(source);
  const files: Record<string, string> = {
    "source.json": `${JSON.stringify(source)}\n`,
    "forecasts.jsonl": exported.rows.map((row) => `${JSON.stringify(row)}\n`).join(""),
  };
  const implementation = [__filename, resolve(__dirname, "../lib/projections/starterBoardDataset.ts"),
    resolve(__dirname, "../lib/projections/starterBoardScoring.ts"), resolve(__dirname, "../lib/projectionsConfig/fantasyPointsConfig.ts")];
  const exporterHash = hash(JSON.stringify(implementation.map((file) => hash(new Uint8Array(readFileSync(file))))));
  const manifest = { ...exported.manifest, exporterHash, sourceOrigin: sourcePath ? "provided_capture" : "immutable_database_records",
    files: Object.fromEntries(Object.entries(files).map(([name, value]) => [name, hash(value)])) };
  if (existsSync(output)) {
    const existing = JSON.parse(readFileSync(resolve(output, "manifest.json"), "utf8"));
    if (JSON.stringify(existing) !== JSON.stringify(manifest) || Object.entries(manifest.files).some(([name, checksum]) =>
      hash(new Uint8Array(readFileSync(resolve(output, name)))) !== checksum)) throw new Error("Refusing to replace a different or damaged forecast artifact");
  } else {
    mkdirSync(output, { mode: 0o700 });
    for (const [name, contents] of Object.entries(files)) writeFileSync(resolve(output, name), contents, { flag: "wx", mode: 0o600 });
    writeFileSync(resolve(output, "manifest.json"), JSON.stringify(manifest, null, 2) + "\n", { flag: "wx", mode: 0o600 });
  }
  console.log(JSON.stringify({ output, revisionId: manifest.revisionId, sourceHash: manifest.sourceHash,
    targetRows: manifest.targetRows, evaluatedPlayers: manifest.evaluatedPlayers, exclusions: manifest.exclusions.length,
    sourceOrigin: manifest.sourceOrigin, promotionEligible: false }));
}
main().catch((error) => { console.error(error instanceof Error ? error.message : "Forecast export failed"); process.exitCode = 1; });
