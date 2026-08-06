import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import LinePairGrid from "./LinePairGrid";
import type { ScopedCardStats } from "./fetchAggregatedData";
import type { PlayerData } from "./utilities";

afterEach(() => cleanup());

function player(
  id: number,
  name: string,
  displayPosition: "LW" | "C" | "RW" | "D" | "G",
  playerType: "F" | "D" | "G",
  gamesPlayed = 2,
): PlayerData {
  return {
    id,
    teamId: 10,
    franchiseId: 5,
    position: displayPosition,
    name,
    playerAbbrevName: name,
    lastName: name.split(" ").slice(1).join(" ") || name,
    totalTOI: 2_000 - id,
    timesOnLine: playerType === "F" ? { "1": 10 - id } : {},
    timesOnPair: playerType === "D" ? { "1": 10 - id } : {},
    percentToiWith: {},
    percentToiWithMixed: {},
    timeSpentWith: {},
    timeSpentWithMixed: {},
    GP: gamesPlayed,
    timesPlayedWith: {},
    ATOI: "16:40",
    percentOfSeason: {},
    displayPosition,
    comboPoints: 0,
    mutualSharedToi: {},
    playerType,
  };
}

function roster(prefix: string): PlayerData[] {
  return [
    player(1, `${prefix} Left`, "LW", "F"),
    player(2, `${prefix} Center`, "C", "F"),
    player(3, `${prefix} Right`, "RW", "F"),
    player(4, `${prefix} Defense One`, "D", "D"),
    player(5, `${prefix} Defense Two`, "D", "D"),
    player(6, `${prefix} Goalie`, "G", "G"),
  ];
}

function canonicalGroups(playerRoster: PlayerData[]): {
  lines: PlayerData[][];
  pairs: PlayerData[][];
} {
  const forwards = playerRoster.filter(
    (candidate) => candidate.playerType === "F",
  );
  const defensemen = playerRoster.filter(
    (candidate) => candidate.playerType === "D",
  );
  return {
    lines: forwards.length > 0 ? [forwards] : [],
    pairs: defensemen.length > 0 ? [defensemen] : [],
  };
}

function exactStats(): ScopedCardStats {
  return {
    scopeGameIds: [101, 102],
    skatersByPlayerId: {
      2: {
        gamesPlayed: 2,
        goals: 1,
        assists: 2,
        points: 3,
        powerPlayPoints: 2,
        shots: 5,
        hits: 6,
        blockedShots: 7,
        plusMinus: -8,
      },
    },
    goaliesByPlayerId: {
      6: {
        gamesPlayed: 2,
        saves: 55,
        savePercentage: 55 / 58,
        goalsAgainstAverage: 1.5,
      },
    },
  };
}

function emptyStats(): ScopedCardStats {
  return {
    scopeGameIds: [101, 102],
    skatersByPlayerId: {},
    goaliesByPlayerId: {},
  };
}

function cardForLastName(lastName: string): HTMLElement {
  const lastNameElement = screen.getByText(lastName);
  const card = lastNameElement.parentElement?.parentElement?.parentElement;
  if (!(card instanceof HTMLElement)) {
    throw new Error(`Unable to find the card containing ${lastName}.`);
  }
  return card;
}

function expectStat(card: HTMLElement, label: string, value: string) {
  const labelElement = within(card).getByText(label);
  expect(labelElement.parentElement?.textContent).toBe(`${label}${value}`);
}

