import { describe, expect, it } from "vitest";

import type { ProcessedPlayer } from "hooks/useProcessedProjectionsData";
import {
  deriveYahooDraftDashboardConfiguration,
  getFirstMissingYahooPick,
  normalizeYahooDraftListResponse,
  normalizeYahooDraftStateResponse,
  reconcileYahooDraftState,
  yahooUnsupportedLeagueMessage,
  yahooSettingsRequireScoringConfirmation,
  type YahooDraftState,
} from "./yahooLiveDraft";

function projectionPlayer(
  playerId: number,
  yahooPlayerId: string,
  fullName = "Projection Player",
  fhfhPlayerId?: number,
): ProcessedPlayer {
  return {
    playerId,
    fhfhPlayerId,
    yahooPlayerId,
    fullName,
    displayTeam: "TST",
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
    yahooAvgPick: null,
    yahooAvgRound: null,
    yahooPctDrafted: null,
    projectedRank: null,
    actualRank: null,
  } as ProcessedPlayer;
}

const state: YahooDraftState = {
  session: { gameKey: "477", id: "session-1", status: "active" },
  teams: [
    {
      yahooTeamKey: "team.2",
      name: "Second Team",
      draftPosition: 2,
    },
    {
      yahooTeamKey: "team.1",
      name: "First Team",
      draftPosition: 1,
      isUserTeam: true,
    },
  ],
  settings: {
    teamCount: 2,
    draftOrder: "snake",
    rosterConfig: { C: 1, G: 1, bench: 1, utility: 0 },
    leagueType: "points",
    scoringCategories: { GOALS: 3 },
  },
  picks: [
    {
      pickNumber: 1,
      roundNumber: 1,
      pickInRound: 1,
      yahooTeamKey: "team.1",
      yahooPlayerKey: "477.p.101",
      yahooPlayerId: "101",
      fhfhPlayerId: "9999",
      displayName: "Mapped Player",
      active: true,
    },
    {
      pickNumber: 3,
      roundNumber: 2,
      pickInRound: 1,
      yahooTeamKey: "team.2",
      yahooPlayerKey: "477.p.303",
      yahooPlayerId: "303",
      fhfhPlayerId: "8479999",
      displayName: "Unresolved Player",
      active: true,
    },
    {
      pickNumber: 2,
      roundNumber: 1,
      yahooTeamKey: "team.2",
      yahooPlayerId: "202",
      displayName: "Removed Pick",
      active: false,
    },
  ],
};

describe("Yahoo live draft normalization", () => {
  it("fails closed and accepts an enveloped league payload", () => {
    expect(normalizeYahooDraftListResponse({ leagues: [] }).enabled).toBe(false);
    expect(
      normalizeYahooDraftListResponse({
        data: {
          enabled: true,
          leagues: [
            {
              externalLeagueId: "league-id",
              leagueName: "Keeper League",
              season: 2026,
              supported: false,
              unsupportedReason: "Salary-cap drafts are not supported.",
              session: {
                id: "session-1",
                status: "active",
                providerStatus: "drafting",
              },
            },
          ],
          ranking: { id: "ranking-id", name: "My Board" },
        },
      }),
    ).toEqual({
      enabled: true,
      leagues: [
        {
          externalLeagueId: "league-id",
          name: "Keeper League",
          teamName: undefined,
          season: "2026",
          draftStatus: undefined,
          yahooLeagueUrl: undefined,
          supported: false,
          unsupportedReason: "Salary-cap drafts are not supported.",
          session: {
            id: "session-1",
            status: "active",
            providerStatus: "drafting",
          },
        },
      ],
      ranking: { id: "ranking-id", name: "My Board" },
    });
  });

  it("normalizes camelCase and database-style pick fields", () => {
    const normalized = normalizeYahooDraftStateResponse({
      data: {
        session: {
          id: "session-1",
          provider_status: "drafting",
          snapshot_version: 4,
        },
        teams: [{ yahoo_team_key: "team.1", teamName: "First Team" }],
        settings: { draftOrder: "straight" },
        picks: [
          {
            pick_number: 1,
            round_number: 1,
            pick_in_round: 1,
            yahoo_team_key: "team.1",
            yahoo_player_key: "477.p.101",
            player_name: "Player One",
            auction_cost: 8,
            is_active: true,
            mapping_status: "mapped",
            revision: 2,
          },
        ],
      },
    });

    expect(normalized?.session.status).toBe("active");
    expect(normalized?.session.snapshotVersion).toBe(4);
    expect(normalized?.picks[0]).toMatchObject({
      pickNumber: 1,
      pickInRound: 1,
      displayName: "Player One",
      cost: 8,
      revision: 2,
    });
  });

  it("turns provider support codes into safe league-selector copy", () => {
    expect(
      yahooUnsupportedLeagueMessage("yahoo_salary_cap_unsupported"),
    ).toContain("Salary-cap");
    expect(
      yahooUnsupportedLeagueMessage("yahoo_draft_type_unsupported"),
    ).toContain("Offline and autopick");
    expect(yahooUnsupportedLeagueMessage("raw_provider_secret_code")).not.toContain(
      "raw_provider_secret_code",
    );
  });
});

