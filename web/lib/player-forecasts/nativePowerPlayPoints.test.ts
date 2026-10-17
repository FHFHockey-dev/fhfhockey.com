// @vitest-environment node
import { describe, expect, it } from "vitest";
import { baselineAppearanceFromBoxscore } from "./baselineSourceLineage";
import { playerForecastSourcePayloadHash } from "./sourceSnapshot";
import { deriveNativePowerPlayPoints, type NativePowerPlayPointsInput } from "./nativePowerPlayPoints";

const cutoffAt = "2026-10-13T19:00:00.000002Z";
function fixture(): NativePowerPlayPointsInput {
  const game = { id: 2026020067, seasonId: 20262027, date: "2026-10-09", type: 2,
    startTime: "2026-10-09T22:00:00Z", homeTeamId: 15, awayTeamId: 3 };
  const rawRow = { id: 1, endpoint: "boxscore", game_id: game.id, season_id: game.seasonId,
    fetched_at: "2026-10-10T09:00:00Z", payload_hash: "a".repeat(64), payload: {
      id: game.id, season: game.seasonId, gameDate: game.date, gameType: 2, gameState: "OFF",
      startTimeUTC: game.startTime, homeTeam: { id: 15 }, awayTeam: { id: 3 }, playerByGameStats: {
        homeTeam: { forwards: [{ playerId: 77, toi: "20:00", goals: 1, assists: 2, powerPlayGoals: 1 },
          { playerId: 88, toi: "18:00", goals: 2, assists: 1, powerPlayGoals: 1 }], defense: [], goalies: [{ playerId: 99 }] },
        awayTeam: { forwards: [{ playerId: 111, toi: "20:00", goals: 0, assists: 0, powerPlayGoals: 0 }],
          defense: [], goalies: [{ playerId: 199 }] } } } };
  const appearance = baselineAppearanceFromBoxscore({ rawRow, game, nhlPlayerId: 77, teamId: 15,
    cutoffAt, population: "skater" })!;
  const period = (number: number, goals: any[]) => ({ periodDescriptor: { number, periodType: "REG", maxRegulationPeriods: 3 }, goals });
  const goal = (eventId: number, playerId: number, strength: string, assists: number[]) => ({ eventId, playerId,
    strength, isHome: true, assists: assists.map(playerId => ({ playerId })) });
  const payload = { id: game.id, season: game.seasonId, gameDate: game.date, gameType: 2, gameState: "OFF",
    startTimeUTC: game.startTime, homeTeam: { id: 15, score: 3 }, awayTeam: { id: 3, score: 0 },
    periodDescriptor: { number: 3, periodType: "REG" }, summary: { scoring: [
      period(1, [goal(10, 77, "pp", [88])]), period(2, [goal(20, 88, "pp", [77])]),
      period(3, [goal(30, 88, "ev", [77])]) ] } };
  return { appearance, nhlPlayerId: 77, cutoffAt,
    landing: { rawRow: { id: 2, endpoint: "landing", game_id: game.id, season_id: game.seasonId,
      fetched_at: "2026-10-10T09:00:01Z", payload_hash: "b".repeat(64), payload }, contentHash: playerForecastSourcePayloadHash(payload) } };
}

