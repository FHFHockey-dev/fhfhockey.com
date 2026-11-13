import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { gameFixture } from "components/ShiftChart/testFixtures";
import LinemateMatrix, {
  LinemateMatrixInternal,
  LinemateMatrixView,
  ppModeVerdicts,
  PlayerData,
  TOIData,
  fetchGamecenterJson,
  getKey,
  sortByLineCombination,
  sortByPPTOI
} from "./index";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("fetchGamecenterJson", () => {
  it.each(["boxscore", "play-by-play"] as const)(
    "loads %s through the same-origin proxy in the browser",
    async (resource) => {
      const payload = { id: 2026010054 };
      const fetchMock = vi.fn().mockResolvedValue(
        new Response(JSON.stringify(payload), {
          headers: { "content-type": "application/json" }
        })
      );
      vi.stubGlobal("fetch", fetchMock);

      await expect(fetchGamecenterJson(2026010054, resource)).resolves.toEqual(
        payload
      );
      expect(fetchMock).toHaveBeenCalledExactlyOnceWith(
        `/api/cors?url=${encodeURIComponent(
          `https://api-web.nhle.com/v1/gamecenter/2026010054/${resource}`
        )}`
      );
    }
  );

  it("preserves upstream error details returned by the proxy", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ message: "Game unavailable" }), {
          status: 503,
          headers: { "content-type": "application/json" }
        })
      )
    );

    await expect(fetchGamecenterJson(2026010054, "boxscore")).rejects.toThrow(
      "Gamecenter boxscore HTTP 503: Game unavailable"
    );
  });
});

function player(id: number, position: string = "C"): PlayerData {
  return {
    id,
    teamId: 1,
    position,
    sweaterNumber: id,
    name: `Player ${id}`
  };
}

function diagonalToi(players: PlayerData[], toiById: Record<number, number>) {
  return players.reduce<Record<string, TOIData>>((table, entry) => {
    table[getKey(entry.id, entry.id)] = {
      toi: toiById[entry.id] ?? 0,
      p1: entry,
      p2: entry
    };
    return table;
  }, {});
}

describe("LinemateMatrix", () => {
  it("does not crash when PP TOI data is empty", () => {
    expect(sortByPPTOI({})).toEqual([]);

    render(
      <LinemateMatrixInternal
        teamId={1}
        teamName="Home"
        roster={[]}
        toiData={[]}
        mode="pp-toi"
      />
    );

    expect(screen.getByText("No skater TOI available.")).toBeTruthy();
    expect(screen.getAllByText("0.0%")).toHaveLength(2);
  });

  it("sorts line-combination mode without requiring every pairwise cell", () => {
    const players = [player(10, "C"), player(11, "L"), player(12, "D")];
    const table = diagonalToi(players, {
      10: 300,
      11: 240,
      12: 260
    });

    expect(() => sortByLineCombination(table, players)).not.toThrow();
    expect(sortByLineCombination(table, players).map((entry) => entry.id)).toEqual([
      10,
      11,
      12
    ]);
  });

  it("renders PP mode when fewer than two full units are available", () => {
    const players = [player(10, "C"), player(11, "D")];
    const table = diagonalToi(players, {
      10: 120,
      11: 60
    });

    render(
      <LinemateMatrixInternal
        teamId={1}
        teamName="Home"
        roster={players}
        toiData={Object.values(table)}
        mode="pp-toi"
      />
    );

    expect(screen.getByText("Home")).toBeTruthy();
    expect(screen.getByText("100.0%")).toBeTruthy();
    expect(screen.getByText("0.0%")).toBeTruthy();
  });

  it("renders supplied data without fetching and filters each team independently", () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const home = [player(10, "C"), player(11, "D")];
    const away = [player(20, "C"), player(21, "D")].map(p => ({ ...p, teamId: 2 }));
    render(<LinemateMatrixView compact gameInfo={[{ id: 1, name: "Home" }, { id: 2, name: "Away" }]}
      rosters={{ 1: home, 2: away }} toiData={{ 1: Object.values(diagonalToi(home, { 10: 100, 11: 100 })), 2: Object.values(diagonalToi(away, { 20: 100, 21: 100 })) }}
      mode="line-combination" onModeChanged={() => {}} />);
    fireEvent.click(within(screen.getByRole("group", { name: "Home positions" })).getByRole("button", { name: "Forwards" }));
    expect(screen.queryAllByText("Player 11")).toHaveLength(0);
    expect(screen.getAllByText("Player 21")).toHaveLength(2);
    expect(screen.getByText(/Full-game shared ice time/)).toBeTruthy();
    expect(fetchMock).not.toHaveBeenCalled();
    const cell = screen.getByLabelText("Player 10 × Player 10: 01:40 shared TOI");
    fireEvent.focus(cell);
    expect(screen.getByRole("tooltip").textContent).toContain("Player 10 × Player 10");
    fireEvent.keyDown(window, { key: "Escape" });
    expect(screen.queryByRole("tooltip")).toBeNull();
  });

  it("shows only the requested team when teamId is set, and both teams by default", () => {
    const home = [player(10, "C"), player(11, "D")];
    const away = [player(20, "C"), player(21, "D")].map(p => ({ ...p, teamId: 2 }));
    const props = {
      gameInfo: [{ id: 1, name: "Home" }, { id: 2, name: "Away" }],
      rosters: { 1: home, 2: away },
      toiData: { 1: Object.values(diagonalToi(home, { 10: 100, 11: 100 })), 2: Object.values(diagonalToi(away, { 20: 100, 21: 100 })) },
      mode: "line-combination" as const,
      onModeChanged: () => {},
    };

    const { container, unmount } = render(<LinemateMatrixView {...props} />);
    expect(screen.getByText("Home")).toBeTruthy();
    expect(screen.getByText("Away")).toBeTruthy();
    expect([...container.querySelectorAll("section[id^='linemate-matrix-']")].map(s => s.id))
      .toEqual(["linemate-matrix-1", "linemate-matrix-2"]);
    unmount();

    const filtered = render(<LinemateMatrixView {...props} teamId={2} />);
    expect(screen.queryByText("Home")).toBeNull();
    expect(screen.getByText("Away")).toBeTruthy();
    expect([...filtered.container.querySelectorAll("section[id^='linemate-matrix-']")].map(s => s.id))
      .toEqual(["linemate-matrix-2"]);
    filtered.unmount();

    render(<LinemateMatrixView {...props} teamId={99} />);
    expect(screen.getByText("No shared ice time for this team in that game.")).toBeTruthy();
    expect(screen.queryByText("Home")).toBeNull();
  });

  it("keeps h4 team headings and an unlabelled, centred grid by default", () => {
    const home = [player(10, "C"), player(11, "D")];
    const { container } = render(<LinemateMatrixView gameInfo={[{ id: 1, name: "Home" }, { id: 2, name: "Away" }]}
      rosters={{ 1: home, 2: [] }} toiData={{ 1: Object.values(diagonalToi(home, { 10: 100, 11: 100 })), 2: [] }}
      mode="line-combination" onModeChanged={() => {}} />);
    expect(screen.getByRole("heading", { level: 4, name: "Home" })).toBeTruthy();
    expect(screen.queryByRole("heading", { level: 3 })).toBeNull();
    expect(screen.queryByRole("img")).toBeNull();
    expect(container.innerHTML).not.toMatch(/controlsStart|wideNames/);
  });

  it("supports h3 headings, a labelled grid, wide names and start-aligned controls when asked", () => {
    const home = [player(10, "C"), player(11, "D")].map(p => ({ ...p, fullName: `Full ${p.name}` }));
    const { container } = render(<LinemateMatrixView gameInfo={[{ id: 1, name: "Home" }, { id: 2, name: "Away" }]}
      rosters={{ 1: home, 2: [] }} toiData={{ 1: Object.values(diagonalToi(home, { 10: 100, 11: 100 })), 2: [] }}
      mode="line-combination" onModeChanged={() => {}} teamId={1}
      headingLevel="h3" labelGrid wideNames controlsAlign="start" />);
    expect(screen.getByRole("heading", { level: 3, name: "Home" })).toBeTruthy();
    expect(screen.queryByRole("heading", { level: 4 })).toBeNull();
    const grid = screen.getByRole("img");
    expect(grid.getAttribute("aria-label")).toBe(
      "Home shared ice time matrix, 2 skaters in line combination order: Full Player 10, Full Player 11. Brighter cells mean more shared ice time."
    );
    expect(container.querySelector("section#linemate-matrix-1")?.className).toMatch(/wideNames/);
    expect(container.firstElementChild?.className).toMatch(/controlsStart/);
  });

  it("keeps the standalone loading wrapper and its missing-game status", () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    render(<LinemateMatrix id={0} mode="line-combination" />);
    expect(screen.getByText("Select a completed game to load linemate data.")).toBeTruthy();
    expect(screen.queryByRole("group")).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("still loads and renders a completed game through the standalone wrapper", async () => {
    const fixture = gameFixture();
    const fetchMock = vi.fn(async (url: string) => new Response(JSON.stringify(
      url.includes("boxscore") ? fixture.box : url.includes("shiftcharts") ? fixture.shifts : fixture.pbp
    ), { headers: { "content-type": "application/json" } }));
    vi.stubGlobal("fetch", fetchMock);
    render(<LinemateMatrix id={fixture.box.id} mode="line-combination" />);
    expect(await screen.findByText("Mammoth")).toBeTruthy();
    expect(await screen.findByText("Avalanche")).toBeTruthy();
    expect(screen.queryByText(/Full-game shared ice time/)).toBeNull();
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  describe("decision 152 PP mode gate (PP_SHARE_SERVING_ENABLED)", () => {
    const home = [player(10, "C"), player(11, "D")];
    const away = [player(20, "C"), player(21, "D")].map((p) => ({ ...p, teamId: 2 }));
    const view = (ppVerdicts?: any) =>
      render(<LinemateMatrixView gameInfo={[{ id: 1, name: "Home" }, { id: 2, name: "Away" }]}
        rosters={{ 1: home, 2: away }}
        toiData={{ 1: Object.values(diagonalToi(home, { 10: 100, 11: 60 })), 2: Object.values(diagonalToi(away, { 20: 100, 21: 60 })) }}
        mode="pp-toi" onModeChanged={() => {}} ppVerdicts={ppVerdicts} />);
    const available = { status: "available", clockSeconds: 120, reason: null };

    it("serving off (no verdicts) keeps today's PP grids", () => {
      view();
      expect(screen.getByText("Home")).toBeTruthy();
      expect(screen.getByText("Away")).toBeTruthy();
      expect(screen.queryByText(/Checking the stored/)).toBeNull();
    });

    it("waits for the stored clock instead of showing ungated values", () => {
      view("pending");
      expect(screen.getByText("Checking the stored power-play clock...")).toBeTruthy();
      expect(screen.queryByText("Home")).toBeNull();
    });

    it("shows available teams; N/A and unavailable teams show the label or the reason instead of a grid", () => {
      view({ 1: available, 2: { status: "not_applicable", clockSeconds: 0, reason: null } });
      expect(screen.getByText("Home")).toBeTruthy();
      expect(screen.getByText("Away: N/A: no power play in this game.")).toBeTruthy();
      cleanup();
      view({ 1: { status: "unavailable", clockSeconds: null, reason: "The clock differs from the official team PP total by +28 s." }, 2: available });
      expect(screen.getByText("Home: The clock differs from the official team PP total by +28 s.")).toBeTruthy();
      expect(screen.getByText("Away")).toBeTruthy();
    });

    it("ppModeVerdicts: off, loading, a live clock that matches or not, and a failed load", () => {
      const teams = [{ id: 1 }, { id: 2 }];
      const clocks = new Map([
        ["7:1", { gameId: 7, teamId: 1, availability: "available", clockSeconds: 120, unavailableReason: null, computedAt: "t" }],
        ["7:2", { gameId: 7, teamId: 2, availability: "available", clockSeconds: 240, unavailableReason: null, computedAt: "t" }]
      ] as Array<[string, any]>);
      expect(ppModeVerdicts({ status: "off" }, 7, teams, {})).toBeUndefined();
      expect(ppModeVerdicts({ status: "idle" }, 7, teams, {})).toBeUndefined();
      expect(ppModeVerdicts({ status: "loading" }, 7, teams, {})).toBe("pending");
      expect(ppModeVerdicts({ status: "on", clocks }, 7, teams, { 1: 120, 2: 236 })).toEqual({
        1: { status: "available", clockSeconds: 120, reason: null },
        2: { status: "unavailable", clockSeconds: null,
          reason: "This view's power-play time (236 s) doesn't match the stored qualified clock (240 s), so it is withheld." }
      });
      expect(ppModeVerdicts({ status: "error", reason: "x" }, 7, teams, {})).toEqual({
        1: { status: "unavailable", clockSeconds: null, reason: "x" },
        2: { status: "unavailable", clockSeconds: null, reason: "x" }
      });
    });
  });
});
