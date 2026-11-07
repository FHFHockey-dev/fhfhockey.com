# PP3 bucket audit: Rankings and cron writers (2026-10-26)

Read-only. Working tree on `octoberBranch` (HEAD `0d173aed7`). No source edits, production reads or git mutations. `web/lib/socialShare` and `web/components/SocialShare` are excluded because TT-4 already fixed them.

## Bottom line

- **There is a single origin.** Every Rankings PP3 comes from `normalizePpDeploymentBucket` in [skaterDeploymentAggregation.ts:140-149](../../../web/lib/rankings/skaterDeploymentAggregation.ts). It clamps any `pp_unit >= 3` to `"PP3"`. The other files only list `"PP3"` as an allowed enum value or a section bucket.
- **No rating or WAR math weights PP3.** Composites (MCM, BEAST and the others) and entity-metric rankings use the deployment value only as a row filter and a peer-group key. `war.ts` is a `source_pending` stub that parses the query param and nothing more.
- **Stored values.** Rows tagged PP3 exist only if someone ran a writer with `deployment=PP3`: `deployment_bucket` in `skater_composite_ratings` or `entity_metric_rankings`. Neither route is a scheduled cron (README:300; neither appears in `vercel.json`). **I did not check whether such rows exist.** That needs a DB read, which was out of scope. No recompute is needed for the change itself.
- **Smallest fix.** Change the clamp so that `unit >= 3` returns `null` (no PP unit). Then drop `"PP3"` from the enum, option and section lists below. Two side effects need a decision (see [Behaviour notes](#behaviour-notes)).

## Per-file findings

| File | What PP3 does | User-visible effect today | Smallest change |
|---|---|---|---|
| `lib/rankings/skaterDeploymentAggregation.ts:19, 140-149, 250` | **Source.** The `SpecialTeamsDeploymentBucket` type includes PP3. The normalizer maps `pp_unit >= 3` to PP3. Per-game PP3s feed the `mostCommon` PP mode. | Players with incidental PP time are labelled "PP3". | Return `null` when `unit >= 3`; only 1 and 2 map to PP1 and PP2. Remove `"PP3"` from the type. |
| `lib/rankings/deploymentTiers.ts:45, 245-251` (and 592, 699) | **Section bucket and peer pool.** The "Power Play Units" section has a PP3 tier, described as "PP1-PP3 buckets". Players in PP3 also count among the candidates in `buildContextualRankingRows` (line 720), so they are in the percentile peer pool for PP1 and PP2. | The Deployment Tiers page shows a third "PP3" card. | Set `buckets: ["PP1","PP2"]`, change the description to "PP1-PP2" and remove PP3 from the key type. Once the normalizer returns null, line 699 already skips those rows. |
| `lib/rankings/rankingQueries.ts:117-132, 507-553, 610` | **Filter and tag (indirect).** It uses the normalizer for `passesDeploymentFilter`, `selectedDeploymentBucket` (the peer-group key), `deployment.pp` and `tags`. | Rows get a "PP3" tag, the Comparison panel's "PP PP3" and the `formatDeploymentLabel` "L3 / PP3". | None. This is fixed automatically by the normalizer change. |
| `lib/rankings/availableFilters.ts:132` | **Filter option** in `DEPLOYMENT_OPTIONS`. | The filter-metadata API advertises PP3. | Delete the line. |
| `lib/rankings/rankingMetadata.ts:37` | **Enum list** in the contextual-rankings metadata `deployments`. | The metadata endpoint lists PP3. | Delete `"PP3"`. |
| `lib/rankings/rankingUrlState.ts:137` | **URL state.** `DEPLOYMENT_OPTIONS` falls back to `"all"` for unknown values (line 284). | `?deployment=PP3` is a valid page state. | Delete `"PP3"`. Old links then quietly fall back to "All Deployments". |
| `lib/rankings/rankingTypes.ts:342` | **API request parser.** `parseEnumParam` **throws a 400** on unknown values (line 226). | `/api/v1/contextual-rankings?deployment=PP3` filters to PP3. | Delete `"PP3"`. Old API URLs with PP3 then get a 400 (see note 3). |
| `lib/rankings/playerMatrix.ts:456` | **Matrix request parser.** `parseEnum` also **throws** (line 352). Line 420 echoes the label as "PP3 deployment". | The matrix can be filtered to PP3. | Delete `"PP3"`. The same 400 caveat applies. |
| `lib/rankings/splits.ts:185` | **Comparison set.** PP splits compare all, PP1, PP2 and PP3. | Splits show a PP3 comparison column/card. | `["all","PP1","PP2"]`. |
| `lib/rankings/war.ts:105` | **Query parse only.** This is a `source_pending` stub and has no weight. Unknown values fall back to `"all"`. | None beyond echoing the request. | Delete the `raw === "PP3"` line. |
| `components/Rankings/RankingsFilters.tsx:103` | **UI filter option** in the deployment dropdown. | Users can pick "PP3". | Remove `"PP3"`. |
| `components/Rankings/PlayerMatrixTable.tsx:268` | **UI badge suppression.** The badge already hides PP3. | No PP3 badge appears. However, `aria-label` (via `formatDeploymentLabel`) still reads "… / PP3". | Revert to `deployment.pp ? … : null` once the normalizer returns null. That also fixes the aria-label. |
| `pages/api/v1/db/update-skater-composite-ratings.ts:100` | **Writer request enum.** `readEnum` falls back to `"all"`. The value is stored as `deployment_bucket` (skaterCompositeWriter.ts:506) and used as the peer-group key (line 188). | None in the UI. A `deployment=PP3` publish would store PP3-keyed composite rows. | Delete `"PP3"`. After removal, a PP3 request silently becomes `"all"`, so it must be run with `dryRun=true` (the default). |
| `pages/api/v1/db/update-entity-metric-rankings.ts:168` | **Writer request enum.** It uses the same `readEnum` fallback and stores `deployment_bucket` per row (entityMetricRankingWriter.ts:183). | Same as above. | Delete `"PP3"`. |

These are outside the brief's list but in the same family:

- `web/scripts/check-rankings-deployment-tiers-performance.ts:34` expects `["PP1","PP2","PP3"]` in the `power_play` section. Change it to PP1 and PP2, or the script fails after the fix.
- `lib/rankings/rankingFormatters.ts:42` and `components/Rankings/ComparisonSummaryPanel.tsx:38` only print `deployment.pp`. The normalizer change fixes them.
- `lib/rankings/teamMatrix.ts` `pp1_pp2_usage_share` and the trending `team_pp_unit_concentration_change` already use the two-unit model. No change is needed.
- The writer [update-power-play-combinations/[gameId].ts:129-132](../../../web/pages/api/v1/db/update-power-play-combinations/[gameId].ts) still stores `unit = 3`. I recommend keeping it, because it records incidental PP time and readers treat it as off PP. Changing it would need a backfill.

## Behaviour notes

1. **The mode can flip.** Today a player with 6 unit-3 games and 4 PP2 games has a PP mode of PP3. With unit 3 as null, the mode becomes **PP2** on only 4 of 10 games. Option: count unit 3 as a "none" vote in `mostCommon`, so a mostly-incidental player gets no PP unit. TT-4's social lane faced the same question.
2. **The peer pool shrinks.** In deployment-tiers, PP3 players currently count in the PP1 and PP2 percentile pool. Removing them changes the PP1 and PP2 percentiles on that page. This happens on live reads only; nothing is stored.
3. **Old URLs return 400.** Removing `"PP3"` from the throwing parsers (`rankingTypes`, `playerMatrix`) turns old `?deployment=PP3` API links into 400s. If that matters, map `PP3` to `"all"` before validating. The page URL state already falls back.
4. **No tests cover PP3.** No Rankings test mentions PP3 or `pp_unit: 3`. Add one regression case to `skaterDeploymentAggregation.test.ts` (unit 3 → null, plus the mode case) and one to `deploymentTiers.test.ts` (two PP buckets).

## Recompute and stored-data flags (ask-first, not done)

- The code change needs **no recompute**: no stored rating weights PP3.
- **Possible stale rows:** any `skater_composite_ratings` or `entity_metric_rankings` rows with `deployment_bucket = 'PP3'` from a past PP3-filtered run. After the fix, nothing reads them, because the filter value disappears. A bounded read-only count would settle whether they exist. Cleanup would be a separate, approved, scoped delete.
- `rolling_player_game_metrics.pp_unit = 3` stays as is. It is source data and correct as incidental time.
