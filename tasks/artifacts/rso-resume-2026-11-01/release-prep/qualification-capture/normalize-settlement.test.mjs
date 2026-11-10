import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync, symlinkSync, rmSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { normalizeSettlement } from "./normalize-settlement.mjs";
import { checkReadbacks } from "../qualification-readbacks/tooling/check-readbacks.mjs";

const fixture = () => ({
  capture: { date: "2026-11-02", observedAt: "2026-11-03T17:00:00Z", gameIds: [2026020232], settlementVersion: 1 },
  issued: [{ playerId: "1", gameId: "2026020232", target: "SHOTS_ON_GOAL", gameDate: "2026-11-02",
    revisionId: "synthetic-revision", method: "synthetic-method", codeVersion: "a".repeat(40),
    configurationHash: "b".repeat(64), artifactHash: "c".repeat(64), horizon: 1,
    participationRevisionId: "synthetic-participation", cutoffAt: "2026-11-02T22:00:00Z",
    issuedAt: "2026-11-02T22:05:00Z", scheduledAt: "2026-11-03T00:00:00Z", value: { unconditionalMean: 2.5 } }],
  outcomes: [{ player_id: 1, game_id: 2026020232, shots_es: 2, shots_pp: 1, shots_pk: 0, updated_at: "2026-11-03T03:00:00Z" }],
});

test("complete observed strengths sum once and feed the integrity checker", () => {
  const input = fixture(), result = normalizeSettlement(input);
  assert.equal(result.rows[0].actual, 3);
  assert.equal(result.rows[0].recordedAt, input.outcomes[0].updated_at);
  assert.equal(result.audit.observedRows, 1);
  const readback = { ...input.issued[0], observedAt: "2026-11-02T23:00:00Z" };
  const report = checkReadbacks({ issued: input.issued, consumers: { rso: [readback], start_chart: [readback] }, settlement: result.rows });
  assert.equal(report.summary.pass, true); assert.equal(report.summary.settled, 1);
  assert.equal(result.audit.qualificationGranted, false);
});

test("any missing strength or entire missing player row stays unknown", () => {
  for (const field of ["shots_es", "shots_pp", "shots_pk"]) {
    const input = fixture(); input.outcomes[0][field] = null;
    const result = normalizeSettlement(input);
    assert.equal(result.rows[0].actual, null); assert.equal(result.rows[0].exclusionReason, "strength_component_missing");
  }
  const input = fixture(); input.outcomes = [];
  const result = normalizeSettlement(input);
  assert.equal(result.rows.length, 1); assert.equal(result.rows[0].actual, null);
  assert.equal(result.rows[0].recordedAt, null); assert.equal(result.rows[0].exclusionReason, "source_row_missing");
  assert.equal(result.audit.nonDresserZeroInferred, false);
});

test("three observed zeros remain zero without treating absence as a non-dresser", () => {
  const input = fixture(); Object.assign(input.outcomes[0], { shots_es: 0, shots_pp: 0, shots_pk: 0 });
  assert.equal(normalizeSettlement(input).rows[0].actual, 0);
});

test("missing or pregame source clocks cannot settle a row", () => {
  for (const updated_at of [null, "2026-11-02T23:00:00Z", "2026-11-03T00:00:00Z"]) {
    const input = fixture(); input.outcomes[0].updated_at = updated_at;
    assert.equal(normalizeSettlement(input).rows[0].actual, null);
  }
});

test("capture respects D+1 noon New York on each side of the DST change", () => {
  const winter = fixture(); winter.capture.observedAt = "2026-11-03T16:59:59Z";
  assert.throws(() => normalizeSettlement(winter), /declared_read_window/);
  const summer = fixture(); summer.capture.date = summer.issued[0].gameDate = "2026-10-31";
  summer.capture.observedAt = "2026-11-01T17:00:00Z";
  summer.issued[0].issuedAt = "2026-10-31T22:05:00Z"; summer.issued[0].scheduledAt = "2026-11-01T00:00:00Z";
  summer.outcomes[0].updated_at = "2026-11-01T03:00:00Z";
  assert.equal(normalizeSettlement(summer).rows[0].actual, 3);
  const daylight = fixture(); daylight.capture.date = daylight.issued[0].gameDate = "2027-07-01";
  daylight.capture.observedAt = "2027-07-02T16:00:00Z";
  daylight.issued[0].issuedAt = "2027-07-01T22:05:00Z"; daylight.issued[0].scheduledAt = "2027-07-02T00:00:00Z";
  daylight.outcomes[0].updated_at = "2027-07-02T03:00:00Z";
  assert.equal(normalizeSettlement(daylight).rows[0].actual, 3);
});

