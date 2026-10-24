# Free RSO analysis: reusing the social-share pickups logic

- Date: 2026-10-24. Requested by TJ (CLAUDE-20261024-042). Author: Claude, read-only analysis session.
- Scope: read-only. No RSO, forecast or ownership code was edited. No production reads, servers or Git.
- Sources: the working tree on `octoberBranch` as of this writing. Citations are `path:line` in that tree. SS1 ticket 13 (the schedule-tier streaming list) was still in progress, so its code is not covered here.

## TL;DR

1. **TJ's suspicion is mostly right, with one correction.** The RSO does not block people without sync. Its default mode is **Manual**, and the planning data endpoint is public. But a Manual user has to type in their roster, enter scoring weights and league add rules, and click **Mark available** on every free agent before anything gets ranked. For a casual visitor, that makes the tool close to unusable.
2. **The paywall itself is not switched on in code.** Paid sync is behind a server flag, `PROVIDER_SYNC_PREMIUM_ENFORCEMENT_ENABLED`, which is off unless set to exactly `true`. While it is off, every signed-in user gets free sync (`rollout_free`). I could not check whether production sets this flag, because production reads were out of scope. Once it is on, the problem TJ describes becomes real for everyone who has not paid.
3. **The social-share logic already does most of what TJ asked for:** "show schedule, show best teams, then show best players from best teams", with no manual input. It is pure, tested and bounded, but two things make it unusable as a public feature today: its API only answers `social_editor` and `admin` accounts, and it never caches (`no-store`).
4. **Recommendation: Option A, a free "Week Planner" view.** Serve a public, CDN-cached edition of the social-share schedule and pickups logic as a no-input first screen of the RSO. Then let users push picks into the existing Manual RSO (Option A+). Keep league-specific work paid: real league availability, roster-aware add/drop plans, saving and auto-upkeep. The decisions TJ and Codex need to make are listed in §6.

---

## 1. How social-share "pickups" works today

### 1.1 Request flow (server)

`web/lib/socialShare/server.ts:13-50` runs these steps in order, and each step only runs if the one before it succeeded:

1. **Week and date selection.** The default is the current New York calendar week, Monday to Sunday (`schedule.ts` `calendarWeekStart`). The Wednesday edition (`remaining-week`) selects Thursday to Sunday by default (`schedule.ts:163`).
2. **NHL schedule.** One read through `getSchedule(start, { includeOdds: false })` (`server.ts:28`). It is then validated by `buildScheduleSnapshot` (`schedule.ts:125-164`), which checks game identity, season, start time against the calendar date, and that the per-day counts reconcile. Any mismatch marks the edition `partial` or `missing`.
3. **Opponent rates.** `nst_team_stats` from Supabase (season, `situation=all`, a limited set of columns, an explicit row limit; `teamRates.ts:12-28`). This is a Supabase table, not NST URLs, so the NST rate limits do not apply. If this read fails, only the matchup cards are disabled (`server.ts:35-36`).
4. **Player layer.** This only runs when the schedule edition is `ready` (`server.ts:40`). It reads players on **every team with remaining games** (`server.ts:41-42`).
5. **Trim.** Only the players the cards actually show (at most 36) leave the server (`players.ts:171-177`, `server.ts:44`).
6. **Recent form.** Last-five-games reads, made only for those shown players (`server.ts:46-48`).

### 1.2 Schedule analysis: Week Score, GP, off-nights and tiers

`selectScheduleDates` (`web/lib/socialShare/schedule.ts:57-110`) does this:

- **Off-night:** any date with **8 or fewer league games** (`schedule.ts:69`). The full daily slate is counted, regardless of which dates are selected.
- **Opportunities (GP):** regular-season games on selected dates that are still `scheduled` and have a known future start (`schedule.ts:62`, also `mondayGrid.ts:16-18`). So a midweek edition counts **remaining** games only.
- **Week Score:** the same function the Game Grid uses, `calcWeekScore` (`web/components/GameGrid/utils/calcWeekScore.ts:54-77`, version `schedule-v2-crowding-0.25`). It adds:
  - (team GP − league-average GP) × 6;
  - off-night games × 4;
  - a matchup bonus capped at ±0.5. Social share passes no odds, so this term is **0**;
  - a slate-crowding adjustment of up to ±0.25.

  Rows are sorted by score, then abbreviation, then id (`schedule.ts:105-106`). In practice, "4 GP with 1 off-night" beats "3 GP with 2 off-nights" by 2 points.
