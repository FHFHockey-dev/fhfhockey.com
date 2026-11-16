import { describe, expect, it } from "vitest";

import { parseLineupCardFromText } from "./newsLineupCard";
import { readNewsLineupPresentation } from "./newsLineupPresentation";

describe("newsLineupCard", () => {
  it("parses a 12F/6D/2G lineup from quoted tweet text", () => {
    const lineup = parseLineupCardFromText({
      category: "LINE COMBINATION",
      subcategory: "PRACTICE LINES",
      text: `Canadiens Game 7 warmup lines and pairings:
Caufield-Suzuki-Slafkovsky
Gallagher-Newhook-Demidov
Bolduc-Dach-Texier
Evans-Danault-Anderson
Matheson-Carrier
Guhle-Hutson
Struble-Dobson*
Dobes (starter)
Fowler`
    });

    expect(lineup).toEqual({
      forwards: [
        ["Caufield", "Suzuki", "Slafkovsky"],
        ["Gallagher", "Newhook", "Demidov"],
        ["Bolduc", "Dach", "Texier"],
        ["Evans", "Danault", "Anderson"]
      ],
      defensePairs: [
        ["Matheson", "Carrier"],
        ["Guhle", "Hutson"],
        ["Struble", "Dobson"]
      ],
      goalies: ["Dobes", "Fowler"],
      startingGoalie: "Dobes"
    });
  });

  const snapshot = (units: Array<Record<string, unknown>>, interpretation: Record<string, unknown> = {}, binding: Record<string, unknown> = {}) => {
    const roster = units.flatMap((unit) => (unit.players as Array<{ playerId: number; name: string }>).map((player) => `${player.playerId}:${player.name}:${player.name}:7:C`));
    return { newsLineup: { version: 1, binding: { teamId: 7, gameId: null, sourceTweetId: "1", ...binding },
      interpretation: { context: "practice", certainty: "reported", rosterRevision: roster.join("|"), unresolved: [], units, ...interpretation } } };
  };
  const unit = (situation: string, number: number | null, names: string[], extra: Record<string, unknown> = {}) =>
    ({ situation, number, complete: true, players: names.map((name, index) => ({ playerId: number! * 10 + index + 1 || index + 50, name })), ...extra });

  it("never renders public tiles from a stored lineupCard or unbound interpretation units", () => {
    const legacy = readNewsLineupPresentation({ subcategory: "PRACTICE LINES", teamId: 7, metadata: {
      lineupCard: { forwards: [["First", "Second", "Third"]], goalies: ["Goalie"] },
      interpretation: { context: "practice", units: [unit("es_forward", 1, ["Unbound", "Units", "Here"])], unresolved: [] },
    } });
    expect(legacy).toMatchObject({ rows: [], context: "Practice snapshot", notice: "Structured lineup unavailable for this report. See the source report." });
    // The internal review editor still previews the reviewer's own draft card.
    const draft = readNewsLineupPresentation({ reviewDraft: true, metadata: { lineupCard: { forwards: [[], ["First", null, "Third"]], goalies: ["Goalie"] } } });
    expect(draft.rows.map((row) => row.label)).toEqual(["F2", "G1"]);
    expect(readNewsLineupPresentation({ metadata: null })).toMatchObject({ rows: [], notice: "Structured lineup unavailable for this report. See the source report." });
  });

  it("keeps validated PP/PK units with their group, and drops incomplete or flagged units behind a partial notice", () => {
    const lineup = readNewsLineupPresentation({ teamId: 7, metadata: snapshot([
      unit("pp", 2, ["One", "Two", "Three", "Four", "Five"], { group: "A" }),
      unit("pk", 1, ["Six"], { complete: false }),
      unit("es_defense", 3, ["Seven", "Eight"]),
    ], { unresolved: [{ situation: "es_defense", number: 3, reason: "invalid_extraction" }] }) });
    expect(lineup.rows.map((row) => row.label)).toEqual(["PP2"]);
    expect(lineup.rows[0]).toMatchObject({ group: "A", partial: false });
    expect(lineup.notice).toMatch(/^Partial snapshot/);
  });

  it("requires the card's team, roster membership and, for game posts, the snapshot's NHL game", () => {
    const forwards = [unit("es_forward", 1, ["A", "B", "C"])];
    expect(readNewsLineupPresentation({ teamId: 7, metadata: snapshot(forwards) }).rows).toHaveLength(1);
    expect(readNewsLineupPresentation({ teamId: 8, metadata: snapshot(forwards) }).rows).toEqual([]);
    expect(readNewsLineupPresentation({ teamId: 7, metadata: snapshot(forwards, { context: "game" }) }).rows).toEqual([]);
    expect(readNewsLineupPresentation({ teamId: 7, metadata: snapshot(forwards, { context: "game" }, { gameId: 2026020001 }) }).rows).toHaveLength(1);
    expect(readNewsLineupPresentation({ teamId: 7, metadata: snapshot(forwards, { context: "unknown" }, { gameId: 2026020001 }) }).rows).toEqual([]);
    const offRoster = snapshot(forwards);
    (offRoster.newsLineup.interpretation as Record<string, unknown>).rosterRevision = "11:A:A:7:C|12:B:B:7:C|13:C:C:9:C";
    expect(readNewsLineupPresentation({ teamId: 7, metadata: offRoster }).rows).toEqual([]);
  });
});
