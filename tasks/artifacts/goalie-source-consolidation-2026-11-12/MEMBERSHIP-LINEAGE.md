# Membership lineage and historical consumer contract

Local continuation of [IMPLEMENTATION.md](IMPLEMENTATION.md), on the sole shared `octoberBranch` checkout. This slice adds four pure TypeScript files. It does not bind an application reader, create a table, populate history, or produce a forecast. The existing Grid owner was notified of the exact non-overlapping claim; Grid/API/Start Chart/source files and existing history arithmetic were not edited.

## Source model and admission

`web/lib/projections/goalie/membershipLineage.ts` defines `goalie-membership-lineage-v1`:

- Each normalized membership event retains canonical goalie identity, old/new club, exact effective instant, recorded instant, evidence id, source record id and immutable source revision. A trade is one event used by both the outgoing and incoming stint. Official transaction/eligibility records can establish membership; an appearance or point-in-time roster snapshot cannot establish its start.
- Stints reference their entry and departure events. An explicit `ongoing` end requires a complete coverage receipt; `unknown` is a different end state. Unknown departure is never translated into indefinite membership. A returning club gets a new stint id.
- Coverage is a versioned producer attestation for the exact goalie, season and interval, with source coordinates and recording time. It must cover the whole requested window, including no-team gaps. Injury/scratch absences do not close club membership. Producer policy must distinguish a true NHL membership/assignment change from availability or an organizational contract.
- Supplied transitions before the reporting cutoff must be assigned on both sides, even when they precede the lookback. Missing records, unknown/date-only times, identity mismatches, missing revisions, conflicting source aliases, invalid clocks and overlapping intervals prevent complete admission. Offset timestamps normalize to UTC. Stints use inclusive starts and exclusive ends.
- The snapshot retains the input source coordinates, both clocks and explicit reasons. It describes current recorded history through a chosen window; it is not an as-issued archive. A correction must have a new source revision and be selected by the producer; callers must not blend competing revisions or use last-row-wins resolution.

This is a **typed internal contract**, not an untrusted-JSON decoder or proof that a source is authentic. A producer must authenticate records, reconcile a complete event history, select one authoritative revision, and persist the receipts. A string labelled `official_transaction` or a boolean labelled `complete` cannot do that by itself. An incomplete producer cannot synthesize completeness from appearances, current team fields, or current roster snapshots.

## Consumer behavior

`web/lib/projections/goalie/workloadContract.ts` builds `goalie-workload-consumer-v1`. It admits membership once and delegates all arithmetic to the existing `buildGoalieStintWorkload`; it introduces no competing share formula.

| Input | Historical result |
| --- | --- |
| NJD 10 starts / 15 member games, PHI 1 / 1 | Separate 10/15 and 1/1; combined **11/16 = 68.75%** |
| PHI games before the trade | Excluded from this player's denominator |
| Two PHI injury/scratch games after joining but before first appearance | Included: combined 11/18; no start or appearance fabricated |
| Pulled official starter and long relief | Start remains with the labelled starter; appearances and relief remain separate |
| Second trade back to NJD | A distinct third stint; raw counts sum to 12/17 in the fixture |
| Unknown trade time, departure, or coverage | Full denominator/share unavailable; lineage reasons retained |
| Complete schedule but unknown start label | Denominator stays available; start share unavailable; appearance share can remain known |
| Incomplete appearance report | Start and appearance shares unavailable; verified game denominator remains |
| Complete evidence and no appearances | Supported zero counts/shares |

Availability is optional game/player/team-scoped historical context. Missing status evidence becomes unknown; duplicate/conflicting annotations are rejected. Availability never filters membership opportunities or supplies future start probability. Counts with incomplete history are known portions, not complete zero outcomes; consumers must preserve null shares, reasons, and unresolved game ids.

`future.sourceContract` points to the existing `forge_goalie_candidates_v1` authority. `future.startProbability` is always null with `not_provided_by_historical_workload`. Historical share cannot qualify a forecast or be multiplied into future expected starts/credited wins by this contract. Team-window crease share remains a separate population from this player's membership-adjusted workload; current-roster tenure shares need not sum to 100%.

## Integration gates

