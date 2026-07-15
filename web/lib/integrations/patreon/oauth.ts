import crypto from "crypto";
import type { NextApiRequest } from "next";

import type { Json } from "lib/supabase/database-generated.types";

import {
  getPatreonConfiguration,
  PATREON_CALLBACK_PATH,
  PATREON_CONNECT_DEFAULT_NEXT,
} from "./config";

const PATREON_AUTHORIZATION_URL = "https://www.patreon.com/oauth2/authorize";
const PATREON_TOKEN_URL = "https://www.patreon.com/api/oauth2/token";
const PATREON_IDENTITY_URL = "https://www.patreon.com/api/oauth2/v2/identity";

type PatreonOAuthStatePayload = {
  userId: string;
  next: string;
  issuedAt: number;
  nonce: string;
};

type PatreonResource = {
  id: string;
  type: string;
  attributes?: Record<string, unknown>;
  relationships?: Record<
    string,
    {
      data?:
        | { id: string; type: string }
        | Array<{ id: string; type: string }>
        | null;
    }
  >;
};

type PatreonIdentityResponse = {
  data?: PatreonResource;
  included?: PatreonResource[];
  errors?: Array<{ detail?: string; title?: string }>;
};

export type PatreonTokenResponse = {
  access_token: string;
  refresh_token?: string;
  token_type?: string;
  expires_in?: number;
  scope?: string;
};

export type PatreonTierSnapshot = {
  id: string;
  title: string | null;
  amountCents: number | null;
};

export type PatreonIdentitySnapshot = {
  providerUserId: string;
  accountLabel: string;
  imageUrl: string | null;
  campaignId: string;
  memberId: string | null;
  patronStatus: string | null;
  currentlyEntitledAmountCents: number | null;
  lastChargeDate: string | null;
  lastChargeStatus: string | null;
  pledgeRelationshipStart: string | null;
  tiers: PatreonTierSnapshot[];
  isEligibleSupporter: boolean;
  metadata: Json;
};

export class PatreonApiError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number,
    public readonly retryAfterSeconds?: number,
  ) {
    super(message);
    this.name = "PatreonApiError";
  }
}

function getRequestOrigin(req: NextApiRequest) {
  const forwardedProto = req.headers["x-forwarded-proto"];
  const proto = Array.isArray(forwardedProto)
    ? forwardedProto[0]
    : forwardedProto || "http";
  const forwardedHost = req.headers["x-forwarded-host"];
  const host = Array.isArray(forwardedHost)
    ? forwardedHost[0]
    : forwardedHost || req.headers.host || "localhost:3000";
  return `${proto}://${host}`;
}

export function sanitizePatreonNextPath(next: string | string[] | undefined) {
  const candidate = Array.isArray(next) ? next[0] : next;
  if (
    !candidate ||
    !candidate.startsWith("/") ||
    candidate.startsWith("//") ||
    candidate.includes("\\") ||
    /[\r\n]/.test(candidate)
  ) {
    return PATREON_CONNECT_DEFAULT_NEXT;
  }
  return candidate;
}

function stateSigningSecret() {
  const configuration = getPatreonConfiguration();
  return configuration.clientSecret;
}

function signState(encodedPayload: string) {
  return crypto
    .createHmac("sha256", stateSigningSecret())
    .update(encodedPayload)
    .digest("base64url");
}

export function createPatreonOAuthState(userId: string, next: string) {
  const payload: PatreonOAuthStatePayload = {
    userId,
    next: sanitizePatreonNextPath(next),
    issuedAt: Date.now(),
    nonce: crypto.randomBytes(12).toString("base64url"),
  };
  const encodedPayload = Buffer.from(JSON.stringify(payload), "utf8").toString(
    "base64url",
  );
  return `${encodedPayload}.${signState(encodedPayload)}`;
}

