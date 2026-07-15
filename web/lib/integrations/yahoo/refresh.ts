import type { SupabaseClient } from "@supabase/supabase-js";

import serviceRoleClient from "lib/supabase/server";
import type { Database, Json } from "lib/supabase/database-generated.types";

import { YAHOO_PROVIDER } from "./config";
import { syncYahooDiscovery } from "./discovery";

const YAHOO_REFRESH_COOLDOWN_MS = 5 * 60 * 1000;
const YAHOO_REFRESH_STALE_MS = 15 * 60 * 1000;

type ConnectedAccountRow =
  Database["public"]["Tables"]["connected_accounts"]["Row"];
type ProviderSyncRunRow =
  Database["public"]["Tables"]["provider_sync_runs"]["Row"];

type YahooTokenRow = {
  access_token: string | null;
  refresh_token: string | null;
  token_type: string | null;
  provider_user_id: string | null;
};

export class YahooRefreshError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number,
    public readonly retryAfterSeconds?: number,
  ) {
    super(message);
    this.name = "YahooRefreshError";
  }
}

export type YahooManualRefreshResult = {
  runId: string;
  leagueCount: number;
  teamCount: number;
  cooldownUntil: string;
};

type RunYahooManualRefreshOptions = {
  userId: string;
  redirectUri: string;
  client?: SupabaseClient<Database>;
  now?: () => Date;
  sync?: typeof syncYahooDiscovery;
};

function secondsUntil(timestamp: string, now: Date) {
  return Math.max(
    1,
    Math.ceil((new Date(timestamp).getTime() - now.getTime()) / 1000),
  );
}

export function getYahooRefreshBlock(
  latestRun: Pick<
    ProviderSyncRunRow,
    "status" | "cooldown_until" | "started_at" | "created_at"
  > | null,
  now: Date,
) {
  if (latestRun?.status === "running" || latestRun?.status === "queued") {
    const startedAt = latestRun.started_at || latestRun.created_at;
    const isStale =
      Boolean(startedAt) &&
      now.getTime() - new Date(startedAt).getTime() >= YAHOO_REFRESH_STALE_MS;
    if (!isStale) {
      return new YahooRefreshError(
        "A Yahoo refresh is already in progress.",
        409,
      );
    }
  }

  if (latestRun?.cooldown_until && new Date(latestRun.cooldown_until) > now) {
    const retryAfterSeconds = secondsUntil(latestRun.cooldown_until, now);
    return new YahooRefreshError(
      `Yahoo refresh is cooling down. Try again in ${retryAfterSeconds} seconds.`,
      429,
      retryAfterSeconds,
    );
  }

  return null;
}

async function loadYahooTokens(
  client: SupabaseClient<Database>,
  connectedAccountId: string,
  userId: string,
) {
  const { data, error } = await (client as any).rpc(
    "get_connected_account_tokens_secure",
    {
      p_connected_account_id: connectedAccountId,
      p_user_id: userId,
    },
  );

  if (error) {
    throw new Error(`Failed to load Yahoo provider tokens: ${error.message}`);
  }

  const token = (Array.isArray(data) ? data[0] : data) as YahooTokenRow | null;
  if (!token?.access_token || !token.refresh_token) {
    throw new Error(
      "Yahoo tokens are unavailable. Reconnect Yahoo and try again.",
    );
  }

  return token;
}

