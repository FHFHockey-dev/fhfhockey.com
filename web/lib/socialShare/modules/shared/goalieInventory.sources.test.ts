import { describe, expect, it, vi } from "vitest";
import { GOALIE_INVENTORY_VERSION, type GoalieInventory, type LoadGoalieInventory, type SearchGoalieInventory } from "./goalieInventory";
import { FIXTURE_GENERATED_AT, FIXTURE_INPUT, FIXTURE_TEAMS, GOALIE_INVENTORY_FIXTURE } from "./goalieInventory.fixture";
import { admitStartParticipation, buildGoalieInventory, buildTeamLenses, CONFIRMATION_CLOSED_REASON, FORECAST_CLOSED_REASON, inventoryWindow, loadGoalieInventory, loadGoalieInventoryDetail, resolveConfirmations, searchGoalieInventory, type InventoryForecastInput, type InventoryObservationRow } from "./goalieInventory.sources";

vi.mock("lib/supabase/public-client", () => ({ default: { from: () => { throw new Error("The inventory test must never reach Supabase."); } } }));

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
    expect(GOALIE_INVENTORY_FIXTURE.reasons.join(" ")).toMatch(/not that the goalie is not starting/);
  });
  it("gives unavailable for a raw probability", () => {
    expect(game(GOALIE_INVENTORY_FIXTURE, 7005, 900011).forecast).toEqual({ state: "unavailable", reason: "A raw start probability is not an admitted forecast." });
  });
  it("reports a closed confirmation source as none with its reason, and no forecast input as unavailable", () => {
    const { inventory } = buildGoalieInventory({ ...FIXTURE_INPUT, observations: null, forecasts: null });
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

describe("confirmation", () => {
  const row = (overrides: Partial<InventoryObservationRow>): InventoryObservationRow => ({ id: "a", game_id: 1, team_id: 1, player_id: 10, observation_status: "confirmed", source_group: "src", source_url: null, observed_at: "2026-11-02T10:00:00Z", available_at: "2026-11-02T10:00:00Z", expires_at: null, supersedes_id: null, accepted: true, ...overrides });
  const at = FIXTURE_GENERATED_AT;
  it("drops rejected, not-yet-available, expired and superseded rows", () => {
    expect(resolveConfirmations([row({ accepted: false })], at).size).toBe(0);
    expect(resolveConfirmations([row({ available_at: "2026-11-02T20:00:00Z" })], at).size).toBe(0);
    expect(resolveConfirmations([row({ expires_at: "2026-11-02T12:00:00Z" })], at).size).toBe(0);
    expect(resolveConfirmations([row({ id: "old" }), row({ id: "new", observation_status: "projected", observed_at: "2026-11-02T09:00:00Z", supersedes_id: "old" })], at).get("1:10")?.state).toBe("projected");
  });
  it("takes a goalie's newest claim, and a newest non-claim shows none", () => {
    expect(resolveConfirmations([row({ id: "a", observation_status: "projected" }), row({ id: "b", observed_at: "2026-11-02T11:00:00Z" })], at).get("1:10")?.state).toBe("confirmed");
    expect(resolveConfirmations([row({ id: "a" }), row({ id: "b", observation_status: "ruled_out", observed_at: "2026-11-02T11:00:00Z" })], at).size).toBe(0);
  });
  it("lets a newer confirmation displace another goalie, and a same-moment conflict confirms neither", () => {
    const displaced = resolveConfirmations([row({ id: "a" }), row({ id: "b", player_id: 11, observed_at: "2026-11-02T11:00:00Z" })], at);
    expect([displaced.has("1:10"), displaced.get("1:11")?.state]).toEqual([false, "confirmed"]);
    expect(resolveConfirmations([row({ id: "a" }), row({ id: "b", player_id: 11 })], at).size).toBe(0);
  });
  it("keeps the source, time and null URL as stated", () => {
    expect(resolveConfirmations([row({})], at).get("1:10")).toEqual({ state: "confirmed", source: "src", observedAt: "2026-11-02T10:00:00Z", expiresAt: null, sourceUrl: null });
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
  const tables: Record<string, readonly unknown[]> = { games: FIXTURE_INPUT.schedule, wgo_team_stats: FIXTURE_INPUT.teamGames, nst_team_gamelogs_as_counts: FIXTURE_INPUT.nst, player_forecast_goalie_start_observations: FIXTURE_INPUT.observations!,
    wgo_goalie_stats: FIXTURE_INPUT.appearances.map(row => ({ goalie_id: row.goalieId, goalie_name: row.name, date: row.date, season_id: 20262027, game_id: row.gameId, team_abbreviation: row.team, opponent_team_abbrev: row.opponent, home_road: row.home ? "H" : "R", games_played: 1, games_started: row.started ? 1 : 0 })) };
  const fakeClient = (read: string[], fail: readonly string[] = []) => ({ from(table: string) {
    read.push(table);
    const builder: any = { select: () => builder, eq: () => builder, gte: () => builder, lte: () => builder, in: () => builder, order: () => builder, range: (from: number, to: number) => Promise.resolve(fail.includes(table) ? { data: null, error: { message: "permission denied" }, count: null } : { data: (tables[table] ?? []).slice(from, to + 1), error: null, count: (tables[table] ?? []).length }) };
    return builder;
  } });
  it("never touches the observation table through the post route's client", async () => {
    const read: string[] = [];
    const inventory = await loadGoalieInventory(fakeClient(read), request);
    expect(read).not.toContain("player_forecast_goalie_start_observations");
    expect(read).toEqual(expect.arrayContaining(["games", "wgo_team_stats", "nst_team_gamelogs_as_counts", "wgo_goalie_stats"]));
    expect(inventory.reasons).toContain(CONFIRMATION_CLOSED_REASON);
    expect(inventory.goalies.flatMap(goalie => goalie.games).every(row => row.confirmation.state === "none")).toBe(true);
  });
  it("reads confirmation through an injected client, and forecasts through an injected reader", async () => {
    const read: string[] = [], observationRead: string[] = [];
    const { inventory } = await loadGoalieInventoryDetail(fakeClient(read), request, { observationClient: fakeClient(observationRead), readStartParticipations: async () => FIXTURE_INPUT.forecasts! });
    expect(observationRead).toEqual(["player_forecast_goalie_start_observations"]);
    expect(read).not.toContain("player_forecast_goalie_start_observations");
    expect(game(inventory, 7001, 900010).confirmation.state).toBe("confirmed");
    expect(game(inventory, 7004, 900011).forecast.state).toBe("qualified");
  });
  it("shows none with a reason when the injected observation read fails, and keeps the rest", async () => {
    const { inventory } = await loadGoalieInventoryDetail(fakeClient([]), request, { observationClient: fakeClient([], ["player_forecast_goalie_start_observations"]) });
    expect(inventory.goalies.length).toBeGreaterThan(0);
    expect(inventory.reasons.join(" ")).toMatch(/could not be read/);
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