describe("Yahoo live draft reconciliation", () => {
  it("uses active pick numbers and returns the first missing pick", () => {
    expect(getFirstMissingYahooPick(state.picks)).toBe(2);
  });

  it("uses canonical FHFH IDs and preserves unresolved placeholders", () => {
    const result = reconcileYahooDraftState(state, [
      projectionPlayer(8470001, "101", "Mapped Player", 9999),
      // This deliberately equals fhfhPlayerId for pick 3. It must not match.
      projectionPlayer(8479999, "999", "Unresolved Player"),
    ]);

    expect(result.currentPick).toBe(2);
    expect(result.draftedPlayers).toEqual([
      expect.objectContaining({
        playerId: "8470001",
        yahooMappingStatus: "mapped",
        pickNumber: 1,
      }),
      expect.objectContaining({
        playerId: "-3",
        yahooMappingStatus: "unresolved",
        yahooDisplayName: "Unresolved Player",
        pickNumber: 3,
      }),
    ]);
    expect(result.unresolved).toEqual([
      expect.objectContaining({
        pickNumber: 3,
        displayName: "Unresolved Player",
      }),
    ]);
    expect(result.expectedNext).toMatchObject({
      pickNumber: 2,
      roundNumber: 1,
      pickInRound: 2,
      yahooTeamKey: "team.2",
      predicted: true,
    });
  });

  it("prefers the canonical FHFH identity over NHL and Yahoo fallbacks", () => {
    const onePickState: YahooDraftState = {
      ...state,
      picks: [
        {
          ...state.picks[0],
          nhlPlayerId: 8470002,
        },
      ],
    };
    const result = reconcileYahooDraftState(onePickState, [
      projectionPlayer(8470001, "999", "Canonical Player", 9999),
      projectionPlayer(8470002, "101", "Fallback Player", 8888),
    ]);
    expect(result.draftedPlayers[0]).toMatchObject({
      playerId: "8470001",
      yahooMappingStatus: "mapped",
    });
  });

  it("refuses an ambiguous exact Yahoo ID instead of guessing", () => {
    const onePickState = { ...state, picks: [state.picks[0]] };
    const result = reconcileYahooDraftState(onePickState, [
      projectionPlayer(1, "101"),
      projectionPlayer(2, "101"),
    ]);
    expect(result.unresolved[0]?.reason).toContain("multiple");
    expect(result.draftedPlayers[0]?.playerId).toBe("-1");
  });

  it("does not derive a player ID from a stale-season Yahoo key", () => {
    const staleKeyState: YahooDraftState = {
      ...state,
      picks: [
        {
          ...state.picks[0],
          yahooPlayerKey: "465.p.101",
          yahooPlayerId: null,
        },
      ],
    };
    const result = reconcileYahooDraftState(staleKeyState, [
      projectionPlayer(8470001, "101"),
    ]);
    expect(result.draftedPlayers[0]?.yahooMappingStatus).toBe("unresolved");
    expect(result.unresolved).toHaveLength(1);
  });

  it("preserves review-required identities as unresolved placeholders", () => {
    const reviewState: YahooDraftState = {
      ...state,
      picks: [
        {
          ...state.picks[0],
          mappingStatus: "review_required",
        },
      ],
    };
    const result = reconcileYahooDraftState(reviewState, [
      projectionPlayer(8470001, "101"),
    ]);
    expect(result.draftedPlayers[0]).toMatchObject({
      playerId: "-1",
      yahooMappingStatus: "review_required",
    });
    expect(result.unresolved[0]?.reason).toContain("requires review");
  });

  it("derives a sorted Yahoo team configuration without provider keys leaking", () => {
    expect(deriveYahooDraftDashboardConfiguration(state)).toMatchObject({
      teamCount: 2,
      draftOrder: ["team.1", "team.2"],
      customTeamNames: {
        "team.1": "First Team",
        "team.2": "Second Team",
      },
      myTeamId: "team.1",
      isSnakeDraft: true,
      rosterConfig: { C: 1, G: 1, bench: 1, utility: 0 },
    });
  });

  it("requires confirmation for partially normalized scoring diagnostics", () => {
    expect(
      yahooSettingsRequireScoringConfirmation({
        ...state,
        settings: {
          ...state.settings,
          scoringCategories: { GOALS: 3 },
          requiresScoringConfirmation: true,
          unsupportedScoringStats: ["CUSTOM_STAT"],
        },
      }),
    ).toBe(true);
  });

  it("warns when snake order was inferred despite a normalized boolean", () => {
    const inferredState = {
      ...state,
      settings: {
        ...state.settings,
        isSnakeDraft: true,
        diagnostics: { inferredDraftOrder: true },
      },
    };
    expect(reconcileYahooDraftState(inferredState, []).warnings).toHaveLength(1);
  });
});
