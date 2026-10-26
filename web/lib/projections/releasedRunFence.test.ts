import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// A tiny in-memory forge_runs table that honours the PostgREST filters the
// readers use, so the tests check which run is served, not call shapes.
const db = vi.hoisted(() => ({ rows: [] as Record<string, any>[], inserted: [] as Record<string, any>[] }));
vi.mock("lib/supabase/server", () => {
  const table = () => {
    let out = [...db.rows];
    const builder: any = {
      select: () => builder,
      eq: (column: string, value: unknown) => { out = out.filter((row) => row[column] === value); return builder; },
      not: (column: string, operator: string, value: unknown) => {
        if (operator === "is" && value === null) out = out.filter((row) => row[column] != null);
        else if (operator === "like" && typeof value === "string" && value.endsWith("*") && !value.slice(0, -1).includes("*")) {
          // SQL: NULL NOT LIKE x is not true, so null rows drop out too.
          out = out.filter((row) => row[column] != null && !String(row[column]).startsWith(value.slice(0, -1)));
        } else throw new Error(`unsupported not(${column}, ${operator})`);
        return builder;
      },
      or: (expression: string) => { out = out.filter((row) => matchesOr(row, expression)); return builder; },
      order: (column: string, options?: { ascending?: boolean }) => {
        const sign = options?.ascending === false ? -1 : 1;
        out = [...out].sort((a, b) => (a[column] < b[column] ? -sign : a[column] > b[column] ? sign : 0));
        return builder;
      },
      limit: (count: number) => { out = out.slice(0, count); return builder; },
      maybeSingle: () => Promise.resolve({ data: out[0] ?? null, error: null }),
      then: (resolve: (value: unknown) => unknown) => Promise.resolve(resolve({ data: out, error: null })),
      insert: (row: Record<string, any>) => {
        db.inserted.push(row);
        return { select: () => ({ single: () => Promise.resolve({ data: { run_id: "new-run" }, error: null }) }) };
      },
    };
    return builder;
  };
  return { default: { from: (name: string) => { if (name !== "forge_runs") throw new Error(name); return table(); } } };
});

// Evaluates a PostgREST logic tree (`a.op.v,and(...),or(...)`) over JSON-path columns.
function splitTopLevel(expression: string) {
  const parts: string[] = []; let depth = 0, quoted = false, start = 0;
  for (let i = 0; i < expression.length; i += 1) {
    const char = expression[i];
    if (char === '"') quoted = !quoted;
    else if (!quoted && char === "(") depth += 1;
    else if (!quoted && char === ")") depth -= 1;
    else if (!quoted && depth === 0 && char === ",") { parts.push(expression.slice(start, i)); start = i + 1; }
  }
  return [...parts, expression.slice(start)];
}
function matchesTerm(row: Record<string, any>, term: string): boolean {
  const group = /^(and|or)\((.*)\)$/.exec(term);
  if (group) {
    const terms = splitTopLevel(group[2]);
    return group[1] === "and" ? terms.every((t) => matchesTerm(row, t)) : terms.some((t) => matchesTerm(row, t));
  }
  const [, path, operator, raw] = /^([^.]+)\.(eq|is|like)\.(.*)$/.exec(term) ?? [];
  if (!path) throw new Error(`unsupported term ${term}`);
  const keys = path.split(/->>?/);
  let value: any = row;
  for (const key of keys) value = value == null ? null : value[key];
  const text = value == null ? null : String(value);
  const literal = raw.replace(/^"(.*)"$/, "$1");
  if (operator === "is" && literal === "null") return text === null;
  if (operator === "eq") return text === literal;
  if (operator === "like" && literal.endsWith("*") && !literal.slice(0, -1).includes("*")) {
    return text !== null && text.startsWith(literal.slice(0, -1));
  }
  throw new Error(`unsupported term ${term}`);
}
const matchesOr = (row: Record<string, any>, expression: string) => splitTopLevel(expression).some((t) => matchesTerm(row, t));

import { requireLatestSucceededRunId } from "./apiHelpers";
import { createRun } from "./queries/run-lifecycle-queries";
import { isOffReleaseGitSha, LOCAL_UNKNOWN_GIT_SHA, runHorizonFilter } from "./releasedRunFence";

// Satisfies the octoberBranch label gate; master ignores metrics.
const metrics = { input_provenance: { external_fantasy_input_contract: "excluded_from_native_inputs_v1" } };
const run = (run_id: string, created_at: string, git_sha: string | null) =>
  ({ run_id, as_of_date: "2026-10-18", status: "succeeded", created_at, git_sha, metrics });

