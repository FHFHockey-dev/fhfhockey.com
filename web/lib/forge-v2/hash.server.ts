import { createHash } from "node:crypto";
import { canonicalJson } from "./identity";

export function sha256(bytes: string | Uint8Array): string {
  return createHash("sha256").update(bytes).digest("hex");
}
export function contentHash(value: unknown): string { return sha256(canonicalJson(value)); }
