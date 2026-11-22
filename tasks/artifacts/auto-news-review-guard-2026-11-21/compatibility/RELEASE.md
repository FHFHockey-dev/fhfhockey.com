# Review queue delivery compatibility · approval packet

**The sole News candidate for TJ’s approval is `b37a0180d106412ede28cf7b6e5d73c89ffdae7e`.** Yahoo released both slots at 20:12:09 UTC after its four-window production readback. Master moved beyond the base of TJ’s conditional approval; the new SHA needs approval before the migration or drain. This rebase of `5c51ad0d` preserves reviewer edits and the per-row delivery signal. External cursor usage remains unknown. The write-elision alternative stays held at `ca2a5ed48b8850c03821687f26c170db88f79fbf`.

| Release identity | Value |
|---|---|
| Local compatibility ref | `refs/candidates/news-review-queue-compatibility-20261121` |
| Parent, verified against remote master | `2236ecb7c235a5cd6426c260e6b12c56742d6e61` |
| READY production predecessor for `fhfhockey.com` | `dpl_DohWMv8ftJYgTmJKaVemzQY95Lsc`, production `master` at the parent SHA |
| Migration | [20261121190000_sync_tweet_review_sources_keep_delivery_time.sql](20261121190000_sync_tweet_review_sources_keep_delivery_time.sql) |
| Migration SHA-256 | `963955d3331df80b44bdc018e151696732a092376d272bf93c611d9941a56893` |
| Caller | `web/pages/api/v1/db/tweet-pattern-review.ts`, Git blob `bed394634f3f6baf69fbcf44b14c7668df6bb1c0` |
| Retained lock-test receipt SHA-256 | `6bd5dc38f63542c8cde5884a6880eb6ffbdeca6829fc51d8682d13fa55427a04` |

**Hosted readback, November 21.** The production alias and remote master agreed. No production deployment existed for the new candidate. At 20:13:00 UTC the linked Supabase project’s latest ledger version was Yahoo’s `20261121184000`. The compatibility slot `20261121190000` and held slot `20261121173000` were both absent, with no matching migration name and no public function named `sync_tweet_review_sources_v1` of any signature. The queue table exists. These are pre-install observations; the installed body and ACL must be checked after an approved migration. [Read-only receipt](post-yahoo-readback.json)

**Rebase verification.** Exactly five paths differ from the new parent: the compatibility migration, caller and three existing test adapters. The full-index Git patch matches the original release patch byte for byte (SHA-256 `15aea0e93ebf4999fddca836febec8ea1262437c66d4502df741766a3ba7fb49`). The caller, SQL, source builders used by the harness, auth middleware, auto-news entry point and dependency lockfile also match. A clean archive of the new SHA passed 104/104 tests: NewsCard 55, homepage News compatibility 46, review boundary 3. The contention results below are from `5c51ad0d9b8f7dd004c380bb1f48a6716f4f2981` and were reused. [Rebase receipt](post-yahoo-readback.json)

**Scheduling.** Yahoo readback is complete. The 20:35–20:40 UTC FORGE data-only proposal covers historical rolling player rows; it has no identified table overlap with these News changes. Reconfirm the shared slot, current master, READY alias and expected build footprint at execution. If another release changes the base, bring the new SHA to TJ first.

## What the disposable database established

The exact caller selected the preferred source for each key, read the four source tables and called `sync_tweet_review_sources_v1` through the service-role SDK in four batches of 100. The SQL conflict update read the current row under lock, assigned source-owned columns and merged allowlisted source metadata. The update preserved the current review fields and `metadata.answerKey`. Each delivery used the later of the database wall clock or the locked row’s previous timestamp plus one millisecond. That increment remains visible to a JavaScript Date reader when clocks tie or a stored timestamp is ahead.

| Synthetic delivery | Reviewer’s committed clock, UTC | Clock after source sync, UTC | Readback |
|---|---|---|---|
| Identical | 17:57:02.660318 | 17:57:02.680627 | Advanced 20.309 ms. Source data matched the locked row. |
| Corrected | 17:57:02.736446 | 17:57:02.756102 | Advanced 19.656 ms. Corrected raw and review text, keyword and interpretation persisted. Stale roster evidence cleared. |
| Identical, reviewer clock five minutes ahead | 18:02:02.804841 | 18:02:02.805841 | Advanced exactly 1 ms. Source data matched the locked row. |

