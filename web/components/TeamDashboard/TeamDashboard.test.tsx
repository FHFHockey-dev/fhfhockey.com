import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { fetchWithCacheMock, fromMock, useCurrentSeasonQueryMock } = vi.hoisted(
  () => ({
    fetchWithCacheMock: vi.fn(),
    fromMock: vi.fn(),
    useCurrentSeasonQueryMock: vi.fn(),
  }),
);

vi.mock("lib/supabase", () => ({
  default: { from: fromMock },
}));

vi.mock("hooks/useCurrentSeason", () => ({
  useCurrentSeasonQuery: useCurrentSeasonQueryMock,
}));

vi.mock("lib/fetchWithCache", () => ({
  default: fetchWithCacheMock,
}));

vi.mock("./GameByGameTimeline", () => ({
  GameByGameTimeline: () => <div>Game timeline</div>,
}));

vi.mock("./AdvancedL10Metrics", () => ({
  AdvancedL10Metrics: () => <div>Advanced metrics</div>,
}));

vi.mock("./TeamLeaders", () => ({
  TeamLeaders: () => <div>Team leaders</div>,
}));

import { TeamDashboard } from "./TeamDashboard";

type SummaryResult = {
  data: Record<string, unknown> | null;
  error: Error | null;
};

type QueryResult = {
  data: unknown;
  error: Error | null;
};

type CompleteRequest = {
  summary: QueryResult | Promise<QueryResult>;
  standings?: QueryResult;
  stats5v5?: QueryResult;
  specialTeams?: QueryResult;
  allTeamsSummary?: QueryResult;
  allTeamsStandings?: QueryResult;
  allTeamsAdvanced?: QueryResult;
  allTeamsSpecialTeams?: QueryResult;
};

type SeasonQueryState = {
  data: Record<string, unknown> | null | undefined;
  error: Error | null;
  isError: boolean;
  isPending: boolean;
  status: "pending" | "success" | "error";
};

function createDeferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;

  const promise = new Promise<T>((promiseResolve, promiseReject) => {
    resolve = promiseResolve;
    reject = promiseReject;
  });

  return { promise, resolve, reject };
}

function createSummaryQuery(result: Promise<SummaryResult>) {
  const query: any = {};
  query.select = vi.fn(() => query);
  query.eq = vi.fn(() => query);
  query.single = vi.fn(() => result);
  return query;
}

function installSummaryResults(...results: Promise<SummaryResult>[]) {
  const queries = results.map(createSummaryQuery);
  let index = 0;

  fromMock.mockImplementation((table: string) => {
    if (table !== "team_summary_years") {
      throw new Error(`Unexpected table: ${table}`);
    }

    const query = queries[index];
    index += 1;
    if (!query) throw new Error("Missing summary query result");
    return query;
  });

  return queries;
}

function createThenableQuery(result: QueryResult | Promise<QueryResult>) {
  const resultPromise = Promise.resolve(result);
  const query: any = {};
  query.select = vi.fn(() => query);
  query.eq = vi.fn(() => query);
  query.gte = vi.fn(() => query);
  query.lte = vi.fn(() => query);
  query.order = vi.fn(() => query);
  query.limit = vi.fn(() => query);
  query.single = vi.fn(() => resultPromise);
  query.then = (resolve: (value: QueryResult) => unknown, reject: unknown) =>
    resultPromise.then(resolve, reject as (reason: unknown) => unknown);
  return query;
}

function installCompleteRequests(...requests: CompleteRequest[]) {
  const queriesByTable: Record<string, any[]> = {
    team_summary_years: [],
    nhl_standings_details: [],
    nst_team_5v5: [],
    wgo_team_stats: [],
  };
  const emptyResult = { data: [], error: null };

  requests.forEach((request) => {
    queriesByTable.team_summary_years.push(
      createThenableQuery(request.summary),
      createThenableQuery(request.allTeamsSummary ?? emptyResult),
    );
    queriesByTable.nhl_standings_details.push(
      createThenableQuery(request.standings ?? emptyResult),
      createThenableQuery(request.allTeamsStandings ?? emptyResult),
    );
    queriesByTable.nst_team_5v5.push(
      createThenableQuery(request.stats5v5 ?? emptyResult),
      createThenableQuery(request.allTeamsAdvanced ?? emptyResult),
    );
    queriesByTable.wgo_team_stats.push(
      createThenableQuery(request.specialTeams ?? emptyResult),
      createThenableQuery(request.allTeamsSpecialTeams ?? emptyResult),
    );
  });

  const remainingByTable = Object.fromEntries(
    Object.entries(queriesByTable).map(([table, queries]) => [
      table,
      [...queries],
    ]),
  );

  fromMock.mockImplementation((table: string) => {
    const query = remainingByTable[table]?.shift();
    if (!query) throw new Error(`Missing query result for ${table}`);
    return query;
  });

  return queriesByTable;
}

