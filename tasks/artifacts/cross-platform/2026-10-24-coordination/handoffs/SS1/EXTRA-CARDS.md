# SS1 — Monday optional extra cards (spec only, none built)

Every extra card has the same frame as the default card: a 1080 × 1080 square with the same brand header and footer, a Download PNG button, and a role="img" label with full alt text. No automatic posting. Each card is chosen from the existing **Graphic** select on `/social-share/game-grid`, and the default stays the Best schedules grid.

The cards are listed in TJ's priority order. **None is built.** Cards 1–4 need data that the schedule-only snapshot does not carry, and each of those sources is a Codex contract or a production read. Card 5 is already covered by the existing leaders card.

| # | Card | Content (square) | Data it needs | Blocker before build |
| --- | --- | --- | --- | --- |
| 1 | **Easiest schedules** | The top 8 teams by opponent ease for the selected dates. Each row shows the team logo, the opponent logos for the week, and an ease bar. The footer names the rating source and the date it was computed. | Game Grid opponent ATK/DEF ratings (commit 431ffcd67, the accepted Game Grid packet). | Ratings are a Codex-frozen input. A read-only export of the opponent rating per team and date is needed, or Codex's OK to import its pure helper. Production ratings need TJ's approval to read. |
| 2 | **Streaming matchups** | 6 to 8 team-night tiles, each showing a top-10 Week Score team playing a weak opponent on an off-night: date, team @/vs opponent, and the off-night flag. | Card 1's opponent rating, plus the Monday grid data that already exists. | Same as card 1. |
| 3 | **Pickups aligned with top teams** | Three columns: F, D and G. Each column has three tiers, rostered under 50%, under 30% and under 20%, with up to 3 players per tier. Players come only from the top-N Week Score teams. Each entry shows name, team logo, position and rostered %. The footer says "Yahoo rostered % as of <timestamp>". | `yahoo_players` ownership (as read by `lib/dashboard/commandCenterData.ts`), filtered by team and position. | Ownership is a coordination-required Codex contract. Reading production `yahoo_players` needs TJ's direct approval. Build it against a fixture first. Freshness rule: block export if ownership is older than 24 h. |
| 4 | **Hits / SOG / Blocks specialists** | Three columns of 3 to 5 players with per-game rate, games this week and rostered %. The pool is limited to teams with 4 or more games. | Per-player HIT, SOG and BLK rates (WGO or NST tables), plus card 3's ownership. | Requires player-stat sources. NST is rate-limited and Codex-owned. Needs a contract and fixture. |
| 5 | **Games remaining / off-nights** | The top 3 teams by games and off-nights, with an optional per-team itinerary. | Schedule only. | **Already exists**: the "Top three schedule leaders" and team-focus options in the same Graphic select. No new build is needed. |

## Proposed build order when unblocked

Build card 3 (Pickups) first, because it has TJ's settled 50/30/20 tiers. It needs Codex's read-only ownership contract and a fixture.

Then build card 1 (Easiest schedules), which needs the read-only opponent-rating export. Card 2 follows nearly free once card 1 lands. Card 4 comes last.
