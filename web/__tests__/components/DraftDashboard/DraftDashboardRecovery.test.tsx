import React from "react";
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

const noop = vi.fn();
const external = vi.hoisted(() => ({
  user: null as { id: string } | null,
  espnState: null as any,
  showRoster: false,
  showDraftButtons: false,
  renderProjectionPanels: false,
  players: null as any[] | null,
  filledSlots: {} as Record<string, number>,
  proEnabled: false,
  providerSyncEnabled: false,
  fantraxPlayers: [] as import("../../../lib/draftDashboard/fantraxPlayerSources").FantraxPlayerRow[],
  tablePlayers: [] as any[],
  tierPositions: [] as import("../../../lib/draftDashboard/positionalTiers").PositionTiers[],
  tierAdpSource: "",
  loadSettings: vi.fn(async () => ({ data: null as any, error: null })),
}));
const player = {
  playerId: 2,
  fullName: "Recovery Player",
  displayPosition: "C",
  eligiblePositions: ["C"],
  fantasyPoints: { projected: 10 },
  yahooAvgPick: 8,
  combinedStats: {},
};
const keeperPlayer = {
  playerId: 9,
  fullName: "Root Keeper",
  displayPosition: "C",
  eligiblePositions: ["C"],
  fantasyPoints: { projected: 11 },
  yahooAvgPick: 12,
  combinedStats: {},
};

const recoveryPlayers = [player, keeperPlayer];
const noGoalies: typeof player[] = [];

vi.mock("contexts/AuthProviderContext", () => ({ useAuth: () => ({ user: external.user, isLoading: false }) }));
vi.mock("lib/supabase", () => ({ default: { from: () => ({ select: () => ({ eq: () => ({ maybeSingle: () => external.loadSettings() }) }) }) } }));
vi.mock("hooks/useCurrentSeason", () => ({ useCurrentSeasonQuery: () => ({ data: null, isLoading: false }) }));
vi.mock("hooks/useDraftRanking", () => ({ useDraftRanking: () => ({ entries: { data: { entries: [] } }, bootstrap: { data: null } }) }));
vi.mock("hooks/useYahooDraftSync", () => ({ useYahooDraftSync: () => ({ enabled: false, selectedLeagueId: null, sessionId: null, requestState: null, terminalSessionMissing: false, resumeSession: noop, clearSession: noop, start: noop, stop: noop, connect: noop, draftState: null, error: null, isPolling: false, leagues: [], ranking: null, refreshAccount: noop, refreshDraft: noop, setSelectedLeagueId: noop }) }));
vi.mock("hooks/useEspnDraftSync", () => ({ useEspnDraftSync: () => ({ enabled: false, draftState: external.espnState, error: null, isLoading: false, isPolling: false, leagues: [], selectedLeagueId: null, setSelectedLeagueId: noop, start: noop, stop: noop, clear: noop, refresh: noop, reload: noop }) }));
vi.mock("hooks/useProcessedProjectionsData", () => ({ useProcessedProjectionsData: ({ activePlayerType }: { activePlayerType: string }) => ({ processedPlayers: activePlayerType === "goalie" ? noGoalies : external.players ?? recoveryPlayers, isLoading: false, error: null, customSourceResolutions: {}, customFallbackUsage: { total: 0 }, sourceWarnings: [], yahooMappingDiagnostics: null, inclusionDiagnostics: null }) }));
vi.mock("hooks/useVORPCalculations", () => ({ useVORPCalculations: ({ myFilledSlots }: { myFilledSlots: Record<string, number> }) => {
  external.filledSlots = myFilledSlots;
  const playerMetrics = external.renderProjectionPanels
    ? new Map(recoveryPlayers.map((p) => [String(p.playerId), { vorp: 5, vbd: 5, vona: 1 }]))
    : new Map();
  return { playerMetrics, replacementByPos: {}, expectedTakenByPos: {}, expectedN: 0 };
} }));
vi.mock("hooks/useRosterScheduleOptimizer", () => ({ useRosterScheduleOptimizer: () => ({ status: "idle" }) }));
vi.mock("components/PlayerAutocomplete", () => ({ default: () => null }));
vi.mock("components/DraftDashboard/MyRoster", async () => {
  const { default: MyRoster } = await vi.importActual<typeof import("../../../components/DraftDashboard/MyRoster")>("components/DraftDashboard/MyRoster");
  return { default: (props: React.ComponentProps<typeof MyRoster>) => external.showRoster
    ? <MyRoster {...props} />
    : <button disabled={!props.canDraft} onClick={() => props.onDraftPlayer("2")}>Draft recovery player</button> };
});
vi.mock("components/DraftDashboard/DraftBoard", () => ({ default: () => null }));
vi.mock("components/DraftDashboard/LeagueStandings", () => ({ default: () => null }));
vi.mock("components/DraftDashboard/DraftSummaryModal", () => ({ default: () => null }));
vi.mock("components/DraftDashboard/ImportCsvModal", () => ({
  default: ({ open, onImported }: any) => open ? (
    <div role="dialog" aria-label="CSV reimport">
      <button type="button" onClick={() => onImported({
        headers: [{ original: "Name", standardized: "full_name", selected: true }],
        rows: [{ full_name: "Recovery Player", player_id: 2, goals: 12 }],
        sourceId: "boundary_generated_id",
        label: "Recovered source",
        resolution: { totalRows: 1, idMatched: 1, nameMatched: 0, fuzzyMatched: 0, manualOverrides: 0, unresolved: 0, invalidIds: 0, coverage: 100, lastUpdated: 1, unresolvedNames: [] },
      })}>Complete CSV reimport</button>
    </div>
  ) : null,
}));
vi.mock("components/DraftDashboard/ComparePlayersModal", () => ({ default: () => null }));
vi.mock("components/DraftDashboard/YahooLiveDraftPanel", () => ({ default: () => null, YahooDraftOrderReminder: () => null }));
vi.mock("components/DraftDashboard/EspnLiveDraftPanel", () => ({ default: () => null }));
vi.mock("components/DraftDashboard/FantraxLeagueSettingsPanel", () => ({ default: () => null }));
vi.mock("components/integrations/EspnLeagueSettingsPanel", () => ({ default: () => null }));

import DraftDashboard from "../../../components/DraftDashboard/DraftDashboard";

vi.mock("hooks/useFantraxConnections", () => ({ fantraxAccountRequest: vi.fn(async () => ({ players: external.fantraxPlayers, hasLeagueEligibility: true })) }));
vi.mock("hooks/useFantraxDraftSync", () => ({ useFantraxDraftSync: () => ({ eligible: false, enabled: false, draftState: null }) }));
vi.mock("hooks/useProviderSyncAccess", () => ({ useProviderSyncAccess: () => ({ status: "ready", access: { eligible: external.providerSyncEnabled, reason: external.providerSyncEnabled ? "rollout_free" : "authentication_required" } }) }));
vi.mock("hooks/useDraftProAccess", () => ({ useDraftProAccess: () => ({ access: external.proEnabled ? { eligible: true, capabilities: ["recommendations"] } : null }) }));
vi.mock("hooks/useDraftProDust", () => ({ useDraftProDust: () => ({ data: null, error: null, isLoading: false }) }));
vi.mock("hooks/useDraftSchedule", () => ({ useDraftSchedule: () => ({ playerMetrics: new Map(), weeks: [], selectedWeeks: [], weeksError: null, periodLabel: "Season" }) }));
vi.mock("components/DraftDashboard/ProjectionsTable", async () => {
  const { default: Table } = await vi.importActual<typeof import("../../../components/DraftDashboard/ProjectionsTable")>("components/DraftDashboard/ProjectionsTable");
  return { default: (props: React.ComponentProps<typeof Table>) => {
    external.tablePlayers = props.allPlayers ?? [];
    if (external.renderProjectionPanels) return <Table {...props} />;
    return external.showDraftButtons
      ? external.tablePlayers.map((row) => (
          <button key={row.playerId} disabled={!props.canDraft} onClick={() => props.onDraftPlayer(String(row.playerId))}>
            Draft {row.fullName}
          </button>
        ))
      : null;
  } };
});
vi.mock("components/DraftDashboard/SuggestedPicks", async () => {
  const { default: Suggested } = await vi.importActual<typeof import("../../../components/DraftDashboard/SuggestedPicks")>("components/DraftDashboard/SuggestedPicks");
  return { default: (props: React.ComponentProps<typeof Suggested>) => {
    external.tierPositions = props.tierPositions ?? [];
    external.tierAdpSource = props.adpSource ?? "";
    return external.renderProjectionPanels ? <Suggested {...props} /> : null;
  } };
});
vi.mock("components/DraftDashboard/GodView", () => ({ default: () => null }));
vi.mock("components/DraftDashboard/DustMatrix", () => ({ default: () => null }));

const settings = { teamCount: 2, draftOrder: ["Team 1", "Team 2"], draftOrderMode: "snake" as const, reversedRounds: [], rosterConfig: { C: 1, LW: 0, RW: 0, D: 0, G: 0, bench: 1, utility: 0 }, scoringCategories: { GOALS: 3 }, leagueType: "points" as const };
const csv = { id: "custom_csv_one", label: "Tab source", playerType: "skater" as const, rows: [{ Player_Name: "Recovery Player", player_id: 2, Goals: 12, Position: "C" }] };
const snapshot = () => ({ v: 2, configured: true, draftSettings: settings, currentPick: 2, myTeamId: "Team 1", draftedPlayers: [{ playerId: "1", teamId: "Team 1", pickNumber: 1, round: 1, pickInRound: 1 }], keepers: [{ playerId: "9", teamId: "Team 2", cost: "none" }], pickTrades: [], positionOverrides: { "1": "UTILITY" }, draftHistory: [{ players: [], pickNumber: 1 }], sourceControls: { dtz_skaters: { isSelected: true, weight: 0.3 }, custom_csv_one: { isSelected: true, weight: 0.7 } }, goalieSourceControls: { dtz_goalies: { isSelected: true, weight: 1 } }, customCsvList: [csv], goaliePointValues: { WINS_GOALIE: 4 }, prorate84: true, riskSd: 28, forwardGrouping: "fwd", baselineMode: "full", needWeightEnabled: true, needAlpha: 0.8, personalizeReplacement: true });
const bookmark = () => ({ v: 3, settings, currentPick: 1, myTeamId: "Team 1", draftedPlayers: [], keepers: [], pickTrades: [], customCsvList: [csv], customSourceMetadata: [{ id: csv.id, label: csv.label }], sourceControls: { dtz_skaters: { isSelected: true, weight: 0.3 }, [csv.id]: { isSelected: true, weight: 0.7 } }, goalieSourceControls: { dtz_goalies: { isSelected: true, weight: 1 } }, goalieScoringCategories: { WINS_GOALIE: 4 } });
// Shape recorded by the historical createManualDraftRecoveryRecord writer.
function legacyV4Draft(attached = false) {
  return {
    v: 4,
    ts: 1700000000000,
    isSnakeDraft: true,
    configured: true,
    settings,
    draftedPlayers: [{ playerId: "2", teamId: "Team 1", pickNumber: 1, round: 1, pickInRound: 1 }],
    draftHistory: [{ players: [], pickNumber: 1, positionOverrides: {} }],
    currentPick: 2,
    myTeamId: "Team 1",
    customTeamNames: { "Team 1": "First Team", "Team 2": "Second Team" },
    forwardGrouping: "split",
    baselineMode: "full",
    personalizeReplacement: true,
    needWeightEnabled: true,
    needAlpha: 0.8,
    prorate84: true,
    riskSd: 28,
    goalieScoringCategories: { WINS_GOALIE: 4 },
    sourceControls: bookmark().sourceControls,
    goalieSourceControls: bookmark().goalieSourceControls,
    keepers: [],
    pickTrades: [],
    positionOverrides: { "2": "C" },
    preserveExactCategoryWeights: true,
    csvMetadata: [{ id: csv.id, label: csv.label }],
    ...(attached ? { customCsvEntries: [{ id: csv.id, label: csv.label, rows: csv.rows }] } : {}),
  };
}

