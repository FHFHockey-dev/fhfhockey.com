import { createHash, timingSafeEqual } from "node:crypto";
import type { NextApiRequest, NextApiResponse } from "next";
import { z } from "zod";

export const CAPTURE_MAX_BYTES = 65_536;
const BODY_DEADLINE_MS = 5_000, STORE_DEADLINE_MS = 3_000;
const scopeSchema = z.object({ policyId: z.string().uuid(), appletId: z.string().min(1).max(128),
  sourceAccount: z.string().regex(/^[A-Za-z0-9_]{1,15}$/) }).strict();
export type CaptureScope = z.infer<typeof scopeSchema>;
export type CaptureEnvelope = Readonly<{
  version: "luna-isolated-capture-v1";
  scope: Readonly<CaptureScope>;
  // This authenticated attempt's start, sampled before reading its body.
  receivedAt: string;
  rawBody: string;
  payloadSha256: string;
  byteLength: number;
  deliveryKey: string;
  submitted: Readonly<{ text: string; username: string; link: string; postId: string;
    createdAtLabel: string; embed: string | null }>;
  sourceAuthenticated: false;
}>;
const receiptSchema = z.object({
  id: z.string().uuid(), kind: z.literal("luna-isolated-archive-v1"),
  policyId: z.string().uuid(), appletId: z.string(), deliveryKey: z.string(),
  payloadSha256: z.string(), byteLength: z.number().int().positive(),
  // Start timestamp copied from the attempt that won first durable retention;
  // immutable on duplicates, NOT the minimum start time of all arrivals.
  firstReceivedAt: z.string().datetime(), classification: z.enum(["baseline", "variant"]),
}).strict();
export type CaptureReceipt = z.infer<typeof receiptSchema>;
export type CaptureResult = { status: "retained" | "duplicate" | "variant"; receipt: CaptureReceipt }
  | { status: "refused"; reason: "stopped" | "window_closed" | "attempt_cap" | "receipt_cap" | "byte_cap" };
export type CaptureLookup = Pick<CaptureEnvelope, "scope" | "deliveryKey" | "payloadSha256">;
/** Future PRIVATE archive implementation must atomically enforce durable finite
 * window/attempt/receipt/byte caps and stop, immutable exact bytes, unique exact
 * duplicates and held variants. No legacy writes, model calls or enqueueing.
 * Signal/deadline cancellation is NOT proof of rollback. Neither operation may
 * internally retry a write. No implementation is wired by this candidate.
 */
export interface CaptureStore {
  retain(input: CaptureEnvelope, signal: AbortSignal): Promise<CaptureResult>;
  lookupExact(input: CaptureLookup, signal: AbortSignal): Promise<CaptureResult | null>;
}
type Dependencies = {
  enabled: () => boolean;
  secret: () => string | undefined;
  scope: () => CaptureScope | undefined;
  store: () => CaptureStore | undefined;
  now?: () => string;
};
const authority = { sourceAuthenticated: false, canEnqueue: false, canPublish: false } as const;
// Preserve the Buffer view boundaries while using the web compiler's typed-array contract.
function byteView(value: Buffer) { return new Uint8Array(value.buffer, value.byteOffset, value.byteLength); }
function digest(value: string | Buffer) {
  return createHash("sha256").update(typeof value === "string" ? value : byteView(value)).digest("hex");
}
function authorized(header: unknown, secret: string | undefined) {
  if (!secret || secret.length < 32 || secret.length > 256 || typeof header !== "string" || header.length > 256) return false;
  const a = Buffer.from(header), b = Buffer.from(secret);
  return a.length === b.length && timingSafeEqual(byteView(a), byteView(b));
}
class CaptureBodyError extends Error {
  constructor(readonly status: number) { super("invalid_capture_body"); }
}
function readBody(req: NextApiRequest): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = []; let size = 0;
    const cleanup = () => {
      clearTimeout(timer); req.off("data", onData); req.off("end", onEnd);
      req.off("error", onError); req.off("aborted", onError);
    };
    const fail = (status: number) => {
      cleanup(); req.pause();
      // IncomingMessage can emit an error after aborted. Keep that late error
      // handled until close without retaining body buffers/listeners.
      const ignoreError = () => undefined;
      req.on("error", ignoreError); req.once("close", () => req.off("error", ignoreError));
      reject(new CaptureBodyError(status));
    };
    const onData = (chunk: unknown) => {
      if (!Buffer.isBuffer(chunk)) { fail(400); return; }
      size += chunk.length;
      if (size > CAPTURE_MAX_BYTES) { fail(413); return; }
      chunks.push(chunk);
    };
    const onEnd = () => { cleanup(); resolve(Buffer.concat(chunks.map(byteView))); };
    const onError = () => fail(400);
    const timer = setTimeout(() => fail(408), BODY_DEADLINE_MS);
    req.on("data", onData); req.on("end", onEnd); req.on("error", onError); req.on("aborted", onError);
  });
}
const aliases = {
  text: ["text", "Text"], username: ["username", "UserName"],
  link: ["link_to_tweet", "linkToTweet", "LinkToTweet"],
  createdAt: ["created_at", "createdAt", "CreatedAt"],
  embed: ["tweet_embed_code", "tweetEmbedCode", "TweetEmbedCode"],
  account: ["source_account", "sourceAccount"],
};
const allowedKeys = new Set(Object.values(aliases).flat());
function field(body: Record<string, unknown>, names: string[], optional = false): string | null {
  const found = names.filter(name => Object.hasOwn(body, name));
  if (!found.length && optional) return null;
  if (found.length !== 1) throw new Error();
  const value = body[found[0]!];
  if (typeof value !== "string" || (!optional && !value.trim())) throw new Error();
  return value;
}
/** This wire contract is a flat JSON object of strings. Decode each key before
 * inserting it so JSON.parse cannot silently collapse duplicate/escaped names.
 * JSON.parse is used only on isolated string tokens, never on the whole object.
 */
