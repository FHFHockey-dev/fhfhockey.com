import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, extname, join, relative, resolve } from "node:path";

const repoRoot = execFileSync("git", ["rev-parse", "--show-toplevel"], {
  encoding: "utf8",
}).trim();
const inventoryPath = join(
  repoRoot,
  "tasks/TASKS/three-pillars-analytics/sustainability/sustainability-trends-inventory.json",
);
const outputPath = join(
  repoRoot,
  "tasks/TASKS/three-pillars-analytics/sustainability/sustainability-trends-dependency-map.json",
);
const inventory = JSON.parse(readFileSync(inventoryPath, "utf8"));
const inventoryPaths = new Set(inventory.entries.map((entry) => entry.path));
const trackedPaths = new Set(
  execFileSync("git", ["ls-files", "-z"], {
    cwd: repoRoot,
    encoding: "utf8",
    maxBuffer: 64 * 1024 * 1024,
  })
    .split("\0")
    .filter(Boolean),
);
const codeExtensions = new Set([".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs"]);
const importPattern =
  /(?:import|export)\s+(?:[^"']*?\s+from\s+)?["']([^"']+)["']|require\(\s*["']([^"']+)["']\s*\)|import\(\s*["']([^"']+)["']\s*\)/g;
const apiPattern = /["'`]\s*(\/api\/[A-Za-z0-9_./[\]-]+)/g;
const fromPattern = /(?<!Array)(?<!Object)\.from\(\s*["']([^"']+)["']/g;
const rpcPattern = /\.rpc\(\s*["']([^"']+)["']/g;
const dynamicFromPattern = /(?<!Array)(?<!Object)\.from\(\s*(?!["'])/g;
const dynamicRpcPattern = /\.rpc\(\s*(?!["'])/g;
const sqlCreatePattern =
  /\bcreate\s+(?:or\s+replace\s+)?(?:materialized\s+)?(?:table|view)\s+(?:if\s+not\s+exists\s+)?(?:["']?([A-Za-z_][\w$]*)["']?\.)?["']?([A-Za-z_][\w$]*)["']?/gi;
const webRoot = join(repoRoot, "web");

function readRepoFile(path) {
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
    const repoPath = relative(repoRoot, candidate).split("\\").join("/");
    if (trackedPaths.has(repoPath)) return repoPath;
  }
  return null;
}

function routeForPath(path) {
  if (
    !path.startsWith("web/pages/api/") ||
    !codeExtensions.has(extname(path))
  ) {
    return null;
  }
  return `/${path
    .slice("web/pages/".length)
    .replace(/\.(?:ts|tsx|js|jsx)$/, "")
    .replace(/\/index$/, "")}`;
}

const pathByRoute = new Map();
for (const path of trackedPaths) {
  const route = routeForPath(path);
  if (route) pathByRoute.set(route, path);
}

function countMatches(source, pattern) {
  pattern.lastIndex = 0;
  return [...source.matchAll(pattern)].length;
}

function accessModeForFrom(source, match) {
  const tail = source.slice(
    match.index,
    Math.min(source.length, match.index + 2000),
  );
  const terminator = tail.indexOf(";");
  const chain = terminator >= 0 ? tail.slice(0, terminator + 1) : tail;
  if (/\.(?:insert|upsert|update|delete)\s*\(/.test(chain)) return "write";
  return "read";
}

function ownershipFor(objectName) {
  if (objectName.startsWith("rpc:")) {
    return {
      classification: "unknown_mixed",
      evidence:
        "RPC result/side-effect ownership requires function-body audit.",
    };
  }
  if (/cache/i.test(objectName)) {
    return {
      classification: "cached_output",
      evidence:
        "Object name explicitly identifies cache ownership; family audit must verify invalidation semantics.",
    };
  }
  if (
    /^(?:forge_.*(?:projection|result|accuracy|calibration)|player_projections|goalie_start_projections)/.test(
      objectName,
    )
  ) {
    return {
      classification: "presentation_output",
      evidence:
        "Projection/result object is consumed as a published product output; family audit must verify writer authority.",
    };
  }
  if (
    /_(?:daily|snapshot|snapshots)$/.test(objectName) ||
    /^(?:sustainability_scores|sustainability_trend_bands|sustainability_projections)$/.test(
      objectName,
    )
  ) {
    return {
      classification: "snapshot",
      evidence:
        "Object stores date/version-keyed computed state; family audit must verify immutability and fallback policy.",
    };
  }
  if (
    /^(?:rolling_|player_trend_metrics|player_baselines|sustainability_(?:priors|player_priors|window_z)|team_power_ratings|player_stats_unified|player_totals_unified)/.test(
      objectName,
    )
  ) {
    return {
      classification: "derived_aggregate",
      evidence:
        "Object name and audited scope identify computed aggregate/baseline ownership; formulas remain family-audit work.",
    };
  }
  if (
    /^(?:games|teams|players|rosters|pbp_games|pbp_plays|shift_charts|nhl_api_shift_rows|goaliesGameStats|wgo_skater_stats)$/.test(
      objectName,
    ) ||
    /^nst_/.test(objectName)
  ) {
    return {
      classification: "raw_source",
      evidence:
        "Object is an ingested identity/game/event/stat source; family audit must verify freshness and canonical provider.",
    };
  }
  return {
    classification: "unknown_mixed",
    evidence:
      "Static reference proves use but not semantic ownership; retain unresolved until the owning family audit.",
  };
}

const objectEvidence = new Map();
function addObjectEvidence(name, path, mode, origin) {
  const evidence = objectEvidence.get(name) ?? {
    name,
    readBy: new Set(),
    writtenBy: new Set(),
    declaredBy: new Set(),
    invokedBy: new Set(),
  };
  if (mode === "read") evidence.readBy.add(path);
  if (mode === "write") evidence.writtenBy.add(path);
  if (mode === "declare") evidence.declaredBy.add(path);
  if (mode === "invoke") evidence.invokedBy.add(path);
  evidence.origins ??= new Set();
  evidence.origins.add(origin);
  objectEvidence.set(name, evidence);
}

const surfaces = [];
for (const entry of inventory.entries) {
  const source = readRepoFile(entry.path);
  const directLocalDependencies = new Set();
  const apiReferences = new Set();
  const dataObjects = new Map();

  if (codeExtensions.has(extname(entry.path))) {
    for (const match of source.matchAll(importPattern)) {
      const dependency = resolveTrackedImport(
        entry.path,
        match[1] ?? match[2] ?? match[3],
      );
      if (dependency && inventoryPaths.has(dependency)) {
        directLocalDependencies.add(dependency);
      }
    }
    for (const match of source.matchAll(apiPattern)) {
      const route = match[1].replace(/\/$/, "");
      apiReferences.add(
        pathByRoute.has(route)
          ? `${route} -> ${pathByRoute.get(route)}`
          : route,
      );
    }
    for (const match of source.matchAll(fromPattern)) {
      const mode = accessModeForFrom(source, match);
      const modes = dataObjects.get(match[1]) ?? new Set();
      modes.add(mode);
      dataObjects.set(match[1], modes);
      addObjectEvidence(match[1], entry.path, mode, "supabase_from_literal");
    }
    for (const match of source.matchAll(rpcPattern)) {
      const name = `rpc:${match[1]}`;
      const modes = dataObjects.get(name) ?? new Set();
      modes.add("invoke");
      dataObjects.set(name, modes);
      addObjectEvidence(name, entry.path, "invoke", "supabase_rpc_literal");
    }
  }

  if (entry.path.endsWith(".sql")) {
    for (const match of source.matchAll(sqlCreatePattern)) {
      const name =
        match[1] && match[1] !== "public"
          ? `${match[1]}.${match[2]}`
          : match[2];
      const modes = dataObjects.get(name) ?? new Set();
      modes.add("declare");
      dataObjects.set(name, modes);
      addObjectEvidence(name, entry.path, "declare", "sql_create_literal");
    }
  }

  const dynamicDataReferences =
    countMatches(source, dynamicFromPattern) +
    countMatches(source, dynamicRpcPattern);
  if (
    directLocalDependencies.size ||
    apiReferences.size ||
    dataObjects.size ||
    dynamicDataReferences ||
    ["page", "api_or_job"].includes(entry.surfaceKind)
  ) {
    surfaces.push({
      auditId: entry.auditId,
      path: entry.path,
      surfaceKind: entry.surfaceKind,
      runtimeStatus: entry.runtimeStatus,
      directLocalDependencies: [...directLocalDependencies].sort(),
      apiReferences: [...apiReferences].sort(),
      dataObjects: [...dataObjects]
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([name, modes]) => ({ name, modes: [...modes].sort() })),
      dynamicDataReferences,
    });
  }
}

const dataObjects = [...objectEvidence.values()]
  .sort((left, right) => left.name.localeCompare(right.name))
  .map((evidence) => ({
    name: evidence.name,
    ...ownershipFor(evidence.name),
    readBy: [...evidence.readBy].sort(),
    writtenBy: [...evidence.writtenBy].sort(),
    declaredBy: [...evidence.declaredBy].sort(),
    invokedBy: [...evidence.invokedBy].sort(),
    origins: [...evidence.origins].sort(),
  }));

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

const result = {
  schemaVersion: 1,
  scope: {
    inventorySchemaVersion: inventory.schemaVersion,
    evidenceModes: [
      "static local imports",
      "literal /api route references",
      "literal Supabase from/rpc calls",
      "SQL CREATE TABLE/VIEW declarations",
    ],
    limitations: [
      "Dynamic imports, dynamically constructed API paths, and indirect runtime dispatch require family-level audit.",
      "Dynamic Supabase table/RPC identifiers are counted per file but cannot be assigned without runtime or caller evidence.",
      "Ownership classifications are conservative starting points; unknown_mixed is intentional when static evidence cannot prove semantics.",
    ],
  },
  summary: {
    mappedSurfaces: surfaces.length,
    apiReferenceEdges: surfaces.reduce(
      (sum, surface) => sum + surface.apiReferences.length,
      0,
    ),
    localDependencyEdges: surfaces.reduce(
      (sum, surface) => sum + surface.directLocalDependencies.length,
      0,
    ),
    dynamicDataReferences: surfaces.reduce(
      (sum, surface) => sum + surface.dynamicDataReferences,
      0,
    ),
    dataObjects: dataObjects.length,
    dataObjectsByClassification: countBy(
      dataObjects.map((object) => object.classification),
    ),
  },
  surfaces,
  dataObjects,
};

writeFileSync(outputPath, `${JSON.stringify(result, null, 2)}\n`, "utf8");
process.stdout.write(`${JSON.stringify(result.summary)}\n`);
