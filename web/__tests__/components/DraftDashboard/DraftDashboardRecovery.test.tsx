import React from "react";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

const noop = vi.fn();
const external = vi.hoisted(() => ({
  user: null as { id: string } | null,
  espnState: null as any,
  showRoster: false,
  players: null as any[] | null,
  filledSlots: {} as Record<string, number>,
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
  return { playerMetrics: new Map(), replacementByPos: {}, expectedTakenByPos: {}, expectedN: 0 };
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

vi.mock("hooks/useFantraxDraftSync", () => ({ useFantraxDraftSync: () => ({ eligible: false, enabled: false, draftState: null }) }));
vi.mock("hooks/useDraftProAccess", () => ({ useDraftProAccess: () => ({ access: null }) }));
vi.mock("hooks/useDraftProDust", () => ({ useDraftProDust: () => ({ data: null, error: null, isLoading: false }) }));
vi.mock("hooks/useDraftSchedule", () => ({ useDraftSchedule: () => ({ playerMetrics: new Map(), weeks: [], selectedWeeks: [], weeksError: null, periodLabel: "Season" }) }));
vi.mock("components/DraftDashboard/ProjectionsTable", () => ({ default: () => null }));
vi.mock("components/DraftDashboard/SuggestedPicks", () => ({ default: () => null }));
vi.mock("components/DraftDashboard/GodView", () => ({ default: () => null }));
vi.mock("components/DraftDashboard/DustMatrix", () => ({ default: () => null }));

const settings = { teamCount: 2, draftOrder: ["Team 1", "Team 2"], draftOrderMode: "snake" as const, reversedRounds: [], rosterConfig: { C: 1, LW: 0, RW: 0, D: 0, G: 0, bench: 1, utility: 0 }, scoringCategories: { GOALS: 3 }, leagueType: "points" as const };
const csv = { id: "custom_csv_one", label: "Tab source", playerType: "skater" as const, rows: [{ Player_Name: "Recovery Player", player_id: 2, Goals: 12, Position: "C" }] };
const snapshot = () => ({ v: 2, configured: true, draftSettings: settings, currentPick: 2, myTeamId: "Team 1", draftedPlayers: [{ playerId: "1", teamId: "Team 1", pickNumber: 1, round: 1, pickInRound: 1 }], keepers: [{ playerId: "9", teamId: "Team 2", cost: "none" }], pickTrades: [], positionOverrides: { "1": "UTILITY" }, draftHistory: [{ players: [], pickNumber: 1 }], sourceControls: { dtz_skaters: { isSelected: true, weight: 0.3 }, custom_csv_one: { isSelected: true, weight: 0.7 } }, goalieSourceControls: { dtz_goalies: { isSelected: true, weight: 1 } }, customCsvList: [csv], goaliePointValues: { WINS_GOALIE: 4 }, prorate84: true, riskSd: 28, forwardGrouping: "fwd", baselineMode: "full", needWeightEnabled: true, needAlpha: 0.8, personalizeReplacement: true });
const bookmark = () => ({ v: 3, settings, currentPick: 1, myTeamId: "Team 1", draftedPlayers: [], keepers: [], pickTrades: [], customCsvList: [csv], customSourceMetadata: [{ id: csv.id, label: csv.label }], sourceControls: { dtz_skaters: { isSelected: true, weight: 0.3 }, [csv.id]: { isSelected: true, weight: 0.7 } }, goalieSourceControls: { dtz_goalies: { isSelected: true, weight: 1 } }, goalieScoringCategories: { WINS_GOALIE: 4 } });
const saved = () => JSON.parse(sessionStorage.getItem("draft.snapshot.v2") || "{}");
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
  Object.defineProperty(HTMLElement.prototype, "scrollIntoView", { configurable: true, value: vi.fn() });
  Object.defineProperty(window, "matchMedia", { configurable: true, value: vi.fn(() => ({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() })) });
  vi.spyOn(window, "confirm").mockReturnValue(true);
});
afterEach(() => {
  cleanup(); sessionStorage.clear(); localStorage.clear(); vi.restoreAllMocks(); vi.unstubAllGlobals();
  external.showRoster = false; external.players = null; external.filledSlots = {};
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
