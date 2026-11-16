// Route: a global dispatcher installed before the tool runs (wrapper entry). Expect global_dispatcher_preinstalled.
import { cfg, loopbackAgent, setGlobalDispatcher, report } from "./common.mjs";
setGlobalDispatcher(loopbackAgent());
const { acquire } = await import(cfg.tool);
console.log(JSON.stringify({ route: "preinstalled_global", ...(await report(acquire({ conversionDir: cfg.conversion, outDir: cfg.out + "-preinstall", spacingMs: 0 }))) }));
process.exit(0);
