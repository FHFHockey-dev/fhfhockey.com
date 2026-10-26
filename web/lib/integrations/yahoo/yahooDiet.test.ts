import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ planningData: vi.fn(), settings: vi.fn(), draftResource: vi.fn(), boardResource: vi.fn(), planningResource: vi.fn(),
  db: { from: (_table: string): any => { throw new Error("route db not set"); } } }));
vi.mock("lib/api/requireApiUser", () => ({ requireApiUser: async () => ({ id: "owner-a" }) }));
vi.mock("lib/integrations/providerSyncAccessServer", () => ({ requireProviderSyncAccess: async () => undefined }));
vi.mock("lib/supabase/server", () => ({ default: { from: (table: string) => mocks.db.from(table) } }));
vi.mock("lib/rosterScheduleData/planning", async (original) => ({ ...await original<typeof import("../../rosterScheduleData/planning")>(), loadPlanningData: mocks.planningData }));
vi.mock("lib/integrations/yahoo/gameContext", async (original) => ({ ...await original<typeof import("./gameContext")>(), resolveYahooGameContext: async () => ({ gameKey: "453", targetSeasonId: 20262027 }), assertYahooLeagueGameContext: () => undefined }));
vi.mock("lib/integrations/yahoo/liveDraft", async (original) => ({ ...await original<typeof import("./liveDraft")>(), parseYahooBoardSettings: mocks.settings }));
vi.mock("lib/integrations/yahoo/providerClient", async (original) => ({ ...await original<typeof import("./providerClient")>(), fetchYahooDraftResource: mocks.draftResource, fetchYahooBoardResource: mocks.boardResource, fetchYahooPlanningResource: mocks.planningResource }));

import { clearYahooReadCaches, currentTodayRoster, todayRosterCache, yahooOwnershipSignature, yahooReadCache, yahooRosterExpiresAt } from "./planningCache";
import { loadYahooPlanningSnapshot } from "./rosterPlanning";
import providerHandler from "../../../pages/api/v1/roster-schedule-optimizer/provider";
import { yahooInferredAcquisitionTiming } from "./starterBoard";
import { compareYahooIdentityMaps, legacyYahooIdentities, RSO_YAHOO_DIET_FLAG, rsoYahooDietEnabled, uniqueVerifiedYahooIdentities, yahooIdentityContextKey } from "./yahooIdentity";
import { claimRsoUpkeepLease, releaseRsoUpkeepLease, rsoUpkeepLeaseKey } from "lib/rosterScheduleOptimizer/upkeepLease";

beforeEach(() => { clearYahooReadCaches(); vi.clearAllMocks(); });
afterEach(() => { vi.unstubAllEnvs(); });

describe("RSO Yahoo diet flag", () => {
  it("is off unless RSO_YAHOO_DIET is exactly 1", () => {
    expect(RSO_YAHOO_DIET_FLAG).toBe("RSO_YAHOO_DIET");
    expect(rsoYahooDietEnabled({} as NodeJS.ProcessEnv)).toBe(false);
    expect(rsoYahooDietEnabled({ RSO_YAHOO_DIET: "true" } as unknown as NodeJS.ProcessEnv)).toBe(false);
    expect(rsoYahooDietEnabled({ RSO_YAHOO_DIET: "1" } as unknown as NodeJS.ProcessEnv)).toBe(true);
  });
});

