// @vitest-environment node
import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { baselineAppearanceFromBoxscore, type BaselineBoxscoreReceipt } from "./baselineSourceLineage";
import { deriveNativeGoalieOutcomes, deriveNativeGoalieSummaryWinCredit, deriveNativeGoalieStarterLabel, deriveNativeGoalieShutoutCredit, nativeGoalieSummaryUrl, type NativeGoalieShutoutSummary, type NativeGoalieOutcomeInput } from "./nativeGoalieOutcomes";

import { playerForecastSourcePayloadHash } from "./sourceSnapshot";

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

describe("explicit official summary win credits", () => {
  function summary(input: NativeGoalieOutcomeInput, changes: Record<string, unknown> = {}) {
    const rows = JSON.parse(shutoutSummary(input).receipts[0].rawBody).data;
    Object.assign(rows[0], { wins: 1, losses: 0, otLosses: 0 }, changes);
    return shutoutSummary(input, rows);
  }
  it("cross-checks an explicit summary win without changing the existing boxscore receipt", () => {
    const input = fixture(), before = playerForecastSourcePayloadHash(deriveNativeGoalieOutcomes(input));
    expect(deriveNativeGoalieSummaryWinCredit({ ...input, summary: summary(input) }))
      .toMatchObject({ winCredit: 1, officialStarter: true, source: "official_per_game_summary_credited_wins" });
    expect(playerForecastSourcePayloadHash(deriveNativeGoalieOutcomes(input))).toBe(before);
    expect(deriveNativeGoalieSummaryWinCredit({ ...input, summary: summary(input, { wins: 0 }) }))
      .toMatchObject({ winCredit: null, reason: "conflicting_boxscore_summary_win_credit" });
  });
  it("accepts explicit zero for positive-minute relief without inventing a start or dropping its denominator", () => {
    const input = fixture(), box = (input.appearance.finalBoxscore as BaselineBoxscoreReceipt).rawRow.payload;
    Object.assign(box.playerByGameStats.homeTeam.goalies[0], { starter: false, toi: "30:00", decision: "" });
    Object.assign(box.playerByGameStats.homeTeam.goalies[1], { starter: true, toi: "30:00", decision: "W" });
    recapture(input);
    expect(deriveNativeGoalieOutcomes(input).winCredit).toBeNull();
    const proof = deriveNativeGoalieSummaryWinCredit({ ...input, summary: summary(input, { wins: 0, timeOnIce: 1800 }) });
    expect(proof).toMatchObject({ winCredit: 0, officialStarter: false, officialDecision: null });
    expect(deriveNativeGoalieSummaryWinCredit({ ...input, summary: summary(input, { wins: 1, timeOnIce: 1800 }) }))
      .toMatchObject({ winCredit: null, reason: "conflicting_boxscore_summary_win_credit" });
  });
  it.each(["L", "O"])("rejects a summary loss credit already assigned to a teammate (%s)", decision => {
    const input = fixture(), box = (input.appearance.finalBoxscore as BaselineBoxscoreReceipt).rawRow.payload;
    box.homeTeam.score = 0; box.awayTeam.score = 1;
    if (decision === "O") Object.assign(box.periodDescriptor, { number: 4, periodType: "OT" });
    Object.assign(box.playerByGameStats.homeTeam.goalies[0], { starter: false, toi: "30:00", decision: "",
      goalsAgainst: 1, shotsAgainst: 25, saveShotsAgainst: "24/25" });
    Object.assign(box.playerByGameStats.homeTeam.goalies[1], { starter: true, toi: "30:00", decision });
    Object.assign(box.playerByGameStats.awayTeam.goalies[0], { decision: "W", goalsAgainst: 0, shotsAgainst: 24, saveShotsAgainst: "24/24" });
    recapture(input);
    expect(deriveNativeGoalieSummaryWinCredit({ ...input, summary: summary(input, {
      wins: 0, losses: decision === "L" ? 1 : 0, otLosses: decision === "O" ? 1 : 0, timeOnIce: 1800,
    }) })).toMatchObject({ winCredit: null, reason: "conflicting_boxscore_summary_win_credit" });
  });
  it.each(["wins", "losses", "otLosses", "timeOnIce", "saves", "playerId", "gameDate"])("withholds missing or conflicting %s", field => {
    const input = fixture();
    expect(deriveNativeGoalieSummaryWinCredit({ ...input, summary: summary(input, { [field]: undefined }) }).winCredit).toBeNull();
  });
  it("withholds conflicting credit mass and duplicated or foreign rows", () => {
    const input = fixture();
    expect(deriveNativeGoalieSummaryWinCredit({ ...input, summary: summary(input, { losses: 1 }) }).winCredit).toBeNull();
    const rows = JSON.parse(summary(input).receipts[0].rawBody).data;
    for (const other of [rows[0], { ...rows[0], gameId: 999 }]) {
      expect(deriveNativeGoalieSummaryWinCredit({ ...input, summary: shutoutSummary(input, [...rows, other]) }).winCredit).toBeNull();
    }
  });
  it.each(["hash", "url", "future"])("rejects invalid original summary %s", field => {
    const input = fixture(), receipt = summary(input);
    if (field === "hash") receipt.receipts[0].rawBody += " ";
    if (field === "url") receipt.receipts[0].url += "&limit=500";
    if (field === "future") receipt.receipts[0].capturedAt = "2026-10-13T12:00:01Z";
    expect(() => deriveNativeGoalieSummaryWinCredit({ ...input, summary: receipt })).toThrow();
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


describe("original explicit goalie starter labels", () => {
  function starterInput(nhlPlayerId = 77) {
    const input = fixture(), { rawRow, game, contentHash } = input.appearance.finalBoxscore as any;
    return { nhlPlayerId, teamId: 15, cutoffAt: input.cutoffAt, boxscore: { rawRow, game, contentHash } };
  }
  it("retains original transport clocks and explicit false for a listed zero-minute nonstarter", () => {
    const input = starterInput(78), before = structuredClone(input);
    const label = deriveNativeGoalieStarterLabel(input);
    expect(label).toMatchObject({ officialStarter: false, reason: null, released: false, forecastIssued: false,
      availableAt: input.boxscore.rawRow.fetched_at,
      evidence: { availableAt: input.boxscore.rawRow.fetched_at, capturedAt: input.boxscore.rawRow.fetched_at, hash: input.boxscore.contentHash } });
    expect(label.availableAt).not.toBe(input.cutoffAt);
    expect(input).toEqual(before);
    expect(deriveNativeGoalieStarterLabel(starterInput()).officialStarter).toBe(true);
  });
  it("keeps a relief appearance a nonstart and permits an explicit zero-minute starter flag without inferring credit", () => {
    const input = starterInput(78), rows = input.boxscore.rawRow.payload.playerByGameStats.homeTeam.goalies;
    rows[1].toi = "10:00";
    rows[0].toi = "00:00";
    input.boxscore.contentHash = playerForecastSourcePayloadHash(input.boxscore.rawRow.payload);
    expect(deriveNativeGoalieStarterLabel(input).officialStarter).toBe(false);
    expect(deriveNativeGoalieStarterLabel({ ...input, nhlPlayerId: 77 }).officialStarter).toBe(true);
  });
  it.each(["missing row", "missing flag", "multiple starters", "missing opposite flag"])("retains %s as unknown", kind => {
    const input = starterInput();
    if (kind === "missing row") input.nhlPlayerId = 999;
    if (kind === "missing flag") delete input.boxscore.rawRow.payload.playerByGameStats.homeTeam.goalies[0].starter;
    if (kind === "multiple starters") input.boxscore.rawRow.payload.playerByGameStats.homeTeam.goalies[1].starter = true;
    if (kind === "missing opposite flag") delete input.boxscore.rawRow.payload.playerByGameStats.awayTeam.goalies[1].starter;
    input.boxscore.contentHash = playerForecastSourcePayloadHash(input.boxscore.rawRow.payload);
    expect(deriveNativeGoalieStarterLabel(input).officialStarter).toBeNull();
  });
  it.each(["hash", "future capture", "game identity", "team identity", "duplicate player"])("rejects %s original source", kind => {
    const input = starterInput();
    if (kind === "hash") input.boxscore.contentHash = "0".repeat(64);
    if (kind === "future capture") input.cutoffAt = "2026-10-13T11:58:59.999999Z";
    if (kind === "game identity") input.boxscore.game.id++;
    if (kind === "team identity") input.teamId = 999;
    if (kind === "duplicate player") {
      input.boxscore.rawRow.payload.playerByGameStats.awayTeam.goalies[0].playerId = 77;
      input.boxscore.contentHash = playerForecastSourcePayloadHash(input.boxscore.rawRow.payload);
    }
    expect(() => deriveNativeGoalieStarterLabel(input)).toThrow();
  });
});
