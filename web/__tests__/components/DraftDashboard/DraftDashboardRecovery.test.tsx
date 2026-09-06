import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

const noop = vi.fn();
const external = vi.hoisted(() => ({
  user: null as { id: string } | null,
  loadSettings: vi.fn(async () => ({ data: null as any, error: null })),
}));
const player = {
  playerId: 2,
  fullName: "Recovery Player",
  displayPosition: "C",
  eligiblePositions: ["C"],
  fantasyPoints: { projected: 10 },
  combinedStats: {},
};

vi.mock("contexts/AuthProviderContext", () => ({ useAuth: () => ({ user: external.user, isLoading: false }) }));
vi.mock("lib/supabase", () => ({ default: { from: () => ({ select: () => ({ eq: () => ({ maybeSingle: () => external.loadSettings() }) }) }) } }));
vi.mock("hooks/useCurrentSeason", () => ({ useCurrentSeasonQuery: () => ({ data: null, isLoading: false }) }));
vi.mock("hooks/useDraftRanking", () => ({ useDraftRanking: () => ({ entries: { data: { entries: [] } }, bootstrap: { data: null } }) }));
vi.mock("hooks/useYahooDraftSync", () => ({ useYahooDraftSync: () => ({ enabled: false, selectedLeagueId: null, sessionId: null, requestState: null, terminalSessionMissing: false, resumeSession: noop, clearSession: noop, start: noop, stop: noop, connect: noop, draftState: null, error: null, isPolling: false, leagues: [], ranking: null, refreshAccount: noop, refreshDraft: noop, setSelectedLeagueId: noop }) }));
vi.mock("hooks/useEspnDraftSync", () => ({ useEspnDraftSync: () => ({ enabled: false, draftState: null, error: null, isLoading: false, isPolling: false, leagues: [], selectedLeagueId: null, setSelectedLeagueId: noop, start: noop, stop: noop, clear: noop, refresh: noop, reload: noop }) }));
vi.mock("hooks/useProcessedProjectionsData", () => ({ useProcessedProjectionsData: () => ({ processedPlayers: [player], isLoading: false, error: null, customSourceResolutions: {}, customFallbackUsage: { total: 0 }, sourceWarnings: [], yahooMappingDiagnostics: null, inclusionDiagnostics: null }) }));
vi.mock("hooks/useVORPCalculations", () => ({ useVORPCalculations: () => ({ playerMetrics: new Map(), replacementByPos: {}, expectedTakenByPos: {}, expectedN: 0 }) }));
vi.mock("hooks/useRosterScheduleOptimizer", () => ({ useRosterScheduleOptimizer: () => ({ status: "idle" }) }));
vi.mock("components/PlayerAutocomplete", () => ({ default: () => null }));
vi.mock("components/DraftDashboard/MyRoster", () => ({ default: ({ onDraftPlayer, canDraft }: any) => <button disabled={!canDraft} onClick={() => onDraftPlayer("2")}>Draft recovery player</button> }));
vi.mock("components/DraftDashboard/DraftBoard", () => ({ default: () => null }));
vi.mock("components/DraftDashboard/DraftStatus", () => ({ default: () => null }));
vi.mock("components/DraftDashboard/LeagueStandings", () => ({ default: () => null }));
vi.mock("components/DraftDashboard/ProjectionsTable", () => ({ default: () => null }));
vi.mock("components/DraftDashboard/SuggestedPicks", () => ({ default: () => null }));
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
vi.mock("components/DraftDashboard/YahooLiveDraftPanel", () => ({ default: () => null }));
vi.mock("components/DraftDashboard/EspnLiveDraftPanel", () => ({ default: () => null }));
vi.mock("components/DraftDashboard/MobileDraftTabs", () => ({ default: () => null, useMobileDraftTab: () => ["players", noop] }));
vi.mock("components/DraftDashboard/FantraxLeagueSettingsPanel", () => ({ default: () => null }));
vi.mock("components/integrations/EspnLeagueSettingsPanel", () => ({ default: () => null }));