function pendingSeasonQuery(): SeasonQueryState {
  return {
    data: undefined,
    error: null,
    isError: false,
    isPending: true,
    status: "pending",
  };
}

function successfulSeasonQuery(
  data: Record<string, unknown> | null,
): SeasonQueryState {
  return {
    data,
    error: null,
    isError: false,
    isPending: false,
    status: "success",
  };
}

function failedSeasonQuery(error: Error): SeasonQueryState {
  return {
    data: undefined,
    error,
    isError: true,
    isPending: false,
    status: "error",
  };
}

function teamSummaryFixture(overrides: Record<string, unknown> = {}) {
  return {
    team_id: 22,
    games_played: 1,
    wins: 1,
    losses: 0,
    ot_losses: 0,
    points: 2,
    goals_for: 3,
    goals_against: 2,
    point_pct: 1,
    regulation_and_ot_wins: 1,
    faceoff_win_pct: 0.51,
    penalty_kill_pct: 0.82,
    power_play_pct: 0.25,
    shots_for_per_game: 30,
    shots_against_per_game: 28,
    ...overrides,
  };
}

function standingsFixture(overrides: Record<string, unknown> = {}) {
  return {
    team_abbrev: "EDM",
    league_sequence: 1,
    conference_sequence: 2,
    division_sequence: 3,
    streak_code: "W",
    streak_count: 2,
    l10_wins: 7,
    l10_losses: 2,
    l10_ot_losses: 1,
    l10_goals_for: 30,
    l10_goals_against: 20,
    division_name: "Pacific",
    conference_name: "Western",
    home_wins: 1,
    home_losses: 0,
    home_ot_losses: 0,
    road_wins: 0,
    road_losses: 0,
    road_ot_losses: 0,
    ...overrides,
  };
}

function advancedFixture(overrides: Record<string, unknown> = {}) {
  return {
    team_abbreviation: "EDM",
    cf_pct: 0.55,
    xgf_pct: 0.56,
    pdo: 1,
    hdcf_pct: 0.54,
    scf_pct: 0.53,
    sv_pct: 0.92,
    sh_pct: 0.1,
    gp: 1,
    xgf: 3,
    xga: 2,
    date: "2024-10-10",
    ...overrides,
  };
}

function specialTeamsFixture(overrides: Record<string, unknown> = {}) {
  return {
    team_id: 22,
    power_play_pct: 0.25,
    penalty_kill_pct: 0.82,
    pp_opportunities_per_game: 3,
    power_play_goals_for: 1,
    pp_goals_against: 0,
    sh_goals_for: 0,
    sh_goals_against: 0,
    ...overrides,
  };
}

