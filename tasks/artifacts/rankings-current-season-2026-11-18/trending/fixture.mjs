// Deterministic, offline PostgREST read double. Timings include JSON projection
// and a fixed transport model per read. No database or HTTP connection is opened.
export const cutoff = "2026-11-17";
const season = 20262027;
const skaters = 750;
const dates = Array.from({ length: 30 }, (_, d) =>
  new Date(Date.parse(cutoff) - 86400000 * d).toISOString().slice(0, 10),
);
const players = Array.from({ length: skaters }, (_, i) => ({
  id: 8470000 + i,
  fullName: `Skater ${i}`,
  team_id: (i % 32) + 1,
  position: ["C", "LW", "D", "RW"][i % 4],
  image_url: null,
}));
const teams = Array.from({ length: 32 }, (_, i) => ({
  id: i + 1,
  name: `Team ${i + 1}`,
  abbreviation: `T${String(i + 1).padStart(2, "0")}`,
}));
const publishedMetrics = [
  "assists_per_60",
  "blocks_per_60",
  "expected_shooting_percentage",
  "goals_above_expected",
  "goals_per_60",
  "hits_per_60",
  "ixg_per_60",
  "on_ice_gf_percentage",
  "on_ice_xgf_percentage",
  "penalties_taken_per_60",
  "points_per_60",
  "primary_assists_per_60",
  "sax_percentage",
  "shot_attempts_per_60",
  "sog_per_60",
  "unrealized_xg",
  "xga_per_60",
];
const publishedWindows = [
  ["season", 0],
  ["last_5", 5],
  ["last_10", 10],
  ["last_20", 20],
];
const publicationContext = {
  season_id: season,
  strength_state: "5v5",
  snapshot_date: cutoff,
  peer_group_type: "all_skaters",
};
const markers = [
  ...publishedWindows.map(([window_type, window_size]) => ({
    surface: "entity_metric_rankings",
    window_type,
    window_size,
    metric_set: publishedMetrics,
    started_at: cutoff + "T09:00:00Z",
    completed_at: cutoff + "T09:15:00Z",
    methodology_version: "contextual_rankings_v1",
  })),
  {
    surface: "skater_composite_ratings",
    window_type: "season",
    window_size: 0,
    metric_set: [],
    started_at: cutoff + "T09:30:00Z",
    completed_at: cutoff + "T09:45:00Z",
    methodology_version: "contextual_composites_v3",
  },
].map((marker) => ({
  ...publicationContext,
  ...marker,
  peer_group_key: "all",
  status: "complete",
  min_gp: 1,
  min_toi_seconds: 300,
  expected_entities: skaters,
  written_entities: skaters,
  expected_rows: skaters * Math.max(1, marker.metric_set.length),
  db_written_rows: skaters * Math.max(1, marker.metric_set.length),
  updated_at: marker.completed_at,
}));
const composites = players.map((p, i) => ({
  ...publicationContext,
  peer_group_key: "all_skaters",
  window_type: "season",
  window_size: 0,
  player_id: p.id,
  position_group: p.position === "D" ? "D" : "F",
  deployment_bucket: `L${(i % 4) + 1}`,
  updated_at: cutoff + "T09:45:00Z",
  methodology_version: "contextual_composites_v3",
  offense_rating_overall: 95 - (i % 70),
  offense_rating_deployment: 90 - (i % 60),
  defense_rating_overall: 40 + (i % 55),
  defense_rating_deployment: 30 + (i % 60),
  mcm_score: 90 - (i % 70),
  beast_tier: null,
  shoot_first_score: 25 + (i % 50),
  pass_first_score: 75 - (i % 50),
  play_driver_score: 30 + (i % 60),
  results_luck_index: (i % 21) - 10,
}));
function publishedRows(q, table) {
  const rows = table.filter(
    (row) =>
      Object.entries(q.eq).every(([key, value]) => row[key] === value) &&
      Object.entries(q.lte).every(([key, value]) => row[key] <= value) &&
      Object.entries(q.in).every(([key, values]) => values.includes(row[key])),
  );
  if (q.orders.length)
    rows.sort((a, b) => {
      for (const [key, ascending] of q.orders) {
        if (a[key] !== b[key])
          return (a[key] < b[key] ? -1 : 1) * (ascending ? 1 : -1);
      }
      return 0;
    });
  return rows;
}
const datesByPlayer = players.map((_, i) =>
  dates.filter(
    (_, d) =>
      ((i % 32) + d) % 2 === 0 && (i < 660 || d >= 3 + ((i - 660) % 20)),
  ),
);
const idsByDate = new Map(
  dates.map((date) => [
    date,
    players.filter((_, i) => datesByPlayer[i].includes(date)).map((p) => p.id),
  ]),
);
const windows = ["last5", "last10", "last20"];
const metrics = [
  "goals_per_60",
  "ixg_per_60",
  "sog_per_60",
  "shot_attempts_per_60",
];
const perGameToi = (i, n) =>
  720 + (i % 240) + (n === 5 ? (i < 10 ? 93 + i * 27 : (i % 300) - 150) : 0);
