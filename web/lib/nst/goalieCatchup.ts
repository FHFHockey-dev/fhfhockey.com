import { createHash } from "node:crypto";

export const GOALIE_DATASETS = [
  "5v5Counts", "5v5Rates", "evCounts", "evRates", "allCounts",
  "allRates", "ppCounts", "ppRates", "pkCounts", "pkRates"
] as const;
export type GoalieDataset = typeof GOALIE_DATASETS[number];

const DAY_MS = 86_400_000;
const MAX_DATES = 14;
const MAX_STEPS = 7;
const MAX_ATTEMPTS = 60;
const STEP_MS = 220_000;
const COOLDOWN_MS = 600_000;

export function goalieDateMillis(date: string): number {
  const ms = Date.parse(`${date}T00:00:00.000Z`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !Number.isFinite(ms) ||
      new Date(ms).toISOString().slice(0, 10) !== date) {
    throw new Error(`Invalid goalie calendar date: ${date}`);
  }
  return ms;
}

export function completedGoalieDate(now: Date): string {
  if (!Number.isFinite(now.getTime())) throw new Error("Invalid goalie check time.");
  const today = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/New_York", year: "numeric", month: "2-digit", day: "2-digit"
  }).format(now);
  return new Date(goalieDateMillis(today) - DAY_MS).toISOString().slice(0, 10);
}

export type GoalieDayCoverage = {
  date: string;
  calendar: "final" | "no_games" | "unknown";
  allCounts: "complete" | "incomplete" | "unknown";
};

export type GoalieCompletionReceipt = {
  season: string;
  date: string;
  dataset: GoalieDataset;
  sourceVersion: string;
  status: "complete" | "empty_valid";
  parsedRows: number;
  mappedRows: number;
  writtenRows: number;
  outputAcknowledged: boolean;
  checkpointAcknowledged: boolean;
};

export type GoalieWorkHold = {
  season: string;
  date: string;
  dataset: GoalieDataset;
  reason: string;
};

export type GoalieWorkUnit = {
  key: string;
  date: string;
  dataset: GoalieDataset;
  state: "pending" | "complete" | "empty_valid" | "no_games" | "held";
  reason: string | null;
};

export type GoalieCatchupManifest = {
  version: 1;
  season: string;
  sourceVersion: string;
  scope: string;
  /** Immutable full pending cohort at creation; never substitute a chunk size. */
  plannedRequestCount: number;
  startDate: string;
  endDate: string;
  nextUnplannedDate: string | null;
  units: readonly GoalieWorkUnit[];
};

function receiptState(receipt: GoalieCompletionReceipt): GoalieWorkUnit["state"] {
  const counts = [receipt.parsedRows, receipt.mappedRows, receipt.writtenRows];
  if (!receipt.outputAcknowledged || !receipt.checkpointAcknowledged ||
      counts.some(count => !Number.isSafeInteger(count) || count < 0) ||
      counts.some(count => count !== counts[0])) return "held";
  if (receipt.status === "complete" && counts[0] > 0) return "complete";
  if (receipt.status === "empty_valid" && counts[0] === 0) return "empty_valid";
  return "held";
}

/** Pure proposal only. The IO adapter must persist the frozen manifest and
 * acknowledged receipts; this module does not prove that a database write ran. */
