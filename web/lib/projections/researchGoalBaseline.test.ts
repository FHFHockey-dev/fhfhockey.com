// @vitest-environment node
import { createHash } from "node:crypto";
import { mkdtempSync, readFileSync, rmSync, writeFileSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { describe, expect, it, vi } from "vitest";
import { goalHistoryFromOfficialFinal } from "../forecast-diagnostics/pairedInputs";
import { auditNativeGoalLedger } from "./nativeGoalLedgerAudit";
import { projectionInputHash } from "./inputCapture";
import { RESEARCH_GOAL_CELLS, estimateResearchPlayerGoals, evaluateRetainedResearchGoals, type ResearchGoalAppearance } from "./researchGoalBaseline";
import { runResearchGoalBaseline } from "../../scripts/evaluate-research-goal-baseline";
import { reconcileResearchGoalAppearanceManifest } from "./researchGoalAppearanceManifest";

const cutoff = "2026-10-08T22:00:00Z";
const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value));
const digest = (value: string) => createHash("sha256").update(value).digest("hex");
const parserSourceHash = digest(readFileSync(resolve(__dirname, "../supabase/Upserts/nhlStrengthState.ts"), "utf8"));
const fixtureTeamAbbrevs: Record<number, string> = { 10: "BOS", 11: "UTA", 20: "NJD", 21: "CHI" };
function appearance(overrides: Partial<ResearchGoalAppearance> = {}): ResearchGoalAppearance {
  return { gameId: 2026020001, teamId: 10, seasonId: 20262027, phase: 2, startedAt: "2026-10-01T23:00:00Z",
    availableAt: "2026-10-07T19:00:00Z", toiSeconds: 600, officialGoals: 1,
    goalsByCell: { "REG:both_present:fewer_skaters": 1 }, gaps: [], ...overrides };
}
const estimate = (rows: ResearchGoalAppearance[], manifest: number[] | null = rows.filter(row => row.toiSeconds! > 0).map(row => row.gameId)) =>
  estimateResearchPlayerGoals({ playerId: 1001, seasonId: 20262027, featureCutoffAt: cutoff, appearances: rows, provedSeasonAppearanceGameIds: manifest });

describe("GOALS-only research G/n mechanics", () => {
  it("counts every positive-TOI appearance, including measured zero-goal games, without exposure or priors", () => {
    const result = estimate([appearance(), appearance({ gameId: 2026020002, teamId: 11, officialGoals: 0, goalsByCell: {} }),
      appearance({ gameId: 2026020003, toiSeconds: 0, officialGoals: 0, goalsByCell: {} })]);
    expect(result).toMatchObject({ category: "GOALS", historyStatus: "complete", conditionalGoalsPerPlayingAppearance: 0.5,
      observedCohort: { positiveToiAppearanceCount: 2, officialGoals: 1, zeroToiGameIds: [2026020003] },
      participationProbabilityGivenGamePlayed: null, statisticalCreditProbabilityGivenGamePlayed: null,
      gameOccurrenceProbability: null, expectedGoalsGivenGamePlayed: null, unconditionalGoalsMean: null, fullGameEligible: false });
    expect(result.cellMeans["REG:both_present:fewer_skaters"]).toBe(0.5);
    expect(result.cellMeans["OT:defending_absent:equal_skaters"]).toBe(0);
    expect(Object.keys(result.cellMeans)).toHaveLength(24);
  });
  it("keeps unknown or incomplete season history separate from known cohort counts", () => {
    const unproved = estimate([appearance()], null), incomplete = estimate([appearance()], [2026020001, 2026020002]);
    expect(unproved).toMatchObject({ historyStatus: "unproved", conditionalGoalsPerPlayingAppearance: null,
      observedCohort: { officialGoals: 1, goalsPerObservedAppearance: 1, isCompletePlayerSeasonEstimate: false } });
    expect(incomplete.historyReasons).toContain("incomplete_player_season_appearance_history");
    expect(Object.values(unproved.cellMeans).every(value => value === null)).toBe(true);
  });
  it("supports a complete observed zero only with positive appearance support", () => {
    expect(estimate([appearance({ officialGoals: 0, goalsByCell: {} })]).conditionalGoalsPerPlayingAppearance).toBe(0);
    const noAppearance = estimate([appearance({ toiSeconds: 0, officialGoals: 0, goalsByCell: {} })], []);
    expect(noAppearance.conditionalGoalsPerPlayingAppearance).toBeNull();
    expect(noAppearance.historyReasons).toContain("no_positive_toi_appearances");
  });
  it.each([{ seasonId: 20252026 }, { phase: 1 }, { availableAt: cutoff }, { startedAt: cutoff }, { toiSeconds: null },
    { officialGoals: null }, { goalsByCell: null }, { officialGoals: 2 }, { toiSeconds: 0 }])("keeps unsupported histories null: %j", overrides => {
    expect(estimate([appearance(overrides)]).conditionalGoalsPerPlayingAppearance).toBeNull();
  });
  it("preserves disjoint OT/empty-net intersections without adding overlapping views", () => {
    const rows = [appearance({ officialGoals: 3, goalsByCell: { "OT:defending_absent:equal_skaters": 1,
      "REG:attacking_absent:more_skaters": 1, "REG:both_present:equal_skaters": 1 } })];
    const result = estimate(rows);
    expect(result.conditionalGoalsPerPlayingAppearance).toBe(3);
    expect(Object.values(result.cellMeans).reduce<number>((total, value) => total + value!, 0)).toBe(3);
    expect(result.cellMeans["OT:defending_absent:equal_skaters"]).toBe(1);
    expect(RESEARCH_GOAL_CELLS.some(cell => cell.startsWith("SO:"))).toBe(false);
  });
  it("rejects duplicate identities, invented cells and invalid counts rather than zero-filling", () => {
    expect(() => estimate([appearance(), appearance()])).toThrow("duplicate appearance");
    expect(() => estimate([appearance()], [2026020001, 2026020001])).toThrow("manifest");
    expect(() => estimate([appearance({ goalsByCell: { "SO:both_present:equal_skaters": 1 } })])).toThrow("cell count");
    expect(() => estimate([appearance({ officialGoals: -1 })])).toThrow("units");
    expect(() => estimate([appearance({ officialGoals: Number.MAX_SAFE_INTEGER,
      goalsByCell: { "REG:both_present:fewer_skaters": Number.MAX_SAFE_INTEGER } }),
      appearance({ gameId: 2026020002, officialGoals: Number.MAX_SAFE_INTEGER,
        goalsByCell: { "REG:both_present:fewer_skaters": Number.MAX_SAFE_INTEGER } })])).toThrow("overflow");
  });
});

