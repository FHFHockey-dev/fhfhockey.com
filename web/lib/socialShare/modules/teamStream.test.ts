import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import TeamStreamCard from "components/SocialShare/modules/TeamStreamCard";
import TeamStreamPanel from "components/SocialShare/modules/TeamStreamPanel";
import { fictionalLeagueWeek } from "lib/socialShare/fixtures";
import { buildScheduleSnapshot, calendarWeekStart, currentSeason } from "lib/socialShare/schedule";
import type { SocialScheduleData } from "lib/socialShare/types";
import { parseShareSettings, SharePostRequestError, type SharePostSnapshot } from "./contract";
import { lineRowsFromCombinations } from "./lastNightsStandouts";
import { OFF_NIGHT_THIS_WEEK, offNightSchedule, offNightSelectedDates, type OffNightYahooRow } from "./offNightEdge";
import { shareModule } from "./registry";
import { editionDate } from "./shared/definitions";
import type { SkaterAppearance } from "./shared/skaterAppearances";
import { buildTeamStream, deltaText, metricText, resolveTeamStreamWindow, TEAM_STREAM_TEAMS, teamStreamDates, teamStreamDelta, teamStreamModule, teamStreamPicks, teamStreamPool, teamStreamRank, teamStreamSchedule, teamStreamSelected, type TeamStreamData, type TeamStreamReads, type TeamStreamSettings } from "./teamStream";
import { loadTeamStream } from "./teamStream.sources";
import { shiftDays } from "./teamGames";
import type { NstCountRow } from "./whatChanged";

const upstream = vi.hoisted(() => ({ getSchedule: vi.fn() }));
vi.mock("lib/NHL/server", () => upstream);

const WEEK = "2026-10-26", THURSDAY = "2026-10-29T12:00:00Z";
const settings = (over: Partial<TeamStreamSettings> = {}): TeamStreamSettings => ({ ownershipCeiling: 50, includeUnknown: "off", focus: "overall", metric: "fp", team: "", period: OFF_NIGHT_THIS_WEEK, week: null, start: null, end: null, ...over });
/** The fictional league week as of a moment: earlier days are final. */
function week(at: string): SocialScheduleData {
  const schedule = fictionalLeagueWeek(WEEK, new Date(Date.parse(at) - 60000).toISOString());
  return { ...schedule, games: schedule.games!.map(game => game.gameDate! < at.slice(0, 10) ? { ...game, gameState: "OFF" } : game) };
}
const editionOf = (active: TeamStreamSettings, at = THURSDAY) => [buildScheduleSnapshot({ format: teamStreamDates(active) === "weekly" ? "game-grid" : "remaining-week", weekStart: WEEK, schedule: week(at), generatedAt: at, selectedDates: offNightSelectedDates(WEEK, at.slice(0, 10), teamStreamDates(active)) })];
const [TOP, SECOND] = teamStreamSchedule(editionOf(settings()), "rest-of-week").rows.map(row => row.team);

/** Ten games per team, three days apart; the lookback (from Oct 8) holds the last seven. */
const DATES = ["2026-10-01", "2026-10-04", "2026-10-07", "2026-10-10", "2026-10-13", "2026-10-16", "2026-10-19", "2026-10-22", "2026-10-25", "2026-10-28"];
const FROM = "2026-10-08", THROUGH = "2026-10-28";
type Stats = Partial<Pick<SkaterAppearance, "goals" | "assists" | "shots" | "hits" | "blocks" | "ppPoints" | "toiSeconds" | "ppToiSeconds" | "penaltyMinutes">>;
type Skater = { id: number; team: string; group?: "F" | "D"; pct?: number; status?: string; l5?: Stats; prior?: Stats; games?: number; pimMissingLast?: true };
const BASE: Required<Stats> = { goals: 0, assists: 0, shots: 2, hits: 1, blocks: 1, ppPoints: 0, toiSeconds: 960, ppToiSeconds: 60, penaltyMinutes: 0 };
const gameId = (team: string, index: number) => ([TOP, SECOND].indexOf(team) + 1) * 100 + index;

