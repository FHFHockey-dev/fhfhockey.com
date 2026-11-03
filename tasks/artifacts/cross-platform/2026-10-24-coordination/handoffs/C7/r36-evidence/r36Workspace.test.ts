// C7 R36 controls (reviewer-only; not in the repo).
import { describe, expect, it } from "vitest";
import type { PlanningWorkspace } from "../planningTypes";
import { ANONYMOUS_WORKSPACE_KEY, anonymousWorkspace, defaultWorkspace, migrateLegacyWorkspace, readWorkspace, readWorkspaceHistory, workspaceContextKey, writeWorkspace, WORKSPACE_KEY } from "../workspace";

const player = { id: "yahoo:453.p.5", nhlId: 5, name: "Prior Account Goalie", teamAbbreviation: "VAN", eligiblePositions: ["G"], playerClass: "goalie" as const,
  availability: "unknown" as const, ownership: null, canDrop: null, holdValue: null, reserveEligibility: [] };
const memory = (throwOn: (key: string) => boolean = () => false) => {
  const values = new Map<string, string>();
  return { values, storage: { getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => { values.set(key, value); },
    removeItem: (key: string) => { if (throwOn(key)) throw new Error("synthetic removeItem failure"); values.delete(key); },
    key: (index: number) => [...values.keys()][index] ?? null, get length() { return values.size; } } };
};
const yahoo = (): PlanningWorkspace => {
  const w = defaultWorkspace(new Date("2026-10-01T00:00:00Z"));
  w.context = { ...w.context, provider: "yahoo", leagueId: "league-a", teamId: "team-a" };
  w.roster = [{ playerId: player.id, position: "active" }]; w.manualPlayers = [player];
  w.intent.steps = [{ id: "add", type: "add", playerId: player.id, at: "2026-10-02T00:00:00Z", effectiveAt: "2026-10-02T00:00:00Z", conditional: true, dependsOn: [] }];
  return w;
};
const forked = (): PlanningWorkspace => { const w = yahoo(); return { ...w, context: { ...w.context, provider: "manual", leagueId: "manual", teamId: "manual" } }; };
/** HEAD^^-era write: device key + bare context keys. */
const legacyWrite = (values: Map<string, string>, w: PlanningWorkspace, history: PlanningWorkspace[] = []) => {
  const ctx = `${WORKSPACE_KEY}:context:${encodeURIComponent(workspaceContextKey(w.context))}`;
  values.set(WORKSPACE_KEY, JSON.stringify(w)); values.set(ctx, JSON.stringify(w));
  values.set(`${ctx}:undo`, JSON.stringify({ version: 1, current: w, entries: history }));
};

describe("C7 R36", () => {
  it("R34 P1 closed: a legacy manual fork of Yahoo data leaves nothing account-derived for a signed-out visitor", () => {
    const { values, storage } = memory();
    const w = forked(); legacyWrite(values, w, [{ ...w, intent: { ...w.intent, steps: [] } }]);
    migrateLegacyWorkspace(storage);
    const shown = anonymousWorkspace(readWorkspace(storage, undefined, null)!);
    expect(shown).toMatchObject({ roster: [], manualPlayers: [], lockedAssignments: [], intent: { steps: [] } });
    expect(shown.context).toMatchObject({ provider: "manual", startDate: w.context.startDate, endDate: w.context.endDate, timeZone: w.context.timeZone });
    expect(readWorkspaceHistory(storage, shown, null)).toEqual([]);
    expect(readWorkspace(storage, w.context, null)?.manualPlayers ?? []).toEqual([]);
    expect([...values.keys()].filter(k => k === WORKSPACE_KEY || k.startsWith(`${WORKSPACE_KEY}:context:`))).toEqual([]);
    expect(JSON.stringify([...values.values()])).not.toContain("Prior Account Goalie");
  });

  it("R34 P2 closed: one failing key does not stop the others; the failed one is retried next load", () => {
    let fail = true;
    const { values, storage } = memory(key => fail && key.includes("league-a"));
    legacyWrite(values, yahoo());
    const m = forked(); const ctx = `${WORKSPACE_KEY}:context:${encodeURIComponent(workspaceContextKey(m.context))}`;
    values.set(ctx, JSON.stringify(m));
    values.set(`${WORKSPACE_KEY}:context:%E0%A4%A`, "malformed");
    migrateLegacyWorkspace(storage);
    const left = [...values.keys()].filter(k => k.startsWith(`${WORKSPACE_KEY}:context:`));
    expect(left.every(k => k.includes("league-a"))).toBe(true);
    expect(values.has(WORKSPACE_KEY)).toBe(false);
    fail = false; migrateLegacyWorkspace(storage);
    expect([...values.keys()].filter(k => k.startsWith(`${WORKSPACE_KEY}:context:`))).toEqual([]);
  });

  it("idempotent, and principal and anonymous slots survive every later migration", () => {
    const { values, storage } = memory();
    legacyWrite(values, forked());
    migrateLegacyWorkspace(storage);
    writeWorkspace(storage, yahoo(), [], "owner-a");
    const anonEdit = { ...defaultWorkspace(new Date("2026-10-01T00:00:00Z")), roster: [{ playerId: "manual:x", position: "active" as const }] };
    writeWorkspace(storage, anonEdit, [], null);
    const snapshot = new Map(values);
    for (let i = 0; i < 3; i++) migrateLegacyWorkspace(storage);
    expect(values).toEqual(snapshot);
    expect(readWorkspace(storage, undefined, "owner-a")?.manualPlayers.map(p => p.name)).toEqual(["Prior Account Goalie"]);
    expect(readWorkspace(storage, undefined, null)?.roster).toEqual(anonEdit.roster);
  });

  it("an existing anonymous slot is never overwritten by a late legacy pointer (e.g. an old-version tab)", () => {
    const { values, storage } = memory();
    const anonEdit = { ...defaultWorkspace(new Date("2026-10-01T00:00:00Z")), roster: [{ playerId: "manual:x", position: "active" as const }] };
    writeWorkspace(storage, anonEdit, [], null);
    legacyWrite(values, yahoo());
    migrateLegacyWorkspace(storage);
    expect(readWorkspace(storage, undefined, null)?.roster).toEqual(anonEdit.roster);
    expect(values.has(WORKSPACE_KEY)).toBe(false);
  });

  it("principal keys and the anonymous namespace are not matched by the legacy filter", () => {
    const { values, storage } = memory();
    writeWorkspace(storage, yahoo(), [], "owner-a"); writeWorkspace(storage, defaultWorkspace(), [], null);
    const before = [...values.keys()].sort();
    migrateLegacyWorkspace(storage);
    expect([...values.keys()].sort()).toEqual(before);
    expect(before.some(k => k.startsWith(`${ANONYMOUS_WORKSPACE_KEY}:context:`))).toBe(true);
  });
});
