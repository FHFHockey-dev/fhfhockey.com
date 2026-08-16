# Audit Artifact Schemas and Invariants

All structured records use JSON Lines unless named `.json`. Every record is UTF-8, one JSON object per line, with `schema_version: 1`. IDs are stable within audit run `REPO-AUDIT-2026-08-09-FROZEN-36536C3`; source paths are repository-relative and source evidence carries the frozen SHA-256 when applicable.

## Primary ledgers

| Artifact | Primary ID | Required shape |
| --- | --- | --- |
| `coverage-ledger.jsonl` | `file_id` | `record_kind`, `path`, `source_ref`, `baseline_sha256`, `baseline_mode`, `owner_workstream`, `scope_class`, `review_depth`, `audit_status`, `disposition`, `exclusion_code`, `evidence_refs` |
| `inventory-ledger.jsonl` | `inventory_id` | `inventory_kind`, `canonical_key`, `name`, `path`, `line`, `baseline_sha256`, `audit_status`, `audit_disposition`, `confidence`, `evidence_refs`, `details` |
| `route-ledger.jsonl` | `route_id` | `pattern`, `route_kind`, `surface_type`, `deployment_boundary`, `source_path`, `methods`, `auth`, `routing_contracts`, `dependencies`, `incoming_relationships`, `evidence_refs` |
| `dependency-edges.jsonl` | `edge_id` | `edge_type`, `from_id`, `to_id`, `source_path`, `line`, `detection_method`, `confidence`, `evidence_refs`, `finding_ids` |
| `responsive-ledger.jsonl` | `record_id` | `route_id`, `pattern`, `viewport`, `verification_method`, `verification_confidence`, `verification_blocker`, `responsive_result`, `organization_review`, `route_specific_visual_change_disposition`, `style_ownership_id`, `evidence_refs` |
| `enhancement-ledger.jsonl` | `finding_id` or `record_id` | Variant described below. |
| `documentation-cleanup-ledger.jsonl` | `cleanup_id` | `path`, `status`, `confidence`, `rationale`; optional `replacement_or_canonical_path`, `related_paths`, `deletion_guard`, `evidence`, `finding_ids` |
| `validation-receipts.jsonl` | `receipt_id` | `result`, `command_or_request`, `cwd_alias`, `started_at`, `exit_code`, `diagnostic_excerpt`, `failure_layer`, `evidence_refs`, `external_output_refs`, `pre_snapshot_manifest_hash`, `post_snapshot_manifest_hash` |

### Route status extension

For `qualifies_for_product_status: true`, the route record must contain exactly one `product_status` from:

- `Complete`
- `In progress — Near complete`
- `In progress — Far from complete`
- `Skeleton`
- `Dead end`

It must also contain `status_confidence`, `status_rationale`, `verification_methods`, `variants`, `variant_evidence`, and exactly three `responsive_record_ids`. Infrastructure/non-page entrypoints use `qualifies_for_product_status: false` and `product_status: null`.

### Enhancement variants

`record_type: justified_finding` requires `finding_id`, `title`, `primary_category`, `secondary_categories`, `priority`, `confidence`, `finding_state`, `potentially_stale`, `summary`, `recommendation`, `expected_benefit`, `affected_files`, `source_candidate_ids`, `source_candidates`, `independent_verification_refs`, and nullable `product_decision_gate`.

`record_type: no_justified_change` requires `record_id`, `categories`, `scope`, `conclusion`, `confidence`, and `evidence_refs`. A no-change record is intentionally not a task candidate.

Priorities are `P0` through `P3`. Cleanup statuses are exactly `Keep`, `Archive`, `Merge`, `Delete candidate`, or `Needs owner decision`.

## Evidence references

A frozen source citation is:

```json
{"method":"static-source","path":"repository/relative/path","lines":"10-24","baseline_sha256":"...","confidence":"High"}
```

`method` may be `static-source`, `config`, `test-source`, `documentation`, `git-history`, `runtime-local`, `runtime-public`, `command`, `coverage`, `generated-metadata`, or `receipt`. Non-source receipts use an audit-relative `path`/fragment and do not impersonate a frozen source hash. Suspected secret evidence never contains a complete value.

## Provenance domains

- **Frozen source:** `evidence/frozen-source-manifest.jsonl`; 3,580 immutable records.
- **Audit generated:** `evidence/audit-package-manifest.jsonl` plus audit-generated coverage records.
- **External/disposable:** `evidence/external-output-manifest.jsonl` and `evidence/external-output-integrity.json`; never copied into product-source paths.
- **Live post-baseline drift:** `evidence/live-worktree-drift.jsonl`; never incorporated into frozen conclusions.

The coverage and package manifests, plus `evidence/package-integrity.json`, omit their own hashes to avoid false self-reference. All other retained package files require matching size and SHA-256.

## Completion invariants

1. Frozen manifest has 3,580 unique paths; coverage has 3,580 source records and exactly one audit-generated record per retained package file.
2. File dispositions total 3,570 audited plus 10 explicit exclusions; no source path is missing or duplicated.
3. Inventory totals 12,772; routes total 338; dependency edges total 14,602.
4. Exactly 72 routes qualify for status; their counts are 67 Complete, three Near complete, two Far from complete, zero Skeleton, zero Dead end.
5. Responsive ledger has exactly 216 unique route/viewport pairs: 72 desktop, 72 tablet, 72 mobile.
6. All 32 candidates are consumed exactly once into 30 canonical findings; five no-change records are separate.
7. Cleanup totals 626 with 341 Archive, 244 Keep, two Merge, 39 Needs owner decision, and zero Delete candidate.
8. Evidence paths, hashes, and line bounds validate; high-impact security/correctness findings carry independent verification.
9. Validation failures, warnings, unavailable credentials/services, and browser limits remain visible rather than being converted to passes.
10. Frozen snapshot, package provenance, disposable outputs, and live drift validate independently.
