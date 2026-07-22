import { describe, expect, it } from "vitest";
import {
  buildCanonicalSosRankings,
  type SosStandingRow,
} from "./strengthOfSchedule";

function standing(
  teamId: number,
  teamName: string,
  gameDate: string,
  pastWins: number,
): SosStandingRow {
  return {
    season_id: 20252026,
    game_date: gameDate,
    team_id: teamId,
    team_name: teamName,
    team_abbrev: teamId === 53 ? "ARI" : "UTA",
    past_opponent_total_wins: pastWins,
    past_opponent_total_losses: 10,
    past_opponent_total_ot_losses: 0,
    future_opponent_total_wins: 5,
    future_opponent_total_losses: 5,
    future_opponent_total_ot_losses: 0,
  };
}

describe("buildCanonicalSosRankings", () => {
  it("keeps only canonical current membership and uses canonical rendering identity", () => {
    const rankings = buildCanonicalSosRankings(
      [
        standing(53, "Arizona Coyotes", "2024-04-17", 30),
        standing(59, "Utah Hockey Club", "2025-04-17", 25),
        standing(68, "stale source name", "2026-01-01", 10),
        standing(68, "another stale source name", "2026-01-02", 20),
      ],
      [{ id: 68, name: "Utah Mammoth", abbreviation: "UTA" }],
    );

    expect(rankings.past).toEqual([
      {
        teamId: 68,
        team: "Utah Mammoth",
        abbreviation: "UTA",
        sos: 0.667,
      },
    ]);
    expect(rankings.future).toEqual([
      {
        teamId: 68,
        team: "Utah Mammoth",
        abbreviation: "UTA",
        sos: 0.5,
      },
    ]);
  });

  it("uses the latest non-empty row rather than a newer empty snapshot", () => {
    const empty = standing(68, "Utah Mammoth", "2026-01-03", 0);
    empty.past_opponent_total_losses = 0;
    empty.future_opponent_total_wins = 0;
    empty.future_opponent_total_losses = 0;

    const rankings = buildCanonicalSosRankings(
      [standing(68, "Utah Mammoth", "2026-01-02", 20), empty],
      [{ id: 68, name: "Utah Mammoth", abbreviation: "UTA" }],
    );

    expect(rankings.past[0]?.sos).toBe(0.667);
  });
});
