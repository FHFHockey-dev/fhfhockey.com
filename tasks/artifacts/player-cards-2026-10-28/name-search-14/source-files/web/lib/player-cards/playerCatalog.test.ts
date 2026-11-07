import { expect, it } from "vitest";
import { PLAYER_CATALOG, PLAYER_CATALOG_DATE, PLAYER_CATALOG_SOURCE_SHA256, PLAYER_LOOKUP_LIMIT, searchPlayerCatalog } from "./playerCatalog";
it("keeps the dated identity catalog complete, unique by NHL ID and separate from statistics", () => {
  expect(PLAYER_CATALOG).toHaveLength(805); expect(new Set(PLAYER_CATALOG.map(row => row.id)).size).toBe(805);
  expect(PLAYER_CATALOG_DATE).toBe("2026-10-24"); expect(PLAYER_CATALOG_SOURCE_SHA256).toBe("4cac57ecdbee629bd82b017a624ecbbe342aa9b43b450588b84dad506c2ad43c");
  expect(PLAYER_CATALOG.every(row => Number.isInteger(row.id) && row.name && row.team && Object.keys(row).length === 4)).toBe(true);
});
it("resolves accent-insensitive names, multi-token names/teams and exact IDs without substituting identity", () => {
  expect(searchPlayerCatalog("stutzle").matches).toContainEqual({ id: 8482116, name: "Tim Stützle", team: "OTT", position: "C" });
  expect(searchPlayerCatalog("  nikita TBL  ").matches).toEqual([{ id: 8476453, name: "Nikita Kucherov", team: "TBL", position: "R" }]);
  expect(searchPlayerCatalog("8476453").matches).toEqual(searchPlayerCatalog("Kucherov").matches);
});
it("retains both same-name players as distinct choices and bounds broad results", () => {
  const result = searchPlayerCatalog("Elias Pettersson"); expect(result.total).toBe(2); expect(new Set(result.matches.map(row => row.id)).size).toBe(2);
  expect(new Set(result.matches.map(row => row.position))).toEqual(new Set(["C", "D"]));
  const broad = searchPlayerCatalog("an"); expect(broad.total).toBeGreaterThan(PLAYER_LOOKUP_LIMIT); expect(broad.matches).toHaveLength(PLAYER_LOOKUP_LIMIT);
});
it("returns honest empty/short results and keeps unsupported goalies identifiable", () => {
  for (const query of ["", " ", "n", "<script>nothing-matches</script>", "zzzzzzzz"]) expect(searchPlayerCatalog(query).matches).toEqual([]);
  expect(searchPlayerCatalog("Vasilevskiy").matches[0]).toMatchObject({ position: "G", team: "TBL" });
});
