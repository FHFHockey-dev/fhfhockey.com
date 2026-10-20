import fs from "fs";
import path from "path";
import ts from "typescript";

import { parseCronInventoryFromMarkdown } from "lib/cron/cronInventory";

export type CronAuditCoverageMode =
  | "shared-wrapper"
  | "manual-insert"
  | "exempt";

export type CronAuditCoverageFinding = {
  jobNames: string[];
  routePath: string;
  filePath: string | null;
  mode: CronAuditCoverageMode | null;
  reason: string | null;
};

export type CronAuthCoverageMode =
  | "admin-or-cron"
  | "cron-secret-only"
  | "unprotected";

export type CronAuthCallerShape =
  | "cron-only"
  | "browser-admin"
  | "internal-server"
  | "browser-admin-and-internal";

export type CronAuthCallerInventory = {
  shape: Exclude<CronAuthCallerShape, "cron-only">;
  files: readonly string[];
};

export type CronAuthCoverageFinding = {
  jobNames: string[];
  routePath: string;
  filePath: string | null;
  currentMode: CronAuthCoverageMode | null;
  targetMode: Exclude<CronAuthCoverageMode, "unprotected">;
  callerShape: CronAuthCallerShape;
  callerFiles: readonly string[];
  reason: string | null;
};

// Exemptions must remain rare, route-specific, and justified. An empty map means
// every active scheduled HTTP route currently has an audit-producing owner.
export const CRON_AUDIT_EXEMPTIONS: Readonly<Record<string, string>> = {};

// This destructive internal route intentionally accepts only the exact cron
// bearer. It has no browser-admin contract; update-yahoo-players is its sole
// static server caller and already forwards CRON_SECRET.
export const CRON_AUTH_DIRECT_SECRET_ROUTES: Readonly<Record<string, string>> =
  {
    "/api/internal/sync-yahoo-players-to-sheet":
      "Internal destructive sheet sync; exact cron bearer only.",
  };

// Active routes omitted from this map have no non-test static source caller
// beyond pg_cron. The manifest freezes every browser/manual or server-chain
// consumer that must be preserved before a route moves behind adminOnly.
export const CRON_AUTH_NON_CRON_CALLERS: Readonly<
  Record<string, CronAuthCallerInventory>
