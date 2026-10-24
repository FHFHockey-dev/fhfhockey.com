import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import ts from "typescript";
import { beforeEach, describe, expect, it, vi } from "vitest";

const database = vi.hoisted(() => ({ history: [] as Record<string, unknown>[], tables: [] as string[] }));
vi.mock("lib/supabase/server", () => ({ default: {
  from(table: string) {
    database.tables.push(table);
    // Any provider read, including a newly configured/renamed source, fails offline.
    if (!["skatersGameStats", "goaliesGameStats"].includes(table)) {
      throw new Error(`External projection input is forbidden: ${table}`);
    }
    const query = {
      select: () => query, in: () => query, eq: () => query,
      lt: () => query, order: () => query,
      range: async () => ({ data: database.history, error: null }),
    };
    return query;
  },
} }));

import { blendSeasonBootstrap, bootstrapGoalieLine, bootstrapSkaterLine, loadSeasonBootstrap } from "./seasonBootstrap";

const root = path.resolve(process.cwd(), "lib/projections");
function sourceFile(file: string) {
  return ts.createSourceFile(file, readFileSync(path.join(root, file), "utf8"), ts.ScriptTarget.Latest, true);
}
function visit(node: ts.Node, check: (node: ts.Node) => void) {
  check(node);
  ts.forEachChild(node, child => visit(child, check));
}

describe("FORGE native input boundary", () => {
  beforeEach(() => { database.history = []; database.tables = []; });

  it.each([["stages/skater-stage.ts", ts.SyntaxKind.TrueKeyword], ["stages/goalie-stage.ts", ts.SyntaxKind.FalseKeyword]] as const)(
    "%s preserves the selected Release C bootstrap policy",
    (file, expectedPolicy) => {
      let calls = 0;
      visit(sourceFile(file), node => {
        if (!ts.isCallExpression(node) || !ts.isIdentifier(node.expression)
          || node.expression.text !== "loadSeasonBootstrap") return;
        calls += 1;
        expect(node.arguments.length).toBe(5);
        // Release C skaters retain legacy inputs and must not claim native exclusion.
        // The actual producer-to-native-consumer rejection is checked by the offline qualification suite.
        expect(node.arguments[4].kind).toBe(expectedPolicy);
      });
      expect(calls).toBe(file.includes("skater") ? 2 : 1);
    },
  );

  it("keeps native inference, priors, calibration and model selection free of provider imports and table references", () => {
    // Bounded core: the shared seasonBootstrap bridge is tested dynamically below.
    // Comparison pages and downstream consumers have separate owners/contracts.
    const files = ["run-forge-projections.ts", "goalieModel.ts", "calibrationEligibility.ts", "promotionGates.ts",
      ...["stages", "queries", "calculators"].flatMap(dir => readdirSync(path.join(root, dir))
        .filter(file => file.endsWith(".ts") && !file.endsWith(".test.ts")).map(file => `${dir}/${file}`))];
    for (const file of files) {
      visit(sourceFile(file), node => {
        if (!ts.isStringLiteralLike(node)) return;
        expect(node.text, `${file}: external projection dependency`).not.toMatch(
          /(?:projectionsConfig|fantasy-projections|draftDashboard)\/|player-forecasts\/(?:baseline|goalieBaseline)|^PROJECTIONS_|^(?:ag|cullen|dtz)_(?:skaters|goalies)$/i,
        );
      });
    }
  });

  it.each(["skater", "goalie"] as const)(
    "loads only native %s appearance history in the configured fantasy season",
    async population => {
      database.history = [{ playerId: 7, gameId: 2025020001, goals: 1, assists: 2, shots: 4,
        hits: 3, blockedShots: 1, toi: "20:00", powerPlayToi: "02:00", powerPlayGoals: 1,
        powerPlayPoints: 1, saveShotsAgainst: "28/30", goalsAgainst: 2,
        games: { id: 2025020001, date: "2026-04-01", seasonId: 20252026, type: 2 } }];
      const prior = (await loadSeasonBootstrap([7], 20262027, "2026-10-07", population, false)).get(7)!;
      expect(database.tables).toEqual([population === "skater" ? "skatersGameStats" : "goaliesGameStats"]);
      expect(prior).toMatchObject({ historyGames: 1, currentSeasonGames: 0, fantasy: {}, sourceIds: [], sourceRowIds: [] });
      if (population === "skater") {
        expect(prior.previous).toMatchObject({ GOALS: 1, ASSISTS: 2, SHOTS_ON_GOAL: 4 });
        const line = bootstrapSkaterLine({ goalsEs: 0.3, goalsPp: 0.1, assistsEs: 0.5, assistsPp: 0.1,
          shotsEs: 2, shotsPp: 1, hits: 1, blocks: 1 }, prior, { goals: 1, assists: 1, shots: 1, ppUsage: 1 });
        expect(line.goalsEs + line.goalsPp).toBeCloseTo(1);
        expect(line.assistsEs + line.assistsPp).toBeCloseTo(2);
      } else {
        expect(prior.previous).toEqual({ SAVES_GOALIE: 28, GOALS_AGAINST_GOALIE: 2, SHOTS_AGAINST_GOALIE: 30 });
        expect(bootstrapGoalieLine({ SHOTS_AGAINST_GOALIE: 30 }, prior).stats).toEqual(prior.previous);
      }
    },
  );

  it("leaves missing history and categories missing instead of reading provider fallbacks or inventing priors", async () => {
    const prior = (await loadSeasonBootstrap([7], 20262027, "2026-10-07", "skater", false)).get(7)!;
    expect(prior).toMatchObject({ previous: {}, fantasy: {}, historyGames: 0, sourceIds: [], sourceRowIds: [] });
    expect(blendSeasonBootstrap({}, prior).stats).toEqual({});
    expect(blendSeasonBootstrap({ GOALS: 0.4, HITS: null }, prior).stats).toEqual({ GOALS: 0.4, HITS: null });
    expect(database.tables).toEqual(["skatersGameStats"]);
  });
});
