import { afterEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createClient: vi.fn(() => ({})),
}));

vi.mock("@supabase/supabase-js", () => ({
  createClient: mocks.createClient,
}));

vi.mock("dotenv", () => ({
  config: vi.fn(),
}));

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
  vi.resetModules();
});

describe("legacy WGO averages module lifecycle", () => {
  it("does not execute the batch or terminate the process when Next imports it", async () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://example.supabase.co");
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "test-service-role-key");
    vi.stubEnv("RUN_WGO_AVERAGES_SCRIPT", "");
    const exit = vi
      .spyOn(process, "exit")
      .mockImplementation((() => undefined) as never);

    const averagesModule =
      await import("../../../../pages/api/WGOAverages/calculateAverages");

    expect(averagesModule.main).toBeTypeOf("function");
    expect(exit).not.toHaveBeenCalled();
  });
});
