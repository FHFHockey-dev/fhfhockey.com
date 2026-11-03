# HockeyStats page audit and FHFH opportunities

Audited October 25, 2026. HockeyStats is strongest at turning its player-impact models into recognizable cards, searchable profiles, statistical explorers, and game and season simulations. FHFH already has substantial coverage of the fantasy decisions those products inform. The best near-term opportunity is to connect and complete FHFH's existing player, comparison, schedule, and goalie tools around a consistent fantasy player summary. Prospect research and genuine with/without analysis are more distinct expansion opportunities.

## Scope and evidence

- **Observed:** public rendered pages, visible controls, navigation, and requests made by those pages. REA captured 56 distinct URLs across 15 browser scenarios, including a longer second capture of one game. The browser processes used temporary profiles and were terminated after their scenarios.
- **Published:** explanations and commercial offerings stated by HockeyStats. These describe the site's models; they are not independent validation of their predictive quality or proof of its current production implementation.
- **Inferred:** the likely processing behind a feature. These explanations are explicitly marked below. No private source, database schema, training pipeline, subscription account, or privileged API was accessed.
- **FHFH evidence:** the public homepage and current local source on `octoberBranch`, starting at `86583ba6b`. Local implementation is distinguished from verified hosted availability. The checkout contains concurrent unrelated work, which this audit did not modify.
- **Inventory boundary:** page templates and named subpages, rather than a separate description for every player, game, or team. The public sitemap returned 1,176 URL entries, including 915 NHL player profiles, 179 NHL game pages, 32 NHL team profiles, and 12 Olympic team profiles. Navigation exposes additional routes omitted from that sitemap. Sitemap membership does not prove a page's completeness or freshness.

**Reading the implementation column:** O = directly observed behavior or request; P = published methodology; I = inference. Access gates and short-window loading limits are recorded where they affect the conclusion. A displayed control was not necessarily exercised; this is a product and implementation audit, not a full functional, security, or accessibility test.

## 1 Core pages and entity profiles

