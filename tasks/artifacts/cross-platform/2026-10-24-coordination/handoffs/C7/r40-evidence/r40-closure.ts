// C7 R40: reproduce the verifier's closure hash from an independent archive, without writing into the repo.
import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import ts from "typescript";
// eslint-disable-next-line @typescript-eslint/no-var-requires
const verifier = require(process.env.C7_VERIFIER!);
const webRoot = process.env.C7_WEBROOT!;
const sha256 = (value: string) => createHash("sha256").update(value).digest("hex");
const config = ts.readConfigFile(join(webRoot, "tsconfig.json"), ts.sys.readFile);
const { options } = ts.parseJsonConfigFileContent(config.config, ts.sys, webRoot);
const scan = verifier.scanForgeClosure(webRoot, verifier.FORGE_RUN_ROOTS, options);
const modulesSha256 = sha256(scan.modules.map((file: string) => `${sha256(readFileSync(join(webRoot, file), "utf8"))}  ${file}`).join("\n"));
const out = { moduleCount: scan.modules.length, modulesSha256, findings: scan.findings.length, dynamicSites: scan.dynamicSites.length,
  guardRegexes: scan.guardRegexes.length, verifierFileSha256: sha256(readFileSync(process.env.C7_VERIFIER!, "utf8")) };
writeFileSync(process.env.C7_OUT!, JSON.stringify(out, null, 2));
console.log(JSON.stringify(out));
