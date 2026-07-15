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
