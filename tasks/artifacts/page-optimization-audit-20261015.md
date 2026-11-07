# FHFH page optimization audit — October 15, 2026

Read-only audit of `/Users/tim/Code/fhfhockey.com`, branch `octoberBranch`, HEAD `a8f58de6178e282acd3a71851c66f4a56b119f14`, including the pre-existing working-tree changes. Source review began at 05:14 UTC. The updated delivery checkpoint is 06:56 UTC. This report is the only file written by this audit.

The inventory covers every current Next.js page entry. It is **not a claim that every page or interaction has passed a browser audit**. There are 78 page/resource entries, two shared framework files, and 354 API candidate files. Three API candidates are co-located tests. Next's installed page mapper produces 435 keys, including `_app`, `_document`, and the generated `_error`; excluding those framework keys leaves 432 page/API candidates. The complete matrices below distinguish full static review, sampling, and unreviewed implementation. No App Router tree or middleware entry was found.

Twelve remaining findings are recorded below. Three additional cloud-review findings have a separate implementation owner and are listed as assigned, not as new work for this auditor. Accepted RSO, Game Grid, and other visual work has not been redesigned or reopened. RSO/Game Grid implementation and any real-account acceptance remain with their existing owners.

## Prioritized remaining findings

Severity describes user impact; performance entries are opportunities supported by dependency structure, not measured production latency or billed usage.

