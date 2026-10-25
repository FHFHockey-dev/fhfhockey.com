import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const {
  calendarPropsMock,
  fromMock,
  linePropsMock,
  routerState,
  shotPropsMock,
  useTeamScheduleMock,
} = vi.hoisted(
  () => ({
    calendarPropsMock: vi.fn(),
    fromMock: vi.fn(),
    linePropsMock: vi.fn(),
    shotPropsMock: vi.fn(),
    routerState: {
      isReady: true,
      pathname: "/teams/[teamAbbrev]",
      query: { tab: "schedule" } as { tab?: string | string[] },
      replace: vi.fn(),
    },
    useTeamScheduleMock: vi.fn(),
  }),
);

vi.mock("next/router", () => ({
  useRouter: () => routerState,
}));

vi.mock("lib/supabase", () => ({ default: { from: fromMock } }));

vi.mock("hooks/useTeamSchedule", () => ({
  useTeamSchedule: useTeamScheduleMock,
}));

vi.mock("../TeamDashboard/TeamDashboard", () => ({
  TeamDashboard: () => <div>Team dashboard</div>,
}));

vi.mock("../GameStateAnalysis/GameStateAnalysis", () => ({
  GameStateAnalysis: () => <div>Game-state analysis</div>,
}));

vi.mock("../MetricsTimeline/MetricsTimeline", () => ({
  default: () => <div>Metrics timeline</div>,
}));

vi.mock("../RosterMatrix/RosterMatrixWrapper", () => ({
  default: () => <div>Roster matrix</div>,
}));

vi.mock("../ShotVisualization/ShotVisualization", () => ({
  ShotVisualization: (props: unknown) => {
    shotPropsMock(props);
    return <div>Shot visualization</div>;
  },
}));

vi.mock("../LineCombinations/LineCombinationsGrid", () => ({
  LineCombinationsGrid: (props: unknown) => {
    linePropsMock(props);
    return <div>Line combinations</div>;
  },
}));

vi.mock("../TeamScheduleCalendar/TeamScheduleCalendar", () => ({
  TeamScheduleCalendar: (props: {
    teamId: number | string;
    teamAbbreviation: string;
    seasonId: string;
    standingsDetails?: { team_abbrev: string } | null;
  }) => {
    calendarPropsMock(props);
    return (
      <div
        data-testid="team-schedule-calendar"
        data-team-id={props.teamId}
        data-team-abbreviation={props.teamAbbreviation}
      />
    );
  },
}));

import { TeamTabNavigation } from "./TeamTabNavigation";

const baseScheduleResult = {
  games: [],
  loading: false,
  error: null,
  record: null,
  standingsDetails: null,
};

const baseProps = {
  filters: {},
  onFilterChange: vi.fn(),
};

describe("TeamTabNavigation schedule identity", () => {
  beforeEach(() => {
    routerState.isReady = true;
    routerState.pathname = "/teams/[teamAbbrev]";
    routerState.query = { tab: "schedule" };
    routerState.replace.mockReset();
    calendarPropsMock.mockReset();
    useTeamScheduleMock.mockReset();
  });

  afterEach(() => cleanup());

  it("forwards the synchronous Arizona source identity for canonical Utah's 2023-24 schedule", () => {
    useTeamScheduleMock.mockReturnValue({
      ...baseScheduleResult,
      scheduleTeam: { id: 53, abbreviation: "ARI" },
    });

    render(
      <TeamTabNavigation
        {...baseProps}
        teamId="68"
        teamAbbrev="UTA"
        seasonId="20232024"
      />,
    );

    expect(useTeamScheduleMock).toHaveBeenCalledWith("UTA", "20232024", "68");
    expect(screen.getByTestId("team-schedule-calendar")).toBeTruthy();

    const firstCalendarProps = calendarPropsMock.mock.calls[0]?.[0];
    expect(firstCalendarProps).toMatchObject({
      teamId: 53,
      teamAbbreviation: "ARI",
      seasonId: "20232024",
    });
    expect(calendarPropsMock).not.toHaveBeenCalledWith(
      expect.objectContaining({
        teamId: 68,
        teamAbbreviation: "UTA",
      }),
    );
  });

  it("preserves an ordinary current-team schedule identity", () => {
    const standingsDetails = { team_abbrev: "EDM" };
    useTeamScheduleMock.mockReturnValue({
      ...baseScheduleResult,
      standingsDetails,
      scheduleTeam: { id: 22, abbreviation: "EDM" },
    });

    render(
      <TeamTabNavigation
        {...baseProps}
        teamId="22"
        teamAbbrev="EDM"
        seasonId="20252026"
      />,
    );

    expect(useTeamScheduleMock).toHaveBeenCalledWith("EDM", "20252026", "22");
    expect(calendarPropsMock.mock.calls[0]?.[0]).toMatchObject({
      teamId: 22,
      teamAbbreviation: "EDM",
      seasonId: "20252026",
      standingsDetails,
    });
  });

  it("does not mount the calendar before a validated schedule identity exists", () => {
    useTeamScheduleMock.mockReturnValue({
      ...baseScheduleResult,
      loading: true,
      scheduleTeam: null,
    });

    render(
      <TeamTabNavigation
        {...baseProps}
        teamId="68"
        teamAbbrev="UTA"
        seasonId="20232024"
      />,
    );

    expect(screen.getByRole("status").textContent).toBe("Loading schedule...");
    expect(screen.queryByTestId("team-schedule-calendar")).toBeNull();
    expect(calendarPropsMock).not.toHaveBeenCalled();
  });
});

