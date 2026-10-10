# Offline native player qualification

Run this local diagnostic from `web/` with Node 22.11.0. It uses the current `captureForgeReconstruction` calculation, its query-capture write suppression, `captureForgeIssuedContexts`, and the unchanged `admitConsumerGameRevisions` / `publicPlanningForecasts` admission checks. It does not reserve a run, save a hosted snapshot, publish/select a revision, load environment files or contact any provider/database.

```sh
NODE_PATH=. ./node_modules/.bin/ts-node --transpile-only \
  --compiler-options '{"module":"commonjs","moduleResolution":"node"}' \
  scripts/qualify-native-players-offline.ts \
  --input scripts/fixtures/native-player-offline-synthetic.json \
  --input-sha256 244bd60b4f9aca636273826f6cf585c175c3c53452a0f8ff5898b5d7c9f70f54 \
  --as-of 2026-10-09T18:00:00.000Z \
  --output /tmp/native-player-offline-qualification.json
```

The output must be a new file. The command refuses overwrites, requires the original input's byte SHA256, checks it again after execution, and writes a private receipt with mode `0600`. Exit zero means the diagnostic completed; `qualificationEligible` remains false because the current native pipeline lacks required full-game bridges. Missing/late inputs and boundary violations produce a blocked receipt and exit one. Malformed arguments, checksum failures and existing output files fail without calculation.

The supplied example is **fictional**, including player IDs, game ID, receipts, confirmation reports and history. Its apparent club names and dates do not make it an NHL forecast. It exercises 36 skaters, two teams and two goalie outputs; exact playing/starting evidence for two fictional targets exercises admission. It does not use the OTT–NJD/Hughes/Allen identity handoff or assert Yahoo eligibility. The receipt reports diagnostic values, not a public forecast payload.

## Supply retained inputs

Use a new `native-player-offline-inputs-v1` JSON manifest following the example and exported TypeScript type. Set `classification` to `retained_exports` only for genuine supplied exports. Keep all original captures and receipts immutable; do not refresh, relabel or backdate them to make the manifest pass.

- Supply one `slateDate`, positive `gameId`, regular-season game phase (`games.type = 2`), and explicit target canonical/NHL/team IDs and player classes. Supply `--as-of` as a zoned timestamp no later than execution and strictly before puck drop.
- Supply complete, bounded exports for **every table queried**, including explicitly captured empty tables. A missing table is a failure, including when the native producer catches an optional-query error. The example shows the current required table families; retained inputs must cover the actual requested predicates/windows. Joins, relation-scoped options, unknown options/argument shapes and implicit filter type coercion fail closed. The only select options are exact count and boolean HEAD (HEAD requires exact count and returns null data); order supports only boolean `ascending`. Zoned timestamp filters preserve microsecond ordering.
- Every table needs `source`, immutable `revision`, descriptive `scope`, `complete: true`, exact `rowCount`, and `rowsHash = projectionInputHash(rows)` from `lib/projections/inputCapture`. This canonical hash sorts object keys with JavaScript `localeCompare`; use that existing function rather than a different JSON serializer.
- Supply original `publishedAt`, first `receivedAt`, and actual `verifiedAt` times, ordered and all at or before the cutoff. Missing upstream timing/completeness evidence is a blocker; an exporter timestamp is not a substitute. Source/arrival and event timestamp fields in the rows are also checked against the cutoff, including camel-case names and microseconds. Completed-stat, aggregate and referenced historical-game dates are bounded by the cutoff and original publication. A date on the cutoff day requires explicit retained completion time; a referenced game with future puck drop cannot supply history. Future scheduled games and expiry times remain valid schedule metadata.
- Preserve every queried column explicitly, including genuine nullable values. An omitted column is rejected; the adapter never replaces it with null or zero. The synthetic example explicitly declares its fictional null fields.
- Supply current game/schedule/roster/identity exports, eligible rolling EV/PP histories and team/goalie inputs, plus the exact accepted lineup/goalie/conflict/accepted-news receipts needed for participation and freshness. Roster membership and PP role alone do not establish an appearance or start.

### Retained timestamp inventory

This inventory follows the current native input readers (`issuedContext.ts`, `dailyBoardEvidence.ts`, `acceptedNews.ts`, market queries and preflight), including tables empty in the fictional example. Snake/camel spellings and prefixed forms use the same cutoff check.

| Retained source | Cutoff-bound input times | Other time meaning |
| --- | --- | --- |
| Every table's original receipt | `publishedAt`, `receivedAt`, `verifiedAt`, in that order | Original evidence times, never replacement exporter times |
| `roster_optimizer_team_games` | `fetched_at`, `source_updated_at` | `start_time` is a scheduled future event |
| `rosters`, `fhfh_player_identities` | Membership `created_at`, identity `updated_at` | Identity does not establish participation |
| Lineup snapshots / goalie observations / assignments | `observed_at`, `available_at`, `created_at` (assignments use `created_at`) | `expires_at` is future validity metadata |
| Observation conflicts / resolutions | `detected_at`, `resolved_at`, `created_at` | Conflict policy stays in the unchanged reader |
| `forge_board_news_events` | `accepted_at` | Admission also checks the retained accepted-news revision |
| Game / prop market inputs | `source_observed_at` | `freshness_expires_at` is future validity; `snapshot_date` selects the target slate |
| `forge_roster_events` | `created_at` | `effective_from` / `effective_to` describe applicability; native queries select the eligible window |
| Completed-stat / aggregate / referenced-game history | Historical dates, completion and source/event evidence times | Existing history rules also bound dates by original publication |

