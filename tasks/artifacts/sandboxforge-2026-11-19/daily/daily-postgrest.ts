import assert from "node:assert/strict";
import { PostgrestClient } from "@supabase/postgrest-js";
import { captureProjectionInputs } from "lib/projections/inputCapture";
import {
  fetchRollingRows,
  ROLLING_ROW_SELECT_CLAUSE,
  SkaterRollingReadIncompleteError,
} from "lib/projections/queries/skater-queries";
import { ROLLING_PLAYER_SUPPORT_PAYLOAD_TABLE } from "lib/supabase/Upserts/rollingPlayerSupportPayload";

type Strength = "ev" | "pp" | "all";
type Phase = "candidate" | "fixed";
const wideTable = "rolling_player_game_metrics";
const cutoff = "2026-11-19";
const historical = { player_id: 8480252, game_date: "2024-01-19", season: 20232024, game_id: null };
const current = { player_id: 7, game_date: "2026-11-17", season: 20262027, game_id: 2026020317 };
const recent = { player_id: 8, game_date: "2026-11-16", season: 20262027, game_id: null };
const strengths = ["ev", "pp", "all"] as const;

function ident(value: string) {
  assert.match(value, /^[a-z][a-z0-9_]*$/);
  return `"${value}"`;
}

function fixtureSql() {
  const identities = ["player_id", "game_id", "game_date", "season", "strength_state"];
  const metrics = ROLLING_ROW_SELECT_CLAUSE.split(",")
    .filter(field => !identities.includes(field))
    .map(field => `${ident(field)} numeric,`)
    .join("\n  ");
  const rows = [current, historical, recent].flatMap(row => strengths.map(strength =>
    `(${row.player_id}, '${row.game_date}', ${row.season}, ${row.game_id ?? "null"}, '${strength}')`));
  return `
create role anon nologin;
create role authenticated nologin;
create role service_role nologin;
create role daily_authenticator login noinherit;
grant service_role to daily_authenticator;
create table public.${ident(wideTable)} (
  player_id bigint not null,
  game_id bigint,
  game_date date not null,
  season integer not null,
  strength_state text not null,
  ${metrics}
  primary key (player_id, game_date, strength_state)
);
create table public.${ident(ROLLING_PLAYER_SUPPORT_PAYLOAD_TABLE)} (
  player_id bigint not null,
  game_id bigint not null,
  game_date date not null,
  season integer not null,
  strength_state text not null,
  payload_schema_version integer not null,
  support_payload jsonb not null,
  updated_at timestamptz not null default now(),
  primary key (player_id, game_date, strength_state)
);
grant usage on schema public to service_role;
grant select on public.${ident(wideTable)}, public.${ident(ROLLING_PLAYER_SUPPORT_PAYLOAD_TABLE)} to service_role;
insert into public.${ident(wideTable)} (player_id, game_date, season, game_id, strength_state) values
  ${rows.join(",\n  ")};
`;
}

async function exercise(phase: Phase, endpoint: string) {
  const url = new URL(endpoint);
  assert.equal(url.hostname, "127.0.0.1");
  assert.equal(url.protocol, "http:");
  assert.equal(url.pathname, "/");
  assert.equal(url.username + url.password + url.search + url.hash, "");
  const requests: Array<{ method: string; path: string; query: string; status: number; count: string | null; rows: unknown }> = [];
  const db = new PostgrestClient(url.origin, {
    fetch: async (input, init) => {
      const target = new URL(input instanceof Request ? input.url : String(input));
      const method = init?.method ?? "GET";
      assert.equal(target.origin, url.origin);
      assert.equal(method, "GET");
      const response = await fetch(input, init);
      const body = await response.clone().json();
      const rows = Array.isArray(body)
        ? body.map(entry => {
          const row = Object.hasOwn(entry, "rolling_row") ? entry.rolling_row : entry;
          return { player_id: entry.player_id, row: row === null ? null : {
            game_id: row.game_id, game_date: row.game_date, strength_state: row.strength_state,
          } };
        })
        : body;
      requests.push({ method, path: target.pathname, query: target.search, status: response.status,
        count: response.headers.get("content-range"), rows });
      return response;
    },
  });
  async function check(strength: Strength, path: "rpc" | "legacy", scenario: "default" | "wide" | "recent") {
    requests.length = 0;
    const player = scenario === "recent" ? recent : historical;
    const ids = [current.player_id, player.player_id];
    const lookbackDays = scenario === "wide" ? 1095 : undefined;
    const read = () => fetchRollingRows(ids, strength, cutoff, db as unknown as Parameters<typeof fetchRollingRows>[3],
      lookbackDays === undefined ? undefined : { lookbackDays });
    let outcome: unknown;
    try {
      const result = path === "rpc"
        ? await read()
        : (await captureProjectionInputs(read, { suppressWrites: true })).result;
      outcome = { status: "complete", rows: result.map(({ player_id, game_id, game_date, strength_state }) =>
        ({ player_id, game_id, game_date, strength_state })) };
    } catch (error) {
      outcome = error instanceof SkaterRollingReadIncompleteError
        ? { status: error.status, reason: error.reason }
        : { status: "unexpected_error", error: String(error) };
    }
    console.log(JSON.stringify({ phase, strength, path, scenario, lookbackDays: lookbackDays ?? 365, outcome, requests }));
    const complete = scenario === "default" && (phase === "fixed" || path === "legacy");
    const expectedOutcome = complete
      ? { status: "complete", rows: [{ player_id: current.player_id, game_id: current.game_id,
        game_date: current.game_date, strength_state: strength }] }
      : { status: "incomplete", reason: "invalid_row" };
    assert.deepEqual(outcome, expectedOutcome);
    const expectedPaths = path === "rpc" ? ["/rpc/forge_latest_rolling_rows"] : [
      `/${wideTable}`, ...(complete ? [`/${ROLLING_PLAYER_SUPPORT_PAYLOAD_TABLE}`] : []),
    ];
    assert.deepEqual(requests.map(request => request.path), expectedPaths);
    assert.ok(requests.every(request => request.status === 200));
    const firstQuery = new URLSearchParams(requests[0].query);
    if (path === "rpc") {
      assert.equal(firstQuery.get("p_before"), cutoff);
    } else {
      const lowerBound = scenario === "wide" ? "2023-11-20" : "2025-11-19";
      assert.deepEqual(firstQuery.getAll("game_date"), [`lt.${cutoff}`, `gt.${lowerBound}`]);
    }
    const expectedSources = path === "rpc" || scenario !== "default" ? [current, player] : [current];
    assert.deepEqual(requests[0].rows, expectedSources.map(row => ({ player_id: row.player_id, row: {
      game_id: row.game_id, game_date: row.game_date, strength_state: strength,
    } })));
  }
  for (const strength of strengths) {
    for (const path of ["rpc", "legacy"] as const) {
      for (const scenario of ["default", "wide", "recent"] as const) {
        await check(strength, path, scenario);
      }
    }
  }
}

const mode = process.argv[2];
if (mode === "schema") process.stdout.write(fixtureSql());
else if (mode === "candidate" || mode === "fixed") await exercise(mode, process.argv[3]);
else throw new Error("Expected schema, candidate, or fixed mode");
