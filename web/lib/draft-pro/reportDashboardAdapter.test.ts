import { describe, expect, it } from "vitest";

import type { ProcessedPlayer } from "hooks/useProcessedProjectionsData";
import type { PlayerVorpMetrics } from "hooks/useVORPCalculations";
import { serializeSavedDraft, type BrowserDraftSnapshot } from "./savedDrafts";
import { scenarioFingerprint } from "./scenarios";
import { reportInputSchema } from "./reports";
import { assertReportSnapshotMatch } from "./reports";
import { adaptReportDashboard, type ReportDashboardAdapterArgs } from "./reportDashboardAdapter";

const player = (id: number, position: string, points: number, stats: Record<string, number> = {}): ProcessedPlayer => ({
  playerId: id, fullName: `Player ${id}`, displayTeam: id === 2 ? "BBB" : "AAA", displayPosition: position, eligiblePositions: [position],
  combinedStats: Object.fromEntries(Object.entries(stats).map(([key, projected]) => [key, { projected, actual: null, diffPercentage: null, projectedDetail: { value: projected, contributingSources: [], missingFromSelectedSources: [], statDefinition: { key } } }])) as unknown as ProcessedPlayer["combinedStats"],
  fantasyPoints: { projected: points, actual: null, diffPercentage: null, projectedPerGame: null, actualPerGame: null },
});
const players = [player(1, "C", 80, { GOALS: 20 }), player(2, "LW", 70, { GOALS: 15 }), player(3, "G", 100, { SAVES_GOALIE: 900, SHOTS_AGAINST_GOALIE: 1000 })];
const metrics = new Map<string, PlayerVorpMetrics>(players.map((value, index) => [String(value.playerId), { value: 100 - index, vorp: 30 - index, vols: 0, vona: 0, vbd: 0, bestPos: value.displayPosition!, eligible: [value.displayPosition!] }]));
const browser = (): BrowserDraftSnapshot => ({
  v: 2, draftSettings: { teamCount: 2, rosterConfig: { C: 1, bench: 0, utility: 0 }, leagueType: "points", scoringCategories: { GOALS: 2 }, categoryWeights: { GOALS: 1 }, draftOrder: ["mine", "other"] }, draftedPlayers: [{ playerId: "1", teamId: "mine", pickNumber: 1, round: 1, pickInRound: 1 }, { playerId: "2", teamId: "other", pickNumber: 2, round: 1, pickInRound: 2 }], keepers: [], pickOwnerOverrides: {}, pickTrades: [], positionOverrides: {}, customTeamNames: { mine: "My Team", other: "Other Team" }, currentPick: 3, isSnakeDraft: true, myTeamId: "mine", baselineMode: "remaining", needWeightEnabled: true, needAlpha: .5, forwardGrouping: "split", personalizeReplacement: false, goaliePointValues: { SAVES_GOALIE: .2 }, sourceControls: { ag_skaters: { isSelected: true, weight: 1 } }, goalieSourceControls: { cullen_goalies: { isSelected: true, weight: 1 } }, customCsvList: [], favorites: [], notes: [], tiers: {}, configured: true,
});
const base = (): ReportDashboardAdapterArgs => ({
  players, rosterAssignments: [{ playerId: "1", teamId: "mine" }, { playerId: "2", teamId: "other" }], myTeamId: "mine", vorpMetrics: metrics,
  leagueType: "points", scoring: { GOALS: 2, SAVES_GOALIE: .2 }, goaliePointValues: { SAVES_GOALIE: .2 }, categoryWeights: { GOALS: 1 }, season: "20262027", schedule: { startWeek: 1, endWeek: 27, lineupMode: "daily", rosterSlots: { C: 1, LW: 1 } }, sourceControls: { ag_skaters: { isSelected: true, weight: 1 } }, goalieSourceControls: { cullen_goalies: { isSelected: true, weight: 1 } }, customCsvList: [], current: { snapshot: browser(), complete: true, savedImportContext: null }, openedDraft: null, reference: { teamId: "other", teamName: "Other Team roster", complete: true },
});

describe("adaptReportDashboard", () => {
  it("captures the completed current roster, exact serialized weights, and a real reference team", () => {
    const result = adaptReportDashboard(base());
    expect(result.context).toBe("current");
    expect(result.snapshot?.sourceWeights).toEqual(serializeSavedDraft(browser()).sourceWeights);
    expect(reportInputSchema.parse(result.input)).toMatchObject({ season: "20262027" });
    expect(assertReportSnapshotMatch(result.snapshot!, result.input!, true)).toMatchObject({ team: { myTeamId: "mine" } });
    expect(result.input).toMatchObject({ roster: [{ id: "1", globalVorp: 30, projectedPoints: 80, categoryValues: { GOALS: 20, SAVES_GOALIE: null } }], scoring: { GOALS: 2, SAVES_GOALIE: .2 }, categoryWeights: { GOALS: 2, SAVES_GOALIE: .2 }, referenceBasis: "Other Team roster", referenceRoster: [{ id: "2", name: "Player 2" }], source: { schedule: { season: "20262027" } } });
    expect(result.draftId).toBeUndefined();
  });

  it("requires completion only for a new current report", () => {
    expect(adaptReportDashboard({ ...base(), current: { snapshot: browser(), complete: false, savedImportContext: null } }).unavailableReason).toMatch(/Complete the current draft/);
    const opened = { id: "00000000-0000-4000-8000-000000000001", snapshot: serializeSavedDraft(browser()), privateImports: [] };
    const result = adaptReportDashboard({ ...base(), current: null, openedDraft: opened });
    expect(result.context).toBe("opened_saved");
    expect(result.draftId).toBe(opened.id);
    expect(result.snapshot).toBeUndefined();
    expect(adaptReportDashboard({ ...base(), current: null, openedDraft: opened, sourceControls: { ag_skaters: { isSelected: true, weight: .5 } } }).unavailableReason).toMatch(/Save current source and goalie scoring changes first/);
  });

  it("keeps private reports local to unchanged saved imports", () => {
    const rows = [{ Player: "A" }];
    const customCsvList = [{ id: "custom_csv_1", label: "Private", headers: [{ original: "Player", standardized: "name", selected: true }], rows }];
    const imports = [{ id: "00000000-0000-4000-8000-000000000011", name: "Private", sourceId: "custom_csv_1", mapping: customCsvList[0].headers, rows }];
    const current = { snapshot: browser(), complete: true, savedImportContext: { draftId: "00000000-0000-4000-8000-000000000001", privateImports: imports } };
    const result = adaptReportDashboard({ ...base(), sourceControls: { custom_csv_1: { isSelected: true, weight: 1 } }, goalieSourceControls: {}, customCsvList, current });
    expect(result.input?.source.projection.privateImports).toEqual([{ id: imports[0].id, contentFingerprint: scenarioFingerprint(rows) }]);
    expect(result.privateImportDraftId).toBe(current.savedImportContext.draftId);
    expect(adaptReportDashboard({ ...base(), sourceControls: { custom_csv_1: { isSelected: true, weight: 1 } }, goalieSourceControls: {}, customCsvList: [{ ...customCsvList[0], rows: [{ Player: "Changed" }] }], current }).unavailableReason).toMatch(/has changed/);
  });
});
