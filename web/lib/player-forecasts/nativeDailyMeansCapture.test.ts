// @vitest-environment node
import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { assembleNativeDailyMeans, mergeNativeMaterializationParents, NATIVE_MEANS_BOUNDS, nativeMeansGameUrl, nativeMeansScheduleUrl, nativeMeansUrlKind, planNativeMeansCapture, type NativeMeansUniverseRow } from "./nativeDailyMeansCapture";
import { nativeGoalieSummaryUrl } from "./nativeGoalieOutcomes";
import { prepareNativeInputMaterialization } from "./nativeInputMaterialization";
import { CURRENT_APPEARANCE_POLICY_VERSION, PRIOR_APPEARANCE_POLICY_VERSION } from "./baselineRates";
import { NATIVE_GOALIE_SHUTOUT_POLICY_VERSION, NATIVE_GOALIE_SUMMARY_WIN_POLICY_VERSION, NATIVE_GOALIE_VOLUME_POLICY_VERSION,
  NATIVE_GOALIE_WIN_POLICY_VERSION } from "./goalieBaselineRates";
import type { HttpReceipt } from "./nativeDailyPipeline";

const seasonId = 20262027, anchor = "2026-09-29", asOf = "2026-10-12T11:00:00.000Z", cutoffAt = "2026-10-12T11:30:00.000Z";
const captured = (date: string) => `${date}T09:00:00.000Z`;
const receipt = (url: string, body: unknown, capturedAt: string): HttpReceipt => {
  const rawBody = JSON.stringify(body);
  return { url, capturedAt, rawBody, bodySha256: createHash("sha256").update(rawBody).digest("hex") };
};
const addDays = (date: string, days: number) => new Date(Date.parse(`${date}T00:00:00Z`) + days * 86400000).toISOString().slice(0, 10);
const universe: NativeMeansUniverseRow[] = [
  { playerId: 1, nhlPlayerId: 101, teamId: 1, rosterRevision: "r1", playerClass: "skater" },
  { playerId: 2, nhlPlayerId: 102, teamId: 1, rosterRevision: "r2", playerClass: "skater" },
  { playerId: 3, nhlPlayerId: 191, teamId: 1, rosterRevision: "r3", playerClass: "goalie" },
];
type Game = { id: number; date: string; home: number; away: number };
/** Club 1 plays club 2 every other day from the anchor; player 102 never dresses. */
const schedule = (count: number, first = anchor, startId = 2026020001, step = 2): Game[] => Array.from({ length: count }, (_, index) =>
  ({ id: startId + index, date: addDays(first, step * index), home: index % 2 ? 2 : 1, away: index % 2 ? 1 : 2 }));
