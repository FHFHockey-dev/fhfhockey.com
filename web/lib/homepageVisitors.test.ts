import { describe, expect, it, vi } from "vitest";

import {
  buildDailyVisitorPoints,
  fetchDailyVisitorPoints,
} from "./homepageVisitors";

describe("homepage visitors", () => {
  it("turns valid daily visitor totals into chronological pulse points", () => {
    expect(
      buildDailyVisitorPoints([
        { timestamp: "2026-08-04T00:00:00.000Z", visitors: 42 },
        { timestamp: "invalid", visitors: 99 },
        { timestamp: "2026-08-03T00:00:00.000Z", visitors: 31 },
      ]),
    ).toEqual([
      { timestamp: "2026-08-03T00:00:00.000Z", value: 31 },
      { timestamp: "2026-08-04T00:00:00.000Z", value: 42 },
    ]);
  });

  it("requests today and the previous 14 days from Vercel Web Analytics", async () => {
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        data: [
          { timestamp: "2026-08-05T00:00:00.000Z", visitors: 18 },
        ],
      }),
    });

    await expect(
      fetchDailyVisitorPoints({
        token: "secret-token",
        projectId: "project-id",
        teamId: "team-id",
        now: new Date("2026-08-05T19:00:00.000Z"),
        fetchImpl: fetchImpl as unknown as typeof fetch,
      }),
    ).resolves.toEqual([
      { timestamp: "2026-08-05T00:00:00.000Z", value: 18 },
    ]);

    const [requestUrl, requestInit] = fetchImpl.mock.calls[0];
    const url = new URL(requestUrl);
    expect(url.searchParams.get("by")).toBe("day");
    expect(url.searchParams.get("projectId")).toBe("project-id");
    expect(url.searchParams.get("teamId")).toBe("team-id");
    expect(url.searchParams.get("since")).toBe(
      "2026-07-22T00:00:00.000Z",
    );
    expect(requestInit.headers.Authorization).toBe("Bearer secret-token");
  });
});
