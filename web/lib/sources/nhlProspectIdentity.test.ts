// @vitest-environment node
import { afterEach, describe, expect, it, vi } from "vitest";
import { fetchNhlDraftClass, fetchNhlPlayerIdentity, previewNhlDraftBatch, importNhlIdentity } from "./nhlProspectIdentity";
import { classifyPopulationProfile, populationAuditCandidates, type PopulationIdentity, type PopulationMembership } from "../player-forecasts/populationAudit";
import { readForecastScopeRows } from "../player-forecasts/scopeReads";
import { guardedPopulationAuditFetch, parsePopulationAuditArgs } from "../../scripts/audit-forecast-population-local";
import type { Player } from "./nhlRosterPreview";
const pick = { draftYear: 2025, firstName: "Jacob", lastName: "Cloutier", playerName: "Jacob Cloutier", playerId: 8485689,
  birthDate: "2007-03-22", position: "RW", height: 70, weight: 171, draftedByTeamId: 52, triCode: "WPG", roundNumber: 7, pickInRound: 28, overallPickNumber: 220, amateurClubName: "Saginaw", amateurLeague: "OHL" };
const profile = { playerId: 8485689, firstName: { default: "Jacob" }, lastName: { default: "Cloutier" }, birthDate: "2007-03-22",
  position: "R", heightInCentimeters: 178, weightInKilograms: 78, currentTeamId: 52, isActive: true };
