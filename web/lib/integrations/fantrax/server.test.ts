import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getFantraxLeagues: vi.fn(),
  getFantraxLeagueInfo: vi.fn(),
  rpc: vi.fn(),
}));

vi.mock("./client", () => ({
  FantraxApiError: class FantraxApiError extends Error {},
  getFantraxLeagues: mocks.getFantraxLeagues,
  getFantraxLeagueInfo: mocks.getFantraxLeagueInfo,
}));
vi.mock("lib/supabase/server", () => ({
  default: { rpc: mocks.rpc },
}));

import {
  discoverFantraxLeagues,
  linkFantraxAccount,
} from "./server";

const discovery = {
  "league-1": {
    name: "Fixture League",
    sport: "NHL",
    teamId: "team-1",
    teamName: "Fixture Team",
  },
};

const unsupportedLeagueInfo = {
  leagueName: "Fixture League",
  sport: "MLB",
  teamCount: 2,
  rosterInfo: {
    positionConstraints: { C: 2, G: 2 },
  },
  scoringSystem: {
    type: "HEAD_TO_HEAD_POINTS",
    scoringCategorySettings: [
      {
        group: "SKATER",
        configs: [
          {
            position: "SKATER",
            scoringCategory: { code: "G", name: "Goals" },
            points: 3,
          },
        ],
      },
    ],
  },
  teamInfo: {
    "team-1": { id: "team-1", name: "Fixture Team" },
    "team-2": { id: "team-2", name: "Other Team" },
  },
  draftSettings: { draftType: "SNAKE" },
};

describe("Fantrax settings service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv("FANTRAX_API_ENABLED", "true");
    mocks.getFantraxLeagues.mockResolvedValue(discovery);
    mocks.getFantraxLeagueInfo.mockResolvedValue(unsupportedLeagueInfo);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("previews unsupported mappings transiently but fails closed before persistence", async () => {
    const preview = await discoverFantraxLeagues({
      userId: "user-1",
      secretId: "secret",
      selectedLeagueKeys: ["league-1"],
    });
    expect(preview.previews[0].diagnostics.status).toBe("unsupported");

    await expect(
      linkFantraxAccount({
        userId: "user-1",
        secretId: "secret",
        accountLabel: "Fixture",
        selectedLeagueKeys: ["league-1"],
        consentVersion: "fantrax-settings-v1",
      }),
    ).rejects.toMatchObject({
      code: "FANTRAX_SETTINGS_UNSUPPORTED",
      statusCode: 422,
    });
    expect(mocks.rpc).not.toHaveBeenCalled();
  });

  it("rejects a selected league key that was not returned by discovery", async () => {
    await expect(
      linkFantraxAccount({
        userId: "user-1",
        secretId: "secret",
        accountLabel: "Fixture",
        selectedLeagueKeys: ["tampered-league"],
        consentVersion: "fantrax-settings-v1",
      }),
    ).rejects.toMatchObject({
      code: "FANTRAX_SELECTION_INVALID",
      statusCode: 400,
    });
    expect(mocks.getFantraxLeagueInfo).not.toHaveBeenCalled();
    expect(mocks.rpc).not.toHaveBeenCalled();
  });
});
