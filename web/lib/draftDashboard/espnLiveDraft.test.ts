import { describe, expect, it } from "vitest";

import type { ProcessedPlayer } from "hooks/useProcessedProjectionsData";
import type { EspnDraftState } from "lib/integrations/espn/contracts";
import {
  espnDraftDashboardConfiguration,
  reconcileEspnDraftState,
} from "./espnLiveDraft";

function projectionPlayer(playerId: number, fullName: string): ProcessedPlayer {
  return {
    playerId,
    fullName,
    displayTeam: "TOR",
    displayPosition: "C",
    eligiblePositions: ["C"],
    combinedStats: {},
    fantasyPoints: {
      projected: 100,
      actual: null,
      diffPercentage: null,
      projectedPerGame: null,
      actualPerGame: null,
    },
  } as ProcessedPlayer;
}

const state: EspnDraftState = {
  session: {
    id: "session-1",
    externalLeagueId: "league-1",
    externalTeamId: "team-row-1",
    status: "active",
    providerStatus: "drafting",
    snapshotVersion: 3,
    lastSnapshotAt: "2026-08-14T12:00:00.000Z",
    nextPollAt: "2026-08-14T12:00:30.000Z",
    lastErrorCode: null,
    lastErrorMessage: null,
  },
  league: {
    id: "league-1",
    connectedAccountId: "account-1",
    externalLeagueKey: "fhl:2026:123456",
    espnLeagueId: "123456",
    name: "Keeper League",
    seasonKey: "2026",
    importedAt: "2026-08-14T11:00:00.000Z",
    settings: {
      version: 1,
      mappingVersion: "espn-fhl-v1",
      externalLeagueKey: "fhl:2026:123456",
      espnLeagueId: "123456",
      leagueName: "Keeper League",
      seasonKey: "2026",
      leagueType: "points",
      scoringType: "H2H_POINTS",
      teamCount: 2,
      teams: [
        {
          externalTeamKey: "2",
          name: "Second Team",
          abbreviation: "SEC",
          divisionId: null,
          isOwned: false,
        },
        {
          externalTeamKey: "1",
          name: "My Team",
          abbreviation: "MINE",
          divisionId: null,
          isOwned: true,
        },
      ],
      skaterScoringCategories: { GOALS: 3 },
      goalieScoringCategories: { WINS_GOALIE: 4 },
      categoryWeights: {},
      rosterConfig: { C: 1, G: 1, bench: 2 },
      draftOrderType: "snake",
      draftOrder: ["1", "2"],
      draftType: "SNAKE",
      liveDraftSupported: true,
      sourceHash: "a".repeat(64),
      fetchedAt: "2026-08-14T12:00:00.000Z",
      diagnostics: { status: "supported", warnings: [], unsupported: [] },
    },
    teams: [
      {
        id: "team-row-1",
        externalTeamKey: "1",
        name: "My Team",
        abbreviation: "MINE",
        divisionId: null,
        isOwned: true,
      },
    ],
    isDefault: true,
    settingsChanged: false,
    syncStatus: "completed",
    syncErrorCode: null,
  },
  picks: [
    {
      externalPickKey: "1:9001:1",
      pickNumber: 1,
      roundNumber: 1,
      pickInRound: 1,
      externalTeamKey: "1",
      externalPlayerId: "9001",
      playerName: "Mapped Player",
      position: "C",
      proTeamId: 21,
      isKeeper: true,
      bidAmount: null,
      fhfhPlayerId: 501,
      nhlPlayerId: 101,
      mappingStatus: "mapped",
    },
    {
      externalPickKey: "3:9003:2",
      pickNumber: 3,
      roundNumber: 2,
      pickInRound: 1,
      externalTeamKey: "2",
      externalPlayerId: "9003",
      playerName: "Needs Review",
      position: "C",
      proTeamId: 21,
      isKeeper: false,
      bidAmount: null,
      fhfhPlayerId: null,
      nhlPlayerId: 303,
      mappingStatus: "review_required",
    },
  ],
  poll: { claimed: true, retryAfterSeconds: 30 },
};

describe("ESPN live-draft reconciliation", () => {
  it("maps verified NHL identities and preserves unresolved picks by ESPN name", () => {
    const result = reconcileEspnDraftState(state, [
      projectionPlayer(101, "Mapped Player"),
      projectionPlayer(303, "Needs Review"),
    ]);

    expect(result.currentPick).toBe(2);
    expect(result.draftedPlayers).toEqual([
      expect.objectContaining({
        playerId: "101",
        pickNumber: 1,
        isKeeper: true,
        espnMappingStatus: "mapped",
      }),
      expect.objectContaining({
        playerId: "-1000003",
        pickNumber: 3,
        espnDisplayName: "Needs Review",
        espnMappingStatus: "review_required",
      }),
    ]);
    expect(result.unresolved).toEqual([
      expect.objectContaining({
        pickNumber: 3,
        displayName: "Needs Review",
      }),
    ]);
  });

  it("treats each authoritative snapshot as the complete corrected pick list", () => {
    const corrected: EspnDraftState = {
      ...state,
      picks: [
        {
          ...state.picks[0],
          externalPickKey: "1:9010:1",
          externalPlayerId: "9010",
          playerName: "Corrected Player",
          fhfhPlayerId: 510,
          nhlPlayerId: 110,
        },
      ],
    };
    const result = reconcileEspnDraftState(corrected, [
      projectionPlayer(110, "Corrected Player"),
    ]);

    expect(result.draftedPlayers).toHaveLength(1);
    expect(result.draftedPlayers[0]).toMatchObject({
      pickNumber: 1,
      playerId: "110",
      espnPlayerId: "9010",
    });
    expect(result.currentPick).toBe(2);
  });

  it("derives the authoritative ESPN league structure and exact scoring maps", () => {
    expect(espnDraftDashboardConfiguration(state)).toEqual({
      teamCount: 2,
      draftOrder: ["1", "2"],
      customTeamNames: { "1": "My Team", "2": "Second Team" },
      myTeamId: "1",
      isSnakeDraft: true,
      rosterConfig: { C: 1, G: 1, bench: 2 },
      leagueType: "points",
      scoringCategories: { GOALS: 3 },
      goalieScoringCategories: { WINS_GOALIE: 4 },
      categoryWeights: {},
    });
  });
});
