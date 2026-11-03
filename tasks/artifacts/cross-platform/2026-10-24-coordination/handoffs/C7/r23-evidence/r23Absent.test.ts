// @vitest-environment node
// C7 R23: the server-fixed root is resolved from process.cwd() at module load; an absent root admits nothing.
import { vi, describe, expect, it } from "vitest";
import { writeFileSync } from "node:fs";
vi.hoisted(() => { process.cwd = () => "/nonexistent-c7-root"; });
import { cardEvidenceVerdict, unclaimedBundle } from "lib/player-cards/cardEvidenceVerdict";
import { buildInteractionFixture } from "lib/player-cards/interactionFixtures";
import { flowSettings, INITIAL_FLOW } from "lib/player-cards/interactionSnapshot";
describe("C7 R23 absent root", () => {
  it("K3 untraced/absent retained files: observed bundle referencing the pinned rows stays incomplete with retained-file-missing", async () => {
    const input: any = { ...buildInteractionFixture(flowSettings(INITIAL_FLOW), INITIAL_FLOW.scenario, INITIAL_FLOW.playerId), origin: "local-observed" };
    const b: any = unclaimedBundle(input, INITIAL_FLOW.playerId, "observed");
    b.finality = [{ gameId: 2026020095, receipt: { receiptId: "player-cards-2026-10-25/completion-read-01/RESULT.json#game-2026020095", sha256: "6ee7b37d6f6d075557d9987599043ba09320ca9d66e9c9a6bbdf75bf5dd5dae2" } }];
    const v = await cardEvidenceVerdict(input, b);
    if (process.env.C7_R23B_OUT) writeFileSync(process.env.C7_R23B_OUT, JSON.stringify({ state: v.state, codes: v.issueCodes }, null, 2));
    expect(v.state).not.toBe("eligible"); expect(v.issueCodes).toContain("retained-file-missing");
  });
});