function world(skaters: readonly Skater[], nstGaps: readonly { id: number; date: string }[] = []) {
  const teams = [...new Set(skaters.map(skater => skater.team))];
  const row = (skater: Skater, index: number): SkaterAppearance => {
    const stats = { ...BASE, ...(index >= DATES.length - 5 ? skater.l5 : skater.prior) }, group = skater.group ?? "F";
    return { playerId: skater.id, name: `Skater ${skater.id}`, position: group === "D" ? "D" : "C", group, gameId: gameId(skater.team, index), date: DATES[index], team: skater.team, opponent: "ZZZ", home: true, points: (stats.goals ?? 0) + (stats.assists ?? 0), ...stats, penaltyMinutes: skater.pimMissingLast && index === DATES.length - 1 ? null : stats.penaltyMinutes };
  };
  const history = skaters.flatMap(skater => DATES.map((_, index) => index).slice(-(skater.games ?? DATES.length)).map(index => row(skater, index)));
  const opponents = teams.flatMap(team => DATES.map((date, index): SkaterAppearance => ({ ...row({ id: 9000 + gameId(team, index), team }, index), team: "ZZZ" })));
  const lookback = [...history, ...opponents].filter(game => game.date >= FROM);
  const games = teams.flatMap(team => DATES.map((date, index) => ({ id: gameId(team, index), date })));
  const yahoo = skaters.map(skater => ({ player_key: `465.p.${skater.id}`, player_id: null, player_name: `Skater ${skater.id}`, editorial_team_abbreviation: skater.team, display_position: skater.group ?? "C", eligible_positions: [{ position: skater.group === "D" ? "D" : "C" }], position_type: "P", percent_ownership: skater.pct ?? 10, status: skater.status ?? null, season: 2026, last_updated: "2026-10-29 08:40:00" }) as OffNightYahooRow);
  const map = skaters.map(skater => ({ yahoo_player_id: `465.p.${skater.id}`, nhl_player_id: String(skater.id) }));
  const nst: NstCountRow[] = history.filter(game => !nstGaps.some(gap => gap.id === game.playerId && gap.date === game.date)).map(game => ({ player_id: game.playerId, date_scraped: game.date, season: 20262027, ixg: 0.2, iscfs: 1, icf: 4 }));
  return { lookback, history, yahoo, map, nst, games, lookbackGames: games.filter(game => game.date >= FROM) };
}
/** F2 is hot (L5 well above the five before and above the forward median); F4 scores most but carries Yahoo's O flag. */
const SKATERS: Skater[] = [
  { id: 1, team: TOP, l5: { goals: 1, penaltyMinutes: 2 }, prior: { goals: 1 }, pct: 30 },
  { id: 2, team: TOP, l5: { goals: 1, assists: 1 }, pct: 20 },
  { id: 3, team: TOP, l5: { hits: 5 }, prior: { hits: 5 }, pimMissingLast: true, pct: 5 },
  { id: 4, team: TOP, l5: { goals: 2 }, prior: { goals: 2 }, status: "O", pct: 15 },
  { id: 5, team: TOP, group: "D", l5: { blocks: 3 }, prior: { blocks: 3 }, pct: 8 },
  { id: 6, team: TOP, games: 3, pct: 2 },
  { id: 7, team: SECOND, l5: { goals: 1 }, prior: { goals: 1 }, pct: 12 },
];
const roleFor = (skaters: readonly Skater[] = SKATERS) => ({ rolling: lineRowsFromCombinations([{ gameId: gameId(TOP, 9), forwards: [1, 2, 3, 4, 6, 99], defensemen: [5, 98] }]), pp: [{ gameId: gameId(TOP, 9), playerId: 1, unit: 1 }, { gameId: gameId(TOP, 9), playerId: 2, unit: 2 }].filter(row => skaters.some(skater => skater.id === row.playerId)) });

function stream(skaters: readonly Skater[] = SKATERS, over: Partial<TeamStreamSettings> = {}, reads: Partial<TeamStreamReads> = {}, nstGaps: readonly { id: number; date: string }[] = []) {
  const active = settings(over), edition = editionOf(active), w = world(skaters, nstGaps);
  const { window } = resolveTeamStreamWindow(active, { weeks: [], reasons: [] }, THURSDAY);
  const pooled = teamStreamPool({ edition, window: window!, settings: active, appearances: w.lookback, yahoo: w.yahoo, map: w.map, gameIds: w.lookbackGames.map(game => game.id), scheduled: w.lookbackGames, from: FROM, through: THROUGH });
  if ("result" in pooled) throw new Error(pooled.result.reasons?.join(" "));
  return { stage: pooled.stage, result: buildTeamStream(pooled.stage, { history: w.history, historyGameIds: w.games.map(game => game.id), nst: w.nst, role: roleFor(skaters), ...reads }) };
}
const teamOf = (data: TeamStreamData | null, team: string) => data!.teams.find(row => row.team === team)!;
const candidate = (data: TeamStreamData | null, id: number) => data!.teams.flatMap(team => team.candidates).find(row => row.nhlId === id)!;

