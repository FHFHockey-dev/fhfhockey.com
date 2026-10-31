import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import OffNightEdgeCard from "components/SocialShare/modules/OffNightEdgeCard";
import { fictionalLeagueWeek } from "lib/socialShare/fixtures";
import { buildScheduleSnapshot, calendarWeekStart } from "lib/socialShare/schedule";
import type { SocialScheduleData, SocialScheduleGame } from "lib/socialShare/types";
import { activeTeamAbbreviations, teamsInfo } from "lib/teamsInfo";
import { parseShareSettings, sharePostExportBlock, SharePostRequestError, type SharePostSnapshot } from "./contract";
import { buildOffNightEdge, offNightEdgeModule, offNightSchedule, offNightSelectedDates, type OffNightData, type OffNightSettings, type OffNightYahooRow } from "./offNightEdge";
import { loadOffNightEdge } from "./offNightEdge.sources";
import { shareModule } from "./registry";
import type { SkaterAppearance } from "./shared/skaterAppearances";

const upstream = vi.hoisted(() => ({ getSchedule: vi.fn() }));
vi.mock("lib/NHL/server", () => upstream);

const WEEK = "2026-10-26", THURSDAY = "2026-10-29T12:00:00Z", MONDAY = "2026-10-26T12:00:00Z";
const settings = (over: Partial<OffNightSettings> = {}): OffNightSettings => ({ ownershipCeiling: 50, includeUnknown: "off", dates: "rest-of-week", ...over });
/** The fictional league week as of a moment: earlier days are final. */
function week(at: string): SocialScheduleData {
  const schedule = fictionalLeagueWeek(WEEK, new Date(Date.parse(at) - 60000).toISOString());
  return { ...schedule, games: schedule.games!.map(game => game.gameDate! < at.slice(0, 10) ? { ...game, gameState: "OFF" } : game) };
}
const edition = (at: string, dates: OffNightSettings["dates"], schedule = week(at)) => buildScheduleSnapshot({ format: dates === "weekly" ? "game-grid" : "remaining-week", weekStart: WEEK, schedule, generatedAt: at, selectedDates: offNightSelectedDates(WEEK, at.slice(0, 10), dates) });
const topTeam = (at = THURSDAY, dates: OffNightSettings["dates"] = "rest-of-week") => offNightSchedule(edition(at, dates), dates).rows[0].team;

type Skater = { id: number; team: string; position?: string; pct?: number | null; status?: string | null; updated?: string | null; games?: number; shots?: number | null; yahooKey?: string };
const DATES = ["2026-10-20", "2026-10-22", "2026-10-24", "2026-10-26", "2026-10-28"];
/** Each team gets its own five games, with an opposing row so team-game coverage reconciles. */
function world(skaters: readonly Skater[]) {
  const teams = [...new Set(skaters.map(skater => skater.team))], gameIds = teams.flatMap((_, t) => DATES.map((__, i) => (t + 1) * 100 + i));
  const row = (playerId: number, team: string, gameId: number, date: string, group: "F" | "D", shots: number | null): SkaterAppearance => ({ playerId, name: `Skater ${playerId}`, position: group === "D" ? "D" : "C", group, gameId, date, team, opponent: null, home: true, goals: 1, assists: 1, points: 2, shots, hits: 1, blocks: 1, ppPoints: 0, toiSeconds: 960, ppToiSeconds: 0, penaltyMinutes: 0 });
  const appearances = skaters.flatMap(skater => DATES.slice(-(skater.games ?? 5)).map(date => row(skater.id, skater.team, (teams.indexOf(skater.team) + 1) * 100 + DATES.indexOf(date), date, skater.position === "D" ? "D" : "F", skater.shots === undefined ? 3 : skater.shots)));
  const opponents = gameIds.map(id => row(9000 + id, "ZZZ", id, DATES[id % 100], "F", 1));
  const yahoo: OffNightYahooRow[] = skaters.map(skater => ({ player_key: skater.yahooKey ?? `465.p.${skater.id}`, player_id: null, player_name: `Skater ${skater.id}`, editorial_team_abbreviation: skater.team, display_position: skater.position ?? "C", eligible_positions: [{ position: skater.position ?? "C" }], position_type: "P", percent_ownership: skater.pct === undefined ? 10 : skater.pct, status: skater.status ?? null, season: 2026, last_updated: skater.updated === undefined ? "2026-10-29 08:40:00" : skater.updated } as OffNightYahooRow));
  const map = skaters.map(skater => ({ yahoo_player_id: skater.yahooKey ?? `465.p.${skater.id}`, nhl_player_id: String(skater.id) }));
  return { appearances: [...appearances, ...opponents], yahoo, map, gameIds, from: "2026-10-08", through: "2026-10-28" };
}
const build = (skaters: readonly Skater[], over: Partial<OffNightSettings> = {}, at = THURSDAY) => {
  const active = settings(over);
  return buildOffNightEdge({ edition: edition(at, active.dates), settings: active, ...world(skaters) });
};
const rowOf = (data: OffNightData | null, team: string) => data!.rows.find(row => row.team === team)!;
const snapshotOf = (result: ReturnType<typeof build>, active = settings()): SharePostSnapshot => ({ schemaVersion: 1, id: "e", post: "off-night-edge", generatedAt: THURSDAY, expiresAt: new Date(Date.now() + 60000).toISOString(), timeZone: "America/New_York", settings: active, fixture: false, state: result.state, reasons: result.reasons ?? [], evidence: result.evidence, data: result.data, teams: result.teams ?? [] });

