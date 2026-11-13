import React from 'react';

type Row = Record<string, any>;
const players = [
  { id: 1, first: 'Regular', last: 'Center', position: 'C' },
  { id: 2, first: 'Steady', last: 'Wing', position: 'LW' },
  { id: 3, first: 'Returning', last: 'Wing', position: 'RW' },
  { id: 4, first: 'Left', last: 'Defender', position: 'D' },
  { id: 5, first: 'Right', last: 'Defender', position: 'D' },
  { id: 6, first: 'Short', last: 'Substitute', position: 'RW' },
  { id: 7, first: 'Edmonton', last: 'Goalie', position: 'G' },
  { id: 11, first: 'Toronto', last: 'Center', position: 'C' },
  { id: 12, first: 'Toronto', last: 'Wing', position: 'LW' },
  { id: 13, first: 'Toronto', last: 'Forward', position: 'RW' },
  { id: 14, first: 'Toronto', last: 'Left Defender', position: 'D' },
  { id: 15, first: 'Toronto', last: 'Right Defender', position: 'D' },
  { id: 16, first: 'Toronto', last: 'Goalie', position: 'G' },
];
const shifts: Row[] = [];
const games: Row[] = [], manifests: Row[] = [], heads: Row[] = [], raw: Row[] = [], rosters: Row[] = [];
const clock = (seconds: number) => `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
const seconds = (value: string) => Number(value.split(':')[0]) * 60 + Number(value.split(':')[1]);
for (const [index, date] of ['2026-11-03', '2026-11-07', '2026-11-10'].entries()) {
  const gameId = 2026020101 + index, homeTeamId = index === 1 ? 10 : 22, awayTeamId = index === 1 ? 22 : 10;
  const pbpHash = String(index + 1).repeat(64), shiftHash = String(index + 4).repeat(64);
  const inputHash = String(index + 7).repeat(64), relationshipHash = 'a'.repeat(64);
  const pbpId = 100 + index * 2, shiftId = pbpId + 1;
  const ppStart = index === 1 ? 900 : 600, ppEnd = ppStart + 120;
  const substitution = [3000, 2700, 1800][index];
  const byPlayer = new Map<number, Row>();
  for (const [start, end, state, third] of [
    [0, ppStart, 'es', 3], [ppStart, ppEnd, 'pp', 6],
    [ppEnd, substitution, 'es', 3], [substitution, 3600, 'es', 6],
  ] as const) {
    for (let period = 1; period <= 3; period++) {
      const offset = (period - 1) * 1200, from = Math.max(start, offset), to = Math.min(end, offset + 1200);
      if (to <= from) continue;
      for (const [teamId, ids, strength] of [
        [22, [1, 2, third, 4, 5, 7], state],
        [10, state === 'pp' ? [11, 12, 14, 15, 16] : [11, 12, 13, 14, 15, 16], state === 'pp' ? 'pk' : 'es'],
      ] as const) for (const playerId of ids) {
        const p = players.find(player => player.id === playerId)!;
        const isHome = teamId === homeTeamId;
        const row = byPlayer.get(playerId) ?? {
          id: index * 100 + playerId, game_id: gameId, game_type: '2', game_date: date, season_id: 20262027,
          player_id: playerId, player_first_name: p.first, player_last_name: p.last,
          team_id: teamId, team_abbreviation: teamId === 22 ? 'EDM' : 'TOR',
          opponent_team_id: teamId === 22 ? 10 : 22, opponent_team_abbreviation: teamId === 22 ? 'TOR' : 'EDM',
          home_or_away: isHome ? 'home' : 'away', game_toi: '0:00', game_length: '60:00',
          primary_position: p.position, display_position: p.position, player_type: p.position === 'G' ? 'G' : p.position === 'D' ? 'D' : 'F',
          line_combination: null, pairing_combination: null, shifts: [], pp_shifts: [], es_shifts: [],
          time_spent_with: {}, time_spent_with_mixed: {}, total_es_toi: '0:00', total_pp_toi: '0:00', total_pk_toi: '0:00',
        };
        const duration = to - from;
        const segment = { period, shift_number: row.shifts.length + 1, start_time: clock(from - offset), end_time: clock(to - offset), duration: clock(duration), playerId };
        row.shifts.push(segment);
        row[strength === 'pp' ? 'pp_shifts' : 'es_shifts'].push({ ...segment, strength });
        row.game_toi = clock(seconds(row.game_toi) + duration);
        row[`total_${strength}_toi`] = clock(seconds(row[`total_${strength}_toi`]) + duration);
        byPlayer.set(playerId, row);
      }
    }
  }
  const rows = [...byPlayer.values()];
  for (const row of rows) {
    for (const other of rows) {
      if (row.player_id === other.player_id || row.team_id !== other.team_id) continue;
      let shared = 0;
      for (const a of row.shifts) for (const b of other.shifts) if (a.period === b.period) {
        shared += Math.max(0, Math.min(seconds(a.end_time), seconds(b.end_time)) - Math.max(seconds(a.start_time), seconds(b.start_time)));
      }
      (row.player_type === other.player_type ? row.time_spent_with : row.time_spent_with_mixed)[other.player_id] = clock(shared);
    }
    const p = players.find(player => player.id === row.player_id)!;
    rosters.push({ game_id: gameId, player_id: p.id, team_id: row.team_id, position_code: p.position,
      source_play_by_play_hash: pbpHash, first_name: p.first, last_name: p.last, sweater_number: p.id });
  }
  shifts.push(...rows);
  games.push({ id: gameId, date, seasonId: 20262027, type: 2, homeTeamId, awayTeamId });
  manifests.push({ game_id: gameId, input_status: 'complete', input_fingerprint: inputHash, input_version: 3,
    input_materializer_version: 'projection-input-materializer-v3-penalty-clock',
    pbp_raw_payload_id: pbpId, pbp_raw_payload_hash: pbpHash, pbp_raw_snapshot_version: 1,
    shift_raw_payload_id: shiftId, shift_raw_payload_hash: shiftHash, shift_raw_snapshot_version: 1,
    expected_strength_rows: rows.length, observed_strength_rows: rows.length, relationship_status: 'complete',
    relationship_input_fingerprint: inputHash, relationship_fingerprint: relationshipHash, relationship_version: 1,
    relationship_algorithm_version: 'shift_relationship_materializer_v6_strength_segments',
    expected_relationship_rows: rows.length, observed_relationship_rows: rows.length });
  heads.push({ game_id: gameId, endpoint: 'play-by-play', raw_payload_id: pbpId, payload_hash: pbpHash, snapshot_version: 1 },
    { game_id: gameId, endpoint: 'shiftcharts', raw_payload_id: shiftId, payload_hash: shiftHash, snapshot_version: 1 });
  raw.push({ id: pbpId, game_id: gameId, endpoint: 'play-by-play', payload_hash: pbpHash, game_state: 'OFF',
    source_game_id: String(gameId), source_game_type: '2', source_date: date, source_season: '20262027',
    home_id: String(homeTeamId), away_id: String(awayTeamId), final_period: '3', final_period_type: 'REG', time_remaining: '00:00' });
  raw.push({ id: shiftId, game_id: gameId, endpoint: 'shiftcharts', payload_hash: shiftHash });
}
const tables: Record<string, Row[]> = {
  games, projection_game_materialization_status: manifests, nhl_api_game_payload_snapshot_heads: heads,
  nhl_api_game_payloads_raw: raw, nhl_api_game_roster_spots: rosters,
  shift_charts: shifts,
  players: players.map(p => ({ id: p.id, fullName: `${p.first} ${p.last}`, position: p.position, sweater_number: p.id })),
  skatersGameStats: shifts.filter(r => r.player_type !== 'G').map(r => ({ gameId: r.game_id, playerId: r.player_id, created_at: `${r.game_date}T23:00:00Z`,
    goals: 1, assists: 0, points: 1, powerPlayPoints: 0, shots: 2, hits: 1, blockedShots: 0, plusMinus: 0 })),
  goaliesGameStats: shifts.filter(r => r.player_type === 'G').map(r => ({ gameId: r.game_id, playerId: r.player_id,
    created_at: `${r.game_date}T23:00:00Z`, goalsAgainst: 2, saveShotsAgainst: '28/30', toi: '60:00' })),
};

export const blockedServer = { from() { throw new Error('Production server read attempted in isolated fixture'); }, rpc() { throw new Error('Production RPC attempted in isolated fixture'); } };
export function createFixtureDatabase(explicitScenario?: string) { return {
  from(table: string) {
    if (!(table in tables)) throw new Error(`Unexpected fixture table: ${table}`);
    const filters: Array<(row: Row) => boolean> = [];
    const orders: Array<[string, boolean]> = [];
    const query = {
      select() { return query; },
      eq(key: string, value: unknown) { filters.push(row => row[key] === value); return query; },
      gte(key: string, value: any) { filters.push(row => row[key] >= value); return query; },
      lte(key: string, value: any) { filters.push(row => row[key] <= value); return query; },
      in(key: string, values: unknown[]) { filters.push(row => values.includes(row[key])); return query; },
      or(expression: string) {
        const clauses = expression.split(',').map(clause => clause.split('.'));
        filters.push(row => clauses.some(([key, op, value]) => op === 'is' ? row[key] == null : String(row[key]) === value));
        return query;
      },
      order(key: string, options?: { ascending?: boolean }) { orders.push([key, options?.ascending !== false]); return query; },
      async range(from: number, to: number) {
        const scenario = explicitScenario ?? (typeof location === 'undefined' ? '' : new URLSearchParams(location.search).get('scenario'));
        if ((table === 'shift_charts' || table === 'games') && scenario === 'error') return { data: null, error: new Error('Fixture source unavailable') };
        const source = (table === 'shift_charts' || table === 'games') && scenario === 'empty' ? [] : tables[table];
        const rows = structuredClone(source).map(row => scenario === 'unqualified' && table === 'projection_game_materialization_status'
          ? { ...row, relationship_algorithm_version: 'old-version' }
          : scenario === 'partial' && row.game_id === 2026020103
          ? table === 'shift_charts' ? { ...row, game_toi: null, game_length: null }
            : table === 'projection_game_materialization_status' ? { ...row, relationship_status: 'pending' } : row : row)
          .filter(row => filters.every(filter => filter(row)))
          .sort((a, b) => {
            for (const [key, ascending] of orders) {
              if (a[key] !== b[key]) return (a[key] < b[key] ? -1 : 1) * (ascending ? 1 : -1);
            }
            return 0;
          });
        return { data: rows.slice(from, to + 1), error: null };
      },
    };
    return query;
  },
}; }
export const supabase = createFixtureDatabase();

const season = { id: 20262027, startDate: '2026-10-01', regularSeasonEndDate: '2027-04-15', endDate: '2027-06-30' };
export async function fetchCurrentSeason() { return season; }
export async function fetchSeasonById(id: number) {
  if (id !== season.id) throw new Error('Unknown fixture season');
  return season;
}
export function getTeamLogo(team: string) { return `/teamLogos/${team}.png`; }
export function Image({ src, alt, width, height, className }: any) {
  return <img src={typeof src === 'string' ? src : src?.src} alt={alt ?? ''} width={width ?? 32} height={height ?? 32} className={className} />;
}
