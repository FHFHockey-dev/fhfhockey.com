import { afterEach, describe, expect, it, vi } from "vitest";
import { webcrypto } from "node:crypto";
import type { PlanningWorkspace } from "./planningTypes";
import { acquirePreservationWriter, capturePreservation, preservationChecksum, readPreservedKeys, restorePreservedKeys, validatePreservation, withWorkspaceWriter, currentPlanningRange, currentProviderPeriod, defaultContext, defaultWorkspace, readWorkspace, readWorkspaceHistory, resolveImportedNames, retainedScheduleSnapshot, retainProviderInputs, writeWorkspace, WORKSPACE_HISTORY_LIMIT, WORKSPACE_KEY, ANONYMOUS_WORKSPACE_KEY, anonymousWorkspace, migrateLegacyWorkspace, workspaceContextKey, preservationKeys, workspaceStorageKey } from "./workspace";

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
  it("retains bounded validated undo history only for the matching saved workspace", () => {
    const values = new Map<string, string>();
    const storage = { getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => values.set(key, value) };
    const workspace = defaultWorkspace(new Date("2026-10-01T00:00:00Z"));
    const entries = Array.from({ length: WORKSPACE_HISTORY_LIMIT + 5 }, (_, revision) => ({ ...workspace, intent: { ...workspace.intent, revision } }));
    const other = { ...workspace, context: { ...workspace.context, leagueId: "other" } };
    writeWorkspace(storage, workspace, [...entries, other]);
    expect(readWorkspaceHistory(storage, readWorkspace(storage)!)).toEqual(entries.slice(-WORKSPACE_HISTORY_LIMIT));
    expect(readWorkspaceHistory(storage, other)).toEqual([]);
    expect(readWorkspaceHistory(storage, { ...workspace, unresolvedNames: ["Newer input"] })).toEqual([]);
    const historyKey = [...values.keys()].find(key => key.endsWith(":undo"))!;
    for (const invalid of [null, { version: 2 }, { version: 1, current: workspace, entries: [other] },
      { version: 1, current: workspace, entries: [{ ...workspace, version: 99 }] },
      { version: 1, current: workspace, entries: Array(WORKSPACE_HISTORY_LIMIT + 1).fill(workspace) }]) {
      values.set(historyKey, JSON.stringify(invalid));
      expect(readWorkspaceHistory(storage, workspace)).toEqual([]);
    }
    values.set(historyKey, "{broken");
    expect(readWorkspaceHistory(storage, workspace)).toEqual([]);
  });
  it("rejects stale undo when storage fails after saving the current workspace", () => {
    const values = new Map<string, string>();
    const storage = { getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => values.set(key, value) };
    const original = defaultWorkspace(new Date("2026-10-01T00:00:00Z"));
    writeWorkspace(storage, original, [original]);
    const next = { ...original, unresolvedNames: ["New input"] };
    expect(writeWorkspace({ setItem: (key, value) => { if (key.endsWith(":undo")) throw new Error("quota"); values.set(key, value); } }, next, [original])).toMatch(/could not save/);
    expect(readWorkspace(storage)).toEqual(next);
    expect(readWorkspaceHistory(storage, next)).toEqual([]);
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
    expect(writeWorkspace({ setItem: (key, value) => storage.set(key, value) }, retained, [], "owner-a")).toBeNull();
    expect(readWorkspace({ getItem: (key) => storage.get(key) ?? null }, undefined, "owner-a")?.manualPlayers).toEqual(retained.manualPlayers);
    expect(readWorkspace({ getItem: (key) => storage.get(key) ?? null }, undefined, "owner-a")).toMatchObject({ intent: workspace.intent, lockedAssignments: workspace.lockedAssignments });
  });
});

