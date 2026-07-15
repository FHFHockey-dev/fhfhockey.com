import type { SupabaseClient } from "@supabase/supabase-js";

import serviceRoleClient from "lib/supabase/server";
import type { Database, Json } from "lib/supabase/database-generated.types";

import {
  getPatreonConfiguration,
  PATREON_ENTITLEMENT_KEY,
  PATREON_PROVIDER,
  PATREON_SYNC_COOLDOWN_MS,
  PATREON_SYNC_STALE_MS,
} from "./config";
import {
  fetchPatreonIdentity,
  PatreonApiError,
  refreshPatreonTokens,
  type PatreonIdentitySnapshot,
  type PatreonTokenResponse,
} from "./oauth";

type ConnectedAccount =
  Database["public"]["Tables"]["connected_accounts"]["Row"];
type ProviderSyncRun =
  Database["public"]["Tables"]["provider_sync_runs"]["Row"];
type UserEntitlement = Database["public"]["Tables"]["user_entitlements"]["Row"];
type PatreonTokenRow = {
  access_token: string | null;
  refresh_token: string | null;
  token_type: string | null;
  scopes: Json;
  expires_at: string | null;
};

function secondsUntil(timestamp: string, now: Date) {
  return Math.max(
    1,
    Math.ceil((new Date(timestamp).getTime() - now.getTime()) / 1000),
  );
}

export function getPatreonSyncBlock(
  latestRun: Pick<
    ProviderSyncRun,
    "status" | "cooldown_until" | "started_at" | "created_at"
  > | null,
  now: Date,
) {
  if (latestRun?.status === "running" || latestRun?.status === "queued") {
    const startedAt = latestRun.started_at || latestRun.created_at;
    if (now.getTime() - new Date(startedAt).getTime() < PATREON_SYNC_STALE_MS) {
      return new PatreonApiError(
        "A Patreon membership sync is already running.",
        409,
      );
    }
  }
  if (latestRun?.cooldown_until && new Date(latestRun.cooldown_until) > now) {
    const retryAfter = secondsUntil(latestRun.cooldown_until, now);
    return new PatreonApiError(
      `Patreon membership sync is cooling down. Try again in ${retryAfter} seconds.`,
      429,
      retryAfter,
    );
  }
  return null;
}

