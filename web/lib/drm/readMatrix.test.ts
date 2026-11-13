import { describe, expect, it, vi } from "vitest";
import { readDeploymentMatrix } from "./readMatrix";
import { PROJECTION_INPUT_MATERIALIZER_VERSION } from "lib/projections/ingest/projectionInputPersistence";
import { SHIFT_RELATIONSHIP_ALGORITHM_VERSION } from "lib/projections/relationshipMaterialization";
import type { FetchAggregatedDataRequest } from "components/DateRangeMatrix/fetchAggregatedData";

vi.mock("lib/supabase", () => ({ default: { from() { throw new Error("Unexpected uninjected database"); } } }));
type Row = Record<string, any>;
const pbpHash = "a".repeat(64); const shiftHash = "b".repeat(64);
const request: FetchAggregatedDataRequest = { teamId: 22, seasonId: 20262027, seasonType: "regularSeason", startDate: "2026-11-04", endDate: "2026-11-10" };
const now = new Date("2026-11-12T16:00:00Z");
function game(id = 1001) { return { id, date: "2026-11-05", seasonId: 20262027, type: 2, homeTeamId: 22, awayTeamId: 10 }; }
function sources() {
  const positions = ["C", "L", "R", "D", "D", "G"];
  const rows: Row[] = []; const roster: Row[] = [];
  for (const [teamId, base, abbreviation, opponent] of [[22, 0, "EDM", "TOR"], [10, 10, "TOR", "EDM"]] as const) {
    for (let index = 0; index < 6; index += 1) {
      const playerId = base + index + 1; const role = index < 3 ? "F" : index < 5 ? "D" : "G";
      const segment = { playerId, period: 1, start_time: "0:00", end_time: "1:00", duration: "1:00" };
      const same: Row = {}; const mixed: Row = {};
      for (let partner = 0; partner < 6; partner += 1) if (partner !== index) {
        ((index < 3) === (partner < 3) ? same : mixed)[base + partner + 1] = "1:00";
      }
      rows.push({ id: playerId, game_id: 1001, game_date: "2026-11-05", game_type: "2", season_id: 20262027,
        player_id: playerId, player_first_name: "Historical", player_last_name: `Player${playerId}`, team_id: teamId,
        team_abbreviation: abbreviation, opponent_team_id: teamId === 22 ? 10 : 22, opponent_team_abbreviation: opponent,
        home_or_away: teamId === 22 ? "home" : "away", game_toi: "1:00", game_length: "60:00",
        total_es_toi: "1:00", total_pp_toi: "0:00", total_pk_toi: "0:00", player_type: role,
        primary_position: "C", display_position: "C,RW", line_combination: null, pairing_combination: null,
        time_spent_with: same, time_spent_with_mixed: mixed, shifts: [segment], pp_shifts: [], es_shifts: [{ ...segment, strength: "es" }] });
      roster.push({ game_id: 1001, player_id: playerId, team_id: teamId, position_code: positions[index],
        source_play_by_play_hash: pbpHash, first_name: "Historical", last_name: `Player${playerId}`, sweater_number: playerId });
    }
  }
  const manifest = { game_id: 1001, input_status: "complete", input_fingerprint: "c".repeat(64), input_version: 1,
    input_materializer_version: PROJECTION_INPUT_MATERIALIZER_VERSION, pbp_raw_payload_id: 1, pbp_raw_payload_hash: pbpHash, pbp_raw_snapshot_version: 1,
    shift_raw_payload_id: 2, shift_raw_payload_hash: shiftHash, shift_raw_snapshot_version: 1, expected_strength_rows: 12, observed_strength_rows: 12,
    relationship_status: "complete", relationship_input_fingerprint: "c".repeat(64), relationship_fingerprint: "d".repeat(64), relationship_version: 1,
    relationship_algorithm_version: SHIFT_RELATIONSHIP_ALGORITHM_VERSION, expected_relationship_rows: 12, observed_relationship_rows: 12 };
  return { games: [game()], projection_game_materialization_status: [manifest], nhl_api_game_payload_snapshot_heads: [
    { game_id: 1001, endpoint: "play-by-play", raw_payload_id: 1, payload_hash: pbpHash, snapshot_version: 1 },
    { game_id: 1001, endpoint: "shiftcharts", raw_payload_id: 2, payload_hash: shiftHash, snapshot_version: 1 },
  ], nhl_api_game_payloads_raw: [{ id: 1, game_id: 1001, endpoint: "play-by-play", payload_hash: pbpHash, game_state: "FINAL",
    source_game_id: "1001", source_game_type: "2", source_date: "2026-11-05", source_season: "20262027", home_id: "22", away_id: "10",
    final_period: "3", final_period_type: "REG", time_remaining: "00:00" }], shift_charts: rows, nhl_api_game_roster_spots: roster };
}
function database(tables: ReturnType<typeof sources>, after?: (table: string, visit: number, rows: Row[]) => Row[]) {
  const calls: Array<{ table: string; select?: string; filters: unknown[] }> = []; const visits: Record<string, number> = {};
  const from = vi.fn((table: string) => {
    const log = { table, filters: [] as unknown[], select: undefined as string | undefined }; calls.push(log);
    const filters: Array<(row: Row) => boolean> = []; const order: Array<{ field: string; ascending: boolean }> = [];
    const query = {
      select(fields: string) { log.select = fields; return query; },
      eq(field: string, value: unknown) { log.filters.push(["eq", field, value]); filters.push(row => row[field] === value); return query; },
      in(field: string, values: unknown[]) { log.filters.push(["in", field, values]); filters.push(row => values.includes(row[field])); return query; },
      gte(field: string, value: any) { filters.push(row => row[field] >= value); return query; },
      lte(field: string, value: any) { filters.push(row => row[field] <= value); return query; },
      or(expression: string) { filters.push(row => expression.split(",").some(part => { const [field, , value] = part.split("."); return row[field] === Number(value); })); return query; },
      order(field: string, options: { ascending: boolean }) { order.push({ field, ascending: options.ascending }); return query; },
      async range(first: number, last: number) {
        const visit = visits[table] = (visits[table] ?? 0) + 1;
        const original = (tables as Record<string, Row[]>)[table] ?? [];
        let rows = structuredClone(original);
        if (after) rows = after(table, visit, rows);
        rows = rows.filter(row => filters.every(predicate => predicate(row)));
        rows.sort((a, b) => { for (const entry of order) { const cmp = a[entry.field] < b[entry.field] ? -1 : a[entry.field] > b[entry.field] ? 1 : 0; if (cmp) return entry.ascending ? cmp : -cmp; } return 0; });
        return { data: rows.slice(first, last + 1), error: null };
      },
    };
    return query;
  });
  return { from, calls };
}