| ID | Priority | Finding | Primary source |
| --- | --- | --- | --- |
| A01 | HIGH | A correctable password error removes the reset form | [reset-password.tsx:288](../web/pages/auth/reset-password.tsx#L288) |
| A02 | HIGH | Sorting and image download have pointer-only controls | [projections/index.tsx:374](../web/pages/projections/index.tsx#L374) |
| A03 | HIGH | Global focus suppression leaves the news search without a replacement indicator | [globals.css:28](../web/styles/globals.css#L28) |
| A04 | HIGH | Some failed reads remain in loading states with no retry | [game/[gameId].tsx:38](../web/pages/game/[gameId].tsx#L38) |
| A05 | HIGH | Team-explorer error text has approximately 2.01:1 contrast on its panel | [teamStats/index.tsx:617](../web/pages/underlying-stats/teamStats/index.tsx#L617) |
| A06 | HIGH | Shared spinner ignores reduced motion and has no accessible loading text | [Spinner.module.scss:14](../web/components/Spinner/Spinner.module.scss#L14) |
| P01 | MEDIUM | Homepage SSR serializes independent reads and repeats a weekly schedule search | [index.tsx:503](../web/pages/index.tsx#L503) |
| P02 | MEDIUM | Lines landing-page regeneration repeats season lookup and full team-detail hydration | [lines/index.tsx:70](../web/pages/lines/index.tsx#L70) |
| P03 | MEDIUM | Player stats SSR serializes four independent advanced-stat queries | [stats/player/[playerId].tsx:1006](../web/pages/stats/player/[playerId].tsx#L1006) |
| P04 | MEDIUM | Every page declares nine font stylesheets/imports with duplicate families | [_document.tsx:16](../web/pages/_document.tsx#L16) |
| P05 | MEDIUM | Comment-only Apollo code is eagerly reachable from the shared app entry | [_app.tsx:7](../web/pages/_app.tsx#L7) |
| R01 | MEDIUM | Three test files are eligible Next.js API entries | [forecast-calendar.test.ts:1](../web/pages/api/internal/forecast-calendar.test.ts#L1) |

### A01 — Keep the reset form available after correctable errors

`handleSubmit` sets `pageState` to `error` for a password shorter than eight characters, a mismatch, and an update failure (lines 288–307). The form only exists when `pageState === "ready"` (line 353). A typo consequently removes both inputs and the update button. The remaining links navigate to Auth or Home rather than allowing a correction.

**Verified:** an isolated fixture transpiled the actual page, supplied an already-recovered session state, and submitted a short password. Password inputs changed from **2 to 0**, the message became “Use a password with at least 8 characters,” and **0 update/retry buttons** remained. Auth effects were disabled in this fixture; it did not test a real reset email or session. The existing seven reset-page tests passed, so this is a coverage gap rather than an existing failing test.

**Smallest correction:** separate the recovery-session phase from validation/submission errors. Preserve editable inputs and values for a correctable error; associate the message with the affected field. Verify short password, mismatch, rejected update, and a successful retry using mocked auth.

### A02 — Make every actionable table header/logo keyboard operable

[Projection sorting](../web/pages/projections/index.tsx#L374) attaches `onClick` directly to a `th`, without a button, focusability, or a keyboard handler. [The team-lines logo](../web/pages/lines/[abbreviation].tsx#L429) attaches download behavior to a `div`; its callback is `downloadImage` at line 180. The retained [stats placeholder](../web/pages/statsPlaceholder.tsx#L132) similarly uses clickable `div` scroll arrows and a clickable sorting header at line 228.

**Verified:** source/AST inspection identifies the handlers on non-native controls and the absence of equivalent keyboard handlers in those elements. This is not a claim that a browser keyboard pass was executed.

**Smallest correction:** put a named native button inside sortable headers, expose `aria-sort` on the header, and use a labeled download button for the logo action. Retain the accepted appearance. Acceptance is Tab access plus Enter/Space behavior equivalent to a pointer click, with visible focus and correct sort announcements.

### A03 — Restore input focus indicators at the shared rule

[Global CSS](../web/styles/globals.css#L28) removes the outline from every focused input/textarea. The [news search](../web/pages/news/index.tsx#L78) uses [control styles](../web/pages/news/index.module.scss#L68) that set a fixed border/background and provide no focus override. The numeric/text inputs in [Trends Testing Grounds](../web/pages/trendsTestingGrounds.tsx#L109) also lack a replacement. Other pages, including Blog, do supply focus styling, so this finding does **not** assert that every input is affected.

**Verified:** applicable source declarations and the complete news stylesheet were inspected. An isolated browser focus fixture was attempted, but Chromium failed before launch; the actual focused pixels/computed style were not observed.

**Smallest correction:** remove the blanket outline suppression or provide a shared visible focus treatment, preserving stronger existing page overrides. Verify Tab focus on News, the diagnostic inputs, and a representative existing custom-focus form.

### A04 — Distinguish failed reads from pending reads

[Game detail](../web/pages/game/[gameId].tsx#L38) logs boxscore/landing failures but has no terminal error state or retry. In the specific case where landing succeeds with `FUT`/`PRE` while boxscore fails, [line 665](../web/pages/game/[gameId].tsx#L665) continues to display “Loading game details...” after requests have settled. Final-game views have the same null-boxscore branch at line 830. If landing itself fails, the fallback instead says details are unavailable; it still lacks recovery. These cases must not be conflated.

The legacy [team directory](../web/pages/teamStats.tsx#L73) also renders “Loading...” whenever the team array is empty. [useTeams](../web/hooks/useTeams.ts#L11) converts a rejected request into that same empty array.

**Verified:** the actual game page was rendered with a mocked successful `FUT` landing and rejected boxscore. Both mocked reads settled; the DOM still contained **“Loading game details...”** and **0 retry buttons**. No NHL request was made. The team-directory case is source-confirmed, not separately executed.

**Smallest correction:** represent pending, empty, and failed states independently; offer a bounded retry. Guard/abort stale requests when `gameId` changes. Acceptance should cover partial failure, complete failure, empty success, retry, and switching IDs while a prior request is pending.

### A05 — Use readable message colors in the team explorer

The team explorer renders validation errors and fetch failures as inline `#8a1c1c` at [lines 617 and 625](../web/pages/underlying-stats/teamStats/index.tsx#L617), and its row-count summary as `#555` at line 635. The [landing shell](../web/components/underlying-stats/UnderlyingStatsLandingShell.tsx#L88) places those children in the shared dark section; [the section style](../web/pages/underlying-stats/playerStats/playerStats.module.scss#L141) uses the soft panel mixin.

**Measured locally from compiled Sass:** the section background resolves to approximately `rgb(17.01, 18.97, 21.59)`. Standard sRGB relative-luminance calculation gives **2.01:1** for the error text and **2.50:1** for the summary, below the 4.5:1 normal-text target. Against the page background the ratios are 1.82:1 and 2.27:1. These are stylesheet calculations, not browser pixel sampling or a full accessibility conformance result.

**Smallest correction:** use a readable existing semantic message/text color rather than the two hardcoded dark colors. Preserve the panel layout. Verify error, invalid-filter, and loaded-result states against the computed background and at zoom. This is new evidence for an error-state defect, not a request to revisit accepted visual composition.

### A06 — Give the shared spinner a reduced-motion and text alternative

[Spinner.module.scss](../web/components/Spinner/Spinner.module.scss#L14) rotates continuously with no reduced-motion override. [Spinner.tsx](../web/components/Spinner/Spinner.tsx#L19) renders two unnamed `div`s without status text. [Comments](../web/components/Comments/Comments.tsx#L64) uses this spinner as its sole loading indication. The global reduced-motion rule inspected in Home only targets the homepage pulse; it does not cover this component.

**Verified:** the component and complete local stylesheet were inspected. No live motion or screen-reader test was run.

**Smallest correction:** disable rotation under `prefers-reduced-motion: reduce` and expose a stable textual loading status. Avoid duplicate announcements where callers already provide one. Verify both media preferences and the accessible loading text in Comments without changing the accepted visual design.

### P01 — Shorten the homepage server dependency chain

The homepage already sets `s-maxage=60, stale-while-revalidate=120` at [line 323](../web/pages/index.tsx#L323). Cache misses/revalidation still execute serial work: offseason then season reads (503–504), opening-night lookup/schedule before today's schedule (515–550), game enrichment (609), injuries (616), standings (617), published news (624), injury news (647), exact player count (658), and pulse (668). Several of the latter reads do not depend on the preceding results.

The initial schedule response already carries `weeklyGames` ([line 351](../web/pages/index.tsx#L351)). If today has no games, the loop at [line 567](../web/pages/index.tsx#L567) can perform **up to seven additional sequential day lookups**, rather than first searching that returned week. The source bound is eight schedule reads for that search path, plus a separate opening-night read when applicable; this was not observed against production.

**Smallest correction:** search the existing week first, then retain a bounded fallback only when required. Start independent reads together with separate failure handling, preserving current cache and fallback behavior. Verify with delayed fixture readers: identical props/fallbacks, known call counts, and an elapsed time near the longest independent task rather than their sum. No production time or monetary savings are asserted.

### P02 — Avoid full lineup hydration for a promotions/demotions landing page

[Lines getStaticProps](../web/pages/lines/index.tsx#L70) calls `getLineCombinations(team.id)` for every team. [That helper](../web/components/LineCombinations/utilities.ts#L87) resolves the same current season separately for each call, and [getCurrentSeason](../web/lib/NHL/server/index.ts#L253) performs a season read. It then fetches line combinations, roster/player stats, TOI, goalie data and outcomes even though this landing page consumes the promotion/demotion lists. The page is eligible for regeneration after 60 seconds; this is **not** a claim that it runs automatically every minute.

**Verified:** static call graph. For `N` teams there are `N` normal-path season-lookup calls before any team-specific work. Actual invocation counts, query costs, cache hits, and team count were not queried remotely.

**Smallest correction:** resolve and pass the season once, then use a narrow batched promotion/demotion read for this landing page. Preserve the full detail loader for the team route. Verify equivalent movement rows and fixture call counts. This data-fetch work is separate from the assigned freshness-copy change; coordinate before modifying the same page file.

### P03 — Parallelize the independent player-detail reads

For a regular-season skater, [stats/player getServerSideProps](../web/pages/stats/player/[playerId].tsx#L989) reads the game log, then four advanced-stat tables in sequence at lines **1006, 1024, 1044, and 1059**. Each query selects `*`, uses the same player/season keys, and does not depend on the prior query result. The page has no explicit Cache-Control header in the inspected source.

**Verified:** four independent database read stages in the source; no database calls were executed. This finding concerns the player-detail page, not the separately assigned `/stats` filter implementation.

**Smallest correction:** execute bounded independent reads concurrently with per-query fallback behavior, and select only columns used by the joining/rendering code. Verify joined rows and partial failures with fixtures. Treat cache-policy changes separately because freshness requirements need to be preserved; do not alter ingestion or NST job spacing.

### P04 — Consolidate global font declarations

[Document](../web/pages/_document.tsx#L16) contains **four** Google Fonts stylesheet links. [globals.css](../web/styles/globals.css#L1) contains **five** additional `@import`s. Martian Mono appears twice; Roboto Condensed appears twice; Roboto is split across three declarations. Tourney and Tomorrow request broad style/weight sets. CSS imports also defer discovery until that stylesheet is parsed.

**Verified:** nine source declarations across the shared entry files. Browser deduplication/cache behavior, downloaded font bytes, LCP, and layout shift were not measured; nine declarations must not be reported as nine unique network transfers.

**Smallest correction:** preserve the accepted typefaces and typography, consolidate duplicate requests, and load only the families/weights needed globally or on their actual routes. Validate the existing font appearance and font-loading behavior in a local browser when available. This is delivery optimization, not a visual redesign.

### P05 — Scope the comment client to the feature that uses it

[_app](../web/pages/_app.tsx#L7) eagerly imports both ApolloProvider and [the Apollo client](../web/lib/apollo-client.js#L1); the latter constructs an in-memory cache at module evaluation. The configuration check at app line 25 only controls the rendered wrapper, not the source imports. A bounded search of pages/components/hooks/contexts/lib found **one feature consumer**, [Comments](../web/components/Comments/Comments.tsx#L1), aside from the shared provider/client setup.

**Verified:** static import reachability and consumer count. The existing `.next` artifacts are partial dev artifacts, so no production chunk size or byte saving is claimed.

**Smallest correction:** move/lazily load the provider and client with the article-comments subtree, preserving refetch-after-comment behavior. Compare route chunks/network only in an authorized suitable local measurement; do not deploy or run a costly build solely to guess the saving.

### R01 — Keep test modules out of the Pages Router

The following files reside beneath `pages/api` and match the installed default `pageExtensions` (`tsx`, `ts`, `jsx`, `js`):

- [api/internal/forecast-calendar.test.ts](../web/pages/api/internal/forecast-calendar.test.ts)
- [api/underlying-stats/landing.test.ts](../web/pages/api/underlying-stats/landing.test.ts)
- [api/v1/account/fantrax/player-data.test.ts](../web/pages/api/v1/account/fantrax/player-data.test.ts)

They import Vitest and do not export API handlers. `next.config.js` does not narrow page extensions. **Verified without a build:** the installed Next 15.5.22 `collectPagesFiles`/`createValidFileMatcher` collect all 434 source files, and `createPagesMapping` maps all three to `/api/...test`. Build failure, request behavior, and deployment exposure were not executed or claimed.

**Smallest correction:** relocate the tests into the established `__tests__/pages/api` tree and adjust imports. Verify those tests still run and that page mapping excludes all three. No application behavior or global routing configuration needs to change.

## Assigned cloud findings — preserve ownership

| ID | Severity and status | Local corroboration | Validation boundary |
| --- | --- | --- | --- |
| C01 | HIGH functional filter defect; heading clarity also assigned | Baseline `/stats` used `selectedFilter` only for radio state/announcements and passed the original arrays to all eight leaderboards. A fixture selected Goalie, observed the checked radio and announcement, and found all eight datasets unchanged. Baseline heading was “Underlying Stats Hub,” despite a separate `/underlying-stats` destination. | Dedicated writer owns filtering and heading. This report does not claim their later patch is verified. A position-aware top-five result must be derived from the appropriate candidate set, not just from filtering an already truncated global top five. |
| C02 | MEDIUM freshness-copy defect; assigned | Baseline [lines/index.tsx:169](../web/pages/lines/index.tsx#L169) stamps `new Date().toISOString()` during page generation; line 213 labels it “Updated.” ProjectedLineups separately renders actual report publication times. | Dedicated writer owns the copy. No real source was shown to be stale; the defect is the ambiguity between page generation and source freshness. |
| C03 | LOW readability recommendation; assigned | Baseline [UnderlyingStatsDashboard.module.scss:673](../web/components/underlying-stats/UnderlyingStatsDashboard.module.scss#L673) and line 711 set leader labels to `0.62rem` (9.92px only if the root is 16px). | Dedicated writer owns label legibility. This is not a functional defect or a font-size-only accessibility conformance failure. Current viewport pixels were not measured. |

These three are not additional edit requests from this audit. Later implementation may change their cited line numbers and baseline behavior.

## Verification performed and limits

### Passed local checks

- **Inventory:** all matching files under `web/pages` enumerated; all 80 non-API source files parsed for imports, data entry points, JSX controls and rendering markers. Installed Next route mapping confirms the three test-entry candidates. It was not a build.
- **47 tests in 7 files passed** in one focused run, Node **22.11.0**, Vitest **3.2.7**, duration **7.35 seconds**. The environment used synthetic `.invalid` Supabase configuration; the selected tests mock their dependencies. Only the existing punycode deprecation warnings appeared.
- **Reset fixture:** 2 password inputs before invalid submit, 0 after, with the short-password message and no update/retry button. Real page handlers; mocked recovered phase; no auth call.
- **Stats fixture:** checked Goalie radio and live announcement; eight unchanged leaderboard inputs. Child renderers were display stubs and effects disabled. This baseline issue is now assigned elsewhere.
- **Game fixture:** successful FUT landing plus rejected boxscore; both synthetic requests settled; loading text remained and no retry control appeared. All fetches were mocked.
- **Contrast calculation:** compiled the actual team-explorer Sass in memory; calculated error/summary contrast of 2.01:1/2.50:1 on the section background. No generated CSS was saved.

Exact focused test command, run from `web/`:

```sh
NEXT_PUBLIC_SUPABASE_URL=https://unit-tests.supabase.invalid NEXT_PUBLIC_SUPABASE_PUBLIC_KEY=synthetic-public-key SUPABASE_SERVICE_ROLE_KEY=synthetic-service-role-key npm test -- --run __tests__/pages/blog.test.tsx __tests__/pages/stats/index.test.tsx __tests__/index.test.tsx __tests__/components/Layout/Header.test.tsx __tests__/pages/auth/index.test.tsx __tests__/pages/auth/reset-password.test.tsx __tests__/pages/underlying-stats/playerStats/index.test.tsx --maxWorkers=1 --no-file-parallelism --no-cache
```

| Existing test file | Passed |
| --- | ---: |
| `__tests__/pages/underlying-stats/playerStats/index.test.tsx` | 14 |
| `__tests__/components/Layout/Header.test.tsx` | 14 |
| `__tests__/pages/auth/reset-password.test.tsx` | 7 |
| `__tests__/pages/blog.test.tsx` | 5 |
| `__tests__/index.test.tsx` | 4 |
| `__tests__/pages/stats/index.test.tsx` | 2 |
| `__tests__/pages/auth/index.test.tsx` | 1 |

### Blocked / not run

The isolated Playwright Chromium attempt failed at `chromium.launch` with **“Target page, context or browser has been closed.”** It never reached the page. No fresh browser, viewport, focus-style, screen-reader, real-account, or full-route interaction pass is claimed. The fixture had external requests disabled and did not start a development server. No escalation or automatic-approval rejection occurred.

No lint/typecheck, full suite, local production build, deployment, database operation, owner browser session, or production application request was run. Documentation-only output and concurrent workers make a broad typecheck/build unnecessary here. The partial `.next` dev manifests are not valid evidence of production bundle sizes. LCP/INP/CLS, request bytes, memory, actual server durations, and monetary savings remain **unmeasured**.

The cloud reviewer had already used the five-public-page budget. This audit added **zero** live application requests and **zero** builds/deployments. All failure fixtures used synthetic state; no real FORGE outcome values are reported or assessed.

### Existing visual evidence inspected, with age limits

- [Start Chart, 320px fixture screenshot from October 2](ui-acceptance-20261002/browser-results/start-chart--start-chart-c-28d01-e-board-workflow-at-320x568-chromium/final-page.png): historical mobile composition/state evidence only; not a current viewport pass. No model-value claims are taken from the fixture.
- [RSO, 390px pending-provider fixture from October 14](../tasks/artifacts/rso-mockup-match-2026-10-14/final-shell/fixture-pending-provider-390x844.png): inspected to preserve the accepted mobile composition and explicit pending/unverified messaging. Synthetic provider data; not owner-account acceptance.
- [October 2 Playwright report](ui-acceptance-20261002/playwright-report.json): 11 expected, 1 unexpected, 0 skipped/flaky. The unexpected result was the Shift Chart square-cell geometry assertion. This older run is **not** represented as a current failure or a reason to reopen accepted work; the current implementation was not exercised.
- [RSO acceptance document](../tasks/artifacts/rso-release-readiness-2026-10-15/ACCEPTANCE.md) and [receipt](../tasks/artifacts/rso-release-readiness-2026-10-15/receipt.json): existing local acceptance is acknowledged; its real-account boundary is retained. This auditor did not repeat or extend that acceptance.

## Review dimensions

The review used the repository instructions, `mise-en-place.md`, `SPRINT-MODE.md`, better-interface and its accessibility/layout/writing/typography/colors/UI owners, plus React performance guidance and the Supabase read-only safety guidance. No workers were spawned by this audit.

| Dimension | Evidence and outcome | Remaining boundary |
| --- | --- | --- |
| Performance, requests, rendering | Shared imports, SSR/ISR/client boundaries, repeated reads, cache declarations, request gating and cancellation sampled. P01–P05 identify concrete dependency/request opportunities. | Production bundles and timings unmeasured; backend execution plans not audited. |
| Loading, errors, recovery | Existing tests and three isolated page fixtures; A01/A04 expose actual state-transition defects. Modern player explorer has tested first-100 pagination/load-more and cache behavior, so it is not characterized as an unbounded initial table. | Every async/auth state on every route was not executed. |
| Accessibility | Native controls, labels, focus rules, status messages, reduced motion and source color pairs checked. Header's existing keyboard/menu tests passed. A01–A06 are evidence-backed. | No comprehensive keyboard/screen-reader audit or current computed-focus measurement. |
| Responsiveness and layout | Breakpoint/overflow/container patterns sampled; two existing mobile screenshots inspected. Accepted visual work retained. | No current 320/390/768/1440 viewport sweep or zoom measurement. No new layout redesign is proposed from source alone. |
| Navigation and hierarchy | Route destinations, recovery paths, legacy replacement notices, heading roles and context-preserving redirects sampled. C01 identifies the assigned heading ambiguity. | Deep component navigation for sampled routes remains partial. CMS destination is external and unreviewed. |
| Typography and writing | Global font delivery, page names, recovery copy, freshness labels and micro-label sizes checked. C02/C03 are assigned and clearly separated from functional findings. | Small-label rendered size/wrapping and line-length behavior require a browser. Legal/policy text was not audited for legal accuracy. |
| Color and UI behavior | Team error-state contrast calculated; pointer action semantics, control feedback, and spinner behavior inspected. | Brand palette is not being redesigned; other color combinations are not certified. |

## Coverage definitions

- **F — fully reviewed static entry:** every line of that small page/resource entry and its applicable navigation/data flow was inspected. Shared shell findings still apply. This is not full browser verification or an audit of every transitive dependency.
- **S — sampled:** entry structure plus important fetch/render/state/control branches inspected; some long sections or imported feature internals remain unreviewed. Specific scope is stated per row.
- **U — unreviewed implementation:** inventoried only. API rows are included for complete routing coverage, not represented as a backend/security audit.
- **T** means the listed focused existing test(s) ran; **fixture** means the bounded synthetic check described above; **H** means historical screenshot/receipt evidence only. All routes share the fresh-browser limitation.

There is **no route claimed fully verified end to end**. The matrices below are exhaustive for the recorded snapshot, while the review-depth labels expose the remaining work.

## Complete page/resource coverage matrix

**78 entries: 8 F, 70 S, 0 U.** These are static-review depths; none is an end-to-end pass. Source paths are relative to the repository.

| Route | Source | Rendering/data boundary | Depth | Specific evidence and unreviewed scope |
| --- | --- | --- | --- | --- |
| `/404` | [web/pages/404.tsx](../web/pages/404.tsx) | Static recovery page | F | Full entry, recovery links, named search-dialog trigger; dialog/shared navigation supported by Header tests. |
| `/FORGE` | [web/pages/FORGE.tsx](../web/pages/FORGE.tsx) | Client cached reads | S | Sampled cached fetches, allSettled handling, bounded previews and freshness states. Feature internals/model outcomes unreviewed. |
| `/account` | [web/pages/account/index.tsx](../web/pages/account/index.tsx) | Client auth shell | S | ClientOnly loading status and sign-in boundary inspected. AccountSettingsPage internals and real-account workflows unreviewed. |
| `/auth/callback` | [web/pages/auth/callback.tsx](../web/pages/auth/callback.tsx) | SSR shell; client callback | S | Sampled callback parsing, processing/failure UI and continuation navigation. No real OAuth/recovery exchange. |
| `/auth` | [web/pages/auth/index.tsx](../web/pages/auth/index.tsx) | Client auth form | S | T: 1 test. Tabs, client fallback, visible authentication state sampled; provider accounts unreviewed. |
| `/auth/reset-password` | [web/pages/auth/reset-password.tsx](../web/pages/auth/reset-password.tsx) | SSR shell; client recovery | S | T: 7 tests; invalid-submit fixture confirms A01. Recovery lifecycle sampled; real email/session flow unreviewed. |
| `/blog/[slug]` | [web/pages/blog/[slug].tsx](../web/pages/blog/[slug].tsx) | SSG/ISR 10s; fallback | S | Entry, article/related-content reads, fallback and comments dependency inspected. ArticleReader/comments internals sampled; P05/A06. |
| `/blog` | [web/pages/blog/index.tsx](../web/pages/blog/index.tsx) | SSG/ISR 300s | S | T: 5 tests. Archive queries, search/topic controls, empty state and image usage sampled; current viewport unverified. |
| `/blog/substack/[slug]` | [web/pages/blog/substack/[slug].tsx](../web/pages/blog/substack/[slug].tsx) | SSG/ISR 300s; blocking fallback | S | Complete wrapper inspected, including server-prepared article and not-found behavior. ArticleReader and sanitation helper sampled, not security-certified. |
| `/buyLowSellHigh` | [web/pages/buyLowSellHigh.js](../web/pages/buyLowSellHigh.js) | Client legacy query | S | Legacy replacement notice, season-total query, ranking/table and error handling sampled. Imported helpers and full result states unreviewed. |
| `/charts` | [web/pages/charts.tsx](../web/pages/charts.tsx) | Client charts | S | Chart selection, ClientOnly boundary and export/share handlers sampled. Canvas rendering, images and browser export unverified. |
| `/community-draft-rankings` | [web/pages/community-draft-rankings.tsx](../web/pages/community-draft-rankings.tsx) | ClientOnly feature shell | S | Complete route shell inspected. Imported community-ranking feature internals and live user interactions unreviewed. |
| `/cssTestingGrounds` | [web/pages/cssTestingGrounds.tsx](../web/pages/cssTestingGrounds.tsx) | Static UI showcase | S | Review queue and representative controls/modal examples sampled. Demonstration UI is not treated as functional production controls. |
| `/db` | [web/pages/db/index.tsx](../web/pages/db/index.tsx) | Client admin workspace | S | Access boundary and representative action/loading branches sampled. Administrative writes and most individual operations unreviewed/unexecuted. |
| `/db/player-aliases` | [web/pages/db/player-aliases.tsx](../web/pages/db/player-aliases.tsx) | Client admin reads/actions | S | Source request/auth, list and review branches sampled; concurrent owner edits preserved. No alias action executed. |
| `/db/player-forecast-review` | [web/pages/db/player-forecast-review.tsx](../web/pages/db/player-forecast-review.tsx) | Client admin conflict review | S | Complete entry read; authenticated request and busy/error controls inspected. Server authorization and resolution mutations unreviewed/unexecuted. |
| `/db/player-forecast-season-editor` | [web/pages/db/player-forecast-season-editor.tsx](../web/pages/db/player-forecast-season-editor.tsx) | Client admin editor | S | Season-editor request/state/control branches sampled. Publish/rerun/rollback operations unexecuted; full editor interactions unreviewed. |
| `/db/tweet-pattern-review` | [web/pages/db/tweet-pattern-review.tsx](../web/pages/db/tweet-pattern-review.tsx) | Client admin review workspace | S | Access/request boundaries and key table/edit feedback sampled. Large editor internals and source-changing actions unreviewed/unexecuted. |
| `/db/upsert-projections` | [web/pages/db/upsert-projections.tsx](../web/pages/db/upsert-projections.tsx) | Client admin import workspace | S | Auth boundary and representative form/preview states sampled. Parsing/import edge cases and writes unreviewed/unexecuted. |
| `/draft-dashboard` | [web/pages/draft-dashboard.tsx](../web/pages/draft-dashboard.tsx) | SSR flags; client dashboard | S | Complete route entry/feature flags inspected; imported DraftDashboard internals and paid/connected-account workflows unreviewed. |
| `/draft-pro/policies` | [web/pages/draft-pro/policies.tsx](../web/pages/draft-pro/policies.tsx) | Static information | F | Full entry, headings, section anchors, account/support links and noindex inspected. Legal, pricing and policy accuracy outside this audit. |
| `/draft-rankings` | [web/pages/draft-rankings/index.tsx](../web/pages/draft-rankings/index.tsx) | ClientOnly feature shell | S | Complete shell inspected. Ranking workspace internals, persistence and authenticated states unreviewed. |
| `/drm` | [web/pages/drm.tsx](../web/pages/drm.tsx) | Client date-range matrix | S | Date/team/filter controls, request effects and matrix entry sampled. Labels present on inspected controls; deep matrix responsiveness unverified. |
| `/fantasy-projections` | [web/pages/fantasy-projections.tsx](../web/pages/fantasy-projections.tsx) | Client release/detail reads | S | Release-dependent requests, parallel player/team loading, filters and detail panel sampled. Full dialog keyboard handling/model outcomes unreviewed. |
| `/forge/command-center` | [web/pages/forge/command-center.tsx](../web/pages/forge/command-center.tsx) | Client multi-module reads | S | URL scope parsing, stale-result guard, loading/error state and destination links sampled. Module internals/model outcomes unreviewed. |
| `/forge/dashboard` | [web/pages/forge/dashboard.tsx](../web/pages/forge/dashboard.tsx) | SSR redirect | F | Full redirect inspected; allowlisted date/resolvedDate/team/position/slate/mode carried to command center. |
| `/forge/player/[playerId]` | [web/pages/forge/player/[playerId].tsx](../web/pages/forge/player/[playerId].tsx) | SSR ID shell; client cached reads | S | ID guard, cached context fetches, related schedule and terminal state branches sampled. Deep insight modules/model outcomes unreviewed. |
| `/forge/team/[teamId]` | [web/pages/forge/team/[teamId].tsx](../web/pages/forge/team/[teamId].tsx) | SSR ID shell; client cached reads | S | ID guard, allSettled reads and context/error branches sampled. Deep team modules/model outcomes unreviewed. |
| `/game-grid/[mode]` | [web/pages/game-grid/[mode].tsx](../web/pages/game-grid/[mode].tsx) | SSR mode validation; feature shell | S | Complete page entry, 7/10-day mode validation and initial props inspected. GameGrid internals are concurrent-worker scope; no new visual judgment. |
| `/game-grid/dateRange` | [web/pages/game-grid/dateRange.tsx](../web/pages/game-grid/dateRange.tsx) | Client query-driven shell | S | Complete entry and missing-range recovery link inspected. DateRangeGrid internals and current rendering unreviewed. |
| `/game-grid` | [web/pages/game-grid/index.tsx](../web/pages/game-grid/index.tsx) | SSR redirect | F | Full entry; temporary redirect to /game-grid/7-Day-Forecast agrees with next.config rule. |
| `/game/[gameId]` | [web/pages/game/[gameId].tsx](../web/pages/game/[gameId].tsx) | SSR shell; client game reads | S | Game states, fetches, stats/chart dependencies and error branches sampled. Partial-failure fixture confirms A04; visual graphs unreviewed. |
| `/goalies` | [web/pages/goalies.js](../web/pages/goalies.js) | SSR legacy redirect | S | Redirect to /variance/goalies inspected; shared goalie component source sampled under destination. Full chart/table interaction unreviewed. |
| `/` | [web/pages/index.tsx](../web/pages/index.tsx) | SSR; s-maxage 60s | S | T: 4 tests. Server dependency chain and content/fallback branches reviewed; P01. Full imported homepage component/viewport coverage remains partial. |
| `/lines/[abbreviation]` | [web/pages/lines/[abbreviation].tsx](../web/pages/lines/[abbreviation].tsx) | SSG/ISR team detail | S | Team/fallback routing, projected versus observed sections, share/download and data sourcing sampled; A02. Current pixels unverified. |
| `/lines` | [web/pages/lines/index.tsx](../web/pages/lines/index.tsx) | SSG/ISR 60s | S | Team/movement generation and hierarchy sampled; P02. Freshness copy C02 belongs to dedicated writer. |
| `/lines/line-combo/[gameId]` | [web/pages/lines/line-combo/[gameId].tsx](../web/pages/lines/line-combo/[gameId].tsx) | SSR shell; client game ID | S | Complete entry, invalid-ID return and ProjectedLineups/matrix composition inspected. Imported views/live game data unreviewed. |
| `/news` | [web/pages/news/index.tsx](../web/pages/news/index.tsx) | SSR; client filtering | S | Complete entry/stylesheet read; 150-item fetch bound, labeled search/team/category filters and empty state inspected. A03; browser focus blocked. |
| `/nhl-predictions` | [web/pages/nhl-predictions.tsx](../web/pages/nhl-predictions.tsx) | Client prediction/accountability reads | S | Request/loading/error and filter/card branches sampled. Prediction accuracy/raw outcomes and complete panel interactions unreviewed. |
| `/player-forecasts` | [web/pages/player-forecasts.tsx](../web/pages/player-forecasts.tsx) | Client authenticated dashboard | S | Authenticated fetch, effect cancellation flag, filters and state feedback sampled. Private data and forecast outputs unreviewed. |
| `/podfeed` | [web/pages/podfeed.tsx](../web/pages/podfeed.tsx) | SSG/ISR 3600s | S | Parallel feed reads, fallback revalidation, audio preload=none and lazy thumbnails inspected. External media/playback/rendering unverified. |
| `/privacy` | [web/pages/privacy.tsx](../web/pages/privacy.tsx) | Static draft information | F | Full entry, draft/incomplete disclosure, noindex, headings and internal policy links inspected. Legal completeness explicitly not certified. |
| `/projections` | [web/pages/projections/index.tsx](../web/pages/projections/index.tsx) | Client data/analysis workspace | S | Source selection, sorting, table/empty state and analysis branches sampled; A02. Deep charts and all selection combinations unreviewed. |
| `/rankings` | [web/pages/rankings.tsx](../web/pages/rankings.tsx) | Client; conditional SWR | S | Entity/tab request gating, query filters, bounded comparison IDs and status/snapshot hierarchy sampled. Imported tables/most tab interactions unreviewed. |
| `/roster-schedule-optimizer` | [web/pages/roster-schedule-optimizer.tsx](../web/pages/roster-schedule-optimizer.tsx) | ClientOnly feature shell | S | Complete shell plus H: accepted 390px fixture and acceptance receipt. Existing implementation owner retained; real-account acceptance unreviewed. |
| `/server-sitemap.xml` | [web/pages/server-sitemap.xml.ts](../web/pages/server-sitemap.xml.ts) | SSR XML; s-maxage 300s | F | Full resource entry; parallel paginated player/slugs reads, publication filtering and response cache inspected. No DB/content request executed. |
| `/shiftChart` | [web/pages/shiftChart.tsx](../web/pages/shiftChart.tsx) | Client schedule/replay | S | Entry, loading/error/retry/date and no-completed-game branches reviewed; replay/matrix internals sampled. Old geometry evidence not treated as current defect. |
| `/skoCharts` | [web/pages/skoCharts.tsx](../web/pages/skoCharts.tsx) | Static quarantined legacy notice | F | Full entry and navigation inspected; explicitly quarantined, with no active model reads. No legacy model output reviewed. |
| `/social-share/[format]` | [web/pages/social-share/[format].tsx](../web/pages/social-share/[format].tsx) | SSR validation; share shell | S | Complete entry, format validation, noindex and date props inspected. SocialShare internals and rendered exports unreviewed. |
| `/splits` | [web/pages/splits/index.tsx](../web/pages/splits/index.tsx) | Client SWR | S | Always-on landing versus conditional roster read, team/opponent controls and loading/error branches sampled. Detailed split panels unreviewed. |
| `/start-chart` | [web/pages/start-chart.tsx](../web/pages/start-chart.tsx) | Client SWR; 30s refresh | S | Request options, bounded rows/load-more, retry/coverage branches sampled; H: historical 320px fixture. Concurrent worker changes and model outputs not re-audited. |
| `/stats/game/[gameId]` | [web/pages/stats/game/[gameId].tsx](../web/pages/stats/game/[gameId].tsx) | SSR shell; SWR game reads | S | Response errors checked; right-rail/boxscore then date-dependent schedule request, empty/loading and matchup hierarchy sampled. Full live/final-state coverage unreviewed. |
| `/stats` | [web/pages/stats/index.tsx](../web/pages/stats/index.tsx) | SSR leaderboards | S | T: 2 tests; eight-panel filter fixture. C01 assigned elsewhere; baseline source and hierarchy sampled. Do not treat later owner patch as verified here. |
| `/stats/player/[playerId]` | [web/pages/stats/player/[playerId].tsx](../web/pages/stats/player/[playerId].tsx) | SSR player/season data | S | ID validation, fallback game logs, advanced-stat queries and chart sections sampled; P03. Full chart/season/goalie interaction unreviewed. |
| `/stats/team/[teamAbbreviation]` | [web/pages/stats/team/[teamAbbreviation].tsx](../web/pages/stats/team/[teamAbbreviation].tsx) | SSR team; client panel reads | S | Team alias/ID handling, summary/fallback and client shot-data branches sampled. Deep team panels/viewport behavior unreviewed. |
| `/statsPlaceholder` | [web/pages/statsPlaceholder.tsx](../web/pages/statsPlaceholder.tsx) | SSG/ISR legacy catalogue | S | Legacy replacement notice, source lookups, team logo scrolling and sortable table sampled; A02. Full historical data/rendering unreviewed. |
| `/teamStats` | [web/pages/teamStats.tsx](../web/pages/teamStats.tsx) | Client legacy directory | S | Complete page/useTeams flow inspected; source failure maps to perpetual loading (A04). Logo grid/current viewport unverified. |
| `/teamStats/[teamAbbreviation]` | [web/pages/teamStats/[teamAbbreviation].tsx](../web/pages/teamStats/[teamAbbreviation].tsx) | SSR legacy team; client reads | S | Legacy notice, route/data calls and sections sampled. Historical-data correctness and complete child charts unreviewed. |
| `/trends` | [web/pages/trends/index.tsx](../web/pages/trends/index.tsx) | SSR shell; client section reads | S | Section loader and stale epoch guard, retry controls, route filters and dashboard hierarchy sampled. Deep metrics/model outcomes unreviewed. |
| `/trends/placeholder` | [web/pages/trends/placeholder.tsx](../web/pages/trends/placeholder.tsx) | Client legacy dashboard | S | Entry, representative request/effect and dashboard/filter branches sampled; noindex/legacy context inspected. Most of large prototype and model outcomes unreviewed. |
| `/trends/player/[playerId]` | [web/pages/trends/player/[playerId].tsx](../web/pages/trends/player/[playerId].tsx) | SSR shell; client player reads | S | ID handling, parallel player/rolling reads and primary state/chart branches sampled. Full chart controls/model outcomes unreviewed. |
| `/trendsDebug` | [web/pages/trendsDebug.tsx](../web/pages/trendsDebug.tsx) | Client admin diagnostics | S | Admin/loading guard and representative request/control/error branches sampled. Console contents and raw model validation outcomes unreviewed. |
| `/trendsSandbox` | [web/pages/trendsSandbox.tsx](../web/pages/trendsSandbox.tsx) | Client sandbox | S | Representative fetch/effect/control and placeholder branches sampled. Large experimental calculations, all result panels and raw outcomes unreviewed. |
| `/trendsTestingGrounds` | [web/pages/trendsTestingGrounds.tsx](../web/pages/trendsTestingGrounds.tsx) | Client on-demand diagnostic fetch | S | Metric/player/limit inputs, explicit submit, loading/error flow and labeled controls inspected; A03. Diagnostic results unexecuted. |
| `/trueGoalieValue` | [web/pages/trueGoalieValue.tsx](../web/pages/trueGoalieValue.tsx) | Client legacy goalie analysis | S | Date/week selection, parallel metric reads and terminal error branches sampled. Complete legacy calculations/charts unreviewed. |
| `/twitterEmbeds` | [web/pages/twitterEmbeds/index.tsx](../web/pages/twitterEmbeds/index.tsx) | SSR feed; visible-only 60s refresh | S | Parallel source queries, public-card sanitization call, empty/error and visibility-gated refresh sampled. No feed requests; sanitation/security not certified. |
| `/underlying-stats/goalieStats/[playerId]` | [web/pages/underlying-stats/goalieStats/[playerId].tsx](../web/pages/underlying-stats/goalieStats/[playerId].tsx) | SSR ID shell; query wrapper | S | Complete goalie wrapper/canonicalization inspected; delegates player-detail implementation. Detail internals sampled below; no independent live fixture. |
| `/underlying-stats/goalieStats` | [web/pages/underlying-stats/goalieStats/index.tsx](../web/pages/underlying-stats/goalieStats/index.tsx) | Client query wrapper | S | Complete goalie canonical-query wrapper inspected; delegates player explorer. Import internals covered only by player-landing sample/tests. |
| `/underlying-stats` | [web/pages/underlying-stats/index.tsx](../web/pages/underlying-stats/index.tsx) | Client stats dashboard | S | Active dashboard fetch/status/leader sections and styles sampled. C03 typography assigned; full data states/viewport rendering unreviewed. |
| `/underlying-stats/playerStats/[playerId]` | [web/pages/underlying-stats/playerStats/[playerId].tsx](../web/pages/underlying-stats/playerStats/[playerId].tsx) | SSR ID shell; client detail | S | Abortable requests, route/filter handling, tables and empty/error sections sampled. Full detail charts/stat families unreviewed. |
| `/underlying-stats/playerStats` | [web/pages/underlying-stats/playerStats/index.tsx](../web/pages/underlying-stats/playerStats/index.tsx) | Client paginated explorer | S | T: 14 tests including first-100/sort/load-more/cache and families. Abort/request state and progressive hydration sampled. Full viewport/filter combinations unreviewed. |
| `/underlying-stats/teamStats` | [web/pages/underlying-stats/teamStats/index.tsx](../web/pages/underlying-stats/teamStats/index.tsx) | Client filtered explorer | S | Canonical filters, abortable request/status, error/empty/table branches and shared shell inspected. Compiled contrast confirms A05; current browser unverified. |
| `/underlying-stats/xg` | [web/pages/underlying-stats/xg/index.tsx](../web/pages/underlying-stats/xg/index.tsx) | Client xG lab | S | Abortable fetch, labeled controls, error/loading and report sections sampled. Scientific output and every visual/interaction state unreviewed. |
| `/underlying-stats/xg/operations` | [web/pages/underlying-stats/xg/operations.tsx](../web/pages/underlying-stats/xg/operations.tsx) | Client operations view | S | Complete entry read; abort, refresh key/button, alert and loading branches inspected. Backend operations/status values unqueried. |
| `/variance/goalies` | [web/pages/variance/goalies.js](../web/pages/variance/goalies.js) | Re-export; client goalie analysis | S | Re-export verified: it does not re-export /goalies redirect handler. Shared source sampled for week queries/filtering; full chart behavior unreviewed. |
| `/variance` | [web/pages/variance/index.tsx](../web/pages/variance/index.tsx) | Static hub | F | Full entry, heading/description and goalie/skater destination links inspected. |
| `/variance/skaters` | [web/pages/variance/skaters.tsx](../web/pages/variance/skaters.tsx) | Client paginated variance reads | S | First-page/week loading, paginated sources, filter/error and shared Spinner branches sampled. Full dataset/visual charts unreviewed. |
| `/wigoCharts` | [web/pages/wigoCharts.tsx](../web/pages/wigoCharts.tsx) | Client React Query charts | S | Page and useWigoPlayerDashboard inspected for ID validation, two independent enabled queries, selection cache and errors. Chart/export internals unreviewed. |

## Shared framework and configuration coverage

| Entry | Depth | Scope |
| --- | --- | --- |
| [web/pages/_app.tsx](../web/pages/_app.tsx) | F (entry) | Entire shared entry inspected; provider/import/SEO structure. A03/P05 affect shared delivery; deep provider internals sampled. |
| [web/pages/_document.tsx](../web/pages/_document.tsx) | F (entry) | Entire document inspected; language, viewport shell and font links. P04. |
| Next-generated `/_error` | U | No custom `_error` page exists; installed default implementation not audited. |
| [web/next.config.js](../web/next.config.js) | F (configuration) | Page extensions, image settings, rewrites, redirects and build/dev distinctions inspected without resolving private environment values. |
| `/studio` rewrite | S rule / U destination | Rewrites to configured external CMS `/studio`; CMS implementation and deployment unreviewed. |
| `/studio/:path*` rewrite | S rule / U destination | Rewrites to configured external CMS subtree; CMS implementation and deployment unreviewed. |
| `/game-grid` config redirect | F rule | Duplicate entry already counted above; redirects to `/game-grid/7-Day-Forecast`. |

## Complete API candidate inventory

**354 source candidates: 3 S for routing eligibility only, 351 U for implementation.** The three co-located tests are included because Next maps them as candidates; the remaining 351 are intended API-file candidates, not a claim that every file exports a valid or safe handler. Backend semantics, authorization, cost, schedules, write behavior and response timing are outside this page audit. No endpoint was invoked. Python/YAML assets under pages/api do not match the configured page extensions and are not routes.

| Route candidate | Source | Depth | Note |
| --- | --- | --- | --- |
| `/api/Averages/[playerId]` | [web/pages/api/Averages/[playerId].ts](../web/pages/api/Averages/[playerId].ts) | U | Inventory only. |
| `/api/CareerAverages/[playerId]` | [web/pages/api/CareerAverages/[playerId].ts](../web/pages/api/CareerAverages/[playerId].ts) | U | Inventory only. |
| `/api/SustainabilityStats/[playerId]` | [web/pages/api/SustainabilityStats/[playerId].ts](../web/pages/api/SustainabilityStats/[playerId].ts) | U | Inventory only. |
| `/api/Teams/[teamAbbreviation]` | [web/pages/api/Teams/[teamAbbreviation].ts](../web/pages/api/Teams/[teamAbbreviation].ts) | U | Inventory only. |
| `/api/Teams/nst-team-stats` | [web/pages/api/Teams/nst-team-stats.ts](../web/pages/api/Teams/nst-team-stats.ts) | U | Inventory only. |
| `/api/ThreeYearAverages/[playerId]` | [web/pages/api/ThreeYearAverages/[playerId].ts](../web/pages/api/ThreeYearAverages/[playerId].ts) | U | Inventory only. |
| `/api/cors` | [web/pages/api/cors/index.ts](../web/pages/api/cors/index.ts) | U | Inventory only. |
| `/api/createComment` | [web/pages/api/createComment.ts](../web/pages/api/createComment.ts) | U | Inventory only. |
| `/api/fetch_team_table` | [web/pages/api/fetch_team_table.ts](../web/pages/api/fetch_team_table.ts) | U | Inventory only. |
| `/api/healthz` | [web/pages/api/healthz.ts](../web/pages/api/healthz.ts) | U | Inventory only. |
| `/api/internal/cron-auth-check` | [web/pages/api/internal/cron-auth-check.ts](../web/pages/api/internal/cron-auth-check.ts) | U | Inventory only. |
| `/api/internal/espn-sync` | [web/pages/api/internal/espn-sync.ts](../web/pages/api/internal/espn-sync.ts) | U | Inventory only. |
| `/api/internal/fantrax-sync` | [web/pages/api/internal/fantrax-sync.ts](../web/pages/api/internal/fantrax-sync.ts) | U | Inventory only. |
| `/api/internal/forecast-calendar.test` | [web/pages/api/internal/forecast-calendar.test.ts](../web/pages/api/internal/forecast-calendar.test.ts) | S | R01: test-module routing eligibility verified; handler execution unreviewed. |
| `/api/internal/forecast-calendar` | [web/pages/api/internal/forecast-calendar.ts](../web/pages/api/internal/forecast-calendar.ts) | U | Inventory only. |
| `/api/internal/patreon-reconcile` | [web/pages/api/internal/patreon-reconcile.ts](../web/pages/api/internal/patreon-reconcile.ts) | U | Inventory only. |
| `/api/internal/starter-board` | [web/pages/api/internal/starter-board.ts](../web/pages/api/internal/starter-board.ts) | U | Inventory only. |
| `/api/internal/sustainability/health` | [web/pages/api/internal/sustainability/health.ts](../web/pages/api/internal/sustainability/health.ts) | U | Inventory only. |
| `/api/internal/sync-yahoo-players-to-sheet` | [web/pages/api/internal/sync-yahoo-players-to-sheet.ts](../web/pages/api/internal/sync-yahoo-players-to-sheet.ts) | U | Inventory only. |
| `/api/internal/yahoo-live-draft` | [web/pages/api/internal/yahoo-live-draft.ts](../web/pages/api/internal/yahoo-live-draft.ts) | U | Inventory only. |
| `/api/team-ratings` | [web/pages/api/team-ratings.ts](../web/pages/api/team-ratings.ts) | U | Inventory only. |
| `/api/toi` | [web/pages/api/toi.ts](../web/pages/api/toi.ts) | U | Inventory only. |
| `/api/underlying-stats/landing.test` | [web/pages/api/underlying-stats/landing.test.ts](../web/pages/api/underlying-stats/landing.test.ts) | S | R01: test-module routing eligibility verified; handler execution unreviewed. |
| `/api/underlying-stats/landing` | [web/pages/api/underlying-stats/landing.ts](../web/pages/api/underlying-stats/landing.ts) | U | Inventory only. |
| `/api/underlying-stats/team-ratings` | [web/pages/api/underlying-stats/team-ratings.ts](../web/pages/api/underlying-stats/team-ratings.ts) | U | Inventory only. |
| `/api/v1/account/draft-pro/access-codes/redeem` | [web/pages/api/v1/account/draft-pro/access-codes/redeem.ts](../web/pages/api/v1/account/draft-pro/access-codes/redeem.ts) | U | Inventory only. |
| `/api/v1/account/draft-pro/checkout` | [web/pages/api/v1/account/draft-pro/checkout.ts](../web/pages/api/v1/account/draft-pro/checkout.ts) | U | Inventory only. |
| `/api/v1/account/draft-pro/checkout/verify` | [web/pages/api/v1/account/draft-pro/checkout/verify.ts](../web/pages/api/v1/account/draft-pro/checkout/verify.ts) | U | Inventory only. |
| `/api/v1/account/draft-pro/drafts/[id]` | [web/pages/api/v1/account/draft-pro/drafts/[id].ts](../web/pages/api/v1/account/draft-pro/drafts/[id].ts) | U | Inventory only. |
| `/api/v1/account/draft-pro/drafts/[id]/imports/[importId]` | [web/pages/api/v1/account/draft-pro/drafts/[id]/imports/[importId].ts](../web/pages/api/v1/account/draft-pro/drafts/[id]/imports/[importId].ts) | U | Inventory only. |
| `/api/v1/account/draft-pro/drafts` | [web/pages/api/v1/account/draft-pro/drafts/index.ts](../web/pages/api/v1/account/draft-pro/drafts/index.ts) | U | Inventory only. |
| `/api/v1/account/draft-pro` | [web/pages/api/v1/account/draft-pro/index.ts](../web/pages/api/v1/account/draft-pro/index.ts) | U | Inventory only. |
| `/api/v1/account/draft-pro/private-imports` | [web/pages/api/v1/account/draft-pro/private-imports.ts](../web/pages/api/v1/account/draft-pro/private-imports.ts) | U | Inventory only. |
| `/api/v1/account/draft-pro/private-imports/[uploadId]/chunks/[ordinal]` | [web/pages/api/v1/account/draft-pro/private-imports/[uploadId]/chunks/[ordinal].ts](../web/pages/api/v1/account/draft-pro/private-imports/[uploadId]/chunks/[ordinal].ts) | U | Inventory only. |
| `/api/v1/account/draft-pro/private-imports/[uploadId]/stage` | [web/pages/api/v1/account/draft-pro/private-imports/[uploadId]/stage.ts](../web/pages/api/v1/account/draft-pro/private-imports/[uploadId]/stage.ts) | U | Inventory only. |
| `/api/v1/account/draft-pro/refund-requests` | [web/pages/api/v1/account/draft-pro/refund-requests.ts](../web/pages/api/v1/account/draft-pro/refund-requests.ts) | U | Inventory only. |
| `/api/v1/account/draft-pro/reports/[id]` | [web/pages/api/v1/account/draft-pro/reports/[id].ts](../web/pages/api/v1/account/draft-pro/reports/[id].ts) | U | Inventory only. |
| `/api/v1/account/draft-pro/reports` | [web/pages/api/v1/account/draft-pro/reports/index.ts](../web/pages/api/v1/account/draft-pro/reports/index.ts) | U | Inventory only. |
| `/api/v1/account/draft-pro/scenarios/[id]` | [web/pages/api/v1/account/draft-pro/scenarios/[id].ts](../web/pages/api/v1/account/draft-pro/scenarios/[id].ts) | U | Inventory only. |
| `/api/v1/account/draft-pro/scenarios` | [web/pages/api/v1/account/draft-pro/scenarios/index.ts](../web/pages/api/v1/account/draft-pro/scenarios/index.ts) | U | Inventory only. |
| `/api/v1/account/espn/apply-settings` | [web/pages/api/v1/account/espn/apply-settings.ts](../web/pages/api/v1/account/espn/apply-settings.ts) | U | Inventory only. |
| `/api/v1/account/espn/connections/[accountId]` | [web/pages/api/v1/account/espn/connections/[accountId].ts](../web/pages/api/v1/account/espn/connections/[accountId].ts) | U | Inventory only. |
| `/api/v1/account/espn/connections/[accountId]/leagues/[leagueId]` | [web/pages/api/v1/account/espn/connections/[accountId]/leagues/[leagueId].ts](../web/pages/api/v1/account/espn/connections/[accountId]/leagues/[leagueId].ts) | U | Inventory only. |
| `/api/v1/account/espn/connections/[accountId]/leagues` | [web/pages/api/v1/account/espn/connections/[accountId]/leagues/index.ts](../web/pages/api/v1/account/espn/connections/[accountId]/leagues/index.ts) | U | Inventory only. |
| `/api/v1/account/espn/connections` | [web/pages/api/v1/account/espn/connections/index.ts](../web/pages/api/v1/account/espn/connections/index.ts) | U | Inventory only. |
| `/api/v1/account/espn/draft-sessions/[sessionId]` | [web/pages/api/v1/account/espn/draft-sessions/[sessionId]/index.ts](../web/pages/api/v1/account/espn/draft-sessions/[sessionId]/index.ts) | U | Inventory only. |
| `/api/v1/account/espn/draft-sessions/[sessionId]/poll` | [web/pages/api/v1/account/espn/draft-sessions/[sessionId]/poll.ts](../web/pages/api/v1/account/espn/draft-sessions/[sessionId]/poll.ts) | U | Inventory only. |
| `/api/v1/account/espn/draft-sessions/[sessionId]/stop` | [web/pages/api/v1/account/espn/draft-sessions/[sessionId]/stop.ts](../web/pages/api/v1/account/espn/draft-sessions/[sessionId]/stop.ts) | U | Inventory only. |
| `/api/v1/account/espn/draft-sessions` | [web/pages/api/v1/account/espn/draft-sessions/index.ts](../web/pages/api/v1/account/espn/draft-sessions/index.ts) | U | Inventory only. |
| `/api/v1/account/espn/import` | [web/pages/api/v1/account/espn/import.ts](../web/pages/api/v1/account/espn/import.ts) | U | Inventory only. |
| `/api/v1/account/espn/link` | [web/pages/api/v1/account/espn/link.ts](../web/pages/api/v1/account/espn/link.ts) | U | Inventory only. |
| `/api/v1/account/espn/refresh` | [web/pages/api/v1/account/espn/refresh.ts](../web/pages/api/v1/account/espn/refresh.ts) | U | Inventory only. |
| `/api/v1/account/fantrax/apply-settings` | [web/pages/api/v1/account/fantrax/apply-settings.ts](../web/pages/api/v1/account/fantrax/apply-settings.ts) | U | Inventory only. |
| `/api/v1/account/fantrax/connections/[accountId]` | [web/pages/api/v1/account/fantrax/connections/[accountId].ts](../web/pages/api/v1/account/fantrax/connections/[accountId].ts) | U | Inventory only. |
| `/api/v1/account/fantrax/connections` | [web/pages/api/v1/account/fantrax/connections/index.ts](../web/pages/api/v1/account/fantrax/connections/index.ts) | U | Inventory only. |
| `/api/v1/account/fantrax/discover` | [web/pages/api/v1/account/fantrax/discover.ts](../web/pages/api/v1/account/fantrax/discover.ts) | U | Inventory only. |
| `/api/v1/account/fantrax/draft-sessions/[sessionId]` | [web/pages/api/v1/account/fantrax/draft-sessions/[sessionId]/index.ts](../web/pages/api/v1/account/fantrax/draft-sessions/[sessionId]/index.ts) | U | Inventory only. |
| `/api/v1/account/fantrax/draft-sessions/[sessionId]/poll` | [web/pages/api/v1/account/fantrax/draft-sessions/[sessionId]/poll.ts](../web/pages/api/v1/account/fantrax/draft-sessions/[sessionId]/poll.ts) | U | Inventory only. |
| `/api/v1/account/fantrax/draft-sessions/[sessionId]/stop` | [web/pages/api/v1/account/fantrax/draft-sessions/[sessionId]/stop.ts](../web/pages/api/v1/account/fantrax/draft-sessions/[sessionId]/stop.ts) | U | Inventory only. |
| `/api/v1/account/fantrax/draft-sessions` | [web/pages/api/v1/account/fantrax/draft-sessions/index.ts](../web/pages/api/v1/account/fantrax/draft-sessions/index.ts) | U | Inventory only. |
| `/api/v1/account/fantrax/import` | [web/pages/api/v1/account/fantrax/import.ts](../web/pages/api/v1/account/fantrax/import.ts) | U | Inventory only. |
| `/api/v1/account/fantrax/link` | [web/pages/api/v1/account/fantrax/link.ts](../web/pages/api/v1/account/fantrax/link.ts) | U | Inventory only. |
| `/api/v1/account/fantrax/player-data.test` | [web/pages/api/v1/account/fantrax/player-data.test.ts](../web/pages/api/v1/account/fantrax/player-data.test.ts) | S | R01: test-module routing eligibility verified; handler execution unreviewed. |
| `/api/v1/account/fantrax/player-data` | [web/pages/api/v1/account/fantrax/player-data.ts](../web/pages/api/v1/account/fantrax/player-data.ts) | U | Inventory only. |
| `/api/v1/account/fantrax/refresh` | [web/pages/api/v1/account/fantrax/refresh.ts](../web/pages/api/v1/account/fantrax/refresh.ts) | U | Inventory only. |
| `/api/v1/account/patreon/callback` | [web/pages/api/v1/account/patreon/callback.ts](../web/pages/api/v1/account/patreon/callback.ts) | U | Inventory only. |
| `/api/v1/account/patreon/connect` | [web/pages/api/v1/account/patreon/connect.ts](../web/pages/api/v1/account/patreon/connect.ts) | U | Inventory only. |
| `/api/v1/account/patreon/disconnect` | [web/pages/api/v1/account/patreon/disconnect.ts](../web/pages/api/v1/account/patreon/disconnect.ts) | U | Inventory only. |
| `/api/v1/account/patreon` | [web/pages/api/v1/account/patreon/index.ts](../web/pages/api/v1/account/patreon/index.ts) | U | Inventory only. |
| `/api/v1/account/patreon/refresh` | [web/pages/api/v1/account/patreon/refresh.ts](../web/pages/api/v1/account/patreon/refresh.ts) | U | Inventory only. |
| `/api/v1/account/yahoo/callback` | [web/pages/api/v1/account/yahoo/callback.ts](../web/pages/api/v1/account/yahoo/callback.ts) | U | Inventory only. |
| `/api/v1/account/yahoo/connect` | [web/pages/api/v1/account/yahoo/connect.ts](../web/pages/api/v1/account/yahoo/connect.ts) | U | Inventory only. |
| `/api/v1/account/yahoo/disconnect` | [web/pages/api/v1/account/yahoo/disconnect.ts](../web/pages/api/v1/account/yahoo/disconnect.ts) | U | Inventory only. |
| `/api/v1/account/yahoo/draft-sessions/[sessionId]` | [web/pages/api/v1/account/yahoo/draft-sessions/[sessionId]/index.ts](../web/pages/api/v1/account/yahoo/draft-sessions/[sessionId]/index.ts) | U | Inventory only. |
| `/api/v1/account/yahoo/draft-sessions/[sessionId]/poll` | [web/pages/api/v1/account/yahoo/draft-sessions/[sessionId]/poll.ts](../web/pages/api/v1/account/yahoo/draft-sessions/[sessionId]/poll.ts) | U | Inventory only. |
| `/api/v1/account/yahoo/draft-sessions/[sessionId]/stop` | [web/pages/api/v1/account/yahoo/draft-sessions/[sessionId]/stop.ts](../web/pages/api/v1/account/yahoo/draft-sessions/[sessionId]/stop.ts) | U | Inventory only. |
| `/api/v1/account/yahoo/draft-sessions` | [web/pages/api/v1/account/yahoo/draft-sessions/index.ts](../web/pages/api/v1/account/yahoo/draft-sessions/index.ts) | U | Inventory only. |
| `/api/v1/account/yahoo/pickup` | [web/pages/api/v1/account/yahoo/pickup.ts](../web/pages/api/v1/account/yahoo/pickup.ts) | U | Inventory only. |
| `/api/v1/account/yahoo/refresh` | [web/pages/api/v1/account/yahoo/refresh.ts](../web/pages/api/v1/account/yahoo/refresh.ts) | U | Inventory only. |
| `/api/v1/account/yahoo/starter-board` | [web/pages/api/v1/account/yahoo/starter-board.ts](../web/pages/api/v1/account/yahoo/starter-board.ts) | U | Inventory only. |
| `/api/v1/account/yahoo/team-roster` | [web/pages/api/v1/account/yahoo/team-roster.ts](../web/pages/api/v1/account/yahoo/team-roster.ts) | U | Inventory only. |
| `/api/v1/contextual-rankings` | [web/pages/api/v1/contextual-rankings.ts](../web/pages/api/v1/contextual-rankings.ts) | U | Inventory only. |
| `/api/v1/contextual-rankings/available-filters` | [web/pages/api/v1/contextual-rankings/available-filters.ts](../web/pages/api/v1/contextual-rankings/available-filters.ts) | U | Inventory only. |
| `/api/v1/contextual-rankings/comparison` | [web/pages/api/v1/contextual-rankings/comparison.ts](../web/pages/api/v1/contextual-rankings/comparison.ts) | U | Inventory only. |
| `/api/v1/contextual-rankings/deployment-tiers` | [web/pages/api/v1/contextual-rankings/deployment-tiers.ts](../web/pages/api/v1/contextual-rankings/deployment-tiers.ts) | U | Inventory only. |
| `/api/v1/contextual-rankings/goalies` | [web/pages/api/v1/contextual-rankings/goalies.ts](../web/pages/api/v1/contextual-rankings/goalies.ts) | U | Inventory only. |
| `/api/v1/contextual-rankings/matrix` | [web/pages/api/v1/contextual-rankings/matrix.ts](../web/pages/api/v1/contextual-rankings/matrix.ts) | U | Inventory only. |
| `/api/v1/contextual-rankings/metadata` | [web/pages/api/v1/contextual-rankings/metadata.ts](../web/pages/api/v1/contextual-rankings/metadata.ts) | U | Inventory only. |
| `/api/v1/contextual-rankings/snapshot` | [web/pages/api/v1/contextual-rankings/snapshot.ts](../web/pages/api/v1/contextual-rankings/snapshot.ts) | U | Inventory only. |
| `/api/v1/contextual-rankings/splits` | [web/pages/api/v1/contextual-rankings/splits.ts](../web/pages/api/v1/contextual-rankings/splits.ts) | U | Inventory only. |
| `/api/v1/contextual-rankings/teams` | [web/pages/api/v1/contextual-rankings/teams.ts](../web/pages/api/v1/contextual-rankings/teams.ts) | U | Inventory only. |
| `/api/v1/contextual-rankings/trending` | [web/pages/api/v1/contextual-rankings/trending.ts](../web/pages/api/v1/contextual-rankings/trending.ts) | U | Inventory only. |
| `/api/v1/contextual-rankings/war` | [web/pages/api/v1/contextual-rankings/war.ts](../web/pages/api/v1/contextual-rankings/war.ts) | U | Inventory only. |
| `/api/v1/db/audit-nhl-ppt-replay-coverage` | [web/pages/api/v1/db/audit-nhl-ppt-replay-coverage.ts](../web/pages/api/v1/db/audit-nhl-ppt-replay-coverage.ts) | U | Inventory only. |
| `/api/v1/db/audit-nhl-xg-backfill` | [web/pages/api/v1/db/audit-nhl-xg-backfill.ts](../web/pages/api/v1/db/audit-nhl-xg-backfill.ts) | U | Inventory only. |
| `/api/v1/db/auto-news-feed-items` | [web/pages/api/v1/db/auto-news-feed-items.ts](../web/pages/api/v1/db/auto-news-feed-items.ts) | U | Inventory only. |
| `/api/v1/db/backfill-goalie-underlying-season` | [web/pages/api/v1/db/backfill-goalie-underlying-season.ts](../web/pages/api/v1/db/backfill-goalie-underlying-season.ts) | U | Inventory only. |
| `/api/v1/db/backfill-player-underlying-season` | [web/pages/api/v1/db/backfill-player-underlying-season.ts](../web/pages/api/v1/db/backfill-player-underlying-season.ts) | U | Inventory only. |
| `/api/v1/db/backfill-team-underlying-season` | [web/pages/api/v1/db/backfill-team-underlying-season.ts](../web/pages/api/v1/db/backfill-team-underlying-season.ts) | U | Inventory only. |
| `/api/v1/db/build-projection-derived-v2` | [web/pages/api/v1/db/build-projection-derived-v2.ts](../web/pages/api/v1/db/build-projection-derived-v2.ts) | U | Inventory only. |
| `/api/v1/db/calculate-wigo-stats` | [web/pages/api/v1/db/calculate-wigo-stats.ts](../web/pages/api/v1/db/calculate-wigo-stats.ts) | U | Inventory only. |
| `/api/v1/db/catch-up-goalie-underlying` | [web/pages/api/v1/db/catch-up-goalie-underlying.ts](../web/pages/api/v1/db/catch-up-goalie-underlying.ts) | U | Inventory only. |
| `/api/v1/db/catch-up-player-underlying` | [web/pages/api/v1/db/catch-up-player-underlying.ts](../web/pages/api/v1/db/catch-up-player-underlying.ts) | U | Inventory only. |
| `/api/v1/db/catch-up-team-underlying` | [web/pages/api/v1/db/catch-up-team-underlying.ts](../web/pages/api/v1/db/catch-up-team-underlying.ts) | U | Inventory only. |
| `/api/v1/db/check-missing-goalie-data` | [web/pages/api/v1/db/check-missing-goalie-data.ts](../web/pages/api/v1/db/check-missing-goalie-data.ts) | U | Inventory only. |
| `/api/v1/db/cron-report` | [web/pages/api/v1/db/cron-report.ts](../web/pages/api/v1/db/cron-report.ts) | U | Inventory only. |
| `/api/v1/db/cron/update-stats-cron` | [web/pages/api/v1/db/cron/update-stats-cron.ts](../web/pages/api/v1/db/cron/update-stats-cron.ts) | U | Inventory only. |
| `/api/v1/db/draft-ranker-health` | [web/pages/api/v1/db/draft-ranker-health.ts](../web/pages/api/v1/db/draft-ranker-health.ts) | U | Inventory only. |
| `/api/v1/db/drain-starter-board` | [web/pages/api/v1/db/drain-starter-board.ts](../web/pages/api/v1/db/drain-starter-board.ts) | U | Inventory only. |
| `/api/v1/db/ingest-projection-inputs` | [web/pages/api/v1/db/ingest-projection-inputs.ts](../web/pages/api/v1/db/ingest-projection-inputs.ts) | U | Inventory only. |
| `/api/v1/db/manual-refresh-yahoo-token` | [web/pages/api/v1/db/manual-refresh-yahoo-token.ts](../web/pages/api/v1/db/manual-refresh-yahoo-token.ts) | U | Inventory only. |
| `/api/v1/db/news-feed-items` | [web/pages/api/v1/db/news-feed-items.ts](../web/pages/api/v1/db/news-feed-items.ts) | U | Inventory only. |
| `/api/v1/db/player-name-aliases` | [web/pages/api/v1/db/player-name-aliases.ts](../web/pages/api/v1/db/player-name-aliases.ts) | U | Inventory only. |
| `/api/v1/db/powerPlayTimeFrame` | [web/pages/api/v1/db/powerPlayTimeFrame.ts](../web/pages/api/v1/db/powerPlayTimeFrame.ts) | U | Inventory only. |
| `/api/v1/db/refresh-draft-ranker-community` | [web/pages/api/v1/db/refresh-draft-ranker-community.ts](../web/pages/api/v1/db/refresh-draft-ranker-community.ts) | U | Inventory only. |
| `/api/v1/db/refresh-draft-ranker-discovery` | [web/pages/api/v1/db/refresh-draft-ranker-discovery.ts](../web/pages/api/v1/db/refresh-draft-ranker-discovery.ts) | U | Inventory only. |
| `/api/v1/db/register-nhl-xg-model` | [web/pages/api/v1/db/register-nhl-xg-model.ts](../web/pages/api/v1/db/register-nhl-xg-model.ts) | U | Inventory only. |
| `/api/v1/db/replay-player-aliases` | [web/pages/api/v1/db/replay-player-aliases.ts](../web/pages/api/v1/db/replay-player-aliases.ts) | U | Inventory only. |
| `/api/v1/db/run-fetch-wgo-data` | [web/pages/api/v1/db/run-fetch-wgo-data.ts](../web/pages/api/v1/db/run-fetch-wgo-data.ts) | U | Inventory only. |
| `/api/v1/db/run-projection-accuracy` | [web/pages/api/v1/db/run-projection-accuracy.ts](../web/pages/api/v1/db/run-projection-accuracy.ts) | U | Inventory only. |
| `/api/v1/db/run-projection-v2` | [web/pages/api/v1/db/run-projection-v2.ts](../web/pages/api/v1/db/run-projection-v2.ts) | U | Inventory only. |
| `/api/v1/db/run-rolling-forge-pipeline` | [web/pages/api/v1/db/run-rolling-forge-pipeline.ts](../web/pages/api/v1/db/run-rolling-forge-pipeline.ts) | U | Inventory only. |
| `/api/v1/db/send-player-name-alias-review` | [web/pages/api/v1/db/send-player-name-alias-review.ts](../web/pages/api/v1/db/send-player-name-alias-review.ts) | U | Inventory only. |
| `/api/v1/db/shift-charts` | [web/pages/api/v1/db/shift-charts.ts](../web/pages/api/v1/db/shift-charts.ts) | U | Inventory only. |
| `/api/v1/db/skaterArray` | [web/pages/api/v1/db/skaterArray.ts](../web/pages/api/v1/db/skaterArray.ts) | U | Inventory only. |
| `/api/v1/db/starter-board-release` | [web/pages/api/v1/db/starter-board-release.ts](../web/pages/api/v1/db/starter-board-release.ts) | U | Inventory only. |
| `/api/v1/db/sustainability/rebuild-baselines` | [web/pages/api/v1/db/sustainability/rebuild-baselines.ts](../web/pages/api/v1/db/sustainability/rebuild-baselines.ts) | U | Inventory only. |
| `/api/v1/db/tweet-pattern-review` | [web/pages/api/v1/db/tweet-pattern-review.ts](../web/pages/api/v1/db/tweet-pattern-review.ts) | U | Inventory only. |
| `/api/v1/db/update-PbP` | [web/pages/api/v1/db/update-PbP.ts](../web/pages/api/v1/db/update-PbP.ts) | U | Inventory only. |
| `/api/v1/db/update-drafted-prospects` | [web/pages/api/v1/db/update-drafted-prospects.ts](../web/pages/api/v1/db/update-drafted-prospects.ts) | U | Inventory only. |
| `/api/v1/db/update-entity-metric-rankings` | [web/pages/api/v1/db/update-entity-metric-rankings.ts](../web/pages/api/v1/db/update-entity-metric-rankings.ts) | U | Inventory only. |
| `/api/v1/db/update-game-goal-projections` | [web/pages/api/v1/db/update-game-goal-projections/index.ts](../web/pages/api/v1/db/update-game-goal-projections/index.ts) | U | Inventory only. |
| `/api/v1/db/update-games` | [web/pages/api/v1/db/update-games.ts](../web/pages/api/v1/db/update-games.ts) | U | Inventory only. |
| `/api/v1/db/update-goalie-projections-v2` | [web/pages/api/v1/db/update-goalie-projections-v2.ts](../web/pages/api/v1/db/update-goalie-projections-v2.ts) | U | Inventory only. |
| `/api/v1/db/update-goalie-starter-mixtures` | [web/pages/api/v1/db/update-goalie-starter-mixtures.ts](../web/pages/api/v1/db/update-goalie-starter-mixtures.ts) | U | Inventory only. |
| `/api/v1/db/update-goalie-underlying-stats` | [web/pages/api/v1/db/update-goalie-underlying-stats.ts](../web/pages/api/v1/db/update-goalie-underlying-stats.ts) | U | Inventory only. |
| `/api/v1/db/update-goalie-underlying-summaries` | [web/pages/api/v1/db/update-goalie-underlying-summaries.ts](../web/pages/api/v1/db/update-goalie-underlying-summaries.ts) | U | Inventory only. |
| `/api/v1/db/update-last-7-14-30` | [web/pages/api/v1/db/update-last-7-14-30.ts](../web/pages/api/v1/db/update-last-7-14-30.ts) | U | Inventory only. |
| `/api/v1/db/update-line-combinations/[id]` | [web/pages/api/v1/db/update-line-combinations/[id].ts](../web/pages/api/v1/db/update-line-combinations/[id].ts) | U | Inventory only. |
| `/api/v1/db/update-line-combinations` | [web/pages/api/v1/db/update-line-combinations/index.ts](../web/pages/api/v1/db/update-line-combinations/index.ts) | U | Inventory only. |
| `/api/v1/db/update-line-sources` | [web/pages/api/v1/db/update-line-sources.ts](../web/pages/api/v1/db/update-line-sources.ts) | U | Inventory only. |
| `/api/v1/db/update-lines-ccc` | [web/pages/api/v1/db/update-lines-ccc.ts](../web/pages/api/v1/db/update-lines-ccc.ts) | U | Inventory only. |
| `/api/v1/db/update-lineup-deployment-tallies` | [web/pages/api/v1/db/update-lineup-deployment-tallies.ts](../web/pages/api/v1/db/update-lineup-deployment-tallies.ts) | U | Inventory only. |
| `/api/v1/db/update-lineup-source-provenance` | [web/pages/api/v1/db/update-lineup-source-provenance.ts](../web/pages/api/v1/db/update-lineup-source-provenance.ts) | U | Inventory only. |
| `/api/v1/db/update-market-prices` | [web/pages/api/v1/db/update-market-prices.ts](../web/pages/api/v1/db/update-market-prices.ts) | U | Inventory only. |
| `/api/v1/db/update-nhl-edge-stats` | [web/pages/api/v1/db/update-nhl-edge-stats.ts](../web/pages/api/v1/db/update-nhl-edge-stats.ts) | U | Inventory only. |
| `/api/v1/db/update-nhl-edge-teams` | [web/pages/api/v1/db/update-nhl-edge-teams.ts](../web/pages/api/v1/db/update-nhl-edge-teams.ts) | U | Inventory only. |
| `/api/v1/db/update-nhl-play-by-play` | [web/pages/api/v1/db/update-nhl-play-by-play.ts](../web/pages/api/v1/db/update-nhl-play-by-play.ts) | U | Inventory only. |
| `/api/v1/db/update-nhl-ppt-replay-tracking` | [web/pages/api/v1/db/update-nhl-ppt-replay-tracking.ts](../web/pages/api/v1/db/update-nhl-ppt-replay-tracking.ts) | U | Inventory only. |
| `/api/v1/db/update-nhl-shift-charts` | [web/pages/api/v1/db/update-nhl-shift-charts.ts](../web/pages/api/v1/db/update-nhl-shift-charts.ts) | U | Inventory only. |
| `/api/v1/db/update-nhl-xg-adjusted-impact` | [web/pages/api/v1/db/update-nhl-xg-adjusted-impact.ts](../web/pages/api/v1/db/update-nhl-xg-adjusted-impact.ts) | U | Inventory only. |
| `/api/v1/db/update-nhl-xg-aggregates` | [web/pages/api/v1/db/update-nhl-xg-aggregates.ts](../web/pages/api/v1/db/update-nhl-xg-aggregates.ts) | U | Inventory only. |
| `/api/v1/db/update-nhl-xg-created-xg` | [web/pages/api/v1/db/update-nhl-xg-created-xg.ts](../web/pages/api/v1/db/update-nhl-xg-created-xg.ts) | U | Inventory only. |
| `/api/v1/db/update-nhl-xg-qot-qoc` | [web/pages/api/v1/db/update-nhl-xg-qot-qoc.ts](../web/pages/api/v1/db/update-nhl-xg-qot-qoc.ts) | U | Inventory only. |
| `/api/v1/db/update-nhl-xg-rebound-control` | [web/pages/api/v1/db/update-nhl-xg-rebound-control.ts](../web/pages/api/v1/db/update-nhl-xg-rebound-control.ts) | U | Inventory only. |
| `/api/v1/db/update-nhl-xg-shot-assists` | [web/pages/api/v1/db/update-nhl-xg-shot-assists.ts](../web/pages/api/v1/db/update-nhl-xg-shot-assists.ts) | U | Inventory only. |
| `/api/v1/db/update-nhl-xg-shot-features` | [web/pages/api/v1/db/update-nhl-xg-shot-features.ts](../web/pages/api/v1/db/update-nhl-xg-shot-features.ts) | U | Inventory only. |
| `/api/v1/db/update-nhl-xg-shot-predictions` | [web/pages/api/v1/db/update-nhl-xg-shot-predictions.ts](../web/pages/api/v1/db/update-nhl-xg-shot-predictions.ts) | U | Inventory only. |
| `/api/v1/db/update-nhl-xg-transitions` | [web/pages/api/v1/db/update-nhl-xg-transitions.ts](../web/pages/api/v1/db/update-nhl-xg-transitions.ts) | U | Inventory only. |
| `/api/v1/db/update-nhl-xg-travel-fatigue` | [web/pages/api/v1/db/update-nhl-xg-travel-fatigue.ts](../web/pages/api/v1/db/update-nhl-xg-travel-fatigue.ts) | U | Inventory only. |
| `/api/v1/db/update-nhlscraper-contracts` | [web/pages/api/v1/db/update-nhlscraper-contracts.ts](../web/pages/api/v1/db/update-nhlscraper-contracts.ts) | U | Inventory only. |
| `/api/v1/db/update-nst-current-season` | [web/pages/api/v1/db/update-nst-current-season.ts](../web/pages/api/v1/db/update-nst-current-season.ts) | U | Inventory only. |
| `/api/v1/db/update-nst-gamelog` | [web/pages/api/v1/db/update-nst-gamelog.ts](../web/pages/api/v1/db/update-nst-gamelog.ts) | U | Inventory only. |
| `/api/v1/db/update-nst-goalies` | [web/pages/api/v1/db/update-nst-goalies.ts](../web/pages/api/v1/db/update-nst-goalies.ts) | U | Inventory only. |
| `/api/v1/db/update-nst-last-ten` | [web/pages/api/v1/db/update-nst-last-ten.ts](../web/pages/api/v1/db/update-nst-last-ten.ts) | U | Inventory only. |
| `/api/v1/db/update-nst-player-reports` | [web/pages/api/v1/db/update-nst-player-reports.ts](../web/pages/api/v1/db/update-nst-player-reports.ts) | U | Inventory only. |
| `/api/v1/db/update-nst-team-daily` | [web/pages/api/v1/db/update-nst-team-daily.ts](../web/pages/api/v1/db/update-nst-team-daily.ts) | U | Inventory only. |
| `/api/v1/db/update-player-impact-ratings` | [web/pages/api/v1/db/update-player-impact-ratings.ts](../web/pages/api/v1/db/update-player-impact-ratings.ts) | U | Inventory only. |
| `/api/v1/db/update-player-statuses` | [web/pages/api/v1/db/update-player-statuses.ts](../web/pages/api/v1/db/update-player-statuses.ts) | U | Inventory only. |
| `/api/v1/db/update-player-trend-metrics` | [web/pages/api/v1/db/update-player-trend-metrics.ts](../web/pages/api/v1/db/update-player-trend-metrics.ts) | U | Inventory only. |
| `/api/v1/db/update-player-underlying-stats` | [web/pages/api/v1/db/update-player-underlying-stats.ts](../web/pages/api/v1/db/update-player-underlying-stats.ts) | U | Inventory only. |
| `/api/v1/db/update-player-underlying-summaries` | [web/pages/api/v1/db/update-player-underlying-summaries.ts](../web/pages/api/v1/db/update-player-underlying-summaries.ts) | U | Inventory only. |
| `/api/v1/db/update-player/[playerId]` | [web/pages/api/v1/db/update-player/[playerId].ts](../web/pages/api/v1/db/update-player/[playerId].ts) | U | Inventory only. |
| `/api/v1/db/update-players` | [web/pages/api/v1/db/update-players.ts](../web/pages/api/v1/db/update-players.ts) | U | Inventory only. |
| `/api/v1/db/update-power-play-combinations/[gameId]` | [web/pages/api/v1/db/update-power-play-combinations/[gameId].ts](../web/pages/api/v1/db/update-power-play-combinations/[gameId].ts) | U | Inventory only. |
| `/api/v1/db/update-power-play-combinations` | [web/pages/api/v1/db/update-power-play-combinations/index.ts](../web/pages/api/v1/db/update-power-play-combinations/index.ts) | U | Inventory only. |
| `/api/v1/db/update-power-rankings` | [web/pages/api/v1/db/update-power-rankings.ts](../web/pages/api/v1/db/update-power-rankings.ts) | U | Inventory only. |
| `/api/v1/db/update-rolling-games` | [web/pages/api/v1/db/update-rolling-games.ts](../web/pages/api/v1/db/update-rolling-games.ts) | U | Inventory only. |
| `/api/v1/db/update-rolling-player-averages` | [web/pages/api/v1/db/update-rolling-player-averages.ts](../web/pages/api/v1/db/update-rolling-player-averages.ts) | U | Inventory only. |
| `/api/v1/db/update-roster-optimizer-schedule` | [web/pages/api/v1/db/update-roster-optimizer-schedule.ts](../web/pages/api/v1/db/update-roster-optimizer-schedule.ts) | U | Inventory only. |
| `/api/v1/db/update-season-stats` | [web/pages/api/v1/db/update-season-stats.ts](../web/pages/api/v1/db/update-season-stats.ts) | U | Inventory only. |
| `/api/v1/db/update-seasons` | [web/pages/api/v1/db/update-seasons.ts](../web/pages/api/v1/db/update-seasons.ts) | U | Inventory only. |
| `/api/v1/db/update-shifts` | [web/pages/api/v1/db/update-shifts.ts](../web/pages/api/v1/db/update-shifts.ts) | U | Inventory only. |
| `/api/v1/db/update-skater-composite-ratings` | [web/pages/api/v1/db/update-skater-composite-ratings.ts](../web/pages/api/v1/db/update-skater-composite-ratings.ts) | U | Inventory only. |
| `/api/v1/db/update-sko-stats` | [web/pages/api/v1/db/update-sko-stats.ts](../web/pages/api/v1/db/update-sko-stats.ts) | U | Inventory only. |
| `/api/v1/db/update-standings-details` | [web/pages/api/v1/db/update-standings-details/index.ts](../web/pages/api/v1/db/update-standings-details/index.ts) | U | Inventory only. |
| `/api/v1/db/update-stats/[gameId]` | [web/pages/api/v1/db/update-stats/[gameId].ts](../web/pages/api/v1/db/update-stats/[gameId].ts) | U | Inventory only. |
| `/api/v1/db/update-team-ctpi-daily` | [web/pages/api/v1/db/update-team-ctpi-daily.ts](../web/pages/api/v1/db/update-team-ctpi-daily.ts) | U | Inventory only. |
| `/api/v1/db/update-team-power-ratings-new` | [web/pages/api/v1/db/update-team-power-ratings-new.ts](../web/pages/api/v1/db/update-team-power-ratings-new.ts) | U | Inventory only. |
| `/api/v1/db/update-team-power-ratings` | [web/pages/api/v1/db/update-team-power-ratings.ts](../web/pages/api/v1/db/update-team-power-ratings.ts) | U | Inventory only. |
| `/api/v1/db/update-team-sos` | [web/pages/api/v1/db/update-team-sos.ts](../web/pages/api/v1/db/update-team-sos.ts) | U | Inventory only. |
| `/api/v1/db/update-team-unit-toi` | [web/pages/api/v1/db/update-team-unit-toi.ts](../web/pages/api/v1/db/update-team-unit-toi.ts) | U | Inventory only. |
| `/api/v1/db/update-team-yearly-summary` | [web/pages/api/v1/db/update-team-yearly-summary.ts](../web/pages/api/v1/db/update-team-yearly-summary.ts) | U | Inventory only. |
| `/api/v1/db/update-teams` | [web/pages/api/v1/db/update-teams.ts](../web/pages/api/v1/db/update-teams.ts) | U | Inventory only. |
| `/api/v1/db/update-wgo-averages` | [web/pages/api/v1/db/update-wgo-averages.ts](../web/pages/api/v1/db/update-wgo-averages.ts) | U | Inventory only. |
| `/api/v1/db/update-wgo-goalie-totals` | [web/pages/api/v1/db/update-wgo-goalie-totals.ts](../web/pages/api/v1/db/update-wgo-goalie-totals.ts) | U | Inventory only. |
| `/api/v1/db/update-wgo-goalies` | [web/pages/api/v1/db/update-wgo-goalies.ts](../web/pages/api/v1/db/update-wgo-goalies.ts) | U | Inventory only. |
| `/api/v1/db/update-wgo-skaters` | [web/pages/api/v1/db/update-wgo-skaters.ts](../web/pages/api/v1/db/update-wgo-skaters.ts) | U | Inventory only. |
| `/api/v1/db/update-wgo-totals` | [web/pages/api/v1/db/update-wgo-totals.ts](../web/pages/api/v1/db/update-wgo-totals.ts) | U | Inventory only. |
| `/api/v1/db/update-yahoo-players` | [web/pages/api/v1/db/update-yahoo-players.ts](../web/pages/api/v1/db/update-yahoo-players.ts) | U | Inventory only. |
| `/api/v1/db/update-yahoo-weeks` | [web/pages/api/v1/db/update-yahoo-weeks.ts](../web/pages/api/v1/db/update-yahoo-weeks.ts) | U | Inventory only. |
| `/api/v1/db/upsert-csv` | [web/pages/api/v1/db/upsert-csv.ts](../web/pages/api/v1/db/upsert-csv.ts) | U | Inventory only. |
| `/api/v1/debug/rolling-player-metrics` | [web/pages/api/v1/debug/rolling-player-metrics.ts](../web/pages/api/v1/debug/rolling-player-metrics.ts) | U | Inventory only. |
| `/api/v1/discord/send-message/line-combo/[gameId]` | [web/pages/api/v1/discord/send-message/line-combo/[gameId].ts](../web/pages/api/v1/discord/send-message/line-combo/[gameId].ts) | U | Inventory only. |
| `/api/v1/draft-pro/dust` | [web/pages/api/v1/draft-pro/dust.ts](../web/pages/api/v1/draft-pro/dust.ts) | U | Inventory only. |
| `/api/v1/draft-pro/export` | [web/pages/api/v1/draft-pro/export.ts](../web/pages/api/v1/draft-pro/export.ts) | U | Inventory only. |
| `/api/v1/draft-pro/fantrax-player-data` | [web/pages/api/v1/draft-pro/fantrax-player-data.ts](../web/pages/api/v1/draft-pro/fantrax-player-data.ts) | U | Inventory only. |
| `/api/v1/draft-pro/recommendations` | [web/pages/api/v1/draft-pro/recommendations.ts](../web/pages/api/v1/draft-pro/recommendations.ts) | U | Inventory only. |
| `/api/v1/draft-ranker/community` | [web/pages/api/v1/draft-ranker/community.ts](../web/pages/api/v1/draft-ranker/community.ts) | U | Inventory only. |
| `/api/v1/draft-ranker/discovery` | [web/pages/api/v1/draft-ranker/discovery.ts](../web/pages/api/v1/draft-ranker/discovery.ts) | U | Inventory only. |
| `/api/v1/draft-ranker/entries` | [web/pages/api/v1/draft-ranker/entries.ts](../web/pages/api/v1/draft-ranker/entries.ts) | U | Inventory only. |
| `/api/v1/draft-ranker/export` | [web/pages/api/v1/draft-ranker/export.ts](../web/pages/api/v1/draft-ranker/export.ts) | U | Inventory only. |
| `/api/v1/draft-ranker` | [web/pages/api/v1/draft-ranker/index.ts](../web/pages/api/v1/draft-ranker/index.ts) | U | Inventory only. |
| `/api/v1/draft-ranker/initialize` | [web/pages/api/v1/draft-ranker/initialize.ts](../web/pages/api/v1/draft-ranker/initialize.ts) | U | Inventory only. |
| `/api/v1/draft-ranker/pairwise/consent` | [web/pages/api/v1/draft-ranker/pairwise/consent.ts](../web/pages/api/v1/draft-ranker/pairwise/consent.ts) | U | Inventory only. |
| `/api/v1/draft-ranker/pairwise/queue` | [web/pages/api/v1/draft-ranker/pairwise/queue.ts](../web/pages/api/v1/draft-ranker/pairwise/queue.ts) | U | Inventory only. |
| `/api/v1/draft-ranker/pairwise/respond` | [web/pages/api/v1/draft-ranker/pairwise/respond.ts](../web/pages/api/v1/draft-ranker/pairwise/respond.ts) | U | Inventory only. |
| `/api/v1/draft-ranker/placement` | [web/pages/api/v1/draft-ranker/placement.ts](../web/pages/api/v1/draft-ranker/placement.ts) | U | Inventory only. |
| `/api/v1/draft-ranker/players/request-addition` | [web/pages/api/v1/draft-ranker/players/request-addition.ts](../web/pages/api/v1/draft-ranker/players/request-addition.ts) | U | Inventory only. |
| `/api/v1/draft-ranker/players/search` | [web/pages/api/v1/draft-ranker/players/search.ts](../web/pages/api/v1/draft-ranker/players/search.ts) | U | Inventory only. |
| `/api/v1/draft-ranker/reorder` | [web/pages/api/v1/draft-ranker/reorder.ts](../web/pages/api/v1/draft-ranker/reorder.ts) | U | Inventory only. |
| `/api/v1/draft-ranker/watchlist` | [web/pages/api/v1/draft-ranker/watchlist.ts](../web/pages/api/v1/draft-ranker/watchlist.ts) | U | Inventory only. |
| `/api/v1/fantasy-projections/players` | [web/pages/api/v1/fantasy-projections/players.ts](../web/pages/api/v1/fantasy-projections/players.ts) | U | Inventory only. |
| `/api/v1/fantasy-projections/players/[fhfhPlayerId]` | [web/pages/api/v1/fantasy-projections/players/[fhfhPlayerId].ts](../web/pages/api/v1/fantasy-projections/players/[fhfhPlayerId].ts) | U | Inventory only. |
| `/api/v1/fantasy-projections/releases` | [web/pages/api/v1/fantasy-projections/releases.ts](../web/pages/api/v1/fantasy-projections/releases.ts) | U | Inventory only. |
| `/api/v1/fantasy-projections/teams` | [web/pages/api/v1/fantasy-projections/teams.ts](../web/pages/api/v1/fantasy-projections/teams.ts) | U | Inventory only. |
| `/api/v1/forge/accuracy` | [web/pages/api/v1/forge/accuracy.ts](../web/pages/api/v1/forge/accuracy.ts) | U | Inventory only. |
| `/api/v1/forge/goalies` | [web/pages/api/v1/forge/goalies.ts](../web/pages/api/v1/forge/goalies.ts) | U | Inventory only. |
| `/api/v1/forge/players` | [web/pages/api/v1/forge/players.ts](../web/pages/api/v1/forge/players.ts) | U | Inventory only. |
| `/api/v1/forge/roster-events` | [web/pages/api/v1/forge/roster-events.ts](../web/pages/api/v1/forge/roster-events.ts) | U | Inventory only. |
| `/api/v1/game-predictions/accountability` | [web/pages/api/v1/game-predictions/accountability.ts](../web/pages/api/v1/game-predictions/accountability.ts) | U | Inventory only. |
| `/api/v1/game-predictions/accuracy-loop` | [web/pages/api/v1/game-predictions/accuracy-loop.ts](../web/pages/api/v1/game-predictions/accuracy-loop.ts) | U | Inventory only. |
| `/api/v1/game-predictions/backfill-feature-snapshots` | [web/pages/api/v1/game-predictions/backfill-feature-snapshots.ts](../web/pages/api/v1/game-predictions/backfill-feature-snapshots.ts) | U | Inventory only. |
| `/api/v1/game-predictions/backtest-ablation` | [web/pages/api/v1/game-predictions/backtest-ablation.ts](../web/pages/api/v1/game-predictions/backtest-ablation.ts) | U | Inventory only. |
| `/api/v1/game-predictions/backtest` | [web/pages/api/v1/game-predictions/backtest.ts](../web/pages/api/v1/game-predictions/backtest.ts) | U | Inventory only. |
| `/api/v1/game-predictions/debug` | [web/pages/api/v1/game-predictions/debug.ts](../web/pages/api/v1/game-predictions/debug.ts) | U | Inventory only. |
| `/api/v1/game-predictions/debug/[predictionId]` | [web/pages/api/v1/game-predictions/debug/[predictionId].ts](../web/pages/api/v1/game-predictions/debug/[predictionId].ts) | U | Inventory only. |
| `/api/v1/game-predictions/espn-odds` | [web/pages/api/v1/game-predictions/espn-odds.ts](../web/pages/api/v1/game-predictions/espn-odds.ts) | U | Inventory only. |
| `/api/v1/game-predictions/feature-signal-analysis` | [web/pages/api/v1/game-predictions/feature-signal-analysis.ts](../web/pages/api/v1/game-predictions/feature-signal-analysis.ts) | U | Inventory only. |
| `/api/v1/game-predictions/forecast` | [web/pages/api/v1/game-predictions/forecast.ts](../web/pages/api/v1/game-predictions/forecast.ts) | U | Inventory only. |
| `/api/v1/game-predictions/generate` | [web/pages/api/v1/game-predictions/generate.ts](../web/pages/api/v1/game-predictions/generate.ts) | U | Inventory only. |
| `/api/v1/game-predictions/health` | [web/pages/api/v1/game-predictions/health.ts](../web/pages/api/v1/game-predictions/health.ts) | U | Inventory only. |
| `/api/v1/game-predictions/import-market-odds` | [web/pages/api/v1/game-predictions/import-market-odds.ts](../web/pages/api/v1/game-predictions/import-market-odds.ts) | U | Inventory only. |
| `/api/v1/game-predictions/ingest-espn-odds` | [web/pages/api/v1/game-predictions/ingest-espn-odds.ts](../web/pages/api/v1/game-predictions/ingest-espn-odds.ts) | U | Inventory only. |
| `/api/v1/game-predictions/latest` | [web/pages/api/v1/game-predictions/latest.ts](../web/pages/api/v1/game-predictions/latest.ts) | U | Inventory only. |
| `/api/v1/game-predictions/promote-model-version` | [web/pages/api/v1/game-predictions/promote-model-version.ts](../web/pages/api/v1/game-predictions/promote-model-version.ts) | U | Inventory only. |
| `/api/v1/game-predictions/score` | [web/pages/api/v1/game-predictions/score.ts](../web/pages/api/v1/game-predictions/score.ts) | U | Inventory only. |
| `/api/v1/game/[id]/boxscore` | [web/pages/api/v1/game/[id]/boxscore/index.ts](../web/pages/api/v1/game/[id]/boxscore/index.ts) | U | Inventory only. |
| `/api/v1/game/[id]/right-rail` | [web/pages/api/v1/game/[id]/right-rail/index.ts](../web/pages/api/v1/game/[id]/right-rail/index.ts) | U | Inventory only. |
| `/api/v1/games` | [web/pages/api/v1/games/index.js](../web/pages/api/v1/games/index.js) | U | Inventory only. |
| `/api/v1/homepage/pulse` | [web/pages/api/v1/homepage/pulse.ts](../web/pages/api/v1/homepage/pulse.ts) | U | Inventory only. |
| `/api/v1/homepage/visitors` | [web/pages/api/v1/homepage/visitors.ts](../web/pages/api/v1/homepage/visitors.ts) | U | Inventory only. |
| `/api/v1/lines/projected` | [web/pages/api/v1/lines/projected.ts](../web/pages/api/v1/lines/projected.ts) | U | Inventory only. |
| `/api/v1/ml/create-materialized-view` | [web/pages/api/v1/ml/create-materialized-view.ts](../web/pages/api/v1/ml/create-materialized-view.ts) | U | Inventory only. |
| `/api/v1/ml/get-predictions-sko` | [web/pages/api/v1/ml/get-predictions-sko.ts](../web/pages/api/v1/ml/get-predictions-sko.ts) | U | Inventory only. |
| `/api/v1/ml/update-predictions-sko` | [web/pages/api/v1/ml/update-predictions-sko.ts](../web/pages/api/v1/ml/update-predictions-sko.ts) | U | Inventory only. |
| `/api/v1/mock-draft/access` | [web/pages/api/v1/mock-draft/access.ts](../web/pages/api/v1/mock-draft/access.ts) | U | Inventory only. |
| `/api/v1/mock-draft/adp` | [web/pages/api/v1/mock-draft/adp.ts](../web/pages/api/v1/mock-draft/adp.ts) | U | Inventory only. |
| `/api/v1/mock-draft/sessions/[id]/contributions` | [web/pages/api/v1/mock-draft/sessions/[id]/contributions.ts](../web/pages/api/v1/mock-draft/sessions/[id]/contributions.ts) | U | Inventory only. |
| `/api/v1/mock-draft/sessions/[id]/events` | [web/pages/api/v1/mock-draft/sessions/[id]/events.ts](../web/pages/api/v1/mock-draft/sessions/[id]/events.ts) | U | Inventory only. |
| `/api/v1/mock-draft/sessions` | [web/pages/api/v1/mock-draft/sessions/index.ts](../web/pages/api/v1/mock-draft/sessions/index.ts) | U | Inventory only. |
| `/api/v1/player-forecasts/accountability` | [web/pages/api/v1/player-forecasts/accountability.ts](../web/pages/api/v1/player-forecasts/accountability.ts) | U | Inventory only. |
| `/api/v1/player-forecasts/admin/season-draft` | [web/pages/api/v1/player-forecasts/admin/season-draft.ts](../web/pages/api/v1/player-forecasts/admin/season-draft.ts) | U | Inventory only. |
| `/api/v1/player-forecasts/admin/season-editor` | [web/pages/api/v1/player-forecasts/admin/season-editor.ts](../web/pages/api/v1/player-forecasts/admin/season-editor.ts) | U | Inventory only. |
| `/api/v1/player-forecasts/admin/season-overrides` | [web/pages/api/v1/player-forecasts/admin/season-overrides.ts](../web/pages/api/v1/player-forecasts/admin/season-overrides.ts) | U | Inventory only. |
| `/api/v1/player-forecasts/admin/season-player-pool` | [web/pages/api/v1/player-forecasts/admin/season-player-pool.ts](../web/pages/api/v1/player-forecasts/admin/season-player-pool.ts) | U | Inventory only. |
| `/api/v1/player-forecasts/admin/season-publish` | [web/pages/api/v1/player-forecasts/admin/season-publish.ts](../web/pages/api/v1/player-forecasts/admin/season-publish.ts) | U | Inventory only. |
| `/api/v1/player-forecasts/admin/season-rerun` | [web/pages/api/v1/player-forecasts/admin/season-rerun.ts](../web/pages/api/v1/player-forecasts/admin/season-rerun.ts) | U | Inventory only. |
| `/api/v1/player-forecasts/admin/season-rollback` | [web/pages/api/v1/player-forecasts/admin/season-rollback.ts](../web/pages/api/v1/player-forecasts/admin/season-rollback.ts) | U | Inventory only. |
| `/api/v1/player-forecasts/admin/season-roster-conflicts` | [web/pages/api/v1/player-forecasts/admin/season-roster-conflicts.ts](../web/pages/api/v1/player-forecasts/admin/season-roster-conflicts.ts) | U | Inventory only. |
| `/api/v1/player-forecasts/admin/season-validate` | [web/pages/api/v1/player-forecasts/admin/season-validate.ts](../web/pages/api/v1/player-forecasts/admin/season-validate.ts) | U | Inventory only. |
| `/api/v1/player-forecasts/conflicts` | [web/pages/api/v1/player-forecasts/conflicts.ts](../web/pages/api/v1/player-forecasts/conflicts.ts) | U | Inventory only. |
| `/api/v1/player-forecasts/dashboard` | [web/pages/api/v1/player-forecasts/dashboard.ts](../web/pages/api/v1/player-forecasts/dashboard.ts) | U | Inventory only. |
| `/api/v1/player-forecasts/history` | [web/pages/api/v1/player-forecasts/history.ts](../web/pages/api/v1/player-forecasts/history.ts) | U | Inventory only. |
| `/api/v1/player-forecasts/jobs/daily` | [web/pages/api/v1/player-forecasts/jobs/daily.ts](../web/pages/api/v1/player-forecasts/jobs/daily.ts) | U | Inventory only. |
| `/api/v1/player-forecasts/jobs/drain` | [web/pages/api/v1/player-forecasts/jobs/drain.ts](../web/pages/api/v1/player-forecasts/jobs/drain.ts) | U | Inventory only. |
| `/api/v1/player-forecasts/jobs/retry` | [web/pages/api/v1/player-forecasts/jobs/retry.ts](../web/pages/api/v1/player-forecasts/jobs/retry.ts) | U | Inventory only. |
| `/api/v1/player-forecasts/jobs/season-daily` | [web/pages/api/v1/player-forecasts/jobs/season-daily.ts](../web/pages/api/v1/player-forecasts/jobs/season-daily.ts) | U | Inventory only. |
| `/api/v1/player-forecasts/jobs/season-drain` | [web/pages/api/v1/player-forecasts/jobs/season-drain.ts](../web/pages/api/v1/player-forecasts/jobs/season-drain.ts) | U | Inventory only. |
| `/api/v1/player-forecasts/jobs/season-roster` | [web/pages/api/v1/player-forecasts/jobs/season-roster.ts](../web/pages/api/v1/player-forecasts/jobs/season-roster.ts) | U | Inventory only. |
| `/api/v1/player-forecasts/jobs/season-settlement` | [web/pages/api/v1/player-forecasts/jobs/season-settlement.ts](../web/pages/api/v1/player-forecasts/jobs/season-settlement.ts) | U | Inventory only. |
| `/api/v1/player-forecasts/jobs/settle` | [web/pages/api/v1/player-forecasts/jobs/settle.ts](../web/pages/api/v1/player-forecasts/jobs/settle.ts) | U | Inventory only. |
| `/api/v1/player-forecasts/latest` | [web/pages/api/v1/player-forecasts/latest.ts](../web/pages/api/v1/player-forecasts/latest.ts) | U | Inventory only. |
| `/api/v1/player-forecasts/readiness` | [web/pages/api/v1/player-forecasts/readiness.ts](../web/pages/api/v1/player-forecasts/readiness.ts) | U | Inventory only. |
| `/api/v1/player-forecasts/rest-of-season` | [web/pages/api/v1/player-forecasts/rest-of-season.ts](../web/pages/api/v1/player-forecasts/rest-of-season.ts) | U | Inventory only. |
| `/api/v1/player-forecasts/season-readiness` | [web/pages/api/v1/player-forecasts/season-readiness.ts](../web/pages/api/v1/player-forecasts/season-readiness.ts) | U | Inventory only. |
| `/api/v1/player-forecasts/send-conflict-review` | [web/pages/api/v1/player-forecasts/send-conflict-review.ts](../web/pages/api/v1/player-forecasts/send-conflict-review.ts) | U | Inventory only. |
| `/api/v1/player/[id]/game-log/[season]/[type]` | [web/pages/api/v1/player/[id]/game-log/[season]/[type]/index.ts](../web/pages/api/v1/player/[id]/game-log/[season]/[type]/index.ts) | U | Inventory only. |
| `/api/v1/player/[id]` | [web/pages/api/v1/player/[id]/index.ts](../web/pages/api/v1/player/[id]/index.ts) | U | Inventory only. |
| `/api/v1/player/[id]/percentile-rank` | [web/pages/api/v1/player/[id]/percentile-rank.ts](../web/pages/api/v1/player/[id]/percentile-rank.ts) | U | Inventory only. |
| `/api/v1/player` | [web/pages/api/v1/player/index.ts](../web/pages/api/v1/player/index.ts) | U | Inventory only. |
| `/api/v1/projections` | [web/pages/api/v1/projections.ts](../web/pages/api/v1/projections.ts) | U | Inventory only. |
| `/api/v1/projections/goalies` | [web/pages/api/v1/projections/goalies.ts](../web/pages/api/v1/projections/goalies.ts) | U | Inventory only. |
| `/api/v1/projections/players` | [web/pages/api/v1/projections/players.ts](../web/pages/api/v1/projections/players.ts) | U | Inventory only. |
| `/api/v1/projections/teams` | [web/pages/api/v1/projections/teams.ts](../web/pages/api/v1/projections/teams.ts) | U | Inventory only. |
| `/api/v1/rankings` | [web/pages/api/v1/rankings.ts](../web/pages/api/v1/rankings.ts) | U | Inventory only. |
| `/api/v1/roster-schedule-optimizer/access` | [web/pages/api/v1/roster-schedule-optimizer/access.ts](../web/pages/api/v1/roster-schedule-optimizer/access.ts) | U | Inventory only. |
| `/api/v1/roster-schedule-optimizer/data` | [web/pages/api/v1/roster-schedule-optimizer/data.ts](../web/pages/api/v1/roster-schedule-optimizer/data.ts) | U | Inventory only. |
| `/api/v1/roster-schedule-optimizer/eligibility` | [web/pages/api/v1/roster-schedule-optimizer/eligibility.ts](../web/pages/api/v1/roster-schedule-optimizer/eligibility.ts) | U | Inventory only. |
| `/api/v1/roster-schedule-optimizer/provider` | [web/pages/api/v1/roster-schedule-optimizer/provider.ts](../web/pages/api/v1/roster-schedule-optimizer/provider.ts) | U | Inventory only. |
| `/api/v1/roster-schedule-optimizer/schedule` | [web/pages/api/v1/roster-schedule-optimizer/schedule.ts](../web/pages/api/v1/roster-schedule-optimizer/schedule.ts) | U | Inventory only. |
| `/api/v1/roster-schedule-optimizer/workspace` | [web/pages/api/v1/roster-schedule-optimizer/workspace.ts](../web/pages/api/v1/roster-schedule-optimizer/workspace.ts) | U | Inventory only. |
| `/api/v1/runs/[runId]` | [web/pages/api/v1/runs/[runId].ts](../web/pages/api/v1/runs/[runId].ts) | U | Inventory only. |
| `/api/v1/runs/latest` | [web/pages/api/v1/runs/latest.ts](../web/pages/api/v1/runs/latest.ts) | U | Inventory only. |
| `/api/v1/schedule/[startDate]` | [web/pages/api/v1/schedule/[startDate].ts](../web/pages/api/v1/schedule/[startDate].ts) | U | Inventory only. |
| `/api/v1/schedule/date/[date]` | [web/pages/api/v1/schedule/date/[date].ts](../web/pages/api/v1/schedule/date/[date].ts) | U | Inventory only. |
| `/api/v1/season` | [web/pages/api/v1/season.ts](../web/pages/api/v1/season.ts) | U | Inventory only. |
| `/api/v1/social-share/[format]` | [web/pages/api/v1/social-share/[format].ts](../web/pages/api/v1/social-share/[format].ts) | U | Inventory only. |
| `/api/v1/sources/ifttt/DFOFantasy-tweet` | [web/pages/api/v1/sources/ifttt/DFOFantasy-tweet.ts](../web/pages/api/v1/sources/ifttt/DFOFantasy-tweet.ts) | U | Inventory only. |
| `/api/v1/sources/ifttt/NHL-Rosters-tweet` | [web/pages/api/v1/sources/ifttt/NHL-Rosters-tweet.ts](../web/pages/api/v1/sources/ifttt/NHL-Rosters-tweet.ts) | U | Inventory only. |
| `/api/v1/sources/ifttt/ccc-tweet` | [web/pages/api/v1/sources/ifttt/ccc-tweet.ts](../web/pages/api/v1/sources/ifttt/ccc-tweet.ts) | U | Inventory only. |
| `/api/v1/sources/ifttt/gamedaygoalies-tweet` | [web/pages/api/v1/sources/ifttt/gamedaygoalies-tweet.ts](../web/pages/api/v1/sources/ifttt/gamedaygoalies-tweet.ts) | U | Inventory only. |
| `/api/v1/sources/ifttt/gamedaylines-tweet` | [web/pages/api/v1/sources/ifttt/gamedaylines-tweet.ts](../web/pages/api/v1/sources/ifttt/gamedaylines-tweet.ts) | U | Inventory only. |
| `/api/v1/sources/ifttt/gamedaynewsnhl-tweet` | [web/pages/api/v1/sources/ifttt/gamedaynewsnhl-tweet.ts](../web/pages/api/v1/sources/ifttt/gamedaynewsnhl-tweet.ts) | U | Inventory only. |
| `/api/v1/splits` | [web/pages/api/v1/splits/index.ts](../web/pages/api/v1/splits/index.ts) | U | Inventory only. |
| `/api/v1/start-chart` | [web/pages/api/v1/start-chart.ts](../web/pages/api/v1/start-chart.ts) | U | Inventory only. |
| `/api/v1/sustainability/coverage-audit` | [web/pages/api/v1/sustainability/coverage-audit.ts](../web/pages/api/v1/sustainability/coverage-audit.ts) | U | Inventory only. |
| `/api/v1/sustainability/entity-bands` | [web/pages/api/v1/sustainability/entity-bands.ts](../web/pages/api/v1/sustainability/entity-bands.ts) | U | Inventory only. |
| `/api/v1/sustainability/entity-history` | [web/pages/api/v1/sustainability/entity-history.ts](../web/pages/api/v1/sustainability/entity-history.ts) | U | Inventory only. |
| `/api/v1/sustainability/entity-options` | [web/pages/api/v1/sustainability/entity-options.ts](../web/pages/api/v1/sustainability/entity-options.ts) | U | Inventory only. |
| `/api/v1/sustainability/entity-scores` | [web/pages/api/v1/sustainability/entity-scores.ts](../web/pages/api/v1/sustainability/entity-scores.ts) | U | Inventory only. |
| `/api/v1/sustainability/leaderboard` | [web/pages/api/v1/sustainability/leaderboard.ts](../web/pages/api/v1/sustainability/leaderboard.ts) | U | Inventory only. |
| `/api/v1/sustainability/player/[playerId]` | [web/pages/api/v1/sustainability/player/[playerId].ts](../web/pages/api/v1/sustainability/player/[playerId].ts) | U | Inventory only. |
| `/api/v1/sustainability/process-recompute-queue` | [web/pages/api/v1/sustainability/process-recompute-queue.ts](../web/pages/api/v1/sustainability/process-recompute-queue.ts) | U | Inventory only. |
| `/api/v1/sustainability/rebuild-priors` | [web/pages/api/v1/sustainability/rebuild-priors.ts](../web/pages/api/v1/sustainability/rebuild-priors.ts) | U | Inventory only. |
| `/api/v1/sustainability/rebuild-score` | [web/pages/api/v1/sustainability/rebuild-score.ts](../web/pages/api/v1/sustainability/rebuild-score.ts) | U | Inventory only. |
| `/api/v1/sustainability/rebuild-trend-bands` | [web/pages/api/v1/sustainability/rebuild-trend-bands.ts](../web/pages/api/v1/sustainability/rebuild-trend-bands.ts) | U | Inventory only. |
| `/api/v1/sustainability/rebuild-window-z` | [web/pages/api/v1/sustainability/rebuild-window-z.ts](../web/pages/api/v1/sustainability/rebuild-window-z.ts) | U | Inventory only. |
| `/api/v1/sustainability/recompute` | [web/pages/api/v1/sustainability/recompute.ts](../web/pages/api/v1/sustainability/recompute.ts) | U | Inventory only. |
| `/api/v1/sustainability/trend-bands` | [web/pages/api/v1/sustainability/trend-bands.ts](../web/pages/api/v1/sustainability/trend-bands.ts) | U | Inventory only. |
| `/api/v1/sustainability/trends` | [web/pages/api/v1/sustainability/trends.ts](../web/pages/api/v1/sustainability/trends.ts) | U | Inventory only. |
| `/api/v1/sustainability/upcoming/[playerId]` | [web/pages/api/v1/sustainability/upcoming/[playerId].ts](../web/pages/api/v1/sustainability/upcoming/[playerId].ts) | U | Inventory only. |
| `/api/v1/team/[seasonId]` | [web/pages/api/v1/team/[seasonId]/index.ts](../web/pages/api/v1/team/[seasonId]/index.ts) | U | Inventory only. |
| `/api/v1/transactions/ownership-snapshots` | [web/pages/api/v1/transactions/ownership-snapshots.ts](../web/pages/api/v1/transactions/ownership-snapshots.ts) | U | Inventory only. |
| `/api/v1/transactions/ownership-trends` | [web/pages/api/v1/transactions/ownership-trends.ts](../web/pages/api/v1/transactions/ownership-trends.ts) | U | Inventory only. |
| `/api/v1/trends/goalie-power` | [web/pages/api/v1/trends/goalie-power.ts](../web/pages/api/v1/trends/goalie-power.ts) | U | Inventory only. |
| `/api/v1/trends/player-trends` | [web/pages/api/v1/trends/player-trends.ts](../web/pages/api/v1/trends/player-trends.ts) | U | Inventory only. |
| `/api/v1/trends/skater-power` | [web/pages/api/v1/trends/skater-power.ts](../web/pages/api/v1/trends/skater-power.ts) | U | Inventory only. |
| `/api/v1/trends/team-ctpi` | [web/pages/api/v1/trends/team-ctpi.ts](../web/pages/api/v1/trends/team-ctpi.ts) | U | Inventory only. |
| `/api/v1/trends/team-power` | [web/pages/api/v1/trends/team-power.ts](../web/pages/api/v1/trends/team-power.ts) | U | Inventory only. |
| `/api/v1/trends/team-sos` | [web/pages/api/v1/trends/team-sos.ts](../web/pages/api/v1/trends/team-sos.ts) | U | Inventory only. |
| `/api/v1/underlying-stats/goalies` | [web/pages/api/v1/underlying-stats/goalies.ts](../web/pages/api/v1/underlying-stats/goalies.ts) | U | Inventory only. |
| `/api/v1/underlying-stats/goalies/[playerId]` | [web/pages/api/v1/underlying-stats/goalies/[playerId].ts](../web/pages/api/v1/underlying-stats/goalies/[playerId].ts) | U | Inventory only. |
| `/api/v1/underlying-stats/goalies/[playerId]/chart` | [web/pages/api/v1/underlying-stats/goalies/[playerId]/chart.ts](../web/pages/api/v1/underlying-stats/goalies/[playerId]/chart.ts) | U | Inventory only. |
| `/api/v1/underlying-stats/players` | [web/pages/api/v1/underlying-stats/players.ts](../web/pages/api/v1/underlying-stats/players.ts) | U | Inventory only. |
| `/api/v1/underlying-stats/players/[playerId]` | [web/pages/api/v1/underlying-stats/players/[playerId].ts](../web/pages/api/v1/underlying-stats/players/[playerId].ts) | U | Inventory only. |
| `/api/v1/underlying-stats/players/[playerId]/chart` | [web/pages/api/v1/underlying-stats/players/[playerId]/chart.ts](../web/pages/api/v1/underlying-stats/players/[playerId]/chart.ts) | U | Inventory only. |
| `/api/v1/underlying-stats/route-status` | [web/pages/api/v1/underlying-stats/route-status.ts](../web/pages/api/v1/underlying-stats/route-status.ts) | U | Inventory only. |
| `/api/v1/underlying-stats/teams` | [web/pages/api/v1/underlying-stats/teams.ts](../web/pages/api/v1/underlying-stats/teams.ts) | U | Inventory only. |
| `/api/v1/underlying-stats/xg` | [web/pages/api/v1/underlying-stats/xg.ts](../web/pages/api/v1/underlying-stats/xg.ts) | U | Inventory only. |
| `/api/v1/webhooks/on-new-line-combo` | [web/pages/api/v1/webhooks/on-new-line-combo.ts](../web/pages/api/v1/webhooks/on-new-line-combo.ts) | U | Inventory only. |
| `/api/v1/webhooks/patreon` | [web/pages/api/v1/webhooks/patreon.ts](../web/pages/api/v1/webhooks/patreon.ts) | U | Inventory only. |
| `/api/v1/webhooks/stripe` | [web/pages/api/v1/webhooks/stripe.ts](../web/pages/api/v1/webhooks/stripe.ts) | U | Inventory only. |
| `/api/v1/xg/operations` | [web/pages/api/v1/xg/operations.ts](../web/pages/api/v1/xg/operations.ts) | U | Inventory only. |

## Snapshot and handoff

Matrix/snapshot recorded at **2026-10-15T05:39:54.044Z**. Branch/HEAD identified above; concurrent workers may subsequently change these sources. The three assigned cloud findings describe their original baseline, not completion status.

Inventory SHA-256 (sorted page-file path + source SHA-256 pairs, joined by newlines): `770dcc176331c2b8ef3f771cd07d925f843b6eed79003ea8da2a8f5aa4ce7ad9`.

| Finding source at report snapshot | SHA-256 |
| --- | --- |
| `web/pages/auth/reset-password.tsx` | `3bbb729cec814c1390a4d34c913850711669a223d8f0c617182420416f80129c` |
| `web/pages/projections/index.tsx` | `481238b27f25506deed2f26dee73ff14c41477dc6fb06c0b6a641bef6695b1d2` |
| `web/pages/lines/[abbreviation].tsx` | `57e55a3a4539e90b94f7bef896b14bef111aa11d7e134117eb9b1c743b252b91` |
| `web/pages/statsPlaceholder.tsx` | `e0c7fd6ffc459157b706e3de625c665c7c129c3c6040ec4f5899e763f7c7e50f` |
| `web/styles/globals.css` | `96fdf5d08ac57bc418d860f56305bebaa1b91d84dc2f9ee411413c4a10c80d99` |
| `web/pages/news/index.module.scss` | `4e228206e335e00d829e3944a09cdedbae2ee9de275a5cc00e713a9b3fdde11f` |
| `web/pages/game/[gameId].tsx` | `44baeb56c0d160feeae4919c95c5352260e743e5cb1421a1753bee2834bc1737` |
| `web/hooks/useTeams.ts` | `551d63ba89aaca72d3a48d1c84f6acf74f548df48c11c7ede92bf8060e7e75a2` |
| `web/pages/teamStats.tsx` | `dacd0645ee2e8a228a039dadd6f6053fbd6337c836f480953e8b9576d4650e72` |
| `web/pages/underlying-stats/teamStats/index.tsx` | `6e59900da8e09bf6587bd17706d5f5affa1a518e53c9199869843c7dc97c4fd7` |
| `web/pages/underlying-stats/playerStats/playerStats.module.scss` | `ad0906d35a94e23c592ac31711b7f98a9cca38b4df10f065f1d8d04f059d0f6f` |
| `web/styles/_panel.scss` | `223544173d352cf418b949b581155cf68f59c8eab7deb5bdd3759ebaef6dccd1` |
| `web/components/Spinner/Spinner.tsx` | `271da3e92d07171f45cea12c09309da2483794c5b18431a5d7c413c807d68124` |
| `web/components/Spinner/Spinner.module.scss` | `516da47b323da38223735290ac651bbd9e7eb9c1a3e4085e4484289c85f4a568` |
| `web/pages/index.tsx` | `693b28a378935426864a01af658b306902b79bfd66d5cd7e96af2e34240dd4ef` |
| `web/pages/lines/index.tsx` | `0a964b47a1712ac92e75d613d1e8a639720a2fc18e881e7e6eaa477331815acc` |
| `web/components/LineCombinations/utilities.ts` | `42c378c844663b8b610ece6297f85800f5add13d5ae7ff2b2916792b17ee288b` |
| `web/lib/NHL/server/index.ts` | `ae799ea87c526c25c735e632c9da8b05c21ed14bcce0b26d37400f2419acc342` |
| `web/pages/stats/player/[playerId].tsx` | `255097f6289c49bc6e111bd0ba6c5705d29c21be8bdd57dcbe7d8321252d79f6` |
| `web/pages/_document.tsx` | `09929f353a013c70fdd897a5dfb35c9a8b6c2b39a6aaeb6f919328329bbae3a4` |
| `web/pages/_app.tsx` | `abfc13451894d44936f73d075b71fdb9a0360ad14375d6b6bc50c3795ce6d341` |
| `web/lib/apollo-client.js` | `396621f023f5842807ad149615fce3ebcbbe0eb07b73f3c202e537886bfc47c2` |
| `web/components/Comments/Comments.tsx` | `6bfb804739a9fbcc9e086539d2ccece16d053e71bbd6333a986246710ed45760` |
| `web/next.config.js` | `720ea61865b3a13734c7b3a38f334c219f6dc8ab0caa55223f5499046ff60e8c` |
| `web/pages/api/internal/forecast-calendar.test.ts` | `0aeb0fb9e64259203892e9d0597225b0ea2c0c15d02b75d0ac06c948176d4b26` |
| `web/pages/api/underlying-stats/landing.test.ts` | `a620ca9b8367408071595b140ef8cbaadcc74517b90b9716acb6ca53f46d9fb7` |
| `web/pages/api/v1/account/fantrax/player-data.test.ts` | `45c939a2c93297dceaf200a8f2556d73dde840a220a53d5f15eaa709d2ca38ad` |

Report validation: all 78 page rows and 354 API rows accounted for; all 486 local links resolved; the final whitespace check found no issues.

Only this report was created by the auditor. No application, task, configuration, manifest, lockfile or generated output was intentionally edited. The existing dirty worktree belongs to other ongoing work and was preserved.

Suggested next handoff: fix A01–A06 with focused state/keyboard/contrast fixtures, relocate the three test modules, then batch P01–P05 into a separately scoped optimization candidate. Respect the existing owners of the three cloud fixes and RSO/Game Grid. Complete fresh browser verification on the affected routes when Chromium can run; do not infer a sitewide pass from the 47 unit tests or historical screenshots.
