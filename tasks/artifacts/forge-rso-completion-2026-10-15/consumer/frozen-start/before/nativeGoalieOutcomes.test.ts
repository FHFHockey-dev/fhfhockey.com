// @vitest-environment node
import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { baselineAppearanceFromBoxscore } from "./baselineSourceLineage";
import { deriveNativeGoalieOutcomes, deriveNativeGoalieShutoutCredit, nativeGoalieSummaryUrl, type NativeGoalieShutoutSummary, type NativeGoalieOutcomeInput } from "./nativeGoalieOutcomes";

const cutoffAt = "2026-10-13T12:00:00.000002Z";
const goalie = (playerId: number, starter: boolean, ga: number, decision?: string) => ({
  playerId, position: "G", starter, toi: starter ? "60:00" : "00:00",
  saves: starter ? 24 : 0, shotsAgainst: starter ? 24 + ga : 0, goalsAgainst: ga,
  saveShotsAgainst: starter ? `24/${24 + ga}` : "0/0", ...(decision ? { decision } : {}),
});
function fixture(): NativeGoalieOutcomeInput {
  const game = { id: 2026020018, seasonId: 20262027, date: "2026-10-13", type: 2,
    startTime: "2026-10-13T11:00:00.000002Z", homeTeamId: 15, awayTeamId: 3 };
  const raw = { id: 1, game_id: game.id, season_id: game.seasonId, endpoint: "boxscore",
    payload_hash: "a".repeat(64), fetched_at: "2026-10-13T11:59:00Z", payload: {
      id: game.id, season: game.seasonId, gameDate: game.date, gameType: 2, gameState: "OFF", startTimeUTC: game.startTime,
      periodDescriptor: { number: 3, periodType: "REG", maxRegulationPeriods: 3 },
      homeTeam: { id: 15, score: 1 }, awayTeam: { id: 3, score: 0 }, playerByGameStats: {
        homeTeam: { forwards: [{ playerId: 10 }], defense: [], goalies: [goalie(77, true, 0, "W"), goalie(78, false, 0)] },
        awayTeam: { forwards: [{ playerId: 20 }], defense: [], goalies: [goalie(88, true, 1, "L"), goalie(89, false, 0)] },
      } } };
  return { nhlPlayerId: 77, cutoffAt, appearance: baselineAppearanceFromBoxscore({ rawRow: raw, game,
    nhlPlayerId: 77, teamId: 15, cutoffAt, population: "goalie" })! };
}
function recapture(input: NativeGoalieOutcomeInput) {
  const receipt = input.appearance.finalBoxscore as any;
  input.appearance = baselineAppearanceFromBoxscore({ rawRow: receipt.rawRow, game: receipt.game,
    nhlPlayerId: input.nhlPlayerId, teamId: input.appearance.teamId, cutoffAt: input.cutoffAt, population: "goalie" })!;
}

function shutoutSummary(input: NativeGoalieOutcomeInput, rows?: any[]): NativeGoalieShutoutSummary {
  const scope = { nhlPlayerId: input.nhlPlayerId, seasonId: input.appearance.seasonId, startDate: input.appearance.gameDate,
    endDate: input.appearance.gameDate, approvedGameIds: [input.appearance.gameId] };
  const data = rows ?? [{ playerId: input.nhlPlayerId, gameId: input.appearance.gameId, gameDate: input.appearance.gameDate,
    seasonId: input.appearance.seasonId, gamesPlayed: 1, shutouts: 1, saves: input.appearance.saves,
    goalsAgainst: input.appearance.goalsAgainst, shotsAgainst: input.appearance.shotsAgainst, timeOnIce: 3600 }];
  const rawBody = JSON.stringify({ data, total: data.length });
  return { scope, receipts: [{ url: nativeGoalieSummaryUrl(scope), capturedAt: cutoffAt, rawBody,
    bodySha256: createHash("sha256").update(rawBody).digest("hex") }] };
}

