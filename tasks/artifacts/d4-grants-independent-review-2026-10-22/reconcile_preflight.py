"""Independent read-only D4 source/TAP reconciliation. Never runs PostgreSQL."""
import ast
import csv
import hashlib
import json
from pathlib import Path
import re
from types import SimpleNamespace

REPO = Path(__file__).resolve().parents[3]
OUT = Path(__file__).resolve().parent
D4 = REPO / 'tasks/artifacts/d4-grants-2026-10-20'
matrix_path = REPO / 'supabase/tests/data_api_grants.sql'
migration_path = REPO / 'supabase/migrations/20261020224600_data_api_reviewed_object_grants.sql'
matrix = matrix_path.read_text()
migration = re.sub(r'--[^\n]*', '', migration_path.read_text())
roles = ['service_role', 'anon', 'authenticated']
ops = ['SELECT', 'INSERT', 'UPDATE', 'DELETE', 'TRUNCATE', 'REFERENCES', 'TRIGGER']
quoted = lambda text: set(re.findall(r"'([^']+)'", text))
tables = {}
for name, service, anon, auth in re.findall(r"\('(public\.[a-z_]+)',ARRAY\[([^]]*)\]::text\[\],ARRAY\[([^]]*)\]::text\[\],ARRAY\[([^]]*)\]::text\[\]\)", matrix):
    assert name not in tables
    tables[name] = {role: quoted(value) for role, value in zip(roles, [service, anon, auth])}
assert len(tables) == 76
allowed = {name: {role: set() for role in roles} for name in tables}
reset_tables = set()
for objects, grantees in re.findall(r'revoke\s+all\s+on\s+table\s+(.*?)\s+from\s+(.*?);', migration, re.S | re.I):
    assert {'public', *roles} <= {x.strip().lower() for x in grantees.split(',')}
    reset_tables.update(re.findall(r'public\.[a-z_]+', objects))
assert reset_tables == set(tables)
for privileges, objects, grantees in re.findall(r'grant\s+([^;]*?)\s+on\s+table\s+([^;]*?)\s+to\s+([^;]*?);', migration, re.S | re.I):
    for name in re.findall(r'public\.[a-z_]+', objects):
        for role in [x.strip().lower() for x in grantees.split(',')]:
            allowed[name][role].update(x.strip().upper() for x in privileges.split(','))
assert allowed == tables

# Historical expected booleans can be recovered from the saved assertion result and
# saved effective grant bits: a failed equality expected the opposite boolean.
# This is TAP/ACL reconciliation, not a claim to possess the untracked old SQL bytes.
acl = list(csv.DictReader((D4 / 'run-v7/acl-after.csv').open()))
acl_bits = {(r['object'], r['grantee'], r['privilege_type']) for r in acl if r['kind']=='relation'}
tap = (D4 / 'run-v7/data_api_grants.sql.tap').read_text()
old_results = re.findall(r'^(not ok|ok) \d+ - (.+)$', tap, re.M)
old_bad = {description for result, description in old_results if result == 'not ok'}
changed = []
browser_changes = []
expansions = []
table_cases = 0
for result, description in old_results:
    match = re.fullmatch(r'(anon|authenticated|service_role) ([A-Z]+) (public\.[a-z_]+) matches reviewed allow/deny matrix', description)
    if not match:
        continue
    role, op, table = match.groups()
    assert table in tables and op in ops
    actual = (table, role, op) in acl_bits or (table, 'PUBLIC', op) in acl_bits
    old_expected = actual if result == 'ok' else not actual
    current_expected = op in tables[table][role]
    assert current_expected == actual
    table_cases += 1
    if old_expected != current_expected:
        changed.append(description)
        if role != 'service_role': browser_changes.append(description)
        if current_expected: expansions.append(description)
assert table_cases == 76*3*7
assert len(changed) == 64 and not browser_changes and not expansions

