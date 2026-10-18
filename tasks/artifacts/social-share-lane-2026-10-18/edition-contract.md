# Social edition source and clock contract — S-15, 2026-10-18

Applies to the installed schedule-only package (`web/lib/socialShare/*`, `web/components/SocialShare/*`, the `/social-share/[format]` page and API). This describes current code and the rules any new weekday edition must meet. Nothing here authorizes posting.

## 1. Clocks every edition carries

| Field | Meaning | Where it comes from today | Rule |
| --- | --- | --- | --- |
| `source.name` | Upstream provider | Constant `"NHL schedule"` | Must name the actual upstream; never a market or "consensus" label. |
| `source.updatedAt` | Provider's own update time | **Unknown.** `api-web.nhle.com/v1/schedule/{date}` returns no update timestamp; always `null` | Stays `null` = unknown. Never filled from FHFH retrieval or request time. |
| `source.fetchedAt` | When FHFH read the source ("NHL schedule checked") | `getSchedule().retrievedAt`, set after the upstream response resolves (`web/lib/NHL/server/index.ts:477`) | A retrieval/check time only. Missing, invalid or future value → edition `missing`. |
| `generatedAt` | Frozen "remaining after" instant | Server time when the API built the snapshot | Opportunities count only games whose verified start is strictly after this. Changing day selection reuses it; refresh makes a new edition. |
| Forecast issuance | Original issuance time of any projection | **Not applicable**: schedule-only, no projections | Any future projected edition must carry the forecast's original issuance time and horizon, not a re-render time. |
| `expiresAt` | Last instant the edition may be exported | min(fetchedAt + 6 h, next counted puck drop, the start − 6 h boundary into the stricter window); 15 min after the read once a counted game is within 6 h | Exact equality is expired. The client re-checks before, during and after PNG creation. |
| `id` | Content fingerprint | FNV-1a over format, week, generatedAt, source, games and selection | A re-render at a later clock is a new id, never a renewal (harness check `rerenderIsNewEditionNotRenewal`). |

Time zone: `America/New_York` for calendar dates, Monday week boundaries and labels (DST- and year-boundary tested). A game's date is its source ET `gameDate`; a 22:30 ET game stays on its ET day even though its UTC start is the next day (harness check `lateWednesdayGameStaysWednesday`).

## 2. Qualification states

`ready` → exportable. `partial` (coverage, count, identity or game-state gaps), `stale` (past freshness), `missing` (no valid provenance) and `blocked` (format needs evidence this package does not have) all render as **UNRANKED / PREVIEW ONLY · REFRESH / CHECK SOURCE**, with the Download button disabled. Missing evidence suppresses rankings and scores; it is never treated as zero.

Expired captured editions: the October 8 real-source editions expired at 2026-10-08 17:00 UTC, and their files were in `/tmp` folders that no longer exist. They must not be re-rendered under a new clock. A fresh edition needs a fresh read under an approved retrieval, which this lane did not do.

## 3. Per-edition contract (installed formats)

| Edition | Default dates | Counts | Source | Provider update | Retrieval | Forecast | Horizon | Expiry |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Weekly schedule (`game-grid`, Monday default) | Mon–Sun | Scheduled regular-season games with verified start after `generatedAt` | NHL schedule (team/day indexed reader) | unknown | `retrievedAt` | none | through Sunday 23:59 ET | rule above |
| Remaining week (`remaining-week`, Wednesday default) | Thu–Sun | Same; Mon–Wed elapsed or deselected games remain context only | same | unknown | same | none | through Sunday | rule above |

Scores use the site's `calcWeekScore` with empty odds and the full daily slate for off-night density (≤ 8 league games), the same definition Game Grid uses. Raw odds, `winOdds` and private reader fields are never published (unit-tested).

## 4. Weekday goal versus what can qualify now

The handoff's goal is one default image per weekday. Only schedule observations qualify today. Each other edition needs the inputs below before it can leave `blocked`. These are requirements, not designs; the five earlier mock variants were synthetic design work, not current recommendations, and they are not retained in this tree.

| Day / edition | Kind of claim | Required qualified inputs (none present in this package) | Status |
| --- | --- | --- | --- |
| Mon: schedule rankings | Observed schedule | NHL schedule edition as above | **Qualifies** (`game-grid`), subject to rights |
| Mon: low-ownership pickups / category specialists | Ownership observation + projected recommendation | Dated ownership observations naming their provider and capture time; qualified FORGE/projection output with issuance time and horizon; league scoring/category context | Blocked |
| Tue: hot/cold trends | Observed stats | Current-season player game logs with source, capture time and completeness | Blocked (`tuesday-trends`) |
| Tue: ownership / transactions / deployment | Ownership observation + observed deployment | Dated ownership/transaction feed; lines/deployment source with capture time | Blocked |
| Wed: rest-of-week advice | Observed schedule (+ optional projection) | Schedule edition with elapsed games excluded; projections only if qualified | **Schedule part qualifies** (`remaining-week`) |
| Thu–Sun: WiGO, category rescue | Observed stats + projected recommendation | Player rates, participation, qualified forecasts, league categories | Blocked (`category-rescue`, `player-spotlight`) |

Separation rules for any future edition: observed stats, ownership observations and projected recommendations are separate fields with separate source/clock blocks. Don't infer the ownership provider or describe single-provider ownership as market consensus. A recommendation needs coherent qualified inputs and league/scoring context. Otherwise the claim is withheld.
