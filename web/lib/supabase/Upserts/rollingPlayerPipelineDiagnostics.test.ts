import { describe, expect, it } from "vitest";
import {
  summarizeCoverage,
  summarizeSuspiciousOutputs
} from "./rollingPlayerPipelineDiagnostics";

describe("summarizeCoverage", () => {
  it("flags missing all-strength source dates and pp rows", () => {
    const result = summarizeCoverage({
      playerId: 1,
      strength: "all",
      wgoRows: [
        { date: "2025-10-01", game_id: 10, pp_toi: 120 },
        { date: "2025-10-03", game_id: 11, pp_toi: 0 },
        { date: "2025-10-05", game_id: 12, pp_toi: 90 }
      ],
      countsRows: [{ date_scraped: "2025-10-01" }],
      ratesRows: [
        { date_scraped: "2025-10-01" },
        { date_scraped: "2025-10-03" }
      ],
      countsOiRows: [{ date_scraped: "2025-10-01" }],
      ppRows: [{ gameId: 10, pp_share_of_team: null }],
      knownGameIds: new Set([10, 11])
    });

    expect(result.counts.expectedDates).toBe(3);
    expect(result.sample.missingCountsDates).toEqual([
      "2025-10-03",
      "2025-10-05"
    ]);
    expect(result.sample.missingCountsOiDates).toEqual([
      "2025-10-03",
      "2025-10-05"
    ]);
    expect(result.sample.missingPpGameIds).toEqual([12]);
    expect(result.sample.missingPpShareGameIds).toEqual([10]);
    expect(result.sample.unknownGameIds).toEqual([12]);
    expect(result.warnings[0]).toContain("missingCountsDates:2");
    expect(result.warnings[0]).toContain("missingPpGameIds:1");
    expect(result.warnings[0]).toContain("missingPpShareGameIds:1");
  });

  it("uses split-source union dates for non-all strengths", () => {
    const result = summarizeCoverage({
      playerId: 2,
      strength: "pp",
      wgoRows: [
        { date: "2025-10-01", game_id: 20, pp_toi: 100 },
        { date: "2025-10-03", game_id: 21, pp_toi: 0 }
      ],
      countsRows: [{ date_scraped: "2025-10-01" }],
      ratesRows: [],
      countsOiRows: [{ date_scraped: "2025-10-01" }],
      ppRows: [{ gameId: 20, pp_share_of_team: 0.5 }],
      knownGameIds: new Set([20, 21])
    });

    expect(result.counts.expectedDates).toBe(1);
    expect(result.sample.missingRatesDates).toEqual(["2025-10-01"]);
    expect(result.sample.missingCountsDates).toEqual([]);
  });
});

describe("summarizeSuspiciousOutputs", () => {
  it("flags bounded metrics outside their valid range", () => {
    const result = summarizeSuspiciousOutputs({
      playerId: 3,
      strength: "all",
      rows: [
        {
          game_date: "2025-11-01",
          shooting_pct_total_all: 150,
          pp_share_pct_total_all: 1.4,
          pdo_total_all: 1.03
        },
        {
          game_date: "2025-11-03",
          ipp_total_all: -5
        },
        {
          game_date: "2025-11-05",
          gp_pct_total_all: 0.2,
          games_played: 5,
          team_games_played: 4
        }
      ]
    });

    expect(result.issueCount).toBe(4);
    expect(result.warnings[0]).toContain("shooting_pct_total_all=150");
    expect(result.warnings[0]).toContain("pp_share_pct_total_all=1.4");
    expect(result.warnings[0]).toContain("ipp_total_all=-5");
    expect(result.warnings[0]).toContain("issues:4");
  });

  it("ignores null and in-range values", () => {
    const result = summarizeSuspiciousOutputs({
      playerId: 4,
      strength: "all",
      rows: [
        {
          game_date: "2025-12-01",
          shooting_pct_total_all: 12.5,
          pp_share_pct_total_all: 0.55,
          pdo_total_all: 0.997,
          ipp_total_all: null,
          gp_pct_total_all: 0.6,
          games_played: 6,
          team_games_played: 10,
          gp_pct_total_last3: Number((2 / 3).toFixed(6)),
          games_played_last3_team_games: 2,
          team_games_available_last3: 3
        }
      ]
    });

    expect(result.issueCount).toBe(0);
    expect(result.warnings).toEqual([]);
  });
});
