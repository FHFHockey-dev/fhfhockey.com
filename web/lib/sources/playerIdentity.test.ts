import { afterEach, describe, expect, it, vi } from "vitest";
import { fetchRosterEntriesByTeam } from "./lineSourceProcessing";
import { fetchPlayerIdentityDirectory, resolvePlayerIdentity, rosterSeasonForDate } from "./playerIdentity";

afterEach(() => vi.unstubAllEnvs());

describe("player identity", () => {
  const players = [
    { playerId: 1, fullName: "Jack Hughes", lastName: "Hughes", teamId: 1 },
    { playerId: 2, fullName: "Luke Hughes", lastName: "Hughes", teamId: 1 },
    { playerId: 3, fullName: "Noah Dower-Nilsson", lastName: "Dower-Nilsson", teamId: 17 },
  ];
  it("does not resolve ambiguous surnames by roster order", () => {
    expect(resolvePlayerIdentity("Hughes", players).status).toBe("ambiguous");
    expect(resolvePlayerIdentity("J. Hughes", players)).toMatchObject({ status: "matched", player: { playerId: 1 } });
  });
  it("preserves compound surnames and distinguishes membership conflicts", () => {
    expect(resolvePlayerIdentity("Dower Nilsson", players)).toMatchObject({ status: "matched", player: { playerId: 3 } });
    expect(resolvePlayerIdentity("Noah Dower Nilsson", players, 1).status).toBe("conflicting_membership");
    expect(resolvePlayerIdentity("Nilsson", players).status).toBe("missing_player");
  });
  it("uses the upcoming roster season in September without changing statistical seasons", () => {
    expect(rosterSeasonForDate("2026-09-18")).toBe(20262027);
    expect(rosterSeasonForDate("2026-06-30")).toBe(20252026);
  });
  it("loads players beyond the first API page", async () => {
    const rows = Array.from({ length: 1001 }, (_, index) => ({ id: index + 1, fullName: `Player ${index}`, lastName: `${index}` }));
    const query: any = { select: () => query, order: () => query, range: (from: number, to: number) => Promise.resolve({ data: rows.slice(from, to + 1), error: null }) };
    expect(await fetchPlayerIdentityDirectory({ from: () => query })).toHaveLength(1001);
  });
  it("normalizes accents and apostrophes but leaves duplicate initials ambiguous", () => {
    expect(resolvePlayerIdentity("Emile O’Connor", [{ playerId: 4, fullName: "Émile O'Connor", lastName: "O'Connor" }])).toMatchObject({ status: "matched", player: { playerId: 4 } });
    expect(resolvePlayerIdentity("J. Hughes", [...players, { playerId: 5, fullName: "Josh Hughes", lastName: "Hughes", teamId: 1 }]).status).toBe("ambiguous");
  });
  it("joins verified registry aliases and current organization evidence without using registry IDs as NHL IDs", async () => {
    vi.stubEnv("TWEET_PIPELINE_INTERPRETATION_ENABLED", "true");
    const tables: Record<string, any[]> = {
      players: [{ id: 8485689, fullName: "Jacob Cloutier", lastName: "Cloutier", team_id: null }],
      fhfh_player_identities: [{ id: 77, nhl_player_id: 8485689, canonical_name: "Jacob Cloutier" }, { id: 88, nhl_player_id: null, canonical_name: "Unlinked Prospect" }],
      fhfh_player_identity_aliases: [...Array.from({ length: 1000 }, (_, i) => ({ fhfh_player_id: i + 100, alias: `Other ${i}` })), { fhfh_player_id: 77, alias: "J. Cloutier" }],
      tweet_player_memberships: [{ player_id: 8485689, team_id: 52, expires_at: "2099-01-01" }, { player_id: 8485689, team_id: 68, expires_at: "2000-01-01" }],
    };
    const supabase = { from: (table: string) => {
      const query: any = { select: () => query, eq: () => query, order: () => query, range: async (from: number, to: number) => ({ data: (tables[table] ?? []).slice(from, to + 1), error: null }) }; return query;
    } };
    const directory = await fetchPlayerIdentityDirectory(supabase);
    expect(directory).toHaveLength(1);
    expect(directory[0]).toMatchObject({ playerId: 8485689, registryId: 77, teamId: 52, aliases: expect.arrayContaining(["J. Cloutier"]) });
    expect(resolvePlayerIdentity("Cloutier", directory, 52).status).toBe("matched");
    tables.tweet_player_memberships.push({ player_id: 8485689, team_id: 68 });
    expect(resolvePlayerIdentity("Cloutier", await fetchPlayerIdentityDirectory(supabase), 52).status).toBe("conflicting_membership");
  });

  it("makes verified prospects available to tweet parsing but rejects conflicting roster evidence", async () => {
    vi.stubEnv("TWEET_PIPELINE_INTERPRETATION_ENABLED", "true");
    const tables: Record<string, any[]> = {
      rosters: [],
      tweet_player_memberships: [{ player_id: 8485689, team_id: 52, expires_at: "2099-01-01", players: { fullName: "Jacob Cloutier", lastName: "Cloutier", position: "R" } }],
      fhfh_player_identities: [{ id: 1, nhl_player_id: 8485689, canonical_name: "Jacob Cloutier" }],
      fhfh_player_identity_aliases: [{ id: 1, fhfh_player_id: 1, alias: "J. Cloutier" }],
    };
    const supabase = { from: (table: string) => {
      const query: any = { select: () => query, eq: () => query, in: () => query, order: () => query, range: async (from: number, to: number) => ({ data: (tables[table] ?? []).slice(from, to + 1), error: null }) }; return query;
    } };
    const roster = await fetchRosterEntriesByTeam({ supabase, teamIds: [52], seasonId: 20262027 });
    expect(resolvePlayerIdentity("Cloutier", roster.get(52)!, 52)).toMatchObject({ status: "matched", player: { playerId: 8485689 } });
    expect(roster.get(52)?.[0]?.aliases).toContain("J. Cloutier");
    tables.rosters.push({ teamId: 68, playerId: 8485689, players: tables.tweet_player_memberships[0].players });
    const conflicting = await fetchRosterEntriesByTeam({ supabase, teamIds: [52, 68], seasonId: 20262027 });
    expect([...(conflicting.get(52) ?? []), ...(conflicting.get(68) ?? [])]).toHaveLength(0);
  });

});
