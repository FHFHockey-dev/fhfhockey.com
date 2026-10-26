# RECEIPT: import the league rules Yahoo reports (lane RSO-YAHOO-DIET-P2)

TJ's production Data health read: "Yahoo does not report these league rules: when an add takes effect; waiver mode and FAAB budget; the exact weekly add reset time; how the goalie minimum counts and its penalty." This ticket imports every rule Yahoo reports, verified, and keeps the manager confirmation, by name, for the rest.

Uncommitted on top of f98312c9b. It also contains the earlier bridge-proofs edits in `rosterPlanning.ts` and `provider.ts` (RECEIPT-P2-BRIDGE-PROOFS.md).
- No Yahoo, provider or production reads; no git mutations; no GIT_DIR.
- Not behind `RSO_YAHOO_DIET`: this is rule import, not read reduction, and it adds no Yahoo read.

## Step 1: what recorded evidence shows (receipts and fixtures only, no new reads)

| Field | Where Yahoo puts it | Recorded evidence in the repo | Verdict |
|---|---|---|---|
| `min_games_played` | league settings (separate block) | R1 2026-10-26 recorded "goalie minimum required 3" (WINDOW-RESULTS-2026-10-26.md); `liveDraft.test.ts:74` | **reported**, already imported |
| `max_weekly_adds`, team `roster_adds` | settings; team | parser and tests (`yahooPlanningAcquisitions`); R1 didn't capture the counter | reported, already imported (counter) |
| `weekly_deadline`, `roster_type` | settings | parsed (`parseYahooBoardSettings`, discovery's league `roster_settings`); synthetic fixtures only | reported. Drives D6's *inferred* add timing (flag on) |
| `uses_faab`, `waiver_type`, `waiver_rule`, `waiver_time` | settings (documented Yahoo league settings fields) | **no recorded payload in the repo** | parsed strictly; confirm in window 2b |
| `faab_balance` | team metadata (documented; present when FAAB is on) | **no recorded payload** | parsed strictly, from the owned team only |
| `edit_key` | league resource | none | the next **lineup** edit date, not when an add takes effect; not imported |
| When an FA add takes effect | — | Yahoo has no field for it | **not reported**: manager confirms (D6 inference, labelled, flag on) |
| Exact weekly add reset instant | — | no field | **not reported** |
| Goalie minimum counting (starts or appearances) and its penalty | — | `min_games_played` is only a number | **not reported** |

Recommendation for the orchestrator: in window 2b step A1, record as booleans whether `uses_faab`, `waiver_type`, `waiver_rule`, `waiver_time` and `faab_balance` are present. The new Data health evidence entry shows each one as "reported / verified / not reported", so this needs no extra reads.

## Step 2: import (`yahooPlanningReportedRules` in `rosterPlanning.ts`)

- **Pattern:** each rule is `{ rule, field, present, reportedValue, verified }`, like the weekly add limit's present / reportedValue / verified.
- **What "verified" needs:** settings fresh at their read time (D3 cache-aware); for team facts, also a fresh team read whose `team_key` matches and is owned by the current login; and an exact, recognised value.
- **`uses_faab`:** `1` / `true` sets `rules.waivers = { mode: "budget" }`; `0` / `false` sets `"priority"`, with `remainingBudget` always null. Anything else, including absent, empty, `null` or `"yes"`, leaves `rules.waivers` unset, as before.
- **`faab_balance`:** sets `remainingBudget` only in a verified FAAB league, from the fresh owned team, and only as an integer from 0 to 100,000. Stale, not owned, another team, absent, negative or non-numeric values leave it null (unknown).
- **Context facts:**
  - `waiver_time`: verified as an integer from 0 to 30 days.
  - `weekly_deadline`: verified only for `intraday` or `tomorrow`.
  - `min_games_played`: verified as an integer.
  - `waiver_type` and `waiver_rule`: shown as reported but **not interpreted**, since their codes aren't confirmed.
- **Snapshot evidence** `yahooLeagueRules` (asOf = settings read time): one line per fact, for example `waiver mode (uses_faab): reported "1", verified` or `… not reported`. It's `complete` once the waiver mode, plus the budget in a FAAB league, is verified.
- **Manager overrides:** the existing `providerRules` precedence still applies. A verified provider value wins and the manager fills gaps.

## Step 3: Data health text

`Yahoo does not report these league rules; confirm them in League rules: …` now lists only what is still unknown:
- **Add timing:** "when an add takes effect (same-day or next-day)", or with the flag on, "whether the add timing inferred from Yahoo's weekly deadline is right".
- **Waivers:** "waiver mode and FAAB budget" only when the mode isn't verified; "the remaining FAAB budget" in a FAAB league without a verified balance; nothing when the mode, and in a FAAB league the budget, are verified.
- **Unchanged:** "the exact weekly add reset time …" when periods are known, and the goalie minimum items.

## Files (uncommitted)

| File | sha256 at HEAD | sha256 now |
|---|---|---|
| `web/lib/integrations/yahoo/rosterPlanning.ts` | `5f778924ed4d3f0cd16a95169f0c1999b2c6f949ee1d1d3ff08b5b16b1d67c65` | `ce57e852c4da356696a3a2cdb45013bc063474a5792255cd373148a40973d52a` |
| `web/lib/integrations/yahoo/rosterPlanning.test.ts` | `32deab9f0c1757623ad06db2ed348eb9a6fb1613cdec1bca4d2463da5de35410` | `8efff00de3d47e317a2bc5e337a43c2da4411df892fcc92e466cfbc4b1f17cb1` |
| `web/lib/integrations/yahoo/yahooDiet.test.ts` | `1a646c24c4ab4a25e0f74fc131f55b0bafbb7da563585f6158751b5bb780c451` | `e35d32e0dead56c60d6116a3d90015bc50a1fd571973fa0b2e8663bc5afbc7db` |
| `web/pages/api/v1/roster-schedule-optimizer/provider.ts` | `b4bcb961b9ae1f8bd27383b1f3bdf6f155b89ee643bd69f1c10fa02bfc5602b2` | `dacfff009388e1f0003ddaa3b6d68f212868318c4a77f5627cdd70529c334875` |

`provider.ts` changed only for the earlier bridge-proofs ticket; it's listed so the uncommitted set is complete.

## Tests

| Check | Result |
|---|---|
| `rosterPlanning.test.ts` (new: FAAB with verified budget; priority, never a budget; 7 ways the budget stays unknown; 4 ways the mode stays unknown; stale settings verify nothing; unrecognised waiver period or deadline) + `yahooDiet.test.ts` (snapshot rules, evidence lines and Data health text for FAAB, priority, FAAB without balance, and absent, with the flag on and off), `TZ=UTC` and `TZ=America/New_York` | passed: 123/123 in each |
| `lib/integrations`, `dailyAcceptance.yahoo`, `providerRules`, RSO API routes, RSO component test (49 files), UTC and NY | passed: 819 passed, 3 skipped in each |
| Whole-project tsc under `/private/tmp/fhfh-heavy.lock` (noclobber, released), 8 GB heap | passed, exit 0. A first run found a typing error in my new `it.each`, which is fixed, and one in another lane's `planningReproducibility.test.ts`, which has since cleared. |
| ESLint on the changed files | clean |
