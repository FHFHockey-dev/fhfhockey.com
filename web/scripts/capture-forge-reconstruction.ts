import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, realpathSync, writeFileSync } from "node:fs";
import { dirname, relative, resolve, sep } from "node:path";
import { loadEnvConfig } from "@next/env";

async function main() {
  const [date, rawGameId, cutoff, destination, newsFixture] = process.argv.slice(2);
  if (!date || !rawGameId || !cutoff || !destination) throw new Error("Usage: capture-forge-reconstruction.ts DATE GAME_ID CUTOFF PRIVATE_OUTPUT.json");
  const root = realpathSync(resolve(__dirname, "../.."));
  const output = resolve(destination);
  if (existsSync(output)) throw new Error("Refusing to overwrite a captured reconstruction");
  mkdirSync(dirname(output), { recursive: true, mode: 0o700 });
  const parent = realpathSync(dirname(output));
  if (parent === root || parent.startsWith(`${root}${sep}`)) throw new Error("Captured inputs must be stored outside the repository");
  loadEnvConfig(resolve(__dirname, ".."), true, { info() {}, error() {} });
  process.env.STARTER_BOARD_CAPTURE_ENABLED = "true";
  process.env.STARTER_BOARD_COMPUTE_ENABLED = "true";
  process.env.STARTER_BOARD_SERVING_ENABLED = "false";
  process.env.STARTER_BOARD_SCHEDULER_ENABLED = "false";
  process.env.STARTER_BOARD_CHALLENGER_ENABLED = "false";
  const origin = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").origin;
  const network = globalThis.fetch;
  let reads = 0, rejectedRequests = 0;
  // Independent transport fence: even a missed query interceptor cannot send
  // a write, auth request, RPC, redirect or arbitrary provider request.
  globalThis.fetch = async (input, init) => {
    const url = new URL(typeof input === "string" || input instanceof URL ? input : input.url);
    const method = (init?.method ?? (input instanceof Request ? input.method : "GET")).toUpperCase();
    if (url.origin !== origin || !url.pathname.startsWith("/rest/v1/") || url.pathname.startsWith("/rest/v1/rpc/")
      || !["GET", "HEAD"].includes(method)) { rejectedRequests++; throw new Error("Read-only reconstruction transport rejected a request"); }
    reads++;
    return network(input, { ...init, redirect: "error" });
  };
  const { captureForgeReconstruction, replayForgeSnapshot } = await import("../lib/projections/run-forge-projections");
  const codeFiles = Object.keys(require.cache).filter((path) => path.startsWith(`${root}${sep}`)
    && !path.includes(`${sep}node_modules${sep}`)).sort().map((path) => ({
      path: relative(root, path), sha256: createHash("sha256").update(new Uint8Array(readFileSync(path))).digest("hex"),
    }));
  const codeVersion = `worktree:${createHash("sha256").update(JSON.stringify(codeFiles)).digest("hex")}`;
  const startedAt = Date.now();
  const captured = await captureForgeReconstruction({ slateDate: date, gameId: Number(rawGameId), inputCutoff: cutoff,
    codeVersion, deadlineMs: startedAt + 150_000,
    controlledNews: newsFixture ? JSON.parse(readFileSync(newsFixture, "utf8")) : undefined });
  const calculationMs = Date.now() - startedAt;
  const readsAtReplay = reads;
  let replay: unknown = null;
  if (!captured.result.timedOut && captured.result.gamesProcessed === 1 && captured.result.playerRowsUpserted > 0) {
    replay = await replayForgeSnapshot(captured.snapshot, captured.snapshotHash);
  }
  if (reads !== readsAtReplay || rejectedRequests) throw new Error("Reconstruction or replay violated the read-only transport contract");
  writeFileSync(output, JSON.stringify({ payload: captured.snapshot, payload_hash: captured.snapshotHash,
    intendedWrites: captured.writes, codeFiles, diagnostics: { result: captured.result, calculationMs, networkReads: reads,
      replayNetworkReads: reads - readsAtReplay, rejectedRequests, replay,
      limitations: ["Historical reconstruction; current mutable inputs may differ from their historical versions.",
        "No historical news-arrival timestamps or prospective accuracy claims are inferred."] } }), { flag: "wx", mode: 0o600 });
  console.log(JSON.stringify({ output, inputHash: captured.snapshotHash, outputHash: captured.snapshot.outputHash,
    calculationMs, networkReads: reads, controlledScenario: captured.snapshot.controlledScenario ?? null, replay, result: captured.result }));
  if (!replay) process.exitCode = 1;
}
main().catch((error) => { console.error(error instanceof Error ? error.message : "Reconstruction failed"); process.exitCode = 1; });
