// @vitest-environment node
import * as fs from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createFakeCaptureStore } from "./fakeCaptureStore.testHelper";
import { createPacketSink } from "./sink";

let root: string;
beforeEach(() => { root = fs.mkdtempSync(join(tmpdir(), "blsh-v6-sink-test-")); });
afterEach(() => { fs.rmSync(root, { recursive: true, force: true }); });

async function claimed() {
  const fake = createFakeCaptureStore();
  const claim = await fake.store.claim({ sourceDate: "2026-11-19", deployment: {} });
  if (!claim.claimed) throw new Error("claim");
  return { fake, sink: createPacketSink({ store: fake.store, runId: claim.runId, sourceDate: "2026-11-19", journalRoot: root }) };
}

describe("v6 packet sink", () => {
  it("journals locally first, uploads in write order on checkpoint, and puts MANIFEST.json last", async () => {
    const { fake, sink } = await claimed();
    sink.write("STARTED.json", Buffer.from("{}\n"));
    sink.write("PLAN.json", Buffer.from("{\"a\":1}\n"));
    expect(fake.objects.size).toBe(0);
    const local = fs.readdirSync(root);
    expect(fs.readdirSync(join(root, local[0], sink.runId)).sort()).toEqual(["PLAN.json", "STARTED.json"]);
    await sink.checkpoint();
    sink.write("schedule.raw.json", Buffer.from("{}"));
    await sink.publishManifest(Buffer.from("{\"files\":[]}\n"));
    expect(fake.files(sink.runId).map(item => [item.ordinal, item.file])).toEqual([[1, "STARTED.json"], [2, "PLAN.json"], [3, "schedule.raw.json"], [4, "MANIFEST.json"]]);
    await sink.close("packet_complete_pending_review", null, "f".repeat(64));
    expect(fake.runs.get(sink.runId)?.state).toBe("packet_complete_pending_review");
    sink.dispose(); expect(fs.readdirSync(root)).toEqual([]);
  });

  it("refuses duplicate names, a hand-written MANIFEST.json and any write after the manifest", async () => {
    const { sink } = await claimed();
    sink.write("a.json", Buffer.from("1"));
    expect(() => sink.write("a.json", Buffer.from("2"))).toThrow("sink_write_refused");
    expect(() => sink.write("MANIFEST.json", Buffer.from("{}"))).toThrow("sink_write_refused");
    await sink.publishManifest(Buffer.from("{}"));
    expect(() => sink.write("late.json", Buffer.from("{}"))).toThrow("sink_write_refused");
    await expect(sink.publishManifest(Buffer.from("{}"))).rejects.toThrow("sink_manifest_twice");
  });

  it("an upload failure leaves no manifest and keeps the run claimed", async () => {
    const fake = createFakeCaptureStore({ failAfterObjects: 1 });
    const claim = await fake.store.claim({ sourceDate: "2026-11-19", deployment: {} });
    if (!claim.claimed) throw new Error("claim");
    const sink = createPacketSink({ store: fake.store, runId: claim.runId, sourceDate: "2026-11-19", journalRoot: root });
    sink.write("a.json", Buffer.from("1")); sink.write("b.json", Buffer.from("2"));
    await expect(sink.publishManifest(Buffer.from("{}"))).rejects.toThrow();
    expect(fake.files(claim.runId).map(item => item.file)).toEqual(["a.json"]);
    expect(fake.runs.get(claim.runId)?.state).toBe("claimed");
  });
});