export function verifyPatreonOAuthState(state: string | string[] | undefined) {
  const rawState = Array.isArray(state) ? state[0] : state;
  if (!rawState) throw new PatreonApiError("Missing Patreon OAuth state.", 400);

  const [encodedPayload, signature] = rawState.split(".");
  if (!encodedPayload || !signature) {
    throw new PatreonApiError("Patreon OAuth state is malformed.", 400);
  }

  const expected = signState(encodedPayload);
  const signatureBytes = Uint8Array.from(Buffer.from(signature, "utf8"));
  const expectedBytes = Uint8Array.from(Buffer.from(expected, "utf8"));
  if (
    signatureBytes.length !== expectedBytes.length ||
    !crypto.timingSafeEqual(signatureBytes, expectedBytes)
  ) {
    throw new PatreonApiError("Patreon OAuth state signature is invalid.", 400);
  }

  let payload: PatreonOAuthStatePayload;
  try {
    payload = JSON.parse(
      Buffer.from(encodedPayload, "base64url").toString("utf8"),
    ) as PatreonOAuthStatePayload;
  } catch {
    throw new PatreonApiError("Patreon OAuth state payload is invalid.", 400);
  }
  if (!payload.userId || !payload.next || !payload.issuedAt) {
    throw new PatreonApiError(
      "Patreon OAuth state payload is incomplete.",
      400,
    );
  }
  if (Date.now() - payload.issuedAt > 15 * 60 * 1000) {
    throw new PatreonApiError("Patreon OAuth state has expired.", 400);
  }

  return { ...payload, next: sanitizePatreonNextPath(payload.next) };
}

export function buildPatreonCallbackUrl(req: NextApiRequest) {
  return `${getRequestOrigin(req)}${PATREON_CALLBACK_PATH}`;
}

export function buildPatreonAuthorizationUrl(
  req: NextApiRequest,
  userId: string,
  next: string,
) {
  const { clientId } = getPatreonConfiguration();
  const params = new URLSearchParams({
    response_type: "code",
    client_id: clientId,
    redirect_uri: buildPatreonCallbackUrl(req),
    scope: "identity",
    state: createPatreonOAuthState(userId, next),
  });
  return `${PATREON_AUTHORIZATION_URL}?${params.toString()}`;
}

async function parsePatreonResponse<T>(response: Response, action: string) {
  const body = (await response.json().catch(() => null)) as
    | T
    | { errors?: Array<{ detail?: string; title?: string }> }
    | null;
  if (!response.ok) {
    const errorBody = body as {
      errors?: Array<{ detail?: string; title?: string }>;
    } | null;
    const providerMessage =
      errorBody?.errors?.[0]?.detail || errorBody?.errors?.[0]?.title;
    const retryAfter = response.headers.get("retry-after");
    throw new PatreonApiError(
      providerMessage ||
        `Patreon ${action} failed with HTTP ${response.status}.`,
      response.status,
      retryAfter ? Number(retryAfter) || undefined : undefined,
    );
  }
  if (!body) {
    throw new PatreonApiError(
      `Patreon ${action} returned an empty response.`,
      502,
    );
  }
  return body as T;
}

export async function exchangePatreonAuthorizationCode(
  req: NextApiRequest,
  code: string,
  fetchImpl: typeof fetch = fetch,
) {
  const { clientId, clientSecret } = getPatreonConfiguration();
  const response = await fetchImpl(PATREON_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      grant_type: "authorization_code",
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: buildPatreonCallbackUrl(req),
    }),
  });
  return parsePatreonResponse<PatreonTokenResponse>(response, "token exchange");
}

export async function refreshPatreonTokens(
  refreshToken: string,
  fetchImpl: typeof fetch = fetch,
) {
  const { clientId, clientSecret } = getPatreonConfiguration();
  const response = await fetchImpl(PATREON_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: refreshToken,
      client_id: clientId,
      client_secret: clientSecret,
    }),
  });
  return parsePatreonResponse<PatreonTokenResponse>(response, "token refresh");
}

