// @vitest-environment node
import { describe, expect, it, vi } from "vitest";
import { resolveDailyBoardEvidence, type BoardConflict, type BoardGoalieEvidence } from "lib/projections/dailyBoardEvidence";
import { GOALIE_INVENTORY_VERSION, type GoalieInventory, type LoadGoalieInventory, type SearchGoalieInventory } from "./goalieInventory";
import { FIXTURE_GENERATED_AT, FIXTURE_INPUT, FIXTURE_TEAMS, GOALIE_INVENTORY_FIXTURE } from "./goalieInventory.fixture";
import { admitStartParticipation, buildGoalieInventory, buildTeamLenses, CONFIRMATION_ABSENT_NOTE, CONFIRMATION_CLOSED_REASON, CONFIRMATION_LINK_GAP, CONFIRMATION_REPORTER_GAP, confirmationFreshness, confirmationLabel, FORECAST_CLOSED_REASON, INVENTORY_OBSERVATION_COLUMNS, inventoryWindow, loadGoalieInventory, loadGoalieInventoryDetail, mapBoardEvidence, observationGaps, searchGoalieInventory, type InventoryForecastInput , headToHeadWinner, strengthRank, strengthShare, type TeamLensMetric } from "./goalieInventory.sources";

vi.mock("lib/supabase/public-client", () => ({ default: { from: () => { throw new Error("The inventory test must never reach Supabase."); } } }));
const serverRead = vi.hoisted(() => ({ tables: [] as string[], from: null as null | ((table: string) => unknown) }));
vi.mock("lib/supabase/server", () => ({ default: { from: (table: string) => { serverRead.tables.push(table); if (!serverRead.from) throw new Error("No server client in this test."); return serverRead.from(table); } } }));

const entry = (inventory: GoalieInventory, goalieId: number) => inventory.goalies.find(goalie => goalie.goalieId === goalieId)!;
const game = (inventory: GoalieInventory, goalieId: number, gameId: number) => entry(inventory, goalieId).games.find(row => row.gameId === gameId)!;
const lensInput = { teamGames: FIXTURE_INPUT.teamGames, nst: FIXTURE_INPUT.nst, teams: FIXTURE_TEAMS, season: 20262027, cutoff: "2026-11-01" };

