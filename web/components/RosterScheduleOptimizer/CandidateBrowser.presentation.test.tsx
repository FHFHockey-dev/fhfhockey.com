import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import CandidateBrowser from "./CandidateBrowser";
import { defaultWorkspace } from "lib/rosterScheduleOptimizer/workspace";
import type { PlanningPlayer, PlanningSnapshot } from "lib/rosterScheduleOptimizer/planningTypes";
import type { CandidateComparison, CandidateDiagnostic } from "lib/rosterScheduleOptimizer/candidatePlanMetrics";

const fixture = vi.hoisted(() => ({ candidates: undefined as CandidateComparison[] | undefined, diagnostics: undefined as CandidateDiagnostic[] | undefined, goalieBoost: undefined as boolean | undefined }));
vi.mock("hooks/useCandidateMetrics", () => ({ useCandidateMetrics: () => ({ metrics: fixture.candidates ? { candidates: fixture.candidates, diagnostics: fixture.diagnostics, goalieBoost: fixture.goalieBoost } : undefined, loading: false, error: null }) }));
afterEach(() => { cleanup(); fixture.candidates = undefined; fixture.diagnostics = undefined; fixture.goalieBoost = undefined; vi.useRealTimers(); });
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
  fireEvent.click(screen.getByRole("button", { name: /^Show more recommendations/ }));
  expect(screen.getAllByRole("article")).toHaveLength(10);
  fireEvent.click(screen.getByText("Find & filter"));
  fireEvent.change(screen.getByRole("searchbox", { name: "Find candidate" }), { target: { value: "Candidate 11" } });
  expect(screen.getAllByRole("article")).toHaveLength(1);
  fireEvent.change(screen.getByRole("searchbox", { name: "Find candidate" }), { target: { value: "" } });
  expect(screen.getAllByRole("article")).toHaveLength(5);
  view.rerender(<CandidateBrowser {...props} intent={{ ...props.intent, alternativeCount: 10 }} />);
  expect(screen.getAllByRole("article")).toHaveLength(10);
});

