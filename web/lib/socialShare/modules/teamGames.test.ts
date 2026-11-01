import { describe, expect, it } from "vitest";
import { parseShareSettings } from "./contract";
import { matchupCalendar } from "./shared/periodWindow";
import { loadTeamGames } from "./teamGames.sources";
import { buildTeamGames, resolveTeamGamesWindow, TEAM_GAMES_ROLLING, teamGamesModule, teamGamesWindow, type TeamGamesSettings } from "./teamGames";

const teams = ["NJD", "NYI", "NYR"];
const base = { from: "2026-10-24", through: "2026-10-30", label: "Last 7 days", teams, updatedAt: null };

describe("team games example post", () => {
  it("runs through yesterday in New York", () => {
    expect(teamGamesWindow("2026-11-01T02:00:00Z", 7)).toEqual({ from: "2026-10-24", through: "2026-10-30", season: 20262027 });
  });
  it("counts distinct games, shares tied ranks and keeps a proven zero", () => {
    const result = buildTeamGames({ ...base, scheduledGames: 1, rows: [{ team_id: 1, game_id: 5, date: "2026-10-30" }, { team_id: 1, game_id: 5, date: "2026-10-30" }, { team_id: 2, game_id: 5, date: "2026-10-30" }] });
    expect(result.state).toBe("ready");
    expect(result.data?.rows.map(row => [row.team, row.games, row.rank])).toEqual([["NJD", 1, 1], ["NYI", 1, 1], ["NYR", 0, 3]]);
    expect(result.evidence.coverage).toEqual({ observed: 2, expected: 2, missing: 0, unit: "team games" });
  });
  it("is partial, not ready, when scheduled games have no result", () => {
    const result = buildTeamGames({ ...base, scheduledGames: 2, rows: [{ team_id: 1, game_id: 5, date: "2026-10-30" }, { team_id: 2, game_id: 5, date: "2026-10-30" }] });
    expect(result.state).toBe("partial");
    expect(result.reasons?.[0]).toMatch(/2 of 4/);
  });
});

describe("team games period control", () => {
  const AT = "2026-11-01T02:00:00Z", settings = (over: Partial<TeamGamesSettings> = {}): TeamGamesSettings => ({ days: 7, period: TEAM_GAMES_ROLLING, week: null, start: null, end: null, ...over });
  const rows = [{ week: 1, start_date: "2026-10-12", end_date: "2026-10-18" }, { week: 2, start_date: "2026-10-19", end_date: "2026-11-01" }, { week: 3, start_date: "2026-11-02", end_date: "2026-11-08" }];
  const calendar = matchupCalendar(rows);
  const client = (tables: Record<string, unknown[]> = { yahoo_matchup_weeks: rows }) => {
    const calls: { table: string; ranges: string[] }[] = [];
    return { calls, from(table: string) {
      const call = { table, ranges: [] as string[] }; calls.push(call);
      const query: Record<string, unknown> = {};
      for (const method of ["select", "eq", "order"]) query[method] = () => query;
      for (const method of ["gte", "lte"]) query[method] = (_: string, value: string) => { call.ranges.push(`${method}:${value}`); return query; };
      query.range = async () => ({ data: tables[table] ?? [], error: null, count: (tables[table] ?? []).length });
      return query;
    } };
  };

  it("keeps old links: days alone stays rolling, with no matchup read", async () => {
    const parsed = parseShareSettings<TeamGamesSettings>(teamGamesModule, { days: "14" }), fake = client();
    expect(parsed).toMatchObject({ days: 14, period: TEAM_GAMES_ROLLING });
    const result = await loadTeamGames({ client: fake, generatedAt: AT }, parsed);
    expect(fake.calls.map(call => call.table)).toEqual(["wgo_team_stats", "games"]);
    expect(fake.calls[0].ranges).toEqual(["gte:2026-10-17", "lte:2026-10-30"]);
    expect(result.data).toMatchObject({ from: "2026-10-17", through: "2026-10-30", label: "Last 14 days · Oct 17 to Oct 30" });
  });
  it("reads a chosen matchup's dates, including a 14-day one cut at the last completed games", async () => {
    const past = await loadTeamGames({ client: client(), generatedAt: AT }, settings({ period: "matchup", week: 1 }));
    expect(past.data).toMatchObject({ from: "2026-10-12", through: "2026-10-18", label: "Week 1 · Oct 12 to Oct 18" });
    expect(resolveTeamGamesWindow(settings({ period: "matchup", week: 2 }), calendar, AT).window).toMatchObject({ from: "2026-10-19", through: "2026-10-30", days: 14, label: "Week 2 · Oct 19 to Oct 30 so far" });
  });
  it("fails visibly on a week not started and a range past the last completed games", async () => {
    const future = await loadTeamGames({ client: client(), generatedAt: AT }, settings({ period: "matchup", week: 3 }));
    expect(future.state).toBe("missing");
    expect(future.data).toBeNull();
    expect(future.reasons?.[0]).toMatch(/Week 3 has not started/);
    expect(resolveTeamGamesWindow(settings({ period: "custom", start: "2026-10-20", end: "2026-10-31" }), calendar, AT).reason).toMatch(/past the last completed games/);
  });
  it("validates a custom range before any read", () => {
    expect(() => parseShareSettings(teamGamesModule, { period: "custom" })).toThrow(/start date and an end date/);
    expect(() => parseShareSettings(teamGamesModule, { period: "custom", start: "2026-10-20", end: "2026-10-19" })).toThrow(/must be before/);
    expect(resolveTeamGamesWindow(settings({ period: "custom", start: "2026-10-13", end: "2026-10-30" }), calendar, AT).window).toMatchObject({ from: "2026-10-13", through: "2026-10-30", days: 18 });
  });
});