describe("inventory mapping (11.1)", () => {
  it("is type-conformant and carries the frozen version", () => {
    const load: LoadGoalieInventory = loadGoalieInventory, search: SearchGoalieInventory = searchGoalieInventory;
    expect([typeof load, typeof search]).toEqual(["function", "function"]);
    expect(GOALIE_INVENTORY_FIXTURE.version).toBe(GOALIE_INVENTORY_VERSION);
    expect(GOALIE_INVENTORY_FIXTURE.state).toBe("ready");
    expect(GOALIE_INVENTORY_FIXTURE.goalies.map(goalie => goalie.goalieId)).toEqual([7004, 7001, 7002, 7003, 7005, 7006]);
  });
  it("gives none for an absent observation, and says it is not 'not starting'", () => {
    const row = game(GOALIE_INVENTORY_FIXTURE, 7002, 900010);
    expect(row.confirmation).toEqual({ state: "none", source: null, observedAt: null, expiresAt: null, sourceUrl: null });
    expect(GOALIE_INVENTORY_FIXTURE.reasons.join(" ")).toContain(CONFIRMATION_ABSENT_NOTE);
  });
  it("gives unavailable for a raw probability", () => {
    expect(game(GOALIE_INVENTORY_FIXTURE, 7005, 900011).forecast).toEqual({ state: "unavailable", reason: "A raw start probability is not an admitted forecast." });
  });
  it("reports a closed confirmation source as none with its reason, and no forecast input as unavailable", () => {
    const { inventory } = buildGoalieInventory({ ...FIXTURE_INPUT, confirmations: null, forecasts: null });
    expect(inventory.state).toBe("ready");
    expect(inventory.goalies.flatMap(goalie => goalie.games).every(row => row.confirmation.state === "none" && row.forecast.state === "unavailable")).toBe(true);
    expect(inventory.reasons).toEqual(expect.arrayContaining([CONFIRMATION_CLOSED_REASON, FORECAST_CLOSED_REASON]));
    expect(inventory.sources.find(source => source.tables.includes("player_forecast_goalie_start_observations"))?.state).toBe("blocked");
  });
  it("counts start share over team games, keeps relief apart and never calls it a probability", () => {
    expect(entry(GOALIE_INVENTORY_FIXTURE, 7001).recentStarts).toEqual({ window: "L10", teamGames: 2, starts: 2, reliefAppearances: 0, share: 1, complete: true });
    expect(entry(GOALIE_INVENTORY_FIXTURE, 7002).recentStarts).toMatchObject({ starts: 0, reliefAppearances: 1, share: 0 });
    expect(entry(GOALIE_INVENTORY_FIXTURE, 7005).recentStarts.share).toBe(0.5);
  });
  it("nulls shares and goes partial when a window game has no labeled starter", () => {
    const appearances = FIXTURE_INPUT.appearances.map(row => row.goalieId === 7003 && row.gameId === 900004 ? { ...row, started: null } : row);
    const { inventory } = buildGoalieInventory({ ...FIXTURE_INPUT, appearances });
    expect(inventory.state).toBe("partial");
    expect(entry(inventory, 7003).recentStarts).toMatchObject({ starts: null, share: null, complete: false });
  });
  it("lists a traded goalie only with the team of their latest game", () => {
    const moved = { ...FIXTURE_INPUT.appearances[0], goalieId: 7009, name: "Moved Goalie", team: "NJD", gameId: 900001, started: false };
    const later = { ...moved, team: "TOR", gameId: 900004, date: "2026-11-01" };
    const { inventory } = buildGoalieInventory({ ...FIXTURE_INPUT, appearances: [...FIXTURE_INPUT.appearances, moved, later] });
    expect(inventory.goalies.filter(goalie => goalie.goalieId === 7009).map(goalie => goalie.team)).toEqual(["TOR"]);
  });
  it("states back-to-backs from the schedule, and unknown before the read began", () => {
    expect(game(GOALIE_INVENTORY_FIXTURE, 7003, 900010)).toMatchObject({ teamSecondNight: true, opponentSecondNight: true });
    expect(game(GOALIE_INVENTORY_FIXTURE, 7001, 900012)).toMatchObject({ teamSecondNight: false, opponentSecondNight: false });
    const { inventory } = buildGoalieInventory({ ...FIXTURE_INPUT, scheduleFrom: "2026-11-03" });
    expect(game(inventory, 7001, 900010).teamSecondNight).toBeNull();
  });
  it("is partial when a past scheduled game has no reported result", () => {
    const { inventory, coverage } = buildGoalieInventory({ ...FIXTURE_INPUT, schedule: [...FIXTURE_INPUT.schedule, { id: 900005, date: "2026-10-31", startTime: null, homeTeamId: 1, awayTeamId: 2 }] });
    expect(inventory.state).toBe("partial");
    expect(coverage).toEqual({ observed: 8, expected: 10, missing: 2 });
  });
  it("derives its window from the New York date and season", () => {
    expect(inventoryWindow("2026-11-01T02:00:00Z", 7)).toEqual({ from: "2026-10-31", through: "2026-11-06", season: 20262027 });
  });
});

