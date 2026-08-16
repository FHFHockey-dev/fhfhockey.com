# Frozen Repository Audit

Status: **complete** for audit run `REPO-AUDIT-2026-08-09-FROZEN-36536C3`.

This package assesses the goal-start worktree frozen from branch `octoberBranch` at HEAD `36536c3f1cbf065c34dc0ee5eceec2094e17d858`, including the three pre-existing user modifications. The frozen universe contains 3,580 files and has manifest SHA-256 `2634689a5aa2a130be38c50975ea52d038ba85321591ca24981ec3ecf771b56f`. It is the sole source authority; the live tree was never substituted into the audit.

## TL;DR

The highest-value work is boundary hardening, not redesign or broad modernization:

1. `FIND-SEC-001` and `FIND-SEC-002` identify active-migration grants that let browser roles invoke SECURITY DEFINER arbitrary-SQL and table-truncation RPCs. Verify deployed catalog parity without invoking them, then revoke browser-role access.
2. `FIND-SEC-003` identifies 20 statically addressable operational APIs without request authentication: 15 GET-capable mutators, six external-work triggers, four read/no-op handlers whose wrapper still writes audit rows, and one stale incompatible DDL route.
3. `FIND-SEC-004` limits a production-capable service credential currently scoped to unrelated CI install/upload steps.
4. `FIND-COR-001` removes credible fabricated pregame analytics when real inputs are unavailable; `FIND-COR-002` reconciles five active forecast migrations missing from the repository's authority contract.
5. `FIND-DEPLOY-001` resolves an sKO deployment rewrite aimed at an absent filesystem handler.

The exhaustive ledger contains 30 justified findings: three P0, four P1, 13 P2, and ten P3. It also records five explicit **no justified change** conclusions so generic caching, observability, redesign, dependency-upgrade, or blanket-test work is not manufactured.

## Coverage and current shape

| Surface | Result |
| --- | ---: |
| Frozen first-party files | 3,580 |
| Audited / explicit deep-review exclusion | 3,570 / 10 |
| Inventory records | 12,772 |
| UI routes / non-UI endpoints | 72 / 266 |
| Dependency and operational edges | 14,602 |
| Job/pipeline/declaration records | 259 |
| Responsive records | 216 |
| Canonical findings / no-change records | 30 / 5 |
| Cleanup records | 626 |

The 10 exclusions are nine binary evidence assets reviewed by metadata/consumer/provenance and one tracked CMS environment file whose content was not inspected. Dependency/vendor trees, generated/cache/build state, ignored secrets, and other exclusion roots are recorded in `evidence/exclusion-roots.jsonl`; they were not silently omitted.

### Product-status inventory

The five statuses apply exactly once to each addressable user-facing surface and never to infrastructure-only files or API handlers.

| Status | Count |
| --- | ---: |
| Complete | 67 |
| In progress — Near complete | 3 |
| In progress — Far from complete | 2 |
| Skeleton | 0 |
| Dead end | 0 |

The Near-complete, low-confidence surfaces are `/FORGE`, `/teamStats/[teamAbbreviation]`, and `/trends/placeholder`. `/game/[gameId]` is Far from complete because its substantive pregame variant can display fabricated analytics; `/staging-studio` is Far from complete because its intentional workspace lacks a matching frozen deployment route. Dynamic/special variants and every status rationale, confidence, verification method, auth/routing contract, and incoming relationship are in `route-ledger.jsonl`. The full route/API/job/data/integration map is `site-map.md`.

## Responsive, styles, and cleanup

Every UI route has desktop (1440×900), tablet (834×1112), and mobile (390×844) records. One `/404` desktop record uses runtime-local evidence; 215 records use explicit static fallbacks after third-party fonts/support imagery and Vercel telemetry made further browser navigation incompatible with the no-external-write boundary. Of the 216 records, 207 conclude no justified route-specific visual change; nine support two targeted accessibility/responsive findings. No broad redesign is recommended.

The stylesheet inventory covers 166 files and 84,475 lines. Justified work is limited to one exact 451-line duplicate pair, one normalized 809-line CSS/SCSS pair requiring owner confirmation, semantic reconciliation of 480/768 breakpoint literals with existing tokens, and an owned responsive/non-pointer path for the PP TOI chart. `stylesheet-cleanup-plan.md` preserves the limits around lexical duplicates, `!important`, repeated values, import order, and missing static consumers.

