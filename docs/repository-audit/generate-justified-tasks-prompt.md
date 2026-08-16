# Prompt: Generate Tasks From Justified Audit Findings

This is the canonical durable-goal entrypoint. Read `docs/repository-audit/generate-audit-tasks-prompt.md` completely and follow it as the authoritative task-generation specification.

Generate traceable parent tasks and atomic subtasks from the completed audit's canonical justified findings only. Do not create tasks from no-change records or unsupported cleanup ideas. Include finding IDs, affected paths, dependencies, acceptance criteria, validation commands, risks, rollback notes, and product-decision gates exactly as the authoritative prompt requires.

This is **task generation only**. Do not implement, refactor, delete, move, install, test, build, migrate, deploy, invoke jobs, contact databases/services, or edit product source/configuration.
