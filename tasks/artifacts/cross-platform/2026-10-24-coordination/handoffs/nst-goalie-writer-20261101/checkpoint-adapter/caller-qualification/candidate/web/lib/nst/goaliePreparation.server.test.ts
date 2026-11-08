import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { GOALIE_FINALITY_VERSION, prepareGoalieCatchup, validateGoalieFinalScore } from "./goaliePreparation.server";

const NOW = Date.parse("2026-11-01T08:30:00Z");
function score(date = "2026-10-31") {
  return { currentDate: date, games: [{ id: 2026020031, season: 20262027, gameType: 2, gameDate: date,
    gameState: "OFF", homeTeam: { id: 1 }, awayTeam: { id: 2 } }] };
}
function fixture() {
  const context: Record<string, any> = { version: 1, enabled: true, reviewRequired: false, activeScope: null, jobId: null,
    season: { id: 20262027, startDate: "2026-10-07", regularSeasonEndDate: "2027-04-15" },
    sourceVersion: GOALIE_FINALITY_VERSION, startDate: "2026-10-31", endDate: "2026-10-31" };
  const rpc = vi.fn(async (name: string, args: Record<string, any>) => name === "nst_goalie_preparation_state_v1"
    ? { data: structuredClone(context), error: null }
    : { data: { status: "ensured", scope: args.p_manifest.scope, plannedRequestCount: args.p_manifest.plannedRequestCount,
      jobId: args.p_manifest.plannedRequestCount ? "00000000-0000-4000-8000-000000000001" : null }, error: null });
  const source = vi.fn(async (date: string, _signal: AbortSignal) => score(date));
  return { context, rpc, source, run: () => prepareGoalieCatchup({ client: { rpc }, scoreSource: source, now: Date.now, deadlineAt: NOW + 180_000 }) };
}

describe("bounded goalie finality and cohort preparation", () => {
  beforeEach(() => { vi.useFakeTimers(); vi.setSystemTime(NOW); });
  afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });
  it("captures official finality and enqueues one immutable ten-dataset cohort in one write RPC", async () => {
    const f = fixture(); const result = await f.run();
    expect(result).toMatchObject({ status: "prepared", sourceRequests: 1, requiresReview: false });
    expect(f.rpc).toHaveBeenCalledTimes(2);
    const [name, args] = f.rpc.mock.calls[1];
    expect(name).toBe("nst_goalie_prepare_cohort_v1");
    expect(args.p_manifest).toMatchObject({ startDate: "2026-10-31", endDate: "2026-10-31", plannedRequestCount: 10 });
    expect(args.p_observations[0]).toMatchObject({ date: "2026-10-31", sourceUrl: "https://api-web.nhle.com/v1/score/2026-10-31" });
    expect(args.p_observations[0].fingerprint).toMatch(/^[a-f0-9]{64}$/);
  });
  it.each(["disabled", "review", "existing", "not_due"])("does not fetch when %s", async kind => {
    const f = fixture();
    if (kind === "disabled") f.context.enabled = false;
    if (kind === "review") f.context.reviewRequired = true;
    if (kind === "existing") Object.assign(f.context, { activeScope: "a".repeat(64), jobId: "00000000-0000-4000-8000-000000000001" });
    if (kind === "not_due") f.context.startDate = null;
    expect((await f.run()).status).toBe(kind === "review" ? "held" : kind);
    expect(f.source).not.toHaveBeenCalled(); expect(f.rpc).toHaveBeenCalledTimes(1);
  });
  it("distinguishes an explicitly empty official slate from absent or unfinished data", async () => {
    const f = fixture(); f.source.mockResolvedValue({ currentDate: "2026-10-31", games: [] });
    expect(await f.run()).toMatchObject({ status: "prepared", jobId: null });
    expect(f.rpc.mock.calls[1][1].p_manifest.units.every((u: any) => u.state === "no_games")).toBe(true);
    expect(() => validateGoalieFinalScore({ games: [] }, 20262027, "2026-10-31")).toThrow();
    for (const state of ["FINAL", "LIVE", "FUT", "PPD", undefined]) {
      const payload = score(); payload.games[0].gameState = state as any;
      expect(() => validateGoalieFinalScore(payload, 20262027, "2026-10-31")).toThrow();
    }
  });
  it("rejects duplicate identities and wrong season/date before persistence", async () => {
    for (const change of ["duplicate", "season", "date"]) {
      const f = fixture(); const payload = score();
      if (change === "duplicate") payload.games.push(payload.games[0]);
      if (change === "season") payload.games[0].season = 20252026;
      if (change === "date") payload.currentDate = "2026-10-30";
      f.source.mockResolvedValue(payload);
      expect(await f.run()).toMatchObject({ status: "unavailable", requiresReview: false });
      expect(f.rpc).toHaveBeenCalledTimes(1);
    }
  });
  it("bounds the date aperture and aborts a hanging source without a write", async () => {
    const tooWide = fixture(); tooWide.context.startDate = "2026-10-01";
    expect((await tooWide.run()).status).toBe("unavailable"); expect(tooWide.source).not.toHaveBeenCalled();
    const f = fixture(); f.source.mockImplementation(async () => new Promise(() => {}));
    const pending = f.run(); await vi.runAllTimersAsync();
    expect((await pending).status).toBe("unavailable"); expect(Date.now() - NOW).toBe(5_000);
    expect(f.source.mock.calls[0][1].aborted).toBe(true); expect(f.rpc).toHaveBeenCalledTimes(1);
  });
  it("captures only the fixed HTTPS score endpoint and bounds the actual response body", async () => {
    const f = fixture(); const fetch = vi.fn(async (_url: unknown, _init?: RequestInit) => new Response(JSON.stringify(score())));
    vi.stubGlobal("fetch", fetch);
    expect((await prepareGoalieCatchup({ client: { rpc: f.rpc }, deadlineAt: NOW + 180000 })).status).toBe("prepared");
    expect(fetch).toHaveBeenCalledWith("https://api-web.nhle.com/v1/score/2026-10-31", expect.objectContaining({ redirect: "error", cache: "no-store" }));
    const oversized = fixture(); fetch.mockResolvedValueOnce(new Response(" ".repeat(1048577)));
    expect((await prepareGoalieCatchup({ client: { rpc: oversized.rpc }, deadlineAt: NOW + 180000 })).status).toBe("unavailable");
    expect(oversized.rpc).toHaveBeenCalledTimes(1);
  });
  it("does not partially persist when a later day is unknown, and never retries uncertain writes", async () => {
    const partial = fixture(); partial.context.startDate = "2026-10-30";
    partial.source.mockResolvedValueOnce(score("2026-10-30")).mockRejectedValueOnce(new Error("source missing"));
    expect((await partial.run()).status).toBe("unavailable"); expect(partial.rpc).toHaveBeenCalledTimes(1);
    const f = fixture(); f.rpc.mockImplementation(async name => {
      if (name === "nst_goalie_preparation_state_v1") return { data: f.context, error: null };
      throw new Error("acknowledgement lost");
    });
    expect(await f.run()).toMatchObject({ status: "held", requiresReview: true }); expect(f.rpc).toHaveBeenCalledTimes(2);
  });
});
