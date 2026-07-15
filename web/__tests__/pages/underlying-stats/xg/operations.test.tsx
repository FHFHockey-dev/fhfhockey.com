import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import XgOperationsRoute from "../../../../pages/underlying-stats/xg/operations";

vi.mock("next/head", () => ({ default: ({ children }: { children: React.ReactNode }) => children }));
vi.mock("next/link", () => ({ default: ({ children, href, ...props }: React.AnchorHTMLAttributes<HTMLAnchorElement> & { href: string }) => <a href={href} {...props}>{children}</a> }));
vi.mock("components/underlying-stats/UnderlyingStatsNavBar", () => ({ default: () => <nav aria-label="Underlying stats navigation" /> }));

const payload = {
  success: true,
  generatedAt: "2026-07-12T21:00:00.000Z",
  partial: true,
  notes: ["execution leases unavailable: relation does not exist"],
  counts: { featureCount: 1200, predictionCount: 1000, aggregateCounts: { team: 100, player: 200, goalie: 50 }, aggregateReconciliation: { status: "ok", gamesChecked: 25, issueCount: 0, maximumAbsoluteDelta: 0 }, flurryAggregateCoverage: { teamGame: { total: 100, adjusted: 100 }, playerGame: { total: 200, adjusted: 200 }, goalieGame: { total: 50, adjusted: 50 }, teamRolling: { total: 300, adjusted: 300 }, playerRolling: { total: 600, adjusted: 600 }, goalieRolling: { total: 150, adjusted: 150 } }, flurryAggregateReconciliation: { status: "ok", gamesChecked: 25, issueCount: 0, maximumAbsoluteDelta: 0 }, registryModelVersion: "xg-v2", predictionModelVersion: "xg-v2", runningLeaseCount: 0 },
  alerts: [{ key: "leases_unavailable", severity: "warn", message: "Durable xG execution leases are not deployed." }],
  calibration: { minimumSampleSize: 50, binCount: 10, overall: { exampleCount: 1000, goalCount: 80, goalRate: .08, averagePrediction: .08, logLoss: .2, brierScore: .07 }, segments: [] },
  benchmarks: [{ key: "all_situations_unblocked", label: "All situations", filters: {}, metrics: { exampleCount: 1000, goalCount: 80, goalRate: .08, averagePrediction: .08, logLoss: .2, brierScore: .07 } }],
  featureCoverage: { status: "ok", sampleRows: 1000, requiredRows: 1000, issues: [], scoringProfile: { features: {} } },
  derivedLayers: { flurry: { shots: 1000, rawXg: 80, flurryAdjustedXg: 76, adjustment: -4, rawPreserved: true }, residual: { rows: 1000, shooterEffectsAvailable: 500, goalieEffectsAvailable: 450 }, reboundHeads: { rows: 250, available: 250 } },
  registry: [],
  leases: [],
  externalTaxonomy: [{ provider: "MoneyPuck", verification: "verified", comparisonRule: "Compare only aligned taxonomies." }],
};

describe("XgOperationsRoute", () => {
  beforeEach(() => vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => payload })));
  afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

  it("renders partial health, contract, derived, and benchmark telemetry", async () => {
    render(<XgOperationsRoute />);
    await waitFor(() => expect(screen.getByText("xG Pipeline Health")).toBeTruthy());
    expect(await screen.findByText(/Partial telemetry/)).toBeTruthy();
    expect(screen.getByText("1,200")).toBeTruthy();
    expect(screen.getAllByText("xg-v2", { selector: "dd" })).toHaveLength(2);
    expect(screen.getByText("All situations")).toBeTruthy();
    expect(screen.getByText("MoneyPuck")).toBeTruthy();
    expect(screen.getByText("Flurry surfaces complete").nextSibling?.textContent).toBe("6 / 6");
  });

  it("shows an explicit authorization failure", async () => {
    vi.mocked(fetch).mockResolvedValueOnce({ ok: false, status: 401, json: async () => ({}) } as Response);
    render(<XgOperationsRoute />);
    expect((await screen.findByRole("alert")).textContent).toContain("Admin authorization is required.");
  });
});