const start = (game: Game) => `${game.date}T23:00:00Z`;
function boxscore(game: Game, options: { decision?: boolean; skaterToi?: string } = {}) {
  const side = (team: number) => {
    const home = team === game.home, skater = team === 1 ? 101 : 201, goalie = team === 1 ? 191 : 291;
    return { forwards: [{ playerId: skater, position: "C", toi: team === 1 ? options.skaterToi ?? "15:00" : "15:00", goals: home ? 1 : 0, assists: 0,
      sog: 3, hits: 2, blockedShots: 1, pim: 0, powerPlayGoals: 0, plusMinus: home ? 1 : -1 }], defense: [],
    goalies: [{ playerId: goalie, position: "G", starter: true, toi: "60:00", saves: home ? 20 : 24, shotsAgainst: home ? 20 : 25,
      goalsAgainst: home ? 0 : 1, saveShotsAgainst: home ? "20/20" : "24/25",
      ...(options.decision === false && team === 1 ? {} : { decision: home ? "W" : "L" }) }] };
  };
  return { id: game.id, season: seasonId, gameType: 2, gameDate: game.date, startTimeUTC: start(game), gameState: "OFF", gameScheduleState: "OK",
    periodDescriptor: { number: 3, periodType: "REG", maxRegulationPeriods: 3 }, homeTeam: { id: game.home, score: 1 }, awayTeam: { id: game.away, score: 0 },
    playerByGameStats: { homeTeam: side(game.home), awayTeam: side(game.away) } };
}
function landing(game: Game) {
  const period = (number: number, goals: any[]) => ({ periodDescriptor: { number, periodType: "REG", maxRegulationPeriods: 3 }, goals });
  return { id: game.id, season: seasonId, gameType: 2, gameDate: game.date, startTimeUTC: start(game), gameState: "OFF",
    homeTeam: { id: game.home, score: 1 }, awayTeam: { id: game.away, score: 0 }, periodDescriptor: { number: 3, periodType: "REG", maxRegulationPeriods: 3 },
    summary: { scoring: [period(1, [{ eventId: 1, playerId: game.home === 1 ? 101 : 201, strength: "ev", isHome: true, assists: [] }]), period(2, []), period(3, [])] } };
}
/** Weekly bodies for exactly the weeks a cold plan requests. */
function weeks(games: Game[], at = asOf) {
  return planNativeMeansCapture({ seasonId, asOf: at, scheduleAnchor: anchor, universe, cache: [] }).requests.map(value => {
    const requestDate = value.url.slice(-10);
    return receipt(value.url, { gameWeek: Array.from({ length: 7 }, (_, day) => addDays(requestDate, day)).map(date => ({ date,
      games: games.filter(game => game.date === date).map(game => ({ id: game.id, season: seasonId, gameType: 2, startTimeUTC: start(game),
        gameState: "OFF", gameScheduleState: "OK", homeTeam: { id: game.home }, awayTeam: { id: game.away } })) })) }, at);
  });
}
const bodies = (games: Game[], options: Parameters<typeof boxscore>[1] = {}) => games.flatMap(game => [
  receipt(nativeMeansGameUrl(game.id, "boxscore"), boxscore(game, options), captured(addDays(game.date, 1))),
  receipt(nativeMeansGameUrl(game.id, "landing"), landing(game), captured(addDays(game.date, 1)))]);
function summary(games: Game[], rows: (game: Game) => Record<string, unknown> = () => ({})) {
  const scope = { nhlPlayerId: 191, seasonId, startDate: games[0].date, endDate: games.at(-1)!.date, approvedGameIds: games.map(game => game.id) };
  const data = games.map(game => ({ playerId: 191, gameId: game.id, gameDate: game.date, gamesPlayed: 1, shutouts: game.home === 1 ? 1 : 0,
    wins: game.home === 1 ? 1 : 0, losses: game.home === 1 ? 0 : 1, otLosses: 0, saves: game.home === 1 ? 20 : 24,
    goalsAgainst: game.home === 1 ? 0 : 1, shotsAgainst: game.home === 1 ? 20 : 25, timeOnIce: 3600, ...rows(game) }));
  return receipt(nativeGoalieSummaryUrl(scope), { data, total: data.length }, "2026-10-12T10:00:00.000Z");
}
const plan = (cache: HttpReceipt[], extra: Partial<Parameters<typeof planNativeMeansCapture>[0]> = {}) =>
  planNativeMeansCapture({ seasonId, asOf, scheduleAnchor: anchor, universe, cache, ...extra });
const assemble = (cache: HttpReceipt[], planned = plan(cache)) => assembleNativeDailyMeans({ seasonId, cutoffAt, universe,
  games: planned.assembly.games, playerGames: planned.assembly.playerGames, summaries: planned.assembly.summaries,
  priorGames: planned.assembly.priorGames, notes: planned.assembly.notes, receipts: cache }, new Date("2026-10-12T12:00:00.000Z"));

