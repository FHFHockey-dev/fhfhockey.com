import { describe, expect, it } from "vitest";

import { getRequiredCsvColumns } from "./csvImportContract";
import { validateCsvProjectionRows } from "./csvImportValidation";

const validSkater = {
  Player_Name: "Sebastian Aho",
  Team_Abbreviation: "CAR",
  Position: "C",
  Games_Played: "82",
  Goals: 30,
  Assists: 50,
  Points: 80,
  PP_Points: 25,
  Shots_on_Goal: 250,
  Hits: 40,
  Blocked_Shots: 20,
  player_id: 8478427
};

describe("validateCsvProjectionRows", () => {
  it("coerces safe numeric strings and accepts a valid source row", () => {
    const result = validateCsvProjectionRows(
      [validSkater],
      getRequiredCsvColumns("skater")
    );

    expect(result).toMatchObject({
      parsedRows: 1,
      accepted: 1,
      skipped: 0,
      duplicates: 0,
      invalid: 0
    });
    expect(result.acceptedRows[0].Games_Played).toBe(82);
  });

  it("skips duplicate players by canonical player ID", () => {
    const result = validateCsvProjectionRows(
      [validSkater, { ...validSkater, Goals: 31 }],
      getRequiredCsvColumns("skater")
    );

    expect(result).toMatchObject({ accepted: 1, skipped: 1, duplicates: 1 });
    expect(result.issues[0]).toContain("duplicate player projection");
  });

  it("fails rows with missing identity or unsafe numeric values", () => {
    const result = validateCsvProjectionRows(
      [
        { ...validSkater, Team_Abbreviation: "" },
        { ...validSkater, player_id: 2, Save_Percentage: "91.5%", Goals: "thirty" }
      ],
      getRequiredCsvColumns("skater")
    );

    expect(result).toMatchObject({ accepted: 0, skipped: 2, invalid: 2 });
    expect(result.issues.join(" ")).toContain("missing Team_Abbreviation");
    expect(result.issues.join(" ")).toContain("Goals");
  });

  it("uses normalized name/team/position identity when no player ID is resolved", () => {
    const withoutId = { ...validSkater };
    delete (withoutId as any).player_id;
    const result = validateCsvProjectionRows(
      [withoutId, { ...withoutId, Player_Name: "Sébastian Aho" }],
      getRequiredCsvColumns("skater")
    );

    expect(result).toMatchObject({ accepted: 1, duplicates: 1 });
  });

  it("preserves valid multi-position eligibility", () => {
    const result = validateCsvProjectionRows(
      [{ ...validSkater, Position: "C,LW" }],
      getRequiredCsvColumns("skater")
    );

    expect(result).toMatchObject({ accepted: 1, invalid: 0 });
    expect(result.acceptedRows[0].Position).toBe("C,LW");
  });

  it("reports every absent required stat on an otherwise identified row", () => {
    const result = validateCsvProjectionRows(
      [
        {
          Player_Name: "Sebastian Aho",
          Team_Abbreviation: "CAR",
          Position: "C"
        }
      ],
      getRequiredCsvColumns("skater")
    );

    expect(result).toMatchObject({ accepted: 0, invalid: 1 });
    expect(result.issues[0]).toContain("Games_Played");
    expect(result.issues[0]).toContain("Goals");
    expect(result.issues[0]).toContain("Blocked_Shots");
  });
});
