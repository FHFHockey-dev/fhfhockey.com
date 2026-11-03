# Independent audit evidence and reproduction

Audit workspace: `/Users/tim/Documents/Codex/2026-10-26/task-3/audit`.
Source: `/Users/tim/Code/fhfhockey.com`, local `octoberBranch` at `cd73cbd695347a04c0d217ca7535a87ca609f4fb`.

## Focused offline tests

Successful command, executed from the audit workspace:

```sh
env -i PATH=/usr/local/bin:/usr/bin:/bin HOME=/Users/tim TMPDIR=/tmp TZ=UTC NODE_OPTIONS='--require=/Users/tim/Documents/Codex/2026-10-26/task-3/audit/block-network.cjs' /usr/local/bin/node /Users/tim/Code/fhfhockey.com/web/node_modules/vitest/vitest.mjs run --config /Users/tim/Documents/Codex/2026-10-26/task-3/audit/vitest.config.mjs
```

Result:14 files,577 tests passed,16.52 seconds. See `offline-tests-4.log`. The configuration uses source imports but places environment lookup/cache/config in the audit workspace, runs one worker, and uses inert repository test setup. The Node preload and test setup deny socket/TLS/HTTP/HTTPS/UDP and global fetch network entry points. `network-attempts.log` was never created. No dev server, build or live route was invoked.

Audit-specific `reproduction.test.ts` has a fully permitted positive control and two negative behavior reproductions: totals/comparison with assignment denied; participation-lineage change across successive revisions. All entities/numbers are fictional. A passing regression reproduction confirms the defect is present, not that source was fixed.

Retained startup attempts: `offline-tests.log` failed to resolve the Vitest config import; `offline-tests-2.log` hit filesystem EPERM for a Vite temporary directory outside the workspace; `offline-tests-3.log` hit a config bundling/dynamic-require error. The isolated `.mjs` configuration resolved these without escalation or source edits. None was an automatic-approval rejection; none is a remaining blocker. Files are retained under the no-deleting restriction.

## Release closure

- Used read-only `git show 538100d41ee87e721d2764b694f7bac8c2f2bb34:<path>` to hash every one of the192 modules named in the committed release receipt.
- Recomputed receipt/closure hashes: `release-closure-verification.json`.
- Exported only those source bytes plus tsconfig into `verified-release-web/` inside this audit workspace.
- Ran exported `scanForgeClosure` using `scan-release.cjs` (ts-node transpile-only, no main wrapper). Output `independent-closure-scan.json`:192 modules,0 findings,21 dynamic sites,1 guard regex.
- Did not execute the verifier CLI main wrapper, which removes a scratch directory; no-deleting takes precedence.

```sh
env -i PATH=/usr/local/bin:/usr/bin:/bin HOME=/Users/tim TMPDIR=/tmp TZ=UTC NODE_OPTIONS='--require=/Users/tim/Documents/Codex/2026-10-26/task-3/audit/block-network.cjs' /usr/local/bin/node /Users/tim/Documents/Codex/2026-10-26/task-3/audit/scan-release.cjs
```

This checks the frozen producer code closure. It is not a query of persisted run outputs, source database contents, DB views, or scientific performance.

## Identity / evidence inventory

| Artifact | Scope |
|---|---|
| `identity-start.json`, `identity-end.json` | Local refs, branch, worktree inventory, counts and final source stability. Production attribution is from supplied receipt, not fresh remote state |
| `status-start.txt`, `status-end.txt` | Raw preserved status snapshots; no changes staged. Large task-artifact lists include unrelated work |
| `origin-tree-comparison.json` | Saved origin refs have854 whole-tree differing paths; no web/supabase difference |
| `source-pin-verification.json` | All195 actual CODE-PINS rows: given hash,3795 baseline,HEAD,saved origin/master,saved origin/octoberBranch,working tree |
| `supplemental-source-pins.json` | Eight further important guard/verifier/native-policy/feature paths omitted from or supplementing old map |
| `evidence-index-check.json` |17 full-hash evidence index rows verified; shortened hash references are not counted as full-hash verification |
| `previous-inventory-check.json` |729 historical source inventory paths all resolve;727 hashes match; advancing coordination mailboxes differ |
| `previous-inventory-location-check.json` |491 of those entries absent from current repo but present in archive; no missing at both locations in this inventory |
| `goal-handoff-path-check.json` |94 extracted absolute references,7 existing,87 missing temporary path strings; not a count of87 logs |
| `previous-consolidated-path-check.json` |Narrow absolute-path extraction only; not exhaustive of old handoff relative-path tables. The inventory checks above are the broader relocation evidence |

All195 pinned source working-tree hashes and all recorded refs were unchanged on final check. Product dirty paths remained the preexisting next-env and Ottawa logo files. The source checkout, archive, leases and handoff were never written by this audit. Audit files and source copies live here only; no file was deleted.

No comprehensive code verification is claimed merely because its hash was checked. Relevant implementation, helper, fallback, flag and requirement paths were read; the report distinguishes those findings from metadata-only inventory checks.
