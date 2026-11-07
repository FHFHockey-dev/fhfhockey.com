import { createHash } from "node:crypto";
import { readFileSync, statSync } from "node:fs";
import { join } from "node:path";

import { parseHistoricalResearchSnapshot, parseCurrentResearchSnapshot, type BlshResearchSnapshot } from "./researchSnapshot";
import type { DisplaySnapshot } from "./displayProfile";

export const HISTORICAL_SNAPSHOT_SHA256 = "5177a5c6775db42f84302850522e6f3bc9f405227225a0e77455eca2ffc0aea8";
export const CURRENT_SNAPSHOT_SHA256 = "2f380c2539390f6931ec92ab1d0b1d8cced2b55f5f4cefb8c6e88a694909f2c8";
export const CURRENT_SNAPSHOT_BYTES = 9_559_567;
export const CURRENT_SNAPSHOT_PATH = join(process.cwd(), "lib/buyLowSellHigh/research-snapshots/2026-10-28.arm-a-canonical-repaired.v2.json");
export const MAX_SNAPSHOT_BYTES = 12 * 1024 * 1024;
type Reader = { size: (path: string) => number; read: (path: string) => Uint8Array };
const reader: Reader = { size: path => statSync(path).size, read: path => Uint8Array.from(readFileSync(path)) };

/** Server-only immutable local file. No query, request parameter, provider or scorer. */
export function readHistoricalBlshSnapshot(source: Reader = reader): BlshResearchSnapshot {
  const path = join(process.cwd(), "lib/buyLowSellHigh/research-snapshots/2024-04-18.v1.json");
  const size = source.size(path);
  if (!Number.isSafeInteger(size) || size < 1 || size > MAX_SNAPSHOT_BYTES) throw new Error("BLSH snapshot size outside bound");
  const bytes = source.read(path);
  if (bytes.byteLength !== size) throw new Error("BLSH snapshot changed during read");
  if (createHash("sha256").update(bytes).digest("hex") !== HISTORICAL_SNAPSHOT_SHA256) throw new Error("BLSH immutable snapshot hash mismatch");
  return parseHistoricalResearchSnapshot(JSON.parse(Buffer.from(bytes).toString("utf8")));
}

/** Fixed repository snapshot; no caller-supplied path or runtime converter. */
export function readCurrentBlshSnapshot(source: Reader = reader): DisplaySnapshot {
  const path = CURRENT_SNAPSHOT_PATH;
  const size = source.size(path);
  if (size !== CURRENT_SNAPSHOT_BYTES || size > MAX_SNAPSHOT_BYTES) throw new Error("BLSH current snapshot size outside bound");
  const bytes = source.read(path);
  if (bytes.byteLength !== size) throw new Error("BLSH snapshot changed during read");
  if (createHash("sha256").update(bytes).digest("hex") !== CURRENT_SNAPSHOT_SHA256) throw new Error("BLSH immutable snapshot hash mismatch");
  return parseCurrentResearchSnapshot(JSON.parse(Buffer.from(bytes).toString("utf8")));
}