function fixture(shootout = false, awarded = false) {
  const scope = { gameId: 2026020099, seasonId: 20262027, phase: 2, homeTeamId: 10, awayTeamId: 11,
    startAt: "2026-10-08T23:00:00Z", cutoffAt: cutoff, horizonGames: 1 };
  const makeRevision = (revisionId: string, payload: any, url: string, extra: { kind?: string; gameId?: number } = {}) => {
    const bodyUtf8 = JSON.stringify(payload);
    return { revisionId, payload: clone(payload), bodyUtf8, rawBytesHash: digest(bodyUtf8), url, ...extra,
      provenance: { revisionId, payloadHash: projectionInputHash(payload), source: url, firstReceivedAt: "2026-10-07T19:00:00Z",
        verifiedAt: "2026-10-07T19:00:00.010Z", publishedAt: null, availabilityBasis: "retained_capture", correctionOf: null } };
  };
  const makeGame = (gameId: number, homeId: number, awayId: number, second: boolean) => {
    const goal = (eventId: number, teamId: number, situationCode: string, periodType = "REG") => ({ eventId,
      typeDescKey: "goal", periodDescriptor: { number: periodType === "REG" ? 1 : periodType === "OT" ? 4 : 5, periodType }, timeInPeriod: "03:21", situationCode,
      details: { eventOwnerTeamId: teamId, scoringPlayerId: teamId * 100 + 1, shotType: awarded && eventId === 1 ? undefined : "wrist",
        goalieInNetId: situationCode[teamId === homeId ? 0 : 3] === "0" ? undefined : (teamId === homeId ? awayId : homeId) * 100 + 99 } });
    const plays = second ? shootout ? [goal(1, homeId, "1551"), goal(2, awayId, "1551"), goal(3, homeId, "1551", "SO")]
      : [goal(1, homeId, "1331", "OT")] : [goal(1, homeId, "1541"), goal(2, homeId, "0651"), goal(3, homeId, "1560")];
    const periodDescriptor = { number: second ? shootout ? 5 : 4 : 3, periodType: second ? shootout ? "SO" : "OT" : "REG" };
    plays.push({ eventId: 99, typeDescKey: "game-end", periodDescriptor, timeInPeriod: "03:21" } as any);
    const credited = (teamId: number) => plays.filter(play => play.typeDescKey === "goal" && play.details.eventOwnerTeamId === teamId && play.periodDescriptor.periodType !== "SO").length;
    return { id: gameId, season: scope.seasonId, gameType: 2, gameState: "OFF", startTimeUTC: "2026-10-01T23:00:00Z",
      homeTeam: { id: homeId, score: credited(homeId) + (second && shootout ? 1 : 0), sog: credited(homeId) - (awarded ? 1 : 0) },
      awayTeam: { id: awayId, score: credited(awayId), sog: credited(awayId) }, periodDescriptor, plays,
      rosterSpots: [homeId, awayId].flatMap(teamId => [{ teamId, playerId: teamId * 100 + 1, positionCode: "C" },
        { teamId, playerId: teamId * 100 + 2, positionCode: "D" }, { teamId, playerId: teamId * 100 + 99, positionCode: "G" },
        { teamId, playerId: teamId * 100 + 98, positionCode: "G" }]) };
  };
  const games = [makeGame(2026020001, 10, 20, false), makeGame(2026020002, 11, 21, true)];
  const pbps = games.map(game => makeRevision(`pbp-${game.id}`, game, `https://api-web.nhle.com/v1/gamecenter/${game.id}/play-by-play`));
  const target = { id: scope.gameId, season: scope.seasonId, gameType: 2, gameState: "FUT", startTimeUTC: scope.startAt, homeTeam: { id: 10 }, awayTeam: { id: 11 } };
  const schedules = games.map((game, index) => makeRevision(`schedule-${index}`, { currentSeason: scope.seasonId, games: [game, target] }, `https://example.test/season/${index}`));
  const boxes = games.map(game => {
    const side = (teamId: number) => ({ forwards: [{ playerId: teamId * 100 + 1, position: "C", toi: "10:00",
      goals: game.plays.filter(play => play.typeDescKey === "goal" && play.details.eventOwnerTeamId === teamId && play.periodDescriptor.periodType !== "SO").length }],
      defense: [{ playerId: teamId * 100 + 2, position: "D", toi: "10:00", goals: 0 }],
      goalies: [{ playerId: teamId * 100 + 99, position: "G", toi: "60:00" }, { playerId: teamId * 100 + 98, position: "G", toi: "00:00" }] });
    return makeRevision(`box-${game.id}`, { id: game.id, season: game.season, gameType: 2, gameState: "OFF", startTimeUTC: game.startTimeUTC,
      gameDate: "2026-10-01", homeTeam: { ...game.homeTeam, abbrev: fixtureTeamAbbrevs[game.homeTeam.id] },
      awayTeam: { ...game.awayTeam, abbrev: fixtureTeamAbbrevs[game.awayTeam.id] }, playerByGameStats: { homeTeam: side(game.homeTeam.id), awayTeam: side(game.awayTeam.id) } },
      `https://api-web.nhle.com/v1/gamecenter/${game.id}/boxscore`, { kind: "official_boxscore", gameId: game.id });
  });
  const historyBundle = { scope, retainedHistorySources: pbps, scheduleSources: schedules, capturedAt: "2026-10-07T19:01:00Z", acceptanceEligible: false,
    population: [10, 11].map((teamId, index) => ({ teamId, selectedGameIds: [games[index].id], incompleteGameIds: [] })),
    history: pbps.map((source, index) => goalHistoryFromOfficialFinal(source.payload, source.provenance as any).find(row => row.teamId === index + 10)) };
  const counts = (keys: string[]) => Object.fromEntries([...new Set(keys)].sort().map(key => [key, keys.filter(value => value === key).length]));
  const priorGames = pbps.map(source => {
    const events = source.payload.plays.filter((play: any) => play.typeDescKey === "goal" && play.periodDescriptor.periodType !== "SO").map((play: any) => {
      const home = play.details.eventOwnerTeamId === source.payload.homeTeam.id, digits = [...play.situationCode].map(Number);
      const attackingGoalie = digits[home ? 3 : 0], defendingGoalie = digits[home ? 0 : 3];
      const attackingSkaters = digits[home ? 2 : 1], defendingSkaters = digits[home ? 1 : 2];
      const net = attackingGoalie ? defendingGoalie ? "both_present" : "defending_absent" : defendingGoalie ? "attacking_absent" : "both_absent";
      const relation = attackingSkaters === defendingSkaters ? "equal_skaters" : attackingSkaters > defendingSkaters ? "more_skaters" : "fewer_skaters";
      return { eventId: play.eventId, teamId: play.details.eventOwnerTeamId, scoringPlayerId: play.details.scoringPlayerId,
        period: play.periodDescriptor.periodType, rawSituationCode: play.situationCode, goalieInNetId: play.details.goalieInNetId ?? null,
        attackingGoalie, defendingGoalie, attackingSkaters, defendingSkaters,
        ledgerCell: `${play.periodDescriptor.periodType}:${net}:${net === "both_present" ? relation : "not_partitioned"}` };
    });
    return { gameId: source.payload.id, revisionId: source.revisionId, rawBytesHash: source.rawBytesHash,
      firstReceivedAt: source.provenance.firstReceivedAt, originalVerifiedAt: source.provenance.verifiedAt,
      officialPlayGoalCount: events.length, events, ledgerCounts: counts(events.map((row: any) => row.ledgerCell)),
      excludedGoals: source.payload.plays.filter((play: any) => play.typeDescKey === "goal" && play.periodDescriptor.periodType === "SO").map((play: any) => ({ eventId: play.eventId })) };
  });
  const attributeAudit = { version: "retained-goal-attribute-audit-v1", codeCommit: "a".repeat(40), parserHash: parserSourceHash,
    prospectiveScope: scope, acceptanceEligible: false, games: priorGames, goalCount: priorGames.reduce((n, game) => n + game.officialPlayGoalCount, 0) };
  return { historyBundle, revisions: [...pbps, ...schedules], attributeAudit, parserSourceHash, boxes };
}
function evaluate(input = fixture()) {
  return evaluateRetainedResearchGoals({ ledger: auditNativeGoalLedger(input), historyBundle: input.historyBundle, boxscoreRevisions: input.boxes });
}
function rewriteBox(box: any, mutate: (payload: any) => void) {
  mutate(box.payload); box.bodyUtf8 = JSON.stringify(box.payload); box.rawBytesHash = digest(box.bodyUtf8); box.provenance.payloadHash = projectionInputHash(box.payload);
}

