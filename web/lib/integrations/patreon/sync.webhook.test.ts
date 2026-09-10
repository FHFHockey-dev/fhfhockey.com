import { describe, expect, it, vi } from "vitest";

import { processPatreonWebhook } from "./sync";

function webhookClient() {
  let event: { id: string; user_id: string | null; processed_at: string | null; processing_error?: string } | null = null;
  let pendingInsert = false;
  let pendingUpdate: Record<string, unknown> | null = null;
  const client: any = {
    from(table: string) {
      const query: any = {
        select: () => query,
        eq: () => query,
        maybeSingle: async () => table === "user_entitlements"
          ? { data: { user_id: "user-1" }, error: null }
          : { data: event, error: null },
        insert: () => { pendingInsert = true; return query; },
        update: (value: Record<string, unknown>) => { pendingUpdate = value; return query; },
        single: async () => {
          if (pendingInsert) {
            pendingInsert = false;
            if (event) return { data: null, error: { code: "23505", message: "duplicate" } };
            event = { id: "event-1", user_id: "user-1", processed_at: null };
          }
          return { data: event, error: null };
        },
        then: (resolve: (value: { error: null }) => unknown) => {
          if (pendingUpdate && event) Object.assign(event, pendingUpdate);
          pendingUpdate = null;
          return resolve({ error: null });
        },
      };
      return query;
    },
    event: () => event,
  };
  return client;
}

describe("Patreon webhook event processing", () => {
  it("retries failed events, processes them once, and acknowledges completed duplicates", async () => {
    const client = webhookClient();
    const refresh = vi.fn()
      .mockRejectedValueOnce(new Error("cooldown"))
      .mockResolvedValue(undefined);
    const args = { eventId: "evt-1", eventType: "members:pledge:create", payload: { data: { id: "member-1", type: "member" } }, client, refreshImpl: refresh } as any;

    await expect(processPatreonWebhook(args)).rejects.toThrow("cooldown");
    expect(client.event().processed_at).toBeNull();
    await processPatreonWebhook(args);
    expect(client.event().processed_at).toEqual(expect.any(String));
    await processPatreonWebhook(args);
    expect(refresh).toHaveBeenCalledTimes(2);
  });

  it("marks an unlinked member terminally ignored", async () => {
    const client = webhookClient();
    const originalFrom = client.from.bind(client);
    client.from = (table: string) => {
      const query = originalFrom(table);
      if (table === "user_entitlements") query.maybeSingle = async () => ({ data: null, error: null });
      return query;
    };
    const result = await processPatreonWebhook({
      eventId: "evt-unlinked", eventType: "members:pledge:create", payload: { data: { id: "member-unknown", type: "member" } }, client,
      refreshImpl: vi.fn(),
    });
    expect(result).toMatchObject({ ignored: true, userId: null });
    expect(client.event().processing_error).toBe("ignored_unlinked_member");
  });
});
