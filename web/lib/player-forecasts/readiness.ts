import type { SupabaseClient } from "@supabase/supabase-js";

import {
  PLAYER_FORECAST_RESEARCH_CONTRACT_SHA256,
  PLAYER_FORECAST_RESEARCH_CONTRACT_VERSION,
  playerForecastResearchGate,
} from "./researchContract";
import { playerForecastRuntimeBoundary } from "./runtimeSafety";

const REQUIRED_TABLES = [
  "player_forecast_schedule_revisions",
  "player_forecast_source_observations",
  "player_forecast_goalie_start_observations",
  "player_forecast_lineup_snapshots",
  "player_forecast_lineup_assignments",
  "player_forecast_observation_conflicts",
  "player_forecast_conflict_members",
  "player_forecast_conflict_resolutions",
  "player_forecast_feature_snapshots",
  "player_forecast_model_artifacts",
  "player_forecast_inference_queue",
  "player_forecast_runs",
  "player_forecast_outputs",
  "player_forecast_rest_of_season_outputs",
  "player_forecast_outcome_revisions",
  "player_forecast_evaluation_revisions",
  "player_forecast_accountability_revisions",
  "player_forecast_champion_history",
] as const;

type Environment = Record<string, string | undefined>;
type Fetch = typeof fetch;

export function playerForecastEnvironmentReadiness(environment: Environment) {
  const required = {
    supabaseUrl: Boolean(environment.NEXT_PUBLIC_SUPABASE_URL?.trim()),
    serviceRole: Boolean(environment.SUPABASE_SERVICE_ROLE_KEY?.trim()),
    cronSecret: Boolean(environment.CRON_SECRET?.trim()),
    inferenceUrl: Boolean(environment.PLAYER_FORECAST_INFERENCE_URL?.trim()),
    inferenceSecret: Boolean(environment.PLAYER_FORECAST_INFERENCE_SECRET?.trim()),
    resend: Boolean(environment.RESEND_API_KEY?.trim()),
  };
  return { ...required, ready: Object.values(required).every(Boolean) };
}

export async function probePlayerForecastTable(
  supabase: SupabaseClient<any>,
  table: string,
) {
  const { error } = await supabase.from(table).select("id").limit(1);
  return {
    table,
    present: !error,
    errorCode: typeof error?.code === "string" ? error.code : null,
  };
}

async function tableReadiness(supabase: SupabaseClient<any>) {
  return Promise.all(
    REQUIRED_TABLES.map((table) => probePlayerForecastTable(supabase, table)),
  );
}

async function workerReadiness(args: {
  environment: Environment;
  fetchImpl: Fetch;
}) {
  const url = args.environment.PLAYER_FORECAST_INFERENCE_URL?.trim();
  const secret = args.environment.PLAYER_FORECAST_INFERENCE_SECRET?.trim();
  if (!url || !secret) {
    return { configured: false, reachable: false, contractMatch: false };
  }
  try {
    const response = await args.fetchImpl(url, {
      method: "GET",
      headers: { Authorization: `Bearer ${secret}` },
      signal: AbortSignal.timeout(4_000),
    });
    const payload = response.ok
      ? await response.json() as Record<string, unknown>
      : {};
    return {
      configured: true,
      reachable: response.ok,
      contractMatch:
        payload.contractChecksum === PLAYER_FORECAST_RESEARCH_CONTRACT_SHA256,
    };
  } catch {
    return { configured: true, reachable: false, contractMatch: false };
  }
}

