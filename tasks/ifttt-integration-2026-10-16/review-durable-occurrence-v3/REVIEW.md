# Independent durable occurrence v3 review

Verdict: **R14/R15 corrections and the tested local held/shadow integration are accepted within the boundaries below.** The queued SQL evidence guard and four original storage-case mappings were independently executed successfully. No new finding arose in this bounded rerun. Full original 52-case completion, opaque consumer/legacy-parent contracts, authentic source/future evidence and operational release remain open.

Reviewed manifest: `../durable-occurrence-increment/owned-source-v3-sha256.json`, **59 paths**, SHA256 **98e25223a81e300bc411e3e8dca05d2a151b374977b369d02b9a14fd6e2a05a0**. All pins matched before and after execution, immediately before explicit release. Exact bytes are preserved in `frozen-source/` and `frozen-owned-source-sha256.json`. All **493** earlier manifested reviewer artifacts were rehashed unchanged. Historical failures and source snapshots remain preserved.

Original cloud r3 registry, reducer, import-only adapter reconciliation, first two SQL proposals and original oracle remain unchanged. The third SQL guard is identical to v2; it received its first independent execution in this v3 review. This verdict attaches to the frozen manifest, not subsequently edited source.

## Supported corrections

**R14:** corrected supplied scope dates agree with explicit applicability and Eastern effective dates. The three original reviewer fixture assertions pass byte-identically. The six current versioned game tests also pass, including all supplied-date contradiction controls, exact disjoint source clauses, strengthened scenario/effect assertions, original ambiguous negatives and the authenticated-edit revision hold. No original CR011/CR051 assertion was changed or scored as passing through replacement fixtures.

**R15:** the receipt validator requires an offset-bearing publication, start and raw effective clock, compares receipt/raw applicability as the same instant, and bounds both clause endpoints within the exact retained source. The five original reviewer negatives pass unchanged. Nearby source tests additionally cover timezone-less midday start, null/local/mismatched effective clocks, missing/conflicting receipts, late/mismatched identity and unproved/ambiguous dates. Equivalent offset-bearing strings for the same instant are accepted without rewriting either retained string.

The optional receipt participates in raw claim identity. A changed receipt under the same observation ID rejects. Envelopes without a receipt retain the prior publication-day restriction. The helper supports an explicitly prebound game and exact clause; it does not choose a game, perform multi-game NLP or authenticate a future official roster.

**Actual corrected positives:** both CR011 separate-date and CR051 same-date fixtures pass through the actual replacement context/commit RPCs in fresh schemas. Exact synthetic Jordan Staal/CAR documents, lexical spans, game IDs and clocks produce **two canonical tokens and two reviewable held actions**, separated by game. Retained receipt tampering rejects without changing the original observation. These tests establish declared prebound binding semantics with synthetic dated/history evidence, not genuine platform/source authority.

## Independent actual date-policy matrix

Eight additional actual-RPC cases use the approved CR011 second-game record and a fresh schema per case:

| Evidence variant | Qualified reviewable actions |
| --- | --- |
| Valid explicit receipt and source-time identity | 1 |
| Equivalent raw effective instant with `-04:00` offset | 1; original raw string retained |
| Missing receipt | 0 |
| Conflicting receipt game | 0 |
| Conflicting receipt date | 0 |
| Raw effective clock disagrees with receipt | 0 |
| Identity learned after original publication | 0 |
| Retained identity date disagrees with explicit game date | 0 |

Every raw observation and one allocated occurrence remains retained. Any outbox entries stay held/blocked with review required. The results and exact hold reasons are recorded in `evidence-summary.json` and `exact-and-independent-storage.log`.

## SQL evidence guard

`commit_qualified_tweet_claim_scope` checks a finite proposed canonical `evidenceVersions` array, nonblank/unique native version IDs, and equality of each prior canonical evidence row before raw/qualification commit. Independent actual-RPC probes reject **rewrite, deletion, duplicate ID, missing ID and 513-row over-cap arrays**. After every rejected attempt, scope version, global context clock, raw observations, occurrence ledger and complete current qualification state remain identical to their prior values.

