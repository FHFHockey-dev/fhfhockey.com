import { getDraftProFeatureFlags } from "lib/draft-pro/features";
import type { DraftProAccess } from "lib/draft-pro/contracts";
import { loadDraftProAccess } from "lib/draft-pro/server";

import {
  isYahooLiveDraftEnabled,
  isYahooLiveDraftUserEntitled,
} from "./liveDraftApi";
import { YahooLiveDraftError } from "./liveDraft";

export type YahooLiveDraftEnvironment = {
  YAHOO_LIVE_DRAFT_BETA_USER_IDS?: string;
  YAHOO_LIVE_DRAFT_ENABLED?: string;
  YAHOO_LIVE_DRAFT_PROVIDER_VALIDATED?: string;
  YAHOO_LIVE_DRAFT_ROLLOUT_STAGE?: string;
  YAHOO_LIVE_DRAFT_STAFF_USER_IDS?: string;
};

export function isYahooLiveDraftProviderReady(
  environment: YahooLiveDraftEnvironment = process.env,
) {
  return environment.YAHOO_LIVE_DRAFT_PROVIDER_VALIDATED === "true";
}

export function isConfirmedYahooLiveDraftAccessLoss(error: unknown) {
  return (
    error instanceof YahooLiveDraftError &&
    ["yahoo_draft_pro_access_required", "yahoo_draft_pro_expired"].includes(
      error.code,
    )
  );
}

export function assertYahooLiveDraftServerAccess(args: {
  access: DraftProAccess;
  environment?: YahooLiveDraftEnvironment;
  userId: string;
}) {
  const environment = args.environment ?? process.env;
  if (!isYahooLiveDraftEnabled(environment.YAHOO_LIVE_DRAFT_ENABLED)) {
    throw new YahooLiveDraftError(
      "Yahoo live draft sync is not currently available.",
      503,
      "yahoo_live_draft_disabled",
    );
  }
  if (
    environment.YAHOO_LIVE_DRAFT_ROLLOUT_STAGE?.trim().toLowerCase() ===
      "authenticated" &&
    !isYahooLiveDraftProviderReady(environment)
  ) {
    throw new YahooLiveDraftError(
      "Yahoo live draft sync is awaiting provider validation.",
      503,
      "yahoo_provider_not_ready",
    );
  }
  // Staff/allowlist is the controlled rehearsal exception while validation is pending.
  if (!isYahooLiveDraftUserEntitled(args.userId, environment)) {
    throw new YahooLiveDraftError(
      "Yahoo live draft sync is not available for this account yet.",
      403,
      "yahoo_live_draft_forbidden",
    );
  }
  if (!args.access.eligible) {
    const unavailable = args.access.reason === "verification_unavailable";
    throw new YahooLiveDraftError(
      unavailable
        ? "Draft Pro access could not be verified. Yahoo updates will retry."
        : "Draft Pro access is required for Yahoo live draft sync.",
      unavailable ? 503 : 403,
      unavailable
        ? "yahoo_draft_pro_verification_unavailable"
        : args.access.reason === "expired"
          ? "yahoo_draft_pro_expired"
          : "yahoo_draft_pro_access_required",
    );
  }
  return args.access;
}

export async function requireYahooLiveDraftServerAccess(userId: string) {
  const providerReady = isYahooLiveDraftProviderReady();
  const access = await loadDraftProAccess(userId, {
    now: new Date(),
    flags: getDraftProFeatureFlags(),
    patreonVerificationAvailable: true,
    providerReadiness: { yahoo: providerReady },
  });
  return assertYahooLiveDraftServerAccess({ access, userId });
}
