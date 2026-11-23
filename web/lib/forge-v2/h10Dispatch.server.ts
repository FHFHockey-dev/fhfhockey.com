/**
 * Per-dispatch HMAC authentication for the hosted H1–H10 route (TJ Q3, 2026-11-23), after the 11-17 pregame pattern
 * (migration 20261117215012, `forge-pregame-capture`). pg_cron calls the owner-only `forge_h10_tick_v1(mode)`
 * (migration 20261123220000), which records a one-use dispatch and posts it with an HMAC computed from the Vault secret
 * `forge_h10_dispatch_secret`. The reusable secret never travels: only the signature does.
 *
 * The signature binds the route, the mode (the payload), the intended run (`nightly:<ET date>` or `material:<ET date>`),
 * the dispatch id and a short expiry. The route checks it before anything else, then consumes the dispatch in one
 * database call: an unknown, mismatched, expired or already-used dispatch is refused, and a concurrent duplicate
 * delivery is refused by an advisory lock. There is no bearer fallback.
 */
import { createHmac, timingSafeEqual } from "node:crypto";
import { instant } from "./contracts";
import { SqlConnection } from "./history.server";
import { easternDailyDeadline, easternDate } from "./refresh";

export const H10_ROUTE = "/api/v1/db/forge-h10-shadow";
export const H10_SIGNATURE_HEADER = "x-forge-h10-signature";
/** A dispatch is valid for at most this long after it is signed (pg_net delivers within seconds). */
export const H10_DISPATCH_MAX_AGE_SECONDS = 120;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

export interface H10DispatchBody { dispatchId: string; mode: "nightly" | "material"; runKey: string; expiresAt: number }

/** The signed text. The SQL tick builds the same string (newline-separated, expiry in whole epoch seconds). */
export const h10DispatchMessage = (route: string, body: H10DispatchBody) =>
  ["forge-h10-dispatch-v1", route, body.mode, body.runKey, body.dispatchId, String(body.expiresAt)].join("\n");
export const signH10Dispatch = (secret: string, route: string, body: H10DispatchBody) => createHmac("sha256", secret).update(h10DispatchMessage(route, body)).digest("hex");

/** The run a call at `now` belongs to: the Eastern date of the latest 04:00 ET nightly cutoff. */
export function h10RunKey(mode: "nightly" | "material", now: number): string {
  const today = easternDate(new Date(now).toISOString()), cutoff = instant(easternDailyDeadline(today)) - 4 * 3600000;
  const date = now >= cutoff ? today : easternDate(new Date(cutoff - 6 * 3600000).toISOString());
  return `${mode}:${date}`;
}

function parseBody(body: unknown): H10DispatchBody | null {
  if (!body || typeof body !== "object" || Array.isArray(body)) return null;
  const b = body as Record<string, unknown>;
  if (Object.keys(b).sort().join(",") !== "dispatchId,expiresAt,mode,runKey") return null;
  if (typeof b.dispatchId !== "string" || !UUID.test(b.dispatchId) || (b.mode !== "nightly" && b.mode !== "material")) return null;
  if (typeof b.runKey !== "string" || !/^(nightly|material):\d{4}-\d{2}-\d{2}$/.test(b.runKey) || !Number.isSafeInteger(b.expiresAt)) return null;
  return { dispatchId: b.dispatchId, mode: b.mode, runKey: b.runKey, expiresAt: b.expiresAt as number };
}
function validSignature(secret: string, route: string, body: H10DispatchBody, signature: unknown) {
  if (typeof signature !== "string" || !/^[0-9a-f]{64}$/.test(signature)) return false;
  return timingSafeEqual(Uint8Array.from(Buffer.from(signH10Dispatch(secret, route, body), "hex")), Uint8Array.from(Buffer.from(signature, "hex")));
}

export interface H10DispatchRequest { method?: string; path: string; query: Record<string, unknown>; headers: Record<string, string | string[] | undefined>; body: unknown }
export type H10Authorization = { ok: true; dispatch: H10DispatchBody } | { ok: false; status: number; body: Record<string, unknown> };

/** Checks the request without touching the database: shape, route, signature, expiry and run. */
export function verifyH10Dispatch(request: H10DispatchRequest, secret: string | undefined, now: number): H10Authorization {
  if (request.method !== "POST") return { ok: false, status: 405, body: { status: "method_not_allowed" } };
  if (!secret || !/^[!-~]{32,}$/.test(secret)) return { ok: false, status: 503, body: { status: "dispatch_key_unavailable" } };
  if (request.path !== H10_ROUTE || Object.keys(request.query).length) return { ok: false, status: 400, body: { status: "invalid_route" } };
  const body = parseBody(request.body);
  if (!body) return { ok: false, status: 400, body: { status: "invalid_dispatch" } };
  if (!validSignature(secret, H10_ROUTE, body, request.headers[H10_SIGNATURE_HEADER])) return { ok: false, status: 401, body: { status: "invalid_signature" } };
  const seconds = Math.floor(now / 1000);
  if (body.expiresAt < seconds || body.expiresAt - seconds > H10_DISPATCH_MAX_AGE_SECONDS) return { ok: false, status: 401, body: { status: "expired_signature" } };
  if (body.runKey !== h10RunKey(body.mode, now)) return { ok: false, status: 409, body: { status: "run_mismatch", runKey: body.runKey } };
  return { ok: true, dispatch: body };
}

/** Consumes the dispatch: exactly one delivery starts; a retry or concurrent duplicate reports the same run. */
export async function beginH10Dispatch(db: SqlConnection, dispatch: H10DispatchBody): Promise<H10Authorization> {
  const { rows } = await db.query<{ status: string; outcome: string | null }>("select status, outcome from public.forge_h10_dispatch_begin_v1($1::uuid, $2, $3, $4)",
    [dispatch.dispatchId, dispatch.mode, dispatch.runKey, dispatch.expiresAt]);
  const receipt = rows[0];
  if (receipt?.status === "started") return { ok: true, dispatch };
  const status = receipt?.status ?? "dispatch_unconfirmed";
  return { ok: false, status: status === "duplicate" ? 200 : status === "expired" ? 401 : 409, body: { success: status === "duplicate", status, runKey: dispatch.runKey, outcome: receipt?.outcome ?? null } };
}
export async function finishH10Dispatch(db: SqlConnection, dispatchId: string, outcome: string): Promise<void> {
  await db.query("select public.forge_h10_dispatch_finish_v1($1::uuid, $2)", [dispatchId, outcome.slice(0, 60)]);
}