function zeroParticipationSources() {
  const tables = sources();
  tables.nhl_api_game_roster_spots.push({ ...tables.nhl_api_game_roster_spots[0], player_id: 99, sweater_number: 99 });
  const playerStats: Row = {};
  for (const [side, teamId] of [["homeTeam", 22], ["awayTeam", 10]] as const) {
    playerStats[side] = { forwards: [], defense: [], goalies: [] };
    for (const member of tables.nhl_api_game_roster_spots.filter(row => row.team_id === teamId)) {
      const group = member.position_code === "G" ? "goalies" : member.position_code === "D" ? "defense" : "forwards";
      playerStats[side][group].push({ playerId: member.player_id, position: member.position_code, sweaterNumber: member.sweater_number,
        toi: member.player_id === 99 ? "00:00" : "01:00", shifts: member.player_id === 99 ? 0 : 1,
        goals: 0, assists: 0, points: 0, sog: 0, hits: 0, blockedShots: 0, takeaways: 0, giveaways: 0 });
    }
  }
  const boxscore: Row = { id: 3, game_id: 1001, endpoint: "boxscore", payload_hash: "e".repeat(64), game_state: "OFF",
    source_game_id: "1001", source_game_type: "2", source_date: "2026-11-05", source_season: "20262027",
    home_id: "22", away_id: "10", player_stats: playerStats };
  tables.nhl_api_game_payload_snapshot_heads.push({ game_id: 1001, endpoint: "boxscore", raw_payload_id: 3,
    payload_hash: boxscore.payload_hash, snapshot_version: 1 });
  (tables.nhl_api_game_payloads_raw as Row[]).push(boxscore);
  return { tables, boxscore, player: playerStats.homeTeam.forwards.find((row: Row) => row.playerId === 99) as Row };
}