describe("lens metrics (11.2)", () => {
  it("pools rates from counts instead of averaging game rates", () => {
    const { lenses } = buildTeamLenses(lensInput), njd = lenses.get("NJD")!;
    // NJD PP: 2 of 4, then 1 of 3. Pooled 3/7, not the mean of 50% and 33%.
    expect(njd.powerPlayPct.value).toBeCloseTo(300 / 7, 6);
    expect(njd.powerPlayPct.sampleGames).toBe(2);
    // NJD shorthanded 2 + 4 = 6 with 0 + 1 = 1 goal against.
    expect(njd.penaltyKillPct.value).toBeCloseTo(500 / 6, 6);
    expect(njd.timesShorthanded.value).toBe(3);
    expect(njd.shotsFor.value).toBe(32);
    expect(njd.goalDifferential.value).toBe(1.5);
    expect(njd.goalsFor).toMatchObject({ unit: "goals per game", window: "Season to date" });
  });
  it("keeps a zero denominator unknown and a known zero as a value", () => {
    const zeroPp = lensInput.teamGames.map(row => ({ ...row, pp_opportunities: 0, power_play_goals_for: 0 }));
    expect(buildTeamLenses({ ...lensInput, teamGames: zeroPp }).lenses.get("NJD")!.powerPlayPct.value).toBeNull();
    const noPpg = lensInput.teamGames.map(row => ({ ...row, power_play_goals_for: 0 }));
    expect(buildTeamLenses({ ...lensInput, teamGames: noPpg }).lenses.get("NJD")!.powerPlayPct.value).toBe(0);
  });
  it("ranks a complete population with ties shared, highest first", () => {
    const { lenses } = buildTeamLenses(lensInput);
    expect(FIXTURE_TEAMS.map(team => [team, lenses.get(team)!.shotsFor.leagueRank])).toEqual([["MTL", 4], ["NJD", 2], ["NYR", 3], ["TOR", 1]]);
    expect(lenses.get("TOR")!.shotsFor.leagueCohort).toBe(4);
    const tied = buildTeamLenses({ ...lensInput, nst: lensInput.nst.map(row => ({ ...row, sf: 30 })) });
    expect(FIXTURE_TEAMS.map(team => tied.lenses.get(team)!.shotsFor.leagueRank)).toEqual([1, 1, 1, 1]);
  });
  it("withholds ranks, league-wide, when any team lacks a game's value, and keeps the value", () => {
    const { lenses } = buildTeamLenses({ ...lensInput, nst: lensInput.nst.filter(row => !(row.team_abbreviation === "NYR" && row.date === "2026-11-01")) });
    for (const team of FIXTURE_TEAMS) expect(lenses.get(team)!.shotsFor).toMatchObject({ leagueRank: null, leagueCohort: null });
    expect(lenses.get("NYR")!.shotsFor).toMatchObject({ value: 25, sampleGames: 1 });
    // WGO values are a separate read and keep their ranks.
    expect(lenses.get("NYR")!.goalsFor.leagueRank).not.toBeNull();
  });
  it("withholds ranks when a null stat leaves a game out of the sample", () => {
    const { lenses } = buildTeamLenses({ ...lensInput, teamGames: lensInput.teamGames.map(row => row.team_id === 3 || row.game_id !== 900001 ? row : { ...row, goals_for: null }) });
    expect(lenses.get("NJD")!.goalsFor.leagueRank).toBeNull();
  });
  it("goes partial when NST lags WGO", () => {
    const { inventory } = buildGoalieInventory({ ...FIXTURE_INPUT, nst: FIXTURE_INPUT.nst.filter(row => row.date !== "2026-11-01") });
    expect(inventory.state).toBe("partial");
    expect(inventory.reasons[0]).toMatch(/NST team logs cover 4 of 8/);
  });
  it("keeps the three lenses separate with no score field", () => {
    const { signals } = game(GOALIE_INVENTORY_FIXTURE, 7001, 900010);
    expect(Object.keys(signals).sort()).toEqual(["ratioExposure", "volume", "winSupport"]);
    expect(JSON.stringify(GOALIE_INVENTORY_FIXTURE)).not.toMatch(/score|odds|composite|total/i);
  });
  it("reads each side from the right team", () => {
    const { lenses } = buildTeamLenses(lensInput), { signals } = game(GOALIE_INVENTORY_FIXTURE, 7001, 900010);
    expect(signals.volume.opponentShotsForPerGame).toEqual(lenses.get("NYR")!.shotsFor);
    expect(signals.volume.teamShotsAgainstPerGame).toEqual(lenses.get("NJD")!.shotsAgainst);
    expect(signals.winSupport.opponentGoalsAgainstPerGame).toEqual(lenses.get("NYR")!.goalsAgainst);
  });
});

