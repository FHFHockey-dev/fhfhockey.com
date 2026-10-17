# Ancestry and repository state, 2026-10-17

Observed 2026-10-17 between 19:40Z and 20:08Z in `/Users/tim/Code/fhfhockey.com`. Every git command ran with `GIT_OPTIONAL_LOCKS=0`. No ref, index, remote, branch, worktree or stash was changed. The only network reads were `git ls-remote` plus read-only GitHub and Vercel GETs.

## 1. State change during this review: the FORGE commits are now pushed

The handoff said octoberBranch had three unpushed local commits. **That is no longer true.**

| Observation | `refs/heads/octoberBranch` on GitHub |
|---|---|
| First `git ls-remote origin`, start of this session | `448231eca` |
| Second `git ls-remote origin`, 2026-10-17T19:58:21Z | **`ceceb407a`** = local octoberBranch |
| GitHub repository `pushed_at` | `2026-10-17T19:51:51Z` |

The local remote-tracking ref `refs/remotes/origin/octoberBranch` still reads `448231eca`. I did not fetch.

So `4ce7e1f5f`, `a23728de2` and `ceceb407a` were pushed at about 19:51Z, by TJ or another session; not by this one. Read-only checks at 19:58Z, about 7 minutes after the push:

| Check | Result |
|---|---|
| Vercel deployments for team `team_KVFicHhQJARTbO6wRD2x6jpq` since 2026-10-17T00:00Z | **0** across all four projects |
| GitHub combined status on `ceceb407a` | `pending`, 0 statuses |
| GitHub deployments on `ceceb407a` | 0 |
| GitHub check-runs on `ceceb407a` | 0 |

Receipt: `vercel-github-observation.json`. Deployment entries normally appear within a minute of a push, so this is strong evidence that the push started no build. It is not proof against a much later entry.

## 2. Ref table

| Ref | Commit | Tree | Notes |
|---|---|---|---|
| production (`origin/master`, local `master`, `origin/HEAD`) | `457435eb3010c5b3dd92d2e1a46d9c75d851780a` | `15a49218d955fb8e41ed408ea5d6e0930052beea` | Child of `90d3d5963`; deployment `dpl_6ccUfnYgqnueRsNEbSESqZmSbzPu` READY |
| local `octoberBranch` = GitHub octoberBranch | `ceceb407a29b45f2e5b0c090ecfcff0c27e15d4c` | `87bd6ded81059c20a75d789938f8617386722506` | 22 commits ahead of production (17 non-merge), 0 behind |
| `refs/remotes/origin/octoberBranch` (stale) | `448231eca088e3dbb82f0ea8d9f1fa79619ac99c` | `987da54b20ea9a686fba5f99a71d0d4c53b7d8e9` | Merge of `7f094c8e6` and `457435eb`; matches the handoff |
| `refs/tags/chef/pre-sync-20261017` (local only) | tag object `1d939eeb6`, peeled to `7f094c8e68be136ef72a6fb56c073dc2ba0d43b2` | — | "octoberBranch before merging released 457435eb" |
| `f08e5909` | `f08e59095260a35405f5eb121b497a4b2bfffce7` | — | Commit object only, on no branch; superseded by `448231eca`, never used |

Ancestry facts:
- `merge-base(octoberBranch, origin/master)` = `457435eb`, so the release is an ancestor of octoberBranch.
- `merge-base(7f094c8e6, 457435eb)` = `90d3d5963`, the previous production.
- `7f094c8e6` already contained 33 of the 37 released paths, because the release was cut from that October work.
- The merge `448231eca` changed exactly the four `admin-auth-route-fixtures` tests:
  - `calculate-wigo-stats.test.ts`
  - `update-nst-goalies.route.test.ts`
  - `update-player-trend-metrics.test.ts`
  - `update-wgo-averages.route.test.ts`
- All 37 released paths are byte-identical between `457435eb` and octoberBranch. There was no conflict-resolution drift.
- `448231eca..ceceb407a` touches 14 paths, which are the three FORGE commits:
  - 8 under `web/`
  - 1 migration
  - 4 under `tasks/`
  - `migration-authority.json`, which is one of those `tasks/` paths

## 3. Unreleased commit range `origin/master..octoberBranch`

