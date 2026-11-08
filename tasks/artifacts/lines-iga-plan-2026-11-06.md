# Lines IGA plan (2026-11-06)

This plan finishes the Lines page in three layers: the entry lineup, the in-game adjustments (IGA) rail with a separate source feed, and next-game defaults. FxTwitter intake feeds it, through the existing provenance and reconciliation engine.

**Inputs:**
- Gap report: `tasks/artifacts/lines-iga-gap-report-2026-11-06.md` (accepted)
- Style audit: `tasks/artifacts/Lines-Superstyle-Audit-2026-11-06.md` (6 High / 13 Medium / 10 Low)
- TJ's design pop-ups (below)

Chef diary: `tasks/diaries/2026-11-06-claude-lines-iga-chef.md`.

## Design decisions (TJ, pop-ups 2026-11-06)

1. **Layout: sidebar tabs.**
   - Desktop: the entry lineup on the left. One right sidebar with two tabs: "In-game updates (N)" (interpreted) and "Source feed (N)" (raw tweets, relays collapsed under the original).
   - Mobile: entry lineup first, then two sections that start collapsed.
   - Width follows the 90% page-width rule.
2. **Authority: the original author.**
   - Authority comes from the original author: team account > beat reporter > aggregator. The relaying poller account never confers it.
   - The six hockey accounts (DFOFantasy, NHL_Rosters, CcCMiddleton, GameDayLines, GameDayNewsNHL, GameDayGoalies) carry claims into both lanes. The claim's own phase decides its lane.
   - FHFHockey is excluded from both lanes.
   - A relay never counts as independent confirmation.
3. **Trainer: reviewed override.**
   - A labelled tweet's `answerKey.expected` becomes a reviewed decision for that tweet's claims (`relationAuthority: "reviewed"`). It only applies if `textSha256` matches.
   - Unlabelled tweets go through the automatic producer rules.
   - `web/scripts/tweet-trainer-regression.ts` gates producer changes.
4. **Practice: a context marker.**
   - Claims and answer keys carry a context: `warmup` | `game` | `practice` | `projected`.
   - Practice claims fill only the expected entry lineup or next-game PP, at the lowest priority, labelled "Practice report, not game-confirmed".
   - They are never IGAs. Warmup beats game, game beats practice, and practice beats projected/carried.
5. **PP expiry: superseded or stale.** A carried PP1 or PP2 unit ends when any of these happens. Each ending shows its reason.
   - A newer applicable report for that unit arrives (pregame, practice or in-game).
   - A carried player is ruled out, scratched or off the roster.
   - Three team games pass without reaffirmation.
6. **PP swaps: apply them to a base unit.**
   - A partial swap ("X and Y replace A and B on PP2") applied to an accepted 5-player base unit produces a derived unit that cites both the base and the swap claims.
   - Without a base unit, the swap stays an observation only. Nothing is invented.
7. **Freeze: at read time, then on the next run.**
   - The API computes the frozen entry in memory from stored claims once the NHL state reads LIVE: pure, with no writes on GET.
   - The next processor run persists it.
   - No new cron.

Standing rule: even-strength IGAs are never carried forward automatically.

## Lanes and exact file ownership

All lanes work in the canonical checkout `/Users/tim/Code/fhfhockey.com` on `octoberBranch` (AGENTS.md sole-checkout rule) and commit with explicit pathspecs only. Two lanes never write the same file. Everything not listed under a lane is read-only for it.

### Lane A: Engine (`lines-engine`, new session, starts now)

**Owns:**
- `web/lib/lines/**`, including new files
- `web/pages/api/v1/lines/projected.ts` and `web/__tests__/pages/api/v1/lines/projected.test.ts`
- The `processLineSnapshotEvidence` call site only in `web/pages/api/v1/db/update-lines-ccc.ts`, plus its test `web/__tests__/pages/api/v1/db/update-lines-ccc.test.ts`
- `web/pages/api/v1/db/update-line-sources.ts`, call site only, if needed

**Work:**
- **A1, contract commit (first).** Add these to `web/lib/lines/types.ts`:
  - claim `context` (`warmup | game | practice | projected`)
  - authority tier
  - `GameTeamLines.feed: SourceFeedItem[]`: raw captures, with original author, relays, text, published/ingested times, binding status and an embed URL
  - `PPDecision.endReason` and `derivation` (base and swap claim IDs)
  - a response-level entry view (`expected | entering`, frozen-at)
  
  Report the SHA to Chef. Lane B starts on it.
- **A2, decision producer** (`web/lib/lines/decisions.ts`). It builds a per-claim `LineEvidenceContext` from the interpretation and source metadata:
  - kind, phase and context, with evidence spans
  - binding from explicit game, opponent+date or relative date+timezone spans; never from a timestamp alone
  - publication attestation from the provider timestamp
  - the original author
  
  It replaces the missing `metadata.lineEvidence` producer and is wired in `processor.ts`.
