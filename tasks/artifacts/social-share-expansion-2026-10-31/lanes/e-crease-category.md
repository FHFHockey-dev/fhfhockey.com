# Lane E receipt: Crease Shift and Category Counts (SS 8.0, 9.0)

Posts: `crease-shift`, `goalie-period`, `goalie-gsax`, registered in `lanes/creaseAndCategory.ts`. Nothing is activated or scheduled. **Real-output review by TJ (9.7) is open and is the lead's to run.**

## Subtasks

| Subtask | State | Evidence |
| --- | --- | --- |
| 8.1 Start share, comparison, tandem | Done | `creaseShift.test.ts`: traded goalie, relief apart, doubled, missing and unlabeled starter withhold, short team window, STD overlap, tied ranks |
| 8.2 Schedule reconciliation | Done | `creaseShift.test.ts`: one missing team game is partial; card and alt text carry no probability wording |
| 8.3 Card | Done | Card tests in `creaseShift.test.ts`. `git status` clean on `goalieWorkload.ts` and `GoalieShareChart`; the pie is untouched and not relabeled |
| 8.4 Real starter check | Done | Read R1: **432 of 432** team games have exactly one labeled starter |
| 9.1 Categories, cells, baselines | Done | `shared/categoryCounts.test.ts`, including the contract's worked example at its exact totals |
| 9.2 Missing and zero | Done | Same file: SA 0, TOI 0, null, empty pool, zero baseline tie, relief-only week, plus TGV side by side (tie, zero baseline) through the unedited `calculateWeeklyRanking` |
| 9.3 Periods | Done | Same file: spanning week, even split, in-progress labels, last-completed default |
| 9.4 Rankings | Done | Same file: min starts, net, both tiebreaks, shared ranks, co-winners, best and worst |
| 9.5 Post and card | Done | `goaliePeriod.test.ts`: labels never merged in data or on the card. `git status` clean on `goalieCalculations.ts` |
| 9.6 GSAx | Done | `goalieGsax.test.ts`: sign, strengths apart, minutes converted once, lag shown, no `gsaa`, FHFH model unavailable |
| 9.7 Real reads, one week and one month | **Reads logged. TJ review open** | R5 and R7 below. The post code has not run on these rows: see "Lead's render" |

## Checks run

| Check | Result |
| --- | --- |
| `npm test --` the four lane test files plus `server.test.ts`, `contract.test.ts` | Passed at the first commit: 6 files, 86 tests. See the follow-up below for the later run |
| `npx eslint` on all lane files | Passed, no findings |
| `npx tsc --noEmit` filtered to lane files | No errors in lane files |
| CSS-module pure check on the three SCSS files | Passed |
| `npx playwright test e2e/social-share-crease-category.spec.ts --list` | 5 tests discovered. **Not run in a browser**: the lead's, at 13.0 |

## Real reads

Project `fyhftlxokyjtpndbkfse`, Supabase MCP `execute_sql`, 2026-10-31. Every statement was a single `SELECT`. No writes, provider calls or Vercel requests. Sample rows are per statement and within the 50-row bound; R5 and R7 scan whole tables' period rows inside the database and return only aggregates.

| # | Statement | Tables read | Rows returned | Result |
| --- | --- | --- | --- | --- |
| R1 | Starter labels per team game, null and zero checks | `wgo_team_stats`, `wgo_goalie_stats`, `games` | 1 | Passed. 432 team games, 216 of 216 scheduled, 432 with one starter, 0 unresolved, 23 relief rows, 0 null core stats, 0 null `quality_start`, 0 zero SA or TOI, all TOI whole seconds |
| R2 | First 10 matchup weeks | `yahoo_matchup_weeks` | 10 | Passed. Week 4 is 10-19 to 10-25; week 5 ends 11-01 |
| R3 | NST against WGO join, FHFH model count | `wgo_goalie_stats`, `nst_gamelog_goalie_all_counts`, `nst_gamelog_goalie_5v5_counts`, `nhl_xg_goalie_game_aggregates` | 1 | Passed. 415 WGO appearances through 10-27, 417 NST rows, 414 same-date joins, both NST tables through 10-27, season column right, 0 duplicates, FHFH model 0 rows this season, last game 2026-05-26 |
| R4 | NST and WGO rows that do not join | `nst_gamelog_goalie_all_counts`, `wgo_goalie_stats` | 4 | Passed. See the first gotcha |
| R5 | Category Counts by SQL, October through 10-30, default five | `yahoo_matchup_weeks`, `wgo_goalie_stats` | 8 | Passed |
| R6 | Same for week 4, first attempt | Same | 0 | **Failed before running**: invalid `ORDER BY` on a `UNION`. Rewritten as R7 |
| R7 | Category Counts by SQL, week 4, with a TGV stat count | `yahoo_matchup_weeks`, `wgo_goalie_stats`, `goalie_weekly_aggregates`, `league_weekly_goalie_averages` | 13 | Passed |

