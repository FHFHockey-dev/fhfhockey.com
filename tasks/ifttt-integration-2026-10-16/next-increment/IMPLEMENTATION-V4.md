# Integrated candidate v4 — accepted local held/shadow slice

Accepted manifest: [owned-source-v4-sha256.json](owned-source-v4-sha256.json), **41 files**, SHA256 `8a6e3b3c27cf60860b206a4dfd068dbc0aede9ceb76ea03b815e42ffc97ac958`. Independent v4 review verified all hashes before/after testing and released the pins unchanged. No further source/test/SQL changes are needed for this local review scope. Prior manifests, reviewed frozen copies and original failures remain unchanged.

This bounded correction follows [review v3](../review-v3/REVIEW.md), which accepted R1–R7 within its tested scope and required R8/R9 changes. See [IMPLEMENTATION-V3.md](IMPLEMENTATION-V3.md) for the integrated architecture; its review status is superseded here.

## Changes and failure evidence

| Boundary | Before | V4 behavior and evidence |
| --- | --- | --- |
| R8 partial incoming game cache | Independent pure and actual storage-hook assertions selected game `2026020010` for an ambiguous source even though the complete team/day fixture contained two games. Original failures: `review-v3/independent-hint-provenance-*` and `hint-hook-*`. | Every directory hint performs the bounded complete team/day schedule lookup; multiple/capped schedules leave the source unresolved. The current hook test covers positive unique-game proof and partial-cache ambiguity with real replacement RPC/storage. The unchanged reviewer real-hook assertion passes in a fresh disposable cluster. |
| R9 conflicting retained original quote ID | Public attribution exposed Reporter `/1000` although retained `quotedTweetId` was `999`. Canonical claim attribution held the same source. | Public attribution checks both item and provenance retained quoted IDs/URLs against the selected post. Contradiction suppresses the label/account/link; matching evidence remains supported. The unchanged reviewer resolver assertion and additional matching/conflicting provenance cases pass. |
| Midnight fixture dates | Within one minute after Eastern midnight, publication was on the previous day while game start used the current day; correct qualification held the mismatched fixture. | A single reference instant supplies publication, receipt, date and start. Earlier clocks clamp to that instant's Eastern midnight. An explicit four-clock boundary regression checks causal ordering and same-day game dates. No application date check was weakened. |

Only six pins changed since v3: `tweetClaimSourceHints.ts/.test.ts`, `newsFeed.ts/.test.ts`, `tweetClaimRegistry.test.ts` and `tweetClaimQualificationStorage.test.ts`. Both staged SQL migrations, reviewed r3 registry and imports-only adapter remain unchanged. The default-off rollout and held delivery behavior remain unchanged.

## Checks actually run

- **142/142 focused test executions passed**, 14 files (139 distinct tests; three hint-fixture tests are rediscovered through the reviewer's import): both handler files; extraction/evidence/lineage/hints/intake/bounds; public DTO/DOM; original seven reviewer regressions; adapted R5–R7 pure regressions; and unchanged R8/R9 pure assertions. `v4-local-focused.log`.
- **31/31 current Postgres/default-off cases passed** (29 real Postgres cases and two pure default-off/clock checks), both staged migrations, disposable PG17 clusters, private Unix sockets, TCP disabled, PG environment scrubbed and HTTP/fetch denied by the review setup. Includes extended real-hook ambiguity regression and deterministic boundary test. `v4-local-postgres.log`.
- **Unchanged independent R8 real storage-hook assertion passed**, fresh disposable cluster, 17 unselected copied tests skipped. `v4-review-hook.log`. This is the owner's rerun, not independent acceptance.
- Aggregate TypeScript passed (8 GB Node heap); scoped ESLint passed. After the fixture-ID correction, lint on that test passed again. `v4-local-tsc.log`, `v4-local-eslint.log`, `v4-local-eslint-test.log` are empty exit-0 logs. `git diff --check` passed.

Failures retained honestly: `v4-local-postgres-sandbox-failure.log` records initdb shared-memory denial (no test DB started). A bounded approved local rerun could allocate shared memory; its first extension reused a fixture original already retained by other tests and correctly hit `Immutable claim identity collision` (`v4-local-postgres-fixture-failure.log`). The regression now uses a fresh original ID; production immutability was unchanged. Both clusters from the corrected pass and the independent probe were stopped/removed. No hosted service was used.

Full unit/browser suites, authentic inbound execution, hosted schema/history reads, real future labeling/results and actual sink delivery remain unrun. No build/deployment, external acquisition, DDL, environment/cron activation, replay/correction or dispatch occurred.

## Delivery status

Independent v4 review closed R1–R9 for the reviewed local held/shadow slice. It reran the unchanged three R8/R9 failures (two pure, one actual hook), 63 focused executions (60 distinct; three imported helper duplicates), all 31 current source PG/default-off cases, and the independent hook probe. All passed; no new defect in the six-path diff. See [review-v4/REVIEW.md](../review-v4/REVIEW.md) for the final bounded verdict and preserved evidence.

Local implementation remains uncommitted on canonical `octoberBranch`, base HEAD `a8f58de6178e282acd3a71851c66f4a56b119f14`. Review reports describe bounded local behavior, not live legacy reconciliation or operational acceptance. The complete 52-case acceptance DSL, authentic handler-to-job-to-database intake, genuine dated identity/history/fencing evidence, specific consumer delivery and future performance remain unclaimed. All unknown-data, future evidence and release/consumer approval gates in [APPROVAL-PACKAGES.md](../APPROVAL-PACKAGES.md) still apply. No production approval is requested by this checkpoint.