type QueryResult = { data: unknown; error: unknown };

function query(result: QueryResult | Promise<QueryResult>) {
  const chain: any = {};
  for (const method of ["select", "eq", "order", "limit", "in"]) {
    chain[method] = vi.fn(() => chain);
  }
  chain.then = (
    resolve: (value: QueryResult) => unknown,
    reject: (error: unknown) => unknown,
  ) => Promise.resolve(result).then(resolve, reject);
  return chain;
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((yes) => {
    resolve = yes;
  });
  return { promise, resolve };
}

const lineRow = (team: number, forwards: unknown[], defensemen: unknown[]) => ({
  forwards,
  defensemen,
  goalies: [team * 100 + 30, team * 100 + 31],
  gameId: 2026020001,
});
const playerRows = (ids: string[]) =>
  ids.map((id) => ({ nhl_player_id: id, nhl_player_name: `Player ${id}` }));

function routeTables(tables: Record<string, () => unknown>) {
  fromMock.mockImplementation((table: string) => {
    const next = tables[table];
    if (!next) throw new Error(`Unexpected read: ${table}`);
    return next();
  });
}

async function flush() {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });
}

const tables = () => fromMock.mock.calls.map(([table]) => table);

describe("TeamTabNavigation Season Stats line combinations", () => {
  beforeEach(() => {
    routerState.isReady = true;
    routerState.query = {};
    fromMock.mockReset();
    linePropsMock.mockReset();
    useTeamScheduleMock.mockReset();
    useTeamScheduleMock.mockReturnValue({
      ...baseScheduleResult,
      scheduleTeam: null,
    });
  });

  afterEach(() => cleanup());

  it("reads nothing while other tabs are shown and reuses the result when the tab returns", async () => {
    routeTables({
      lineCombinations: () =>
        query({ data: [lineRow(22, [2201, 2202], [2220])], error: null }),
      yahoo_nhl_player_map: () =>
        query({
          data: playerRows(["2201", "2202", "2220", "2230", "2231"]),
          error: null,
        }),
    });
    const view = render(
      <TeamTabNavigation {...baseProps} teamId="22" teamAbbrev="EDM" seasonId="20252026" />,
    );
    routerState.query = { tab: "visualization" };
    view.rerender(
      <TeamTabNavigation {...baseProps} teamId="22" teamAbbrev="EDM" seasonId="20252026" />,
    );
    await flush();
    expect(fromMock).not.toHaveBeenCalled();

    routerState.query = { tab: "stats" };
    view.rerender(
      <TeamTabNavigation {...baseProps} teamId="22" teamAbbrev="EDM" seasonId="20252026" />,
    );
    expect(screen.getByText("Loading...")).toBeTruthy();
    await flush();
    expect(tables()).toEqual(["lineCombinations", "yahoo_nhl_player_map"]);
    expect(linePropsMock).toHaveBeenLastCalledWith(
      expect.objectContaining({
        forwards: ["2201", "2202"],
        defensemen: ["2220"],
        goalies: ["2230", "2231"],
        playerMap: expect.objectContaining({ "2201": expect.any(Object) }),
      }),
    );

    routerState.query = {};
    view.rerender(
      <TeamTabNavigation {...baseProps} teamId="22" teamAbbrev="EDM" seasonId="20252026" />,
    );
    routerState.query = { tab: "stats" };
    view.rerender(
      <TeamTabNavigation {...baseProps} teamId="22" teamAbbrev="EDM" seasonId="20252026" />,
    );
    await flush();
    expect(fromMock).toHaveBeenCalledTimes(2);
    expect(screen.getByText("Line combinations")).toBeTruthy();
  });

  it("discards a late response for the previous team after A → B", async () => {
    routerState.query = { tab: "stats" };
    const teamA = deferred<QueryResult>();
    const lineReads = [
      () => query(teamA.promise),
      () => query({ data: [lineRow(10, [1001], [1020])], error: null }),
    ];
    routeTables({
      lineCombinations: () => lineReads.shift()!(),
      yahoo_nhl_player_map: () => query({ data: [], error: null }),
    });
    const view = render(
      <TeamTabNavigation {...baseProps} teamId="22" teamAbbrev="EDM" seasonId="20252026" />,
    );
    view.rerender(
      <TeamTabNavigation {...baseProps} teamId="10" teamAbbrev="TOR" seasonId="20252026" />,
    );
    await flush();
    expect(linePropsMock).toHaveBeenLastCalledWith(
      expect.objectContaining({ forwards: ["1001"] }),
    );
    await act(async () => {
      teamA.resolve({ data: [lineRow(22, [2201], [2220])], error: null });
    });
    await flush();
    expect(linePropsMock).toHaveBeenLastCalledWith(
      expect.objectContaining({ forwards: ["1001"] }),
    );
    expect(linePropsMock).not.toHaveBeenCalledWith(
      expect.objectContaining({ forwards: ["2201"] }),
    );
    // The obsolete team never triggers a player-map read.
    expect(tables()).toEqual([
      "lineCombinations",
      "lineCombinations",
      "yahoo_nhl_player_map",
    ]);
  });

  it.each([
    [
      "line read error",
      { data: null, error: { message: "lines unavailable" } },
      { data: [], error: null },
      "lines unavailable",
    ],
    [
      "player map error",
      { data: [lineRow(22, [2201], [2220])], error: null },
      { data: null, error: { message: "players unavailable" } },
      "players unavailable",
    ],
    ["no persisted lines", { data: [], error: null }, { data: [], error: null }, "No line combinations found."],
  ])("shows the %s instead of a grid", async (_label, lines, players, text) => {
    routerState.query = { tab: "stats" };
    routeTables({
      lineCombinations: () => query(lines),
      yahoo_nhl_player_map: () => query(players),
    });
    render(<TeamTabNavigation {...baseProps} teamId="22" teamAbbrev="EDM" seasonId="20252026" />);
    await flush();
    expect(screen.getByText(text)).toBeTruthy();
    expect(linePropsMock).not.toHaveBeenCalled();
  });

  it("drops null and blank IDs and flattens nested line rows", async () => {
    routerState.query = { tab: "stats" };
    routeTables({
      lineCombinations: () =>
        query({
          data: [lineRow(22, [[2201, 2202, 2203], [2204, null, ""]], [2220, null])],
          error: null,
        }),
      yahoo_nhl_player_map: () => query({ data: [], error: null }),
    });
    render(<TeamTabNavigation {...baseProps} teamId="22" teamAbbrev="EDM" seasonId="20252026" />);
    await flush();
    expect(linePropsMock).toHaveBeenLastCalledWith(
      expect.objectContaining({
        forwards: ["2201", "2202", "2203", "2204"],
        defensemen: ["2220"],
      }),
    );
  });
});

