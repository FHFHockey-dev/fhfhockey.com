import React from "react";
import { selectTeamFormGames, summarizeTeamForm } from "lib/projections/startChartTeamForm";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { buildBoardValidationDisclosure } from "lib/projections/starterBoardValidation";
import { BOARD_CATEGORIES } from "lib/projections/starterBoardScoring";
import { normalizeStartChartResponse, scoreStartChartPayload, startChartFromGameExpectations } from "lib/projections/startChartContract";
import { parseBoardScoringRequest } from "lib/projections/starterBoardScoring";
import { buildGameExpectations } from "lib/player-forecasts/gameExpectations";
import type { PlanningData } from "lib/rosterScheduleOptimizer/planningTypes";

const swrState = vi.hoisted(() => ({
  data: null as any,
  error: null as Error | null,
  isLoading: false,
  mutate: vi.fn(),
  request: vi.fn(),
}));

const deploymentState = vi.hoisted(() => ({ data: undefined as any, error: null as Error | null, request: vi.fn(), mutate: vi.fn() }));

const routerState = vi.hoisted(() => ({
  router: {
    isReady: true,
    pathname: "/start-chart",
    query: {} as Record<string, string | string[]>,
    replace: vi.fn(),
  },
}));

const yahooAuth = vi.hoisted(() => ({ user: null as { id: string } | null }));
vi.mock("contexts/AuthProviderContext", () => ({ useAuth: () => ({ user: yahooAuth.user }) }));
vi.mock("lib/supabase/client", () => ({ default: { from: vi.fn(), auth: { getSession: async () => ({ data: { session: { access_token: "fixture-session" } } }) } } }));

const readySourceStatus = {
  overall: "ready",
  projection: {
    state: "ready",
    affectsRanking: true,
    date: "2026-02-07",
    updatedAt: "2026-02-07T12:00:00Z",
    runId: "run-1234567890",
    modelVersion: "skater-baseline-v1",
    inputVersion: "full_selected_scope_through_end_date_v1",
  },
  teamRatings: {
    state: "ready",
    affectsRanking: false,
    date: "2026-02-07",
    requestedDate: "2026-02-07",
    resolvedDate: "2026-02-07",
  },
  ctpi: {
    state: "ready",
    affectsRanking: false,
    date: "2026-02-06",
    throughDate: "2026-02-06",
    formulaVersion: "ctpi-formula-v1",
    inputVersion: "ctpi-one-game-input-v2",
    trustedRows: 64,
    untrustedRows: 0,
  },
  goalies: {
    state: "ready",
    affectsRanking: true,
    date: "2026-02-07",
    expectedTeams: 4,
    coveredTeams: 4,
    freshTeams: 4,
    staleTeams: 0,
  },
  ownership: {
    state: "ready",
    affectsRanking: false,
    date: "2026-02-07",
    mappedPlayers: 2,
    unmappedPlayers: 0,
    playersWithAsOf: 2,
    playersMissingAsOf: 0,
    oldestAsOfDate: "2026-02-07",
    latestAsOfDate: "2026-02-07",
  },
  gamesRemaining: {
    state: "ready",
    affectsRanking: false,
    date: "2026-02-07",
  },
  degradedReasons: [],
};

const buildApiData = () => ({
  dateUsed: "2026-02-07",
  date: "2026-02-07",
  requestedDate: "2026-02-07",
  resolvedDate: "2026-02-07",
  fallbackApplied: false,
  serving: {
    mode: "exact",
    message: null,
  },
  projectionRunId: "run-1234567890",
  projections: 0,
  players: [],
  ctpi: [],
  games: [],
  sourceStatus: readySourceStatus,
  coverage: {
    slateGames: 0,
    slateTeams: 0,
    projectionRows: 0,
    renderedRows: 0,
    goalieTeamsExpected: 0,
    goalieTeamsCovered: 0,
    yahooMappedPlayers: 0,
    yahooUnmappedPlayers: 0,
  },
  fantasyScoringContract: {
    version: "fixture-scoring-v9",
    label: "Fixture scoring",
    weights: {
      goals: 4,
      assists: 3,
      powerPlayPoints: 2,
      shotsOnGoal: 0.33,
      hits: 0.44,
      blockedShots: 0.55,
    },
  },
});

const player = (overrides: Record<string, unknown> = {}) => ({
  row_key: "run-123:1001:8478402:1",
  game_id: 1001,
  player_id: 8478402,
  name: "Nick Suzuki",
  positions: ["C"],
  ownership: 25,
  percent_ownership: 25,
  ownership_as_of_date: "2026-02-07",
  opponent_team_id: 10,
  opponent_abbrev: "TOR",
  team_id: 8,
  team_abbrev: "MTL",
  proj_fantasy_points: 4.2,
  proj_goals: 0.6,
  proj_assists: 0.6,
  proj_shots: 3.5,
  proj_pp_points: 0.3,
  proj_hits: 0.6,
  proj_blocks: 0.4,
  proj_pim: 0.1,
  proj_toi_minutes: 19.2,
  matchup_grade: 62,
  start_probability: null,
  projected_gsaa: null,
  confirmed_status: null,
  games_remaining_week: 3,
  position_ranks: { C: 1 },
  context: {
    es_role: "L1",
    unit_tier: "PP1",
    pp_share: 0.62,
    role_probability: 0.8,
    role_continuity: 0.75,
    opponent_defense_edge: 0.12,
    goalie_goal_rate_multiplier: 1.04,
    goalie_starter_certainty: 0.72,
    rest_delta: 1,
    trend_effect: "applied",
    projection_low: 2.1,
    projection_high: 6.4,
    flags: [],
  },
  ...overrides,
});

function expiringExpectationData(date: string, expiresAt: string, goals = 1) {
  return normalizeStartChartResponse({ ...buildApiData(), date, requestedDate: date, resolvedDate: date,
    contractVersion: 2, gameExpectations: { version: "forge-game-expectations-v1", readAsOf: new Date().toISOString(),
      basis: "expected", expiresAt },
    games: [{ id: date === "2026-02-07" ? 1001 : 1002, date, homeTeamId: 10, awayTeamId: 8,
      homeGoalies: [{ player_id: 9001, name: "Synthetic expiring goalie", start_probability: 0.75 }] }],
    players: [player({ name: `Synthetic expiring player ${date}`, game_id: date === "2026-02-07" ? 1001 : 1002,
      forecast: { conditioning: "unconditional", participationProbability: null, expected: { GOALS: goals } },
      gameExpectation: { playerId: "7", scheduleRevision: `schedule-${date}`, targets: { GOALS: {
        expected: goals, conditional: null, basis: "unconditional_game", unit: "count",
        allowedUses: { totals: true, comparison: true }, expiresAt,
      } } } })] });
}

