import { describe, expect, it } from "vitest";
import { buildGoalieWorkloadView, goalieHistoryWindow, type GoalieWorkloadSnapshot } from "./goalieWorkloadView";
import type { GoalieAppearance } from "lib/socialShare/modules/shared/goalieLedger";
const dates = { today: "2026-11-11", selectedFrom: "2026-11-09", selectedThrough: "2026-11-15", seasonStartsOn: "2026-10-01", seasonId: 20262027 };
const row = (gameId: number, goalieId: number, started: boolean | null, team = "BOS"): GoalieAppearance => ({ gameId, goalieId,
  name: `Goalie ${goalieId}`, date: "2026-11-09", team, opponent: "MTL", home: true, started,
  wins: null, losses: null, otLosses: null, saves: null, shotsAgainst: null, goalsAgainst: null, toiSeconds: null, shutouts: null, qualityStart: null });
const snapshot = (): GoalieWorkloadSnapshot => ({ version: "goalie-workload-view-v1", seasonId: dates.seasonId, seasonStartsOn: dates.seasonStartsOn,
  source: "fixture", revision: "1", observedAt: "2026-11-11T16:00:00Z", dataThrough: "2026-11-09", basis: "current_recorded_results",
  scheduleComplete: true, appearancesComplete: true, scheduleVerifiedThrough: "2026-11-11",
  games: [1, 2].map(gameId => ({ gameId, date: "2026-11-09", team: "BOS", seasonId: dates.seasonId, state: "final", completedAt: "2026-11-10T03:00:00Z" })),
  appearances: [row(1, 10, true), row(1, 20, false), row(2, 20, true)] });
