import { afterEach, describe, expect, it, vi } from "vitest";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
});

describe("getServiceRoleClient", () => {
  it("does not fall back to a public key when the service-role key is missing", async () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://example.supabase.co");
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLIC_KEY", "public-key");

    const { getServiceRoleClient } = await import("./server");

    expect(() => getServiceRoleClient()).toThrow(
      "Server-only Supabase access requires NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY."
    );
  });

  it("creates one stable client after the required server configuration is available", async () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://example.supabase.co");
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "service-role-key");

    const { getServiceRoleClient } = await import("./server");

    expect(getServiceRoleClient()).toBe(getServiceRoleClient());
  });
});
