import type { NextApiRequest, NextApiResponse } from "next";
import { z } from "zod";

import { withCronJobAudit } from "lib/cron/withCronJobAudit";
import {
  buildDraftRankerCommunitySnapshot,
  persistDraftRankerCommunitySnapshot,
} from "lib/draft-ranker/communityServer";
import {
  loadDraftRankerHealth,
  normalizeDraftRankingOrdering,
  queueDraftRankerIdentityReview,
} from "lib/draft-ranker/healthServer";
import adminOnly from "utils/adminOnlyMiddleware";

const operation = z.object({
  operationId: z.string().uuid(),
  reason: z.string().trim().min(5).max(500),
});

const actionSchema = z.discriminatedUnion("action", [
  operation
    .extend({
      action: z.literal("normalize_ordering"),
      rankingId: z.string().uuid(),
      expectedVersion: z.number().int().nonnegative(),
      confirmation: z.literal("NORMALIZE_ORDERING"),
    })
    .strict(),
  operation
    .extend({
      action: z.literal("queue_identity_review"),
      playerId: z.number().int().positive(),
      confirmation: z.literal("QUEUE_IDENTITY_REVIEW"),
    })
    .strict(),
  operation
    .extend({
      action: z.literal("rebuild_community_snapshot"),
      asOf: z.string().datetime().optional(),
      dryRun: z.boolean().optional().default(true),
      confirmation: z.literal("REBUILD_COMMUNITY"),
    })
    .strict(),
]);

function statusForResult(result: unknown): number {
  if (!result || typeof result !== "object") return 200;
  const status = String((result as Record<string, unknown>).status ?? "");
  const code = String((result as Record<string, unknown>).code ?? "");
  if (status === "not_found") return 404;
  if (status === "conflict") return 409;
  if (status === "failed" && code === "confirmation_required") return 422;
  return 200;
}

export async function draftRankerHealthHandler(
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
    if (req.method === "GET") {
      const report = await loadDraftRankerHealth(req.supabase);
      return res.status(200).json({ success: true, report, rowsAffected: 0 });
    }
    const parsed = actionSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        success: false,
        error: "Invalid Draft Ranker health operation.",
        details: parsed.error.flatten(),
        failedRows: 1,
      });
    }
    const input = parsed.data;
    if (input.action === "normalize_ordering") {
      const result = await normalizeDraftRankingOrdering(req.supabase, input);
      return res.status(statusForResult(result)).json({
        success: statusForResult(result) === 200,
        action: input.action,
        result,
        rowsAffected: Number(
          (result as Record<string, unknown> | null)?.changedEntryCount ?? 0,
        ),
      });
    }
    if (input.action === "queue_identity_review") {
      const result = await queueDraftRankerIdentityReview(req.supabase, input);
      return res.status(statusForResult(result)).json({
        success: statusForResult(result) === 200,
        action: input.action,
        result,
        rowsAffected:
          (result as { idempotentReplay?: boolean }).idempotentReplay === false
            ? 1
            : 0,
      });
    }
    const asOf = input.asOf ?? new Date().toISOString();
    const snapshot = await buildDraftRankerCommunitySnapshot({
      client: req.supabase,
      snapshotAsOf: asOf,
      cadence: "manual",
    });
    const persistence = input.dryRun
      ? null
      : await persistDraftRankerCommunitySnapshot({
          client: req.supabase,
          snapshot,
          operationId: input.operationId,
        });
    return res.status(200).json({
      success: true,
      action: input.action,
      dryRun: input.dryRun,
      reason: input.reason,
      snapshot: {
        targetSeasonId: snapshot.targetSeasonId,
        snapshotAsOf: snapshot.snapshotAsOf,
        sourceFingerprint: snapshot.sourceFingerprint,
        playerCount: snapshot.results.length,
        publicTop250Count: snapshot.results.filter(
          (row) => row.public_rank != null,
        ).length,
        acceptedComparisonCount: snapshot.acceptedComparisonCount,
        converged: snapshot.converged,
      },
      persistence,
      rowsAffected: input.dryRun ? 0 : snapshot.results.length,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : String(error),
      failedRows: 1,
    });
  }
}

export default withCronJobAudit(adminOnly(draftRankerHealthHandler as any), {
  jobName: "draft-ranker-health-operations",
});
