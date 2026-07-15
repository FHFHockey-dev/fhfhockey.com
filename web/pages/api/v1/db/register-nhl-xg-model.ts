import path from "path";

import type { NextApiRequest, NextApiResponse } from "next";

import { withCronJobAudit } from "lib/cron/withCronJobAudit";
import supabase from "lib/supabase/server";
import {
  buildXgModelRegistryRow,
  hashXgModelArtifactFile,
  upsertXgModelRegistryRow,
  type XgModelApprovalStatus,
} from "lib/xg/modelRegistry";
import {
  auditXgArtifactFeatureContract,
  loadXgModelArtifact,
  resolveXgArtifactPredictionType,
} from "lib/xg/shotFeaturePersistence";
import adminOnly from "utils/adminOnlyMiddleware";

const MODEL_ARTIFACT_PATH_ENV_VAR = "NHL_XG_MODEL_ARTIFACT_PATH";

function firstQueryValue(value: string | string[] | undefined): string | null {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}

function parseBoolean(value: string | null): boolean {
  return value != null && ["1", "true", "yes", "y"].includes(value.toLowerCase());
}

function parseApprovalStatus(value: string | null): XgModelApprovalStatus | null {
  if (
    value === "candidate" ||
    value === "approved" ||
    value === "rejected" ||
    value === "retired"
  ) {
    return value;
  }
  return null;
}

function resolveArtifactPath(req: NextApiRequest): string | null {
  const queryPath = firstQueryValue(req.query.modelArtifactPath);
  const envPath = process.env[MODEL_ARTIFACT_PATH_ENV_VAR] ?? null;
  const raw = queryPath ?? envPath;
  if (!raw) return null;
  return path.isAbsolute(raw) ? raw : path.resolve(process.cwd(), raw);
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (error && typeof error === "object" && "message" in error) {
    return String((error as { message?: unknown }).message);
  }
  return String(error);
}

async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET" && req.method !== "POST") {
    res.setHeader("Allow", ["GET", "POST"]);
    return res.status(405).json({ success: false, error: "Method not allowed" });
  }

  const artifactPath = resolveArtifactPath(req);
  if (!artifactPath) {
    return res.status(400).json({
      success: false,
      requiredEnvVar: MODEL_ARTIFACT_PATH_ENV_VAR,
      error:
        `Provide modelArtifactPath or set ${MODEL_ARTIFACT_PATH_ENV_VAR} ` +
        "before registering an xG model artifact.",
    });
  }

  try {
    const artifact = loadXgModelArtifact(artifactPath);
    const featureContract = auditXgArtifactFeatureContract({ artifact });
    if (!featureContract.passed) {
      return res.status(409).json({
        success: false,
        artifactTag: artifact.artifactTag,
        predictionType: resolveXgArtifactPredictionType(artifact),
        featureContract,
        error: "The selected xG artifact feature contract is invalid and cannot be registered.",
      });
    }

    const row = buildXgModelRegistryRow({
      artifact,
      artifactPath,
      artifactChecksum: hashXgModelArtifactFile(artifactPath),
      approvalStatus: parseApprovalStatus(firstQueryValue(req.query.approvalStatus)),
      deploymentAlias: firstQueryValue(req.query.deploymentAlias) ?? "candidate",
      isActive: parseBoolean(firstQueryValue(req.query.active)),
      isChampion: parseBoolean(firstQueryValue(req.query.champion)),
    });

    await upsertXgModelRegistryRow({ supabase, row });

    return res.status(200).json({
      success: true,
      registered: {
        modelVersion: row.model_version,
        predictionType: row.prediction_type,
        artifactChecksum: row.artifact_checksum,
        featureManifestHash: row.feature_manifest_hash,
        calibrationFingerprint: row.calibration_fingerprint,
        approvalStatus: row.approval_status,
        modelApproved: row.model_approved,
        deploymentAlias: row.deployment_alias,
        isActive: row.is_active,
        isChampion: row.is_champion,
      },
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: `Failed to register xG model artifact: ${getErrorMessage(error)}`,
    });
  }
}

export default withCronJobAudit(adminOnly(handler as any), {
  jobName: "register-nhl-xg-model",
});