it("lists goalie options that add expected starts first only while the goalie minimum may be missed", () => {
  const workspace = defaultWorkspace();
  const players: PlanningPlayer[] = ["skater", "goalie"].map(id => ({ id, nhlId: null, name: id, teamAbbreviation: "CAR",
    eligiblePositions: [id === "goalie" ? "G" : "C"], playerClass: id === "goalie" ? "goalie" : "skater", availability: "free_agent",
    ownership: null, canDrop: true, holdValue: null, reserveEligibility: [] }));
  fixture.candidates = players.map(player => ({ playerId: player.id, complete: true, plans: [{ objective: "outcome", steps: [], netAGP: 1,
    netPoints: player.id === "goalie" ? 1 : 5, netGoalieStarts: player.id === "goalie" ? 0.8 : 0, dropped: [], displacedPlayerIds: [] }] }));
  const props = { players, rosterIds: new Set<string>(), snapshot: null, intent: workspace.intent, fits: [], manual: true,
    select: vi.fn(), add: vi.fn(), markAvailable: vi.fn() };
  const ids = () => screen.getAllByRole("article").map(article => article.getAttribute("data-rso-candidate-id"));
  const view = render(<CandidateBrowser {...props} />);
  expect(ids()).toEqual(["skater", "goalie"]);
  expect(screen.queryByText(/Helps your goalie minimum/)).toBeNull();
  fixture.goalieBoost = true;
  view.rerender(<CandidateBrowser {...props} />);
  expect(ids()).toEqual(["goalie", "skater"]);
  expect(screen.getByText("Helps your goalie minimum: +0.8 starts")).toBeTruthy();
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
  fireEvent.click(screen.getByRole("button", { name: /^Show more recommendations/ }));
  expect(ids()).toEqual(players.slice(0, 10).map(player => player.id));
  for (const article of screen.getAllByRole("article").slice(count)) {
    expect(within(article).getByText("—", { selector: "strong" }).getAttribute("title")).toBe("Not enough projection data yet");
  }
  if (count === 6) {
    expect(screen.getByLabelText("Result 10")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /^Show more recommendations/ }));
    expect(ids()).toEqual(players.map(player => player.id));
  }
  expect(screen.queryByRole("button", { name: /^Show more recommendations/ })).toBeNull();
  view.rerender(<CandidateBrowser {...props} intent={{ ...props.intent, alternativeCount: 10 }} />);
  expect(ids()).toEqual(players.slice(0, 10).map(player => player.id));
  view.rerender(<CandidateBrowser {...props} />);
  expect(ids()).toEqual(players.slice(0, 5).map(player => player.id));

  fireEvent.click(screen.getByRole("button", { name: /^Show more recommendations/ }));
  fireEvent.click(screen.getByText("Find & filter"));
  fireEvent.change(screen.getByRole("combobox", { name: "Team" }), { target: { value: "BOS" } });
  expect(ids()).toEqual(players.slice(count, count + 5).map(player => player.id));
  fireEvent.change(screen.getByRole("combobox", { name: "Team" }), { target: { value: "" } });
  expect(ids()).toEqual(players.slice(0, 5).map(player => player.id));
  fireEvent.click(screen.getByRole("button", { name: /^Show more recommendations/ }));
  fireEvent.change(screen.getByRole("combobox", { name: "Position" }), { target: { value: "RW" } });
  expect(ids()).toEqual(players.slice(count, count + 5).map(player => player.id));
  fireEvent.change(screen.getByRole("combobox", { name: "Position" }), { target: { value: "" } });
  expect(ids()).toEqual(players.slice(0, 5).map(player => player.id));
  fireEvent.click(screen.getByRole("button", { name: /^Show more recommendations/ }));
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
it("shows652knownand197unknownof849 and puts known inputs first without hiding unknown players", () => {
  const props = discoveryFixture(), template = props.players[0];
  const known = Array.from({ length: 652 }, (_, index) => ({ ...template, id: `known-${index}`, name: `Zulu Known ${String(index).padStart(3, "0")}`,
    nhlTeamId: 2, teamAbbreviation: "ZZZ", eligibilityVerified: true, availability: "free_agent" as const }));
  const unknown = Array.from({ length: 197 }, (_, index) => ({ ...template, id: `unknown-${index}`, name: `Alpha Unverified ${String(index).padStart(3, "0")}`,
    nhlTeamId: 1, eligibilityVerified: false }));
  props.players = [...unknown, ...known]; props.snapshot.players = props.players;
  props.intent = { ...props.intent, alternativeCount: 5 };
  const game = (id: number, day: string, teamId: number) => ({ id, gameDate: day, startTimeUTC: `${day}T23:00:00Z`, homeTeam: { id: teamId }, awayTeam: { id: 9 }, gameState: "FUT", season: 20262027, gameType: 2 });
  const calendar = { complete: true, error: null, teams: [], games: [game(1, "2026-10-14", 1), game(2, "2026-10-15", 1), game(3, "2026-10-16", 2)] } as import("./canonicalSchedule").CanonicalSchedule;
  const before = JSON.stringify({ snapshot: props.snapshot, intent: props.intent });
  render(<CandidateBrowser {...props} calendar={calendar} />);
  expect(screen.getByText("197 players are missing league positions or availability, so they can't be ranked.")).toBeTruthy();
  expect(screen.getAllByRole("article").map(row => row.getAttribute("data-rso-candidate-id"))).toEqual(known.slice(0, 5).map(row => row.id));
  fireEvent.click(screen.getByRole("button", { name: "By Team" }));
  expect(screen.getAllByText(/^(AAA|ZZZ) · \d+ players$/).map(row => row.textContent)).toEqual(["ZZZ · 652 players", "AAA · 197 players"]);
  fireEvent.click(screen.getByRole("button", { name: "All players" }));
  fireEvent.click(screen.getByText("Find & filter"));
  fireEvent.change(screen.getByRole("searchbox", { name: "Find candidate" }), { target: { value: "Alpha Unverified" } });
  expect(screen.getAllByRole("article").map(row => row.getAttribute("data-rso-candidate-id"))).toEqual(unknown.slice(0, 5).map(row => row.id));
  fireEvent.click(screen.getByRole("button", { name: /^Show more recommendations/ }));
  expect(screen.getAllByRole("article")).toHaveLength(10);
  expect(JSON.stringify({ snapshot: props.snapshot, intent: props.intent })).toBe(before);
});
it("separates known, partly known and unusable input facts without granting waiver or plan readiness", () => {
  const props = discoveryFixture(), template = props.players[0];
  props.players = [
    { ...template, id: "free", name: "Free Agent", eligibilityVerified: true, availability: "free_agent" },
    { ...template, id: "manager", name: "Manager Confirmed", eligibilityVerified: true, availability: "manager_available" },
    { ...template, id: "waiver", name: "Waiver Player", eligibilityVerified: true, availability: "waivers", waiverClearsAt: null },
    { ...template, id: "eligibility", name: "Positions Only", eligibilityVerified: true },
    { ...template, id: "availability", name: "Class Mismatch", eligibilityVerified: true, eligiblePositions: ["G"], availability: "free_agent" },
    { ...template, id: "neither", name: "Neither Known", eligibilityVerified: false },
  ];
  props.snapshot.players = props.players;
  const before = JSON.stringify({ snapshot: props.snapshot, intent: props.intent });
  render(<CandidateBrowser {...props} />);
  expect(screen.getByText("3 players are missing league positions or availability, so they can't be ranked.")).toBeTruthy();
  expect(screen.queryAllByLabelText(/^Result /)).toHaveLength(0);
  expect(JSON.stringify({ snapshot: props.snapshot, intent: props.intent })).toBe(before);
});
it("leaves unavailable comparisons unranked and names alphabetical browsing for either selected net sort", () => {
  const props = discoveryFixture();
  props.snapshot.rules.unsupported = ["Retained roster inputs are unverified; this is provisional schedule analysis."];
  const before = JSON.stringify({ snapshot: props.snapshot, intent: props.intent });
  render(<CandidateBrowser {...props} />);
  const ids = () => screen.getAllByRole("article").map(article => article.getAttribute("data-rso-candidate-id"));
  expect(ids()).toEqual(["alpha", "missing", "zulu"]);
  expect(screen.queryAllByLabelText(/^Result /)).toHaveLength(0);
  expect(screen.getByRole("status").textContent).toBe("Rankings appear once projections and schedules load.");
  const why = screen.getByText("Why some players aren't ranked").closest("details") as HTMLDetailsElement;
  expect(why.open).toBe(false);
  const missing = within(screen.getByRole("list", { name: "Why some players aren't ranked" }));
  expect(missing.getByText("This week's NHL schedule isn't fully loaded yet.")).toBeTruthy();
  expect(missing.getByText(/League scoring settings are missing/)).toBeTruthy();
  expect(missing.getByText("Your league's add rules (timing or moves left) aren't set yet.")).toBeTruthy();
  expect(missing.getByText("3 players are missing league positions or availability, so they can't be ranked.")).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "By more starts" }));
  expect(ids()).toEqual(["alpha", "missing", "zulu"]);
  expect(screen.queryAllByLabelText(/^Result /)).toHaveLength(0);
  expect(JSON.stringify({ snapshot: props.snapshot, intent: props.intent })).toBe(before);
});
it.each(["points", "schedule"])("labels evaluated fit results and preserves %s ordering ahead of discovery names", mode => {
  const props = discoveryFixture();
  fixture.candidates = props.players.slice(0, 2).map((player, index) => ({ playerId: player.id, complete: true,
    plans: [{ objective: "outcome", steps: [], netAGP: index ? 3 : 1, netPoints: mode === "points" ? index ? 8 : 2 : null, dropped: [], displacedPlayerIds: [] }] }));
  render(<CandidateBrowser {...props} />);
  expect(screen.queryByText("Rankings appear once projections and schedules load.")).toBeNull();
  expect(screen.getAllByRole("article").map(article => article.getAttribute("data-rso-candidate-id"))).toEqual(["zulu", "alpha", "missing"]);
  expect(screen.queryAllByLabelText(/^Result /)).toHaveLength(2);
});
it("connects actual candidate states while distinguishing display-only players from the worker snapshot", () => {
  const props = discoveryFixture();
  props.snapshot.players = props.players.filter(player => player.id !== "missing");
  fixture.candidates = [];
  fixture.diagnostics = props.snapshot.players.map((player, index) => ({ playerId: player.id,
    status: index ? "not_selected" : "filtered", stopReason: index ? "candidate_limit" : "filtered",
    generated: 0, skipped: 0, evaluated: 0, illegal: 0, unverifiedBudget: 0, retained: 0,
    reasons: [index ? "Outside the bounded candidate evaluation set." : "League availability is not verified for acquisition."] }));
  const before = JSON.stringify({ snapshot: props.snapshot, intent: props.intent });
  render(<CandidateBrowser {...props} />);
  const cards = new Map(screen.getAllByRole("article").map(article => [article.getAttribute("data-rso-candidate-id"), within(article)]));
  expect(cards.get("alpha")!.queryByRole("button", { name: "Compare this player" })).toBeNull();
  expect(cards.get("zulu")!.getByRole("button", { name: "Compare this player" })).toBeTruthy();
  expect(cards.get("missing")!.queryByRole("button", { name: "Compare this player" })).toBeNull();
  expect(screen.getByText(/1 player wasn't compared automatically/)).toBeTruthy();
  expect(screen.queryAllByLabelText(/^Result /)).toHaveLength(0);
  expect(JSON.stringify({ snapshot: props.snapshot, intent: props.intent })).toBe(before);
});
it("shares command-bar search with candidate filtering and resets the display budget without changing intent", () => {
  const fixtureProps = discoveryFixture();
  const players = Array.from({ length: 12 }, (_, index) => ({ ...fixtureProps.players[0], id: String(index), name: `Candidate ${index}` }));
  const props = { ...fixtureProps, players, intent: { ...fixtureProps.intent, alternativeCount: 5 as const } };
  const originalIntent = JSON.stringify(props.intent);
  const changeSearch = vi.fn();
  const view = render(<CandidateBrowser {...props} searchQuery="" changeSearch={changeSearch} />);
  fireEvent.click(screen.getByRole("button", { name: /^Show more recommendations/ }));
  expect(screen.getAllByRole("article")).toHaveLength(10);
  view.rerender(<CandidateBrowser {...props} searchQuery="Candidate 11" changeSearch={changeSearch} />);
  expect(screen.getAllByRole("article")).toHaveLength(1);
  fireEvent.click(screen.getByText("Find & filter"));
  expect((screen.getByRole("searchbox", { name: "Find candidate" }) as HTMLInputElement).value).toBe("Candidate 11");
  fireEvent.change(screen.getByRole("searchbox", { name: "Find candidate" }), { target: { value: "Candidate 10" } });
  expect(changeSearch).toHaveBeenLastCalledWith("Candidate 10");
  view.rerender(<CandidateBrowser {...props} searchQuery="" changeSearch={changeSearch} />);
  expect(screen.getAllByRole("article")).toHaveLength(5);
  expect(JSON.stringify(props.intent)).toBe(originalIntent);
});
it("orders unranked discovery by verified upcoming team games without inventing net gains or availability", () => {
  const props = discoveryFixture();
  const game = (id: number, date: string, homeId: number) => ({ id, gameDate: date, startTimeUTC: `${date}T23:00:00Z`, homeTeam: { id: homeId }, awayTeam: { id: 9 }, gameState: "FUT", season: props.snapshot.context.seasonId, gameType: 2 });
  const calendar = { complete: true, error: null, teams: [], games: [game(1, "2026-10-12", 1), game(2, "2026-10-14", 2), game(3, "2026-10-16", 2)] } as import("./canonicalSchedule").CanonicalSchedule;
  const view = render(<CandidateBrowser {...props} calendar={calendar} />);
  expect(screen.getAllByRole("article").map(article => article.getAttribute("data-rso-candidate-id"))).toEqual(["zulu", "alpha", "missing"]);
  expect(screen.getByText("2 upcoming games")).toBeTruthy();
  expect(screen.getByText("0 upcoming games")).toBeTruthy();
  expect(screen.queryAllByLabelText(/^Result /)).toHaveLength(0);
  for (const article of screen.getAllByRole("article")) {
    expect(within(article).queryByLabelText("Net plan comparison")).toBeNull();
    expect(within(article).queryByRole("button", { name: /^Preview swap/ })).toBeNull();
  }
  fixture.candidates = [{ playerId: "alpha", complete: true, plans: [{ objective: "outcome", steps: [], netAGP: 1, netPoints: -3, dropped: [], displacedPlayerIds: [] }] }];
  view.rerender(<CandidateBrowser {...props} calendar={calendar} />);
  expect(screen.getAllByRole("article").map(article => article.getAttribute("data-rso-candidate-id"))).toEqual(["alpha", "zulu", "missing"]);
  expect(screen.getAllByLabelText(/^Result /)).toHaveLength(1);
  expect(screen.getByText("-3")).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "By more starts" }));
  expect(screen.getAllByRole("article").map(article => article.getAttribute("data-rso-candidate-id"))).toEqual(["alpha", "zulu", "missing"]);
  fixture.candidates = undefined;
  view.rerender(<CandidateBrowser {...props} calendar={{ ...calendar, complete: false }} />);
  expect(screen.getAllByRole("article").map(article => article.getAttribute("data-rso-candidate-id"))).toEqual(["alpha", "missing", "zulu"]);
  expect(screen.queryByText("2 upcoming games")).toBeNull();
  view.rerender(<CandidateBrowser {...props} calendar={{ ...calendar, games: calendar.games.map(game => ({ ...game, startTimeUTC: undefined })) }} />);
  expect(screen.queryByText("2 upcoming games")).toBeNull();
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
  expect(screen.getByText(`${expected} upcoming game${expected === 1 ? "" : "s"}`)).toBeTruthy();
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
  expect(screen.getByText("1 upcoming game")).toBeTruthy();
  vi.setSystemTime(new Date("2026-10-13T22:30:00Z"));
  view.rerender(<CandidateBrowser {...props} calendar={calendar} />);
  expect(screen.getByText("0 upcoming games")).toBeTruthy();
  expect(JSON.stringify({ snapshot: props.snapshot, intent: props.intent })).toBe(before);
});

