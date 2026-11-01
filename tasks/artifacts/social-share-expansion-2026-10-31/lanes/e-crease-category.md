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

## Follow-up from TJ's second review: Best and Worst

TJ could not read the bare numbers and supplied a layout to emulate. **Layout only; none of its wording or claims is copied.** The side heads read "Best" and "Worst". This supersedes the grade columns above for the card; the per-goalie season counts stay in `data` and the alt text.

**`goalie-period`** defaults to Best and Worst side by side, 5 rows a side. "Best only" and "Worst only" stay selectable.
- **Headline:** games net in a heat tile captioned "games net". Colour strength scales with size against the largest value shown; the sign sets the colour, so a good goalie in a small Worst column stays green.
- **Tiles:** `W 2/2  SV 2/2  SV% 2/2  GAA 2/2  SO 0/2` read as better than league in N of M starts. **Green or red needs a majority of compared starts**, so 1/2 is neutral and 0/2 shutouts is red. M excludes unavailable starts. Ties stay out of the tile, and in `data` and the alt text.
- **Weeks:** week-level counts left the tiles and stay in `data` and the alt text, with a compact "week net" in the row.
- **TGV:** per-goalie grade cells do not fit a half-width row, so I used the fallback: a league-wide five-column strip of goalies per grade with each grade's points, and in each row the selected grade chip, season points and the line, all under "TGV grade (existing method)". A month's chip shows each week's first letter. The legend says Average cannot occur with the three default stats. Ranking stays Category Counts.
- **Small pools:** a goalie can appear on both sides only with the note "Only N goalies qualified, so N appear on both sides." When a tie runs past the rows shown, the side says "3 more tied at rank 1".

**`goalie-gsax`** uses the same layout, 6 rows a side, with the window defaulting to the last completed matchup week and minimum appearances to 1. L5, L10 and season to date stay selectable. The card states the NST through-date and makes no claim against SV% or GAA.
- **The default week is the last one NST fully covers**, so a lagging NST shows an older complete week rather than part of a newer one. Before any week completes, it labels the one under way "through <date>".
- **A schedule gap outside that week no longer makes it partial.** Other windows still prove the whole season.
- **Minimum 1 lets one relief appearance reach a board.** The row shows starts, relief, TOI and SA, so it is visible, but TJ may want a higher floor.

**Headshots: team logos stay.** Read-only check: `lib/socialShare` and `components/SocialShare` have no headshot path. The only inlined images are `teamLogoDataUrl`, which draws same-origin `/teamLogos/*.png` to a canvas. Headshot URLs in the tables are remote, so inlining them needs a same-origin proxy, which is a new source. Logos show each goalie's latest team and come through `teams`, so the shell prepares them before export.

**New files beyond my original list**, all this lane's and used only by these two posts: `lib/socialShare/modules/shared/goalieBoards.ts`, `components/SocialShare/modules/GoalieBoards.tsx` and `.module.scss`. No other lane reads or writes them. `cellTone` now needs a majority, and only this card uses it.

**Fit: calculated, not rendered.** No browser run. About 744 available, as above.

| `goalie-period`, 5 rows a side, 5 categories | Height (px) |
| --- | --- |
| Date and winner lines | 47 |
| Side head | 27 |
| 5 rows at 80 (a two-line detail, tiles, padding) | 400 |
| "Showing 5 of N" line | 16 |
| TGV strip | 50 |
| Legend, 7 lines at 15 | 109 |
| Gaps | 24 |
| **Total** | **about 673, about 70 spare** |

Half-width is 494: identity, TGV block and heat tile leave about 213 for the name, and tiles are about 97 wide. `goalie-gsax` totals about 530 at 6 rows. Both spec tests assert the post body does not overflow, so your run is the real check. Eight categories wrap to two tile rows and add about 25 a row, which **would not fit**; check it if TJ wants that setting. No new real reads were made for this change.

## Follow-up from TJ's third review: fill the card, less text

TJ: too much whitespace and too much meta text. The shell's footer is now one line, with the full evidence on the page beside the preview (`9bb30218d`, `756d4706f`), and the body is about 860px.

