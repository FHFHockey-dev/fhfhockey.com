import { describe, expect, it } from "vitest";

import {
  NHLSCRAPER_CONTRACTS_PACKAGE_VERSION,
  NHLSCRAPER_CONTRACTS_ROW_COUNT,
  buildNhlscraperContractRows,
  getNhlscraperContractSourceRows,
  type ContractPlayerRow,
  type NhlscraperContractSourceRow,
} from "./nhlscraperContracts";

const baseSourceRow: NhlscraperContractSourceRow = {
  playerFullName: "Jonathan Example",
  positionCode: "L",
  teamTriCode: "ABC",
  teamId: 5,
  signedWithTriCode: "ABC",
  signedWithTeamId: 5,
  ageAtSigning: 25,
  startSeasonId: 20242025,
  endSeasonId: 20252026,
  contractYears: 2,
  contractValue: 3000000,
  contractAAV: 1500000,
  signingBonus: 500000,
  twoYearCash: 3000000,
  threeYearCash: 3000000,
  sourceFile: "NHL_Contracts_Test.csv",
};

function player(overrides: Partial<ContractPlayerRow>): ContractPlayerRow {
  return {
    id: 42,
    fullName: "Jonathan Example",
    position: "L",
    birthDate: "1999-07-01",
    team_id: 5,
    ...overrides,
  };
}

describe("nhlscraper contract ingestion", () => {
  it("loads the packaged contract snapshot", () => {
    const rows = getNhlscraperContractSourceRows();

    expect(NHLSCRAPER_CONTRACTS_PACKAGE_VERSION).toBe("0.6.1");
    expect(rows).toHaveLength(NHLSCRAPER_CONTRACTS_ROW_COUNT);
    expect(rows[0]).toMatchObject({
      playerFullName: "Wayne Gretzky",
      startSeasonId: 19791980,
      endSeasonId: 19881989,
      contractYears: 10,
      contractAAV: 300000,
    });
  });

  it("builds upsert rows with hidden salary cash fields", () => {
    const [row] = buildNhlscraperContractRows({
      sourceRows: [baseSourceRow],
      players: [player({})],
      now: "2026-06-18T00:00:00.000Z",
    });

    expect(row).toMatchObject({
      source: "nhlscraper",
      source_package_version: "0.6.1",
      player_id: 42,
      player_full_name: "Jonathan Example",
      contract_value: 3000000,
      contract_aav: 1500000,
      signing_bonus: 500000,
      two_year_cash: 3000000,
      three_year_cash: 3000000,
      resolution_status: "matched",
      resolution_candidate_count: 1,
      updated_at: "2026-06-18T00:00:00.000Z",
    });
    expect(row.contract_key).toHaveLength(64);
    expect(row.raw_contract).toEqual(baseSourceRow);
  });

  it("marks unresolved and ambiguous player matches without dropping contracts", () => {
    const [unmatched] = buildNhlscraperContractRows({
      sourceRows: [baseSourceRow],
      players: [],
    });
    const [ambiguous] = buildNhlscraperContractRows({
      sourceRows: [baseSourceRow],
      players: [
        player({ id: 1, team_id: 10 }),
        player({ id: 2, team_id: 11 }),
      ],
    });

    expect(unmatched.player_id).toBeNull();
    expect(unmatched.resolution_status).toBe("unmatched");
    expect(ambiguous.player_id).toBeNull();
    expect(ambiguous.resolution_status).toBe("ambiguous");
    expect(ambiguous.resolution_candidate_count).toBe(2);
  });
});