describe("verified Yahoo identity resolver (D8)", () => {
  it("keeps only pairs unique in both directions for this game", () => {
    const map = uniqueVerifiedYahooIdentities([
      { external_player_id: "453.p.1", fhfh_player_id: 11 },
      { external_player_id: "453.p.2", fhfh_player_id: 12 }, { external_player_id: "453.p.2", fhfh_player_id: 13 },
      { external_player_id: "453.p.4", fhfh_player_id: 14 }, { external_player_id: "453.p.5", fhfh_player_id: 14 },
      { external_player_id: "452.p.6", fhfh_player_id: 16 }, { external_player_id: "7", fhfh_player_id: 17 },
      { external_player_id: "453.p.8", fhfh_player_id: "not-an-id" },
      { external_player_id: "453.p.1", fhfh_player_id: 11 },
    ], "453");
    expect([...map]).toEqual([["453.p.1", "11"], ["453.p.7", "17"]]);
    expect(yahooIdentityContextKey({ gameKey: "465", targetSeasonId: 20262027 })).toBe("yahoo:game:465:season:2026");
  });
  it("reproduces the legacy map rule and compares the two resolvers by counts", () => {
    const players = [{ id: "11", nhlId: 101 }, { id: "12", nhlId: 102 }, { id: "13", nhlId: 103 }];
    const legacy = legacyYahooIdentities([{ nhl_player_id: 101, yahoo_player_id: "453.p.1" }, { nhl_player_id: 102, yahoo_player_id: 2 },
      { nhl_player_id: 103, yahoo_player_id: "453.p.3" }, { nhl_player_id: 103, yahoo_player_id: "453.p.9" }, { nhl_player_id: 999, yahoo_player_id: "453.p.5" }], "453", players);
    expect([...legacy]).toEqual([["453.p.1", "11"], ["453.p.2", "12"]]);
    const verified = new Map([["453.p.1", "11"], ["453.p.2", "13"], ["453.p.3", "13"]]);
    expect(compareYahooIdentityMaps(legacy, verified, ["453.p.1", "453.p.2", "453.p.3", "453.p.4"]))
      .toEqual({ keys: 4, agree: 1, disagree: 1, legacyOnly: 0, verifiedOnly: 1, neither: 1 });
  });
});

describe("Yahoo read caches (D2, D3, D5)", () => {
  it("expires by age and never serves a read from the future", () => {
    const cache = yahooReadCache<string>();
    cache.set("owner|league", "settings", 1000);
    expect(cache.get("owner|league", 500, 1499)?.value).toBe("settings");
    expect(cache.get("owner|league", 500, 1500)).toBeNull();
    expect(cache.get("owner|league", 500, 999)).toBeNull();
    expect(cache.get("other|league", 500, 1200)).toBeNull();
  });
  it("serves today's roster only inside its two-minute window, less provider cache age", () => {
    const read = { payload: {}, transport: { responseDate: "2026-10-01T12:00:00.000Z", ageSeconds: 30 } } as any;
    expect(yahooRosterExpiresAt(read)).toBe(Date.parse("2026-10-01T12:01:30Z"));
    todayRosterCache.set("owner|453.l.1.t.1|2026-10-01", read, Date.parse("2026-10-01T12:00:00Z"));
    expect(currentTodayRoster("owner|453.l.1.t.1|2026-10-01", Date.parse("2026-10-01T12:01:29Z"))).toBe(read);
    expect(currentTodayRoster("owner|453.l.1.t.1|2026-10-01", Date.parse("2026-10-01T12:01:30Z"))).toBeNull();
    expect(currentTodayRoster("intruder|453.l.1.t.1|2026-10-01", Date.parse("2026-10-01T12:00:10Z"))).toBeNull();
    expect(yahooRosterExpiresAt({ payload: {}, transport: { responseDate: "2026-10-01T12:00:00Z", ageSeconds: 61 } } as any)).toBeNull();
  });
  it("signs ownership independent of team and player order", () => {
    expect(yahooOwnershipSignature([{ teamKey: "b", playerKeys: ["2", "1"] }, { teamKey: "a", playerKeys: ["3"] }]))
      .toBe(yahooOwnershipSignature([{ teamKey: "a", playerKeys: ["3"] }, { teamKey: "b", playerKeys: ["1", "2"] }]));
    expect(yahooOwnershipSignature([{ teamKey: "a", playerKeys: ["3"] }])).not.toBe(yahooOwnershipSignature([{ teamKey: "a", playerKeys: ["4"] }]));
  });
});

describe("single-tab upkeep lease (D2)", () => {
  const storage = () => { const values = new Map<string, string>(); return { getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => { values.set(key, value); }, removeItem: (key: string) => { values.delete(key); } } as unknown as Storage; };
  it("lets one tab hold upkeep until it releases or the lease lapses", () => {
    const store = storage(), key = rsoUpkeepLeaseKey("owner", "league");
    expect(claimRsoUpkeepLease(store, key, "tab-a", 0, 1000)).toBe(true);
    expect(claimRsoUpkeepLease(store, key, "tab-b", 500, 1000)).toBe(false);
    expect(claimRsoUpkeepLease(store, key, "tab-a", 600, 1000)).toBe(true);
    expect(claimRsoUpkeepLease(store, key, "tab-b", 1601, 1000)).toBe(true);
    releaseRsoUpkeepLease(store, key, "tab-a");
    expect(claimRsoUpkeepLease(store, key, "tab-a", 1700, 1000)).toBe(false);
    releaseRsoUpkeepLease(store, key, "tab-b");
    expect(claimRsoUpkeepLease(store, key, "tab-a", 1700, 1000)).toBe(true);
  });
  it("fails open without storage", () => {
    const broken = { getItem: () => { throw new Error("blocked"); }, setItem: () => { throw new Error("blocked"); }, removeItem: () => undefined } as unknown as Storage;
    expect(claimRsoUpkeepLease(null, "k", "tab")).toBe(true);
    expect(claimRsoUpkeepLease(broken, "k", "tab")).toBe(true);
  });
});

