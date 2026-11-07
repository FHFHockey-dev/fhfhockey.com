# Lines pages: /superstyle audit (2026-11-06)

Scope: `/lines`, `/lines/[abbreviation]` (sampled `/lines/EDM`), `/lines/line-combo/[gameId]` (sampled `2026020252`, VGK@DET), at 390 and 1440.

**Audit only.** TJ chose (pop-up, 2026-11-06) not to edit these pages while the Lines IGA Chef lane (`tasks/diaries/2026-11-06-claude-lines-iga-chef.md`) restructures them. This file is design input for that lane: fold the High rows into the restructure, and run `/superstyle` on the result once it lands.

Style law: `tasks/TASKS/rules/fhfh-styles.md` (wins) and `brand-style-cheat-sheet.md`. The Lines pages are a §6.2 **data page**: compact title and scope, connected controls, then the primary data surface.

Owner key: **L** = Lines lane (`web/pages/lines/*`, `web/components/LineCombinations/*`); **S** = shared component (fixing it changes other pages too); **H** = site chrome.

Evidence came from the local axe-core scan, `focus.cjs`, `toenails.cjs`, `slop-audit.cjs`, `copy-extract.cjs` and full-page captures against `:3000`. At capture time `/api/v1/lines/projected` returned `enabled:false`, so the projected-lineup block showed its disabled state.

## High: broken, misleading or unreadable

| page | element (file) | finding and suggested fix | sev | owner |
|---|---|---|---|---|
| /lines/[team] | page order (`pages/lines/[abbreviation].tsx`) | The lineup, which is the page's purpose, starts about 1,000px down at 1440 and 2,600px down on phones. Two full shared-ice matrices sit above it, and the second is the *last opponent* (Ducks on the EDM page), which reads as a mistake. Put lines first, then PP units, then the observed matrix (own team only, opponent behind a toggle or disclosure). | High | L |
| all three | "Lineup publishing is disabled." (`components/LineCombinations/ProjectedLineups.tsx`) | Internal feature-flag state shown to fans, as unstyled body text squeezed between blocks (index: between the logo grid and the tables). When disabled, render nothing (or a quiet "Projected lines return closer to puck drop" note inside a panel). | High | L |
| /lines/[team] 390 | "Lineup publishing…" + "Observed shared ice time" h2 | Both sit flush against the left screen edge (0px gutter) while the title and select above are indented. They render outside the padded container. Move them inside the page gutter. | High | L |
| /lines/[team] | sweater numbers (`LineCombinations/PlayerCard`) | axe: 16 contrast failures. Team-colour `#fc4c02` digits on `#763325` measure 2.71:1 (needs 4.5:1). Pick per-team ink with `contrast()` from `lib/socialShare/teamNeon.ts`, the same fix as the Team HQ bands (first team colour ≥4.5:1, else white or `#101214`). Check all 32 teams. | High | L |
| /lines/[team] | duplicate `<main>` (`components/Layout/Container` used twice) | axe: landmark-no-duplicate-main, main-is-top-level, landmark-unique. The page nests `Container` (which renders `<main>`) inside another `Container` for `.mainContent`. Use a plain `div`/`section` for the inner one. | High | L (uses S) |
| /lines/line-combo/[gameId] | page shell (`pages/lines/line-combo/[gameId].tsx`) | No h1, no page title, no NextSeo, no game context (teams, date, score). Inline `padding: 24` instead of the 90% centred workspace. Empty `getServerSideProps` forces SSR for nothing. Use the standard `Container` + `PageTitle` shell with "DET vs VGK · Nov 5" context. Note: this route is also the Discord screenshot target (`on-new-line-combo.ts`, `?isScreenshot=1`), so check that render too. | High | L |

## Medium: hierarchy, consistency, clarity