describe("confirmation through the starter-board resolver", () => {
  const cutoff = FIXTURE_GENERATED_AT;
  // The shape the IFTTT pipeline writes: persistTweetProjectionReports -> capture_starter_board_goalies.
  const ifttt = (overrides: Partial<BoardGoalieEvidence> = {}): BoardGoalieEvidence => ({ id: "a", game_id: 900010, team_id: 1, player_id: 7001, observation_status: "confirmed", accepted: true, source_key: "validated_events", source_account: null, source_url: null, observed_at: "2026-11-02T10:00:00Z", available_at: "2026-11-02T10:05:00Z", created_at: "2026-11-02T10:06:00Z", expires_at: null, ...overrides });
  const resolve = (goalies: BoardGoalieEvidence[], conflicts: BoardConflict[] = []) => buildGoalieInventory({ ...FIXTURE_INPUT, confirmations: { evidence: resolveDailyBoardEvidence({ cutoff, lineups: [], goalies, conflicts }), expiresAt: new Map(goalies.map(row => [row.id, row.expires_at ?? null])) } });
  const state = (detail: ReturnType<typeof resolve>, goalieId = 7001) => game(detail.inventory, goalieId, 900010).confirmation.state;

  it("carries IFTTT-origin evidence with its source and freshness, and repeats do not count twice", () => {
    const detail = resolve([ifttt(), ifttt({ id: "b", observed_at: "2026-11-02T11:00:00Z", available_at: "2026-11-02T11:05:00Z", created_at: "2026-11-02T11:06:00Z" })]);
    const { confirmation } = game(detail.inventory, 7001, 900010);
    expect(confirmation).toEqual({ state: "confirmed", source: "validated_events", observedAt: "2026-11-02T11:00:00Z", expiresAt: null, sourceUrl: null });
    expect(detail.conflicts).toEqual([]);
    expect(confirmationFreshness(confirmation, cutoff)).toBe("4h ago");
    expect(state(resolve([ifttt({ observation_status: "projected" })]))).toBe("projected");
  });
  it("applies a correction: a reporter's later report replaces the earlier one, in any direction", () => {
    const later = { observed_at: "2026-11-02T12:00:00Z", available_at: "2026-11-02T12:05:00Z", created_at: "2026-11-02T12:06:00Z" };
    const switched = resolve([ifttt(), ifttt({ id: "b", player_id: 7002, ...later })]);
    expect([state(switched), state(switched, 7002)]).toEqual(["none", "confirmed"]);
    expect(switched.conflicts).toEqual([]);
    expect(state(resolve([ifttt(), ifttt({ id: "b", observation_status: "projected", ...later })]))).toBe("projected");
    expect(state(resolve([ifttt(), ifttt({ id: "b", observation_status: "ruled_out", ...later })]))).toBe("none");
  });
  it("drops stale and not-yet-known reports: expired, rejected, or later than the edition", () => {
    expect(state(resolve([ifttt({ expires_at: "2026-11-02T12:00:00Z" })]))).toBe("none");
    expect(state(resolve([ifttt({ accepted: false })]))).toBe("none");
    expect(state(resolve([ifttt({ available_at: "2026-11-02T20:00:00Z", created_at: "2026-11-02T20:00:00Z" })]))).toBe("none");
    const unexpired = game(resolve([ifttt({ expires_at: "2026-11-03T00:00:00Z" })]).inventory, 7001, 900010).confirmation;
    expect(unexpired).toMatchObject({ state: "confirmed", expiresAt: "2026-11-03T00:00:00Z" });
    // An old report with no expiry stays visible with its age: no staleness rule exists to retire it.
    const old = game(resolve([ifttt({ observed_at: "2026-10-30T10:00:00Z", available_at: "2026-10-30T10:05:00Z", created_at: "2026-10-30T10:06:00Z" })]).inventory, 7001, 900010).confirmation;
    expect(confirmationFreshness(old, cutoff)).toBe("3d ago");
  });
  it("shows two named reporters disagreeing as conflicting, unknown in v1", () => {
    const detail = resolve([ifttt({ source_account: "reporterA" }), ifttt({ id: "b", player_id: 7002, source_account: "reporterB", observed_at: "2026-11-02T10:05:00Z" })]);
    expect([state(detail), state(detail, 7002)]).toEqual(["none", "none"]);
    expect(detail.conflicts).toEqual([{ gameId: 900010, team: "NJD" }]);
    expect(detail.inventory.reasons.join(" ")).toMatch(/1 team game has conflicting/);
    expect(confirmationLabel(game(detail.inventory, 7001, 900010).confirmation, true)).toBe("Conflicting reports");
  });
  it("honors a persisted conflict and its review", () => {
    const review = (resolutions: BoardConflict["player_forecast_conflict_resolutions"]): BoardConflict => ({ id: "c", conflict_key: "goalie:900010:1", conflict_version: 1, game_id: 900010, team_id: 1, player_id: 7001, conflict_type: "goalie_start", detected_at: "2026-11-02T11:00:00Z", player_forecast_conflict_resolutions: resolutions });
    expect(resolve([ifttt()], [review([])]).conflicts).toHaveLength(1);
    const rows = [ifttt({ source_account: "reporterA" }), ifttt({ id: "b", player_id: 7002, source_account: "reporterB", observed_at: "2026-11-02T10:05:00Z" })];
    const selected = resolve(rows, [review([{ action: "select_observation", selected_observation_id: "a", resolved_at: "2026-11-02T12:00:00Z" }])]);
    expect([state(selected), selected.conflicts]).toEqual(["confirmed", []]);
  });
  it("keeps the live gap visible: rows with no account are one reporter, so no conflict can appear", () => {
    const detail = resolve([ifttt(), ifttt({ id: "b", player_id: 7002, observed_at: "2026-11-02T10:05:00Z" })]);
    expect(detail.conflicts).toEqual([]);
    expect(state(detail, 7002)).toBe("confirmed");
    expect(observationGaps([{ source_account: null, source_url: null, expires_at: null }])).toEqual([CONFIRMATION_REPORTER_GAP, CONFIRMATION_LINK_GAP]);
    expect(observationGaps([{ source_account: "named", source_url: "https://fixture.invalid/x", expires_at: null }])).toEqual([]);
    expect(observationGaps([])).toEqual([]);
  });
  it("dates the source in New York, like every other source, and keeps the exact time as its update", () => {
    const late = "2026-11-02T03:30:00+00:00";
    const source = (detail: ReturnType<typeof resolve>) => detail.inventory.sources.find(item => item.name === "Goalie start observations")!;
    expect(source(resolve([ifttt({ observed_at: late, available_at: late, created_at: late })]))).toMatchObject({ asOf: "2026-11-01", updatedAt: late });
    expect(source(resolve([]))).toMatchObject({ asOf: null, updatedAt: null });
  });
  it("treats no observation as unknown, with no claim to age", () => {
    const { confirmation } = game(resolve([]).inventory, 7001, 900010);
    expect(confirmation.state).toBe("none");
    expect([confirmationLabel(confirmation), confirmationFreshness(confirmation, cutoff)]).toEqual(["Unknown", null]);
  });
  it("gives only the asserted goalie the claim, and says when that goalie is not listed", () => {
    const detail = resolve([ifttt({ player_id: 7999 })]);
    expect(state(detail)).toBe("none");
    expect(detail.inventory.reasons.join(" ")).toContain("1 observed goalie has no appearance in their team's last 10 games, so this inventory does not list them.");
    const two = resolve([ifttt({ player_id: 7999 }), ifttt({ id: "b", game_id: 900012, player_id: 7998 })]);
    expect(two.inventory.reasons.join(" ")).toContain("2 observed goalies have no appearance");
  });
  it("maps likely and unconfirmed to unknown and ignores other dimensions", () => {
    const row = { gameId: 1, teamId: 1, playerId: 2, evidenceId: "e", sourceKey: "k", sourceUrl: null, publishedAt: "t", receivedAt: "t", confirmed: false };
    const { confirmations, conflicts } = mapBoardEvidence({ expiresAt: new Map(), evidence: { assertions: [{ ...row, dimension: "goalie", value: "likely" }, { ...row, dimension: "goalie", value: "unconfirmed" }, { ...row, dimension: "pp", value: "confirmed" }], conflicts: [{ gameId: 1, teamId: 1, playerId: 2, dimension: "ev", evidenceIds: [] }] } });
    expect([confirmations.size, conflicts.size]).toEqual([0, 0]);
  });
  it("selects no raw report text or metadata", () => {
    expect(INVENTORY_OBSERVATION_COLUMNS).not.toContain("raw_status");
    expect(INVENTORY_OBSERVATION_COLUMNS).not.toContain("metadata");
  });
});

