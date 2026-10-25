import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { buildScheduleSnapshot, calendarWeekStart, selectScheduleDates, weekDates } from "./schedule";
import { assertExportable } from "./export";
import type { SocialScheduleGame as GameData, SocialScheduleData as ScheduleData } from "./types";
const upstream = vi.hoisted(() => ({ getSchedule: vi.fn() }));
vi.mock("lib/NHL/server", () => upstream);
// The edition boundary is exercised with an authenticated editor; no Auth or DB calls leave this test.
vi.mock("lib/supabase", () => ({ createClientWithToken: () => ({
  auth: { getUser: async () => ({ data: { user: { id: "social-editor" } }, error: null }) },
  from: () => ({ select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: { role: "social_editor" }, error: null }) }) }) }),
}) }));
import { SOCIAL_SHARE_CACHE_CONTROL } from "./access";
// Never a Supabase read in unit tests: opponent rates come only from this mock.
const opponentSource = vi.hoisted(() => ({ loadShareTeamRates: vi.fn(() => Promise.reject(new Error("offline"))) }));
vi.mock("lib/socialShare/teamRates", () => opponentSource);
// Player sources come only from this mock (no Supabase read in unit tests).
const playerSource = vi.hoisted(() => ({
  loadSharePlayerSources: vi.fn((..._args: unknown[]) => Promise.reject(new Error("offline")) as Promise<unknown>),
  loadSharePlayerRecent: vi.fn((..._args: unknown[]) => Promise.reject(new Error("offline")) as Promise<unknown>),
  RECENT_LIMITS: { lookbackDays: 21, skaterRowsPerPlayer: 14, goalieRowsPerPlayer: 14 },
}));
vi.mock("lib/socialShare/playerSources", () => playerSource);
import { fictionalLeagueWeek, fictionalTeamStats } from "./fixtures";
import { fictionalPlayerSources } from "./pickupsFixture";
import { buildPlayerLayer, pickupTiers, specialists } from "./players";
import { RANK_POOL_MAX, streamingTiers, TRIMMED_PLAYERS_MAX } from "./tiers";
import { shareCacheControl, SHARE_CACHE_EXPIRY_MARGIN_SECONDS } from "./server";
import handler from "pages/api/v1/social-share/[format]";
import type { NextApiRequest, NextApiResponse } from "next";
const weekStart = "2026-01-05", now = "2026-01-05T12:00:00Z", dates = weekDates(weekStart);
function game(id = 2025020001, date = dates[0], overrides: Partial<GameData> = {}): GameData {
  return { id, season: 20252026, gameType: 2, gameDate: date, startTimeUTC: `${date}T23:00:00Z`, gameState: "FUT", gameScheduleState: "OK", homeTeam: { id: 1, abbrev: "NJD" }, awayTeam: { id: 2, abbrev: "NYI" }, ...overrides };
}
function snapshot(games: GameData[] = [], overrides: Partial<ScheduleData> = {}, format: "game-grid" | "remaining-week" = "game-grid") {
  return buildScheduleSnapshot({ format, weekStart, generatedAt: now, schedule: { data: {}, numGamesPerDay: dates.map(date => new Set(games.filter(game => game.gameDate === date).map(game => game.id)).size), coveredDates: dates, fetchedAt: now, games, ...overrides } });
}
describe("schedule share calendar", () => {
  it("rejects years 0000–0999 with the clean as-of error and keeps the year-1000 boundary (REL-SS1-LOW-YEAR-R1)", () => {
    for (const low of ["0000-01-03", "0001-01-01", "0099-01-05", "0999-01-07", "0999-12-31"]) {
      expect(() => calendarWeekStart(`${low}T16:00:00Z`)).toThrow(new Error("Invalid as-of timestamp."));
    }
    // 1000-01-01 is a Wednesday whose Monday falls in 0999; the first Monday of year 1000 is 1000-01-06.
    expect(calendarWeekStart("1000-01-01T16:00:00Z")).toBe("0999-12-30");
    expect(calendarWeekStart("1000-01-06T16:00:00Z")).toBe("1000-01-06");
    expect(calendarWeekStart("1000-01-07T16:00:00Z")).toBe("1000-01-06");
    expect(calendarWeekStart("9999-12-31T16:00:00Z")).toBe("9999-12-27");
  });
  it("uses New York Monday boundaries across DST and year changes", () => {
    expect(calendarWeekStart("2026-03-09T03:59:00Z")).toBe("2026-03-02");
    expect(calendarWeekStart("2026-03-09T04:00:00Z")).toBe("2026-03-09");
    expect(calendarWeekStart("2026-11-02T04:59:00Z")).toBe("2026-10-26");
    expect(calendarWeekStart("2026-11-02T05:00:00Z")).toBe("2026-11-02");
    expect(weekDates("2026-12-28")[6]).toBe("2027-01-03");
  });
  it("rejects normalized, duplicate and out-of-week dates", () => {
    expect(() => weekDates("2026-02-30")).toThrow();
    expect(() => weekDates("2026-01-06")).toThrow();
    for (const selected of [[dates[0], dates[0]], ["2026-01-12"], ["2026-02-30"]]) expect(() => selectScheduleDates(snapshot(), selected)).toThrow();
  });
});
describe("schedule-only edition", () => {
  it("rejects impossible calendar components before game and provenance timestamp normalization", () => {
    const marchWeek = "2026-03-02", checkedAt = "2026-03-02T12:00:00Z";
    const schedule = { data: {}, numGamesPerDay: [1, 0, 0, 0, 0, 0, 0], coveredDates: weekDates(marchWeek), fetchedAt: checkedAt, games: [game(1, marchWeek)] };
    const edition = (overrides: Partial<ScheduleData> = {}) => buildScheduleSnapshot({ format: "game-grid", weekStart: marchWeek, generatedAt: checkedAt, schedule: { ...schedule, ...overrides } });
    const invalidGame = edition({ games: [game(1, marchWeek, { startTimeUTC: "2026-02-30T23:00:00Z" })] });
    expect(invalidGame.state).toBe("partial");
    expect(invalidGame.games).toEqual([]);
    expect(invalidGame.rows.every(row => row.remainingGames === 0)).toBe(true);
    expect(() => assertExportable(invalidGame)).toThrow("complete, fresh schedule");
    const invalidFetch = edition({ fetchedAt: "2026-02-30T12:00:00Z" });
    expect(invalidFetch.state).toBe("missing");
    expect(invalidFetch.source.fetchedAt).toBeNull();
    const invalidUpdate = edition({ updatedAt: "2026-02-30T12:00:00Z" });
    expect(invalidUpdate.state).toBe("partial");
    expect(invalidUpdate.source.updatedAt).toBeNull();
    expect(() => assertExportable(invalidUpdate)).toThrow("complete, fresh schedule");
    expect(() => buildScheduleSnapshot({ format: "game-grid", weekStart: marchWeek, generatedAt: "2026-02-30T12:00:00Z", schedule })).toThrow("Invalid generatedAt timestamp");
  });
  it.each([
    { week: "2026-01-05", date: "2026-01-05", start: "2026-01-05T18:00:00-05:00", normalized: "2026-01-05T23:00:00.000Z", season: 20252026 },
    { week: "2026-01-05", date: "2026-01-05", start: "2026-01-06T08:00:00+09:00", normalized: "2026-01-05T23:00:00.000Z", season: 20252026 },
    { week: "2024-02-26", date: "2024-02-29", start: "2024-02-29T18:00:00-05:00", normalized: "2024-02-29T23:00:00.000Z", season: 20232024 },
    { week: "2024-02-26", date: "2024-02-29", start: "2024-03-01T08:00:00+09:00", normalized: "2024-02-29T23:00:00.000Z", season: 20232024 },
    { week: "2028-02-28", date: "2028-02-29", start: "2028-02-29T23:00:00Z", normalized: "2028-02-29T23:00:00.000Z", season: 20272028 },
  ])("preserves valid offsets and leap dates for $start", ({ week, date, start, normalized, season }) => {
    const checkedAt = `${week}T12:00:00Z`;
    const clock = vi.spyOn(Date, "now").mockReturnValue(Date.parse(checkedAt));
    try {
      const source = { data: {}, numGamesPerDay: weekDates(week).map(day => day === date ? 1 : 0), coveredDates: weekDates(week), fetchedAt: checkedAt, games: [game(1, date, { startTimeUTC: start, season })] };
      const result = buildScheduleSnapshot({ format: "game-grid", weekStart: week, generatedAt: checkedAt, schedule: source });
      expect(result.state).toBe("ready");
      expect(result.games[0].startTimeUtc).toBe(normalized);
      expect(result.rows[0].remainingGames).toBe(1);
      expect(() => assertExportable(result)).not.toThrow();
    } finally { clock.mockRestore(); }
  });
  it("deduplicates team copies and recomputes explicit empty/date selections with frozen provenance", () => {
    const monday = game(), thursday = game(2025020002, dates[3]);
    const initial = snapshot([monday, monday, thursday]);
    expect(initial.state).toBe("ready"); expect(initial.games).toHaveLength(2); expect(initial.teams).toHaveLength(32);
    expect(initial.days[0].leagueGames).toBe(1); expect(initial.rows[0].remainingGames).toBe(2);
    const selected = selectScheduleDates(initial, [dates[3]]);
    expect(selected.rows[0].remainingGames).toBe(1); expect(selected.id).not.toBe(initial.id);
    expect(selected.generatedAt).toBe(initial.generatedAt); expect(selected.source).toEqual(initial.source); expect(selected.games).toEqual(initial.games);
    expect(selectScheduleDates(initial, []).rows.every(row => row.score === -100)).toBe(true);
    expect(snapshot([monday, thursday], {}, "remaining-week").selectedDates).toEqual(dates.slice(3));
  });
  it("uses raw scores and stable ties, retaining full daily density after filtering", () => {
    const games = Array.from({ length: 9 }, (_, i) => game(2025020100 + i));
    games.push(game(2025020200, dates[3], { homeTeam: { id: 3, abbrev: "NYR" }, awayTeam: { id: 4, abbrev: "PHI" } }));
    const selected = selectScheduleDates(snapshot(games), [dates[3]]);
    expect(selected.days[0].leagueGames).toBe(9); expect(selected.days[0].offNight).toBe(false);
    expect(selected.rows[0].score).not.toBe(Number(selected.rows[0].score.toFixed(1)));
    expect(selected.rows.slice(0, 2).map(row => row.team.abbreviation)).toEqual(["NYR", "PHI"]);
  });
  it("keeps elapsed/live/postponed/nonregular context without counting opportunities", () => {
    const initial = snapshot([game(1, dates[0], { startTimeUTC: "2026-01-05T10:00:00Z" }), game(2, dates[1], { gameState: "LIVE" }), game(3, dates[2], { gameScheduleState: "PPD" }), game(4, dates[3], { gameType: 1 }), game(5, dates[4], { gameState: "OFF" })]);
    expect(initial.games).toHaveLength(5); expect(initial.rows.every(row => row.remainingGames === 0)).toBe(true);
    expect(initial.state).toBe("ready"); expect(initial.days[2].leagueGames).toBe(0); expect(initial.days[3].leagueGames).toBe(0);
  });
  it("distinguishes incomplete coverage, unknown selected dates and valid zero-game weeks", () => {
    expect(snapshot().state).toBe("ready");
    expect(snapshot([], { numGamesPerDay: [1, 0, 0, 0, 0, 0, 0] }).state).toBe("partial");
    expect(snapshot([game(1, dates[0], { startTimeUTC: "2026-01-06T06:00:00Z" })]).state).toBe("partial");
    expect(snapshot([game(1, dates[0], { awayTeam: { id: 999, abbrev: "AAA" } })]).state).toBe("partial"); expect(snapshot([], { coveredDates: dates.slice(1) }).state).toBe("partial");
    for (const overrides of [{ startTimeUTC: undefined }, { gameState: "UNKNOWN" }]) {
      const initial = snapshot([game(1, dates[0], overrides)]);
      expect(initial.state).toBe("partial"); expect(selectScheduleDates(initial, [dates[3]]).state).toBe("ready");
    }
  });
  it("rejects conflicts and season fallback, preserving relocated identities", () => {
    for (const conflict of [{ startTimeUTC: "2026-01-05T22:00:00Z" }, { season: 20242025 }, { awayTeam: { id: 3, abbrev: "NYR" } }]) {
      const result = snapshot([game(), game(2025020001, dates[0], conflict)]);
      expect(result.state).toBe("partial"); expect(result.games).toHaveLength(0);
    }
    expect(snapshot([game(1, dates[0], { awayTeam: { id: 53, abbrev: "ARI" } })]).games[0].awayTeam).toMatchObject({ id: 53, abbreviation: "ARI" });
    const august = buildScheduleSnapshot({ format: "game-grid", weekStart: "2026-08-03", generatedAt: "2026-08-03T12:00:00Z", schedule: { data: {}, numGamesPerDay: [1, 0, 0, 0, 0, 0, 0], fetchedAt: "2026-08-03T12:00:00Z", coveredDates: weekDates("2026-08-03"), games: [game(2026020001, "2026-08-03", { season: 20262027 })] } });
    expect(august.state).toBe("ready");
  });
  it("enforces six-hour/imminent fifteen-minute freshness, future provenance and puck-drop expiry", () => {
    expect(snapshot([], { fetchedAt: "2026-01-05T06:00:00Z" }).state).toBe("stale");
    expect(snapshot([], { fetchedAt: "2026-01-05T05:59:00Z" }).state).toBe("stale");
    expect(snapshot([], { fetchedAt: "2026-01-05T12:01:00Z" }).state).toBe("missing");
    expect(snapshot([], { updatedAt: "2026-01-05T12:01:00Z" }).state).toBe("missing");
    expect(snapshot([], { fetchedAt: undefined }).state).toBe("missing");
    const soon = game(1, dates[0], { startTimeUTC: "2026-01-05T12:10:00Z" });
    expect(snapshot([soon], { fetchedAt: "2026-01-05T11:44:00Z" }).state).toBe("stale");
    expect(snapshot([soon], { fetchedAt: "2026-01-05T11:45:00Z" }).state).toBe("stale");
    expect(snapshot([soon]).expiresAt).toBe("2026-01-05T12:10:00.000Z");
    expect(snapshot([game(1, dates[0], { startTimeUTC: "2026-01-05T19:00:00Z" })]).expiresAt).toBe("2026-01-05T13:00:00.000Z");
  });
  it("uses the release scoring basis with integer off-nights, density and no odds", () => {
    const initial = snapshot([game(), game(2025020002, dates[3], {
      homeTeam: { id: 1, abbrev: "NJD", winOdds: 100, apiWinOdds: 100 },
      awayTeam: { id: 2, abbrev: "NYI", winOdds: 0, apiWinOdds: 0 },
    })]);
    // 6 × (2 - 2/16) + 4 × 2 + 0.25 for a complete one-game slate.
    expect(initial.rows[0].score).toBe(19.5);
    expect(initial.rows[0].weightedOffNights).not.toBe(initial.rows[0].offNightGames);
    expect(selectScheduleDates(initial, [dates[3]]).rows[0].score).toBe(9.875);
    expect(JSON.stringify(initial)).not.toMatch(/winOdds|apiWinOdds/);
  });
  it("fails closed for the current shared reader without inventing timing or complete records", () => {
    const context = game(2025020001, dates[0], { startTimeUTC: undefined });
    const result = snapshot([], { data: { 1: { MON: context }, 2: { MON: context } }, games: undefined, fetchedAt: undefined, numGamesPerDay: [1, 0, 0, 0, 0, 0, 0] });
    expect(result.state).toBe("missing");
    expect(result.source).toMatchObject({ fetchedAt: null, updatedAt: null });
    expect(result.reasons.join(" ")).toContain("unknown start or state");
    expect(result.rows.every(row => row.remainingGames === 0)).toBe(true);
    expect(() => assertExportable(result)).toThrow("complete, fresh schedule");
  });
  it("adapts October indexed rows using reader retrieval time without inventing provider freshness", () => {
    const monday = game(), thursday = game(2025020002, dates[3]);
    const checkedAt = "2026-01-05T11:59:00Z";
    const indexed = snapshot([], {
      data: { 1: { MON: monday, THU: thursday }, 2: { MON: monday, THU: thursday } },
      games: undefined, fetchedAt: undefined, retrievedAt: checkedAt,
      numGamesPerDay: [1, 0, 0, 1, 0, 0, 0],
    });
    expect(indexed.state).toBe("ready");
    expect(indexed.source).toMatchObject({ fetchedAt: "2026-01-05T11:59:00.000Z", updatedAt: null });
    expect(indexed.games).toHaveLength(2);
    expect(indexed.rows[0].remainingGames).toBe(2);
    expect(indexed.rows[0].score).toBe(snapshot([monday, thursday]).rows[0].score);
    const remaining = selectScheduleDates(indexed, [dates[3]]);
    expect(remaining.rows[0].remainingGames).toBe(1);
    expect(remaining.source).toEqual(indexed.source);
    expect(remaining.selectedDates).toEqual([dates[3]]);
  });
  it("withholds incomplete or conflicting indexed records and invalid retrieval timing", () => {
    const monday = game();
    const source: Partial<ScheduleData> = { data: { 1: { MON: monday }, 2: { MON: monday } }, games: undefined, fetchedAt: undefined, retrievedAt: now, numGamesPerDay: [1, 0, 0, 0, 0, 0, 0] };
    const incomplete = snapshot([], { ...source, numGamesPerDay: [2, 0, 0, 0, 0, 0, 0] });
    expect(incomplete.state).toBe("partial");
    expect(incomplete.reasons.join(" ")).toContain("counts do not reconcile");
    expect(snapshot([], { ...source, data: { 1: { MON: monday }, 2: { MON: { ...monday, gameState: "FINAL" } } } }).games).toEqual([]);
    for (const retrievedAt of [undefined, "2026-02-30T12:00:00Z", "2026-01-05T12:01:00Z"]) {
      expect(snapshot([], { ...source, retrievedAt }).state).toBe("missing");
    }
    const unknown = snapshot([], { ...source, data: { 1: { MON: { ...monday, gameState: undefined } } } });
    expect(unknown.state).toBe("partial");
    expect(unknown.rows.every(row => row.remainingGames === 0)).toBe(true);
  });
  it("stops counting at puck drop and disables export at the exact expiry boundary", () => {
    const clock = vi.spyOn(Date, "now").mockReturnValue(Date.parse(now));
    try {
      const initial = snapshot([game(1, dates[0], { startTimeUTC: "2026-01-05T12:10:00Z" })]);
      expect(() => assertExportable(initial)).not.toThrow();
      clock.mockReturnValue(Date.parse(initial.expiresAt!));
      expect(() => assertExportable(initial)).toThrow("expired");
      const elapsed = buildScheduleSnapshot({ format: "game-grid", weekStart, generatedAt: initial.expiresAt!, schedule: { games: [game(1, dates[0], { startTimeUTC: initial.expiresAt! })], data: {}, coveredDates: dates, numGamesPerDay: [1, 0, 0, 0, 0, 0, 0], fetchedAt: initial.expiresAt! } });
      expect(elapsed.rows.every(row => row.remainingGames === 0)).toBe(true);
    } finally { clock.mockRestore(); }
  });
});