describe("TeamTabNavigation Shot Map error", () => {
  beforeEach(() => {
    routerState.query = { tab: "visualization" };
    fromMock.mockReset();
    shotPropsMock.mockReset();
    useTeamScheduleMock.mockReturnValue({
      ...baseScheduleResult,
      scheduleTeam: null,
    });
  });

  afterEach(() => cleanup());

  it("hands the read error to the visualization instead of a detached banner", () => {
    const shotError = new Error("pbp unavailable");
    render(
      <TeamTabNavigation
        {...baseProps}
        teamId="22"
        teamAbbrev="EDM"
        seasonId="20252026"
        shotError={shotError}
      />,
    );
    expect(shotPropsMock).toHaveBeenLastCalledWith(
      expect.objectContaining({ error: shotError }),
    );
    expect(screen.queryByText(/Error loading event data/)).toBeNull();
    expect(fromMock).not.toHaveBeenCalled();
  });
});

describe("LineCombinationsGrid mixed line shapes", () => {
  afterEach(() => cleanup());

  const ids = (prefix: number, count: number) =>
    Array.from({ length: count }, (_, i) => String(prefix + i));
  const cardsIn = (group: HTMLElement) =>
    within(group)
      .queryAllByRole("link")
      .map((link) => link.textContent);
  const regularCardsIn = (name: string) => {
    const section = screen.getByRole("group", { name });
    const extras = within(section).queryAllByRole("group");
    return cardsIn(section).filter(
      (id) => !extras.some((group) => cardsIn(group).includes(id)),
    );
  };

  it.each([
    ["12F/6D", 12, 6],
    ["13F/5D", 13, 5],
    ["14F/4D", 14, 4],
    ["11F/7D", 11, 7],
    ["10F/8D", 10, 8],
    ["13F/6D", 13, 6],
    ["12F/7D", 12, 7],
  ])(
    "keeps every %s skater in their own group with labelled extras",
    async (shape, forwardCount, defenseCount) => {
      const { LineCombinationsGrid } = await vi.importActual<
        typeof import("../LineCombinations/LineCombinationsGrid")
      >("../LineCombinations/LineCombinationsGrid");
      const forwards = ids(100, forwardCount);
      const defensemen = ids(200, defenseCount);
      render(
        <LineCombinationsGrid
          forwards={forwards}
          defensemen={defensemen}
          goalies={["300", "301", "302"]}
          playerMap={{}}
        />,
      );

      // Nobody is dropped, and nobody fills another group's line or pair.
      expect(screen.getAllByRole("link")).toHaveLength(
        forwardCount + defenseCount + 3,
      );
      expect(regularCardsIn("Forwards")).toEqual(forwards.slice(0, 12));
      expect(regularCardsIn("Defense")).toEqual(defensemen.slice(0, 6));
      expect(cardsIn(screen.getByRole("group", { name: "Forwards" }))).toEqual(
        forwards,
      );
      expect(cardsIn(screen.getByRole("group", { name: "Defense" }))).toEqual(
        defensemen,
      );

      const extraForwards = screen.queryByRole("group", {
        name: `Extra F · ${shape}`,
      });
      const extraDefense = screen.queryByRole("group", {
        name: `Extra D · ${shape}`,
      });
      expect(extraForwards ? cardsIn(extraForwards) : []).toEqual(
        forwards.slice(12),
      );
      expect(extraDefense ? cardsIn(extraDefense) : []).toEqual(
        defensemen.slice(6),
      );
      expect(
        cardsIn(screen.getByRole("group", { name: "Extra G" })),
      ).toEqual(["302"]);
    },
  );
});

