# Rankings publication completion marker — plan (2026-11-15, not built)

**Goal:** the live reader serves a Rankings date only after a full Rankings publication and its composites have both finished, with the database confirming the row counts. #449 only checks that the two dates match.

## What the code does today (read from source; no production reads)
- **Rankings writer** (`entityMetricRankingWriter.ts:321`):
  - It upserts in 100-row chunks, and each chunk commits on its own. One full call is thousands of chunks.
  - If it fails partway, the earlier chunks stay written: the date exists with only some of its rows.
  - The route also accepts `metrics=`, `min_gp`, `min_toi` and `team`/`position`. The build silently skips any metric it can't produce.
  - So a successful run can still be a partial publication. Upserts never delete.
  - Each row carries its own metric's `snapshotDate`; `contexts[].snapshotDate` is only the first metric's.
- **Composites writer** (`skaterCompositeWriter.ts:794`): it writes in one PostgREST statement, which is atomic, and the route returns 409 unless `publication.ready` passes. Nothing checks that Rankings finished first or that the cutoff matches.
- **Reader** (`entityMetricRankingReader.ts:238–297`, #449): it matches dates by reading both tables, per metric. Snapshot and comparison go through the matrix, so this is the only place that picks the date.
- **Indexes:** neither large table has an index that starts with `(season, snapshot_date, window, strength, peer group)` (baseline `:34109`, `:35607`). A database-side `count(*)` per publication would read through every date in the season, so the plan uses counts returned by the writes instead.

## Design
### 1. Table `public.ranking_publications` (one migration in root `supabase/migrations/`)
| column | note |
|---|---|
| `surface` | `entity_metric_rankings` or `skater_composite_ratings` (check) |
| `season_id`, `snapshot_date`, `strength_state`, `window_type`, `window_size`, `peer_group_type`, `peer_group_key` | primary key = `surface` + these |
| `metric_set` | sorted metric keys published (Rankings); empty for composites |
| `min_gp`, `min_toi_seconds`, `methodology_version` | the floors and version the rows were built with |
| `status` | `writing` or `complete` (check) |
| `expected_rows`, `db_written_rows`, `expected_entities`, `written_entities` | see "what complete proves" |
| `started_at`, `completed_at`, `updated_at` | |

- It's small: one row per surface, window and date.
- RLS is on. Explicit `REVOKE ALL` from anon, authenticated and PUBLIC; `service_role` only. The reader and the writers use the service-role client.
- No trigger and no RPC.
- It follows the migration-151 pattern: an authority row as `pending`, a proof script `supabase/tests/ranking_publications.py` that reads back the table, RLS and grants, and a rollback SQL file.

### 2. Rankings writer (write mode only; dry runs touch nothing)
- **Markers only for a full publication.** The run must use the default metric set for the strength, the all_skaters peer group and the default floors, with zero `unavailableMetrics`. Any other run still writes its rows but creates no marker, so the reader never serves it.
- **Marker date:** taken from the built rows. If one window's rows span more than one `snapshot_date`, the run fails before writing anything.
- **Order of writes:**
  1. Upsert a `writing` marker for each window first. Republishing a date that is already complete hides it until the rewrite finishes.
  2. Run the chunks with `count: "exact"`, so PostgREST returns how many rows the database actually affected. Sum those counts.
  3. Set `complete` only if all of these hold:
     - `db_written_rows = expected_rows` (the built rows);
     - `written_entities` (distinct players in the rows) equals `expected_entities`, the source-coverage population for that window;
     - every metric in `metric_set` has rows.
- **Failure:** otherwise the marker stays at `writing` and the route reports why. A chunk failure leaves the marker at `writing` too.
- **Table missing:** if the table doesn't exist (PGRST205), write mode returns 409 before writing any row. Apply the migration before releasing this code, or the next publish waits.

### 3. Composites writer (write mode only)
1. It requires a `complete` Rankings marker for the same season, strength, season window and all_skaters at the composite `snapshotDate`, with matching floors. Without one it returns 409 "Rankings at <date> are not complete." Rankings-first and the shared cutoff become rules the code enforces.
2. It marks composites `writing`, then does the single atomic upsert with `count: "exact"`.
3. It marks them `complete` only if the database count equals the built rows and the distinct players equal the publication cohort.
4. If the table is missing, it returns 409.

### 4. Reader
- **Marker era:** for each season and strength, the era starts at the oldest marker date of any status.
  - **Dates in the era:** served only from a complete pair. That means a complete Rankings marker for the requested window and a complete composites marker (season window) at the same date. The reader also keeps the per-metric existence check at that date. If the metric has no row there, it steps to the next older complete pair (bounded).
  - **Dates before the era:** they keep the #449 date match.
  - **First marked publish:** if no complete pair exists in the era yet, the reader uses the #449 match below the era start. While the first marked publish runs (and between its Rankings and composites writes), 11-13 stays live. Reader tests cover both moments.
  - **No markers or no table:** the reader runs exactly the #449 path. Live output can't change until the first marked publish, and 2025-26 keeps #449 behaviour until it's republished.
- One cached marker read (30 s TTL, like today) is shared across the metric lookups in a request.

### What `complete` proves, and what it doesn't
- **It proves:**
  - every chunk succeeded;
  - the database reported as many affected rows as the build produced;
  - the published player count equals the source-coverage population;
  - each metric in the full default set has rows;
  - composites at the same date passed their own gate after Rankings were complete.
- **It doesn't prove:**
  - that the values are correct (the existing parity tests cover that);
  - that there are no leftover rows of players who dropped out (upserts never delete);
  - an independent `count(*)` readback (that would need a new index on a large table).

## Tests (Vitest, fakes only)
- **Rankings writer and route:**
  - the marker is set to `writing` before the first chunk and to `complete` after the last;
  - a failing chunk leaves it at `writing`;
  - a short database count, or an entity count below the population, blocks `complete`;
  - partial runs (one metric, a non-default floor, a team scope, any unavailable metric) write no marker;
  - mixed dates within a window are refused;
  - a dry run writes nothing;
  - a missing table returns 409.
- **Composites route:**
  - 409 without a complete Rankings marker, or with one at another date or with other floors;
  - on a pass, `writing` then `complete`;
  - a short database count blocks `complete`.
- **Reader:**
  - serves the last complete pair;
  - skips a date where Rankings are complete and composites are `writing`;
  - steps back while a republish is in progress;
  - serves 11-13 during the first marked publish, in both of its windows;
  - steps back when the per-metric check fails at the pair date;
  - falls back to #449 with no markers or a missing table;
  - makes one marker read across metrics.
- The existing #448/#449 tests still pass, now as the fallback path.

## Files (one owner)
- `supabase/migrations/2026111520xxxx_ranking_publications.sql` (new)
- `supabase/tests/ranking_publications.py` and its rollback SQL (new)
- `tasks/TASKS/repository-audit-remediation/migration-authority.json`: one new row. The FORGE lane also edits this register, so claim it first.
- `web/lib/supabase/supportedBaselineMigration.test.ts`: pins move, pending 6→7 (then applied 117→118 and pending back to 6 after the apply).
- `web/lib/rankings/entityMetricRankingWriter.ts` + test
- `web/lib/rankings/skaterCompositeWriter.ts` + test
- `web/pages/api/v1/db/update-entity-metric-rankings.ts`, `web/pages/api/v1/db/update-skater-composite-ratings.ts`
- `web/lib/rankings/entityMetricRankingReader.ts` + test
- `web/lib/supabase/database-generated.types.ts`: the new table's types, added by hand to match the migration.

## Approvals, in order
1. **Build locally:** migration, proof (local PostgreSQL), code and tests. Nothing remote.
2. **Apply the migration:** one transaction; readback of the table, RLS, grants and schema_migrations. Production write; your pop-up.
3. **Release:** a candidate with only these files, gated, one fhfhockey build. Your pop-up. The reader falls back safely without markers. The writers refuse to write until the migration is applied, so step 2 comes first.
4. **First marked publish:** pinned `as_of_date`, Rankings then composites, then a readback of the markers and the served date. Your pop-up.
5. **Optional:** seed markers for the 11-13 pair from the verified receipts. Not needed, because the era rule keeps 11-13 live.

## Out of scope
- Database-side `count(*)` (it needs a new index on a large table).
- Deleting rows of players who dropped out.
- Historical republish, a schedule, and Trending speed.
