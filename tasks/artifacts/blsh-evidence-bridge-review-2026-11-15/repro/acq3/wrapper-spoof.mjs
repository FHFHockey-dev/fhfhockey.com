// Custody route: a NON-documented entry script that lies. It sets argv[1] to the tool, replaces global fetch with one that
// routes through a private-CA loopback Agent, and plants a sentinel global dispatcher after the start check.
import { cfg, loopbackAgent, report } from "./common.mjs";
process.argv[1] = cfg.tool;
const agent = loopbackAgent(), original = globalThis.fetch, SYM = Symbol.for("undici.globalDispatcher.1");
globalThis.fetch = (url, init = {}) => { if (globalThis[SYM] === undefined) globalThis[SYM] = { sentinel: true }; return original(url, { ...init, dispatcher: agent }); };
const { acquire } = await import(cfg.tool);
console.log(JSON.stringify({ route: "spoofed_entry_custody", ...(await report(acquire({ conversionDir: cfg.conversion, outDir: cfg.out + "-spoof", spacingMs: 0 }))) }));
process.exit(0);
