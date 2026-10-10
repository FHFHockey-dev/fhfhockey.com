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
- Supply complete, bounded exports for **every table queried**, including explicitly captured empty tables. A missing table is a failure, including when the native producer catches an optional-query error. The example shows the current required table families; retained inputs must cover the actual requested predicates/windows. Joins and unimplemented query operators fail closed.
- Every table needs `source`, immutable `revision`, descriptive `scope`, `complete: true`, exact `rowCount`, and `rowsHash = projectionInputHash(rows)` from `lib/projections/inputCapture`. This canonical hash sorts object keys with JavaScript `localeCompare`; use that existing function rather than a different JSON serializer.
- Supply original `publishedAt`, first `receivedAt`, and actual `verifiedAt` times, ordered and all at or before the cutoff. Missing upstream timing/completeness evidence is a blocker; an exporter timestamp is not a substitute. Source/arrival fields in the rows are also checked against the cutoff, including microseconds. Future scheduled start/expiry times are not source arrival times.
- Preserve every queried column explicitly, including genuine nullable values. An omitted column is rejected; the adapter never replaces it with null or zero. The synthetic example explicitly declares its fictional null fields.
- Supply current game/schedule/roster/identity exports, eligible rolling EV/PP histories and team/goalie inputs, plus the exact accepted lineup/goalie/conflict/accepted-news receipts needed for participation and freshness. Roster membership and PP role alone do not establish an appearance or start.

The completeness declaration is supplied evidence, not independent validation of an upstream export's population. `inputCoverage` reports each target's retained EV/PP/PK and goalie history row counts, roster binding and native output presence. These counts do not certify full exposure, all eligible history, or empty-history zeroes. No new probability, weight, prior, mean or native model is introduced.

## Read the receipt

`codeCommit`, loaded repository `codeFiles`/`codeHash`, lockfile hash, input byte hash, canonical `inputHash`, stable `outputHash`, `calculationQueryHash` and `resultHash` pin the diagnostic. The receipt retains exact in-memory requests and their `runtimeRequestsHash`. Actual `createdAt` and assessment-time requests vary between runs; the calculation/result hashes remain reproducible for the same inputs, code/configuration and admission time window. All model configuration recorded is the native runner's existing non-secret whitelist. Native model configuration is inherited; only the local capture/compute path and disabled serving/scheduler/challenger switches are scoped to the invocation and restored afterward.

Admission receives a clearly marked `offline-diagnostic:` envelope containing real suppressed output rows, the actual captured-read receipt, actual creation time and context derived through the existing context reader. Nothing is backdated to the cutoff or represented as a hosted selected revision. Freshness is evaluated only against the supplied retained accepted-news export, never current hosted state. `acceptedByUnchangedConsumer` records that existing gate's verdict; it does not grant full category coverage, eligibility, publication or task 5.3 acceptance.

| Target | Current native modeled support | Remaining qualification reason |
| --- | --- | --- |
| G, A, SOG | Complete public targets remain missing when PK heads are null | PK heads and full-game event/exposure bridge |
| PPP | Existing serialized PP goals + assists conditional count | Exact retained PP inputs and playing evidence; fictional inputs never qualify |
| HIT, BLK | Existing conditional heads | Full-strength exposure is unproven |
| W, GA, SV | Existing conditional-on-start candidates | Opponent full-game shots, goalie spells/relief and, for W, full-game goals driver |
| SO | Existing conditional candidate | Same goalie coverage plus official individual shutout-credit bridge |

The report lists all ten targets for each target identity, marking the other player class's targets `not_applicable`, and separates modeled support from admitted diagnostic values and blocked-use reasons. PIM and GAA are not required gates. Unknown participation remains unknown; even confirmed PP role cannot promote a conditional skater mean.

The independent offline fence rejects fetch/HTTP/HTTPS/socket/TLS/HTTP2/datagram/WebSocket and process-launch attempts, injects the in-memory server client before CommonJS native import and blocks unused eager public/browser clients. The adapter rejects RPCs and mutations; native intended mutations are captured and suppressed by the existing interceptor. Tests also make any live SDK client construction fail. Use the CLI in a dedicated process because the fence and native interceptor are process-scoped; do not run concurrent invocations in one process.

## Verification and next input gap

```sh
npm test -- --run scripts/qualify-native-players-offline.test.ts
NODE_OPTIONS=--max-old-space-size=8192 npx tsc --noEmit
npx eslint scripts/qualify-native-players-offline.ts scripts/qualify-native-players-offline.test.ts
```

The next concrete input is a genuine one-game manifest with complete counted native exports and original cutoff-bound lineup/start receipts. The old October 7 captures lack current issued contexts, complete counted rolling reads and participation evidence; they cannot be relabeled as October 12 inputs. Even a complete manifest will leave the documented PK/full-game/goalie-credit bridges blocked. This tooling provides a repeatable local calculation and qualification report while those independent prerequisites remain unfinished.