import DraftDashboard from "../../../components/DraftDashboard/DraftDashboard";

const settings = { teamCount: 2, draftOrder: ["Team 1", "Team 2"], rosterConfig: { C: 1, LW: 0, RW: 0, D: 0, G: 0, bench: 1, utility: 0 }, scoringCategories: { GOALS: 3 }, leagueType: "points" as const };
const record = () => ({ v: 4, settings, configured: true, draftedPlayers: [{ playerId: "1", teamId: "Team 1", pickNumber: 1, round: 1, pickInRound: 1 }], draftHistory: [{ players: [], pickNumber: 1, positionOverrides: {} }], currentPick: 2, myTeamId: "Team 1", sourceControls: { dtz_skaters: { isSelected: true, weight: 1 } }, goalieSourceControls: { dtz_goalies: { isSelected: true, weight: 1 } }, goalieScoringCategories: { WINS_GOALIE: 4 }, positionOverrides: { "1": "UTILITY" }, prorate84: true, riskSd: 28, csvMetadata: [{ id: "custom_csv_one", label: "Tab source" }] });

const missingSourceRecord = () => ({
  ...record(),
  configured: true,
  positionOverrides: {},
  sourceControls: {
    dtz_skaters: { isSelected: true, weight: 0.3 },
    custom_csv_missing: { isSelected: true, weight: 0.7 },
  },
  csvMetadata: [{ id: "custom_csv_missing", label: "Missing source" }],
});

const completeRecord = () => ({
  ...record(),
  keepers: [{ playerId: "keeper", teamId: "Team 2", cost: "none" }],
  pickTrades: [{ round: 2, pickInRound: 1, currentTeamId: "Team 1" }],
  customTeamNames: { "Team 1": "Alpha", "Team 2": "Beta" },
  positionOverrides: { "1": "C", keeper: "C" },
  draftHistory: [{ players: [], pickNumber: 1, positionOverrides: { keeper: "C" } }],
  csvMetadata: [],
});

function openSettings(section: "Setup" | "Sources" = "Setup") {
  fireEvent.click(screen.getByRole("button", { name: section }));
}

function importBookmark(data: unknown) {
  openSettings();
  fireEvent.click(screen.getByRole("button", { name: "Import" }));
  fireEvent.change(screen.getByLabelText("Import draft bookmark"), { target: { value: JSON.stringify(data) } });
  fireEvent.click(screen.getByRole("button", { name: "Import Bookmark" }));
}

beforeEach(() => {
  Object.defineProperty(HTMLElement.prototype, "scrollIntoView", { configurable: true, value: vi.fn() });
  Object.defineProperty(URL, "createObjectURL", { configurable: true, value: vi.fn(() => "blob:recovery-test") });
  Object.defineProperty(URL, "revokeObjectURL", { configurable: true, value: vi.fn() });
});

afterEach(() => {
  cleanup();
  sessionStorage.clear();
  localStorage.clear();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  external.user = null;
  external.loadSettings.mockReset();
  external.loadSettings.mockResolvedValue({ data: null, error: null });
});

