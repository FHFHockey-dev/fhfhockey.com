import { test } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { resolve, join } from "node:path";
import { spawnSync } from "node:child_process";
import { encodePlanningDataTransport } from "../../../../web/lib/rosterScheduleData/planningDataTransport";
import { VERIFIED_FORGE_RELEASES, VERIFIED_FORGE_PRODUCER_CLOSURES } from "../../../../web/lib/projections/verifiedForgeReleases";
import { inspectSavedPlanning, readBoundedFile, verifySourcePins, BODY_BYTE_LIMIT } from "./inspect-saved-planning";

const prefix = "forge-daily-bridge-v1:", run = "SYNTHETIC-RUN", sha = VERIFIED_FORGE_RELEASES[0].sha;
const observedAt = "2026-11-09T15:00:00.000001Z", evaluatedAt = "2026-11-09T15:01:00Z";
const hash = (bytes: Buffer) => createHash("sha256").update(Uint8Array.from(bytes)).digest("hex");
function fixture() {
  const data = {
    players: [{ id: "synthetic-player", nhlId: 1, nhlTeamId: 10, rosterRevision: "synthetic-roster", name: "PRIVATE_NAME_MUST_NOT_ESCAPE",
      teamAbbreviation: "TOR", eligiblePositions: ["C"], playerClass: "skater", availability: "unknown", ownership: null,
      canDrop: null, holdValue: null, reserveEligibility: [] }],
    games: [{ id: "synthetic-game", scheduleRevision: "synthetic-schedule", teamAbbreviation: "TOR", opponent: "MTL",
      date: "2026-11-09", startsAt: "2026-11-09T23:00:00Z", home: true, status: "scheduled" }],
    forecasts: [], evidence: {},
    forecastManifest: { version: "planning-forecasts-v1", id: "synthetic-manifest", seasonId: 20262027,
      asOf: "2026-11-09T15:00:00Z", scheduleRevision: "synthetic-schedule", rosterRevision: "synthetic-roster",
      rsoUsePolicy: { version: "rso-target-use-v1", revision: "rso-review-before-use-2026-10-22-v1", bridgeRevisionIds: [prefix + run] },
      issuedRevisionIds: [prefix + run], baselineChecksum: null, requiredOpportunities: 1, forecastedOpportunities: 1, exclusionCounts: {}, exclusions: [] },
  };
  const body: any = { success: true, data, bridgeForecasts: {
    version: "forge-daily-bridge-wire-v1", seasonId: 20262027,
    runs: [[prefix + run, prefix + run, prefix + sha, "2026-11-09T14:55:00Z", "2026-11-09T14:55:00Z"]],
    rows: [["synthetic-player", "synthetic-game", 0, "2026-11-09T23:00:00Z", { SHOTS_ON_GOAL: 2.5, GOALS: 0, ASSISTS: null }, null, false, null]],
    limitations: ["SYNTHETIC FIXTURE ONLY"], proofs: [{ runId: run, basis: "verified_release", releaseSha: sha, closureSha256: null }],
  } };
  return body;
}
function receipt(bytes: Buffer, kind = "planning_data") {
  return { version: "rso-saved-response-receipt-v1", kind, bodySha256: hash(bytes), observedAt,
    seasonId: 20262027, startDate: "2026-11-09", endDate: "2026-11-09", timeZone: "UTC" };
}
function inspect(body: any, now = evaluatedAt, kind = "planning_data") {
  const bytes = Buffer.from(JSON.stringify(body)); return inspectSavedPlanning(bytes, receipt(bytes, kind), now);
}
function finding(change: (body: any) => void, code: string) {
  const body = fixture(); change(body); const report = inspect(body);
  assert.equal(report.consistentAtCapture, false, JSON.stringify(report)); assert.ok(report.findings.includes(code), JSON.stringify(report));
}