describe("schedule: the top eight by Off-Night Edge's Week Score", () => {
  it("keeps Off-Night's score and order, cut to eight, with each game's side and played state", () => {
    for (const active of [settings(), settings({ period: "custom", start: WEEK, end: "2026-11-01" })]) {
      const dates = teamStreamDates(active), edition = editionOf(active), result = teamStreamSchedule(edition, dates);
      expect(result.rows.map(row => [row.team, row.rank, row.score])).toEqual(offNightSchedule(edition, dates).rows.slice(0, TEAM_STREAM_TEAMS).map(row => [row.team, row.rank, row.score]));
      for (const row of result.rows) {
        expect(row.schedule.flat().length).toBe(row.games);
        row.schedule.forEach((games, index) => games.forEach(game => {
          const match = edition[0].games.find(item => item.date === result.days[index].date && [item.homeTeam.abbreviation, item.awayTeam.abbreviation].includes(row.team) && [item.homeTeam.abbreviation, item.awayTeam.abbreviation].includes(game.opponent))!;
          expect(game.home).toBe(match.homeTeam.abbreviation === row.team);
          expect(game.played).toBe(result.days[index].date < THURSDAY.slice(0, 10));
        }));
      }
    }
    expect(teamStreamDates(settings())).toBe("rest-of-week");
    expect(teamStreamDates(settings({ period: "matchup" }))).toBe("weekly");
  });
});

describe("streamers", () => {
  it("ranks Off-Night's way, keeps at least one defenseman, and leaves a flagged skater last", () => {
    const data = stream().result.data!, top = teamOf(data, TOP);
    expect(candidate(data, 2).hot).toBe(true);
    expect(candidate(data, 1).hot).toBe(false);
    expect(candidate(data, 4).yahooStatus).toBe("O");
    expect(candidate(data, 6)).toMatchObject({ shortSample: true, games: 3 });
    // F2 (HOT), F1, then F3 on merit: with no D among them, the best D takes the last slot.
    expect(teamStreamPicks(top.candidates, "overall").map(row => row.nhlId)).toEqual([2, 1, 5]);
    const all = teamStreamPicks(top.candidates, "overall", 10).map(row => row.nhlId);
    expect(all.slice(-2)).toEqual([6, 4]);
  });
  it("ranks a peripheral focus by its L5 per game, and the peripheral mix by percentile", () => {
    const top = teamOf(stream().result.data, TOP);
    expect(teamStreamPicks(top.candidates, "hits")[0].nhlId).toBe(3);
    expect(teamStreamPicks(top.candidates, "blocks")[0].nhlId).toBe(5);
    expect(teamStreamPicks(top.candidates, "pim")[0].nhlId).toBe(1);
    const mixed = teamStreamPicks(top.candidates, "peripherals");
    expect(mixed).toHaveLength(3);
    expect(mixed.map(row => row.peripheral!)).toEqual([...mixed.map(row => row.peripheral!)].sort((a, b) => b - a));
    expect(mixed.every(row => row.yahooStatus === null)).toBe(true);
  });
  it("prints L5 totals and keeps an unknown PIM unknown", () => {
    const data = stream().result.data!;
    expect(candidate(data, 1).totals).toEqual({ goals: 5, assists: 0, ppPoints: 0, shots: 10, pim: 10, hits: 5, blocks: 5 });
    expect(candidate(data, 3).totals.pim).toBeNull();
  });
});

