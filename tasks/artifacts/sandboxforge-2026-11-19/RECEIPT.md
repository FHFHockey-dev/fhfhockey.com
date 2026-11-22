# sandboxFORGE rehearsal · November 19, 2026

**Passed off-Mac.** The pinned candidate captured synthetic game `2099020991`, the verifier accepted its packet, SQL observed one publication and both RSO readers selected that publication's run. The Linux run reached terminal success at **17:53:41.983687 UTC** with four signed application deliveries, one fixture TSA stamp and 166 app-to-PostgREST requests. [Machine receipt](OFF-MAC.json) · [Raw logs, checksums and exact launch scripts](off-mac-evidence.tar.gz) · [Cloud chat](codex://threads/6aff3400-e9d4-8191-b90c-ac6f691790dc)

| Link | Cloud observation |
| --- | --- |
| Qualified claim and FORGE run | `9da9d039-cf22-42db-97ec-d29accf3e678` |
| Witness | `forge_independent_verifier` accepted the same claim at 17:53:36.418201 UTC. Its raw, canonical and TSA token digests match custody. T−60 was 18:48:22 UTC. |
| Publication | Input snapshot `9e79728a-9532-4724-a082-03ab7253d9aa`. Committed revision `cd5d574a-f989-44f5-b66b-d935af61f10b`, observed at 17:53:41.861849 UTC. |
| Daily reader | **2.965 points, C#1.** Its revision key was `forge-daily-bridge-v1:9da9d039-cf22-42db-97ec-d29accf3e678`. The reader checks captured-snapshot provenance, the release and the publication time for this run. |
| Detailed reader | Selected the same run and the committed revision UUID. Returned `missing_participation` with both points and legal slot null. |
| Previous baseline | The Nov 18 Mac receipt recorded the same reader results. The Nov 19 cloud run generated fresh claim, snapshot, revision and witness evidence. |

The actual run used PostgreSQL 15.20 with pgcrypto, PostgREST 16.6, psycopg2 2.9.5 and Node 22.23.4. The cloud installed 1,485 packages using the candidate lock. Docker ran as the unprivileged postgres user with a cleared environment, all capabilities dropped, a read-only root and writable private tmpfs. The final container had only loopback, no external network interface or IPv4 route, and no production environment files or service credentials. The handlers received a locally minted service-role JWT and dispatch secret. The witness used its own database login in the harness process. The queue and timestamp signer were fixtures.

The initial cloud run stopped before capture because the sparse transfer omitted `world/oracle/normal-one-game.json`. The retry used the verified oracle tree and a fresh fixture signer in a clean disposable database while preserving the scheduled start. Both attempt logs are in the archive. A separate fragment build encountered a dependency-file permission error. Its successful retry used the same recorded fragment. The 67 files listed in the cloud evidence manifest passed SHA-256 verification after transfer. The signed-handler log and machine receipt contain the same result. The evidence archive SHA-256 is `d46b2882641c674dffce33cd308e8219017ff06e363d658fd8b1721e9c7ef8e3`.

## Exact cloud command

Within the isolated runtime, the successful invocation was

```sh
cd /tmp/inputs/checkout-v4
FORGE_TEST_ARCHIVE_SHA=f886ddac731ae825a12fab915848d2b5fd7d9b8c \
FORGE_TEST_PG_BIN=/usr/lib/postgresql/15/bin \
python3 -I tasks/artifacts/forge-offline-2026-11-18/rehearsal/bootstrap.py \
  --start 2026-11-19T19:48:22Z --check-postgrest /tmp/inputs/postgrest
```

The outer command was `bash launch.sh synthetic 02` in `/workspace/scratch/forge-preflight`. The archive contains the container launch flags, dependency image definition, fixed start, actual lane commands and per-attempt logs. For a new fixture date, set the start once using the following command, substitute it in the invocation above and retain it across retries. Keeping the November 19 inputs on a later day requires a disposable test clock inside the original admissible window.

```sh
start_utc=$(python3 -c 'from datetime import datetime,timedelta,timezone; print((datetime.now(timezone.utc)+timedelta(hours=2)).isoformat(timespec="seconds"))')
```

The cloud control suite used `FORGE_TEST_PG_BIN=/usr/lib/postgresql/15/bin python3 -I supabase/tests/forge_hosted_control.py --with-route`. All 97 SQL assertions passed. They covered duplicate dispatch and finish, recovery from missing acknowledgments using durable state, publication fencing, and the missed witness deadline withholding publication. The connected route test also passed.

A separate direct RPC check discarded the first committed claim response. A second service-role connection submitted the identical admitted binding and received `duplicate` with a null claim ID. Lookup by game and policy recovered the original committed claim. The SQL count stayed at one across the retry (0 → 1 → 1). The two SQL connections ran sequentially. The supplemental archive SHA-256 is `4089e3cb785028328191b6c4a2fd2b72dd952910ea1c041dd3b25660c65a8660`. [Exact script, command and output](direct-claim-evidence.tar.gz)

