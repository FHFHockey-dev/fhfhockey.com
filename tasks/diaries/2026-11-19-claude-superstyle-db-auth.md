# /superstyle: /db admin pages + /auth

- Scope · /superstyle loop on web/pages/db/* (8 routes) and web/pages/auth/* (3 routes). Local only, octoberBranch, no push.
- Where · pages under web/pages/db, web/pages/auth; modules player-aliases.module.scss, tweet-pattern-review.module.scss, Auth/Callback/ResetPassword.module.scss, styles/RouteRunner.module.scss; gate components/Admin/AdminPageGate.tsx. Backlog rows go in tasks/artifacts/Toenail-Audit-Visual-Enhancements.md.
- Tooling · Axe MCP failed to connect; using superstyle scripts/axe.cjs. Every /db page is behind AdminPageGate, so captures need a signed-in admin session (TJ signs in himself in a headed browser; session file stays in the scratchpad only, deleted at the end). Captures block non-GET requests: the dev server talks to production Supabase.
- Lanes · player-aliases.tsx last changed in c6eae4db5 (11-19, Codex occurrence-review / tweet-roster-name-inference lanes; both work committed). Touch it with markup/SCSS only; re-check git status before each edit.
- Kickoff (TJ) · all 11 routes, named first (player-aliases, runner, auth ×3, rest of /db); default pass order; fix every severity; player-aliases.tsx markup/SCSS only. TJ signed in himself via scripts/login.cjs; skill _lib.cjs patched (STORAGE_STATE + CONTEXT_SETUP, non-GET blocked); original saved in scratchpad.
- Pass 0 · two toenails fixed and approved: alias header 4px top border on 10px radius → ::after rail (::before taken by the intense-panel sheen at .35 opacity); tweet-review .queueItemSelected 3px inset shadow on 6px → 4px ::before rail. All other pages clean at 390/1440 (rendered + static). Nested-corner radii not measured in pass 0; checked in pass 1.
- Gotcha · toenails.cjs missed the inset stripe because tweet-review queue cards render collapsed (flex children with overflow:hidden shrink to 0). Queue is hidden at 390.
- Pass 0 closed uncommitted (TJ: straight to pass 1).
- Pass 1 (in progress) · tweet-pattern-review: queue collapse, control bar row/overflow, badge removal, assignments width, composer overlap + pinned footer, phone order. Header link centring applied, not yet shown. Full-page captures of all pages running (p1-*.png in scratchpad).
- Gotcha · tweet-review is a 10×10 viewport-height grid; at 1440×900 rows are ~56px, so anything with fixed content height clips. Live queue data changes between shots.
- Pass 1 cont. · TJ rule: buttons follow fhfh-styles §9.4 → new `@mixin button-tint` in web/styles/vars.scss (2px ring, $button-tint, blue Train One xxs labels); primary = opaque + white; danger = red ring. Applied: tweet-review (.btn/.btnPrimary/.btnIgnore, fields 32px desktop / 36px phone, phone arrows row), player-aliases (className hooks primaryAction/dangerAction, fields 32px, review notes block, decision row with search+match beside notes ≥1100px, phone overflow fix), runner (buttons, URL field 32px, segments on toggle rule, job meta two lines, auto-open newest/active job + test).
- Tests · player-aliases 19/19, runner 9/9 (new auto-open test), admin-gate 14/14. Typecheck not yet run.
- Pass 1 cont. · auth ×3: column layout (title was in the gutter; phone cards crushed ~20px), outlined page titles, flat panels, duplicate headings/eyebrows removed, AuthForm showFallbackLink prop (hidden on /auth), buttons/tabs/inputs on rules (shared AuthForm → header modal too). /db: debug Snackbar button removed, 90% cap, responsive grid (was 3 cols on phones), standard panel cards (no banners/multicolour borders), header like runner, buttons/fields via new styles/_admin-mui.scss mixins (admin-mui-controls, admin-mui-menu). upsert-projections: dark panels, copy fix '&aposn&apos', menus dark.
- Checks · typecheck exit 0 (before /db work); db index 1/1, runner 9/9, aliases 19/19, admin-gate 14/14.
- Pass 1 cont. · season editor (4-col form, checkbox, rule controls, flat surface), forecast modules on brand tokens (TJ: align blues; shared module restyles public /player-forecasts), beat-reporter buttons on rule 32px.
- Pass 1 closing · tests 94/94 across __tests__/pages/db, components/Admin, TweetSwipeTrainer; typecheck running. Backlog rows added (open Low/Medium for later passes).

## Coverage ledger

| page \ pass | 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 |
|---|---|---|---|---|---|---|---|---|
| /db/player-aliases | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | n/a |
| /db/runner | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| /auth | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | n/a |
| /auth/callback | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | n/a |
| /auth/reset-password | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | n/a |
| /db | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | n/a |
| /db/tweet-pattern-review | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | n/a |
| /db/upsert-projections | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | n/a |
| /db/player-forecast-review | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | n/a |
| /db/player-forecast-season-editor | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | n/a |
| /db/beat-reporter-review | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |

- Pass 1 closed · TJ approved commit (local, pathspec, no push). Next · pass 2 (design system): private literals → tokens (season editor/forecast radii, auth/aliases literals, RouteRunner, tweet-review).
- Pass 2 · auth literals → tokens (signed-in actions: rule buttons, 3 in a row, Sign Out danger, duplicate Reset removed), forecast radii/state literals → tokens, tweet-review pills → $radius-control, /db dead card sx + CardMedia removed (render unchanged). Typecheck exit 0. Not committed (TJ: straight to pass 3).
- Next · pass 3: axe (scripts/axe.cjs; Axe MCP down) at 390/1440 on all 11 routes, focus sweep.
- Pass 3 · axe 0 violations on all 11 routes at 390/1440 (was 6 critical select-name, 1 critical label, 3 serious scrollable-region, 5 moderate landmark/heading). Field wrappers → <label>; tweet review <main>; upsert h2/h3 + dropzone label; focusable terminal + season table; all focus rings blue (§9.4); MUI focus ring + ripple off in _admin-mui; copy icon button inside runner terminal (TJ). focus.cjs: /db MUI inputs flagged = false positive (ring on outer box). Tests 94/94, typecheck 0.
- Next · pass 4 copy: auth reset/callback dev copy, '1 steps', aliases '·' + Open source tweet link, /db card copy (backticks, 'Supabase').
- Pass 4 · auth callback/reset copy rewritten (no Supabase/OAuth/token jargon; 'Let's try that again'; Sign in again primary on failure; reset link → forgot-password form); Reset Local Auth restored in signed-in panel (pass-2 removal broke __tests__/pages/auth/index.test.tsx — it is the stale-session recovery path); runner '1 step'; aliases meta separator + source link; /db table names as <code>. Auth tests 21/21.
- Gotcha · run __tests__/pages/auth after touching auth pages; the db test set doesn't cover them.
- Pass 5 (polish) · direction: press box / exact, quick, rink-side; signature = outlined caps titles + Train One button labels. Fixed: auth divider gradient → hairline; runner sweep reduced-motion; tweet queue meta plain case; auth labels 600/secondary. Uncommitted (TJ: straight to pass 6).
- Next · pass 6 frontend design: composition/type scale; candidate memorable element on /db = table counts as figures.
- Pass 6 (design: composition, one memorable element) · /db: table counts as figures (20px numbers, unit caption, season via formatSeason "2026-27"); runner: duplicate empty-state line removed (job detail charts/terminal already the memorable element); /auth: phone tabs one row, repeated "Sign in" heading removed, title "Account"; callback tab title "Sign in | FHFHockey"; all auth pages top-anchored, one 640px column; reset heading follows state (error "Let's try that again", success "Password saved"), "Return to site"; aliases action row wraps (Ignore overlapped review notes, High); forecast hero h1 on display title rule (shared module → public /player-forecasts too, TJ approved); upsert gets the /db header (eyebrow, title, Back to /db). Beat reporter + tweet review: no change (confidence/team bars, highlighted tweet already carry the page). Typecheck exit 0; db+auth tests 64/64.
- Next · pass 7 dataviz: runner charts, beat-reporter team bars, forecast chart literals (.up/.down/.actual/.interval/.grid/.axis/.wick in PlayerForecasts.module.scss).
- Pass 7 (dataviz) · forecast candlestick (PlayerForecasts.module.scss, shared with public /player-forecasts): literals → tokens; up = primary 95% mix, down = danger 90% mix (validator: in dark band, CVD ΔE 13.0 vs old 7.9), neutral actual dot with surface ring, neutral interval, chart grid/tick tokens. Shown as a static mock (live chart needs local Supabase). Runner step-duration: $chart-grid-color value, dashed avg ReferenceLine labelled outside, above-average bars in primary, rest muted #166d8b (ΔE 17, ≥3:1). Beat-reporter team bars: inferred team(s) primary, others muted, rounded data ends. Review/season-editor/aliases/auth/tweet/upsert/db: no charts (n/a).
- Next · pass 8 final sweep: axe 11 routes × 2 widths (background), focus, toenails, full captures, slop-audit; resolve ledger; commit question (passes 5–8 uncommitted).

- Pass 8 (final sweep, partial) · axe 0 violations on all 11 routes at 390/1440; toenails.cjs clean on all 11 at both widths; focus.cjs: every stop has an indicator (/db ×8, /auth, /auth/reset-password); scss-check pure on all 13 touched modules. Typecheck exit 0, db+auth tests 64/64 (after pass 7).
- Stopped (usage limit) · not done: pass-8 full-page captures review at 390/1440, slop-audit re-run, commit of passes 5–8 (all uncommitted, nothing pushed). admin-state.json deleted; TJ must sign in again (scripts/login.cjs) for any further /db captures. Skill _lib.cjs still patched (original at scratchpad _lib.cjs.orig) — decide keep/restore.
- Pass 8 closed · full-page captures of all 11 routes at 390/1440 reviewed (TJ re-signed in; session deleted after): no new layout breaks, overflow or regressions. slop-audit: remaining hits are brand (Train One button labels, outlined titles, eyebrows, status pills) or tweet content (emoji in queue items/context, user data). Ledger complete (no "–").
- Next · commit passes 5–8 on TJ's approval; restore or keep skill _lib.cjs patch.