function rate(i, n, index = 0) {
  if (i < 10)
    return n === 5 ? 8 - i * 0.12 : n === 20 ? 0.3 + i * 0.02 : 4 - i * 0.1;
  return 0.6 + ((i * (n === 5 ? 73 : 17) + index * 37) % 600) / 100;
}
const roll = new Map(),
  support = new Map();
function dataRow(id, date, fields, strength, isSupport) {
  const i = id - 8470000,
    day = dates.indexOf(date),
    game = 2026020000 + (30 - day) * 16 + ((i % 32) >> 1);
  const key = [id, date, strength, fields].join("|");
  const store = isSupport ? support : roll;
  if (store.has(key)) return store.get(key);
  const values = {
    player_id: id,
    season,
    strength_state: strength,
    team_id: (i % 32) + 1,
    game_date: date,
    updated_at: date + "T10:00:00Z",
    game_id: game,
    line_combo_slot: (i % 4) + 1,
    line_combo_group: i % 4 === 2 ? "defense" : "forward",
    pp_unit: i % 3 === 0 ? 1 : null,
    games_played: 21,
    season_games_played: 21,
    season_participation_games: 21,
  };
  if (isSupport) {
    const supportWindows = Object.fromEntries(
      windows.map((w) => {
        const n = Number(w.slice(4));
        const seconds = n * perGameToi(i, n);
        return [
          w,
          {
            appearances: n,
            gameIds: Array.from({ length: n }, (_, k) => game - k),
            gameDates: Array.from({ length: n }, (_, k) =>
              new Date(Date.parse(date) - k * 2 * 86400000)
                .toISOString()
                .slice(0, 10),
            ),
            ratio: Object.fromEntries(
              metrics.map((m, k) => [
                m,
                [Math.round((rate(i, n, k) * seconds) / 3600), seconds, n],
              ]),
            ),
            secondary: {},
          },
        ];
      }),
    );
    const payload = {
      version: "rolling-player-window-counts-v1",
      strengthState: strength,
      anchor: { gameId: game, gameDate: date, season },
      windows: supportWindows,
      selection: "chronological_appearances_in_strength_state",
      game: { appeared: true, ratio: {}, additive: {} },
    };
    const row = {
      player_id: id,
      game_date: date,
      game_id: game,
      windowCountSupport: payload,
    };
    store.set(key, row);
    return row;
  }
  const row = {};
  for (const field of fields.split(",")) {
    const n = Number(field.match(/last(5|10|20)$/)?.[1]) || 21;
    const perGame = perGameToi(i, n),
      seconds = n * perGame;
    if (field in values) row[field] = values[field];
    else if (field.includes("participation_games")) row[field] = 21;
    else if (field.includes("toi_seconds"))
      row[field] = field.includes("_avg_") ? perGame : seconds;
    else if (field === "points_avg_season")
      row[field] = (skaters - i) / skaters + 0.2;
    else if (field.startsWith("points_total_last"))
      row[field] = Math.round((rate(i, n) * seconds) / 3600);
    else row[field] = rate(i, n, field.length % 5);
  }
  store.set(key, row);
  return row;
}

