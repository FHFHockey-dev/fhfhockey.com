"""Offline source-only inventories; never loads env, credentials, or business data."""
import csv
import hashlib
import json
import re
import subprocess
from collections import Counter
from datetime import datetime, timezone
from pathlib import Path
from urllib.parse import urlsplit

ROOT = Path(__file__).resolve().parents[3]
OUT = Path(__file__).resolve().parent

def write_csv(name, rows, fields):
    with (OUT / name).open('w', newline='') as f:
        writer = csv.DictWriter(f, fieldnames=fields)
        writer.writeheader()
        writer.writerows(rows)

directories = [p for rel in ('web/pages', 'web/components', 'web/hooks', 'web/lib',
               'web/utils', 'web/contexts', 'web/context', 'web/providers',
               'functions/api', 'functions/lib', 'cms') if (p := ROOT / rel).exists()]
paths = subprocess.check_output(['rg', '--files', *map(str, directories)], text=True).splitlines()
paths = sorted(Path(p) for p in paths if Path(p).suffix in {'.ts', '.tsx', '.js', '.jsx', '.py'}
               and '/node_modules/' not in p and '/__tests__/' not in p
               and not re.search(r'\.(test|spec)\.', p) and not p.endswith('.d.ts')
               and 'database-generated' not in p)

env_patterns = [
    re.compile(r'process\.env\.([A-Z][A-Z0-9_]*)'),
    re.compile(r'process\.env\[[\"\']([A-Z][A-Z0-9_]*)[\"\']\]'),
    re.compile(r'os\.(?:getenv|environ\.get)\([\"\']([A-Z][A-Z0-9_]*)[\"\']'),
    re.compile(r'os\.environ\[[\"\']([A-Z][A-Z0-9_]*)[\"\']\]'),
]
env_rows, cron_rows, client_imports = [], [], []
for p in paths:
    s = p.read_text()
    rel = str(p.relative_to(ROOT))
    for i, line in enumerate(s.splitlines(), 1):
        names = {m.group(1) for pattern in env_patterns for m in pattern.finditer(line)}
        for name in sorted(names):
            env_rows.append({'path': rel, 'line': i, 'variable_name': name,
                'public_prefix': name.startswith('NEXT_PUBLIC_'),
                'sensitive_name_indicator': bool(re.search(r'SECRET|TOKEN|PASSWORD|SERVICE_ROLE|PRIVATE|DATABASE_URL|DB_URL', name)),
                'note': 'Name only; value and deployed exposure not inspected'})
        if re.search(r'from\s+[\"\'](?:lib/supabase/server|.*(?:/privateImportTransport|/integrations/.*/server))[\"\']', line):
            if rel.startswith(('web/components/', 'web/hooks/', 'web/contexts/', 'web/context/', 'web/providers/')):
                client_imports.append({'path':rel,'line':i,'indicator':'server module import in browser-oriented directory; manual review needed'})
    if rel.startswith('web/pages/api/'):
        for m in re.finditer(r'\bwithCronJobAudit\s*\(', s):
            after = s[m.end():m.end()+150]
            before = s[max(0,m.start()-80):m.start()]
            order = ('audit_outside_admin' if re.match(r'\s*adminOnly\s*\(', after) else
                     'admin_outside_audit' if re.search(r'adminOnly\s*\(\s*$', before) else
                     'manual_composition_review')
            cron_rows.append({'path':rel,'line':s.count('\n',0,m.start())+1,'composition':order})
write_csv('environment-variable-names.csv', env_rows, ['path','line','variable_name','public_prefix','sensitive_name_indicator','note'])
write_csv('cron-audit-order.csv', cron_rows, ['path','line','composition'])
write_csv('browser-server-import-indicators.csv', client_imports, ['path','line','indicator'])

lock_path = ROOT / 'web/package-lock.json'
lock_bytes = lock_path.read_bytes()
lock = json.loads(lock_bytes)
package_entries = [(name, value) for name, value in lock.get('packages', {}).items() if name]
url_hosts, sources = Counter(), Counter()
no_integrity = []
for name, value in package_entries:
    resolved = value.get('resolved', '')
    parsed = urlsplit(resolved)
    sources[parsed.scheme or ('link' if value.get('link') else 'absent')] += 1
    if parsed.hostname:
        url_hosts[parsed.hostname] += 1
    if resolved.startswith(('https://', 'http://')) and not value.get('integrity'):
        no_integrity.append(name)
tracked = subprocess.check_output(['git', 'ls-files', '*lock*', '*requirements*.txt', '*Pipfile*'], cwd=ROOT, text=True).splitlines()
lock_manifest_names = {'package-lock.json','npm-shrinkwrap.json','yarn.lock','pnpm-lock.yaml','Pipfile','Pipfile.lock','requirements.txt'}
lock_summary = {
    'captured_at_utc': datetime.now(timezone.utc).isoformat(),
    'path': 'web/package-lock.json', 'sha256': hashlib.sha256(lock_bytes).hexdigest(),
    'lockfileVersion': lock.get('lockfileVersion'),
    'package_entries_excluding_root': len(package_entries),
    'resolution_schemes':dict(sources), 'resolution_host_counts':dict(url_hosts),
    'http_archive_entries_without_integrity_count':len(no_integrity),
    'http_archive_entries_without_integrity_paths':no_integrity,
    'tracked_dependency_lock_or_constraint_files':[p for p in tracked if Path(p).name in lock_manifest_names],
    'vulnerability_matching':'BLOCKED: no successful current advisory query or offline advisory dataset',
    'network_requests_by_this_script':0,
}
(OUT / 'dependency-structure.json').write_text(json.dumps(lock_summary, indent=2)+'\n')
summary = {
    'source_files_scanned':len(paths), 'environment_name_occurrences':len(env_rows),
    'unique_environment_names':len({r['variable_name'] for r in env_rows}),
    'public_prefixed_sensitive_names':sorted({r['variable_name'] for r in env_rows if r['public_prefix'] and r['sensitive_name_indicator']}),
    'cron_audit_compositions':dict(Counter(r['composition'] for r in cron_rows)),
    'browser_server_import_indicators':len(client_imports),
    'note':'Pattern triage; absence of matches is not a bundled-client or deployed-state guarantee.'
}
(OUT / 'supplemental-summary.json').write_text(json.dumps(summary,indent=2)+'\n')
print(json.dumps({'source_summary':summary,'dependency_structure':lock_summary}, indent=2))
