import crypto from "crypto";
import type { NextApiRequest } from "next";

import {
  YAHOO_CALLBACK_PATH,
  YAHOO_CONNECT_DEFAULT_NEXT,
  getYahooClientCredentials,
} from "./config";

type YahooOAuthStatePayload = {
  userId: string;
  next: string;
  issuedAt: number;
  nonce: string;
};

export type YahooTokenResponse = {
  access_token: string;
  refresh_token: string;
  token_type?: string;
  expires_in?: number;
  xoauth_yahoo_guid?: string | null;
};

function getStateSigningSecret() {
  const secret =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.NEXT_SUPABASE_SERVICE_ROLE_KEY ||
    process.env.YAHOO_CONSUMER_SECRET ||
    "";

  if (!secret) {
    throw new Error("Unable to sign Yahoo OAuth state.");
  }

  return secret;
}

export function getRequestOrigin(req: NextApiRequest) {
  const forwardedProto = req.headers["x-forwarded-proto"];
  const proto = Array.isArray(forwardedProto)
    ? forwardedProto[0]
    : forwardedProto || "http";
  const host = req.headers["x-forwarded-host"] || req.headers.host || "localhost:3000";
  const normalizedHost = Array.isArray(host) ? host[0] : host;

  return `${proto}://${normalizedHost}`;
}

export function sanitizeYahooNextPath(next: string | string[] | undefined) {
  const candidate = Array.isArray(next) ? next[0] : next;
  if (!candidate || !candidate.startsWith("/") || candidate.startsWith("//")) {
    return YAHOO_CONNECT_DEFAULT_NEXT;
  }

  return candidate;
}

function base64UrlEncode(value: string) {
  return Buffer.from(value, "utf8").toString("base64url");
}

function base64UrlDecode(value: string) {
  return Buffer.from(value, "base64url").toString("utf8");
}

function signStateValue(encodedPayload: string) {
  return crypto
    .createHmac("sha256", getStateSigningSecret())
    .update(encodedPayload)
    .digest("base64url");
}

export function createYahooOAuthState(userId: string, next: string) {
  const payload: YahooOAuthStatePayload = {
    userId,
    next: sanitizeYahooNextPath(next),
    issuedAt: Date.now(),
    nonce: crypto.randomBytes(12).toString("base64url"),
  };
  const encodedPayload = base64UrlEncode(JSON.stringify(payload));
  const signature = signStateValue(encodedPayload);

  return `${encodedPayload}.${signature}`;
}

export function verifyYahooOAuthState(state: string | string[] | undefined) {
  const rawState = Array.isArray(state) ? state[0] : state;
  if (!rawState) {
    throw new Error("Missing Yahoo OAuth state.");
  }

  const [encodedPayload, signature] = rawState.split(".");
  if (!encodedPayload || !signature) {
    throw new Error("Yahoo OAuth state is malformed.");
  }

  const expectedSignature = signStateValue(encodedPayload);
  const signatureBuffer = Uint8Array.from(Buffer.from(signature, "utf8"));
  const expectedBuffer = Uint8Array.from(Buffer.from(expectedSignature, "utf8"));

  if (
    signatureBuffer.length !== expectedBuffer.length ||
    !crypto.timingSafeEqual(signatureBuffer, expectedBuffer)
  ) {
    throw new Error("Yahoo OAuth state signature is invalid.");
  }

  const payload = JSON.parse(base64UrlDecode(encodedPayload)) as YahooOAuthStatePayload;
  if (!payload.userId || !payload.next) {
    throw new Error("Yahoo OAuth state payload is incomplete.");
  }

  const maxAgeMs = 15 * 60 * 1000;
  if (Date.now() - payload.issuedAt > maxAgeMs) {
    throw new Error("Yahoo OAuth state has expired.");
  }

  return {
    ...payload,
    next: sanitizeYahooNextPath(payload.next),
  };
}

export function buildYahooCallbackUrl(req: NextApiRequest) {
  return `${getRequestOrigin(req)}${YAHOO_CALLBACK_PATH}`;
}

export function buildYahooAuthorizationUrl(req: NextApiRequest, userId: string, next: string) {
  const { clientId } = getYahooClientCredentials();
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: buildYahooCallbackUrl(req),
    response_type: "code",
    state: createYahooOAuthState(userId, next),
  });

  return `https://api.login.yahoo.com/oauth2/request_auth?${params.toString()}`;
}

export async function exchangeYahooAuthorizationCode(
  req: NextApiRequest,
  code: string
): Promise<YahooTokenResponse> {
  const { clientId, clientSecret } = getYahooClientCredentials();
  const body = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    redirect_uri: buildYahooCallbackUrl(req),
    grant_type: "authorization_code",
    code,
  });

  const response = await fetch("https://api.login.yahoo.com/oauth2/get_token", {
    method: "POST",
    headers: {
      Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString("base64")}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body,
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(
      `Yahoo token exchange failed: ${response.status} ${response.statusText} ${errorText}`
    );
  }

  return (await response.json()) as YahooTokenResponse;
}

export function buildYahooAccountRedirect(
  next: string,
  status: "connected" | "disconnected" | "error",
  message?: string
) {
  const params = new URLSearchParams();
  params.set("yahoo_status", status);

  if (message) {
    params.set("yahoo_message", message);
  }

  const separator = next.includes("?") ? "&" : "?";
  return `${sanitizeYahooNextPath(next)}${separator}${params.toString()}`;
}
