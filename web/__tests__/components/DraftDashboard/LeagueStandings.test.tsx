import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import LeagueStandings from "components/DraftDashboard/LeagueStandings";

afterEach(cleanup);

it("keeps Team VORP selected when sorting schedule totals and includes bench players once", () => {
  const team = (id: string, playerIds: string[]) => ({ teamId: id, teamName: id, projectedPoints: 0, teamVorp: 0, categoryTotals: {}, rosterSlots: { C: [{ playerId: playerIds[0] }] }, bench: playerIds.map((playerId) => ({ playerId })) });
  render(<LeagueStandings teams={[team("A", ["1", "2"]), team("B", ["3"])] as any} categories={{}} leagueType="points" myTeamId="A" vorpMetrics={new Map()} onUpdateTeamName={vi.fn()} canEdit={false} isLoading={false} error={null} schedulePeriod="Playoffs · Weeks 24, 27" scheduleMetrics={new Map([["1", { games: 4, off: 1, b2b: 0 }], ["2", { games: 4, off: 2, b2b: 1 }]])} />);
  expect(screen.queryByRole("columnheader", { name: "Off-Nights" })).toBeNull();
  fireEvent.change(screen.getByRole("combobox", { name: "Standings summary" }), { target: { value: "vorp" } });
  fireEvent.click(screen.getByRole("button", { name: "Off-Nights" }));
  expect((screen.getByRole("combobox", { name: "Standings summary" }) as HTMLSelectElement).value).toBe("vorp");
  const rows = within(screen.getByRole("table")).getAllByRole("row");
  expect(rows[1].textContent).toContain("3");
  expect(rows[2].textContent).toContain("—");
});


it("marks estimated rates, leaves unavailable rates unranked, and sorts unavailable last", () => {
  const team = (teamId: string, value: number | null, quality: "estimated" | "unavailable") => ({ teamId, teamName: teamId, owner: teamId, projectedPoints: 0, teamVorp: 0, categoryTotals: { GOALS_AGAINST_AVERAGE: value }, categoryAggregateQuality: { GOALS_AGAINST_AVERAGE: quality }, rosterSlots: {}, bench: [] });
  render(<LeagueStandings teams={[team("Unavailable", null, "unavailable"), team("Estimated", 2.5, "estimated")]} categories={{ GOALS_AGAINST_AVERAGE: 1 }} leagueType="categories" myTeamId="Estimated" vorpMetrics={new Map()} onUpdateTeamName={vi.fn()} canEdit={false} isLoading={false} error={null} />);
  expect(screen.getByLabelText("Estimated team rate based on projected workload").textContent).toBe("≈");
  const unavailable = screen.getByLabelText("Unavailable team rate").closest("td")!;
  expect(unavailable.textContent).toBe("N/A");
  expect(unavailable.hasAttribute("data-rank")).toBe(false);
  expect(unavailable.hasAttribute("data-band")).toBe(false);
  fireEvent.click(screen.getByRole("button", { name: "GAA" }));
  expect(within(screen.getByRole("table")).getAllByRole("row")[2].textContent).toContain("Unavailable");
  fireEvent.click(screen.getByRole("button", { name: "GAA" }));
  expect(within(screen.getByRole("table")).getAllByRole("row")[2].textContent).toContain("Unavailable");
});