test("real codecs inspect a synthetic raw response without granting use or exposing private values", () => {
  const body = fixture(), before = JSON.stringify(body), report = inspect(body);
  assert.equal(report.consistentAtCapture, true); assert.deepEqual(report.findings, []);
  assert.equal(report.counts.bridgeRows, 1); assert.equal(report.counts.bridgeNullStats, 1); assert.equal(report.counts.bridgeZeroStats, 1);
  assert.ok(Object.values(report.authority).every(value => value === false));
  assert.doesNotMatch(JSON.stringify(report), /PRIVATE_NAME|synthetic-player|synthetic-game|SYNTHETIC-RUN|SYNTHETIC FIXTURE/);
  assert.equal(JSON.stringify(body), before);
});

test("actual compressed planning transport decodes to the same report", () => {
  const body = fixture(), raw = inspect(body); body.data = encodePlanningDataTransport(body.data);
  const compressed = inspect(body); assert.equal(compressed.consistentAtCapture, true);
  assert.deepEqual(compressed.counts, raw.counts); assert.deepEqual(compressed.currentUseHolds, raw.currentUseHolds);
});

function providerFixture() {
  const body = fixture();
  body.snapshot = { ...body.data, id: "synthetic-snapshot", context: { provider: "yahoo", seasonId: 20262027,
    leagueId: "PRIVATE_LEAGUE_MUST_NOT_ESCAPE", teamId: "PRIVATE_TEAM_MUST_NOT_ESCAPE", startDate: "2026-11-09", endDate: "2026-11-09",
    timeZone: "UTC", asOf: "2026-11-09T15:00:00Z" }, roster: [{ playerId: "synthetic-player", position: "active" }],
    rules: { lineupMode: "daily", rosterSlots: { C: 1, D: 3, G: 2, BN: 4 }, lineupPeriods: [{ id: "day", start: "2026-11-09T00:00:00Z", end: "2026-11-10T00:00:00Z", lockAt: null }],
      acquisitionTiming: "unknown", acquisitionCost: null, periods: [], scoring: { mode: "points", weights: {}, categories: [] },
      goalieMinimum: { required: null, credited: null, periodStart: "2026-11-09", periodEnd: "2026-11-09", counts: "unknown", penalty: "unknown" }, unsupported: [] },
    forecastInputExclusions: [], lockedAssignments: [], realized: {}, opponent: null };
  delete body.data; return body;
}

test("provider snapshot uses the existing schema and preserves actual slots and unknown rules", () => {
  const body = providerFixture(), before = JSON.stringify(body), report = inspect(body, evaluatedAt, "provider_snapshot");
  assert.equal(report.consistentAtCapture, true, JSON.stringify(report)); assert.equal(JSON.stringify(body), before);
  assert.doesNotMatch(JSON.stringify(report), /PRIVATE_|synthetic-player/);
  body.snapshot.context.timeZone = "America/New_York";
  assert.ok(inspect(body, evaluatedAt, "provider_snapshot").findings.includes("snapshot_scope_mismatch"));
  body.snapshot.context.asOf = "2026-11-09T15:00:00.000002Z";
  assert.ok(inspect(body, evaluatedAt, "provider_snapshot").findings.includes("snapshot_from_future"));
});

test("a consistent past capture is distinctly held when its bridge has expired now", () => {
  const report = inspect(fixture(), "2026-11-10T00:00:00Z");
  assert.equal(report.consistentAtCapture, true); assert.ok(report.currentUseHolds.includes("bridge_expired_now"));
  assert.equal(report.authority.forecastUseGranted, false);
});

test("body changes cannot be hidden behind a retained capture receipt", () => {
  const bytes = Buffer.from(JSON.stringify(fixture())), original = receipt(bytes); bytes[0] = 32;
  assert.deepEqual(inspectSavedPlanning(bytes, original, evaluatedAt).findings, ["body_hash_mismatch"]);
});

test("missing or impossible capture clocks and future captures fail", () => {
  const bytes = Buffer.from(JSON.stringify(fixture()));
  for (const observedAt of ["", "2026-11-09T15:00:00", "2026-11-31T15:00:00Z"]) {
    assert.ok(inspectSavedPlanning(bytes, { ...receipt(bytes), observedAt }, evaluatedAt).findings.includes("receipt_clock_or_input_size_invalid"));
  }
  assert.ok(inspectSavedPlanning(bytes, receipt(bytes), "2026-11-09T15:00:00Z").findings.includes("capture_is_in_the_future"));
  const invalidClock = inspectSavedPlanning(bytes, receipt(bytes), "PRIVATE_TOKEN_NOT_A_CLOCK");
  assert.equal(invalidClock.evaluatedAt, null);
  assert.equal(invalidClock.consistentAtCapture, false);
  assert.doesNotMatch(JSON.stringify(invalidClock), /PRIVATE_TOKEN/);
});