function appearanceFixture(input = fixture()) {
  const base = evaluate(input), revisions: any[] = [];
  const observations = base.teams.flatMap(team => team.games.flatMap(game => {
    const payload = input.boxes.find(box => box.gameId === game.gameId)!.payload;
    const side = payload.homeTeam.id === team.teamId ? payload.homeTeam : payload.awayTeam;
    const opponent = payload.homeTeam.id === team.teamId ? payload.awayTeam : payload.homeTeam;
    return game.players.map(player => ({ ...player, gameDate: payload.gameDate, teamAbbrev: side.abbrev, opponentAbbrev: opponent.abbrev }));
  }));
  const players = base.teams.flatMap(team => team.players).map(player => {
    const rows = observations.filter(row => row.playerId === player.playerId && row.appearance.toiSeconds! > 0);
    const playerRole = observations.find(row => row.playerId === player.playerId)!.position === "G" ? "goalie" : "skater";
    const url = new URL(`https://api.nhle.com/stats/rest/en/${playerRole}/summary`);
    Object.entries({ isAggregate: "false", isGame: "true", start: "0", limit: "100",
      cayenneExp: `seasonId=20262027 and gameTypeId=2 and playerId=${player.playerId}`,
      sort: JSON.stringify([{ property: "gameId", direction: "ASC" }]) }).forEach(([key, value]) => url.searchParams.set(key, value));
    const source = (kind: string, payload: unknown, sourceUrl: string) => {
      const revisionId = `${kind.replaceAll("_", "-")}-${player.playerId}`, bodyUtf8 = JSON.stringify(payload);
      revisions.push({ kind, nhlPlayerId: player.playerId, role: playerRole, seasonId: 20262027, gameTypeId: 2,
        pageStart: 0, pageLimit: kind === "official_player_game_index" ? 100 : null, url: sourceUrl,
        requestedAt: "2026-10-07T20:00:00Z", httpStatus: 200, revisionId, bodyUtf8, rawBytesHash: digest(bodyUtf8), payload, failure: null,
        provenance: { revisionId, payloadHash: projectionInputHash(payload), source: sourceUrl, firstReceivedAt: "2026-10-07T20:00:01Z",
          verifiedAt: "2026-10-07T20:00:01Z", publishedAt: null, availabilityBasis: "retained_capture", correctionOf: null } });
      return revisionId;
    };
    const gameLog = rows.map(row => ({ gameId: row.appearance.gameId, gameDate: row.gameDate, teamAbbrev: row.teamAbbrev,
      opponentAbbrev: row.opponentAbbrev, goals: row.appearance.officialGoals,
      toi: `${Math.floor(row.appearance.toiSeconds! / 60)}:${String(row.appearance.toiSeconds! % 60).padStart(2, "0")}` }));
    const data = rows.map(row => ({ gameId: row.appearance.gameId, gameDate: row.gameDate, playerId: player.playerId,
      gamesPlayed: 1, teamAbbrev: row.teamAbbrev, opponentTeamAbbrev: row.opponentAbbrev, goals: row.appearance.officialGoals,
      [playerRole === "goalie" ? "timeOnIce" : "timeOnIcePerGame"]: row.appearance.toiSeconds }));
    return { playerId: player.playerId, role: playerRole,
      gameLogRevisionId: source("official_player_game_log", { seasonId: 20262027, gameTypeId: 2, gameLog },
        `https://api-web.nhle.com/v1/player/${player.playerId}/game-log/20262027/2`),
      indexRevisionIds: [source("official_player_game_index", { data, total: data.length }, url.href)] };
  });
  const manifest = { version: "research-player-season-appearance-manifest-v1", researchCodeCommit: "a".repeat(40),
    cohortResultHash: projectionInputHash(base), seasonId: 20262027, phase: 2, featureCutoffAt: cutoff,
    historyTargetAt: "2026-10-07T19:59:59Z",
    collectedAt: "2026-10-07T20:01:00Z", sourceBasis: "official_nhl_all_club_player_season_game_log_and_per_game_index",
    cohortPlayerIds: players.map(player => player.playerId), players,
    acquisitionScope: { concurrency: 2, pageLimit: 100, maximumIndexPagesPerPlayer: 2, boxscoreRequests: 0,
      pbpRequests: 0, credentialsSent: false, hostedWrites: false } };
  return { input, base, observations, manifest, revisions };
}
function evaluateManifest(evidence = appearanceFixture()) {
  return evaluateRetainedResearchGoals({ ledger: auditNativeGoalLedger(evidence.input), historyBundle: evidence.input.historyBundle,
    boxscoreRevisions: evidence.input.boxes, appearanceEvidence: { manifest: evidence.manifest, revisions: evidence.revisions } });
}

