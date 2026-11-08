import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { encodePlanningDataTransport } from "lib/rosterScheduleData/planningDataTransport";
import { normalizeRsoReadback, normalizeStartChartReadback } from "./normalize-readbacks";

const capture = { date: "2026-11-02", observedAt: "2026-11-02T23:00:00Z", gameIds: [2026020232] };
const uses = { assignment: false, totals: false, comparison: false, conditionalTieBreak: false };
const code = "a".repeat(40), cutoff = "2026-11-02T22:00:00Z";
function planning(): any {
  return { players: [{ id: "canonical-1", nhlId: 1, name: "Synthetic", teamAbbreviation: "AAA", eligiblePositions: ["C"],
    playerClass: "skater", availability: "unknown", ownership: null, canDrop: null, holdValue: null, reserveEligibility: [] }],
  games: [{ id: "2026020232", date: capture.date, startsAt: "2026-11-03T00:00:00Z", teamAbbreviation: "AAA",
    opponent: "BBB", home: true, status: "scheduled" }], evidence: {},
  forecastManifest: { version: "planning-forecasts-v1", id: "synthetic-manifest", seasonId: 20262027, asOf: cutoff,
    rsoUsePolicy: { version: "rso-target-use-v1", revision: "synthetic-policy", bridgeRevisionIds: [] } },
  forecasts: [{ playerId: "canonical-1", gameId: "2026020232", revisionId: "synthetic-revision", sourceKind: "detailed",
    stats: { SHOTS_ON_GOAL: 2.3456 }, conditioning: "unconditional", startProbability: null, confirmedStart: false,
    issuedAt: "2026-11-02T22:05:00Z", cutoffAt: cutoff, modelVersion: code, limitations: [],
    issuedContext: { nhlPlayerId: 1, playerId: "canonical-1", gameId: "2026020232" }, targetAllowedUses: { SHOTS_ON_GOAL: uses },
    rsoTargetBindings: { SHOTS_ON_GOAL: { component: "forge-detailed-skater", modelMode: "baseline", codeVersion: code,
      configurationHash: "b".repeat(64), artifactHash: "c".repeat(64), targetKey: "SHOTS_ON_GOAL", horizonGames: 1,
      conditioning: "conditional_playing", participationLineage: "synthetic-method", cutoffAt: cutoff } } }] };
}
function rso(data = planning()) { return { success: true, data: encodePlanningDataTransport(data) }; }
function board(): any {
  return { publishedForecastsEnabled: true, contractVersion: 2, dateUsed: capture.date, resolvedDate: capture.date,
    fallbackApplied: false, gameRevisions: [{ gameId: 2026020232, revisionId: "synthetic-revision", modelMode: "baseline",
      codeVersion: code, inputCutoff: cutoff }], players: [{ player_id: 1, game_id: 2026020232, proj_shots: 2.3456,
      forecast: { expected: { SHOTS_ON_GOAL: 2.3456 }, conditioning: "unconditional" } }] };
}