const tabSnapshot = () => JSON.parse(sessionStorage.getItem("draft.snapshot.v2") || "{}");
const saved = () => {
  const snap = tabSnapshot();
  if (!snap.tabCsvSidecar) return snap;
  return { ...snap, customCsvList: JSON.parse(sessionStorage.getItem("draft.customCsvList.v3") ?? "[]") };
};
const dialog = () => screen.getByRole("dialog", { name: "Draft Settings" });
function openSettings() {
  if (!screen.queryByRole("dialog", { name: "Draft Settings" })) fireEvent.click(screen.getByRole("tab", { name: "Setup" }));
}
function importBookmark(data: unknown) {
  openSettings();
  fireEvent.click(within(dialog()).getByRole("button", { name: "Import bookmark" }));
  fireEvent.change(screen.getByLabelText("Import draft bookmark"), { target: { value: JSON.stringify(data) } });
  fireEvent.click(screen.getByRole("button", { name: "Import Bookmark" }));
}
function management() {
  const button = within(dialog()).queryByRole("button", { name: "Management" });
  if (button) fireEvent.click(button);
}

beforeEach(() => {
  vi.stubGlobal("ResizeObserver", class {
    observe() {}
    unobserve() {}
    disconnect() {}
  });
  Object.defineProperty(HTMLElement.prototype, "scrollTo", { configurable: true, value: vi.fn() });
  Object.defineProperty(HTMLElement.prototype, "scrollIntoView", { configurable: true, value: vi.fn() });
  Object.defineProperty(window, "matchMedia", { configurable: true, value: vi.fn(() => ({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() })) });
  vi.spyOn(window, "confirm").mockReturnValue(true);
});
afterEach(() => {
  cleanup(); sessionStorage.clear(); localStorage.clear(); vi.restoreAllMocks(); vi.unstubAllGlobals();
  external.renderProjectionPanels = false; external.showRoster = false; external.showDraftButtons = false; external.players = null; external.filledSlots = {};
  external.proEnabled = false; external.providerSyncEnabled = false; external.fantraxPlayers = []; external.tablePlayers = []; external.tierPositions = []; external.tierAdpSource = "";
  external.user = null; external.espnState = null; external.loadSettings.mockReset(); external.loadSettings.mockResolvedValue({ data: null, error: null });
});

it.each(["draft.snapshot.v2", "draftDashboard.session.v1"])("declining %s starts clean and preserves unrelated storage under StrictMode", async (key) => {
  const storage = key.startsWith("draft.snapshot") ? sessionStorage : localStorage;
  storage.setItem(key, JSON.stringify(snapshot()));
  sessionStorage.setItem("draft.customCsvList.v3", JSON.stringify([csv]));
  localStorage.setItem("draft.sourceControls.v4", JSON.stringify({ version: 4, skater: snapshot().sourceControls, goalie: snapshot().goalieSourceControls }));
  localStorage.setItem("draftDashboard.baselineMode", "full");
  localStorage.setItem("projections.prorate84", "true");
  localStorage.setItem("projections.riskSd", "28");
  localStorage.setItem("sb-unrelated-auth-token", "preserved"); sessionStorage.setItem("unrelated", "preserved");
  vi.mocked(window.confirm).mockReturnValue(false);
  render(<React.StrictMode><DraftDashboard /></React.StrictMode>);
  await waitFor(() => expect(saved()).toMatchObject({ draftSettings: { teamCount: 12 }, currentPick: 1, draftedPlayers: [], keepers: [], pickTrades: [], positionOverrides: {}, draftHistory: [], customCsvList: [], baselineMode: "remaining", prorate84: false, riskSd: 12 }));
  expect(Object.keys(saved().sourceControls)).not.toContain(csv.id);
  expect(sessionStorage.getItem("draft.customCsvList.v3")).toBeNull();
  expect(localStorage.getItem("sb-unrelated-auth-token")).toBe("preserved"); expect(sessionStorage.getItem("unrelated")).toBe("preserved");
  expect(window.confirm).toHaveBeenCalledTimes(1);
});

it("keeps the previous draft on failed import, reports failure, and accepts a retry", async () => {
  sessionStorage.setItem("draft.snapshot.v2", JSON.stringify({ ...snapshot(), customCsvList: [] , sourceControls: { dtz_skaters: { isSelected: true, weight: 1 } } }));
  render(<DraftDashboard />);
  await waitFor(() => expect(saved().draftedPlayers).toHaveLength(1));
  const previous = saved();
  const original = Storage.prototype.setItem;
  let blocked = true;
  vi.spyOn(Storage.prototype, "setItem").mockImplementation(function (this: Storage, key, value) {
    if (blocked && this === sessionStorage && key === "draft.customCsvList.v3") throw new DOMException("quota", "QuotaExceededError");
    return original.call(this, key, value);
  });
  importBookmark(bookmark());
  expect(screen.getByLabelText("Import draft bookmark")).toBeTruthy();
  expect(dialog().textContent).toContain("current draft has not changed");
  expect(saved()).toEqual(previous);
  blocked = false;
  fireEvent.click(screen.getByRole("button", { name: "Import Bookmark" }));
  await waitFor(() => expect(saved().draftedPlayers).toEqual([]));
  expect(screen.queryByLabelText("Import draft bookmark")).toBeNull();
  expect(JSON.parse(sessionStorage.getItem("draft.customCsvList.v3")!)[0]).toEqual(csv);
});

