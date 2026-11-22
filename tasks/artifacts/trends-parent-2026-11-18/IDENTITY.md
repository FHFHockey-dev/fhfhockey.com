# Homepage Transaction Trends identity coverage · November 18, 2026

The newest comparable retained census is the November 10 in-season homepage ownership request. The November 12 exact-key repair and the November 18 Yahoo refresh measure different populations. Current default-page identity coverage, current-season coverage, and the causes of remaining gaps have no comparable retained measurement. There is no new exact repair candidate.

## Dated evidence

**November 18 census attempt.** At 16:40 UTC, after TJ cleared the Yahoo writer, the approved client could not resolve the direct database hostname. It opened zero connections and sent zero SQL statements. No population was observed and there was no retry. [Attempt receipt](PRODUCTION-CENSUS.json).

| Observation | Source rows and identities | Movement and page coverage |
| --- | --- | --- |
| November 10, 20:25:59 UTC, production, `window=3&metric=ownership&limit=10&offset=0`, no season or position | **4,438 fetched source rows**, 2,373 mapped and 2,065 unmapped. Each mapped row had an accepted full seasonal key. The source primary key guarantees one row per stored key at one database snapshot. The receipt contains only counts across paged reads, so it cannot directly establish distinct fetched keys, syntactically valid seasonal keys or distinct NHL players. | Source date November 10, **89 risers and 200 fallers**, with **10 + 10** returned. The receipt measured the wrong field for returned identity, so the returned rows' mapping status and what users actually saw were unmeasured. |
| November 12, 17:55 UTC investigation and 19:42 UTC postcheck, exact keys only | The three older keys below had verified external and canonical links but missing source and external season metadata. After the authorized six-row repair, all three returned exactly one admitted mapping. The separately observed current-season `477.p.*` counterparts already had verified links and 2026 season metadata. | No movement counts or page read either time. |
| November 18, Master Task List seq 257, current Yahoo feed | **1,612 profiles**, **583 ownership observations**, **1,029 values unavailable**. These are refresh outcomes. They supply neither the normalized-history source totals nor exact-key identity or page coverage. | The refresh does not establish that any specific key has two comparable points or a nonzero delta. |

Evidence is in the [November 10 smoke receipt](../trends-production-release-2026-11-10/PRODUCTION-SMOKE.json), [mapping inventory and indexed-plan capture](../homepage-cold-2026-11-10/read-only-evidence.json), [November 12 investigation](../transaction-trends-unmapped-2026-11-12/REPAIR-EVIDENCE.json), and [November 12 production receipt](../transaction-trends-unmapped-2026-11-12/PRODUCTION-RECEIPT.md). The November 10 mapping inventory of 2,373 seasonal keys and the smoke request were separate observations. All 40 distinct keys in the November 12 first-40 sample had game prefix 453 and a null source season. Its derived-context join leaves their external status unproven except for the three checked independently. Selection was lexicographic and preceded the repair. The November 18 local `/private/tmp/fhfh-trending-live-*` receipts cover contextual Rankings. The November 10 homepage loading receipts add timings and the same 89/200 movement totals.

| Confirmed November 12 historical key | Player | Accepted NHL ID after the repair |
| --- | --- | ---: |
| `453.p.30000` | Nikita Nesterenko | 8481754 |
| `453.p.30024` | Frank Nazar | 8483493 |
| `453.p.30111` | Devon Levi | 8482221 |

The older catalogue entry is NHL season 2024. The current 2026–27 catalogue entry is game key 477, source year 2026, and canonical season ID 20262027. There is no observed membership of the three old keys in the November 10 unmapped aggregate or November 18 default page. The November 10 2,065 has no complete cause breakdown. The existing repair receipt closes the three exact keys.

## Writer, admission, and display

