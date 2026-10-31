import { readFileSync } from "node:fs";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { buildCreaseShift, creaseShiftModule, editionCutoff, reconcileSchedule, type CreaseShiftData, type ScheduledGame } from "./creaseShift";
import type { CompletedTeamGame, GoalieAppearance } from "./shared/goalieLedger";
import { teamsInfo } from "lib/teamsInfo";

const NJD = teamsInfo.NJD.id, NYR = teamsInfo.NYR.id;
const date = (index: number) => `2026-10-${String(index + 1).padStart(2, "0")}`;
const game = (team: string, index: number, gameId = 1000 + index): CompletedTeamGame => ({ gameId, date: date(index), team });
const row = (goalieId: number, team: string, index: number, started: boolean | null = true, gameId = 1000 + index): GoalieAppearance => ({
  goalieId, name: `G${goalieId}`, gameId, date: date(index), team, opponent: null, home: null, started, wins: 0, losses: 0, otLosses: 0, saves: 20, shotsAgainst: 22, goalsAgainst: 2, toiSeconds: 3600, shutouts: 0, qualityStart: 0,
});
const schedule = (games: readonly CompletedTeamGame[]): ScheduledGame[] => games.map(entry => ({ id: entry.gameId, date: entry.date, homeTeamId: teamsInfo[entry.team as "NJD"].id, awayTeamId: null })).map(entry => ({ ...entry, awayTeamId: entry.homeTeamId === NJD ? NYR : NJD }));
/** NJD games only, with NYR's side reported too, so the schedule reconciles. */
const reportBoth = (games: readonly CompletedTeamGame[]) => games.flatMap(entry => [entry, { ...entry, team: entry.team === "NJD" ? "NYR" : "NJD" }]);
const base = { teams: ["NJD"], window: 5, comparison: "previous" as const, through: "2026-10-30" };
const twenty = Array.from({ length: 10 }, (_, index) => game("NJD", index));

describe("crease shift", () => {
  it("uses completed team games as the denominator, not appearances, and counts relief apart", () => {
    // Goalie 1 starts games 0-5, 7 and 9; goalie 2 starts 6 and 8 and relieves in 9.
    const appearances = [...twenty.map((_, index) => row(index === 6 || index === 8 ? 2 : 1, "NJD", index)), row(2, "NJD", 9, false)];
    const result = buildCreaseShift({ ...base, reported: reportBoth(twenty), appearances, scheduled: schedule(twenty) });
    const njd = result.data!.teams[0];
    expect(njd.games).toBe(5);
    expect(njd.startersUsed).toBe(2);
    const one = njd.goalies.find(goalie => goalie.goalieId === 1)!, two = njd.goalies.find(goalie => goalie.goalieId === 2)!;
    expect(one.starts).toBe(3);
    expect(one.share).toBe(0.6);
    expect(two.starts).toBe(2);
    expect(two.relief).toBe(1);
    expect(two.share).toBe(0.4);
    expect(one.share! + two.share!).toBe(1);
    expect(one.comparisonShare).toBe(1);
    expect(one.change).toBe(-40);
    expect(njd.shift).toBe(40);
    expect(result.state).toBe("ready");
  });
  it("binds a traded goalie's games to the team he played for", () => {
    const games = [game("NJD", 0), game("NJD", 1), game("NYR", 2, 2000), game("NYR", 3, 2001)];
    const appearances = [row(1, "NJD", 0), row(1, "NJD", 1), row(1, "NYR", 2, true, 2000), row(3, "NYR", 3, true, 2001)];
    const scheduled = [{ id: 1000, date: date(0), homeTeamId: NJD, awayTeamId: teamsInfo.PHI.id }, { id: 1001, date: date(1), homeTeamId: NJD, awayTeamId: teamsInfo.PHI.id }, { id: 2000, date: date(2), homeTeamId: NYR, awayTeamId: teamsInfo.PHI.id }, { id: 2001, date: date(3), homeTeamId: NYR, awayTeamId: teamsInfo.PHI.id }];
    const phi = scheduled.map(entry => ({ gameId: entry.id, date: entry.date, team: "PHI" }));
    const result = buildCreaseShift({ ...base, teams: ["NJD", "NYR"], window: 2, reported: [...games, ...phi], appearances, scheduled });
    const nyr = result.data!.teams.find(team => team.team === "NYR")!, njd = result.data!.teams.find(team => team.team === "NJD")!;
    expect(nyr.goalies.find(goalie => goalie.goalieId === 1)).toMatchObject({ starts: 1, share: 0.5, otherTeams: ["NJD"] });
    expect(njd.goalies.find(goalie => goalie.goalieId === 1)).toMatchObject({ starts: 2, share: 1, otherTeams: ["NYR"] });
  });
  it("withholds a window with a doubled or missing starter, and never reports its share as 0", () => {
    for (const appearances of [
      [...twenty.map((_, index) => row(1, "NJD", index)), row(2, "NJD", 9)],
      twenty.slice(0, 9).map((_, index) => row(1, "NJD", index)),
      [...twenty.slice(0, 9).map((_, index) => row(1, "NJD", index)), row(1, "NJD", 9, null)],
    ]) {
      const result = buildCreaseShift({ ...base, reported: reportBoth(twenty), appearances, scheduled: schedule(twenty) });
      const njd = result.data!.teams[0];
      expect(njd.rank).toBeNull();
      expect(njd.shift).toBeNull();
      expect(njd.withheld).toMatch(/1 of 5 window games lack exactly one labeled starter/);
      expect(njd.goalies.every(goalie => goalie.share === null && goalie.change === null)).toBe(true);
      expect(result.state).toBe("partial");
    }
  });
  it("shows a short team window at its actual count", () => {
    const games = twenty.slice(0, 7), appearances = games.map((_, index) => row(1, "NJD", index));
    const njd = buildCreaseShift({ ...base, reported: reportBoth(games), appearances, scheduled: schedule(games) }).data!.teams[0];
    expect(njd).toMatchObject({ games: 5, short: false, comparisonGames: 2, comparisonShort: true, shift: 0, rank: 1 });
    const few = buildCreaseShift({ ...base, reported: reportBoth(games.slice(0, 3)), appearances: appearances.slice(0, 3), scheduled: schedule(games.slice(0, 3)) }).data!.teams[0];
    expect(few).toMatchObject({ games: 3, short: true, comparisonGames: 0, rank: null, withheld: "No completed games in the comparison window." });
  });
  it("discloses the overlap when comparing with season to date", () => {
    const appearances = twenty.map((_, index) => row(1, "NJD", index));
    const result = buildCreaseShift({ ...base, comparison: "std", reported: reportBoth(twenty), appearances, scheduled: schedule(twenty) });
    expect(result.data!.teams[0]).toMatchObject({ comparisonGames: 10, overlap: 5 });
    expect(result.evidence.sample).toMatch(/season to date, which contains the recent games/);
  });
  it("shares a rank when changes are equal on different denominators", () => {
    // Both go from 50% to 100%: NJD on 1 of 2 comparison games, NYR on 2 of 4.
    const teamGames = (team: string, count: number, offset: number) => Array.from({ length: count }, (_, index) => game(team, index, offset + index));
    const njd = teamGames("NJD", 7, 3000), nyr = teamGames("NYR", 9, 4000);
    const appearances = [...njd.map((entry, index) => row(index === 0 ? 2 : 1, "NJD", index, true, entry.gameId)), ...nyr.map((entry, index) => row(index < 2 ? 4 : 3, "NYR", index, true, entry.gameId))];
    const result = buildCreaseShift({ ...base, teams: ["NJD", "NYR"], reported: [...njd, ...nyr], appearances, scheduled: [...njd, ...nyr].map(entry => ({ id: entry.gameId, date: entry.date, homeTeamId: teamsInfo[entry.team as "NJD"].id, awayTeamId: null })) });
    expect(result.data!.teams.map(team => [team.team, team.comparisonGames, team.shift, team.rank])).toEqual([["NJD", 2, 50, 1], ["NYR", 4, 50, 1]]);
  });
});