Only retained input rows and original receipts are checked against the supplied information cutoff. The current local reconstruction creates new context `observedAt`, captured-read `receivedAt`, snapshot `capturedAt`, calculation metadata and receipt `createdAt` at actual execution time. Those artifact generation times can be later than the historical cutoff; they neither replace original acquisition times nor make late-fetched inputs available earlier. The harness leaves future scheduled/expiry/effective metadata to its existing meaning and the unchanged native readers/admission.

The completeness declaration is supplied evidence, not independent validation of an upstream export's population. `inputCoverage` reports each target's retained EV/PP/PK and goalie history row counts, roster binding and native output presence. These counts do not certify full exposure, all eligible history, or empty-history zeroes. No new probability, weight, prior, mean or native model is introduced.

## Read the receipt

`codeCommit`, loaded repository `codeFiles`/`codeHash`, lockfile hash, input byte hash, canonical `inputHash`, stable `outputHash`, `calculationQueryHash` and `resultHash` pin the diagnostic. The receipt retains exact in-memory requests and their `runtimeRequestsHash`. Actual `createdAt` and assessment-time requests vary between runs; the calculation/result hashes remain reproducible for the same inputs, code/configuration and admission time window. All model configuration recorded is the native runner's existing non-secret whitelist. The report records both declared and effective classification. Fictional receipt provenance or rows matching the immutable checked-in fictional artifact preserve fictional status; a contradictory `retained_exports` label blocks calculation. These checks cannot authenticate arbitrary operator-supplied bytes as genuine sources. Native model configuration is inherited; only the local capture/compute path and disabled serving/scheduler/challenger switches are scoped to the invocation and restored afterward.

Admission receives a clearly marked `offline-diagnostic:` envelope containing real suppressed output rows, the actual captured-read receipt, actual creation time and context derived through the existing context reader. Nothing is backdated to the cutoff or represented as a hosted selected revision. Freshness is evaluated only against the supplied retained accepted-news export, never current hosted state. `acceptedByUnchangedConsumer` records that existing gate's verdict; it does not grant full category coverage, eligibility, publication or task 5.3 acceptance.

| Target | Current native modeled support | Remaining qualification reason |
| --- | --- | --- |
| G, A, SOG | Complete public targets remain missing when PK heads are null | PK heads and full-game event/exposure bridge |
| PPP | Existing serialized PP goals + assists diagnostic count | Nonempty PP history, finite counts and positive TOI denominators are necessary; rolling aggregates cannot certify complete PP event/exposure coverage, so support remains blocked |
| HIT, BLK | Existing conditional heads | Full-strength exposure is unproven |
| W, GA, SV | Existing conditional-on-start candidates | Opponent full-game shots, goalie spells/relief and, for W, full-game goals driver |
| SO | Existing conditional candidate | Same goalie coverage plus official individual shutout-credit bridge |

The report lists all ten targets for each target identity, marking the other player class's targets `not_applicable`, and separates `present_native_diagnostic` / `missing` modeled values from admitted diagnostic values and blocked-use reasons. A numerical native mean is never itself a source-support verdict. Zero retained PP rows or missing/zero exposure denominators remain explicit blockers; empty exports are not evidence of zero events. PIM and GAA are not required gates. Unknown participation remains unknown; even confirmed PP role cannot promote a conditional skater mean.

The independent offline fence rejects fetch/HTTP/HTTPS/socket/TLS/HTTP2/datagram/WebSocket and process-launch attempts. It resolves module filenames and real paths before loading code, so aliases, relative/absolute imports and symlinks receive the same in-memory server adapter. Named `getServiceRoleClient`, eager public/read-only/browser clients, other Supabase utilities and SDK package entry points are blocked at runtime before client configuration or constructor access. Builtin ESM bindings share the socket/process fence. Fresh-process regressions use inert configuration/SDK sentinels and detect any access. The adapter rejects RPCs and mutations; native intended mutations are captured and suppressed by the existing interceptor. Use the documented fresh CommonJS CLI in a dedicated process because the fence and native interceptor are process-scoped. This is a boundary for the current trusted native module graph, not a security sandbox for arbitrary ESM loaders, previously copied client/constructor references, native addons or hostile code. Do not run concurrent invocations in one process.

## Verification and next input gap

```sh
npm test -- --run scripts/qualify-native-players-offline.test.ts --configLoader runner
NODE_OPTIONS=--max-old-space-size=8192 npx tsc --noEmit
npx eslint scripts/qualify-native-players-offline.ts scripts/qualify-native-players-offline.test.ts
```

The next concrete input is a genuine one-game manifest with complete counted native exports and original cutoff-bound lineup/start receipts. The old October 7 captures lack current issued contexts, complete counted rolling reads and participation evidence; they cannot be relabeled as October 12 inputs. Even a complete rolling/export manifest leaves PP event/exposure support and the documented PK/full-game/goalie-credit bridges blocked; this harness does not certify those bridges from aggregate rows. This tooling provides a repeatable local calculation and qualification report while those independent prerequisites remain unfinished.
