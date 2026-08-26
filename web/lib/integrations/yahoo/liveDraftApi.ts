import type { NextApiRequest, NextApiResponse } from "next";

import { YahooLiveDraftError } from "./liveDraft";

export type YahooLiveDraftRolloutStage =
  | "off"
  | "staff"
  | "allowlist"
  | "authenticated";

export function isYahooLiveDraftEnabled(
  value = process.env.YAHOO_LIVE_DRAFT_ENABLED,
) {
  return ["1", "true", "yes", "on"].includes(
    String(value ?? "")
      .trim()
      .toLowerCase(),
  );
}

export function yahooLiveDraftRolloutStage(
  value = process.env.YAHOO_LIVE_DRAFT_ROLLOUT_STAGE,
): YahooLiveDraftRolloutStage {
  const stage = String(value ?? "off")
    .trim()
    .toLowerCase();
  return ["off", "staff", "allowlist", "authenticated"].includes(stage)
    ? (stage as YahooLiveDraftRolloutStage)
    : "off";
}

function userIds(value: string | undefined) {
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

export function isYahooLiveDraftUserEntitled(
  userId: string,
  environment: {
    YAHOO_LIVE_DRAFT_ROLLOUT_STAGE?: string;
    YAHOO_LIVE_DRAFT_STAFF_USER_IDS?: string;
    YAHOO_LIVE_DRAFT_BETA_USER_IDS?: string;
    YAHOO_LIVE_DRAFT_PROVIDER_VALIDATED?: string;
  } = process.env as {
    YAHOO_LIVE_DRAFT_ROLLOUT_STAGE?: string;
    YAHOO_LIVE_DRAFT_STAFF_USER_IDS?: string;
    YAHOO_LIVE_DRAFT_BETA_USER_IDS?: string;
    YAHOO_LIVE_DRAFT_PROVIDER_VALIDATED?: string;
  },
) {
  const stage = yahooLiveDraftRolloutStage(
    environment.YAHOO_LIVE_DRAFT_ROLLOUT_STAGE,
  );
  if (stage === "off") return false;
  if (stage === "authenticated") {
    return ["1", "true", "yes", "on"].includes(
      String(environment.YAHOO_LIVE_DRAFT_PROVIDER_VALIDATED ?? "")
        .trim()
        .toLowerCase(),
    );
  }
  const normalizedUserId = userId.trim().toLowerCase();
  if (userIds(environment.YAHOO_LIVE_DRAFT_STAFF_USER_IDS).has(normalizedUserId)) {
    return true;
  }
  return (
    stage === "allowlist" &&
    userIds(environment.YAHOO_LIVE_DRAFT_BETA_USER_IDS).has(normalizedUserId)
  );
}

export function setYahooLiveDraftNoStore(res: NextApiResponse) {
  res.setHeader("Cache-Control", "private, no-store");
  res.setHeader("Pragma", "no-cache");
  res.setHeader("Vary", "Authorization");
}

export function sendYahooLiveDraftDisabled(res: NextApiResponse) {
  return res.status(503).json({
    error: "Yahoo live draft sync is not currently available.",
    code: "yahoo_live_draft_disabled",
  });
}

export function sendYahooLiveDraftForbidden(res: NextApiResponse) {
  return res.status(403).json({
    error: "Yahoo live draft sync is not available for this account yet.",
    code: "yahoo_live_draft_forbidden",
  });
}

export function sendYahooLiveDraftMethodNotAllowed(
  res: NextApiResponse,
  allowed: string[],
) {
  res.setHeader("Allow", allowed.join(", "));
  return res.status(405).json({
    error: "Method not allowed.",
    code: "method_not_allowed",
  });
}

export function sendYahooLiveDraftError(
  res: NextApiResponse,
  error: unknown,
) {
  if (error instanceof YahooLiveDraftError) {
    if (error.retryAfterSeconds && error.retryAfterSeconds > 0) {
      res.setHeader("Retry-After", String(error.retryAfterSeconds));
    }
    return res.status(error.statusCode).json({
      error: error.message,
      code: error.code,
      ...(error.retryAfterSeconds
        ? { retryAfterSeconds: error.retryAfterSeconds }
        : {}),
    });
  }
  console.error("Yahoo live draft API request failed", { error });
  return res.status(500).json({
    error: "Yahoo live draft request could not be completed.",
    code: "internal_error",
  });
}

export function yahooLiveDraftSessionId(req: NextApiRequest) {
  const value = Array.isArray(req.query.sessionId)
    ? req.query.sessionId[0]
    : req.query.sessionId;
  if (!value || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu.test(value)) {
    throw new YahooLiveDraftError(
      "Yahoo draft session id is invalid.",
      400,
      "validation_error",
    );
  }
  return value;
}
