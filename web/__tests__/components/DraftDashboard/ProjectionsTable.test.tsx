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

    fireEvent.click(fowHeader);
    let rows = screen.getAllByRole("row").slice(1);
    expect(rows[0].textContent).toContain("High FOW");
    fireEvent.click(fowHeader);
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
    expect(screen.getByText("Loading player projections...")).toBeTruthy();

    rerender(
      <ProjectionsTable
        {...baseProps}
        isLoading={false}
        error="All enabled projection sources failed"
      />,
    );
    expect(screen.getByText("Error loading projections:")).toBeTruthy();
    expect(
      screen.getByText("All enabled projection sources failed"),
    ).toBeTruthy();

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
          data: players.map((entry) => ({
            player_id: entry.playerId,
            season: 20242025,
            games_played: 82,
            goals: 10,
          })),
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
      />,
    );

    fireEvent.click(
      screen.getByRole("button", { name: "Expand details for First Player" }),
    );
    await screen.findByText("Last Season: 2024-25");
    expect(fromMock).toHaveBeenCalledTimes(1);
    expect(chain.in).toHaveBeenCalledWith("player_id", [1, 2, 3]);

    fireEvent.click(
      screen.getByRole("button", { name: "Expand details for Second Player" }),
    );
    await waitFor(() =>
      expect(screen.getAllByText("Last Season: 2024-25")).toHaveLength(2),
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

  it("shows immutable personal ranks and locks manual draft actions", () => {
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

    expect(screen.getByRole("columnheader", { name: /My Rank/ })).toBeTruthy();
    expect(screen.getByText("7")).toBeTruthy();
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