test("the real bridge codec cannot silently discard invalid or unmapped received rows", () => {
  finding(body => body.bridgeForecasts.rows.push(["missing", "synthetic-game", 0, "x", {}, null, false, null]), "bridge_rows_dropped_by_codec");
  finding(body => body.bridgeForecasts.rows[0][2] = 7, "bridge_rows_dropped_by_codec");
});

test("duplicate player, game, forecast and run identities fail", () => {
  finding(body => body.data.players.push({ ...body.data.players[0] }), "response_shape_invalid");
  finding(body => body.data.games.push({ ...body.data.games[0] }), "response_shape_invalid");
  finding(body => body.bridgeForecasts.rows.push([...body.bridgeForecasts.rows[0]]), "bridge_identity_duplicated");
  finding(body => body.bridgeForecasts.runs.push([...body.bridgeForecasts.runs[0]]), "bridge_identity_duplicated");
});

test("scope, manifest, unused-run and omitted-wire discrepancies remain explicit", () => {
  finding(body => body.bridgeForecasts.seasonId = 20252026, "bridge_wire_invalid_or_empty");
  finding(body => body.data.games[0].date = "2026-11-10", "game_outside_capture_scope");
  finding(body => body.data.forecastManifest.rsoUsePolicy.bridgeRevisionIds = [], "bridge_manifest_binding_mismatch");
  finding(body => body.bridgeForecasts.runs.push([prefix + "other", prefix + "other", prefix + sha, "2026-11-09T14:55:00Z", "2026-11-09T14:55:00Z"]), "bridge_run_not_used");
  finding(body => delete body.bridgeForecasts, "declared_bridge_wire_missing");
});

test("proofs must match the entire served run population without malformed drops or duplicates", () => {
  finding(body => delete body.bridgeForecasts.proofs, "bridge_proof_population_invalid");
  finding(body => body.bridgeForecasts.proofs.push(null), "bridge_proof_population_invalid");
  finding(body => body.bridgeForecasts.proofs.push({ ...body.bridgeForecasts.proofs[0] }), "bridge_proof_population_invalid");
  finding(body => body.bridgeForecasts.proofs[0].runId = "other", "bridge_run_proof_missing");
  finding(body => body.bridgeForecasts.proofs[0].basis = null, "bridge_run_proof_missing");
});

test("known release and producer declarations bind the actual wire model, without proving execution", () => {
  finding(body => body.bridgeForecasts.proofs[0].releaseSha = "a".repeat(40), "bridge_release_proof_unrecognized");
  finding(body => body.bridgeForecasts.runs[0][2] = prefix + "b".repeat(40), "bridge_release_binding_mismatch");
  const body = fixture(), closure = VERIFIED_FORGE_PRODUCER_CLOSURES[0];
  body.bridgeForecasts.proofs[0] = { runId: run, basis: "verified_producer_closure", releaseSha: sha, closureSha256: closure.closureSha256 };
  assert.equal(inspect(body).consistentAtCapture, true);
  body.bridgeForecasts.proofs[0].closureSha256 = "f".repeat(64);
  assert.ok(inspect(body).findings.includes("bridge_producer_proof_unrecognized"));
});

test("a declared captured-snapshot proof still needs its original evidence", () => {
  const body = fixture(); body.bridgeForecasts.proofs[0] = { runId: run, basis: "captured_snapshot", releaseSha: null, closureSha256: null };
  const report = inspect(body); assert.equal(report.consistentAtCapture, true);
  assert.ok(report.currentUseHolds.includes("original_captured_snapshot_proof_still_required"));
  assert.equal(report.authority.captureAuthenticityVerified, false);
});

