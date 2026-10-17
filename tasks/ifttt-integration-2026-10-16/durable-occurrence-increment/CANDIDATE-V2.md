# Durable occurrence v2 — corrections and evidence collision guard

Frozen source manifest `owned-source-v2-sha256.json`: **59 files**, SHA256 **`440b7b20c0da108de71db8680c98a36ab9e1f77b048e5efcd5e7cd51ff6b0d66`**. All prior evidence/review roots remain preserved. Original r3 registry, reducer, import-only adapter and first two SQL files are unchanged. This is a new candidate requiring independent review, not inherited operational acceptance.

## R14 and R15

The positive fixtures now declare dates consistently in scope/applicability/Eastern effective time. The projection rejects a supplied mismatch rather than dropping it; each new record has a deliberate contradiction regression. Original ambiguous CR011/CR051 JSON and historical failure results remain untouched.

`tweetClaimApplicability.ts` constructs and validates an immutable explicit-date receipt for an already-bound game. It requires a single exact ISO date in the retained governing clause, exact clause span/text, matching game/team/date/start and publication clocks; it cannot choose game IDs. The optional receipt participates in raw claim identity. `datedTweetClaimBinding` checks the exact retained official roster against this explicit game date while retaining the publication-day rule for older envelopes without the receipt. Source-time identity must still be known before original publication. Negative tests cover missing receipt, conflicting date/game/team/publication/start/span, late identity, mismatched dated identity, unproved relative wording and ambiguous dates.

This adds a software policy for explicitly prebound future-game evidence. It does not claim automatic full-document multi-game NLP extraction or authentic future official roster evidence. Existing extraction remains conservative; callers may not infer a future game from IDs alone. Actual positive fixtures retain exact Jordan Staal/CAR clauses, game IDs and clocks, use synthetic prebound identity/history evidence, and run each case in a fresh schema. Both CR011 separate-date and CR051 same-date clauses retain two canonical tokens/two held reviewable actions. Tampering the retained receipt under the same observation ID rejects without changing original bytes.

The older registry PG harness now installs all three staged migrations. Its 17 tests passed (15 PG cases and two pure default-off/clock tests).

## Exact CR036 evidence-version contract

The new original-DSL probe bypasses content-derived IDs exactly as the fixture requests: retain record a, then reuse a's r3 evidence-version ID for record b's different lexical evidence at the actual commit boundary. The prior candidate accepted it: versionConflict false and originalImmutableBytesUnchanged false; zero dispatch. Exact before log/JSON/input manifest are frozen in `evidence-v2/evidence-collision-before.*` and `evidence-collision-before-manifest.json`.

The third staged SQL now validates a bounded unique proposed evidence-version array and preserves every prior canonical evidence row byte-for-byte before committing raw observations/qualification. Same-key differences, deletions or duplicate version IDs reject transactionally. This is specific prior evidence-version enforcement, not a claim that arbitrary native state or real external receipts are all reconciled.

Four exact original cases now pass against actual private PG17: **CR036/CR039/CR040/CR052, 14 original assertions**. Each uses the original already-bound records/preconditions/assertions, with explicit synthetic dated/absence-or-unknown history as declared; none dispatches. The prior three-case author snapshot is preserved in `../offline-completion/exact-persistence-v1/`. Current harness/results are separate from the unchanged pure runner and need independent review.

## Checks and limits

- **45 focused tests passed**, including explicit date negatives, unchanged extraction/lineage/identity and corrected fixture tests. `evidence-v2/focused.log`.
- **44 storage/default-off tests passed** after the SQL guard (23 qualification PG +15 registry PG +2 pure default-off/clock +4 exact original storage). `evidence-v2/storage-evidence.log`. Final frozen-byte targeted checks additionally cover the two dated positives and four exact cases; retained separately.
- Scoped ESLint passed. Scoped TypeScript for changed application modules/tests and their imports passed (`tsconfig.v2.json`); this is not a new full aggregate pass. The first narrow config's implicit dotenv type lookup and a subsequently fixed Vitest each typing error were local setup/test issues, not released baseline errors.
- Original pure oracle still has CR011/CR051 ambiguous failures and nine pure persistence deferrals; normal/mutation-control reports under `evidence-v2/` identify this exact manifest. Historical discovery data remains development data.

Five exact contracts remain unimplemented/unreviewed: **CR037** (all four legacy-parent variants), **CR041** (parent ack/readback before child fan-out), **CR042–CR044** (opaque retained effect/transition IDs, authoritative transport no-attempt proof and actual consumer receipt/queue boundaries). Generic local sink tests are not scored as those cases. These are local integration/consumer ownership boundaries, not excuses to wait for live data. See `../offline-completion/REMAINING-PERSISTENCE-CONTRACTS.md`.

The approved one-call metadata read is terminal; five absent legacy line relations are already documented with the exact existing migration/ownership/deployment-unknown dependency. No additional hosted operation occurred. All three SQL files remain staged locally outside the active migration tree; no production DDL, deployment, activation, ingestion, replay/correction, dispatch, scheduler/environment change or new credential occurred. No full-52, genuine future performance or exactly-once external guarantee is claimed.