- **Rows stretch to fill.** The boards and the Crease Shift table share the height left in the body, so no band is left under them at any row count of 4 or more. Below 4 rows a side, rows cap at 130px rather than balloon, which can leave a band on a very small pool only.
- **`goalie-period`:** 8 rows a side, one legend line. The rank rule, TGV explainer, pool counts, unavailable and relief-only counts moved to `evidence.sample` and `evidence.cohort`. Each side head carries "TGV grade (existing method)" over the chip and line. Row meta is starts, relief when non-zero, and week net; team names only when traded, because the logo shows the team.
- **`goalie-gsax`:** 10 rows a side, one legend line. Row meta is GP, xGA, GA, SA. GP reads "9 of 10 GP" when NST misses a window game. Lag, later appearances, dropped NST rows and the FHFH model moved to evidence. "NST model" and the through-date stay on the card.
- **`crease-shift`:** up to 12 teams, one note line, and type scales up when few rank (26px at 6 or fewer, 22px at 9 or fewer, 18px above). Unranked teams moved to evidence.
- **On-card exceptions:** "N more tied at rank R" and "Only N goalies qualified..." still print, each only when it applies, because rows would otherwise look like a complete list or a mistake.
- **Plurals:** "1 start", "1 appearance", "1 official start" and "1 goalie" now read correctly on cards, evidence and alt text.

**Contract wording, for the lead:** CONTRACT §3 says the card "always shows" compared cells and N, and that every `unavailable` is "counted and shown". Compared cells and N now print on the page and in the alt text, not in the PNG, as you directed. A PNG shared alone no longer carries them, so §3 needs your edit or TJ's nod.

**Fit: calculated, not rendered.** About 860 available, 5 gaps of 5.

| Post, default rows | Fixed parts (px) | Each row's content (px) | Row after stretch (px) | Spare |
| --- | --- | --- | --- | --- |
| `goalie-period`, 8 a side, 5 categories | 137 | 82 | about 90 | about 67, or 50 with a tie line |
| `goalie-gsax`, 10 a side | 81 | 57 | about 78 | about 209 before stretch |
| `crease-shift`, 12 teams at 18px | 43 | 46 to 68 (2 or 3 goalies) | about 68 | fits up to 3 goalies a team on every row |
| `crease-shift`, 6 teams at 26px | 43 | up to 94 | about 136 | about 250 before stretch |

GSAx has room for more rows if the real render looks loose. A Crease Shift team with 4 or more goalies grows its row, so 12 such teams would clip; that is the case to measure. New spec tests assert no overflow and a band under 40px, for Period, GSAx and Crease Shift at 6 and 12 teams, so your run is the real check. No new real reads were made.

## Follow-up from TJ's Crease Shift review: share by game

TJ approved Goalie of the Period and GSAx, which are unchanged, and asked for a game-by-game line in each Crease Shift row.

- **The line:** across the window's games, oldest to newest, each starter's cumulative share of official starts, 0 to 100%, ending exactly at the printed share. It sits in a "SHARE BY GAME" column, with faint guides at 0, 50 and 100%. Values are in `data` as `goalie.series`, with the games in `team.series`.
- **Who draws:** G1 is the most starts in the window, G2 next, by the existing order. G3 or later draws dashed in neutral grey, stays in the row's text with its numbers. A goalie with no start, relief-only for instance, has no line.
- **Names:** each goalie's name and share print in the line's colour, and SHARE moved beside GOALIE, so the row reads without a legend.
- **Holds and gaps:** a goalie with no start in a game holds their count, so their share falls. Relief never counts. A game without one labeled starter, or a scheduled game with no report, is a gap, and **every value from that game on is null**, because the share so far is no longer known. Such a post is already partial or the team withheld, so a gap can't reach an exported card.
- **Traded goalies:** the line counts only that row's team.
- **PNG:** colours are SVG attributes, because html-to-image drops class styles on SVG children.

**Colours:** `teamsInfo` order is primary, secondary, light, jersey, accent, alt, dark, each lifted with Tuesday's `withNeonFloor` (4.5:1). A black or charcoal colour is skipped, because lifted it is plain grey, which isn't a team colour and is G3's line. G2 must be at least 180 apart from G1 on the redmean scale. All 32 pass a test on contrast and distance. **15 teams needed something other than primary and secondary:**

| Team | G1 | G2 | Why |
| --- | --- | --- | --- |
| BOS, PIT, LAK, UTA | Secondary | Jersey | Black primary skipped; G2 white or next |
| NJD, CAR, OTT | Secondary | Jersey | Black primary skipped |
| DAL | Secondary | Jersey | Black primary skipped. Green on dark green, the closest pair at 193 |
| VGK | Secondary (gold) | Jersey (red) | Charcoal primary skipped |
| ANA | Primary | Accent (white) | Secondary too close once lifted |
| CBJ, MTL | Primary | Jersey | Secondary too close to lifted navy |
| CHI, NYI, SJS | Primary | Jersey | Black secondary skipped |