const build = (s = snapshot()) => buildGoalieWorkloadView("BOS", { kind: "team_games", count: 10 }, s, dates);
describe("Goalie workload descriptive windows", () => {
  it("counts the official pulled starter separately from long relief and relief wins", () => {
    const s = snapshot(); s.appearances[0].toiSeconds = 60; s.appearances[0].wins = 0;
    s.appearances[1].toiSeconds = 3500; s.appearances[1].wins = 1;
    expect(build(s).goalies.map(g => [g.starts, g.appearances, g.reliefAppearances, g.knownStartShare])).toEqual([[1, 1, 0, .5], [1, 2, 1, .5]]);
    expect(build(s).shortSample).toBe(true); expect(build(s).denominator).toBe(2);
  });
  it.each([null, false] as const)("keeps a missing or nonunique starter unresolved (%s)", label => {
    const s = snapshot(); s.appearances[2].started = label;
    const v = build(s); expect(v.unresolvedStarts).toBe(1); expect(v.resolvedStarts).toBe(1);
    expect(v.goalies.reduce((n, g) => n + (g.knownStartShare ?? 0), 0)).toBe(.5);
  });
  it("does not publish the ledger's zero sentinel as a complete share", () => {
    const s = snapshot(); s.appearances[1].started = true;
    const v = build(s); expect(v.unresolvedStarts).toBe(1); expect(v.goalies.find(g => g.playerId === 10)?.starts).toBe(0);
    expect(v.state).toBe("partial");
  });
  it("keeps team at game time through trades, and does not manufacture starts for a call-up", () => {
    const s = snapshot(); s.appearances = [...s.appearances, row(3, 10, true, "MTL")];
    s.games = [...s.games, { ...s.games[0], gameId: 3, team: "MTL" }];
    expect(build(s).goalies.find(g => g.playerId === 10)?.starts).toBe(1);
    expect(build(s).goalies.find(g => g.playerId === 99)).toBeUndefined();
  });
  it("preserves requested dates and data-through separately; past windows end before their first day", () => {
    expect(goalieHistoryWindow({ kind: "calendar_days", count: 7 }, dates)).toEqual({ from: "2026-11-05", through: "2026-11-11", requestedGames: null });
    expect(goalieHistoryWindow({ kind: "calendar_days", count: 7 }, { ...dates, selectedFrom: "2026-11-02", selectedThrough: "2026-11-08" })).toEqual({ from: "2026-10-26", through: "2026-11-01", requestedGames: null });
    expect(build().through).toBe("2026-11-11"); expect(build().dataThrough).toBe("2026-11-09");
  });
  it("does not extrapolate a partial schedule or infer zero on missing data", () => {
    const s = snapshot(); s.scheduleComplete = false;
    expect(build(s).denominator).toBeNull(); expect(build(s).goalies.every(g => g.knownStartShare === null)).toBe(true);
    expect(buildGoalieWorkloadView("BOS", { kind: "season" }, null, dates).state).toBe("unavailable");
  });
  const scopedSnapshot = (): GoalieWorkloadSnapshot => {
    const s = snapshot();
    s.games = ["02", "04", "06", "08", "09", "10"].map((day, index) => ({ ...s.games[0], gameId: index + 1,
      date: `2026-11-${day}`, completedAt: `2026-11-${day}T23:00:00Z` }));
    s.appearances = s.games.map((g, index) => ({ ...row(g.gameId, index % 2 ? 20 : 10, true), date: g.date }));
    s.scheduleComplete = false;
    s.scheduleCoverage = { version: "stored-team-schedule-v1", from: dates.seasonStartsOn, through: dates.today,
      scheduledGames: 7, gaps: [{ gameId: 99, date: "2026-10-02", reason: "not_final" }] };
    return s;
  };
  it("keeps a fully covered recent window usable despite an older season gap", () => {
    const s = scopedSnapshot();
    const recent = buildGoalieWorkloadView("BOS", { kind: "team_games", count: 5 }, s, dates);
    expect(recent.state).toBe("complete"); expect(recent.denominator).toBe(5);
    expect(recent.goalies.map(g => g.knownStartShare)).toEqual([.6, .4]);
    expect(buildGoalieWorkloadView("BOS", { kind: "calendar_days", count: 7 }, s, dates).denominator).toBe(4);
    expect(buildGoalieWorkloadView("BOS", { kind: "season" }, s, dates).denominator).toBeNull();
    expect(build(s).denominator).toBeNull(); // Fewer than ten verified games: the whole season is relevant.
  });
  it.each(["2026-11-04", "2026-11-09", "2026-11-11"])("withholds a recent window when a gap at %s can change its denominator", date => {
    const s = scopedSnapshot(); s.scheduleCoverage!.gaps[0].date = date;
    const v = buildGoalieWorkloadView("BOS", { kind: "team_games", count: 5 }, s, dates);
    expect(v.state).toBe("partial"); expect(v.denominator).toBeNull();
  });
  it("does not infer complete coverage from an unbound, truncated or contradictory schedule receipt", () => {
    for (const change of [
      (s: GoalieWorkloadSnapshot) => { s.scheduleCoverage!.scheduledGames = 8; },
      (s: GoalieWorkloadSnapshot) => { s.scheduleCoverage!.gaps = []; },
      (s: GoalieWorkloadSnapshot) => { s.scheduleCoverage!.gaps.push({ ...s.scheduleCoverage!.gaps[0] }); },
      (s: GoalieWorkloadSnapshot) => { s.scheduleCoverage!.gaps[0].gameId = 1; },
      (s: GoalieWorkloadSnapshot) => { s.scheduleCoverage!.through = "2026-11-10"; },
      (s: GoalieWorkloadSnapshot) => { s.scheduleCoverage!.from = "2026-11-05"; },
      (s: GoalieWorkloadSnapshot) => { s.appearancesComplete = false; },
      (s: GoalieWorkloadSnapshot) => { s.games.at(-1)!.completedAt = "2026-11-12T00:00:00Z"; },
    ]) {
      const s = scopedSnapshot(); change(s);
      expect(buildGoalieWorkloadView("BOS", { kind: "team_games", count: 5 }, s, dates).denominator).toBeNull();
    }
  });
  it("treats a final game missing its report as a gap and does not let a global complete flag hide it", () => {
    const s = scopedSnapshot(); s.scheduleComplete = true;
    s.scheduleCoverage!.gaps[0] = { gameId: 99, date: "2026-11-10", reason: "unreported" };
    expect(buildGoalieWorkloadView("BOS", { kind: "calendar_days", count: 7 }, s, dates).denominator).toBeNull();
  });
  it("distinguishes a covered empty calendar window from an empty stored season", () => {
    const s = scopedSnapshot(); s.games = s.games.slice(0, 1); s.appearances = s.appearances.slice(0, 1);
    s.scheduleCoverage!.scheduledGames = 2;
    const v = buildGoalieWorkloadView("BOS", { kind: "calendar_days", count: 7 }, s, dates);
    expect(v.state).toBe("no_games"); expect(v.denominator).toBe(0);
    s.games = []; s.appearances = []; s.scheduleCoverage!.gaps = []; s.scheduleCoverage!.scheduledGames = 0;
    expect(buildGoalieWorkloadView("BOS", { kind: "calendar_days", count: 7 }, s, dates).denominator).toBeNull();
  });
  it("uses completed games and New York dates across DST; no prior-season carryover", () => {
    const s = snapshot(); s.games = [{ ...s.games[0], completedAt: "2026-11-12T00:30:00-05:00" }];
    expect(build(s).observedTeamGames).toBe(0);
    expect(goalieHistoryWindow({ kind: "calendar_days", count: 30 }, { ...dates, today: "2026-10-04" }).from).toBe("2026-10-01");
    s.seasonId = 20252026; expect(build(s).state).toBe("unavailable");
  });
  it("fails closed on duplicate data and validates dates", () => {
    const s = snapshot(); s.appearances = [...s.appearances, s.appearances[0]];
    expect(build(s).state).toBe("unavailable");
    expect(() => goalieHistoryWindow({ kind: "season" }, { ...dates, today: "2026-02-30" })).toThrow();
  });
  it("accepts an observed single game-end event without inventing a completion timestamp", () => {
    const s = snapshot();
    s.games = s.games.map(g => ({ ...g, completedAt: null, finality: { basis: "single_stored_game_end", observedAt: s.observedAt } }));
    expect(build(s).denominator).toBe(2);
    s.games = s.games.map(g => ({ ...g, finality: undefined }));
    expect(build(s).observedTeamGames).toBe(0);
  });
});
