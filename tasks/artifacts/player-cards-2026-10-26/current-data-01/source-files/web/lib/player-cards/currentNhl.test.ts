import { describe, expect, it } from "vitest";
import { buildCurrentNhlCard, parseCurrentNhlRequest, type CurrentNhlRequest } from "./currentNhl";

export const request: CurrentNhlRequest = { playerId: 8476453, season: 20262027, count: 5 };
export function sources() {
  return {
    identity: { playerId: 8476453, firstName: { default: "Test" }, lastName: { default: "Skater" }, currentTeamAbbrev: "TBL", position: "R", seasonTotals: [{ season: 20262027, gameTypeId: 2, leagueAbbrev: "NHL", gamesPlayed: 2 }] },
    history: { seasonId: 20262027, gameTypeId: 2, gameLog: [
      { gameId: 2026020167, gameDate: "2026-10-23", teamAbbrev: "TBL", goals: 1, assists: 2, points: 3, shots: 4, toi: "20:00" },
      { gameId: 2026020151, gameDate: "2026-10-20", teamAbbrev: "TBL", goals: 0, assists: 0, points: 0, shots: 0, toi: "10:00" },
    ] },
    schedule: { games: [
      { id: 2026020167, season: 20262027, gameType: 2, gameDate: "2026-10-23", startTimeUTC: "2026-10-24T01:00:00Z", gameState: "OFF", homeTeam: { abbrev: "COL" }, awayTeam: { abbrev: "TBL" } },
      { id: 2026020151, season: 20262027, gameType: 2, gameDate: "2026-10-20", startTimeUTC: "2026-10-21T01:00:00Z", gameState: "FINAL", homeTeam: { abbrev: "TBL" }, awayTeam: { abbrev: "MIN" } },
    ] }, observedAt: "2026-10-26T15:30:00Z",
  };
}
describe("current NHL counts are distinct from NST and historical cutoffs", () => {
  it("pools valid zeros/exposure, preserves provider versus UTC dates and leaves all ranks unqualified", () => {
    const card = buildCurrentNhlCard(request, sources());
    expect(card.state).toBe("ready"); expect(card.sample.gp).toBe(2); expect(card.sample.toiSeconds).toBe(1800);
    expect(card.values).toMatchObject({ goals: 1, assists: 2, points: 3, shots: 4, atoi: 15, goals60: 2, points60: 6, shots60: 8, shootingPct: 25 });
    expect(card.sample.sourceDates).toEqual(["2026-10-23", "2026-10-20"]); expect(card.sample.utcDates).toEqual(["2026-10-24", "2026-10-21"]);
    expect(card.issues).toContain("Known short season sample: 2/5 appearances."); expect(card.rankReason).toContain("no verified all-NHL"); expect(card.finalityStatement).toContain("not supplied");
  });
  it.each(["zero exposure", "goals without shots", "points mismatch", "missing shots"])("rejects %s before pooling", defect => {
    const input = sources(), row = input.history.gameLog[0];
    if (defect === "zero exposure") row.toi = "0:00";
    if (defect === "goals without shots") row.shots = 0;
    if (defect === "points mismatch") row.points = 4;
    if (defect === "missing shots") (row as { shots: unknown }).shots = null;
    const card = buildCurrentNhlCard(request, input); expect(card.state).toBe("unavailable"); expect(card.sample.gp).toBeNull(); expect(Object.values(card.values).every(value => value === null)).toBe(true);
  });
  it("distinguishes a legitimate zero-shot undefined percentage from missing source", () => {
    const input = sources(); for (const row of input.history.gameLog) { row.shots = 0; row.goals = 0; row.assists = 0; row.points = 0; }
    const card = buildCurrentNhlCard(request, input); expect(card.state).toBe("ready"); expect(card.values.shots60).toBe(0); expect(card.values.shootingPct).toBeNull(); expect(card.issues).toContain("Shooting percentage is undefined: zero shots on goal.");
  });
  it.each(["missing history", "duplicate identity", "nonfinal", "schedule mismatch", "future start", "goalie"])("fails closed on %s", defect => {
    const input = sources();
    if (defect === "missing history") input.history.gameLog.pop();
    if (defect === "duplicate identity") input.history.gameLog[1].gameId = input.history.gameLog[0].gameId;
    if (defect === "nonfinal") input.schedule.games[0].gameState = "LIVE";
    if (defect === "schedule mismatch") input.schedule.games[0].gameDate = "2026-10-22";
    if (defect === "future start") input.schedule.games[0].startTimeUTC = "2026-10-30T01:00:00Z";
    if (defect === "goalie") input.identity.position = "G";
    expect(buildCurrentNhlCard(request, input).state).toBe("unavailable");
  });
  it("requires stable player identity and unambiguous bounded request inputs", () => {
    const input = sources(); input.identity.playerId = 8479318; expect(() => buildCurrentNhlCard(request, input)).toThrow("identity");
    for (const query of [{ ...request, playerId: ["8476453"] }, { ...request, season: 20262028 }, { ...request, count: 6 }]) expect(() => parseCurrentNhlRequest(query)).toThrow();
    expect(parseCurrentNhlRequest({ playerId: "8476453", season: "20262027", count: "10" })).toEqual({ ...request, count: 10 });
  });
  it("selects by verified UTC start chronology rather than provider date or game-ID order", () => {
    const input = sources(); input.identity.seasonTotals[0].gamesPlayed = 6;
    input.history.gameLog = Array.from({ length: 6 }, (_, i) => ({ ...input.history.gameLog[0], gameId: 2026020106 - i }));
    input.schedule.games = input.history.gameLog.map((row, i) => ({ ...input.schedule.games[0], id: row.gameId, startTimeUTC: `2026-10-24T0${i + 1}:00:00Z` }));
    const card = buildCurrentNhlCard(request, input); expect(card.state).toBe("ready"); expect(card.sample.gameIds).toEqual([2026020101, 2026020102, 2026020103, 2026020104, 2026020105]);
  });
});