The cleanup ledger records 341 Archive, 244 Keep, two Merge, 39 Needs owner decision, and zero Delete candidate. Independent verification rejected the sole proposed deletion because the supersession pointer retains a current compatibility consumer. Nothing was moved or deleted.

## Validation and limitations

- TypeScript passed. ESLint completed with 53 warnings and zero errors.
- The full Vitest run recorded 3,618 passing assertions and two deterministic migration-authority failures. A separate environment-triggered collection failure passed 17/17 with a non-secret dummy value.
- Python tests passed 97/97 (60 functions, 15 forecast modeling, 22 Yahoo identity). Total retained passing test observations: 3,732.
- Rankings Playwright discovery found three tests; execution was not attempted without required live data/services. No production build, CMS build, deployment, database, migration, ingestion, scheduled job, or authenticated external flow ran.
- Browser runtime evidence is intentionally limited to one local `/404` render; the remaining viewport conclusions state their static evidence and confidence.
- Deployed database/catalog parity, authenticated pages, live service data, and external operational state remain unverified. Static findings do not pretend otherwise; `FIND-COR-003` is explicitly marked potentially stale where the latest active migration contradicts an endpoint's present-tense consequence.

All 3,580 frozen paths reverified unchanged. Live reconciliation found zero post-baseline source drift, and the three pre-existing user files retain their frozen hashes. Four tracked `.env*` paths were handled metadata-only; no value was opened or printed. All writes are new audit files beneath this directory. External/disposable output and package provenance are separately validated in `evidence/external-output-integrity.json`, `evidence/live-worktree-drift.jsonl`, and `evidence/package-integrity.json`.

## Artifact index

| Artifact | Purpose |
| --- | --- |
| `audit-charter.md` | Immutable scope, evidence, safety, status, and completion contract. |
| `current-state.md` / `audit-diary.md` | Compact resume state and append-only phase history. |
| `coverage-ledger.jsonl` | One disposition for every frozen file plus separate audit-generated provenance. |
| `inventory-ledger.jsonl` | Files, routes, entities/exports, endpoints, jobs, database objects/migrations, tests, configuration, and environment-name records. |
| `route-ledger.jsonl` | All 72 UI routes and 266 endpoints, including status/auth/routing/variant/incoming/dependency evidence. |
| `dependency-edges.jsonl` / `site-map.md` | Machine-readable graph and human-readable route/API/job/data/integration map. |
| `responsive-ledger.jsonl` | Route-by-route desktop/tablet/mobile evidence and visual-change disposition. |
| `enhancement-ledger.jsonl` | 30 justified findings plus five no-change records; exhaustive evidence stays here. |
| `stylesheet-cleanup-plan.md` | Quantified organization findings and safe staged migration sequence. |
| `documentation-cleanup-ledger.jsonl` / `cleanup-guide.md` | Exhaustive cleanup dispositions and action gates; no cleanup execution. |
| `validation-receipts.jsonl` | Passed, failed, warnings, discovery-only, and safety-stop command/evidence receipts. |
| `artifact-schemas.md` | Durable schemas, ID namespaces, evidence shape, and reconciliation invariants. |
| `generate-audit-tasks-prompt.md` | Later-run prompt that generates traceable tasks from justified findings only; it does not implement them. |
| `evidence/` | Frozen controls, exclusions, workstream shards, verifications, metrics, bounded runtime/validation receipts, drift, and integrity records. |

## Retained audit tooling

Run these only against the frozen source/audit package or disposable copies. Placeholders such as `<audit-dir>` and `<frozen-source>` must be explicit safe paths.

