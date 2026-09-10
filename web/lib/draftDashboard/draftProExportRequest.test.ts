import { describe, expect, it, vi } from "vitest";
import { requestDraftProExport } from "./draftProExportRequest";

const payload = { season: "20262027", leagueType: "points" as const, sourceWeights: { source: 1 }, scoring: { G: 3 }, goalieScoring: { W: 4 }, adjustments: { prorate84: true }, rows: [{ playerId: 1, fullName: "Alex" }] };

describe("Draft Pro export client request", () => {
  it.each(["lineupexperts_skaters", "lineupexperts_goalies"])("blocks %s blends before sending any rows", async (source) => {
    const fetcher = vi.fn();
    const result = await requestDraftProExport({ hasPrivateImport: false, canUseProExport: true, token: "token", payload: { ...payload, sourceWeights: { source: 1, [source]: 0 } }, fetcher });
    expect(fetcher).not.toHaveBeenCalled();
    expect(result.message).toMatch(/retired LineupExperts source/);
  });

  it("never sends an unsaved private import", async () => {
    const fetcher = vi.fn();
    const result = await requestDraftProExport({ hasPrivateImport: true, canUseProExport: true, token: "token", payload, fetcher });
    expect(fetcher).not.toHaveBeenCalled();
    expect(result.message).toMatch(/Save your private CSV/);
  });

  it("explains denied access and sends the schema payload when eligible", async () => {
    const fetcher = vi.fn().mockResolvedValue({ ok: true });
    expect((await requestDraftProExport({ hasPrivateImport: false, canUseProExport: false, token: "token", payload, fetcher })).message).toMatch(/Draft Pro/);
    await requestDraftProExport({ hasPrivateImport: false, canUseProExport: true, token: "token", payload, fetcher });
    expect(JSON.parse(fetcher.mock.calls[0][1].body)).toEqual(payload);
  });
});
