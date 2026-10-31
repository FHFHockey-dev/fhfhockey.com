# Social Share expansion: shared contract (SS 1.0)

Frozen 2026-10-31. Every lane builds to this. A change needs the lead's agreement, and a change to §5 also needs the Player Cards owner's. Requirements: [PRD](../../TASKS/prd-social-share-expansion-2026-10-31.md), [coverage packet](../../player-cards-social-share-coordination-2026-10-31.md). Sources: [SOURCES.md](SOURCES.md). Lanes: [LANES.md](LANES.md).

## 1. The post seam

A new post is only these files, all owned by its lane:

| File | Holds |
| --- | --- |
| `web/lib/socialShare/modules/<name>.ts` | Definition and pure calculations, created with `defineShareModule`. Must not import Supabase |
| `web/lib/socialShare/modules/<name>.test.ts` | Calculations and states on fixtures |
| `web/lib/socialShare/modules/<name>.sources.ts` | Optional. Server reads, reached only through the definition's lazy `load` |
| `web/components/SocialShare/modules/<Name>Card.tsx` | The card body, reached through the lazy `card`. Optional `<Name>Card.module.scss` |
| One line in `web/lib/socialShare/modules/lanes/<lane>.ts` | Each lane owns its barrel. `registry.ts` is frozen and already imports all of them |

[teamGames.ts](../../../web/lib/socialShare/modules/teamGames.ts) is the worked example. Reach any post at `/social-share/posts?post=<id>`.

A post never edits `SocialShare.tsx`, `SocialShare.module.scss`, `types.ts`, `server.ts`, the `[format]` page or API, or `modules/contract.ts`. It writes its own E2E as `web/e2e/social-share-<name>.spec.ts`, not in the shared spec.

| Concern | How a post inherits it |
| --- | --- |
| Post selection | The Post library page lists every registered post by group, with no calendar. `suggestedUse` is a note such as "Works for a Thursday or Friday post". Nothing is scheduled or published |
| Access | `/social-share/posts` sits behind `SocialShareAccessGate`. `/api/v1/social-share/posts/[post]` calls `requireSocialShareAccess` before any read, and answers `private, no-store` and `noindex` |
| Settings | Each threshold is a `fields` entry. The shell renders it, shows its default, keeps it in the URL, validates it on the server, and prints its active value on the card and in the PNG. Unknown query keys are refused. Use `clientOnly` for filters like search, which change the view with no refetch |
| Labels | `evidence` is required on every load result: sources with as-of times, sample, strength, cohort, coverage. The shell's footer prints it and the post renders only the body, so a post cannot drop it. `basis` prints as the watermark |
| Unavailable | A failed loader becomes `missing` with no data. `stale`, `missing` and `blocked` show the reason in place of the card. `partial` previews with its warning and watermark and cannot export. Fixture snapshots are watermarked and cannot export |
| Same-snapshot PNG | The shell captures the node on screen. `data-export-token` covers edition, post and all settings, and is checked before capture, after assets settle and after the PNG exists, along with state, expiry, labels and `hasRows`. Export never refetches |
| Empty pools | `hasRows` false means no export, and the card says why. Never add filler |

Monday and Tuesday are untouched: `SocialShare.tsx` gained one header link, `export.ts` moved its capture steps into `captureSharePng` with the same order and checks, `trendSources.ts` exported `bounded`, and `editionFetch.ts` accepts `posts/<id>` paths. `category-rescue` and `player-spotlight` stay gated until 13.0 decides their disposition.

## 2. Shared definitions

