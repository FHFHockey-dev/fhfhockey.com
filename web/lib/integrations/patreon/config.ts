export const PATREON_PROVIDER = "patreon";
export const PATREON_CALLBACK_PATH = "/api/v1/account/patreon/callback";
export const PATREON_CONNECT_DEFAULT_NEXT = "/account?section=patreon";
// This retained membership row is also the Draft Pro source only when its
// server-written metadata explicitly records paid campaign eligibility.
export const PATREON_ENTITLEMENT_KEY = "patreon_supporter";
export const PATREON_SYNC_COOLDOWN_MS = 60 * 1000;
export const PATREON_SYNC_STALE_MS = 10 * 60 * 1000;

export type PatreonConfiguration = {
  clientId: string;
  clientSecret: string;
  campaignId: string;
};

function readPatreonConfiguration(): PatreonConfiguration {
  return {
    clientId: process.env.PATREON_CLIENT_ID?.trim() || "",
    clientSecret: process.env.PATREON_CLIENT_SECRET?.trim() || "",
    campaignId: process.env.PATREON_CAMPAIGN_ID?.trim() || "",
  };
}

export function isPatreonConfigured() {
  const configuration = readPatreonConfiguration();
  return Boolean(
    configuration.clientId &&
    configuration.clientSecret &&
    configuration.campaignId,
  );
}

export function getPatreonConfiguration() {
  const configuration = readPatreonConfiguration();
  if (!configuration.clientId) {
    throw new Error("PATREON_CLIENT_ID is not configured.");
  }
  if (!configuration.clientSecret) {
    throw new Error("PATREON_CLIENT_SECRET is not configured.");
  }
  if (!configuration.campaignId) {
    throw new Error("PATREON_CAMPAIGN_ID is not configured.");
  }
  return configuration;
}

export function getPatreonWebhookSecret() {
  const secret = process.env.PATREON_WEBHOOK_SECRET?.trim();
  if (!secret) throw new Error("PATREON_WEBHOOK_SECRET is not configured.");
  return secret;
}
