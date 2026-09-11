import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import GodView from "components/DraftDashboard/GodView";
import { rankTeamCategories } from "lib/draftDashboard/categoryStandings";
import type { ComponentProps } from "react";

afterEach(() => { cleanup(); vi.unstubAllGlobals(); localStorage.clear(); });

it("shows selected players and live team ranks using the standings selector", () => {
  vi.stubGlobal("ResizeObserver", class { observe() {} disconnect() {} });
  const categories = { GOALS: 1, GOALS_AGAINST_AVERAGE: 1, HITS: -1 };
  const teams = [
    { teamId: "A", teamName: "Ice Owls", categoryTotals: { GOALS: 10, GOALS_AGAINST_AVERAGE: 2, HITS: 20 } },
    { teamId: "B", teamName: "Snow Cats", categoryTotals: { GOALS: 10, GOALS_AGAINST_AVERAGE: 3, HITS: 10 } },
  ].map(team => ({ ...team, owner: team.teamId, rosterSlots: {}, bench: [], projectedPoints: 0, teamVorp: 0 }));
  const props: ComponentProps<typeof GodView> = {
    queue: [
      { pickNumber: 1, round: 1, pickInRound: 1, teamId: "A", status: "completed", playerId: "p1" },
      { pickNumber: 2, round: 1, pickInRound: 2, teamId: "B", status: "keeper", playerId: "p2" },
      { pickNumber: 3, round: 2, pickInRound: 1, teamId: "A", status: "skipped" },
      { pickNumber: 4, round: 2, pickInRound: 2, teamId: "B", status: "upcoming" },
    ], categories, leagueType: "points", teams, playerNames: new Map([["p1", "First Player"], ["p2", "Keeper Player"]]),
    rosterConfig: { C: 2 }, myTeamId: "A", selectedTeamId: "A", currentPick: 4, totalPicks: 4, round: 2, format: "standard",
    access: { eligible: true, capabilities: ["god_view"], reason: "eligible", grantingSources: ["purchase"], expiresAt: null, verifiedAt: null, nextVerificationAt: null, providerReadiness: { stripe: false, patreon: false, yahoo: false } }, onSelectTeam: vi.fn(), onExpandGraph: vi.fn(), onSummary: vi.fn(), onOpenChange: vi.fn(),
  };
  const { container, rerender } = render(<GodView {...props} />);
  fireEvent.click(screen.getByRole("button", { name: "Expand God View - Pro" }));
  expect(container.querySelector('[data-pick="1"]')?.textContent).toContain("First Player");
  expect(container.querySelector('[data-pick="1"]')?.textContent).toContain("Ice Owls");
  expect(container.querySelector('[data-pick="2"]')?.textContent).toContain("Keeper");
  expect(container.querySelector('[data-pick="3"]')?.textContent).toContain("No player selected");
  expect(container.querySelector('[data-pick="3"]')?.textContent).not.toContain("Player unavailable");
  const check = (updated: typeof teams) => {
    const ranks = rankTeamCategories(updated, categories, "points");
    for (const [pick, teamId] of [[1, "A"], [2, "B"]] as const) {
      for (const key of Object.keys(categories)) expect(container.querySelector(`[data-pick="${pick}"] [data-category="${key}"]`)?.getAttribute("data-rank")).toBe(String(ranks[teamId][key]));
      expect(container.querySelector(`[data-pick="${pick}"] [data-position]`)).toBeNull();
    }
  };
  check(teams);
  expect(container.querySelector('[data-pick="1"] [data-category="GOALS"]')?.getAttribute("data-rank")).toBe("1");
  expect(container.querySelector('[data-pick="2"] [data-category="GOALS"]')?.getAttribute("data-rank")).toBe("1");
  expect(container.querySelector('[data-pick="1"] [data-category="GOALS_AGAINST_AVERAGE"]')?.getAttribute("data-rank")).toBe("1");
  expect(container.querySelector('[data-pick="1"] [data-category="HITS"]')?.getAttribute("data-rank")).toBe("2");
  const updated = teams.map(team => ({ ...team, categoryTotals: { ...team.categoryTotals, GOALS: team.teamId === "B" ? 30 : 10 } }));
  rerender(<GodView {...props} teams={updated} />);
  check(updated);
});
