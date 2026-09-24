import { describe, expect, it } from "vitest";

import { fantraxPlayerName, matchFantraxPlayerIds, normalizeName } from "./playerIdentity";

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
const aliases = [
  { fhfh_player_id: 10, normalized_alias: "noah dobson" },
  { fhfh_player_id: 20, normalized_alias: "nikolaj ehlers" },
];

describe("Fantrax player identity matching", () => {
  it("maps only unique exact name, NHL team, and position matches", () => {
    expect(fantraxPlayerName(catalog["fx-1"])).toBe("Noah Dobson");
    expect([...matchFantraxPlayerIds(Object.keys(catalog), catalog, teams, identities, aliases)])
      .toEqual([["fx-1", identities[0]], ["fx-2", identities[1]]]);
  });

  it("uses a unique verified alias when team and position differ, including accents", () => {
    const player = { fantraxId: "fx-4", name: "Slafkovsky, Juraj", team: "MTL", position: "RW" };
    const identity = { id: 30, canonical_name: "Juraj Slafkovský", canonical_position: "L",
      current_nhl_team_id: 1, nhl_player_id: 303 };
    expect(normalizeName(identity.canonical_name)).toBe("juraj slafkovsky");
    expect([...matchFantraxPlayerIds(["fx-4"], { "fx-4": player }, teams, [identity],
      [{ fhfh_player_id: 30, normalized_alias: "juraj slafkovsky" }])])
      .toEqual([["fx-4", identity]]);
    expect(matchFantraxPlayerIds(["fx-1"], catalog, teams,
      [{ ...identities[0], current_nhl_team_id: 2, canonical_position: "C" }], aliases).size).toBe(1);
  });

  it("leaves missing, ambiguous, and conflicting identities unresolved", () => {
    const duplicate = { ...identities[0], id: 11 };
    const duplicateAliases = [...aliases, { fhfh_player_id: 11, normalized_alias: "noah dobson" }];
    expect(matchFantraxPlayerIds(["fx-1"], catalog, teams, [...identities, duplicate], duplicateAliases).size).toBe(0);
    expect(matchFantraxPlayerIds(["fx-1"], catalog, teams, [{ ...identities[0], nhl_player_id: null }], aliases).size).toBe(0);
    expect(matchFantraxPlayerIds(["fx-1"], { "fx-1": { ...catalog["fx-1"], fantraxId: "different" } }, teams, identities, aliases).size).toBe(0);
    expect(matchFantraxPlayerIds(["fx-1", "fx-4"], {
      ...catalog, "fx-4": { ...catalog["fx-1"], fantraxId: "fx-4" },
    }, teams, identities, aliases).size).toBe(0);
    expect(matchFantraxPlayerIds(["fx-3"], catalog, teams, identities, aliases).size).toBe(0);
  });
});
