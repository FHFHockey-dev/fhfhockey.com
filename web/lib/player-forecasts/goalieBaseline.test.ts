// @vitest-environment node
import { createHash } from "node:crypto";
import { nativeGoalieSummaryUrl } from "./nativeGoalieOutcomes";
import { describe, expect, it } from "vitest";
import { buildGoalieBaselineRates, buildGoalieContributionBundle,
  dryRunCapturedGoalieBundle, buildNativeGoalieWinRates, NATIVE_GOALIE_WIN_POLICY_VERSION,
  nativeGoalieWinDefinitionHash, buildNativeGoalieVolumeRates, NATIVE_GOALIE_VOLUME_POLICY_VERSION,
  nativeGoalieVolumeDefinitionHash, buildNativeGoalieShutoutRates, NATIVE_GOALIE_SHUTOUT_POLICY_VERSION, buildNativeGoalieSummaryWinRates, NATIVE_GOALIE_SUMMARY_WIN_POLICY_VERSION } from "./goalieBaselineRates";
import { captureCurrentGoalieBaselineInputs, persistCapturedGoalieBaselineInputs } from "./goalieBaselineInputCapture";
import { BASELINE_CANDIDATE_POLICY, baselineDefinitionHash, baselineProjectionSchemas } from "./baselinePolicy";
import { baselineAppearanceFromBoxscore, type BaselineBoxscoreReceipt, baselineProjectionFromRow, baselineProjectionContentHash, baselineHistoricalSources,
  baselineHistoricalSourceLimitations, baselineProjectionSelectionReceipt,
  baselineProjectionSelectionLimitations } from "./baselineSourceLineage";
import { readStableCurrentInputs } from "./baselineInputCapture";
import { playerForecastSourcePayloadHash } from "./sourceSnapshot";
import { resolvePlanningContributions } from "./planningContributions";
import type { ContributionSource } from "./contributions";
import type { GameForecast, PlanningSnapshot } from "../rosterScheduleOptimizer/planningTypes";

const cutoffAt = "2026-09-28T12:00:01Z";
const projection = { sourceId: "cullen_goalies", sourceRowId: "c-1", seasonId: 20262027,
  availableAt: cutoffAt, projectedAppearances: 40, projectedStarts: 30,
  totals: { SAVES_GOALIE: 1000, GOALS_AGAINST_GOALIE: 100, SHOTS_AGAINST_GOALIE: 1100,
    WINS_GOALIE: 15, SHUTOUTS_GOALIE: 3 } };

function goalieCaptureDb(rows: Record<string, any[]>,
  calls: Array<{ table: string; method: string; args: unknown[] }> = [], errors: Record<string, { code: string }> = {}) {
  for (const history of rows.goaliesGameStats ?? []) {
    const game = history.games;
    if (!game) continue;
    Object.assign(game, { startTime: game.startTime ?? `${game.date}T01:00:00Z`,
      homeTeamId: game.homeTeamId ?? 4, awayTeamId: game.awayTeamId ?? 5 });
    const rawRows = rows.nhl_api_game_payloads_raw ??= [];
    if (!rawRows.some(row => Number(row.game_id) === Number(history.gameId))) rawRows.push({
      id: Number(history.gameId) * 100 + 1, game_id: history.gameId, season_id: game.seasonId,
      payload_hash: "a".repeat(64), fetched_at: `${game.date}T10:00:00Z`, payload: {} });
    const match = /^(\d+)\/(\d+)$/.exec(String(history.saveShotsAgainst));
    for (const [index, raw] of rawRows.filter(row => Number(row.game_id) === Number(history.gameId)).entries()) {
      raw.id ??= Number(history.gameId) * 100 + index + 1;
      raw.payload = { id: history.gameId, season: game.seasonId, gameDate: game.date, gameType: 2,
        gameState: "FINAL", homeTeam: { id: game.homeTeamId }, awayTeam: { id: game.awayTeamId },
        playerByGameStats: { homeTeam: { forwards: [{ playerId: 1001 }], defense: [], goalies: [{
          playerId: history.playerId, toi: history.toi, saveShotsAgainst: history.saveShotsAgainst,
          saves: match ? Number(match[1]) : undefined, shotsAgainst: match ? Number(match[2]) : undefined,
          goalsAgainst: history.goalsAgainst }] },
        awayTeam: { forwards: [{ playerId: 1002 }], defense: [], goalies: [{ playerId: 1003 }] } }, ...raw.payload };
    }
  }
  return { from(table: string) {
    const query: Record<string, (...args: any[]) => any> = {};
    const filters: Array<[string, unknown[]]> = [];
    for (const method of ["select", "in", "eq", "lte", "order", "limit"]) {
      query[method] = (...args) => { calls.push({ table, method, args });
        if (method === "in" && (table === "nhl_api_game_payloads_raw" || table === "games"
          || table === "nhl_api_game_normalization_status"
          || args[0] === "upload_batch_id")) filters.push([args[0], args[1]]);
        return query; };
    }
    const selected = () => (rows[table] ?? []).filter(row => filters.every(([column, values]) => values.includes(row[column])));
    query.range = (from: number, to: number) => Promise.resolve({ data: selected().slice(from, to + 1), count: selected().length, error: errors[table] ?? null });
    query.then = (resolve: (value: unknown) => void) => resolve({ data: selected(), count: selected().length, error: errors[table] ?? null });
    return query;
  } };
}

function nativeGoalieOutcomeRows(): Record<string, any[]> {
  const goalie = (playerId: number, goalsAgainst: number, decision: string) => ({
    playerId, position: "G", starter: true, decision, toi: "60:00", saves: 24,
    shotsAgainst: 24 + goalsAgainst, goalsAgainst, saveShotsAgainst: `24/${24 + goalsAgainst}`,
  });
  return {
    goaliesGameStats: [{ playerId: 77, gameId: 30, saveShotsAgainst: "24/24", goalsAgainst: 0, toi: "60:00",
      games: { id: 30, date: "2026-09-27", seasonId: 20262027, type: 2, startTime: "2026-09-27T01:00:00Z",
        homeTeamId: 4, awayTeamId: 5 } }],
    nhl_api_game_roster_spots: [{ game_id: 30, player_id: 77, team_id: 4,
      season_id: 20262027, game_date: "2026-09-27" }],
    nhl_api_game_payloads_raw: [{ id: 3001, game_id: 30, season_id: 20262027, endpoint: "boxscore",
      payload_hash: "a".repeat(64), fetched_at: "2026-09-27T10:00:00.000123+00:00", payload: {
        id: 30, season: 20262027, gameDate: "2026-09-27", gameType: 2, gameState: "FINAL",
        startTimeUTC: "2026-09-27T01:00:00Z", homeTeam: { id: 4, score: 1 }, awayTeam: { id: 5, score: 0 },
        periodDescriptor: { number: 3, periodType: "REG", maxRegulationPeriods: 3 },
        playerByGameStats: {
          homeTeam: { forwards: [{ playerId: 1001 }], defense: [], goalies: [goalie(77, 0, "W")] },
          awayTeam: { forwards: [{ playerId: 1002 }], defense: [], goalies: [goalie(1003, 1, "L")] },
        },
      } }],
  };
}

function captureNativeGoalieOutcomes(rows: Record<string, any[]>) {
  return captureCurrentGoalieBaselineInputs({ db: goalieCaptureDb(rows) as never, seasonId: 20262027,
    players: [{ playerId: 7, nhlPlayerId: 77, teamId: 4, rosterRevision: "r" }],
    projectionSelection: Object.fromEntries(BASELINE_CANDIDATE_POLICY.sourceIds.goalie.map(id => [id, {}])),
    now: () => new Date("2026-09-28T12:00:00Z") });
}

