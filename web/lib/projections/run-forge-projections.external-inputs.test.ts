import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import ts from "typescript";
import { describe, expect, it, vi } from "vitest";

vi.mock("lib/supabase/server", () => ({ default: {} }));

import { PROJECTION_SOURCES_CONFIG } from "lib/projectionsConfig/projectionSourcesConfig";
import type { ProjectionInputRead } from "./inputCapture";
import { FORGE_AUDITED_INPUT_SOURCES, isFantasyProjectionSource, readsExcludeExternalFantasy } from "./run-forge-projections";

// tasks/artifacts/rso-wave2-2026-10-25/FORGE-QUAL/EXTERNAL-INPUT-AUDIT.md: the run's write targets, which never appear
// as captured reads, and the non-literal query sites the audit traced by hand.
const RUN_WRITE_TARGETS = ["player_prediction_outputs", "game_prediction_outputs", "model_market_flags_daily",
  "publish_forge_game_revisions", "begin_forge_game_run", "begin_forge_local_run"];
const AUDITED_DYNAMIC_SITES = [
  "lib/projections/dailyBoardEvidence.ts table",
  "lib/projections/queries/run-lifecycle-queries.ts table",
  "lib/projections/queries/skater-queries.ts LATEST_ROLLING_ROWS_RPC",
  "lib/projections/queries/skater-queries.ts ROLLING_PLAYER_SUPPORT_PAYLOAD_TABLE",
  "lib/projections/seasonBootstrap.ts population === \"skater\" ? \"skatersGameStats\" : \"goaliesGameStats\"",
];

const read = (method: "from" | "rpc", name: string, failure?: string): ProjectionInputRead =>
  ({ request: [{ method, args: [name] }, { method: "select", args: ["*"] }], result: failure ? null : { data: [], error: null },
    receivedAt: "2026-10-26T12:00:00.000Z", ...(failure ? { failure } : {}) });

/** Every `.from()` / `.rpc()` query reachable through value imports from the live runner. */
function runQuerySites() {
  const root = process.cwd(), files = new Set<string>(), literals = new Map<string, string[]>(), dynamic = new Set<string>();
  const evidenceTables: string[] = [];
  const resolve = (from: string, spec: string) => {
    const base = spec.startsWith("lib/") ? path.join(root, spec) : spec.startsWith(".") ? path.resolve(path.dirname(from), spec) : null;
    return base ? [`${base}.ts`, `${base}.tsx`, path.join(base, "index.ts")].find(existsSync) ?? null : null;
  };
  const visit = (file: string) => {
    if (files.has(file)) return;
    files.add(file);
    const source = ts.createSourceFile(file, readFileSync(file, "utf8"), ts.ScriptTarget.Latest, true);
    const relative = path.relative(root, file);
    const walk = (node: ts.Node) => {
      if ((ts.isImportDeclaration(node) && !node.importClause?.isTypeOnly || ts.isExportDeclaration(node))
        && node.moduleSpecifier && ts.isStringLiteral(node.moduleSpecifier)) {
        const target = resolve(file, node.moduleSpecifier.text);
        if (target) visit(target);
      }
      if (ts.isCallExpression(node) && ts.isPropertyAccessExpression(node.expression) && ["from", "rpc"].includes(node.expression.name.text)
        && node.arguments.length && !["Array", "Object"].includes(node.expression.expression.getText(source))) {
        let argument: ts.Expression = node.arguments[0];
        while (ts.isAsExpression(argument) || ts.isParenthesizedExpression(argument)) argument = argument.expression;
        if (ts.isStringLiteralLike(argument)) literals.set(argument.text, [...(literals.get(argument.text) ?? []), relative]);
        else dynamic.add(`${relative} ${argument.getText(source)}`);
      }
      // dailyBoardEvidence reads its tables through a local `read(table, ...)` helper.
      if (relative.endsWith("dailyBoardEvidence.ts") && ts.isCallExpression(node) && ts.isIdentifier(node.expression)
        && node.expression.text === "read" && node.arguments[0] && ts.isStringLiteralLike(node.arguments[0])) evidenceTables.push(node.arguments[0].text);
      ts.forEachChild(node, walk);
    };
    walk(source);
  };
  visit(path.join(root, "lib/projections/run-forge-projections.ts"));
  return { files, literals, dynamic, evidenceTables };
}