describe("explicit official credited shutout receipts", () => {
  it("uses only explicit bound per-game credit and distinguishes the full exposed page from the approved row", () => {
    const input = fixture(), summary = shutoutSummary(input);
    expect(deriveNativeGoalieShutoutCredit({ ...input, summary })).toMatchObject({ shutoutCredit: 1, fullPageRows: 1 });
    const rows = JSON.parse(summary.receipts[0].rawBody).data;
    rows[0].shutouts = 0;
    expect(deriveNativeGoalieShutoutCredit({ ...input, summary: shutoutSummary(input, rows) }).shutoutCredit).toBe(0);
    delete rows[0].shutouts;
    expect(deriveNativeGoalieShutoutCredit({ ...input, summary: shutoutSummary(input, rows) }).shutoutCredit).toBeNull();
    const extended = [...JSON.parse(summary.receipts[0].rawBody).data, { gameId: 999, shutouts: 1 }];
    expect(deriveNativeGoalieShutoutCredit({ ...input, summary: shutoutSummary(input, extended) })).toMatchObject({ shutoutCredit: 1, fullPageRows: 2, usedGameId: input.appearance.gameId });
  });
  it("accepts an omitted summary season only through exact query and original game binding", () => {
    const input = fixture(), data = JSON.parse(shutoutSummary(input).receipts[0].rawBody).data;
    delete data[0].seasonId;
    expect(deriveNativeGoalieShutoutCredit({ ...input, summary: shutoutSummary(input, data) }).shutoutCredit).toBe(1);
    data[0].seasonId = 20252026;
    expect(deriveNativeGoalieShutoutCredit({ ...input, summary: shutoutSummary(input, data) }).shutoutCredit).toBeNull();
    data[0].seasonId = null;
    expect(deriveNativeGoalieShutoutCredit({ ...input, summary: shutoutSummary(input, data) }).shutoutCredit).toBeNull();
  });
  it.each(["missing", "duplicate", "playerId", "seasonId", "gameDate", "gamesPlayed", "saves", "shotsAgainst", "timeOnIce"])("withholds %s selected credit", problem => {
    const input = fixture(), data = JSON.parse(shutoutSummary(input).receipts[0].rawBody).data;
    if (problem === "missing") data.length = 0;
    else if (problem === "duplicate") data.push(data[0]);
    else data[0][problem] = problem === "gameDate" ? "2026-10-12" : data[0][problem] + 1;
    expect(deriveNativeGoalieShutoutCredit({ ...input, summary: shutoutSummary(input, data) }).shutoutCredit).toBeNull();
  });
  it.each(["hash", "url", "future", "pagination", "unapproved game"])("rejects %s source proof", problem => {
    const input = fixture(), summary = shutoutSummary(input);
    if (problem === "hash") summary.receipts[0].rawBody += " ";
    if (problem === "url") summary.receipts[0].url += "&limit=500";
    if (problem === "future") summary.receipts[0].capturedAt = "2026-10-13T12:00:01Z";
    if (problem === "unapproved game") summary.scope.approvedGameIds = [999];
    if (problem === "pagination") {
      const body = JSON.parse(summary.receipts[0].rawBody); body.total = 50;
      summary.receipts[0].rawBody = JSON.stringify(body);
      summary.receipts[0].bodySha256 = createHash("sha256").update(summary.receipts[0].rawBody).digest("hex");
    }
    expect(() => deriveNativeGoalieShutoutCredit({ ...input, summary })).toThrow();
  });
});

