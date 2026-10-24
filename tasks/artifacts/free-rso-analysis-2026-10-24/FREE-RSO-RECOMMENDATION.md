# Free RSO recommendation for TJ

**Recommendation: add a free, no-input schedule-and-player discovery view to the RSO. Preserve the existing free manual optimizer.** A visitor should immediately see the remaining NHL schedule, the strongest schedule tiers and plausible pickup candidates from those teams. No roster, provider connection, account or scoring setup should be required to browse. Call the results **streaming options**, with global Yahoo rostered percentage and historical rates clearly identified. Without a roster and league availability, these are not optimized add/drop recommendations.

Claude's social-share work supplies most of the selection machinery. It does **not** supply a finished public product. The share studio remains role-gated and uncached; a separate public response contract, bounded query space, cache integration and public UX are needed. A newer SS1-14 implementation appeared during this inspection: unlike the earlier ticket 13 receipt, it now preserves tier-list rows in the server response. This is local source evidence, not proof of deployed behavior or completed acceptance.

Two corrections to Claude's proposal are essential: do not automatically mark a discovery player `manager_available`, and do not move manual scoring, projections or legal roster planning behind payment. The current code already exposes shared forecast inputs publicly and gates provider synchronization, account saving and upkeep separately. [RSO data route:8–35](../../../web/pages/api/v1/roster-schedule-optimizer/data.ts#L8-L35), [capabilities:1–2](../../../web/lib/in-season/access.ts#L1-L2).

## 1. Evidence boundary and inspected state

- Prepared on **2026-10-24**, from `/Users/tim/Code/fhfhockey.com`. Source pin captured at **2026-10-24T22:20:00.678735Z**. [SOURCE-PINS.json](SOURCE-PINS.json) records SHA-256, byte size and line count for 56 inspected source/evidence files. This pins individual local file states; it is not an atomic Git snapshot.
- No Git command, branch change, commit, deployment inspection, app edit, test run, server, credential access, permission change, provider request or live database read was performed. The sole-checkout instruction names `octoberBranch`; the actual branch/HEAD was intentionally not inspected. Claude's ticket 13 receipt identifies its own base as `2a5092d37…`; that attribution is not a verified identity for the current tree. [Receipt 13:7–14](../cross-platform/2026-10-24-coordination/handoffs/SS1/RECEIPT-13.md#L7-L14).
- Release coordination is active. This task owns this report and supporting analysis artifacts only; no canonical register was changed. Later source changes require reconciliation with these pins before implementation or release.
- Claude's original **FREE-RSO-ANALYSIS.md**, Library `libfile_3f369e15d8448191acf14999be40fa16` (supplied as 311 lines / 29,611 bytes), was read in full from the supplied transcript. It remains intact; this is a separate report. Its proposals and historical measurements are treated as claims to verify.
- **Unknown:** production enforcement flags, deployed source identity, current data coverage, provider rights for expanded public redistribution, actual anonymous runtime usability and current cost. None can be inferred from a local default, fixture or historical receipt.

## 2. Current flows: free manual already exists

| Visitor / mode | Current local behavior | What limits usefulness without input |
| --- | --- | --- |
| Anonymous, new workspace | RSO page has no sign-in gate; default provider is Manual. Shared planning data and a separate schedule reader are public. Workspace persists in localStorage. | Empty roster; unknown add timing/cost/allowances; empty scoring weights; player availability unknown and initial canonical eligibility unverified. |
| Anonymous or signed-in Manual user | Can enter/paste a roster, review positions, scoring, add rules, locks and availability; can use the existing local planning machinery when inputs and forecast policy permit it. | Manual setup and verification are real prerequisites to actionable comparisons. A quick discovery visit should not require them. |
| Signed in, no provider sync used | Manual behaves as above. Sign-in alone does not fill a roster or customize league rules. | Entitlement and connection are separate from choosing Manual or providing inputs. |
| Signed in, enforcement flag unset / not exactly `true` | Provider-sync loader grants `rollout_free`; the access endpoint can expose `rso_sync`. | Still needs a provider account/team and a successful provider read. This fallback does not itself grant account saving or upkeep. Production flag is unknown. |
| Signed in, enforcement on, no eligible grant | No current provider refresh; Yahoo/Fantrax selector labels say “saved view.” A retained provider roster/saved snapshot can become read-only; Manual remains available. | Saved provider data is not fresh authority. Do not turn it into an editable, current provider roster merely by showing discovery. |
| Eligible paid / other valid grant | `rso_sync`, `rso_account_save`, `rso_auto_upkeep` are distinct capabilities. Existing valid legacy grants can also permit sync. | Paid access does not make stale/missing stats or unsupported rules valid; normal data and legality checks still apply. |