- **A3, authority** (`web/lib/lines/authority.ts`). Original-author tiers. The seed list is proposed to TJ by pop-up before it is used.
- **A4, trainer override** (`web/lib/lines/trainerDecisions.ts`). Read-only lookup of `tweet_pattern_review_items.metadata.answerKey`. It handles v1 now and v2 (Lane E) when it lands.
- **A5, reconcile.**
  - The PP expiry rule (decision 5).
  - PP swap derivation (decision 6).
  - A context ranking (decision 4).
  - Practice claims are never IGAs.
- **A6, service.**
  - The read-time freeze (decision 7).
  - The feed assembly with relay dedup across the IFTTT wrapper id and the FxTwitter original id.
  - Index scope: the API answers a no-scope request with a clear 400, which Lane C stops sending.
- **A7, CCC.** Call `processLineSnapshotEvidence` from `update-lines-ccc.ts`.

**Tests:**
- `env -u GIT_DIR npm test -- lib/lines __tests__/pages/api/v1/lines __tests__/pages/api/v1/db/update-lines-ccc.test.ts`
- `npm run typecheck` (read the exit code)
- lint on the changed files

**Fixtures:**
- The Sabres PP2 swap:
  - it is a practice-context claim, never an IGA;
  - with a base unit it becomes a derived projected PP2;
  - "Kuluch" stays unresolved without an approved alias.
- A relay/original pair that dedupes to one capture and gives no extra confirmation.
- A freeze on LIVE with no mid-game tweet.
- PP expiry, once by supersession, once by a scratched player and once by 3-game staleness.
- A timestamp-only tweet that stays unbound.

### Lane B: Snapshot UI (`lines-ui`, new session, starts after the A1 SHA)

**Owns:**
- `web/components/LineCombinations/GameLineSnapshots.tsx` and `.test.tsx`
- `web/components/LineCombinations/ProjectedLineups.tsx` and `ProjectedLineups.module.scss`
- new `web/components/LineCombinations/SourceFeed.tsx` and its test
- new `web/components/LineCombinations/reviewReasonCopy.ts`

**Work:**
- Sidebar tabs and mobile collapsed sections (decision 1).
- Grouping by forwards, defence, goalies, PP1 and PP2.
- A source and status line on each unit:
  - Confirmed
  - Projected
  - Practice report, not game-confirmed
  - Carried forward from {date · opponent}, plus the end reason
  - Derived from swap
- "Lineup entering the game" from the entry view.
- Plain-language copy for unresolved reasons.
- The source feed reads cleanly without embeds (text, time, author, relay chip).
- No 8-report paging limit on the rail: show the full list, or windowed rendering that keeps every item reachable.
- Style-audit rows owned by this lane:
  - "Lineup publishing is disabled": render nothing, or a quiet note (High 2)
  - hex literals mapped to tokens
  - the site's blue focus ring
  - heading order h2 → h3
  - no headings inside cards

**Tests:**
- `env -u GIT_DIR npm test -- components/LineCombinations`
- `npm run typecheck`
- lint
- the pure CSS Modules check
- a visual check on TJ's `:3000`, desktop and 390px (never a second `next dev`)
- a local axe scan

Lane B also runs `/superstyle` itself once the lane is done, unless TJ prefers to.

### Lane C: Page shells and legacy grid style (`lines-pages`, new session, starts now)

**Owns:**
- `web/pages/lines/index.tsx`, `[abbreviation].tsx`, `[abbreviation].module.scss` and `line-combo/[gameId].tsx`
- `web/styles/Lines.module.scss`
- `web/components/LineCombinations/{PlayerCard/**,Line/**,CategoryTitle/**,LineShareBars.*,LineCombinationsGrid.tsx,utilities.ts,__test__/**}`

Shared components, which must get a cross-page before/after check:
- `web/components/PowerPlayCombos/**`
- the `web/components/LinemateMatrix/**` legend only
- the `web/components/TeamSelect/**` focus ring only

**Work:** the style-audit rows owned by L and S.
- **High 1:** page order. Lines and PP come first, then the own-team matrix. Drop the last-opponent matrix or move it below.
- **High 3:** gutters.
- **High 4:** sweater-number contrast, using `contrast()` from `lib/socialShare/teamNeon.ts`.
- **High 5:** one `<main>`.
- **High 6:** the `line-combo/[gameId]` shell: h1, NextSeo, game context, the 90% workspace, no empty `getServerSideProps`. The `?isScreenshot=1` Discord path must keep working.
- **Index:** stop mounting `<ProjectedLineups/>` with no scope. Link to team pages, or list live and next games.
- **All Medium and Low rows owned by L or S.**

