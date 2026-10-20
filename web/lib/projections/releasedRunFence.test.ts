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

import { requireLatestSucceededRunId } from "./apiHelpers";
import { createRun } from "./queries/run-lifecycle-queries";
import { isOffReleaseGitSha, LOCAL_UNKNOWN_GIT_SHA } from "./releasedRunFence";

const run = (run_id: string, created_at: string, git_sha: string | null) =>
  ({ run_id, as_of_date: "2026-10-18", status: "succeeded", created_at, git_sha });

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

  it("stamps the deployment commit SHA when one is set", async () => {
    process.env.VERCEL_GIT_COMMIT_SHA = "c".repeat(40);
    await createRun("2026-10-18");
    expect(db.inserted).toEqual([expect.objectContaining({ git_sha: "c".repeat(40) })]);
  });
});
