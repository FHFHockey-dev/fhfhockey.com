import { renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { usePlayerRecommendations } from "../../hooks/usePlayerRecommendations";
import { getRequiredCsvColumns } from "./csvImportContract";
import { validateCsvProjectionRows } from "./csvImportValidation";
import { getEffectiveSourceShares } from "./sourceWeights";
import { groupPlayerEligibility } from "./forwardGrouping";
import { materializeKeeperPicks, validateKeeperCandidate } from "./keepers";
import { resolvePickOwner, upsertPickTrade } from "./pickTrades";
import { buildDraftConfigurationSummary } from "./summaryConfiguration";
import { aggregateTeamCategoryTotals, categoryRankBand, rankTeamCategories } from "./categoryStandings";
import { bookmarkImportError, validateDraftSettings } from "./settingsValidation";

const csvPlayer = (id: number, name: string, position: string) => ({
  player_id: id,
  Player_Name: name,
  Team_Abbreviation: "CAR",
  Position: position,
  Games_Played: "82",
  Goals: 30,
  Assists: 50,
  Points: 80,
  PP_Points: 25,
  Shots_on_Goal: 250,
  Hits: 40,
  Blocked_Shots: 20,
});

describe("representative draft workflow", () => {
  const settings = {
    teamCount: 2, draftOrder: ["Team 1", "Team 2"],
    scoringCategories: { GOALS: 3 },
    rosterConfig: { C: 1, G: 1, bench: 1, utility: 0 },
    draftOrderMode: "snake" as const,
  };
  const input = {
    settings, myTeamId: "Team 1", goalieScoring: { WINS_GOALIE: 4 },
    skaterSources: { dtz_skaters: { isSelected: true, weight: 1 } },
    goalieSources: { dtz_goalies: { isSelected: true, weight: 1 } },
  };
  const picks = [1, 2, 3].map((pickNumber) => ({ playerId: String(pickNumber), teamId: "Team 1", pickNumber, round: Math.ceil(pickNumber / 2), pickInRound: (pickNumber - 1) % 2 + 1 }));

  it("validates both source groups, scoring, teams, and active roster conflicts without changing picks", () => {
    expect(validateDraftSettings(input).valid).toBe(true);
    expect(validateDraftSettings({ ...input, goalieSources: { dtz_goalies: { isSelected: true, weight: 0 } } }).domains.projections).toBe(false);
    expect(validateDraftSettings({ ...input, skaterSources: { dtz_skaters: { isSelected: true, weight: NaN } } }).domains.projections).toBe(false);
    expect(validateDraftSettings({ ...input, settings: { ...settings, scoringCategories: {} }, goalieScoring: {} }).domains.scoring).toBe(false);
    expect(validateDraftSettings({ ...input, settings: { ...settings, draftOrder: ["Team 1", "Team 1"] } }).domains.league).toBe(false);
    const before = JSON.stringify(picks);
    const conflict = validateDraftSettings({ ...input, settings: { ...settings, rosterConfig: { C: 1, G: 1, bench: 0, utility: 0 } }, draftedPlayers: picks });
    expect(conflict.errors.some(issue => issue.message.includes("3 players but only 2"))).toBe(true);
    expect(JSON.stringify(picks)).toBe(before);
    const positionalConflict = validateDraftSettings({ ...input, settings: { ...settings, rosterConfig: { C: 3, G: 0, bench: 0, utility: 0 } }, draftedPlayers: [picks[0]], playerEligibility: new Map([["1", ["G"]]]) });
    expect(positionalConflict.domains.roster).toBe(false);
    expect(positionalConflict.errors[0].message).toContain("drafted positions exceed");
  });

  it("accepts valid portable sessions and rejects malformed or destructive imports before application", () => {
    const bookmark = { v: 3, settings, myTeamId: "Team 1", draftedPlayers: picks, currentPick: 4, sourceControls: input.skaterSources, goalieSourceControls: input.goalieSources, goalieScoringCategories: input.goalieScoring };
    expect(bookmarkImportError(bookmark)).toBeNull();
    for (const invalid of [null, { v: 3, settings: {} }, { ...bookmark, settings: { ...settings, rosterConfig: [] } }, { ...bookmark, draftedPlayers: [picks[0], picks[0]] }, { ...bookmark, currentPick: -1 }, { ...bookmark, keepers: [{ playerId: "4", teamId: "missing", round: 1, pickInRound: 1 }] }, { ...bookmark, pickTrades: [{ round: 999, pickInRound: 1, currentTeamId: "Team 2" }] }]) expect(bookmarkImportError(invalid)).not.toBeNull();
    expect(bookmarkImportError({ ...bookmark, sourceControls: { custom_csv_missing: { isSelected: true, weight: 1 } } }, [])).toContain("missing from this tab");
    const portable = { ...bookmark, sourceControls: { custom_csv_1: { isSelected: true, weight: 1 } }, customCsvList: [{ id: "custom_csv_1", label: "Private", rows: [{ player_id: 1, Position: "C", Goals: 30 }] }] };
    expect(bookmarkImportError(portable, [])).toBeNull();
    expect(bookmarkImportError({ ...portable, customCsvList: [{ ...portable.customCsvList[0], rows: [] }] }, [])).toContain("Invalid custom CSV");
    expect(bookmarkImportError({ ...bookmark, goalieScoringCategories: { GOALS_AGAINST_GOALIE: -1 } })).toBeNull();
  });

  it("accepts optional position weights and rejects malformed settings and bookmarks", () => {
    const bookmark = { v: 3, settings, myTeamId: "Team 1", draftedPlayers: picks, currentPick: 4, sourceControls: input.skaterSources, goalieSourceControls: input.goalieSources, goalieScoringCategories: input.goalieScoring };
    const weightedSettings = { ...settings, positionWeights: { D: 0, G: 2 } };
    expect(validateDraftSettings({ ...input, settings: weightedSettings }).valid).toBe(true);
    expect(bookmarkImportError({ ...bookmark, settings: weightedSettings })).toBeNull();
    expect(bookmarkImportError({ ...bookmark, v: 2 })).toBeNull();
    expect(bookmarkImportError({ ...bookmark, v: 2, settings: weightedSettings })).toBeNull();

    for (const positionWeights of [null, [], { F: 1 }, { D: NaN }, { D: Infinity }, { D: -0.1 }, { G: 2.1 }, { C: "1" }]) {
      const malformedSettings = { ...settings, positionWeights };
      expect(validateDraftSettings({ ...input, settings: malformedSettings as any }).domains.scoring).toBe(false);
      expect(bookmarkImportError({ ...bookmark, settings: malformedSettings })).toContain("Invalid bookmark settings");
    }
  });

  it("colors category ranks in quartiles, respects stat direction, and preserves ties", () => {
    const teams = Array.from({ length: 12 }, (_, index) => ({
      teamId: String(index),
      categoryTotals: { GOALS: 12 - index, GOALS_AGAINST_AVERAGE: index + 1 },
    }));
    const ranks = rankTeamCategories(teams, { GOALS: 1, GOALS_AGAINST_AVERAGE: 1 }, "categories");
    expect(ranks["0"]).toEqual({ GOALS: 1, GOALS_AGAINST_AVERAGE: 1 });
    expect(ranks["11"]).toEqual({ GOALS: 12, GOALS_AGAINST_AVERAGE: 12 });
    expect(teams.map((team) => categoryRankBand(ranks[team.teamId].GOALS, 12))).toEqual([
      "green", "green", "green", "yellow", "yellow", "yellow", "orange", "orange", "orange", "red", "red", "red",
    ]);
    teams[1].categoryTotals.GOALS = teams[0].categoryTotals.GOALS;
    const tied = rankTeamCategories(teams, { GOALS: 1 }, "categories");
    expect(tied["0"].GOALS).toBe(tied["1"].GOALS);
    const missing = rankTeamCategories([
      { teamId: "empty", categoryTotals: {} },
      { teamId: "zero", categoryTotals: { GOALS: 0 } },
    ], { GOALS: 1 }, "categories");
    expect(missing.empty.GOALS).toBe(missing.zero.GOALS);
    expect(categoryRankBand(1, 1)).toBe("green");
    expect(categoryRankBand(2, 5)).toBe("green");
  });
  it("aggregates goalie rates from workload rather than adding percentages and averages", () => {
    const goalie = (stats: Record<string, number>) => ({ displayPosition: "G", combinedStats: Object.fromEntries(Object.entries(stats).map(([key, projected]) => [key, { projected }])) });
    const totals = aggregateTeamCategoryTotals([
      goalie({ SAVES_GOALIE: 900, GOALS_AGAINST_GOALIE: 100, TOTAL_TOI: 3600 * 40, SAVE_PERCENTAGE: 0.9, GOALS_AGAINST_AVERAGE: 2.5 }),
      goalie({ SAVES_GOALIE: 190, GOALS_AGAINST_GOALIE: 10, TOTAL_TOI: 3600 * 10, SAVE_PERCENTAGE: 0.95, GOALS_AGAINST_AVERAGE: 1 }),
    ], ["SAVE_PERCENTAGE", "GOALS_AGAINST_AVERAGE"]);
    expect(totals.SAVE_PERCENTAGE.value).toBeCloseTo(1090 / 1200);
    expect(totals.GOALS_AGAINST_AVERAGE).toEqual({ value: 2.2, quality: "exact-from-projected-inputs" });
  });

  it("marks workload estimates and keeps incomplete or invalid workloads unavailable", () => {
    const goalie = (stats: Record<string, number>) => ({ eligiblePositions: ["G"], combinedStats: Object.fromEntries(Object.entries(stats).map(([key, projected]) => [key, { projected }])) });
    expect(aggregateTeamCategoryTotals([goalie({ GOALS_AGAINST_AVERAGE: 2, GAMES_STARTED: 30 }), goalie({ GOALS_AGAINST_AVERAGE: 4, GAMES_STARTED: 10 })], ["GOALS_AGAINST_AVERAGE"]).GOALS_AGAINST_AVERAGE).toEqual({ value: 2.5, quality: "estimated" });
    for (const extra of [goalie({ GOALS_AGAINST_AVERAGE: 3 }), goalie({ GOALS_AGAINST_AVERAGE: NaN, GAMES_STARTED: 10 }), {}]) {
      expect(aggregateTeamCategoryTotals([goalie({ GOALS_AGAINST_AVERAGE: 2, GAMES_STARTED: 30 }), extra], ["GOALS_AGAINST_AVERAGE"]).GOALS_AGAINST_AVERAGE).toEqual({ value: null, quality: "unavailable" });
    }
  });

  it("weights skater rates by their attempts and preserves counting totals", () => {
    const skater = (stats: Record<string, number>) => ({ displayPosition: "C", combinedStats: Object.fromEntries(Object.entries(stats).map(([key, projected]) => [key, { projected }])) });
    const totals = aggregateTeamCategoryTotals([
      skater({ GOALS: 20, SHOTS_ON_GOAL: 100, FACEOFFS_WON: 90, FACEOFFS_LOST: 10, TOTAL_TOI: 1800, GAMES_PLAYED: 1 }),
      skater({ GOALS: 10, SHOTS_ON_GOAL: 200, FACEOFFS_WON: 30, FACEOFFS_LOST: 70, TOTAL_TOI: 3600, GAMES_PLAYED: 3 }),
    ], ["GOALS", "SHOOTING_PERCENTAGE", "FACEOFF_PERCENTAGE", "TOI_PER_GAME"]);
    expect(totals.GOALS.value).toBe(30);
    expect(totals.SHOOTING_PERCENTAGE.value).toBeCloseTo(0.1);
    expect(totals.FACEOFF_PERCENTAGE.value).toBeCloseTo(0.6);
    expect(totals.TOI_PER_GAME.value).toBe(1350);
  });

  it.each([
    ["FACEOFF_PERCENTAGE", "C", { FACEOFFS_WON: 60, FACEOFFS_LOST: 40 }, { FACEOFFS_WON: 0, FACEOFFS_LOST: 0 }, 0.6],
    ["SHOOTING_PERCENTAGE", "C", { GOALS: 10, SHOTS_ON_GOAL: 100 }, { GOALS: 0, SHOTS_ON_GOAL: 0 }, 0.1],
    ["SAVE_PERCENTAGE", "G", { SAVES_GOALIE: 90, GOALS_AGAINST_GOALIE: 10 }, { SAVES_GOALIE: 0, GOALS_AGAINST_GOALIE: 0 }, 0.9],
    ["GOALS_AGAINST_AVERAGE", "G", { GOALS_AGAINST_GOALIE: 2, TOTAL_TOI: 3600 }, { GOALS_AGAINST_GOALIE: 0, TOTAL_TOI: 0 }, 2],
    ["TOI_PER_GAME", "C", { TOTAL_TOI: 1800, GAMES_PLAYED: 1 }, { TOTAL_TOI: 0, GAMES_PLAYED: 0 }, 1800],
  ] as const)("ignores known zero workload contributions to exact %s while keeping all-zero teams unavailable", (key, position, active, zero, expected) => {
    const member = (stats: Record<string, number>) => ({ displayPosition: position, combinedStats: Object.fromEntries(Object.entries(stats).map(([key, projected]) => [key, { projected }])) });
    const total = aggregateTeamCategoryTotals([member(active), member(zero)], [key])[key];
    expect(total).toEqual({ value: expected, quality: "exact-from-projected-inputs" });
    expect(rankTeamCategories([{ teamId: "known", categoryTotals: { [key]: total.value } }], { [key]: 1 }, "categories").known[key]).toBe(1);
    expect(aggregateTeamCategoryTotals([member(zero)], [key])[key]).toEqual({ value: null, quality: "unavailable" });
  });

  it.each([
    ["FACEOFF_PERCENTAGE", "C", "FACEOFF_ATTEMPTS", 0.6],
    ["SHOOTING_PERCENTAGE", "C", "SHOTS_ON_GOAL", 0.1],
    ["SAVE_PERCENTAGE", "G", "SHOTS_AGAINST_GOALIE", 0.9],
    ["GOALS_AGAINST_AVERAGE", "G", "GAMES_STARTED", 2],
    ["TOI_PER_GAME", "C", "GAMES_PLAYED", 1800],
  ] as const)("permits zero workload estimates for %s and rejects missing, negative and nonfinite workloads", (key, position, workload, expected) => {
    const member = (weight?: number) => ({ displayPosition: position, combinedStats: { [key]: { projected: expected }, ...(weight === undefined ? {} : { [workload]: { projected: weight } }) } });
    expect(aggregateTeamCategoryTotals([member(10), member(0)], [key])[key]).toEqual({ value: expected, quality: "estimated" });
    expect(aggregateTeamCategoryTotals([member(0)], [key])[key]).toEqual({ value: null, quality: "unavailable" });
    for (const weight of [undefined, -1, NaN, Infinity]) {
      expect(aggregateTeamCategoryTotals([member(10), member(weight)], [key])[key]).toEqual({ value: null, quality: "unavailable" });
    }
  });

  it("does not rescue invalid projected attempts with a supplied fallback rate", () => {
    const member = (stats: Record<string, number>) => ({ displayPosition: "C", combinedStats: Object.fromEntries(Object.entries(stats).map(([key, projected]) => [key, { projected }])) });
    const known = member({ FACEOFFS_WON: 60, FACEOFFS_LOST: 40 });
    for (const invalid of [
      { FACEOFFS_WON: 10, FACEOFFS_LOST: -1 },
      { FACEOFFS_WON: NaN, FACEOFFS_LOST: 40 },
      { FACEOFFS_WON: Infinity, FACEOFFS_LOST: 40 },
    ]) {
      const bad = member({ ...invalid, FACEOFF_PERCENTAGE: 0.6, FACEOFF_ATTEMPTS: 100 });
      expect(aggregateTeamCategoryTotals([known, bad], ["FACEOFF_PERCENTAGE"]).FACEOFF_PERCENTAGE).toEqual({ value: null, quality: "unavailable" });
    }
    expect(aggregateTeamCategoryTotals([member({ GOALS: 10, SHOTS_ON_GOAL: 100 }), member({ GOALS: 1, SHOTS_ON_GOAL: 0, SHOOTING_PERCENTAGE: 0 })], ["SHOOTING_PERCENTAGE"]).SHOOTING_PERCENTAGE).toEqual({ value: null, quality: "unavailable" });
  });

  it.each([
    ["SHOOTING_PERCENTAGE", "C", "GOALS", "SHOTS_ON_GOAL", { SHOTS_ON_GOAL: 100, SHOOTING_PERCENTAGE: 0.1 }, { GOALS: 1, SHOTS_ON_GOAL: 0, SHOOTING_PERCENTAGE: 0.1 }],
    ["SAVE_PERCENTAGE", "G", "SAVES_GOALIE", "SHOTS_AGAINST_GOALIE", { SHOTS_AGAINST_GOALIE: 100, SAVE_PERCENTAGE: 0.9 }, { SAVES_GOALIE: 1, GOALS_AGAINST_GOALIE: 0, SHOTS_AGAINST_GOALIE: 0, SAVE_PERCENTAGE: 0.9 }],
    ["GOALS_AGAINST_AVERAGE", "G", "GOALS_AGAINST_GOALIE", "TOTAL_TOI", { TOTAL_TOI: 3600, GOALS_AGAINST_AVERAGE: 2, GAMES_STARTED: 1 }, { GOALS_AGAINST_GOALIE: 1, TOTAL_TOI: 0, GOALS_AGAINST_AVERAGE: 3, GAMES_STARTED: 0 }],
    ["TOI_PER_GAME", "C", "TOTAL_TOI", "GAMES_PLAYED", { GAMES_PLAYED: 1, TOI_PER_GAME: 1800 }, { TOTAL_TOI: 1, GAMES_PLAYED: 0, TOI_PER_GAME: 1000 }],
  ] as const)("validates every %s contributor before fallback regardless of missing/invalid input order", (key, position, numerator, denominator, missingStats, invalidStats) => {
    const member = (stats: Record<string, number>) => ({ displayPosition: position, combinedStats: Object.fromEntries(Object.entries(stats).map(([key, projected]) => [key, { projected }])) });
    const missing = member(missingStats);
    const zero = member(Object.fromEntries(Object.keys(invalidStats).map((key) => [key, 0])));
    const missingDenominator = { ...missingStats, [numerator]: 1 } as Record<string, number>;
    delete missingDenominator[denominator];
    for (const incomplete of [missing, member(missingDenominator)]) {
      for (const numeratorValue of [1, -1, NaN, Infinity]) {
        const invalid = member({ ...invalidStats, [numerator]: numeratorValue });
        for (const order of [
          [incomplete, invalid, zero], [incomplete, zero, invalid],
          [invalid, incomplete, zero], [invalid, zero, incomplete],
          [zero, incomplete, invalid], [zero, invalid, incomplete],
        ]) {
          expect(aggregateTeamCategoryTotals(order, [key])[key]).toEqual({ value: null, quality: "unavailable" });
        }
      }
    }
    const expected = { value: missing.combinedStats[key].projected, quality: "estimated" };
    for (const order of [[missing, zero], [zero, missing]]) {
      expect(aggregateTeamCategoryTotals(order, [key])[key]).toEqual(expected);
    }
  });

  it("excludes unavailable rates from rank and never makes an empty goalie roster best at GAA", () => {
    const ranks = rankTeamCategories([
      { teamId: "empty", categoryTotals: { GOALS_AGAINST_AVERAGE: null } },
      { teamId: "missing", categoryTotals: {} },
      { teamId: "first", categoryTotals: { GOALS_AGAINST_AVERAGE: 2 } },
      { teamId: "second", categoryTotals: { GOALS_AGAINST_AVERAGE: 3 } },
    ], { GOALS_AGAINST_AVERAGE: 1 }, "categories");
    expect(ranks.empty.GOALS_AGAINST_AVERAGE).toBeUndefined();
    expect(ranks.missing.GOALS_AGAINST_AVERAGE).toBeUndefined();
    expect(ranks.first.GOALS_AGAINST_AVERAGE).toBe(1);
    expect(ranks.second.GOALS_AGAINST_AVERAGE).toBe(2);
  });

  it("keeps one coherent contract across import, settings, pick ownership, undo, recommendations, and summary", () => {
    const imported = validateCsvProjectionRows(
      [csvPlayer(1, "Forward One", "C,LW"), csvPlayer(2, "Defender Two", "D")],
      getRequiredCsvColumns("skater"),
    );
    expect(imported).toMatchObject({ accepted: 2, skipped: 0 });

    const sourceControls = {
      official: { isSelected: true, weight: 2 },
      custom_csv_1: { isSelected: true, weight: 1 },
    };
    expect(getEffectiveSourceShares(sourceControls)).toEqual({
      official: 2 / 3,
      custom_csv_1: 1 / 3,
    });
    expect(groupPlayerEligibility(["C", "LW"], "fwd")).toEqual(["FWD"]);

    const draftOrder = ["Team 1", "Team 2", "Team 3", "Team 4"];
    const keeperResult = validateKeeperCandidate(
      { playerId: "1", teamId: "Team 3", round: 1, pickInRound: 1 },
      { teamCount: 4, roundCount: 3, teamIds: draftOrder, playerIds: ["1", "2"] },
    );
    if (!keeperResult.ok) throw new Error("keeper fixture failed");
    const tradeResult = upsertPickTrade(
      { round: 1, pickInRound: 2, currentTeamId: "Team 4" },
      { draftOrder, roundCount: 3, isSnakeDraft: true, keepers: [keeperResult.keeper] },
    );
    if (!tradeResult.ok) throw new Error("trade fixture failed");
    expect(
      resolvePickOwner({
        round: 1,
        pickInRound: 2,
        draftOrder,
        isSnakeDraft: true,
        trades: tradeResult.trades,
        keepers: [keeperResult.keeper],
      }).currentTeamId,
    ).toBe("Team 4");

    const keeperPicks = materializeKeeperPicks([], [keeperResult.keeper]);
    const drafted = [
      ...keeperPicks,
      { playerId: "2", teamId: "Team 4", round: 1, pickInRound: 2, pickNumber: 2 },
    ];
    const afterUndo = drafted.slice(0, -1);
    expect(afterUndo).toEqual(keeperPicks);

    const availablePlayer = {
      playerId: 2,
      fullName: "Defender Two",
      displayTeam: "CAR",
      displayPosition: "D",
      eligiblePositions: ["D"],
      combinedStats: {},
      fantasyPoints: { projected: 100 },
    } as any;
    const { result } = renderHook(() =>
      usePlayerRecommendations({
        players: [availablePlayer],
        vorpMetrics: new Map([["2", { vbd: 10, vorp: 8, vona: 6 } as any]]),
        forwardGrouping: "fwd",
        baselineMode: "remaining",
      }),
    );
    expect(result.current.recommendations[0].player.playerId).toBe(2);

    const summary = buildDraftConfigurationSummary({
      projectionSources: [
        { id: "official", displayName: "Official", playerType: "skater" },
      ],
      sourceControls,
      goalieSourceControls: {},
      customCsvEntries: [
        {
          id: "custom_csv_1",
          label: "Local rankings",
          rows: [{ private: "not-exported" }],
          resolution: {
            totalRows: 2,
            idMatched: 2,
            nameMatched: 0,
            unresolved: 0,
            coverage: 1,
            lastUpdated: 1,
            unresolvedNames: [],
          },
        },
      ],
      forwardGrouping: "fwd",
      baselineMode: "remaining",
      personalizeReplacement: false,
      needWeightEnabled: true,
      needAlpha: 0.5,
    });
    expect(summary).toMatchObject({ forwardGrouping: "fwd", baselineMode: "remaining" });
    expect(JSON.stringify(summary)).not.toContain("not-exported");
  });
});