describe("native means capture plan", () => {
  const games = schedule(7);
  it("plans schedule weeks first and only allowlisted URLs", () => {
    const cold = plan([]);
    expect(cold.status).toBe("requests_pending");
    expect(cold.requests.map(value => value.kind)).toEqual(["schedule", "schedule"]);
    expect(cold.players.every(value => value.status === "pending")).toBe(true);
    expect(cold.requests.every(value => nativeMeansUrlKind(value.url))).toBe(true);
    expect(nativeMeansUrlKind(nativeMeansGameUrl(2026020106, "landing"))).toBe("landing");
    expect(nativeMeansUrlKind("https://api-web.nhle.com/v1/gamecenter/2026010001/boxscore")).toBeNull();
    expect(nativeMeansUrlKind(`${nativeMeansScheduleUrl("2026-10-06")}?x=1`)).toBeNull();
    expect(() => plan([{ ...receipt(nativeMeansGameUrl(2026020001, "boxscore"), { id: 2026020001 }, asOf), rawBody: "{}" }])).toThrow("invalid_cached_receipt");
    expect(plan([]).inputHash).toBe(cold.inputHash);
  });

  it("requests each club game once, then the goalie summary, and is complete when every original is cached", () => {
    const withSchedule = plan(weeks(games));
    expect(withSchedule.requests.filter(value => value.kind === "boxscore")).toHaveLength(7);
    expect(withSchedule.requests.filter(value => value.kind === "landing")).toHaveLength(7);
    expect(withSchedule.summaries).toEqual([]);
    const withBodies = plan([...weeks(games), ...bodies(games)]);
    expect(withBodies.requests.map(value => value.kind)).toEqual(["goalie_summary"]);
    expect(withBodies.summaries[0].scope).toEqual({ nhlPlayerId: 191, seasonId, startDate: games[0].date, endDate: games[6].date,
      approvedGameIds: games.map(game => game.id) });
    const complete = plan([...weeks(games), ...bodies(games), summary(games)]);
    expect(complete.status).toBe("complete");
    expect(complete.assembly.playerGames[1]).toEqual(games.map(game => game.id));
    expect(complete.players.find(value => value.playerId === 2)).toMatchObject({ verifiedAppearances: 0, reasons: ["prior_season_games_not_supplied"] });
    expect(complete.estimate).toEqual({ requests: 0, bytes: 0, byKind: {} });
  });

  it("extends a club window by the appearance deficit up to the explicit cap", () => {
    // The latest twenty games show no minutes for the universe skater.
    const late = "2026-12-30T11:00:00.000Z", many = schedule(30, "2026-10-20", 2026020200);
    const cache = [...weeks(many, late), ...bodies(many.slice(0, 10)), ...bodies(many.slice(10), { skaterToi: "00:00" })];
    expect(plan(cache.filter(value => !value.url.includes(`/${many[5].id}/`)), { asOf: late }).clubs.find(value => value.teamId === 1))
      .toMatchObject({ window: 30, status: "pending_boxscores" });
    expect(plan(cache, { asOf: late }).clubs.find(value => value.teamId === 1)).toMatchObject({ window: 30, status: "settled", capped: false, seasonComplete: true });
    const capped = schedule(45, "2026-10-20", 2026020200, 1), cappedAt = "2026-12-10T11:00:00.000Z";
    expect(plan([...weeks(capped, cappedAt), ...bodies(capped, { skaterToi: "00:00" })], { asOf: cappedAt }).clubs.find(value => value.teamId === 1))
      .toMatchObject({ window: NATIVE_MEANS_BOUNDS.maxClubGames, capped: true, seasonComplete: false });
  });

  it("treats the released Oct 14-15 games as ordinary and honours only an explicit exclusion", () => {
    const goalieUniverse: NativeMeansUniverseRow[] = [{ playerId: 9, nhlPlayerId: 191, teamId: 8, rosterRevision: "r9", playerClass: "goalie" }];
    const around: Game[] = [{ id: 2026020095, date: "2026-10-13", home: 8, away: 2 }, { id: 2026020106, date: "2026-10-14", home: 15, away: 8 },
      { id: 2026020121, date: "2026-10-16", home: 2, away: 8 }];
    const mondayAsOf = "2026-10-20T11:00:00.000Z", base = { universe: goalieUniverse, asOf: mondayAsOf };
    expect(plan([], base).requests.map(value => value.url)).toEqual(["2026-10-20", "2026-10-13", "2026-10-06", "2026-09-29"].map(nativeMeansScheduleUrl));
    const goalieBox = (game: Game) => { const body = boxscore({ ...game, home: game.home === 8 ? 1 : 2, away: game.away === 8 ? 1 : 2 });
      return { ...body, homeTeam: { ...body.homeTeam, id: game.home }, awayTeam: { ...body.awayTeam, id: game.away } }; };
    const schedules = weeks(around, mondayAsOf), cache = [...schedules,
      ...around.flatMap(game => [receipt(nativeMeansGameUrl(game.id, "boxscore"), goalieBox(game), mondayAsOf),
        receipt(nativeMeansGameUrl(game.id, "landing"), landing(game), mondayAsOf)])];
    const settled = plan(cache, base);
    expect(settled.assembly.playerGames[9]).toEqual(around.map(game => game.id));
    expect(settled.excludedGames).toEqual([]);
    expect(settled.summaries).toEqual([expect.objectContaining({ playerId: 9, status: "requested",
      scope: { nhlPlayerId: 191, seasonId, startDate: "2026-10-13", endDate: "2026-10-16", approvedGameIds: around.map(game => game.id) } })]);
    const excluded = plan(schedules, { ...base, excludedGameIds: [2026020106] });
    expect(excluded.excludedGames).toEqual([{ gameId: 2026020106, reason: "excluded" }]);
    expect(excluded.requests.filter(value => value.kind === "boxscore").map(value => value.url))
      .toEqual([2026020121, 2026020095].map(gameId => nativeMeansGameUrl(gameId, "boxscore")));
  });
});