const response = (data: unknown) => ({ ok: true, json: async () => data });
afterEach(() => vi.unstubAllGlobals());
describe("official NHL prospect coverage", () => {
  it("imports draft identity and history without treating the drafting team as current membership", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => response({ total: 2, data: [pick, { playerName: "FORFEIT", lastName: "Forfeited" }] })));
    const players = await fetchNhlDraftClass(2025);
    expect(players).toHaveLength(1);
    expect(players[0]).toMatchObject({ nhlId: 8485689, fullName: "Jacob Cloutier", currentTeamId: null, position: "R", draft: { year: 2025, overall: 220, teamId: 52 } });
  });
  it("reads all draft pages and rejects repeated pages instead of silently losing players", async () => {
    const rows = Array.from({ length: 101 }, (_, i) => ({ ...pick, overallPickNumber: i + 1 }));
    const fetcher = vi.fn(async (url: string) => response({ total: rows.length, data: rows.slice(Number(new URL(url).searchParams.get("start")), Number(new URL(url).searchParams.get("start")) + 100) }));
    vi.stubGlobal("fetch", fetcher);
    expect(await fetchNhlDraftClass(2025)).toHaveLength(101);
    expect(fetcher).toHaveBeenCalledTimes(2);
    fetcher.mockImplementation(async () => response({ total: 101, data: rows.slice(0, 100) }));
    await expect(fetchNhlDraftClass(2025)).rejects.toThrow("Conflicting");
  });
  it("retains prospects without NHL IDs and compound surnames", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => response({ total: 1, data: [{ ...pick, playerId: null, firstName: "Noah", lastName: "Dower Nilsson" }] })));
    expect((await fetchNhlDraftClass(2025))[0]).toMatchObject({ nhlId: null, lastName: "Dower Nilsson" });
  });
  it("verifies exact IDs and ignores inactive profiles' historical team fields", async () => {
    const fetcher = vi.fn(async () => response({ ...profile, isActive: false }));
    vi.stubGlobal("fetch", fetcher);
    expect((await fetchNhlPlayerIdentity(8485689)).currentTeamId).toBeNull();
    fetcher.mockResolvedValue(response({ ...profile, playerId: 1234567 }));
    await expect(fetchNhlPlayerIdentity(8485689)).rejects.toThrow("did not verify");
    await expect(fetchNhlPlayerIdentity(52)).rejects.toThrow("seven-digit");
  });
  it("keeps missing or malformed NHL activity unknown despite historical NHL appearances", async () => {
    const fetcher = vi.fn();
    vi.stubGlobal("fetch", fetcher);
    for (const isActive of [undefined, null, "true", 1]) {
      fetcher.mockResolvedValue(response({ ...profile, isActive, seasonTotals: [{ leagueAbbrev: "NHL", gamesPlayed: 60 }] }));
      expect(await fetchNhlPlayerIdentity(8485689)).toMatchObject({ nhlActive: null, lifecycleStatus: "review_required", currentTeamId: null });
    }
    fetcher.mockResolvedValue(response({ ...profile, isActive: false }));
    expect(await fetchNhlPlayerIdentity(8485689)).toMatchObject({ nhlActive: false, lifecycleStatus: "inactive", currentTeamId: null });
    fetcher.mockResolvedValue(response({ ...profile, seasonTotals: [{ leagueAbbrev: "NHL", gamesPlayed: 60 }] }));
    expect(await fetchNhlPlayerIdentity(8485689)).toMatchObject({ nhlActive: true, lifecycleStatus: "active_nhl", currentTeamId: 52 });
    expect(fetcher).toHaveBeenCalledWith("https://api-web.nhle.com/v1/player/8485689/landing", expect.objectContaining({
      headers: { Accept: "application/json", "User-Agent": "fhfhockey/1.0 (+https://fhfhockey.com)" },
    }));
  });
  it("uses current profile evidence for a traded prospect and returns a resumable cursor", async () => {
    vi.stubGlobal("fetch", vi.fn(async (url: string) => response(url.includes("records.nhl")
      ? { total: 2, data: [pick, { ...pick, overallPickNumber: 221, playerId: 8485690 }] }
      : { ...profile, currentTeamId: 68 })));
    const report = await previewNhlDraftBatch({ year: 2025, limit: 1 });
    expect(report.nextCursor).toBe(220);
    expect(report.players[0]).toMatchObject({ currentTeamId: 68, draft: { teamId: 52 } });
  });
  it("reports unavailable profiles without inventing current membership", async () => {
    vi.stubGlobal("fetch", vi.fn(async (url: string) => { if (!url.includes("records.nhl")) throw new Error("timeout"); return response({ total: 1, data: [pick] }); }));
    const report = await previewNhlDraftBatch({ year: 2025 });
    expect(report.players[0]?.currentTeamId).toBeNull();
    expect(report.warnings).toEqual([{ nhlId: 8485689, reason: "timeout" }]);
  });
  it("propagates transactional import conflicts", async () => {
    const rpc = vi.fn(async () => ({ error: new Error("Conflicting identity") }));
    await expect(importNhlIdentity({ rpc }, { nhlId: 8485689 } as any)).rejects.toThrow("Conflicting identity");
  });
  it("queues genuine identity conflicts once so one prospect cannot block the rest of a class", async () => {
    const insert = vi.fn(async () => ({ error: null }));
    const query: any = { select: () => query, eq: () => query, in: () => query, maybeSingle: async () => ({ data: null, error: null }), insert };
    const supabase = { rpc: async () => ({ error: { code: "P0001", message: "Conflicting NHL identity mappings" } }), from: () => query };
    const result = await importNhlIdentity(supabase, { nhlId: 8485689, fullName: "Jacob Cloutier", sourceUrl: "https://api-web.nhle.com/v1/player/8485689/landing" } as any);
    expect(result.status).toBe("review");
    expect(insert).toHaveBeenCalledWith(expect.objectContaining({ review_type: "identity_conflict", dedupe_key: "nhl-prospect:8485689" }));
  });

  it("stops on rate limits instead of hammering subsequent profile batches", async () => {
    const fetcher = vi.fn(async (url: string) => url.includes("records.nhl") ? response({ total: 1, data: [pick] }) : { ok: false, status: 429 });
    vi.stubGlobal("fetch", fetcher);
    await expect(previewNhlDraftBatch({ year: 2025 })).rejects.toThrow("resume from the last completed cursor");
    expect(fetcher).toHaveBeenCalledTimes(2);
    fetcher.mockClear();
    const draftOnly = await previewNhlDraftBatch({ year: 2025, profiles: false });
    expect(draftOnly.players[0]?.currentTeamId).toBeNull();
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

});