it("persists compact state, restores undo overrides, and leaves tab CSV rows out of pick saves", async () => {
  sessionStorage.setItem("draft.customCsvList.v3", JSON.stringify([{ id: "custom_csv_one", label: "Tab source", rows: [{ Name: "Kept in tab" }] }]));
  sessionStorage.setItem("draft.snapshot.v4", JSON.stringify(record()));
  localStorage.setItem("projections.prorate84", "false");
  localStorage.setItem("projections.riskSd", "6");
  vi.spyOn(window, "confirm").mockReturnValue(true);
  render(<DraftDashboard />);

  await waitFor(() => {
    const snapshot = JSON.parse(sessionStorage.getItem("draft.snapshot.v4")!);
    const device = JSON.parse(localStorage.getItem("draftDashboard.session.v1")!);
    expect(snapshot).toMatchObject({ settings, prorate84: true, riskSd: 28, goalieScoringCategories: { WINS_GOALIE: 4 } });
    expect(device).toMatchObject({ settings, prorate84: true, riskSd: 28, goalieScoringCategories: { WINS_GOALIE: 4 } });
    expect(snapshot).not.toHaveProperty("draftSettings");
    expect(device).not.toHaveProperty("goaliePointValues");
    expect(snapshot).not.toHaveProperty("customCsvEntries");
    expect(device).not.toHaveProperty("customCsvEntries");
    expect(localStorage.getItem("projections.prorate84")).toBe("true");
    expect(localStorage.getItem("projections.riskSd")).toBe("28");
  });

  const exportedJson: string[] = [];
  vi.stubGlobal("Blob", vi.fn(function (parts: unknown[]) { exportedJson.push(String(parts[0])); }));
  vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
  openSettings();
  fireEvent.click(screen.getByRole("button", { name: "Export" }));
  const bookmark = JSON.parse(exportedJson.at(-1)!);
  expect(bookmark).toMatchObject({ settings, prorate84: true, riskSd: 28, goalieScoringCategories: { WINS_GOALIE: 4 } });
  expect(bookmark).not.toHaveProperty("customCsvEntries");
  expect(bookmark).not.toHaveProperty("customSourceMetadata");
  const includeRows = screen.getByLabelText("Include imported projections in export") as HTMLInputElement;
  expect(includeRows.checked).toBe(false);
  fireEvent.click(includeRows);
  fireEvent.click(screen.getByRole("button", { name: "Export" }));
  expect(JSON.parse(exportedJson.at(-1)!).customCsvEntries[0]).toEqual(expect.objectContaining({
    id: "custom_csv_one",
    rows: [{ Name: "Kept in tab" }],
  }));
  fireEvent.click(screen.getByRole("button", { name: "Done" }));

  const storageWrites = vi.spyOn(Storage.prototype, "setItem");
  storageWrites.mockClear();
  fireEvent.click(screen.getByRole("button", { name: "Draft recovery player" }));
  await waitFor(() => expect(JSON.parse(sessionStorage.getItem("draft.snapshot.v4")!).draftedPlayers).toHaveLength(2));
  expect(sessionStorage.getItem("draft.snapshot.v4")).not.toContain("Kept in tab");
  expect(JSON.parse(sessionStorage.getItem("draft.customCsvList.v3")!)[0].rows).toEqual([{ Name: "Kept in tab" }]);
  openSettings();
  fireEvent.click(screen.getByRole("button", { name: "Undo Last Pick" }));
  await waitFor(() => expect(JSON.parse(sessionStorage.getItem("draft.snapshot.v4")!).positionOverrides).toEqual({ "1": "UTILITY" }));
  fireEvent.click(screen.getByRole("button", { name: "Undo Last Pick" }));
  await waitFor(() => expect(JSON.parse(sessionStorage.getItem("draft.snapshot.v4")!).positionOverrides).toEqual({}));
  expect(storageWrites.mock.calls.filter(([key]) => key === "draft.customCsvList.v3")).toHaveLength(0);
});

it("restores no-pick keeper overrides in current and undo state", async () => {
  sessionStorage.setItem("draft.snapshot.v4", JSON.stringify({
    ...record(),
    draftedPlayers: [],
    keepers: [{ playerId: "keeper", teamId: "Team 1", cost: "none" }],
    positionOverrides: { keeper: "C" },
    draftHistory: [{ players: [], pickNumber: 1, positionOverrides: { keeper: "C" } }],
    currentPick: 1,
    csvMetadata: [],
  }));
  vi.spyOn(window, "confirm").mockReturnValue(true);
  render(<DraftDashboard />);

  await waitFor(() => {
    const snapshot = JSON.parse(sessionStorage.getItem("draft.snapshot.v4")!);
    expect(snapshot.keepers).toEqual([expect.objectContaining({ playerId: "keeper", cost: "none" })]);
    expect(snapshot.positionOverrides).toEqual({ keeper: "C" });
    expect(snapshot.draftHistory[0].positionOverrides).toEqual({ keeper: "C" });
  });
});

