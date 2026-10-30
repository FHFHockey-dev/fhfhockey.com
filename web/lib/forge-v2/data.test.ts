// @vitest-environment node
import { describe, expect, it } from "vitest";
import { fixtureSource } from "./fixtures";
import { contentHash } from "./hash.server";
import { normalizeSourceBatch, sourceInstant, type SourceBatch, type SourcePolicy, type SourceRecord } from "./data";

type Payload = { SOG: number; PIM: number | null };
const cutoffAt = "2026-01-01T13:00:00.000Z";
const policy: SourcePolicy = { cutoffAt, maximumAgeMs: 2 * 3600000, maximumRecords: 20, maximumPages: 5,
  intendedUse: "local_fixture", approvals: [{ source: "fixture", evidenceId: "synthetic-approval", approvedAt: cutoffAt, intendedUse: "local_fixture" }] };
function row(): SourceRecord<Payload> {
  const payload = { SOG: 2, PIM: null };
  return { identity: { playerId: 9900001, gameId: 2099020010, seasonId: 20992000, teamId: 1, mappingRevision: "mapping-1", verified: true },
    source: fixtureSource({ sha256: contentHash(payload) }), payload };
}
const batch = (records = [row()]): SourceBatch<Payload> => ({ complete: true, expectedCount: records.length, pages: [{ index: 0, records }] });
const validate = (p: Payload) => Number.isSafeInteger(p.SOG) && p.SOG >= 0 && Object.hasOwn(p, "PIM") && (p.PIM === null || Number.isSafeInteger(p.PIM) && p.PIM >= 0);
describe("supplied source normalization", () => {
  it("retains missing categories and pins verified canonical content without modifying inputs", () => {
    const input = batch(), result = normalizeSourceBatch(input, policy, validate);
    expect(result.state).toBe("available");
    if (result.state !== "available") return;
    expect(result.records[0].payload.PIM).toBeNull();
    expect(result.approvalEvidenceIds).toEqual(["synthetic-approval"]);
    expect(result.manifestHash).toBe(contentHash(result.records));
    result.records[0].payload.SOG = 6;
    expect(input.pages[0].records[0].payload.SOG).toBe(2);
  });
  it.each(["unknown receipt", "future receipt", "future publication", "stale", "identity", "rights", "hash", "missing field"])("rejects %s", failure => {
    const input = batch(), record = input.pages[0].records[0];
    if (failure === "unknown receipt") record.source.firstReceivedAt = "";
    if (failure === "future receipt") record.source.firstReceivedAt = "2026-01-01T14:00:00Z";
    if (failure === "future publication") record.source.publishedAt = "2026-01-01T14:00:00Z";
    if (failure === "stale") record.source.observedAt = "2025-12-01T12:00:00Z";
    if (failure === "identity") record.identity.verified = false;
    if (failure === "rights") record.source.use = "unknown";
    if (failure === "hash") record.payload.SOG = 9;
    if (failure === "missing field") { delete (record.payload as Partial<Payload>).PIM; record.source.sha256 = contentHash(record.payload); }
    expect(normalizeSourceBatch(input, policy, validate).state).toBe("unavailable");
  });
  it("requires intended-use approval and allows explicitly unknown provider publication with known receipt", () => {
    const input = batch(); input.pages[0].records[0].source.publishedAt = null;
    expect(normalizeSourceBatch(input, policy, validate).state).toBe("available");
    expect(normalizeSourceBatch(input, { ...policy, intendedUse: "public" }, validate).state).toBe("unavailable");
  });
  it.each(["count", "page", "complete", "duplicate"])("rejects incomplete/conflicting %s evidence", failure => {
    const input = batch();
    if (failure === "count") input.expectedCount = 2;
    if (failure === "page") input.pages[0].index = 1;
    if (failure === "complete") input.complete = false;
    if (failure === "duplicate") { input.pages[0].records.push(row()); input.expectedCount++; }
    expect(normalizeSourceBatch(input, policy, validate).state).toBe("unavailable");
  });
  it("selects the latest received revision deterministically and rejects tied conflicting revisions", () => {
    const old = row(), newer = row(); newer.source.revision = "r2"; newer.source.firstReceivedAt = "2026-01-01T12:30:00Z";
    const result = normalizeSourceBatch(batch([newer, old]), policy, validate);
    expect(result.state === "available" && result.records[0].source.revision).toBe("r2");
    newer.source.firstReceivedAt = old.source.firstReceivedAt;
    expect(normalizeSourceBatch(batch([newer, old]), policy, validate).state).toBe("unavailable");
  });
  it("requires UTC clocks and rejects invalid date rollover", () => {
    expect(sourceInstant("2026-02-30T12:00:00Z")).toBeNaN();
    expect(sourceInstant("2026-01-01T12:00:00")).toBeNaN();
    expect(sourceInstant("2026-01-01T12:00:00Z")).toBe(Date.parse("2026-01-01T12:00:00Z"));
  });
});
