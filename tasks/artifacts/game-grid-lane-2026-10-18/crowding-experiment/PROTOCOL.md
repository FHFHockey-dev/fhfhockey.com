# Crowding grade experiment — protocol (written before the run)

**Question.** Does the shipped bounded crowding grade (`schedule-v2-crowding-0.25`) make Week Score pick teams whose games are more usable than the same score without the grade (v1 = v2 minus the crowding term)?

**Data.** A real 2024-25 NHL schedule, Mar 17 – Apr 7 2025: 32 teams and 162 games, from TJ's Frozen Tools planner export. Only team, date, opponent and venue are kept (`schedule-2025-03-17_04-07.json`). The converter checks reciprocity and the per-night counts. Three complete Mon–Sun weeks are used: Mar 17, Mar 24 and Mar 31.

**Scenarios.** For each week, every day mask with at least 4 included dates: 35 + 21 + 7 + 1 = 64 masks, so 192 scenarios. Scores use the production `calcWeekScore`/`calculateSlateCrowding`. ON counts games on nights with 8 or fewer games. The matchup term is neutral (no odds input), which isolates crowding.

**Outcome (independent of q(n)).** Synthetic marginal startable games. A manager has R rostered skaters on uniformly random teams and S = 12 positionless active slots. Adding a player from team T earns, on each included night T plays, one start if fewer than S of the R existing players play that night. The expectation is taken over 4,000 seeded rosters, with common random numbers across teams and scenarios. Configurations: R = 14, 16, 18.

**Comparisons per scenario.**
- Expected top-1 and top-5 utility, with v1's exact ties broken uniformly at random (tie groups use expectation).
- Top-1 regret against the best team by utility.
- Spearman rank correlation of score versus utility.
- Count of scenarios whose top-1 set changes.

**Guarantee check.** No pair of teams with different (GP, ON) changes order between v1 and v2.

**Success criterion, fixed in advance.** Mean top-1 regret for v2 ≤ v1 in all three configurations, top-5 utility for v2 ≥ v1 in all three, and zero guarantee violations.

**Limitation, stated in advance.** This is a synthetic, positionless roster model on 3 late-season weeks. It tests plausibility only. It is not observed fantasy start probability, positional eligibility, or league-wide value (PRD: synthetic simulations "cannot validate actual start probabilities").