| Term | Definition | Single producer |
| --- | --- | --- |
| Identity | NHL player id and goalie id. Yahoo joins only through `yahoo_nhl_player_map_read`, where an id mapping to two NHL ids is dropped. Name is display only | Existing `players.ts` and `trends.ts` map rules |
| Team | The team of that game (`team_abbrev`, `team_abbreviation`), never current team or Yahoo team. Traded players' games bind to the team they played for | `skaterAppearances.ts`, `goalieLedger.ts` |
| Season | `currentSeason(date)`, 8 digits. Regular season only (`games.type = 2`; WGO base tables). No carry across seasons | `schedule.ts` |
| Timezone and cutoff | `America/New_York`. An edition's cutoff (`through`) is the day before its New York date unless a post proves today's games final | `editionDate` in `definitions.ts` |
| Game finality | `games` has no status. A **completed team game** is a `wgo_team_stats` row for that team and game, dated within the cutoff. Coverage compares these with `games` for the same dates: expected is games × 2 | `toCompletedTeamGames` |
| Appearance | A `wgo_skater_stats` or `wgo_goalie_stats` row with a game id. A DNP has no row and is not an appearance. A null stat is **missing**, never zero and never a failure | `toSkaterAppearances`, `toGoalieAppearances` |
| L5, L10 | Last 5 or 10 **completed appearances** of that player, this season. Fewer are shown as the actual count (`short`) | `lastN` |
| Previous window | The N before the recent N, with no shared game: `previousN`. Matched recent and previous pairs stay available everywhere | `previousN` |
| STD and overlap | Season to date through the cutoff. It contains the recent games, so every L5 or L10 versus STD view discloses the overlap count. `seasonExcludingRecent` is the non-overlapping baseline | `versusSeason` |
| Goalie start share | Official starts ÷ **completed team games** in the window. Never appearances. Relief is counted apart. Null unless every window game has exactly one labeled starter. Descriptive, never a start probability | `teamStartShare` |
| Week windows | Skater and schedule posts: Monday to Sunday via `selectedDates`, with weekly and rest-of-week from the frozen edition. Goalie Category Counts: `yahoo_matchup_weeks` | `schedule.ts`; §3 |
| Strength | Default **all situations** (WGO and NST `as`/`all`). Every value states its strength. Never compare across strengths. NST individual ixG is not on-ice xG | Each module's evidence |
| Units | TOI in seconds internally, shown m:ss. **NST goalie `toi` is minutes**; WGO is seconds | Reader or module, converted once |
| BSH | BLK + SOG + HITS. Missing any component means unknown. Shot attempts are never a substitute | `bsh` |
| Pooled rates | SV% = ΣSaves ÷ ΣSA; GAA = ΣGA × 3600 ÷ ΣTOI seconds; per-60 = Σcount × 3600 ÷ ΣTOI. Never a mean of rates. A zero denominator means unknown | `pooledSavePct`, `pooledGaa`, `per60` |
| Ownership | Yahoo rostered %, from `yahoo_players` and history, never the map view's legacy zero. A stated 0 is **known**. Null is **unknown**, shown `—`, never 0%. Low-ownership filters exclude unknown unless a visible setting includes it. See SOURCES: no 0 currently exists at source | `ownershipOf`, `ownershipInRange` |
| Thresholds | Nightly Floor is strict: value > X, and exactly X fails. ≥1 point and exactly-zero views are separate | `strictlyAbove` |
| Cohort | Named on every card: who was eligible, N, and the filters. An empty pool stays empty | Module evidence |
| Coverage admission | WGO-based windows must be complete or the post is `partial`. NST-based values: a player needs at least the post's `minCoverage` (default 90%) of window appearances with that metric. Show numerator, denominator and missing count. Unadmitted players are unranked, never zero-filled | Module, using `coverage` |
| Ties | Competition rank (1, 2, 2, 4) with `competitionRanks`. Equal values share a rank, and id only orders display | `competitionRanks` |
| Timestamps | Each source reports `asOf` (newest game or observation) and `updatedAt` where the table has one. Edition time is `generatedAt`; default expiry 15 minutes | Module evidence, shell |
| Claim types | Observed, market observation, hypothetical and conditional forecast are distinct `basis` values. No fabricated consensus, odds or predictive certainty. Confirmed status is independent of forecast qualification | `basis` |

