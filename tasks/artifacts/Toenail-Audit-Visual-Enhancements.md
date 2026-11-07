# Toenail audit: visual enhancements for later

Medium- and low-priority changes found during the toenail fixes and the skill passes (2026-11-04). High-priority ones were done in the loop with TJ's approval and are not listed here.

| Page | Element / file | Change | Priority | Found by |
|---|---|---|---|---|
| /stats | `.quickStatCard:hover` (`web/styles/Stats.module.scss`) | Hover recolours the left accent rule to `$border-accent`, so the blue/gold category colour flashes away. Pin `border-left-color` on hover. | Medium | Toenail pass |
| /stats | `.mobileLeaderItem`, `.leaderRow` nth-of-type colours (`web/styles/Stats.module.scss`) | Green → red rank stripes read as good → bad, but every row is a league leader. Consider a single accent, or gold for #1 only. TJ kept the five colours for now. | Low | Toenail pass |
| /roster-schedule-optimizer | `StreamingItinerary` empty state | "Review League rules and scoring" is plain text. Make it a button that opens the League rules panel. | Medium | Toenail pass |
| /roster-schedule-optimizer | `.confirmGate` | The gate says to confirm planning inputs but not which ones. List the missing inputs inline as links to their panels. | Medium | Toenail pass |
| /roster-schedule-optimizer | `.notice` (error state) | "Save to account failed" uses the same yellow rule as routine status. Give the error state a red rule. | Medium | Toenail pass |
| /draft-dashboard | `.pointsInputNarrow` (`DraftSettings.module.scss`) | Unused class (no component references it). Delete in a CSS cleanup. | Low | Toenail pass |
| /stats/player/[id] | `%card-base`, `.streak`, `.metric` | Full 1px tone-coloured outline plus the 6px rail; the green outlines compete with the numbers. Keep colour in the rail only, with neutral borders on the other sides. | Medium | Toenail pass |
| /stats/team/[abbr] | Goaltending card stat tiles (`TeamDashboard.module.scss`) | SV% is always gold and GAA always green, whatever the values (89.9% SV looks like a highlight). Use neutral values plus a league-rank note. | Medium | Toenail pass |
| BLSH (live lists + detail) | `web/lib/buyLowSellHigh/displayProfile.ts` `freshnessText` / `ageText` | Same "1 days" plural slip in the live mapper. Fixed only in the trade fixture (`components/blshTrade/fixtureEvidence.ts`), because `displayProfile.ts` has uncommitted work from the BLSH lane. Hand to that lane. | Medium | Toenail pass |
| /blog | `.postPage … .portableText` tree (`web/styles/Post.module.scss`) | Unused nested styles (~120 lines); articles render through `ArticleReader` `.readerCanvas`. Remove in a CSS cleanup. | Low | Toenail pass |
| /stats | Player search field between the team grid and the columns | Orphaned, unlabelled input floating between sections; fold it into the page header or the team-grid module. | Medium | design-critique |
| /stats desktop | Leaderboard Position pills | Tiny pills wrap "Goalie" onto a second line inside a large card; use a single-row segmented control. | Medium | design-critique |
| /stats desktop | Middle column | The hero card and the filter card leave large empty space beside the dense side columns. Tighten the hero, or move the filter into the hero. | Low | design-critique |
| /stats | `.quickStatIcon` (dot icon box) | Decorative icon box with a single dot takes a third of each Key Metrics card and forces two-line labels. Remove it, or replace it with a meaningful glyph. | Low | design-critique |
| /underlying-stats desktop | "Why it's moving" column | 11px grey copy is hard to read and is the most useful plain-English signal in the row; raise it to 13px at text-secondary contrast. | Medium | design-critique |
| /underlying-stats | Nav wordmark | The page swaps the FHFH logo for a yellow "UNDERLYING STATS" wordmark; that's inconsistent with the other pages. | Low | design-critique |
| /roster-schedule-optimizer desktop | Roster stats footer (Active games / Bench games / Projected points) | 9-10px copy truncates ("0% of starting slo…", "Shows once proje…"). Let it wrap, or shorten it. | Medium | design-critique |
| /roster-schedule-optimizer | Dot scrubber above the day headers | Unlabelled dot on a track; its purpose isn't clear. Label it, or show the day selection directly. | Low | design-critique |
| /draft-dashboard desktop | Draft Settings form | Labels ("Teams:", "My Team:") sit about 500px from their controls, and team-name inputs run 450px wide for 7-char names. Cap the form at ~560px. | Medium | design-critique |
| /draft-dashboard | Team-name inputs | No inner left padding; "Team 1" touches the input border. | Low | design-critique |
| /draft-dashboard desktop | Available Players | Names ("Connor McDa…") and teams ("E…") truncate while the numeric columns have spare width. | Medium | design-critique |
| /draft-dashboard desktop | Suggested Picks card names | Names truncate ("Nathan M…"). Show first initial plus full last name. | Low | design-critique |
| Mobile menu | Trends / Variance Skaters icons | Both use the same ↗ trend icon; give Variance its own glyph. | Medium | design-critique |
| Mobile menu | "Current" label on the active link | Repeats what the highlight and aria-current already say; could drop it. | Low | design-critique |
| Mobile menu | Analytics group subtitle | Tools and Community show a subtitle line; Analytics (expanded) doesn't. Keep the subtitle when expanded for consistency. | Low | design-critique |
| /stats/player mobile | Lineup Deployment | 3×4 grid of mostly empty tiles with one "100%". Collapse it to the occupied lines, or show a compact list. | Medium | design-critique |
| /stats/player mobile | Season activity heatmap | Tiny cells; month labels collide ("SepOct"). | Medium | design-critique |
| /stats/player | Radar chart | The top "100%" ring label is clipped by the P axis point. | Low | design-critique |
| /stats/player/8478402 | FO% comparison data | McDavid (C) has no FO% percentile ("Unavailable"). This looks like a data-pipeline gap, not a design issue; check the faceoff source for the radar comparison. | Medium | design-critique |
| /stats/team desktop | Team Leaders column | Large dead gaps between the Points, Goals and BSH sections (the cards stretch to row height). | Medium | design-critique |
| /stats/team Roster tab | "Skaters (50)" / "Goalies (9)" headings | Teal accent bar plus a count that includes players who haven't played. Use a plain heading with a muted "· 23 played" count. | Low | unslop |
| /stats/team Roster tab | Player names | Bold 700 in every row; 500 weight would let the sorted column lead. | Low | unslop |
| Shared SurfaceWorkflowLinks | Eyebrow and title ("TEAM WORKFLOW", "KEEP EXPLORING EDM") | Uppercase tracked labels; sentence case would be calmer. It's a shared component, so this changes every page that uses it. | Low | design-critique |