test("malformed counts and future source updates fail rather than being coerced", () => {
  for (const value of [-1, 1.5, "2", NaN, Infinity]) {
    const input = fixture(); input.outcomes[0].shots_es = value;
    assert.throws(() => normalizeSettlement(input), /shots_invalid/);
  }
  const input = fixture(); input.outcomes[0].updated_at = "2026-11-03T17:00:01Z";
  assert.throws(() => normalizeSettlement(input), /source_from_future/);
});

test("duplicates and foreign game/date/target rows cannot change the frozen population", () => {
  const duplicate = fixture(); duplicate.outcomes.push({ ...duplicate.outcomes[0] });
  assert.throws(() => normalizeSettlement(duplicate), /duplicate_settlement/);
  const issued = fixture(); issued.issued.push({ ...issued.issued[0] });
  assert.throws(() => normalizeSettlement(issued), /duplicate_issued/);
  const foreign = fixture(); foreign.outcomes[0].game_id++;
  assert.throws(() => normalizeSettlement(foreign), /outside_scope/);
  for (const [field, value] of [["gameDate", "2026-11-03"], ["target", "GOALS"], ["horizon", 2]]) {
    const input = fixture(); input.issued[0][field] = value;
    assert.throws(() => normalizeSettlement(input), /issued_identity_outside/);
  }
});

test("unissued outcome rows are counted but do not manufacture forecast opportunities", () => {
  const input = fixture(); input.outcomes.push({ ...input.outcomes[0], player_id: 2 });
  const result = normalizeSettlement(input);
  assert.equal(result.rows.length, 1); assert.equal(result.audit.unissuedSourceRows, 1);
});

test("sealed, invalid and empty scopes fail before normalization", () => {
  for (const date of ["2026-10-27", "2026-11-31"]) {
    const input = fixture(); input.capture.date = date;
    assert.throws(() => normalizeSettlement(input), /prospective_scope/);
  }
  const input = fixture(); input.issued = [];
  assert.throws(() => normalizeSettlement(input), /issued_population_invalid/);
});

test("version must be explicit and repairs retain their declared version", () => {
  const input = fixture(); delete input.capture.settlementVersion;
  assert.throws(() => normalizeSettlement(input), /version_required/);
  input.capture.settlementVersion = 2;
  assert.equal(normalizeSettlement(input).rows[0].settlementVersion, 2);
  assert.equal(normalizeSettlement(input).audit.settlementVersion, 2);
});

test("ambiguous timezones and coerced identities are rejected", () => {
  const input = fixture(); input.capture.observedAt = "2026-11-03T17:00:00";
  assert.throws(() => normalizeSettlement(input), /capture_time_invalid/);
  const source = fixture(); source.outcomes[0].updated_at = "2026-11-03T03:00:00";
  assert.throws(() => normalizeSettlement(source), /source_clock_invalid/);
  const identity = fixture(); identity.outcomes[0].player_id = [1];
  assert.throws(() => normalizeSettlement(identity), /source_identity_outside_scope/);
});