describe("forecast admission (11.3)", () => {
  const good: InventoryForecastInput = FIXTURE_INPUT.forecasts![0];
  const participation = good.startParticipation!;
  it("admits a matching, unexpired, official-starter start participation", () => {
    expect(admitStartParticipation(good, FIXTURE_GENERATED_AT)).toEqual({ state: "qualified", startProbability: 0.62, revisionId: "fixture-revision", modelLabel: "goalie-rolling-14d-start-frequency-v1", issuedAt: participation.issuedAt, expiresAt: participation.expiresAt });
  });
  it.each([
    ["expired", { ...good, startParticipation: { ...participation, expiresAt: "2026-11-02T14:59:59.000Z" } }, /expired/],
    ["wrong basis", { ...good, startParticipation: { ...participation, basis: "appearance" as const } }, /start basis/],
    ["wrong event", { ...good, startParticipation: { ...participation, model: { ...participation.model!, event: "positive_minutes" as const } } }, /official starter/],
    ["no model", { ...good, startParticipation: { ...participation, model: undefined } }, /official starter/],
    ["mismatched probability", { ...good, startProbability: 0.5 }, /does not match/],
    ["out of range", { ...good, startProbability: 1.2, startParticipation: { ...participation, probability: 1.2 } }, /valid probability/],
    ["issued after the edition", { ...good, startParticipation: { ...participation, cutoffAt: "2026-11-02T15:30:00.000Z", issuedAt: "2026-11-02T16:00:00.000Z" } }, /not valid/],
    ["raw probability", { ...good, startParticipation: null }, /raw start probability/],
  ])("gives unavailable for %s", (_name, input, reason) => {
    const forecast = admitStartParticipation(input as InventoryForecastInput, FIXTURE_GENERATED_AT);
    expect(forecast.state).toBe("unavailable");
    expect(forecast.state === "unavailable" && forecast.reason).toMatch(reason);
  });
  it("keeps confirmation and forecast independent in both directions", () => {
    const confirmed = game(GOALIE_INVENTORY_FIXTURE, 7001, 900010), forecast = game(GOALIE_INVENTORY_FIXTURE, 7004, 900011);
    expect([confirmed.confirmation.state, confirmed.forecast.state]).toEqual(["confirmed", "unavailable"]);
    expect([forecast.confirmation.state, forecast.forecast.state]).toEqual(["none", "qualified"]);
  });
});

