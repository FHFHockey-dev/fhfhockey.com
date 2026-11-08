/** Local empirical checks only. Unset means no retained reads; an explicit bad root fails. */
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

export const retainedEnabled = process.env.BLSH_RETAINED_TEST_ROOT !== undefined;
export const retainedSuite = "retained empirical data (requires BLSH_RETAINED_TEST_ROOT; omitted from portable tests)";
const files = {
  historical: ["research-snapshots/2024-04-18.v1.json", "5177a5c6775db42f84302850522e6f3bc9f405227225a0e77455eca2ffc0aea8"],
  current: ["research-snapshots/2026-10-26.arm-a-official-overlay.v2.json", "b06c7f6e2a0086115193871d4ecde5da4b6566c9bb6b93c2de0045136fd96f5d"],
  repaired: ["research-snapshots/2026-10-28.arm-a-canonical-repaired.v2.json", "2f380c2539390f6931ec92ab1d0b1d8cced2b55f5f4cefb8c6e88a694909f2c8"],
  profiles: ["__fixtures__/display-profiles.jsonl", "bed954ae624b1877c67fa80c5b5615c471b408655367a5e7805f9be37c32ba33"],
} as const;
export function retainedBytes(key: keyof typeof files): Buffer {
  const root = process.env.BLSH_RETAINED_TEST_ROOT;
  if (!root?.trim()) throw new Error("BLSH_RETAINED_TEST_ROOT must explicitly name the retained data directory");
  const [file, pin] = files[key], path = resolve(root, file);
  const bytes = readFileSync(path);
  if (createHash("sha256").update(new Uint8Array(bytes)).digest("hex") !== pin) throw new Error(`Retained data pin mismatch: ${path}`);
  return bytes;
}