| page | element (file) | finding and suggested fix | sev | owner |
|---|---|---|---|---|
| /lines vs /lines/[team] | page title (`PageTitle`) | The same h1 "NHL LINE COMBINATIONS" renders in two styles: large and untracked on `/lines`, small and very widely tracked on `/lines/[team]` (the `.title` override). Pick one (the index style matches the other toenail pages). | Medium | L |
| /lines | logo grid and player panel (`styles/Lines.module.scss`) | 2px solid white borders (`$border-size: 2px solid white`) are heavier than the system's `$border-subtle` panels, and the player panel has no top edge, so the notice line splits one box. Use standard panels with a `$space-*` gap. | Medium | L |
| /lines/[team] | team header and main panel (`[abbreviation].module.scss` .header/.mainContent) | 135°/140° gradient panels with shadows, which fhfh-styles §2.2 forbids as a default. The inline `backgroundColor: color.primary` sits under an 85%/75%-opaque gradient image, so the team colour barely shows. Use a flat `$surface-1` panel with a §2.7 team-colour rail. | Medium | L |
| /lines/[team] | lineup grid width at 1440 | The forward cards fill about 55% of the panel, and "Recent Line Share" is a short sidebar, which leaves a large empty area right of the D pairs and goalies. Let D/G use the full row, or move Line Share under the forwards. | Medium | L |
| /lines/[team] 390 | Line 1 card row | When a name wraps ("Nugent-Hopkins"), its card is taller and the other two leave a black gap at the bottom of the row. Stretch cards to equal height (`align-items: stretch` + card `height: 100%`). | Medium | L |
| /lines/[team] | power play units (`components/PowerPlayCombos`) | "Latest groupings from game #2026020260" leaks a raw game id (use "from Nov 4 vs ANA"). Chips are tracked mono caps; "UNIT 1 5 skaters" mixes case and runs the numbers together ("Unit 1 · 5 skaters"). Bouchard's chip is blue-tinted with no legend saying why. | Medium | S |
| /lines/[team] | goalie cards | The backup with no games shows "#0", "0-0-0", ".000", "0.00". Show "—" or "No starts yet" instead of zeros that look like real stats, and hide the jersey number when it's unknown. | Medium | L |
| /lines/line-combo + /lines/[team] | shared-ice matrices (`components/LinemateMatrix`) | No legend: blue (F-F), amber (F-D) and orange (D-D) hues and their intensity are unexplained. Add a one-line key ("Darker = less shared 5v5 time; blue forwards, orange defence pairs"), and give the matrix `role="img"` + `aria-label`. Name labels truncate ("M. Brandseg…", "R. Nugent-H…"). The "Line Combination" mode select is centred while the h2 is left-aligned. | Medium | S |
| /lines/[team] | team selectors (`components/TeamSelect`) | focus.cjs: no focus indicator on 32 logo buttons and the prev/next arrows. Add the 2px `$primary-color` ring used elsewhere. The page also has a second team `<select>`, so there are two team pickers. | Medium | S |
| /lines | "SHOW ALL (121)" (`pages/lines/index.tsx`) | No focus indicator (focus.cjs). Also tracked all-caps button copy: use "Show all 121" in sentence case. | Medium | L |
| /lines | "Page refreshed: 0s ago" | axe: 3.74:1 (mobile) / 3.62:1 (desktop), set by `opacity: 0.4`. It's also a link that opens /shiftChart in a new tab, which nothing signals. Make it plain `$text-secondary` text, not a link. | Medium | L |
| /lines/[team] | heading order | axe heading-order ×9: `Line` titles are h4 under h2, the matrix team name is h4, and the player name h3 + "LAST 10 GP" h2 inside cards inverts the order. Use h3 for line titles and no headings inside cards. | Medium | L |
| /lines/[team] | logo download (`Header` in `[abbreviation].tsx`) | "Download image" is hidden behind a click on the team logo, with no visible affordance. `console.log("downloading...")` ships. The fallback date `new Date(2022, 10, 1)` would show "Updated 4 years ago". Add a visible "Save image" button and drop the log. | Medium | L |

## Low: polish and copy