describe("search (11.5)", () => {
  const names = (query: string) => searchGoalieInventory(GOALIE_INVENTORY_FIXTURE, query).map(goalie => goalie.name);
  it("ignores accents and case, including letters NFD cannot split", () => {
    expect(names("eric")).toEqual(["Éric Testeur"]);
    expect(names("ÉRIC TEST")).toEqual(["Éric Testeur"]);
    expect(names("sogaard")).toEqual(["Mikko Søgaard"]);
    expect(names("simek")).toEqual(["Jonas Šimek"]);
  });
  it("finds a team by abbreviation or name, and an empty query returns everyone", () => {
    expect(names("tor")).toEqual(["Ana Split", "Lee Split"]);
    expect(names("new jersey")).toEqual(["Éric Testeur", "Sam Relief"]);
    expect(names("  ")).toHaveLength(6);
    expect(names("nobody")).toEqual([]);
  });
});

describe("live loader, injected client", () => {
  const request = { season: 20262027, from: "2026-11-02", through: "2026-11-04", generatedAt: FIXTURE_GENERATED_AT };
  const observation = { id: "a", game_id: 900010, team_id: 1, player_id: 7001, observation_status: "confirmed", accepted: true, source_key: "validated_events", source_account: null, source_url: null, observed_at: "2026-11-02T10:00:00Z", available_at: "2026-11-02T10:05:00Z", created_at: "2026-11-02T10:06:00Z", expires_at: null };
  const tables: Record<string, readonly unknown[]> = { games: FIXTURE_INPUT.schedule, wgo_team_stats: FIXTURE_INPUT.teamGames, nst_team_gamelogs_as_counts: FIXTURE_INPUT.nst, player_forecast_goalie_start_observations: [observation], player_forecast_observation_conflicts: [],
    wgo_goalie_stats: FIXTURE_INPUT.appearances.map(row => ({ goalie_id: row.goalieId, goalie_name: row.name, date: row.date, season_id: 20262027, game_id: row.gameId, team_abbreviation: row.team, opponent_team_abbrev: row.opponent, home_road: row.home ? "H" : "R", games_played: 1, games_started: row.started ? 1 : 0 })) };
  const CLOSED = ["player_forecast_goalie_start_observations", "player_forecast_observation_conflicts", "player_forecast_conflict_resolutions"];
  const fakeClient = (read: string[], fail: readonly string[] = [], selects: string[] = []) => ({ from(table: string) {
    read.push(table);
    const builder: any = { select: (columns: string) => { selects.push(columns); return builder; }, eq: () => builder, gte: () => builder, lte: () => builder, in: () => builder, order: () => builder, range: (from: number, to: number) => Promise.resolve(fail.includes(table) ? { data: null, error: { message: "permission denied" }, count: null } : { data: (tables[table] ?? []).slice(from, to + 1), error: null, count: (tables[table] ?? []).length }) };
    return builder;
  } });
  it("reads confirmation through the server client only, never the post route's anon client", async () => {
    const anon: string[] = [], selects: string[] = [];
    serverRead.tables.length = 0; serverRead.from = fakeClient([], [], selects).from;
    const inventory = await loadGoalieInventory(fakeClient(anon), request);
    serverRead.from = null;
    expect(anon.filter(table => CLOSED.includes(table))).toEqual([]);
    expect(serverRead.tables).toEqual(CLOSED.slice(0, 2));
    expect(selects.join(",")).not.toMatch(/raw_status|metadata/);
    expect(game(inventory, 7001, 900010).confirmation.state).toBe("confirmed");
    expect(inventory.reasons).toEqual(expect.arrayContaining([CONFIRMATION_REPORTER_GAP, CONFIRMATION_LINK_GAP]));
  });
  it("is unknown with the reason, keeping the rest, when the server credential is missing", async () => {
    serverRead.from = null;
    const inventory = await loadGoalieInventory(fakeClient([]), request);
    expect(inventory.goalies.length).toBeGreaterThan(0);
    expect(inventory.reasons).toContain(CONFIRMATION_CLOSED_REASON);
    expect(inventory.goalies.flatMap(goalie => goalie.games).every(row => row.confirmation.state === "none")).toBe(true);
  });
  it("reads no observations at all without an observation client", async () => {
    const read: string[] = [];
    const { inventory } = await loadGoalieInventoryDetail(fakeClient(read), request);
    expect(read).not.toContain("player_forecast_goalie_start_observations");
    expect(inventory.reasons).toContain(CONFIRMATION_CLOSED_REASON);
  });
  it("fails the whole confirmation closed when the conflict read fails, rather than confirming past a conflict", async () => {
    const { inventory } = await loadGoalieInventoryDetail(fakeClient([]), request, { observationClient: fakeClient([], ["player_forecast_observation_conflicts"]) });
    expect(game(inventory, 7001, 900010).confirmation.state).toBe("none");
    expect(inventory.reasons).toContain(CONFIRMATION_CLOSED_REASON);
  });
  it("reads forecasts through an injected reader", async () => {
    const { inventory } = await loadGoalieInventoryDetail(fakeClient([]), request, { readStartParticipations: async () => FIXTURE_INPUT.forecasts! });
    expect(game(inventory, 7004, 900011).forecast.state).toBe("qualified");
  });
  it("reports missing with no goalies when a required source fails", async () => {
    const { inventory, coverage } = await loadGoalieInventoryDetail(fakeClient([], ["wgo_team_stats"]), request);
    expect(inventory).toMatchObject({ state: "missing", goalies: [] });
    expect(coverage).toBeNull();
  });
  it("refuses an unbounded range without reading", async () => {
    const read: string[] = [];
    const { inventory } = await loadGoalieInventoryDetail(fakeClient(read), { ...request, through: "2026-12-31" });
    expect(inventory.state).toBe("missing");
    expect(read).toEqual([]);
  });
});

