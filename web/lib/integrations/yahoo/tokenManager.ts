import serviceRoleClient from "lib/supabase/server";
import type { Json } from "lib/supabase/database-generated.types";

import { getYahooClientCredentials, getYahooRedirectUri, YAHOO_PROVIDER } from "./config";
import { YahooLiveDraftError, parseRetryAfterSeconds } from "./liveDraft";
import type { YahooLiveDraftClient } from "./liveDraftDatabase";

export type YahooTokenRow = {
  access_token: string | null;
  expires_at: string | null;
  last_refreshed_at: string | null;
  provider_user_id: string | null;
  refresh_expires_at: string | null;
  refresh_token: string | null;
  scopes: Json;
  secret_metadata: Json;
  token_type: string | null;
};

export type YahooAccessToken = {
  accessToken: string;
  refreshAttempted: boolean;
  refreshOutcome: "not_needed" | "refreshed" | "in_progress";
};

export type YahooTokenManagerOptions = {
  client?: YahooLiveDraftClient;
  fetchImpl?: typeof fetch;
  forceRefresh?: boolean;
  now?: Date;
};

const REFRESH_SKEW_MS = 5 * 60 * 1000;

function clientOrDefault(client?: YahooLiveDraftClient) {
  return (
    client ??
    (serviceRoleClient as unknown as YahooLiveDraftClient)
  );
}

function firstRecord(value: unknown) {
  const candidate = Array.isArray(value) ? value[0] : value;
  return candidate && typeof candidate === "object"
    ? (candidate as Record<string, unknown>)
    : {};
}

function requestSignal() {
  const timeout = (globalThis.AbortSignal as typeof AbortSignal & {
    timeout?: (milliseconds: number) => AbortSignal;
  }).timeout;
  return typeof timeout === "function" ? timeout(10_000) : undefined;
}

function retrySeconds(value: unknown, now: Date) {
  const retryAt = Date.parse(String(value ?? ""));
  return Number.isFinite(retryAt)
    ? Math.max(1, Math.ceil((retryAt - now.getTime()) / 1000))
    : 2;
}

function tokenNeedsRefresh(token: YahooTokenRow, now: Date) {
  if (!token.expires_at) return false;
  const expiresAt = Date.parse(token.expires_at);
  return Number.isFinite(expiresAt) && expiresAt <= now.getTime() + REFRESH_SKEW_MS;
}

async function loadYahooTokens(
  client: YahooLiveDraftClient,
  connectedAccountId: string,
  userId: string,
) {
  const { data, error } = await client.rpc("get_connected_account_tokens_secure", {
    p_connected_account_id: connectedAccountId,
    p_user_id: userId,
  });
  if (error) {
    throw new YahooLiveDraftError(
      "Yahoo authorization could not be loaded.",
      503,
      "yahoo_oauth_unavailable",
    );
  }
  const token = (Array.isArray(data) ? data[0] : data) as YahooTokenRow | null;
  if (!token?.access_token || !token.refresh_token) {
    throw new YahooLiveDraftError(
      "Yahoo authorization is unavailable. Reconnect Yahoo and try again.",
      409,
      "yahoo_reauth_required",
    );
  }
  return token as YahooTokenRow & { access_token: string; refresh_token: string };
}

export async function markYahooReauthenticationRequired(args: {
  client: YahooLiveDraftClient;
  connectedAccountId: string;
  userId: string;
}) {
  await Promise.all([
    args.client
      .from("connected_accounts")
      .update({ status: "reauth_required" })
      .eq("id", args.connectedAccountId)
      .eq("user_id", args.userId)
      .eq("provider", YAHOO_PROVIDER),
    args.client
      .from("yahoo_draft_sessions")
      .update({
        completed_at: null,
        last_error_code: "yahoo_reauth_required",
        last_error_message:
          "Yahoo authorization has expired. Reconnect Yahoo and try again.",
        status: "reauth_required",
      })
      .eq("connected_account_id", args.connectedAccountId)
      .eq("user_id", args.userId)
      .in("status", ["predraft", "active"]),
  ]);
}