it("resumes a complete older device record and rewrites canonical analysis fields", async () => {
  const { settings: savedSettings, goalieScoringCategories, ...legacy } = completeRecord();
  localStorage.setItem("draftDashboard.session.v1", JSON.stringify({
    ...legacy,
    draftSettings: savedSettings,
    goaliePointValues: goalieScoringCategories,
    sourceControls: {
      ...legacy.sourceControls,
      custom_csv_device_missing: { isSelected: true, weight: 0.4 },
    },
    csvMetadata: [{ id: "custom_csv_device_missing", label: "Device missing" }],
  }));
  localStorage.setItem("projections.prorate84", "false");
  localStorage.setItem("projections.riskSd", "6");
  vi.spyOn(window, "confirm").mockReturnValue(true);
  render(<DraftDashboard />);

  await waitFor(() => {
    const device = JSON.parse(localStorage.getItem("draftDashboard.session.v1")!);
    const snapshot = JSON.parse(sessionStorage.getItem("draft.snapshot.v4")!);
    expect(device).toMatchObject({ settings, prorate84: true, riskSd: 28, goalieScoringCategories: { WINS_GOALIE: 4 } });
    expect(snapshot).toMatchObject({ settings, prorate84: true, riskSd: 28, goalieScoringCategories: { WINS_GOALIE: 4 } });
    expect(device).not.toHaveProperty("draftSettings");
    expect(device).not.toHaveProperty("goaliePointValues");
    expect(device.keepers).toEqual([expect.objectContaining({ playerId: "keeper", cost: "none" })]);
    expect(device.pickTrades).toEqual([expect.objectContaining({ round: 2, pickInRound: 1, currentTeamId: "Team 1" })]);
    expect(device.customTeamNames).toEqual({ "Team 1": "Alpha", "Team 2": "Beta" });
    expect(device.positionOverrides).toEqual({ "1": "C", keeper: "C" });
    expect(device.draftHistory[0].positionOverrides).toEqual({ keeper: "C" });
    expect(device.csvMetadata).toEqual([{ id: "custom_csv_device_missing", label: "Device missing" }]);
    expect(localStorage.getItem("projections.prorate84")).toBe("true");
    expect(localStorage.getItem("projections.riskSd")).toBe("28");
  });
  expect((screen.getByRole("button", { name: "Draft recovery player", hidden: true }) as HTMLButtonElement).disabled).toBe(true);
  expect(screen.getByText(/Imported projection CSV rows are unavailable in this tab/)).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "Done" }));
  expect(screen.getByRole("button", { name: "Done" })).toBeTruthy();
});

it("preserves a corrupt v4 until explicit reset and keeps export available", async () => {
  const corrupt = "{corrupt-v4";
  sessionStorage.setItem("draft.snapshot.v4", corrupt);
  render(<DraftDashboard />);

  expect(await screen.findByText(/Draft recovery data is corrupt/)).toBeTruthy();
  expect(sessionStorage.getItem("draft.snapshot.v4")).toBe(corrupt);
  expect(localStorage.getItem("draftDashboard.session.v1")).toBeNull();

  let exportedJson = "";
  vi.stubGlobal("Blob", vi.fn(function (parts: unknown[]) { exportedJson = String(parts[0]); }));
  vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
  fireEvent.click(screen.getByRole("button", { name: "Export" }));
  expect(JSON.parse(exportedJson)).toMatchObject({ v: 4, settings: expect.any(Object) });

  fireEvent.click(screen.getByRole("button", { name: "Reset Entire Draft" }));
  fireEvent.click(screen.getByRole("button", { name: "Confirm Reset Entire Draft" }));
  await waitFor(() => {
    const recovered = JSON.parse(sessionStorage.getItem("draft.snapshot.v4")!);
    expect(recovered).toMatchObject({ v: 4, draftedPlayers: [], draftHistory: [] });
  });
  expect(screen.queryByText(/Draft recovery data is corrupt/)).toBeNull();
});

