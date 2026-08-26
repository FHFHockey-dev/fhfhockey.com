import crypto from "crypto";
import type { NextApiRequest } from "next";

import serviceRoleClient from "lib/supabase/server";

import {
  getYahooClientCredentials,
  getYahooRedirectUri,
  YAHOO_CALLBACK_PATH,
  YAHOO_CONNECT_DEFAULT_NEXT,
  YAHOO_OAUTH_BROWSER_COOKIE,
} from "./config";
import type { YahooLiveDraftClient } from "./liveDraftDatabase";

const OAUTH_TRANSACTION_TTL_SECONDS = 15 * 60;

export type YahooTokenResponse = {
  access_token: string;
  expires_in?: number;
  refresh_token: string;
  token_type?: string;
  xoauth_yahoo_guid?: string | null;
};

export type YahooOAuthTransaction = {
  pkceCodeVerifier: string;
  redirectUri: string;
  safeNextPath: string;
  userId: string;
};

function oauthClient(client?: YahooLiveDraftClient) {
  return client ?? (serviceRoleClient as unknown as YahooLiveDraftClient);
}

function sha256(value: string) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

function pkceChallenge(verifier: string) {
  return crypto.createHash("sha256").update(verifier).digest("base64url");
}

function firstRecord(value: unknown) {
  const candidate = Array.isArray(value) ? value[0] : value;
  return candidate && typeof candidate === "object"
    ? (candidate as Record<string, unknown>)
    : {};
}

export function sanitizeYahooNextPath(next: string | string[] | undefined) {
  const candidate = Array.isArray(next) ? next[0] : next;
  if (!candidate || !candidate.startsWith("/") || candidate.startsWith("//")) {
    return YAHOO_CONNECT_DEFAULT_NEXT;
  }
  return candidate.slice(0, 1024);
}

export function buildYahooCallbackUrl(_req?: NextApiRequest) {
  return getYahooRedirectUri();
}

function browserCookie(value: string, maxAgeSeconds: number) {
  const secure = buildYahooCallbackUrl().startsWith("https://") ? "; Secure" : "";
  return `${YAHOO_OAUTH_BROWSER_COOKIE}=${encodeURIComponent(value)}; HttpOnly; SameSite=Lax; Path=${YAHOO_CALLBACK_PATH}; Max-Age=${maxAgeSeconds}${secure}`;
}

export function clearYahooOAuthBrowserCookie() {
  return browserCookie("", 0);
}

export function readYahooOAuthBrowserBinding(req: NextApiRequest) {
  return req.cookies[YAHOO_OAUTH_BROWSER_COOKIE] || null;
}

export async function createYahooAuthorizationRequest(args: {
  client?: YahooLiveDraftClient;
  next: string;
  now?: Date;
  userId: string;
}) {
  const client = oauthClient(args.client);
  const now = args.now ?? new Date();
  const state = crypto.randomBytes(32).toString("base64url");
  const browserBinding = crypto.randomBytes(32).toString("base64url");
  const codeVerifier = crypto.randomBytes(64).toString("base64url");
  const redirectUri = buildYahooCallbackUrl();
  const safeNextPath = sanitizeYahooNextPath(args.next);
  const expiresAt = new Date(
    now.getTime() + OAUTH_TRANSACTION_TTL_SECONDS * 1000,
  ).toISOString();
  const { error } = await client.rpc("create_yahoo_oauth_transaction", {
    p_browser_binding_hash: sha256(browserBinding),
    p_expires_at: expiresAt,
    p_pkce_code_verifier: codeVerifier,
    p_redirect_uri: redirectUri,
    p_safe_next_path: safeNextPath,
    p_state_hash: sha256(state),
    p_user_id: args.userId,
  });
  if (error) throw new Error("Yahoo authorization could not be started.");

  const { clientId } = getYahooClientCredentials();
  const params = new URLSearchParams({
    client_id: clientId,
    code_challenge: pkceChallenge(codeVerifier),
    code_challenge_method: "S256",
    redirect_uri: redirectUri,
    response_type: "code",
    state,
  });
  return {
    authorizationUrl: `https://api.login.yahoo.com/oauth2/request_auth?${params.toString()}`,
    browserCookie: browserCookie(browserBinding, OAUTH_TRANSACTION_TTL_SECONDS),
  };
}

export async function consumeYahooOAuthTransaction(args: {
  browserBinding: string | null;
  client?: YahooLiveDraftClient;
  state: string | string[] | undefined;
}): Promise<YahooOAuthTransaction> {
  const state = Array.isArray(args.state) ? args.state[0] : args.state;
  if (!state || !args.browserBinding) {
    throw new Error("Yahoo authorization state is missing or expired.");
  }
  const { data, error } = await oauthClient(args.client).rpc(
    "consume_yahoo_oauth_transaction",
    {
      p_browser_binding_hash: sha256(args.browserBinding),
      p_state_hash: sha256(state),
    },
  );
  if (error) {
    throw new Error("Yahoo authorization state is missing, expired, or already used.");
  }
  const transaction = firstRecord(data);
  const userId = String(transaction.userId ?? "");
  const redirectUri = String(transaction.redirectUri ?? "");
  const pkceCodeVerifier = String(transaction.pkceCodeVerifier ?? "");
  if (
    !userId ||
    redirectUri !== buildYahooCallbackUrl() ||
    pkceCodeVerifier.length < 43
  ) {
    throw new Error("Yahoo authorization state is invalid.");
  }
  return {
    pkceCodeVerifier,
    redirectUri,
    safeNextPath: sanitizeYahooNextPath(String(transaction.safeNextPath ?? "")),
    userId,
  };
}

export async function exchangeYahooAuthorizationCode(args: {
  code: string;
  codeVerifier: string;
  fetchImpl?: typeof fetch;
  redirectUri: string;
}): Promise<YahooTokenResponse> {
  const { clientId, clientSecret } = getYahooClientCredentials();
  const response = await (args.fetchImpl ?? fetch)(
    "https://api.login.yahoo.com/oauth2/get_token",
    {
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        code: args.code,
        code_verifier: args.codeVerifier,
        grant_type: "authorization_code",
        redirect_uri: args.redirectUri,
      }),
      cache: "no-store",
      headers: {
        Accept: "application/json",
        Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString("base64")}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      method: "POST",
    },
  );
  if (!response.ok) {
    throw new Error(`Yahoo token exchange failed (HTTP ${response.status}).`);
  }
  const payload = (await response.json()) as Partial<YahooTokenResponse>;
  if (!payload.access_token || !payload.refresh_token) {
    throw new Error("Yahoo returned an invalid token response.");
  }
  return payload as YahooTokenResponse;
}

export function buildYahooAccountRedirect(
  next: string,
  status: "connected" | "disconnected" | "error",
  message?: string,
) {
  const params = new URLSearchParams();
  params.set("yahoo_status", status);
  if (message) params.set("yahoo_message", message);
  const safeNext = sanitizeYahooNextPath(next);
  const separator = safeNext.includes("?") ? "&" : "?";
  return `${safeNext}${separator}${params.toString()}`;
}
