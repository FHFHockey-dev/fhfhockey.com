import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { refreshPatreonAccount } from "./sync";

const identityBody = {
  data: {
    id: "patreon-user-1",
    type: "user",
    attributes: { full_name: "Paid supporter" },
    relationships: { memberships: { data: [{ id: "member-1", type: "member" }] } },
  },
  included: [
    {
      id: "member-1",
      type: "member",
      attributes: {
        patron_status: "active_patron",
        currently_entitled_amount_cents: 500,
        last_charge_status: "Paid",
        pledge_relationship_start: "2026-01-01T00:00:00Z",
      },
      relationships: {
        campaign: { data: { id: "campaign-1", type: "campaign" } },
        currently_entitled_tiers: { data: [{ id: "tier-1", type: "tier" }] },
      },
    },
    { id: "tier-1", type: "tier", attributes: { title: "Paid", amount_cents: 500 } },
  ],
};

function refreshClient({ deleteBeforePersist = false } = {}) {
  const account = {
    id: "account-1", user_id: "user-1", provider: "patreon", provider_user_id: "patreon-user-1",
    status: "error", account_label: "Paid supporter", scopes: ["identity"], metadata: {},
    last_synced_at: "2026-09-06T00:00:00Z", created_at: "2026-01-01T00:00:00Z", updated_at: "2026-09-06T00:00:00Z",
  };
  let accountReads = 0;
  let entitlement: any = {
    id: "entitlement-1", user_id: "user-1", source_provider: "patreon", source_account_id: "account-1",
    entitlement_key: "patreon_supporter", entitlement_status: "inactive", source_reference: "member-1",
    effective_from: "2026-01-01T00:00:00Z", effective_to: "2026-09-06T00:00:00Z",
    metadata: { connected_account_id: "account-1", draft_pro_eligible: false },
    created_at: "2026-01-01T00:00:00Z", updated_at: "2026-09-06T00:00:00Z",
  };
  const activeWrites: any[] = [];
  const statusFilters: unknown[][] = [];

  const client: any = {
    rpc: vi.fn(async (name: string) => name === "get_connected_account_tokens_secure"
      ? { data: [{ access_token: "access", refresh_token: "refresh", token_type: "Bearer", scopes: ["identity"], expires_at: "2026-10-01T00:00:00Z" }], error: null }
      : { data: "token-row", error: null }),
    from(table: string) {
      const filters: Record<string, unknown> = {};
      const inFilters: Record<string, unknown[]> = {};
      let action = "select";
      let value: any;
      const query: any = {
        select: () => query,
        eq: (key: string, expected: unknown) => { filters[key] = expected; return query; },
        neq: (key: string, expected: unknown) => { filters[`neq:${key}`] = expected; return query; },
        in: (key: string, allowed: unknown[]) => {
          inFilters[key] = allowed;
          if (key === "status") statusFilters.push(allowed);
          return query;
        },
        order: () => query,
        limit: () => query,
        insert: (input: any) => { action = "insert"; value = input; return query; },
        update: (input: any) => { action = "update"; value = input; return query; },
        maybeSingle: async () => {
          if (table === "connected_accounts") {
            accountReads += 1;
            const excludedByStatus = inFilters.status && !inFilters.status.includes(account.status);
            return { data: (deleteBeforePersist && accountReads > 1) || excludedByStatus ? null : account, error: null };
          }
          if (table === "user_entitlements") return { data: entitlement, error: null };
          if (table === "provider_sync_runs") return { data: null, error: null };
          return { data: null, error: null };
        },
        single: async () => table === "provider_sync_runs"
          ? { data: { id: "run-1", user_id: "user-1", status: "running" }, error: null }
          : { data: value, error: null },
        then: (resolve: (result: { error: null }) => unknown) => {
          if (action === "update" && table === "user_entitlements") {
            const excludedCurrent = filters["neq:source_reference"] === entitlement.source_reference;
            if (!excludedCurrent) {
              entitlement = { ...entitlement, ...value };
              if (value.entitlement_status === "active") activeWrites.push(value);
            }
          }
          if (action === "update" && table === "connected_accounts") Object.assign(account, value);
          return resolve({ error: null });
        },
      };
      return query;
    },
    entitlement: () => entitlement,
    activeWrites,
    statusFilters,
  };
  return client;
}

describe("Patreon refresh outage recovery", () => {
  beforeEach(() => {
    vi.stubEnv("PATREON_CLIENT_ID", "client");
    vi.stubEnv("PATREON_CLIENT_SECRET", "secret");
    vi.stubEnv("PATREON_CAMPAIGN_ID", "campaign-1");
  });
  afterEach(() => vi.unstubAllEnvs());

  it("recovers a retained error-state account and restores its paid grant", async () => {
    const client = refreshClient();
    const fetchImpl = vi.fn(async () => new Response(JSON.stringify(identityBody), { status: 200 }));
    await refreshPatreonAccount({ userId: "user-1", client, fetchImpl: fetchImpl as any, now: () => new Date("2026-09-07T12:00:00Z") });
    expect(client.entitlement()).toMatchObject({ id: "entitlement-1", entitlement_status: "active", source_reference: "member-1", metadata: { draft_pro_eligible: true, connected_account_id: "account-1" } });
    expect(client.activeWrites).toHaveLength(1);
    expect(client.statusFilters).toContainEqual(["connected", "syncing", "error"]);
  });

  it("cannot persist an active grant after the account is deleted mid-refresh", async () => {
    const client = refreshClient({ deleteBeforePersist: true });
    const fetchImpl = vi.fn(async () => new Response(JSON.stringify(identityBody), { status: 200 }));
    await expect(refreshPatreonAccount({ userId: "user-1", client, fetchImpl: fetchImpl as any, now: () => new Date("2026-09-07T12:00:00Z") })).rejects.toThrow("disconnected while verification was running");
    expect(client.activeWrites).toHaveLength(0);
    expect(client.entitlement().entitlement_status).toBe("inactive");
  });
});
