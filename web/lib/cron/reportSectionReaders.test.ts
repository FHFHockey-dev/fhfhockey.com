// The cron report's poller-health and backlog readers before migration 20261106201221 is applied: missing tables give a
// short "not installed" note, never a throw.
import { describe, expect, it, vi } from "vitest";
import { readPollerHealth } from "./xPollerHealth.server";
import { readTweetBacklog } from "./tweetReviewBacklog.server";

vi.mock("lib/sources/tweetSwipeTrainerServer", () => ({
  countRemainingByType: async () => ({ line_combination: 1400, goalie: 1830, injury: 644, transaction: 192 }),
}));

const MISSING = { data: null, count: null, error: { code: "PGRST205", message: "Could not find the table in the schema cache" } };

/** Every query method chains; awaiting the chain resolves to the table's result. Writes are recorded. */
function fakeClient(results: Record<string, unknown>) {
  const writes: string[] = [];
  const client = {
    from(table: string) {
      const result = results[table] ?? { data: [], count: 0, error: null };
      const chain: any = new Proxy({}, {
        get(_target, key) {
          if (key === "then") return (resolve: (value: unknown) => void) => resolve(result);
          return (..._args: unknown[]) => {
            if (key === "upsert" || key === "insert") writes.push(table);
            return chain;
          };
        },
      });
      return chain;
    },
  };
  return { client: client as any, writes };
}

const now = new Date("2026-11-06T20:00:00Z");

describe("readPollerHealth before the migration", () => {
  it("notes the missing run history once and still measures coverage", async () => {
    const { client } = fakeClient({
      x_timeline_poll_runs: MISSING,
      x_timeline_poll_job_runs: MISSING,
      tweet_intake_providers: { data: [{ source_key: "dfofantasy", provider: "ifttt", switched_at: null }], error: null },
      x_timeline_shadow_posts: { data: [{ source_key: "dfofantasy", tweet_id: "1", post_kind: "post", full_text: "A",
        original_author_handle: null, first_seen_at: "2026-11-06T10:00:00Z" }], error: null },
      line_source_ifttt_events: { data: [{ id: "a", source_key: "dfofantasy", tweet_id: "1", text: "A", received_at: "2026-11-06T10:01:00Z" }], error: null },
    });
    const health = await readPollerHealth({ client, now, windowMs: 24 * 3600_000, deadlineAt: Date.now() + 5_000 });
    expect(health.runs).toBeNull();
    expect(health.warnings).toEqual(["Poller run history is not installed yet (migration 20261106201221 not applied); read success is unknown."]);
    expect(health.accounts.find((account) => account.sourceKey === "dfofantasy")?.coverage).toMatchObject({ iftttRows: 1, matched: 1 });
  });

  it("returns an unknown section instead of throwing when a required read fails", async () => {
    const { client } = fakeClient({ x_timeline_shadow_posts: { data: null, error: { code: "57014", message: "statement timeout" } } });
    const health = await readPollerHealth({ client, now, windowMs: 24 * 3600_000, deadlineAt: Date.now() + 5_000 });
    expect(health.status).toBe("unknown");
    expect(health.warnings.at(-1)).toMatch(/statement timeout/);
  });
});

describe("readTweetBacklog before the migration", () => {
  it("shows today's counts, notes that changes are not installed and writes nothing", async () => {
    const { client, writes } = fakeClient({
      tweet_review_backlog_snapshots: MISSING,
      lineup_unresolved_player_names: { data: [{ normalized_name: "a", raw_name: "A" }, { normalized_name: "a", raw_name: "A." }], count: 2, error: null },
    });
    const backlog = await readTweetBacklog({ client, now, writeSnapshot: true });
    expect(backlog.queue.map((item) => item.count)).toEqual([1400, 1830, 644, 192]);
    expect(backlog.unresolvedNames.count).toBe(1);
    expect(backlog.warnings).toEqual(["Day-over-day changes are not installed yet (migration 20261106201221 not applied)."]);
    expect(writes).toEqual([]);
  });

  it("stores today's snapshot once the table exists", async () => {
    const { client, writes } = fakeClient({ tweet_review_backlog_snapshots: { data: null, error: null } });
    const backlog = await readTweetBacklog({ client, now, writeSnapshot: true });
    expect(backlog.warnings).toEqual([]);
    expect(writes).toEqual(["tweet_review_backlog_snapshots"]);
  });
});
