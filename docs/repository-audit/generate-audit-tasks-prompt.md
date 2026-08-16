# Prompt: Generate Actionable Tasks From the Completed Audit

Use this prompt in a later Codex run from the repository root. This run is **task generation only**. Do not implement, refactor, delete, move, install, test, build, migrate, deploy, invoke jobs, contact databases/services, or edit product source/configuration.

## Objective

Read the completed frozen audit under `docs/repository-audit/` and convert **only** `record_type: justified_finding` records from `enhancement-ledger.jsonl` into execution-ready Markdown task lists. Preserve traceability to the frozen audit; do not create tasks from `no_justified_change`, generic best practices, file age/length, dependency novelty, or cleanup records that lack a linked accepted finding.

## Required reading order

1. Read every applicable `AGENTS.md` and repository-local instruction.
2. Read `docs/repository-audit/audit-charter.md`, `README.md`, `artifact-schemas.md`, and `current-state.md`.
3. Parse all 35 records in `enhancement-ledger.jsonl`; select exactly the 30 `justified_finding` records and reject the five `no_justified_change` records as task sources.
4. Read the selected findings' full `source_candidates`, affected paths, verification references, decision gates, and any linked route/responsive/cleanup records.
5. Read `validation-receipts.jsonl`, `evidence/live-worktree-drift.jsonl`, and `evidence/package-integrity.json`. Treat the frozen snapshot as evidence, not as a claim that the later live tree is unchanged.
6. Inspect current live source only as needed to mark a finding current, potentially stale, superseded, or blocked. Do not silently rewrite frozen evidence or manufacture a new audit.

## Task-generation rules

- Produce tasks, not code changes. The only permitted outputs are the requested task-list Markdown files or the response containing them.
- Cover every canonical `finding_id` exactly once in a traceability matrix and at least once in a parent task. Do not lose merged source candidate IDs.
- Group findings into a parent only when they share an implementation boundary and sequencing them together reduces real risk. Keep the three P0 findings independently deployable/rollbackable unless a concrete authorization boundary requires a shared parent.
- Each parent task must include: task ID; title; finding IDs; priority; objective; evidence-backed problem; affected repository-relative paths; dependencies; product-decision gate; explicit non-goals; risks; rollback strategy; and completion definition.
- Each parent must contain atomic checkbox subtasks. Every subtask must name its affected paths, predecessor task IDs, acceptance criteria, validation commands or manual checks, risk notes, and rollback note. A subtask should be completable and reviewable as one focused change.
- Use only commands documented by repository instructions/manifests. There is no root package manifest. Run web commands from `web/`, CMS commands from `cms/`, and function checks from their owning boundary. Do not prescribe a production build when a narrower type/test/lint/browser check proves the result.
- Database/security tasks must separate source migration design, deployed catalog verification, privilege revocation, consumer compatibility, and rollback. Never make live RPC calls, pushes, migrations, truncations, arbitrary SQL, or production writes part of an automatic validation command.
- For `product_decision_gate != null`, make the first dependent item a clearly labeled owner decision. Downstream implementation subtasks must remain blocked and must not assume an answer.
- For `potentially_stale: true`, add a read-only current-state verification gate. If current code contradicts the frozen finding, mark the parent **Needs revalidation**; do not blend source revisions.
- Cleanup subtasks may use only `Merge` or `Needs owner decision` records linked by `finding_ids`. Do not create deletion work: the completed ledger has zero Delete candidate.
- Do not reproduce secrets or environment values. Refer only to variable names and redacted evidence.
- Do not add generic “add tests,” “add caching,” “refactor,” “modernize,” or “improve observability” subtasks. Tests and instrumentation must verify a named behavior/risk from a finding.

## Required output structure

Create a compact index followed by parent task files/sections using this schema:

```markdown
# AUDIT-TASK-<NNN>: <Outcome>

- Finding IDs: FIND-...
- Priority: P0|P1|P2|P3
- Status: Ready | Blocked — product decision | Needs revalidation
- Affected paths: ...
- Depends on: task IDs or None
- Product decision gate: exact gate or None

## Objective
...

## Evidence-backed scope
...

## Non-goals
...

## Atomic subtasks

- [ ] AUDIT-TASK-<NNN>.<N> — <single reviewable change>
  - Paths: ...
  - Depends on: ...
  - Acceptance criteria: observable, binary criteria
  - Validation: exact safe commands/manual checks
  - Risks: ...
  - Rollback: ...

## Parent acceptance criteria
...

## Risks and rollback
...
```

Also produce:

1. A dependency-ordered task index with priority, status, finding IDs, and parent dependencies.
2. A product-decision queue containing the exact unanswered question, responsible owner role if evidenced, affected tasks, and what evidence is needed.
3. A validation matrix mapping each task to commands/manual checks and required services/credentials, marking unavailable prerequisites rather than inventing success.
4. A traceability matrix proving all 30 justified finding IDs are covered exactly once at parent ownership level and all five no-change record IDs generated no task.
5. A risks/rollback summary for cross-boundary sequencing.

## Final self-check

Before returning, validate that task IDs are unique; all paths are repository-relative; all 30 canonical findings are owned; no no-change record became work; decision-gated work is blocked; dependencies are acyclic; acceptance criteria are testable; validation commands exist in repository authority; security values are redacted; no cleanup action assumes deletion; and no implementation occurred.
