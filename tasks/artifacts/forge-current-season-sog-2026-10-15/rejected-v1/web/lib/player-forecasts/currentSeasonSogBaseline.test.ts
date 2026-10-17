// @vitest-environment node
import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { assembleCurrentSeasonSogBaseline, CURRENT_SEASON_SOG_SCOPE as scope,
  type CurrentSeasonSogResponse, type CurrentSeasonSogResponses } from "./currentSeasonSogBaseline";
import { playerForecastSourcePayloadHash } from "./sourceSnapshot";

// All schedule, component values and capture clocks below are synthetic.
const now = new Date("2026-10-15T20:00:00.000Z");
function response(payload: unknown, url: string): CurrentSeasonSogResponse {
  const rawBody = JSON.stringify(payload);
  return { url, rawBody, capturedAt: "2026-10-15T19:00:00Z",
    bodySha256: createHash("sha256").update(rawBody).digest("hex") };
}
function game(id: number, date: string, state = "OFF") {
  return { id, season: scope.seasonId, gameType: 2, gameDate: date, startTimeUTC: `${date}T23:00:00Z`,
    homeTeam: { id: 13 }, awayTeam: { id: scope.teamId }, gameState: state };
}
export function syntheticSogResponses(): CurrentSeasonSogResponses {
  const games = [game(2026020001, "2026-10-08"), game(2026020002, "2026-10-10"),
    game(scope.targetGameId, "2026-10-15", "FUT")];
  return { schedule: response({ games }, `https://api-web.nhle.com/v1/club-schedule-season/VAN/${scope.seasonId}`),
    boxscores: games.slice(0, 2).map((g, index) => response({ ...g,
      playerByGameStats: { homeTeam: { forwards: [{ playerId: 1, toi: "12:00" }], defense: [], goalies: [{ playerId: 2 }] },
        awayTeam: { forwards: [{ playerId: scope.nhlPlayerId, toi: "20:00", sog: index ? 4 : 0 }], defense: [], goalies: [{ playerId: 3 }] } } },
    `https://api-web.nhle.com/v1/gamecenter/${g.id}/boxscore`)) };
}
function change(row: CurrentSeasonSogResponse, edit: (payload: any) => void) {
  const payload = JSON.parse(row.rawBody); edit(payload);
  Object.assign(row, response(payload, row.url));
}

