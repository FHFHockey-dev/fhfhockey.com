import { createHash } from "node:crypto";
import { z } from "zod";
import { isNewsRelayAccount } from "lib/newsFeed";
import { timestampMicros } from "lib/projections/evidenceTime";

const digest = z.string().regex(/^[a-f0-9]{64}$/);
const handle = z.string().regex(/^[A-Za-z0-9_]{1,15}$/);
const postId = z.string().regex(/^[0-9]{1,30}$/);
const clock = z.string().datetime().refine(value => timestampMicros(value) !== null);
const sealSchema = z.object({
  id: z.string().uuid(), policyId: z.string().uuid(), shadowId: z.string().uuid(),
  sourceKey: z.string().regex(/^[a-z0-9_]{1,64}$/), sourceAccount: handle, postId,
  firstSeenAt: clock, publishedAt: clock, expiresAt: clock, via: z.enum(["public", "mirror"]),
  responseSha256: digest, payloadJson: z.string().min(1).max(65536), payloadSha256: digest,
  classification: z.enum(["baseline", "variant"]),
}).strict();
export type FxTwitterSeal = z.infer<typeof sealSchema>;

const statusSchema = z.object({
  id: postId, url: z.string(), author: z.object({ screen_name: handle }),
  text: z.string().nullish(), raw_text: z.object({ text: z.string().nullish() }).nullish(),
  created_timestamp: z.number().int().nullish(), created_at: z.string().nullish(),
  reposted_by: z.object({ screen_name: handle }).nullish(), quote: z.unknown(),
});

function readStatus(value: unknown) {
  const status = statusSchema.parse(value);
  const author = status.author.screen_name.toLowerCase();
  const url = `https://x.com/${author}/status/${status.id}`;
  // Verify the supplied link before canonicalizing it. A numeric ID alone cannot identify the byline.
  const link = /^https:\/\/(?:www\.)?(?:x|twitter)\.com\/([a-z0-9_]{1,15})\/status\/(\d+)$/i.exec(status.url);
  const text = status.raw_text?.text ?? status.text;
  const epoch = status.created_timestamp == null ? null : status.created_timestamp * 1000;
  const label = status.created_at == null ? null : Date.parse(status.created_at);
  const published = epoch ?? label;
  if (!link || link[1]!.toLowerCase() !== author || link[2] !== status.id ||
      typeof text !== "string" || !text.trim() || /^\s*RT\s+@/i.test(text) ||
      published === null || !Number.isSafeInteger(published) ||
      (epoch !== null && label !== null && label !== epoch)) throw new Error("invalid_fx_original");
  return { id: status.id, author, url, text, published, repostedBy: status.reposted_by?.screen_name.toLowerCase(), quote: status.quote };
}

function readSeal(input: FxTwitterSeal) {
  const seal = sealSchema.parse(input);
  if (Buffer.byteLength(seal.payloadJson, "utf8") > 65536 ||
      createHash("sha256").update(seal.payloadJson, "utf8").digest("hex") !== seal.payloadSha256 ||
      seal.classification !== "baseline") throw new Error("unqualified_fx_payload");
  const payload: unknown = JSON.parse(seal.payloadJson);
  // The poller serializes the selected provider status before any wrapper metadata is added.
  if (JSON.stringify(payload) !== seal.payloadJson) throw new Error("invalid_fx_payload_encoding");
  const status = readStatus(payload);
  const seen = timestampMicros(seal.firstSeenAt)!;
  const expires = timestampMicros(seal.expiresAt)!;
  const published = timestampMicros(seal.publishedAt)!;
  const collector = seal.sourceAccount.toLowerCase();
  if (status.id !== seal.postId || BigInt(status.published) * BigInt(1000) !== published ||
      published > seen || seen >= expires || expires - seen > BigInt(7 * 86400) * BigInt(1000000) ||
      (status.author !== collector && status.repostedBy !== collector)) throw new Error("unbound_fx_seal");
  return { seal, payload, status, seen, expires };
}

/** Recheck the private owner-loaded records. Custody and first sighting are proven by DB enrollment. */
export function bindFxTwitterOriginal(capture: FxTwitterSeal, original: FxTwitterSeal | null) {
  const outer = readSeal(capture);
  const selected = original === null ? outer : readSeal(original);
  if (original === null && outer.status.quote != null) throw new Error("independent_fx_quote_required");
  if (original !== null) {
    const quoted = readStatus(outer.status.quote);
    const report = selected.status;
    if (original.id === capture.id || original.shadowId === capture.shadowId || report.id === outer.status.id ||
        original.policyId !== capture.policyId || quoted.id !== report.id || quoted.author !== report.author ||
        quoted.url !== report.url || quoted.published !== report.published || quoted.text !== report.text ||
        report.published > outer.status.published) throw new Error("unbound_fx_quote");
  }
  if (isNewsRelayAccount(selected.status.author)) throw new Error("fx_original_reporter_unresolved");
  const receivedAt = selected.seen > outer.seen ? selected.seal.firstSeenAt : outer.seal.firstSeenAt;
  const expiresAt = selected.expires < outer.expires ? selected.seal.expiresAt : outer.seal.expiresAt;
  if (timestampMicros(receivedAt)! >= timestampMicros(expiresAt)!) throw new Error("fx_receipt_windows_disjoint");
  return { status: selected.status, payload: selected.payload, seal: selected.seal, receivedAt, expiresAt };
}