describe("qualified deployment matrix reader", () => {
  it("uses historical roster roles and qualified interval pairs; zero PP remains known zero", async () => {
    const db = database(sources()); const result = await readDeploymentMatrix(db, request, now);
    expect(result.matchedGameIds).toEqual([1001]);
    expect(result.coverage).toMatchObject({ scheduledGames: 1, acceptedGames: 1, knownFinalGames: 1, skippedRows: 0 });
    expect(result.byStrength.all[2]).toMatchObject({ primaryPosition: "LW", displayPosition: "LW", teamId: 22, playerType: "F" });
    expect(result.byStrength.all[1].regularSeasonData).toMatchObject({ GP: 1, totalTOI: 60, gamesPlayed: [1001], percentToiWith: { 2: 100 } });
    expect(result.byStrength.pp[1].regularSeasonData).toMatchObject({ GP: 1, totalTOI: 0, percentToiWith: {} });
    expect(result.units.find(unit => unit.kind === "forward_line")?.playerIds).toEqual([1, 2, 3]);
    expect(db.calls.some(call => call.table === "players")).toBe(false);
    expect(db.calls.find(call => call.table === "nhl_api_game_payloads_raw")?.select).toContain("final_period:payload->periodDescriptor->>number");
    expect(db.calls.some(call => call.select?.includes("player_stats"))).toBe(false);
  });

  it("accepts explicit final-boxscore nonparticipation without inventing a shift row or appearance", async () => {
    const { tables } = zeroParticipationSources();
    const result = await readDeploymentMatrix(database(tables), request, now);
    expect(result.matchedGameIds).toEqual([1001]);
    expect(result.coverage.games[0]).toMatchObject({ state: "accepted", verifiedZeroToiPlayers: [99] });
    expect(result.byStrength.all[99]).toBeUndefined();
    expect(result.byStrength.all[1].regularSeasonData).toMatchObject({ GP: 1, totalTOI: 60, gamesPlayed: [1001] });
    expect(result.units.every(unit => !unit.playerIds.includes(99))).toBe(true);
  });

  it.each(["missing proof", "not final", "wrong game", "wrong date", "wrong season", "wrong team", "wrong position", "wrong sweater",
    "duplicate player", "truncated roster", "positive TOI", "absent TOI", "positive shifts", "absent shifts", "positive event stat", "wrong hash", "changed head"])
  ("keeps an absent roster skater unknown when zero-participation proof has %s", async reason => {
    const { tables, boxscore, player } = zeroParticipationSources();
    if (reason === "missing proof") tables.nhl_api_game_payloads_raw = tables.nhl_api_game_payloads_raw.filter(row => row.id !== 3);
    if (reason === "not final") boxscore.game_state = "LIVE";
    if (reason === "wrong game") boxscore.source_game_id = "1002";
    if (reason === "wrong date") boxscore.source_date = "2026-11-06";
    if (reason === "wrong season") boxscore.source_season = "20252026";
    if (reason === "wrong team") boxscore.home_id = "10";
    if (reason === "wrong position") player.position = "D";
    if (reason === "wrong sweater") player.sweaterNumber = 98;
    if (reason === "duplicate player") boxscore.player_stats.awayTeam.forwards.push({ ...player });
    if (reason === "truncated roster") boxscore.player_stats.homeTeam.forwards.shift();
    if (reason === "positive TOI") player.toi = "00:01";
    if (reason === "absent TOI") delete player.toi;
    if (reason === "positive shifts") player.shifts = 1;
    if (reason === "absent shifts") delete player.shifts;
    if (reason === "positive event stat") player.sog = 1;
    if (reason === "wrong hash") boxscore.payload_hash = "f".repeat(64);
    const db = database(tables, (table, visit, rows) => {
      if (reason === "changed head" && table === "nhl_api_game_payload_snapshot_heads" && visit === 4)
        rows.find(row => row.endpoint === "boxscore")!.snapshot_version++;
      return rows;
    });
    const result = await readDeploymentMatrix(db, request, now);
    expect(result.matchedGameIds).toEqual([]);
    expect(result.coverage.games[0]).toMatchObject({ state: "invalid" });
    expect(result.byStrength.all).toEqual({});
  });

  it("keeps a wholly missing scheduled final game visibly excluded instead of shrinking the scope", async () => {
    const tables = sources(); tables.games.push(game(1002));
    const result = await readDeploymentMatrix(database(tables), request, now);
    expect(result.coverage).toMatchObject({ scheduledGames: 2, acceptedGames: 1 });
    expect(result.coverage.games.find(entry => entry.gameId === 1002)).toMatchObject({ state: "unverified" });
    expect(result.byStrength.all[1].regularSeasonData.GP).toBe(1);
  });

  it("reports retained final games with absent materializations as missing", async () => {
    const tables = sources(); tables.projection_game_materialization_status = [];
    const result = await readDeploymentMatrix(database(tables), request, now);
    expect(result.coverage).toMatchObject({ knownFinalGames: 1, acceptedGames: 0 });
    expect(result.coverage.games[0].state).toBe("missing");
  });

  it.each(["old relationship", "old inputs", "source head mismatch", "changed generation", "changed head"])("excludes %s", async reason => {
    const tables = sources();
    if (reason === "old relationship") tables.projection_game_materialization_status[0].relationship_algorithm_version = "old";
    if (reason === "old inputs") tables.projection_game_materialization_status[0].input_materializer_version = "old";
    if (reason === "source head mismatch") tables.nhl_api_game_payload_snapshot_heads[1].payload_hash = "e".repeat(64);
    const db = database(tables, (table, visit, rows) => {
      if (visit === 2 && table === "projection_game_materialization_status" && reason === "changed generation") rows[0].relationship_version++;
      if (visit === 2 && table === "nhl_api_game_payload_snapshot_heads" && reason === "changed head") rows[0].snapshot_version++;
      return rows;
    });
    const result = await readDeploymentMatrix(db, request, now);
    expect(result.matchedGameIds).toEqual([]);
    expect(result.byStrength.pp).toEqual({}); // Unknown is not a fabricated zero-strength player.
    expect(result.coverage.games[0].state).toBe("stale");
  });

  it.each(["roster trade", "roster hash", "missing roster skater", "pair disagreement", "truncated OT", "metadata"])("rejects conflicting %s evidence", async reason => {
    const tables = sources();
    if (reason === "roster trade") tables.nhl_api_game_roster_spots[0].team_id = 10;
    if (reason === "roster hash") tables.nhl_api_game_roster_spots[0].source_play_by_play_hash = "e".repeat(64);
    if (reason === "missing roster skater") tables.nhl_api_game_roster_spots.push({ ...tables.nhl_api_game_roster_spots[0], player_id: 99 });
    if (reason === "pair disagreement") { tables.shift_charts[0].time_spent_with[2] = "0:59"; tables.shift_charts[1].time_spent_with[1] = "0:59"; }
    if (reason === "truncated OT") Object.assign(tables.nhl_api_game_payloads_raw[0], { final_period: "4", final_period_type: "OT", time_remaining: "04:30" });
    if (reason === "metadata") tables.nhl_api_game_roster_spots[0].sweater_number = -1;
    const result = await readDeploymentMatrix(database(tables), request, now);
    expect(result.matchedGameIds).toEqual([]);
    expect(result.coverage.games[0].state).toBe("invalid");
    expect(result.units).toEqual([]);
  });

  it("applies venue/opponent queries together, and rejects malformed selection before reads", async () => {
    const db = database(sources());
    const result = await readDeploymentMatrix(db, { ...request, homeOrAway: "away", opponentTeamAbbreviation: "tor" }, now);
    expect(result.coverage.scheduledGames).toBe(0);
    await expect(readDeploymentMatrix(db, { ...request, startDate: "2026-02-29" }, now)).rejects.toThrow(/inclusive date range/);
  });
});