describe("6.1 schedule: GP by day and top 16 by actual Week Score", () => {
  it("matches the Game Grid edition's own score and order for what it counts", () => {
    for (const [at, dates] of [[THURSDAY, "rest-of-week"], [MONDAY, "rest-of-week"], [MONDAY, "weekly"]] as const) {
      const source = edition(at, dates), result = offNightSchedule(source, dates);
      const grid = source.rows.filter(row => row.remainingGames > 0).slice(0, 16);
      expect(result.rows.map(row => row.score)).toEqual(grid.map(row => row.score));
      expect(new Set(result.rows.map(row => row.team))).toEqual(new Set(grid.map(row => row.team.abbreviation)));
      expect(result.rows.length).toBe(16);
    }
  });
  it("recomputes score, order and day columns between weekly and rest of week, rather than hiding columns", () => {
    const rest = offNightSchedule(edition(THURSDAY, "rest-of-week"), "rest-of-week"), weekly = offNightSchedule(edition(THURSDAY, "weekly"), "weekly");
    expect(weekly.days.length).toBe(7);
    expect(rest.days.map(day => day.date)).toEqual(["2026-10-29", "2026-10-30", "2026-10-31", "2026-11-01"]);
    expect(weekly.countedGames).toBeGreaterThan(rest.countedGames);
    expect(weekly.rows.map(row => row.team)).not.toEqual(rest.rows.map(row => row.team));
    const team = weekly.rows.find(row => rest.rows.some(other => other.team === row.team))!, same = rest.rows.find(row => row.team === team.team)!;
    expect(team.score).not.toBe(same.score);
    expect(team.games).toBe(team.gamesByDay.reduce((total, count) => total + count, 0));
  });
  it("gets candidates from each selection's own teams", () => {
    const rest = offNightSchedule(edition(THURSDAY, "rest-of-week"), "rest-of-week").rows.map(row => row.team), weekly = offNightSchedule(edition(THURSDAY, "weekly"), "weekly").rows.map(row => row.team);
    const onlyWeekly = weekly.find(team => !rest.includes(team))!;
    const skaters = [{ id: 1, team: onlyWeekly }];
    expect(rowOf(build(skaters, { dates: "weekly" }).data, onlyWeekly).picks.F?.nhlId).toBe(1);
    expect(build(skaters, { dates: "rest-of-week" }).data!.rows.some(row => row.team === onlyWeekly)).toBe(false);
  });
  it("shares ranks on equal scores and names teams the fixed 16 cuts", () => {
    const teams = [...activeTeamAbbreviations].map(abbrev => ({ id: teamsInfo[abbrev].id, abbrev: String(abbrev) }));
    const games = Array.from({ length: 16 }, (_, i) => ({ id: 2026020100 + i, season: 20262027, gameType: 2, gameDate: "2026-11-01", startTimeUTC: "2026-11-01T23:00:00Z", gameState: "FUT", gameScheduleState: "OK", homeTeam: teams[2 * i], awayTeam: teams[2 * i + 1] }) as SocialScheduleGame);
    const schedule: SocialScheduleData = { data: {}, games, fetchedAt: "2026-10-29T11:59:00Z", coveredDates: fictionalLeagueWeek(WEEK, THURSDAY).coveredDates, numGamesPerDay: [0, 0, 0, 0, 0, 0, 16] };
    const result = offNightSchedule(edition(THURSDAY, "rest-of-week", schedule), "rest-of-week");
    expect(result.rows.length).toBe(16);
    expect(result.rows.every(row => row.rank === 1)).toBe(true);
    expect(result.tiedOut.length).toBe(16);
  });
  it("publishes no order from a schedule that is not ready", () => {
    const partial = week(THURSDAY); partial.numGamesPerDay = [1, 1, 1, 1, 1, 1, 1];
    const unready = buildOffNightEdge({ edition: edition(THURSDAY, "rest-of-week", partial), settings: settings(), ...world([{ id: 1, team: "NJD" }]) });
    expect(unready.state).toBe("partial");
    expect(unready.data).toBeNull();
    const old = { ...week(THURSDAY), fetchedAt: "2026-10-28T12:00:00Z" };
    const stale = buildOffNightEdge({ edition: edition(THURSDAY, "rest-of-week", old), settings: settings(), ...world([{ id: 1, team: "NJD" }]) });
    expect(stale.state).toBe("stale");
    expect(stale.data).toBeNull();
    expect(stale.reasons?.join(" ")).toMatch(/older than/);
  });
});

