# NST reverse UTC date repair

Reverse-mode queue generation now formats each parsed local-midnight cursor as its calendar date, preserving `YYYY-MM-DD` on a UTC host. The focused tests cover a single requested date, both inclusive boundaries of a descending range, and clamping a future start to today's date.

## §5.3 proposed production read (not executed)

After direct authorization, run this bounded read-only SQL against production. It inspects NST coverage from the day before the requested catch-up window through its end, split by source and date, alongside regular-season schedule dates. It does not modify data.

```sql
BEGIN READ ONLY;
SET LOCAL statement_timeout = '10s';

WITH calendar AS (
  SELECT generate_series(date '2026-09-28', date '2026-10-18', interval '1 day')::date AS date
),
scheduled AS (
  SELECT DISTINCT date::date AS date
  FROM public.games
  WHERE "seasonId" = 20262027
    AND type = 2
    AND date >= date '2026-09-28'
    AND date < date '2026-10-19'
),
nst AS (
  SELECT 'nst_team_gamelogs_as_counts' AS source, date::date AS date,
         count(*) AS row_count, count(DISTINCT team_abbreviation) AS team_count
  FROM public.nst_team_gamelogs_as_counts
  WHERE date >= date '2026-09-28' AND date < date '2026-10-19'
  GROUP BY date::date
  UNION ALL
  SELECT 'nst_team_gamelogs_as_rates', date::date, count(*), count(DISTINCT team_abbreviation)
  FROM public.nst_team_gamelogs_as_rates
  WHERE date >= date '2026-09-28' AND date < date '2026-10-19'
  GROUP BY date::date
  UNION ALL
  SELECT 'nst_team_gamelogs_es_counts', date::date, count(*), count(DISTINCT team_abbreviation)
  FROM public.nst_team_gamelogs_es_counts
  WHERE date >= date '2026-09-28' AND date < date '2026-10-19'
  GROUP BY date::date
  UNION ALL
  SELECT 'nst_team_gamelogs_es_rates', date::date, count(*), count(DISTINCT team_abbreviation)
  FROM public.nst_team_gamelogs_es_rates
  WHERE date >= date '2026-09-28' AND date < date '2026-10-19'
  GROUP BY date::date
  UNION ALL
  SELECT 'nst_team_gamelogs_pp_counts', date::date, count(*), count(DISTINCT team_abbreviation)
  FROM public.nst_team_gamelogs_pp_counts
  WHERE date >= date '2026-09-28' AND date < date '2026-10-19'
  GROUP BY date::date
  UNION ALL
  SELECT 'nst_team_gamelogs_pp_rates', date::date, count(*), count(DISTINCT team_abbreviation)
  FROM public.nst_team_gamelogs_pp_rates
  WHERE date >= date '2026-09-28' AND date < date '2026-10-19'
  GROUP BY date::date
  UNION ALL
  SELECT 'nst_team_gamelogs_pk_counts', date::date, count(*), count(DISTINCT team_abbreviation)
  FROM public.nst_team_gamelogs_pk_counts
  WHERE date >= date '2026-09-28' AND date < date '2026-10-19'
  GROUP BY date::date
  UNION ALL
  SELECT 'nst_team_gamelogs_pk_rates', date::date, count(*), count(DISTINCT team_abbreviation)
  FROM public.nst_team_gamelogs_pk_rates
  WHERE date >= date '2026-09-28' AND date < date '2026-10-19'
  GROUP BY date::date
)
SELECT c.date,
       (s.date IS NOT NULL) AS has_regular_season_game,
       sources.source,
       coalesce(n.row_count, 0) AS row_count,
       coalesce(n.team_count, 0) AS team_count
FROM calendar c
LEFT JOIN scheduled s USING (date)
CROSS JOIN (VALUES
  ('nst_team_gamelogs_as_counts'), ('nst_team_gamelogs_as_rates'),
  ('nst_team_gamelogs_es_counts'), ('nst_team_gamelogs_es_rates'),
  ('nst_team_gamelogs_pp_counts'), ('nst_team_gamelogs_pp_rates'),
  ('nst_team_gamelogs_pk_counts'), ('nst_team_gamelogs_pk_rates')
) AS sources(source)
LEFT JOIN nst n ON n.date = c.date AND n.source = sources.source
ORDER BY c.date, sources.source;

ROLLBACK;
```

Interpretation: first verify each scheduled date in 2026-09-29..2026-10-18 has coherent coverage across the eight sources. Rows on 2026-09-28 or unscheduled adjacent dates, paired with missing rows on the requested scheduled date, are consistent with a one-day-back shift and deserve a row-level follow-up. Counts alone cannot establish which request produced a row, and missing rows may reflect NST availability or partial processing; do not repair data or infer a shift solely from a low team count. This recipe does not authorize running it or any catch-up route.

## Verification

The first mandated full focused-file run reached 10 tests: 7 passed and 3 failed. Two pre-existing burst-dependent expectations now disagree with the concurrent D1 pacing behavior: `advances past a complete latest date instead of re-queueing it` fetched only 2026-10-17 (expected 2026-10-17 and 2026-10-18), and `leaves time for a terminal audit and resumes a date after slow NST responses` left 2026-10-18 deferred (expected completion). The reverse-range test initially expected all three dates to be fetched in one run; its assertion was adjusted to verify the full queue length and next date while preserving one-date pacing. A filtered UTC run of the three new reverse tests passed: 3 passed, 7 skipped. `git diff --check` passed for the assigned files and report.

No production read, route call, or NST request was executed. Production remains unverified.

Chef integration: updated the two existing burst-dependent cases to verify deferred receipts and a subsequent completing invocation. The final full focused file passed 10/10 under `TZ=UTC` with outbound networking blocked. No date/pacing source change was needed beyond the one-line reverse repair and D1 shared pacing changes.
