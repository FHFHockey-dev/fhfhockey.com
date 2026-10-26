# PC ticket 3: WIRING-1 applied, with C7 R23 L1 fixed

PC lane, 2026-10-25, ~19:07Z. Grant: the orchestrator's ticket 3, covering exactly the files in WIRING-1.md's target list (the new `cardEvidenceVerdict.ts` and its test, plus the one page file) and no others. **Not committed.** No Git changes, no GIT_DIR, no production, no server, no live reads.

## Files applied to the canonical tree (HEAD `cc4886a81`)

| Path | Status | sha256 | bytes |
| --- | --- | --- | --- |
| `web/lib/player-cards/cardEvidenceVerdict.ts` | new | `81e7be2085ab44318ddf9c2b23b38ad70eedce7a247aadb9decbbf324882c56b` | 2526 |
| `web/lib/player-cards/cardEvidenceVerdict.test.ts` | new | `d1e15b2037ac1f1ecedbc4a8fd30e469a356983e8765208942496d2a5a913f21` | 7720 |
| `web/pages/social-share/player-cards.tsx` | modified (from `fac7acb9…`) | `c47bb0c02b50dfd3eac4d439f64cb91a3612dc09fff6400b1354b8fec83aa4de` | 1512 |

**Apply procedure:**
- I verified that the page pre-hash equalled the pinned `fac7acb9…`, and that both new paths were absent.
- I confirmed that the loader, bundle and fixture dependencies were byte-identical between the snapshot and canonical.
- I copied the new files with `cp -n`. Each applied file is byte-equal to the snapshot `/private/tmp/pc-wiring-3/web`.
- `git status`: ` M` page, `??` for the 2 new files; there are no other player-card changes.

**Not applied:** `web/__tests__/pages/social-share/player-cards.test.ts`, from WIRING-1, because it was not granted (C7 L4). Its page-props check now lives in `cardEvidenceVerdict.test.ts`. The page file is byte-identical to WIRING-1's version; only `cardEvidenceVerdict.ts` and its test changed from the patch.

## C7 R23 findings addressed

| Finding | Change |
| --- | --- |
| **L1: props shipped to every visitor, with free-text reasons** | `EvidenceVerdict` is now only `{ state, metrics: Record<MetricId, state>, issueCodes, liveActivation: false, premiumActivation: false }`. `reasons`, `bundleId`, receipt ids, paths, member ids, the card, values and ranks are not in props. Issue codes are code-defined constants, filtered through a kebab-case allowlist regex so no data-bearing string can pass. A renderer later maps codes to fixed copy. |
| **L1 test** | "serializes only states and codes…" builds an **observed** bundle against the real five-row admission. It adds unadmitted internal references (`internal/history-path.json#player-1`, `internal/population.json#members-8475000`) and a secret bundle id. The test first proves that the full validator reasons *do* contain a receipt id. It then asserts that the verdict JSON contains **none** of: the reason strings, the bundle id, the retained path, `internal/`, member ids, the receipt hash, or the keys `reason(s)`/`receiptId`/`bundleId`/`card`/`readings`/`rank`/`value`/`sha256`/`retainedPath`. "ships the page's getServerSideProps…" asserts that the actual page props have exactly the narrowed keys, the same exclusions, and no `studio-preview`. |
| **L2: guard missed `import()`/`require()`** | The guard patterns now match static `from`, dynamic `import()` (including template strings) and `require()`, with a self-test of those forms plus one near-miss name. |
| L3: client bundle not verified | **Still open.** No build authority. The first authorised local `next build` should confirm that the page's client JS has no `node:fs` or `evidenceLoader` chunk. |
| L4: page test outside the lease | Dropped; its check moved into the granted test file. |
| L5: root and cost | Unchanged. The root is the test-fixture path, the studio's synthetic origin reads zero files, and the deployed root is still undecided. |

## Checks (canonical tree, cwd `web/`, GIT_DIR unset; 19:06:12–19:07:13Z under `/private/tmp/fhfh-heavy.lock`, acquired by atomic `mkdir` with a wait and no steal, released after)

| Check | Result | Log sha256 (`checks3/`) |
| --- | --- | --- |
| `npx vitest run lib/player-cards/` | **PASSED**: 9 files, 100 tests (the existing 94 + 6 in `cardEvidenceVerdict.test.ts`) | `tests.log` `facfd189…` |
| Scoped `tsc --noEmit -p checks3/tsconfig.json` (3 applied files + loader) | **PASSED** (exit 0) | `types.log` `e3b0c442…` (empty) |
| **Whole-project** `NODE_OPTIONS=--max-old-space-size=8192 npx --no-install tsc --noEmit` | **PASSED** (exit 0) | `types-whole.log` `e3b0c442…` (empty) |
| `npx eslint` on the 3 applied files + `evidenceLoader.ts` + `evidenceBundle.ts` (current config, including the C1 `no-restricted-imports`/`no-restricted-syntax` rules) | **PASSED** (exit 0) | `lint.log` `e3b0c442…` (empty) |
| Mutation check (snapshot, then restored and hash-verified as `81e7be20…`) | Putting `reasons` back into the verdict fails 3 tests: the studio preview test and both props-leak tests. | console only |

Exit codes and timings are in `checks3/run.txt` (`13feb78d…`). **Not run:** build, browser and E2E (L3).
