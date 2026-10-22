import { webcrypto } from "node:crypto";
import { Blob as NodeBlob } from "node:buffer";
import { StrictMode } from "react";
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { BenchDecision, GameForecast, PlanEvaluation, PlanIntent, PlanStep, PlanningData, PlanningPlayer, PlanningResult, PlanningSnapshot } from "lib/rosterScheduleOptimizer/planningTypes";
import { WORKSPACE_KEY, WORKSPACE_PRESERVATION_JOURNAL, defaultWorkspace, preservationChecksum, readWorkspaceHistory, writeWorkspace, type WorkspacePreservation } from "lib/rosterScheduleOptimizer/workspace";
import { planRoster } from "lib/rosterScheduleOptimizer/planning";
import { resolveContribution } from "lib/player-forecasts/contributions";
import { forecastFromContributions } from "lib/player-forecasts/resolvedPlanningForecast";
import { saveWorkspaceSchema } from "lib/in-season/workspaceSchema";
import { useCanonicalSchedule } from "components/RosterScheduleOptimizer/canonicalSchedule";

const { authState, planningState } = vi.hoisted(() => ({ authState: { user: null as { id: string } | null, teams: [] as unknown[] }, planningState: { evaluate: null as null | ((snapshot: PlanningSnapshot, intent: PlanIntent) => PlanningResult) } }));
vi.mock("components/RosterScheduleOptimizer/canonicalSchedule", async importOriginal => ({ ...await importOriginal<typeof import("components/RosterScheduleOptimizer/canonicalSchedule")>(), useCanonicalSchedule: vi.fn(() => ({ games: [], teams: [], complete: false, error: "Isolated canonical calendar fixture" })) }));
vi.mock("contexts/AuthProviderContext", () => ({ useAuth: () => authState }));
vi.mock("lib/supabase/client", () => ({ default: { auth: { getSession: async () => ({ data: { session: authState.user ? { access_token: `token-${authState.user.id}` } : null } }) }, from: () => ({ select: () => ({ eq: async () => ({ data: authState.teams }) }) }) } }));
vi.mock("hooks/useRosterPlanning", () => ({ useRosterPlanning: (snapshot: PlanningSnapshot | null, intent: PlanIntent) => ({ result: snapshot && planningState.evaluate ? planningState.evaluate(snapshot, intent) : null, loading: false, error: null }) }));
import RosterScheduleOptimizer, { GoalieEvidence, grossAcquisitionGames, requestErrorMessage, acquisitionDetail, scheduleFreshnessWarning } from "components/RosterScheduleOptimizer/RosterScheduleOptimizer";
import ForecastEvidence, { forecastSummary } from "components/RosterScheduleOptimizer/ForecastEvidence";
import BenchDecisions from "components/RosterScheduleOptimizer/BenchDecisions";
import CandidateBrowser, { compareCandidateFits } from "components/RosterScheduleOptimizer/CandidateBrowser";
import CompactSchedule, { compactGroups, defaultScheduleDate, scheduleWeek, summarizeCompactDay } from "components/RosterScheduleOptimizer/CompactSchedule";
import RosterContribution from "components/RosterScheduleOptimizer/RosterContribution";
import CategoryGains from "components/RosterScheduleOptimizer/CategoryGains";

const player = { id: "fhfh:1", nhlId: 1, name: "Alpha Center", teamAbbreviation: "CAR", eligiblePositions: ["C"], playerClass: "skater" as const, availability: "unknown" as const, ownership: null, canDrop: null, holdValue: null, reserveEligibility: [] };
const data: PlanningData = { players: [player], games: [], forecasts: [], evidence: {} };
const fetchMock = vi.fn((url: string) => Promise.resolve({ ok: url.includes("/data?"), json: async () => ({ success: true, data }) }));
function planningTimeText(pattern: RegExp = /^(Updated|Saved) /) {
  const node = document.getElementById("rso-updated-at")!;
  expect(node.textContent).toMatch(pattern);
  return node;
}
function netPlan() {
  return Array.from(screen.getByLabelText("Net plan comparison").children)
    .map(cell => `${cell.querySelector("small")!.textContent} ${cell.querySelector("strong")!.textContent}`).join(" ");
}
function showByPlayer() {
  if (!screen.queryByText("Date controls")) fireEvent.click(screen.getByRole("button", { name: /Show (lineup by player|category lineup comparison)/ }));
}
function visibleScheduleSlider() {
  showByPlayer();
  const summary = screen.getByText("Date controls");
  if (!summary.closest("details")!.open) fireEvent.click(summary);
  return screen.getByRole("slider", { name: "Selected planning day" });
}
function visibleDaySummary() {
  showByPlayer();
  const summary = screen.getByText(/^Day capacity ·/);
  if (!summary.closest("details")!.open) fireEvent.click(summary);
  return screen.getByRole("region", { name: "Selected-day lineup summary" });
}
const benchReceipt: NonNullable<BenchDecision["evidence"]> = { startDate: "2026-10-05", endDate: "2026-10-06",
  lineupMode: "weekly", scoreBasis: "points_assignment", selectedScore: 27, withPlayerScore: 26, manifestId: "private-manifest-id",
  slotChanges: [{ date: "2026-10-05", slotId: "RW#1", selectedPlayerId: "knies", withPlayerId: "batherson" },
    { date: "2026-10-05", slotId: "UTIL#1", selectedPlayerId: "center", withPlayerId: "kaprizov" }], categories: [],
  sources: [{ playerId: "batherson", kinds: ["blended"], revisionIds: ["private-revision-id"],
    participation: [{ gameId: "game", basis: "appearance", probability: 0.5, confirmed: false }] }] };
afterEach(() => { cleanup(); window.localStorage.clear(); window.sessionStorage.clear(); vi.useRealTimers(); vi.unstubAllGlobals(); vi.restoreAllMocks(); fetchMock.mockClear(); authState.user = null; authState.teams = []; planningState.evaluate = null; });

describe("active provider refresh scheduling", () => {
  const success = (snapshot: PlanningSnapshot) => ({ ok: true, status: 200, json: async () => ({ success: true, snapshot,
    capabilities: { roster: true, availability: true, limitations: [] } }) });
  function setup(reply: (snapshot: PlanningSnapshot, read: number) => Promise<unknown> = async snapshot => success(snapshot), initiallyOnline = true, accountSnapshot = false, sharedData: (read: number) => PlanningData = () => data, accountSaves = false, manualOpponent: PlanningSnapshot["opponent"] = null, emptyIntent = false) {
    vi.useFakeTimers(); vi.setSystemTime(new Date("2026-10-11T12:00:00Z"));
    const network = vi.spyOn(navigator, "onLine", "get").mockReturnValue(initiallyOnline);
    const visibility = vi.spyOn(document, "visibilityState", "get").mockReturnValue("visible");
    authState.user = { id: "fixture-refresh-manager" };
    const workspace = defaultWorkspace();
    workspace.context = { ...workspace.context, provider: "yahoo", teamId: "fixture-team", leagueId: "fixture-league" };
    workspace.roster = [{ playerId: player.id, position: "active" }];
    workspace.manualPlayers = [player]; workspace.intent.protectedPlayerIds = [player.id];
    workspace.opponent = manualOpponent;
    workspace.intent.steps = emptyIntent ? [] : [{ id: "fixture-selected-add", type: "add", playerId: "fixture-candidate", at: `${workspace.context.startDate}T00:00:00Z`, effectiveAt: `${workspace.context.startDate}T00:00:00Z`, conditional: false, dependsOn: [] }];
    const snapshot: PlanningSnapshot = { id: "fixture-provider", context: workspace.context, players: [player], roster: workspace.roster,
      rules: workspace.rules, lockedAssignments: [], games: [], forecasts: [], realized: {}, opponent: null, evidence: {} };
    window.localStorage.setItem(WORKSPACE_KEY, JSON.stringify(workspace));
    let reads = 0, sharedReads = 0;
    vi.stubGlobal("fetch", vi.fn((url: string, init?: RequestInit) => {
      if (url.endsWith("/provider")) return reply(snapshot, ++reads);
      if (url.endsWith("/workspace") && init?.method === "PUT") {
        const body = JSON.parse(String(init.body));
        return Promise.resolve({ ok: true, status: 200, json: async () => ({ data: { workspace: body.workspace, snapshot: body.snapshot, version: 1, updatedAt: body.snapshot.context.asOf } }) });
      }
      return Promise.resolve({ ok: true, json: async () => url.includes("/data?") ? { success: true, data: sharedData(++sharedReads) }
        : url.endsWith("/access") ? { data: { eligible: true, capabilities: ["rso_sync", "rso_auto_upkeep", ...(accountSaves ? ["rso_account_save"] : [])] } }
          : { data: accountSnapshot ? { workspace, snapshot, version: 1, updatedAt: workspace.context.asOf } : null } });
    }));
    const view = render(<RosterScheduleOptimizer />);
    return { ...view, network, visibility, workspace, snapshot, reads: () => reads,
      saved: () => JSON.parse(window.localStorage.getItem(WORKSPACE_KEY)!) };
  }
  const advance = (ms = 0) => act(async () => { await vi.advanceTimersByTimeAsync(ms); });
  const returned = async () => { fireEvent(document, new Event("visibilitychange")); await advance(); };

  it("revalidates a held-open plan at catalog expiry without refreshing or changing saved intent", async () => {
    const evaluated: PlanningSnapshot[] = [];
    planningState.evaluate = (snapshot, intent) => { evaluated.push(snapshot); return planRoster(snapshot, intent); };
    const view = setup();
    view.snapshot.baselineSources = [{ kind: "baseline", sourceId: "original-rate", policyVersion: "fixture",
      released: true, playerId: 1, nhlPlayerId: 1, seasonId: view.workspace.context.seasonId, teamId: 1,
      targetKey: "GOALS", unit: "count", basis: "per_appearance", mean: 1, participationIntegrated: false,
      cutoffAt: "2026-10-11T10:00:00Z", issuedAt: "2026-10-11T11:00:00Z",
      expiresAt: "2026-10-11T13:00:00Z", catalogExpiresAt: "2026-10-11T12:00:01.000001Z",
      sourceWatermark: "original", scheduleRevision: "original", rosterRevision: "original" }];
    await advance();
    const saved = window.localStorage.getItem(WORKSPACE_KEY);
    const calls = vi.mocked(fetch).mock.calls.length;
    expect(evaluated.at(-1)?.context.asOf).toBe(view.snapshot.context.asOf);
    await advance(1000);
    expect(evaluated.at(-1)?.context.asOf).toBe(view.snapshot.context.asOf);
    await advance(1);
    expect(evaluated.at(-1)?.context.asOf).toBe("2026-10-11T12:00:01.001Z");
    expect(evaluated.at(-1)?.id).toContain(":expiry:");
    expect(evaluated.at(-1)?.baselineSources).toEqual(view.snapshot.baselineSources);
    expect(view.snapshot.context.asOf).toBe("2026-10-11T12:00:00.000Z");
    expect(window.localStorage.getItem(WORKSPACE_KEY)).toBe(saved);
    expect(vi.mocked(fetch).mock.calls).toHaveLength(calls);
  });

  it.each([false, true])("recovers a held-open expired catalog after a failed shared reload without changing selected intent (newer notice: %s)", async newerNotice => {
    const evaluated: PlanningSnapshot[] = [];
    planningState.evaluate = (snapshot, intent) => { evaluated.push(snapshot); return planRoster(snapshot, intent); };
    const originalRate = { kind: "baseline" as const, sourceId: "synthetic-original-rate", policyVersion: "fixture",
      released: true, playerId: 1, nhlPlayerId: 1, seasonId: 20262027, teamId: 1, targetKey: "GOALS",
      unit: "count" as const, basis: "per_appearance" as const, mean: 1, participationIntegrated: false,
      cutoffAt: "2026-10-11T10:00:00Z", issuedAt: "2026-10-11T11:00:00Z", expiresAt: "2026-10-11T13:00:00Z",
      catalogExpiresAt: "2026-10-11T12:00:01Z", sourceWatermark: "original", scheduleRevision: "original", rosterRevision: "original" };
    const replacement = { ...originalRate, sourceId: "synthetic-replacement-rate", mean: 0,
      issuedAt: "2026-10-11T12:00:01Z", catalogExpiresAt: "2026-10-11T12:05:00Z", sourceWatermark: "replacement" };
    let sharedReads = 0;
    const state = setup(undefined, true, false, read => {
      sharedReads = read;
      if (read === 2) throw new Error("Synthetic shared replacement unavailable");
      return read === 1 ? data : { ...data, baselineSources: [replacement], forecastManifest: {
        version: "planning-forecasts-v1", id: "synthetic-replacement-manifest", seasonId: 20262027,
        asOf: new Date().toISOString(), scheduleRevision: "synthetic", rosterRevision: "synthetic",
        issuedRevisionIds: [], baselineChecksum: "replacement", requiredOpportunities: 0,
        forecastedOpportunities: 0, exclusionCounts: {},
      } };
    });
    state.snapshot.baselineSources = [originalRate];
    const originalBytes = JSON.stringify(state.snapshot);
    await advance();
    const saved = JSON.stringify(state.saved()), calls = vi.mocked(fetch).mock.calls.length;
    await advance(999);
    expect(evaluated.at(-1)?.context.asOf).toBe(state.snapshot.context.asOf);
    await advance(1);
    expect(evaluated.at(-1)?.id).toContain(":expiry:");
    expect(vi.mocked(fetch).mock.calls).toHaveLength(calls);
    fireEvent.click(screen.getByRole("button", { name: "Reload shared forecasts" }));
    await advance();
    expect(sharedReads).toBe(2);
    expect(evaluated.at(-1)?.baselineSources).toEqual([originalRate]);
    expect(evaluated.at(-1)?.id).toContain(":expiry:");
    expect(screen.getByText("Synthetic shared replacement unavailable")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Reload shared forecasts" }));
    if (newerNotice) fireEvent.blur(screen.getByLabelText("Time zone"), { target: { value: "Invalid/Zone" } });
    await advance();
    expect(sharedReads).toBe(3);
    expect(evaluated.at(-1)?.baselineSources).toEqual([replacement]);
    expect(evaluated.at(-1)?.forecastManifest?.id).toBe("synthetic-replacement-manifest");
    expect(evaluated.at(-1)?.id).not.toContain(":expiry:");
    expect(screen.queryByText("Synthetic shared replacement unavailable")).toBeNull();
    if (newerNotice) expect(screen.getByText("Enter a valid IANA time zone, such as America/New_York.")).toBeTruthy();
    const replacementId = evaluated.at(-1)?.id;
    await advance(1);
    expect(evaluated.at(-1)?.id).toBe(replacementId);
    expect(state.reads()).toBe(1);
    expect(JSON.stringify(state.saved())).toBe(saved);
    expect(JSON.stringify(state.snapshot)).toBe(originalBytes);
  });

  it("keeps remaining schedule scope fixed across an expiry render after midnight until explicit refresh", async () => {
    planningState.evaluate = (snapshot, intent) => planRoster(snapshot, intent);
    const state = setup();
    state.snapshot.baselineSources = [{ kind: "baseline", sourceId: "original-clock", policyVersion: "fixture",
      released: true, playerId: 1, nhlPlayerId: 1, seasonId: state.workspace.context.seasonId, teamId: 1,
      targetKey: "GOALS", unit: "count", basis: "per_appearance", mean: 1, participationIntegrated: false,
      cutoffAt: "2026-10-11T10:00:00Z", issuedAt: "2026-10-11T11:00:00Z",
      expiresAt: "2026-10-11T13:00:00Z", catalogExpiresAt: "2026-10-11T12:00:01Z",
      sourceWatermark: "original", scheduleRevision: "original", rosterRevision: "original" }];
    await advance();
    const latest = () => vi.mocked(useCanonicalSchedule).mock.calls.filter(call => call[4]?.source === "cache").at(-1)!;
    const originalDates = [...latest()[0]], originalSources = JSON.stringify(state.snapshot.baselineSources);
    expect(originalDates.length).toBeGreaterThan(0);
    expect(latest()[5]).toBe(0);
    const saved = window.localStorage.getItem(WORKSPACE_KEY), calls = vi.mocked(fetch).mock.calls.length;
    vi.setSystemTime(new Date("2026-10-12T12:00:00Z"));
    await advance(1000);
    expect(latest()[0]).toEqual(originalDates);
    expect(latest()[5]).toBe(0);
    expect(vi.mocked(fetch).mock.calls).toHaveLength(calls);
    expect(window.localStorage.getItem(WORKSPACE_KEY)).toBe(saved);
    expect(JSON.stringify(state.snapshot.baselineSources)).toBe(originalSources);
    fireEvent.click(screen.getByRole("button", { name: "Reload shared forecasts" }));
    await advance();
    expect(latest()[0]).not.toEqual(originalDates);
    expect(latest()[5]).toEqual(expect.any(String));
    expect(state.reads()).toBe(1);
  });

  it("exports loaded provider evidence without requests or saved-plan changes", async () => {
    const view = setup(); await advance();
    vi.stubGlobal("Blob", NodeBlob);
    let exported: NodeBlob | null = null;
    const NativeURL = URL;
    const revoke = vi.fn();
    vi.stubGlobal("URL", class extends NativeURL {
      static createObjectURL(blob: Blob) { exported = blob as unknown as NodeBlob; return "blob:planning-evidence"; }
      static revokeObjectURL = revoke;
    });
    const click = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => undefined);
    const before = JSON.stringify(view.saved());
    const calls = vi.mocked(fetch).mock.calls.length;
    fireEvent.click(screen.getByText("Download planning evidence"));
    fireEvent.click(screen.getByRole("button", { name: "Download loaded inputs" }));
    const payload = JSON.parse(await exported!.text());
    expect(payload.version).toBe("rso-planning-evidence-v1");
    expect(payload.providerSnapshot).toEqual(view.snapshot);
    expect(payload.snapshot.context.asOf).toBe(view.snapshot.context.asOf);
    expect(payload.intent).toEqual(view.workspace.intent);
    expect(payload).not.toHaveProperty("access_token");
    expect(vi.mocked(fetch).mock.calls).toHaveLength(calls);
    expect(JSON.stringify(view.saved())).toBe(before);
    expect(click).toHaveBeenCalledTimes(1);
    expect(revoke).toHaveBeenCalledWith("blob:planning-evidence");
    expect(screen.getByText("Planning evidence download requested. Verify the file was saved.")).toBeTruthy();
  });

  it.each([null, { GOALS: 3 }])("preserves provider remaining %j when manual opponent remaining has no override", async remaining => {
    const evaluated: PlanningSnapshot[] = [];
    planningState.evaluate = (snapshot, intent) => { evaluated.push(snapshot); return planRoster(snapshot, intent); };
    setup(async snapshot => {
      snapshot.opponent = { roster: [], realized: {}, remaining };
      return success(snapshot);
    }, true, false, () => data, false, { roster: [], realized: {}, remaining: null });
    await advance();
    expect(evaluated.at(-1)?.opponent?.remaining).toEqual(remaining);
  });

  it("applies actual GOALS inputs to connected category results without changing provider evidence", async () => {
    const evaluated: PlanningSnapshot[] = [];
    planningState.evaluate = (snapshot, intent) => { evaluated.push(snapshot); return planRoster(snapshot, intent); };
    const scheduleEvidence = { schedule: { source: "Synthetic complete fixture calendar", asOf: "2026-10-11T12:00:00Z",
      seasonId: 20262027, completeness: "complete" as const, limitations: [] } };
    const state = setup(async snapshot => {
      snapshot.rules.scoring = { mode: "categories", weights: {}, categories: [{ key: "GOALS", direction: "higher" }] };
      const gameDate = snapshot.context.endDate, scheduledAt = `${gameDate}T20:00:00Z`;
      snapshot.players = [{ ...player, nhlTeamId: 1, rosterRevision: "fixture-roster", eligibilityVerified: true }];
      snapshot.games = [{ id: "category-game", date: gameDate, startsAt: scheduledAt,
        scheduleRevision: "fixture-schedule", teamAbbreviation: "CAR", opponent: "NYR", home: true, status: "scheduled" }];
      snapshot.forecasts = [{ playerId: player.id, gameId: "category-game", stats: { GOALS: 1 },
        conditioning: "unconditional", sourceKind: "detailed", sourceWatermark: "synthetic-only",
        cutoffAt: snapshot.context.asOf, issuedAt: snapshot.context.asOf, expiresAt: scheduledAt,
        revisionId: "fixture-revision", modelVersion: "fixture", startProbability: null, confirmedStart: false,
        allowedUses: { assignment: true, totals: true, comparison: true, conditionalTieBreak: false }, limitations: [],
        issuedContext: { version: "forge-issued-context-v1", playerId: player.id, gameId: "category-game",
          nhlPlayerId: 1, teamId: 1, seasonId: 20262027, scheduledAt,
          scheduleRevision: "fixture-schedule", rosterRevision: "fixture-roster", observedAt: snapshot.context.asOf,
          scheduleSourceUpdatedAt: snapshot.context.asOf, scheduleFetchedAt: snapshot.context.asOf,
          identityUpdatedAt: snapshot.context.asOf, membershipCreatedAt: ["2026-09-01T00:00:00Z"] } }];
      snapshot.opponent = { roster: [{ playerId: "provider-opponent", position: "active" }], realized: { GOALS: 2 }, remaining: { GOALS: 3 } };
      snapshot.evidence = scheduleEvidence;
      return success(snapshot);
    }, true, false, () => ({ ...data, evidence: scheduleEvidence }), false, null, true);
    await advance();
    const beforeId = evaluated.at(-1)!.id;
    fireEvent.click(screen.getAllByRole("button", { name: "Matchup" })[0]);
    const matchup = screen.getByRole("region", { name: /^Matchup$/ });
    expect(within(matchup).getByText("1 vs 5")).toBeTruthy();
    expect(within(matchup).getByText("loss")).toBeTruthy();
    fireEvent.click(screen.getByText("Manual matchup totals"));
    fireEvent.click(screen.getByRole("button", { name: "Add opponent totals" }));
    fireEvent.click(screen.getAllByRole("button", { name: "Add statistic" })[0]);
    const ownKey = screen.getByLabelText("Own realized statistic STAT");
    fireEvent.change(ownKey, { target: { value: "GOALS" } }); fireEvent.blur(ownKey);
    await advance();
    fireEvent.change(screen.getByLabelText("Own realized GOALS total"), { target: { value: "8" } });
    await advance();
    expect(within(matchup).getByText("9 vs 5")).toBeTruthy();
    expect(within(matchup).getByText("win")).toBeTruthy();
    fireEvent.click(screen.getAllByRole("button", { name: "Add statistic" })[1]);
    const opponentKey = screen.getByLabelText("Opponent realized statistic STAT");
    fireEvent.change(opponentKey, { target: { value: "GOALS" } }); fireEvent.blur(opponentKey);
    await advance();
    fireEvent.change(screen.getByLabelText("Opponent realized GOALS total"), { target: { value: "9" } });
    await advance();
    expect(within(matchup).getByText("9 vs 12")).toBeTruthy();
    expect(within(matchup).getByText("loss")).toBeTruthy();
    expect(evaluated.at(-1)?.realized).toEqual({ GOALS: 8 });
    expect(evaluated.at(-1)?.opponent).toEqual({ roster: state.snapshot.opponent!.roster,
      realized: { GOALS: 9 }, remaining: { GOALS: 3 } });
    expect(evaluated.at(-1)?.id).not.toBe(beforeId);
    expect(state.snapshot.realized).toEqual({});
    expect(state.snapshot.opponent!.realized).toEqual({ GOALS: 2 });
    expect(state.snapshot.opponent!.remaining).toEqual({ GOALS: 3 });
  });

  it("reloads a connected roster's shared forecasts without refreshing provider authority or changing intent", async () => {
    const evaluated: PlanningSnapshot[] = [];
    planningState.evaluate = (snapshot, intent) => { evaluated.push(snapshot); return planRoster(snapshot, intent); };
    const fixtureForecast: GameForecast = { playerId: player.id, gameId: "fixture-game", conditioning: "unconditional",
      stats: { GOALS: 7 }, revisionId: "synthetic-revision", issuedAt: "2026-10-11T12:00:30Z", modelVersion: "synthetic",
      startProbability: null, confirmedStart: false, limitations: ["Synthetic fixture only"] };
    let sharedReads = 0;
    const state = setup(undefined, true, false, read => {
      sharedReads = read;
      if (read === 3) throw new Error("Synthetic shared read failure");
      return { ...data, forecasts: read > 1 ? [fixtureForecast] : [], forecastManifest: {
        version: "planning-forecasts-v1", id: `synthetic-${read}`, seasonId: 20262027, asOf: new Date().toISOString(),
        scheduleRevision: "synthetic", rosterRevision: "synthetic", issuedRevisionIds: read > 1 ? [fixtureForecast.revisionId] : [],
        baselineChecksum: null, requiredOpportunities: 1, forecastedOpportunities: read > 1 ? 1 : 0, exclusionCounts: {},
      } };
    });
    await advance();
    expect(state.reads()).toBe(1);
    const original = state.saved();
    expect(vi.mocked(useCanonicalSchedule).mock.calls.filter(call => call[4]?.source === "cache").at(-1)?.[5]).toBe(0);
    await advance(60_000);
    expect(vi.mocked(useCanonicalSchedule).mock.calls.filter(call => call[4]?.source === "cache").at(-1)?.[5]).toBe(0);
    fireEvent.click(screen.getByRole("button", { name: "Reload shared forecasts" }));
    await advance();
    expect(vi.mocked(useCanonicalSchedule).mock.calls.filter(call => call[4]?.source === "cache").at(-1)?.[5]).toEqual(expect.any(String));
    expect(sharedReads).toBe(2);
    expect(evaluated.at(-1)?.forecastManifest?.id).toBe("synthetic-2");
    expect(evaluated.at(-1)?.forecasts).toEqual([fixtureForecast]);
    expect(evaluated.at(-1)?.roster).toEqual(state.snapshot.roster);
    expect(evaluated.at(-1)?.games).toEqual(state.snapshot.games);
    expect(evaluated.at(-1)?.evidence.roster).toBe(state.snapshot.evidence.roster);
    expect(state.reads()).toBe(1);
    expect(state.saved().intent).toEqual(original.intent);
    expect(state.saved().rules).toEqual(original.rules);
    expect(state.saved().lockedAssignments).toEqual(original.lockedAssignments);
    expect(screen.queryByRole("button", { name: "Reload schedule data" })).toBeNull();
    expect(screen.queryByRole("button", { name: "About reloading shared forecasts" })).toBeNull();
    const currentManifest = evaluated.at(-1)?.forecastManifest;
    fireEvent.click(screen.getByRole("button", { name: "Reload shared forecasts" }));
    await advance();
    expect(sharedReads).toBe(3);
    expect(evaluated.at(-1)?.forecastManifest).toBe(currentManifest);
    expect(evaluated.at(-1)?.forecasts).toEqual([fixtureForecast]);
    expect(state.reads()).toBe(1);
    expect(state.saved().intent).toEqual(original.intent);
  });

  it("passes the shared participation catalog through manual evaluation and save validation", async () => {
    const workspace = defaultWorkspace(new Date("2026-10-15T12:00:00Z"));
    localStorage.setItem(WORKSPACE_KEY, JSON.stringify(workspace));
    const catalog = [{ playerId: 1, nhlPlayerId: 1, seasonId: workspace.context.seasonId, gameId: 31, teamId: 6,
      basis: "appearance" as const, probability: 0.5, revisionId: "synthetic-participation", released: true,
      scheduleRevision: "synthetic-schedule", rosterRevision: "synthetic-roster", issuedAt: workspace.context.asOf,
      cutoffAt: workspace.context.asOf, expiresAt: "2026-10-20T00:00:00Z",
      allowedUses: { assignment: true, totals: false, comparison: false, conditionalTieBreak: true } }];
    const snapshots: PlanningSnapshot[] = [];
    planningState.evaluate = (snapshot, intent) => { snapshots.push(snapshot); return planRoster(snapshot, intent); };
    vi.stubGlobal("fetch", vi.fn(async (url: string) => ({ ok: true, json: async () => url.includes("/data?")
      ? { success: true, data: { ...data, participationSources: catalog } }
      : url.endsWith("/access") ? { data: { eligible: false, capabilities: [] } } : { data: null } })));
    render(<RosterScheduleOptimizer />);
    await waitFor(() => expect(snapshots.at(-1)?.participationSources).toEqual(catalog));
    const parsed = saveWorkspaceSchema.safeParse({ workspace: JSON.parse(localStorage.getItem(WORKSPACE_KEY)!), snapshot: snapshots.at(-1), expectedVersion: null });
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.snapshot?.participationSources).toEqual(catalog);
      expect(parsed.data.snapshot?.participationSources?.[0].allowedUses?.totals).toBe(false);
    }
  });

  it("saves a shared-reloaded connected workspace with coherent evaluation time and unchanged manager/provider state", async () => {
    const state = setup(async snapshot => {
      snapshot.evidence.roster = { source: "Synthetic provider", asOf: snapshot.context.asOf,
        seasonId: snapshot.context.seasonId, completeness: "complete", limitations: [] };
      return success(snapshot);
    }, true, false, read => ({ ...data, forecastManifest: {
      version: "planning-forecasts-v1", id: `synthetic-${read}`, seasonId: 20262027, asOf: new Date().toISOString(),
      scheduleRevision: "synthetic", rosterRevision: "synthetic", issuedRevisionIds: [], baselineChecksum: null,
      requiredOpportunities: 0, forecastedOpportunities: 0, exclusionCounts: {},
    } }), true);
    await advance();
    const original = state.saved();
    await advance(60_000);
    fireEvent.click(screen.getByRole("button", { name: "Reload shared forecasts" }));
    await advance();
    fireEvent.click(screen.getByRole("button", { name: "Save to account" }));
    await advance();
    const saves = vi.mocked(fetch).mock.calls.filter(([url, init]) => String(url).endsWith("/workspace") && init?.method === "PUT");
    expect(saves).toHaveLength(1);
    const submitted = JSON.parse(String(saves[0][1]?.body));
    expect(submitted.workspace.context).toEqual(submitted.snapshot.context);
    expect(submitted.workspace.context.asOf).toBe("2026-10-11T12:01:00.000Z");
    expect(submitted.snapshot.forecastManifest.id).toBe("synthetic-2");
    expect(submitted.workspace.intent).toEqual(original.intent);
    expect(submitted.workspace.rules).toEqual(original.rules);
    expect(submitted.workspace.lockedAssignments).toEqual(original.lockedAssignments);
    expect(submitted.snapshot.roster).toEqual(state.snapshot.roster);
    expect(submitted.snapshot.rules).toEqual(state.snapshot.rules);
    expect(submitted.snapshot.evidence).toMatchObject(state.snapshot.evidence);
    expect(submitted.snapshot.evidence.roster.asOf).toBe(state.snapshot.context.asOf);
    expect(submitted.snapshot.evidence.roster.asOf).not.toBe(submitted.snapshot.context.asOf);
    expect(state.saved()).toEqual(original);
    expect(state.reads()).toBe(1);
    expect(screen.getByText("Saved to account.")).toBeTruthy();
    expect(saveWorkspaceSchema.safeParse(submitted).success).toBe(true);
  });

  it("keeps connected and saved snapshot schedules outside the shared-cache reload action", async () => {
    const state = setup(undefined, false, true);
    await advance();
    expect(screen.queryByRole("button", { name: "Reload schedule data" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "View account save" }));
    await advance();
    expect(screen.queryByRole("button", { name: "Reload schedule data" })).toBeNull();
    expect(state.reads()).toBe(0);
    expect(state.saved().intent).toEqual(state.workspace.intent);
  });

  it("makes no offline provider calls, pauses hidden polling and refreshes only a stale return", async () => {
    const state = setup(undefined, false); await advance(); expect(state.reads()).toBe(0);
    state.network.mockReturnValue(true); fireEvent(window, new Event("online")); await advance(); expect(state.reads()).toBe(1);
    await returned(); await returned(); expect(state.reads()).toBe(1);
    state.visibility.mockReturnValue("hidden"); await returned(); await advance(60 * 60_000); expect(state.reads()).toBe(1);
    state.visibility.mockReturnValue("visible"); await returned(); expect(state.reads()).toBe(2);
    state.network.mockReturnValue(false); fireEvent(window, new Event("offline")); await advance(10 * 60_000); expect(state.reads()).toBe(2);
    expect((screen.getByRole("button", { name: "Refresh provider" }) as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByText(/You are offline/)).toBeTruthy();
    state.network.mockReturnValue(true); fireEvent(window, new Event("online")); await advance();
    expect(state.reads()).toBe(3); expect(state.saved().intent).toEqual(state.workspace.intent);
  });
  it("honors a Retry-After longer than the backoff across explicit refresh and visibility returns", async () => {
    const state = setup(async (snapshot, read) => read === 1 ? { ok: false, status: 429,
      json: async () => ({ success: false, code: "yahoo_rate_limited", retryAfterSeconds: 3600, error: "Yahoo asked us to slow down." }) } : success(snapshot));
    await advance(); expect(state.reads()).toBe(1);
    fireEvent.click(screen.getByRole("button", { name: "Refresh provider" })); await advance();
    expect(screen.getByText(/Provider refresh is paused until/)).toBeTruthy();
    await returned(); await advance(3_599_999); expect(state.reads()).toBe(1);
    await advance(1); expect(state.reads()).toBe(2);
    await advance(5 * 60_000); expect(state.reads()).toBe(3); expect(state.saved().intent).toEqual(state.workspace.intent);
  });
  it("keeps partial facts and nonzero intent without treating a throttled partial response as fresh", async () => {
    const state = setup(async (snapshot, read) => read === 1 ? { ok: true, status: 200,
      json: async () => ({ success: true, snapshot, capabilities: { roster: true, availability: false, limitations: [] },
        code: "yahoo_rate_limited", retryAfterSeconds: 1200 }) } : success(snapshot));
    await advance(); expect(screen.getByText(/Provider inputs partly refreshed/)).toBeTruthy();
    expect(state.saved().intent).toEqual(state.workspace.intent);
    await advance(5 * 60_000); await returned(); expect(state.reads()).toBe(1);
    await advance(15 * 60_000); expect(state.reads()).toBe(2);
    await advance(5 * 60_000); expect(state.reads()).toBe(3);
  });
  it("backs off partial discovery without inventing a rate-limit value", async () => {
    const state = setup(async (snapshot, read) => read === 1 ? { ok: true, status: 200,
      json: async () => ({ success: true, snapshot, capabilities: { roster: true, availability: false, limitations: [] } }) } : success(snapshot));
    await advance(); await advance(5 * 60_000); await returned(); expect(state.reads()).toBe(1);
    await advance(5 * 60_000); expect(state.reads()).toBe(2);
  });
  it("pauses automatic permission retries and resumes polling after an explicit successful retry", async () => {
    const state = setup(async (snapshot, read) => read === 1 ? { ok: false, status: 403,
      json: async () => ({ success: false, code: "yahoo_access_denied", error: "Reconnect Yahoo and verify league access." }) } : success(snapshot));
    await advance(); await advance(60 * 60_000); await returned(); expect(state.reads()).toBe(1);
    fireEvent.click(screen.getByRole("button", { name: "Refresh provider" })); await advance(); expect(state.reads()).toBe(2);
    await advance(5 * 60_000); expect(state.reads()).toBe(3);
  });
  it("shares one in-flight request across return events and keeps deliberate Undo intent", async () => {
    let release!: (response: unknown) => void;
    const state = setup(async (snapshot, read) => read === 1 ? success(snapshot) : new Promise(resolve => { release = resolve; }));
    await advance(); fireEvent.change(screen.getByRole("combobox", { name: "Goalie choice" }), { target: { value: "cover" } });
    const p2 = state.saved().intent;
    fireEvent.click(screen.getByRole("button", { name: "Refresh provider" })); await advance();
    await returned(); await returned(); expect(state.reads()).toBe(2);
    await act(async () => release(success({ ...state.snapshot, context: { ...state.snapshot.context, asOf: "2026-10-11T12:01:00Z" } })));
    await advance(); expect(state.saved().intent).toEqual(p2);
    fireEvent.click(screen.getByRole("button", { name: "Undo" }));
    expect(state.saved().intent.steps).toEqual(state.workspace.intent.steps);
    expect(state.saved().intent.goalieCoverage).toBe(state.workspace.intent.goalieCoverage);
    expect(state.saved().context.asOf).toBe("2026-10-11T12:01:00Z");
  });
  it("does not let an old account response impose a cooldown on the current account", async () => {
    let release!: (response: unknown) => void;
    const state = setup(async (snapshot, read) => read === 1 ? new Promise(resolve => { release = resolve; }) : success(snapshot));
    await advance(); expect(state.reads()).toBe(1);
    authState.user = { id: "fixture-other-manager" }; state.rerender(<RosterScheduleOptimizer />); await advance();
    expect(state.reads()).toBe(2);
    await act(async () => release({ ok: false, status: 429, json: async () => ({ success: false, code: "yahoo_rate_limited", retryAfterSeconds: 3600, error: "Old account response." }) }));
    await advance(); await advance(5 * 60_000); expect(state.reads()).toBe(3);
    expect(screen.queryByText("Old account response.")).toBeNull();
  });
  it.each(["", "   "])("does not schedule zero-delay refreshes after clearing the team to %j", async teamId => {
    const state = setup(); await advance(); expect(state.reads()).toBe(1);
    const timers = vi.getTimerCount();
    fireEvent.change(screen.getByRole("textbox", { name: "Team ID" }), { target: { value: teamId } });
    await advance(10);
    expect(state.reads()).toBe(1);
    expect(vi.getTimerCount()).toBeLessThan(timers);
    expect(screen.getByText("Select an owned team before refreshing provider inputs.")).toBeTruthy();
    expect(state.saved().intent).toEqual(state.workspace.intent);
  });
  it.each([
    { status: 429, code: "yahoo_rate_limited", retryAfterSeconds: 3600 },
    { status: 401, code: "yahoo_reauth_required", retryAfterSeconds: undefined },
    { status: 403, code: "yahoo_access_denied", retryAfterSeconds: undefined },
  ])("keeps the current context's $status block when a retired refresh settles", async ({ status, code, retryAfterSeconds }) => {
    let release!: (response: unknown) => void;
    const state = setup(async (snapshot, read) => read === 1 ? new Promise(resolve => { release = resolve; })
      : read === 2 ? { ok: false, status, json: async () => ({ success: false, code, retryAfterSeconds, error: "Current context is paused." }) }
        : success({ ...snapshot, context: { ...snapshot.context, teamId: "fixture-next-team" } }));
    await advance(); expect(state.reads()).toBe(1);
    fireEvent.change(screen.getByRole("textbox", { name: "Team ID" }), { target: { value: "fixture-next-team" } });
    await advance(); expect(state.reads()).toBe(2);
    await act(async () => release(success(state.snapshot))); await advance();
    await returned(); expect(state.reads()).toBe(2);
    if (status === 429) {
      await advance(3_599_999); expect(state.reads()).toBe(2);
      await advance(1); expect(state.reads()).toBe(3);
    } else {
      await advance(60 * 60_000); await returned(); expect(state.reads()).toBe(2);
      fireEvent.click(screen.getByRole("button", { name: "Refresh provider" })); await advance();
      expect(state.reads()).toBe(3);
    }
    expect(state.saved().context.teamId).toBe("fixture-next-team");
    expect(state.saved().intent).toEqual(state.workspace.intent);
  });
  it("does not refresh an account snapshot opened read-only even when sync access is active", async () => {
    const state = setup(undefined, true, true); await advance(); expect(state.reads()).toBe(1);
    fireEvent.click(screen.getByRole("button", { name: "View account save" })); await advance();
    const retained = state.saved();
    await advance(60 * 60_000); await returned(); expect(state.reads()).toBe(1);
    expect(state.saved()).toEqual(retained);
    expect((screen.getByRole("button", { name: "Refresh provider" }) as HTMLButtonElement).disabled).toBe(true);
  });
});

