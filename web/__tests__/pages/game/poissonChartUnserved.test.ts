import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

// Owner decision 44: the game-page Poisson chart stays unserved until it is
// grounded in a qualified game model. Guard against it being rendered.
describe("/game/[gameId] Poisson chart", () => {
  it("is not rendered", () => {
    const page = readFileSync(
      path.join(process.cwd(), "pages/game/[gameId].tsx"),
      "utf8",
    );
    expect(page).not.toMatch(/<PoissonDistributionChart\b/);
    expect(page).not.toMatch(/createElement\(\s*PoissonDistributionChart/);
  });
});
