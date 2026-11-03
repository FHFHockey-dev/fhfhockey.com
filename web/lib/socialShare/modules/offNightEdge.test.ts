import calcWeekScore from "components/GameGrid/utils/calcWeekScore";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import OffNightEdgeCard from "components/SocialShare/modules/OffNightEdgeCard";
import { fictionalLeagueWeek } from "lib/socialShare/fixtures";
import { buildScheduleSnapshot, calendarWeekStart } from "lib/socialShare/schedule";
import type { SocialScheduleData, SocialScheduleGame } from "lib/socialShare/types";
import { activeTeamAbbreviations, teamsInfo } from "lib/teamsInfo";
import { parseShareSettings, sharePostExportBlock, SharePostRequestError, type SharePostSnapshot } from "./contract";
import { buildOffNightEdge, OFF_NIGHT_THIS_WEEK, offNightEdgeModule, offNightSchedule, offNightSelectedDates, offNightWeeks, resolveOffNightWindow, type OffNightData, type OffNightSettings, type OffNightYahooRow } from "./offNightEdge";
import { loadOffNightEdge } from "./offNightEdge.sources";
import { shareModule } from "./registry";
import type { SkaterAppearance } from "./shared/skaterAppearances";

const upstream = vi.hoisted(() => ({ getSchedule: vi.fn() }));
vi.mock("lib/NHL/server", () => upstream);

const WEEK = "2026-10-26", THURSDAY = "2026-10-29T12:00:00Z", MONDAY = "2026-10-26T12:00:00Z";
const settings = (over: Partial<OffNightSettings> = {}): OffNightSettings => ({ ownershipCeiling: 50, includeUnknown: "off", dates: "rest-of-week", period: OFF_NIGHT_THIS_WEEK, week: null, start: null, end: null, ...over });
/** The fictional league week as of a moment: earlier days are final. */
function week(at: string): SocialScheduleData {
  const schedule = fictionalLeagueWeek(WEEK, new Date(Date.parse(at) - 60000).toISOString());
  return { ...schedule, games: schedule.games!.map(game => game.gameDate! < at.slice(0, 10) ? { ...game, gameState: "OFF" } : game) };
}
const edition = (at: string, dates: OffNightSettings["dates"], schedule = week(at)) => buildScheduleSnapshot({ format: dates === "weekly" ? "game-grid" : "remaining-week", weekStart: WEEK, schedule, generatedAt: at, selectedDates: offNightSelectedDates(WEEK, at.slice(0, 10), dates) });
const weekOf = (monday: string) => offNightWeeks(monday, new Date(Date.parse(`${monday}T12:00:00Z`) + 6 * 86400000).toISOString().slice(0, 10))[0].dates;
const topTeam = (at = THURSDAY, dates: OffNightSettings["dates"] = "rest-of-week") => offNightSchedule(edition(at, dates), dates).rows[0].team;