test("CLI returns checker-compatible rows and a separate audit without writing input files", () => {
  const dir = mkdtempSync(join(tmpdir(), "rso-settlement-"));
  try {
    const input = fixture();
    for (const name of ["capture", "issued", "outcomes"]) writeFileSync(join(dir, name + ".json"), JSON.stringify(input[name]));
    const result = spawnSync(process.execPath, [fileURLToPath(new URL("normalize-settlement.mjs", import.meta.url)),
      ...["capture", "issued", "outcomes"].map(name => join(dir, name + ".json"))], { encoding: "utf8" });
    assert.equal(result.status, 0, result.stderr);
    assert.deepEqual(JSON.parse(result.stdout), normalizeSettlement(input).rows);
    assert.equal(JSON.parse(result.stderr).sourceRows, 1);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test("CLI executes through a symlink and rejects an empty issued population", () => {
  const dir = mkdtempSync(join(tmpdir(), "rso-settlement-alias-"));
  try {
    const cli = join(dir, "settlement alias.mjs"), input = fixture();
    symlinkSync(fileURLToPath(new URL("normalize-settlement.mjs", import.meta.url)), cli);
    const files = ["capture", "issued", "outcomes"].map(name => {
      const file = join(dir, name + ".json"); writeFileSync(file, JSON.stringify(input[name])); return file;
    });
    const good = spawnSync(process.execPath, [cli, ...files], { encoding: "utf8" });
    assert.equal(good.status, 0, good.stderr);
    assert.deepEqual(JSON.parse(good.stdout), normalizeSettlement(input).rows);
    assert.equal(JSON.parse(good.stderr).sourceRows, 1);
    writeFileSync(files[1], "[]");
    const bad = spawnSync(process.execPath, [cli, ...files], { encoding: "utf8" });
    assert.equal(bad.status, 1, bad.stderr);
    assert.match(bad.stderr, /issued_population_invalid/);
    assert.equal(bad.stdout, "");
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

function monthEnd() {
  const input = fixture();
  input.capture.date = input.issued[0].gameDate = "2026-11-30";
  input.capture.observedAt = "2026-12-01T17:00:00Z";
  input.issued[0].issuedAt = "2026-11-30T22:05:00Z";
  input.issued[0].scheduledAt = "2026-12-01T02:00:00Z";
  input.outcomes[0].updated_at = "2026-12-01T03:00:00Z";
  return input;
}

for (const field of ["capture", "source", "issue", "scheduled"]) {
  test(`impossible month-end ${field} timestamp is rejected before settlement`, () => {
    const input = monthEnd();
    if (field === "capture") input.capture.observedAt = "2026-11-31T17:00:00Z";
    if (field === "source") input.outcomes[0].updated_at = "2026-11-31T03:00:00Z";
    if (field === "issue") input.issued[0].issuedAt = "2026-11-31T00:00:00Z";
    if (field === "scheduled") input.issued[0].scheduledAt = "2026-11-31T02:00:00Z";
    assert.throws(() => normalizeSettlement(input), /capture_time_invalid|source_clock_invalid|issued_chronology_invalid/);
  });
}

test("a non-leap February 29 timestamp is rejected, while a real leap day settles", () => {
  const input = fixture(); input.capture.date = input.issued[0].gameDate = "2027-02-28";
  input.capture.observedAt = "2027-02-29T17:00:00Z";
  input.issued[0].issuedAt = "2027-02-28T22:05:00Z"; input.issued[0].scheduledAt = "2027-03-01T00:00:00Z";
  input.outcomes[0].updated_at = "2027-03-01T03:00:00Z";
  assert.throws(() => normalizeSettlement(input), /capture_time_invalid/);
  input.capture.date = input.issued[0].gameDate = "2028-02-28";
  input.capture.observedAt = "2028-02-29T17:00:00Z";
  input.issued[0].issuedAt = "2028-02-28T22:05:00Z"; input.issued[0].scheduledAt = "2028-02-29T00:00:00Z";
  input.outcomes[0].updated_at = "2028-02-29T03:00:00Z";
  assert.equal(normalizeSettlement(input).rows[0].actual, 3);
});

test("microsecond source chronology is not rounded into the capture or puck-drop boundary", () => {
  const input = fixture(); input.capture.observedAt = "2026-11-03T17:00:00.000001Z";
  input.outcomes[0].updated_at = "2026-11-03T17:00:00.000002Z";
  assert.throws(() => normalizeSettlement(input), /source_from_future/);
  input.outcomes[0].updated_at = "2026-11-03T00:00:00.000001Z";
  assert.equal(normalizeSettlement(input).rows[0].actual, 3);
});

test("settlement one microsecond after start remains settled through the actual checker", () => {
  const input = fixture(); input.outcomes[0].updated_at = "2026-11-03T00:00:00.000001Z";
  const result = normalizeSettlement(input), readback = { ...input.issued[0], observedAt: "2026-11-02T23:00:00Z" };
  assert.equal(result.rows[0].actual, 3);
  const report = checkReadbacks({ issued: input.issued, consumers: { rso: [readback], start_chart: [readback] }, settlement: result.rows });
  assert.equal(report.summary.pass, true); assert.equal(report.summary.settled, 1);
});
