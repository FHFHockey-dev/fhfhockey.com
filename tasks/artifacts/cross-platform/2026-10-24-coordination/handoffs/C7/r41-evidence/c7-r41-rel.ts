import ts from "typescript";
import { join } from "node:path";
// eslint-disable-next-line @typescript-eslint/no-var-requires
const c = require("./forge-producer-closure");
const webRoot = "/private/tmp/c7-r41/rel/web";
const cfg = ts.readConfigFile(join(webRoot, "tsconfig.json"), ts.sys.readFile);
const { options } = ts.parseJsonConfigFileContent(cfg.config, ts.sys, webRoot);
const scan = c.scanForgeClosure(webRoot, c.FORGE_RUN_ROOTS, options);
console.log(JSON.stringify({ modules: scan.modules.length, findings: scan.findings.length, hash: c.forgeClosureSha256(webRoot, scan.modules) }));
