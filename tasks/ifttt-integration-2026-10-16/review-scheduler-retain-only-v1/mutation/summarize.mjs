import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { join } from "node:path";

const here = fileURLToPath(new URL(".", import.meta.url));
const out = join(here, "../evidence/mutation");
const manifest = JSON.parse(readFileSync(join(here, "mutants-manifest.json"), "utf8"));
const summary = {};
for (const [name, m] of Object.entries(manifest)) {
  const result = JSON.parse(readFileSync(join(out, `${name}.json`), "utf8"));
  const tests = result.testResults.flatMap((file) => file.assertionResults.map((a) => ({
    file: file.name.split("/").pop(), title: a.fullName, status: a.status })));
  summary[name] = { expect: m.expect, files: result.testResults.map((f) => f.name.split("/").pop()),
    passed: tests.filter((t) => t.status === "passed").length, total: tests.length,
    failed: tests.filter((t) => t.status !== "passed").map((t) => `${t.file} > ${t.title}`) };
}
writeFileSync(join(here, "../evidence/mutation-summary.json"), JSON.stringify(summary, null, 1) + "\n");
for (const [name, s] of Object.entries(summary)) console.log(`${name}: ${s.passed}/${s.total}${s.failed.length ? "\n  - " + s.failed.join("\n  - ") : ""}`);
