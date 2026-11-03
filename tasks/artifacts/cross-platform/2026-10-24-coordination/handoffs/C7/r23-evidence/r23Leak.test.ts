// @vitest-environment node
// C7 R23: what the verdict carries into page props, and the observed-origin path against the real fixture root.
import { describe, expect, it } from "vitest";
import { writeFileSync } from "node:fs";
import { cardEvidenceVerdict, unclaimedBundle } from "lib/player-cards/cardEvidenceVerdict";
import { buildInteractionFixture } from "lib/player-cards/interactionFixtures";
import { flowSettings, INITIAL_FLOW } from "lib/player-cards/interactionSnapshot";
const out: Record<string, unknown> = {};
const base = () => buildInteractionFixture(flowSettings(INITIAL_FLOW), INITIAL_FLOW.scenario, INITIAL_FLOW.playerId);
describe("C7 R23", () => {
  it("K1 reason strings carry caller-referenced receipt ids into the serialized verdict", async () => {
    const input = base(); const b: any = unclaimedBundle(input, INITIAL_FLOW.playerId, "probe");
    b.populations = [{ metricId: (Object.keys((await cardEvidenceVerdict(input, b)).metrics))[0], receipt: { receiptId: "c7-internal/receipt-path.json#x", sha256: "0".repeat(64) } }];
    const v = await cardEvidenceVerdict(input, b); const json = JSON.stringify(v);
    out.K1 = { leaksReceiptId: json.includes("c7-internal/receipt-path.json#x"), state: v.state, sampleReason: Object.values(v.metrics).flatMap(m => m.reasons).find(r => r.includes("c7-internal")) };
    expect(v.state).not.toBe("eligible");
  });
  it("K2 observed origin, real fixture root: the five rows are admitted only as ingestion observations; no rank-bearing field reaches the verdict", async () => {
    const input: any = { ...base(), origin: "local-observed" };
    const b: any = unclaimedBundle(input, INITIAL_FLOW.playerId, "observed");
    b.finality = [2026020095, 2026020111].map(g => ({ gameId: g, receipt: { receiptId: `player-cards-2026-10-25/completion-read-01/RESULT.json#game-${g}`, sha256: "6ee7b37d6f6d075557d9987599043ba09320ca9d66e9c9a6bbdf75bf5dd5dae2" } }));
    const v = await cardEvidenceVerdict(input, b); const json = JSON.stringify(v);
    out.K2 = { state: v.state, codes: v.issueCodes, hasRank: /"rank"|"ordinal"|"percentile"|"value"/.test(json), keys: Object.keys(v) };
    expect(v.state).not.toBe("eligible"); expect(/"rank"|"ordinal"|"percentile"/.test(json)).toBe(false);
    if (process.env.C7_R23_OUT) writeFileSync(process.env.C7_R23_OUT, JSON.stringify(out, null, 2));
  });
});