async function refreshYahooAccessToken(args: {
  client: YahooLiveDraftClient;
  connectedAccountId: string;
  fetchImpl: typeof fetch;
  now: Date;
  token: YahooTokenRow & { access_token: string; refresh_token: string };
  userId: string;
}) {
  const { clientId, clientSecret } = getYahooClientCredentials();
  let response: Response;
  try {
    response = await args.fetchImpl("https://api.login.yahoo.com/oauth2/get_token", {
      body: new URLSearchParams({
        grant_type: "refresh_token",
        redirect_uri: getYahooRedirectUri(),
        refresh_token: args.token.refresh_token,
      }),
      cache: "no-store",
      headers: {
        Accept: "application/json",
        Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString("base64")}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      method: "POST",
      signal: requestSignal(),
    });
  } catch {
    throw new YahooLiveDraftError(
      "Yahoo authorization could not be refreshed.",
      502,
      "yahoo_oauth_unavailable",
    );
  }

  if (!response.ok) {
    if (response.status === 429 || response.status >= 500) {
      throw new YahooLiveDraftError(
        response.status === 429
          ? "Yahoo asked the live draft companion to slow down."
          : "Yahoo authorization could not be refreshed.",
        response.status === 429 ? 429 : 502,
        response.status === 429 ? "yahoo_rate_limited" : "yahoo_oauth_unavailable",
        parseRetryAfterSeconds(response.headers.get("retry-after"), args.now),
      );
    }
    await markYahooReauthenticationRequired(args);
    throw new YahooLiveDraftError(
      "Yahoo authorization has expired. Reconnect Yahoo and try again.",
      409,
      "yahoo_reauth_required",
    );
  }

  let refreshed: Record<string, unknown>;
  try {
    refreshed = firstRecord(await response.json());
  } catch {
    throw new YahooLiveDraftError(
      "Yahoo returned an invalid authorization response.",
      502,
      "yahoo_oauth_invalid_response",
    );
  }
  const accessToken = String(refreshed.access_token ?? "");
  if (!accessToken) {
    throw new YahooLiveDraftError(
      "Yahoo returned an invalid authorization response.",
      502,
      "yahoo_oauth_invalid_response",
    );
  }
  const refreshToken = String(
    refreshed.refresh_token ?? args.token.refresh_token,
  );
  const expiresIn = Number(refreshed.expires_in);
  const expiresAt = Number.isFinite(expiresIn)
    ? new Date(args.now.getTime() + Math.max(0, expiresIn) * 1000).toISOString()
    : undefined;
  const { error } = await args.client.rpc(
    "upsert_connected_account_tokens_secure",
    {
      p_access_token: accessToken,
      p_connected_account_id: args.connectedAccountId,
      ...(expiresAt ? { p_expires_at: expiresAt } : {}),
      p_last_refreshed_at: args.now.toISOString(),
      p_provider: YAHOO_PROVIDER,
      p_provider_user_id: args.token.provider_user_id ?? undefined,
      p_refresh_expires_at: args.token.refresh_expires_at ?? undefined,
      p_refresh_token: refreshToken,
      p_scopes: args.token.scopes,
      p_secret_metadata: args.token.secret_metadata,
      p_token_type: String(
        refreshed.token_type ?? args.token.token_type ?? "bearer",
      ),
      p_user_id: args.userId,
    },
  );
  if (error) {
    throw new YahooLiveDraftError(
      "Refreshed Yahoo authorization could not be stored.",
      503,
      "yahoo_token_store_failed",
    );
  }
  return accessToken;
}

export async function getYahooAccessToken(
  connectedAccountId: string,
  userId: string,
  options: YahooTokenManagerOptions = {},
): Promise<YahooAccessToken> {
  const client = clientOrDefault(options.client);
  const fetchImpl = options.fetchImpl ?? fetch;
  const now = options.now ?? new Date();
  let token = await loadYahooTokens(client, connectedAccountId, userId);
  const refreshExpiresAt = Date.parse(token.refresh_expires_at ?? "");
  if (
    Number.isFinite(refreshExpiresAt) &&
    refreshExpiresAt <= now.getTime()
  ) {
    await markYahooReauthenticationRequired({
      client,
      connectedAccountId,
      userId,
    });
    throw new YahooLiveDraftError(
      "Yahoo authorization has expired. Reconnect Yahoo and try again.",
      409,
      "yahoo_reauth_required",
    );
  }
  if (!options.forceRefresh && !tokenNeedsRefresh(token, now)) {
    return {
      accessToken: token.access_token,
      refreshAttempted: false,
      refreshOutcome: "not_needed",
    };
  }

  const { data: claimData, error: claimError } = await client.rpc(
    "claim_yahoo_token_refresh_lease",
    {
      p_connected_account_id: connectedAccountId,
      p_lease_seconds: 20,
      p_user_id: userId,
    },
  );
  if (claimError) {
    throw new YahooLiveDraftError(
      "Yahoo authorization refresh could not be coordinated.",
      503,
      "yahoo_token_refresh_coordination_failed",
    );
  }
  const claim = firstRecord(claimData);
  if (claim.claimed !== true) {
    const tokenBeforeReload = token;
    token = await loadYahooTokens(client, connectedAccountId, userId);
    const refreshedAt = Date.parse(token.last_refreshed_at ?? "");
    const previousRefreshedAt = Date.parse(
      tokenBeforeReload.last_refreshed_at ?? "",
    );
    const refreshedByLeaseOwner =
      token.access_token !== tokenBeforeReload.access_token ||
      (Number.isFinite(refreshedAt) &&
        (!Number.isFinite(previousRefreshedAt) ||
          refreshedAt > previousRefreshedAt));
    if (
      !tokenNeedsRefresh(token, now) &&
      (!options.forceRefresh || refreshedByLeaseOwner)
    ) {
      return {
        accessToken: token.access_token,
        refreshAttempted: false,
        refreshOutcome: "in_progress",
      };
    }
    throw new YahooLiveDraftError(
      "Yahoo authorization is already being refreshed.",
      409,
      "yahoo_token_refresh_in_progress",
      retrySeconds(claim.retryAt, now),
    );
  }

  const leaseToken = String(claim.leaseToken ?? "");
  if (!leaseToken) {
    throw new YahooLiveDraftError(
      "Yahoo authorization refresh could not be coordinated.",
      503,
      "yahoo_token_refresh_coordination_failed",
    );
  }

  try {
    // Reload after claiming so a completed rotation from another instance is not
    // overwritten with a stale refresh token.
    token = await loadYahooTokens(client, connectedAccountId, userId);
    if (!options.forceRefresh && !tokenNeedsRefresh(token, now)) {
      return {
        accessToken: token.access_token,
        refreshAttempted: false,
        refreshOutcome: "not_needed",
      };
    }
    const accessToken = await refreshYahooAccessToken({
      client,
      connectedAccountId,
      fetchImpl,
      now,
      token,
      userId,
    });
    return {
      accessToken,
      refreshAttempted: true,
      refreshOutcome: "refreshed",
    };
  } finally {
    await client.rpc("release_yahoo_token_refresh_lease", {
      p_connected_account_id: connectedAccountId,
      p_lease_token: leaseToken,
      p_user_id: userId,
    });
  }
}
