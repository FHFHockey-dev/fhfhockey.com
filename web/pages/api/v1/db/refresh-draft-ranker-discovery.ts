import { randomUUID } from "node:crypto";

import type { NextApiRequest, NextApiResponse } from "next";

import { withCronJobAudit } from "lib/cron/withCronJobAudit";
import {
  buildDraftRankerDiscoverySnapshot,
  persistDraftRankerDiscoverySnapshot,
} from "lib/draft-ranker/discoveryServer";
import adminOnly from "utils/adminOnlyMiddleware";

function firstValue(value: string | string[] | undefined): string | null {
  return Array.isArray(value) ? (value[0] ?? null) : (value ?? null);
}

function parseBoolean(value: string | null, fallback: boolean) {
  if (value == null) return fallback;
  return ["1", "true", "yes", "on"].includes(value.trim().toLowerCase());
}

function parseAsOf(value: string | null) {
  if (!value) return new Date().toISOString();
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed))
    throw new Error("asOf must be a valid ISO timestamp.");
  return new Date(parsed).toISOString();
}

function parseOperationId(value: string | null) {
  if (!value) return randomUUID();
  if (
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu.test(
      value,
    )
  ) {
    throw new Error("operationId must be a UUID.");
  }
  return value;
}

async function handler(
  req: NextApiRequest & { supabase: any },
  res: NextApiResponse,
) {
  if (req.method !== "GET" && req.method !== "POST") {
    res.setHeader("Allow", ["GET", "POST"]);
    return res
      .status(405)
      .json({ success: false, error: "Method not allowed." });
  }

  try {
    const body =
      req.body && typeof req.body === "object" && !Array.isArray(req.body)
        ? (req.body as Record<string, unknown>)
        : {};
    const asOf = parseAsOf(
      firstValue(req.query.asOf) ??
        (typeof body.asOf === "string" ? body.asOf : null),
    );
    const requestedDryRun = parseBoolean(
      firstValue(req.query.dryRun) ??
        (typeof body.dryRun === "boolean" ? String(body.dryRun) : null),
      req.method === "GET",
    );
    // GET is observational by contract. Only an explicit POST may materialize.
    const dryRun = req.method === "GET" ? true : requestedDryRun;
    const operationId = parseOperationId(
      firstValue(req.query.operationId) ??
        (typeof body.operationId === "string" ? body.operationId : null),
    );
    const startedAt = Date.now();
    const snapshot = await buildDraftRankerDiscoverySnapshot({
      client: req.supabase,
      asOf,
    });
    const persistence = dryRun
      ? null
      : await persistDraftRankerDiscoverySnapshot({
          client: req.supabase,
          snapshot,
          operationId,
        });

    return res.status(200).json({
      success: true,
      dryRun,
      operationId,
      targetSeasonId: snapshot.targetSeasonId,
      asOf: snapshot.asOf,
      offseason: snapshot.offseason,
      algorithmVersion: snapshot.algorithmVersion,
      sourceFingerprint: snapshot.sourceFingerprint,
      sourceSummary: snapshot.sourceSummary,
      sourceHealth: snapshot.sourceHealth,
      groupCounts: snapshot.groupCounts,
      projectionConsensusCount: snapshot.projectionConsensus.length,
      signals: snapshot.signals.length,
      rowsAffected: snapshot.signals.length,
      warningCodes: snapshot.warningCodes,
      persistence,
      durationMs: Date.now() - startedAt,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return res.status(500).json({
      success: false,
      error: message,
      failedRows: 1,
    });
  }
}

export default withCronJobAudit(adminOnly(handler as any), {
  jobName: "refresh-draft-ranker-discovery",
});
