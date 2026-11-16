// Positive path over loopback via the tool's TEST dispatcher option (output is test-transport marked; frames refuse it in production).
import { cfg, loopbackAgent, report } from "./common.mjs";
const { acquire } = await import(cfg.tool);
console.log(JSON.stringify({ route: "test_dispatcher_happy", ...(await report(acquire({ conversionDir: cfg.conversion, outDir: cfg.out + "-happy", dispatcher: loopbackAgent(), spacingMs: 0 }))) }));
process.exit(0);
