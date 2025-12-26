import { describe, expect, it } from "vitest";
import { reconcileTeamToPlayers } from "lib/projections/reconcile";

describe("reconcileTeamToPlayers", () => {
  it("enforces exact TOI totals by strength (integer seconds)", () => {
    const { players, report } = reconcileTeamToPlayers({
      players: [
        { playerId: 1, toiEsSeconds: 800, toiPpSeconds: 100, shotsEs: 3, shotsPp: 1 },
        { playerId: 2, toiEsSeconds: 600, toiPpSeconds: 200, shotsEs: 2, shotsPp: 2 },
        { playerId: 3, toiEsSeconds: 400, toiPpSeconds: 50, shotsEs: 1, shotsPp: 0.5 }
      ],
      targets: { toiEsSeconds: 1000, toiPpSeconds: 500, shotsEs: 6, shotsPp: 4 }
    });

    expect(players.reduce((a, p) => a + p.toiEsSeconds, 0)).toBe(1000);
    expect(players.reduce((a, p) => a + p.toiPpSeconds, 0)).toBe(500);
    expect(players.every((p) => Number.isInteger(p.toiEsSeconds))).toBe(true);
    expect(players.every((p) => Number.isInteger(p.toiPpSeconds))).toBe(true);
    expect(report.toiEs.after).toBe(1000);
    expect(report.toiPp.after).toBe(500);
  });

  it("distributes TOI rounding remainder deterministically (largest remainder, key tiebreak)", () => {
    const { players } = reconcileTeamToPlayers({
      players: [
        { playerId: 1, toiEsSeconds: 1, toiPpSeconds: 0, shotsEs: 0, shotsPp: 0 },
        { playerId: 2, toiEsSeconds: 1, toiPpSeconds: 0, shotsEs: 0, shotsPp: 0 },
        { playerId: 3, toiEsSeconds: 1, toiPpSeconds: 0, shotsEs: 0, shotsPp: 0 }
      ],
      targets: { toiEsSeconds: 5, toiPpSeconds: 0, shotsEs: 0, shotsPp: 0 }
    });

    const byId = new Map(players.map((p) => [p.playerId, p.toiEsSeconds]));
    expect(byId.get(1)).toBe(2);
    expect(byId.get(2)).toBe(2);
    expect(byId.get(3)).toBe(1);
  });

  it("scales shots totals to match team target (proportional)", () => {
    const { players, report } = reconcileTeamToPlayers({
      players: [
        { playerId: 1, toiEsSeconds: 100, toiPpSeconds: 0, shotsEs: 2, shotsPp: 0 },
        { playerId: 2, toiEsSeconds: 100, toiPpSeconds: 0, shotsEs: 8, shotsPp: 0 }
      ],
      targets: { toiEsSeconds: 200, toiPpSeconds: 0, shotsEs: 15, shotsPp: 0 }
    });

    const totalShots = players.reduce((a, p) => a + p.shotsEs, 0);
    expect(totalShots).toBeCloseTo(15, 10);
    expect(report.shotsEs.scaleApplied).toBeCloseTo(1.5, 12);
    expect(players.find((p) => p.playerId === 1)?.shotsEs).toBeCloseTo(3, 10);
    expect(players.find((p) => p.playerId === 2)?.shotsEs).toBeCloseTo(12, 10);
  });

  it("allocates shots by TOI when all player shot estimates are zero", () => {
    const { players, report } = reconcileTeamToPlayers({
      players: [
        { playerId: 10, toiEsSeconds: 100, toiPpSeconds: 0, shotsEs: 0, shotsPp: 0 },
        { playerId: 11, toiEsSeconds: 300, toiPpSeconds: 0, shotsEs: 0, shotsPp: 0 }
      ],
      targets: { toiEsSeconds: 400, toiPpSeconds: 0, shotsEs: 10, shotsPp: 0 }
    });

    expect(players.reduce((a, p) => a + p.shotsEs, 0)).toBeCloseTo(10, 10);
    expect(report.shotsEs.scaleApplied).toBeNull();
    expect(players.find((p) => p.playerId === 10)?.shotsEs).toBeCloseTo(2.5, 10);
    expect(players.find((p) => p.playerId === 11)?.shotsEs).toBeCloseTo(7.5, 10);
  });
});