describe("6.2 candidates: at most one F and one D, with reasons and no filler", () => {
  it("gives one F and no D with the reason", () => {
    const team = topTeam(), result = build([{ id: 1, team }, { id: 2, team, pct: 80 }, { id: 3, team, position: "D", pct: 80 }, { id: 4, team, position: "D", pct: 90 }]);
    const row = rowOf(result.data, team);
    expect(row.picks.F?.nhlId).toBe(1);
    expect(row.picks.D).toBeNull();
    expect(row.gaps).toEqual({ F: null, D: "No D: 2 over 50%" });
    expect(result.state).toBe("ready");
  });
  it("keeps exactly the ceiling and refuses just above it", () => {
    const team = topTeam();
    expect(rowOf(build([{ id: 1, team, pct: 50 }]).data, team).picks.F?.nhlId).toBe(1);
    expect(rowOf(build([{ id: 1, team, pct: 50.5 }]).data, team).picks.F).toBeNull();
    expect(rowOf(build([{ id: 1, team, pct: 50.5 }], { ownershipCeiling: 51 }).data, team).picks.F?.nhlId).toBe(1);
  });
  it("never fills from another position or a team with no qualified skater", () => {
    const team = topTeam(), result = build([{ id: 1, team }, { id: 2, team, shots: 9 }]);
    const row = rowOf(result.data, team);
    expect(row.picks.F?.nhlId).toBe(2);
    expect(row.picks.D).toBeNull();
    expect(row.gaps.D).toBe("No D: no skaters played");
    expect(result.data!.rows.filter(other => other.team !== team).every(other => !other.picks.F && !other.picks.D)).toBe(true);
  });
  it("needs availability, identity and sample, and says which failed", () => {
    const team = topTeam();
    expect(rowOf(build([{ id: 1, team, status: "IR" }]).data, team).gaps.F).toBe("No F: 1 unavailable");
    expect(rowOf(build([{ id: 1, team, status: "DTD" }]).data, team).picks.F?.nhlId).toBe(1);
    expect(rowOf(build([{ id: 1, team, games: 4 }]).data, team).gaps.F).toBe("No F: 1 short sample");
    expect(rowOf(build([{ id: 1, team, shots: null }]).data, team).gaps.F).toBe("No F: 1 short sample");
    const noMap = world([{ id: 1, team }]);
    expect(rowOf(buildOffNightEdge({ edition: edition(THURSDAY, "rest-of-week"), settings: settings(), ...noMap, map: [] }).data, team).gaps.F).toBe("No F: 1 no identity");
    const twoIds = world([{ id: 1, team }]);
    expect(rowOf(buildOffNightEdge({ edition: edition(THURSDAY, "rest-of-week"), settings: settings(), ...twoIds, map: [...twoIds.map, { yahoo_player_id: "465.p.1", nhl_player_id: "777" }] }).data, team).gaps.F).toBe("No F: 1 no identity");
    const moved = world([{ id: 1, team }]);
    moved.yahoo[0].editorial_team_abbreviation = "ZZZ";
    expect(rowOf(buildOffNightEdge({ edition: edition(THURSDAY, "rest-of-week"), settings: settings(), ...moved }).data, team).gaps.F).toBe("No F: 1 no identity");
  });
  it("binds a traded skater to the latest game's team, not a former one", () => {
    const [newTeam, oldTeam] = offNightSchedule(edition(THURSDAY, "rest-of-week"), "rest-of-week").rows.map(row => row.team);
    const fixture = world([{ id: 1, team: newTeam }]);
    fixture.appearances.filter(row => row.playerId === 1).slice(0, 3).forEach(row => { row.team = oldTeam; });
    const result = buildOffNightEdge({ edition: edition(THURSDAY, "rest-of-week"), settings: settings(), ...fixture });
    expect(rowOf(result.data, newTeam).picks.F?.nhlId).toBe(1);
    expect(rowOf(result.data, oldTeam).picks.F).toBeNull();
  });
  it("ignores non-regular games and is partial when a team game has no skater rows", () => {
    const team = topTeam(), fixture = world([{ id: 1, team }]);
    const preseason = buildOffNightEdge({ edition: edition(THURSDAY, "rest-of-week"), settings: settings(), ...fixture, gameIds: fixture.gameIds.slice(1) });
    expect(preseason.state).toBe("ready");
    expect(rowOf(preseason.data, team).gaps.F).toBe("No F: 1 short sample");
    const gap = buildOffNightEdge({ edition: edition(THURSDAY, "rest-of-week"), settings: settings(), ...fixture, gameIds: [...fixture.gameIds, 999] });
    expect(gap.state).toBe("partial");
    expect(gap.evidence.coverage).toEqual({ observed: 10, expected: 12, missing: 2, unit: "team games" });
    expect(sharePostExportBlock(offNightEdgeModule, snapshotOf(gap), settings())).toMatch(/2 of 12/);
  });
});

