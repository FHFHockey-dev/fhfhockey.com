# Frozen Charter: Exhaustive Read-Mostly Repository Audit

Charter version: 1.0  
Audit run ID: REPO-AUDIT-2026-08-09-FROZEN-36536C3  
Frozen at: 2026-08-09T13:37:33Z  
Baseline branch: octoberBranch  
Baseline HEAD: 36536c3f1cbf065c34dc0ee5eceec2094e17d858  
Frozen manifest SHA-256: 2634689a5aa2a130be38c50975ea52d038ba85321591ca24981ec3ecf771b56f  
Baseline HEAD-to-worktree diff SHA-256: b1ca9c5b8737a65d92fc4501c1cafecb8dc098bb20611d6a54c1d582e6d913ec

This charter is immutable. Scope or policy changes require a new charter version. The audit assesses only the verified external filesystem snapshot captured at goal start. The live worktree is not an audit source after capture.

## Objective

Produce an exhaustive, evidence-backed assessment, map, and documentation package for the entire first-party repository. Do not implement, refactor, redesign, delete, upgrade, migrate, deploy, publish, clean, or otherwise change product behavior or existing repository material.

The live repository may receive new files only beneath docs/repository-audit/. All source inspection, analysis, tests, type checks, linting, builds, servers, and browser work use the frozen external snapshot or disposable children of it.

## Frozen source contract

- The source universe is the goal-start union of tracked and non-ignored untracked paths.
- It contains 3,580 files and includes the three pre-existing modified files recorded in evidence/frozen-baseline.json.
- The canonical external snapshot must retain its original manifest hash throughout the audit.
- Evidence cites repository-relative paths and baseline hashes, never temporary absolute paths.
- Later live-worktree changes are drift evidence only. They are not incorporated or automatically re-audited.
- If drift directly affects a central conclusion, retain the frozen conclusion and mark it potentially stale.
- Git history evidence must pin the frozen HEAD or an explicit historical commit.

## Scope and exclusions

Every first-party text/source file receives an audited disposition. Framework routes, components, hooks, exported utilities/functions, APIs, scripts/jobs, pipelines, database objects/migrations, styles, tests, configurations, documents, notebooks, and tracked artifacts are in scope.

Local trivial helper functions may be covered at file level. Nontrivial controllers, route helpers, and finding-relevant local functions receive entity records.

Deep-review exclusions require explicit coverage records:

- dependency/vendor trees;
- VCS, build, deployment, and cache state;
- ignored secret stores;
- binary assets;
- tracked generated data or code where structural, provenance, or consumer review is more appropriate than line-by-line source review.

Ignored .env files and secret stores must never be opened, parsed, sourced, copied, or printed. Only filename/existence and ignore-rule evidence may be recorded.

## Evidence contract

Evidence methods are static-source, config, test-source, runtime-local, runtime-public, command, git-history, documentation, and generated-metadata.

Each evidence reference records method, repository-relative path or receipt, lines where applicable, frozen file hash or commit, timestamp, and confidence.

- Documentation cannot override contradictory frozen code, config, runtime, test, or pinned history.
- High-impact correctness, security, Dead end, and Delete candidate conclusions require two independent evidence items, one from current frozen code/config/runtime/test or pinned history.
- Performance and data-efficiency findings require measurement or demonstrated cost.
- UX, accessibility, responsive, and visual findings require browser/DOM evidence when available; static fallbacks state the blocker.
- File length, age, missing navigation, stylistic preference, newer techniques, or dependency age alone are not findings.
- No justified change is the preferred conclusion where evidence does not show a real benefit.

Confidence:

- High: runtime/test plus frozen-source corroboration, or deterministic configuration plus tests.
- Medium: strong frozen static/control-flow evidence plus supporting consumer, test, history, or documentation.
- Low: incomplete static evidence, unavailable auth/data/service, or unresolved conflict.

## Product-status vocabulary

Apply exactly once to every externally addressable or intentionally internally addressable user-facing UI route or surface. Infrastructure such as _app, _document, APIs, route helpers, and configuration proxies is inventoried but receives no product status unless it independently renders a routable user-facing surface.

- Complete: fulfills its current purpose end-to-end, including applicable loading, empty, error, auth, and responsive states, with no missing primary outcome.
- In progress — Near complete: every primary outcome works; remaining gaps are bounded and non-blocking.
- In progress — Far from complete: substantive functionality exists, but a required primary outcome or data flow is missing, broken, or unusable.
- Skeleton: principally scaffolding, placeholder/demo/mock content, or a shell without a completed primary outcome.
- Dead end: at least two independent affirmative evidence items show abandonment, supersession without compatibility purpose, true unreachability, or lack of any valid current consumer/purpose after full reachability analysis.

Absence of a navigation link is never sufficient for Dead end. Special 404, 500, error, callback, redirect-only, compatibility, CMS Studio, admin, and hidden/internal tools are judged by their current contract. Dynamic or explicit-mode variants share one route-level primary status and receive variant evidence.

An ambiguous route does not stop independent work. Record attempted methods and blocker, revisit at final reconciliation, and use Low confidence when one category is still more defensible. Ask the owner only at the final gate when any category would be knowingly misleading.

## Route and graph contract