describe("verified all-club player-season appearance adapter", () => {
  it("joins actual source rows, counts observed zeros, and preserves the separate club-window accounting", () => {
    const evidence = appearanceFixture(), result = evaluateManifest(evidence), season = result.playerSeasonResearch!;
    expect(result.teams).toEqual(evidence.base.teams);
    expect(season).toMatchObject({ supportedPlayerCount: 0, retainedProviderCohortObservationCount: 6, additionalGameIds: [], fullGameEligible: false, historicalForecastBacktestEligible: false,
      historyTargetAt: "2026-10-07T19:59:59Z", completePlayerSeasonAtFeatureCutoff: false });
    expect(season.players.find(player => player.playerId === 1001)).toMatchObject({ conditionalGoalsPerPlayingAppearance: null, historyStatus: "unproved",
      providerCohortObservation: { goalsPerPlayingAppearance: 3, isCompletePlayerSeasonEstimate: false },
      observedCohort: { positiveToiAppearanceCount: 1 }, appearanceEvidence: { status: "cohort_reconciled", reasons: [], historyCoverageThroughAt: null } });
    expect(season.players.find(player => player.playerId === 1002)?.providerCohortObservation.goalsPerPlayingAppearance).toBe(0);
    expect(season.players.find(player => player.playerId === 1098)?.conditionalGoalsPerPlayingAppearance).toBeNull();
    expect(season.players.every(player => player.unconditionalGoalsMean === null && !player.fullGameEligible)).toBe(true);
  });
  it.each(["missing_log", "wrong_season", "pagination", "goals", "toi", "games_played", "historical_team", "http_failure", "population_disagreement"])("keeps invalid evidence unknown: %s", issue => {
    const evidence = appearanceFixture(), log = evidence.revisions[0], index = evidence.revisions[1];
    if (issue === "missing_log") rewriteBox(log, payload => { delete payload.gameLog; });
    if (issue === "wrong_season") rewriteBox(log, payload => { payload.seasonId = 20252026; });
    if (issue === "pagination") rewriteBox(index, payload => { payload.total++; });
    if (issue === "goals") rewriteBox(index, payload => { payload.data[0].goals++; });
    if (issue === "toi") rewriteBox(log, payload => { payload.gameLog[0].toi = "09:00"; });
    if (issue === "games_played") rewriteBox(index, payload => { payload.data[0].gamesPlayed = 0; });
    if (issue === "historical_team") rewriteBox(log, payload => { payload.gameLog[0].teamAbbrev = "OTHER"; });
    if (issue === "http_failure") { log.httpStatus = 503; log.failure = "http_503"; }
    if (issue === "population_disagreement") rewriteBox(index, payload => { payload.data[0].gameId = 2026020003; });
    const player = evaluateManifest(evidence).playerSeasonResearch!.players.find(row => row.playerId === 1001)!;
    expect(player.conditionalGoalsPerPlayingAppearance).toBeNull();
    expect(player.providerCohortObservation.goalsPerPlayingAppearance).toBeNull();
    expect(player.appearanceEvidence.status).toBe("unproved");
    expect(player.appearanceEvidence.reasons.length).toBeGreaterThan(0);
  });
  it("detects omitted known appearances even when both sources claim an empty season", () => {
    const evidence = appearanceFixture();
    rewriteBox(evidence.revisions[0], payload => { payload.gameLog = []; });
    rewriteBox(evidence.revisions[1], payload => { payload.data = []; payload.total = 0; });
    const player = evaluateManifest(evidence).playerSeasonResearch!.players.find(row => row.playerId === 1001)!;
    expect(player.conditionalGoalsPerPlayingAppearance).toBeNull();
    expect(player.appearanceEvidence.reasons).toContain("known_positive_appearance_missing_from_provider_history");
  });
  it("reports exact extra game IDs and retains their unsupported estimates without collecting games", () => {
    const evidence = appearanceFixture(), extraId = 2026020003;
    rewriteBox(evidence.revisions[0], payload => { payload.gameLog.push({ ...payload.gameLog[0], gameId: extraId }); });
    rewriteBox(evidence.revisions[1], payload => { payload.data.push({ ...payload.data[0], gameId: extraId }); payload.total++; });
    const season = evaluateManifest(evidence).playerSeasonResearch!;
    expect(season.additionalGameIds).toEqual([extraId]);
    expect(season.players.find(row => row.playerId === 1001)?.conditionalGoalsPerPlayingAppearance).toBeNull();
  });
  it("requires new receipts strictly before the research cutoff and does not alter club-window observations", () => {
    const evidence = appearanceFixture(); evidence.manifest.collectedAt = "2026-10-08T22:00:01Z";
    evidence.revisions[0].provenance.firstReceivedAt = cutoff; evidence.revisions[0].provenance.verifiedAt = cutoff;
    const result = evaluateManifest(evidence);
    expect(result.teams).toEqual(evidence.base.teams);
    expect(result.playerSeasonResearch!.supportedPlayerCount).toBe(0);
    expect(result.playerSeasonResearch!.players[0].appearanceEvidence.reasons).toContain("appearance_evidence_unavailable_at_feature_cutoff");
  });
  it("does not extend source coverage when only the feature cutoff advances", () => {
    const evidence = appearanceFixture(); delete (evidence.manifest as any).historyTargetAt;
    evidence.manifest.featureCutoffAt = "2026-10-20T00:12:00Z";
    const result = evaluateManifest(evidence), season = result.playerSeasonResearch!;
    expect(result.teams).toEqual(evidence.base.teams);
    expect(season).toMatchObject({ supportedPlayerCount: 0, retainedProviderCohortObservationCount: 0, historyTargetBasis: "feature_cutoff",
      requestTimeCapAt: "2026-10-07T20:00:00.000Z", historyCoverageThroughAt: null, completePlayerSeasonAtFeatureCutoff: false });
    expect(season.players[0].appearanceEvidence.reasons).toContain("history_target_exceeds_retained_request_cap");
    expect(season.players[0].observedCohort.goalsPerObservedAppearance).not.toBeNull();
  });
  it("keeps an explicit snapshot target separate from later evidence availability and rejects an advanced history target", () => {
    const evidence = appearanceFixture(); evidence.manifest.featureCutoffAt = "2026-10-20T00:12:00Z";
    const snapshot = evaluateManifest(evidence).playerSeasonResearch!;
    expect(snapshot).toMatchObject({ supportedPlayerCount: 0, retainedProviderCohortObservationCount: 6, historyTargetAt: "2026-10-07T19:59:59Z", completePlayerSeasonAtFeatureCutoff: false });
    expect(snapshot.players[0].providerCohortObservation.populationScope).toBe("fixed_retained_provider_game_id_cohort");
    evidence.manifest.historyTargetAt = "2026-10-20T00:12:00Z";
    expect(evaluateManifest(evidence).playerSeasonResearch!.retainedProviderCohortObservationCount).toBe(0);
  });
  it("does not turn older publication plus later requests into time-complete season coverage", () => {
    const evidence = appearanceFixture();
    evidence.revisions.forEach(source => { source.provenance.availabilityBasis = "original_source";
      source.provenance.publishedAt = "2026-10-07T19:00:00Z"; });
    const season = evaluateManifest(evidence).playerSeasonResearch!;
    expect(season).toMatchObject({ supportedPlayerCount: 0, retainedProviderCohortObservationCount: 6,
      providerSeasonCoverageStatus: "unproved", historyCoverageThroughAt: null });
    expect(season.players.every(player => player.historyStatus === "unproved" && player.provedSeasonAppearanceGameIds === null)).toBe(true);
    expect(season.players[0].providerCohortObservation.goalsPerPlayingAppearance).toBe(3);
  });
  it.each([undefined, null, 42, "", "   ", "2026-02-30", "wrong"])("rejects missing or invalid identity on both source and BOX sides: %j", value => {
    const evidence = appearanceFixture();
    evidence.input.boxes.forEach(box => rewriteBox(box, payload => {
      payload.gameDate = value; payload.homeTeam.abbrev = value; payload.awayTeam.abbrev = value;
    }));
    evidence.revisions.forEach(source => rewriteBox(source, payload => {
      for (const row of payload.gameLog ?? payload.data) {
        row.gameDate = value; row.teamAbbrev = value;
        if (source.kind === "official_player_game_log") row.opponentAbbrev = value; else row.opponentTeamAbbrev = value;
      }
    }));
    const season = evaluateManifest(evidence).playerSeasonResearch!;
    expect(season.supportedPlayerCount).toBe(0);
    expect(season.retainedProviderCohortObservationCount).toBe(0);
    expect(season.players.every(player => player.appearanceEvidence.reasons.includes("appearance_historical_identity_missing_or_invalid"))).toBe(true);
  });
  it("rejects substituted raw bytes, team-filtered queries, duplicate revisions, and a changed cohort", () => {
    const bytes = appearanceFixture(); bytes.revisions[0].bodyUtf8 += " ";
    expect(() => evaluateManifest(bytes)).toThrow("Unverified appearance source");
    const query = appearanceFixture(); query.revisions[1].url += "&teamId=10"; query.revisions[1].provenance.source = query.revisions[1].url;
    expect(() => evaluateManifest(query)).toThrow("Unverified appearance source");
    const duplicate = appearanceFixture(); duplicate.manifest.players[0].indexRevisionIds.push(duplicate.manifest.players[0].indexRevisionIds[0]);
    expect(() => evaluateManifest(duplicate)).toThrow("revision population mismatch");
    const cohort = appearanceFixture(); cohort.manifest.cohortPlayerIds.pop();
    expect(() => evaluateManifest(cohort)).toThrow("population mismatch");
    const schema = appearanceFixture(); (schema.manifest as any).complete = true;
    expect(() => evaluateManifest(schema)).toThrow();
  });
  it("accepts verified appearances at different historical clubs without a current-team filter", () => {
    const evidence = appearanceFixture(); evidence.manifest.players = [evidence.manifest.players[0]]; evidence.manifest.cohortPlayerIds = [1001];
    evidence.revisions = evidence.revisions.slice(0, 2);
    const first = evidence.observations.find(row => row.playerId === 1001)!;
    const second = { ...first, teamAbbrev: "UTA", opponentAbbrev: "CHI", appearance: { ...first.appearance,
      gameId: 2026020002, teamId: 11, officialGoals: 0, goalsByCell: {} } };
    rewriteBox(evidence.revisions[0], payload => { payload.gameLog.push({ ...payload.gameLog[0], gameId: 2026020002, teamAbbrev: "UTA", opponentAbbrev: "CHI", goals: 0 }); });
    rewriteBox(evidence.revisions[1], payload => { payload.data.push({ ...payload.data[0], gameId: 2026020002, teamAbbrev: "UTA", opponentTeamAbbrev: "CHI", goals: 0 }); payload.total++; });
    const proof = reconcileResearchGoalAppearanceManifest({ manifest: evidence.manifest, revisions: evidence.revisions,
      cohortResultHash: evidence.manifest.cohortResultHash, seasonId: 20262027, featureCutoffAt: cutoff,
      expectedPlayerIds: [1001], observations: [first, second] }).players[0];
    expect(proof.provedSeasonAppearanceGameIds).toBeNull();
    expect(proof.retainedProviderCohortGameIds).toEqual([2026020001, 2026020002]);
    expect(estimateResearchPlayerGoals({ playerId: 1001, seasonId: 20262027, featureCutoffAt: cutoff,
      appearances: proof.appearances, provedSeasonAppearanceGameIds: null }).observedCohort.goalsPerObservedAppearance).toBe(1.5);
  });
  it("exhausts two ordered per-game pages with a stable reported total", () => {
    const evidence = appearanceFixture(); evidence.manifest.players = [evidence.manifest.players[0]]; evidence.manifest.cohortPlayerIds = [1001];
    evidence.revisions = evidence.revisions.slice(0, 2);
    const first = evidence.observations.find(row => row.playerId === 1001)!;
    const observations = Array.from({ length: 101 }, (_, index) => ({ ...first,
      appearance: { ...first.appearance, gameId: 2026020001 + index } }));
    const log = evidence.revisions[0], index = evidence.revisions[1], firstLog = log.payload.gameLog[0], firstIndex = index.payload.data[0];
    rewriteBox(log, payload => { payload.gameLog = observations.map(row => ({ ...firstLog, gameId: row.appearance.gameId })); });
    const allIndexRows = observations.map(row => ({ ...firstIndex, gameId: row.appearance.gameId }));
    rewriteBox(index, payload => { payload.data = allIndexRows.slice(0, 100); payload.total = 101; });
    const second = clone(index); second.revisionId += "-second"; second.provenance.revisionId = second.revisionId;
    second.pageStart = 100; const url = new URL(second.url); url.searchParams.set("start", "100");
    second.url = url.href; second.provenance.source = second.url;
    rewriteBox(second, payload => { payload.data = allIndexRows.slice(100); });
    evidence.revisions.push(second); evidence.manifest.players[0].indexRevisionIds.push(second.revisionId);
    const proof = reconcileResearchGoalAppearanceManifest({ manifest: evidence.manifest, revisions: evidence.revisions,
      cohortResultHash: evidence.manifest.cohortResultHash, seasonId: 20262027, featureCutoffAt: cutoff,
      expectedPlayerIds: [1001], observations }).players[0];
    expect(proof.status).toBe("cohort_reconciled"); expect(proof.retainedProviderCohortGameIds).toHaveLength(101);
    expect(proof.provedSeasonAppearanceGameIds).toBeNull();
  });
});

