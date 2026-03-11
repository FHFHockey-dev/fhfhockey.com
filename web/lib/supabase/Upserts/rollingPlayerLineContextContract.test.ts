import { describe, expect, it } from "vitest";

import {
  ROLLING_PLAYER_LINE_CONTEXT_CONTRACT,
  resolveTrustedLineAssignment
} from "./rollingPlayerLineContextContract";

describe("rollingPlayerLineContextContract", () => {
  it("records line combo fields as contextual builder-owned labels", () => {
    expect(ROLLING_PLAYER_LINE_CONTEXT_CONTRACT.authoritativeSource.rowSource).toBe(
      "lineCombinations"
    );
    expect(ROLLING_PLAYER_LINE_CONTEXT_CONTRACT.freshnessDependencies).toEqual([
      "lineCombinations"
    ]);
  });

  it("returns trusted forward and defense assignments when the player is placed by the builder", () => {
    expect(
      resolveTrustedLineAssignment({
        row: {
          forwards: [10, 11, 12, 13, 14, 15],
          defensemen: [20, 21, 22, 23],
          goalies: [30]
        },
        playerId: 14
      })
    ).toEqual({
      lineCombo: { slot: 2, positionGroup: "forward" },
      hasSourceRow: true,
      hasTrustedAssignment: true
    });

    expect(
      resolveTrustedLineAssignment({
        row: {
          forwards: [10, 11, 12],
          defensemen: [20, 21, 22, 23],
          goalies: [30]
        },
        playerId: 23
      })
    ).toEqual({
      lineCombo: { slot: 2, positionGroup: "defense" },
      hasSourceRow: true,
      hasTrustedAssignment: true
    });
  });

  it("treats missing rows or unassigned players as untrusted contextual labels", () => {
    expect(
      resolveTrustedLineAssignment({
        row: null,
        playerId: 14
      })
    ).toEqual({
      lineCombo: { slot: null, positionGroup: null },
      hasSourceRow: false,
      hasTrustedAssignment: false
    });

    expect(
      resolveTrustedLineAssignment({
        row: {
          forwards: [10, 11, 12],
          defensemen: [20, 21],
          goalies: [30]
        },
        playerId: 99
      })
    ).toEqual({
      lineCombo: { slot: null, positionGroup: null },
      hasSourceRow: true,
      hasTrustedAssignment: false
    });
  });
});
