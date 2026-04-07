import { describe, expect, it, vi } from "vitest";

import { invokedByCron, invokedByLocalDev } from "../../utils/adminOnlyMiddleware";

describe("adminOnlyMiddleware", () => {
  it("accepts the cron secret bearer token", () => {
    vi.stubEnv("CRON_SECRET", "test-secret");

    expect(invokedByCron("Bearer test-secret")).toBe(true);
    expect(invokedByCron("Bearer wrong-secret")).toBe(false);
  });

  it("allows localhost requests in non-production environments", () => {
    vi.stubEnv("NODE_ENV", "development");

    expect(
      invokedByLocalDev({
        headers: {
          host: "localhost:3000",
        },
      } as never)
    ).toBe(true);
    expect(
      invokedByLocalDev({
        headers: {
          host: "127.0.0.1:3000",
        },
      } as never)
    ).toBe(true);
  });

  it("does not allow non-local or production requests through the localhost bypass", () => {
    vi.stubEnv("NODE_ENV", "development");

    expect(
      invokedByLocalDev({
        headers: {
          host: "fhfhockey.com",
        },
      } as never)
    ).toBe(false);

    vi.stubEnv("NODE_ENV", "production");

    expect(
      invokedByLocalDev({
        headers: {
          host: "localhost:3000",
        },
      } as never)
    ).toBe(false);
  });
});
