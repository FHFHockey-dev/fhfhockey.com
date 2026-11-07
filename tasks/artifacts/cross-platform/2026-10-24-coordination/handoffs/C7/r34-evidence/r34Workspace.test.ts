// C7 R34 controls (reviewer-only; not in the repo).
import { describe, expect, it } from "vitest";
import type { PlanningWorkspace } from "../planningTypes";
import { anonymousWorkspace, defaultWorkspace, migrateLegacyWorkspace, readWorkspace, readWorkspaceHistory, workspaceContextKey, writeWorkspace, WORKSPACE_KEY } from "../workspace";

const player = { id: "yahoo:453.p.5", nhlId: 5, name: "Prior Account Goalie", teamAbbreviation: "VAN", eligiblePositions: ["G"], playerClass: "goalie" as const,
  availability: "unknown" as const, ownership: null, canDrop: null, holdValue: null, reserveEligibility: [] };
const memory = () => {
  const values = new Map<string, string>();
  return { values, storage: { getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => { values.set(key, value); },
    removeItem: (key: string) => { values.delete(key); }, key: (index: number) => [...values.keys()][index] ?? null, get length() { return values.size; } } };
};
const yahoo = (): PlanningWorkspace => {
  const w = defaultWorkspace(new Date("2026-10-01T00:00:00Z"));
  w.context = { ...w.context, provider: "yahoo", leagueId: "league-a", teamId: "team-a" };
  w.roster = [{ playerId: player.id, position: "active" }]; w.manualPlayers = [player];
  w.intent.steps = [{ id: "add", type: "add", playerId: player.id, at: "2026-10-02T00:00:00Z", effectiveAt: "2026-10-02T00:00:00Z", conditional: true, dependsOn: [] }];
  return w;
};
/** What the component's "Continue manually" produces from a Yahoo workspace: provider-derived roster under a manual context. */
const continuedManually = (): PlanningWorkspace => {
  const w = yahoo();
  return { ...w, context: { ...w.context, provider: "manual", leagueId: "manual", teamId: "manual" } };
};

describe("C7 R34", () => {
  it("P1: a legacy manual workspace forked from Yahoo keeps its roster and Undo history in the anonymous slot", () => {
    const { storage } = memory();
    const forked = continuedManually(), earlier = { ...forked, intent: { ...forked.intent, steps: [] } };
    writeWorkspace(storage, forked, [earlier]); // HEAD^ layout: device key + context keys, no principal
    migrateLegacyWorkspace(storage);
    const shown = readWorkspace(storage, undefined, null);
    const anon = shown && anonymousWorkspace(shown);
    expect(anon?.manualPlayers.map(p => p.name)).toEqual(["Prior Account Goalie"]);
    expect(anon?.intent.steps).toHaveLength(1);
    expect(readWorkspaceHistory(storage, anon!, null)).toHaveLength(1);
  });

  it("P2: a malformed legacy context key aborts migration, leaving a later Yahoo legacy Undo key readable anonymously", () => {
    const { storage, values } = memory();
    values.set(`${WORKSPACE_KEY}:context:%E0%A4%A`, "x"); // URIError on decode
    const legacy = yahoo(), earlier = { ...legacy, intent: { ...legacy.intent, steps: [] } };
    writeWorkspace(storage, legacy, [earlier]);
    migrateLegacyWorkspace(storage);
    const yahooKeys = [...values.keys()].filter(key => key.includes("yahoo"));
    expect(yahooKeys.length).toBeGreaterThan(0);
    expect(readWorkspaceHistory(storage, legacy, null)).toHaveLength(1);
    // The component blocks restoring such a context anonymously, but edit() reads this history for the new context.
    expect(readWorkspace(storage, legacy.context, null)?.context.provider).toBe("yahoo");
  });

  it("no-principal callers use HEAD^'s exact key names", () => {
    const { values, storage } = memory();
    const w = defaultWorkspace(new Date("2026-10-01T00:00:00Z"));
    writeWorkspace(storage, w, []);
    const ctx = `${WORKSPACE_KEY}:context:${encodeURIComponent(workspaceContextKey(w.context))}`;
    expect([...values.keys()].sort()).toEqual([WORKSPACE_KEY, ctx, `${ctx}:undo`].sort());
  });

  it("principal writes never touch the device key or another principal's namespace", () => {
    const { values, storage } = memory();
    writeWorkspace(storage, yahoo(), [], "owner-a");
    expect([...values.keys()].every(key => key.startsWith(`${WORKSPACE_KEY}:principal:owner-a`))).toBe(true);
    expect(readWorkspace(storage, yahoo().context, "owner-a:x")).toBeNull();
    writeWorkspace(storage, yahoo(), [], "owner-a:x");
    expect(readWorkspace(storage, undefined, "owner-a")).not.toBeNull();
  });
});