> = {
  "/api/Teams/nst-team-stats": {
    shape: "browser-admin",
    files: ["web/pages/db/index.tsx"],
  },
  "/api/internal/sync-yahoo-players-to-sheet": {
    shape: "internal-server",
    files: ["web/lib/integrations/yahoo/ingestionLifecycle.ts"],
  },
  "/api/v1/db/build-projection-derived-v2": {
    shape: "internal-server",
    files: [
      "web/lib/projections/goaliePipeline.ts",
      "web/lib/rollingForgePipeline.ts",
      "web/pages/api/v1/db/run-projection-v2.ts",
      "web/pages/api/v1/db/run-rolling-forge-pipeline.ts",
    ],
  },
  "/api/v1/db/cron-report": {
    shape: "internal-server",
    files: [
      "web/lib/rollingForgePipeline.ts",
      "web/pages/api/v1/db/run-rolling-forge-pipeline.ts",
    ],
  },
  "/api/v1/db/ingest-projection-inputs": {
    shape: "internal-server",
    files: [
      "web/lib/projections/goaliePipeline.ts",
      "web/lib/rollingForgePipeline.ts",
      "web/lib/xg/backfillCoverageAudit.ts",
      "web/pages/api/v1/db/run-projection-v2.ts",
      "web/pages/api/v1/db/run-rolling-forge-pipeline.ts",
    ],
  },
  "/api/v1/db/powerPlayTimeFrame": {
    shape: "browser-admin",
    files: ["web/pages/db/index.tsx"],
  },
  "/api/v1/db/run-projection-accuracy": {
    shape: "internal-server",
    files: [
      "web/lib/projections/goaliePipeline.ts",
      "web/lib/rollingForgePipeline.ts",
      "web/pages/api/v1/db/run-rolling-forge-pipeline.ts",
    ],
  },
  "/api/v1/db/run-projection-v2": {
    shape: "internal-server",
    files: [
      "web/lib/projections/goaliePipeline.ts",
      "web/lib/rollingForgePipeline.ts",
      "web/pages/api/v1/db/run-rolling-forge-pipeline.ts",
    ],
  },
  "/api/v1/db/sustainability/rebuild-baselines": {
    shape: "internal-server",
    files: ["web/lib/sustainability/dependencyChecks.ts"],
  },
  "/api/v1/db/update-game-goal-projections": {
    shape: "browser-admin",
    files: ["web/pages/db/index.tsx"],
  },
  "/api/v1/db/update-games": {
    shape: "browser-admin-and-internal",
    files: [
      "web/lib/projections/goaliePipeline.ts",
      "web/lib/rollingForgePipeline.ts",
      "web/pages/api/v1/db/run-projection-v2.ts",
      "web/pages/api/v1/db/run-rolling-forge-pipeline.ts",
      "web/pages/db/index.tsx",
    ],
  },
  "/api/v1/db/update-goalie-projections-v2": {
    shape: "internal-server",
    files: [
      "web/lib/projections/compatibilityInventory.ts",
      "web/lib/projections/goaliePipeline.ts",
      "web/lib/rollingForgePipeline.ts",
      "web/pages/api/v1/db/run-projection-v2.ts",
      "web/pages/api/v1/db/run-rolling-forge-pipeline.ts",
      "web/pages/api/v1/db/update-lineup-source-provenance.ts",
    ],
  },
  "/api/v1/db/update-line-combinations": {
    shape: "browser-admin-and-internal",
    files: [
      "web/lib/projections/goaliePipeline.ts",
      "web/lib/rollingForgePipeline.ts",
      "web/pages/api/v1/db/run-projection-v2.ts",
      "web/pages/api/v1/db/run-rolling-forge-pipeline.ts",
      "web/pages/db/index.tsx",
    ],
  },
  "/api/v1/db/update-nst-gamelog": {
    shape: "internal-server",
    files: [
      "web/lib/rollingForgePipeline.ts",
      "web/pages/api/v1/db/run-rolling-forge-pipeline.ts",
    ],
  },
  "/api/v1/db/update-players": {
    shape: "browser-admin-and-internal",
    files: [
      "web/lib/projections/goaliePipeline.ts",
      "web/lib/rollingForgePipeline.ts",
      "web/pages/api/v1/db/run-projection-v2.ts",
      "web/pages/api/v1/db/run-rolling-forge-pipeline.ts",
      "web/pages/db/index.tsx",
    ],
  },
  "/api/v1/db/update-power-play-combinations": {
    shape: "internal-server",
    files: [
      "web/lib/rollingForgePipeline.ts",
      "web/pages/api/v1/db/run-rolling-forge-pipeline.ts",
    ],
  },
  "/api/v1/db/update-rolling-player-averages": {
    shape: "internal-server",
    files: [
      "web/lib/rankings/skaterWindowAggregation.ts",
      "web/lib/rollingForgePipeline.ts",
      "web/pages/api/v1/db/run-rolling-forge-pipeline.ts",
      "web/pages/api/v1/db/update-rolling-games.ts",
    ],
  },
  "/api/v1/db/update-seasons": {
    shape: "browser-admin",
    files: ["web/pages/db/index.tsx"],
  },
  "/api/v1/db/update-standings-details": {
    shape: "browser-admin",
    files: ["web/pages/db/index.tsx"],
  },
  "/api/v1/db/update-teams": {
    shape: "browser-admin-and-internal",
    files: [
      "web/lib/projections/goaliePipeline.ts",
      "web/lib/rollingForgePipeline.ts",
      "web/pages/api/v1/db/run-projection-v2.ts",
      "web/pages/api/v1/db/run-rolling-forge-pipeline.ts",
      "web/pages/db/index.tsx",
    ],
  },
  "/api/v1/db/update-wgo-skaters": {
    shape: "internal-server",
    files: [
      "web/lib/rollingForgePipeline.ts",
      "web/pages/api/v1/db/run-rolling-forge-pipeline.ts",
    ],
  },
  "/api/v1/db/update-wgo-totals": {
    shape: "internal-server",
    files: [
      "web/lib/rollingForgePipeline.ts",
      "web/pages/api/v1/db/run-rolling-forge-pipeline.ts",
    ],
  },
};

