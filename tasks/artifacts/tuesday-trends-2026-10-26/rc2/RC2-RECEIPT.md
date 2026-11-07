# Tuesday Trends release candidate 2 (2026-10-26, local, not pushed)

- **RC2 commit** `24680c3de38723cf85c4af725057f7aa0ee4ddd5`, tree `bd2609f00521804eda9b1b4a0666468dca3b9221`, parent production master `0b21422db` (#387, after fetch). Pinned at `refs/rc/2026-10-26-tuesday-trends-2` (not a branch).
- **Scope:** 47 files (`FILES.txt`): 13 social-share source/test/e2e files, `OTT.png` (new), `OTT-2.png` (legacy) and 32 `teamLogos/outline/*.png`. +576/−86.
  - The blobs are exact HEAD blobs from TT commits 3333240b4, 0d173aed7, c8178b7e3, 6e3b284fd and f98312c9b, plus logo commit e6e5798bf.
  - For every one of the 47 files, the master blob equals the released TT-3 blob (8e755dab8) or is absent.
  - Import closure: every non-TT import (including `components/TransactionTrends/OwnershipSparkline`) is identical to master.
- **Sparklines** are ON by default (READ-APPROVAL addendum 2). `SOCIAL_SHARE_TUESDAY_SPARKLINES` is **not set** on the fhfhockey Vercel project (env key names checked, values not read), so no settings change is needed. Kill switch: set it to `0`.

## Gate (clean `git archive` export, node_modules symlinked, manifests identical to master, under the heavy lock)
| Check | Result |
|---|---|
| Full tsc (8 GB) | exit 0 |
| eslint (social-share dirs + spec) | exit 0 |
| CSS-module pure check `SocialShare.module.scss` (with web load path) | PURE OK |
| Vitest social-share | 231/231 |
| Vitest full | 14140 passed, 50 skipped, 5 failed tests / 6 failed files, all environmental (details below) |
| Playwright discovery | 33 tests |
| Playwright execution on RC2 export | not run. Worker: 33/33 on octoberBranch with identical blobs and the v2 pin set (18 Mon/Wed pins: 4 Ottawa-only re-pins by design, 14 byte-identical) |

**Full-suite failures:**
- Five need `git rev-parse` or `git grep`, which an export without .git can't provide: `qualify-native-players-offline`, `nativeGoalLedgerAudit`, `nativeIntervalReconciliation`, `researchGoalBaseline`, and the new `reserveProjections` source-audit test from #387.
- `components/ArticleReader/related.server.test.ts` fails to load `next-sanity` through the symlinked node_modules (Vite fs boundary). It fails **identically on a clean export of plain master 0b21422db** and passes in the canonical checkout. Its import chain touches no TT file.

## Vercel expectation (inventory as RC1, previews disabled on all 4 Git-linked projects)
- Push of a `chef/` branch: 0 deployments.
- PR: 0 deployments.
- Squash-merge: 1 fhfhockey (web) production build; functions, cms and root are CANCELED by their ignore rules.