The original CR036 probe separately forces record b's different lexical payload under record a's retained native evidence-version ID at the commit boundary. It rejects, preserves the earlier evidence payload and raw observation, adds no effect and invokes no downstream RPC. The forced key is obtained from actual retained state according to the original fixture relation; no expected literal native ID was substituted.

This acceptance covers **prior canonical evidence-version enforcement**. It does not claim a new SQL immutability guard for every other native registry array, complete legacy reconciliation or real external receipts. Existing raw/occurrence protections and tested stateless planner invariants retain their separately documented boundaries.

## Exact original storage-case projection

The copied four-case harness retains the original JSON and all **14 assertions** unchanged. Source text/spans, already-bound facts/player/team/game and fixture clocks are translated into storage envelopes; synthetic dated identity and absence/unknown-history fixtures implement the declared preconditions. Runtime content-derived IDs remain separate from DSL record labels.

- **CR036:** actual forced evidence-version collision rejects and preserves prior immutable evidence with no new effect/downstream call.
- **CR039:** an actual pre-commit SQL exception rolls back raw/ledger/outbox state; a fresh stateless call with serialized original input reads durable state and creates one occurrence/proposal without an orphan outbox row.
- **CR040:** commit completes in PostgreSQL, its acknowledgement is deliberately lost, and exact durable readback precedes reuse; a subsequent fresh call preserves the one ledger allocation.
- **CR052:** two workers read the same actual global context revision. Exactly one initial CAS loses, reloads retained state and converges to one canonical occurrence and one durably retained transition/effect identity. The stored native effect state is **`reserved`**, and the outbox is **held**. A database-committed reservation is not a delivered transport acknowledgement.

Restart here means a fresh stateless storage invocation and durable readback, rather than an OS/process-kill test. The tested functions retain no required admission state between calls. These results establish the bounded original storage contracts; they do not establish the remaining consumer/queue boundaries.

## Verification executed

| Check | Result |
| --- | --- |
| Current source/evidence/extraction/lineage/identity, corrected fixtures and unchanged reviewer checks | **53 passed, 0 failed** |
| Current registry and qualification suites, sequential private clusters | **40 passed**: 38 actual PG + 2 default-off/clock tests |
| Original exact cases | **4 passed; 14 original assertions passed** |
| Additional SQL evidence guard controls | **5 actual PG cases passed** |
| Additional explicit-date policy matrix | **8 actual PG cases passed** |
| Exact plus independent storage file | **17 passed, 0 failed** |
| Scoped TypeScript using pinned `tsconfig.v2.json` | **Exit 0** |
| Normal original pure oracle | **41/43 cases, 194/196 assertions passed; CR011/CR051 failed; 9 deferred; exit 1** |
| Original pure immutable-row negative control | **40/43, 193/196; CR019 additionally fails as required; 9 deferred; exit 1** |

Both CLI reports identify this exact source manifest/hash. Every executed original assertion was compared structurally with the original oracle, SHA256 `d9fe45ca44042673ff0381cd0f1981074b196da99fb6fdf9da573ac5df84fd8b`. The pure CLI still defers all nine persistence cases because it does not call the storage harness. Separate execution now supports four of those contracts; it does not convert the pure report into full acceptance.

The earlier registry setup gap is closed: its current harness installs all three migrations, and its 17 current tests passed (15 actual PG plus the two pure cases). Qualification's 23 actual PG tests passed, including both corrected explicit-date positives. Fake local sink tests remain fixture-only; no real dispatch occurred.

Full command lines and JSON outputs are retained in `focused.log`, `storage.log`, `exact-and-independent-storage.log`, `original-oracle.log`, `original-oracle-negative-control.log` and their adjacent reports. Key reruns from `web/`:

```sh
npm test -- --run ../tasks/ifttt-integration-2026-10-16/review-durable-occurrence-v3/independent-fixture-contract.test.ts ../tasks/ifttt-integration-2026-10-16/review-durable-occurrence-v3/independent-applicability-negatives.test.ts --config ../tasks/ifttt-integration-2026-10-16/review-durable-occurrence-v3/vitest.review.config.mjs
IFTTT_POSTGRES_BIN=/opt/homebrew/opt/postgresql@17/bin npm test -- --run lib/sources/tweetClaimRegistry.test.ts lib/sources/tweetClaimQualificationStorage.test.ts --no-file-parallelism --config ../tasks/ifttt-integration-2026-10-16/review-durable-occurrence-v3/vitest.review.config.mjs
IFTTT_POSTGRES_BIN=/opt/homebrew/opt/postgresql@17/bin npm test -- --run ../tasks/ifttt-integration-2026-10-16/review-durable-occurrence-v3/exact-persistence.test.ts --no-file-parallelism --config ../tasks/ifttt-integration-2026-10-16/review-durable-occurrence-v3/vitest.review.config.mjs
./node_modules/.bin/tsc --noEmit --project ../tasks/ifttt-integration-2026-10-16/durable-occurrence-increment/tsconfig.v2.json
```

All PG executions used private Unix sockets, host connections rejected, network-denial setup, and disposable local storage. Fresh schema setup isolates each exact/date/guard case. All clusters were stopped and removed. No aggregate compiler/build/browser or hosted check was run. Scoped lint was author-reported and not independently repeated. No full-repository typecheck conclusion is made.

The runner copy redirects generated reports into this review directory; its execution logic and assertions remain unchanged. The author game-test copy redirects its import/output locally. The exact harness copy preserves the original four tests and appends reviewer guard/date-policy cases; only those original four are scored against the original 14 assertions. Additional cases are explicitly separate controls.

## Remaining gates

1. **Five exact original contracts remain open:** CR037, including all four legacy-parent variants; CR041 parent commit-ack/readback before child fan-out; CR042 retained opaque effect/transition identity plus authoritative no-attempt proof; CR043 unknown transport outcome/no blind resend; CR044 delivered receipt/queue-ack suppression. Existing generic local sink tests are not those exact adapter contracts. These can require further local consumer integration and independent review; live data is not a substitute.
2. Original CR011/CR051 assertions remain historical ambiguous failures; the separately approved versioned positives and negative holds must stay distinguished. No blanket original-52 score is claimed.
3. Authentic original-source/applet receipts, dated future identity/game binding, complete real legacy/writer/consumer inventory, exact keys/payloads/delivery receipts, retention/writer fencing, authoritative unknown-outcome reconciliation and compensation policy remain operational prerequisites.
4. Genuine prospective collection/adjudication/export/performance and separately approved migration/deployment/activation packages remain open. This source-level date receipt does not produce authentic future roster evidence or automatic multi-game NLP.
5. The terminal approved metadata presence read and five absent legacy line relations remain separately documented owner evidence. No new hosted query occurred; presence alone does not prove columns/functions/ACLs, deployed migration status or consumer compatibility.

All three SQL proposals remain staged outside the active migration tree and unapplied remotely. Current third SQL SHA256 is `3a8815e5f8f9d6d49038dfa77c0ba7dfc09014b1775efffb70bf1f268c3ae16a`; the first two hashes are unchanged. No real sink release or operational exactly-once guarantee is accepted.

## Ownership and checkpoint

This reviewer wrote **only `tasks/ifttt-integration-2026-10-16/review-durable-occurrence-v3/*`**. No implementation source/test/SQL file was edited, staged or committed. Earlier review roots remain stable. Snapshots and deliberate fault probes are audit evidence, excluded from runtime/release inputs.

All 59 pins were rehashed unchanged immediately before the explicit release message to owner thread `01a14299-0127-7424-85aa-42578c6740ef`. **Source hold released.** No reviewer test/compiler/database process remains running. The owner was the only known IFTTT implementation writer and limited concurrent changes to nonpinned task artifacts; unrelated repository work was preserved and not audited or stopped.

Review artifacts remain stable after their manifest is generated. Subsequent implementation needs a new pin and applicable review. No production DDL/write, real ingestion/dispatch/replay/correction, scheduler/cohort/environment/forecast activation, external source read, remote build, push, deployment or new credentials occurred in this review. There is no uncertain external outcome or new approval denial.
