import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { PlanningData, PlanningPlayer } from "lib/rosterScheduleOptimizer/planningTypes";
const mocks = vi.hoisted(() => ({ roster: vi.fn(), context: vi.fn() }));
vi.mock("./providerClient", () => ({ fetchYahooBoardResource: mocks.roster }));
vi.mock("./gameContext", () => ({ resolveYahooGameContext: mocks.context, assertYahooLeagueGameContext: (key: string) => {
  if (key !== "453.l.1") throw new Error("season");
} }));
import { loadYahooPlanningConfirmations } from "./planningConfirmations";

const now = new Date("2026-10-23T12:00:00Z");
function fixture() {
  const players: PlanningPlayer[] = [1, 2].map(id => ({ id: String(id), nhlId: id + 100, nhlTeamId: 30,
    name: `Synthetic goalie ${id}`, teamAbbreviation: "MIN", eligiblePositions: ["G"], playerClass: "goalie",
    availability: "rostered", ownership: null, canDrop: null, holdValue: null, reserveEligibility: [] }));
  const games: PlanningData["games"] = [{ id: "123", date: "2026-10-23", teamAbbreviation: "MIN", opponent: "TOR",
    home: true, startsAt: "2026-10-23T20:00:00Z", status: "scheduled" }];
  const revisionId = "forge-daily-bridge-v1:synthetic";
  const data: PlanningData = { players, games, evidence: {}, forecasts: players.map((p, i) => ({ playerId: p.id, gameId: "123",
    stats: { SAVES_GOALIE: i ? 17.5 : 7.5, GOALS_AGAINST_GOALIE: i ? 2.1 : .9, SHUTOUTS_GOALIE: null },
    conditionalStats: { SAVES_GOALIE: 25, GOALS_AGAINST_GOALIE: 3, SHUTOUTS_GOALIE: null },
    startProbability: i ? .7 : .3, confirmedStart: false, conditioning: "unconditional", revisionId,
    issuedAt: now.toISOString(), cutoffAt: now.toISOString(), expiresAt: "2026-10-24T00:00:00Z", modelVersion: "bridge", limitations: [] })),
    forecastManifest: { version: "planning-forecasts-v1", id: "test", seasonId: 20262027, asOf: now.toISOString(),
      scheduleRevision: "s", rosterRevision: "r", issuedRevisionIds: [revisionId], baselineChecksum: null,
      requiredOpportunities: 2, forecastedOpportunities: 2, exclusionCounts: {},
      rsoUsePolicy: { version: "rso-target-use-v1", revision: "policy", bridgeRevisionIds: [revisionId] } } };
  const providerRow: Record<string, any> = { player_key: "453.p.1", editorial_team_abbr: "MIN",
    starting_status: { coverage_type: "date", date: "2026-10-23", is_starting: 1 } };
  const payload = { team_key: "453.l.1.t.1", is_owned_by_current_login: "1", roster: { date: "2026-10-23", coverage_type: "date",
    players: { count: 1, 0: { player: [providerRow] } } } };
  const response = { payload, transport: { responseDate: now.toISOString(), ageSeconds: 0 } };
  const tables: Record<string, any> = {
    external_teams: { id: "team", user_id: "owner", provider: "yahoo", external_league_id: "league", connected_account_id: "account",
      external_team_key: "453.l.1.t.1", team_metadata: { is_owned: true } },
    external_leagues: { id: "league", user_id: "owner", provider: "yahoo", connected_account_id: "account", external_league_key: "453.l.1" },
    yahoo_nhl_player_map_read: [{ nhl_player_id: 101, yahoo_player_id: "453.p.1" }],
  };
  const from = vi.fn((table: string) => {
    const filters: Record<string, any> = {}; let inFilter: [string, any[]] | null = null;
    const result = () => {
      const rows = tables[table];
      if (Array.isArray(rows)) return { data: rows.filter(row => !inFilter || inFilter[1].includes(row[inFilter[0]])), error: null };
      return { data: rows && Object.entries(filters).every(([key, value]) => rows[key] === value) ? rows : null, error: null };
    };
    const q = { select: () => q, eq: (key: string, value: unknown) => { filters[key] = value; return q; },
      in: (key: string, values: any[]) => { inFilter = [key, values]; return q; }, limit: async () => result(), maybeSingle: async () => result() };
    return q;
  });
  mocks.roster.mockResolvedValue(response);
  mocks.context.mockResolvedValue({ gameKey: "453", targetSeasonId: 20262027 });
  const args = { db: { from } as any, userId: "owner", teamId: "team", leagueId: "league", now,
    query: { seasonId: 20262027, startDate: "2026-10-23", endDate: "2026-10-25", timeZone: "UTC" }, data };
  return { args, data, tables, providerRow, response, from };
}
beforeEach(() => { vi.useFakeTimers(); vi.setSystemTime(now); vi.clearAllMocks(); });
afterEach(() => vi.useRealTimers());

