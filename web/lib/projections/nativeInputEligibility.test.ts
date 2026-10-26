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

  it("keeps every FORGE module free of the draft dashboard's fantasy projection config and tables", () => {
    // TJ, 2026-10-26: FORGE must not use the draft dashboard's fantasy projection tables at all.
    const files = (function list(dir: string): string[] {
      return readdirSync(path.join(root, dir), { withFileTypes: true }).flatMap(entry => entry.isDirectory()
        ? list(path.join(dir, entry.name))
        : /\.tsx?$/.test(entry.name) && !/\.test\.tsx?$/.test(entry.name) ? [path.join(dir, entry.name)] : []);
    })(".");
    const offenders: string[] = [];
    for (const file of files) {
      visit(sourceFile(file), node => {
        if (ts.isStringLiteralLike(node) && /projectionsConfig\/projectionSourcesConfig|fantasy-projections\/contracts|draftDashboard\/|^PROJECTIONS_|^(?:ag|blake_ag|nate_ag|cullen|dtz|5v5)_(?:skaters|goalies)$/i.test(node.text))
          offenders.push(`${file}: ${node.text}`);
        if (ts.isIdentifier(node) && ["PROJECTION_SOURCES_CONFIG", "FANTASY_PROJECTION_SEASON_ID"].includes(node.text))
          offenders.push(`${file}: ${node.text}`);
      });
    }
    expect(files.length).toBeGreaterThan(50);
    expect(offenders).toEqual([]);
    // Both stages call the history-only prior: no fantasy switch argument remains.
    for (const file of ["stages/skater-stage.ts", "stages/goalie-stage.ts"]) {
      let calls = 0;
      visit(sourceFile(file), node => {
        if (!ts.isCallExpression(node) || !ts.isIdentifier(node.expression) || node.expression.text !== "loadSeasonBootstrap") return;
        calls += 1;
        expect(node.arguments).toHaveLength(4);
      });
      expect(calls).toBe(file.includes("skater") ? 2 : 1);
    }
  });

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
    "loads only native %s appearance history, and no fantasy projection table, in the current season",
    async population => {
      database.history = [{ playerId: 7, gameId: 2025020001, goals: 1, assists: 2, shots: 4,
        hits: 3, blockedShots: 1, toi: "20:00", powerPlayToi: "02:00", powerPlayGoals: 1,
        powerPlayPoints: 1, saveShotsAgainst: "28/30", goalsAgainst: 2,
        games: { id: 2025020001, date: "2026-04-01", seasonId: 20252026, type: 2 } }];
      const prior = (await loadSeasonBootstrap([7], 20262027, "2026-10-07", population)).get(7)!;
      expect(database.tables).toEqual([population === "skater" ? "skatersGameStats" : "goaliesGameStats"]);
      expect(database.tables.filter(table => /^projections_/i.test(table))).toEqual([]);
      expect(prior).toMatchObject({ historyGames: 1, currentSeasonGames: 0 });
      expect(Object.keys(prior).sort()).toEqual(["currentSeasonGames", "historyGames", "limitations", "previous"]);
      expect(prior.limitations.join(" ")).not.toMatch(/fantasy|public projection/i);
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
    const prior = (await loadSeasonBootstrap([7], 20262027, "2026-10-07", "skater")).get(7)!;
    expect(prior).toMatchObject({ previous: {}, historyGames: 0 });
    expect(blendSeasonBootstrap({ GOALS: 0.4 }, prior).disclosure).toMatchObject({ fantasyWeight: 0, sourceIds: [] });
    expect(blendSeasonBootstrap({}, prior).stats).toEqual({});
    expect(blendSeasonBootstrap({ GOALS: 0.4, HITS: null }, prior).stats).toEqual({ GOALS: 0.4, HITS: null });
    expect(database.tables).toEqual(["skatersGameStats"]);
  });
});
