import { describe, expect, it } from "vitest";

import { fantraxPlayerName, matchFantraxPlayerIds } from "./playerIdentity";

const catalog = {
  "fx-1": { fantraxId: "fx-1", name: "Dobson, Noah", team: "MTL", position: "D" },
  "fx-2": { fantraxId: "fx-2", name: "Ehlers, Nikolaj", team: "CAR", position: "LW" },
  "fx-3": { fantraxId: "fx-3", name: "Unknown, Player", team: "(N/A)", position: "C" },
};
const teams = [{ id: 1, abbreviation: "MTL" }, { id: 2, abbreviation: "CAR" }];
const identities = [
  { id: 10, canonical_name: "Noah Dobson", canonical_position: "D", current_nhl_team_id: 1, nhl_player_id: 101 },
  { id: 20, canonical_name: "Nikolaj Ehlers", canonical_position: "L", current_nhl_team_id: 2, nhl_player_id: 202 },
];

describe("Fantrax player identity matching", () => {
  it("maps only unique exact name, NHL team, and position matches", () => {
    expect(fantraxPlayerName(catalog["fx-1"])).toBe("Noah Dobson");
    expect([...matchFantraxPlayerIds(Object.keys(catalog), catalog, teams, identities)])
      .toEqual([["fx-1", identities[0]], ["fx-2", identities[1]]]);
  });

  it("leaves missing, ambiguous, and conflicting identities unresolved", () => {
    const duplicate = { ...identities[0], id: 11 };
    expect(matchFantraxPlayerIds(["fx-1"], catalog, teams, [...identities, duplicate]).size).toBe(0);
    expect(matchFantraxPlayerIds(["fx-1"], catalog, teams, [{ ...identities[0], current_nhl_team_id: 2 }]).size).toBe(0);
    expect(matchFantraxPlayerIds(["fx-1"], catalog, teams, [{ ...identities[0], canonical_position: "C" }]).size).toBe(0);
    expect(matchFantraxPlayerIds(["fx-1"], catalog, teams, [{ ...identities[0], nhl_player_id: null }]).size).toBe(0);
    expect(matchFantraxPlayerIds(["fx-1"], { "fx-1": { ...catalog["fx-1"], fantraxId: "different" } }, teams, identities).size).toBe(0);
    expect(matchFantraxPlayerIds(["fx-1", "fx-4"], {
      ...catalog, "fx-4": { ...catalog["fx-1"], fantraxId: "fx-4" },
    }, teams, identities).size).toBe(0);
  });
});
