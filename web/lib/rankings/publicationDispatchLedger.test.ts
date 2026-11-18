import { afterEach, expect, it, vi } from "vitest";
import { claimRankingDispatch, latestRankingPublicationCutoff, recordRankingDispatch, withManualRankingDispatch } from "./publicationDispatchLedger";

const args = { mode: "manual_rankings", season: 20262027, strength: "5v5", touchesPublishedScope: true, dates: ["2026-11-14","2026-11-15"] } as const;
const claim = { outcome: "claimed", id: "owner", priorCutoff: "2026-11-13" };
const result = { marked: true, complete: true, rowsUpserted: 4, dbWrittenRows: 4 };
afterEach(() => vi.unstubAllEnvs());

it("acquires by season and D; readiness and events are recorded afterwards", async () => {
  const rpc = vi.fn().mockResolvedValueOnce({data:claim,error:null}).mockResolvedValueOnce({data:null,error:null});
  expect(await claimRankingDispatch({rpc} as any,{season:20262027,date:"2026-11-16"})).toEqual(claim);
  await recordRankingDispatch({rpc} as any, { id:"owner",stage:"ready",status:"running",
    evidence:{readyAt:"2026-11-17T10:00:00Z",sourceDigest:"abcd",cohortCount:775} });
  expect(rpc.mock.calls[0][1]).toMatchObject({p_mode:"scheduled",p_protect:true,p_date:"2026-11-16"});
  expect(rpc.mock.calls[1][1]).toMatchObject({p_id:"owner",p_evidence:{cohortCount:775}});
});

it("issues an independently bounded serve-date lookup", async () => {
  const rpc=vi.fn().mockResolvedValue({data:"2026-11-14",error:null});
  expect(await latestRankingPublicationCutoff({rpc} as any,20262027,"2026-11-15")).toBe("2026-11-14");
  expect(rpc).toHaveBeenCalledWith("latest_ranking_publication_cutoff",{p_season:20262027,p_through:"2026-11-15"});
});

it.each([["off",false],["daily",true],["2026-11-16",true]])(
  "uses one lock with the %s cadence and checks every actual candidate date", async (setting,protect) => {
    vi.stubEnv("RANKINGS_DAILY_PUBLICATION",String(setting));
    const rpc=vi.fn().mockResolvedValueOnce({data:claim,error:null}).mockResolvedValueOnce({data:null,error:null});
    const publish=vi.fn().mockResolvedValue(result);
    await withManualRankingDispatch({rpc} as any,{...args,dates:[...args.dates]},publish);
    expect(rpc.mock.calls[0][1]).toMatchObject({p_mode:"manual_rankings",p_protect:protect,p_write_dates:args.dates});
    expect(rpc.mock.calls[1][1]).toMatchObject({p_status:"complete",p_id:"owner"});
  },
);

it("holds a lost-response write for reconciliation",async () => {
  const rpc=vi.fn().mockResolvedValueOnce({data:claim,error:null}).mockResolvedValueOnce({data:null,error:null});
  await expect(withManualRankingDispatch({rpc} as any,{...args,dates:[...args.dates]},
    async () => { throw new Error("response lost"); })).rejects.toThrow("response lost");
  expect(rpc.mock.calls[1][1]).toMatchObject({p_status:"ambiguous",p_reason:"response lost"});
});

it("does not publish when the claim RPC fails", async () => {
  const rpc=vi.fn().mockResolvedValue({data:null,error:{message:"unavailable"}});
  const publish=vi.fn();
  await expect(withManualRankingDispatch({rpc} as any,{...args,dates:[...args.dates]},publish)).rejects.toThrow("unavailable");
  expect(publish).not.toHaveBeenCalled();
});

it("serializes non-overlapping manual scopes without protecting their own independent keys", async () => {
  vi.stubEnv("RANKINGS_DAILY_PUBLICATION","daily");
  const rpc=vi.fn().mockResolvedValueOnce({data:claim,error:null}).mockResolvedValueOnce({data:null,error:null});
  await withManualRankingDispatch({rpc} as any,{...args,touchesPublishedScope:false,dates:[...args.dates]},async ()=>result);
  expect(rpc.mock.calls[0][1]).toMatchObject({p_mode:"manual_rankings",p_protect:false});
});
