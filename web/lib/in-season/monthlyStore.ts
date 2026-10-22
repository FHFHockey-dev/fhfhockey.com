import serviceRoleClient from "lib/supabase/server";
import type { VerifiedStripeMinimum } from "./commerce";
import { monthlyPurchaseGrants, monthlyRetryIntents, type MonthlyState } from "./monthlyLifecycle";

export type MonthlyAttempt = { id: string; user_id: string; created_at: string; customer_id: string | null; subscription_id: string | null; schedule_id: string | null; state: MonthlyState | null; minimum: VerifiedStripeMinimum };
export type MonthlyJob = { id: string; subscription_id: string; user_id: string; kind: "retry" | "stop" | "cutoff"; due_at: string; invoice_id: string | null; attempt: number | null; created_at: string; token?: string; accounting_snapshots: Record<string, unknown>[] };
export interface MonthlyStore {
  begin(userId: string, minimum: VerifiedStripeMinimum): Promise<MonthlyAttempt>;
  customer(id: string, customerId: string): Promise<void>;
  attach(id: string, state: MonthlyState): Promise<void>;
  load(subscriptionId: string): Promise<MonthlyState | null>;
  claim(subscriptionId: string, eventId: string): Promise<{ duplicate: true } | { token: string; state: MonthlyState }>;
  commit(subscriptionId: string, eventId: string, token: string, state: MonthlyState, now: Date): Promise<void>;
  jobs(limit: number): Promise<MonthlyJob[]>;
  claimJob(id: string): Promise<{ token: string; job: MonthlyJob } | null>;
  snapshotJob(id: string, token: string, snapshot: Record<string, unknown>): Promise<void>;
  finishJob(id: string, token: string): Promise<void>;
}

type RpcClient = { rpc(name: string, args: Record<string, unknown>): PromiseLike<{ data: unknown; error: unknown }> };
export function monthlyBillingStore(client: RpcClient = serviceRoleClient as unknown as RpcClient): MonthlyStore {
  async function call(name: string, args: Record<string, unknown>) {
    const { data, error } = await client.rpc(name, args); if (error) throw error; return data;
  }
  return {
    begin: async (userId, minimum) => {
      const row = await call("begin_in_season_sandbox_monthly", { p_user_id: userId, p_minimum: minimum }) as MonthlyAttempt | null;
      if (!row?.id || row.user_id !== userId) throw new Error("Monthly attempt unavailable."); return row;
    },
    customer: async (id, customerId) => { await call("bind_in_season_sandbox_monthly_customer", { p_id: id, p_customer_id: customerId }); },
    attach: async (id, state) => { await call("attach_in_season_sandbox_monthly", { p_id: id, p_state: state }); },
    load: async (subscriptionId) => await call("get_in_season_sandbox_monthly", { p_subscription_id: subscriptionId }) as MonthlyState | null,
    claim: async (subscriptionId, eventId) => {
      const result = await call("claim_in_season_sandbox_monthly", { p_subscription_id: subscriptionId, p_event_id: eventId }) as { duplicate?: boolean; token?: string; state?: MonthlyState } | null;
      if (result?.duplicate === true) return { duplicate: true };
      if (!result?.token || !result.state) throw new Error("Monthly reconciliation unavailable.");
      return { token: result.token, state: result.state };
    },
    commit: async (subscriptionId, eventId, token, state, now) => {
      await call("commit_in_season_sandbox_monthly", { p_subscription_id: subscriptionId, p_event_id: eventId, p_token: token, p_state: state,
        p_grants: monthlyPurchaseGrants(state), p_retries: monthlyRetryIntents(state, now),
        p_stop: !!state.cancelledAt || !!state.billingStoppedAt || Object.values(state.invoices).some((row) => !row.paidAt && row.failedAttempts >= 3) });
    },
    jobs: async (limit) => {
      if (!Number.isInteger(limit) || limit < 1 || limit > 20) throw new Error("Invalid job bound.");
      const rows = await call("list_in_season_sandbox_monthly_jobs", { p_limit: limit }); if (!Array.isArray(rows)) throw new Error("Job list unavailable."); return rows as MonthlyJob[];
    },
    claimJob: async (id) => await call("claim_in_season_sandbox_monthly_job", { p_id: id }) as { token: string; job: MonthlyJob } | null,
    snapshotJob: async (id, token, snapshot) => { await call("snapshot_in_season_sandbox_monthly_job", { p_id: id, p_token: token, p_snapshot: snapshot }); },
    finishJob: async (id, token) => { await call("finish_in_season_sandbox_monthly_job", { p_id: id, p_token: token }); },
  };
}
