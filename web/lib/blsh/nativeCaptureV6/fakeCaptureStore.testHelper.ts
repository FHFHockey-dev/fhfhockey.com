/** Test-only in-memory CaptureStore that models the migration's rules: one claim per
 * (pipeline, source_date), append-only objects with unique paths, one terminal close.
 * `delayMs` simulates a slow remote write so tests can prove the permit window holds. */
import { createHash, randomUUID } from "node:crypto";
import { packetObjectPath, type CaptureStore, type RunState } from "./writer";

export type StoreCall = { kind: "enabled" | "claim" | "intent" | "putObject" | "close"; at: number; atMonotonic: number; detail?: unknown };
export function createFakeCaptureStore(options: { enabled?: boolean; delayMs?: number; failOn?: StoreCall["kind"]; failAfterObjects?: number } = {}) {
  const calls: StoreCall[] = [];
  const runs = new Map<string, { runId: string; sourceDate: string; state: string; reason: string | null; manifestSHA256: string | null; intents: unknown[] }>();
  const objects = new Map<string, { ordinal: number; bytes: Buffer; sha256: string; runId: string }>();
  let enabled = options.enabled ?? true;
  const step = async (kind: StoreCall["kind"], detail?: unknown) => {
    if (options.delayMs) await new Promise(resolve => setTimeout(resolve, options.delayMs));
    calls.push({ kind, at: Date.now(), atMonotonic: performance.now(), detail });
    if (options.failOn === kind) throw new Error(`fake_store_${kind}_failed`);
  };
  const store: CaptureStore = {
    async enabled() { await step("enabled"); return enabled; },
    async claim({ sourceDate }) {
      await step("claim", { sourceDate });
      if ([...runs.values()].some(run => run.sourceDate === sourceDate)) return { claimed: false };
      const runId = randomUUID();
      runs.set(runId, { runId, sourceDate, state: "claimed", reason: null, manifestSHA256: null, intents: [] });
      return { claimed: true, runId };
    },
    async intent(runId, group, operations) {
      await step("intent", { group, operations: [...operations] });
      const run = runs.get(runId); if (!run || run.state !== "claimed") throw new Error("fake_intent_refused");
      run.intents.push({ group, operations: [...operations] });
    },
    async putObject(runId, sourceDate, ordinal, file, bytes, sha256) {
      const path = packetObjectPath(sourceDate, runId, file);
      await step("putObject", { path, ordinal });
      const run = runs.get(runId);
      if (!run || run.state !== "claimed" || run.sourceDate !== sourceDate || objects.has(path)) throw new Error("fake_object_refused");
      if (options.failAfterObjects !== undefined && objects.size >= options.failAfterObjects) throw new Error("fake_object_quota");
      if (createHash("sha256").update(new Uint8Array(bytes)).digest("hex") !== sha256) throw new Error("fake_object_hash");
      objects.set(path, { ordinal, bytes: Buffer.from(new Uint8Array(bytes)), sha256, runId });
    },
    async close(runId, state: RunState, reason, manifestSHA256) {
      await step("close", { state, reason });
      const run = runs.get(runId); if (!run || run.state !== "claimed") throw new Error("fake_close_refused");
      Object.assign(run, { state, reason, manifestSHA256 });
    },
  };
  const files = (runId: string) => [...objects.entries()].filter(([, value]) => value.runId === runId).sort((a, b) => a[1].ordinal - b[1].ordinal)
    .map(([path, value]) => ({ file: path.split("/").at(-1)!, ...value }));
  return { store, calls, runs, objects, files, setEnabled: (value: boolean) => { enabled = value; }, setDelay: (ms: number) => { options.delayMs = ms; } };
}