describe("provisional schedule freshness warnings", () => {
  const context = { ...defaultWorkspace().context, startDate: "2026-10-10", endDate: "2026-10-10", asOf: "2026-10-10T15:00:00Z" };
  const evidence = (asOf: string | null) => ({ source: "roster_optimizer_team_games", asOf, seasonId: 20262027, completeness: "complete" as const, limitations: [] });
  const game = (startsAt: string, overrides: Partial<PlanningData["games"][number]> = {}) => ({ id: "freshness-game", date: "2026-10-10", startsAt, teamAbbreviation: "CAR", opponent: "NJD", home: true, status: "scheduled" as const, ...overrides });
  it.each([
    ["2026-10-10T09:00:00Z", [], null],
    ["2026-10-10T08:59:59Z", [], "Provisional 6-hour schedule warning."],
    ["2026-10-10T13:00:00Z", [game("2026-10-10T17:00:00Z")], null],
    ["2026-10-10T12:59:59Z", [game("2026-10-10T17:00:00Z")], "Provisional 2-hour schedule warning."],
    ["2026-10-10T12:59:59Z", [game("2026-10-10T15:00:00Z")], "Provisional 2-hour schedule warning."],
    ["2026-10-10T12:59:59Z", [game("2026-10-10T17:00:01Z")], null],
    ["2026-10-10T12:59:59Z", [game("2026-10-10T14:59:59Z")], null],
    ["2026-10-10T12:59:59Z", [game("2026-10-10T16:00:00Z", { status: "postponed" })], null],
    ["2026-10-10T12:59:59Z", [game("2026-10-10T16:00:00Z", { date: "2026-10-11" })], null],
    [null, [], "Schedule cache receipt age unknown."],
    ["invalid", [], "Schedule cache receipt age unknown."],
    ["2026-10-10T15:00:01Z", [], "Schedule cache receipt age unknown."],
  ])("keeps input-age and near-game boundaries explicit: %s", (asOf, games, warning) => {
    const input = evidence(asOf as string | null);
    expect(scheduleFreshnessWarning(input, games as PlanningData["games"], context)).toBe(warning);
    expect(input.completeness).toBe("complete");
    expect(input.limitations).toEqual([]);
  });
  it("does not infer receipt age from a different source or invalid evaluation time", () => {
    expect(scheduleFreshnessWarning({ ...evidence("2026-10-01T00:00:00Z"), source: "other-source" }, [], context)).toBeNull();
    expect(scheduleFreshnessWarning(undefined, [], context)).toBeNull();
    expect(scheduleFreshnessWarning(evidence("2026-10-10T12:00:00Z"), [], { ...context, asOf: "invalid" })).toBe("Schedule cache receipt age unknown.");
  });
});

describe("provisional similar projected points display", () => {
  const scoring = { mode: "points" as const, weights: { GOALS: 1 }, categories: [] };
  const evaluated = (value: number | null, overrides: Partial<PlanEvaluation> = {}) => ({
    legal: true, budgetVerified: true, comparisonEligible: true, forecastManifestId: "same-horizon",
    projectedValue: value, projectedStats: { GOALS: 9999 }, ...overrides,
  } as PlanEvaluation);
  it.each([
    [95, 100, true], [94, 100, false], [0, 0, true], [0, 1, false],
    [-100, -95, true], [-100, 100, false],
    [1e-300, 0.96e-300, true], [1e-300, 0.5e-300, false],
    [Number.MAX_VALUE, Number.MAX_VALUE * 0.97, true], [Number.MAX_VALUE, -Number.MAX_VALUE, false],
  ])("compares startable plan totals %s and %s safely", (before, after, similar) => {
    render(<CategoryGains baseline={evaluated(before as number)} plan={evaluated(after as number)}
      scoring={scoring} label="Selected plan" reviewed />);
    expect(Boolean(screen.queryByText(/Similar projected points · provisional 5% display rule/))).toBe(similar);
    expect(screen.getByText(/Absolute point difference/)).toBeTruthy();
    expect(screen.getByText(/larger absolute plan total/)).toBeTruthy();
    expect(screen.getByText(/not a confidence interval or an automatic decision/)).toBeTruthy();
    expect(screen.queryByText(/Infinity|NaN|9,999/)).toBeNull();
    if (before === 1e-300) expect(screen.getByText(/Absolute point difference/).textContent).toMatch(/E-30[12]/);
  });
  it.each([
    [null, 0, {}], [NaN, 0, {}], [Infinity, 0, {}],
    [95, 100, { comparisonEligible: false }], [95, 100, { forecastManifestId: "different-horizon" }],
  ])("withholds unsupported or mismatched comparison %s / %s", (before, after, overrides) => {
    render(<CategoryGains baseline={evaluated(before as number | null)}
      plan={evaluated(after as number, overrides as Partial<PlanEvaluation>)} scoring={scoring} label="Selected plan" reviewed />);
    expect(screen.getByText(/Projected points comparison unavailable/)).toBeTruthy();
    expect(screen.queryByText(/Similar projected points|Absolute point difference/)).toBeNull();
  });
});

