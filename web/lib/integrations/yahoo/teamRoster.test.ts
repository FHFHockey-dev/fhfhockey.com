import { afterEach, describe, expect, it, vi } from "vitest";
import { loadYahooStarterBoard, yahooBoardPlayers, yahooFields } from "./starterBoard";
import * as boardProvider from "./providerClient";
import * as boardRevisions from "lib/projections/gameRevisions";
import * as nhlSchedule from "lib/NHL/server/scheduleDaily";

import {
  getCachedYahooTeamRoster,
  loadYahooTeamRoster,
} from "./teamRoster";

function createTeam(overrides: Record<string, unknown> = {}) {
  return {
    id: "team-2",
    external_league_id: "league-1",
    connected_account_id: "account-1",
    user_id: "user-1",
    provider: "yahoo",
    external_team_key: "500.l.1.t.2",
    team_name: "League Rival",
    team_metadata: { is_owned: false },
    roster_snapshot: { players: [], visibility: "not_fetched" },
    imported_at: "2026-07-13T09:00:00.000Z",
    created_at: "2026-07-13T09:00:00.000Z",
    updated_at: "2026-07-13T09:00:00.000Z",
    ...overrides,
  };
}

function createClient(team: ReturnType<typeof createTeam>) {
  const update = vi.fn();
  const rpc = vi.fn().mockResolvedValue({
    data: [
      {
        access_token: "access-token",
        refresh_token: "refresh-token",
        token_type: "bearer",
        provider_user_id: "guid-1",
      },
    ],
    error: null,
  });

  const client: any = {
    rpc,
    from(table: string) {
      expect(table).toBe("external_teams");
      return {
        select() {
          const query: any = {
            eq: () => query,
            maybeSingle: () => Promise.resolve({ data: team, error: null }),
          };
          return query;
        },
        update(payload: unknown) {
          update(payload);
          const query: any = {
            eq: () => query,
            then: (resolve: (value: unknown) => void) =>
              resolve({ data: null, error: null }),
          };
          return query;
        },
      };
    },
  };

  return { client, rpc, update };
}