describe("private native power-play point counts", () => {
  it("counts only explicitly PP goal and assist credits, preserving source clocks and inputs", () => {
    const input = fixture(), before = JSON.stringify(input), result = deriveNativePowerPlayPoints(input);
    expect(result).toMatchObject({ gameId: 2026020067, teamId: 15, nhlPlayerId: 77,
      powerPlayGoals: 1, powerPlayAssists: 1, powerPlayPoints: 2, cutoffAt,
      classification: "private_historical_observed_counts", forecastIssued: false, released: false, qualificationEligible: false });
    expect(result.credits).toEqual([{ eventId: 10, period: 1, role: "goal" }, { eventId: 20, period: 2, role: "assist" }]);
    expect(result.sourceReceipts).toMatchObject({ landing: { rawRowId: 2, fetchedAt: "2026-10-10T09:00:01Z" },
      boxscore: { rawRowId: 1, fetchedAt: "2026-10-10T09:00:00Z" } });
    expect(JSON.stringify(input)).toBe(before);
  });

  it("accepts hash-bound original HTTP identities while rejecting mismatched HTTP hashes", () => {
    const input = fixture(), box = input.appearance.finalBoxscore as any;
    input.landing.rawRow.id = `http:${input.landing.rawRow.payload_hash}`;
    box.rawRow.id = `http:${box.rawRow.payload_hash}`;
    expect(deriveNativePowerPlayPoints(input).sourceReceipts.landing.rawRowId).toBe(input.landing.rawRow.id);
    input.landing.rawRow.id = `http:${"c".repeat(64)}`;
    expect(() => deriveNativePowerPlayPoints(input)).toThrow();
    input.landing.rawRow.id = `http:${input.landing.rawRow.payload_hash}`;
    box.rawRow.id = `http:${"c".repeat(64)}`;
    expect(() => deriveNativePowerPlayPoints(input)).toThrow();
  });

  it("supports a genuine zero after complete goal/assist reconciliation", () => {
    const input = fixture();
    input.nhlPlayerId = 111;
    const receipt = input.appearance.finalBoxscore as any;
    input.appearance = baselineAppearanceFromBoxscore({ rawRow: receipt.rawRow, game: receipt.game,
      nhlPlayerId: 111, teamId: 3, cutoffAt, population: "skater" })!;
    expect(deriveNativePowerPlayPoints(input)).toMatchObject({ teamId: 3, powerPlayPoints: 0, credits: [] });
  });

  it("rejects invalid starts that otherwise compare as null", () => {
    const input = fixture(), receipt = input.appearance.finalBoxscore as any;
    receipt.game.startTime = receipt.rawRow.payload.startTimeUTC = "2026-10-09T22:00:00";
    receipt.contentHash = playerForecastSourcePayloadHash(receipt.rawRow.payload);
    input.landing.rawRow.payload.startTimeUTC = "not-a-time";
    input.landing.contentHash = playerForecastSourcePayloadHash(input.landing.rawRow.payload);
    expect(() => deriveNativePowerPlayPoints(input)).toThrow(/Private PPP/);
  });

  it.each(["landing", "boxscore"])("rejects a final %s receipt before the game start", source => {
    const input = fixture(), receipt = input.appearance.finalBoxscore as any;
    receipt.game.startTime = receipt.rawRow.payload.startTimeUTC = input.landing.rawRow.payload.startTimeUTC
      = "2026-10-09T22:00:00.000002Z";
    receipt.contentHash = playerForecastSourcePayloadHash(receipt.rawRow.payload);
    input.landing.contentHash = playerForecastSourcePayloadHash(input.landing.rawRow.payload);
    if (source === "landing") input.landing.rawRow.fetched_at = "2026-10-09T22:00:00.000001Z";
    else {
      receipt.fetchedAt = receipt.rawRow.fetched_at = "2026-10-09T22:00:00.000001Z";
    }
    expect(() => deriveNativePowerPlayPoints(input)).toThrow(/Private PPP/);
  });

  it("accepts matching start instants across timezones without rewriting them", () => {
    const input = fixture();
    input.landing.rawRow.payload.startTimeUTC = "2026-10-09T16:00:00-06:00";
    input.landing.contentHash = playerForecastSourcePayloadHash(input.landing.rawRow.payload);
    const before = JSON.stringify(input);
    expect(deriveNativePowerPlayPoints(input).powerPlayPoints).toBe(2);
    expect(JSON.stringify(input)).toBe(before);
  });

  it("excludes displayed shootout credits from official player counts", () => {
    const input = fixture(), body = input.landing.rawRow.payload;
    body.periodDescriptor = { number: 5, periodType: "SO" };
    body.awayTeam.score = 3;
    body.homeTeam.score = 4;
    const box = (input.appearance.finalBoxscore as any).rawRow.payload;
    box.playerByGameStats.awayTeam.forwards[0].goals = 3;
    for (let i = 0; i < 3; i++) body.summary.scoring[i].goals.push({ eventId: 100 + i, playerId: 111,
      strength: "ev", isHome: false, assists: [] });
    body.summary.scoring.push({ periodDescriptor: { number: 4, periodType: "OT", maxRegulationPeriods: 3 }, goals: [] },
      { periodDescriptor: { number: 5, periodType: "SO", maxRegulationPeriods: 3 },
        goals: [{ eventId: 200, playerId: 77, strength: "pp", isHome: true, assists: [{ playerId: 88 }] }] });
    const receipt = input.appearance.finalBoxscore as any;
    receipt.contentHash = playerForecastSourcePayloadHash(box);
    input.landing.contentHash = playerForecastSourcePayloadHash(body);
    expect(deriveNativePowerPlayPoints(input).powerPlayPoints).toBe(2);
  });

  it.each(["derived envelope", "wrong game", "wrong season", "wrong team", "not final", "future receipt",
    "body hash", "missing summary", "missing period", "duplicate period", "duplicate event", "unknown strength",
    "missing assists", "duplicate assist", "self assist", "opponent assist", "missing goal", "score mismatch",
    "PP goal mismatch", "assist count mismatch", "missing boxscore count"])(
    "withholds %s even after an outer hash is recomputed", problem => {
      const input = fixture(), raw = input.landing.rawRow, body = raw.payload;
      const box = (input.appearance.finalBoxscore as any).rawRow.payload;
      if (problem === "derived envelope") raw.payload = { game: body, rows: [], version: 1 };
      if (problem === "wrong game") body.id++;
      if (problem === "wrong season") body.season++;
      if (problem === "wrong team") body.homeTeam.id++;
      if (problem === "not final") body.gameState = "LIVE";
      if (problem === "future receipt") raw.fetched_at = "2026-10-13T19:00:00.000003Z";
      if (problem === "missing summary") delete body.summary;
      if (problem === "missing period") body.summary.scoring.pop();
      if (problem === "duplicate period") body.summary.scoring[2].periodDescriptor.number = 2;
      if (problem === "duplicate event") body.summary.scoring[2].goals[0].eventId = 20;
      if (problem === "unknown strength") body.summary.scoring[1].goals[0].strength = null;
      if (problem === "missing assists") delete body.summary.scoring[1].goals[0].assists;
      if (problem === "duplicate assist") body.summary.scoring[1].goals[0].assists.push({ playerId: 77 });
      if (problem === "self assist") body.summary.scoring[1].goals[0].assists = [{ playerId: 88 }];
      if (problem === "opponent assist") body.summary.scoring[1].goals[0].assists = [{ playerId: 111 }];
      if (problem === "missing goal") body.summary.scoring[2].goals = [];
      if (problem === "score mismatch") body.homeTeam.score++;
      if (problem === "PP goal mismatch") body.summary.scoring[0].goals[0].strength = "ev";
      if (problem === "assist count mismatch") body.summary.scoring[2].goals[0].assists = [];
      if (problem === "missing boxscore count") delete box.playerByGameStats.homeTeam.forwards[1].powerPlayGoals;
      input.landing.contentHash = problem === "body hash" ? "c".repeat(64) : playerForecastSourcePayloadHash(raw.payload);
      const receipt = input.appearance.finalBoxscore as any;
      receipt.contentHash = playerForecastSourcePayloadHash(box);
      expect(() => deriveNativePowerPlayPoints(input)).toThrow(/Private PPP/);
    });
});
