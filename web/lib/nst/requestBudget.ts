import { createHash, randomUUID } from "node:crypto";
import { mkdirSync, readFileSync, renameSync, rmdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { canBurstNstRequests, NST_MIN_REQUEST_INTERVAL_MS, NST_RATE_LIMIT_WINDOWS } from "lib/cron/nstRateLimitPolicy";

export class NstExecutionLimitError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "NstExecutionLimitError";
  }
}

export type NstRequestControl = {
  deadlineAt: number;
  maxAttempts: number;
  attemptsStarted: number;
  minIntervalMs: number;
  // Authoritative URL count for the entire job, including work outside this
  // invocation's chunk. Omission never authorizes bursting.
  plannedRequestCount?: number;
};

type Attempt = { id: string; urlHash: string; startedAt: number; intervalMs: number; active: boolean };
type Ledger = { version: 1; attempts: Attempt[] };
export type NstBudgetStore = {
  // The callback must run synchronously under an exclusive admission lock.
  transaction<T>(update: (ledger: Ledger, save: () => void) => T): T | undefined;
};

export function createNstFileBudgetStore(directory: string): NstBudgetStore {
  const lock = join(directory, "lock");
  const file = join(directory, "attempts.json");
  return {
    transaction(update) {
      mkdirSync(directory, { recursive: true, mode: 0o700 });
      try {
        mkdirSync(lock, { mode: 0o700 });
      } catch (error: any) {
        if (error.code === "EEXIST") return undefined;
        throw error;
      }
      try {
        let ledger: Ledger;
        try {
          ledger = JSON.parse(readFileSync(file, "utf8"));
        } catch (error: any) {
          if (error.code !== "ENOENT") throw new NstExecutionLimitError("NST local budget ledger could not be read; admission stopped.");
          ledger = { version: 1, attempts: [] };
        }
        if (ledger.version !== 1 || !Array.isArray(ledger.attempts) || ledger.attempts.some((entry) =>
          typeof entry.id !== "string" || typeof entry.urlHash !== "string" ||
          !Number.isFinite(entry.startedAt) || entry.startedAt < 0 ||
          !Number.isFinite(entry.intervalMs) || entry.intervalMs < 0 || typeof entry.active !== "boolean")) {
          throw new NstExecutionLimitError("NST local budget ledger is invalid; admission stopped.");
        }
        return update(ledger, () => {
          const temporary = join(directory, `attempts-${process.pid}.tmp`);
          writeFileSync(temporary, JSON.stringify(ledger), { mode: 0o600 });
          renameSync(temporary, file);
        });
      } finally {
        rmdirSync(lock);
      }
    }
  };
}

// One ledger per OS user: different keys also share these conservative budgets.
// A Vercel/container /tmp directory is instance-local, never a distributed lock.
export const NST_BUDGET_COORDINATION_SCOPE = "same-user shared local filesystem; separate hosts/containers excluded";
const defaultStore = createNstFileBudgetStore(join(tmpdir(), `fhfhockey-nst-budget-${process.getuid?.() ?? "user"}`));
const HOUR_MS = 3_600_000;
const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

function assertCanStart(control: NstRequestControl) {
  if (Date.now() >= control.deadlineAt) throw new NstExecutionLimitError("NST run deadline reached.");
  if (control.attemptsStarted >= control.maxAttempts) throw new NstExecutionLimitError("NST run network-attempt budget reached.");
}

// Counts every network attempt, including repeated URLs/retries. This is at least
// as restrictive as unique-URL limits; provider retry exemptions are unverified.
export async function withNstRequestBudget<T>(
  url: string,
  control: NstRequestControl,
  start: () => Promise<T>,
  store: NstBudgetStore = defaultStore
): Promise<T> {
  const parsed = new URL(url);
  for (const key of Array.from(parsed.searchParams.keys())) {
    if (key.toLowerCase() === "key") parsed.searchParams.delete(key);
  }
  parsed.searchParams.sort();
  parsed.hash = "";
  const urlHash = createHash("sha256").update(parsed.toString()).digest("hex");
  const id = randomUUID();
  let pending: Promise<T> | undefined;
  while (!pending) {
    assertCanStart(control);
    const wait = store.transaction((ledger, save) => {
      const now = Date.now();
      assertCanStart(control);
      // A crash between reservation and dispatch is intentionally fail-closed.
      if (ledger.attempts.some((entry) => entry.startedAt === 0)) {
        throw new NstExecutionLimitError("NST dispatch acknowledgement missing; inspect local ledger before resuming.");
      }
      ledger.attempts = ledger.attempts.filter((entry) => entry.active || now - entry.startedAt <= HOUR_MS);
      let waitMs = ledger.attempts.some((entry) => entry.active && entry.urlHash === urlHash) ? 100 : 0;
      const intervalMs = control.minIntervalMs === 0 && canBurstNstRequests(control.plannedRequestCount ?? NaN)
        ? 0
        : Math.max(NST_MIN_REQUEST_INTERVAL_MS,
          Number.isFinite(control.minIntervalMs) ? control.minIntervalMs : NST_MIN_REQUEST_INTERVAL_MS);
      const last = ledger.attempts.at(-1);
      if (last) waitMs = Math.max(waitMs, last.startedAt + Math.max(last.intervalMs, intervalMs) - now);
      for (const window of NST_RATE_LIMIT_WINDOWS) {
        const inWindow = ledger.attempts.filter((entry) => now - entry.startedAt <= window.windowMs);
        if (inWindow.length >= window.maxRequests) {
          waitMs = Math.max(waitMs, inWindow[inWindow.length - window.maxRequests].startedAt + window.windowMs + 1 - now);
        }
      }
      if (waitMs > 0) return waitMs;
      const entry: Attempt = { id, urlHash, startedAt: 0, intervalMs, active: true };
      ledger.attempts.push(entry);
      save();
      control.attemptsStarted++;
      try {
        pending = start();
      } catch (error) {
        pending = Promise.reject(error);
      }
      void pending.catch(() => {});
      // Timestamp after dispatch so rolling-window expiry cannot precede it.
      entry.startedAt = Date.now();
      save();
      return 0;
    });
    if (!pending) {
      const waitMs = wait ?? 25;
      if (Date.now() + waitMs >= control.deadlineAt) {
        throw new NstExecutionLimitError("NST admission cannot fit inside the run deadline.");
      }
      await sleep(waitMs);
    }
  }
  try {
    return await pending;
  } finally {
    // Keep a crashed/unfinished call active rather than guessing it completed.
    while (store.transaction((ledger, save) => {
      const entry = ledger.attempts.find((attempt) => attempt.id === id);
      if (entry) entry.active = false;
      save();
      return true;
    }) !== true) {
      if (Date.now() >= control.deadlineAt) throw new NstExecutionLimitError("NST completion acknowledgement missing; inspect local ledger.");
      await sleep(25);
    }
  }
}
