# Optional `tasks/` cleanup proposal (no action taken)

**Scope:** stop tracking the committed npm cache from now on.
- No file is deleted from disk.
- No history is rewritten. The 78 MB stays in public history.
- Everything else under `tasks/` is evidence and stays tracked.

## What is proposed

| | |
|---|---|
| Directory | `tasks/artifacts/security-audit-sprint-2026-10-15-0512/approved-dependency-audit/cache/` |
| Contents | 476 `_cacache` entries, `_logs/`, `_update-notifier-last-checked` |
| Count / size | **478 files, 78,608,413 bytes (75.0 MiB)**; about a quarter of all `tasks/` bytes added since production |
| References | No code references it. Only prose in 9 task documents mentions the path |
| Keep tracked | The sibling `package.json`, `package-lock.json`, `user.npmrc` and `global.npmrc`. These are the audit inputs, and both npmrc files are empty |

Steps, on octoberBranch:
1. Add a `.gitignore` line for that `cache/` directory, plus a general `**/_cacache/` guard.
2. Make one commit: `git rm -r --cached` of that directory only.
3. Push together with TJ under the usual rule.

Expected Vercel effect: the change sits outside every project root, so expect no build. Re-confirm at the time.

## Reversible manifest

`cleanup-manifest-npm-cache.tsv` lists `mode`, `blob`, `bytes` and `path` for all 478 files, taken from octoberBranch `ceceb407a`. The blobs stay in history, so restoring is exact.

To restore the index, for each row:
```bash
git update-index --add --cacheinfo <mode>,<blob>,<path>
```

To restore the working file:
```bash
git cat-file blob <blob> > <path>
```

Or revert the untracking commit.

## Not proposed (listed so nobody mistakes it for waste)

- `rso-mockup-match-2026-10-14/` (36.6 MiB, PNG captures) and `rso-visual-redesign-2026-10-13/` (13 MiB): visual acceptance evidence.
- IFTTT `review-*` folders (about 7–9 MiB each): frozen-source copies that the reviews pin by hash.
- `repository-commitment-audit-2026-10-15/` and `obsolete-files-audit-2026-10-15/`: snapshots this ledger used.
- **Code-referenced `tasks/` paths: must never be cleaned.**

  | Path | Read by |
  |---|---|
  | `tasks/TASKS/cron-operations/cron-schedule.md` | `cronInventory.ts` at runtime; also modified in the working tree right now |
  | `tasks/TASKS/repository-audit-remediation/migration-authority.json` | migration-baseline test |
  | `tasks/TASKS/lines-gdl-ingestion/audit/*` | lines and tweet tests |
  | `tasks/ifttt-integration-2026-10-16/{migrations,next-increment,durable-occurrence-increment,game-scope-fixtures-v2}/` | IFTTT tests |
  | `tasks/TASKS/super-goal/super-goal-final-summary.md` | count sentence kept in step with the migration test |
