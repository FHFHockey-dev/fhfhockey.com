# Cleanup Reconciliation Checkpoint (7.2)

**Status:** Completed locally on 2026-07-31. This is a bounded repository cleanup only; it does not authorize or perform a deployment, build, migration, writer, repair, backfill, provider call, credential change, analytics reconciliation, or schedule mutation.

## Removed tracked temporary probes

The following six tracked files were investigation-only scripts with no runtime imports or supported callers:

- `web/tmp-run-sync.ts`
- `web/tmp-test-sheets.mjs`
- `web/tmp-check-games.ts`
- `web/tmp-check-pbp-games.ts`
- `web/tmp-check-pbp-structure.js`
- `web/tmp-check-seasons.js`

The exact consumer scan found no non-documentation references. `web/tmp-test-sheets.mjs` could write a Yahoo sheet when manually invoked, so removing it also eliminates an unowned manual-writer path. The files remain recoverable from Git history; no history rewrite was performed.

## Retained artifacts and boundaries

- `tasks/TASKS/dead-code-cleanup/prd-file-inventory.md` retains its historical filesystem snapshots; those snapshots are not current runtime inventory claims.
- The two PBP probe paths in `legacy-ingest-conventions.md` remain as historical audited-source references and are explicitly marked deleted; durable ingest ownership remains in the production modules listed there.
- Ignored local caches, Playwright output, logs, `.next`, node modules, and other generated files were not broadly deleted. They are outside the tracked repository cleanup and remain available for local recovery/diagnostics.
- `web/debug-goalies.ts`, nested historical SKO output, one-off root maintenance scripts, and other candidates remain untouched because their ownership or external usage was not proven in this bounded pass.

## Verification

- `git ls-files` no longer lists any of the six paths.
- A repository code-only reference scan finds no remaining runtime import/caller for any removed path; remaining Markdown references are historical inventory/contract references classified above.
- The six deletions and documentation updates pass `git diff --check`; no runtime, migration, or generated source was changed.
