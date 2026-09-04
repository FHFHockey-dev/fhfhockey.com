import { describe, expect, it } from "vitest";

import {
  assignPlayersToActiveSlots,
  calculateCandidateDust,
  canEligibilityOccupySlot,
  classifyDustRisk,
  createOptimizerCacheSignature,
  evaluateRosterSchedule,
  expandActiveSlots,
  mapDateToYahooWeek,
  normalizeEligibility,
  prepareTeamSchedule,
  rankAlternativeRecommendations,
  type CandidateDustEvaluation,
  type OptimizerPlayer,
  type YahooMatchupWeek,
} from ".";

const weeks: YahooMatchupWeek[] = [
  {
    id: 101,
    gameKey: "477",
    season: "2025",
    week: 1,
    startDate: "2025-10-06",
    endDate: "2025-10-12",
  },
  {
    id: 102,
    gameKey: "477",
    season: "2025",
    week: 2,
    startDate: "2025-10-13",
    endDate: "2025-10-19",
  },
];

function player(
  id: string,
  eligiblePositions: string | readonly string[],
  value = 10,
  teamAbbreviation = id.toUpperCase(),
): OptimizerPlayer {
  return {
    id,
    name: `Player ${id}`,
    teamAbbreviation,
    eligiblePositions,
    value,
  };
}

function oneDateSchedule(players: readonly OptimizerPlayer[]) {
  return prepareTeamSchedule(
    players.flatMap((item) =>
      item.teamAbbreviation
        ? [
            {
              gameId: `game-${item.id}`,
              date: "2025-10-06",
              teamAbbreviation: item.teamAbbreviation,
              yahooWeek: 1,
            },
          ]
        : [],
    ),
  );
}

function dust(
  item: OptimizerPlayer,
  marginalDustGames: number,
): CandidateDustEvaluation {
  return {
    player: item,
    marginalDustGames,
    candidateScheduledGames: 10,
    activeGamesAdded: 10 - marginalDustGames,
    candidateStartableGames: 10 - marginalDustGames,
    candidateAttributedBenchGames: marginalDustGames,
    displacedRosterBenchGames: 0,
    dustRate: marginalDustGames / 10,
    weekByWeek: [],
    highestConflictDates: [],
    diagnostics: [],
  };
}

describe("eligibility and active slots", () => {
  it("normalizes Yahoo labels deterministically without a fixed multi-position discount", () => {
    expect(normalizeEligibility(["lw", "C", "LW"])).toEqual({
      valid: true,
      positions: ["C", "LW"],
      playerClass: "skater",
      unknownLabels: [],
      sourceLabels: ["C", "LW"],
    });
    expect(normalizeEligibility("FWD / W").positions).toEqual(["F", "W"]);
  });

  it("fails closed for empty, unknown, and mixed skater/goalie eligibility", () => {
    expect(normalizeEligibility(null).valid).toBe(false);
    expect(normalizeEligibility(["C", "MYSTERY"])).toMatchObject({
      valid: false,
      unknownLabels: ["MYSTERY"],
    });
    expect(normalizeEligibility(["C", "G"])).toMatchObject({
      valid: false,
      playerClass: null,
    });
  });

  it("handles forward, wing, defense, utility, and goalie compatibility", () => {
    const center = normalizeEligibility("C");
    const wing = normalizeEligibility("LW");
    const defense = normalizeEligibility("D");
    const goalie = normalizeEligibility("G");
    expect(canEligibilityOccupySlot(center, "F")).toBe(true);
    expect(canEligibilityOccupySlot(wing, "W")).toBe(true);
    expect(canEligibilityOccupySlot(defense, "UTIL")).toBe(true);
    expect(canEligibilityOccupySlot(goalie, "UTIL")).toBe(false);
    expect(canEligibilityOccupySlot(goalie, "G")).toBe(true);
  });

  it("expands duplicate active slots and excludes bench and inactive destinations", () => {
    const result = expandActiveSlots({ RW: 2, FWD: 1, UTIL: 1, G: 2, BN: 4, IR: 2 });
    expect(result.activeSlots.map((slot) => slot.id)).toEqual([
      "RW#1",
      "RW#2",
      "F#1",
      "UTIL#1",
      "G#1",
      "G#2",
    ]);
    expect(result.benchCapacity).toBe(4);
    expect(result.inactiveCapacity).toBe(2);
  });

  it("diagnoses unknown slots and invalid counts instead of adding capacity", () => {
    const result = expandActiveSlots({ RW: 1, SUPERFLEX: 2, BN: -1 });
    expect(result.activeSlots).toHaveLength(1);
    expect(result.diagnostics.map((item) => item.code)).toEqual([
      "INVALID_SLOT_COUNT",
      "UNKNOWN_ROSTER_SLOT",
    ]);
  });
});

