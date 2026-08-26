export const YAHOO_PROVIDER = "yahoo";
export const YAHOO_GAME_CODE = "nhl";
export const YAHOO_CONNECT_DEFAULT_NEXT = "/account?section=connected-accounts";
export const YAHOO_CALLBACK_PATH = "/api/v1/account/yahoo/callback";
export const YAHOO_OAUTH_BROWSER_COOKIE = "fhfh_yahoo_oauth";

export type YahooLiveDraftSeasonConfig = {
  season: string;
  targetSeasonId: number;
};

export type YahooLiveDraftResponseFormat = "standard_json" | "json_f";

export type YahooClientCredentials = {
  clientId: string;
  clientSecret: string;
};

export function getYahooClientCredentials(): YahooClientCredentials {
  const clientId =
    process.env.YAHOO_CONSUMER_KEY || process.env.YFPY_CONSUMER_KEY || "";
  const clientSecret =
    process.env.YAHOO_CONSUMER_SECRET || process.env.YFPY_CONSUMER_SECRET || "";

  if (!clientId || !clientSecret) {
    throw new Error("Yahoo client credentials are not configured.");
  }

  return {
    clientId,
    clientSecret,
  };
}

export function getYahooRedirectUri(
  environment: NodeJS.ProcessEnv = process.env,
  nodeEnvironment = process.env.NODE_ENV,
) {
  const value = environment.YAHOO_REDIRECT_URI?.trim();
  if (!value) {
    throw new Error("YAHOO_REDIRECT_URI is not configured.");
  }

  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error("YAHOO_REDIRECT_URI must be an absolute URL.");
  }

  const localDevelopment =
    nodeEnvironment === "development" &&
    url.protocol === "http:" &&
    ["localhost", "127.0.0.1"].includes(url.hostname);
  if (url.protocol !== "https:" && !localDevelopment) {
    throw new Error("YAHOO_REDIRECT_URI must use HTTPS outside local development.");
  }
  if (url.username || url.password || url.hash || url.search) {
    throw new Error(
      "YAHOO_REDIRECT_URI must not contain credentials, a query, or a fragment.",
    );
  }
  if (url.pathname !== YAHOO_CALLBACK_PATH) {
    throw new Error(
      `YAHOO_REDIRECT_URI must end with ${YAHOO_CALLBACK_PATH}.`,
    );
  }
  return url.toString();
}

export function getYahooLiveDraftSeasonConfig(
  environment: NodeJS.ProcessEnv = process.env,
): YahooLiveDraftSeasonConfig {
  const season = environment.YAHOO_LIVE_DRAFT_SEASON?.trim() || "";
  const targetSeasonId = Number(
    environment.YAHOO_LIVE_DRAFT_TARGET_SEASON_ID,
  );
  if (!/^\d{4}$/u.test(season) || !Number.isInteger(targetSeasonId)) {
    throw new Error(
      "YAHOO_LIVE_DRAFT_SEASON and YAHOO_LIVE_DRAFT_TARGET_SEASON_ID are required.",
    );
  }
  const expectedTargetSeasonId = Number(`${season}${Number(season) + 1}`);
  if (targetSeasonId !== expectedTargetSeasonId) {
    throw new Error(
      "Yahoo and FHFH live-draft season configuration does not agree.",
    );
  }
  return { season, targetSeasonId };
}

export function getYahooLiveDraftResponseFormat(
  value = process.env.YAHOO_LIVE_DRAFT_RESPONSE_FORMAT,
): YahooLiveDraftResponseFormat {
  return String(value ?? "standard_json").trim().toLowerCase() === "json_f"
    ? "json_f"
    : "standard_json";
}

export function yahooLiveDraftComparisonEnabled(
  value = process.env.YAHOO_LIVE_DRAFT_COMPARE_FORMATS,
) {
  return ["1", "true", "yes", "on"].includes(
    String(value ?? "").trim().toLowerCase(),
  );
}
