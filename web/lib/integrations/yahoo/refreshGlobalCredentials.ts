import type { SupabaseClient } from "@supabase/supabase-js";

import {
  persistYahooGlobalTokens,
  type YahooGlobalCredentials,
} from "./globalCredentials";

type RefreshFailureCode =
  | "yahoo_reauth_required"
  | "yahoo_refresh_rejected"
  | "yahoo_refresh_rate_limited"
  | "yahoo_refresh_invalid_response"
  | "yahoo_refresh_transport_failed"
  | "yahoo_refresh_timeout"
  | "yahoo_refresh_store_failed";

export class YahooGlobalRefreshError extends Error {
  constructor(
    readonly code: RefreshFailureCode,
    readonly statusCode: number,
    readonly refreshOutcome: "not_refreshed" | "unknown",
  ) {
    // Never retain provider bodies, request headers, tokens, or database errors.
    super("Yahoo token refresh failed");
    this.name = "YahooGlobalRefreshError";
  }
}

function nonBlankString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

/** A refresh can rotate credentials, so neither transport nor storage is retried. */
export async function refreshYahooGlobalCredentials(
  supabase: SupabaseClient,
  credentials: YahooGlobalCredentials,
  fetchImpl: typeof fetch = fetch,
): Promise<void> {
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeoutError = new YahooGlobalRefreshError(
    "yahoo_refresh_timeout", 504, "unknown",
  );
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      reject(timeoutError);
      controller.abort();
    }, 10_000);
  });

  const refresh = async () => {
    let response: Response;
    try {
      response = await fetchImpl("https://api.login.yahoo.com/oauth2/get_token", {
        method: "POST",
        cache: "no-store",
        redirect: "error",
        signal: controller.signal,
        headers: {
          Accept: "application/json",
          Authorization: `Basic ${Buffer.from(
            `${credentials.consumer_key}:${credentials.consumer_secret}`,
          ).toString("base64")}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({
          grant_type: "refresh_token",
          refresh_token: credentials.refresh_token,
        }),
      });
    } catch {
      throw new YahooGlobalRefreshError(
        "yahoo_refresh_transport_failed", 502, "unknown",
      );
    }

    let payload: unknown;
    try {
      payload = await response.json();
    } catch {
      // An unreadable success may already have rotated the provider's tokens.
      payload = null;
    }
    const token = payload && typeof payload === "object" && !Array.isArray(payload)
      ? payload as Record<string, unknown>
      : null;
    if (!response.ok || token?.error !== undefined) {
      const reauthRequired = [400, 401].includes(response.status)
        && token?.error === "invalid_grant";
      throw new YahooGlobalRefreshError(
        reauthRequired ? "yahoo_reauth_required"
          : response.status === 429 ? "yahoo_refresh_rate_limited"
            : "yahoo_refresh_rejected",
        reauthRequired ? 409 : response.status === 429 ? 429 : 502,
        response.status >= 400 && response.status < 500 ? "not_refreshed" : "unknown",
      );
    }
    if (
      !token || !nonBlankString(token.access_token)
      || (token.refresh_token !== undefined && !nonBlankString(token.refresh_token))
    ) {
      throw new YahooGlobalRefreshError(
        "yahoo_refresh_invalid_response", 502, "unknown",
      );
    }

    // OAuth refresh responses may omit a new refresh token. Never substitute for
    // a malformed supplied token, and never write after the deadline has elapsed.
    if (controller.signal.aborted) throw timeoutError;
    try {
      await persistYahooGlobalTokens(supabase, credentials.id, {
        access_token: token.access_token,
        refresh_token: token.refresh_token === undefined
          ? credentials.refresh_token : token.refresh_token as string,
      });
    } catch {
      // Yahoo may have rotated tokens even if the local write failed or timed out.
      throw new YahooGlobalRefreshError(
        "yahoo_refresh_store_failed", 503, "unknown",
      );
    }
  };

  try {
    // Bound body parsing and storage as well as connection setup. A storage
    // timeout is uncertain: the database may complete the already-started write.
    await Promise.race([refresh(), timeout]);
  } finally {
    clearTimeout(timer);
  }
}
