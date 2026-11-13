import { ProviderSyncAccessError, requireProviderSyncAccess } from "lib/integrations/providerSyncAccessServer";
import type { NextApiRequest, NextApiResponse } from "next";
import { requireApiUser } from "lib/api/requireApiUser";
import { consumeRecommendationRequest } from "lib/draft-pro/recommendationsRateLimit";
import { YahooLiveDraftError } from "lib/integrations/yahoo/liveDraft";
import { loadYahooPickupContext } from "lib/integrations/yahoo/pickupServer";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  res.setHeader("Cache-Control", "private, no-store");
  res.setHeader("Vary", "Authorization");
  if (req.method !== "GET") { res.setHeader("Allow", "GET"); return res.status(405).end(); }
  const user = await requireApiUser(req, res);
  if (!user) return;
  if (!consumeRecommendationRequest(user.id)) return res.status(429).json({ error: "Too many requests. Try again shortly." });
  try {
    await requireProviderSyncAccess(user.id);
    return res.status(200).json({ data: await loadYahooPickupContext(user.id) });
  } catch (error) {
    if (error instanceof ProviderSyncAccessError) return res.status(error.statusCode).json({ error: error.message, code: error.code });
    const failure = pickupFailure(error);
    // Strictly allowlisted constants only: no error object/message, account ids,
    // request headers, provider payloads, tokens or transport metadata.
    console.warn("[yahoo-pickup]", { code: failure.code, status: failure.status });
    return res.status(failure.status).json({ error: failure.message, code: failure.code });
  }
}


const RETRY_MESSAGE = "Yahoo rosters could not be synced. Please try again.";
const PICKUP_FAILURES: Record<string, { status: number; message: string }> = {
  yahoo_reauth_required: { status: 409, message: "Reconnect Yahoo in account settings to sync your league." },
  yahoo_team_required: { status: 409, message: "Select your current-season Yahoo team in account settings." },
  yahoo_game_mismatch: { status: 409, message: "Select a current-season Yahoo team in account settings." },
  yahoo_league_unavailable: { status: 409, message: "Select a current-season Yahoo team in account settings, or reconnect Yahoo." },
  yahoo_token_refresh_in_progress: { status: 409, message: "Yahoo authorization is already being refreshed. Try again shortly." },
  yahoo_rate_limited: { status: 429, message: "Yahoo asked us to slow down. Please wait before retrying." },
  yahoo_access_denied: { status: 403, message: "Yahoo denied access to this league. Verify your league access in account settings." },
  ...Object.fromEntries([
    "yahoo_pickup_settings_unavailable", "yahoo_pickup_team_unavailable", "yahoo_pickup_league_unavailable", "yahoo_pickup_roster_invalid",
    "yahoo_game_context_unavailable", "yahoo_game_context_mismatch", "yahoo_oauth_unavailable",
    "yahoo_oauth_invalid_response", "yahoo_token_store_failed", "yahoo_token_refresh_coordination_failed",
    "yahoo_provider_outage", "yahoo_api_error", "yahoo_api_timeout", "yahoo_api_unavailable",
    "yahoo_draft_response_invalid",
  ].map((code) => [code, { status: 503, message: RETRY_MESSAGE }])),
};

function pickupFailure(error: unknown) {
  const code = error instanceof YahooLiveDraftError && Object.prototype.hasOwnProperty.call(PICKUP_FAILURES, error.code)
    ? error.code : "yahoo_pickup_unavailable";
  return { code, ...(PICKUP_FAILURES[code] ?? { status: 503, message: RETRY_MESSAGE }) };
}
