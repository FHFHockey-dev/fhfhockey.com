# 2026-10-23 Claude: D4 local replay (89 then 90)

## Scope
Codex sprint validation lane (relayed by TJ): replay the 99-entry migration chain on a disposable
local Postgres, ending 89 then 90; grant/role tests; negative replays; version-ordering analysis;
REPORT + hosted-apply runbook (not executed) + note to Codex. No git mutations, no hosted calls,
no application/migration/registry edits.

## Where
- Branch `octoberBranch`, HEAD 2a5092d37. All outputs untracked, for Codex to commit:
  - `tasks/artifacts/d4-grants-2026-10-20/replay-2026-10-23/` (REPORT.md, replay.py, replay-checks.sql,
    make_hosted_sql.py, hosted-preflight.sql, hosted-postcheck.sql, run-{positive,negative,reversed,after-head}/)
  - `tasks/artifacts/d4-grants-2026-10-20/run-v10/`, `run-v11/` (reviewed harness.py, unchanged)
  - `tasks/artifacts/cross-platform/2026-10-23-claude-to-codex-d4-local-replay.md`

## State / checks
- Done. Registry 99 rows (sha 5fd21910…), files == registry order. Sandbox billing SQL: on HEAD
  (blob 58c92d3c, fd58ba245), deleted in the working tree, absent from the registry.
- Harness --check and test_harness.py (6 OK) already handle 99 entries.
- positive/reversed/after-head green (1870/34/10/205/287, fixture 0, runbook Q3 = 0); identical final ACLs
  (28cf4a7d…). negative met its expectation (138/34/121/143 not-ok; Q3 = 138). v10 green, v11 exit 1;
  byte-equal ACLs. All clusters, sockets and the heavy lock removed.

## Next
Codex: commit the artifacts. TJ: separate approval for the hosted 89 → 90 apply (runbook REPORT §6) before
2026-10-30, then the rename/registry reorder (REPORT §5, Option A).

## Blockers / approvals
- Hosted apply needs TJ's approval; not run.

## Gotchas
- zsh: `echo =====` fails (`=` expansion); quote it. Unmatched globs abort the zsh command.
- Scratchpad path (112 bytes) is too long for a Unix socket; put the socket in a short /private/tmp dir.
- apply_migration records an auto-generated version (super-goal diary entry 0870,
  security-rpc-rollout-runbook.md:468). `db push --include-all` would sweep pending 71/77/88 too.
- At HEAD, supabase/migrations holds 100 files vs 99 registry rows until the sandbox-billing deletion is
  committed.
