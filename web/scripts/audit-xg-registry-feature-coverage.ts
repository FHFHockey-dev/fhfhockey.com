import crypto from "crypto";
import fs from "fs";
import path from "path";

import supabase from "../lib/supabase/server";
import { buildXgFeatureCoverageProfile } from "../lib/xg/featureCoverage";

const PAGE_SIZE = 1000;
const GAME_CHUNK_SIZE = 25;
const DEFAULT_ARTIFACT_DIR = path.resolve(
  process.cwd(),
  "scripts/output/xg-approval-run-20260522/logistic_l2-s20252026-p1-st1-f1-cfg9bac2706",
);

function chunks<T>(values: T[], size: number): T[][] {
  return Array.from({ length: Math.ceil(values.length / size) }, (_, index) =>
    values.slice(index * size, index * size + size),
  );
}

function stableJsonStringify(value: unknown): string {
  if (value == null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableJsonStringify).join(",")}]`;
  const object = value as Record<string, unknown>;
  return `{${Object.keys(object).sort().map((key) => `${JSON.stringify(key)}:${stableJsonStringify(object[key])}`).join(",")}}`;
}

async function main() {
  const artifactDirArg = process.argv.find((value) => value.startsWith("--artifactDir="));
  const artifactDir = path.resolve(artifactDirArg?.slice("--artifactDir=".length) || DEFAULT_ARTIFACT_DIR);
  const includeProfile = process.argv.includes("--includeProfile");
  const persistApprovedException = process.argv.includes("--persistApprovedException");
  const dataset = JSON.parse(fs.readFileSync(path.join(artifactDir, "dataset-artifact.json"), "utf8"));
  const model = JSON.parse(fs.readFileSync(path.join(artifactDir, "model-artifact.json"), "utf8"));
  const wantedRowIds = new Set<string>(dataset.rowIds);
  const gameIds = Array.from(
    new Set<number>(dataset.rowIds.map((rowId: string) => Number(rowId.split(":")[0]))),
  );
  const rows: any[] = [];
  const matchedRowIds = new Set<string>();

  for (const gameChunk of chunks(gameIds, GAME_CHUNK_SIZE)) {
    for (let from = 0; ; from += PAGE_SIZE) {
      const { data, error } = await (supabase as any)
        .from("nhl_xg_shot_features")
        .select("game_id,event_id,feature_payload")
        .eq("feature_version", model.featureVersion)
        .in("game_id", gameChunk)
        .order("game_id")
        .order("event_id")
        .range(from, from + PAGE_SIZE - 1);
      if (error) throw error;
      const page = data ?? [];
      for (const row of page) {
        const rowId = `${row.game_id}:${row.event_id}`;
        if (wantedRowIds.has(rowId)) {
          rows.push(row.feature_payload);
          matchedRowIds.add(rowId);
        }
      }
      if (page.length < PAGE_SIZE) break;
    }
  }

  const profile = buildXgFeatureCoverageProfile({
    rows,
    selectedFeatures: model.selectedFeatures,
  });
  const profileSha256 = crypto.createHash("sha256").update(JSON.stringify(profile)).digest("hex");
  const semanticProfileSha256 = crypto.createHash("sha256").update(stableJsonStringify(profile)).digest("hex");
  const missingRowIds = dataset.rowIds.filter((rowId: string) => !matchedRowIds.has(rowId));
  const { data: registryBefore, error: registryBeforeError } = await (supabase as any)
    .from("nhl_xg_model_registry")
    .select("model_version,prediction_type,approval_status,model_approved,deployment_alias,is_active,is_champion,selected_features,feature_coverage,approval_metadata")
    .eq("model_version", model.artifactTag)
    .eq("prediction_type", "shot_goal")
    .single();
  if (registryBeforeError) throw registryBeforeError;
  const lifecycleBefore = {
    approvalStatus: registryBefore.approval_status,
    modelApproved: registryBefore.model_approved,
    deploymentAlias: registryBefore.deployment_alias,
    isActive: registryBefore.is_active,
    isChampion: registryBefore.is_champion,
  };
  let persistence: Record<string, unknown> = { requested: false };

  if (persistApprovedException) {
    if (dataset.rowIds.length !== 118299 || rows.length !== 118222 || missingRowIds.length !== 77) {
      throw new Error("Approved coverage exception guard failed: immutable manifest/match counts changed.");
    }
    if (registryBefore.feature_coverage != null) {
      throw new Error("Approved coverage exception guard failed: registry feature_coverage is no longer null.");
    }
    if (registryBefore.is_active !== true || registryBefore.is_champion !== true) {
      throw new Error("Approved coverage exception guard failed: exact model is no longer active/champion.");
    }
    if (stableJsonStringify(registryBefore.selected_features) !== stableJsonStringify(model.selectedFeatures)) {
      throw new Error("Approved coverage exception guard failed: registry/artifact selected features differ.");
    }
    const exceptionProvenance = {
      kind: "reconstructed_coverage_approved_exception",
      approvedOn: "2026-07-12",
      datasetRowIds: dataset.rowIds.length,
      matchedRows: rows.length,
      missingRows: missingRowIds.length,
      missingRowIdsSha256: crypto.createHash("sha256").update(JSON.stringify(missingRowIds)).digest("hex"),
      profileSha256,
      semanticProfileSha256,
      predictionMathChanged: false,
      lifecycleChanged: false,
    };
    const { data: updatedRows, error: updateError } = await (supabase as any)
      .from("nhl_xg_model_registry")
      .update({
        feature_coverage: profile,
        approval_metadata: {
          ...(registryBefore.approval_metadata ?? {}),
          coverageReconstruction: exceptionProvenance,
        },
        updated_at: new Date().toISOString(),
      })
      .eq("model_version", model.artifactTag)
      .eq("prediction_type", "shot_goal")
      .eq("is_active", true)
      .eq("is_champion", true)
      .is("feature_coverage", null)
      .select("model_version,prediction_type,approval_status,model_approved,deployment_alias,is_active,is_champion,feature_coverage,approval_metadata");
    if (updateError) throw updateError;
    if (!updatedRows || updatedRows.length !== 1) {
      throw new Error(`Approved coverage exception write affected ${updatedRows?.length ?? 0} rows; expected 1.`);
    }
    const updated = updatedRows[0];
    const lifecycleAfter = {
      approvalStatus: updated.approval_status,
      modelApproved: updated.model_approved,
      deploymentAlias: updated.deployment_alias,
      isActive: updated.is_active,
      isChampion: updated.is_champion,
    };
    const readbackSha256 = crypto.createHash("sha256").update(stableJsonStringify(updated.feature_coverage)).digest("hex");
    if (JSON.stringify(lifecycleAfter) !== JSON.stringify(lifecycleBefore)) {
      throw new Error("Lifecycle changed during coverage metadata persistence.");
    }
    if (readbackSha256 !== semanticProfileSha256) {
      throw new Error(`Coverage readback hash ${readbackSha256} does not match ${semanticProfileSha256}.`);
    }
    persistence = { requested: true, updatedRows: 1, readbackSha256, lifecycleBefore, lifecycleAfter };
  }
  const summary = {
    artifactTag: model.artifactTag,
    datasetRowIds: dataset.rowIds.length,
    matchedRows: rows.length,
    missingRows: missingRowIds.length,
    missingRowIdSample: missingRowIds.slice(0, 20),
    missingRowIdsSha256: crypto.createHash("sha256").update(JSON.stringify(missingRowIds)).digest("hex"),
    gameCount: gameIds.length,
    featureCount: Object.keys(profile.features).length,
    profileSha256,
    semanticProfileSha256,
    blockingReasons: profile.blockingReasons,
    warnings: profile.warnings,
    lifecycleBefore,
    persistence,
    ...(includeProfile ? { profile } : {}),
  };
  process.stdout.write(`${JSON.stringify(summary, null, 2)}\n`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
