// @vitest-environment node
import { describe, expect, it } from "vitest";
import { writeFileSync } from "node:fs";
import type { GetServerSidePropsContext } from "next";
import { cardEvidenceVerdict, unclaimedBundle } from "lib/player-cards/cardEvidenceVerdict";
import { buildInteractionFixture } from "lib/player-cards/interactionFixtures";
import { flowSettings, INITIAL_FLOW } from "lib/player-cards/interactionSnapshot";
import { getServerSideProps } from "pages/social-share/player-cards";
describe("C7 R25 leak", () => {
  it("K1 (rerun of R23) caller receipt ids, paths and bundle ids never reach the verdict; the page props match the narrow shape", async () => {
    const input = buildInteractionFixture(flowSettings(INITIAL_FLOW), INITIAL_FLOW.scenario, INITIAL_FLOW.playerId);
    const b: any = unclaimedBundle(input, INITIAL_FLOW.playerId, "c7-secret-bundle-id");
    const metric = Object.keys((await cardEvidenceVerdict(input, b)).metrics)[0];
    b.populations = [{ metricId: metric, receipt: { receiptId: "c7-internal/receipt-path.json#x", sha256: "0".repeat(64) } }];
    b.definitions = [{ metricId: metric, definitionVersion: "v", receipt: { receiptId: "c7-internal/def.json#y", sha256: "1".repeat(64) } }];
    const json = JSON.stringify(await cardEvidenceVerdict(input, b));
    const props = await getServerSideProps({ res: { setHeader: () => undefined } } as unknown as GetServerSidePropsContext) as any;
    const out = { leaks: ["c7-internal", "c7-secret-bundle-id", "receipt", "sha256", "reasons"].filter(t => json.includes(t)), verdictKeys: Object.keys(JSON.parse(json)).sort(), propKeys: Object.keys(props.props.evidence).sort(), sampleCodes: JSON.parse(json).issueCodes };
    if (process.env.C7_R25L_OUT) writeFileSync(process.env.C7_R25L_OUT, JSON.stringify(out, null, 2));
    expect(out.leaks).toEqual([]); expect(out.propKeys).toEqual(["issueCodes", "liveActivation", "metrics", "premiumActivation", "state"]);
  });
});
