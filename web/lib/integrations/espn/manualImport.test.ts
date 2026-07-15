import { describe, expect, it, vi } from "vitest";

import {
  EspnImportError,
  getEspnImportBlock,
  parseEspnImport,
  setEspnActiveTeam,
} from "./manualImport";

describe("parseEspnImport", () => {
  it("normalizes multi-league JSON with ESPN defaults and active-team intent", () => {
    const result = parseEspnImport(
      JSON.stringify({
        leagues: [
          {
            id: 101,
            name: "Office Hockey",
            season: 2026,
            teams: [{ id: 1, name: "Breakaway Club", isDefault: true }],
          },
          {
            name: "Friends League",
            teams: [{ name: "Five Hole", roster: [{ name: "Player A" }] }],
          },
        ],
      }),
      "json",
    );

    expect(result.accountLabel).toBe("ESPN manual import");
    expect(result.leagues).toHaveLength(2);
    expect(result.leagues[0]).toEqual(
      expect.objectContaining({ key: "101", seasonKey: "2026" }),
    );
    expect(result.leagues[0].teams[0]).toEqual(
      expect.objectContaining({ key: "1", isDefault: true }),
    );
    expect(result.leagues[1].key).toBe("friends-league");
  });

  it("groups ESPN CSV player rows and emits provider-specific validation", () => {
    const result = parseEspnImport(
      [
        "league_id,league_name,season,team_id,team_name,is_default,player_id,player_name,position",
        "101,Office Hockey,2026,1,Breakaway Club,true,11,Player One,C",
        "101,Office Hockey,2026,1,Breakaway Club,true,12,Player Two,D",
      ].join("\n"),
      "csv",
    );

    expect(result.leagues[0].teams[0].roster).toHaveLength(2);
    expect(() => parseEspnImport('{"leagues":[]}', "json")).toThrow(
      "The ESPN import must include at least one league.",
    );
  });
});

describe("getEspnImportBlock", () => {
  const now = new Date("2026-07-14T14:00:00.000Z");

  it("uses independent ESPN in-flight and cooldown messaging", () => {
    const running = getEspnImportBlock(
      {
        status: "running",
        started_at: "2026-07-14T13:59:30.000Z",
        created_at: "2026-07-14T13:59:30.000Z",
        cooldown_until: null,
      },
      now,
    );
    expect(running).toBeInstanceOf(EspnImportError);
    expect(running?.message).toContain("ESPN import");
    expect(running?.statusCode).toBe(409);

    const cooldown = getEspnImportBlock(
      {
        status: "completed",
        started_at: "2026-07-14T13:59:30.000Z",
        created_at: "2026-07-14T13:59:30.000Z",
        cooldown_until: "2026-07-14T14:00:09.500Z",
      },
      now,
    );
    expect(cooldown?.message).toContain("ESPN import");
    expect(cooldown?.retryAfterSeconds).toBe(10);
  });
});

describe("ESPN provider persistence boundaries", () => {
  it("qualifies active-context reads and writes to the owner and ESPN provider", async () => {
    const teamQuery = {
      select: vi.fn(),
      eq: vi.fn(),
      maybeSingle: vi.fn().mockResolvedValue({
        data: {
          id: "team-1",
          connected_account_id: "account-1",
          external_league_id: "league-1",
        },
        error: null,
      }),
    };
    teamQuery.select.mockReturnValue(teamQuery);
    teamQuery.eq.mockReturnValue(teamQuery);
    const preferenceQuery = {
      upsert: vi.fn().mockResolvedValue({ error: null }),
    };
    const client = {
      from: vi.fn((table: string) =>
        table === "external_teams" ? teamQuery : preferenceQuery,
      ),
    } as any;

    await setEspnActiveTeam({
      userId: "user-1",
      teamId: "team-1",
      client,
    });

    expect(teamQuery.eq).toHaveBeenCalledWith("user_id", "user-1");
    expect(teamQuery.eq).toHaveBeenCalledWith("provider", "espn");
    expect(preferenceQuery.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        user_id: "user-1",
        provider: "espn",
        active_context: expect.objectContaining({
          provider: "espn",
          external_team_id: "team-1",
        }),
      }),
      { onConflict: "user_id,provider" },
    );
  });
});
