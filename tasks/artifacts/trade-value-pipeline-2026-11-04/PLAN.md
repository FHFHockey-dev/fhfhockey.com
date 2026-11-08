# Trade-value pipeline plan (BLSH decision 6)

Status: **planning only.** Written 2026-11-04 by the Claude trade-value planning session. Nothing here has been built, collected, migrated or deployed. Decision 6 is quoted in [DECISIONS.md](../blsh-brief-decisions-2026-11-03/DECISIONS.md#6-market-value). TJ's answers to the decisions this plan depends on are in [§7](#7-decisions-tj-answers).

## 0. What already exists

| Thing | Where | What it establishes | What it does not |
| --- | --- | --- | --- |
| `TradeObservation`, `cardTradeContext`, `illustrativeTradeIdeas` | `web/lib/player-cards/analysisEvidence.ts` | A display contract for complete give/receive bundles with picks, league context (`scoring`, `roster`, `leagueSize`, each nullable), source URL check, dedup by transaction id, and a refusal on conflicting duplicates. | No storage, collection, identity mapping, parse version or coverage. `id` semantics are unproven. Picks have no original owner or conditions. |
| `compareMarketReference` | `web/lib/buyLowSellHigh/market.ts` | A single-value reference comparison that refuses on unit, horizon, scoring or freshness mismatch. Ownership is not accepted. | It needs one number per player. Observed trades do not give one, so it cannot take Trade Market rows directly. |
| `compareTrade` | `web/lib/buyLowSellHigh/trade.ts` | A manager-entered package comparison from FORGE horizon totals under league scoring. Missing inputs never yield a winner. | No roster, replacement or acceptance logic. Unwired. |
| Codex Trade Market PoC (10-27) | `/Users/tim/Documents/Codex/2026-10-27/task-5/` (outside the repo) | The source page: `https://hockey.fantasysports.yahoo.com/hockey/playertrades?pid=<yahoo pid>&type=player`. A reviewed, unapplied ten-table `yahoo_trade_market_*` schema. Finite-run controls (3 PIDs, 60 s spacing, stop on 429). TJ's recorded permission and the logo requirement. | **Zero real observations.** Both normal fetches (about 20:50 and 22:12 UTC on 10-27) returned HTTP 429 with no body and no Retry-After. Selectors, dates, pick rendering, empty state and event ids are all unverified. The fixtures are synthetic. |
| Yahoo identity | `web/lib/integrations/yahoo/yahooIdentity.ts`; tables `fhfh_player_external_identities` → `fhfh_player_identities.nhl_player_id` | A Yahoo key maps to an FHFH player only when unique both ways within one game and season. The FHFH player row carries `nhl_player_id`. | The PoC's one verified mapping (`477.p.4681` → FHFH 9923) has no NHL-id bridge retained. 9923 is not an NHL id. |
| Yahoo OAuth | `web/lib/integrations/yahoo/oauth.ts`, `tokenManager.ts`, `providerClient.ts` | Authorization-code flow with PKCE against `api.login.yahoo.com`, per-user stored tokens, refresh, 429 handling with Retry-After, fixed read-only resource allowlists. `fetchYahooPlanningResource` already allows `league/{key}/transactions`. | OAuth bearer tokens cover the Fantasy Sports API, not website pages. The Trade Market page is not an API resource. |
| Roster Autopsy | PRD FR8 in `tasks/TASKS/prd-roster-autopsy.md`; `web/lib/rosterAutopsy/manual.ts` | Trade Market rows are context, not price. Every side, pick, unknown item and raw wording is kept. | No trade-value input exists. |

## 1. Access and permitted use

Research date: 2026-11-03/04, public pages only. No Yahoo endpoint or page was requested for this plan.

### 1.1 What the Trade Market is

- Yahoo describes it as "a research tool that shows trade trends in other leagues", reached in a league under Research → Trade Market. The help page describes a web page and does not say whether the app has it, which sports it covers, or which fields it shows. [Y1] The Research tab article says you can see "recent deals in the Trade Market". [Y2]
- The URL Codex was given is `https://hockey.fantasysports.yahoo.com/hockey/playertrades?pid=<yahoo pid>&type=player`: one page per player. Both of Codex's fetches got HTTP 429 back. [C1]
- It was live for hockey in 2025-26: a RotoWire column dated 2026-01-21 cites six Yahoo Trade Market deals. The deals list players only, with no picks, format, team count, scoring or dates, so the fields the page shows are still unverified. [R1]
- Separately, **Trade Hub** is a paid Yahoo Fantasy Plus feature. It has a "Most traded" view across all fantasy leagues and covers hockey. [Y3] It is a Yahoo product that overlaps with what FHFH wants to build (see §1.3, item 4).
- **Not in the API.** The Fantasy Sports API documentation has no Trade Market, Trade Hub or cross-league trade resource. [D1]

### 1.2 What the official API offers instead

- `league/{league_key}/transactions` covers adds, drops and trades. It filters by `type`/`types` (`trade`), `team_key` and `count`. A completed trade's key is `{game}.l.{id}.tr.{n}`, and each player row has a source team and a destination team. Pending trades show only when `team_key` is set. [D1]
- League metadata and settings carry `scoring_type`, `num_teams`, `roster_positions`, stat categories and modifiers, and `trade_end_date`. So **trades in a connected league come with their full league context.** [D1]
- Access: a user "can only retrieve data for private leagues of which they are a member, or for public leagues". [D1] The docs list no endpoint for discovering public leagues and no cross-league trade feed.
- How draft picks appear in trade transactions is not documented in what was read. Keeper leagues can trade picks. [Y4]
- The existing integration already allows the `league/{key}/transactions` read: it is in `fetchYahooPlanningResource` in `providerClient.ts`. It would need `;types=trade` and the settings resource.

### 1.3 Terms

| Source | What it says | Effect on this plan |
| --- | --- | --- |
| Yahoo Developer API Terms of Use, REV 3-2022, §2(a) [T1] | User data must be removed "within 24 hours after the time at which you obtained the data", unless the API docs allow indefinite storage. | Storing API-read trades for a season is not allowed by default. |
| Same, §2(b) [T1] | "You may not disclose any Yahoo user data" unless the user expressly allows it and the privacy policy says so. | Showing one league's trades to people outside it is not allowed by default. |
| Same, §1(g) [T1] | Bars excessive or abusive usage, use in a product that "competes with products or services offered by Yahoo", and deriving income from the APIs, each unless Yahoo gives prior written permission. | Ad-supported display, and overlap with Trade Hub, need Yahoo's written permission. |
| Yahoo Terms of Service §2(d), items 9–10 [T2] | Bars collecting data from Yahoo services "using any automated means" without permission, and using it "to create any database, archive, … data feed". | Automated reads of the Trade Market page and a stored trade table both need Yahoo's express permission. |
| Fantasy Sports API terms and developer page [T3, D2] | The developer page requires attribution of the form "Fantasy data provided by Yahoo Fantasy", with a link and the official logo. Search snippets describe the API as for non-commercial tools and say it needs an "API Access and Use Agreement". The terms page itself returned 404, so this row is **not confirmed**. | Logo and wording go on every Yahoo-data surface. |

**TJ's recorded permission.** On 10-27, TJ reported "Yahoo has given permission, with the caveat that the yahoo logo needs to be displayed", and then said "I have permission for this specifically". That covered the Trade Market collection. [C2] On 11-04 (decision 1), TJ confirmed that the permission covers automated page reads, storage beyond 24 hours, public display on FHFH, and all three products. That is TJ's report: the agreement text itself has not been inspected, and the volume, attribution details and commercial (ad-supported) use are still not spelled out. This plan proceeds on TJ's confirmation, displays the Yahoo logo, and keeps the §6 questions open for TJ's Yahoo contact.

### 1.4 Authentication

- **API reads** (own-league trades, settings): the existing per-user OAuth 2.0 authorization-code flow with PKCE (`oauth.ts`, `tokenManager.ts`). The read scope is chosen when the app is registered; there is no `scope` parameter in the authorize URL. Access tokens last 1 hour and refresh tokens are long-lived. [D3] Reads run as a connected manager, for that manager's leagues only.
- **Trade Market page:** this is a website page, not an API resource, so OAuth bearer tokens do not apply. Whether it needs a signed-in Yahoo session cookie is **unknown**. The Research menu sits inside a league, which suggests it does. Decision 2 says to scrape and upsert to Supabase from the start, so the collector's first canary settles it. If the page answers with a sign-in page or a challenge, the collector records that capture state and stops. A stored session cookie would be a persistent credential, so it would need TJ's separate per-action approval. It is not part of this plan.

### 1.5 Rate limits

- Yahoo publishes no number. The developer page says Yahoo "may temporarily throttle or limit access" if usage is excessive over short periods. [D2] The API terms leave limits to Yahoo's discretion. [T1]
- Community client libraries treat HTTP 999 as Yahoo's rate-limit response and space calls about 2 s apart. That is a weak source. [L1]
- Observed here: two 429s on the Trade Market page within about 80 minutes on 10-27, with no Retry-After header. [C1] The 10-26 RSO window used about 64 API reads per snapshot, and a second open tab doubled that. ([memory: Yahoo window lessons])
- §4.2 therefore proposes a cautious budget and a stop on the first 429 or 999.

### 1.6 Sources

- [Y1] https://help.yahoo.com/kb/SLN7004.html (Trade Market)
- [Y2] https://help.yahoo.com/kb/SLN26603.html (Research tab)
- [Y3] https://help.yahoo.com/kb/SLN35629.html (Trade Hub, Fantasy Plus)
- [Y4] https://help.yahoo.com/kb/SLN6453.html (trading draft picks)
- [R1] https://www.rotowire.com/hockey/article/nhl-trade-tips-mctavish-has-fantasy-value-103188
- [D1] https://sports.yahoo.com/developer/docs/ (Fantasy Sports API)
- [D2] https://sports.yahoo.com/developer/ (developer page, attribution, throttling)
- [D3] https://developer.yahoo.com/oauth2/guide/flows_authcode/
- [T1] https://legal.yahoo.com/us/en/yahoo/terms/product-atos/apiforydn/index.html (re-read 2026-11-04; REV 3-2022)
- [T2] https://legal.yahoo.com/us/en/yahoo/terms/otos/index.html (re-read 2026-11-04; §2(d) items 9–10)
- [T3] https://legal.yahoo.com/us/en/yahoo/terms/product-atos/fantasysportsapi/index.html (404 on fetch; snippets only)
- [L1] https://www.pkgstats.com/pkg:yahoo-fantasy-api (community client)
- [C1] `/Users/tim/Documents/Codex/2026-10-27/task-5/integration_v1/evidence/source-check-20261027T221208Z.json`
- [C2] `/Users/tim/Documents/Codex/2026-10-27/task-5/PERMISSION-AND-ATTRIBUTION.md`

## 2. Data contract

The contract extends `TradeObservation` rather than replacing it. The card contract stays the display shape; the pipeline stores more and projects down into it.

### 2.1 Layers

1. **Capture.** One row per request: source kind, exact URL, requested and received time (UTC), HTTP status, body hash, size, parse version, run id. A 429 or an error is a capture with no observations, never an empty market.
2. **Sighting.** One row per trade as it appeared in one capture, with the raw text of both sides and the raw date text. A sighting is evidence that the page showed this, at that time.
3. **Observed trade.** A sighting promoted to an event only when the source gives a stable, scoped event id. Without one, sightings stay separate and identical bundles become an *inferred cluster*, labelled as inference.
4. **Assets.** Every asset on both sides, in source order: player (raw Yahoo key and name text, mapped NHL id or `unmapped` with reason), pick (season, round or null, original owner text or null, condition text or null, raw text), or `unknown` (raw text). An asset is never dropped to make a cleaner comparison.
5. **League context.** `scoring_type` (head-to-head points, head-to-head categories, roto, points; or unknown), the scoring settings when known, roster positions, team count, keeper or dynasty format, trade date, source league id if exposed. Every field is nullable and an unknown stays unknown.

### 2.2 Proposed `TradeObservation` v2 (shape only)

```ts
type TradeAssetV2 =
  | { kind: "player"; yahooKey: string; nameText: string; nhlPlayerId: number | null; mapping: "verified" | "unmapped" | "ambiguous" | "wrong_scope" }
  | { kind: "pick"; season: string | null; round: number | null; originalOwnerText: string | null; conditionText: string | null; rawText: string }
  | { kind: "unknown"; rawText: string };

type TradeObservationV2 = {
  id: string;                      // sighting id; event id only when the source proves one
  identity: "source_event" | "sighting_only";
  source: "Yahoo Trade Market" | "Yahoo league transactions" | "Manager entered";
  sourceUrl: string | null; attribution: string; parseVersion: string;
  observedAt: string;              // capture time, UTC
  tradedAt: string | null; tradedAtText: string | null;
  sides: { label: string; assets: TradeAssetV2[] }[];  // two or more; a three-team trade is not forced into give/receive
  context: { scoringType: string | null; scoring: Record<string, number> | null; roster: string | null; leagueSize: number | null; keeper: string | null; sourceLeagueId: string | null };
  completeness: "complete" | "partial";  // partial = any unmapped player, unknown asset or missing side
  sample: "observed" | "synthetic";
};
```

`cardTradeContext` keeps working through a projection: two-sided, `identity`-aware, unmapped players shown by name text with "identity unverified".

### 2.3 Player identity

Map Yahoo key → FHFH player with the existing `verifiedYahooIdentities` rules (one game and season, verified both ways, no merge), then FHFH player → `nhl_player_id`. Missing, ambiguous or wrong-scope mappings keep the raw key, mark the asset, and mark the trade `partial`. A trade is never discarded because a mapping failed, and an unmapped player is never matched by name.

### 2.4 Deduplication

- The same capture replayed is idempotent on body hash.
- A sighting seen in several captures (the same trade on two players' pages, or on one page on two days) is one sighting only when the source event id proves it. Otherwise the match is an inferred cluster on (sorted complete sides, trade date, context), shown as "possibly the same trade".
- Conflicting data under one event id withholds the trade, as `cardTradeContext` does now.
- Counts shown to users are "sightings" or "proven trades", never "deals" unless proven.

### 2.5 Coverage and quality checks (per run)

- Pages requested, received, 429, error, parse failed, valid empty (only when the page's own empty marker was seen).
- Sightings per page, share with full context, share with any pick, share with an unmapped player.
- Date range observed; the age of the newest sighting per player.
- Players in the target universe with zero captures versus captures with no trades. The two are different and are shown differently.
- A parse-drift alarm when the share of unparseable rows or of missing sides rises above the last qualified run.

## 3. Shared pipeline

```
Sources                       Store                         Valuation                          Products
-------                       -----                         ---------                          --------
Yahoo Trade Market page ─┐                                  League profile (scoring,           BLSH trade view
Yahoo league trades (API)├─► captures → sightings → assets  roster, size) ──┐                   Trade Analyzer
Manager-entered offers ──┘        (observed evidence)       FORGE horizon ──┼─► player value    Roster Autopsy
                                        │                   (qualified only)│   (pipeline's own)      ▲
                                        └──────── kept apart ───────────────┴──────► comparison ──────┘
```

### 3.1 Two kinds of number, never merged

- **Observed market evidence:** what traded for what, where, when and under which context. It is not a price. It is shown as bundles.
- **Pipeline valuation:** FHFH's own estimate of a player's value to a given league. It is a model output with a method version, inputs and uncertainty.

They are compared only side by side: "under your league's scoring, the pipeline values side A at X and side B at Y; this trade happened in a 12-team head-to-head points league." There is no per-player price backed out of a bundle, no market-implied value and no pick value until a separately validated method exists.

### 3.1a Valuation components (decision 4)

The pipeline value combines four components. Each one is computed per (player, league profile, horizon), and each stays visible:

1. **Value over replacement (VOR):** qualified FORGE horizon production under the league's scoring, minus a replacement level set by the league's team count and roster slots. It is unavailable when FORGE or the scoring is missing.
2. **Season-to-date actual totals:** actual fantasy points under the league's scoring, plus the player's current rank.
3. **Raw projected points:** qualified FORGE horizon totals under the league's scoring, with no replacement adjustment (as `compareTrade` does now).
4. **ADP:** draft-day value, as a weighted input. TJ amended decision 6's "ADP is context, not a trade price" rule for this purpose.

Rules for the combination:

- The weights are provisional. They need their own chronological test, as decision 5 requires for any combined assessment: against VOR alone, season-to-date alone, and simple baselines.
- A missing component never becomes zero. If a required component is missing, the combined value is `unavailable` and the components that do exist are shown alone.
- Ownership percentage stays context only.
- ADP is draft-day data. It is never shown as, or mixed with, observed market evidence.

### 3.1b Plausibility guard (decision 4 follow-up)

The guard checks every trade *suggestion*. A suggestion is held back when its sides are far apart in draft-day value: for example, waiver-level players offered for Connor McDavid.

The guard yields when current evidence contradicts draft-day value. If the player's current total value and current rank are well below their ADP tier (a highly drafted player who has flopped over the first few weeks), the suggestion may appear as a labelled buy-low scenario. The thresholds for "far apart" and "contradicted" are provisional and are tested with the weights.

The guard filters suggestions only. It never hides observed trades or manager-entered offers. When an entered offer would trip it, it shows a note.

### 3.2 Where FORGE and league scoring enter

1. **League profile:** scoring weights or categories, roster positions, team count and keeper format. Sources: the manager's Yahoo league settings when connected, otherwise FHFH Standard by default (decision 5) or manual entry. The profile is versioned and carried on every valuation.
2. **FORGE input:** only releases admitted through `verifiedForgeReleases` / the consumer admission path, at the decision 4 horizon (next 10 team games by default; 5 and 20 as options). A missing or unqualified forecast makes that player's value `unavailable`, never zero.
3. **Valuation:** the components are in §3.1a. It runs per (player, league profile, horizon, FORGE release, ADP snapshot). It outputs each component, the combined value, uncertainty, and the versions of its inputs.
4. **Retrospective BLSH evidence** stays its own track beside the valuation (decision 4), never an input to it.

### 3.3 How each product consumes it

Each product imports a read-only interface and can ship on its own. None waits for another.

| Product | Reads | First useful release without the others |
| --- | --- | --- |
| BLSH | The trade view: the valuation for the player and package under the manager's scoring; recent Trade Market sightings for that player as context. Lists never depend on it. | Trade view with valuations only and "Market evidence unavailable", or sightings only with "Valuation unavailable". |
| Trade Analyzer (planned) | Package valuation for any two or more sides; sightings that contain any of the players; manager-entered offers. | Manager-entered packages valued under one league profile. |
| Roster Autopsy (planned) | Per-player valuation under the league profile for both teams' before/after, and sightings as context only (FR8). | Its existing manual grades; valuations added once qualified. |

The shared code is a library plus tables, not a page. Each product owns its own UI and its own release gate.

### 3.4 Manager-entered offers

A manager can enter an offer they received or made: sides, assets, date, and optionally their league (or a connected league). These are stored under `source = "Manager entered"`, private to that manager, and never mixed into Trade Market counts. They feed the analyzer for that manager and may be shown to that manager as "your entered offers". They are not shown to others or used as market evidence unless TJ decides otherwise later.

### 3.5 Context, not market price

- Ownership percentage, add/drop trends and rank lists may appear as labelled context next to a player. They never enter the valuation, never fill a missing value, and never stand in for market evidence.
- ADP is the one exception, by TJ's amendment in decision 4. It is a weighted valuation input and the basis of the plausibility guard (§3.1a–b). It is still not observed market evidence.
- `compareMarketReference` keeps refusing all of these as a market reference.

### 3.6 Unavailable is shown, never invented

Every value and every evidence block has an explicit state: `available`, `unavailable` (with reason: source blocked, not collected, not qualified, mapping failed, forecast missing, scoring unknown), `stale` (with age) or `partial`. A missing source never becomes zero, an empty list or an implied price. A page with no qualified source says so in words.

## 4. Phasing, cost and gates

### 4.1 Phases

Decision 2 is scrape and upsert to Supabase from the start, so there is no manual-capture stage. The collector stores each raw response privately before it parses anything, and the parser is built against those stored bodies. Nothing is shown to users until the §4.4 gates pass.

| Phase | What | Requests | Exit gate |
| --- | --- | --- | --- |
| P0 Contract | Offline: `TradeObservation` v2 types, projection into the card contract, dedup and coverage functions, valuation and guard interfaces, fixtures marked synthetic. | 0 | Unit tests; Codex review of the contract. |
| P1 Capture storage | Migration for the run, capture and attempt tables (§4.3), with private raw bodies. Server-only writes; no public read of raw HTML. | 0 | Local Postgres test; RLS review; TJ approval to apply. |
| P2 Collector canary | Server collector behind a flag, default off. One canary run of at most 3 pages that upserts captures (body, status, hash) to Supabase. It records sign-in, challenge and 429 states and stops on the first one. | ≤ 3 | Run inside budget; captures stored; whether a sign-in is needed is answered. |
| P3 Parser | Parse stored bodies into sightings and assets; retire the synthetic selectors; migration for the sighting, bundle and asset tables; upsert parsed rows. Re-parsing stored bodies costs no requests. | 0 | Every side and pick reproduced against the stored pages by hand check; empty and error pages recognized; date and event-id semantics written down; identity match rate measured (gate 3). |
| P4 Daily collection | The wider universe from decision 3, paced as in §4.2. | ≤ 100 a day | Seven days with zero or isolated 429s; coverage report reviewed. |
| P5 Valuation | The §3.1a components and the §3.1b guard, on FORGE-admitted releases, league profiles and an ADP snapshot. | 0 provider calls | Chronological test of the weights and guard thresholds against simple baselines; uncertainty reported; refuses on missing inputs. |
| P6 Product reads | BLSH trade view first. Trade Analyzer and Autopsy pick it up when they are built. | 0 at page view | Market-evidence gates (§4.4) pass before any market sentence is shown. |
| P7 Own-league trades | Read `league/{key}/transactions;types=trade` and settings for connected leagues (plan default; not a TJ decision). | 1–2 per league per refresh | Full league context; shown only to that league's managers. |

### 4.2 Request budget (proposal)

- **Universe (decision 3):** every NHL skater and goalie currently on an NHL roster, about 700 pages. BLSH-listed players come first in each cycle, then the rest by Yahoo ownership, so a full cycle takes about a week.
- **Pacing:** one page per invocation, an invocation every 15 minutes, at most 96 pages a day: about 670 a week. Each invocation runs for seconds, so there is no long-running function. Concurrency is 1, with no retries inside an invocation, no alternate route, no proxy and no parallel keys.
- **Stops:** the first 429 or 999 pauses the collector for 24 hours. A second pause within 7 days holds it until a person restarts it. A sign-in page or challenge stops it outright.
- **Vercel cost:** about 96 short cron invocations a day. This must be inventoried against the cron cost controls in `AGENTS.md` before P4 is switched on. The alternative is to run it in the `webhooks/` service. That choice is made at P4 with TJ.
- **Own-league API (P7):** about 2 reads per connected league per day. These are separate from RSO's roughly 64 reads per snapshot and must not share a page load with them.
- **Page views:** zero provider calls. Products read stored rows only.

These numbers are a conservative proposal, not a Yahoo-published limit.

### 4.3 Storage (proposed only; nothing applied)

Start from the Codex candidate (`yahoo_trade_market_run, _capture, _attempt, _parse, _observed_row, _sighting, _bundle, _asset, _inferred_cluster, _inferred_member`) and change three things:

1. Rename it to source-neutral `trade_observation_*` with a `source` column, so own-league and manager-entered trades share the shape. Manager-entered rows carry an owner user id and RLS limits them to that user.
2. Add `nhl_player_id` and `mapping_state` to the asset table, filled at parse time from the identity tables, with the raw Yahoo key kept.
3. Add the league-context columns from §2.1 to the bundle table.

Valuation tables, separate from observations:

- `trade_value_league_profile` (id, source, scoring json, roster json, team count, keeper, version).
- `trade_value_player` (player, league profile, horizon, FORGE release id, ADP snapshot id, method version, VOR, season-to-date points and rank, projected points, ADP, combined value, uncertainty, state, reason, computed at).
- `trade_value_adp_snapshot` (source, captured at, format, player → ADP). This is draft-day data, kept apart from observations.

Retention (storage is permitted per decision 1): keep parsed rows for the season and raw bodies for the season too, stored privately, so the parser can be re-run on them without new requests. Raw HTML is never served.

### 4.4 Gates before any market conclusion is shown

1. **Permitted use:** TJ confirmed collection, storage, public display and use across all three products (decision 1). The Yahoo logo and attribution wording follow §6 item 5 once it is known; until then, use the logo and "Fantasy data provided by Yahoo Fantasy" text from the developer page.
2. **Parser** verified on real pages, both sides and all picks, with empty and error states.
3. **Identity:** at least 95 % of player assets map to an NHL id with verified mappings in the qualifying run; the rest show as unverified.
4. **Coverage:** a coverage report exists for the run that produced the rows, and the page says how many players were checked and when.
5. **Quality:** no unresolved conflicting duplicates; parse-drift alarm clear.
6. **Freshness:** each sighting shows its observed date; anything older than the agreed age is labelled stale.
7. **Separation:** the market block and the valuation block render separately, each with its own source line. The Yahoo logo shows on every surface with Yahoo data.

Until all seven pass, the page shows "Market evidence unavailable" and why.

### 4.5 Risks

| Risk | Effect | Handling |
| --- | --- | --- |
| Yahoo blocks or rate-limits automated page reads (already seen: 2 × 429). | No market evidence. | Stop on first 429; long back-off; the product works without the market block. |
| Permission scope differs from TJ's report (the agreement text was not inspected). | Must remove data and features. | Collection stays behind a flag; data deletes by source; §6 questions go to TJ's Yahoo contact. |
| The wider universe (~96 pages a day) trips Yahoo throttling. | Collector paused. | 15-minute spacing, a 24-hour pause on the first 429, and a held state on a second one. |
| The page shows no league context. | Sightings can't be compared to the user's league. | Show "context unknown"; never adjust a value by guessed context. |
| HTML changes. | Silent mis-parse. | Parse version, drift alarm, captures keep a body hash. |
| Selection bias (only listed players, only recent trades, only public leagues). | Sightings look like a market they are not. | Coverage line and "not a representative sample" on every block. |
| Valuation mistaken for a price. | Users read FHFH's model as market truth. | Separate blocks and labels; method version shown. |
| Lease conflicts in `web/lib/integrations/yahoo/`. | Edits collide with RSO and cron work. | New code in new directories (§5). |

## 5. Ownership and staging

### 5.1 Current holders (as read 2026-11-04)

- **Codex** cron-report assignment (`CODEX-LEASES.json`, `current_codex_assignments[0]`, active): `web/lib/integrations/yahoo/playerWriter.ts`, `writerPermissions.test.ts`, `ingestionLifecycle.ts`, `discovery.test.ts`, and `web/pages/api/v1/db/update-yahoo-players.ts`.
- **Claude** lane `RSO-YAHOO-DIET-P2` (`CLAUDE-LEASES.json`, active): `rosterPlanning.ts`, `planningConfirmations.ts` and their tests, `providerClient.ts`, `starterBoard.ts`, and new identity files under `web/lib/integrations/yahoo/`.
- **Codex** reserved patterns include `web/lib/projections/**` (FORGE) and `web/lib/rosterScheduleOptimizer/**`.
- Player Cards files, including `analysisEvidence.ts`, were handed back and forth between Codex and Claude; the current holder needs checking before P6 edits it.

### 5.2 Proposed file plan

| Phase | New files (no current lease) | Read-only imports | Leased files needed |
| --- | --- | --- | --- |
| P0 | `web/lib/tradeValue/observation.ts`, `dedup.ts`, `coverage.ts`, `valuation.ts`, `plausibility.ts` and tests | `analysisEvidence.ts` types, `market.ts`, `trade.ts` | none |
| P1 | migration(s) under `supabase/migrations/` (capture tables first) | none | none |
| P2 | `web/lib/tradeValue/collector.server.ts`, one cron route under `web/pages/api/v1/db/` (or a `webhooks/` job) | `pollPolicy.ts` style; its own budget | none (the page is not an API resource, so `providerClient.ts` is not needed) |
| P3 | `web/lib/tradeValue/yahooTradeMarketParser.ts` and test, with fixtures cut from stored captures | `yahooIdentity.ts` | none |
| P4 | `vercel.json` cron entry or a `webhooks/` schedule | — | `vercel.json` is shared: TJ approval |
| P5 | `web/lib/tradeValue/valuation.server.ts`, `adp.server.ts` | `verifiedForgeReleases.ts` (Codex-reserved, read-only); existing ADP source tables | none |
| P6 | BLSH trade-view files (current BLSH trade lane owner) | `web/lib/tradeValue/*` | `analysisEvidence.ts` projection: ask its holder |
| P7 | none new beyond a call site | — | `providerClient.ts` gains `transactions;types=trade` and settings: wait for RSO-YAHOO-DIET-P2 release, or ask its owner to add the two resources |

So P0–P3 and P5 need no leased file. P4 touches the shared cron config with approval. P6 needs one small Player Cards edit coordinated with its holder. P7 waits for the RSO lane.

### 5.3 Staging

- Claim exact new paths in `CLAUDE-LEASES.json` before P0 starts.
- One collection lane: P0 → P1 → P2 → P3 → P4, in order. A separate valuation lane can do P5 alongside it, because it touches different files and needs no Trade Market rows.
- P1's migration, P2's canary and P4's schedule are each external actions that need their own TJ approval when the time comes.
- Each phase ends with a local commit on `octoberBranch`; nothing is pushed or deployed without a separate release approval.

## 6. Unknowns that need Yahoo or TJ

**Needs Yahoo's confirmation** (through TJ's existing permission contact; no agent outreach):

TJ confirmed items 1–4 on 11-04 (decision 1). They stay listed because the agreement text has not been inspected.

1. Volume: how many automated `playertrades` reads a day are acceptable, and whether a signed-in session is needed.
2. How long stored trades may be kept.
3. Whether ad-supported public display counts as competing with Trade Hub.
4. Whether the permission is written down anywhere TJ can point to, for the record.
5. The exact attribution wording, logo size and link target.
6. The current text of the Fantasy Sports API terms (the page 404s) and the API Access and Use Agreement.
7. Whether any Fantasy API data, such as completed league transactions, is marked storable indefinitely.
8. A numeric rate limit, if Yahoo will give one, and what triggers 429 or 999.

**Unknown until real pages are seen (P1):**

9. The fields on the Trade Market page: league size, scoring type, roster, keeper format, trade date, picks.
10. Whether a stable trade or league id appears, which decides dedup (§2.4).
11. How many trades a page shows, whether it paginates, and how far back it goes.
12. The empty-page and blocked-page markers.
13. How draft picks render, both on the page and in API trade transactions.

**Unknown in FHFH data:**

14. The share of Yahoo keys for 2026-27 that map to an NHL id through verified identities. Gate 3 needs this measured, read-only, in P1.

## 7. Decisions (TJ answers)

TJ answered each question in a pop-up on 2026-11-04. Answers are quoted verbatim; "Effect" says how this plan applies them.

### D1. Scope of Yahoo's permission

Question: which uses the recorded 10-27 permission covers. Options (multi-select): automated page reads; storage beyond 24 hours; public display on FHFH; all three products.

> Automated page reads (Recommended), Storage beyond 24 hours, Public display on FHFH, All three products

Effect: all four are treated as permitted on TJ's report (§1.3, gate 1). The agreement text is still uninspected (§6).

### D2. How the first real pages are obtained

Options: TJ saves 2–3 pages (recommended); Claude in Chrome reads up to 3; one server canary.

> Scrape and upsert to supabase

Effect: there is no manual-capture stage. Capture storage (P1) comes before the collector canary (P2, at most 3 pages). The parser (P3) is built against the stored bodies. A sign-in page, challenge or 429 stops the run, and a session cookie needs separate approval (§1.4, §4.1).

### D3. Collection universe and cadence

Options: BLSH-listed players daily (recommended); on demand per view; wider daily universe.

> Wider daily universe

Effect: about 700 NHL-rostered skaters and goalies, BLSH-listed players first, one page every 15 minutes, at most 96 a day, so a full cycle takes about a week (§4.2).

### D4. The pipeline's first valuation

Options: value over replacement (recommended); raw projected points; defer valuations.

> A combination of Value over replacement, and Raw Season-to-Date totals. Use ADP as a consideration in some capacity so we aren't offering waiver wire garbage for Connor McDavid.
> Qualified FORGE horizon production under the league's scoring, minus a replacement level set by that league's team count and roster slots. Unavailable when FORGE or scoring is missing.
> Raw actual points and projected points
> Qualified FORGE horizon totals under league scoring, with no replacement adjustment (what compareTrade does now). Simpler, but it ignores league size and positions.

Follow-up question: how ADP should stop implausible ideas, given decision 6 says ADP is not a price. Options: plausibility guard only (recommended); weighted value input.

> Weighted value input with a Plausibility Guard. Don't suggest trades who flag the plausibility guard, but if draft day value is contradicted by current total value and current rank, then it can enter the suggestions. I.E. if someone was valued highly on draft day, winds up being a flop in the first couple weeks, a "Buy Low" scenario should be allowed.
> ADP becomes one weighted part of the player value, next to VOR and season-to-date totals. This amends decision 6's 'not a price' rule, and the weight needs its own testing.

Effect: the value has four components: VOR, season-to-date actuals and rank, raw projected points, and weighted ADP (§3.1a). The plausibility guard filters suggestions and yields to a labelled buy-low scenario when current value and rank contradict ADP (§3.1b). **This amends decision 6 for ADP only.** Ownership stays context only. The weights and guard thresholds are provisional until they are tested (P5).

### Defaults this plan set without a pop-up

- Own-league trades through the official API are P7, shown only to that league's managers.
- Manager-entered offers are private to the manager who entered them (§3.4).
- BLSH is the first consumer (§3.3).
