import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
const mocks = vi.hoisted(() => ({ flags: { observations: false, entryServing: false, carryForward: false }, read: vi.fn(), navigation: vi.fn(), reports: vi.fn(), from: vi.fn() }));
vi.mock("lib/lines/types", async (load) => ({ ...await load<object>(), lineSnapshotFlags: () => mocks.flags }));
vi.mock("lib/lines/service", () => ({ readGameLines: mocks.read, readReportGames: mocks.navigation }));
vi.mock("lib/supabase/server", () => ({ default: { from: mocks.from } }));
vi.mock("lib/sources/tweetProjectionStorage", () => ({ fetchTweetProjectionReports: mocks.reports }));
import handler from "pages/api/v1/lines/projected";
import { fixtureResponse, fixtureUnit } from "lib/lines/testFixtures";

const request = async (query: Record<string, unknown> = {}, method = "GET") => {
  const res = { code: 200, body: undefined as any, headers: {} as Record<string, string>, status(code: number) { this.code = code; return this; }, json(body: unknown) { this.body = body; return this; }, setHeader(name: string, value: string) { this.headers[name] = value; }, end() {} };
  await handler({ query, method } as any, res as any); return res;
};
beforeEach(() => { vi.clearAllMocks(); mocks.flags = { observations: true, entryServing: true, carryForward: true }; mocks.read.mockResolvedValue(fixtureResponse()); });
afterEach(() => { vi.unstubAllEnvs(); vi.useRealTimers(); });
describe("shared game/team Lines API", () => {
  it("uses one contract for team and game routes without writing on GET", async () => {
    expect((await request({ teamId: "14" })).body.mode).toBe("snapshots");
    expect(mocks.read).toHaveBeenLastCalledWith(expect.anything(), expect.objectContaining({ teamId: 14, gameId: undefined }));
    await request({ gameId: "2026010001" });
    expect(mocks.read).toHaveBeenLastCalledWith(expect.anything(), expect.objectContaining({ gameId: 2026010001, teamId: undefined }));
    expect(mocks.from).not.toHaveBeenCalled();
  });
  it.each([{ teamId: "0" }, { gameId: "-1" }, { teamId: ["14"] }, { teamId: "NaN" }, { gameId: "9007199254740992" }])("rejects invalid scope %j", async (query) => {
    expect((await request(query)).code).toBe(400); expect(mocks.read).not.toHaveBeenCalled();
  });
  it("requires a scope and preserves team participation validation", async () => {
    const missing = await request();
    expect(missing.code).toBe(400); expect(missing.body).toEqual({ error: "A teamId or gameId query parameter is required" }); expect(mocks.read).not.toHaveBeenCalled();
    mocks.read.mockResolvedValue({ ...fixtureResponse(), game: null });
    expect((await request({ teamId: "99", gameId: "2026010001" })).code).toBe(404);
  });
  it("returns an unavailable state if the snapshot store cannot be read", async () => {
    mocks.read.mockRejectedValue(new Error("migration absent"));
    expect((await request({ teamId: "14" })).code).toBe(503);
  });
  it("preserves disabled legacy publishing when entry-serving control is off", async () => {
    mocks.flags.entryServing = false;
    vi.stubEnv("TWEET_PIPELINE_INTERPRETATION_ENABLED", "false");
    expect((await request({ teamId: "14" })).body.enabled).toBe(false);
    expect(mocks.read).not.toHaveBeenCalled(); vi.unstubAllEnvs();
  });
  it("accepts only GET", async () => { expect((await request({ teamId: "14" }, "POST")).code).toBe(405); });
});