describe("native means assembly and policy assignment", () => {
  const games = schedule(7), cache = [...weeks(games), ...bodies(games), summary(games)];
  it("assigns current-appearance, volume, win and shutout and binds every original parent", () => {
    const means = assemble(cache);
    expect(means.nativeSelection.map(value => `${value.playerId}:${value.policyVersion}`)).toEqual([`1:${CURRENT_APPEARANCE_POLICY_VERSION}`,
      `3:${NATIVE_GOALIE_SHUTOUT_POLICY_VERSION}`, `3:${NATIVE_GOALIE_VOLUME_POLICY_VERSION}`, `3:${NATIVE_GOALIE_WIN_POLICY_VERSION}`]);
    const skater = means.coverage.find(value => value.playerId === 1)!, goalie = means.coverage.find(value => value.playerId === 3)!;
    expect(skater.targets.every((value: any) => value.status === "supported")).toBe(true);
    expect(goalie.targets.every((value: any) => value.status === "supported")).toBe(true);
    expect(means.coverage.find(value => value.playerId === 2)!.targets.every((value: any) => value.status === "missing"
      && value.reason === "prior_season_games_not_supplied")).toBe(true);
    // 7 boxscores + 7 landings, each as an original and a content-hash parent, plus the summary original.
    expect(means.parents).toHaveLength(29);
    const request = { runId: "8f2a6c1e-5b3d-4a7e-9c1f-2d4e6a8b0c1d", sourceKey: "native-means-test", date: "2026-10-12", closureScopeHash: "0".repeat(64),
      acquisition: { seasonId, cutoffAt, roster: universe, games: [{ ...means.additionalNativeObservations[0].payload.appearances[0].finalBoxscore.game }],
        receipts: cache.filter(value => value.url.includes(`/${games[0].id}/`)) },
      nativeSelection: means.nativeSelection, additionalNativeObservations: means.additionalNativeObservations,
      parents: means.parents, requiredParents: means.requiredParents };
    const prepared = prepareNativeInputMaterialization(request, "2026-10-12T12:00:00.000Z");
    expect(prepared.manifest.expectedItems).toBe(4);
  });

  it("uses the summary win only when the official summary closes every missing decision", () => {
    const missing = [...weeks(games), ...bodies(games, { decision: false })];
    const closes = assemble([...missing, summary(games)]);
    expect(closes.nativeSelection.map(value => value.policyVersion)).toContain(NATIVE_GOALIE_SUMMARY_WIN_POLICY_VERSION);
    expect(closes.nativeSelection.map(value => value.policyVersion)).not.toContain(NATIVE_GOALIE_WIN_POLICY_VERSION);
    const open = assemble([...missing, summary(games, game => game.id === games[2].id ? { wins: null } : {})]);
    const policies = open.nativeSelection.filter(value => value.playerId === 3).map(value => value.policyVersion);
    expect(policies).not.toContain(NATIVE_GOALIE_WIN_POLICY_VERSION);
    expect(policies).not.toContain(NATIVE_GOALIE_SUMMARY_WIN_POLICY_VERSION);
    expect(open.coverage.find(value => value.playerId === 3)!.targets.find((value: any) => value.targetKey === "WINS_GOALIE"))
      .toEqual({ targetKey: "WINS_GOALIE", status: "missing", policyVersion: null, reason: "win_decision_missing:summary_does_not_close_gap" });
  });

  it("keeps a missing landing unknown for PP points instead of zero", () => {
    const partial = cache.filter(value => value.url !== nativeMeansGameUrl(games[3].id, "landing"));
    const means = assemble(partial);
    const targets = means.coverage.find(value => value.playerId === 1)!.targets;
    expect(targets.find((value: any) => value.targetKey === "PP_POINTS")).toMatchObject({ status: "missing", reason: `missing_landing_ppp@${games[3].id}` });
    expect(targets.find((value: any) => value.targetKey === "GOALS")).toMatchObject({ status: "supported" });
    expect(means.additionalNativeObservations[0].payload.derivedPowerPlayPoints).toBeUndefined();
  });

  it("assigns prior-appearance only to a zero-appearance skater with supplied prior-season originals", () => {
    const prior = schedule(3, "2026-03-01", 2025021001), priorSeasonGames = { 2: prior.map(game => game.id) };
    const priorBody = (game: Game) => { const body = boxscore(game); body.season = seasonId - 10001;
      body.playerByGameStats.homeTeam.forwards.push({ ...body.playerByGameStats.homeTeam.forwards[0], playerId: 102, goals: 0, toi: "12:00" }); return body; };
    const requested = plan(cache, { priorSeasonGames });
    expect(requested.requests.map(value => value.kind)).toEqual(["prior_boxscore", "prior_landing", "prior_boxscore", "prior_landing", "prior_boxscore", "prior_landing"]);
    const priorCache = [...cache, ...prior.flatMap(game => [receipt(nativeMeansGameUrl(game.id, "boxscore"), priorBody(game), captured("2026-10-12")),
      receipt(nativeMeansGameUrl(game.id, "landing"), { ...landing(game), season: seasonId - 10001 }, captured("2026-10-12"))])];
    const planned = plan(priorCache, { priorSeasonGames });
    expect(planned.status).toBe("complete");
    const means = assemble(priorCache, planned);
    const observation = means.additionalNativeObservations.find(value => value.payload.playerId === 2)!;
    expect(observation.payload.policyVersion).toBe(PRIOR_APPEARANCE_POLICY_VERSION);
    expect(observation.payload.appearances).toHaveLength(3);
    expect(observation.payload.historicalSources.games.every((value: any) => value.roster.source_play_by_play_hash === null)).toBe(true);
  });

  it("batches a shared game set within the assembler roster bound", () => {
    const crowd = [...universe, ...Array.from({ length: 50 }, (_, index): NativeMeansUniverseRow => ({ playerId: 100 + index, nhlPlayerId: 1000 + index,
      teamId: 1, rosterRevision: "rx", playerClass: "skater" }))];
    const planned = planNativeMeansCapture({ seasonId, asOf, scheduleAnchor: anchor, universe: crowd, cache });
    const means = assembleNativeDailyMeans({ seasonId, cutoffAt, universe: crowd, games: planned.assembly.games, playerGames: planned.assembly.playerGames,
      summaries: planned.assembly.summaries, receipts: cache }, new Date("2026-10-12T12:00:00.000Z"));
    expect(means.stats).toMatchObject({ groups: 1, assemblerCalls: 2 });
    expect(means.coverage.filter(value => value.playerId >= 100).every((value: any) => value.selectedPolicies.length === 0)).toBe(true);
  });

  it("merges parent sets by hash, keeping the first identity and refusing conflicting content", () => {
    const means = assemble(cache), derived = means.parents.find(value => value.derived)!;
    const renamed = { ...derived, id: `boxscore:${derived.id}` };
    expect(mergeNativeMaterializationParents([renamed], means.parents).parents.find(value => value.hash === derived.hash)!.id).toBe(renamed.id);
    expect(mergeNativeMaterializationParents([renamed], means.parents).requiredParents).toHaveLength(means.parents.length);
    expect(() => mergeNativeMaterializationParents([{ ...derived, capturedAt: asOf }], means.parents)).toThrow("parent_hash_conflict");
  });
});
