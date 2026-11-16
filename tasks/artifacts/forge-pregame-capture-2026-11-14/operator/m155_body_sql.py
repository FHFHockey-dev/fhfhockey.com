"""Print a read-only psql script that plans (or runs) migration 155's new function body as a prepared statement.

Usage: python3 -I m155_body_sql.py <migration file> <explain options, e.g. "" or "(analyze, buffers)"> [extra setting]
The body is taken verbatim from between `as $$` and `$$;` with p_season_id/p_cutoff as $1/$2. Planned with
plan_cache_mode = force_generic_plan, which is how a non-inlined SQL function plans its statements.
Used by apply-migration-155.sh for the step-2 plan gate and the smoke; it reads only the local file.
"""
import sys

source = open(sys.argv[1]).read()
start = source.index("as $$") + len("as $$")
end = source.index("$$;", start)
body = source[start:end].replace("p_season_id", "$1").replace("p_cutoff", "$2").rstrip().rstrip(";")
options = sys.argv[2]
extra = sys.argv[3] if len(sys.argv) > 3 else ""
print("begin read only;")
print("set local statement_timeout = '8s';")
print("set local plan_cache_mode = force_generic_plan;")
if extra:
    print(extra)
print("prepare candidate(integer, date) as" + body + ";")
print(f"explain {options} execute candidate(20262027, '2026-11-15');".replace("explain  ", "explain "))
print("rollback;")
