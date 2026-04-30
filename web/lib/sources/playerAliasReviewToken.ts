import crypto from "crypto";

type PlayerAliasReviewTokenPayload = {
  unresolvedId: string;
  exp: number;
};

const DEFAULT_TTL_SECONDS = 7 * 24 * 60 * 60;

function base64UrlEncode(value: string | Buffer): string {
  const buffer = typeof value === "string" ? Buffer.from(value) : value;
  return buffer
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

function base64UrlDecode(value: string): string {
  const padded = `${value}${"=".repeat((4 - (value.length % 4)) % 4)}`;
  return Buffer.from(padded.replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("utf8");
}

function resolveSecret(): string | null {
  return process.env.PLAYER_ALIAS_REVIEW_TOKEN_SECRET ?? process.env.CRON_SECRET ?? null;
}

function sign(payload: string, secret: string): string {
  return base64UrlEncode(crypto.createHmac("sha256", secret).update(payload).digest());
}

export function createPlayerAliasReviewToken(args: {
  unresolvedId: string;
  ttlSeconds?: number;
  nowMs?: number;
}): string | null {
  const secret = resolveSecret();
  if (!secret) return null;

  const payload = base64UrlEncode(
    JSON.stringify({
      unresolvedId: args.unresolvedId,
      exp: Math.floor((args.nowMs ?? Date.now()) / 1000) + (args.ttlSeconds ?? DEFAULT_TTL_SECONDS),
    } satisfies PlayerAliasReviewTokenPayload)
  );
  return `${payload}.${sign(payload, secret)}`;
}

export function verifyPlayerAliasReviewToken(args: {
  token: string | null | undefined;
  unresolvedId: string | null | undefined;
  nowMs?: number;
}): boolean {
  const secret = resolveSecret();
  if (!secret || !args.token || !args.unresolvedId) return false;

  const [payloadPart, signaturePart] = args.token.split(".");
  if (!payloadPart || !signaturePart) return false;

  const expectedSignature = sign(payloadPart, secret);
  const supplied = Uint8Array.from(Buffer.from(signaturePart));
  const expected = Uint8Array.from(Buffer.from(expectedSignature));
  if (supplied.length !== expected.length || !crypto.timingSafeEqual(supplied, expected)) {
    return false;
  }

  try {
    const payload = JSON.parse(base64UrlDecode(payloadPart)) as PlayerAliasReviewTokenPayload;
    const nowSeconds = Math.floor((args.nowMs ?? Date.now()) / 1000);
    return payload.unresolvedId === args.unresolvedId && payload.exp >= nowSeconds;
  } catch {
    return false;
  }
}
