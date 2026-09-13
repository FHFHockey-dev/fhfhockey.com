# / — page audit

- Source: `web/pages/index.tsx`
- Status: Ready for plan — agreed scope is Slate link de-duplication and the responsive standings team selector. Shared navigation is a separate workshop.
- Discovery: Listed in primary navigation configuration.
- Evidence: homepage composition and primary navigation inspected in source. Rendering, interactions, access, and completion are unverified.
- Scope: inspect the user-facing page and its tools. If this is a redirect, internal screen, or experiment, record its disposition before further auditing.

## Purpose and intended user

My initial interpretation: the homepage is a daily hockey overview and gateway into fantasy tools. It brings games, news, injuries, standings, and transaction trends together, while promoting the Draft Dashboard and optionally exposing the Draft Ranker. It appears to serve both returning managers checking current developments and visitors discovering FHFH. The relative priority of those audiences needs owner confirmation.

Owner confirmed the overview purpose and refined its emphasis: “the Homepage should give high level information. We aren't making decisions yet.” It should answer: what games are on today, who is being added or dropped, what the standings look like and which teams are rising or falling, who is hurt, and what recent transactions occurred.

Confirmed purpose: give the average fantasy GM a high-level snapshot of the hockey landscape. Advanced statistics should be available across the site for interested users without alienating the average GM. The homepage does not need to drive an immediate fantasy decision.

Owner was initially happy with the homepage and requested no page changes; the later clarification below identifies two limited exceptions. Home and Draft Dashboard are the reference experiences for the rest of the audit.

## Current experience and evidence

Observed in `web/pages/index.tsx`:

- Games section receives date controls, loading/error state, update time, playoff context, offseason opening-night information, and summary metrics.
- Draft Dashboard promotion links to `/draft-dashboard` and `/account?section=draft-pro`.
- A conditional tool switcher exposes Draft Ranker and Transaction Trends; otherwise Transaction Trends renders directly. The default transaction metric changes between offseason ADP and in-season ownership.
- Latest News displays up to five expandable cards and links to `/news`, with copy for an empty news list.
- A standings chart and a standings/injuries section provide additional league context.
- Navigation configuration links to many tools, charts, variance pages, blog, and podcast.

These are source observations, not proof that data or interactions work in the browser. The owner retains the homepage purpose and content, with two later exceptions recorded below. This disposition is an owner satisfaction decision, not a claim of browser verification.

## Questions and owner responses

1. **What decision should a visitor be able to make here, and who is that visitor?** Owner refers to the high-level overview described above: visitors are orienting themselves, not yet making decisions. The primary audience is the average fantasy GM.
2. **What was your original vision? What remains unfinished or disappointing?** “I am happy with this page.”
3. **What deserves emphasis, simplification, consolidation, or retirement?** “nothing.”
4. **What would make someone return, trust the result, and share this page?** “Some improvements could be better navigation.”
5. **Which existing page should set the standard for navigation and presentation?** “Home page, Draft Dashboard.”

## Recommendations and decisions

- **Initial disposition: retain the homepage as-is.** Superseded only for the two limited improvements below; no broad redesign or new homepage tools requested.
- The initial hypotheses about rearranging sections, pushing visitors toward decisions, seasonal hierarchy, and other homepage enhancements are not accepted requirements. The owner's clarification supersedes those proposals.
- **Shared navigation: follow-up needed.** See [shared-navigation.md](shared-navigation.md) for owner priorities and the mobile concept discussion.
- **Shared audience and UI references: confirmed.** Design for the average fantasy GM with optional advanced depth. Use Home and Draft Dashboard as references; do not assume either needs redesign merely to standardize other pages.

## Follow-up: concrete exceptions from owner screenshots

Owner identifies duplicate Starter Board, Game Grid, Trends, and Underlying Stats links within the Slate hero. The first supplied screenshot visibly shows the same four labels in a bottom row and a right-hand Quick Links panel. This is screenshot evidence of duplicate labels; destination equivalence still needs verification. Owner decision: retain the right-hand Quick Links. Owner considered alternate bottom-row destinations, ruled out seasonal Draft Dashboard, then proposed Variance or Shift Chart. Final owner confirmation: **Stats · Lines · News · Shift Chart**, in that order. Keep the bottom row with these links; retain the right-hand Quick Links unchanged. Route targets: `/stats`, `/lines`, `/news`, `/shiftChart`.

Owner also requests a more compact mobile selector in `web/components/TeamStandingsChart/TeamStandingsChart.tsx`: four division groups, each containing two columns of four teams, arranged side by side. The second screenshot shows long stacked division lists and unused horizontal space. Owner confirmed: wrap divisions into a two-by-two arrangement on narrow phones; show all four divisions side by side when space allows. Each division retains two columns of four teams when unfiltered.

Relevant immediate UI files inspected: TeamStandingsChart.tsx and TeamStandingsChart.module.scss. Current markup groups divisions inside two wrapper columns; mobile styles include a four-column outer grid and single-column division team lists. Verify the actual affected compact/noncompact variant and viewport before choosing a patch; the screenshot alone does not establish the working tree's rendered state.

Evidence supplied: screenshots named `Screenshot 2026-09-12 at 6.19.30 PM.png` and `Screenshot 2026-09-12 at 6.24.30 PM.png` (original files in the owner's Desktop/Screenshots directory; filenames contain a narrow space before PM).

## Plan handoff — ready

```text
/plan
Read web/prep-chef/home.md and web/prep-chef/shared-navigation.md.
Page: /
Source: web/pages/index.tsx
Audience: average fantasy GM; optional advanced depth without overwhelming them.
Confirmed purpose: a high-level overview before decision-making: games today,
market adds/drops, standings and rising/falling teams, injuries, transactions.
Owner is happy with the page. Preserve its purpose, content, and overall design.

Plan only these identified improvements:
1. Resolve duplicate Slate hero navigation labels for Starter Board, Game Grid,
   Trends, and Underlying Stats. Verify destinations and responsive behavior.
   Keep right-hand Quick Links unchanged. Replace the bottom row, in order,
   with Stats (/stats), Lines (/lines), News (/news), Shift Chart (/shiftChart).
   This exact set was confirmed by the owner. Do not remove the bottom row.
2. Reorganize the mobile TeamStandingsChart team selector into four division
   groups, each two columns by four rows; two division groups per row on narrow
   phones, four groups across when space permits. Owner confirmed this layout.

Acceptance criteria for the agreed scope: no duplicate destination
sets within the Slate at a given viewport; existing destinations remain reachable;
all 32 teams remain selectable under their division when unfiltered; selected
states, filters, Select All/Clear All, and chart behavior remain intact; division
names stay legible and controls do not overflow or become difficult to tap.

Shared global/mobile navigation is tracked separately; coordinate dependencies.
Source and owner screenshots were reviewed; browser behavior is unverified.
Create a sequenced task list for this agreed scope. Choose responsive breakpoints
from available space and existing conventions; verify both narrow and wide layouts.
The broader navigation workshop does not block these two homepage improvements.
Follow AGENTS.md. Plan only; do not implement or deploy.
```
