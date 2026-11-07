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
  it("breaks a same-team name tie by the slot's position, but not between same-position namesakes", () => {
    const njd = [
      { playerId: 8481559, fullName: "Jack Hughes", lastName: "Hughes", position: "C", teamId: 1 },
      { playerId: 8482684, fullName: "Luke Hughes", lastName: "Hughes", position: "D", teamId: 1 },
    ];
    expect(resolvePlayerIdentity("Hughes", njd, undefined, "es_forward")).toMatchObject({ status: "matched", basis: "surname", player: { playerId: 8481559 } });
    expect(resolvePlayerIdentity("Hughes", njd, undefined, "es_defense")).toMatchObject({ status: "matched", player: { playerId: 8482684 } });
    expect(resolvePlayerIdentity("Hughes", njd, undefined, "goalie").status).toBe("ambiguous");
    const van = [
      { playerId: 8480012, fullName: "Elias Pettersson", lastName: "Pettersson", position: "C", teamId: 23 },
      { playerId: 8483678, fullName: "Elias Pettersson", lastName: "Pettersson", position: "D", teamId: 23 },
    ];
    expect(resolvePlayerIdentity("Elias Pettersson", van).status).toBe("ambiguous");
    expect(resolvePlayerIdentity("Elias Pettersson", van, 23, "es_defense")).toMatchObject({ status: "matched", basis: "full_name", player: { playerId: 8483678 } });
    expect(resolvePlayerIdentity("E. Pettersson", van, undefined, "es_forward")).toMatchObject({ status: "matched", basis: "initial", player: { playerId: 8480012 } });
    const fla = [
      { playerId: 8479314, fullName: "Matthew Tkachuk", lastName: "Tkachuk", position: "L", teamId: 13 },
      { playerId: 8480801, fullName: "Brady Tkachuk", lastName: "Tkachuk", position: "L", teamId: 13 },
    ];
    expect(resolvePlayerIdentity("Tkachuk", fla, undefined, "es_forward").status).toBe("ambiguous");
    expect(resolvePlayerIdentity("M. Tkachuk", fla, undefined, "es_forward")).toMatchObject({ status: "matched", player: { playerId: 8479314 } });
    // Unknown membership or position never lends the slot a tie-break.
    expect(resolvePlayerIdentity("Hughes", njd.map((player) => ({ ...player, teamId: null })), undefined, "es_forward").status).toBe("ambiguous");
    expect(resolvePlayerIdentity("Hughes", [njd[0]!, { ...njd[1]!, position: null }], undefined, "es_forward").status).toBe("ambiguous");
  });
  it("breaks a same-team, same-position tie toward the one candidate on the latest official roster", () => {
    // Alert 2026-11-07: camp leftovers keep is_current, so both namesakes stay on the team (both forwards).
    const fla = [
      { playerId: 8481655, fullName: "Cole Schwindt", lastName: "Schwindt", position: "C", teamId: 13, onOfficialRoster: true },
      { playerId: 8483878, fullName: "Kai Schwindt", lastName: "Schwindt", position: "C", teamId: 13 },
    ];
    expect(resolvePlayerIdentity("Schwindt", fla, undefined, "es_forward")).toMatchObject({ status: "matched", basis: "surname", player: { playerId: 8481655 } });
    expect(resolvePlayerIdentity("Schwindt", fla, 13)).toMatchObject({ status: "matched", player: { playerId: 8481655 } });
    // The written first name still wins over the official roster.
    expect(resolvePlayerIdentity("Kai Schwindt", fla, 13, "es_forward")).toMatchObject({ status: "matched", basis: "full_name", player: { playerId: 8483878 } });
    // Neither or both listed, a different team, or the listed one not fitting the slot: still ambiguous.
    expect(resolvePlayerIdentity("Schwindt", fla.map(({ onOfficialRoster: _listed, ...player }) => player), undefined, "es_forward").status).toBe("ambiguous");
    expect(resolvePlayerIdentity("Schwindt", fla.map((player) => ({ ...player, onOfficialRoster: true })), undefined, "es_forward").status).toBe("ambiguous");
    expect(resolvePlayerIdentity("Schwindt", [fla[0]!, { ...fla[1]!, teamId: 25 }], undefined, "es_forward").status).toBe("ambiguous");
    expect(resolvePlayerIdentity("Schwindt", fla, undefined, "es_defense").status).toBe("ambiguous");
    // Position still settles first: the listed defenceman does not take a forward slot from an unlisted forward.
    const mixed = [{ ...fla[0]!, position: "D" }, fla[1]!];
    expect(resolvePlayerIdentity("Schwindt", mixed, undefined, "es_forward")).toMatchObject({ status: "matched", player: { playerId: 8483878 } });
  });
  it("marks only memberships on the team's latest official refresh, before and after the stamp column exists", async () => {
    const players = (fullName: string, position: string) => ({ fullName, lastName: fullName.split(" ")[1], position });
    const rows: any[] = [
      { teamId: 25, playerId: 8484829, official_seen_at: "2026-11-07T08:00:30Z", players: players("Justin Hryckowian", "C") },
      { teamId: 25, playerId: 8486130, official_seen_at: "2026-11-02T08:00:10Z", players: players("Dylan Hryckowian", "C") },
      { teamId: 25, playerId: 8478449, official_seen_at: "2026-11-07T08:01:00Z", players: players("Roope Hintz", "C") },
      { teamId: 13, playerId: 8481655, official_seen_at: "2026-11-07T08:00:40Z", players: players("Cole Schwindt", "C") },
      { teamId: 13, playerId: 8483878, official_seen_at: null, players: players("Kai Schwindt", "C") },
    ];
    let selected = "";
    const supabase = { from: () => {
      const query: any = { select: (columns: string) => { selected = columns; return query; }, eq: () => query, in: () => query, order: () => query,
        range: async (from: number, to: number) => ({ data: rows.slice(from, to + 1), error: null }) }; return query;
    } };
    const roster = await fetchRosterEntriesByTeam({ supabase, teamIds: [13, 25], seasonId: 20262027 });
    expect(selected.startsWith("*,")).toBe(true);
    expect(roster.get(25)!.filter((entry) => entry.onOfficialRoster).map((entry) => entry.playerId)).toEqual([8484829, 8478449]);
    expect(roster.get(13)!.filter((entry) => entry.onOfficialRoster).map((entry) => entry.playerId)).toEqual([8481655]);
    expect(resolvePlayerIdentity("Hryckowian", roster.get(25)!, undefined, "es_forward")).toMatchObject({ status: "matched", player: { playerId: 8484829 } });
    // Before the column exists (or before the first stamped refresh) nobody is marked and the tie stays.
    for (const row of rows) delete row.official_seen_at;
    const unstamped = await fetchRosterEntriesByTeam({ supabase, teamIds: [25], seasonId: 20262027 });
    expect(unstamped.get(25)!.some((entry) => "onOfficialRoster" in entry)).toBe(false);
    expect(resolvePlayerIdentity("Hryckowian", unstamped.get(25)!, undefined, "es_forward").status).toBe("ambiguous");
  });
  it("applies position-group aliases only in their kind of slot", () => {
    const fla = [
      { playerId: 8479314, fullName: "Matthew Tkachuk", lastName: "Tkachuk", position: "L", teamId: 13 },
      { playerId: 9, fullName: "Gus Forsling", lastName: "Forsling", position: "D", teamId: 13, roleAliases: [{ alias: "Goose", role: "es_defense" as const }] },
    ];
    expect(resolvePlayerIdentity("Goose", fla, undefined, "es_defense")).toMatchObject({ status: "matched", basis: "alias", player: { playerId: 9 } });
    expect(resolvePlayerIdentity("Goose", fla, undefined, "es_forward").status).toBe("missing_player");
    expect(resolvePlayerIdentity("Goose", fla).status).toBe("missing_player");
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
