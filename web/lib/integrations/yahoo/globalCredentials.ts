import type { SupabaseClient } from "@supabase/supabase-js";

export type YahooGlobalCredentials = {
  id: number;
  consumer_key: string;
  consumer_secret: string;
  access_token: string;
  refresh_token: string;
};

export type YahooGlobalTokens = Pick<
  YahooGlobalCredentials,
  "access_token" | "refresh_token"
>;

export class YahooGlobalCredentialError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "YahooGlobalCredentialError";
  }
}

const CREDENTIAL_COLUMNS =
  "id, consumer_key, consumer_secret, access_token, refresh_token";

function isNonBlankString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function isYahooGlobalCredentials(
  value: unknown,
): value is YahooGlobalCredentials {
  if (!value || typeof value !== "object") return false;

  const row = value as Record<string, unknown>;
  return (
    Number.isSafeInteger(row.id) &&
    Number(row.id) > 0 &&
    isNonBlankString(row.consumer_key) &&
    isNonBlankString(row.consumer_secret) &&
    isNonBlankString(row.access_token) &&
    isNonBlankString(row.refresh_token)
  );
}

export async function loadYahooGlobalCredentials(
  supabase: SupabaseClient,
): Promise<YahooGlobalCredentials> {
  const { data, error } = await supabase
    .from("yahoo_api_credentials")
    .select(CREDENTIAL_COLUMNS)
    .single();

  if (error || !isYahooGlobalCredentials(data)) {
    throw new YahooGlobalCredentialError(
      "Yahoo global credentials are unavailable.",
    );
  }

  return data;
}

export async function persistYahooGlobalTokens(
  supabase: SupabaseClient,
  credentialId: number,
  tokens: YahooGlobalTokens,
): Promise<void> {
  if (
    !Number.isSafeInteger(credentialId) ||
    credentialId <= 0 ||
    !isNonBlankString(tokens.access_token) ||
    !isNonBlankString(tokens.refresh_token)
  ) {
    throw new YahooGlobalCredentialError(
      "Yahoo refreshed credentials are invalid.",
    );
  }

  const { error } = await supabase
    .from("yahoo_api_credentials")
    .update({
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token,
      updated_at: new Date().toISOString(),
    })
    .eq("id", credentialId);

  if (error) {
    throw new YahooGlobalCredentialError(
      "Yahoo refreshed credentials could not be stored.",
    );
  }
}