1. Establish authoritative stored membership evidence and complete coverage without inferring dates. Select/record exact source revisions and canonical team mapping. No live source inventory was performed in this task.
2. Have the migration owner design persistence/backfill and receipt custody, under separate authorization. This artifact is not migration authority.
3. Coordinate exact reader files with their owners. Bind the typed adapter behind a validated transport/storage boundary, then prove served-reader semantics with fixtures. No existing consumer was switched by this continuation.
4. Keep forward candidate capture, eligible-universe coverage, evaluation/refit, qualification and reader admission separate. Synthetic history tests provide no calibration evidence.
5. Release/deploy and bounded live acceptance require their own authorization. Production re-normalization, release receipts and `servedForecastLedger` remain untouched.

## Verification and handoff

Final checks passed on Node 22.23.4, with local HEAD `24b1cb4d3048a3dba8234cf92c62e8f2b72f877f`:

- 44 tests across `membershipLineage.test.ts` (15), `workloadContract.test.ts` (9), existing `stintWorkload.test.ts` (14) and `historyLedger.test.ts` (6). Command from `web/`: `npm test -- --run lib/projections/goalie/membershipLineage.test.ts lib/projections/goalie/workloadContract.test.ts lib/projections/goalie/stintWorkload.test.ts lib/projections/goalie/historyLedger.test.ts`. Log: `/tmp/fhfh-goalie-membership-tests.log`.
- Scoped ESLint passed for the four new TypeScript files.
- Full `npm run typecheck` passed, exit 0. The earlier pass found nullable-clock narrowing in the new module; it was corrected before the final pass. Log: `/tmp/fhfh-goalie-membership-typecheck.log`. Concurrent workers may reuse this final result rather than retrying the earlier intermediate diagnostics.
- Final source diff review, tracked `git diff --check`, and explicit whitespace checks for all five new files passed. No browser/build test was needed for this pure-function slice.

The four TypeScript files, this handoff and the updated consolidation diary are local and uncommitted. No existing runtime/consumer file was edited by this continuation. No database/provider/application requests, forecast execution, migration, build, deployment, commit or push was performed. Full consolidation remains gated by the five integration steps above; the diary remains for that unfinished task.

## Stored-evidence continuation: recovered sources

Repository inspection only; no claim about current production contents:

| Source | Recoverable evidence | Limitation for membership tenure |
| --- | --- | --- |
| `supabase/migrations/20260818150256_player_forecast_season_v4_integrity.sql`, `player_forecast_season_roster_observations` | Canonical/FHFH and NHL identities, organization team, source key/hash, observed/available/effective clocks, immutable observation id, predecessor id | Organization affiliation is not necessarily NHL membership; no explicit old/new club pair; effective time is nullable |
| `web/scripts/generate-player-forecast-season-transaction-audit.ts` | Official tracker corroboration and capture hashes | Writes `effectiveAt: null`, `rosterStatus: unresolved`, and destination organization only; matches selected open conflicts, not a complete player tenure timeline |
| `web/scripts/import-player-forecast-season-transaction-audit.ts` | Persists those observations and source checksum | Chains `supersedes_id` by player across transactions; this is not proof that the earlier trade never happened |
| `latest_player_forecast_season_roster_observations` in the integrity migration | Latest observation per player and kind | Drops predecessor/older observations; unsuitable as the complete historical-event query |
| `web/lib/fantasy-projections/rosterReconciliation.ts` | Current roster conflict reconciliation and `transactionCoverage` metadata | Tracker capture/manifest coverage is not exact membership-interval coverage; does not fill missing effective times |
| `supabase/migrations/20261107192933_rosters_official_seen_at.sql` | Official roster seen time | `ended_at = now()` is refresh time; rejoining resets the existing player/season/team row. Neither preserves every stint boundary |
| `web/lib/player-forecasts/targetRosterObservation.ts` | Hashed original roster receipt and explicit continuation assumption | Existing contract explicitly says a roster observation is not an effective eligibility interval |
| `web/lib/projections/rosterEvents.ts` | Reviewed injury/scratch/start signals with source context | Availability is separate; tweet review time/TTL cannot establish authoritative club tenure |

The documented retained export `/private/tmp/fhfh-2026-27-official-transactions.json` was absent. No broader filesystem capture search, scripts, providers or database reads were run. Source hashes in stored rows are preserved references; this adapter does not authenticate original remote bytes or infer missing facts.

## Implemented source and persistence seams

`storedMembershipEvidence.ts` parses a bounded exact projection of the existing observations table and explicit canonical identity/team bridges. It preserves predecessor rows, source hashes and clocks. A separately reviewed `MembershipTransitionResolution` binds the source observation/hash to the interpreted old/new NHL clubs and an immutable resolution revision. It cannot supply a missing effective timestamp. Injury and point-in-time roster observations stay contextual; waivers/affiliate assignments remain unresolved until their membership semantics are established. Injured NHL status does not remove an otherwise established membership.