describe("social editor schedule API", () => {
  // The supported-season window is relative to the request date, so pin it.
  beforeEach(() => { vi.useFakeTimers({ toFake: ["Date"] }); vi.setSystemTime(new Date(now)); });
  afterEach(() => { vi.useRealTimers(); });
  async function request(query: NextApiRequest["query"], method = "GET") {
    const response = { code: 0, body: null as any, headers: {} as Record<string, string>, setHeader(key: string, value: string) { this.headers[key] = value; }, status(code: number) { this.code = code; return this; }, json(body: any) { this.body = body; return this; } };
    await handler({ method, query, headers: { authorization: "Bearer synthetic-token" } } as NextApiRequest, response as unknown as NextApiResponse);
    return response;
  }
  it("allowlists formats, methods and exact query dates without upstream reads", async () => {
    upstream.getSchedule.mockClear();
    expect((await request({ format: "nope" })).code).toBe(404);
    expect((await request({ format: "game-grid" }, "POST")).code).toBe(405);
    expect((await request({ format: "game-grid", weekStart: "2026-02-30" })).code).toBe(400);
    expect((await request({ format: "game-grid", weekStart, selectedDates: `${dates[0]},${dates[0]}` })).code).toBe(400);
    const blocked = await request({ format: "player-spotlight", weekStart });
    expect(blocked.code).toBe(200); expect(blocked.body.state).toBe("blocked");
    expect(blocked.body.source).toMatchObject({ state: "blocked", fetchedAt: null, updatedAt: null, coveredDates: [] });
    expect(upstream.getSchedule).not.toHaveBeenCalled();
  });
  it("returns private snapshots including an explicit empty selection and honest source errors", async () => {
    upstream.getSchedule.mockResolvedValue({ data: {}, numGamesPerDay: [0, 0, 0, 0, 0, 0, 0], coveredDates: dates, fetchedAt: new Date().toISOString(), games: [] });
    const result = await request({ format: "game-grid", weekStart, selectedDates: "" });
    expect(result.code).toBe(200); expect(result.body.selectedDates).toEqual([]);
    expect(result.headers["Cache-Control"]).toBe(SOCIAL_SHARE_CACHE_CONTROL); expect(result.headers["X-Robots-Tag"]).toContain("noindex");
    expect(upstream.getSchedule).toHaveBeenLastCalledWith(weekStart, { includeOdds: false });
    upstream.getSchedule.mockRejectedValue(new Error("private dependency detail"));
    const failure = await request({ format: "game-grid", weekStart });
    expect(failure.code).toBe(503); expect(JSON.stringify(failure.body)).not.toContain("private dependency");
    expect(failure.headers["Cache-Control"]).toBe(SOCIAL_SHARE_CACHE_CONTROL);
  });
  it("serves the October indexed contract without disclosing private fields or projecting players", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(now));
    try {
      const monday = game();
      upstream.getSchedule.mockResolvedValue({ data: { 1: { MON: monday }, 2: { MON: monday } }, numGamesPerDay: [1, 0, 0, 0, 0, 0, 0], coveredDates: dates, retrievedAt: now, accountId: "private-account", capture: "private-capture" });
      const result = await request({ format: "game-grid", weekStart });
      expect(result.body.state).toBe("ready");
      expect(result.body.source).toMatchObject({ fetchedAt: "2026-01-05T12:00:00.000Z", updatedAt: null });
      expect(result.body.games).toHaveLength(1);
      expect(result.body.rows[0].remainingGames).toBe(1);
      expect(result.body.basis).toBe("schedule_only");
      expect(JSON.stringify(result.body)).not.toMatch(/private-account|private-capture|winOdds|apiWinOdds/);
    } finally { vi.useRealTimers(); }
  });
  it("attaches a public opponent-rate layer without blocking the schedule when rates fail", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(now));
    try {
      upstream.getSchedule.mockResolvedValue({ data: {}, numGamesPerDay: [1, 0, 0, 0, 0, 0, 0], coveredDates: dates, fetchedAt: now, games: [game()] });
      const offline = await request({ format: "game-grid", weekStart });
      expect(offline.code).toBe(200); expect(offline.body.state).toBe("ready");
      expect(offline.body.opponents).toMatchObject({ state: "missing", teams: {} });
      expect(opponentSource.loadShareTeamRates).toHaveBeenLastCalledWith(20252026);
      const rows = Object.fromEntries(["NJD", "NYI"].map(abbreviation => [abbreviation, { team_abbreviation: abbreviation, team_name: "private-name", gp: 40, sf: 1, sa: 1, gf: 1, ga: 1, xgf: 100, xga: 120, points: 50, season: 20252026, situation: "all", updated_at: "2026-01-05T08:00:00Z" }]));
      opponentSource.loadShareTeamRates.mockResolvedValueOnce(rows as never);
      const partial = await request({ format: "game-grid", weekStart });
      expect(partial.body.opponents.state).toBe("partial");
      expect(partial.body.opponents.teams.NJD).toEqual({ gp: 40, xgf: 100, xga: 120, gf: 1, ga: 1, sf: 1, sa: 1 });
      expect(JSON.stringify(partial.body.opponents)).not.toContain("private-name");
    } finally { vi.useRealTimers(); }
  });
  it("keeps Tuesday trends blocked with zero upstream reads until a live trend source is approved", async () => {
    upstream.getSchedule.mockReset(); opponentSource.loadShareTeamRates.mockClear(); playerSource.loadSharePlayerSources.mockClear();
    for (const query of [{ format: "tuesday-trends", weekStart }, { format: "tuesday-trends" }, { format: "tuesday-trends", weekStart, selectedDates: dates.slice(1).join(",") }]) {
      const result = await request(query);
      expect(result.code).toBe(200);
      expect(result.body).toMatchObject({ format: "tuesday-trends", state: "blocked", expiresAt: null, reasons: ["Rolling game metrics and ownership are not connected."] });
      expect(result.body.source).toMatchObject({ state: "blocked", fetchedAt: null, coveredDates: [], reasons: ["No upstream read is made until a live trend source is approved."] });
      expect(result.body.trends ?? null).toBeNull(); expect(result.body.opponents ?? null).toBeNull();
      expect(result.headers["Cache-Control"]).toBe(SOCIAL_SHARE_CACHE_CONTROL);
    }
    expect(upstream.getSchedule).not.toHaveBeenCalled();
    expect(opponentSource.loadShareTeamRates).not.toHaveBeenCalled();
    expect(playerSource.loadSharePlayerSources).not.toHaveBeenCalled();
    expect((await request({ format: "tuesday-trends", weekStart: "2099-01-05" })).code).toBe(400);
    expect(upstream.getSchedule).not.toHaveBeenCalled();
  });
  it("reads opponent rates only after the schedule read succeeds", async () => {
    upstream.getSchedule.mockReset(); opponentSource.loadShareTeamRates.mockClear();
    upstream.getSchedule.mockRejectedValue(new Error("down"));
    expect((await request({ format: "game-grid", weekStart })).code).toBe(503);
    expect(opponentSource.loadShareTeamRates).not.toHaveBeenCalled();
    upstream.getSchedule.mockResolvedValue({ data: {}, numGamesPerDay: [1, 0, 0, 0, 0, 0, 0], coveredDates: dates, fetchedAt: now, games: [game()] });
    expect((await request({ format: "remaining-week", weekStart })).code).toBe(200);
    expect(opponentSource.loadShareTeamRates).toHaveBeenCalledTimes(1);
    expect(upstream.getSchedule.mock.invocationCallOrder[1]).toBeLessThan(opponentSource.loadShareTeamRates.mock.invocationCallOrder[0]);
  });
  it("accepts only the previous, current and next season and rejects other weeks with a clear 400 and no reads", async () => {
    upstream.getSchedule.mockReset(); opponentSource.loadShareTeamRates.mockClear();
    upstream.getSchedule.mockResolvedValue({ data: {}, numGamesPerDay: [0, 0, 0, 0, 0, 0, 0], coveredDates: [], fetchedAt: now, games: [] });
    for (const accepted of ["2024-08-05", weekStart, "2027-07-26"]) expect((await request({ format: "game-grid", weekStart: accepted })).code).toBe(200);
    upstream.getSchedule.mockClear(); opponentSource.loadShareTeamRates.mockClear();
    for (const [format, rejected] of [["game-grid", "2024-07-29"], ["game-grid", "2027-08-02"], ["remaining-week", "2099-01-05"], ["tuesday-trends", "2099-01-05"]]) {
      const result = await request({ format, weekStart: rejected });
      expect(result.code).toBe(400);
      expect(result.body.error).toBe("weekStart must fall in the 2024–25, 2025–26 or 2026–27 NHL season.");
      expect(result.headers["Cache-Control"]).toBe(SOCIAL_SHARE_CACHE_CONTROL);
    }
    expect(upstream.getSchedule).not.toHaveBeenCalled();
    expect(opponentSource.loadShareTeamRates).not.toHaveBeenCalled();
  });
  it("attaches a trimmed, read-only player layer after a ready schedule and handles stale, missing and unmapped sources", async () => {
    upstream.getSchedule.mockReset(); opponentSource.loadShareTeamRates.mockReset(); playerSource.loadSharePlayerSources.mockReset(); playerSource.loadSharePlayerRecent.mockReset();
    playerSource.loadSharePlayerRecent.mockResolvedValue({ rolling: [], goalieGames: [] });
    upstream.getSchedule.mockResolvedValue(fictionalLeagueWeek(weekStart, now));
    opponentSource.loadShareTeamRates.mockResolvedValue(fictionalTeamStats(20252026, "2026-01-05T08:00:00Z") as never);
    const sources = () => fictionalPlayerSources(20252026, "2026-01-05", "2026-01-05T08:00:00Z");
    playerSource.loadSharePlayerSources.mockResolvedValue(sources());
    const ok = await request({ format: "game-grid", weekStart });
    expect(ok.body.state).toBe("ready");
    // Every team with games is read (wider-pool fill); the recent-form read covers only the bounded ranking pool (ticket 15).
    const teamsWithGames = ok.body.rows.filter((row: { remainingGames: number }) => row.remainingGames > 0).map((row: { team: { abbreviation: string } }) => row.team.abbreviation);
    expect(playerSource.loadSharePlayerSources).toHaveBeenCalledWith(20252026, teamsWithGames);
    const [, skaterIds, goalieIds, since] = playerSource.loadSharePlayerRecent.mock.calls[0] as [number, number[], number[], string];
    const poolIds = new Set([...skaterIds, ...goalieIds]);
    expect(poolIds.size).toBeLessThanOrEqual(RANK_POOL_MAX);
    for (const player of ok.body.players.players as { nhlId: number }[]) expect(poolIds.has(player.nhlId)).toBe(true);
    expect(since).toBe("2025-12-15");
    expect(ok.body.players.players.every((player: { recent: unknown }) => player.recent === null)).toBe(true);
    expect(upstream.getSchedule.mock.invocationCallOrder[0]).toBeLessThan(playerSource.loadSharePlayerSources.mock.invocationCallOrder[0]);
    expect(ok.body.players).toMatchObject({ state: "ready", selectedDates: dates });
    // Only the players the cards show leave the server: pickups, specialists and both tier-list modes (SS1-14).
    const tierShown = (["strict", "widened"] as const).flatMap(mode => streamingTiers(ok.body, true, mode).flatMap(tier => tier.shown));
    const shown = new Set([...pickupTiers(ok.body, true).flatMap(tier => Object.values(tier.groups).flat()), ...Object.values(specialists(ok.body, true)).flat(), ...tierShown].map(player => player.nhlId));
    expect(new Set(ok.body.players.players.map((player: { nhlId: number }) => player.nhlId))).toEqual(shown);
    expect(ok.body.players.players.length).toBeLessThanOrEqual(TRIMMED_PLAYERS_MAX);
    // The live tier list matches the one built from the untrimmed layer, including "+N more".
    const untrimmed = { ...ok.body, players: { ...buildPlayerLayer(sources(), { season: 20252026, teams: ok.body.teams.map((team: { abbreviation: string }) => team.abbreviation), fetchedAt: now, generatedAt: ok.body.generatedAt }), selectedDates: null } };
    for (const mode of ["strict", "widened"] as const) {
      const live = streamingTiers(ok.body, true, mode), reference = streamingTiers(untrimmed, true, mode);
      expect(live.map(tier => [tier.shown.map(player => player.nhlId), tier.more])).toEqual(reference.map(tier => [tier.shown.map(player => player.nhlId), tier.more]));
      expect(ok.body.players.tierCounts[mode]).toEqual(reference.map(tier => tier.players.length));
      expect(live.some(tier => tier.shown.length > 0)).toBe(true);
    }
    const hidden = sources().skaters.find(row => !shown.has(row.player_id))!.player_name!;
    expect(JSON.stringify(ok.body)).not.toContain(`"${hidden}"`);
    expect(JSON.stringify(ok.body.players)).not.toMatch(/465\.p\.|player_key|editorial|last_updated/);
    expect(ok.headers["Cache-Control"]).toBe(SOCIAL_SHARE_CACHE_CONTROL);

    // Id-mapping miss: the first shown skater loses its map row and simply drops out.
    const missingId = ok.body.players.players.find((player: { group: string }) => player.group !== "G").nhlId;
    const unmapped = sources(); unmapped.map = unmapped.map.filter(row => Number(row.nhl_player_id) !== missingId);
    playerSource.loadSharePlayerSources.mockResolvedValueOnce(unmapped);
    const miss = await request({ format: "game-grid", weekStart });
    expect(miss.body.players.state).toBe("ready");
    expect(miss.body.players.players.map((player: { nhlId: number }) => player.nhlId)).not.toContain(missingId);

    // Stale ownership (two weeks old): no names leave the server and the response remains private.
    playerSource.loadSharePlayerSources.mockResolvedValueOnce(fictionalPlayerSources(20252026, "2025-12-20", "2026-01-05T08:00:00Z"));
    const stale = await request({ format: "remaining-week", weekStart });
    expect(stale.body.players).toMatchObject({ state: "stale", players: [], selectedDates: dates.slice(3) });
    expect(stale.body.players.tierCounts).toBeUndefined();
    expect(streamingTiers(stale.body, true, "strict").every(tier => tier.shown.length === 0)).toBe(true);
    expect(playerSource.loadSharePlayerRecent).toHaveBeenCalledTimes(2);
    expect(JSON.stringify(stale.body)).not.toContain("Fixture ");
    expect(stale.headers["Cache-Control"]).toBe(SOCIAL_SHARE_CACHE_CONTROL);

    // Missing: the loader fails (e.g. over a limit); the schedule edition still serves.
    playerSource.loadSharePlayerSources.mockRejectedValueOnce(new Error("Yahoo ownership response was incomplete or over its 1000-row limit."));
    const missing = await request({ format: "game-grid", weekStart });
    expect(missing.body.state).toBe("ready");
    expect(missing.body.players).toMatchObject({ state: "missing", players: [] });
    expect(JSON.stringify(missing.body)).not.toContain("1000-row");
  });
  it("ranks the pool by L5 fantasy score × opportunity: a deeper pool player with the best L5 leads its list (ticket 15)", async () => {
    upstream.getSchedule.mockReset(); opponentSource.loadShareTeamRates.mockReset(); playerSource.loadSharePlayerSources.mockReset(); playerSource.loadSharePlayerRecent.mockReset();
    upstream.getSchedule.mockResolvedValue(fictionalLeagueWeek(weekStart, now));
    opponentSource.loadShareTeamRates.mockResolvedValue(fictionalTeamStats(20252026, "2026-01-05T08:00:00Z") as never);
    playerSource.loadSharePlayerSources.mockResolvedValue(fictionalPlayerSources(20252026, "2026-01-05", "2026-01-05T08:00:00Z"));
    // Season order (no L5) for one list, then give its fourth player the best last five games.
    playerSource.loadSharePlayerRecent.mockResolvedValueOnce({ rolling: [], goalieGames: [] });
    const seasonOnly = await request({ format: "game-grid", weekStart });
    const fullLayer = buildPlayerLayer(fictionalPlayerSources(20252026, "2026-01-05", "2026-01-05T08:00:00Z"), { season: 20252026, teams: seasonOnly.body.teams.map((team: { abbreviation: string }) => team.abbreviation), fetchedAt: now, generatedAt: seasonOnly.body.generatedAt });
    const untrimmed = { ...seasonOnly.body, players: { ...fullLayer, selectedDates: null } };
    const list = pickupTiers(untrimmed, true, 6)[2].groups.F, [first, , , fourth] = list;
    expect(pickupTiers(seasonOnly.body, true)[2].groups.F.map(player => player.nhlId)).not.toContain(fourth.nhlId);
    const row = (id: number, goals: number) => ({ player_id: id, season: 20252026, game_date: "2026-01-04", strength_state: "all", season_games_played: 20, goals_total_last5: goals, assists_total_last5: 1, points_total_last5: goals + 1,
      shots_total_last5: 10, hits_avg_last5: 1, blocks_avg_last5: 0.5, toi_seconds_avg_last5: 1000, pp_points_total_last5: 0, toi_seconds_avg_season: 1000, line_combo_slot: 2, line_combo_group: "forward", pp_unit: null });
    const [, poolSkaters] = playerSource.loadSharePlayerRecent.mock.calls[0] as [number, number[]];
    expect(poolSkaters).toContain(fourth.nhlId);
    playerSource.loadSharePlayerRecent.mockResolvedValueOnce({ rolling: poolSkaters.map(id => row(id, id === fourth.nhlId ? 5 : 0)), goalieGames: [] });
    const ranked = await request({ format: "game-grid", weekStart });
    const shown = pickupTiers(ranked.body, true)[2].groups.F;
    expect(shown[0].nhlId).toBe(fourth.nhlId);
    expect(shown[0].recent).toMatchObject({ kind: "skater", line: "L2", ppUnit: null, toiSeasonSeconds: 1000 });
    expect(shown).toHaveLength(3);
    expect(first.nhlId).not.toBe(fourth.nhlId);
    expect(ranked.body.players.players.length).toBeLessThanOrEqual(TRIMMED_PLAYERS_MAX);
  });

  it("tells a failed last-five-games read apart from an empty one, and keeps the cache short on failure (C7 SS1-10-F1)", async () => {
    upstream.getSchedule.mockReset(); opponentSource.loadShareTeamRates.mockReset(); playerSource.loadSharePlayerSources.mockReset(); playerSource.loadSharePlayerRecent.mockReset();
    upstream.getSchedule.mockResolvedValue(fictionalLeagueWeek(weekStart, now));
    opponentSource.loadShareTeamRates.mockResolvedValue(fictionalTeamStats(20252026, "2026-01-05T08:00:00Z") as never);
    playerSource.loadSharePlayerSources.mockResolvedValue(fictionalPlayerSources(20252026, "2026-01-05", "2026-01-05T08:00:00Z"));
    // Empty but successful: the source answered with no rows, so "no recent game" is true.
    playerSource.loadSharePlayerRecent.mockResolvedValueOnce({ rolling: [], goalieGames: [] });
    const empty = await request({ format: "game-grid", weekStart });
    expect(empty.body.players).toMatchObject({ state: "ready", recentState: "ready" });
    expect(empty.body.players.players.every((player: { recent: unknown }) => player.recent === null)).toBe(true);
    expect(empty.headers["Cache-Control"]).toBe(SOCIAL_SHARE_CACHE_CONTROL);
    // Rejected (network or dependency error) and over-limit reads are "unavailable", never "no game".
    for (const failure of [new Error("offline"), new Error("Skater recent games response was incomplete or over its 420-row limit.")]) {
      playerSource.loadSharePlayerRecent.mockRejectedValueOnce(failure);
      const failed = await request({ format: "game-grid", weekStart });
      expect(failed.body.state).toBe("ready");
      expect(failed.body.players).toMatchObject({ state: "ready", recentState: "unavailable" });
      expect(failed.body.players.players.length).toBeGreaterThan(0);
      expect(failed.body.players.players.every((player: { recent: unknown }) => player.recent === null)).toBe(true);
      expect(JSON.stringify(failed.body)).not.toMatch(/offline|420-row/);
      expect(failed.headers["Cache-Control"]).toBe(SOCIAL_SHARE_CACHE_CONTROL);
    }
    // SS1-17: a failed goalie source leaves the skaters' recent form in place (and the reverse).
    const rows = (ids: number[]) => ids.map(id => ({ player_id: id, season: 20252026, game_date: "2026-01-04", strength_state: "all", season_games_played: 20, goals_total_last5: 1, assists_total_last5: 1, points_total_last5: 2,
      shots_total_last5: 9, hits_avg_last5: 1, blocks_avg_last5: 0.5, toi_seconds_avg_last5: 1000, pp_points_total_last5: 0, toi_seconds_avg_season: 1000, line_combo_slot: 2, line_combo_group: "forward", pp_unit: 1 }));
    playerSource.loadSharePlayerRecent.mockImplementationOnce(async (...args: unknown[]) => ({ rolling: rows(args[1] as number[]), goalieGames: null }));
    const partial = await request({ format: "game-grid", weekStart });
    expect(partial.body.players).toMatchObject({ state: "ready", recentState: "partial", recentUnavailable: ["goalies"] });
    const players = partial.body.players.players as { group: string; recent: unknown }[];
    expect(players.filter(player => player.group !== "G").every(player => player.recent !== null)).toBe(true);
    expect(players.filter(player => player.group === "G").every(player => player.recent === null)).toBe(true);
    expect(players.some(player => player.group === "G")).toBe(true);
  });
  it("never reads players after a failed or partial schedule", async () => {
    upstream.getSchedule.mockReset(); playerSource.loadSharePlayerSources.mockReset();
    upstream.getSchedule.mockRejectedValue(new Error("down"));
    expect((await request({ format: "game-grid", weekStart })).code).toBe(503);
    upstream.getSchedule.mockResolvedValue({ ...fictionalLeagueWeek(weekStart, now), coveredDates: dates.slice(1) });
    const partial = await request({ format: "game-grid", weekStart });
    expect(partial.body.state).toBe("partial");
    expect(partial.body.players ?? null).toBeNull();
    expect(playerSource.loadSharePlayerSources).not.toHaveBeenCalled();
  });
  it("does not expose private source fields or activate export for the release reader shape", async () => {
    upstream.getSchedule.mockResolvedValue({ data: {}, numGamesPerDay: [0, 0, 0, 0, 0, 0, 0], coveredDates: dates, accountId: "private-account", capture: "private-capture", odds: "private-odds" });
    const result = await request({ format: "game-grid", weekStart });
    expect(result.code).toBe(200);
    expect(result.body.state).toBe("missing");
    expect(JSON.stringify(result.body)).not.toMatch(/private-account|private-capture|private-odds/);
  });
});

