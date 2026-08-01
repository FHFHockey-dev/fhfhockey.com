import { afterEach, describe, expect, it, vi } from "vitest";

const createClient = vi.hoisted(() => vi.fn(() => ({ auth: {} })));

vi.mock("@supabase/supabase-js", () => ({
  createClient,
}));

afterEach(() => {
  createClient.mockReset();
  vi.unstubAllEnvs();
  vi.resetModules();
});

describe("browser Supabase client", () => {
  it("uses PKCE while keeping callback payload processing explicit", async () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://example.supabase.co");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLIC_KEY", "public-key");

    await import("./client");

    expect(createClient).toHaveBeenCalledWith(
      "https://example.supabase.co",
      "public-key",
      expect.objectContaining({
        auth: expect.objectContaining({
          persistSession: true,
          autoRefreshToken: true,
          detectSessionInUrl: false,
          flowType: "pkce",
        }),
      }),
    );
  });
});