The lift also changes shades: navy primaries (TOR, TBL, NYR, EDM, FLA and others) become a brighter blue, and several end up looking alike across teams, since they share hue. TJ should check VGK's red and DAL's two greens, the two choices least like their brand.

**Fit: calculated, not rendered.** 860 less a note of up to 2 lines (34), a gap (5) and heads (18) leaves about 803 for rows. Type dropped a step to make room for the line: 22, 19 and 17px.

| Teams | Line height (px) | Row content, 2 or 3 goalies (px) | Row after stretch (px) |
| --- | --- | --- | --- |
| Up to 6 | 110 | 115 | about 134 at 6 |
| 7 to 9 | 72 | 77 | about 89 at 9 |
| 10 to 12 | 50 | 55 to 66 | about 67 at 12 |

Width at 22px: fixed columns and gaps use about 759 of 1,008, leaving about 249 for the goalie name. A long name fits (about 200), but a long name **plus** "(also BOS)" for a traded goalie is cut with an ellipsis so the columns stay aligned. Spec tests assert no overflow and a band under 40px at 6 and 12 teams, and now check the lines and the PNG, so your run is the real check. No new real reads were made.

## Follow-up from TJ's second Crease Shift review: blocks and a rolling line

This replaces the running-share line above; the colour rules above still apply.

- **Blocks:** one per team game, oldest to newest, in `team.series[].starterId`. G1 and G2 use the team colours, any other starter is grey, and a game without one labeled starter or with no report is an empty outlined block. A starter is never guessed. A schedule gap inside the window adds a block, so that partial preview can show 11; such a post cannot export.
- **Rolling line:** `goalie.rolling`, each starter's share over the last `rollingSpan` games, 5 for L10 and L20, 3 for L5. It uses only games in the window, so any point can be counted off the blocks beneath it, and starts at game 5 of 10. It is null while any game in its span is unresolved, breaks there and resumes once the span is clear. The line's end is the last 5 games and differs from the printed SHARE, which is the whole window.
- **Removed from the card:** RELIEF, GS / GP, and the PREV count. Relief data stays in the snapshot. PREV prints the share only, so the legend says "up to the N games before", which stays true for a short comparison. A goalie with only relief in both windows now drops from the row.
- **PNG:** block and line colours are SVG attributes, and a test asserts no class on any SVG child.

**Fit: calculated, not rendered.** 803 for rows as before, with a two-line note. Chart height is `min(200, floor(803 / rows) - 8)`.

| Teams | Chart (px) | Goalie name room (px) | Row after stretch (px) |
| --- | --- | --- | --- |
| Up to 6 | 420 wide, 125 high at 6 | about 200 | about 134 at 6 |
| 7 to 9 | 460 wide, 81 high at 9 | about 190 | about 89 at 9 |
| 10 to 12 | 500 wide, 58 high at 12 | about 175 | about 67 at 12 |

Names up to about 20 characters fit by estimate. Three goalie lines fit at 12 teams, but 4 or more on many rows would still clip, which is the case to measure. No new real reads were made.

## Follow-up from TJ's third Crease Shift review: span 1, full width, one legend line, PREV N GP

This replaces the 5-game rolling line above. TJ asked for span 1 knowing the line follows the blocks.

- **Line:** `goalie.byGame` holds 1 if that goalie started the game, 0 if not, null if the game has no resolved starter. It starts at game 1, with a dot over each block. It breaks at a gap and picks up at the next game. Relief is 0. `rollingSpan` and `creaseRollingSpan` are gone.
- **Full width:** the first and last blocks touch the chart's edges. Points stay at block centres, so the line runs flat from each edge to the first and last points.
- **Legend:** one line of 143 characters, about 830px by estimate. The note is set not to wrap, so an overflow would show in the spec's width check. The full method moved to `evidence.sample`, including "Official starts ÷ completed team games", the empty block, guides, relief and PREV's span.
- **PREV N GP:** N is `team.comparisonGames`. If all shown teams share N, the header reads "PREV 10 GP". If N varies, the header reads "PREV" and each team's cell prints "8 GP", with the chart 36px narrower to pay for it. STD follows the same rule, and its N includes the recent games.

**Fit: calculated, not rendered.** The one-line note frees 17px, so 820 for rows. Chart height is `min(200, floor(820 / rows) - 8)`.

