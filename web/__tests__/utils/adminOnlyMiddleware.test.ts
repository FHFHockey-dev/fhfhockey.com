import { afterEach, describe, expect, it, vi } from "vitest";

import { createClientWithToken } from "lib/supabase";
import serviceRoleClient from "lib/supabase/server";

import {
  default as adminOnly,
  invokedByCron,
  invokedByLocalDev,
} from "../../utils/adminOnlyMiddleware";

vi.mock("lib/supabase", () => ({
  createClientWithToken: vi.fn(),
}));
vi.mock("lib/supabase/server", () => ({
  default: {},
}));

const originalCronSecret = process.env.CRON_SECRET;

describe("adminOnlyMiddleware", () => {
  afterEach(() => {
    vi.resetAllMocks();
    vi.unstubAllEnvs();
    if (originalCronSecret === undefined) delete process.env.CRON_SECRET;
    else process.env.CRON_SECRET = originalCronSecret;
  });

  it("accepts the cron secret bearer token", () => {
    vi.stubEnv("CRON_SECRET", "test-secret");

    expect(invokedByCron("Bearer test-secret")).toBe(true);
    expect(invokedByCron("Bearer wrong-secret")).toBe(false);
  });

  it("fails closed when the cron secret is missing, empty, or whitespace-only", () => {
    delete process.env.CRON_SECRET;
    expect(invokedByCron("Bearer undefined")).toBe(false);

    vi.stubEnv("CRON_SECRET", "");
    expect(invokedByCron("Bearer ")).toBe(false);

    vi.stubEnv("CRON_SECRET", "   ");
    expect(invokedByCron("Bearer    ")).toBe(false);
  });

  it.each(["127.0.0.1", "::1", "::ffff:127.0.0.1"])(
    "allows direct loopback peer %s in explicit development mode",
    (remoteAddress) => {
      vi.stubEnv("NODE_ENV", "development");

      expect(
        invokedByLocalDev({
          headers: {
            host: "localhost:3000",
          },
          socket: { remoteAddress },
        } as never),
      ).toBe(true);
      expect(
        invokedByLocalDev({
          headers: {
            host: "127.0.0.1:3000",
          },
          socket: { remoteAddress },
        } as never),
      ).toBe(true);
    },
  );

  it.each([
    "198.51.100.10",
    "192.168.1.10",
    "::ffff:198.51.100.10",
    "2001:db8::10",
    "127.0.0.1.example.com",
    "",
    undefined,
  ])("rejects a forged localhost Host from peer %s", (remoteAddress) => {
    vi.stubEnv("NODE_ENV", "development");

    expect(
      invokedByLocalDev({
        headers: {
          host: "localhost:3000",
          "x-forwarded-for": "127.0.0.1",
          "x-real-ip": "127.0.0.1",
          forwarded: "for=127.0.0.1;host=localhost:3000",
        },
        socket: { remoteAddress },
      } as never),
    ).toBe(false);
  });

  it("fails closed without socket evidence", () => {
    vi.stubEnv("NODE_ENV", "development");
    expect(
      invokedByLocalDev({ headers: { host: "localhost:3000" } } as never),
    ).toBe(false);
  });

  it.each(["production", "test", "", undefined])(
    "does not grant development access when NODE_ENV is %s",
    (environment) => {
      vi.stubEnv("NODE_ENV", environment);
      expect(
        invokedByLocalDev({
          headers: { host: "localhost:3000" },
          socket: { remoteAddress: "127.0.0.1" },
        } as never),
      ).toBe(false);
    },
  );

  it.each([
    "fhfhockey.com",
    "localhost.example.com",
    "localhost.",
    "localhost:abc",
    "localhost:3000:evil",
    "localhost:3000, fhfhockey.com",
    "127.0.0.1.example.com",
    "::1",
    "[::1",
    "[::1]evil",
    "",
    undefined,
  ])(
    "retains the Host restriction for a loopback peer with Host %s",
    (host) => {
      vi.stubEnv("NODE_ENV", "development");
      expect(
        invokedByLocalDev({
          headers: { host },
          socket: { remoteAddress: "127.0.0.1" },
        } as never),
      ).toBe(false);
    },
  );

  it("accepts the bracketed IPv6 loopback Host from a loopback peer", () => {
    vi.stubEnv("NODE_ENV", "development");
    expect(
      invokedByLocalDev({
        headers: { host: "[::1]:3000" },
        socket: { remoteAddress: "::1" },
      } as never),
    ).toBe(true);
  });

  it.each(["127.0.0.1", "::1", "::ffff:127.0.0.1"])(
    "accepts Next.js-filled local forwarding headers from loopback peer %s",
    (remoteAddress) => {
      vi.stubEnv("NODE_ENV", "development");
      expect(
        invokedByLocalDev({
          headers: {
            host: "localhost:3000",
            "x-forwarded-for": remoteAddress,
            "x-forwarded-host": "localhost:3000",
            "x-forwarded-port": "3000",
            "x-forwarded-proto": "http",
          },
          socket: { remoteAddress },
        } as never),
      ).toBe(true);
    },
  );

  it.each([
    { "x-forwarded-for": "203.0.113.7" },
    { "x-forwarded-for": "127.0.0.1, 203.0.113.7" },
    { "x-forwarded-for": "" },
    { "x-real-ip": "203.0.113.7" },
    { "x-forwarded-host": "abc123.tunnel.example" },
    { "x-forwarded-host": "localhost:3000, abc123.tunnel.example" },
    { forwarded: "for=127.0.0.1;host=localhost:3000" },
    { via: "1.1 local-tunnel" },
  ])(
    "withdraws the exception when a loopback peer relays another origin: %j",
    (relayHeaders) => {
      vi.stubEnv("NODE_ENV", "development");
      expect(
        invokedByLocalDev({
          headers: { host: "localhost:3000", ...relayHeaders },
          socket: { remoteAddress: "127.0.0.1" },
        } as never),
      ).toBe(false);
    },
  );

  it("denies an unauthenticated tunneled request that reaches a loopback socket", async () => {
    vi.stubEnv("NODE_ENV", "development");
    const json = vi.fn();
    const status = vi.fn().mockReturnValue({ json });
    const handler = vi.fn();
    const request = {
      headers: {
        host: "localhost:3000",
        "x-forwarded-for": "203.0.113.7",
        "x-forwarded-host": "abc123.tunnel.example",
      },
      socket: { remoteAddress: "127.0.0.1" },
    };

    await adminOnly(handler)(request as never, { status } as never);

    expect(status).toHaveBeenCalledWith(401);
    expect(handler).not.toHaveBeenCalled();
    expect(createClientWithToken).not.toHaveBeenCalled();
    expect(request).not.toHaveProperty("supabase");
  });

  it("denies an unauthenticated remote request with a forged localhost Host", async () => {
    vi.stubEnv("NODE_ENV", "development");
    const json = vi.fn();
    const status = vi.fn().mockReturnValue({ json });
    const handler = vi.fn();
    const request = {
      headers: { host: "localhost:3000" },
      socket: { remoteAddress: "198.51.100.10" },
    };

    await adminOnly(handler)(request as never, { status } as never);

    expect(status).toHaveBeenCalledWith(401);
    expect(handler).not.toHaveBeenCalled();
    expect(createClientWithToken).not.toHaveBeenCalled();
    expect(request).not.toHaveProperty("supabase");
  });

  it("preserves direct local development handler access", async () => {
    vi.stubEnv("NODE_ENV", "development");
    const handler = vi.fn();
    const request = {
      headers: { host: "localhost:3000" },
      socket: { remoteAddress: "::1" },
    };

    await adminOnly(handler)(request as never, {} as never);

    expect(handler).toHaveBeenCalledOnce();
    expect(request).toHaveProperty("supabase", serviceRoleClient);
    expect(createClientWithToken).not.toHaveBeenCalled();
  });

  it.each(["development", "production"])(
    "still requires a verified admin role for a remote request in %s",
    async (environment) => {
      vi.stubEnv("NODE_ENV", environment);
      const getUser = vi.fn().mockResolvedValue({
        data: { user: { id: "synthetic-user-id" } },
        error: null,
      });
      const maybeSingle = vi.fn();
      vi.mocked(createClientWithToken).mockReturnValue({
        auth: { getUser },
        from: vi.fn(() => ({
          select: vi.fn(() => ({ eq: vi.fn(() => ({ maybeSingle })) })),
        })),
      } as never);
      const json = vi.fn();
      const status = vi.fn().mockReturnValue({ json });
      const handler = vi.fn();

      for (const role of [undefined, "user", "admin"]) {
        maybeSingle.mockResolvedValue({ data: role ? { role } : null });
        const request = {
          headers: {
            host: "localhost:3000",
            authorization: "Bearer synthetic-user-token",
          },
          socket: { remoteAddress: "198.51.100.10" },
        };
        await adminOnly(handler)(request as never, { status } as never);
        if (role === "admin") {
          expect(handler).toHaveBeenCalledOnce();
          expect(request).toHaveProperty("supabase", serviceRoleClient);
        } else {
          expect(status).toHaveBeenLastCalledWith(403);
          expect(handler).not.toHaveBeenCalled();
          expect(request).not.toHaveProperty("supabase");
        }
      }
      expect(getUser).toHaveBeenCalledTimes(3);
      expect(maybeSingle).toHaveBeenCalledTimes(3);
    },
  );

  it("binds the role lookup to the verified user id", async () => {
    vi.stubEnv("NODE_ENV", "production");
    const maybeSingle = vi
      .fn()
      .mockResolvedValue({ data: { role: "admin" } });
    const eq = vi.fn(() => ({ maybeSingle }));
    const select = vi.fn(() => ({ eq }));
    const from = vi.fn(() => ({ select }));
    vi.mocked(createClientWithToken).mockReturnValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: { id: "verified-user-id" } },
          error: null,
        }),
      },
      from,
    } as never);
    const handler = vi.fn();
    const request = {
      headers: { authorization: "Bearer synthetic-user-token" },
      socket: { remoteAddress: "198.51.100.10" },
    };

    await adminOnly(handler)(request as never, {} as never);

    expect(from).toHaveBeenCalledWith("users");
    expect(select).toHaveBeenCalledWith("role");
    expect(eq).toHaveBeenCalledOnce();
    expect(eq).toHaveBeenCalledWith("user_id", "verified-user-id");
    expect(handler).toHaveBeenCalledOnce();
    expect(request).toHaveProperty("supabase", serviceRoleClient);
  });

  it.each([
    { data: { user: null }, error: null },
    { data: { user: { id: "" } }, error: null },
    { data: { user: {} }, error: null },
    { error: null },
  ])(
    "denies a token whose getUser result has no verified id: %j",
    async (getUserResult) => {
      vi.stubEnv("NODE_ENV", "production");
      const from = vi.fn();
      vi.mocked(createClientWithToken).mockReturnValue({
        auth: { getUser: vi.fn().mockResolvedValue(getUserResult) },
        from,
      } as never);
      const json = vi.fn();
      const status = vi.fn().mockReturnValue({ json });
      const handler = vi.fn();
      const request = {
        headers: { authorization: "Bearer synthetic-user-token" },
        socket: { remoteAddress: "198.51.100.10" },
      };

      await adminOnly(handler)(request as never, { status } as never);

      expect(status).toHaveBeenCalledWith(401);
      expect(json).toHaveBeenCalledWith({
        message: "Unauthorized.",
        success: false,
      });
      expect(from).not.toHaveBeenCalled();
      expect(handler).not.toHaveBeenCalled();
      expect(request).not.toHaveProperty("supabase");
    },
  );

  it("preserves authenticated remote cron access in production", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("CRON_SECRET", "synthetic-cron-secret");
    const handler = vi.fn();
    const request = {
      headers: { authorization: "Bearer synthetic-cron-secret" },
      socket: { remoteAddress: "198.51.100.10" },
    };

    await adminOnly(handler)(request as never, {} as never);

    expect(handler).toHaveBeenCalledOnce();
    expect(request).toHaveProperty("supabase", serviceRoleClient);
    expect(createClientWithToken).not.toHaveBeenCalled();
  });

  it("returns one fixed denial for missing, malformed, and rejected bearer tokens", async () => {
    vi.stubEnv("NODE_ENV", "production");
    const status = vi.fn();
    const json = vi.fn();
    status.mockReturnValue({ json });
    const handler = vi.fn();
    const protectedHandler = adminOnly(handler);

    for (const authorization of [
      undefined,
      "invalid",
      "Bearer",
      "Bearer token extra",
    ]) {
      await protectedHandler(
        { headers: { authorization, host: "fhfhockey.com" } } as never,
        { status } as never,
      );
      expect(status).toHaveBeenLastCalledWith(401);
      expect(json).toHaveBeenLastCalledWith({
        message: "Unauthorized.",
        success: false,
      });
    }
    expect(createClientWithToken).not.toHaveBeenCalled();

    vi.mocked(createClientWithToken).mockReturnValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({
          error: { message: "invalid JWT: internal parser detail" },
        }),
      },
    } as never);
    await protectedHandler(
      {
        headers: {
          authorization: "Bearer structurally-valid-token",
          host: "fhfhockey.com",
        },
      } as never,
      { status } as never,
    );

    expect(status).toHaveBeenLastCalledWith(401);
    expect(json).toHaveBeenLastCalledWith({
      message: "Unauthorized.",
      success: false,
    });
    expect(handler).not.toHaveBeenCalled();
  });
});
