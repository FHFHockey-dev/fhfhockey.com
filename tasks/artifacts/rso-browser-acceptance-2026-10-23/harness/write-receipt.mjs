// Writes RECEIPT-<label>.json and copies screenshots for one run-acceptance.sh run.
// Hashes are read from the exported candidate, never from the moving checkout. A worktree-debug
// run writes only to its scratch results folder, so it can never be mistaken for acceptance.
import { createHash } from "node:crypto";
import { copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import path from "node:path";

const args = Object.fromEntries(process.argv.slice(2).reduce((pairs, value, index, all) =>
  value.startsWith("--") ? [...pairs, [value.slice(2), all[index + 1]]] : pairs, []));
const sha = file => existsSync(file) ? createHash("sha256").update(readFileSync(file)).digest("hex") : null;
const web = path.join(args.export, "web");
const debug = args.type === "worktree-debug";
const validation = args.validation === "1";
const destination = debug ? args.results : validation ? path.join(args.artifacts, "harness-validation") : args.artifacts;
const shots = path.join(destination, "screenshots", args.label);

const keyFiles = [
  ...readdirSync(path.join(web, "components/RosterScheduleOptimizer"))
    .filter(name => /\.tsx$/.test(name) && !/\.test\.tsx$/.test(name)).sort()
    .map(name => `components/RosterScheduleOptimizer/${name}`),
  "lib/player-forecasts/rsoUsePolicy.ts",
  "lib/rosterScheduleOptimizer/currentPlanningRead.ts",
  "lib/player-forecasts/resolvedPlanningForecast.ts",
  "lib/rosterScheduleOptimizer/planning.ts",
  "lib/rosterScheduleData/bridgeForecastWire.ts",
  "pages/api/v1/roster-schedule-optimizer/data.ts",
  "components/StatsPage/PlayerSearchBar.tsx",
  "e2e/roster-schedule-optimizer.spec.ts",
  "e2e/draft-pro-fixtures.ts",
  "package-lock.json",
];
const harnessDir = path.join(args.artifacts, "harness");
const harness = Object.fromEntries(readdirSync(harnessDir).sort().map(name => [name, sha(path.join(harnessDir, name))]));

const viewports = { desktop: "1440x900", mobile: "375x812 (Pixel 5, touch)", chromium: "set inside each test (project default 1280x720)" };
function walk(suite, file, out) {
  for (const spec of suite.specs ?? []) for (const run of spec.tests ?? []) {
    const results = run.results ?? [];
    const last = results.at(-1) ?? {};
    const skip = (run.annotations ?? []).find(note => note.type === "skip");
    out.push({
      file: spec.file ?? file, line: spec.line, title: spec.title, project: run.projectName,
      viewport: viewports[run.projectName] ?? null,
      result: run.status === "skipped" ? "skipped" : run.status === "expected" ? "passed" : run.status === "flaky" ? "flaky" : "failed",
      startedAt: last.startTime ?? null, durationMs: last.duration ?? null, retries: Math.max(0, results.length - 1),
      skipReason: skip?.description ?? null,
      error: last.error?.message ? String(last.error.message).replace(/\u001b\[[0-9;]*m/g, "").split("\n").slice(0, 6).join("\n") : null,
    });
  }
  for (const child of suite.suites ?? []) walk(child, child.file ?? file, out);
  return out;
}
const report = name => {
  const file = path.join(args.results, name);
  if (!existsSync(file)) return { file, missing: true, tests: [] };
  const json = JSON.parse(readFileSync(file, "utf8"));
  return { file, tests: (json.suites ?? []).flatMap(suite => walk(suite, suite.file, [])), errors: (json.errors ?? []).map(error => error.message) };
};
const acceptance = report("acceptance.json");
const existing = report("existing.json");

mkdirSync(shots, { recursive: true });
const screenshots = [];
for (const dir of ["acceptance-results", "existing-results"]) {
  const root = path.join(args.results, dir);
  const visit = folder => existsSync(folder) && readdirSync(folder).forEach(name => {
    const full = path.join(folder, name);
    if (statSync(full).isDirectory()) return visit(full);
    if (!name.endsWith(".png")) return;
    // The candidate's own specs: keep deliberate screenshots; failure captures stay in the scratch results.
    if (dir === "existing-results" && name.startsWith("test-failed-")) return;
    const target = path.join(shots, `${dir.split("-")[0]}__${path.relative(root, full).replace(/[\\/]/g, "__")}`);
    copyFileSync(full, target);
    screenshots.push({ path: path.relative(destination, target), sha256: sha(target) });
  });
  visit(root);
}

const count = tests => tests.reduce((totals, test) => ({ ...totals, [test.result]: (totals[test.result] ?? 0) + 1 }), {});
const receipt = {
  kind: debug ? "HARNESS DEBUG RUN (working-tree copy) - NOT A CANDIDATE, NOT ACCEPTANCE"
    : validation ? "HARNESS VALIDATION on a non-candidate commit - NOT ACCEPTANCE" : "CR-REL-04 / R6 browser acceptance",
  candidate: { id: args.candidate, objectType: args.type, tree: args.tree || null, exportedWith: debug ? "rsync of working tree" : "git archive <id> web" },
  goaliePolicy: args.policy,
  startedAt: args.started, finishedAt: new Date().toISOString(),
  environment: {
    server: `next dev on 127.0.0.1:${args.port} from the export (PLAYWRIGHT_ISOLATED_NEXT=1, env -i, backend URLs -> http://127.0.0.1:9)`,
    browser: "Playwright Chromium (bundled build), fictional fixtures, non-local requests aborted, unmocked /api/** -> 503",
    nodeModules: "symlink to /Users/tim/Code/fhfhockey.com/web/node_modules",
    packageLock: { candidate: args["lock-candidate"], installed: args["lock-installed"], match: args["lock-candidate"] === args["lock-installed"] },
    productionRequests: 0,
  },
  keyFileSha256: Object.fromEntries(keyFiles.map(file => [`web/${file}`, sha(path.join(web, file))])),
  harnessSha256: harness,
  specs: {
    acceptance: { exitCode: Number(args["acceptance-exit"]), summary: count(acceptance.tests), errors: acceptance.errors ?? [], missing: acceptance.missing ?? false, tests: acceptance.tests },
    existing: { files: (args["existing-specs"] ?? "").split(" ").filter(Boolean), exitCode: Number(args["existing-exit"]), summary: count(existing.tests), errors: existing.errors ?? [], missing: existing.missing ?? false, tests: existing.tests },
  },
  screenshots,
};
const out = path.join(destination, `RECEIPT-${args.label}.json`);
writeFileSync(out, `${JSON.stringify(receipt, null, 2)}\n`);
console.log(`receipt ${out} sha256 ${sha(out)}`);