describe("exact daily matching and Bench Games", () => {
  it("counts exactly two Bench Games for four RW-only players and two RW slots", () => {
    const roster = [player("a", "RW"), player("b", "RW"), player("c", "RW"), player("d", "RW")];
    const result = evaluateRosterSchedule({
      roster,
      rosterSlots: { RW: 2, BN: 2 },
      schedule: oneDateSchedule(roster),
    });
    expect(result.totalScheduledGames).toBe(4);
    expect(result.totalStartableGames).toBe(2);
    expect(result.totalBenchGames).toBe(2);
  });

  it("counts zero Bench Games when only two of four RW-only roster players play", () => {
    const roster = [player("a", "RW"), player("b", "RW"), player("c", "RW"), player("d", "RW")];
    const schedule = oneDateSchedule(roster.slice(0, 2));
    const result = evaluateRosterSchedule({
      roster,
      rosterSlots: { RW: 2, BN: 2 },
      schedule: {
        ...schedule,
        knownTeams: new Set(roster.map((item) => item.teamAbbreviation!)),
      },
    });
    expect(result.totalScheduledGames).toBe(2);
    expect(result.totalBenchGames).toBe(0);
  });

  it("uses LW for C/LW eligibility when C is occupied", () => {
    const roster = [player("center", "C", 20), player("flex", ["C", "LW"], 10)];
    const slots = expandActiveSlots({ C: 1, LW: 1 }).activeSlots;
    const result = assignPlayersToActiveSlots(roster, slots).assignment;
    expect(result.startableGames).toBe(2);
    expect(result.assignments.find((item) => item.playerId === "flex")?.slotType).toBe("LW");
  });

  it("does not invent flexibility when both C and LW are consumed", () => {
    const roster = [
      player("center", "C", 20),
      player("wing", "LW", 19),
      player("flex", ["C", "LW"], 1),
    ];
    const result = assignPlayersToActiveSlots(
      roster,
      expandActiveSlots({ C: 1, LW: 1 }).activeSlots,
    ).assignment;
    expect(result.startableGames).toBe(2);
    expect(result.benchedPlayerIds).toEqual(["flex"]);
  });

  it("uses UTIL for a skater but isolates a goalie to G", () => {
    const skaterOnly = assignPlayersToActiveSlots(
      [player("d", "D")],
      expandActiveSlots({ UTIL: 1 }).activeSlots,
    ).assignment;
    const goalieOnly = assignPlayersToActiveSlots(
      [player("g", "G")],
      expandActiveSlots({ UTIL: 1 }).activeSlots,
    ).assignment;
    expect(skaterOnly.startableGames).toBe(1);
    expect(goalieOnly.startableGames).toBe(0);
    expect(goalieOnly.benchGames).toBe(1);
  });

  it("assigns one player once and each duplicate slot instance to at most one player", () => {
    const slots = expandActiveSlots({ C: 2 }).activeSlots;
    const one = assignPlayersToActiveSlots([player("one", "C")], slots).assignment;
    const three = assignPlayersToActiveSlots(
      [player("a", "C"), player("b", "C"), player("c", "C")],
      slots,
    ).assignment;
    expect(one.assignments).toHaveLength(1);
    expect(new Set(three.assignments.map((item) => item.slotId)).size).toBe(2);
    expect(three.benchGames).toBe(1);
  });

  it("fails closed when the same player ID is accidentally supplied twice", () => {
    const duplicate = player("same", ["C", "LW"]);
    const result = assignPlayersToActiveSlots(
      [duplicate, { ...duplicate, value: 99 }],
      expandActiveSlots({ C: 1, LW: 1 }).activeSlots,
    );
    expect(result.assignment.scheduledGames).toBe(1);
    expect(result.assignment.assignments).toHaveLength(1);
    expect(result.diagnostics).toContainEqual(
      expect.objectContaining({ code: "DUPLICATE_PLAYER_ID", playerId: "same" }),
    );
  });

  it("maximizes cardinality first, then attributes starts to the greatest total value", () => {
    const roster = [
      player("high-flex", ["C", "LW"], 100),
      player("low-center", "C", 10),
      player("mid-wing", "LW", 20),
    ];
    const result = assignPlayersToActiveSlots(
      roster,
      expandActiveSlots({ C: 1, LW: 1 }).activeSlots,
    ).assignment;
    expect(result.startableGames).toBe(2);
    expect(result.benchedPlayerIds).toEqual(["low-center"]);
  });

  it("produces the same assignment regardless of player and slot input order", () => {
    const roster = [player("b", ["C", "LW"], 10), player("a", ["C", "LW"], 10)];
    const slots = expandActiveSlots({ C: 1, LW: 1 }).activeSlots;
    expect(assignPlayersToActiveSlots(roster, slots).assignment.assignments).toEqual(
      assignPlayersToActiveSlots([...roster].reverse(), [...slots].reverse())
        .assignment.assignments,
    );
  });

  it("returns unresolved games and player/date diagnostics for bad eligibility", () => {
    const roster = [player("known", "RW"), player("bad", ["RW", "ALIEN"])];
    const result = evaluateRosterSchedule({
      roster,
      rosterSlots: { RW: 1, BN: 1 },
      schedule: oneDateSchedule(roster),
    });
    expect(result.totalBenchGames).toBe(0);
    expect(result.totalUnresolvedGames).toBe(1);
    expect(result.complete).toBe(false);
    expect(result.diagnostics).toContainEqual(
      expect.objectContaining({
        code: "UNKNOWN_ELIGIBILITY",
        playerId: "bad",
        date: "2025-10-06",
      }),
    );
  });

  it("does not create a Bench Game for a player whose team has no game", () => {
    const playing = player("playing", "RW");
    const idle = player("idle", "RW");
    const schedule = oneDateSchedule([playing]);
    const result = evaluateRosterSchedule({
      roster: [playing, idle],
      rosterSlots: { RW: 1, BN: 1 },
      schedule: {
        ...schedule,
        knownTeams: new Set([playing.teamAbbreviation!, idle.teamAbbreviation!]),
      },
    });
    expect(result.totalScheduledGames).toBe(1);
    expect(result.totalBenchGames).toBe(0);
  });

  it("includes bench-status keepers while excluding IR players", () => {
    const keeper = { ...player("keeper", "RW", 20), status: "bench" as const };
    const drafted = player("drafted", "RW", 10);
    const injured = { ...player("injured", "RW", 100), status: "ir" as const };
    const result = evaluateRosterSchedule({
      roster: [keeper, drafted, injured],
      rosterSlots: { RW: 1, BN: 1, IR: 1 },
      schedule: oneDateSchedule([keeper, drafted, injured]),
    });
    expect(result.totalScheduledGames).toBe(2);
    expect(result.totalBenchGames).toBe(1);
    expect(result.daily[0].assignments[0].playerId).toBe("keeper");
  });

  it("diagnoses illegal roster capacity but still returns exact conflicts", () => {
    const roster = [player("a", "RW"), player("b", "RW"), player("c", "RW")];
    const result = evaluateRosterSchedule({
      roster,
      rosterSlots: { RW: 1, BN: 1 },
      schedule: oneDateSchedule(roster),
    });
    expect(result.totalBenchGames).toBe(2);
    expect(result.diagnostics).toContainEqual(
      expect.objectContaining({ code: "ROSTER_OVER_CAPACITY" }),
    );
  });
});