Derive routes from filesystem conventions, special pages, dynamic segments, rendering modes, fallback/not-found behavior, configuration redirects/rewrites, Vercel routes, sitemap, middleware, CMS base paths, route-level redirects, link registries, anchors, router navigation, URL builders, tests, docs, callbacks, and external-entry evidence.

Confirm framework/deployment routing before labeling auxiliary files as endpoints. Map auth at UI and endpoint layers separately.

Graph edge vocabulary: imports, renders, navigates, redirects, rewrites, auth_gates, calls, reads, writes, schedules, produces, consumes, tests, documents, deploys.

## Secret and raw-evidence safety

Environment names come only from tracked source, tracked examples, tracked config, CI/deploy config, tests, and docs. Runtime presence is present only when a named variable can be checked without printing a value; otherwise use unknown or not_checked. Never run env, printenv, shell tracing, full header capture, cookie dumps, or configuration dumps.

Suspected hardcoded secrets must be redacted before storage. Record only finding ID, path/line, category, minimal redacted prefix/suffix if essential, cryptographic fingerprint where useful, exposure context, and confidence. Never store complete suspected values.

Do not emit an unrestricted binary diff. Retain branch/HEAD, porcelain status, staged/unstaged paths, diff hash, per-changed-file hash, and bounded statistics. Full patches are exceptional, redacted, capped at 5 MiB, and never loaded wholesale into model context.

Command excerpts are capped at 200 relevant lines or 128 KiB. Larger raw logs are exceptional, redacted, materially necessary, and capped at 2 MiB per receipt.

## Audit tooling

Transparent audit-only helpers may live in docs/repository-audit/tools/ or external temporary storage. They may parse TypeScript, Python, SQL, styles, ledgers, graphs, duplicates, hashes, and schemas.

Retained helpers:

- read only frozen source and audit artifacts;
- write only audit artifacts or external temporary output;
- have no network, database, deployment, migration, ingestion, scheduling, authentication, or external-write behavior;
- do not import application modules when initialization could execute;
- are indexed with purpose and invocation;
- receive audit_generated coverage records.

Network/browser evidence uses existing browser tooling rather than a newly authored network-capable audit helper.

## Delegation

No more than three workstreams run concurrently. Every frozen source path has one primary owner. Agents do not run overlapping repository-wide scans or spawn subagents without coordinator authorization.

Second-level verification is limited to proposed Dead end or meaningful Delete candidate classifications, high-severity security/correctness findings, ambiguous active-versus-superseded systems, and material cross-system data dependencies.

The coordinator alone owns canonical ledgers, deduplication, conflict resolution, classifications, coverage, context files, and final synthesis.

## Phase order

0. Freeze and verify charter, source snapshot, and execution baseline.
1. Build coverage manifest, exclusions, and workstream ownership.
2. Map entrypoints, architecture, authority, environment names, integrations, schedulers, and pipelines.
3. Complete exhaustive static file and entity audit.
4. Complete route/reachability adjudication, product statuses, site map, and dependency graph.
5. Complete safe external-snapshot runtime, responsive, visual, and accessibility review.
6. Complete enhancement, stylesheet, and documentation-cleanup ledgers.
7. Run safe validation; reconcile frozen-source integrity, audit-package integrity, and separately labeled live drift.
8. Produce concise report and future justified-task generator prompt.

At each phase boundary: merge shards, update coverage, append diary, rewrite current state, verify charter and snapshot hashes, reread charter/current state/coverage and the latest diary checkpoint, and only then continue.

## Validation safety

Potentially writing commands run only in disposable children of the frozen snapshot. Dependencies and browser binaries are external copies. Redirect caches and temporary output externally. Compare the canonical snapshot before and after every batch and never copy generated output into product-source paths.

Do not install dependencies or run migrations, Supabase start/reset/push, cron/job URLs, ingestion, fixtures, imports, backfills, repairs, promotion, model training, Docker services, remote database commands, deployments, staging, commits, or pushes.

Command failure is evidence and does not stop unaffected work.

## Cleanup vocabulary

Documentation and cleanup dispositions are exactly Keep, Archive, Merge, Delete candidate, or Needs owner decision.

Delete candidate requires affirmative no-consumer proof, no unique retained knowledge after extraction, no credible manual/external purpose, a replacement where applicable, and Git recoverability. Age, unlinked status, or an older audit assertion is insufficient.

No cleanup action is executed.

## Completion gates

Completion requires:

- frozen snapshot unchanged;
- every frozen first-party file audited or explicitly excluded;
- every required entity and entrypoint inventoried;
- every qualifying UI route assigned one product status and three viewport records or explicit fallbacks;
- complete route/auth/redirect/scheduler/pipeline/database/integration/consumer relationships;
- evidence-backed findings and retained no-change conclusions;
- complete stylesheet and documentation-cleanup guides;
- honest validation receipts;
- valid audit-package schemas, hashes, references, provenance, tool index, and evidence index;
- no audit writes outside docs/repository-audit/;
- pre-existing user changes neither altered nor copied over;
- post-baseline live drift separately listed and not incorporated;
- concise report and non-implementing task-generator prompt complete.

Localized credential, auth, service, browser, dependency, test, or route-evidence gaps lower confidence and do not stop independent work.

Stop only if the audit package conflicts with unknown work, the frozen snapshot is lost or changes, a frozen file cannot be read/hashed, an audit action writes outside allowed locations, live drift prevents truthful package completion, a route remains impossible to classify at the final gate, or package integrity cannot be made truthful.
