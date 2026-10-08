import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { BenchDecision, GameForecast, PlanIntent, PlanningData, PlanningResult, PlanningSnapshot } from "lib/rosterScheduleOptimizer/planningTypes";
import { WORKSPACE_KEY, defaultWorkspace } from "lib/rosterScheduleOptimizer/workspace";
import { planRoster } from "lib/rosterScheduleOptimizer/planning";
import { resolveContribution } from "lib/player-forecasts/contributions";
import { forecastFromContributions } from "lib/player-forecasts/resolvedPlanningForecast";

const { authState, planningState } = vi.hoisted(() => ({ authState: { user: null as { id: string } | null, teams: [] as unknown[] }, planningState: { evaluate: null as null | ((snapshot: PlanningSnapshot, intent: PlanIntent) => PlanningResult) } }));
vi.mock("contexts/AuthProviderContext", () => ({ useAuth: () => authState }));
vi.mock("lib/supabase/client", () => ({ default: { auth: { getSession: async () => ({ data: { session: authState.user ? { access_token: `token-${authState.user.id}` } : null } }) }, from: () => ({ select: () => ({ eq: async () => ({ data: authState.teams }) }) }) } }));
vi.mock("hooks/useRosterPlanning", () => ({ useRosterPlanning: (snapshot: PlanningSnapshot | null, intent: PlanIntent) => ({ result: snapshot && planningState.evaluate ? planningState.evaluate(snapshot, intent) : null, loading: false, error: null }) }));
import RosterScheduleOptimizer, { GoalieEvidence, grossAcquisitionGames, requestErrorMessage, acquisitionDetail } from "components/RosterScheduleOptimizer/RosterScheduleOptimizer";
import ForecastEvidence, { forecastSummary } from "components/RosterScheduleOptimizer/ForecastEvidence";
import BenchDecisions from "components/RosterScheduleOptimizer/BenchDecisions";
import CandidateBrowser, { compareCandidateFits } from "components/RosterScheduleOptimizer/CandidateBrowser";

const player = { id: "fhfh:1", nhlId: 1, name: "Alpha Center", teamAbbreviation: "CAR", eligiblePositions: ["C"], playerClass: "skater" as const, availability: "unknown" as const, ownership: null, canDrop: null, holdValue: null, reserveEligibility: [] };
const data: PlanningData = { players: [player], games: [], forecasts: [], evidence: {} };
const fetchMock = vi.fn((url: string) => Promise.resolve({ ok: url.includes("/data?"), json: async () => ({ success: true, data }) }));
const benchReceipt: NonNullable<BenchDecision["evidence"]> = { startDate: "2026-10-05", endDate: "2026-10-06",
  lineupMode: "weekly", scoreBasis: "points_assignment", selectedScore: 27, withPlayerScore: 26, manifestId: "private-manifest-id",
  slotChanges: [{ date: "2026-10-05", slotId: "RW#1", selectedPlayerId: "knies", withPlayerId: "batherson" },
    { date: "2026-10-05", slotId: "UTIL#1", selectedPlayerId: "center", withPlayerId: "kaprizov" }], categories: [],
  sources: [{ playerId: "batherson", kinds: ["blended"], revisionIds: ["private-revision-id"],
    participation: [{ gameId: "game", basis: "appearance", probability: 0.5, confirmed: false }] }] };
afterEach(() => { cleanup(); window.localStorage.clear(); vi.useRealTimers(); vi.unstubAllGlobals(); fetchMock.mockClear(); authState.user = null; authState.teams = []; planningState.evaluate = null; });

