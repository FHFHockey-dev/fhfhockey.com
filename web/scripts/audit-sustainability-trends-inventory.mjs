import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, extname, join, relative, resolve } from "node:path";

const repoRoot = execFileSync("git", ["rev-parse", "--show-toplevel"], {
  encoding: "utf8",
}).trim();
const outputPath = join(
  repoRoot,
  "tasks/TASKS/three-pillars-analytics/sustainability/sustainability-trends-inventory.json",
);
const webRoot = join(repoRoot, "web");

const trackedPaths = execFileSync(
  "git",
  ["ls-files", "-z", "--", "web", "functions", "supabase"],
  { cwd: repoRoot, encoding: "utf8", maxBuffer: 64 * 1024 * 1024 },
)
  .split("\0")
  .filter(Boolean)
  .sort();
const tracked = new Set(trackedPaths);

const explicitSeeds = new Set([
  "web/pages/trendsSandbox.tsx",
  "web/pages/trendsTestingGrounds.tsx",
  "web/pages/trends/index.tsx",
  "web/pages/FORGE.tsx",
  "web/pages/underlying-stats/index.tsx",
  "web/pages/trends/placeholder.tsx",
  "web/pages/start-chart.tsx",
  "web/pages/trends/player/[playerId].tsx",
  "web/pages/stats/player/[playerId].tsx",
  "web/pages/projections/index.tsx",
  "web/pages/api/v1/trends/player-trends.ts",
  "web/pages/api/v1/trends/skater-power.ts",
  "web/pages/api/v1/trends/team-power.ts",
  "web/pages/api/v1/trends/team-ctpi.ts",
  "web/pages/api/v1/trends/team-sos.ts",
  "web/pages/api/v1/sustainability/trends.ts",
  "web/pages/api/v1/sustainability/trend-bands.ts",
  "web/pages/api/v1/sustainability/rebuild-priors.ts",
  "web/pages/api/v1/sustainability/rebuild-window-z.ts",
  "web/pages/api/v1/sustainability/rebuild-score.ts",
  "web/pages/api/v1/sustainability/rebuild-trend-bands.ts",
  "web/pages/api/v1/db/sustainability/rebuild-baselines.ts",
  "web/pages/api/v1/start-chart.ts",
  "web/pages/api/v1/db/update-start-chart-projections.ts",
  "web/pages/api/v1/db/update-rolling-player-averages.ts",
  "web/pages/api/v1/db/update-team-power-ratings.ts",
  "web/pages/api/v1/db/update-team-power-ratings-new.ts",
  "web/pages/api/v1/db/update-goalie-projections.ts",
  "web/pages/api/v1/db/update-goalie-projections-v2.ts",
  "web/pages/api/v1/db/run-projection-v2.ts",
  "web/pages/api/v1/db/run-projection-accuracy.ts",
  "web/pages/api/v1/projections/players.ts",
  "web/pages/api/v1/projections/teams.ts",
  "web/pages/api/v1/projections/goalies.ts",
  "web/lib/teamRatingsService.ts",
  "web/lib/power-ratings.ts",
  "web/lib/supabase/Upserts/fetchRollingPlayerAverages.ts",
  "web/pages/api/v1/db/calculate-wigo-stats.ts",
  "web/lib/supabase/database-generated.types.ts",
]);

const pathScopePattern =
  /(?:trend|sustainab|baseline|projection|power[-_.]?rating|rolling[-_.]?player|start[-_.]?chart|forge|wigo|sko)/i;
const sqlScopePattern =
  /(?:player_trend_metrics|sustainability_|player_baselines|team_power_ratings|rolling_player_game_metrics|player_projections|goalie_start_projections|forge_|wigo_recent|wigo_career)/i;
