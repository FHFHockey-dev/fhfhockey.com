# FORGE connection guard: fixed and preflight verified

2026-11-07, Codex/Astra. The production rebuild has **not** run in this task.

## Decision and evidence

Keep the existing database-side guard, using this project's confirmed **Supavisor session pooler on port 5432** for transport. Pass its URL as the process-local `FORGE_GUARD_DB_URL`; leave shared `SUPABASE_DB_URL` and `.env.local` unchanged.

The exact host is `aws-0-us-east-1.pooler.supabase.com`, obtained from `supabase/.temp/pooler-url` and checked against `supabase/.temp/project-ref`, the API project, and the direct URL. The parked data-checks diary independently records using that host. No regional endpoint was guessed.

The query remains:

```sql
select count(*)::int as n
from pg_catalog.pg_stat_activity
where datname = current_database();
```

It executes on Postgres through the pooler. It counts server backends for the current database, including idle sessions, the guard itself, and any database-associated workers. It does **not** count clients waiting at Supavisor. This preserves the original measure and threshold. It is a database-scoped pressure signal, not a cluster-wide `max_connections` measurement or an exclusion lock; a low sample does not prove another job is absent or reserve capacity for the whole date. The 60-connection limit is reported by the handoff, not re-measured here.

The direct host has an AAAA record and no A record. Mac system resolution for AF_INET6 failed; a bounded TCP probe to the observed AAAA returned `errno 65: No route to host`. The pooler was reachable over IPv4.

No existing count RPC/view was found in the searched local script/library/migration trees. Live function definitions were not inventoried because the pooler solved the problem. A reviewed existing RPC executing the same query could work over HTTPS; adding one would require a production schema/permission change. Pooler client metrics, stale dashboard values, or treating a failed query as zero would not preserve the guard.

## Patch

- `rebuild-forge-derived-2026-27.ts`: guard-only URL override, project/database/session-port validation, verified TLS, 10-second connection/client-query/server-statement timeouts, and read-only guard session settings.
- Rejects missing, malformed, nonnumeric, zero, fractional or negative count results. Query/connection errors stop execution; there is no fail-open fallback.
- Preserves `>40` (40 proceeds), 15-second waits, 20 waits maximum, one client, sequential dates/games, 3-second date gap, existing range and first-failure stop behavior.
- Adds `--check-connections`: one SELECT, log readiness, close client, exit. Above 40 returns a nonzero exit status without waiting or rebuilding. Rebuild imports occur only after this mode exits. `--plan` remains connection-free.
- No version bump, migration, shared env edit, runtime application change, push or deployment.

## TLS setup

The first preflight stopped before authentication/SQL with `self-signed certificate in certificate chain`. The successful preflight added Supabase's official CA with **process-local** `NODE_EXTRA_CA_CERTS=/tmp/forge-prod-ca-2021.crt`, retaining certificate and hostname verification.

The CA download link was resolved from Supabase's own dashboard source, not taken from the unverified server chain:

- [Dashboard SSL component](https://github.com/supabase/supabase/blob/master/apps/studio/components/interfaces/Settings/Database/SSLConfiguration.tsx)
- [Dashboard certificate URL template](https://github.com/supabase/supabase/blob/master/apps/studio/hooks/custom-content/custom-content.json)
- [Official production CA](https://supabase-downloads.s3-ap-southeast-1.amazonaws.com/prod/ssl/prod-ca-2021.crt)

Certificate subject/issuer: Supabase Root 2021 CA; expires 2031-04-26. DER SHA-256 fingerprint: `807025ad50d4ed219d2c9c7d299c004f824eb00cf7f65afef607d07b72e6cafa`. PEM file SHA-256: `700723581420dd1ac98fd7e9ac529f0ef210eadcaf87fc868a3ad7d114c2f3b7`.

No system trust store was modified. The public CA is in `/tmp`; download again from the official source if it has been removed. An earlier community-suggested `https://supabase.com/prod-ca-2021.crt` returned 404 and was not used.

## Verification

Passed:

- 16 focused offline Node tests for configuration, TLS/timeouts, count validity, threshold boundary, bounded waits and query failure.
- Focused `tsc --noEmit --project tsconfig.forge-guard.json` against a clean `git archive a68f9b3d2 web` export with the two artifact files copied into `web/scripts`. An initial test-only assertion narrowing error was corrected before the passing run.
- `--plan`: 49 calendar dates, 2026-09-19 through 2026-11-06.
- `git diff --check`; inspected diff limited to the guard artifact.
- Live read-only preflight at **2026-11-07T23:57:32.064Z**: `connections=28`, `maxConnections=40`, `ready=true`, exit 0.

Live database usage: one failed TLS handshake with no authentication/SQL, then one successful session containing session-local read-only/timeout settings and **one `pg_stat_activity` SELECT**. No production table reads, writes, rebuilds, application endpoint calls, Vercel builds/deployments, or post-rebuild checks. The reported 28 is a point-in-time sample, not a claim about current load.

Prepared clean export: `/tmp/forge-guard-verify-mw2sizw3/web`, released base `a68f9b3d24`. The export has the patched script/tests and a node_modules symlink; it is not an editing branch/worktree.

Artifact SHA-256:

- Script: `944b80645d83e7ff5d099b5d8243969d11a8fa609c97ce13abffb1639117dce9`
- Tests: `296b7c19f06eab1775dcf0da8edb5785750fd7dcd37e448d8169e4aec47bbe5a`

## Reproduce the read-only preflight

Run from the canonical `web/` directory after downloading the CA above. Credentials stay in the child environment, never the command line or log. This command is **preflight only**, not approval for a rebuild.

```sh
node <<'JS'
const fs = require('fs');
const { spawnSync } = require('child_process');
const env = require('dotenv').parse(fs.readFileSync('.env.local'));
const ref = fs.readFileSync('../supabase/.temp/project-ref', 'utf8').trim();
const pooler = new URL(fs.readFileSync('../supabase/.temp/pooler-url', 'utf8').trim());
const direct = new URL(env.SUPABASE_DB_URL);
if (ref !== 'fyhftlxokyjtpndbkfse'
    || pooler.hostname !== 'aws-0-us-east-1.pooler.supabase.com'
    || pooler.port !== '5432' || pooler.username !== `postgres.${ref}`
    || pooler.pathname !== '/postgres'
    || direct.hostname !== `db.${ref}.supabase.co` || !direct.password) {
  throw new Error('Project connection metadata mismatch');
}
pooler.password = direct.password;
const result = spawnSync(process.execPath, [
  'node_modules/ts-node/dist/bin.js', '--transpile-only', '--compiler-options',
  '{"module":"commonjs","moduleResolution":"node"}',
  '../tasks/artifacts/forge-pp-fix-2026-11-07/rebuild-forge-derived-2026-27.ts',
  '--check-connections',
], {
  env: { ...process.env, ...env, NODE_PATH: `${process.cwd()}/node_modules`,
    FORGE_GUARD_DB_URL: pooler.toString(),
    NODE_EXTRA_CA_CERTS: '/tmp/forge-prod-ca-2021.crt' },
  stdio: 'inherit', timeout: 30000,
});
process.exitCode = result.status ?? 1;
JS
```

## Pending handoff

See [COORDINATION-AND-LOAD-PLAN.md](COORDINATION-AND-LOAD-PLAN.md) for the 2026-11-08 planning follow-up: supplied 01:18–01:19 health/queue snapshot, evidence still needed for mitigation/exclusivity, and the explicit decision about normal background writers. It does not clear the hold or implement additional guards.

**2026-11-08 update: approved, but on hold.** Trusted parent-thread transcript records Tim answering "yes" to approval of the bounded production rebuild once no other production job is confirmed running. Scope remains 2026-09-19..2026-11-06 only, with 2025-26 untouched. No repeat approval is needed for that scope.

Tim subsequently reported the database down again, possibly related to Lines processing. That attribution is unverified. Hold all rebuild/production writes until database health is restored, the outage cause and mitigation are understood, and no parallel production job is independently confirmed. The previous 28-backend sample is stale and does not satisfy these conditions. The guard must not be bypassed. No production requests were made in response to the hold; the rebuild has not started. Claude was not contacted.

After those conditions are met, run the prepared script against the clean release `a68f9b3d2` export using the same process-local guard URL and CA. Keep the existing 2026-09-19..2026-11-06 bounds, concurrency one, no version bump, and stop-on-first-failure rule. Use `NODE_PATH=.` in that export so released library imports resolve; do not reuse the preflight launcher’s 30-second process timeout for the 6–13 minute rebuild. Capture per-game/date logs. Then perform the handoff's once-only bounded read-only PP comparison (30-second statement timeout). No run totals or post-rebuild numbers are available yet.

Original failed-run log file remains unavailable; its error and before-write stop are recorded in the supplied handoff and parked owner diary. It is not needed to reproduce or fix the connection guard.

References: [Supabase connection modes](https://supabase.com/docs/guides/database/connecting-to-postgres), [Supabase verified SSL](https://supabase.com/docs/guides/platform/ssl-enforcement), [PostgreSQL pg_stat_activity](https://www.postgresql.org/docs/current/monitoring-stats.html#MONITORING-PG-STAT-ACTIVITY-VIEW).
