import React from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import TeamPerformanceDrivers from "./TeamPerformanceDrivers";
import type { TeamPerformanceDriverResult } from "./teamPerformanceDriverModel";

const { build } = vi.hoisted(() => ({ build: vi.fn() }));
vi.mock("./fetchTeamDriverSnapshots", () => ({
  fetchTeamDriverSnapshots: vi.fn().mockResolvedValue({ fiveOnFiveRows: [], specialTeamsRows: [] })
}));
vi.mock("./teamPerformanceDriverModel", async (importOriginal) => ({
  ...(await importOriginal<typeof import("./teamPerformanceDriverModel")>()),
  buildTeamPerformanceDrivers: build
}));
afterEach(cleanup);

const result = (coverage: Partial<TeamPerformanceDriverResult>): TeamPerformanceDriverResult => ({
  drivers: [{ key: "generation", label: "Chance Generation", valueLabel: "2.40 xGF/GP", percentile: 70, status: "strength", explanation: "x" }],
  fiveOnFiveCoverage: null,
  specialTeamsCoverage: null,
  fiveOnFiveDate: "2026-04-04",
  fiveOnFiveOldestDate: "2026-04-04",
  specialTeamsDate: "2026-04-03",
  specialTeamsOldestDate: "2026-04-03",
  leagueSample: 32,
  ...coverage
});

const mount = () => render(
  <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
    <TeamPerformanceDrivers teamId={23} teamAbbreviation="VAN" seasonId={20252026} />
  </QueryClientProvider>
);

describe("TeamPerformanceDrivers coverage label", () => {
  it("labels partial coverage with N of M games and says rates use covered games only", async () => {
    build.mockReturnValue(result({ fiveOnFiveCoverage: { coveredGames: 74, expectedGames: 78 }, specialTeamsCoverage: { coveredGames: 77, expectedGames: 78 } }));
    mount();
    expect(await screen.findByText(/5v5: 74 of 78 games to Apr 4/)).toBeTruthy();
    expect(screen.getByText(/Special teams: 77 of 78 games to Apr 3/)).toBeTruthy();
    expect(screen.getByText("Partial: covered games only")).toBeTruthy();
  });

  it("keeps the complete display with no coverage label at 100%", async () => {
    build.mockReturnValue(result({}));
    mount();
    expect(await screen.findByText(/Regular season · 5v5: Apr 4/)).toBeTruthy();
    expect(screen.getByText(/Special teams through: Apr 3/)).toBeTruthy();
    expect(screen.queryByText(/games to/)).toBeNull();
    expect(screen.queryByText(/Partial coverage/)).toBeNull();
  });

  it("says the player has no current team, and names a failed season lookup", async () => {
    const view = (client: QueryClient, props: Partial<React.ComponentProps<typeof TeamPerformanceDrivers>>) =>
      <QueryClientProvider client={client}>
        <TeamPerformanceDrivers teamId={null} teamAbbreviation={null} seasonId={20262027} hasPlayer {...props} />
      </QueryClientProvider>;
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const { rerender } = render(view(client, {}));
    expect(screen.getByText("No current team, so no team drivers.")).toBeTruthy();
    expect(screen.queryByText("Select a player")).toBeNull();
    await client.prefetchQuery({ queryKey: ["currentSeason"], queryFn: () => Promise.reject(new Error("season down")) });
    rerender(view(client, { teamId: 23, teamAbbreviation: "VAN", seasonId: null }));
    expect(screen.getByText("Unable to load season info right now.")).toBeTruthy();
  });
});

describe("TeamPerformanceDrivers special-teams percentile (D4)", () => {
  it("renders the true 32-team percentile of the PP+PK standing", async () => {
    const actual = await vi.importActual<typeof import("./teamPerformanceDriverModel")>("./teamPerformanceDriverModel");
    const { thirtyTwoTeamDriverFixture, thirtyTwoTeamExpectedSpecialTeamsPercentile } =
      await import("./teamPerformanceDrivers.fixture");
    const { fiveOnFive, specialTeams } = thirtyTwoTeamDriverFixture();
    const snapshots = await import("./fetchTeamDriverSnapshots");
    vi.mocked(snapshots.fetchTeamDriverSnapshots).mockResolvedValueOnce({
      fiveOnFiveRows: fiveOnFive, specialTeamsRows: specialTeams
    } as any);
    build.mockImplementation(actual.buildTeamPerformanceDrivers);
    render(
      <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
        <TeamPerformanceDrivers teamId={1} teamAbbreviation="T0" seasonId={20252026} />
      </QueryClientProvider>
    );
    const { truePercentile, meanOfPercentiles } = thirtyTwoTeamExpectedSpecialTeamsPercentile();
    const card = (await screen.findByText("Special Teams")).closest("article")!;
    expect(card.textContent).toContain(`${actual.formatPercentileOrdinal(truePercentile)} pct`);
    expect(card.textContent).not.toContain(`${actual.formatPercentileOrdinal(meanOfPercentiles)} pct`);
    build.mockReset();
  });
});