The adapter never translates the old `transactionCoverage.complete` into membership coverage. Its `coverage` remains null and `membershipComplete` false. A boundary event with null effective time remains null for lineage admission, even when its clubs are resolved. Callers must retain unresolved records and cannot construct a complete snapshot by silently dropping them.

`membershipSnapshot.ts` implements a server-side, pure persistence payload and reader, using Node crypto and the installed Zod package. `createMembershipSnapshot` validates inputs, verifies that existing arithmetic can consume them, and returns canonical JSON plus SHA-256. `readMembershipSnapshot` requires a separately trusted exact snapshot id/hash/player/season/game-type/window selection and read clock, validates bounds and integrity, then recomputes the consumer contract. It refuses unknown fields, injected cached shares/probabilities, identity/window mismatch, altered inputs, duplicate games, future persistence clocks and oversized input. It does not select "latest", open a database connection, or call the existing Grid reader.

The snapshot has a two-MiB bound, at most 2,000 team-game rows, 10,000 appearance rows, 256 membership events and 128 stints, for one player and one scoped season/game type. Limits are admission ceilings, not permission to query production to those limits. The checksum is of canonical JSON; semantically equivalent object-key ordering does not create a new content identity. Source record authentication and the trusted selection pin belong to the future producer/storage boundary.

## Persistence and reader integration proposal

Reuse source observations; do not rewrite old rows, treat `supersedes_id` as a history deletion, or change the current-roster RPC. Persist separately:

1. Immutable boundary-resolution receipts keyed by observation id, source hash and resolution revision, with the reviewed canonical identity/team mapping. Corrections add a new selected revision; original evidence stays addressable.
2. A dedicated membership coverage receipt proving every relevant assignment/exit and explicit no-team gap in the requested interval. Its policy must establish that injury/scratch does not end tenure, and resolve call-up/send-down/waiver semantics from authoritative evidence. The old organization/tracker coverage flag is insufficient.
3. The versioned snapshot input payload, immutable snapshot id, canonical content hash and creation time. Keep original source/resolution receipts addressable by the event references. Store a separately trusted selection pointer; do not accept a hash supplied alongside an untrusted body as its own authority.

The migration owner must choose the physical table(s), constraints, permissions, transaction and correction workflow. No migration or SQL proposal was placed in an authoritative migration tree. A future service-side reader fetches one exact selected snapshot and passes it to `readMembershipSnapshot`; it does not recalculate percentages in SQL, infer missing coverage, or refresh sources on a cache miss.

Grid source ownership was coordinated again, with an exact new-file claim. The Grid owner is independently fixing per-game forecast selection. Its UI/API/readers remain untouched. A player-tenure payload must remain separate from the Grid's team-window crease share: replacing the latter wholesale would change its denominator population. A concrete reader handoff is still needed before wiring this payload into a player-specific consumer.

## Concrete remaining blockers and minimum next steps

- **Evidence:** none of the inspected producers establishes complete exact membership intervals. Supply an already retained export for one chosen goalie/season containing raw historical observations (not the latest-only RPC), the canonical identity bridge, official effective-boundary records, and a coverage reconciliation receipt. The exact offline handoff and subsequent safety review are in [INVENTORY-AND-OWNERSHIP.md](INVENTORY-AND-OWNERSHIP.md). Its production query draft is held: recent normalization activity/I/O pressure triggered the stop condition, and response limits do not prove bounded database work. A revised reviewed access plan, production-owner clearance and specific read approval are required before any live inventory. No writes or provider capture are included.
- **Semantics:** source owner must resolve NHL membership versus organization/affiliate assignment and genuinely ambiguous trade times. A missing effective time requires authoritative evidence or an explicit unknown result; no backfill may substitute article/capture/refresh time.
- **Persistence:** migration owner must approve the physical design and separately authorize schema application/backfill with fixed scope. This local payload implementation is not an applied schema.
- **Reader:** exact consumer ownership and a storage selection adapter are needed. The existing Grid source files are still owned elsewhere. Reader fixtures can then use these pure functions without production access.
- **Forward:** candidate capture, evaluation/refit, qualification, reader admission, release and live acceptance remain separate; this work neither executes nor qualifies forecasts.