describe("Yahoo weeks and schedule preparation", () => {
  it("maps Yahoo start and end dates inclusively", () => {
    expect(mapDateToYahooWeek("2025-10-06", weeks, "477")).toMatchObject({
      status: "mapped",
      week: { week: 1 },
    });
    expect(mapDateToYahooWeek("2025-10-12", weeks, "477")).toMatchObject({
      status: "mapped",
      week: { week: 1 },
    });
  });

  it("returns explicitly unmapped for dates outside all Yahoo weeks", () => {
    expect(mapDateToYahooWeek("2025-10-05", weeks, "477")).toEqual({
      status: "unmapped",
      reason: "outside_weeks",
      matchingWeeks: [],
    });
    expect(mapDateToYahooWeek("not-a-date", weeks, "477")).toMatchObject({
      status: "unmapped",
      reason: "invalid_date",
    });
  });

  it("maps selected weeks, excludes outside games, and reports the unmapped date", () => {
    const schedule = prepareTeamSchedule(
      [
        { gameId: "start", date: "2025-10-06", teamAbbreviation: "NYR" },
        { gameId: "end", date: "2025-10-12", teamAbbreviation: "BOS" },
        { gameId: "outside", date: "2025-10-20", teamAbbreviation: "PHI" },
      ],
      { matchupWeeks: weeks, selectedWeeks: [1], gameKey: "477" },
    );
    expect(schedule.gamesByDate.size).toBe(2);
    expect(schedule.diagnostics).toContainEqual(
      expect.objectContaining({ code: "UNMAPPED_DATE", date: "2025-10-20" }),
    );
  });

  it("aggregates daily assignments into manually verifiable Yahoo weekly totals", () => {
    const a = player("a", "RW", 20, "NYR");
    const b = player("b", "RW", 10, "BOS");
    const schedule = prepareTeamSchedule(
      [
        { date: "2025-10-06", teamAbbreviation: "NYR" },
        { date: "2025-10-06", teamAbbreviation: "BOS" },
        { date: "2025-10-13", teamAbbreviation: "NYR" },
      ],
      { matchupWeeks: weeks, gameKey: "477" },
    );
    const result = evaluateRosterSchedule({
      roster: [a, b],
      rosterSlots: { RW: 1, BN: 1 },
      schedule,
    });
    expect(result.weekly).toEqual([
      { week: 1, scheduledGames: 2, startableGames: 1, benchGames: 1, unresolvedGames: 0 },
      { week: 2, scheduledGames: 1, startableGames: 1, benchGames: 0, unresolvedGames: 0 },
    ]);
  });

  it("ignores postponed/cancelled games and deduplicates a repeated team-date", () => {
    const schedule = prepareTeamSchedule([
      { gameId: "1", date: "2025-10-06", teamAbbreviation: "NYR" },
      { gameId: "1-copy", date: "2025-10-06", teamAbbreviation: "NYR" },
      { gameId: "2", date: "2025-10-07", teamAbbreviation: "NYR", status: "postponed" },
      { gameId: "3", date: "2025-10-08", teamAbbreviation: "NYR", status: "cancelled" },
    ]);
    expect(schedule.gamesByTeam.get("NYR")).toHaveLength(1);
    expect(schedule.diagnostics).toContainEqual(
      expect.objectContaining({ code: "DUPLICATE_TEAM_DATE" }),
    );
  });

  it("uses a player's current team mapping for all future games", () => {
    const movedPlayer = player("moved", "C", 10, "BOS");
    const schedule = prepareTeamSchedule([
      { date: "2025-10-06", teamAbbreviation: "NYR" },
      { date: "2025-10-07", teamAbbreviation: "BOS" },
    ]);
    const result = evaluateRosterSchedule({
      roster: [movedPlayer],
      rosterSlots: { C: 1 },
      schedule,
    });
    expect(result.daily.map((date) => date.date)).toEqual(["2025-10-07"]);
  });
});

