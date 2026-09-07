import { describe, expect, it } from "vitest";

import { adaptSavedDraftRows } from "./DraftDashboard";

const pick = { playerId: "1", teamId: "Team 1", pickNumber: 1, round: 1, pickInRound: 1 };
const csv = {
  id: "custom_csv_1",
  label: "Private rankings",
  headers: [{ original: "Player", standardized: "name", selected: true }],
  rows: [{ Player: "A" }],
};

describe("Saved Drafts dashboard restore boundary", () => {
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
