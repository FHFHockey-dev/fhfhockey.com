# Preservation manifest, 2026-10-17

Machine-readable copy: `preservation-manifest.json`. It records every branch tip with its uniqueness counts, every worktree, the stashes, the tags, the dirty file hashes and the ignored-but-important paths.

**Nothing below is a deletion target.** The counts are evidence leads. Any cleanup needs its own approval (see `APPROVAL-REQUESTS.md` C2).

## 1. Reconciliation against the dated counts

| Item | Dated evidence | Now | Reconciled |
|---|---|---|---|
| Local branches | 179 (manifest 2026-10-12) | **179** | Same set. 177 tips unchanged since 10-12, and each still equals its `refs/archive/fhf-reconciliation-20261012/heads/*` ref. The 2 that moved are `master` and `octoberBranch`, both expected |
| Remote heads | 13 | **13** + `origin/HEAD` = 14 tracking refs | Same names. The remote tips differ only for `octoberBranch` (now `ceceb407a`) |
| Archive refs | 299 (bundle `complete-alternatives.bundle`) | **299** present locally | Bundle sha256 `bae1028ce110d249b9d3f387938f099d9ac461da244c6a2a0f30f8e2b2aa8e48` re-verified, 3,358,510 bytes |
| Worktree registrations | 106 (10-12) | **104** | Two `.codex` registrations are gone (`start-chart-data-health`, `yahoo-scoring-fix`). Both branches still exist |
| Existing worktree directories | 30 (10-12) | **28** | 1 canonical, 23 `.codex`, 1 `~/Documents/Codex` (detached), 3 other `~/Code` checkouts |
| Prunable `/private/tmp` registrations | ~79 (handoff) | **76** | All 76 are prunable. Every HEAD is reachable from a ref; none is locked |
| `.codex` worktrees | ~26 (handoff) | **23** under `~/.codex/worktrees` + 1 under `~/Documents/Codex` | — |
| Stashes | 2 | **2** | `stash@{0}` `01aa26ab4` (1 file, master next-env); `stash@{1}` `e783615d2` (31 files, pre–Draft Pro) |
| Tags | — | 14 | 13 `archive/2026-09-12/*` (on the remote too), plus `chef/pre-sync-20261017` (local only) |
| Codex refs | — | 390 `refs/codex/turn-diffs/*`, 28 `refs/codex/snapshots/*` | Local only; they hold many otherwise-unreferenced blobs |

## 2. Unique work to protect

- **139 branches** have commits not in octoberBranch, and **99** of those have patch-unique commits (`git cherry`).
- **131** of the 139 exist only locally.
- The 99 patch-unique branches, by their 10-12 disposition:

| 10-12 disposition | Branches |
|---|---|
| superseded_or_uncertain_alternative | 33 |
| historical_development_alternative | 32 |
| research_or_evidence_alternative | 28 |
| historical_alternative | 6 |

- Each one is also captured by an archive ref and by the bundle.
- Named side-branch work the register still treats as open:
  - `chef/forecast-m1-caller-integration` `9592e2e6`: absent from octoberBranch
  - `chef/start-chart-consumer` `894fe7ea`: about 46% present
  - `chef/social-share-tools` `2331cc1`: about 89% present
  - forge cron-chain `8b6332`: absent
  - `76d507e`: about 39% present
- Remote branches ahead locally:
  - `chef/fantrax-setup-and-skt`: local is 7 ahead of origin
  - `chef/start-chart-data-health`: local is 4 ahead of origin
  - Neither has been pushed. This is preserved state, not drift to correct.

## 3. Uncommitted work outside the canonical checkout

All 44 files match the 2026-10-12 backups under `.git/fhf-reconciliation/20261012-1621/worktree-{083,097,104}/` byte for byte:
- modified files: checked against the `tracked.patch` post-image index
- untracked files: checked by the sha1 of each `untracked.tar` member

| Worktree | HEAD | Dirty | Unique (in no ref) | Backup |
|---|---|---|---|---|
| `~/.codex/worktrees/forecast-checkpoint-1/fhfhockey.com` (`chef/forecast-checkpoint-1`) | `9b11d3607` | 3 modified, 11 untracked (forecast-diagnostics loader, contract and page) | `tasks/TASKS/nhl-game-prediction-model/tasks-forecast-checkpoint-1.md` | worktree-083 ✓ |
| `~/.codex/worktrees/rso-consolidated-execution/fhfhockey.com` (`chef/rso-consolidated-20261009`) | `5399effe8` | 1 untracked | `tasks/rso-goal-decisions.md` | worktree-097 ✓ |
| `~/Code/fhfhockey-october` (detached) | `6e14053ff` | 11 modified, 18 untracked | Dirty `RosterScheduleOptimizer.tsx` and `.test.tsx` | worktree-104 ✓ |

AGENTS.md says to preserve `fhfhockey-october` without further edits. Its other 27 dirty files exist in octoberBranch history or in other refs.

**Single point of failure.** The bundle, the archive refs and these backups live only in this machine's `.git`. Nothing above is on GitHub except the 13 remote heads and 13 archive tags. An off-machine copy of the bundle is approval request C1.

## 4. Canonical checkout working tree (moving target)

At 2026-10-17T19:59:45Z there were 32 modified tracked files and 5 untracked `tasks/` directories. They come from active sessions: the RSO/Start Chart test fix, IFTTT, FORGE, and a security-candidates session. The blob hashes are in the JSON.

These uncommitted edits touch **released production paths**:
- `web/lib/NHL/corsProxy.ts` (+ test)
- `web/utils/adminOnlyMiddleware.ts` (+ test)
- `web/__tests__/pages/api/cors.test.ts`

They also touch the release-excluded IFTTT receiver `web/lib/sources/lineSourceIftttReceiver.ts` (+ test). See `CONFLICTS.md` item 4.

## 5. Ignored but important (never commit, never publish)

| Path | Files | Why |
|---|---|---|
| `tasks/ifttt-integration-2026-10-16/handoff/extracted-reviewed/` | 1,147 (26 MB) | Reviewed IFTTT handoff. **A tracked test reads it** (`tweetClaimOccurrenceIdentity.test.ts`) |
| `tasks/ifttt-integration-2026-10-16/next-increment/frozen-checkpoint-v1/` | 28 | IFTTT frozen checkpoint |
| `web/tasks/` | 15 | Ignored web-local task notes |
| `supabase/.temp/`, `web/supabase/.temp/` | 9, 1 | Supabase CLI link state |
| `.vercel/`, `web/.vercel/`, `functions/.vercel/` | 2, 2, 3 | Vercel project links |
| `.env`, `.env.local`, `functions/.env`, `functions/.env.local`, `web/.env.local`, `web/.env.development.local`, `web/.env.mcp`, `web/scripts/.env` | 8 | Credentials. Sizes only; **contents not read** |
| `.npm-cache/` (315 MB), `.venv/` (570 MB), `web/.ms-playwright/` (534 MB) | — | Regenerable caches |
| `~/Documents/FHFH-private/…` | ? | Private receipts and captures. Not readable in this session. **The 2026-10-20 live FORGE run writes here** |