describe("owned current Yahoo confirmations", () => {
  it.each([true, false])("applies explicit starting=%s only to participation, preserving conditional ability and unknown stats", async starting => {
    const f = fixture(); f.providerRow.starting_status.is_starting = starting;
    const before = JSON.stringify(f.data), result = await loadYahooPlanningConfirmations(f.args);
    expect(result.data.forecasts.map(row => row.startProbability)).toEqual(starting ? [1, 0] : [0, 1]);
    expect(result.data.forecasts.map(row => row.stats.SAVES_GOALIE)).toEqual(starting ? [25, 0] : [0, 25]);
    expect(result.data.forecasts[0].conditionalStats).toEqual(f.data.forecasts[0].conditionalStats);
    expect(result.data.forecasts[0].stats.SHUTOUTS_GOALIE).toBeNull();
    expect(result.expiresAt).toBe("2026-10-23T12:02:00.000Z");
    expect(JSON.stringify(f.data)).toBe(before);
    expect(mocks.roster).toHaveBeenCalledOnce();
    expect(mocks.roster).toHaveBeenCalledWith(expect.objectContaining({ userId: "owner", resource: { type: "roster", teamKey: "453.l.1.t.1", date: "2026-10-23" } }));
  });
  it.each(["absent", "unknown", "wrong-date", "wrong-nhl-team", "missing-nhl-team", "ambiguous-forward", "ambiguous-reverse", "wrong-season-id", "wrong-game", "already-started", "native"])("keeps the current prior on %s evidence", async kind => {
    const f = fixture();
    if (kind === "absent") delete f.providerRow.starting_status;
    if (kind === "unknown") f.providerRow.starting_status.is_starting = "unknown";
    if (kind === "wrong-date") f.providerRow.starting_status.date = "2026-10-24";
    if (kind === "wrong-nhl-team") f.providerRow.editorial_team_abbr = "TOR";
    if (kind === "missing-nhl-team") delete f.providerRow.editorial_team_abbr;
    if (kind === "ambiguous-forward") f.tables.yahoo_nhl_player_map_read.push({ nhl_player_id: 102, yahoo_player_id: "453.p.1" });
    if (kind === "ambiguous-reverse") f.tables.yahoo_nhl_player_map_read.push({ nhl_player_id: 101, yahoo_player_id: "453.p.99" });
    if (kind === "wrong-season-id") f.tables.yahoo_nhl_player_map_read[0].yahoo_player_id = "400.p.1";
    if (kind === "wrong-game") f.data.games[0].id = "other";
    if (kind === "already-started") f.data.games[0].startsAt = "2026-10-23T11:00:00Z";
    if (kind === "native") f.data.forecasts.forEach(row => { row.rsoTargetBindings = {}; });
    const result = await loadYahooPlanningConfirmations(f.args);
    expect(result.data.forecasts).toEqual(f.data.forecasts);
  });
  it.each(["other-owner", "other-team", "other-league", "unowned", "account-mismatch", "season"])("rejects %s before provider traffic", async kind => {
    const f = fixture();
    if (kind === "other-owner") f.args.userId = "other";
    if (kind === "other-team") f.args.teamId = "other";
    if (kind === "other-league") f.args.leagueId = "other";
    if (kind === "unowned") f.tables.external_teams.team_metadata.is_owned = false;
    if (kind === "account-mismatch") f.tables.external_leagues.connected_account_id = "other";
    if (kind === "season") f.args.query.seasonId = 20252026;
    await expect(loadYahooPlanningConfirmations(f.args)).rejects.toThrow(); expect(mocks.roster).not.toHaveBeenCalled();
  });
  it.each(["old", "future", "missing-time", "cache-age", "wrong-roster-date", "wrong-team", "not-owned", "incomplete", "failure"])("rejects %s current roster, without retrying or trusting old labels", async kind => {
    const f = fixture();
    if (kind === "old") f.response.transport.responseDate = "2026-10-23T11:57:00Z";
    if (kind === "future") f.response.transport.responseDate = "2026-10-23T12:00:01Z";
    if (kind === "missing-time") f.response.transport.responseDate = "";
    if (kind === "cache-age") f.response.transport.ageSeconds = 61;
    if (kind === "wrong-roster-date") f.response.payload.roster.date = "2026-10-24";
    if (kind === "wrong-team") f.response.payload.team_key = "453.l.1.t.2";
    if (kind === "not-owned") f.response.payload.is_owned_by_current_login = "0";
    if (kind === "incomplete") f.response.payload.roster.players.count = 2;
    if (kind === "failure") mocks.roster.mockRejectedValue(new Error("timeout"));
    await expect(loadYahooPlanningConfirmations(f.args)).rejects.toThrow(); expect(mocks.roster).toHaveBeenCalledOnce();
  });
  it("charges cache age against the freshness deadline and makes no roster call for a future-only horizon", async () => {
    const f = fixture(); f.response.transport.ageSeconds = 60;
    expect((await loadYahooPlanningConfirmations(f.args)).expiresAt).toBe("2026-10-23T12:01:00.000Z");
    mocks.roster.mockClear(); f.args.query.startDate = "2026-10-24";
    expect(await loadYahooPlanningConfirmations(f.args)).toEqual({ data: f.data, expiresAt: null });
    expect(mocks.roster).not.toHaveBeenCalled();
  });
});