Also reuse, unchanged: `lib/socialShare/score.ts`, `mondayGrid.ts` and `matchups.ts` for Week Score and team rates; `trends.ts` for Tuesday.

### Default settings

All are `fields`, so they are visible and adjustable. These are chosen starting points, not findings.

| Post | Setting | Default | Range or options |
| --- | --- | --- | --- |
| What Changed | Recent window; min season GP | L5; 10 | L5, L10; 1–82 |
| BSH | Window; comparison; min GP; position | L10; previous 10; 5; all | L5, L10, STD; previous N or STD; 1–82; F, D, all |
| Role Watch | Window; min TOI change; min PPTOI change | L5; 60 s; 30 s | L5, L10; 0–600; 0–600 |
| Off-Night Edge | Ownership ceiling; include unknown; dates | 50%; off; rest of week | 0–100; on, off; weekly, rest of week. Top 16 teams and one F plus one D per team are fixed by SS-R07 |
| Nightly Floor | X for SOG, HITS, BLK; window; min GP; ownership; min coverage | 2, 2, 1; L10; 5; 0–100; 90% | 0–10; L5, L10, STD; 1–82; 0–100; 50–100% |
| Crease Shift | Window; comparison | L10; previous 10 | L5, L10, L20; previous N, STD |
| Category Counts | Min starts, week and month; categories | 2; 5; §3 default five | 1–7; 1–20; any of §3 |
| Busy/Quiet | Basis; min starts | Per start; 3 | Per start, per appearance, per 60; 1–82 |
| Goalie Category Rescue | Ownership ceiling; min starts | 50%; 3 | 0–100; 1–82 |

## 3. Category Counts (TJ, 2026-10-31)

A **new, separately labeled method** for Goalie of the Week, Goalie of the Month and best/worst rankings. Existing TGV grades stay unchanged and appear beside it under their own label "TGV grade (existing method)". `goalieCalculations.ts` is not edited. Producer: `web/lib/socialShare/modules/shared/categoryCounts.ts` (SS 9.0). Inputs: `toGoalieAppearances` and `yahoo_matchup_weeks`, not the weekly views, which turn empty rates into 0.

**How it differs from TGV.** TGV counts ties as better, skips zero baselines, and converts a percentage into a grade. Category Counts reports above, below and tied separately, keeps a real zero baseline, and has no grades or borrowed thresholds.

**Categories and direction.** `lower` means a smaller value is better. Default five are marked.

| Category | Game value | Week value | Direction | Compared at | Default |
| --- | --- | --- | --- | --- | --- |
| Wins | Decision win, 1 or 0 | Sum | higher | Exact | Yes |
| Saves | Saves | Sum | higher | Exact | Yes |
| SV% | Saves ÷ SA | Pooled | higher | 3 decimals | Yes |
| GAA | GA × 3600 ÷ TOI | Pooled | lower | 2 decimals | Yes |
| Shutouts | 1 or 0 | Sum | higher | Exact | Yes |
| Goals against | GA | Sum | lower | Exact | |
| Losses | L + OTL | Sum | lower | Exact | |
| Quality starts | 1 or 0 | Sum | higher | Exact | |

Shots against, TOI, GP and GS are workload, with no good direction, so they are not categories. The older `statMap` direction for them is not inherited.

**Cells.** Each comparison gives one cell for a goalie, category and period unit. A cell records `above` or `below` (numeric, relative to the baseline) or `tied`, or `unavailable`. Cards also show `better` and `worse`: for `higher` categories above is better; for `lower` categories below is better. A tie is neither.

**Periods.**
- **Game cells:** each official start, compared with its matchup week's game baseline. Relief appearances get no game cells and are shown as a separate count.
- **Week cells:** each `yahoo_matchup_weeks` week in which the goalie has at least one official start, using that goalie's week totals, including relief rows, compared with the week baseline. A relief-only week gives no cells and is counted apart.
- **Goalie of the Week:** one matchup week. Its counts are that week's game cells and week cells.
- **Goalie of the Month:** a New York calendar month. Game cells cover games dated in the month. Week cells cover the weeks with most of their days in the month (an even split goes to the later month), and the card lists those weeks.
- **In progress:** a week or month past the cutoff is labeled "through <date>". The default selection is the last completed one.