vi.mock("next/head", () => ({
  default: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

vi.mock("next/image", () => ({
  default: ({
    alt = "",
    ...props
  }: React.ImgHTMLAttributes<HTMLImageElement>) => (
    // eslint-disable-next-line @next/next/no-img-element
    <img alt={alt} {...props} />
  ),
}));

vi.mock("next/router", () => ({
  useRouter: () => routerState.router,
}));

vi.mock("swr", () => ({
  default: (key: unknown) => {
    if (!key || (Array.isArray(key) && key[0] === "starter-board-deployment")) {
      deploymentState.request(key);
      return deploymentState;
    }
    swrState.request(key);
    return ({
    data: swrState.data,
    error: swrState.error,
    isLoading: swrState.isLoading,
    mutate: swrState.mutate,
    });
  },
}));

vi.mock("recharts", () => ({
  BarChart: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  Bar: () => null,
  CartesianGrid: () => null,
  Legend: () => null,
  LineChart: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  Line: () => null,
  ReferenceLine: () => null,
  ResponsiveContainer: ({ children }: { children: React.ReactNode }) => (
    <>{children}</>
  ),
  Tooltip: () => null,
  XAxis: () => null,
  YAxis: () => null,
}));

import StartChartPage from "../../pages/start-chart";
import StarterBoardPlayerDetails, { fetchStarterBoardDeployment } from "components/StarterBoardPlayerDetails";
import { PlayerLineupDeploymentGrid, type PlayerLineupDeploymentTally } from "components/PlayerStats/PlayerLineupDeploymentGrid";
import supabase from "lib/supabase/client";

const deploymentRows: PlayerLineupDeploymentTally[] = [
  { deployment_group: "forward", deployment_code: "F1_C", deployment_label: "Line 1 center", games: 8, total_games: 10, share: 0.8 },
  { deployment_group: "defense", deployment_code: "D1_LD", deployment_label: "Pair 1 left", games: 6, total_games: 10, share: 0.6 },
  { deployment_group: "power_play", deployment_code: "PP1", deployment_label: "PP1", games: 7, total_games: 10, share: 0.7 },
];

describe("StartChartPage", () => {
  it.each([
    [["C", "LW", "RW"], "Forwards", "Defense"],
    [["D"], "Defense", "Forwards"],
  ] as const)("shows only the relevant deployment group for %j", (positions, shown, hidden) => {
    render(<PlayerLineupDeploymentGrid rows={deploymentRows} positions={positions} compact />);
    expect(screen.getByText(shown)).toBeTruthy();
    expect(screen.queryByText(hidden)).toBeNull();
    expect(screen.getByText("Power Play")).toBeTruthy();
    expect(screen.getByTitle("PP1: 70% (7/10)")).toBeTruthy();
  });

  it("loads deployment only after expansion and labels previous-season history", async () => {
    deploymentState.data = deploymentRows.map((row) => ({ ...row, season_id: 20252026, last_game_date: "2026-04-16" }));
    const view = render(<StarterBoardPlayerDetails playerId={8478402} positions={["C"]} date="2026-10-01" className="details">Evidence</StarterBoardPlayerDetails>);
    expect(deploymentState.request).toHaveBeenLastCalledWith(null);
    expect(screen.queryByRole("region", { name: "Lineup deployment" })).toBeNull();
    const details = view.container.querySelector("details")!;
    details.open = true;
    fireEvent(details, new Event("toggle"));
    await waitFor(() => expect(deploymentState.request).toHaveBeenLastCalledWith(["starter-board-deployment", 8478402, 20262027]));
    expect(screen.getByText("2025–26 · Regular season")).toBeTruthy();
    expect(screen.getByText(/Recorded deployment through 2026-04-16/)).toBeTruthy();
    expect(screen.queryByText("Defense")).toBeNull();
    view.rerender(<StarterBoardPlayerDetails playerId={8478402} positions={["C"]} date="2026-02-07" className="details">Evidence</StarterBoardPlayerDetails>);
    expect(screen.getByText(/season totals include games after this slate/)).toBeTruthy();
  });

  it("shows loading, empty and retry states without inventing deployment", async () => {
    const props = { playerId: 8478402, positions: ["D"], date: "2026-10-01", className: "details" };
    const view = render(<StarterBoardPlayerDetails {...props}>Evidence</StarterBoardPlayerDetails>);
    const details = view.container.querySelector("details")!;
    details.open = true;
    fireEvent(details, new Event("toggle"));
    expect(await screen.findByText("Loading deployment history…")).toBeTruthy();
    deploymentState.data = [];
    view.rerender(<StarterBoardPlayerDetails {...props}>Evidence</StarterBoardPlayerDetails>);
    expect(screen.getByText(/No recorded deployment/)).toBeTruthy();
    deploymentState.error = new Error("private error detail");
    view.rerender(<StarterBoardPlayerDetails {...props}>Evidence</StarterBoardPlayerDetails>);
    fireEvent.click(screen.getByRole("button", { name: "Retry" }));
    expect(deploymentState.mutate).toHaveBeenCalledOnce();
    expect(screen.queryByText("private error detail")).toBeNull();
    view.rerender(<StarterBoardPlayerDetails {...props} positions={["G"]}>Evidence</StarterBoardPlayerDetails>);
    expect(deploymentState.request).toHaveBeenLastCalledWith(null);
    expect(screen.queryByText(/Deployment history unavailable/)).toBeNull();
  });

  it("queries bounded regular-season tallies and never combines seasons", async () => {
    const latest = { ...deploymentRows[0], season_id: 20262027 };
    const previous = { ...deploymentRows[1], season_id: 20252026 };
    const query = { select: vi.fn(), eq: vi.fn(), in: vi.fn(), order: vi.fn(), limit: vi.fn() };
    for (const method of [query.select, query.eq, query.in, query.order]) method.mockReturnValue(query);
    query.limit.mockResolvedValue({ data: [latest, previous], error: null });
    vi.mocked(supabase.from).mockReturnValue(query as any);
    expect(await fetchStarterBoardDeployment(["starter-board-deployment", 8478402, 20262027])).toEqual([latest]);
    expect(query.eq).toHaveBeenCalledWith("player_id", 8478402);
    expect(query.eq).toHaveBeenCalledWith("game_type", 2);
    expect(query.in).toHaveBeenCalledWith("season_id", [20262027, 20252026]);
    expect(query.limit).toHaveBeenCalledWith(40);
    query.limit.mockResolvedValue({ data: [previous], error: null });
    expect(await fetchStarterBoardDeployment(["starter-board-deployment", 8478402, 20262027])).toEqual([previous]);
    query.limit.mockResolvedValue({ data: null, error: new Error("unavailable") });
    await expect(fetchStarterBoardDeployment(["starter-board-deployment", 8478402, 20262027])).rejects.toThrow("unavailable");
  });

  it("loads a private Yahoo comparison and clears it when the account signs out", async () => {
    yahooAuth.user = { id: "owner" };
    const request = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ data: {
      date: "2026-10-01", teamId: "team", teamName: "Private team", status: "incomplete",
      teams: [{ id: "team", name: "Private team" }], mode: "points", roster: [{ id: "idle", name: "Idle Player", valueBasis: "no_game" }],
      streaming: [{ playerId: "candidate", name: "Candidate", availability: "unknown", incrementalValue: null, dropPlayerId: null,
        limitations: ["Acquisition timing does not establish usability today."] }],
      lineup: { status: "incomplete", assignments: [], limitations: [] }, limitations: ["Participation estimates are missing."],
      streamingCoverage: { playersChecked: 75, matchedToday: 12 },
    } }) });
    vi.stubGlobal("fetch", request);
    try {
      const view = render(<StartChartPage />);
      fireEvent.click(screen.getByText("My Yahoo team · Today · Draft Pro"));
      fireEvent.click(screen.getByRole("button", { name: "Refresh today’s comparison" }));
      await screen.findByText("Incomplete lineup comparison");
      expect(screen.getByText("Participation estimates are missing.")).toBeTruthy();
      expect(screen.getByText(/No game today: Idle Player/)).toBeTruthy();
      expect(screen.getByText("Acquisition timing does not establish usability today.")).toBeTruthy();
      expect(screen.getByText("75 available players checked · 12 matched to today’s projections.")).toBeTruthy();
      expect(request).toHaveBeenCalledWith("/api/v1/account/yahoo/starter-board", expect.objectContaining({ cache: "no-store", method: "POST",
        headers: expect.objectContaining({ Authorization: "Bearer fixture-session" }) }));
      yahooAuth.user = null;
      view.rerender(<StartChartPage />);
      expect(screen.queryByText("Incomplete lineup comparison")).toBeNull();
      expect(screen.queryByText("Private team")).toBeNull();
    } finally { vi.unstubAllGlobals(); }
  });
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-02-07T17:00:00Z"));
    deploymentState.data = undefined;
    deploymentState.error = null;
    deploymentState.request.mockClear();
    deploymentState.mutate.mockClear();
    yahooAuth.user = null;
    swrState.data = buildApiData();
    swrState.error = null;
    swrState.isLoading = false;
    swrState.request.mockClear();
    routerState.router.query = {};
    routerState.router.replace.mockImplementation(async (location: any) => {
      routerState.router.query = location.query ?? {};
      const params = new URLSearchParams();
      for (const [key, value] of Object.entries(routerState.router.query)) {
        if (typeof value === "string") params.set(key, value);
      }
      window.history.replaceState(
        {},
        "",
        `${routerState.router.pathname}${params.size ? `?${params}` : ""}`,
      );
      return true;
    });
    window.history.replaceState({}, "", "/start-chart");
  });

  afterEach(() => {
    vi.useRealTimers();
    cleanup();
    swrState.mutate.mockClear();
    routerState.router.replace.mockClear();
  });

  it("discloses disabled serving separately from an empty scheduled slate", () => {
    swrState.data = { ...buildApiData(), publishedForecastsEnabled: false,
      games: [{ id: 1001, date: "2026-02-07", homeTeamId: 10, awayTeamId: 8 }],
      serving: { mode: "partial", message: "Scheduled games are missing projections." } };
    render(<StartChartPage />);
    expect(screen.getByText("Published game forecasts are disabled.")).toBeTruthy();
    expect(screen.getByText("No player projections found.")).toBeTruthy();
    expect(screen.getByText(/Reloading does not enable forecast serving/)).toBeTruthy();
  });

  it("does not infer disabled serving from an older payload without explicit state", () => {
    render(<StartChartPage />);
    expect(screen.queryByText("Published game forecasts are disabled.")).toBeNull();
  });

  it("preserves only public forecast rejection details through the contract", () => {
    const normalized = normalizeStartChartResponse({ ...buildApiData(), forecastAdmission: {
      exclusionCounts: { missing_participation: 1, missing_target: 2, stale_source: -1, future_input: "3" },
      exclusions: [{ gameId: "1001", playerId: "7", targetKey: "GOALS", reasons: ["missing_target"],
        privateEvidence: { raw: "private-source" } }, { gameId: "1001", reasons: ["missing_participation"] }],
      privateReceipt: "private-receipt",
    } });
    expect(normalized.forecastAdmission).toEqual({
      exclusionCounts: { missing_participation: 1, missing_target: 2 },
      exclusions: [{ gameId: "1001", playerId: "7", targetKey: "GOALS", reasons: ["missing_target"] },
        { gameId: "1001", reasons: ["missing_participation"] }],
    });
    expect(JSON.stringify(normalized)).not.toContain("private-source");
    expect(JSON.stringify(normalized)).not.toContain("private-receipt");
    expect(normalizeStartChartResponse(buildApiData()).forecastAdmission).toBeUndefined();
  });

  it("explains withheld forecasts without claiming publication or inventing values", () => {
    swrState.data = normalizeStartChartResponse({ ...buildApiData(), contractVersion: 2,
      games: [{ id: 1001, date: "2026-02-07", homeTeamId: 10, awayTeamId: 8 }],
      forecastAdmission: { exclusionCounts: { missing_participation: 1, use_not_approved: 1 }, exclusions: [
        { gameId: "1001", reasons: ["missing_participation", "use_not_approved"] },
      ] },
    });
    render(<StartChartPage />);
    const exclusions = screen.getByRole("status", { name: "Forecast exclusions" });
    expect(exclusions.textContent).toContain("Participation evidence unavailable: 1");
    expect(exclusions.textContent).toContain("Forecast use not approved: 1");
    expect(screen.getByText("No admitted game forecasts")).toBeTruthy();
    expect(screen.queryByText("Latest published projections")).toBeNull();
    expect(screen.queryByText(/canonical projection rows are not ready/)).toBeNull();
    expect(document.querySelectorAll('[class*="cardList"] li')).toHaveLength(0);
  });

  it.each([false, true])("describes overdue updates with admitted forecasts=%s", admitted => {
    swrState.data = normalizeStartChartResponse({ ...buildApiData(), contractVersion: 2,
      games: [{ id: 1001, date: "2026-02-07", homeTeamId: 10, awayTeamId: 8 }],
      gameRevisions: admitted ? [{ gameId: 1001, revisionId: "fixture-revision", runId: "fixture-run",
        decisionAsOf: "2026-02-07T12:00:00Z", publishedAt: "2026-02-07T12:01:00Z" }] : [],
      players: admitted ? [player()] : [],
      sourceStatus: { ...readySourceStatus, projection: { ...readySourceStatus.projection,
        updatedAt: admitted ? "2026-02-07T12:01:00Z" : null } },
      newsStatus: { available: true, pendingGames: 1, freshnessBreachedGames: 1, unresolvedConflicts: 0 },
    });
    const view = render(<StartChartPage />);
    expect(screen.getByText(/Five-minute update target exceeded/).textContent).toContain(admitted
      ? "Showing the last successful projections."
      : "No admitted forecasts are available while updates are pending.");
    if (!admitted) {
      expect(screen.queryByText(/Showing the last successful projections/)).toBeNull();
      swrState.data = { ...swrState.data, newsStatus: { ...swrState.data.newsStatus, pendingGames: 0 } };
      view.rerender(<StartChartPage />);
      expect(screen.getByText(/Five-minute update target exceeded/).textContent).toContain("No admitted forecasts are available.");
      expect(screen.queryByText(/Showing the last successful projections/)).toBeNull();
    }
  });

  it("replaces historical URLs with today and prevents past-date selection", () => {
    routerState.router.query = { date: "2026-02-05", position: "LW" };
    render(<StartChartPage />);
    const input = screen.getByLabelText("Date") as HTMLInputElement;
    expect(input.value).toBe("2026-02-07");
    expect(input.min).toBe("2026-02-07");
    expect(routerState.router.query.date).toBe("2026-02-07");
    expect((screen.getByRole("button", { name: "Previous day" }) as HTMLButtonElement).disabled).toBe(true);
    fireEvent.change(input, { target: { value: "2026-02-06" } });
    expect(input.value).toBe("2026-02-07");
  });

  it.each([0, 0.3])("selects the available PPP category with value %s when other heads are unavailable", value => {
    const stats = { ...Object.fromEntries(BOARD_CATEGORIES.map(key => [key, null])), PP_POINTS: value };
    swrState.data = { ...buildApiData(), contractVersion: 2, players: [player({
      proj_fantasy_points: null, proj_goals: null, proj_assists: null, proj_shots: null,
      proj_hits: null, proj_blocks: null, proj_pim: null, proj_toi_minutes: null,
      forecast: { conditioning: "unconditional", participationProbability: 1, probabilityStatus: "confirmed_evidence",
        expected: stats, conditional: stats, legacy: null, distributionStatus: "means_only_unvalidated", evidence: [], conflicts: [] },
    })] };
    routerState.router.query = { position: "C" };
    const view = render(<StartChartPage />);
    expect(screen.getByText(/Point total unavailable: missing/)).toBeTruthy();
    fireEvent.change(screen.getByLabelText("Compare"), { target: { value: "categories" } });
    expect((screen.getByLabelText("Category") as HTMLSelectElement).value).toBe("PP_POINTS");
    const panel = document.getElementById("start-chart-panel-C")!;
    expect(panel.querySelector("strong")?.textContent).toBe(value.toFixed(2));
    expect(panel.querySelector("ol li")?.textContent).toContain("PP POINTS");
    expect(screen.queryByText(/Point total unavailable: missing/)).toBeNull();
    fireEvent.change(screen.getByLabelText("Category"), { target: { value: "SHOTS_ON_GOAL" } });
    expect(panel.querySelector("strong")?.textContent).toBe("—");
    expect(screen.getByText("SHOTS ON GOAL unavailable for this player.")).toBeTruthy();
    view.rerender(<StartChartPage />);
    expect((screen.getByLabelText("Category") as HTMLSelectElement).value).toBe("SHOTS_ON_GOAL");
    fireEvent.change(screen.getByLabelText("Compare"), { target: { value: "points" } });
    fireEvent.change(screen.getByLabelText("Compare"), { target: { value: "categories" } });
    expect((screen.getByLabelText("Category") as HTMLSelectElement).value).toBe("SHOTS_ON_GOAL");
    expect(panel.querySelector("strong")?.textContent).toBe("—");
  });

  it("keeps shots as the category default when an observed zero is available", () => {
    const stats = { SHOTS_ON_GOAL: 0, PP_POINTS: 0.3 };
    swrState.data = { ...buildApiData(), contractVersion: 2, players: [player({
      forecast: { conditioning: "unconditional", participationProbability: 1, probabilityStatus: "confirmed_evidence",
        expected: stats, conditional: stats, legacy: null, distributionStatus: "means_only_unvalidated", evidence: [], conflicts: [] },
    })] };
    routerState.router.query = { position: "C" };
    render(<StartChartPage />);
    fireEvent.change(screen.getByLabelText("Compare"), { target: { value: "categories" } });
    expect((screen.getByLabelText("Category") as HTMLSelectElement).value).toBe("SHOTS_ON_GOAL");
  });

  it.each([0, 0.4])("keeps conditional PPP value %s labeled if playing after category selection", value => {
    swrState.data = normalizeStartChartResponse({ ...buildApiData(), contractVersion: 2, players: [player({
      forecast: { conditioning: "conditional_playing", participationProbability: null, probabilityStatus: "missing",
        expected: null, conditional: { PP_POINTS: value }, distributionStatus: "means_only_unvalidated",
        evidence: [], conflicts: [] },
    })] });
    const original = JSON.stringify(swrState.data);
    routerState.router.query = { position: "C" };
    render(<StartChartPage />);
    const row = document.querySelector("#start-chart-panel-C ol > li")!;
    expect(screen.getByText("FP if playing", { exact: true })).toBeTruthy();
    fireEvent.change(screen.getByLabelText("Compare"), { target: { value: "categories" } });
    expect((screen.getByLabelText("Category") as HTMLSelectElement).value).toBe("PP_POINTS");
    expect(row.querySelector('[class*="primaryProjection"] strong')?.textContent).toBe(value.toFixed(2));
    expect(screen.getByText("PP POINTS if playing", { exact: true })).toBeTruthy();
    expect(row.querySelector('[class*="playerRank"]')?.textContent).toBe("1");
    expect(JSON.stringify(swrState.data)).toBe(original);
  });

  it("consumer: exact-game conditional SOG shows support and original clocks without participation, totals or primary rank", () => {
    // Synthetic canonical DTO; no retained private packet or release permission is substituted.
    const support = "SOG support: 2 positive-minute appearances; dates 2026-02-01, 2026-02-04.";
    const originalClock = "Original conditional forecast generated: 2026-02-07T15:30:00Z; original input cutoff: 2026-02-07T15:00:00Z.";
    swrState.data = normalizeStartChartResponse({ ...buildApiData(), contractVersion: 2, projectionRunId: null,
      gameRevisions: [], gameExpectations: { version: "forge-game-expectations-v1", readAsOf: "2026-02-07T17:00:00Z", basis: "per_appearance" },
      games: [{ id: 1001, date: "2026-02-07", homeTeamId: 10, awayTeamId: 8 }],
      players: [player({ player_id: 77, name: "Synthetic exact-game SOG skater", row_key: "synthetic-sog:1001:7",
        forecast: { conditioning: "conditional_playing", participationProbability: null, probabilityStatus: "missing",
          expected: null, conditional: { SHOTS_ON_GOAL: 2.5 } },
        gameExpectation: { playerId: "7", scheduleRevision: "schedule-original", rosterRevision: "roster-7",
          appearanceProbability: null, startProbability: null, targets: { SHOTS_ON_GOAL: {
            expected: null, conditional: 2.5, basis: "per_appearance", unit: "count",
            allowedUses: { assignment: false, totals: false, comparison: false, conditionalTieBreak: true },
            sourceKind: "baseline", sourceIds: ["synthetic-exact-game-sog"], methodVersions: ["current-season-sog-appearance-mean-v1"],
            cutoffAt: "2026-02-07T15:00:00Z", issuedAt: "2026-02-07T16:00:00Z", expiresAt: "2026-02-07T22:00:00Z",
            sources: [{ sourceId: "synthetic-exact-game-sog", kind: "baseline", methodVersion: "current-season-sog-appearance-mean-v1",
              sourceWatermark: "synthetic-input", cutoffAt: "2026-02-07T15:00:00Z", issuedAt: "2026-02-07T16:00:00Z", expiresAt: "2026-02-07T22:00:00Z" }],
            participation: null, participationRevisionId: null, reasons: ["missing_participation"],
            limitations: [support, originalClock, "Calibration unavailable. This source covers only the bound game."] } } } })] });
    const original = JSON.stringify(swrState.data);
    render(<StartChartPage />);
    const row = document.querySelector("#start-chart-panel-C ol > li")!;
    const value = () => row.querySelector('[class*="primaryProjection"] strong')?.textContent;
    expect(value()).toBe("—");
    expect(screen.getByText("Participation unknown", { exact: true })).toBeTruthy();
    expect(screen.getByText(/Primary rank unavailable/)).toBeTruthy();
    const details = screen.getByText("Projection details and evidence").closest("details")!;
    details.open = true; fireEvent(details, new Event("toggle"));
    const sources = screen.getByText("Category sources and freshness").closest("details")!;
    sources.open = true; fireEvent(sources, new Event("toggle"));
    expect(details.open && sources.open).toBe(true);
    expect(sources.textContent).toContain(support); expect(sources.textContent).toContain(originalClock);
    expect(sources.textContent).toContain("Original baseline cutoff 2026-02-07T15:00:00Z; issued 2026-02-07T16:00:00Z");
    expect(sources.textContent).toContain("Calibration unavailable. This source covers only the bound game.");
    expect(screen.queryByText(/Participation model estimate|Confirmed out/)).toBeNull();
    fireEvent.change(screen.getByLabelText("Compare"), { target: { value: "categories" } });
    expect(screen.getByText("SHOTS ON GOAL if playing", { exact: true })).toBeTruthy(); expect(value()).toBe("2.50");
    expect(row.querySelector('[class*="playerRank"]')?.textContent).toBe("—");
    fireEvent.change(screen.getByLabelText("Comparison basis"), { target: { value: "expected" } });
    expect(value()).toBe("—"); expect(row.querySelector('[class*="playerRank"]')?.textContent).toBe("—");
    fireEvent.change(screen.getByLabelText("Comparison basis"), { target: { value: "per_appearance" } });
    expect(value()).toBe("2.50"); expect(JSON.stringify(swrState.data)).toBe(original);
  });

  it("uses a single daily expectation basis across players and retains source clocks when switching", () => {
    const target = (expected: number | null, conditional: number | null) => ({ expected, conditional,
      basis: "per_appearance", unit: "count", allowedUses: { totals: true, comparison: true, conditionalTieBreak: true },
      sourceKind: "baseline", sourceIds: ["synthetic-original"], methodVersions: ["fixture-v1"], sourceWatermarks: ["raw-fixture"],
      cutoffAt: "2026-02-07T10:00:00Z", issuedAt: "2026-02-07T11:00:00Z", expiresAt: "2026-02-07T23:00:00Z", reasons: [] });
    swrState.data = normalizeStartChartResponse({ ...buildApiData(), contractVersion: 2,
      gameExpectations: { version: "forge-game-expectations-v1", readAsOf: "2026-02-07T17:00:00Z", basis: "per_appearance" },
      players: [player({ name: "Synthetic conditional", forecast: { participationProbability: null },
        gameExpectation: { playerId: "7", scheduleRevision: "schedule-original", rosterRevision: "roster-original",
          targets: { PP_POINTS: target(0.1, 0.4) } } }),
      player({ player_id: 88, row_key: "synthetic-88", name: "Synthetic expected", forecast: { participationProbability: null },
        gameExpectation: { playerId: "8", scheduleRevision: "schedule-original", targets: { PP_POINTS: target(0.3, null) } } })] });
    const original = JSON.stringify(swrState.data);
    render(<StartChartPage />);
    expect(swrState.request).toHaveBeenCalledWith("/api/v1/start-chart?date=2026-02-07");
    expect(screen.getByText("Daily game expectations")).toBeTruthy();
    expect(screen.getByText(/Read 2026-02-07T17:00:00Z/)).toBeTruthy();
    expect(screen.queryByText(/Published 2026-02-07T17:00:00Z/)).toBeNull();
    fireEvent.change(screen.getByLabelText("Compare"), { target: { value: "categories" } });
    const values = () => Array.from(document.querySelectorAll('#start-chart-panel-C [class*="primaryProjection"] strong')).map(row => row.textContent);
    expect(values()).toEqual(["0.40", "—"]);
    expect(screen.getAllByText("PP POINTS if playing", { exact: true })).toHaveLength(2);
    expect(screen.getAllByText("Power-play role: Unavailable. Current role evidence is unavailable.")).toHaveLength(2);
    fireEvent.change(screen.getByLabelText("Comparison basis"), { target: { value: "expected" } });
    expect(values()).toEqual(["0.30", "0.10"]);
    expect(screen.queryByText("PP POINTS if playing", { exact: true })).toBeNull();
    expect(screen.getAllByText(/Valid from cutoff 2026-02-07T10:00:00Z; composite issuance 2026-02-07T11:00:00Z; expires 2026-02-07T23:00:00Z/)).toHaveLength(2);
    expect(JSON.stringify(swrState.data)).toBe(original);
  });

  it.each(["per_start", "per_appearance"])("keeps conditional goalie %s heads separate and labels their actual basis", basis => {
    swrState.data = normalizeStartChartResponse({ ...buildApiData(), contractVersion: 2,
      gameExpectations: { version: "forge-game-expectations-v1", readAsOf: "2026-02-07T17:00:00Z", basis },
      players: [player({ positions: ["G"], forecast: { participationProbability: null },
        gameExpectation: { playerId: "7", scheduleRevision: "schedule-original",
          powerPlayRole: { value: null, status: "not_applicable", reason: "not_applicable", source: null }, targets: { SAVES_GOALIE: {
          expected: null, conditional: 25, basis, unit: "count", allowedUses: { conditionalTieBreak: true },
        }, WINS_GOALIE: { expected: null, conditional: 0.5, basis: basis === "per_start" ? "per_appearance" : "per_start",
          unit: "count", allowedUses: { conditionalTieBreak: true } } } } })] });
    routerState.router.query = { position: "G" };
    render(<StartChartPage />);
    const condition = basis === "per_start" ? "if starting" : "if playing";
    expect(screen.getByText("Power-play role: Not applicable (goalie).")).toBeTruthy();
    expect(screen.getByText(`FP ${condition}`, { exact: true })).toBeTruthy();
    expect(screen.getByText(/start unknown/)).toBeTruthy();
    expect(screen.getByText(`Saves ${condition}`, { exact: true }).nextSibling?.textContent).toBe("25.0");
    expect(screen.getByText("Win", { exact: true }).nextSibling?.textContent).toBe("—");
    expect(screen.getByText(/Primary rank unavailable/)).toBeTruthy();
    fireEvent.change(screen.getByLabelText("Compare"), { target: { value: "categories" } });
    expect(screen.getByText(`SAVES GOALIE ${condition}`, { exact: true })).toBeTruthy();
    expect(document.querySelector('#start-chart-panel-G [class*="primaryProjection"] strong')?.textContent).toBe("25.00");
    expect(document.querySelector('#start-chart-panel-G [class*="playerRank"]')?.textContent).toBe("—");
  });

  it("preserves source assumptions and a supplied probability without inventing confirmation or model status", () => {
    swrState.data = normalizeStartChartResponse({ ...buildApiData(), contractVersion: 2,
      gameExpectations: { version: "forge-game-expectations-v1", readAsOf: "2026-02-07T17:00:00Z", basis: "per_start" },
      players: [player({ positions: ["G"], start_probability: 0.75, confirmed_status: null,
        forecast: { participationProbability: 0.75 },
        gameExpectation: { playerId: "7", scheduleRevision: "schedule-original", startProbability: 0.75,
          limitations: ["Fixture source assumes zero relief minutes."], targets: { SAVES_GOALIE: {
            expected: null, conditional: 25, basis: "per_start", unit: "count", allowedUses: { conditionalTieBreak: true },
            limitations: ["Saves conditional on starting; no relief contribution."],
          } } } })] });
    routerState.router.query = { position: "G" };
    render(<StartChartPage />);
    expect(screen.getByText(/Starting probability 75.*calibration unavailable/)).toBeTruthy();
    expect(screen.getByText("Fixture source assumes zero relief minutes.")).toBeTruthy();
    expect(screen.getByText(/Saves conditional on starting; no relief contribution/)).toBeTruthy();
    expect(screen.queryByText(/uncalibrated model|confirmed evidence|Modeled participation/)).toBeNull();
  });

  it.each([
    { name: "explicit model", version: "skater-participation-frequency-v1", event: "positive_minutes", probability: 0.75, totals: true, recognized: true },
    { name: "frozen skater model", version: "skater-frozen-window-appearance-frequency-v1", event: "positive_minutes", probability: 0.75, totals: true, recognized: true },
    { name: "goalie appearance model", version: "goalie-appearance-frequency-v1", event: "positive_minutes", probability: 0.75, totals: true, recognized: true },
    { name: "frozen goalie appearance model", version: "goalie-frozen-window-appearance-frequency-v1", event: "positive_minutes", probability: 0.75, totals: true, recognized: true },
    { name: "modeled zero", version: "skater-participation-frequency-v1", event: "positive_minutes", probability: 0, totals: true, recognized: true },
    { name: "totals denied", version: "skater-participation-frequency-v1", event: "positive_minutes", probability: 0.75, totals: false, recognized: true },
    { name: "absent metadata", version: null, event: "positive_minutes", probability: 0.75, totals: true, recognized: false },
    { name: "unknown version", version: "skater-participation-frequency-v2", event: "positive_minutes", probability: 0.75, totals: true, recognized: false },
    { name: "different event", version: "skater-participation-frequency-v1", event: "started", probability: 0.75, totals: true, recognized: false },
  ])("preserves only the public participation model contract and labels $name truthfully", ({ version, event, probability, totals, recognized }) => {
    const model = { version, event, probabilityStatus: "uncalibrated_model", calibration: "unavailable",
      inputHash: "a".repeat(64), evidenceHashes: ["b".repeat(64)], sampleSize: 20,
      limitations: ["Synthetic model is uncalibrated."], numerator: 15, denominator: 20,
      selectedGameIds: [1234], historyIDs: ["PRIVATE_HISTORY_SENTINEL"] };
    const input = { ...buildApiData(), contractVersion: 2,
      gameExpectations: { version: "forge-game-expectations-v1", readAsOf: "2026-02-07T17:00:00Z", basis: "per_appearance" },
      players: [player({ forecast: { participationProbability: totals ? probability : null },
        gameExpectation: { playerId: "7", scheduleRevision: "schedule-original", appearanceProbability: totals ? probability : null,
          targets: { GOALS: { expected: probability * 2, conditional: 2, basis: "per_appearance", unit: "count",
            allowedUses: { totals, comparison: totals, conditionalTieBreak: true }, participationRevisionId: "synthetic-participation",
            participation: { revisionId: "synthetic-participation", basis: "appearance", probability,
              cutoffAt: "2026-02-07T15:00:00Z", issuedAt: "2026-02-07T16:00:00Z", expiresAt: "2026-02-07T23:00:00Z",
              ...(version ? { model } : {}) } } } } })] };
    const original = JSON.stringify(input);
    swrState.data = normalizeStartChartResponse(input);
    const receipt = swrState.data.players[0].gameExpectation.targets.GOALS.participation;
    expect(receipt.probability).toBe(totals ? probability : null);
    if (recognized) expect(receipt.model).toEqual({ version, event: "positive_minutes",
      probabilityStatus: "uncalibrated_model", calibration: "unavailable",
      limitations: model.limitations, sampleSize: totals ? 20 : null });
    else expect(receipt.model).toBeUndefined();
    // Like the FORGE view, the board omits the per-target input and evidence proofs.
    expect(JSON.stringify(receipt)).not.toMatch(/numerator|denominator|selectedGameIds|historyIDs|PRIVATE_HISTORY_SENTINEL|inputHash|evidenceHashes/);
    expect(JSON.stringify(input)).toBe(original);
    render(<StartChartPage />);
    if (recognized) {
      expect(screen.getByText(/Participation model estimate · calibration unavailable/)).toBeTruthy();
      expect(screen.getByText(/Synthetic model is uncalibrated/)).toBeTruthy();
      if (totals) expect(screen.getByText(`Participation model estimate ${Math.round(probability * 100)}%`, { exact: true })).toBeTruthy();
      else expect(screen.getByText("Participation unknown", { exact: true })).toBeTruthy();
    } else {
      expect(screen.queryByText(/Participation model estimate/)).toBeNull();
      expect(screen.getByText(/Participation probability 75.*calibration unavailable/)).toBeTruthy();
    }
    expect(screen.queryByText("Confirmed out", { exact: true })).toBeNull();
  });

  it("labels independently admitted goalie starts as model estimates", () => {
    swrState.data = normalizeStartChartResponse({ ...buildApiData(), contractVersion: 2,
      gameExpectations: { version: "forge-game-expectations-v1", readAsOf: "2026-02-07T17:00:00Z", basis: "expected" },
      players: [player({ positions: ["G"], start_probability: 0.25,
        forecast: { participationProbability: 0.25, conditioning: "unconditional", expected: { SAVES_GOALIE: 10 } },
        gameExpectation: { playerId: "7", scheduleRevision: "synthetic-schedule", startProbability: 0.25,
          startParticipation: { revisionId: "synthetic-start", basis: "start", probability: 0.25,
            cutoffAt: "2026-02-07T15:00:00Z", issuedAt: "2026-02-07T16:00:00Z", expiresAt: "2026-02-07T23:00:00Z",
            model: { version: "goalie-frozen-window-start-frequency-v1", event: "official_starter", probabilityStatus: "uncalibrated_model",
              calibration: "unavailable", inputHash: "a".repeat(64), evidenceHashes: ["b".repeat(64)], sampleSize: 4,
              limitations: ["Synthetic finite start frequency."] } },
          targets: { SAVES_GOALIE: { expected: 10, conditional: 20, basis: "per_appearance", unit: "count",
            allowedUses: { totals: true, comparison: true, conditionalTieBreak: true } } } } })] });
    routerState.router.query = { position: "G" };
    render(<StartChartPage />);
    expect(screen.getByText("Start model estimate 25%", { exact: true })).toBeTruthy();
    expect(screen.getByText(/Starting probability 25.*model estimate · calibration unavailable/)).toBeTruthy();
    expect(screen.queryByText(/Confirmed start/)).toBeNull();
  });

  it("ranks goalies by the selected probability without requiring unavailable point totals", () => {
    const goalie = (id: number, probability: number | null) => player({
      player_id: id, row_key: `fixture:1001:${id}`, name: `Fixture goalie ${id}`, positions: ["G"],
      start_probability: probability, confirmed_status: false, proj_fantasy_points: null,
      forecast: { conditioning: "unconditional", participationProbability: probability,
        probabilityStatus: "uncalibrated_model", expected: { WINS_GOALIE: probability == null ? null : probability * 0.5 },
        conditional: null, distributionStatus: "means_only_unvalidated", evidence: [], conflicts: [] },
    });
    swrState.data = normalizeStartChartResponse({ ...buildApiData(), contractVersion: 2,
      players: [goalie(9001, 0.2), goalie(9002, 0.7), goalie(9003, null)],
    });
    routerState.router.query = { position: "G" };
    render(<StartChartPage />);
    const panel = document.getElementById("start-chart-panel-G")!;
    const rows = () => Array.from(panel.querySelectorAll("ol > li"));
    const order = () => rows().map(row => row.querySelector('a[href^="/forge/player/"]')?.textContent);
    expect(order()).toEqual(["Fixture goalie 9001", "Fixture goalie 9002", "Fixture goalie 9003"]);
    fireEvent.change(screen.getByLabelText("Goalie order"), { target: { value: "start_probability" } });
    expect(order()).toEqual(["Fixture goalie 9002", "Fixture goalie 9001", "Fixture goalie 9003"]);
    expect(rows().map(row => row.querySelector('[class*="playerRank"]')?.textContent)).toEqual(["1", "2", "—"]);
    expect(rows().every(row => row.querySelector('[class*="primaryProjection"] strong')?.textContent === "—")).toBe(true);
    expect(screen.queryByText(/Confirmed start/)).toBeNull();
    fireEvent.change(screen.getByLabelText("Compare"), { target: { value: "categories" } });
    expect((screen.getByLabelText("Category") as HTMLSelectElement).value).toBe("WINS_GOALIE");
    expect((screen.getByLabelText("Goalie order") as HTMLSelectElement).disabled).toBe(true);
    expect(order()).toEqual(["Fixture goalie 9002", "Fixture goalie 9001", "Fixture goalie 9003"]);
    fireEvent.change(screen.getByLabelText("Compare"), { target: { value: "points" } });
    fireEvent.change(screen.getByLabelText("Goalie order"), { target: { value: "fantasy" } });
    expect(order()).toEqual(["Fixture goalie 9001", "Fixture goalie 9002", "Fixture goalie 9003"]);
    expect(rows().map(row => row.querySelector('[class*="playerRank"]')?.textContent)).toEqual(["—", "—", "—"]);
  });

  it("re-scores custom points and ascending goalie categories without changing forecast inputs", () => {
    const forecast = (stats: Record<string, number>) => ({ conditioning: "unconditional", participationProbability: 0.5,
      probabilityStatus: "uncalibrated_model", expected: stats, conditional: null,
      distributionStatus: "means_only_unvalidated", evidence: [], conflicts: [] });
    const stats = { GOALS: 0, ASSISTS: 0, PP_POINTS: 0, SHOTS_ON_GOAL: 0, HITS: 0, BLOCKED_SHOTS: 0 };
    const goalieStats = { SAVES_GOALIE: 20, GOALS_AGAINST_GOALIE: 0, WINS_GOALIE: 0, SHUTOUTS_GOALIE: 0 };
    swrState.data = normalizeStartChartResponse({ ...buildApiData(), contractVersion: 2, players: [
      player({ player_id: 1, name: "Fixture goals skater", row_key: "fixture:1", forecast: forecast({ ...stats, GOALS: 1 }) }),
      player({ player_id: 2, name: "Fixture shots skater", row_key: "fixture:2", forecast: forecast({ ...stats, SHOTS_ON_GOAL: 20 }) }),
      player({ player_id: 3, name: "Fixture three GA goalie", row_key: "fixture:3", positions: ["G"], forecast: forecast({ ...goalieStats, GOALS_AGAINST_GOALIE: 3 }) }),
      player({ player_id: 4, name: "Fixture one GA goalie", row_key: "fixture:4", positions: ["G"], forecast: forecast({ ...goalieStats, GOALS_AGAINST_GOALIE: 1 }) }),
    ] });
    const original = JSON.stringify(swrState.data);
    routerState.router.query = { position: "C" };
    render(<StartChartPage />);
    const first = (position: string) => document.querySelector(`#start-chart-panel-${position} ol > li a[href^="/forge/player/"]`)?.textContent;
    expect(first("C")).toBe("Fixture shots skater");
    const form = screen.getByRole("button", { name: "Apply scoring" }).closest("form")!;
    for (const input of form.querySelectorAll<HTMLInputElement>('input[name^="skater."]')) {
      fireEvent.change(input, { target: { value: input.name === "skater.GOALS" ? "1" : "0" } });
    }
    fireEvent.submit(form);
    expect(first("C")).toBe("Fixture goals skater");
    const goalsWeight = form.querySelector<HTMLInputElement>('input[name="skater.GOALS"]')!;
    fireEvent.change(goalsWeight, { target: { value: "101" } });
    fireEvent.submit(form);
    expect(screen.getByRole("alert").textContent).toContain("Invalid scoring weight: GOALS");
    expect(first("C")).toBe("Fixture goals skater");
    fireEvent.click(screen.getByRole("tab", { name: /^G 2$/ }));
    fireEvent.change(screen.getByLabelText("Compare"), { target: { value: "categories" } });
    fireEvent.change(screen.getByLabelText("Category"), { target: { value: "GOALS_AGAINST_GOALIE" } });
    expect(first("G")).toBe("Fixture one GA goalie");
    expect(document.querySelector('#start-chart-panel-G ol > li [class*="primaryProjection"] strong')?.textContent).toBe("1.00");
    expect(JSON.stringify(swrState.data)).toBe(original);
  });

  it.each([
    { position: "C", probability: 0, status: "uncalibrated_model", outEvidence: false, label: "Modeled participation 0%", confirmedOut: false },
    { position: "C", probability: 0, status: "confirmed_evidence", outEvidence: true, label: "Confirmed out", confirmedOut: true },
    { position: "C", probability: null, status: "missing", outEvidence: false, label: "Participation unknown", confirmedOut: false },
    { position: "C", probability: 0.7, status: "uncalibrated_model", outEvidence: false, label: "Modeled participation 70%", confirmedOut: false },
    { position: "C", probability: 0, status: "confirmed_evidence", outEvidence: false, label: "Participation 0%", confirmedOut: false },
    { position: "G", probability: 0, status: "uncalibrated_model", outEvidence: false, label: "Start 0%", confirmedOut: false },
  ])("labels $position participation $probability from $status without inferring an exclusion", ({ position, probability, status, outEvidence, label, confirmedOut }) => {
    const stats = Object.fromEntries(BOARD_CATEGORIES.map(key => [key, 0]));
    swrState.data = normalizeStartChartResponse({ ...buildApiData(), contractVersion: 2, players: [player({
      positions: [position], start_probability: position === "G" ? probability : null, confirmed_status: false,
      forecast: { conditioning: "unconditional", participationProbability: probability, probabilityStatus: status,
        expected: probability == null ? null : stats, conditional: null,
        distributionStatus: "means_only_unvalidated", conflicts: [],
        evidence: outEvidence ? [{ dimension: "availability", value: "out", publishedAt: "2026-02-07T12:00:00Z", receivedAt: "2026-02-07T12:01:00Z" }] : [] },
    })] });
    const original = JSON.stringify(swrState.data);
    routerState.router.query = { position };
    render(<StartChartPage />);
    const row = document.querySelector(`#start-chart-panel-${position} ol > li`)!;
    expect(row.querySelector('[class*="uncertainty"]')?.textContent).toContain(label);
    expect(row.textContent?.includes("Confirmed out")).toBe(confirmedOut);
    expect(row.querySelector('[class*="playerRank"]')?.textContent).toBe(probability == null ? "—" : "1");
    expect(row.querySelector('[class*="primaryProjection"] strong')?.textContent).toBe(probability == null ? "—" : "0.00");
    expect(JSON.stringify(swrState.data)).toBe(original);
  });

  it("displays the versioned fantasy scoring formula supplied by the API", () => {
    render(<StartChartPage />);

    expect(
      screen.getByText(
        /Fixture scoring \[fixture-scoring-v9\] \(G=4, A=3, PPP=2, SOG=0\.33, HIT=0\.44, BLK=0\.55\)/,
      ),
    ).toBeTruthy();
  });

  it("keeps the early notice after thirty days when measured evidence is unavailable", () => {
    swrState.data = { ...buildApiData(), validation: buildBoardValidationDisclosure({ startedOn: "2026-10-01", liveRegularSlates: 24 }, "2026-10-31") };
    render(<StartChartPage />);
    fireEvent.click(screen.getByText("Early validation · FORGE retained pending review"));
    expect(screen.getByText(/day 31 · 24 live slates observed/)).toBeTruthy();
    expect(screen.getByText("Settled evaluation counts are not yet available.")).toBeTruthy();
    expect(screen.getByText(/Day 30 review · 2026-10-30 · due/)).toBeTruthy();
    expect(screen.getByText(/Calendar time alone does not establish calibration/)).toBeTruthy();
  });

  it("shows registry failure explicitly without claiming accuracy or calibration", () => {
    swrState.data = { ...buildApiData(), validation: buildBoardValidationDisclosure(null, "2026-10-31", true) };
    render(<StartChartPage />);
    expect(screen.getByText(/Validation records are temporarily unavailable/)).toBeTruthy();
    expect(screen.queryByText(/settled games across/)).toBeNull();
  });

  it("shows measured results while keeping an eligible challenger separate from the serving model", () => {
    const validation = buildBoardValidationDisclosure({ startedOn: "2026-10-01", liveRegularSlates: 30 }, "2026-10-31");
    swrState.data = { ...buildApiData(), validation: { ...validation, status: "review_available", evaluatedGames: 200,
      evaluatedSlates: 30, evaluatedForecasts: 1240, latestReview: { id: "review-1", kind: "day30", asOf: "2026-10-31T12:00:00Z",
        reportHash: "a".repeat(64), evidenceClass: "captured_live", gameType: "regular_season",
        metrics: [{ target: "participation", metric: "brier", value: 0.12, samples: 1240 }],
        decisions: [{ component: "participation", candidateId: "logistic-v1", decision: "eligible_for_promotion_review", reasons: [] }] } } };
    render(<StartChartPage />);
    fireEvent.click(screen.getByText("Early validation · FORGE retained · review available"));
    expect(screen.getByText(/200 settled games across 30 slates · 1240 evaluated forecasts/)).toBeTruthy();
    expect(screen.getByText(/Brier score: 0.120 \(1240 forecasts; lower is better\)/)).toBeTruthy();
    expect(screen.getByText(/candidate meets comparison gates; serving component remains in place/)).toBeTruthy();
    expect(screen.getByText(/Uncertainty ranges remain withheld until evaluated/)).toBeTruthy();
  });

  it("uses official images with stable placeholder and logo fallbacks", () => {
    swrState.data = { ...buildApiData(), players: [player()] };
    render(<StartChartPage />);
    const headshot = screen.getByRole("img", { name: "Nick Suzuki headshot" });
    expect(headshot.getAttribute("src")).toContain("assets.nhle.com/mugs/nhl/latest/");
    fireEvent.error(headshot);
    expect(headshot.getAttribute("src")).toContain("cms.nhl.bamgrid.com");
    fireEvent.error(headshot);
    expect(headshot.getAttribute("src")).toBe("/pictures/player-placeholder.jpg");
    const logo = screen.getByRole("img", { name: "MTL logo" });
    fireEvent.error(logo);
    expect(logo.getAttribute("src")).toBe("/teamLogos/FHFH.png");
    fireEvent.error(headshot);
    expect(screen.getByRole("img", { name: "Nick Suzuki headshot unavailable" })).toBeTruthy();
  });

  it("shows the publication time rather than a run UUID and opens real mobile settings", () => {
    swrState.data = buildApiData();
    render(<StartChartPage />);
    expect(screen.getByText("Feb 7, 7:00 AM EST")).toBeTruthy();
    expect(screen.queryByText("Up to date")).toBeNull();
    Element.prototype.scrollIntoView = vi.fn();
    fireEvent.click(screen.getByRole("button", { name: "Settings" }));
    expect(document.getElementById("board-settings")?.hasAttribute("open")).toBe(true);
  });

  it("changes the goals calculation with the selected window and reports missing teams", () => {
    swrState.data = { ...buildApiData(), recentGoals: { seasonId: 20252026, beforeDate: "2026-02-07", source: "nhl_final_scores", teams: [
      { team: "MTL", games: Array.from({ length: 10 }, (_, i) => ({ date: `2026-01-${20 - i}`, goalsFor: i < 5 ? 4 : 2, goalsAgainst: 1 })) },
      { team: "TOR", games: [] },
    ] } };
    render(<StartChartPage />);
    expect(screen.getByRole("img", { name: /Goals per game: MTL, 10 games, GF 3.00/ })).toBeTruthy();
    fireEvent.change(screen.getByLabelText("Team form window"), { target: { value: "5" } });
    expect(screen.getByRole("img", { name: /Goals per game: MTL, 5 games, GF 4.00/ })).toBeTruthy();
    expect(screen.getByText(/TOR: unavailable/)).toBeTruthy();
  });

  it("rebrands CTPI as plain-language recent team form", () => {
    swrState.data = {
      ...buildApiData(),
      ctpi: [
        { date: "2026-02-05", MTL: 48, TOR: 52 },
        { date: "2026-02-06", MTL: 55, TOR: 45 },
      ],
      games: [
        {
          id: 1001,
          date: "2026-02-07",
          startTime: null,
          homeTeamId: 10,
          awayTeamId: 8,
          homeAbbrev: "TOR",
          awayAbbrev: "MTL",
          homeGoalies: [],
          awayGoalies: [],
        },
      ],
    };

    render(<StartChartPage />);

    expect(
      screen.getByRole("heading", { name: "Recent Team Form" }),
    ).toBeTruthy();
    expect(
      screen.getByText(
        /How each team has been playing lately, compared with the league\. It combines recent offense, defense, goaltending, and special teams in one score\./,
      ),
    ).toBeTruthy();
    expect(screen.getByText("Context only — not a game prediction or ranking input"))
      .toBeTruthy();
    expect(
      screen.getByRole("img", { name: /Recent team form for TOR, MTL/ }),
    ).toBeTruthy();
    const legend = screen.getByRole("list", {
      name: "Latest team form by team",
    });
    expect(legend.textContent).toContain("TOR45Below league average");
    expect(legend.textContent).toContain("MTL55Above league average");
    expect(screen.queryByText("CTPI Pulse")).toBeNull();
  });

  it("explains why untrusted legacy team-form history is unavailable", () => {
    const message =
      "Recent team form is temporarily unavailable while its historical game data is being verified. It is hidden rather than show a misleading score.";
    swrState.data = {
      ...buildApiData(),
      sourceStatus: {
        ...readySourceStatus,
        ctpi: {
          ...readySourceStatus.ctpi,
          state: "missing",
          date: null,
          throughDate: null,
          trustedRows: 0,
          untrustedRows: 64,
          message,
        },
      },
    };

    render(<StartChartPage />);

    expect(screen.getByText(message)).toBeTruthy();
    expect(screen.getByText("Data through Unavailable")).toBeTruthy();
  });

  it("syncs date and position through the router while preserving workflow context", async () => {
    routerState.router.query = { date: "2026-02-07", mode: "week" };
    swrState.data = {
      ...buildApiData(),
      projections: 2,
      players: [
        player(),
        player({
          row_key: "run-123:1002:8478402:1",
          game_id: 1002,
          team_id: 52,
          team_abbrev: "WPG",
          opponent_team_id: 21,
          opponent_abbrev: "COL",
          proj_fantasy_points: 3.2,
          position_ranks: { C: 2 },
        }),
      ],
      ctpi: [
        { date: "2026-02-06", MTL: 55, TOR: 61, WPG: 58, COL: 64 },
      ],
      games: [
        {
          id: 1001,
          date: "2026-02-07",
          startTime: "2026-02-08T00:00:00Z",
          homeTeamId: 10,
          awayTeamId: 8,
          homeAbbrev: "TOR",
          awayAbbrev: "MTL",
          homeGoalies: [
            {
              player_id: 9001,
              name: "Home Goalie",
              start_probability: 0.72,
              projected_gsaa_per_60: 0.1,
              confirmed_status: false,
              source_updated_at: "2026-02-07T14:00:00Z",
              source_confidence: "high",
              is_stale: false,
            },
          ],
          awayGoalies: [],
        },
        {
          id: 1002,
          date: "2026-02-07",
          startTime: null,
          homeTeamId: 52,
          awayTeamId: 21,
          homeAbbrev: "WPG",
          awayAbbrev: "COL",
          homeGoalies: [],
          awayGoalies: [],
        },
      ],
    };

    render(<StartChartPage />);

    expect(screen.getAllByRole("link", { name: "Nick Suzuki" })[0]).toBeTruthy();
    expect(screen.getAllByRole("tab").map((tab) => tab.textContent)).toEqual(["LW0", "RW0", "C2", "D0", "G0"]);
    const games = screen.getByRole("region", { name: "Games on this slate" });
    const controls = screen.getByRole("region", { name: "Starter Board controls" });
    expect(games.compareDocumentPosition(controls) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(screen.getByRole("link", { name: /View Full Schedule/ }).getAttribute("href")).toBe("/game-grid/7-Day-Forecast");
    expect(screen.getByRole("link", { name: /^Game Grid Compare/ }).getAttribute("href")).toBe("/game-grid/7-Day-Forecast?startDate=2026-02-07&endDate=2026-02-13");
    expect(screen.getByRole("link", { name: /^Trends Dashboard Add/ }).getAttribute("href")).toBe("/trends?date=2026-02-07");
    expect(screen.getByRole("link", { name: /^Goalie View Cross/ }).getAttribute("href")).toBe("/variance/goalies");
    expect(screen.getByText(/League availability is not transferred/)).toBeTruthy();
    fireEvent.change(screen.getByLabelText("Slate team"), { target: { value: "MTL" } });
    expect(screen.getByRole("link", { name: /^Splits Open/ }).getAttribute("href")).toBe("/splits?team=MTL");
    expect(screen.getByRole("link", { name: /^Lines Validate/ }).getAttribute("href")).toBe("/lines/MTL");
    fireEvent.change(screen.getByLabelText("Slate team"), { target: { value: "" } });
    const gameFilter = screen.getByRole("button", {
      name: /MTL at TOR; apply game filter/,
    });
    fireEvent.click(gameFilter);
    expect(gameFilter.textContent).toContain("Selected");
    expect(screen.getAllByRole("link", { name: "Nick Suzuki" })).toHaveLength(1);
    fireEvent.click(screen.getByRole("button", { name: "Clear game filter" }));
    expect(screen.getAllByRole("link", { name: "Nick Suzuki" })).toHaveLength(2);
    fireEvent.click(screen.getByRole("button", { name: /MTL at TOR; apply game filter/ }));
    const teamHref = screen.getByRole("link", { name: "MTL" }).getAttribute("href");
    expect(teamHref).toContain("/forge/team/MTL");
    expect(teamHref).toContain("date=2026-02-07");
    expect(teamHref).toContain("resolvedDate=2026-02-07");
    expect(teamHref).toBe("/forge/team/MTL?date=2026-02-07&resolvedDate=2026-02-07");
    expect(screen.getByRole("link", { name: "Nick Suzuki" }).getAttribute("href")).toBe(`/forge/player/${player().player_id}?date=2026-02-07&resolvedDate=2026-02-07&mode=week`);
    expect(screen.getByText("Opp G Home Goalie · projected 72%")).toBeTruthy();
    expect(screen.getAllByText("NHL PTS range 2.10–6.40")).toHaveLength(1);
    expect(screen.getAllByText(/7:00 PM EST/)).toHaveLength(2);

    fireEvent.keyDown(screen.getByRole("tab", { name: /^C 1$/ }), {
      key: "ArrowRight",
    });
    expect(routerState.router.replace).toHaveBeenCalledWith(
      expect.objectContaining({
        query: expect.objectContaining({ position: "D" }),
      }),
      undefined,
      { shallow: true },
    );

    fireEvent.change(screen.getByLabelText("Date"), {
      target: { value: "2026-02-08" },
    });
    await waitFor(() =>
      expect(routerState.router.replace).toHaveBeenCalledWith(
        expect.objectContaining({
          query: expect.objectContaining({ date: "2026-02-08" }),
        }),
        undefined,
        { shallow: true },
      ),
    );
    fireEvent.click(screen.getByRole("button", { name: "Previous day" }));
    expect((screen.getByLabelText("Date") as HTMLInputElement).value).toBe("2026-02-07");
    fireEvent.click(screen.getByRole("button", { name: "Next day" }));
    expect((screen.getByLabelText("Date") as HTMLInputElement).value).toBe("2026-02-08");

    const href = screen
      .getByRole("link", { name: /FORGE Command Center/ })
      .getAttribute("href");
    expect(href).toContain("date=2026-02-08");
    expect(href).toContain("resolvedDate=2026-02-07");
    expect(href).toContain("position=D");
    expect(href).toContain("mode=week");
    expect(
      screen.getByRole("img", { name: /Recent team form/ }),
    ).toBeTruthy();
  });

  it("reconciles date, position, and team when router history changes", async () => {
    swrState.data = {
      ...buildApiData(),
      projections: 2,
      players: [
        player(),
        player({
          row_key: "run-123:1002:8478403:1",
          game_id: 1002,
          player_id: 8478403,
          name: "RW Fixture",
          positions: ["RW"],
          team_id: 52,
          team_abbrev: "WPG",
          opponent_team_id: 21,
          opponent_abbrev: "COL",
          position_ranks: { RW: 1 },
        }),
      ],
      games: [
        {
          id: 1001,
          date: "2026-02-07",
          startTime: null,
          homeTeamId: 10,
          awayTeamId: 8,
          homeAbbrev: "TOR",
          awayAbbrev: "MTL",
          homeGoalies: [],
          awayGoalies: [],
        },
        {
          id: 1002,
          date: "2026-02-07",
          startTime: null,
          homeTeamId: 52,
          awayTeamId: 21,
          homeAbbrev: "WPG",
          awayAbbrev: "COL",
          homeGoalies: [],
          awayGoalies: [],
        },
      ],
    };
    routerState.router.query = {
      date: "2026-02-07",
      position: "C",
      team: "MTL",
    };
    const view = render(<StartChartPage />);

    await waitFor(() => {
      expect((screen.getByLabelText("Date") as HTMLInputElement).value).toBe(
        "2026-02-07",
      );
      expect((screen.getByLabelText("Team") as HTMLSelectElement).value).toBe(
        "MTL",
      );
    });

    routerState.router.query = {
      date: "2026-02-08",
      position: "RW",
      team: "WPG",
    };
    view.rerender(<StartChartPage />);

    await waitFor(() => {
      expect((screen.getByLabelText("Date") as HTMLInputElement).value).toBe(
        "2026-02-08",
      );
      expect((screen.getByLabelText("Team") as HTMLSelectElement).value).toBe(
        "WPG",
      );
      expect(screen.getByRole("tab", { name: /^RW 1$/ }).getAttribute("aria-selected")).toBe(
        "true",
      );
    });
  });

  it("selects the first populated position when the query position is invalid", async () => {
    routerState.router.query = {
      date: "2026-02-07",
      position: "F",
    };
    swrState.data = {
      ...buildApiData(),
      projections: 1,
      players: [
        player({
          positions: ["RW"],
          position_ranks: { RW: 1 },
        }),
      ],
    };

    render(<StartChartPage />);

    await waitFor(() =>
      expect(
        screen.getByRole("tab", { name: /^RW 1$/ }).getAttribute("aria-selected"),
      ).toBe("true"),
    );
  });

  it.each([0.1, 1])("preserves projected goalie probability %s without inventing confirmation or redistributing missing mass", (probability) => {
    swrState.data = {
      ...buildApiData(),
      games: [
        {
          id: 1001,
          date: "2026-02-07",
          startTime: null,
          homeTeamId: 10,
          awayTeamId: 8,
          homeAbbrev: "TOR",
          awayAbbrev: "MTL",
          homeGoalies: Array.from({ length: 6 }, (_, index) => ({
            player_id: 9001 + index,
            name: index === 0 ? "Goalie One" : `Goalie ${index + 1}`,
            start_probability: index === 0 ? probability : probability === 1 ? null : 0.1,
            projected_gsaa_per_60: null,
            confirmed_status: false,
            source_updated_at: "2026-02-07T14:00:00Z",
            source_confidence: "medium",
            is_stale: false,
          })),
          awayGoalies: [
            {
              player_id: 9100,
              name: "Unknown Goalie",
              start_probability: null,
              projected_gsaa_per_60: null,
              confirmed_status: null,
              source_updated_at: null,
              source_confidence: null,
              is_stale: false,
            },
          ],
        },
      ],
    };

    render(<StartChartPage />);

    expect(screen.getByText(`Goalie One · Projected ${probability * 100}%`)).toBeTruthy();
    expect(screen.queryByText("Goalie One · Confirmed")).toBeNull();
    expect(screen.getByText("Unknown Goalie · Probability unavailable")).toBeTruthy();
  });

  it("never treats unknown ownership as zero when a numeric filter is active", () => {
    swrState.data = {
      ...buildApiData(),
      projections: 2,
      players: [
        player(),
        player({
          row_key: "run-123:1001:99:1",
          player_id: 99,
          name: "Unknown Ownership",
          ownership: null,
          percent_ownership: null,
          ownership_as_of_date: null,
          position_ranks: { C: 2 },
        }),
      ],
    };
    render(<StartChartPage />);

    expect(screen.getByText(/Unknown Ownership/)).toBeTruthy();
    fireEvent.change(screen.getByLabelText("All ownership"), {
      target: { value: "50" },
    });
    expect(screen.queryByText(/Unknown Ownership/)).toBeNull();
    expect(screen.getByText(/1 player was excluded/)).toBeTruthy();
  });

  it("counts unknown ownership only inside the active non-ownership filters", () => {
    swrState.data = {
      ...buildApiData(),
      projections: 3,
      players: [
        player({
          ownership: null,
          percent_ownership: null,
          ownership_as_of_date: null,
        }),
        player({
          row_key: "run-123:1002:99:1",
          game_id: 1002,
          player_id: 99,
          name: "Other Unknown",
          team_id: 52,
          team_abbrev: "WPG",
          ownership: null,
          percent_ownership: null,
          ownership_as_of_date: null,
          position_ranks: { C: 2 },
        }),
        player({
          row_key: "run-123:1001:100:1",
          player_id: 100,
          name: "Known Player",
          position_ranks: { C: 3 },
        }),
      ],
      games: [
        {
          id: 1001,
          date: "2026-02-07",
          startTime: null,
          homeTeamId: 10,
          awayTeamId: 8,
          homeAbbrev: "TOR",
          awayAbbrev: "MTL",
          homeGoalies: [],
          awayGoalies: [],
        },
        {
          id: 1002,
          date: "2026-02-07",
          startTime: null,
          homeTeamId: 21,
          awayTeamId: 52,
          homeAbbrev: "COL",
          awayAbbrev: "WPG",
          homeGoalies: [],
          awayGoalies: [],
        },
      ],
    };
    render(<StartChartPage />);

    fireEvent.click(screen.getByText("More Filters"));
    fireEvent.change(screen.getByLabelText("Team"), {
      target: { value: "MTL" },
    });
    fireEvent.change(screen.getByLabelText("All ownership"), {
      target: { value: "50" },
    });

    expect(screen.getByText(/1 player was excluded/)).toBeTruthy();
    expect(screen.queryByText(/2 players were excluded/)).toBeNull();
  });

  it("renders explicit fallback and degraded source messaging", () => {
    swrState.data = {
      ...buildApiData(),
      dateUsed: "2026-02-09",
      date: "2026-02-09",
      projections: 1,
      players: [player()],
      requestedDate: "2026-02-07",
      resolvedDate: "2026-02-09",
      fallbackApplied: true,
      serving: {
        mode: "fallback",
        message: "No games are scheduled for 2026-02-07. Showing the upcoming slate on 2026-02-09.",
        ageDays: 0,
      },
      sourceStatus: {
        ...readySourceStatus,
        overall: "degraded",
        projection: {
          ...readySourceStatus.projection,
          state: "partial",
          message: "Projection provenance is unverified.",
        },
        degradedReasons: ["missing_goalie_coverage"],
      },
    };
    render(<StartChartPage />);

    expect(screen.getByText("Showing 2026-02-09, not 2026-02-07.")).toBeTruthy();
    expect(screen.getByRole("status", { name: "Starter Board status" }).textContent).toContain("Upcoming slate");
    expect(screen.queryByText("Historical fallback")).toBeNull();
    expect(screen.getByRole("link", { name: "View Full Schedule · current" })).toBeTruthy();
    expect(screen.getByRole("link", { name: "7-day schedule from 2026-02-09" }).getAttribute("href")).toBe("/game-grid/7-Day-Forecast?startDate=2026-02-09&endDate=2026-02-15");
    expect(screen.getByRole("link", { name: /^Game Grid Compare/ }).getAttribute("href")).toBe("/game-grid/7-Day-Forecast?startDate=2026-02-09&endDate=2026-02-15");
    expect(screen.getByRole("link", { name: "Nick Suzuki" }).getAttribute("href")).toBe(`/forge/player/${player().player_id}?date=2026-02-07&resolvedDate=2026-02-09&mode=tonight`);
    expect(screen.getByRole("link", { name: "MTL" }).getAttribute("href")).toBe("/forge/team/MTL?date=2026-02-07&resolvedDate=2026-02-09");
    expect(
      screen.getByText(
        "No games are scheduled for 2026-02-07. Showing the upcoming slate on 2026-02-09. Projection provenance is unverified.",
      ),
    ).toBeTruthy();
  });

  it("shows null projection values as unavailable rather than zero", () => {
    swrState.data = {
      ...buildApiData(),
      projections: 1,
      players: [
        player({
          proj_fantasy_points: null,
          proj_goals: null,
          proj_assists: null,
          proj_shots: null,
          proj_pp_points: null,
          proj_hits: null,
          proj_blocks: null,
          proj_pim: null,
          proj_toi_minutes: null,
          games_remaining_week: null,
        }),
      ],
    };
    render(<StartChartPage />);

    expect(screen.getByText("Weekly volume unavailable")).toBeTruthy();
    expect(screen.getAllByText("—").length).toBeGreaterThan(0);
    expect(screen.queryByText("0 Games Remaining")).toBeNull();
    const row = screen.getByRole("link", { name: "Nick Suzuki" }).closest("li");
    expect(row?.querySelector('[class*="playerRank"]')?.textContent).toBe("—");
  });

  it("withholds cached values at their source deadline and recovers the selected category after a failed refresh", () => {
    vi.useRealTimers();
    vi.useFakeTimers({ toFake: ["Date", "setTimeout", "clearTimeout"] });
    vi.setSystemTime(new Date("2026-02-07T17:00:00Z"));
    const first = expiringExpectationData("2026-02-07", "2026-02-07T17:00:01Z");
    const original = JSON.stringify(first); swrState.data = first;
    const view = render(<StartChartPage />);
    expect(screen.getByText(/Point total unavailable: missing/)).toBeTruthy();
    fireEvent.change(screen.getByLabelText("Compare"), { target: { value: "categories" } });
    const value = () => document.querySelector('#start-chart-panel-C [class*="primaryProjection"] strong')?.textContent;
    expect((screen.getByLabelText("Category") as HTMLSelectElement).value).toBe("GOALS");
    expect(value()).toBe("1.00");
    expect(screen.getByText(/Synthetic expiring goalie · Projected 75%/)).toBeTruthy();
    expect(document.querySelector('#start-chart-panel-C [class*="playerRank"]')?.textContent).toBe("1");
    act(() => vi.advanceTimersByTime(1000));
    expect(screen.queryByText("Synthetic expiring player 2026-02-07", { exact: true })).toBeNull();
    expect(screen.queryByText(/Synthetic expiring goalie/)).toBeNull();
    expect(screen.getByRole("status", { name: "Starter Board status" }).textContent).toContain("Forecasts expired");
    expect(screen.getByRole("status", { name: "Forecast validity" }).textContent).toContain("Forecast values expired.");
    expect(screen.queryByText("No player projections found.")).toBeNull();
    expect(swrState.mutate).not.toHaveBeenCalled();
    swrState.error = new Error("fixture refresh failed"); view.rerender(<StartChartPage />);
    expect(screen.getByRole("alert").textContent).toContain("fixture refresh failed");
    fireEvent.click(screen.getByRole("button", { name: "Retry" }));
    expect(swrState.mutate).toHaveBeenCalledTimes(1);
    swrState.error = null; swrState.data = expiringExpectationData("2026-02-07", "2026-02-07T17:01:00Z", 0);
    view.rerender(<StartChartPage />);
    expect(screen.queryByRole("status", { name: "Forecast validity" })).toBeNull();
    expect((screen.getByLabelText("Category") as HTMLSelectElement).value).toBe("GOALS");
    expect(value()).toBe("0.00");
    expect(document.querySelector('#start-chart-panel-C [class*="playerRank"]')?.textContent).toBe("1");
    expect(JSON.stringify(first)).toBe(original);
  });

  it("clears the previous date's expiry timer through loading and a fresh date response", () => {
    vi.useRealTimers();
    vi.useFakeTimers({ toFake: ["Date", "setTimeout", "clearTimeout"] });
    vi.setSystemTime(new Date("2026-02-07T17:00:00Z"));
    swrState.data = expiringExpectationData("2026-02-07", "2026-02-07T17:00:01Z");
    const view = render(<StartChartPage />);
    fireEvent.change(screen.getByLabelText("Compare"), { target: { value: "categories" } });
    swrState.data = null; swrState.isLoading = true;
    fireEvent.change(screen.getByLabelText("Date"), { target: { value: "2026-02-08" } });
    expect(screen.getAllByText("Loading projections…")).toHaveLength(5);
    swrState.isLoading = false; swrState.data = expiringExpectationData("2026-02-08", "2026-02-07T17:00:30Z", 0);
    view.rerender(<StartChartPage />);
    act(() => vi.advanceTimersByTime(1000));
    expect((screen.getByLabelText("Date") as HTMLInputElement).value).toBe("2026-02-08");
    expect(swrState.request).toHaveBeenCalledWith("/api/v1/start-chart?date=2026-02-08");
    expect(screen.queryByText("Synthetic expiring player 2026-02-07", { exact: true })).toBeNull();
    expect(screen.getByText("Synthetic expiring player 2026-02-08", { exact: true })).toBeTruthy();
    expect(screen.queryByRole("status", { name: "Forecast validity" })).toBeNull();
    expect(document.querySelector('#start-chart-panel-C [class*="primaryProjection"] strong')?.textContent).toBe("0.00");
    expect(swrState.mutate).not.toHaveBeenCalled();
  });

  it("parity receipt (UI): renders the same per-appearance values the shared reader resolved for each player", () => {
    // Evidence class: retained-fixture replay through the API's board builder; mocked transport, current local UI.
    const now = new Date("2026-02-07T17:00:00Z");
    const scope = { seasonId: 20252026, startDate: "2026-02-07", endDate: "2026-02-07", timeZone: "America/New_York", mode: "calendar" as const, games: 1 };
    const data: PlanningData = { players: [7, 8].map(id => ({ id: String(id), nhlId: id * 11, nhlTeamId: 8, name: `Parity skater ${id}`,
      rosterRevision: `roster-${id}`, teamAbbreviation: "MTL", eligiblePositions: ["C"], playerClass: "skater", availability: "unknown",
      ownership: null, canDrop: null, holdValue: null, reserveEligibility: [] })),
      games: [{ id: "1001", date: scope.startDate, startsAt: "2026-02-07T23:00:00Z", teamAbbreviation: "MTL", opponent: "TOR",
        home: false, status: "scheduled", scheduleRevision: "schedule-original" }], forecasts: [],
      evidence: { schedule: { source: "synthetic", asOf: now.toISOString(), seasonId: scope.seasonId, completeness: "complete", limitations: [] } },
      baselineSources: [7, 8].flatMap(id => Object.entries({ GOALS: 1, ASSISTS: 2, PP_POINTS: 0, SHOTS_ON_GOAL: 3 }).map(([targetKey, mean]) => ({
        kind: "baseline" as const, sourceId: `parity:${id}:${targetKey}`, policyVersion: "native-fixture-v1", released: true,
        playerId: id, nhlPlayerId: id * 11, seasonId: scope.seasonId, teamId: 8, rosterRevision: `roster-${id}`, scheduleRevision: "catalog-original",
        targetKey, unit: "count" as const, basis: "per_appearance" as const, mean: mean * (id === 7 ? 1 : 2), participationIntegrated: false,
        cutoffAt: "2026-02-07T15:00:00Z", issuedAt: "2026-02-07T16:00:00Z", expiresAt: "2026-02-07T22:00:00Z", sourceWatermark: "parity-raw",
        allowedUses: { assignment: true, totals: true, comparison: true, conditionalTieBreak: true } }))) };
    const response = buildGameExpectations(data, scope, now);
    const wire = JSON.parse(JSON.stringify(scoreStartChartPayload(startChartFromGameExpectations(response), parseBoardScoringRequest({}))));
    swrState.data = normalizeStartChartResponse(wire);
    routerState.router.query = { position: "C" };
    render(<StartChartPage />);
    fireEvent.change(screen.getByLabelText("Compare"), { target: { value: "categories" } });
    for (const key of ["GOALS", "ASSISTS", "SHOTS_ON_GOAL"]) {
      fireEvent.change(screen.getByLabelText("Category"), { target: { value: key } });
      for (const player of response.players) {
        const target = player.games[0].targets[key];
        const row = screen.getByRole("link", { name: player.name }).closest("li");
        expect(row?.querySelector('[class*="primaryProjection"] strong')?.textContent, `${player.name} ${key}`)
          .toBe(target.conditional!.toFixed(2));
      }
    }
  });

  it("shows values until the exact expiry millisecond and withholds them at it", () => {
    vi.useRealTimers();
    vi.useFakeTimers({ toFake: ["Date", "setTimeout", "clearTimeout"] });
    vi.setSystemTime(new Date("2026-02-07T17:00:00.000Z"));
    swrState.data = expiringExpectationData("2026-02-07", "2026-02-07T17:00:00.250Z");
    render(<StartChartPage />);
    act(() => vi.advanceTimersByTime(249));
    expect(screen.getByText("Synthetic expiring player 2026-02-07", { exact: true })).toBeTruthy();
    expect(screen.queryByRole("status", { name: "Forecast validity" })).toBeNull();
    act(() => vi.advanceTimersByTime(1));
    expect(screen.queryByText("Synthetic expiring player 2026-02-07", { exact: true })).toBeNull();
    expect(screen.getByRole("status", { name: "Forecast validity" }).textContent).toContain("Forecast values expired.");
    expect(swrState.mutate).not.toHaveBeenCalled();
  });

  it("withholds an already-expired payload that arrives after a fresh one, then accepts a valid replacement", () => {
    vi.useRealTimers();
    vi.useFakeTimers({ toFake: ["Date", "setTimeout", "clearTimeout"] });
    vi.setSystemTime(new Date("2026-02-07T17:00:00Z"));
    swrState.data = expiringExpectationData("2026-02-07", "2026-02-07T17:05:00Z", 1);
    const view = render(<StartChartPage />);
    fireEvent.change(screen.getByLabelText("Compare"), { target: { value: "categories" } });
    const value = () => document.querySelector('#start-chart-panel-C [class*="primaryProjection"] strong')?.textContent;
    expect(value()).toBe("1.00");
    // A stale cached copy (already past its source expiry) wins a revalidation race.
    swrState.data = expiringExpectationData("2026-02-07", "2026-02-07T16:59:00Z", 3);
    view.rerender(<StartChartPage />);
    expect(screen.queryByText("Synthetic expiring player 2026-02-07", { exact: true })).toBeNull();
    expect(screen.getByRole("status", { name: "Forecast validity" }).textContent).toContain("Forecast values expired.");
    swrState.data = expiringExpectationData("2026-02-07", "2026-02-07T17:10:00Z", 2);
    view.rerender(<StartChartPage />);
    expect(screen.queryByRole("status", { name: "Forecast validity" })).toBeNull();
    expect(value()).toBe("2.00");
  });

  it("drops players a partial refresh no longer covers instead of keeping their previous values", () => {
    const payload = (names: string[], goals: number) => normalizeStartChartResponse({ ...buildApiData(), contractVersion: 2,
      serving: { mode: names.length > 1 ? "exact" : "partial", message: names.length > 1 ? null : "Partial refresh." },
      gameExpectations: { version: "forge-game-expectations-v1", readAsOf: new Date().toISOString(), basis: "expected",
        expiresAt: "2026-02-07T23:00:00Z" },
      players: names.map((name, index) => player({ row_key: `partial-${index}`, player_id: 8478400 + index, name,
        forecast: { conditioning: "unconditional", participationProbability: null, expected: { GOALS: goals } },
        gameExpectation: { playerId: String(70 + index), scheduleRevision: "schedule-partial", targets: { GOALS: {
          expected: goals, conditional: null, basis: "unconditional_game", unit: "count",
          allowedUses: { totals: true, comparison: true }, expiresAt: "2026-02-07T23:00:00Z" } } } })) });
    swrState.data = payload(["Partial kept", "Partial dropped"], 1);
    const view = render(<StartChartPage />);
    expect(screen.getByText("Partial dropped", { exact: true })).toBeTruthy();
    swrState.data = payload(["Partial kept"], 2);
    view.rerender(<StartChartPage />);
    expect(screen.queryByText("Partial dropped", { exact: true })).toBeNull();
    expect(screen.getByText("Partial kept", { exact: true })).toBeTruthy();
    fireEvent.change(screen.getByLabelText("Compare"), { target: { value: "categories" } });
    expect(document.querySelector('#start-chart-panel-C [class*="primaryProjection"] strong')?.textContent).toBe("2.00");
  });

  it.each([["2026-02-08T04:59:59.999Z", "2026-02-07"], ["2026-02-08T05:00:00.000Z", "2026-02-08"]])(
    "selects the Eastern slate date at %s", (now, expected) => {
      vi.setSystemTime(new Date(now));
      routerState.router.query = {};
      render(<StartChartPage />);
      expect((screen.getByLabelText("Date") as HTMLInputElement).value).toBe(expected);
      expect(swrState.request).toHaveBeenCalledWith(`/api/v1/start-chart?date=${expected}`);
    });

  it.each(["expected", "per_appearance"] as const)("withholds an already-expired %s response on first render and after changing comparison basis", basis => {
    swrState.data = expiringExpectationData("2026-02-07", "2026-02-07T16:59:59Z");
    swrState.data.gameExpectations.basis = basis;
    if (basis === "per_appearance") {
      const target = swrState.data.players[0].gameExpectation.targets.GOALS;
      target.expected = null; target.conditional = 1;
      target.allowedUses = { totals: false, comparison: false, conditionalTieBreak: true };
    }
    render(<StartChartPage />);
    expect(screen.getByRole("status", { name: "Forecast validity" })).toBeTruthy();
    expect(screen.queryByText("Synthetic expiring player 2026-02-07", { exact: true })).toBeNull();
    fireEvent.change(screen.getByLabelText("Comparison basis"), { target: { value: basis === "expected" ? "per_appearance" : "expected" } });
    expect(document.querySelectorAll('#start-chart-panel-C ol > li')).toHaveLength(0);
    fireEvent.click(screen.getByRole("button", { name: "Refresh forecasts" }));
    expect(swrState.mutate).toHaveBeenCalledTimes(1);
  });

  it("renders loading and fetch-error retry states explicitly", () => {
    swrState.data = null;
    swrState.isLoading = true;
    const view = render(<StartChartPage />);

    expect(screen.getAllByText("Loading projections…")).toHaveLength(5);
    const status = screen.getByRole("status", { name: "Starter Board status" });
    expect(status.textContent).toContain("Loading");

    swrState.isLoading = false;
    swrState.error = new Error("fixture request failed");
    view.rerender(<StartChartPage />);
    expect(screen.getByRole("status", { name: "Starter Board status" })).toBe(status);
    expect(status.textContent).toContain("Unavailable");
    expect(screen.getByText("Slate unavailable")).toBeTruthy();
    expect(screen.getByText("Games unavailable", { exact: true })).toBeTruthy();
    expect(screen.queryAllByText("Slate loading")).toHaveLength(0);
    expect(screen.getByRole("alert").textContent).toContain(
      "Starter Board is unavailable.",
    );
    fireEvent.click(screen.getByRole("button", { name: "Retry" }));
    expect(swrState.mutate).toHaveBeenCalledTimes(1);
  });

  it("distinguishes no-games and partial-projection empty states", () => {
    swrState.data = {
      ...buildApiData(),
      serving: {
        mode: "no_games",
        message: "No eligible same-season slate exists.",
      },
    };
    const view = render(<StartChartPage />);

    expect(screen.getByText("No games found.")).toBeTruthy();
    expect(screen.getByRole("status", { name: "Starter Board status" }).textContent).toContain("No scheduled games");
    expect(screen.getByText("No eligible same-season slate exists.")).toBeTruthy();

    swrState.data = {
      ...buildApiData(),
      serving: {
        mode: "partial",
        message: "Canonical rows are still pending.",
      },
      games: [
        {
          id: 1001,
          date: "2026-02-07",
          startTime: null,
          homeTeamId: 10,
          awayTeamId: 8,
          homeAbbrev: "TOR",
          awayAbbrev: "MTL",
          homeGoalies: [],
          awayGoalies: [],
        },
      ],
    };
    view.rerender(<StartChartPage />);

    expect(
      screen.getByText("This slate has incomplete source coverage."),
    ).toBeTruthy();
    expect(screen.getByText("No player projections found.")).toBeTruthy();
    expect(screen.getAllByText("Goalie TBD")).toHaveLength(2);
  });

  it("reveals all ranked rows and resets the position limit when filters change", () => {
    swrState.data = {
      ...buildApiData(),
      projections: 30,
      players: Array.from({ length: 30 }, (_, index) =>
        player({
          row_key: `run-123:1001:${index + 1}:1`,
          player_id: index + 1,
          name: `C Player ${index + 1}`,
          proj_fantasy_points: 6 - index / 100,
          position_ranks: { C: index + 1 },
        }),
      ),
    };
    render(<StartChartPage />);

    expect(screen.queryByText("C Player 30")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "View all C (30)" }));
    expect(screen.getByText("C Player 30")).toBeTruthy();

    fireEvent.change(screen.getByLabelText("Player"), {
      target: { value: "no match" },
    });
    fireEvent.change(screen.getByLabelText("Player"), {
      target: { value: "" },
    });
    expect(screen.queryByText("C Player 30")).toBeNull();
    expect(screen.getByRole("button", { name: "View all C (30)" })).toBeTruthy();
  });
});