export async function getPatreonState(
  userId: string,
  client: SupabaseClient<Database> = serviceRoleClient,
) {
  const { data: account, error: accountError } = await client
    .from("connected_accounts")
    .select("*")
    .eq("user_id", userId)
    .eq("provider", PATREON_PROVIDER)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (accountError) throw accountError;

  const [entitlementResponse, runResponse] = await Promise.all([
    client
      .from("user_entitlements")
      .select("*")
      .eq("user_id", userId)
      .eq("source_provider", PATREON_PROVIDER)
      .eq("entitlement_key", PATREON_ENTITLEMENT_KEY)
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    client
      .from("provider_sync_runs")
      .select("*")
      .eq("user_id", userId)
      .eq("provider", PATREON_PROVIDER)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);
  if (entitlementResponse.error) throw entitlementResponse.error;
  if (runResponse.error) throw runResponse.error;

  return {
    account: (account || null) as ConnectedAccount | null,
    entitlement: (entitlementResponse.data || null) as UserEntitlement | null,
    latestRun: (runResponse.data || null) as ProviderSyncRun | null,
  };
}

async function upsertPatreonConnectedAccount({
  userId,
  snapshot,
  client,
}: {
  userId: string;
  snapshot: PatreonIdentitySnapshot;
  client: SupabaseClient<Database>;
}) {
  const { data: identityOwner, error: identityOwnerError } = await client
    .from("connected_accounts")
    .select("id,user_id")
    .eq("provider", PATREON_PROVIDER)
    .eq("provider_user_id", snapshot.providerUserId)
    .maybeSingle();
  if (identityOwnerError) throw identityOwnerError;
  if (identityOwner && identityOwner.user_id !== userId) {
    throw new PatreonApiError(
      "This Patreon identity is already linked to another FHFH account.",
      409,
    );
  }
  if (snapshot.memberId) {
    const { data: membershipOwner, error: membershipOwnerError } = await client
      .from("user_entitlements")
      .select("id,user_id")
      .eq("source_provider", PATREON_PROVIDER)
      .eq("source_reference", snapshot.memberId)
      .maybeSingle();
    if (membershipOwnerError) throw membershipOwnerError;
    if (membershipOwner && membershipOwner.user_id !== userId) {
      throw new PatreonApiError(
        "This Patreon membership is already linked to another FHFH account.",
        409,
      );
    }
  }

  const { data: existing, error: existingError } = await client
    .from("connected_accounts")
    .select("*")
    .eq("user_id", userId)
    .eq("provider", PATREON_PROVIDER)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (existingError) throw existingError;

  const row = {
    user_id: userId,
    provider: PATREON_PROVIDER,
    provider_user_id: snapshot.providerUserId,
    account_label: snapshot.accountLabel,
    status: "syncing",
    scopes: ["identity"] as Json,
    metadata: snapshot.metadata,
  };
  if (existing) {
    const { data, error } = await client
      .from("connected_accounts")
      .update(row)
      .eq("id", existing.id)
      .eq("user_id", userId)
      .select("*")
      .single();
    if (error || !data) {
      if (error?.code === "23505") {
        throw new PatreonApiError(
          "This Patreon identity is already linked to another FHFH account.",
          409,
        );
      }
      throw new Error(
        error?.message || "Patreon account update returned no row.",
      );
    }
    return { account: data, created: false };
  }

  const { data, error } = await client
    .from("connected_accounts")
    .insert(row)
    .select("*")
    .single();
  if (error || !data) {
    if (error?.code === "23505") {
      throw new PatreonApiError(
        "This Patreon identity is already linked to another FHFH account.",
        409,
      );
    }
    throw new Error(
      error?.message || "Patreon account creation returned no row.",
    );
  }
  return { account: data, created: true };
}

function tokenScopes(token: PatreonTokenResponse) {
  const scopes = token.scope
    ?.split(/[ ,]+/)
    .map((scope) => scope.trim())
    .filter(Boolean);
  return scopes?.length ? scopes : ["identity"];
}

function tokenExpiresAt(token: PatreonTokenResponse, now: Date) {
  return typeof token.expires_in === "number" && token.expires_in > 0
    ? new Date(now.getTime() + token.expires_in * 1000).toISOString()
    : null;
}

async function storePatreonTokens({
  userId,
  account,
  token,
  fallbackRefreshToken,
  client,
  now,
}: {
  userId: string;
  account: ConnectedAccount;
  token: PatreonTokenResponse;
  fallbackRefreshToken?: string | null;
  client: SupabaseClient<Database>;
  now: Date;
}) {
  const { campaignId } = getPatreonConfiguration();
  const { error } = await client.rpc("upsert_connected_account_tokens_secure", {
    p_connected_account_id: account.id,
    p_user_id: userId,
    p_provider: PATREON_PROVIDER,
    p_access_token: token.access_token,
    p_refresh_token: token.refresh_token || fallbackRefreshToken || undefined,
    p_token_type: token.token_type || "Bearer",
    p_scopes: tokenScopes(token),
    p_provider_user_id: account.provider_user_id || undefined,
    p_expires_at: tokenExpiresAt(token, now) || undefined,
    p_refresh_expires_at: undefined,
    p_last_refreshed_at: now.toISOString(),
    p_secret_metadata: {
      api_version: "v2",
      campaign_id: campaignId,
      integration_mode: "oauth",
    },
  });
  if (error)
    throw new Error(`Failed to store Patreon tokens: ${error.message}`);
}

export async function materializePatreonEntitlement({
  userId,
  account,
  snapshot,
  client,
  now,
}: {
  userId: string;
  account: ConnectedAccount;
  snapshot: PatreonIdentitySnapshot;
  client: SupabaseClient<Database>;
  now: Date;
}) {
  const entitlementStatus = snapshot.isEligibleSupporter
    ? "active"
    : "inactive";
  const entitlementMetadata = {
    ...((snapshot.metadata || {}) as Record<string, unknown>),
    provider_user_id: snapshot.providerUserId,
    generic_entitlement_only: true,
  } as Json;

  if (snapshot.memberId) {
    const { data: existing, error: existingError } = await client
      .from("user_entitlements")
      .select("*")
      .eq("source_provider", PATREON_PROVIDER)
      .eq("source_reference", snapshot.memberId)
      .maybeSingle();
    if (existingError) throw existingError;
    if (existing && existing.user_id !== userId) {
      throw new PatreonApiError(
        "This Patreon membership is already linked to another FHFH account.",
        409,
      );
    }

    const entitlementRow = {
      user_id: userId,
      source_provider: PATREON_PROVIDER,
      source_account_id: account.id,
      entitlement_key: PATREON_ENTITLEMENT_KEY,
      entitlement_status: entitlementStatus,
      source_reference: snapshot.memberId,
      effective_from: snapshot.pledgeRelationshipStart,
      effective_to: snapshot.isEligibleSupporter ? null : now.toISOString(),
      metadata: entitlementMetadata,
      updated_at: now.toISOString(),
    };
    const entitlementWrite = existing
      ? client
          .from("user_entitlements")
          .update(entitlementRow)
          .eq("id", existing.id)
          .eq("user_id", userId)
      : client.from("user_entitlements").insert(entitlementRow);
    const { error } = await entitlementWrite;
    if (error?.code === "23505") {
      throw new PatreonApiError(
        "This Patreon membership is already linked to another FHFH account.",
        409,
      );
    }
    if (error) throw error;

    const { error: staleError } = await client
      .from("user_entitlements")
      .update({
        entitlement_status: "inactive",
        effective_to: now.toISOString(),
        updated_at: now.toISOString(),
      })
      .eq("user_id", userId)
      .eq("source_provider", PATREON_PROVIDER)
      .eq("entitlement_key", PATREON_ENTITLEMENT_KEY)
      .neq("source_reference", snapshot.memberId);
    if (staleError) throw staleError;
    return;
  }

  const { error } = await client
    .from("user_entitlements")
    .update({
      source_account_id: account.id,
      entitlement_status: "inactive",
      effective_to: now.toISOString(),
      metadata: entitlementMetadata,
      updated_at: now.toISOString(),
    })
    .eq("user_id", userId)
    .eq("source_provider", PATREON_PROVIDER)
    .eq("entitlement_key", PATREON_ENTITLEMENT_KEY);
  if (error) throw error;
}

async function createSyncRun({
  userId,
  accountId,
  triggerSource,
  client,
  now,
}: {
  userId: string;
  accountId: string;
  triggerSource: string;
  client: SupabaseClient<Database>;
  now: Date;
}) {
  const { data, error } = await client
    .from("provider_sync_runs")
    .insert({
      user_id: userId,
      provider: PATREON_PROVIDER,
      connected_account_id: accountId,
      trigger_source: triggerSource,
      status: "running",
      dedupe_key: `${PATREON_PROVIDER}:${userId}:${accountId}:membership-sync`,
      started_at: now.toISOString(),
    })
    .select("*")
    .single();
  if (error?.code === "23505") {
    throw new PatreonApiError(
      "A Patreon membership sync is already running.",
      409,
    );
  }
  if (error || !data)
    throw new Error(error?.message || "Sync run returned no row.");
  return data;
}

async function finishSyncRun({
  runId,
  userId,
  client,
  now,
  snapshot,
  error,
}: {
  runId: string;
  userId: string;
  client: SupabaseClient<Database>;
  now: Date;
  snapshot?: PatreonIdentitySnapshot;
  error?: unknown;
}) {
  const cooldownUntil = new Date(
    now.getTime() + PATREON_SYNC_COOLDOWN_MS,
  ).toISOString();
  const { error: updateError } = await client
    .from("provider_sync_runs")
    .update({
      status: error ? "failed" : "completed",
      dedupe_key: null,
      cooldown_until: cooldownUntil,
      finished_at: now.toISOString(),
      result_summary: snapshot
        ? {
            member_id: snapshot.memberId,
            patron_status: snapshot.patronStatus,
            generic_supporter_eligible: snapshot.isEligibleSupporter,
            tier_count: snapshot.tiers.length,
          }
        : {},
      error_details: error
        ? {
            message:
              error instanceof Error ? error.message : "Patreon sync failed.",
          }
        : {},
    })
    .eq("id", runId)
    .eq("user_id", userId);
  if (updateError) throw updateError;
  return cooldownUntil;
}

async function persistSnapshot({
  userId,
  account,
  snapshot,
  token,
  fallbackRefreshToken,
  client,
  now,
}: {
  userId: string;
  account: ConnectedAccount;
  snapshot: PatreonIdentitySnapshot;
  token: PatreonTokenResponse;
  fallbackRefreshToken?: string | null;
  client: SupabaseClient<Database>;
  now: Date;
}) {
  await storePatreonTokens({
    userId,
    account,
    token,
    fallbackRefreshToken,
    client,
    now,
  });
  await materializePatreonEntitlement({
    userId,
    account,
    snapshot,
    client,
    now,
  });
  const { error } = await client
    .from("connected_accounts")
    .update({
      account_label: snapshot.accountLabel,
      provider_user_id: snapshot.providerUserId,
      status: "connected",
      scopes: tokenScopes(token),
      metadata: snapshot.metadata,
      last_synced_at: now.toISOString(),
      updated_at: now.toISOString(),
    })
    .eq("id", account.id)
    .eq("user_id", userId)
    .eq("provider", PATREON_PROVIDER);
  if (error) throw error;
}

export async function connectPatreonAccount({
  userId,
  token,
  client = serviceRoleClient,
  fetchImpl = fetch,
  now = () => new Date(),
}: {
  userId: string;
  token: PatreonTokenResponse;
  client?: SupabaseClient<Database>;
  fetchImpl?: typeof fetch;
  now?: () => Date;
}) {
  const startedAt = now();
  const { campaignId } = getPatreonConfiguration();
  const snapshot = await fetchPatreonIdentity(
    token.access_token,
    campaignId,
    fetchImpl,
  );
  const accountResult = await upsertPatreonConnectedAccount({
    userId,
    snapshot,
    client,
  });
  const account = accountResult.account;
  const run = await createSyncRun({
    userId,
    accountId: account.id,
    triggerSource: "oauth_callback",
    client,
    now: startedAt,
  });

  try {
    const finishedAt = now();
    await persistSnapshot({
      userId,
      account,
      snapshot,
      token,
      client,
      now: finishedAt,
    });
    const cooldownUntil = await finishSyncRun({
      runId: run.id,
      userId,
      client,
      now: finishedAt,
      snapshot,
    });
    return { accountId: account.id, snapshot, cooldownUntil };
  } catch (error) {
    await finishSyncRun({
      runId: run.id,
      userId,
      client,
      now: now(),
      error,
    }).catch(() => undefined);
    if (accountResult.created) {
      const { error: rollbackError } = await client
        .from("connected_accounts")
        .delete()
        .eq("id", account.id)
        .eq("user_id", userId)
        .eq("provider", PATREON_PROVIDER);
      if (rollbackError) {
        throw new Error(
          `Patreon connection failed and partial-account cleanup also failed: ${rollbackError.message}`,
        );
      }
    } else {
      await client
        .from("connected_accounts")
        .update({ status: "error" })
        .eq("id", account.id)
        .eq("user_id", userId);
    }
    throw error;
  }
}

async function loadPatreonTokens(
  account: ConnectedAccount,
  userId: string,
  client: SupabaseClient<Database>,
) {
  const { data, error } = await client.rpc(
    "get_connected_account_tokens_secure",
    {
      p_connected_account_id: account.id,
      p_user_id: userId,
    },
  );
  if (error) throw new Error(`Failed to load Patreon tokens: ${error.message}`);
  const tokenRow = (
    Array.isArray(data) ? data[0] : data
  ) as PatreonTokenRow | null;
  if (!tokenRow?.access_token) {
    throw new PatreonApiError(
      "Patreon token material is unavailable. Disconnect and link Patreon again.",
      409,
    );
  }
  return tokenRow;
}

export async function refreshPatreonAccount({
  userId,
  client = serviceRoleClient,
  fetchImpl = fetch,
  now = () => new Date(),
}: {
  userId: string;
  client?: SupabaseClient<Database>;
  fetchImpl?: typeof fetch;
  now?: () => Date;
}) {
  const state = await getPatreonState(userId, client);
  if (!state.account) {
    throw new PatreonApiError(
      "Connect Patreon before requesting a re-sync.",
      404,
    );
  }
  const startedAt = now();
  const blocked = getPatreonSyncBlock(state.latestRun, startedAt);
  if (blocked) throw blocked;

  if (
    state.latestRun &&
    (state.latestRun.status === "running" ||
      state.latestRun.status === "queued")
  ) {
    await client
      .from("provider_sync_runs")
      .update({
        status: "failed",
        dedupe_key: null,
        finished_at: startedAt.toISOString(),
        error_details: { message: "Stale Patreon sync was recovered." },
      })
      .eq("id", state.latestRun.id)
      .eq("user_id", userId);
  }

  const run = await createSyncRun({
    userId,
    accountId: state.account.id,
    triggerSource: "manual",
    client,
    now: startedAt,
  });
  try {
    const stored = await loadPatreonTokens(state.account, userId, client);
    let token: PatreonTokenResponse = {
      access_token: stored.access_token || "",
      refresh_token: stored.refresh_token || undefined,
      token_type: stored.token_type || "Bearer",
      scope: Array.isArray(stored.scopes)
        ? stored.scopes
            .filter((value): value is string => typeof value === "string")
            .join(" ")
        : "identity",
    };
    const shouldRefresh =
      stored.expires_at &&
      new Date(stored.expires_at).getTime() <= startedAt.getTime() + 30_000;
    if (shouldRefresh) {
      if (!stored.refresh_token) {
        throw new PatreonApiError(
          "Patreon access expired and no refresh token is available. Link Patreon again.",
          409,
        );
      }
      token = await refreshPatreonTokens(stored.refresh_token, fetchImpl);
      await storePatreonTokens({
        userId,
        account: state.account,
        token,
        fallbackRefreshToken: stored.refresh_token,
        client,
        now: startedAt,
      });
    }

    const { campaignId } = getPatreonConfiguration();
    let snapshot: PatreonIdentitySnapshot;
    try {
      snapshot = await fetchPatreonIdentity(
        token.access_token,
        campaignId,
        fetchImpl,
      );
    } catch (error) {
      if (!(error instanceof PatreonApiError) || error.statusCode !== 401) {
        throw error;
      }
      const refreshToken = token.refresh_token || stored.refresh_token;
      if (!refreshToken) throw error;
      token = await refreshPatreonTokens(refreshToken, fetchImpl);
      await storePatreonTokens({
        userId,
        account: state.account,
        token,
        fallbackRefreshToken: refreshToken,
        client,
        now: startedAt,
      });
      snapshot = await fetchPatreonIdentity(
        token.access_token,
        campaignId,
        fetchImpl,
      );
    }

    if (snapshot.providerUserId !== state.account.provider_user_id) {
      throw new PatreonApiError(
        "Patreon identity changed unexpectedly. Disconnect and link the intended account.",
        409,
      );
    }
    const finishedAt = now();
    await persistSnapshot({
      userId,
      account: state.account,
      snapshot,
      token,
      fallbackRefreshToken: stored.refresh_token,
      client,
      now: finishedAt,
    });
    const cooldownUntil = await finishSyncRun({
      runId: run.id,
      userId,
      client,
      now: finishedAt,
      snapshot,
    });
    return { snapshot, cooldownUntil };
  } catch (error) {
    await finishSyncRun({
      runId: run.id,
      userId,
      client,
      now: now(),
      error,
    });
    await client
      .from("connected_accounts")
      .update({ status: "error" })
      .eq("id", state.account.id)
      .eq("user_id", userId);
    throw error;
  }
}

export async function disconnectPatreonAccount(
  userId: string,
  client: SupabaseClient<Database> = serviceRoleClient,
) {
  const { data: account, error: accountError } = await client
    .from("connected_accounts")
    .select("id")
    .eq("user_id", userId)
    .eq("provider", PATREON_PROVIDER)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (accountError) throw accountError;

  const { error: entitlementError } = await client
    .from("user_entitlements")
    .delete()
    .eq("user_id", userId)
    .eq("source_provider", PATREON_PROVIDER);
  if (entitlementError) throw entitlementError;

  if (account?.id) {
    const { error } = await client
      .from("connected_accounts")
      .delete()
      .eq("id", account.id)
      .eq("user_id", userId)
      .eq("provider", PATREON_PROVIDER);
    if (error) throw error;
  }
  return { disconnected: Boolean(account?.id) };
}
