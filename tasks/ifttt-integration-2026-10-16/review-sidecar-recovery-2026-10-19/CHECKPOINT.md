# Review preparation recovery correction — 2026-10-19

**Owner-tested correction, ready for parent-coordinated re-review.** This supersedes the liveness behavior in `../review-sidecar-preparation-2026-10-19/`. The original reviewed source copies, owner evidence and independent failure evidence remain intact. No provider or operational authority is added.

## Reproduced defect and correction

The unchanged independent probe creates a legal 30,000-byte raw text receipt. Its internal packet is 91,671 JSON bytes, beyond SQL9's 81,920-byte queue-input limit. Before correction, two fresh limit-one passes both returned `prepared:0, unresolved:1`, repeatedly selecting that receipt and starving a later valid receipt. Our baseline rerun reproduces the failing liveness assertion: **1 fail, 33 skipped**; skips are not passes. See `evidence/before*` and the untouched copied reviewer evidence under `evidence/independent-v1/`.

The correction has two bounded parts, both reusing `tweet_pipeline_jobs`:

1. **Explicit durable overflow hold.** SQL9 first verifies receipt identity and review-only authority. If the packet exceeds the same 81,920-byte storage limit, it stores a small `ifttt-review-sidecar-hold-v1` record with `status=failed`, `failure_stage=review_preparation_packet_bytes`, reason `packet_byte_limit`, the PostgreSQL canonical packet byte count/SHA256 and the immutable receipt reference. There is no partial input packet. Full original text/payload/clocks remain unchanged in the receipt log. This outcome increments `held`, never `prepared`; an exact retry preserves the hold, while changed input conflicts. Holds require explicit review/resolution rather than automatic deletion, truncation or promotion. The new packet digest is an audit field; existing source/native semantic fingerprints and IDs are untouched.
2. **Durable cyclic scan progress.** `advance_ifttt_review_receipts` allocates at most 25 eligible receipts under a per-policy transaction lock and commits `ifttt-review-scan-v1:<policyId>` before application mapping. The cursor uses retained time and receipt ID, with explicit page ordering. It advances past the entire allocated page even if a process stops, context is unavailable or a later preparation write fails. Later fresh invocations continue after that cursor and wrap to unresolved work. A finite controlled admission cohort therefore remains reachable without raising the batch limit. Prepared jobs and recorded overflow holds are excluded. An empty cohort does not reset progress.

The cursor row's `complete` status means only that scan allocation committed. It is not a receipt/packet completion or a model, news or consumer receipt. It uses a separate namespace and cannot be picked up as a pending review job.

Both allocation and preparation validate actual persisted rows and preserve the selected raw/receipt rows, policy and admission map. Tested trigger mutations roll back. Cursor allocation is now a write RPC and uses the existing 6-second write deadline; lock/SQL deadlines remain 2/5 seconds. The read-only inspection function keeps its 1-second SQL setting. No timeout value was increased and no write is automatically retried. A lost allocation reply causes no mapping/preparation; its page remains eligible on wrap.

## Checks and evidence

| Check | Outcome |
| --- | --- |
| Original packet cases and adapted original storage cases | All 33 pass within the final run |
| Byte-identical independent starvation probe | Pass; first pass `prepared:0, held:1`, second fresh limit-one pass `prepared:1, held:0` |
| Seven added recovery cases | Pass: overflow audit/immutability, poison-prefix wrap, one-receipt SQL failure, lost cursor acknowledgment, two cursor/raw trigger faults, concurrent allocations |
| Final focused run | **41/41 pass: 16 pure + 25 actual disposable-PG cases**; `evidence/final-results.json`, `.log` |
| Scoped TypeScript | **exit 0**, `evidence/scoped-tsc-repaired.log` |
| ESLint, changed web storage module | **exit 0**, `evidence/lint.log` |

The initial correction run also passed 41/41. Final SQL made page aggregation ordering explicit and checked admission bounds before writing; the final focused run verifies those exact SQL bytes. The first scoped TypeScript check found two implicit-any callback parameters in new tests; only their annotations changed before the passing check. Initial diagnostics remain in `evidence/scoped-tsc.log`.

Tests use fresh PG17 schemas, synthetic roles/data, Unix sockets only and no TCP listener; clusters are stopped and removed. They invoke actual SQL through the existing injected RPC bridge, not hosted PostgREST. No full compiler/build/suite, browser, provider request or hosted query was run.

The copied original storage harness is adapted only for the new allocation RPC, replacement SQL9 path, cursor-versus-review-job inventory, and receipt-specific fault trigger scope; old assertions remain. The added tests inspect cursor state separately. The original reviewer probe body is byte-identical, hash recorded in `evidence/reviewer-probe-integrity.json`. Initial and final result counts are not summed as distinct cases.

## Exact candidate and ownership

`source-pins.json` records seven owned source/test/config files and the same 42 read-only dependencies, with frozen byte copies. Of the previous 49 live pins, only `web/lib/sources/tweetReviewSidecarStorage.ts` changed. The packet builder, its 16 unit cases, existing parser/r3/identity/clock code and all 42 dependencies remain unchanged. The other four candidate paths are this new folder's test/configs and replacement SQL9. All 82 prior owner artifacts remain byte-identical; the independent review root in `/tmp` is read-only and was not modified. Adjacent UI/FORGE/RSO/cron/migration work was preserved.

**Select only this replacement SQL9:** `supabase/migrations/20261019160708_ifttt_review_sidecar_preparation.sql` inside this folder. It revises the same unapplied proposal; never apply it together with the initial SQL9 alternative. It remains outside active migration authority. Fixtures use selected SQL6 v2, SQL7 v2 and SQL8 plus the existing jobs table. No production DDL, commit, staging, push, deployment, replay, ingestion, scheduler/flag/configuration change or credential action was taken.

## Remaining gates and next action

Parent coordinates bounded re-review of the corrected pins. No new integration stage was started. Review-only defaults, zero default work budget, zero provider/publication authority, original-source holds and missing-clock behavior remain intact. This does not prove deployed schema/ACL/trigger/writer compatibility, universal fencing, hosted deadline behavior, provider execution/quality, full52 acceptance or genuine future metrics. Missing/corrupted protocol state fails closed; availability failures preventing cursor commits cannot be treated as guaranteed progress.

The user supplied the correctly named Decisions attachment (`file_00000000797081f586ab236c93304a72`, reported 36,250 bytes). One supported transfer attempt failed with `library file transfer failed: download failed`. No readable bytes, archive inspection, extraction or installation occurred. This is a failed transfer, not denial, pending execution or uncertain outcome; it does not block the independent local recovery correction. See `../uploaded-decisions-2026-10-19/TRANSFER-STATUS.json`. No paid calls were made.
