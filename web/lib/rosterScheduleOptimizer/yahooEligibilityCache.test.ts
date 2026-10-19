import { describe, expect, it } from "vitest";
import { defaultWorkspace, retainedScheduleSnapshot } from "./workspace";
import { readYahooEligibilityCache } from "./yahooEligibilityCache";
import { withCachedYahooEligibility, yahooEligibilityCycle } from "./yahooEligibility";
const now = new Date("2026-10-13T12:00:00Z");
function fixture() {
  const tables: Record<string, any[]> = {
    yahoo_game_keys: [{ game_key: "477", game_id: 477, code: "nhl", season: 2026 }],
    fhfh_player_external_identities: [{ external_player_id: "477.p.4002", fhfh_player_id: 8157, provider: "yahoo", context_key: "yahoo:game:477:season:2026", season_id: 20262027, verification_status: "verified" }],
    fhfh_player_identities: [{ id: 8157, nhl_player_id: 8473512, verification_status: "verified", merged_into_id: null }],
    yahoo_players: [{ player_key: "477.p.4002", player_id: "4002", game_id: 477, season: 2026, eligible_positions: [{ position: "C" }, { position: "LW" }, { position: "RW" }], position_type: "P", last_updated: "2026-10-13 08:40:16.374" }],
  };
  const reads: string[] = [];
  const control = { reverseOwner: null as number | null };
  const db = { from(table: string) {
    reads.push(table); const tests: Array<(row: any) => boolean> = [];
    let reverseLookup = false;
    const query = { abortSignal() { return query; }, select() { return query; }, eq(key: string, value: unknown) { tests.push(row => row[key] === value); return query; },
      is(key: string, value: unknown) { return query.eq(key, value); }, in(key: string, values: unknown[]) { reverseLookup = table === "fhfh_player_external_identities" && key === "external_player_id"; tests.push(row => values.map(String).includes(String(row[key]))); return query; },
      async limit(limit: number) { return { data: structuredClone(tables[table].filter(row => tests.every(test => test(row))).slice(0, limit)
        .map(row => reverseLookup && control.reverseOwner !== null ? { ...row, fhfh_player_id: control.reverseOwner } : row)), error: null }; } };
    return query;
  } };
  return { tables, reads, control, db: db as any, read: () => readYahooEligibilityCache(db as any, 20262027, ["8157"], now) };
}
describe("Yahoo database eligibility cache", () => {
  it("withholds a unique reverse owner reassigned between independently copied forward and reverse reads", async () => {
    const state = fixture(); state.control.reverseOwner = 9711;
    const receipt = await state.read();
    expect(state.tables.fhfh_player_external_identities[0].fhfh_player_id).toBe(8157);
    expect(receipt.players).toEqual([]); expect(receipt.status).toBe("partial");
    expect(receipt.limitations.join(" ")).toContain("identity owners disagree");
  });
  it("uses verified current-context identity and explicit Yahoo positions, independent of provider availability", async () => {
    const state = fixture(), receipt = await state.read();
    expect(receipt.players).toEqual([{ playerId: "8157", nhlId: 8473512, providerId: "477.p.4002", positions: ["C", "LW", "RW"], playerClass: "skater", asOf: "2026-10-13T08:40:16.374Z" }]);
    expect(receipt.expiresAt).toBe("2026-10-14T08:40:00.000Z");
    expect(state.reads).toHaveLength(5);
  });
  it.each(["missing", "stale", "future", "wrong season", "wrong game", "wrong player", "unverified identity", "ambiguous forward", "ambiguous reverse", "missing NHL", "malformed positions", "class conflict"])("does not qualify %s", async reason => {
    const state = fixture(), row = state.tables.yahoo_players[0], identity = state.tables.fhfh_player_external_identities[0];
    if (reason === "missing") state.tables.yahoo_players = [];
    if (reason === "stale") row.last_updated = "2026-10-13 08:39:59.999";
    if (reason === "future") row.last_updated = "2026-10-13 13:00:00";
    if (reason === "wrong season") row.season = 2025;
    if (reason === "wrong game") row.game_id = 465;
    if (reason === "wrong player") row.player_id = "8157";
    if (reason === "unverified identity") identity.verification_status = "pending";
    if (reason === "ambiguous forward") state.tables.fhfh_player_external_identities.push({ ...identity, external_player_id: "477.p.4003" });
    if (reason === "ambiguous reverse") state.tables.fhfh_player_external_identities.push({ ...identity, fhfh_player_id: 9711 });
    if (reason === "missing NHL") state.tables.fhfh_player_identities[0].nhl_player_id = null;
    if (reason === "malformed positions") row.eligible_positions = [{ position: "NHL winger" }];
    if (reason === "class conflict") row.position_type = "G";
    expect((await state.read()).players).toEqual([]);
  });
  it("admits an individually updated player while disclosing missing or failed-update coverage", async () => {
    const state = fixture();
    const result = await readYahooEligibilityCache(state.db, 20262027, ["8157", "9711"], now);
    expect(result.players.map(player => player.playerId)).toEqual(["8157"]);
    expect(result.limitations.join(" ")).toContain("Some cached positions are missing");
    state.tables.yahoo_players[0].last_updated = "2026-10-12 08:40:16.374";
    expect((await state.read()).players).toEqual([]); // An expected job time cannot make yesterday's row fresh.
  });
  it("retains source cycle through midnight, then expires exactly at the next existing scheduled update", () => {
    expect(yahooEligibilityCycle(new Date("2026-10-14T08:39:59Z")).expiresAt).toBe("2026-10-14T08:40:00.000Z");
    expect(yahooEligibilityCycle(new Date("2026-10-14T08:40:00Z")).expiresAt).toBe("2026-10-15T08:40:00.000Z");
  });
  it("improves retained provisional analysis but never replaces live league evidence, roster locks or availability", async () => {
    const receipt = await fixture().read();
    const workspace = defaultWorkspace(now); workspace.context.provider = "yahoo";
    const player = { id: "8157", nhlId: 8473512, nhlTeamId: 9, rosterRevision: "current-membership", name: "Fixture", teamAbbreviation: "OTT", eligiblePositions: ["C"], eligibilityVerified: false, playerClass: "skater" as const, availability: "unknown" as const, canDrop: null, ownership: null, holdValue: null, reserveEligibility: [] };
    workspace.roster = [{ playerId: player.id, position: "active" }]; workspace.manualPlayers = [player];
    const retained = retainedScheduleSnapshot(workspace, { players: [player], games: [], forecasts: [], evidence: {} }, now.toISOString())!;
    const result = withCachedYahooEligibility(retained, receipt, now);
    expect(result.players[0]).toMatchObject({ eligibilityVerified: true, eligiblePositions: ["C", "LW", "RW"], availability: "unknown", canDrop: null });
    expect(result.rules).toBe(retained.rules); expect(result.lockedAssignments).toBe(retained.lockedAssignments);
    expect(result.evidence.roster?.completeness).toBe("partial");
    for (const snapshot of [{ ...retained, id: "yahoo:live" }, { ...retained, context: { ...retained.context, seasonId: 20252026 } }, { ...retained, players: [{ ...player, nhlId: 123 }] }, { ...retained, players: [{ ...player, nhlTeamId: undefined, rosterRevision: undefined }] }])
      expect(withCachedYahooEligibility(snapshot, receipt, now).players[0].eligibilityVerified).toBe(false);
    expect(withCachedYahooEligibility(retained, receipt, new Date(receipt.expiresAt))).toBe(retained);
  });
  it("returns unavailable evidence on database failure without a provider call", async () => {
    const receipt = await readYahooEligibilityCache({ from() { throw new Error("offline"); } } as any, 20262027, ["8157"], now);
    expect(receipt.players).toEqual([]); expect(receipt.limitations.join(" ")).toContain("could not be read");
  });
});
