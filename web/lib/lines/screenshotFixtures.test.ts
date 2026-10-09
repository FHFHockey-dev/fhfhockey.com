import { describe, expect, it } from "vitest";
import { claimsFromReport } from "./sourceClaims";
import { fixtureGame, fixtureUnit } from "./testFixtures";
import type { ProjectionReport } from "lib/sources/projectedLineups";
import { reconcileEntry, reconcilePP } from "./reconcile";

// Parent pixel-reviewed transcriptions. Synthetic player IDs; no original IDs or offset claims.
const rosterNames = ["Mikheyev", "Point", "Kucherov", "Hagel", "Cirelli", "Guentzel", "Viel", "Girgensons", "Holmberg", "Goncalves", "Harkins", "Geekie", "Moser", "Carlson", "McDonagh", "Cernak", "Hedman", "D'Astous", "Vasilevskiy", "Hildeby"];
const unit = (names: string[], situation: Parameters<typeof fixtureUnit>[1], number: number) => ({ ...fixtureUnit(names, situation, number), players: names.map((name) => ({ playerId: rosterNames.indexOf(name) + 1, name })) });
const base: ProjectionReport = { key: "screenshot:encina:warmup", teamId: 14, teamAbbreviation: "TBL", gameId: null, session: null, date: "2026-10-01", publishedAt: null, originalPublishedAt: null, receivedAt: "2026-10-02T13:00:00Z", interpretedAt: "2026-10-02T13:05:00Z", originalUrl: null,
  text: "Tampa at NYR. Warmup lines\nMikheyev-Point-Kucherv\nHagel-Cirelli-Guentzel\nViel-Girgensons-Holmberg\nGoncalves-Harkins-Geekie\nMoser-Carlson\nMcDonagh-Cernak\nHedman-D'Astous\nVasilevskiy/Hildeby",
  interpretation: { version: "parent-transcription-fixture", context: "game", certainty: "reported", unresolved: [], units: [
    unit(["Mikheyev", "Point", "Kucherov"], "es_forward", 1), unit(["Hagel", "Cirelli", "Guentzel"], "es_forward", 2), unit(["Viel", "Girgensons", "Holmberg"], "es_forward", 3), unit(["Goncalves", "Harkins", "Geekie"], "es_forward", 4),
    unit(["Moser", "Carlson"], "es_defense", 1), unit(["McDonagh", "Cernak"], "es_defense", 2), unit(["Hedman", "D'Astous"], "es_defense", 3), unit(["Vasilevskiy", "Hildeby"], "goalie", 1),
  ] } };
base.interpretation.units[0]!.evidence[2]!.text = "Kucherv";
describe("parent-reviewed screenshot fixtures", () => {
  it("preserves all described units, the raw typo and listed goalie order without inventing timestamps", () => {
    const claims = claimsFromReport(base, [fixtureGame], { rawDisplay: "6:34 PM Oct 1 2026", author: "Encina" });
    expect(claims.filter((claim) => claim.unit?.situation === "es_forward")).toHaveLength(4);
    expect(claims.filter((claim) => claim.unit?.situation === "es_defense")).toHaveLength(3);
    expect(claims[0]!.unit!.evidence[2]!.text).toBe("Kucherv");
    expect(claims.find((claim) => claim.unit?.situation === "goalie")!.unit!.players.map((player) => player.name)).toEqual(["Vasilevskiy", "Hildeby"]);
    expect(claims.every((claim) => claim.confirmationEvidence.length === 0 && claim.time.originalPublishedAt == null)).toBe(true);
    expect(reconcileEntry({ game: fixtureGame, teamId: 14, claims, now: "2026-10-02T13:05:00Z", previous: null }).units).toHaveLength(0);
  });
  it("preserves independent PP authors and penalty context; transcription alone cannot establish carry-forward", () => {
    const pp1 = { ...base, key: "screenshot:erlendsson:pp1", text: "PP1: Carlson-Point-Kucherov-Guentzel-Hagel", interpretation: { ...base.interpretation, units: [unit(["Carlson", "Point", "Kucherov", "Guentzel", "Hagel"], "pp", 1)] } };
    const pp2 = { ...base, key: "screenshot:loux:pp2", text: "Holding penalty. PP2: D'Astous-Geekie-Holmberg-Cirelli-Goncalves", interpretation: { ...base.interpretation, units: [unit(["D'Astous", "Geekie", "Holmberg", "Cirelli", "Goncalves"], "pp", 2)] } };
    const claims = [...claimsFromReport(pp1, [fixtureGame], { author: "Erik Erlendsson", rawDisplay: "7:33 PM", phase: "in_game" }), ...claimsFromReport(pp2, [fixtureGame], { author: "Diandra Loux", rawDisplay: "7:36 PM", phase: "in_game" })];
    expect(claims.map((claim) => claim.author)).toEqual(["Erik Erlendsson", "Diandra Loux"]);
    expect(claims[1]!.text).toContain("Holding penalty");
    expect(reconcilePP({ game: fixtureGame, teamId: 14, games: [fixtureGame], claims, now: "2026-10-02T13:05:00Z", carryForward: true }).every((decision) => decision.selection == null)).toBe(true);
  });
});
