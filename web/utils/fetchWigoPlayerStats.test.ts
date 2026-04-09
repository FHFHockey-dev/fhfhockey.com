import { describe, expect, it } from "vitest";

import type {
  WigoCareerRow,
  WigoRecentRow
} from "./fetchWigoPlayerStats";
import { buildPlayerAggregatedStats } from "./fetchWigoPlayerStats";

describe("buildPlayerAggregatedStats", () => {
  it("normalizes aggregate values using the shared stat contract", () => {
    const careerData = {
      player_id: 1,
      std_gp: 20,
      ly_gp: 10,
      ya3_gp: 30,
      ca_gp: 40,
      std_g: 10,
      std_s_pct: 0.15,
      std_ipp: 0.55,
      std_atoi: 15.5,
      std_pptoi: 75,
      std_ixg: 8.44
    } as WigoCareerRow;

    const recentData = {
      player_id: 1,
      l5_gp: 5,
      l10_gp: 10,
      l20_gp: 20,
      l5_atoi: 17.25,
      l5_pptoi: 50,
      l5_s_pct: 0.2,
      l5_ipp: 0.5
    } as WigoRecentRow;

    const rows = buildPlayerAggregatedStats({
      careerData,
      recentData,
      ratesData: null,
      totalsData: null
    });

    expect(rows.find((row) => row.label === "Goals")?.STD).toBe(10);
    expect(rows.find((row) => row.label === "S%")?.STD).toBeCloseTo(15);
    expect(rows.find((row) => row.label === "IPP")?.STD).toBeCloseTo(55);
    expect(rows.find((row) => row.label === "ATOI")?.STD).toBeCloseTo(930);
    expect(rows.find((row) => row.label === "ATOI")?.L5).toBeCloseTo(1035);
    expect(rows.find((row) => row.label === "PPTOI")?.STD).toBeCloseTo(75);
    expect(rows.find((row) => row.label === "PPTOI")?.L5).toBeCloseTo(50);
    expect(rows.find((row) => row.label === "ixG")?.STD).toBeCloseTo(8.44);
  });

  it("derives per-60 values from counts and ATOI when the rates table is missing", () => {
    const careerData = {
      player_id: 1,
      std_gp: 20,
      std_pts: 10,
      std_atoi: 15
    } as WigoCareerRow;

    const rows = buildPlayerAggregatedStats({
      careerData,
      recentData: null,
      ratesData: null,
      totalsData: null
    });

    expect(rows.find((row) => row.label === "PTS/60")?.STD).toBeCloseTo(2);
  });

  it("uses totals fallback for missing standard count values", () => {
    const careerData = {
      player_id: 1,
      std_gp: 40
    } as WigoCareerRow;

    const rows = buildPlayerAggregatedStats({
      careerData,
      recentData: null,
      ratesData: null,
      totalsData: {
        goals: 14,
        assists: 20,
        points: 34,
        shots: 100,
        hits: 50,
        blocked_shots: 25,
        penalty_minutes: 18,
        pp_points: 10
      }
    });

    expect(rows.find((row) => row.label === "Goals")?.STD).toBe(14);
    expect(rows.find((row) => row.label === "Points")?.STD).toBe(34);
    expect(rows.find((row) => row.label === "PPP")?.STD).toBe(10);
  });
});
