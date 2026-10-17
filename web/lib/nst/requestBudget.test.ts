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

  it("permits parallel distinct URLs and prevents simultaneous duplicate URL dispatch", async () => {
    const firstStore = createNstFileBudgetStore(directory);
    const secondStore = createNstFileBudgetStore(directory);
    let finish!: () => void;
    const starts: number[] = [];
    const first = withNstRequestBudget(url(1), control(), () => {
      starts.push(1); return new Promise<void>((resolve) => { finish = resolve; });
    }, firstStore);
    const duplicate = withNstRequestBudget(url(1), control(), async () => { starts.push(2); }, secondStore);
    await withNstRequestBudget(url(3), control(), async () => { starts.push(3); }, secondStore);
    expect(starts).toEqual([1, 3]);
    finish(); await first;
    await vi.advanceTimersByTimeAsync(100); await duplicate;
    expect(starts).toEqual([1, 3, 2]);
  });

  it("shares all four rolling windows across independent store instances", async () => {
    const stores = [createNstFileBudgetStore(directory), createNstFileBudgetStore(directory)];
    const times: number[] = [];
    const run = control();
    for (let n = 0; n < 181; n++) {
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

  it("coordinates four separate local processes against the same 40-call minute budget", async () => {
    vi.useRealTimers();
    const script = `
      const { createNstFileBudgetStore, withNstRequestBudget } = require('./lib/nst/requestBudget');
      const store = createNstFileBudgetStore(process.argv[1]);
      const worker = process.argv[2];
      const control = { deadlineAt: Date.now() + 1000, maxAttempts: 20, attemptsStarted: 0, minIntervalMs: 0 };
      const starts = [];
      Promise.allSettled(Array.from({ length: 20 }, (_, n) => withNstRequestBudget(
        'https://data.naturalstattrick.com/playerteams.php?worker=' + worker + '&page=' + n,
        control, async () => { starts.push(Date.now()); }, store
      ))).then(() => process.stdout.write(JSON.stringify(starts)));
    `;
    const results = await Promise.all(Array.from({ length: 4 }, (_, n) => promisify(execFile)(process.execPath,
      ["-r", "ts-node/register/transpile-only", "-e", script, directory, String(n)], {
        cwd: process.cwd(), timeout: 8000,
        env: { NODE_ENV: "test", NODE_PATH: process.cwd(), TS_NODE_COMPILER_OPTIONS: '{"module":"commonjs","moduleResolution":"node"}' }
      }
    )));
    const starts = results.flatMap((result) => JSON.parse(result.stdout.toString()) as number[]).sort();
    expect(starts).toHaveLength(40);
    expect(starts.at(-1)! - starts[0]).toBeLessThan(60_000);
  }, 10_000);

  it("spaces retries and concurrent paced workers at least 21 seconds apart", async () => {
    const store = createNstFileBudgetStore(directory);
    const starts: number[] = [];
    const pending = Array.from({ length: 3 }, (_, n) => withNstRequestBudget(url(n % 2), control(21_000), async () => {
      starts.push(Date.now());
    }, store));
    await vi.runAllTimersAsync(); await Promise.all(pending);
    expect(starts.map((time) => time - starts[0])).toEqual([0, 21_000, 42_000]);
  });

  it("charges repeated URLs and failures to the same total network-attempt budget", async () => {
    const store = createNstFileBudgetStore(directory);
    const run = control(0, 2);
    const start = vi.fn(async () => { throw new Error("upstream failed"); });
    await expect(withNstRequestBudget(url(1), run, start, store)).rejects.toThrow("upstream failed");
    await expect(withNstRequestBudget(url(1), run, start, store)).rejects.toThrow("upstream failed");
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