describe("RosterScheduleOptimizer workspace", () => {
  it("loads planning data and settles access after development effect replay", async () => {
    authState.user = { id: "strict-mode-manager" };
    const requests = vi.fn((url: string) => Promise.resolve({ ok: true, json: async () => ({ success: true,
      data: url.includes("/data?") ? data : url.endsWith("/access") ? { eligible: true, capabilities: ["rso_sync"] } : null }) }));
    vi.stubGlobal("fetch", requests);
    render(<StrictMode><RosterScheduleOptimizer /></StrictMode>);
    await waitFor(() => expect(requests.mock.calls.some(([url]) => url.includes("/data?"))).toBe(true));
    await waitFor(() => expect(requests.mock.calls.some(([url]) => url.endsWith("/access"))).toBe(true));
    await waitFor(() => expect(screen.queryByText("Checking access for provider synchronization…")).toBeNull());
    expect(screen.queryByText("Preservation has suspended application requests.")).toBeNull();
  });
  it("keeps an existing preservation journal held during development effect replay", async () => {
    const original = JSON.stringify(defaultWorkspace());
    localStorage.setItem(WORKSPACE_KEY, original);
    sessionStorage.setItem(WORKSPACE_PRESERVATION_JOURNAL, "unreadable journal");
    const requests = vi.fn(); vi.stubGlobal("fetch", requests);
    render(<StrictMode><RosterScheduleOptimizer /></StrictMode>);
    await screen.findByText(/Saved preservation session found/);
    expect(requests).not.toHaveBeenCalled();
    expect(localStorage.getItem(WORKSPACE_KEY)).toBe(original);
    expect(sessionStorage.getItem(WORKSPACE_PRESERVATION_JOURNAL)).toBe("unreadable journal");
  });
  const seedFutureDisplayWorkspace = () => {
    vi.stubGlobal("fetch", fetchMock);
    vi.stubGlobal("innerWidth", 1440);
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-10-07T12:00:00Z"));
    authState.user = { id: "display-owner-a" };
    planningState.evaluate = planRoster;
    const workspace = defaultWorkspace();
    workspace.context = { ...workspace.context, leagueId: "display-league-a", teamId: "display-team-a", timeZone: "UTC", startDate: "2026-10-12", endDate: "2026-10-18" };
    workspace.manualPlayers = [{ ...player, eligibilityVerified: true }];
    workspace.roster = [{ playerId: player.id, position: "active" }];
    workspace.intent.protectedPlayerIds = [player.id];
    workspace.lockedAssignments = [{ date: "2026-10-15", playerId: player.id, slotId: "C#1" }];
    window.localStorage.setItem(WORKSPACE_KEY, JSON.stringify(workspace));
    return workspace;
  };
  it.each(["owner", "league", "team", "horizon", "timezone"] as const)("resumes a display day without aliasing a different %s or rewriting the plan", async scope => {
    const workspace = seedFutureDisplayWorkspace();
    let view = render(<RosterScheduleOptimizer />);
    const slider = () => visibleScheduleSlider();
    await waitFor(() => expect(slider().getAttribute("aria-valuetext")).toBe("Mon, Oct 12"));
    const storedPlan = window.localStorage.getItem(WORKSPACE_KEY);
    fireEvent.click(screen.getByRole("button", { name: "Select Thu, Oct 15" }));
    expect(slider().getAttribute("aria-valuetext")).toBe("Thu, Oct 15");
    expect(window.localStorage.getItem(WORKSPACE_KEY)).toBe(storedPlan);
    view.unmount();
    view = render(<RosterScheduleOptimizer />);
    await waitFor(() => expect(slider().getAttribute("aria-valuetext")).toBe("Thu, Oct 15"));
    expect(window.localStorage.getItem(WORKSPACE_KEY)).toBe(storedPlan);
    view.unmount();
    const other = structuredClone(workspace);
    if (scope === "owner") authState.user = { id: "display-owner-b" };
    if (scope === "league") other.context.leagueId = "display-league-b";
    if (scope === "team") other.context.teamId = "display-team-b";
    if (scope === "horizon") other.context.endDate = "2026-10-25";
    if (scope === "timezone") other.context.timeZone = "America/Los_Angeles";
    window.localStorage.setItem(WORKSPACE_KEY, JSON.stringify(other));
    view = render(<RosterScheduleOptimizer />);
    await waitFor(() => expect(slider().getAttribute("aria-valuetext")).toBe("Mon, Oct 12"));
    fireEvent.click(screen.getByRole("button", { name: "Select Fri, Oct 16" }));
    view.unmount();
    authState.user = { id: "display-owner-a" };
    window.localStorage.setItem(WORKSPACE_KEY, JSON.stringify(workspace));
    render(<RosterScheduleOptimizer />);
    await waitFor(() => expect(slider().getAttribute("aria-valuetext")).toBe("Thu, Oct 15"));
  });
  it.each(["corrupt", "out-of-horizon", "read-failure", "write-failure"] as const)("keeps display-preference %s separate from the working plan", async failure => {
    seedFutureDisplayWorkspace();
    const view = render(<RosterScheduleOptimizer />);
    const slider = () => visibleScheduleSlider();
    await waitFor(() => expect(slider().getAttribute("aria-valuetext")).toBe("Mon, Oct 12"));
    const storedPlan = window.localStorage.getItem(WORKSPACE_KEY);
    fireEvent.click(screen.getByRole("button", { name: "Select Thu, Oct 15" }));
    const key = Object.keys(window.localStorage).find(key => key.startsWith("fhfh:rso:view-date:v1:"))!;
    if (failure === "corrupt") window.localStorage.setItem(key, "not-a-date");
    if (failure === "out-of-horizon") window.localStorage.setItem(key, "2026-10-19");
    if (failure === "read-failure") {
      const getItem = Storage.prototype.getItem;
      vi.spyOn(Storage.prototype, "getItem").mockImplementation(name => {
        if (name === key) throw new Error("Preference unavailable");
        return getItem.call(window.localStorage, name);
      });
    }
    if (failure === "write-failure") {
      const setItem = Storage.prototype.setItem;
      vi.spyOn(Storage.prototype, "setItem").mockImplementation((name, value) => {
        if (name === key) throw new Error("Preference unavailable");
        setItem.call(window.localStorage, name, value);
      });
      fireEvent.click(screen.getByRole("button", { name: "Select Fri, Oct 16" }));
      expect(slider().getAttribute("aria-valuetext")).toBe("Fri, Oct 16");
    }
    expect(window.localStorage.getItem(WORKSPACE_KEY)).toBe(storedPlan);
    view.unmount();
    render(<RosterScheduleOptimizer />);
    await waitFor(() => expect(slider().getAttribute("aria-valuetext")).toBe(failure === "write-failure" ? "Thu, Oct 15" : "Mon, Oct 12"));
    expect(window.localStorage.getItem(WORKSPACE_KEY)).toBe(storedPlan);
  });
  it("lets the manager pick the lineup goal and saves it with the plan", async () => {
    const workspace = defaultWorkspace();
    workspace.roster = [{ playerId: player.id, position: "active" }];
    workspace.manualPlayers = [{ ...player, eligibilityVerified: true }];
    window.localStorage.setItem(WORKSPACE_KEY, JSON.stringify(workspace));
    const schedule: PlanningData = { ...data, games: [{ id: "game", date: workspace.context.startDate, startsAt: null, teamAbbreviation: "CAR", opponent: "NYR", home: true, status: "scheduled" }],
      evidence: { schedule: { source: "fixture", asOf: workspace.context.asOf, seasonId: workspace.context.seasonId, completeness: "complete", limitations: [] } } };
    planningState.evaluate = (snapshot, intent) => planRoster(snapshot, intent);
    vi.stubGlobal("fetch", vi.fn((url: string) => Promise.resolve({ ok: url.includes("/data?"), json: async () => ({ success: true, data: schedule }) })));
    render(<RosterScheduleOptimizer />);
    const goal = await screen.findByRole("group", { name: "Lineup goal" });
    const starts = within(goal).getByRole("button", { name: "Most starts" });
    const points = within(goal).getByRole("button", { name: "Best projected points" });
    await waitFor(() => expect(starts.hasAttribute("disabled")).toBe(false));
    fireEvent.click(starts);
    await waitFor(() => expect(JSON.parse(window.localStorage.getItem(WORKSPACE_KEY)!).intent.objective).toBe("agp"));
    await waitFor(() => expect(starts.getAttribute("aria-pressed")).toBe("true"));
    expect(points.getAttribute("aria-pressed")).toBe("false");
    if (!points.hasAttribute("disabled")) {
      fireEvent.click(points);
      await waitFor(() => expect(JSON.parse(window.localStorage.getItem(WORKSPACE_KEY)!).intent.objective).toBe("outcome"));
      await waitFor(() => expect(points.getAttribute("aria-pressed")).toBe("true"));
    }
  });
  it.each(["partial", "complete"] as const)("qualifies plan aggregate counters and ratios under %s schedule coverage", async completeness => {
    const workspace = defaultWorkspace();
    workspace.roster = [{ playerId: player.id, position: "active" }];
    workspace.manualPlayers = [{ ...player, eligibilityVerified: true }];
    window.localStorage.setItem(WORKSPACE_KEY, JSON.stringify(workspace));
    const schedule: PlanningData = { ...data, games: [{ id: "game", date: workspace.context.startDate, startsAt: null, teamAbbreviation: "CAR", opponent: "NYR", home: true, status: "scheduled" }], evidence: { schedule: { source: "fixture", asOf: workspace.context.asOf, seasonId: workspace.context.seasonId, completeness, limitations: [] } } };
    planningState.evaluate = (snapshot, intent) => {
      const result = planRoster(snapshot, intent);
      result.selected.activeGames = 42; result.selected.benchGames = 6; result.selected.scheduledGames = 48;
      return result;
    };
    vi.stubGlobal("fetch", vi.fn((url: string) => Promise.resolve({ ok: url.includes("/data?"), json: async () => ({ success: true, data: schedule }) })));
    render(<RosterScheduleOptimizer />);
    const summary = screen.getByLabelText("Plan summary");
    const metric = (label: string) => within(summary).getByText(label).closest("article")!;
    await waitFor(() => expect(metric("Active games").querySelector("strong")!.textContent).toMatch(/^42( \/ \d+)?$/));
    expect(metric("Bench games").querySelector("strong")!.textContent).toBe("6");
    expect(metric("Bench games").querySelector("small")!.textContent).toBe("13% of scheduled games sit (DUST)");
    expect(summary.textContent).not.toContain("+ known");
    for (const removed of ["Planned adds", "Goalie minimum", "Team DUST", "Utilization", "Projected outcome"]) expect(within(summary).queryByText(removed)).toBeNull();
    expect(summary.querySelector("button")).toBeNull();
    expect(screen.queryByText(/Partial schedule · known subtotals/)).toBeNull();
    const estimate = screen.queryByText("Some team schedules for these dates aren't confirmed yet, so a few game counts are estimates.");
    if (completeness === "partial") expect(estimate).toBeTruthy();
    else expect(estimate).toBeNull();
  });
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
    expect(summary.closest("details")!.textContent).toContain("Oct 1");
    expect(summary.closest("details")!.textContent).toContain("stale or incomplete");
    expect(summary.closest("details")!.textContent).toContain("serving is not enabled");
    expect(summary.closest("details")!.open).toBe(false);
    expect(planningTimeText()).toBeTruthy();
    const setup = screen.getByRole("button", { name: /Planning setup/ });
    expect(setup.getAttribute("aria-expanded")).toBe("false");
    fireEvent.click(setup);
    expect(setup.getAttribute("aria-expanded")).toBe("true");
    expect(document.getElementById(setup.getAttribute("aria-controls")!)).toBeTruthy();
  });
  it("shows a provisional schedule warning without changing complete coverage or manager intent", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-10-10T15:00:00Z"));
    const workspace = defaultWorkspace();
    workspace.context = { ...workspace.context, startDate: "2026-10-10", endDate: "2026-10-10" };
    workspace.intent.protectedPlayerIds = [player.id];
    window.localStorage.setItem(WORKSPACE_KEY, JSON.stringify(workspace));
    vi.stubGlobal("fetch", vi.fn((url: string) => Promise.resolve({ ok: url.includes("/data?"), json: async () => ({ success: true, data: {
      ...data, games: [{ id: "near-game", date: "2026-10-10", startsAt: "2026-10-10T16:00:00Z", teamAbbreviation: "CAR", opponent: "NJD", home: true, status: "scheduled" }],
      evidence: { schedule: { source: "roster_optimizer_team_games", asOf: "2026-10-10T12:00:00Z", seasonId: 20262027, completeness: "complete", limitations: [] } },
    } }) })));
    render(<RosterScheduleOptimizer />);
    const summary = (await screen.findByText("Shared schedule: complete")).closest("summary")!;
    expect(summary.closest("details")!.textContent).toContain("Cache received");
    expect(summary.closest("details")!.textContent).toContain("Provisional 2-hour schedule warning.");
    expect(summary.closest("details")!.textContent).not.toContain("Source updated");
    expect(screen.getByText(/provisional warning thresholds, not forecast rejection limits/).textContent).toContain("0–120 minutes");
    expect(screen.getByText(/Schedule cache receipt time is separate/).textContent).toContain("model-fit time");
    expect(summary.closest("details")!.open).toBe(false);
    await waitFor(() => expect(JSON.parse(window.localStorage.getItem(WORKSPACE_KEY)!).intent).toEqual(workspace.intent));
  });
  it.each([
    { hours: 2, now: "2026-10-10T15:00:00Z", startsAt: "2026-10-10T16:00:00Z" },
    { hours: 6, now: "2026-10-10T19:00:00Z", startsAt: "2026-10-10T23:00:00Z" },
  ])("updates the provisional schedule $hours-hour warning after an edit without a new read", async ({ hours, now, startsAt }) => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-10-10T13:00:00Z"));
    const workspace = defaultWorkspace();
    workspace.context = { ...workspace.context, startDate: "2026-10-10", endDate: "2026-10-10" };
    workspace.roster = [{ playerId: player.id, position: "active" }];
    workspace.intent.protectedPlayerIds = [player.id];
    window.localStorage.setItem(WORKSPACE_KEY, JSON.stringify(workspace));
    const currentData: PlanningData = { ...data,
      games: [{ id: "aging-game", date: "2026-10-10", startsAt, teamAbbreviation: "CAR", opponent: "NJD", home: true, status: "scheduled" }],
      evidence: { schedule: { source: "roster_optimizer_team_games", asOf: "2026-10-10T12:00:00Z", seasonId: 20262027, completeness: "complete", limitations: [] } },
    };
    const read = vi.fn((url: string) => Promise.resolve({ ok: url.includes("/data?"), json: async () => ({ success: true, data: currentData }) }));
    vi.stubGlobal("fetch", read);
    render(<RosterScheduleOptimizer />);
    const summary = (await screen.findByText("Shared schedule: complete")).closest("summary")!;
    const readerTime = planningTimeText().textContent;
    const calls = read.mock.calls.length;
    expect(summary.closest("details")!.textContent).not.toContain("schedule warning");
    vi.setSystemTime(new Date(now));
    fireEvent.change(screen.getByLabelText("Alpha Center roster position"), { target: { value: "bench" } });
    expect(summary.closest("details")!.textContent).toContain(`Provisional ${hours}-hour schedule warning.`);
    expect(planningTimeText().textContent).toBe(readerTime);
    expect(read.mock.calls).toHaveLength(calls);
    expect(currentData.evidence.schedule.asOf).toBe("2026-10-10T12:00:00Z");
    expect(currentData.evidence.schedule.completeness).toBe("complete");
    expect(JSON.parse(window.localStorage.getItem(WORKSPACE_KEY)!)).toMatchObject({
      context: { asOf: new Date(now).toISOString() }, intent: workspace.intent,
    });
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
    const metric = await screen.findByLabelText("Planned adds");
    expect(metric.textContent).toBe(`Planned adds: 1 · ${detail}`);
    expect(metric.closest("#rso-plan-details")).toBeTruthy();
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
    render(<CandidateBrowser players={[player]} rosterIds={new Set()} snapshot={{ id: "zero", evidence: {}, rules: defaultWorkspace().rules, games: [], players: [] } as unknown as PlanningSnapshot}
      intent={defaultWorkspace().intent} fits={[]} manual select={vi.fn()} add={vi.fn()} markAvailable={vi.fn()} />);
    expect(screen.getByText("Comparing free agents…")).toBeTruthy();
    act(() => worker.onmessage?.({ data: { metrics: { candidates: [{ playerId: player.id, complete: false,
      plans: [{ objective: "outcome", steps: [], netAGP: 0, netPoints: 16, dropped: [], displacedPlayerIds: [] }] }] } } }));
    fireEvent.click(screen.getByRole("button", { name: "All players" }));
    expect(netPlan()).toBe("Net Pts +16 Net AGP 0");
    expect(screen.queryByText(/Horizon points|Potential active points gain/)).toBeNull();
    expect(screen.queryByText("Comparing free agents…")).toBeNull();
  });

  it("reads and selects the exact compared timed swap, keeping AGP/points tradeoffs paired", () => {
    let worker: { onmessage?: (event: { data: unknown }) => void };
    vi.stubGlobal("Worker", class {
      onmessage?: (event: { data: unknown }) => void;
      constructor() { worker = this; }
      postMessage() {}
      terminate() {}
    });
    const candidate = { ...player, availability: "free_agent" as const };
    const selectPlan = vi.fn();
    const step = { id: "points-plan", type: "add", playerId: candidate.id, dropPlayerId: "drop",
      at: "2026-10-05T12:00:00Z", effectiveAt: "2026-10-06T00:00:00Z", conditional: true, dependsOn: [] };
    const points = { objective: "outcome", steps: [step], netAGP: 0, netPoints: 5,
      dropped: [{ playerId: "drop", lostAGP: 1, lostPoints: 10 }], displacedPlayerIds: ["drop"] };
    const agp = { ...points, objective: "agp", steps: [{ ...step, id: "agp-plan" }], netAGP: 2, netPoints: -3 };
    render(<CandidateBrowser players={[candidate, { ...player, id: "drop", name: "Dropped Player" }]} rosterIds={new Set(["drop"])}
      snapshot={{ id: "compared-plan", context: { ...defaultWorkspace().context, timeZone: "UTC" }, evidence: {}, games: [], players: [], roster: [], forecasts: [], lockedAssignments: [], realized: {}, opponent: null, rules: { ...defaultWorkspace().rules, scoring: { mode: "points", weights: {}, categories: [] } } } as PlanningSnapshot}
      intent={defaultWorkspace().intent} fits={[]} manual select={vi.fn()} add={vi.fn()} markAvailable={vi.fn()} selectPlan={selectPlan} canSelectPlan />);
    act(() => worker.onmessage?.({ data: { metrics: { candidates: [{ playerId: candidate.id, plans: [agp, points], complete: false }] } } }));
    fireEvent.click(screen.getByRole("button", { name: "All players" }));
    expect(netPlan()).toBe("Net Pts +5 Net AGP 0");
    expect(screen.getByRole("button", { name: "Preview swap: add Alpha Center, drop Dropped Player" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /^Preview swap/ }));
    expect(selectPlan).toHaveBeenLastCalledWith([step]);
    fireEvent.click(screen.getByRole("button", { name: "By more starts" }));
    expect(netPlan()).toBe("Net Pts -3 Net AGP +2");
    expect(screen.getByLabelText("Net plan comparison").textContent).not.toContain("+5");
    fireEvent.click(screen.getByRole("button", { name: /^Preview swap/ }));
    expect(selectPlan).toHaveBeenLastCalledWith(agp.steps);
  });

  it.each(["no gain", "missing points"])("keeps compared-drop selection disabled for %s", mode => {
    let worker: { onmessage?: (event: { data: unknown }) => void };
    vi.stubGlobal("Worker", class {
      onmessage?: (event: { data: unknown }) => void;
      constructor() { worker = this; }
      postMessage() {}
      terminate() {}
    });
    render(<CandidateBrowser players={[{ ...player, availability: "free_agent" }]} rosterIds={new Set()}
      snapshot={{ id: "unavailable-drop", evidence: {}, rules: defaultWorkspace().rules, games: [], players: [] } as unknown as PlanningSnapshot} intent={defaultWorkspace().intent} fits={[]} manual
      select={vi.fn()} add={vi.fn()} markAvailable={vi.fn()} selectPlan={vi.fn()} canSelectPlan />);
    act(() => worker.onmessage?.({ data: { metrics: { candidates: [{ playerId: player.id, complete: true, plans: [{
      objective: "agp", steps: [], netAGP: mode === "no gain" ? 0 : 1, netPoints: mode === "no gain" ? 0 : null,
      dropped: [{ playerId: "drop", lostAGP: 1, lostPoints: null }], displacedPlayerIds: [] }] }] } } }));
    fireEvent.click(screen.getByRole("button", { name: "All players" }));
    expect(screen.getByRole("button", { name: /^Preview swap/ })).toHaveProperty("disabled", true);
  });

  it("uses schedule ordering and category-plan guidance instead of points claims in category leagues", () => {
    vi.stubGlobal("Worker", undefined);
    const candidate = { ...player, availability: "manager_available" as const };
    render(<CandidateBrowser players={[candidate]} rosterIds={new Set()} snapshot={{ id: "categories", evidence: {}, games: [], players: [],
      rules: { ...defaultWorkspace().rules, scoring: { mode: "categories", weights: {}, categories: [] } } } as unknown as PlanningSnapshot}
      intent={defaultWorkspace().intent} fits={[]} manual select={vi.fn()} add={vi.fn()} markAvailable={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: "All players" }));
    expect(screen.queryByText("Unranked players")).toBeNull();
    expect(screen.queryByRole("button", { name: "About best-fit comparisons" })).toBeNull();
    expect(screen.queryByText(/Horizon points|Potential active points gain|points unavailable/)).toBeNull();
    expect(screen.queryByRole("combobox", { name: "Sort" })).toBeNull();
    expect(screen.queryByRole("group", { name: "Sort recommendations" })).toBeNull();
    expect(screen.queryByLabelText("Net plan comparison")).toBeNull();
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
    fireEvent.click(screen.getByRole("button", { name: "By Team" }));
    expect(screen.getAllByText("CAR · 2 players")).toHaveLength(1);
    fireEvent.click(screen.getByText("CAR · 2 players"));
    expect(screen.getByText(/CAR · C\/Util/)).toBeTruthy();
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
  it("reviews manual candidate positions explicitly without replacing selected moves or leaking another candidate's positions", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-10-10T12:00:00Z"));
    const candidate = { ...player, id: "9267", nhlId: 8477956, name: "David Pastrnak", teamAbbreviation: "BOS", eligiblePositions: ["RW"], eligibilityVerified: false };
    const other = { ...candidate, id: "other-wing", name: "Other Wing", eligiblePositions: ["LW"] };
    const workspace = defaultWorkspace();
    workspace.rules.acquisitionTiming = "same_day";
    workspace.roster = [{ playerId: player.id, position: "bench" }];
    workspace.manualPlayers = [{ ...player, eligibilityVerified: true }];
    workspace.intent.protectedPlayerIds = [player.id];
    workspace.intent.excludedPlayerIds = [other.id];
    window.localStorage.setItem(WORKSPACE_KEY, JSON.stringify(workspace));
    vi.stubGlobal("fetch", vi.fn((url: string) => Promise.resolve({ ok: url.includes("/data?"), json: async () => ({ success: true, data: { ...data, players: [player, candidate, other] } }) })));
    render(<RosterScheduleOptimizer />);
    fireEvent.click(await screen.findByRole("button", { name: "All players" }));
    const excludedRow = (await screen.findByRole("button", { name: /Other Wing.*LW/ })).closest<HTMLElement>("[data-rso-candidate-id]")!;
    expect(within(excludedRow).getByText("Excluded from suggestions")).toBeTruthy();
    expect(within(excludedRow).queryByText("unknown")).toBeNull();
    expect(within(excludedRow).getByRole("button", { name: "Mark available" })).toBeTruthy();
    const candidateButton = await screen.findByRole("button", { name: /David Pastrnak.*RW/ });
    fireEvent.click(within(candidateButton.closest("[data-rso-candidate-id]")!).getByRole("button", { name: "Mark available" }));
    const stored = () => JSON.parse(window.localStorage.getItem(WORKSPACE_KEY)!);
    await waitFor(() => expect(stored().manualPlayers.find((row: PlanningPlayer) => row.id === candidate.id)).toMatchObject({ availability: "manager_available", eligibilityVerified: false }));
    fireEvent.click(within(candidateButton.closest("[data-rso-candidate-id]")!).getByRole("button", { name: "Select add" }));
    await waitFor(() => expect(stored().intent.steps).toHaveLength(1));
    const selectedIntent = structuredClone(stored().intent);
    const panel = screen.getByRole("region", { name: "Candidates and detail" });
    expect(within(panel).getAllByText("Excluded from suggestions")).toHaveLength(1);
    fireEvent.click(within(panel).getByText("Review evidence", { exact: true }));
    fireEvent.click(within(panel).getByRole("checkbox", { name: "Manager confirms league positions" }));
    await waitFor(() => expect(stored().manualPlayers.find((row: PlanningPlayer) => row.id === candidate.id)).toMatchObject({ eligiblePositions: ["RW"], eligibilityVerified: true, ownership: null, canDrop: null }));
    expect(stored().intent).toEqual(selectedIntent);
    fireEvent.change(within(panel).getByLabelText("Eligible positions"), { target: { value: "RW, LW" } });
    fireEvent.blur(within(panel).getByLabelText("Eligible positions"));
    await waitFor(() => expect(stored().manualPlayers.find((row: PlanningPlayer) => row.id === candidate.id).eligiblePositions).toEqual(["RW", "LW"]));
    fireEvent.click(screen.getByRole("button", { name: /Other Wing.*LW/ }));
    expect(within(panel).getAllByText("Excluded from suggestions")).toHaveLength(2);
    fireEvent.click(within(panel).getByText("Review evidence", { exact: true }));
    expect((within(panel).getByLabelText("Eligible positions") as HTMLInputElement).value).toBe("LW");
    expect((within(panel).getByRole("checkbox", { name: "Manager confirms league positions" }) as HTMLInputElement).checked).toBe(false);
    expect(stored().intent).toEqual(selectedIntent);
    expect(stored().manualPlayers.some((row: PlanningPlayer) => row.id === other.id)).toBe(false);
    const excludedChoice = within(panel).getByRole("checkbox", { name: "Exclude from suggestions" });
    expect((excludedChoice as HTMLInputElement).checked).toBe(true);
    fireEvent.click(excludedChoice);
    await waitFor(() => expect(stored().intent.excludedPlayerIds).toEqual([]));
    expect(stored().intent.steps).toEqual(selectedIntent.steps);
    expect(stored().intent.protectedPlayerIds).toEqual(selectedIntent.protectedPlayerIds);
    fireEvent.click(screen.getByRole("button", { name: "Undo" }));
    await waitFor(() => expect(stored().intent).toEqual({ ...selectedIntent, revision: expect.any(Number) }));
    expect(stored().intent.revision).toBeGreaterThan(selectedIntent.revision);
    fireEvent.click(screen.getByRole("button", { name: /David Pastrnak.*RW/ }));
    fireEvent.click(within(panel).getByRole("checkbox", { name: "Exclude from suggestions" }));
    await waitFor(() => expect(stored().intent.excludedPlayerIds).toEqual([other.id, candidate.id]));
    expect(stored().intent.steps).toEqual(selectedIntent.steps);
    expect(stored().intent.protectedPlayerIds).toEqual(selectedIntent.protectedPlayerIds);
    cleanup();
    render(<RosterScheduleOptimizer />);
    fireEvent.click(await screen.findByRole("button", { name: "All players" }));
    fireEvent.click(await screen.findByRole("button", { name: /David Pastrnak.*RW/ }));
    const reopenedPanel = screen.getByRole("region", { name: "Candidates and detail" });
    expect((within(reopenedPanel).getByRole("checkbox", { name: "Exclude from suggestions" }) as HTMLInputElement).checked).toBe(true);
    fireEvent.click(screen.getByRole("button", { name: "Undo" }));
    await waitFor(() => expect(stored().intent).toEqual({ ...selectedIntent, revision: expect.any(Number) }));
    expect(stored().intent.revision).toBeGreaterThan(selectedIntent.revision);
  });
  it("keeps the manager exclusion control read-only for retained connected inputs", async () => {
    const workspace = defaultWorkspace();
    workspace.context.provider = "yahoo";
    workspace.roster = [{ playerId: player.id, position: "bench" }];
    workspace.manualPlayers = [player];
    workspace.intent.excludedPlayerIds = [player.id];
    window.localStorage.setItem(WORKSPACE_KEY, JSON.stringify(workspace));
    vi.stubGlobal("fetch", fetchMock);
    render(<RosterScheduleOptimizer />);
    const rosterPanel = await screen.findByRole("region", { name: "Roster and setup" });
    fireEvent.click(await within(rosterPanel).findByRole("button", { name: /^Alpha Center/ }));
    const detail = screen.getByRole("region", { name: "Player details for Alpha Center" });
    const choice = within(detail).getByRole("checkbox", { name: "Exclude from suggestions" }) as HTMLInputElement;
    expect(choice.checked).toBe(true);
    expect(choice.disabled).toBe(true);
    fireEvent.click(choice);
    await waitFor(() => expect(JSON.parse(window.localStorage.getItem(WORKSPACE_KEY)!).intent).toEqual(workspace.intent));
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
      ["weekly_lock", /Not eligible at this weekly lineup lock/],
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
    expect(screen.getByText("Check these against your league settings.")).toBeTruthy();
  });
  it("requires input review and renews it after rule changes without certifying unknown scoring", async () => {
    // Mid-week clock: "tomorrow" must stay inside the current Mon–Sun week (it does not on Sundays).
    vi.useFakeTimers({ toFake: ["Date"] }); vi.setSystemTime(new Date("2026-10-14T16:00:00Z"));
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
    const pairs = () => within(screen.getByRole("group", { name: "Back-to-back goalie evidence" }));
    expect(pairs().getByText(/Starter evidence is incompatible/).textContent).toContain("projected starts unknown");
    expect(pairs().getByText(/Starter evidence is incompatible/).textContent).toContain("0 confirmed starts");
    const valid = forecasts.map(row => ({ ...row, startProbability: 0.4 }));
    view.rerender(<GoalieEvidence snapshot={{ ...snapshot, forecasts: valid }} />);
    expect(pairs().getByText(/0.4 projected across 1\/2 evidenced games/)).toBeTruthy();
    expect(screen.queryByText(/Starter evidence is incompatible/)).toBeNull();
    const late = within(screen.getByRole("group", { name: "Late goalie window" }));
    expect(late.getByText(/1 unique known goalie option/)).toBeTruthy();
    expect(late.getByText(/0 confirmed starts/)).toBeTruthy();
    expect(late.getByText(/0.4 projected across 1\/2 evidenced games/)).toBeTruthy();
    expect(late.getByText(/1 goalie with unknown availability/)).toBeTruthy();
    view.rerender(<GoalieEvidence snapshot={{ ...snapshot, players: goalies.map(goalie => ({ ...goalie, availability: "free_agent" })),
      forecasts: valid.map(row => ({ ...row, startProbability: 0.5 })) }} />);
    expect(late.getByText(/2 unique known goalie options/)).toBeTruthy();
    expect(late.getByText(/1 projected across 1\/2 evidenced games/)).toBeTruthy();
    expect(late.getByText(/0 confirmed starts/)).toBeTruthy();
    for (const missing of [false, true]) {
      const partial = valid.map(row => ({ ...row, startProbability: row.playerId === "7" ? 0.4 : null }));
      view.rerender(<GoalieEvidence snapshot={{ ...snapshot, players: goalies.map(goalie => ({ ...goalie, availability: "free_agent" })),
        forecasts: missing ? partial.filter(row => row.playerId === "7") : partial }} />);
      expect(late.getByText(/0.4 projected \(known subtotal\)/)).toBeTruthy();
      expect(late.getByText(/1 partially evidenced team game/)).toBeTruthy();
    }
    view.rerender(<GoalieEvidence snapshot={{ ...snapshot, forecasts: valid.map(row => ({ ...row,
      sourceKind: undefined, issuedContext: undefined, cutoffAt: undefined, expiresAt: undefined })) }} />);
    expect(pairs().getByText(/projected starts unknown/)).toBeTruthy();
    expect(screen.queryByText(/projected across/)).toBeNull();
  });
  it("separates remaining goalie windows by the selected split without hiding unknown timing or availability", () => {
    const workspace = defaultWorkspace(new Date("2026-10-08T12:00:00Z"));
    const goalies = [1, 2, 3, 4].map(id => ({ ...player, id: String(id), nhlId: id, playerClass: "goalie" as const,
      eligiblePositions: ["G"], teamAbbreviation: id === 3 ? "NJD" : id === 4 ? "BOS" : "CAR",
      availability: id === 2 || id === 4 ? "free_agent" as const : "unknown" as const }));
    const games: PlanningSnapshot["games"] = [7, 8, 9, 10, 11, 12].map(day => ({ id: String(day), date: `2026-10-${String(day).padStart(2, "0")}`,
      startsAt: day === 10 ? null : `2026-10-${String(day).padStart(2, "0")}T23:00:00Z`,
      teamAbbreviation: day === 10 ? "NJD" : day >= 11 ? "BOS" : "CAR", opponent: "NYR", home: true,
      status: day === 11 ? "cancelled" : "scheduled" }));
    const snapshot: PlanningSnapshot = { id: "goalie-windows", context: { ...workspace.context, startDate: "2026-10-05", endDate: "2026-10-11", timeZone: "UTC" },
      players: goalies, games, forecasts: [], roster: [{ playerId: "1", position: "active" }], rules: workspace.rules,
      realized: {}, opponent: null, evidence: {}, lockedAssignments: [] };
    const view = render(<GoalieEvidence snapshot={snapshot} />);
    const early = () => within(screen.getByRole("group", { name: "Early goalie window" }));
    const late = () => within(screen.getByRole("group", { name: "Late goalie window" }));
    expect(early().getByText("Early · Mon–Thu")).toBeTruthy();
    expect(early().getByText(/2 unique known goalie options/)).toBeTruthy();
    expect(early().getByText(/1 remaining team game/)).toBeTruthy();
    expect(late().getByText(/2 remaining team games/)).toBeTruthy();
    expect(late().getByText(/1 game with unverified start time/)).toBeTruthy();
    expect(late().getByText(/1 goalie with unknown availability/)).toBeTruthy();
    view.rerender(<GoalieEvidence snapshot={snapshot} goalieSplit="mon_wed" />);
    expect(early().getByText("Early · Mon–Wed")).toBeTruthy();
    expect(early().getByText("No remaining scheduled games in this window.")).toBeTruthy();
    expect(late().getByText("Late · Thu–Sun")).toBeTruthy();
    expect(late().getByText(/2 unique known goalie options/)).toBeTruthy();
    expect(late().getByText(/3 remaining team games/)).toBeTruthy();
    expect(late().getByText(/projected starts unknown/)).toBeTruthy();
    expect(snapshot.context).toEqual({ ...workspace.context, startDate: "2026-10-05", endDate: "2026-10-11", timeZone: "UTC" });
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
    const byPosition = await screen.findByRole("button", { name: "By position" });
    fireEvent.click(byPosition);
    expect(byPosition.getAttribute("aria-pressed")).toBe("true");
    expect(screen.getByRole("table", { name: "Lineup by position" })).toBeTruthy();
    const button = screen.getByRole("button", { name: "Show lineup by player" });
    expect(button.textContent).toBe("By player");
    fireEvent.click(button);
    expect(button.getAttribute("aria-pressed")).toBe("true");
    expect(screen.getByText("Date controls")).toBeTruthy();
    expect(screen.queryByText("Capacity only · unverified")).toBeNull();
    expect(screen.queryByText(/This assignment shows legal schedule capacity/)).toBeNull();
    expect(screen.queryByRole("button", { name: "Show schedule-capacity assignment" })).toBeNull();
    expect(screen.queryByRole("button", { name: /suggested lineup/i })).toBeNull();
  });
  it.each([true, false])("distinguishes category comparison availability (%s) from a recommended winner", async (comparisonEligible) => {
    const workspace = defaultWorkspace();
    workspace.manualPlayers = [player];
    workspace.roster = [{ playerId: player.id, position: "active" }];
    workspace.rules.scoring = { mode: "categories", weights: {}, categories: [{ key: "GOALS", direction: "higher" }] };
    workspace.realized = { GOALS: 0 };
    workspace.opponent = { roster: [], realized: { GOALS: 1 }, remaining: { GOALS: 0 } };
    window.localStorage.setItem(WORKSPACE_KEY, JSON.stringify(workspace));
    // Exercise the comparison/certification presentation contract separately from forecast admission.
    planningState.evaluate = (snapshot, intent) => {
      const result = planRoster(snapshot, intent, { maxSteps: 0 });
      return { ...result, selected: { ...result.selected, comparisonEligible } };
    };
    const games: PlanningData["games"] = [{ id: "category-game", date: workspace.context.startDate,
      startsAt: `${workspace.context.startDate}T23:00:00Z`, teamAbbreviation: "CAR", opponent: "NYR", home: true, status: "scheduled" }];
    vi.stubGlobal("fetch", vi.fn((url: string) => Promise.resolve({ ok: url.includes("/data?"),
      json: async () => ({ success: true, data: { ...data, games } }) })));
    render(<RosterScheduleOptimizer />);
    const button = await screen.findByRole("button", { name: comparisonEligible ? "Show category lineup comparison" : "Show lineup by player" });
    await screen.findByText("Category outcomes");
    fireEvent.click(button);
    expect(screen.getByText("Category lineup · tradeoffs need your call")).toBeTruthy();
    expect(screen.queryByText(/Category alternatives ·/)).toBeNull();
    expect(screen.queryByText(/Best found ·/)).toBeNull();
    expect(screen.getAllByText(/No-move category lineup/).length).toBeGreaterThan(0);
    expect(screen.queryByText(/Optimized no(?: |-)?move/)).toBeNull();
    if (comparisonEligible) {
      expect(screen.queryByText(/Supported category values describe this lineup/)).toBeNull();
      expect(screen.getByText(/Overall category sensitivity is withheld; category tradeoffs need your choice/)).toBeTruthy();
      expect(screen.queryByText(/Incomplete forecast, matchup or coverage evidence/)).toBeNull();
      fireEvent.click(screen.getByText("Planning readiness"));
      expect(screen.getByText(/Supported category comparisons available; tradeoffs need your choice/)).toBeTruthy();
    } else expect(screen.queryByText(/Incomplete forecast, matchup or coverage evidence leaves category comparisons unresolved/)).toBeNull();
    expect(screen.queryByRole("button", { name: "Show lineup analysis" })).toBeNull();
  });
  it("withholds category gains when the no-move lineup cannot satisfy a selected-player lock", () => {
    const baseline = { legal: false, budgetVerified: true, comparisonEligible: false, forecastManifestId: "same",
      limitations: ["Locked assignment for candidate on 2026-10-07 cannot be verified."],
      categoryResults: [{ key: "GOALS", own: 2, opponent: 2.5, result: "loss" }] } as PlanEvaluation;
    const selected = { ...baseline, legal: true, comparisonEligible: true, limitations: [],
      categoryResults: [{ key: "GOALS", own: 4, opponent: 2.5, result: "win" }] } as PlanEvaluation;
    render(<CategoryGains baseline={baseline} plan={selected} label="Selected plan" reviewed
      scoring={{ mode: "categories", weights: {}, categories: [{ key: "GOALS", direction: "higher" }] }} />);
    expect(screen.getByText(/no-move lineup cannot satisfy the current lineup locks/)).toBeTruthy();
    expect(screen.getByText("Change unavailable")).toBeTruthy();
    expect(screen.queryByText(/No move 2 → plan 4/)).toBeNull();
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
    expect(screen.getByText("Roster review complete: 1 added, 0 already rostered, 1 unresolved. Review player evidence before planning moves.").getAttribute("role")).toBe("status");
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

  it("reports already-rostered pasted names without changing selected moves or unresolved names", async () => {
    vi.stubGlobal("fetch", fetchMock);
    const workspace = defaultWorkspace();
    workspace.roster = [{ playerId: player.id, position: "bench" }];
    workspace.manualPlayers = [player];
    workspace.unresolvedNames = ["Unmatched Skater"];
    workspace.intent.protectedPlayerIds = [player.id];
    workspace.intent.steps = [{ id: "retained-add", type: "add", playerId: "fhfh:2", at: `${workspace.context.endDate}T12:00:00Z`, effectiveAt: `${workspace.context.endDate}T12:00:00Z`, conditional: true, dependsOn: [] }];
    window.localStorage.setItem(WORKSPACE_KEY, JSON.stringify(workspace));
    render(<RosterScheduleOptimizer />);
    await screen.findByRole("button", { name: "Remove Alpha Center" });
    fireEvent.change(screen.getByRole("textbox", { name: "Paste roster names" }), { target: { value: "Alpha Center" } });
    fireEvent.click(screen.getByRole("button", { name: "Review pasted names" }));
    expect(screen.getByText("Roster review complete: 0 added, 1 already rostered, 0 unresolved. No new roster players were added.").getAttribute("role")).toBe("status");
    const saved = JSON.parse(window.localStorage.getItem(WORKSPACE_KEY)!);
    expect(saved).toMatchObject({ roster: workspace.roster, intent: workspace.intent, unresolvedNames: workspace.unresolvedNames });
    expect(screen.getByRole("textbox", { name: "Paste roster names" })).toHaveProperty("value", "");
  });

  it.each([false, true])("resolves explicit unresolved-name choices without clobbering intent or existing inputs (rostered=%s)", async (rostered) => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-10-11T12:00:00Z"));
    const reviewed = { ...player, eligiblePositions: ["C", "UTIL"], eligibilityVerified: true, canDrop: false };
    const other = { ...player, id: "fhfh:2", nhlId: 2, name: "Bravo Center" };
    const workspace = defaultWorkspace();
    workspace.roster = rostered ? [{ playerId: player.id, position: "bench" }] : [];
    workspace.manualPlayers = rostered ? [reviewed] : [];
    workspace.unresolvedNames = ["center", "Center", "Unmatched Skater"];
    workspace.intent.protectedPlayerIds = [player.id];
    workspace.intent.steps = [{ id: "retained-add", type: "add", playerId: other.id, at: `${workspace.context.endDate}T12:00:00Z`, effectiveAt: `${workspace.context.endDate}T12:00:00Z`, conditional: true, dependsOn: [] }];
    window.localStorage.setItem(WORKSPACE_KEY, JSON.stringify(workspace));
    vi.stubGlobal("fetch", vi.fn((url: string) => Promise.resolve({ ok: url.includes("/data?"), json: async () => ({ success: true, data: { ...data, players: [player, other] } }) })));
    const view = render(<RosterScheduleOptimizer />);
    const unresolved = await screen.findByText("Center", { exact: true });
    fireEvent.click(within(unresolved).getByRole("button", { name: "Find match" }));
    const choice = (await screen.findByText(/^Alpha Center · CAR ·/)).closest("li")!;
    fireEvent.click(within(choice).getByRole("button", { name: "Resolve" }));
    const stored = () => JSON.parse(window.localStorage.getItem(WORKSPACE_KEY)!);
    await waitFor(() => expect(stored().unresolvedNames).toEqual(["center", "Unmatched Skater"]));
    expect(stored().roster).toEqual([{ playerId: player.id, position: "bench" }]);
    expect(stored().manualPlayers).toEqual([rostered ? reviewed : player]);
    expect(stored().intent).toEqual(workspace.intent);
    expect(screen.getByText("Center resolved as Alpha Center.").getAttribute("role")).toBe("status");
    view.unmount();
    render(<RosterScheduleOptimizer />);
    await screen.findByRole("button", { name: "Remove Alpha Center" });
    expect(stored().unresolvedNames).toEqual(["center", "Unmatched Skater"]);
    fireEvent.click(screen.getByRole("button", { name: "Undo" }));
    await waitFor(() => expect(stored().unresolvedNames).toEqual(workspace.unresolvedNames));
    expect(stored().roster).toEqual(workspace.roster);
    expect(stored().manualPlayers).toEqual(workspace.manualPlayers);
    expect(stored().intent.steps).toEqual(workspace.intent.steps);
    expect(stored().intent.protectedPlayerIds).toEqual(workspace.intent.protectedPlayerIds);
  });

  it.each([
    { source: "roster", width: 390 },
    { source: "compact", width: 1440 },
    { source: "candidate", width: 1440 },
  ])("reveals and focuses existing player detail from $source at $width without editing the plan", async ({ source, width }) => {
    vi.stubGlobal("innerWidth", width);
    const frames: FrameRequestCallback[] = [];
    vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => { frames.push(callback); return frames.length; });
    const candidate = { ...player, id: "fhfh:2", nhlId: 2, name: "Bravo Center" };
    const workspace = defaultWorkspace();
    workspace.manualPlayers = [player, candidate];
    workspace.roster = [{ playerId: player.id, position: "bench" }];
    workspace.intent.protectedPlayerIds = [player.id];
    window.localStorage.setItem(WORKSPACE_KEY, JSON.stringify(workspace));
    vi.stubGlobal("fetch", vi.fn((url: string) => Promise.resolve({ ok: url.includes("/data?"), json: async () => ({ success: true, data: { ...data, players: [player, candidate] } }) })));
    render(<RosterScheduleOptimizer />);
    await screen.findByRole("button", { name: "Remove Alpha Center" });
    await waitFor(() => expect(planningTimeText()).toBeTruthy());
    await act(async () => {});
    const stored = window.localStorage.getItem(WORKSPACE_KEY);
    if (source === "roster") {
      fireEvent.click(screen.getByRole("button", { name: "Roster" }));
      fireEvent.click(screen.getByRole("button", { name: /^Alpha Center/ }));
    } else if (source === "compact") {
      fireEvent.click(within(screen.getByRole("group", { name: "Workspace actions" })).getByRole("button", { name: "Matchup" }));
      showByPlayer();
      fireEvent.click(screen.getByRole("button", { name: /^Schedule details for Alpha Center/ }));
    } else {
      fireEvent.click(screen.getByRole("button", { name: "All players" }));
      fireEvent.click(screen.getByRole("button", { name: /^Bravo Center/ }));
    }
    const detail = screen.getByRole("region", { name: `Player details for ${source === "candidate" ? candidate.name : player.name}` });
    const scroll = vi.fn(); detail.scrollIntoView = scroll;
    act(() => frames.splice(0).forEach(frame => frame(0)));
    expect(document.activeElement).toBe(detail);
    expect(scroll).toHaveBeenCalledWith({ block: "nearest" });
    expect(screen.getByRole("region", { name: "Candidates and detail" }).className).toContain("mobileActive");
    expect(screen.getByRole("region", { name: "Candidates and detail" }).className).not.toContain("desktopHidden");
    expect(window.localStorage.getItem(WORKSPACE_KEY)).toBe(stored);
  });

  it.each(["manual", "yahoo"] as const)("reloads shared schedule data for %s without changing the selected plan or refreshing a provider", async provider => {
    const workspace = seedFutureDisplayWorkspace();
    workspace.context.provider = provider;
    workspace.intent.steps = [{ id: "fixture-selected-add", type: "add", playerId: "fixture-candidate",
      at: "2026-10-15T18:00:00Z", effectiveAt: "2026-10-15T18:00:00Z", conditional: false, dependsOn: [] }];
    localStorage.setItem(WORKSPACE_KEY, JSON.stringify(workspace));
    const snapshots: PlanningSnapshot[] = [];
    planningState.evaluate = (snapshot, intent) => { snapshots.push(snapshot); return planRoster(snapshot, intent); };
    let reads = 0;
    const requests = vi.fn(async (url: string) => {
      const sharedRead = url.includes("/data?");
      if (sharedRead) reads++;
      return { ok: sharedRead, json: async () => ({ success: true,
      data: sharedRead ? { ...data, games: Array.from({ length: new URL(url, "http://localhost").searchParams.has("readToken") ? 2 : 1 }, (_, index) => ({
        id: `game-${index}`, date: "2026-10-15", startsAt: `2026-10-15T${index ? "23" : "20"}:00:00Z`,
        teamAbbreviation: "CAR", opponent: "OTT", home: true, status: "scheduled" as const,
      })) } : null }) };
    });
    vi.stubGlobal("fetch", requests);
    render(<RosterScheduleOptimizer />);
    await waitFor(() => expect(snapshots.at(-1)?.games.length).toBe(1));
    fireEvent.click(screen.getByRole("button", { name: "Reload schedule data" }));
    await waitFor(() => expect(snapshots.at(-1)?.games.length).toBe(2));
    expect(reads).toBe(2);
    const dataUrls = requests.mock.calls.map(([url]) => url).filter(url => url.includes("/data?"));
    const initialParams = new URL(dataUrls[0], "http://localhost").searchParams;
    const reloadParams = new URL(dataUrls[1], "http://localhost").searchParams;
    expect(initialParams.has("readToken")).toBe(false);
    expect(reloadParams.get("readToken")).toMatch(/^[a-f0-9-]{36}$/);
    reloadParams.delete("readToken");
    expect(reloadParams.toString()).toBe(initialParams.toString());
    const saved = JSON.parse(localStorage.getItem(WORKSPACE_KEY)!);
    expect(saved.roster).toEqual(workspace.roster);
    expect(saved.intent).toEqual(workspace.intent);
    expect(saved.rules).toEqual(workspace.rules);
    expect(saved.lockedAssignments).toEqual(workspace.lockedAssignments);
    expect(saved.context.startDate).toBe(workspace.context.startDate);
    expect(saved.context.endDate).toBe(workspace.context.endDate);
    expect(saved.context.timeZone).toBe(workspace.context.timeZone);
    expect(requests.mock.calls.some(([url]) => url.endsWith("/provider"))).toBe(false);
    fireEvent.click(screen.getByRole("button", { name: "Reload schedule data" }));
    await waitFor(() => expect(reads).toBe(3));
    const repeatedUrl = requests.mock.calls.map(([url]) => url).filter(url => url.includes("/data?"))[2];
    expect(new URL(repeatedUrl, "http://localhost").searchParams.get("readToken")).not.toBe(new URL(dataUrls[1], "http://localhost").searchParams.get("readToken"));
    if (provider === "manual") {
      fireEvent.change(screen.getByLabelText("From"), { target: { value: "2026-10-13" } });
      await waitFor(() => expect(reads).toBe(4));
      const changedUrl = requests.mock.calls.map(([url]) => url).filter(url => url.includes("/data?"))[3];
      expect(new URL(changedUrl, "http://localhost").searchParams.has("readToken")).toBe(false);
    }
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

  it("retains local undo when the workspace is reopened", async () => {
    vi.stubGlobal("fetch", fetchMock);
    const view = render(<RosterScheduleOptimizer />);
    fireEvent.change(await screen.findByRole("searchbox", { name: "Find a player" }), { target: { value: "Alpha" } });
    fireEvent.click(screen.getByRole("button", { name: "Add" }));
    view.unmount();
    render(<RosterScheduleOptimizer />);
    await screen.findByRole("button", { name: "Remove Alpha Center" });
    expect((screen.getByRole("button", { name: "Undo" }) as HTMLButtonElement).disabled).toBe(false);
    fireEvent.click(screen.getByRole("button", { name: "Undo" }));
    expect(screen.queryByRole("button", { name: "Remove Alpha Center" })).toBeNull();
    expect(JSON.parse(window.localStorage.getItem(WORKSPACE_KEY)!).roster).toEqual([]);
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
    fireEvent.click(screen.getByRole("button", { name: "Undo" }));
    expect(saved().context.leagueId).toBe("second");
    expect(saved().roster).toEqual(workspace.roster);
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
    workspace.intent.steps.reverse();
    window.localStorage.setItem(WORKSPACE_KEY, JSON.stringify(workspace));
    vi.stubGlobal("fetch", fetchMock);
    render(<RosterScheduleOptimizer />);
    const row = (await screen.findByText("ADD Charlie Center")).closest("div")!;
    expect(within(row).getByText(`Acquisition cost: ${cost ?? "unknown"} · Drop: Bravo Center`)).toBeTruthy();
    expect(within(row).getByText("Requires: ADD Bravo Center")).toBeTruthy();
    expect(screen.getByText("Next selected action: ADD Bravo Center")).toBeTruthy();
    expect(JSON.parse(window.localStorage.getItem(WORKSPACE_KEY)!).intent).toEqual(workspace.intent);
  });

  it.each([false, true])("identifies the next selected action without promoting an unresolved plan (mistimed prerequisite: %s)", async mistimedPrerequisite => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-10-10T12:00:00Z"));
    const workspace = defaultWorkspace();
    const bravo = { ...player, id: "fhfh:2", nhlId: 2, name: "Bravo Center" };
    workspace.manualPlayers = [player, bravo];
    workspace.intent.steps = [
      { id: "later", type: "drop", playerId: player.id, at: "2026-10-12T12:00:00Z", effectiveAt: "2026-10-12T12:00:00Z", conditional: false, dependsOn: [] },
      { id: "earlier", type: "add", playerId: bravo.id, at: "2026-10-11T12:00:00Z", effectiveAt: "2026-10-13T12:00:00Z", conditional: true, dependsOn: mistimedPrerequisite ? ["later"] : [] },
    ];
    window.localStorage.setItem(WORKSPACE_KEY, JSON.stringify(workspace));
    vi.stubGlobal("fetch", fetchMock);
    render(<RosterScheduleOptimizer />);
    if (mistimedPrerequisite) {
      expect(await screen.findByText("Review action times and prerequisites to identify the next move.")).toBeTruthy();
      expect(screen.queryByText(/Next selected action:/)).toBeNull();
      expect(JSON.parse(window.localStorage.getItem(WORKSPACE_KEY)!).intent).toEqual(workspace.intent);
      return;
    }
    const next = await screen.findByText("Next selected action: ADD Bravo Center");
    expect(next.parentElement?.textContent).toContain("Review inputs and rule checks before acting.");
    expect(JSON.parse(window.localStorage.getItem(WORKSPACE_KEY)!).intent).toEqual(workspace.intent);
    vi.setSystemTime(new Date("2026-10-11T13:00:00Z"));
    fireEvent.click(screen.getByRole("button", { name: /^Candidates$/ }));
    expect(next.parentElement?.textContent).toContain("Selected action time has passed; review the plan before acting.");
    expect(JSON.parse(window.localStorage.getItem(WORKSPACE_KEY)!).intent).toEqual(workspace.intent);
  });

  it("keeps the next selected action review-only after confirmation with unsupported rules", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-10-10T12:00:00Z"));
    const workspace = defaultWorkspace();
    workspace.context = { ...workspace.context, startDate: "2026-10-10", endDate: "2026-10-12", timeZone: "UTC" };
    const member = { ...player, canDrop: true, availability: "rostered" as const, eligibilityVerified: true };
    workspace.manualPlayers = [member];
    workspace.roster = [{ playerId: player.id, position: "active" }];
    workspace.rules = { ...workspace.rules, rosterSlots: { C: 1, BN: 1 }, acquisitionTiming: "same_day", acquisitionCost: 1,
      periods: [{ id: "week", start: "2026-10-10T00:00:00Z", end: "2026-10-13T00:00:00Z", remaining: 3, source: "manager" }],
      scoring: { mode: "points", weights: { GOALS: 1 }, categories: [] },
      unsupported: ["Some league scoring or roster rules are unsupported."] };
    workspace.intent.steps = [{ id: "drop", type: "drop", playerId: player.id, at: "2026-10-11T12:00:00Z", effectiveAt: "2026-10-11T12:00:00Z", conditional: false, dependsOn: [] }];
    planningState.evaluate = (snapshot, intent) => {
      const result = planRoster(snapshot, intent);
      expect(result.selected.legal).toBe(true);
      expect(result.selected.budgetVerified).toBe(true);
      return result;
    };
    window.localStorage.setItem(WORKSPACE_KEY, JSON.stringify(workspace));
    vi.stubGlobal("fetch", vi.fn((url: string) => Promise.resolve({ ok: url.includes("/data?"), json: async () => ({ success: true, data: { ...data, players: [member] } }) })));
    render(<RosterScheduleOptimizer />);
    const next = await screen.findByText("Next selected action: DROP Alpha Center");
    fireEvent.click(screen.getByRole("button", { name: "Confirm planning inputs" }));
    expect(next.parentElement?.textContent).toContain("Review inputs and rule checks before acting.");
    expect(next.parentElement?.textContent).not.toContain("Confirm this selected move with your provider.");
    expect(JSON.parse(window.localStorage.getItem(WORKSPACE_KEY)!).intent).toEqual(workspace.intent);
  });

  it.each([null, "C#1"].flatMap(slotId => [false, true].map(providerConflict => ({ slotId, providerConflict }))))("uses a saved manager $slotId lock through refresh, undo, save and reopen (provider conflict: $providerConflict)", async ({ slotId, providerConflict }) => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-10-08T12:00:00Z"));
    authState.user = { id: "manager" };
    const workspace = defaultWorkspace(new Date("2026-10-08T12:00:00Z"));
    workspace.context = { ...workspace.context, provider: "yahoo", leagueId: "league", teamId: "team", startDate: "2026-10-09", endDate: "2026-10-10", timeZone: "UTC" };
    const members = [player, { ...player, id: "fhfh:2", nhlId: 2, name: "Bravo Center", teamAbbreviation: "NJD" }].map(member => ({
      ...member, nhlTeamId: member.nhlId, rosterRevision: `roster-${member.id}`, eligibilityVerified: true, availability: "rostered" as const,
    }));
    workspace.manualPlayers = members;
    workspace.roster = members.map(member => ({ playerId: member.id, position: "active" as const }));
    workspace.rules = { ...workspace.rules, rosterSlots: { C: 1, BN: 1 }, acquisitionTiming: "same_day", acquisitionCost: 1,
      periods: [{ id: "week", start: workspace.context.asOf, end: "2026-10-11T00:00:00Z", remaining: 2, source: "provider" }],
      scoring: { mode: "points", weights: { GOALS: 1 }, categories: [] } };
    workspace.lockedAssignments = [{ date: workspace.context.endDate, playerId: members[slotId === null ? 0 : 1].id, slotId }];
    workspace.intent.protectedPlayerIds = [player.id];
    workspace.intent.excludedPlayerIds = ["fhfh:excluded"];
    window.localStorage.setItem(WORKSPACE_KEY, JSON.stringify(workspace));
    const games: PlanningSnapshot["games"] = [workspace.context.startDate, workspace.context.endDate].flatMap(date => members.map(member => ({
      id: `${member.id}:${date}`, date, startsAt: `${date}T23:00:00Z`, scheduleRevision: "schedule", teamAbbreviation: member.teamAbbreviation!, opponent: "NYR", home: true, status: "scheduled",
    })));
    const forecasts: GameForecast[] = games.map(game => {
      const member = members.find(member => member.teamAbbreviation === game.teamAbbreviation)!;
      return { playerId: member.id, gameId: game.id, stats: { GOALS: member.id === player.id ? 4 : 1 }, conditioning: "unconditional",
        sourceKind: "detailed", sourceWatermark: "fixture-inputs", startProbability: null, confirmedStart: false, revisionId: "fixture", modelVersion: "fixture", limitations: [],
        cutoffAt: workspace.context.asOf, issuedAt: workspace.context.asOf, expiresAt: game.startsAt!,
        allowedUses: { assignment: true, totals: true, comparison: true, conditionalTieBreak: false },
        issuedContext: { version: "forge-issued-context-v1", playerId: member.id, gameId: game.id, nhlPlayerId: member.nhlId!, seasonId: workspace.context.seasonId,
          teamId: member.nhlTeamId, scheduledAt: game.startsAt!, scheduleRevision: game.scheduleRevision!, rosterRevision: member.rosterRevision,
          observedAt: workspace.context.asOf, scheduleSourceUpdatedAt: null, scheduleFetchedAt: null, identityUpdatedAt: null, membershipCreatedAt: [] } };
    });
    const initial: PlanningSnapshot = { id: "connected-locks-old", context: workspace.context, players: members, roster: workspace.roster,
      games, forecasts, rules: workspace.rules, lockedAssignments: [], realized: {}, opponent: null, evidence: { schedule: { source: "synthetic complete schedule", asOf: workspace.context.asOf, seasonId: workspace.context.seasonId, completeness: "complete", limitations: [] } } };
    const refreshed: PlanningSnapshot = { ...initial, id: "connected-locks-new", context: { ...initial.context, asOf: "2026-10-08T13:00:00Z" },
      rules: { ...initial.rules, periods: [{ ...initial.rules.periods[0], remaining: 1 }] },
      lockedAssignments: [{ date: providerConflict ? workspace.context.endDate : workspace.context.startDate, playerId: player.id, slotId: "C#1" }] };
    let reads = 0;
    const evaluated: { snapshot: PlanningSnapshot; result: PlanningResult }[] = [];
    planningState.evaluate = (snapshot, intent) => {
      const result = planRoster(snapshot, intent, { maxSteps: 0 });
      if (snapshot.id.startsWith("connected-locks")) evaluated.push({ snapshot, result });
      return result;
    };
    let savedSnapshot: PlanningSnapshot | null = null;
    vi.stubGlobal("fetch", vi.fn((url: string, init?: RequestInit) => Promise.resolve({ ok: true, json: async () => {
      if (url.endsWith("/provider")) return { success: true, snapshot: ++reads === 1 ? initial : refreshed, capabilities: { limitations: [] } };
      if (url.endsWith("/access")) return { data: { eligible: true, capabilities: ["rso_sync", "rso_account_save"] } };
      if (url.endsWith("/workspace") && init?.method === "PUT") {
        const request = saveWorkspaceSchema.parse(JSON.parse(init.body as string));
        savedSnapshot = request.snapshot!;
        return { data: { ...request, version: 1, updatedAt: refreshed.context.asOf } };
      }
      return url.includes("/data?") ? { success: true, data: { ...data, players: members, games, forecasts } } : { data: null };
    } })));
    const latest = () => evaluated.at(-1)!;
    const assertCalculation = (currentAuthority = false) => {
      const conflict = providerConflict && currentAuthority;
      if (conflict) {
        expect(latest().snapshot.lockedAssignments).toEqual(refreshed.lockedAssignments);
        expect(screen.getByText(/provider lock retained and manager choice kept for review/)).toBeTruthy();
      } else expect(latest().snapshot.lockedAssignments).toContainEqual({ ...workspace.lockedAssignments![0], source: "manager" });
      expect(latest().result.selected).toMatchObject({ legal: true, activeGames: 2, projectedValue: conflict ? 8 : 5 });
      expect(latest().result.selected.assignments.find(row => row.date === workspace.context.endDate)?.playerId).toBe(members[conflict ? 0 : 1].id);
    };
    const view = render(<RosterScheduleOptimizer />);
    await waitFor(() => expect(latest()?.snapshot.id).toMatch(/^connected-locks-old/));
    assertCalculation();
    fireEvent.change(screen.getByRole("combobox", { name: "Goalie choice" }), { target: { value: "cover" } });
    fireEvent.click(screen.getByRole("button", { name: "Refresh provider" }));
    await waitFor(() => expect(latest().snapshot.context.asOf).toBe(refreshed.context.asOf));
    assertCalculation(true);
    expect(latest().snapshot.lockedAssignments).toContainEqual(refreshed.lockedAssignments[0]);
    fireEvent.click(screen.getByRole("button", { name: "Undo" }));
    assertCalculation(true);
    expect(latest().snapshot.rules.periods[0].remaining).toBe(1);
    fireEvent.click(screen.getByRole("button", { name: "Save to account" }));
    await screen.findByText("Saved to account.");
    expect(savedSnapshot).toMatchObject({ lockedAssignments: latest().snapshot.lockedAssignments });
    expect(JSON.parse(window.localStorage.getItem(WORKSPACE_KEY)!).lockedAssignments).toEqual(workspace.lockedAssignments);
    view.unmount(); render(<RosterScheduleOptimizer />);
    await waitFor(() => expect(reads).toBe(3));
    assertCalculation(true);
    expect(latest().snapshot.context.asOf).toBe(refreshed.context.asOf);
    expect(JSON.parse(window.localStorage.getItem(WORKSPACE_KEY)!).intent.protectedPlayerIds).toEqual(workspace.intent.protectedPlayerIds);
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

  it("shows provider refresh feedback immediately, prevents duplicate requests and reports unchanged inputs", async () => {
    authState.user = { id: "manager" };
    const workspace = defaultWorkspace();
    workspace.context = { ...workspace.context, provider: "yahoo", teamId: "team", leagueId: "league" };
    workspace.roster = [{ playerId: player.id, position: "bench" }];
    workspace.manualPlayers = [player];
    workspace.intent.protectedPlayerIds = [player.id];
    const initial: PlanningSnapshot = { id: "provider-initial", context: { ...workspace.context, asOf: "2026-10-08T12:00:00Z" },
      players: [player], roster: workspace.roster, rules: workspace.rules, lockedAssignments: [],
      games: [], forecasts: [], realized: {}, opponent: null, evidence: {} };
    window.localStorage.setItem(WORKSPACE_KEY, JSON.stringify(workspace));
    let release!: (response: unknown) => void;
    let requestSignal: AbortSignal | null | undefined;
    let reads = 0;
    const response = (snapshot: PlanningSnapshot) => ({ ok: true, json: async () => ({ success: true, snapshot,
      capabilities: { roster: true, availability: true, rules: true, matchup: false, acquisitions: false, limitations: [] } }) });
    vi.stubGlobal("fetch", vi.fn((url: string, init?: RequestInit) => {
      if (url.endsWith("/provider")) {
        if (++reads === 1) return Promise.resolve(response(initial));
        requestSignal = init?.signal;
        return new Promise(resolve => { release = resolve; });
      }
      return Promise.resolve({ ok: true, json: async () => url.includes("/data?") ? { success: true, data }
        : url.endsWith("/access") ? { data: { eligible: true, capabilities: ["rso_sync", "rso_auto_upkeep"] } } : { data: null } });
    }));
    const saved = () => JSON.parse(window.localStorage.getItem(WORKSPACE_KEY)!);
    render(<RosterScheduleOptimizer />);
    await waitFor(() => expect(saved().context.asOf).toBe(initial.context.asOf));
    const refresh = screen.getByRole("button", { name: "Refresh provider" }) as HTMLButtonElement;
    fireEvent.click(refresh);
    expect(refresh.getAttribute("aria-busy")).toBe("true");
    expect(refresh.disabled).toBe(true);
    expect(screen.getByText("Refreshing provider inputs…").getAttribute("role")).toBe("status");
    expect(saved().intent).toEqual(workspace.intent);
    await waitFor(() => expect(reads).toBe(2));
    fireEvent.click(refresh);
    vi.spyOn(document, "visibilityState", "get").mockReturnValue("visible");
    fireEvent(document, new Event("visibilitychange"));
    fireEvent(document, new Event("visibilitychange"));
    await act(async () => {});
    expect(reads).toBe(2);
    expect(requestSignal?.aborted).toBe(false);
    const unchanged = { ...initial, id: "provider-checked", context: { ...initial.context, asOf: "2026-10-08T13:00:00Z" } };
    await act(async () => release(response(unchanged)));
    expect(screen.getByText("Provider refresh completed. Inputs are unchanged; selected moves were kept.").getAttribute("role")).toBe("status");
    expect(refresh.disabled).toBe(false);
    expect(refresh.getAttribute("aria-busy")).toBe("false");
    expect(saved()).toMatchObject({ context: unchanged.context, roster: workspace.roster, intent: workspace.intent });
  });

  it.each([
    { user: null, sync: false, teamId: "team", reason: "Sign in to check access for provider synchronization." },
    { user: { id: "manager" }, sync: false, teamId: "team", reason: "Yahoo and Fantrax sync require premium access: $4.99 monthly or a $24.99 season pass ending July 1, 2027. Your account connection is unchanged." },
    { user: { id: "manager" }, sync: true, teamId: "manual", reason: "Select an owned team before refreshing provider inputs." },
    { user: { id: "manager" }, sync: true, teamId: " ", reason: "Select an owned team before refreshing provider inputs." },
  ])("explains unavailable provider refresh for user $user, sync $sync and team '$teamId'", async ({ user, sync, teamId, reason }) => {
    authState.user = user;
    const workspace = defaultWorkspace();
    workspace.context = { ...workspace.context, provider: "yahoo", leagueId: "league", teamId: teamId.trim() ? teamId : "manual" };
    window.localStorage.setItem(WORKSPACE_KEY, JSON.stringify(workspace));
    const requests = vi.fn((url: string) => Promise.resolve({ ok: true, json: async () => url.includes("/data?") ? { success: true, data }
      : url.endsWith("/access") ? { data: { eligible: sync, capabilities: sync ? ["rso_sync"] : [] } } : { data: null } }));
    vi.stubGlobal("fetch", requests);
    render(<RosterScheduleOptimizer />);
    if (teamId !== workspace.context.teamId) fireEvent.change(screen.getByLabelText("Team ID"), { target: { value: teamId } });
    const refresh = screen.getByRole("button", { name: "Refresh provider" }) as HTMLButtonElement;
    await waitFor(() => expect(document.getElementById(refresh.getAttribute("aria-describedby")!)?.textContent).toBe(reason));
    expect(refresh.disabled).toBe(true);
    fireEvent.click(refresh);
    await act(async () => {});
    expect(requests.mock.calls.some(([url]) => url.endsWith("/provider"))).toBe(false);
    expect(JSON.parse(window.localStorage.getItem(WORKSPACE_KEY)!)).toEqual({ ...workspace, context: { ...workspace.context, teamId } });
  });

  it.each([
    { ok: false, body: { success: false, error: "Connected refresh is unavailable for this provider. Use manual inputs." }, reason: "Connected refresh is unavailable for this provider. Use manual inputs." },
    { ok: true, body: { success: true }, reason: "Provider refresh returned no inputs. Try again or continue manually." },
  ])("explains unavailable provider inputs without reporting success or replacing saved inputs: $reason", async ({ ok, body, reason }) => {
    authState.user = { id: "manager" };
    const workspace = defaultWorkspace();
    workspace.context = { ...workspace.context, provider: "fantrax", leagueId: "league", teamId: "team" };
    window.localStorage.setItem(WORKSPACE_KEY, JSON.stringify(workspace));
    vi.stubGlobal("fetch", vi.fn((url: string) => Promise.resolve({ ok: url.endsWith("/provider") ? ok : true, json: async () => url.includes("/data?") ? { success: true, data }
      : url.endsWith("/access") ? { data: { eligible: true, capabilities: ["rso_sync"] } }
        : url.endsWith("/provider") ? body : { data: null } })));
    render(<RosterScheduleOptimizer />);
    expect((await screen.findByRole("alert")).textContent).toContain(reason);
    expect(screen.queryByText(/Provider inputs refreshed|Provider refresh completed/)).toBeNull();
    expect((screen.getByRole("button", { name: "Refresh provider" }) as HTMLButtonElement).disabled).toBe(false);
    expect(JSON.parse(window.localStorage.getItem(WORKSPACE_KEY)!)).toEqual(workspace);
  });

  it("renders an unknown range ledger without inventing zero contribution or a unique replacement", () => {
    const view = render(<RosterContribution name="Alpha" nameOf={id => id} />);
    expect(screen.getByLabelText("Alpha range contribution")).toHaveProperty("open", false);
    for (const label of ["Remaining GP: unknown", "AGP: unknown", "DUST/bench: unknown", "Active points: unavailable"])
      expect(screen.getByLabelText(label)).toBeTruthy();
    expect(screen.getByText(/Projected active points: unavailable/)).toBeTruthy();
    view.rerender(<RosterContribution name="Alpha" nameOf={id => id} contribution={{ playerId: "a",
      scheduledGames: null, knownScheduledGames: 2, activeGames: null, knownActiveGames: 1,
      benchGames: null, knownBenchGames: 1, projectedPoints: null,
      days: [{ date: "2026-10-05", gameId: "g", state: "bench", reason: "unresolved_quality", competingPlayerIds: ["Bravo", "Charlie"] }] }} />);
    for (const label of ["Remaining GP: 2+ known", "AGP: 1+ known", "DUST/bench: 1+ known", "Active points: unavailable"])
      expect(screen.getByLabelText(label)).toBeTruthy();
    expect(screen.getByText(/Competing assigned players: Bravo, Charlie\. This set does not identify a unique replacement/)).toBeTruthy();
  });

  it("keeps supported active points visible in the collapsed metric row and reserve separate from bench", () => {
    const contribution = { playerId: "a", scheduledGames: 4, knownScheduledGames: 4, activeGames: 3, knownActiveGames: 3,
      benchGames: 1, knownBenchGames: 1, projectedPoints: 12.375,
      days: [{ date: "2026-10-05", gameId: "g", state: "reserve" as const, competingPlayerIds: [] }] };
    const view = render(<RosterContribution name="Alpha" nameOf={id => id} contribution={contribution} />);
    const details = screen.getByLabelText("Alpha range contribution");
    expect(details).toHaveProperty("open", false);
    const summary = within(details.querySelector("summary")!);
    for (const label of ["Remaining GP: 4", "AGP: 3", "DUST/bench: 1", "Active points: 12.375"])
      expect(summary.getByLabelText(label)).toBeTruthy();
    expect(within(details).getByText(/Reserve; outside active pool/)).toBeTruthy();
    view.rerender(<RosterContribution name="Alpha" nameOf={id => id} contribution={{ ...contribution,
      activeGames: 0, knownActiveGames: 0, benchGames: 0, knownBenchGames: 0, projectedPoints: 0 }} />);
    expect(summary.getByLabelText("AGP: 0")).toBeTruthy();
    expect(summary.getByLabelText("DUST/bench: 0")).toBeTruthy();
    expect(summary.getByLabelText("Active points: 0")).toBeTruthy();
    expect(screen.queryByText(/DROP|low usable contribution/)).toBeNull();
  });

  it("keeps unmatched roster contributions explicitly unknown without changing persistence", async () => {
    const workspace = defaultWorkspace();
    workspace.roster = [{ playerId: "unmatched", position: "bench" }];
    window.localStorage.setItem(WORKSPACE_KEY, JSON.stringify(workspace));
    vi.stubGlobal("fetch", fetchMock);
    planningState.evaluate = planRoster;
    render(<RosterScheduleOptimizer />);
    await screen.findByText("Unmatched ID unmatched");
    const ledger = screen.getByLabelText("unmatched range contribution");
    for (const label of ["Remaining GP: unknown", "AGP: unknown", "DUST/bench: unknown", "Active points: unavailable"])
      expect(within(ledger).getByLabelText(label)).toBeTruthy();
    expect(JSON.parse(window.localStorage.getItem(WORKSPACE_KEY)!).roster).toEqual(workspace.roster);
  });

  it("reads back legal crowded-day assignments through nonzero plan refresh, Undo and reopen", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-10-08T12:00:00Z"));
    authState.user = { id: "local-acceptance-manager" };
    const workspace = defaultWorkspace();
    workspace.context = { ...workspace.context, provider: "yahoo", teamId: "team", leagueId: "league",
      startDate: "2026-10-08", endDate: "2026-10-08", timeZone: "UTC" };
    const alpha = { ...player, eligibilityVerified: true, availability: "rostered" as const, canDrop: true };
    const bravo = { ...alpha, id: "fhfh:2", nhlId: 2, name: "Bravo Center" };
    const charlie = { ...alpha, id: "fhfh:3", nhlId: 3, name: "Charlie Center", teamAbbreviation: "BOS" };
    workspace.manualPlayers = [alpha, bravo, charlie];
    workspace.roster = workspace.manualPlayers.map(row => ({ playerId: row.id, position: "bench" }));
    workspace.rules = { ...workspace.rules, rosterSlots: { C: 1, BN: 2 }, acquisitionTiming: "same_day", acquisitionCost: 1,
      scoring: { mode: "points", weights: { GOALS: 1 }, categories: [] } };
    workspace.lockedAssignments = [{ date: workspace.context.startDate, playerId: alpha.id, slotId: "C#1", source: "manager" }];
    workspace.intent.protectedPlayerIds = [alpha.id];
    workspace.intent.excludedPlayerIds = [charlie.id];
    workspace.intent.steps = [{ id: "selected-drop", type: "drop", playerId: charlie.id,
      at: "2026-10-08T14:00:00Z", effectiveAt: "2026-10-08T14:00:00Z", conditional: false, dependsOn: [] }];
    const initial: PlanningSnapshot = { id: "local-provider-old", context: workspace.context,
      players: workspace.manualPlayers, roster: workspace.roster, rules: workspace.rules, lockedAssignments: workspace.lockedAssignments,
      games: [{ id: "local-game", date: workspace.context.startDate, startsAt: "2026-10-08T20:00:00Z",
        teamAbbreviation: "CAR", opponent: "NYR", home: true, status: "scheduled" }],
      forecasts: [], realized: {}, opponent: null, evidence: { schedule: { source: "Local fixture", asOf: workspace.context.asOf,
        seasonId: workspace.context.seasonId, completeness: "complete", limitations: [] } } };
    const refreshed: PlanningSnapshot = { ...initial, id: "local-provider-new", context: { ...initial.context, asOf: "2026-10-08T13:00:00Z" },
      players: initial.players.map(row => row.id === bravo.id ? { ...row, eligiblePositions: ["C", "LW"] } : row),
      rules: { ...initial.rules, rosterSlots: { C: 1, LW: 1, BN: 1 } } };
    let providerReads = 0;
    const fetch = vi.fn((url: string) => Promise.resolve(url.endsWith("/provider")
      ? { ok: true, json: async () => ({ success: true, snapshot: ++providerReads === 1 ? initial : refreshed,
        capabilities: { roster: true, settings: true, availability: true, waivers: false, acquisitions: false, limitations: [] } }) }
      : { ok: true, json: async () => url.includes("/data?") ? { success: true, data: { ...data, games: initial.games, evidence: initial.evidence } }
        : url.endsWith("/access") ? { data: { eligible: true, capabilities: ["rso_sync"] } } : { data: null } }));
    vi.stubGlobal("fetch", fetch);
    let evaluated: { snapshot: PlanningSnapshot; result: PlanningResult };
    planningState.evaluate = (snapshot, intent) => {
      const result = planRoster(snapshot, intent);
      evaluated = { snapshot, result };
      return result;
    };
    const saved = () => JSON.parse(window.localStorage.getItem(WORKSPACE_KEY)!);
    const assertReadback = (assignments: [string, string][]) => {
      expect(evaluated.result.selected).toMatchObject({ legal: true, activeGames: assignments.length,
        projectedValue: null, comparisonEligible: false, recommendation: { eligible: false, mode: "schedule_capacity" } });
      expect(evaluated.result.selected.assignments.map(row => [row.playerId, row.slotId]).sort()).toEqual(assignments);
      const groups = compactGroups({ snapshot: evaluated.snapshot, roster: evaluated.snapshot.roster, rules: evaluated.snapshot.rules,
        players: evaluated.snapshot.players, assignments: evaluated.result.selected.assignments, intent: saved().intent,
        date: workspace.context.startDate, ready: true });
      expect(groups.flatMap(group => group.rows).filter(row => row.assigned).map(row => [row.playerId, row.slot]).sort()).toEqual(assignments);
      expect(screen.getAllByRole("button", { name: /Schedule details for .*Fantasy assigned/ })).toHaveLength(assignments.length);
      expect(screen.getByRole("button", { name: "Show lineup by player" }).getAttribute("aria-pressed")).toBe("true");
      expect(saved().intent.steps).toEqual(workspace.intent.steps);
    };
    window.localStorage.setItem(WORKSPACE_KEY, JSON.stringify(workspace));
    const view = render(<RosterScheduleOptimizer />);
    await waitFor(() => expect(providerReads).toBe(1));
    fireEvent.click(screen.getByRole("button", { name: "Show lineup by player" }));
    assertReadback([[alpha.id, "C#1"]]);
    expect(within(screen.getByLabelText("Alpha Center range contribution")).getByLabelText("AGP: 1")).toBeTruthy();
    expect(within(screen.getByLabelText("Bravo Center range contribution")).getByLabelText("DUST/bench: 1")).toBeTruthy();
    expect(screen.getByRole("button", { name: /Schedule details for Bravo Center, BN/ }).getAttribute("aria-label")).toContain("Local Bench");
    fireEvent.change(screen.getByRole("combobox", { name: "Goalie choice" }), { target: { value: "cover" } });
    fireEvent.click(screen.getByRole("button", { name: "Refresh provider" }));
    await waitFor(() => expect(saved().context.asOf).toBe(refreshed.context.asOf));
    assertReadback([[alpha.id, "C#1"], [bravo.id, "LW#1"]]);
    expect(within(screen.getByLabelText("Bravo Center range contribution")).getByLabelText("AGP: 1")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Undo" }));
    expect(saved().intent.goalieCoverage).toBe("accept_risk");
    expect(saved()).toMatchObject({ context: refreshed.context, rules: refreshed.rules, roster: refreshed.roster,
      lockedAssignments: workspace.lockedAssignments, intent: { protectedPlayerIds: [alpha.id], excludedPlayerIds: [charlie.id] } });
    assertReadback([[alpha.id, "C#1"], [bravo.id, "LW#1"]]);
    view.unmount();
    render(<RosterScheduleOptimizer />);
    await waitFor(() => expect(providerReads).toBe(3));
    fireEvent.click(screen.getByRole("button", { name: "Show lineup by player" }));
    assertReadback([[alpha.id, "C#1"], [bravo.id, "LW#1"]]);
    expect(saved().intent.goalieCoverage).toBe("accept_risk");
    expect(fetch.mock.calls.every(([url]) => url.startsWith("/api/v1/roster-schedule-optimizer/"))).toBe(true);
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
    expect(screen.getByText("Provider inputs refreshed. Selected moves were kept.").getAttribute("role")).toBe("status");
    const beforeFailure = saved();
    fireEvent.click(screen.getByRole("button", { name: "Refresh provider" }));
    expect(await screen.findByText("Provider temporarily unavailable.")).toBeTruthy();
    expect(screen.getByRole("alert").textContent).toContain("Try Refresh provider again.");
    expect((screen.getByRole("button", { name: "Refresh provider" }) as HTMLButtonElement).disabled).toBe(false);
    expect(saved()).toEqual(beforeFailure);
    fireEvent.click(screen.getByRole("button", { name: "Refresh provider" }));
    expect(await screen.findByText("Provider refresh completed. Inputs are unchanged; selected moves were kept.")).toBeTruthy();
    expect(screen.queryByRole("alert")).toBeNull();
    expect(saved()).toEqual(beforeFailure);
    view.unmount();
    const reopened = render(<RosterScheduleOptimizer />);
    await waitFor(() => expect(providerReads).toBe(5));
    await screen.findByText("Bravo Center is no longer verified as available.");
    fireEvent.click(screen.getByRole("button", { name: "Undo" }));
    expect(screen.getByText("Bravo Center is no longer verified as available.")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Accept suggested repair" })).toBeTruthy();
    expect(saved()).toMatchObject({ context: refreshed.context, rules: refreshed.rules, roster: refreshed.roster,
      lockedAssignments: workspace.lockedAssignments, intent: { goalieCoverage: "accept_risk", steps: workspace.intent.steps,
        protectedPlayerIds: workspace.intent.protectedPlayerIds, excludedPlayerIds: workspace.intent.excludedPlayerIds } });
    expect(saved().manualPlayers.some((row: { id: string }) => row.id === newRosterPlayer.id)).toBe(true);
    reopened.unmount(); render(<RosterScheduleOptimizer />);
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
    { label: "Time zone", value: "America/Chicago", field: "timeZone" as const },
  ])("refreshes the selected $field and ignores a late response for the previous scope", async ({ label, value, field }) => {
    authState.user = { id: "manager" };
    const workspace = defaultWorkspace();
    workspace.context = { ...workspace.context, provider: "yahoo", leagueId: "first-league", teamId: "team", timeZone: "UTC" };
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
    expect(pending[0].init?.signal?.aborted).toBe(false);
    expect(await screen.findByText("Refreshing provider inputs…")).toBeTruthy();
    fireEvent.change(screen.getByLabelText(label), { target: { value } });
    if (field === "timeZone") fireEvent.blur(screen.getByLabelText(label));
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
    expect(screen.getByText("Provider inputs refreshed. Selected moves were kept.")).toBeTruthy();
    await act(async () => pending[0].resolve(response({ ...workspace.context, asOf: "2026-10-08T12:00:00Z" })));
    expect(saved().context).toEqual(currentContext);
    expect(saved().roster).toEqual(snapshot(currentContext).roster);
    expect(screen.getByText("Provider inputs refreshed. Selected moves were kept.")).toBeTruthy();
    expect((screen.getByRole("button", { name: "Refresh provider" }) as HTMLButtonElement).disabled).toBe(false);
  });

  it("adopts Yahoo's league timezone without losing the selected team, horizon or intent", async () => {
    authState.user = { id: "manager" };
    const workspace = defaultWorkspace();
    workspace.context = { ...workspace.context, provider: "yahoo", leagueId: "league", teamId: "team", timeZone: "UTC" };
    workspace.roster = [{ playerId: player.id, position: "bench" }];
    workspace.manualPlayers = [player];
    workspace.intent.protectedPlayerIds = [player.id];
    workspace.intent.excludedPlayerIds = ["fhfh:excluded"];
    const providerPlayer = { ...player, availability: "rostered" as const };
    const snapshot: PlanningSnapshot = { id: "provider-league-zone", context: { ...workspace.context, timeZone: "America/New_York" },
      players: [providerPlayer], roster: [{ playerId: player.id, position: "active" }], games: [], forecasts: [],
      rules: { ...workspace.rules, rosterSlots: { C: 1 } }, lockedAssignments: [], realized: {}, opponent: null, evidence: {} };
    window.localStorage.setItem(WORKSPACE_KEY, JSON.stringify(workspace));
    const requests = vi.fn((url: string, init?: RequestInit) => Promise.resolve({ ok: true, json: async () => url.includes("/data?") ? { success: true, data }
      : url.endsWith("/access") ? { data: { eligible: true, capabilities: ["rso_sync"] } }
        : url.endsWith("/provider") ? { success: true, snapshot,
          capabilities: { roster: true, settings: true, availability: true, waivers: false, acquisitions: false, limitations: [] } } : { data: null } }));
    vi.stubGlobal("fetch", requests);
    render(<RosterScheduleOptimizer />);
    const saved = () => JSON.parse(window.localStorage.getItem(WORKSPACE_KEY)!);
    await waitFor(() => expect(saved().context).toEqual(snapshot.context));
    expect(saved()).toMatchObject({ roster: snapshot.roster, rules: snapshot.rules, intent: workspace.intent });
    expect(screen.queryByText(/Provider inputs do not match/)).toBeNull();
    expect(requests.mock.calls.filter(([url]) => url.endsWith("/provider"))).toHaveLength(1);
    expect(requests.mock.calls.some(([url, init]) => url.endsWith("/provider")
      && JSON.parse(init?.body as string).timeZone === "UTC")).toBe(true);
    expect(requests.mock.calls.some(([url]) => url.includes("/data?") && url.includes("timeZone=America%2FNew_York"))).toBe(true);
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
    expect(screen.getByRole("button", { name: "All players" }).getAttribute("aria-pressed")).toBe("true");
    await waitFor(() => expect(authenticatedFetch.mock.calls.some(([url, init]) => url.endsWith("/access") && (init?.headers as Record<string, string>)?.Authorization === "Bearer token-second")).toBe(true));
    await waitFor(() => expect(authenticatedFetch.mock.calls.some(([url, init]) => url.includes("/workspace?") && (init?.headers as Record<string, string>)?.Authorization === "Bearer token-second")).toBe(true));
    expect(firstRequest?.signal?.aborted).toBe(true);
    expect((screen.getByRole("button", { name: "Refresh provider" }) as HTMLButtonElement).disabled).toBe(true);
    expect(screen.queryByText("Refreshing provider inputs…")).toBeNull();
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
    fireEvent.click(screen.getByRole("checkbox", { name: /^Protect / }));
    expect(JSON.parse(window.localStorage.getItem(WORKSPACE_KEY)!).intent).toEqual(workspace.intent);
    fireEvent.click(screen.getByRole("button", { name: "Continue manually" }));
    const forked = JSON.parse(window.localStorage.getItem(WORKSPACE_KEY)!);
    expect(forked.context.provider).toBe("manual");
    expect(forked.intent).toEqual(workspace.intent);
    expect(forked.roster).toEqual(workspace.roster);
    expect(forked.lockedAssignments).toEqual(workspace.lockedAssignments);
    fireEvent.click(screen.getByRole("checkbox", { name: /^Protect / }));
    expect(JSON.parse(window.localStorage.getItem(WORKSPACE_KEY)!).intent.protectedPlayerIds).toEqual([]);
  });

  it.each([
    { name: "eligible", older: "eligible", newer: "revoked" },
    { name: "failed", older: "failed", newer: "eligible" },
    { name: "eligible after failed revalidation", older: "eligible", newer: "failed" },
  ])("ignores an older same-account $name access response after a newer refresh", async ({ older, newer }) => {
    authState.user = { id: "manager" };
    const workspace = defaultWorkspace();
    workspace.context = { ...workspace.context, provider: "yahoo", leagueId: "league", teamId: "team" };
    window.localStorage.setItem(WORKSPACE_KEY, JSON.stringify(workspace));
    const pending: Array<{ resolve: (value: unknown) => void; reject: (reason: unknown) => void }> = [];
    vi.stubGlobal("fetch", vi.fn((url: string) => {
      if (url.endsWith("/access")) return new Promise((resolve, reject) => pending.push({ resolve, reject }));
      return Promise.resolve({ ok: true, json: async () => url.includes("/data?") ? { success: true, data } : { data: null } });
    }));
    vi.spyOn(document, "visibilityState", "get").mockReturnValue("visible");
    render(<RosterScheduleOptimizer />);
    await waitFor(() => expect(pending).toHaveLength(1));
    fireEvent(document, new Event("visibilitychange"));
    await waitFor(() => expect(pending).toHaveLength(2));
    const settle = async (index: number, state: string) => act(async () => {
      if (state === "failed") pending[index].reject(new Error("Access unavailable"));
      else pending[index].resolve({ ok: true, json: async () => ({ data: { eligible: state === "eligible", capabilities: state === "eligible" ? ["rso_sync"] : [] } }) });
    });
    await settle(1, newer);
    const refresh = screen.getByRole("button", { name: "Refresh provider" }) as HTMLButtonElement;
    expect(refresh.disabled).toBe(newer !== "eligible");
    expect(Boolean(screen.queryByText(/access could not be checked/))).toBe(newer === "failed");
    await settle(0, older);
    expect(refresh.disabled).toBe(newer !== "eligible");
    expect(Boolean(screen.queryByText(/access could not be checked/))).toBe(newer === "failed");
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

  it("reports account-save failure, allows retry and preserves the submitted snapshot while local edits continue", async () => {
    authState.user = { id: "manager" };
    let release!: (response: unknown) => void;
    const saves: RequestInit[] = [];
    vi.stubGlobal("fetch", vi.fn((url: string, init?: RequestInit) => {
      if (url.endsWith("/workspace") && init?.method === "PUT") {
        saves.push(init);
        return saves.length === 1 ? Promise.resolve({ ok: false, json: async () => ({ error: "Account save temporarily unavailable." }) })
          : new Promise(resolve => { release = resolve; });
      }
      return Promise.resolve({ ok: true, json: async () => url.includes("/data?") ? { success: true, data }
        : url.endsWith("/access") ? { data: { eligible: true, capabilities: ["rso_account_save"] } } : { data: null } });
    }));
    render(<RosterScheduleOptimizer />);
    fireEvent.click(await screen.findByRole("button", { name: "Save to account" }));
    expect((await screen.findByRole("alert")).textContent).toContain("Account save temporarily unavailable.");
    expect(screen.getByRole("alert").textContent).toContain("try Save to account again");
    const retry = screen.getByRole("button", { name: "Save to account" }) as HTMLButtonElement;
    expect(retry.disabled).toBe(false);
    const submitted = JSON.parse(window.localStorage.getItem(WORKSPACE_KEY)!);
    fireEvent.click(retry);
    expect(retry.disabled).toBe(true);
    await waitFor(() => expect(saves).toHaveLength(2));
    fireEvent.click(retry);
    fireEvent.change(screen.getByRole("combobox", { name: "Goalie choice" }), { target: { value: "cover" } });
    const payload = JSON.parse(saves[1].body as string);
    expect(payload.workspace).toEqual(submitted);
    expect(payload.snapshot.context).toEqual(submitted.context);
    expect(payload.snapshot.roster).toEqual(submitted.roster);
    expect(payload.expectedVersion).toBeNull();
    await act(async () => release({ ok: true, json: async () => ({ data: { version: 4 } }) }));
    expect(screen.getByText("Submitted inputs saved to account. Newer local changes still need saving.").getAttribute("role")).toBe("status");
    expect(screen.queryByRole("alert")).toBeNull();
    expect(retry.disabled).toBe(false);
    expect(saves).toHaveLength(2);
    expect(JSON.parse(window.localStorage.getItem(WORKSPACE_KEY)!).intent.goalieCoverage).toBe("cover");
  });

  it("reports checking access before explaining a missing provider team", async () => {
    authState.user = { id: "manager" };
    const workspace = defaultWorkspace(); workspace.context.provider = "yahoo";
    window.localStorage.setItem(WORKSPACE_KEY, JSON.stringify(workspace));
    let release!: (response: unknown) => void;
    vi.stubGlobal("fetch", vi.fn((url: string) => url.endsWith("/access") ? new Promise(resolve => { release = resolve; })
      : Promise.resolve({ ok: true, json: async () => url.includes("/data?") ? { success: true, data } : { data: null } })));
    render(<RosterScheduleOptimizer />);
    expect(document.getElementById("rso-provider-refresh-status")?.textContent).toBe("Checking access for provider synchronization…");
    await waitFor(() => expect(release).toBeTypeOf("function"));
    await act(async () => release({ ok: true, json: async () => ({ data: { eligible: true, capabilities: ["rso_sync"] } }) }));
    expect(document.getElementById("rso-provider-refresh-status")?.textContent).toBe("Select an owned team before refreshing provider inputs.");
    expect((screen.getByRole("button", { name: "Refresh provider" }) as HTMLButtonElement).disabled).toBe(true);
  });

  it("explains disabled manual controls and invalid rule-window dates using visible descriptions", async () => {
    vi.stubGlobal("fetch", fetchMock);
    render(<RosterScheduleOptimizer />);
    await screen.findByRole("searchbox", { name: "Find a player" });
    fireEvent.click(screen.getByRole("button", { name: "Roster" }));
    const reason = (name: string, text: string) => {
      const control = screen.getByRole("button", { name }) as HTMLButtonElement;
      expect(control.disabled).toBe(true);
      const description = document.getElementById(control.getAttribute("aria-describedby")!);
      expect(description?.textContent).toContain(text);
      expect(description?.hidden).toBe(false);
    };
    reason("Undo", "No edits to undo.");
    reason("Review pasted names", "Paste at least one roster name to review.");
    fireEvent.click(screen.getByText("League rules and scoring", { selector: "summary" }));
    await waitFor(() => reason("Confirm planning inputs", "Add roster players before confirming inputs."));
    fireEvent.click(screen.getByText("Locked lineup assignments", { selector: "summary" }));
    reason("Add confirmed lock", "Add a roster player before entering a confirmed lock.");
    reason("Previous matchup week", "No matchup weeks are available");
    reason("Next matchup week", "No matchup weeks are available");
    fireEvent.change(screen.getByRole("searchbox", { name: "Find a player" }), { target: { value: "Alpha" } });
    fireEvent.click(screen.getByRole("button", { name: "Add" }));
    fireEvent.change(screen.getByRole("searchbox", { name: "Find a player" }), { target: { value: "Alpha" } });
    reason("Add", "Already in your roster.");
    fireEvent.click(screen.getByRole("button", { name: "Confirm planning inputs" }));
    reason("Confirm planning inputs", "Inputs are already confirmed for this session.");
    fireEvent.click(screen.getByText("Scoring, budgets, and lock windows", { selector: "summary" }));
    fireEvent.change(screen.getByLabelText("Through"), { target: { value: "2026-01-01" } });
    reason("Add acquisition period", "Start date must be on or before end date.");
    reason("Add lineup window", "Start date must be on or before end date.");
    fireEvent.change(screen.getByLabelText("From"), { target: { value: "" } });
    reason("Add acquisition period", "Select start and end dates");
    reason("Add lineup window", "Select start and end dates");
  });

  it("explains empty manual continuation without enabling an unavailable action", async () => {
    const workspace = defaultWorkspace(); workspace.context.provider = "yahoo";
    window.localStorage.setItem(WORKSPACE_KEY, JSON.stringify(workspace));
    vi.stubGlobal("fetch", vi.fn(() => Promise.resolve({ ok: true, json: async () => ({ success: true, data: null }) })));
    render(<RosterScheduleOptimizer />);
    const continuation = screen.getByRole("button", { name: "Continue manually" }) as HTMLButtonElement;
    expect(continuation.disabled).toBe(true);
    expect(document.getElementById(continuation.getAttribute("aria-describedby")!)?.textContent).toContain("No snapshot or roster inputs to continue from. Select Manual to start a plan.");
  });

  it("explains first, last and custom matchup-week navigation boundaries", async () => {
    const workspace = defaultWorkspace();
    const weeks = [{ gameKey: "season", week: 1, startDate: workspace.context.startDate, endDate: workspace.context.endDate },
      { gameKey: "season", week: 2, startDate: "2026-11-01", endDate: "2026-11-07" }];
    window.localStorage.setItem(WORKSPACE_KEY, JSON.stringify(workspace));
    vi.stubGlobal("fetch", vi.fn((url: string) => Promise.resolve({ ok: url.includes("/data?"), json: async () => ({ success: true, data: { ...data, matchupWeeks: weeks } }) })));
    render(<RosterScheduleOptimizer />);
    await screen.findByText("First matchup week; no previous week is available.");
    const previous = screen.getByRole("button", { name: "Previous matchup week" }) as HTMLButtonElement;
    const next = screen.getByRole("button", { name: "Next matchup week" }) as HTMLButtonElement;
    expect(previous.disabled).toBe(true); expect(next.disabled).toBe(false);
    fireEvent.click(next);
    expect(await screen.findByText("Last matchup week; no next week is available.")).toBeTruthy();
    expect(previous.disabled).toBe(false); expect(next.disabled).toBe(true);
    fireEvent.change(screen.getByLabelText("Through"), { target: { value: "2026-11-08" } });
    expect(await screen.findByText("Select a listed matchup week to navigate.")).toBeTruthy();
    expect(previous.disabled).toBe(true); expect(next.disabled).toBe(true);
  });

  it.each([
    { gate: "input", reason: "Review and confirm planning inputs before selecting this plan." },
    { gate: "scoring", reason: "Enter league scoring before selecting this plan." },
    { gate: "legal", reason: "Plan rule checks failed. Selected player is protected." },
    { gate: "budget", reason: "Acquisition budget is unverified. Review acquisition periods and remaining moves." },
    { gate: "hold", reason: "This plan keeps the roster unchanged; there are no moves to select." },
    { gate: "ready", reason: null },
  ])("explains the $gate Select plan gate and acknowledges selection when summaries match", async ({ gate, reason }) => {
    vi.stubGlobal("fetch", fetchMock);
    const workspace = defaultWorkspace();
    workspace.roster = [{ playerId: player.id, position: "bench" }]; workspace.manualPlayers = [player];
    workspace.rules.scoring.weights = gate === "scoring" ? {} : { GOALS: 1 };
    const step: PlanStep = { id: "old-step", type: "drop", playerId: player.id, at: `${workspace.context.endDate}T12:00:00Z`, effectiveAt: `${workspace.context.endDate}T12:00:00Z`, conditional: false, dependsOn: [] };
    workspace.intent.steps = [step];
    const alternativeSteps = gate === "hold" ? [] : [{ ...step, id: "alternative-step" }];
    planningState.evaluate = (snapshot, intent) => {
      const result = planRoster(snapshot, intent);
      return { ...result, alternatives: [{ ...result.selected, steps: alternativeSteps, legal: gate !== "legal", budgetVerified: gate !== "budget", recommendation: { ...result.selected.recommendation!, eligible: false, mode: "schedule_capacity" as const }, limitations: gate === "legal" ? ["Selected player is protected."] : [] }] };
    };
    window.localStorage.setItem(WORKSPACE_KEY, JSON.stringify(workspace));
    render(<RosterScheduleOptimizer />);
    const select = await screen.findByRole("button", { name: "Select plan" }) as HTMLButtonElement;
    if (gate !== "hold") expect(screen.getByText("Hypothetical schedule comparison only. Net fantasy points and drop cost are unknown; additional games do not establish a better roster.")).toBeTruthy();
    fireEvent.click(screen.getByText("League rules and scoring", { selector: "summary" }));
    if (gate !== "input") fireEvent.click(screen.getByRole("button", { name: "Confirm planning inputs" }));
    if (reason) {
      expect(select.disabled).toBe(true);
      expect(document.getElementById(select.getAttribute("aria-describedby")!)?.textContent).toBe(reason);
      fireEvent.click(select);
      expect(JSON.parse(window.localStorage.getItem(WORKSPACE_KEY)!).intent).toEqual(workspace.intent);
    } else {
      expect(select.disabled).toBe(false);
      const summary = screen.getByRole("region", { name: "Plan summary" }).textContent;
      fireEvent.click(select);
      await act(async () => {});
      expect(screen.getByText("Alternative 1 selected. Confirm roster changes with your provider.").getAttribute("role")).toBe("status");
      expect(screen.getByRole("region", { name: "Plan summary" }).textContent).toBe(summary);
      expect(JSON.parse(window.localStorage.getItem(WORKSPACE_KEY)!).intent.steps).toEqual(alternativeSteps);
    }
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
    expect(screen.getByRole("button", { name: "Save to account" }).getAttribute("aria-busy")).toBe("true");
    expect(screen.getByText("Saving to account…").getAttribute("role")).toBe("status");
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
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-10-10T13:00:00Z"));
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
    const snapshot = { id: "saved-1", context: saved.context, players: saved.manualPlayers, roster: saved.roster, games: [], forecasts: [{
      playerId: player.id, gameId: "old-game", conditioning: "unconditional" as const, stats: { GOALS: 1 },
      startProbability: null, confirmedStart: false, revisionId: "saved-original", limitations: [],
      issuedAt: saved.context.asOf, expiresAt: "2026-09-02T12:00:00Z",
    }], rules: saved.rules, lockedAssignments: saved.lockedAssignments, realized: {}, opponent: null, evidence: {} };
    const currentData: PlanningData = { ...data,
      games: [{ id: "current-game", date: "2026-10-10", startsAt: "2026-10-10T16:00:00Z", teamAbbreviation: "CAR", opponent: "NJD", home: true, status: "scheduled" }],
      evidence: { schedule: { source: "roster_optimizer_team_games", asOf: "2026-10-10T12:00:00Z", seasonId: 20262027, completeness: "complete", limitations: [] } },
    };
    vi.stubGlobal("fetch", vi.fn((url: string) => Promise.resolve({ ok: true, json: async () => url.includes("/data?") ? { success: true, data: currentData } : url.endsWith("/access") ? { data: { eligible: false, capabilities: [] } } : { data: { workspace: saved, snapshot, version: 1, updatedAt: saved.context.asOf } } })));
    render(<RosterScheduleOptimizer />);
    fireEvent.click(await screen.findByRole("button", { name: "View account save" }));
    expect(planningTimeText(/^Saved /).textContent).toContain("Sep 1");
    expect((screen.getByLabelText("Planning setup") as HTMLFieldSetElement).disabled).toBe(true);
    expect(screen.getByText("Confirm planning inputs", { selector: "button" }).hasAttribute("disabled")).toBe(true);
    await waitFor(() => expect(JSON.parse(window.localStorage.getItem(WORKSPACE_KEY)!)).toMatchObject({
      intent: saved.intent, lockedAssignments: saved.lockedAssignments,
    }));
    const summary = (await screen.findByText("Shared schedule: complete")).closest("summary")!;
    const savedTime = planningTimeText(/^Saved /).textContent;
    expect(summary.closest("details")!.textContent).not.toContain("schedule warning");
    vi.setSystemTime(new Date("2026-10-10T15:00:00Z"));
    fireEvent.click(screen.getByRole("button", { name: /^Candidates$/ }));
    expect(summary.closest("details")!.textContent).toContain("Provisional 2-hour schedule warning.");
    expect(planningTimeText(/^Saved /).textContent).toBe(savedTime);
    expect(JSON.parse(window.localStorage.getItem(WORKSPACE_KEY)!).context.asOf).toBe(saved.context.asOf);
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

describe("compact RSO schedule", () => {
  it("defaults future horizons to their first valid day while retaining today and past-week behavior", () => {
    const week = scheduleWeek("2026-10-12");
    expect(defaultScheduleDate(week, "2026-10-07")).toBe("2026-10-12");
    expect(defaultScheduleDate(week, "2026-10-14")).toBe("2026-10-14");
    expect(defaultScheduleDate(week.slice(2), "2026-10-07")).toBe("2026-10-14");
    expect(defaultScheduleDate([...scheduleWeek("2026-10-05").slice(4), ...week], "2026-10-07")).toBe("2026-10-09");
    expect(defaultScheduleDate(scheduleWeek("2026-09-28"), "2026-10-07")).toBe("2026-09-30");
    expect(defaultScheduleDate(scheduleWeek("2026-09-28").slice(1, 4), "2026-10-07")).toBe("2026-09-29");
    expect(defaultScheduleDate(scheduleWeek("2026-09-28").slice(0, 5), "2026-10-07")).toBe("2026-09-28");
  });
  const displayFixture = (count = 20) => {
    const workspace = defaultWorkspace();
    workspace.context = { ...workspace.context, startDate: "2026-10-05", endDate: "2026-10-11", asOf: "2026-10-05T00:00:00Z", timeZone: "UTC" };
    workspace.rules = { ...workspace.rules, rosterSlots: { C: 2, LW: 2, RW: 2, D: 4, UTIL: 2, G: 2, BN: count === 25 ? 9 : 6, IR: 1, "IR+": 1 } };
    const positions = ["C", "C", "LW", "LW", "RW", "RW", "D", "D", "D", "D", "C", "LW", "G", "G"];
    const players: PlanningPlayer[] = Array.from({ length: count === 19 ? 20 : count }, (_, index) => ({ ...player, id: `p${index}`, name: `Player Surname${index}`, eligibilityVerified: true,
      eligiblePositions: index === 0 ? ["C", "LW"] : [positions[index] ?? "C"], playerClass: positions[index] === "G" ? "goalie" as const : "skater" as const,
      reserveEligibility: ["IR", "IR+"] as Array<"IR" | "IR+"> }));
    workspace.roster = players.map((member, index) => ({ playerId: member.id, position: count === 25 && index >= 23 ? index === 23 ? "IR" : "IR+" : index < 14 ? "active" : "bench" }));
    if (count === 19) workspace.roster = workspace.roster.filter(row => row.playerId !== "p9");
    const snapshot: PlanningSnapshot = { id: "compact", context: workspace.context, rules: workspace.rules, players, roster: workspace.roster,
      games: [{ id: "game", date: "2026-10-05", startsAt: "2026-10-05T23:00:00Z", teamAbbreviation: "CAR", opponent: "NYR", home: true, status: "scheduled" }],
      forecasts: [], lockedAssignments: [], realized: {}, opponent: null, evidence: { schedule: { source: "fixture", asOf: workspace.context.asOf, seasonId: workspace.context.seasonId, completeness: "complete", limitations: [] } } };
    const slots = ["C#1", "C#2", "LW#1", "LW#2", "RW#1", "RW#2", "D#1", "D#2", "D#3", "D#4", "UTIL#1", "UTIL#2", "G#1", "G#2"];
    const assignments = slots.map((slotId, index) => ({ date: "2026-10-05", playerId: `p${index}`, gameId: "game", slotId, locked: false }))
      .filter(row => workspace.roster.some(member => member.playerId === row.playerId));
    return { snapshot, roster: workspace.roster, rules: workspace.rules, players, assignments, intent: workspace.intent, date: "2026-10-05", ready: true };
  };
  it("reads range metrics from the supplied contribution ledger rather than treating the displayed week as the horizon", () => {
    const input = displayFixture();
    const contribution = { playerId: "p0", scheduledGames: 4, knownScheduledGames: 4, activeGames: 3, knownActiveGames: 3,
      benchGames: 1, knownBenchGames: 1, projectedPoints: 12.375, days: [] };
    render(<CompactSchedule {...input} dates={[...scheduleWeek(input.date), ...scheduleWeek("2026-10-12")]}
      contributions={new Map([["p0", contribution]])} today={input.date} selectDate={vi.fn()} selectPlayer={vi.fn()} />);
    const row = screen.getByRole("button", { name: /Schedule details for Player Surname0,/ }).closest("tr")!;
    for (const label of ["Range GP: 4", "Range AGP: 3", "Range DUST/bench: 1", "Range active points: 12.4"])
      expect(within(row).getByRole("cell", { name: label })).toBeTruthy();
  });
  it.each([19, 20, 25])("accounts for %i players without duplicating dual eligibility and preserves configured vacancies", count => {
    const input = displayFixture(count);
    const before = JSON.stringify(input);
    const groups = compactGroups(input);
    expect(groups.map(group => group.position)).toEqual(count === 25 ? ["C", "LW", "RW", "D", "UTIL", "G", "BN", "IR", "IR+"] : ["C", "LW", "RW", "D", "UTIL", "G", "BN"]);
    const rows = groups.flatMap(group => group.rows);
    expect(rows.filter(row => row.playerId)).toHaveLength(count);
    expect(new Set(rows.flatMap(row => row.playerId ? [row.playerId] : [])).size).toBe(count);
    expect(rows.find(row => row.id === "C#1")?.player?.eligiblePositions).toEqual(["C", "LW"]);
    if (count === 19) expect(rows.find(row => row.id === "D#4")?.status).toBe("Open D");
    expect(JSON.stringify(input)).toBe(before);
    if (count === 20) {
      const { BN, ...rosterSlots } = input.rules.rosterSlots;
      input.rules.rosterSlots = { ...rosterSlots, bench: BN };
      expect(compactGroups(input).find(group => group.position === "BN")?.rows.map(row => row.playerId))
        .toEqual(groups.find(group => group.position === "BN")?.rows.map(row => row.playerId));
    }
  });
  it("retains a non-playing lock and weekly window occupant instead of inventing an open slot", () => {
    const input = displayFixture();
    input.snapshot.games = [];
    input.snapshot.lockedAssignments = [{ date: input.date, playerId: "p0", slotId: "C#1" }];
    input.assignments = [];
    let row = compactGroups(input).flatMap(group => group.rows).find(row => row.id === "C#1")!;
    expect(row.playerId).toBe("p0"); expect(row.status).toBe("Held · no active game"); expect(row.assigned).toBe(false);
    expect(compactGroups(input).find(group => group.position === "BN")?.rows.some(row => row.playerId === "p1")).toBe(true);
    input.rules.lineupMode = "weekly";
    input.rules.lineupPeriods = [{ id: "week", start: "2026-10-05T00:00:00Z", end: "2026-10-12T00:00:00Z", lockAt: "2026-10-05T00:00:00Z" }];
    input.date = "2026-10-07";
    row = compactGroups(input).flatMap(group => group.rows).find(row => row.id === "C#1")!;
    expect(row.playerId).toBe("p0"); expect(row.status).not.toContain("Open");
  });
  it("places all unstarted McDavid, Panarin and Batherson in local Bench after 13 filled slots", () => {
    const input = displayFixture();
    input.rules.rosterSlots.UTIL = 1;
    input.rules.rosterSlots.BN = 2;
    input.assignments = input.assignments.filter(row => row.slotId !== "UTIL#2");
    input.roster = input.roster.filter(row => !["p11", "p17", "p18", "p19"].includes(row.playerId));
    input.snapshot.roster = input.roster;
    for (const [index, name, positions] of [[14, "McDavid", ["C", "UTIL"]], [15, "Panarin", ["LW", "UTIL"]], [16, "Batherson", ["LW", "RW", "UTIL"]]] as const) {
      input.players[index].name = name;
      input.players[index].eligiblePositions = [...positions];
      input.roster.find(row => row.playerId === `p${index}`)!.position = "active";
    }
    const before = JSON.stringify(input);
    const groups = compactGroups(input);
    const rows = groups.flatMap(group => group.rows);
    expect(groups.some(group => ["Review", "UN"].includes(group.position))).toBe(false);
    expect(groups.find(group => group.position === "BN")?.rows.map(row => row.player?.name)).toEqual(["McDavid", "Panarin", "Batherson"]);
    expect(summarizeCompactDay(groups, input.snapshot, input.date)).toMatchObject({ capacity: 13, occupied: 13, unresolved: 0 });
    expect(new Set(rows.flatMap(row => row.playerId ? [row.playerId] : [])).size).toBe(16);
    render(<CompactSchedule {...input} dates={scheduleWeek(input.date)} today={input.date} selectDate={vi.fn()} selectPlayer={vi.fn()} />);
    const bench = screen.getByRole("button", { name: "Bench 3, collapse" });
    expect(document.getElementById(bench.getAttribute("aria-describedby")!)?.textContent).toContain("Local simulated Bench, not Yahoo placement. 3 players / 2 configured places · 1 over capacity; all retained.");
    for (const name of ["McDavid", "Panarin", "Batherson"]) {
      const row = screen.getByRole("button", { name: new RegExp(`Schedule details for ${name}, BN,`) }).closest("tr")!;
      expect(row.closest("tbody")?.getAttribute("data-position")).toBe("BENCH");
      expect(within(row).getByRole("cell", { name: /Has game · Not fantasy assigned/ })).toBeTruthy();
    }
    fireEvent.click(bench);
    expect(document.querySelectorAll('tr[data-compact-row][hidden]')).toHaveLength(3);
    fireEvent.click(bench);
    expect(screen.getByRole("button", { name: /Schedule details for Batherson,/ })).toBeTruthy();
    expect(JSON.stringify(input)).toBe(before);
  });
  it("keeps eligibility, team and source warnings on unstarted Bench rows", () => {
    const input = displayFixture();
    input.assignments = [];
    input.players[0].eligibilityVerified = false;
    input.players[0].teamAbbreviation = null;
    input.snapshot.evidence.schedule!.completeness = "partial";
    const groups = compactGroups(input);
    const row = groups.find(group => group.position === "BN")?.rows.find(row => row.playerId === "p0")!;
    expect(row.assigned).toBe(false);
    for (const warning of ["Eligibility unverified", "Team unknown", "Schedule unknown"]) expect(row.status).toContain(warning);
    expect(groups.find(group => group.position === "BN")?.rows).toHaveLength(20);
    render(<CompactSchedule {...input} dates={scheduleWeek(input.date)} today={input.date} selectDate={vi.fn()} selectPlayer={vi.fn()} />);
    expect(screen.getByRole("button", { name: /Schedule details for Player Surname0, BN,/ }).getAttribute("aria-label")).toContain(row.status);
    const unavailable = compactGroups({ ...input, snapshot: null, ready: false }).find(group => group.position === "BN")!.rows;
    expect(unavailable).toHaveLength(20);
    expect(unavailable.every(row => !row.assigned && row.status.includes("Source unavailable"))).toBe(true);
  });
  it("preserves active and Bench locks while warning on unsupported and conflicting slot claims", () => {
    const input = displayFixture();
    input.snapshot.lockedAssignments = [{ date: input.date, playerId: "p0", slotId: null },
      { date: input.date, playerId: "p1", slotId: "C#2" }, { date: input.date, playerId: "p2", slotId: "X#1" },
      { date: input.date, playerId: "p3", slotId: "LW#2" }, { date: input.date, playerId: "p4", slotId: "LW#2" }];
    input.assignments = input.assignments.filter(row => !["p1", "p2", "p3", "p4"].includes(row.playerId));
    const before = JSON.stringify(input);
    const groups = compactGroups(input);
    const rows = groups.flatMap(group => group.rows);
    expect(rows.find(row => row.id === "C#2")).toMatchObject({ playerId: "p1", status: "Held · no active game", assigned: false });
    const bench = groups.find(group => group.position === "BN")!.rows;
    expect(bench.find(row => row.playerId === "p0")?.status).toContain("Bench locked");
    expect(bench.find(row => row.playerId === "p0")?.status).toContain("Assignment conflict");
    expect(bench.find(row => row.playerId === "p2")?.status).toContain("Unsupported active slot (X#1)");
    for (const id of ["p3", "p4"]) expect(bench.find(row => row.playerId === id)).toMatchObject({ assigned: false, status: expect.stringContaining("Assignment conflict") });
    expect(rows.find(row => row.id === "LW#2")?.playerId).toBeUndefined();
    expect(rows.filter(row => row.playerId)).toHaveLength(20);
    expect(new Set(rows.flatMap(row => row.playerId ? [row.playerId] : [])).size).toBe(20);
    expect(JSON.stringify(input)).toBe(before);
  });
  it.each([0, undefined, -1])("retains local Bench membership and collapse counts with configured capacity %s", capacity => {
    const input = displayFixture();
    input.roster.forEach(row => { row.position = "active"; });
    if (capacity === undefined) delete input.rules.rosterSlots.BN;
    else input.rules.rosterSlots.BN = capacity;
    const groups = compactGroups(input);
    expect(groups.find(group => group.position === "BN")?.rows).toHaveLength(6);
    expect(groups.some(group => group.position === "Review")).toBe(false);
    render(<CompactSchedule {...input} dates={scheduleWeek(input.date)} today={input.date} selectDate={vi.fn()} selectPlayer={vi.fn()} />);
    const bench = screen.getByRole("button", { name: "Bench 6, collapse" });
    const reason = document.getElementById(bench.getAttribute("aria-describedby")!)?.textContent;
    expect(reason).toContain(capacity === 0 ? "6 players / 0 configured places · 6 over capacity; all retained." : "Configured Bench capacity unknown; all unstarted players retained.");
    expect(document.querySelectorAll('tr[data-player-id]')).toHaveLength(20);
    fireEvent.click(bench);
    expect(document.querySelectorAll('tr[data-compact-row][hidden]')).toHaveLength(6);
    expect(screen.getByRole("button", { name: "Bench 6, expand" }).getAttribute("aria-expanded")).toBe("false");
  });
  it("keeps unclaimed slots pending when active membership or schedule coverage is unresolved", () => {
    const input = displayFixture();
    input.assignments = input.assignments.filter(row => row.playerId !== "p1");
    let groups = compactGroups(input);
    expect(groups.flatMap(group => group.rows).find(row => row.id === "C#2")?.status).toBe("Pending C");
    expect(groups.find(group => group.position === "BN")?.rows.some(row => row.playerId === "p1")).toBe(true);
    const vacancy = displayFixture(19);
    vacancy.snapshot.evidence.schedule!.completeness = "partial";
    groups = compactGroups(vacancy);
    expect(groups.flatMap(group => group.rows).find(row => row.id === "D#4")?.status).toBe("Pending D");
    vacancy.snapshot.evidence.schedule!.completeness = "complete";
    expect(compactGroups(vacancy).flatMap(group => group.rows).find(row => row.id === "D#4")?.status).toBe("Open D");
  });
  it("counts verified active capacity and distinct roster and NHL games for the selected day", () => {
    const input = displayFixture(19);
    const game = input.snapshot.games[0];
    input.snapshot.games.push({ ...game, teamAbbreviation: "NYR", opponent: "CAR", home: false },
      { ...game, id: "cancelled", status: "cancelled" }, { ...game, id: "postponed", status: "postponed" },
      { ...game, id: "later", date: "2026-10-06" });
    expect(summarizeCompactDay(compactGroups(input), input.snapshot, input.date)).toMatchObject({
      capacity: 14, occupied: 13, open: 1, unresolved: 0, rosterGames: 19, nhlGames: 1, scheduleComplete: true,
    });
    input.snapshot.lockedAssignments = [{ date: input.date, playerId: "p0", slotId: "C#1" }];
    input.assignments = input.assignments.filter(row => row.playerId !== "p0");
    input.players[0].teamAbbreviation = "BOS";
    expect(compactGroups(input).flatMap(group => group.rows).find(row => row.id === "C#1")?.status).toBe("Held · no active game");
    expect(summarizeCompactDay(compactGroups(input), input.snapshot, input.date)).toMatchObject({
      occupied: 13, open: 1, unresolved: 0, rosterGames: 18, nhlGames: 1,
    });
    input.players[0].eligibilityVerified = false;
    expect(summarizeCompactDay(compactGroups(input), input.snapshot, input.date).occupied).toBe(12);
    expect(summarizeCompactDay(compactGroups(input), input.snapshot, input.date).unresolved).toBeGreaterThan(0);
  });
  it("keeps unknown eligibility, unsupported reserves and conflicting locks honest", () => {
    const input = displayFixture(25);
    input.players[0].eligibilityVerified = false;
    input.snapshot.lockedAssignments = [{ date: input.date, playerId: "p0", slotId: "C#1" }, { date: input.date, playerId: "p1", slotId: "C#1" }];
    delete input.rules.rosterSlots["IR+"];
    const rows = compactGroups(input).flatMap(group => group.rows);
    expect(rows.find(row => row.id === "C#1")?.status).toBe("Assignment conflict");
    expect(rows.find(row => row.playerId === "p24")).toMatchObject({ slot: "BN", status: "Reserve unverified (IR+)" });
    for (const id of ["p0", "p1"]) expect(rows.find(row => row.playerId === id)).toMatchObject({ slot: "BN", assigned: false, status: expect.stringContaining("Assignment conflict") });
    expect(new Set(rows.flatMap(row => row.playerId ? [row.playerId] : [])).size).toBe(25);
  });
  it("changes view state and bench visibility without editing intent, and distinguishes unknown goalie starts", () => {
    const input = displayFixture();
    const before = JSON.stringify(input.intent);
    const selectDate = vi.fn();
    render(<CompactSchedule {...input} dates={scheduleWeek(input.date)} today={input.date} selectDate={selectDate} selectPlayer={vi.fn()} />);
    const playerButton = screen.getByRole("button", { name: /Schedule details for Player Surname0/ });
    expect(playerButton.getAttribute("aria-label")).toContain("C#1");
    expect(playerButton.closest("th")?.textContent).not.toContain("C#1");
    expect(playerButton.closest("th")?.getAttribute("title")).toContain("League positions: C/LW");
    expect(document.querySelector('tbody[data-position="LW"]')?.getAttribute("data-label")).toBe("LW");
    expect(screen.getAllByRole("cell", { name: /Starter unknown/ })).toHaveLength(2);
    fireEvent.change(visibleScheduleSlider(), { target: { value: "2" } });
    expect(selectDate).toHaveBeenLastCalledWith("2026-10-07");
    fireEvent.click(screen.getByRole("button", { name: /Select Sun/ }));
    expect(selectDate).toHaveBeenLastCalledWith("2026-10-11");
    const bench = screen.getByRole("button", { name: /Bench 6/ });
    expect(bench.getAttribute("aria-expanded")).toBe("true");
    fireEvent.click(bench);
    expect(bench.getAttribute("aria-expanded")).toBe("false");
    expect(document.querySelectorAll('tr[data-compact-row][hidden]')).toHaveLength(6);
    expect(JSON.stringify(input.intent)).toBe(before);
  });
  it("bounds range keyboard navigation and synchronizes the selected header and day label", () => {
    const input = displayFixture();
    const selectDate = vi.fn();
    const props = { ...input, dates: scheduleWeek(input.date).slice(1, 4), date: "2026-10-06", today: input.date, selectDate, selectPlayer: vi.fn() };
    const view = render(<CompactSchedule {...props} />);
    expect((screen.getByRole("button", { name: "Previous schedule week", description: /No earlier week in selected range/ }) as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByRole("button", { name: "Next schedule week", description: /No later week in selected range/ }) as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByRole("button", { name: "Select Mon, Oct 5", description: /Disabled dates are outside selected range/ }) as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByText(/No earlier week in selected range\./)).toBeTruthy();
    expect(screen.getByText(/No later week in selected range\./)).toBeTruthy();
    expect(screen.getByText(/Disabled dates are outside selected range\./)).toBeTruthy();
    const slider = visibleScheduleSlider();
    fireEvent.keyDown(slider, { key: "ArrowLeft" });
    expect(selectDate).not.toHaveBeenCalledWith("2026-10-05");
    fireEvent.keyDown(slider, { key: "ArrowRight" });
    expect(selectDate).toHaveBeenLastCalledWith("2026-10-07");
    view.rerender(<CompactSchedule {...props} date="2026-10-07" />);
    expect(slider.getAttribute("aria-valuetext")).toBe("Wed, Oct 7");
    expect(screen.getByRole("button", { name: "Select Wed, Oct 7" }).getAttribute("aria-pressed")).toBe("true");
    fireEvent.keyDown(slider, { key: "End" });
    expect(selectDate).toHaveBeenLastCalledWith("2026-10-08");
    view.rerender(<CompactSchedule {...props} date="2026-10-08" />);
    fireEvent.keyDown(slider, { key: "ArrowRight" });
    expect(selectDate).not.toHaveBeenCalledWith("2026-10-09");
    fireEvent.keyDown(slider, { key: "Home" });
    expect(selectDate).toHaveBeenLastCalledWith("2026-10-06");
  });
  it("preserves collapsed Bench membership as the selected day changes and honors controlled visibility", () => {
    const input = displayFixture();
    const onBenchChange = vi.fn();
    const props = { ...input, dates: scheduleWeek(input.date), today: input.date, selectDate: vi.fn(), selectPlayer: vi.fn(), benchOpen: false, onBenchChange };
    const view = render(<CompactSchedule {...props} />);
    const hiddenIds = () => Array.from(document.querySelectorAll('tbody[data-position="BENCH"] tr[data-compact-row][hidden]')).map(row => row.getAttribute("data-player-id"));
    expect(hiddenIds()).toEqual(["p14", "p15", "p16", "p17", "p18", "p19"]);
    view.rerender(<CompactSchedule {...props} date="2026-10-06" />);
    expect(hiddenIds()).toEqual(input.roster.map(row => row.playerId));
    const bench = screen.getByRole("button", { name: /Bench 20/ });
    expect(bench.getAttribute("aria-expanded")).toBe("false");
    fireEvent.click(bench);
    expect(onBenchChange).toHaveBeenLastCalledWith(true);
    view.rerender(<CompactSchedule {...props} date="2026-10-06" benchOpen={true} />);
    expect(hiddenIds()).toEqual([]);
    expect(bench.getAttribute("aria-expanded")).toBe("true");
  });
  it("labels partial positive game evidence as known and missing partial evidence as unknown", () => {
    const input = displayFixture();
    input.snapshot.evidence.schedule!.completeness = "partial";
    const props = { ...input, dates: scheduleWeek(input.date), today: input.date, selectDate: vi.fn(), selectPlayer: vi.fn() };
    const view = render(<CompactSchedule {...props} />);
    let summary = visibleDaySummary();
    expect(within(summary).getByText("Roster games").parentElement?.textContent).toContain("20 known");
    expect(within(summary).getByText("NHL games").parentElement?.textContent).toContain("1 known");
    view.rerender(<CompactSchedule {...props} date="2026-10-06" />);
    summary = visibleDaySummary();
    expect(within(summary).getByText("Roster games").parentElement?.textContent).toContain("Unknown");
    expect(within(summary).getByText("NHL games").parentElement?.textContent).toContain("Unknown");
  });
  it("marks an engine assignment conflicting with a held slot and an unknown weekly window as unresolved", () => {
    const input = displayFixture();
    input.snapshot.lockedAssignments = [{ date: input.date, playerId: "p0", slotId: "C#1" }];
    input.assignments = [{ ...input.assignments[0], playerId: "p1" }];
    const groups = compactGroups(input);
    expect(groups.flatMap(group => group.rows).find(row => row.id === "C#1")).toMatchObject({ status: "Assignment conflict", assigned: false });
    expect(groups.flatMap(group => group.rows).find(row => row.id === "C#1")?.playerId).toBeUndefined();
    for (const id of ["p0", "p1"]) expect(groups.find(group => group.position === "BN")?.rows.find(row => row.playerId === id)?.status).toContain("Assignment conflict");
    input.rules.lineupMode = "weekly";
    input.rules.lineupPeriods = [];
    input.assignments = [];
    const rows = compactGroups(input).flatMap(group => group.rows);
    expect(rows.find(row => row.id === "C#1")?.status).toBe("Weekly window unverified");
    expect(rows.some(row => row.assigned || row.status.startsWith("Open"))).toBe(false);
  });
  it("labels effective planned additions and reserve capacity conflicts without losing current roster players", () => {
    const input = displayFixture(25);
    input.rules.rosterSlots.IR = 0;
    const reserve = input.roster.find(row => row.position === "IR+")!;
    input.roster.find(row => row.position === "IR")!.position = "IR+";
    expect(compactGroups(input).flatMap(group => group.rows).find(row => row.playerId === reserve.playerId)?.status).toBe("Reserve capacity conflict");
    input.rules.rosterSlots.IR = 1;
    input.roster.find(row => row.playerId === "p23")!.position = "IR";
    input.rules.acquisitionTiming = "same_day";
    input.rules.acquisitionCost = 0;
    input.rules.periods = [{ id: "week", start: "2026-10-05T00:00:00Z", end: "2026-10-12T00:00:00Z", remaining: 1, source: "manager" }];
    input.players[19].canDrop = true;
    input.players.push({ ...input.players[19], id: "new", name: "Planned Addition", availability: "manager_available" });
    input.intent.steps = [{ id: "add", type: "add", playerId: "new", dropPlayerId: "p19", at: "2026-10-05T00:00:00Z", effectiveAt: "2026-10-05T00:00:00Z", conditional: false, dependsOn: [] }];
    const rows = compactGroups(input).flatMap(group => group.rows);
    expect(rows.find(row => row.playerId === "new")?.change).toMatch(/Planned addition · effective .*UTC/);
    expect(rows.find(row => row.playerId === "p19")?.status).toContain("Planned drop");
  });
  it.each([null, ""])("keeps missing team %s schedules unknown despite complete shared coverage", team => {
    const input = displayFixture();
    input.snapshot.games = [];
    input.assignments = [];
    input.players[0].teamAbbreviation = team;
    input.players[14].teamAbbreviation = team;
    input.snapshot.lockedAssignments = [{ date: input.date, playerId: "p0", slotId: "C#1" }];
    const before = JSON.stringify(input);
    const rows = compactGroups(input).flatMap(group => group.rows);
    expect(rows.find(row => row.id === "C#1")).toMatchObject({ status: "Team unknown", assigned: false });
    expect(rows.find(row => row.id === "C#1")?.playerId).toBeUndefined();
    expect(rows.find(row => row.playerId === "p0")).toMatchObject({ slot: "BN", status: expect.stringContaining("Team unknown"), assigned: false });
    expect(rows.find(row => row.playerId === "p14")).toMatchObject({ status: "Team unknown", assigned: false });
    expect(summarizeCompactDay(compactGroups(input), input.snapshot, input.date)).toMatchObject({
      rosterGames: 0, rosterComplete: false, nhlGames: 0, scheduleComplete: true,
    });
    const props = { ...input, dates: scheduleWeek(input.date), today: input.date, selectDate: vi.fn(), selectPlayer: vi.fn() };
    const view = render(<CompactSchedule {...props} />);
    const summary = visibleDaySummary();
    expect(within(summary).getByText("Roster games").parentElement?.textContent).toContain("Unknown");
    expect(within(summary).getByText("NHL games").parentElement?.textContent).toContain("0");
    for (const index of [0, 14]) {
      const row = screen.getByRole("button", { name: new RegExp(`Schedule details for Player Surname${index},`) }).closest("tr")!;
      expect(within(row).getAllByRole("cell", { name: /Team unknown/ })).toHaveLength(7);
      expect(within(row).queryByRole("cell", { name: /No game/ })).toBeNull();
      expect(within(row).getAllByRole("cell").map(cell => cell.textContent)).toEqual([...Array(10).fill("?"), "—"]);
    }
    const known = screen.getByRole("button", { name: /Schedule details for Player Surname1,/ }).closest("tr")!;
    expect(within(known).getAllByRole("cell", { name: /No game/ })).toHaveLength(7);
    expect(within(known).getAllByRole("cell").at(-1)?.textContent).toBe("—"); // No ledger was supplied; points stay unavailable.
    view.rerender(<CompactSchedule {...props} dates={props.dates.slice(0, 2)} />);
    const locked = screen.getByRole("button", { name: /Schedule details for Player Surname0,/ }).closest("tr")!;
    expect(within(locked).getAllByRole("cell", { name: /Outside selected range/ })).toHaveLength(5);
    expect(JSON.stringify(input)).toBe(before);
  });
  it("preserves the selected weekday during week navigation and falls back inside clipped weeks", () => {
    const input = displayFixture();
    const selectDate = vi.fn();
    const dates = [...scheduleWeek(input.date), ...scheduleWeek("2026-10-12")];
    const props = { ...input, date: "2026-10-08", dates, today: "2026-10-07", selectDate, selectPlayer: vi.fn() };
    const view = render(<CompactSchedule {...props} />);
    fireEvent.click(screen.getByRole("button", { name: "Next schedule week" }));
    expect(selectDate).toHaveBeenLastCalledWith("2026-10-15");
    view.rerender(<CompactSchedule {...props} date="2026-10-15" />);
    fireEvent.click(screen.getByRole("button", { name: "Previous schedule week" }));
    expect(selectDate).toHaveBeenLastCalledWith("2026-10-08");
    view.rerender(<CompactSchedule {...props} today="2026-10-09" />);
    fireEvent.click(screen.getByRole("button", { name: "Next schedule week" }));
    expect(selectDate).toHaveBeenLastCalledWith("2026-10-15");
    const clipped = [...scheduleWeek(input.date).slice(2), ...scheduleWeek("2026-10-12").slice(0, 2)];
    view.rerender(<CompactSchedule {...props} dates={clipped} />);
    fireEvent.click(screen.getByRole("button", { name: "Next schedule week" }));
    expect(selectDate).toHaveBeenLastCalledWith("2026-10-12");
    view.rerender(<CompactSchedule {...props} dates={clipped} date="2026-10-12" />);
    fireEvent.click(screen.getByRole("button", { name: "Previous schedule week" }));
    expect(selectDate).toHaveBeenLastCalledWith("2026-10-07");
  });
  it("labels a confirmed goalie only when eligible full-team evidence supports it", () => {
    const input = displayFixture();
    const game = input.snapshot.games[0];
    input.players[12].nhlTeamId = 12; input.players[13].nhlTeamId = 12;
    input.players[12].nhlId = 12; input.players[13].nhlId = 13;
    input.players[12].rosterRevision = "roster"; input.players[13].rosterRevision = "roster";
    input.snapshot.forecasts = input.players.slice(12, 14).map((goalie, index) => ({ playerId: goalie.id, gameId: game.id,
      sourceKind: "detailed", sourceWatermark: "inputs", stats: { SAVES_GOALIE: 20 }, conditioning: "unconditional",
      startProbability: index === 0 ? 1 : 0, confirmedStart: index === 0, revisionId: "revision", modelVersion: "fixture", limitations: [],
      cutoffAt: input.snapshot.context.asOf, issuedAt: input.snapshot.context.asOf, expiresAt: game.startsAt!,
      allowedUses: { assignment: true, totals: true, comparison: true, conditionalTieBreak: false },
      issuedContext: { version: "forge-issued-context-v1", playerId: goalie.id, gameId: game.id, nhlPlayerId: goalie.nhlId!,
        seasonId: input.snapshot.context.seasonId, teamId: 12, scheduledAt: game.startsAt!, scheduleRevision: "schedule", rosterRevision: "roster",
        observedAt: input.snapshot.context.asOf, scheduleSourceUpdatedAt: null, scheduleFetchedAt: null, identityUpdatedAt: null, membershipCreatedAt: [] } }));
    game.scheduleRevision = "schedule";
    render(<CompactSchedule {...input} dates={scheduleWeek(input.date)} today={input.date} selectDate={vi.fn()} selectPlayer={vi.fn()} />);
    expect(screen.getAllByRole("cell", { name: /Confirmed goalie starter/ })).toHaveLength(1);
    expect(screen.getAllByRole("cell", { name: /Projected goalie starter/ })).toHaveLength(1);
  });
});


describe("owner plan preservation", () => {
  async function setup(deferSave = false, absent = false, fixtureOptions: { initialProviderAbsent?: boolean; deferProtectedAck?: boolean } = {}) {
    vi.stubGlobal("crypto", webcrypto); vi.stubGlobal("Blob", NodeBlob);
    let occupied = false;
    const locks = { request: (_name: string, _options: unknown, callback: (lock: unknown) => unknown) => {
      if (occupied) return Promise.resolve(callback(null));
      occupied = true; return Promise.resolve(callback({ name: "writer" })).finally(() => { occupied = false; });
    } };
    Object.defineProperty(navigator, "locks", { configurable: true, value: locks });
    const candidate = { ...player, id: "candidate", name: "Beta Candidate", availability: "free_agent" as const };
    const original = defaultWorkspace(new Date("2026-10-11T18:00:00Z"));
    original.context = { ...original.context, provider: "yahoo", seasonId: 20262027, leagueId: "league", teamId: "team", startDate: "2026-10-12", endDate: "2026-10-18", timeZone: "UTC" };
    original.roster = [{ playerId: player.id, position: "active" }]; original.manualPlayers = [player, candidate];
    original.intent.steps = [{ id: "nonzero", type: "add", playerId: candidate.id, at: "2026-10-12T10:00:00Z", effectiveAt: "2026-10-12T10:00:00Z", conditional: true, dependsOn: [] }];
    const prior = { ...original, intent: { ...original.intent, protectedPlayerIds: [candidate.id] } };
    writeWorkspace(localStorage, original, [prior]);
    authState.user = { id: "owner-a" };
    authState.teams = [{ id: "team", external_league_id: "league", team_name: "Owner Team", provider: "yahoo", team_metadata: { is_owned: true }, external_leagues: { league_name: "Owner League" } }];
    const originalRow = absent ? null : { id: "remote", user_id: "owner-a", provider: "yahoo", season_id: 20262027, league_id: "league", team_id: "team", start_date: original.context.startDate, end_date: original.context.endDate, workspace: original, snapshot: null, lock_version: 2, updated_at: original.context.asOf };
    let row = originalRow ? JSON.parse(JSON.stringify(originalRow)) : null;
    let pinnedRow = row;
    let checksum: string | null = null; let localHash: string | null = null; let acknowledgedVersion = row?.lock_version ?? null;
    let delayed: (() => void) | null = null; let exported: NodeBlob | null = null;
    let delayedAck: (() => void) | null = null; let changedProvider = false; let providerReads = 0; let rejectedLocalAcks = 0;
    const NativeURL = URL;
    vi.stubGlobal("URL", class extends NativeURL { static createObjectURL(blob: Blob | MediaSource) { exported = blob as unknown as NodeBlob; return "blob:preservation"; } static revokeObjectURL() {} });
    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => undefined);
    const record = () => row ? { workspace: row.workspace, snapshot: row.snapshot, version: row.lock_version, updatedAt: row.updated_at } : null;
    const reply = (body: unknown, status = 200) => ({ ok: status === 200, status, json: async () => body });
    const requests: { url: string; method: string }[] = [];
    const network = vi.fn(async (url: string, options?: RequestInit) => {
      requests.push({ url, method: options?.method ?? "GET" }); const parsed = new NativeURL(url, "http://localhost"); const mode = parsed.searchParams.get("preservation");
      if (url.includes("/data?")) return reply({ success: true, data: { ...data, players: [player, candidate] } });
      if (url.endsWith("/access")) return reply({ data: { eligible: true, capabilities: ["rso_sync", "rso_account_save", "rso_auto_upkeep"], grantingSources: ["owner_testing"] } });
      if (url.endsWith("/provider")) {
        providerReads += 1;
        if (fixtureOptions.initialProviderAbsent && providerReads === 1) return reply({ success: false, error: "Initial provider unavailable" }, 503);
        return reply({ success: true, snapshot: { id: changedProvider ? "provider-changed" : "provider-original", context: original.context, players: [player, candidate], roster: changedProvider ? [{ playerId: candidate.id, position: "active" }] : original.roster, rules: changedProvider ? { ...original.rules, rosterSlots: { ...original.rules.rosterSlots, C: 4 } } : original.rules, lockedAssignments: [], realized: {}, opponent: null, games: [], forecasts: [], evidence: {} }, capabilities: { roster: true, availability: true, rules: true, matchup: true, acquisitions: true, limitations: [] } });
      }
      if (options?.method === "PUT") {
        const body = JSON.parse(options.body as string);
        const commit = () => {
          if (mode === "restore") row = { ...row, workspace: pinnedRow!.workspace, snapshot: pinnedRow!.snapshot, lock_version: row.lock_version + 1 };
          else row = { ...row, workspace: body.workspace, snapshot: body.snapshot, lock_version: row.lock_version + 1 };
          return reply({ data: record(), ...(mode ? { preservation: { principalId: "owner-a", contextKey: JSON.stringify(["yahoo", 20262027, "league", "team", original.context.startDate, original.context.endDate, "UTC"]), receiptId: "receipt", checksum, restored: mode === "restore", lastVersion: row.lock_version } } : {}) });
        };
        if (deferSave && !mode) return new Promise(resolve => { delayed = () => resolve(commit()); });
        return commit();
      }
      if (!mode) return reply({ data: record() });
      if (mode === "read") { pinnedRow = row ? JSON.parse(JSON.stringify(row)) : null; acknowledgedVersion = row?.lock_version ?? null; }
      if (mode === "seal") { checksum = parsed.searchParams.get("checksum"); localHash = parsed.searchParams.get("localHash"); }
      if (mode === "ack") {
        if (fixtureOptions.deferProtectedAck) await new Promise<void>(resolve => { delayedAck = resolve; });
        acknowledgedVersion = Number(parsed.searchParams.get("version"));
      }
      if (mode === "local_ack") {
        if (acknowledgedVersion !== row?.lock_version) { rejectedLocalAcks += 1; return reply({ error: "A dispatched write lacks its acknowledgement" }, 409); }
        if (parsed.searchParams.get("previousLocalHash") !== localHash) return reply({ error: "Local conflict" }, 409);
        localHash = parsed.searchParams.get("localHash");
      }
      return reply({ data: record(), preservation: { principalId: "owner-a", contextKey: JSON.stringify(["yahoo", 20262027, "league", "team", original.context.startDate, original.context.endDate, "UTC"]), ownerVerified: true, receiptId: "receipt", row, originalRowHash: await preservationChecksum(pinnedRow), checksum, localHash, lastVersion: row?.lock_version ?? null, acknowledgedVersion, released: mode === "release" } });
    });
    vi.stubGlobal("fetch", network);
    const mounted = render(<RosterScheduleOptimizer />);
    await waitFor(() => expect((screen.getByRole("button", { name: "Prepare plan backup" }) as HTMLButtonElement).disabled).toBe(false));
    await waitFor(() => expect(JSON.parse(localStorage.getItem(WORKSPACE_KEY)!).intent.steps).toHaveLength(1));
    const prepare = async () => { fireEvent.click(screen.getByRole("button", { name: "Prepare plan backup" })); await screen.findByText(/Complete (local )?backup sealed/); };
    const exportBackup = async () => { fireEvent.click(screen.getByRole("button", { name: "Download complete backup" })); return JSON.parse(await exported!.text()) as WorkspacePreservation; };
    return { original, mounted, requests, prepare, exportBackup, network, row: () => row, resolveSave: () => delayed!(), changeProvider: () => { changedProvider = true; }, resolveAck: () => { delayedAck!(); }, rejectedLocalAcks: () => rejectedLocalAcks };
  }
  afterEach(() => { Reflect.deleteProperty(navigator, "locks"); });
  it("drains a dispatched account save before capturing the actual remote state", async () => {
    const fixture = await setup(true);
    fireEvent.click(screen.getByRole("button", { name: "Save to account" }));
    await waitFor(() => expect(fixture.requests.some(request => request.method === "PUT")).toBe(true));
    fireEvent.click(screen.getByRole("button", { name: "Prepare plan backup" }));
    expect(screen.getByText(/Finishing dispatched requests/)).not.toBeNull();
    expect(fixture.requests.some(request => request.url.includes("preservation=read"))).toBe(false);
    fixture.resolveSave(); await screen.findByText(/Complete backup sealed/);
    const backup = await fixture.exportBackup(); expect(backup.remote.row!.lock_version).toBe(3); expect(backup.history).toHaveLength(1); expect(backup.workspace.intent.steps).toHaveLength(1);
    fireEvent.click(screen.getByRole("checkbox", { name: "Backup saved and other writers independently excluded" }));
    fireEvent.click(screen.getByRole("button", { name: "Use backup for approved test" }));
    await screen.findByText(/Protected planning active/);
  });
  it("keeps nonzero intent/Undo, restores after reopen, and verifies original local and remote payloads", async () => {
    const fixture = await setup(); await fixture.prepare(); const backup = await fixture.exportBackup();
    fireEvent.click(screen.getByRole("checkbox", { name: "Backup saved and other writers independently excluded" }));
    fireEvent.click(screen.getByRole("button", { name: "Use backup for approved test" })); await screen.findByText(/Protected planning active/);
    fireEvent.click(screen.getAllByRole("checkbox", { name: /^Protect / })[0]);
    await waitFor(() => expect(JSON.parse(localStorage.getItem(WORKSPACE_KEY)!).intent.protectedPlayerIds).toContain(player.id));
    fireEvent.click(screen.getByRole("button", { name: "Undo" }));
    await waitFor(() => expect(JSON.parse(localStorage.getItem(WORKSPACE_KEY)!).intent.protectedPlayerIds).not.toContain(player.id));
    expect(JSON.parse(localStorage.getItem(WORKSPACE_KEY)!).intent.steps).toHaveLength(1);
    fireEvent.click(screen.getByRole("button", { name: "Save to account" })); await screen.findByText("Saved to account.");
    fixture.mounted.unmount(); await Promise.resolve();
    render(<RosterScheduleOptimizer />);
    await screen.findByText(/Saved preservation session found/);
    expect(fixture.requests.filter(request => request.url.endsWith("/provider"))).toHaveLength(1);
    fireEvent.change(screen.getByLabelText("Restore downloaded backup"), { target: { files: [{ text: async () => JSON.stringify(backup) }] } });
    await screen.findByText(/Original local key values and absence, plan and Undo restored/);
    expect(backup.local.map(entry => localStorage.getItem(entry.key))).toEqual(backup.local.map(entry => entry.value));
    expect(readWorkspaceHistory(localStorage, backup.workspace)).toEqual(backup.history);
    expect(fixture.row().workspace).toEqual(fixture.original); expect(fixture.row().lock_version).toBe(4);
  });
  it.each([false, true])("restores original provider authority including absence without remount (absent=%s)", async initialProviderAbsent => {
    const fixture = await setup(false, false, { initialProviderAbsent }); await fixture.prepare(); const backup = await fixture.exportBackup();
    expect(backup.provider!.connected === null).toBe(initialProviderAbsent);
    fireEvent.click(screen.getByRole("checkbox", { name: "Backup saved and other writers independently excluded" }));
    fireEvent.click(screen.getByRole("button", { name: "Use backup for approved test" })); await screen.findByText(/Protected planning active/);
    fixture.changeProvider(); fireEvent.click(screen.getByRole("button", { name: "Refresh provider" }));
    await waitFor(() => expect((screen.getByLabelText("C") as HTMLInputElement).value).toBe("4"));
    expect(screen.getAllByRole("checkbox", { name: /^Protect / })).toHaveLength(1);
    fireEvent.click(screen.getByRole("button", { name: "Restore original plan and Undo" }));
    await screen.findByText(/Original local key values and absence, plan and Undo restored/);
    expect((screen.getByLabelText("C") as HTMLInputElement).value).toBe(String(fixture.original.rules.rosterSlots.C));
    const protect = screen.getAllByRole("checkbox", { name: /^Protect / });
    expect(protect[0].closest("label")!.parentElement!.textContent).toContain(player.name);
    expect(backup.local.map(entry => localStorage.getItem(entry.key))).toEqual(backup.local.map(entry => entry.value));
    const restored = await fixture.exportBackup(); expect(restored.provider).toEqual(backup.provider);
  });
  it("serializes a protected account acknowledgement before persisting and acknowledging a local edit", async () => {
    const fixture = await setup(false, false, { deferProtectedAck: true }); await fixture.prepare(); const backup = await fixture.exportBackup();
    fireEvent.click(screen.getByRole("checkbox", { name: "Backup saved and other writers independently excluded" }));
    fireEvent.click(screen.getByRole("button", { name: "Use backup for approved test" })); await screen.findByText(/Protected planning active/);
    fireEvent.click(screen.getByRole("button", { name: "Save to account" }));
    await waitFor(() => expect(fixture.requests.some(request => request.url.includes("preservation=ack"))).toBe(true));
    const beforeEdit = localStorage.getItem(WORKSPACE_KEY);
    fireEvent.click(screen.getAllByRole("checkbox", { name: /^Protect / })[0]);
    expect((screen.getAllByRole("checkbox", { name: /^Protect / })[0] as HTMLInputElement).checked).toBe(true);
    expect(localStorage.getItem(WORKSPACE_KEY)).toBe(beforeEdit);
    expect(fixture.requests.some(request => request.url.includes("preservation=local_ack"))).toBe(false);
    fixture.resolveAck();
    await waitFor(() => expect(JSON.parse(localStorage.getItem(WORKSPACE_KEY)!).intent.protectedPlayerIds).toContain(player.id));
    await waitFor(() => expect(fixture.requests.some(request => request.url.includes("preservation=local_ack"))).toBe(true));
    expect(fixture.rejectedLocalAcks()).toBe(0);
    fireEvent.click(screen.getByRole("button", { name: "Restore original plan and Undo" }));
    await waitFor(() => expect(fixture.requests.filter(request => request.url.includes("preservation=ack"))).toHaveLength(2)); fixture.resolveAck();
    await screen.findByText(/Original local key values and absence, plan and Undo restored/);
    expect(backup.local.map(entry => localStorage.getItem(entry.key))).toEqual(backup.local.map(entry => entry.value));
  });
  it("rejects a legacy storage writer instead of adopting its fresh values for restore", async () => {
    const fixture = await setup(); await fixture.prepare();
    localStorage.setItem(WORKSPACE_KEY, "legacy writer"); window.dispatchEvent(new StorageEvent("storage", { key: WORKSPACE_KEY, newValue: "legacy writer" }));
    await screen.findByText(/Another storage writer changed/);
    fireEvent.click(screen.getByRole("button", { name: "Restore original plan and Undo" }));
    await screen.findByText(/Workspace storage changed in another writer/);
    expect(localStorage.getItem(WORKSPACE_KEY)).toBe("legacy writer"); expect(fixture.requests.some(request => request.url.includes("preservation=restore"))).toBe(false);
  });
  it("keeps rehydration and requests paused when another writer changed storage before reopen", async () => {
    const fixture = await setup(); await fixture.prepare();
    fixture.mounted.unmount(); await Promise.resolve();
    const foreign = JSON.stringify({ ...fixture.original, context: { ...fixture.original.context, teamId: "other-team" } });
    localStorage.setItem(WORKSPACE_KEY, foreign);
    const requestCount = fixture.requests.length;
    render(<RosterScheduleOptimizer />);
    await screen.findByText(/Workspace storage changed in another writer/);
    expect(localStorage.getItem(WORKSPACE_KEY)).toBe(foreign);
    expect(fixture.requests).toHaveLength(requestCount);
    expect((screen.getByRole("button", { name: "Resume normal planning" }) as HTMLButtonElement).disabled).toBe(true);
  });
  it("rejects substituted journal expectations against the server's last-own local hash", async () => {
    const fixture = await setup(); await fixture.prepare();
    fixture.mounted.unmount(); await Promise.resolve();
    const journal = JSON.parse(sessionStorage.getItem(WORKSPACE_PRESERVATION_JOURNAL)!);
    const foreign = JSON.stringify({ ...fixture.original, unresolvedNames: ["Unowned edit"] });
    journal.expected.find((entry: { key: string }) => entry.key === WORKSPACE_KEY).value = foreign;
    localStorage.setItem(WORKSPACE_KEY, foreign);
    sessionStorage.setItem(WORKSPACE_PRESERVATION_JOURNAL, JSON.stringify(journal));
    const requestCount = fixture.requests.length;
    render(<RosterScheduleOptimizer />);
    await screen.findByText(/Original backup shown/);
    expect(fixture.requests).toHaveLength(requestCount);
    fireEvent.click(screen.getByRole("button", { name: "Restore original plan and Undo" }));
    await screen.findByText(/not bound to the admitted writer's acknowledged state/);
    expect(localStorage.getItem(WORKSPACE_KEY)).toBe(foreign);
    expect(fixture.requests.some(request => request.url.includes("preservation=restore"))).toBe(false);
  });
  it("rejects an outside journal change before dispatching restoration", async () => {
    const fixture = await setup(); await fixture.prepare();
    sessionStorage.setItem(WORKSPACE_PRESERVATION_JOURNAL, "outside journal");
    const requestCount = fixture.requests.length;
    fireEvent.click(screen.getByRole("button", { name: "Restore original plan and Undo" }));
    await screen.findByText(/Preservation journal changed outside this writer/);
    expect(fixture.requests).toHaveLength(requestCount);
  });
  it("holds admission when a dispatched account write has an uncertain outcome", async () => {
    const fixture = await setup();
    const network = fixture.network.getMockImplementation()!;
    fixture.network.mockImplementation((url, options) => options?.method === "PUT" ? Promise.reject(new Error("Connection lost after dispatch")) : network(url, options));
    fireEvent.click(screen.getByRole("button", { name: "Save to account" }));
    await screen.findByText(/Connection lost after dispatch/);
    fireEvent.click(screen.getByRole("button", { name: "Prepare plan backup" }));
    await screen.findByText(/uncertain server outcome/);
    expect(fixture.requests.some(request => request.url.includes("preservation=read"))).toBe(false);
  });
  it("holds account-save testing for original absence and rejects rehashed backup substitution", async () => {
    const fixture = await setup(false, true); await fixture.prepare(); const backup = await fixture.exportBackup();
    fireEvent.click(screen.getByRole("checkbox", { name: "Backup saved and other writers independently excluded" }));
    expect((screen.getByRole("button", { name: "Use backup for approved test" }) as HTMLButtonElement).disabled).toBe(true);
    const changed = { ...backup, view: { ...backup.view, tab: "matchup" } }; const { checksum: _checksum, ...payload } = changed; changed.checksum = await preservationChecksum(payload);
    fireEvent.change(screen.getByLabelText("Restore downloaded backup"), { target: { files: [{ text: async () => JSON.stringify(changed) }] } });
    await screen.findByText(/original browser journal is required/i);
    expect(fixture.requests.some(request => request.method === "PUT")).toBe(false);
  });
});


describe("current-week date controls", () => {
  function setup(saved = false) {
    vi.useFakeTimers({ toFake: ["Date"] }); vi.setSystemTime(new Date("2026-10-19T02:00:00Z"));
    vi.stubGlobal("fetch", fetchMock);
    if (saved) {
      const workspace = defaultWorkspace();
      workspace.context = { ...workspace.context, startDate: "2026-10-09", endDate: "2026-10-22", timeZone: "America/New_York" };
      workspace.unresolvedNames = ["Retained manager input"];
      workspace.intent.protectedPlayerIds = [player.id];
      writeWorkspace(window.localStorage, workspace);
    }
    return render(<RosterScheduleOptimizer />);
  }
  const input = (name: string) => screen.getByLabelText(name, { exact: true }) as HTMLInputElement;
  it("starts with local current Mon–Sun and rederives a fresh range when the manager changes timezone", async () => {
    setup(); await waitFor(() => expect(planningTimeText()).toBeTruthy());
    fireEvent.blur(input("Time zone"), { target: { value: "America/New_York" } });
    expect(input("From").value).toBe("2026-10-12"); expect(input("Through").value).toBe("2026-10-18");
    fireEvent.blur(input("Time zone"), { target: { value: "Asia/Tokyo" } });
    expect(input("From").value).toBe("2026-10-19"); expect(input("Through").value).toBe("2026-10-25");
  });
  it("retains legacy saved ranges until an explicit Current week action and preserves manager intent", async () => {
    setup(true); await waitFor(() => expect(planningTimeText()).toBeTruthy());
    expect(input("From").value).toBe("2026-10-09"); expect(input("Through").value).toBe("2026-10-22");
    expect(screen.getByText(/Saved range retained/)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Current week" }));
    expect(input("From").value).toBe("2026-10-12"); expect(input("Through").value).toBe("2026-10-18");
    await waitFor(() => expect(JSON.parse(window.localStorage.getItem(WORKSPACE_KEY)!).intent.protectedPlayerIds).toEqual([player.id]));
    expect(JSON.parse(window.localStorage.getItem(WORKSPACE_KEY)!).unresolvedNames).toEqual(["Retained manager input"]);
  });
  it("retains a custom date range across timezone edits and reopen", async () => {
    const view = setup(); await waitFor(() => expect(planningTimeText()).toBeTruthy());
    fireEvent.change(input("From"), { target: { value: "2026-10-09" } });
    fireEvent.change(input("Through"), { target: { value: "2026-10-22" } });
    fireEvent.blur(input("Time zone"), { target: { value: "America/New_York" } });
    expect(input("From").value).toBe("2026-10-09"); expect(input("Through").value).toBe("2026-10-22");
    await waitFor(() => expect(JSON.parse(window.localStorage.getItem(WORKSPACE_KEY)!).context.endDate).toBe("2026-10-22"));
    view.unmount(); render(<RosterScheduleOptimizer />);
    await waitFor(() => expect(input("From").value).toBe("2026-10-09"));
    expect(input("Through").value).toBe("2026-10-22");
    expect(screen.getByText(/Saved range retained/)).toBeTruthy();
  });
});


describe("stored Yahoo eligibility while provider verification is pending", () => {
  it("merges known per-player facts from a partial provider snapshot without treating the whole catalogue as unknown", async () => {
    vi.useFakeTimers({ toFake: ["Date"] }); vi.setSystemTime(new Date("2026-10-13T12:00:00Z"));
    authState.user = { id: "partial-discovery-manager" };
    const workspace = defaultWorkspace();
    workspace.context = { ...workspace.context, provider: "yahoo", leagueId: "league", teamId: "team", timeZone: "UTC" };
    const owned = { ...player, id: "owned", name: "Owned Player", eligibilityVerified: false };
    const known = { ...player, id: "known", nhlId: 2, name: "Partial Page Player", eligibilityVerified: false };
    const unseen = { ...player, id: "unseen", nhlId: 3, name: "Unseen Player", eligibilityVerified: false };
    const publicData = { ...data, players: [owned, known, unseen] };
    workspace.roster = [{ playerId: owned.id, position: "bench" }]; workspace.manualPlayers = [owned];
    const partial: PlanningSnapshot = { id: "partial-provider", context: workspace.context, players: [
      { ...owned, eligibilityVerified: true, availability: "rostered" },
      { ...known, eligiblePositions: ["C", "LW"], eligibilityVerified: true, availability: "free_agent" }, unseen,
    ], roster: workspace.roster, rules: workspace.rules, lockedAssignments: [], games: [], forecasts: [], realized: {}, opponent: null,
    evidence: { availability: { source: "Synthetic first page", asOf: workspace.context.asOf, seasonId: 20262027, completeness: "partial", limitations: [] } } };
    const discoverySummary = [
      "Yahoo availability read: 1 pages attempted, 1 returned, 1 accepted; 25 accepted rows, 25 unique, 0 repeats. 8000 ms elapsed; 8000 ms between-page budget. Stopped: time budget.",
      "Yahoo availability matches: 1 unique catalog matches, 24 unmatched; 0 rostered/excluded, 1 candidate matches.",
      "Yahoo provider catalog before search: 2 candidates; 1 both known, 0 eligibility only, 0 availability only, 1 neither known. Eligibility means usable verified positions; availability means free agent or waivers. Discovery partial; unseen players remain unknown.",
    ];
    writeWorkspace(window.localStorage, workspace);
    const reply = (body: unknown) => ({ ok: true, json: async () => body });
    const fetch = vi.fn((url: string) => Promise.resolve(reply(url.includes("/data?") ? { success: true, data: publicData }
      : url.endsWith("/access") ? { data: { eligible: true, capabilities: ["rso_sync"] } }
        : url.endsWith("/provider") ? { success: true, snapshot: partial, capabilities: { roster: true, availability: false,
          rules: false, acquisitions: false, limitations: ["Availability discovery reached its time budget; remaining players are unknown.", "Verify goalie minimum progress; these are not inferred from season transaction totals."], diagnostics: discoverySummary } } : { data: null })));
    vi.stubGlobal("fetch", fetch);
    let evaluated: PlanningSnapshot | null = null;
    planningState.evaluate = (snapshot, intent) => { evaluated = snapshot; return planRoster(snapshot, intent); };
    render(<RosterScheduleOptimizer />);
    await waitFor(() => expect(evaluated?.id).toBe(partial.id));
    expect(evaluated!.players.find(row => row.id === known.id)).toMatchObject({ eligibilityVerified: true, eligiblePositions: ["C", "LW"], availability: "free_agent" });
    expect(screen.getByText("1 player is missing league positions or availability, so it can't be ranked.")).toBeTruthy();
    expect(screen.queryByText("2 matching candidate(s) have unknown league availability.")).toBeNull();
    const knownCard = screen.getByRole("button", { name: "Partial Page Player, CAR, C/LW" }).closest("article")!;
    expect(within(knownCard).getByText("FA")).toBeTruthy();
    const health = screen.getByText("Data health").closest("details")!;
    expect(health.open).toBe(false);
    const requestsBeforeOpening = fetch.mock.calls.length;
    fireEvent.click(within(health).getByText("Data health").closest("summary")!);
    expect(health.open).toBe(true);
    // Diagnostics sit in a collapsed section and do not count as review items.
    const diagnostics = within(health).getByText("Provider diagnostics").closest("details")!;
    expect(diagnostics.open).toBe(false);
    for (const line of discoverySummary) expect(within(diagnostics).getByText(line)).toBeTruthy();
    expect(within(health).getByText("3 items to review · Planning uses partial provider inputs")).toBeTruthy();
    expect(within(health).getByText(/Enter goalie starts so far this week in Planning setup \(Goalie credited\)/)).toBeTruthy();
    expect(within(health).queryByText(/Verify goalie minimum progress/)).toBeNull();
    fireEvent.change(screen.getByLabelText("Goalie credited"), { target: { value: "1" } });
    expect(within(health).queryByText(/Enter goalie starts so far this week/)).toBeNull();
    // Yahoo reports no league time zone; the inline confirmation clears the item without another provider read.
    expect(within(health).getByText(/Yahoo does not report a league time zone/)).toBeTruthy();
    fireEvent.click(within(health).getByRole("button", { name: "Confirm UTC" }));
    expect(within(health).queryByText(/Yahoo does not report a league time zone/)).toBeNull();
    expect((screen.getByLabelText("Matches my league's day boundary") as HTMLInputElement).checked).toBe(true);
    expect(within(health).getByText("1 item to review · Planning uses partial provider inputs")).toBeTruthy();
    expect(fetch.mock.calls).toHaveLength(requestsBeforeOpening);
    expect(fetch.mock.calls.filter(([url]) => url.endsWith("/provider"))).toHaveLength(1);
    expect(fetch.mock.calls.some(([, init]: any[]) => init?.method === "PUT")).toBe(false);
  });
  it.each([1, 241])("requests stored positions for a %i-candidate catalogue and retained roster without promoting availability", async count => {
    vi.useFakeTimers({ toFake: ["Date"] }); vi.setSystemTime(new Date("2026-10-13T12:00:00Z"));
    authState.user = { id: "candidate-cache-manager" };
    const workspace = defaultWorkspace(); workspace.context = { ...workspace.context, provider: "yahoo", leagueId: "league", teamId: "team", timeZone: "UTC" };
    const owned = { ...player, id: "18157", nhlId: 8473512, nhlTeamId: 9, rosterRevision: "owned-membership", teamAbbreviation: "OTT", eligibilityVerified: false };
    const candidate = { ...owned, id: "19711", nhlId: 8480001, name: "Stored candidate", rosterRevision: "candidate-membership" };
    const candidates = [candidate, ...Array.from({ length: count - 1 }, (_, index) => ({ ...candidate, id: String(30000 + index), nhlId: 8500000 + index }))];
    workspace.roster = [{ playerId: owned.id, position: "bench" }]; workspace.manualPlayers = [owned];
    writeWorkspace(window.localStorage, workspace);
    const reply = (body: unknown) => ({ ok: true, json: async () => body });
    const fetch = vi.fn((url: string) => {
      if (url.endsWith("/provider")) return new Promise(() => {});
      if (url.includes("/eligibility?")) {
        const ids = new URL(url, "http://fixture.invalid").searchParams.get("playerIds")!.split(",");
        return Promise.resolve(reply({ success: true, receipt: { seasonId: 20262027, source: "yahoo_players", scope: "Yahoo default positions",
          status: "ready", expiresAt: "2026-10-14T08:40:00.000Z", limitations: [], players: ids.map(id => ({ playerId: id,
            nhlId: id === owned.id ? owned.nhlId : candidate.nhlId, providerId: `477.p.${id}`, positions: ["C", "LW"],
            playerClass: "skater", asOf: "2026-10-13T08:41:00.000Z" })) } }));
      }
      return Promise.resolve(reply(url.includes("/data?") ? { success: true, data: { ...data, players: [...candidates, owned] } }
        : url.endsWith("/access") ? { data: { eligible: true, capabilities: ["rso_sync"] } } : { data: null }));
    });
    vi.stubGlobal("fetch", fetch);
    let evaluated: PlanningSnapshot | null = null;
    planningState.evaluate = (snapshot, intent) => { evaluated = snapshot; return planRoster(snapshot, intent); };
    render(<RosterScheduleOptimizer />);
    await waitFor(() => expect(evaluated?.players.find(row => row.id === candidate.id)?.eligibilityVerified).toBe(true));
    expect(fetch.mock.calls.some(([url]) => url.includes("/eligibility?") && url.includes(candidate.id))).toBe(true);
    const requested = fetch.mock.calls.filter(([url]) => url.includes("/eligibility?")).flatMap(([url]) =>
      new URL(url, "http://fixture.invalid").searchParams.get("playerIds")!.split(","));
    expect(requested).toHaveLength(Math.min(count + 1, 240)); expect(requested).toContain(owned.id);
    if (count > 240) {
      expect(requested).not.toContain(candidates[count - 1].id);
      expect(evaluated!.players.find(row => row.id === candidates[count - 1].id)?.eligibilityVerified).toBe(false);
      expect(screen.queryByText(/2 remain unchecked/)).toBeNull();
    }
    expect(evaluated!.players.find(row => row.id === candidate.id)).toMatchObject({ eligiblePositions: ["C", "LW"], availability: "unknown", canDrop: null });
    expect(evaluated!.rules.acquisitionTiming).toBe("unknown");
    expect(JSON.parse(window.localStorage.getItem(WORKSPACE_KEY)!).manualPlayers).toEqual(workspace.manualPlayers);
    expect(fetch.mock.calls.filter(([url]) => url.endsWith("/provider"))).toHaveLength(1);
  });
  it("recomputes provisional assignments from a fresh database receipt before Yahoo returns, then uses live league positions", async () => {
    vi.useFakeTimers({ toFake: ["Date"] }); vi.setSystemTime(new Date("2026-10-13T12:00:00Z"));
    authState.user = { id: "cache-fixture-manager" };
    const workspace = defaultWorkspace(); workspace.context = { ...workspace.context, provider: "yahoo", leagueId: "league", teamId: "team", timeZone: "UTC", startDate: "2026-10-13", endDate: "2026-10-13" };
    const cachedPlayer = { ...player, id: "8157", nhlId: 8473512, nhlTeamId: 9, rosterRevision: "current-membership", teamAbbreviation: "OTT", eligibilityVerified: false };
    workspace.roster = [{ playerId: cachedPlayer.id, position: "bench" }]; workspace.manualPlayers = [cachedPlayer]; workspace.rules.rosterSlots = { C: 1, LW: 1, RW: 1, BN: 1 };
    const schedule = { source: "Fixture schedule", asOf: workspace.context.asOf, seasonId: 20262027, completeness: "complete" as const, limitations: [] };
    const inputs: PlanningData = { players: [cachedPlayer], games: [{ id: "game", date: workspace.context.startDate, startsAt: "2026-10-13T20:00:00Z", status: "scheduled", teamAbbreviation: "OTT", opponent: "STL", home: true }], forecasts: [], evidence: { schedule } };
    writeWorkspace(window.localStorage, workspace);
    let releaseCache!: (body: unknown) => void, releaseProvider!: (body: unknown) => void;
    const response = (body: unknown) => ({ ok: true, json: async () => body });
    const fetch = vi.fn((url: string) => url.endsWith("/provider") ? new Promise(resolve => { releaseProvider = resolve; })
      : url.includes("/eligibility?") ? new Promise(resolve => { releaseCache = resolve; })
        : Promise.resolve(response(url.includes("/data?") ? { success: true, data: inputs }
          : url.endsWith("/access") ? { data: { eligible: true, capabilities: ["rso_sync"] } } : { data: null })));
    vi.stubGlobal("fetch", fetch);
    let evaluated: PlanningSnapshot | null = null;
    planningState.evaluate = (snapshot, intent) => { evaluated = snapshot; return planRoster(snapshot, intent); };
    render(<RosterScheduleOptimizer />);
    await waitFor(() => expect(releaseProvider).toBeTypeOf("function"));
    expect(screen.queryByText(/Reading stored Yahoo positions/)).toBeNull();
    await act(async () => releaseCache(response({ success: true, receipt: { seasonId: 20262027, source: "yahoo_players", scope: "Yahoo default positions", status: "ready", expiresAt: "2026-10-14T08:40:00.000Z", players: [{ playerId: "8157", nhlId: 8473512, providerId: "477.p.4002", positions: ["C", "LW", "RW"], playerClass: "skater", asOf: "2026-10-13T08:40:16.374Z" }], limitations: ["Current league roster, rules and locks are still unverified."] } })));
    await waitFor(() => expect(evaluated!.players[0].eligibilityVerified).toBe(true));
    expect(evaluated!.players[0].eligiblePositions).toEqual(["C", "LW", "RW"]);
    expect(evaluated!.evidence.roster?.completeness).toBe("partial");
    expect(evaluated!.players[0].availability).toBe("unknown"); expect(evaluated!.rules.acquisitionTiming).toBe("unknown");
    expect(screen.queryByText(/Yahoo default positions: 1\/1/)).toBeNull();
    expect(fetch.mock.calls.filter(([url]) => url.endsWith("/provider"))).toHaveLength(1);
    expect(JSON.parse(window.localStorage.getItem(WORKSPACE_KEY)!).manualPlayers[0].eligibilityVerified).toBe(false);
    const live = { ...evaluated!, id: "yahoo:live", players: [{ ...cachedPlayer, eligiblePositions: ["C"], eligibilityVerified: true, availability: "rostered" as const }], roster: workspace.roster };
    await act(async () => releaseProvider(response({ success: true, snapshot: live, capabilities: { roster: true, availability: true, limitations: [] } })));
    await waitFor(() => expect(evaluated!.id).toBe("yahoo:live"));
    expect(evaluated!.players[0].eligiblePositions).toEqual(["C"]);
    expect(screen.queryByText(/Yahoo default positions:/)).toBeNull();
  });
});