| Commit | Date | Subject | Non-`tasks/` paths | `tasks/` paths | Acceptance on record |
|---|---|---|---|---|---|
| `0e8040da9` | 10-11 | Fix Start Chart selection for available partial categories | 3 | 0 | Master Page: independently accepted locally. **All 3 paths later changed by `7f094c8e6`** |
| `569245efd` | 10-11 | Retain bounded structured cron response outcomes | 2 | 0 | Accepted locally; bytes unchanged since |
| `6767073ea` | 10-11 | Hydrate native skater history from matched durable support | 2 | 0 | Accepted locally; later changed by `6e14053ff` |
| `90ae40f01` | 10-11 | Preserve bounded tweet injury and starter evidence | 4 | 0 | Accepted locally; 3 of 4 paths later changed by `7f094c8e6` |
| `26468a9fc` | 10-11 | Read retained failure diagnostics in cron reports | 2 | 0 | Accepted locally. `cron-report.ts` later gained a 2-line alias in `7f094c8e6` |
| `406a47ae4` | 10-11 | Keep NST partial source coverage eligible for bounded retry | 2 | 0 | The bounded-retry repair is deployed as `395282458d`. This branch copy was later changed by `1ddef915d` and `7f094c8e6` |
| `6e14053ff` | 10-11 | Require aligned conversion counts and preserve missing goal outputs | 19 | 0 | Consolidation checks passed; no independent acceptance found |
| `1ddef915d` | 10-11 | "10/11" | 36 | 3 | Master Page: "the entire 39-file commit is not accepted"; the 7 RSO hashes matched review v3 |
| `971a43e78` | 10-11 | Keep rejected private participation evidence unavailable | 2 | 1 | Accepted and frozen; bytes unchanged since |
| `cfaac232e` (merge) | 10-11 | Merge minimal NST production release | — | — | NST repair, done; not reopened |
| `6551974b2` | 10-12 | "10/12" | 11 | 3 | None found |
| `56b9f4693`, `fc43b0734` (merge) | 10-12 | Mobile Game Grid rows | 2 | 0 | Patch-equivalent release on master as `8b5dd8fcb`. Its paths are not in today's diff |
| `4ca92f874`, `7413a2347` (merge) | 10-12 | Desktop sticky dates | 4 | 0 | Patch-equivalent release on master as `b76b17415`. Not in the diff |
| `5c28f7e8b` | 10-12 | Restore idle RSO requests | 2 | 0 | Retained checkpoint. Both paths later changed by `7f094c8e6` |
| `a8f58de61` (merge) | 10-12 | Merge released cost controls | — | — | — |
| `7f094c8e6` | 10-17 10:55 ET | "big commit" | 294 | 5,529 | None as a whole. Individual paths are matched to receipts in `PATH-LEDGER.md` |
| `448231eca` (merge) | 10-17 13:10 ET | Merge released 457435eb | 4 | 0 | The released fixtures |
| `4ce7e1f5f` | 10-17 14:17 ET | Offline native cadence output preparation + catalog-head migration | 4 | 0 | FORGE LEDGER §7: agent review, 2 Medium findings fixed |
| `a23728de2` | 10-17 14:37 ET | Record applied catalog-head migration; cadence binding; expiry tests | 6 | 2 | FORGE LEDGER §9/§11. **The migration is applied to hosted Supabase** (ledger version `20261017183611`) |
| `ceceb407a` | 10-17 15:31 ET | v1 daily FORGE pipeline driver | 6 | 2 | FORGE LEDGER §12: reviewer pass 2 found nothing blocking. Used by the 2026-10-20 live run |

The total diff is 5,855 paths: 319 non-`tasks/` and 5,536 under `tasks/` (about 300 MiB).

## 4. What is where

| Class | Where | Count / size | Public? |
|---|---|---|---|
| Production source | `origin/master` `457435eb` | — | yes |
| Unreleased source (`web/`, `supabase/`, `modeling/`, docs) | octoberBranch only | 319 paths (see `PATH-LEDGER.md`) | **yes**: octoberBranch is on the public GitHub repo |
| Task/evidence artifacts | octoberBranch `tasks/` | 5,536 paths, about 300 MiB; 478 files / 75 MiB of them are npm `_cacache` | **yes** (public) |
| Tracked env files | `cms/.env.development`, `web/.env.development`, `web/.env.production`, `web/.env.test` | Identical on master and octoberBranch (pre-existing). Key names are `NEXT_PUBLIC_*`, Sanity, CMS and Yahoo redirect; no secret-named keys | yes (pre-existing) |
| Committed npmrc files | `…/approved-dependency-audit/{user,global}.npmrc` | Both empty | yes |
| Uncommitted work, canonical checkout | 32 modified files + 5 untracked task directories at 19:59:45Z, from other active sessions | `preservation-manifest.json` | no |
| Uncommitted work, other worktrees | `forecast-checkpoint-1` (3 modified, 12 untracked), `fhfhockey-october` (11 modified, 18 untracked), `rso-consolidated-execution` (1 untracked) | `preservation-manifest.json` | no |
| Ignored but important | IFTTT `handoff/extracted-reviewed/` (1,147 files, 26 MB; **a tracked test reads it**), IFTTT `frozen-checkpoint-v1/` (28 files), `web/tasks/`, `supabase/.temp`, `.vercel` links, 8 env files | `preservation-manifest.json` → `ignored_but_important` | no. Env contents were not read |
| Private evidence | `~/Documents/FHFH-private/…` | **not readable in this session** (permission classifier) | no |
| Recovery bundle | `.git/fhf-reconciliation/20261012-1621/complete-alternatives.bundle` | 299 refs; sha256 `bae1028c…` re-verified | no (one disk only) |

Privacy note. A privacy scan reported no live secrets in `7f094c8e6`. I did not repeat it. I only added the env-key and npmrc checks above. The public octoberBranch already exposes:
- the research and evidence corpus
- absolute local paths (`/Users/tim/...`)
- reviewer transcripts

A curated release cut from master (see `NEXT-RELEASE-PLAN.md`) keeps all of this out of `master`. It cannot un-publish octoberBranch.

## 5. Hosted state that is ahead of, or apart from, the repo

- **Applied 2026-10-17:** `public.native_forecast_catalog_heads` and RPC `cas_native_forecast_catalog_head` (ledger `20261017183611`). The file exists only on octoberBranch. Production code does not read it, and production has no catalog-head env var.
- **`20261016152305`**, the Oct 16 RPC revocation, is in the hosted ledger with no local file on either branch. It is recorded and not reopened.
- Register row 17: hosted `20261004132508`, `20261004132526` and `20261004234756` also have no local files.
- `20261011115124` (raw-shift occurrences) and `20261011160000` (NST PK fractional start rates) exist only on octoberBranch. Their hosted state was not read here.
