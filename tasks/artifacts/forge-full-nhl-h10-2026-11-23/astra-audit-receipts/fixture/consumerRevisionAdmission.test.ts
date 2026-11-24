import { afterAll, afterEach, describe, expect, it, vi } from "vitest";
import { forecastCalendarPolicy } from "lib/player-forecasts/contributions";
import { bindFixtureForecast, fixtureRsoPolicy } from "lib/player-forecasts/rsoUsePolicy.fixtures";
import { currentRsoUsePolicy, restrictRsoForecast } from "lib/player-forecasts/rsoUsePolicy";
import { normalizePlanningGames } from "lib/rosterScheduleData/planningInputs";
import { forecastAllows, gameForecastPoints } from "lib/rosterScheduleOptimizer/planning";
import type { ForecastDiscoveryExclusion, GameForecast, PlanningGame, PlanningPlayer, PlanningSnapshot } from "lib/rosterScheduleOptimizer/planningTypes";
import type { ForgeGameRevision } from "/Users/tim/Code/fhfhockey.com/web/lib/projections/gameRevisions";
import { FORGE_EXTERNAL_FANTASY_INPUT_CONTRACT } from "/Users/tim/Code/fhfhockey.com/web/lib/projections/calibrationEligibility";
import { forgeRosterRevision, forgeScheduleRevision, type ForgeIssuedContextV1 } from "/Users/tim/Code/fhfhockey.com/web/lib/projections/issuedContext";
import { buildNativeSkaterParticipationFields } from "/Users/tim/Code/fhfhockey.com/web/lib/projections/nativeGoalAccounting";
import * as rsoPolicyModule from "lib/player-forecasts/rsoUsePolicy";
import { evaluatePlan } from "lib/rosterScheduleOptimizer/planning";
import type { PlanIntent } from "lib/rosterScheduleOptimizer/planningTypes";
import { admitConsumerGameRevisions, DETAILED_PARTICIPATION_CONFLICT_NOTE, DETAILED_PARTICIPATION_LINE_ROLE_NOTE, detailedParticipationBasisOf,
  publicPlanningForecasts, RSO_ASSUMED_PARTICIPATION_POLICY, type RsoParticipationContext } from "/Users/tim/Code/fhfhockey.com/web/lib/projections/consumerRevisionAdmission";
import type { OverlayAppearance, OverlayRosterEvent, RsoParticipationSources } from "/Users/tim/Code/fhfhockey.com/web/lib/projections/rsoParticipationOverlay";
import type { BoardAssertion } from "/Users/tim/Code/fhfhockey.com/web/lib/projections/dailyBoardEvidence";

describe("consumer revision calendar horizon (decision 127)", () => {
  // 9 pm ET on Nov 12 (already Nov 13 UTC); a 1 pm ET game on Nov 26 is lead 13 on UTC days, lead 14 on NHL dates.
  const now = new Date("2026-11-13T02:00:00Z");
  const game: PlanningGame = { id: "41", date: "2026-11-26", startsAt: "2026-11-26T18:00:00Z", teamAbbreviation: "MIN", opponent: "TOR",
    home: true, status: "scheduled", scheduleRevision: "schedule-a" } as PlanningGame;
  const revision = { id: "rev-41", run_id: "run", game_id: 41, published_at: "2026-11-12T20:00:00Z", decision_as_of: "2026-11-12T19:00:00Z",
    payload: { players: [], goalies: [], teams: [] } } as unknown as ForgeGameRevision;
  const exclusionsUnder = (policy: Parameters<typeof publicPlanningForecasts>[7]) => {
    const exclusions: Record<string, number> = {};
    publicPlanningForecasts([revision], [], [game], now, exclusions, [], undefined, policy);
    return exclusions;
  };

  it("measures the horizon on the policy's date basis, using the schedule's own date under v2", () => {
    expect(exclusionsUnder(forecastCalendarPolicy(14, "forecast-calendar-v1")).outside_horizon).toBeUndefined();
    // The default is v2 since decision 127's flip.
    expect(exclusionsUnder(undefined).outside_horizon).toBe(1);
    expect(exclusionsUnder(forecastCalendarPolicy(14, "forecast-calendar-v2")).outside_horizon).toBe(1);
    // The schedule date wins over the start instant: listed for Nov 25, the same start is lead 13 under v2.
    const exclusions: Record<string, number> = {};
    publicPlanningForecasts([revision], [], [{ ...game, date: "2026-11-25" }], now, exclusions, [], undefined, forecastCalendarPolicy(14, "forecast-calendar-v2"));
    expect(exclusions.outside_horizon).toBeUndefined();
  });
});