export function buildGoalieCatchupManifest(input: {
  season: string;
  sourceVersion: string;
  seasonStartDate: string;
  regularSeasonEndDate: string;
  startDate: string;
  now: Date;
  days: readonly GoalieDayCoverage[];
  receipts: readonly GoalieCompletionReceipt[];
  /** Persisted review holds survive daily manifests and source-version changes. */
  holds: readonly GoalieWorkHold[];
  readsComplete: boolean;
}): GoalieCatchupManifest {
  if (!/^\d{8}$/.test(input.season) || !input.sourceVersion.trim()) {
    throw new Error("Goalie manifest needs a season and source version.");
  }
  const seasonStart = goalieDateMillis(input.seasonStartDate);
  const seasonEnd = goalieDateMillis(input.regularSeasonEndDate);
  if (seasonStart > seasonEnd) throw new Error("Invalid goalie season bounds.");
  const start = Math.max(seasonStart, goalieDateMillis(input.startDate));
  const eligibleEnd = Math.min(seasonEnd, goalieDateMillis(completedGoalieDate(input.now)));
  const end = Math.min(eligibleEnd, start + (MAX_DATES - 1) * DAY_MS);
  const days = new Map<string, GoalieDayCoverage>();
  for (const day of input.days) {
    goalieDateMillis(day.date);
    if (days.has(day.date)) throw new Error("Duplicate goalie calendar observation.");
    days.set(day.date, day);
  }
  const receipts = new Map<string, GoalieCompletionReceipt>();
  for (const receipt of input.receipts) {
    if (receipt.season !== input.season || receipt.sourceVersion !== input.sourceVersion) continue;
    const key = `${receipt.season}/${receipt.date}/${receipt.dataset}`;
    if (receipts.has(key)) throw new Error("Duplicate goalie completion receipt.");
    receipts.set(key, receipt);
  }
  const holds = new Map<string, GoalieWorkHold>();
  for (const hold of input.holds) {
    if (hold.season !== input.season) continue;
    if (!hold.reason.trim()) throw new Error("Goalie review hold requires a reason.");
    holds.set(`${hold.season}/${hold.date}/${hold.dataset}`, hold);
  }
  const units: GoalieWorkUnit[] = [];
  for (let ms = start; ms <= end; ms += DAY_MS) {
    const date = new Date(ms).toISOString().slice(0, 10);
    const day = days.get(date);
    for (const dataset of GOALIE_DATASETS) {
      const key = `${input.season}/${date}/${dataset}`;
      const receipt = receipts.get(key);
      const hold = holds.get(key);
      let state: GoalieWorkUnit["state"] = "pending";
      let reason: string | null = null;
      if (hold) {
        state = "held";
        reason = hold.reason;
      } else if (!input.readsComplete || !day || day.calendar === "unknown" || day.allCounts === "unknown") {
        state = "held";
        reason = "Calendar or coverage read is incomplete.";
      } else if (day.calendar === "no_games") {
        if (day.allCounts === "incomplete") {
          state = "held";
          reason = "No-game calendar conflicts with expected goalie appearances.";
        } else state = "no_games";
      } else if (receipt) {
        state = receiptState(receipt);
        if (state === "held") reason = "Output or completion checkpoint is unacknowledged or inconsistent.";
        else if (dataset === "allCounts" && day.allCounts !== "complete") state = "pending";
      }
      units.push({ key, date, dataset, state, reason });
    }
  }
  const startDate = new Date(start).toISOString().slice(0, 10);
  const endDate = new Date(end).toISOString().slice(0, 10);
  const plannedRequestCount = units.filter(unit => unit.state === "pending").length;
  const scope = createHash("sha256").update(JSON.stringify({
    version: 1, season: input.season, sourceVersion: input.sourceVersion, startDate, endDate,
    units: units.map(({ key, state }) => [key, state]), plannedRequestCount
  })).digest("hex");
  return { version: 1, season: input.season, sourceVersion: input.sourceVersion, scope,
    plannedRequestCount, startDate, endDate, units,
    nextUnplannedDate: end < eligibleEnd ? new Date(end + DAY_MS).toISOString().slice(0, 10) : null };
}

/** Apply only a durable receipt returned by the caller's persistence adapter.
 * Ambiguity holds this unit; it cannot silently advance or retry it. */
