# Independent durable occurrence v1 review

Verdict: **bounded local held/shadow allocator integration is supported; broader candidate acceptance requires corrections.** R14 identifies a contradictory supplied fixture date; R15 shows that the separate-date positive does not yet pass through durable qualification. The older registry integration harness also needs its acknowledged third-migration setup repair and rerun. No unsafe dispatch was observed. No full-52, authentic-source, operational or exactly-once acceptance is granted.

Reviewed source manifest: `../durable-occurrence-increment/owned-source-sha256.json`, **56 files**, SHA256 **f5b5bba612889b5a7ffa8f1ba7c9547166965bc471522839659ce485172cd87a**. Every pin matched before and after checks. Relative to occurrence v2, only lineage, qualification storage, its test, and the pure runner changed among the previous 49 pins; seven paths were added. Original cloud r3 registry, adapter reconciliation, reducer, first two SQL proposals and original oracle remain unchanged. This verdict is tied to these exact bytes, preserved in `frozen-source/` and `frozen-owned-source-sha256.json`.

All **340** previously manifested reviewer artifacts were independently rehashed unchanged. No previous report, failure, oracle or source snapshot was overwritten. See `pin-check-before.json` and `evidence-summary.json`.

## Findings and required corrections

### R14 — supplied CR051 dates contradict the explicit source and applicability (P2)

Both records in `game-scope-fixtures-v2/cases.json`, case `CR051-POSITIVE-v2`, still contain `interpretation.scope.date: "2026-10-15"`. Their complete source clauses, `sourceApplicability.date` and Eastern effective dates all specify **2026-10-16**. The runner's `project()` drops the supplied scope date and reconstructs its interpretation date from `effectiveAt`, so the six author fixture tests pass without observing this contradiction.

`independent-fixture-contract.test.ts` fails on that exact supplied field. Its CR011 date and both positive source-digest/clock checks pass. Repair the explicit dates and reject supplied scope/applicability/Eastern-effective disagreement before projection; retain the contradiction regression. The owner acknowledged the finding and queued the bounded correction after release.

### R15 — corrected separate-date CR011 is not a durable two-action positive (P2 functional boundary)

The independent actual-RPC probe uses the approved CR011 full source text, exact Jordan Staal/CAR subject and predicate spans, game IDs 900012/900013, publication/receipt/interpretation clocks and explicitly prebound semantic facts. A fresh disposable schema supplies synthetic complete empty history and official identity receipts known before publication, with game roster dates matching each declared game's date. This tests explicit binding semantics; it does not claim natural-language extraction or genuine source authentication.

Both lexical occurrences allocate durably: one component, two tokens, `nextToken:3`, with prior allocation and derivation payloads preserved. Game 900012 produces one reviewable held action. Game 900013 produces none: `datedTweetClaimBinding` in `web/lib/sources/tweetClaimEvidence.ts` requires the identity row date to equal the original publication's Eastern day, **2026-10-16**, and rejects the correctly declared second-game date **2026-10-17** as `dated_identity_team_league_or_role_conflict`. Total reviewable actions are **1**, while the versioned positive expects **2**.

Repro: `durable-probes.test.ts`, filter `independent durable.*CR011-POSITIVE-v2`; full evidence in `cr011-storage.log`, `cr011-storage-results.json` and `cr011-storage-summary.json`. This is a conservative hold and an existing same-day restriction exposed by the newly requested positive boundary, not a newly unsafe dispatch regression. The pure reducer's passing separate-date fixture cannot establish durable qualification acceptance.

The owner acknowledged the limitation and proposed explicit immutable game applicability evidence tied to game/team/date, exact source clause and causal clock. Verify that policy with actual positive and absent/conflicting-proof negatives; do not merely remove the date equality or infer scope from game IDs. Automatic source acquisition/extraction and authentic future-game authority remain separate gates.

### Known fixture gate — legacy registry harness omits the third migration

`web/lib/sources/tweetClaimRegistry.test.ts:97–98` installs only the first two staged SQL files, while the current qualified path requires `durable-tweet-occurrence-v1`. The owner identified this before execution and queued the third SQL setup change. This reviewer did not run that known incompatible setup or misclassify its missing protocol as a runtime regression. Repair and rerun its affected integration/recovery cases before treating that prior coverage as current. The qualification suite used here installs all three migrations.

## Actual integration reviewed and supported

