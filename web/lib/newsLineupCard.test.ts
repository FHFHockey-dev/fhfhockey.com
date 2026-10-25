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

  it("keeps partial legacy rows at their supplied line numbers without filling goalies or inferring a starter", () => {
    const lineup = readNewsLineupPresentation({ subcategory: "PRACTICE LINES", metadata: {
      lineupCard: { forwards: [[], ["First", null, "Third"]], defensePairs: [["Defense"]], goalies: ["Goalie"] },
    } });
    expect(lineup.context).toBe("Practice snapshot");
    expect(lineup.rows.map((row) => row.label)).toEqual(["F2", "D1", "G1"]);
    expect(lineup.rows[0].players).toEqual(["First", null, "Third"]);
    expect(lineup.startingGoalie).toBeNull();
    expect(lineup.notice).toContain("Partial snapshot");
  });

  it("uses retained PP/PK units, group and game context instead of a conflicting legacy ES card", () => {
    const lineup = readNewsLineupPresentation({ metadata: {
      interpretation: { context: "game", units: [
        { situation: "pp", number: 2, group: "A", complete: true, players: ["One", "Two", "Three", "Four", "Five"].map((name) => ({ name })) },
        { situation: "pk", number: null, complete: false, players: [{ name: "Six" }] },
      ], unresolved: [{ reason: "missing_player" }] },
      lineupCard: { forwards: [["Unrelated legacy name"]] },
    } });
    expect(lineup.context).toBe("Game snapshot");
    expect(lineup.rows.map((row) => row.label)).toEqual(["PP2", "PK"]);
    expect(lineup.rows[0].players).toHaveLength(5);
    expect(lineup.rows[0].group).toBe("A");
    expect(lineup.notice).toContain("unresolved");
    expect(JSON.stringify(lineup)).not.toContain("Unrelated");
  });

  it("does not promote excluded units or fall back to legacy data when interpretation is unresolved", () => {
    const lineup = readNewsLineupPresentation({ metadata: {
      interpretation: { units: [], excludedUnits: [{ players: [{ name: "Excluded" }] }], unresolved: [{ reason: "ambiguous" }] },
      lineupCard: { forwards: [["Legacy"]] },
    } });
    expect(lineup.rows).toEqual([]);
    expect(lineup.notice).toContain("unresolved");
  });

  it("reports the exact legacy special-teams data gap and missing snapshot", () => {
    expect(readNewsLineupPresentation({ subcategory: "POWER PLAY", metadata: {
      lineupCard: { forwards: [["Not an ES line"]] },
    } })).toMatchObject({ rows: [], notice: "Structured special-teams units unavailable for this report." });
    expect(readNewsLineupPresentation({ metadata: null })).toMatchObject({ rows: [], notice: "Structured lineup unavailable for this report." });
  });
});