describe("marginal DUST and state reversibility", () => {
  it("calculates candidate DUST as after Bench Games minus baseline Bench Games", () => {
    const roster = [player("a", "RW", 30), player("b", "RW", 20)];
    const candidate = player("candidate", "RW", 40);
    const schedule = oneDateSchedule([...roster, candidate]);
    const input = { roster, rosterSlots: { RW: 2, BN: 2 }, schedule };
    const baseline = evaluateRosterSchedule(input);
    const result = calculateCandidateDust(input, candidate, baseline);
    expect(baseline.totalBenchGames).toBe(0);
    expect(result.marginalDustGames).toBe(1);
    expect(result.activeGamesAdded).toBe(0);
    expect(result.candidateStartableGames).toBe(1);
    expect(result.candidateAttributedBenchGames).toBe(0);
    expect(result.displacedRosterBenchGames).toBe(1);
  });

  it("attributes the bench to a lower-value candidate without changing cardinality", () => {
    const roster = [player("a", "RW", 30), player("b", "RW", 20)];
    const candidate = player("candidate", "RW", 1);
    const schedule = oneDateSchedule([...roster, candidate]);
    const input = { roster, rosterSlots: { RW: 2, BN: 2 }, schedule };
    const result = calculateCandidateDust(input, candidate);
    expect(result.marginalDustGames).toBe(1);
    expect(result.candidateStartableGames).toBe(0);
    expect(result.candidateAttributedBenchGames).toBe(1);
    expect(result.displacedRosterBenchGames).toBe(0);
  });

  it("reverts after add/remove (the engine analogue of draft undo) without stale state", () => {
    const roster = [player("a", "RW", 30), player("b", "RW", 20)];
    const candidate = player("candidate", "RW", 1);
    const schedule = oneDateSchedule([...roster, candidate]);
    const before = evaluateRosterSchedule({ roster, rosterSlots: { RW: 2, BN: 2 }, schedule });
    const after = evaluateRosterSchedule({ roster: [...roster, candidate], rosterSlots: { RW: 2, BN: 2 }, schedule });
    const undone = evaluateRosterSchedule({ roster, rosterSlots: { RW: 2, BN: 2 }, schedule });
    expect([before.totalBenchGames, after.totalBenchGames, undone.totalBenchGames]).toEqual([0, 1, 0]);
    expect(undone).toEqual(before);
  });

  it("returns useful empty and unknown-team diagnostics instead of a misleading success", () => {
    const schedule = prepareTeamSchedule([]);
    const result = evaluateRosterSchedule({
      roster: [player("lost", "C", 1, "XXX")],
      rosterSlots: { C: 1 },
      schedule,
    });
    expect(result.totalScheduledGames).toBe(0);
    expect(result.complete).toBe(false);
    expect(result.diagnostics.map((item) => item.code)).toEqual(
      expect.arrayContaining(["EMPTY_SCHEDULE", "UNKNOWN_TEAM"]),
    );
  });

  it("returns a valid zero evaluation for an empty roster against a loaded schedule", () => {
    const schedule = prepareTeamSchedule([
      { date: "2025-10-06", teamAbbreviation: "NYR" },
    ]);
    const result = evaluateRosterSchedule({
      roster: [],
      rosterSlots: { C: 1, BN: 1 },
      schedule,
    });
    expect(result).toMatchObject({
      totalScheduledGames: 0,
      totalStartableGames: 0,
      totalBenchGames: 0,
      totalUnresolvedGames: 0,
      complete: true,
    });
  });

  it("surfaces the daily-lineup assumption for weekly-lock leagues", () => {
    const roster = [player("a", "C")];
    const result = evaluateRosterSchedule({
      roster,
      rosterSlots: { C: 1 },
      schedule: oneDateSchedule(roster),
      lineupMode: "weekly",
    });
    expect(result.complete).toBe(false);
    expect(result.diagnostics).toContainEqual(
      expect.objectContaining({ code: "WEEKLY_LINEUP_UNSUPPORTED" }),
    );
  });
});