describe("current-season conditional SOG initializer (synthetic receipts only)", () => {
  it("initializes without projections/prior seasons and preserves exact raw bytes/clocks", () => {
    const input = syntheticSogResponses(), before = JSON.stringify(input);
    const result = assembleCurrentSeasonSogBaseline(input, now);
    expect(result.target).toMatchObject({ targetKey: "SHOTS_ON_GOAL", mean: 2, totalShots: 4, sampleSize: 2,
      basis: "per_appearance", sampleDates: ["2026-10-10", "2026-10-08"] });
    expect(result.version).toBe("current-season-sog-appearance-mean-v1");
    expect(result).toMatchObject({ status: "unreleased_local", participation: null, uncertainty: null,
      calibration: "unavailable", publicUsesApproved: false, cutoffAt: now.toISOString(), expiresAt: "2026-10-15T23:00:00.000Z" });
    expect(result.sourceReceipts).toEqual(input);
    expect(result.appearances[0].finalBoxscore).toMatchObject({ fetchedAt: "2026-10-15T19:00:00Z" });
    const { payloadHash, ...unsigned } = result;
    expect(payloadHash).toBe(playerForecastSourcePayloadHash(unsigned));
    expect(JSON.stringify(input)).toBe(before);
    expect(result).not.toHaveProperty("projections");
  });
  it.each(["zero", "absent"])("excludes %s-minute/nonlisted evidence without imputing SOG or participation", kind => {
    const input = syntheticSogResponses();
    change(input.boxscores[1], p => {
      if (kind === "zero") p.playerByGameStats.awayTeam.forwards[0].toi = "00:00";
      else p.playerByGameStats.awayTeam.forwards[0].playerId = 4;
    });
    const result = assembleCurrentSeasonSogBaseline(input, now);
    expect(result.target).toMatchObject({ mean: 0, sampleSize: 1 });
    expect(result.exclusions).toEqual([{ gameId: 2026020002,
      reason: kind === "zero" ? "zero_minutes" : "not_listed_in_complete_boxscore" }]);
    expect(result.participation).toBeNull();
  });
  it.each(["hash", "url", "future", "beforeGame", "scheduleBeforeGame", "duplicate", "missing", "extra",
    "nonfinal", "wrongGame", "wrongSeason", "wrongDate", "wrongStart", "wrongTeam", "duplicatePlayer",
    "incomplete", "negativeSog", "missingSog", "conflictingSog", "invalidMinutes", "priorSeason", "scheduleConflict",
    "external", "started", "staleSchedule", "bytes"])("rejects %s source/scope rather than emitting a partial estimate", kind => {
    const input = syntheticSogResponses();
    if (kind === "hash") input.boxscores[0].bodySha256 = "a".repeat(64);
    if (kind === "url") input.boxscores[0].url += "?other=true";
    if (kind === "future") input.boxscores[0].capturedAt = "2026-10-15T20:00:00.000001Z";
    if (kind === "beforeGame") input.boxscores[0].capturedAt = "2026-10-08T22:59:59Z";
    if (kind === "scheduleBeforeGame") input.schedule.capturedAt = "2026-10-08T20:00:00Z";
    if (kind === "staleSchedule") input.schedule.capturedAt = "2026-10-14T19:59:59Z";
    if (kind === "duplicate") input.boxscores[1] = structuredClone(input.boxscores[0]);
    if (kind === "missing") input.boxscores.pop();
    if (kind === "extra") input.boxscores.push(structuredClone(input.boxscores[0]));
    if (kind === "nonfinal") change(input.boxscores[0], p => { p.gameState = "LIVE"; });
    if (kind === "wrongGame") change(input.boxscores[0], p => { p.id += 1; });
    if (kind === "wrongSeason") change(input.boxscores[0], p => { p.season = 20252026; });
    if (kind === "wrongDate") change(input.boxscores[0], p => { p.gameDate = "2026-10-09"; });
    if (kind === "wrongStart") change(input.boxscores[0], p => { p.startTimeUTC = "2026-10-08T23:00:00.000001Z"; });
    if (kind === "wrongTeam") change(input.boxscores[0], p => { p.awayTeam.id = 1; });
    if (kind === "duplicatePlayer") change(input.boxscores[0], p => { p.playerByGameStats.homeTeam.forwards[0].playerId = scope.nhlPlayerId; });
    if (kind === "incomplete") change(input.boxscores[0], p => { delete p.playerByGameStats.homeTeam.goalies; });
    if (["negativeSog", "missingSog", "conflictingSog", "invalidMinutes"].includes(kind)) change(input.boxscores[0], p => {
      const player = p.playerByGameStats.awayTeam.forwards[0];
      if (kind === "negativeSog") player.sog = -1;
      if (kind === "missingSog") delete player.sog;
      if (kind === "conflictingSog") player.shots = 3;
      if (kind === "invalidMinutes") player.toi = "unknown";
    });
    if (kind === "priorSeason") change(input.schedule, p => { p.games[0].season = 20252026; });
    if (kind === "scheduleConflict") change(input.schedule, p => { p.games.push(p.games[0]); });
    if (kind === "external") Object.assign(input, { projections: [] });
    if (kind === "started") change(input.schedule, p => { p.games[2].startTimeUTC = now.toISOString(); });
    if (kind === "bytes") input.boxscores[0].rawBody = " ".repeat(scope.maximumSourceBytes);
    expect(() => assembleCurrentSeasonSogBaseline(input, now)).toThrow();
  });
  it("withholds when no positive-minute observations remain", () => {
    const input = syntheticSogResponses();
    for (const row of input.boxscores) change(row, p => { p.playerByGameStats.awayTeam.forwards[0].toi = "00:00"; });
    expect(() => assembleCurrentSeasonSogBaseline(input, now)).toThrow(/No admitted/);
  });
});
