// Offline Node entry points reuse the production parser without copying its calendar or precision rules.
const { resolve } = require("node:path");
const { createRequire } = require("node:module");
const web = resolve(__dirname, "../../../../../web");
const webRequire = createRequire(resolve(web, "package.json"));
if (!require.extensions[".ts"]) webRequire("ts-node").register({
  project: resolve(web, "tsconfig.json"), transpileOnly: true,
  compilerOptions: { module: "CommonJS", moduleResolution: "node" },
});
module.exports.timestampMicros = webRequire(resolve(web, "lib/projections/evidenceTime.ts")).timestampMicros;