describe("RosterScheduleOptimizer workspace", () => {
  it("shows upstream stale and disabled evidence in manual readiness independently of reader time", async () => {
    vi.stubGlobal("fetch", vi.fn((url: string) => Promise.resolve({ ok: url.includes("/data?"),
      json: async () => ({ success: true, data: { ...data, evidence: {
        schedule: { source: "schedule-cache", asOf: "2026-10-01T11:28:34Z", seasonId: 20262027,
          completeness: "partial", limitations: ["Schedule coverage may be stale or incomplete. Reloading does not update the upstream cache."] },
        forecasts: { source: "published", asOf: null, seasonId: 20262027, completeness: "partial",
          limitations: ["Shared game-forecast serving is not enabled; schedule planning remains available."] },
      } } }) })));
    render(<RosterScheduleOptimizer />);
    const summary = (await screen.findByText("Shared schedule: partial")).closest("summary")!;
    expect(summary.textContent).toContain("Oct 1");
    expect(summary.textContent).toContain("stale or incomplete");
    expect(summary.textContent).toContain("serving is not enabled");
    expect(summary.closest("details")!.open).toBe(false);
    expect(screen.getByText(/Reader checked/)).toBeTruthy();
    const setup = screen.getByRole("button", { name: /Planning setup/ });
    expect(setup.getAttribute("aria-expanded")).toBe("false");
    fireEvent.click(setup);
    expect(setup.getAttribute("aria-expanded")).toBe("true");
    expect(document.getElementById(setup.getAttribute("aria-controls")!)).toBeTruthy();
  });
  it("shows confirmed Yahoo zero usage independently from unknown allowance and planned adds", () => {
    const evidence: NonNullable<PlanningSnapshot["acquisitionEvidence"]> = {
      source: "Yahoo team roster_adds", fetchedAt: "2026-10-01T12:00:00Z", asOf: "2026-10-01T12:00:00Z",
      counter: { present: true, coverageType: "week", coverageWeek: 1, reportedValue: "0", used: 0 },
      limit: { present: false, reportedValue: null, verified: false },
      period: { week: 1, startDate: "2026-09-29", endDate: "2026-10-04", containsHorizon: true }, remaining: null, limitations: [],
    };
    expect(acquisitionDetail(defaultWorkspace().rules, evidence)).toBe("Allowance unknown · Week 1: 0 used (Yahoo)");
    expect(acquisitionDetail(defaultWorkspace().rules, { ...evidence, counter: { ...evidence.counter, used: null } })).toBe("Allowance unknown");
    expect(acquisitionDetail(defaultWorkspace().rules, { ...evidence, period: { ...evidence.period, containsHorizon: false } })).toBe("Allowance unknown");
  });
  it("distinguishes projected fit from schedule-first order for unequal games and quality", () => {
    const low = { player: { ...player, id: "low", name: "Four low-value games" }, activeGames: 2, points: 4, activePoints: 2 };
    const high = { player: { ...player, id: "high", name: "Three high-value games" }, activeGames: 1, points: 30, activePoints: 26 };
    expect([low, high].sort((a, b) => compareCandidateFits(a, b, "points")).map(row => row.player.id)).toEqual(["high", "low"]);
    expect([low, high].sort((a, b) => compareCandidateFits(a, b, "schedule")).map(row => row.player.id)).toEqual(["low", "high"]);
  });
  it.each([{ remaining: 0, source: "manager" as const, detail: "Week: 0 remaining (manager)" },
    { remaining: null, source: "provider" as const, detail: "Week: Allowance unknown" },
    { remaining: 0, source: "unknown" as const, detail: "Week: Allowance unknown" }])("separates planned adds from allowance $detail", async ({ remaining, source, detail }) => {
    const workspace = defaultWorkspace();
    workspace.rules.periods = [{ id: "Week", start: workspace.context.asOf, end: `${workspace.context.endDate}T23:59:59Z`, remaining, source }];
    workspace.intent.steps = [{ id: "add", type: "add", playerId: player.id, at: workspace.context.asOf, effectiveAt: workspace.context.asOf, conditional: true, dependsOn: [] }];
    window.localStorage.setItem(WORKSPACE_KEY, JSON.stringify(workspace));
    vi.stubGlobal("fetch", fetchMock);
    render(<RosterScheduleOptimizer />);
    const metric = screen.getByText("Planned adds").closest("article")!;
    await waitFor(() => expect(within(metric).getByText("1")).toBeTruthy());
    expect(within(metric).getByText(detail)).toBeTruthy();
    expect(metric.textContent).not.toContain("Unlimited");
    expect(screen.queryByText("Selected moves are a plan. Confirm roster changes with your provider.")).toBeNull();
  });
  it("renders verified zero AGP separately from unavailable metrics", () => {
    let worker: { onmessage?: (event: { data: unknown }) => void };
    vi.stubGlobal("Worker", class {
      onmessage?: (event: { data: unknown }) => void;
      constructor() { worker = this; }
      postMessage() {}
      terminate() {}
    });
    render(<CandidateBrowser players={[player]} rosterIds={new Set()} snapshot={{ id: "zero" } as PlanningSnapshot}
      intent={defaultWorkspace().intent} fits={[]} manual select={vi.fn()} add={vi.fn()} markAvailable={vi.fn()} />);
    expect(screen.getByText(/Calculating candidate metrics/)).toBeTruthy();
    act(() => worker.onmessage?.({ data: { metrics: { points: [[player.id, 20]], activePoints: [[player.id, 16]], activeGames: [[player.id, 0]] } } }));
    fireEvent.click(screen.getByRole("button", { name: "All players" }));
    expect(screen.getByText("+AGP 0 · Horizon points 20")).toBeTruthy();
    expect(screen.getByText("Potential active points gain 16")).toBeTruthy();
    expect(screen.queryByText(/Calculating candidate metrics/)).toBeNull();
  });

  it("uses schedule ordering and category-plan guidance instead of points claims in category leagues", () => {
    vi.stubGlobal("Worker", undefined);
    const candidate = { ...player, availability: "manager_available" as const };
    render(<CandidateBrowser players={[candidate]} rosterIds={new Set()} snapshot={{ id: "categories",
      rules: { scoring: { mode: "categories" } } } as PlanningSnapshot}
      intent={defaultWorkspace().intent} fits={[]} manual select={vi.fn()} add={vi.fn()} markAvailable={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: "All players" }));
    expect(screen.getByText("Schedule first")).toBeTruthy();
    expect(screen.getByText(/Review category gains on the selected plan/)).toBeTruthy();
    expect(screen.queryByText(/Horizon points|Potential active points gain|points unavailable/)).toBeNull();
    expect(screen.queryByRole("combobox", { name: "Sort" })).toBeNull();
    expect(screen.getByText("+AGP unavailable")).toBeTruthy();
  });
  it("groups candidates by team without changing eligibility, filters and deduplicates All players", () => {
    const alpha = { ...player, eligibilityVerified: true };
    const bravo = { ...alpha, id: "bravo", name: "Bravo Center", eligiblePositions: ["C", "Util"], availability: "free_agent" as const };
    const delta = { ...alpha, id: "delta", name: "Delta Defender", teamAbbreviation: "NJD", eligiblePositions: ["D"] };
    const select = vi.fn(), add = vi.fn(), markAvailable = vi.fn();
    render(<CandidateBrowser players={[alpha, bravo, bravo, delta]} rosterIds={new Set()} snapshot={null} intent={defaultWorkspace().intent}
      fits={[{ teamAbbreviation: "CAR", positions: ["C"], playerIds: [alpha.id], addedGames: 2, dates: [] },
        { teamAbbreviation: "CAR", positions: ["C", "Util"], playerIds: [bravo.id], addedGames: 1, dates: [] }]}
      manual select={select} add={add} markAvailable={markAvailable} />);
    expect(screen.getAllByText("CAR · 2 players")).toHaveLength(1);
    fireEvent.click(screen.getByText("CAR · 2 players"));
    expect(screen.getByText("CAR · C/Util")).toBeTruthy();
    expect(within(screen.getByRole("button", { name: /Alpha Center/ }).parentElement!).queryByRole("button", { name: "Select add" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "All players" }));
    expect(screen.getAllByRole("button", { name: /Bravo Center/ })).toHaveLength(1);
    fireEvent.change(screen.getByRole("combobox", { name: "Position" }), { target: { value: "UTIL" } });
    expect(screen.queryByRole("button", { name: /Alpha Center/ })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: /Bravo Center/ }));
    expect(select).toHaveBeenCalledWith("bravo");
    fireEvent.click(screen.getByRole("button", { name: "Select add" }));
    expect(add).toHaveBeenCalledWith(bravo);
    fireEvent.change(screen.getByRole("combobox", { name: "Team" }), { target: { value: "NJD" } });
    expect(screen.getByText("No candidates match these filters.")).toBeTruthy();
    expect(alpha.eligiblePositions).toEqual(["C"]);
    expect(alpha.availability).toBe("unknown");
  });
  it("preserves API warnings without converting structured errors to object text", () => {
    expect(requestErrorMessage({ code: "authentication_required", message: "Authentication required." }, "Request failed.")).toBe("Authentication required.");
    expect(requestErrorMessage("Provider unavailable.", "Request failed.")).toBe("Provider unavailable.");
    for (const error of [null, undefined, {}, { message: {} }, { message: " " }, ""]) {
      expect(requestErrorMessage(error, "Provider refresh failed.")).toBe("Provider refresh failed.");
    }
  });
  it("renders the structured planning-data failure as its actual warning", async () => {
    vi.stubGlobal("fetch", vi.fn(() => Promise.resolve({ ok: false,
      json: async () => ({ success: false, error: { code: "planning_unavailable", message: "Schedule evidence could not be loaded." } }) })));
    render(<RosterScheduleOptimizer />);
    expect(await screen.findByText("Schedule evidence could not be loaded.")).toBeTruthy();
    expect(document.body.textContent).not.toContain("[object Object]");
  });
  it("shows the actual bench tradeoff and public assumptions within the selected date", () => {
    const names: Record<string, string> = { batherson: "Drake Batherson", knies: "Matthew Knies", kaprizov: "Kirill Kaprizov", center: "Center" };
    const row: BenchDecision = { date: "2026-10-05", gameId: "game", playerId: "batherson", reason: "lower_lineup_value",
      value: 7, competingPlayerIds: ["knies"], evidence: benchReceipt };
    const other = { ...row, date: "2026-10-06", playerId: "center", evidence: { ...benchReceipt, selectedScore: 777 } };
    const props = { decisions: JSON.parse(JSON.stringify([row, other])), nameOf: (id: string) => names[id], date: "2026-10-05" };
    const view = render(<BenchDecisions {...props} />);
    expect(screen.getByText(/Weekly placement window: Oct 5–Oct 6/)).toBeTruthy();
    expect(screen.getByText(/Complete-plan start\/sit score: selected 27; with Drake Batherson 26/)).toBeTruthy();
    expect(screen.getByText(/RW#1: Matthew Knies → Drake Batherson/)).toBeTruthy();
    expect(screen.getByText(/UTIL#1: Center → Kirill Kaprizov/)).toBeTruthy();
    expect(screen.getByText(/Drake Batherson · blended detailed\/baseline estimate/)).toBeTruthy();
    expect(screen.getByText(/Appearance assumption: 50%/)).toBeTruthy();
    expect(screen.getByText(/not an approved projected total or acquisition comparison/)).toBeTruthy();
    expect(screen.queryByLabelText("Center bench decision")).toBeNull();
    expect(document.body.textContent).not.toContain("private-");
    view.rerender(<BenchDecisions {...props} date="2026-10-06" />);
    expect(screen.getByText(/selected 777/)).toBeTruthy();
    expect(screen.queryByLabelText("Drake Batherson bench decision")).toBeNull();
  });
  it("keeps unsupported bench decisions unresolved and separates locks from scoring reasons", () => {
    const row: BenchDecision = { date: "2026-10-05", gameId: "game", playerId: "one", reason: "lower_lineup_value",
      value: 999, competingPlayerIds: ["two"] };
    const props = { decisions: [row], nameOf: (id: string) => id };
    const view = render(<BenchDecisions {...props} />);
    expect(screen.getByText(/Start\/sit unresolved: scoring explanation unavailable/)).toBeTruthy();
    expect(document.body.textContent).not.toContain("999");
    for (const [reason, text] of [["unresolved_quality", /comparable forecast evidence is missing/],
      ["locked_bench", /Preserved bench lock/], ["locked_capacity", /Eligible active slots are locked/],
      ["explanation_incomplete", /placement checking reached its work or time limit/]] as const) {
      view.rerender(<BenchDecisions {...props} decisions={[{ ...row, reason }]} />);
      expect(screen.getByText(text)).toBeTruthy();
      expect(screen.queryByText(/Complete-plan start\/sit score/)).toBeNull();
    }
    view.rerender(<BenchDecisions {...props} decisions={[{ ...row, reason: "equal_lineup_value", evidence: { ...benchReceipt, withPlayerScore: 27 } }]} />);
    expect(screen.getByText(/does not resolve the tie/)).toBeTruthy();
    view.rerender(<BenchDecisions {...props} decisions={[{ ...row, reason: "negative_value", evidence: { ...benchReceipt, selectedScore: 0, withPlayerScore: -10 } }]} />);
    expect(screen.getByText(/avoids a negative scoring contribution/)).toBeTruthy();
  });
  it("shows category results and projected goalie assumptions without claiming a satisfied minimum", () => {
    const row: BenchDecision = { date: "2026-10-05", gameId: "game", playerId: "goalie", reason: "category_tradeoff",
      value: 10, competingPlayerIds: [], evidence: { ...benchReceipt, scoreBasis: "category_outcomes", selectedScore: 2, withPlayerScore: 0,
        categories: [{ key: "SV%", selected: 0.9, withPlayer: 0.85, opponent: 0.8, selectedResult: "win", withPlayerResult: "win" },
          { key: "GA", selected: 0, withPlayer: 2, opponent: 1, selectedResult: "win", withPlayerResult: "loss" }],
        sources: [{ playerId: "goalie", kinds: ["baseline"], revisionIds: ["opaque"],
          participation: [{ gameId: "game", basis: "start", probability: 0.4, confirmed: false }] }] } };
    const props = { decisions: [row], nameOf: () => "Goalie" };
    const view = render(<BenchDecisions {...props} />);
    expect(screen.getByText(/Complete-plan category score: selected 2; with Goalie 0/)).toBeTruthy();
    expect(screen.getByText(/SV%: 0.9 \(win\) → 0.85 \(win\)/)).toBeTruthy();
    expect(screen.getByText(/GA: 0 \(win\) → 2 \(loss\)/)).toBeTruthy();
    expect(screen.getByText(/Start assumption: 40% · projected, not confirmed/)).toBeTruthy();
    view.rerender(<BenchDecisions {...props} decisions={[{ ...row, reason: "minimum_priority" }]} />);
    expect(screen.getByText(/Expected starts do not satisfy a minimum/)).toBeTruthy();
    view.rerender(<BenchDecisions {...props} decisions={[{ ...row, reason: "decision_unresolved", evidence: {
      ...row.evidence!, goalie: { counts: "starts", credited: 0, required: 1, selectedProjected: 0.4, withPlayerProjected: 1 },
    } }]} />);
    expect(screen.getByText(/Recorded goalie minimum: 0 credited \/ 1 required starts/)).toBeTruthy();
    expect(screen.getByText(/Projected progress including credited results: selected 0.4; with Goalie 1/)).toBeTruthy();
    expect(screen.getByText(/Expected starts or appearances do not establish a satisfied minimum/)).toBeTruthy();
  });
  it("guides an empty manual workspace to existing inputs without implying acquisition readiness", async () => {
    const workspace = defaultWorkspace();
    const games: PlanningData["games"] = [{ id: "empty-roster-game", date: workspace.context.startDate,
      startsAt: `${workspace.context.startDate}T23:00:00Z`, teamAbbreviation: "CAR", opponent: "NYR", home: true, status: "scheduled" }];
    planningState.evaluate = (snapshot, intent) => planRoster(snapshot, intent, { maxSteps: 0 });
    vi.stubGlobal("fetch", vi.fn((url: string) => Promise.resolve({ ok: url.includes("/data?"),
      json: async () => ({ success: true, data: { ...data, games } }) })));
    render(<RosterScheduleOptimizer />);
    await screen.findByRole("searchbox", { name: "Find a player" });
    screen.getByRole("searchbox", { name: "Find a player" }).scrollIntoView = vi.fn();
    screen.getByText("League rules and scoring").scrollIntoView = vi.fn();
    fireEvent.click(screen.getByText("Planning readiness"));
    expect(screen.getByText(/Add your players to begin schedule analysis/)).toBeTruthy();
    expect(screen.getByText(/Acquisition legality, budget or scoring is unresolved/)).toBeTruthy();
    await screen.findByText(/Add roster players to assess player-quality coverage/);
    expect(screen.queryByText(/Player-quality assignment evidence available/)).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Review roster" }));
    await waitFor(() => expect(document.activeElement).toBe(screen.getByRole("searchbox", { name: "Find a player" })));
    fireEvent.click(screen.getByRole("button", { name: "Review rules" }));
    await waitFor(() => expect(document.activeElement?.textContent).toBe("League rules and scoring"));
    expect(document.activeElement?.closest("details")?.open).toBe(true);
    expect(screen.getByText(/Daily mode and roster slots are proposed defaults/)).toBeTruthy();
  });
  it("requires input review and renews it after rule changes without certifying unknown scoring", async () => {
    const workspace = defaultWorkspace();
    const tomorrow = new Date(Date.now() + 86_400_000).toISOString();
    const members = [player, { ...player, id: "fhfh:2", nhlId: 2, name: "Bravo Center", availability: "manager_available" as const }];
    workspace.manualPlayers = members;
    workspace.roster = [{ playerId: player.id, position: "active" }];
    workspace.rules = { ...workspace.rules, rosterSlots: { C: 1, BN: 1 }, acquisitionTiming: "same_day", acquisitionCost: 1,
      periods: [{ id: "Week", start: `${workspace.context.startDate}T00:00:00Z`, end: `${workspace.context.endDate}T23:59:59Z`, remaining: 2, source: "manager" }],
      scoring: { mode: "points", weights: { GOALS: 1 }, categories: [] } };
    workspace.intent.steps = [{ id: "add", type: "add", playerId: members[1].id, at: tomorrow,
      effectiveAt: tomorrow, conditional: true, dependsOn: [] }];
    window.localStorage.setItem(WORKSPACE_KEY, JSON.stringify(workspace));
    planningState.evaluate = (snapshot, intent) => {
      const result = planRoster(snapshot, intent, { maxSteps: 0 });
      // Exercise proposal presentation with an evaluated plan, independently of candidate search.
      return { ...result, alternatives: [result.selected] };
    };
    vi.stubGlobal("fetch", fetchMock);
    render(<RosterScheduleOptimizer />);
    fireEvent.click(await screen.findByText("League rules and scoring"));
    const confirm = await screen.findByRole("button", { name: "Confirm planning inputs" });
    await waitFor(() => expect(confirm.hasAttribute("disabled")).toBe(false));
    expect(screen.queryByText(/Selected plan passes the current rule checks/)).toBeNull();
    const select = screen.getByRole("button", { name: "Select plan" });
    expect(select.hasAttribute("disabled")).toBe(true);
    expect(screen.queryByText(/Rule checks passed/)).toBeNull();
    fireEvent.click(confirm);
    expect(screen.getByText(/Selected plan passes the current rule checks/)).toBeTruthy();
    expect(select.hasAttribute("disabled")).toBe(false);
    expect(screen.getByText(/Rule checks passed/)).toBeTruthy();
    fireEvent.change(screen.getByLabelText("Weight"), { target: { value: "2" } });
    expect(screen.queryByText(/Selected plan passes the current rule checks/)).toBeNull();
    expect(select.hasAttribute("disabled")).toBe(true);
    expect(screen.getByText(/Review and confirm the current planning inputs/)).toBeTruthy();
    fireEvent.click(confirm);
    expect(screen.getByText(/Selected plan passes the current rule checks/)).toBeTruthy();
    fireEvent.change(screen.getByRole("combobox", { name: "Alpha Center roster position" }), { target: { value: "bench" } });
    expect(screen.queryByText(/Selected plan passes the current rule checks/)).toBeNull();
    expect(select.hasAttribute("disabled")).toBe(true);
    fireEvent.click(confirm);
    fireEvent.click(screen.getByRole("button", { name: "Remove GOALS weight", hidden: true }));
    fireEvent.click(confirm);
    expect(screen.queryByText(/Selected plan passes the current rule checks/)).toBeNull();
    expect(screen.getByText(/Acquisition legality, budget or scoring is unresolved/)).toBeTruthy();
    expect(select.hasAttribute("disabled")).toBe(true);
    expect(JSON.parse(window.localStorage.getItem(WORKSPACE_KEY)!).rules.scoring.weights).toEqual({});
    fireEvent.click(screen.getByText("Add point weight", { selector: "button" }));
    fireEvent.change(screen.getByLabelText("Acquisition cost"), { target: { value: "" } });
    fireEvent.click(confirm);
    expect(screen.getByText(/Acquisition legality, budget or scoring is unresolved/)).toBeTruthy();
    expect(select.hasAttribute("disabled")).toBe(true);
    expect(JSON.parse(window.localStorage.getItem(WORKSPACE_KEY)!).rules.acquisitionCost).toBeNull();
  });
  it("uses eligible full-team evidence for goalie starts without capping conflicts or reviving legacy rows", () => {
    const workspace = defaultWorkspace(new Date("2026-10-01T12:00:00Z"));
    const goalies = [7, 8].map(id => ({ ...player, id: String(id), nhlId: id, nhlTeamId: 12,
      rosterRevision: "roster", playerClass: "goalie" as const, eligiblePositions: ["G"] }));
    const games: PlanningSnapshot["games"] = [2, 3].map((day, index) => ({ id: String(30 + index),
      date: `2026-10-0${day}`, startsAt: `2026-10-0${day}T23:00:00Z`, scheduleRevision: "schedule",
      teamAbbreviation: "CAR", opponent: "NYR", status: "scheduled", home: true }));
    const forecasts: GameForecast[] = goalies.map(goalie => ({ playerId: goalie.id, gameId: "30",
      sourceKind: "detailed", sourceWatermark: "inputs", stats: { SAVES_GOALIE: 20 }, conditioning: "unconditional",
      startProbability: 0.8, confirmedStart: false, revisionId: "revision", modelVersion: "fixture", limitations: [],
      cutoffAt: "2026-10-01T10:00:00Z", issuedAt: "2026-10-01T11:00:00Z", expiresAt: games[0].startsAt!,
      allowedUses: { assignment: true, totals: true, comparison: true, conditionalTieBreak: false },
      issuedContext: { version: "forge-issued-context-v1", playerId: goalie.id, gameId: "30", nhlPlayerId: goalie.nhlId,
        seasonId: 20262027, teamId: 12, scheduledAt: games[0].startsAt!, scheduleRevision: "schedule", rosterRevision: "roster",
        observedAt: "2026-10-01T10:00:00Z", scheduleSourceUpdatedAt: null, scheduleFetchedAt: null,
        identityUpdatedAt: null, membershipCreatedAt: [] } }));
    const snapshot: PlanningSnapshot = { id: "goalie-panel", context: { ...workspace.context, startDate: "2026-10-02", endDate: "2026-10-03" },
      players: goalies, games, forecasts, roster: [{ playerId: "7", position: "active" }], rules: workspace.rules,
      realized: {}, opponent: null, evidence: {}, lockedAssignments: [] };
    const view = render(<GoalieEvidence snapshot={snapshot} />);
    expect(screen.getByText(/Starter evidence is incompatible/).textContent).toContain("projected starts unknown");
    expect(screen.getByText(/Starter evidence is incompatible/).textContent).toContain("0 confirmed starts");
    const valid = forecasts.map(row => ({ ...row, startProbability: 0.4 }));
    view.rerender(<GoalieEvidence snapshot={{ ...snapshot, forecasts: valid }} />);
    expect(screen.getByText(/0.4 projected across 1\/2 evidenced games/)).toBeTruthy();
    expect(screen.queryByText(/Starter evidence is incompatible/)).toBeNull();
    view.rerender(<GoalieEvidence snapshot={{ ...snapshot, forecasts: valid.map(row => ({ ...row,
      sourceKind: undefined, issuedContext: undefined, cutoffAt: undefined, expiresAt: undefined })) }} />);
    expect(screen.getByText(/projected starts unknown/)).toBeTruthy();
    expect(screen.queryByText(/projected across/)).toBeNull();
  });
  it("labels the selected statistical source and its permitted uses without implying a total", () => {
    const scoring = { mode: "points" as const, weights: { GOALS: 1 }, categories: [] };
    const forecast: GameForecast = { playerId: "1", gameId: "30", conditioning: "unconditional",
      sourceKind: "baseline", stats: { GOALS: null }, tieBreakStats: { GOALS: 2 },
      allowedUses: { assignment: false, totals: false, comparison: false, conditionalTieBreak: true },
      startProbability: null, confirmedStart: false, revisionId: "rate", modelVersion: "rates-v1", limitations: [],
      cutoffAt: "2026-09-29T12:00:00Z", issuedAt: "2026-09-29T13:00:00Z", expiresAt: "2026-10-01T00:00:00Z" };
    const props = { forecasts: [forecast], scoring, nameOf: () => "Alpha", timeZone: "UTC", label: "Selected lineup" };
    const view = render(<ForecastEvidence {...props} />);
    expect(screen.getByText(/Baseline rate estimate/).textContent).toContain("Conditional ability only; assumes participation. No projected total.");
    expect(screen.getByText(/Game-estimate bundle bounds/).textContent).toContain("Sep 29");
    expect(forecastSummary([forecast], scoring)).toContain("Includes baseline estimates");
    view.rerender(<ForecastEvidence {...props} forecasts={[{ ...forecast, sourceKind: "blended", stats: { GOALS: 1 },
      allowedUses: { ...forecast.allowedUses!, totals: true, comparison: true } }]} />);
    expect(screen.getByText(/Blended detailed\/baseline estimate/).textContent).toContain("Projected total and comparison use");
    view.rerender(<ForecastEvidence {...props} forecasts={[{ ...forecast, sourceKind: "detailed", assignmentStats: { GOALS: 1 },
      allowedUses: { assignment: true, totals: false, comparison: false, conditionalTieBreak: false } }]} />);
    expect(screen.getByText(/Detailed game estimate/).textContent).toContain("Assignment use only; no projected total");
    const unavailable = { ...forecast, tieBreakStats: undefined,
      allowedUses: { assignment: false, totals: false, comparison: false, conditionalTieBreak: false } };
    view.rerender(<ForecastEvidence {...props} forecasts={[unavailable]} />);
    expect(screen.getByText(/Unavailable · Start\/sit decision unresolved/)).toBeTruthy();
    expect(forecastSummary([unavailable], scoring)).toBe("Forecast evidence unavailable");
  });
  it("shows only each target's selected source timestamps across mixed inputs and replay", () => {
    const game = { playerId: 1, nhlPlayerId: 1, seasonId: 20262027, gameId: 30, teamId: 12,
      scheduledAt: "2026-10-08T23:00:00Z", scheduleRevision: "schedule", rosterRevision: "roster" };
    const allowedUses = { assignment: true, totals: true, comparison: true, conditionalTieBreak: true };
    const detailed = { ...game, kind: "detailed" as const, sourceId: "private-detail", policyVersion: "detailed-v1",
      released: true, allowedUses, targetKey: "GOALS", unit: "count" as const, basis: "per_appearance" as const,
      mean: 8, participationIntegrated: false, cutoffAt: "2026-09-28T00:00:00Z",
      issuedAt: "2026-09-28T01:00:00Z", expiresAt: "2026-10-09T00:00:00Z", sourceWatermark: "private-watermark" };
    const baseline = { ...detailed, kind: "baseline" as const, sourceId: "private-rate", mean: 2,
      cutoffAt: "2026-09-26T00:00:00Z", issuedAt: "2026-09-27T01:00:00Z", expiresAt: "2026-10-10T00:00:00Z" };
    const participation = { ...game, basis: "appearance" as const, probability: 0.5, revisionId: "private-participation",
      released: true, allowedUses, cutoffAt: "2026-09-28T01:00:00Z", issuedAt: "2026-09-28T02:00:00Z",
      expiresAt: "2026-09-30T00:00:00Z" };
    const input = { game, now: "2026-09-29T12:00:00Z", targetKey: "GOALS", detailed, baseline, participation };
    const goals = resolveContribution(input);
    const assists = resolveContribution({ ...input, targetKey: "ASSISTS",
      detailed: { ...detailed, targetKey: "ASSISTS", released: false, issuedAt: "2026-09-29T11:00:00Z" },
      baseline: { ...baseline, targetKey: "ASSISTS", sourceId: "private-assists", cutoffAt: "2026-09-29T03:00:00Z",
        issuedAt: "2026-09-29T04:00:00Z", expiresAt: "2026-10-12T00:00:00Z" } });
    expect(goals.sourceKind).toBe("blended");
    expect(assists.sourceKind).toBe("baseline");
    const forecast = forecastFromContributions({ playerId: "1", gameId: "30", conditioning: "unconditional",
      stats: {}, startProbability: null, confirmedStart: false, revisionId: "original", modelVersion: "fixture",
      issuedAt: input.now, limitations: [] }, { GOALS: goals, ASSISTS: assists }, false);
    expect(forecast.issuedAt).toBe("2026-09-29T04:00:00Z");
    expect(forecast.expiresAt).toBe(participation.expiresAt);
    const props = { forecasts: JSON.parse(JSON.stringify([forecast])) as GameForecast[],
      scoring: { mode: "points" as const, weights: { GOALS: 1, ASSISTS: 1 }, categories: [] },
      nameOf: () => "Alpha", timeZone: "UTC", label: "Selected lineup" };
    const view = render(<ForecastEvidence {...props} />);
    const goalEvidence = screen.getByLabelText("Alpha game 30 GOALS evidence");
    expect(within(goalEvidence).getByText(/Detailed production input/).textContent).toContain("issued Sep 28, 1:00 AM UTC");
    expect(within(goalEvidence).getByText(/Baseline rate input/).textContent).toContain("issued Sep 27, 1:00 AM UTC");
    expect(within(goalEvidence).getByText(/Baseline rate input/).textContent).toContain("expires Oct 10");
    expect(within(goalEvidence).getByText(/Participation input/).textContent).toContain("issued Sep 28, 2:00 AM UTC");
    expect(goalEvidence.textContent).not.toContain("Sep 29");
    const assistEvidence = screen.getByLabelText("Alpha game 30 ASSISTS evidence");
    expect(within(assistEvidence).getByText(/Baseline rate input/).textContent).toContain("issued Sep 29, 4:00 AM UTC");
    expect(within(assistEvidence).getByText(/Baseline rate input/).textContent).toContain("expires Oct 12");
    expect(within(assistEvidence).queryByText(/Detailed production input/)).toBeNull();
    expect(assistEvidence.textContent).not.toContain("11:00 AM");
    expect(document.body.textContent).not.toContain("private-");
    view.rerender(<ForecastEvidence {...props} forecasts={[{ ...forecast, contributions: {
      ...forecast.contributions, GOALS: { ...goals, inputs: undefined } } }]} />);
    expect(within(screen.getByLabelText("Alpha game 30 GOALS evidence"))
      .getByText("Target source timestamps unavailable.")).toBeTruthy();
    const conditional = resolveContribution({ ...input, detailed: undefined, participation: undefined });
    expect(conditional.allowedUses.conditionalTieBreak).toBe(true);
    view.rerender(<ForecastEvidence {...props} scoring={{ ...props.scoring, weights: { GOALS: 1 } }}
      forecasts={[forecastFromContributions(forecast, { GOALS: conditional }, false)]} />);
    expect(screen.getByText(/Baseline rate input/)).toBeTruthy();
    expect(screen.queryByText(/Participation input/)).toBeNull();
    expect(screen.getByText(/Conditional ability only/)).toBeTruthy();
    const expired = resolveContribution({ ...input, now: "2026-10-11T00:00:00Z", detailed: undefined,
      participation: undefined });
    view.rerender(<ForecastEvidence {...props} scoring={{ ...props.scoring, weights: { GOALS: 1 } }}
      forecasts={[forecastFromContributions(forecast, { GOALS: expired }, false)]} />);
    expect(screen.getByText(/Unavailable · Start\/sit decision unresolved/)).toBeTruthy();
    expect(screen.getByText("Target source timestamps unavailable.")).toBeTruthy();
    expect(screen.queryByText(/Baseline rate input/)).toBeNull();
  });
  it("labels unverified lineups as schedule capacity", async () => {
    vi.stubGlobal("fetch", fetchMock);
    render(<RosterScheduleOptimizer />);
    const button = await screen.findByRole("button", { name: "Show schedule-capacity assignment" });
    expect(button.textContent).toBe("Schedule-capacity assignment");
    fireEvent.click(button);
    expect(screen.getByRole("status").textContent).toContain("Player-quality start/sit decisions are unresolved");
    expect(screen.queryByRole("button", { name: /suggested lineup/i })).toBeNull();
  });
  it("distinguishes identically named Yahoo teams by league and selects the matching context", async () => {
    authState.user = { id: "owner" };
    authState.teams = ["Dummy League", "Drafted League"].map((league, index) => ({ id: `team-${index}`, external_league_id: `league-${index}`, team_name: "Same team", provider: "yahoo", team_metadata: { is_owned: true }, external_leagues: { league_name: league } }));
    vi.stubGlobal("fetch", fetchMock);
    render(<RosterScheduleOptimizer />);
    fireEvent.change(screen.getByRole("combobox", { name: "Source" }), { target: { value: "yahoo" } });
    expect(await screen.findByRole("option", { name: "Same team — Dummy League" })).toBeTruthy();
    expect(screen.getByRole("option", { name: "Same team — Drafted League" })).toBeTruthy();
    fireEvent.change(screen.getByRole("combobox", { name: "My team" }), { target: { value: "team-1" } });
    expect(JSON.parse(window.localStorage.getItem(WORKSPACE_KEY)!).context).toMatchObject({ teamId: "team-1", leagueId: "league-1" });
  });
  it("counts only acquired players' future games before their next drop", () => {
    const workspace = defaultWorkspace(new Date("2026-09-26T12:00:00Z"));
    const snapshot: PlanningSnapshot = { id: "gross", context: workspace.context, players: [player], roster: [], games: ["2026-09-27", "2026-09-29", "2026-10-01"].map((date, index) => ({ id: `g${index}`, date, startsAt: `${date}T23:00:00Z`, teamAbbreviation: "CAR", opponent: "NJD", home: true, status: "scheduled" })), forecasts: [], rules: workspace.rules, lockedAssignments: [], realized: {}, opponent: null, evidence: {} };
    const steps = [
      { id: "add", type: "add" as const, playerId: player.id, at: "2026-09-28T12:00:00Z", effectiveAt: "2026-09-28T12:00:00Z", conditional: true, dependsOn: [] },
      { id: "drop", type: "drop" as const, playerId: player.id, at: "2026-09-30T12:00:00Z", effectiveAt: "2026-09-30T12:00:00Z", conditional: false, dependsOn: ["add"] },
    ];
    expect(grossAcquisitionGames(steps, snapshot)).toBe(1);
  });
  it("keeps exact canonical selections and unresolved pasted names across remount", async () => {
    vi.stubGlobal("fetch", fetchMock);
    const view = render(<RosterScheduleOptimizer />);
    await screen.findByRole("searchbox", { name: "Find a player" });
    fireEvent.change(screen.getByRole("textbox", { name: "Paste roster names" }), { target: { value: "Alpha Center\nUnmatched Skater" } });
    fireEvent.click(screen.getByRole("button", { name: "Review pasted names" }));
    await waitFor(() => expect(screen.getByText("Unmatched Skater")).toBeTruthy());
    expect(screen.getByRole("button", { name: "Remove Alpha Center" })).toBeTruthy();
    const saved = JSON.parse(window.localStorage.getItem(WORKSPACE_KEY) ?? "null");
    expect(saved.roster).toEqual([{ playerId: "fhfh:1", position: "bench" }]);
    expect(saved.manualPlayers).toEqual([player]);
    fireEvent.click(screen.getByLabelText("Manager confirms league positions"));
    expect(JSON.parse(window.localStorage.getItem(WORKSPACE_KEY)!).manualPlayers[0].eligibilityVerified).toBe(true);
    view.unmount(); render(<RosterScheduleOptimizer />);
    expect(await screen.findByRole("button", { name: "Remove Alpha Center" })).toBeTruthy();
    expect((screen.getByLabelText("Manager confirms league positions") as HTMLInputElement).checked).toBe(true);
    expect(screen.getByText("Unmatched Skater")).toBeTruthy();
  });

  it("undoes local roster edits without changing the public snapshot", async () => {
    vi.stubGlobal("fetch", fetchMock);
    render(<RosterScheduleOptimizer />);
    await screen.findByRole("searchbox", { name: "Find a player" });
    fireEvent.change(screen.getByRole("searchbox", { name: "Find a player" }), { target: { value: "Alpha" } });
    fireEvent.click(screen.getByRole("button", { name: "Add" }));
    expect(screen.getByRole("button", { name: "Remove Alpha Center" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Undo" }));
    expect(screen.queryByRole("button", { name: "Remove Alpha Center" })).toBeNull();
    expect(fetchMock.mock.calls.filter(([url]) => url.includes("/data?")).length).toBe(1);
  });

  it("resumes each league's local working plan when switching contexts and reopening", async () => {
    const workspace = defaultWorkspace();
    workspace.context.leagueId = "first";
    workspace.roster = [{ playerId: player.id, position: "bench" }];
    workspace.manualPlayers = [player];
    window.localStorage.setItem(WORKSPACE_KEY, JSON.stringify(workspace));
    vi.stubGlobal("fetch", fetchMock);
    const saved = () => JSON.parse(window.localStorage.getItem(WORKSPACE_KEY)!);
    const view = render(<RosterScheduleOptimizer />);
    await screen.findByRole("button", { name: "Remove Alpha Center" });
    fireEvent.change(screen.getByRole("textbox", { name: "League ID" }), { target: { value: "second" } });
    fireEvent.click(screen.getByRole("button", { name: "Remove Alpha Center" }));
    expect(saved().roster).toEqual([]);
    fireEvent.change(screen.getByRole("textbox", { name: "League ID" }), { target: { value: "first" } });
    expect(saved().roster).toEqual(workspace.roster);
    view.unmount(); render(<RosterScheduleOptimizer />);
    await screen.findByRole("button", { name: "Remove Alpha Center" });
    fireEvent.change(screen.getByRole("textbox", { name: "League ID" }), { target: { value: "second" } });
    expect(saved().roster).toEqual([]);
    expect(screen.queryByRole("button", { name: "Remove Alpha Center" })).toBeNull();
  });

  it("marks a future selected add conditional until the provider confirms it", async () => {
    const workspace = defaultWorkspace();
    workspace.rules.acquisitionTiming = "same_day";
    window.localStorage.setItem(WORKSPACE_KEY, JSON.stringify(workspace));
    vi.stubGlobal("fetch", fetchMock);
    render(<RosterScheduleOptimizer />);
    await screen.findByRole("searchbox", { name: "Find candidate" });
    fireEvent.click(screen.getByRole("button", { name: "All players" }));
    fireEvent.change(screen.getByRole("searchbox", { name: "Find candidate" }), { target: { value: "Alpha" } });
    fireEvent.click(screen.getByRole("button", { name: "Mark available" }));
    fireEvent.click(screen.getByRole("button", { name: "Select add" }));
    const saved = JSON.parse(window.localStorage.getItem(WORKSPACE_KEY) ?? "null");
    expect(saved.intent.steps).toMatchObject([{ playerId: "fhfh:1", conditional: true }]);
  });

  it.each([0, 2, null])("shows selected acquisition cost %s with its drop and sequence prerequisite", async (cost) => {
    const workspace = defaultWorkspace();
    const bravo = { ...player, id: "fhfh:2", nhlId: 2, name: "Bravo Center" };
    const charlie = { ...player, id: "fhfh:3", nhlId: 3, name: "Charlie Center" };
    workspace.manualPlayers = [player, bravo, charlie];
    workspace.rules.acquisitionCost = cost;
    workspace.intent.steps = [
      { id: "b", type: "add", playerId: bravo.id, dropPlayerId: player.id, at: workspace.context.asOf, effectiveAt: workspace.context.asOf, conditional: true, dependsOn: [] },
      { id: "c", type: "add", playerId: charlie.id, dropPlayerId: bravo.id, at: workspace.context.asOf, effectiveAt: workspace.context.asOf, conditional: true, dependsOn: ["b"] },
    ];
    window.localStorage.setItem(WORKSPACE_KEY, JSON.stringify(workspace));
    vi.stubGlobal("fetch", fetchMock);
    render(<RosterScheduleOptimizer />);
    const row = (await screen.findByText("ADD Charlie Center")).closest("div")!;
    expect(within(row).getByText(`Acquisition cost: ${cost ?? "unknown"} · Drop: Bravo Center`)).toBeTruthy();
    expect(within(row).getByText("Requires: ADD Bravo Center")).toBeTruthy();
  });

  it.each([
    { availability: "manager_available" as const, waiverClearsAt: null, effectiveAt: "2026-10-05T04:00:00.000Z" },
    { availability: "waivers" as const, waiverClearsAt: "2026-10-05T16:00:00Z", effectiveAt: "2026-10-05T16:00:00Z" },
  ])("selects an add using next-day rules and $availability clearance", async ({ availability, waiverClearsAt, effectiveAt }) => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-10-04T20:00:00Z"));
    const workspace = defaultWorkspace();
    workspace.context = { ...workspace.context, startDate: "2026-10-05", endDate: "2026-10-06", timeZone: "America/New_York" };
    workspace.rules.acquisitionTiming = "next_day";
    workspace.rules.acquisitionCost = 1;
    workspace.rules.periods = [{ id: "Sunday submission", start: "2026-10-04T04:00:00Z", end: "2026-10-05T04:00:00Z", remaining: 1, source: "manager" }];
    workspace.manualPlayers = [{ ...player, availability, waiverClearsAt }];
    window.localStorage.setItem(WORKSPACE_KEY, JSON.stringify(workspace));
    vi.stubGlobal("fetch", fetchMock);
    render(<RosterScheduleOptimizer />);
    fireEvent.click(await screen.findByRole("button", { name: "All players" }));
    fireEvent.click(screen.getByRole("button", { name: "Select add" }));
    const saved = JSON.parse(window.localStorage.getItem(WORKSPACE_KEY)!);
    expect(saved.intent.steps).toMatchObject([{ playerId: player.id, at: "2026-10-04T20:01:00.000Z", effectiveAt, conditional: true }]);
    expect(screen.getAllByText(/Sunday submission/).length).toBeGreaterThan(0);
  });

  it.each([
    { timing: "unknown" as const, availability: "manager_available" as const, warning: /Verify acquisition timing/ },
    { timing: "same_day" as const, availability: "waivers" as const, warning: /Verify waiver clearance/ },
  ])("leaves acquisition intent unresolved for $timing/$availability", async ({ timing, availability, warning }) => {
    const workspace = defaultWorkspace();
    workspace.rules.acquisitionTiming = timing;
    workspace.manualPlayers = [{ ...player, availability }];
    window.localStorage.setItem(WORKSPACE_KEY, JSON.stringify(workspace));
    vi.stubGlobal("fetch", fetchMock);
    render(<RosterScheduleOptimizer />);
    fireEvent.click(await screen.findByRole("button", { name: "All players" }));
    fireEvent.click(screen.getByRole("button", { name: "Select add" }));
    expect(JSON.parse(window.localStorage.getItem(WORKSPACE_KEY)!).intent.steps).toEqual([]);
    expect(screen.getByText(warning)).toBeTruthy();
  });

  it("keeps refreshed provider authority through undo and reopen without replacing selected moves", async () => {
    authState.user = { id: "manager" };
    const workspace = defaultWorkspace();
    workspace.context = { ...workspace.context, provider: "yahoo", teamId: "team", leagueId: "league" };
    const candidate = { ...player, id: "fhfh:2", nhlId: 2, name: "Bravo Center", availability: "free_agent" as const };
    const newRosterPlayer = { ...player, id: "fhfh:3", nhlId: 3, name: "Charlie Center", availability: "rostered" as const };
    workspace.roster = [{ playerId: player.id, position: "active" }];
    workspace.manualPlayers = [player, candidate];
    workspace.lockedAssignments = [{ date: workspace.context.startDate, playerId: player.id, slotId: "C#1" }];
    workspace.intent.protectedPlayerIds = [player.id];
    workspace.intent.excludedPlayerIds = [newRosterPlayer.id];
    workspace.intent.steps = [{ id: "selected-add", type: "add", playerId: candidate.id,
      at: `${workspace.context.endDate}T12:00:00Z`, effectiveAt: `${workspace.context.endDate}T12:00:00Z`, conditional: true, dependsOn: [] }];
    workspace.rules.acquisitionTiming = "same_day";
    workspace.rules.periods = [{ id: "Week", start: workspace.context.asOf, end: `${workspace.context.endDate}T23:59:59Z`, remaining: 2, source: "provider" }];
    window.localStorage.setItem(WORKSPACE_KEY, JSON.stringify(workspace));
    const initial: PlanningSnapshot = { id: "provider-old", context: { ...workspace.context, asOf: "2026-10-08T12:00:00Z" },
      players: [player, candidate], roster: workspace.roster, rules: workspace.rules, lockedAssignments: workspace.lockedAssignments,
      games: [], forecasts: [], realized: {}, opponent: null, evidence: {} };
    const refreshed: PlanningSnapshot = { ...initial, id: "provider-new", context: { ...initial.context, asOf: "2026-10-08T13:00:00Z" },
      players: [...initial.players.map(row => row.id === candidate.id ? { ...row, availability: "rostered" as const } : row), newRosterPlayer], roster: [...initial.roster, { playerId: newRosterPlayer.id, position: "bench" }],
      rules: { ...initial.rules, periods: [{ ...initial.rules.periods[0], remaining: 1 }] } };
    let providerReads = 0;
    vi.stubGlobal("fetch", vi.fn((url: string) => {
      if (url.endsWith("/provider")) {
        const read = ++providerReads;
        return Promise.resolve(read === 3 ? { ok: false, json: async () => ({ success: false, error: "Provider temporarily unavailable." }) }
          : { ok: true, json: async () => ({ success: true, snapshot: read === 1 ? initial : refreshed,
            capabilities: { roster: true, settings: true, availability: true, waivers: false, acquisitions: false, limitations: [] } }) });
      }
      return Promise.resolve({ ok: true, json: async () => url.includes("/data?") ? { success: true, data }
        : url.endsWith("/access") ? { data: { eligible: true, capabilities: ["rso_sync"] } } : { data: null } });
    }));
    const saved = () => JSON.parse(window.localStorage.getItem(WORKSPACE_KEY)!);
    const view = render(<RosterScheduleOptimizer />);
    await waitFor(() => expect(saved().context.asOf).toBe(initial.context.asOf));
    fireEvent.change(screen.getByRole("combobox", { name: "Goalie choice" }), { target: { value: "cover" } });
    fireEvent.click(screen.getByRole("button", { name: "Refresh provider" }));
    await waitFor(() => expect(saved().context.asOf).toBe(refreshed.context.asOf));
    const beforeFailure = saved();
    fireEvent.click(screen.getByRole("button", { name: "Refresh provider" }));
    expect(await screen.findByText("Provider temporarily unavailable.")).toBeTruthy();
    expect(saved()).toEqual(beforeFailure);
    fireEvent.click(screen.getByRole("button", { name: "Undo" }));
    expect(screen.getByText("Bravo Center is no longer verified as available.")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Accept suggested repair" })).toBeTruthy();
    expect(saved()).toMatchObject({ context: refreshed.context, rules: refreshed.rules, roster: refreshed.roster,
      lockedAssignments: workspace.lockedAssignments, intent: { goalieCoverage: "accept_risk", steps: workspace.intent.steps,
        protectedPlayerIds: workspace.intent.protectedPlayerIds, excludedPlayerIds: workspace.intent.excludedPlayerIds } });
    expect(saved().manualPlayers.some((row: { id: string }) => row.id === newRosterPlayer.id)).toBe(true);
    view.unmount(); render(<RosterScheduleOptimizer />);
    await waitFor(() => expect(saved().context.asOf).toBe(refreshed.context.asOf));
    expect(saved().rules.periods[0].remaining).toBe(1);
    expect(saved().roster).toEqual(refreshed.roster);
    expect(saved().intent.steps).toEqual(workspace.intent.steps);
    expect(saved().lockedAssignments).toEqual(workspace.lockedAssignments);
  });

  it.each([
    { label: "League ID", value: "second-league", field: "leagueId" as const },
    { label: "Team ID", value: "second-team", field: "teamId" as const },
    { label: "Through", value: "2026-11-10", field: "endDate" as const },
  ])("refreshes the selected $field and ignores a late response for the previous scope", async ({ label, value, field }) => {
    authState.user = { id: "manager" };
    const workspace = defaultWorkspace();
    workspace.context = { ...workspace.context, provider: "yahoo", leagueId: "first-league", teamId: "team" };
    window.localStorage.setItem(WORKSPACE_KEY, JSON.stringify(workspace));
    const pending: { init?: RequestInit; resolve: (response: unknown) => void }[] = [];
    vi.stubGlobal("fetch", vi.fn((url: string, init?: RequestInit) => {
      if (url.endsWith("/provider")) return new Promise(resolve => pending.push({ init, resolve }));
      return Promise.resolve({ ok: true, json: async () => url.includes("/data?") ? { success: true, data }
        : url.endsWith("/access") ? { data: { eligible: true, capabilities: ["rso_sync"] } } : { data: null } });
    }));
    const saved = () => JSON.parse(window.localStorage.getItem(WORKSPACE_KEY)!);
    render(<RosterScheduleOptimizer />);
    await waitFor(() => expect(pending).toHaveLength(1));
    fireEvent.change(screen.getByLabelText(label), { target: { value } });
    await waitFor(() => expect(pending).toHaveLength(2));
    expect(pending[0].init?.signal?.aborted).toBe(true);
    expect(saved().context[field]).toBe(value);
    const snapshot = (context: PlanningSnapshot["context"]): PlanningSnapshot => ({ id: `scope:${context.asOf}`, context,
      players: [player], roster: [{ playerId: player.id, position: "bench" }], rules: workspace.rules,
      lockedAssignments: [], games: [], forecasts: [], realized: {}, opponent: null, evidence: {} });
    const response = (context: PlanningSnapshot["context"]) => ({ ok: true, json: async () => ({ success: true, snapshot: snapshot(context),
      capabilities: { roster: true, settings: true, availability: true, waivers: false, acquisitions: false, limitations: [] } }) });
    const currentContext = { ...saved().context, asOf: "2026-10-08T13:00:00Z" };
    await act(async () => pending[1].resolve(response(currentContext)));
    expect(saved().context).toEqual(currentContext);
    await act(async () => pending[0].resolve(response({ ...workspace.context, asOf: "2026-10-08T12:00:00Z" })));
    expect(saved().context).toEqual(currentContext);
    expect(saved().roster).toEqual(snapshot(currentContext).roster);
  });

  it("keeps the selected context when provider evidence belongs to another league", async () => {
    authState.user = { id: "manager" };
    const workspace = defaultWorkspace();
    workspace.context = { ...workspace.context, provider: "yahoo", leagueId: "selected-league", teamId: "team" };
    window.localStorage.setItem(WORKSPACE_KEY, JSON.stringify(workspace));
    vi.stubGlobal("fetch", vi.fn((url: string) => Promise.resolve({ ok: true, json: async () => url.includes("/data?") ? { success: true, data }
      : url.endsWith("/access") ? { data: { eligible: true, capabilities: ["rso_sync"] } }
        : url.endsWith("/provider") ? { success: true, snapshot: { context: { ...workspace.context, leagueId: "other-league" } } } : { data: null } })));
    render(<RosterScheduleOptimizer />);
    expect(await screen.findByText("Provider inputs do not match the selected league, team or timeframe. Review the context and refresh again.")).toBeTruthy();
    expect(JSON.parse(window.localStorage.getItem(WORKSPACE_KEY)!)).toMatchObject({ context: workspace.context, roster: [] });
  });

  it("uses the signed-in session for access and account reads, then refreshes after account switch", async () => {
    const workspace = defaultWorkspace();
    workspace.context = { ...workspace.context, provider: "yahoo", teamId: "first-team", leagueId: "first-league" };
    workspace.roster = [{ playerId: player.id, position: "bench" }];
    const candidate = { ...player, id: "fhfh:2", nhlId: 2, name: "Bravo Center" };
    workspace.manualPlayers = [player, candidate];
    workspace.lockedAssignments = [{ date: workspace.context.startDate, playerId: player.id, slotId: "C#1" }];
    workspace.intent.protectedPlayerIds = [player.id];
    workspace.intent.steps = [{ id: "selected-add", type: "add", playerId: candidate.id, dropPlayerId: player.id,
      at: `${workspace.context.startDate}T12:00:00Z`, effectiveAt: `${workspace.context.startDate}T12:00:00Z`, conditional: true, dependsOn: [] }];
    window.localStorage.setItem(WORKSPACE_KEY, JSON.stringify(workspace));
    let releaseProvider!: (response: unknown) => void;
    let releaseSecondAccess!: (response: unknown) => void;
    const pendingProvider = new Promise(resolve => { releaseProvider = resolve; });
    const pendingSecondAccess = new Promise(resolve => { releaseSecondAccess = resolve; });
    const authenticatedFetch = vi.fn((url: string, init?: RequestInit) => {
      const token = (init?.headers as Record<string, string>)?.Authorization;
      if (url.endsWith("/provider")) return pendingProvider;
      if (url.endsWith("/access") && token === "Bearer token-second") return pendingSecondAccess;
      return Promise.resolve({ ok: true, json: async () => url.includes("/data?") ? { success: true, data }
        : url.endsWith("/access") ? { data: { eligible: true, capabilities: ["rso_sync"] } } : { data: null } });
    });
    vi.stubGlobal("fetch", authenticatedFetch);
    authState.user = { id: "first" };
    const view = render(<RosterScheduleOptimizer />);
    await waitFor(() => expect(authenticatedFetch.mock.calls.some(([url, init]) => url.endsWith("/access") && (init?.headers as Record<string, string>)?.Authorization === "Bearer token-first")).toBe(true));
    await waitFor(() => expect(authenticatedFetch.mock.calls.some(([url, init]) => url.includes("/workspace?") && (init?.headers as Record<string, string>)?.Authorization === "Bearer token-first")).toBe(true));
    await waitFor(() => expect(authenticatedFetch.mock.calls.some(([url]) => url.endsWith("/provider"))).toBe(true));
    const firstRequest = authenticatedFetch.mock.calls.find(([url]) => url.endsWith("/provider"))![1];
    fireEvent.click(screen.getByRole("button", { name: "All players" }));
    fireEvent.change(screen.getByRole("searchbox", { name: "Find candidate" }), { target: { value: "Bravo" } });
    fireEvent.change(screen.getByRole("combobox", { name: "Team" }), { target: { value: "CAR" } });
    fireEvent.click(screen.getByRole("button", { name: /Bravo Center/ }));
    authState.user = { id: "second" }; view.rerender(<RosterScheduleOptimizer />);
    expect(screen.getByRole("searchbox", { name: "Find candidate" })).toHaveProperty("value", "");
    expect(screen.getByRole("combobox", { name: "Team" })).toHaveProperty("value", "");
    expect(screen.getByRole("button", { name: "By Team" }).getAttribute("aria-pressed")).toBe("true");
    await waitFor(() => expect(authenticatedFetch.mock.calls.some(([url, init]) => url.endsWith("/access") && (init?.headers as Record<string, string>)?.Authorization === "Bearer token-second")).toBe(true));
    await waitFor(() => expect(authenticatedFetch.mock.calls.some(([url, init]) => url.includes("/workspace?") && (init?.headers as Record<string, string>)?.Authorization === "Bearer token-second")).toBe(true));
    expect(firstRequest?.signal?.aborted).toBe(true);
    expect((screen.getByRole("button", { name: "Refresh provider" }) as HTMLButtonElement).disabled).toBe(true);
    await act(async () => { releaseProvider({ ok: true, json: async () => ({ success: true, snapshot: {
      id: "late-first-account", context: workspace.context, players: [{ ...player, name: "First Account Player" }],
      roster: [{ playerId: player.id, position: "active" }], games: [], forecasts: [], rules: workspace.rules,
      lockedAssignments: [], realized: {}, opponent: null, evidence: {},
    }, capabilities: {} }) }); });
    expect(screen.queryByText("First Account Player")).toBeNull();
    const retained = JSON.parse(window.localStorage.getItem(WORKSPACE_KEY)!);
    expect(retained.intent).toEqual(workspace.intent);
    expect(retained.roster).toEqual(workspace.roster);
    expect(retained.manualPlayers).toEqual(workspace.manualPlayers);
    await act(async () => { releaseSecondAccess({ ok: true, json: async () => ({ data: { eligible: false, capabilities: [] } }) }); });
    expect(screen.getByText("Saved inputs are read-only and may be stale.")).toBeTruthy();
    fireEvent.click(screen.getByRole("checkbox", { name: /^Protect$/ }));
    expect(JSON.parse(window.localStorage.getItem(WORKSPACE_KEY)!).intent).toEqual(workspace.intent);
    fireEvent.click(screen.getByRole("button", { name: "Continue manually" }));
    const forked = JSON.parse(window.localStorage.getItem(WORKSPACE_KEY)!);
    expect(forked.context.provider).toBe("manual");
    expect(forked.intent).toEqual(workspace.intent);
    expect(forked.roster).toEqual(workspace.roster);
    expect(forked.lockedAssignments).toEqual(workspace.lockedAssignments);
    fireEvent.click(screen.getByRole("checkbox", { name: /^Protect$/ }));
    expect(JSON.parse(window.localStorage.getItem(WORKSPACE_KEY)!).intent.protectedPlayerIds).toEqual([]);
  });

  it("explains access-service failures instead of silently disabling provider sync", async () => {
    authState.user = { id: "manager" };
    vi.stubGlobal("fetch", vi.fn((url: string) => Promise.resolve({ ok: !url.endsWith("/access"), status: url.endsWith("/access") ? 503 : 200, json: async () => url.includes("/data?") ? { success: true, data } : { data: null } })));
    render(<RosterScheduleOptimizer />);
    expect((await screen.findByRole("alert")).textContent).toContain("in-season access could not be verified");
    fireEvent.change(screen.getByLabelText("Source"), { target: { value: "yahoo" } });
    expect((screen.getByRole("button", { name: "Refresh provider" }) as HTMLButtonElement).disabled).toBe(true);
    expect(screen.queryByText("Saved inputs are read-only and may be stale.")).toBeNull();
  });

  it("keeps the local plan on a stale-version save and ignores a late save after account switching", async () => {
    authState.user = { id: "manager" };
    let releaseSave!: (response: unknown) => void;
    const pendingSave = new Promise(resolve => { releaseSave = resolve; });
    let saveCount = 0;
    const authenticatedFetch = vi.fn((url: string, init?: RequestInit) => url.endsWith("/workspace") && init?.method === "PUT"
      ? ++saveCount === 1 ? Promise.resolve({ ok: true, status: 200, json: async () => ({ data: { version: 1 } }) })
        : saveCount === 2 ? Promise.resolve({ ok: false, status: 409, json: async () => ({ data: { version: 2 } }) }) : pendingSave
      : Promise.resolve({ ok: true, status: 200, json: async () => url.includes("/data?") ? { success: true, data } : url.endsWith("/access") ? { data: { eligible: true, capabilities: ["rso_account_save"] } } : { data: null } }));
    vi.stubGlobal("fetch", authenticatedFetch);
    const view = render(<RosterScheduleOptimizer />);
    fireEvent.click(await screen.findByRole("button", { name: "Save to account" }));
    expect(await screen.findByText("Saved to account.")).toBeTruthy();
    fireEvent.change(screen.getByRole("combobox", { name: "Goalie choice" }), { target: { value: "cover" } });
    const localPlan = JSON.parse(window.localStorage.getItem(WORKSPACE_KEY)!);
    fireEvent.click(screen.getByRole("button", { name: "Save to account" }));
    expect(await screen.findByText("Another device saved this workspace. Your local plan is intact; review the other version before saving again.")).toBeTruthy();
    expect(JSON.parse(window.localStorage.getItem(WORKSPACE_KEY)!)).toEqual(localPlan);
    fireEvent.click(screen.getByRole("button", { name: "Save to account" }));
    await waitFor(() => expect(saveCount).toBe(3));
    await waitFor(() => expect(authenticatedFetch.mock.calls.some(([url, init]) => url.endsWith("/workspace") && init?.method === "PUT" && (init.headers as Record<string, string>).Authorization === "Bearer token-manager")).toBe(true));
    authState.user = { id: "second" }; view.rerender(<RosterScheduleOptimizer />);
    await waitFor(() => expect(authenticatedFetch.mock.calls.some(([url, init]) => url.includes("/workspace?") && (init?.headers as Record<string, string>)?.Authorization === "Bearer token-second")).toBe(true));
    await act(async () => { releaseSave({ ok: true, status: 200, json: async () => ({ data: { version: 1 } }) }); });
    expect(screen.queryByText("Saved to account.")).toBeNull();
  });

  it("does not attach an old account save to a newly selected timeframe", async () => {
    authState.user = { id: "manager" };
    let releaseSave!: (response: unknown) => void;
    const pendingSave = new Promise(resolve => { releaseSave = resolve; });
    const savingFetch = vi.fn((url: string, init?: RequestInit) => url.endsWith("/workspace") && init?.method === "PUT" ? pendingSave
      : Promise.resolve({ ok: true, json: async () => url.includes("/data?") ? { success: true, data }
        : url.endsWith("/access") ? { data: { eligible: true, capabilities: ["rso_account_save"] } } : { data: null } }));
    vi.stubGlobal("fetch", savingFetch);
    render(<RosterScheduleOptimizer />);
    fireEvent.click(await screen.findByRole("button", { name: "Save to account" }));
    await waitFor(() => expect(savingFetch.mock.calls.some(([url, init]) => url.endsWith("/workspace") && init?.method === "PUT")).toBe(true));
    fireEvent.change(screen.getByLabelText("Through"), { target: { value: "2026-11-10" } });
    await waitFor(() => expect(savingFetch.mock.calls.some(([url]) => url.includes("/workspace?") && url.includes("endDate=2026-11-10"))).toBe(true));
    await act(async () => releaseSave({ ok: true, status: 200, json: async () => ({ data: { version: 7 } }) }));
    expect(JSON.parse(window.localStorage.getItem(WORKSPACE_KEY)!).context.endDate).toBe("2026-11-10");
    expect(screen.queryByText("Saved to account.")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Save to account" }));
    await waitFor(() => expect(savingFetch.mock.calls.filter(([url, init]) => url.endsWith("/workspace") && init?.method === "PUT")).toHaveLength(2));
    const saves = savingFetch.mock.calls.filter(([url, init]) => url.endsWith("/workspace") && init?.method === "PUT");
    expect(JSON.parse(saves[1][1]?.body as string).expectedVersion).toBeNull();
  });

  it("keeps invalid zone and cleared period dates out of committed rules", async () => {
    vi.stubGlobal("fetch", fetchMock);
    render(<RosterScheduleOptimizer />);
    const zone = await screen.findByLabelText("Time zone") as HTMLInputElement;
    const original = zone.value;
    fireEvent.change(zone, { target: { value: "Not/A_Zone" } });
    fireEvent.blur(zone);
    expect(screen.getByText(/valid IANA time zone/)).toBeTruthy();
    expect((screen.getByLabelText("Time zone") as HTMLInputElement).value).toBe(original);
    fireEvent.click(screen.getByText("Scoring, budgets, and lock windows"));
    fireEvent.click(screen.getByRole("button", { name: "Add acquisition period" }));
    const previous = JSON.parse(window.localStorage.getItem(WORKSPACE_KEY) ?? "null").rules.periods[0].start;
    fireEvent.change(screen.getByLabelText("Start"), { target: { value: "" } });
    expect(JSON.parse(window.localStorage.getItem(WORKSPACE_KEY) ?? "null").rules.periods[0].start).toBe(previous);
  });

  it("opens a saved manual snapshot read-only until the manager explicitly forks it", async () => {
    authState.user = { id: "manager" };
    const saved = defaultWorkspace();
    saved.context.asOf = "2026-09-01T12:00:00.000Z";
    saved.roster = [{ playerId: player.id, position: "bench" }];
    const candidate = { ...player, id: "fhfh:2", nhlId: 2, name: "Bravo Center" };
    saved.manualPlayers = [player, candidate];
    saved.lockedAssignments = [{ date: saved.context.startDate, playerId: player.id, slotId: "C#1" }];
    saved.intent = { ...saved.intent, revision: 2, protectedPlayerIds: [player.id], steps: [{
      id: "selected-add", type: "add", playerId: candidate.id, at: `${saved.context.startDate}T12:00:00Z`,
      effectiveAt: `${saved.context.startDate}T12:00:00Z`, conditional: true, dependsOn: [],
    }] };
    const snapshot = { id: "saved-1", context: saved.context, players: saved.manualPlayers, roster: saved.roster, games: [], forecasts: [], rules: saved.rules, lockedAssignments: saved.lockedAssignments, realized: {}, opponent: null, evidence: {} };
    vi.stubGlobal("fetch", vi.fn((url: string) => Promise.resolve({ ok: true, json: async () => url.includes("/data?") ? { success: true, data } : url.endsWith("/access") ? { data: { eligible: false, capabilities: [] } } : { data: { workspace: saved, snapshot, version: 1, updatedAt: saved.context.asOf } } })));
    render(<RosterScheduleOptimizer />);
    fireEvent.click(await screen.findByRole("button", { name: "View account save" }));
    expect(screen.getByText(/Saved evidence/)).toBeTruthy();
    expect((screen.getByLabelText("Planning setup") as HTMLFieldSetElement).disabled).toBe(true);
    expect(screen.getByText("Confirm planning inputs", { selector: "button" }).hasAttribute("disabled")).toBe(true);
    await waitFor(() => expect(JSON.parse(window.localStorage.getItem(WORKSPACE_KEY)!)).toMatchObject({
      intent: saved.intent, lockedAssignments: saved.lockedAssignments,
    }));
    fireEvent.click(screen.getByRole("button", { name: "Continue manually" }));
    expect((screen.getByLabelText("Planning setup") as HTMLFieldSetElement).disabled).toBe(false);
    await waitFor(() => expect(screen.getByText("Confirm planning inputs", { selector: "button" }).hasAttribute("disabled")).toBe(false));
    expect(screen.getByText(/Review league rules, scoring, locked assignments and player availability/)).toBeTruthy();
    expect(screen.getByRole("button", { name: "Remove Alpha Center" })).toBeTruthy();
    await waitFor(() => expect(JSON.parse(window.localStorage.getItem(WORKSPACE_KEY)!)).toMatchObject({
      intent: saved.intent, lockedAssignments: saved.lockedAssignments, roster: saved.roster,
    }));
  });
});
