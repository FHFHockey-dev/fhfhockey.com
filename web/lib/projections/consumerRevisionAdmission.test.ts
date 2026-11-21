import { afterAll, afterEach, describe, expect, it, vi } from "vitest";
import { forecastCalendarPolicy } from "lib/player-forecasts/contributions";
import { bindFixtureForecast, fixtureRsoPolicy } from "lib/player-forecasts/rsoUsePolicy.fixtures";
import { currentRsoUsePolicy, restrictRsoForecast } from "lib/player-forecasts/rsoUsePolicy";
import { normalizePlanningGames } from "lib/rosterScheduleData/planningInputs";
import { forecastAllows, gameForecastPoints } from "lib/rosterScheduleOptimizer/planning";
import type { ForecastDiscoveryExclusion, GameForecast, PlanningGame, PlanningPlayer, PlanningSnapshot } from "lib/rosterScheduleOptimizer/planningTypes";
import type { ForgeGameRevision } from "./gameRevisions";
import { FORGE_EXTERNAL_FANTASY_INPUT_CONTRACT } from "./calibrationEligibility";
import { forgeRosterRevision, forgeScheduleRevision, type ForgeIssuedContextV1 } from "./issuedContext";
import { buildNativeSkaterParticipationFields } from "./nativeGoalAccounting";
import { admitConsumerGameRevisions, DETAILED_PARTICIPATION_CONFLICT_NOTE, DETAILED_PARTICIPATION_RETURN_NOTE, detailedParticipationBasisOf,
  publicPlanningForecasts, RSO_ASSUMED_PARTICIPATION_POLICY, type DetailedParticipationPolicy } from "./consumerRevisionAdmission";

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

// ---- TJ's Detailed RSO participation policy (2026-11-21). Fictional fixtures; never provider observations. ----
const news = vi.hoisted(() => ({ latest: new Map<number, string>() }));
vi.mock("./acceptedNews", async importOriginal => ({ ...(await importOriginal<typeof import("./acceptedNews")>()),
  loadAcceptedForecastNews: vi.fn(async () => ({ revisionHash: "news-hash", latestAcceptedAt: news.latest })) }));

