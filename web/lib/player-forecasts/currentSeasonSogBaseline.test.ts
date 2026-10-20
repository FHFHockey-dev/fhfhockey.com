// @vitest-environment node
import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { assembleCurrentSeasonSogBaseline, CURRENT_SEASON_SOG_SCOPE as scope,
  CURRENT_SEASON_SOG_GAME_SCOPE_VERSION, type CurrentSeasonSogGameScope,
  type CurrentSeasonSogResponse, type CurrentSeasonSogResponses } from "./currentSeasonSogBaseline";
import { playerForecastSourcePayloadHash } from "./sourceSnapshot";
import { timestampMicros } from "../projections/evidenceTime";

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
      calibration: "unavailable", publicUsesApproved: false, cutoffAt: now.toISOString(), expiresAt: "2026-10-15T23:00:00Z" });
    expect(result.sourceReceipts).toEqual(input);
    expect(result.appearances[0].finalBoxscore).toMatchObject({ fetchedAt: "2026-10-15T19:00:00Z" });
    const { payloadHash, ...unsigned } = result;
    // Frozen from the pre-extension implementation using these synthetic bytes.
    expect(payloadHash).toBe("d47de024c0d34e93956691b0af8484ec717e6e59027dd1295c69eb18f0417515");
    expect(createHash("sha256").update(JSON.stringify(result)).digest("hex"))
      .toBe("33ad6f8d7abdb52a4a64ad046195775422c9343e0e02a6ae3a183dc5be30f50b");
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
  it.each(["2026-10-15T20:00:00.000001Z", "2026-10-15T21:00:00.000001+01:00"])(
    "retains exact short-positive expiry %s without rounding to the cutoff", startTimeUTC => {
      const input = syntheticSogResponses();
      change(input.schedule, p => { p.games[2].startTimeUTC = startTimeUTC; });
      const packet = assembleCurrentSeasonSogBaseline(input, now);
      expect(packet.expiresAt).toBe(startTimeUTC);
      expect(timestampMicros(packet.expiresAt)! - timestampMicros(packet.cutoffAt)!).toBe(BigInt(1));
    });
  it.each(["2026-10-15T20:00:00Z", "2026-10-15T21:00:00+01:00", "2026-10-15T19:59:59.999999Z"])(
    "rejects already-started exact/offset instant %s", startTimeUTC => {
      const input = syntheticSogResponses();
      change(input.schedule, p => { p.games[2].startTimeUTC = startTimeUTC; });
      expect(() => assembleCurrentSeasonSogBaseline(input, now)).toThrow(/already started/);
    });
});