// ---- TJ's Detailed RSO participation policy (2026-11-21, rev 2: read-time availability overlay). ----
// Fictional fixtures only; never provider observations.
const overlay = vi.hoisted(() => ({ newsLatest: new Map<number, string>(), sources: null as unknown, fail: false }));
vi.mock("/Users/tim/Code/fhfhockey.com/web/lib/projections/acceptedNews", async importOriginal => ({ ...(await importOriginal<typeof import("./acceptedNews")>()),
  loadAcceptedForecastNews: vi.fn(async () => ({ revisionHash: "news-hash", latestAcceptedAt: overlay.newsLatest })) }));
vi.mock("/Users/tim/Code/fhfhockey.com/web/lib/projections/rsoParticipationOverlay", async importOriginal => ({ ...(await importOriginal<typeof import("./rsoParticipationOverlay")>()),
  loadRsoParticipationSources: vi.fn(async () => { if (overlay.fail) throw new Error("fictional read failure"); return overlay.sources; }) }));

describe("Detailed RSO participation policy (TJ 2026-11-21, rev 2)", () => {
  const TEAM = 1, NHL = 847001, CUTOFF = "2026-10-10T10:00:00Z";
  const G1 = { id: 2026020001, date: "2026-10-10", start: "2026-10-10T23:00:00Z" };
  const G2 = { id: 2026020002, date: "2026-10-12", start: "2026-10-12T23:00:00Z" };
  const membershipCreatedAt = ["2026-09-01T00:00:00Z"];
  const rosterRevision = forgeRosterRevision({ canonicalId: 7, nhlId: NHL, seasonId: 20262027, teamId: TEAM, membershipCreatedAt });
  const skater = { id: "7", nhlId: NHL, nhlTeamId: TEAM, rosterRevision, name: "Skater", playerClass: "skater", teamAbbreviation: "TOR",
    eligiblePositions: ["C"], availability: "unknown", ownership: null, canDrop: null, holdValue: null, reserveEligibility: [] } as PlanningPlayer;
  const games = normalizePlanningGames([G1, G2].map((game, index) => ({ id: index + 1, source_game_id: game.id, source_season_id: 20262027,
    game_date: game.date, start_time: game.start, team_abbreviation: "TOR", opponent_abbreviation: "MTL", home_away: "home", game_status: "FUT",
    schedule_status: "OK", is_countable: true, game_type: 2 })));
  const side = (game: typeof G1, teamId: number, opp: number, abbr: string, oppAbbr: string) => ({ gameKey: "nhl", season: "2026",
    sourceSeasonId: 20262027, teamId, opponentTeamId: opp, teamAbbreviation: abbr, opponentAbbreviation: oppAbbr, startTime: game.start,
    gameStatus: "FUT", scheduleStatus: "OK", sourceUpdatedAt: null, fetchedAt: "2026-10-10T09:00:00Z", revision: forgeScheduleRevision({
      source_game_id: game.id, start_time: game.start, team_abbreviation: abbr, opponent_abbreviation: oppAbbr, game_status: "FUT", schedule_status: "OK" }) });
  const issuedContextFor = (game: typeof G1) => ({ version: "forge-issued-context-v1", game: { id: game.id, date: game.date, seasonId: 20262027,
    startTime: game.start, homeTeamId: 1, awayTeamId: 2 }, schedule: [side(game, 1, 2, "TOR", "MTL"), side(game, 2, 1, "MTL", "TOR")],
    roster: [{ canonicalId: 7, nhlId: NHL, seasonId: 20262027, teamId: TEAM, membershipCreatedAt, identityUpdatedAt: "2026-09-01T00:00:00Z",
      revision: rosterRevision }], observedAt: "2026-10-10T09:00:00Z" } as ForgeIssuedContextV1);
  // His "if he plays" line: 0.4 G, 0.7 A, 3 SOG = 4.1 points at the hosted reader's weights.
  const LINE = { proj_goals_es: 0.3, proj_goals_pp: 0.1, proj_goals_pk: 0, proj_assists_es: 0.5, proj_assists_pp: 0.2, proj_assists_pk: 0,
    proj_shots_es: 2.5, proj_shots_pp: 0.5, proj_shots_pk: 0 };
  type Coverage = { state: "projected_lineup" | "confirmed_out" | "uncertain" | "unknown"; event_type?: string | null; event_id?: number | null };
  const revisionWith = (coverage: Coverage, options: { id?: string; game?: typeof G1; goalie?: boolean } = {}) => {
    const game = options.game ?? G1;
    const evidence = { informationCutoffAt: CUTOFF, assertions: [], conflicts: [] };
    const selection = buildNativeSkaterParticipationFields({ gameId: game.id, teamId: TEAM, playerId: NHL, compute: true, evidence });
    return { id: options.id ?? "rev-a", run_id: "run-a", game_id: game.id, decision_as_of: CUTOFF, published_at: CUTOFF,
      payload: { teams: [], codeVersion: "code-v1", evidence,
        goalies: options.goalie ? [{ game_id: game.id, team_id: TEAM, horizon_games: 1, as_of_date: game.date, run_id: "run-a",
          uncertainty: { daily_board_candidates: [{ playerId: 847099, startingProbability: 1, conditional: { SAVES_GOALIE: 30 } }] } }] : [],
        players: [{ game_id: game.id, team_id: TEAM, player_id: NHL, horizon_games: 1, as_of_date: game.date, run_id: "run-a", ...LINE,
          uncertainty: { model: { skater_selection: selection }, availability: { version: "forge-skater-coverage-v1", game_id: game.id,
            state: coverage.state, line_conditioning: "if_plays", expected_for_game: coverage.state === "confirmed_out" ? 0 : null,
            participation_probability: null, participation_qualified: false, label: "fictional", event_type: coverage.event_type ?? null,
            event_id: coverage.event_id ?? (coverage.event_type ? 11 : null) } } }],
        inputProvenance: { external_fantasy_input_contract: FORGE_EXTERNAL_FANTASY_INPUT_CONTRACT, capturedReads: { version: "forge-captured-reads-v1",
          hash: "a".repeat(64), readCount: 2, firstReceivedAt: "2026-10-10T09:00:00Z", lastReceivedAt: "2026-10-10T09:01:00Z" },
          issuedContexts: [issuedContextFor(game)] } } } as unknown as ForgeGameRevision;
  };
  const event = (event_id: number, event_type: string, effective_from: string, payload: Record<string, unknown> = {},
    effective_to: string | null = null): OverlayRosterEvent => ({ event_id, team_id: TEAM, player_id: NHL, event_type, effective_from, effective_to, payload });
  const INJURY = event(11, "INJURY_OUT", "2026-10-08T15:00:00Z", { category: "INJURY", subcategory: "OUT" });
  const news = (id: string, dimension: BoardAssertion["dimension"], value: string, confirmed: boolean, publishedAt: string,
    gameId = G1.id): BoardAssertion => ({ gameId, teamId: TEAM, playerId: NHL, dimension, value, confirmed, evidenceId: id,
    sourceKey: "fictional-source", sourceUrl: null, publishedAt, receivedAt: publishedAt });
  const sourcesOf = (readAt: string, parts: { events?: OverlayRosterEvent[]; appearances?: OverlayAppearance[]; news?: BoardAssertion[];
    conflicts?: string[] } = {}): RsoParticipationSources => ({ readAt, rosterEvents: [INJURY, ...(parts.events ?? [])],
    appearances: parts.appearances ?? [], news: { informationCutoffAt: readAt, assertions: parts.news ?? [],
      conflicts: (parts.conflicts ?? []).map(dimension => ({ gameId: G1.id, teamId: TEAM, playerId: NHL, dimension, evidenceIds: ["x", "y"] })) } });
  const admit = (revisions: ForgeGameRevision[], at: string, context: RsoParticipationContext | null) => {
    const exclusionRows: ForecastDiscoveryExclusion[] = [];
    const forecasts = publicPlanningForecasts(revisions, [skater], games, new Date(at), {}, exclusionRows, undefined, undefined, new Map(),
      context ?? undefined);
    return { forecasts, exclusionRows };
  };
  // What Detailed serves: admission → RSO use restriction → the hosted reader's own allows/points readback (score()).
  const weights = { GOALS: 3, ASSISTS: 2, SHOTS_ON_GOAL: 0.5 };
  const served = (row: GameForecast | undefined, at: string, reviewed: boolean, excluded: ForecastDiscoveryExclusion[]) => {
    if (!row) return { points: null, reason: excluded.find(item => !item.targetKey)?.reasons[0] ?? "no_usable_target" };
    const policy = reviewed ? fixtureRsoPolicy(["code-v1"], Object.keys(row.stats)) : rsoPolicyModule.RSO_USE_POLICY;
    const restricted = restrictRsoForecast(reviewed ? bindFixtureForecast(row) : row, undefined, at, policy);
    if (!Object.keys(weights).every(key => (["assignment", "totals", "comparison"] as const).every(use => forecastAllows(restricted, key, use)))) {
      return { points: null, reason: "use_not_approved" };
    }
    const snapshot = { players: [skater], forecasts: [restricted], games, context: { asOf: at },
      rules: { scoring: { mode: "points", weights, categories: [] } } } as unknown as PlanningSnapshot;
    const points = gameForecastPoints(snapshot, restricted).expected;
    return { points: points === null ? null : Number(points.toFixed(4)), reason: points === null ? "missing_target" : null };
  };
  const table: Array<Record<string, unknown>> = [];
  const record = (step: string, revisions: ForgeGameRevision[], at: string, context: RsoParticipationContext | null, gameId = G1.id) => {
    const { forecasts, exclusionRows } = admit(revisions, at, context);
    const row = forecasts.find(item => item.gameId === String(gameId));
    const excluded = exclusionRows.filter(item => item.gameId === String(gameId) && !item.targetKey);
    const entry = { step, readAt: at, game: gameId, revision: row?.revisionId ?? null, issuedAt: row?.issuedAt ?? null,
      basis: row ? detailedParticipationBasisOf(row) : null, appearance: row?.appearanceProbability ?? null,
      goals: row?.stats.GOALS ?? null, ifPlaysGoals: row?.conditionalStats?.GOALS ?? null,
      changes: row?.limitations.filter(note => note.startsWith("Availability update")) ?? [],
      notes: row?.limitations.filter(note => note === DETAILED_PARTICIPATION_CONFLICT_NOTE || note === DETAILED_PARTICIPATION_LINE_ROLE_NOTE) ?? [],
      excluded: excluded.map(item => item.reasons[0]),
      servedCurrentCatalog: served(row, at, false, excluded), servedUnderFixtureReview: served(row, at, true, excluded) };
    table.push(entry);
    return entry;
  };
  const ctx = (sources: RsoParticipationSources | null, superseded: string[] = []): RsoParticipationContext => ({ sources, superseded: new Set(superseded) });
  afterEach(() => { overlay.newsLatest.clear(); overlay.sources = null; overlay.fail = false; vi.restoreAllMocks(); });
  afterAll(() => { console.log(`PARTICIPATION_TABLE ${JSON.stringify(table)}`); });

  it("keeps decisions 3/47 when the policy is off (start chart and other consumers)", () => {
    const { forecasts, exclusionRows } = admit([revisionWith({ state: "projected_lineup" })], "2026-10-10T12:00:00Z", null);
    expect(forecasts).toEqual([]);
    expect(exclusionRows).toContainEqual({ gameId: String(G1.id), playerId: "7", reasons: ["missing_participation"] });
  });

  it("healthy, no news: assumed playing on the saved line; healthy outside the lineup too", () => {
    const at = "2026-10-10T12:00:00Z";
    expect(record("healthy, projected lineup", [revisionWith({ state: "projected_lineup" })], at, ctx(sourcesOf(at)))).toMatchObject({
      basis: "assumed_playing", appearance: 1, goals: 0.4, ifPlaysGoals: 0.4, changes: [],
      servedCurrentCatalog: { reason: "use_not_approved" }, servedUnderFixtureReview: { points: 4.1, reason: null } });
    expect(record("healthy, outside projected lineup", [revisionWith({ state: "unknown" })], at, ctx(sourcesOf(at)))).toMatchObject({
      basis: "assumed_playing", servedUnderFixtureReview: { points: 4.1 } });
  });

  it("full sequence on one issued revision: injured → possible return → confirmed return → late scratch; never rewritten, never re-run", () => {
    const issued = revisionWith({ state: "confirmed_out", event_type: "INJURY_OUT" });
    const original = structuredClone(issued);
    const possible = event(21, "RETURN", "2026-10-10T12:30:00Z", { category: "RETURN", subcategory: "PROJECTED RETURN" }, "2026-10-11T18:30:00Z");
    const confirmed = news("fictional-return", "availability", "return", true, "2026-10-10T14:30:00Z");
    const scratch = event(31, "SCRATCH", "2026-10-10T17:30:00Z", { category: "SCRATCHES", game_id: G1.id });
    // Unconfirmed lineup, PP and practice reports along the way clear nothing.
    const noise = [news("fictional-line", "ev", "L2", false, "2026-10-10T12:45:00Z"), news("fictional-pp", "pp", "PP1", true, "2026-10-10T12:50:00Z"),
      news("fictional-practice", "availability", "uncertain", false, "2026-10-10T12:55:00Z")];
    const steps = [
      ["1 injured, no update", "2026-10-10T12:00:00Z", sourcesOf("2026-10-10T12:00:00Z")],
      ["2 possible return + projected line/PP/practice", "2026-10-10T13:00:00Z", sourcesOf("2026-10-10T13:00:00Z", { events: [possible], news: noise })],
      ["3 confirmed return (game-specific)", "2026-10-10T15:00:00Z", sourcesOf("2026-10-10T15:00:00Z", { events: [possible], news: [...noise, confirmed] })],
      ["4 late scratch", "2026-10-10T18:00:00Z", sourcesOf("2026-10-10T18:00:00Z", { events: [possible, scratch], news: [...noise, confirmed] })],
    ] as const;
    const rows = steps.map(([step, at, sources]) => record(step, [issued], at, ctx(sources)));
    expect(rows.map(row => [row.basis, row.goals, (row.servedUnderFixtureReview as { points: number | null }).points])).toEqual([
      ["assumed_out", 0, 0], ["assumed_out", 0, 0], ["confirmed_playing", 0.4, 4.1], ["confirmed_out", 0, 0]]);
    // Same revision and issue time throughout: no new FORGE run; the if-he-plays line is kept the whole time.
    expect(new Set(rows.map(row => `${row.revision}@${row.issuedAt}`))).toEqual(new Set(["rev-a@2026-10-10T10:00:00Z"]));
    expect(rows.every(row => row.ifPlaysGoals === 0.4)).toBe(true);
    // Each change is its own timestamped record, in order.
    expect(rows[1].changes).toEqual([expect.stringContaining("2026-10-10T12:30:00Z · roster event 21 (RETURN): possible return")]);
    expect(rows[1].notes).toEqual([DETAILED_PARTICIPATION_LINE_ROLE_NOTE]);
    expect(rows[3].changes).toEqual([expect.stringContaining("12:30:00Z"), expect.stringContaining("14:30:00Z · accepted news fictional-return"),
      expect.stringContaining("17:30:00Z · roster event 31 (SCRATCH): scratched for this game")]);
    expect(rows.map(row => row.servedCurrentCatalog)).toEqual(rows.map(() => ({ points: null, reason: "use_not_approved" })));
    expect(issued).toEqual(original);
  });

  it("the planner's lineup recalculates as availability changes, from the same saved line", () => {
    vi.spyOn(rsoPolicyModule, "currentRsoUsePolicy").mockReturnValue(fixtureRsoPolicy(["code-v1"], ["GOALS", "ASSISTS", "SHOTS_ON_GOAL",
      "PP_POINTS", "HITS", "BLOCKED_SHOTS", "PENALTY_MINUTES", "TIME_ON_ICE_PER_GAME"]));
    const star: PlanningPlayer = { ...skater, eligibilityVerified: true };
    const depth: PlanningPlayer = { ...star, id: "8", nhlId: 847002, name: "Depth" };
    const intent: PlanIntent = { revision: 1, steps: [], protectedPlayerIds: [], excludedPlayerIds: [], goalieCoverage: "accept_risk",
      goalieWindow: "any", goalieSplit: "mon_thu", alternativeCount: 5 };
    const lineupAt = (at: string, sources: RsoParticipationSources) => {
      const starRows = admit([revisionWith({ state: "confirmed_out", event_type: "INJURY_OUT" })], at, ctx(sources)).forecasts
        .filter(row => row.gameId === String(G1.id)).map(bindFixtureForecast);
      const depthRow = bindFixtureForecast({ ...starRows[0], playerId: "8", stats: { GOALS: 0.2, ASSISTS: 0.3, SHOTS_ON_GOAL: 2 },
        conditionalStats: undefined, appearanceProbability: null, limitations: [], issuedContext: { ...starRows[0].issuedContext!, playerId: "8", nhlPlayerId: 847002 } });
      const snapshot = { id: "fixture", context: { provider: "manual", seasonId: 20262027, leagueId: "l", teamId: "t", startDate: G1.date,
        endDate: G1.date, timeZone: "UTC", asOf: at }, players: [star, depth], games: games.filter(game => game.id === String(G1.id)),
        forecasts: [...starRows, depthRow], roster: [{ playerId: "7", position: "active" }, { playerId: "8", position: "bench" }],
        rules: { lineupMode: "daily", rosterSlots: { C: 1, BN: 1 }, acquisitionTiming: "same_day", acquisitionCost: 1, periods: [],
          scoring: { mode: "points", weights, categories: [] }, goalieMinimum: { required: null, credited: null, counts: "unknown", penalty: "none" }, unsupported: [] },
        lockedAssignments: [], realized: {}, opponent: null,
        evidence: { schedule: { source: "fixture", asOf: at, seasonId: 20262027, completeness: "complete", limitations: [] } } } as unknown as PlanningSnapshot;
      const plan = evaluatePlan(snapshot, intent, "outcome", [], false);
      return { active: plan.assignments.filter(item => item.gameId === String(G1.id)).map(item => item.playerId), projected: plan.projectedValue };
    };
    const confirmed = news("fictional-return", "availability", "return", true, "2026-10-10T14:30:00Z");
    const scratch = event(31, "SCRATCH", "2026-10-10T17:30:00Z", { game_id: G1.id });
    const lineups = {
      injured: lineupAt("2026-10-10T12:00:00Z", sourcesOf("2026-10-10T12:00:00Z")),
      confirmedReturn: lineupAt("2026-10-10T15:00:00Z", sourcesOf("2026-10-10T15:00:00Z", { news: [confirmed] })),
      lateScratch: lineupAt("2026-10-10T18:00:00Z", sourcesOf("2026-10-10T18:00:00Z", { events: [scratch], news: [confirmed] })),
    };
    table.push({ step: "planner lineup (fixture review, 1 C slot: injured star vs depth 2.2)", lineups });
    expect(lineups.injured.active).toEqual(["8"]);
    expect(lineups.confirmedReturn.active).toEqual(["7"]);
    expect(lineups.lateScratch.active).toEqual(["8"]);
  });

  it("a newer injury or exclusion overrides a confirmed return; a roster RETURN counts only for the team's next game", () => {
    const at = "2026-10-10T20:00:00Z";
    const issued = revisionWith({ state: "confirmed_out", event_type: "INJURY_OUT" });
    const confirmed = news("fictional-return", "ev", "L1", true, "2026-10-10T14:30:00Z");
    expect(record("confirmed return, then a newer injury", [issued], at, ctx(sourcesOf(at, { news: [confirmed],
      events: [event(41, "DTD", "2026-10-10T18:00:00Z", { category: "INJURY" }, "2026-10-12T00:00:00Z")] })))).toMatchObject({ basis: "assumed_out", goals: 0 });
    expect(record("confirmed return, then a suspension", [issued], at, ctx(sourcesOf(at, { news: [confirmed],
      events: [event(42, "SUSPENSION", "2026-10-10T18:00:00Z", { category: "TRANSACTION" }, "2026-10-12T00:00:00Z")] })))).toMatchObject({ basis: "confirmed_out" });
    // A confirmed (non-projected) roster RETURN is "confirmed back" for the team's first game after the report only.
    const rosterReturn = event(51, "RETURN", "2026-10-10T13:00:00Z", { category: "RETURN", subcategory: "RETURNING" }, "2026-10-11T19:00:00Z");
    expect(record("confirmed roster RETURN, next game", [issued], at, ctx(sourcesOf(at, { events: [rosterReturn] })))).toMatchObject({
      basis: "confirmed_playing", goals: 0.4 });
    const later = revisionWith({ state: "confirmed_out", event_type: "INJURY_OUT" }, { id: "rev-g2", game: G2 });
    const g2At = "2026-10-11T12:00:00Z";
    expect(record("confirmed roster RETURN, a later game (expired, earlier game between)", [later], g2At,
      ctx(sourcesOf(g2At, { events: [{ ...rosterReturn, effective_to: null }] })), G2.id)).toMatchObject({ basis: "assumed_out", goals: 0 });
  });

  it("an official appearance after the injury lifts it for later games only, never retroactively", () => {
    const played: OverlayAppearance = { id: 9001, player_id: NHL, date: G1.date, games_played: 1, toi_per_game: 17.5 };
    const g1At = "2026-10-10T22:00:00Z", g2At = "2026-10-11T12:00:00Z";
    expect(record("appearance on G1 date, forecast for G1 itself", [revisionWith({ state: "confirmed_out", event_type: "INJURY_OUT" })], g1At,
      ctx(sourcesOf(g1At, { appearances: [played] })))).toMatchObject({ basis: "assumed_out", goals: 0, changes: [] });
    expect(record("appearance on G1, forecast for later game G2", [revisionWith({ state: "confirmed_out", event_type: "INJURY_OUT" }, { id: "rev-g2", game: G2 })],
      g2At, ctx(sourcesOf(g2At, { appearances: [played] })), G2.id)).toMatchObject({ basis: "assumed_playing", goals: 0.4,
      changes: [expect.stringContaining("official appearance 2026-10-10 (wgo_skater_stats 9001)")], servedUnderFixtureReview: { points: 4.1 } });
    // A 0-minute row is not an appearance.
    expect(record("0-minute row is not an appearance", [revisionWith({ state: "confirmed_out", event_type: "INJURY_OUT" }, { id: "rev-g2", game: G2 })],
      g2At, ctx(sourcesOf(g2At, { appearances: [{ ...played, games_played: 0, toi_per_game: 0 }] })), G2.id)).toMatchObject({ basis: "assumed_out" });
  });

  it("conflicting reports keep the latest applicable status, labelled", () => {
    const at = "2026-10-10T12:00:00Z";
    expect(record("healthy, conflicting reports", [revisionWith({ state: "projected_lineup" })], at, ctx(sourcesOf(at, { conflicts: ["availability"] }))))
      .toMatchObject({ basis: "assumed_playing", goals: 0.4, notes: [DETAILED_PARTICIPATION_CONFLICT_NOTE] });
    expect(record("injured, conflicting reports", [revisionWith({ state: "uncertain", event_type: "DTD" })], at, ctx(sourcesOf(at, { conflicts: ["ev"] }))))
      .toMatchObject({ basis: "assumed_out", goals: 0, notes: [DETAILED_PARTICIPATION_CONFLICT_NOTE] });
  });

  it("stale reports: another game's report, a report older than the injury, and an expired revision serve or clear nothing", () => {
    const at = "2026-10-10T15:00:00Z";
    const injured = revisionWith({ state: "confirmed_out", event_type: "INJURY_OUT" });
    expect(record("stale: return news for another game", [injured], at, ctx(sourcesOf(at, {
      news: [news("fictional-g2", "availability", "return", true, "2026-10-10T14:00:00Z", G2.id)] })))).toMatchObject({ basis: "assumed_out", changes: [] });
    expect(record("stale: scratch for another game", [revisionWith({ state: "projected_lineup" })], at, ctx(sourcesOf(at, {
      events: [event(61, "SCRATCH", "2026-10-10T13:00:00Z", { game_id: G2.id })] })))).toMatchObject({ basis: "assumed_playing" });
    expect(record("stale: lineup report older than the injury", [injured], at, ctx(sourcesOf(at, {
      news: [news("fictional-old", "ev", "L1", true, "2026-10-07T18:00:00Z")] })))).toMatchObject({ basis: "assumed_out",
      changes: [expect.stringContaining("older than the injury it would clear; ignored")] });
    expect(record("stale: expired revision (puck drop)", [revisionWith({ state: "projected_lineup" })], G1.start,
      ctx(sourcesOf(G1.start)))).toMatchObject({ basis: null, excluded: ["stale_source"] });
  });

  it("news after the cutoff keeps the skater row (overlay) but withdraws goalie rows; unread sources withhold policy rows", async () => {
    const at = "2026-10-10T15:00:00Z";
    overlay.newsLatest.set(G1.id, "2026-10-10T14:30:00Z");
    overlay.sources = sourcesOf(at, { news: [news("fictional-return", "ev", "L1", true, "2026-10-10T14:30:00Z")] });
    const exclusions: ForecastDiscoveryExclusion[] = [];
    const result = await admitConsumerGameRevisions({} as never, [revisionWith({ state: "confirmed_out", event_type: "INJURY_OUT" }, { goalie: true })],
      [skater], games, new Date(at), 20262027, {}, exclusions, Date.now() + 2000, undefined, RSO_ASSUMED_PARTICIPATION_POLICY);
    expect(result.forecasts.map(row => [row.playerId, detailedParticipationBasisOf(row)])).toEqual([["7", "confirmed_playing"]]);
    expect(exclusions).toContainEqual({ gameId: String(G1.id), reasons: ["stale_source"] });
    overlay.fail = true;
    const withheld: ForecastDiscoveryExclusion[] = [];
    const failed = await admitConsumerGameRevisions({} as never, [revisionWith({ state: "projected_lineup" })], [skater], games, new Date(at),
      20262027, {}, withheld, Date.now() + 2000, undefined, RSO_ASSUMED_PARTICIPATION_POLICY);
    expect(failed.forecasts).toEqual([]);
    expect(withheld).toContainEqual({ gameId: String(G1.id), playerId: "7", reasons: ["incomplete_refresh"] });
    table.push({ step: "overlay sources unreadable", excluded: ["incomplete_refresh"], servedCurrentCatalog: { points: null, reason: "incomplete_refresh" },
      servedUnderFixtureReview: { points: null, reason: "incomplete_refresh" } });
  });
});
