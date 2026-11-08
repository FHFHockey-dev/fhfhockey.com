# Independent review — frozen candidate v4

**Verdict: accepted for the reviewed local held/shadow slice.** R1–R9 are closed within their tested boundaries. No new defect was found in the six-path v3→v4 diff. This is not blanket feature completion, hosted migration approval, pilot activation, production delivery/idempotency acceptance or evidence of future performance.

Candidate: `next-increment/owned-source-v4-sha256.json`, **41 files**, SHA256 **8a6e3b3c27cf60860b206a4dfd068dbc0aede9ceb76ea03b815e42ffc97ac958**. Canonical `octoberBranch`, HEAD `a8f58de6178e282acd3a71851c66f4a56b119f14`, changes uncommitted. All hashes matched before and after tests. Exact candidate copies, frozen manifest and post-test `integrity.json` are retained under `review-v4/`. The owner held all pins during review; all 41 were released after verification. No implementation file was edited by this reviewer.

## V4 findings resolved

- **R8 — complete schedule identity:** `applyTweetClaimSourceHints` now always performs the bounded team/date schedule query. An incoming game-ID cache does not establish schedule completeness. One exact applicable game permits the dated official-roster path; multiple/capped matches keep the source unresolved. The unchanged independent pure failure now passes. The unchanged actual projection-storage hook failure also passes: the two-game original remains stored with `gameId:null` and no manufactured directory binding. The current source suite verifies both the positive single-game hook and the ambiguous partial-cache case.
- **R9 — retained original post agreement:** public news attribution now checks retained quoted IDs and quoted URLs from both item and provenance metadata against the selected post. Contradictions suppress attribution and link as pending. The unchanged independent quote-ID failure passes; added matching-evidence and item/provenance conflict cases pass alongside NewsCard DOM regressions.
- **Midnight fixture:** fixture clocks are derived from one instant; publication and receipt are clamped to its Eastern midnight and the game's date/start use that same instant. The explicit four-boundary regression passes, and the full registry suite passes. The original v3 midnight failure evidence was preserved unchanged.

The six changed files are source hint implementation/test, news implementation/test, registry test and qualification storage test. Both staged SQL files, replacement RPC integration, canonical continuity/global ledger and original r3 modules are byte-identical to the previously reviewed v3 pins. No broader refactor or weakened production qualification gate was introduced.

## Verification actually run

| Check | Result | Evidence |
| --- | --- | --- |
| Nearby news, NewsCard, source hints, original seven reviewer regressions and unchanged R8/R9 pure cases | **63 passed**, 0 failed; 60 distinct cases because importing the hint fixture also registers three duplicated helper tests | `focused-results.json`, `focused-run.log` |
| Current registry and qualification storage suites | **31 passed**, 0 failed: 29 actual disposable-Postgres cases plus disabled-delivery and midnight-clock unit cases | `postgres-results.json`, `postgres-run.log` |
| Unchanged independent R8 actual storage-hook regression on fresh current fixture | **1 passed**, 14 inherited cases intentionally filtered | `independent-postgres-results.json`, `independent-postgres-run.log` |
| Manifest and complete 41-file hash verification, before/after | **Passed** | `frozen-owned-source-sha256.json`, `integrity.json`, `frozen-source/` |
| Scope/diff inspection | **Passed**, exactly six expected paths changed from v3 | Diff captured during review; candidate copies retained |

These are 92 distinct assertions executed for v4, not an additive count across all review rounds. The three formerly failing R8/R9 assertions were copied unchanged; the independent Postgres probe uses the current frozen fixture setup without running its inherited tests.

The owner reports aggregate TypeScript and scoped lint exit 0. Those are author evidence, not checks independently repeated here. Full unit suite, browser tests, build, hosted checks, live source receipt acceptance and a complete 52-case DSL run were not performed. No successful check was repeated after its pass without a new change/failure requiring it.

## Accepted local boundary

Prior reviews' evidence remains attached. R1–R4 cover exact immutable retries, tested public attribution fallbacks and prospective causal clocks. R5–R7 cover global material-rebind holds on both scopes, explicit durable canonical state/allocator/cutoff continuity and incomplete-audit handling. Their canonical/SQL implementation is unchanged in v4; the current real storage suite exercises those paths again.

The accepted slice includes software claim extraction/retention, observed original/quoted/relay lineage, dated source-directory priors with independent official binding, unambiguous source hints, immutable evidence and legacy-presence retention, atomic raw/canonical/outbox transactions under CAS, bounded fault recovery and held proposals. The upfront shared raw-intake count/time gates and separate sample limits have local handler/RPC evidence. Public news/line DTO and DOM assertions establish the tested original-only suppression cases.

