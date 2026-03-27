export const YAHOO_PROVIDER = "yahoo";
export const YAHOO_GAME_CODE = "nhl";
export const YAHOO_CONNECT_DEFAULT_NEXT = "/account?section=connected-accounts";
export const YAHOO_CALLBACK_PATH = "/api/v1/account/yahoo/callback";

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