describe("retained official GOALS research evaluation", () => {
  it("reconciles positive-TOI skaters and observed goalie zeros while keeping full player-season support unproved", () => {
    const result = evaluate();
    expect(result).toMatchObject({ category: "GOALS", productionReplacement: false, acceptanceEligible: false,
      comparison: { forecastLift: "not_evaluated", historicalForecastBacktestEligible: false, featuresAvailableBeforeLatestHistoricalStart: 0 } });
    expect(result.teams[0]).toMatchObject({ retainedClubScheduleWindowComplete: true,
      historicalAccounting: { officialGoals: 3, contributorGoals: 3, reconciled: true, weightedObservedCohortMean: 3 },
      sumOfSupportedIndividualConditionalMeans: null, futureResidualMean: null, fullGameEligible: false });
    expect(result.teams[0].players.find(row => row.playerId === 1099)?.observedCohort).toMatchObject({ positiveToiAppearanceCount: 1, officialGoals: 0 });
    expect(result.teams[0].players.every(row => row.conditionalGoalsPerPlayingAppearance === null)).toBe(true);
  });
  it("excludes shootout standings goals and retains awarded GOALS credit independently of SOG support", () => {
    expect(evaluate(fixture(true)).teams[1].historicalAccounting.officialGoals).toBe(1);
    expect(evaluate(fixture(false, true)).teams[0].historicalAccounting).toMatchObject({ officialGoals: 3, contributorGoals: 3, reconciled: true });
  });
  it("keeps missing and late boxscore support unknown rather than reclassifying missing players as DNP", () => {
    const missing = fixture(); missing.boxes = missing.boxes.slice(1);
    expect(evaluate(missing).teams[0].historicalAccounting.reconciled).toBe(false);
    const late = fixture(); late.boxes[0].provenance.firstReceivedAt = cutoff; late.boxes[0].provenance.verifiedAt = cutoff;
    expect(evaluate(late).teams[0].historicalAccounting.weightedObservedCohortMean).toBeNull();
  });
  it("rejects substituted raw bytes and game identity, and preserves credit mismatches as unsupported", () => {
    const tampered = fixture(); tampered.boxes[0].payload.id = 77;
    expect(() => evaluate(tampered)).toThrow("Unverified retained");
    const identity = fixture(); rewriteBox(identity.boxes[0], payload => { payload.season = 20252026; });
    expect(() => evaluate(identity)).toThrow("historical game identity");
    const mismatch = fixture(); rewriteBox(mismatch.boxes[0], payload => { payload.playerByGameStats.homeTeam.forwards[0].goals = 2; });
    expect(evaluate(mismatch).teams[0].historicalAccounting.reconciled).toBe(false);
  });
  it("runs deterministic offline CLI evaluations without overwriting retained input/output bytes", () => {
    const input = fixture(), directory = mkdtempSync(join(tmpdir(), "research-goals-test-"));
    const revisions = join(directory, "revisions"), supplemental = join(directory, "supplemental");
    mkdirSync(revisions); mkdirSync(supplemental);
    const fetch = vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("No network in research fixture"));
    try {
      const history = join(directory, "history.json"), prior = join(directory, "prior.json");
      writeFileSync(history, JSON.stringify(input.historyBundle)); writeFileSync(prior, JSON.stringify(input.attributeAudit));
      input.revisions.forEach(row => writeFileSync(join(revisions, `${row.revisionId}.json`), JSON.stringify(row)));
      input.boxes.forEach(row => writeFileSync(join(supplemental, `${row.revisionId}.json`), JSON.stringify(row)));
      writeFileSync(join(supplemental, "manifest.json"), JSON.stringify({ version: "official-supplemental-observations-v1", acceptanceEligible: false,
        prospectiveScope: input.historyBundle.scope, games: input.boxes.map(row => ({ gameId: row.gameId, boxscoreRevisionId: row.revisionId })) }));
      const options = ["--history", history, "--revisions", revisions, "--attribute-audit", prior, "--supplemental", supplemental];
      const original = readFileSync(history, "utf8"), output = join(directory, "a.json");
      const a = runResearchGoalBaseline([...options, "--output", output]), b = runResearchGoalBaseline([...options, "--output", join(directory, "b.json")]);
      expect(a.resultHash).toBe(b.resultHash); expect(readFileSync(history, "utf8")).toBe(original);
      expect(() => runResearchGoalBaseline([...options, "--output", output])).toThrow("EEXIST");
      const evidence = appearanceFixture(input), appearanceFile = join(directory, "appearance-manifest.json");
      writeFileSync(appearanceFile, JSON.stringify(evidence.manifest));
      evidence.revisions.forEach(source => writeFileSync(join(directory, `${source.revisionId}.json`), JSON.stringify(source)));
      const manifestedOptions = [...options, "--appearance-manifest", appearanceFile];
      const manifestedA = runResearchGoalBaseline([...manifestedOptions, "--output", join(directory, "manifest-a.json")]);
      const manifestedB = runResearchGoalBaseline([...manifestedOptions, "--output", join(directory, "manifest-b.json")]);
      expect(manifestedA.resultHash).toBe(manifestedB.resultHash);
      expect(manifestedA.result.playerSeasonResearch?.supportedPlayerCount).toBe(0);
      expect(manifestedA.result.playerSeasonResearch?.retainedProviderCohortObservationCount).toBe(6);
      expect(manifestedA.inputFiles.some(file => file.path === appearanceFile)).toBe(true);
      evidence.manifest.players[0].gameLogRevisionId = "../escape";
      writeFileSync(appearanceFile, JSON.stringify(evidence.manifest));
      expect(() => runResearchGoalBaseline([...manifestedOptions, "--output", join(directory, "unsafe.json")])).toThrow();
      expect(fetch).not.toHaveBeenCalled();
    } finally { fetch.mockRestore(); rmSync(directory, { recursive: true, force: true }); }
  });
});
