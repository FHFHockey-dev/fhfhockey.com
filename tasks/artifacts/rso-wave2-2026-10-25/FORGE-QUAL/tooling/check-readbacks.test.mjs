// Offline self-tests: node --test tooling/check-readbacks.test.mjs (no network, no DB, synthetic fixtures only).
import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { canonicalHash, checkReadbacks, readScope } from "./check-readbacks.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const fixture = name => JSON.parse(readFileSync(join(here, "fixtures", name), "utf8"));
const clean = () => ({ issued: fixture("issued.json"), consumers: { rso: fixture("rso.json"), start_chart: fixture("start-chart.json") },
  settlement: fixture("settlement.json"), scope: fixture("scope.json") });
const codes = report => Object.keys(report.summary.findingCodes).sort();

test("a matching issue, both readbacks and settlement pass", () => {
  const report = checkReadbacks(clean());
  assert.deepEqual(report.findings, []);
  assert.equal(report.summary.pass, true);
  assert.deepEqual(report.summary.coverage.rso, { issued: 2, matched: 2, readbacks: 2 });
  assert.equal(report.summary.settled, 2);
});

test("a readback missing from one consumer fails coverage", () => {
  const input = clean();
  input.consumers.start_chart = input.consumers.start_chart.slice(1);
  const report = checkReadbacks(input);
  assert.deepEqual(codes(report), ["readback_missing"]);
  assert.equal(report.findings[0].consumer, "start_chart");
});

test("an identity field that changed on the way fails, even with an equal value", () => {
  const input = clean();
  input.consumers.rso[0].artifactHash = "other-artifact";
  input.consumers.start_chart[1].participationRevisionId = "other-participation";
  const report = checkReadbacks(input);
  assert.deepEqual(report.findings.map(row => [row.consumer, row.field]), [["rso", "artifactHash"], ["start_chart", "participationRevisionId"]]);
});

test("a value outside tolerance fails; RSO's 4-decimal rounding passes", () => {
  const input = clean();
  input.consumers.rso[0].value.unconditionalMean = Math.round(input.issued[0].value.unconditionalMean * 10000) / 10000;
  assert.equal(checkReadbacks(input).summary.pass, true);
  input.consumers.rso[0].value.unconditionalMean += 0.01;
  assert.deepEqual(codes(checkReadbacks(input)), ["value_mismatch"]);
});

test("unknown must stay unknown: a null issued value read back as 0 fails", () => {
  const input = clean();
  input.issued[1].value.conditionalMean = null;
  input.consumers.rso[1].value.conditionalMean = 0;
  input.consumers.start_chart[1].value.conditionalMean = null;
  const report = checkReadbacks(input);
  assert.deepEqual(report.findings.map(row => [row.code, row.consumer]), [["value_mismatch", "rso"]]);
});

test("a consumer value with no issued row is invented", () => {
  const input = clean();
  input.consumers.rso.push({ ...input.consumers.rso[0], playerId: "8479999" });
  assert.deepEqual(codes(checkReadbacks(input)), ["readback_unissued"]);
});

test("issuance chronology: cutoff after issue, or issue after puck drop, fails", () => {
  const input = clean();
  input.issued[0].cutoffAt = "2026-11-03T18:00:00Z";
  input.issued[1].issuedAt = "2026-11-04T01:00:00Z";
  // RSO's readback carries cutoffAt, so the moved cutoff is also an identity mismatch there.
  assert.deepEqual(codes(checkReadbacks(input)), ["cutoff_after_issue", "identity_mismatch", "issued_after_puck_drop", "readback_before_issue"]);
});

test("rows outside the declared scope or missing identity are not qualified", () => {
  const input = clean();
  input.issued[0].method = "other-method";
  delete input.issued[1].artifactHash;
  const report = checkReadbacks(input);
  assert.ok(codes(report).includes("issued_out_of_scope"));
  assert.ok(codes(report).includes("issued_incomplete"));
});

