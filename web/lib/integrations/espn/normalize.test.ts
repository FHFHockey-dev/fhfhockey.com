import { describe, expect, it } from "vitest";

import categoryFixture from "./__fixtures__/fhl-categories.json";
import malformedFixture from "./__fixtures__/fhl-malformed.json";
import pointsFixture from "./__fixtures__/fhl-points.json";
import ownershipFixture from "./__fixtures__/fhl-private-ownership.json";
import seasonPointsFixture from "./__fixtures__/fhl-season-points.json";
import keeperDraftFixture from "./__fixtures__/fhl-snake-keeper-draft.json";
import transactionsFixture from "./__fixtures__/fhl-transactions.json";
import unsupportedFixture from "./__fixtures__/fhl-unsupported.json";
import {
  normalizeEspnLeaguePayload,
  normalizeEspnTransactions,
} from "./normalize";

const REDACTED_SWID = "{00000000-0000-0000-0000-000000000001}";

function payloadWith(overlay: Record<string, unknown>) {
  return { ...pointsFixture, ...overlay };
}

function normalize(
  payload: unknown,
  fetchedAt = new Date("2026-08-14T12:00:00.000Z"),
) {
  return normalizeEspnLeaguePayload({
    leagueId: "123456",
    season: 2026,
    swid: REDACTED_SWID,
    payload,
    fetchedAt,
  });
}

describe("ESPN FHL v1 normalization", () => {
  it("maps hockey points, roster slots, ownership, and minimized state", () => {
    const { settings, state } = normalize(pointsFixture);

    expect(settings).toMatchObject({
      externalLeagueKey: "fhl:2026:123456",
      mappingVersion: "espn-fhl-v1",
      leagueType: "points",
      diagnostics: { status: "supported" },
      skaterScoringCategories: { GOALS: 3, ASSISTS: 2 },
      goalieScoringCategories: { WINS_GOALIE: 4, SAVES_GOALIE: 0.2 },
      rosterConfig: { C: 1, LW: 1, RW: 1, D: 2, G: 1, bench: 3 },
      draftOrderType: "snake",
      draftOrder: ["1", "2"],
      liveDraftSupported: true,
    });
    expect(settings.rosterConfig).not.toHaveProperty("8");
    expect(settings.teams[0]).toMatchObject({
      externalTeamKey: "1",
      isOwned: true,
    });
    expect(state.teams[0].roster[0]).toMatchObject({
      externalPlayerId: "9001",
      position: "C",
      proTeamId: 21,
    });

    const persisted = JSON.stringify({ settings, state });
    expect(persisted).not.toContain(REDACTED_SWID);
    expect(persisted).not.toContain("redacted@example.invalid");
    expect(persisted).not.toContain("profileImageUrl");
    expect(persisted).not.toContain("owners");
  });

  it("preserves ESPN category direction after FHFH's intrinsic inversions", () => {
    const { settings } = normalize(payloadWith(categoryFixture));

    expect(settings.leagueType).toBe("categories");
    expect(settings.categoryWeights).toEqual({
      GOALS: 1,
      HITS: -1,
      GOALS_AGAINST_AVERAGE: 1,
      SAVE_PERCENTAGE: 1,
    });
    expect(settings.draftOrderType).toBe("straight");
    expect(settings.diagnostics.status).toBe("supported");
  });

  it("supports total-season points without treating it as a category league", () => {
    const { settings } = normalize(payloadWith(seasonPointsFixture));

    expect(settings.scoringType).toBe("TOTAL_SEASON_POINTS");
    expect(settings.leagueType).toBe("points");
    expect(settings.skaterScoringCategories).toEqual({ POINTS: 1 });
    expect(settings.goalieScoringCategories).toEqual({ SHUTOUTS_GOALIE: 5 });
  });

  it("uses redacted private ownership only to derive the owned-team flag", () => {
    const { settings } = normalize(payloadWith(ownershipFixture));

    expect(settings.teams).toEqual([
      expect.objectContaining({ name: "Owned Redacted Team", isOwned: true }),
      expect.objectContaining({ name: "Other Redacted Team", isOwned: false }),
    ]);
    expect(JSON.stringify(settings)).not.toContain("PRIVATE MEMBER REDACTED");
    expect(JSON.stringify(settings)).not.toContain("private@example.invalid");
  });

  it("normalizes ordered keeper picks with a deterministic external key", () => {
    const { settings, state } = normalize(payloadWith(keeperDraftFixture));

    expect(settings.draftOrder).toEqual(["2", "1"]);
    expect(settings.liveDraftSupported).toBe(true);
    expect(state.draft).toMatchObject({ drafted: true, inProgress: true });
    expect(state.draft.picks).toEqual([
      expect.objectContaining({
        externalPickKey: "1:9001:1",
        pickNumber: 1,
        playerName: "Redacted Center",
        isKeeper: true,
      }),
    ]);
  });

  it("deduplicates and orders a selected season's transactions", () => {
    const transactions = normalizeEspnTransactions(transactionsFixture);

    expect(transactions.map((transaction) => transaction.id)).toEqual([
      "tx-1",
      "tx-2",
    ]);
    expect(transactions[0]).toMatchObject({
      type: "WAIVER",
      bidAmount: 3,
      scoringPeriodId: 1,
    });
  });

  it("diagnoses unknown stats, nonlinear scoring, roster slots, and auctions", () => {
    const { settings } = normalize(payloadWith(unsupportedFixture));

    expect(settings.diagnostics.status).toBe("partial");
    expect(settings.liveDraftSupported).toBe(false);
    expect(settings.diagnostics.unsupported).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ kind: "scoring", code: "999" }),
        expect.objectContaining({ kind: "scoring", code: "14" }),
        expect.objectContaining({ kind: "roster", code: "8", label: "IR" }),
        expect.objectContaining({ kind: "roster", code: "12" }),
      ]),
    );
    expect(settings.diagnostics.warnings).toContain(
      "AUCTION draft state will sync, but live companion mode is unavailable.",
    );
  });

  it("fails closed on malformed settings and keeps hashes stable across fetches", () => {
    const malformed = normalize(malformedFixture);
    expect(malformed.settings.diagnostics.status).toBe("unsupported");

    const first = normalize(pointsFixture, new Date("2026-08-14T12:00:00.000Z"));
    const reordered = {
      ...pointsFixture,
      settings: {
        ...pointsFixture.settings,
        scoringSettings: {
          ...pointsFixture.settings.scoringSettings,
          scoringItems: [...pointsFixture.settings.scoringSettings.scoringItems].reverse(),
        },
      },
    };
    const second = normalize(reordered, new Date("2026-08-15T12:00:00.000Z"));

    expect(second.settings.sourceHash).toBe(first.settings.sourceHash);
    expect(second.state.sourceHash).toBe(first.state.sourceHash);
    expect(second.state.fetchedAt).not.toBe(first.state.fetchedAt);
  });
});