describe("recommendations, risk, and caching", () => {
  it("filters by availability, class, compatible slots, DUST gain, and value loss", () => {
    const candidate = dust(player("candidate", "C", 100), 6);
    const good = dust(player("good", ["C", "LW"], 96), 2);
    const goalie = dust(player("goalie", "G", 100), 0);
    const tooCheap = dust(player("cheap", "C", 90), 0);
    const unavailable = dust({ ...player("taken", "C", 100), available: false }, 0);
    const result = rankAlternativeRecommendations(
      candidate,
      [goalie, tooCheap, unavailable, good],
      { C: 1, LW: 1, UTIL: 1 },
    );
    expect(result.map((item) => item.player.id)).toEqual(["good"]);
    expect(result[0]).toMatchObject({ dustImprovement: 4, valueDifference: -4 });
    expect(result[0].overlappingSlotTypes).toContain("C");
    expect(result[0].overlappingSlotTypes).not.toContain("UTIL");
  });

  it("requires a 25% DUST improvement and rejects UTIL-only positional overlap", () => {
    const candidate = dust(player("candidate", "C", 100), 12);
    const tooSmall = dust(player("small", "C", 99), 10);
    const defenseOnly = dust(player("defense", "D", 99), 0);

    expect(
      rankAlternativeRecommendations(
        candidate,
        [tooSmall, defenseOnly],
        { C: 1, D: 1, UTIL: 1 },
      ),
    ).toEqual([]);
  });

  it("ranks by DUST improvement, then value loss, value, and stable player ID", () => {
    const candidate = dust(player("candidate", "RW", 100), 8);
    const alternatives = [
      dust(player("b", "RW", 98), 3),
      dust(player("a", "RW", 98), 3),
      dust(player("less-dust", "RW", 97), 2),
    ];
    expect(
      rankAlternativeRecommendations(candidate, alternatives, { RW: 1 }).map(
        (item) => item.player.id,
      ),
    ).toEqual(["less-dust", "a", "b"]);
  });

  it("classifies typed DUST risk using both exact games and rate", () => {
    expect(classifyDustRisk(1, 4).label).toBe("low");
    expect(classifyDustRisk(2, 20).label).toBe("moderate");
    expect(classifyDustRisk(4, 20).label).toBe("elevated");
    expect(classifyDustRisk(7, 20).label).toBe("high");
    expect(classifyDustRisk(0, 0)).toMatchObject({ label: "low", dustRate: 0 });
  });

  it("builds an order-independent cache signature and changes on relevant state", () => {
    const a = player("a", ["C", "LW"], 10, "nyr");
    const b = player("b", "RW", 20, "BOS");
    const base = {
      roster: [a, b],
      rosterSlots: { C: 1, LW: 1, RW: 1, BN: 2 },
      gameKey: "477",
      selectedWeeks: [2, 1],
      scheduleVersion: "2025-10-01T00:00:00Z",
    };
    const reordered = {
      ...base,
      roster: [b, { ...a, eligiblePositions: ["LW", "C"] }],
      rosterSlots: { BN: 2, RW: 1, LW: 1, C: 1 },
      selectedWeeks: [1, 2, 2],
    };
    expect(createOptimizerCacheSignature(reordered)).toBe(
      createOptimizerCacheSignature(base),
    );
    expect(
      createOptimizerCacheSignature({ ...base, scheduleVersion: "new" }),
    ).not.toBe(createOptimizerCacheSignature(base));
  });
});
