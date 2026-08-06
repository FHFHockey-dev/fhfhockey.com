import crypto from "crypto";

type ReviewTokenPayload = {
  conflictId?: string;
  scope?: "pending_conflicts";
  exp: number;
};

const DEFAULT_TTL_SECONDS = 7 * 24 * 60 * 60;

function encode(value: string | Buffer): string {
  return (typeof value === "string" ? Buffer.from(value) : value).toString("base64url");
}

function secret(): string | null {
  return (
    process.env.PLAYER_FORECAST_REVIEW_TOKEN_SECRET?.trim() ||
    process.env.CRON_SECRET?.trim() ||
    null
  );
}

function signature(payload: string, signingSecret: string): Buffer {
  return crypto.createHmac("sha256", signingSecret).update(payload).digest();
}

export function createPlayerForecastReviewToken(args: {
  conflictId?: string;
  queue?: boolean;
  nowMs?: number;
  ttlSeconds?: number;
} = {}): string | null {
  const signingSecret = secret();
  if (!signingSecret) return null;
  const payload = encode(
    JSON.stringify({
      ...(args.queue ? { scope: "pending_conflicts" as const } : { conflictId: args.conflictId }),
      exp: Math.floor((args.nowMs ?? Date.now()) / 1000) +
        (args.ttlSeconds ?? DEFAULT_TTL_SECONDS),
    } satisfies ReviewTokenPayload),
  );
  return `${payload}.${encode(signature(payload, signingSecret))}`;
}

export function verifyPlayerForecastReviewToken(args: {
  token: string | null | undefined;
  conflictId?: string | null;
  nowMs?: number;
}): boolean {
  const signingSecret = secret();
  if (!signingSecret || !args.token) return false;
  const [payload, suppliedSignature] = args.token.split(".");
  if (!payload || !suppliedSignature) return false;
  const supplied = Uint8Array.from(Buffer.from(suppliedSignature, "base64url"));
  const expected = Uint8Array.from(signature(payload, signingSecret));
  if (supplied.length !== expected.length || !crypto.timingSafeEqual(supplied, expected)) {
    return false;
  }
  try {
    const decoded = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as ReviewTokenPayload;
    if (decoded.exp < Math.floor((args.nowMs ?? Date.now()) / 1000)) return false;
    if (decoded.scope === "pending_conflicts") return true;
    return Boolean(args.conflictId && decoded.conflictId === args.conflictId);
  } catch {
    return false;
  }
}