describe("LinePairGrid scoped card metrics", () => {
  it("renders exact supported skater and goalie metrics without legacy scope claims", () => {
    render(
      <LinePairGrid
        scopeKey="team-10|games-101-102"
        status="success"
        roster={roster("Exact")}
        {...canonicalGroups(roster("Exact"))}
        scopeGameCount={2}
        cardStats={exactStats()}
      />,
    );

    const skaterCard = cardForLastName("Center");
    expectStat(skaterCard, "G", "1");
    expectStat(skaterCard, "A", "2");
    expectStat(skaterCard, "PTS", "3");
    expectStat(skaterCard, "PPP", "2");
    expectStat(skaterCard, "SOG", "5");
    expectStat(skaterCard, "HITS", "6");
    expectStat(skaterCard, "BLKS", "7");
    expectStat(skaterCard, "+/-", "-8");

    const goalieCard = cardForLastName("Goalie");
    expectStat(goalieCard, "GP", "2");
    expectStat(goalieCard, "SV%", ".948");
    expectStat(goalieCard, "GAA", "1.50");
    expectStat(goalieCard, "SV", "55");

    expect(screen.queryByText(/last\s+\d+\s+games/i)).toBeNull();
    expect(screen.queryByText(/^record$/i)).toBeNull();
    expect(screen.queryByText("QS%")).toBeNull();
    expect(screen.queryByText("SO")).toBeNull();
    expect(screen.queryByText("GS")).toBeNull();
  });

  it("renders explicit unavailable states instead of zero-filled metrics", () => {
    render(
      <LinePairGrid
        scopeKey="team-10|games-101-102"
        status="success"
        roster={roster("Missing")}
        {...canonicalGroups(roster("Missing"))}
        scopeGameCount={2}
        cardStats={emptyStats()}
      />,
    );

    const skaterCard = cardForLastName("Center");
    expect(within(skaterCard).getByRole("status").textContent).toBe(
      "Box-score stats unavailable for this matrix scope.",
    );
    expect(within(skaterCard).queryByText("0")).toBeNull();
    expect(within(skaterCard).queryByText("G")).toBeNull();

    const goalieCard = cardForLastName("Goalie");
    expect(within(goalieCard).getByRole("status").textContent).toBe(
      "Goalie stats unavailable for this matrix scope.",
    );
    expect(within(goalieCard).queryByText("0")).toBeNull();
    expect(within(goalieCard).queryByText("SV%")).toBeNull();
  });
});

describe("LinePairGrid canonical group presentation", () => {
  it("renders three defense pairs when the canonical scope has zero forward lines", () => {
    const defenders = [
      player(11, "Defense D1", "D", "D"),
      player(12, "Defense D2", "D", "D"),
      player(13, "Defense D3", "D", "D"),
      player(14, "Defense D4", "D", "D"),
      player(15, "Defense D5", "D", "D"),
      player(16, "Defense D6", "D", "D"),
      player(17, "Defense Overflow One", "D", "D"),
      player(18, "Defense Overflow Two", "D", "D"),
    ];
    const pairs = [
      defenders.slice(0, 2),
      defenders.slice(2, 4),
      defenders.slice(4, 6),
      defenders.slice(6, 8),
    ];
    const originalPairOrder = pairs.map((pair) => pair.map(({ id }) => id));

    render(
      <LinePairGrid
        scopeKey="partial-defense-only"
        status="success"
        roster={[player(19, "Scope Goalie", "G", "G")]}
        lines={[]}
        pairs={pairs}
        scopeGameCount={2}
        cardStats={emptyStats()}
      />,
    );

    expect(screen.queryByTestId("forward-line")).toBeNull();
    expect(screen.getAllByTestId("defense-pair")).toHaveLength(3);
    defenders.slice(0, 6).forEach(({ lastName }) => {
      expect(screen.getByText(lastName)).not.toBeNull();
    });
    expect(screen.queryByText("Overflow One")).toBeNull();
    expect(screen.queryByText("Overflow Two")).toBeNull();
    expect(screen.getByText("Goalie")).not.toBeNull();
    expect(pairs.map((pair) => pair.map(({ id }) => id))).toEqual(
      originalPairOrder,
    );
  });

  it("renders one forward line and two defense pairs independently", () => {
    const left = player(21, "Forward Left", "LW", "F");
    const center = player(22, "Forward Center", "C", "F");
    const right = player(23, "Forward Right", "RW", "F");
    const lines = [[right, left, center]];
    const defenders = [
      player(24, "Defense Alpha", "D", "D"),
      player(25, "Defense Bravo", "D", "D"),
      player(26, "Defense Charlie", "D", "D"),
      player(27, "Defense Delta", "D", "D"),
    ];
    const pairs = [defenders.slice(0, 2), defenders.slice(2, 4)];
    const originalLineOrder = lines[0].map(({ id }) => id);

    render(
      <LinePairGrid
        scopeKey="partial-one-line-two-pairs"
        status="partial"
        roster={[]}
        lines={lines}
        pairs={pairs}
        scopeGameCount={1}
        cardStats={emptyStats()}
      />,
    );

    const renderedLine = screen.getByTestId("forward-line");
    expect(screen.getAllByTestId("forward-line")).toHaveLength(1);
    expect(screen.getAllByTestId("defense-pair")).toHaveLength(2);
    expect(renderedLine.textContent?.indexOf("Left")).toBeLessThan(
      renderedLine.textContent?.indexOf("Center") ?? -1,
    );
    expect(renderedLine.textContent?.indexOf("Center")).toBeLessThan(
      renderedLine.textContent?.indexOf("Right") ?? -1,
    );
    defenders.forEach(({ lastName }) => {
      expect(screen.getByText(lastName)).not.toBeNull();
    });
    expect(lines[0].map(({ id }) => id)).toEqual(originalLineOrder);
  });

  it("caps forward lines independently of defense-pair availability", () => {
    const lines = Array.from({ length: 5 }, (_, index) => [
      player(30 + index, `Forward Line${index + 1}`, "C", "F"),
    ]);

    render(
      <LinePairGrid
        scopeKey="forward-cap"
        status="success"
        roster={[]}
        lines={lines}
        pairs={[]}
        scopeGameCount={1}
        cardStats={emptyStats()}
      />,
    );

    expect(screen.getAllByTestId("forward-line")).toHaveLength(4);
    expect(screen.queryByText("Line5")).toBeNull();
  });
});

