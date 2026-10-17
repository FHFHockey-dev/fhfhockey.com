# Recoverable cache cleanup — 2026-10-13

TJ authorized removal only of genuinely unused cleanup candidates. This receipt covers local ignored caches only. No implementation, task/PRD source, Git history, credentials, deployment or production state was changed.

## Completed moves

Trash bundle: `/Users/tim/.Trash/fhfh-cache-cleanup-20261013T142528Z`. Original paths below are relative to `/Users/tim/Code/fhfhockey.com`; each exact absolute original/Trash path is recorded in `manifest.json`.

| Original path | Files/symlinks | Apparent bytes | Status |
|---|---:|---:|---|
| `web/.next-playwright` | 1,473 | 1,232,798,677 | moved; verified |
| `web/.next-player-forecasts` | 163 | 1,084,513,582 | moved; verified |
| `web/.next-codex-verify` | 43 | 71,214,451 | moved; verified |
| `web/.next-codex-verify-2` | 43 | 71,952,710 | moved; verified |
| `web/.next-codex-auth-verify` | 62 | 76,712,991 | moved; verified |
| `.next` | 1 | 137 | moved; verified |
| `.npm-cache/_cacache` | 1,488 | 204,966,505 | moved; verified |
| `.pnpm-store` | 64,576 | 976,679,789 | moved; verified |

Total, without overlapping paths: **3,718,838,842 bytes (3.719 GB; 3.463 GiB)** across 67,849 files/symlinks. Unique device/inode allocation reported by `st_blocks`: 3,914,289,152 bytes. APFS compression, clones, snapshots and hardlinks prevent interpreting this as exclusive physical storage.

**No free space was reclaimed by cleanup.** Rename into same-volume Trash preserves allocation. Observed free space immediately before/after: 2,298,600,026,112 / 2,298,597,359,616 bytes (delta -2,666,496). That observation includes concurrent system/server writes and receipt activity; it is not a cleanup saving. Trash was not emptied.

## Kept

- `web/.next`: running npm dev / Next server; PID 2945 trace FD 31 open before and after cleanup.
- `.pytest_cache`: editor cloudcode_cli PID 65987 holds .gitignore open.
- `web/.pytest_cache`: editor cloudcode_cli PID 65987 holds .gitignore open.
- `.npm-cache/_logs`: retain installation diagnostics.
- `.npm-cache/_npx`: retain cached installed executable dependencies.
- `web/test-results`: retain existing failure/performance diagnostics.
- `web/.next-codex-reconcile`: explicitly protected repository mirror; not a cache.
- `CACHE-03 roots`: installed dependencies, .venv and Playwright binaries remain useful.
- `RET-NEW-01/02/03 scripts`: manual/external use not disproven; documented historical references remain.
- `all task/PRD source and eleven owner decisions`: canonical consolidation/reference preservation not yet verified; held by task instructions.
- `web/playwright-report`: absent; no action.

All environment/secret files, `.git`, branches/worktrees, dirty/untracked source, SPRINT-MODE.md, migrations, rollback/replay/capture evidence, frozen research and ignored receipts remain outside the move allowlist. `tasks/TASKS/cron-operations/cron-schedule.md` remains present and tracked. The six candidate scripts and fix_terminal.sh remain unchanged. Zero references and age were not treated as proof of retirement.

## Recovery

Every byte, Next trace, diagnostics file and `_events.json` remains in the Trash bundle. npm logs and test-result diagnostics remain at their original paths. The pnpm project symlinks were preserved verbatim without following them; their relative targets become valid again upon restoration. Keep this bundle in Trash until recovery is no longer needed.

Validate without moving anything:

```sh
python3 /Users/tim/Code/fhfhockey.com/tasks/artifacts/recoverable-cache-cleanup-2026-10-13/restore.py
```

To restore all eight original paths, ensure the relevant server/test/install users are inactive and the original paths have not been regenerated, then run:

```sh
python3 /Users/tim/Code/fhfhockey.com/tasks/artifacts/recoverable-cache-cleanup-2026-10-13/restore.py --apply
```

The script validates the complete inventory and checks for existing original paths before restoration. It refuses overwrites. If a cache has already been regenerated, preserve it elsewhere first or use the exact manifest paths to choose a manual recovery; do not replace a running output. Empty recovery directories and the reversible-rename probe are retained. No recovery command was applied in this task.

## Verification and evidence

- **Passed:** pre-move path-type/device checks, no tracked files in move scopes, complete inventory stability, process classification and open-file checks. npm PID 2924 was running dev, with Next PIDs 2943/2945; no installer/test process or open file referenced the selected scopes. No installed-dependency symlinks pointed into selected roots.
- **Passed:** reversible rename probe into Trash and back preserved its inode; each move preserved its root inode. Every regular-file SHA-256, symlink target and object device/inode/size/mtime matched in the subsequent restore dry run: 70,327 objects.
- **Passed:** same HEAD `a8f58de6178e282acd3a71851c66f4a56b119f14`, branch `octoberBranch`, unchanged tracked/staged diff, all 51 initial dirty/untracked hashes unchanged, all 5,093 tracked paths present. Git status matches the initial status after excluding this new untracked receipt directory. The active server still held its original `web/.next/trace` FD after cleanup.
- **Not run:** application tests/typecheck/lint/builds, installations, new servers, live HTTP/DB/cron calls, credentials, commits, pushes or deployments. No processes were stopped, restarted or killed.
- **Held:** active caches, all unqualified script candidates, task/PRD consolidation pending verified replacement/reference decisions. No further cleanup was attempted.

`manifest.json` contains exact restoration mappings, sizes, statuses and verification. `cache-inventory.jsonl.gz` contains the full non-following object inventory and file hashes. `initial-preservation.json`, `final-preservation.json`, both raw NUL-separated Git statuses, process-use receipts, and the dependency-link check provide supporting evidence. Manifest/inventory records contain filenames, metadata and hashes, never credential values.

Audit basis (read-only, revalidated for the selected scopes): `/tmp/fhfh-repo-audit-20261013/report.md`, `retirement-candidates.json`, `item-level-review.md`, and `directory-symlinks.json`. No audit files were edited.
