import { beforeEach, describe, expect, it, vi } from "vitest";
import type { NextApiRequest, NextApiResponse } from "next";

const mocks = vi.hoisted(() => ({
  fetchDates: vi.fn(),
  fetchStatus: vi.fn(),
  resolveSnapshot: vi.fn()
}));

vi.mock("../../../lib/supabase/server", () => ({ default: {} }));
vi.mock("../../../lib/underlying-stats/availableSnapshotDates", () => ({
  fetchDistinctUnderlyingStatsSnapshotDates: mocks.fetchDates
}));
vi.mock("../../../lib/underlying-stats/teamLandingRatings", () => ({
  resolveUnderlyingStatsLandingSnapshot: mocks.resolveSnapshot
}));
vi.mock("../../../lib/underlying-stats/ulsRouteStatus", () => ({
  fetchUlsRouteStatus: mocks.fetchStatus
}));

import handler from "./landing";

const response = () => {
  const res = {
    setHeader: vi.fn(),
    status: vi.fn().mockReturnThis(),
    json: vi.fn().mockReturnThis()
  };
  return res;
};

describe("GET /api/underlying-stats/landing", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns dates, the requested snapshot, and readiness", async () => {
    const dates = ["2026-04-05"];
    const snapshot = { ratings: [], resolvedDate: "2026-04-05" };
    const status = { teamRatings: { status: "ready" } };
    mocks.fetchDates.mockResolvedValue(dates);
    mocks.fetchStatus.mockResolvedValue(status);
    mocks.resolveSnapshot.mockResolvedValue(snapshot);
    const res = response();

    await handler(
      { method: "GET", query: { date: "2026-04-05" } } as unknown as NextApiRequest,
      res as unknown as NextApiResponse
    );

    expect(mocks.resolveSnapshot).toHaveBeenCalledWith({
      requestedDate: "2026-04-05",
      availableDates: dates
    });
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({
      availableDates: dates,
      initialSnapshot: snapshot,
      routeStatus: status
    });
  });

  it("rejects non-GET requests without loading data", async () => {
    const res = response();

    await handler(
      { method: "POST", query: {} } as unknown as NextApiRequest,
      res as unknown as NextApiResponse
    );

    expect(res.status).toHaveBeenCalledWith(405);
    expect(mocks.fetchDates).not.toHaveBeenCalled();
  });
});
