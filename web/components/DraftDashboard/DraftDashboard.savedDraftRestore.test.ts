import { describe, expect, it } from "vitest";

import {
  adaptSavedDraftRows,
  applyYahooPlayoffSchedule,
  buildAppliedYahooDraftSettings,
  type DraftSettings,
} from "./DraftDashboard";

const pick = { playerId: "1", teamId: "Team 1", pickNumber: 1, round: 1, pickInRound: 1 };
const csv = {
  id: "custom_csv_1",
  label: "Private rankings",
  headers: [{ original: "Player", standardized: "name", selected: true }],
  rows: [{ Player: "A" }],
};

describe("Saved Drafts dashboard restore boundary", () => {
  it("does not overwrite a resolved local order while applying Yahoo roster and scoring", () => {
    const current: DraftSettings = { teamCount: 2, draftOrder: ["team.2", "team.1"],
      draftOrderMode: "custom", reversedRounds: [2], rosterConfig: { C: 1, bench: 0, utility: 0 }, scoringCategories: {} };
    const applied = buildAppliedYahooDraftSettings(current, { teamCount: 2, draftOrder: current.draftOrder,
      customTeamNames: {}, draftOrderMode: "custom", reversedRounds: [2], rosterConfig: { C: 2 } });
    expect(applied.draftOrder).toEqual(current.draftOrder);
    expect(applied.draftOrderMode).toBe("custom");
    expect(applied.reversedRounds).toEqual([2]);
    expect(applied.rosterConfig).toEqual({ C: 2 });
  });

  it("syncs Yahoo playoff weeks while preserving unknown schedules and unrelated settings", () => {
    const current: DraftSettings = { teamCount: 8, draftOrder: ["A"], rosterConfig: { C: 1, bench: 1, utility: 0 },
      scoringCategories: { GOALS: 3 }, playoffWeeks: [21, 22], scheduleScope: "playoffs" };
    expect(applyYahooPlayoffSchedule(current)).toBe(current);
    expect(applyYahooPlayoffSchedule(current, [21, 22])).toBe(current);
    expect(applyYahooPlayoffSchedule(current, [24, 25, 26])).toEqual({ ...current, playoffWeeks: [24, 25, 26] });
    expect(applyYahooPlayoffSchedule(current, [])).toEqual({ ...current, playoffWeeks: [], scheduleScope: "season" });
  });

  it("builds persisted Yahoo settings from the confirmed configuration", () => {
    const current: DraftSettings = {
      teamCount: 12,
      scoringCategories: { GOALS: 1 },
      rosterConfig: { C: 1, G: 1, bench: 1, utility: 0 },
      draftOrder: Array.from({ length: 12 }, (_, index) => "Team " + (index + 1)),
      draftOrderMode: "snake",
      reversedRounds: [],
    };
    const applied = buildAppliedYahooDraftSettings(current, {
      teamCount: 8,
      draftOrder: Array.from({ length: 8 }, (_, index) => "team." + (index + 1)),
      customTeamNames: {},
      isSnakeDraft: true,
      rosterConfig: { C: 1, LW: 1, RW: 1, FWD: 1, D: 2, G: 2, bench: 8, utility: 2 },
      scoringCategories: { GOALS: 3 },
    });

    expect(applied.teamCount).toBe(8);
    expect(applied.rosterConfig.utility).toBe(2);
    expect(Object.values(applied.rosterConfig).reduce((sum, count) => sum + count, 0)).toBe(18);
    expect(applied.scoringCategories).toEqual({ GOALS: 3 });
  });

  it("rejects malformed required pick fields", () => {
    expect(() => adaptSavedDraftRows({ draftedPlayers: [{ ...pick, teamId: null }], customCsvList: [] })).toThrow("Saved draft picks are invalid");
  });

  it("rejects private imports without required normalized rows", () => {
    expect(() => adaptSavedDraftRows({ draftedPlayers: [pick], customCsvList: [{ ...csv, rows: undefined }] })).toThrow("Saved private import data is invalid");
  });

  it("accepts empty optional resolution metadata as unavailable", () => {
    const adapted = adaptSavedDraftRows({ draftedPlayers: [pick], customCsvList: [{ ...csv, resolution: {} }] });
    expect(adapted.customCsvList[0].resolution).toBeUndefined();
    expect(adapted.customCsvList[0].rows).toEqual(csv.rows);
  });
});