test("missing canonical player/game bindings cannot become a bridge forecast identity", () => {
  finding(body => delete body.data.players[0].nhlTeamId, "bridge_player_game_binding_incomplete");
  finding(body => delete body.data.players[0].rosterRevision, "bridge_player_game_binding_incomplete");
  finding(body => body.data.players[0].nhlId = null, "bridge_player_game_binding_incomplete");
});

test("microsecond boundaries do not round future issuance or expiry into acceptance", () => {
  finding(body => body.bridgeForecasts.runs[0][3] = "2026-11-09T15:00:00.000002Z", "bridge_run_identity_or_clock_invalid");
  finding(body => body.bridgeForecasts.rows[0][3] = observedAt, "bridge_expired_or_invalid_at_capture");
  finding(body => body.bridgeForecasts.rows[0][3] = "2026-11-10T00:00:00Z", "bridge_expired_or_invalid_at_capture");
  finding(body => body.data.forecastManifest.asOf = "2026-11-09T15:00:00.000002Z", "manifest_from_future");
});

test("a valid schedule-only response stays usable for review without claiming a selected forecast branch", () => {
  const body = fixture(); delete body.bridgeForecasts; body.data.forecastManifest.rsoUsePolicy.bridgeRevisionIds = [];
  const report = inspect(body); assert.equal(report.consistentAtCapture, true);
  assert.ok(report.currentUseHolds.includes("serving_source_and_forecast_use_not_established"));
  assert.equal(report.authority.servingBranchEstablished, false);
});

test("empty, malformed and oversized evidence never passes", () => {
  finding(body => body.data.players = [], "planning_population_empty");
  finding(body => body.bridgeForecasts.rows = [], "bridge_wire_invalid_or_empty");
  finding(body => body.success = false, "response_shape_invalid");
  const bytes = Buffer.from('{"PRIVATE_TOKEN":"do-not-print",oops}');
  const report = inspectSavedPlanning(bytes, receipt(bytes), evaluatedAt);
  assert.deepEqual(report.findings, ["response_shape_invalid"]); assert.doesNotMatch(JSON.stringify(report), /PRIVATE_TOKEN|do-not-print/);
  const oversized = Buffer.alloc(BODY_BYTE_LIMIT + 1, 32);
  assert.equal(inspectSavedPlanning(oversized, receipt(oversized), evaluatedAt).consistentAtCapture, false);
});

test("bounded file reader refuses oversized files and directories", () => {
  const dir = mkdtempSync(join(tmpdir(), "rso-preflight-bound-"));
  try {
    const file = join(dir, "input.json"); writeFileSync(file, "12345");
    assert.equal(readBoundedFile(file, 5).toString(), "12345"); assert.throws(() => readBoundedFile(file, 4));
    assert.throws(() => readBoundedFile(dir, 100));
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test("CLI reads saved files through an alias, writes no input and never echoes malformed private JSON", () => {
  verifySourcePins();
  const dir = mkdtempSync(join(tmpdir(), "rso-preflight-cli-")), repo = resolve(__dirname, "../../../.."), web = join(repo, "web");
  try {
    const cli = join(dir, "saved response alias.ts"), file = join(dir, "response.json"), meta = join(dir, "receipt.json");
    symlinkSync(resolve(__dirname, "inspect-saved-planning.ts"), cli);
    const bytes = Buffer.from(JSON.stringify(fixture())); writeFileSync(file, Uint8Array.from(bytes)); writeFileSync(meta, JSON.stringify(receipt(bytes)));
    const args = ["-r", "ts-node/register", "-r", "tsconfig-paths/register", cli, file, meta, evaluatedAt];
    const good = spawnSync(process.execPath, args, { cwd: web, encoding: "utf8", env: process.env });
    assert.equal(good.status, 0, good.stderr); assert.equal(JSON.parse(good.stdout).consistentAtCapture, true);
    assert.deepEqual(readFileSync(file), bytes);
    writeFileSync(meta, '{"SECRET_TOKEN_NEVER_ECHO":"bad",broken}');
    const bad = spawnSync(process.execPath, args, { cwd: web, encoding: "utf8", env: process.env });
    assert.equal(bad.status, 2); assert.equal(bad.stdout, ""); assert.doesNotMatch(bad.stderr, /SECRET_TOKEN|broken|rso-preflight-cli/);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});