describe("goalie baseline denominators", () => {
  it("produces coherent current-only native volume means on one joint appearance population, including relief", async () => {
    const full = await captureNativeGoalieOutcomes(nativeGoalieOutcomeRows()), reliefRows = nativeGoalieOutcomeRows();
    const history = reliefRows.goaliesGameStats[0], raw = reliefRows.nhl_api_game_payloads_raw[0];
    history.gameId = 31; history.games.id = 31;
    Object.assign(history, { toi: "30:00", goalsAgainst: 2, saveShotsAgainst: "12/14" });
    reliefRows.nhl_api_game_roster_spots[0].game_id = 31;
    raw.id = 3101; raw.game_id = 31; raw.payload.id = 31;
    raw.payload.homeTeam.score = 1; raw.payload.awayTeam.score = 2;
    Object.assign(raw.payload.playerByGameStats.homeTeam.goalies[0], { starter: false, toi: "30:00", saves: 12,
      goalsAgainst: 2, shotsAgainst: 14, saveShotsAgainst: "12/14", decision: null });
    const relief = await captureNativeGoalieOutcomes(reliefRows);
    const input = { ...full.players[0], seasonId: 20262027, cutoffAt: full.cutoffAt,
      appearances: [...full.players[0].appearances, ...relief.players[0].appearances] };
    expect(buildGoalieBaselineRates(input).targets).toEqual([]);
    const snapshot = buildNativeGoalieVolumeRates(input);
    expect(snapshot).toMatchObject({ policyVersion: NATIVE_GOALIE_VOLUME_POLICY_VERSION,
      definitionHash: nativeGoalieVolumeDefinitionHash(20262027), validation: "unvalidated" });
    expect(snapshot.targets).toEqual([
      expect.objectContaining({ targetKey: "SAVES_GOALIE", rate: 18, basis: "per_appearance", recentGameIds: [31, 30] }),
      expect.objectContaining({ targetKey: "GOALS_AGAINST_GOALIE", rate: 1, recentGameIds: [31, 30] }),
      expect.objectContaining({ targetKey: "SHOTS_AGAINST_GOALIE", rate: 19, recentGameIds: [31, 30] }),
      expect.objectContaining({ targetKey: "GOALIE_MINUTES", rate: 45, recentGameIds: [31, 30] }),
    ]);
    expect(snapshot.missingTargetKeys).toEqual(["SHUTOUTS_GOALIE", "WINS_GOALIE"]);
    const bundle = buildGoalieContributionBundle({ seasonId: 20262027, cutoffAt: full.cutoffAt,
      issuedAt: "2026-09-28T13:00:00Z", expiresAt: "2026-10-04T00:00:00Z", scheduleRevision: "schedule-a",
      snapshots: [{ snapshot, teamId: 4, rosterRevision: "r" }] });
    expect(bundle.sources).toHaveLength(4);
    expect(bundle.sources.every(source => !source.released && !source.participationIntegrated && source.basis === "per_appearance")).toBe(true);
    expect(bundle.sources.find(source => source.targetKey === "GOALIE_MINUTES")?.unit).toBe("minutes");
    const partial = structuredClone(input); partial.appearances[0].goalsAgainst = null;
    expect(() => buildNativeGoalieVolumeRates(partial)).toThrow(/retained boxscore content/);
    const unbound = structuredClone(input); delete unbound.appearances[0].finalBoxscore;
    expect(() => buildNativeGoalieVolumeRates(unbound)).toThrow(/bound retained boxscore content/);
    expect(() => buildNativeGoalieVolumeRates({ ...input, projections: [projection] })).toThrow(/without projections/);
    expect(buildNativeGoalieVolumeRates({ ...input, appearances: [] }).targets).toEqual([]);
  });

  it("rejects an original current-only goalie appearance above the regular-season minutes bound", async () => {
    const rows = nativeGoalieOutcomeRows();
    rows.goaliesGameStats[0].toi = "66:00";
    rows.nhl_api_game_payloads_raw[0].payload.playerByGameStats.homeTeam.goalies[0].toi = "66:00";
    const capture = await captureNativeGoalieOutcomes(rows);
    expect(() => buildNativeGoalieVolumeRates({ ...capture.players[0], seasonId: 20262027, cutoffAt: capture.cutoffAt })).toThrow(/at most 65/);
  });

  it("produces a separate credited SO mean and withholds missing/ambiguous selected credits", async () => {
    const capture = await captureNativeGoalieOutcomes(nativeGoalieOutcomeRows()), player = capture.players[0];
    const appearance = player.appearances[0], scope = { nhlPlayerId: player.nhlPlayerId, seasonId: 20262027,
      startDate: appearance.gameDate, endDate: appearance.gameDate, approvedGameIds: [appearance.gameId] };
    const data = [{ playerId: player.nhlPlayerId, gameId: appearance.gameId, seasonId: 20262027, gameDate: appearance.gameDate,
      gamesPlayed: 1, shutouts: 1, saves: appearance.saves, goalsAgainst: appearance.goalsAgainst,
      shotsAgainst: appearance.shotsAgainst, timeOnIce: 3600 }];
    const summary = (rows: unknown[]) => { const rawBody = JSON.stringify({ data: rows, total: rows.length });
      return { scope, receipts: [{ url: nativeGoalieSummaryUrl(scope), rawBody, capturedAt: capture.cutoffAt,
        bodySha256: createHash("sha256").update(rawBody).digest("hex") }] }; };
    const input = { ...player, seasonId: 20262027, cutoffAt: capture.cutoffAt, shutoutSummary: summary(data) };
    const result = buildNativeGoalieShutoutRates(input);
    expect(result.policyVersion).toBe(NATIVE_GOALIE_SHUTOUT_POLICY_VERSION);
    expect(result.targets).toEqual([expect.objectContaining({ targetKey: "SHUTOUTS_GOALIE", basis: "per_appearance", rate: 1 })]);
    expect(buildNativeGoalieShutoutRates({ ...input, shutoutSummary: undefined }).targets).toEqual([]);
    expect(buildNativeGoalieShutoutRates({ ...input, shutoutSummary: summary([]) }).targets).toEqual([]);
    expect(buildNativeGoalieShutoutRates({ ...input, shutoutSummary: summary([...data, ...data]) }).targets).toEqual([]);
    const original = structuredClone(appearance.finalBoxscore) as any;
    const secondGame = { ...original.game, id: 31, date: "2026-09-26", startTime: "2026-09-26T01:00:00Z" };
    Object.assign(original.rawRow, { game_id: 31, fetched_at: "2026-09-26T10:00:00Z" });
    Object.assign(original.rawRow.payload, { id: 31, gameDate: secondGame.date, startTimeUTC: secondGame.startTime });
    const second = baselineAppearanceFromBoxscore({ rawRow: original.rawRow, game: secondGame, nhlPlayerId: player.nhlPlayerId,
      teamId: appearance.teamId, cutoffAt: capture.cutoffAt, population: "goalie" })!;
    const twoScope = { ...scope, startDate: secondGame.date, approvedGameIds: [appearance.gameId, second.gameId] };
    const twoSummary = summary(data); twoSummary.scope = twoScope; twoSummary.receipts[0].url = nativeGoalieSummaryUrl(twoScope);
    expect(buildNativeGoalieShutoutRates({ ...input, appearances: [appearance, second], shutoutSummary: twoSummary }).targets).toEqual([]);
    const fullBody = JSON.stringify({ total: 2, data: [...data, { ...data[0], gameId: second.gameId, gameDate: second.gameDate, shutouts: 0 }] });
    twoSummary.receipts[0].rawBody = fullBody;
    twoSummary.receipts[0].bodySha256 = createHash("sha256").update(fullBody).digest("hex");
    expect(buildNativeGoalieShutoutRates({ ...input, appearances: [appearance, second], shutoutSummary: twoSummary }).targets[0].rate).toBe(0.5);
    const bundle = buildGoalieContributionBundle({ seasonId: 20262027, cutoffAt: capture.cutoffAt,
      issuedAt: "2026-09-28T13:00:00Z", expiresAt: "2026-10-01T00:00:00Z", scheduleRevision: "schedule",
      snapshots: [{ snapshot: result, teamId: player.teamId, rosterRevision: player.rosterRevision }] });
    expect(bundle.sources[0]).toMatchObject({ targetKey: "SHUTOUTS_GOALIE", mean: 1, released: false, basis: "per_appearance" });
    expect(bundle.sources[0].allowedUses).toBeUndefined();
  });
  it("uses explicit summary credits across the full appearance denominator including relief while preserving old W policy", async () => {
    const full = await captureNativeGoalieOutcomes(nativeGoalieOutcomeRows()), player = full.players[0];
    const reliefRows = nativeGoalieOutcomeRows(), history = reliefRows.goaliesGameStats[0], raw = reliefRows.nhl_api_game_payloads_raw[0];
    history.gameId = 31; history.games.id = 31;
    Object.assign(history, { toi: "30:00", goalsAgainst: 2, saveShotsAgainst: "12/14" });
    reliefRows.nhl_api_game_roster_spots[0].game_id = 31;
    raw.id = 3101; raw.game_id = 31; raw.payload.id = 31;
    raw.payload.homeTeam.score = 1; raw.payload.awayTeam.score = 2;
    Object.assign(raw.payload.playerByGameStats.homeTeam.goalies[0], { starter: false, toi: "30:00", saves: 12,
      goalsAgainst: 2, shotsAgainst: 14, saveShotsAgainst: "12/14", decision: null });
    raw.payload.playerByGameStats.homeTeam.goalies.push({ playerId: 78, position: "G", starter: true, toi: "30:00",
      saves: 0, shotsAgainst: 0, goalsAgainst: 0, saveShotsAgainst: "0/0", decision: "L" });
    raw.payload.playerByGameStats.awayTeam.goalies[0].decision = "W";
    const relief = await captureNativeGoalieOutcomes(reliefRows);
    const appearances = [...player.appearances, ...relief.players[0].appearances];
    const input = { ...player, appearances, seasonId: 20262027, cutoffAt: full.cutoffAt };
    const oldHash = playerForecastSourcePayloadHash(buildNativeGoalieWinRates(input));
    expect(buildNativeGoalieWinRates(input).targets).toEqual([]);
    const scope = { nhlPlayerId: player.nhlPlayerId, seasonId: 20262027, startDate: "2026-09-27", endDate: "2026-09-27", approvedGameIds: [30, 31] };
    const data = appearances.map(a => ({ playerId: player.nhlPlayerId, gameId: a.gameId, gameDate: a.gameDate,
      gamesPlayed: 1, wins: a.gameId === 30 ? 1 : 0, losses: 0, otLosses: 0,
      saves: a.saves, shotsAgainst: a.shotsAgainst, goalsAgainst: a.goalsAgainst,
      timeOnIce: (a.finalBoxscore as BaselineBoxscoreReceipt).appearanceSeconds }));
    const summary = (rows: typeof data) => { const rawBody = JSON.stringify({ total: rows.length, data: rows });
      return { scope, receipts: [{ url: nativeGoalieSummaryUrl(scope), rawBody, capturedAt: full.cutoffAt,
        bodySha256: createHash("sha256").update(rawBody).digest("hex") }] }; };
    const result = buildNativeGoalieSummaryWinRates({ ...input, winSummary: summary(data) });
    expect(result.policyVersion).toBe(NATIVE_GOALIE_SUMMARY_WIN_POLICY_VERSION);
    expect(result.targets).toEqual([expect.objectContaining({ targetKey: "WINS_GOALIE", basis: "per_appearance", rate: 0.5,
      recentGameIds: expect.arrayContaining([30, 31]) })]);
    expect(buildNativeGoalieSummaryWinRates(input).targets).toEqual([]);
    expect(buildNativeGoalieSummaryWinRates({ ...input, winSummary: summary(data.slice(0, 1)) }).targets).toEqual([]);
    expect(playerForecastSourcePayloadHash(buildNativeGoalieWinRates(input))).toBe(oldHash);
    const bundle = buildGoalieContributionBundle({ seasonId: 20262027, cutoffAt: full.cutoffAt,
      issuedAt: "2026-09-28T13:00:00Z", expiresAt: "2026-10-01T00:00:00Z", scheduleRevision: "schedule",
      snapshots: [{ snapshot: result, teamId: player.teamId, rosterRevision: player.rosterRevision }] });
    expect(bundle.sources[0]).toMatchObject({ policyVersion: NATIVE_GOALIE_SUMMARY_WIN_POLICY_VERSION, mean: 0.5,
      targetKey: "WINS_GOALIE", basis: "per_appearance", released: false });
  });

  it("explicitly produces native appearance-based win means without changing legacy rates or inventing shutouts", async () => {
    const capture = await captureNativeGoalieOutcomes(nativeGoalieOutcomeRows()), player = capture.players[0];
    const input = { ...player, seasonId: 20262027, cutoffAt: capture.cutoffAt };
    expect(buildGoalieBaselineRates(input).targets).toEqual([]);
    const snapshot = buildNativeGoalieWinRates(input);
    expect(snapshot).toMatchObject({ policyVersion: NATIVE_GOALIE_WIN_POLICY_VERSION,
      definitionHash: nativeGoalieWinDefinitionHash(20262027), validation: "unvalidated" });
    expect(snapshot.targets).toEqual([expect.objectContaining({ targetKey: "WINS_GOALIE", basis: "per_appearance",
      rate: 1, recentGameIds: [30], previousGameIds: [], sourceRows: [] })]);
    expect(snapshot.missingTargetKeys).toContain("SHUTOUTS_GOALIE");
    const bundle = buildGoalieContributionBundle({ seasonId: 20262027, cutoffAt: capture.cutoffAt,
      issuedAt: "2026-09-28T13:00:00Z", expiresAt: "2026-10-04T00:00:00Z", scheduleRevision: "schedule-a",
      snapshots: [{ snapshot, teamId: player.teamId, rosterRevision: player.rosterRevision }] });
    expect(bundle.manifest).toMatchObject({ policyVersion: NATIVE_GOALIE_WIN_POLICY_VERSION, released: false });
    expect(bundle.sources).toEqual([expect.objectContaining({ targetKey: "WINS_GOALIE", mean: 1,
      basis: "per_appearance", participationIntegrated: false, released: false })]);
    expect(bundle.sources[0].allowedUses).toBeUndefined();
  });

  it.each(["missing decision", "missing starter", "relief win", "loss"])("preserves the native appearance denominator for %s", async problem => {
    const rows = nativeGoalieOutcomeRows(), own = rows.nhl_api_game_payloads_raw[0].payload.playerByGameStats.homeTeam;
    if (problem === "missing decision") delete own.goalies[0].decision;
    if (problem === "missing starter") delete own.goalies[0].starter;
    if (problem === "relief win") {
      own.goalies[0].starter = false;
      own.goalies.push({ playerId: 78, position: "G", starter: true, toi: "00:01", saves: 0,
        shotsAgainst: 0, goalsAgainst: 0, saveShotsAgainst: "0/0" });
    }
    if (problem === "loss") {
      const body = rows.nhl_api_game_payloads_raw[0].payload;
      body.homeTeam.score = 0; body.awayTeam.score = 1;
      Object.assign(own.goalies[0], { decision: "L", goalsAgainst: 1, shotsAgainst: 25, saveShotsAgainst: "24/25" });
      Object.assign(rows.goaliesGameStats[0], { goalsAgainst: 1, saveShotsAgainst: "24/25" });
      Object.assign(body.playerByGameStats.awayTeam.goalies[0], { decision: "W", goalsAgainst: 0, shotsAgainst: 24, saveShotsAgainst: "24/24" });
    }
    const capture = await captureNativeGoalieOutcomes(rows);
    const snapshot = buildNativeGoalieWinRates({ ...capture.players[0], seasonId: 20262027, cutoffAt: capture.cutoffAt });
    if (problem.startsWith("missing")) {
      expect(snapshot.targets).toEqual([]);
      expect(snapshot.limitations.join(" ")).toContain("selected games: 30");
    } else expect(snapshot.targets).toEqual([expect.objectContaining({ basis: "per_appearance", rate: problem === "loss" ? 0 : 1 })]);
    expect(snapshot.missingTargetKeys).toContain("SHUTOUTS_GOALIE");
  });

  it("withholds all native win means when one selected appearance has missing outcome evidence", async () => {
    const win = await captureNativeGoalieOutcomes(nativeGoalieOutcomeRows()), missingRows = nativeGoalieOutcomeRows();
    const history = missingRows.goaliesGameStats[0], raw = missingRows.nhl_api_game_payloads_raw[0];
    history.gameId = 31; history.games.id = 31;
    missingRows.nhl_api_game_roster_spots[0].game_id = 31;
    raw.id = 3101; raw.game_id = 31; raw.payload.id = 31;
    delete raw.payload.playerByGameStats.homeTeam.goalies[0].decision;
    const missing = await captureNativeGoalieOutcomes(missingRows);
    const input = { ...win.players[0], seasonId: 20262027, cutoffAt: win.cutoffAt,
      appearances: [...win.players[0].appearances, ...missing.players[0].appearances] };
    expect(buildNativeGoalieWinRates(input).targets).toEqual([]);
    const forged = structuredClone(input);
    (forged.appearances[0].finalBoxscore as any).rawRow.payload.playerByGameStats.homeTeam.goalies[0].decision = "L";
    expect(() => buildNativeGoalieWinRates(forged)).toThrow(/bound retained boxscore content/);
    expect(() => buildNativeGoalieWinRates({ ...input, appearances: [input.appearances[0], input.appearances[0]] })).toThrow(/unique games/);
    expect(() => buildNativeGoalieWinRates({ ...input, projections: [projection] })).toThrow(/without projections/);
    const body = raw.payload;
    body.homeTeam.score = 0; body.awayTeam.score = 1;
    Object.assign(body.playerByGameStats.homeTeam.goalies[0], { decision: "L", goalsAgainst: 1, shotsAgainst: 25, saveShotsAgainst: "24/25" });
    Object.assign(history, { goalsAgainst: 1, saveShotsAgainst: "24/25" });
    Object.assign(body.playerByGameStats.awayTeam.goalies[0], { decision: "W", goalsAgainst: 0, shotsAgainst: 24, saveShotsAgainst: "24/24" });
    const loss = await captureNativeGoalieOutcomes(missingRows);
    expect(buildNativeGoalieWinRates({ ...input, appearances: [...win.players[0].appearances, ...loss.players[0].appearances] }).targets)
      .toEqual([expect.objectContaining({ rate: 0.5, basis: "per_appearance", recentGameIds: [31, 30] })]);
  });

  it("captures native starter/decision provenance without creating W or SO forecast rates", async () => {
    const capture = await captureNativeGoalieOutcomes(nativeGoalieOutcomeRows());
    const player = capture.players[0];
    expect(player.projections).toEqual([]);
    expect(player.nativeOutcomes![0]).toMatchObject({ gameId: 30 });
    expect(player.nativeOutcomes![0].receipt).toMatchObject({ officialStarter: true, officialDecision: "W",
      winCredit: 1, shutoutCredit: null, qualificationEligible: false, forecastIssued: false,
      conditioning: "positive_minute_historical_appearance", cutoffAt: capture.capturedAt,
      sourceReceipt: { rawRowId: 3001, providerPayloadHash: "a".repeat(64),
        fetchedAt: "2026-09-27T10:00:00.000123+00:00" } });
    const before = JSON.stringify(capture);
    await expect(persistCapturedGoalieBaselineInputs({ db: {} as never, seasonId: 20262027, capture }))
      .resolves.toMatchObject({ dryRun: true, receipts: [{ payloadHash: player.sourceWatermark, inserted: false }] });
    expect(JSON.stringify(capture)).toBe(before);
    const rates = buildGoalieBaselineRates({ ...player, seasonId: 20262027, cutoffAt: capture.cutoffAt });
    expect(player.appearances[0].saves).toBe(24);
    // A current-season appearance alone cannot create the missing ability prior.
    expect(rates.targets).toEqual([]);
    expect(rates.missingTargetKeys).toEqual(expect.arrayContaining(["WINS_GOALIE", "SHUTOUTS_GOALIE"]));
    const legacy = structuredClone(capture);
    delete legacy.players[0].nativeOutcomes;
    const { sourceWatermark: _old, ...legacyPlayer } = legacy.players[0];
    legacy.players[0].sourceWatermark = playerForecastSourcePayloadHash({ basis: legacy.basis,
      capturedAt: legacy.capturedAt, ...legacyPlayer });
    await expect(persistCapturedGoalieBaselineInputs({ db: {} as never, seasonId: 20262027, capture: legacy }))
      .resolves.toMatchObject({ dryRun: true });
  });

  it.each(["missing starter", "missing decision", "contradictory decision", "relief win", "invalid opposing components"])(
    "keeps native captured outcomes honest for %s without losing volume evidence", async problem => {
      const rows = nativeGoalieOutcomeRows(), own = rows.nhl_api_game_payloads_raw[0].payload.playerByGameStats.homeTeam;
      if (problem === "missing starter") delete own.goalies[0].starter;
      if (problem === "missing decision") delete own.goalies[0].decision;
      if (problem === "contradictory decision") own.goalies[0].decision = "L";
      if (problem === "invalid opposing components") {
        const opposing = rows.nhl_api_game_payloads_raw[0].payload.playerByGameStats.awayTeam.goalies[0];
        opposing.shotsAgainst = 26; opposing.saveShotsAgainst = "24/26";
      }
      if (problem === "relief win") {
        own.goalies[0].starter = false;
        own.goalies.push({ playerId: 78, position: "G", starter: true, toi: "00:01",
          saves: 0, shotsAgainst: 0, goalsAgainst: 0, saveShotsAgainst: "0/0" });
      }
      const capture = await captureNativeGoalieOutcomes(rows), appearance = capture.players[0].appearances[0],
        outcome = capture.players[0].nativeOutcomes![0].receipt;
      expect(appearance.saves).toBe(24);
      if (problem === "missing decision") expect(outcome).toMatchObject({
        officialStarter: true, officialDecision: null, winCredit: null, shutoutCredit: null });
      else if (problem === "relief win") expect(outcome).toMatchObject({
        officialStarter: false, officialDecision: "W", winCredit: 1, shutoutCredit: null });
      else expect(outcome).toBeNull();
      await expect(persistCapturedGoalieBaselineInputs({ db: {} as never, seasonId: 20262027, capture }))
        .resolves.toMatchObject({ dryRun: true });
      const rates = buildGoalieBaselineRates({ ...capture.players[0], seasonId: 20262027, cutoffAt: capture.cutoffAt });
      expect(rates.targets.some(row => row.basis === "per_start")).toBe(false);
    });

  it("rejects rehashed verified outcomes for invalid auxiliary context while preserving selected volume", async () => {
    const verified = await captureNativeGoalieOutcomes(nativeGoalieOutcomeRows()), rows = nativeGoalieOutcomeRows();
    const opposing = rows.nhl_api_game_payloads_raw[0].payload.playerByGameStats.awayTeam.goalies[0];
    opposing.shotsAgainst = 26; opposing.saveShotsAgainst = "24/26";
    const capture = await captureNativeGoalieOutcomes(rows);
    expect(capture.players[0].appearances[0].saves).toBe(24);
    expect(capture.players[0].nativeOutcomes![0].receipt).toBeNull();
    await expect(persistCapturedGoalieBaselineInputs({ db: {} as never, seasonId: 20262027, capture }))
      .resolves.toMatchObject({ dryRun: true });
    capture.players[0].nativeOutcomes = structuredClone(verified.players[0].nativeOutcomes);
    const { sourceWatermark: _old, ...player } = capture.players[0];
    capture.players[0].sourceWatermark = playerForecastSourcePayloadHash({ basis: capture.basis,
      capturedAt: capture.capturedAt, ...player });
    await expect(persistCapturedGoalieBaselineInputs({ db: {} as never, seasonId: 20262027, capture }))
      .rejects.toThrow(/native goalie outcomes do not match/);
  });

  it.each(["win", "starter", "source clock", "withheld receipt", "wrong game", "duplicate game"])(
    "rejects rehashed captured native outcome tampering: %s", async problem => {
      const capture = await captureNativeGoalieOutcomes(nativeGoalieOutcomeRows()), entry = capture.players[0].nativeOutcomes![0];
      if (problem === "win") entry.receipt!.winCredit = 0;
      if (problem === "starter") entry.receipt!.officialStarter = false;
      if (problem === "source clock") entry.receipt!.sourceReceipt.fetchedAt = "2026-09-27T10:00:01Z";
      if (problem === "withheld receipt") entry.receipt = null;
      if (problem === "wrong game") entry.gameId = 31;
      if (problem === "duplicate game") capture.players[0].nativeOutcomes!.push(structuredClone(entry));
      const { sourceWatermark: _old, ...player } = capture.players[0];
      capture.players[0].sourceWatermark = playerForecastSourcePayloadHash({ basis: capture.basis,
        capturedAt: capture.capturedAt, ...player });
      await expect(persistCapturedGoalieBaselineInputs({ db: {} as never, seasonId: 20262027, capture }))
        .rejects.toThrow(/native goalie outcomes do not match/);
    });

  it("retains per-target source exclusions and never supplies missing priors or legacy starts", () => {
    const input = { playerId: 7, nhlPlayerId: 77, seasonId: 20262027,
      cutoffAt, sourceWatermark: "w", projections: [projection], appearances: [] };
    const result = buildGoalieBaselineRates(input);
    expect(result.definitionHash).toBe(baselineDefinitionHash("goalie", 20262027));
    expect(result.targets.find(row => row.targetKey === "SAVES_GOALIE")?.missingSourceIds)
      .toEqual(["dtz_goalies", "5v5_goalies"]);
    expect(result.missingTargetKeys).toContain("GOALIE_MINUTES");
    const legacy = buildGoalieBaselineRates({ ...input, seasonId: 20252026,
      projections: [{ ...projection, sourceId: "dtz_goalies", seasonId: 20252026 }] });
    expect(legacy.targets.find(row => row.targetKey === "SAVES_GOALIE")?.rate).toBe(25);
    expect(legacy.targets.some(row => row.basis === "per_start")).toBe(false);
    const wrongTable = buildGoalieBaselineRates({ ...input, projections: [{ ...projection,
      sourceTable: "PROJECTIONS_20252026_CULLEN_GOALIES" }] });
    expect(wrongTable.targets).toEqual([]);
    const future = buildGoalieBaselineRates({ ...input, seasonId: 20272028 });
    expect(future.targets).toEqual([]);
    expect(future.missingSourceIds).toEqual([...BASELINE_CANDIDATE_POLICY.sourceIds.goalie]);
    expect(future.definitionHash).not.toBe(result.definitionHash);
  });

  it("keeps per-appearance volumes separate from per-start outcomes", () => {
    const snapshot = buildGoalieBaselineRates({ playerId: 7, nhlPlayerId: 77, seasonId: 20262027,
      cutoffAt, sourceWatermark: "w", projections: [projection], appearances: [{
        gameId: 2, seasonId: 20252026, gameDate: "2026-03-01", availableAt: cutoffAt,
        teamId: 1, regularSeason: true, saves: 20, goalsAgainst: 2, shotsAgainst: 22,
        toiMinutes: 60,
      }, { gameId: 3, seasonId: 20262027, gameDate: "2026-09-27", availableAt: cutoffAt,
        teamId: 1, regularSeason: true, saves: 10, goalsAgainst: 1, shotsAgainst: 11,
        toiMinutes: 30 }] });
    const saves = snapshot.targets.find((row) => row.targetKey === "SAVES_GOALIE")!;
    const wins = snapshot.targets.find((row) => row.targetKey === "WINS_GOALIE")!;
    expect(saves.basis).toBe("per_appearance");
    expect(saves.rate).toBeCloseTo((20 * (0.6 * 25 + 0.4 * 20) + 10) / 21);
    expect(wins.basis).toBe("per_start");
    expect(wins.rate).toBe(0.5);
    expect(wins.previousSeasonRate).toBeNull();
    expect(wins.recentGameIds).toEqual([]);
    expect(snapshot.targets.find((row) => row.targetKey === "GOALIE_MINUTES")?.rate)
      .toBeCloseTo((20 * 60 + 30) / 21);
    const noStarts = buildGoalieBaselineRates({ playerId: 7, nhlPlayerId: 77, seasonId: 20262027,
      cutoffAt, sourceWatermark: "w", projections: [{ ...projection, projectedStarts: null }], appearances: [] });
    expect(noStarts.targets.some((row) => row.basis === "per_start")).toBe(false);
  });

  it("uses a final same-day appearance only when its boxscore predates the cutoff", () => {
    const appearance = { gameId: 30, seasonId: 20262027, gameDate: "2026-09-28",
      availableAt: cutoffAt, teamId: 1, regularSeason: true, saves: 12,
      goalsAgainst: 1, shotsAgainst: 13, toiMinutes: 42 };
    const input = { playerId: 7, nhlPlayerId: 77, seasonId: 20262027,
      cutoffAt, sourceWatermark: "w", projections: [projection] };
    expect(buildGoalieBaselineRates({ ...input, appearances: [appearance] }).targets
      .find((row) => row.targetKey === "SAVES_GOALIE")?.recentGameIds).toEqual([]);
    const final = { ...appearance, finalBoxscore: { payloadHash: "a".repeat(64),
      fetchedAt: "2026-09-28T11:00:00Z" } };
    expect(buildGoalieBaselineRates({ ...input, appearances: [final] }).targets
      .find((row) => row.targetKey === "SAVES_GOALIE")?.recentGameIds).toEqual([30]);
    expect(buildGoalieBaselineRates({ ...input, appearances: [{ ...final,
      finalBoxscore: { ...final.finalBoxscore, fetchedAt: "2026-09-28T13:00:00Z" } }] }).targets
      .find((row) => row.targetKey === "SAVES_GOALIE")?.recentGameIds).toEqual([]);
  });

  it("builds only unreleased dry-run sources with compatible bases", async () => {
    const databaseMustNotRun = new Proxy({}, { get() { throw new Error("database accessed"); } });
    const historicalSources = baselineHistoricalSources([], [], [],
      { nhlIds: [77], seasonId: 20262027, upperDate: cutoffAt.slice(0, 10) }, 77);
    const schemas = baselineProjectionSchemas("goalie", 20262027);
    const projectionRow = { player_id: 77, upload_batch_id: "c-1", Games_Played: 40, Games_Started_Goalie: 30,
      Saves_Goalie: 1000, Goals_Against_Goalie: 100, Wins_Goalie: 15, Shutouts_Goalie: 3 };
    const projectionSelection = baselineProjectionSelectionReceipt(schemas.map((schema, index) => ({
      schema, rows: index ? [] : [projectionRow], status: "available" })), 77, 20262027);
    const player = { playerId: 7, nhlPlayerId: 77, teamId: 1, rosterRevision: "roster-a",
      definitionHash: baselineDefinitionHash("goalie", 20262027), projectionSources: schemas.map((schema, index) => ({
        sourceId: schema.id, tableName: schema.tableName, status: "available" as const, rowCount: index ? 0 : 1 })),
      historicalSources, projectionSelection, limitations: [...baselineHistoricalSourceLimitations(historicalSources),
        ...baselineProjectionSelectionLimitations(projectionSelection)],
      projections: [baselineProjectionFromRow(schemas[0], projectionRow, 20262027, cutoffAt, true)!], appearances: [] };
    const sourceWatermark = playerForecastSourcePayloadHash({ basis: "captured_current",
      capturedAt: cutoffAt, ...player });
    const result = await dryRunCapturedGoalieBundle(databaseMustNotRun as never, {
      seasonId: 20262027, issuedAt: "2026-09-28T12:01:00Z",
      expiresAt: "2026-09-29T12:01:00Z", scheduleRevision: "schedule-a",
      capture: { basis: "captured_current", capturedAt: cutoffAt, cutoffAt,
        players: [{ ...player, sourceWatermark }] },
    });
    expect(result.receipt.dryRun).toBe(true);
    expect(result.manifest.released).toBe(false);
    expect(result.sources.find((row) => row.targetKey === "WINS_GOALIE")?.basis).toBe("per_start");
    expect(result.sources.find((row) => row.targetKey === "SAVES_GOALIE")?.basis).toBe("per_appearance");
    await expect(dryRunCapturedGoalieBundle(databaseMustNotRun as never, {
      seasonId: 20262027, issuedAt: "2026-09-28T12:01:00Z",
      expiresAt: "2026-09-29T12:01:00Z", scheduleRevision: "schedule-a",
      capture: { basis: "captured_current", capturedAt: cutoffAt, cutoffAt,
        players: [{ ...player, sourceWatermark: "forged" }] },
    })).rejects.toThrow(/watermark/);
  });

  it("rejects forged goalie bundle identities, targets and lineage", () => {
    const snapshot = buildGoalieBaselineRates({ playerId: 7, nhlPlayerId: 77,
      seasonId: 20262027, cutoffAt, sourceWatermark: "w",
      projections: [projection], appearances: [] });
    const input = { seasonId: 20262027, cutoffAt, issuedAt: "2026-09-28T12:01:00Z",
      expiresAt: "2026-09-29T12:01:00Z", scheduleRevision: "schedule-a",
      snapshots: [{ snapshot, teamId: 1, rosterRevision: "r" }] };
    expect(() => buildGoalieContributionBundle({ ...input, snapshots: [{ ...input.snapshots[0],
      snapshot: { ...snapshot, nhlPlayerId: -1 } }] })).toThrow(/identity/);
    expect(() => buildGoalieContributionBundle({ ...input, snapshots: [{ ...input.snapshots[0],
      snapshot: { ...snapshot, definitionHash: undefined as never } }] })).toThrow(/identity/);
    expect(() => buildGoalieContributionBundle({ ...input, snapshots: [{ ...input.snapshots[0],
      snapshot: { ...snapshot, targets: [...snapshot.targets, snapshot.targets[0]] } }] })).toThrow(/target/);
    expect(() => buildGoalieContributionBundle({ ...input, snapshots: [{ ...input.snapshots[0],
      snapshot: { ...snapshot, targets: [{ ...snapshot.targets[0], basis: "per_start",
        sourceRows: [{ sourceId: "x", rowId: "y", availableAt: "invalid" }] }] } }] })).toThrow(/target/);
  });

  it("captures season-specific goalie schemas without inventing absent start denominators", async () => {
    const calls: Array<{ table: string; method: string; args: unknown[] }> = [];
    const tables: Record<string, any[]> = {
      PROJECTIONS_20252026_DTZ_GOALIES: [{ player_id: 77, upload_batch_id: "legacy",
        Games_Played: 40, Saves_Goalie: 1000, Ga: 100, Sa: 1100, Wins_Goalie: 15, Shutouts_Goalie: 3 }],
    };
    const errors: Record<string, { code: string }> = Object.fromEntries(
      baselineProjectionSchemas("goalie", 20272028).map(row => [row.tableName!, { code: "42P01" }]));
    const db = goalieCaptureDb(tables, calls, errors);
    const args = { db: db as never, now: () => new Date("2026-10-01T12:00:00Z"),
      players: [{ playerId: 7, nhlPlayerId: 77, teamId: 1, rosterRevision: "r" }] };
    const legacy = await captureCurrentGoalieBaselineInputs({ ...args, seasonId: 20252026 });
    expect(legacy.players[0].projections[0]).toMatchObject({ seasonId: 20252026,
      sourceTable: "PROJECTIONS_20252026_DTZ_GOALIES", projectedStarts: null,
      totals: { SAVES_GOALIE: 1000, GOALS_AGAINST_GOALIE: 100, SHOTS_AGAINST_GOALIE: 1100 } });
    const select = calls.find(row => row.table === "PROJECTIONS_20252026_DTZ_GOALIES" && row.method === "select");
    expect(select?.args[0]).toContain("Ga,Sa");
    expect(select?.args[0]).not.toContain("Games_Started_Goalie");
    const snapshot = buildGoalieBaselineRates({ ...legacy.players[0], seasonId: 20252026,
      cutoffAt: legacy.cutoffAt });
    expect(snapshot.targets.find(row => row.targetKey === "SAVES_GOALIE")?.rate).toBe(25);
    expect(snapshot.targets.some(row => row.basis === "per_start")).toBe(false);
    const bundle = buildGoalieContributionBundle({ seasonId: 20252026, cutoffAt: legacy.cutoffAt,
      issuedAt: "2026-10-01T12:01:00Z", expiresAt: "2026-10-02T00:00:00Z", scheduleRevision: "s",
      snapshots: [{ snapshot, teamId: 1, rosterRevision: "r" }] });
    expect(bundle.manifest.released).toBe(false);
    await expect(persistCapturedGoalieBaselineInputs({ db: {} as never, seasonId: 20252026,
      capture: legacy })).resolves.toMatchObject({ dryRun: true });
    await expect(persistCapturedGoalieBaselineInputs({ db: {} as never, seasonId: 20252026,
      capture: { ...legacy, players: [{ ...legacy.players[0], definitionHash: undefined as never }] } }))
      .rejects.toThrow(/definition/);
    tables.PROJECTIONS_20252026_DTZ_GOALIES.push({ ...tables.PROJECTIONS_20252026_DTZ_GOALIES[0],
      upload_batch_id: "another-batch" });
    await expect(captureCurrentGoalieBaselineInputs({ ...args, seasonId: 20252026 }))
      .rejects.toThrow(/Ambiguous.*projection row/);
    tables.PROJECTIONS_20252026_DTZ_GOALIES.pop();
    calls.length = 0;
    const future = await captureCurrentGoalieBaselineInputs({ ...args, seasonId: 20272028 });
    expect(future.players[0].projections).toEqual([]);
    expect(future.players[0].projectionSources.every(row => row.status === "table_unavailable")).toBe(true);
    expect(calls.some(row => row.table.includes("20262027"))).toBe(false);
    errors.PROJECTIONS_20272028_CULLEN_GOALIES = { code: "42703" };
    await expect(captureCurrentGoalieBaselineInputs({ ...args, seasonId: 20272028 }))
      .rejects.toThrow(/capture incomplete/);
  });

  it("captures current public goalie rows with historical team and explicit TOI", async () => {
    const calls: Array<{ table: string; method: string; args: unknown[] }> = [];
    const rows: Record<string, any[]> = {
      PROJECTIONS_20262027_CULLEN_GOALIES: [{ player_id: 77, upload_batch_id: "c-1",
        Games_Played: 40, Games_Started_Goalie: 30, Saves_Goalie: 1000,
        Goals_Against_Goalie: 100, Wins_Goalie: 15, Shutouts_Goalie: 3 }],
      goaliesGameStats: [{ playerId: 77, gameId: 2, saveShotsAgainst: "20/22",
        goalsAgainst: 2, toi: "60:30",
        games: { id: 2, date: "2026-03-01", seasonId: 20252026, type: 2 } }],
      nhl_api_game_roster_spots: [{ game_id: 2, player_id: 77, team_id: 4,
        season_id: 20252026, game_date: "2026-03-01" }],
    };
    const db = goalieCaptureDb(rows, calls);
    const times = [new Date("2026-09-28T12:00:00Z"), new Date("2026-09-28T12:00:01Z")];
    const capture = await captureCurrentGoalieBaselineInputs({ db: db as never, seasonId: 20262027,
      players: [{ playerId: 7, nhlPlayerId: 77, teamId: 1, rosterRevision: "r" }],
      now: () => times.shift()! });
    expect(capture.basis).toBe("captured_current");
    expect(capture.players[0].projections[0].availableAt).toBe(capture.capturedAt);
    expect(capture.players[0].appearances[0].teamId).toBe(4);
    expect(capture.players[0].appearances[0].toiMinutes).toBe(60.5);
    expect(calls.find((call) => call.table === "goaliesGameStats" && call.method === "in"
      && call.args[0] === "playerId")?.args[1]).toEqual([77]);
    expect(calls.some((call) => call.table.includes("DOM") || call.table.includes("DOBBER"))).toBe(false);
    const crossing = [new Date("2026-09-28T23:59:59Z"), new Date("2026-09-29T00:00:01Z")];
    await expect(captureCurrentGoalieBaselineInputs({ db: db as never, seasonId: 20262027,
      players: [{ playerId: 7, nhlPlayerId: 77, teamId: 1, rosterRevision: "r" }],
      now: () => crossing.shift()! })).rejects.toThrow(/crossed its UTC cutoff date/);
  });

  it("requires stable rows and final evidence for same-day capture", async () => {
    const sameDay = { playerId: 77, gameId: 30, saveShotsAgainst: "12/13",
      goalsAgainst: 1, toi: "42:00",
      games: { id: 30, date: "2026-09-28", seasonId: 20262027, type: 2 } };
    const tables: Record<string, any[]> = {
      goaliesGameStats: [sameDay],
      nhl_api_game_roster_spots: [{ game_id: 30, player_id: 77, team_id: 4,
        season_id: 20262027, game_date: "2026-09-28" }],
      nhl_api_game_payloads_raw: [{ game_id: 30, season_id: 20262027,
        payload_hash: "a".repeat(64), fetched_at: "2026-09-28T11:00:00Z",
        payload: { id: 30, season: 20262027, gameState: "FINAL" } }],
    };
    const request = { seasonId: 20262027,
      players: [{ playerId: 7, nhlPlayerId: 77, teamId: 1, rosterRevision: "r" }],
      now: () => new Date("2026-09-28T12:00:00Z") };
    const db = goalieCaptureDb(tables);
    const captured = await captureCurrentGoalieBaselineInputs({ ...request, db: db as never });
    expect(captured.players[0].appearances[0].finalBoxscore).toMatchObject({
      payloadHash: "a".repeat(64), fetchedAt: "2026-09-28T11:00:00Z" });
    tables.nhl_api_game_payloads_raw.unshift({ ...tables.nhl_api_game_payloads_raw[0],
      id: 3002,
      fetched_at: "2026-09-28T11:30:00Z",
      payload: { id: 30, season: 20262027, gameState: "LIVE" } });
    const unresolved = await captureCurrentGoalieBaselineInputs({ ...request, db: db as never });
    expect(unresolved.players[0].appearances).toEqual([]);
  });

  it("fails closed when a source changes between capture reads", async () => {
    let reads = 0;
    await expect(readStableCurrentInputs(async () => ({ rows: [{ value: ++reads }] })))
      .rejects.toThrow(/changed during reads/);
  });

  it("requires an explicit immutable goalie row selection for duplicate imports", async () => {
    const sourceRows = [
      { player_id: 77, upload_batch_id: "older", Games_Played: 40, Saves_Goalie: 2000, Ga: 200, Sa: 2200 },
      { player_id: 77, upload_batch_id: "selected", Games_Played: 40, Saves_Goalie: 1000, Ga: 100, Sa: 1100 },
    ];
    const db = goalieCaptureDb({ PROJECTIONS_20252026_DTZ_GOALIES: sourceRows });
    const schema = baselineProjectionSchemas("goalie", 20252026).find(row => row.id === "dtz_goalies")!;
    const args = { db: db as never, seasonId: 20252026,
      players: [{ playerId: 7, nhlPlayerId: 77, teamId: 1, rosterRevision: "r" }],
      now: () => new Date("2026-10-01T12:00:00Z") };
    await expect(captureCurrentGoalieBaselineInputs(args)).rejects.toThrow(/Ambiguous/);
    const projectionSelection = { dtz_goalies: { 77: { rowId: "selected",
      contentHash: baselineProjectionContentHash(schema, sourceRows[1]) } } };
    const capture = await captureCurrentGoalieBaselineInputs({ ...args, projectionSelection });
    expect(capture.players[0].projections[0]).toMatchObject({ projectedStarts: null,
      sourceRowId: "selected", sourceContentHash: projectionSelection.dtz_goalies[77].contentHash });
    await expect(persistCapturedGoalieBaselineInputs({ db: {} as never, seasonId: 20252026, capture }))
      .resolves.toMatchObject({ dryRun: true });
    sourceRows[1].Saves_Goalie = 999;
    await expect(captureCurrentGoalieBaselineInputs({ ...args, projectionSelection })).rejects.toThrow(/missing or changed/);
  });

  it("binds measured goalie components, supersedes legacy logs and rejects rehashed disagreements", async () => {
    const rows: Record<string, any[]> = {
      goaliesGameStats: [{ playerId: 77, gameId: 30, saveShotsAgainst: "20/22", goalsAgainst: 2, toi: "30:30",
        games: { id: 30, date: "2026-09-27", seasonId: 20262027, type: 2 } }],
      nhl_api_game_roster_spots: [{ game_id: 30, player_id: 77, team_id: 4,
        season_id: 20262027, game_date: "2026-09-27" }],
    };
    const args = { db: goalieCaptureDb(rows) as never, seasonId: 20262027,
      players: [{ playerId: 7, nhlPlayerId: 77, teamId: 1, rosterRevision: "r" }],
      now: () => new Date("2026-09-28T12:00:00Z") };
    const capture = await captureCurrentGoalieBaselineInputs(args);
    expect(capture.players[0].appearances[0]).toMatchObject({ saves: 20, shotsAgainst: 22,
      goalsAgainst: 2, toiMinutes: 30.5 });
    await expect(persistCapturedGoalieBaselineInputs({ db: {} as never, seasonId: 20262027, capture }))
      .resolves.toMatchObject({ dryRun: true });
    const forged = structuredClone(capture);
    forged.players[0].appearances[0].toiMinutes = 60;
    const { sourceWatermark: _old, ...player } = forged.players[0];
    forged.players[0].sourceWatermark = playerForecastSourcePayloadHash({ basis: forged.basis,
      capturedAt: forged.capturedAt, ...player });
    await expect(persistCapturedGoalieBaselineInputs({ db: {} as never, seasonId: 20262027, capture: forged }))
      .rejects.toThrow(/values do not match/);
    rows.goaliesGameStats[0].goalsAgainst = 3;
    const corrected = await captureCurrentGoalieBaselineInputs(args);
    expect(corrected.players[0].appearances[0].goalsAgainst).toBe(2);
    expect(corrected.limitations.join(" ")).toContain("supersede 1 disagreeing normalized");
    rows.goaliesGameStats[0].goalsAgainst = 2;
    rows.nhl_api_game_payloads_raw[0].payload.playerByGameStats.homeTeam.goalies[0].shotsAgainst = 999;
    await expect(captureCurrentGoalieBaselineInputs(args)).rejects.toThrow(/conflicting boxscore goalie components/);
  });

  it("recovers a roster-only goalie appearance and excludes a verified zero-TOI backup", async () => {
    const rows: Record<string, any[]> = {
      PROJECTIONS_20262027_CULLEN_GOALIES: [{ player_id: 77, upload_batch_id: "c", Games_Played: 40,
        Saves_Goalie: 1000, Goals_Against_Goalie: 100 }],
      games: [{ id: 30, date: "2026-09-27", seasonId: 20262027, type: 2,
        startTime: "2026-09-27T01:00:00Z", homeTeamId: 4, awayTeamId: 5 }],
      nhl_api_game_roster_spots: [{ game_id: 30, player_id: 77, team_id: 4,
        season_id: 20262027, game_date: "2026-09-27" }],
      nhl_api_game_payloads_raw: [{ id: 3001, game_id: 30, season_id: 20262027,
        payload_hash: "a".repeat(64), fetched_at: "2026-09-27T10:00:00Z",
        payload: { id: 30, season: 20262027, gameDate: "2026-09-27", gameType: 2, gameState: "FINAL",
          homeTeam: { id: 4 }, awayTeam: { id: 5 }, playerByGameStats: {
            homeTeam: { forwards: [{ playerId: 1001 }], defense: [], goalies: [{ playerId: 77, toi: "30:30", saves: 20,
              shotsAgainst: 22, goalsAgainst: 2 }] },
            awayTeam: { forwards: [{ playerId: 1002 }], defense: [], goalies: [{ playerId: 1003 }] } } } }],
    };
    const args = { db: goalieCaptureDb(rows) as never, seasonId: 20262027,
      players: [{ playerId: 7, nhlPlayerId: 77, teamId: 1, rosterRevision: "r" }],
      now: () => new Date("2026-09-28T12:00:00Z") };
    const capture = await captureCurrentGoalieBaselineInputs(args);
    expect(capture.players[0].appearances).toHaveLength(1);
    expect(capture.players[0].appearances[0]).toMatchObject({ gameId: 30, toiMinutes: 30.5, saves: 20 });
    expect(capture.players[0].historicalSources).toMatchObject({ populationCoverage: "unverified",
      games: [{ game: { id: 30 }, normalization: null, roster: { team_id: 4 } }] });
    expect(capture.limitations.join(" ")).toContain("Recovered 1 goalie appearances without normalized logs");
    const bundle = await dryRunCapturedGoalieBundle({} as never, { capture, seasonId: 20262027,
      issuedAt: "2026-09-28T12:01:00Z", expiresAt: "2026-10-20T12:00:00Z", scheduleRevision: "s" });
    expect(bundle.sources.find(row => row.targetKey === "SAVES_GOALIE")?.limitations)
      .toContain("Recovered 1 goalie appearances without normalized logs.");
    expect(bundle.sources.find(row => row.targetKey === "SAVES_GOALIE")?.limitations)
      .toContain("Historical normalization lineage: 0 complete, 0 stale, 1 missing among 1 discovered games.");
    rows.nhl_api_game_payloads_raw[0].payload.playerByGameStats.homeTeam.goalies[0].toi = "00:00";
    const backup = await captureCurrentGoalieBaselineInputs(args);
    expect(backup.players[0].appearances).toEqual([]);
    expect(backup.limitations.join(" ")).not.toContain("Recovered 1");
  });

  it("binds goalie historical normalization versions and rejects conflicting or stripped lineage", async () => {
    const rows: Record<string, any[]> = {
      goaliesGameStats: [{ playerId: 77, gameId: 30, saveShotsAgainst: "20/22", goalsAgainst: 2, toi: "30:30",
        games: { id: 30, date: "2026-09-27", seasonId: 20262027, type: 2 } }],
      nhl_api_game_roster_spots: [{ game_id: 30, player_id: 77, team_id: 4, season_id: 20262027,
        game_date: "2026-09-27", source_play_by_play_hash: "a".repeat(64), parser_version: 1 }],
      nhl_api_game_normalization_status: [{ game_id: 30, season_id: 20262027, game_date: "2026-09-27",
        status: "complete", normalization_version: 3, normalization_fingerprint: "b".repeat(64),
        source_fingerprint: "c".repeat(64), parser_fingerprint: "d".repeat(64), parser_version: 1, strength_version: 1,
        materializer_version: "normalization-v1", pbp_raw_payload_id: 4001, pbp_raw_snapshot_version: 1,
        pbp_raw_payload_hash: "a".repeat(64), shift_raw_payload_id: 4002, shift_raw_snapshot_version: 1,
        shift_raw_payload_hash: "e".repeat(64), roster_fingerprint: "f".repeat(64), event_fingerprint: "1".repeat(64),
        shift_fingerprint: "2".repeat(64), expected_roster_rows: 4, observed_roster_rows: 4,
        expected_event_rows: 100, observed_event_rows: 100, expected_shift_rows: 200, observed_shift_rows: 200,
        completed_at: "2026-09-27T10:00:00Z", updated_at: "2026-09-27T10:01:00Z" }],
    };
    const args = { db: goalieCaptureDb(rows) as never, seasonId: 20262027,
      players: [{ playerId: 7, nhlPlayerId: 77, teamId: 1, rosterRevision: "r" }],
      now: () => new Date("2026-09-28T12:00:00Z") };
    const capture = await captureCurrentGoalieBaselineInputs(args);
    expect(capture.players[0].historicalSources?.games[0].normalization).toMatchObject({ normalization_version: 3 });
    expect(capture.players[0].appearances[0].toiMinutes).toBe(30.5);
    await expect(persistCapturedGoalieBaselineInputs({ db: {} as never, seasonId: 20262027, capture }))
      .resolves.toMatchObject({ dryRun: true });
    const forged = structuredClone(capture), player = forged.players[0];
    delete player.historicalSources;
    const { sourceWatermark: _old, ...identity } = player;
    player.sourceWatermark = playerForecastSourcePayloadHash({ basis: forged.basis, capturedAt: forged.capturedAt, ...identity });
    await expect(persistCapturedGoalieBaselineInputs({ db: {} as never, seasonId: 20262027, capture: forged }))
      .rejects.toThrow(/historical source receipt/);
    rows.nhl_api_game_roster_spots[0].parser_version = 2;
    await expect(captureCurrentGoalieBaselineInputs(args)).rejects.toThrow(/conflicts with its complete normalization/);
  });

  it("rejects conflicting goalie historical scope before a roster map can hide it", async () => {
    const rows: Record<string, any[]> = {
      goaliesGameStats: [{ playerId: 77, gameId: 30, saveShotsAgainst: "20/22", goalsAgainst: 2, toi: "30:30",
        games: { id: 30, date: "2026-09-27", seasonId: 20262027, type: 2 } }],
      nhl_api_game_roster_spots: [5, 4].map(team_id => ({ game_id: 30, player_id: 77, team_id,
        season_id: 20262027, game_date: "2026-09-27" })),
    };
    const calls: Array<{ table: string; method: string; args: unknown[] }> = [];
    await expect(captureCurrentGoalieBaselineInputs({ db: goalieCaptureDb(rows, calls) as never, seasonId: 20262027,
      players: [{ playerId: 7, nhlPlayerId: 77, teamId: 1, rosterRevision: "r" }],
      now: () => new Date("2026-09-28T12:00:00Z") })).rejects.toThrow(/baseline historical/i);
    expect(calls.some(call => call.table === "nhl_api_game_payloads_raw")).toBe(false);
  });

  it("rejects a duplicated NHL request identity for goalies without database access", async () => {
    await expect(captureCurrentGoalieBaselineInputs({ db: {} as never, seasonId: 20262027,
      players: [7, 8].map(playerId => ({ playerId, nhlPlayerId: 77, teamId: 1, rosterRevision: "r" })) }))
      .rejects.toThrow(/explicit canonical goalies/);
    const capture = await captureCurrentGoalieBaselineInputs({ db: goalieCaptureDb({}) as never, seasonId: 20262027,
      players: [{ playerId: 7, nhlPlayerId: 77, teamId: 1, rosterRevision: "r" }] });
    const duplicate = { ...structuredClone(capture.players[0]), playerId: 8 };
    const { sourceWatermark: _old, ...identity } = duplicate;
    duplicate.sourceWatermark = playerForecastSourcePayloadHash({ basis: capture.basis,
      capturedAt: capture.capturedAt, ...identity });
    capture.players.push(duplicate);
    await expect(persistCapturedGoalieBaselineInputs({ db: {} as never, seasonId: 20262027, capture }))
      .rejects.toThrow(/Invalid current goalie capture receipt/);
  });
});

