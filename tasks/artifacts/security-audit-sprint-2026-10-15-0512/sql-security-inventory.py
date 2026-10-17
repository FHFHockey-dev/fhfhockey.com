"""Catalog source security constructs without connecting to a database."""
from pathlib import Path
import csv
import hashlib
import json
import re

ROOT = Path(__file__).resolve().parents[3]
OUT = Path(__file__).resolve().parent
paths = sorted((ROOT / 'supabase/migrations').glob('*.sql'))
baseline = ROOT / 'supabase/migrations/20260716112908_production_schema_baseline.sql'
baseline_text = baseline.read_text()
texts = [(p,p.read_text()) for p in paths]
name = r'(?:(?:[a-z_][a-z0-9_]*|"[^"]+")\.)?(?:[a-z_][a-z0-9_]*|"[^"]+")'
tables = re.findall(r'CREATE TABLE\s+(public\.(?:"[^"]+"|[a-z_][a-z0-9_]*))\s*\(', baseline_text, re.I)
enabled = set()
for _,s in texts:
    enabled.update(re.findall(r'ALTER TABLE\s+(?:ONLY\s+)?(public\.(?:"[^"]+"|[a-z_][a-z0-9_]*))\s+ENABLE ROW LEVEL SECURITY', s, re.I))

functions = []
for p,s in texts:
    for m in re.finditer(r'\bCREATE\s+(?:OR\s+REPLACE\s+)?FUNCTION\s+('+name+r')\s*\(',s,re.I):
        after=s[m.start():]
        opening=re.search(r'\bAS\s+(\$[A-Za-z0-9_]*\$)',after,re.I)
        if not opening:
            continue
        end=after.find(opening.group(1), opening.end())
        if end<0:
            continue
        function_source=after[:end+len(opening.group(1))]
        header=after[:opening.start()]
        if not re.search(r'\bSECURITY\s+DEFINER\b',header,re.I):
            continue
        functions.append({'path':str(p.relative_to(ROOT)), 'line':s.count('\n',0,m.start())+1,
                          'routine_name':m.group(1),'source_sha256':hashlib.sha256(function_source.encode()).hexdigest(),
                          'explicit_search_path_in_definition':bool(re.search(r'\bset\s+search_path\b',header,re.I)),
                          'note':'Definition occurrence, not effective deployed grant; later ALTER/DROP/revoke must be reconciled'})
with (OUT/'security-definer-inventory.csv').open('w',newline='') as f:
    writer=csv.DictWriter(f,fieldnames=list(functions[0]))
    writer.writeheader(); writer.writerows(functions)
register_path=ROOT/'tasks/TASKS/repository-audit-remediation/migration-authority.json'
register=json.loads(register_path.read_text())
from collections import Counter
summary={
    'baseline_public_table_count':len(tables),
    'baseline_tables_without_explicit_rls_enable_in_chain':sorted(set(tables)-enabled),
    'security_definer_definition_occurrences':len(functions),
    'supported_migration_deployment_states_from_register':dict(Counter(x['deploymentState'] for x in register['migrations'])),
    'authority_register_sha256':hashlib.sha256(register_path.read_bytes()).hexdigest(),
    'scope':'Textual source inventory only; dynamic SQL and migration ordering require manual review; no deployed-state verification.',
}
(OUT/'sql-security-summary.json').write_text(json.dumps(summary,indent=2)+'\n')
print(json.dumps(summary,indent=2))
