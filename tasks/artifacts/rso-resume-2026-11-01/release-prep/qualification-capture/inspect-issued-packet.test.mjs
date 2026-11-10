import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync, symlinkSync, rmSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { canonicalHash } from "../qualification-readbacks/tooling/check-readbacks.mjs";
import { inspectIssuedPacket } from "./inspect-issued-packet.mjs";

function fixture() {
  const date = "2026-11-02", codeVersion = "a".repeat(40), gameId = 2026020232;
  const modelEnvironment = Object.fromEntries(["FORGE_SKATER_MODEL_MODE", "NHL_XG_TEAM_AGGREGATE_MODEL_VERSION",
    "NHL_XG_TEAM_AGGREGATE_FEATURE_VERSION", "NHL_XG_TEAM_AGGREGATE_WINDOW_GAMES", "NHL_XG_MODEL_VERSION",
    "START_CHART_GAME_REVISIONS", "STARTER_BOARD_COMPUTE_ENABLED", "STARTER_BOARD_SEASON_BOOTSTRAP_ENABLED"].map(key => [key, null]));
  const configurationHash = canonicalHash(modelEnvironment), modelIdentity = { version: "forge-model-identity-v1",
    artifact: "no_fitted_artifact", configurationHash, artifactHash: canonicalHash({ codeVersion, configurationHash }) };
  const meta = { revisionId: "synthetic-revision", runId: "synthetic-run", snapshotId: "synthetic-snapshot", gameId,
    gameDate: date, cutoffAt: "2026-11-02T22:00:00Z", issuedAt: "2026-11-02T22:05:00.123456Z", scheduledAt: "2026-11-03T00:00:00Z",
    codeVersion, method: "baseline", modelIdentity, snapshotModelIdentity: structuredClone(modelIdentity),
    modelEnvironment, snapshotVersion: "forge-inputs-v1", snapshotRunId: "synthetic-run", snapshotSlateDate: date,
    snapshotMethod: "baseline", snapshotCodeVersion: codeVersion, replayClassification: "captured_live",
    horizon: 1, runStatus: "succeeded", runGitSha: codeVersion };
  const context = { version: "forge-issued-context-v1", game: { id: gameId, date, startTime: meta.scheduledAt,
    seasonId: 20262027, homeTeamId: 10, awayTeamId: 20 },
    roster: [{ canonicalId: 1001, nhlId: 1, seasonId: 20262027, teamId: 10 }] };
  const revision = { id: meta.revisionId, game_id: gameId, run_id: meta.runId, input_snapshot_id: meta.snapshotId,
    slate_date: date, published_at: meta.issuedAt, decision_as_of: meta.cutoffAt,
    payload: { modelMode: meta.method, codeVersion, inputCutoff: meta.cutoffAt,
      inputProvenance: { modelIdentity, issuedContexts: [context] }, players: [{ player_id: 1, game_id: gameId,
        team_id: 10, horizon_games: 1, as_of_date: date, run_id: meta.runId, proj_shots_es: 2, proj_shots_pp: 1, proj_shots_pk: null }] } };
  return { capture: { date, observedAt: "2026-11-02T23:00:00Z", gameIds: [gameId] }, metadata: [meta], revisions: [revision] };
}
const has = (input, code) => assert.ok(inspectIssuedPacket(input).findings.some(row => row.code === code), code);