describe("shared cache policy", () => {
  const nowMs = Date.parse(now);
  // A Wednesday game keeps the edition's natural expiry at fetched + 6 h.
  const opponents = { name: "NST team stats" as const, season: 20252026, fetchedAt: now, updatedAt: now, state: "ready" as const, reasons: [], teams: {} };
  const ready = (overrides: Partial<ReturnType<typeof snapshot>> = {}) => ({ ...snapshot([game(1, dates[2])]), opponents, ...overrides });
  const expiringIn = (seconds: number) => ready({ expiresAt: new Date(nowMs + seconds * 1000).toISOString() });
  it("shares a ready edition for at most five minutes plus five stale, never past expiry minus the margin", () => {
    expect(ready().expiresAt).toBe("2026-01-05T18:00:00.000Z");
    expect(shareCacheControl(ready(), nowMs)).toBe("public, max-age=0, s-maxage=300, stale-while-revalidate=300");
    expect(SHARE_CACHE_EXPIRY_MARGIN_SECONDS).toBe(600);
    // 15-minute near-puck-drop edition: 300 s usable, no stale window.
    expect(shareCacheControl(expiringIn(900), nowMs)).toBe("public, max-age=0, s-maxage=300");
    expect(shareCacheControl(expiringIn(1000), nowMs)).toBe("public, max-age=0, s-maxage=300, stale-while-revalidate=100");
    expect(shareCacheControl(expiringIn(720), nowMs)).toBe("public, max-age=0, s-maxage=120");
    expect(shareCacheControl(expiringIn(659), nowMs)).toBe("no-store");
  });
  it("never shares unready editions and shortens the ceiling while opponent rates are unready", () => {
    expect(shareCacheControl(ready({ state: "partial" }), nowMs)).toBe("no-store");
    expect(shareCacheControl(ready({ expiresAt: null }), nowMs)).toBe("no-store");
    expect(shareCacheControl(ready({ source: { ...ready().source, state: "stale" } }), nowMs)).toBe("no-store");
    expect(shareCacheControl(ready({ opponents: null }), nowMs)).toBe("public, max-age=0, s-maxage=60");
    expect(shareCacheControl(ready({ opponents: { ...opponents, state: "stale" } }), nowMs)).toBe("public, max-age=0, s-maxage=60");
  });
});
