# Full52 reconciliation checkpoint

This increment changes task artifacts only. Accepted73 runtime/source/test/SQL bytes and all original fixture/result/reviewer inputs remain unchanged. Original outcomes are not overwritten; authentic future samples/outcomes were not read. New reconciliation review is pending.

Source manifest: `owned-source-sha256.json`, **85 pins** (accepted73 plus12 task-local files), SHA256 **7af1f2199fc997238057164b769f4cc21d52a7404c93ecccd386634da02ae531**. The fixed historical input whitelist is `read-only-inputs-sha256.json` (19 files). Hold these owned source pins for the next independent review; root-owned read-only dependencies remain their owner's files.

## Precise original and approved-fixture accounting

All52 original cases and all227 original assertion objects are retained in `outputs/full52-reconciliation.json`, with actual values, exact case/result paths and hashes, projection boundaries and review links. `CASE-LEDGER.md` provides all52 rows.

| Evidence | Cases | Matching original assertions |
| --- | --- | --- |
| Original pure registry/reducer/qualification runner | 41 pass,2 original positive conflicts,9 persistence deferrals | 194/196 checked |
| Separate independently reviewed actual durable/parent/consumer projections | 9 bounded local persistence cases | 31/31 |
| Original ledger across these different boundaries | 50/52 rows match fully | 225/227 |

CR011/CR051 preserve their original failed positive assertions. TJ explicitly classified their whole-text tonight/tomorrow variants as ambiguous and authorized separate corrected positives. Those v2 positives use complete retained text and disjoint explicit date/game-one/game-two anchors, pass12 assertions and preserve all7 original game-separation assertions. Their ambiguous originals pass zero-additional-action hold controls in pure and real RPC storage; authenticated edits remain a separate held revision test. None of this relabels the original oracle as52/52 or demonstrates an end-to-end production pipeline.

Fresh normal and mutation pure result rows are byte-for-byte JSON-equivalent to the accepted historical review rows. The original runner's exit1 is preserved for CR011/CR051; mutation exit1 additionally rejects CR019 assertion2 with immutable replacement count1 instead of0. The copied adapter changes only output/current core-manifest paths and TypeScript hash overloads; the copied approved-fixture tests change paths/types only. `adapter-copies.diff` and `outputs/adapter-copy-integrity.json` record these comparisons. Original assertion logic, fixtures and prior results remain unchanged.

## New checks actually run

**23 distinct focused tests passed**, across targeted runs:

- 9 reconciliation/negative-control tests reject missing/duplicate cases, changed/omitted assertions, forged pass flags, pure-only persistence scoring, weakened corrected fixtures, unsafe ambiguous carriers, collapsed durable identities and undetected immutable mutations; live drift is reported separately from historical snapshot evidence.
- 6 approved-fixture controls pass: exact original hash/assertion retention, two explicit positive documents, two ambiguous-original hold controls and one authenticated-edit revision case.
- 4 actual private-PG checks use the real context/commit RPCs and all three accepted core migrations: all12 corrected-positive assertions pass durably; both original ambiguous variants retain one canonical occurrence, no additional reviewable effect/dispatch and all raw carrier rows held for review. Synthetic prebound directory/identity/history inputs remain explicit; no NLP/authentic-source proof is claimed.
- 4 private-PG catalog proposal checks pass: metadata-only fingerprints without stored values/function bodies/helper invocation, missing-relation reporting, overload guard and payload-size guard.

Scoped TypeScript passed after local copied-harness typing repairs; exact final log is `outputs/frozen-scoped-tsc.log`. No aggregate compiler/build, browser test or hosted execution occurred. Private clusters use Unix sockets/TCP disabled and were stopped/removed; `outputs/owned-process-check.json` records no remaining owned PG process. No compiler/test remains active at this checkpoint.

Earlier failures are preserved: copied legacy harness Buffer/Vitest typing mismatches (fixed only in task copies), an initial raw-carrier-count assertion using the wrong identity metric, and a catalog-test PG startup failure on a long temporary socket path (short `/tmp` path succeeds). The carrier metric is explicitly corrected to the native canonical effect ledger; two review-only raw carriers are not counted as two native effects. The initial catalog suite failed before executing its four cases, and the corrected run passed all four. A later strict reconciliation run correctly stopped when a root-owned dependency changed; it now checks retained accepted snapshots and reports live drift separately.

## Dependency ownership and remaining blockers

All11 retained accepted dependency snapshots match. Live `web/lib/player-forecasts/contributions.ts` changed concurrently from accepted hash `282c8b1e9c7362190c39a48b031e392afb6c2abaa45190d8f83d95d6319f9df7` to observed `af6bbef4898cae4805c079deba37162269ee19bd648b6192a153bd3083c38f5b`; the inspected diff adds catalog-expiry admission fields/checks. It was not edited/restored by this task. Exact live drift is included in the ledger and `outputs/live-dependency-drift-initial.json`. Historical consumer acceptance remains valid for its retained bytes; compatibility of a new combined runtime awaits that owner's exact checkpoint/review. Do not claim all11 current live dependencies match the historical acceptance.

`HOSTED-ACCEPTANCE-PACKAGES.md` prepares the exact next catalog proposal and gated migration/history/fencing/queue/future-evaluation sequence. SQL proposal SHA256 is `761fa7e4b69efd41f56bde3b99fa52d4211e9150319cb1e08de11c2a5c40ffe6`: project fyhftlxokyjtpndbkfse, one separately authorized read-only call,23 allowlisted relations, at most16 overloads of5 named RPCs,5-second statement/2-second lock timeouts, no retry, SQL JSON output at most8KiB. It has **not** been executed remotely and is not covered by earlier or combined-goal approvals.

Concrete unresolved inputs/gates are the five known absent LineClaim relations and migration authority/order, exact deployed definitions/ACLs/triggers, natural original/receipt/legacy keys, complete real history and writer fencing, raw receiver/external queue acknowledgment, genuine future samples/labels, and every operational mutation/activation approval. The static106-file reference index is an ownership/audit starting point, not writer completeness or fence proof; `webhooks/` is absent locally. Exact-key executable history SQL cannot be finalized before genuine IDs and schema are known; no identifiers were guessed.

Next: independent review of the85-file reconciliation pin, original assertion accounting, approved fixture separation, raw/native identity metric and unexecuted hosted proposal. Further local receiver-job acknowledgment integration remains a separate bounded increment outside the original52 projections. No production action, staging, commit, push, deployment, schema promotion, scheduler/cohort activation, live ingestion/dispatch/replay/correction or new credential work occurred.

## Reproduce

From `web/`, run the two pure commands with `NODE_PATH=.` and the `deny-network.cjs` preload, `ts-node --transpile-only --compiler-options '{"module":"commonjs","moduleResolution":"node"}'` against `run-acceptance.ts --occurrence-identity-candidate` and additionally `--mutation-control`; each expected exit is1 for the original failures above. Run `reconcile.ts` through the same interpreter/preload; expected exit0. All output paths are confined to this increment's `outputs/`.

Run focused Vitest files with `npm test -- --run ../tasks/ifttt-integration-2026-10-16/full-acceptance-reconciliation/<file>.test.ts --config ../tasks/ifttt-integration-2026-10-16/full-acceptance-reconciliation/vitest.config.mjs`. Private-PG files need `IFTTT_POSTGRES_BIN=/opt/homebrew/opt/postgresql@17/bin`; `game-scope` and `reconcile` need no database. Scoped compiler: `npx tsc --noEmit -p ../tasks/ifttt-integration-2026-10-16/full-acceptance-reconciliation/tsconfig.json`.
