import React from "react";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

const noop = vi.fn();
const external = vi.hoisted(() => ({
  user: null as { id: string } | null,
  espnActive: false,
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

vi.mock("contexts/AuthProviderContext", () => ({ useAuth: () => ({ user: external.user, isLoading: false }) }));
vi.mock("lib/supabase", () => ({ default: { from: () => ({ select: () => ({ eq: () => ({ maybeSingle: () => external.loadSettings() }) }) }) } }));
vi.mock("hooks/useCurrentSeason", () => ({ useCurrentSeasonQuery: () => ({ data: null, isLoading: false }) }));
vi.mock("hooks/useDraftRanking", () => ({ useDraftRanking: () => ({ entries: { data: { entries: [] } }, bootstrap: { data: null } }) }));
vi.mock("hooks/useYahooDraftSync", () => ({ useYahooDraftSync: () => ({ enabled: false, selectedLeagueId: null, sessionId: null, requestState: null, terminalSessionMissing: false, resumeSession: noop, clearSession: noop, start: noop, stop: noop, connect: noop, draftState: null, error: null, isPolling: false, leagues: [], ranking: null, refreshAccount: noop, refreshDraft: noop, setSelectedLeagueId: noop }) }));
vi.mock("hooks/useEspnDraftSync", () => ({ useEspnDraftSync: () => ({ enabled: false, draftState: external.espnActive ? { session: { status: "active" }, picks: [], teams: [] } : null, error: null, isLoading: false, isPolling: false, leagues: [], selectedLeagueId: null, setSelectedLeagueId: noop, start: noop, stop: noop, clear: noop, refresh: noop, reload: noop }) }));
vi.mock("hooks/useProcessedProjectionsData", () => ({ useProcessedProjectionsData: ({ activePlayerType }: { activePlayerType: string }) => ({ processedPlayers: activePlayerType === "goalie" ? [] : [player, keeperPlayer], isLoading: false, error: null, customSourceResolutions: {}, customFallbackUsage: { total: 0 }, sourceWarnings: [], yahooMappingDiagnostics: null, inclusionDiagnostics: null }) }));
vi.mock("hooks/useVORPCalculations", () => ({ useVORPCalculations: () => ({ playerMetrics: new Map(), replacementByPos: {}, expectedTakenByPos: {}, expectedN: 0 }) }));
vi.mock("hooks/useRosterScheduleOptimizer", () => ({ useRosterScheduleOptimizer: () => ({ status: "idle" }) }));
vi.mock("components/PlayerAutocomplete", () => ({ default: () => null }));
vi.mock("components/DraftDashboard/MyRoster", () => ({ default: ({ onDraftPlayer, canDraft }: any) => <button disabled={!canDraft} onClick={() => onDraftPlayer("2")}>Draft recovery player</button> }));
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
  external.user = null; external.espnActive = false; external.loadSettings.mockReset(); external.loadSettings.mockResolvedValue({ data: null, error: null });
});

it.each(["{truncated saved draft", "null", '{"v":2,"draftSettings":{}}'])("retains malformed tab draft %s through autosave and Done", async (raw) => {
  sessionStorage.setItem("draft.snapshot.v2", raw);
  const device = JSON.stringify(snapshot());
  localStorage.setItem("draftDashboard.session.v1", device);
  render(<React.StrictMode><DraftDashboard /></React.StrictMode>);
  await waitFor(() => expect(dialog().textContent).toContain("retained and automatic saving is paused"));
  fireEvent.click(within(dialog()).getByRole("button", { name: "Done" }));
  expect(sessionStorage.getItem("draft.snapshot.v2")).toBe(raw);
  expect(localStorage.getItem("draftDashboard.session.v1")).toBe(device);
});

it("retains malformed device draft without creating a default tab snapshot", async () => {
  const raw = "{truncated device draft";
  localStorage.setItem("draftDashboard.session.v1", raw);
  render(<React.StrictMode><DraftDashboard /></React.StrictMode>);
  await waitFor(() => expect(dialog().textContent).toContain("retained and automatic saving is paused"));
  expect(localStorage.getItem("draftDashboard.session.v1")).toBe(raw);
  expect(sessionStorage.getItem("draft.snapshot.v2")).toBeNull();
});

it("restores and continues saving a valid tab draft", async () => {
  sessionStorage.setItem("draft.snapshot.v2", JSON.stringify(snapshot()));
  render(<DraftDashboard />);
  await waitFor(() => expect(saved().draftSettings.teamCount).toBe(2));
  expect(saved().draftedPlayers).toContainEqual(snapshot().draftedPlayers[0]);
  expect(screen.queryByText(/saved draft is retained/)).toBeNull();
});