describe("forecast population audit", () => {
  const identity: PopulationIdentity = { id: 10, nhl_player_id: 8485689, canonical_name: "Jacob Cloutier",
    birth_date: "2007-03-22", lifecycle_status: "active_nhl", verification_status: "verified", merged_into_id: null,
    current_nhl_team_id: 52, updated_at: "2026-10-01T12:00:00Z" };
  const membership: PopulationMembership = { playerId: 8485689, teamId: 52, seasonId: 20262027,
    is_current: true, created_at: "2026-09-01T00:00:00Z" };
  const official = { id: 8485689, teamId: 68, birthDate: "2007-03-22" } as Player;
  const candidates = (overrides: Partial<Parameters<typeof populationAuditCandidates>[0]> = {}) => populationAuditCandidates({
    seasonId: 20262027, active: [identity], excluded: [], memberships: [membership], official: [], ...overrides });

  it("keeps mapped but roster-absent identities in the review population", () => {
    const result = candidates();
    expect(result).toHaveLength(1);
    expect(result[0].reasons).toEqual(["absent_official_roster"]);
    expect(result[0].memberships).toEqual([membership]);
    expect(candidates({ official: [{ ...official, teamId: 52 }] })).toEqual([]);
  });

  it("separates missing/excluded identities, missing memberships and conflicting teams", () => {
    expect(candidates({ active: [], official: [official], memberships: [] })[0].reasons)
      .toEqual(["missing_canonical_identity", "missing_current_membership"]);
    expect(candidates({ active: [], excluded: [{ ...identity, lifecycle_status: "active_prospect" }], official: [official] })[0].reasons)
      .toContain("excluded_from_catalog");
    expect(candidates({ official: [official] })[0].reasons).toContain("roster_membership_disagreement");
    expect(candidates({ official: [official], memberships: [membership, { ...membership, teamId: 68 }] })[0].reasons)
      .toContain("conflicting_current_memberships");
    expect(() => candidates({ memberships: [{ ...membership, seasonId: 20252026 }] })).toThrow("Out-of-scope");
    expect(() => candidates({ active: [{ ...identity, verification_status: "pending" }] })).toThrow("selection");
    expect(() => candidates({ official: [official, { ...official, teamId: 52 }] })).toThrow("conflicting");
  });

  it("retains unknowns and never turns roster absence or active organization evidence into a membership repair", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => response({ ...profile, currentTeamId: 68 })));
    const active = await fetchNhlPlayerIdentity(8485689);
    expect(classifyPopulationProfile(candidates()[0], active)).toMatchObject({
      classification: "active_profile_roster_absent", proposedLifecycle: null, storedTeamIds: [52], profileTeamId: 68,
    });
    expect(classifyPopulationProfile(candidates()[0], null)).toMatchObject({ classification: "profile_unavailable", proposedLifecycle: null });
    expect(classifyPopulationProfile(candidates()[0], { ...active, nhlActive: null })).toMatchObject({ classification: "activity_unknown", proposedLifecycle: null });
    expect(classifyPopulationProfile(candidates()[0], { ...active, nhlActive: false, currentTeamId: null })).toMatchObject({
      classification: "inactive_profile_roster_absent", proposedLifecycle: "inactive", storedTeamIds: [52],
    });
    expect(identity.lifecycle_status).toBe("active_nhl");
    expect(membership.is_current).toBe(true);
  });

  it("requires matching identity, activity and team evidence before proposing a roster-supported correction", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => response({ ...profile, currentTeamId: 68 })));
    const verified = await fetchNhlPlayerIdentity(8485689), candidate = candidates({ official: [official] })[0];
    expect(classifyPopulationProfile(candidate, verified)).toMatchObject({ classification: "roster_supported_correction", proposedLifecycle: "active_nhl" });
    expect(classifyPopulationProfile(candidate, { ...verified, nhlId: 8485690 })).toMatchObject({ classification: "identity_conflict", proposedLifecycle: null });
    expect(classifyPopulationProfile(candidate, { ...verified, birthDate: "2007-03-23" })).toMatchObject({ classification: "identity_conflict", proposedLifecycle: null });
    const missingBirth = candidates({ active: [{ ...identity, birth_date: null }], official: [official] })[0];
    expect(missingBirth.reasons).toContain("birth_date_unverified");
    expect(missingBirth.reasons).not.toContain("birth_date_disagreement");
    expect(classifyPopulationProfile(missingBirth, verified)).toMatchObject({ classification: "birth_date_unverified", proposedLifecycle: null });
    expect(classifyPopulationProfile(candidate, { ...verified, currentTeamId: 52 })).toMatchObject({ classification: "roster_profile_conflict", proposedLifecycle: null });
    expect(classifyPopulationProfile(candidate, { ...verified, nhlActive: false })).toMatchObject({ classification: "roster_profile_conflict", proposedLifecycle: null });
    expect(classifyPopulationProfile({ ...candidate, identities: [{ ...identity, merged_into_id: 99 }] }, verified))
      .toMatchObject({ classification: "canonical_identity_review", proposedLifecycle: null });
    expect(classifyPopulationProfile({ ...candidate, identities: [identity, { ...identity, id: 11 }] }, verified))
      .toMatchObject({ classification: "identity_conflict", proposedLifecycle: null });
  });

  it("completeness-checks composite membership identities under backend page caps", async () => {
    const rows = [membership, { ...membership, teamId: 68 }];
    const build = () => ({ range: (offset: number) => ({ abortSignal: async () => ({ data: rows.slice(offset, offset + 1), count: 2, error: null }) }) });
    const read = () => readForecastScopeRows<PopulationMembership>({ build, key: row => JSON.stringify([row.playerId, row.teamId, row.created_at]),
      maximum: 10, deadlineMs: Date.now() + 1000 });
    expect(await read()).toEqual(rows);
    rows[1] = { ...membership };
    await expect(read()).rejects.toThrow("duplicate");
  });

  it("requires an explicit season/private receipt scope and rejects write or unbounded flags", () => {
    expect(parsePopulationAuditArgs(["--season", "20262027", "--out", "/tmp/private-audit"]))
      .toMatchObject({ seasonId: 20262027, afterProfile: 0, limit: 25 });
    for (const flags of [["--write"], ["--limit", "501"], ["--season", "20262028"], ["--after-profile", "52"]]) {
      const base = flags[0] === "--season" ? ["--out", "/tmp/private-audit"] : ["--season", "20262027", "--out", "/tmp/private-audit"];
      expect(() => parsePopulationAuditArgs([...base, ...flags])).toThrow("Usage");
    }
  });

  const auditRequest = (overrides: Partial<Parameters<typeof guardedPopulationAuditFetch>[0]> = {}) => ({
    input: "https://api-web.nhle.com/v1/player/8485689/landing", origin: "https://db.example", seasonId: 20262027,
    profileIds: new Set([8485689]), deadlineMs: Date.now() + 1000,
    transport: vi.fn(async () => new Response(JSON.stringify(profile))),
    counts: { databaseReads: 0, nhlReads: 0, responseBytes: 0, rateLimited: false }, retain: vi.fn(), ...overrides,
  });

  it("rejects writes, other origins, functions, RPCs, unrequested profiles and leaked source credentials before transport", async () => {
    const transport = vi.fn();
    for (const input of ["https://vercel.example/api/forecast", "https://db.example/rest/v1/rpc/enqueue_forecasts",
      "https://db.example/functions/v1/run", "https://api-web.nhle.com/v1/player/8485690/landing"]) {
      await expect(guardedPopulationAuditFetch(auditRequest({ input, transport }))).rejects.toThrow("read-only scope");
    }
    await expect(guardedPopulationAuditFetch(auditRequest({ transport, init: { method: "POST" } }))).rejects.toThrow("read-only scope");
    await expect(guardedPopulationAuditFetch(auditRequest({ transport, init: { headers: { Authorization: "private" } } }))).rejects.toThrow("private headers");
    expect(transport).not.toHaveBeenCalled();
  });

  it("follows only the same team/season roster redirect and retains exact source content", async () => {
    const content = JSON.stringify({ forwards: [profile], defensemen: [], goalies: [] });
    const transport = vi.fn().mockResolvedValueOnce(new Response(null, { status: 307, headers: { location: "/v1/roster/WPG/20262027" } }))
      .mockResolvedValueOnce(new Response(content));
    const args = auditRequest({ input: "https://api-web.nhle.com/v1/roster/WPG/current", transport });
    expect(await (await guardedPopulationAuditFetch(args)).text()).toBe(content);
    expect(args.counts.nhlReads).toBe(2);
    expect(args.retain).toHaveBeenCalledWith(expect.objectContaining({
      resolvedUrl: "https://api-web.nhle.com/v1/roster/WPG/20262027", sha256: expect.stringMatching(/^[a-f0-9]{64}$/),
    }), content);
    transport.mockReset().mockResolvedValue(new Response(null, { status: 307, headers: { location: "/v1/roster/WPG/20252026" } }));
    await expect(guardedPopulationAuditFetch(auditRequest({ input: args.input, transport }))).rejects.toThrow("changed team or season");
    expect(transport).toHaveBeenCalledTimes(1);
  });

  it("stops NHL work on rate limiting while allowing metadata readback", async () => {
    const args = auditRequest({ transport: vi.fn(async () => new Response("{}", { status: 429 })) });
    expect((await guardedPopulationAuditFetch(args)).status).toBe(429);
    await expect(guardedPopulationAuditFetch(args)).rejects.toThrow("read-only scope");
    expect(args.transport).toHaveBeenCalledTimes(1);
    await guardedPopulationAuditFetch({ ...args, input: "https://db.example/rest/v1/rosters", transport: vi.fn(async () => new Response("[]")) });
    expect(args.counts.databaseReads).toBe(1);
  });

  it("returns on its deadline even when the transport ignores cancellation", async () => {
    const transport = vi.fn<typeof fetch>(() => new Promise<Response>(() => {}));
    const args = auditRequest({ deadlineMs: Date.now() + 20, transport });
    await expect(guardedPopulationAuditFetch(args)).rejects.toThrow("deadline");
    expect(transport.mock.calls[0][1]?.signal?.aborted).toBe(true);
    expect(args.retain).not.toHaveBeenCalled();
  });
});
