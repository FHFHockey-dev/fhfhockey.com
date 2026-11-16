// RECHECK-4: v5 dispatcher facts in the bridge's own checks (direct calls; no verifier). Imports the bridge read-only.
import { readFileSync } from "node:fs";
import { join } from "node:path";
const BRIDGE = "/Users/tim/Code/fhfhockey.com/tasks/artifacts/blsh-evidence-bridge-2026-11-15";
const { checkRuntime, verifyTlsChain, APPROVED, RUNTIME_DISPATCHER } = await import(join(BRIDGE, "convert.mjs"));
const pkt = process.argv[2]; // a v5 rehearsal packet (synthetic) for real shapes
const rt0 = JSON.parse(readFileSync(join(pkt, "RUNTIME.json"), "utf8")), started = JSON.parse(readFileSync(join(pkt, "STARTED.json"), "utf8"));
const ops = Object.fromEntries([1, 2, 3, 4, 5].map(n => [n, { started: JSON.parse(readFileSync(join(pkt, `operation-${n}-STARTED.json`), "utf8")), settled: JSON.parse(readFileSync(join(pkt, `operation-${n}-SETTLED.json`), "utf8")) }]));
const obs = Object.fromEntries(["schedule", "individual", "onIce"].map(g => [g, JSON.parse(readFileSync(join(pkt, `${g}.TRANSPORT-OBSERVATION.json`), "utf8"))]));
const code = fn => { try { fn(); return "accepted"; } catch (e) { return e.code ?? `uncaught:${e.message}`; } };
const clone = v => JSON.parse(JSON.stringify(v));
const rt = (edit = r => r) => code(() => checkRuntime(edit(clone(rt0)), started, rt0.node.execPathSHA256, true, rt0.launch.bootstrapSHA256));
const chain = (edit = o => o, disp = rt0.globalDispatcher) => { const o = edit(clone(ops)), b = clone(obs); b.schedule.tls = o[1].settled.tls; b.individual.tls = o[3].settled.tls; b.onIce.tls = o[5].settled.tls;
  return code(() => verifyTlsChain(o, b, rt0.tls.defaultCACertificatesSHA256, disp)); };
const out = [];
out.push(["RUNTIME_DISPATCHER constant", JSON.stringify(RUNTIME_DISPATCHER)]);
out.push(["checkRuntime v5 packet as written", rt()]);
out.push(["checkRuntime globalDispatcher missing (v4 shape)", rt(r => { delete r.globalDispatcher; return r; })]);
out.push(["checkRuntime sameAsRunnerLoad false", rt(r => { r.globalDispatcher.sameAsRunnerLoad = false; return r; })]);
out.push(["checkRuntime constructorName ProxyAgent", rt(r => { r.globalDispatcher.constructorName = "ProxyAgent"; return r; })]);
out.push(["checkRuntime extra key in globalDispatcher", rt(r => { r.globalDispatcher.note = 1; return r; })]);
out.push(["verifyTlsChain v5 ops as written (15 keys)", chain()]);
out.push(["verifyTlsChain per-op globalDispatcher removed (v4 14-key shape)", chain(o => { for (const n in o) delete o[n].settled.tls.globalDispatcher; return o; })]);
out.push(["verifyTlsChain op4 identityUnchanged false", chain(o => { o[4].settled.tls.globalDispatcher.identityUnchanged = false; return o; })]);
out.push(["verifyTlsChain op4 constructorName differs from RUNTIME", chain(o => { o[4].settled.tls.globalDispatcher.constructorName = "ProxyAgent"; return o; })]);
out.push(["verifyTlsChain RUNTIME.globalDispatcher missing -> null", chain(o => o, null)]);
for (const [k, v] of out) console.log(JSON.stringify({ probe: k, result: v }));