/** `games` are his newest games unless `out` drops that many of the team's newest, as for a scratch or an injury. */
type Skater = { id: number; team: string; position?: string; pct?: number | null; status?: string | null; updated?: string | null; games?: number; out?: number; shots?: number | null; yahooKey?: string };
const DATES = ["2026-10-20", "2026-10-22", "2026-10-24", "2026-10-26", "2026-10-28"];
/** Each team gets its own five games, with an opposing row so team-game coverage reconciles. */
function world(skaters: readonly Skater[]) {
  const teams = [...new Set(skaters.map(skater => skater.team))], gameIds = teams.flatMap((_, t) => DATES.map((__, i) => (t + 1) * 100 + i));
  const row = (playerId: number, team: string, gameId: number, date: string, group: "F" | "D", shots: number | null): SkaterAppearance => ({ playerId, name: `Skater ${playerId}`, position: group === "D" ? "D" : "C", group, gameId, date, team, opponent: null, home: true, goals: 1, assists: 1, points: 2, shots, hits: 1, blocks: 1, ppPoints: 0, toiSeconds: 960, ppToiSeconds: 0, penaltyMinutes: 0 });
  const appearances = skaters.flatMap(skater => DATES.slice(0, DATES.length - (skater.out ?? 0)).slice(-(skater.games ?? 5)).map(date => row(skater.id, skater.team, (teams.indexOf(skater.team) + 1) * 100 + DATES.indexOf(date), date, skater.position === "D" ? "D" : "F", skater.shots === undefined ? 3 : skater.shots)));
  const opponents = gameIds.map(id => row(9000 + id, "ZZZ", id, DATES[id % 100], "F", 1));
  const yahoo: OffNightYahooRow[] = skaters.map(skater => ({ player_key: skater.yahooKey ?? `465.p.${skater.id}`, player_id: null, player_name: `Skater ${skater.id}`, editorial_team_abbreviation: skater.team, display_position: skater.position ?? "C", eligible_positions: [{ position: skater.position ?? "C" }], position_type: "P", percent_ownership: skater.pct === undefined ? 10 : skater.pct, status: skater.status ?? null, season: 2026, last_updated: skater.updated === undefined ? "2026-10-29 08:40:00" : skater.updated } as OffNightYahooRow));
  const map = skaters.map(skater => ({ yahoo_player_id: skater.yahooKey ?? `465.p.${skater.id}`, nhl_player_id: String(skater.id) }));
  return { appearances: [...appearances, ...opponents], yahoo, map, gameIds, from: "2026-10-08", through: "2026-10-28" };
}
/** The default period's window, for the cases that are about the rest of the post. */
const edge = (input: Omit<Parameters<typeof buildOffNightEdge>[0], "window">) => {
  const { window } = resolveOffNightWindow(input.settings, { weeks: [], reasons: [] }, (input.edition as { generatedAt: string }).generatedAt);
  return buildOffNightEdge({ ...input, window: window! });
};
const build = (skaters: readonly Skater[], over: Partial<OffNightSettings> = {}, at = THURSDAY) => {
  const active = settings(over);
  return edge({ edition: edition(at, active.dates), settings: active, ...world(skaters) });
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
    const built = edge({ edition: edition(THURSDAY, "rest-of-week", schedule), settings: settings(), ...world([{ id: 1, team: teams[0].abbrev }]) });
    for (const team of result.tiedOut) expect(built.evidence.cohort).toContain(team);
  });
  it("publishes no order from a schedule that is not ready", () => {
    const partial = week(THURSDAY); partial.numGamesPerDay = [1, 1, 1, 1, 1, 1, 1];
    const unready = edge({ edition: edition(THURSDAY, "rest-of-week", partial), settings: settings(), ...world([{ id: 1, team: "NJD" }]) });
    expect(unready.state).toBe("partial");
    expect(unready.data).toBeNull();
    const old = { ...week(THURSDAY), fetchedAt: "2026-10-28T12:00:00Z" };
    const stale = edge({ edition: edition(THURSDAY, "rest-of-week", old), settings: settings(), ...world([{ id: 1, team: "NJD" }]) });
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
    expect(rowOf(build([{ id: 1, team, status: "IR", games: 3, out: 2 }, { id: 2, team, position: "D" }]).data, team).gaps.F).toBe("No F: 1 unavailable");
    expect(rowOf(build([{ id: 1, team, status: "DTD" }]).data, team).picks.F?.nhlId).toBe(1);
    expect(rowOf(build([{ id: 1, team, shots: null }]).data, team).gaps.F).toBe("No F: 1 no complete game");
    const noMap = world([{ id: 1, team }]);
    expect(rowOf(edge({ edition: edition(THURSDAY, "rest-of-week"), settings: settings(), ...noMap, map: [] }).data, team).gaps.F).toBe("No F: 1 no identity");
    const twoIds = world([{ id: 1, team }]);
    expect(rowOf(edge({ edition: edition(THURSDAY, "rest-of-week"), settings: settings(), ...twoIds, map: [...twoIds.map, { yahoo_player_id: "465.p.1", nhl_player_id: "777" }] }).data, team).gaps.F).toBe("No F: 1 no identity");
    const moved = world([{ id: 1, team }]);
    moved.yahoo[0].editorial_team_abbreviation = "ZZZ";
    expect(rowOf(edge({ edition: edition(THURSDAY, "rest-of-week"), settings: settings(), ...moved }).data, team).gaps.F).toBe("No F: 1 no identity");
  });
  it("binds a traded skater to the latest game's team, not a former one", () => {
    const [newTeam, oldTeam] = offNightSchedule(edition(THURSDAY, "rest-of-week"), "rest-of-week").rows.map(row => row.team);
    const fixture = world([{ id: 1, team: newTeam }]);
    fixture.appearances.filter(row => row.playerId === 1).slice(0, 3).forEach(row => { row.team = oldTeam; });
    const result = edge({ edition: edition(THURSDAY, "rest-of-week"), settings: settings(), ...fixture });
    expect(rowOf(result.data, newTeam).picks.F?.nhlId).toBe(1);
    expect(rowOf(result.data, oldTeam).picks.F).toBeNull();
  });
  it("ignores non-regular games and is partial when a team game has no skater rows", () => {
    const team = topTeam(), fixture = world([{ id: 1, team }]);
    const preseason = edge({ edition: edition(THURSDAY, "rest-of-week"), settings: settings(), ...fixture, gameIds: fixture.gameIds.slice(1) });
    expect(preseason.state).toBe("ready");
    expect(rowOf(preseason.data, team).picks.F).toMatchObject({ nhlId: 1, games: 4, shortSample: true });
    const gap = edge({ edition: edition(THURSDAY, "rest-of-week"), settings: settings(), ...fixture, gameIds: [...fixture.gameIds, 999] });
    expect(gap.state).toBe("partial");
    expect(gap.evidence.coverage).toEqual({ observed: 10, expected: 12, missing: 2, unit: "team games" });
    expect(sharePostExportBlock(offNightEdgeModule, snapshotOf(gap), settings())).toMatch(/2 of 12/);
  });
});

