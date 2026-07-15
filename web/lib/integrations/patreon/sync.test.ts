import { describe, expect, it, vi } from "vitest";

import { getPatreonSyncBlock, materializePatreonEntitlement } from "./sync";

describe("getPatreonSyncBlock", () => {
  const now = new Date("2026-07-14T15:00:00Z");

  it("blocks a live in-flight run and exposes cooldown timing", () => {
    const running = getPatreonSyncBlock(
      {
        status: "running",
        started_at: "2026-07-14T14:59:30Z",
        created_at: "2026-07-14T14:59:30Z",
        cooldown_until: null,
      },
      now,
    );
    expect(running?.statusCode).toBe(409);

    const cooldown = getPatreonSyncBlock(
      {
        status: "completed",
        started_at: "2026-07-14T14:58:00Z",
        created_at: "2026-07-14T14:58:00Z",
        cooldown_until: "2026-07-14T15:00:09.200Z",
      },
      now,
    );
    expect(cooldown?.statusCode).toBe(429);
    expect(cooldown?.retryAfterSeconds).toBe(10);
  });

  it("allows stale recovery and completed runs outside cooldown", () => {
    expect(
      getPatreonSyncBlock(
        {
          status: "running",
          started_at: "2026-07-14T14:30:00Z",
          created_at: "2026-07-14T14:30:00Z",
          cooldown_until: null,
        },
        now,
      ),
    ).toBeNull();
  });
});

describe("Patreon entitlement anti-sharing", () => {
  const account = {
    id: "account-1",
  } as any;
  const snapshot = {
    providerUserId: "patreon-user-1",
    memberId: "member-1",
    pledgeRelationshipStart: "2026-01-01T00:00:00Z",
    isEligibleSupporter: true,
    metadata: {},
  } as any;

  it("materializes an active generic supporter entitlement without a feature grant", async () => {
    const query = {
      select: vi.fn(),
      eq: vi.fn(),
      neq: vi.fn().mockResolvedValue({ error: null }),
      maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
      insert: vi.fn().mockResolvedValue({ error: null }),
      update: vi.fn(),
    };
    query.select.mockReturnValue(query);
    query.eq.mockReturnValue(query);
    query.update.mockReturnValue(query);
    const client = { from: vi.fn(() => query) } as any;

    await materializePatreonEntitlement({
      userId: "user-1",
      account,
      snapshot,
      client,
      now: new Date("2026-07-14T15:00:00Z"),
    });

    expect(query.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        user_id: "user-1",
        source_provider: "patreon",
        source_account_id: "account-1",
        source_reference: "member-1",
        entitlement_key: "patreon_supporter",
        entitlement_status: "active",
        effective_to: null,
        metadata: expect.objectContaining({
          generic_entitlement_only: true,
          provider_user_id: "patreon-user-1",
        }),
      }),
    );
  });

  it("rejects a member identity already owned by another site user", async () => {
    const query = {
      select: vi.fn(),
      eq: vi.fn(),
      maybeSingle: vi.fn().mockResolvedValue({
        data: { id: "entitlement-1", user_id: "user-2" },
        error: null,
      }),
    };
    query.select.mockReturnValue(query);
    query.eq.mockReturnValue(query);
    const client = { from: vi.fn(() => query) } as any;

    await expect(
      materializePatreonEntitlement({
        userId: "user-1",
        account,
        snapshot,
        client,
        now: new Date("2026-07-14T15:00:00Z"),
      }),
    ).rejects.toMatchObject({ statusCode: 409 });
    expect(query.eq).toHaveBeenCalledWith("source_provider", "patreon");
    expect(query.eq).toHaveBeenCalledWith("source_reference", "member-1");
  });

  it("translates a unique-index race into the same safe conflict", async () => {
    const query = {
      select: vi.fn(),
      eq: vi.fn(),
      maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
      insert: vi.fn().mockResolvedValue({
        error: { code: "23505", message: "duplicate" },
      }),
    };
    query.select.mockReturnValue(query);
    query.eq.mockReturnValue(query);
    const client = { from: vi.fn(() => query) } as any;

    await expect(
      materializePatreonEntitlement({
        userId: "user-1",
        account,
        snapshot,
        client,
        now: new Date("2026-07-14T15:00:00Z"),
      }),
    ).rejects.toMatchObject({ statusCode: 409 });
    expect(query.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        user_id: "user-1",
        source_provider: "patreon",
        source_reference: "member-1",
      }),
    );
  });
});
