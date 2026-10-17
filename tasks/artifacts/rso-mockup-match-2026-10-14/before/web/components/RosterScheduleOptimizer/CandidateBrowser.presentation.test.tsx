import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import CandidateBrowser from "./CandidateBrowser";
import { defaultWorkspace } from "lib/rosterScheduleOptimizer/workspace";
import type { PlanningPlayer, PlanningSnapshot } from "lib/rosterScheduleOptimizer/planningTypes";
import type { CandidateComparison } from "lib/rosterScheduleOptimizer/candidatePlanMetrics";

const fixture = vi.hoisted(() => ({ candidates: undefined as CandidateComparison[] | undefined }));
vi.mock("hooks/useCandidateMetrics", () => ({ useCandidateMetrics: () => ({ metrics: fixture.candidates ? { candidates: fixture.candidates } : undefined, loading: false, error: null }) }));
afterEach(() => { cleanup(); fixture.candidates = undefined; vi.useRealTimers(); });
it("starts with individual cards and respects the selected result count when filtering and expanding", () => {
  const workspace = defaultWorkspace();
  const players: PlanningPlayer[] = Array.from({ length: 12 }, (_, index) => ({ id: String(index), nhlId: null, name: `Candidate ${index}`,
    teamAbbreviation: "CAR", eligiblePositions: ["C"], playerClass: "skater", availability: "free_agent", ownership: null,
    canDrop: true, holdValue: null, reserveEligibility: [] }));
  const snapshot: PlanningSnapshot = { id: "presentation", context: workspace.context, rules: workspace.rules, games: [], players,
    roster: [], lockedAssignments: [], forecasts: [], realized: {}, opponent: null, evidence: {} };
  const props = { players, rosterIds: new Set<string>(), snapshot,
    intent: { ...workspace.intent, alternativeCount: 5 as const }, fits: [], manual: true, select: vi.fn(), add: vi.fn(), markAvailable: vi.fn() };
  const view = render(<CandidateBrowser {...props} />);
  expect(screen.getAllByRole("article")).toHaveLength(5);
  fireEvent.click(screen.getByRole("button", { name: "Show more players" }));
  expect(screen.getAllByRole("article")).toHaveLength(10);
  fireEvent.click(screen.getByText("Find & filter"));
  fireEvent.change(screen.getByRole("searchbox", { name: "Find candidate" }), { target: { value: "Candidate 11" } });
  expect(screen.getAllByRole("article")).toHaveLength(1);
  fireEvent.change(screen.getByRole("searchbox", { name: "Find candidate" }), { target: { value: "" } });
  expect(screen.getAllByRole("article")).toHaveLength(5);
  view.rerender(<CandidateBrowser {...props} intent={{ ...props.intent, alternativeCount: 10 }} />);
  expect(screen.getAllByRole("article")).toHaveLength(10);
});