| Page or subpage | What it conveys or does | How it appears to work | FHFH comparison and opportunity |
| --- | --- | --- | --- |
| [Home](https://hockeystats.com/) | Scores and upcoming probabilities; standings projections; featured cards, scoring leaders, scouting, and goalie graphics. | O: server-supplied content plus client requests for leaders, goalie stats, portraits, and featured content. I: composes existing products into previews. E1. | FHFH's homepage already combines the slate, projected goals, standings, news, injuries, and tool links. Add coherent previews of accepted player summaries and recent role changes rather than another general landing page. |
| [Games](https://hockeystats.com/games) | A date-window scoreboard with season/team selection and pregame win probabilities. | O: hydrated scoreboard. P: player-impact and lineup-based simulations; advertised refresh cadence. E5. | FHFH has Game Grid, homepage games, `/game/[gameId]`, and NHL Predictions. Improve the handoff among those pages; a separate scoreboard would overlap. |
| [Game detail example](https://hockeystats.com/games/2026020001) | Scoring plays/video control, shot map, player and line comparisons, skater/goalie tables, Box WAR, and downloadable team graphics. | O: requests box score, scoring plays, play-by-play, lineups, and score adjustments. Data populated after a longer capture. I: joins events and shared-ice combinations, then renders tables and charts. E14–E15. | Existing game pages, Shift Chart, line-combo pages, and team shot views provide much of the foundation. A unified fantasy game recap could surface PP deployment, shooting, starts, and meaningful changes, with direct drill-downs. |
| [Projections and playoff odds](https://hockeystats.com/playoff-odds) | Projected points; playoff, round, Cup and first-pick probabilities; model/market selection; daily changes; consequential games; team spotlight. | P: WAR-derived team strength and 150,000 season simulations; approximately five-minute updates. O: standings and conditional-outcome displays. I: aggregates simulated outcomes into probabilities. | FHFH's game predictions and schedule difficulty are related inputs, but do not establish an accepted season simulator. This is a real product gap, with higher ongoing modeling and compute costs. |
| [Playoff bracket](https://hockeystats.com/playoff-bracket) | Series probabilities, simulated brackets, manual bracket construction, and share controls. | P: samples series outcomes while retaining completed results. O: build/simulate controls and bracket. E11. | FHFH already has a seasonal homepage bracket implementation. A user-editable simulator would be an extension; first prioritize fantasy playoff schedule planning. |
| [Players](https://hockeystats.com/players) | Player search and a route into profiles. | O: search and featured-player shell. I: name/identity lookup into a shared profile template. | FHFH already has global/player search and `/stats/player/[playerId]`. Improve entry points and search consistency rather than create a second player directory. |
| [Player profile example](https://hockeystats.com/players/sidney-crosby) | Bio, scouting, career tables, game logs, strength/rate controls, career charts, era-adjustment control, and current/microstat/historic card tabs. | O: separate requests for individual, on-ice, TOI, WAR, game logs, and scouting data. I: joins them by player identity; shared selectors drive views. E3. | FHFH already has summaries, game logs, heatmaps, radars, contextual/advanced metrics, and deployment tallies. Connect these with underlying-player pages and WiGO, keeping season and player context intact. |
| [Teams](https://hockeystats.com/teams) | Directory into NHL team profiles. | O: public route; initial text extraction showed a loading state. I: a shared team directory feeds slug-based profiles. | FHFH's Stats directory and linked team pages already serve this purpose. Improve discoverability if needed. |
| [Team profile example](https://hockeystats.com/teams/edmonton-oilers) | Projected playoff outcomes, likely opponents, games with the greatest playoff effect, historical performance, schedule, model components, projected lineup, tables, and cards. | O: requests playoff odds, team-specific games-to-watch, projected data, lineup and historical statistics. The current lineup is attributed to PuckPedia. I: reuses team-level aggregates and conditional simulations. E4. | FHFH's team page already has dashboard, schedule, historical stats, game-state, timeline, roster and shot-map tabs. Add fantasy-impact explanations and links; do not duplicate those tabs. |
| [Roster Builder](https://hockeystats.com/roster-builder) | NHL roster sandbox with team selection and guide, projections, simulation, roster, trade, UFA, player and methodology controls. | O: loads lineups, projected skaters, contracted players, draft picks, goalie projections and baselines. I: changes roster state and recalculates team-strength/simulation inputs. Mutation and simulation controls were not run. E2. | FHFH's Roster Schedule Optimizer solves a different problem: legal fantasy roster/schedule decisions. Borrow transparent before/after comparisons and saved scenarios; prioritize fantasy additions and drops over an NHL GM simulator. |
| [Franchise](https://hockeystats.com/franchise) | Coming-soon NHL management game and waitlist. | P: advertises contracts, trades, drafts, simulation, negotiation and chemistry. Only a promotional page was inspected; shipped game behavior is unknown. | No direct counterpart needed for FHFH's present utility. Treat as a separate business, not a feature to match. |

Sources: [Games](https://hockeystats.com/games), [playoff odds](https://hockeystats.com/playoff-odds), [win-odds methodology](https://hockeystats.com/methodology/win-odds), [bracket](https://hockeystats.com/playoff-bracket), [Franchise](https://hockeystats.com/franchise), and E1–E5/E11/E14–E15 in the evidence ledger.

## 2 Statistical tables

These pages share an exploration pattern: season/date scope, qualifiers, teams/players, situation, aggregation, rates, column selection, color coding, and Apply/Clear controls. Some controls vary by page. CSV controls were observed; their exported files were not downloaded and compared with the tables.

| Page | What it conveys or does | Likely implementation | FHFH comparison |
| --- | --- | --- | --- |
| [Skaters](https://hockeystats.com/stats/skaters) (`/stats` redirects here) | Individual, on-ice, speed and TOI views; season totals or game logs; raw, per-60 and per-84 modes. | O: populated table and parameterized stats requests. I: aggregate event/player-game records, then filter, normalize and sort. E5. | Existing underlying skater tables provide a substantial counterpart. Match consistent filter behavior, clear denominators and readable column definitions within the existing explorer. |
| [Goalies](https://hockeystats.com/stats/goalies) | Goalie season/game-log exploration with qualifications, aggregation and rate controls. | O: dedicated controls in public HTML. I: goalie-specific aggregates and shot-quality results. | Underlying Goalie Stats, player profiles and variance already overlap. Unify the quality, workload and upcoming-start handoff. |
| [WAR](https://hockeystats.com/war) | Player value above replacement, broken into component contributions. | P: xG, prior-informed ridge regression, shooting/saving and penalty impact; replacement baseline converts net goals into wins. | FHFH has ratings and research models, but these should not be described as the same metric. A comparable overall-impact model requires separate design, validation and interpretation. |
| [Box WAR](https://hockeystats.com/box-war) | Small-sample/single-game value; season or single-game view; GAA, GAR and WAR options. | P: distributes game-level offensive/defensive credit and compares with average/replacement baselines; uses EDGE-derived attribution. I: sum stored game contributions for selected windows. E7. | Useful inspiration for recaps. A fantasy category-contribution recap is more directly relevant and less demanding than reproducing Box WAR. |
| [Adjusted Points](https://hockeystats.com/adjusted-scoring) | Cross-era scoring comparisons through season, career and timeline views. | O: explains 82-game pacing and empty-net exclusions. I: normalizes scoring across environments and game states; exact adjustment needs a separate formula review. E7. | A limited fantasy benefit. Existing career charts are a better near-term investment. |
| [Teams](https://hockeystats.com/stats/teams) | Team counts, rates, possession/chance/goal results and selected contexts. | I: aggregate team-game/event data with state and score adjustments. | Already covered substantially by Underlying Stats, Team Table Explorer, and team pages. |
| [Lines](https://hockeystats.com/stats/lines) | League-wide forward lines and defense pairs, with TOI qualification and rate views. | O: populated combination table. I: intersect player participation intervals and attribute shared on-ice events. E7. | FHFH has lines, Date Range Matrix, and game-specific shared-ice matrices. A sortable league-wide combinations leaderboard would extend these rather than replace them. |
| [Line Tool](https://hockeystats.com/stats/line-tool) | Select team, players and strength to analyze combinations, presented as a WOWY tool. | O: selector interface and instructions. I: intersect included players' shared-ice intervals and compare selected combinations; exact exclusion semantics were not exercised. E7. | FHFH's present WiGO source is a player/window-comparison dashboard. Line-combo pages show shared TOI. Neither inspected surface establishes a general event-conditioned with/without tool. This is a meaningful candidate addition. |

Sources: [skater tables](https://hockeystats.com/stats/skaters), [goalie tables](https://hockeystats.com/stats/goalies), [WAR methodology](https://hockeystats.com/methodology/war), [Box WAR methodology](https://hockeystats.com/methodology/box-war), and E5/E7.

## 3 Visual dashboards

| Page | Purpose and controls observed | How it likely works | FHFH comparison |
| --- | --- | --- | --- |
| [Dashboard directory](https://hockeystats.com/dashboards) | Entry point to visual statistical tools. | I: routes to chart presentations of existing aggregates. E7. | Underlying Stats already owns a dashboard and explorer hierarchy. Preserve those boundaries. |
| [Skaters](https://hockeystats.com/dashboards/skaters) | Visual exploration of xG, goals, shots, attempts or a custom metric, with qualifiers and context. | I: chart selected fields from the filtered skater dataset. E10. | Extend the existing skater explorer with an accessible chart mode when it answers a clear comparison question. |
| [Goalies](https://hockeystats.com/dashboards/goalies) | Leaderboard, scatter plot and game logs; best/worst/all selections and game-state filters. | O: multiple chart modes. I: plot goalie quality/workload fields and selected logs. E10. | Combine existing goalie quality, variance and start information into a coherent journey. |
| [WAR](https://hockeystats.com/dashboards/war) | Multi-stat scatter and bar views; selectable WAR components. | I: visualize the same component outputs as the WAR table. E10. | A flexible offense/defense/usage scatter can be useful using existing accepted metrics; no need to call it WAR. |
| [Teams](https://hockeystats.com/dashboards/teams) | Team process comparison with metric, strength, score-adjustment and rate controls. | I: plot filtered team aggregates. E10. | Strong existing overlap with FHFH's team dashboard, explorers and timelines. |
| [Lines](https://hockeystats.com/dashboards/lines) | Forward-line/defense-pair comparison, selectable metrics and TOI thresholds. | I: chart shared-ice combination aggregates. E10. | Add a visual view to the existing line/matrix workflow if shared-ice event coverage supports it. |
| [Skating Speed](https://hockeystats.com/dashboards/skating-speed) | Speed-burst thresholds, position/team selection, qualification and rate modes. | O: 18+, 20+, 22+ MPH choices. P: NHL EDGE is named in the site's microstat explainer. I: normalize tracking aggregates by ice time or games. E10. | A distinct data dependency. Lower fantasy priority than role and PP changes; evaluate coverage and terms before considering it. |
| [Stats Central](https://hockeystats.com/dashboards/stats-central) | Route and heading exist. | Only the heading/navigation rendered during the capture; no working substantive tool was established. E10. | Do not treat this as a demonstrated competitor capability or a target to reproduce. |

## 4 Cards and scouting

The valuable design pattern is a compact, attributable summary that leads into deeper research and can be shared. The statistic must be clearly defined: a percentile is a rank within a specified population, not a probability of scoring or a percentage of total value.

| Page | What it conveys or does | How it appears to work | FHFH comparison |
| --- | --- | --- | --- |
| [Player Cards](https://hockeystats.com/cards/player-cards) | Overall projected WAR percentile, component strengths, goals/primary assists, usage/context and historical mini-charts. Featured preview; full access advertised at $5/month. | P: three-season weighted estimates with weights chosen through predictive testing; percentiles compare qualified forwards or defensemen. I: a reusable visual template consumes a projection record. | FHFH already has radars and card components. Complete accepted data connections and publish an original fantasy summary: shots, goals, assists, PPP, hits, blocks, TOI/PP role, sample, date and peer group. |
| [Goalie Cards](https://hockeystats.com/cards/goalie-cards) | Goalie quality, danger splits, start quality, rebound control, consistency and multi-year context. | O: featured card and download control. I: goalie projections and quality aggregates become peer percentiles. E6. | Existing variance, quality/workload and starter tools provide a foundation. Keep start probability separate from performance conditional on a start. |
| [Team Cards](https://hockeystats.com/cards/team-cards) | Team standings, goals, xG, special teams, finishing and goaltending ranks. | O: preview and component explainer. I: convert team aggregates into league/division ranks. E6. | Team rankings already exist locally. Add a compact summary to the current team page and share workflow. |
| [Historic Player Cards](https://hockeystats.com/cards/historic-player-cards) | Season-specific historical player evaluation, advertised back to 2008. | I: reuse the player-card template with archived season outputs. E6. | Optional archive mode after current summaries are accepted; not a separate first-priority project. |
| [Microstat Player Cards](https://hockeystats.com/cards/microstat-player-cards) | Passing, entries/exits, retrievals, rush/cycle creation and related skills, with a microstats/WAR toggle and seasonal controls. Advertised at $10/month. | P: AllThreeZones manually tracked samples, with coverage qualification; same-position tracked-player comparison groups. These are not all-game box-score fields. | No equivalent source was established in FHFH. A partnership or separately validated tracking product is needed for comparable measurements. Do not relabel shot data as tracked passing/entry data. |
| [Microstat Team Cards](https://hockeystats.com/cards/microstat-team-cards) | Team offensive/defensive tracked-event ranks; wide/square formats and download. | O: tracked-game/minute sample is displayed. I: aggregate own and opponent events across the same tracked games. E6. | Interesting later partnership opportunity; insufficient reason to build a new tracking pipeline now. |
| [Scouting Reports](https://hockeystats.com/scouting-reports) | Searchable written player evaluations, team/new-player filters and a downloadable scouting graphic. | O: featured prose and player lists. I: editorial reports stored against player identities; no evidence establishes AI generation. E6. | FHFH's editorial and podcast expertise is an advantage. Add dated, attributed fantasy interpretations and related episodes to profiles, with a maintainable update scope. |

Sources: [player-card explanation](https://hockeystats.com/about/player-cards), [microstat explanation](https://hockeystats.com/about/microstat-player-cards), [membership](https://hockeystats.com/subscribe), and E6.

## 5 NHL draft and prospect research

This is the NHL entry draft, not the fantasy draft. FHFH's Draft Dashboard already covers fantasy rankings, imports, blended projections, league settings and player comparison; it is not a substitute for prospect development research.

| Page | What it conveys or does | Likely implementation and limits | FHFH opportunity |
| --- | --- | --- | --- |
| [Draft home](https://hockeystats.com/draft) | Discovery hub for projections, prospect cards, NHLe and consolidated rankings. | O: preview modules and shared subnavigation. E8. | A separate dynasty/prospect section would serve an audience the current NHL fantasy tools only partly address. |
| [Tracker](https://hockeystats.com/draft/tracker) | Draft-board and top-remaining views. | O: both modes. I: selections update a ranked eligible-player pool. E9. | Later complement for rookie drafts; reuse fantasy draft UI only where identity and rules fit. |
| [Projections](https://hockeystats.com/draft/projections) | Prospect model outputs with draft cohort, position, team, nation and selection-status filters. | O: populated table and CSV control. P: prospect cards express NHLer/star outcomes. I: apply learned outcome models to normalized prospect features. E9. | Begin with transparent prospect profiles and source-backed inputs. Any outcome probabilities require historical validation and calibration. |
| [Rankings](https://hockeystats.com/draft/rankings) | Consolidated prospect rankings with filters and selected columns. | I: join multiple ranking sources by player identity and show rank comparisons. Exact aggregation formula was not established. E9. | A useful first prospect feature if ranking display/redistribution is permitted. |
| [Cards](https://hockeystats.com/draft/cards) | Prospect summary, equivalency history, star/NHLer outcome projections and rankings. | O: gated featured preview and draft-year mode controls. I: render profile/model data into a template. E9. | A future dynasty card should emphasize league, age, role, production, progression and uncertainty. |
| [Baseline](https://hockeystats.com/draft/baseline) | NHLer/star probability by draft position. | O: draft-slot probability chart. I: derive a historical empirical or fitted baseline. E9. | Valuable context for rookie-pick evaluation before adding complex prospect prediction. |
| [NHLe](https://hockeystats.com/draft/nhle) | Time-varying league equivalency comparisons, charts/tables, league groups and custom selections. | P: estimate comparable scoring across leagues from player transitions. I: apply year/league coefficients to scoring rates; do not assume one permanent factor. E9/E14. | Strong dynasty value, but requires reliable cross-league IDs, history and permitted inputs. |
| [Guide](https://hockeystats.com/draft/guide) | Linked explanation destination. | The captured page showed the common heading/navigation without substantive guide content. Do not count a usable guide as verified. E14. | FHFH should publish a practical guide with its prospect offering. |
| [Historical projections](https://hockeystats.com/draft/historical-projections) | Historical cohort comparison interface. | O: season/year filters and a zero-row table in the captured default state. Historical data coverage and successful selection were not verified. E9. | Archived predictions against later outcomes would support credible dynasty modeling. |
| [Historical cards](https://hockeystats.com/draft/cards-historical) | Prior prospect classes in the card format. | O: paid access gate; the preview still indicated loading. Content completeness was not established. E9. | Useful only after archived cohort data and original issuance dates are trustworthy. |

Sources: [Draft hub](https://hockeystats.com/draft), [NHLe methodology](https://hockeystats.com/methodology/nhle), and E8–E9/E14.

## 6 Olympic hockey

This is an event-specific analytics section. Its page structures are reusable, but a separate competition requires separate identities, schedules, event feeds and qualification rules. FHFH has no corresponding competition section in the inspected route inventory.

| Page or template | What it conveys or does | Likely mechanism or limit |
| --- | --- | --- |
| [Olympics home](https://hockeystats.com/olympics) | Cards, leaders, schedule and routes into tournament analysis. | I: competition-filtered versions of shared display components. E8. |
| [Bracket](https://hockeystats.com/olympics/bracket) | Qualification/medal rounds and match probabilities. | P: 10,000 game simulations; tournament-specific advancement structure. E12. |
| [Cards](https://hockeystats.com/olympics/cards) | Player/team tournament cards with paid access and featured samples. | I: competition-specific performance aggregates and peer ranks. E12. |
| [Schedule](https://hockeystats.com/olympics/schedule) | Fixtures and completed-game access. | I: tournament schedule/results feed. E12. |
| [Odds](https://hockeystats.com/olympics/odds) | Gold, silver, bronze and any-medal probabilities. | I: aggregate tournament simulations. The captured page retained probabilistic gold odds while the hub declared a winner; archive/as-of semantics need clarification before treating these as current odds. E8/E12. |
| [Teams](https://hockeystats.com/olympics/teams) | National-team directory with profile descriptions. | I: country identity and roster mapping. E12. |
| Team profiles, e.g. [Canada](https://hockeystats.com/olympics/teams/canada) | Directory advertises roster, player profiles, scouting and statistics. | Linked template family; individual team internals were not independently exercised. |
| [Skater stats](https://hockeystats.com/olympics/skater-stats) | Player production with national/NHL affiliation filters and rate/column controls. | I: aggregate tournament player-game data. E12. |
| [Goalie stats](https://hockeystats.com/olympics/goalie-stats) | Goalie results and configurable columns. | I: tournament goalie records. E12. |
| [Team stats](https://hockeystats.com/olympics/team-stats) | Table/dashboard views and totals/per-game controls. | I: team-game aggregates. E12. |
| [Scoring chances](https://hockeystats.com/olympics/scoring-chances) | Chances, chance assists and contributions for skaters/teams. | O: credited to Dimitri Filipovic. This is another distinct source dependency, not evidence those measurements come from the site's ordinary NHL feed. E12. |

**FHFH value:** an event hub could support podcast/editorial coverage and audience acquisition. Build only around a concrete event and operating plan; it ranks below core fantasy tools.

## 7 PWHL

| Page | What it conveys or does | Likely mechanism | FHFH comparison |
| --- | --- | --- | --- |
| [Home](https://hockeystats.com/pwhl) | Skater and goalie leaders with metric and rate choices. | I: PWHL-specific player/goalie aggregates feed shared leaderboard patterns. E8. | A genuine new competition opportunity, requiring user demand and a sustainable data source. |
| [Skaters](https://hockeystats.com/pwhl/skaters) | Season/team/position qualification, selected columns, raw/per-60/per-game rates. | I: competition-specific records with shared table presentation. E13. | Existing table patterns can help; NHL data assumptions cannot simply be copied. |
| [Goalies](https://hockeystats.com/pwhl/goalies) | Goalie statistics, minimum games, aggregation and display controls. | I: goalie records and quality model outputs. E13. | New goalie/shot-quality coverage would need separate validation. |
| [Teams](https://hockeystats.com/pwhl/teams) | Team metrics by season, totals or per-game. | I: team-level aggregates. E13. | Extend only after competition identity and coverage are accepted. |
| [Games](https://hockeystats.com/pwhl/games) | Team-filtered schedule/results. | I: a competition schedule feed. E13. | Lower-cost entry into PWHL coverage than immediately promising a complete model suite. |

## 8 Community and utility pages

| Page or family | What it does | Likely implementation and verification limit | FHFH comparison |
| --- | --- | --- | --- |
| [Articles](https://hockeystats.com/articles) and [article detail example](https://hockeystats.com/articles/2014-nhl-draft-retrospective) | Editorial index and linked draft retrospectives. | O: dated/bylined article entries. I: stored editorial content with reusable detail templates; the underlying CMS was not identified. Article detail was linked, not fully audited. E8. | Blog and podcast already exist. Link relevant analysis from player/team contexts and keep bylines/dates visible. |
| [Offer Sheet Lottery](https://hockeystats.com/offer-sheet-lottery) | Explore historical draft-pick outcomes for compensation packages, with range/goalie/CBA selections and a comparison player. | O: Spin and keep-player/take-picks controls. I: samples eligible historical selections, aggregates their outcomes, compares them with a player. No spin was run. E8. | A fantasy rookie-pick outcome explorer could be useful later; the literal offer-sheet game has lower recurring utility. |
| [Salary Cap Calculator](https://hockeystats.com/tools/salary_cap_calculator) | Named premium calculation tool. | Only the access gate was observable. Its formula, supported scenarios and correctness remain unknown. E11. | Consider salary-cap/keeper tools only for demonstrated league needs. Do not scope an implementation from the tool's name alone. |
| [Awards voting](https://hockeystats.com/awards) | Seasonal fan ballot entry point. | O: voting is closed. Submission behavior and duplicate-vote controls were not tested. E11. | FHFH has community draft-ranking routes; season awards could support community/editorial events. |
| [Awards results](https://hockeystats.com/awards-results) | Trophy-specific rankings, ballot shares, counts and expanded lists. | I: aggregate ranked ballots into weighted totals and percentages. Exact weights were not verified. E11. | Reuse existing community-ranking experience for a bounded seasonal campaign. |
| [Subscribe](https://hockeystats.com/subscribe) | $5/month card tier, $10/month advanced tier, and $100/month supporter/API tier; annual discount option and Patreon linkage. | O/P: public plan descriptions and UI. I: entitlement records control access. Checkout, API rights, enforcement and billing behavior were not tested. | FHFH already has Draft Pro/account foundations. Organize paid value around validated user jobs; subscription pricing here is a snapshot, not a pricing recommendation. |
| [Sign in](https://hockeystats.com/auth/signin), [create account](https://hockeystats.com/auth/create-account), linked account/Patreon management | Access, personalization, sample unlocks and membership association. | O: links and `/api/auth/session` requests. Authentication provider, account internals and entitlement security are unknown. | FHFH already has auth/account flows. Favorite-team/player shortcuts could improve return visits if supported by current account contracts. |
| [Terms](https://hockeystats.com/terms), [Privacy](https://hockeystats.com/privacy), [Contact](https://hockeystats.com/about/contact) | Policies and support. | Public utility destinations; no legal assessment or contact submission performed. | Maintain accurate policy/support entry points for FHFH's actual offerings. |

## 9 About and methodology subpages

| Page | What it explains | Implication for FHFH |
| --- | --- | --- |
| [About](https://hockeystats.com/about) | Organizes people, contact, models and product explainers. | A compact methods/help directory would make existing FHFH metrics easier to trust and use. |
| [Overview](https://hockeystats.com/about/overview) | Founders and purpose. | Explain FHFH's editorial/data roles and what users should rely on each tool for. |
| [Methodology hub](https://hockeystats.com/methodology) | Entry point to model documentation. | Document each accepted model's inputs, intended use, horizon, sample, known limitations and validation. |
| [WAR](https://hockeystats.com/methodology/war) | Impact components, adjusted regression, replacement baseline and limitations. | Separate descriptive impact, predictive skill, and fantasy scoring value. |
| [Expected goals](https://hockeystats.com/methodology/expected-goals) | New xG model, tracking/data drift, short-miss treatment, XGBoost and validation approach. | State which provider/model generated an xG number; account for changed event definitions and model versions. |
| [RAPM](https://hockeystats.com/methodology/rapm) | Isolating player contribution using regularized regression. | Shared-ice correlation is not automatically isolated individual effect. |
| [Box WAR](https://hockeystats.com/methodology/box-war) | Small-sample credit allocation and its assumptions. | Label any single-game summary as descriptive unless separately validated for forecasting. |
| [Win odds](https://hockeystats.com/methodology/win-odds) | Player rates, TOI, shooting/saving, team composition and simulation. | Distinguish the displayed model version from older methodological explanations. |
| [NHLe](https://hockeystats.com/methodology/nhle) | Cross-league scoring translation and prospect outcomes. | Explain cohort, era, age and league effects before showing confident dynasty comparisons. |
| [Player Cards](https://hockeystats.com/about/player-cards) | Weighted projections, peer populations, contextual fields and percentiles. | Every FHFH summary needs a visible population, window, denominator and missing-data rule. |
| [Team Cards](https://hockeystats.com/about/team-cards) | Team metric/rank interpretation. | Put short definitions beside team ratings and retain a deeper explanation link. |
| [Microstat Player Cards](https://hockeystats.com/about/microstat-player-cards) | Manually tracked metrics, definitions and sample coverage. | Measurements from different sources should remain distinguishable and attributable. |

The older win-odds article names Daily Faceoff lineups, while the sampled live team page attributes projected lineups to PuckPedia. That does not invalidate the model, but it prevents treating the article as an exact description of all current production inputs.

## 10 What the observable architecture establishes

1. **Next.js rendering is directly visible.** The captured DOM contains Next.js/Turbopack assets, and route prefetches include React Server Component requests. The site combines initially available content with client-loaded modules. This explains why some text-only results are incomplete.
2. **The browser consumes specialized read endpoints.** Examples include `/api-n/stats/nhl/leaderboard`, `/api-n/stats/nhl/war`, `/api-n/player-game-logs`, `/api-n/box-score`, `/api/live-games-pbp`, and roster-builder projection/baseline routes. Endpoint names and parameters establish the interface observed, not the database engine or internal service architecture.
3. **Multiple pages reuse the same conceptual datasets.** Profiles, cards, tables and dashboards expose overlapping statistics. A shared underlying aggregation/projection layer is a strong inference, not proof of a particular backend module layout.
4. **Model outputs and display transformations are separate concerns.** Published methods describe xG, player-impact and simulation models. Percentiles, ranks, rates, charts and card layouts are presentation/aggregation layers around those outputs.
5. **Some data advantages depend on other organizations.** AllThreeZones tracking, PuckPedia-attributed lineups/cap information, NHL identities/events/tracking, and credited Olympic chances are different inputs. Public visibility does not establish redistribution rights or a suitable FHFH license.
6. **Membership is part of the product journey.** Featured examples advertise the value before unlocking the catalog. UI gates were observed; server-side enforcement was not tested. Do not infer a security finding from public preview data.
7. **Advertising and analytics execute alongside tools.** Raptive/AdThrive and analytics requests were observed. Their business impact and page-performance effect were not benchmarked.

## 11 FHFH capability map from current source

These are existing code paths, not an assertion that every feature is accepted or currently enabled on the hosted site.

| FHFH surface | Existing implementation evidence | Result of the comparison |
| --- | --- | --- |
| Home and navigation | `web/pages/index.tsx`; `web/components/Layout/NavbarItems/NavbarItemsData.ts` | The public homepage confirms the same core fantasy navigation. Use it to lead into a few clear daily decisions. |
| Stats discovery | `web/pages/stats/index.tsx` | Player search, team discovery, skater/category leaders and goalie leaders already exist. Preserve this as discovery. |
| Player profiles | `web/pages/stats/player/[playerId].tsx`; `web/components/PlayerStats/PlayerRadarChart.tsx` | Summaries, logs, charts, heatmaps, contextual/advanced metrics, positional comparisons and deployment already exist. Integration and clarity are the opportunities. |
| Underlying statistics | `web/lib/navigation/analyticsSurfaceOwnership.ts`; `web/pages/underlying-stats/playerStats/index.tsx`; `web/pages/underlying-stats/index.tsx` | Explicit owners exist for team intelligence, filtered tables, skater/goalie explorers, xG review and movement. A new generic stats hub would create overlap. |
| Team profiles | `web/pages/stats/team/[teamAbbreviation].tsx`; `web/components/TeamTabNavigation/TeamTabNavigation.tsx` | Team dashboards, schedule, season statistics, game state, timelines, roster and shot maps already exist. |
| Trends and variance | `web/pages/trends/index.tsx`; `web/pages/variance/skaters.tsx`; `web/pages/variance/goalies.js` | Existing movement/variance tools are directly relevant to fantasy users. Improve transitions to player and schedule decisions. |
| Schedule and roster planning | `web/pages/game-grid/index.tsx`; `web/pages/roster-schedule-optimizer.tsx` | Tools exist in navigation/source. This audit did not execute real-account acceptance or establish that every optimizer data path is ready. |
| Lines and shared ice | `web/pages/lines/line-combo/[gameId].tsx`; `web/pages/drm.tsx` | Projected lines, observed shared-ice matrix and date-window deployment analysis are existing foundations. General include/exclude WOWY results are not established by these files. |
| WiGO | `web/pages/wigoCharts.tsx` | Current page provides player overview, trends, percentiles and comparisons between statistical windows. Do not equate the name with a verified with/without event engine. |
| Draft comparison | `web/components/DraftDashboard/DraftDashboard.tsx`; `web/components/DraftDashboard/ComparePlayersModal.tsx` | Two-player comparison with radar and projection metrics is already implemented. Reuse it for a broader in-season comparison only after defining compatible inputs and league scoring context. |
| Player-card studio | `web/pages/social-share/player-cards.tsx`; `web/components/player-cards/PlayerCardShareStudio.tsx` | Access-gated, noindex studio exists. It uses fabricated fixture statistics and explicitly keeps live statistics/premium activation off. This is a completion/acceptance opportunity, not proof of a live card catalog. |
| NHL predictions | `web/pages/nhl-predictions.tsx`; `web/lib/game-predictions/publicPredictions.ts` | Game prediction and accountability presentation exists. It is not evidence of a qualified full NHL season simulator. |
| Seasonal bracket | `web/pages/index.tsx`; `web/components/HomePage/HomepagePlayoffBracket.tsx` | Homepage bracket support already exists. Interactive bracket simulation would be incremental. |
| Player Forecasts | `web/pages/player-forecasts.tsx` | Explicitly labeled a private shadow system with research gates and forecast accountability. It remains separate from FORGE and cannot be counted as accepted public projection coverage. |

## 12 Recommended FHFH additions and extensions

Effort is relative: **small** = principally presentation/navigation on accepted inputs; **medium** = several existing contracts/UI surfaces to reconcile; **large** = new data, modeling, permissions or substantial operational acceptance. These are sequencing judgments, not calendar estimates.

| Priority | Concrete change and proposed home | User value | Reuse and dependencies | Effort |
| --- | --- | --- | --- | --- |
| 1 | Complete an original fantasy player summary within the existing player page; connect the card studio only when its data is accepted. | Quickly understand category strengths, role, sample and schedule, then inspect the supporting details. | Reuse profiles, radar/stat contracts, deployment and card work. Replace fixtures through an accepted identity/source contract; require sample/as-of/peer labels and rights for export. | Medium |
| 2 | Add clear methods/help and provenance links to current tools, with a compact directory such as `/about/metrics`. | Users can interpret ratings, percentiles, xG, variance and predictions correctly. | Reuse actual metric contracts and validation evidence; explain each provider/model and missing-data behavior. | Small–medium |
| 3 | Extend existing two-player comparison to in-season research, reachable from player profiles and tables. | Decide between two adds, drops or starts using current role, category rates and scheduled opportunity. | Existing draft Compare is the base. Define realized vs projected values, compatible time windows, schedule horizon and optional league scoring. | Medium |
| 4 | Connect a weekly streaming view across Game Grid, current role evidence and RSO. Prefer an extension of existing tools before a new `/streaming` route. | Identify usable extra games and targeted category opportunities for the user's actual lineup constraints. | Schedule coverage, current eligibility/role, reliable availability and RSO acceptance. Owned percentages must not be presented as league-specific free-agent availability. Forecasts enter only when qualified. | Medium–large |
| 5 | Add a goalie decision summary spanning existing goalie profile, variance and Start Chart. | Compare chance of starting, opponent, expected workload and performance uncertainty in one place. | Reuse quality/workload and starter evidence. State source/time and separate likely starter from confirmed starter. | Medium |
| 6 | Extend lines/matrix with a true include/exclude WOWY explorer, e.g. an added analysis mode under `/lines`. | Assess production/shot quality with and without a linemate, and understand potential PP/line changes. | Correct event-to-shift joins, selected strength, shared minutes, stable identities and minimum samples. Association does not establish a causal promotion effect. | Large |
| 7 | Build fantasy game recaps on the existing game detail page. | Explain what changed: PP time, shot volume, line assignment, goalie usage and the evidence behind it. | Existing boxscore/shift/line/team views; bounded reads and cached aggregates. Do not generate confident narratives from missing or conflicting source data. | Medium |
| 8 | Add a focused prospect/dynasty hub, proposed `/prospects`. Start with profiles, cohort context, source-backed rankings and draft-slot baselines. | Support rookie drafts, keeper evaluations and longer-term planning. | New cross-league identity/history and permissions. Add NHLe and model probabilities only after validating them. Distinguish NHLer probability from fantasy usefulness. | Large |
| 9 | Consider an NHL season/playoff forecast page and interactive bracket. | Helps playoff pools and NHL-following engagement; some roster-context value. | Validated/calibrated game-strength model, schedule/tiebreakers, injuries/lineups, retained forecast vintages and bounded batch simulation. Serve cached outputs; do not make repeated viewer requests trigger heavy recomputation. | Large |
| 10 | Add dated fantasy scouting notes and related podcast/blog links to profiles. | Brings FHFH's editorial judgment next to the data that motivated the visit. | Named editorial ownership, source attribution and an update scope the team can sustain. | Small–medium |

### Sequence the work around the fantasy decision

The strongest user journey is: **find a player → understand role and category profile → compare alternatives → inspect usable games → make a roster decision**. The first five recommendations strengthen that journey with substantial reuse. Their acceptance and dependencies should be resolved before spending on a new independent modeling suite.

Defer a literal NHL Franchise game, broad cap/contract simulation, historical-era scoring project, unlicensed microstat replicas, and general competition expansion. Each may attract interest, but each also creates a new operating commitment. PWHL and event coverage should move up only with a concrete audience and data plan.

## 13 Product lessons and material limitations

- **Carry context across tools.** HockeyStats repeatedly links players, teams, cards, profiles and model explainers. FHFH should preserve player/team, season, window, strength and filters when moving between its existing surfaces.
- **Make the brief summary useful on its own.** A compact card is valuable because it compresses interpretation. Keep the underlying values and definitions reachable; do not hide uncertainty behind a single attractive score.
- **Show sample and freshness close to the number.** Tracked-game counts, projected-versus-observed labels, source identity and clear as-of dates matter as much as the chart type.
- **Separate archives and current forecasts.** HockeyStats' Olympic hub/result and odds pages illustrate how final outcomes and retained probabilities can coexist without sufficiently clear time framing. Its NHL bracket also showed differing year labels in the title/body. FHFH should make archive state explicit.
- **Avoid overclaiming from loading states.** Draft Guide and Stats Central showed headings without substantive content in their capture windows; historical prospect views remained empty/loading. These are unresolved page-completeness observations, not proven permanent outages. The sampled NHL game did populate after an eight-second wait.
- **FHFH's public trust details deserve attention too.** The inspected homepage displayed repeated source-report entries and unresolved player identities. Those are observed presentation issues; diagnosing their ingestion cause is outside this audit. Improving them may be worth more than another feature preview.
- **No predictive superiority was established.** Model descriptions and validation claims were reviewed as site publications. No independent benchmark, backtest or accuracy comparison with FHFH was run.
- **No production change was made.** No purchases, account creation, ballots, waitlist/contact messages, roster simulations, FHFH jobs, database writes, pushes, builds or deployments were performed. FHFH live access was limited to homepage retrievals; comparison of its deeper tools used local source. No application tests were warranted for this report-only task.

## Evidence ledger

Full retained browser records: [REA evidence bundle](./rea-evidence.json). The bundle contains DOM/accessibility and request metadata; captured controls are evidence of the interface, not proof that every action works. Formal capture completeness describes requested capture sections, not complete product validation.

| Ref | Scope | REA Evidence ID |
| --- | --- | --- |
| E1 | Homepage DOM, accessibility and network | `ev_513502783d1dd1efc7f333dbab336746f45d075da382fa4b89d895aa460a467f` |
| E2 | Roster Builder | `ev_5012de24d8dea4112707ffd0907d7ff0a1f5f111422683d8bde00a816b095953` |
| E3 | Sidney Crosby profile | `ev_a71fcaf978ca67a2b194ce4405f1dd172988fdcb80ca4df376580d73e3d933cb` |
| E4 | Edmonton team profile | `ev_da337be31cdf3a038847b9739c367ffc8a307694a919ffa3562f910ab4d36d7e` |
| E5 | Games and skater table | `ev_080eebe1ac2ced3b9cc782d4301a2c4e956b12d7cbfea1391dd77474d52b7d0d` |
| E6 | Team/goalie/historical/microstat team cards and scouting | `ev_1855adcc79ce7fb8ff4129dc94ad3b2d37077bd2ac6c782be9cc482217576296` |
| E7 | Box WAR, adjusted scoring, line tables, Line Tool, dashboard hub | `ev_5e24566b06458f15e68893e7edff702dfacd527085916d1bebe3149ae42d1a8a` |
| E8 | Draft/Olympic/PWHL/article hubs and offer-sheet game | `ev_487562065bb9b1735ce089667310b016d0d5edbb2153dec2dc0b756373631a58` |
| E9 | Eight draft subpages | `ev_945a2f6a9e22a7619e35c16c10d6db9b2320a6dab9f94f18c3100a8bf844d37f` |
| E10 | Seven dashboard subpages | `ev_6918fd43f06b9edeccc21f1bf739658241810ebd4b6fd59d9cca4f08ff086e43` |
| E11 | Cap calculator gate, NHL bracket and awards pages | `ev_cdf4c3d99b825b94af3c7548854f6c98e2b5e99f2e3616f1245019ff4568d4f5` |
| E12 | Nine Olympic subpages | `ev_ca469c962d0b3b6456f46505ea505afc3fb86f95abd6bbf44b49227cf1dbba0b` |
| E13 | Four PWHL subpages | `ev_4dd79b953845ea2ac21a96d1e56bd7e66a64044bcd0b05e4c00df70c17d1d080` |
| E14 | Initial game, draft guide, NHLe methodology | `ev_2f3a59a14d4afffb0d3742db5a6fbe6b82075754654e3ac0262ccee5707b2226` |
| E15 | Settled game detail after longer wait | `ev_48f7bd359036fdcf109bcf116932b90fa3f296d675dc010ea232d0776e531c6b` |

### Checklist closure

- Page/subpage inventory: answered for public navigation, discovered sitemap families, named subpages and representative entity templates; gated account internals and every dynamic instance are outside coverage.
- What pages do: answered where rendered content established the feature; partial for gated calculator, unshipped Franchise game and incomplete guide/historical views.
- How pages do it: observed frontend interfaces and published models documented; server internals, exact contemporary model code and unexercised actions remain unknown.
- FHFH cross-reference: answered from public homepage plus named source paths, with private/illustrative work distinguished from accepted production capabilities.
- Valuable additions: ranked with proposed homes, existing work to reuse, data dependencies and relative effort. These recommendations do not authorize implementation or activation.
