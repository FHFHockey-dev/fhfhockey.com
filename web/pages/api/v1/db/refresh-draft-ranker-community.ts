import { randomUUID } from "node:crypto";

import type { NextApiRequest, NextApiResponse } from "next";

import { withCronJobAudit } from "lib/cron/withCronJobAudit";
import {
  buildDraftRankerCommunitySnapshot,
  communityCadenceForDate,
  communityRefreshIsDue,
  persistDraftRankerCommunitySnapshot,
} from "lib/draft-ranker/communityServer";
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
    const scheduled = parseBoolean(firstValue(req.query.scheduled), false);
    const force = parseBoolean(
      firstValue(req.query.force) ??
        (typeof body.force === "boolean" ? String(body.force) : null),
      false,
    );
    const requestedDryRun = parseBoolean(
      firstValue(req.query.dryRun) ??
        (typeof body.dryRun === "boolean" ? String(body.dryRun) : null),
      req.method === "GET" && !scheduled,
    );
    // Ordinary GET is observational. The Vercel Cron path explicitly supplies
    // scheduled=true and is still protected by CRON_SECRET through adminOnly.
    const dryRun = req.method === "GET" && !scheduled ? true : requestedDryRun;
    const cadence = communityCadenceForDate(asOf);
    if (!dryRun && !force && !communityRefreshIsDue({ asOf, cadence })) {
      return res.status(200).json({
        success: true,
        skipped: true,
        reason: "weekly_cadence_not_due",
        cadence,
        asOf,
        rowsAffected: 0,
      });
    }
    const operationId = parseOperationId(
      firstValue(req.query.operationId) ??
        (typeof body.operationId === "string" ? body.operationId : null),
    );
    const startedAt = Date.now();
    const snapshot = await buildDraftRankerCommunitySnapshot({
      client: req.supabase,
      snapshotAsOf: asOf,
      cadence: force ? "manual" : cadence,
    });
    const persistence = dryRun
      ? null
      : await persistDraftRankerCommunitySnapshot({
          client: req.supabase,
          snapshot,
          operationId,
        });
    return res.status(200).json({
      success: true,
      skipped: false,
      dryRun,
      operationId,
      targetSeasonId: snapshot.targetSeasonId,
      snapshotAsOf: snapshot.snapshotAsOf,
      cadence: snapshot.cadence,
      modelVersion: snapshot.modelVersion,
      sourceFingerprint: snapshot.sourceFingerprint,
      sourceSummary: snapshot.sourceSummary,
      exclusionSummary: snapshot.exclusionSummary,
      acceptedComparisonCount: snapshot.acceptedComparisonCount,
      excludedComparisonCount: snapshot.excludedComparisonCount,
      deduplicatedComparisonCount: snapshot.deduplicatedComparisonCount,
      playerCount: snapshot.results.length,
      publicDisplayCount: snapshot.results.filter(
        (row) => row.public_display_eligible,
      ).length,
      publicTop250Count: snapshot.results.filter(
        (row) => row.public_rank != null,
      ).length,
      rowsAffected: snapshot.results.length,
      converged: snapshot.converged,
      iterations: snapshot.iterations,
      persistence,
      durationMs: Date.now() - startedAt,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : String(error),
      failedRows: 1,
    });
  }
}

export default withCronJobAudit(adminOnly(handler as any), {
  jobName: "refresh-draft-ranker-community",
});
