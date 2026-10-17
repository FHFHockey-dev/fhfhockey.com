# B2: schedule-coverage refresh proposal (for TJ; nothing has been run)

Proposal only. No writer, refresh, hosted read or production request was made to prepare it. Each run below needs its own approval, and none may run on 2026-10-20 between 07:00 and 13:00 ET.

## What the readers require

The slice readers (`planningInputs.ts`, `canonicalSchedule.ts`) call a horizon complete only when every date in `[startDate−1, endDate+1]` is one of:
- a game day whose rows all carry the same `source_metadata.scheduleCoverage` witness (`nhl-source-days-v1`), share one `fetched_at` no more than **36 h** old, and pair up exactly (2 sides per listed game);
- a date listed in some witness's `emptyDates`.

All three serving surfaces send a time zone, so the ±1-day padding always applies.

Only bounded mode (`fetchBoundedNhlSchedule`) stamps the witness.
- **Correction to REVIEW.md B2:** full mode (`fetchFullSeasonNhlSchedule`) writes no witness. A full-mode run therefore overwrites existing witnesses with metadata that lacks them.
- A run of the route at production bytes also strips them, in either mode.

## Proposed run (after A1 only)

**Route:** `POST /api/v1/db/update-roster-optimizer-schedule` at slice bytes, behind its existing `withOperationalRouteAuth`. It can only run after A1: before the release, production bytes would erase witnesses, not write them.

**Window** (corrected 2026-10-17 after `REVIEW-ADDENDUM.md` P1):
- Let D be the served ET date, and P the start of the RSO period containing D. P is the Yahoo matchup period start, or the Monday of the Mon–Sun week when no provider period applies (`currentPlanningRange`).
- The RSO page reads from P, and past days count: every date from P−1 needs a fresh witness.
- So use `startDate = W = min(D−1, P−1)`, which is D−7 at most for a Mon–Sun week (longer first or All-Star periods reach further back), and `endDate = W+44`. That is 45 days, the bounded maximum.

It covers:

| Surface | Needs | Covered |
|---|---|---|
| Start Chart native (`calendar`, 1 date) | D−1 … D+1 | yes |
| RSO default view (current period) | P−1 … period end+1 | yes |
| FORGE next-20 (request from D) | D−1 … endDate+1 | only if the request's `endDate` ≤ W+43 (D+36 when D is a Sunday) |

RELEASE-PLAN A3 #1 currently asks for `endDate=<today+59>`. Either cap it at W+43, or approve a second guarded window `[W+45, D+60]` with the same steps; it also needs ≤24 h cadence, so the daily cost doubles. The A3 readback should also include one RSO read starting at P: a `startDate=<today>` read would not reveal a stale period start.

**Steps** (concurrency 1; stop at the first non-200; no automatic retry):

1. **Inspect, no writes.** Send `mode=bounded&gameKey=477&startDate=W&endDate=W+44&seasonId=20262027&gameIds=<exact list>&maxSides=<2×games, ≤1000>&dryRun=true`.
   - This bypasses the audit insert and returns `scopeHash`, `sides` and `nonCountableGameIds`.
   - `gameIds` must be the exact regular-season IDs in the window. Take them from a read-only query of `roster_optimizer_team_games`, or from the public NHL schedule.
   - A missing or extra ID fails closed with `REFRESH_SCOPE_MISMATCH`.
2. **Write.** Send the same query with `dryRun=false&expectedScopeHash=<scopeHash from step 1>`. If the NHL source changed in between, the guard refuses with `REFRESH_SOURCE_CHANGED`. Then go back to step 1.
   - Run both steps outside game hours, after D−1's games are final and before D's first puck drop: the scope hash covers game status, start time and `source_updated_at`.

**Bounds and cost of one window:**

| | Inspect | Write |
|---|---|---|
| Production requests | 1 POST | 1 POST |
| NHL API reads (`api-web.nhle.com/v1/schedule/{date}`, one per 7-day cursor) | 7 | 7 |
| DB reads | Yahoo weeks for key 477; seasons; `team_season`/`teams`; existing rows for key 477/season 2026 (about 2,600, read-only) | same |
| `roster_optimizer_team_games` | none | upsert of about 300 games × 2 ≈ 600 sides (hard cap `maxSides` ≤ 1000), on `(game_key, source_game_id, team_id)`; no deletes in bounded mode |
| `cron_job_audit` | none | 1 row (`update-roster-optimizer-schedule`) |
| Builds or deployments | none | none |

**What each written row gets:**
- `fetched_at = now`
- refreshed source columns: times, status, mapping, countability
- `source_metadata = { scheduleCoverage: { version, date, gameIds, emptyDates }, canonicalDateSource, mappingReason, venue, venueUTCOffset, easternUTCOffset, syncMode: "bounded" }`

## Cadence

The reader stops accepting a witness 36 h after its `fetched_at`.
- A single run serves only the next ~36 h.
- Serving horizons every day needs this run at **≤24 h** cadence, which leaves a 12 h margin.

Choosing that schedule is TJ's decision. The octoberBranch `refresh-roster-optimizer-schedule` route is a recurring design, but it is not in this slice and depends on a `roster_schedule_observation_clock` RPC.

## Checks before approving

- **No witness-stripping writer.** Nothing may write these rows in full mode, or at production bytes, within the 36 h before a served read. `cronInventory.ts` maps a job alias to this route. Whether a hosted pg_cron job calls it, and in which mode, is unverified: checking takes one read-only `cron.job` query, which is a separate approval.
- **Exactly one game key.** The reader does not filter by `game_key`. Hosted must hold only key-477 rows for season 20262027 in the window; otherwise sides ≠ 2 × games and the day stays partial.
- **Few empty dates.** The reader rejects a witness listing more than 31 `emptyDates`. A 45-day in-season window from late October has few off days, and the Dec 24–26 break lies outside D+43 for D = Oct 20.
- **No unmapped dates.** Every date must fall inside a Yahoo matchup week for key 477; otherwise the guard rejects unmapped games.

## Do production readers tolerate rows that carry the witness?

**Yes.** At production bytes (`457435eb`):

| Reader | Behaviour |
|---|---|
| `lib/rosterScheduleData/query.ts`, used by the public `GET /api/v1/roster-schedule-optimizer/schedule` (`s-maxage=300`) | Selects `source_metadata` as untyped `Record<string, unknown>` and passes it through without parsing. Responses grow by about 100–300 B per refreshed row; the witness holds only public NHL game IDs and dates |
| `planningInputs.ts`, `issuedContext.ts`, `scopeReads.ts`, draft-pro `dust.ts`/`scenariosServer.ts`, `cron-report.ts`, `persistence.ts` | Do not select `source_metadata` |
| Schedule fingerprint (`forgeScheduleRevision`) | Hashes ID, start, teams and status only. The witness never enters a schedule revision. `fetched_at` changes, as on any refresh |
| Production writer | Ignores the witness and overwrites it (see above) |

## Monday 2026-10-20

Expect `incomplete_refresh` in the local readback unless hosted rows are refreshed first by the octoberBranch writer. Running that writer locally against hosted is a hosted write, a separate approval with the same bounds. It is not proposed here.
