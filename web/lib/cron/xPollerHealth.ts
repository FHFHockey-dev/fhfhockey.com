// FxTwitter poller health for the daily cron report. Pure: the reader in xPollerHealth.server.ts loads the rows.
//
// Per account, over the report window:
//   coverage  IFTTT rows the shadow also saw (xTimelinePairing), counted from the account's first shadow sighting (rows
//             from before the scraper started cannot be seen). For a switched account only IFTTT rows from before
//             switched_at count, because its IFTTT deliveries are dropped after the switch. The last 10 minutes are
//             left out, since those posts may still be in flight.
//   reads     poller runs (x_timeline_poll_runs) where the account's read succeeded; the longest and current failure
//             streaks; a run with no entry for the account counts as a failure. From poller v6, how many reads the
//             mirror served and how many page gaps went unrecovered (posts lost beyond the 100 it can page back).
//   enqueue   switched accounts only: each shadow first sighting at or after switched_at should have exactly one queue
//             row, written by the scraper (source 'fxtwitter'). This replaces IFTTT coverage once IFTTT stops.
//   incidents open watchdog alerts (x_timeline_alert_state) for the account.
import { pairShadowWithIfttt, type PairableIfttt, type PairableShadow } from "lib/sources/xTimelinePairing";

/** The cutover bar from the IFTTT-TO-FXTWITTER-CUTOVER debrief: coverage of at least 98%. */
export const COVERAGE_TARGET = 0.98;
const COVERAGE_CRITICAL = 0.9;
const READ_SUCCESS_WARNING = 0.8;
const READ_SUCCESS_CRITICAL = 0.5;
/** The watchdog's account_down threshold: 8 failed runs, about 16 minutes. */
const FAIL_STREAK_ALERT = 8;
const MISSED_SAMPLE_LIMIT = 3;
/** IFTTT rows this recent may still be in flight to the scraper (a failed read is retried 2 minutes later). */
export const COVERAGE_GRACE_MS = 10 * 60 * 1000;

export type HealthStatus = "healthy" | "warning" | "critical" | "unknown";

export type PollerAccount = { sourceKey: string; handle: string; hasQueue: boolean };
export type ShadowSighting = PairableShadow & { first_seen_at: string; text?: string | null };
export type IftttQueueEvent = PairableIfttt & { received_at: string };
export type PollRunRow = {
  response_id: number;
  source_key: string;
  run_at: string;
  ok: boolean;
  enqueue_error: string | null;
  via?: string | null;
  gap_state?: string | null;
};
export type QueueRowForSighting = { source_key: string; tweet_id: string; source: string | null };
export type IntakeProviderRow = { source_key: string; provider: string; switched_at: string | null };
export type WatchdogAlertRow = { alert_key: string; active: boolean; first_seen_at: string | null; detail: { note?: string } | null };

export type PostSample = { tweetId: string | null; at: string; text: string };

export type AccountPollerHealth = {
  sourceKey: string;
  handle: string;
  status: HealthStatus;
  provider: "ifttt" | "fxtwitter" | "unknown";
  switchedAt: string | null;
  coverage: { from: string; iftttRows: number; matched: number; rate: number | null; missed: number; samples: PostSample[] };
  reads: {
    runs: number;
    ok: number;
    rate: number | null;
    longestFailStreak: number;
    currentFailStreak: number;
    lastOkAt: string | null;
    mirrorReads: number;
    unrecoveredGaps: number;
  } | null;
  lastSightingAt: string | null;
  enqueue: {
    sightings: number;
    queuedOnce: number;
    missing: number;
    viaIfttt: number;
    doubleQueued: number;
    iftttAfterSwitch: number;
    samples: PostSample[];
  } | null;
  incidents: Array<{ key: string; since: string | null; note: string | null }>;
  notes: string[];
};

export type PollerHealth = {
  status: HealthStatus;
  windowStart: string;
  windowEnd: string;
  /** started: pg_cron runs of the job (x_timeline_poll_job_runs); missed: started runs that left no poller body. */
  runs: { started: number | null; captured: number; missed: number | null; longestGapMinutes: number | null; lastRunAt: string | null } | null;
  accounts: AccountPollerHealth[];
  incidents: Array<{ key: string; since: string | null; note: string | null }>;
  warnings: string[];
};

