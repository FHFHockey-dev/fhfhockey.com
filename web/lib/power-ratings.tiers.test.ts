import { describe, expect, it } from "vitest";

import {
  poolTeamSpecialTeams,
  rankSpecialTeamsCompetition,
  type WgoSpecialTeamsGameRow,
} from "./underlying-stats/teamSpecialTeamsContext";
import { computeSpecialTeamsTiers, specialTeamsTierFromRank } from "./power-ratings";

const game = (
  gameId: number,
  ppg: number | null,
  ppo: number | null,
  ppga = 0,
  ts = 3,
): WgoSpecialTeamsGameRow => ({
  date: `2026-01-${String(gameId % 28 + 1).padStart(2, "0")}`,
  franchise_name: null,
  game_id: 2025020000 + gameId,
  season_id: 20252026,
  team_id: null,
  power_play_goals_for: ppg,
  pp_opportunities: ppo,
  pp_goals_against: ppga,
  times_shorthanded: ts,
  power_play_pct: ppg != null && ppo ? ppg / ppo : null,
  penalty_kill_pct: ts ? 1 - ppga / ts : null,
});

/** Season-to-date pooled tiers, the way the ratings writer derives them. */
const tiersFor = (rowsByTeam: Record<string, WgoSpecialTeamsGameRow[]>) => {
  const pp = new Map<string, number | null>();
  const pk = new Map<string, number | null>();
  Object.entries(rowsByTeam).forEach(([team, rows]) => {
    const pooled = poolTeamSpecialTeams(rows);
    pp.set(team, pooled.ppPct);
    pk.set(team, pooled.pkPct);
  });
  const ppRank = rankSpecialTeamsCompetition(pp);
  const pkRank = rankSpecialTeamsCompetition(pk);
  return computeSpecialTeamsTiers(
    new Map(
      Object.keys(rowsByTeam).map((team) => [
        team,
        {
          ppPct: pp.get(team) ?? null,
          ppRank: ppRank.get(team) ?? null,
          pkPct: pk.get(team) ?? null,
          pkRank: pkRank.get(team) ?? null,
        },
      ]),
    ),
  );
};

describe("PP/PK tiers from pooled season-to-date special teams (W1 P0 #13)", () => {
  it("tiers on the pooled season, not the last game", () => {
    // HOT went 1-for-1 last night but 2-for-30 on the season (6.7%).
    const tiers = tiersFor({
      HOT: [...Array.from({ length: 9 }, (_, i) => game(i, i < 1 ? 1 : 0, 3)), game(9, 1, 1)],
      MID: Array.from({ length: 10 }, (_, i) => game(100 + i, i < 6 ? 1 : 0, 3)),
      TOP: Array.from({ length: 10 }, (_, i) => game(200 + i, 1, 3)),
    });
    expect(tiers.get("HOT")?.ppTier).toBe(3);
    expect(tiers.get("MID")?.ppTier).toBe(2);
    expect(tiers.get("TOP")?.ppTier).toBe(1);
  });

  it("keeps an unknown PP game unknown: no tier, never tier 3", () => {
    const tiers = tiersFor({
      GAP: [game(1, 1, 3), game(2, null, null)],
      A: [game(11, 1, 3)],
      B: [game(21, 0, 3)],
    });
    expect(tiers.get("GAP")?.ppTier).toBeNull();
    expect(tiers.get("A")?.ppTier).toBe(1);
    expect(tiers.get("B")?.ppTier).toBe(2);
  });

  it("gives tied teams the same tier (unequal tier sizes)", () => {
    const tiers = tiersFor({
      A: [game(1, 2, 4)],
      B: [game(2, 2, 4)],
      C: [game(3, 2, 4)],
      D: [game(4, 0, 4)],
      E: [game(5, 0, 4)],
      F: [game(6, 0, 4)],
    });
    expect(["A", "B", "C"].map((t) => tiers.get(t)?.ppTier)).toEqual([1, 1, 1]);
    expect(["D", "E", "F"].map((t) => tiers.get(t)?.ppTier)).toEqual([2, 2, 2]);
    expect(specialTeamsTierFromRank(null, 32)).toBeNull();
  });
});
