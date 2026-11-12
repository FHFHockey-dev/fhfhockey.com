import { describe, expect, it } from "vitest";

import type { GameData } from "lib/NHL/types";
import { summarizeTeamDateRange } from "./useDateRangeTeamGrid";

const game = (id: number, homeId: number, awayId: number, extra: Partial<GameData> = {}): GameData => ({
  id, season: 20252026, gameType: 2, homeTeam: { id: homeId }, awayTeam: { id: awayId }, ...extra
} as GameData);

describe("date-range grid counts (BC W1-12 A; DateRangeTeamGrid)", () => {
  const dates = ["2026-02-01", "2026-02-02", "2026-02-03", "2026-02-04"];
  const meta = Object.fromEntries(dates.map((d) => [d, { regularSeasonGames: 6 }]));

  it("does not count a postponed game toward back-to-backs, home/away or off-nights", () => {
    const counts = summarizeTeamDateRange(dates, {
      "2026-02-01": game(2025020001, 1, 2),
      "2026-02-02": game(2025020002, 1, 3, { gameScheduleState: "PPD" }),
      "2026-02-04": game(2025020004, 4, 1),
    }, meta, new Set([1]));
    expect(counts).toEqual({ off: 2, b2b: 0, home: 1, away: 1 });
  });

  it("does not count cancelled or playoff games", () => {
    const counts = summarizeTeamDateRange(dates, {
      "2026-02-01": game(2025020001, 1, 2),
      "2026-02-02": game(2025030111, 1, 3, { gameType: 3 }),
      "2026-02-03": game(2025020003, 1, 5, { gameState: "CNCL" }),
    }, meta, new Set([1]));
    expect(counts).toEqual({ off: 1, b2b: 0, home: 1, away: 0 });
  });
});
