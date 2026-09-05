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
  it("traps drawer focus, isolates the table, and restores the trigger", async () => {
    const outsideControl = document.createElement("button");
    outsideControl.textContent = "Outside dashboard control";
    outsideControl.setAttribute("aria-hidden", "false");
    (outsideControl as HTMLElement & { inert?: boolean }).inert = true;
    document.body.appendChild(outsideControl);
    const previousOverflow = document.body.style.overflow;
    const previousOverscrollBehavior = document.body.style.overscrollBehavior;
    document.body.style.overflow = "scroll";
    document.body.style.overscrollBehavior = "auto";
    const { unmount } = render(
      <ProjectionsTable
        players={[player(1, "Focus Player", "C")]}
        draftedPlayers={[]}
        isLoading={false}
        error={null}
        onDraftPlayer={vi.fn()}
        canDraft
      />,
    );

    const trigger = screen.getByRole("button", {
      name: "Open settings drawer",
    });
    trigger.focus();
    fireEvent.click(trigger);

    const drawer = await screen.findByRole("dialog", {
      name: "Advanced Settings",
    });
    const closeButton = screen.getByRole("button", { name: "Close settings" });
    await waitFor(() => expect(document.activeElement).toBe(closeButton));

    const background = drawer.parentElement?.firstElementChild;
    expect(background?.getAttribute("aria-hidden")).toBe("true");
    expect((background as HTMLElement & { inert?: boolean })?.inert).toBe(true);
    expect(outsideControl.getAttribute("aria-hidden")).toBe("true");
    expect(outsideControl.inert).toBe(true);

    const scope = screen.getByRole("combobox", { name: "Value band scope" });
    fireEvent.change(scope, { target: { value: "overall" } });
    const drawerFocusables = Array.from(
      drawer.querySelectorAll<HTMLElement>(
        'button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
      ),
    );
    const lastFocusable = drawerFocusables.at(-1)!;
    lastFocusable.focus();
    fireEvent.keyDown(document, { key: "Tab" });
    expect(document.activeElement).toBe(closeButton);
    fireEvent.keyDown(document, { key: "Tab", shiftKey: true });
    expect(document.activeElement).toBe(lastFocusable);

    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(document.activeElement).toBe(trigger);
    expect(outsideControl.getAttribute("aria-hidden")).toBe("false");
    expect(outsideControl.inert).toBe(true);
    expect(document.body.style.overflow).toBe("scroll");
    expect(document.body.style.overscrollBehavior).toBe("auto");

    fireEvent.click(trigger);
    expect(
      (screen.getByRole("combobox", { name: "Value band scope" }) as HTMLSelectElement)
        .value,
    ).toBe("overall");
    fireEvent.click(screen.getByRole("button", { name: "Close settings" }));
    expect(document.activeElement).toBe(trigger);
    fireEvent.click(trigger);
    unmount();
    expect(outsideControl.getAttribute("aria-hidden")).toBe("false");
    expect(outsideControl.inert).toBe(true);
    expect(document.body.style.overflow).toBe("scroll");
    expect(document.body.style.overscrollBehavior).toBe("auto");
    outsideControl.remove();
    document.body.style.overflow = previousOverflow;
    document.body.style.overscrollBehavior = previousOverscrollBehavior;
  });

  it("displays next-pick availability, with high availability marked green", () => {
    const early = { ...player(1, "Early", "C"), yahooAvgPick: 1 };
    const later = { ...player(2, "Later", "C"), yahooAvgPick: 100 };
    render(<ProjectionsTable players={[early, later]} draftedPlayers={[]} nextPickNumber={50} isLoading={false} error={null} onDraftPlayer={vi.fn()} canDraft />);
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

  it("labels paced fantasy points as player analysis", () => {
    render(
      <ProjectionsTable
        players={[player(1, "Paced Skater", "C")]}
        draftedPlayers={[]}
        isLoading={false}
        error={null}
        onDraftPlayer={vi.fn()}
        canDraft
      />,
    );

    fireEvent.click(
      screen.getByRole("button", {
        name: "Toggle 84-game prorated skater stats",
      }),
    );
    expect(screen.getByRole("button", { name: /Paced FP/ }).getAttribute("title")).toContain(
      "Team projections remain unchanged",
    );
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

  it("loads only the expanded player, deduplicates reopen, and preserves prior-season selection", async () => {
    const players = [
      player(1, "First Player", "C"),
      player(2, "Second Player", "D"),
      player(3, "Third Player", "LW"),
    ];
    let requestedIds: number[] = [];
    let requestedRowCount = 0;
    const chain: any = {
      select: vi.fn(() => chain),
      in: vi.fn((_column: string, ids: number[]) => {
        requestedIds = ids;
        return chain;
      }),
      order: vi.fn(() => chain),
      range: vi.fn(() =>
        Promise.resolve({
          data: players.filter((entry) => requestedIds.includes(entry.playerId)).map((entry) => ({
            player_id: entry.playerId,
            season: 20242025,
            games_played: 82,
            goals: 10,
          })),
          error: null,
        }).then((result) => {
          requestedRowCount += result.data.length;
          return result;
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
    const firstRow = screen.getByText("First Player").closest("tr")!;
    expect(firstRow.getAttribute("data-stripe")).toBe(firstRow.nextElementSibling?.getAttribute("data-stripe"));
    expect(screen.getByText("Second Player").closest("tr")?.getAttribute("data-stripe")).not.toBe(firstRow.getAttribute("data-stripe"));
    expect(fromMock).toHaveBeenCalledTimes(1);
    expect(chain.in).toHaveBeenCalledWith("player_id", [1]);
    expect(requestedRowCount).toBe(1);

    fireEvent.click(
      screen.getByRole("button", { name: "Expand details for Second Player" }),
    );
    await waitFor(() =>
      expect(screen.getAllByText("Last Season: 2024-25")).toHaveLength(2),
    );
    expect(fromMock).toHaveBeenCalledTimes(2);
    expect(chain.in).toHaveBeenLastCalledWith("player_id", [2]);
    expect(requestedRowCount).toBe(2);

    fireEvent.click(
      screen.getByRole("button", { name: "Collapse details for First Player" }),
    );
    fireEvent.click(
      screen.getByRole("button", { name: "Expand details for First Player" }),
    );
    await waitFor(() =>
      expect(screen.getAllByText("Last Season: 2024-25")).toHaveLength(2),
    );
    expect(fromMock).toHaveBeenCalledTimes(2);
  });

  it("does not reuse a prior-season detail across season contexts", async () => {
    const chain: any = {
      select: vi.fn(() => chain),
      in: vi.fn(() => chain),
      order: vi.fn(() => chain),
      range: vi.fn(() =>
        Promise.resolve({
          data: [{ player_id: 1, season: 20242025, games_played: 82 }],
          error: null,
        }),
      ),
    };
    fromMock.mockReturnValue(chain);
    const { rerender } = render(
      <ProjectionsTable
        players={[player(1, "Season Player", "C")]}
        draftedPlayers={[]}
        currentSeasonId="20252026"
        isLoading={false}
        error={null}
        onDraftPlayer={vi.fn()}
        canDraft
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Expand details for Season Player" }));
    await screen.findByText("Last Season: 2024-25");
    fireEvent.click(screen.getByRole("button", { name: "Collapse details for Season Player" }));
    rerender(
      <ProjectionsTable
        players={[player(1, "Season Player", "C")]}
        draftedPlayers={[]}
        currentSeasonId="20262027"
        isLoading={false}
        error={null}
        onDraftPlayer={vi.fn()}
        canDraft
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Expand details for Season Player" }));
    await screen.findByText("Last Season: 2024-25");
    expect(fromMock).toHaveBeenCalledTimes(2);
  });

  it("shows missing history and retries a failed player request", async () => {
    let attempts = 0;
    const chain: any = {
      select: vi.fn(() => chain),
      in: vi.fn(() => chain),
      order: vi.fn(() => chain),
      range: vi.fn(() => {
        attempts += 1;
        return attempts === 1
          ? Promise.resolve({ data: null, error: new Error("history unavailable") })
          : Promise.resolve({ data: [], error: null });
      }),
    };
    fromMock.mockReturnValue(chain);
    render(
      <ProjectionsTable
        players={[player(1, "Retry Player", "G")]}
        draftedPlayers={[]}
        isLoading={false}
        error={null}
        onDraftPlayer={vi.fn()}
        canDraft
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Expand details for Retry Player" }));
    await screen.findByText("history unavailable");
    fireEvent.click(screen.getByRole("button", { name: "Collapse details for Retry Player" }));
    fireEvent.click(screen.getByRole("button", { name: "Expand details for Retry Player" }));
    await screen.findByText("No last season totals available.");
    expect(fromMock).toHaveBeenCalledTimes(2);
  });

  it("shares a deferred successful request across close and reopen", async () => {
    let resolveRequest!: (value: { data: any[]; error: null }) => void;
    const pending = new Promise<{ data: any[]; error: null }>((resolve) => {
      resolveRequest = resolve;
    });
    const chain: any = {
      select: vi.fn(() => chain),
      in: vi.fn(() => chain),
      order: vi.fn(() => chain),
      range: vi.fn(() => pending),
    };
    fromMock.mockReturnValue(chain);
    render(
      <ProjectionsTable
        players={[player(1, "Deferred Player", "C")]}
        draftedPlayers={[]}
        isLoading={false}
        error={null}
        onDraftPlayer={vi.fn()}
        canDraft
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Expand details for Deferred Player" }));
    fireEvent.click(screen.getByRole("button", { name: "Collapse details for Deferred Player" }));
    fireEvent.click(screen.getByRole("button", { name: "Expand details for Deferred Player" }));
    expect(fromMock).toHaveBeenCalledTimes(1);
    resolveRequest({ data: [{ player_id: 1, season: 20242025 }], error: null });
    await screen.findByText("Last Season: 2024-25");
  });

  it("shares a deferred failure and permits a later retry", async () => {
    let rejectRequest!: (error: Error) => void;
    const pending = new Promise<{ data: any[]; error: null }>((_, reject) => {
      rejectRequest = reject;
    });
    const chain: any = {
      select: vi.fn(() => chain),
      in: vi.fn(() => chain),
      order: vi.fn(() => chain),
      range: vi.fn(() => pending),
    };
    const retryChain: any = {
      select: vi.fn(),
      in: vi.fn(),
      order: vi.fn(),
      range: vi.fn(() => Promise.resolve({ data: [], error: null })),
    };
    retryChain.select.mockReturnValue(retryChain);
    retryChain.in.mockReturnValue(retryChain);
    retryChain.order.mockReturnValue(retryChain);
    fromMock.mockReturnValueOnce(chain).mockReturnValueOnce(retryChain);
    render(
      <ProjectionsTable
        players={[player(1, "Deferred Retry Player", "C")]}
        draftedPlayers={[]}
        isLoading={false}
        error={null}
        onDraftPlayer={vi.fn()}
        canDraft
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Expand details for Deferred Retry Player" }));
    fireEvent.click(screen.getByRole("button", { name: "Collapse details for Deferred Retry Player" }));
    fireEvent.click(screen.getByRole("button", { name: "Expand details for Deferred Retry Player" }));
    expect(fromMock).toHaveBeenCalledTimes(1);
    rejectRequest(new Error("deferred history unavailable"));
    await screen.findByText("deferred history unavailable");
    fireEvent.click(screen.getByRole("button", { name: "Collapse details for Deferred Retry Player" }));
    fireEvent.click(screen.getByRole("button", { name: "Expand details for Deferred Retry Player" }));
    await screen.findByText("No last season totals available.");
    expect(fromMock).toHaveBeenCalledTimes(2);
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
