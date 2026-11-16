import { describe, expect, it } from "vitest";

import { assessForgeBuildAdmission, assessThisForgeBuild } from "./forge-build-admission";
import { VERIFIED_FORGE_PRODUCER_CLOSURES } from "../lib/projections/verifiedForgeReleases";

const LISTED = "9944628e4582609bdff1c75ede8958a9bcddbd3be794b4212bdf7a3df3aa4ec0";
const UNLISTED = "a".repeat(64);
const SHA = "5c42cb14fb4e4ef1ff1cdaf64db1c668319b019c";
const isListed = (hash: string) => hash === LISTED;
const codes = (verdict: ReturnType<typeof assessForgeBuildAdmission>) => verdict.problems.map(problem => problem.code);

describe("assessForgeBuildAdmission", () => {
  it("passes a production build whose closure is listed and which has a full commit SHA", () => {
    const verdict = assessForgeBuildAdmission({ closureSha256: LISTED, isListed,
      env: { VERCEL_ENV: "production", VERCEL_GIT_COMMIT_SHA: SHA } });
    expect(verdict).toMatchObject({ production: true, action: "pass", closureSha256: LISTED, commitSha: SHA, problems: [] });
  });

  it("fails a production build whose closure is not listed", () => {
    const verdict = assessForgeBuildAdmission({ closureSha256: UNLISTED, isListed,
      env: { VERCEL_ENV: "production", VERCEL_GIT_COMMIT_SHA: SHA } });
    expect(verdict.action).toBe("fail");
    expect(codes(verdict)).toEqual(["closure_unlisted"]);
    expect(verdict.problems[0].message).toContain(UNLISTED);
  });

  it("fails a production build with neither VERCEL_GIT_COMMIT_SHA nor GIT_SHA (runs would stamp local:unknown)", () => {
    const verdict = assessForgeBuildAdmission({ closureSha256: LISTED, isListed, env: { VERCEL_ENV: "production" } });
    expect(verdict).toMatchObject({ action: "fail", commitSha: null });
    expect(codes(verdict)).toEqual(["commit_sha_missing"]);
    // An empty value falls through exactly as the run writer's `||` chain does.
    expect(codes(assessForgeBuildAdmission({ closureSha256: LISTED, isListed,
      env: { VERCEL_ENV: "production", VERCEL_GIT_COMMIT_SHA: "", GIT_SHA: "" } }))).toEqual(["commit_sha_missing"]);
  });

  it("accepts GIT_SHA when VERCEL_GIT_COMMIT_SHA is absent, and rejects a short or uppercase SHA", () => {
    expect(assessForgeBuildAdmission({ closureSha256: LISTED, isListed,
      env: { VERCEL_ENV: "production", GIT_SHA: SHA } })).toMatchObject({ action: "pass", commitSha: SHA });
    for (const sha of [SHA.slice(0, 10), SHA.toUpperCase()]) {
      expect(codes(assessForgeBuildAdmission({ closureSha256: LISTED, isListed,
        env: { VERCEL_ENV: "production", GIT_SHA: sha } }))).toEqual(["commit_sha_malformed"]);
    }
  });

  it("fails a production build whose closure hash was not computed (next.config.js defines it empty)", () => {
    const verdict = assessForgeBuildAdmission({ closureSha256: "", isListed: () => true,
      env: { VERCEL_ENV: "production", VERCEL_GIT_COMMIT_SHA: SHA } });
    expect(verdict.action).toBe("fail");
    expect(codes(verdict)).toEqual(["closure_missing"]);
  });

  it("fails a production build when the allowlist cannot be read, never treating it as listed", () => {
    const verdict = assessForgeBuildAdmission({ closureSha256: LISTED,
      isListed: () => { throw new Error("module not found"); },
      env: { VERCEL_ENV: "production", VERCEL_GIT_COMMIT_SHA: SHA } });
    expect(verdict.action).toBe("fail");
    expect(codes(verdict)).toEqual(["allowlist_unreadable"]);
  });

  it("reports every problem at once", () => {
    const verdict = assessForgeBuildAdmission({ closureSha256: UNLISTED, isListed, env: { VERCEL_ENV: "production" } });
    expect(codes(verdict)).toEqual(["closure_unlisted", "commit_sha_missing"]);
  });

  it("only warns on preview and local builds, with the same problems", () => {
    for (const env of [{ VERCEL_ENV: "preview" }, { VERCEL_ENV: "development" }, {}]) {
      const verdict = assessForgeBuildAdmission({ closureSha256: UNLISTED, isListed, env });
      expect(verdict).toMatchObject({ production: false, action: "warn" });
      expect(codes(verdict)).toEqual(["closure_unlisted", "commit_sha_missing"]);
    }
    expect(assessForgeBuildAdmission({ closureSha256: LISTED, isListed,
      env: { VERCEL_ENV: "preview", VERCEL_GIT_COMMIT_SHA: SHA } }).action).toBe("pass");
  });
});

describe("assessThisForgeBuild", () => {
  it("checks the real allowlist through the readers' lookup", () => {
    const listed = VERIFIED_FORGE_PRODUCER_CLOSURES[0].closureSha256;
    const env = { VERCEL_ENV: "production", VERCEL_GIT_COMMIT_SHA: SHA };
    expect(assessThisForgeBuild(listed, env).action).toBe("pass");
    expect(assessThisForgeBuild(UNLISTED, env).action).toBe("fail");
  });
});