it.each(["draft.customCsvList.v3", "draft.customCsvList.v2"])(
  "holds ambiguous CSVs in %s until an explicit replacement is durably saved",
  async (key) => {
    const raw = JSON.stringify([csv, { ...csv, label: "Conflicting source" }]);
    const priorTab = JSON.stringify(snapshot());
    const priorDevice = JSON.stringify({ ...snapshot(), currentPick: 3 });
    sessionStorage.setItem(key, raw);
    sessionStorage.setItem("draft.snapshot.v2", priorTab);
    localStorage.setItem("draftDashboard.session.v1", priorDevice);

    const view = render(<React.StrictMode><DraftDashboard /></React.StrictMode>);
    await waitFor(() => expect(dialog().textContent).toContain(`Duplicate projection CSV source ID "${csv.id}"`));
    expect(dialog().textContent).toContain("import a valid draft bookmark");
    expect((screen.getByRole("button", { name: "Draft recovery player", hidden: true }) as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(within(dialog()).getByRole("button", { name: "Done" }));
    management();
    fireEvent.click(screen.getByRole("button", { name: "Start New Draft" }));
    fireEvent.click(screen.getByRole("button", { name: "Cancel New Draft" }));

    const setItem = Storage.prototype.setItem;
    let rejectSnapshot = true;
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(function (this: Storage, storageKey, value) {
      if (rejectSnapshot && this === sessionStorage && storageKey === "draft.snapshot.v2") throw new DOMException("quota", "QuotaExceededError");
      return setItem.call(this, storageKey, value);
    });
    importBookmark({ ...bookmark(), customCsvList: [], customSourceMetadata: [], sourceControls: { dtz_skaters: { isSelected: true, weight: 1 } } });
    expect(dialog().textContent).toContain("The current draft has not changed");
    expect(dialog().textContent).toContain("Duplicate projection CSV source ID");
    expect(sessionStorage.getItem(key)).toBe(raw);
    expect(sessionStorage.getItem("draft.customCsvList.v3")).toBe(key.endsWith("v3") ? raw : null);
    expect(sessionStorage.getItem("draft.snapshot.v2")).toBe(priorTab);
    expect(localStorage.getItem("draftDashboard.session.v1")).toBe(priorDevice);

    rejectSnapshot = false;
    fireEvent.click(screen.getByRole("button", { name: "Import Bookmark" }));
    await waitFor(() => expect(dialog().textContent).toContain("Draft bookmark imported."));
    expect(dialog().textContent).not.toContain("Duplicate projection CSV source ID");
    expect(sessionStorage.getItem("draft.customCsvList.v3")).toBe("[]");
    expect(saved().customCsvList).toEqual([]);

    view.unmount();
    render(<DraftDashboard />);
    await waitFor(() => expect(saved().customCsvList).toEqual([]));
    expect(screen.queryByText(/Duplicate projection CSV source ID/)).toBeNull();
  },
);

it("retains saved bytes after a failed clean start, then clears the duplicate on retry", async () => {
  const raw = JSON.stringify([csv, { ...csv, label: "Conflicting source" }]);
  const prior = JSON.stringify(snapshot());
  sessionStorage.setItem("draft.customCsvList.v3", raw);
  sessionStorage.setItem("draft.snapshot.v2", prior);
  localStorage.setItem("draftDashboard.session.v1", prior);

  render(<DraftDashboard />);
  await waitFor(() => expect(dialog().textContent).toContain("Duplicate projection CSV source ID"));
  management();
  const removeItem = Storage.prototype.removeItem;
  let rejectCsvRemoval = true;
  vi.spyOn(Storage.prototype, "removeItem").mockImplementation(function (this: Storage, key) {
    if (rejectCsvRemoval && this === sessionStorage && key === "draft.customCsvList.v3") throw new DOMException("blocked", "SecurityError");
    return removeItem.call(this, key);
  });
  fireEvent.click(screen.getByRole("button", { name: "Start New Draft" }));
  fireEvent.click(screen.getByRole("button", { name: "Confirm Start New Draft" }));

  expect(dialog().textContent).toContain("Duplicate projection CSV source ID");
  expect(dialog().textContent).toContain("Could not clear the saved draft");
  expect(sessionStorage.getItem("draft.customCsvList.v3")).toBe(raw);
  expect(sessionStorage.getItem("draft.snapshot.v2")).toBe(prior);
  expect(localStorage.getItem("draftDashboard.session.v1")).toBe(prior);

  rejectCsvRemoval = false;
  management();
  fireEvent.click(screen.getByRole("button", { name: "Start New Draft" }));
  fireEvent.click(screen.getByRole("button", { name: "Confirm Start New Draft" }));
  await waitFor(() => expect(saved().draftSettings.teamCount).toBe(12));
  expect(sessionStorage.getItem("draft.customCsvList.v3")).toBeNull();
  expect(dialog().textContent).not.toContain("Duplicate projection CSV source ID");
});

it.each(["tab", "device"] as const)(
  "explicitly restores the existing %s draft without trusting duplicate rows",
  async (source) => {
    const tabKey = "draft.snapshot.v2";
    const deviceKey = "draftDashboard.session.v1";
    const csvKey = "draft.customCsvList.v3";
    const unreliable = { ...csv, rows: [{ Player_Name: "Wrong player", Goals: 999 }] };
    const raw = JSON.stringify([unreliable, { ...unreliable, label: "Other conflicting source" }]);
    const prior = {
      ...snapshot(),
      draftSettings: { ...settings, isKeeper: true },
      customCsvList: source === "tab" ? [csv] : undefined,
      customSourceMetadata: [{ id: csv.id, label: csv.label }],
    };
    const store = source === "tab" ? sessionStorage : localStorage;
    const key = source === "tab" ? tabKey : deviceKey;
    sessionStorage.setItem(csvKey, raw);
    store.setItem(key, JSON.stringify(prior));
    render(<DraftDashboard />);
    const restore = await screen.findByRole("button", { name: `Restore saved ${source} draft` });
    expect(sessionStorage.getItem(csvKey)).toBe(raw);

    const setItem = Storage.prototype.setItem;
    let failSnapshot = true;
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(function (this: Storage, storageKey, value) {
      if (failSnapshot && this === sessionStorage && storageKey === tabKey) throw new DOMException("quota", "QuotaExceededError");
      return setItem.call(this, storageKey, value);
    });
    fireEvent.click(restore);
    expect(dialog().textContent).toContain("Duplicate projection CSV source ID");
    expect(dialog().textContent).toContain("Could not save imported projections");
    expect(sessionStorage.getItem(csvKey)).toBe(raw);
    expect(store.getItem(key)).toBe(JSON.stringify(prior));

    failSnapshot = false;
    fireEvent.click(restore);
    await waitFor(() => expect(saved().draftedPlayers).toContainEqual(prior.draftedPlayers[0]));
    expect(saved()).toMatchObject({ currentPick: prior.currentPick, draftHistory: prior.draftHistory });
    const expected = source === "tab" ? [csv] : [{ id: csv.id, label: csv.label, playerType: "skater", rows: [] }];
    expect(saved().customCsvList).toEqual(expected);
    expect(JSON.parse(sessionStorage.getItem(csvKey)!)).toEqual(expected);
    expect(screen.queryByText(/Duplicate projection CSV source ID/)).toBeNull();
    if (source === "device") {
      expect(dialog().textContent).toContain("Reimport or remove this source before drafting");
    }
  },
);

it("keeps an old bookmark unresolved after a different CSV is imported into an empty list", async () => {
  render(<DraftDashboard />);
  management();
  fireEvent.click(within(dialog()).getByRole("button", { name: "Import CSV" }));
  fireEvent.click(screen.getByRole("button", { name: "Complete CSV reimport" }));
  await waitFor(() => expect(saved().customCsvList).toHaveLength(1));

  const oldId = "custom_csv_1";
  importBookmark({
    ...bookmark(),
    customCsvList: undefined,
    customSourceMetadata: [{ id: oldId, label: "Earlier projections" }],
    sourceControls: { [oldId]: { isSelected: true, weight: 1 } },
  });
  await waitFor(() => expect(saved().customCsvList).toEqual([
    { id: oldId, label: "Earlier projections", playerType: "skater", rows: [] },
  ]));
});

it("preserves an unsupported future device record without treating it as a current snapshot", async () => {
  const raw = JSON.stringify({ ...snapshot(), v: 5 });
  localStorage.setItem("draftDashboard.session.v1", raw);
  render(<DraftDashboard />);
  expect(await screen.findByRole("button", { name: "Retry saved draft recovery" })).toBeTruthy();
  expect(localStorage.getItem("draftDashboard.session.v1")).toBe(raw);
  expect(sessionStorage.getItem("draft.snapshot.v2")).toBeNull();
});

it.each(["writer", "earlier aliases"] as const)("resumes a historical device record with %s fields and keeps missing-source labels", async (shape) => {
  const legacy = legacyV4Draft();
  const { settings: draftSettings, goalieScoringCategories: goaliePointValues, ...rest } = legacy;
  const device = shape === "writer" ? legacy : { ...rest, draftSettings, goaliePointValues };
  localStorage.setItem("draftDashboard.session.v1", JSON.stringify(device));
  sessionStorage.setItem("draft.customCsvList.v3", JSON.stringify([{ ...csv, rows: [{ Name: "Another draft" }] }]));
  if (shape === "writer") sessionStorage.setItem("draft.snapshot.v2", "{unreadable");
  render(<React.StrictMode><DraftDashboard /></React.StrictMode>);
  if (shape === "writer") fireEvent.click(await screen.findByRole("button", { name: "Restore saved device draft" }));
  await waitFor(() => expect(saved()).toMatchObject({
    draftedPlayers: legacy.draftedPlayers, currentPick: legacy.currentPick, draftSettings: { teamCount: 2 },
    goaliePointValues, positionOverrides: legacy.positionOverrides, prorate84: true, riskSd: 28,
  }));
  expect(JSON.parse(sessionStorage.getItem("draft.customCsvList.v3")!)).toEqual([{ ...csv, rows: [] }]);
});

it("keeps current picks when an older bookmark has orphan overrides or invalid historical picks", async () => {
  sessionStorage.setItem("draft.snapshot.v2", JSON.stringify(snapshot()));
  render(<DraftDashboard />);
  await waitFor(() => expect(saved().draftedPlayers).toEqual(snapshot().draftedPlayers));
  const legacy = legacyV4Draft(true);
  const raw = sessionStorage.getItem("draft.snapshot.v2");
  for (const [changes, message] of [
    [{ positionOverrides: { orphan: "C" } }, "Invalid roster slot overrides"],
    [{ draftHistory: [{ players: [], pickNumber: 1, positionOverrides: { orphan: "C" } }] }, "Invalid undo history"],
    [{ draftHistory: [{ players: [{ ...legacy.draftedPlayers[0], teamId: "Gone" }], pickNumber: 1 }] }, "Invalid undo history"],
  ] as const) {
    openSettings();
    if (!screen.queryByLabelText("Import draft bookmark")) fireEvent.click(within(dialog()).getByRole("button", { name: "Import bookmark" }));
    fireEvent.change(screen.getByLabelText("Import draft bookmark"), { target: { value: JSON.stringify({ ...legacy, ...changes }) } });
    fireEvent.click(screen.getByRole("button", { name: "Import Bookmark" }));
    expect(dialog().textContent).toContain(message);
    expect(sessionStorage.getItem("draft.snapshot.v2")).toBe(raw);
  }
});

it("restores a v4-only compact tab draft explicitly and preserves old storage on a failed write", async () => {
  const legacyKey = "draft.snapshot.v4";
  const csvKey = "draft.customCsvList.v3";
  const priorCsvKey = "draft.customCsvList.v2";
  const legacy = legacyV4Draft();
  const raw = JSON.stringify(legacy);
  const csvRaw = JSON.stringify([csv]);
  sessionStorage.setItem(legacyKey, raw);
  sessionStorage.setItem(priorCsvKey, csvRaw);

  render(<React.StrictMode><DraftDashboard /></React.StrictMode>);
  const restore = await screen.findByRole("button", { name: "Restore legacy saved tab draft" });
  expect(sessionStorage.getItem("draft.snapshot.v2")).toBeNull();
  expect(localStorage.getItem("draftDashboard.session.v1")).toBeNull();
  expect(sessionStorage.getItem(csvKey)).toBeNull();

  const setItem = Storage.prototype.setItem;
  let rejectSnapshot = true;
  vi.spyOn(Storage.prototype, "setItem").mockImplementation(function (this: Storage, key, value) {
    if (rejectSnapshot && this === sessionStorage && key === "draft.snapshot.v2") throw new DOMException("quota", "QuotaExceededError");
    return setItem.call(this, key, value);
  });
  fireEvent.click(restore);
  expect(dialog().textContent).toContain("Could not save the restored draft");
  expect(sessionStorage.getItem(legacyKey)).toBe(raw);
  expect(sessionStorage.getItem(priorCsvKey)).toBe(csvRaw);
  expect(sessionStorage.getItem(csvKey)).toBeNull();
  expect(sessionStorage.getItem("draft.snapshot.v2")).toBeNull();

  rejectSnapshot = false;
  fireEvent.click(restore);
  await waitFor(() => expect(saved()).toMatchObject({
    v: 2,
    currentPick: 2,
    draftedPlayers: legacy.draftedPlayers,
    draftHistory: legacy.draftHistory,
    positionOverrides: legacy.positionOverrides,
    sourceControls: legacy.sourceControls,
    goaliePointValues: legacy.goalieScoringCategories,
    customCsvList: [csv],
    prorate84: true,
    riskSd: 28,
  }));
  expect(sessionStorage.getItem(legacyKey)).toBe(raw);
  expect(sessionStorage.getItem(priorCsvKey)).toBe(csvRaw);
});

it.each(["tab", "device"] as const)(
  "prefers the current %s draft until the user chooses the older tab draft",
  async (source) => {
    const legacy = legacyV4Draft();
    const raw = JSON.stringify(legacy);
    sessionStorage.setItem("draft.snapshot.v4", raw);
    const newerStore = source === "tab" ? sessionStorage : localStorage;
    const newerKey = source === "tab" ? "draft.snapshot.v2" : "draftDashboard.session.v1";
    newerStore.setItem(newerKey, JSON.stringify(snapshot()));
    render(<DraftDashboard />);
    await waitFor(() => expect(saved().draftedPlayers).toContainEqual(snapshot().draftedPlayers[0]));
    openSettings();
    const restore = screen.getByRole("button", { name: "Restore legacy saved tab draft" });
    const currentRaw = sessionStorage.getItem("draft.snapshot.v2");
    const currentDevice = localStorage.getItem("draftDashboard.session.v1");
    vi.mocked(window.confirm).mockReturnValueOnce(false);
    fireEvent.click(restore);
    expect(window.confirm).toHaveBeenLastCalledWith(expect.stringContaining("Replace your current saved draft"));
    expect(sessionStorage.getItem("draft.snapshot.v2")).toBe(currentRaw);
    expect(localStorage.getItem("draftDashboard.session.v1")).toBe(currentDevice);
    expect(sessionStorage.getItem("draft.snapshot.v4")).toBe(raw);

    fireEvent.click(restore);
    await waitFor(() => expect(saved().draftedPlayers).toEqual(legacy.draftedPlayers));
    expect(saved().customCsvList).toEqual([{ id: csv.id, label: csv.label, playerType: "skater", rows: [] }]);
    expect(sessionStorage.getItem("draft.snapshot.v4")).toBe(raw);
  },
);

it.each([true, false])("imports historical v4 bookmarks through the current reader (attached=%s)", async (attached) => {
  sessionStorage.setItem("draft.snapshot.v2", JSON.stringify(snapshot()));
  render(<DraftDashboard />);
  await waitFor(() => expect(saved().draftedPlayers).toContainEqual(snapshot().draftedPlayers[0]));
  const originalCurrent = sessionStorage.getItem("draft.snapshot.v2");
  const originalCsv = sessionStorage.getItem("draft.customCsvList.v3");
  const legacy = legacyV4Draft(attached);

  vi.mocked(window.confirm).mockReturnValueOnce(false);
  importBookmark(legacy);
  expect(dialog().textContent).toContain("Import cancelled");
  expect(sessionStorage.getItem("draft.snapshot.v2")).toBe(originalCurrent);
  expect(sessionStorage.getItem("draft.customCsvList.v3")).toBe(originalCsv);

  fireEvent.click(screen.getByRole("button", { name: "Import Bookmark" }));
  await waitFor(() => expect(saved().draftedPlayers).toEqual(legacy.draftedPlayers));
  expect(saved().draftHistory).toEqual(legacy.draftHistory);
  expect(saved().customCsvList).toEqual(attached
    ? legacy.customCsvEntries
    : [{ id: csv.id, label: csv.label, playerType: "skater", rows: [] }]);
  expect(dialog().textContent).toContain(attached ? "Draft bookmark imported." : "Missing projection CSVs must be reimported or removed");
  expect(sessionStorage.getItem("draft.snapshot.v4")).toBeNull();
});

it("keeps a v4 draft already in setup unconfigured until its sources are fixed", async () => {
  const legacy = legacyV4Draft();
  sessionStorage.setItem("draft.snapshot.v4", JSON.stringify({
    ...legacy, configured: false, sourceControls: {}, goalieSourceControls: {},
  }));
  render(<DraftDashboard />);
  fireEvent.click(await screen.findByRole("button", { name: "Restore legacy saved tab draft" }));
  await waitFor(() => expect(saved()).toMatchObject({ configured: false, draftedPlayers: legacy.draftedPlayers }));
  expect((screen.getByRole("button", { name: "Draft recovery player", hidden: true }) as HTMLButtonElement).disabled).toBe(true);
});

it("migrates a full snapshot and keeps recurring picks compact while restoring the verified sidecar", async () => {
  sessionStorage.setItem("draft.snapshot.v2", JSON.stringify({
    ...snapshot(), currentPick: 1, draftedPlayers: [], keepers: [], positionOverrides: {}, draftHistory: [],
  }));
  const view = render(<React.StrictMode><DraftDashboard /></React.StrictMode>);
  await waitFor(() => expect(tabSnapshot()).toMatchObject({
    tabCsvSidecar: true, customSourceMetadata: [{ id: csv.id, label: csv.label, contentFingerprint: expect.any(String) }],
  }));
  expect(tabSnapshot()).not.toHaveProperty("customCsvList");
  expect(saved().customCsvList).toEqual([csv]);
  const csvBytes = sessionStorage.getItem("draft.customCsvList.v3");

  const reads = vi.spyOn(Storage.prototype, "getItem");
  const writes = vi.spyOn(Storage.prototype, "setItem");
  view.rerender(<React.StrictMode><DraftDashboard /></React.StrictMode>);
  expect(reads.mock.calls.some(([key]) => key === "draft.customCsvList.v3")).toBe(false);
  expect(writes.mock.calls.some(([key]) => key === "draft.customCsvList.v3")).toBe(false);

  fireEvent.click(screen.getByRole("button", { name: "Draft recovery player" }));
  await waitFor(() => expect(tabSnapshot().draftedPlayers).toHaveLength(1));
  expect(tabSnapshot()).not.toHaveProperty("customCsvList");
  expect(JSON.parse(localStorage.getItem("draftDashboard.session.v1")!)).not.toHaveProperty("customCsvList");
  expect(writes.mock.calls.some(([key]) => key === "draft.customCsvList.v3")).toBe(false);
  expect(sessionStorage.getItem("draft.customCsvList.v3")).toBe(csvBytes);

  view.unmount();
  render(<DraftDashboard />);
  await waitFor(() => expect(tabSnapshot().draftedPlayers).toHaveLength(1));
  expect(saved().customCsvList).toEqual([csv]);
});

it("does not hydrate a changed sidecar through the same source ID and label", async () => {
  sessionStorage.setItem("draft.snapshot.v2", JSON.stringify(snapshot()));
  const initial = render(<DraftDashboard />);
  await waitFor(() => expect(tabSnapshot().tabCsvSidecar).toBe(true));
  initial.unmount();

  const changedCsv = JSON.stringify([{ ...csv, rows: [{ ...csv.rows[0], Goals: 999 }] }]);
  sessionStorage.setItem("draft.customCsvList.v3", changedCsv);
  render(<DraftDashboard />);
  await waitFor(() => expect(tabSnapshot().customSourceMetadata).toEqual([{ id: csv.id, label: csv.label, playerType: "skater", missing: true }]));
  expect(dialog().textContent).toContain("Reimport or remove this source before drafting");
  expect(sessionStorage.getItem("draft.customCsvList.v3")).toBe(changedCsv);
});

it("keeps the prior compact record and sidecar when a CSV removal cannot commit", async () => {
  sessionStorage.setItem("draft.snapshot.v2", JSON.stringify(snapshot()));
  render(<DraftDashboard />);
  await waitFor(() => expect(tabSnapshot().tabCsvSidecar).toBe(true));
  openSettings();
  fireEvent.click(within(dialog()).getByRole("tab", { name: /^Projections/ }));
  fireEvent.click(within(dialog()).getByRole("button", { name: "Edit Weights" }));
  const group = within(dialog()).getByRole("region", { name: "Skaters projection sources" });
  const old = sessionStorage.getItem("draft.snapshot.v2");
  const csvOld = sessionStorage.getItem("draft.customCsvList.v3");

  const setItem = Storage.prototype.setItem;
  let rejectSnapshot = true;
  vi.spyOn(Storage.prototype, "setItem").mockImplementation(function (this: Storage, key, value) {
    if (rejectSnapshot && this === sessionStorage && key === "draft.snapshot.v2") throw new DOMException("quota", "QuotaExceededError");
    return setItem.call(this, key, value);
  });
  fireEvent.click(within(group).getByRole("button", { name: "Remove Tab source" }));
  expect(dialog().textContent).toContain("Could not save imported projections");
  expect(sessionStorage.getItem("draft.snapshot.v2")).toBe(old);
  expect(sessionStorage.getItem("draft.customCsvList.v3")).toBe(csvOld);

  rejectSnapshot = false;
  fireEvent.click(within(group).getByRole("button", { name: "Remove Tab source" }));
  await waitFor(() => expect(saved().customCsvList).toEqual([]));
  expect(tabSnapshot().sourceControls[csv.id]).toBeUndefined();
  expect(tabSnapshot()).not.toHaveProperty("customCsvList");
});

it("shows device and preference write failures and exports the recovered analysis values", async () => {
  const device = JSON.stringify({ ...snapshot(), currentPick: 3 });
  sessionStorage.setItem("draft.snapshot.v2", JSON.stringify(snapshot()));
  localStorage.setItem("draftDashboard.session.v1", device);
  localStorage.setItem("projections.riskSd", "6");
  localStorage.setItem("projections.prorate84", "false");
  const setItem = Storage.prototype.setItem;
  vi.spyOn(Storage.prototype, "setItem").mockImplementation(function (this: Storage, key, value) {
    if (this === localStorage && ["draftDashboard.session.v1", "projections.riskSd", "projections.prorate84"].includes(key)) {
      throw new DOMException("quota", "QuotaExceededError");
    }
    return setItem.call(this, key, value);
  });

  render(<React.StrictMode><DraftDashboard /></React.StrictMode>);
  await waitFor(() => expect(tabSnapshot()).toMatchObject({ prorate84: true, riskSd: 28 }));
  expect(localStorage.getItem("draftDashboard.session.v1")).toBe(device);
  expect(localStorage.getItem("projections.riskSd")).toBe("6");
  expect(localStorage.getItem("projections.prorate84")).toBe("false");
  openSettings();
  expect(dialog().textContent).toContain("Could not save this draft on this device");
  expect(dialog().textContent).toContain("Analysis preferences could not be saved");

  let exportedJson = "";
  const NativeBlob = globalThis.Blob;
  vi.stubGlobal("Blob", class extends NativeBlob {
    constructor(parts: BlobPart[]) { super(parts); exportedJson = String(parts[0]); }
  });
  const NativeURL = globalThis.URL;
  const revokeObjectURL = vi.fn();
  vi.stubGlobal("URL", class extends NativeURL {
    static createObjectURL() { return "blob:draft-fixture"; }
    static revokeObjectURL(url: string) { revokeObjectURL(url); }
  });
  vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
  fireEvent.click(within(dialog()).getByRole("button", { name: "Export bookmark" }));
  expect(JSON.parse(exportedJson)).toMatchObject({ v: 3, prorate84: true, riskSd: 28, draftedPlayers: snapshot().draftedPlayers });
  await waitFor(() => expect(revokeObjectURL).toHaveBeenCalledWith("blob:draft-fixture"));
});

it("requires explicit removal of a missing CSV even after both projection controls are disabled", async () => {
  const control = { isSelected: true, weight: 0.5 };
  render(<DraftDashboard />);
  importBookmark({ ...bookmark(), customCsvList: undefined,
    goalieSourceControls: { dtz_goalies: control, [csv.id]: control },
  });
  fireEvent.click(within(dialog()).getByRole("tab", { name: /^Projections/ }));
  for (const label of ["Skaters projection sources", "Goalies projection sources"]) {
    const group = within(dialog()).getByRole("region", { name: label });
    fireEvent.click(within(group).getByRole("checkbox", { name: "Toggle source Tab source" }));
  }
  await waitFor(() => {
    expect(saved().sourceControls[csv.id].isSelected).toBe(false);
    expect(saved().goalieSourceControls[csv.id].isSelected).toBe(false);
  });
  fireEvent.click(within(dialog()).getByRole("button", { name: "Done" }));
  expect(dialog().textContent).toContain("Reimport or remove this source before drafting");
  expect((screen.getByRole("button", { name: "Draft recovery player", hidden: true }) as HTMLButtonElement).disabled).toBe(true);
  fireEvent.click(within(dialog()).getAllByRole("button", { name: "Remove Tab source" })[0]);
  await waitFor(() => expect(saved().sourceControls[csv.id]).toBeUndefined());
  expect(saved().goalieSourceControls[csv.id]).toBeUndefined();
  fireEvent.click(within(dialog()).getByRole("button", { name: "Done" }));
  expect(screen.queryByRole("dialog", { name: "Draft Settings" })).toBeNull();
  expect((screen.getByRole("button", { name: "Draft recovery player" }) as HTMLButtonElement).disabled).toBe(false);
});

it.each(["v2", "v4"] as const)(
  "restores named missing sources from %s without writing an empty sidecar and preserves the recovery guard on reload",
  async (version) => {
    const csvKey = "draft.customCsvList.v3";
    const legacy = legacyV4Draft();
    const goalieControls = { ...legacy.goalieSourceControls, [csv.id]: { isSelected: true, weight: 0.4 } };
    if (version === "v4") {
      sessionStorage.setItem("draft.snapshot.v4", JSON.stringify({ ...legacy, goalieSourceControls: goalieControls }));
    } else {
      sessionStorage.setItem("draft.snapshot.v2", JSON.stringify({
        ...snapshot(), keepers: [], customCsvList: undefined, customSourceMetadata: legacy.csvMetadata,
        goalieSourceControls: goalieControls,
      }));
      sessionStorage.setItem(csvKey, "[]");
    }

    const setItem = Storage.prototype.setItem;
    const writes = vi.spyOn(Storage.prototype, "setItem").mockImplementation(function (this: Storage, key, value) {
      if (this === sessionStorage && key === csvKey) throw new DOMException("quota", "QuotaExceededError");
      return setItem.call(this, key, value);
    });
    const view = render(<React.StrictMode><DraftDashboard /></React.StrictMode>);
    if (version === "v4") fireEvent.click(await screen.findByRole("button", { name: "Restore legacy saved tab draft" }));

    const expectRestoredMetadata = () => {
      expect(tabSnapshot()).toMatchObject({
        tabCsvSidecar: true,
        customSourceMetadata: [{ id: csv.id, label: csv.label, playerType: "both", missing: true }],
        sourceControls: { [csv.id]: { isSelected: true, weight: 0.7 } },
        goalieSourceControls: { [csv.id]: { isSelected: true, weight: 0.4 } },
      });
      expect(dialog().textContent).toContain("Reimport or remove this source before drafting");
      expect((screen.getByRole("button", { name: "Draft recovery player", hidden: true }) as HTMLButtonElement).disabled).toBe(true);
    };
    await waitFor(expectRestoredMetadata);
    expect(writes.mock.calls.some(([key]) => key === csvKey)).toBe(false);
    expect(sessionStorage.getItem(csvKey)).toBe(version === "v4" ? null : "[]");

    view.unmount();
    render(<React.StrictMode><DraftDashboard /></React.StrictMode>);
    await waitFor(expectRestoredMetadata);
    fireEvent.click(within(dialog()).getByRole("tab", { name: /^Projections/ }));
    for (const group of ["Skaters projection sources", "Goalies projection sources"]) {
      expect(within(screen.getByRole("region", { name: group })).getByRole("button", { name: "Reimport Tab source" })).toBeTruthy();
    }
    expect(writes.mock.calls.some(([key]) => key === csvKey)).toBe(false);

    writes.mockRestore();
    fireEvent.click(within(dialog()).getAllByRole("button", { name: "Remove Tab source" })[0]);
    await waitFor(() => expect(tabSnapshot().sourceControls[csv.id]).toBeUndefined());
    expect(tabSnapshot().goalieSourceControls[csv.id]).toBeUndefined();
    fireEvent.click(within(dialog()).getByRole("button", { name: "Done" }));
    expect(screen.queryByRole("dialog", { name: "Draft Settings" })).toBeNull();
  },
);

it("retains matching sidecar rows during legacy tab recovery when writes are unavailable", async () => {
  const v3 = "draft.customCsvList.v3";
  const stored = JSON.stringify([csv], null, 2);
  sessionStorage.setItem("draft.snapshot.v4", JSON.stringify(legacyV4Draft()));
  sessionStorage.setItem(v3, stored);
  const setItem = Storage.prototype.setItem;
  const writes = vi.spyOn(Storage.prototype, "setItem").mockImplementation(function (this: Storage, key, value) {
    if (this === sessionStorage && key === v3) throw new DOMException("quota", "QuotaExceededError");
    return setItem.call(this, key, value);
  });

  render(<DraftDashboard />);
  fireEvent.click(await screen.findByRole("button", { name: "Restore legacy saved tab draft" }));
  await waitFor(() => expect(tabSnapshot()).toMatchObject({ tabCsvSidecar: true, draftedPlayers: legacyV4Draft().draftedPlayers }));
  expect(saved().customCsvList).toEqual([csv]);
  expect(sessionStorage.getItem(v3)).toBe(stored);
  expect(writes.mock.calls.some(([key]) => key === v3)).toBe(false);
});

it("keeps an unrelated older CSV list masked after an explicit legacy restore", async () => {
  const v2 = "draft.customCsvList.v2";
  const v3 = "draft.customCsvList.v3";
  const stored = JSON.stringify([{ ...csv, id: "custom_csv_retired", label: "Old rows" }]);
  const legacy = legacyV4Draft();
  sessionStorage.setItem(v2, stored);
  sessionStorage.setItem("draft.snapshot.v4", JSON.stringify({
    ...legacy, csvMetadata: [], sourceControls: { dtz_skaters: { isSelected: true, weight: 1 } },
  }));

  const view = render(<DraftDashboard />);
  fireEvent.click(await screen.findByRole("button", { name: "Restore legacy saved tab draft" }));
  await waitFor(() => expect(tabSnapshot()).toMatchObject({ tabCsvSidecar: true, customSourceMetadata: [] }));
  expect(sessionStorage.getItem(v3)).toBe("[]");
  expect(sessionStorage.getItem(v2)).toBe(stored);
  view.unmount();
  render(<DraftDashboard />);
  await waitFor(() => expect(tabSnapshot().draftedPlayers).toEqual(legacy.draftedPlayers));
  expect(saved().customCsvList).toEqual([]);
  expect(sessionStorage.getItem(v2)).toBe(stored);
});

it("restores source controls once and retains missing-source repair controls", async () => {
  sessionStorage.setItem("draft.snapshot.v2", JSON.stringify({ ...snapshot(), configured: true, keepers: [], draftedPlayers: [], currentPick: 1, customCsvList: undefined, customSourceMetadata: [{ id: csv.id, label: csv.label }] }));
  render(<React.StrictMode><DraftDashboard /></React.StrictMode>);
  await waitFor(() => expect(saved().sourceControls[csv.id]).toEqual({ isSelected: true, weight: 0.7 }));
  fireEvent.click(within(dialog()).getByRole("tab", { name: /^Projections/ }));
  const group = within(dialog()).getByRole("region", { name: "Skaters projection sources" });
  expect(within(group).getByRole("button", { name: "Reimport Tab source" })).toBeTruthy();
  expect(within(group).getByRole("button", { name: "Remove Tab source" })).toBeTruthy();
  fireEvent.click(within(group).getByRole("button", { name: "Reimport Tab source" }));
  fireEvent.click(screen.getByRole("button", { name: "Complete CSV reimport" }));
  await waitFor(() => expect(saved().customCsvList[0].rows).toHaveLength(1));
  expect(saved().customCsvList[0].id).toBe(csv.id);
  expect(saved().sourceControls[csv.id].weight).toBe(0.7);
});

it("resumes a manual draft on the first team in its saved order when the old selection is gone", async () => {
  sessionStorage.setItem("draft.snapshot.v2", JSON.stringify({ ...snapshot(), myTeamId: "Retired team" }));
  render(<DraftDashboard />);
  await waitFor(() => expect(saved().myTeamId).toBe("Team 1"));
  expect(saved().draftedPlayers).toEqual(snapshot().draftedPlayers);
  expect(saved().draftHistory).toEqual(snapshot().draftHistory);
});

it("a configured import after decline survives a subsequent mount", async () => {
  sessionStorage.setItem("draft.snapshot.v2", JSON.stringify(snapshot()));
  vi.mocked(window.confirm).mockReturnValue(false);
  const view = render(<DraftDashboard />);
  await waitFor(() => expect(saved().draftSettings.teamCount).toBe(12));
  importBookmark(bookmark());
  await waitFor(() => expect(saved().draftSettings.teamCount).toBe(2));
  view.unmount();
  vi.mocked(window.confirm).mockReturnValue(true);
  render(<DraftDashboard />);
  await waitFor(() => expect(saved().customCsvList[0].rows).toEqual(csv.rows));
  expect(saved().draftSettings.teamCount).toBe(2);
  expect(sessionStorage.getItem("draft.resume.declined")).toBeNull();
});

it("Start New Draft has a cancellable separate confirmation and clears imported state", async () => {
  render(<DraftDashboard />);
  importBookmark(bookmark());
  await waitFor(() => expect(saved().draftSettings.teamCount).toBe(2));
  management();
  fireEvent.click(screen.getByRole("button", { name: "Start New Draft" }));
  expect(saved().draftSettings.teamCount).toBe(2);
  fireEvent.click(screen.getByRole("button", { name: "Cancel New Draft" }));
  expect(saved().customCsvList).toHaveLength(1);
  fireEvent.click(screen.getByRole("button", { name: "Start New Draft" }));
  fireEvent.click(screen.getByRole("button", { name: "Confirm Start New Draft" }));
  await waitFor(() => expect(saved()).toMatchObject({ draftSettings: { teamCount: 12 }, customCsvList: [], draftHistory: [], draftedPlayers: [] }));
});

it("only discards a v4-only tab on successful confirmed Start New Draft", async () => {
  const legacyKey = "draft.snapshot.v4";
  const csvKey = "draft.customCsvList.v2";
  const legacyRaw = JSON.stringify(legacyV4Draft());
  const csvRaw = JSON.stringify([csv]);
  sessionStorage.setItem(legacyKey, legacyRaw);
  sessionStorage.setItem(csvKey, csvRaw);
  localStorage.setItem("unrelated-auth-fixture", "preserved");
  const view = render(<React.StrictMode><DraftDashboard /></React.StrictMode>);
  const restore = () => screen.queryByRole("button", { name: "Restore legacy saved tab draft" });
  await waitFor(() => expect(restore()).toBeTruthy());
  management();
  fireEvent.click(screen.getByRole("button", { name: "Start New Draft" }));
  fireEvent.click(screen.getByRole("button", { name: "Cancel New Draft" }));
  expect(sessionStorage.getItem(legacyKey)).toBe(legacyRaw);
  expect(sessionStorage.getItem(csvKey)).toBe(csvRaw);

  const removeItem = Storage.prototype.removeItem;
  let failClear = true;
  vi.spyOn(Storage.prototype, "removeItem").mockImplementation(function (this: Storage, key) {
    if (failClear && this === sessionStorage && key === csvKey) throw new DOMException("blocked", "SecurityError");
    return removeItem.call(this, key);
  });
  fireEvent.click(screen.getByRole("button", { name: "Start New Draft" }));
  fireEvent.click(screen.getByRole("button", { name: "Confirm Start New Draft" }));
  expect(dialog().textContent).toContain("Could not clear the saved draft");
  expect(sessionStorage.getItem(legacyKey)).toBe(legacyRaw);
  expect(sessionStorage.getItem(csvKey)).toBe(csvRaw);
  expect(restore()).toBeTruthy();

  failClear = false;
  management();
  fireEvent.click(screen.getByRole("button", { name: "Start New Draft" }));
  fireEvent.click(screen.getByRole("button", { name: "Confirm Start New Draft" }));
  await waitFor(() => expect(saved().draftedPlayers).toEqual([]));
  expect(sessionStorage.getItem(legacyKey)).toBeNull();
  expect(sessionStorage.getItem(csvKey)).toBeNull();
  expect(restore()).toBeNull();

  view.unmount();
  render(<DraftDashboard />);
  await waitFor(() => expect(saved()).toMatchObject({ configured: false, currentPick: 1, draftedPlayers: [] }));
  expect(restore()).toBeNull();
  expect(screen.queryByText(/An older saved tab draft is available/)).toBeNull();
  expect(localStorage.getItem("unrelated-auth-fixture")).toBe("preserved");
});

it("discards pending bookmark file input and old feedback on confirmed Start New Draft", async () => {
  render(<DraftDashboard />);
  await waitFor(() => expect(saved().draftSettings.teamCount).toBe(12));
  importBookmark({ bad: "bookmark" });
  expect(dialog().textContent).toContain("Unsupported bookmark");
  let completeRead!: (text: string) => void;
  const text = new Promise<string>((resolve) => { completeRead = resolve; });
  const file = new File(["pending"], "draft.json", { type: "application/json" });
  Object.defineProperty(file, "text", { value: () => text });
  fireEvent.change(screen.getByLabelText("Read draft bookmark file"), { target: { files: [file] } });
  expect(screen.getByRole("button", { name: "Reading bookmark…" })).toBeTruthy();

  management();
  fireEvent.click(screen.getByRole("button", { name: "Start New Draft" }));
  fireEvent.click(screen.getByRole("button", { name: "Confirm Start New Draft" }));
  expect(screen.queryByLabelText("Import draft bookmark")).toBeNull();
  expect(dialog().textContent).not.toContain("Unsupported bookmark");
  fireEvent.click(within(dialog()).getByRole("button", { name: "Import bookmark" }));
  const input = screen.getByLabelText("Import draft bookmark") as HTMLTextAreaElement;
  expect(input.value).toBe("");
  await act(async () => { completeRead(JSON.stringify(bookmark())); });
  expect(input.value).toBe("");
  expect(saved().draftSettings.teamCount).toBe(12);
});

it("Reset Entire Draft keeps configuration and imported projections while clearing activity", async () => {
  sessionStorage.setItem("draft.snapshot.v2", JSON.stringify({ ...snapshot(), draftSettings: { ...settings, isKeeper: true } }));
  render(<DraftDashboard />);
  await waitFor(() => expect(saved().draftHistory).toHaveLength(1));
  openSettings(); management();
  fireEvent.click(screen.getByRole("button", { name: "Reset Entire Draft" }));
  fireEvent.click(screen.getByRole("button", { name: "Confirm Reset Entire Draft" }));
  await waitFor(() => expect(saved()).toMatchObject({ draftedPlayers: [], keepers: [], pickTrades: [], draftHistory: [], currentPick: 1 }));
  expect(saved().draftSettings.teamCount).toBe(2);
  expect(saved().customCsvList).toEqual([csv]);
  expect(saved().sourceControls[csv.id].weight).toBe(0.7);
  expect(saved().prorate84).toBe(true);
  expect(saved().riskSd).toBe(28);
});

it.each(["draft.snapshot.v2", "draftDashboard.session.v1"])("failed %s resume retains both records, blocks Done, and retries the original draft", async (key) => {
  const storage = key.startsWith("draft.snapshot") ? sessionStorage : localStorage;
  const originalDraft = JSON.stringify({ ...snapshot(), draftSettings: { ...settings, isKeeper: true } });
  const otherStorage = storage === sessionStorage ? localStorage : sessionStorage;
  const otherKey = storage === sessionStorage ? "draftDashboard.session.v1" : "draft.snapshot.v2";
  // Device recovery is reached only when there is no tab snapshot.
  if (storage === sessionStorage) otherStorage.setItem(otherKey, "retained device record");
  storage.setItem(key, originalDraft);
  const originalSet = Storage.prototype.setItem;
  let blocked = true;
  vi.spyOn(Storage.prototype, "setItem").mockImplementation(function (this: Storage, storageKey, value) {
    if (blocked && this === sessionStorage && storageKey === "draft.customCsvList.v3") throw new DOMException("quota", "QuotaExceededError");
    return originalSet.call(this, storageKey, value);
  });
  const view = render(<React.StrictMode><DraftDashboard /></React.StrictMode>);
  await waitFor(() => expect(dialog().textContent).toContain("saved draft is retained"));
  expect(dialog().textContent).not.toContain("current draft has not changed");
  fireEvent.click(within(dialog()).getByRole("button", { name: "Done" }));
  fireEvent.click(screen.getByRole("button", { name: "Retry saved draft recovery" }));
  expect(storage.getItem(key)).toBe(originalDraft);
  expect(otherStorage.getItem(otherKey)).toBe(storage === sessionStorage ? "retained device record" : null);
  expect(sessionStorage.getItem("draft.customCsvList.v3")).toBeNull();
  expect(screen.queryByText("Draft bookmark imported.")).toBeNull();
  blocked = false;
  fireEvent.click(screen.getByRole("button", { name: "Retry saved draft recovery" }));
  await waitFor(() => expect(screen.queryByRole("button", { name: "Retry saved draft recovery" })).toBeNull());
  expect(saved().draftSettings.teamCount).toBe(2);
  expect(saved().draftedPlayers).toContainEqual(snapshot().draftedPlayers[0]);
  expect(saved().draftHistory).toEqual(snapshot().draftHistory);
  expect(saved().sourceControls[csv.id].weight).toBe(0.7);
  expect(JSON.parse(sessionStorage.getItem("draft.customCsvList.v3")!)).toEqual([csv]);
  expect(JSON.parse(localStorage.getItem("draftDashboard.session.v1")!).draftSettings.teamCount).toBe(2);
  fireEvent.click(within(dialog()).getByRole("button", { name: "Done" }));
  expect(screen.queryByRole("dialog", { name: "Draft Settings" })).toBeNull();
  view.unmount();
  render(<DraftDashboard />);
  await waitFor(() => expect(saved().draftedPlayers).toContainEqual(snapshot().draftedPlayers[0]));
  expect(saved().customCsvList).toEqual([csv]);
});

it("restores the device draft over an unreadable tab only after confirmation and a successful save", async () => {
  const tabKey = "draft.snapshot.v2";
  const deviceKey = "draftDashboard.session.v1";
  const csvKey = "draft.customCsvList.v3";
  const invalid = "{truncated tab";
  const device = JSON.stringify({ ...snapshot(), customCsvList: undefined, customSourceMetadata: [{ id: csv.id, label: csv.label }] });
  const unrelatedRows = JSON.stringify([{ ...csv, rows: [{ Name: "Different draft" }] }]);
  sessionStorage.setItem(tabKey, invalid);
  sessionStorage.setItem(csvKey, unrelatedRows);
  localStorage.setItem(deviceKey, device);
  render(<React.StrictMode><DraftDashboard /></React.StrictMode>);
  const restore = await screen.findByRole("button", { name: "Restore saved device draft" });
  vi.mocked(window.confirm).mockReturnValueOnce(false);
  fireEvent.click(restore);
  expect(sessionStorage.getItem(tabKey)).toBe(invalid);
  expect(localStorage.getItem(deviceKey)).toBe(device);
  const write = Storage.prototype.setItem;
  const quota = vi.spyOn(Storage.prototype, "setItem").mockImplementation(function (this: Storage, key, value) {
    if (this === sessionStorage && key === tabKey) throw new DOMException("quota", "QuotaExceededError");
    write.call(this, key, value);
  });
  fireEvent.click(restore);
  expect(dialog().textContent).toContain("Could not save imported projections");
  expect(sessionStorage.getItem(tabKey)).toBe(invalid);
  expect(sessionStorage.getItem(csvKey)).toBe(unrelatedRows);
  expect(localStorage.getItem(deviceKey)).toBe(device);
  quota.mockRestore();
  fireEvent.click(restore);
  await waitFor(() => expect(saved().draftedPlayers).toEqual(snapshot().draftedPlayers));
  expect(JSON.parse(sessionStorage.getItem(csvKey)!)).toEqual([{ ...csv, rows: [] }]);
  expect(screen.queryByRole("button", { name: "Retry saved draft recovery" })).toBeNull();
});

it("retains a malformed tab snapshot through retry and Done until a confirmed clean start", async () => {
  const malformed = "{truncated saved draft";
  sessionStorage.setItem("draft.snapshot.v2", malformed);
  localStorage.setItem("draftDashboard.session.v1", JSON.stringify(snapshot()));
  render(<React.StrictMode><DraftDashboard /></React.StrictMode>);
  await waitFor(() => expect(dialog().textContent).toContain("Could not read the saved draft"));
  fireEvent.click(screen.getByRole("button", { name: "Retry saved draft recovery" }));
  fireEvent.click(within(dialog()).getByRole("button", { name: "Done" }));
  expect(sessionStorage.getItem("draft.snapshot.v2")).toBe(malformed);
  expect(localStorage.getItem("draftDashboard.session.v1")).toBe(JSON.stringify(snapshot()));
  management();
  fireEvent.click(screen.getByRole("button", { name: "Start New Draft" }));
  fireEvent.click(screen.getByRole("button", { name: "Cancel New Draft" }));
  expect(sessionStorage.getItem("draft.snapshot.v2")).toBe(malformed);
  fireEvent.click(screen.getByRole("button", { name: "Start New Draft" }));
  fireEvent.click(screen.getByRole("button", { name: "Confirm Start New Draft" }));
  await waitFor(() => expect(saved().draftSettings.teamCount).toBe(12));
  expect(screen.queryByRole("button", { name: "Retry saved draft recovery" })).toBeNull();
  expect(saved().draftedPlayers).toEqual([]);
});

it.each(["null", '{"v":2,"draftSettings":{}}', '{"v":2,"draftSettings":null}'])("retains unreadable snapshot %s until a valid replacement succeeds", async (malformed) => {
  sessionStorage.setItem("draft.snapshot.v2", malformed);
  render(<DraftDashboard />);
  await waitFor(() => expect(dialog().textContent).toContain("Could not read the saved draft"));
  expect(sessionStorage.getItem("draft.snapshot.v2")).toBe(malformed);
  importBookmark(bookmark());
  await waitFor(() => expect(saved().draftSettings.teamCount).toBe(2));
  expect(screen.queryByRole("button", { name: "Retry saved draft recovery" })).toBeNull();
  expect(saved().customCsvList).toEqual([csv]);
  expect(dialog().textContent).toContain("Draft bookmark imported.");
});


it.each([
  ["malformed undo history", { draftHistory: [{ players: [], pickNumber: "one" }] }],
  ["malformed undo picks", { draftHistory: [{ players: [null], pickNumber: 1 }] }],
  ["duplicate draft picks", { draftedPlayers: [snapshot().draftedPlayers[0], snapshot().draftedPlayers[0]] }],
  ["duplicate CSV identities", { customCsvList: [csv, { ...csv, label: "Other data", rows: [{ player_id: 9, Goals: 99 }] }] }],
])("retains a saved snapshot with %s without applying or autosaving it", async (_name, invalid) => {
  const raw = JSON.stringify({ ...snapshot(), ...invalid });
  sessionStorage.setItem("draft.snapshot.v2", raw);
  render(<DraftDashboard />);
  await waitFor(() => expect(dialog().textContent).toContain("Could not read the saved draft"));
  fireEvent.click(screen.getByRole("button", { name: "Retry saved draft recovery" }));
  fireEvent.click(within(dialog()).getByRole("button", { name: "Done" }));
  expect(sessionStorage.getItem("draft.snapshot.v2")).toBe(raw);
  expect(screen.getByRole("button", { name: "Draft recovery player" }).hasAttribute("disabled")).toBe(true);
});


it.each([
  ["2", "9", "3"],
  ["9", "3", "2"],
])("renders the same filled slots used for replacement after drafting %s, %s, %s", async (...order) => {
  external.showRoster = true;
  external.players = [
    { ...player, displayPosition: "C,RW", eligiblePositions: ["C", "RW"] },
    keeperPlayer,
    { ...player, playerId: 3, fullName: "Second Center" },
  ];
  const draftedPlayers = order.map((playerId, index) => ({ playerId, teamId: "Team 1", pickNumber: index * 2 + 1, round: index + 1, pickInRound: 1 }));
  sessionStorage.setItem("draft.snapshot.v2", JSON.stringify({
    ...snapshot(),
    draftSettings: { ...settings, draftOrderMode: "standard", rosterConfig: { ...settings.rosterConfig, C: 2, RW: 1 } },
    draftedPlayers, currentPick: 6, keepers: [], positionOverrides: {}, draftHistory: [],
    forwardGrouping: "split", customCsvList: [], sourceControls: { dtz_skaters: { isSelected: true, weight: 1 } },
  }));
  render(<DraftDashboard />);
  await waitFor(() => expect(saved().draftedPlayers).toEqual(draftedPlayers));
  expect(screen.getByRole("button", { name: "RW 1: Recovery Player" })).toBeTruthy();
  expect(screen.getByRole("button", { name: /C [12]: Root Keeper/ })).toBeTruthy();
  expect(screen.getByRole("button", { name: /C [12]: Second Center/ })).toBeTruthy();
  expect(external.filledSlots).toMatchObject({ C: 2, RW: 1, BENCH: 0 });
});

it("renders and restores a saved Utility reservation with matching replacement occupancy", async () => {
  external.showRoster = true;
  sessionStorage.setItem("draft.snapshot.v2", JSON.stringify({
    ...snapshot(),
    draftSettings: { ...settings, rosterConfig: { ...settings.rosterConfig, utility: 1, bench: 0 } },
    draftedPlayers: [{ playerId: "2", teamId: "Team 1", pickNumber: 1, round: 1, pickInRound: 1 }],
    keepers: [], positionOverrides: {}, draftHistory: [], forwardGrouping: "split",
    customCsvList: [], sourceControls: { dtz_skaters: { isSelected: true, weight: 1 } },
  }));
  const view = render(<DraftDashboard />);
  await waitFor(() => expect(screen.getByRole("button", { name: "C 1: Recovery Player" })).toBeTruthy());
  fireEvent.click(screen.getByRole("button", { name: "C 1: Recovery Player" }));
  fireEvent.click(screen.getByRole("button", { name: "UTILITY 1: Open" }));
  await waitFor(() => expect(saved().positionOverrides).toEqual({ "2": "UTILITY" }));
  expect(screen.getByRole("button", { name: "UTILITY 1: Recovery Player" })).toBeTruthy();
  expect(screen.getByRole("button", { name: "C 1: Open" })).toBeTruthy();
  expect(external.filledSlots).toMatchObject({ C: 0, UTILITY: 1, BENCH: 0 });
  const beforeReload = saved();
  view.unmount();
  render(<DraftDashboard />);
  await waitFor(() => expect(screen.getByRole("button", { name: "UTILITY 1: Recovery Player" })).toBeTruthy());
  expect(saved().positionOverrides).toEqual(beforeReload.positionOverrides);
  expect(saved().draftedPlayers).toEqual(beforeReload.draftedPlayers);
  expect(screen.getByRole("button", { name: "C 1: Open" })).toBeTruthy();
  expect(external.filledSlots).toMatchObject({ C: 0, UTILITY: 1, BENCH: 0 });
});


it("keeps reserved no-pick keepers and unmapped picks in the rendered roster", async () => {
  external.showRoster = true;
  const draftedPlayers = [
    { playerId: "2", teamId: "Team 1", pickNumber: 1, round: 1, pickInRound: 1 },
    { playerId: "999", teamId: "Team 1", pickNumber: 3, round: 2, pickInRound: 1 },
  ];
  sessionStorage.setItem("draft.snapshot.v2", JSON.stringify({
    ...snapshot(),
    draftSettings: { ...settings, isKeeper: true, rosterConfig: { ...settings.rosterConfig, utility: 1 } },
    draftedPlayers, currentPick: 4,
    keepers: [{ playerId: "9", teamId: "Team 1", cost: "none" }],
    positionOverrides: { "9": "UTILITY", "999": "RW" }, draftHistory: [], forwardGrouping: "split",
    customCsvList: [], sourceControls: { dtz_skaters: { isSelected: true, weight: 1 } },
  }));
  render(<DraftDashboard />);
  await waitFor(() => expect(screen.getByRole("button", { name: "UTILITY 1: Root Keeper" })).toBeTruthy());
  expect(screen.getByRole("button", { name: "C 1: Recovery Player" })).toBeTruthy();
  expect(within(document.querySelector('[data-position="BENCH"]') as HTMLElement).getByText("999")).toBeTruthy();
  expect(external.filledSlots).toMatchObject({ C: 1, UTILITY: 1, BENCH: 1 });
  expect(saved().draftedPlayers).toEqual(draftedPlayers);
  expect(saved().keepers).toMatchObject([{ playerId: "9", teamId: "Team 1", cost: "none" }]);
  expect(saved().positionOverrides).toEqual({ "9": "UTILITY", "999": "RW" });
});

it("keeps roster moves locked while a provider controls drafting", async () => {
  external.showRoster = true;
  external.espnState = {
    session: { id: "locked-fixture", status: "active" },
    league: { id: "locked-league", settings: {
      draftOrder: settings.draftOrder, teamCount: 2, teams: [], sourceHash: "locked-fixture",
      rosterConfig: { ...settings.rosterConfig, utility: 1, bench: 0 },
      leagueType: "points", skaterScoringCategories: settings.scoringCategories,
      goalieScoringCategories: { WINS_GOALIE: 4 },
    } },
    picks: [{ nhlPlayerId: 2, mappingStatus: "mapped", externalPlayerId: "fixture-2", playerName: player.fullName,
      externalTeamKey: "Team 1", pickNumber: 1, roundNumber: 1, pickInRound: 1 }],
  };
  sessionStorage.setItem("draft.snapshot.v2", JSON.stringify({
    ...snapshot(),
    draftSettings: { ...settings, rosterConfig: { ...settings.rosterConfig, utility: 1, bench: 0 } },
    draftedPlayers: [{ playerId: "2", teamId: "Team 1", pickNumber: 1, round: 1, pickInRound: 1 }],
    keepers: [], positionOverrides: {}, draftHistory: [], forwardGrouping: "split",
    customCsvList: [], sourceControls: { dtz_skaters: { isSelected: true, weight: 1 } },
  }));
  render(<DraftDashboard />);
  await waitFor(() => expect(screen.getByRole("button", { name: "C 1: Recovery Player" })).toBeTruthy());
  const current = screen.getByRole("button", { name: "C 1: Recovery Player" });
  expect(current.getAttribute("aria-disabled")).toBe("true");
  fireEvent.click(current);
  fireEvent.click(screen.getByRole("button", { name: "UTILITY 1: Open" }));
  expect(screen.getByRole("button", { name: "C 1: Recovery Player" })).toBeTruthy();
  expect(saved().positionOverrides).toEqual({});
  expect(external.filledSlots).toMatchObject({ C: 1, UTILITY: 0, BENCH: 0 });
});


it.each([
  ["yahoo", "yahoo", 8, "C"],
  ["fantrax", "yahoo", 70, "C"],
  ["yahoo", "fantrax", 8, "RW"],
  ["fantrax", "fantrax", 70, "RW"],
] as const)("uses selected %s ADP and %s eligibility for positional tier advice", async (adpSource, positionSource, adp, position) => {
  external.proEnabled = true;
  external.providerSyncEnabled = true;
  external.user = { id: "provider-fixture" };
  external.players = [{ ...player, combinedStats: {
    GOALS: { projected: 10 }, ASSISTS: { projected: 0 }, PP_POINTS: { projected: 0 },
    SHOTS_ON_GOAL: { projected: 0 }, HITS: { projected: 0 }, BLOCKED_SHOTS: { projected: 0 },
    GAMES_PLAYED: { projected: 82 },
  } }];
  external.fantraxPlayers = [{ id: "fixture-2", name: "Recovery Player", team: null, positions: ["RW"], adp: 70 }];
  sessionStorage.setItem("draft.snapshot.v2", JSON.stringify({
    ...snapshot(),
    draftSettings: { ...settings, adpSource, positionSource, rosterConfig: { ...settings.rosterConfig, RW: 1 } },
    draftedPlayers: [], currentPick: 1, keepers: [], positionOverrides: {}, draftHistory: [],
    forwardGrouping: "split", prorate84: false, customCsvList: [],
    sourceControls: { dtz_skaters: { isSelected: true, weight: 1 } },
  }));
  render(<DraftDashboard />);
  await waitFor(() => expect(external.tablePlayers.find(row => row.playerId === 2)).toMatchObject({ yahooAvgPick: adp, eligiblePositions: [position] }));
  const tiers = external.tierPositions.find(row => row.position === position);
  expect(tiers?.bands.flatMap(band => band.players)).toMatchObject([{ id: "2", adp }]);
  expect(external.tierAdpSource).toBe(adpSource === "fantrax" ? "Fantrax" : "Yahoo");
});


const undoSettings = {
  ...settings,
  rosterConfig: { ...settings.rosterConfig, utility: 1 },
};
const undoPickOne = { playerId: "2", teamId: "Team 1", pickNumber: 1, round: 1, pickInRound: 1 };
const undoPickTwo = { playerId: "9", teamId: "Team 2", pickNumber: 2, round: 1, pickInRound: 2 };
const utilityHistory = {
  players: [undoPickOne],
  pickNumber: 2,
  positionOverrides: { "2": "UTILITY" },
};
const historicalUndo = { players: [], pickNumber: 1 };
const undoSources = { dtz_skaters: { isSelected: true, weight: 1 } };

function undoDraftPick() {
  openSettings();
  management();
  fireEvent.click(within(dialog()).getByRole("button", { name: "Undo Last Pick" }));
}

function moveRecoveryPlayer(from: "C" | "UTILITY", to: "C" | "UTILITY") {
  fireEvent.click(screen.getByRole("button", { name: `${from} 1: Recovery Player` }));
  fireEvent.click(screen.getByRole("button", { name: `${to} 1: Open` }));
}

it("restores roster overrides per pick after remounting the current tab", async () => {
  external.showRoster = true;
  external.showDraftButtons = true;
  sessionStorage.setItem("draft.snapshot.v2", JSON.stringify({
    ...snapshot(),
    draftSettings: undoSettings,
    currentPick: 1,
    draftedPlayers: [],
    keepers: [],
    positionOverrides: {},
    draftHistory: [],
    forwardGrouping: "split",
    sourceControls: undoSources,
    customCsvList: [],
  }));
  const view = render(<DraftDashboard />);
  await waitFor(() => expect(saved().currentPick).toBe(1));
  fireEvent.click(screen.getByRole("button", { name: "Draft Recovery Player" }));
  await screen.findByRole("button", { name: "C 1: Recovery Player" });
  moveRecoveryPlayer("C", "UTILITY");

  fireEvent.click(screen.getByRole("button", { name: "Draft Root Keeper" }));
  await waitFor(() => expect(saved().draftedPlayers).toEqual([undoPickOne, undoPickTwo]));
  moveRecoveryPlayer("UTILITY", "C");
  expect(saved().positionOverrides).toEqual({ "2": "C" });

  view.unmount();
  render(<DraftDashboard />);
  await screen.findByRole("button", { name: "C 1: Recovery Player" });
  undoDraftPick();
  await waitFor(() => expect(saved()).toMatchObject({
    draftedPlayers: [undoPickOne],
    currentPick: 2,
    positionOverrides: { "2": "UTILITY" },
    draftHistory: [{ ...historicalUndo, positionOverrides: {} }],
  }));
  expect(screen.getByRole("button", { name: "UTILITY 1: Recovery Player" })).toBeTruthy();

  undoDraftPick();
  await waitFor(() => expect(saved()).toMatchObject({
    draftedPlayers: [],
    currentPick: 1,
    positionOverrides: {},
    draftHistory: [],
  }));
});

it.each([3, 4])("restores bookmark v%s pick history including an older entry without overrides", async (version) => {
  external.showRoster = true;
  const format = version === 3
    ? { ...bookmark(), customCsvList: [], customSourceMetadata: [] }
    : { ...legacyV4Draft(true), csvMetadata: [], customCsvEntries: [] };
  render(<DraftDashboard />);
  importBookmark({
    ...format,
    settings: undoSettings,
    sourceControls: undoSources,
    draftedPlayers: [undoPickOne, undoPickTwo],
    currentPick: 3,
    positionOverrides: { "2": "C" },
    draftHistory: [historicalUndo, utilityHistory],
  });
  await waitFor(() => expect(saved()).toMatchObject({
    draftedPlayers: [undoPickOne, undoPickTwo],
    draftHistory: [historicalUndo, utilityHistory],
  }));
  expect(screen.getByRole("button", { name: "C 1: Recovery Player" })).toBeTruthy();

  undoDraftPick();
  await waitFor(() => expect(saved()).toMatchObject({
    draftedPlayers: [undoPickOne],
    currentPick: 2,
    positionOverrides: { "2": "UTILITY" },
  }));
  expect(screen.getByRole("button", { name: "UTILITY 1: Recovery Player" })).toBeTruthy();

  undoDraftPick();
  await waitFor(() => expect(saved()).toMatchObject({
    draftedPlayers: [],
    currentPick: 1,
    positionOverrides: {},
    draftHistory: [],
  }));
});

it("captures roster overrides for a corrected pick without changing the later pick number", async () => {
  external.showRoster = true;
  external.players = [
    ...recoveryPlayers,
    { ...player, playerId: 4, fullName: "Replacement Skater" },
  ];
  sessionStorage.setItem("draft.snapshot.v2", JSON.stringify({
    ...snapshot(),
    draftSettings: undoSettings,
    draftedPlayers: [undoPickOne, undoPickTwo],
    currentPick: 3,
    positionOverrides: { "2": "UTILITY" },
    draftHistory: [],
    keepers: [],
    forwardGrouping: "split",
    sourceControls: undoSources,
    customCsvList: [],
  }));
  render(<DraftDashboard />);
  await screen.findByRole("button", { name: "UTILITY 1: Recovery Player" });
  openSettings();
  management();
  fireEvent.click(within(dialog()).getByRole("button", { name: "Pick Correction" }));
  const correction = screen.getByRole("dialog", { name: "Quick Fix Draft Pick" });
  fireEvent.change(within(correction).getByLabelText("Replacement player"), {
    target: { value: "Replacement Skater" },
  });
  fireEvent.click(within(correction).getByRole("button", { name: "Replace Player" }));
  await waitFor(() => expect(saved().draftedPlayers).toEqual([
    undoPickOne,
    { ...undoPickTwo, playerId: "4" },
  ]));
  expect(saved()).toMatchObject({
    currentPick: 3,
    draftHistory: [{
      players: [undoPickOne, undoPickTwo],
      pickNumber: 3,
      positionOverrides: { "2": "UTILITY" },
    }],
  });
  undoDraftPick();
  await waitFor(() => expect(saved()).toMatchObject({
    draftedPlayers: [undoPickOne, undoPickTwo],
    currentPick: 3,
    positionOverrides: { "2": "UTILITY" },
    draftHistory: [],
  }));
});


it("shows the drafted player and no-pick keeper in the full table while keeping both draft actions disabled", async () => {
  external.renderProjectionPanels = true;
  const legacy = { ...legacyV4Draft(), settings: { ...settings, isKeeper: true },
    keepers: [{ playerId: "9", teamId: "Team 2", cost: "none" }],
    sourceControls: { dtz_skaters: { isSelected: true, weight: 1 } }, csvMetadata: [],
  };
  sessionStorage.setItem("draft.snapshot.v4", JSON.stringify(legacy));
  localStorage.setItem("projections.hideDrafted", "true");
  render(<DraftDashboard />);
  fireEvent.click(await screen.findByRole("button", { name: "Restore legacy saved tab draft" }));
  fireEvent.click(within(dialog()).getByRole("button", { name: "Done" }));
  const tableRow = (id: string) => document.querySelector<HTMLElement>(`tr[data-player-id="${id}"]`);
  await waitFor(() => expect(saved().currentPick).toBe(2));
  expect(tableRow("2")).toBeNull();
  expect(tableRow("9")).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "Toggle hide drafted" }));
  await waitFor(() => expect(tableRow("2")).toBeTruthy());
  expect(within(tableRow("2")!).getByTitle("Player already drafted").hasAttribute("disabled")).toBe(true);
  expect(within(tableRow("9")!).getByTitle("Keeper player").hasAttribute("disabled")).toBe(true);
  expect(document.querySelector('[role="listitem"][data-player-id="2"], [role="listitem"][data-player-id="9"]')).toBeNull();
});