describe("LinePairGrid scope transitions", () => {
  it("removes scope A cards immediately when scope B starts loading", () => {
    const { rerender } = render(
      <LinePairGrid
        scopeKey="scope-a"
        status="success"
        roster={roster("Alpha")}
        {...canonicalGroups(roster("Alpha"))}
        scopeGameCount={2}
        cardStats={emptyStats()}
      />,
    );

    expect(screen.getByText("Center")).not.toBeNull();

    rerender(
      <LinePairGrid
        scopeKey="scope-b"
        status="loading"
        roster={roster("Alpha")}
        {...canonicalGroups(roster("Alpha"))}
        scopeGameCount={0}
        cardStats={emptyStats()}
      />,
    );

    expect(screen.queryByText("Alpha")).toBeNull();
    expect(screen.queryByText("Center")).toBeNull();
  });

  it("removes prior cards synchronously for empty and error results", () => {
    const alphaRoster = roster("Alpha");
    const { rerender } = render(
      <LinePairGrid
        scopeKey="scope-a"
        status="success"
        roster={alphaRoster}
        {...canonicalGroups(alphaRoster)}
        scopeGameCount={2}
        cardStats={emptyStats()}
      />,
    );

    expect(screen.getByText("Center")).not.toBeNull();

    rerender(
      <LinePairGrid
        scopeKey="scope-a"
        status="empty"
        roster={[]}
        lines={[]}
        pairs={[]}
        scopeGameCount={0}
        cardStats={emptyStats()}
      />,
    );
    expect(screen.queryByText("Center")).toBeNull();
    expect(screen.queryByText("Goalie")).toBeNull();

    rerender(
      <LinePairGrid
        scopeKey="scope-a-empty-count"
        status="success"
        roster={alphaRoster}
        {...canonicalGroups(alphaRoster)}
        scopeGameCount={0}
        cardStats={emptyStats()}
      />,
    );
    expect(screen.queryByText("Center")).toBeNull();
    expect(screen.queryByText("Goalie")).toBeNull();

    rerender(
      <LinePairGrid
        scopeKey="scope-a-retry"
        status="success"
        roster={alphaRoster}
        {...canonicalGroups(alphaRoster)}
        scopeGameCount={2}
        cardStats={emptyStats()}
      />,
    );
    expect(screen.getByText("Center")).not.toBeNull();

    rerender(
      <LinePairGrid
        scopeKey="scope-a-retry"
        status="error"
        roster={alphaRoster}
        {...canonicalGroups(alphaRoster)}
        scopeGameCount={0}
        cardStats={emptyStats()}
      />,
    );
    expect(screen.queryByText("Center")).toBeNull();
    expect(screen.queryByText("Goalie")).toBeNull();
  });
});