describe("principal-scoped local workspaces", () => {
  const connected = () => {
    const workspace = defaultWorkspace(new Date("2026-10-01T00:00:00Z"));
    workspace.context = { ...workspace.context, provider: "yahoo", leagueId: "league", teamId: "team" };
    workspace.roster = [{ playerId: player.id, position: "active" }]; workspace.manualPlayers = [player];
    workspace.lockedAssignments = [{ date: workspace.context.startDate, playerId: player.id, slotId: "C#1" }];
    workspace.intent.steps = [{ id: "add", type: "add", playerId: player.id, at: "2026-10-02T00:00:00Z", effectiveAt: "2026-10-02T00:00:00Z", conditional: true, dependsOn: [] }];
    workspace.intent.protectedPlayerIds = [player.id];
    return workspace;
  };
  const memory = () => {
    const values = new Map<string, string>();
    return { values, storage: { getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => { values.set(key, value); },
      removeItem: (key: string) => { values.delete(key); }, key: (index: number) => [...values.keys()][index] ?? null, get length() { return values.size; } } };
  };

  it("never shows one principal's workspace or Undo history to another principal or to the anonymous slot", () => {
    const { storage } = memory();
    const workspace = connected(), previous = { ...workspace, intent: { ...workspace.intent, steps: [] } };
    expect(writeWorkspace(storage, workspace, [previous], "owner-a")).toBeNull();
    expect(readWorkspace(storage, undefined, "owner-a")).toEqual(workspace);
    expect(readWorkspaceHistory(storage, workspace, "owner-a")).toEqual([previous]);
    expect(readWorkspace(storage, undefined, "owner-b")).toBeNull();
    expect(readWorkspace(storage, workspace.context, "owner-b")).toBeNull();
    expect(readWorkspaceHistory(storage, workspace, "owner-b")).toEqual([]);
    expect(readWorkspace(storage)).toBeNull();
    expect(storage.getItem(WORKSPACE_KEY)).toBeNull(); expect(storage.getItem(ANONYMOUS_WORKSPACE_KEY)).toBeNull();
    expect(workspaceStorageKey("owner-a")).not.toBe(workspaceStorageKey("owner-b"));
    expect(preservationKeys("owner-a", workspace.context).slice(0, 3).every(key => key.startsWith(workspaceStorageKey("owner-a")))).toBe(true);
  });

  it("keeps anonymous reads unchanged and reduces a provider workspace to an empty manual one for signed-out display", () => {
    const { storage, values } = memory();
    const manual = defaultWorkspace(new Date("2026-10-01T00:00:00Z"));
    manual.intent.steps = connected().intent.steps;
    values.set(ANONYMOUS_WORKSPACE_KEY, JSON.stringify(manual));
    expect(readWorkspace(storage)).toEqual(manual);
    expect(anonymousWorkspace(manual)).toBe(manual);
    const legacy = connected();
    writeWorkspace(storage, legacy, [manual]);
    // Callers without a principal keep the device-key API; the component strips before showing it signed out.
    expect(readWorkspace(storage)).toEqual(legacy);
    expect(readWorkspace(storage, undefined, "owner-a")).toBeNull();
    const anonymous = anonymousWorkspace(legacy);
    expect(anonymous.context).toMatchObject({ provider: "manual", leagueId: "manual", teamId: "manual", startDate: legacy.context.startDate, endDate: legacy.context.endDate, timeZone: legacy.context.timeZone });
    expect(anonymous).toMatchObject({ roster: [], manualPlayers: [], lockedAssignments: [], intent: { steps: [], protectedPlayerIds: [] } });
  });

  it("migrates a pre-upgrade device as ownerless: only dates carry over and every legacy key is removed", () => {
    const { storage, values } = memory();
    const legacyContextKey = (context: PlanningWorkspace["context"]) => `${WORKSPACE_KEY}:context:${encodeURIComponent(workspaceContextKey(context))}`;
    // A pre-upgrade "Continue manually" copy: manual context, but an account's Yahoo roster, players, plan and locks.
    const yahoo = connected();
    const snapshot = { ...yahoo, id: "provider", players: [{ ...player, name: "Prior Account Goalie", playerClass: "goalie" as const }], games: [], forecasts: [], evidence: {} } as any;
    const retained = retainProviderInputs(yahoo, snapshot);
    const continued: PlanningWorkspace = { ...retained, context: { ...retained.context, provider: "manual", leagueId: "manual", teamId: "manual" } };
    const previous = { ...continued, intent: { ...continued.intent, steps: [] } };
    values.set(`${WORKSPACE_KEY}:context:%E0%A4%A`, "undecodable");
    values.set(WORKSPACE_KEY, JSON.stringify(continued));
    values.set(legacyContextKey(continued.context), JSON.stringify(continued));
    values.set(`${legacyContextKey(continued.context)}:undo`, JSON.stringify({ version: 1, current: continued, entries: [previous] }));
    values.set(legacyContextKey(yahoo.context), JSON.stringify(yahoo));
    values.set(`${legacyContextKey(yahoo.context)}:undo`, JSON.stringify({ version: 1, current: yahoo, entries: [] }));
    writeWorkspace(storage, yahoo, [], "owner-a");
    const owned = [...values.keys()].filter(key => key.startsWith(workspaceStorageKey("owner-a")));
    values.set("unrelated", "keep");
    expect(continued.manualPlayers.map(row => row.name)).toContain("Prior Account Goalie");

    migrateLegacyWorkspace(storage);
    expect([...values.keys()].filter(key => key === WORKSPACE_KEY || key.startsWith(`${WORKSPACE_KEY}:context:`))).toEqual([]);
    const anonymous = readWorkspace(storage)!;
    expect(anonymous.context).toMatchObject({ provider: "manual", leagueId: "manual", teamId: "manual", seasonId: continued.context.seasonId,
      startDate: continued.context.startDate, endDate: continued.context.endDate, timeZone: continued.context.timeZone });
    expect(anonymous).toMatchObject({ roster: [], manualPlayers: [], lockedAssignments: [], intent: { steps: [], protectedPlayerIds: [], excludedPlayerIds: [] } });
    expect(JSON.stringify(anonymous)).not.toContain("Prior Account Goalie");
    expect(readWorkspaceHistory(storage, anonymous)).toEqual([]);
    expect(readWorkspace(storage, continued.context)).toMatchObject({ manualPlayers: [], roster: [], intent: { steps: [] } });
    for (const key of owned) expect(values.has(key)).toBe(true);
    expect(readWorkspace(storage, undefined, "owner-a")).toEqual(yahoo);
    expect(values.get("unrelated")).toBe("keep");
    const settled = new Map(values); migrateLegacyWorkspace(storage); expect(values).toEqual(settled);
  });

  it("never overwrites an existing anonymous workspace with migrated legacy dates", () => {
    const { storage, values } = memory();
    const current = defaultWorkspace(new Date("2026-10-01T00:00:00Z"));
    current.manualPlayers = [player]; current.roster = [{ playerId: player.id, position: "active" }];
    writeWorkspace(storage, current);
    values.set(WORKSPACE_KEY, JSON.stringify(connected()));
    migrateLegacyWorkspace(storage);
    expect(readWorkspace(storage)).toEqual(current);
    expect(values.has(WORKSPACE_KEY)).toBe(false);
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

it("carries participation receipts and explicit revocation into a retained roster without restoring provider authority", () => {
  const workspace = defaultWorkspace(new Date("2026-10-01T00:00:00Z"));
  workspace.context.provider = "yahoo";
  workspace.roster = [{ playerId: player.id, position: "active" }];
  workspace.manualPlayers = [{ ...player, availability: "rostered", canDrop: true }];
  const participation = { playerId: 1, nhlPlayerId: 1, seasonId: workspace.context.seasonId, gameId: 31, teamId: 6,
    basis: "appearance" as const, probability: 0.5, revisionId: "synthetic-participation", released: true,
    allowedUses: { assignment: true, totals: false, comparison: false, conditionalTieBreak: true },
    scheduleRevision: "fixture-schedule", rosterRevision: "fixture-roster", issuedAt: workspace.context.asOf,
    cutoffAt: workspace.context.asOf, expiresAt: "2026-10-08T00:00:00Z" };
  const evidence = { source: "Synthetic uncalibrated participation", asOf: workspace.context.asOf,
    seasonId: workspace.context.seasonId, completeness: "partial" as const, limitations: ["Calibration unavailable."] };
  const data = { players: [], games: [], forecasts: [], participationSources: [participation], evidence: { participation: evidence } };
  const before = JSON.stringify(workspace);
  const retained = retainedScheduleSnapshot(workspace, data, "2026-10-02T00:00:00Z")!;
  expect(retained.participationSources).toBe(data.participationSources);
  expect(retained.evidence.participation).toBe(evidence);
  expect(retained.participationSources?.[0].allowedUses?.totals).toBe(false);
  expect(retained.players[0]).toMatchObject({ availability: "unknown", canDrop: null });
  expect(retained.rules.acquisitionTiming).toBe("unknown");
  expect(retained.rules.periods).toEqual([]);
  expect(retainedScheduleSnapshot(workspace, { ...data, participationSources: [] }, retained.context.asOf)?.participationSources).toEqual([]);
  expect(retainedScheduleSnapshot(workspace, { ...data, participationSources: undefined }, retained.context.asOf)?.participationSources).toBeUndefined();
  expect(JSON.stringify(workspace)).toBe(before);
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


describe("workspace preservation", () => {
  afterEach(() => vi.unstubAllGlobals());
  async function fixture() {
    vi.stubGlobal("crypto", webcrypto);
    const values = new Map<string, string>();
    const storage = { getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => { values.set(key, value); }, removeItem: (key: string) => { values.delete(key); } };
    const previous = defaultWorkspace(new Date("2026-10-01T12:00:00Z"));
    const workspace = JSON.parse(JSON.stringify(previous));
    workspace.intent.steps = [{ id: "selected", type: "add", playerId: "candidate", at: "2026-10-02T12:00:00Z", effectiveAt: "2026-10-02T12:00:00Z", conditional: true, dependsOn: [] }];
    writeWorkspace(storage, workspace, [previous], "owner-a");
    values.set("unrelated", "keep");
    const backup = await capturePreservation(storage, "owner-a", workspace, [previous], { selectedDate: null, selectedPlayer: "candidate", tab: "itinerary" }, { receiptId: "server-receipt", row: null });
    return { storage, values, workspace, backup };
  }
  it("restores raw values, absence, nonzero intent and Undo without changing unrelated keys", async () => {
    const { storage, values, backup } = await fixture();
    expect(backup.workspace.intent.steps).toHaveLength(1);
    expect(backup.local[3].value).toBeNull();
    expect(backup.provider).toBeNull();
    values.set(backup.local[0].key, "test workspace"); values.set(backup.local[3].key, "2026-10-02");
    const expected = readPreservedKeys(storage, backup.local.map(entry => entry.key));
    restorePreservedKeys(storage, backup.local, expected);
    expect(readPreservedKeys(storage, backup.local.map(entry => entry.key))).toEqual(backup.local);
    expect(readWorkspaceHistory(storage, backup.workspace, "owner-a")).toEqual(backup.history);
    expect(values.get("unrelated")).toBe("keep");
  });
  it("pins provider authority independently and rejects another provider context", async () => {
    const { storage, workspace, backup } = await fixture();
    const provider = { connected: { id: "original-provider", context: workspace.context, players: [], roster: workspace.roster, rules: workspace.rules, lockedAssignments: [], realized: {}, opponent: null, games: [], forecasts: [], evidence: {} }, capabilities: { roster: true, availability: true, rules: true, matchup: true, acquisitions: true, limitations: [] }, proposal: null, refresh: null, schedule: null, settledRefresh: 0, lastUpdated: null };
    const captured = await capturePreservation(storage, "owner-a", workspace, [], backup.view, backup.remote, null, provider);
    provider.connected.rules = { ...provider.connected.rules, rosterSlots: { C: 4 } };
    expect(captured.provider!.connected!.rules.rosterSlots).toEqual(workspace.rules.rosterSlots);
    const changed = JSON.parse(JSON.stringify(captured)); changed.provider.connected.context.teamId = "other-team";
    const { checksum: _checksum, ...payload } = changed; changed.checksum = await preservationChecksum(payload);
    await expect(validatePreservation(changed, "owner-a", backup.contextKey)).rejects.toThrow(/Provider backup belongs to another context/);
  });
  it("rejects changed payload, wrong principal/context and injected key scope", async () => {
    const { backup } = await fixture();
    await expect(validatePreservation(backup, "owner-b", backup.contextKey)).rejects.toThrow(/principal/);
    await expect(validatePreservation(backup, "owner-a", "other-context")).rejects.toThrow(/context/);
    const changed = JSON.parse(JSON.stringify(backup)); changed.workspace.intent.steps = [];
    await expect(validatePreservation(changed, "owner-a", backup.contextKey)).rejects.toThrow(/checksum/);
    changed.local[0].key = "unrelated";
    const { checksum: _checksum, ...payload } = changed; changed.checksum = await preservationChecksum(payload);
    await expect(validatePreservation(changed, "owner-a", backup.contextKey)).rejects.toThrow(/unexpected storage/);
  });
  it("refuses stale storage and preserves independently captured in-memory Undo", async () => {
    const { storage, values, backup, workspace } = await fixture();
    values.set(backup.local[0].key, "another writer");
    expect(() => restorePreservedKeys(storage, backup.local, backup.local)).toThrow(/another writer/);
    expect(values.get(backup.local[0].key)).toBe("another writer");
    values.set(backup.local[0].key, backup.local[0].value!);
    const divergent = await capturePreservation(storage, "owner-a", workspace, [], backup.view, backup.remote);
    expect(divergent.history).toEqual([]); expect(divergent.local[2].value).toBe(backup.local[2].value);
  });
  it("rolls back only affected keys when restoration encounters a write failure", async () => {
    const { storage, values, backup } = await fixture();
    values.set(backup.local[3].key, "2026-10-03");
    const expected = readPreservedKeys(storage, backup.local.map(entry => entry.key));
    let failed = false;
    const failing = { ...storage, setItem: (key: string, value: string) => { if (!failed && key === backup.local[1].key) { failed = true; throw new Error("quota"); } storage.setItem(key, value); } };
    expect(() => restorePreservedKeys(failing, backup.local, expected)).toThrow("quota");
    expect(readPreservedKeys(storage, backup.local.map(entry => entry.key))).toEqual(expected);
    expect(values.get("unrelated")).toBe("keep");
  });
  it("holds an exclusive origin writer lease and rejects a competing writer", async () => {
    let occupied = false;
    const jobs: Promise<unknown>[] = [];
    const locks = { request: (_name: string, _options: unknown, callback: (lock: unknown) => unknown) => {
      if (occupied) return Promise.resolve(callback(null));
      occupied = true;
      const job = Promise.resolve(callback({ name: "writer" })).finally(() => { occupied = false; }); jobs.push(job); return job;
    } } as unknown as LockManager;
    const lease = await acquirePreservationWriter(locks);
    const write = vi.fn();
    await expect(withWorkspaceWriter(locks, write)).rejects.toThrow(/holds this workspace/);
    expect(write).not.toHaveBeenCalled();
    lease.release(); await Promise.all(jobs);
    await withWorkspaceWriter(locks, write); expect(write).toHaveBeenCalledOnce();
    await expect(acquirePreservationWriter(undefined)).rejects.toThrow(/unavailable/);
  });
});


describe("current league planning range", () => {
  it.each([
    ["2026-10-14T12:00:00Z", "America/New_York", "2026-10-12", "2026-10-18"],
    ["2026-10-19T02:00:00Z", "America/New_York", "2026-10-12", "2026-10-18"],
    ["2026-10-19T04:00:00Z", "America/New_York", "2026-10-19", "2026-10-25"],
    ["2026-11-01T06:30:00Z", "America/New_York", "2026-10-26", "2026-11-01"],
    ["2026-03-08T07:30:00Z", "America/New_York", "2026-03-02", "2026-03-08"],
    ["2026-10-19T02:00:00Z", "Asia/Tokyo", "2026-10-19", "2026-10-25"],
  ])("uses local Mon–Sun at %s in %s", (instant, zone, startDate, endDate) => {
    expect(currentPlanningRange(new Date(instant), zone)).toEqual({ startDate, endDate, source: "calendar" });
    expect(defaultContext(new Date(instant), zone)).toMatchObject({ startDate, endDate, timeZone: zone });
  });
  it("uses a known current nonstandard matchup and rejects expired or invalid dates", () => {
    const now = new Date("2026-10-13T12:00:00Z");
    expect(currentPlanningRange(now, "UTC", { startDate: "2026-10-09", endDate: "2026-10-22" })).toEqual({ startDate: "2026-10-09", endDate: "2026-10-22", source: "provider" });
    for (const period of [{ startDate: "2026-10-01", endDate: "2026-10-11" }, { startDate: "2026-02-30", endDate: "2026-10-18" }])
      expect(currentPlanningRange(now, "UTC", period).source).toBe("calendar");
  });
  it("requires fresh owned current-week provider evidence, preserving unverified dates", () => {
    const now = new Date("2026-10-13T12:00:00Z");
    const context = { ...defaultContext(now, "UTC"), provider: "yahoo" as const, teamId: "team", leagueId: "league" };
    const snapshot = { context, evidence: { roster: { completeness: "complete" } }, acquisitionEvidence: {
      source: "Yahoo team roster_adds and league current_week", asOf: now.toISOString(), counter: { coverageType: "week", coverageWeek: 1, used: 0 },
      period: { week: 1, startDate: "2026-10-09", endDate: "2026-10-22", containsHorizon: true }
    } } as any;
    expect(currentProviderPeriod(snapshot, context, now)).toEqual(snapshot.acquisitionEvidence.period);
    // Read earlier in the same matchup period: the dates still hold (the range line kept falling back two minutes
    // after a provider read, on the next render).
    for (const asOf of ["2026-10-13T11:00:00Z", "2026-10-09T00:30:00Z"])
      expect(currentProviderPeriod({ ...snapshot, acquisitionEvidence: { ...snapshot.acquisitionEvidence, asOf } }, context, now))
        .toEqual(snapshot.acquisitionEvidence.period);
    for (const invalid of [
      { ...snapshot, context: { ...context, teamId: "other" } },
      // Read before this period began, or stamped by a clock ahead of ours.
      { ...snapshot, acquisitionEvidence: { ...snapshot.acquisitionEvidence, asOf: "2026-10-08T23:00:00Z" } },
      { ...snapshot, acquisitionEvidence: { ...snapshot.acquisitionEvidence, asOf: "2026-10-13T12:05:00Z" } },
      { ...snapshot, acquisitionEvidence: { ...snapshot.acquisitionEvidence, counter: { coverageType: "week", coverageWeek: 1, used: null } } },
      { ...snapshot, acquisitionEvidence: { ...snapshot.acquisitionEvidence, period: { ...snapshot.acquisitionEvidence.period, containsHorizon: false } } },
    ]) expect(currentProviderPeriod(invalid, context, now)).toBeUndefined();
  });
});