describe("head-to-head winner rule", () => {
  const metric = (leagueRank: number | null, value: number | null = 1, leagueCohort: number | null = 32) => ({ value, unit: "per game", window: "", sampleGames: 10, leagueRank, leagueCohort });
  const side = (metricId: TeamLensMetric, rank: number | null, value: number | null = 1) => ({ metricId, metric: metric(rank, value) });
  it.each(["shotsFor", "xgf", "chancesFor", "goalsFor", "powerPlayPct", "penaltyKillPct", "goalDifferential"] as const)("keeps %s's rank, the highest value being strongest", metricId => {
    expect(strengthRank(side(metricId, 1))).toBe(1);
    expect(strengthRank(side(metricId, 32))).toBe(32);
    expect(strengthShare(side(metricId, 1))).toBe(1);
  });
  it.each(["shotsAgainst", "xga", "chancesAgainst", "goalsAgainst", "timesShorthanded"] as const)("turns %s around, the team with the most being weakest", metricId => {
    expect(strengthRank(side(metricId, 1))).toBe(32);
    expect(strengthRank(side(metricId, 32))).toBe(1);
    expect(strengthShare(side(metricId, 1))).toBe(1 / 32);
  });
  it("picks the stronger side in both orders", () => {
    // xGF #10 against the 5th-most xGA, the 28th-strongest defence: the attack wins, though 5 is the lower number.
    expect(headToHeadWinner(side("xgf", 10), side("xga", 5))).toBe(0);
    expect(headToHeadWinner(side("xga", 5), side("xgf", 10))).toBe(1);
    // SF #20 against the fewest shots allowed, the strongest defence.
    expect(headToHeadWinner(side("shotsFor", 20), side("shotsAgainst", 32))).toBe(1);
    // The best PK beats a middling power play, and the worst PK loses to it.
    expect(headToHeadWinner(side("powerPlayPct", 16), side("penaltyKillPct", 1))).toBe(1);
    expect(headToHeadWinner(side("powerPlayPct", 16), side("penaltyKillPct", 32))).toBe(0);
    // Shorthanded the most is weak; the least is strong.
    expect(headToHeadWinner(side("powerPlayPct", 16), side("timesShorthanded", 1))).toBe(0);
    expect(headToHeadWinner(side("powerPlayPct", 16), side("timesShorthanded", 32))).toBe(1);
    expect(headToHeadWinner(side("goalsFor", 3), side("goalsAgainst", 31))).toBe(1);
  });
  it("has no winner at equal strength", () => {
    expect(headToHeadWinner(side("xgf", 8), side("xga", 25))).toBeNull();
    expect(headToHeadWinner(side("powerPlayPct", 8), side("penaltyKillPct", 8))).toBeNull();
  });
  it("has no winner with a missing value or rank, on either side", () => {
    for (const missing of [side("xga", null), side("xga", 4, null), { metricId: "xga" as const, metric: metric(4, 1, null) }]) {
      expect(strengthRank(missing)).toBeNull();
      expect(strengthShare(missing)).toBeNull();
      expect(headToHeadWinner(side("xgf", 1), missing)).toBeNull();
      expect(headToHeadWinner(missing, side("xgf", 1))).toBeNull();
    }
  });
});
