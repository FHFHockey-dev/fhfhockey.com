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
import { categoryRankBand, rankTeamCategories } from "./categoryStandings";
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
    expect(bookmarkImportError({ ...bookmark, goalieScoringCategories: { GOALS_AGAINST_GOALIE: -1 } })).toBeNull();
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
