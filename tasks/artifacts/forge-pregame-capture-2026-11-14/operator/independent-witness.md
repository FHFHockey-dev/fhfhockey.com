# Hosted independent witness

This worker runs from a clean release checkout on a separate Linux host. The verifier host has a different deployment owner and secret store from the capture application. Only the independently authorized witness controls its database credential and checkout. Installation of the migration leaves the automated login without a password. Credential provisioning, the exact named principal, the immutable release SHA, a game, its UTC window and authority mode require the applicable approval.

Use a TLS-authenticated direct PostgreSQL connection on port 5432. The private host environment supplies `FORGE_WITNESS_DB_HOST`, `FORGE_WITNESS_DB_NAME`, `FORGE_WITNESS_DB_USER`, `FORGE_WITNESS_DB_PASSWORD` and `FORGE_WITNESS_DB_CA_FILE`. The last value is the path of the trusted CA for that database host. Pick an independent credential with no memberships for the automated login `forge_independent_verifier`. For a named-human mandate, provision a dedicated individual LOGIN with only normal membership in `forge_named_witness`, record its exact name in the approval, and deliver this credential only to that witness. Check effective schema privileges including PUBLIC defaults before provisioning. The witness needs USAGE on `forge_witness_api` and EXECUTE on its three functions. It needs no access to private custody tables, the public application schema, Vault, other identities, or role administration.

Install the pinned Node version and lockfile dependencies in the release checkout (including ts-node). The executable checks its actual Git HEAD against the 40-hex approval SHA and refuses local changes to its source subtree. The host should mount the verified checkout and dependencies read-only to the worker account. The commands below assume `/srv/fhfh` is that checkout. The host's `/etc/forge-independent-witness.env` is readable only by the service manager and contains the five variables above. Log output contains only the game and an enumerated result.

## Automated mandate

On the independent host, schedule one transient systemd timer for the approved future UTC start. Supply `GAME_ID`, `SHA`, `START_UTC` (systemd calendar syntax, with UTC) and `T_MINUS_60_UTC` (ISO instant including offset). The timer invokes exactly one bounded process, checking at most every 30 seconds for up to one hour and 120 attempts. Ineligible polls fetch metadata only. PostgreSQL serves the committed bytes at most once per claim across the worker's autocommitted calls. A worker interruption after that read can leave the job unconfirmed. The orchestrator records a terminal failure at the deadline.

```sh
systemd-run --unit="forge-witness-${GAME_ID}" --on-calendar="${START_UTC}" \
  --timer-property=AccuracySec=1s --property=User=forge-witness \
  --property=WorkingDirectory=/srv/fhfh/web \
  --property=EnvironmentFile=/etc/forge-independent-witness.env \
  /srv/fhfh/web/node_modules/.bin/ts-node --transpile-only \
  --compiler-options '{"module":"commonjs","moduleResolution":"node"}' \
  scripts/forge-independent-witness.ts --automated "${GAME_ID}" "${SHA}" --poll-until "${T_MINUS_60_UTC}"
```

## Named-human mandate

Once the exact named witness receives the separate readback approval, that witness signs in on their independent host, loads their individual credential and explicitly runs one readback. Archive the sanitized host deployment identity, start/finish time, exit code and matching database receipt under the approved procedure. A personal credential must stay outside the automation host and capture application's secret stores.

```sh
cd /srv/fhfh/web
./node_modules/.bin/ts-node --transpile-only \
  --compiler-options '{"module":"commonjs","moduleResolution":"node"}' \
  scripts/forge-independent-witness.ts --named "${GAME_ID}" "${SHA}"
```

An accepted or idle one-shot exits 0. A rejected check exits 2. An operational error, expired polling window, or ambiguous post-write confirmation exits 1. A named witness receiving idle must check the authoritative stage and approval before deciding whether a later one-shot is appropriate. Only a committed `independent_verdicts` row with `accepted` authorizes publication.

## Receipt semantics

A short-lived challenge binds the DB login, claim and game. The worker decompresses the stored gzip, hashes raw bytes and canonical JSON, checks the packet and statement bindings, verifies the retained RFC 3161 signature with the bundled DigiCert policy, and compares the database clocks and token bounds in absolute microseconds. The worker makes no TSA requests. The database records a provisional immutable check, then a new transaction must observe that committed check by T−60 and within 90 seconds of the read. The primary app credential has no witness API grant. The receipt includes the role, game, claim, verified time, verdict, enum reason and evidence digests.

The connected local test uses disposable socket-only PostgreSQL, synthetic custody and a fixture TSA. From `web/`, run `LC_ALL=C npm test -- --run scripts/forge-independent-witness.test.ts`. A host deployment and its separate credential require their own acceptance evidence.