| page | element (file) | finding and suggested fix | sev | owner |
|---|---|---|---|---|
| /lines | "N/A ▸ L1" | Jargon for a player new to the lineup. Use "New ▸ L1" (and "L4 ▸ Out" for demotions). | Low | L |
| /lines | row links | Each row has two links to the same URL (the name and the chevron), so keyboard users hit two tab stops. Make the whole row one link. Tooltips "go to player details" are lowercase; use "Open player chart". | Low | L |
| /lines | arrow images | Alt text "promote to"/"demote to" reads as "L3 promote to L1". Use `alt=""` and a visually hidden "moved from L3 to L1". The title icons are PNG/SVG arrows with alt "up"/"down". Make them decorative. | Low | L |
| /lines | h2 font (`styles/Lines.module.scss`) | `font-family: Roboto Condensed` hardcoded, and 8 colour literals (`#323232`, `rgba(255,255,255,.5)` …). Map them to `$font-family-condensed` and `$surface-*`/`$border-*` tokens. | Low | L |
| /lines/[team] | category and line labels | "FORWARDS", "LINE 1", "1ST PAIR" in tracked caps (0.18em) and the vertical rotated line labels are fine as panel labels. The team name h2 "EDMONTON OILERS" in tracked orange caps wraps to two lines on phones; consider the outlined display face untracked. | Low | L |
| /lines/[team] | player cards | Heavy text-shadow on 51 stat values and 16 numbers (slop-audit). Drop the shadow; the navy fill already gives contrast. | Low | L |
| /lines/[team] | Line Share bars (`LineShareBars.module.scss`) | Gradient fills (95%→45%) on 4px bars read as fading data. Use solid `$primary-color` / `$success-color`. Labels say "Timeshare" / "Goal Share" (inconsistent compounding); use "Ice time share" / "Goal share". | Low | L |
| /lines/[team] | "LAST 10 GP" eyebrow inside each card | Repeated on 20 cards. State it once in the section header ("Last 10 games") and drop it from the cards. | Low | L |
| /lines/[team] | `ProjectedLineups.module.scss` | 8 hex literals (`#ffffff26`, `#bfbfbf`, `#292929`, `#e0c76d` focus ring …). Map them to tokens; the yellow focus ring differs from the site's blue ring. | Low | L |
| /lines/[team] | landmark `region` | `.teamSelect` logo strip sits outside every landmark. Wrap it in `<nav aria-label="Teams">`. | Low | L |
| all (390) | site bottom nav "Tools" active (`components/Layout/Header`) | ~~toenails.cjs: 3px top rule against a 6px radius. Every phone page has it, not only Lines.~~ Fixed: `border-radius: 3px 3px 6px 6px` (TJ approved 2026-11-06); toenail scan on /lines and /stats at 390 now clean. | Done | H |

## Not verified
- The projected-lineup *enabled* state (feature off at capture), loading and error states.
- On phones, the demotion arrows, chevrons and title icon didn't render in the full-page capture. These are probably lazy `next/legacy/image` loads below the fold, not a bug. Recheck in a scrolled capture.
- 31 other teams. Contrast and name-wrap findings were sampled on EDM only.

## Re-audit and edit pass (2026-11-07)

Diary: `tasks/diaries/2026-11-07-claude-lines-superstyle.md`. Scanned on the isolated dev server (:3110). The enabled state uses Lane B's synthetic snapshot fixture via Playwright interception; production still returns `enabled:false` until `LINES_ENTRY_SERVING_ENABLED` (P4) is flipped.

