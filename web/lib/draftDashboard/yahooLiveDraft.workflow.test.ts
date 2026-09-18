import { describe, expect, it } from "vitest";

import {
  continueManuallyFromYahoo,
  reconcileYahooDraftState,
  yahooCompatibleKeepers,
  yahooDraftKeepers,
  hasCompleteYahooPickOwnership,
  yahooDraftPickTrades,
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

  it("preloads exact keeper identities, preserves manual costs, and avoids duplicating confirmed selections", () => {
    const players = [{ playerId: 100, yahooPlayerId: "10" }, { playerId: 200, yahooPlayerId: "477.p.20" }] as import("hooks/useProcessedProjectionsData").ProcessedPlayer[];
    const imported = { ...state, settings: { ...state.settings, draftKeepers: [
      { yahooPlayerKey: "477.p.10", yahooTeamKey: team1, displayName: "One" },
      { yahooPlayerKey: "477.p.20", yahooTeamKey: team2, displayName: "Two" },
      { yahooPlayerKey: "477.p.999", yahooTeamKey: team2, displayName: "Unmapped" },
    ] } };
    const result = yahooDraftKeepers(imported, players, [keeper]);
    expect(result.keepers).toEqual([keeper, benchKeeper]);
    expect(result.warnings.join(" ")).toContain("Unmapped");
    expect(result.warnings.join(" ")).toContain("round costs");
    const automatic = yahooDraftKeepers(imported, players, []);
    expect(automatic.keepers.every((entry) => entry.cost === "none")).toBe(true);
    expect(reconcileYahooDraftState(imported, players, { ...setup, keepers: [] }).currentPick).toBe(1);
    const confirmed = reconcileYahooDraftState({ ...imported, picks: [{ active: true, pickNumber: 1, roundNumber: 1, nhlPlayerId: 200, yahooTeamKey: team2 }] }, players);
    expect(yahooCompatibleKeepers(automatic.keepers, confirmed.draftedPlayers).map((entry) => entry.playerId)).toEqual(["100"]);
    expect(yahooDraftKeepers({ ...imported, session: { ...state.session, gameKey: "476" } }, players, []).keepers).toEqual([]);
    expect(yahooDraftKeepers(null, players, [keeper]).keepers).toEqual([keeper]);
  });

  it("replaces a missing/manual keeper cost with Yahoo's reported later-round slot", () => {
    const players = [{ playerId: 100, yahooPlayerId: "477.p.10" }] as import("hooks/useProcessedProjectionsData").ProcessedPlayer[];
    const reported = { ...state, settings: { draftKeepers: [{ yahooPlayerKey: "477.p.10", yahooTeamKey: team1, displayName: "Keeper" }] },
      picks: [{ active: true, pickNumber: 8, roundNumber: 4, yahooPlayerKey: "477.p.10", yahooTeamKey: team1, nhlPlayerId: 100 }] };
    const imported = yahooDraftKeepers(reported, players, [keeper]);
    expect(imported.keepers[0]).toMatchObject({ cost: "pick", pickNumber: 8, round: 4, pickInRound: 2 });
    const live = reconcileYahooDraftState(reported, players, { ...setup, keepers: imported.keepers });
    expect(live.draftedPlayers).toHaveLength(1);
    expect(live.draftedPlayers[0].isKeeper).toBe(true);
    expect(live.currentPick).toBe(1);
  });

  it("preserves displaced keepers and applies Yahoo swaps without duplicate slots", () => {
    const players = [{ playerId: 100, yahooPlayerId: "477.p.10" }, { playerId: 200, yahooPlayerId: "477.p.20" }] as import("hooks/useProcessedProjectionsData").ProcessedPlayer[];
    const second = { ...keeper, playerId: "200", pickNumber: 3, round: 2 };
    const reported = { ...state, settings: { draftKeepers: [
      { yahooPlayerKey: "477.p.10", yahooTeamKey: team1 },
      { yahooPlayerKey: "477.p.20", yahooTeamKey: team1 },
    ] }, picks: [{ active: true, pickNumber: 3, roundNumber: 2, yahooPlayerKey: "477.p.10", yahooTeamKey: team1, nhlPlayerId: 100 }] };
    const result = yahooDraftKeepers(reported, players, [keeper, second]);
    expect(result.keepers).toEqual([
      expect.objectContaining({ playerId: "100", cost: "pick", pickNumber: 3 }),
      expect.objectContaining({ playerId: "200", cost: "none" }),
    ]);
    expect(result.warnings.join(" ")).toContain("remains on the roster");
    expect(yahooDraftKeepers(reported, players, result.keepers).keepers).toEqual(result.keepers);
    const live = reconcileYahooDraftState(reported, players, { ...setup, keepers: result.keepers });
    expect(yahooCompatibleKeepers(result.keepers, live.draftedPlayers)).toEqual(result.keepers);
    const swapped = { ...reported, picks: [...reported.picks, { active: true, pickNumber: 1, roundNumber: 1, yahooPlayerKey: "477.p.20", yahooTeamKey: team1, nhlPlayerId: 200 }] };
    expect(yahooDraftKeepers(swapped, players, [keeper, second]).keepers.map((entry) => entry.cost === "pick" && entry.pickNumber)).toEqual([3, 1]);
    const ordinary = { ...reported, picks: [{ ...reported.picks[0], yahooPlayerKey: "477.p.99", nhlPlayerId: 999 }] };
    expect(yahooDraftKeepers(ordinary, players, [keeper, second]).keepers[1].cost).toBe("none");
  });

  it("recognizes complete per-pick order without a snake flag or team draft positions", () => {
    const supplied = { ...state, settings: { rosterConfig: { C: 1 }, draftPickOwners: [
      { pickNumber: 1, roundNumber: 1, yahooTeamKey: team2 },
      { pickNumber: 2, roundNumber: 1, yahooTeamKey: team1 },
    ] } };
    expect(hasCompleteYahooPickOwnership(supplied)).toBe(true);
    const result = reconcileYahooDraftState(supplied, []);
    expect(result.expectedNext).toMatchObject({ yahooTeamKey: team2, predicted: false });
    expect(result.warnings).toEqual([]);
    expect(hasCompleteYahooPickOwnership({ ...supplied, settings: { ...supplied.settings, draftPickOwners: supplied.settings.draftPickOwners.slice(0, 1) } })).toBe(false);
    expect(reconcileYahooDraftState(state, []).expectedNext.predicted).toBe(true);
  });

  it("imports future Yahoo ownership without creating player selections or erasing missing manual slots", () => {
    const future = { ...state, settings: { ...state.settings, draftPickOwners: [
      { pickNumber: 1, roundNumber: 1, yahooTeamKey: team2 },
      { pickNumber: 3, roundNumber: 2, yahooTeamKey: team1 },
    ] } };
    const trades = yahooDraftPickTrades(future, setup);
    expect(trades.map((trade) => [trade.pickNumber, trade.currentTeamId])).toEqual([[1, team2], [2, team1], [3, team1]]);
    const live = reconcileYahooDraftState(future, [], { ...setup, keepers: [] });
    expect(live.draftedPlayers).toEqual([]);
    expect(live.currentPick).toBe(1);
    expect(live.expectedNext.yahooTeamKey).toBe(team2);
    expect(live.expectedNext.predicted).toBe(false);
    expect(yahooDraftPickTrades({ ...future, settings: { draftPickOwners: [{ pickNumber: 2, roundNumber: 1, yahooTeamKey: team2 }] } }, setup)).toEqual([]);
  });

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
    expect(yahooCompatibleKeepers(setup.keepers, conflict.draftedPlayers)).toEqual([
      { version: 2, status: "valid", cost: "none", playerId: keeper.playerId, teamId: keeper.teamId }, benchKeeper,
    ]);
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
