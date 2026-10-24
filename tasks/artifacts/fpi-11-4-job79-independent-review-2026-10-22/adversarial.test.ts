import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { resolveNstGamelogRequestPlan, resolveGoalieNstRequestPlan } from './lib/cron/nstBurstPlans';
import { assessNstRequestPlan } from './lib/cron/nstRateLimitPolicy';
import { createNstFileBudgetStore, withNstRequestBudget } from './lib/nst/requestBudget';

let directory: string;
beforeEach(() => { vi.useFakeTimers(); vi.setSystemTime(new Date('2026-10-22T12:00:00Z')); directory = mkdtempSync(join(tmpdir(), 'job79-review-ledger-')); });
afterEach(() => { vi.useRealTimers(); rmSync(directory, { recursive: true, force: true }); });
const url = (n: number) => `https://fixture.invalid/nst?item=${n}`;
const control = (count?: number, interval = 0, budget = 60_000) => ({ plannedRequestCount: count, minIntervalMs: interval,
  deadlineAt: Date.now() + budget, maxAttempts: 1, attemptsStarted: 0 });

it('retired scheduler clearance stays advisory and full diagnostics remain present', () => {
  const plan = resolveNstGamelogRequestPlan({ queuedDates: 1, requestCount: 20 });
  expect(plan).toMatchObject({ requestCount: 20, queuedDates: 1, requestIntervalMs: 0, burstAllowed: true,
    burstEligibleByRequestCount: true, usedExplicitInterval: false, explicitIntervalRejected: false,
    scheduleClearance: { allowed: false }, assessment: { isCompliant: true } });
});

it('retired small-job plan cannot skip a previous paced reservation', async () => {
  const store = createNstFileBudgetStore(directory); const times: number[] = [];
  await withNstRequestBudget(url(1), control(40, 21_000), async () => { times.push(Date.now()); }, store);
  const plan = resolveNstGamelogRequestPlan({ queuedDates: 1, requestCount: 20 });
  const next = withNstRequestBudget(url(2), control(plan.requestCount, plan.requestIntervalMs), async () => { times.push(Date.now()); }, store);
  await vi.advanceTimersByTimeAsync(20_999); expect(times).toHaveLength(1);
  await vi.advanceTimersByTimeAsync(1); await next; expect(times[1] - times[0]).toBe(21_000);
});

it('advisory small-job burst cannot exceed another job’s exhausted minute window', async () => {
  const store = createNstFileBudgetStore(directory);
  store.transaction((ledger, save) => { ledger.attempts = Array.from({ length: 40 }, (_, n) => ({ id: String(n), urlHash: String(n), startedAt: Date.now(), intervalMs: 0, active: false })); save(); });
  const plan = resolveNstGamelogRequestPlan({ queuedDates: 1, requestCount: 20 });
  const start = vi.fn(async () => {});
  await expect(withNstRequestBudget(url(1), control(plan.requestCount, plan.requestIntervalMs, 60_000), start, store)).rejects.toThrow('deadline');
  expect(start).not.toHaveBeenCalled();
});

it('a one-attempt resumed suffix retains the 40-URL original plan and 21-second floor', async () => {
  const store = createNstFileBudgetStore(directory); const times: number[] = [];
  await withNstRequestBudget(url(1), control(1), async () => { times.push(Date.now()); }, store);
  const plan = resolveNstGamelogRequestPlan({ queuedDates: 1, requestCount: 40 });
  expect(plan).toMatchObject({ requestCount: 40, requestIntervalMs: 21_000, burstAllowed: false });
  const next = withNstRequestBudget(url(2), control(plan.requestCount, plan.requestIntervalMs), async () => { times.push(Date.now()); }, store);
  await vi.runAllTimersAsync(); await next; expect(times[1] - times[0]).toBe(21_000);
});

it('an explicit long interval survives handoff to a subsequent small burst', async () => {
  const store = createNstFileBudgetStore(directory); const times: number[] = [];
  const plan = resolveGoalieNstRequestPlan({ queuedDates: 1, totalQueuedUrls: 1, maxPendingUrls: 1, explicitRequestIntervalMs: 30_000 });
  await withNstRequestBudget(url(1), control(plan.totalQueuedUrls, plan.requestIntervalMs), async () => { times.push(Date.now()); }, store);
  const next = withNstRequestBudget(url(2), control(1), async () => { times.push(Date.now()); }, store);
  await vi.runAllTimersAsync(); await next; expect(times[1] - times[0]).toBe(30_000);
});

it.each([-1, 0.5, NaN, Infinity])('invalid full count %s cannot authorize a burst', count => {
  const plan = resolveNstGamelogRequestPlan({ queuedDates: 1, requestCount: count });
  expect(plan.burstAllowed).toBe(false); expect(plan.requestIntervalMs).toBe(21_000); expect(plan.assessment.isCompliant).toBe(false);
});

it('large-job compliance requires 21 seconds even when raw windows allow shorter spacing', () => {
  expect(assessNstRequestPlan({ requestCount: 40, intervalMs: 20_999 }).isCompliant).toBe(false);
  expect(assessNstRequestPlan({ requestCount: 40, intervalMs: 21_000 }).isCompliant).toBe(true);
  expect(assessNstRequestPlan({ requestCount: 10000, intervalMs: 21_000 }).windowCounts.every(x => x.compliant)).toBe(true);
});
