I want you to generate a task list for a new feature, following my task-list generation rules exactly.

Assume the PRD file will be:
`tasks/prd-player-underlying-stats-landing-page.md`

Your job is to:
1) analyze the feature requirements below as if they are the PRD scope,
2) generate Phase 1 parent tasks only first,
3) stop and wait for my `Go`,
4) then generate the full task list with sub-tasks, relevant files, and notes in the exact markdown structure required by my task-list rule.

Important constraints:
- The primary reader is a junior developer.
- Be implementation-oriented and specific.
- Do not skip backend/data tasks, frontend/UI tasks, validation tasks, routing tasks, performance tasks, or testing tasks.
- If something is ambiguous, make the most reasonable implementation assumption, but also add it as an explicit task or open question.
- Keep the task list grounded in the actual pages, filters, columns, sorting behavior, and player-detail routing described below.
- Treat this as a real production feature, not a mockup.

Feature to build:
Create a stats landing page at:
`pages/underlying-stats/playerStats`

This page should contain a master stats table with dropdown controls for:
- From {season} Through {season}
- Season type: regular season, playoffs, pre-season
- Strength: 5v5, All Strengths, Even Strength, Penalty Kill, Power Play, 5 on 4 PP, 4 on 5 PK, 3 on 3, with Empty Net, Against Empty Net
- Score state: All scores, tied, leading, trailing, within 1, up 1, down 1
- Stat mode: On-Ice, Individual, Goalies
- Display mode: Counts, Rates

Additional expandable filters:
- Team select
- Position group: Skaters, Defensemen, Centers, Left Wings, Right Wings, Goalies
- Home or Away
- Minimum Time on Ice
- Date Range (inside selected season range)
- Game Range = compare players by their own last X games played
- By Team Games = compare players over the last X team games, even if the player missed some of them
- Combine or Split for traded players:
  - Combine = aggregate player stats across all teams into one row
  - Split = separate player-team stints into separate rows

All table data must be filtered by the selected controls above.

Master table views and required columns:

1) Individual Counts
Player, Team, Position, GP, TOI, Goals, Total Assists, First Assists, Second Assists, Total Points, IPP, Shots, SH%, ixG, iCF, iFF, iSCF, iHDCF, Rush Attempts, Rebounds Created, PIM, Total Penalties, Minor, Major, Misconduct, Penalties Drawn, Giveaways, Takeaways, Hits, Hits Taken, Shots Blocked, Faceoffs Won, Faceoffs Lost, Faceoffs %

2) Individual Rates
Player, Team, Position, GP, TOI, TOI/GP, Goals/60, Total Assists/60, First Assists/60, Second Assists/60, Total Points/60, IPP, Shots/60, SH%, ixG/60, iCF/60, iFF/60, iSCF/60, iHDCF/60, Rush Attempts/60, Rebounds Created/60, PIM/60, Total Penalties/60, Minor/60, Major/60, Misconduct/60, Penalties Drawn/60, Giveaways/60, Takeaways/60, Hits/60, Hits Taken/60, Shots Blocked/60, Faceoffs Won/60, Faceoffs Lost/60, Faceoffs %

3) On-Ice Counts
Player, Team, Position, GP, TOI, CF, CA, CF%, FF, FA, FF%, SF, SA, SF%, GF, GA, GF%, xGF, xGA, xGF%, SCF, SCA, SCF%, HDCF, HDCA, HDCF%, HDGF, HDGA, HDGF%, MDCF, MDCA, MDCF%, MDGF, MDGA, MDGF%, LDCF

4) On-Ice Rates
Player, Team, Position, GP, TOI, TOI/GP, CF/60, CA/60, CF%, FF/60, FA/60, FF%, SF/60, SA/60, SF%, GF/60, GA/60, GF%, xGF/60, xGA/60, xGF%, SCF/60, SCA/60, SCF%, HDCF/60, HDCA/60, HDCF%, HDGF/60, HDGA/60, HDGF%, MDCF/60, MDCA/60, MDCF%, MDGF/60, MDGA/60, MDGF%

5) Goalies Counts
Player, Team, GP, TOI, Shots Against, Saves, Goals Against, SV%, GAA, GSAA, xG Against, HD Shots Against, HD Saves, HD Goals Against, HDSV%, HDGAA, HDGSAA, MD Shots Against, MD Saves, MD Goals Against, MDSV%, MDGAA, MDGSAA, LD Shots Against, LD Saves, LD Goals Against, LDSV%, LDGAA, LDGSAA, Rush Attempts Against, Rebound Attempts Against, Avg. Shot Distance, Avg. Goal Distance

6) Goalies Rates
Player, Team, GP, TOI, TOI/GP, Shots Against/60, Saves/60, SV%, GAA, GSAA/60, xG Against/60, HD Shots Against/60, HD Saves/60, HDSV%, HDGAA, HDGSAA/60, MD Shots Against/60, MD Saves/60, MDSV%, MDGAA, MDGSAA/60, LD Shots Against/60, LD Saves/60, LDSV%, LDGAA, LDGSAA/60, Rush Attempts Against/60, Rebound Attempts Against/60, Avg. Shot Distance, Avg. Goal Distance

Behavior requirements:
- Every column must be sortable.
- Default sort:
  - Skaters / forwards / defensemen: sort by Total Points for Counts view, or Points/60 for Rates view
  - Goalies: sort by SV%
- Every player name must be a hyperlink to:
  `pages/underlying-stats/playerStats/{playerId}`
- The player detail page should show player-specific season logs.
- Each season should appear as its own row.
- The player detail page should preserve the same general filter philosophy where appropriate.
- On the player page, the Team filter should be replaced with:
  `Against Specific Team`
- The task list should account for both the landing page and the player detail page.

You must also account for the following implementation realities in the task list:
- data sourcing,
- backend query design,
- Supabase schema or query-layer implications,
- API route design if needed,
- sorting and filtering logic,
- URL/query-param state management,
- pagination or virtualization for wide/large tables,
- default states and reset behavior,
- combine/split traded-player logic,
- player-position filtering,
- rate-stat eligibility / minimum TOI handling,
- season/date/game-range compatibility rules,
- edge cases for players with multiple teams,
- loading, empty, and error states,
- tests and validation,
- performance considerations for large result sets,
- column configuration and reusable table architecture,
- reusability between landing page and player detail page.

Output requirements:
- Follow my task-list generation rule exactly.
- In Phase 1, generate only the high-level parent tasks and then stop.
- After I respond with `Go`, generate the full task list with:
  - Relevant Files
  - Notes
  - Tasks with numbered parent tasks and numbered sub-tasks
- Save path should follow:
  `/tasks/tasks-prd-player-underlying-stats-landing-page.md`

Use this exact output structure in the final full version:

## Relevant Files
- `path/to/file` - description

### Notes
- note

## Tasks
- [ ] 1.0 Parent Task Title
  - [ ] 1.1 Sub-task
  - [ ] 1.2 Sub-task

Do not write code. Do not implement. Only generate the task list.