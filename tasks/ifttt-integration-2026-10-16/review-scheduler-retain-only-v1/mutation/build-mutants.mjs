// Builds mutant source trees for the R21 review. Reads live and before/ bytes; writes only under ./mutants.
// Each mutant directory holds the two R21 runtime files, byte copies of their unchanged relative imports,
// and a byte copy of iftttIntakePolicy.test.ts (it imports "./iftttIntakePolicy" relatively).
import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { join } from "node:path";

const here = fileURLToPath(new URL(".", import.meta.url));
const live = fileURLToPath(new URL("../../../../web/lib/sources/", import.meta.url));
const before = fileURLToPath(new URL("../../scheduler-retain-only-v1/before/", import.meta.url));
const read = (dir, name) => readFileSync(join(dir, name), "utf8");
const sha = (text) => createHash("sha256").update(text).digest("hex");
const once = (text, from, to, label) => {
  const count = text.split(from).length - 1;
  if (count !== 1) throw new Error(`${label}: expected exactly one match, found ${count}`);
  return text.replace(from, to);
};

const livePolicy = read(live, "iftttIntakePolicy.ts");
const liveReceiver = read(live, "lineSourceIftttReceiver.ts");
const guardLine = '  if (iftttIntakePilotConfigured()) return { attempted: 0, failed: 0, results: [], skipped: "controlled_intake" as const };\n';
const predicate = 'return !((flag === undefined || flag === "false") && process.env.IFTTT_INTAKE_POLICY === undefined\n    && (stop === undefined || stop === "false"));';

const mutants = {
  // Harness control: live bytes. Every nearest test must pass.
  control: { policy: livePolicy, receiver: liveReceiver, expect: "34/34 pass" },
  // The exact pre-fix bytes.
  before: { policy: read(before, "iftttIntakePolicy.ts"), receiver: read(before, "lineSourceIftttReceiver.ts"), expect: "both new scheduler cases fail" },
  // Helper kept, guard line deleted.
  "no-guard": { policy: livePolicy, receiver: once(liveReceiver, guardLine, "", "no-guard"), expect: "both new scheduler cases fail" },
  // Guard only for a fully enabled flag (misses stop-only, policy-only and odd flag spellings).
  "guard-flag-true-only": { policy: livePolicy,
    receiver: once(liveReceiver, "if (iftttIntakePilotConfigured()) return", 'if (process.env.IFTTT_RECEIPT_VARIANTS_ENABLED === "true") return', "flag-only"),
    expect: "stop-only case fails" },
  // Shared predicate ignores IFTTT_INTAKE_STOP (affects receivers too).
  "predicate-ignores-stop": { policy: once(livePolicy, predicate,
    'return !((flag === undefined || flag === "false") && process.env.IFTTT_INTAKE_POLICY === undefined);', "ignores-stop"),
    receiver: liveReceiver, expect: "stop-only case fails" },
  // Shared predicate ignores IFTTT_INTAKE_POLICY presence (affects receivers too).
  "predicate-ignores-policy": { policy: once(livePolicy, predicate,
    'return !((flag === undefined || flag === "false") && (stop === undefined || stop === "false"));', "ignores-policy"),
    receiver: liveReceiver, expect: "not caught by the new scheduler cases; caught by the policy legacy-default case" },
  // Guard inverted.
  "guard-inverted": { policy: livePolicy, receiver: once(liveReceiver, "if (iftttIntakePilotConfigured()) return", "if (!iftttIntakePilotConfigured()) return", "inverted"),
    expect: "new cases and both 6-request cases fail" },
  // Guard returns without the skipped marker.
  "no-skipped-marker": { policy: livePolicy, receiver: once(liveReceiver, ', skipped: "controlled_intake" as const }', " }", "marker"),
    expect: "both new scheduler cases fail on the response contract" },
};

const copies = ["iftttReceiptRetention.ts", "iftttRpcDeadline.ts", "iftttIntakePolicy.test.ts"];
const manifest = {};
rmSync(join(here, "mutants"), { recursive: true, force: true });
for (const [name, m] of Object.entries(mutants)) {
  const dir = join(here, "mutants", name);
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, "iftttIntakePolicy.ts"), m.policy);
  writeFileSync(join(dir, "lineSourceIftttReceiver.ts"), m.receiver);
  for (const file of copies) writeFileSync(join(dir, file), read(live, file));
  manifest[name] = { expect: m.expect, policy: sha(m.policy), receiver: sha(m.receiver),
    copies: Object.fromEntries(copies.map((file) => [file, sha(read(live, file))])) };
}
writeFileSync(join(here, "mutants-manifest.json"), JSON.stringify(manifest, null, 1) + "\n");
console.log(Object.keys(manifest).join(" "));
