// Route: mid-run swap. Op 1 goes through the test dispatcher option (loopback); a global dispatcher is installed during spacing.
import { cfg, loopbackAgent, setGlobalDispatcher, report } from "./common.mjs";
const { acquire } = await import(cfg.tool);
setTimeout(() => setGlobalDispatcher(loopbackAgent()), 400);
console.log(JSON.stringify({ route: "midrun_global_swap", ...(await report(acquire({ conversionDir: cfg.conversion, outDir: cfg.out + "-midrun", dispatcher: loopbackAgent(), spacingMs: 1000 }))) }));
process.exit(0);