Final storage-stage verification: **61 tests passed across six files**, including 17 new fixture tests in `storedMembershipEvidence.test.ts` (10) and `membershipSnapshot.test.ts` (7). These include the full stored-row → membership → snapshot → reader → 11/16 path, missing dates/coverage, explicit identity bridges, injury/scratch/relief, immutable pins, tampering and bounded parsing. A new regression reproduced invalid JSON for explicit `availability: undefined`; canonical serialization now omits undefined optional object properties, and the final suite passed after the correction.

Scoped ESLint, full `npm run typecheck` (exit 0), tracked diff whitespace and explicit new-file whitespace checks all passed after the correction. Logs: `/tmp/fhfh-goalie-membership-storage-tests.log` and `/tmp/fhfh-goalie-membership-storage-typecheck.log`. All work remains local/uncommitted at the same `octoberBranch` HEAD. No existing Grid/API/reader/source importer, schema/migration, release file or forecast behavior was edited. No live/provider/database calls or production operations occurred.

## Fresh admission/snapshot review

[INVENTORY-AND-OWNERSHIP.md](INVENTORY-AND-OWNERSHIP.md) records retained evidence inspected, the seven reproduced adversarial failures and corrections, the explicit timestamp-precision limitation, a three-SELECT draft subsequently held by its execution-safety review (never executed), and exact remaining source/persistence/reader ownership. Source/provenance/read clocks preserve microseconds. The millisecond-based workload arithmetic is unchanged: nonzero sub-millisecond effective boundaries remain unknown, and unsupported game/window precision is rejected. Unsafe numeric identifiers, duplicate source-coordinate aliases and orphan appearances are rejected.

Final review checks: **68 tests passed across six files**, scoped ESLint passed for the six changed source/test files, full `npm run typecheck` exited 0, and diff/new-file whitespace checks passed. Logs: `/tmp/fhfh-goalie-review-before.log` (seven reproduced failures), `/tmp/fhfh-goalie-review-tests.log` (final pass), `/tmp/fhfh-goalie-review-typecheck.log` (final pass). All original trade/uncertainty/injury/scratch/relief fixtures still pass. This is fixture and local type evidence, not a live-source, deployed-reader, or calibration acceptance receipt.

## Retained-export gate and bounded lookup continuation

At shared HEAD `8b759f44aa13d5bbca29a82be132b70d149dc0f7`, added pure `web/lib/projections/goalie/membershipInventory.ts` and its test. `readMembershipInventory` validates the retained JSON's exact byte hash against an external owner pin, project, precise capture/read/source-cutoff clocks, canonical identity, expected observation UUIDs/source hashes, 128 KiB total and at most 32 rows. It rejects omissions/additions/duplicates and oversized source coordinates, then delegates to the existing admission adapter. It performs no I/O and supplies no membership-coverage proof.

Review reproduced a source-coordinate integrity defect: `storedMembershipEvidence` trimmed the original table's `source_key`, and snapshot encoding trimmed source record/revision coordinates. This also allowed a padded key to evade the inventory's byte cap. Those coordinates now remain exact through the owned adapters. Three regressions failed before correction. No Grid, importer, migration or live reader files were edited.

[BOUNDED-INVENTORY.md](BOUNDED-INVENTORY.md) replaces broad discovery with a single owner-pinned observation primary-key lookup, unique NHL identity lookup and metadata stop guard. The revised local review does not claim a measured resource bound, deployed access plan or transport qualification. Missing UUID/hash/identity receipt, index-plan evidence, tested runner and production authorization remain explicit gates. Existing-source checks included the generator/importer and both temporary directories; no authoritative export or observation UUID receipt was recovered. Phase E and the serial production queue were respected: zero database/provider calls.

Current fixtures: **80 tests passed across seven files**, including 10 inventory tests and two new exact-coordinate regressions in existing suites. Scoped lint passed. Logs `/tmp/fhfh-goalie-inventory-before.log`, `/tmp/fhfh-goalie-inventory-snapshot-before.log` reproduce failures; `/tmp/fhfh-goalie-inventory-tests.log` records the passing suite. The first full typecheck passed but overlapped Grid's final exporter edit. The post-freeze `npm run typecheck` passed exit 0, starting `2026-11-12T19:44:31.498263Z` and completing `19:45:44.563898Z`, with unchanged before/after hashes for all six changed membership source/tests and Grid's two frozen exporter files. Receipt `/tmp/fhfh-goalie-inventory-frozen-typecheck.json`; output in the adjacent `.log`. Grid was notified for exact-byte reuse. Whitespace/code-fence checks passed. All changes remain local and uncommitted.