export function acknowledgeGoalieUnit(
  manifest: GoalieCatchupManifest,
  receipt: GoalieCompletionReceipt,
  allCountsCoverage: "complete" | "incomplete" | "unknown"
): GoalieCatchupManifest {
  const key = `${receipt.season}/${receipt.date}/${receipt.dataset}`;
  const unit = manifest.units.find(value => value.key === key);
  if (!unit || receipt.sourceVersion !== manifest.sourceVersion) throw new Error("Receipt is outside the goalie manifest.");
  if (unit.state !== "pending") throw new Error("Only pending goalie units can be acknowledged; holds need reconciliation.");
  let state = receiptState(receipt);
  let reason = state === "held" ? "Output or completion checkpoint is unacknowledged or inconsistent." : null;
  if (receipt.dataset === "allCounts" && allCountsCoverage !== "complete") {
    state = "held";
    reason = "All-counts output does not establish expected goalie coverage.";
  }
  return { ...manifest, units: manifest.units.map(value => value.key === key ? { ...value, state, reason } : value) };
}

export type GoalieDailyBudget = { utcDate: string; steps: number; attempts: number };
export type GoalieStepDecision =
  | { allowed: false; reason: string; notBefore: string | null }
  | { allowed: true; units: readonly GoalieWorkUnit[]; plannedRequestCount: number;
      minIntervalMs: number; maxAttempts: number; deadlineAt: number };

/** Requires an acknowledged shared daily counter and a separate atomic claim.
 * These are proposed operating windows; this function activates no scheduler. */
export function planGoalieCatchupStep(input: {
  manifest: GoalieCatchupManifest;
  now: Date;
  budget: GoalieDailyBudget;
  sharedJobActive: boolean;
  lastDirectJobFinishedAt: string | null;
}): GoalieStepDecision {
  const now = input.now.getTime();
  if (!Number.isFinite(now)) throw new Error("Invalid goalie step time.");
  const pause = (reason: string, at?: number): GoalieStepDecision =>
    ({ allowed: false, reason, notBefore: at === undefined ? null : new Date(at).toISOString() });
  const utcDate = input.now.toISOString().slice(0, 10);
  const { budget, manifest } = input;
  if (budget.utcDate !== utcDate || !Number.isSafeInteger(budget.steps) || budget.steps < 0 ||
      !Number.isSafeInteger(budget.attempts) || budget.attempts < 0) return pause("Shared daily budget unavailable.");
  if (budget.steps >= MAX_STEPS || budget.attempts >= MAX_ATTEMPTS) return pause("Daily goalie budget exhausted.");
  if (input.sharedJobActive) return pause("Another shared NST job is active.");
  if (input.lastDirectJobFinishedAt !== null) {
    const finished = Date.parse(input.lastDirectJobFinishedAt);
    if (!Number.isFinite(finished)) return pause("Shared NST completion time is unknown.");
    if (finished + COOLDOWN_MS > now) return pause("Shared NST cooldown.", finished + COOLDOWN_MS);
  }
  const midnight = goalieDateMillis(utcDate);
  const windows = [[510, 515], [670, 770]]; // 08:30–08:35 and 11:10–12:50 UTC.
  const window = windows.find(([start, end]) => now >= midnight + start * 60_000 && now + STEP_MS <= midnight + end * 60_000);
  if (!window) {
    const next = windows.find(([start]) => midnight + start * 60_000 > now);
    return pause("Outside bounded goalie worker window.", next ? midnight + next[0] * 60_000 : midnight + DAY_MS + 510 * 60_000);
  }
  const pending = manifest.units.filter(unit => unit.state === "pending");
  if (!pending.length) return pause(manifest.units.some(unit => unit.state === "held") ? "Goalie coverage requires review." : "Goalie cohort complete.");
  if (!Number.isSafeInteger(manifest.plannedRequestCount) || manifest.plannedRequestCount < pending.length) {
    return pause("Invalid full goalie cohort plan.");
  }
  const burst = manifest.plannedRequestCount > 0 && manifest.plannedRequestCount < 40;
  const units = pending.slice(0, Math.min(burst ? 20 : 6, MAX_ATTEMPTS - budget.attempts));
  return { allowed: true, units, plannedRequestCount: manifest.plannedRequestCount,
    minIntervalMs: burst ? 0 : 21_000, maxAttempts: Math.min(units.length * 3, MAX_ATTEMPTS - budget.attempts),
    deadlineAt: now + STEP_MS };
}
