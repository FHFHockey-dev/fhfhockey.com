/**
 * G2 real-data dry run of the FORGE H1–H10 shadow on a disposable local PostgreSQL. Its inputs are the TJ-approved
 * bounded read (CSV results, manifest-verified) and the public NHL API observations saved beside them. It issues
 * nothing anywhere else, and it is not an issuance approval.
 *
 *   LC_ALL=en_US.UTF-8 FORGE_V2_POSTGRES_BIN=/opt/homebrew/opt/postgresql@17/bin NODE_PATH=. npx ts-node --transpile-only \
 *     --compiler-options '{"module":"commonjs","moduleResolution":"node"}' scripts/forge-h10-real-dry-run.ts <packet-dir> <out.json>
 */
import { execFile } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { promisify } from "node:util";
import { performance } from "node:perf_hooks";
import { gzipSync } from "node:zlib";
import { Pool } from "pg";
import { buildDenominator, measureCoverage, MembershipEvidence } from "../lib/forge-v2/denominator";
import { readbackH10Goalies, runH10GoalieIssuance } from "../lib/forge-v2/h10GoalieProducer.server";
import { contentHash } from "../lib/forge-v2/hash.server";
import { PostgresHistoryStore, SqlConnection } from "../lib/forge-v2/history.server";
import { h10InputsFromRows, H10InputRows } from "../lib/forge-v2/h10Reader.server";
import { readbackH10, runH10Issuance } from "../lib/forge-v2/h10Producer.server";
import { h10DenominatorGuard } from "../lib/forge-v2/h10Route.server";
import { parseReceiptKeys } from "../lib/forge-v2/denominatorReceipts";
import { moveEvidence, officialMoves, parseOfficialRoster } from "../lib/forge-v2/h10News";
import { resolveMembership } from "../lib/forge-v2/denominator";
import { clubAbbrev } from "../lib/forge-v2/h10NewsRoute.server";
import { realRows, verified } from "./forge-h10-real-inputs";

const exec = promisify(execFile);
const [packet, out] = process.argv.slice(2), bin = process.env.FORGE_V2_POSTGRES_BIN;
if (!packet || !out || !bin) throw new Error("usage: <packet-dir> <out.json> with FORGE_V2_POSTGRES_BIN");
const ASOF = "2026-11-23T17:20:00.000Z", SEASON = 20262027;

