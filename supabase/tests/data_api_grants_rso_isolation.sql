-- D4 server-only RSO saved-plan boundary. Disposable canonical replay ONLY.
-- Requires pgTAP. Synthetic users and workspace fixtures roll back.
-- Browser denial is the DB boundary; service_role must carry an authenticated
-- server-derived user_id filter. These tests do not claim RLS confines service_role.
BEGIN;
SET LOCAL search_path = public, extensions, pg_temp;
SELECT no_plan();

INSERT INTO auth.users(id) VALUES
 ('d4202620-0000-4000-8000-000000000001'),
 ('d4202620-0000-4000-8000-000000000002');
INSERT INTO public.in_season_workspaces(user_id,provider,league_id,team_id,season_id,start_date,end_date,workspace)
VALUES
 ('d4202620-0000-4000-8000-000000000001','manual','d4-league','d4-team',20262027,'2026-10-05','2026-10-11','{"owner":"a"}'),
 ('d4202620-0000-4000-8000-000000000002','manual','d4-league','d4-team',20262027,'2026-10-05','2026-10-11','{"owner":"b"}');

SET LOCAL ROLE anon;
SELECT throws_ok($q$SELECT workspace FROM public.in_season_workspaces$q$,
 '42501', NULL, 'anonymous workspace read denied');
RESET ROLE;
SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claim.sub = 'd4202620-0000-4000-8000-000000000001';
SET LOCAL request.jwt.claims = '{"sub":"d4202620-0000-4000-8000-000000000001","role":"authenticated"}';
SELECT throws_ok($q$SELECT workspace FROM public.in_season_workspaces WHERE user_id='d4202620-0000-4000-8000-000000000001'$q$,
 '42501', NULL, 'even owner must use authenticated server API');
SELECT throws_ok($q$SELECT workspace FROM public.in_season_workspaces WHERE user_id='d4202620-0000-4000-8000-000000000002'$q$,
 '42501', NULL, 'user A cannot read user B saved plan');
SELECT throws_ok($q$UPDATE public.in_season_workspaces SET workspace='{"forged":true}' WHERE user_id='d4202620-0000-4000-8000-000000000002'$q$,
 '42501', NULL, 'user A cannot overwrite user B saved plan');
SELECT throws_ok($q$DELETE FROM public.in_season_workspaces WHERE user_id='d4202620-0000-4000-8000-000000000002'$q$,
 '42501', NULL, 'user A cannot delete user B saved plan');
SELECT throws_ok($q$INSERT INTO public.in_season_workspaces(user_id,provider,league_id,team_id,season_id,start_date,end_date,workspace)
 VALUES('d4202620-0000-4000-8000-000000000002','manual','d4-forged','d4-team',20262027,'2026-10-05','2026-10-11','{}')$q$,
 '42501', NULL, 'user A cannot insert a saved plan for user B');
RESET ROLE;

SET LOCAL ROLE service_role;
SELECT results_eq($q$SELECT workspace->>'owner' FROM public.in_season_workspaces
 WHERE user_id='d4202620-0000-4000-8000-000000000001' AND provider='manual'
 AND league_id='d4-league' AND team_id='d4-team' AND season_id=20262027
 AND start_date='2026-10-05' AND end_date='2026-10-11'$q$,
 ARRAY['a']::text[], 'server ownership/context filter returns only A');
SELECT results_eq($q$WITH saved AS (
 UPDATE public.in_season_workspaces SET lock_version=2, workspace='{"owner":"a","saved":true}'
 WHERE user_id='d4202620-0000-4000-8000-000000000001' AND provider='manual'
 AND league_id='d4-league' AND team_id='d4-team' AND season_id=20262027
 AND start_date='2026-10-05' AND end_date='2026-10-11' AND lock_version=1 RETURNING lock_version)
 SELECT lock_version FROM saved$q$, ARRAY[2]::integer[], 'server owner/context/version update changes exactly A');
SELECT results_eq($q$WITH stale AS (
 UPDATE public.in_season_workspaces SET lock_version=3
 WHERE user_id='d4202620-0000-4000-8000-000000000001' AND provider='manual'
 AND league_id='d4-league' AND team_id='d4-team' AND season_id=20262027
 AND start_date='2026-10-05' AND end_date='2026-10-11' AND lock_version=1 RETURNING lock_version)
 SELECT lock_version FROM stale$q$, ARRAY[]::integer[], 'stale compare-and-swap cannot overwrite A');
SELECT results_eq($q$SELECT workspace::text || ':' || lock_version::text FROM public.in_season_workspaces
 WHERE user_id='d4202620-0000-4000-8000-000000000002' AND provider='manual'
 AND league_id='d4-league' AND team_id='d4-team' AND season_id=20262027
 AND start_date='2026-10-05' AND end_date='2026-10-11'$q$,
 ARRAY['{"owner": "b"}:1']::text[], 'B saved plan and version unchanged');
RESET ROLE;

SELECT * FROM finish();
ROLLBACK;