**Cohort and baselines, recomputed per week.** The pool is every goalie league-wide with at least one official start in that week, including the goalie being compared.
- Count categories, game: Σvalue ÷ official starts in the week.
- Count categories, week: Σ week totals ÷ eligible goalies in the week. This rewards volume, as weekly fantasy scoring does, and the card shows starts beside it.
- Rate categories: pooled across the pool's starts for game baselines, and across the pool's full totals for week baselines. Never a mean of rates.

**Missing and zero.**
- A goalie's null stat, SA of 0 (SV%) or TOI of 0 (GAA) gives `unavailable`, which is neither tied nor worse.
- An empty pool or zero denominator means no baseline, so every cell for that category is `unavailable`.
- **A baseline of 0 is valid.** With no shutouts all week, a goalie's 0 ties. Known zero values are compared like any other.
- Every `unavailable` is counted and shown.
- A period containing a team game without exactly one labeled starter is `partial` and cannot export.

**Ranking.** Eligibility: at least `minStarts` official starts in the period (week 2, month 5, visible and adjustable). Below that, a goalie shows no rank.
1. Primary: game-cell net, which is better − worse.
2. Tiebreak: week-cell net.
3. Tiebreak: better ÷ compared cells, at game level.
4. Anything still equal shares the rank.

**Best** is rank 1, so co-winners are possible. **Worst** is the same ranking from the bottom. The card always shows per-category above, below and tied, compared cells, starts and N, so the ranking never hides its evidence. It is not a forecast, and GSAx is shown only as separate labeled context.

**Worked example.** A week's pool has 40 starts, 1,120 saves, 1,240 SA. The game baseline is 28.00 saves per start and SV% 1120 ÷ 1240 = .903. A start with 28 saves on 31 shots: saves `tied` (28 = 28.00), SV% .903 `tied` (.903 at 3 decimals). A start with 0 SA and 0 TOI recorded: SV% and GAA `unavailable`, saves `below`.

## 4. Sentiment and comparison evidence

Player vs Player uses a **manual, reviewed** candidate file: `web/lib/socialShare/modules/playerVsPlayer.candidates.json`, each with URL, date, platform, quoted or paraphrased claim, selection rationale and limitations. No URL means no claim. Absent or conflicting evidence prints "No consensus established". Gemini and any automated discovery are a capability assessment only, with no credentials or provider setup (SS 5.0).

## 5. Goalie schedule and risk inventory (frozen for PC-R11)

The interface is [goalieInventory.ts](../../../web/lib/socialShare/modules/shared/goalieInventory.ts), `goalie-inventory-v1`. It contains only types, so a consumer imports no Supabase code. Player Cards may build on fixtures of this shape now.

- **Implementation:** SS 11.0 writes `modules/shared/goalieInventory.sources.ts`, exporting `loadGoalieInventory: LoadGoalieInventory` and `searchGoalieInventory: SearchGoalieInventory`.
- **Confirmation** comes from `player_forecast_goalie_start_observations`. `goalie_start_projections.confirmed_status` is never true and is not used. That table has no anon access, so until its access is decided (SOURCES, fact 3) a live inventory reports `none` and says why in `reasons`.
- **Forecast** is `qualified` only for an admitted Start Chart `startParticipation` (`official_starter`, `start` basis, unexpired). A raw `start_probability` is `unavailable`. Confirmation never implies a forecast and needs none.
- **Signals** are three separate lenses (volume, ratio exposure, win support). They are correlated, so they are never combined into one score and no win or start odds are given.
- **Start Chart producers are read-only.** Nothing in the inventory edits them.
