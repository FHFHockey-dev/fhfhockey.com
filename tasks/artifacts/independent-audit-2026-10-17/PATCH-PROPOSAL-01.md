# Patch 01: scope Apollo and notistack providers to their only consumers

**Status: applied to the working tree at TJ's request on 2026-10-17 at about 21:15 UTC, and not committed.** The diff is [patch-01-scope-global-providers.diff](patch-01-scope-global-providers.diff): 4 files, +40/−20, generated from scratch copies of the `ceceb407a` files. Results are at the end of this file.

## Why this is first

- It is the largest measured win found: **−91.1 kB gz (−290.6 kB raw) of JavaScript on every page**, 35% of the 263 kB shared bundle (BASELINE M2).
- It is the smallest blast radius: no data, schema, dependency, schedule or scoring change.
- It has clear acceptance metrics.
- All four files were clean at audit time (`git status` showed no changes from other sessions), and none appear in the sibling notes' work.

The two truncation fixes (BACKLOG #2 and #3) are as small and should follow immediately. #2 has a calendar deadline, about 2026-12-01. They are not first only because they fix correctness on two routes, while this patch affects every visitor.

## Change

| File | Change |
| --- | --- |
| `web/pages/_app.tsx` | Remove the `ApolloProvider` and `SnackbarProvider` imports, the Apollo client import, the `hasGql` variable and both wrappers. The tree becomes `<><AuthProvider>{AppContent}</AuthProvider><Analytics /><SpeedInsights /></>`. |
| `web/components/Comments/Comments.tsx` | Import `ApolloProvider` and `lib/apollo-client`. Wrap the existing `forwardRef(Comments)` in `CommentsWithClient`, which applies the provider only when `NEXT_PUBLIC_SANITY_GRAPHQL_URI` is set (the same guard as before) and forwards the ref so `commentsRef.current.refetch()` keeps working. |
| `web/pages/db/index.tsx` | Rename `Page` to `DbPage`. The new default export `Page` wraps it in `<SnackbarProvider maxSnack={3} autoHideDuration={6000}>`, the same options as `_app`. |
| `web/pages/db/upsert-projections.tsx` | Same pattern: `UpsertProjectionsContent` inside a `SnackbarProvider` default export. |

## Behavior preserved

- **Apollo client.** It stays a module singleton (`lib/apollo-client.js`), so its `InMemoryCache` survives client-side navigation between posts as before.
- **Comment loading.** Comments still query with `notifyOnNetworkStatusChange`, and `CommentForm`'s `fetchComments` still calls `refetch`.
- **Missing GraphQL URI.** Behavior without `NEXT_PUBLIC_SANITY_GRAPHQL_URI` is unchanged: no provider, exactly as `_app` did.
- **Snackbars.** Options are unchanged. The provider now sits inside `Layout` and `AuthProvider` instead of outside them. notistack 2 renders a `position: fixed` container. The `Layout` transforms sit on the header and menus, not on page-content ancestors (`Layout.module.scss:116` is `transform: none`), so the anchor should be unchanged. The acceptance test checks this.
- **Untouched.** Auth, scoring, lineup legality, forecasts, data provenance, freshness labels and account isolation. The `/db` pages keep their existing admin checks.

## Evidence gathered without applying

- An esbuild bundle of the patched `_app.tsx` goes from 160,770 to 69,671 bytes gz, and the Apollo and MUI signatures drop to 0 (BASELINE M2).
- The patched `Comments.tsx`, `db/index.tsx` and `db/upsert-projections.tsx` bundle and resolve with esbuild. This is a syntax and module-resolution check, **not a typecheck**.
- `grep` confirms notistack is imported only by `_app` and the two `/db` pages, and `@apollo/client` only by `_app`, `Comments` and `lib/apollo-client.js`.

## Verification to run after applying (from `web/`)

1. `npm test -- __tests__/pages/blog.test.tsx`
2. Add a focused test, `__tests__/components/Comments.test.tsx`, asserting Comments renders inside its own provider when the URI env var is set and that `ref.refetch` calls Apollo `refetch`. Use a mocked `@apollo/client`.
3. `npx tsc --noEmit` and `npm run lint`. Both are justified because a shared entry changes.
4. One isolated compile build:

   ```bash
   PLAYWRIGHT_ISOLATED_NEXT=1 PRESERVE_NEXT_DIST=1 NEXT_TELEMETRY_DISABLED=1 NODE_OPTIONS=--max-old-space-size=6144 ./node_modules/.bin/next build --experimental-build-mode=compile --no-lint
   ```

   Then run `python3 -I ../tasks/artifacts/independent-audit-2026-10-17/data/first_load.py .next-playwright`.

   **Pass if** all of the following hold:
   - `_app` is ≤ 96 kB gz, and shared JS is ≤ 175 kB gz.
   - `/blog/[slug]` First Load JS is ≤ 314.7 kB, its current value. Apollo moves into that route, so the expected value is about 272 kB.
   - `/db` and `/db/upsert-projections` are each ≤ their current value + 5 kB (345.9 and 383.6 kB). They already load MUI directly.
   - Every other route drops by about 91 kB.
   - `grep -c 'MuiCollapse\|InMemoryCache\|go.apollo.dev'` on `static/chunks/pages/_app-*.js` returns 0.
5. In a local browser (Playwright against an isolated server, not port 3000 or 3105):
   - a blog post shows comments, and posting a comment refetches them;
   - `/db` shows a snackbar at bottom-left on a CSV error;
   - the homepage renders with no console errors.

## Rollback

Revert the commit. It involves no migration, cache invalidation or configuration.

## Approval needed

1. **TJ's go-ahead to edit these 4 files in the canonical checkout.** This audit was read-only on source, and the go-ahead also confirms no other session is about to take them.
2. **One local isolated compile build** for the acceptance metric. It is local only, with no Vercel build or deployment.
3. Nothing else: no dependency, lockfile, database, schedule or production change.

Publishing then follows the normal reconciliation into `master` under the Vercel cost rules: batched, push only with explicit authorization, and check the four Vercel projects first.

## Results after applying (2026-10-17, working tree with other sessions' uncommitted edits present)

| Check | Result |
| --- | --- |
| `git apply` | Clean on HEAD `ceceb407a`. The 4 target files had no other changes. Nothing was committed. |
| `npm test -- --run __tests__/pages/blog.test.tsx` (synthetic `.invalid` Supabase env) | **Passed**, 5/5, in 1.07 s. **Limit:** this file covers only `pages/blog` (index). No existing test renders `_app`, `blog/[slug]`, `Comments` or the `/db` pages. The focused Comments test (item 2 above) was **not added**. |
| `npx tsc --noEmit` | First attempt **aborted with a heap OOM** (exit 134 at about 4 GB after 34 s), an environment limit rather than a type error. Rerun with `NODE_OPTIONS=--max-old-space-size=8192`: **passed**, exit 0, 0 errors, 57 s, 5.8 GB RSS. The whole working tree was checked. |
| `npx eslint --report-unused-disable-directives-severity warn` on the 4 files | **Passed**, 0 errors and 0 warnings. A repo-wide `npm run lint` was not run. |
| Isolated compile build (same command as the baseline, warm cache) | **Passed**, exit 0, 44.9 s, 3.5 GB RSS. `next-env.d.ts` and `tsconfig.json` unchanged. |
| Browser checks (item 5) | **Not run.** No browser or server was started. |

### Measured against the thresholds

| Threshold | Before | After | Pass? |
| --- | ---: | ---: | --- |
| `_app` chunk ≤ 96 kB gz | 176 kB gz (588,539 raw) | **92.3 kB gz** (327,187 raw) | yes |
| Shared JS ≤ 175 kB gz | 263.2 | **179.4** (Next prints 293 → 209 kB including CSS) | **no, by 4.4 kB** |
| `/blog/[slug]` ≤ 314.7 | 314.7 | 281.2 | yes |
| `/db` ≤ 350.9; `/db/upsert-projections` ≤ 388.6 | 345.9; 383.6 | 296.9; 334.6 | yes |
| Other routes drop by about 91 kB | — | **−83.5 to −83.8 kB** on all 76 | close; below prediction |
| 0 `MuiCollapse` / `InMemoryCache` / `go.apollo.dev` in `_app` | 12 / 4 / 1 | 0 / 0 / 0 | yes |

Notes on the results:

- **Effect.** The median First Load JS went from 305 to 221 kB, and routes ≥ 400 kB went from 14 to 4. The homepage went from 461.3 to 377.7 kB.
- **Missed threshold.** The miss on shared JS is a prediction error, not a leftover dependency. The new `_app` chunk has 0 Emotion, MUI, graphql and notistack signatures (before: 23, 19, 6, 1). The esbuild approximation overstated webpack's gzip saving by about 7 kB (−91.1 predicted, −83.8 measured).
- **Data.** Per-route results are in `data/first-load-by-route-patch01.tsv` and `data/build-compile-patch01-shared.txt`.

## Focused test and browser checks (2026-10-17, about 21:35–22:05 UTC; still uncommitted)

**New test.** `web/__tests__/components/Comments.test.tsx` passes 2/2 and lints clean. It checks that:

- the query runs inside `Comments`' own Apollo provider when the GraphQL URI is set;
- the forwarded `ref.refetch` reaches Apollo's `refetch`;
- no provider is added when the URI is unset.

The first case would fail against HEAD's `Comments`.

**Server.** An isolated `next dev` ran on `127.0.0.1:3107` with `PLAYWRIGHT_ISOLATED_NEXT=1` (`.next-playwright`), plus Chromium 1223 through Playwright 1.60. The scripts are `data/browser-checks.cjs` and `data/wait-served-app.cjs`; results and screenshots are in `browser-checks/`. The server is stopped, and TJ's port 3000 server was never touched. The dev server uses `.env.development`, so the blog reads the Sanity **staging** dataset, while Supabase is production (`.env.local`).

| Check | Result |
| --- | --- |
| Homepage `/` (unmocked, one load) | **Passed.** HTTP 200, title correct, **0 page errors**. One console warning, pre-existing: `FHFHonly.png` aspect ratio. No failed or non-GET requests. Screenshot `home-1440.png`. The JSON for this run was overwritten by a later run that reused its label; these values are transcribed from that run's output. |
| Blog comments refetch (`/blog/third-post`, staging) | **Passed.** The initial synthetic comment rendered through the component-owned provider after 1 GraphQL call. Posting the form hit the **mocked** `/api/createComment` (body keys `comment`, `name`, `postId`; no Sanity write), then a 2nd GraphQL call (the forwarded `refetch`) rendered the new comment. 0 page errors. `results-patched-blog-db.json`, `blog-comments-after-refetch.png`. The production post `/blog/a-commentary-on-goalie-strategy` 404s in dev because it is not in staging; that is unrelated to the patch. |
| `/db` snackbar (synthetic local admin session, all Supabase and `/api` calls mocked) | **Passed.** Admin view rendered. "Cancel Pending" (a local-only action) showed "Cleared pending NST backfill." at x=40, y=838 in a 1280×900 viewport (bottom-left), styled as notistack info. 0 page errors. `results-patched-db.json`, `db-snackbar.png`. An earlier attempt failed because Next's dev error overlay (`nextjs-portal`) covered the button after my 503 stub of `/api/v1/season`. Stubbing a valid season fixed it (`db-click-failure.png`). |
| **`/db/upsert-projections`, signed-in non-admin** | **Regression found.** HEAD behavior was verified with the served `_app` confirmed to contain `SnackbarProvider`: "Access Denied: Admin privileges required." stays visible on `/auth` from 321 ms to about 6.5 s. Patched: it shows for about 100 ms on `/db/upsert-projections`, then **disappears on the redirect to `/auth`**, because the page-level provider unmounts. Files: `results-upsert-head.json` and `results-upsert-patched.json`. |

**Production traffic from these checks.**

- The dev server rendered the homepage server-side 4 times against production Supabase: the homepage check plus 3 probe warm-ups.
- One unmocked homepage visit made 2 browser GETs to Supabase.
- All browser-side Supabase requests in the `/db` probes were answered by the mocks: 13 on `/db`, and 24 and 38 in the two upsert probes, including `ensureUserRecords` POSTs. 0 reached Supabase, and there were no writes.

### Fix options for the regression (not applied; needs a decision)

1. **Recommended: a route-scoped provider around the page slot in `_app`.**
   - Load `SnackbarProvider` with `next/dynamic` and wrap only `<Component />` when `router.pathname` starts with `/db` or `/auth`.
   - Return both `/db` pages to their HEAD form.
   - The provider then stays mounted across the `/db/upsert-projections` → `/auth` redirect, so the toast persists as before.
   - notistack and MUI stay out of `_app`, because a dynamic chunk loads only on those routes.
   - Needs one more isolated compile build to re-measure, plus a rerun of this upsert probe.
2. **Simplest: drop the notistack half of Patch 01** and keep only the Apollo change. The saving is about −45 to −49 kB gz on every page, against −84 kB measured with both. That figure is an esbuild estimate, scaled by webpack's measured/esbuild ratio of 0.92. There is zero snackbar risk.

**Side effect, disclosed and reverted.** Running `next dev` with `PLAYWRIGHT_ISOLATED_NEXT=1` rewrote the tracked `web/next-env.d.ts` reference line to `./.next-playwright/types/routes.d.ts`; the compile-only builds did not. After the server stopped, the file was restored byte-for-byte from the pre-run copy, which is identical to HEAD, and `git diff HEAD` on it is now empty. Anyone running the Playwright dev server should expect the same rewrite.

## Fix option 1 applied: Patch 01 v2 (2026-10-17, about 21:50–22:00 UTC; uncommitted)

Current working-tree diff: [patch-01-v2-route-scoped-snackbar.diff](patch-01-v2-route-scoped-snackbar.diff). The first diff above is superseded.

- **`web/pages/_app.tsx`.**
  - Apollo is removed, as in v1.
  - `SnackbarProvider` is now loaded with `next/dynamic` and wraps **only the page slot**, when `router.pathname` matches `/db`, `/db/*` or `/auth`. Options are unchanged (`maxSnack 3`, `autoHideDuration 6000`).
  - The provider element sits at the same position for `/db/upsert-projections` and `/auth`, so it stays mounted across that redirect. Pages remount on route change anyway, and Layout and AuthProvider are untouched.
- **`web/components/Comments/Comments.tsx`** and **`web/__tests__/components/Comments.test.tsx`**: as in v1.
- **`web/pages/db/index.tsx`** and **`web/pages/db/upsert-projections.tsx`**: **back to HEAD**, with no diff.

| Check | Result |
| --- | --- |
| Vitest: `Comments.test.tsx` and `blog.test.tsx` | **Passed**, 7/7 |
| `npx tsc --noEmit` (8 GB heap) | **0 errors in touched files.** 5 errors exist elsewhere, all in another session's untracked, in-progress `lib/player-forecasts/yahooUniverse*.ts`, created 17:43–17:49 local. Not caused by this change. |
| ESLint on `_app.tsx`, `Comments.tsx`, `Comments.test.tsx` | **Passed**, 0 problems |
| Upsert probe (non-admin, isolated server 127.0.0.1:3107, mocked Supabase) | **Fixed.** The "Access Denied" toast is visible on `/auth` from 249 ms to about 6.4 s, matching HEAD's 321 ms to about 6.5 s. 0 page errors. `results-fix1.json` |
| `/db` snackbar probe | **Passed.** Bottom-left at (40, 838), 0 page errors. The two 404s are pre-existing missing images (`/pictures/fhfPlaceholder.png`, `/pictures/csvImportIcon.png`). |
| Isolated compile build | **Passed**, exit 0, 40 s, 3.8 GB RSS. `next-env.d.ts` and `tsconfig.json` unchanged by the build. The dev server's rewrite of `next-env.d.ts` was restored to HEAD again. |

| Measure (gz) | Baseline | v1 | **v2** |
| --- | ---: | ---: | ---: |
| `_app` chunk | 176 kB (588,539 raw) | 92.3 kB | **93.8 kB** (331,548 raw) |
| Shared JS (first-load per manifest) | 263.2 | 179.4 | **180.9** (Next prints 293 → 210 kB including CSS) |
| Homepage `/` | 461.3 | 377.7 | **379.2** |
| `/auth` | 265.0 | 181.2 | **182.7**, plus a 33.4 kB lazy notistack chunk at runtime |
| `/db`; `/db/upsert-projections` | 345.9; 383.6 | 296.9; 334.6 | **297.0; 334.7**, plus the same lazy chunk |
| Other routes | — | −83.5 to −83.8 | **−82.1 to −83.8** |
| Median First Load; routes ≥ 400 kB | 305; 14 | 221; 4 | **223; 4** |

- **Signatures.** `MuiCollapse`, `InMemoryCache`, `go.apollo.dev`, `SnackbarContainer` and `emotion` all appear 0 times in `_app`. notistack and MUI live in `static/chunks/84-*.js` (97 kB raw, 33.4 kB gz), which `react-loadable-manifest` lists only under `pages/_app.tsx -> notistack`.
- **Thresholds.** `_app` ≤ 96 kB, the blog and `/db` limits, and 0 signatures all pass. Shared JS ≤ 175 kB is still missed by 5.9 kB. That target came from the esbuild prediction; the v2 dynamic loader adds 1.5 kB over v1.
- **Behavior difference left.** A toast raised on `/auth` or `/db` is dropped if the user navigates to a non-snackbar route within its 6 s. Today no snackbar is raised outside `/db`, so the only path is a user leaving `/auth` within 6 s of an access-denied redirect.
- **Disclosure.** The v2 compile build overlapped another session's 16-worker Vitest run for about 40 s, which may have slowed that run. No tsc or other build was running.

**Data:**

- `data/first-load-by-route-fix1.tsv`
- `browser-checks/results-fix1.json`
- `data/browser-checks.cjs`, whose warm-up now visits `/auth` instead of `/`, so the probe makes no production homepage reads.