test("real RSO transport decoding retains NHL identity, value, revision and denied uses", () => {
  const row = normalizeRsoReadback(rso(), capture)[0];
  assert.equal(row.playerId, "1"); assert.equal(row.revisionId, "synthetic-revision");
  assert.equal(row.value.unconditionalMean, 2.3456); assert.deepEqual(row.allowedUses, uses);
  assert.equal(row.observedAt, capture.observedAt); assert.equal(row.configurationHash, "b".repeat(64));
});
test("older raw RSO transport remains lossless", () => {
  assert.deepEqual(normalizeRsoReadback({ success: true, data: planning() }, capture), normalizeRsoReadback(rso(), capture));
});
test("unknown SOG remains null in both consumers", () => {
  const data = planning(); data.forecasts[0].stats.SHOTS_ON_GOAL = null;
  const b = board(); b.players[0].proj_shots = b.players[0].forecast.expected.SHOTS_ON_GOAL = null;
  assert.equal(normalizeRsoReadback(rso(data), capture)[0].value.unconditionalMean, null);
  assert.equal(normalizeStartChartReadback(b, capture)[0].value.unconditionalMean, null);
});
test("bridge rows cannot stand in for captured revision evidence", () => {
  assert.throws(() => normalizeRsoReadback({ ...rso(), bridgeForecasts: {} }, capture), /bridge_is_not/);
});
test("mismatched NHL mapping and missing detailed binding fail", () => {
  const data = planning(); data.forecasts[0].issuedContext.playerId = "other";
  assert.throws(() => normalizeRsoReadback(rso(data), capture), /player_mapping/);
  delete data.forecasts[0].rsoTargetBindings;
  assert.throws(() => normalizeRsoReadback(rso(data), capture), /binding_missing/);
});
test("missing target permissions are not converted into approval", () => {
  const data = planning(); delete data.forecasts[0].targetAllowedUses;
  assert.throws(() => normalizeRsoReadback(rso(data), capture), /permissions_missing/);
});
test("Start Chart joins exactly one revision for the same game", () => {
  const row = normalizeStartChartReadback(board(), capture)[0];
  assert.equal(row.revisionId, "synthetic-revision"); assert.equal(row.value.unconditionalMean, 2.3456);
  const b = board(); b.gameRevisions.push({ ...b.gameRevisions[0] });
  assert.throws(() => normalizeStartChartReadback(b, capture), /join_ambiguous/);
});
test("missing Start Chart revision fails instead of using a neighboring game's identity", () => {
  const b = board(); b.gameRevisions[0].gameId++;
  assert.throws(() => normalizeStartChartReadback(b, capture), /join_missing/);
});
test("conditional and inconsistent displayed values fail", () => {
  const b = board(); b.players[0].forecast.conditioning = "conditional_playing";
  assert.throws(() => normalizeStartChartReadback(b, capture), /conditional_value/);
  b.players[0].forecast.conditioning = "unconditional"; b.players[0].proj_shots = 0;
  assert.throws(() => normalizeStartChartReadback(b, capture), /display_value_mismatch/);
});
test("date fallback, sealed dates, empty populations and duplicate rows fail", () => {
  const b = board(); b.fallbackApplied = true;
  assert.throws(() => normalizeStartChartReadback(b, capture), /date_fallback/);
  assert.throws(() => normalizeRsoReadback(rso(), { ...capture, date: "2026-10-27" }), /prospective_scope/);
  b.fallbackApplied = false; b.players = [];
  assert.throws(() => normalizeStartChartReadback(b, capture), /no_qualifying/);
  const dup = board(); dup.players.push({ ...dup.players[0] });
  assert.throws(() => normalizeStartChartReadback(dup, capture), /duplicate_readback/);
});
test("the offline CLI reads saved JSON and emits the same normalized rows", () => {
  const dir = mkdtempSync(join(tmpdir(), "rso-readback-normalizer-"));
  try {
    writeFileSync(join(dir, "capture.json"), JSON.stringify(capture));
    writeFileSync(join(dir, "response.json"), JSON.stringify(rso()));
    const output = execFileSync(process.execPath, ["-r", "ts-node/register", "-r", "tsconfig-paths/register",
      join(__dirname, "normalize-readbacks.ts"), "rso", join(dir, "capture.json"), join(dir, "response.json")], { encoding: "utf8" });
    assert.deepEqual(JSON.parse(output), normalizeRsoReadback(rso(), capture));
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test("normalized captures integrate with the integrity CLI without promoting unknowns or permissions", () => {
  const dir = mkdtempSync(join(tmpdir(), "rso-readback-integrity-"));
  const checker = join(__dirname, "../qualification-readbacks/tooling/check-readbacks.mjs");
  try {
    const data = planning(), b = board();
    data.forecasts[0].stats.SHOTS_ON_GOAL = null;
    b.players[0].proj_shots = b.players[0].forecast.expected.SHOTS_ON_GOAL = null;
    const rsoRows = normalizeRsoReadback(rso(data), capture);
    const boardRows = normalizeStartChartReadback(b, capture);
    const scope = JSON.parse(readFileSync(join(__dirname, "../qualification-readbacks/scope.json"), "utf8"));
    // Synthetic pinned identity exists only in this temporary test directory.
    scope.status = "pinned";
    scope.identity = { target: "SHOTS_ON_GOAL", method: "baseline", codeVersion: code,
      configurationHash: "b".repeat(64), artifactHash: "c".repeat(64), horizon: 1 };
    const issued = [{ ...scope.identity, playerId: "1", gameId: "2026020232", revisionId: "synthetic-revision",
      cutoffAt: cutoff, issuedAt: "2026-11-02T22:05:00Z", scheduledAt: "2026-11-03T00:00:00Z",
      gameDate: capture.date, participationRevisionId: "synthetic-participation", value: { unconditionalMean: null } }];
    for (const [name, rows] of Object.entries({ scope, issued, rso: rsoRows, "start-chart": boardRows }))
      writeFileSync(join(dir, name + ".json"), JSON.stringify(rows));
    const args = [checker, "--scope", join(dir, "scope.json"), "--issued", join(dir, "issued.json"),
      "--rso", join(dir, "rso.json"), "--start-chart", join(dir, "start-chart.json")];
    const run = () => {
      try { return { status: 0, report: JSON.parse(execFileSync(process.execPath, args, { encoding: "utf8", stdio: "pipe" })) }; }
      catch (error: any) { return { status: error.status, report: JSON.parse(String(error.stdout)) }; }
    };
    const valid = run();
    assert.equal(valid.status, 0); assert.equal(valid.report.summary.pass, true);
    assert.deepEqual(rsoRows[0].allowedUses, uses); // Integrity never grants denied uses.
    assert.equal(rsoRows[0].value.unconditionalMean, null);

    b.gameRevisions[0].revisionId = "different-synthetic-revision";
    writeFileSync(join(dir, "start-chart.json"), JSON.stringify(normalizeStartChartReadback(b, capture)));
    const mismatched = run();
    assert.equal(mismatched.status, 1);
    assert.equal(mismatched.report.summary.findingCodes.identity_mismatch, 1);

    writeFileSync(join(dir, "start-chart.json"), JSON.stringify(boardRows));
    data.forecasts[0].stats.SHOTS_ON_GOAL = 0;
    writeFileSync(join(dir, "rso.json"), JSON.stringify(normalizeRsoReadback(rso(data), capture)));
    const inventedZero = run();
    assert.equal(inventedZero.status, 1);
    assert.equal(inventedZero.report.summary.findingCodes.value_mismatch, 1);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

for (const timezone of ["UTC", "America/New_York"]) for (const consumer of ["rso", "start-chart"]) {
  test(`${consumer} rejects offset-free capture clocks under ${timezone}`, () => {
    const previous = process.env.TZ;
    try {
      process.env.TZ = timezone;
      const ambiguous = { ...capture, observedAt: "2026-11-02T18:00:00" };
      assert.throws(() => consumer === "rso" ? normalizeRsoReadback(rso(), ambiguous)
        : normalizeStartChartReadback(board(), ambiguous), /capture_time/);
    } finally { if (previous === undefined) delete process.env.TZ; else process.env.TZ = previous; }
  });
}

test("valid offset-bearing capture instants retain their exact representation", () => {
  const offset = { ...capture, observedAt: "2026-11-02T18:00:00.123456-05:00" };
  assert.equal(normalizeRsoReadback(rso(), offset)[0].observedAt, offset.observedAt);
  assert.equal(normalizeStartChartReadback(board(), offset)[0].observedAt, offset.observedAt);
});

test("impossible capture timestamps and calendar dates cannot be normalized", () => {
  for (const observedAt of ["2026-11-31T23:00:00Z", "2027-02-29T23:00:00Z"]) {
    assert.throws(() => normalizeRsoReadback(rso(), { ...capture, observedAt }), /capture_time/);
    assert.throws(() => normalizeStartChartReadback(board(), { ...capture, observedAt }), /capture_time/);
  }
  const date = "2026-11-31", data = planning(), b = board();
  data.games[0].date = b.dateUsed = b.resolvedDate = date;
  assert.throws(() => normalizeRsoReadback(rso(data), { ...capture, date }), /capture_date/);
  assert.throws(() => normalizeStartChartReadback(b, { ...capture, date }), /capture_date/);
});

test("both normalized consumers retain microsecond issue ordering through the checker CLI", () => {
  const dir = mkdtempSync(join(tmpdir(), "rso-microsecond-readbacks-"));
  const checker = join(__dirname, "../qualification-readbacks/tooling/check-readbacks.mjs");
  try {
    for (const digit of [1, 2, 3]) {
      const timed = { ...capture, observedAt: `2026-11-02T22:05:00.00000${digit}Z` };
      const rsoRows = normalizeRsoReadback(rso(), timed), boardRows = normalizeStartChartReadback(board(), timed);
      const issued = [{ ...rsoRows[0], issuedAt: "2026-11-02T22:05:00.000002Z",
        scheduledAt: "2026-11-03T00:00:00Z", participationRevisionId: "synthetic-participation" }];
      for (const [name, rows] of Object.entries({ issued, rso: rsoRows, "start-chart": boardRows }))
        writeFileSync(join(dir, name + ".json"), JSON.stringify(rows));
      const args = [checker, "--issued", join(dir, "issued.json"), "--rso", join(dir, "rso.json"),
        "--start-chart", join(dir, "start-chart.json")];
      let report: any, status = 0;
      try { report = JSON.parse(execFileSync(process.execPath, args, { encoding: "utf8", stdio: "pipe" })); }
      catch (error: any) { status = error.status; report = JSON.parse(String(error.stdout)); }
      assert.equal(status, digit < 2 ? 1 : 0);
      assert.equal(report.summary.findingCodes.readback_before_issue ?? 0, digit < 2 ? 2 : 0);
      assert.equal(report.summary.pass, digit >= 2);
    }
  } finally { rmSync(dir, { recursive: true, force: true }); }
});