Each test observed the PostgREST backend blocked by the specific reviewer connection before its commit. On November 21 all three deliveries kept the ID, creation time, verdict, note, reviewed time, categories, assignments, highlights, answer key and unknown metadata of the reviewed key `cccmiddleton:1000001`. All 400 accepted rows advanced in each run. The harness verified effective privileges and directly attempted execution as both denied roles. `service_role` executed the real deliveries, `anon` and `authenticated` each received SQLSTATE `42501`, PUBLIC had no EXECUTE grant and the function ran with invoker rights. Owner/superuser privileges are administrative. [Raw receipts](receipts.json)

The harness used the retained schema and Astra’s pinned PostgreSQL 15.1, PostgREST 12.0.2 and Supabase JS 2.89.0. To reproduce, copy the retained proof directory to fresh scratch space, apply [the harness patch](harness.patch) in that copy, and run `./reproduce.sh "$PWD/compatibility-receipts.json"`. The script reads the exact Git blobs, uses disposable local containers and verifies the migration digest. [Original harness](/Users/tim/Documents/Codex/2026-11-21/auto-news-review-guard/reproduce.sh)

## Migration-first rollout for approval

1. **Preflight.** Reconfirm master, the production web alias and predecessor, linked project build impact, and existing deployments of the approved SHA. The intended fast-forward is `2236ecb7c` → `b37a0180d`. The expected footprint is one `fhfhockey` web build and three ignored or canceled companion entries (`cms-fhfhockey`, `functions-fhfhockey`, `fhfhockey.com` root). Recheck branch, roots and effective ignore settings before publishing. Check both migration slots and all public RPC overloads again. Stop on conflicting history, an unexpected existing function, a changed base or a change to the expected build footprint. Extract the migration from the approved commit and compare its SHA-256 with the value above.
2. **Install the database function.** Apply and record only migration `20261121190000`. The current caller can still run. Verify installed body, invoker security, absence of PUBLIC execution, effective application-role grants and PostgREST schema visibility before routing new application code.
3. **Drain the old writer.** Coordinate a short hold on new manual `POST /api/v1/db/tweet-pattern-review` requests with action `sync` and automatic `/api/v1/db/auto-news-feed-items` invocations that perform review sync. Account for scheduled, queued, retry and direct-to-old-deployment invocations. Coordinate reviewer activity until the last old writer has ended. Confirm zero old invocations in flight from deployment logs before reopening either entry point.
4. **Switch the caller and verify natural traffic.** Release this exact web SHA, verify the production alias and resume normal admission. Observe the first successful scheduled sync and its RPC batches. Use bounded before/after reads on an identified reviewed key included in an unchanged delivery, then on a real correction with known batch membership. Check strict timestamp advance, stable identity, source fields, review fields and answer-key digest. For a correction, verify the new source content. Exclude intervening unrelated edits when attributing a change. Keep any open observation pending until a natural qualifying row exists. No synthetic production delivery or endpoint replay is required.

**Rollback.** If only the migration landed, the old caller already works with the additive RPC present. If the app switched, hold both sync entry points and restore READY deployment `dpl_DohWMv8ftJYgTmJKaVemzQY95Lsc` (master `2236ecb7c`) if it is still the immediate predecessor. Verify the alias and drain all outstanding compatibility invocations, including old deployment URLs. Leave the RPC installed until there are zero callers and no remaining dependency. If authorized, use a compensating migration to drop only `public.sync_tweet_review_sources_v1(jsonb)`. The disposable rehearsal ran the previous caller before and after the drop. The old writer can overwrite concurrent reviewer edits; keep sync held while that protection is required. [Rollback SQL](/Users/tim/Documents/Codex/2026-11-21/auto-news-review-guard/rollback.sql)

**Other work.** The six news-card failures concern `PATCH /rest/v1/news_feed_items`. They remain open for a correlated failed request or transport trace. This candidate also leaves the independent real next-game numbered PP acceptance open.

## Production result, November 21

TJ approved the exact SHA above on Yahoo’s released base. Migration 20261121190000 committed at 20:16 UTC. An independent catalog read matched the function body, ledger and ACL. The old writers drained, master advanced at 20:20 UTC, and the production alias was READY by 20:28 UTC. The web project built once. Three companion entries canceled. [Migration](live/migration.json) · [Drain](live/drain.json) · [Alias and deployments](live/ready.json).

The first scheduled run returned 200 and accepted 1,076 of 1,076 candidates. Across the 1,061 identities visible in both samples, every delivery timestamp advanced and every review and answer-key digest matched. An identical input kept two assignments and two highlights. The existing DFO row gained its independently captured CGY game 2026020360 snapshot, enriched text and interpretation while keeping its identity. The eligible sample contained no populated human note, verdict or answer key for a live race. The reviewed concurrency controls above remain the proof for those fields. [Natural request](live/natural-request.json) · [Correction before delivery](live/correction-before.json) · [Row readback](live/natural-sync.json).
