import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { RosterMatrix } from "./RosterMatrix";
import { aggregateNstGoalieGamelog, buildRosterPlayer } from "./rosterMatrixData";

const goalie = {
  id: 31,
  fullName: "Test Goalie",
  position: "G",
  birthDate: "2000-11-11",
  heightInCentimeters: 182.5
};

// NST goalie gamelog rows: `toi` is minutes. A 60-minute start (3 GA) and a
// 600 s relief stint (10 min, 1 GA): GAA = 4 × 60 ÷ 70 = 3.43. Reading the
// minutes as seconds gave 4 × 3600 ÷ 70 = 205.71.
const gamelog = [
  {
    player_id: 31,
    gp: 1,
    toi: 60,
    shots_against: 30,
    saves: 27,
    goals_against: 3,
    gsaa: -0.4,
    xg_against: 2.5,
    hd_shots_against: 8,
    hd_saves: 6,
    md_shots_against: 10,
    md_saves: 9,
    ld_shots_against: 12,
    ld_sv_percentage: 1
  },
  {
    player_id: 31,
    gp: 1,
    toi: 10,
    shots_against: 5,
    saves: 4,
    goals_against: 1,
    gsaa: -0.6,
    xg_against: 0.5,
    hd_shots_against: 1,
    hd_saves: 0,
    md_shots_against: 2,
    md_saves: 2,
    ld_shots_against: 2,
    ld_sv_percentage: 0.5
  }
];

describe("Roster Matrix goalie fallback (W2-2 D7)", () => {
  const goalieStat = aggregateNstGoalieGamelog(gamelog).get(31);
  const row = buildRosterPlayer(goalie, { goalieStat }, new Date("2026-11-11T12:00:00Z"));

  it("computes GAA from minutes, including a 600 s relief stint", () => {
    expect(row.goals_against_avg).toBeCloseTo((4 * 60) / 70, 10);

    const markup = renderToStaticMarkup(
      React.createElement(RosterMatrix, {
        players: [row],
        teamAbbreviation: "FLA",
        isLoading: false,
        error: null
      })
    );
    expect(markup).toContain(">3.43<");
    expect(markup).not.toContain("205.71");
  });

  it("pools SV% and HD SV% and leaves LD SV% and GSAA unknown", () => {
    expect(row.save_pct).toBeCloseTo((31 / 35) * 100, 10);
    expect(row.hd_save_pct).toBeCloseTo((6 / 9) * 100, 10);
    expect(row.md_save_pct).toBeCloseTo((11 / 12) * 100, 10);
    // No LD saves are stored; HD saves are not LD saves.
    expect(row.ld_save_pct).toBeUndefined();
    // Never a sum of per-game GSAA (decision 10).
    expect(row.gsaa).toBeUndefined();
  });

  it("leaves GAA unknown when a game's TOI is unknown", () => {
    const stat = aggregateNstGoalieGamelog([
      gamelog[0],
      { ...gamelog[1], toi: null }
    ]).get(31);
    expect(stat?.goals_against_avg).toBeUndefined();
  });
});

describe("Roster Matrix biography (W3-3 D4)", () => {
  it("formats 182.5 cm as 6' 0\" and counts a birthday on the day", () => {
    const row = buildRosterPlayer(goalie, {}, new Date("2026-11-11T12:00:00Z"));
    expect(row.height).toBe("6' 0\"");
    expect(row.age).toBe(26);
  });
});

describe("Roster Matrix unknown NST rates (L4a reader ticket)", () => {
  it("renders NULL season-view rates and shares as unknown, not 0", () => {
    const skater = { id: 8, fullName: "Test Skater", position: "C" };
    const row = buildRosterPlayer(skater, {
      skaterStat: { games_played: 3, shooting_percentage: null },
      onIceStat: { cf_pct: null, xgf_pct: null, hdcf_pct: null, pdo: null },
      ratesStat: { total_points_per_60: null, ixg_per_60: null }
    });
    expect(row).toMatchObject({
      shooting_percentage: undefined,
      cf_pct: undefined,
      pdo: undefined,
      total_points_per_60: undefined,
      ixg_per_60: undefined
    });

    const markup = renderToStaticMarkup(
      React.createElement(RosterMatrix, {
        players: [row],
        teamAbbreviation: "FLA",
        isLoading: false,
        error: null
      })
    );
    expect(markup).not.toContain(">0.0%<");
    expect(markup).not.toContain(">0.00<");
  });
});
