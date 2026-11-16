/* Offline: does loading the successor's real import graph (preparation, runner, adapter and the
 * pinned lib/nst modules it imports) install a global undici dispatcher? Nothing is constructed
 * or called; no network. Run from the patched export's web/ with ts-node transpile-only. */
/* eslint-disable @typescript-eslint/no-require-imports */
import { resolve } from "node:path";
const KEY = Symbol.for("undici.globalDispatcher.1");
const state = () => { const v = (globalThis as unknown as Record<symbol, unknown>)[KEY]; return v === undefined ? "unset" : (v as object).constructor?.name ?? "object"; };
const out: Record<string, string> = { atStart: state() };
for (const file of ["nativeProcessCapturePreparation.ts", "nativeProcessCaptureRunner.ts", "nativeProcessCaptureAdapter.ts", "nativeProcessCaptureBootstrap.ts"]) {
  require(resolve(process.cwd(), "scripts/blsh", file)); out[`after:${file}`] = state();
}
process.stdout.write(`${JSON.stringify({ node: process.version, ...out })}\n`);