describe("SS-1103-D pickups", () => {
  /** Adds games before the fixture's five, with their opposing rows, so a skater has a rate to be hot against. */
  function earlier(fixture: ReturnType<typeof world>, team: string, players: { id: number; position?: "F" | "D"; points: number }[]) {
    const dates = ["2026-10-14", "2026-10-16", "2026-10-18"], base = 9000 + fixture.gameIds.length;
    const ids = dates.map((_, index) => base + index), template = fixture.appearances.find(row => row.team === team)!;
    const rows = players.flatMap(player => dates.map((date, index) => ({ ...template, playerId: player.id, name: `Skater ${player.id}`, group: player.position ?? "F", position: player.position === "D" ? "D" : "C", gameId: ids[index], date, goals: player.points, assists: 0, points: player.points, shots: 0, hits: 0, blocks: 0 })));
    const opponents = ids.map((gameId, index) => ({ ...template, playerId: 99000 + index, team: "ZZZ", gameId, date: dates[index] }));
    return { ...fixture, appearances: [...rows, ...opponents, ...fixture.appearances], gameIds: [...fixture.gameIds, ...ids] };
  }
  it("prefers a HOT skater over a better score, and falls back to the score when none is hot", () => {
    const [team, other] = offNightSchedule(edition(THURSDAY, "rest-of-week"), "rest-of-week").rows.map(row => row.team);
    const fixture = world([{ id: 1, team, shots: 6 }, { id: 2, team, shots: 4 }, { id: 3, team: other, shots: 0 }]);
    // Skater 1 was this good before too; skater 2 has jumped from nothing.
    const hot = edge({ edition: edition(THURSDAY, "rest-of-week"), settings: settings(), ...earlier(fixture, team, [{ id: 1, points: 2 }, { id: 2, points: 0 }]) });
    expect(rowOf(hot.data, team).picks.F).toMatchObject({ nhlId: 2, hot: true, shortSample: false });
    expect(hot.evidence.sample).toMatch(/HOT means L5 fantasy points per game at least 1\.25× his earlier games/);
    const cold = edge({ edition: edition(THURSDAY, "rest-of-week"), settings: settings(), ...earlier(fixture, team, [{ id: 1, points: 2 }, { id: 2, points: 2 }]) });
    expect(rowOf(cold.data, team).picks.F).toMatchObject({ nhlId: 1, hot: false });
    const html = renderToStaticMarkup(createElement(OffNightEdgeCard, { data: hot.data!, settings: settings(), logos: {} }));
    expect(html).toContain('data-chip="hot">HOT</em>');
  });
  it("uses a short sample only when no full sample qualifies, and chips it", () => {
    const team = topTeam();
    expect(rowOf(build([{ id: 1, team, games: 2 }, { id: 2, team, shots: 0 }]).data, team).picks.F).toMatchObject({ nhlId: 2, shortSample: false });
    const short = build([{ id: 1, team, games: 2 }, { id: 2, team, pct: 90 }]);
    expect(rowOf(short.data, team).picks.F).toMatchObject({ nhlId: 1, games: 2, shortSample: true, hot: false });
    expect(renderToStaticMarkup(createElement(OffNightEdgeCard, { data: short.data!, settings: settings(), logos: {} }))).toContain('data-chip="short">Short Sample</em>');
  });
  it("keeps a skater who played his team's last games pickable whatever Yahoo's status says, and notes it", () => {
    const team = topTeam(), result = build([{ id: 1, team, status: "NA" }, { id: 2, team, position: "D", status: "IR", games: 4, out: 1 }]);
    expect(rowOf(result.data, team).picks).toMatchObject({ F: { nhlId: 1 }, D: { nhlId: 2 } });
    expect(result.pageNotes?.join(" ")).toMatch(/Yahoo marks 2 eligible skaters IR, O or NA although each played/);
  });
  it("says why a % rostered is unknown in a page note, and never calls it 0%", () => {
    const team = topTeam(), result = build([{ id: 1, team, pct: null }, { id: 2, team }]);
    expect(rowOf(result.data, team).picks.F?.nhlId).toBe(2);
    expect(result.pageNotes?.join(" ")).toMatch(/1 eligible skaters have no Yahoo % rostered.*unknown, not 0%.*Off\./);
  });
  it("shows each day's opponent logo and lists opponents so export waits for their logos", () => {
    const team = topTeam(), result = build([{ id: 1, team }]), row = rowOf(result.data, team);
    const index = row.gamesByDay.findIndex(count => count > 0), opponent = row.opponentsByDay[index][0];
    expect(row.opponentsByDay.map(list => list.length)).toEqual(row.gamesByDay);
    expect(result.teams).toContain(opponent);
    const html = renderToStaticMarkup(createElement(OffNightEdgeCard, { data: result.data!, settings: settings(), logos: { [opponent]: "data:image/png;base64,AA==" } }));
    expect(html).toContain(`alt="${opponent}"`);
  });
});

