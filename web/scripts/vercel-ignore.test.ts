// @vitest-environment node
import { execFileSync, spawnSync } from "node:child_process";
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

const roots = ["web", "cms", "functions"] as const;
const commands = Object.fromEntries(roots.map(root => [root,
  JSON.parse(readFileSync(resolve(process.cwd(), "..", root, "vercel.json"), "utf8")).ignoreCommand,
]));
const fixtures: string[] = [];
afterEach(() => fixtures.splice(0).forEach(path => rmSync(path, { recursive: true, force: true })));

function fixture(changedPath: string) {
  const cwd = mkdtempSync(join(tmpdir(), "fhfh-vercel-ignore-"));
  fixtures.push(cwd);
  const git = (...args: string[]) => execFileSync("git", ["-c", "core.hooksPath=/dev/null", ...args], {
    cwd, encoding: "utf8", env: { ...process.env, GIT_CONFIG_GLOBAL: "/dev/null", GIT_CONFIG_NOSYSTEM: "1" },
  }).trim();
  const write = (path: string, value: string) => {
    mkdirSync(dirname(join(cwd, path)), { recursive: true });
    writeFileSync(join(cwd, path), value);
  };
  git("init", "--quiet");
  for (const root of roots) write(`${root}/fixture.txt`, "baseline");
  git("add", ".");
  git("-c", "user.name=Fixture", "-c", "user.email=fixture@example.invalid", "commit", "--quiet", "-m", "baseline");
  const previous = git("rev-parse", "HEAD");
  write(changedPath, "changed");
  git("add", ".");
  git("-c", "user.name=Fixture", "-c", "user.email=fixture@example.invalid", "commit", "--quiet", "-m", "change");
  return { cwd, previous };
}

function statuses(cwd: string, previous: string) {
  return roots.map(root => spawnSync("/bin/sh", ["-c", commands[root]], {
    cwd: join(cwd, root), env: { ...process.env, VERCEL_GIT_PREVIOUS_SHA: previous },
  }).status);
}

describe("Vercel project path filters", () => {
  it.each([
    ["AGENTS.md", [0, 0, 0]],
    ["web/pages/example.ts", [1, 0, 0]],
    ["web/package-lock.json", [1, 0, 0]],
    ["tasks/TASKS/cron-operations/cron-schedule.md", [1, 0, 0]],
    ["cms/schemas/example.ts", [0, 1, 0]],
    ["functions/api/example.py", [0, 0, 1]],
  ])("checks dependencies for %s", (path, expected) => {
    const { cwd, previous } = fixture(path as string);
    expect(statuses(cwd, previous)).toEqual(expected);
  });

  it.each(["", "missing-commit"])("builds when previous history is unavailable: %s", previous => {
    const { cwd } = fixture("AGENTS.md");
    expect(statuses(cwd, previous)).toEqual([1, 1, 1]);
  });

  it("retains the legacy root quarantine", () => {
    const config = JSON.parse(readFileSync(resolve(process.cwd(), "..", "vercel.json"), "utf8"));
    expect(config.ignoreCommand).toBe("exit 0");
  });
});