describe("delta metrics", () => {
  it("compares the last five with the five before, joining NST by player and date, and never sums a partial window", () => {
    const data = stream(SKATERS, {}, {}, [{ id: 1, date: DATES[0] }]).result.data!, f1 = candidate(data, 1), f2 = candidate(data, 2);
    expect(f1.metrics.fp.l5).toBeCloseTo(f1.metrics.fp.prior!);
    expect(deltaText(teamStreamDelta(f1.metrics.fp))).toBe("0%");
    expect(teamStreamDelta(f2.metrics.fp)).toBeCloseTo((5.85 - 0.85) / 0.85);
    expect(deltaText(teamStreamDelta(f2.metrics.fp))).toBe("+588%");
    expect(metricText("toi", f1.metrics.toi.l5)).toBe("16:00");
    expect(f1.metrics.sog60.l5).toBeCloseTo(7.5);
    expect(f1.metrics.ixg60.l5).toBeCloseTo(0.75);
    // F1 lacks one NST game in the five before: that window is unknown, not a four-game rate.
    expect(f1.metrics.ixg60.prior).toBeNull();
    expect(deltaText(teamStreamDelta(f1.metrics.ixg60))).toBe("—");
    expect(candidate(data, 6).metrics.fp.prior).toBeNull();
    expect(deltaText(-0.084)).toBe("−8%");
  });
  it("leaves NST metrics unknown with a page note when the NST read failed", () => {
    const result = stream(SKATERS, {}, { nst: null }).result;
    expect(candidate(result.data, 1).metrics.ixg60.l5).toBeNull();
    expect(candidate(result.data, 1).metrics.fp.l5).not.toBeNull();
    expect(result.pageNotes).toContain("NST game logs could not be read, so ixG/60, iSCF/60 and iCF/60 show —.");
    expect(result.evidence.sources.find(source => source.name === "NST game logs")!.state).toBe("missing");
    expect(result.state).toBe("ready");
  });
});

describe("role chips", () => {
  it("reads line and PP unit from each skater's newest game; off the top two units or unknown gets no chip", () => {
    const data = stream().result.data!;
    expect(candidate(data, 1).role).toEqual({ line: "L1", pp: 1 });
    expect(candidate(data, 2).role).toEqual({ line: "L1", pp: 2 });
    expect(candidate(data, 5).role).toEqual({ line: "P1", pp: null });
    expect(candidate(data, 4).role).toEqual({ line: "L2", pp: null });
    expect(candidate(data, 7).role).toEqual({ line: null, pp: null });
  });
  it("drops every chip and says so when the role read failed", () => {
    const result = stream(SKATERS, {}, { role: null });
    expect(result.result.data!.teams.flatMap(team => team.candidates).every(row => !row.role.line && !row.role.pp)).toBe(true);
    expect(result.result.pageNotes).toContain("Line and power-play roles could not be read, so the card has no role chips.");
  });
});

describe("edition", () => {
  it("lists logos for the rail's opponents, notes a team with no defenseman, and labels its sources", () => {
    const { result, stage } = stream();
    expect(result.state).toBe("ready");
    expect(stage.ids).toEqual([1, 2, 3, 4, 5, 6, 7]);
    expect(result.teams).toEqual(expect.arrayContaining([TOP, SECOND, ...teamOf(result.data, TOP).schedule.flat().map(game => game.opponent)]));
    expect(result.pageNotes).toContain(`${SECOND} has no defenseman under the ceiling, so Best available shows forwards only.`);
    expect(result.pageNotes!.some(note => note.startsWith(`${result.data!.teams[2].team}: no streamer qualifies`))).toBe(true);
    expect(result.evidence.sources.map(source => source.name)).toEqual(["NHL schedule (Game Grid edition)", "NHL.com game stats", "Yahoo ownership", "NST game logs"]);
    expect(result.evidence.cohort).toMatch(/^Top 8 of \d+ teams with games; skaters at or under 50% rostered/);
  });
  it("marks a shared rank, inside the eight or with a team cut at the last rank", () => {
    const data = stream().result.data!, [one, two] = data.teams;
    expect(teamStreamRank({ teams: [{ ...one, rank: 1 }, { ...two, rank: 2 }], tiedOut: [] }, one)).toBe("1");
    expect(teamStreamRank({ teams: [{ ...one, rank: 1 }, { ...two, rank: 1 }], tiedOut: [] }, one)).toBe("T1");
    expect(teamStreamRank({ teams: [{ ...one, rank: 1 }, { ...two, rank: 2 }], tiedOut: ["XXX"] }, { ...two, rank: 2 })).toBe("T2");
  });
  it("selects the rail's team while it is in the top eight, else the top team", () => {
    const data = stream().result.data!;
    expect(teamStreamSelected(data, { team: SECOND })!.team).toBe(SECOND);
    expect(teamStreamSelected(data, { team: "" })!.team).toBe(TOP);
    expect(teamStreamSelected(data, { team: "XXX" })!.team).toBe(TOP);
  });
});