export async function collectPlayerForecastReadiness(args: {
  supabase: SupabaseClient<any>;
  environment?: Environment;
  fetchImpl?: Fetch;
}) {
  const environment = args.environment ?? process.env;
  const [
    tables,
    worker,
    queueResult,
    bucketResult,
    artifactResult,
    sourceResult,
    goalieSourceResult,
    lineupSourceResult,
    outcomeResult,
    outputResult,
  ] =
    await Promise.all([
      tableReadiness(args.supabase),
      workerReadiness({ environment, fetchImpl: args.fetchImpl ?? fetch }),
      args.supabase
        .from("player_forecast_inference_queue")
        .select("status,not_before,lease_expires_at,updated_at")
        .limit(5_000),
      args.supabase.storage.getBucket("player-forecast-models"),
      args.supabase
        .from("player_forecast_model_artifacts")
        .select("id,model_key,model_version,feature_schema_version,artifact_checksum,evidence")
        .eq("lifecycle_status", "shadow")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
      args.supabase
        .from("player_forecast_source_observations")
        .select("provider,dataset_key,available_at")
        .order("available_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
      args.supabase
        .from("player_forecast_goalie_start_observations")
        .select("source_group,source_key,available_at")
        .eq("accepted", true)
        .order("available_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
      args.supabase
        .from("player_forecast_lineup_snapshots")
        .select("source_group,source_key,classification,available_at")
        .eq("accepted", true)
        .order("available_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
      args.supabase
        .from("player_forecast_outcome_revisions")
        .select("available_at,finality")
        .order("available_at", { ascending: false })
        .limit(1),
      args.supabase
        .from("player_forecast_outputs")
        .select("id", { count: "exact" })
        .limit(1),
    ]);

  const queue = { pending: 0, running: 0, succeeded: 0, failed: 0, cancelled: 0 };
  let expiredLeases = 0;
  const now = Date.now();
  if (!queueResult.error) {
    for (const row of queueResult.data ?? []) {
      if (row.status in queue) queue[row.status as keyof typeof queue] += 1;
      if (
        row.status === "running" &&
        row.lease_expires_at &&
        Date.parse(row.lease_expires_at) <= now
      ) expiredLeases += 1;
    }
  }

  const missingTables = tables
    .filter((entry) => !entry.present)
    .map((entry) => entry.table);
  const environmentStatus = playerForecastEnvironmentReadiness(environment);
  const runtimeBoundary = playerForecastRuntimeBoundary(environment);
  const researchGate = playerForecastResearchGate(environment);
  const bucketPrivate = Boolean(bucketResult.data && !bucketResult.data.public);
  const artifactEvidence = artifactResult.data?.evidence as Record<string, any> | null;
  const receiptBound = Boolean(
    artifactEvidence?.primaryReceipt?.documentChecksum && artifactEvidence?.primaryReceipt?.blobChecksum,
  );
  const evidenceBound = Boolean(
    artifactEvidence?.lockboxEvidence?.documentChecksum && artifactEvidence?.lockboxEvidence?.blobChecksum,
  );
  const servingArtifactReady = Boolean(
    !artifactResult.error && artifactResult.data && receiptBound && evidenceBound,
  );
  const freshness = (result: { data: Record<string, any> | null; error: unknown }) => {
    const availableAt = result.data?.available_at ?? null;
    const availableTime = availableAt ? Date.parse(availableAt) : null;
    return {
      availableAt,
      ageSeconds: availableTime != null
        ? Math.floor((now - availableTime) / 1_000)
        : null,
      futureDated: availableTime != null ? availableTime > now : false,
      queryAvailable: !result.error,
    };
  };
  const readyForContractSmoke =
    missingTables.length === 0 &&
    runtimeBoundary.allowed &&
    environmentStatus.ready &&
    worker.reachable &&
    worker.contractMatch &&
    bucketPrivate;

  return {
    success: true as const,
    generatedAt: new Date().toISOString(),
    contract: {
      version: PLAYER_FORECAST_RESEARCH_CONTRACT_VERSION,
      checksum: PLAYER_FORECAST_RESEARCH_CONTRACT_SHA256,
      ...researchGate,
    },
    environment: environmentStatus,
    runtimeBoundary,
    database: {
      requiredTables: REQUIRED_TABLES.length,
      presentTables: REQUIRED_TABLES.length - missingTables.length,
      missingTables,
    },
    worker,
    queue: { ...queue, expiredLeases, queryAvailable: !queueResult.error },
    sourceFreshness: {
      generic: {
        ...freshness(sourceResult),
        provider: sourceResult.data?.provider ?? null,
        datasetKey: sourceResult.data?.dataset_key ?? null,
      },
      goalieStarts: {
        ...freshness(goalieSourceResult),
        sourceGroup: goalieSourceResult.data?.source_group ?? null,
        sourceKey: goalieSourceResult.data?.source_key ?? null,
      },
      lineups: {
        ...freshness(lineupSourceResult),
        sourceGroup: lineupSourceResult.data?.source_group ?? null,
        sourceKey: lineupSourceResult.data?.source_key ?? null,
        classification: lineupSourceResult.data?.classification ?? null,
      },
    },
    artifactStorage: {
      exists: Boolean(bucketResult.data),
      private: bucketPrivate,
      servingArtifactRegistered: Boolean(artifactResult.data),
      servingArtifactReady,
      receiptBound,
      evidenceBound,
      modelKey: artifactResult.data?.model_key ?? null,
      modelVersion: artifactResult.data?.model_version ?? null,
      featureSchemaVersion: artifactResult.data?.feature_schema_version ?? null,
      artifactChecksum: artifactResult.data?.artifact_checksum ?? null,
    },
    settlement: {
      outputs: outputResult.count ?? 0,
      latestOutcomeAt: outcomeResult.data?.[0]?.available_at ?? null,
      latestOutcomeFinality: outcomeResult.data?.[0]?.finality ?? null,
    },
    readyForContractSmoke,
    readyForInference:
      readyForContractSmoke && researchGate.inferenceEnabled && servingArtifactReady,
  };
}