The H row (the bottom-nav toenail) is site chrome. Log it for its owner; it is not part of this lane.

**Tests:**
- the nearest Vitest files
- `npm run typecheck`
- lint
- the pure CSS Modules check
- a before/after check on `:3000` for each change
- local axe

### Lane D: Parser IGA support (blocked: other owners hold these files)

**Files:**
- `web/lib/sources/tweetInterpretation.ts`
- `linesCccIngestion.ts`
- `lineupSourceIngestion.ts`
- `lineSourceLineCombinations.ts`
- the tests for all of the above

These are uncommitted work of the swipe-trainer, position-aware-names and power-play lanes. **Gate:** those owners commit their `web/lib/sources/*` changes first.

**Work:**
- `in_game` context detection, with spans.
- PP as a sub-unit, not a row type.
- Partial and change-only units: in/out players and a unit number; never invent the rest.
- Audit High #1 and #3: DFO `🥅:` goalie lines and goalie state.
- High #4: prefer the first complete lineup.
- High #5: transactions are not injuries.
- Expose FxTwitter provenance on source metadata:
  - `raw_payload.fx` original or repost author
  - quoted text
  - alt text
  - `first_seen_at`
  - `publicationTimeBasis: provider_timestamp`

**Tests:**
- `env -u GIT_DIR npm test -- lib/sources`
- the trainer regression runner against every answer key, with no regressions
- `npm run typecheck`

### Lane E: Trainer v2 fields (ticket to the existing `swipe-trainer` session)

**Files:** the owner's own:
- `web/lib/sources/tweetSwipeTrainer*.ts`
- `web/components/TweetSwipeTrainer/*`
- `web/pages/api/v1/db/tweet-pattern-review.ts`

**Work:** answer key v2.
- The context marker (decision 4).
- Game binding (game, or opponent+date).
- Scope (`full | partial | change`) and PP swaps (in/out per unit).
- The regression runner scores the new fields.
- v1 keys keep working.

**Tests:** the owner's existing trainer tests, plus the regression runner.

## Sequence

1. Start A and C now. Send E as a ticket to `swipe-trainer`. Ask the owners of D's files to commit (Chef relays; nothing is forced).
2. A1 contract SHA → start B.
3. D starts when its gate clears. A2 takes D's provenance fields as they land; until then it reads what metadata exists.
4. Chef verifies each lane: git show, test output, screenshots. Chef then integrates and builds one release candidate (commit-tree on origin/master, gated in a clean export).

## Production approvals (each a separate pop-up; nothing happens without one)

| # | Action | Notes |
|---|---|---|
| P1 | Apply migration `20261002134400_game_line_snapshots` to prod, and register it in `migration-authority.json` | Creates the `line_*` tables and the `append_line_decisions` RPC. No new migration is planned: the new fields live in payload jsonb. Any lane needing one must ask. |
| P2 | Push the release candidate to master | One fhfhockey build plus three canceled builds (release footprint). |
| P3 | Set `LINES_OBSERVATIONS_ENABLED=true` and redeploy | Shadow writes only; nothing is served. Then up to 5 read-only checks of the `line_*` tables after one real game night. |
| P4 | Set `LINES_ENTRY_SERVING_ENABLED=true` and redeploy | Serves the new UI. Then a bounded smoke test (5 or fewer GETs). |
| P5 | Set `LINES_PP_CARRY_FORWARD_ENABLED=true` and redeploy | After at least one accepted in-game PP observation exists. |
| P6 | FxTwitter cutover for DFO, GameDay and CCC | X-intake lane (`Twitter scraper pipeline replacement`), not Lines. Lines consumes the queues either way. |

Env-only redeploys get canceled by the Ignored Build Step, so each flag change needs a clean-export CLI deploy with approval.

**Acceptance.** Master Task List lines 189, 187 and 191 close only on genuine evidence from a real game night: real source, game and time, a frozen entry, at least one in-game observation and the PP carry outcome. Local tests do not close them.

## Rules for every lane

- No production writes, migrations, deploys or pushes without TJ's explicit pop-up approval.
- Run tests as `env -u GIT_DIR npm test …`. Use `npm run typecheck` and read its exit code.
- Use the pure CSS Modules selectors check, and follow `tasks/TASKS/rules/fhfh-styles.md`.
- Use TJ's `:3000`. Never start a second `next dev`. If one is unavoidable, use `PLAYWRIGHT_ISOLATED_NEXT=1`.
- Commit with explicit pathspecs. Use plain commit messages with no AI attribution or Co-Authored-By.
- Keep a diary in `tasks/diaries/`.
- Ask every question with an AskUserQuestion pop-up, recommended option first.
- For independent sub-work, start new sessions with `start_session`, not Agent subagents. Use subagents only for read-only research you synthesize yourself.
