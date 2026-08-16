import { describe, expect, it } from "vitest";

import {
  continueManuallyFromYahoo,
  loadYahooDraftPersistence,
  saveYahooDraftPersistence,
  selectDraftedPlayersForMode,
  YAHOO_DRAFT_SESSION_STORAGE_KEY,
  type YahooDraftReconciliation,
} from "./yahooLiveDraft";

describe("Yahoo/manual draft workflow", () => {
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