function parseCaptureBody(raw: string): Record<string, string> {
  let cursor = 0;
  const row: Record<string, string> = Object.create(null);
  const keys = new Set<string>();
  const token = /"(?:[^"\\\u0000-\u001f]|\\(?:["\\/bfnrt]|u[0-9a-fA-F]{4}))*"/y;
  const whitespace = () => { while (cursor < raw.length && /[ \t\r\n]/.test(raw[cursor]!)) cursor++; };
  const take = (char: string) => { whitespace(); if (raw[cursor++] !== char) throw new Error(); };
  const string = (): string => {
    whitespace(); token.lastIndex = cursor;
    const match = token.exec(raw); if (!match) throw new Error();
    cursor = token.lastIndex; return JSON.parse(match[0]) as string;
  };
  take("{"); whitespace();
  if (raw[cursor] !== "}") {
    while (true) {
      const key = string();
      if (keys.has(key)) throw new Error();
      keys.add(key); take(":"); row[key] = string(); whitespace();
      if (raw[cursor] === "}") break;
      take(",");
    }
  }
  take("}"); whitespace();
  if (cursor !== raw.length) throw new Error();
  return row;
}
export function prepareCaptureEnvelope(bytes: Buffer, scope: CaptureScope, receivedAt: string): CaptureEnvelope {
  scopeSchema.parse(scope); z.string().datetime().parse(receivedAt);
  if (bytes.length < 1 || bytes.length > CAPTURE_MAX_BYTES) throw new Error("invalid_capture_size");
  // Retain exact UTF-8 bytes; reject lossy decoding, not silently replaced text.
  const rawBody = new TextDecoder("utf-8", { fatal: true, ignoreBOM: true }).decode(bytes);
  const row = parseCaptureBody(rawBody);
  if (Object.keys(row).some(key => !allowedKeys.has(key))) throw new Error();
  const text = field(row, aliases.text)!, username = field(row, aliases.username)!;
  const link = field(row, aliases.link)!, createdAtLabel = field(row, aliases.createdAt)!;
  const account = field(row, aliases.account, true), embed = field(row, aliases.embed, true);
  if (username.trim().toLowerCase() !== scope.sourceAccount.toLowerCase()
    || (account !== null && account.trim().toLowerCase() !== scope.sourceAccount.toLowerCase())) throw new Error();
  const url = new URL(link.trim());
  const match = /^\/([A-Za-z0-9_]{1,15})\/status\/(\d{1,30})$/.exec(url.pathname);
  if (url.protocol !== "https:" || !["x.com", "twitter.com", "www.x.com", "www.twitter.com"].includes(url.hostname)
    || url.username || url.password || url.port || url.hash || !match
    || match[1]!.toLowerCase() !== scope.sourceAccount.toLowerCase()) throw new Error();
  // Account/link agreement is only consistency of submitted metadata. Publication
  // labels are retained as supplied; no timezone or original authorship is inferred.
  const frozenScope = Object.freeze({ ...scope, policyId: scope.policyId.toLowerCase() });
  return Object.freeze({ version: "luna-isolated-capture-v1", scope: frozenScope, receivedAt,
    rawBody, payloadSha256: digest(bytes), byteLength: bytes.length,
    deliveryKey: digest(JSON.stringify([frozenScope.policyId, scope.appletId, scope.sourceAccount.toLowerCase(), match[2]])),
    submitted: Object.freeze({ text, username, link, postId: match[2]!, createdAtLabel, embed }),
    sourceAuthenticated: false });
}
export function validateCaptureResult(result: unknown, input: CaptureEnvelope): CaptureResult {
  if (!result || typeof result !== "object") throw new Error();
  const row = result as Record<string, unknown>;
  if (row.status === "refused") {
    const reason = z.enum(["stopped", "window_closed", "attempt_cap", "receipt_cap", "byte_cap"]).parse(row.reason);
    return { status: "refused", reason };
  }
  const status = z.enum(["retained", "duplicate", "variant"]).parse(row.status);
  const r = receiptSchema.parse(row.receipt);
  // Overlapping arrivals can complete in reverse order. The retained winner's
  // start may be later than this attempt's start, including during exact lookup.
  // Validate timestamp syntax, not a false cross-attempt ordering relation.
  if (r.policyId.toLowerCase() !== input.scope.policyId || r.appletId !== input.scope.appletId
    || r.deliveryKey !== input.deliveryKey || r.payloadSha256 !== input.payloadSha256 || r.byteLength !== input.byteLength
    || (status === "retained" && r.classification !== "baseline")
    || (status === "variant" && r.classification !== "variant")) throw new Error();
  return { status, receipt: r };
}
async function bounded<T>(operation: (signal: AbortSignal) => Promise<T>): Promise<T> {
  const controller = new AbortController(); let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([Promise.resolve().then(() => operation(controller.signal)),
      new Promise<never>((_, reject) => { timer = setTimeout(() => {
        controller.abort(); reject(new Error("outcome_unknown"));
      }, STORE_DEADLINE_MS); })]);
  } finally { clearTimeout(timer); }
}
export function createIsolatedLunaCaptureHandler(deps: Dependencies) {
  return async (req: NextApiRequest, res: NextApiResponse) => {
    res.setHeader("Cache-Control", "no-store");
    if (req.method !== "POST") { res.setHeader("Allow", "POST"); return res.status(405).json({ status: "method_not_allowed" }); }
    // Route disables Next's body parser: no body/credential/store access before gate.
    if (!deps.enabled()) return res.status(503).json({ status: "disabled", ...authority });
    if (!authorized(req.headers["x-fhfh-luna-capture-secret"], deps.secret())) return res.status(401).json({ status: "unauthorized" });
    const scope = scopeSchema.safeParse(deps.scope());
    if (!scope.success) return res.status(503).json({ status: "unconfigured" });
    let store: CaptureStore | undefined;
    try { store = deps.store(); } catch { /* Do not expose construction errors. */ }
    if (!store) return res.status(503).json({ status: "unconfigured" });
    const contentType = req.headers["content-type"], length = req.headers["content-length"];
    if (typeof contentType !== "string" || !/^application\/json(?:\s*;\s*charset=utf-8)?$/i.test(contentType)
      || (req.headers["content-encoding"] !== undefined && req.headers["content-encoding"] !== "identity")) {
      return res.status(415).json({ status: "unsupported_content" });
    }
    if (length !== undefined && (typeof length !== "string" || !/^\d+$/.test(length))) return res.status(400).json({ status: "invalid_request" });
    if (length !== undefined && Number(length) > CAPTURE_MAX_BYTES) return res.status(413).json({ status: "invalid_request" });
    let input: CaptureEnvelope;
    try {
      const receivedAt = deps.now?.() ?? new Date().toISOString();
      z.string().datetime().parse(receivedAt);
      const bytes = await readBody(req);
      if (length !== undefined && Number(length) !== bytes.length) throw new Error();
      input = prepareCaptureEnvelope(bytes, scope.data, receivedAt);
    } catch (error) {
      res.setHeader("Connection", "close");
      return res.status(error instanceof CaptureBodyError ? error.status : 400).json({ status: "invalid_request" });
    }
    // Stop may have changed while receiving the body. Durable stop/window/caps must
    // also be checked in the same future transaction as every retention attempt.
    if (!deps.enabled()) return res.status(503).json({ status: "disabled", ...authority });
    let result: CaptureResult;
    try { result = validateCaptureResult(await bounded(signal => store!.retain(input, signal)), input); }
    catch {
      try {
        const found = await bounded(signal => store!.lookupExact({ scope: input.scope,
          deliveryKey: input.deliveryKey, payloadSha256: input.payloadSha256 }, signal));
        if (!found || found.status === "refused") throw new Error();
        result = validateCaptureResult(found, input);
      } catch { return res.status(503).json({ status: "outcome_unknown", reconciliationRequired: true, ...authority }); }
    }
    if (result.status === "refused") return res.status(429).json({ status: "refused", reason: result.reason, ...authority });
    return res.status(200).json({ status: result.status, receiptId: result.receipt.id,
      heldForReview: true, ...authority });
  };
}