it("updates the rendered table and suggested pick from the recovered availability spread", async () => {
  external.renderProjectionPanels = true;
  external.players = [{ ...player, yahooAvgPick: 2 }, keeperPlayer];
  sessionStorage.setItem("draft.snapshot.v2", JSON.stringify({ ...snapshot(), draftedPlayers: [], keepers: [],
    draftHistory: [], currentPick: 1, positionOverrides: {}, myTeamId: "Team 2", riskSd: 28,
  }));
  render(<DraftDashboard />);
  const suggested = () => document.querySelector('[role="listitem"][data-player-id="2"] [title$="remaining available at your next pick"]');
  const table = () => document.querySelector('tr[data-player-id="2"] [title*="estimated available at your next pick"]');
  await waitFor(() => {
    expect(suggested()?.textContent).toMatch(/\d+%/);
    expect(table()?.textContent).toBe(suggested()?.textContent);
  });
  const before = suggested()!.textContent;
  fireEvent.click(screen.getByRole("button", { name: "Open settings drawer" }));
  fireEvent.change(screen.getByLabelText("SD (picks): 28"), { target: { value: "4" } });
  await waitFor(() => {
    expect(saved().riskSd).toBe(4);
    expect(localStorage.getItem("projections.riskSd")).toBe("4");
    expect(suggested()!.textContent).not.toBe(before);
    expect(table()?.textContent).toBe(suggested()!.textContent);
  });
});

