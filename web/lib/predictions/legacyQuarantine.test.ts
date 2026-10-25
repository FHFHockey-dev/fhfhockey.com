import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import {
  LEGACY_PREDICTION_ARTIFACTS,
  SKO_NAMED_NON_QUARANTINE_PATHS,
  getLegacyPredictionArtifact
} from "./legacyQuarantine";

const WEB_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const SKIP_DIRS = new Set(["node_modules", ".git", "__tests__", "web"]);
const SKIP_PREFIXES = ["scripts/output", "prep-chef"];
const SOURCE = /\.(tsx?|jsx?|scss|sql)$/;
const TEST = /\.test\.[jt]sx?$/;

/** Every non-test source file whose path names sKO or whose header declares it legacy sKO-only. */
function skoFiles(dir = WEB_ROOT, found: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const full = path.join(dir, name);
    const relative = path.relative(WEB_ROOT, full).split(path.sep).join("/");
    if (statSync(full).isDirectory()) {
      if (!SKIP_DIRS.has(name) && !name.startsWith(".next") && !SKIP_PREFIXES.includes(relative)) skoFiles(full, found);
      continue;
    }
    if (!SOURCE.test(name) || TEST.test(name)) continue;
    const header = /\.(tsx?|jsx?)$/.test(name) ? readFileSync(full, "utf8").slice(0, 800) : "";
    if (/sko/i.test(relative) || /Legacy sKO-only/.test(header)) found.push(`web/${relative}`);
  }
  return found;
}

const registered = LEGACY_PREDICTION_ARTIFACTS.flatMap((artifact) => artifact.paths);
const excluded = (file: string) => Object.keys(SKO_NAMED_NON_QUARANTINE_PATHS)
  .some((entry) => (entry.endsWith("/") ? file.startsWith(entry) : file === entry));

describe("legacy prediction artifact quarantine", () => {
  it("keeps sKO quarantined until it has real model evidence", () => {
    const sko = getLegacyPredictionArtifact("sko_predictions");

    expect(sko).toMatchObject({
      disposition: "quarantined"
    });
    expect(sko?.promotionRequirement).toMatch(/feature importances/);
    expect(getLegacyPredictionArtifact("sko_reader_ui_bundle")?.paths).toContain(
      "web/lib/hooks/useQuarantinedPredictionsSko.ts"
    );
    expect(registered).not.toContain("web/lib/hooks/usePredictionsSko.ts");
    expect(LEGACY_PREDICTION_ARTIFACTS.every((artifact) => artifact.paths.length > 0)).toBe(
      true
    );
  });

  it("registers every sKO bundle file exactly once, and every registered path exists", () => {
    expect(new Set(registered).size).toBe(registered.length);
    const missing = registered.filter((file) => !existsSync(path.join(WEB_ROOT, "..", file)));
    expect(missing).toEqual([]);
    const unregistered = skoFiles().filter((file) => !registered.includes(file) && !excluded(file));
    expect(unregistered).toEqual([]);
  });

  it("records the historical-only owner disposition for the reader, formula and route groups", () => {
    for (const id of ["sko_reader_ui_bundle", "sko_legacy_formula_family", "sko_charts_route"]) {
      expect(getLegacyPredictionArtifact(id)).toMatchObject({
        disposition: "quarantined",
        historicalOnly: { decidedAt: "2026-07-28", record: "tasks/TASKS/sko-charts/sko-ownership-contract.md" }
      });
    }
  });

  it("keeps explicit non-quarantine exclusions real and disjoint from the registry", () => {
    for (const entry of Object.keys(SKO_NAMED_NON_QUARANTINE_PATHS)) {
      expect(existsSync(path.join(WEB_ROOT, "..", entry)), entry).toBe(true);
      expect(registered.some((file) => (entry.endsWith("/") ? file.startsWith(entry) : file === entry))).toBe(false);
    }
  });
});