Evidence: [page:7–21](../../../web/pages/roster-schedule-optimizer.tsx#L7-L21); [workspace defaults:173–189](../../../web/lib/rosterScheduleOptimizer/workspace.ts#L173-L189); [RSO component:223–231,299](../../../web/components/RosterScheduleOptimizer/RosterScheduleOptimizer.tsx#L223-L231); [public player inputs:146–175](../../../web/lib/rosterScheduleData/planningInputs.ts#L146-L175); [access route:6–19](../../../web/pages/api/v1/roster-schedule-optimizer/access.ts#L6-L19); [sync enforcement:14–43](../../../web/lib/integrations/providerSyncAccessServer.ts#L14-L43); [refresh guards:452,526–554](../../../web/components/RosterScheduleOptimizer/RosterScheduleOptimizer.tsx#L526-L554); [save capability:147](../../../web/pages/api/v1/roster-schedule-optimizer/workspace.ts#L147).

The RSO already mounts **Top five team schedules**, sorted using Game Grid Week Score. It only renders when canonical schedule coverage is usable. It receives the remaining date range, but its GP includes completed games on those displayed dates. That differs from social-share's strict future-start count, particularly earlier games on “today.” Reuse the scoring semantics, but reconcile clocks before showing both as the same number. [TeamScheduleContext:16–37,66](../../../web/components/RosterScheduleOptimizer/TeamScheduleContext.tsx#L16-L37), [mount:1034](../../../web/components/RosterScheduleOptimizer/RosterScheduleOptimizer.tsx#L1034), [test:26–36](../../../web/components/RosterScheduleOptimizer/TeamScheduleContext.test.tsx#L26-L36).

The candidate browser also already supports discovery: known inputs first, then verified upcoming team games, then name. Unranked rows have no numeric result rank. It does not filter out widely rostered stars using ownership. Real candidate comparisons sort by net projected points or net active games; categories use the schedule comparison and show category gains/losses. Availability and eligibility are separate facts. [CandidateBrowser:33–39,65–105,118–139](../../../web/components/RosterScheduleOptimizer/CandidateBrowser.tsx#L33-L39).

Actionable UI requires reviewed inputs and scoring; confirming inputs requires a roster. The solver's acquisition shortlist accepts only `free_agent`, `manager_available` or `waivers`. Thus “Mark available” is a manager assertion, not a popularity classification. [RSO:636–655](../../../web/components/RosterScheduleOptimizer/RosterScheduleOptimizer.tsx#L636-L655), [shortlist:1162–1169](../../../web/lib/rosterScheduleOptimizer/planning.ts#L1162-L1169), [CandidateCard:115–122](../../../web/components/RosterScheduleOptimizer/CandidateCard.tsx#L115-L122).

**Assessment:** static evidence supports “too much setup for a quick streaming visit,” not a measured claim that the RSO is unusable. The free discovery layer solves a different first task while preserving the more powerful manual workflow.

## 3. Complete social-share pickup and data trace

### 3.1 Request and schedule

The current studio API validates its method, format and query shape, then verifies the bearer token and an exact stored `social_editor` or `admin` role before loading an edition. Its page has a separate access gate. Both remain private/no-store. Public discovery must not relax these boundaries. [API:6–20](../../../web/pages/api/v1/social-share/[format].ts#L6-L20), [role access:11–41](../../../web/lib/socialShare/access.ts#L11-L41), [page:9–21](../../../web/pages/social-share/[format].tsx#L9-L21).

`loadScheduleShareSnapshot` defaults to the current Monday–Sunday week in New York time. It accepts only the previous/current/next NHL season, not just a couple of weeks. Wednesday's `remaining-week` default is **Thursday–Sunday**, not a general “from now” selection. Tuesday trends returns a blocked edition with zero upstream reads; fixture trend cards are not a connected production pickup feed. [schedule:9–33,163](../../../web/lib/socialShare/schedule.ts#L9-L33), [server:14–37,53–58](../../../web/lib/socialShare/server.ts#L14-L37), [types:20–31](../../../web/lib/socialShare/types.ts#L20-L31).

The NHL reader makes a schedule fetch with `includeOdds:false`, so the odds database lookup is skipped. It returns indexed team/day copies, covered dates and a retrieval timestamp. The underlying fetch explicitly uses `cache:"no-store"`. Retrieval time is a check time, not evidence that NHL updated the source at that instant. [NHL reader:460–514](../../../web/lib/NHL/server/index.ts#L460-L514), [fetch:54–59](../../../web/lib/NHL/base.ts#L54-L59).

The snapshot builder validates identities, season, dates, timestamps, duplicate/conflicting copies and reconciliation against daily game counts. Incomplete coverage cannot publish trusted rankings. Remaining opportunities require a selected date, regular-season game, scheduled state, known start and start strictly after generation time. Elapsed/live games remain context rather than remaining opportunities. Off-night density counts the full eligible daily slate, independent of selection or elapsed games; **eight or fewer games** is an off-night. [schedule:57–106,125–163](../../../web/lib/socialShare/schedule.ts#L57-L106), [grid opportunity rule:15–44](../../../web/lib/socialShare/mondayGrid.ts#L15-L44).

### 3.2 Schedule ranking and three different meanings of “tier”

**Week Score** is `6 × (team games − league games/16) + 4 × off-night games + matchup bonus + crowding adjustment`. Social-share supplies no odds, so matchup bonus is zero; crowding is bounded to ±0.25 across the horizon. Zero-game teams get −100. Score ordering is deterministic, then team abbreviation/id. This is schedule opportunity, not player quality or roster fit. Four games/one off-night beats three games/two off-nights in the base formula by two points, with only the small crowding variation. [calcWeekScore:3–23,54–76](../../../web/components/GameGrid/utils/calcWeekScore.ts#L54-L76), [schedule:92–106](../../../web/lib/socialShare/schedule.ts#L92-L106).

Do not conflate:

1. **Count color tiers:** separate GP and OFF columns; highest green, second white, intermediate yellow, lowest red; two values green/red, one value neutral. Display only. [mondayGrid:49–64](../../../web/lib/socialShare/mondayGrid.ts#L49-L64).
2. **Ownership bands:** disjoint 30–<50%, 20–<30%, 0–<20%; not overlapping “under 50/30/20” pools. [players:148–164](../../../web/lib/socialShare/players.ts#L148-L164).
3. **Schedule tiers, ticket 13:** exact `(remaining GP, OFF)` pairs, ordered by the **best Week Score in each pair**, then GP/OFF; teams inside by schedule rank. Strict shows the first three pairs. Widened uses pair groups `[0]`, `[1,2]`, `[3,4]`; teams do not overlap. It is not a new off-nights-first or games-first sorter. [tiers:4–36](../../../web/lib/socialShare/tiers.ts#L4-L36).

Ticket 13's CGY/EDM, WPG, LAK/OTT examples are represented as **synthetic test rows**, not a fresh NHL schedule observed by this analysis. [tiers.test:14–34](../../../web/lib/socialShare/tiers.test.ts#L14-L34).

### 3.3 Player sourcing, joining and exclusions

After a ready schedule, the server reads players for **all teams with remaining games**, supporting top-10-first pickups and wider fill. Opponent rates are read after schedule success; their failure can suppress matchup cards without suppressing the schedule. Player reads require ready schedule/source state. [server:29–49](../../../web/lib/socialShare/server.ts#L29-L49).

| Source | Read contract | Purpose and limits |
| --- | --- | --- |
| `nst_team_stats` | One season, `situation=all`, selected rate columns, exact count, limit 64, unique abbreviations | Opponent context; no NST URL scraping on this path. |
| `yahoo_players` | Yahoo season start-year, current stored `percent_ownership < 50`, teams and Yahoo aliases; selected columns; limit 2,000 | Global rostered percentage, team, positions, status and timestamp. **Live select omits ownership timelines.** |
| `wgo_skater_stats_totals` | Full NHL season, teams; limit 1,500 | Season PTS/GP, GP, hits, shots, blocks, current team, update time. |
| `wgo_goalie_stats_totals` | Full season, teams; limit 200 | GP, starts, QS%, SV%, current team, update time. |
| `yahoo_nhl_player_map_read` | Requested player key and bare player id; chunks of 150 unique identifiers; each chunk limit `2 × chunk size` | Yahoo-to-NHL identity only. |
| `rolling_player_game_metrics` | Selected skaters only, season, strength `all`, 21-day lookback, 14 rows per shown skater | Latest L5 evidence. |
| `wgo_goalie_stats` | Selected goalies only, season, 21-day lookback, 14 rows per shown goalie | Last five appearances. |

These readers import the anonymous public client, use exact-count completeness checks, and fail closed for missing counts, incomplete responses or rows over the limits. Successful access with that client is **not** evidence of data-redistribution rights. [teamRates:5–35](../../../web/lib/socialShare/teamRates.ts#L5-L35), [playerSources:1–82](../../../web/lib/socialShare/playerSources.ts#L1-L82).

The pure `resolveOwnership` function prefers a valid latest timeline point and otherwise uses stored percentage/`last_updated`. **That is broader than the current live source:** because the select omits timelines, this path normally takes the fallback. The source's `<50` filter also precedes the pure resolver. Do not describe fixture timeline behavior as the live sourcing contract. [resolver:25–40](../../../web/lib/socialShare/players.ts#L25-L40), [live columns/filter:14,63–65](../../../web/lib/socialShare/playerSources.ts#L63-L65), [loader test:39–46](../../../web/lib/socialShare/playerSources.test.ts#L39-L46).

`buildPlayerLayer` joins Yahoo → NHL id → WGO totals, requiring the right seasons, supported positions, usable mappings and matching current teams. Primary Yahoo position determines F/D/G; all usable eligibility positions remain on the display row. Minimums are five skater games or three goalie starts. Skaters additionally require usable PTS/GP, hits, shots and blocks even for the general pickup list. Yahoo statuses other than blank/null or DTD are excluded. DTD is allowed, not a confirmed appearance. Missing goalie QS/SV can remain null, sorted behind known values. [players:43–104](../../../web/lib/socialShare/players.ts#L43-L104).

Ownership must be today/yesterday in New York; totals must be no older than 72 hours and not future-dated. Stale rows are removed individually; more stale than included rows makes the layer stale, which suppresses ranked outputs. The denominator is evaluated joinable rows, not proof of complete league coverage. The displayed timestamps are the oldest included ownership observation and totals update. [players:75–116](../../../web/lib/socialShare/players.ts#L75-L116).

### 3.4 Existing pickups, specialists and matchup nights

For each ownership band and F/D/G group, **top-10 Week Score teams are the preferred pool**, but players within that pool rank first by historical rate: skaters PTS/GP; goalies QS%, then SV%. Ties use team schedule rank, lower global ownership, name and NHL id. If fewer than three qualify, fill from teams ranked 11+ by schedule rank before the same rate comparator. Fill-ins carry `widened:true`. Thus team #1 does not always supply the first pickup; within the top-10 pool, rate takes precedence. [players:124–164](../../../web/lib/socialShare/players.ts#L124-L164).

Specialists use hits/shots/blocks divided by GP, under 50% rostered, with the same preferred pool/wider-fill behavior. They are three different category lists, not a universal composite. [players:179–187](../../../web/lib/socialShare/players.ts#L179-L187).

Streaming matchup nights are a separate **team-night** product: top-16 schedule teams, future eligible game, soft opponent DEF ≤33 or a goals/shots “storm.” DEF uses inverted xGA/GP percentile; storm evidence compares season GF/GP against opponent GA/GP, or SF/GP against SA/GP, both in their top thirds. Tired-opponent context cannot alone qualify a night. Sort: number of signals, off-night, softer DEF, better schedule, date/id; deduplicate to one night/team, six total. Monday previous-day rest is unknown outside this week's window. These signals do not currently multiply player pickup rates. [matchups:48–55,113–154](../../../web/lib/socialShare/matchups.ts#L113-L154).

Opponent freshness has a caveat: `buildOpponentLayer` uses the **newest** valid team update timestamp for the layer-level 72-hour check. Unlike player freshness, that does not independently vouch for every team's observation. Reuse should include a per-team timestamp review before making a strong “all matchup data current” claim. [matchups:23–43](../../../web/lib/socialShare/matchups.ts#L23-L43).

### 3.5 Ticket 13 and later SS1-14 code: material update

The **ticket 13 receipt** is explicitly partial. It records strict/widened tier selection, skaters before goalies within each tier, a 15-row budget, and a guard refusing live trimmed layers. Its later 17:45 addendum says network-only auth mocking could not satisfy the storage-backed session gate; no new delta was made then. [Receipt 13:28–73,75–91](../cross-platform/2026-10-24-coordination/handoffs/SS1/RECEIPT-13.md#L28-L73).

**The later pinned working tree goes further:**

- `trimEditionPlayers` keeps the union of the existing pickup/specialist rows **plus the shown strict and widened tier rows**. It records full per-tier eligible counts for both modes. The server calls this new trim before the L5 read. [tiers:96–112](../../../web/lib/socialShare/tiers.ts#L96-L112), [server:38–49](../../../web/lib/socialShare/server.ts#L38-L49).
- The union ceiling is now **66 unique players**: 27 pickup slots + nine specialist slots + two modes ×15 tier slots, before deduplication. “At most 36” describes the earlier trim only. [tiers:96–97](../../../web/lib/socialShare/tiers.ts#L96-L97).
- Live tier rendering accepts a matching selected-date layer with `tierCounts`; it allocates the 15 rows using the full counts and computes `+N more` without returning every hidden player. Legacy trimmed layers without counts remain unavailable. Wrong count-array length yields no shown rows. [tiers:58–93](../../../web/lib/socialShare/tiers.ts#L58-L93), [types:115–130](../../../web/lib/socialShare/types.ts#L115-L130).
- New test source checks full-vs-trimmed strict/widened row and count parity, preservation of old pickup/specialist results, exact union and cap, stale/empty handling and legacy-count rejection. [tiers.test:80–120](../../../web/lib/socialShare/tiers.test.ts#L80-L120). The API test source now checks tier rows/counts too. [schedule.test:320–345](../../../web/lib/socialShare/schedule.test.ts#L320-L345).

At pin time no `RECEIPT-14.md` or `t14/` evidence directory was present at the checked SS1 paths. Consequently, SS1-14 is **observed implementation and test source**, with completion, browser acceptance and production behavior unverified here. The older `t13/vitest.log` records **131 passed**, but predates these new changes; it cannot certify this new source state. No tests were rerun for this document.

This tier list is not three players per F/D/G group: it places **all skaters before goalies**, rates within those classes, then applies a shared row budget. Goalies may therefore be absent from a populated tier's displayed rows. Public UX should not promise balanced positions unless it explicitly selects them. [tiers:39–56,83–93](../../../web/lib/socialShare/tiers.ts#L39-L56).

### 3.6 Recent form and ownership are evidence, not forecasts or availability

L5 attaches **after selection**, so it does not affect social-share ranking. Skaters use the latest strength-all rolling row and at most five season appearances; goalies aggregate up to five recent games played. Missing/future/old rows are not a zero-performance score. A failed source produces `recentState:"unavailable"`; a successful empty source has a different state. The 14-day rule checks the latest game; it does not establish that all five goalie appearances occurred in the last 14 days. [players:190–219](../../../web/lib/socialShare/players.ts#L190-L219).

Two display cautions follow from the actual code. The card's “No game in the last two weeks” can overstate what an empty analytics source proves: a row may be missing despite an NHL appearance. Prefer “No recent form available” unless complete appearance coverage is established. Also, goalie aggregation treats invalid/missing component values as zero; do not promote those sums to a completeness-certified statistic without per-field validation. [recent attachment:207–217](../../../web/lib/socialShare/players.ts#L207-L217), [card copy:256](../../../web/components/SocialShare/SocialShare.tsx#L256).

**Global Yahoo rostered percentage is not availability in any particular fantasy league.** A 10%-rostered player may be taken in the visitor's league; a 70%-rostered player may be free. Lower ownership can help identify less widely held candidates, but it is not a calibrated probability of availability. The RSO explicitly documents the same boundary. [planning ownership:256–286](../../../web/lib/rosterScheduleData/planning.ts#L256-L286).

## 4. Recommended no-input experience

The first screen should answer three questions immediately: **When are the games? Which teams have useful schedules? Which less widely rostered players on those teams merit checking?**

1. **This week / Next week**, with actual date range, “as of” time, source timezone and freshness. Default current week to opportunities remaining **from now**. “Remaining this week” includes later games today; it must not silently inherit Wednesday's Thu–Sun selection.
2. **All-team schedule grid**, ranked by schedule score, with actual day/date, opponent, home/away and local puck-drop time. Keep the governing New York calendar explicit if clocks also show the visitor's timezone. Label remaining GP/OFF separately from full-week context; elapsed games stay muted. A team's schedule GP is not a player's forecasted appearances.
3. **Best schedule tiers**, strict by default with an optional “Include more teams” widening control reflecting ticket 13. Explain GP/OFF and the ≤8-game definition. These are browsing controls, not required roster customization.
4. **Players from each tier**, initially under 50% Yahoo rostered, showing Yahoo positions, exact/floored percentage with observation date, historical season rate and sample size, optional L5 with through-date, and dated upcoming games/off-nights. Say “Check your league's waiver wire.” Use separate skater/goalie presentation when including goalies; do not compare PTS/GP numerically with QS%.
5. **Optional specialists / matchup evidence** after the primary flow. Retain a useful schedule when player or opponent evidence fails, with a specific unavailable state instead of fabricated picks.
6. **Continue to manual planning** and **Connect a league** as voluntary next steps. Neither is a prerequisite to browsing. Preserve existing local workspaces and signed-in behavior.

These are proposed UX requirements, not screenshots or observed current behavior. The current share card contains dates/counts and historical evidence, but it is an editorial export surface; its 15-row image constraint need not become a website constraint.

**Safe handoff:** a “View in planner” action may open a detail/search or separate watchlist with `availability:"unknown"`. If later adding a candidate to manual inputs, retain unknown availability and resolve the RSO's canonical identity, team and eligibility contract. Only the manager's explicit “I checked: available in my league” action may set `manager_available`; do not add the candidate to the user's owned roster. Provider-verified availability remains its own source. The current manager assertion is visible in [CandidateCard:122](../../../web/components/RosterScheduleOptimizer/CandidateCard.tsx#L122) and [RSO handler:1057](../../../web/components/RosterScheduleOptimizer/RosterScheduleOptimizer.tsx#L1057).

**Filter trap:** the current 66-player union contains selected card rows, not every eligible player on tier teams. Filtering it client-side to under 20% or D-only can omit better qualifying players that were trimmed out. For MVP, retain the default under-50 view. For additional facets, select top rows and counts **before trimming** for the exact allowed facets, or serve a separately bounded discovery dataset. Recompute the L5/byte budgets. Do not advertise a complete filtered ranking from a pretrimmed sample. [tiers:103–111](../../../web/lib/socialShare/tiers.ts#L103-L111).

## 5. Honest ranking choices

| Method | What it answers | Recommendation |
| --- | --- | --- |
| Schedule tier → historical rate | Strong rates among less widely rostered players on teams with good remaining schedules | MVP default; matches TJ's task and SS1. Publish the order and minimum samples. |
| Top-10 pool → historical rate, wider fill | Rate leaders across a preferred schedule pool; balanced F/D/G cards | Keep for share-card parity or an alternate list. Label wider fill; it is a different ordering from strict tiers. |
| Historical rate × remaining team GP | A rough exposure comparison if the player appeared in every team game | Optional research only; label explicitly as a historical-rate proxy. It is not expected points, active starts or a forecast. |
| Shots / hits / blocks per GP | Category specialists | Useful optional lists; no universal scoring weights. |
| L5-first or blended rate | Recent performance emphasis | Defer a blended formula until small-sample handling and validation exist. Show L5 evidence now without silently double-counting it in forecasts. |
| Roster-aware net AGP, DUST or marginal points | Value after slot conflicts, benching, displaced/dropped players and legal timing | Existing manual/provider workflow after verified inputs; impossible to calculate honestly from no roster. |

“Best teams” need not yield the best marginal player: a lower-rate skater's four team games can be less valuable than a higher-rate skater's three, and the visitor may already have full slots on those dates. Goalies may play none of their team's scheduled games. The schedule and rate dimensions should remain visible instead of hiding these tradeoffs in a universal “best” score.

Season PTS/GP and QS%/SV% describe observed outcomes. L5 describes recent outcomes. FORGE estimates are a separate, permission/admission-controlled forecast product. Current RSO projected points additionally depend on the manager's scoring and complete weighted fields; an absent weighted stat is unknown, not a partial sum presented as complete. [RSO points tests:69–98](../../../web/components/RosterScheduleOptimizer/RosterScheduleOptimizer.points.test.tsx#L69-L98).

## 6. Ownership contract and difficult cases

The two current readers differ: share uses `yahoo_players` with current stored percentage/last update and a today/yesterday rule; RSO uses `yahoo_player_ownership_daily` over a three-day window and the mapping view. RSO mapping skips ambiguous Yahoo→NHL matches, keeps finite 0 as real, and leaves invalid/future values unknown. Its recent form is also different: available box scores before the previous day, scoring-hot/cold labels and no extra form bonus. Do not call these one identical feed. [RSO ownership/form:256–325](../../../web/lib/rosterScheduleData/planning.ts#L256-L325).

For implementation, choose and document a single public observation contract: provider, season, NHL identity, value, observation date/time, ingestion time, freshness state and permitted use. Keep raw provider keys/timelines internal. A small adapter is preferable to immediately migrating tables. The writer already distinguishes missing `percent_owned` from observed zero, but `last_updated` is generated at ingestion; it is not by itself a provider observation timestamp. [writer:85–140](../../../web/lib/integrations/yahoo/playerWriter.ts#L85-L140).

| Case | Current evidence / issue | Free discovery behavior |
| --- | --- | --- |
| Missing ownership | Pure parser returns null; live `<50` query also excludes missing values | Unknown, excluded from the low-ownership ranked pool. Never coerce to 0%. A separate clearly unranked list is a later option. |
| Observed 0% | Finite zero passes percentage validation | Show 0% with date, while league availability remains unknown. |
| Stale / future observations | Share excludes them; majority-stale suppresses rankings | Keep schedule usable; explain unavailable/stale player data. Do not substitute an older season silently. |
| Injury / DTD / scratch | Most nonhealthy statuses excluded; DTD and absent status allowed; public row does not preserve a DTD warning | If showing DTD, add a minimal dated status label. No “healthy” or “playing tonight” promise from blank status. Injury/lineup coverage remains unverified. |
| Goalies | Three-start minimum, QS%/SV%, appearance-based L5; no starter confirmation in this path | Separate candidates from confirmed starters. Missing QS/SV stays missing; team GP is not projected goalie starts. |
| Rookie / call-up / new player | Minimum GP, mappings, all required skater totals and team join can exclude them | Say “Insufficient current-season evidence,” not “bad option.” No previous-season fallback or invented forecast by default. |
| Traded / relocated / duplicate identity | Yahoo team aliases, WGO current team, joins and deduplication | Exclude conflicts; surface coverage limitation. Review map ambiguity: the share map currently overwrites repeated keys rather than applying RSO's explicit ambiguity rejection. |
| Empty / partial recent form | Success-empty differs from failed read, but cannot prove complete appearance history | Use neutral no-evidence copy, sample size and through-date; avoid zero-stat and “has not played” assertions without coverage. |
| No games left | No remaining opportunities; schedule score uses a no-game sentinel | Say “No games remaining,” allow next week, avoid player recommendations for the exhausted horizon. |
| Odd / extended matchup week | Share is New York Mon–Sun; RSO accepts provider weeks and custom ranges | Label public calendar week, not “your matchup.” Keep provider-specific dates in manual/synced planning. |

Sources: [share joins/filters:61–116](../../../web/lib/socialShare/players.ts#L61-L116), [share source filters:58–80](../../../web/lib/socialShare/playerSources.ts#L58-L80), [RSO mapping/null semantics:264–286](../../../web/lib/rosterScheduleData/planning.ts#L264-L286), [RSO matchup weeks:326–330](../../../web/lib/rosterScheduleData/planning.ts#L326-L330).

**Source/rights prerequisite:** reusing already ingested aggregate Yahoo ownership without an individual visitor's sync is technically possible in this architecture. It is acceptable only within the existing authorized source, retention, attribution and redistribution contract. Public anon readability, existing editorial use and “free source” do not establish permission for a new public discovery product. No new collection, credentials, scraping, source license or legal conclusion was established in this analysis. If reuse is not permitted, ship schedule-only browsing until an approved ownership source/contract exists; do not replace unknown ownership with guessed availability.

## 7. Public endpoint security, cache and freshness

### Separate public product; keep the studio gate

Add a separate GET-only discovery route under the RSO namespace, with an explicit public DTO. It may call the shared read pipeline and pure selectors, but should return only schedule provenance/counts, public team/game identity, selected player names/NHL ids, positions, rates/sample sizes, observation dates and necessary status labels. Do not proxy the authenticated studio API or accept arbitrary studio formats/actions.

Reject unknown/repeated parameters, impossible dates, unsupported horizons and free-form selected dates; allow only the current/next Monday and a small set of spans/modes. Canonicalize or redirect equivalent query spellings so irrelevant parameters cannot create cache variants. Use a fixed governing timezone for upstream selection. Display-time conversion can happen client-side. Current season validation alone admits many dates over roughly three seasons and is too broad for the proposed low-cardinality public cache. [studio query validation:11–17](../../../web/pages/api/v1/social-share/[format].ts#L11-L17), [supported seasons:53–58](../../../web/lib/socialShare/server.ts#L53-L58).

No user, league, team account, provider token, private roster, manager availability or entitlement data may enter that shared response. Keep authentication and credentialed provider paths out of its imports/request lifecycle; ignore/reject personalization parameters rather than varying public content by session. Do not reuse the service-role planning response wholesale. Do not change RLS, grants, role checks or social-editor permissions to make public discovery work. Current access tests are the regression boundary, not a request to bypass it. [access tests:42–107](../../../web/lib/socialShare/access.test.ts#L42-L107).

### What caching actually does today

- Studio API: `private, no-store, max-age=0`, `Vary:Authorization`. `fetchEdition` coalesces concurrent calls only for the same user, token and URL; it forgets settled results. That is not a CDN/shared data cache. [route:7–9](../../../web/pages/api/v1/social-share/[format].ts#L7-L9), [editionFetch:6–35](../../../web/lib/socialShare/editionFetch.ts#L6-L35).
- `shareCacheControl` exists but the studio route does not call it. For ready schedules, it reserves a **600-second expiry margin**; ready attached layers allow at most 300 seconds fresh plus up to 300 stale, bounded by expiry-minus-margin. Unready attached layers shorten to at most 60 seconds and no stale window. Unready schedule/source or fewer than 60 usable seconds returns no-store. [server:61–84](../../../web/lib/socialShare/server.ts#L61-L84).
- Therefore a snapshot expiring in **659 seconds or less** is no-store. Near puck drop, the current helper can produce a deliberately uncached interval; “always one refresh per five minutes” is false. Also, even a snapshot with a six-hour source validity gets at most a five-minute shared fresh lifetime under this helper, not a six-hour cache lifetime. [cache tests:421–436](../../../web/lib/socialShare/schedule.test.ts#L421-L436).
- The separate public RSO schedule route has `s-maxage=300, stale-while-revalidate=900`; that broader policy must not be copied blindly onto remaining-opportunity/player rankings. [schedule route:37](../../../web/pages/api/v1/roster-schedule-optimizer/schedule.ts#L37).

Wire the public discovery policy explicitly and test headers plus client expiry behavior. When a card layer is unavailable, preserve the schedule with short-lived, truthful failure state; when the schedule itself is untrusted, suppress ranks. A future schedule-only public route would otherwise get the helper's short ceiling because no opponent layer is ready; design its layer requirements intentionally rather than assuming the helper is format-neutral.

### Clocks and invalidation

Schedule expiry is the earliest of source age, the near-start transition and puck drop. A game within six hours tightens source validity to 15 minutes; a distant game's approach can shorten an edition before its start. [schedule:71–89](../../../web/lib/socialShare/schedule.ts#L71-L89).

The UI must recompute remaining counts at a known start boundary or withhold expired rankings until refreshed. A tab left open cannot retain “four remaining” after a game starts just because its CDN response was fresh when loaded. Keep `generatedAt`, source check time, source observation/update times and `expiresAt` distinct. Future schedule changes/postponements require refresh/version invalidation; TTL bounds staleness but does not guarantee instantaneous upstream change visibility. Specify source/ranking-version changes in cache identity and purge/revalidation policy. Do not extend freshness by restamping an old cached snapshot.

## 8. Cost: current observations versus estimates

**No cost or live-size measurement was made for this report.** Currency cost, hit ratio, duration, response bytes and expanded live row counts remain unknown.

Historical evidence has a correction worth retaining: SS1 ticket 8's live check used **two concurrent API requests**, not sequential requests, and **four local requests**, not three. It recorded two NHL and 14 Supabase GETs for that pair; its concurrency violated the approval. The correction preserves the prior report rather than silently rewriting it. It describes an earlier top-10 player read, before the expanded pool, L5 and tier union. [Correction:3–40](../cross-platform/2026-10-24-coordination/handoffs/SS1/RECEIPT-8-CORRECTION.md#L3-L40). The 203 Yahoo /223 skater /23 goalie counts in current source comments are historical claims, not current all-team measurements. [playerSources:6–13](../../../web/lib/socialShare/playerSources.ts#L6-L13).

**Static request/row envelope for the pinned share pipeline, not a prediction:**

| Component | Bound derived from code |
| --- | --- |
| NHL schedule | One no-store upstream schedule fetch for a successfully entered edition load; no odds query. |
| Team rates | One bounded Supabase read, ≤64 returned rows. |
| Ownership + season totals | Three reads, ≤2,000 +1,500 +200 rows. |
| Identity map | If `I` unique Yahoo keys/bare ids exist, `ceil(I/150)` reads, up to `2I` returned rows. Two ids per Yahoo row means `I≤4,000`: up to **27 chunks**, not necessarily 14. |
| L5 | Zero, one or two reads depending on shown positions; combined row ceiling `14 × shown players`, now ≤924 for the 66-player union. |
| Total successful envelope | Up to **33 Supabase reads plus one NHL fetch**; returned-row ceilings sum to **12,688**. Duplicates and empty/failed stages reduce actual results. This is not measured traffic or database work. |

Derivation: `1 + 3 + 27 + 2 = 33`; `64 + 2,000 + 1,500 + 200 + 8,000 + 924 = 12,688`. A complete response must fit each source limit; server-side page caps can instead cause a fail-closed incomplete result. Exact counts, index/select cost and serialization CPU are not bounded by returned rows alone. Default pagination retry count is one attempt, but infrastructure/cache failures still affect realized traffic. [playerSources:11–32,44–81](../../../web/lib/socialShare/playerSources.ts#L11-L32), [tiers:96–112](../../../web/lib/socialShare/tiers.ts#L96-L112), [pagination:100–150,190–206](../../../web/lib/supabase/pagination.ts#L190-L206).

Claude's “8–20 small GETs and well under 5k rows” is a plausible earlier-scale estimate, **not** a defensible upper bound for this newer code. Shared caching can substantially reduce origin reads, but **cost still grows with traffic** through delivery requests/bytes, misses, revalidation and abuse. The practical model is origin cost per regeneration × actual regenerations, plus CDN delivery and operational overhead. Regenerations depend on keys × regions × demanded refresh windows, cold starts/evictions, invalidation, concurrent miss coalescing, failures and no-store intervals. A 300-second TTL gives roughly 12 fresh windows/hour/key/region under steady traffic; it is neither a global cap nor a guarantee.

Query-key cardinality is not automatically “two values per week”: current/next week × span × strict/widened × version already multiplies keys if server-side. Ownership/position facets and timezones multiply further. Keep client-only display controls out of the server key when their results remain complete; select-before-trim facets need an explicit finite variant budget. Canonicalize ordering/unknown parameters and avoid nonce/cache-busting behavior in the discovery route. Bound retries and concurrent regeneration; measure failures and the near-puck-drop interval before choosing a launch budget.

### Why not simply use the full RSO data route?

The RSO's current public planning read sends a fresh nonce with no-store and validates the nonce, server evaluation time and current forecast policy. The data route returns private/no-store for a nonce **or** an RSO use-policy manifest. It loads shared identities/current NHL rosters/schedule, forecast/participation evidence, daily ownership plus the mapping view and recent box scores. Its whole-response ceiling is **4,000,000 bytes**, a budget rather than a measured payload. [current read:65–100](../../../web/lib/rosterScheduleOptimizer/currentPlanningRead.ts#L65-L100), [route:19–35](../../../web/pages/api/v1/roster-schedule-optimizer/data.ts#L19-L35), [inputs:125–139](../../../web/lib/rosterScheduleData/planningInputs.ts#L125-L139), [planning:64–96,256–325](../../../web/lib/rosterScheduleData/planning.ts#L64-L96), [wire budget:102–105](../../../web/lib/rosterScheduleData/bridgeForecastWire.ts#L102-L105).

Identical hooks can share one current generation's worker/read; it is not literally a new read for every render. That reuse is local to the same snapshot/options and ends when all users release it. Expiry can request a new generation. It does not provide cross-visitor CDN reuse. [execution:7–18,49–58](../../../web/hooks/rosterPlanningExecution.ts#L7-L18), [hook expiry:29–37](../../../web/hooks/useRosterPlanning.ts#L29-L37).

Use a smaller public discovery read rather than removing nonce/current-authority checks from the optimizer. Avoid mounting its full planning hooks just to render the new no-input first screen; otherwise the new small cached route may coexist with the same heavy read and fail its cost objective. No exact savings can be claimed until actual request/byte traces establish what the page mounts.

For later validation, begin with network-denied fixtures and local counters/serialized bytes. Any production reads, source acquisition changes or deployment need their own exact candidate and bounded authorization. The repository's five-sequential-request smoke default is a ceiling, not automatic permission or a bound on upstream fan-out. This task authorized none.

## 9. Reuse map and proposed changes

| Module / boundary | Reuse | Required adaptation or caution |
| --- | --- | --- |
| `socialShare/schedule.ts`, Game Grid `calcWeekScore.ts`, `mondayGrid.ts` | Calendar validation, opportunity counting, shared score, grid rows/count colors | Public from-now span and game clocks; align RSO strip semantics. |
| `socialShare/players.ts` | Join/filter, ownership parser, rate comparators, pickups, specialists, L5 attachment | Ownership observation contract, ambiguity/status/completeness review; no league-availability conversion. |
| `socialShare/tiers.ts` | Exact-pair strict/widen selectors, ordering, row allocation, new live trim/counts | Confirm SS1-14 completion. Public facets and web pagination need a complete select-before-trim contract. |
| `socialShare/playerSources.ts`, `teamRates.ts`, `server.ts` | Bounded source reads and sequential readiness gates | New public DTO, source rights, deadlines/cost instrumentation; don't request unnecessary layers. |
| `shareCacheControl` | Expiry margin and ready/unready layer policy | Explicit public-route integration, required-layer awareness, finite keys and near-start behavior. |
| Studio page/API, `access.ts`, access gate, `editionFetch.ts` | Keep existing authorization boundary | Remain editor-only/private; do not turn these routes into public endpoints. |
| RSO page/component, workspace/current read/solver | Preserve free manual planning and existing capabilities | Add discovery entry without eager full-planner reads; safe explicit transition preserving local state. |
| New RSO discovery route + UI | Proposed only | Public contract, accessible date/team/player browsing, stateful freshness and truthful labels. |

Prefer importing stable pure selectors at their present boundary first, with a narrow adapter owned by the implementation lane. A neutral shared module may become worthwhile once both products depend on a settled contract; moving the whole social-share tree now is unnecessary. Agree exact file custody with SS1 and the release coordinator before any later edits. This report grants no new source lease or implementation authorization.

## 10. Free and paid commitments

| Remains free | Account / entitlement-backed value already represented in code |
| --- | --- |
| Proposed no-input schedule/tier/player browsing, if approved | Provider sync and current league-specific availability/rules |
| Existing manual roster input, local workspace, scoring/rule input and local optimization | Account-backed workspace saves (`rso_account_save`) |
| Existing shared forecast access and projections when data/use policy permits; manual legal planning when inputs are verified | Automatic upkeep (`rso_auto_upkeep`) and provider refresh under the existing access policy |
| Explicitly manager-verified manual availability; schedule-only fallback | Existing eligible purchase/supporter/legacy access rules; no silent entitlement redesign |

“Get a roster-aware legal add/drop plan” is **not an exclusively paid capability** when a manager supplies the required manual inputs. A truthful upgrade pitch is: “Connect your league to import rules and check real league availability, save to your account and keep it updated.” Do not claim a paid grant guarantees every provider field or every player's projection. [capabilities:1–2](../../../web/lib/in-season/access.ts#L1-L2), [manual snapshot:598–607](../../../web/components/RosterScheduleOptimizer/RosterScheduleOptimizer.tsx#L598-L607), [paid/legacy and rollout tests:20–38,79–95](../../../web/lib/integrations/providerSyncAccess.test.ts#L79-L95).

No recommendation here activates premium enforcement. If TJ later chooses to activate it, shipping a useful free entry first is sensible; timing and release remain separate decisions. Preserve owner access to old saved snapshots after expiry and the existing read-only/continue-manually behavior. [workspace route tests:97–118](../../../web/lib/in-season/workspaceRoutes.test.ts#L97-L118).

## 11. Decision matrix and decisions actually needed

| Option | No input / no sync | Evidence / risk | Decision |
| --- | --- | --- | --- |
| **A. Cached public discovery beside manual RSO** | Yes | Reuses schedule, tier and rate selectors; needs explicit public contract, rights and cache/UX checks | **Recommended MVP** |
| **A+. Safe manual-planner handoff** | Browsing stays no-input | Resolve canonical identity; preserve unknown availability until manager confirms | Next small slice, optional for launch |
| B. Improve manual setup only | No | Helpful later, but roster/rules/availability still needed; does not meet this request | Separate work |
| C. Keep rollout-free sync only | No for anonymous visitors | Existing conditional behavior; still requires connection and roster selection | Not a substitute |
| D. New limited free sync | No | Changes entitlement/provider cost and product commitments | Outside this proposal |

**TJ decisions needed:**

1. Approve the product direction: no-input **streaming discovery** within the RSO, retaining a clearly available Manual planner. Suggested entry: discovery for a fresh visitor; preserve an existing local workspace instead of overwriting its landing state.
2. Accept the transparent MVP ordering: strict schedule tiers then historical skater rates, optional widening; goalies separate; under-50 global Yahoo rostered context. Optional facets/specialists can follow. Do not ask TJ to reconfirm ticket 13's already-recorded Week Score pair ordering.
3. Confirm the ownership-source owner can document permitted aggregate public reuse and required attribution/retention. If not, choose schedule-only launch or defer player discovery pending an approved source.
4. Decide launch priority relative to premium enforcement. This does not authorize flag activation, production reads, deployment or pricing changes.

Module placement, DTO names, exact row budgets, cache versioning and fixture design are implementation decisions for the owning lanes. Current production flags and SS1-14 acceptance are evidence to collect later, not preferences TJ needs to invent.

## 12. Implementation slices, tests and acceptance

These are proposed later work, not edits made by this task.

| Slice | Deliverable | Tests / acceptance |
| --- | --- | --- |
| 1. Freeze shared contract | Reconcile accepted SS1-14 source/receipts; define public ownership/timestamp/status contract and source rights | Pin accepted source; reconcile strict/widened full-vs-trim parity; confirm original cards unaffected. No assumption that old 131-pass log covers new code. |
| 2. Public read model | GET-only finite current/next-week discovery DTO; explicit public cache policy; no account/provider imports | Mock all reads; bad/duplicate/extra params and unsupported dates cause zero upstream reads; responses omit user/provider keys and private fields. Studio still rejects anonymous/noneditor requests. Bound rows, bytes, deadline, call count and failure fan-out. |
| 3. No-input screen | Schedule → tiers → players; dates/times/remaining counts; useful partial states | Browser fixtures with empty localStorage and no auth: sees useful content before any input. No provider/private planning requests or workspace mutation. Mobile, keyboard, screen-reader labels and non-color tier cues. Existing local workspace survives entry/exit. |
| 4. Freshness and edge cases | Time-bound counts, expiry, unknown/stale states, separate goalie status | Frozen-clock tests across New York DST/week boundaries, midnight, exact puck drop, six-hour transition, live/postponed/cancelled/unknown games; stale/missing/null/0 ownership, source failure, map conflicts, DTD, minimum samples and empty slate. No expired rank or fabricated zero. |
| 5. Optional safe handoff/facets | Planner detail/watchlist or explicit availability confirmation; complete filtered selections | Discovery click never grants `manager_available`, roster ownership or legal plan readiness. Confirmation changes only its intended candidate. Filter results/counts match full eligible pool before trim; L5 bounds updated for added rows. |
| 6. Candidate acceptance | Local fixture evidence and cost envelope; later authorized release validation | No automatic premium flag, RLS or deployment changes. Measure actual serialized bytes/request counts and fixture regeneration behavior. Live data/rights/production checks only after separate authorization and exact bounds. |

Nearest existing test evidence to extend: [source limits:39–82](../../../web/lib/socialShare/playerSources.test.ts#L39-L82); [player joins/freshness:16–90](../../../web/lib/socialShare/players.test.ts#L16-L90); [tier parity:80–120](../../../web/lib/socialShare/tiers.test.ts#L80-L120); [API trimming/recent failure:311–394](../../../web/lib/socialShare/schedule.test.ts#L311-L394); [cache boundaries:415–437](../../../web/lib/socialShare/schedule.test.ts#L415-L437); [studio authorization:42–107](../../../web/lib/socialShare/access.test.ts#L42-L107); [RSO discovery clocks/no fabricated net gains:222–295](../../../web/components/RosterScheduleOptimizer/CandidateBrowser.presentation.test.tsx#L222-L295); [manual forecast completeness:69–98](../../../web/components/RosterScheduleOptimizer/RosterScheduleOptimizer.points.test.tsx#L69-L98).

## 13. Reconciliation with Claude's original

| Original claim / proposal | Assessment after current-source inspection |
| --- | --- |
| Manual is the default and public planning exists | **Agree.** Add unverified eligibility to the setup barriers; do not claim live usability was measured. |
| Enforcement is off unless exactly `true` | **Agree as a code default.** Production state remains unknown; signed-in rollout sync does not itself grant all paid capabilities. |
| Share logic supplies a strong starting point | **Agree.** Different ordering paths, source contracts and public security boundary need explicit treatment. |
| Ticket 13 is still in progress / not covered | **Update.** Read the actual ticket 13 selectors/card/tests and 17:45 addendum; later local SS1-14 now connects tier trimming/counts. Neither older receipt nor its test total certifies this newer state. |
| Live layer is at most 36 players | **Superseded locally.** New tier union ceiling is 66; shown-player L5 envelope changes too. |
| Ownership comes from timeline-or-percent | **Qualify.** True for the pure resolver; current live select omits timelines and prefilters stored percentage. |
| Add to plan by setting `manager_available` | **Reject automatic assertion.** Preserve unknown until explicit manager confirmation. Global ownership cannot establish league availability. |
| FORGE points and legal itineraries belong in paid | **Correct the boundary.** Existing manual scoring, shared forecast access and local legal planning remain free subject to input/data policy. Paid value is connected/account-backed features. |
| Shared cache exists but route does not use it | **Agree.** Keep studio private; public adapter must explicitly integrate policy and required layers. |
| Two keys/week, ≤12 refreshes/hour/region, cost does not grow with visitors | **Reject as absolute.** Finite public contract is proposed, not current; variants/regions/no-store intervals/failures and delivery traffic matter. |
| 8–20 GETs, well under 5k rows | **Unmeasured earlier-scale estimate.** New static ceiling permits 33 Supabase calls plus one NHL fetch and 12,688 returned rows. Actual cost is unknown. |
| One bounded live check before launch | **Potential later validation**, not authorized here. Account for upstream fan-out, corrected ticket 8 evidence and SS1-14 state; fixtures first. |

## 14. Remaining evidence gaps and document verification

**Outstanding before a public launch:** permitted public ownership reuse; accepted SS1-14 candidate and matching tests/browser evidence; current all-team/tier/L5 source coverage and response sizes; actual cache hit/miss/regeneration behavior by region and near puck drop; current production flag/deployment identity; map-conflict and injury/appearance coverage; anonymous end-to-end UX and preservation of existing manual workspaces. None blocks this analysis deliverable, but none is established by it.

**Checks performed for this report:** static reading of the cited current code/test contracts and historical SS1 evidence; source hashes and line counts; document link/citation-range validation and source-drift check recorded in [DOCUMENT-CHECKS.json](DOCUMENT-CHECKS.json). **Tests, browser execution, live reads, Git, builds and deployments: not run.** Historical 131-pass output is explicitly attributed to ticket 13 only. The Claude original and release registers were not edited.

**Deliverable:** this standalone Markdown recommendation, with local source citations tied to `SOURCE-PINS.json`. Library saving/attachment status is reported separately from local file creation; a local path alone is not a confirmed Library delivery.