describe("explicit future-game SOG scope (synthetic receipts only)", () => {
  const futureNow = new Date("2026-10-20T20:00:00.000Z");
  function fixture() {
    const requested: CurrentSeasonSogGameScope = { ...scope, scopeVersion: CURRENT_SEASON_SOG_GAME_SCOPE_VERSION,
      playerId: 9001, nhlPlayerId: 8470001, teamId: 13, teamAbbreviation: "FLA", opponentTeamId: 23,
      targetGameId: 2026020200, targetGameDate: "2026-10-20", targetStartTimeUTC: "2026-10-20T23:00:00Z",
      isHome: true, startDate: "2026-10-08", endDate: "2026-10-19", cutoffAt: futureNow.toISOString(),
      expiresAt: "2026-10-20T23:00:00Z" };
    const input = syntheticSogResponses();
    const edit = (row: CurrentSeasonSogResponse, mutate: (p: any) => void) => {
      change(row, mutate); row.capturedAt = "2026-10-20T19:00:00Z";
    };
    input.schedule.url = "https://api-web.nhle.com/v1/club-schedule-season/FLA/20262027";
    edit(input.schedule, p => { Object.assign(p.games[2], { id: requested.targetGameId,
      gameDate: requested.targetGameDate, startTimeUTC: requested.targetStartTimeUTC }); });
    for (const row of input.boxscores) edit(row, p => {
      p.playerByGameStats.homeTeam.forwards = [{ playerId: requested.nhlPlayerId, toi: "20:00",
        sog: p.playerByGameStats.awayTeam.forwards[0].sog }];
      p.playerByGameStats.awayTeam.forwards = [{ playerId: 4, toi: "12:00" }];
    });
    return { input, requested };
  }
  it("binds a different declared player/home game with unchanged appearance mean and default-deny uses", () => {
    const { input, requested } = fixture(), before = JSON.stringify({ input, requested });
    const result = assembleCurrentSeasonSogBaseline(input, futureNow, requested);
    expect(result.scope).toEqual(requested);
    expect(result.target).toMatchObject({ mean: 2, totalShots: 4, sampleSize: 2, basis: "per_appearance" });
    expect(result).toMatchObject({ generatedAt: requested.cutoffAt, cutoffAt: requested.cutoffAt,
      expiresAt: requested.expiresAt, participation: null, publicUsesApproved: false, status: "unreleased_local" });
    expect(result.limitations.join(" ")).toContain("final FLA regular-season games");
    requested.playerId++;
    expect(result.scope.playerId).toBe(9001);
    requested.playerId--;
    expect(JSON.stringify({ input, requested })).toBe(before);
  });
  it("uses only the declared history window, retaining genuine zeros in the denominator", () => {
    const { input, requested } = fixture(); requested.endDate = "2026-10-09"; input.boxscores.pop();
    const result = assembleCurrentSeasonSogBaseline(input, futureNow, requested);
    expect(result.selectedGameIds).toEqual([2026020001]);
    expect(result.target).toMatchObject({ mean: 0, sampleSize: 1 });
  });
  it("retains an earlier input cutoff separately from actual generation without extending expiry", () => {
    const { input, requested } = fixture(); requested.cutoffAt = "2026-10-20T19:30:00.000Z";
    const result = assembleCurrentSeasonSogBaseline(input, futureNow, requested);
    expect(result.cutoffAt).toBe(requested.cutoffAt); expect(result.generatedAt).toBe(futureNow.toISOString());
    expect(result.expiresAt).toBe(requested.expiresAt);
    requested.cutoffAt = "2026-10-20T18:59:59.999999Z";
    expect(() => assembleCurrentSeasonSogBaseline(input, futureNow, requested)).toThrow(/future source capture/);
  });
  it("caps expiry at 24 hours even when the target is later", () => {
    const { input, requested } = fixture();
    requested.targetGameDate = "2026-10-22"; requested.targetStartTimeUTC = "2026-10-22T23:00:00Z";
    requested.expiresAt = "2026-10-21T20:00:00.000Z";
    change(input.schedule, p => { Object.assign(p.games[2], { gameDate: requested.targetGameDate,
      startTimeUTC: requested.targetStartTimeUTC }); }); input.schedule.capturedAt = "2026-10-20T19:00:00Z";
    expect(assembleCurrentSeasonSogBaseline(input, futureNow, requested).expiresAt).toBe(requested.expiresAt);
  });
  it.each(["version", "extra", "canonical", "nhl", "season", "seasonRange", "game", "date", "start", "venue", "opponent",
    "team", "abbreviation", "historyDate", "historyOrder", "historyTarget", "historySeason", "budget", "cutoff", "expiry",
    "lateExpiry", "pastExpiry", "invalidClock", "started", "past", "invalidNow", "sourceClock", "startSeason", "startDate",
    "futureHistory"])(
    "rejects invalid or mismatched %s scope before emitting a forecast", kind => {
      const { input, requested } = fixture(); let asOf = futureNow;
      if (kind === "version") (requested as any).scopeVersion = "unknown";
      if (kind === "extra") Object.assign(requested, { participation: 1 });
      if (kind === "canonical") requested.playerId = 0;
      if (kind === "nhl") requested.nhlPlayerId++;
      if (kind === "season") requested.seasonId = 20252026;
      if (kind === "seasonRange") requested.seasonId = 20262028;
      if (kind === "game") requested.targetGameId++;
      if (kind === "date") requested.targetGameDate = "2026-10-21";
      if (kind === "start") requested.targetStartTimeUTC = "2026-10-20T23:00:00.000001Z";
      if (kind === "venue") requested.isHome = false;
      if (kind === "opponent") requested.opponentTeamId = 1;
      if (kind === "team") requested.teamId = 1;
      if (kind === "abbreviation") requested.teamAbbreviation = "VAN";
      if (kind === "historyDate") requested.startDate = "2026-02-30";
      if (kind === "historyOrder") requested.startDate = "2026-10-20";
      if (kind === "historyTarget") requested.endDate = requested.targetGameDate;
      if (kind === "historySeason") requested.startDate = "2025-10-01";
      if (kind === "futureHistory") { requested.targetGameDate = "2026-10-22"; requested.endDate = "2026-10-21"; }
      if (kind === "budget") requested.maximumGames = 6;
      if (kind === "cutoff") requested.cutoffAt = "2026-10-20T20:00:00.000001Z";
      if (kind === "expiry") requested.expiresAt = "invalid";
      if (kind === "lateExpiry") requested.expiresAt = "2026-10-20T23:00:00.000001Z";
      if (kind === "pastExpiry") requested.expiresAt = requested.cutoffAt;
      if (kind === "invalidClock") requested.targetStartTimeUTC = "2026-10-20T24:00:00Z";
      if (kind === "startSeason" || kind === "startDate") {
        requested.targetStartTimeUTC = kind === "startSeason" ? "2027-10-20T23:00:00Z" : "2026-11-20T23:00:00Z";
        requested.expiresAt = "2026-10-21T20:00:00.000Z";
        change(input.schedule, p => { p.games[2].startTimeUTC = requested.targetStartTimeUTC; });
        input.schedule.capturedAt = "2026-10-20T19:00:00Z";
      }
      if (kind === "started") { change(input.schedule, p => { p.games[2].gameState = "LIVE"; }); input.schedule.capturedAt = "2026-10-20T19:00:00Z"; }
      if (kind === "past") { asOf = new Date(requested.targetStartTimeUTC); requested.cutoffAt = asOf.toISOString(); }
      if (kind === "invalidNow") asOf = new Date("invalid");
      if (kind === "sourceClock") input.boxscores[0].capturedAt = "2026-10-19T24:00:00Z";
      expect(() => assembleCurrentSeasonSogBaseline(input, asOf, requested)).toThrow();
    });
});