function stringValue(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function numberValue(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function relationshipIds(resource: PatreonResource, name: string) {
  const data = resource.relationships?.[name]?.data;
  if (!data) return [];
  return (Array.isArray(data) ? data : [data]).map((item) => item.id);
}

export function normalizePatreonIdentity(
  response: PatreonIdentityResponse,
  campaignId: string,
): PatreonIdentitySnapshot {
  const user = response.data;
  if (!user?.id || user.type !== "user") {
    throw new PatreonApiError(
      "Patreon identity response did not include a user.",
      502,
    );
  }

  const included = response.included || [];
  const membershipIds = new Set(relationshipIds(user, "memberships"));
  const memberships = included.filter(
    (resource) =>
      resource.type === "member" &&
      (membershipIds.size === 0 || membershipIds.has(resource.id)),
  );
  const membership =
    memberships.find((resource) =>
      relationshipIds(resource, "campaign").includes(campaignId),
    ) || null;

  const tierIds = membership
    ? relationshipIds(membership, "currently_entitled_tiers")
    : [];
  const tiers = tierIds.map((tierId) => {
    const resource = included.find(
      (item) => item.type === "tier" && item.id === tierId,
    );
    return {
      id: tierId,
      title: stringValue(resource?.attributes?.title),
      amountCents: numberValue(resource?.attributes?.amount_cents),
    };
  });
  const patronStatus = stringValue(membership?.attributes?.patron_status);
  const currentlyEntitledAmountCents = numberValue(
    membership?.attributes?.currently_entitled_amount_cents,
  );
  const isEligibleSupporter =
    patronStatus === "active_patron" &&
    ((currentlyEntitledAmountCents ?? 0) > 0 || tiers.length > 0);
  const accountLabel =
    stringValue(user.attributes?.full_name) || "Patreon account";

  return {
    providerUserId: user.id,
    accountLabel,
    imageUrl: stringValue(user.attributes?.image_url),
    campaignId,
    memberId: membership?.id || null,
    patronStatus,
    currentlyEntitledAmountCents,
    lastChargeDate: stringValue(membership?.attributes?.last_charge_date),
    lastChargeStatus: stringValue(membership?.attributes?.last_charge_status),
    pledgeRelationshipStart: stringValue(
      membership?.attributes?.pledge_relationship_start,
    ),
    tiers,
    isEligibleSupporter,
    metadata: {
      api_version: "v2",
      campaign_id: campaignId,
      member_id: membership?.id || null,
      patron_status: patronStatus,
      currently_entitled_amount_cents: currentlyEntitledAmountCents,
      last_charge_date: stringValue(membership?.attributes?.last_charge_date),
      last_charge_status: stringValue(
        membership?.attributes?.last_charge_status,
      ),
      pledge_relationship_start: stringValue(
        membership?.attributes?.pledge_relationship_start,
      ),
      image_url: stringValue(user.attributes?.image_url),
      tiers,
      generic_supporter_eligible: isEligibleSupporter,
      tier_feature_mapping: "not_configured",
    },
  };
}

export async function fetchPatreonIdentity(
  accessToken: string,
  campaignId: string,
  fetchImpl: typeof fetch = fetch,
) {
  const params = new URLSearchParams({
    include: "memberships.campaign,memberships.currently_entitled_tiers",
    "fields[user]": "full_name,image_url",
    "fields[member]":
      "patron_status,currently_entitled_amount_cents,last_charge_date,last_charge_status,pledge_relationship_start",
    "fields[tier]": "title,amount_cents",
  });
  const response = await fetchImpl(`${PATREON_IDENTITY_URL}?${params}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const body = await parsePatreonResponse<PatreonIdentityResponse>(
    response,
    "identity request",
  );
  return normalizePatreonIdentity(body, campaignId);
}

export function buildPatreonAccountRedirect(
  next: string,
  status: "connected" | "disconnected" | "error",
  message?: string,
) {
  const params = new URLSearchParams({ patreon_status: status });
  if (message) params.set("patreon_message", message);
  const separator = next.includes("?") ? "&" : "?";
  return `${sanitizePatreonNextPath(next)}${separator}${params}`;
}
