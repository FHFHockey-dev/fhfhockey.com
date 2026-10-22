// @vitest-environment node
import { mkdtempSync, readFileSync, rmSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createNstFileBudgetStore, NstExecutionLimitError, withNstRequestBudget, type NstRequestControl } from "./requestBudget";

describe("NST shared local admission", () => {
  let directory: string;
  const control = (interval = 0, maxAttempts = 500, runtime = 4_000_000): NstRequestControl => ({
    minIntervalMs: interval, maxAttempts, attemptsStarted: 0, deadlineAt: Date.now() + runtime
  });
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-13T12:00:00Z"));
    directory = mkdtempSync(join(tmpdir(), "nst-budget-test-"));
  });
  afterEach(() => { vi.useRealTimers(); rmSync(directory, { recursive: true, force: true }); });
  const url = (n: number) => `https://data.naturalstattrick.com/playerteams.php?fd=2026-10-12&sit=${n}`;

  it("bursts small jobs but blocks canonical active duplicates across keys and stores", async () => {
    const firstStore = createNstFileBudgetStore(directory);
    const secondStore = createNstFileBudgetStore(directory);
    let finish!: () => void;
    const starts: number[] = [];
    const burstControl = () => ({ ...control(), plannedRequestCount: 3 });
    const first = withNstRequestBudget(`${url(1)}&key=first`, burstControl(), () => {
      starts.push(1); return new Promise<void>((resolve) => { finish = resolve; });
    }, firstStore);
    const duplicate = withNstRequestBudget("https://data.naturalstattrick.com/playerteams.php?KEY=second&sit=1&fd=2026%2D10%2D12#ignored", burstControl(), async () => { starts.push(2); }, secondStore);
    const distinct = withNstRequestBudget(url(3), burstControl(), async () => { starts.push(3); }, secondStore);
    await distinct;
    expect(starts).toEqual([1, 3]);
    await vi.advanceTimersByTimeAsync(100);
    expect(starts).toEqual([1, 3]);
    finish(); await first;
    await vi.advanceTimersByTimeAsync(100); await duplicate;
    expect(starts).toEqual([1, 3, 2]);
  });

  it("shares all four rolling windows across independent store instances", async () => {
    const stores = [createNstFileBudgetStore(directory), createNstFileBudgetStore(directory)];
    const times: number[] = [];
    for (let n = 0; n < 181; n++) {
      // Independent complete jobs below 40 URLs still share every window.
      const run = { ...control(), plannedRequestCount: 39 };
      const pending = withNstRequestBudget(url(n), run, async () => { times.push(Date.now()); }, stores[n % 2]);
      await vi.runAllTimersAsync(); await pending;
    }
    const origin = times[0];
    expect(times[39] - origin).toBe(0);
    expect(times[40] - origin).toBe(60_001);
    expect(times[80] - origin).toBe(300_001);
    expect(times[100] - origin).toBe(900_001);
    expect(times[180] - origin).toBe(3_600_001);
    for (const [duration, cap] of [[60_000, 40], [300_000, 80], [900_000, 100], [3_600_000, 180]]) {
      for (const time of times) expect(times.filter((start) => start >= time - duration && start <= time).length).toBeLessThanOrEqual(cap);
    }
  });

  it("admits only one of several local workers when another dispatch cannot fit their deadline", async () => {
    const starts: number[] = [];
    const pending = Array.from({ length: 4 }, (_, n) => withNstRequestBudget(url(n), control(0, 20, 1000), async () => {
      starts.push(Date.now());
    }, createNstFileBudgetStore(directory)));
    const results = await Promise.allSettled(pending);
    expect(starts).toHaveLength(1);
    expect(results.filter((result) => result.status === "rejected")).toHaveLength(3);
  });

  it("shares the minimum interval across separate local processes", async () => {
    vi.useRealTimers();
    const script = `
      const { createNstFileBudgetStore, withNstRequestBudget } = require('./lib/nst/requestBudget');
      const store = createNstFileBudgetStore(process.argv[1]);
      const control = { deadlineAt: Date.now() + 1000, maxAttempts: 1, attemptsStarted: 0, minIntervalMs: 0 };
      const starts = [];
      withNstRequestBudget('https://data.naturalstattrick.com/playerteams.php?worker=' + process.argv[2],
        control, async () => { starts.push(Date.now()); }, store)
        .catch(() => {}).then(() => process.stdout.write(JSON.stringify(starts)));
    `;
    const results = await Promise.all(Array.from({ length: 4 }, (_, n) => promisify(execFile)(process.execPath,
      ["-r", "ts-node/register/transpile-only", "-e", script, directory, String(n)], {
        cwd: process.cwd(), timeout: 8000,
        env: { NODE_ENV: "test", NODE_PATH: process.cwd(), NODE_OPTIONS: process.env.NODE_OPTIONS ?? "",
          TS_NODE_COMPILER_OPTIONS: '{"module":"commonjs","moduleResolution":"node"}' },
      }
    )));
    expect(results.flatMap((result) => JSON.parse(result.stdout))).toHaveLength(1);
  }, 10_000);

  it.each([0, -1, NaN, 21_000])("spaces retries and concurrent workers at least 21 seconds apart despite requested interval %s", async (interval) => {
    const store = createNstFileBudgetStore(directory);
    const starts: number[] = [];
    const pending = Array.from({ length: 3 }, (_, n) => withNstRequestBudget(url(n % 2), control(interval), async () => {
      starts.push(Date.now());
    }, store));
    await vi.runAllTimersAsync(); await Promise.all(pending);
    expect(starts.map((time) => time - starts[0])).toEqual([0, 21_000, 42_000]);
  });

  it.each([undefined, 0, -1, 1.5, NaN, Infinity, 40, 200])("does not use an invocation attempt cap as a burst count when full count is %s", async (plannedRequestCount) => {
    const store = createNstFileBudgetStore(directory);
    const starts: number[] = [];
    for (let n = 0; n < 2; n++) {
      const run = { ...control(0, 1), plannedRequestCount };
      const pending = withNstRequestBudget(url(n), run, async () => { starts.push(Date.now()); }, store);
      await vi.runAllTimersAsync(); await pending;
    }
    expect(starts[1] - starts[0]).toBe(21_000);
  });

  it("preserves paced-job clearance before a small job bursts", async () => {
    const store = createNstFileBudgetStore(directory);
    const starts: number[] = [];
    await withNstRequestBudget(url(1), control(), async () => { starts.push(Date.now()); }, store);
    const pending = withNstRequestBudget(url(2), { ...control(), plannedRequestCount: 39 },
      async () => { starts.push(Date.now()); }, store);
    await vi.runAllTimersAsync(); await pending;
    expect(starts[1] - starts[0]).toBe(21_000);
  });

  it("charges repeated URLs and failures to the same total network-attempt budget", async () => {
    const store = createNstFileBudgetStore(directory);
    const run = control(0, 2);
    const start = vi.fn(async () => { throw new Error("upstream failed"); });
    await expect(withNstRequestBudget(url(1), run, start, store)).rejects.toThrow("upstream failed");
    const retry = expect(withNstRequestBudget(url(1), run, start, store)).rejects.toThrow("upstream failed");
    await vi.runAllTimersAsync(); await retry;
    await expect(withNstRequestBudget(url(2), run, start, store)).rejects.toBeInstanceOf(NstExecutionLimitError);
    expect(start).toHaveBeenCalledTimes(2);
    const ledger = JSON.parse(readFileSync(join(directory, "attempts.json"), "utf8"));
    expect(ledger.attempts).toHaveLength(2);
    expect(ledger.attempts.every((attempt: any) => !attempt.active)).toBe(true);
  });

  it("does not dispatch when pacing or a held/crashed lock cannot fit the deadline", async () => {
    const store = createNstFileBudgetStore(directory);
    await withNstRequestBudget(url(1), control(21_000), async () => {}, store);
    const start = vi.fn(async () => {});
    await expect(withNstRequestBudget(url(2), control(21_000, 1, 1000), start, store)).rejects.toThrow("deadline");
    mkdirSync(join(directory, "lock"));
    const pending = withNstRequestBudget(url(2), control(0, 1, 100), start, store).catch((error) => error);
    await vi.runAllTimersAsync();
    expect(await pending).toBeInstanceOf(NstExecutionLimitError);
    expect(start).not.toHaveBeenCalled();
  });

  it("stores only a normalized URL hash and keeps crash reservations fail-closed", async () => {
    const store = createNstFileBudgetStore(directory);
    await withNstRequestBudget(`${url(1)}&key=synthetic-secret`, control(), async () => {}, store);
    expect(readFileSync(join(directory, "attempts.json"), "utf8")).not.toContain("synthetic-secret");
    store.transaction((ledger, save) => { ledger.attempts[0].startedAt = 0; save(); });
    const start = vi.fn(async () => {});
    await expect(withNstRequestBudget(url(2), control(), start, store)).rejects.toThrow("acknowledgement missing");
    expect(start).not.toHaveBeenCalled();
  });
});