it.each([6, 3])("shares one display budget across %i supported and unavailable points candidates", count => {
  const workspace = defaultWorkspace();
  const players: PlanningPlayer[] = Array.from({ length: count * 2 }, (_, index) => ({ id: String(index), nhlId: null,
    name: index < count ? `Supported ${index}` : `Unavailable ${index - count}`,
    teamAbbreviation: index < count ? "CAR" : "BOS", eligiblePositions: [index < count ? "C" : "RW"],
    playerClass: "skater", availability: "free_agent", ownership: null, canDrop: true, holdValue: null, reserveEligibility: [] }));
  fixture.candidates = players.map((player, index) => ({ playerId: player.id, complete: true,
    plans: [{ objective: "outcome", steps: [], netAGP: index < count ? 1 : count * 2 - index,
      netPoints: index < count ? 2 - index : null, dropped: [], displacedPlayerIds: [] }] }));
  const props = { players: [...players].reverse(), rosterIds: new Set<string>(), snapshot: null,
    intent: { ...workspace.intent, alternativeCount: 5 as const }, fits: [], manual: true, select: vi.fn(), add: vi.fn(), markAvailable: vi.fn() };
  const view = render(<CandidateBrowser {...props} />);
  const ids = () => screen.getAllByRole("article").map(article => article.getAttribute("data-rso-candidate-id"));
  expect(ids()).toEqual(players.slice(0, 5).map(player => player.id));
  fireEvent.click(screen.getByRole("button", { name: "Show more players" }));
  expect(ids()).toEqual(players.slice(0, 10).map(player => player.id));
  expect(screen.getByRole("heading", { name: "Net AGP · points unavailable" })).toBeTruthy();
  for (const article of screen.getAllByRole("article").slice(count)) {
    expect(within(article).getByText("unavailable")).toBeTruthy();
    expect(within(article).getByText(/Missing comparison evidence/)).toBeTruthy();
  }
  if (count === 6) {
    expect(screen.getByLabelText("Result 10")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Show more players" }));
    expect(ids()).toEqual(players.map(player => player.id));
  }
  expect(screen.queryByRole("button", { name: "Show more players" })).toBeNull();
  view.rerender(<CandidateBrowser {...props} intent={{ ...props.intent, alternativeCount: 10 }} />);
  expect(ids()).toEqual(players.slice(0, 10).map(player => player.id));
  view.rerender(<CandidateBrowser {...props} />);
  expect(ids()).toEqual(players.slice(0, 5).map(player => player.id));

  fireEvent.click(screen.getByRole("button", { name: "Show more players" }));
  fireEvent.click(screen.getByText("Find & filter"));
  fireEvent.change(screen.getByRole("combobox", { name: "Team" }), { target: { value: "BOS" } });
  expect(ids()).toEqual(players.slice(count, count + 5).map(player => player.id));
  fireEvent.change(screen.getByRole("combobox", { name: "Team" }), { target: { value: "" } });
  expect(ids()).toEqual(players.slice(0, 5).map(player => player.id));
  fireEvent.click(screen.getByRole("button", { name: "Show more players" }));
  fireEvent.change(screen.getByRole("combobox", { name: "Position" }), { target: { value: "RW" } });
  expect(ids()).toEqual(players.slice(count, count + 5).map(player => player.id));
  fireEvent.change(screen.getByRole("combobox", { name: "Position" }), { target: { value: "" } });
  expect(ids()).toEqual(players.slice(0, 5).map(player => player.id));
  fireEvent.click(screen.getByRole("button", { name: "Show more players" }));
  fireEvent.change(screen.getByRole("searchbox", { name: "Find candidate" }), { target: { value: "Unavailable 2" } });
  expect(ids()).toEqual([String(count + 2)]);
  fireEvent.change(screen.getByRole("searchbox", { name: "Find candidate" }), { target: { value: "" } });
  expect(ids()).toEqual(players.slice(0, 5).map(player => player.id));
});

function discoveryFixture() {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-10-13T12:00:00Z"));
  const workspace = defaultWorkspace();
  workspace.context = { ...workspace.context, startDate: "2026-10-12", endDate: "2026-10-18", asOf: "2026-10-13T12:00:00Z" };
  const players: PlanningPlayer[] = [
    { id: "alpha", nhlId: 1, nhlTeamId: 1, name: "Alpha Unknown", teamAbbreviation: "AAA", eligiblePositions: ["C"], playerClass: "skater", availability: "unknown", ownership: null, canDrop: null, holdValue: null, reserveEligibility: [] },
    { id: "zulu", nhlId: 2, nhlTeamId: 2, name: "Zulu Unknown", teamAbbreviation: "ZZZ", eligiblePositions: ["C"], playerClass: "skater", availability: "unknown", ownership: null, canDrop: null, holdValue: null, reserveEligibility: [] },
    { id: "missing", nhlId: 3, name: "Missing Team", teamAbbreviation: "AAA", eligiblePositions: ["C"], playerClass: "skater", availability: "unknown", ownership: null, canDrop: null, holdValue: null, reserveEligibility: [] },
  ];
  const snapshot: PlanningSnapshot = { id: "partial", context: workspace.context, rules: workspace.rules, games: [], players,
    roster: [], lockedAssignments: [], forecasts: [], realized: {}, opponent: null, evidence: { schedule: { source: "fixture", asOf: null, seasonId: workspace.context.seasonId, completeness: "partial", limitations: [] } } };
  return { players, rosterIds: new Set<string>(), snapshot, intent: workspace.intent, fits: [], manual: false, select: vi.fn(), add: vi.fn(), markAvailable: vi.fn() };
}
it("leaves unavailable comparisons unranked and names alphabetical browsing for either selected net sort", () => {
  render(<CandidateBrowser {...discoveryFixture()} />);
  const ids = () => screen.getAllByRole("article").map(article => article.getAttribute("data-rso-candidate-id"));
  expect(ids()).toEqual(["alpha", "missing", "zulu"]);
  expect(screen.queryAllByLabelText(/^Result /)).toHaveLength(0);
  expect(screen.getByRole("heading", { name: "Unranked players" })).toBeTruthy();
  expect(screen.getByText(/Alphabetical browsing; verified upcoming NHL schedule counts are unavailable/)).toBeTruthy();
  fireEvent.change(screen.getByRole("combobox", { name: "Sort" }), { target: { value: "schedule" } });
  expect(ids()).toEqual(["alpha", "missing", "zulu"]);
  expect(screen.queryAllByLabelText(/^Result /)).toHaveLength(0);
});
it("orders unranked discovery by verified upcoming team games without inventing net gains or availability", () => {
  const props = discoveryFixture();
  const game = (id: number, date: string, homeId: number) => ({ id, gameDate: date, startTimeUTC: `${date}T23:00:00Z`, homeTeam: { id: homeId }, awayTeam: { id: 9 }, gameState: "FUT", season: props.snapshot.context.seasonId, gameType: 2 });
  const calendar = { complete: true, error: null, teams: [], games: [game(1, "2026-10-12", 1), game(2, "2026-10-14", 2), game(3, "2026-10-16", 2)] } as import("./canonicalSchedule").CanonicalSchedule;
  const view = render(<CandidateBrowser {...props} calendar={calendar} />);
  expect(screen.getAllByRole("article").map(article => article.getAttribute("data-rso-candidate-id"))).toEqual(["zulu", "alpha", "missing"]);
  expect(screen.getByText(/Upcoming NHL games first; this is team schedule context/)).toBeTruthy();
  expect(screen.getByText("Upcoming NHL games: 2")).toBeTruthy();
  expect(screen.getByText("Upcoming NHL games: 0")).toBeTruthy();
  expect(screen.queryAllByLabelText(/^Result /)).toHaveLength(0);
  for (const article of screen.getAllByRole("article")) {
    expect(within(article).getAllByText("unavailable")).toHaveLength(2);
    expect(within(article).getByText("unknown")).toBeTruthy();
    expect(within(article).queryByRole("button", { name: "Select compared plan" })).toBeNull();
  }
  fixture.candidates = [{ playerId: "alpha", complete: true, plans: [{ objective: "outcome", steps: [], netAGP: 1, netPoints: -3, dropped: [], displacedPlayerIds: [] }] }];
  view.rerender(<CandidateBrowser {...props} calendar={calendar} />);
  expect(screen.getAllByRole("article").map(article => article.getAttribute("data-rso-candidate-id"))).toEqual(["alpha", "zulu", "missing"]);
  expect(screen.getAllByLabelText(/^Result /)).toHaveLength(1);
  expect(screen.getByText("-3")).toBeTruthy();
  fireEvent.change(screen.getByRole("combobox", { name: "Sort" }), { target: { value: "schedule" } });
  expect(screen.getAllByRole("article").map(article => article.getAttribute("data-rso-candidate-id"))).toEqual(["alpha", "zulu", "missing"]);
  fixture.candidates = undefined;
  view.rerender(<CandidateBrowser {...props} calendar={{ ...calendar, complete: false }} />);
  expect(screen.getAllByRole("article").map(article => article.getAttribute("data-rso-candidate-id"))).toEqual(["alpha", "missing", "zulu"]);
  expect(screen.queryByText("Upcoming NHL games: 2")).toBeNull();
  view.rerender(<CandidateBrowser {...props} calendar={{ ...calendar, games: calendar.games.map(game => ({ ...game, startTimeUTC: undefined })) }} />);
  expect(screen.queryByText("Upcoming NHL games: 2")).toBeNull();
  expect(screen.getAllByRole("article").map(article => article.getAttribute("data-rso-candidate-id"))).toEqual(["alpha", "missing", "zulu"]);
});

it.each([
  ["LIVE", "2026-10-13T21:50:00Z", "2026-10-13T21:00:00Z", 0],
  ["LIVE", "2026-10-13T22:30:00Z", "2026-10-13T21:00:00Z", 0],
  ["CRIT", "2026-10-13T21:50:00Z", "2026-10-13T21:00:00Z", 0],
  ["FUT", "2026-10-13T21:50:00Z", "2026-10-13T21:00:00Z", 0],
  ["FUT", "2026-10-13T22:30:00Z", "2026-10-13T21:00:00Z", 1],
  ["FUT", "2026-10-13T22:30:00Z", "2026-10-13T23:00:00Z", 1],
  ["PRE", "2026-10-13T22:30:00Z", "2026-10-13T21:00:00Z", 1],
] as const)("uses current discovery time for %s at %s independent of saved cutoff %s", (gameState, startTimeUTC, savedCutoff, expected) => {
  const props = discoveryFixture();
  vi.setSystemTime(new Date("2026-10-13T22:00:00Z"));
  props.snapshot.context.asOf = savedCutoff;
  props.players = [props.players[1]];
  const before = JSON.stringify({ snapshot: props.snapshot, intent: props.intent });
  const calendar = { complete: true, error: null, teams: [], games: [{ id: 1, gameDate: "2026-10-13", startTimeUTC,
    homeTeam: { id: 2 }, awayTeam: { id: 9 }, gameState, season: props.snapshot.context.seasonId, gameType: 2 }] } as import("./canonicalSchedule").CanonicalSchedule;
  render(<CandidateBrowser {...props} calendar={calendar} />);
  expect(screen.getByText(`Upcoming NHL games: ${expected}`)).toBeTruthy();
  expect(screen.queryAllByLabelText(/^Result /)).toHaveLength(0);
  expect(JSON.stringify({ snapshot: props.snapshot, intent: props.intent })).toBe(before);
});
it("reclassifies elapsed starts on a later render without replacing saved planning inputs", () => {
  const props = discoveryFixture();
  vi.setSystemTime(new Date("2026-10-13T22:00:00Z"));
  props.snapshot.context.asOf = "2026-10-13T21:00:00Z";
  props.players = [props.players[1]];
  const before = JSON.stringify({ snapshot: props.snapshot, intent: props.intent });
  const calendar = { complete: true, error: null, teams: [], games: [{ id: 1, gameDate: "2026-10-13", startTimeUTC: "2026-10-13T22:30:00Z",
    homeTeam: { id: 2 }, awayTeam: { id: 9 }, gameState: "FUT", season: props.snapshot.context.seasonId, gameType: 2 }] } as import("./canonicalSchedule").CanonicalSchedule;
  const view = render(<CandidateBrowser {...props} calendar={calendar} />);
  expect(screen.getByText("Upcoming NHL games: 1")).toBeTruthy();
  vi.setSystemTime(new Date("2026-10-13T22:30:00Z"));
  view.rerender(<CandidateBrowser {...props} calendar={calendar} />);
  expect(screen.getByText("Upcoming NHL games: 0")).toBeTruthy();
  expect(JSON.stringify({ snapshot: props.snapshot, intent: props.intent })).toBe(before);
});

it("withholds upcoming totals when canonical game state is missing rather than inventing a future game", () => {
  const props = discoveryFixture();
  props.players = [props.players[1]];
  const calendar = { complete: true, error: null, teams: [], games: [{ id: 1, gameDate: "2026-10-14", startTimeUTC: "2026-10-14T23:00:00Z",
    homeTeam: { id: 2 }, awayTeam: { id: 9 }, season: props.snapshot.context.seasonId, gameType: 2 }] } as import("./canonicalSchedule").CanonicalSchedule;
  render(<CandidateBrowser {...props} calendar={calendar} />);
  expect(screen.queryByText(/Upcoming NHL games:/)).toBeNull();
  expect(screen.getByText(/Alphabetical browsing; verified upcoming NHL schedule counts are unavailable/)).toBeTruthy();
  expect(screen.queryAllByLabelText(/^Result /)).toHaveLength(0);
});