test("the sealed Release C window: present outcomes fail, sealed rows are counted and never scored", () => {
  const input = clean();
  input.issued[0].gameDate = "2026-10-27";
  input.settlement[0].gameDate = "2026-10-27";
  const report = checkReadbacks(input);
  assert.deepEqual(codes(report), ["sealed_outcome_present"]);
  assert.equal(report.summary.sealedRows, 1);
  assert.equal(report.summary.settled, 1);
});

test("an outcome recorded before the game started does not settle", () => {
  const input = clean();
  input.settlement[1].recordedAt = "2026-11-03T20:00:00Z";
  const report = checkReadbacks(input);
  assert.deepEqual(codes(report), ["settlement_before_game"]);
  assert.equal(report.summary.settled, 1);
});

test("the CLI exits 0 on the clean fixture and 1 with findings", () => {
  const dir = join(here, "fixtures"), args = ["--issued", join(dir, "issued.json"), "--rso", join(dir, "rso.json"),
    "--start-chart", join(dir, "start-chart.json"), "--settlement", join(dir, "settlement.json"), "--scope", join(dir, "scope.json")];
  const report = JSON.parse(execFileSync(process.execPath, [join(here, "check-readbacks.mjs"), ...args], { encoding: "utf8" }));
  assert.equal(report.summary.pass, true);
  assert.equal(report.summary.protocolHash, fixture("scope.json").protocolHash);
  const bad = join(mkdtempSync(join(tmpdir(), "forge-qual-")), "rso.json");
  writeFileSync(bad, JSON.stringify(fixture("rso.json").slice(1)));
  let status = 0;
  try { execFileSync(process.execPath, [join(here, "check-readbacks.mjs"), ...args.slice(0, 2), "--rso", bad], { encoding: "utf8" }); }
  catch (error) { status = error.status; }
  assert.equal(status, 1);
});

test("the predeclared scope: its protocol hash must match, and an unpinned identity is refused outside dry runs", () => {
  const real = JSON.parse(readFileSync(join(here, "..", "scope.json"), "utf8"));
  assert.equal(canonicalHash(real.protocol), real.protocolHash);
  assert.deepEqual(readScope(real, { allowDraft: true }).problems, []);
  assert.match(readScope(real).problems.join(), /^identity_unpinned:method,codeVersion,configurationHash,artifactHash$/);
  assert.deepEqual(readScope(fixture("scope.json")).problems, []);
  const edited = structuredClone(real);
  edited.protocol.thresholds.absBiasMax = 0.1;
  assert.ok(readScope(edited, { allowDraft: true }).problems.includes("protocol_hash_mismatch"));
  // The fixture and the real scope declare the same protocol.
  assert.equal(fixture("scope.json").protocolHash, real.protocolHash);
});

test("an RSO readback that allows a use the claim does not cover fails", () => {
  const input = clean();
  input.consumers.rso[0].allowedUses = { assignment: false, totals: true, comparison: true, conditionalTieBreak: false };
  assert.equal(checkReadbacks(input).summary.pass, true);
  input.consumers.rso[1].allowedUses = { assignment: true, totals: true, comparison: true, conditionalTieBreak: false };
  const report = checkReadbacks(input);
  assert.deepEqual(report.findings.map(row => [row.code, row.use]), [["use_beyond_scope", "assignment"]]);
});

test("the CLI refuses a draft scope unless explicitly allowed", () => {
  const dir = join(here, "fixtures"), base = [join(here, "check-readbacks.mjs"), "--issued", join(dir, "issued.json"), "--rso", join(dir, "rso.json"),
    "--scope", join(here, "..", "scope.json")];
  let status = 0;
  try { execFileSync(process.execPath, base, { encoding: "utf8", stdio: "pipe" }); } catch (error) { status = error.status; }
  assert.equal(status, 2);
  const report = JSON.parse(execFileSync(process.execPath, [...base, "--allow-draft-scope", "true"], { encoding: "utf8" }));
  assert.equal(report.summary.protocolHash, JSON.parse(readFileSync(join(here, "..", "scope.json"), "utf8")).protocolHash);
});
