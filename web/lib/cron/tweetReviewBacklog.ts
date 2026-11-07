// Tweet-review backlog for the daily cron report: the swipe-trainer queue by type, answer-key labels and pending
// unresolved player names, each with its change since the previous daily snapshot (tweet_review_backlog_snapshots).
// Pure: the reader in tweetReviewBacklog.server.ts loads the counts.
import { TRAINER_TYPE_ORDER, type TrainerType } from "lib/sources/tweetSwipeTrainer";

export type TweetBacklogCounts = {
  trainer: Partial<Record<TrainerType, number>>;
  answerKeyLabels: number;
  unresolvedRows: number;
  unresolvedNames: number;
};

export type TweetBacklogItem = { key: string; label: string; count: number | null; previous: number | null; delta: number | null };

export type TweetBacklog = {
  status: "ok" | "partial" | "unknown";
  snapshotDate: string;
  previousDate: string | null;
  queue: TweetBacklogItem[];
  answerKeyLabels: TweetBacklogItem;
  unresolvedRows: TweetBacklogItem;
  unresolvedNames: TweetBacklogItem;
  warnings: string[];
};

const TRAINER_LABELS: Record<TrainerType, string> = {
  line_combination: "Line combos",
  goalie: "Goalies",
  injury: "Injuries",
  transaction: "Transactions",
  other: "Other",
};

const count = (value: unknown): number | null => (Number.isSafeInteger(value) && Number(value) >= 0 ? Number(value) : null);

/** A stored snapshot's counts, or null when the shape is not one this module wrote. */
export function parseBacklogSnapshot(value: unknown): TweetBacklogCounts | null {
  if (!value || typeof value !== "object") return null;
  const raw = value as Record<string, unknown>;
  const trainerRaw = raw.trainer && typeof raw.trainer === "object" ? (raw.trainer as Record<string, unknown>) : null;
  const answerKeyLabels = count(raw.answerKeyLabels);
  const unresolvedRows = count(raw.unresolvedRows);
  const unresolvedNames = count(raw.unresolvedNames);
  if (!trainerRaw || answerKeyLabels === null || unresolvedRows === null || unresolvedNames === null) return null;
  const trainer: Partial<Record<TrainerType, number>> = {};
  for (const type of TRAINER_TYPE_ORDER) {
    const value = count(trainerRaw[type]);
    if (value !== null) trainer[type] = value;
  }
  return { trainer, answerKeyLabels, unresolvedRows, unresolvedNames };
}

/** Distinct pending names, keyed like the alias flow: the normalised name when present, else the trimmed raw name. */
export function countDistinctNames(rows: Array<{ normalized_name: string | null; raw_name: string | null }>): number {
  return new Set(rows.map((row) => (row.normalized_name?.trim() || row.raw_name?.trim().toLowerCase() || "")).filter(Boolean)).size;
}

function item(key: string, label: string, current: number | null | undefined, previous: number | null | undefined): TweetBacklogItem {
  const now = current ?? null;
  const before = previous ?? null;
  return { key, label, count: now, previous: before, delta: now !== null && before !== null ? now - before : null };
}

export function buildTweetBacklog(input: {
  snapshotDate: string;
  current: Partial<TweetBacklogCounts>;
  previous: { snapshotDate: string; counts: TweetBacklogCounts } | null;
  warnings?: string[];
}): TweetBacklog {
  const { current, previous } = input;
  const before = previous?.counts;
  const queue = TRAINER_TYPE_ORDER.map((type) => item(type, TRAINER_LABELS[type], current.trainer?.[type], before?.trainer[type]));
  const backlog = {
    snapshotDate: input.snapshotDate,
    previousDate: previous?.snapshotDate ?? null,
    queue,
    answerKeyLabels: item("answer_key_labels", "Answer-key labels", current.answerKeyLabels, before?.answerKeyLabels),
    unresolvedRows: item("unresolved_rows", "Unresolved names (rows)", current.unresolvedRows, before?.unresolvedRows),
    unresolvedNames: item("unresolved_names", "Unresolved names (distinct)", current.unresolvedNames, before?.unresolvedNames),
    warnings: [...(input.warnings ?? [])],
  };
  const all = [...queue, backlog.answerKeyLabels, backlog.unresolvedRows, backlog.unresolvedNames];
  const known = all.filter((entry) => entry.count !== null).length;
  return { ...backlog, status: known === all.length ? "ok" : known === 0 ? "unknown" : "partial" };
}

/** The counts to store as today's snapshot; null unless every count is known. */
export function snapshotCounts(backlog: TweetBacklog): TweetBacklogCounts | null {
  const values = [...backlog.queue, backlog.answerKeyLabels, backlog.unresolvedRows, backlog.unresolvedNames];
  if (values.some((entry) => entry.count === null)) return null;
  return {
    trainer: Object.fromEntries(backlog.queue.map((entry) => [entry.key, entry.count])) as Partial<Record<TrainerType, number>>,
    answerKeyLabels: backlog.answerKeyLabels.count!,
    unresolvedRows: backlog.unresolvedRows.count!,
    unresolvedNames: backlog.unresolvedNames.count!,
  };
}
