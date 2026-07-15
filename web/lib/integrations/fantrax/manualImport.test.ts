import { describe, expect, it } from "vitest";

import {
  FantraxImportError,
  getFantraxImportBlock,
  parseFantraxImport,
} from "./manualImport";

describe("parseFantraxImport", () => {
  it("normalizes multi-league JSON and explicit defaults", () => {
    const result = parseFantraxImport(
      JSON.stringify({
        accountLabel: "Tim's Fantrax",
        leagues: [
          {
            key: "league-a",
            name: "Keepers",
            season: "2026",
            teams: [{ key: "team-a", name: "Puck Luck", isDefault: true }],
          },
          {
            name: "Dynasty League",
            teams: [{ name: "Future Stars", roster: [{ name: "Player A" }] }],
          },
        ],
      }),
      "json",
    );

    expect(result.accountLabel).toBe("Tim's Fantrax");
    expect(result.leagues).toHaveLength(2);
    expect(result.leagues[0]).toEqual(
      expect.objectContaining({ key: "league-a", seasonKey: "2026" }),
    );
    expect(result.leagues[0].teams[0].isDefault).toBe(true);
    expect(result.leagues[1]).toEqual(
      expect.objectContaining({ key: "dynasty-league" }),
    );
    expect(result.leagues[1].teams[0]).toEqual(
      expect.objectContaining({ key: "future-stars" }),
    );
  });

  it("groups CSV roster rows into multiple league and team records", () => {
    const result = parseFantraxImport(
      [
        "league_id,league_name,season,team_id,team_name,is_default,player_id,player_name,position",
        "l1,Keepers,2026,t1,Puck Luck,true,p1,Player One,C",
        "l1,Keepers,2026,t1,Puck Luck,true,p2,Player Two,D",
        "l2,Dynasty,2026,t2,Future Stars,false,p3,Player Three,G",
      ].join("\n"),
      "csv",
    );

    expect(result.leagues).toHaveLength(2);
    expect(result.leagues[0].teams).toHaveLength(1);
    expect(result.leagues[0].teams[0].roster).toEqual([
      { player_id: "p1", name: "Player One", position: "C", status: null },
      { player_id: "p2", name: "Player Two", position: "D", status: null },
    ]);
    expect(result.leagues[0].teams[0].isDefault).toBe(true);
  });

  it("rejects malformed or ambiguous imports before persistence", () => {
    expect(() =>
      parseFantraxImport("league_name,team_name\nKeepers,", "csv"),
    ).toThrow("Every CSV row needs league_name");
    expect(() => parseFantraxImport('{"leagues":[]}', "json")).toThrow(
      "at least one league",
    );
  });
});

describe("getFantraxImportBlock", () => {
  const now = new Date("2026-07-14T14:00:00.000Z");

  it("blocks an active import and reports cooldown retry timing", () => {
    const running = getFantraxImportBlock(
      {
        status: "running",
        started_at: "2026-07-14T13:59:30.000Z",
        created_at: "2026-07-14T13:59:30.000Z",
        cooldown_until: null,
      },
      now,
    );
    expect(running).toBeInstanceOf(FantraxImportError);
    expect(running?.statusCode).toBe(409);

    const cooldown = getFantraxImportBlock(
      {
        status: "completed",
        started_at: "2026-07-14T13:59:30.000Z",
        created_at: "2026-07-14T13:59:30.000Z",
        cooldown_until: "2026-07-14T14:00:09.500Z",
      },
      now,
    );
    expect(cooldown?.statusCode).toBe(429);
    expect(cooldown?.retryAfterSeconds).toBe(10);
  });

  it("allows stale imports to be recovered", () => {
    expect(
      getFantraxImportBlock(
        {
          status: "running",
          started_at: "2026-07-14T13:40:00.000Z",
          created_at: "2026-07-14T13:40:00.000Z",
          cooldown_until: null,
        },
        now,
      ),
    ).toBeNull();
  });
});
