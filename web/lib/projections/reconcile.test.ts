import { describe, expect, it } from "vitest";

import {
  reconcileTeamToPlayers,
  type PlayerStrengthProjection,
  type TeamStrengthTargets,
} from "./reconcile";

const heads = [
  ["toiEsSeconds", "toiEs"],
  ["toiPpSeconds", "toiPp"],
  ["shotsEs", "shotsEs"],
  ["shotsPp", "shotsPp"],
] as const;

function player(
  playerId: number,
  values: Partial<TeamStrengthTargets> = {},
): PlayerStrengthProjection {
  return { playerId, toiEsSeconds: 0, toiPpSeconds: 0, shotsEs: 0, shotsPp: 0, ...values };
}

const zeroTargets: TeamStrengthTargets = {
  toiEsSeconds: 0, toiPpSeconds: 0, shotsEs: 0, shotsPp: 0,
};

// Pass the expected, already-rounded targets explicitly: no second copy of the
// allocator or sanitizer serves as the oracle. TOI is summed skater-seconds;
// shots are fractional expected counts, not integers or rates per 60 minutes.
function expectConservation(
  result: ReturnType<typeof reconcileTeamToPlayers>,
  expected: TeamStrengthTargets,
) {
  for (const [field, reportKey] of heads) {
    const total = result.players.reduce((sum, row) => sum + row[field], 0);
    expect(result.report[reportKey].target).toBe(expected[field]);
    expect(result.report[reportKey].after).toBe(total);
    if (field === "toiEsSeconds" || field === "toiPpSeconds") {
      expect(total).toBe(expected[field]);
      for (const row of result.players) expect(Number.isInteger(row[field])).toBe(true);
    } else {
      expect(total).toBeCloseTo(expected[field], 10);
    }
    for (const row of result.players) {
      expect(Number.isFinite(row[field])).toBe(true);
      expect(row[field]).toBeGreaterThanOrEqual(0);
    }
  }
}

