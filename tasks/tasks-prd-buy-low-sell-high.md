## Relevant Files

- `tasks/TASKS/prd-buy-low-sell-high.md` - Product requirements for the distinct market page.
- `tasks/TASKS/prd-sko-element.md` - Shared interpretation contract and sustainability dependencies.
- `web/pages/buyLowSellHigh.js` - Existing retained page; reconcile and deliberately replace or redirect.
- `web/pages/trends/index.tsx` - Existing visual reference; verify current local path and reusable components before importing.
- `web/lib/buyLowSellHigh/` (new proposed directory) - Pure market/watchlist/trade view models and local persistence adapter; finalize filenames after checking repository conventions.
- Tests alongside the new pure modules and the nearest page test location - Trade arithmetic, missingness, shared-contract parity and interaction regressions.

### Notes

- Follow the canonical checkout and current AGENTS.md. This task list does not authorize application implementation, production writes, deployment or a new worktree by itself.
- Current FORGE/RSO/Start Chart release work retains priority. Independent fixture work can proceed when capacity and file ownership allow; real integration waits for supported shared inputs.
- Task IDs are references, not a fully serial execution order. The Sko Element owner owns the shared interpretation contract; this owner must not duplicate or edit it concurrently.
- Use the existing Vitest and page-test conventions. Confirm exact test commands against the current package manifest before execution. No application suite is required merely to integrate these Markdown files.
- The source audit covers commit a8f58de6178e282acd3a71851c66f4a56b119f14. Review current diff before changing runtime files.
- Initial scope includes forwards, defensemen and VuDu goalies; partial genuine coverage must remain explicit.

## Tasks

- [ ] 1.0 Reconcile the market-page boundary and shared contract
  - [x] 1.1 Inspect current page, nearest tests and local diff; record keep/replace decisions and protect unrelated work. Confirm the old route's compatibility behavior. _S-16 2026-10-18: legacy page reconciled and unchanged; see artifact `sko-blsh-lane-2026-10-18`._
  - [x] 1.2 Agree on the Sko Element interpretation record, permitted forecast uses, unavailable states and score direction. Record exact dependency/version and separate file ownership. _S-16 2026-10-18: consumes `sko-interpretation-v0.1` read-only._
  - [x] 1.3 Define initial route/component layout using the existing design system; identify the fixture-only design checkpoint and later real-data acceptance gate. _S-16 2026-10-18: fixture preview at `/buy-low-sell-high/preview` (404 in production builds)._
- [ ] 2.0 Implement pure watchlist and comparison view models
  - [x] 2.1 Map shared records into rebound/cooling rows, deterministic ranking and evidence explanations without inventing price or probabilities. Include F/D classes and VuDu workload/efficiency. _S-16 2026-10-18: `web/lib/buyLowSellHigh/market.ts` `buildWatchlists`._
  - [ ] 2.2 Implement 5/10/20 scheduled-team-game selection, actual date-span labels and expected appearances. Require explicit common-date inputs for date-aligned comparisons. _S-16 2026-10-18: 5/10/20 and per-player date spans done; expected appearances not shown on this page; no common-date mode offered._
  - [x] 2.3 Implement canonical Give/Receive selection validation and category totals/net differences. Handle duplicate identities, empty sides, missing heads and incompatible bases/versions explicitly. _S-16 2026-10-18: `trade.ts` validation._
  - [x] 2.4 Apply supplied league points weights; preserve category vectors and proper lower-is-better display. Aggregate goalie ratios from counts/minutes and label limitations. _S-16 2026-10-18: weights, lower-is-better and pooled goalie ratios._
  - [x] 2.5 Add typed market-reference metadata and comparability checks. Keep raw offer comparisons distinct from RSO startable net value; never substitute ownership for price. _S-16 2026-10-18: `compareMarketReference`._
  - [x] 2.6 Test arithmetic, sign, unavailable handling and parity with the shared interpretation using fixed fixtures. Test that changing a quote never changes a forecast, that start/appearance probabilities are not applied twice, and that unsupported joint uncertainty is withheld. _S-16 2026-10-18: `market.test.ts`, `trade.test.ts`._
- [ ] 3.0 Build the separate dashboard and manual trade workspace
  - [ ] 3.1 Build compact filters, Rebound/Cooling views, sortable candidate rows and a detail panel with opportunity, volatility, confidence and observed duration. _S-16 2026-10-18: filters, Rebound/Cooling and rows done; per-player detail panel and observed duration column not built on this page._
  - [x] 3.2 Build the Give/Receive comparison flow with scoring selection, totals/net changes, uneven-roster and incomplete-input warnings. Keep unsupported overall recommendations absent. _S-16 2026-10-18: Give/Receive flow with issues and no unsupported winner._
  - [x] 3.3 Add versioned, isolated device-local watchlists and draft comparisons with remove/reset controls and safe migration/failure behavior. _S-16 2026-10-18: `storage.ts` with reset and corrupt-data recovery._
  - [ ] 3.4 Create mobile list/detail/trade layouts, keyboard/touch-accessible explanation controls and visible essential limitations. Capture desktop/mobile fixture screenshots for owner review. _S-16 2026-10-18: keyboard-accessible controls tested; screenshots not taken (no dev servers in sprint)._
- [ ] 4.0 Connect supported records and verify end-to-end behavior
  - [ ] 4.1 After shared serving is ready, replace fixture inputs with the existing batched reader. Preserve as-of/model/source identity, allowed uses, freshness and missingness; avoid per-player external fetches.
  - [ ] 4.2 Verify one genuine supported skater and goalie trace and both-page parity. Report unsupported coverage separately rather than marking the whole feature complete.
  - [ ] 4.3 Verify loading, stale/partial, invalid-offer and persistence-isolation behavior with focused tests and actual browser screenshots. Have an independent reviewer check statistical semantics and UX.
  - [ ] 4.4 Deliver the exact diff, checks, limitations, route decision and release proposal. Deployment remains a separate authorized action.
- [ ] 5.0 Evaluate later market and roster-aware enhancements separately
  - [ ] 5.1 Propose a rights-reviewed, timestamped market reference only if useful; define comparability and stale-source behavior before integration.
  - [ ] 5.2 Specify optional RSO net-startable trade evaluation with complete roster/rules/schedule inputs and replacement consequences. Do not label raw production totals as this result.
  - [ ] 5.3 Predeclare decision-value evaluation and false-alert analysis before promoting stronger buy/sell or duration claims. Use the existing exposure register and preserve closed evaluation data.

Parallel work: after 1.2, pure view models (2.0) and fixture UI/local persistence (3.0) may proceed with distinct files. Shared-core work remains with the Sko Element owner. Integration (4.0) waits for reviewed outputs from both. Phase 5 is optional later work and does not delay the approved manual first release.
