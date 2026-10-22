// Entirely fictional inputs for the A1/U2 descriptive SOG specification.
export const row = (game, shots, overrides = {}) => ({
  playerId: "synthetic-player", gameId: `synthetic-game-${game}`,
  teamId: "synthetic-team-a", date: `2026-10-${String(game).padStart(2, "0")}`,
  seasonId: 20262027, phase: "regular", final: true,
  games_played: 1, shots, ...overrides,
});

export const packet = (rows = [], overrides = {}) => ({
  playerId: "synthetic-player", seasonId: 20262027, phase: "regular",
  seasonWindow: { start: "2026-09-01", end: "2027-08-31" },
  asOfDate: "2026-10-22", window: { kind: "last10" },
  populationCoverage: "complete", unconfirmedScheduleGames: 0,
  rows, ...overrides,
});

export const fixtures = {
  steady: packet([row(1, 3), row(2, 3)]),
  alternating: packet([row(1, 0), row(2, 6)]),
  boundaries: packet([0, 1, 2, 3, 4, 6].map((sog, index) => row(index + 1, sog))),
  allZero: packet([row(1, 0), row(2, 0)]),
  partialSog: packet([row(1, 0), row(2, null), row(3, 4)]),
  appearances: packet([
    row(1, 0), row(2, 3), row(3, null, { games_played: 0 }),
    row(4, 0, { games_played: 0 }), row(5, null, { games_played: null }),
    // Counts never supply an appearance identity by inference.
    row(6, 4, { games_played: null }),
  ], { populationCoverage: "partial", unconfirmedScheduleGames: 1 }),
  noAppearances: packet([row(1, 0, { games_played: 0 })]),
  noObservedSog: packet([row(1, null), row(2, null)]),
  emptyComplete: packet([]),
  emptyUnknown: packet([], { populationCoverage: "unknown" }),
  partialPopulation: packet([row(1, 3)], { populationCoverage: "partial" }),
  unknownPopulation: packet([row(1, 3)], { populationCoverage: "unknown" }),
  missingAtWindowEdge: packet([
    row(1, 9), row(2, 0), ...Array.from({ length: 8 }, (_, index) => row(index + 3, 3)), row(11, null),
  ]),
  traded: packet([row(1, 0), row(2, 2), row(3, 4, { teamId: "synthetic-team-b" }), row(4, 6, { teamId: "synthetic-team-b" })]),
  duplicates: packet([row(1, 3), row(1, 3), row(2, 0)]),
  excludedScope: packet([
    row(1, 3), row(2, 6, { phase: "playoff" }),
    row(3, 6, { seasonId: 20252026, date: "2025-10-03" }),
    row(4, 6, { date: "2026-10-22" }), row(5, 6, { date: "2026-10-23" }),
    row(6, 6, { final: false }),
  ]),
  custom: packet([row(1, 9), row(2, 0), row(3, 3), row(4, 4)], {
    window: { kind: "custom", start: "2026-10-02", end: "2026-10-03" },
  }),
};
