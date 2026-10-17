"""Check permitted document metadata and local links without modifying sources."""
from __future__ import annotations

import collections
import hashlib
import json
from pathlib import Path
import re
import urllib.parse

ROOT = Path('/Users/tim/Code/fhfhockey.com')
OUT = Path(__file__).resolve().parent
hashes = {row['path']: row for row in json.loads((OUT / 'permitted-source-hashes.json').read_text())}
documents = json.loads((OUT / 'document-inventory.json').read_text())
doc_paths = {row['path'] for row in documents}
links = []
root_names = {'tasks', 'web', 'docs', 'cms', 'functions', 'supabase', 'migrations', 'sql', 'tools', 'underlying-stats'}


def target_for(source: str, raw: str):
    raw = raw.strip().strip('<>')
    if not raw or raw.startswith(('#', 'http:', 'https:', 'mailto:', 'app:', 'skill:', 'plugin:')):
        return None
    value = urllib.parse.unquote(raw.split('#', 1)[0].split('?', 1)[0])
    value = re.sub(r':\d+(?::\d+)?$', '', value)
    if value.startswith(str(ROOT) + '/'):
        relative = value[len(str(ROOT)) + 1:]
        return {'target': relative, 'classification': 'absolute-repository-reference-present' if (ROOT / relative).exists() else 'absolute-repository-reference-absent'}
    if value.startswith('/Users/') or value.startswith('/tmp/') or value.startswith('/private/') or value.startswith('file:'):
        return {'target': value, 'classification': 'outside-checkout-local-reference-not-probed'}
    if value.startswith('/'):
        return {'target': value, 'classification': 'application-url-or-root-reference-not-filesystem-proven'}
    candidate = (ROOT / source).parent / value
    if not candidate.exists() and value.split('/')[0] in root_names:
        candidate = ROOT / value
    candidate = candidate.resolve(strict=False)
    try:
        relative = candidate.relative_to(ROOT).as_posix()
    except ValueError:
        return {'target': str(candidate), 'classification': 'outside-repository-not-probed'}
    return {'target': relative, 'classification': 'present' if candidate.exists() else 'absent-local-link'}


for row in documents:
    p = row['path']
    text = (ROOT / p).read_text()
    fenced = False
    for index, line in enumerate(text.splitlines(), 1):
        if line.lstrip().startswith(('```', '~~~')):
            fenced = not fenced
        if fenced:
            continue
        for match in re.finditer(r'(?<!!)\[[^\]\n]+\]\((<[^>]+>|[^\s)]+)(?:\s+"[^"\n]*")?\)', line):
            info = target_for(p, match.group(1))
            if info:
                links.append({'source': p, 'line': index, **info})

frozen = [json.loads(line) for line in (ROOT / 'docs/repository-audit/documentation-cleanup-ledger.jsonl').read_text().splitlines() if line]
revalidation = []
for old in frozen:
    p = old['path']
    current = ROOT / p
    digest = hashes.get(p, {}).get('sha256')
    old_digest = old.get('evidence', {}).get('baseline_sha256')
    revalidation.append({'path': p, 'prior_id': old.get('cleanup_id'), 'prior_status': old['status'],
                         'exists_now': current.exists(), 'bytes_now': current.stat().st_size if current.exists() else None,
                         'content_check': 'excluded-from-content-review' if digest is None else 'no-baseline-hash' if not old_digest else 'unchanged' if digest == old_digest else 'changed-since-frozen-audit',
                         'sha256': digest, 'prior_replacement': old.get('replacement_or_canonical_path'),
                         'current_markdown_inbound': [x for x in links if x['target'] == p]})

same_names = collections.defaultdict(list)
for row in documents:
    same_names[Path(row['path']).name].append(row)
collisions = [{'basename': k, 'paths': [x['path'] for x in v], 'byte_identical': len({x['sha256'] for x in v}) == 1} for k, v in same_names.items() if len(v) > 1]

prior_owner_decisions = json.loads(Path('/tmp/fhfh-repo-audit-20261013/deferred-document-owner-decisions.json').read_text())
owners = []
for row in prior_owner_decisions:
    doc = next((x for x in documents if x['path'] == row['path']), None)
    owners.append({**row, 'exists_now': (ROOT / row['path']).exists(), 'bytes_now': (ROOT / row['path']).stat().st_size,
                   'unchecked_markers_now': doc['unchecked_tasks'] if doc else None,
                   'status': 'retain; no new owner authorization found in this audit'})

summary = {'documents_scanned': len(documents), 'local_markdown_links': len(links),
           'link_classifications': dict(collections.Counter(x['classification'] for x in links)),
           'prior_ledger_records': len(revalidation),
           'prior_dispositions': dict(collections.Counter(x['prior_status'] for x in revalidation)),
           'current_prior_path_states': dict(collections.Counter(x['content_check'] for x in revalidation)),
           'missing_prior_paths': [x['path'] for x in revalidation if not x['exists_now']],
           'same_basename_groups': len(collisions), 'documents_with_unchecked_markers': sum(x['unchecked_tasks'] > 0 for x in documents),
           'limitations': ['This is local Markdown link discovery, not a parser for every prose reference, HTML link or runtime filesystem read.',
                          'External URLs and developer-local paths were not requested or opened.',
                          'Absent links may intentionally identify planned, retired, generated or historical targets; no absence proves obsolescence.',
                          'Unchecked markers include historical/template rows; no task completion or active status is inferred.']}
for name, value in [('document-links.json', links), ('prior-document-ledger-revalidation.json', revalidation), ('same-name-documents.json', collisions), ('held-document-decisions.json', owners), ('document-analysis-summary.json', summary)]:
    (OUT / name).write_text(json.dumps(value, indent=2) + '\n')
print(json.dumps(summary, indent=2))
