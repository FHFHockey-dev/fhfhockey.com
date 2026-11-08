# Disabled review preparation — 2026-10-19

**Owner-tested local candidate; independent review pending.** This prepares review inputs from already committed, controlled receipts. It does not call a model, publish news, change a factual status, or install a worker/scheduler/receiver hook. It does not establish provider compatibility or extraction quality.

## Scope and ownership

The seven new owned source/test/config paths are listed in `source-pins.json`. Existing runtime, parser, r3 registry, source-span offsets, fingerprints, routes and UI remain outside this change. `readOnlyDependencies` records the actual local dependencies, including concurrently owned `web/lib/newsFeed.ts`; those hashes are evidence, not an ownership hold. A changed dependency requires compatibility reconciliation before combined acceptance.

- `web/lib/sources/tweetReviewSidecar.ts`: immutable receipt plus existing bound claims → internal review packet.
- `web/lib/sources/tweetReviewSidecarStorage.ts`: explicit bounded post-commit preparation function, disabled by default with zero default work budget.
- `web/lib/sources/tweetReviewSidecar.test.ts`: packet, metadata and identity controls.
- This folder's `storage.test.ts`, `vitest.config.mjs`, `tsconfig.json` and task-local SQL9 proposal.

The lead may continue unrelated work. Hold only these seven owned paths during a requested independent review. Nothing is staged or committed by this increment.

## Integrated local behavior

The immutable receipt/admission log is the durable work source. A later explicit invocation selects at most 25 missing review jobs. Its pure synchronous context mapper supplies retained source/claim context; no async enrichment, fetch or provider callback is accepted by that interface. A missed invocation or preparation failure leaves the earlier ingress commit intact and discoverable. There is no atomic ingress→new-job transaction and no installed recurring runner.

Packets include whole-post relevance even when extraction returned zero claims. Claim packets copy existing observation IDs, player bindings, exact UTF-16 evidence/anchors, scope, effective time, modality and fact. They request source-support and wording checks without promoting state. Over 99 candidates produces an explicit held overflow with the original count, not a truncated candidate list.

Raw payload, raw text, wrapper post identity and receipt/publication clocks must agree with retained input. Missing publication time remains null. The original reporter resolver is reused; relay accounts cannot become the reporting author. Selected enrichment without its own retained proof remains held. Claims with inconsistent originals, invalid spans or unresolved bindings retain explicit holds. Source text is untrusted evidence data. This raw-receipt seam does not yet authenticate a separate enrichment document.

SQL9 reuses `tweet_pipeline_jobs` with key `ifttt-review-v1:<policyId>:<receiptId>`. Full JSON equality is required on retry; an exact retry preserves a claimed job's status, owner, attempts and lease. A per-key transaction lock and actual persisted-row comparisons protect preparation against the tested intra-RPC mutations. The receipt, raw carrier, intake policy and admission map must remain unchanged. An acknowledgment loss or wrong job key leaves the application outcome unresolved; it sends no second write. A fresh bounded read skips an already committed job.

## Owner checks actually run

| Check | Outcome | Evidence |
| --- | --- | --- |
| Final packet + disposable PG17 run | **33/33 pass**: 16 pure, 17 actual private-PG | `evidence/candidate33-local-pg-results.json`, `.log` |
| Scoped TypeScript | **exit 0** | `evidence/candidate33-tsc.log` |
| ESLint, three new web files | **exit 0** | `evidence/candidate33-lint.log` |

Private PG used synthetic data/roles, Unix sockets only, no TCP listener, and fresh schemas; the cluster was stopped and removed. The application seam called real SQL through an injected RPC bridge. That bridge is not a PostgREST transport proof and does not establish hosted deadline hoisting.

The tests cover default-off behavior, zero-claim preparation, resolver/job-write failures after ingress commit, concurrency, lost/wrong acknowledgments, whole-row preservation, immutable JSON retry, lease preservation, missing clocks, relay withholding, prompt-like text, span/overflow holds, role denial and explicit batch bounds.

Earlier evidence is retained: the first unit run had one fixture-layout error; initial scoped TypeScript had four test-setup/type diagnostics, subsequently corrected. The first final 33-case restricted run passed 16 pure cases but failed storage-suite setup, leaving 17 unrun; its JSON supplied no setup message. The completed permitted local-PG run above passed all 33. Do not combine repeated runs into a larger distinct-case count.

No full repository compiler/suite/build, browser, provider request, hosted read/write, migration, replay, dispatch, deployment or configuration change was performed for this increment.

## Exact SQL selection and remaining gates

SQL9 is `supabase/migrations/20261019160708_ifttt_review_sidecar_preparation.sql` **inside this task folder only**. It is not in the active migration authority. Local fixtures use selected SQL6 v2, SQL7 v2 and SQL8 plus the existing jobs table. Their exact paths/hashes are pinned; never apply alternative SQL6/7 drafts together.

Open before any operational use: independent review; actual retained-context/enrichment mapping; deployed full schema/ACL/trigger/writer compatibility and UTC; actual PostgREST deadline behavior; explicit DDL/deployment/configuration/cohort authority; worker ownership/claim/result protocol and durable provider quota. Existing broad service-role table privileges are not universal fencing. Deferred or subsequent writers are not proven safe by these transaction-local probes.

The Decisions ZIP transfer failed twice through supported materialization with `library file transfer failed: download failed`; no package bytes were installed. Package consumer integration is blocked, not denied or uncertain. See `../resume-2026-10-19/LIBRARY-TRANSFER-BLOCKER.md`. No provider adapter was substituted from guessed download paths.

Model comparison, authentic source/history evidence, complete production consumer semantics, genuine future metrics and full52 acceptance remain open. The historical ambiguous CR011/CR051 failures and existing reviews remain unchanged. The next bounded increment is to review this preparation contract and obtain verified Decisions package bytes, then connect a review-only provider result protocol under zero budgets before proposing a separately approved paid evaluation.
