# Documentation and Repository Cleanup Guide

Scope: frozen audit snapshot `36536c3f1cbf065c34dc0ee5eceec2094e17d858`. This guide does not authorize or perform deletion, movement, merging, or source cleanup.

The canonical ledger is `documentation-cleanup-ledger.jsonl`. Its 626 records reconcile to:

| Status | Count | Meaning |
| --- | ---: | --- |
| Keep | 244 | Active, authoritative, compatibility-bearing, or uniquely informative material. |
| Archive | 341 | Retain as historical context, completed work, or a compatibility pointer; move only through a link-preserving archive workflow. |
| Merge | 2 | Duplication is proven, but consumers and retained knowledge must be moved before either source is retired. |
| Needs owner decision | 39 | Static evidence cannot establish current authority, external/manual use, or the correct retained source. |
| Delete candidate | 0 | No file met the affirmative deletion standard after independent verification. |

All 341 Archive records are under `tasks/`; this is an organizational recommendation, not a judgment that the documents are useless. The 39 owner decisions comprise 32 `tasks/` records, six `web/` records, and one `cms/` record. Exact rationale, frozen hash, completion markers, reference counts, replacement path, and retained-knowledge evidence live with each ledger record.

## Status rules

- **Keep:** preserve in place unless a later task proves a better canonical location and updates every consumer.
- **Archive:** retain content and Git history. Before moving, rewrite repository links, preserve supersession pointers where external links may exist, and verify that active runbooks do not depend on the old path.
- **Merge:** select a canonical owner, extract unique knowledge, update all code/documentation consumers, verify the replacement, then leave a compatibility pointer where deep links are credible.
- **Delete candidate:** requires affirmative zero-consumer evidence, no unique retained knowledge, no credible manual/external purpose, a replacement when applicable, and recoverable history. No frozen file currently qualifies.
- **Needs owner decision:** ask a narrowly framed authority/purpose question. Lack of an answer is not permission to delete.

## Proven duplicate and compatibility cases

- `DOC-CLEAN-000356` identifies two byte-identical contextual-ranking research reports. Both paths have documentation consumers, so consolidation must move links before a copy is retired.
- `AUDIT-CLEAN-0001` covers the byte-identical 451-line game-detail stylesheet pair. Component ownership and both runtime consumers must be verified first.
- `DOC-CLEAN-000547` is a short supersession pointer with a current frozen inbound reference. Independent verification rejected deletion and retained it as Archive for compatibility.
- The normalized TeamLanding CSS/SCSS pair, CMS v2/v3 configuration overlap, divergent sKO output roots, and self-executing WGO updater remain owner decisions; their action gates are `AUDIT-CLEAN-0002` through `AUDIT-CLEAN-0005`.

## Documentation repair sequence

1. Resolve canonical-document authority before moving files. Start with records that name an explicit replacement and have current inbound links.
2. Repair active documentation references before archiving completed PRDs/task lists. `FIND-DOC-002` counts 2,044 developer-local absolute paths across 212 retained documents; `FIND-DOC-003` counts 782 absent repository-path references across 166 documents. Apply fixes only to active/retained material unless archival fidelity itself is harmful.
3. Reconcile contradictory completion claims (`FIND-DOC-004`) with receipts and current code. Do not mark tasks complete from prose alone.
4. Move approved Archive records in bounded topic groups. Maintain a machine-readable old-to-new map and run link validation after every group.
5. Execute Merge records separately. Copy unique retained knowledge, update consumers, validate, and preserve a pointer when URLs or historical task links may remain in circulation.
6. Revisit Needs owner decision records with the exact ledger question and evidence. Record the decision before proposing a file operation.
7. Re-run code-reference, documentation-reference, route, build-input, scheduled-job, generated-output, and pinned-history checks immediately before any future deletion proposal.

Abandoned experiments, unused code/assets, obsolete scripts, and generated outputs are not inferred from age or missing navigation. Their file dispositions remain in `inventory-ledger.jsonl`; only the five supplemental records above have enough evidence for a cleanup-specific action or owner gate. Binary and generated artifacts received structural/provenance review, not fabricated source-level conclusions.
