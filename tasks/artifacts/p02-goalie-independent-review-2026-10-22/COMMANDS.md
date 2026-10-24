# P02 independent command receipts

Repository: `/Users/tim/Code/fhfhockey.com`, `octoberBranch`, HEAD `a565238f670edc4cf65da79ad52ba82ec41f3b71` at start/end. Node **22.11.0**, npm **10.9.0**, installed Vitest **3.2.7**; no dependency installation.

1. Read current AGENTS and named REPORT/LEASE/CANDIDATE/patch. Compared nine before/after source hashes, patch and candidate manifest. Checked nine candidate + 13 A7–A9 + 50 import-closure entries: **72/72 match**. Repeated at end.
2. Read bounded production callers: profile selects/prop flow; Overview/Trends/contextual components; landing page and mobile formatter; numeric writer mapping only. Nullable participation is permitted by the generated table and local game-log contracts. Exact caller excerpts/hashes are retained in `end-integrity.json`.
3. Isolated staging, using the inspected owner script (only scratch writes):

```sh
env -i PATH=/usr/local/bin:/usr/bin:/bin /usr/local/bin/node \
  tasks/artifacts/research-backlog-readiness-2026-10-22/p02-correctness/stage.cjs \
  > tasks/artifacts/p02-goalie-independent-review-2026-10-22/scratch-path.txt
```

It copied the bounded 50-file local import closure, excluded environment/credential/session paths, and symlinked installed dependencies. Added explicit `envDir:false` to the scratch Vitest config. Copied the unchanged `PlayerStatsSummary.tsx` as the additional inspected consumer, plus the independent fixture into scratch `components/PlayerStats/`. Canonical application bytes were never changed.

4. Executed the exact saved command branches:

```sh
sh tasks/artifacts/p02-goalie-independent-review-2026-10-22/RUN-CHECK.sh owner
sh tasks/artifacts/p02-goalie-independent-review-2026-10-22/RUN-CHECK.sh independent
sh tasks/artifacts/p02-goalie-independent-review-2026-10-22/RUN-CHECK.sh tsc
sh tasks/artifacts/p02-goalie-independent-review-2026-10-22/RUN-CHECK.sh lint
```

| Branch | Actual result | Receipt |
| --- | --- | --- |
| owner | exit 0; 96 passed in 6 files | `owner-tests.log`, `owner-tests.json` |
| independent | exit 1; 6 passed, 2 failed in 1 file | `independent-tests.log`, `independent-tests.json` |
| tsc | exit 0, no diagnostics | `tsc.log` |
| lint | exit 0, no diagnostics | `lint.log` |

The two independent failures reproduce P02-R1 in imported real Overview/Trends components. The contextual component using the same input correctly renders unavailable. The six passing independent controls cover omitted profile fields, paired complete support, known nonappearance, true zero SV, weighted GAA, classification denominator and incomplete playoff support (some assertions share a test). There was no fixture-setup failure or retry.

All branches run from the scratch web directory using `env -i`, synthetic `.invalid` service configuration, pinned network-deny preload plus Vitest fetch guard, inert npm configs, disabled npm background checks, `npx --no-install`, one worker and no environment-file loading. Full command bodies are in `RUN-CHECK.sh`. No `AUDIT_OFFLINE_NETWORK_BLOCKED` marker occurred. The existing `punycode` deprecation warning was emitted.

5. Before/after verification of all 51 copied source/configuration files succeeded. Compared both unleased summary consumers with `git show d3f057c6c849d5d5474bc912a6f461f617c65b15:<path>`: exact hash equality proves inherited filtering. These read-only Git operations used no `GIT_DIR` override.
6. Saved a source archive without node_modules, caches, environment files or credentials. For replay after canonical changes, extract `reviewed-source.tar.gz` into a fresh temporary directory, symlink its `web/node_modules` to the existing installation, and run the saved inert environment/config there. Do not replace pinned source with later canonical bytes or overwrite historical receipts.

The owner's 38-failure pre-fix log was inspected only; this pass did not replay it. No app edits, commits, pushes, full builds, browser/server launches, DB/provider/model calls or other external actions occurred.
