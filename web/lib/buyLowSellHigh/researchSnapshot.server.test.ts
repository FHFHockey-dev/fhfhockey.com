import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";
import { readHistoricalBlshSnapshot, readCurrentBlshSnapshot, MAX_SNAPSHOT_BYTES, CURRENT_SNAPSHOT_BYTES, CURRENT_SNAPSHOT_PATH } from "./researchSnapshot.server";
import { getStaticProps } from "../../pages/buy-low-sell-high/preview";

describe("BLSH immutable local reader", () => {
  it("verifies bytes/hash and complete contract", () => {
    const bytes = readFileSync(join(process.cwd(), "lib/buyLowSellHigh/research-snapshots/2024-04-18.v1.json"));
    const s = readHistoricalBlshSnapshot({ size: () => bytes.length, read: () => Uint8Array.from(bytes) });
    expect(s.profiles).toHaveLength(924); expect(s.eventThroughDate).toBe("2024-04-18");
  });
  it("rejects oversize input before reading", () => {
    expect(() => readHistoricalBlshSnapshot({ size: () => MAX_SNAPSHOT_BYTES + 1, read: () => { throw new Error("must not read"); } })).toThrow(/size/);
  });
  it("rejects truncation and altered bytes", () => {
    expect(() => readHistoricalBlshSnapshot({ size: () => 2, read: () => new Uint8Array(1) })).toThrow(/changed during read/);
    expect(() => readHistoricalBlshSnapshot({ size: () => 2, read: () => new Uint8Array([123, 125]) })).toThrow(/hash mismatch/);
  });
  it("retains production404 before reading the snapshot", async () => {
    vi.stubEnv("NODE_ENV", "production");
    try { expect(await getStaticProps({} as never)).toEqual({ notFound: true }); }
    finally { vi.unstubAllEnvs(); }
  });
  it("reads the pinned refreshed v2 candidate and keeps all729profiles", () => {
    const bytes = readFileSync(CURRENT_SNAPSHOT_PATH);
    expect(bytes.length).toBe(CURRENT_SNAPSHOT_BYTES);
    expect(readCurrentBlshSnapshot({ size: () => bytes.length, read: () => Uint8Array.from(bytes) }).profiles).toHaveLength(729);
  });
  it("rejects wrong v2 size before reading and rejects same-length altered bytes", () => {
    expect(() => readCurrentBlshSnapshot({ size: () => CURRENT_SNAPSHOT_BYTES - 1, read: () => { throw new Error("must not read"); } })).toThrow(/size/);
    expect(() => readCurrentBlshSnapshot({ size: () => CURRENT_SNAPSHOT_BYTES, read: () => new Uint8Array(CURRENT_SNAPSHOT_BYTES) })).toThrow(/hash mismatch/);
  });
});
