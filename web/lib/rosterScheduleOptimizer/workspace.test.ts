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
  it("retains only referenced provider inputs as unverified local planning data", () => {
    const workspace = defaultWorkspace(new Date("2026-10-01T00:00:00Z"));
    workspace.intent.steps = [{ id: "add", type: "add", playerId: "candidate", at: "2026-10-02T00:00:00Z", effectiveAt: "2026-10-02T00:00:00Z", conditional: true, dependsOn: [] }];
    const snapshot = { context: { ...workspace.context, provider: "yahoo" as const, leagueId: "league", teamId: "team" }, roster: [{ playerId: player.id, position: "active" as const }], rules: { ...workspace.rules, rosterSlots: { C: 1 } }, players: [
      { ...player, availability: "rostered" as const, providerId: "453.p.1", ownership: 82, canDrop: true, reserveEligibility: ["IR" as const] },
      { ...player, id: "candidate", availability: "free_agent" as const, providerId: "453.p.2" },
      { ...player, id: "unrelated", availability: "free_agent" as const, providerId: "453.p.3" },
    ] } as any;
    const retained = retainProviderInputs(workspace, snapshot);
    expect(retained.context).toEqual(snapshot.context);
    expect(retained.rules).toEqual(snapshot.rules);
    expect(retained.roster).toEqual(snapshot.roster);
    expect(retained.intent).toEqual(workspace.intent);
    expect(retained.manualPlayers.map((entry) => entry.id)).toEqual([player.id, "candidate"]);
    expect(retained.manualPlayers[0]).toMatchObject({ availability: "unknown", ownership: null, canDrop: null, reserveEligibility: [] });
    expect(retained.manualPlayers[0]).not.toHaveProperty("providerId");
    const storage = new Map<string, string>();
    expect(writeWorkspace({ setItem: (key, value) => storage.set(key, value) }, retained)).toBeNull();
    expect(readWorkspace({ getItem: (key) => storage.get(key) ?? null })?.manualPlayers).toEqual(retained.manualPlayers);
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
