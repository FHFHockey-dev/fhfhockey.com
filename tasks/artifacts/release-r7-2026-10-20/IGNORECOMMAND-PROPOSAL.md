# ignoreCommand fix for cms-fhfhockey and functions-fhfhockey (proposal, NOT applied)

Status: TJ approved for R7 (2026-10-20 ~16:25Z). Shortened 2026-10-20 ~19:00Z to 224 chars after the R7 gate caught the 307-char draft exceeding Vercel's 256-char ignoreCommand limit (web/scripts/vercel-ignore.test.ts); that test now pins the missing-SHA policy. Changes ignored-build behaviour, so it ships only in an approved master candidate.

## Problem (R5 push, CHEF-REGISTER-2026-10-19 ~18:17Z)
- `cms/vercel.json` and `functions/vercel.json` exit 1 (= build) whenever `VERCEL_GIT_PREVIOUS_SHA` is empty **or not in the shallow clone**.
- The previous SHA is the project's last READY deployment. These two projects are ignored on almost every release, so that SHA drifts deeper behind master until it leaves the clone. R5 then built both projects although all 112 files were under `web/`.
- Since R5 they sit at `bb21d5942`, 4 master commits behind `b630e0767`. The same failure returns after enough web-only releases.

## Proposed command (same string for both files)
```sh
p=$VERCEL_GIT_PREVIOUS_SHA;if [ -n "$p" ]&&git cat-file -e "$p^{commit}" 2>/dev/null;then git diff --quiet "$p" HEAD ./;elif [ -n "$p" ]&&git cat-file -e HEAD~1 2>/dev/null;then git diff --quiet HEAD~1 HEAD ./;else exit 1;fi
```
- **Previous SHA present in the clone:** unchanged behaviour.
- **Previous SHA given but missing from the clone:** build only if the tip commit touched this directory.
- **Empty previous SHA, or no parent in the clone:** unchanged, it builds (fail-safe).
- `web/vercel.json` is not changed. The web project must build on every master release, and today's command already fails safe toward building.
- The root `vercel.json` (`exit 0`, project `fhfhockey.com`) is not changed.

## Residual risk
In the fallback, only the tip commit is compared. A multi-commit push whose earlier commit touched cms/functions while the tip didn't would be skipped. Our releases are single `commit-tree` commits on master, and every earlier release was evaluated when it was pushed, so this doesn't arise under the current process. Note it if the process changes.

## Local simulation (scratch git repo, `git clone --depth 3`, previous SHA outside the clone)
| Case | Old | Proposed |
|---|---|---|
| Web-only change | exit 1 (builds) | exit 0 (skips) |
| cms change at tip | — | exit 1 (builds) |
| depth-1 clone (no parent) | — | exit 1 (builds) |

Final command above re-run (2026-10-20 ~16:00Z) in fresh clones: depth 3, prev unreachable, tip touches nothing → 0 (skip); depth 3, cms change at tip → 1; depth 1, prev unreachable → 1; empty prev at depth 1 or 3 → 1; full clone, prev reachable, cms changed since → 1. All as intended.

## Verification after an approved release
Run the standard 4-project check. Expect 1 web build + 3 CANCELED; any cms/functions READY means the fix failed.