const ms = (value: string | null | undefined) => (value ? Date.parse(value) : Number.NaN);
const snippet = (text: string | null | undefined) => (text ?? "").replace(/\s+/g, " ").trim().slice(0, 120);
const rank: Record<HealthStatus, number> = { healthy: 0, unknown: 1, warning: 2, critical: 3 };
export const worstStatus = (statuses: HealthStatus[]): HealthStatus =>
  statuses.reduce<HealthStatus>((worst, status) => (rank[status] > rank[worst] ? status : worst), "healthy");

/** Read success and failure streaks for one account over the window's runs, oldest first. */
export function summariseReads(runs: PollRunRow[], sourceKey: string): NonNullable<AccountPollerHealth["reads"]> {
  const byRun = new Map<number, { at: string; ok: boolean }>();
  let mirrorReads = 0;
  let unrecoveredGaps = 0;
  for (const run of runs) {
    const entry = byRun.get(run.response_id) ?? { at: run.run_at, ok: false };
    if (run.source_key === sourceKey) {
      entry.ok = run.ok;
      if (run.ok && run.via === "mirror") mirrorReads++;
      if (run.gap_state === "unrecovered") unrecoveredGaps++;
    }
    byRun.set(run.response_id, entry);
  }
  const ordered = [...byRun.values()].sort((left, right) => ms(left.at) - ms(right.at));
  let longest = 0;
  let current = 0;
  let ok = 0;
  let lastOkAt: string | null = null;
  for (const run of ordered) {
    if (run.ok) {
      ok++;
      current = 0;
      lastOkAt = run.at;
    } else longest = Math.max(longest, ++current);
  }
  return { runs: ordered.length, ok, rate: ordered.length ? ok / ordered.length : null, longestFailStreak: longest, currentFailStreak: current, lastOkAt,
    mirrorReads, unrecoveredGaps };
}

/**
 * Captured runs against the runs pg_cron actually started (null when unknown: the cadence would over-count a paused
 * job), and the longest gap between captured runs, window edges included.
 */
export function summariseRunCadence(
  runs: PollRunRow[], windowStart: string, windowEnd: string, startedRuns: number | null = null,
): NonNullable<PollerHealth["runs"]> {
  const times = [...new Set(runs.map((run) => run.response_id))]
    .map((id) => ms(runs.find((run) => run.response_id === id)!.run_at))
    .sort((left, right) => left - right);
  const start = ms(windowStart);
  const end = ms(windowEnd);
  let longestGap = times.length ? 0 : (end - start) / 60_000;
  const edges = [start, ...times, end];
  for (let index = 1; index < edges.length; index++) longestGap = Math.max(longestGap, (edges[index]! - edges[index - 1]!) / 60_000);
  return {
    started: startedRuns,
    captured: times.length,
    missed: startedRuns === null ? null : Math.max(0, startedRuns - times.length),
    longestGapMinutes: Math.round(longestGap),
    lastRunAt: times.length ? new Date(times[times.length - 1]!).toISOString() : null,
  };
}

/** An account's status: the worst of its coverage, reads, enqueue parity, open incidents and switch state. */
export function accountStatus(account: Omit<AccountPollerHealth, "status">): HealthStatus {
  const { coverage, reads, enqueue, provider } = account;
  const statuses: HealthStatus[] = [];
  // One miss in a quiet day is a warning; critical needs a low rate and more than one miss.
  if (coverage.rate !== null)
    statuses.push(coverage.rate >= COVERAGE_TARGET ? "healthy" : coverage.rate < COVERAGE_CRITICAL && coverage.missed > 1 ? "critical" : "warning");
  if (reads?.rate != null) {
    statuses.push(reads.rate < READ_SUCCESS_CRITICAL ? "critical" : reads.rate < READ_SUCCESS_WARNING ? "warning" : "healthy");
    if (reads.longestFailStreak >= FAIL_STREAK_ALERT) statuses.push(provider === "fxtwitter" ? "critical" : "warning");
    if (reads.unrecoveredGaps > 0) statuses.push(provider === "fxtwitter" ? "critical" : "warning");
  } else if (coverage.rate === null && !enqueue) statuses.push("unknown"); // nothing measured; the section notes why reads are missing
  if (enqueue) {
    if (enqueue.missing > 0) statuses.push("critical");
    if (enqueue.viaIfttt + enqueue.doubleQueued + enqueue.iftttAfterSwitch > 0) statuses.push("warning");
  }
  if (account.incidents.length) statuses.push("critical");
  if (provider === "unknown") statuses.push("unknown");
  return worstStatus(statuses);
}

