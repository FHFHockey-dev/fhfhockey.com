import assert from "node:assert/strict";
import { test } from "node:test";
import type { Client } from "pg";

import { connectionConfig, connectionCount, waitForConnections } from "./rebuild-forge-derived-2026-27";

const env = {
  NEXT_PUBLIC_SUPABASE_URL: "https://testproject.supabase.co",
  SUPABASE_DB_URL: "postgresql://postgres:direct-secret@db.testproject.supabase.co:5432/postgres",
  FORGE_GUARD_DB_URL: "postgresql://postgres.testproject:guard%40secret@aws-0-test.pooler.supabase.com:5432/postgres",
};

function counts(values: unknown[]) {
  const queries: string[] = [];
  const client = { query: async (sql: string) => {
    queries.push(sql);
    const value = values.shift();
    if (value instanceof Error) throw value;
    return { rows: value === undefined ? [] : [{ n: value }] };
  } } as unknown as Pick<Client, "query">;
  return { client, queries };
}

test("guard-only override preserves shared env and uses bounded verified TLS", () => {
  const original = { ...env };
  const config = connectionConfig(env);
  assert.equal(config.host, "aws-0-test.pooler.supabase.com");
  assert.equal(config.user, "postgres.testproject");
  assert.equal(config.password, "guard@secret");
  assert.equal(config.port, 5432);
  assert.deepEqual(config.ssl, { rejectUnauthorized: true });
  assert.equal(config.connectionTimeoutMillis, 10_000);
  assert.equal(config.query_timeout, 10_000);
  assert.equal(config.statement_timeout, 10_000);
  assert.deepEqual(env, original);
});

test("direct URL remains available on networks that support it", () => {
  const config = connectionConfig({ ...env, FORGE_GUARD_DB_URL: undefined });
  assert.equal(config.host, "db.testproject.supabase.co");
  assert.equal(config.user, "postgres");
});

test("missing or invalid override fails closed without falling back or leaking its value", () => {
  assert.throws(() => connectionConfig({ NEXT_PUBLIC_SUPABASE_URL: env.NEXT_PUBLIC_SUPABASE_URL }), /Set FORGE_GUARD_DB_URL/);
  for (const value of ["", "private-credential-not-a-url"]) {
    assert.throws(() => connectionConfig({ ...env, FORGE_GUARD_DB_URL: value }), (error: Error) => {
      assert.ok(!error.message.includes("private-credential"));
      return true;
    });
  }
});

test("rejects wrong project/database, transaction pooler, missing password and URL overrides", () => {
  for (const value of [
    env.FORGE_GUARD_DB_URL.replace("postgres.testproject", "postgres.otherproject"),
    env.SUPABASE_DB_URL.replace("db.testproject", "db.otherproject"),
    env.FORGE_GUARD_DB_URL.replace("5432", "6543"),
    env.FORGE_GUARD_DB_URL.replace("/postgres", "/otherdb"),
    env.FORGE_GUARD_DB_URL.replace(":guard%40secret", ""),
    `${env.FORGE_GUARD_DB_URL}?sslmode=disable`,
    `${env.FORGE_GUARD_DB_URL}?host=other-host`,
  ]) {
    assert.throws(() => connectionConfig({ ...env, FORGE_GUARD_DB_URL: value }), /Guard URL must target/);
  }
});

test("counts PostgreSQL database backends, without filtering idle or guard sessions", async () => {
  const { client, queries } = counts([24]);
  assert.equal(await connectionCount(client), 24);
  assert.deepEqual(queries, ["select count(*)::int as n from pg_catalog.pg_stat_activity where datname = current_database()"]);
});

for (const invalid of [undefined, null, "24", 0, -1, 1.5, NaN, Infinity]) {
  test(`invalid connection count ${String(invalid)} stops the guard`, async () => {
    await assert.rejects(connectionCount(counts([invalid]).client), /Invalid database connection count/);
  });
}

test("40 admits work immediately; 41 waits and samples again", async () => {
  const delays: number[] = [];
  const events: object[] = [];
  await waitForConnections(counts([40]).client, "2026-11-06", async (ms) => { delays.push(ms); });
  assert.equal(delays.length, 0);
  const { client, queries } = counts([41, 42, 40]);
  await waitForConnections(client, "2026-11-06", async (ms) => { delays.push(ms); }, (event) => { events.push(event); });
  assert.deepEqual(delays, [15_000, 15_000]);
  assert.equal(queries.length, 3);
  assert.equal(events.length, 2);
});

test("persistent pressure stops after exactly 20 waits and 21 samples", async () => {
  const { client, queries } = counts(Array(21).fill(41));
  const delays: number[] = [];
  await assert.rejects(waitForConnections(client, "2026-11-06", async (ms) => { delays.push(ms); }, () => {}), /stopping before 2026-11-06/);
  assert.equal(delays.length, 20);
  assert.equal(delays.reduce((sum, ms) => sum + ms, 0), 300_000);
  assert.equal(queries.length, 21);
});

test("query failure stops immediately rather than treating unavailable telemetry as zero", async () => {
  const { client, queries } = counts([new Error("query timeout"), 1]);
  await assert.rejects(waitForConnections(client, "2026-11-06", async () => { assert.fail("must not retry"); }), /query timeout/);
  assert.equal(queries.length, 1);
});
