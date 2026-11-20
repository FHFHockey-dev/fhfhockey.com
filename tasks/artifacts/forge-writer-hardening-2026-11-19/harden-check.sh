#!/bin/zsh
# Disposable faithful prod copy only (roles + schema + grants loaded; postgres NOSUPERUSER as in production).
# Usage: harden-check.sh <repo root>   with PCHOST/PCPORT/PCDB pointing at the copy and supabase_admin as its superuser.
set -u
cd "$1"
H=tasks/artifacts/forge-writer-hardening-2026-11-19
B=/opt/homebrew/opt/postgresql@15/bin/psql
PGU=(env LC_ALL=en_US.UTF-8 $B -h $PCHOST -p $PCPORT -U postgres -d $PCDB -X -At -q)
SU=(env LC_ALL=en_US.UTF-8 $B -h $PCHOST -p $PCPORT -U supabase_admin -d $PCDB -X -At -q)
svc() { echo "  $1: $($SU -c "begin; set local role service_role; $2; rollback;" 2>&1 | grep -vE '^(BEGIN|ROLLBACK|SET)$' | sed 's/^psql:[^:]*:[0-9]*: //' | tr '\n' ' ' | cut -c1-220)"; }
echo "1 before: service_role execute_sql=$($SU -c "select has_function_privilege('service_role','public.execute_sql(text)','EXECUTE')")"
echo "2 apply harden-execute-sql.sql as postgres:"; $PGU -v ON_ERROR_STOP=1 -f $H/harden-execute-sql.sql 2>&1 | tail -1 | sed 's/^/  /'
echo "3 second apply refuses:"; $PGU -v ON_ERROR_STOP=1 -f $H/harden-execute-sql.sql 2>&1 | grep -oE 'already_hardened' | sed 's/^/  /'
echo "4 CSV admin path as service_role (each rolled back):"
svc "create new table, then insert, then read" "select public.csv_create_table_v1('csv_probe_new', '[{\"name\":\"Rank\",\"type\":\"integer\"},{\"name\":\"Player\",\"type\":\"TEXT\"},{\"name\":\"When\",\"type\":\"TIMESTAMP WITH TIME ZONE\"}]'); insert into public.csv_probe_new(\"Rank\",\"Player\") values (1,'x'); select count(*) from public.csv_probe_new"
svc "existing table: no DDL" "select public.csv_create_table_v1('players', '[{\"name\":\"x\",\"type\":\"TEXT\"}]')"
svc "service_role gets only SELECT+INSERT on the new table" "select public.csv_create_table_v1('csv_probe_acl', '[{\"name\":\"a\",\"type\":\"TEXT\"}]'); select has_table_privilege('service_role','public.csv_probe_acl','UPDATE'), has_table_privilege('service_role','public.csv_probe_acl','DELETE'), has_table_privilege('anon','public.csv_probe_acl','SELECT'), pg_get_userbyid(relowner) from pg_class where relname='csv_probe_acl'"
svc "injection in table name" "select public.csv_create_table_v1('x\"; drop table players; --', '[{\"name\":\"a\",\"type\":\"TEXT\"}]')"
svc "injection in column name" "select public.csv_create_table_v1('csv_probe_inj', '[{\"name\":\"a\\\" text); drop table players; --\",\"type\":\"TEXT\"}]')"
svc "injection in type" "select public.csv_create_table_v1('csv_probe_inj', '[{\"name\":\"a\",\"type\":\"TEXT); drop table players; --\"}]')"
svc "reserved column player_id" "select public.csv_create_table_v1('csv_probe_dup', '[{\"name\":\"player_id\",\"type\":\"BIGINT\"}]')"
svc "shadowing a relation in another schema" "select public.csv_create_table_v1('verdicts', '[{\"name\":\"a\",\"type\":\"TEXT\"}]')"
svc "pg_ prefix" "select public.csv_create_table_v1('pg_probe', '[{\"name\":\"a\",\"type\":\"TEXT\"}]')"
echo "5 who may call:"
svc "execute_sql as service_role" "select public.execute_sql('select 1')"
echo "  anon csv_create: $($SU -c "select has_function_privilege('anon','public.csv_create_table_v1(text,jsonb)','EXECUTE')"), authenticated: $($SU -c "select has_function_privilege('authenticated','public.csv_create_table_v1(text,jsonb)','EXECUTE')"), postgres execute_sql: $($SU -c "select has_function_privilege('postgres','public.execute_sql(text)','EXECUTE')")"
echo "6 rollback, then re-harden:"
$PGU -v ON_ERROR_STOP=1 -f $H/rollback-harden-execute-sql.sql 2>&1 | tail -1 | sed 's/^/  rollback: /'
$PGU -v ON_ERROR_STOP=1 -f $H/harden-execute-sql.sql 2>&1 | tail -1 | sed 's/^/  re-harden: /'
