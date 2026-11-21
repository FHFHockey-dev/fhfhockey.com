// Deterministic synthetic data. No production data or credentials are required.
const assert = require('node:assert/strict');
const fixedTime = '2026-11-18T12:00:00.000Z';
const day = (offset) => new Date(Date.parse(fixedTime) - offset * 86400000).toISOString().slice(0, 10);
const players = [], mappings = [], adp = [];
for (let i = 0; i < 4438; i++) {
  const old = i >= 2420;
  const id = 20000 + (old ? i - 2420 : i);
  const key = (old ? '453' : '480') + '.p.' + id;
  const position = ['C', 'D', 'RW', 'G', 'LW'][i % 5];
  const sign = i < 89 ? 1 : i < 289 ? -1 : 0;
  const count = i % 41 === 0 ? 190 : !sign && i % 9 === 0 ? 0 : !sign && i % 11 === 0 ? 1 : 15;
  const latestAge = old ? 210 : 1;
  const timeline = Array.from({length:count}, (_, idx) => {
    const age = count - 1 - idx;
    return {date:day(age + latestAge), value:50 - sign * (1 + i % 9) * Math.min(5, age) / 2};
  });
  players.push({player_key:key, player_id:id, season:old ? 2025 : 2026, full_name:'Fixture Player ' + i,
    headshot_url:null, display_position:position, editorial_team_full_name:'Ottawa Senators',
    editorial_team_abbreviation:'OTT', eligible_positions:i % 7 === 0 ? [position,'C'] : [position],
    uniform_number:1+i%98, average_draft_pick:100, normalized_ownership_timeline:timeline});
  // The permutation distributes unresolved identities among both movers and flat players.
  if ((i * 97) % 4438 < 2373) mappings.push({yahoo_player_id:key, nhl_player_id:8400000+id});
  if (!old && i < 315) {
    for (let ago = 0; ago <= 13; ago++) adp.push({player_key:key, captured_at:day(ago+1)+'T09:00:00Z',
      average_draft_pick:100 + sign * (1 + i%9) * ago / 3});
  }
}
assert.equal(mappings.length, 2373);

function read(url, headers) {
  const table = url.pathname.split('/').at(-1);
  const params = url.searchParams;
  const select = params.get('select') || '*';
  let rows = {yahoo_players_with_normalized_history: players, yahoo_nhl_player_map_read:mappings,
    yahoo_player_draft_analysis_history:adp}[table];
  assert(rows, 'Unhandled local relation: '+table);
  for (const [key, value] of params) {
    if (['select','order','limit','offset'].includes(key)) continue;
    const [op, ...rest] = value.split('.');
    const operand = rest.join('.');
    if (op === 'in') {
      const allowed = new Set(operand.slice(1,-1).split(',').map(v=>v.replace(/^"|"$/g,'')));
      rows = rows.filter(r=>allowed.has(String(r[key])));
    } else if (op === 'eq') rows = rows.filter(r=>String(r[key]) === operand);
    else if (op === 'gte') rows = rows.filter(r=>r[key] >= operand);
    else if (op === 'gt') rows = rows.filter(r=>Number(r[key]) > Number(operand));
    else throw Error('Unexpected filter '+key+' '+value);
  }
  const order = params.get('order');
  if (order) {
    const keys = order.split(',').map(x=>x.split('.'));
    rows = [...rows].sort((a,b)=>{
      for (const [key,dir] of keys) {
        const diff = a[key] > b[key] ? 1 : a[key] < b[key] ? -1 : 0;
        if (diff) return dir === 'desc' ? -diff : diff;
      }
      return 0;
    });
  }
  const range = headers.range?.split('-').map(Number);
  const from = Number(params.get('offset') || range?.[0] || 0);
  const limit = Number(params.get('limit') || (range ? range[1] - from + 1 : 1000));
  const fields = select.split(',').map(x=>x.trim().split(':'));
  const data = rows.slice(from,from+limit).map(row=>Object.fromEntries(fields.map(([alias,field=alias])=>{
    assert(Object.hasOwn(row, field), 'Unexpected field '+field);
    return [alias,row[field]];
  })));
  const stage = table === 'yahoo_nhl_player_map_read' ? 'mapping' : table === 'yahoo_player_draft_analysis_history'
    ? 'adp-history' : select.includes('normalized_ownership_timeline') ? 'ownership-history' :
      select === 'player_key' ? 'keys' : 'player-metadata';
  return {data,stage};
}
module.exports = {fixedTime,read,players,mappings,adp};
