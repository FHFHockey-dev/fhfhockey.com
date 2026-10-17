# Native publication execution caller

Root executed the exact 86-row package once on 2026-10-16; the retained execution receipt, ledger, intent and final plan have now been independently reconciled offline. No repeat network call, credential inspection or activation was performed by the reviewer. File SHA256 `1f04d55947a618e809e3c14a149d2fa9a7a089b3534dd852e556769d0ed63880` and canonical package hash `c6b43ae0b870dfce07aa4478d0810fa5d6884a6c9f4d7a0fd5035e802306a12e` were independently recomputed against the final plan.

The runner uses the installed supported `@supabase/supabase-js` client with a request-local fetch adapter. There is no connector credential-export interface for invoking these local TypeScript persistence primitives; normal existing server configuration is therefore used in memory only on exact approved execution, following the previously tested Yahoo collector pattern. It does not copy/export credentials, refresh/renew authentication, invoke token RPCs, change permissions or settings, or print/retain authorization headers. No additional approval gate is added for ordinary use of that configured authentication; the standing authorization reference is retained in the private intent. If normal configuration is unavailable or targets another project, execution stops rather than retrieving another secret.

Default CLI mode reads and reproduces only the local immutable package, never secret environment or network configuration. It reports the exact file SHA256, canonical package hash, row/byte count, proposed pins and zero network/credential reads. Execution requires both hashes, the existing authorization reference and a new exclusive private output directory. Before any service request, the existing publication module validates all native provenance/policy/review and participation contracts over exact in-memory rows. The runner never alters package bytes, means, source clocks, UUIDs, references or permissions.

Allowed remote operations are only HTTPS on `fyhftlxokyjtpndbkfse.supabase.co/rest/v1/player_forecast_source_observations`: serial exact-ID GETs using the fixed source-observation column projection, or exact approved single-row INSERTs. DELETE/UPDATE/UPSERT, other hosts/tables/auth paths, arbitrary projections, extra query arguments and redirects are blocked. Only package UUIDs are addressable. Each UUID may have one INSERT attempt; total INSERT attempts are at most 86 and total service calls at most `2N+3` (175 for N=86), including collision/reconciliation reads. There are no automatic transport retries. Unknown/error INSERTs block further INSERTs while bounded exact-ID reconciliation remains possible. A uniqueness collision requires matching the exact planned ID and complete row scope/hash/clocks; an existing different ID is never adopted.

Network bounds are eight seconds per request and 180 seconds shared, including durable request-intent time. Original plan rows are limited to 8 MiB. Upload is at most 32 MiB aggregate. Each response stream is limited to 32 MiB before JSON decoding, each decoded response row to 8 MiB, and aggregate download to 96 MiB. Upload/download are intentionally separate budgets: a roughly 21 MiB package plus full readback does not fit a combined 32 MiB budget. The 96 MiB download ceiling allows three bounded full-batch reads (preflight, final readback, failure reconciliation); collision reads share that same ceiling. This is a body-stream budget, excluding HTTP headers/TLS overhead. Budget failure stops; it is not permission to enlarge the budget or continue.

Output directory mode is 0700; intent, fsynced metadata-only ledger and result receipt use 0600. Intent records standing authorization, both package hashes, runner/coordinator hashes, counts, limits and proposed pins. Ledger records safe IDs/status/body hashes/counts only, never request headers, credentials or raw source/response bodies. A stopped receipt distinguishes present/missing/unknown IDs. Timeout, EOF/cap failure or another uncertain acknowledgement remains unknown. Only an exact matching readback resolves it; an absent readback does not prove that a possibly late commit cannot occur. Do not attempt it again before reconciling. The runner does not set release environment variables, activate routes, refresh schedule caches, mutate user plans or deploy.

Dry-run command from repository root:

```sh
NODE_PATH=web ./web/node_modules/.bin/ts-node --transpile-only --compiler-options '{"module":"commonjs","moduleResolution":"node"}' tasks/artifacts/forge-rso-completion-2026-10-15/native-publication-runner.ts --plan /ABS/REVIEWED/plan.json
```

Reviewed execution adds `--execute-approved-sha256 FILE_SHA --approved-package-hash CANONICAL_PACKAGE_HASH --authorization-ref EXISTING_AUTHORIZATION_REF --out /ABS/NEW/PRIVATE/OUTPUT`. Preparation itself made no service request; the subsequent root-owned exact execution is recorded below. Any future package/run must retain its own exact hashes and reconciliation.

Nine synthetic checks pass using the real installed SDK with fake transport: exact scope/auth-header nonretention; blocked writes/hosts/queries/IDs/repeated inserts; uncertain write readback; collision rejection; redirect/response/aggregate byte ceilings; durable-intent and request/upload limits; short remaining-time abort; real SDK object acknowledgement for insert/select(id)/single including omitted null URL; and an end-to-end existing publication coordinator write/readback through the real SDK/fake service plus default dry-run isolation. The prior root-owned Node22.11 localhost HTTP fixture established fetch-body BYOB support; it was not rerun here. No global compiler was run. These are engineering checks, not hosted publication evidence.

Frozen SHA256:

- runner `e1e79f061bd814e24597b87c984ffd05459c966729cacf139fc11442dece3b62`
- test `7ecad1ebc5a00e6114ffb61c355b38195552a485b8774e9cf53f5c36e28d2531`


## Actual immutable publication evidence

The root-owned run returned `persisted_not_activated`: 86 distinct INSERT attempts and 88 total requests, exactly one preflight GET, 86 serial POSTs and one final GET. The 176 ledger entries alternate intent/completion with no failure entries. Every final present UUID matches the frozen plan; missing and unknown sets are empty. All 86 payload hashes, the canonical plan hash, byte-file hash, and four proposed pin strings match independently. Runner/coordinator execution hashes also match the retained intent. This verifies the retained execution evidence without querying the service again.

Ledger interval: 2026-10-16T05:50:45.033Z–05:51:06.700Z. Upload was 20,984,619 bytes and download 21,959,996 bytes, within the separately declared budgets. Every response was successful. The 86 immutable rows comprise 57 skater inputs, 11 goalie-policy inputs, five owner-use policies, five validation reviews, five per-policy aggregate rate bundles containing 541 sources, and three roster-observation participation/start bundles. Proposed pins were recorded only; activation is explicitly `not_performed`.

Private evidence under `/Users/tim/Documents/FHFH-private/forge-rso-completion-20261016-v1/native-publication-execution-v1/`:

- receipt SHA256 `7684812fecf2363befaa7105adb8c247cf79879be86ef18f05a6b88bf8205f0b`
- intent SHA256 `17d65d15f1203468e1584e096d34f7a872b436129cb48c070c3fa161f9832133`
- ledger SHA256 `9b49e94317e51861c4cef8f70db9dc01dccb33bcdaf59d370868681176434004`
- independent reconciliation SHA256 `80681eb7bf93a0c0ec5e12fee9c0af41698b65d26049f20c5d73d77e54b453e2`

Persistence is not forecast qualification or an active normal-consumer readback. The candidate universe remains the observed first 50; history remains the approved finite sample with explicit missingness. Roster-observation continuation probabilities are labeled uncalibrated assumptions, not future legal eligibility, dressing or start confirmation; appearance and start events remain distinct. No missing primitive, historical eligibility, candidate SO credit or opportunity is manufactured. The previously observed hosted schedule freshness/coverage and two start-clock differences remain a separate reconciliation task. No schedule-cache write, environment enablement or deployment occurred in this native publication run.