describe("module", () => {
  it("is registered with browser-only team, focus and metric, and Off-Night's custom-range limit", () => {
    expect(shareModule("team-stream")).toBe(teamStreamModule);
    const parsed = parseShareSettings(teamStreamModule, {});
    expect(parsed).toMatchObject({ focus: "overall", metric: "fp", team: "", period: OFF_NIGHT_THIS_WEEK, ownershipCeiling: 50 });
    expect(teamStreamModule.fields.filter(field => field.clientOnly).map(field => field.id)).toEqual(["focus", "metric", "team"]);
    expect(() => parseShareSettings(teamStreamModule, { period: "custom", start: "2026-11-01", end: "2026-11-20" })).toThrow(SharePostRequestError);
    expect(() => parseShareSettings(teamStreamModule, { metric: "xgf" })).toThrow(SharePostRequestError);
    expect(teamStreamModule.headline!(settings({ focus: "hits" }))).toBe("Team Stream · Hits");
  });
  it("has rows only when the selected team has a streamer, and describes the card in its alt text", () => {
    const data = stream().result.data!, empty = data.teams[2].team;
    expect(teamStreamModule.hasRows(data, settings())).toBe(true);
    expect(teamStreamModule.hasRows(data, settings({ team: empty }))).toBe(false);
    const snapshot = { evidence: { cohort: "Top 8" } } as SharePostSnapshot;
    const alt = teamStreamModule.altText(snapshot, data, settings());
    expect(alt).toContain(teamOf(data, TOP).teamName);
    expect(alt).toContain("Skater 2 (C, 20% rostered, hot, L1 PP2)");
    expect(alt).toContain("FP/GP");
  });
});

describe("card and rail", () => {
  afterEach(cleanup);
  it("draws the schedule rail, team band, and three streamers with their chips and delta", () => {
    const data = stream().result.data!, html = renderToStaticMarkup(createElement(TeamStreamCard, { data, settings: settings(), logos: {} }));
    expect(html).toContain(teamOf(data, TOP).teamName);
    for (const name of ["Skater 2", "Skater 1", "Skater 5"]) expect(html).toContain(name);
    expect(html).not.toContain("Skater 4");
    expect(html).toContain(">HOT<");
    expect(html).toContain(">PP1<");
    expect(html).toContain("+588%");
    expect(html).toContain("FP/GP Δ");
    expect(html.match(/data-testid="team-stream-player"/g)).toHaveLength(3);
    const hits = renderToStaticMarkup(createElement(TeamStreamCard, { data, settings: settings({ focus: "hits", metric: "toi" }), logos: {} }));
    expect(hits).toMatch(/data-focus="true" data-stat="hits"/);
    expect(hits).toContain("TOI/GP Δ");
    expect(renderToStaticMarkup(createElement(TeamStreamCard, { data, settings: settings({ team: data.teams[2].team }), logos: {} }))).toContain("No skater at or under 50% rostered qualifies");
  });
  it("lists the top eight with previews and sets the browser-only team on click", () => {
    const data = stream().result.data!, change = vi.fn();
    render(createElement(TeamStreamPanel, { data, settings: settings(), logos: {}, change, disabled: false, snapshot: {} as SharePostSnapshot<TeamStreamSettings, TeamStreamData> }));
    const buttons = screen.getAllByTestId("team-stream-team");
    expect(buttons).toHaveLength(TEAM_STREAM_TEAMS);
    expect(buttons[0].getAttribute("aria-pressed")).toBe("true");
    expect(buttons[0].textContent).toContain("Skater 2");
    fireEvent.click(buttons[1]);
    expect(change).toHaveBeenCalledWith("team", SECOND);
  });
});

