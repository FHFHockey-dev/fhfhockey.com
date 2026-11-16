// Offline metadata consistency check. Never pins a scope or grants release/forecast admission.
import { readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";
import { canonicalHash } from "../qualification-readbacks/tooling/check-readbacks.mjs";

const envKeys = ["FORGE_SKATER_MODEL_MODE", "NHL_XG_TEAM_AGGREGATE_MODEL_VERSION", "NHL_XG_TEAM_AGGREGATE_FEATURE_VERSION",
  "NHL_XG_TEAM_AGGREGATE_WINDOW_GAMES", "NHL_XG_MODEL_VERSION", "START_CHART_GAME_REVISIONS",
  "STARTER_BOARD_COMPUTE_ENABLED", "STARTER_BOARD_SEASON_BOOTSTRAP_ENABLED"].sort();
const sha = /^[a-f0-9]{40}$/, hash = /^[a-f0-9]{64}$/;
const clock = value => typeof value === "string" ? Date.parse(value) : NaN;
export function inspectIdentity(rows, date) {
  const findings = [], identities = new Map();
  const add = (code, revisionId = null) => findings.push({ code, revisionId });
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date ?? "") || !Number.isFinite(Date.parse(date)) || date <= "2026-10-30") add("date_outside_prospective_window");
  if (!Array.isArray(rows) || rows.length === 0 || rows.length > 16) add("metadata_population_out_of_bounds");
  if (findings.length) return { pass: false, findings, identity: null, qualificationReady: false };
  const games = new Set();
  for (const row of rows) {
    if (!row || typeof row !== "object") { add("metadata_row_invalid"); continue; }
    const id = row.revisionId;
    if (typeof id !== "string" || !id || typeof row.runId !== "string" || !row.runId
      || !Number.isSafeInteger(row.gameId) || row.gameId <= 0 || games.has(row.gameId)) add("metadata_identity_invalid", id);
    games.add(row.gameId);
    if (row.gameDate !== date || row.snapshotSlateDate !== date) add("date_mismatch", id);
    if (row.snapshotVersion !== "forge-inputs-v1" || row.snapshotRunId !== row.runId
      || row.replayClassification !== "captured_live" || row.horizon !== 1 || row.runStatus !== "succeeded") add("not_captured_live_h1", id);
    if (!sha.test(row.codeVersion ?? "") || row.snapshotCodeVersion !== row.codeVersion || !sha.test(row.runGitSha ?? "")) add("code_identity_missing_or_mismatched", id);
    if (!["baseline", "candidate"].includes(row.method) || row.snapshotMethod !== row.method) add("method_mismatch", id);
    if (!(clock(row.cutoffAt) <= clock(row.issuedAt) && clock(row.issuedAt) < clock(row.scheduledAt))) add("issuance_chronology_invalid", id);
    const environment = row.modelEnvironment;
    if (!environment || typeof environment !== "object" || Array.isArray(environment)
      || JSON.stringify(Object.keys(environment).sort()) !== JSON.stringify(envKeys)
      || Object.values(environment).some(value => value !== null && typeof value !== "string")) {
      add("configuration_evidence_missing", id); continue;
    }
    const model = row.modelIdentity;
    if (!model || model.version !== "forge-model-identity-v1" || model.artifact !== "no_fitted_artifact"
      || !hash.test(model.configurationHash ?? "") || !hash.test(model.artifactHash ?? "")
      || canonicalHash(model) !== canonicalHash(row.snapshotModelIdentity ?? null)) {
      add("model_identity_missing_or_mismatched", id); continue;
    }
    if (model.configurationHash !== canonicalHash(environment)
      || model.artifactHash !== canonicalHash({ codeVersion: row.codeVersion, configurationHash: model.configurationHash })) add("model_hash_mismatch", id);
    const identity = { target: "SHOTS_ON_GOAL", method: row.method, codeVersion: row.codeVersion,
      configurationHash: model.configurationHash, artifactHash: model.artifactHash, horizon: 1 };
    identities.set(canonicalHash(identity), identity);
  }
  if (identities.size > 1) add("mixed_model_identities");
  return { pass: findings.length === 0, findings, identity: findings.length ? null : [...identities.values()][0],
    qualificationReady: false, releaseAttribution: "requires_exact_release_and_run_proof_review",
    consumerSelection: "latest_per_game_metadata_only_not_selected_RPC_or_readback" };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    const [input, date] = process.argv.slice(2);
    const result = inspectIdentity(JSON.parse(readFileSync(input, "utf8")), date);
    process.stdout.write(JSON.stringify(result, null, 2) + "\n");
    process.exitCode = result.pass ? 0 : 1;
  } catch (error) { console.error(error.message); process.exitCode = 2; }
}