| Teams | Chart (px) | Goalie name room (px) | Row after stretch (px) |
| --- | --- | --- | --- |
| Up to 6 | 410 wide, 128 high at 6 | about 200 | about 136 at 6 |
| 7 to 9 | 450 wide, 83 high at 9 | about 185 | about 91 at 9 |
| 10 to 12 | 480 wide, 60 high at 12 | about 175 | about 68 at 12 |

Four or more listed goalies on many rows at 12 teams would still clip. No new real reads were made.

## Follow-up from TJ's fourth Crease Shift review: running start share

This replaces the per-game line above. TJ's VAN example, LMMLMLMMMM, is a test fixture and matches at all 10 games.

- **Line:** `goalie.runningShare`, starts so far ÷ team games so far, from game 1. Points sit over block centres and the line runs flat to the chart's edges. The last point equals SHARE. Relief is not a start, and G3 stays dashed grey.
- **Completed game with no resolved starter:** it counts as a team game and credits no one, and its block stays empty. The team's SHARE is still withheld under the existing rule, and the team is unranked, so this row does not reach the card. The line's arithmetic ends at starts ÷ games.
- **Scheduled game with no report:** SHARE's denominator leaves it out, so counting it would break "ends at SHARE". The value holds flat across its empty block instead. That post is partial and cannot export.
- **Legend:** "Line: running start share, ending at SHARE." One line of 139 characters. PREV N GP and PTS are unchanged. Chart sizes are unchanged from the table above, so fit is still calculated, not rendered. No new real reads were made.

## Follow-up from TJ: Goalie of the Period drops the TGV section and adds average ADP

**Removed:** the "goalies at each grade" section, with its `tgvLeague` data and CSS. Each row's grade chip, points and sparkline stay, and stay meaningful, because each board's head still reads "TGV grade (existing method)".

**Added:** one line at the bottom, for example "Avg ADP: Best 84.3 · Worst 156.0. Counted as undrafted (200): Best 3 of 8 · Worst 5 of 8." It is the mean over the goalies shown on each board. The fallback rule is in the evidence sample.

### Reads, 2026-11-01

Project `fyhftlxokyjtpndbkfse`, Supabase MCP `execute_sql`, single `SELECT` statements. Aggregates only, no player rows.

| # | Statement | Tables | Rows returned | Result |
| --- | --- | --- | --- | --- |
| R10 | Rows, numeric picks and highest pick by season | `yahoo_players` | 3 | Passed. See below |
| R11 | Duplicates and conflicts across all seasons | `yahoo_players`, `yahoo_nhl_player_map_read`, `wgo_goalie_stats` | 1 | Passed. 41 of 72 goalies have conflicting picks across seasons |
| R12 | The same join for season 2026 only, row count for the max read, column privileges | Same | 1 | Passed. 70 of 72 match one row, 2 match none, 0 match two |

| `season` | Rows | Numeric picks | Highest pick | Last updated |
| --- | --- | --- | --- | --- |
| 2025 | 1,494 | 256 | 151.3 | 2026-07-27 |
| 2026 | 1,608 | 269 | 150.7 | 2026-11-01 |
| null | 1,333 | 191 | **192.0** | 2025-08-27 |

### Rules

- **A goalie's value:** only the row with `season` = the current Yahoo season and `display_position` = G. Without this filter, 41 of 72 goalies could take a wrong pick from another season.
- **Join:** the same as Goalie Rescue, through `player_key` and `player_id`. A Yahoo row with two NHL ids, or an NHL id claimed by two rows, has no match and counts as undrafted.
- **Fallback:** the highest numeric pick across **all** rows, as the rule says, rounded up to a multiple of 10. Reads 716 rows, skipping "-", with a ceiling of 1,500.
- **Any failed Yahoo read, or no numeric pick at all:** "Avg ADP: unavailable", and the post is partial like a failed TGV read, so it cannot export.

**For the lead: the 192 comes from an old row.** It is in the null-season rows last updated 2025-08-27. The current season's highest is 150.7, which would give 160, not 200. I followed the ticket, so undrafted goalies count as 200.

**Fit: calculated, not rendered.** Fixed parts drop from 137 to about 105: section out about 55, line in about 23. Eight rows a side get about 94 each, against 82 of content. The spec checks the band and overflow.

## Blockers

None for building. Open: TJ's first real-output review (9.7) and the browser run of the spec.
