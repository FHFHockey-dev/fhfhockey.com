// RECHECK-6: preload that records require.cache + public builtins when the process exits (DUMP_OUT path, scratch only).
"use strict";
const fs = require("node:fs"), { builtinModules } = require("node:module");
const pub = new Set(builtinModules);
process.on("exit", () => fs.writeFileSync(process.env.DUMP_OUT, JSON.stringify({ cacheKeys: Object.keys(require.cache).sort(),
  builtins: [...new Set(process.moduleLoadList.filter(e => e.startsWith("NativeModule ")).map(e => e.slice(13)).filter(n => pub.has(n)))].sort() }) + "\n"));
