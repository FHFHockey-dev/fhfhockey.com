# Complete coverage inventory

Filesystem snapshot: 2026-10-15 05:14 UTC. All sizes below are apparent regular-file/symlink lengths, not physical reclaimable space. Symlinks are not followed; directory inode sizes are omitted. This report directory is excluded. Empty top-level directories are shown explicitly.

| Root | Regular files | Symlinks | Apparent bytes | Tracked | Coverage / boundary |
| --- | ---: | ---: | ---: | ---: | --- |
| `.DS_Store` | 1 | 0 | 10,244 | 0 | Source/instruction metadata and permitted text/reference review; preserve unless explicitly listed as a candidate. |
| `.env` | 1 | 0 | 67 | 0 | Metadata only; contents never opened. |
| `.env.local` | 1 | 0 | 1,388 | 0 | Metadata only; contents never opened. |
| `.git` | 7,371 | 0 | 1,229,395,533 | 0 | Metadata only; all history, refs and worktree bindings preserved. |
| `.github` | 1 | 0 | 2,895 | 1 | Workflow configuration checked; no hosted job triggered. |
| `.gitignore` | 1 | 0 | 1,029 | 1 | Source/instruction metadata and permitted text/reference review; preserve unless explicitly listed as a candidate. |
| `.npm-cache` | 14,370 | 62 | 312,307,413 | 0 | Metadata only; executable cache and logs retained. |
| `.pytest_cache` | 6 | 0 | 4,677 | 0 | Metadata only; editor holds an open file. |
| `.tmp` | 0 | 0 | 0 | 0 | Empty at the metadata snapshot. |
| `.venv` | 19,362 | 3 | 552,549,419 | 0 | Installed Python environment; metadata only. |
| `.vercel` | 2 | 0 | 635 | 0 | Metadata only; credentials/project state untouched. |
| `.vscode` | 5 | 0 | 1,440 | 5 | Tracked editor setup; no cleanup candidate selected. |
| `AGENTS.md` | 1 | 0 | 16,116 | 1 | Source/instruction metadata and permitted text/reference review; preserve unless explicitly listed as a candidate. |
| `README.md` | 1 | 0 | 2,376 | 1 | Source/instruction metadata and permitted text/reference review; preserve unless explicitly listed as a candidate. |
| `SPRINT-MODE.md` | 1 | 0 | 10,079 | 0 | Source/instruction metadata and permitted text/reference review; preserve unless explicitly listed as a candidate. |
| `check_db.js` | 1 | 0 | 377 | 1 | Source/instruction metadata and permitted text/reference review; preserve unless explicitly listed as a candidate. |
| `cms` | 30 | 0 | 160,114 | 30 | Manifest/README/static source checked; two generated bootstrap tracking candidates, legacy v2 archive retained. |
| `docs` | 105 | 0 | 86,580,764 | 105 | Current source docs scanned; frozen audit ledgers reused and selectively revalidated; evidence/model artifact bodies excluded. |
| `find_templates.py` | 1 | 0 | 276 | 1 | Source/instruction metadata and permitted text/reference review; preserve unless explicitly listed as a candidate. |
| `fix_templates.py` | 1 | 0 | 3,204 | 1 | Source/instruction metadata and permitted text/reference review; preserve unless explicitly listed as a candidate. |
| `fix_terminal.sh` | 1 | 0 | 83 | 1 | Source/instruction metadata and permitted text/reference review; preserve unless explicitly listed as a candidate. |
| `functions` | 5,341 | 27 | 204,405,753 | 61 | Manifest/deployment route/source topology checked; installed dependencies and research/data bodies excluded. |
| `migrations` | 78 | 0 | 321,510 | 78 | Paths/sizes inventoried; migration/history evidence retained; no SQL execution. |
| `mise-en-place.md` | 1 | 0 | 7,140 | 1 | Source/instruction metadata and permitted text/reference review; preserve unless explicitly listed as a candidate. |
| `modeling` | 91 | 0 | 3,056,559 | 40 | Permitted Python source graph only; environment/data/evaluation contents excluded. |
| `node_modules` | 1 | 0 | 3,524 | 0 | Installed dependency metadata; preserve. |
| `output` | 243 | 0 | 77,824,234 | 243 | Metadata only; tracked screenshots/recovery/acceptance evidence retained. |
| `patch_layout.js` | 1 | 0 | 26,927 | 1 | Source/instruction metadata and permitted text/reference review; preserve unless explicitly listed as a candidate. |
| `safe_properties.py` | 1 | 0 | 804 | 1 | Source/instruction metadata and permitted text/reference review; preserve unless explicitly listed as a candidate. |
| `sql` | 2 | 0 | 23,492 | 2 | Paths/sizes inventoried; preserved. |
| `supabase` | 184 | 0 | 3,727,113 | 174 | Paths/sizes and source-reference ownership only; configs/secrets/internal state and migration bodies not used for cleanup. |
| `tasks` | 1,411 | 0 | 92,466,157 | 817 | Source documents, relevant prior cleanup/reconciliation manifests and link graph; unfinished specs and historical/raw evidence retained. This audit directory is excluded from footprint. |
| `tools` | 2 | 0 | 5,691 | 2 | Static source/manual entrypoint classification; no tool was executed. |
| `underlying-stats` | 3 | 0 | 1,579 | 3 | Compatibility re-exports retained; no current static import is not contract retirement. |
| `update_game_page.py` | 1 | 0 | 1,528 | 1 | Source/instruction metadata and permitted text/reference review; preserve unless explicitly listed as a candidate. |
| `vercel.json` | 1 | 0 | 86 | 1 | Source/instruction metadata and permitted text/reference review; preserve unless explicitly listed as a candidate. |
| `web` | 183,194 | 196 | 8,136,867,365 | 3,520 | Source/import/config/asset checks; browser binaries/dependencies/build/mirror/data artifacts metadata-only, except two tracked CMS bootstrap files are separately documented. |

