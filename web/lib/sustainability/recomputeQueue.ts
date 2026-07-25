import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database, Json } from "lib/supabase/database-generated.types";

type QueueClient = SupabaseClient<Database>;
type QueueRow =
  Database["public"]["Tables"]["sustainability_recompute_queue"]["Row"];

export type SustainabilityPipelineStage =
  | "priors"
  | "window_z"
  | "score"
  | "finalize"
  | "trend_bands";

export type SustainabilityRecomputeCursor = {
  stage: SustainabilityPipelineStage;
  season: string | number;
  snapshotDate: string;
  offset: number;
  limit: number;
};

export type SustainabilityStageReceipt = {
  success: boolean;
  processed: number;
};

export type SustainabilityStageRunner = (
  cursor: SustainabilityRecomputeCursor,
  job: {
    configRevision: number;
    modelVersion: string;
    configHash: string;
  },
) => Promise<SustainabilityStageReceipt>;

function currentUtcDate(now: Date): string {
  return now.toISOString().slice(0, 10);
}

function isRecord(
  value: Json | null,
): value is Record<string, Json | undefined> {
  return value != null && typeof value === "object" && !Array.isArray(value);
}

export function parseSustainabilityRecomputeCursor(
  value: Json | null,
  now = new Date(),
): SustainabilityRecomputeCursor {
  if (!isRecord(value)) {
    throw new Error("Sustainability recompute cursor is missing");
  }
  const stage = value.stage;
  if (
    stage !== "priors" &&
    stage !== "window_z" &&
    stage !== "score" &&
    stage !== "finalize" &&
    stage !== "trend_bands"
  ) {
    throw new Error("Sustainability recompute cursor stage is invalid");
  }
  const offset = Number(value.offset);
  const limit = Number(value.limit);
  if (
    !Number.isSafeInteger(offset) ||
    offset < 0 ||
    !Number.isSafeInteger(limit) ||
    limit < 1 ||
    limit > 500
  ) {
    throw new Error("Sustainability recompute cursor bounds are invalid");
  }
  const season =
    typeof value.season === "number" || typeof value.season === "string"
      ? value.season
      : "current";
  const requestedSnapshot =
    typeof value.snapshotDate === "string" ? value.snapshotDate : "current";
  const snapshotDate =
    requestedSnapshot === "current" ? currentUtcDate(now) : requestedSnapshot;
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(snapshotDate) ||
    Number.isNaN(Date.parse(`${snapshotDate}T00:00:00.000Z`))
  ) {
    throw new Error("Sustainability recompute cursor snapshot is invalid");
  }
  return { stage, season, snapshotDate, offset, limit };
}

export function advanceSustainabilityRecomputeCursor(
  cursor: SustainabilityRecomputeCursor,
  receipt: SustainabilityStageReceipt,
): { cursor: SustainabilityRecomputeCursor; completed: boolean } {
  if (!receipt.success || receipt.processed < 0) {
    throw new Error("Sustainability recompute stage receipt is invalid");
  }
  if (cursor.stage === "priors") {
    return {
      cursor: { ...cursor, stage: "window_z", offset: 0 },
      completed: false,
    };
  }
  if (cursor.stage === "finalize") {
    return {
      cursor: { ...cursor, stage: "trend_bands", offset: 0 },
      completed: false,
    };
  }
  if (receipt.processed >= cursor.limit) {
    return {
      cursor: { ...cursor, offset: cursor.offset + cursor.limit },
      completed: false,
    };
  }
  if (cursor.stage === "window_z") {
    return {
      cursor: { ...cursor, stage: "score", offset: 0 },
      completed: false,
    };
  }
  if (cursor.stage === "score") {
    return {
      cursor: { ...cursor, stage: "finalize", offset: 0 },
      completed: false,
    };
  }
  return { cursor, completed: true };
}

async function advanceQueue(args: {
  client: QueueClient;
  jobId: number;
  cursor: SustainabilityRecomputeCursor;
  completed: boolean;
  error: string | null;
}): Promise<QueueRow> {
  const { data, error } = await args.client.rpc(
    "advance_sustainability_recompute_queue",
    {
      p_id: args.jobId,
      p_cursor: args.cursor as unknown as Json,
      p_completed: args.completed,
      p_error: args.error ?? undefined,
    },
  );
  if (error) throw error;
  if (data?.length !== 1) {
    throw new Error("Sustainability recompute queue advance was not unique");
  }
  return data[0];
}

export async function processSustainabilityRecomputeQueue(args: {
  client: QueueClient;
  runStage: SustainabilityStageRunner;
  now?: Date;
}) {
  const { data, error } = await args.client.rpc(
    "claim_sustainability_recompute_queue",
  );
  if (error) throw error;
  if (!data?.length) {
    return { claimed: false, completed: false, status: "idle" as const };
  }
  if (data.length !== 1) {
    throw new Error("Sustainability recompute queue claim was not unique");
  }
  const job = data[0];
  const cursor = parseSustainabilityRecomputeCursor(job.cursor, args.now);

  try {
    const receipt = await args.runStage(cursor, {
      configRevision: job.config_revision,
      modelVersion: job.model_version,
      configHash: job.config_hash,
    });
    const advanced = advanceSustainabilityRecomputeCursor(cursor, receipt);
    const updated = await advanceQueue({
      client: args.client,
      jobId: job.id,
      cursor: advanced.cursor,
      completed: advanced.completed,
      error: null,
    });
    return {
      claimed: true,
      completed: advanced.completed,
      status: updated.status,
      jobId: job.id,
      stage: cursor.stage,
      processed: receipt.processed,
      nextCursor: advanced.cursor,
    };
  } catch {
    const updated = await advanceQueue({
      client: args.client,
      jobId: job.id,
      cursor,
      completed: false,
      error: "stage_failed",
    });
    return {
      claimed: true,
      completed: false,
      status: updated.status,
      jobId: job.id,
      stage: cursor.stage,
      processed: 0,
      nextAttemptAt: updated.next_attempt_at,
    };
  }
}