## Expected real output, for the lead's render

R5 and R7 are an independent SQL implementation of CONTRACT §3, so they are a cross-check on the code rather than the code's output. Cells are above-below-tied. No cell was unavailable in either read.

**Week 4, min 2 starts.** Pool 57 goalies, 96 official starts, 33 eligible. Game baselines: saves 24.750, SV% .8909, GAA 3.079, wins .500, shutouts .031. Week baselines: saves 41.737, wins .842.

| Best | Worst | Goalie | Team | GS | Game cells | Week cells | Game net | Week net |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | 31 | Anthony Stolarz | TOR | 2 | 6-4-0 | 3-2-0 | +6 | +3 |
| 1 | 31 | Darcy Kuemper | LAK | 2 | 6-4-0 | 3-2-0 | +6 | +3 |
| 1 | 31 | Devin Cooley | CGY | 2 | 6-4-0 | 3-2-0 | +6 | +3 |
| 4 | 30 | Joel Hofer | STL | 3 | 9-6-0 | 3-2-0 | +5 | +3 |
| 33 | 1 | Ukko-Pekka Luukkonen | BUF | 2 | 3-7-0 | 2-3-0 | −8 | −3 |
| 32 | 2 | Carter Hart | VGK | 2 | 2-8-0 | 1-4-0 | −6 | −5 |

**So the real Week 4 card has three co-winners.** That is the contract working, and TJ should see it first.

**October through 10-30, min 5 starts.** 45 eligible, 455 rows in weeks 1 to 5, labeled in progress.

| Best | Worst | Goalie | Team | GS | Rel | Game cells | Week cells | Game net | Week net |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | 45 | Linus Ullmark | OTT | 8 | 0 | 18-22-0 | 10-10-0 | +12 | +8 |
| 2 | 44 | Pyotr Kochetkov | CAR | 9 | 0 | 18-27-0 | 12-13-0 | +9 | +9 |
| 3 | 43 | Jacob Fowler | MTL | 7 | 0 | 16-19-0 | 12-8-0 | +7 | +12 |
| 45 | 1 | Ukko-Pekka Luukkonen | BUF | 8 | 1 | 14-26-0 | 9-11-0 | −24 | −10 |
| 44 | 2 | Kevin Lankinen | VAN | 6 | 1 | 10-20-0 | 6-14-0 | −22 | −16 |

## Lead's render

Each loader needs more than 50 rows at runtime, so it is yours to run. All read through the anon-readable tables in SOURCES.

| Post | Reads | Bound in code (fails closed above it) |
| --- | --- | --- |
| `crease-shift` | Season to the cutoff: `wgo_team_stats`, `wgo_goalie_stats`, `games` | 2,800, 3,400, 1,400 rows |
| `goalie-period` | Touched weeks only: `yahoo_matchup_weeks`, the same three, `goalie_weekly_aggregates`, `league_weekly_goalie_averages` | 40, 1,800, 1,800, 900, 500, 40 rows |
| `goalie-gsax` | Season to the cutoff: one NST strength table and the three above; a head-only count of `nhl_xg_goalie_game_aggregates` | 3,400, 3,400, 2,800, 1,400 rows |

Compare with the tables above: `?post=goalie-period&week=4` and `?post=goalie-period&period=month&month=2026-10`. Card fit inside the fixed square is **not verified**, since I ran no browser, and `postBody` clips overflow. The densest case is `goalie-period` with all eight categories.

## Decisions the contract left open

