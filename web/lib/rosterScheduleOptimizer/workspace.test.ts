import { describe, expect, it } from "vitest";
import { defaultWorkspace, readWorkspace, resolveImportedNames, retainedScheduleSnapshot, retainProviderInputs, writeWorkspace } from "./workspace";

const player = { id: "fhfh:1", nhlId: 1, name: "Alpha Center", teamAbbreviation: "CAR", eligiblePositions: ["C"], playerClass: "skater" as const, availability: "unknown" as const, ownership: null, canDrop: null, holdValue: null, reserveEligibility: [] };
describe("manual workspace", () => {
  it("matches only unambiguous canonical names", () => {
    const result = resolveImportedNames("Alpha Center\nOther\nAlpha Center", [player]);
    expect(result.matched.map((row) => row.id)).toEqual(["fhfh:1"]);
    expect(result.unresolved).toEqual(["Other"]);
    expect(resolveImportedNames("Alpha Center", [player, { ...player, id: "fhfh:2" }]).unresolved).toEqual(["Alpha Center"]);
  });
  it("persists one versioned workspace and reports storage failure", () => {
    const storage = new Map<string, string>();
    const workspace = defaultWorkspace(new Date("2026-10-01T00:00:00Z"));
    expect(writeWorkspace({ setItem: (key, value) => storage.set(key, value) }, workspace)).toBeNull();
    expect(readWorkspace({ getItem: (key) => storage.get(key) ?? null })).toEqual(workspace);
    expect(writeWorkspace({ setItem: () => { throw new Error("quota"); } }, workspace)).toMatch(/could not save/);
  });
  it("retains one working plan per exact context without returning another context's active plan", () => {
    const values = new Map<string, string>();
    const storage = { getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => values.set(key, value) };
    const first = defaultWorkspace(new Date("2026-10-01T00:00:00Z"));
    first.context.timeZone = "UTC";
    first.context.leagueId = "first";
    first.unresolvedNames = ["First manager input"];
    const second = { ...first, context: { ...first.context, leagueId: "second" }, unresolvedNames: ["Second manager input"] };
    writeWorkspace(storage, first); writeWorkspace(storage, second);
    expect(readWorkspace(storage)).toEqual(second);
    expect(readWorkspace(storage, { ...first.context, asOf: "2026-10-02T00:00:00Z" })).toEqual(first);
    expect(readWorkspace(storage, second.context)).toEqual(second);
    for (const context of [{ ...first.context, teamId: "other" }, { ...first.context, endDate: "2026-10-10" },
      { ...first.context, provider: "yahoo" as const }, { ...first.context, timeZone: "America/New_York" }]) {
      expect(readWorkspace(storage, context)).toBeNull();
    }
  });
  it("retains only referenced provider inputs as unverified local planning data", () => {
    const workspace = defaultWorkspace(new Date("2026-10-01T00:00:00Z"));
    workspace.intent.steps = [{ id: "add", type: "add", playerId: "candidate", at: "2026-10-02T00:00:00Z", effectiveAt: "2026-10-02T00:00:00Z", conditional: true, dependsOn: [] }];
    workspace.manualPlayers = [{ ...player, id: "candidate", eligibilityVerified: true }, { ...player, id: "locked", name: "Locked Player" }];
    workspace.lockedAssignments = [{ date: "2026-10-02", playerId: "locked", slotId: "C#1" }];
    workspace.intent.protectedPlayerIds = [player.id];
    const snapshot = { context: { ...workspace.context, provider: "yahoo" as const, leagueId: "league", teamId: "team" }, roster: [{ playerId: player.id, position: "active" as const }], rules: { ...workspace.rules, rosterSlots: { C: 1 } }, players: [
      { ...player, nhlTeamId: 6, rosterRevision: "roster-a", availability: "rostered" as const, providerId: "453.p.1", eligibilityVerified: true, ownership: 82, canDrop: true, reserveEligibility: ["IR" as const] },
      { ...player, id: "candidate", availability: "free_agent" as const, providerId: "453.p.2" },
      { ...player, id: "unrelated", availability: "free_agent" as const, providerId: "453.p.3" },
    ] } as any;
    const retained = retainProviderInputs(workspace, snapshot);
    expect(retained.context).toEqual(snapshot.context);
    expect(retained.rules).toEqual(snapshot.rules);
    expect(retained.roster).toEqual(snapshot.roster);
    expect(retained.intent).toEqual(workspace.intent);
    expect(retained.manualPlayers.map((entry) => entry.id).sort()).toEqual(["candidate", player.id, "locked"].sort());
    expect(retained.manualPlayers.find(entry => entry.id === "locked")).toMatchObject({ name: "Locked Player", availability: "unknown", canDrop: null });
    expect(retained.lockedAssignments).toEqual(workspace.lockedAssignments);
    expect(retained.manualPlayers.find(entry => entry.id === player.id)).toMatchObject({ nhlTeamId: 6, rosterRevision: "roster-a" });
    expect(retained.manualPlayers[0]).toMatchObject({ availability: "unknown", ownership: null, canDrop: null, reserveEligibility: [] });
    expect(Object.fromEntries(retained.manualPlayers.map((entry) => [entry.id, entry.eligibilityVerified])))
      .toEqual({ [player.id]: false, candidate: true, locked: false });
    expect(retained.manualPlayers[0]).not.toHaveProperty("providerId");
    const storage = new Map<string, string>();
    expect(writeWorkspace({ setItem: (key, value) => storage.set(key, value) }, retained)).toBeNull();
    expect(readWorkspace({ getItem: (key) => storage.get(key) ?? null })?.manualPlayers).toEqual(retained.manualPlayers);
    expect(readWorkspace({ getItem: (key) => storage.get(key) ?? null })).toMatchObject({ intent: workspace.intent, lockedAssignments: workspace.lockedAssignments });
  });
});