describe("6.3 ownership states", () => {
  it("treats a stated 0% as known and eligible", () => {
    const team = topTeam(), result = build([{ id: 1, team, pct: 0 }]);
    expect(rowOf(result.data, team).picks.F?.ownership).toEqual({ state: "known", pct: 0, asOf: "2026-10-29" });
    expect(result.data!.ownership).toMatchObject({ known: 1, unknown: 0 });
  });
  it("excludes unknown unless the visible setting includes it, and never reads it as 0", () => {
    const team = topTeam(), skaters = [{ id: 1, team, pct: null }];
    const off = build(skaters);
    expect(rowOf(off.data, team).picks.F).toBeNull();
    expect(rowOf(off.data, team).gaps.F).toBe("No F: 1 unknown %");
    expect(off.evidence.cohort).toContain("unknown % excluded");
    const on = build(skaters, { includeUnknown: "on" });
    expect(rowOf(on.data, team).picks.F?.ownership).toEqual({ state: "unknown", pct: null, asOf: null });
    expect(on.evidence.cohort).toContain("unknown % included");
    expect(on.data!.ownership).toMatchObject({ known: 0, unknown: 1 });
  });
  it("orders a known low owner ahead of unknown on equal scores", () => {
    const team = topTeam(), result = build([{ id: 1, team, pct: null }, { id: 2, team, pct: 40 }], { includeUnknown: "on" });
    expect(rowOf(result.data, team).picks.F?.nhlId).toBe(2);
  });
  it("blocks export when some ownership is stale and refuses a card when most is", () => {
    const team = topTeam();
    const partial = build([{ id: 1, team }, { id: 2, team, updated: "2026-10-20 08:40:00" }]);
    expect(partial.state).toBe("partial");
    expect(partial.data!.ownership.stale).toBe(1);
    expect(sharePostExportBlock(offNightEdgeModule, snapshotOf(partial), settings())).toMatch(/older than a day/);
    const stale = build([{ id: 1, team, updated: "2026-10-20 08:40:00" }, { id: 2, team, updated: null }, { id: 3, team }]);
    expect(stale.state).toBe("stale");
    expect(stale.data).toBeNull();
    expect(stale.reasons?.[0]).toMatch(/2 of 3/);
  });
  it("does not let a stale row for an unqualified skater block the post", () => {
    const team = topTeam();
    expect(build([{ id: 1, team }, { id: 2, team, games: 2, updated: "2026-10-20 08:40:00" }]).state).toBe("ready");
  });
  it("is missing with no ownership rows, and not exportable with nothing to pick", () => {
    const team = topTeam(), fixture = world([{ id: 1, team }]);
    expect(buildOffNightEdge({ edition: edition(THURSDAY, "rest-of-week"), settings: settings(), ...fixture, yahoo: [] }).state).toBe("missing");
    const empty = build([{ id: 1, team, pct: 90 }]);
    expect(empty.state).toBe("ready");
    expect(sharePostExportBlock(offNightEdgeModule, snapshotOf(empty), settings())).toBe("Nothing qualifies with these settings.");
  });
});