describe("schedule reconciliation", () => {
  it("compares team games with the schedule, and one missing team game is partial", () => {
    const appearances = twenty.map((_, index) => row(1, "NJD", index)), reported = reportBoth(twenty).slice(0, -1);
    expect(reconcileSchedule(schedule(twenty), reported)).toMatchObject({ scheduledGames: 10, expected: 20, observed: 19, missing: 1 });
    const result = buildCreaseShift({ ...base, reported, appearances, scheduled: schedule(twenty) });
    expect(result.state).toBe("partial");
    expect(result.reasons?.[0]).toMatch(/1 of 20 scheduled team games/);
    expect(result.evidence.coverage).toEqual({ observed: 19, expected: 20, missing: 1, unit: "team games" });
  });
  it("drops a reported game the regular-season schedule does not list", () => {
    const preseason = { gameId: 9, date: "2026-09-20", team: "NJD" };
    expect(reconcileSchedule(schedule(twenty), [...reportBoth(twenty), preseason]).games).toHaveLength(20);
  });
  it("runs through yesterday in New York", () => {
    expect(editionCutoff("2026-11-01T02:00:00Z")).toBe("2026-10-30");
  });
});

describe("crease shift card", () => {
  const appearances = twenty.map((_, index) => row(index < 7 ? 1 : 2, "NJD", index));
  const load = buildCreaseShift({ ...base, reported: reportBoth(twenty), appearances, scheduled: schedule(twenty) });
  const render = async (data: CreaseShiftData) => {
    const Card = await creaseShiftModule.card();
    return renderToStaticMarkup(createElement(Card, { data, logos: {}, settings: { window: "5", comparison: "previous" }, snapshot: {} as never }));
  };
  it("names official starts and team games, and claims nothing about the next start", async () => {
    const html = await render(load.data!);
    expect(html).toContain("Official starts ÷ completed team games");
    expect(html).toContain("3/5");
    expect(html).not.toMatch(/probab|likely|odds|expected to start|will start|appearance share/i);
    expect(creaseShiftModule.altText({ evidence: load.evidence } as never, load.data, { window: "5", comparison: "previous" })).not.toMatch(/probab|likely|odds|will start/i);
  });
  it("has nothing to export when no team resolves", async () => {
    const empty = buildCreaseShift({ ...base, reported: [], appearances: [], scheduled: [] });
    expect(creaseShiftModule.hasRows(empty.data, { window: "5", comparison: "previous" })).toBe(false);
    expect(await render(empty.data!)).toContain("No team has both windows resolved");
  });
  it("leaves the appearance pie alone: this post reads no appearance share", () => {
    expect(readFileSync("lib/socialShare/modules/creaseShift.ts", "utf8")).not.toMatch(/goalieWorkload|GoalieShareChart"/);
  });
});
