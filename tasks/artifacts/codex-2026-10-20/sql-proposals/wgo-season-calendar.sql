-- PROPOSED POLICY ONLY. Not applied; Claude owns migration/constraint integration.
-- Keep existing game-identity checks. NULL-date/season legacy policy must be
-- decided separately; SQL CHECK permits NULL and this adds no historical repair.
-- This necessary coarse calendar invariant allows delayed 2019-20 playoffs.
-- Validate existing outliers and exact column types in an approved read first.
ALTER TABLE public.wgo_skater_stats
  ADD CONSTRAINT wgo_skater_season_calendar_year_proposed
  CHECK (extract(year FROM date::date) BETWEEN
    (season_id / 10000)::integer AND (season_id / 10000)::integer + 1)
  NOT VALID;
-- NOT VALID still checks new/updated rows; do not apply before the historical
-- repair policy is chosen. No VALIDATE CONSTRAINT or row update is proposed here.