| Tool | Purpose | Invocation |
| --- | --- | --- |
| `initialize_audit.py` | Historical baseline-ledger bootstrap. | `python3 tools/initialize_audit.py --control-root <control> --audit-root <audit-dir>` |
| `verify_frozen_snapshot.py` | Verify path modes and SHA-256 against the frozen manifest. | `python3 tools/verify_frozen_snapshot.py --source-root <frozen-source> --manifest evidence/frozen-source-manifest.jsonl` |
| `build_assignments.py` | Partition frozen paths and exclusion roots without overlap. | `python3 tools/build_assignments.py --audit-root <audit-dir>` |
| `validate_workstream_shard.py` | Validate one assignment/shard pair. | `python3 tools/validate_workstream_shard.py --assignment <assignment.jsonl> --shard <shard.jsonl>` |
| `merge_workstream_shards.py` | Merge validated static shards and file dispositions. | `python3 tools/merge_workstream_shards.py --audit-root <audit-dir>` |
| `build_canonical_ledgers.py` | Build inventory, route, and edge ledgers. | `python3 tools/build_canonical_ledgers.py --audit-root <audit-dir> --source-root <frozen-source>` |
| `validate_canonical_ledgers.py` | Validate canonical counts, IDs, statuses, edges, and references. | `python3 tools/validate_canonical_ledgers.py --audit-root <audit-dir>` |
| `generate_site_map.py` | Render the canonical graph as Markdown. | `python3 tools/generate_site_map.py --audit-root <audit-dir>` |
| `analyze_stylesheets.py` | Produce lexical stylesheet metrics and duplicate groups. | `python3 tools/analyze_stylesheets.py --source-root <frozen-source> --output evidence/style-metrics.json --edge-shard <frontend-shard>` |
| `build_responsive_ledger.py` | Build 72×3 viewport records and style ownership. | `python3 tools/build_responsive_ledger.py --audit-dir <audit-dir> --source-root <frozen-source> --runtime-receipt evidence/runtime/404-desktop.json` |
| `validate_phase5_artifacts.py` | Validate responsive/runtime/receipt reconciliation. | `python3 tools/validate_phase5_artifacts.py --audit-dir <audit-dir>` |
| `build_phase6_ledgers.py` | Reproduce finding and cleanup reconciliation from adjudications. | `python3 tools/build_phase6_ledgers.py --audit-dir <audit-dir>` |
| `validate_phase6_artifacts.py` | Validate candidate accounting, findings, cleanup, and guides. | `python3 tools/validate_phase6_artifacts.py --audit-dir <audit-dir>` |
| `validate_evidence_refs.py` | Check frozen path/hash/line citations in one or more JSONL artifacts. | `python3 tools/validate_evidence_refs.py --manifest evidence/frozen-source-manifest.jsonl --source-root <frozen-source> --input <ledger.jsonl>` |
| `merge_validation_receipts.py` | Append monotonically ordered receipt shards. | `python3 tools/merge_validation_receipts.py --base validation-receipts.jsonl --append <receipt-shard.jsonl>` |
| `reconcile_final_integrity.py` | Compare live source metadata/hashes to the frozen baseline without reading secret-like content. | `python3 tools/reconcile_final_integrity.py --repo-root <repo> --audit-dir <audit-dir>` |
| `validate_external_outputs.py` | Reconcile explicitly indexed disposable logs/runtime output. | `python3 tools/validate_external_outputs.py --audit-dir <audit-dir> --external-root <external-root>` |
| `refresh_package_manifest.py` | Refresh audit-generated coverage and package hashes. | `python3 tools/refresh_package_manifest.py --audit-root <audit-dir>` |
| `validate_audit_package.py` | Validate package file/hash/provenance separation. | `python3 tools/validate_audit_package.py --audit-dir <audit-dir>` |
| `validate_final_audit.py` | Enforce final coverage, status, evidence, report, prompt, and integrity gates. | `python3 tools/validate_final_audit.py --audit-dir <audit-dir> --source-root <frozen-source> --require-final-receipt` |
| `rewrite_jsonl_exact_value.py` | Apply a counted, exact audit-artifact value correction. | `python3 tools/rewrite_jsonl_exact_value.py --input <file.jsonl> --old <value> --new <value> --expected <count>` |
| `disposable-local-only.sb` | macOS profile restricting writes and network for disposable commands. | `sandbox-exec -D WRITE_ROOT=<write-root> -D TMP_ROOT=<tmp-root> -f tools/disposable-local-only.sb <command>` |

The exhaustive record is intentionally in ledgers, not repeated prose. Start implementation planning with `enhancement-ledger.jsonl`; use `generate-audit-tasks-prompt.md` in a later Codex run.