describe("off-release run fence", () => {
  beforeEach(() => { db.rows = []; db.inserted = []; });

  it.each([null, undefined, "local:unknown", `local:${"a".repeat(40)}`])("treats git_sha %j as off-release", (sha) => {
    expect(isOffReleaseGitSha(sha)).toBe(true);
  });

  it.each(["a".repeat(40), "localhost-build"])("treats git_sha %j as released", (sha) => {
    expect(isOffReleaseGitSha(sha)).toBe(false);
  });

  it.each([
    ["a local", `local:${"b".repeat(40)}`],
    ["a null-sha", null],
  ])("serves the older released run when %s run is the latest", async (_label, sha) => {
    db.rows = [run("released", "2026-10-18T12:00:00Z", "a".repeat(40)), run("off-release", "2026-10-18T13:00:00Z", sha)];
    await expect(requireLatestSucceededRunId("2026-10-18")).resolves.toBe("released");
  });

  it("returns 404 when only off-release runs exist for the date", async () => {
    db.rows = [run("null-run", "2026-10-18T12:00:00Z", null), run("local-run", "2026-10-18T13:00:00Z", LOCAL_UNKNOWN_GIT_SHA)];
    await expect(requireLatestSucceededRunId("2026-10-18")).rejects.toMatchObject({ statusCode: 404 });
  });
});

describe("run horizon fence", () => {
  beforeEach(() => { db.rows = []; db.inserted = []; });
  const released = "a".repeat(40);
  const withMetrics = (row: ReturnType<typeof run>, extra: Record<string, unknown>) => ({ ...row, metrics: { ...metrics, ...extra } });
  const h1 = withMetrics(run("h1-run", "2026-10-18T14:15:00Z", released), { horizon_games: 1, resume: { scope_key: "h1:full" } });
  const h5 = withMetrics(run("h5-run", "2026-10-18T15:12:00Z", released), { horizon_games: 5, resume: { scope_key: "h5:full" } });

  it("sends the PostgREST horizon filter", () => {
    expect(runHorizonFilter()).toBe(
      'metrics->>horizon_games.eq.1,and(metrics->>horizon_games.is.null,'
      + 'or(metrics->resume->>scope_key.is.null,metrics->resume->>scope_key.like."h1:*"))');
  });

  it("serves the older h1 run when the daily h5 run is the latest", async () => {
    db.rows = [h1, h5];
    await expect(requireLatestSucceededRunId("2026-10-18")).resolves.toBe("h1-run");
    await expect(requireLatestSucceededRunId("2026-10-18", 5)).resolves.toBe("h5-run");
  });

  it.each([
    ["an unstamped h5 scope key", { resume: { scope_key: "h5:full" } }, "h1-run"],
    ["an unstamped h10 scope key", { resume: { scope_key: "h10:full" } }, "h1-run"],
    ["an unstamped h1 scope key", { resume: { scope_key: "h1:2026020101" } }, "legacy"],
    ["no stamp or scope key", {}, "legacy"],
  ])("reads a legacy latest run with %s by its scope", async (_label, extra, expected) => {
    db.rows = [h1, withMetrics(run("legacy", "2026-10-18T16:00:00Z", released), extra)];
    await expect(requireLatestSucceededRunId("2026-10-18")).resolves.toBe(expected);
  });

  it("returns 404 when only h5 runs exist for the date", async () => {
    db.rows = [h5];
    await expect(requireLatestSucceededRunId("2026-10-18")).rejects.toMatchObject({ statusCode: 404 });
  });
});

describe("run writer provenance", () => {
  const saved = { vercel: process.env.VERCEL_GIT_COMMIT_SHA, git: process.env.GIT_SHA };
  beforeEach(() => { db.rows = []; db.inserted = []; });
  afterEach(() => {
    for (const [key, value] of [["VERCEL_GIT_COMMIT_SHA", saved.vercel], ["GIT_SHA", saved.git]] as const) {
      if (value === undefined) delete process.env[key]; else process.env[key] = value;
    }
  });

  it.each([undefined, ""])("stamps local:unknown, never null, when no commit SHA is set (%j)", async (value) => {
    for (const key of ["VERCEL_GIT_COMMIT_SHA", "GIT_SHA"]) {
      if (value === undefined) delete process.env[key]; else process.env[key] = value;
    }
    await createRun("2026-10-18");
    expect(db.inserted).toEqual([expect.objectContaining({ git_sha: LOCAL_UNKNOWN_GIT_SHA })]);
  });

  it("stamps the run horizon at creation", async () => {
    await createRun("2026-10-18");
    await createRun("2026-10-18", 5);
    expect(db.inserted.map((row) => row.metrics.horizon_games)).toEqual([1, 5]);
  });

  it("stamps the executing producer closure beside the SHA, and an unknown one when the build has none", async () => {
    const closure = "e".repeat(64);
    vi.stubEnv("FORGE_PRODUCER_CLOSURE_SHA256", closure);
    await createRun("2026-10-18");
    vi.stubEnv("FORGE_PRODUCER_CLOSURE_SHA256", "not-a-hash");
    await createRun("2026-10-18");
    vi.unstubAllEnvs();
    expect(db.inserted.map((row) => row.metrics.producer_identity)).toEqual([
      { version: "forge-producer-closure-v1", invocations: [closure] },
      { version: "forge-producer-closure-v1", invocations: [null] }]);
  });

  it("stamps the deployment commit SHA when one is set", async () => {
    process.env.VERCEL_GIT_COMMIT_SHA = "c".repeat(40);
    await createRun("2026-10-18");
    expect(db.inserted).toEqual([expect.objectContaining({ git_sha: "c".repeat(40) })]);
  });
});