**Status of the 11-06 rows.** Lanes B and C (master #413) closed every High, Medium and Low row above. Each was re-checked in code and in captures. Two leftovers remain on `/lines/line-combo/[gameId]`: name truncation and the centred mode select. Lane C fixed both on the team page only; they're tracked as N1 below.

Baseline scans:
- axe: 0 violations on all 3 routes at 390/1440, plus the fixture state (/lines/TBL, line-combo/2026020150).
- toenails: clean everywhere.
- focus: every stop has an indicator.

New findings:

| page | element (file) | finding and suggested fix | sev | pass |
|---|---|---|---|---|
| /lines/line-combo | matrix props (`pages/lines/line-combo/[gameId].tsx`) | ~~N1. Names truncate; controls centred under a left h2; grids unlabelled.~~ Passes `wideNames labelGrid controlsAlign="start"`. Only "Brandsegg-Nygård" still clips. axe 0 → 0. | Done | 1 |
| /lines/line-combo 1440 | matrix layout | ~~N2. Matrices stacked in one centred column at 1440.~~ New opt-in `sideBySide` prop on LinemateMatrix (default off; /shiftChart and Replay unchanged), passed by line-combo: side by side from 1024px. Page 3344 → 2240px tall. | Done | 1 |
| /lines/[team] | gap between lineup and power play (`[abbreviation].module.scss` .lineup; `PowerPlayCombos.module.scss` .wrapper) | ~~N3. Dark band and 40px gap above the PP panel.~~ `.lineup` fill removed; PP margin zeroed on this page. Gap is now 16px. | Done | 1 |
| /lines/[team] | player card frames (`Line.module.scss`) | ~~N4. 2px pure-white card frames; white strip and dividers on phones.~~ Now `$border-control` (1px #6b6f75); the team fill is kept. | Done | 2 |
| /lines/[team] | card stat labels (`PlayerCard.module.scss`) | ~~N5. 8px card labels (6.6px on the goalie LAST 10/SEASON labels); values at faux 900.~~ Labels `$font-size-xxs` (10px); values 700, -0.02em; HIT/BLK on phones. Pass-3 axe 0 and focus clean on all pages at both viewports. | Done | 3 |
| /lines/[team] | Recent line share (`LineShareBars.module.scss/.tsx`) | ~~N6. Panel nested inside the lines panel; oversized description on phones.~~ Section with a `$border-soft` divider; title `$font-size-md`/700, description `$font-size-sm` secondary. | Done | 1 |
| /lines/[team] | Line share copy (`LineShareBars.tsx`) | ~~N7. "Last tracked sample share…" is unclear.~~ Now "Each forward line's share of ice time and goals over the last 10 games." | Done | 4 |
| /lines/[team] | literals (`CategoryTitle.module.scss`, `Line.module.scss`) | ~~N8. White literals, sub-pixel hairlines, px spacing.~~ Hairlines are 1px `$border-control-color`; LINE/PAIR labels use `$text-secondary`; spacing is on `$space-*`/`$mobile-space-*`. | Done | 2 |
| /lines | news flag chip (`styles/Lines.module.scss`) | N9. Tracked caps at 0.08em on content-level chips, with literal `999px`, `0.65rem` and `2px` padding. Use `$radius-pill`, `$font-size-xxs` and the letter-spacing token. | Low | 5 |
| /lines/[team] | team logo strip (`TeamSelect.module.scss`, shared with /drm) | N10. A 20px white drop-shadow glow on hover/active logos (§2.6 "glow on every … active state"), plus rgba white literals. Replace the glow with a `$primary-color` underline or ring. Shared component: check /drm too. | Low | 5 |
| /lines/[team] | Line share bar tracks (`LineShareBars.module.scss`) | N11. The bar track `rgba($background-dark,.65)` is invisible on `$surface-1`, so bar length has no 100% reference. Add a visible track (or a 0–100 scale) and swap the literal `999px` for `$radius-pill`. | Low | 7 |
| /lines/[team] | Save image bg (`[abbreviation].tsx`) | ~~N12. `#1a1c21` duplicated beside the PANEL_SURFACE constant.~~ Uses PANEL_SURFACE. | Done | 2 |
| /lines/[team] | Power play units (`PowerPlayCombos.tsx/.module.scss`, `LineCombinations/utilities.ts`) | ~~N13 (TJ request). Five chips in a row; whole unit was one `<button>` wrapping player links.~~ Each slot is a team-navy card; up to 3 forwards on top, D always on the bottom row, centred. Labels PP1/PP2/PP3. Stats over the EV cards' 10 games (`statsGameIds`): PPG/PPA/PPP from skatersGameStats (agree with EV PPP), PP SOG and TOI/GP from forge, season SH%. Only the header toggles Recent games. | Done | 2 |
| data | PP sources (other lane) | Forge `goals_pp`/`assists_pp` disagree with the NHL `powerPlayPoints` (McDavid 2+15 vs 0+14, EDM 2026020133–260), and `skatersGameStats.powerPlayToi` is "00:00". Sent to Chef 2026-11-07 (TJ asked). | Other lane | 2 |
| /lines/[team] | empty state on query errors (`[abbreviation].tsx` getStaticProps) | ~~C1. Any DB error (statement timeout, aborted transaction) rendered "No completed game with shift data yet", and ISR could cache it over a good page.~~ Only the no-data error shows that copy; other errors throw so ISR keeps the last good page. At build time it shows "Lines couldn't load right now…". Tests added. | Done | 4 |
| /lines/[team] | promotion arrows (`SkaterCard.tsx`, `GoalieCard.tsx`) | ~~C6. alt "promotion"/"demotion".~~ Now "moved up"/"moved down". | Done | 4 |
| /lines | meta description (`index.tsx`) | ~~C7. "NHL Line Combinations" repeated the title.~~ Now describes the page. | Done | 4 |
