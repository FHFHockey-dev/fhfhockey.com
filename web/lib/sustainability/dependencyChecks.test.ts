import { beforeEach, describe, expect, it, vi } from "vitest";
import { assertScorePrerequisites } from "./dependencyChecks";

const fetchMock = vi.hoisted(() => vi.fn<typeof fetch>());

vi.mock("lib/supabase/server", async () => {
  const { createClient } = await import("@supabase/supabase-js");
  return {
    default: createClient("https://sustainability.invalid", "test-key", {
      global: { fetch: fetchMock },
      auth: { autoRefreshToken: false, persistSession: false },
    }),
  };
});

describe("assertScorePrerequisites", () => {
  beforeEach(() => {
    fetchMock.mockReset();
    fetchMock
      .mockImplementationOnce(async () =>
        new Response(null, { headers: { "content-range": "0-0/1" } })
      )
      .mockImplementationOnce(async () =>
        new Response(null, { headers: { "content-range": "0-0/1" } })
      );
  });

  it("checks Window Z existence with one row and no exact count", async () => {
    fetchMock.mockResolvedValueOnce(Response.json([{ player_id: 8470613 }]));

    await expect(assertScorePrerequisites(20262027, "2026-11-27")).resolves.toBeUndefined();

    expect(fetchMock).toHaveBeenCalledTimes(3);
    const [input, init] = fetchMock.mock.calls[2];
    const url = new URL(String(input));
    expect(url.pathname).toBe("/rest/v1/sustainability_window_z");
    expect(Object.fromEntries(url.searchParams)).toEqual({
      select: "player_id",
      season_id: "eq.20262027",
      snapshot_date: "eq.2026-11-27",
      limit: "1",
    });
    expect(init?.method).toBe("GET");
    expect(new Headers(init?.headers).get("prefer")).toBeNull();
  });

  it("preserves the structured failure when Window Z has no matching rows", async () => {
    fetchMock.mockResolvedValueOnce(Response.json([]));

    await expect(assertScorePrerequisites(20262027, "2026-11-27")).rejects.toMatchObject({
      statusCode: 424,
      issue: { code: "missing_sustainability_window_z" },
    });
  });

  it("propagates a failed read with the database error intact", async () => {
    const error = { code: "57014", message: "canceling statement due to statement timeout" };
    fetchMock.mockResolvedValueOnce(Response.json(error, { status: 500 }));

    await expect(assertScorePrerequisites(20262027, "2026-11-27")).rejects.toMatchObject(error);
  });
});