describe("Yahoo team roster cache", () => {
  it("cannot select another account's team through the Starter Board", async () => {
    vi.stubEnv("YAHOO_LIVE_DRAFT_SEASON", "2026");
    vi.stubEnv("YAHOO_LIVE_DRAFT_TARGET_SEASON_ID", "20262027");
    const filters: unknown[] = [];
    const client = { from: vi.fn((table: string) => {
      const result = { data: table === "yahoo_game_keys" ? [{ code: "nhl", game_key: "477", season: 2026 }]
        : table === "external_teams" ? [] : { active_context: {} }, error: null };
      const builder: any = { select: () => builder, eq: (key: string, value: unknown) => { filters.push([table, key, value]); return builder; },
        maybeSingle: () => Promise.resolve(result), then: (resolve: any) => Promise.resolve(result).then(resolve) };
      return builder;
    }) };
    try {
      await expect(loadYahooStarterBoard({ userId: "owner", teamId: "someone-elses-team", client: client as any })).rejects.toMatchObject({ statusCode: 404 });
      expect(filters).toContainEqual(["external_teams", "user_id", "owner"]);
      expect(filters).toContainEqual(["user_settings", "user_id", "owner"]);
      expect(client.from).not.toHaveBeenCalledWith("external_leagues");
    } finally { vi.unstubAllEnvs(); }
  });
  it("retains independent selected position and eligibility in nested Yahoo JSON", () => {
    const result = yahooBoardPlayers({ fantasy_content: { team: [[], { roster: { players: {
      0: { player: [[{ player_key: "477.p.1" }, { eligible_positions: [{ position: "C" }, { position: "LW" }] }],
        { selected_position: [{ coverage_type: "date" }, { date: "2026-10-01" }, { position: "BN" }] }] }, count: 1,
    } } }] } });
    expect(result).toHaveLength(1);
    expect(result[0].eligible_positions).toEqual([{ position: "C" }, { position: "LW" }]);
    expect(yahooFields(result[0].selected_position).position).toBe("BN");
    expect(() => yahooBoardPlayers({ players: [{ player_key: "477.p.1" }, { player_key: "477.p.1" }] })).toThrow("Ambiguous");
  });
  it("returns a fresh league-visible roster and rejects stale snapshots", () => {
    const snapshot = {
      players: [{ player_key: "500.p.1" }],
      visibility: "league",
      fetched_at: "2026-07-13T10:00:00.000Z",
    };

    expect(
      getCachedYahooTeamRoster(
        snapshot,
        new Date("2026-07-13T10:14:59.000Z"),
      ),
    ).toEqual({
      players: [{ player_key: "500.p.1" }],
      fetchedAt: "2026-07-13T10:00:00.000Z",
    });
    expect(
      getCachedYahooTeamRoster(
        snapshot,
        new Date("2026-07-13T10:15:01.000Z"),
      ),
    ).toBeNull();
  });

  it("returns a fresh cached roster without reading tokens or calling Yahoo", async () => {
    const team = createTeam({
      roster_snapshot: {
        players: [{ player_key: "500.p.1" }],
        visibility: "league",
        fetched_at: "2026-07-13T10:00:00.000Z",
      },
    });
    const { client, rpc, update } = createClient(team);
    const fetchRoster = vi.fn();

    const result = await loadYahooTeamRoster({
      userId: "user-1",
      externalTeamId: "team-2",
      redirectUri: "https://fhfhockey.com/api/v1/account/yahoo/callback",
      client,
      now: () => new Date("2026-07-13T10:05:00.000Z"),
      fetchRoster,
    });

    expect(result.cached).toBe(true);
    expect(result.players).toEqual([{ player_key: "500.p.1" }]);
    expect(fetchRoster).not.toHaveBeenCalled();
    expect(rpc).not.toHaveBeenCalled();
    expect(update).not.toHaveBeenCalled();
  });

  it("fetches and caches an opponent roster under the authenticated owner", async () => {
    const { client, rpc, update } = createClient(createTeam());
    const fetchRoster = vi.fn().mockResolvedValue([
      {
        player_key: "500.p.1",
        name: { full: "Connor Example" },
        display_position: "C",
      },
    ]);

    const result = await loadYahooTeamRoster({
      userId: "user-1",
      externalTeamId: "team-2",
      redirectUri: "https://fhfhockey.com/api/v1/account/yahoo/callback",
      client,
      now: () => new Date("2026-07-13T10:20:00.000Z"),
      fetchRoster,
    });

    expect(rpc).toHaveBeenCalledWith(
      "get_connected_account_tokens_secure",
      expect.objectContaining({
        p_connected_account_id: "account-1",
        p_user_id: "user-1",
      }),
    );
    expect(fetchRoster).toHaveBeenCalledWith(
      expect.objectContaining({
        externalTeamKey: "500.l.1.t.2",
        userId: "user-1",
      }),
    );
    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({
        roster_snapshot: expect.objectContaining({
          visibility: "league",
          source: "on_demand",
          fetched_at: "2026-07-13T10:20:00.000Z",
        }),
      }),
    );
    expect(result.cached).toBe(false);
    expect(result.players).toHaveLength(1);
  });
});