- **Colour tiers:** these are for display only and do not affect ranking. Each column (GP and OFF) is ranked separately, from most to least: green, white, yellow, red (`mondayGrid.ts:49-65`, TJ's rule from CLAUDE-040).
- **Freshness:** an edition expires at the first puck drop, or 15 minutes after the read when a game starts within 6 hours, otherwise 6 hours after the read (`schedule.ts:71-90`).

### 1.3 How the best schedules steer pickups

`web/lib/socialShare/players.ts`:

- **Schedule rank sets team priority.** Each player inherits their team's Week Score rank, GP and off-nights (`rankedPlayers`, `players.ts:126-132`).
- **Top-10 teams first.** `PLAYER_TEAM_RANK_MAX = 10` (`players.ts:20`). `fillThree` takes the top three players from top-10 teams, then fills short lists from teams ranked 11 and below, best schedule first. Those fill-ins are flagged `widened` (`players.ts:137-141`). This was TJ's choice in ticket 10.
- **Ownership bands.** Each player belongs to exactly one band: **30–49%, 20–29%, or under 20%** (`PICKUP_BANDS`, `players.ts:149-153`). Each band has F, D and G lists of three players (`pickupTiers`, `players.ts:159-165`).
- **Past-performance ranking within a band and group** (`pickupOrder`, `players.ts:144-146`):
  - skaters by **season points per game**;
  - goalies by **quality-start %**, then **save %**;
  - ties broken by team schedule rank, then lower ownership, then name.
- **Specialists:** skaters under 50% on the same team pool, ranked by season hits, shots or blocks per game played (`players.ts:182-188`).
- **Streaming nights** (`matchups.ts:146-153`) are team-nights, not players. They come from top-16 Week Score teams against a soft opponent defence (DEF ≤ 33, from opponent xGA/GP percentiles) or a "perfect storm" (team GF/GP and opponent GA/GP both in the top third, or the same for shots), plus a tired-opponent flag.
- **L5 recent form** (`attachRecent`, `players.ts:201-220`) is shown as evidence but does not affect ranking:
  - skaters: the latest strength-`all` row from `rolling_player_game_metrics`, covering last-5 G, A, P, SOG, PPP and TOI;
  - goalies: their 5 most recent games in `wgo_goalie_stats`;
  - data older than 14 days shows as no recent form, and a failed read shows "Recent form unavailable".

### 1.4 How ownership and stats are joined

`buildPlayerLayer` (`players.ts:61-117`) joins three sources:

- Yahoo ownership: `yahoo_players`, using the latest `ownership_timeline` point if there is one, otherwise `percent_ownership` dated by `last_updated` (`players.ts:34-41`);
- Yahoo-to-NHL ids: the `yahoo_nhl_player_map_read` view;
- season totals: WGO (`wgo_skater_stats_totals` and `wgo_goalie_stats_totals`).

A player is excluded if any of these apply:

- their Yahoo status is anything other than healthy or `DTD` (`players.ts:23`);
- they have no usable position;
- their Yahoo id is not in the map;
- they have fewer than 5 skater GP or 3 goalie starts (`players.ts:15-16`);
- WGO's current team disagrees with Yahoo's team;
- their team is outside the edition.

**Freshness is checked per player.** Ownership must be dated today or yesterday (New York time), and totals must be no more than 72 hours old (`players.ts:101-104`). If more rows are stale than current, the whole layer is marked `stale` and nobody is ranked (`players.ts:113`).

**Ownership meaning:** `percent_ownership` is Yahoo's **global** rostered %. It is not filtered by league (SS1 confirmed this, per CLAUDE-037). That makes it a popularity signal, not league availability.

### 1.5 Data sources and read limits

| Read | Table/view | Filter | Hard ceiling (fails closed) | Live size seen |
|---|---|---|---|---|
| Schedule | NHL schedule via `getSchedule` | week | n/a | 48 games / 32 teams (CLAUDE-034) |
| Opponent rates | `nst_team_stats` | season, `all` | explicit limit (`teamRates.ts`) | 32 rows |
| Ownership | `yahoo_players` | season, `<50%`, teams with games | 2000 (`playerSources.ts:11,63-65`) | 203 for top-10 teams |
| Skater totals | `wgo_skater_stats_totals` | season, teams | 1500 (`playerSources.ts:66-68`) | 223 for top-10 teams |
| Goalie totals | `wgo_goalie_stats_totals` | season, teams | 200 (`playerSources.ts:69-71`) | 23 for top-10 teams |
| Id map | `yahoo_nhl_player_map_read` | Yahoo ids in chunks of 150 | 2 × chunk (`playerSources.ts:74-81`) | — |
| Recent form | `rolling_player_game_metrics`, `wgo_goalie_stats` | the ≤36 shown players, 21-day lookback | 14 rows/player (`playerSources.ts:13,44-53`) | — |

All of these reads use the anonymous public Supabase client (`playerSources.ts:1`).

The "live size seen" numbers come from the top-10-teams read in SS1-8, and the code comment at `playerSources.ts:7-10`. Since SS1-10 the read covers all teams with games, and that version has not been run live (CLAUDE-037).

### 1.6 Access and caching today (the blockers to reuse)

- **Role gate.** The API requires a bearer session whose `users.role` is `social_editor` or `admin` (`web/lib/socialShare/access.ts:11-43`; route `web/pages/api/v1/social-share/[format].ts:14`). The page is also wrapped in `SocialShareAccessGate` (`web/pages/social-share/[format].tsx:12`).
- **No shared cache.** The route always sends `private, no-store` (`[format].ts:7`, `access.ts:4`). A CDN policy for ready editions, `shareCacheControl`, is written and tested (`server.ts:60-83`; s-maxage ≤ 300, 60 s when a layer is not ready), but the route **never uses it**. So right now, every load reads everything again.

---

## 2. The current RSO (Roster Schedule Optimizer)

Entry point: `web/pages/roster-schedule-optimizer.tsx:17-21` renders `RosterScheduleOptimizer` client-side. The page has no sign-in gate.

### 2.1 What works without Yahoo sync

| Capability | Without sync? | Evidence |
|---|---|---|
| Open the page anonymously | Yes | no auth gate in `pages/roster-schedule-optimizer.tsx` |
| Default source is **Manual** | Yes | `defaultContext` sets `provider: "manual"`, `leagueId/teamId: "manual"` (`web/lib/rosterScheduleOptimizer/workspace.ts:173-178`) |
| Public planning data (players, schedule, FORGE forecasts, Yahoo daily ownership, recent form) | Yes, no auth | `web/pages/api/v1/roster-schedule-optimizer/data.ts:8-35` ("Public shared inputs"); client fetch `web/lib/rosterScheduleOptimizer/currentPlanningRead.ts:83-89` |
| Public NHL schedule | Yes, cached | `web/pages/api/v1/roster-schedule-optimizer/schedule.ts:37` (`public, s-maxage=300, stale-while-revalidate=900`) |
| **Top-5 Week Score teams panel** | Yes, shown to everyone | `TeamScheduleContext` sorts by `summary.weekScore` and takes `.slice(0, 5)` (`web/components/RosterScheduleOptimizer/TeamScheduleContext.tsx:34-36`); rendered unconditionally at `RosterScheduleOptimizer.tsx:1034` |
| Manual roster entry (search by name or team, or paste names) | Yes | `RosterScheduleOptimizer.tsx:1038` |
| Manual rules, scoring, locks, matchup totals | Yes | `RosterScheduleOptimizer.tsx:1054`, `1128-1140`, `1219-1231` |
| Local workspace storage | Yes, localStorage only | `RosterScheduleOptimizer.tsx:228-233` |

### 2.2 Where the gates are

1. **Capability check.** `canSync = access.capabilities.includes("rso_sync")` and `canAutoUpkeep = … "rso_auto_upkeep"` (`RosterScheduleOptimizer.tsx:223-224`). Access comes from `GET /api/v1/roster-schedule-optimizer/access` (`RosterScheduleOptimizer.tsx:398`). That endpoint returns **401 for anonymous users** (`access.ts:9-10`); otherwise it returns in-season access or provider-sync access (`access.ts:12-17`). The capabilities are defined in `web/lib/in-season/access.ts:1` (`rso_sync`, `rso_account_save`, `rso_auto_upkeep`).
2. **Paid-sync enforcement flag.** `loadProviderSyncAccess` returns `eligible: true, reason: "rollout_free"` to **any signed-in user** unless `PROVIDER_SYNC_PREMIUM_ENFORCEMENT_ENABLED === "true"` (`web/lib/integrations/providerSyncAccessServer.ts:15-25`). With the flag on, a user needs an in-season `rso_sync` grant or a Draft Pro grant (`providerSyncAccessServer.ts:28-43`). The upsell text is "$4.99 monthly or a $24.99 season pass" (`web/lib/integrations/providerSyncAccess.ts:9`). Per `tasks/artifacts/billing-sales-rollout-2026-10-23/REPORT.md:10-11`, the flag is off by default and activation is a separate approval.
3. **Provider refresh** (pulling the Yahoo or Fantrax roster) stops when there is no user, `!canSync`, Manual mode or no team (`RosterScheduleOptimizer.tsx:452`, `526`). The reasons users see are at `RosterScheduleOptimizer.tsx:374-378`, ending with the upsell.
4. **Source picker.** Without `rso_sync`, the Yahoo and Fantrax options are labelled **"saved view"** (`RosterScheduleOptimizer.tsx:1021`).
5. **Read-only lock.** In non-Manual mode without sync, a saved or retained roster becomes **read-only and inert** (`readOnlySaved`, `RosterScheduleOptimizer.tsx:225-226`; the candidate panel is inert at `:1057`).
6. **Account save.** Saving to the server requires `rso_account_save` (`web/pages/api/v1/roster-schedule-optimizer/workspace.ts:147`).

### 2.3 What a non-sync user actually sees (Manual mode)

- **Empty roster.** Nothing is ranked until players are added (`confirmUnavailable` reads "Add roster players before confirming inputs.", `RosterScheduleOptimizer.tsx:652`).
- **No scoring.** Default `scoring.weights` is `{}` (`workspace.ts:181`). This leaves `scoringEntered` false (`RosterScheduleOptimizer.tsx:640-643`), which blocks lineup suggestions and plan selection (`:654-655`; `canSelectPlan` at `:1057`). The footer says "League scoring settings are missing…" (`CandidateBrowser.tsx:99-100`).
- **Add rules unknown.** `acquisitionTiming: "unknown"`, `acquisitionCost: null` and `periods: []` (`workspace.ts:181`) produce "Your league's add rules … aren't set yet." (`CandidateBrowser.tsx:101-102`).
- **Every free agent is "unknown".** Public players arrive with `availability: "unknown"` (`web/lib/rosterScheduleData/planningInputs.ts:156`; Manual only marks the user's own roster as `rostered`, `currentPlanningRead.ts:128-129`). Candidates count as known only when availability is `free_agent`, `manager_available` or `waivers` (`CandidateBrowser.tsx:35`, `72`; planner `web/lib/rosterScheduleOptimizer/planning.ts:1166`). So **"Best Fit Available" falls back to a discovery list**: known inputs first, then upcoming games, then name (`CandidateBrowser.tsx:36-37`). It includes rostered stars, because ownership is not used as a filter there. The user has to click **"Mark available"** on each player one at a time (`CandidateCard.tsx:122`, which writes `manager_available`; `RosterScheduleOptimizer.tsx:1057`, `markAvailable`).
- **What they do get for free:** the schedule calendar, the top-5 Week Score teams, per-player ownership and form chips, and the itinerary once their roster and scoring are in.

**Verdict.** For an anonymous visitor, or for a signed-in user once enforcement is on, the RSO is technically usable but **functionally unusable as a quick "who should I stream" tool**. Getting one ranked suggestion takes about four kinds of manual input: roster, scoring, add rules, and per-player availability.

### 2.4 Costs of the RSO path today

- **Every planning read skips the shared cache.** The client always sends `X-RSO-Read-Nonce` (`currentPlanningRead.ts:76`, `86`), and the server answers nonce reads with `private, no-store` (`data.ts:25`).
- **Each read is large:**
  - current rosters and identities (`planningInputs.ts:130-138`);
  - the selected FORGE forecasts;
  - 3 days of `yahoo_player_ownership_daily` plus the **whole** `yahoo_nhl_player_map_read` (`web/lib/rosterScheduleData/planning.ts:256-287`);
  - 21 days of `games` and `skatersGameStats` (`planning.ts:291-305`).
- **Payload budget:** up to 4 MB (`PLANNING_RESPONSE_BYTE_BUDGET`, `bridgeForecastWire.ts:103`).
- **Not measured:** per-request Supabase rows and response bytes. The point is that this path grows with the number of users, while a shared edition grows with the number of weeks.

---

## 3. A free RSO option: schedule → best teams → best players

### 3.1 Proposed UX (no customization or manual input)

This would be the **"Week Planner" first screen** of `/roster-schedule-optimizer`. It is also the default for anonymous users and anyone without sync.

1. **Week header.** Mon–Sun dates, a **Full week / Rest of week** toggle (the logic behind the Wednesday edition), and an "as of" time.
2. **Schedule grid.** All 32 teams in Week Score order, with GP and OFF counts coloured using TJ's tier rule. This reuses `mondayGridRows` and `editionCountTiers` (`mondayGrid.ts:26-65`).
3. **Best teams.** Schedule tiers, as in TJ's mockup ("Tier 1 · 4 GP / 3 OFF · CGY EDM"). The tiers group teams by distinct (GP, OFF) pairs, best first. This is what SS1 ticket 13 is building; strict by default with a documented widen option.
4. **Best players from those teams.** Under each tier bar, a short list of F, D and G players:
   - rostered under 50% in Yahoo leagues;
   - ranked by the same season rates (PPG; goalies QS%, then SV%);
   - each row shows "Yahoo rostered X%", position eligibility and an L5 line (as in the mockup);
   - an ownership filter chip: **<50 / <30 / <20**.
5. **Streaming nights and specialists** (optional extras): the existing `streamingNights` and `specialists` results.
6. **Plain labels.** "Ownership is across all Yahoo leagues, not your league. Check your waiver wire." "Rates are season totals, not projections."
7. **Bridge to the full RSO** (Option A+). Each player gets an "Add to my plan" button that opens Manual RSO with that player in `manualPlayers`, marked `manager_available`. That is exactly the field the Mark-available button sets today (`RosterScheduleOptimizer.tsx:1057`). This step is optional, and it needs Codex because RSO is Codex-owned.

### 3.2 Data flow

```
GET /api/v1/rso/week-planner?weekStart=YYYY-MM-DD&span=full|rest   (public, no auth)
  └─ loadScheduleShareSnapshot("game-grid" | "remaining-week", weekStart)   ← existing server.ts
       ├─ NHL schedule → Week Score rows (+ tiers)
       ├─ nst_team_stats → opponent layer (streaming nights)
       ├─ yahoo_players <50% + id map + WGO totals → player layer
       ├─ trim to the shown players (now: tier lists ≤ N per tier)
       └─ recent form for shown players only
  Cache-Control: shareCacheControl(snapshot)   ← already written, s-maxage ≤ 300 when ready
```

### 3.3 Reusing the social-share code

- **Reused as-is (pure and tested):**
  - `buildScheduleSnapshot` / `selectScheduleDates` (Week Score, GP, OFF, freshness);
  - `mondayGridRows` / `countTiers`;
  - `buildPlayerLayer` / `resolveOwnership` / `positionGroup`;
  - `pickupTiers` / `specialists` / `streamingNights`;
  - `attachRecent`;
  - `loadSharePlayerSources` / `loadSharePlayerRecent` (bounded and fail-closed);
  - `shareCacheControl`.
- **Needs new code:**
  - a public route that skips `requireSocialShareAccess` and uses `shareCacheControl` instead of `no-store`;
  - a trim step for "players per schedule tier", which must match whatever SS1 ticket 13 settles on;
  - the Week Planner component inside the RSO page.
- **Ownership boundary.** `web/lib/socialShare/**` is SS1's lease. The RSO page, the `/api/v1/roster-schedule-optimizer/**` routes and any `lib/rosterScheduleOptimizer/**` change are Codex's. The cleanest split: Codex owns the route and UI, and imports the SS1 pure functions read-only. Alternatively, the shared pieces move to a neutral module such as `web/lib/weekPlanner/`, which is a decision for both lanes.

### 3.4 Gaps to close

1. **Global ownership is not league availability.** This is the main limitation of a free tier. Without sync, the tool cannot know who is free in *your* league, so it has to say so plainly. The RSO already handles this the same way: "Ownership is not league availability" (`rosterScheduleData/planning.ts:256`).
2. **Two ownership sources.** Social share reads `yahoo_players` (timeline or percent); RSO reads `yahoo_player_ownership_daily` (3-day window). The two could show different percentages for the same player on the same day, so one source should be canonical. This is Codex's ownership contract.
3. **The ranking signal is season rates, not FORGE.** It ignores league scoring, which suits a no-input free view. FORGE projections served through `rsoUsePolicy` are the obvious paid upgrade, or could appear as a teaser for the top players only. Codex decides that.
4. **Yahoo-centric.** Positions and rostered % are Yahoo's. ESPN and Fantrax users get a reasonable proxy but not their own platform's numbers.
5. **Week definition.** Social share uses Mon–Sun New York weeks. RSO uses provider matchup weeks (`yahoo_matchup_weeks`, `planning.ts:69`) in the user's time zone. Mon–Sun is correct for most Yahoo head-to-head leagues, but long weeks (All-Star break, opening week) need a decision.
6. **Edition freshness near puck drop.** An edition expires 15 minutes after its read once a game is within 6 hours (`schedule.ts:82`). On game days the CDN refreshes it about every 5 minutes. That is fine for cost but means more reads per day than a static weekly page.
7. **Goalie starts.** Free picks by QS% do not know who starts tonight. The Start Chart / FORGE goalie data is Codex's.
8. **The expanded all-teams read has never run live.** It was added in SS1-10 and is unverified (CLAUDE-037/-038), so a bounded live check under TJ's approval comes before any launch.
9. **SS1 ticket 13 is in flight.** The tier-list trim rule and the widen option should come from that ticket, not be invented twice.

### 3.5 Costs (Supabase reads and caching)

- **Per uncached edition:**
  - 1 NHL schedule read;
  - 1 `nst_team_stats` read (32 rows);
  - 3 parallel exact-count reads: Yahoo (≤2000), skaters (≤1500) and goalies (≤200), roughly 450 rows at top-10 scale and more for all teams;
  - about 2–14 map chunks;
  - 2 recent-form reads for ≤36 players.

  That is about **8–20 small Supabase GETs and well under 5k rows**, using the anon key with no RPC or writes.
- **With `shareCacheControl`:**
  - The cache key is only `weekStart` × `span`: 2 values per week, plus next week if offered.
  - Reads scale with **editions × refresh windows**, not visitors. That is at most about 12 refreshes an hour per key per CDN region on game days (s-maxage ≤ 300), and fewer otherwise.
  - Browsers always revalidate (`max-age=0`).
- **The alternative, building the free tier on the RSO data endpoint,** would cost one large private read per visitor per planning generation (§2.4). That does not scale for a free tier.
- **Guardrails to keep:**
  - strict query validation, which the SS1 route already does (`[format].ts:13`);
  - no `selectedDates` free-form list in the public route (use `span` only, to keep the cache key small);
  - fail-closed limits;
  - unready editions cached at most 60 s;
  - no new cron, no precompute table.
- **Vercel cost.** One function invocation per CDN miss, which is small. Any production verification still follows the AGENTS.md rule: at most 5 sequential read-only requests, with TJ's approval.

### 3.6 Entitlement and paywall implications

- **Free (Week Planner):**
  - schedule grid, tiers and best teams;
  - global-ownership pickups and streaming nights;
  - L5 evidence;
  - "Add to my plan" into Manual RSO, still using localStorage only.

  None of this touches user, league or provider data, so it never calls `/access`.
- **Paid (unchanged capabilities):**
  - `rso_sync`: real league rosters and availability, Yahoo/Fantrax refresh, provider rules;
  - `rso_auto_upkeep`;
  - `rso_account_save`;
  - FORGE-projected points under the user's scoring;
  - legal add/drop itineraries.

  The upgrade pitch becomes: "**See who's actually free in your league** and get a legal add/drop plan."
- **Interaction with the enforcement flag:**
  - While the flag is off, signed-in users already sync for free, so the Week Planner mainly serves anonymous and logged-out visitors (SEO and social traffic).
  - Once it is on, the Week Planner is the free floor that keeps the RSO useful.
  - The change does not touch `providerSyncAccessServer.ts` or the billing rules. It adds a free surface beside them.
- **Positioning risk:** a free tier that is too good weakens the paid one. Keeping it league-agnostic (global %, season rates, no roster-awareness) keeps a clear gap.
- **Social-share relationship:** the free planner and the share images show the same numbers from the same functions, so a posted card links to a live page that matches it.

---

## 4. Options

| | Option | What it is | Pros | Cons |
|---|---|---|---|---|
| **A** | **Public Week Planner (recommended)** | New public, CDN-cached route using the social-share pipeline; no-input first screen on the RSO page | Reuses tested code; cost does not grow with visitors; works anonymously; matches TJ's ask exactly; clear free/paid line | Global ownership only; needs a public route and SS1/Codex code-sharing agreement; one live check |
| A+ | A plus "Add to my plan" | Picks open Manual RSO pre-filled and `manager_available` | Turns browsers into RSO users; small change once A exists | Touches Codex RSO workspace code |
| B | Make Manual RSO friendlier | Scoring presets (Yahoo default points/categories), auto-"probably available" for players under X%, a best-teams filter in Best Fit Available | Single tool; uses FORGE projections | Still needs roster entry; per-visitor 4 MB no-store reads (§2.4); auto-availability is a guess inside a planner that is careful about verified inputs |
| C | Rely on `rollout_free` | Leave enforcement off | No work | Anonymous users get nothing new; ends when enforcement turns on |
| D | Free tier = limited sync | e.g. read-only Yahoo roster import with no auto-upkeep | League-aware for free | Undercuts the paid product; Yahoo API cost per user; billing/entitlement rework (Codex) |

**Recommendation: A now, then A+.** Consider B's scoring presets later, as a separate Codex decision. Keep C as the current reality until TJ decides to enforce, and do not pursue D.

---

## 5. Suggested build slices (for later, if approved)

1. **Codex:** confirm the ownership source (`yahoo_players` vs `yahoo_player_ownership_daily`) and the module location for the shared pure functions.
2. **Public route** with `shareCacheControl`, validated `weekStart` and `span`, and no auth, plus Vitest coverage for the cache header and query rejection.
3. **Week Planner component** on the RSO page, reusing SS1 ticket 13's tier-list rules.
4. **Bounded live check** under TJ's pop-up approval (≤5 sequential GETs) to verify the all-teams read size.
5. (A+) "Add to my plan" handoff into the Manual workspace.

---

## 6. Decisions for TJ and Codex

| # | Decision | Owner | Suggested default |
|---|---|---|---|
| 1 | Build a free Week Planner at all, and which option (A / A+ / B / C / D)? | TJ | A, then A+ |
| 2 | Where it lives: first screen of `/roster-schedule-optimizer`, or a separate public page linked from it? | TJ + Codex | First screen of the RSO for non-sync users |
| 3 | Which ownership source is canonical for free picks? | Codex | One source for both share cards and RSO |
| 4 | Ranking signal: season rates only, or a FORGE-projection teaser? | Codex (+TJ) | Season rates free; FORGE paid |
| 5 | Tier rule: strict (GP, OFF) tiers vs Week Score order, players per tier, widen rule | TJ (SS1 ticket 13) | Inherit ticket 13 |
| 6 | Ownership bands shown: <50/30/20 (as today) or a single cut-off with a filter? | TJ | Same three bands, as filter chips |
| 7 | Week definition for long or odd weeks (Mon–Sun New York vs provider matchup week) | Codex | Mon–Sun, with a note on long weeks |
| 8 | Is the code shared through a neutral module or by importing `lib/socialShare`? | Codex + Claude | Neutral `lib/weekPlanner/` (or similar) |
| 9 | When to turn on `PROVIDER_SYNC_PREMIUM_ENFORCEMENT_ENABLED`, and whether the Week Planner ships first | TJ | Ship the free floor before enforcing |
| 10 | Approve one bounded live check of the all-teams read (≤5 sequential GETs) before launch | TJ | Yes, when a candidate exists |
| 11 | Should the public share route also start using `shareCacheControl`, or stay role-gated and `no-store`? | TJ + Codex | Keep the share studio gated; the public route is separate |

## 7. Not verified

- **Production setting of `PROVIDER_SYNC_PREMIUM_ENFORCEMENT_ENABLED`:** not checked, because production reads were out of scope. This is the main unknown behind TJ's "unusable" question.
- **Read sizes:**
  - Real row counts for the all-teams player read: these come from code comments and receipts, not measured.
  - RSO data endpoint rows and bytes per request: not measured.
- **SS1 ticket 13:** its tier logic was in progress and not reviewed.
- **Production deployment:** whether this working-tree code is what production runs was not checked (no Git or deploy inspection).
