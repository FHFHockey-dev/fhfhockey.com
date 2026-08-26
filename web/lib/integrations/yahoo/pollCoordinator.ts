import serviceRoleClient from "lib/supabase/server";

import { resolveYahooGameContext } from "./gameContext";
import type { YahooLiveDraftClient } from "./liveDraftDatabase";
import { pollYahooDraftSession } from "./liveDraftServer";

type DueSession = {
  connected_account_id: string;
  id: string;
  user_id: string;
};

export type YahooDraftPollCoordinatorResult = {
  attempted: number;
  failed: number;
  succeeded: number;
};

export type YahooDraftPollCoordinatorOptions = {
  client?: YahooLiveDraftClient;
  concurrency?: number;
  fetchImpl?: typeof fetch;
  limit?: number;
  now?: Date;
};

async function runAccountQueue(args: {
  client: YahooLiveDraftClient;
  context: Awaited<ReturnType<typeof resolveYahooGameContext>>;
  fetchImpl: typeof fetch;
  sessions: DueSession[];
}) {
  let succeeded = 0;
  let failed = 0;
  for (const session of args.sessions) {
    try {
      await pollYahooDraftSession(session.user_id, session.id, {
        client: args.client,
        context: args.context,
        fetchImpl: args.fetchImpl,
      });
      succeeded += 1;
    } catch {
      failed += 1;
    }
  }
  return { failed, succeeded };
}

export async function runYahooDraftPollCoordinator(
  options: YahooDraftPollCoordinatorOptions = {},
): Promise<YahooDraftPollCoordinatorResult> {
  const client =
    options.client ??
    (serviceRoleClient as unknown as YahooLiveDraftClient);
  const now = options.now ?? new Date();
  const limit = Math.min(200, Math.max(1, Math.floor(options.limit ?? 50)));
  const concurrency = Math.min(
    16,
    Math.max(1, Math.floor(options.concurrency ?? 4)),
  );
  const { data, error } = await client
    .from("yahoo_draft_sessions")
    .select("id,user_id,connected_account_id")
    .in("status", ["predraft", "active"])
    .lte("next_poll_at", now.toISOString())
    .order("next_poll_at", { ascending: true })
    .limit(limit);
  if (error) {
    throw new Error(`Yahoo draft coordinator could not load due work: ${error.message}`);
  }
  const sessions = (data ?? []) as DueSession[];
  if (sessions.length === 0) return { attempted: 0, failed: 0, succeeded: 0 };

  const context = await resolveYahooGameContext(client);
  const byAccount = new Map<string, DueSession[]>();
  for (const session of sessions) {
    const queue = byAccount.get(session.connected_account_id) ?? [];
    queue.push(session);
    byAccount.set(session.connected_account_id, queue);
  }
  const queues = [...byAccount.values()];
  let cursor = 0;
  const workers = Array.from(
    { length: Math.min(concurrency, queues.length) },
    async () => {
      let succeeded = 0;
      let failed = 0;
      while (cursor < queues.length) {
        const queue = queues[cursor];
        cursor += 1;
        const result = await runAccountQueue({
          client,
          context,
          fetchImpl: options.fetchImpl ?? fetch,
          sessions: queue,
        });
        succeeded += result.succeeded;
        failed += result.failed;
      }
      return { failed, succeeded };
    },
  );
  const results = await Promise.all(workers);
  return results.reduce<YahooDraftPollCoordinatorResult>(
    (total, result) => ({
      attempted: total.attempted + result.failed + result.succeeded,
      failed: total.failed + result.failed,
      succeeded: total.succeeded + result.succeeded,
    }),
    { attempted: 0, failed: 0, succeeded: 0 },
  );
}

