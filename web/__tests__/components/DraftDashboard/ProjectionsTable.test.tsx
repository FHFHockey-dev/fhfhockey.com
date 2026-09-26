import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const { fromMock } = vi.hoisted(() => ({ fromMock: vi.fn() }));

vi.mock("lib/supabase", () => ({ default: { from: fromMock } }));
vi.mock("../../../components/DraftDashboard/ComparePlayersModal", () => ({
  default: () => null,
}));

import ProjectionsTable from "../../../components/DraftDashboard/ProjectionsTable";

afterEach(() => {
  cleanup();
  window.localStorage.clear();
  fromMock.mockReset();
});

function player(playerId: number, fullName: string, position: string) {
  return {
    playerId,
    fullName,
    displayTeam: "CAR",
    displayPosition: position,
    combinedStats: {},
    fantasyPoints: {
      projected: 20,
      actual: null,
      diffPercentage: null,
      projectedPerGame: null,
      actualPerGame: null,
    },
    yahooAvgPick: null,
  } as any;
}

describe("ProjectionsTable visibility diagnostics", () => {
  it("shows scoring-rank ADP value without exposing a personal-rank column", () => {
    const first = { ...player(1, "First", "C"), yahooAvgPick: 5 };
    const value = { ...player(2, "Value", "C"), yahooAvgPick: 110 };
    const third = { ...player(3, "Third", "C"), yahooAvgPick: 30 };
    first.fantasyPoints.projected = 300;
    value.fantasyPoints.projected = 200;
    third.fantasyPoints.projected = 100;
    render(
      <ProjectionsTable
        players={[first, value, third]}
        allPlayers={[first, value, third]}
        draftedPlayers={[]}
        isLoading={false}
        error={null}
        onDraftPlayer={vi.fn()}
        canDraft
        personalRankByPlayerId={{ "2": 999 }}
        vorpMetrics={new Map([
          // Invert VORP values to verify the delta remains FP-rank based.
          ["1", { value: 100 } as any],
          ["2", { value: 300 } as any],
          ["3", { value: 200 } as any],
        ])}
      />,
    );

    expect(screen.queryByRole("columnheader", { name: "My Rank" })).toBeNull();
    expect(screen.getByRole("columnheader", { name: /Value/ })).toBeTruthy();
    expect(screen.getByText("+108")).toBeTruthy();
  });

  it("keeps projected fantasy points visible in stats mode", () => {
    const projected = player(1, "Stats Player", "C");
    projected.fantasyPoints.projected = 42.5;
    render(<ProjectionsTable players={[projected]} draftedPlayers={[]} isLoading={false} error={null} onDraftPlayer={vi.fn()} canDraft />);
    fireEvent.click(screen.getByRole("button", { name: "Toggle stat columns" }));
    expect(screen.getByRole("columnheader", { name: /Proj/ })).toBeTruthy();
    expect(screen.getByText("42.5")).toBeTruthy();
  });

  it("keeps projection sorting separate from position-weighted valuation sorting", () => {
    const defender = player(1, "Defender", "D");
    const forward = player(2, "Forward", "C");
    defender.fantasyPoints.projected = 100;
    forward.fantasyPoints.projected = 80;
    render(<ProjectionsTable players={[defender, forward]} draftedPlayers={[]} isLoading={false} error={null} onDraftPlayer={vi.fn()} canDraft vorpMetrics={new Map([
      ["1", { value: 0, unweightedValue: 100, vorp: 0, vona: 0, vols: 0, vbd: 0, bestPos: "D", eligible: ["D"] }],
      ["2", { value: 80, vorp: 20, vona: 0, vols: 0, vbd: 12, bestPos: "C", eligible: ["C"] }],
    ])} />);
    const order = () => Array.from(document.querySelectorAll("tbody tr[data-player-id]")).map(row => row.getAttribute("data-player-id"));
    fireEvent.click(screen.getByTitle("Projected Fantasy Points"));
    expect(order()).toEqual(["1", "2"]);
    fireEvent.click(screen.getByRole("button", { name: "VORP" }));
    expect(order()).toEqual(["2", "1"]);
    expect(screen.getByText("100.0")).toBeTruthy();
  });

  it("uses the unfiltered full pool and leaves incomplete value inputs blank", () => {
    const leader = { ...player(1, "Full Pool Leader", "C"), yahooAvgPick: 10 };
    const filtered = { ...player(2, "Filtered Value", "C"), yahooAvgPick: 1 };
    const missingPoints = { ...player(3, "Missing Points", "C"), yahooAvgPick: 100 };
    const missingAdp = { ...player(4, "Missing ADP", "C"), yahooAvgPick: null };
    leader.fantasyPoints.projected = 300;
    filtered.fantasyPoints.projected = 200;
    missingPoints.fantasyPoints.projected = null;
    missingAdp.fantasyPoints.projected = 100;

    render(
      <ProjectionsTable
        players={[filtered, missingPoints, missingAdp]}
        allPlayers={[leader, filtered, missingPoints, missingAdp]}
        draftedPlayers={[]}
        isLoading={false}
        error={null}
        onDraftPlayer={vi.fn()}
        canDraft
      />,
    );

    const valueCells = Array.from(document.querySelectorAll('td[data-label="Value Δ"]'));
    expect(valueCells.map((cell) => cell.textContent)).toEqual(["-1", "-", "-"]);
    expect(valueCells[0].className).toContain("valueDeltaNegative");
  });

  it("defaults to 50 rows and keeps refresh between row size and page navigation", () => {
    const refresh = vi.fn();
    render(<ProjectionsTable players={Array.from({ length: 61 }, (_, i) => player(i + 1, `Pagination Player ${i + 1}`, "C"))} draftedPlayers={[]} isLoading={false} error={null} onDraftPlayer={vi.fn()} onRefresh={refresh} canDraft />);
    const pagination = screen.getByRole("navigation", { name: "Available players pagination" });
    expect((screen.getByRole("combobox", { name: "Available players per page" }) as HTMLSelectElement).value).toBe("50");
    expect(pagination.textContent).toContain("1–50 of 61");
    expect(Array.from(pagination.querySelectorAll("button")).map((button) => button.textContent)).toEqual(["First", "Refresh Data", "Prev", "Next"]);
    fireEvent.click(screen.getByRole("button", { name: "Refresh Data" }));
    expect(refresh).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole("button", { name: "Next" }));
    expect(pagination.textContent).toContain("51–61 of 61");
  });
  it("keeps league-wide table values raw and exposes no roster-needs control", () => {
    render(<ProjectionsTable players={[player(1, "Raw Value", "C")]} draftedPlayers={[]} isLoading={false} error={null} onDraftPlayer={vi.fn()} canDraft vorpMetrics={new Map([["1", { vorp: 12, vona: 8, vbd: 10 } as any]])} />);
    fireEvent.click(screen.getByRole("button", { name: "Open settings drawer" }));
    expect(screen.queryByRole("checkbox", { name: "Enable need weighting" })).toBeNull();
    expect(screen.getByText("10.0")).toBeTruthy();
  });

  it("displays next-pick availability, with high availability marked green", () => {
    const early = { ...player(1, "Early", "C"), yahooAvgPick: 1 };
    const later = { ...player(2, "Later", "C"), yahooAvgPick: 100 };
    render(<ProjectionsTable players={[early, later]} draftedPlayers={[]} nextPickNumber={50} selectionHorizon={{ currentPick: 1, targetPick: 50, opposingPicks: 49 }} isLoading={false} error={null} onDraftPlayer={vi.fn()} canDraft />);
    expect(screen.getByTitle("100% likely available at your next pick").className).toContain("riskLow");
    expect(screen.getByTitle("0% likely available at your next pick").className).toContain("riskHigh");
  });
  it("preserves projected decimals and exposes the unrounded source value", () => {
    const projected = player(8477492, "Nathan MacKinnon", "C");
    projected.combinedStats = {
      GOALS: { projected: 47.85 },
      POINTS: { projected: 126.95 },
    };
    render(
      <ProjectionsTable
        players={[projected]}
        draftedPlayers={[]}
        isLoading={false}
        error={null}
        onDraftPlayer={vi.fn()}
        canDraft
        enabledSkaterStatKeys={["GOALS", "POINTS"]}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Toggle stat columns" }));
    expect(screen.getByText("47.85").getAttribute("title")).toBe("47.85");
    expect(screen.getByText("126.95")).toBeTruthy();
    expect(screen.getByRole("columnheader", { name: "VORP" })).toBeTruthy();
    expect(screen.getByRole("columnheader", { name: "VONA" })).toBeTruthy();
    expect(screen.getByRole("columnheader", { name: "VBD" })).toBeTruthy();
  });

  it("prorates eligible skater stats to the 84-game season", () => {
    const projected = player(1, "Half Season Skater", "C");
    projected.combinedStats = {
      GAMES_PLAYED: { projected: 42 },
      GOALS: { projected: 21 },
    };

    render(
      <ProjectionsTable
        players={[projected]}
        draftedPlayers={[]}
        isLoading={false}
        error={null}
        onDraftPlayer={vi.fn()}
        canDraft
        enabledSkaterStatKeys={["GOALS"]}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Toggle stat columns" }));
    fireEvent.click(
      screen.getByRole("button", {
        name: "Toggle 84-game prorated skater stats",
      }),
    );

    const prorated = screen.getByTitle("42 (84-game pace)");
    expect(prorated.textContent).toBe("42*");
    expect(window.localStorage.getItem("projections.prorate84")).toBe("true");
  });

  it("shows configured goalie metrics in mixed-player stat rows", () => {
    const goalie = player(1, "Goalie", "G");
    goalie.combinedStats = {
      WINS_GOALIE: { projected: 35 },
      SAVES_GOALIE: { projected: 1460 },
      SAVE_PERCENTAGE: { projected: 0.918 },
      GOALS_AGAINST_AVERAGE: { projected: 2.42 },
    };

    render(
      <ProjectionsTable
        players={[goalie]}
        draftedPlayers={[]}
        isLoading={false}
        error={null}
        onDraftPlayer={vi.fn()}
        canDraft
        enabledSkaterStatKeys={[
          "GOALS",
          "ASSISTS",
          "PP_POINTS",
          "SHOTS_ON_GOAL",
        ]}
        enabledGoalieStatKeys={[
          "WINS_GOALIE",
          "SAVES_GOALIE",
          "SAVE_PERCENTAGE",
          "GOALS_AGAINST_AVERAGE",
        ]}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Toggle stat columns" }));

    expect(
      screen.getByRole("cell", { name: "Goalie projected statistics" }),
    ).toBeTruthy();
    expect(screen.getByTitle("Projected W: 35").textContent).toContain("35");
    expect(screen.getByTitle("Projected SV: 1460").textContent).toContain(
      "1460",
    );
    expect(screen.getByTitle("Projected SV%: 0.918").textContent).toContain(
      "0.918",
    );
    expect(screen.getByTitle("Projected GAA: 2.42").textContent).toContain(
      "2.42",
    );
  });

  it("keeps goalie starts separate from missing appearances and formats save percentage as a fraction", () => {
    const goalie = player(1, "Goalie", "G");
    goalie.combinedStats = {
      GAMES_PLAYED: { projected: null },
      GAMES_STARTED_GOALIE: { projected: 58.5 },
      SAVE_PERCENTAGE: { projected: 0.91 },
    };
    render(
      <ProjectionsTable
        players={[goalie]}
        draftedPlayers={[]}
        isLoading={false}
        error={null}
        onDraftPlayer={vi.fn()}
        canDraft
        enabledGoalieStatKeys={["GAMES_PLAYED", "GAMES_STARTED_GOALIE", "SAVE_PERCENTAGE"]}
      />,
    );
    fireEvent.change(screen.getByRole("combobox", { name: "Position filter" }), {
      target: { value: "G" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Toggle stat columns" }));
    expect(screen.getByRole("columnheader", { name: "GP" })).toBeTruthy();
    expect(screen.getByRole("columnheader", { name: "GS" })).toBeTruthy();
    expect(screen.getByTitle("Not supplied").textContent).toBe("-");
    expect(screen.getByText("58.5")).toBeTruthy();
    expect(screen.getByText("0.910").getAttribute("title")).toBe("0.91");
  });

  it("shows every configured stat column and sorts FOW without restoring HITS", () => {
    const low = player(1, "Low FOW", "C");
    const high = player(2, "High FOW", "C");
    low.combinedStats = {
      FACEOFFS_WON: { projected: 300 },
      HITS: { projected: 90 },
    };
    high.combinedStats = {
      FACEOFFS_WON: { projected: 700 },
      HITS: { projected: 10 },
    };
    const configuredKeys = [
      ...Array.from({ length: 24 }, (_, index) => `CUSTOM_STAT_${index}`),
      "FACEOFFS_WON",
    ];

    render(
      <ProjectionsTable
        players={[low, high]}
        allPlayers={[low, high]}
        draftedPlayers={[]}
        isLoading={false}
        error={null}
        onDraftPlayer={vi.fn()}
        canDraft
        enabledSkaterStatKeys={configuredKeys}
      />,
    );

    fireEvent.click(
      screen.getByRole("button", { name: "Toggle stat columns" }),
    );
    const fowHeader = screen.getByRole("columnheader", { name: "FOW" });
    expect(screen.queryByRole("columnheader", { name: "HITS" })).toBeNull();
    expect(screen.getByText("300")).toBeTruthy();
    expect(screen.getByText("700")).toBeTruthy();

    const fowSortButton = screen.getByRole("button", { name: "FOW" });
    fireEvent.click(fowSortButton);
    let rows = screen.getAllByRole("row").slice(1);
    expect(rows[0].textContent).toContain("High FOW");
    fireEvent.click(fowSortButton);
    rows = screen.getAllByRole("row").slice(1);
    expect(rows[0].textContent).toContain("Low FOW");
  });

  it("renders truthful loading, blocking-error, partial-source, and no-source states", () => {
    const baseProps = {
      players: [],
      allPlayers: [],
      draftedPlayers: [],
      onDraftPlayer: vi.fn(),
      canDraft: true,
    };
    const { rerender } = render(
      <ProjectionsTable {...baseProps} isLoading error={null} />,
    );
    expect(screen.getByRole("status").textContent).toContain(
      "Loading player projections…",
    );

    rerender(
      <ProjectionsTable
        {...baseProps}
        isLoading={false}
        error="All enabled projection sources failed"
      />,
    );
    expect(screen.getByRole("alert").textContent).toContain(
      "Unable to load projections.",
    );
    expect(
      screen.getByText("All enabled projection sources failed"),
    ).toBeTruthy();
    expect(screen.getByRole("alert").textContent).toContain(
      "Refresh data to try again.",
    );

    rerender(
      <ProjectionsTable
        {...baseProps}
        players={[player(1, "Healthy Player", "C")]}
        allPlayers={[player(1, "Healthy Player", "C")]}
        isLoading={false}
        error={null}
        dataNotices={[
          "Skater source Failed Source is unavailable; remaining enabled sources are still included.",
        ]}
      />,
    );
    expect(screen.getByText("Healthy Player")).toBeTruthy();
    const noticeButton = screen.getByRole("button", {
      name: "Data notices and legend",
    });
    const tooltip = document.getElementById(
      noticeButton.getAttribute("aria-describedby")!,
    );
    expect(tooltip?.getAttribute("role")).toBe("tooltip");
    expect(tooltip?.textContent).toContain(
      "remaining enabled sources are still included",
    );
    expect(tooltip?.textContent).toContain("Legend");
    expect(screen.queryByRole("status")).toBeNull();

    rerender(
      <ProjectionsTable
        {...baseProps}
        isLoading={false}
        error={null}
        emptyStateMessage="No projection sources are enabled. Enable at least one source."
      />,
    );
    expect(
      screen.getByText(
        "No projection sources are enabled. Enable at least one source.",
      ),
    ).toBeTruthy();
    expect(screen.queryByText("Healthy Player")).toBeNull();
    expect(screen.queryByText("Data notices")).toBeNull();
    expect(screen.getByRole("button", { name: "Legend" })).toBeTruthy();
  });

  it("keeps drafted players visible until requested and reports source inclusion", () => {
    const players = [
      player(1, "Available Player", "C"),
      player(2, "Drafted Player", "D"),
    ];
    render(
      <ProjectionsTable
        players={players}
        allPlayers={players}
        draftedPlayers={[
          { playerId: "2", teamId: "Team 1", pickNumber: 1 } as any,
        ]}
        isLoading={false}
        error={null}
        onDraftPlayer={vi.fn()}
        canDraft
        inclusionDiagnostics={{
          skater: {
            rawRows: 3,
            validIdRows: 3,
            invalidIdRows: 0,
            uniqueSourcePlayerIds: 2,
            duplicateIdRows: 1,
            processedPlayers: 2,
            sourceIdsMissingFromProcessed: 0,
            missingProcessedIdSamples: [],
            invalidIdentitySamples: [],
            bySource: {},
          },
        }}
      />,
    );

    expect(screen.getByText("Drafted Player")).toBeTruthy();
    fireEvent.click(
      screen.getByRole("button", { name: "Toggle hide drafted" }),
    );
    expect(screen.queryByText("Drafted Player")).toBeNull();

    fireEvent.click(
      screen.getByRole("button", { name: "Open settings drawer" }),
    );
    fireEvent.click(screen.getByRole("checkbox", { name: "Show diagnostics" }));

    expect(screen.getByText(/Excluded:/).textContent).toContain("1 of 2");
    expect(screen.getByText("hideDrafted: 1")).toBeTruthy();
    expect(
      screen.getByText(/Projection skater inclusion:/).parentElement
        ?.textContent,
    ).toContain("duplicate rows 1");
  });

  it("batches prior-season totals once for multiple expanded players", async () => {
    const players = [
      player(1, "First Player", "C"),
      player(2, "Second Player", "D"),
      player(3, "Third Player", "LW"),
    ];
    const chain: any = {
      select: vi.fn(() => chain),
      in: vi.fn(() => chain),
      order: vi.fn(() => chain),
      range: vi.fn(() =>
        Promise.resolve({
          data: players.flatMap((entry) => [20242025, 20252026].map((season) => ({
            player_id: entry.playerId,
            season,
            games_played: 82,
            goals: 10,
          }))),
          error: null,
        }),
      ),
    };
    fromMock.mockReturnValue(chain);

    render(
      <ProjectionsTable
        players={players}
        allPlayers={players}
        draftedPlayers={[]}
        isLoading={false}
        error={null}
        onDraftPlayer={vi.fn()}
        canDraft
        projectionSeasonId={20262027}
      />,
    );

    fireEvent.click(
      screen.getByRole("button", { name: "Expand details for First Player" }),
    );
    await screen.findByText("Last Season: 2025-26");
    const firstRow = screen.getByText("First Player").closest("tr")!;
    expect(firstRow.getAttribute("data-stripe")).toBe(firstRow.nextElementSibling?.getAttribute("data-stripe"));
    expect(screen.getByText("Second Player").closest("tr")?.getAttribute("data-stripe")).not.toBe(firstRow.getAttribute("data-stripe"));
    expect(fromMock).toHaveBeenCalledTimes(1);
    expect(chain.in).toHaveBeenCalledWith("player_id", [1, 2, 3]);

    fireEvent.click(
      screen.getByRole("button", { name: "Expand details for Second Player" }),
    );
    await waitFor(() =>
      expect(screen.getAllByText("Last Season: 2025-26")).toHaveLength(2),
    );
    expect(fromMock).toHaveBeenCalledTimes(1);
  });

  it("enforces the two-player comparison limit with visible feedback", () => {
    const players = [
      player(1, "First Player", "C"),
      player(2, "Second Player", "D"),
      player(3, "Third Player", "LW"),
    ];
    render(
      <ProjectionsTable
        players={players}
        allPlayers={players}
        draftedPlayers={[]}
        isLoading={false}
        error={null}
        onDraftPlayer={vi.fn()}
        canDraft
      />,
    );

    const first = screen.getByRole("checkbox", {
      name: "Select First Player for comparison",
    });
    const second = screen.getByRole("checkbox", {
      name: "Select Second Player for comparison",
    });
    const third = screen.getByRole("checkbox", {
      name: "Select Third Player for comparison",
    });
    fireEvent.click(first);
    fireEvent.click(second);
    fireEvent.click(third);

    expect((first as HTMLInputElement).checked).toBe(true);
    expect((second as HTMLInputElement).checked).toBe(true);
    expect((third as HTMLInputElement).checked).toBe(false);
    expect(screen.getByRole("status").textContent).toContain(
      "exactly two players",
    );
    fireEvent.click(
      screen.getByRole("button", { name: "Clear comparison selection" }),
    );
    expect((first as HTMLInputElement).checked).toBe(false);
    expect((second as HTMLInputElement).checked).toBe(false);
    expect(screen.queryByRole("status")).toBeNull();
  });

  it("hides personal ranks and locks manual draft actions", () => {
    const onDraftPlayer = vi.fn();
    render(
      <ProjectionsTable
        players={[player(1, "Ranked Player", "C")]}
        allPlayers={[player(1, "Ranked Player", "C")]}
        draftedPlayers={[]}
        isLoading={false}
        error={null}
        onDraftPlayer={onDraftPlayer}
        canDraft={false}
        personalRankByPlayerId={{ "1": 7 }}
      />,
    );

    expect(screen.queryByRole("columnheader", { name: /My Rank/ })).toBeNull();
    const draftButton = screen.getByRole("button", { name: "Draft" });
    expect((draftButton as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(draftButton);
    expect(onDraftPlayer).not.toHaveBeenCalled();
  });

  it("renders passive DUST and a lower-conflict alternative without gating draft", () => {
    const onDraftPlayer = vi.fn();
    const dustInsights = new Map([
      [
        "1",
        {
          marginalDustGames: 6,
          candidateScheduledGames: 68,
          activeGamesAdded: 62,
          dustRate: 6 / 68,
          risk: "elevated" as const,
          alternative: {
            playerId: "2",
            playerName: "Lower Conflict Player",
            dustReduction: 4,
            valueDifference: -2.4,
          },
        },
      ],
    ]);

    render(
      <ProjectionsTable
        players={[player(1, "High Conflict Player", "RW")]}
        allPlayers={[player(1, "High Conflict Player", "RW")]}
        draftedPlayers={[]}
        isLoading={false}
        error={null}
        onDraftPlayer={onDraftPlayer}
        canDraft
        dustInsights={dustInsights}
      />,
    );

    expect(screen.getByText("DUST +6")).toBeTruthy();
    expect(screen.getByText("DUST +6").getAttribute("title")).toContain(
      "62 Active Games Added",
    );
    expect(screen.getByText(/Alt: Lower Conflict Player/).textContent).toContain(
      "−4 DUST",
    );
    const draftButton = screen.getByRole("button", { name: "Draft" });
    expect((draftButton as HTMLButtonElement).disabled).toBe(false);
    fireEvent.click(draftButton);
    expect(onDraftPlayer).toHaveBeenCalledWith("1");
  });

  it("shows exact low DUST without a misleading alternative", () => {
    render(
      <ProjectionsTable
        players={[player(1, "Low Conflict Player", "C")]}
        allPlayers={[player(1, "Low Conflict Player", "C")]}
        draftedPlayers={[]}
        isLoading={false}
        error={null}
        onDraftPlayer={vi.fn()}
        canDraft
        dustInsights={
          new Map([
            [
              "1",
              {
                marginalDustGames: 0,
                candidateScheduledGames: 70,
                activeGamesAdded: 70,
                dustRate: 0,
                risk: "low" as const,
              },
            ],
          ])
        }
      />,
    );

    expect(screen.getByText("DUST +0")).toBeTruthy();
    expect(screen.queryByText(/Alt:/)).toBeNull();
  });
});


it("sorts compact OFF/B2B counts while keeping unavailable values last", () => {
  const { container } = render(<ProjectionsTable players={[player(1, "First", "C"), player(2, "Second", "C"), player(3, "Unknown", "C")]} draftedPlayers={[]} isLoading={false} error={null} onDraftPlayer={vi.fn()} canDraft scheduleMetrics={new Map([["1", { games: 4, off: 1, b2b: 0 }], ["2", { games: 4, off: 3, b2b: 1 }]])} />);
  fireEvent.click(screen.getByRole("button", { name: "OFF" }));
  const ids = () => [...container.querySelectorAll("tr[data-player-id]")].map((row) => row.getAttribute("data-player-id"));
  expect(ids()).toEqual(["1", "2", "3"]);
  fireEvent.click(screen.getByRole("button", { name: "OFF" }));
  expect(ids()).toEqual(["2", "1", "3"]);
  expect(container.querySelector('tr[data-player-id="3"] [data-label="OFF"]')?.textContent).toBe("—");
});

it("reorders only the favorites queue and persists its order", () => {
  window.localStorage.setItem("projections.favorites", JSON.stringify(["1", "2"]));
  window.localStorage.setItem("projections.favoritesOnly", "true");
  const changed = vi.fn();
  const { container } = render(<ProjectionsTable players={[player(1, "Alpha", "C"), player(2, "Beta", "C")]} draftedPlayers={[]} isLoading={false} error={null} onDraftPlayer={vi.fn()} onFavoriteIdsChange={changed} canDraft />);
  const order = () => Array.from(container.querySelectorAll("tr[data-player-id]")).map((row) => row.getAttribute("data-player-id"));
  expect(order()).toEqual(["1", "2"]);
  fireEvent.keyDown(screen.getByRole("button", { name: "Reorder Beta; use arrow up or down" }), { key: "ArrowUp" });
  expect(order()).toEqual(["2", "1"]);
  expect(changed).toHaveBeenLastCalledWith(["2", "1"]);
  expect(JSON.parse(window.localStorage.getItem("projections.favorites")!)).toEqual(["2", "1"]);
  fireEvent.click(screen.getByRole("button", { name: "Toggle favorites only" }));
  expect(order()).toEqual(["1", "2"]);
  expect(screen.queryByRole("button", { name: "Reorder Beta; use arrow up or down" })).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "Toggle favorites only" }));
  const transfer = { setData: vi.fn(), effectAllowed: "", dropEffect: "" };
  fireEvent.dragStart(screen.getByRole("button", { name: "Reorder Alpha; use arrow up or down" }), { dataTransfer: transfer });
  fireEvent.drop(container.querySelector('tr[data-player-id="2"]')!, { dataTransfer: transfer });
  expect(order()).toEqual(["1", "2"]);
});
