# Reviewed receiver variant-retention checkpoint

On 2026-10-16 independent reviewer `01a142bb-decf-77fe-ac88-1dc20c8ed0f2` explicitly accepted the bounded correction and released all 125 source / 15 snapshot holds before report-only writing. This note is outside the frozen 29-artifact checkpoint; no frozen artifact changed. It supersedes the pending-review status in `CHECKPOINT.md` for this scope only.

Manifest: `owned-source-v2-sha256.json`, SHA256 `a63680cd434c6ca71713853e26e2cd3c3c18a261d8f694de10da171670409964`.

Selected replacement SQL6: `supabase/migrations/20261016082142_ifttt_raw_receipt_variants.sql`, SHA256 `789772078e3b8405539358e07413cf2fd4cf6d80a82513911bf989f8c02b0483`. Never apply both SQL6 drafts. Nothing was moved to an active migration tree or applied remotely. The accepted replacement SQL5 selection is unchanged.

## Independent result

- Current **59/59** passed in one fresh run: 47 actual private-PG cases and 12 nearest mocked receiver cases. This includes the unchanged reviewer 41-case body/R19 assertions, both coordinated absent-key races and all six owner correction controls.
- Six additional probes passed: own-insert ID rewrites and AFTER-INSERT status rewrites on both raw tables roll back and recover; both-table real per-key advisory contention produces `55P03` at about 2,008ms without writes or automatic second mutation, followed by a clean retry and stable duplicate identity.
- Total **65 distinct** cases: 53 actual-PG plus 12 mocked. Do not add the owner's repeated cases to this count. Scoped TypeScript exit0; no reviewer fixture failure in this correction increment. Owner runtime lint passed in v1; runtime files stayed unchanged for v2.
- All 125 pins / 15 live, captured and review-copy dependencies, prior 119 / 41 owner artifacts, current 29 owner artifacts, 2,016 earlier review files and addendum matched. The independently captured scheduler also matched.
- No reviewer/owner test, compiler or database process remains; private clusters stopped/removed. No broad81, full compiler/build, hosted database/application call, migration, activation, replay or deployment occurred.

R19 is closed for local receiver retention. Its original failures remain under `../review-receiver-variant-retention-v1/`. Correction reports/evidence are being finalized under `../review-receiver-variant-retention-v2/`; this acceptance records the explicit release message without claiming its forthcoming final report was already read.

## Behavior and limits

Behind the default-off flag, exact known-key retries reuse immutable receipt identity. Distinct body/provenance versions retain their original text and linkage and return `held_for_review`, without a second raw carrier, processor request, claim or independent effect. Existing raw rows skip INSERT entirely; absent-key conflicts roll back before a fresh request reconciles. The canonical raw row and earlier processing authority remain intact. Missing-ID behavior stays unchanged; a retained variant is not an authenticated edit or independent corroboration.

Runtime 2-second lock timeout is independently verified. A 5-second RPC statement deadline is **not** accepted: the migration's 5-second setting is DDL-only, and the deployed caller's actual budget remains a gate.

Operational gates remain exact: approved release/migration membership and selected SQL6; deployed schema/ACL/function/trigger/writer-fence proof; enforceable intake scope/count/time bounds or explicit approval of the actual global flag scope; separate migration/flag activation authorization; authentic correction/supersession policy; real source/history/identity and genuine future labels/metrics. Full52, sender/hosted PostgREST/external queue delivery and subsequent/deferred-writer guarantees remain open. `ACTIVATION-SCOPE.md` explicitly records that this global flag has no implemented per-source/count/time cap, and the evaluation sampling cap does not supply one. No current approval question or denied tool operation remains for this completed local increment.
