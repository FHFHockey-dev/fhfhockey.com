import type { SupabaseClient } from "@supabase/supabase-js";
import { POLLED_ACCOUNTS, queueTableFor } from "../../../supabase/functions/x-timeline-poll/fxtwitter";
import {
  assessPollerHealth,
  type IftttQueueEvent,
  type IntakeProviderRow,
  type PollerHealth,
  type PollRunRow,
  type QueueRowForSighting,
  type ShadowSighting,
  type WatchdogAlertRow,
} from "./xPollerHealth";

const PAGE = 1000;
const MAX_PAGES = 8;
/** The shadow usually sees a post before IFTTT does, so sightings are read from a little before the window. */
const SHADOW_LEAD_MS = 6 * 60 * 60 * 1000;

type Page<T> = { data: T[] | null; error: { message?: string; code?: string } | null };

async function readPages<T>(label: string, query: (from: number) => PromiseLike<Page<T>>): Promise<T[]> {
  const rows: T[] = [];
  for (let page = 0; page < MAX_PAGES; page++) {
    const { data, error } = await query(page * PAGE);
    if (error) throw new Error(`${label}: ${error.message ?? error.code ?? "read failed"}`);
    rows.push(...(data ?? []));
    if ((data ?? []).length < PAGE) return rows;
  }
  throw new Error(`${label}: more than ${MAX_PAGES * PAGE} rows; read stopped.`);
}

/**
 * Read-only report adapter. Every read is bounded by the window and paged (at most 8 pages per source). Optional
 * sources (run history, watchdog state, switch table) degrade to warnings, so the section still renders before the
 * 20261106230000 migration is applied.
 */
export async function readPollerHealth(input: { client: SupabaseClient; now: Date; windowMs: number; deadlineAt: number }): Promise<PollerHealth> {
  const windowEnd = input.now.toISOString();
  const windowStart = new Date(input.now.getTime() - input.windowMs).toISOString();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), Math.max(0, input.deadlineAt - Date.now()));
  const signal = controller.signal;
  const db = input.client as any;
  const warnings: string[] = [];
  const accounts = POLLED_ACCOUNTS.map((account) => ({ sourceKey: account.sourceKey, handle: account.handle, hasQueue: Boolean(queueTableFor(account)) }));
  const optional = async <T>(label: string, read: () => Promise<T>): Promise<T | null> => {
    try {
      return await read();
    } catch (error) {
      warnings.push(`${label} unavailable: ${error instanceof Error ? error.message : String(error)}`);
      return null;
    }
  };

  try {
    const [providers, runs, alerts, shadow, lineSource, ccc] = await Promise.all([
      optional("Intake switch", async () => {
        const { data, error } = await db.from("tweet_intake_providers").select("source_key, provider, switched_at").abortSignal(signal);
        if (error) throw new Error(error.message);
        return data as IntakeProviderRow[];
      }),
      optional("Poller run history", () => readPages<PollRunRow>("x_timeline_poll_runs", (from) => db.from("x_timeline_poll_runs")
        .select("response_id, source_key, run_at, ok, enqueue_error").gte("run_at", windowStart).lte("run_at", windowEnd)
        .order("run_at").order("response_id").order("source_key").range(from, from + PAGE - 1).abortSignal(signal))),
      optional("Watchdog state", async () => {
        const { data, error } = await db.from("x_timeline_alert_state").select("alert_key, active, first_seen_at, detail").eq("active", true).abortSignal(signal);
        if (error) throw new Error(error.message);
        return data as WatchdogAlertRow[];
      }),
      readPages<ShadowSighting>("x_timeline_shadow_posts", (from) => db.from("x_timeline_shadow_posts")
        .select("source_key, tweet_id, post_kind, full_text, text, original_author_handle, first_seen_at")
        .gte("first_seen_at", new Date(Date.parse(windowStart) - SHADOW_LEAD_MS).toISOString())
        .order("first_seen_at").order("id").range(from, from + PAGE - 1).abortSignal(signal)),
      readPages<IftttQueueEvent>("line_source_ifttt_events", (from) => db.from("line_source_ifttt_events")
        .select("id, source_key, tweet_id, text, received_at").eq("source", "ifttt").gte("received_at", windowStart)
        .order("received_at").order("id").range(from, from + PAGE - 1).abortSignal(signal)),
      readPages<Omit<IftttQueueEvent, "source_key">>("lines_ccc_ifttt_events", (from) => db.from("lines_ccc_ifttt_events")
        .select("id, tweet_id, text, received_at").eq("source", "ifttt").gte("received_at", windowStart)
        .order("received_at").order("id").range(from, from + PAGE - 1).abortSignal(signal)),
    ]);

    // Each account's first sighting ever (index source_key, first_seen_at): coverage cannot start before the scraper did.
    const shadowStartedAt: Record<string, string | null> = {};
    await Promise.all(accounts.map(async (account) => {
      const { data, error } = await db.from("x_timeline_shadow_posts").select("first_seen_at").eq("source_key", account.sourceKey)
        .order("first_seen_at").limit(1).abortSignal(signal);
      if (error) throw new Error(`x_timeline_shadow_posts start: ${error.message}`);
      shadowStartedAt[account.sourceKey] = data?.[0]?.first_seen_at ?? null;
    }));

    // Queue rows for switched accounts' sightings since their switch, by tweet id in batches of 100.
    const queueRows: QueueRowForSighting[] = [];
    for (const account of POLLED_ACCOUNTS) {
      const table = queueTableFor(account);
      const provider = providers?.find((row) => row.source_key === account.sourceKey);
      if (!table || provider?.provider !== "fxtwitter" || !provider.switched_at) continue;
      const since = Math.max(Date.parse(windowStart), Date.parse(provider.switched_at));
      const ids = shadow.filter((row) => row.source_key === account.sourceKey && Date.parse(row.first_seen_at) >= since).map((row) => row.tweet_id);
      for (let index = 0; index < ids.length; index += 100) {
        let query = db.from(table).select("tweet_id, source").in("tweet_id", ids.slice(index, index + 100));
        if (table === "line_source_ifttt_events") query = query.eq("source_key", account.sourceKey);
        const { data, error } = await query.abortSignal(signal);
        if (error) throw new Error(`${table}: ${error.message}`);
        for (const row of data ?? []) queueRows.push({ source_key: account.sourceKey, tweet_id: row.tweet_id, source: row.source });
      }
    }

    return assessPollerHealth({
      accounts, windowStart, windowEnd, providers, runs, alerts, shadow, queueRows, shadowStartedAt, warnings,
      ifttt: [...lineSource, ...ccc.map((row) => ({ ...row, source_key: "ccc" }))],
    });
  } catch (error) {
    return {
      status: "unknown", windowStart, windowEnd, runs: null, accounts: [], incidents: [],
      warnings: [...warnings, `Poller health unavailable: ${error instanceof Error ? error.message : String(error)}`],
    };
  } finally {
    clearTimeout(timer);
  }
}
