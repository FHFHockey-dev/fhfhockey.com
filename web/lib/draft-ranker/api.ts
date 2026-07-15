import { randomUUID } from "node:crypto";

import type { NextApiRequest, NextApiResponse } from "next";
import type { ZodType } from "zod";

export type DraftRankerErrorCode =
  | "authentication_required"
  | "draft_ranker_disabled"
  | "forbidden"
  | "idempotency_conflict"
  | "internal_error"
  | "method_not_allowed"
  | "not_found"
  | "rate_limited"
  | "stale_ranking_version"
  | "unprocessable"
  | "validation_error";

export class DraftRankerApiError extends Error {
  constructor(
    public readonly statusCode: number,
    public readonly code: DraftRankerErrorCode,
    message: string,
    public readonly details: Record<string, unknown> = {},
  ) {
    super(message);
    this.name = "DraftRankerApiError";
  }
}

export function draftRankerRequestId(req: NextApiRequest): string {
  const header = req.headers["x-request-id"];
  const candidate = Array.isArray(header) ? header[0] : header;
  return candidate && /^[A-Za-z0-9._:-]{1,128}$/u.test(candidate)
    ? candidate
    : randomUUID();
}

export function sendDraftRankerData<T>(
  res: NextApiResponse,
  requestId: string,
  data: T,
  statusCode = 200,
) {
  res.setHeader("X-Request-Id", requestId);
  return res.status(statusCode).json({ data, requestId });
}

export function sendDraftRankerError(
  res: NextApiResponse,
  requestId: string,
  error: DraftRankerApiError,
) {
  res.setHeader("X-Request-Id", requestId);
  if (
    error.code === "rate_limited" &&
    Number.isInteger(error.details.retryAfterSeconds) &&
    Number(error.details.retryAfterSeconds) > 0
  ) {
    res.setHeader("Retry-After", String(error.details.retryAfterSeconds));
  }
  return res.status(error.statusCode).json({
    error: {
      code: error.code,
      message: error.message,
      requestId,
      details: error.details,
    },
  });
}

export function parseDraftRankerInput<T>(
  schema: ZodType<T>,
  value: unknown,
): T {
  const parsed = schema.safeParse(value);
  if (parsed.success) {
    return parsed.data;
  }
  throw new DraftRankerApiError(
    400,
    "validation_error",
    "The request payload is invalid.",
    parsed.error.flatten(),
  );
}

export function isDraftRankerEnabled(
  value = process.env.DRAFT_RANKER_ENABLED,
): boolean {
  return ["1", "true", "yes", "on"].includes(
    String(value ?? "")
      .trim()
      .toLowerCase(),
  );
}

export function isDraftRankerHomepageEnabled(
  value = process.env.DRAFT_RANKER_HOMEPAGE_ENABLED,
): boolean {
  return ["1", "true", "yes", "on"].includes(
    String(value ?? "")
      .trim()
      .toLowerCase(),
  );
}

export function isDraftRankerCommunityContributionEnabled(
  value = process.env.DRAFT_RANKER_COMMUNITY_CONTRIBUTION_ENABLED,
): boolean {
  return ["1", "true", "yes", "on"].includes(
    String(value ?? "")
      .trim()
      .toLowerCase(),
  );
}

export function isDraftRankerDiscoveryEnabled(
  value = process.env.DRAFT_RANKER_DISCOVERY_ENABLED,
): boolean {
  return ["1", "true", "yes", "on"].includes(
    String(value ?? "")
      .trim()
      .toLowerCase(),
  );
}

export function isCommunityDraftRankingsEnabled(
  value = process.env.COMMUNITY_DRAFT_RANKINGS_ENABLED,
): boolean {
  return ["1", "true", "yes", "on"].includes(
    String(value ?? "")
      .trim()
      .toLowerCase(),
  );
}

export type DraftRankerRolloutStage =
  | "off"
  | "staff"
  | "allowlist"
  | "authenticated";

export function draftRankerRolloutStage(
  value = process.env.DRAFT_RANKER_ROLLOUT_STAGE,
): DraftRankerRolloutStage {
  const stage = String(value ?? "off")
    .trim()
    .toLowerCase();
  return ["off", "staff", "allowlist", "authenticated"].includes(stage)
    ? (stage as DraftRankerRolloutStage)
    : "off";
}

function rolloutUserIds(value: string | undefined): Set<string> {
  return new Set(
    String(value ?? "")
      .split(",")
      .map((id) => id.trim().toLowerCase())
      .filter((id) =>
        /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u.test(
          id,
        ),
      ),
  );
}

export function isDraftRankerUserEntitled(
  userId: string,
  environment: {
    DRAFT_RANKER_ROLLOUT_STAGE?: string;
    DRAFT_RANKER_STAFF_USER_IDS?: string;
    DRAFT_RANKER_BETA_USER_IDS?: string;
  } = process.env as {
    DRAFT_RANKER_ROLLOUT_STAGE?: string;
    DRAFT_RANKER_STAFF_USER_IDS?: string;
    DRAFT_RANKER_BETA_USER_IDS?: string;
  },
): boolean {
  const stage = draftRankerRolloutStage(environment.DRAFT_RANKER_ROLLOUT_STAGE);
  if (stage === "off") return false;
  if (stage === "authenticated") return true;
  const normalizedUserId = userId.trim().toLowerCase();
  const staff = rolloutUserIds(environment.DRAFT_RANKER_STAFF_USER_IDS);
  if (staff.has(normalizedUserId)) return true;
  return (
    stage === "allowlist" &&
    rolloutUserIds(environment.DRAFT_RANKER_BETA_USER_IDS).has(normalizedUserId)
  );
}

export function assertDraftRankerRolloutAccess(userId: string): void {
  if (!isDraftRankerUserEntitled(userId)) {
    throw new DraftRankerApiError(
      403,
      "forbidden",
      "The Draft Ranker is not available for this account yet.",
    );
  }
}

export function draftRankerMethodNotAllowed(
  res: NextApiResponse,
  requestId: string,
  allowed: string[],
) {
  res.setHeader("Allow", allowed.join(", "));
  return sendDraftRankerError(
    res,
    requestId,
    new DraftRankerApiError(405, "method_not_allowed", "Method not allowed.", {
      allowed,
    }),
  );
}

export function handleDraftRankerError(
  res: NextApiResponse,
  requestId: string,
  error: unknown,
) {
  if (error instanceof DraftRankerApiError) {
    return sendDraftRankerError(res, requestId, error);
  }
  console.error("Draft Ranker API request failed", { requestId, error });
  return sendDraftRankerError(
    res,
    requestId,
    new DraftRankerApiError(
      500,
      "internal_error",
      "The Draft Ranker request could not be completed.",
    ),
  );
}