export async function runYahooManualRefresh({
  userId,
  redirectUri,
  client = serviceRoleClient,
  now = () => new Date(),
  sync = syncYahooDiscovery,
}: RunYahooManualRefreshOptions): Promise<YahooManualRefreshResult> {
  const { data: connectedAccount, error: accountError } = await client
    .from("connected_accounts")
    .select("*")
    .eq("user_id", userId)
    .eq("provider", YAHOO_PROVIDER)
    .maybeSingle();

  if (accountError) {
    throw new Error(`Failed to load Yahoo account: ${accountError.message}`);
  }
  if (!connectedAccount) {
    throw new YahooRefreshError(
      "Connect Yahoo before requesting a refresh.",
      404,
    );
  }

  const { data: latestRun, error: latestRunError } = await client
    .from("provider_sync_runs")
    .select("*")
    .eq("user_id", userId)
    .eq("provider", YAHOO_PROVIDER)
    .eq("connected_account_id", connectedAccount.id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (latestRunError) {
    throw new Error(
      `Failed to load Yahoo refresh state: ${latestRunError.message}`,
    );
  }

  const startedAt = now();
  const blocked = getYahooRefreshBlock(latestRun, startedAt);
  if (blocked) {
    throw blocked;
  }

  if (
    latestRun &&
    (latestRun.status === "running" || latestRun.status === "queued")
  ) {
    await client
      .from("provider_sync_runs")
      .update({
        status: "failed",
        dedupe_key: null,
        finished_at: startedAt.toISOString(),
        error_details: {
          message: "Stale Yahoo refresh was recovered.",
        } as Json,
      })
      .eq("id", latestRun.id)
      .eq("user_id", userId);
  }

  const dedupeKey = `${YAHOO_PROVIDER}:${userId}:${connectedAccount.id}:manual`;
  const { data: run, error: runError } = await client
    .from("provider_sync_runs")
    .insert({
      user_id: userId,
      provider: YAHOO_PROVIDER,
      connected_account_id: connectedAccount.id,
      trigger_source: "manual",
      status: "running",
      dedupe_key: dedupeKey,
      started_at: startedAt.toISOString(),
    })
    .select("*")
    .single();

  if (runError || !run) {
    if (runError?.code === "23505") {
      throw new YahooRefreshError(
        "A Yahoo refresh is already in progress.",
        409,
      );
    }
    throw new Error(
      `Failed to start Yahoo refresh: ${runError?.message || "No run row"}`,
    );
  }

  await client
    .from("connected_accounts")
    .update({ status: "syncing" })
    .eq("id", connectedAccount.id)
    .eq("user_id", userId);

  try {
    const token = await loadYahooTokens(client, connectedAccount.id, userId);
    const summary = await sync({
      userId,
      connectedAccount: connectedAccount as ConnectedAccountRow,
      accessToken: token.access_token as string,
      refreshToken: token.refresh_token as string,
      tokenType: token.token_type,
      providerUserId: token.provider_user_id,
      redirectUri,
    });
    const finishedAt = now();
    const cooldownUntil = new Date(
      finishedAt.getTime() + YAHOO_REFRESH_COOLDOWN_MS,
    ).toISOString();

    const { error: finishError } = await client
      .from("provider_sync_runs")
      .update({
        status: "completed",
        dedupe_key: null,
        cooldown_until: cooldownUntil,
        finished_at: finishedAt.toISOString(),
        result_summary: {
          league_count: summary.leagueCount,
          team_count: summary.teamCount,
        } as Json,
        error_details: {},
      })
      .eq("id", run.id)
      .eq("user_id", userId);

    if (finishError) {
      throw new Error(
        `Yahoo refresh completed but audit finalization failed: ${finishError.message}`,
      );
    }

    return {
      runId: run.id,
      leagueCount: summary.leagueCount,
      teamCount: summary.teamCount,
      cooldownUntil,
    };
  } catch (error) {
    const finishedAt = now();
    const cooldownUntil = new Date(
      finishedAt.getTime() + YAHOO_REFRESH_COOLDOWN_MS,
    ).toISOString();
    const message =
      error instanceof Error ? error.message : "Yahoo refresh failed.";

    await Promise.all([
      client
        .from("provider_sync_runs")
        .update({
          status: "failed",
          dedupe_key: null,
          cooldown_until: cooldownUntil,
          finished_at: finishedAt.toISOString(),
          error_details: { message } as Json,
        })
        .eq("id", run.id)
        .eq("user_id", userId),
      client
        .from("connected_accounts")
        .update({ status: "error" })
        .eq("id", connectedAccount.id)
        .eq("user_id", userId),
    ]);

    throw error;
  }
}