describe("loader", () => {
  /** Answers each table's rows (or an error) and records the filters asked for. */
  function fakeClient(tables: Record<string, unknown[] | "error">) {
    const calls: { table: string; filters: string[] }[] = [];
    return { calls, client: { from(table: string) {
      const call = { table, filters: [] as string[] }; calls.push(call);
      const query: Record<string, unknown> = {};
      for (const method of ["select", "eq", "gte", "lte", "lt", "in", "order", "not", "is"]) query[method] = (column: string) => { if (method !== "select" && method !== "order") call.filters.push(`${method}:${column}`); return query; };
      query.range = async () => tables[table] === "error" ? { data: null, error: { message: "read failed" }, count: null } : { data: tables[table] ?? [], error: null, count: ((tables[table] as unknown[]) ?? []).length };
      return query;
    } } };
  }
  beforeEach(() => upstream.getSchedule.mockReset());
  const now = new Date().toISOString(), monday = calendarWeekStart(now);
  const slate = () => { const schedule = fictionalLeagueWeek(monday, now); return { ...schedule, fetchedAt: new Date().toISOString(), games: schedule.games!.map(game => ({ ...game, startTimeUTC: `${game.gameDate}T23:59:00-04:00` })) }; };

  it("reads nothing when the schedule edition is not ready", async () => {
    const partial = { ...slate(), numGamesPerDay: [1, 1, 1, 1, 1, 1, 1] };
    upstream.getSchedule.mockResolvedValue(partial);
    const { client, calls } = fakeClient({});
    const result = await loadTeamStream({ client, generatedAt: now }, settings());
    expect(result.data).toBeNull();
    expect(calls).toEqual([]);
  });
  it("reads the pool's history, NST rows and newest-game roles, and survives a failed NST read", async () => {
    upstream.getSchedule.mockResolvedValue(slate());
    const today = editionDate(now), through = shiftDays(today, -1), season = currentSeason(through);
    const top = teamStreamSchedule([buildScheduleSnapshot({ format: "remaining-week", weekStart: monday, schedule: slate(), generatedAt: now, selectedDates: offNightSelectedDates(monday, today, "rest-of-week") })], "rest-of-week").rows[0].team;
    const dates = [12, 9, 6, 3, 1].map(days => shiftDays(today, -days));
    const raw = (playerId: number, team: string, index: number) => ({ player_id: playerId, player_name: `Skater ${playerId}`, position_code: "C", date: dates[index], season_id: season, game_id: 500 + index, team_abbrev: team, opponent_team_abbrev: "ZZZ", home_road: "H", games_played: 1, goals: 1, assists: 0, points: 1, shots: 2, hits: 1, blocked_shots: 1, pp_points: 0, toi_per_game: 960, pp_toi: 60, penalty_minutes: 0 });
    const { client, calls } = fakeClient({
      wgo_skater_stats: dates.flatMap((_, index) => [raw(11, top, index), raw(9900 + index, "ZZZ", index)]),
      games: dates.map((date, index) => ({ id: 500 + index, date })),
      yahoo_players: [{ player_key: "465.p.11", player_id: null, player_name: "Skater 11", editorial_team_abbreviation: top, display_position: "C", eligible_positions: [{ position: "C" }], position_type: "P", percent_ownership: 10, status: null, season: Math.floor(season / 10000), last_updated: `${today} 08:00:00` }],
      yahoo_nhl_player_map_read: [{ yahoo_player_id: "465.p.11", nhl_player_id: "11" }],
      nst_gamelog_as_counts: "error", lineCombinations: [{ gameId: 504, forwards: [11], defensemen: [] }], powerPlayCombinations: [{ gameId: 504, playerId: 11, unit: 1 }],
    });
    const result = await loadTeamStream({ client, generatedAt: now }, settings());
    expect(calls.map(call => call.table).sort()).toEqual(["games", "lineCombinations", "nst_gamelog_as_counts", "powerPlayCombinations", "wgo_skater_stats", "wgo_skater_stats", "yahoo_nhl_player_map_read", "yahoo_players"]);
    expect(calls.filter(call => call.table === "wgo_skater_stats")[1].filters).toContain("in:player_id");
    expect(calls.find(call => call.table === "lineCombinations")!.filters).toEqual(["in:gameId", "eq:source_kind"]);
    expect(result.data!.teams[0].candidates[0]).toMatchObject({ nhlId: 11, role: { line: "L1", pp: 1 } });
    expect(result.pageNotes).toContain("NST game logs could not be read, so ixG/60, iSCF/60 and iCF/60 show —.");
  });
});
