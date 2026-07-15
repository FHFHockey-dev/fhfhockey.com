import { afterEach, describe, expect, it, vi } from "vitest";

import {
  invokedByCron,
  invokedByLocalDev,
} from "../../utils/adminOnlyMiddleware";

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
});