it("withholds upcoming totals when canonical game state is missing rather than inventing a future game", () => {
  const props = discoveryFixture();
  props.players = [props.players[1]];
  const calendar = { complete: true, error: null, teams: [], games: [{ id: 1, gameDate: "2026-10-14", startTimeUTC: "2026-10-14T23:00:00Z",
    homeTeam: { id: 2 }, awayTeam: { id: 9 }, season: props.snapshot.context.seasonId, gameType: 2 }] } as import("./canonicalSchedule").CanonicalSchedule;
  render(<CandidateBrowser {...props} calendar={calendar} />);
  expect(screen.queryByText(/upcoming game/)).toBeNull();
  expect(screen.queryAllByLabelText(/^Result /)).toHaveLength(0);
});

it("tells category managers that each card carries the whole swap's category gains and losses (W7)", () => {
  const workspace = defaultWorkspace();
  const players: PlanningPlayer[] = [{ id: "c", nhlId: null, name: "Category Candidate", teamAbbreviation: "CAR", eligiblePositions: ["C"],
    playerClass: "skater", availability: "free_agent", ownership: null, canDrop: true, holdValue: null, reserveEligibility: [] }];
  const snapshot: PlanningSnapshot = { id: "categories", context: workspace.context, games: [], players, roster: [], lockedAssignments: [], forecasts: [],
    rules: { ...workspace.rules, scoring: { mode: "categories", weights: {}, categories: [{ key: "GOALS", direction: "higher" }] } },
    realized: {}, opponent: null, evidence: {} };
  render(<CandidateBrowser players={players} rosterIds={new Set()} snapshot={snapshot} intent={workspace.intent} fits={[]} manual
    select={vi.fn()} add={vi.fn()} markAvailable={vi.fn()} />);
  expect(screen.getByText("Ranked by more starts. Each card shows the category gains and losses for the whole swap.")).toBeTruthy();
});