describe("SS-1103-D late feed", () => {
  const scheduledOf = (fixture: ReturnType<typeof world>) => [...new Map(fixture.appearances.map(row => [row.gameId, { id: row.gameId, date: row.date }])).values()];
  it("ends the form at the last complete night when the newest is late, stays exportable and says so", () => {
    const team = topTeam(), fixture = world([{ id: 1, team }]), late = DATES[DATES.length - 1];
    // The newest night's skater rows have not arrived for either team.
    const result = edge({ edition: edition(THURSDAY, "rest-of-week"), settings: settings(), ...fixture, appearances: fixture.appearances.filter(row => row.date !== late), scheduled: scheduledOf(fixture) });
    expect(result.state).toBe("ready");
    expect(result.evidence.sample).toMatch(new RegExp(`to ${DATES[DATES.length - 2]}:`));
    expect(result.pageNotes?.[0]).toBe("Oct 28 is not fully reported yet, so this card ends Oct 26.");
    expect(rowOf(result.data, team).picks.F).toMatchObject({ nhlId: 1, games: 4, shortSample: true });
    expect(sharePostExportBlock(offNightEdgeModule, snapshotOf(result), settings())).toBeNull();
  });
  it("keeps an older gap partial, and leaves a complete window alone", () => {
    const team = topTeam(), fixture = world([{ id: 1, team }]), older = DATES[1];
    const gap = edge({ edition: edition(THURSDAY, "rest-of-week"), settings: settings(), ...fixture, appearances: fixture.appearances.filter(row => !(row.date === older && row.team === "ZZZ")), scheduled: scheduledOf(fixture) });
    expect(gap.state).toBe("partial");
    expect(gap.pageNotes?.some(note => /not fully reported/.test(note))).toBe(false);
    const whole = edge({ edition: edition(THURSDAY, "rest-of-week"), settings: settings(), ...fixture, scheduled: scheduledOf(fixture) });
    expect(whole.state).toBe("ready");
    expect(whole.evidence.sample).toMatch(/to 2026-10-28:/);
  });
  it("is unavailable, not partial, when no night in the form window is fully reported", () => {
    const team = topTeam(), fixture = world([{ id: 1, team }]);
    const none = edge({ edition: edition(THURSDAY, "rest-of-week"), settings: settings(), ...fixture, appearances: fixture.appearances.filter(row => row.team !== "ZZZ"), scheduled: scheduledOf(fixture) });
    expect(none.state).toBe("missing");
    expect(none.data).toBeNull();
    expect(none.reasons?.[0]).toMatch(/^No night from 2026-10-08 to 2026-10-28 is fully reported/);
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
    expect(build([{ id: 1, team }, { id: 2, team, games: 2, out: 3, status: "O", updated: "2026-10-20 08:40:00" }]).state).toBe("ready");
  });
  it("is missing with no ownership rows, and not exportable with nothing to pick", () => {
    const team = topTeam(), fixture = world([{ id: 1, team }]);
    expect(edge({ edition: edition(THURSDAY, "rest-of-week"), settings: settings(), ...fixture, yahoo: [] }).state).toBe("missing");
    const empty = build([{ id: 1, team, pct: 90 }]);
    expect(empty.state).toBe("ready");
    expect(sharePostExportBlock(offNightEdgeModule, snapshotOf(empty), settings())).toBe("Nothing qualifies with these settings.");
  });
});