1. **Default month today is empty.** Through 10-30, the last completed month is September: two days, no assigned week, nobody with 5 starts. I followed "the default selection is the last completed one", so the default month card is empty and says to choose a month. It fixes itself once October and week 5 finish (cutoff 11-01). October is reachable now with `month=2026-10`, labeled "through".
2. **A null stat in a baseline** leaves that category's numerator and denominator only, and is counted in `excluded`. The contract's "Σvalue ÷ official starts" does not cover nulls, and counting it as 0 would break its own rule. No real row is null today.
3. **Rate precision** uses exact integer half-up rounding on both sides, so a float cannot break or fake a tie.
4. **A goalie with no compared game cell** gets no rank even above the minimum starts, since there is no evidence to rank.
5. **A failed TGV read** makes the post `partial` rather than `missing`: counts still preview, it cannot export.
6. **Partial checks cover every touched week**, not only the period's dates, because a month's game cells use whole-week baselines.
7. **GSAx windows stop at NST's through-date**, so a lagging source shows a dated window rather than failing every goalie's coverage. Later appearances are counted on the card. `minAppearances` 3 is my starting value and is a visible setting; CONTRACT lists no GSAx defaults.
8. **Categories setting** is comma-separated text, validated on the server, because the field kinds have no multi-select. Unknown ids are refused.
9. **Card limits**: Crease Shift shows 8 teams, Goalie of the Period 6 goalies, GSAx 10. Each states the count shown of the total. Crease Shift ranks by the largest absolute goalie share change on a team.

## Gotchas

- **NST goalie identity does not always match WGO.** Through 10-27, 3 NST rows have no WGO appearance for that goalie and date. One looks misattributed: NST 8476899 NSH 10-10 logs 64.95 minutes, and WGO has 8483575 NSH 10-10 at 3,897 seconds, the same time. The other two (8475683 TOR 10-06, 8477968 S.J 10-03) have no explained match. GSAx drops all three, counts them on the card, and the real goalie loses that appearance's coverage. Any other NST goalie consumer (lane F's danger-zone shots) may want the same check.
- `teamStartShare` returns `share: 0` on an incomplete window. Crease Shift treats that as null; other consumers should too.
- NST uses `S.J`, not `SJS`. Team always comes from WGO here.

## Follow-up from the real render: minimum comparison games

The lead's real L10 render ranked MTL first against a 3-game comparison and CBJ third against a 1-game one. Crease Shift now has a visible `minComparisonGames` setting, default 5, range 1 to 82, and the L10 default is unchanged.

- A team under the minimum has no shift and no rank. Its goalies' `change` is null too; nothing is invented. The card's note gives only a count of such teams, and the cohort line reads "N of 32 teams ranked; M short comparison".
- **Season to date:** the minimum counts only games outside the recent window, because season to date contains the recent games. L10 versus STD on 13 games has 3 independent games, the same evidence as previous-10 on that team. The field label says "outside the window".
- A team with no completed games is not counted as short.
- Goalie of the Period's sample now reads "1 matchup week used".
- Checks on this follow-up: the same 6 test files pass (93 tests); eslint and `tsc` are clean on the touched files; the spec lists 5 tests. No browser run: the lead's. The spec's Crease Shift fixtures now send `minComparisonGames=2` in the URL and settings, so its export token changed.

**Effect today, from the lead's pre-change `crease-shift.json`** (not a new read, and it predates this change): only **6 of 32** teams have 5 comparison games, all at exactly 5: VAN (+50), CAR (30), MIN (20), PHI, TOR and VGK (10). The other 26 are short. So a real L10 card today is a six-team board led by VAN, which fills as teams pass 15 games. **The lead's real render needs repeating.**

CONTRACT §2's defaults table lists only Window and Comparison for Crease Shift. It is frozen, so adding this row is the lead's.

## Follow-up from TJ's card review (9.7): grades, line and readable marks

TJ asked for grade columns, a week-to-week line, and something readable in place of the above-below-tied cells. `goalie-period` now has:

- **Five grade columns in each row**, under "TGV grade (existing method)": graded weeks per grade through the period's last week, from the unedited `calculateWeeklyRanking`, with the selected week's grade outlined and summed points. A week with no row, or one the method leaves unclassified, adds nothing.
- **A line per goalie**: weekly grade points on one fixed 1-to-20 scale, season start through the period's last week. A week with no grade is a break with a small tick, never 0, and the selected week is white. I wrote a small local SVG instead of reusing `Sparkline`: importing it pulls all of `SocialShare.tsx` into this card, it cannot mark a week, and its colours rely on `currentColor`. Colours here are attributes, because html-to-image drops class styles on SVG children.
- **Direction-normalized marks**: per-category tiles with a green up triangle for better than league and a red down triangle for worse, the same for every category, on rows labeled Games and Weeks. "=" appears only when non-zero. NET now reads "+6 of 10", which replaces CMP. Exact above, below and tied counts stay in `data` and the alt text. The ranking rule is unchanged.
- **A failed TGV read** previews as partial, with "Unavailable" in place of grades and the line.

**"Season to date" stops at the selected period**, so a Week 2 card never shows week 5. Say if the line should always run to the cutoff instead.

**Reads:** the season read replaces the selected-weeks read: `goalie_weekly_aggregates` ceiling **2,200 rows** (254 today, 61 a week at most) and `league_weekly_goalie_averages` **40 rows**. They fail closed into the unavailable state. All of this loader's reads now run one after another.

**Fit in the 1080 square, 6 goalies and 5 categories: calculated, not rendered.** I ran no browser. The new spec test measures it, so that run is the real check.

| Part | Height (px) |
| --- | --- |
| Available: 1080 − 72 padding − 96 header − 28 gaps − about 140 footer (6 evidence lines plus the edition line) | **about 744** |
| Lead line and winner | 50 |
| Group and column heads | 39 |
| 6 rows at 62 | 372 |
| Legend, up to 8 lines at 16, with relief-only names | 128 |
| Gaps | 56 |
| **Total** | **about 645, about 100 spare** |

Width: 1,008 available. Rank 26, goalie 165, grades 354 and 3 gaps of 10 leave 433 for counts, so each of 5 tiles is about 58 wide, which fits two single-digit counts on a line. Two-digit counts or a "=" wrap inside the tile and add about 18 to that row; the spare height covers that. **Eight categories make the tiles about 34 wide and are not budgeted**; that setting may clip, so check it if TJ wants it.

New spec tests: six goalies with an overflow assertion on the post body, and the failed-TGV state. Selectors `category-counts`, `tgv-existing` and `goalie-period-winners` are unchanged.

### Readings that surprised me (reads R8, R9)

| # | Statement | Tables read | Rows returned | Result |
| --- | --- | --- | --- | --- |
| R8 | TGV grade spread by week, by the method's rule | `goalie_weekly_aggregates`, `league_weekly_goalie_averages` | 5 | Passed |
| R9 | Row counts for the new ceilings | `goalie_weekly_aggregates`, `league_weekly_goalie_averages`, `yahoo_matchup_weeks` | 1 | Passed. 254 goalie weeks, 70 goalies, 61 a week at most, 5 league rows, 27 weeks |

1. **The Average column will always be 0.** The TGV page's default stats are wins, saves and SV%, so a week scores 0, 33, 67 or 100%, which gives Abysmal, Bad, Good or Elite. Average needs 45 to 59%, and 5 points never occurs. A test pins this. It is the existing method working as written, so I left it; TJ asked for all five columns and should know why one is empty. Changing it means a different stat set, or new thresholds, which is TJ's call.
2. **TGV is generous.** Across weeks 1 to 4, 56 to 64% of graded goalies are Good or Elite (week 4: 12 Elite, 20 Good, 11 Bad, 14 Abysmal), partly because a tie counts as better.
3. **The two methods can disagree on one row.** In week 4, Dostal and Swayman rank in the bottom 6 of 33 on Category Counts with 2 of 3 TGV stats better, which is Good. The new row puts those side by side, so expect questions. They use different stats and baselines.
4. **Their baselines differ.** TGV's week 4 league wins and saves are .828 and 41.14 over 58 rows, which include relief-only goalies. Category Counts' are .842 and 41.74 over the 57 goalies with a start. This is by contract.
5. **Real ties are almost absent.** Every shown goalie in R5 and R7 had 0 tied cells, so "=" will rarely appear.
6. **An in-progress week grades against a partial average.** Week 5's league wins are .483 against about .83 for full weeks. Defaults avoid it, but choosing the current week on purpose shows an early grade.

## Blockers

None for building. Open: TJ's first real-output review (9.7) and the browser run of the spec.
