import { describe, expect, it } from "vitest";

import categoryFixture from "./__fixtures__/nhl-categories.json";
import pointsFixture from "./__fixtures__/nhl-points.json";
import {
  normalizeFantraxDiscovery,
  normalizeFantraxLeagueInfo,
  relevantFantraxRawSettings,
} from "./normalize";

describe("Fantrax NHL settings normalization", () => {
  it("scopes duplicate scoring codes by skater and goalie position", () => {
    const normalized = normalizeFantraxLeagueInfo({
      externalLeagueKey: "points-league",
      payload: pointsFixture,
      ownedTeams: [
        {
          externalTeamKey: "team-a",
          name: "High Slot",
          division: "West",
          isOwned: true,
        },
      ],
      fetchedAt: new Date("2026-08-14T12:00:00.000Z"),
    });

    expect(normalized.leagueType).toBe("points");
    expect(normalized.skaterScoringCategories).toMatchObject({
      GOALS: 3,
      GAMES_PLAYED: 0.1,
    });
    expect(normalized.goalieScoringCategories).toMatchObject({
      GAMES_PLAYED: 0.5,
      WINS_GOALIE: 4,
    });
    expect(normalized.skaterScoringCategories.PENALTY_MINUTES).toBeUndefined();
    expect(normalized.rosterConfig).toMatchObject({
      C: 2,
      LW: 2,
      RW: 2,
      D: 4,
      G: 2,
      FWD: 1,
      bench: 4,
    });
    expect(normalized.teams.map((team) => team.externalTeamKey)).toEqual([
      "team-a",
      "team-b",
    ]);
    expect(normalized.teams[0].isOwned).toBe(true);
    expect(normalized.diagnostics.status).toBe("partial");
    expect(normalized.diagnostics.unsupported).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: "PIM", kind: "scoring" }),
        expect.objectContaining({ code: "W", label: "Team Goalie Wins" }),
        expect.objectContaining({ code: "IR", kind: "roster" }),
      ]),
    );
  });

  it("maps category weights and preserves an explicit finite zero", () => {
    const normalized = normalizeFantraxLeagueInfo({
      externalLeagueKey: "category-league",
      payload: categoryFixture,
      fetchedAt: new Date("2026-08-14T12:00:00.000Z"),
    });

    expect(normalized.diagnostics.status).toBe("supported");
    expect(normalized.leagueType).toBe("categories");
    expect(normalized.categoryWeights).toMatchObject({
      GOALS: 2,
      GAMES_PLAYED: 1,
      WINS_GOALIE: 1,
      SAVE_PERCENTAGE: 0,
    });
    expect(normalized.rosterConfig).toMatchObject({
      C: 2,
      LW: 2,
      RW: 2,
      D: 4,
      G: 2,
      utility: 1,
      bench: 4,
    });
    expect(normalized.draftOrderType).toBe("straight");
  });

  it("maps projected v4/v5 categories without guessing unknown labels", () => {
    const normalized = normalizeFantraxLeagueInfo({
      externalLeagueKey: "v4-category-league",
      payload: {
        ...categoryFixture,
        scoringSystem: {
          ...categoryFixture.scoringSystem,
          scoringCategorySettings: [{
            configs: [
              { position: "SKATER", scoringCategory: { code: "GWG", name: "Game Winning Goals" }, weight: 2 },
              { position: "SKATER", scoringCategory: { code: "TKA", name: "Takeaways" }, weight: 1 },
              { position: "SKATER", scoringCategory: { code: "GVA", name: "Giveaways" }, weight: -1 },
              { position: "SKATER", scoringCategory: { code: "iCF", name: "Individual Shot Attempts" }, weight: 0.2 },
              { position: "SKATER", scoringCategory: { code: "ixG", name: "Individual Expected Goals" }, weight: 2.5 },
              { position: "GOALIE", scoringCategory: { code: "QS", name: "Quality Starts" }, weight: 3 },
              { position: "GOALIE", scoringCategory: { code: "GSAx", name: "Goals Saved Above Expected" }, weight: 4 },
              { position: "SKATER", scoringCategory: { code: "EDGE42", name: "Unknown EDGE score" }, weight: 1 },
            ],
          }],
        },
      },
      fetchedAt: new Date("2026-08-18T12:00:00.000Z"),
    });

    expect(normalized.categoryWeights).toMatchObject({
      GAME_WINNING_GOALS: 2,
      TAKEAWAYS: 1,
      GIVEAWAYS: -1,
      SHOT_ATTEMPTS: 0.2,
      EXPECTED_GOALS: 2.5,
      QUALITY_STARTS_GOALIE: 3,
      GOALS_SAVED_ABOVE_EXPECTED: 4,
    });
    expect(normalized.diagnostics.unsupported).toContainEqual(
      expect.objectContaining({ code: "EDGE42", kind: "scoring" }),
    );
  });

  it("omits both sides of a conflicting category mapping with exact diagnostics", () => {
    const normalized = normalizeFantraxLeagueInfo({
      externalLeagueKey: "conflicting-category-league",
      payload: {
        ...categoryFixture,
        scoringSystem: {
          ...categoryFixture.scoringSystem,
          scoringCategorySettings: [
            {
              configs: [
                {
                  position: "SKATER",
                  scoringCategory: { code: "G", name: "Goals" },
                  weight: 1,
                },
                {
                  position: "SKATER",
                  scoringCategory: {
                    code: "INDG",
                    name: "Individual Goals",
                  },
                  weight: 2,
                },
              ],
            },
          ],
        },
      },
    });

    expect(normalized.categoryWeights.GOALS).toBeUndefined();
    expect(
      normalized.diagnostics.unsupported
        .filter((item) => item.reason.includes("conflicting weights"))
        .map((item) => item.code),
    ).toEqual(["G", "INDG"]);
  });

  it("produces a stable source hash independent of object insertion order and fetch time", () => {
    const reversedTeams = Object.fromEntries(
      Object.entries(categoryFixture.teamInfo).reverse(),
    );
    const first = normalizeFantraxLeagueInfo({
      externalLeagueKey: "category-league",
      payload: categoryFixture,
      fetchedAt: new Date("2026-08-14T12:00:00.000Z"),
    });
    const second = normalizeFantraxLeagueInfo({
      externalLeagueKey: "category-league",
      payload: { ...categoryFixture, teamInfo: reversedTeams },
      fetchedAt: new Date("2026-08-15T12:00:00.000Z"),
    });

    expect(second.sourceHash).toBe(first.sourceHash);
    expect(second.fetchedAt).not.toBe(first.fetchedAt);
  });

  it("fails closed for a non-NHL league and never invents draft order", () => {
    const normalized = normalizeFantraxLeagueInfo({
      externalLeagueKey: "wrong-sport",
      payload: {
        ...categoryFixture,
        sportCode: "MLB",
        draftType: "AUCTION",
      },
    });

    expect(normalized.diagnostics.status).toBe("unsupported");
    expect(normalized.draftOrderType).toBe("unknown");
    expect(normalized).not.toHaveProperty("draftOrder");
  });

  it("diagnoses present-but-empty roster and team collections without inventing values", () => {
    const normalized = normalizeFantraxLeagueInfo({
      externalLeagueKey: "incomplete-league",
      payload: {
        ...categoryFixture,
        rosterInfo: { positionConstraints: {} },
        teamInfo: {},
      },
    });

    expect(normalized.diagnostics.status).toBe("partial");
    expect(normalized.rosterConfig).toEqual({});
    expect(normalized.teams).toEqual([]);
    expect(normalized.diagnostics.unsupported).toContainEqual(
      expect.objectContaining({ code: "NO_ROSTER_CONSTRAINTS" }),
    );
    expect(normalized.diagnostics.warnings).toContain(
      "Fantrax did not return any league team identities.",
    );
  });

  it("filters known non-NHL discovery rows and retains only scoped raw settings", () => {
    expect(
      normalizeFantraxDiscovery({
        nhl: { name: "NHL", sport: "NHL", teamId: "mine", teamName: "Mine" },
        mlb: { name: "MLB", sport: "MLB" },
      }),
    ).toEqual([
      expect.objectContaining({
        externalLeagueKey: "nhl",
        ownedTeams: [expect.objectContaining({ externalTeamKey: "mine" })],
      }),
    ]);

    const raw = relevantFantraxRawSettings(pointsFixture);
    expect(raw).toHaveProperty("scoringSystem");
    expect(raw).toHaveProperty("rosterInfo");
    expect(raw).toHaveProperty("teamInfo");
    expect(raw).not.toHaveProperty("playerInfo");
    expect(raw).not.toHaveProperty("matchups");
  });
});
