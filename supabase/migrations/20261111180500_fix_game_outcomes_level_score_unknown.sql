-- NOT APPLIED. Math-audit fix lane L4a (W2-1 D11).
-- Apply only with TJ's pop-up approval, singly, then record schema_migrations and migration-authority.json.
--
-- gameOutcomes labelled a level score 'TIE'. teamGameStats is written only for finished games
-- (update-stats/[gameId].ts admits OFF/FINAL), and a finished NHL game cannot end level (a shootout
-- winner is credited a goal), so a level score means the row is not a final result: outcome is now NULL
-- (unknown), never a decided result. 'WIN'/'LOSS' are the TEAM result; 'LOSS' includes overtime and
-- shootout losses and is not a goalie's credited decision (decisions 46, 63, 72, 82): goalie readers must
-- use credited decisions, not this view.
begin;
set local lock_timeout = '5s';
set local statement_timeout = '30s';

CREATE OR REPLACE VIEW public."gameOutcomes" AS
 SELECT "teamOne"."gameId",
    "teamOne"."teamId",
        CASE
            WHEN ("teamOne".score > "teamTwo".score) THEN 'WIN'::text
            WHEN ("teamOne".score < "teamTwo".score) THEN 'LOSS'::text
            ELSE NULL::text
        END AS outcome
   FROM (public."teamGameStats" "teamOne"
     JOIN public."teamGameStats" "teamTwo" ON ((("teamOne"."gameId" = "teamTwo"."gameId") AND ("teamOne"."teamId" <> "teamTwo"."teamId"))));

COMMENT ON VIEW public."gameOutcomes" IS
  'Team result per game: WIN or LOSS (LOSS includes OT and shootout losses); NULL when the stored score is '
  'level, i.e. not a final result. Not a goalie credited decision.';

commit;

-- READBACK (bounded): select outcome, count(*) from public."gameOutcomes" where "gameId" between 2025020001 and 2025020100 group by 1;
--   -- expect WIN = LOSS counts and no TIE
-- ROLLBACK: supabase/tests/l4a_sql_readers_rollback.sql.