describe("TeamDashboard season and request ownership", () => {
  beforeEach(() => {
    fetchWithCacheMock.mockReset();
    fetchWithCacheMock.mockResolvedValue({ data: [], games: [] });
    fromMock.mockReset();
    useCurrentSeasonQueryMock.mockReset();
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it("keeps the loading state while season resolution is pending", () => {
    useCurrentSeasonQueryMock.mockReturnValue(pendingSeasonQuery());

    render(<TeamDashboard teamId="22" teamAbbrev="EDM" />);

    expect(screen.getByText("Loading team dashboard...")).toBeTruthy();
    expect(fromMock).not.toHaveBeenCalled();
  });

  it("terminates a successful empty season lookup without querying", async () => {
    useCurrentSeasonQueryMock.mockReturnValue(successfulSeasonQuery(null));

    render(<TeamDashboard teamId="22" teamAbbrev="EDM" />);

    expect(
      await screen.findByText("Team dashboard requires a season selection."),
    ).toBeTruthy();
    expect(screen.queryByText("Loading team dashboard...")).toBeNull();
    expect(fromMock).not.toHaveBeenCalled();
  });

  it("contains a terminal season-query failure behind a stable error", async () => {
    useCurrentSeasonQueryMock.mockReturnValue(
      failedSeasonQuery(new Error("upstream season details")),
    );

    render(<TeamDashboard teamId="22" teamAbbrev="EDM" />);

    expect(
      await screen.findByText("Unable to load the current season."),
    ).toBeTruthy();
    expect(screen.queryByText("upstream season details")).toBeNull();
    expect(fromMock).not.toHaveBeenCalled();
  });

  it("starts the exact season query after pending resolution", async () => {
    let seasonQuery = pendingSeasonQuery();
    useCurrentSeasonQueryMock.mockImplementation(() => seasonQuery);
    const query = installSummaryResults(
      Promise.resolve({
        data: null,
        error: new Error("dashboard unavailable"),
      }),
    )[0];
    vi.spyOn(console, "error").mockImplementation(() => undefined);

    const view = render(<TeamDashboard teamId="22" teamAbbrev="EDM" />);
    expect(fromMock).not.toHaveBeenCalled();

    seasonQuery = successfulSeasonQuery({ seasonId: 20252026 });
    view.rerender(<TeamDashboard teamId="22" teamAbbrev="EDM" />);

    await waitFor(() => {
      expect(query.single).toHaveBeenCalledOnce();
    });
    expect(query.eq).toHaveBeenCalledWith("team_id", 22);
    expect(query.eq).toHaveBeenCalledWith("season_id", 20252026);
  });

  it("lets an explicit season bypass pending current-season lookup", async () => {
    useCurrentSeasonQueryMock.mockReturnValue(pendingSeasonQuery());
    const query = installSummaryResults(
      Promise.resolve({
        data: null,
        error: new Error("dashboard unavailable"),
      }),
    )[0];
    vi.spyOn(console, "error").mockImplementation(() => undefined);

    render(<TeamDashboard teamId="22" teamAbbrev="EDM" seasonId="20242025" />);

    await waitFor(() => {
      expect(query.single).toHaveBeenCalledOnce();
    });
    expect(query.eq).toHaveBeenCalledWith("season_id", 20242025);
  });

  it("lets an explicit season bypass a failed current-season lookup", async () => {
    useCurrentSeasonQueryMock.mockReturnValue(
      failedSeasonQuery(new Error("unrelated current-season failure")),
    );
    const query = installSummaryResults(
      Promise.resolve({
        data: null,
        error: new Error("dashboard unavailable"),
      }),
    )[0];
    vi.spyOn(console, "error").mockImplementation(() => undefined);

    render(<TeamDashboard teamId="22" teamAbbrev="EDM" seasonId="20242025" />);

    await waitFor(() => {
      expect(query.single).toHaveBeenCalledOnce();
    });
    expect(query.eq).toHaveBeenCalledWith("season_id", 20242025);
    expect(screen.queryByText("Unable to load the current season.")).toBeNull();
  });

  it("terminates a missing team selection without querying", async () => {
    useCurrentSeasonQueryMock.mockReturnValue(pendingSeasonQuery());

    render(<TeamDashboard teamId="" teamAbbrev="" seasonId="20252026" />);

    expect(
      await screen.findByText(
        "Team dashboard requires a valid team selection.",
      ),
    ).toBeTruthy();
    expect(fromMock).not.toHaveBeenCalled();
  });

  it.each([
    {
      label: "partial team ID",
      teamId: "22suffix",
      teamAbbrev: "EDM",
      seasonId: "20242025",
      message: "Team dashboard requires a valid team selection.",
    },
    {
      label: "non-numeric team ID",
      teamId: "NaN",
      teamAbbrev: "EDM",
      seasonId: "20242025",
      message: "Team dashboard requires a valid team selection.",
    },
    {
      label: "leading-zero team ID",
      teamId: "022",
      teamAbbrev: "EDM",
      seasonId: "20242025",
      message: "Team dashboard requires a valid team selection.",
    },
    {
      label: "mismatched known team pair",
      teamId: "6",
      teamAbbrev: "EDM",
      seasonId: "20242025",
      message: "Team dashboard requires a valid team selection.",
    },
    {
      label: "unknown abbreviation",
      teamId: "22",
      teamAbbrev: "XXX",
      seasonId: "20242025",
      message: "Team dashboard requires a valid team selection.",
    },
    {
      label: "inherited object key",
      teamId: "22",
      teamAbbrev: "toString",
      seasonId: "20242025",
      message: "Team dashboard requires a valid team selection.",
    },
    {
      label: "partial season ID",
      teamId: "22",
      teamAbbrev: "EDM",
      seasonId: "20242025suffix",
      message: "Team dashboard requires a valid season selection.",
    },
    {
      label: "non-numeric season ID",
      teamId: "22",
      teamAbbrev: "EDM",
      seasonId: "not-a-season",
      message: "Team dashboard requires a valid season selection.",
    },
    {
      label: "non-consecutive season ID",
      teamId: "22",
      teamAbbrev: "EDM",
      seasonId: "20242024",
      message: "Team dashboard requires a valid season selection.",
    },
  ])(
    "rejects $label before any query",
    async ({ teamId, teamAbbrev, seasonId, message }) => {
      useCurrentSeasonQueryMock.mockReturnValue(pendingSeasonQuery());

      render(
        <TeamDashboard
          teamId={teamId}
          teamAbbrev={teamAbbrev}
          seasonId={seasonId}
        />,
      );

      expect(await screen.findByText(message)).toBeTruthy();
      expect(fromMock).not.toHaveBeenCalled();
      expect(fetchWithCacheMock).not.toHaveBeenCalled();
    },
  );

  it("ignores an older request after a team and season change", async () => {
    useCurrentSeasonQueryMock.mockReturnValue(pendingSeasonQuery());
    const older = createDeferred<SummaryResult>();
    const queries = installSummaryResults(
      older.promise,
      Promise.resolve({ data: null, error: new Error("Fresh request failed") }),
    );
    vi.spyOn(console, "error").mockImplementation(() => undefined);

    const view = render(
      <TeamDashboard teamId="22" teamAbbrev="EDM" seasonId="20242025" />,
    );

    await waitFor(() => {
      expect(queries[0].single).toHaveBeenCalledOnce();
    });

    view.rerender(
      <TeamDashboard teamId="6" teamAbbrev="BOS" seasonId="20252026" />,
    );

    expect(await screen.findByText("Fresh request failed")).toBeTruthy();

    await act(async () => {
      older.resolve({ data: { games_played: 82 }, error: null });
      await older.promise;
    });

    expect(screen.getByText("Fresh request failed")).toBeTruthy();
    expect(fromMock).toHaveBeenCalledTimes(2);
  });

  it("ignores a rejected request after unmount", async () => {
    useCurrentSeasonQueryMock.mockReturnValue(pendingSeasonQuery());
    const pending = createDeferred<SummaryResult>();
    installSummaryResults(pending.promise);
    const errorSpy = vi
      .spyOn(console, "error")
      .mockImplementation(() => undefined);

    const view = render(
      <TeamDashboard teamId="22" teamAbbrev="EDM" seasonId="20242025" />,
    );

    await waitFor(() => {
      expect(fromMock).toHaveBeenCalledOnce();
    });
    view.unmount();

    await act(async () => {
      pending.reject(new Error("stale request detail"));
      await pending.promise.catch(() => undefined);
    });

    expect(errorSpy).not.toHaveBeenCalled();
  });

  it("keeps an explicit historical season on deterministic date bounds", async () => {
    let seasonQuery = pendingSeasonQuery();
    useCurrentSeasonQueryMock.mockImplementation(() => seasonQuery);
    const queries = installCompleteRequests({
      summary: { data: null, error: null },
    });

    const view = render(
      <TeamDashboard teamId="22" teamAbbrev="EDM" seasonId="20242025" />,
    );

    expect(await screen.findByText("No standings data available")).toBeTruthy();
    expect(queries.team_summary_years[0].eq).toHaveBeenCalledWith(
      "team_id",
      22,
    );
    expect(queries.team_summary_years[0].eq).toHaveBeenCalledWith(
      "season_id",
      20242025,
    );
    for (const query of queries.nst_team_5v5) {
      expect(query.gte).toHaveBeenCalledWith("date", "2024-10-01");
      expect(query.lte).toHaveBeenCalledWith("date", "2025-04-30");
    }
    const historicalGoalieUrls = fetchWithCacheMock.mock.calls
      .map(([url]) => String(url))
      .filter((url) => url.includes("/goalie/"));
    expect(historicalGoalieUrls).toHaveLength(2);
    expect(
      historicalGoalieUrls.every(
        (url) =>
          url.includes("gameDate>='2024-10-01'") &&
          url.includes("gameDate<='2025-04-30'"),
      ),
    ).toBe(true);

    seasonQuery = successfulSeasonQuery({
      seasonId: 20252026,
      regularSeasonStartDate: "2025-10-07T00:00:00Z",
      regularSeasonEndDate: "2026-04-16T00:00:00Z",
      seasonEndDate: "2026-06-22T00:00:00Z",
    });
    view.rerender(
      <TeamDashboard teamId="22" teamAbbrev="EDM" seasonId="20242025" />,
    );

    await act(async () => Promise.resolve());
    expect(fromMock).toHaveBeenCalledTimes(8);
  });

  it("uses selected-season metadata and preserves regular-season goalie bounds", async () => {
    useCurrentSeasonQueryMock.mockReturnValue(
      successfulSeasonQuery({
        seasonId: 20252026,
        regularSeasonStartDate: "2025-10-07T00:00:00Z",
        regularSeasonEndDate: "2026-04-16T00:00:00Z",
        seasonEndDate: "2026-06-22T00:00:00Z",
      }),
    );
    const summary = teamSummaryFixture();
    const standings = standingsFixture();
    const completeRequest = {
      summary: { data: summary, error: null },
      standings: { data: [standings], error: null },
      specialTeams: { data: [specialTeamsFixture()], error: null },
      allTeamsSummary: { data: [summary], error: null },
    };
    const queries = installCompleteRequests(completeRequest, completeRequest);

    render(<TeamDashboard teamId="22" teamAbbrev="EDM" seasonId="20252026" />);

    await waitFor(() => expect(fromMock).toHaveBeenCalledTimes(8));
    expect(screen.getByText("1st")).toBeTruthy();
    expect(screen.getByText("2nd")).toBeTruthy();
    expect(screen.getByText("3rd")).toBeTruthy();
    expect(screen.getByText("GF/GP").parentElement?.textContent).toContain(
      "3.00",
    );
    expect(
      screen.getAllByText("GA/GP")[0].parentElement?.textContent,
    ).toContain("2.00");
    for (const query of queries.nst_team_5v5.slice(0, 2)) {
      expect(query.gte).toHaveBeenCalledWith("date", "2025-10-07");
      expect(query.lte).toHaveBeenCalledWith("date", "2026-04-16");
    }

    fireEvent.click(screen.getByRole("button", { name: "Playoffs" }));
    expect(screen.getByText("Loading team dashboard...")).toBeTruthy();
    await waitFor(() => {
      expect(screen.queryByText("Loading team dashboard...")).toBeNull();
      expect(fromMock).toHaveBeenCalledTimes(16);
    });

    for (const query of queries.nst_team_5v5.slice(2)) {
      expect(query.gte).toHaveBeenCalledWith("date", "2025-10-07");
      expect(query.lte).toHaveBeenCalledWith("date", "2026-06-22");
    }
    const playoffGoalieUrls = fetchWithCacheMock.mock.calls
      .slice(-2)
      .map(([url]) => String(url));
    expect(playoffGoalieUrls).toHaveLength(2);
    expect(
      playoffGoalieUrls.every(
        (url) =>
          url.includes("gameDate>='2025-10-07'") &&
          url.includes("gameDate<='2026-04-16'"),
      ),
    ).toBe(true);
  });

  it("does not issue reversed goalie requests before a selected season starts", async () => {
    useCurrentSeasonQueryMock.mockReturnValue(
      successfulSeasonQuery({
        seasonId: 20992100,
        regularSeasonStartDate: "2099-10-05T00:00:00Z",
        regularSeasonEndDate: "2100-04-15T00:00:00Z",
        seasonEndDate: "2100-06-20T00:00:00Z",
      }),
    );
    installCompleteRequests({ summary: { data: null, error: null } });

    render(<TeamDashboard teamId="22" teamAbbrev="EDM" seasonId="20992100" />);

    expect(await screen.findByText("No standings data available")).toBeTruthy();
    expect(fetchWithCacheMock).not.toHaveBeenCalled();
    expect(screen.getByText("No goaltending data available")).toBeTruthy();
  });

  it("keeps goalie workload finite when the schedule feed is empty", async () => {
    useCurrentSeasonQueryMock.mockReturnValue(pendingSeasonQuery());
    installCompleteRequests({ summary: { data: null, error: null } });
    fetchWithCacheMock.mockImplementation(async (url: string) => {
      if (url.includes("club-schedule-season/EDM")) return { games: [] };
      if (url.includes("/goalie/summary")) {
        return {
          data: [
            {
              playerId: 1,
              goalieFullName: "Lagging Schedule Goalie",
              lastName: "Goalie",
              gamesPlayed: 1,
              gamesStarted: 1,
              wins: 1,
              losses: 0,
              otLosses: 0,
              savePct: 0.92,
              goalsAgainstAverage: 2,
              shutouts: 0,
              saves: 23,
              shotsAgainst: 25,
              goalsAgainst: 2,
              timeOnIce: 3600,
            },
          ],
        };
      }
      return { data: [] };
    });

    render(<TeamDashboard teamId="22" teamAbbrev="EDM" seasonId="20242025" />);

    expect(await screen.findByText("Lagging Schedule Goalie")).toBeTruthy();
    expect(screen.getByText(/0\.0% of\s*starts/)).toBeTruthy();
    expect(document.body.textContent).not.toMatch(/NaN|Infinity/);
  });

  it("hides prior identity data and terminates empty replacement states", async () => {
    useCurrentSeasonQueryMock.mockReturnValue(pendingSeasonQuery());
    const replacementSummary = createDeferred<QueryResult>();
    const richSummary = teamSummaryFixture({ games_played: 0 });
    const richStandings = standingsFixture({
      league_sequence: 11,
      conference_sequence: 12,
      division_sequence: 13,
      division_name: "Old Division",
      conference_name: "Old Conference",
    });
    installCompleteRequests(
      {
        summary: { data: richSummary, error: null },
        standings: { data: [richStandings], error: null },
        stats5v5: { data: [advancedFixture()], error: null },
        specialTeams: { data: [specialTeamsFixture()], error: null },
        allTeamsSummary: { data: [richSummary], error: null },
        allTeamsStandings: { data: [richStandings], error: null },
        allTeamsAdvanced: { data: [advancedFixture()], error: null },
        allTeamsSpecialTeams: {
          data: [specialTeamsFixture()],
          error: null,
        },
      },
      {
        summary: replacementSummary.promise,
      },
    );
    fetchWithCacheMock.mockImplementation(async (url: string) => {
      if (url.includes("club-schedule-season/EDM")) {
        return { games: [{ gameType: 2, gameDate: "2024-10-10" }] };
      }
      if (url.includes("club-schedule-season/BOS")) return { games: [] };
      if (url.includes("/goalie/summary") && url.includes("franchiseId=25")) {
        return {
          data: [
            {
              playerId: 1,
              goalieFullName: "Old Goalie",
              lastName: "Goalie",
              gamesPlayed: 1,
              gamesStarted: 1,
              wins: 1,
              losses: 0,
              otLosses: 0,
              savePct: 0.92,
              goalsAgainstAverage: 2,
              shutouts: 0,
              saves: 23,
              shotsAgainst: 25,
              goalsAgainst: 2,
              timeOnIce: 3600,
            },
          ],
        };
      }
      return { data: [], games: [] };
    });

    const view = render(
      <TeamDashboard teamId="22" teamAbbrev="EDM" seasonId="20242025" />,
    );

    expect(await screen.findByText("Old Division")).toBeTruthy();
    expect(screen.getByText("Old Goalie")).toBeTruthy();
    expect(screen.getByText("Game timeline")).toBeTruthy();
    expect(screen.getByText("11th")).toBeTruthy();
    expect(screen.getByText("12th")).toBeTruthy();
    expect(screen.getByText("13th")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Regular Season" })).toBeTruthy();
    expect(screen.getByText("GF/GP").parentElement?.textContent).toContain(
      "N/A",
    );
    expect(
      screen.getAllByText("GA/GP")[0].parentElement?.textContent,
    ).toContain("N/A");
    expect(document.body.textContent).not.toMatch(/NaN|Infinity/);

    view.rerender(
      <TeamDashboard teamId="6" teamAbbrev="BOS" seasonId="20252026" />,
    );

    expect(screen.getByText("Loading team dashboard...")).toBeTruthy();
    expect(screen.queryByText("Old Division")).toBeNull();
    expect(screen.queryByText("Old Goalie")).toBeNull();
    expect(screen.queryByText("Game timeline")).toBeNull();

    await act(async () => {
      replacementSummary.resolve({
        data: teamSummaryFixture({ team_id: 6 }),
        error: null,
      });
      await replacementSummary.promise;
    });

    expect(await screen.findByText("No advanced stats available")).toBeTruthy();
    expect(screen.getByText("No goaltending data available")).toBeTruthy();
    expect(screen.getByText("No league rankings available")).toBeTruthy();
    expect(screen.getByText("NHL").parentElement?.textContent).toContain("N/A");
    expect(screen.queryByText("0th")).toBeNull();
    expect(screen.queryByText("Old Division")).toBeNull();
    expect(screen.queryByText("Old Goalie")).toBeNull();
    expect(screen.queryByText("Game timeline")).toBeNull();
    expect(screen.getByTitle(/based on 0 game records/)).toBeTruthy();
  });
});