describe("6.4 card and registration", () => {
  it("is registered with visible, validated settings", () => {
    expect(shareModule("off-night-edge")).toBe(offNightEdgeModule);
    expect(parseShareSettings(offNightEdgeModule, {})).toEqual({ ownershipCeiling: 50, includeUnknown: "off", dates: "rest-of-week" });
    expect(() => parseShareSettings(offNightEdgeModule, { ownershipCeiling: "101" })).toThrow(SharePostRequestError);
    expect(() => parseShareSettings(offNightEdgeModule, { dates: "someday" })).toThrow(SharePostRequestError);
  });
  it("prints GP by day, picks, 0%, unknown as a dash and the gap reason", () => {
    const team = topTeam(), active = settings({ includeUnknown: "on" });
    const result = build([{ id: 1, team, pct: 0 }, { id: 2, team, position: "D", pct: null }], { includeUnknown: "on" });
    const html = renderToStaticMarkup(createElement(OffNightEdgeCard, { data: result.data!, settings: active, logos: {} }));
    expect(html).toContain("Skater 1");
    expect(html).toContain("0% ·");
    expect(html).toContain("— ·");
    expect(html).not.toContain("null");
    expect(html).toContain("No F: no skaters played");
    expect(html).toContain("Games still to start");
    for (const day of result.data!.days) expect(html).toContain(`${day.label} ${day.leagueGames}`);
    expect(html).toContain("included, shown —");
    const alt = offNightEdgeModule.altText(snapshotOf(result, active) as never, result.data!, active);
    expect(alt).toContain("Skater 1 0%");
    expect(alt).toContain("Skater 2 —");
  });
  it("says so when no team has games left", () => {
    const data: OffNightData = { dates: "rest-of-week", weekStart: WEEK, weekEnd: "2026-11-01", days: [], rows: [], teamsWithGames: 0, countedGames: 0, tiedOut: [], ownership: { known: 0, unknown: 0, stale: 0, asOf: null } };
    expect(renderToStaticMarkup(createElement(OffNightEdgeCard, { data, settings: settings(), logos: {} }))).toContain("No team has a game left");
    expect(offNightEdgeModule.hasRows(data, settings())).toBe(false);
  });
});

describe("loader", () => {
  /** Answers each table's rows and records the filters asked for. */
  function fakeClient(tables: Record<string, unknown[]>) {
    const calls: { table: string; filters: string[] }[] = [];
    return { calls, client: { from(table: string) {
      const call = { table, filters: [] as string[] }; calls.push(call);
      const query: Record<string, unknown> = {};
      for (const method of ["select", "eq", "gte", "lte", "lt", "in", "order", "not", "is"]) query[method] = (column: string) => { if (method !== "select" && method !== "order") call.filters.push(`${method}:${column}`); return query; };
      query.range = async () => ({ data: tables[table] ?? [], error: null, count: (tables[table] ?? []).length });
      return query;
    } } };
  }
  beforeEach(() => upstream.getSchedule.mockReset());

  it("reads no players when the schedule edition is not ready", async () => {
    const partial = week(new Date().toISOString()); partial.numGamesPerDay = [1, 1, 1, 1, 1, 1, 1];
    upstream.getSchedule.mockResolvedValue({ ...partial, fetchedAt: new Date().toISOString() });
    const { client, calls } = fakeClient({});
    const result = await loadOffNightEdge({ client, generatedAt: new Date().toISOString() }, settings());
    expect(result.data).toBeNull();
    expect(calls).toEqual([]);
  });
  it("stamps the edition after the schedule read and keeps null ownership in the Yahoo read", async () => {
    const now = new Date().toISOString(), schedule = fictionalLeagueWeek(calendarWeekStart(now), now);
    upstream.getSchedule.mockResolvedValue({ ...schedule, games: schedule.games!.map(game => ({ ...game, startTimeUTC: `${game.gameDate}T23:59:00-04:00` })), fetchedAt: new Date().toISOString() });
    const { client, calls } = fakeClient({ yahoo_players: [{ player_key: "465.p.1", player_id: null, percent_ownership: null, season: 2026, last_updated: now }] });
    const result = await loadOffNightEdge({ client, generatedAt: now }, settings({ dates: "weekly" }));
    expect(result.reasons?.join(" ")).not.toMatch(/provenance/);
    expect(calls.map(call => call.table).sort()).toEqual(["games", "wgo_skater_stats", "yahoo_nhl_player_map_read", "yahoo_players"]);
    expect(calls.find(call => call.table === "yahoo_players")!.filters).toEqual(["eq:season"]);
    expect(result.data?.days.length).toBe(7);
  });
});
