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
  assert.deepEqual(codes(report), ["sealed_issued_present", "sealed_outcome_present", "sealed_readback_present"]);
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
    "--start-chart", join(dir, "start-chart.json"),
    "--scope", join(here, "..", "scope.json")];
  let status = 0;
  try { execFileSync(process.execPath, base, { encoding: "utf8", stdio: "pipe" }); } catch (error) { status = error.status; }
  assert.equal(status, 2);
  const report = JSON.parse(execFileSync(process.execPath, [...base, "--allow-draft-scope", "true"], { encoding: "utf8" }));
  assert.equal(report.summary.protocolHash, JSON.parse(readFileSync(join(here, "..", "scope.json"), "utf8")).protocolHash);
});


test("a scoped check requires every declared consumer, not just those supplied", () => {
  const input = clean();
  delete input.consumers.start_chart;
  const report = checkReadbacks(input);
  assert.equal(report.summary.pass, false);
  assert.ok(codes(report).includes("consumer_missing"));
  assert.ok(report.findings.some(row => row.code === "consumer_missing" && row.consumer === "start_chart"));
});

test("an empty issued population cannot pass integrity", () => {
  const input = clean();
  input.issued = [];
  input.consumers = { rso: [], start_chart: [] };
  input.settlement = [];
  const report = checkReadbacks(input);
  assert.equal(report.summary.pass, false);
  assert.ok(codes(report).includes("issued_empty"));
});

test("sealed issued rows and their readbacks fail even without outcomes", () => {
  const input = clean();
  input.issued[0].gameDate = "2026-10-27";
  input.settlement = null;
  const report = checkReadbacks(input);
  assert.equal(report.summary.pass, false);
  assert.ok(codes(report).includes("sealed_issued_present"));
  assert.equal(report.summary.findingCodes.sealed_readback_present, 2);
  assert.equal(report.summary.sealedRows, 1);
  assert.equal(report.summary.issued, 1);
});

test("an independently dated sealed readback is rejected", () => {
  const input = clean();
  input.consumers.rso[0].gameDate = "2026-10-27";
  const report = checkReadbacks(input);
  assert.equal(report.summary.pass, false);
  assert.ok(codes(report).includes("sealed_readback_present"));
});

test("the CLI cannot narrow the frozen scope's sealed window", () => {
  const dir = join(here, "fixtures"), args = [join(here, "check-readbacks.mjs"), "--issued", join(dir, "issued.json"),
    "--rso", join(dir, "rso.json"), "--start-chart", join(dir, "start-chart.json"), "--scope", join(dir, "scope.json"),
    "--sealed", "2026-10-23..2026-10-24"];
  let status = 0;
  try { execFileSync(process.execPath, args, { encoding: "utf8", stdio: "pipe" }); }
  catch (error) { status = error.status; }
  assert.equal(status, 2);
});

test("scoped readbacks require an actual capture timestamp from each consumer", () => {
  for (const consumer of ["rso", "start_chart"]) for (const timestamp of [undefined, "not-a-time"]) {
    const input = clean();
    input.consumers[consumer][0].observedAt = timestamp;
    const report = checkReadbacks(input);
    assert.equal(report.summary.pass, false);
    assert.ok(report.findings.some(row => row.code === "readback_capture_time_missing_or_invalid" && row.consumer === consumer));
  }
});

test("a matching readback at or after puck drop cannot pass prospective integrity", () => {
  for (const consumer of ["rso", "start_chart"]) for (const timestamp of ["2026-11-03T23:00:00Z", "2026-11-04T12:00:00Z"]) {
    const input = clean();
    input.consumers[consumer][0].observedAt = timestamp;
    const report = checkReadbacks(input);
    assert.equal(report.summary.pass, false);
    assert.ok(report.findings.some(row => row.code === "readback_not_pregame" && row.consumer === consumer));
  }
});

test("microsecond cutoff ordering allows equality but rejects a later input", () => {
  for (const digit of [1, 2, 3]) {
    const input = clean(), row = input.issued[0];
    row.issuedAt = "2026-11-03T16:00:00.000002Z";
    row.cutoffAt = `2026-11-03T16:00:00.00000${digit}Z`;
    for (const rows of Object.values(input.consumers)) rows[0].cutoffAt = row.cutoffAt;
    assert.equal(codes(checkReadbacks(input)).includes("cutoff_after_issue"), digit > 2);
  }
});

test("microsecond issuance must be strictly before puck drop", () => {
  for (const digit of [1, 2, 3]) {
    const input = clean(), row = input.issued[0];
    row.scheduledAt = "2026-11-03T23:00:00.000002Z";
    row.issuedAt = `2026-11-03T23:00:00.00000${digit}Z`;
    assert.equal(codes(checkReadbacks(input)).includes("issued_after_puck_drop"), digit >= 2);
  }
});

test("microsecond readbacks may equal issue time but cannot precede it", () => {
  for (const digit of [1, 2, 3]) {
    const input = clean(); input.issued[0].issuedAt = "2026-11-03T16:00:00.000002Z";
    for (const rows of Object.values(input.consumers)) rows[0].observedAt = `2026-11-03T11:00:00.00000${digit}-05:00`;
    assert.equal(codes(checkReadbacks(input)).includes("readback_before_issue"), digit < 2);
  }
});

test("microsecond readbacks must remain strictly before puck drop", () => {
  for (const digit of [1, 2, 3]) {
    const input = clean(); input.issued[0].scheduledAt = "2026-11-03T23:00:00.000002Z";
    for (const rows of Object.values(input.consumers)) rows[0].observedAt = `2026-11-03T23:00:00.00000${digit}Z`;
    assert.equal(codes(checkReadbacks(input)).includes("readback_not_pregame"), digit >= 2);
  }
});

test("microsecond settlement must be strictly after puck drop", () => {
  for (const digit of [1, 2, 3]) {
    const input = clean(); input.issued[0].scheduledAt = "2026-11-03T23:00:00.000002Z";
    input.settlement[0].recordedAt = `2026-11-03T23:00:00.00000${digit}Z`;
    const result = checkReadbacks(input);
    assert.equal(codes(result).includes("settlement_before_game"), digit <= 2);
    assert.equal(result.summary.settled, digit > 2 ? 2 : 1);
  }
});

test("raw readback clocks require explicit zones, real dates and supported precision", () => {
  for (const observedAt of ["2026-11-03T16:30:00", "2026-11-31T16:30:00Z", "2027-02-29T16:30:00Z", "2026-11-03T16:30:00.1234567Z"]) {
    const input = clean(); input.consumers.rso[0].observedAt = observedAt;
    assert.ok(codes(checkReadbacks(input)).includes("readback_capture_time_missing_or_invalid"), observedAt);
  }
});

test("raw issued and settlement clocks cannot coerce an invalid timestamp into a comparison", () => {
  for (const [field, value, code] of [["cutoffAt", "2026-11-03T15:00:00", "cutoff_after_issue"],
    ["issuedAt", "2026-11-03T16:00:00", "issued_after_puck_drop"],
    ["scheduledAt", "2026-11-03T23:00:00", "issued_after_puck_drop"],
    ["recordedAt", "2026-11-04T03:00:00", "settlement_before_game"]]) {
    const input = clean();
    (field === "recordedAt" ? input.settlement[0] : input.issued[0])[field] = value;
    assert.ok(codes(checkReadbacks(input)).includes(code), field);
  }
});