describe("private native goalie outcome receipts", () => {
  it("accepts hash-bound HTTP capture identity without inventing a database ID", () => {
    const input = fixture(), raw = (input.appearance.finalBoxscore as any).rawRow;
    raw.id = `http:${raw.payload_hash}`;
    recapture(input);
    expect(deriveNativeGoalieOutcomes(input).sourceReceipt.rawRowId).toBe(raw.id);
    raw.id = `http:${"b".repeat(64)}`;
    recapture(input);
    expect(() => deriveNativeGoalieOutcomes(input)).toThrow();
    raw.id = "http:invalid"; raw.payload_hash = "invalid";
    expect(() => { recapture(input); deriveNativeGoalieOutcomes(input); }).toThrow();
  });
  it("preserves explicit starter/win credit and original inputs while withholding SO", () => {
    const input = fixture(), before = JSON.stringify(input), result = deriveNativeGoalieOutcomes(input);
    expect(result).toMatchObject({ officialStarter: true, officialDecision: "W", winCredit: 1, shutoutCredit: null,
      missingOutcomeEvidence: ["SHUTOUTS_GOALIE"], conditioning: "positive_minute_historical_appearance",
      forecastIssued: false, released: false, qualificationEligible: false });
    expect(result.sourceReceipt.fetchedAt).toBe("2026-10-13T11:59:00Z");
    expect(JSON.stringify(input)).toBe(before);
  });
  it("keeps a missing decision unknown rather than manufacturing a win zero", () => {
    const input = fixture(), body = (input.appearance.finalBoxscore as any).rawRow.payload;
    delete body.playerByGameStats.homeTeam.goalies[0].decision;
    recapture(input);
    expect(deriveNativeGoalieOutcomes(input)).toMatchObject({ officialDecision: null, winCredit: null,
      missingOutcomeEvidence: ["SHUTOUTS_GOALIE", "WINS_GOALIE"] });
  });
  it("retains a relief win separately from the starter event", () => {
    const input = fixture(), rows = (input.appearance.finalBoxscore as any).rawRow.payload.playerByGameStats.homeTeam.goalies;
    rows[0].starter = false;
    Object.assign(rows[0], { toi: "00:01", saves: 0, shotsAgainst: 0, saveShotsAgainst: "0/0" });
    rows[1].starter = true;
    Object.assign(rows[1], { toi: "59:59", saves: 24, shotsAgainst: 24, saveShotsAgainst: "24/24" });
    recapture(input);
    expect(deriveNativeGoalieOutcomes(input)).toMatchObject({ officialStarter: false, winCredit: 1 });
  });
  it.each([[5, "SO"], [4, "OT"]])("rejects impossible final score margin in period %s (%s)", (number, periodType) => {
    const input = fixture(), body = (input.appearance.finalBoxscore as any).rawRow.payload;
    body.periodDescriptor = { number, periodType, maxRegulationPeriods: 3 };
    body.homeTeam.score = 3;
    body.playerByGameStats.awayTeam.goalies[0].decision = "O";
    recapture(input);
    expect(() => deriveNativeGoalieOutcomes(input)).toThrow();
  });
  it.each([[5, "SO"], [4, "OT"]])("preserves a valid one-goal final in period %s (%s)", (number, periodType) => {
    const input = fixture(), body = (input.appearance.finalBoxscore as any).rawRow.payload;
    body.periodDescriptor = { number, periodType, maxRegulationPeriods: 3 };
    body.playerByGameStats.awayTeam.goalies[0].decision = "O";
    recapture(input);
    expect(deriveNativeGoalieOutcomes(input)).toMatchObject({ officialDecision: "W", winCredit: 1, shutoutCredit: null });
  });
  it("preserves a valid multi-goal regulation result", () => {
    const input = fixture(), body = (input.appearance.finalBoxscore as any).rawRow.payload;
    body.homeTeam.score = 3;
    Object.assign(body.playerByGameStats.awayTeam.goalies[0], goalie(88, true, 3, "L"));
    recapture(input);
    expect(deriveNativeGoalieOutcomes(input).winCredit).toBe(1);
  });
  it("does not infer shootout-loser SO credit from zero goals against", () => {
    const input = fixture(), receipt = input.appearance.finalBoxscore as any, body = receipt.rawRow.payload;
    body.periodDescriptor = { number: 5, periodType: "SO", maxRegulationPeriods: 3 };
    body.homeTeam.score = 0; body.awayTeam.score = 1;
    body.playerByGameStats.homeTeam.goalies[0].decision = "O";
    Object.assign(body.playerByGameStats.awayTeam.goalies[0], goalie(88, true, 0, "W"));
    recapture(input);
    expect(deriveNativeGoalieOutcomes(input)).toMatchObject({ officialDecision: "O", winCredit: 0, shutoutCredit: null });
  });
  it("accepts timezone-equivalent starts without rewriting source strings", () => {
    const input = fixture(), body = (input.appearance.finalBoxscore as any).rawRow.payload;
    body.startTimeUTC = "2026-10-13T05:00:00.000002-06:00";
    recapture(input);
    const before = JSON.stringify(input);
    expect(deriveNativeGoalieOutcomes(input).winCredit).toBe(1);
    expect(JSON.stringify(input)).toBe(before);
  });
  it.each(["missing starter", "duplicate starter", "duplicate win", "wrong winner", "unknown decision",
    "wrong overtime decision", "missing period", "tie", "wrong endpoint", "pre-start fetch", "future fetch"])(
    "rejects %s after input recapture", problem => {
      const input = fixture(), receipt = input.appearance.finalBoxscore as any, body = receipt.rawRow.payload,
        own = body.playerByGameStats.homeTeam.goalies[0], backup = body.playerByGameStats.homeTeam.goalies[1];
      if (problem === "missing starter") delete own.starter;
      if (problem === "duplicate starter") backup.starter = true;
      if (problem === "duplicate win") Object.assign(backup, goalie(78, false, 0, "W"), { toi: "00:01" });
      if (problem === "wrong winner") { body.homeTeam.score = 0; body.awayTeam.score = 1; }
      if (problem === "unknown decision") own.decision = "LOSS";
      if (problem === "wrong overtime decision") body.playerByGameStats.awayTeam.goalies[0].decision = "O";
      if (problem === "missing period") delete body.periodDescriptor;
      if (problem === "tie") body.awayTeam.score = 1;
      if (problem === "wrong endpoint") receipt.rawRow.endpoint = "landing";
      if (problem === "pre-start fetch") receipt.rawRow.fetched_at = "2026-10-13T11:00:00.000001Z";
      if (problem === "future fetch") receipt.rawRow.fetched_at = "2026-10-13T12:00:00.000003Z";
      // Existing guards may reject during recapture; either path must withhold the outcome.
      expect(() => { recapture(input); deriveNativeGoalieOutcomes(input); }).toThrow();
    });
  it("rejects changed retained content without recapture", () => {
    const input = fixture();
    (input.appearance.finalBoxscore as any).rawRow.payload.playerByGameStats.homeTeam.goalies[0].decision = "L";
    expect(() => deriveNativeGoalieOutcomes(input)).toThrow(/retained boxscore content/);
  });
});