`retainQualifiedTweetClaimScope` reads `read_tweet_claim_context`, retains immutable input retry checks, plans the counter ledger over retained component observations, and supplies it to `qualifyTweetClaimScope`. `commit_qualified_tweet_claim_scope` uses the existing global clock lock/CAS, checks the expected component/fingerprint, commits raw observations plus ledger/qualification/outbox atomically, and increments the context clock. Context receipt/original indexes bring the retained bounded component into planning. Multiple previously allocated components and unmapped legacy canonical state stay held rather than being silently merged or remapped.

The third staged SQL validates prior allocation/anchor/derivation/binding preservation and retained input hashes, plus bounded append-only allocation and original proof evidence. Its direct component update/delete trigger preserves prior ledger evidence. Functions are security invoker with explicit role grants/revocations and RLS enabled on the new relations. This is local source inspection and disposable-role execution, not a hosted ACL/advisor audit.

The current **21 actual PostgreSQL tests pass**, independently rerun against all three staged migrations. Their bounded cases include the actual projection-storage hook, unique provisional/verified/cross-wrapper token convergence, canonical/native identities, raw retry collisions, one-CAS-winner/loser reload, rollback, commit/raw acknowledgement loss, Unicode input, immutable ledger rewrite rejection through RPC/direct update, retained r3 reservation clocks, legacy/cutover holds, both-scope material-rebind blocking and finite retries/intake. Scope-wide receipt/legacy safety continues to depend on the retained proof boundary; no real consumer was released.

The independent **same-date CR051 actual-RPC probe passes**: exact prebound source clauses/game IDs and synthetic dated receipts produce two canonical occurrences and two reviewable actions in separate game scopes; both outbox rows remain `held` with `requires_review:true`. Earlier ledger allocations/derivations remain identical in the later component state. This uses the documented projection and therefore does not excuse R14's contradictory supplied date.

Native r3 IDs remain separate from allocated canonical occurrence IDs. Prior raw observations and immutable qualification versions remain evidence; an allocator token does not clear legacy history, prove original-source authenticity, authorize correction compensation, or guarantee delivery.

## Exact verification results

| Check | Outcome |
| --- | --- |
| Frozen candidate and prior reviewer evidence | 56 pins match; 340 prior files unchanged |
| Focused identity / lineage tests | 15 + 7 passed |
| Copied author versioned game-scope tests | 6 passed |
| Independent fixture contract | 2 passed, 1 failed (R14) |
| Focused total | **30 passed, 1 failed; exit 1** |
| Current qualification actual-PG suite | **21 passed; exit 0** |
| Independent same-day CR051 actual-PG probe | **1 passed; exit 0** |
| Independent separate-date CR011 actual-PG probe | **1 failed (R15); exit 1** |
| Original unchanged oracle CLI | **41/43 pure cases, 194/196 assertions pass; CR011/CR051 fail, 9 deferred; exit 1** |

The original oracle SHA256 remains `d9fe45ca44042673ff0381cd0f1981074b196da99fb6fdf9da573ac5df84fd8b`. Every executed CLI assertion was structurally compared with that oracle. Corrected positives and the authenticated-edit revision are separate versioned fixtures; the original ambiguous variants remain unchanged negative examples. The six fixture tests verify disjoint complete-source lexical spans, separate scenarios/effects, retained negative holds and an edit held as a revision without an independent/compensating action. Those are synthetic declared semantics, not proof of platform authentication or NLP quality.

Each independent actual-PG positive ran in a **fresh private schema/cluster** to prevent the two fixtures' reused game IDs from contaminating their different dates. The 21 inherited tests in the copied harness were filtered out, not counted again. The first CR011 filter selected zero tests because the parameterized name includes quoting; its skipped log/JSON are preserved as `initial-filter-skipped-*`. The corrected `.*` filter executed exactly one probe. Skipped discovery was never counted as execution.

The copied game test writes only reviewer-owned output. The copied CLI differs solely in directing generated reports into this review directory; implementation imports and assertions remain unchanged. The independent prebound probes adapt the approved records into application envelopes with fresh content hashes and synthetic fixture receipts; they are not scored as any of the exact deferred DSL contracts.

Run from `web/`:

```sh
npm test -- --run lib/sources/tweetClaimOccurrenceIdentity.test.ts lib/sources/tweetClaimLineage.test.ts ../tasks/ifttt-integration-2026-10-16/review-durable-occurrence-v1/game-scope.test.ts ../tasks/ifttt-integration-2026-10-16/review-durable-occurrence-v1/independent-fixture-contract.test.ts --config ../tasks/ifttt-integration-2026-10-16/review-durable-occurrence-v1/vitest.review.config.mjs
IFTTT_POSTGRES_BIN=/opt/homebrew/opt/postgresql@17/bin npm test -- --run lib/sources/tweetClaimQualificationStorage.test.ts --config ../tasks/ifttt-integration-2026-10-16/review-durable-occurrence-v1/vitest.review.config.mjs
IFTTT_POSTGRES_BIN=/opt/homebrew/opt/postgresql@17/bin npm test -- --run ../tasks/ifttt-integration-2026-10-16/review-durable-occurrence-v1/durable-probes.test.ts -t 'independent durable.*CR051-POSITIVE-v2' --config ../tasks/ifttt-integration-2026-10-16/review-durable-occurrence-v1/vitest.review.config.mjs
IFTTT_POSTGRES_BIN=/opt/homebrew/opt/postgresql@17/bin npm test -- --run ../tasks/ifttt-integration-2026-10-16/review-durable-occurrence-v1/durable-probes.test.ts -t 'independent durable.*CR011-POSITIVE-v2' --config ../tasks/ifttt-integration-2026-10-16/review-durable-occurrence-v1/vitest.review.config.mjs
NODE_PATH=. ./node_modules/.bin/ts-node --transpile-only --compiler-options '{"module":"commonjs","moduleResolution":"node"}' ../tasks/ifttt-integration-2026-10-16/review-durable-occurrence-v1/run-acceptance.ts --occurrence-identity-candidate
```

No full compiler/build, browser or hosted check was started. The owner's aggregate compiler log was inspected and copied to `owner-aggregate-tsc.log`: it reports three player-forecast diagnostics, so **no aggregate TypeScript pass** is claimed. The owner's scoped lint and four metadata-package checks were not independently rerun. The bounded presence SQL was inspected locally; no catalog/helper call occurred here.

## Remaining gates and checkpoint

1. Repin R14's supplied-date consistency and R15's explicit game-date applicability policy; independently rerun these unchanged reviewer assertions plus positive/absent/conflicting proof controls. Repair/rerun the older registry fixture setup. Resolve or separately disposition the aggregate TypeScript failures before any combined release claim.
2. The nine exact persistence DSL gates remain deferred in the unchanged pure runner. The owner's later task-only CR039/CR040/CR052 harness was expressly outside this frozen review; its claimed results are **not independently accepted here**. Review it separately with its own immutable fixtures and fault/consumer boundaries. Do not equate the related 21 tests with those exact contracts.
3. Complete native/canonical consumer and legacy/writer inventory, exact original keys/payloads/receipts, dated retention/fence evidence, unknown delivery reconciliation and compensation policy remain operational gates. The existing local tests establish bounded held behavior only.
4. Authentic applet/source/dated identity inputs, genuine future intake/adjudication/export/performance, hosted column/function/ACL compatibility and separately approved migration/deployment/activation packages remain open.

All three SQL files remain staged outside the authoritative active migration tree and were used only in disposable storage. First two hashes are unchanged; third SQL SHA256 is `da694a388bcf27e475d536f99ce189b62c50afc7a6a22cdfeca8636b83c2a613`. No production application is implied.

The owner reports a separately approved terminal presence metadata read identifying five absent relations: `line_source_captures`, `line_claim_revisions`, `line_claim_relations`, `line_entry_revisions`, `line_pp_decisions`. The local record `../offline-completion/PRESENCE-READ-v2-RESULT.md` was read; this reviewer made no hosted request. These are prerequisites to reconcile, not permission to create them. Earlier guarded catalog evidence remains historical. No current denial or uncertain hosted action was encountered in this reviewer increment.

Reviewer ownership: **only `tasks/ifttt-integration-2026-10-16/review-durable-occurrence-v1/*`**. No implementation file was edited, staged or committed. Previous artifacts remain unchanged. Review snapshots and prebound probes are audit evidence, excluded from runtime/release inputs.

All 56 pins were rehashed unchanged immediately before the explicit release message to owner thread `01a14299-0127-7424-85aa-42578c6740ef`. **Source hold released.** No tests/compiler/database process remains running in this reviewer thread; all disposable clusters were stopped and removed. The owner is the only known IFTTT implementation writer and limited parallel work to nonpinned task artifacts during this review; unrelated repository writers were preserved and not audited/stopped.

Review artifacts remain stable after their manifest is generated. Any correction requires a new source pin and proportionate review. No production write/DDL, real ingestion, dispatch, replay, scheduler/cohort/forecast activation, remote build, push, deployment, external source read or credentials were performed/created by this reviewer. No uncertain outcome remains.
