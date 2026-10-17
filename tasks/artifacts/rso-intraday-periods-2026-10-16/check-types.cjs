const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const root = path.resolve(__dirname, "../../..");
const web = path.join(root, "web");
const ts = require(path.join(web, "node_modules/typescript"));
const configPath = path.join(web, "tsconfig.json");
const config = ts.readConfigFile(configPath, ts.sys.readFile);
if (config.error) throw new Error(ts.flattenDiagnosticMessageText(config.error.messageText, "\n"));
const parsed = ts.parseJsonConfigFileContent(config.config, ts.sys, web);
const roots = [
  "components/RosterScheduleOptimizer/AcquisitionPeriodTimes.tsx",
  "components/RosterScheduleOptimizer/AcquisitionPeriodTimes.test.tsx",
  "components/RosterScheduleOptimizer/RosterScheduleOptimizer.tsx",
  "lib/rosterScheduleOptimizer/periodBoundaries.ts",
  "lib/rosterScheduleOptimizer/periodBoundaries.test.ts",
  "lib/rosterScheduleOptimizer/planningTypes.ts",
  "lib/in-season/workspaceSchema.ts",
  "lib/in-season/workspaceSchema.test.ts",
  "__tests__/components/RosterScheduleOptimizer/AcquisitionRules.integration.test.tsx",
  "next-bootstrap.d.ts", "yahoo-fantasy.d.ts",
].map(file => path.join(web, file));
const startedAt = new Date().toISOString();
const program = ts.createProgram(roots, { ...parsed.options, noEmit: true, incremental: false });
const inputs = [...new Set([...program.getSourceFiles().map(file => file.fileName), configPath])].sort();
const pin = () => inputs.map(file => ({ path: path.relative(root, file), sha256: crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex") }));
const before = pin();
const diagnostics = [...parsed.errors, ...ts.getPreEmitDiagnostics(program)];
if (diagnostics.length) console.log(ts.formatDiagnosticsWithColorAndContext(diagnostics, {
  getCurrentDirectory: () => web, getCanonicalFileName: file => file, getNewLine: () => "\n",
}));
const after = pin();
const noDrift = JSON.stringify(before) === JSON.stringify(after);
fs.writeFileSync(path.join(__dirname, "typescript-inputs-before.json"), JSON.stringify(before, null, 2) + "\n");
fs.writeFileSync(path.join(__dirname, "typescript-inputs-after.json"), JSON.stringify(after, null, 2) + "\n");
const receipt = { startedAt, completedAt: new Date().toISOString(), typeScriptVersion: ts.version,
  scope: "Nine changed source/test roots plus bootstrap declarations and their imported dependency closure; not a full-tree compiler.",
  roots: roots.map(file => path.relative(root, file)), totalInputs: inputs.length,
  projectInputs: inputs.filter(file => !file.includes("/node_modules/")).length,
  diagnostics: diagnostics.length, noDrift, exitCode: diagnostics.length || !noDrift ? 1 : 0 };
fs.writeFileSync(path.join(__dirname, "typescript-receipt.json"), JSON.stringify(receipt, null, 2) + "\n");
console.log(JSON.stringify(receipt));
process.exitCode = receipt.exitCode;
