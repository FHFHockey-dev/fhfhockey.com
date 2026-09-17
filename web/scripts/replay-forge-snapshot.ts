import { readFileSync } from "node:fs";
import { replayForgeSnapshot } from "../lib/projections/run-forge-projections";

// Input is a private source-observation export, never a public board response.
// Replay intercepts all FORGE database queries and rejects unrecorded reads.
async function main() {
  const path = process.argv[2];
  if (!path) throw new Error("Supply a local source observation JSON export with payload and payload_hash.");
  const observation = JSON.parse(readFileSync(path, "utf8"));
  if (!observation.payload || typeof observation.payload_hash !== "string") {
    throw new Error("Expected a source observation containing payload and payload_hash.");
  }
  console.log(JSON.stringify(await replayForgeSnapshot(observation.payload, observation.payload_hash)));
}
main().catch((error) => { console.error(error.message); process.exitCode = 1; });