it("prioritizes an older tab snapshot over device recovery after preserving corrupt v4 bytes", async () => {
  const corrupt = "{corrupt-current";
  const older = {
    ...record(),
    v: 2,
    settings: { ...settings, draftOrderMode: "standard" },
    isSnakeDraft: false,
    goalieScoringCategories: undefined,
    csvMetadata: undefined,
    customCsvList: [{ id: "custom_csv_linear", label: "Legacy rows", rows: [{ Name: "Legacy CSV" }] }],
  };
  sessionStorage.setItem("draft.snapshot.v4", corrupt);
  sessionStorage.setItem("draft.snapshot.v2", JSON.stringify(older));
  localStorage.setItem("draftDashboard.session.v1", JSON.stringify({ ...completeRecord(), customTeamNames: { "Team 1": "Device" } }));
  const confirm = vi.spyOn(window, "confirm").mockImplementation((message) => {
    expect(sessionStorage.getItem("draft.snapshot.v4")).toBe(corrupt);
    return String(message).includes("older tab snapshot");
  });
  render(<DraftDashboard />);

  await waitFor(() => {
    const snapshot = JSON.parse(sessionStorage.getItem("draft.snapshot.v4")!);
    expect(snapshot).toMatchObject({ isSnakeDraft: false, settings: { draftOrderMode: "standard" } });
    expect(Object.keys(snapshot.goalieScoringCategories).length).toBeGreaterThan(0);
    expect(sessionStorage.getItem("draft.customCsvList.v3")).toContain("Legacy CSV");
    expect(snapshot.customCsvEntries).toBeUndefined();
  });
  expect(confirm.mock.calls.some(([message]) => String(message).includes("previous session"))).toBe(false);
});

it("recovers a valid device record only after the corrupt tab candidate is preserved", async () => {
  const corrupt = "{corrupt-tab";
  sessionStorage.setItem("draft.snapshot.v4", corrupt);
  localStorage.setItem("draftDashboard.session.v1", JSON.stringify({
    ...completeRecord(),
    customTeamNames: { "Team 1": "Device recovery", "Team 2": "Beta" },
  }));
  vi.spyOn(window, "confirm").mockImplementation((message) => {
    expect(sessionStorage.getItem("draft.snapshot.v4")).toBe(corrupt);
    return String(message).includes("previous session");
  });
  render(<DraftDashboard />);

  await waitFor(() => {
    const snapshot = JSON.parse(sessionStorage.getItem("draft.snapshot.v4")!);
    expect(snapshot.customTeamNames["Team 1"]).toBe("Device recovery");
    expect(snapshot.keepers).toHaveLength(1);
  });
});

it("lets a valid tab beat the device record and a later explicit import beat both", async () => {
  sessionStorage.setItem("draft.snapshot.v4", JSON.stringify({
    ...record(),
    customTeamNames: { "Team 1": "Tab", "Team 2": "Tab 2" },
    csvMetadata: [],
  }));
  localStorage.setItem("draftDashboard.session.v1", JSON.stringify({
    ...record(),
    customTeamNames: { "Team 1": "Device", "Team 2": "Device 2" },
    csvMetadata: [],
  }));
  vi.spyOn(window, "confirm").mockReturnValue(true);
  render(<DraftDashboard />);

  await waitFor(() => expect(JSON.parse(sessionStorage.getItem("draft.snapshot.v4")!).customTeamNames["Team 1"]).toBe("Tab"));
  importBookmark({
    ...record(),
    customTeamNames: { "Team 1": "Imported", "Team 2": "Imported 2" },
    prorate84: false,
    riskSd: 31,
    csvMetadata: [],
  });
  await waitFor(() => {
    expect(JSON.parse(sessionStorage.getItem("draft.snapshot.v4")!).customTeamNames["Team 1"]).toBe("Imported");
    expect(JSON.parse(localStorage.getItem("draftDashboard.session.v1")!).customTeamNames["Team 1"]).toBe("Imported");
    expect(localStorage.getItem("projections.prorate84")).toBe("false");
    expect(localStorage.getItem("projections.riskSd")).toBe("31");
  });
});

