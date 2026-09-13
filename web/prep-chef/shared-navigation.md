# Shared navigation — cross-page audit

Status: Follow-up needed. This supporting record coordinates page plans; it is not an additional route.

## Purpose and owner responses

Help the average fantasy GM find existing tools on desktop and mobile, with deeper statistics accessible without making the experience intimidating. Home and Draft Dashboard are visual references.

Owner says the global NavBar needs love, perhaps an overhaul; MobileMenu needs fine tuning. First-class destinations: Game Grid, Stats, Underlying Stats, and eventually Start Chart after its own improvements. No specific advanced-tool demotion was requested. The owner requests a generated mobile navigation mockup to workshop.

The Slate duplicate links and mobile TeamStandingsChart selector are recorded in home.md. These refine the earlier retain-as-is decision without authorizing a homepage redesign.

## Source observations

- `web/components/Layout/NavbarItems/NavbarItemsData.ts`: shared navigation configuration currently places Game Grid and Stats in the primary mobile tier, and Start Chart and Underlying Stats in the secondary tier.
- `web/components/Layout/MobileMenu/MobileMenu.tsx`: header/close control, conditional sign-in or account controls, player search with loading/results/empty states, primary Navigation icon grid, secondary More grid, and footer/social links.
- The current menu source places account controls before search and destination grids. No runtime usability or keyboard testing has been performed.

## Mobile concept — direction accepted; increase density

Dark charcoal/cyan styling consistent with the supplied site screenshots. Header and Close; player search; four prominent tiles for Game Grid, Start Chart, Stats, and Underlying Stats; Home; grouped expandable destinations; compact account access. Owner accepted the direction and requested higher density. Keep the hierarchy while reducing tile height and excess spacing; consider icons beside labels and omit or shorten supporting descriptions. Preserve readable labels and usable touch controls. These density techniques are recommendations, not individually approved requirements. Prominence for Start Chart depends on finishing its page audit/work.

Group labels in the mockup (Draft tools, Trends & analysis, Lines & charts, News & podcast) are discussion proposals. Final grouping must map every retained existing destination and preserve account, league settings, search, and authentication flows. A generated image is not proof of responsive behavior, accessibility, complete route coverage, or working interaction.

Generation brief: one flat mobile-width navigation mockup, near-black charcoal, restrained cyan, white legible type, player search above a two-by-two priority tool grid, grouped remaining links, compact account footer; no duplicated destinations or bottom navigation. Built-in image generation; brainstorming preview only.

## Workshop responses and remaining decisions

1. **Slate treatment:** “I agree, the right-hand items should remain, but perhaps the bottom row could be different links to de-duplicate.” Keep Quick Links; the subsequent final bottom-row selection is recorded below.
2. **Mobile concept:** “Yes, The direction feels right, but a density increase is also preferred.” Direction accepted; refine density while preserving the hierarchy and usability. Final grouping and desktop layout still require planning.
3. **Standings selector:** “yes” to two division groups per row on narrow phones and four across where space allows; each division has two columns of four teams.

**Final homepage decision:** owner confirmed **Stats · Lines · News · Shift Chart**, in that order, for the Slate bottom row. Targets: `/stats`, `/lines`, `/news`, `/shiftChart`. Preserve right-hand Quick Links unchanged. Draft Dashboard was rejected as seasonal; Roster Schedule Optimizer and Variance were considered but not selected. Homepage scope is now ready for a separate `/plan` handoff in home.md.

Desktop navigation remains an open design topic; acceptance of the mobile concept does not approve a desktop overhaul design. The team-selector layout is sufficiently defined for planning alongside the now-confirmed Slate links.

## Plan handoff — draft, not ready

```text
/plan
Review web/prep-chef/shared-navigation.md, home.md, and README.md.
Plan the agreed global desktop/mobile navigation improvements for the average
fantasy GM. Prioritize Game Grid, Stats, Underlying Stats, and eventually
Start Chart after its improvements. Preserve access to retained existing tools,
player search, account and league settings, and signed-in/signed-out flows.
Home and Draft Dashboard are UI references.

Owner accepted the mobile concept direction but requested greater density.
Reduce oversized tiles and excess spacing while keeping legible labels and
usable touch controls. Final groups, account placement, and desktop layout
remain to be planned. The mockup is exploratory, not a pixel specification.
Keep the Slate right-hand Quick Links. The confirmed bottom row is
Stats (/stats), Lines (/lines), News (/news), Shift Chart (/shiftChart), in order.
Exclude Draft Dashboard from that row per owner feedback; it is seasonal.
The responsive standings-selector arrangement is confirmed in home.md.
Inventory existing destinations and map them to the proposed hierarchy.
Coordinate Slate duplication and standings-selector changes with home.md.
Propose acceptance criteria for route reachability, active state, open/close,
keyboard/focus behavior, search states, scrolling, narrow-screen fit, legibility,
and touch controls. Do not claim the generated mockup verifies those behaviors.
Resolve open choices, then produce a bounded sequenced task list and relevant
verification plan. Follow AGENTS.md. Do not implement or deploy.
```