describe("legacy team report recency", () => {
  beforeEach(() => {
    mocks.flags.entryServing = false;
    vi.stubEnv("TWEET_PIPELINE_INTERPRETATION_ENABLED", "true");
    vi.stubEnv("TWEET_PIPELINE_PUBLISHING_ENABLED", "true");
    vi.useFakeTimers(); vi.setSystemTime(new Date("2026-11-12T23:00:00Z"));
    mocks.reports.mockReset(); mocks.from.mockReset();
  });
  const query = (data: unknown, error: unknown = null) => {
    const chain: any = {};
    for (const method of ["select", "eq", "gte", "lt", "order", "limit"]) chain[method] = vi.fn(() => chain);
    chain.maybeSingle = vi.fn().mockResolvedValue({ data, error });
    mocks.from.mockReturnValue(chain); return chain;
  };
  it("uses the latest retained day within seven prior days when today has no reports", async () => {
    const chain = query({ report_date: "2026-11-11" });
    const retained = { key: "older-report", publishedAt: null, text: "Retained source text" };
    mocks.reports.mockResolvedValueOnce([]).mockResolvedValueOnce([retained]);
    const result = await request({ teamId: "54" });
    expect(result.code).toBe(200);
    expect(result.body.reportScope).toEqual({ requestedDate: "2026-11-12", reportDate: "2026-11-11", fallback: true });
    expect(result.body.reports).toEqual([retained]);
    expect(chain.eq).toHaveBeenCalledWith("team_id", 54);
    expect(chain.gte).toHaveBeenCalledWith("report_date", "2026-11-05");
    expect(chain.lt).toHaveBeenCalledWith("report_date", "2026-11-12");
    expect(chain.limit).toHaveBeenCalledWith(1);
    expect(mocks.reports).toHaveBeenLastCalledWith(expect.anything(), { teamId: 54, date: "2026-11-11" });
  });
  it("keeps today's reports and avoids the fallback query, using Eastern today", async () => {
    vi.setSystemTime(new Date("2026-11-13T04:30:00Z"));
    const current = { key: "current-report", publishedAt: null };
    mocks.reports.mockResolvedValue([current]);
    const result = await request({ teamId: "54" });
    expect(result.body.reports).toEqual([current]);
    expect(result.body.reportScope).toEqual({ requestedDate: "2026-11-12", reportDate: "2026-11-12", fallback: false });
    expect(mocks.from).not.toHaveBeenCalled();
  });
  it("preserves a complete unbound report in the source rail without selecting its units for the matchup", async () => {
    const date = "2026-11-12";
    const game = { id: 2026020296, date, awayAbbreviation: "VGK", homeAbbreviation: "BUF" };
    mocks.navigation.mockResolvedValue({ selectedGameId: game.id, games: [game] });
    const report = { teamId: 54, key: "unbound", date, gameId: null, publishedAt: date + "T20:00:00Z",
      interpretation: { units: [fixtureUnit(["A","B","C","D","E"], "pp", 1), fixtureUnit(["F","G","H","I","J"], "pp", 2)] } };
    mocks.reports.mockResolvedValue([report]);
    const result = await request({ teamId: "54", view: "game" });
    expect(result.body).toMatchObject({ reports: [report], sets: [], navigation: { selectedGameId: game.id } });
    // Existing publication-date clients may still inspect the report's unbound practice units.
    expect((await request({ teamId: "54" })).body.sets).toHaveLength(1);
    expect(mocks.navigation).toHaveBeenCalledTimes(1);
  });
  it("retains both captured Saturday injury texts without assigning either to Anaheim or its Sunday game", async () => {
    const captured = JSON.parse(readFileSync(resolve(process.cwd(), "../tasks/artifacts/same-day-news-lines-2026-11-18/ANA-RELEASE-REPORTS.json"), "utf8"));
    mocks.navigation.mockResolvedValue({ selectedGameId: captured.game.id, games: [captured.game] });
    mocks.reports.mockResolvedValue(captured.reports);
    const { body } = await request({ teamId: "24", gameId: String(captured.game.id), view: "game" });
    expect(body.reports).toHaveLength(5);
    for (const prefix of ["72878a3ccb14", "ab60867ee60e"]) {
      const original = captured.reports.find((report: { key: string }) => report.key.startsWith(prefix));
      const shown = body.reports.find((report: { key: string }) => report.key === original.key);
      expect(shown).toMatchObject({ text: original.text, publishedAt: original.publishedAt, receivedAt: original.receivedAt,
        teamId: null, teamAbbreviation: null, gameId: null, interpretation: { context: "unknown", units: [], events: [] } });
      expect(shown.reportedStarter).toBeUndefined();
    }
    for (const key of ["18dac0d07888", "051d74f381be", "beebfe3e177c"]) {
      expect(body.reports.find((r: { key: string }) => r.key.startsWith(key))).toMatchObject({ teamId: 24, gameId: captured.game.id });
    }
    expect(body.reports.find((r: { key: string }) => r.key.startsWith("18dac0d07888")).interpretation.units).toHaveLength(7);
    expect(body.sets).toEqual([]); // The captured lineup has an incomplete forward unit.
    expect(captured.reports[3].gameId).toBe(captured.game.id);
  });

  const captured = { ...JSON.parse(readFileSync(resolve(process.cwd(), "../tasks/artifacts/same-day-news-lines-2026-11-18/BUF-VGK-REPORT-ROWS.json"), "utf8"))[1].payload,
    verifiedOriginalAuthor: "ByMHarrington" };
  const matchup = { id: captured.gameId, date: captured.date, awayTeamId: 54, homeTeamId: 7, awayAbbreviation: "VGK", homeAbbreviation: "BUF" };
  it.each([
    ["opposite side", (r: any) => { r.interpretation.events[0].teamId = 7; }],
    ["unbound", (r: any) => { r.gameId = null; }],
    ["different game date", (r: any) => { r.date = "2026-11-09"; }],
    ["prior game", (r: any) => { r.gameId--; }],
    ["backup", (r: any) => { r.interpretation.events[0].goalieRole = "backup"; }],
    ["listed pair", (r: any) => { r.interpretation.units = [{ ...fixtureUnit(["Ellis", "Hill"], "goalie", 1), listing: "pipe_pair" }]; }],
    ["observational", (r: any) => { r.interpretation.events[0].observation = "first_off"; }],
    ["practice context", (r: any) => { r.interpretation.context = "practice"; }],
    ["historical wording", (r: any) => { r.text = "Yesterday: " + r.text; }],
    ["another named weekday", (r: any) => { r.text = "Adin Hill starts Thursday vs Buffalo Sabres"; r.interpretation.events[0].evidence.text = r.text; }],
    ["conflicting review", (r: any) => { r.interpretation.events[0].reviewReason = "conflicting_claims"; }],
    ["two starters on one side", (r: any) => { r.interpretation.events.push({ ...r.interpretation.events[0], playerId: 1, playerName: "Other Goalie" }); }],
    ["mismatched original clock", (r: any) => { r.originalPublishedAt = r.receivedAt; }],
    ["relay byline", (r: any) => { r.originalUrl = r.originalUrl.replace("ByMHarrington", "GameDayGoalies"); }],
    ["pending original", (r: any) => { delete r.verifiedOriginalAuthor; }],
    ["event for another day", (r: any) => { r.interpretation.events[0].effectiveDate = "2026-11-09"; }],
    ["unverified evidence", (r: any) => { r.interpretation.events[0].evidence.text = "Hill was named the starter."; }],
  ] as const)("preserves source wording without a starter label for %s", async (_reason, edit) => {
    const report = structuredClone(captured);
    edit(report);
    mocks.navigation.mockResolvedValue({ selectedGameId: matchup.id, games: [matchup] });
    mocks.reports.mockResolvedValue([report]);
    const result = await request({ teamId: "54", gameId: String(matchup.id), view: "game" });
    expect(result.body.reports[0].text).toBe(report.text);
    expect(result.body.reports[0].reportedStarter).toBeUndefined();
  });
  it("attributes a written projection to its reporter and derives the side from the event independently of name order", async () => {
    const report = structuredClone(captured);
    report.text = "Adin Hill expected to start vs Colten Ellis tonight. #VGK #Sabres";
    Object.assign(report.interpretation.events[0], { state: "projected", modality: "tentative",
      evidence: { start: 0, end: 27, text: "Adin Hill expected to start" } });
    mocks.navigation.mockResolvedValue({ selectedGameId: matchup.id, games: [matchup] });
    mocks.reports.mockResolvedValue([report]);
    const result = await request({ teamId: "54", gameId: String(matchup.id), view: "game" });
    expect(result.body.reports[0].reportedStarter).toEqual({ status: "projected", author: "ByMHarrington",
      playerId: 8478499, playerName: "Adin Hill", teamAbbreviation: "VGK" });
  });
  it("does not broaden an exact game's empty report result", async () => {
    query({ date: "2026-11-11" }); mocks.reports.mockResolvedValue([]);
    const result = await request({ teamId: "54", gameId: "2026020296" });
    expect(result.body.reportScope.fallback).toBe(false);
    expect(mocks.reports).toHaveBeenCalledTimes(1);
    expect(mocks.from).toHaveBeenCalledTimes(1);
    expect(mocks.from).toHaveBeenCalledWith("games");
  });
  it.each([null, { report_date: "2026-10-01" }, { report_date: "2026-11-13" }])("keeps empty state without a recent retained date: %j", async (data) => {
    query(data); mocks.reports.mockResolvedValue([]);
    const result = await request({ teamId: "54" });
    expect(result.body.reportScope.fallback).toBe(false);
    expect(mocks.reports).toHaveBeenCalledTimes(1);
  });
  it("reports a store failure rather than pretending there are no posts", async () => {
    query(null, new Error("unavailable")); mocks.reports.mockResolvedValue([]);
    expect((await request({ teamId: "54" })).code).toBe(503);
  });
});
