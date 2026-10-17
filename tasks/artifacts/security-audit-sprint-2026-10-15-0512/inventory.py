"""Read source-only inventories; never read env files or business-data artifacts."""
from pathlib import Path
from collections import Counter
import csv
import hashlib
import json
import re
import subprocess
from datetime import datetime, timezone

ROOT = Path(__file__).resolve().parents[3]
OUT = Path(__file__).resolve().parent
GUARDS = re.compile(r'\b(adminOnly|withOperationalRouteAuth|requireApiUser|requireDraftProServerCapability|requireInSeasonServerCapability|withMockDraftApi|requireMockDraftAccess|mockHandler|verifySignature|constructEvent|invokedByCron|verifyIftttSecret|createLineSourceIftttHandler|createLineSourceIftttReceiver|playerForecastAdminOnly|playerForecastSeasonEditorOnly|withPlayerForecastAdmin|withPlayerForecastJobAuth|withDraftRankerApi)\b')
SIGNALS = {
    'auth': r'\b(?:auth|getUser|authorization|signature|timingSafeEqual|compare_digest|_authorized|_check_auth)\b',
    'write': r'\.(?:insert|upsert|update|delete)\s*\(',
    'rpc': r'\.rpc\s*\(',
    'network': r'\b(?:fetch|axios|requests\.(?:get|post|request))\s*\(',
    'service_client': r'(?:supabase/server|serviceRoleClient|getServiceRoleClient)',
    'dynamic_code': r'\b(?:eval|exec|execSync|spawn|spawnSync|subprocess)\b',
    'html_sink': r'dangerouslySetInnerHTML|innerHTML|document\.write',
    'raw_sql': r'\b(?:execute_sql|\.query\s*\(|\.execute\s*\()',
    'upload': r'\b(?:formidable|multer|readFile|writeFile|createReadStream|storage\.from)\b',
}

def write_csv(name, rows, fields):
    with (OUT / name).open('w', newline='') as f:
        writer = csv.DictWriter(f, fieldnames=fields)
        writer.writeheader()
        writer.writerows(rows)

route_paths = sorted(p for base in [ROOT / 'web/pages/api', ROOT / 'functions/api']
                     for p in base.rglob('*') if p.suffix in {'.ts', '.tsx', '.js', '.py'}
                     and not any(x in p.name for x in ['.test.', '.spec.']))
routes = []
for p in route_paths:
    s = p.read_text()
    relative = str(p.relative_to(ROOT))
    if relative.startswith('web/pages/api/'):
        kind = ('next_api_export' if re.search(r'\bexport\s+default\b', s) else
                'python_script_not_next_route' if p.suffix == '.py' else 'helper_no_default_export')
    else:
        kind = 'python_handler_module' if re.search(r'@(?:app|bp)\.(?:route|get|post)|class\s+handler\b|def\s+handler\b', s) else 'python_helper_or_entry'
    row = {'path': str(p.relative_to(ROOT)), 'sha256': hashlib.sha256(s.encode()).hexdigest(),
           'kind': kind, 'lines': len(s.splitlines()), 'guards': ';'.join(sorted(set(GUARDS.findall(s)))),
           'methods': ';'.join(sorted(set(re.findall(r'[\"\'](GET|POST|PUT|PATCH|DELETE|OPTIONS|HEAD)[\"\']', s)))),
           'review': 'pattern triage only; manual coverage recorded separately'}
    for key, pattern in SIGNALS.items():
        row[key] = ';'.join(str(i) for i, line in enumerate(s.splitlines(), 1) if re.search(pattern, line))
    routes.append(row)
write_csv('route-inventory.csv', routes, list(routes[0]))

migrations = []
for p in sorted((ROOT / 'supabase/migrations').glob('*.sql')):
    s = p.read_text()
    migrations.append({'path': str(p.relative_to(ROOT)), 'sha256': hashlib.sha256(s.encode()).hexdigest(),
                       'lines': len(s.splitlines()),
                       'rls_enables': len(re.findall(r'enable\s+row\s+level\s+security', s, re.I)),
                       'policies': len(re.findall(r'create\s+policy', s, re.I)),
                       'security_definer': len(re.findall(r'security\s+definer', s, re.I)),
                       'revokes': len(re.findall(r'\brevoke\b', s, re.I)),
                       'review': 'pattern triage only; manual coverage recorded separately'})
write_csv('migration-inventory.csv', migrations, list(migrations[0]))
state = {'branch': subprocess.check_output(['git', 'branch', '--show-current'], cwd=ROOT, text=True).strip(),
         'head': subprocess.check_output(['git', 'rev-parse', 'HEAD'], cwd=ROOT, text=True).strip(),
         'captured_at_utc': datetime.now(timezone.utc).isoformat(),
         'api_directory_source_files': len(routes), 'api_source_kinds': dict(Counter(r['kind'] for r in routes)),
         'supported_migrations': len(migrations),
         'route_guard_counts': dict(Counter(g for r in routes for g in r['guards'].split(';') if g)),
         'note': 'Static indicators are triage, not proof of protection or vulnerability.'}
(OUT / 'inventory-summary.json').write_text(json.dumps(state, indent=2) + '\n')
print(json.dumps(state, indent=2))
