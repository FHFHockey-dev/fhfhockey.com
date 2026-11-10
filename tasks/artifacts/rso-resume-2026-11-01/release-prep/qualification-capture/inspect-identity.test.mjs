import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync, symlinkSync, rmSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { canonicalHash } from "../qualification-readbacks/tooling/check-readbacks.mjs";
import { inspectIdentity } from "./inspect-identity.mjs";

const date = "2026-11-01";
function fixture() {
  const modelEnvironment = Object.fromEntries(["FORGE_SKATER_MODEL_MODE", "NHL_XG_TEAM_AGGREGATE_MODEL_VERSION",
    "NHL_XG_TEAM_AGGREGATE_FEATURE_VERSION", "NHL_XG_TEAM_AGGREGATE_WINDOW_GAMES", "NHL_XG_MODEL_VERSION",
    "START_CHART_GAME_REVISIONS", "STARTER_BOARD_COMPUTE_ENABLED", "STARTER_BOARD_SEASON_BOOTSTRAP_ENABLED"].map(key => [key, null]));
  const codeVersion = "a".repeat(40), configurationHash = canonicalHash(modelEnvironment);
  const modelIdentity = { version: "forge-model-identity-v1", artifact: "no_fitted_artifact", configurationHash,
    artifactHash: canonicalHash({ codeVersion, configurationHash }) };
  return [{ revisionId: "synthetic-revision", runId: "synthetic-run", gameId: 1, gameDate: date,
    cutoffAt: "2026-11-01T18:00:00Z", issuedAt: "2026-11-01T18:05:00Z", scheduledAt: "2026-11-01T23:00:00Z",
    codeVersion, method: "baseline", modelIdentity, snapshotModelIdentity: structuredClone(modelIdentity),
    modelEnvironment, snapshotVersion: "forge-inputs-v1", snapshotRunId: "synthetic-run", snapshotSlateDate: date,
    snapshotMethod: "baseline", snapshotCodeVersion: codeVersion, replayClassification: "captured_live",
    horizon: 1, runStatus: "succeeded", runGitSha: codeVersion }];
}
const has = (rows, code) => assert.ok(inspectIdentity(rows, date).findings.some(finding => finding.code === code));

test("consistent metadata identifies the tuple without granting release or qualification", () => {
  const result = inspectIdentity(fixture(), date);
  assert.equal(result.pass, true);
  assert.equal(result.identity.target, "SHOTS_ON_GOAL");
  assert.equal(result.qualificationReady, false);
  assert.equal(result.releaseAttribution, "requires_exact_release_and_run_proof_review");
});
test("empty and overflow populations fail without selecting a subset", () => {
  has([], "metadata_population_out_of_bounds");
  has(Array.from({ length: 17 }, () => fixture()[0]), "metadata_population_out_of_bounds");
});
test("sealed dates are rejected", () => {
  assert.equal(inspectIdentity(fixture(), "2026-10-27").pass, false);
});
test("missing configuration is unknown, not an all-null default", () => {
  const rows = fixture(); delete rows[0].modelEnvironment.NHL_XG_MODEL_VERSION;
  has(rows, "configuration_evidence_missing");
});
test("changing configuration without changing its identity fails", () => {
  const rows = fixture(); rows[0].modelEnvironment.NHL_XG_MODEL_VERSION = "changed";
  has(rows, "model_hash_mismatch");
});
test("revision and snapshot identities must agree", () => {
  const rows = fixture(); rows[0].snapshotModelIdentity.artifactHash = "b".repeat(64);
  has(rows, "model_identity_missing_or_mismatched");
});
test("historical reconstruction and non-h1 evidence are not prospective identities", () => {
  const rows = fixture(); rows[0].replayClassification = "historical_reconstruction"; rows[0].horizon = 2;
  has(rows, "not_captured_live_h1");
});
test("local, missing or mismatched code versions fail", () => {
  for (const code of [null, "local:" + "a".repeat(40), "b".repeat(40)]) {
    const rows = fixture(); rows[0].codeVersion = code;
    has(rows, "code_identity_missing_or_mismatched");
  }
});
test("invalid chronology and duplicate game rows fail", () => {
  const rows = fixture(); rows[0].issuedAt = rows[0].scheduledAt;
  has(rows, "issuance_chronology_invalid");
  has([...fixture(), ...fixture()], "metadata_identity_invalid");
});
test("a mixed identity slate cannot silently select one model", () => {
  const rows = [...fixture(), ...fixture()]; rows[1].gameId = 2; rows[1].revisionId = "other";
  rows[1].method = rows[1].snapshotMethod = "candidate";
  has(rows, "mixed_model_identities");
});

test("CLI executes through a symlink and rejects empty identity evidence", () => {
  const dir = mkdtempSync(join(tmpdir(), "rso-identity-alias-"));
  try {
    const cli = join(dir, "identity alias.mjs"), file = join(dir, "metadata.json");
    symlinkSync(fileURLToPath(new URL("inspect-identity.mjs", import.meta.url)), cli);
    writeFileSync(file, JSON.stringify(fixture()));
    const good = spawnSync(process.execPath, [cli, file, date], { encoding: "utf8" });
    assert.equal(good.status, 0, good.stderr);
    assert.equal(JSON.parse(good.stdout).pass, true);
    assert.equal(JSON.parse(good.stdout).qualificationReady, false);
    writeFileSync(file, "[]");
    const bad = spawnSync(process.execPath, [cli, file, date], { encoding: "utf8" });
    assert.equal(bad.status, 1, bad.stderr);
    assert.equal(JSON.parse(bad.stdout).pass, false);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});