describe("FORGE external fantasy input claim", () => {
  it("claims the exclusion only when every captured read is an audited non-fantasy source", () => {
    expect(readsExcludeExternalFantasy([read("from", "games"), read("from", "wgo_skater_stats"), read("rpc", "forge_latest_rolling_rows"),
      read("from", "skatersGameStats")])).toBe(true);
    expect(readsExcludeExternalFantasy([])).toBe(false);
  });

  it.each(PROJECTION_SOURCES_CONFIG.map(source => source.tableName))("a read of %s forces the claim off, even a failed one", table => {
    expect(isFantasyProjectionSource(table)).toBe(true);
    expect(FORGE_AUDITED_INPUT_SOURCES.has(table)).toBe(false);
    expect(readsExcludeExternalFantasy([read("from", "games"), read("from", table)])).toBe(false);
    expect(readsExcludeExternalFantasy([read("from", "games"), read("from", table, "relation does not exist")])).toBe(false);
  });

  it("treats a new fantasy projection table and any unaudited source as not excluded", () => {
    expect(isFantasyProjectionSource("PROJECTIONS_20272028_NEW_SKATERS")).toBe(true);
    expect(readsExcludeExternalFantasy([read("from", "games"), read("from", "PROJECTIONS_20272028_NEW_SKATERS")])).toBe(false);
    expect(readsExcludeExternalFantasy([read("from", "games"), read("from", "yahoo_player_ownership_daily")])).toBe(false);
    expect(readsExcludeExternalFantasy([read("from", "games"), read("rpc", "some_new_rpc")])).toBe(false);
  });

  it("audits every source the run's code can read: a new table, RPC or dynamic query site fails here", () => {
    const { files, literals, dynamic, evidenceTables } = runQuerySites();
    expect(files.size).toBeGreaterThan(20);
    const unaudited = [...literals].filter(([name]) => !FORGE_AUDITED_INPUT_SOURCES.has(name) && !RUN_WRITE_TARGETS.includes(name));
    expect(unaudited, "add the source to EXTERNAL-INPUT-AUDIT.md and FORGE_AUDITED_INPUT_SOURCES, or keep it out of the run").toEqual([]);
    expect([...literals.keys()].filter(isFantasyProjectionSource)).toEqual([]);
    expect([...dynamic].sort()).toEqual([...AUDITED_DYNAMIC_SITES].sort());
    expect(evidenceTables.length).toBeGreaterThan(0);
    expect(evidenceTables.filter(table => !FORGE_AUDITED_INPUT_SOURCES.has(table))).toEqual([]);
    for (const name of ["skatersGameStats", "goaliesGameStats", "forge_latest_rolling_rows", "rolling_player_metric_support_payloads"])
      expect(FORGE_AUDITED_INPUT_SOURCES.has(name)).toBe(true);
  });

  it("derives the live snapshot's claim from its own captured reads, never from configuration", () => {
    const source = ts.createSourceFile("run-forge-projections.ts",
      readFileSync(path.join(process.cwd(), "lib/projections/run-forge-projections.ts"), "utf8"), ts.ScriptTarget.Latest, true);
    const calls: string[] = [];
    const walk = (node: ts.Node) => {
      if (ts.isCallExpression(node) && ts.isIdentifier(node.expression) && node.expression.text === "buildForgeInputProvenance")
        calls.push(node.arguments.map(argument => argument.getText(source)).join(","));
      ts.forEachChild(node, walk);
    };
    walk(source);
    // The live snapshot claims from its reads. The never-published reconstruction and the run-start metrics, written
    // before any read, never claim.
    expect(calls.filter(args => args === "externalFantasyClaim(capture.reads)")).toHaveLength(1);
    expect(calls.filter(args => args === "")).toHaveLength(2);
    expect(calls).toHaveLength(3);
  });
});