describe("Start Chart historical goals", () => {
  it("excludes slate-day, future, prior-season, unfinished and invalid games", () => {
    const base = { season_id: 20252026, home_team_id: 8, away_team_id: 10, game_type: 2, game_state: "OFF", home_team_score: 3, away_team_score: 2, game_id: 100 };
    const rows = Array.from({ length: 12 }, (_, i) => ({ ...base, game_id: i + 1, game_date: `2026-01-${String(i + 1).padStart(2, "0")}` }));
    const games = selectTeamFormGames([...rows, rows[0],
      { ...base, game_date: "2026-02-07" }, { ...base, game_date: "2026-02-08" },
      { ...base, game_date: "2026-02-06", season_id: 20242025 },
      { ...base, game_date: "2026-02-05", game_state: "LIVE" }, { ...base, game_date: "2026-02-04", home_team_score: null },
      { ...base, game_date: "2026-02-03", home_team_id: 7 },
      { ...base, game_date: "2026-02-02", game_type: 1 },
    ], 20252026, "2026-02-07", 8);
    expect(games).toHaveLength(10);
    expect(games[0].date).toBe("2026-01-12");
    expect(games.at(-1)?.date).toBe("2026-01-03");
    const form = { seasonId: 20252026, beforeDate: "2026-02-07", source: "nhl_final_scores" as const, teams: [{ team: "MTL", games: [{ date: "2026-02-06", goalsFor: 8, goalsAgainst: 0 }, ...games] }] };
    expect(summarizeTeamForm(form, 5)[0]).toMatchObject({ games: 5, goalsFor: 4, goalsAgainst: 1.6 });
    expect(summarizeTeamForm(form, 10)[0].goalsFor).toBe(3.5);
  });
});