it("keeps an explicit import authoritative over a pending account-default load", async () => {
  external.user = { id: "user-1" };
  let resolveSettings!: (value: { data: any; error: null }) => void;
  external.loadSettings.mockImplementation(() => new Promise<{ data: any; error: null }>((resolve) => { resolveSettings = resolve; }));
  render(<DraftDashboard />);
  importBookmark({
    ...record(),
    customTeamNames: { "Team 1": "Imported account winner", "Team 2": "Imported 2" },
    csvMetadata: [],
  });
  await waitFor(() => expect(external.loadSettings).toHaveBeenCalled());
  resolveSettings({
    data: {
      league_type: "categories",
      scoring_categories: { GOALS: 1 },
      goalie_scoring_categories: { WINS_GOALIE: 1 },
      category_weights: { GOALS: 1 },
      roster_config: { C: 4, LW: 4, RW: 4, D: 6, G: 2, bench: 4, utility: 0 },
      team_count: 12,
      draft_order_type: "straight",
      ui_preferences: {},
      active_context: {},
    },
    error: null,
  });

  await waitFor(() => {
    const snapshot = JSON.parse(sessionStorage.getItem("draft.snapshot.v4")!);
    expect(snapshot.settings.teamCount).toBe(2);
    expect(snapshot.settings.leagueType).toBe("points");
    expect(snapshot.customTeamNames["Team 1"]).toBe("Imported account winner");
  });
});

it("replaces stale missing-source metadata when a complete bookmark restores CSV rows", async () => {
  vi.spyOn(window, "confirm").mockReturnValue(true);
  render(<DraftDashboard />);
  importBookmark(missingSourceRecord());
  await waitFor(() => expect(JSON.parse(sessionStorage.getItem("draft.snapshot.v4")!).csvMetadata[0].id).toBe("custom_csv_missing"));

  importBookmark({
    ...record(),
    csvMetadata: [{ id: "custom_csv_portable", label: "Portable" }],
    sourceControls: { custom_csv_portable: { isSelected: true, weight: 1 } },
    customCsvEntries: [{ id: "custom_csv_portable", label: "Portable", rows: [{ Name: "Portable row" }] }],
  });
  await waitFor(() => {
    const snapshot = JSON.parse(sessionStorage.getItem("draft.snapshot.v4")!);
    const device = JSON.parse(localStorage.getItem("draftDashboard.session.v1")!);
    expect(snapshot.csvMetadata).toEqual([expect.objectContaining({ id: "custom_csv_portable" })]);
    expect(snapshot.customCsvEntries).toBeUndefined();
    expect(device.customCsvEntries).toBeUndefined();
    expect(sessionStorage.getItem("draft.customCsvList.v3")).toContain("Portable row");
  });
  fireEvent.click(screen.getByRole("button", { name: "Done" }));
  await waitFor(() => expect(screen.getByRole("button", { name: /Edit Settings/ })).toBeTruthy());
});

it("resets picks and Undo while retaining tab CSV rows and analysis preferences", async () => {
  sessionStorage.setItem("draft.customCsvList.v3", JSON.stringify([{ id: "custom_csv_one", label: "Tab source", rows: [{ Name: "Retained row" }] }]));
  sessionStorage.setItem("draft.snapshot.v4", JSON.stringify(record()));
  vi.spyOn(window, "confirm").mockReturnValue(true);
  render(<DraftDashboard />);
  await waitFor(() => expect(JSON.parse(sessionStorage.getItem("draft.snapshot.v4")!).draftedPlayers).toHaveLength(1));
  openSettings();
  fireEvent.click(screen.getByRole("button", { name: "Reset Entire Draft" }));
  fireEvent.click(screen.getByRole("button", { name: "Confirm Reset Entire Draft" }));

  await waitFor(() => {
    const snapshot = JSON.parse(sessionStorage.getItem("draft.snapshot.v4")!);
    expect(snapshot.draftedPlayers).toEqual([]);
    expect(snapshot.draftHistory).toEqual([]);
  });
  expect(sessionStorage.getItem("draft.customCsvList.v3")).toContain("Retained row");
  expect(localStorage.getItem("projections.prorate84")).toBe("true");
  expect(localStorage.getItem("projections.riskSd")).toBe("28");
});