async function main() {
  const nhl = verified(join(packet!, "nhl-public-20261123")), rows = realRows(packet!);
  const inputs = h10InputsFromRows(rows, { asOf: ASOF, seasonId: SEASON, logIngestUtcMinute: 450, gameHours: 3.5, rosterMaxAgeHours: 36 });
  // Official NHL observations (public API, read locally): each player's current club, first observed at the fetch time.
  const fetchedAt = new Date(readFileSync(join(packet!, "nhl-public-20261123", "fetched_at.txt"), "utf8").trim()).toISOString();
  const official: MembershipEvidence[] = [8477946, 8481523, 8478470].map(playerId => {
    const body = JSON.parse(nhl(`player_${playerId}_landing.json`)), payload = { playerId, currentTeamId: body.currentTeamId, position: body.position };
    return { playerId, teamId: body.currentTeamId, position: body.position === "G" ? "G" : body.position === "D" ? "D" : "F", status: "roster", effectiveAt: fetchedAt,
      revision: `nhl-landing:${playerId}:${fetchedAt}`, kind: "official_transaction", transactionType: "trade", supersedesRevision: null,
      source: { id: `api-web.nhle.com/v1/player/${playerId}/landing`, revision: contentHash(payload).slice(0, 16), sha256: contentHash(payload), source: "api-web.nhle.com", use: "approved", observedAt: fetchedAt, publishedAt: null, firstReceivedAt: fetchedAt } };
  });
  const rostersOnly = buildDenominator({ evidence: inputs.evidence, schedule: inputs.schedule, asOf: ASOF, seasonId: SEASON, scheduleComplete: true, evidenceClass: "prospective_shadow" });
  const withOfficial = buildDenominator({ evidence: [...inputs.evidence, ...official], schedule: inputs.schedule, asOf: ASOF, seasonId: SEASON, scheduleComplete: true, evidenceClass: "prospective_shadow" });
  const astra = parseReceiptKeys(readFileSync(resolve(packet!, "../astra-audit-receipts/trade-reconciled-keys.csv"), "utf8"));
  const astraKeys = new Set(astra.map(r => `${r.playerId}:${r.teamId}`)), compare = (d: typeof rostersOnly) => {
    const players = new Map(d.keys.map(k => [k.playerId, k.teamId]));
    return { players: players.size, keys: d.keys.length, astraPlayersMatched: [...players].filter(([p, t]) => astraKeys.has(`${p}:${t}`)).length,
      astraPlayersMissing: [...new Set(astra.map(r => r.playerId))].filter(p => !players.has(p)).length,
      traded: Object.fromEntries([8477946, 8481523, 8478470].map(p => [p, players.get(p) ?? d.unresolved.find(u => u.playerId === p)?.reason ?? "absent"])) };
  };
  const report: Record<string, unknown> = {
    version: "forge-h10-real-dry-run-v2", asOf: ASOF, inputs: { games: rows.games.length, rosters: rows.rosters.length, logs: rows.logs.length, goalieLines: rows.goalieLogs!.length, mapped: { schedule: inputs.schedule.length, evidence: inputs.evidence.length, logs: inputs.logs.length, goalieLogs: inputs.goalieLogs.length }, dropped: inputs.dropped },
    rostersOnly: { sha: rostersOnly.denominatorSha256, counts: rostersOnly.counts.byClass, guard: h10DenominatorGuard(rostersOnly, null, 700), unresolved: rostersOnly.counts.unresolved, unresolvedReasons: Object.fromEntries([...new Set(rostersOnly.unresolved.map(u => u.reason))].map(r => [r, rostersOnly.unresolved.filter(u => u.reason === r).length])), vsAstra: compare(rostersOnly) },
    exactKeysVsAstra: (() => {
      const mine = new Set(withOfficial.keys.map(k => `${k.playerId}:${k.gameId}:${k.teamId}:${k.horizon}`)), theirs = new Set(astra.map(r => `${r.playerId}:${r.gameId}:${r.teamId}:${r.horizon}`));
      const onlyMine = [...mine].filter(k => !theirs.has(k)), onlyTheirs = [...theirs].filter(k => !mine.has(k));
      return { mine: mine.size, astra: theirs.size, identical: onlyMine.length === 0 && onlyTheirs.length === 0, onlyMine: onlyMine.slice(0, 20), onlyAstra: onlyTheirs.slice(0, 20), onlyMineCount: onlyMine.length, onlyAstraCount: onlyTheirs.length };
    })(),
    withOfficialNhl: { sha: withOfficial.denominatorSha256, counts: withOfficial.counts.byClass, guard: h10DenominatorGuard(withOfficial, null, 700), conflicts: withOfficial.conflicts, vsAstra: compare(withOfficial), byHorizon: withOfficial.counts.byHorizon },
  };
  // The route's nightly official read on real data: all 32 official season rosters (public API, fetched locally and
  // hashed), turned into official moves against the rosters-only membership exactly as the route does.
  const sweepDir = join(packet!, "nhl-public-rosters-20261123"), sweep = verified(sweepDir);
  const sweepAt = new Date(readFileSync(join(sweepDir, "fetched_at.txt"), "utf8").trim().split("\n")[1]).toISOString();
  const clubs = [...new Set(inputs.schedule.flatMap(g => [g.homeTeamId, g.awayTeamId]))].sort((a, b) => a - b);
  const officialRosters = clubs.map(teamId => parseOfficialRoster(JSON.parse(sweep(`roster_${clubAbbrev(teamId)}_20262027.json`)), teamId, clubAbbrev(teamId)!, sweepAt));
  const current = new Map(resolveMembership(inputs.evidence, sweepAt).members.map(m => [m.affiliation.playerId, m.affiliation.teamId as number]));
  const moves = officialMoves(officialRosters, current, [], true); // complete read of all 32 clubs, as the nightly route does
  const swept = buildDenominator({ evidence: [...inputs.evidence, ...moves.map(moveEvidence)], schedule: inputs.schedule, asOf: sweepAt, seasonId: SEASON, scheduleComplete: true, evidenceClass: "prospective_shadow" });
  const rawTeam = new Map(rows.rosters.map(r => [Number(r.player_id), r.team_id]));
  const sweptKeys = new Set(swept.keys.map(k => `${k.playerId}:${k.gameId}:${k.teamId}:${k.horizon}`)), astraKeys4 = new Set(astra.map(r => `${r.playerId}:${r.gameId}:${r.teamId}:${r.horizon}`));
  // Keys are compared on games still ahead of both cutoffs; the sweep ran later, so its ten games can start later.
  const sweptPlayers = new Map(swept.keys.map(k => [k.playerId, k.teamId])), astraPlayers = new Map(astra.map(r => [r.playerId, r.teamId]));
  report.routeNightlySweep = {
    sweepAt, clubs: officialRosters.length, officialPlayers: officialRosters.reduce((n, r) => n + r.players.length, 0),
    moves: { total: moves.length, clubChange: moves.filter(m => m.fromTeamId !== null && m.toTeamId !== null).length,
      verifiedUnstampedSameClub: moves.filter(m => m.fromTeamId === null && rawTeam.get(m.playerId) === m.toTeamId).length,
      notInRosters: moves.filter(m => m.fromTeamId === null && !rawTeam.has(m.playerId)).length,
      unstampedOtherClub: moves.filter(m => m.fromTeamId === null && rawTeam.has(m.playerId) && rawTeam.get(m.playerId) !== m.toTeamId).length,
      departures: moves.filter(m => m.toTeamId === null).map(m => ({ playerId: m.playerId, from: m.fromTeamId })),
      trio: Object.fromEntries([8477946, 8481523, 8478470].map(p => [p, moves.find(m => m.playerId === p) ?? null])) },
    denominator: { sha: swept.denominatorSha256, counts: swept.counts.byClass, players: sweptPlayers.size, unresolved: swept.counts.unresolved, conflicts: swept.conflicts.length,
      guard: h10DenominatorGuard(swept, withOfficial, 700) },
    vsAstraPlayers: { same: [...sweptPlayers].filter(([p, t]) => astraPlayers.get(p) === t).length, onlySwept: [...sweptPlayers.keys()].filter(p => !astraPlayers.has(p)).length,
      onlyAstra: [...astraPlayers.keys()].filter(p => !sweptPlayers.has(p)).length, differentClub: [...sweptPlayers].filter(([p, t]) => astraPlayers.has(p) && astraPlayers.get(p) !== t).length },
    exactKeysVsAstra: { swept: sweptKeys.size, astra: astraKeys4.size, common: [...sweptKeys].filter(k => astraKeys4.has(k)).length },
  };
  // Issue the official-overlay denominator on a disposable cluster and measure.
  const environment: NodeJS.ProcessEnv = { ...Object.fromEntries(Object.entries(process.env).filter(([key]) => !key.startsWith("PG"))), NODE_ENV: "test" };
  const root = await mkdtemp(join(tmpdir(), "forge-h10-g2-")), socket = join(root, "s");
  await mkdir(socket, { mode: 0o700 });
  await exec(join(bin!, "initdb"), ["-D", join(root, "d"), "--no-locale", "--encoding=UTF8", "--auth-local=trust", "--auth-host=reject", "-U", "forge_v2_fixture"], { env: environment });
  await exec(join(bin!, "pg_ctl"), ["-D", join(root, "d"), "-l", join(root, "log"), "-w", "-t", "10", "-o", `-c listen_addresses='' -c unix_socket_directories='${socket}' -p 65447`, "start"], { env: environment });
  const admin = new Pool({ host: socket, port: 65447, user: "forge_v2_fixture", database: "postgres", max: 2 });
  const pool = new Pool({ host: socket, port: 65447, user: "service_role", database: "postgres", max: 3 });
  try {
    await admin.query("create role anon; create role authenticated; create role service_role login");
    for (const name of ["20261029235656_forge_v2_immutable_history.sql", "20261123200000_forge_v2_goalie_h10.sql", "20261123210000_forge_v2_h10_partitions_archive.sql"]) await admin.query(await readFile(resolve(__dirname, "../..", "supabase/migrations", name), "utf8"));
    let statements = 0;
    const db: SqlConnection = { query: (text: string, values?: unknown[]) => { statements += 1; return pool.query(text, values) as never; } };
    const started = performance.now();
    const run = await runH10Issuance({ db, store: new PostgresHistoryStore(db), artifacts: { put: async () => { throw new Error("no_artifact_writes_expected"); } }, denominator: withOfficial,
      schedule: inputs.schedule, logs: inputs.logs, clock: () => new Date().toISOString(), trigger: "daily",
      config: { evidenceClass: "prospective_shadow", approvalEvidenceId: "local-g2-dry-run-disposable-db-not-an-issuance-approval", approvedAt: ASOF, codeVersion: "local-g2", maximumTrainingExamples: 2000 } });
    const ms = performance.now() - started;
    // Goalies: lines from read #2, mapped to games by club and date (Utah alias copies dropped, never guessed).
    const goalieStarted = performance.now();
    const goalies = await runH10GoalieIssuance({ db, denominator: withOfficial, schedule: inputs.schedule, skaterLogs: inputs.logs, goalieLogs: inputs.goalieLogs, clock: () => new Date().toISOString(), trigger: "daily",
      config: { evidenceClass: "prospective_shadow", approvalEvidenceId: "local-g2-dry-run-disposable-db-not-an-issuance-approval", codeVersion: "local-g2", maximumTrainingExamples: 2000 } });
    const goalieRows = await readbackH10Goalies(pool as unknown as SqlConnection, withOfficial);
    report.goalies = { ms: Math.round(performance.now() - goalieStarted), goalieLinesRead: inputs.goalieLogs.length, published: goalies.published, numeric: goalies.numeric, nonNumeric: goalies.nonNumeric, gaps: goalies.gaps.length,
      training: goalies.training, gapReasons: Object.fromEntries([...new Set(goalies.gaps.map(g => g.reason))].map(r => [r, goalies.gaps.filter(g => g.reason === r).length])),
      coverage: (({ stray, ...rest }) => ({ ...rest, stray: stray.length }))(measureCoverage(withOfficial, goalieRows)),
      saves: (() => { const v = goalieRows.map(r => r.values.SAVES).filter((x): x is number => typeof x === "number").sort((a, b) => a - b); return v.length ? { min: v[0], median: v[Math.floor(v.length / 2)], max: v[v.length - 1] } : null; })(),
      montembeault: goalieRows.filter(r => r.playerId === 8478470).sort((a, b) => a.gameId - b.gameId).map(r => ({ gameId: r.gameId, teamId: r.teamId, ...r.values })) };
    const back = await readbackH10(pool as unknown as SqlConnection, withOfficial);
    const sizes = (await admin.query(`select relname, n_live_tup::int rows, pg_total_relation_size(relid)::bigint bytes from pg_stat_user_tables where schemaname='forge_v2_private' order by relname`)).rows;
    const payloads = async (table: string) => {
      const texts = (await admin.query(`select payload from forge_v2_private.${table}`)).rows.map(r => r.payload as string);
      const raw = new Uint8Array(Buffer.from(texts.join("\n"))); return { rows: texts.length, rawBytes: raw.length, gzipBytes: gzipSync(raw, { level: 9 }).length };
    };
    report.issuance = { ms: Math.round(ms), statements, complete: run.complete, jobs: run.jobs, gaps: Object.fromEntries([...new Set(run.gaps.map(g => g.reason))].map(r => [r, run.gaps.filter(g => g.reason === r).length])),
      training: run.training, ledger: run.ledger };
    report.readback = { vintages: back.vintages, receiptMismatches: back.receiptMismatches, coverage: { ...back.coverage, stray: back.coverage.stray.length }, spread: back.spread, nonNumericReasons: back.reasons };
    report.storage = { tables: sizes, vintagePayload: await payloads("forge_v2_vintages"), recordPayload: await payloads("forge_v2_records") };
    const sample = (await admin.query(`select payload from forge_v2_private.forge_v2_vintages where player_id = 8477946 order by game_id`)).rows.map(r => JSON.parse(r.payload));
    // Compression options for the retention design: the same payloads under lz4 column compression.
    // Like for like: the payload column alone, copied under the default (pglz) and under lz4.
    const copy = async (table: string, method: "pglz" | "lz4") => {
      await admin.query(`create table public.${method}_${table} (payload text compression ${method})`);
      await admin.query(`insert into public.${method}_${table} select payload from forge_v2_private.${table}`);
      return Number((await admin.query(`select pg_total_relation_size('public.${method}_${table}')::bigint as b`)).rows[0].b);
    };
    (report.storage as Record<string, unknown>).payloadOnlyBytes = {
      vintages: { pglz: await copy("forge_v2_vintages", "pglz"), lz4: await copy("forge_v2_vintages", "lz4") },
      records: { pglz: await copy("forge_v2_records", "pglz"), lz4: await copy("forge_v2_records", "lz4") } };
    report.larkin = sample.map(v => ({ gameId: v.gameId, teamId: v.teamId, opponentId: v.opponentId, home: v.home, horizon: v.horizon, G: v.means.G.value, A: v.means.A.value, SOG: v.means.SOG.value }));
  } finally {
    await pool.end(); await admin.end();
    await exec(join(bin!, "pg_ctl"), ["-D", join(root, "d"), "-w", "-t", "10", "stop", "-m", "fast"], { env: environment }).catch(() => undefined);
    await rm(root, { recursive: true, force: true });
  }
  await writeFile(out!, `${JSON.stringify(report, null, 2)}\n`);
  process.stdout.write(`${JSON.stringify(report, null, 1).slice(0, 6000)}\n`);
}
main().catch(error => { console.error(error); process.exit(1); });
