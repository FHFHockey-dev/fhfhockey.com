import { describe, expect, it } from "vitest";

import {
  continueManuallyFromYahoo,
  reconcileYahooDraftState,
  yahooCompatibleKeepers,
  type YahooDraftState,
  loadYahooDraftPersistence,
  saveYahooDraftPersistence,
  selectDraftedPlayersForMode,
  YAHOO_DRAFT_SESSION_STORAGE_KEY,
  type YahooDraftReconciliation,
} from "./yahooLiveDraft";

describe("Yahoo/manual draft workflow", () => {
  const state: YahooDraftState = {
    session: { id: "test", gameKey: "477", status: "active" },
    teams: [{ yahooTeamKey: "477.l.24289.t.1", name: "One", draftPosition: 1 }, { yahooTeamKey: "477.l.24289.t.2", name: "Two", draftPosition: 2 }],
    settings: { teamCount: 2, draftOrder: "snake" }, picks: [],
  };
  const team1 = state.teams[0].yahooTeamKey;
  const team2 = state.teams[1].yahooTeamKey;
  const keeper = { version: 2 as const, status: "valid" as const, cost: "pick" as const, playerId: "100", teamId: team1, round: 1, pickInRound: 1, pickNumber: 1 };
  const benchKeeper = { version: 2 as const, status: "valid" as const, cost: "none" as const, playerId: "200", teamId: team2 };
  const setup = {
    draftOrder: [team1, team2], keepers: [keeper, benchKeeper],
    trades: [{ version: 1 as const, status: "valid" as const, round: 1, pickInRound: 2, pickNumber: 2, originalTeamId: team2, currentTeamId: team1 }],
  };

  it("keeps manual keeper reservations and traded turns across stop/resume", () => {
    const live = reconcileYahooDraftState(state, [], setup);
    expect(live.draftedPlayers).toEqual([expect.objectContaining({ playerId: "100", isKeeper: true, teamId: team1 })]);
    expect(live.currentPick).toBe(2);
    expect(live.expectedNext.yahooTeamKey).toBe(team1);
    const stopped = continueManuallyFromYahoo(live);
    expect(stopped.draftedPlayers[0].isKeeper).toBe(true);
    const preserved = yahooCompatibleKeepers(setup.keepers, stopped.draftedPlayers);
    expect(preserved).toEqual(setup.keepers);
    expect(reconcileYahooDraftState(state, [], { ...setup, keepers: preserved })).toEqual(live);
    expect(setup.trades).toHaveLength(1);
  });

  it("lets confirmed Yahoo picks win without duplicating manually entered keepers", () => {
    const confirmed = { ...state, picks: [{ active: true, pickNumber: 1, roundNumber: 1, pickInRound: 1, yahooTeamKey: team1, nhlPlayerId: 100 }] };
    const players = [{ playerId: 100 }] as import("hooks/useProcessedProjectionsData").ProcessedPlayer[];
    const result = reconcileYahooDraftState(confirmed, players, setup);
    expect(result.draftedPlayers).toHaveLength(1);
    expect(result.draftedPlayers[0].source).toBe("yahoo");
    expect(yahooCompatibleKeepers(setup.keepers, result.draftedPlayers)).toEqual(setup.keepers);
    const conflict = reconcileYahooDraftState({ ...confirmed, picks: [{ ...confirmed.picks[0], nhlPlayerId: 999 }] }, [], setup);
    expect(conflict.draftedPlayers).toHaveLength(1);
    expect(conflict.warnings.join(" ")).toContain("different player at keeper pick 1");
    expect(yahooCompatibleKeepers(setup.keepers, conflict.draftedPlayers)).toEqual([benchKeeper]);
    expect(reconcileYahooDraftState(state, [], setup).draftedPlayers[0].playerId).toBe("100");
  });

  it("does not duplicate no-pick keepers or apply keepers from a different league", () => {
    const players = [{ playerId: 200 }] as import("hooks/useProcessedProjectionsData").ProcessedPlayer[];
    const result = reconcileYahooDraftState({ ...state, picks: [{ active: true, pickNumber: 2, roundNumber: 1, yahooTeamKey: team2, nhlPlayerId: 200 }] }, players, setup);
    expect(yahooCompatibleKeepers(setup.keepers, result.draftedPlayers)).toEqual([keeper]);
    expect(reconcileYahooDraftState(state, [], { ...setup, keepers: [{ ...keeper, teamId: "other-league" }] }).draftedPlayers).toEqual([]);
  });

  it("selects the authoritative pick list and copies Yahoo picks on stop", () => {
    const manual = [{ playerId: "manual" }];
    const yahoo = [{ playerId: "yahoo" }];
    expect(selectDraftedPlayersForMode("manual", manual, yahoo)).toBe(manual);
    expect(selectDraftedPlayersForMode("yahoo", manual, yahoo)).toBe(yahoo);

    const reconciliation = {
      draftedPlayers: [
        {
          playerId: "8470001",
          teamId: "team.1",
          pickNumber: 1,
          round: 1,
          pickInRound: 1,
          source: "yahoo",
          yahooSessionId: "session-1",
          yahooMappingStatus: "mapped",
        },
      ],
      currentPick: 2,
      unresolved: [],
      warnings: [],
      expectedNext: {
        pickNumber: 2,
        roundNumber: 1,
        pickInRound: 2,
        predicted: true,
      },
    } satisfies YahooDraftReconciliation;

    const continuation = continueManuallyFromYahoo(reconciliation);
    expect(continuation.currentPick).toBe(2);
    expect(continuation.draftedPlayers).not.toBe(reconciliation.draftedPlayers);
    expect(continuation.draftedPlayers[0]).toMatchObject({
      playerId: "8470001",
      source: "yahoo",
    });
  });

  it("persists only the v3 Yahoo mode/session contract", () => {
    const values = new Map<string, string>();
    const storage = {
      getItem: (key: string) => values.get(key) || null,
      setItem: (key: string, value: string) => values.set(key, value),
    };
    saveYahooDraftPersistence(storage, {
      mode: "yahoo",
      sessionId: "session-1",
      externalLeagueId: "league-1",
    });

    expect(JSON.parse(values.get(YAHOO_DRAFT_SESSION_STORAGE_KEY) || "{}")).toEqual({
      v: 3,
      mode: "yahoo",
      sessionId: "session-1",
      externalLeagueId: "league-1",
    });
    expect(loadYahooDraftPersistence(storage)).toEqual({
      v: 3,
      mode: "yahoo",
      sessionId: "session-1",
      externalLeagueId: "league-1",
    });
  });
});