function_block = re.search(r'INSERT INTO d4_functions\(signature\) VALUES(.*?);', matrix, re.S).group(1)
functions = quoted(function_block)
promotion = 'public.promote_player_forecast_model_atomic(text,uuid,uuid,text,jsonb,timestamptz)'
assert len(functions) == 46
assert "UPDATE d4_functions SET service_execute=false\nWHERE signature='" + promotion + "';" in matrix
assert "has_function_privilege(r.role,f.signature,'EXECUTE')=(r.role='service_role' AND f.service_execute)" in matrix
normalize = lambda signature: re.sub(r'\s+', '', signature)
function_grants = set()
function_resets = set()
for verb, target in [('grant', function_grants), ('revoke', function_resets)]:
    keyword = 'to' if verb == 'grant' else 'from'
    for signatures, grantees in re.findall(rf'{verb}\s+(?:execute|all)\s+on\s+function\s+(.*?)\s+{keyword}\s+(.*?);', migration, re.S | re.I):
        if verb == 'grant': assert grantees.strip().lower() == 'service_role'
        else: assert {'public', *roles} <= {x.strip().lower() for x in grantees.split(',')}
        target.update(normalize(s) for s in re.findall(r'public\.[a-z_]+\([^)]*\)', signatures))
assert function_resets == functions
assert function_grants == functions - {promotion}
assert not any('promote_player_forecast_model_atomic(' in row['object'] and row['grantee'] in {'PUBLIC', *roles} for row in acl)
changed.append('service_role EXECUTE ' + promotion)
assert "has_sequence_privilege(r.role,'public.roster_optimizer_team_games_id_seq',p.op)=(r.role='service_role' AND p.op='USAGE')" in matrix
assert re.search(r'grant usage on sequence public.roster_optimizer_team_games_id_seq to service_role;', migration, re.I)
assert {p for obj,role,p in acl_bits if obj=='public.roster_optimizer_team_games_id_seq' and role=='service_role'} == {'USAGE'}
changed.append('service_role sequence SELECT')
assert set(changed) == old_bad and len(changed) == 66
implementer = json.loads((D4/'repair-2026-10-22/verification.json').read_text())
assert set(changed) == set(implementer['changedExpectations'])

# Execute only the pure TAP-classification AST statements, never the harness module.
harness = (D4/'harness.py').read_text()
module = ast.parse(harness)
loop = next(n for n in ast.walk(module) if isinstance(n,ast.For) and isinstance(n.target,ast.Name) and n.target.id=='name' and isinstance(n.iter,ast.Name) and n.iter.id=='tests')
names = {'lines','oks','bad','plan','complete','good'}
statements = [n for n in loop.body if isinstance(n,ast.Assign) and isinstance(n.targets[0],ast.Name) and n.targets[0].id in names]
assert len(statements) == 6
pure = compile(ast.Module(body=statements,type_ignores=[]),'<reviewed TAP classifier>','exec')
assert 'reviewed_deviation' not in harness and 'reviewedDeviations' not in harness and 'bad[:50]' not in harness
cases = [
    ('historical_v7',tap,0,False,66),
    ('synthetic_clean','ok 1 - probe\n1..1\n',0,True,0),
    ('formerly_exempt_failure','not ok 1 - service_role sequence SELECT\n1..1\n',0,False,1),
    ('missing_plan','ok 1 - probe\n',0,False,0),
    ('duplicate_plan','ok 1 - probe\n1..1\n1..1\n',0,False,0),
    ('truncated_plan','ok 1 - probe\n1..2\n',0,False,0),
    ('sql_error','ok 1 - probe\n1..1\n',1,False,0),
    ('bail_out','ok 1 - probe\n1..1\nBail out! probe\n',0,False,0),
]
parser_results = []
for name,stdout,exit_code,want,bad_count in cases:
    namespace = {'re':re,'result':SimpleNamespace(stdout=stdout,returncode=exit_code)}
    exec(pure,namespace)
    assert namespace['good'] is want and len(namespace['bad']) == bad_count
    parser_results.append({'case':name,'accepted':namespace['good'],'bad_count':len(namespace['bad']),'expectation_matched':True})
summary = {'table_expectations':len(tables),'table_assertions_compared':table_cases,'service_function_grants':len(function_grants),'function_signatures_checked':len(functions),
           'narrowed_table_expectations':64,'additional_narrowings':[changed[-2],changed[-1]],'historical_failure_descriptions_exactly_reconciled':66,
           'browser_expectation_changes':0,'privilege_expansions':0,'expected_matrix_assertion_count':76*21+76+46*3+46+9+3+2,
           'tap_parser_cases':parser_results,'sql_executed':False}
(OUT/'reconciliation.json').write_text(json.dumps(summary,indent=2)+'\n')
(OUT/'reconciled-expectations.json').write_text(json.dumps(sorted(changed),indent=2)+'\n')
print(json.dumps(summary,indent=2))