describe("ShotVisualization filters", () => {
  afterEach(() => cleanup());

  async function renderShotVisualization(props: Record<string, unknown>) {
    const { ShotVisualization } = await vi.importActual<
      typeof import("../ShotVisualization/ShotVisualization")
    >("../ShotVisualization/ShotVisualization");
    const onFilterChange = vi.fn();
    const view = render(
      <ShotVisualization
        shotData={[]}
        isLoading={false}
        onFilterChange={onFilterChange}
        filters={{ eventTypes: ["goal", "shot-on-goal"], gameTypes: ["02"] }}
        {...props}
      />,
    );
    return { ...view, onFilterChange };
  }

  it.each([
    ["loading", { isLoading: true }, "Loading shot data...", "status"],
    ["empty", {}, "No event data available for the selected filters", "status"],
    ["error", { error: new Error("pbp unavailable") }, "Unable to load event data: pbp unavailable", "alert"],
    [
      "no selection",
      { filters: { eventTypes: [], gameTypes: ["02"] } },
      "Select at least one event type and one game type.",
      "status",
    ],
  ])("keeps the filters usable in the %s state", async (_state, props, text, role) => {
    await renderShotVisualization(props);
    expect(screen.getByRole(role).textContent).toBe(text);
    expect(screen.getByLabelText("Event Types:")).toBeTruthy();
    expect(screen.getByLabelText("Game Types:")).toBeTruthy();
  });

  it("changes and resets filters from an empty result", async () => {
    const { onFilterChange } = await renderShotVisualization({});
    const reset = screen.getByRole("button", { name: "Reset filters" }) as HTMLButtonElement;
    expect(reset.disabled).toBe(true);

    const gameTypes = screen.getByLabelText("Game Types:") as HTMLSelectElement;
    for (const option of Array.from(gameTypes.options)) {
      option.selected = option.value === "03";
    }
    fireEvent.change(gameTypes);
    expect(onFilterChange).toHaveBeenLastCalledWith({
      eventTypes: ["goal", "shot-on-goal"],
      gameTypes: ["03"],
    });
    expect(reset.disabled).toBe(false);

    fireEvent.click(reset);
    expect(onFilterChange).toHaveBeenLastCalledWith({
      eventTypes: ["goal", "shot-on-goal"],
      gameTypes: ["02"],
    });
    expect(reset.disabled).toBe(true);
    expect(
      Array.from(gameTypes.selectedOptions).map((option) => option.value),
    ).toEqual(["02"]);
  });
});
