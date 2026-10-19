import { describe, expect, it, vi } from "vitest";

vi.hoisted(() => {
  process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.test";
  process.env.SUPABASE_SERVICE_ROLE_KEY = "service-role-test-key";
});

const { fetchCurrentSeasonMock } = vi.hoisted(() => ({
  fetchCurrentSeasonMock: vi.fn(),
}));

vi.mock("dotenv", () => ({
  default: { config: vi.fn() },
}));

vi.mock("../../../../../utils/fetchCurrentSeason", () => ({
  fetchCurrentSeason: fetchCurrentSeasonMock,
}));

vi.mock("@supabase/supabase-js", () => ({
  createClient: () => ({
    from() {
      throw new Error("Supabase mock not configured for this test.");
    },
  }),
}));

import handler from "../../../../../pages/api/v1/trends/team-sos";

function createMockRes() {
  return {
    statusCode: 200,
    body: null as any,
    headers: {} as Record<string, string | string[]>,
    setHeader(key: string, value: string | string[]) {
      this.headers[key] = value;
    },
    status(code: number) {
      this.statusCode = code;
      return this;
    },
    json(payload: any) {
      this.body = payload;
      return this;
    },
  } as any;
}

describe("/api/v1/trends/team-sos", () => {
  it("redacts dependency details from internal-error responses", async () => {
    fetchCurrentSeasonMock.mockRejectedValueOnce(
      new Error("relation private_seasons denied Bearer secret"),
    );
    const consoleError = vi
      .spyOn(console, "error")
      .mockImplementation(() => {});
    const res = createMockRes();

    await handler({ method: "GET", query: {} } as any, res);

    expect(res.statusCode).toBe(500);
    expect(res.body).toEqual({
      message: "Failed to compute strength of schedule.",
      error: "TEAM_SOS_UNAVAILABLE",
    });
    expect(JSON.stringify(res.body)).not.toContain("secret");
    consoleError.mockRestore();
  });
});
