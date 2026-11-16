// BLSH operator: check a predicted RUNTIME.json (v5 shape) BEFORE the slot.
// Usage: node check-predicted-runtime.mjs <snapshot.json> <bootstrap.ts path> <expected-pins.json>
//  1. The evidence bridge's OWN checkRuntime (synthetic=false, NODE_SHA256 pin read from the bootstrap source,
//     expected bootstrap hash = expected-pins.json `_bootstrapSHA256`).
//  2. The successor verifier's v5 dispatcher rule: globalDispatcher exactly {present:true, constructorName:"Agent",
//     sameAsRunnerLoad:true}, and no dispatcher registered before the runtime imports.
// Both must pass. A bridge/candidate key-set disagreement is reported, never papered over.
import { readFileSync } from "node:fs";
import { checkRuntime } from "../../blsh-evidence-bridge-2026-11-15/convert.mjs";

const [snapshotPath, bootstrapPath, pinsPath] = process.argv.slice(2);
const { predicted, diagnostics } = JSON.parse(readFileSync(snapshotPath, "utf8"));
const pin = /const NODE_SHA256 = "([0-9a-f]{64})"/.exec(readFileSync(bootstrapPath, "utf8"))?.[1];
const expectedBootstrap = JSON.parse(readFileSync(pinsPath, "utf8"))._bootstrapSHA256;
const sameKeys = (o, keys) => !!o && typeof o === "object" && JSON.stringify(Object.keys(o).sort()) === JSON.stringify([...keys].sort());

let bridge;
try { checkRuntime(predicted, { startedAtUTC: predicted.startedAtUTC }, pin, false, expectedBootstrap); bridge = { result: "pass" }; }
catch (error) { bridge = { result: "veto", code: String(error?.code ?? error?.message ?? error) }; }
const g = predicted.globalDispatcher;
const dispatcherOk = sameKeys(g, ["present", "constructorName", "sameAsRunnerLoad"]) && g.present === true && g.constructorName === "Agent"
  && g.sameAsRunnerLoad === true && diagnostics?.dispatcherPreinstalledBeforeImports === false;
const pass = bridge.result === "pass" && dispatcherOk;
process.stdout.write(JSON.stringify({ checkRuntime: pass ? "pass" : "veto", bridge, dispatcher: dispatcherOk ? "pass" : "veto",
  nodePin: pin, expectedBootstrapSHA256: expectedBootstrap, predictedBootstrapSHA256: predicted.launch?.bootstrapSHA256 ?? null }) + "\n");
process.exitCode = pass ? 0 : 1;
