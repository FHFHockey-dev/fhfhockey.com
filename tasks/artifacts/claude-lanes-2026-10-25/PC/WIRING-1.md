# WIRING-1 (draft, not applied): first card wiring through `validateAdmittedEvidence`

PC lane, 2026-10-25 ~18:30Z (whole-project tsc added at 18:29Z). Base: loader commit `4d37b51c9`. **Draft only.** The canonical `web/` is untouched: `web/pages/social-share/player-cards.tsx` is still `fac7acb9…`, the pinned baseline. No Git, no GIT_DIR, no production, no server.

- **Patch:** `WIRING-1.patch`, sha256 `bc96b5c4b4d75c5d43461b19d6c3d5b6e35da23a9fd3786aadf572c311a37e10`.
- **Dry-run:** `patch -p1 --dry-run` from the repo root applies cleanly.

## Target files

| Path | Change | sha256 after patch |
| --- | --- | --- |
| `web/lib/player-cards/cardEvidenceVerdict.ts` | **new**: server-only verdict helper | `291e786e…5e21` |
| `web/pages/social-share/player-cards.tsx` | `getServerSideProps` adds an `evidence` prop; the render is unchanged | `c47bb0c0…aa4de` |
| `web/lib/player-cards/cardEvidenceVerdict.test.ts` | **new**: import-boundary guard + verdict test | `b841fb02…4c82` |
| `web/__tests__/pages/social-share/player-cards.test.ts` | **new**: page server-props test | `ee9fbff2…e214e504` |

**Lease note:** the page test path is **outside the PC lease**, which covers the page and new files under `web/lib/player-cards/`. Either extend the lease to that one new path, or drop that file; the guard test in `lib/` still covers the boundary.

## What it does

- **`cardEvidenceVerdict(input, bundle)`**
  - Always calls `loadAdmittedEvidence` itself, with a **server-fixed root**, then `validateAdmittedEvidence`.
  - Callers cannot pass a root, receipts or an evidence index.
  - It returns only a JSON-serializable verdict: `state`, `bundleId`, per-metric `state`/`reasons`, `issueCodes` and `live/premiumActivation: false`. Receipts, the adapted card, values and ranks never leave the server.
- **`unclaimedBundle(input, playerId, id)`** is a bundle that names the selection and claims no receipts. That is honest for the studio's fabricated preview, which has none.
- **Page `getServerSideProps`**
  - It builds the studio's default fixture (`INITIAL_FLOW`, the same call the studio makes client-side) and returns `{ evidence }`.
  - The page **does not render it**. Showing it, for example as an "evidence incomplete" badge, is a separate UI change that needs TJ's product sign-off.
  - Headers are unchanged.

## Why the `validateAdmittedEvidence`-only path is sound

1. **Single gate, enforced by test.** The guard test scans every non-test `.ts`/`.tsx` file under `web/{lib,components,pages,hooks,utils}`. It requires that:
   - `validateEvidenceBundle` appears only in `evidenceBundle.ts` and `evidenceLoader.ts`;
   - `evidenceLoader` is imported only by `cardEvidenceVerdict.ts`;
   - `cardEvidenceVerdict` is imported only by the page;
   - no `components/` file imports any evidence module.

   Any later route or UI that reaches the raw validator, or imports the loader from client code, fails CI.
2. **No caller-supplied evidence.** The helper's signature has no evidence, root or receipts parameter. The handle comes from the loader's private `WeakSet`, so even server code can't forge one.
3. **Request-free inputs.** `input` and `bundle` are built on the server from fixed fixtures. Nothing is read from `query`, `body` or cookies.
4. **Fail-closed root.** Whether the files are absent, untraced in a serverless bundle or tampered, the result is "nothing admitted", so the verdict is `incomplete`, never more eligible.
5. **The fixture's self-asserted proof is ignored.** The studio fixture sets `population.complete: true`, `verifiedMetrics: all`, `completeHistory: true` and `fabricated-…` references. The verdict test confirms that the gate still says `incomplete`, with history, finality, definition and population all missing. The studio's own client-side `adaptLocalSnapshot` preview is unchanged and remains a labelled fabricated preview.
6. **The client bundle stays free of `node:fs`.** The loader is reachable only from `getServerSideProps`, which Next strips from the client bundle along with its imports.

## Test plan and result

**Snapshot:** `/private/tmp/pc-wiring-1/web` is an rsync copy of canonical `web/` at `48809914a`, plus the working tree. It excludes `node_modules` (symlinked), `.next*`, `public` and `e2e`.

| Check | Result |
| --- | --- |
| `npx vitest run lib/player-cards/ __tests__/pages/social-share/player-cards.test.ts` (GIT_DIR unset) | **PASSED**: 10 files, 98 tests. That is the existing 94, plus 3 guard/verdict tests and 1 page test. |
| Scoped `tsc --noEmit` (4 patched files) | **PASSED** (exit 0) |
| `eslint` (4 patched files) | **PASSED** (exit 0) |
| Whole-project `NODE_OPTIONS=--max-old-space-size=8192 npx --no-install tsc --noEmit` (snapshot, under `/private/tmp/fhfh-heavy.lock`, 18:28:39–18:29:39Z) | **PASSED** (exit 0, empty log `e3b0c442…`). A first try at 18:27Z hit 3 TS2307 errors in `scripts/draft-pro/*` only because the snapshot had left out `e2e/`; none was in the patch files. After copying `e2e/` in, the run was clean. |
| `next build`, client-bundle check, browser, E2E | **NOT RUN** (no build authority). Item 6 relies on the Next convention; the first applied build or C7 should confirm that `node:fs` is absent from the client chunk. |

**Before applying:**
1. C7 reviews the guard-test patterns.
2. Settle the lease for the `__tests__` path.
3. Recheck that the canonical page is still `fac7acb9…` and that the patch dry-run is still clean (both were rechecked at 18:27Z against HEAD `48809914a`).

The helper's comment notes that the server-fixed root (`lib/player-cards/__fixtures__/retained`) is test-fixture-backed. Choosing a deployed retained-evidence root is still open.

**Housekeeping:** while setting up the snapshot I ran `git init` inside `/private/tmp/pc-wiring-1/web` by mistake, then deleted that `.git` at once. It never touched the canonical repo. The patch was produced with `diff -u`.
