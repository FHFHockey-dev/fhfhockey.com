/** BLSH native capture v6: packet sink (DESIGN.md §3.2-§3.4).
 * Every file is first written to a fresh local /tmp journal (exclusive create, fsync, the
 * directory entry fsynced too), then uploaded in write order by checkpoint(). The core
 * decides WHEN to checkpoint: never between an admission and its NST GET, because the
 * shared-ledger permit lives 1000 ms from before the admission send. MANIFEST.json is
 * uploaded last; the run row is closed only after it. */
import { createHash } from "node:crypto";
import { closeSync, fsyncSync, mkdirSync, mkdtempSync, openSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { CaptureStore, RunState } from "./writer";

type Bytes = Uint8Array | Buffer;
const sha = (bytes: Bytes) => createHash("sha256").update(new Uint8Array(bytes)).digest("hex");
const copyOf = (bytes: Bytes) => Buffer.from(new Uint8Array(bytes));
export type PacketFile = { file: string; bytes: number; sha256: string };

export interface PacketSink {
  readonly runId: string;
  readonly sourceDate: string;
  /** Durable local write (/tmp). Synchronous so the core's dispatch guards keep v5's ordering. */
  write(file: string, bytes: Buffer): PacketFile;
  /** Uploads every local file not yet uploaded, in write order. */
  checkpoint(): Promise<void>;
  /** One remote intent row before an admission+NST pair: both may be consumed from here on. */
  intent(group: string, operations: readonly string[]): Promise<void>;
  /** Uploads pending files, then MANIFEST.json last. */
  publishManifest(bytes: Buffer): Promise<void>;
  close(state: RunState, reason: string | null, manifestSHA256: string | null): Promise<void>;
  /** Removes the local journal (best effort). */
  dispose(): void;
}

export function createPacketSink(options: { store: CaptureStore; runId: string; sourceDate: string; journalRoot?: string }): PacketSink {
  const root = mkdtempSync(join(options.journalRoot ?? tmpdir(), "blsh-v6-"));
  const directory = join(root, options.runId);
  mkdirSync(directory, { mode: 0o700 });
  const syncDirectory = (path: string) => { const fd = openSync(path, "r"); try { fsyncSync(fd); } finally { closeSync(fd); } };
  syncDirectory(root);
  const local: { file: string; bytes: Buffer; sha256: string }[] = [];
  const names = new Set<string>();
  let uploaded = 0, manifestPublished = false;
  // Serialized: a checkpoint abandoned by a caller's budget keeps running, and the next one waits for it
  // instead of starting a second upload loop over the same files.
  let chain: Promise<void> = Promise.resolve();
  const drain = async () => {
    while (uploaded < local.length) {
      const item = local[uploaded];
      await options.store.putObject(options.runId, options.sourceDate, uploaded + 1, item.file, item.bytes, item.sha256);
      uploaded++;
    }
  };
  return {
    runId: options.runId,
    sourceDate: options.sourceDate,
    write(file, bytes) {
      if (manifestPublished || file === "MANIFEST.json" || names.has(file)) throw new Error("sink_write_refused");
      const copy = copyOf(bytes);
      const fd = openSync(join(directory, file), "wx", 0o600);
      try { writeFileSync(fd, new Uint8Array(copy)); fsyncSync(fd); } finally { closeSync(fd); }
      syncDirectory(directory);
      names.add(file);
      const record = { file, bytes: copy, sha256: sha(copy) };
      local.push(record);
      return { file, bytes: copy.length, sha256: record.sha256 };
    },
    checkpoint: () => (chain = chain.then(drain, drain)),
    async intent(group, operations) { await options.store.intent(options.runId, group, operations); },
    async publishManifest(bytes) {
      if (manifestPublished) throw new Error("sink_manifest_twice");
      await (chain = chain.then(drain, drain));
      const copy = copyOf(bytes);
      await options.store.putObject(options.runId, options.sourceDate, local.length + 1, "MANIFEST.json", copy, sha(copy));
      manifestPublished = true;
    },
    close: (state, reason, manifestSHA256) => options.store.close(options.runId, state, reason, manifestSHA256),
    dispose() { try { rmSync(root, { recursive: true, force: true }); } catch { /* /tmp is ephemeral */ } },
  };
}