describe("reconcileTeamToPlayers", () => {
  it("conserves each strength independently and reports the original totals and scales", () => {
    const targets = { toiEsSeconds: 1500, toiPpSeconds: 300, shotsEs: 3.5, shotsPp: 1.25 };
    const result = reconcileTeamToPlayers({
      players: [
        player(1, { toiEsSeconds: 600, toiPpSeconds: 300, shotsEs: 1, shotsPp: 0.75 }),
        player(2, { toiEsSeconds: 1200, toiPpSeconds: 200, shotsEs: 2, shotsPp: 0.25 }),
        player(3, { toiEsSeconds: 1200, toiPpSeconds: 100, shotsEs: 4, shotsPp: 0 }),
      ],
      targets,
    });

    expectConservation(result, targets);
    expect(result.players).toEqual([
      player(1, { toiEsSeconds: 300, toiPpSeconds: 150, shotsEs: 0.5, shotsPp: 0.9375 }),
      player(2, { toiEsSeconds: 600, toiPpSeconds: 100, shotsEs: 1, shotsPp: 0.3125 }),
      player(3, { toiEsSeconds: 600, toiPpSeconds: 50, shotsEs: 2, shotsPp: 0 }),
    ]);
    expect(result.report).toEqual({
      toiEs: { target: 1500, before: 3000, after: 1500, scaleApplied: 0.5 },
      toiPp: { target: 300, before: 600, after: 300, scaleApplied: 0.5 },
      shotsEs: { target: 3.5, before: 7, after: 3.5, scaleApplied: 0.5 },
      shotsPp: { target: 1.25, before: 1, after: 1.25, scaleApplied: 1.25 },
    });
  });

  it("keeps zero-weight players at zero when another player carries that strength", () => {
    const targets = { toiEsSeconds: 1200, toiPpSeconds: 150, shotsEs: 4, shotsPp: 0.25 };
    const result = reconcileTeamToPlayers({
      players: [
        player(1, { toiPpSeconds: 300, shotsPp: 1 }),
        player(2, { toiEsSeconds: 600, shotsEs: 2 }),
        player(3),
      ],
      targets,
    });
    expectConservation(result, targets);
    expect(result.players).toEqual([
      player(1, { toiPpSeconds: 150, shotsPp: 0.25 }),
      player(2, { toiEsSeconds: 1200, shotsEs: 4 }),
      player(3),
    ]);
  });

  it.each([
    ["zero", zeroTargets],
    ["positive", { toiEsSeconds: 1200, toiPpSeconds: 300, shotsEs: 2.5, shotsPp: 0.75 }],
  ] as const)("reports %s targets and zero allocations for an empty roster without creating participants", (_label, targets) => {
    const result = reconcileTeamToPlayers({ players: [], targets });
    expect(result.players).toEqual([]);
    // Positive totals are infeasible without rows. Do not assert conservation.
    for (const [field, reportKey] of heads) {
      expect(result.report[reportKey]).toEqual({
        target: targets[field], before: 0, after: 0, scaleApplied: null,
      });
    }
  });

  it("treats explicit zero targets as zero, including when players have positive history", () => {
    const result = reconcileTeamToPlayers({
      players: [player(1, { toiEsSeconds: 1200, toiPpSeconds: 240, shotsEs: 3, shotsPp: 1 })],
      targets: zeroTargets,
    });
    expectConservation(result, zeroTargets);
    expect(result.players).toEqual([player(1)]);
    for (const [, reportKey] of heads) expect(result.report[reportKey].scaleApplied).toBe(0);
  });

  it("leaves all-zero input and targets at zero without claiming a scale", () => {
    const result = reconcileTeamToPlayers({ players: [player(1), player(2)], targets: zeroTargets });
    expectConservation(result, zeroTargets);
    for (const [, reportKey] of heads) expect(result.report[reportKey].scaleApplied).toBeNull();
  });

  it("uses equal shares when every supplied weight is zero", () => {
    // Rows are allocation candidates, not availability declarations. With no
    // positive weights the current contract falls back to equal allocation.
    const targets = { toiEsSeconds: 6, toiPpSeconds: 3, shotsEs: 1.5, shotsPp: 0.75 };
    const result = reconcileTeamToPlayers({ players: [player(3), player(1), player(2)], targets });
    expectConservation(result, targets);
    expect(result.players).toEqual([3, 1, 2].map((id) => player(id, {
      toiEsSeconds: 2, toiPpSeconds: 1, shotsEs: 0.5, shotsPp: 0.25,
    })));
    for (const [, reportKey] of heads) expect(result.report[reportKey].scaleApplied).toBeNull();
  });

  it("allocates zero-total shot heads using reconciled TOI for the same strength", () => {
    const targets = { toiEsSeconds: 2, toiPpSeconds: 4, shotsEs: 3, shotsPp: 0.8 };
    const result = reconcileTeamToPlayers({
      players: [
        player(3, { toiEsSeconds: 1 }),
        player(1, { toiEsSeconds: 1, toiPpSeconds: 3 }),
        player(2, { toiEsSeconds: 1, toiPpSeconds: 1 }),
      ],
      targets,
    });
    expectConservation(result, targets);
    expect(result.players[0]).toEqual(player(3));
    expect(result.players[1].toiEsSeconds).toBe(1);
    expect(result.players[2].toiEsSeconds).toBe(1);
    expect(result.players[1].shotsEs).toBe(1.5);
    expect(result.players[2].shotsEs).toBe(1.5);
    expect(result.players[1].shotsPp).toBeCloseTo(0.6, 12);
    expect(result.players[2].shotsPp).toBeCloseTo(0.2, 12);
    expect(result.report.shotsEs.scaleApplied).toBeNull();
    expect(result.report.shotsPp.scaleApplied).toBeNull();
  });

  it("uses shot weights ahead of TOI weights when the shot head already has mass", () => {
    const targets = { toiEsSeconds: 1000, toiPpSeconds: 100, shotsEs: 8, shotsPp: 1 };
    const result = reconcileTeamToPlayers({
      players: [
        player(1, { toiEsSeconds: 100, toiPpSeconds: 90, shotsEs: 3, shotsPp: 0.25 }),
        player(2, { toiEsSeconds: 900, toiPpSeconds: 10, shotsEs: 1, shotsPp: 0.75 }),
      ],
      targets,
    });
    expectConservation(result, targets);
    expect(result.players.map((row) => row.shotsEs)).toEqual([6, 2]);
    expect(result.players.map((row) => row.shotsPp)).toEqual([0.25, 0.75]);
  });

  it.each([-1, Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY])(
    "sanitizes invalid numeric player weights (%s) before summing or distributing",
    (invalid) => {
      const targets = { toiEsSeconds: 600, toiPpSeconds: 120, shotsEs: 1.5, shotsPp: 0.5 };
      const result = reconcileTeamToPlayers({
        players: [
          player(1, { toiEsSeconds: invalid, toiPpSeconds: invalid, shotsEs: invalid, shotsPp: invalid }),
          player(2, targets),
        ],
        targets,
      });
      expectConservation(result, targets);
      expect(result.players).toEqual([player(1), player(2, targets)]);
      for (const [field, reportKey] of heads) {
        expect(result.report[reportKey].before).toBe(targets[field]);
        expect(result.report[reportKey].scaleApplied).toBe(1);
      }
    },
  );

  it.each([-1, Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY])(
    "sanitizes invalid numeric targets (%s) without borrowing player totals",
    (invalid) => {
      const result = reconcileTeamToPlayers({
        players: [player(1, { toiEsSeconds: 600, toiPpSeconds: 120, shotsEs: 1.5, shotsPp: 0.5 })],
        targets: { toiEsSeconds: invalid, toiPpSeconds: invalid, shotsEs: invalid, shotsPp: invalid },
      });
      expectConservation(result, zeroTargets);
      for (const [, reportKey] of heads) expect(result.report[reportKey].scaleApplied).toBe(0);
    },
  );

  it.each([
    [0.49, 0], [0.5, 1], [1.49, 1], [1.5, 2], [2.49, 2], [2.5, 3],
  ])("rounds a %s-second team target once to %s seconds, breaking equal remainders by ID", (target, rounded) => {
    const result = reconcileTeamToPlayers({
      players: [30, 10, 20].map((id) => player(id, { toiEsSeconds: 1, toiPpSeconds: 1 })),
      targets: { ...zeroTargets, toiEsSeconds: target, toiPpSeconds: target },
    });
    expectConservation(result, { ...zeroTargets, toiEsSeconds: rounded, toiPpSeconds: rounded });
    for (const row of result.players) {
      const expected = row.playerId <= rounded * 10 ? 1 : 0;
      expect(row.toiEsSeconds).toBe(expected);
      expect(row.toiPpSeconds).toBe(expected);
    }
  });

  it("awards remaining seconds by fractional quota before player ID", () => {
    const targets = { ...zeroTargets, toiEsSeconds: 5, toiPpSeconds: 5 };
    const result = reconcileTeamToPlayers({
      players: [
        player(10, { toiEsSeconds: 2, toiPpSeconds: 4 }),
        player(20, { toiEsSeconds: 4, toiPpSeconds: 1 }),
        player(30, { toiEsSeconds: 1, toiPpSeconds: 2 }),
      ],
      targets,
    });
    expectConservation(result, targets);
    expect(result.players.map((row) => row.toiEsSeconds)).toEqual([1, 3, 1]);
    expect(result.players.map((row) => row.toiPpSeconds)).toEqual([3, 1, 1]);
  });

  it("keeps allocation by ID stable across permutations while preserving caller row order", () => {
    const players = [
      player(30, { toiEsSeconds: 1, toiPpSeconds: 3, shotsEs: 0.1 }),
      player(10, { toiEsSeconds: 1, toiPpSeconds: 2, shotsEs: 0.2 }),
      player(20, { toiEsSeconds: 1, toiPpSeconds: 1, shotsEs: 0.3 }),
    ];
    const targets = { toiEsSeconds: 2, toiPpSeconds: 5, shotsEs: 0.9, shotsPp: 0.7 };
    const baseline = reconcileTeamToPlayers({ players, targets });
    for (const order of [[0, 1, 2], [0, 2, 1], [1, 0, 2], [1, 2, 0], [2, 0, 1], [2, 1, 0]]) {
      const reordered = order.map((index) => players[index]);
      const result = reconcileTeamToPlayers({ players: reordered, targets });
      expectConservation(result, targets);
      expect(result.players.map((row) => row.playerId)).toEqual(reordered.map((row) => row.playerId));
      for (const row of result.players) {
        const original = baseline.players.find((candidate) => candidate.playerId === row.playerId)!;
        for (const [field] of heads) expect(row[field]).toBeCloseTo(original[field], 12);
      }
    }
  });

  it("preserves seconds and expected counts without an implicit minutes, per-60 or horizon conversion", () => {
    const players = [
      player(1, { toiEsSeconds: 12 * 60, toiPpSeconds: 3 * 60, shotsEs: 1.5, shotsPp: 0.75 }),
      player(2, { toiEsSeconds: 18 * 60, toiPpSeconds: 2 * 60, shotsEs: 2.25, shotsPp: 0.25 }),
    ];
    const targets = { toiEsSeconds: 30 * 60, toiPpSeconds: 5 * 60, shotsEs: 3.75, shotsPp: 1 };
    const result = reconcileTeamToPlayers({ players, targets });
    expectConservation(result, targets);
    expect(result.players).toEqual(players);

    const doubledToi = { ...targets, toiEsSeconds: 60 * 60, toiPpSeconds: 10 * 60 };
    const scaled = reconcileTeamToPlayers({ players, targets: doubledToi });
    expectConservation(scaled, doubledToi);
    scaled.players.forEach((row, index) => {
      expect(row.toiEsSeconds).toBe(players[index].toiEsSeconds * 2);
      expect(row.toiPpSeconds).toBe(players[index].toiPpSeconds * 2);
      expect(row.shotsEs).toBe(players[index].shotsEs);
      expect(row.shotsPp).toBe(players[index].shotsPp);
    });
  });

  it("preserves the inputs and is idempotent after reconciliation to the same targets", () => {
    const players = [
      player(3, { toiEsSeconds: 101.3, toiPpSeconds: 30.7, shotsEs: 0.1 }),
      player(1, { toiEsSeconds: 201.2, toiPpSeconds: 20.2, shotsEs: 0.2 }),
      player(2, { toiEsSeconds: 301.1, toiPpSeconds: 10.3, shotsEs: 0.3 }),
    ];
    const targets = { toiEsSeconds: 900, toiPpSeconds: 120, shotsEs: 1.7, shotsPp: 0.3 };
    const before = JSON.stringify({ players, targets });
    players.forEach(Object.freeze);
    Object.freeze(players);
    Object.freeze(targets);
    const first = reconcileTeamToPlayers({ players, targets });
    const second = reconcileTeamToPlayers({ players: first.players, targets });
    expect(JSON.stringify({ players, targets })).toBe(before);
    expect(first.players).not.toBe(players);
    expectConservation(first, targets);
    expectConservation(second, targets);
    first.players.forEach((row, index) => {
      expect(row).not.toBe(players[index]);
      for (const [field] of heads) expect(second.players[index][field]).toBeCloseTo(row[field], 12);
    });
  });

  it.each([1, 2, 5, 18, 23])("conserves a deterministic %i-player fixture over zero, fractional and team-sized targets", (size) => {
    // Unique IDs match the production caller's Map entries. Zero-weight PP
    // rows exercise sparse participation; no eligibility probabilities exist
    // in this helper's input contract.
    const players = Array.from({ length: size }, (_, index) => player(1000 - index, {
      toiEsSeconds: (index + 1) * 73.25,
      toiPpSeconds: index % 3 === 0 ? (index + 1) * 15.5 : 0,
      shotsEs: (index + 1) * 0.13,
      shotsPp: index % 3 === 0 ? (index + 1) * 0.07 : 0,
    }));
    for (const targets of [
      zeroTargets,
      { toiEsSeconds: 7, toiPpSeconds: 2, shotsEs: 0.23, shotsPp: 0.09 },
      { toiEsSeconds: size * 900, toiPpSeconds: size * 60, shotsEs: size * 1.3, shotsPp: size * 0.2 },
    ]) {
      const result = reconcileTeamToPlayers({ players, targets });
      expectConservation(result, targets);
      for (const field of ["toiEsSeconds", "toiPpSeconds"] as const) {
        const weight = players.reduce((sum, row) => sum + row[field], 0);
        result.players.forEach((row, index) => {
          const quota = players[index][field] / weight * targets[field];
          expect(Math.abs(row[field] - quota)).toBeLessThan(1);
          if (players[index][field] === 0) expect(row[field]).toBe(0);
        });
      }
    }
  });
});
