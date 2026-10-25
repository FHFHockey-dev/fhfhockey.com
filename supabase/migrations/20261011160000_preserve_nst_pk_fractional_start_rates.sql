-- Proposal only: do not apply without separate migration authorization.
-- Retained Sep30 NST source has58 fractional On The Fly Starts/60 values
-- (e.g.41.22); the current writer preserves these numbers, but this column is int4.
-- The original failed run's SQL exception was not retained.
-- Match neighboring /60 columns; preserve existing values, DEFAULT0 and NOT NULL.
BEGIN;
SET LOCAL lock_timeout = '5s';
ALTER TABLE public.nst_gamelog_pk_rates_oi
  ALTER COLUMN on_the_fly_starts_per_60 TYPE double precision
  USING on_the_fly_starts_per_60::double precision;
COMMIT;