function goalieFixture(rates: ContributionSource[], original: GameForecast): PlanningSnapshot {
  return { id: "goalie", context: { provider: "manual", seasonId: 20262027,
    leagueId: "l", teamId: "t", startDate: "2026-10-03", endDate: "2026-10-03",
    timeZone: "UTC", asOf: "2026-09-29T00:00:00Z" },
  players: [{ id: "7", nhlId: 77, nhlTeamId: 1, rosterRevision: "roster-a", name: "Goalie",
    teamAbbreviation: "MIN", eligiblePositions: ["G"], playerClass: "goalie",
    availability: "unknown", ownership: null, canDrop: null, holdValue: null, reserveEligibility: [] }],
  games: [{ id: "30", date: "2026-10-03", startsAt: "2026-10-03T23:00:00Z",
    scheduleRevision: "schedule-a", teamAbbreviation: "MIN", opponent: "TOR", home: true,
    status: "scheduled" }], forecasts: [original], baselineSources: rates, roster: [],
  rules: {} as PlanningSnapshot["rules"], lockedAssignments: [], realized: {}, opponent: null, evidence: {} };
}

describe("goalie planning use", () => {
  const source: ContributionSource = { kind: "baseline", sourceId: "goalie-rate", policyVersion: "g-v1",
    released: true, allowedUses: { assignment: true, totals: true, comparison: true, conditionalTieBreak: true },
    playerId: 7, nhlPlayerId: 77, seasonId: 20262027, teamId: 1,
    targetKey: "WINS_GOALIE", unit: "count", basis: "per_start", mean: 0.5,
    participationIntegrated: false, cutoffAt: "2026-09-28T00:00:00Z",
    issuedAt: "2026-09-28T12:00:00Z", expiresAt: "2026-10-04T00:00:00Z",
    sourceWatermark: "w", scheduleRevision: "schedule-a", rosterRevision: "roster-a" };
  const original: GameForecast = { playerId: "7", gameId: "30", stats: {}, sourceKind: "detailed", sourceWatermark: "captured-reads",
    issuedContext: { version: "forge-issued-context-v1", playerId: "7", gameId: "30", nhlPlayerId: 77,
      seasonId: 20262027, teamId: 1, scheduledAt: "2026-10-03T23:00:00Z", scheduleRevision: "schedule-a",
      rosterRevision: "roster-a", observedAt: "2026-09-28T12:00:00Z", scheduleSourceUpdatedAt: null,
      scheduleFetchedAt: "2026-09-28T12:00:00Z", identityUpdatedAt: null,
      membershipCreatedAt: ["2026-09-01T00:00:00Z"] },
    conditioning: "unconditional", startProbability: 0.6, confirmedStart: false,
    allowedUses: { assignment: true, totals: true, comparison: true, conditionalTieBreak: true },
    revisionId: "starter-mixture", issuedAt: "2026-09-28T13:00:00Z",
    cutoffAt: "2026-09-28T12:00:00Z", expiresAt: "2026-10-04T00:00:00Z",
    modelVersion: "starter-v1", limitations: [] };
  it("uses start probability for per-start rates without confirming a start", () => {
    const forecast = resolvePlanningContributions(goalieFixture([source], original)).forecasts[0];
    expect(forecast.stats.WINS_GOALIE).toBeCloseTo(0.3);
    expect(forecast.startProbability).toBe(0.6);
    expect(forecast.confirmedStart).toBe(false);
  });
  it("does not multiply per-appearance rates by start probability", () => {
    const appearance = { ...source, targetKey: "SAVES_GOALIE", basis: "per_appearance" as const, mean: 25 };
    const forecast = resolvePlanningContributions(goalieFixture([appearance], original)).forecasts[0];
    expect(forecast.stats.SAVES_GOALIE).toBeNull();
    expect(forecast.contributions?.SAVES_GOALIE.allowedUses.totals).toBe(false);
  });
  it("uses appearance probability for native win means and never substitutes pStart", () => {
    const wins = { ...source, policyVersion: NATIVE_GOALIE_WIN_POLICY_VERSION, basis: "per_appearance" as const };
    const known = resolvePlanningContributions(goalieFixture([wins], { ...original, appearanceProbability: 0.8 })).forecasts[0];
    expect(known.stats.WINS_GOALIE).toBeCloseTo(0.4);
    const unknown = resolvePlanningContributions(goalieFixture([wins], original)).forecasts[0];
    expect(unknown.stats.WINS_GOALIE).toBeNull();
  });
  it("preserves coherent volume means through appearance conditioning without inferring missing participation", () => {
    const volumes: ContributionSource[] = Object.entries({ SAVES_GOALIE: 18, GOALS_AGAINST_GOALIE: 1,
      SHOTS_AGAINST_GOALIE: 19, GOALIE_MINUTES: 45 }).map(([targetKey, mean]) => ({ ...source,
      sourceId: `volume-${targetKey}`, policyVersion: NATIVE_GOALIE_VOLUME_POLICY_VERSION, targetKey, mean,
      unit: targetKey === "GOALIE_MINUTES" ? "minutes" : "count", basis: "per_appearance" }));
    const known = resolvePlanningContributions(goalieFixture(volumes, { ...original, startProbability: 0.3, appearanceProbability: 0.5 })).forecasts[0];
    expect(known.stats).toMatchObject({ SAVES_GOALIE: 9, GOALS_AGAINST_GOALIE: 0.5,
      SHOTS_AGAINST_GOALIE: 9.5, GOALIE_MINUTES: 22.5 });
    expect(known.startProbability).toBeNull();
    const unknown = resolvePlanningContributions(goalieFixture(volumes, original)).forecasts[0];
    expect(volumes.every(volume => unknown.stats[volume.targetKey] === null)).toBe(true);
  });
  it("rejects overfull competing starter mass, including an unconditional original", () => {
    const snapshot = goalieFixture([source], { ...original, stats: { WINS_GOALIE: 0.3 } });
    snapshot.players.push({ ...snapshot.players[0], id: "8", nhlId: 88, name: "Other goalie" });
    snapshot.forecasts.push({ ...original, playerId: "8", revisionId: "other-starter",
      issuedContext: { ...original.issuedContext!, playerId: "8", nhlPlayerId: 88 } });
    const forecast = resolvePlanningContributions(snapshot).forecasts.find((row) => row.playerId === "7")!;
    expect(forecast.stats.WINS_GOALIE).toBeNull();
    expect(forecast.confirmedStart).toBe(false);
  });
  it("keeps overfull retained starter competition unavailable on repeated resolution", () => {
    const retained = resolvePlanningContributions(goalieFixture([source], original));
    retained.players.push({ ...retained.players[0], id: "8", nhlId: 88, name: "Other goalie" });
    retained.forecasts.push({ ...original, playerId: "8", revisionId: "other-starter",
      issuedContext: { ...original.issuedContext!, playerId: "8", nhlPlayerId: 88 } });
    const rejected = resolvePlanningContributions(retained);
    const replayed = resolvePlanningContributions(JSON.parse(JSON.stringify(rejected)));
    for (const result of [rejected, replayed]) {
      const forecast = result.forecasts.find(row => row.playerId === "7")!;
      expect(forecast.stats.WINS_GOALIE).toBeNull();
      expect(forecast.contributions?.WINS_GOALIE.allowedUses.comparison).toBe(false);
      expect(forecast.confirmedStart).toBe(false);
    }
  });
  it("withholds appearance-basis ratio supplements beside a detailed start branch", () => {
    const shots: ContributionSource = { ...source, sourceId: "shots-rate",
      targetKey: "SHOTS_AGAINST_GOALIE", basis: "per_appearance", mean: 30 };
    const minutes: ContributionSource = { ...source, sourceId: "minutes-rate",
      targetKey: "GOALIE_MINUTES", unit: "minutes", basis: "per_appearance", mean: 55 };
    const detailedStart: GameForecast = { ...original,
      stats: { SAVES_GOALIE: 12, GOALS_AGAINST_GOALIE: 1.2 },
      conditionalStats: { SAVES_GOALIE: 20, GOALS_AGAINST_GOALIE: 2 },
      appearanceProbability: 0.8 };
    const resolved = resolvePlanningContributions(goalieFixture([shots, minutes, source], detailedStart));
    const forecast = resolved.forecasts[0];
    expect(forecast.stats.SAVES_GOALIE).toBe(12);
    expect(forecast.stats.GOALS_AGAINST_GOALIE).toBe(1.2);
    expect(forecast.stats.WINS_GOALIE).toBeCloseTo(0.3);
    expect(forecast.stats.SHOTS_AGAINST_GOALIE).toBeNull();
    expect(forecast.stats.GOALIE_MINUTES).toBeNull();
    expect(forecast.contributions?.SHOTS_AGAINST_GOALIE.exclusionReasons)
      .toContain("incompatible_component_basis");
    expect(forecast.contributions?.SHOTS_AGAINST_GOALIE.allowedUses.comparison).toBe(false);
    expect(resolvePlanningContributions(JSON.parse(JSON.stringify(resolved))).forecasts).toEqual(resolved.forecasts);
  });
});