it("imports attached CSV rows only into tab storage and rejects a storage save failure visibly", async () => {
  vi.spyOn(window, "confirm").mockReturnValue(true);
  let exportedJson = "";
  vi.stubGlobal("Blob", vi.fn(function (parts: unknown[]) { exportedJson = String(parts[0]); }));
  vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
  const setItem = Storage.prototype.setItem;
  vi.spyOn(Storage.prototype, "setItem").mockImplementation(function (this: Storage, key, value) {
    if (key === "draft.snapshot.v4") throw new DOMException("quota", "QuotaExceededError");
    return setItem.call(this, key, value);
  });
  render(<DraftDashboard />);
  importBookmark({ ...record(), customCsvEntries: [{ id: "custom_csv_one", label: "Portable", rows: [{ Name: "Round trip" }] }] });
  await waitFor(() => expect(sessionStorage.getItem("draft.customCsvList.v3")).toContain("Round trip"));
  expect(screen.getByText(/Could not save this draft on this device/)).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "Export" }));
  expect(JSON.parse(exportedJson)).toMatchObject({ v: 4, draftedPlayers: [{ playerId: "1" }] });
});

it("keeps device and analysis preference quota failures visible while preserving the recovered candidate", async () => {
  sessionStorage.setItem("draft.snapshot.v4", JSON.stringify({ ...record(), csvMetadata: [] }));
  vi.spyOn(window, "confirm").mockReturnValue(true);
  const setItem = Storage.prototype.setItem;
  vi.spyOn(Storage.prototype, "setItem").mockImplementation(function (this: Storage, key, value) {
    if (key === "draftDashboard.session.v1" || key === "projections.prorate84" || key === "projections.riskSd") {
      throw new DOMException("quota", "QuotaExceededError");
    }
    return setItem.call(this, key, value);
  });
  let exportedJson = "";
  vi.stubGlobal("Blob", vi.fn(function (parts: unknown[]) { exportedJson = String(parts[0]); }));
  vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
  render(<DraftDashboard />);

  expect(await screen.findByText(/could not be saved|Could not save/i)).toBeTruthy();
  const snapshot = JSON.parse(sessionStorage.getItem("draft.snapshot.v4")!);
  expect(snapshot).toMatchObject({ draftedPlayers: [{ playerId: "1" }], prorate84: true, riskSd: 28 });
  openSettings();
  fireEvent.click(screen.getByRole("button", { name: "Export" }));
  expect(JSON.parse(exportedJson)).toMatchObject({ draftedPlayers: [{ playerId: "1" }], prorate84: true, riskSd: 28 });
});

it("rejects invalid keeper recovery data without changing the active snapshot", async () => {
  sessionStorage.setItem("draft.snapshot.v4", JSON.stringify(record()));
  vi.spyOn(window, "confirm").mockReturnValue(true);
  const invalid = { ...record(), keepers: [
    { playerId: "keeper", teamId: "Team 1", cost: "none" },
    { playerId: "keeper", teamId: "Team 1", cost: "none" },
  ] };
  render(<DraftDashboard />);
  await waitFor(() => expect(sessionStorage.getItem("draft.snapshot.v4")).toContain('"draftedPlayers"'));
  const before = sessionStorage.getItem("draft.snapshot.v4");
  importBookmark(invalid);
  expect(sessionStorage.getItem("draft.snapshot.v4")).toBe(before);
});

