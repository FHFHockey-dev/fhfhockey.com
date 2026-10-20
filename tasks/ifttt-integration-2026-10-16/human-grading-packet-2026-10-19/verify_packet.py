"""Offline source fidelity, lineage and frozen-file checks, without rewriting outputs."""
import hashlib
import json
import re
from pathlib import Path

OUT = Path(__file__).resolve().parent
ROOT = OUT.parents[2]


def sha(data):
    return hashlib.sha256(data).hexdigest()


def pointer(document, path):
    result = document
    for piece in path.strip('/').split('/'):
        result = result[int(piece)] if isinstance(result, list) else result[piece]
    return result


manifest = json.loads((OUT / 'manifest.json').read_text())
checks = []
for path, digest in manifest['source_inputs'].items():
    assert sha((ROOT / path).read_bytes()) == digest, path
    checks.append('source hash: ' + path)
for path, digest in manifest['files'].items():
    assert sha((OUT / path).read_bytes()) == digest, path
    checks.append('frozen file: ' + path)
records = json.loads((OUT / 'retained-source-records.json').read_text())
mapping = json.loads((OUT / 'private-source-map.json').read_text())
packet = (OUT / 'PACKET.md').read_text()
assert sha(packet.encode()) == manifest['packet_sha256'] == mapping['packet_sha256']
all_records = [r for g in records for r in g['records']]
assert len(records) == 10 and len(all_records) == 12
assert len({g['sample_id'] for g in records}) == 10
assert len({g['family_id'] for g in mapping['groups']}) == 10
assert all(g['split'] == 'historical-human-calibration-development-only' for g in mapping['groups'])
for row in all_records:
    source = json.loads((ROOT / row['source_path']).read_text())
    value = pointer(source, row['pointer'])
    assert (value['text'] if isinstance(value, dict) else value) == row['text'], row['sample_record_id']
    assert sha(row['text'].encode()) == row['text_sha256']
    assert row['url'].endswith('/' + row['original_id'])
    assert row['author'] == '@' + row['url'].split('/')[3]
    assert row['publication'] in packet and row['url'] in packet
    if row.get('receipt_pointer'):
        receipt = pointer(json.loads((ROOT / row['receipt_source_path']).read_text()), row['receipt_pointer'])
        assert receipt['tweet_id'] in row['relay_ids']
        assert receipt['received_at'] == row['receipt']
        assert receipt['link_to_tweet'] == row['relay_url']
    elif row['source_path'].endswith('october11TroublesomeTweets.json'):
        assert value['publishedAt'] == row['publication'] and value['receivedAt'] == row['receipt']
    checks.append('exact source/provenance: ' + row['sample_record_id'])
assert re.findall(r'```text\n(.*?)\n```', packet, flags=re.S) == [r['text'] for r in all_records]
assert len({r['original_id'] for r in all_records}) == 12
assert all('Lindgren' not in r['text'] and r['original_id'] not in ['2108233461026726263', '2108693031641551200'] for r in all_records)
assert 'private-source-map' not in packet
assert 'provisional-source-labels' not in packet and 'probability' not in packet
assert 'unclear or insufficient context' in packet and 'no actionable update' in packet
checks.extend(['exact Markdown text blocks', 'unique grouped originals; no holdout allocation', 'exposed family and adjacent Seattle caption excluded', 'no answer mapping or model score in public packet'])
print(json.dumps({'status': 'passed', 'groups': 10, 'records': 12, 'checks': checks, 'packet_sha256': manifest['packet_sha256']}, indent=2))