const codeExtensions = new Set([".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs"]);
const importPattern =
  /(?:import|export)\s+(?:[^"']*?\s+from\s+)?["']([^"']+)["']|require\(\s*["']([^"']+)["']\s*\)|import\(\s*["']([^"']+)["']\s*\)/g;

function readTracked(path) {
  try {
    return readFileSync(join(repoRoot, path), "utf8");
  } catch {
    return "";
  }
}

function resolveTrackedImport(importer, specifier) {
  if (
    !specifier ||
    specifier.startsWith("node:") ||
    specifier.startsWith("@")
  ) {
    return null;
  }

  let base;
  if (specifier.startsWith(".")) {
    base = resolve(repoRoot, dirname(importer), specifier);
  } else if (
    /^(?:components|hooks|lib|pages|styles|utils|stories)\//.test(specifier)
  ) {
    base = resolve(webRoot, specifier);
  } else {
    return null;
  }

  const candidates = [
    base,
    ...[
      ".ts",
      ".tsx",
      ".js",
      ".jsx",
      ".mjs",
      ".cjs",
      ".scss",
      ".css",
      ".json",
    ].map((extension) => `${base}${extension}`),
    ...[".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs"].map((extension) =>
      join(base, `index${extension}`),
    ),
  ];

  for (const candidate of candidates) {
    if (!existsSync(candidate)) continue;
    const repoPath = relative(repoRoot, candidate).split("\\").join("/");
    if (tracked.has(repoPath)) return repoPath;
  }
  return null;
}

const importsByPath = new Map();
const reverseImports = new Map();
for (const trackedPath of trackedPaths) {
  if (!codeExtensions.has(extname(trackedPath))) continue;
  const dependencies = new Set();
  const source = readTracked(trackedPath);
  for (const match of source.matchAll(importPattern)) {
    const dependency = resolveTrackedImport(
      trackedPath,
      match[1] ?? match[2] ?? match[3],
    );
    if (!dependency) continue;
    dependencies.add(dependency);
    const importers = reverseImports.get(dependency) ?? new Set();
    importers.add(trackedPath);
    reverseImports.set(dependency, importers);
  }
  importsByPath.set(trackedPath, dependencies);
}

const reasons = new Map();
function include(path, reason) {
  if (!tracked.has(path)) return false;
  const existing = reasons.get(path) ?? new Set();
  const changed = !existing.has(reason);
  existing.add(reason);
  reasons.set(path, existing);
  return changed;
}

for (const trackedPath of trackedPaths) {
  if (explicitSeeds.has(trackedPath)) include(trackedPath, "prd_explicit_seed");
  if (pathScopePattern.test(trackedPath))
    include(trackedPath, "path_scope_match");
  if (
    trackedPath.endsWith(".sql") &&
    sqlScopePattern.test(readTracked(trackedPath))
  ) {
    include(trackedPath, "sql_contract_match");
  }
}

const dependencyQueue = [...reasons.keys()];
for (let index = 0; index < dependencyQueue.length; index += 1) {
  const importer = dependencyQueue[index];
  for (const dependency of importsByPath.get(importer) ?? []) {
    if (include(dependency, `imported_by:${importer}`))
      dependencyQueue.push(dependency);
  }
}

for (const dependency of [...reasons.keys()]) {
  for (const importer of reverseImports.get(dependency) ?? []) {
    if (/\.(?:test|spec)\.[jt]sx?$|\/stories\//.test(importer)) {
      include(importer, `test_or_story_for:${dependency}`);
    }
  }
}

const vercelConfig = readTracked("web/vercel.json");

function familiesFor(path) {
  const value = path.toLowerCase();
  const families = [];
  if (/sustainab|baseline/.test(value))
    families.push("sustainability_baselines");
  if (/trend|sko/.test(value)) families.push("trends_skater_metrics");
  if (
    /team.?power|power.?rating|teamratings|underlying.stats|team.ctpi|team.sos/.test(
      value,
    )
  ) {
    families.push("team_power_underlying_matchup");
  }
  if (/start.?chart|rolling.?player|wigo|wgo.*last/.test(value)) {
    families.push("start_chart_rolling_legacy");
  }
  if (/forge|projection/.test(value))
    families.push("forge_projections_accuracy");
  if (families.length === 0) families.push("legacy_adjacent");
  return [...new Set(families)];
}

function surfaceKind(path) {
  if (/\.(?:test|spec)\.[jt]sx?$/.test(path)) return "test";
  if (/\/stories\/|\.stories\.[jt]sx?$/.test(path)) return "story";
  if (path.endsWith(".sql")) return "sql_or_migration";
  if (/\/pages\/api\//.test(path)) return "api_or_job";
  if (/\/pages\//.test(path)) return "page";
  if (/\/scripts\//.test(path)) return "script";
  if (/\.(?:md|mdc)$/.test(path)) return "documentation";
  if (/\.(?:scss|css)$/.test(path)) return "style";
  if (/\/components\//.test(path)) return "component";
  return "helper_or_data_contract";
}

function routeFor(path) {
  if (!path.startsWith("web/pages/api/") || !codeExtensions.has(extname(path)))
    return null;
  return `/${path
    .slice("web/pages/".length)
    .replace(/\.(?:ts|tsx|js|jsx)$/, "")
    .replace(/\/index$/, "")}`;
}

function runtimeStatus(path, kind) {
  const value = path.toLowerCase();
  const route = routeFor(path);
  if (
    /migration-archive|(?:^|\/)(?:legacy|deprecated|archive)(?:\/|[-_.])/.test(
      value,
    )
  ) {
    return "legacy";
  }
  if (
    ["test", "story", "sql_or_migration", "style", "documentation"].includes(
      kind,
    )
  ) {
    return "adjacent_dependency";
  }
  if (/sandbox|testinggrounds|debug|placeholder/.test(value))
    return "active_experiment";
  if (route && vercelConfig.includes(route)) return "current_production";
  if (kind === "helper_or_data_contract" || kind === "component") {
    return "adjacent_dependency";
  }
  return "unclear";
}

const entries = [...reasons.keys()].sort().map((path, index) => {
  const kind = surfaceKind(path);
  return {
    auditId: `INV-${String(index + 1).padStart(4, "0")}`,
    path,
    families: familiesFor(path),
    surfaceKind: kind,
    runtimeStatus: runtimeStatus(path, kind),
    inclusionEvidence: [...reasons.get(path)].sort(),
  };
});

function countBy(values) {
  return Object.fromEntries(
    [
      ...values.reduce(
        (counts, value) => counts.set(value, (counts.get(value) ?? 0) + 1),
        new Map(),
      ),
    ].sort(([left], [right]) => left.localeCompare(right)),
  );
}

const inventory = {
  schemaVersion: 1,
  scope: {
    trackedRoots: ["web", "functions", "supabase"],
    seedModes: [
      "explicit PRD paths",
      "path keyword matches",
      "relevant SQL contract content",
      "recursive local import dependencies",
      "direct related tests and stories",
    ],
    conservativeStatusRule:
      "Filename/import evidence never implies production ownership; unproven page/API entry points remain unclear.",
  },
  summary: {
    total: entries.length,
    byRuntimeStatus: countBy(entries.map((entry) => entry.runtimeStatus)),
    bySurfaceKind: countBy(entries.map((entry) => entry.surfaceKind)),
    byFamilyMembership: countBy(entries.flatMap((entry) => entry.families)),
  },
  entries,
};

writeFileSync(outputPath, `${JSON.stringify(inventory, null, 2)}\n`, "utf8");
process.stdout.write(`${JSON.stringify(inventory.summary)}\n`);