test("exact selected revision binds to metadata without calculating forecasts or granting release", () => {
  const result = inspectIssuedPacket(fixture());
  assert.equal(result.pass, true); assert.equal(result.bindings[0].skaterRows, 1);
  assert.match(result.bindings[0].revisionPayloadHash, /^[a-f0-9]{64}$/);
  assert.equal(result.qualificationReady, false); assert.equal(result.forecastValuesCalculated, false);
  assert.equal(result.participationLineageManufactured, false);
});
test("a latest-per-game metadata row cannot stand in for a different RPC-selected revision", () => {
  for (const field of ["id", "run_id", "input_snapshot_id"]) {
    const input = fixture(); input.revisions[0][field] = "different-synthetic-id";
    has(input, "revision_metadata_binding_mismatch");
  }
});
test("raw model identity and cutoff must equal the metadata receipt", () => {
  const input = fixture(); input.revisions[0].payload.inputProvenance.modelIdentity = { ...input.metadata[0].modelIdentity, artifactHash: "b".repeat(64) };
  has(input, "revision_model_or_date_mismatch");
  const cutoff = fixture(); cutoff.revisions[0].payload.inputCutoff = "2026-11-02T22:00:00.000001Z";
  has(cutoff, "revision_clock_mismatch");
});
test("microsecond chronology is preserved while equivalent timezone encodings match", () => {
  const equivalent = fixture(); equivalent.revisions[0].published_at = "2026-11-02T17:05:00.123456-05:00";
  assert.equal(inspectIssuedPacket(equivalent).pass, true);
  const truncated = fixture(); truncated.revisions[0].published_at = "2026-11-02T22:05:00.123Z";
  has(truncated, "revision_clock_mismatch");
  const early = fixture(); early.capture.observedAt = "2026-11-02T22:05:00.123455Z";
  has(early, "capture_not_after_issue_and_pregame");
});
test("missing or extra selected games cannot be silently trimmed", () => {
  const missing = fixture(); missing.capture.gameIds.push(2026020233);
  has(missing, "metadata_population_differs_from_capture"); has(missing, "selected_revision_missing_for_capture_game");
  const duplicate = fixture(); duplicate.revisions.push(structuredClone(duplicate.revisions[0]));
  has(duplicate, "revision_game_scope_or_duplicate");
});
test("missing or ambiguous frozen contexts fail", () => {
  const input = fixture(); input.revisions[0].payload.inputProvenance.issuedContexts = [];
  has(input, "issued_context_missing_or_ambiguous");
  const duplicate = fixture(); const contexts = duplicate.revisions[0].payload.inputProvenance.issuedContexts;
  contexts.push(structuredClone(contexts[0])); has(duplicate, "issued_context_missing_or_ambiguous");
});
test("wrong player/game/team/horizon/run and duplicate skaters fail", () => {
  for (const [field, value] of [["player_id", 2], ["game_id", 2026020233], ["team_id", 20], ["horizon_games", 2], ["run_id", "other"]]) {
    const input = fixture(); input.revisions[0].payload.players[0][field] = value;
    has(input, "issued_player_context_mismatch");
  }
  const input = fixture(); input.revisions[0].payload.players.push({ ...input.revisions[0].payload.players[0] });
  has(input, "issued_player_context_mismatch");
});
test("missing canonical mapping or ambiguous roster membership cannot bind a player", () => {
  const input = fixture(); input.revisions[0].payload.inputProvenance.issuedContexts[0].roster[0].canonicalId = null;
  has(input, "issued_player_context_mismatch");
  const duplicate = fixture(); const roster = duplicate.revisions[0].payload.inputProvenance.issuedContexts[0].roster;
  roster.push({ ...roster[0] }); has(duplicate, "issued_player_context_mismatch");
});
test("sealed and post-puck-drop captures fail", () => {
  const sealed = fixture(); sealed.capture.date = "2026-10-27";
  assert.equal(inspectIssuedPacket(sealed).pass, false);
  const late = fixture(); late.capture.observedAt = late.metadata[0].scheduledAt;
  has(late, "capture_not_after_issue_and_pregame");
});
test("an invalid calendar date cannot form a self-consistent capture", () => {
  const input = fixture(), date = "2026-11-31";
  input.capture.date = input.metadata[0].gameDate = input.metadata[0].snapshotSlateDate = date;
  input.revisions[0].slate_date = input.revisions[0].payload.players[0].as_of_date = date;
  input.revisions[0].payload.inputProvenance.issuedContexts[0].game.date = date;
  has(input, "capture_date_invalid");
});
test("CLI reports binding results from saved JSON only", () => {
  const dir = mkdtempSync(join(tmpdir(), "rso-issued-packet-"));
  try {
    const file = join(dir, "packet.json"); writeFileSync(file, JSON.stringify(fixture()));
    const result = spawnSync(process.execPath, [fileURLToPath(new URL("inspect-issued-packet.mjs", import.meta.url)), file], { encoding: "utf8" });
    assert.equal(result.status, 0, result.stderr); assert.equal(JSON.parse(result.stdout).pass, true);
    assert.match(JSON.parse(result.stdout).packetSha256, /^[a-f0-9]{64}$/);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test("CLI executes through a symlink and rejects missing issued revisions", () => {
  const dir = mkdtempSync(join(tmpdir(), "rso-issued-alias-"));
  try {
    const cli = join(dir, "issued alias.mjs"), file = join(dir, "packet.json"), input = fixture();
    symlinkSync(fileURLToPath(new URL("inspect-issued-packet.mjs", import.meta.url)), cli);
    writeFileSync(file, JSON.stringify(input));
    const good = spawnSync(process.execPath, [cli, file], { encoding: "utf8" });
    assert.equal(good.status, 0, good.stderr);
    assert.equal(JSON.parse(good.stdout).pass, true);
    assert.match(JSON.parse(good.stdout).packetSha256, /^[a-f0-9]{64}$/);
    input.revisions = []; writeFileSync(file, JSON.stringify(input));
    const bad = spawnSync(process.execPath, [cli, file], { encoding: "utf8" });
    assert.equal(bad.status, 1, bad.stderr);
    assert.equal(JSON.parse(bad.stdout).pass, false);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});