describe("Detailed RSO participation policy (TJ 2026-11-21)", () => {
  const GAME = 2026020001, TEAM = 1, NHL = 847001, CUTOFF = "2026-10-10T10:00:00Z";
  const now = new Date("2026-10-10T12:00:00Z");
  const membershipCreatedAt = ["2026-09-01T00:00:00Z"];
  const rosterRevision = forgeRosterRevision({ canonicalId: 7, nhlId: NHL, seasonId: 20262027, teamId: TEAM, membershipCreatedAt });
  const skater = { id: "7", nhlId: NHL, nhlTeamId: TEAM, rosterRevision, name: "Skater", playerClass: "skater", teamAbbreviation: "TOR",
    eligiblePositions: ["C"], availability: "unknown", ownership: null, canDrop: null, holdValue: null, reserveEligibility: [] } as PlanningPlayer;
  const games = normalizePlanningGames([{ id: 1, source_game_id: GAME, source_season_id: 20262027, game_date: "2026-10-10",
    start_time: "2026-10-10T23:00:00Z", team_abbreviation: "TOR", opponent_abbreviation: "MTL", home_away: "home", game_status: "FUT",
    schedule_status: "OK", is_countable: true, game_type: 2 }]);
  const side = (teamId: number, opp: number, abbr: string, oppAbbr: string) => ({ gameKey: "nhl", season: "2026", sourceSeasonId: 20262027,
    teamId, opponentTeamId: opp, teamAbbreviation: abbr, opponentAbbreviation: oppAbbr, startTime: "2026-10-10T23:00:00Z", gameStatus: "FUT",
    scheduleStatus: "OK", sourceUpdatedAt: null, fetchedAt: "2026-10-10T09:00:00Z", revision: forgeScheduleRevision({ source_game_id: GAME,
      start_time: "2026-10-10T23:00:00Z", team_abbreviation: abbr, opponent_abbreviation: oppAbbr, game_status: "FUT", schedule_status: "OK" }) });
  const issuedContext = { version: "forge-issued-context-v1", game: { id: GAME, date: "2026-10-10", seasonId: 20262027,
    startTime: "2026-10-10T23:00:00Z", homeTeamId: 1, awayTeamId: 2 }, schedule: [side(1, 2, "TOR", "MTL"), side(2, 1, "MTL", "TOR")],
    roster: [{ canonicalId: 7, nhlId: NHL, seasonId: 20262027, teamId: TEAM, membershipCreatedAt, identityUpdatedAt: "2026-09-01T00:00:00Z",
      revision: rosterRevision }], observedAt: "2026-10-10T09:00:00Z" } as ForgeIssuedContextV1;
  // His "if he plays" line: 0.4 G, 0.7 A, 3 SOG = 4.1 points at the hosted reader's weights.
  const LINE = { proj_goals_es: 0.3, proj_goals_pp: 0.1, proj_goals_pk: 0, proj_assists_es: 0.5, proj_assists_pp: 0.2, proj_assists_pk: 0,
    proj_shots_es: 2.5, proj_shots_pp: 0.5, proj_shots_pk: 0 };
  type Coverage = { state: "projected_lineup" | "confirmed_out" | "uncertain" | "unknown"; event_type?: string | null };
  type Assertion = { dimension: "ev" | "pp" | "availability"; value: string; confirmed: boolean; receivedAt?: string };
  const evidenceOf = (assertions: Assertion[], conflicts: string[] = []) => ({ informationCutoffAt: CUTOFF,
    assertions: assertions.map((item, index) => ({ gameId: GAME, teamId: TEAM, playerId: NHL, dimension: item.dimension, value: item.value,
      evidenceId: `fictional-${index}`, sourceKey: "fictional-source", sourceUrl: null, publishedAt: "2026-10-10T09:00:00Z",
      receivedAt: item.receivedAt ?? "2026-10-10T09:01:00Z", confirmed: item.confirmed })),
    conflicts: conflicts.map(dimension => ({ gameId: GAME, teamId: TEAM, playerId: NHL, dimension, evidenceIds: ["fictional-0", "fictional-x"] })) });
  const revisionWith = (coverage: Coverage, options: { id?: string; published?: string; cutoff?: string; assertions?: Assertion[]; conflicts?: string[] } = {}) => {
    const cutoff = options.cutoff ?? CUTOFF;
    const evidence = { ...evidenceOf(options.assertions ?? [], options.conflicts), informationCutoffAt: cutoff };
    const selection = buildNativeSkaterParticipationFields({ gameId: GAME, teamId: TEAM, playerId: NHL, compute: true, evidence });
    return { id: options.id ?? "rev-a", run_id: "run-a", game_id: GAME, decision_as_of: cutoff, published_at: options.published ?? cutoff,
      payload: { teams: [], goalies: [], codeVersion: "code-v1", evidence,
        players: [{ game_id: GAME, team_id: TEAM, player_id: NHL, horizon_games: 1, as_of_date: "2026-10-10", run_id: "run-a", ...LINE,
          uncertainty: { model: { skater_selection: selection }, availability: { version: "forge-skater-coverage-v1", game_id: GAME,
            state: coverage.state, line_conditioning: "if_plays", expected_for_game: coverage.state === "confirmed_out" ? 0 : null,
            participation_probability: null, participation_qualified: false, label: "fictional", event_type: coverage.event_type ?? null,
            event_id: coverage.event_type ? 11 : null } } }],
        inputProvenance: { external_fantasy_input_contract: FORGE_EXTERNAL_FANTASY_INPUT_CONTRACT, capturedReads: { version: "forge-captured-reads-v1",
          hash: "a".repeat(64), readCount: 2, firstReceivedAt: "2026-10-10T09:00:00Z", lastReceivedAt: "2026-10-10T09:01:00Z" },
          issuedContexts: [issuedContext] } } } as unknown as ForgeGameRevision;
  };
  const admit = (revisions: ForgeGameRevision[], policy: DetailedParticipationPolicy | null = RSO_ASSUMED_PARTICIPATION_POLICY, at = now) => {
    const exclusionRows: ForecastDiscoveryExclusion[] = [];
    const forecasts = publicPlanningForecasts(revisions, [skater], games, at, {}, exclusionRows, undefined, undefined, new Map(), policy ?? undefined);
    return { forecasts, exclusionRows };
  };
  // What Detailed serves: admission → RSO use restriction → the hosted reader's own allows/points readback (score()).
  const weights = { GOALS: 3, ASSISTS: 2, SHOTS_ON_GOAL: 0.5 };
  // With no admitted row, Detailed serves the row's own admission exclusion.
  const served = (row: GameForecast | undefined, reviewed: boolean, excluded: ForecastDiscoveryExclusion[] = []) => {
    if (!row) return { points: null, reason: excluded.find(item => !item.targetKey)?.reasons[0] ?? "no_usable_target" };
    const policy = reviewed ? fixtureRsoPolicy(["code-v1"], Object.keys(row.stats)) : currentRsoUsePolicy();
    const restricted = restrictRsoForecast(reviewed ? bindFixtureForecast(row) : row, undefined, now.toISOString(), policy);
    if (!Object.keys(weights).every(key => (["assignment", "totals", "comparison"] as const).every(use => forecastAllows(restricted, key, use)))) {
      return { points: null, reason: "use_not_approved" };
    }
    const snapshot = { players: [skater], forecasts: [restricted], games, context: { asOf: now.toISOString() },
      rules: { scoring: { mode: "points", weights, categories: [] } } } as unknown as PlanningSnapshot;
    const points = gameForecastPoints(snapshot, restricted).expected;
    return { points: points === null ? null : Number(points.toFixed(4)), reason: points === null ? "missing_target" : null };
  };
  const table: Array<Record<string, unknown>> = [];
  const record = (testCase: string, revisions: ForgeGameRevision[], at = now) => {
    const { forecasts, exclusionRows } = admit(revisions, RSO_ASSUMED_PARTICIPATION_POLICY, at);
    const row = forecasts[0];
    const entry = { case: testCase, revision: row?.revisionId ?? null, issuedAt: row?.issuedAt ?? null,
      basis: row ? detailedParticipationBasisOf(row) : null, appearance: row?.appearanceProbability ?? null,
      goals: row?.stats.GOALS ?? null, ifPlaysGoals: row?.conditionalStats?.GOALS ?? null,
      notes: row?.limitations.filter(note => note === DETAILED_PARTICIPATION_CONFLICT_NOTE || note === DETAILED_PARTICIPATION_RETURN_NOTE) ?? [],
      excluded: exclusionRows.map(item => item.reasons[0]),
      servedCurrentCatalog: served(row, false, exclusionRows), servedUnderFixtureReview: served(row, true, exclusionRows) };
    table.push(entry);
    return entry;
  };
  afterEach(() => { news.latest.clear(); });
  afterAll(() => { console.log(`PARTICIPATION_TABLE ${JSON.stringify(table)}`); });

  it("keeps decisions 3/47 when the policy is off (start chart and other consumers)", () => {
    const { forecasts, exclusionRows } = admit([revisionWith({ state: "projected_lineup" })], null);
    expect(forecasts).toEqual([]);
    expect(exclusionRows).toContainEqual({ gameId: String(GAME), playerId: "7", reasons: ["missing_participation"] });
  });

  it("1 healthy, no news: assumed playing, counts his full line, labelled assumed", () => {
    expect(record("healthy, in projected lineup", [revisionWith({ state: "projected_lineup" })])).toMatchObject({
      basis: "assumed_playing", appearance: 1, goals: 0.4, ifPlaysGoals: 0.4,
      servedCurrentCatalog: { reason: "use_not_approved" }, servedUnderFixtureReview: { points: 4.1, reason: null } });
    // Off the projected lineup but on the active roster with no injury: the same healthy default.
    expect(record("healthy, outside projected lineup", [revisionWith({ state: "unknown" })])).toMatchObject({
      basis: "assumed_playing", servedUnderFixtureReview: { points: 4.1 } });
    // A reported return with nothing confirmed for this game stays an assumption, labelled as such.
    expect(record("return reported, unconfirmed", [revisionWith({ state: "unknown", event_type: "RETURN" })])).toMatchObject({
      basis: "assumed_playing", notes: [DETAILED_PARTICIPATION_RETURN_NOTE] });
  });

  it("2 injured, no update: assumed out (0) and a projected line, PP role or unconfirmed return news does not clear it", () => {
    expect(record("injured DTD, no news", [revisionWith({ state: "uncertain", event_type: "DTD" })])).toMatchObject({
      basis: "assumed_out", appearance: 0, goals: 0, ifPlaysGoals: 0.4, servedUnderFixtureReview: { points: 0 } });
    expect(record("injured IR, no news", [revisionWith({ state: "confirmed_out", event_type: "IR" })])).toMatchObject({
      basis: "assumed_out", appearance: 0, goals: 0 });
    expect(record("injured, projected line + PP + practice return (unconfirmed)", [revisionWith({ state: "uncertain", event_type: "DTD" },
      { assertions: [{ dimension: "ev", value: "L2", confirmed: false }, { dimension: "pp", value: "PP1", confirmed: true },
        { dimension: "availability", value: "available", confirmed: false }] })])).toMatchObject({ basis: "assumed_out", goals: 0 });
  });

  it("3 confirmed return: accepted lineup news for this game makes him confirmed playing", () => {
    expect(record("injured, confirmed in lineup", [revisionWith({ state: "confirmed_out", event_type: "INJURY_OUT" },
      { assertions: [{ dimension: "ev", value: "L1", confirmed: true }] })])).toMatchObject({
      basis: "confirmed_playing", appearance: 1, goals: 0.4, servedUnderFixtureReview: { points: 4.1 } });
  });

  it("4 late scratch: withdraws the assumed row, then a new timestamped revision confirms him out; the original is never rewritten", async () => {
    const early = revisionWith({ state: "projected_lineup" }, { id: "rev-early" });
    const original = structuredClone(early);
    expect(record("late scratch: early forecast", [early])).toMatchObject({ basis: "assumed_playing", revision: "rev-early" });
    // Accepted scratch news after the early cutoff: the early revision is withdrawn until a new one is issued.
    news.latest.set(GAME, "2026-10-10T11:00:00Z");
    const exclusions: ForecastDiscoveryExclusion[] = [];
    const withdrawn = await admitConsumerGameRevisions({} as never, [early], [skater], games, now, 20262027, {}, exclusions,
      Date.now() + 2000, undefined, RSO_ASSUMED_PARTICIPATION_POLICY);
    expect(withdrawn.forecasts).toEqual([]);
    expect(exclusions).toContainEqual({ gameId: String(GAME), reasons: ["stale_source"] });
    table.push({ case: "late scratch: news after early cutoff", revision: "rev-early (withdrawn)", basis: null, excluded: exclusions.map(item => item.reasons[0]),
      servedCurrentCatalog: served(withdrawn.forecasts[0], false, exclusions), servedUnderFixtureReview: served(withdrawn.forecasts[0], true, exclusions) });
    // The next issued revision carries the scratch (roster event and accepted news) with a later issuedAt and replaces it.
    const late = revisionWith({ state: "confirmed_out", event_type: "SCRATCH" }, { id: "rev-late", published: "2026-10-10T11:30:00Z",
      cutoff: "2026-10-10T11:30:00Z", assertions: [{ dimension: "availability", value: "out", confirmed: true, receivedAt: "2026-10-10T11:01:00Z" }] });
    news.latest.set(GAME, "2026-10-10T11:00:00Z");
    const next = await admitConsumerGameRevisions({} as never, [early, late], [skater], games, now, 20262027, {}, [],
      Date.now() + 2000, undefined, RSO_ASSUMED_PARTICIPATION_POLICY);
    expect(next.forecasts).toHaveLength(1);
    expect(next.forecasts[0]).toMatchObject({ revisionId: "rev-late", issuedAt: "2026-10-10T11:30:00Z", appearanceProbability: 0, stats: { GOALS: 0 } });
    expect(detailedParticipationBasisOf(next.forecasts[0])).toBe("confirmed_out");
    expect(record("late scratch: new revision", [early, late])).toMatchObject({ basis: "confirmed_out", revision: "rev-late", goals: 0 });
    expect(early).toEqual(original);
    // A roster scratch with no news is a confirmed exclusion that overrides the healthy default, even beside a projected line.
    expect(record("roster scratch + projected line", [revisionWith({ state: "confirmed_out", event_type: "SCRATCH" },
      { assertions: [{ dimension: "ev", value: "L3", confirmed: false }] })])).toMatchObject({ basis: "confirmed_out", goals: 0 });
  });

  it("5 conflicting reports: the roster-status default stands, labelled as conflicting", () => {
    expect(record("healthy, conflicting reports", [revisionWith({ state: "projected_lineup" }, { conflicts: ["availability"] })])).toMatchObject({
      basis: "assumed_playing", goals: 0.4, notes: [DETAILED_PARTICIPATION_CONFLICT_NOTE] });
    expect(record("injured, conflicting reports", [revisionWith({ state: "uncertain", event_type: "DTD" },
      { assertions: [{ dimension: "ev", value: "L1", confirmed: true }], conflicts: ["ev"] })])).toMatchObject({
      basis: "assumed_out", goals: 0, notes: [DETAILED_PARTICIPATION_CONFLICT_NOTE] });
  });

  it("6 stale reports: nothing past the forecast's freshness is served or confirms", () => {
    // Expired: at puck drop the revision is stale; no assumed row survives it.
    expect(record("stale: expired revision", [revisionWith({ state: "projected_lineup" })], new Date("2026-10-10T23:00:00Z"))).toMatchObject({
      basis: null, excluded: ["stale_source"], servedUnderFixtureReview: { reason: "stale_source" } });
    // Received after the forecast's cutoff: a lineup confirmation cannot confirm a forecast issued before it arrived.
    expect(record("stale: return confirmation received after cutoff", [revisionWith({ state: "uncertain", event_type: "DTD" },
      { assertions: [{ dimension: "ev", value: "L1", confirmed: true, receivedAt: "2026-10-10T10:00:00.000001Z" }] })])).toMatchObject({
      basis: "assumed_out", goals: 0 });
    // Coverage issued for a different game says nothing about this one: no roster status to assume from.
    const other = revisionWith({ state: "confirmed_out", event_type: "SCRATCH" });
    (other.payload.players[0] as any).uncertainty.availability.game_id = GAME + 1;
    expect(record("stale: exclusion for another game", [other])).toMatchObject({ basis: null, excluded: ["missing_participation"],
      servedUnderFixtureReview: { reason: "missing_participation" } });
    // An unrecognised coverage state is no roster status either.
    const odd = revisionWith({ state: "projected_lineup" });
    (odd.payload.players[0] as any).uncertainty.availability.state = "rumoured";
    expect(admit([odd]).forecasts).toEqual([]);
  });
});