it("blocks Done and drafting for a missing selected CSV, then reimports it under the same ID and weight", async () => {
  vi.spyOn(window, "confirm").mockReturnValue(true);
  localStorage.setItem("projections.prorate84", "false");
  localStorage.setItem("projections.riskSd", "6");
  render(<DraftDashboard />);
  importBookmark(missingSourceRecord());

  await waitFor(() => {
    const snapshot = JSON.parse(sessionStorage.getItem("draft.snapshot.v4")!);
    expect(snapshot.draftedPlayers).toHaveLength(1);
    expect(snapshot.sourceControls.custom_csv_missing).toEqual({ isSelected: true, weight: 0.7 });
    expect(snapshot.csvMetadata).toEqual([{ id: "custom_csv_missing", label: "Missing source" }]);
    expect(snapshot.customCsvEntries).toBeUndefined();
    expect(localStorage.getItem("projections.prorate84")).toBe("true");
    expect(localStorage.getItem("projections.riskSd")).toBe("28");
  });
  expect((screen.getByRole("button", { name: "Draft recovery player", hidden: true }) as HTMLButtonElement).disabled).toBe(true);
  fireEvent.click(screen.getByRole("button", { name: "Done" }));
  expect(await screen.findByText("Reimport or remove each missing projection CSV before drafting.")).toBeTruthy();

  fireEvent.click(screen.getByRole("button", { name: "Projections" }));
  fireEvent.click(screen.getByRole("button", { name: "Edit Weights" }));
  expect(screen.getAllByRole("button", { name: "Reimport Missing source" })).toHaveLength(2);
  fireEvent.click(screen.getAllByRole("button", { name: "Reimport Missing source" })[0]);
  fireEvent.click(screen.getByRole("button", { name: "Complete CSV reimport" }));

  await waitFor(() => {
    const snapshot = JSON.parse(sessionStorage.getItem("draft.snapshot.v4")!);
    expect(snapshot.draftedPlayers).toHaveLength(1);
    expect(snapshot.sourceControls.custom_csv_missing).toEqual({ isSelected: true, weight: 0.7 });
    expect(snapshot.csvMetadata).toEqual([expect.objectContaining({ id: "custom_csv_missing", label: "Recovered source" })]);
  });
  expect(JSON.parse(sessionStorage.getItem("draft.customCsvList.v3")!)[0]).toEqual(expect.objectContaining({ id: "custom_csv_missing", label: "Recovered source" }));
  fireEvent.click(screen.getByRole("button", { name: "Done" }));
  await waitFor(() => expect(screen.getByRole("button", { name: /Edit Settings/ })).toBeTruthy());
  expect((screen.getByRole("button", { name: "Draft recovery player" }) as HTMLButtonElement).disabled).toBe(false);
});

it("removes a missing selected CSV explicitly and then allows Done", async () => {
  vi.spyOn(window, "confirm").mockReturnValue(true);
  render(<DraftDashboard />);
  importBookmark(missingSourceRecord());
  await waitFor(() => expect((screen.getByRole("button", { name: "Draft recovery player", hidden: true }) as HTMLButtonElement).disabled).toBe(true));

  fireEvent.click(screen.getByRole("button", { name: "Projections" }));
  fireEvent.click(screen.getByRole("button", { name: "Edit Weights" }));
  expect(screen.getAllByRole("button", { name: "Remove Missing source" })).toHaveLength(2);
  fireEvent.click(screen.getAllByRole("button", { name: "Remove Missing source" })[0]);

  await waitFor(() => {
    const snapshot = JSON.parse(sessionStorage.getItem("draft.snapshot.v4")!);
    expect(snapshot.draftedPlayers).toHaveLength(1);
    expect(snapshot.sourceControls.custom_csv_missing).toBeUndefined();
    expect(snapshot.goalieSourceControls.custom_csv_missing).toBeUndefined();
    expect(snapshot.csvMetadata).toEqual([]);
  });
  fireEvent.click(screen.getByRole("button", { name: "Done" }));
  await waitFor(() => expect(screen.getByRole("button", { name: /Edit Settings/ })).toBeTruthy());
  expect((screen.getByRole("button", { name: "Draft recovery player" }) as HTMLButtonElement).disabled).toBe(false);
});
