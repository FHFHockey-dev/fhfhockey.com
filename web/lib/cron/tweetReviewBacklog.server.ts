import type { SupabaseClient } from "@supabase/supabase-js";
import { countRemainingByType } from "lib/sources/tweetSwipeTrainerServer";
import {
  buildTweetBacklog,
  countDistinctNames,
  parseBacklogSnapshot,
  snapshotCounts,
  type TweetBacklog,
  type TweetBacklogCounts,
} from "./tweetReviewBacklog";

const NAME_PAGE = 1000;
const NAME_MAX_PAGES = 10;

/**
 * Report adapter. Counts are head-only except the distinct-name count, which reads one short column of the pending
 * names (at most 10 pages). With `writeSnapshot`, today's counts are upserted into tweet_review_backlog_snapshots so
 * tomorrow's report can show the change; that table comes from migration 20261106230000, and until it is applied the
 * changes are blank and a warning says why.
 */
export async function readTweetBacklog(input: { client: SupabaseClient; now: Date; writeSnapshot: boolean }): Promise<TweetBacklog> {
  const db = input.client as any;
  const snapshotDate = input.now.toISOString().slice(0, 10);
  const warnings: string[] = [];
  const settle = async <T>(label: string, read: () => Promise<T>): Promise<T | undefined> => {
    try {
      return await read();
    } catch (error) {
      warnings.push(`${label} unavailable: ${error instanceof Error ? error.message : String(error)}`);
      return undefined;
    }
  };
  const headCount = async (query: PromiseLike<{ count: number | null; error: { message: string } | null }>) => {
    const { count, error } = await query;
    if (error) throw new Error(error.message);
    return count ?? 0;
  };

  const [trainer, answerKeyLabels, unresolvedRows, unresolvedNames, previousRow] = await Promise.all([
    settle("Swipe-trainer queue", () => countRemainingByType(db)),
    settle("Answer-key labels", () => headCount(db.from("tweet_pattern_review_items")
      .select("id", { count: "exact", head: true }).not("metadata->answerKey", "is", null))),
    settle("Unresolved names", () => headCount(db.from("lineup_unresolved_player_names")
      .select("id", { count: "exact", head: true }).eq("status", "pending"))),
    settle("Distinct unresolved names", async () => {
      const rows: Array<{ normalized_name: string | null; raw_name: string | null }> = [];
      for (let page = 0; page < NAME_MAX_PAGES; page++) {
        const { data, error } = await db.from("lineup_unresolved_player_names").select("normalized_name, raw_name")
          .eq("status", "pending").order("id").range(page * NAME_PAGE, (page + 1) * NAME_PAGE - 1);
        if (error) throw new Error(error.message);
        rows.push(...(data ?? []));
        if ((data ?? []).length < NAME_PAGE) return countDistinctNames(rows);
      }
      throw new Error(`more than ${NAME_PAGE * NAME_MAX_PAGES} pending rows`);
    }),
    settle("Yesterday's backlog snapshot", async () => {
      const { data, error } = await db.from("tweet_review_backlog_snapshots").select("snapshot_date, counts")
        .lt("snapshot_date", snapshotDate).order("snapshot_date", { ascending: false }).limit(1).maybeSingle();
      if (error) throw new Error(error.message);
      return data as { snapshot_date: string; counts: unknown } | null;
    }),
  ]);

  const previousCounts = previousRow ? parseBacklogSnapshot(previousRow.counts) : null;
  if (previousRow && !previousCounts) warnings.push(`Backlog snapshot ${previousRow.snapshot_date} has an unexpected shape; changes are blank.`);
  const current: Partial<TweetBacklogCounts> = { trainer, answerKeyLabels, unresolvedRows, unresolvedNames };
  const backlog = buildTweetBacklog({
    snapshotDate,
    current,
    previous: previousRow && previousCounts ? { snapshotDate: previousRow.snapshot_date, counts: previousCounts } : null,
    warnings,
  });

  const counts = snapshotCounts(backlog);
  if (input.writeSnapshot && counts) {
    const { error } = await db.from("tweet_review_backlog_snapshots")
      .upsert({ snapshot_date: snapshotDate, counts, captured_at: input.now.toISOString() }, { onConflict: "snapshot_date" });
    if (error) backlog.warnings.push(`Today's backlog snapshot was not saved: ${error.message}`);
  }
  return backlog;
}
