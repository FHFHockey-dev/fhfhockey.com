# Isolated synthetic rehearsal database

Generate the bootstrap from the candidate checkout with the repository's Node version, installed web dependencies and Python 3. Choose a UTC puck drop between 75 minutes and seven days ahead. The fixture uses NHL-format game ID `2099020991`, season `20262027`, NHL center `8471001` and reader context `synthetic-single-center-points-v1`. Its upstream data comes from the deterministic synthetic league. Custody, publication, source observations and reader output start empty.

```sh
start_utc=$(python3 -c 'from datetime import datetime, timedelta, timezone; print((datetime.now(timezone.utc) + timedelta(hours=2)).isoformat(timespec="seconds"))')
python3 -I tasks/artifacts/forge-offline-2026-11-18/rehearsal/bootstrap.py --start "$start_utc" --out /tmp/forge-isolated-bootstrap.sql
```

After approval to provision the exact isolated target, apply the output with the fresh project's owner connection. Enable pg_cron, pg_net, Vault and pgcrypto on the new project. Install pgcrypto in the extensions schema. It refuses a populated public schema. It uses that project's real platform roles, Vault and pg_net functions. The application objects and synthetic data install in one transaction. The resulting database has service-only model inputs and an empty hosted-run register. The bootstrap narrows the creating role's public-schema default grants for subsequent tables, sequences and functions in this dedicated project.

Configure the isolated Next project with the matching Supabase URL, public key and service role credential. Use the approved SHA, singleton canary game ID, baseline skater model, disabled reserve pass and season bootstrap, pre-activation native catalog, enabled shared serving and enabled daily bridge for this scenario. The independent witness enrollment, dispatch credentials, scheduler, Vercel deployment and arming follow the hosted-run procedure.

## Local verification

With PostgreSQL 15 (including `initdb`, `pg_ctl` and pgcrypto), Python psycopg2, and an installed PostgREST binary, run the following from the repository root. Linux users can set `FORGE_TEST_PG_BIN` to the PostgreSQL installation's binary directory. Use an absolute path for the PostgREST binary.

```sh
python3 -I tasks/artifacts/forge-offline-2026-11-18/rehearsal/bootstrap.py --start "$start_utc" --check-postgrest /absolute/path/to/postgrest
```

The check creates a disposable socket-only PostgreSQL cluster and serves its Data API through loopback PostgREST. It validates the schema and three native input RPCs as the service role. Four owner-driven SQL ticks dispatch signed requests through loopback HTTP to the v2 Next handlers. A separate database login runs the independent verifier. The handler publishes under its SQL fence and records both readers in the same database. The local harness supplies the RFC 3161 signer, test Vault values and a capture table for pg_net deliveries. The hosted scheduler, Vercel runtime and external TSA still require an isolated hosted run.

| Local check on November 18, 2026 | Observed result |
| --- | --- |
| Target | Synthetic game 2099020991, center 8471001 |
| Terminal SQL state | succeeded |
| Qualified claim | 63a26943-3120-4ca9-9f9c-73467a7bc7ee |
| Selected detailed revision | 04eb2aa4-6662-420e-9885-5c7dac2b0e3b |
| Independent verifier | forge_independent_verifier, accepted |
| Daily RSO reader | 2.965 points, legal slot C#1 |
| Detailed RSO reader | Same run, missing_participation, points and slot withheld |
| Application deliveries | 4 |
| Fixture TSA requests | 1 |
| App-to-PostgREST requests | 166, comprising 2 preflight, 135 capture, 6 publish and 23 reader requests |

The PostgreSQL 15 and PostgREST 16.6 run used the local working files. The harness uses the checkout's HEAD as a fixture release label, with FORGE_TEST_ARCHIVE_SHA or a synthetic label in a source archive. These identifiers and counts describe only that disposable run.
