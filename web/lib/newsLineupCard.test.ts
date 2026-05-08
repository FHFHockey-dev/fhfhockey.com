import { describe, expect, it } from "vitest";

import { parseLineupCardFromText } from "./newsLineupCard";

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
});
