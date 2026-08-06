import { afterEach, describe, expect, it, vi } from "vitest";

import { createClientWithToken } from "lib/supabase";

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

  it("allows localhost requests in non-production environments", () => {
    vi.stubEnv("NODE_ENV", "development");

    expect(
      invokedByLocalDev({
        headers: {
          host: "localhost:3000",
        },
      } as never),
    ).toBe(true);
    expect(
      invokedByLocalDev({
        headers: {
          host: "127.0.0.1:3000",
        },
      } as never),
    ).toBe(true);
  });

  it("does not allow non-local or production requests through the localhost bypass", () => {
    vi.stubEnv("NODE_ENV", "development");

    expect(
      invokedByLocalDev({
        headers: {
          host: "fhfhockey.com",
        },
      } as never),
    ).toBe(false);

    vi.stubEnv("NODE_ENV", "production");

    expect(
      invokedByLocalDev({
        headers: {
          host: "localhost:3000",
        },
      } as never),
    ).toBe(false);
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
