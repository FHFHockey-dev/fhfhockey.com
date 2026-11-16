# Fix lane F8: F3's unowned Lines items, 2026-11-13

## Scope
Brief from the Chef (CHEF // Math Audit 11-11-2026, local_78a99adf; the brief's id local_016832c1 is "not found"). Freeze 18:30 UTC.
1. `web/pages/lines/[abbreviation].tsx`: stale HeaderProps comment ("Defaults to the legacy grouping, which is what Lines serves today").
2. `web/pages/lines/index.tsx`: promotions/demotions rows carry no line source; 32 × `getLineCombinations` adds one `team_unit_toi` read per team per ISR regeneration (report or batch).
3. `web/components/LineCombinations/LineShareBars.tsx` (+ `.module.scss`, test): confirm the TOI issue, then fix.
Owned: those files and their tests. Read only: `fiveOnFiveUnits.ts`, `utilities.ts` (F3).

## Where
- octoberBranch at 53045f5b6 (start). Owned files clean at start.

## State
- Confirmed in code:
  - Item 3: `TOISeconds` = each player's all-strength `skatersGameStats.toi` summed over the team's last 10 line games (`utilities.ts` 268-277, 341-343; not per game, not 5v5). LineShareBars sums the members' totals with `?? 0` (`LineShareBars.tsx` 24-27) and calls it the line's "share of ice time". So a player who dressed for fewer of the 10 games, a missing TOI, or a short line shrinks that line's bar; PP and PK time counts too. F3 saw TOR L2 at 17.4% against about 24% for L3 and L4. No DB read made (brief allows none).
  - Item 2: the team_unit_toi reader filters team_id, game_id, unit_type but not season_id; both indexes lead with season_id.
- Ticket sent to Chef: own `web/styles/Lines.module.scss` for a row source caption class. Pending.
- Code done (uncommitted):
  - Item 1: HeaderProps comment now describes the disjoint 5v5 units and the labelled legacy fallback; `SkaterStats` documents `TOISeconds` and adds `numGames` (already selected by the reader, now typed). Comment-only change: no test can fail on it.
  - Item 3: LineShareBars compares lines by the mean of their players' all-strength TOI per game played; unknown TOI/games withholds every TOI share ("—" + note), never 0; an empty line has no share; goals 0/0 shows "—". Copy names the window, all strengths, and that time and goals away from the line count.
  - Item 2: `RowData.lineSource` set per team in getStaticProps (all four push sites); each row shows "5v5 units" / "Legacy lines" (aria-hidden caption, `.lineSource` class) and the hidden sentence ends ", by 5v5 units" / ", by legacy lines"; a one-line legend (`.sourceNote`). Without the SCSS grant the classes are undefined and the text renders unstyled.
- Tests: LineShareBars 3, index 5, header 6 = 14 pass. Swap checks (HEAD source, then restored): 2 new LineShareBars tests fail on old code; 2 index tests fail on old code (new label test; McDavid fixture updated to the new hidden sentence).
- ESLint exit 0 (1 pre-existing `<img>` warning, line 515).
- ISR cost (item 2), not batched: per team `getLineCombinations` makes 8 Supabase reads (seasons, lineCombinations, rosters, team_unit_toi, skatersGameStats ×2, goaliesGameStats, wgo_goalie_stats), was 7; landing ≈ 259 reads per regeneration, was ≈ 227 (+14%). The team_unit_toi read has no `season_id` filter while both indexes lead with `season_id`, and it reads every snapshot of the 2 games (rows grow with snapshots). Batching needs F3's `utilities.ts`: ticket, not done here.

- `npm run typecheck`: first run exit 2 (3 errors in my new index test: `props` possibly null); fixed; rerun exit 0.
- CSS Modules pure check script: scratchpad `pure-check.js` (sass + postcss-modules-local-by-default, mode pure); baseline OK on both stylesheets.
- Committed 60874b471 (items 1 and 3 + mailbox claim): LineShareBars.tsx/.test.tsx, [abbreviation].tsx, CLAUDE-TO-CODEX.md.

- Chef granted `web/styles/Lines.module.scss`. Applied the staged `.sourceNote`, `.lineChanges` and `.lineSource` styles; pure check OK. Vitest: 10 files, 81 tests pass (LineCombinations + pages/lines); ESLint exit 0.
- Committed 655b3263b (item 2): index.tsx, index.test.tsx, Lines.module.scss.
- Visual check not run (needs TJ approval; /lines fans out about 259 production reads per load).
- Hand-over note: side-session-notes `F8-lines-leftovers.md` (includes utilities.ts tickets T1-T3).

- Report sent; the Chef verified 60874b471 and 655b3263b (81/81) and handed F8 `utilities.ts` (+ tests, `fiveOnFiveUnits.ts` if needed) for T1 and T3; F3 finished.
- T1 committed a4f98e059: both team_unit_toi reads filter season_id; read 1 (unit_number 1) finds each game's latest snapshot; read 2 takes only those dates (bounded at 2 snapshots per game when the games' latest dates differ; extras dropped in code); a game with no rows skips read 2. Test fails on the old query (swap check). 15/15; ESLint 0; typecheck 0.
- T3 committed febf0546e: `fiveOnFiveUnitSeconds` (each board unit's 5v5 clock seconds in the last game; null on legacy) → `lineShareLines` on the page → LineShareBars "5v5 time share" on the 5v5 board; legacy keeps all-strength TOI per GP. 4 tests fail on old code (swap check); 10 files 84/84; ESLint 0.
- Typecheck after T3: exit 2, one error in `pages/api/v1/db/cron-report.ts:2357` (Codex-owned; another session's uncommitted edit). None in F8 files.
- T2 (batched landing reader): deferred past tonight by the Chef.

## Next step
- Report T1/T3 SHAs to the Chef. Retire this diary once the Chef records the outcome.

## Gotchas
- Mailbox claim: CLAUDE-TO-CODEX.md (rule 3), committed with the first commit.
- Mailbox race: between my diff check and the commit, lane F5b appended its uncommitted claim (`CLAUDE-FIX-F5B-CLAIM-20261113`), so 60874b471 carries it. Append-only text, nothing lost; no reset (rule 7). Tell the Chef. Next time commit the mailbox alone right after appending.

## Round 3: T2 (batched landing reader), TJ approved via the Chef, 16:57 UTC
- Owned: utilities.ts, fiveOnFiveUnits.ts, their tests, lines/index.tsx and its test. Not F17 social share, getPowerPlayBlocks.ts, penaltyClock.ts.
- Claim committed a2b2ef5a2. Gotcha: `git commit -- <path>` commits the working-tree file, so F5b's uncommitted DONE entry rode along (append-only; no reset). Next time stage the blob and commit without a pathspec.
- Plan: `getLatestLineChanges(teamIds, seasonId?)` in utilities.ts: seasons 1 + lineCombinations paged 200 rows by startTime desc until every team has 2 games (normally 1 read) + team_unit_toi heads and rows paged by id (shared with the per-team path, so the latest-snapshot and 5v5/legacy choice are the same code). Landing: one call; UTA fallback via the same reader.
- Read count at HEAD (febf0546e): getTeams 2 + 32 x 9 (seasons, lineCombinations, rosters, team_unit_toi x2, skatersGameStats x2, goaliesGameStats, wgo_goalie_stats) + players 1 + news 2 = 293.
- T2 committed 3e7e42aa4: `getLatestLineChanges` + shared parse / 5v5 fetch (per team-game, many teams, paged by id) / board choice used by both paths; landing makes one batched call (UTA fallback via the same reader).
- Checks: vitest 10 files 88/88; swap check 5 new or changed tests fail on old source (restored, cmp OK); npm run typecheck exit 0; ESLint exit 0 on the 4 files.
- Reads per regeneration: 293 before; after = getTeams 2 + seasons 1 + lineCombinations 1 (200-row page) + team_unit_toi heads 1 + unit rows ceil(rows/1000) (estimate 2-4; not measured, no prod read) + players 1 + news 2, about 10-12.
- Behaviour change: a failed batch read fails the regeneration (ISR keeps the last page) instead of skipping one team.
- Next: report to the Chef; retire this diary once the Chef records the outcome.