describe("Yahoo Starter Board provider workflow", () => {
  afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); vi.unstubAllEnvs(); });
  function fixture() {
    vi.stubEnv("YAHOO_LIVE_DRAFT_SEASON", "2026");
    vi.stubEnv("YAHOO_LIVE_DRAFT_TARGET_SEASON_ID", "20262027");
    const now = new Date("2026-10-10T16:00:00Z");
    const transport = { responseDate: now.toISOString(), ageSeconds: 0 };
    const player = (id: number, team: string, position: string) => ({ player_key: `477.p.${id}`, name: { full: `Player ${id}` },
      editorial_team_abbr: team, eligible_positions: [{ position }], selected_position: { position: id === 2 ? "C" : "BN" }, is_undroppable: "0" });
    const roster = { team_key: "477.l.1.t.1", is_owned_by_current_login: 1,
      roster: { coverage_type: "date", date: "2026-10-10", is_editable: 1,
        players: { count: 2, 0: { player: player(1, "MTL", "G") }, 1: { player: player(2, "BOS", "C") } } } };
    const settings = { league_key: "477.l.1", weekly_deadline: "intraday", roster_type: "date", scoring_type: "headpoint",
      roster_positions: [{ position: "C", count: 1 }, { position: "G", count: 1 }, { position: "BN", count: 1 }],
      stat_categories: { stats: [{ stat_id: "19", abbr: "W" }] }, stat_modifiers: { stats: [{ stat_id: "19", value: "6" }] } };
    const availability = { league_key: "477.l.1", players: { count: 1, 0: { player: {
      ...player(3, "TOR", "G"), ownership: { ownership_type: "freeagents" } } } } };
    const provider = vi.spyOn(boardProvider, "fetchYahooBoardResource").mockImplementation(async (args) => ({
      payload: args.resource.type === "roster" ? roster : availability, transport,
    }) as any);
    vi.spyOn(boardProvider, "fetchYahooDraftResource").mockResolvedValue({ payload: settings, transport } as any);
    const game = { id: 1001, startTimeUTC: "2026-10-10T23:00:00Z", gameState: "FUT", gameScheduleState: "OK",
      homeTeam: { id: 8, abbrev: "MTL" }, awayTeam: { id: 10, abbrev: "TOR" } };
    const schedule = { gameWeek: [{ date: "2026-10-10", numberOfGames: 1, games: [game] }], oddsPartners: [] };
    vi.spyOn(nhlSchedule, "getScheduleDaily").mockResolvedValue(schedule);
    const candidate = (playerId: number) => ({ playerId, startingProbability: 0.8, conditional: {
      SHOTS_AGAINST_GOALIE: 30, SAVES_GOALIE: 28, GOALS_AGAINST_GOALIE: 2, WINS_GOALIE: 0.5, SHUTOUTS_GOALIE: 0.1 } });
    vi.spyOn(boardRevisions, "loadForgeGameRevisions").mockResolvedValue([{ id: "revision-1", game_id: 1001,
      payload: { players: [], goalies: [{ uncertainty: { daily_board_candidates: [candidate(101), candidate(103)] } }] } }] as any);
    const mappings = [1, 2, 3].map((id) => ({ nhl_player_id: String(100 + id), yahoo_player_id: String(id) }));
    const filters: unknown[] = [];
    const client: any = { from: vi.fn((table: string) => {
      let data: any = table === "external_teams" ? [{ id: "team-1", external_team_key: "477.l.1.t.1", external_league_id: "league-1",
        connected_account_id: "account-1", team_name: "My team", team_metadata: { is_owned: true } }]
        : table === "external_leagues" ? { external_league_key: "477.l.1", connected_account_id: "account-1", league_name: "My league" }
        : table === "user_settings" ? { active_context: { provider: "yahoo", external_team_id: "team-1" } }
        : table === "yahoo_game_keys" ? [{ game_key: "477", code: "nhl", season: 2026 }]
        : table === "games" ? [{ id: 1001, startTime: game.startTimeUTC }] : [];
      const query: any = { select: () => query, eq: (key: string, value: unknown) => { filters.push([table, key, value]); return query; },
        in: (key: string, values: string[]) => { data = mappings.filter((row) => values.includes(row[key as keyof typeof row])); return query; },
        single: async () => ({ data, error: null }), maybeSingle: async () => ({ data, error: null }),
        then: (resolve: any) => Promise.resolve({ data, error: null }).then(resolve) };
      return query;
    }) };
    return { roster, settings, transport, availability, provider, schedule, mappings, filters,
      load: () => loadYahooStarterBoard({ userId: "user-1", client, now }) };
  }
  it("resolves idle roster identities and optimizes known zero-game players without inventing participation", async () => {
    const f = fixture();
    const result = await f.load();
    expect(result.lineup).toMatchObject({ status: "complete", expectedValue: 2.4 });
    expect(result.roster?.find((row) => row.id === "477.p.2")).toMatchObject({ value: 0, valueBasis: "no_game",
      identityVerified: true, scheduleStatus: "no_game", lock: "unlocked" });
    expect(result.lineup?.assignments.find((row) => row.position === "G")?.playerId).toBe("477.p.1");
    expect(result.streaming?.[0]).toMatchObject({ availability: "free_agent", usableToday: null, incrementalValue: null });
    expect(result.acquisitionRules).toMatchObject({ timing: "same_day", transactionLimits: "unverified" });
    expect(result.streaming?.[0].limitations).toContain("Same-day acquisitions are enabled, but league acquisition limits and the remaining allowance are unverified.");
    expect(f.provider).toHaveBeenCalledWith(expect.objectContaining({ resource: { type: "available_players", start: 0 } }));
    expect(result.streamingCoverage).toMatchObject({ playersChecked: 1, pagesAttempted: 1, matchedToday: 1 });
    expect(f.filters).toContainEqual(["external_leagues", "user_id", "user-1"]);
  });
  it("does not use an incomplete schedule or unresolved team/identity to infer no game", async () => {
    const f = fixture();
    f.schedule.gameWeek[0].numberOfGames = 2;
    expect((await f.load()).roster?.[1]).toMatchObject({ value: null, valueBasis: "missing", lock: "unknown" });
    f.schedule.gameWeek[0].numberOfGames = 1;
    f.roster.roster.players[1].player.editorial_team_abbr = "UNKNOWN";
    expect((await f.load()).roster?.[1]?.value).toBeNull();
    f.roster.roster.players[1].player.editorial_team_abbr = "BOS";
    f.mappings.push({ nhl_player_id: "999", yahoo_player_id: "2" });
    expect((await f.load()).roster?.[1]).toMatchObject({ value: null, identityVerified: false });
    f.mappings.pop();
    f.mappings.push({ nhl_player_id: "102", yahoo_player_id: "999" });
    expect((await f.load()).roster?.[1]).toMatchObject({ value: null, identityVerified: false });
  });
  it("keeps missing forecasts unknown for teams that do play and respects explicit roster locks", async () => {
    const f = fixture();
    f.roster.roster.players[1].player.editorial_team_abbr = "MTL";
    expect((await f.load()).roster?.[1]).toMatchObject({ value: null, valueBasis: "missing" });
    f.roster.roster.players[1].player.editorial_team_abbr = "BOS";
    f.roster.roster.is_editable = 0;
    const result = await f.load();
    expect(result.roster?.every((row) => row.lock === "locked")).toBe(true);
    expect(result.lineup?.assignments.find((row) => row.position === "G")?.playerId).toBeNull();
  });
  it("keeps stale ownership unknown and an empty available pool empty", async () => {
    const f = fixture();
    f.provider.mockImplementation(async (args) => ({ payload: args.resource.type === "roster" ? f.roster : f.availability,
      transport: args.resource.type === "roster" ? f.transport : { ...f.transport, ageSeconds: 300 } }) as any);
    const stale = await f.load();
    expect(stale.streaming?.[0]).toMatchObject({ availability: "unknown", incrementalValue: null });
    expect(stale.lineup?.status).toBe("complete");
    f.availability.players = { count: 0 } as any;
    const omitted = await f.load();
    expect(omitted.streaming).toHaveLength(0);
    expect(omitted.streamingCoverage?.playersChecked).toBe(0);
    f.availability.players = { count: 1 } as any;
    expect((await f.load()).limitations).toContain("League availability could not be refreshed.");
  });
  it("separates daily lineup edits from acquisition deadlines and never overrides roster-wide locks", async () => {
    const f = fixture();
    f.settings.weekly_deadline = "tomorrow";
    expect((await f.load()).roster?.every((row) => row.lock === "unlocked")).toBe(true);
    const tomorrow = await f.load();
    expect(tomorrow.acquisitionRules?.timing).toBe("next_day");
    expect(tomorrow.streaming?.[0]).toMatchObject({ usableToday: false, incrementalValue: null });
    expect(tomorrow.streaming?.[0].limitations).toContain("This league applies new acquisitions on the following day; they cannot improve today's lineup.");
    Object.assign(f.roster.roster.players[0].player, { is_editable: 1 });
    f.roster.roster.is_editable = 0;
    expect((await f.load()).roster?.[0].lock).toBe("locked");
    f.roster.roster.is_editable = 1;
    Object.assign(f.roster.roster.players[0].player, { is_editable: 0 });
    expect((await f.load()).roster?.[0].lock).toBe("locked");
    Object.assign(f.roster.roster.players[0].player, { is_editable: 1 });
    f.settings.roster_type = "week";
    const weekly = await f.load();
    expect(weekly.roster?.[0].lock).toBe("unknown");
    expect(weekly.acquisitionRules?.timing).toBe("unverified");
    expect(weekly.streaming?.[0].usableToday).toBeNull();
    f.settings.roster_type = "date";
    f.transport.ageSeconds = 300;
    const stale = await f.load();
    expect(stale.acquisitionRules?.timing).toBe("unverified");
    expect(stale.streaming?.[0].usableToday).toBeNull();
  });
  it("uses current official game times and states for locks and withholds uncertain schedule decisions", async () => {
    const f = fixture();
    const game = f.schedule.gameWeek[0].games[0];
    game.startTimeUTC = "2026-10-10T15:00:00Z";
    expect((await f.load()).roster?.[0].lock).toBe("locked");
    game.startTimeUTC = "2026-10-10T23:00:00Z";
    game.gameState = "LIVE";
    expect((await f.load()).roster?.[0].lock).toBe("locked");
    game.gameState = "FUT";
    game.gameScheduleState = "PPD";
    expect((await f.load()).roster?.[0]).toMatchObject({ lock: "unknown", scheduleStatus: "unknown" });
    game.gameScheduleState = "OK";
    game.startTimeUTC = "invalid";
    expect((await f.load()).roster?.[0].lock).toBe("unknown");
    game.startTimeUTC = "2026-10-10T23:00:00Z";
    f.schedule.gameWeek[0].numberOfGames = 2;
    expect((await f.load()).roster?.[0].lock).toBe("unknown");
    f.schedule.gameWeek[0].numberOfGames = 1;
    f.roster.roster.players[0].player.editorial_team_abbr = "BOS";
    expect((await f.load()).roster?.[0].lock).toBe("unknown");
  });
  it("recognizes explicit daily Yahoo timing when NHL settings omit roster_type", async () => {
    const f = fixture();
    Reflect.deleteProperty(f.settings, "roster_type");
    for (const deadline of ["intraday", "tomorrow"]) {
      f.settings.weekly_deadline = deadline;
      const result = await f.load();
      expect(result.lineup?.status).toBe("complete");
      expect(result.roster?.every((row) => row.lock === "unlocked")).toBe(true);
      expect(result.streaming?.[0].incrementalValue).toBeNull();
    }
    for (const deadline of ["", "1", "unknown"]) {
      f.settings.weekly_deadline = deadline;
      expect((await f.load()).roster?.every((row) => row.lock === "unknown")).toBe(true);
    }
    f.settings.weekly_deadline = "intraday";
    f.settings.roster_type = "week";
    expect((await f.load()).roster?.[0].lock).toBe("unknown");
    Reflect.deleteProperty(f.settings, "roster_type");
    f.roster.roster.is_editable = 0;
    expect((await f.load()).roster?.[0].lock).toBe("locked");
    f.roster.roster.is_editable = 1;
    f.transport.ageSeconds = 300;
    expect((await f.load()).roster?.[0].lock).toBe("unknown");
  });
  it("finds today's available candidate beyond the first page and isolates partial discovery failures", async () => {
    const f = fixture();
    const candidate = f.availability.players[0].player;
    f.provider.mockImplementation(async (args) => {
      if (args.resource.type === "roster") return { payload: f.roster, transport: f.transport } as any;
      if (args.resource.type !== "available_players") throw new Error("Only available-player discovery is expected");
      if (args.resource.start === 50) throw new Error("provider page unavailable");
      const players = args.resource.start === 0 ? { count: 25, ...Object.fromEntries(Array.from({ length: 25 }, (_, index) =>
        [index, { player: { ...candidate, player_key: `477.p.${200 + index}` } }])) }
        : args.resource.start === 25 ? f.availability.players : { count: 0 };
      return { payload: { league_key: "477.l.1", players }, transport: f.transport } as any;
    });
    const result = await f.load();
    expect(result.streaming?.[0]).toMatchObject({ playerId: "477.p.3", availability: "free_agent", incrementalValue: null });
    expect(result.streamingCoverage).toMatchObject({ playersChecked: 26, pagesAttempted: 4, matchedToday: 1, capReached: false });
    expect(result.limitations).toContain("Part of Yahoo's available-player shortlist could not be refreshed.");
    expect(result.lineup?.status).toBe("complete");
  });
  it("bounds discovery at 100 and treats duplicate ownership between pages as unknown", async () => {
    const f = fixture();
    const candidate = f.availability.players[0].player;
    f.provider.mockImplementation(async (args) => {
      if (args.resource.type === "roster") return { payload: f.roster, transport: f.transport } as any;
      if (args.resource.type !== "available_players") throw new Error("Unexpected resource");
      const start = args.resource.start;
      return { payload: { league_key: "477.l.1", players: { count: 25,
        ...Object.fromEntries(Array.from({ length: 25 }, (_, index) => [index, { player: { ...candidate,
          player_key: index === 0 ? "477.p.3" : `477.p.${200 + start + index}` } }])) } }, transport: f.transport } as any;
    });
    const result = await f.load();
    expect(result.streaming?.[0]).toMatchObject({ playerId: "477.p.3", availability: "unknown" });
    expect(result.streamingCoverage).toMatchObject({ pagesAttempted: 4, capReached: true, playersChecked: 97 });
    expect(result.limitations).toContain("Only the first 100 Yahoo-ranked available players were checked; other streaming options may exist.");
  });
  it("rejects mismatched team/date responses and preserves stale-roster limitations", async () => {
    const f = fixture();
    f.roster.roster.date = "2026-10-09";
    await expect(f.load()).rejects.toThrow("date or team");
    f.roster.roster.date = "2026-10-10";
    f.transport.ageSeconds = 300;
    const result = await f.load();
    expect(result.lineup?.status).toBe("incomplete");
    expect(result.roster?.[1]).toMatchObject({ value: null, valueBasis: "missing", lock: "unknown" });
  });
  it("aborts a slow schedule read and returns explicit missing evidence", async () => {
    vi.useFakeTimers();
    const f = fixture();
    let aborted = false;
    vi.mocked(nhlSchedule.getScheduleDaily).mockImplementation((_date, signal) => new Promise((_resolve, reject) => {
      signal!.addEventListener("abort", () => { aborted = true; reject(new Error("Schedule timeout")); });
    }));
    const pending = f.load();
    await vi.advanceTimersByTimeAsync(5_001);
    const result = await pending;
    expect(aborted).toBe(true);
    expect(result.lineup?.status).toBe("incomplete");
    expect(result.scheduleFetchedAt).toBeNull();
    expect(result.roster?.[1].value).toBeNull();
  });
});
