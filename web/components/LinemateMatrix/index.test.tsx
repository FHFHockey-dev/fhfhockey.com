import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import {
  LinemateMatrixInternal,
  PlayerData,
  TOIData,
  getKey,
  sortByLineCombination,
  sortByPPTOI
} from "./index";

afterEach(() => {
  cleanup();
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
});