## Source and fixture identity

| Input | Verified value |
| --- | --- |
| Candidate commit | `f886ddac731ae825a12fab915848d2b5fd7d9b8c` |
| Git tree | `09ef9bf0662e14cd80fa60cee25c70a988e5c748` |
| Parent | `f8081453463da1c30f60a4572f5a65da3c9d2dbf` |
| Full operator ZIP SHA-256 | `282deb5a85d3c656fab21d2c959ab80ace73759d891517f4578ada7634a23565` |
| ZIP path manifest SHA-256 | `cd64723642a0e883e23df1d146cd917d191148c6b78f0aba3f9be52c26392cdf` |
| Candidate web lockfile SHA-256 | `fe7b9cac6900e841cd6c0fbad2a077ff04d611e99cc5a769409b23cd7c420378` |
| PostgREST 16.6 Linux x86-64 release archive SHA-256 | `335ea29f00145705fb569b1268b9c8e53d062f8f6f9188192e92ea3781d2dca1` |
| Synthetic game, center and scheduled start | `2099020991`, NHL `8471001`, `2026-11-19T19:48:22Z` |
| Fixture source tables SHA-256 | `77b8ae74ef9f99a50dc3e2edc16edd61b8a23430d4188cd033764cc32754386d` |
| Fixture seed SQL SHA-256 | `a76153b3c30936f7d9aa1eb0e851b5b79c05c95d4c1eba6700939ff9a558e743` |

The coordinator checked the byte length and SHA-256 of all 4,718 manifest entries and compared all 4,716 candidate files to their Git blob IDs. The two additional files are the transfer guide and the disposable timestamp-signer generator. For the fixed start above, the candidate bootstrap's `world(start)["tables"]` produced 21 tables and 1,154 rows. The source-table digest covers Python JSON with sorted keys, compact separators and ASCII escaping. The seed SQL digest covers UTF-8 output from `add_seed(world(start))`.

The newly captured cloud packet had raw SHA-256 `564e8b64fa24bbb22d904c835e808169d16a4ffa776de78b8540e2e3440dbe49` and canonical SHA-256 `2ac4cd20e233e1cb771bae05ec6712bb29b4fc2d601e962126d511a5a9d6716f`. The TSA token SHA-256 was `80c549c05db70c43f04e3fc94a0b9c64872b7871d213465dc8732e5fb3ce3132`.

## Independent daily repair

The change in `web/lib/projections/queries/skater-queries.ts` applies the requested lower date bound before validating the RPC row's game identity. It retains the player, strength, upper cutoff, selected-field and in-window identity checks. Regression cases extend `web/lib/projections/queries/skater-queries.test.ts`. Patch SHA-256 `720e60edbd79b151563797e85ab1d1aa0408f50f103b249ada981f12b94f88ce`. The exact production HTTP response was unavailable. The fixture reproduces the recorded date, player, null ID, strength states and missing sidecar with synthetic control rows. [Daily evidence and commands](daily/DAILY-ROLLING-LOOKBACK.md)

On Linux, the original SQL migration and application reader ran through real PostgREST for the candidate and the repair. Across EV, PP and all strengths, the candidate RPC rejected the 1,035-day-old null-ID row at the default 365-day lookback. The fixed RPC retained the control player and excluded the old row. Both access paths rejected it at 1,095 days and rejected a recent null-ID row at 365 days. All 18 candidate and 18 fixed outcomes matched the expected matrix. The 118 reader tests, scoped ESLint and diff checks also passed locally. Production still needs separate proof of a complete daily run and fresh reader output.

## November 17 packet

The authorized read-only export recovered the original 187,301-byte CBJ–NYI packet for game `2026020336`. Both original SHA-256 pins matched on export and again in the isolated Linux container. The November 19 candidate restored the eight recorded model settings and stopped at its first missing input, `modelEnvironment.FORGE_RESERVE_PASS_ENABLED`. The original capture release `83750b4ab` matched all eight settings on the same packet. Its replay CLI stopped earlier, at the input-format check for a source observation with `payload` and `payload_hash`. Each attempt consumed 0 of 187 recorded reads and produced zero projections. The earlier fragment-only replay stopped at `games`. [Exact replay commands, hashes and receipts](packet/README.md)

## Release verification

The signed route, SQL custody, independent-login verification, publication and reader results are offline candidate evidence. The managed queue and scheduler, provider deployment, external TSA and operational witness coverage still require separate approval and verification. Any live game also needs a prospective capture, witnessed publication and reader observation inside the real deadline. The only production operation in the native replay was the authorized read-only custody export.
