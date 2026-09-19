// @vitest-environment node
import { afterEach, describe, expect, it, vi } from "vitest";
import { fetchNhlDraftClass, fetchNhlPlayerIdentity, previewNhlDraftBatch, importNhlIdentity } from "./nhlProspectIdentity";
const pick = { draftYear: 2025, firstName: "Jacob", lastName: "Cloutier", playerName: "Jacob Cloutier", playerId: 8485689,
  birthDate: "2007-03-22", position: "RW", height: 70, weight: 171, draftedByTeamId: 52, triCode: "WPG", roundNumber: 7, pickInRound: 28, overallPickNumber: 220, amateurClubName: "Saginaw", amateurLeague: "OHL" };
const profile = { playerId: 8485689, firstName: { default: "Jacob" }, lastName: { default: "Cloutier" }, birthDate: "2007-03-22",
  position: "R", heightInCentimeters: 178, weightInKilograms: 78, currentTeamId: 52, isActive: true };
const response = (data: unknown) => ({ ok: true, json: async () => data });
afterEach(() => vi.unstubAllGlobals());
describe("official NHL prospect coverage", () => {
  it("imports draft identity and history without treating the drafting team as current membership", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => response({ total: 2, data: [pick, { playerName: "FORFEIT", lastName: "Forfeited" }] })));
    const players = await fetchNhlDraftClass(2025);
    expect(players).toHaveLength(1);
    expect(players[0]).toMatchObject({ nhlId: 8485689, fullName: "Jacob Cloutier", currentTeamId: null, position: "R", draft: { year: 2025, overall: 220, teamId: 52 } });
  });
  it("reads all draft pages and rejects repeated pages instead of silently losing players", async () => {
    const rows = Array.from({ length: 101 }, (_, i) => ({ ...pick, overallPickNumber: i + 1 }));
    const fetcher = vi.fn(async (url: string) => response({ total: rows.length, data: rows.slice(Number(new URL(url).searchParams.get("start")), Number(new URL(url).searchParams.get("start")) + 100) }));
    vi.stubGlobal("fetch", fetcher);
    expect(await fetchNhlDraftClass(2025)).toHaveLength(101);
    expect(fetcher).toHaveBeenCalledTimes(2);
    fetcher.mockImplementation(async () => response({ total: 101, data: rows.slice(0, 100) }));
    await expect(fetchNhlDraftClass(2025)).rejects.toThrow("Conflicting");
  });
  it("retains prospects without NHL IDs and compound surnames", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => response({ total: 1, data: [{ ...pick, playerId: null, firstName: "Noah", lastName: "Dower Nilsson" }] })));
    expect((await fetchNhlDraftClass(2025))[0]).toMatchObject({ nhlId: null, lastName: "Dower Nilsson" });
  });
  it("verifies exact IDs and ignores inactive profiles' historical team fields", async () => {
    const fetcher = vi.fn(async () => response({ ...profile, isActive: false }));
    vi.stubGlobal("fetch", fetcher);
    expect((await fetchNhlPlayerIdentity(8485689)).currentTeamId).toBeNull();
    fetcher.mockResolvedValue(response({ ...profile, playerId: 1234567 }));
    await expect(fetchNhlPlayerIdentity(8485689)).rejects.toThrow("did not verify");
    await expect(fetchNhlPlayerIdentity(52)).rejects.toThrow("seven-digit");
  });
  it("uses current profile evidence for a traded prospect and returns a resumable cursor", async () => {
    vi.stubGlobal("fetch", vi.fn(async (url: string) => response(url.includes("records.nhl")
      ? { total: 2, data: [pick, { ...pick, overallPickNumber: 221, playerId: 8485690 }] }
      : { ...profile, currentTeamId: 68 })));
    const report = await previewNhlDraftBatch({ year: 2025, limit: 1 });
    expect(report.nextCursor).toBe(220);
    expect(report.players[0]).toMatchObject({ currentTeamId: 68, draft: { teamId: 52 } });
  });
  it("reports unavailable profiles without inventing current membership", async () => {
    vi.stubGlobal("fetch", vi.fn(async (url: string) => { if (!url.includes("records.nhl")) throw new Error("timeout"); return response({ total: 1, data: [pick] }); }));
    const report = await previewNhlDraftBatch({ year: 2025 });
    expect(report.players[0]?.currentTeamId).toBeNull();
    expect(report.warnings).toEqual([{ nhlId: 8485689, reason: "timeout" }]);
  });
  it("propagates transactional import conflicts", async () => {
    const rpc = vi.fn(async () => ({ error: new Error("Conflicting identity") }));
    await expect(importNhlIdentity({ rpc }, { nhlId: 8485689 } as any)).rejects.toThrow("Conflicting identity");
  });
  it("queues genuine identity conflicts once so one prospect cannot block the rest of a class", async () => {
    const insert = vi.fn(async () => ({ error: null }));
    const query: any = { select: () => query, eq: () => query, in: () => query, maybeSingle: async () => ({ data: null, error: null }), insert };
    const supabase = { rpc: async () => ({ error: { code: "P0001", message: "Conflicting NHL identity mappings" } }), from: () => query };
    const result = await importNhlIdentity(supabase, { nhlId: 8485689, fullName: "Jacob Cloutier", sourceUrl: "https://api-web.nhle.com/v1/player/8485689/landing" } as any);
    expect(result.status).toBe("review");
    expect(insert).toHaveBeenCalledWith(expect.objectContaining({ review_type: "identity_conflict", dedupe_key: "nhl-prospect:8485689" }));
  });

  it("stops on rate limits instead of hammering subsequent profile batches", async () => {
    const fetcher = vi.fn(async (url: string) => url.includes("records.nhl") ? response({ total: 1, data: [pick] }) : { ok: false, status: 429 });
    vi.stubGlobal("fetch", fetcher);
    await expect(previewNhlDraftBatch({ year: 2025 })).rejects.toThrow("resume from the last completed cursor");
    expect(fetcher).toHaveBeenCalledTimes(2);
    fetcher.mockClear();
    const draftOnly = await previewNhlDraftBatch({ year: 2025, profiles: false });
    expect(draftOnly.players[0]?.currentTeamId).toBeNull();
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

});
