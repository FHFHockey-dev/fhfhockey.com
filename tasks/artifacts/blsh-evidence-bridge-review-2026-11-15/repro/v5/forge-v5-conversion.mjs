// RECHECK-4: hand-written v5 packet (real v5-pinned sources, synthetic facts, zero network) converted under the APPROVED v5
// inputs WITHOUT the synthetic flag. Custody demonstration + an approved conversion for the tool's positive path.
// Usage: node forge-v5-conversion.mjs <scratchDir> <patchedV5WebDir>
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { BRIDGE, LINEAGE, NODE_SHA256, makePacket, sources } from "../packet.mjs";
const { convertPacket } = await import(join(BRIDGE, "convert.mjs"));
const V5 = join(BRIDGE, "approved/v5"), [scratch, web] = process.argv.slice(2);
const CA = "5aab51f94c9a1ad6b5185229b65ca308fcae0e6fdb31bdf6f34278e099fb024c", WEB = "/Users/tim/Code/fhfhockey.com/web";
const BOOT = `${WEB}/scripts/blsh/nativeProcessCaptureBootstrap.ts`, BOOT_SHA = JSON.parse(readFileSync(join(V5, "expected-pins.json"), "utf8"))._bootstrapSHA256;
const LAUNCH_ENV = ["NODE_PATH", "DISABLE_V8_COMPILE_CACHE", "TS_NODE_COMPILER_OPTIONS", "OPENSSL_CONF", "TS_NODE_PROJECT", "TS_NODE_SKIP_PROJECT", "TS_NODE_COMPILER",
  "TS_NODE_TRANSPILE_ONLY", "TS_NODE_REQUIRE", "TS_NODE_CWD", "TS_NODE_DIR", "TS_NODE_COMPILER_HOST", "TS_NODE_EMIT", "TS_NODE_SCOPE", "TS_NODE_SCOPE_DIR", "TS_NODE_SWC", "TS_NODE_TRANSPILER"];
const tls = Object.fromEntries([1, 2, 3, 4, 5].map(n => [n, t => ({ ...t, defaultCACertificatesSHA256: CA, globalDispatcher: { present: true, constructorName: "Agent", identityUnchanged: true } })]));
const dir = join(scratch, "pkt-v5-forged"), out = join(scratch, "conv-v5-forged");
makePacket(dir, { date: "2026-11-11", startedAtUTC: "2026-11-17T14:05:10.000Z", srcs: sources(web), tls,
  runtime: { launch: { entryScript: BOOT, entryScriptSHA256: BOOT_SHA, cwd: WEB, bootstrapPath: BOOT, bootstrapSHA256: BOOT_SHA, entryIsBootstrap: true,
    environmentPresence: Object.fromEntries(LAUNCH_ENV.map((k, i) => [k, i < 3])), otherTsNodeKeysPresent: [] },
    globalDispatcher: { present: true, constructorName: "Agent", sameAsRunnerLoad: true } } });
try { const c = convertPacket({ packetDir: dir, pinsPath: join(V5, "expected-pins.json"), verifierPath: join(V5, "verify-packet.mjs"), nodeSHA256: NODE_SHA256, lineagePath: LINEAGE, outDir: out });
  console.log(JSON.stringify({ ok: true, evidenceClass: c.evidenceClass, approvedInputs: c.approvedInputs, receiptTLSVerified: JSON.parse(readFileSync(join(out, "receipt-onIce.json"))).TLSVerified, out })); }
catch (e) { console.log(JSON.stringify({ ok: false, refusal: e.code ?? e.message })); }