- The [Yahoo player writer](../../../web/pages/api/v1/db/update-yahoo-players.ts) resolves the live NHL game or an explicit override, persists the game and key snapshots, and uses the returned season on the exact seasonal key. The [atomic RPC](../../../supabase/migrations/20261104011912_clear_stale_yahoo_player_status.sql) upserts on `player_key` and writes a daily ownership point only for an observed numeric value. Missing ownership preserves the previous stored value and has no new normalized point. An explicit zero is a value. Profile completeness, current points, normalized-history eligibility, and identity admission each measure a different outcome.
- The [normalized reader view](../../../supabase/migrations/20260725235646_add_normalized_yahoo_ownership_reader.sql) projects every stored Yahoo player row and attaches non-null history by exact `player_key`. The [Trends API](../../../web/pages/api/v1/transactions/ownership-trends.ts) counts identity across all fetched rows. `season=2026` filters the stored source year and an empty requested season sets an explicit fallback flag and uses the no-season population. A 477 prefix helps spot metadata gaps separately from `season=2026`. Repeated NHL player IDs across distinct seasons are valid.
- The [canonical reader](../../../supabase/migrations/20260824152127_yahoo_live_draft_production_hardening.sql#L583) requires a full seasonal Yahoo key, verified external and canonical records, a non-null external season, a context matching `yahoo:game:%:season:%`, a non-null NHL ID and no conflicting verified canonical targets in the same provider/key/context/season. The map view joins on the exact key and legacy rows only decorate admitted mappings. The API additionally rejects malformed keys and non-positive or unsafe NHL IDs. Multiple different valid NHL IDs on the exact key remove the entry. A source year mismatch and the reader's external-season gate are different checks.
- The [in-season homepage component](../../../web/components/TransactionTrends/TransactionTrends.tsx) requests ownership with a three-day window, no season or position, offset zero and ten rows per direction. It displays both directions on desktop and initially displays risers on mobile, with fallers behind its direction toggle. Mapped rows link through `playerId`, while rows with null identity still render as plain text if their movement qualifies. So a default-page gap can be observed simply by reading the page's actual response rows. A DB-derived page measures eligibility for display at a specified snapshot, with real browser visibility evidenced separately.

## Cause and manager impact

| Cause | What the retained production evidence supports |
| --- | --- |
| Exact-key metadata error | Three confirmed historical keys with corrected season/context and successful readback. Default or current mover impact was unmeasured. |
| Missing verified link | A possible exclusion in the deployed reader. No current visible key with a confirmed missing link is established. |
| Conflicting links | Fail-closed behavior is proven locally. The separate production snapshots API returned an ambiguous NHL ID, which cannot identify a member of the default Trends page. |
| Malformed key | The reader rejects it for mapping. The count of malformed source keys in the dated aggregate is unknown. |
| Legitimate Yahoo-only entry | The UI accepts an eligible Yahoo mover without an NHL ID. A null map result alone cannot establish why a particular Yahoo player lacks an NHL link. |
| Insufficient evidence | The current proportions and specific default-page causes require the dated read below. A source row may have no comparable history or flat movement despite having a verified identity. |

The [local end-to-end trace](LOCAL-IDENTITY-TRACE.json) uses fictional keys and IDs, the candidate API, and the same seeded data as the Chromium replay. In the default fixture, 5 of 10 displayed risers and 5 of 10 fallers were unresolved. In its explicit current season, 1,125 of 2,420 source rows were unresolved, including 39 of 89 eligible risers and 89 of 200 eligible fallers. These fixture counts describe the controls only.

| Synthetic default riser | Yahoo source to rendered row |
| --- | --- |
| Rank 1, `480.p.20008` | The exact current key maps to 8420008. The row links to that profile. |
| Rank 4, `480.p.20035` | No mapping in either fixture season. The named Yahoo listing and supported team, position and ownership remain visible. |
| Rank 3, `480.p.20026` | Only historical `453.p.20026` maps to 8420026. The current row has a null NHL ID and no profile link. Selecting 8420026 alongside 8420008 for season 2026 admits only the established current match. |

Each traced row moved from 41% on November 15 to 50% on November 17, a gain of nine percentage points. November 18 is the request date. The rendered target is three days, and the two-day observation span is disclosed. The real browser assertions checked the ordered rows against the API and their links, values, dates and ranks.

## Bounded completion options

**Default page first.** Reuse a retained current response body from the exact homepage request and record capture time, `sourceDate`, requested and fallback season fields, totals, each direction's returned keys and null `playerId` count. If no body exists and release scope needs this observation, request explicit approval for one sequential read of the existing exact URL after evidence of a suitable warm cache entry. Stop after one response, including on error, miss, stale data, or an unexpected response. A time-stamped payload establishes page identities and the no-season aggregate. It lacks the current-season census and unmapped causes. When a warm response cannot be established without issuing the request, prefer the separately approved bounded database option and avoid a cold public request.

**Default and current-season census.** Request explicit approval for one read-only session against the existing production database project `fyhftlxokyjtpndbkfse`, after confirming operator and writer handoff and matching the deployed API role. Use an approved read-only connection path. One repeatable-read transaction, concurrency one, 3-second statement timeout, 1-second lock timeout and 5-second idle-in-transaction timeout. Stop on activity/schema drift, season mismatch, cap breach, timeout or an incomplete result. No retry, provider request, application request, writer invocation, or schema change. The result contains at most 6,000 public source key summaries, at most two latest non-null history points plus one earlier point per key, and exact-map admission status from the reader. The primary-key accesses constrain candidate history per key and avoid materializing normalized timelines. The identity view can still scan its underlying canonical projection and history indexes can visit older entries while skipping null values. The statement timeout bounds the work.

Use `psql -XqAt -v api_role=service_role` with the SQL below, choosing `anon` only where it matches the deployed route role. Use `psql -o "$trends_result"` on a local path with restricted permissions. The managing principal needs statistics visibility and capability to assume the matching application role. Pin the project hostname before starting. Exclude overlapping production writers by operator handoff in addition to the activity guard below.

```sql
\set ON_ERROR_STOP on
BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY;
SET LOCAL statement_timeout = '3s';
SET LOCAL lock_timeout = '1s';
SET LOCAL idle_in_transaction_session_timeout = '5s';
SET LOCAL TIME ZONE 'UTC';
SET LOCAL DateStyle = 'ISO, YMD';
SET LOCAL extra_float_digits = 3;

DO $guard$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_roles
    WHERE rolname = current_user
      AND (rolsuper OR pg_has_role(current_user, 'pg_read_all_stats', 'USAGE'))
  ) THEN
    RAISE EXCEPTION 'Operator lacks database activity visibility';
  END IF;
  IF EXISTS (
    SELECT 1 FROM pg_stat_activity
    WHERE pid <> pg_backend_pid() AND backend_type = 'client backend'
      AND (wait_event_type IN ('Lock', 'IO')
        OR (state = 'active' AND (
          now() - query_start > interval '5 seconds'
          OR query ILIKE ANY (ARRAY['%persist_nhl_api_gamecenter_normalized%',
                                   '%upsert_yahoo_players_atomic%'])
        ))
        OR state LIKE 'idle in transaction%')
  ) THEN
    RAISE EXCEPTION 'Concurrent database work detected';
  END IF;
  IF md5(pg_get_functiondef('public.verified_yahoo_player_identities_read()'::regprocedure))
       <> '495ccc4353268f60559dc3db197698d0'
     OR md5(pg_get_viewdef('public.yahoo_nhl_player_map_read'::regclass, true))
       <> '88f9440fcf64a968772b12215785ed70' THEN
    RAISE EXCEPTION 'Canonical reader definition changed after November 12';
  END IF;
END
$guard$;

SELECT :'api_role' IN ('service_role', 'anon') AS supported_role \gset
\if :supported_role
SET LOCAL ROLE :"api_role";
\else
\quit
\endif

WITH params AS MATERIALIZED (
  SELECT statement_timestamp() AS observed_at,
         statement_timestamp()::date - 3 AS target_date, 2026 AS season, '477' AS game_key
), source_rows AS MATERIALIZED (
  SELECT player_key, player_id, season
  FROM public.yahoo_players
  ORDER BY player_key
  LIMIT 6001
), gate AS MATERIALIZED (
  SELECT (SELECT count(*) FROM source_rows) AS row_count,
         (SELECT count(*) FROM public.yahoo_game_keys g
          WHERE g.code = 'nhl' AND g.season = p.season) = 1
           AND EXISTS (
             SELECT 1 FROM public.yahoo_game_keys g
             WHERE g.code = 'nhl' AND g.season = p.season
               AND g.game_key = p.game_key AND g.game_id::text = p.game_key
           ) AS season_ok
  FROM params p
), source_scope AS MATERIALIZED (
  SELECT s.*
  FROM source_rows s CROSS JOIN gate g
  WHERE g.row_count BETWEEN 1 AND 6000 AND g.season_ok
), identities AS MATERIALIZED (
  SELECT m.yahoo_player_id,
         count(DISTINCT m.nhl_player_id) FILTER (
           WHERE m.nhl_player_id::bigint BETWEEN 1 AND 9007199254740991
         ) AS valid_ids,
         min(m.nhl_player_id::bigint) FILTER (
           WHERE m.nhl_player_id::bigint BETWEEN 1 AND 9007199254740991
         ) AS first_valid_id
  FROM public.yahoo_nhl_player_map_read m
  JOIN source_scope s ON s.player_key = m.yahoo_player_id
  WHERE s.player_key ~ '^[0-9]+[.]p[.][0-9]+$'
  GROUP BY m.yahoo_player_id
), points AS (
  SELECT s.player_key, s.player_id, s.season,
         coalesce(i.valid_ids, 0) AS valid_ids,
         CASE WHEN i.valid_ids = 1 THEN i.first_valid_id END AS nhl_id,
         head.dates[1]::text AS latest_date,
         head.values[1]::text AS latest,
         CASE
           WHEN head.dates[2] IS NULL THEN NULL
           WHEN head.dates[1] = p.target_date THEN head.values[1]::text
           WHEN head.dates[2] <= p.target_date THEN head.values[2]::text
           ELSE prior.ownership_pct::text
         END AS previous
  FROM source_scope s
  CROSS JOIN params p
  LEFT JOIN identities i ON i.yahoo_player_id = s.player_key
  CROSS JOIN LATERAL (
    SELECT array_agg(h.ownership_date ORDER BY h.ownership_date DESC) AS dates,
           array_agg(h.ownership_pct ORDER BY h.ownership_date DESC) AS values
    FROM (
      SELECT h.ownership_date, h.ownership_pct
      FROM public.yahoo_player_ownership_history h
      WHERE h.player_key = s.player_key AND h.ownership_pct IS NOT NULL
      ORDER BY h.ownership_date DESC
      LIMIT 2
    ) h
  ) head
  LEFT JOIN LATERAL (
    SELECT h.ownership_pct
    FROM public.yahoo_player_ownership_history h
    WHERE head.dates[2] > p.target_date
      AND h.player_key = s.player_key AND h.ownership_pct IS NOT NULL
      AND h.ownership_date <= p.target_date
    ORDER BY h.ownership_date DESC
    LIMIT 1
  ) prior ON true
)
SELECT jsonb_build_object(
  'observedAt', p.observed_at, 'cutoff', p.target_date, 'season', p.season,
  'gameKey', p.game_key, 'rowCount', g.row_count, 'seasonOk', g.season_ok,
  'rows', coalesce((SELECT jsonb_agg(to_jsonb(r)
    ORDER BY r.player_id ASC NULLS LAST, r.season ASC NULLS FIRST)
    FROM points r), '[]'::jsonb)
)
FROM params p CROSS JOIN gate g;
ROLLBACK;
```

Reduce the saved JSON locally with `node --input-type=module - "$trends_result" <<'JS'` and the code below (then close the heredoc with `JS`). The two-point query uses the latest date and the API's exact-target-first rule even when the target is the latest point and movement is flat. Otherwise it uses the last eligible point excluding the latest. Keep JavaScript rounding and stable sort to match the route on decimal ties. In the deployed pre-candidate reader, ties in both source order columns and delta have no API-specified outcome. The local candidate adds player_key as the last SQL tiebreaker; include it last in the census JSON order when comparing to that released reader. The reducer flags any such tie across the page boundary and ties inside a page that leave rank order ambiguous.

```js
import { readFileSync } from "node:fs";

const capture = JSON.parse(readFileSync(process.argv[2], "utf8"));
if (!capture.seasonOk || capture.rowCount < 1 || capture.rowCount > 6000 ||
    capture.rows.length !== capture.rowCount) throw new Error("Census guard failed");
const { observedAt, cutoff, season, gameKey, rows } = capture;

function summarize(source) {
  const eligible = [];
  let sourceDate = null;
  for (const row of source) {
    if (row.latest_date && (!sourceDate || row.latest_date > sourceDate)) {
      sourceDate = row.latest_date;
    }
    if (row.latest === null || row.previous === null) continue;
    const raw = Number(row.latest) - Number(row.previous);
    if (Number.isFinite(raw)) eligible.push({ ...row, delta: Number(raw.toFixed(2)) });
  }
  const gap = (row) => {
    if (!/^[0-9]+[.]p[.][0-9]+$/.test(row.player_key)) return "malformed_key";
    if (row.valid_ids > 1) return "multiple_valid_nhl_ids";
    return "no_valid_admitted_id";
  };
  const sameRank = (a, b) => a?.delta === b?.delta && a?.player_id === b?.player_id &&
    a?.season === b?.season;
  const direction = (movers) => {
    const page = movers.slice(0, 10);
    return {
      eligibleMovers: movers.length,
      eligibleMapped: movers.filter((row) => row.nhl_id !== null).length,
      pageCount: page.length,
      pageMapped: page.filter((row) => row.nhl_id !== null).length,
      unpinnedPageOrder: page.some((row, index) =>
        movers[index + 1] && sameRank(row, movers[index + 1])),
      uncertainBoundary: Boolean(movers[10] && sameRank(movers[9], movers[10])),
      page: page.map((row) => ({
        key: row.player_key, season: row.season, delta: row.delta, playerId: row.nhl_id,
        ...(row.nhl_id === null ? { admission: gap(row) } : {}),
      })),
    };
  };
  const currentPrefix = (row) => row.player_key.startsWith(gameKey + ".p.");
  return {
    sourceDate,
    sourceRows: source.length,
    distinctStoredKeys: new Set(source.map((row) => row.player_key)).size,
    distinctWellFormedSeasonalKeys: new Set(source.filter((row) =>
      /^[0-9]+[.]p[.][0-9]+$/.test(row.player_key)).map((row) => row.player_key)).size,
    mappedRows: source.filter((row) => row.nhl_id !== null).length,
    unmappedRows: source.filter((row) => row.nhl_id === null).length,
    distinctAcceptedNhlIds: new Set(source.map((row) => row.nhl_id)
      .filter((id) => id !== null)).size,
    currentGamePrefixRows: source.filter(currentPrefix).length,
    currentGamePrefixWithoutSourceYear: source.filter((row) =>
      currentPrefix(row) && row.season !== season).length,
    currentSeasonWithoutCurrentGamePrefix: source.filter((row) =>
      row.season === season && !currentPrefix(row)).length,
    comparableHistoryRows: eligible.length,
    flatRows: eligible.filter((row) => row.delta === 0).length,
    risers: direction(eligible.filter((row) => row.delta > 0).sort((a, b) => b.delta - a.delta)),
    fallers: direction(eligible.filter((row) => row.delta < 0).sort((a, b) => a.delta - b.delta)),
  };
}

const currentRows = rows.filter((row) => row.season === season);
console.log(JSON.stringify({
  observedAt, cutoff, season, gameKey,
  homepageDefault: summarize(rows),
  currentSeason: summarize(currentRows),
  explicitSeasonApiWouldFallBack: currentRows.length === 0,
}, null, 2));
```

If a returned key lacks an admitted ID, preserve its exact key with the dated outcome and ask the Yahoo identity owner to review only observed gaps, starting with default-page rows. An exact-key reason read would need separate approval, a literal allowlist of up to 20 observed keys, one guarded read-only statement with the same timeouts, and public fields only. Join `fhfh_player_external_identities` by provider `yahoo` and `external_player_id`, across all contexts, then join `fhfh_player_identities` by `fhfh_player_id`. Compare verification states, external season/context, canonical NHL ID, and exact-key conflicts with the reader output. Verify catalogue evidence before proposing any metadata repair. A returned `no_valid_admitted_id` gives no deeper cause by itself. No new keys have been pinned for such a read.

The SQL and reducer were exercised on a disposable socket-only PostgreSQL 15 fixture with fixture-specific reader hashes. Checks covered key and mapping counts, history cutoff and exact-target handling, null and zero values, page ordering and ties, season fallback, and the row-cap guard. Production execution and performance remain unmeasured.
