import { createHash } from "node:crypto";
import { gunzipSync, gzipSync } from "node:zlib";
import type { ProjectionInputRead } from "../inputCapture";
import { parseInstantMicros } from "./time";

/** Private, model-free native input packet for one exact game. No forecast or score is ever included. */
export const PACKET_VERSION = "forge-pregame-native-inputs-v1" as const;
export const MAX_PACKET_BYTES = 32 * 1024 * 1024;

export interface CaptureBinding {
  claimId: string; policyId: string; codeVersion: string;
  gameId: number; slateDate: string;
  homeTeamId: number; awayTeamId: number; homeAbbrev: string; awayAbbrev: string;
  scheduledStart: string; calendarRevision: string;
  /** The as-of instant passed to the readers' filters: the claim's own database clock. */
  inputCutoff: string;
}

export interface PregamePacket {
  version: typeof PACKET_VERSION;
  binding: CaptureBinding;
  /** Every read completed inside this window; the stated availability cutoff is its end. */
  readWindow: { start: string; end: string };
  statedCutoff: string;
  modelEnvironment: Record<string, string | null>;
  candidates: { skaters: number[]; goalies: number[]; reserves: number[] };
  transport: { calls: number; httpCalls: number; rows: number; bytes: number };
  reads: ProjectionInputRead[];
}

export function canonicalJson(value: unknown): string {
  return JSON.stringify(canonical(value));
}
// Same ordering as inputCapture's canonical(): object keys sorted with localeCompare, arrays kept in order.
function canonical(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).sort(([a], [b]) => a.localeCompare(b)).map(([k, v]) => [k, canonical(v)]));
  }
  return value;
}
export const sha256Hex = (data: string | Uint8Array) => createHash("sha256").update(data).digest("hex");

export interface EncodedPacket { bytes: Buffer; rawSha256: string; canonicalSha256: string }

/** Stored bytes are gzip(canonical JSON). raw = sha256(stored bytes); canonical = sha256(canonical JSON). */
export function encodePacket(packet: PregamePacket): EncodedPacket {
  assertPacket(packet);
  const json = canonicalJson(packet);
  const bytes = gzipSync(Buffer.from(json, "utf8"), { level: 9 });
  if (bytes.byteLength > MAX_PACKET_BYTES) throw new Error("packet_too_large");
  return { bytes, rawSha256: sha256Hex(bytes), canonicalSha256: sha256Hex(json) };
}

export function decodePacket(bytes: Uint8Array): { packet: PregamePacket; rawSha256: string; canonicalSha256: string } {
  if (bytes.byteLength > MAX_PACKET_BYTES) throw new Error("packet_too_large");
  const json = gunzipSync(bytes, { maxOutputLength: 512 * 1024 * 1024 }).toString("utf8");
  const packet = JSON.parse(json) as PregamePacket;
  assertPacket(packet);
  const canonicalText = canonicalJson(packet);
  if (canonicalText !== json) throw new Error("packet_not_canonical");
  return { packet, rawSha256: sha256Hex(bytes), canonicalSha256: sha256Hex(canonicalText) };
}

export function assertPacket(packet: PregamePacket): void {
  if (packet?.version !== PACKET_VERSION) throw new Error("packet_version");
  const b = packet.binding;
  if (!b || !Number.isSafeInteger(b.gameId) || b.gameId <= 0 || !/^\d{4}-\d{2}-\d{2}$/.test(b.slateDate)
    || !/^[0-9a-f]{64}$/.test(b.calendarRevision) || b.homeTeamId === b.awayTeamId || !b.claimId || !b.policyId || !b.codeVersion) {
    throw new Error("packet_binding");
  }
  for (const text of [b.scheduledStart, b.inputCutoff, packet.readWindow.start, packet.readWindow.end, packet.statedCutoff]) parseInstantMicros(text);
  if (parseInstantMicros(packet.statedCutoff) !== parseInstantMicros(packet.readWindow.end)) throw new Error("packet_stated_cutoff");
  if (parseInstantMicros(packet.readWindow.start) > parseInstantMicros(packet.readWindow.end)) throw new Error("packet_read_window");
  if (parseInstantMicros(b.inputCutoff) > parseInstantMicros(packet.readWindow.start)) throw new Error("packet_cutoff_after_reads");
  if (!Array.isArray(packet.reads) || packet.reads.length === 0) throw new Error("packet_no_reads");
  for (const read of packet.reads) {
    const at = parseInstantMicros(read.receivedAt);
    if (at < parseInstantMicros(packet.readWindow.start) || at > parseInstantMicros(packet.readWindow.end)) throw new Error("packet_read_outside_window");
    if (read.failure) throw new Error("packet_failed_read");
  }
}
