// BLSH operator: list every module file the capture process loads, WITHOUT running the capture.
// Launch exactly like the bootstrap (from web/, env -i + loader env):
//   node --require ./node_modules/ts-node/register/transpile-only <this>
// It requires the bootstrap, preparation, runner and adapter modules (their top-level code only).
// It never calls the adapter factory, the runner, prepareNativeProcessCapture or any dispatching function.
// No hooks or monkeypatching: it reads require.cache and process.moduleLoadList after loading. No network, no writes.
"use strict";
const path = require("node:path");
const { builtinModules } = require("node:module");
const before = new Set(process.moduleLoadList);
const cwd = process.cwd();
for (const rel of ["scripts/blsh/nativeProcessCaptureBootstrap.ts", "scripts/blsh/nativeProcessCapturePreparation.ts",
  "scripts/blsh/nativeProcessCaptureRunner.ts", "scripts/blsh/nativeProcessCaptureAdapter.ts"]) {
  require(path.join(cwd, rel));
}
const publicBuiltins = new Set(builtinModules);
const builtins = [...new Set(process.moduleLoadList
  .filter(e => e.startsWith("NativeModule "))
  .map(e => e.slice("NativeModule ".length))
  .filter(name => publicBuiltins.has(name)))].sort();
const newlyLoadedBuiltins = builtins.filter(name => !before.has(`NativeModule ${name}`));
process.stdout.write(JSON.stringify({
  harness: __filename,
  cwd,
  execArgv: process.execArgv,
  cacheKeys: Object.keys(require.cache).sort(),
  builtins,
  builtinsLoadedByCaptureModules: newlyLoadedBuiltins,
}) + "\n");