**Total:** 231,818 regular files, 288 symlinks, 10,699,787,591 B; all 5,093 tracked paths present.

## Disjoint category totals

These category totals partition the inventory. Do not add root totals to category totals.

| Category | Files and symlinks | Apparent bytes |
| --- | ---: | ---: |
| generated-metadata-review | 11 | 1,008,857 |
| protected-configuration-metadata-only | 19 | 23,801 |
| source-documents-assets-or-configuration | 4,161 | 142,265,858 |
| git-preserve | 7,371 | 1,229,395,533 |
| local-cache-review-process-use | 162 | 3,452,846 |
| installed-dependencies-preserve | 116,793 | 2,611,910,251 |
| generated-build-review-process-use | 970 | 1,460,831,721 |
| evidence-or-output-preserve-metadata-only | 1,591 | 326,243,632 |
| protected-repository-mirror | 101,025 | 4,924,499,784 |
| test-diagnostics-preserve-until-reviewed | 3 | 155,308 |

## File-level inventories

- `filesystem-metadata.jsonl.gz`: every regular file/symlink with path, size, device/inode, allocation, timestamp, tracked status and category; zero body content.
- `tracked-coverage.csv`: one row per tracked path, including 3,496 permitted static-text scans and 1,597 metadata-only retention rows.
- `content-exclusions.json`: source-universe paths deliberately omitted from the permitted text corpus.
- `permitted-source-hashes.json`: the 3,546 permitted source/config/document files, scoped hashes and sizes.
- `document-inventory.json`: 441 source documents and checked/unchecked marker counts; markers are not acceptance verdicts.
- `asset-dispositions.json`: all 185 tracked public assets, including dynamic/logo/manifest/license exceptions.
- `dead-code-dispositions.json`: all 66 no-static-inbound non-route/test/script-classified source leads; no missing classification.
- `prior-retirement-revalidation.json`: all 22 previous retirement groups intersected with current metadata; groups overlap and must not be summed.

## Coverage limits

Metadata coverage is complete for files/symlinks visible at the snapshot, not a line-by-line semantic review. Credentials, environment contents, raw FORGE outcomes/training/evaluation/held experiments, raw artifact evidence, Git objects, dependencies and active generated caches were not semantically inspected. No symlink target, external URL, hosted CMS, private operational store or remote scheduler was queried. The two tracked Sanity generated source files were specifically inspected for provenance.

The parent checkpoint deadline is 06:56 UTC. These are earlier timestamped observations, not a claim of live state at that time.
