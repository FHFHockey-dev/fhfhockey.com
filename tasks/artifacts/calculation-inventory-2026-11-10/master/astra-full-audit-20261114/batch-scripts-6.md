# Local season settlement importer

Full 382-line read of `web/scripts/import-player-forecast-season-settlement.ts` at frozen `89da739cb45d7d572ed59bfa0b209c79c5d99299`. `scripts6-probe.cjs` passed once with isolated source loops and a synthetic environment object. No dotenv, main, real environment, Python process, bundle, database client, read or write was executed.

## AFULL-SETIMP1-01 — P2: equal-time outcome revisions are selected by database return order

- **Location/claim:** importer:252–271 and 292–306. Latest outcome selection and correction lineage must be deterministic for the same revisions.
- **Evidence/scenario:** both queries order only by `available_at` descending, and both reduction loops retain the first player/game row. Exact loops given revisions A (GOALS=1) and B (GOALS=2) at the same availability time choose A for `[A,B]` and B for `[B,A]`. This changes the prior `supersedes_id` candidate and evaluation outcome. No database tie was queried.
- **Fix/readers:** establish authoritative revision ordering or follow the explicit correction chain; reject ambiguous equal-time conflicts rather than relying on row order. Add a permutation case to the existing settlement/import tests. Affects local outcome lineage and season scoring; severity remains P2 for this local research path.

## Existing findings traced through the complete importer

- **AFULL-SEASON-10 P2:** lines 212–244 derive every primitive as zero for missing players solely from a `completedGames` marker, then claim complete-boxscore absence. The earlier verified partial-bundle counterexample remains applicable. This pass does not rerun or upgrade that evidence to a stored-data claim.
- **AFULL-FANTASY3-02 P2:** lines 335–350 persist the shared evaluator's published losses, including its previously demonstrated edited-point/original-model-interval mismatch. The remaining-model allocation fix remains intact: outputs and immutable release component manifests, rather than actual-inclusive season bases, determine editorial allocation.

Bundle schema, season, supported contract checksum, canonical bundle hash, outcomes file hash, Python verifier, schedule revision and row count are checked before inserts. Primitive target sets explicitly expand for v3/v4/v5; known null outcomes/forecasts remain unscored in the shared evaluator. Existing revision hashes are skipped, outcome inserts are chunked at 250, and evaluation upserts ignore duplicate release/outcome/scoring-version identities. Partial import failure is not an atomic transaction; reruns depend on those immutable keys and the now-noted latest-order ambiguity. No resume receipt or dry-run mode is supplied.

The local-only guard requires the explicit confirmation value and a loopback URL prefix. Ordinary remote URLs and missing confirmation are rejected in exact probes. A URL containing loopback-looking userinfo passes that prefix check, but native Request construction rejects URLs containing credentials; the installed Supabase source retains such userinfo in derived URLs. **No remote-write bypass is established**, so no production-write finding is raised from that parser observation. URL normalization remains a boundary to make explicit before reusing this guard elsewhere.

| Script | Bounds/stops | Resume and gating |
|---|---|---|
| import-player-forecast-season-settlement | Fixed season/contract/schedule bundle; 1,000-row local database pages and 250-row insert/upsert chunks, sequential. No overall row/runtime/statement cap; Python verification has no timeout. Stops on validation/query/write error. | Explicit local-only confirmation and loopback restriction; unconditional main and top-level dotenv mean importing it is operational. Immutable hash skips plus evaluation conflict keys provide partial rerun safety, not an atomic batch or permission to execute. All actions remain unrun in this audit. |

Actual imported schedules, outcome completeness, database uniqueness/permissions, current local configuration and real export contents remain unverified. No new production approval was requested or consumed.