describe("add timing inferred from Yahoo's weekly deadline (D6)", () => {
  it.each([
    [{ rosterType: "date", weeklyDeadline: "intraday" }, "same_day"],
    [{ rosterType: "date", weeklyDeadline: "tomorrow" }, "next_day"],
    [{ rosterType: null, weeklyDeadline: "intraday" }, "same_day"],
    [{ rosterType: "date", weeklyDeadline: null }, null],
    [{ rosterType: "date", weeklyDeadline: "1" }, null],
    [{ rosterType: "week", weeklyDeadline: "intraday" }, null],
    [{ rosterType: null, weeklyDeadline: null }, null],
  ] as const)("%j → %s", (settings, expected) => {
    expect(yahooInferredAcquisitionTiming(settings)).toBe(expected);
  });
});

describe("provider snapshot cadence with RSO_YAHOO_DIET=1 (D2, D3, D5, D6, D8)", () => {
  const t0 = Date.parse("2026-10-01T12:00:00Z");
  let clock = t0, otherOwned = "453.p.9";
  const transport = () => ({ responseDate: new Date(clock).toISOString(), ageSeconds: 0 });
  const teamNode = (teamKey: string, keys: string[]) => ({ team: [[{ team_key: teamKey }], { roster: { players: { count: keys.length,
    ...Object.fromEntries(keys.map((key, index) => [index, { player: [{ player_key: key }] }])) } } }] });
  const tables: string[] = [];
  const db = { from(table: string) {
    tables.push(table);
    const query: any = { select: () => query, order: () => query, eq: () => query, in: () => query, is: () => query,
      async maybeSingle() { return { data: table === "external_teams"
        ? { id: "team-a", team_metadata: { is_owned: true }, connected_account_id: "account-a", external_league_id: "league-a", external_team_key: "453.l.1.t.1" }
        : { id: "league-a", connected_account_id: "account-a", external_league_key: "453.l.1" }, error: null }; },
      async range() { return { data: table === "fhfh_player_external_identities"
        ? [1, 2, 3, 9].map(id => ({ external_player_id: `453.p.${id}`, fhfh_player_id: id })) : [], error: null }; } };
    return query;
  } } as any;
  const run = (refresh: "auto" | "manual" = "auto") => loadYahooPlanningSnapshot({ db, userId: "owner-a", teamId: "team-a",
    startDate: "2026-10-01", endDate: "2026-10-03", now: new Date(clock), refresh });
  const reads = (result: Awaited<ReturnType<typeof run>>) => Number(/Yahoo reads this snapshot: (\d+)/.exec(result.capabilities.diagnostics?.join(" ") ?? "")?.[1]);

  beforeEach(() => {
    vi.stubEnv("RSO_YAHOO_DIET", "1");
    clock = t0; otherOwned = "453.p.9"; tables.length = 0;
    mocks.planningData.mockImplementation(async () => ({ players: [1, 2, 3, 9].map(id => ({ id: String(id), nhlId: 100 + id, name: `Player ${id}`,
      teamAbbreviation: "TOR", eligiblePositions: ["C"], eligibilityVerified: false, playerClass: "skater", availability: "unknown",
      ownership: null, canDrop: null, holdValue: null, reserveEligibility: [] })), games: [], forecasts: [], evidence: {},
      matchupWeeks: [{ gameKey: "453", week: 1, startDate: "2026-09-28", endDate: "2026-10-04" }] }));
    mocks.settings.mockReturnValue({ rosterType: "date", weeklyDeadline: "intraday", rosterConfig: { C: 1, BN: 1 }, scoringTypeRecognized: true,
      unsupportedStatIds: [], unsupportedRosterSlots: [], leagueType: "points", scoringCategories: { GOALS: 1 }, categoryWeights: {}, minimumGoalieStarts: null });
    mocks.draftResource.mockImplementation(async () => ({ payload: { league_key: "453.l.1", time_zone: "UTC", max_weekly_adds: "4" }, transport: transport() }));
    mocks.boardResource.mockImplementation(async ({ resource }: any) => resource.type === "roster"
      ? { payload: { team_key: "453.l.1.t.1", is_owned_by_current_login: "1", roster: { date: "2026-10-01", coverage_type: "date", is_editable: "1",
        players: { count: 1, 0: { player: [{ player_key: "453.p.1" }, { eligible_positions: { position: "C" } }, { selected_position: { position: "C" } }, { is_editable: "1" }] } } } }, transport: transport() }
      : { payload: { league_key: "453.l.1", teams: { 0: teamNode("453.l.1.t.1", ["453.p.1"]), 1: teamNode("453.l.1.t.2", [otherOwned]) } }, transport: transport() });
    mocks.planningResource.mockImplementation(async ({ resource }: any) => {
      if (resource.type === "scoreboard") return { payload: { league_key: "453.l.1" }, transport: transport() };
      if (resource.type === "league") return { payload: { league: [{ league_key: "453.l.1" }, { current_week: "1" }] }, transport: transport() };
      if (resource.type === "team") return { payload: { team: [{ team_key: "453.l.1.t.1" }, { is_owned_by_current_login: 1 },
        { roster_adds: { coverage_type: "week", coverage_value: "1", value: "1" } }] }, transport: transport() };
      return { payload: { league_key: "453.l.1", players: { count: 2,
        0: { player: [{ player_key: "453.p.2" }, { eligible_positions: { position: "C" } }, { ownership: { ownership_type: "freeagents" } }] },
        1: { player: [{ player_key: "453.p.3" }, { eligible_positions: { position: "C" } }, { ownership: { ownership_type: "waivers" } }] } } }, transport: transport() };
    });
  });

  it("reads only volatile facts on timed upkeep and keeps cached facts current by their own read time", async () => {
    const first = await run();
    expect(reads(first)).toBe(7);
    expect(first.yahooDiet).toBe(true);
    expect(tables).toContain("fhfh_player_external_identities");
    expect(tables).not.toContain("yahoo_nhl_player_map_read");
    expect(first.snapshot.roster).toEqual([{ playerId: "1", position: "active" }]);
    expect(first.snapshot.rules.acquisitionTiming).toBe("same_day");
    expect(first.snapshot.evidence.acquisitionTiming?.source).toBe("Inferred from Yahoo weekly deadline");
    expect(first.capabilities.limitations).toContain("Add timing is inferred from Yahoo's weekly deadline (same-day); change it in League rules if your league differs.");
    expect(first.snapshot.players.find(player => player.id === "2")?.availability).toBe("free_agent");
    expect(first.capabilities).toMatchObject({ availability: true, acquisitions: true });

    clock = t0 + 60_000; // inside today's roster window: only league_rosters
    const second = await run();
    expect(reads(second)).toBe(1);
    expect(second.capabilities).toMatchObject({ roster: true, availability: true, acquisitions: true });
    expect(second.snapshot.players.find(player => player.id === "3")?.availability).toBe("waivers");
    expect(second.snapshot.evidence.availability?.asOf).toBe(new Date(t0).toISOString());
    expect(second.capabilities.diagnostics?.[0]).toContain("availability scan reused");

    clock = t0 + 6 * 60_000; // today's roster expired; scan still reused
    expect(reads(await run())).toBe(2);
    clock = t0 + 16 * 60_000; // scan older than 15 minutes
    expect(reads(await run())).toBe(3);
    clock = t0 + 17 * 60_000; otherOwned = "453.p.3"; // another manager added a player: counter and scan re-read (roster still current)
    const changed = await run();
    expect(reads(changed)).toBe(3);
    expect(changed.snapshot.players.find(player => player.id === "3")?.availability).toBe("rostered");
    clock = t0 + 18 * 60_000; // Refresh provider bypasses every cache
    expect(reads(await run("manual"))).toBe(7);
    clock = t0 + 49 * 60_000; // 31 minutes after the manual read: league facts, roster and scan re-read; settings still cached
    expect(reads(await run())).toBe(6);
    expect(mocks.draftResource).toHaveBeenCalledTimes(2);
  });

  it("reads a stored elapsed day instead of Yahoo and stores a newly read one (D4)", async () => {
    const upserts: any[] = [];
    const stored = { from(table: string) {
      if (table !== "rso_yahoo_past_lineups") return db.from(table);
      const query: any = { select: () => query, eq: () => query, in: () => query,
        then: (resolve: any) => resolve({ data: [{ lineup_date: "2026-09-29", entries: [{ player_key: "453.p.1", position: "C" }] }], error: null }),
        upsert: async (row: unknown, options: unknown) => { upserts.push([row, options]); return { error: null }; } };
      return query;
    } } as any;
    const pastReads: string[] = [];
    const roster = mocks.boardResource.getMockImplementation()!;
    mocks.boardResource.mockImplementation(async (args: any) => {
      if (args.resource.type === "roster" && args.resource.date !== "2026-10-01") {
        pastReads.push(args.resource.date);
        return { payload: { team_key: "453.l.1.t.1", is_owned_by_current_login: "1", roster: { date: args.resource.date, coverage_type: "date",
          players: { count: 1, 0: { player: [{ player_key: "453.p.1" }, { name: { full: "Private Name" } }, { selected_position: { position: "BN" } }] } } } }, transport: transport() };
      }
      return roster(args);
    });
    const result = await loadYahooPlanningSnapshot({ db: stored, userId: "owner-a", teamId: "team-a", startDate: "2026-09-29", endDate: "2026-10-03", now: new Date(clock) });
    expect(pastReads).toEqual(["2026-09-30"]);
    expect(result.snapshot.pastLineups?.map(day => [day.date, day.entries.map(entry => [entry.playerId, entry.position])]))
      .toEqual([["2026-09-29", [["1", "C"]]], ["2026-09-30", [["1", "BN"]]]]);
    expect(upserts).toEqual([[{ user_id: "owner-a", external_team_id: "team-a", season_id: 20262027, lineup_date: "2026-09-30",
      entries: [{ player_key: "453.p.1", position: "BN" }] }, { onConflict: "user_id,external_team_id,lineup_date" }]]);
    expect(JSON.stringify(upserts)).not.toContain("Private Name");
  });

  it.each([null, "1", "weekly"])("leaves add timing unknown and unlabelled when the weekly deadline is %s", async (deadline) => {
    mocks.settings.mockReturnValue({ ...mocks.settings(), weeklyDeadline: deadline });
    const result = await run();
    expect(result.snapshot.rules.acquisitionTiming).toBe("unknown");
    expect(result.snapshot.evidence.acquisitionTiming).toBeUndefined();
    expect(result.capabilities.limitations.join(" ")).toContain("when an add takes effect (same-day or next-day)");
  });

  it("route: Refresh provider bypasses the settings and cadence caches; auto or any other value reuses them", async () => {
    mocks.db = db;
    vi.useFakeTimers({ toFake: ["Date"] });
    try {
      const call = async (refresh?: unknown) => {
        vi.setSystemTime(clock);
        const res: any = { statusCode: 200, body: null, status(code: number) { this.statusCode = code; return this; },
          json(body: unknown) { this.body = body; return this; }, end() { return this; }, setHeader() {} };
        await providerHandler({ method: "POST", headers: {}, body: { provider: "yahoo", teamId: "team-a", startDate: "2026-10-01", endDate: "2026-10-03",
          ...(refresh === undefined ? {} : { refresh }) } } as any, res);
        expect(res.statusCode).toBe(200);
        expect(res.body.yahooDiet).toBe(true);
        return reads(res.body);
      };
      expect(await call()).toBe(7);
      clock = t0 + 60_000; expect(await call("auto")).toBe(1);
      clock = t0 + 70_000; expect(await call("manual")).toBe(7);
      clock = t0 + 80_000; expect(await call("MANUAL")).toBe(1);
      clock = t0 + 90_000; expect(await call({ refresh: "manual" })).toBe(1);
      expect(mocks.draftResource).toHaveBeenCalledTimes(2);
    } finally { vi.useRealTimers(); }
  });

  it("keeps acquisition timing unknown and reads everything when the flag is off", async () => {
    vi.stubEnv("RSO_YAHOO_DIET", "");
    const result = await run();
    expect(result.snapshot.rules.acquisitionTiming).toBe("unknown");
    expect(result.yahooDiet).toBeUndefined();
    expect(tables).toContain("yahoo_nhl_player_map_read");
    clock = t0 + 60_000;
    await run();
    expect(mocks.draftResource).toHaveBeenCalledTimes(2);
    expect(mocks.planningResource).toHaveBeenCalledTimes(8);
  });
});
