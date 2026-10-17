# RSO visual review correction — frozen resubmission

Local on `octoberBranch`; addresses both findings in `../independent-review.md`. This is a bounded correction of the existing redesign. No main/test/cache/date/provider/forecast source was edited. No compiler, server, install, credentials, live account/provider call, commit, push or deployment occurred.

## Changes

- P2: the points-supported and points-unavailable sections now share the selected card budget. Supported points remain first in their existing order, including zero and negative points; unavailable-points candidates use remaining slots in their existing AGP order and retain their distinct heading and missing-evidence warnings. Expansion adds the selected count once and remains available when the combined list exceeds the budget, even when neither section individually exceeds it. Selecting a different Show count starts a fresh budget; search, team and position filters reset expansion.
- LOW: Find & filter is at least 40px high/wide on desktop and 44px on mobile. Manage's aligned roster column is 40px on desktop and 44px on mobile, including the below-360px layout. Its target is separate from the adjacent protection label. The visible ellipsis and compact dashboard direction remain.
- Two parameterized mixed-coverage regressions use six supported/six unavailable and three supported/three unavailable candidates. They assert total counts, unchanged ordering, missing values and warnings, combined-list expansion, changing Show counts, and all filter resets.

## Exact ownership

| Path | SHA-256 |
| --- | --- |
| `web/components/RosterScheduleOptimizer/CandidateBrowser.tsx` | `a2a9e229bf44e761f06cea8e01884c3cd9d15f83f1198d7432c8054211d4d254` |
| `web/components/RosterScheduleOptimizer/CandidateBrowser.presentation.test.tsx` | `81bf909f6135074bf28a0aedaca603fdb60a56e0b506e885d2efbae79ffe3b98` |
| `web/components/RosterScheduleOptimizer/RosterScheduleOptimizer.module.scss` | `e63f1b56d3047ba7273c5c8a372d204ae8466579c4521d3bc240bab1853bd7cb` |

`candidate.sha256` pins these three owned paths; `owned-files.json` also pins their exact pre-correction baselines. `review-corrections.patch` is incremental against those baselines and passes reverse apply validation on the frozen current sources. Before copies are retained in `before/`.

`combined-rso.sha256` pins the current 28-file RSO visual/date/cache source set and is byte-identical to the refreshed `/tmp/rso-yahoo-eligibility-cache-20261013/combined-rso.sha256` requested by the owner. Its SHA-256 is `bf645584a66c789de44602930b778c6743028ae510c8a93f4529c5470f428c08`. Exactly the three paths above differ from that owner's cache-freeze receipt. Main remains `62e8342f337d7a1a106e14504fe688ddf739f733442482b9f1083274c34cbae7`; nearest main test remains `634b7428d566fcba65fc44c33e8c6b86bcc562d025c034fb688490f8df37d6c5`. Seven new cache paths and all cache/hydration/provider-pending logic are unchanged.

`visual-current.sha256` pins all 17 current presentation paths, including the later cache main/test increment. Original parent-directory `visual.patch`, `candidate.sha256`, `owned-files.json` and their screenshots remain historical first-pass evidence; they have not been silently rewritten. Apply neither historical patch over a newer tree without reconciling its stated baseline.

## Verification

- Five focused Vitest files: **208 passed, 0 failed**, including the cache/provider/date preservation checks in the current main test. New count regressions and prior card/tooltip checks pass. Full command and result are in `verification.json`, `tests.log` and `tests.json`.
- ESLint for corrected TSX/test: exit 0, zero errors/warnings (`lint.log`). Scoped whitespace check and reverse patch apply check pass.
- Fresh isolated real-worker browser: eight complete/partial/conditional/empty × 1440×900/390×844 contexts pass. All mobile scenarios also check 320px overflow. Desktop document is 1440×900; no document horizontal overflow or desktop vertical overflow. Normal mobile document scrolling remains. Existing tooltip, schedule/roster scrolling, dates, exact compared move/Undo, warning, and mobile workspace checks pass.
- New browser checks: Manage measures 40×40px at desktop, 44×44px at 390 and 320px, with 4px separation from protection. Find & filter measures 281.7×40px desktop, 308×44px mobile. Repeated keyboard Enter toggling and corner mouse/touch toggling leave protection unchanged. Measurements are in `browser-receipt.json`; assertions are retained in `after.cjs`.
- Viewed actual updated desktop, 390px roster, 320px roster and mobile candidate screenshots. Aligned columns remain readable; candidate and warning hierarchy is preserved. See `after-complete-1440.png`, `after-complete-390.png`, `after-complete-320.png` and `after-candidates-390.png`.

The fixture bundles the actual page/Container/ClientOnly/components/SCSS and actual planning/candidate workers. Fresh synthetic storage/auth/API/calendar, substituted header/Next image/metadata and stripped remote font imports remain explicit boundaries. External requests are aborted; only loopback HTML is browser-fulfilled and application GET reads are synthetic. Zero external/production/account/provider requests. Manual fixture renders do not certify genuine Yahoo qualification, provider continuity or production fonts/images. The current main provider regressions are unit checks; the separate cache-owner browser receipt remains separately scoped.

The first browser launch hit the usual sandbox Chromium Mach-port restriction and used approved escalation. Moving the fixture entry into this repo's artifact directory exposed an ancestor React19 versus app React18 resolution mismatch; the isolated bundler now pins React imports to installed `web/node_modules` and guarantees browser cleanup. No application dependencies/source were changed for that harness issue. Final run exits 0 with zero page errors.

## Remaining gates

Resubmitted for independent review of both corrected findings. FORGE (`01a135c8-567b-71d2-b610-6b78f3cc40d7`) remains the sole next full TypeScript owner; no compiler ran or is planned by this visual consumer. The cache owner and compiler owner receive the new pins. Independent approval and the combined full compiler are pending. Updated Library reference pixels, genuine provider/account behavior and production header/font/image metrics retain the original review limitations.
