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
