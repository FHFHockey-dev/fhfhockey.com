import serviceRoleClient from "lib/supabase/server";

export type InSeasonAttempt = {
  id: string;
  user_id: string;
  created_at: string;
  status: "pending" | "paid" | "expired";
  checkout_session_id: string | null;
  payment_intent_id?: string | null;
  paid_at?: string | null;
};

export interface InSeasonBillingStore {
  begin(userId: string): Promise<InSeasonAttempt>;
  get(id: string): Promise<InSeasonAttempt>;
  attach(id: string, sessionId: string): Promise<void>;
  expire(id: string, sessionId: string): Promise<void>;
  claim(attemptId: string, eventId: string): Promise<{ token: string } | { duplicate: true }>;
  reconcile(input: { attemptId: string; userId: string; eventId: string; token: string; sessionId: string; paymentIntentId: string; paidAt: string; active: boolean; snapshot: Record<string, unknown> }): Promise<void>;
}

// The schema is an unapplied migration. Keep the narrow RPC type here rather
// than changing generated database types or granting table writes to browsers.
type BillingRpc = { rpc(name: string, args: Record<string, unknown>): PromiseLike<{ data: unknown; error: unknown }> };

export function inSeasonBillingStore(client: BillingRpc = serviceRoleClient as unknown as BillingRpc): InSeasonBillingStore {
  async function call(name: string, args: Record<string, unknown>) {
    const { data, error } = await client.rpc(name, args);
    if (error) throw error;
    return data;
  }
  async function attempt(name: string, args: Record<string, unknown>) {
    const data = await call(name, args);
    if (!Array.isArray(data) || data.length !== 1 || !data[0]?.id) throw new Error("Billing attempt unavailable.");
    return data[0] as InSeasonAttempt;
  }
  return {
    begin: (userId) => attempt("begin_in_season_sandbox_checkout", { p_user_id: userId }),
    get: (id) => attempt("get_in_season_sandbox_checkout", { p_id: id }),
    attach: async (id, sessionId) => { await call("attach_in_season_sandbox_checkout", { p_id: id, p_session_id: sessionId }); },
    expire: async (id, sessionId) => { await call("expire_in_season_sandbox_checkout", { p_id: id, p_session_id: sessionId }); },
    claim: async (attemptId, eventId) => {
      const data = await call("claim_in_season_sandbox_reconciliation", { p_id: attemptId, p_event_id: eventId }) as { token?: string; duplicate?: boolean } | null;
      if (data?.duplicate === true) return { duplicate: true };
      if (!data?.token) throw new Error("Payment reconciliation unavailable.");
      return { token: data.token };
    },
    reconcile: async (input) => { await call("reconcile_in_season_sandbox_payment", {
      p_id: input.attemptId, p_user_id: input.userId, p_event_id: input.eventId, p_token: input.token,
      p_session_id: input.sessionId, p_payment_intent_id: input.paymentIntentId, p_paid_at: input.paidAt,
      p_active: input.active, p_snapshot: input.snapshot,
    }); },
  };
}