describe("6.4 card and registration", () => {
  it("is registered with visible, validated settings", () => {
    expect(shareModule("off-night-edge")).toBe(offNightEdgeModule);
    expect(parseShareSettings(offNightEdgeModule, {})).toEqual({ ownershipCeiling: 50, includeUnknown: "off", dates: "rest-of-week", period: OFF_NIGHT_THIS_WEEK, week: null, start: null, end: null });
    expect(() => parseShareSettings(offNightEdgeModule, { ownershipCeiling: "101" })).toThrow(SharePostRequestError);
    expect(() => parseShareSettings(offNightEdgeModule, { dates: "someday" })).toThrow(SharePostRequestError);
  });
  it("prints opponents by day, picks, 0% and unknown as a dash, and keeps the gap reason off the card", () => {
    const team = topTeam(), active = settings({ includeUnknown: "on" });
    const result = build([{ id: 1, team, pct: 0 }, { id: 2, team, position: "D", pct: null }], { includeUnknown: "on" });
    const html = renderToStaticMarkup(createElement(OffNightEdgeCard, { data: result.data!, settings: active, logos: {} }));
    expect(html).toContain("Skater 1");
    expect(html).toContain("0% ·");
    expect(html).toContain("— ·");
    expect(html).not.toContain("null");
    expect(html).not.toContain("No F:");
    expect(html).toContain("No pick");
    expect(result.pageNotes?.some(note => / No F: no skaters played\.$/.test(note))).toBe(true);
    expect(html).toContain("Rest of week");
    for (const day of result.data!.days) expect(html).toContain(`${day.label.slice(0, 2).toUpperCase()}<small>${day.leagueGames}</small>`);
    expect(html).toContain("— unknown %");
    expect(result.evidence.sample).toContain("ownership among qualified skaters: 1 known, 1 unknown, 0 stale");
    const alt = offNightEdgeModule.altText(snapshotOf(result, active) as never, result.data!, active);
    expect(alt).toContain("Skater 1 0%");
    expect(alt).toContain("Skater 2 —");
    expect(alt).toContain("NHL games by day:");
    expect(alt).not.toContain("No F:");
    expect(alt).toContain(result.evidence.cohort);
  });
  it("says so when no team has games left", () => {
    const data: OffNightData = { dates: "rest-of-week", window: { kind: OFF_NIGHT_THIS_WEEK, week: null, from: WEEK, through: "2026-11-01", label: "Rest of week", past: false, playedIncluded: false }, weekStart: WEEK, weekEnd: "2026-11-01", days: [], rows: [], teamsWithGames: 0, countedGames: 0, tiedOut: [], ownership: { known: 0, unknown: 0, stale: 0, asOf: null } };
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

describe("period control", () => {
  const shift = (date: string, days: number) => new Date(Date.parse(`${date}T12:00:00Z`) + days * 86400000).toISOString().slice(0, 10);
  const now = new Date().toISOString(), thisMonday = calendarWeekStart(now), lastMonday = shift(thisMonday, -7), twoAgo = shift(thisMonday, -14);
  /** A matchup calendar around now, with a 14-day week over the two before this one. */
  const matchups = [{ week: 1, start_date: twoAgo, end_date: shift(lastMonday, 6) }, { week: 2, start_date: thisMonday, end_date: shift(thisMonday, 6) }, { week: 3, start_date: shift(thisMonday, 7), end_date: shift(thisMonday, 13) }, { week: 4, start_date: shift(thisMonday, 14), end_date: shift(thisMonday, 20) }];
  /** Each Monday's slate is seeded differently, so an order can only come from the week asked for. */
  const slate = (monday: string) => {
    const schedule = fictionalLeagueWeek(monday, now, Number(monday.replaceAll("-", "")));
    return { ...schedule, fetchedAt: new Date().toISOString(), games: schedule.games!.map(game => ({ ...game, gameState: game.gameDate! < now.slice(0, 10) ? "OFF" : "FUT", startTimeUTC: `${game.gameDate}T23:59:00-04:00` })) };
  };
  const client = (tables: Record<string, unknown[]> = { yahoo_matchup_weeks: matchups, yahoo_players: [{ player_key: "465.p.1", player_id: null, percent_ownership: 10, season: 2026, last_updated: now }] }) => ({ tables: [] as string[], from(table: string) {
    (this as { tables: string[] }).tables.push(table);
    const query: Record<string, unknown> = {};
    for (const method of ["select", "eq", "gte", "lte", "order"]) query[method] = () => query;
    query.range = async () => ({ data: tables[table] ?? [], error: null, count: (tables[table] ?? []).length });
    return query;
  } });
  beforeEach(() => { upstream.getSchedule.mockReset(); upstream.getSchedule.mockImplementation(async (monday: string) => slate(monday)); });

  it("recomputes score, order and days for the chosen matchup, from that week's schedule only", async () => {
    const chosen = await loadOffNightEdge({ client: client(), generatedAt: now }, settings({ period: "matchup", week: 3 }));
    expect(upstream.getSchedule.mock.calls.map(call => call[0])).toEqual([shift(thisMonday, 7)]);
    const edition = buildScheduleSnapshot({ format: "game-grid", weekStart: shift(thisMonday, 7), schedule: slate(shift(thisMonday, 7)), generatedAt: new Date().toISOString(), selectedDates: weekOf(shift(thisMonday, 7)) });
    expect(chosen.data!.rows.map(row => [row.team, row.score])).toEqual(offNightSchedule(edition, "weekly").rows.map(row => [row.team, row.score]));
    expect(chosen.data!.days.map(day => day.date)).toEqual(weekOf(shift(thisMonday, 7)));
    expect(chosen.data!.window).toMatchObject({ kind: "matchup", week: 3, past: false, playedIncluded: false });
    upstream.getSchedule.mockClear();
    const current = await loadOffNightEdge({ client: client(), generatedAt: now }, settings({ dates: "weekly" }));
    expect(current.data!.rows.map(row => row.team)).not.toEqual(chosen.data!.rows.map(row => row.team));
  });
  it("scores a 14-day week as one horizon, across both schedule weeks, and fits its days on the card", async () => {
    const active = settings({ period: "matchup", week: 1 }), result = await loadOffNightEdge({ client: client(), generatedAt: now }, active);
    expect(upstream.getSchedule.mock.calls.map(call => call[0])).toEqual([twoAgo, lastMonday]);
    const data = result.data!, row = data.rows[0];
    expect(data.days.length).toBe(14);
    expect(data.countedGames).toBe(data.days.reduce((total, day) => total + day.leagueGames, 0));
    expect(row.games).toBe(row.gamesByDay.reduce((total, count) => total + count, 0));
    expect(row.score).toBe(calcWeekScore([], row.offNightGames, data.countedGames, row.games, data.days.flatMap((day, index) => Array<number>(row.gamesByDay[index]).fill(day.leagueGames)), true));
    expect(data.days[0].date).toBe(twoAgo);
    const html = renderToStaticMarkup(createElement(OffNightEdgeCard, { data, settings: active, logos: {} }));
    expect(html).toContain("data-compact");
    expect(html).toContain(`<i>${Number(shift(lastMonday, 6).slice(8))}</i>`);
  });
  it("labels past dates, and says picks and ownership are today's", async () => {
    const active = settings({ period: "matchup", week: 1 }), result = await loadOffNightEdge({ client: client(), generatedAt: now }, active);
    expect(result.data!.window.past).toBe(true);
    const html = renderToStaticMarkup(createElement(OffNightEdgeCard, { data: result.data!, settings: active, logos: {} }));
    expect(html).toContain("Week 1");
    expect(html).toContain("Past dates: picks and ownership are current, not as of then");
    expect(offNightEdgeModule.altText(snapshotOf(result as never, active) as never, result.data!, active)).toContain("past dates; picks and ownership are current");
    const upcoming = await loadOffNightEdge({ client: client(), generatedAt: now }, settings({ period: "matchup", week: 3 }));
    expect(renderToStaticMarkup(createElement(OffNightEdgeCard, { data: upcoming.data!, settings: active, logos: {} }))).not.toContain("off-night-past");
  });
  it("shows next week's full schedule whatever the dates setting says, labelled and with today's picks", async () => {
    const nextMonday = shift(thisMonday, 7), active = settings({ dates: "rest-of-week", period: "matchup", week: 3 }), result = await loadOffNightEdge({ client: client(), generatedAt: now }, active), data = result.data!;
    const full = slate(nextMonday);
    expect(data.days.map(day => day.date)).toEqual(weekOf(nextMonday));
    expect(data.countedGames).toBe(full.games.length);
    expect(data.rows.length).toBe(16);
    expect(data.dates).toBe("weekly");
    expect(data.window).toMatchObject({ upcoming: "next-week", past: false, playedIncluded: false });
    const row = data.rows[0];
    expect(row.score).toBe(calcWeekScore([], row.offNightGames, data.countedGames, row.games, data.days.flatMap((day, index) => Array<number>(row.gamesByDay[index]).fill(day.leagueGames)), true));
    expect(result.evidence.sample).toContain(`to ${shift(now.slice(0, 10), -1)}:`);
    const html = renderToStaticMarkup(createElement(OffNightEdgeCard, { data, settings: active, logos: {} }));
    expect(html).toContain("Next week · Week 3 · ");
    expect(html).toContain("Picks use recent form and ownership as of today");
    expect(html).not.toContain("off-night-past");
    expect(offNightEdgeModule.altText(snapshotOf(result as never, active) as never, data, active)).toContain("next week; picks use recent form and ownership as of today");
  });
  it("calls a later matchup upcoming, and neither label on this week", async () => {
    const later = await loadOffNightEdge({ client: client(), generatedAt: now }, settings({ period: "matchup", week: 4 }));
    expect(later.data!.window.upcoming).toBe("upcoming");
    expect(renderToStaticMarkup(createElement(OffNightEdgeCard, { data: later.data!, settings: settings(), logos: {} }))).toContain("Upcoming · Week 4 · ");
    const current = await loadOffNightEdge({ client: client(), generatedAt: now }, settings());
    expect(current.data!.window.upcoming).toBeNull();
  });
  it("gives a clear reason, not an empty ranking, for a schedule not yet published, and reads no players", async () => {
    const unpublished = (monday: string) => ({ ...slate(monday), games: [], numGamesPerDay: [0, 0, 0, 0, 0, 0, 0] });
    upstream.getSchedule.mockImplementation(async (monday: string) => unpublished(monday));
    const fake = client(), empty = await loadOffNightEdge({ client: fake, generatedAt: now }, settings({ period: "matchup", week: 3 }));
    expect(empty.state).toBe("missing");
    expect(empty.data).toBeNull();
    expect(empty.reasons?.[0]).toMatch(/^The NHL schedule shows no games yet for Week 3 .*It may not be published\.$/);
    expect(fake.tables).toEqual(["yahoo_matchup_weeks"]);
    upstream.getSchedule.mockImplementation(async (monday: string) => ({ ...unpublished(monday), coveredDates: [] }));
    const partial = await loadOffNightEdge({ client: client(), generatedAt: now }, settings({ period: "matchup", week: 3 }));
    expect(partial.data).toBeNull();
    expect(partial.reasons?.[0]).toMatch(/is not fully published/);
    upstream.getSchedule.mockRejectedValue(new Error("NHL 404"));
    const failed = await loadOffNightEdge({ client: client(), generatedAt: now }, settings({ period: "matchup", week: 3 }));
    expect(failed.state).toBe("missing");
    expect(failed.reasons?.[0]).toMatch(/could not be read\. It may not be published yet\.$/);
    await expect(loadOffNightEdge({ client: client(), generatedAt: now }, settings())).rejects.toThrow("NHL 404");
  });
  it("validates a custom range before any read, and keeps it to what fits", () => {
    const parse = (query: Record<string, string>) => parseShareSettings(offNightEdgeModule, { period: "custom", ...query });
    expect(() => parse({})).toThrow(/start date and an end date/);
    expect(() => parse({ start: "2026-10-20", end: "2026-10-20" })).toThrow(/must be before/);
    expect(() => parse({ start: "2026-10-20", end: "2026-11-03" })).toThrow(/at most 14 days/);
    expect(parse({ start: "2026-10-20", end: "2026-11-02" })).toMatchObject({ period: "custom", start: "2026-10-20", end: "2026-11-02" });
    expect(offNightWeeks("2026-10-20", "2026-11-02").map(week => [week.weekStart, week.dates.length])).toEqual([["2026-10-19", 6], ["2026-10-26", 7], ["2026-11-02", 1]]);
  });
  it("counts a custom range's dates, played or not, across its schedule weeks", async () => {
    const start = shift(thisMonday, -3), end = shift(thisMonday, 2), result = await loadOffNightEdge({ client: client(), generatedAt: now }, settings({ period: "custom", start, end }));
    expect(upstream.getSchedule.mock.calls.map(call => call[0])).toEqual([lastMonday, thisMonday]);
    expect(result.data!.days.map(day => day.date)).toEqual(Array.from({ length: 6 }, (_, index) => shift(start, index)));
    expect(result.data!.dates).toBe("weekly");
  });
  it("fails visibly with no schedule call when the dates cannot be resolved", async () => {
    const off = await loadOffNightEdge({ client: client(), generatedAt: now }, settings({ period: "matchup", week: 9 }));
    expect(off.state).toBe("missing");
    expect(off.data).toBeNull();
    expect(off.reasons?.[0]).toMatch(/Week 9 is not on the matchup calendar/);
    const outside = await loadOffNightEdge({ client: client(), generatedAt: now }, settings({ period: "custom", start: shift(twoAgo, -20), end: shift(twoAgo, -18) }));
    expect(outside.reasons?.[0]).toMatch(/inside the season/);
    expect(upstream.getSchedule).not.toHaveBeenCalled();
  });
  it("keeps old links as they were: dates alone is this week, with no matchup read", async () => {
    for (const dates of ["weekly", "rest-of-week"] as const) {
      const parsed = parseShareSettings<OffNightSettings>(offNightEdgeModule, { dates }), fake = client();
      expect(parsed).toMatchObject({ dates, period: OFF_NIGHT_THIS_WEEK });
      const result = await loadOffNightEdge({ client: fake, generatedAt: now }, parsed);
      expect(fake.tables).not.toContain("yahoo_matchup_weeks");
      expect(result.data!.dates).toBe(dates);
      expect(offNightEdgeModule.altText(snapshotOf(result as never, parsed) as never, result.data!, parsed)).toMatch(dates === "weekly" ? /^FHFH Off-Night Edge, full week, / : /^FHFH Off-Night Edge, rest of week, /);
    }
    expect(upstream.getSchedule.mock.calls.every(call => call[0] === thisMonday)).toBe(true);
  });
});