it("shows one compact draft status on each mobile working tab and hides it while Setup is open", async () => {
  vi.mocked(window.matchMedia).mockImplementation((query: string) => ({
    matches: query === "(max-width: 799px)", addEventListener: vi.fn(), removeEventListener: vi.fn(),
  }) as unknown as MediaQueryList);
  sessionStorage.setItem("draftDashboard.mobileTab.v1", "players");
  sessionStorage.setItem("draft.snapshot.v2", JSON.stringify({ ...snapshot(), draftedPlayers: [], keepers: [],
    draftHistory: [], currentPick: 1, positionOverrides: {},
  }));
  render(<DraftDashboard />);
  const tabs = within(screen.getByRole("tablist", { name: "Draft Dashboard workspace" }));
  for (const tab of ["Players", "Suggested", "Roster", "Board"]) {
    fireEvent.click(tabs.getByRole("tab", { name: tab }));
    const summaries = await screen.findAllByRole("region", { name: "Draft Status summary" });
    expect(summaries).toHaveLength(1);
    expect(within(summaries[0]).getByText("On clock")).toBeTruthy();
    expect(screen.queryByRole("region", { name: "Draft Status" })).toBeNull();
  }
  fireEvent.click(tabs.getByRole("tab", { name: "Setup" }));
  expect(dialog()).toBeTruthy();
  expect(screen.queryByRole("region", { name: "Draft Status summary" })).toBeNull();
});