This is actual local integration evidence: tests invoke the real projection-storage/shadow/storage functions and replacement RPCs against the two exact staged migrations in disposable Postgres, including rollback, concurrent scope changes and acknowledgement loss. It is not an upgrade of pure r3 tests into durable acceptance. Both handler branch tests and separate real storage tests remain compositional; no authentic webhook→job lease→handler→hosted database chain was executed.

The upstream registry remains byte-identical at SHA `03f58f5793b5083dd48935ab525f869205e338798b45d768c9008c0b55004468`; the adapter retains only the two reviewed import substitutions at local SHA `78a0e2cce23be93a07f781477657dad6bfa1cd74dfb6a73ffe68a082724b2332`. Earlier original ZIP/1,144-file manifest and reducer-integrity checks remain applicable. Extraction version is `.4`.

Staged SQL hashes remain:

- Registry: `7570300e3e6dfc6a899e2296fa20483ee02ad206c1e0e1f3a966ba1d29847ea7`.
- Qualification: `510eae121f939ffe4e2c3ebd953df1d5206f5e423cdbd014c88e43812a4906bb`.

## Withheld acceptance and exact remaining gates

1. **Actual legacy/deployed consumer safety:** the 14-sink detector implements conservative scoped presence/holds, not independently authenticated historical absence, exact committed-receipt reuse or a complete deployed writer/consumer inventory. Real dated identity receipts, immutable legacy keys/payloads, retention/writer-fence proofs, consumer idempotency and authoritative readback remain unverified. Reconstructed aliases and fixture-only complete histories do not clear those gates. Every outbox candidate stays held; a future delivery worker must enforce the complete current global/canonical/history decision, not merely clear a flag.
2. **Unsupported semantic/transition behavior:** this is the reviewed reduced r3 integration, not execution of all 52 formal acceptance cases or approval of every lineup/session/transaction/correction scenario. Pending dated binding, ambiguous scope, provenance/legacy disputes and unsupported claims remain retained exceptions. Corrections, compensation and A→B→A acceptance need a separately reviewed policy before dispatch.
3. **Authentic sources and prospective results:** exact applet/account/configuration and natural receipt evidence for DFOFantasy/NHL_Rosters remain pending the bounded evidence package. No genuine future cohort samples, human adjudicated labels, authenticated export or future metrics are accepted. The development corpus is not an untouched holdout. A future pilot still requires approved source/date/count/frequency/runtime/request bounds and enforced stop conditions; software limits alone are not activation authority.
4. **Operations:** reconcile authoritative migration inventory and actual deployed prerequisites, approve exact final SQL, and later approve a release candidate SHA with every linked Vercel project/root/environment/branch/trigger/ignored-build entry. Hosted DDL, deployment, environment changes, ingestion/cron activation, dispatch, replay and historical corrections remain separately unauthorized.

No further local source change or broad test is required for **this review scope**. New changes require new pins and proportionate verification; they must not inherit blanket acceptance from this report.

## Reproduction

From `web/` with existing Node 22.11.0 dependencies:

```sh
npm test -- --run lib/newsFeed.test.ts components/NewsFeed/NewsCard.test.tsx lib/sources/tweetClaimSourceHints.test.ts ../tasks/ifttt-integration-2026-10-16/review/independent-regressions.test.ts ../tasks/ifttt-integration-2026-10-16/review-v4/independent-hint-provenance.test.ts --config ../tasks/ifttt-integration-2026-10-16/review-v4/vitest.review.config.mjs
IFTTT_POSTGRES_BIN=/opt/homebrew/opt/postgresql@17/bin npm test -- --run lib/sources/tweetClaimRegistry.test.ts lib/sources/tweetClaimQualificationStorage.test.ts --config ../tasks/ifttt-integration-2026-10-16/review-v4/vitest.review.config.mjs
IFTTT_POSTGRES_BIN=/opt/homebrew/opt/postgresql@17/bin npm test -- --run ../tasks/ifttt-integration-2026-10-16/review-v4/independent-postgres.test.ts -t 'independent: actual hook' --config ../tasks/ifttt-integration-2026-10-16/review-v4/vitest.review.config.mjs
```

Only `review-v4/` artifacts were written. Tests used private disposable Unix-socket Postgres clusters with TCP listeners disabled; all were stopped and removed. HTTP(S)/fetch denial remained active except explicit fixture mocks. No external source or hosted database read, production DDL/write, real dispatch, replay, credential read, install, remote build or deployment occurred. No external action is denied, pending or of uncertain outcome.
