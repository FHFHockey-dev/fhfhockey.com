-- Add PK TOI to shift_charts totals so derived strength tables can populate toi_pk_seconds.
ALTER TABLE IF EXISTS shift_charts
ADD COLUMN IF NOT EXISTS total_pk_toi TEXT NULL;