it("keeps shared schedule analysis after a provider failure without restoring availability or minimum credit", () => {
  const workspace = defaultWorkspace(new Date("2026-10-01T00:00:00Z"));
  workspace.context.provider = "yahoo";
  workspace.roster = [{ playerId: player.id, position: "active" }];
  workspace.manualPlayers = [{ ...player, availability: "rostered", canDrop: true }];
  workspace.rules.goalieMinimum.credited = 4;
  const data = { players: [], games: [{ id: "g", date: "2026-10-05", startsAt: "2026-10-05T23:00:00Z", teamAbbreviation: "CAR", opponent: "NJD", home: true, status: "scheduled" as const }], forecasts: [], evidence: {} };
  const result = retainedScheduleSnapshot(workspace, data, "2026-10-02T00:00:00Z")!;
  expect(result.games).toEqual(data.games);
  expect(result.players[0]).toMatchObject({ availability: "unknown", canDrop: null });
  expect(result.rules.goalieMinimum.credited).toBeNull();
  expect(result.rules.periods).toEqual([]);
  expect(result.opponent).toBeNull();
});

it("uses current catalog lineage only for matching retained player identity and team", () => {
  const workspace = defaultWorkspace(new Date("2026-10-01T00:00:00Z"));
  workspace.roster = [{ playerId: player.id, position: "active" }];
  workspace.manualPlayers = [{ ...player, nhlTeamId: 6, rosterRevision: "old-roster", eligibilityVerified: true }];
  const data = { players: [{ ...player, nhlTeamId: 6, rosterRevision: "current-roster", eligibilityVerified: false }],
    games: [], forecasts: [], evidence: {} };
  const retained = retainedScheduleSnapshot(workspace, data, "2026-10-02T00:00:00Z")!;
  expect(retained.players[0]).toMatchObject({ rosterRevision: "current-roster", nhlTeamId: 6, eligibilityVerified: true });
  data.players[0].teamAbbreviation = "OTT";
  const moved = retainedScheduleSnapshot(workspace, data, "2026-10-02T00:00:00Z")!;
  expect(moved.players[0]).toMatchObject({ eligibilityVerified: false });
  expect(moved.players[0].rosterRevision).toBeUndefined();
  expect(moved.players[0].nhlTeamId).toBeUndefined();
});
