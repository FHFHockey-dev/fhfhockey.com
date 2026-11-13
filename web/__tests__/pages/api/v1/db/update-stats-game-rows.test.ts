import { beforeEach, describe, expect, it, vi } from "vitest";

import fetchWithCache from "lib/fetchWithCache";

vi.mock("lib/fetchWithCache", () => ({ default: vi.fn() }));

import { getPlayersGameStats, processTeamGameStats } from "../../../../../pages/api/v1/db/update-stats/[gameId]";

const skater = (playerId: number, position: string) => ({
  playerId,
  sweaterNumber: 1,
  name: { default: "Test" },
  position,
  goals: 0,
  assists: 0,
  points: 0,
  plusMinus: 0,
  pim: 0,
  hits: 0,
  powerPlayGoals: 0,
  sog: 0,
  faceoffWinningPctg: 0,
  toi: "15:00",
  blockedShots: 0,
  shifts: 20,
  giveaways: 0,
  takeaways: 0,
});

describe("update-stats skater rows (decision 83)", () => {
  it("stores null, not 0/0 or 00:00 placeholders, for faceoffs and PP/SH TOI the boxscore lacks", () => {
    const { skaters } = getPlayersGameStats(
      {
        playerByGameStats: {
          homeTeam: { forwards: [skater(1, "C")], defense: [skater(2, "D")], goalies: [] },
          awayTeam: { forwards: [], defense: [], goalies: [] },
        },
      },
      2025020001,
      {},
      {},
      {}
    );

    expect(skaters).toHaveLength(2);
    for (const row of skaters) {
      expect(row.faceoffs).toBeNull();
      expect(row.powerPlayToi).toBeNull();
      expect(row.shorthandedToi).toBeNull();
      // Values the boxscore does carry are kept.
      expect(row.toi).toBe("15:00");
    }
  });
});


describe("update-stats missing clocks and goalie ratios (item 6)", () => {
  beforeEach(() => vi.resetAllMocks());

  it.each([undefined, null, "", "bad", "00:60"])("keeps an unavailable goalie clock/ratio unknown: %s", (value) => {
    const { goalies } = getPlayersGameStats({ playerByGameStats: {
      homeTeam: { goalies: [{ playerId: 31, position: "G", toi: value,
        evenStrengthShotsAgainst: value, powerPlayShotsAgainst: value,
        shorthandedShotsAgainst: value, saveShotsAgainst: value }] },
    } }, 2025020001, {}, {}, {});
    expect(goalies[0]).toMatchObject({ toi: null, evenStrengthShotsAgainst: null,
      powerPlayShotsAgainst: null, shorthandedShotsAgainst: null, saveShotsAgainst: null });
  });

  it("preserves explicitly reported zero goalie clocks and ratios", () => {
    const { goalies } = getPlayersGameStats({ playerByGameStats: {
      homeTeam: { goalies: [{ playerId: 31, position: "G", toi: "00:00",
        evenStrengthShotsAgainst: "0/0", powerPlayShotsAgainst: "0/0",
        shorthandedShotsAgainst: "0/0", saveShotsAgainst: "0-0" }] },
    } }, 2025020001, {}, {}, {});
    expect(goalies[0]).toMatchObject({ toi: "00:00", evenStrengthShotsAgainst: "0/0",
      powerPlayShotsAgainst: "0/0", shorthandedShotsAgainst: "0/0", saveShotsAgainst: "0-0" });
  });

  const team = (rightRail: unknown, home = true) => processTeamGameStats(2025020001, [], home,
    { homeTeam: { id: 1, score: 0 }, awayTeam: { id: 2, score: 0 } }, "20252026", rightRail);
  const report = (away: string, home: string) => `<table id="PenaltySummary">
    <tr class="oddColor"><td>Power Plays (Goals-Opp./PPTime)</td><td>0-0/${away}</td></tr>
    <tr class="evenColor"><td>Power Plays (Goals-Opp./PPTime)</td><td>0-0/${home}</td></tr></table>`;

  it("keeps failed report fetch unknown", async () => {
    vi.mocked(fetchWithCache).mockRejectedValue(new Error("fixture fetch failed"));
    expect((await team({})).powerPlayToi).toBeNull();
  });

  it.each(["", "<html>missing clock</html>", report("00:00", "00:60")])("keeps missing or malformed report clocks unknown", async (html) => {
    vi.mocked(fetchWithCache).mockResolvedValue(html);
    expect((await team({})).powerPlayToi).toBeNull();
  });

  it("preserves official zero, uses the oriented HTML clock, and falls back from malformed right-rail clocks", async () => {
    expect((await team({ homeTeam: { powerPlayToi: "00:00" } })).powerPlayToi).toBe("00:00");
    expect(fetchWithCache).not.toHaveBeenCalled();
    vi.mocked(fetchWithCache).mockResolvedValue(report("00:00", "04:12"));
    expect((await team({}, false)).powerPlayToi).toBe("00:00");
    expect((await team({ homeTeam: { powerPlayToi: "invalid" } })).powerPlayToi).toBe("04:12");
  });
});
