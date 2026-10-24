import fs from "fs";
import path from "path";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import ts from "typescript";

import {
  CRON_AUDIT_EXEMPTIONS,
  CRON_AUTH_DIRECT_SECRET_ROUTES,
  inspectScheduledCronAuditCoverage,
  inspectScheduledCronAuthCoverage,
  inspectVercelCronCoverage,
  classifyVercelCronSource,
} from "lib/cron/cronAuditCoverage";

describe("scheduled cron audit coverage", () => {
  const webRoot = process.cwd();
  const scheduleMarkdown = fs.readFileSync(
    path.resolve(webRoot, "../tasks/TASKS/cron-operations/cron-schedule.md"),
    "utf8",
  );
  const findings = inspectScheduledCronAuditCoverage({
    scheduleMarkdown,
    webRoot,
  });
  const authFindings = inspectScheduledCronAuthCoverage({
    scheduleMarkdown,
    webRoot,
  });

  it("covers every active scheduled HTTP route with an audit owner", () => {
    const uncovered = findings.filter((finding) => finding.mode == null);

    expect(uncovered).toEqual([]);
  });

  it("keeps manual audit owners explicit and all other routes on the shared wrapper", () => {
    const manualRoutes = findings
      .filter((finding) => finding.mode === "manual-insert")
      .map((finding) => finding.routePath);
    const unexpectedModes = findings.filter(
      (finding) =>
        finding.mode !== "shared-wrapper" &&
        finding.mode !== "manual-insert" &&
        finding.mode !== "exempt",
    );

    expect(manualRoutes).toEqual([
      "/api/v1/db/update-wgo-goalies",
      "/api/v1/db/update-wgo-skaters",
      "/api/v1/db/update-wgo-totals",
    ]);
    expect(unexpectedModes).toEqual([]);
    expect(CRON_AUDIT_EXEMPTIONS).toEqual({});
  });

  it("freezes every active HTTP job, route auth mode, and non-cron caller shape before rollout", () => {
    const modeCounts = authFindings.reduce<Record<string, number>>(
      (counts, finding) => {
        const mode = finding.currentMode ?? "missing-route";
        counts[mode] = (counts[mode] ?? 0) + 1;
        return counts;
      },
      {},
    );
    const callerCounts = authFindings.reduce<Record<string, number>>(
      (counts, finding) => {
        counts[finding.callerShape] = (counts[finding.callerShape] ?? 0) + 1;
        return counts;
      },
      {},
    );

    // 2026-10-17: pg_cron job 234 (daily-cron-report) is intentionally
    // inactive (tasks/artifacts/ops-health-2026-10-17, OPS-06). Its route is
    // scheduled only by the Vercel 0 13 * * * cron, outside this pg_cron set.
    // 2026-10-21: job 393 (run-projection-v2?horizonGames=5) was unscheduled;
    // run-projection-v2 has no other active pg_cron owner.
    // 2026-10-22: job 399 (route-runner-tick, cron-only) was scheduled after R21,
    // and job 79 (update-nst-gamelog, its route's only pg_cron owner) was unscheduled.
    expect(authFindings).toHaveLength(45);
    expect(
      authFindings.reduce(
        (jobCount, finding) => jobCount + finding.jobNames.length,
        0,
      ),
    ).toBe(49);
    expect(modeCounts).toEqual({
      "admin-or-cron": 45,
    });
    expect(callerCounts).toEqual({
      "browser-admin": 5,
      "browser-admin-and-internal": 4,
      "cron-only": 27,
      "internal-server": 9,
    });
    expect(authFindings.some((finding) => finding.routePath === "/api/v1/db/cron-report")).toBe(false);
    const vercelConfig = JSON.parse(fs.readFileSync(path.resolve(webRoot, "vercel.json"), "utf8"));
    expect(vercelConfig.crons).toContainEqual({ path: "/api/v1/db/cron-report", schedule: "0 13 * * *" });
    expect(authFindings.filter((finding) => !finding.filePath)).toEqual([]);

    for (const finding of authFindings) {
      for (const callerFile of finding.callerFiles) {
        const callerPath = path.resolve(
          webRoot,
          callerFile.replace(/^web\//, ""),
        );
        expect(fs.existsSync(callerPath)).toBe(true);
        expect(fs.readFileSync(callerPath, "utf8")).toContain(
          finding.routePath,
        );
      }
    }
  });

  it("keeps every scheduled route behind its reviewed authorization boundary", () => {
    const unprotectedRoutes = authFindings
      .filter((finding) => finding.currentMode === "unprotected")
      .map((finding) => finding.routePath);

    expect(unprotectedRoutes).toEqual([]);
    expect(
      authFindings.every(
        (finding) =>
          finding.targetMode === "admin-or-cron" ||
          finding.targetMode === "cron-secret-only",
      ),
    ).toBe(true);
    expect(CRON_AUTH_DIRECT_SECRET_ROUTES).toEqual({
      "/api/internal/sync-yahoo-players-to-sheet":
        "Internal destructive sheet sync; exact cron bearer only.",
    });
  });
});

describe("Vercel cron static source coverage", () => {
  const webRoot = process.cwd();
  const { crons } = JSON.parse(fs.readFileSync(path.resolve(webRoot, "vercel.json"), "utf8"));
  const findings = inspectVercelCronCoverage({ crons, webRoot });
  const unresolvedAuditRoutes = [
    "/api/internal/starter-board",
    "/api/internal/yahoo-live-draft",
    "/api/v1/db/replay-player-aliases",
  ];

  it("represents all configured entries without merging query or schedule identities", () => {
    expect(findings).toHaveLength(30);
    expect(findings.map(({ entryIndex, configuredPath, schedule }) => ({ entryIndex, configuredPath, schedule })))
      .toEqual(crons.map((entry: { path: string; schedule: string }, entryIndex: number) => ({
        entryIndex, configuredPath: entry.path, schedule: entry.schedule,
      })));
    expect(new Set(findings.map((finding) => finding.routePath)).size).toBe(21);
    expect(findings.filter((finding) => finding.inputReason || !finding.filePath)).toEqual([]);
    expect(findings.filter((finding) => finding.authMode === "unqualified")).toEqual([]);
    expect(findings.filter((finding) => finding.authMode === "cron-secret-only").map((finding) => finding.routePath).sort())
      .toEqual(["/api/internal/espn-sync", "/api/internal/fantrax-sync", "/api/internal/starter-board", "/api/internal/yahoo-live-draft"]);
    const windows = findings.filter((finding) => finding.routePath === "/api/v1/sustainability/rebuild-window-z");
    expect(windows.map((finding) => finding.queryString)).toEqual([
      "season=current&limit=250&offset=0", "season=current&limit=250&offset=250", "season=current&limit=250&offset=500",
    ]);
    expect(new Set(windows.map((finding) => finding.filePath)).size).toBe(1);
    expect(new Set(windows.map((finding) => finding.schedule)).size).toBe(3);
  });

  it("keeps every unresolved audit owner explicit rather than granting an exemption", () => {
    const routes = [...new Set(findings.filter((finding) => finding.auditMode === "unqualified").map((finding) => finding.routePath))].sort();
    expect(routes).toEqual(unresolvedAuditRoutes);
    expect(new Set(findings.filter((finding) => finding.auditMode === "shared-wrapper").map((finding) => finding.routePath)).size).toBe(18);
    for (const finding of findings.filter((finding) => finding.auditMode === "unqualified")) {
      expect(finding.auditReason).toContain("manual/helper-owned auditing remains unqualified (not an exemption)");
    }
  });

  it("qualifies the drafted-prospect refresh only through adminOnly(withCronJobAudit(...))", () => {
    const route = "/api/v1/db/update-drafted-prospects";
    const source = fs.readFileSync(path.resolve(webRoot, `pages${route}.ts`), "utf8");
    expect(classifyVercelCronSource(source, route)).toMatchObject({ authMode: "admin-or-cron", auditMode: "shared-wrapper" });
    expect(classifyVercelCronSource(source.replace("adminOnly(withCronJobAudit(", "adminOnly(("), route).auditMode).toBe("unqualified");
  });

  // 2026-10-24 (C5): yahoo-live-draft returns a withCronJobAudit delegate after
  // its exact secret prefix (plus a daily idle-heartbeat delegate), but the shared
  // classifier reviews delegates only for espn/fantrax/patreon. It stays
  // unqualified until that owner adds a reviewed yahoo form; no exemption.
  it("keeps yahoo-live-draft's runtime audit delegate statically unqualified", () => {
    const route = "/api/internal/yahoo-live-draft";
    const source = fs.readFileSync(path.resolve(webRoot, `pages${route}.ts`), "utf8");
    expect(source).toContain("const auditedPoll = withCronJobAudit(");
    expect(source).toContain("const auditedIdle = withCronJobAudit(");
    expect(source).toContain("  return auditedPoll(req, res);\n}");
    expect(classifyVercelCronSource(source, route)).toMatchObject({ authMode: "cron-secret-only", auditMode: "unqualified" });
  });

  it.each(["starter-board", "yahoo-live-draft", "fantrax-sync", "espn-sync"])(
    "binds %s qualification to its actual early rejection and supporting helper source", (name) => {
      const route = `/api/internal/${name}`;
      const source = fs.readFileSync(path.resolve(webRoot, `pages${route}.ts`), "utf8");
      expect(classifyVercelCronSource(source, route).authMode).toBe("cron-secret-only");
      expect(classifyVercelCronSource(source.replace("if (!secret", "if (secret"), route).authMode).toBe("unqualified");
      const bypass = name === "fantrax-sync" || name === "espn-sync"
        ? source.replace("!secretsMatch(bearerToken(req), secret)", "false")
        : source.replace('req.headers.authorization !== `Bearer ${secret}`', "false");
      expect(classifyVercelCronSource(bypass, route).authMode).toBe("unqualified");
      // Moving the same guard after work is not the reviewed early boundary.
      const late = source.replace('const secret = process.env.CRON_SECRET', 'await doWork(); const secret = process.env.CRON_SECRET');
      expect(classifyVercelCronSource(late, route).authMode).toBe("unqualified");
      if (name === "fantrax-sync" || name === "espn-sync") {
        expect(classifyVercelCronSource(source.replace('authorization.startsWith("Bearer ")', 'authorization.includes("Bearer ")'), route).authMode).toBe("unqualified");
        expect(classifyVercelCronSource(source.replace('"node:crypto"', '"unreviewed-crypto"'), route).authMode).toBe("unqualified");
      }
      expect(classifyVercelCronSource(source, "/api/internal/unreviewed").authMode).toBe("unqualified");
    },
  );

  it.each(["espn-sync", "fantrax-sync"])("qualifies only the actual auth-first %s audit delegate", (name) => {
    const route = `/api/internal/${name}`;
    const source = fs.readFileSync(path.resolve(webRoot, `pages${route}.ts`), "utf8");
    expect(classifyVercelCronSource(source, route).auditMode).toBe("shared-wrapper");
    expect(classifyVercelCronSource(source.replace("return auditedSync(req, res);", "return res.status(200).json({ skipped: true });"), route).auditMode).toBe("unqualified");
    expect(classifyVercelCronSource(source.replace("!secretsMatch(bearerToken(req), secret)", "false"), route).auditMode).toBe("unqualified");
    expect(classifyVercelCronSource(source.replace("return auditedSync(req, res);", "await doWork(); return auditedSync(req, res);"), route).auditMode).toBe("unqualified");
    expect(classifyVercelCronSource(source.replace("return auditedSync(req, res);", "return unauditedSync(req, res);"), route).auditMode).toBe("unqualified");
    expect(classifyVercelCronSource(source.replace('"lib/cron/withCronJobAudit"', '"unreviewed/audit"'), route).auditMode).toBe("unqualified");
  });

  it("requires Patreon's actual method-guarded audited delegate inside adminOnly", () => {
    const route = "/api/internal/patreon-reconcile";
    const source = fs.readFileSync(path.resolve(webRoot, `pages${route}.ts`), "utf8");
    expect(classifyVercelCronSource(source, route)).toMatchObject({ authMode: "admin-or-cron", auditMode: "shared-wrapper" });
    expect(classifyVercelCronSource(source.replace("return auditedReconcile(req, res);", "return res.json({ skipped: true });"), route).auditMode).toBe("unqualified");
    expect(classifyVercelCronSource(source.replace('if (req.method !== "GET")', "if (false)"), route).auditMode).toBe("unqualified");
  });

  it("qualifies reviewed exported wrappers, not imports, comments, strings or decoy calls", () => {
    const imports = `import adminOnly from "utils/adminOnlyMiddleware";
      import { withCronJobAudit } from "lib/cron/withCronJobAudit";`;
    for (const expression of ["adminOnly(withCronJobAudit(handler))", "withCronJobAudit(adminOnly(handler))", "adminOnly(withCronJobAudit(handler) as any)"]) {
      expect(classifyVercelCronSource(`${imports} export default ${expression};`, "/api/fixture"))
        .toMatchObject({ authMode: "admin-or-cron", auditMode: "shared-wrapper" });
    }
    expect(classifyVercelCronSource(`${imports}
      // adminOnly(withCronJobAudit(handler))
      const text = "adminOnly(withCronJobAudit(handler)) CRON_SECRET";
      const unused = adminOnly(withCronJobAudit(handler));
      export default handler;`, "/api/fixture"))
      .toMatchObject({ authMode: "unqualified", auditMode: "unqualified" });
    expect(classifyVercelCronSource(`${imports.replaceAll('"utils/adminOnlyMiddleware"', '"unknown"').replaceAll('"lib/cron/withCronJobAudit"', '"unknown"')}
      export default adminOnly(withCronJobAudit(handler));`, "/api/fixture"))
      .toMatchObject({ authMode: "unqualified", auditMode: "unqualified" });
    expect(classifyVercelCronSource(`${imports} export default unsupported(adminOnly(withCronJobAudit(handler)));`, "/api/fixture"))
      .toMatchObject({ authMode: "unqualified", auditMode: "unqualified" });
  });

  it("retains malformed or unsupported entries as explicit findings and bounds the input", () => {
    const invalid = [null, {}, { path: "/api/../escape", schedule: "* * * * *" },
      { path: "https://example.invalid/api/work", schedule: "* * * * *" },
      { path: "/api/work?bad=%zz", schedule: "* * * * *" },
      { path: "/api/work", schedule: "@daily" },
      { path: "/api/work", schedule: "99 * * * *" },
      { path: "/api/work", schedule: "* * * * 5-2" },
      { path: "/api/work", schedule: "* * * * *", unsupported: true }];
    const results = inspectVercelCronCoverage({ crons: invalid, webRoot });
    expect(results).toHaveLength(invalid.length);
    expect(results.every((finding) => finding.inputReason && !finding.filePath && finding.authMode === "unqualified" && finding.auditMode === "unqualified")).toBe(true);
    expect(() => inspectVercelCronCoverage({ crons: {}, webRoot })).toThrow("bounded array");
    expect(() => inspectVercelCronCoverage({ crons: Array(513).fill(null), webRoot })).toThrow("bounded array");
    expect(inspectVercelCronCoverage({ crons: Array(2), webRoot }).every((finding) => finding.inputReason)).toBe(true);
    const missing = inspectVercelCronCoverage({ crons: [{ path: "/api/nonexistent-static-fixture", schedule: "0 1 * * *" }], webRoot });
    expect(missing[0]).toMatchObject({ inputReason: null, filePath: null, authMode: "unqualified", auditMode: "unqualified" });
    expect(missing[0].auditReason).toContain("No Pages API route file");
  });
});


// This explicit scope excludes the concurrent/fenced consumers documented in
// tasks/codex-sprint-2026-10-19/security-cron-auth/OWNERSHIP.md.
const authFirstAuditRoutes = [
  "Teams/nst-team-stats.ts",
  "v1/db/backfill-goalie-underlying-season.ts",
  "v1/db/backfill-player-underlying-season.ts",
  "v1/db/backfill-team-underlying-season.ts",
  "v1/db/calculate-wigo-stats.ts",
  "v1/db/catch-up-goalie-underlying.ts",
  "v1/db/catch-up-player-underlying.ts",
  "v1/db/catch-up-team-underlying.ts",
  "v1/db/cron/update-stats-cron.ts",
  "v1/db/draft-ranker-health.ts",
  "v1/db/powerPlayTimeFrame.ts",
  "v1/db/refresh-draft-ranker-community.ts",
  "v1/db/refresh-draft-ranker-discovery.ts",
  "v1/db/register-nhl-xg-model.ts",
  "v1/db/run-fetch-wgo-data.ts",
  "v1/db/sustainability/rebuild-baselines.ts",
  "v1/db/update-PbP.ts",
  "v1/db/update-drafted-prospects.ts",
  "v1/db/update-entity-metric-rankings.ts",
  "v1/db/update-games.ts",
  "v1/db/update-goalie-underlying-stats.ts",
  "v1/db/update-goalie-underlying-summaries.ts",
  "v1/db/update-line-combinations/[id].ts",
  "v1/db/update-line-combinations/index.ts",
  "v1/db/update-lineup-deployment-tallies.ts",
  "v1/db/update-market-prices.ts",
  "v1/db/update-nhl-edge-stats.ts",
  "v1/db/update-nhl-play-by-play.ts",
  "v1/db/update-nhl-shift-charts.ts",
  "v1/db/update-nhl-xg-aggregates.ts",
  "v1/db/update-nhl-xg-shot-predictions.ts",
  "v1/db/update-nhlscraper-contracts.ts",
  "v1/db/update-nst-current-season.ts",
  "v1/db/update-nst-goalies.ts",
  "v1/db/update-nst-team-daily.ts",
  "v1/db/update-player-impact-ratings.ts",
  "v1/db/update-player-trend-metrics.ts",
  "v1/db/update-player-underlying-stats.ts",
  "v1/db/update-player-underlying-summaries.ts",
  "v1/db/update-player/[playerId].ts",
  "v1/db/update-players.ts",
  "v1/db/update-power-play-combinations/[gameId].ts",
  "v1/db/update-power-play-combinations/index.ts",
  "v1/db/update-rolling-games.ts",
  "v1/db/update-season-stats.ts",
  "v1/db/update-seasons.ts",
  "v1/db/update-shifts.ts",
  "v1/db/update-skater-composite-ratings.ts",
  "v1/db/update-sko-stats.ts",
  "v1/db/update-standings-details/index.ts",
  "v1/db/update-stats/[gameId].ts",
  "v1/db/update-team-ctpi-daily.ts",
  "v1/db/update-team-power-ratings.ts",
  "v1/db/update-team-sos.ts",
  "v1/db/update-team-unit-toi.ts",
  "v1/db/update-team-yearly-summary.ts",
  "v1/db/update-wgo-averages.ts",
  "v1/db/update-wgo-goalie-totals.ts",
  "v1/db/upsert-csv.ts",
  "v1/game-predictions/accuracy-loop.ts",
  "v1/game-predictions/backfill-feature-snapshots.ts",
  "v1/game-predictions/backtest-ablation.ts",
  "v1/game-predictions/backtest.ts",
  "v1/game-predictions/feature-signal-analysis.ts",
  "v1/game-predictions/forecast.ts",
  "v1/game-predictions/generate.ts",
  "v1/game-predictions/import-market-odds.ts",
  "v1/game-predictions/ingest-espn-odds.ts",
  "v1/game-predictions/promote-model-version.ts",
  "v1/game-predictions/score.ts",
  "v1/sustainability/process-recompute-queue.ts",
  "v1/sustainability/rebuild-priors.ts",
  "v1/sustainability/rebuild-score.ts",
  "v1/sustainability/rebuild-trend-bands.ts",
  "v1/sustainability/rebuild-window-z.ts",
] as const;

describe("scoped cron auth ordering", () => {
  it("authenticates before auditing every declared caller", () => {
    for (const route of authFirstAuditRoutes) {
      const source = fs.readFileSync(path.resolve(process.cwd(), "pages/api", route), "utf8");
      const ast = ts.createSourceFile(route, source, ts.ScriptTarget.Latest, true);
      const exported = ast.statements.find(ts.isExportAssignment)?.expression;
      expect(exported && ts.isCallExpression(exported), route).toBe(true);
      if (!exported || !ts.isCallExpression(exported)) continue;
      expect(exported.expression.getText(ast), route).toBe("adminOnly");
      const audited = exported.arguments[0];
      expect(audited && ts.isCallExpression(audited), route).toBe(true);
      if (!audited || !ts.isCallExpression(audited)) continue;
      expect(audited.expression.getText(ast), route).toBe("withCronJobAudit");
    }
  });
});

const authAuditMocks = vi.hoisted(() => ({
  auditInsert: vi.fn(),
  upsert: vi.fn(),
  getUser: vi.fn(),
  role: vi.fn(),
  tokenClient: vi.fn(),
  restGet: vi.fn(),
  buildSnapshot: vi.fn(),
  persistSnapshot: vi.fn(),
  reconcilePatreon: vi.fn(),
}));

vi.mock("lib/supabase/server", () => ({
  default: {
    from: vi.fn((table: string) => {
      if (table === "cron_job_audit") return { insert: authAuditMocks.auditInsert };
      if (table === "seasons") return { upsert: authAuditMocks.upsert };
      throw new Error(`Unexpected synthetic service table: ${table}`);
    }),
  },
}));
vi.mock("lib/supabase", () => ({ createClientWithToken: authAuditMocks.tokenClient }));
vi.mock("lib/NHL/base", () => ({ restGet: authAuditMocks.restGet }));
vi.mock("lib/draft-ranker/discoveryServer", () => ({
  buildDraftRankerDiscoverySnapshot: authAuditMocks.buildSnapshot,
  persistDraftRankerDiscoverySnapshot: authAuditMocks.persistSnapshot,
}));
vi.mock("lib/integrations/patreon/sync", () => ({ reconcilePatreonAccounts: authAuditMocks.reconcilePatreon }));

import refreshDiscovery from "pages/api/v1/db/refresh-draft-ranker-discovery";
import updateSeasons from "pages/api/v1/db/update-seasons";
import reconcilePatreon from "pages/api/internal/patreon-reconcile";

function authAuditResponse() {
  return {
    statusCode: 200,
    headersSent: false,
    headers: {} as Record<string, unknown>,
    body: undefined as any,
    status(code: number) { this.statusCode = code; return this; },
    setHeader(name: string, value: unknown) { this.headers[name] = value; return this; },
    json(body: unknown) { this.body = body; this.headersSent = true; return this; },
    send(body: unknown) { this.body = body; this.headersSent = true; return this; },
  };
}

const representativeAuditRoutes = [
  { route: "/api/v1/db/refresh-draft-ranker-discovery", jobName: "refresh-draft-ranker-discovery", handler: refreshDiscovery },
  { route: "/api/v1/db/update-seasons", jobName: "/api/v1/db/update-seasons", handler: updateSeasons },
  { route: "/api/internal/patreon-reconcile", jobName: "/api/internal/patreon-reconcile", handler: reconcilePatreon },
];

describe.each(representativeAuditRoutes)("$route authorization and audit boundary", ({ route, jobName, handler }) => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv("NODE_ENV", "test");
    vi.stubEnv("CRON_SECRET", "synthetic-cron-secret");
    vi.stubGlobal("fetch", vi.fn(() => { throw new Error("Network forbidden in auth/audit test"); }));
    authAuditMocks.auditInsert.mockResolvedValue({ error: null });
    authAuditMocks.upsert.mockResolvedValue({ error: null });
    authAuditMocks.restGet.mockResolvedValue({ data: [] });
    authAuditMocks.getUser.mockResolvedValue({ data: { user: { id: "synthetic-user" } }, error: null });
    authAuditMocks.role.mockResolvedValue({ data: { role: "admin" } });
    authAuditMocks.tokenClient.mockReturnValue({
      auth: { getUser: authAuditMocks.getUser },
      from: () => ({ select: () => ({ eq: () => ({ maybeSingle: authAuditMocks.role }) }) }),
    });
    authAuditMocks.buildSnapshot.mockResolvedValue({ projectionConsensus: [], signals: [], warningCodes: [] });
    authAuditMocks.reconcilePatreon.mockResolvedValue({ attempted: 1, synced: 1, failed: 0, results: [{ userId: "private-user-id", status: "synced" }] });
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  function request(authorization?: string, method = "GET") {
    return { method, url: route, headers: { authorization }, query: {}, body: {}, socket: { remoteAddress: "198.51.100.2" } } as any;
  }

  it.each([
    { name: "missing bearer", authorization: undefined, status: 401 },
    { name: "malformed bearer", authorization: "Bearer", status: 401 },
    { name: "invalid user token", authorization: "Bearer invalid-token", status: 401 },
    { name: "non-admin token", authorization: "Bearer member-token", status: 403 },
  ])("rejects $name without an audit insert or business operation", async ({ authorization, status }) => {
    if (authorization === "Bearer invalid-token") {
      authAuditMocks.getUser.mockResolvedValue({ data: { user: null }, error: new Error("invalid token") });
    }
    if (status === 403) authAuditMocks.role.mockResolvedValue({ data: { role: "member" } });
    const res = authAuditResponse();
    await handler(request(authorization), res as any);
    expect(res.statusCode).toBe(status);
    expect(res.body).toEqual({ success: false, message: status === 401 ? "Unauthorized." : "You are not an Admin." });
    expect(authAuditMocks.auditInsert).not.toHaveBeenCalled();
    expect(authAuditMocks.restGet).not.toHaveBeenCalled();
    expect(authAuditMocks.upsert).not.toHaveBeenCalled();
    expect(authAuditMocks.buildSnapshot).not.toHaveBeenCalled();
    expect(authAuditMocks.persistSnapshot).not.toHaveBeenCalled();
    expect(authAuditMocks.reconcilePatreon).not.toHaveBeenCalled();
  });

  it.each(["Bearer synthetic-cron-secret", "Bearer admin-token"])("retains one admitted audit for %s", async (authorization) => {
    const res = authAuditResponse();
    await handler(request(authorization), res as any);
    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);
    expect(authAuditMocks.auditInsert).toHaveBeenCalledTimes(1);
    expect(authAuditMocks.auditInsert).toHaveBeenCalledWith(expect.objectContaining({
      job_name: jobName,
      status: "success",
      details: expect.objectContaining({ method: "GET", url: route, statusCode: 200 }),
    }));
    if (authorization === "Bearer synthetic-cron-secret") expect(authAuditMocks.tokenClient).not.toHaveBeenCalled();
    else expect(authAuditMocks.getUser).toHaveBeenCalledTimes(1);
    if (route.endsWith("update-seasons")) {
      expect(authAuditMocks.restGet).toHaveBeenCalledWith("/season");
      expect(authAuditMocks.upsert).toHaveBeenCalledTimes(1);
    } else if (route === "/api/internal/patreon-reconcile") {
      expect(authAuditMocks.reconcilePatreon).toHaveBeenCalledExactlyOnceWith({});
      const row = authAuditMocks.auditInsert.mock.calls[0][0];
      expect(row.rows_affected).toBeNull();
      expect(row.details.rowsUpserted).toBeNull();
      expect(row.details.failedRows).toBeNull();
      expect(JSON.parse(row.details.response)).toEqual({ success: true, attempted: 1, synced: 1, failed: 0 });
      expect(JSON.stringify(row)).not.toContain("private-user-id");
    } else {
      expect(authAuditMocks.buildSnapshot).toHaveBeenCalledTimes(1);
    }
  });

  if (route === "/api/internal/patreon-reconcile") {
    it.each([
      { name: "empty", result: { attempted: 0, synced: 0, failed: 0, results: [] }, success: true },
      { name: "aggregate failure", result: { attempted: 1, synced: 0, failed: 1,
        results: [{ userId: "private-user-id", status: "failed", error: "private provider detail account-id league-id" }] }, success: false },
    ])("retains the $name API result with exactly one safe invocation receipt", async ({ result, success }) => {
      authAuditMocks.reconcilePatreon.mockResolvedValue(result);
      const res = authAuditResponse();
      await handler(request("Bearer synthetic-cron-secret"), res as any);
      expect(res.statusCode).toBe(200);
      expect(res.body).toEqual({ ...result, success });
      expect(authAuditMocks.reconcilePatreon).toHaveBeenCalledExactlyOnceWith({});
      expect(authAuditMocks.auditInsert).toHaveBeenCalledTimes(1);
      const row = authAuditMocks.auditInsert.mock.calls[0][0];
      const safe = { success, attempted: result.attempted, synced: result.synced, failed: result.failed };
      expect(row).toMatchObject({ job_name: route, status: success ? "success" : "failure", rows_affected: null,
        details: { statusCode: 200, rowsUpserted: null, failedRows: null, error: null, responseOutcome: { success } } });
      expect(JSON.parse(row.details.response)).toEqual(safe);
      for (const sensitive of ["private-user-id", "private provider detail", "account-id", "league-id", "synthetic-cron-secret"])
        expect(JSON.stringify(row)).not.toContain(sensitive);
    });

    it("keeps its fixed catch response and safe failure receipt", async () => {
      authAuditMocks.reconcilePatreon.mockRejectedValue(new Error("private provider detail"));
      const res = authAuditResponse();
      await handler(request("Bearer synthetic-cron-secret"), res as any);
      expect(res.statusCode).toBe(500);
      expect(res.body).toEqual({ error: "Patreon reconciliation failed." });
      expect(authAuditMocks.auditInsert).toHaveBeenCalledTimes(1);
      const row = authAuditMocks.auditInsert.mock.calls[0][0];
      expect(row).toMatchObject({ status: "failure", rows_affected: null, details: { rowsUpserted: null, failedRows: null, responseOutcome: {} } });
      expect(JSON.stringify(row)).not.toContain("private provider detail");
    });

    it("rejects an admitted unsupported method before auditing or reconciliation", async () => {
      const res = authAuditResponse();
      await handler(request("Bearer synthetic-cron-secret", "POST"), res as any);
      expect(res.statusCode).toBe(405);
      expect(res.headers.Allow).toBe("GET");
      expect(res.body).toEqual({ error: "Method Not Allowed" });
      expect(authAuditMocks.reconcilePatreon).not.toHaveBeenCalled();
      expect(authAuditMocks.auditInsert).not.toHaveBeenCalled();
    });
  }
});

it("retains admitted method rejection and its operational audit", async () => {
  vi.stubEnv("CRON_SECRET", "synthetic-cron-secret");
  authAuditMocks.auditInsert.mockClear();
  authAuditMocks.auditInsert.mockResolvedValue({ error: null });
  const res = authAuditResponse();
  try {
    await refreshDiscovery({
      method: "DELETE", url: "/api/v1/db/refresh-draft-ranker-discovery", query: {},
      headers: { authorization: "Bearer synthetic-cron-secret" },
    } as any, res as any);
    expect(res.statusCode).toBe(405);
    expect(res.headers.Allow).toEqual(["GET", "POST"]);
    expect(res.body).toEqual({ success: false, error: "Method not allowed." });
    expect(authAuditMocks.auditInsert).toHaveBeenCalledTimes(1);
    expect(authAuditMocks.auditInsert).toHaveBeenCalledWith(expect.objectContaining({
      status: "failure", details: expect.objectContaining({ statusCode: 405 }),
    }));
  } finally {
    vi.unstubAllEnvs();
  }
});
