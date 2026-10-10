// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  from: vi.fn(),
  range: vi.fn(),
  upsert: vi.fn(),
  auditInsert: vi.fn(),
  fetchSeason: vi.fn(),
  fetchNst: vi.fn(),
}));

vi.mock("@supabase/supabase-js", () => ({
  createClient: () => ({
    from: mocks.from,
  }),
}));
vi.mock("lib/supabase/server", () => ({
  default: { from: () => ({ insert: mocks.auditInsert }) },
}));
vi.mock("dotenv", () => ({ default: { config: vi.fn() } }));
vi.mock("utils/adminOnlyMiddleware", () => ({ default: (handler: unknown) => handler }));
vi.mock("utils/fetchCurrentSeason", () => ({ fetchCurrentSeason: mocks.fetchSeason }));
vi.mock("lib/nst/client", () => ({
  fetchNstTextByUrl: mocks.fetchNst,
  isNstAuthError: () => false,
  isNstRateLimitError: () => false,
}));
vi.mock("lib/cron/nstBurstPlans", () => ({
  resolveNstCurrentSeasonRequestPlan: () => ({ requestIntervalMs: 0 }),
}));
vi.mock("lib/player-forecasts/sourceSnapshot", () => ({
  capturePlayerForecastSourceObservation: vi.fn(),
}));

import handler from "pages/api/v1/db/update-nst-current-season";

const html = `<table><thead><tr><th>Player</th><th>Team</th><th>Position</th><th>GP</th></tr></thead>
  <tbody><tr><td>Test Skater</td><td>TOR</td><td>C</td><td>3</td></tr></tbody></table>`;

async function invoke() {
  const res = {
    statusCode: 200,
    body: undefined as any,
    status(code: number) { this.statusCode = code; return this; },
    json(body: any) { this.body = body; return this; },
  };
  const pending = handler({ method: "GET", url: "/api/v1/db/update-nst-current-season" } as any, res as any);
  await vi.runAllTimersAsync();
  await pending;
  return res;
}

describe("NST current-season truthful outcomes", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.useFakeTimers();
    vi.spyOn(console, "log").mockImplementation(() => {});
    vi.spyOn(console, "warn").mockImplementation(() => {});
    vi.spyOn(console, "error").mockImplementation(() => {});
    mocks.from.mockImplementation(() => ({ select: () => ({ range: mocks.range }), upsert: mocks.upsert }));
    mocks.range.mockResolvedValue({ data: [{ player_name: "Test Skater", player_id: 123 }], count: 1, error: null });
    mocks.upsert.mockResolvedValue({ count: 1, error: null });
    mocks.auditInsert.mockResolvedValue({ error: null });
    mocks.fetchSeason.mockResolvedValue({ id: 20262027 });
    mocks.fetchNst.mockResolvedValue({ text: html });
  });

  afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); });

  it("reports an exhausted NST fetch failure as HTTP and audit failure", async () => {
    mocks.fetchNst.mockRejectedValue(new Error("NST fetch failed"));
    const res = await invoke();
    expect(res.statusCode).toBe(500);
    expect(res.body).toMatchObject({ success: false, outcome: "failed", rowsUpserted: null, failedStage: "nst_seasonal_individual_counts:fetch_parse" });
    expect(mocks.fetchNst).toHaveBeenCalledTimes(3);
    expect(mocks.upsert).not.toHaveBeenCalled();
    expect(mocks.auditInsert).toHaveBeenCalledWith(expect.objectContaining({ status: "failure", rows_affected: null }));
  });

  it("reports an upsert error as HTTP and audit failure, retaining prior report progress", async () => {
    mocks.upsert.mockResolvedValueOnce({ count: 1, error: null }).mockResolvedValue({ error: { message: "write rejected" } });
    const res = await invoke();
    expect(res.statusCode).toBe(500);
    expect(res.body).toMatchObject({ success: false, outcome: "failed", reportsWritten: 1, rowsUpserted: null, failedStage: "nst_seasonal_individual_rates:upsert" });
    expect(mocks.auditInsert).toHaveBeenCalledWith(expect.objectContaining({ status: "failure" }));
  });

  it("preserves the four seasonal writes and reports exact returned counts", async () => {
    const res = await invoke();
    expect(res.statusCode).toBe(200);
    expect(res.body).toMatchObject({ success: true, outcome: "writes_confirmed", reportsWritten: 4, emptyOrUnresolvedReports: 0, rowsUpserted: 4, sourceCoverage: "not_verified" });
    expect(mocks.upsert).toHaveBeenCalledTimes(4);
    expect(mocks.from.mock.calls.map(([table]) => table)).toEqual([
      "view_active_player_ids_max_season",
      "nst_seasonal_individual_counts",
      "nst_seasonal_individual_rates",
      "nst_seasonal_on_ice_counts",
      "nst_seasonal_on_ice_rates",
    ]);
    expect(mocks.upsert).toHaveBeenCalledWith([expect.objectContaining({ player_id: 123, team: "TOR", season: 20262027, strength: "all", gp: 3 })], { onConflict: "player_id, season, team, strength", count: "exact" });
    expect(mocks.auditInsert).toHaveBeenCalledWith(expect.objectContaining({ status: "success", rows_affected: 4 }));
  });

  it("keeps a missing database count unknown instead of substituting input length", async () => {
    mocks.upsert.mockResolvedValue({ error: null, count: null });
    const res = await invoke();
    expect(res.statusCode).toBe(200);
    expect(res.body).toMatchObject({ success: true, reportsWritten: 4, rowsUpserted: null });
    expect(mocks.auditInsert).toHaveBeenCalledWith(expect.objectContaining({ rows_affected: null }));
  });

  it.each([
    ["empty table", html.replace(/<tr><td>Test Skater[\s\S]*?<\/tr>/, "")],
    ["unresolved player", html.replace("Test Skater", "Unknown Skater")],
  ])("does not call %s a successful write", async (_label, text) => {
    mocks.fetchNst.mockResolvedValue({ text });
    const res = await invoke();
    expect(res.statusCode).toBe(422);
    expect(res.body).toMatchObject({ success: false, outcome: "empty_or_unresolved", reportsWritten: 0, emptyOrUnresolvedReports: 4, rowsUpserted: 0 });
    expect(mocks.upsert).not.toHaveBeenCalled();
    expect(mocks.auditInsert).toHaveBeenCalledWith(expect.objectContaining({ status: "failure" }));
  });

  it("reports a missing player map as unresolved rather than success", async () => {
    mocks.range.mockResolvedValue({ data: [], count: 0, error: null });
    const res = await invoke();
    expect(res.statusCode).toBe(422);
    expect(res.body).toMatchObject({ success: false, outcome: "empty_or_unresolved", reportsWritten: 0, rowsUpserted: 0 });
    expect(mocks.fetchNst).not.toHaveBeenCalled();
  });

  it.each(["", "<html>Source unavailable</html>"])("reports an unusable NST response as failure", async (text) => {
    mocks.fetchNst.mockResolvedValue({ text });
    const res = await invoke();
    expect(res.statusCode).toBe(500);
    expect(res.body).toMatchObject({ success: false, outcome: "failed", rowsUpserted: null });
    expect(mocks.fetchNst).toHaveBeenCalledTimes(3);
    expect(mocks.upsert).not.toHaveBeenCalled();
    expect(mocks.auditInsert).toHaveBeenCalledWith(expect.objectContaining({ status: "failure" }));
  });
});