function routeCandidates(webRoot: string, routePath: string) {
  const routeRelativePath = routePath.replace(/^\/+/, "");
  const basePath = path.resolve(webRoot, "pages", routeRelativePath);
  const pagesRoot = path.resolve(webRoot, "pages");

  if (!basePath.startsWith(`${pagesRoot}${path.sep}`)) {
    return [];
  }

  return [
    `${basePath}.ts`,
    `${basePath}.tsx`,
    path.join(basePath, "index.ts"),
    path.join(basePath, "index.tsx"),
  ];
}

export function resolveCronRouteFile(webRoot: string, routePath: string) {
  return (
    routeCandidates(webRoot, routePath).find((candidate) =>
      fs.existsSync(candidate),
    ) ?? null
  );
}

export function classifyCronAuditSource(
  source: string,
): CronAuditCoverageMode | null {
  if (/\bwithCronJobAudit\s*\(/.test(source)) {
    return "shared-wrapper";
  }

  if (/\.from\(\s*["']cron_job_audit["']\s*\)\s*\.insert\s*\(/.test(source)) {
    return "manual-insert";
  }

  return null;
}

export function inspectScheduledCronAuditCoverage(args: {
  scheduleMarkdown: string;
  webRoot: string;
  exemptions?: Readonly<Record<string, string>>;
}): CronAuditCoverageFinding[] {
  const exemptions = args.exemptions ?? CRON_AUDIT_EXEMPTIONS;
  const jobsByRoute = new Map<string, string[]>();

  for (const job of parseCronInventoryFromMarkdown(args.scheduleMarkdown)) {
    if ((job.method !== "GET" && job.method !== "POST") || !job.routePath) {
      continue;
    }

    jobsByRoute.set(job.routePath, [
      ...(jobsByRoute.get(job.routePath) ?? []),
      job.name,
    ]);
  }

  return Array.from(jobsByRoute.entries())
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([routePath, jobNames]) => {
      const exemptionReason = exemptions[routePath] ?? null;
      if (exemptionReason) {
        return {
          jobNames,
          routePath,
          filePath: resolveCronRouteFile(args.webRoot, routePath),
          mode: "exempt" as const,
          reason: exemptionReason,
        };
      }

      const filePath = resolveCronRouteFile(args.webRoot, routePath);
      if (!filePath) {
        return {
          jobNames,
          routePath,
          filePath: null,
          mode: null,
          reason:
            "No Pages API route file resolves from the active cron inventory.",
        };
      }

      const mode = classifyCronAuditSource(fs.readFileSync(filePath, "utf8"));
      return {
        jobNames,
        routePath,
        filePath,
        mode,
        reason: mode
          ? null
          : "Route has neither withCronJobAudit nor a manual cron_job_audit insert.",
      };
    });
}

export function classifyCronAuthSource(source: string): CronAuthCoverageMode {
  if (/\badminOnly\s*\(/.test(source)) {
    return "admin-or-cron";
  }

  if (/token\s*!==\s*process\.env\.CRON_SECRET/.test(source)) {
    return "cron-secret-only";
  }

  return "unprotected";
}

export function inspectScheduledCronAuthCoverage(args: {
  scheduleMarkdown: string;
  webRoot: string;
}): CronAuthCoverageFinding[] {
  const jobsByRoute = new Map<string, string[]>();

  for (const job of parseCronInventoryFromMarkdown(args.scheduleMarkdown)) {
    if ((job.method !== "GET" && job.method !== "POST") || !job.routePath) {
      continue;
    }

    jobsByRoute.set(job.routePath, [
      ...(jobsByRoute.get(job.routePath) ?? []),
      job.name,
    ]);
  }

  return Array.from(jobsByRoute.entries())
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([routePath, jobNames]) => {
      const filePath = resolveCronRouteFile(args.webRoot, routePath);
      const caller = CRON_AUTH_NON_CRON_CALLERS[routePath];
      const targetMode = CRON_AUTH_DIRECT_SECRET_ROUTES[routePath]
        ? "cron-secret-only"
        : "admin-or-cron";

      if (!filePath) {
        return {
          jobNames,
          routePath,
          filePath: null,
          currentMode: null,
          targetMode,
          callerShape: caller?.shape ?? "cron-only",
          callerFiles: caller?.files ?? [],
          reason:
            "No Pages API route file resolves from the active cron inventory.",
        };
      }

      const currentMode = classifyCronAuthSource(
        fs.readFileSync(filePath, "utf8"),
      );

      return {
        jobNames,
        routePath,
        filePath,
        currentMode,
        targetMode,
        callerShape: caller?.shape ?? "cron-only",
        callerFiles: caller?.files ?? [],
        reason:
          currentMode === "unprotected"
            ? "Route must remain on the explicit route-by-route auth rollout before enforcement."
            : null,
      };
    });
}

export type VercelCronCoverageFinding = {
  entryIndex: number;
  configuredPath: string | null;
  schedule: string | null;
  routePath: string | null;
  queryString: string | null;
  filePath: string | null;
  inputReason: string | null;
  authMode: "admin-or-cron" | "cron-secret-only" | "unqualified";
  auditMode: "shared-wrapper" | "unqualified";
  authReason: string;
  auditReason: string;
};

// AST signatures ignore formatting/comments, but preserve operators, literals
// and statement order. These are deliberately narrow reviewed source contracts,
// not a general authorization or control-flow analyzer.
function sourceSignature(source: string) {
  const ast = ts.createSourceFile("contract.ts", source, ts.ScriptTarget.Latest, true);
  const signature: (number | string)[] = [];
  function visit(node: ts.Node) {
    signature.push(node.kind);
    let hasChildren = false;
    ts.forEachChild(node, (child) => { hasChildren = true; visit(child); });
    if (!hasChildren) signature.push(node.getText(ast));
  }
  visit(ast);
  return JSON.stringify(signature);
}

const directBearerPrefixes: Readonly<Record<string, string>> = {
  "/api/internal/starter-board": `
    res.setHeader("Cache-Control", "no-store");
    if (req.method !== "GET") { res.setHeader("Allow", "GET"); return res.status(405).end(); }
    const secret = process.env.CRON_SECRET;
    if (!secret?.trim()) return res.status(503).json({ error: "Scheduler not configured" });
    if (req.headers.authorization !== \`Bearer \${secret}\`) return res.status(401).end();`,
  "/api/internal/yahoo-live-draft": `
    res.setHeader("Cache-Control", "no-store");
    if (req.method !== "GET") {
      res.setHeader("Allow", "GET");
      return res.status(405).json({ error: "Method Not Allowed" });
    }
    const secret = process.env.CRON_SECRET;
    if (!secret?.trim()) return res.status(503).json({ error: "Scheduler not configured" });
    if (req.headers.authorization !== \`Bearer \${secret}\`) {
      return res.status(401).json({ error: "Unauthorized" });
    }`,
};

const constantTimeBearerHelper = `function bearerToken(req: NextApiRequest) {
  const authorization = req.headers.authorization;
  return typeof authorization === "string" && authorization.startsWith("Bearer ")
    ? authorization.slice("Bearer ".length) : "";
}`;
const constantTimeMatchHelper = `function secretsMatch(received: string, expected: string) {
  const receivedBytes = Buffer.from(received);
  const expectedBytes = Buffer.from(expected);
  return (receivedBytes.length === expectedBytes.length &&
    timingSafeEqual(Uint8Array.from(receivedBytes), Uint8Array.from(expectedBytes)));
}`;
const constantTimePrefix = `
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ error: "Method Not Allowed" });
  }
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) return res.status(503).json({ error: "CRON_SECRET is not configured" });
  if (!secretsMatch(bearerToken(req), secret)) {
    return res.status(401).json({ error: "Unauthorized" });
  }`;

export function classifyVercelCronSource(source: string, routePath: string) {
  const ast = ts.createSourceFile("cron-route.ts", source, ts.ScriptTarget.Latest, true);
  function imported(name: string, module: string, defaultImport = false) {
    return ast.statements.some((statement) => {
      if (!ts.isImportDeclaration(statement) || !ts.isStringLiteral(statement.moduleSpecifier) ||
          statement.moduleSpecifier.text !== module || statement.importClause?.isTypeOnly) return false;
      if (defaultImport) return statement.importClause?.name?.text === name;
      const bindings = statement.importClause?.namedBindings;
      return bindings && ts.isNamedImports(bindings) && bindings.elements.some((element) =>
        !element.isTypeOnly && element.name.text === name && (element.propertyName?.text ?? name) === name);
    });
  }
  const exported = ast.statements.find(ts.isExportAssignment)?.expression;
  let current = exported;
  let admin = false;
  let audited = false;
  // Only traverse the actual exported first-argument wrapper chain. Unused
  // imports, comments, strings and calls elsewhere do not qualify a route.
  while (current) {
    if (ts.isAsExpression(current) || ts.isParenthesizedExpression(current)) {
      current = current.expression;
      continue;
    }
    if (!ts.isCallExpression(current) || !ts.isIdentifier(current.expression) || !current.arguments[0]) break;
    const name = current.expression.text;
    if (name === "adminOnly" && imported(name, "utils/adminOnlyMiddleware", true)) admin = true;
    else if (name === "withCronJobAudit" && imported(name, "lib/cron/withCronJobAudit")) audited = true;
    else if (!(name === "withNhlOffSeasonSkip" && imported(name, "lib/cron/nhlOffSeason"))) break;
    current = current.arguments[0];
  }
  const defaultHandler = ast.statements.find((statement): statement is ts.FunctionDeclaration =>
    ts.isFunctionDeclaration(statement) && !!statement.modifiers?.some((modifier) => modifier.kind === ts.SyntaxKind.DefaultKeyword));
  function prefixMatches(expected: string, count: number, handler: ts.FunctionDeclaration | ts.ArrowFunction | undefined = defaultHandler) {
    const body = handler?.body;
    const actual = body && ts.isBlock(body)
      ? body.statements.slice(0, count).map((statement) => statement.getText(ast)).join("\n") : null;
    return actual != null && sourceSignature(actual) === sourceSignature(expected);
  }
  let bespoke = false;
  const directPrefix = directBearerPrefixes[routePath];
  if (directPrefix) bespoke = prefixMatches(directPrefix, 5);
  if (routePath === "/api/internal/espn-sync" || routePath === "/api/internal/fantrax-sync") {
    const functionMatches = (name: string, expected: string) => {
      const functions = ast.statements.filter((statement): statement is ts.FunctionDeclaration =>
        ts.isFunctionDeclaration(statement) && statement.name?.text === name);
      return functions.length === 1 && sourceSignature(functions[0].getText(ast)) === sourceSignature(expected);
    };
    // The two reviewed handlers differ only in braces around this early return.
    const prefix = routePath.endsWith("fantrax-sync")
      ? constantTimePrefix.replace('if (!secret) return res.status(503).json({ error: "CRON_SECRET is not configured" });',
          'if (!secret) { return res.status(503).json({ error: "CRON_SECRET is not configured" }); }')
      : constantTimePrefix;
    // Fantrax's reviewed timingSafeEqual call has a trailing comma.
    const matchHelper = routePath.endsWith("fantrax-sync")
      ? constantTimeMatchHelper.replace("Uint8Array.from(expectedBytes))", "Uint8Array.from(expectedBytes),)")
      : constantTimeMatchHelper;
    bespoke = imported("timingSafeEqual", "node:crypto") && prefixMatches(prefix, 4) &&
      functionMatches("bearerToken", constantTimeBearerHelper) && functionMatches("secretsMatch", matchHelper);
  }
  function returnsAuditDelegate(handler: ts.FunctionDeclaration | ts.ArrowFunction | undefined, prefixLength: number) {
    const body = handler?.body;
    if (!body || !ts.isBlock(body) || body.statements.length !== prefixLength + 1) return false;
    const returned = body.statements[prefixLength];
    const call = ts.isReturnStatement(returned) ? returned.expression : null;
    if (!call || !ts.isCallExpression(call) || !ts.isIdentifier(call.expression) ||
        sourceSignature(call.getText(ast)) !== sourceSignature(`${call.expression.text}(req, res)`)) return false;
    const delegateName = call.expression.text;
    const declarations = ast.statements.filter(ts.isVariableStatement)
      .filter((statement) => !!(statement.declarationList.flags & ts.NodeFlags.Const))
      .flatMap((statement) => [...statement.declarationList.declarations])
      .filter((declaration) => ts.isIdentifier(declaration.name) && declaration.name.text === delegateName);
    const initializer = declarations.length === 1 ? declarations[0].initializer : null;
    return initializer != null && ts.isCallExpression(initializer) &&
      ts.isIdentifier(initializer.expression) && initializer.expression.text === "withCronJobAudit" &&
      imported("withCronJobAudit", "lib/cron/withCronJobAudit") &&
      initializer.arguments[0] != null && ts.isArrowFunction(initializer.arguments[0]);
  }
  // Only these reviewed providers use an auth-first early-guard/delegate form.
  // An unused audited function, a bypassed guard or extra work before the
  // returned delegate cannot qualify this source contract.
  const patreonHandler = routePath === "/api/internal/patreon-reconcile" && admin && current && ts.isArrowFunction(current)
    ? current : undefined;
  const delegatedAudit = ((routePath === "/api/internal/espn-sync" || routePath === "/api/internal/fantrax-sync") &&
      bespoke && returnsAuditDelegate(defaultHandler, 4)) ||
    (patreonHandler != null && prefixMatches(`if (req.method !== "GET") {
      res.setHeader("Allow", "GET");
      return res.status(405).json({ error: "Method Not Allowed" });
    }`, 1, patreonHandler) && returnsAuditDelegate(patreonHandler, 1));
  audited = audited || delegatedAudit;
  return {
    authMode: admin ? "admin-or-cron" as const : bespoke ? "cron-secret-only" as const : "unqualified" as const,
    auditMode: audited ? "shared-wrapper" as const : "unqualified" as const,
    authReason: admin ? "Reviewed adminOnly import occurs in the exported wrapper chain." : bespoke
      ? "Reviewed route-specific nonempty-secret rejection and exact bearer guard precede work."
      : "No supported reviewed authorization source contract matched.",
    auditReason: delegatedAudit ? "Reviewed withCronJobAudit delegate is returned immediately after the exact admission/method prefix."
      : audited ? "Reviewed withCronJobAudit import occurs in the exported wrapper chain."
      : "No direct reviewed audit wrapper; manual/helper-owned auditing remains unqualified (not an exemption).",
  };
}

/** Static local source evidence only; never imports or invokes a scheduled route. */
export function inspectVercelCronCoverage(args: { crons: unknown; webRoot: string }): VercelCronCoverageFinding[] {
  if (!Array.isArray(args.crons) || args.crons.length > 512) {
    throw new Error("Vercel crons must be a bounded array of at most 512 entries.");
  }
  return Array.from(args.crons, (entry: unknown, entryIndex) => {
    const record = entry != null && typeof entry === "object" && !Array.isArray(entry)
      ? entry as Record<string, unknown> : null;
    const configuredPath = typeof record?.path === "string" ? record.path : null;
    const schedule = typeof record?.schedule === "string" ? record.schedule : null;
    const [pathname, ...queryParts] = configuredPath?.split("?") ?? [];
    const queryString = queryParts.length ? queryParts.join("?") : "";
    const validPath = configuredPath != null && configuredPath.length <= 2048 &&
      /^\/api\/[A-Za-z0-9_-]+(?:\/[A-Za-z0-9_-]+)*$/.test(pathname) &&
      !/[\s#]/.test(queryString) && !/%(?![\da-f]{2})/i.test(queryString);
    const limits = [[0, 59], [0, 23], [1, 31], [1, 12], [0, 7]];
    const fields = schedule?.split(" ");
    const validSchedule = schedule != null && schedule.length <= 128 && fields?.length === 5 &&
      fields.every((field, index) => field.split(",").every((part) => {
        const match = /^(\*|\d+(?:-\d+)?)(?:\/([1-9]\d*))?$/.exec(part);
        if (!match) return false;
        if (match[1] === "*") return true;
        const [start, end = start] = match[1].split("-").map(Number);
        return start >= limits[index][0] && end <= limits[index][1] && start <= end;
      }));
    const inputReason = !record || Object.keys(record).some((key) => key !== "path" && key !== "schedule") || !validPath || !validSchedule
      ? "Unsupported Vercel entry: expected a bounded local /api path/query and five numeric cron fields, with only path/schedule keys."
      : null;
    const routePath = validPath ? pathname : null;
    const filePath = !inputReason && routePath ? resolveCronRouteFile(args.webRoot, routePath) : null;
    const qualification = filePath && routePath
      ? classifyVercelCronSource(fs.readFileSync(filePath, "utf8"), routePath)
      : { authMode: "unqualified" as const, auditMode: "unqualified" as const,
          authReason: inputReason ?? "No Pages API route file resolves from this Vercel entry.",
          auditReason: inputReason ?? "No Pages API route file resolves from this Vercel entry." };
    return { entryIndex, configuredPath, schedule, routePath, queryString: configuredPath == null ? null : queryString,
      filePath, inputReason, ...qualification };
  });
}