export const reads = [];
export let observer = () => {};
export function observeReads(callback) {
  observer = callback;
}
const durable = new Map();
function rows(q) {
  const e = q.eq,
    members = q.in;
  if (
    (e.season != null && e.season !== season) ||
    (e.season_id != null && e.season_id !== season)
  )
    return [];
  if (q.table === "teams")
    return teams.filter((p) => !members.id || members.id.includes(p.id));
  if (q.table === "players")
    return players.filter((p) => !members.id || members.id.includes(p.id));
  if (q.table === "games")
    return dates
      .filter((date) => date <= q.lte.date)
      .flatMap((date) => Array.from({ length: 6 }, () => ({ date })));
  if (q.table === "ranking_publications") return publishedRows(q, markers);
  if (q.table === "skater_composite_ratings")
    return publishedRows(q, composites);
  if (q.table === "entity_metric_rankings") {
    if (
      e.entity_type !== "skater" ||
      e.strength_state !== "5v5" ||
      !publishedWindows.some(
        ([type, size]) => e.window_type === type && e.window_size === size,
      ) ||
      (e.snapshot_date != null && e.snapshot_date !== cutoff) ||
      (e.metric_key != null && !publishedMetrics.includes(e.metric_key)) ||
      e.peer_group_type !== "all_skaters" ||
      e.peer_group_key !== "all" ||
      q.lte.snapshot_date < cutoff
    )
      return [];
    if (q.fields === "snapshot_date") return [{ snapshot_date: cutoff }];
    return members.metric_key
      .filter((key) => publishedMetrics.includes(key))
      .sort()
      .flatMap((m) => {
        if (!durable.has(m))
          durable.set(
            m,
            players.map((p, i) => ({
              entity_id: p.id,
              team_id: p.team_id,
              snapshot_date: cutoff,
              metric_key: m,
              peer_group_type: "all_skaters",
              peer_group_key: "all",
              position_group: p.position === "D" ? "D" : "F",
              deployment_bucket: `L${(i % 4) + 1}`,
              raw_value: (750 - i) / 100,
              raw_rank: i + 1,
              percentile: Math.round((1000 * (749 - i)) / 749) / 10,
              qualified_peer_count: skaters,
              minimum_sample_met: true,
              sample_confidence: "high",
              games_played: 21,
              toi_seconds: 18000,
              tags: [],
              explanation_items: [],
              updated_at: cutoff + "T10:00:00Z",
            })),
          );
        return durable.get(m);
      });
  }
  const isSupport = q.table === "rolling_player_metric_support_payloads";
  if (!isSupport && q.table !== "rolling_player_game_metrics")
    throw Error("Unexpected fixture table " + q.table);
  if (q.fields === "game_date")
    return dates
      .filter((date) => date <= q.lte.game_date)
      .map((game_date) => ({ game_date }));
  if (e.player_id != null) {
    const date = datesByPlayer[e.player_id - 8470000].find(
      (d) => d <= (q.lte.game_date ?? e.game_date ?? cutoff),
    );
    return date
      ? [dataRow(e.player_id, date, q.fields, e.strength_state, isSupport)]
      : [];
  }
  if (!e.game_date)
    throw Error("Missing fixture date predicate " + JSON.stringify(q));
  const ids = idsByDate.get(e.game_date) || [];
  return ids
    .filter((id) => !members.player_id || members.player_id.includes(id))
    .map((id) =>
      dataRow(id, e.game_date, q.fields, e.strength_state, isSupport),
    );
}
export function query(table) {
  const q = {
    table,
    eq: {},
    lte: {},
    in: {},
    fields: "",
    orders: [],
    start: 0,
    end: 1000,
    single: false,
  };
  const chain = {
    eq(k, v) {
      q.eq[k] = v;
      return chain;
    },
    lte(k, v) {
      q.lte[k] = v;
      return chain;
    },
    in(k, v) {
      q.in[k] = v;
      return chain;
    },
    order(key, options) {
      q.orders.push([key, options.ascending]);
      return chain;
    },
    select(f) {
      q.fields = f;
      return chain;
    },
    limit(n) {
      q.end = n;
      return chain;
    },
    range(a, b) {
      q.start = a;
      q.end = b + 1;
      return chain;
    },
    maybeSingle() {
      q.single = true;
      return chain;
    },
    async then(ok, bad) {
      try {
        let result = rows(q).slice(q.start, q.end);
        if (
          ["ranking_publications", "skater_composite_ratings"].includes(table)
        ) {
          const fields = q.fields.split(",");
          result = result.map((row) =>
            Object.fromEntries(fields.map((key) => [key, row[key]])),
          );
        }
        const body = JSON.stringify(result),
          bytes = Buffer.byteLength(body);
        const read = { table, rows: result.length, bytes };
        reads.push(read);
        observer(read);
        await new Promise((r) => setTimeout(r, 6 + bytes / 41943)); // 6 ms plus 40 MiB/s per response
        const copy = JSON.parse(body);
        return ok({ data: q.single ? (copy[0] ?? null) : copy, error: null });
      } catch (e) {
        if (bad) return bad(e);
        throw e;
      }
    },
  };
  return chain;
}
