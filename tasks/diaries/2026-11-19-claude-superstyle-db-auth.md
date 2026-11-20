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
| /db/player-aliases | ✓ | ✓ | ✓ | ✓ | ✓ | | | n/a |
| /db/runner | ✓ | ✓ | ✓ | ✓ | ✓ | | | |
| /auth | ✓ | ✓ | ✓ | ✓ | ✓ | | | n/a |
| /auth/callback | ✓ | ✓ | ✓ | ✓ | ✓ | | | n/a |
| /auth/reset-password | ✓ | ✓ | ✓ | ✓ | ✓ | | | n/a |
| /db | ✓ | ✓ | ✓ | ✓ | ✓ | | | n/a |
| /db/tweet-pattern-review | ✓ | ✓ | ✓ | ✓ | ✓ | | | n/a |
| /db/upsert-projections | ✓ | ✓ | ✓ | ✓ | ✓ | | | n/a |
| /db/player-forecast-review | ✓ | ✓ | ✓ | ✓ | ✓ | | | n/a |
| /db/player-forecast-season-editor | ✓ | ✓ | ✓ | ✓ | ✓ | | | n/a |
| /db/beat-reporter-review | ✓ | ✓ | ✓ | ✓ | ✓ | | | n/a |

- Pass 1 closed · TJ approved commit (local, pathspec, no push). Next · pass 2 (design system): private literals → tokens (season editor/forecast radii, auth/aliases literals, RouteRunner, tweet-review).
- Pass 2 · auth literals → tokens (signed-in actions: rule buttons, 3 in a row, Sign Out danger, duplicate Reset removed), forecast radii/state literals → tokens, tweet-review pills → $radius-control, /db dead card sx + CardMedia removed (render unchanged). Typecheck exit 0. Not committed (TJ: straight to pass 3).
- Next · pass 3: axe (scripts/axe.cjs; Axe MCP down) at 390/1440 on all 11 routes, focus sweep.
- Pass 3 · axe 0 violations on all 11 routes at 390/1440 (was 6 critical select-name, 1 critical label, 3 serious scrollable-region, 5 moderate landmark/heading). Field wrappers → <label>; tweet review <main>; upsert h2/h3 + dropzone label; focusable terminal + season table; all focus rings blue (§9.4); MUI focus ring + ripple off in _admin-mui; copy icon button inside runner terminal (TJ). focus.cjs: /db MUI inputs flagged = false positive (ring on outer box). Tests 94/94, typecheck 0.
- Next · pass 4 copy: auth reset/callback dev copy, '1 steps', aliases '·' + Open source tweet link, /db card copy (backticks, 'Supabase').
- Pass 4 · auth callback/reset copy rewritten (no Supabase/OAuth/token jargon; 'Let's try that again'; Sign in again primary on failure; reset link → forgot-password form); Reset Local Auth restored in signed-in panel (pass-2 removal broke __tests__/pages/auth/index.test.tsx — it is the stale-session recovery path); runner '1 step'; aliases meta separator + source link; /db table names as <code>. Auth tests 21/21.
- Gotcha · run __tests__/pages/auth after touching auth pages; the db test set doesn't cover them.