function incidentsFor(alerts: WatchdogAlertRow[], predicate: (key: string) => boolean) {
  return alerts
    .filter((alert) => alert.active && predicate(alert.alert_key))
    .map((alert) => ({ key: alert.alert_key, since: alert.first_seen_at, note: alert.detail?.note ?? null }));
}

export function assessPollerHealth(input: {
  accounts: PollerAccount[];
  windowStart: string;
  windowEnd: string;
  providers: IntakeProviderRow[] | null;
  shadow: ShadowSighting[];
  ifttt: IftttQueueEvent[];
  /** Null when x_timeline_poll_runs is unreadable (for example, its migration is not applied). */
  runs: PollRunRow[] | null;
  /** pg_cron runs of the poller job in the window (x_timeline_poll_job_runs); null when unknown. */
  startedRuns?: number | null;
  /** Why runs is null, completing "Poller run history …"; defaults to "is unavailable". */
  runsUnavailableReason?: string;
  /** Each account's earliest shadow sighting ever; coverage starts there. A missing key means no limit. */
  shadowStartedAt?: Record<string, string | null>;
  /** Queue rows for switched accounts' shadow sightings since their switch. */
  queueRows: QueueRowForSighting[];
  alerts: WatchdogAlertRow[] | null;
  warnings?: string[];
}): PollerHealth {
  const warnings = [...(input.warnings ?? [])];
  const start = ms(input.windowStart);
  const end = ms(input.windowEnd);
  const providerByKey = new Map((input.providers ?? []).map((row) => [row.source_key, row]));
  if (!input.providers) warnings.push("tweet_intake_providers is unreadable; switch state is unknown.");
  if (!input.runs) warnings.push(`Poller run history ${input.runsUnavailableReason ?? "(x_timeline_poll_runs) is unavailable"}; read success is unknown.`);
  if (!input.alerts) warnings.push("Watchdog state (x_timeline_alert_state) is unreadable.");
  const alerts = input.alerts ?? [];
  const shadow = [...input.shadow].sort((left, right) => ms(left.first_seen_at) - ms(right.first_seen_at));
  const pairing = pairShadowWithIfttt(shadow, input.ifttt);
  const pairedIftttIds = new Set(pairing.pairs.map((pair) => pair.ifttt.id));
  const runs = input.runs?.filter((run) => ms(run.run_at) >= start && ms(run.run_at) <= end) ?? null;

  const accounts = input.accounts.map((account): AccountPollerHealth => {
    const key = account.sourceKey;
    const providerRow = providerByKey.get(key);
    const provider: AccountPollerHealth["provider"] = providerRow?.provider === "fxtwitter" ? "fxtwitter" : providerRow?.provider === "ifttt" ? "ifttt" : "unknown";
    const switchedAt = provider === "fxtwitter" ? providerRow?.switched_at ?? null : null;
    const switchMs = switchedAt ? ms(switchedAt) : Number.POSITIVE_INFINITY;
    const notes: string[] = [];

    const iftttInWindow = input.ifttt.filter((event) => event.source_key === key && ms(event.received_at) >= start && ms(event.received_at) <= end);
    const startedAt = input.shadowStartedAt?.[key] ?? null;
    const coverageFrom = startedAt && ms(startedAt) > start ? startedAt : input.windowStart;
    const coverageUntil = Math.min(switchMs, end - COVERAGE_GRACE_MS);
    const beforeSwitch = iftttInWindow.filter((event) => ms(event.received_at) >= ms(coverageFrom) && ms(event.received_at) < coverageUntil);
    const missed = beforeSwitch.filter((event) => !pairedIftttIds.has(event.id));
    const coverage = {
      from: coverageFrom,
      iftttRows: beforeSwitch.length,
      matched: beforeSwitch.length - missed.length,
      rate: beforeSwitch.length ? (beforeSwitch.length - missed.length) / beforeSwitch.length : null,
      missed: missed.length,
      samples: missed.slice(0, MISSED_SAMPLE_LIMIT).map((event) => ({ tweetId: event.tweet_id, at: event.received_at, text: snippet(event.text) })),
    };
    if (!account.hasQueue) notes.push("No IFTTT queue for this account; coverage is not measured.");

    const accountShadow = shadow.filter((row) => row.source_key === key);
    const lastSightingAt = accountShadow.length ? accountShadow[accountShadow.length - 1]!.first_seen_at : null;

    let enqueue: AccountPollerHealth["enqueue"] = null;
    if (provider === "fxtwitter" && account.hasQueue && switchedAt) {
      const since = Math.max(start, switchMs);
      const sightings = accountShadow.filter((row) => ms(row.first_seen_at) >= since && ms(row.first_seen_at) <= end);
      const queued = new Map<string, QueueRowForSighting[]>();
      for (const row of input.queueRows.filter((item) => item.source_key === key)) queued.set(row.tweet_id, [...(queued.get(row.tweet_id) ?? []), row]);
      const doubled = new Set(pairing.pairs.filter((pair) => pair.shadow.source_key === key && pair.by === "rt_text").map((pair) => pair.shadow.tweet_id));
      const missing = sightings.filter((row) => !(queued.get(row.tweet_id)?.length));
      const viaIfttt = sightings.filter((row) => queued.get(row.tweet_id)?.some((item) => item.source !== "fxtwitter"));
      const doubleQueued = sightings.filter((row) => doubled.has(row.tweet_id) && queued.get(row.tweet_id)?.length);
      enqueue = {
        sightings: sightings.length,
        queuedOnce: sightings.filter((row) => queued.get(row.tweet_id)?.length === 1 && queued.get(row.tweet_id)![0]!.source === "fxtwitter"
          && !doubled.has(row.tweet_id)).length,
        missing: missing.length,
        viaIfttt: viaIfttt.length,
        doubleQueued: doubleQueued.length,
        iftttAfterSwitch: iftttInWindow.filter((event) => ms(event.received_at) >= switchMs).length,
        samples: missing.slice(0, MISSED_SAMPLE_LIMIT).map((row) => ({ tweetId: row.tweet_id, at: row.first_seen_at, text: snippet(row.full_text ?? row.text) })),
      };
    }

    const reads = runs ? summariseReads(runs, key) : null;
    const incidents = incidentsFor(alerts, (alertKey) => alertKey.endsWith(`:${key}`));

    const health = { sourceKey: key, handle: account.handle, status: "unknown" as HealthStatus, provider, switchedAt, coverage, reads, lastSightingAt, enqueue, incidents, notes };
    return { ...health, status: accountStatus(health) };
  });

  const incidents = incidentsFor(alerts, (alertKey) => !alertKey.includes(":"));
  const cadence = runs ? summariseRunCadence(runs, input.windowStart, input.windowEnd, input.startedRuns ?? null) : null;
  const overall: HealthStatus[] = accounts.map((account) => account.status);
  if (incidents.length) overall.push("critical");
  if (cadence && cadence.longestGapMinutes !== null && cadence.longestGapMinutes >= 12) overall.push("warning");
  if (cadence && cadence.longestGapMinutes !== null && cadence.longestGapMinutes >= 12)
    warnings.push(`The poller went ${cadence.longestGapMinutes} minutes without a captured run.`);
  if (cadence?.missed) {
    overall.push("warning");
    warnings.push(`${cadence.missed} of ${cadence.started} poller runs left no result (auth failure, timeout or empty body).`);
  }
  return { status: worstStatus(overall), windowStart: input.windowStart, windowEnd: input.windowEnd, runs: cadence, accounts, incidents, warnings };
}
