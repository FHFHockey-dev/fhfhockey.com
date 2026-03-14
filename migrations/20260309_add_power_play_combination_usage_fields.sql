ALTER TABLE public."powerPlayCombinations"
ADD COLUMN IF NOT EXISTS pp_unit_usage_index double precision,
ADD COLUMN IF NOT EXISTS pp_unit_relative_toi integer,
ADD COLUMN IF NOT EXISTS pp_vs_unit_avg double precision,
ADD COLUMN IF NOT EXISTS pp_share_of_team double precision;

CREATE INDEX IF NOT EXISTS idx_power_play_combinations_pp_share_of_team
ON public."powerPlayCombinations" ("pp_share_of_team");
