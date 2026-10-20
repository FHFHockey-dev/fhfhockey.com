"""Build a source-only human packet from three named, retained local records.

No model output, expected claim, parser label, network access or credential input.
The target files are create-only; later packet versions require a new directory.
"""
import hashlib
import json
from pathlib import Path
from urllib.parse import urlparse

ROOT = Path(__file__).resolve().parents[3]
OUT = Path(__file__).resolve().parent
FIXTURE = ROOT / 'web/lib/sources/fixtures/october11TroublesomeTweets.json'
BROWSER = ROOT / 'tasks/TASKS/lines-gdl-ingestion/audit/2026-10-01-browser-source-evidence.json'
SEEDS = ROOT / 'tasks/TASKS/lines-gdl-ingestion/audit/2026-10-01-classification-seeds.json'


def sha(data):
    return hashlib.sha256(data).hexdigest()


def write(name, text):
    with (OUT / name).open('x', encoding='utf-8', newline='') as f:
        f.write(text)


def dump(value):
    return json.dumps(value, ensure_ascii=False, indent=2) + '\n'


inputs = {str(p.relative_to(ROOT)): sha(p.read_bytes()) for p in (FIXTURE, BROWSER, SEEDS)}
assert inputs[str(FIXTURE.relative_to(ROOT))] == '77442752b800a46e74cbedc370871758c5dc9e4c2dadf4dcc826178cc6753f0c'
fixture = json.loads(FIXTURE.read_text())
browser = json.loads(BROWSER.read_text())
events = json.loads(SEEDS.read_text())['events']
events_by_id = {r['tweet_id']: r for r in events}


def from_fixture(index):
    row = fixture['records'][index]
    return {
        'text': row['text'], 'url': row['url'],
        'author': '@' + urlparse(row['url']).path.split('/')[1],
        'publication': row['publishedAt'],
        'publication_basis': 'Snowflake-derived from the retained matching original post ID; not a separately observed publication clock.',
        'receipt': row['receivedAt'], 'receipt_basis': 'Retained ingestion receipt for this post.',
        'source_path': str(FIXTURE.relative_to(ROOT)), 'pointer': '/records/' + str(index),
        'original_id': row['tweetId'], 'relay_ids': [],
    }


def from_browser(section, index):
    row = browser[section][index]
    url = row.get('originalUrl', row.get('url'))
    original_id = urlparse(url).path.split('/')[-1]
    relay_id = row.get('relayUrl', '').rsplit('/', 1)[-1]
    event = events_by_id.get(relay_id)
    match_basis = 'Retained relay ingestion receipt; original receipt time unknown.'
    if not event and section == 'originals':
        handle = row['author']
        exact_matches = [r for r in events if r['text'] == 'RT @' + handle + ': ' + row['text']]
        assert len(exact_matches) == 1
        event = exact_matches[0]
        relay_id = event['tweet_id']
        match_basis = 'Retained matching-text relay ingestion receipt; original receipt time unknown. The text join is not new original-to-relay authentication.'
    # An observed receipt is a relay receipt, never the original's publication.
    return {
        'text': row['text'], 'url': url,
        'author': '@' + row.get('author', urlparse(url).path.split('/')[1]),
        'publication': row['datetime'],
        'publication_basis': 'Retained browser observation of the original article time element; not newly checked.',
        'receipt': event['received_at'] if event else None,
        'receipt_basis': match_basis if event else 'Unknown.',
        'source_path': str(BROWSER.relative_to(ROOT)), 'pointer': '/' + section + '/' + str(index),
        'original_id': original_id, 'relay_ids': [relay_id] if relay_id else [],
        'receipt_pointer': '/events/' + str(events.index(event)) if event else None,
        'receipt_source_path': str(SEEDS.relative_to(ROOT)) if event else None,
        'relay_url': row.get('relayUrl') or (event['link_to_tweet'] if event else None),
    }


def chain(which):
    row = browser['correctionChain']
    earlier = which == 'A'
    key = 'quotedPredecessor' if earlier else 'original'
    url = row[key + 'Url']
    event = events_by_id.get(row['relayUrl'].rsplit('/', 1)[-1]) if not earlier else None
    return {
        'text': row[key + 'Text'], 'url': url, 'author': '@DannyWebster21',
        'publication': row[key + 'Datetime'],
        'publication_basis': 'Retained browser observation of the article time element; not newly checked.',
        'receipt': event['received_at'] if event else None,
        'receipt_basis': 'Retained relay ingestion receipt; original receipt time unknown.' if event else 'Unknown.',
        'source_path': str(BROWSER.relative_to(ROOT)), 'pointer': '/correctionChain/' + key + 'Text',
        'original_id': url.rsplit('/', 1)[-1],
        'relay_ids': [event['tweet_id']] if event else [],
        'receipt_pointer': '/events/' + str(events.index(event)) if event else None,
        'receipt_source_path': str(SEEDS.relative_to(ROOT)) if event else None,
        'relay_url': row['relayUrl'] if event else None,
    }


groups = [
    ('S01', [from_browser('originals', 1)], 'islanders-source-period', None),
    ('S02', [from_browser('originals', 0)], 'nichols-2105343573784928457', None),
    ('S03', [from_fixture(3)], 'drance-2108996072647573721', None),
    ('S04', [from_browser('additionalOriginals', 2)], 'sharks-2105364132128240008', None),
    ('S05', [from_fixture(4), from_fixture(5)], 'drosennhl-injury-reporting-window-2026-10-10', None),
    ('S06', [from_browser('additionalOriginals', 0)], 'edmonton-pp-source-period', None),
    ('S07', [from_fixture(2)], 'capitals-source-period', None),
    ('S08', [from_fixture(6)], 'carolina-source-period', None),
    ('S09', [from_browser('additionalOriginals', 6)], 'hart-2105000115090100612', None),
    ('S10', [chain('A'), chain('B')], 'webster-2104644558701351383-2104672698786013556',
     'The retained browser record shows post B quoting post A. Read both together.'),
]
assert len(groups) == 10 and sum(len(g[1]) for g in groups) == 12
assert len({g[2] for g in groups}) == len(groups)
ids = [r['original_id'] for _, rows, _, _ in groups for r in rows]
assert len(set(ids)) == len(ids)
assert '2108233461026726263' not in ids
assert all('Lindgren' not in r['text'] for _, rows, _, _ in groups for r in rows)

intro = """# TJ's blinded source-grading packet — v1

10 groups / 12 retained posts. Estimated grading time: 20–25 minutes. Posts grouped under one ID should be read together; duplicate relays are not extra evidence.

These are historical retained source copies, not a new future holdout. No model answers, expected labels or scores are included. The exposed Lindgren material is excluded. Links, handles and timestamps are reported as retained; nothing was fetched or reauthenticated for this packet. Source statements are not independently verified hockey facts. Images, linked media, missing threads and source-time roster/game records are not supplied. Mark missing context rather than filling it from memory.

For each S-ID, answer:

1. **Source meaning:** What distinct claims does the text support? For each, give the player/subject, team if stated (otherwise unknown), event or role, timing, certainty/negation, and an exact evidence quotation. Preserve qualifications. No character offsets or canonical IDs needed.
2. **Use as an update:** Which claims, if any, support an actionable update at the source time? Choose per claim: **supported update / hold for context / unclear or insufficient context / no actionable update**. Briefly name missing context.
3. **Separate judgments:** Real-world truth: **not checked / independently supported / contradicted / unclear**, with your basis if known. Publishability: **ready / hold / no update / unclear**, with a short reason. A faithful reading does not by itself prove truth or publication readiness.

No outside research is required. “Unknown,” “unclear / insufficient context,” and “no actionable update” are valid answers. You can answer some claims and hold others within one post. Do not infer a game, team, health state or role that the supplied material does not establish.

All times below include their original UTC offset. A relay receipt is not the original publication time. Text inside each block is copied exactly from its retained text field, including line breaks and qualifiers; attached media is not reproduced.
"""
parts = [intro]
public = []
private = []
for sample_id, rows, family_id, note in groups:
    parts.append('\n## ' + sample_id + '\n')
    if note:
        parts.append('\n' + note + '\n')
    members = []
    for index, row in enumerate(rows):
        label = sample_id if len(rows) == 1 else sample_id + chr(65 + index)
        parts.append('\n**' + label + ' — ' + row['author'] + '**  \n')
        parts.append('Original: [' + row['url'] + '](' + row['url'] + ')  \n')
        parts.append('Publication: `' + row['publication'] + '`  \n')
        parts.append(row['publication_basis'] + '  \n')
        parts.append('Receipt: ' + ('`' + row['receipt'] + '`' if row['receipt'] else '**unknown**') + '. ' + row['receipt_basis'] + '\n')
        if row.get('relay_url'):
            parts.append('Retained relay: [' + row['relay_url'] + '](' + row['relay_url'] + ')\n')
        parts.append('\n```text\n' + row['text'] + '\n```\n')
        members.append(dict(row, sample_record_id=label, text_sha256=sha(row['text'].encode('utf-8'))))
    public.append({'sample_id': sample_id, 'records': members, 'context_note': note})
    private.append({'sample_id': sample_id, 'family_id': family_id, 'split': 'historical-human-calibration-development-only', 'members': members})

template = """# Reply template

Copy once per S-ID (S01–S10); add rows/lines for additional claims. For S05 and S10 identify A or B in each evidence quotation.

S-ID:
- Claim 1: subject/player= ; team= ; event/role= ; timing= ; certainty/negation= ; exact source quote=""
- Use as an update: supported update / hold for context / unclear or insufficient context / no actionable update
- Missing context/reason:
- Real-world truth: not checked / independently supported / contradicted / unclear; basis if known=
- Publishability: ready / hold / no update / unclear; reason=
- Additional claims (repeat the claim fields), or no actionable update:

If time is short, send partial grades by S-ID. Do not consult parser/model outputs; these answers will be frozen before any later comparison.
"""
parts.append('\n' + template)
packet = ''.join(parts)
write('PACKET.md', packet)
write('REPLY-TEMPLATE.md', template)
write('retained-source-records.json', dump(public))

# Keep this lineage/exposure record separate from the delivered human packet.
# This is bookkeeping, not confidential storage and not an answer key.
private_map = {
    'packet_version': 'v1', 'packet_sha256': sha(packet.encode('utf-8')),
    'input_sha256': inputs,
    'no_answer_key': True,
    'exposure': 'Historical research/development sources, previously inspected. S05 and S07 also appeared in the prerequisite development recovery. None is certified untouched or a future holdout.',
    'allocation_rule': 'Every listed original, relay, edit, quotation predecessor, duplicate text and related reporting family remains development-only. Linked or newly discovered related variants must join the same allocation before any later split. No sample is simultaneously assigned to holdout.',
    'groups': private,
    'related_reserved_development': {
        'islanders-source-period': ['2105434001074962845', '2105434836500680857', '2105323604133179601', '2105375596687843639', '2105466097264656870', '2105466270070264224'],
        'edmonton-pp-source-period': ['2104971594632454155', '2104977788142850499'],
        'capitals-source-period': ['2108961406007570942', '2105316203292209353', '2105378254983205114'],
        'carolina-source-period': ['2109051291372777568', 'retained-corpus-G005040'],
    },
    'excluded_exposed': {
        'family': 'original-x-2108233461026726263',
        'original_url': 'https://x.com/SeattleKrakenPR/status/2108233461026726263',
        'rule': 'Exclude original, aliases, relays, edits, paraphrases and linked Lindgren reports from a later fresh subset; whole family is exposed development.',
        'conservative_adjacent_exclusion': '2108693031641551200 Seattle lineup caption omitted rather than rely on an unproved separation from the nearby exposed Seattle injury family.',
    },
    'limits': [
        'Family inventory is bounded to retained named records and known relationships, not a complete cross-corpus or live-source graph.',
        'Original publication and relay receipt clocks are distinct. Browser datetime observations are not X API authentication.',
        'The browser evidence has a broad original/relay verification limitation despite narrower captured-link observations; associations here report retained records, not a new authenticated cross-source proof.',
        'No source-time identity, team membership, schedule, player health, media content or historical truth independently authenticated.',
        'Selection is varied purposive development sampling, not a random or representative accuracy sample.',
    ],
}
write('private-source-map.json', dump(private_map))
write('CHECKPOINT.md', """# Blinded human grading packet checkpoint

Completed: 10 historical source-family groups / 12 exact retained post texts, source-only human packet and reply template. Private lineage/exposure bookkeeping is separate and contains no expected answers. Lindgren and the adjacent Seattle caption are excluded. All groups and known related originals/relays are development-only; no untouched future or fully reconstructed family-graph claim.

Owned paths: only this new directory. No application, prior evidence, budget ledger or source-input edits. No secret reads, HTTP/API/Library calls, spend, ingestion, production or deployment action.

Verification: verify_packet.py checks current input hashes, exact retained text at each recorded JSON pointer, exact relay receipt joins, unique originals/groups, omitted exposed IDs/text, source-only Markdown roundtrip, and frozen deliverable hashes. Results are recorded in verification.json.

Next dependency: TJ's independent grades. Freeze returned grades in a new artifact before any model comparison. No paid evaluation or production publication is authorized by this packet. Gaps: no independently validated world truth, unavailable media/threads, no authentic future set, and bounded family coverage.
""")
files = ['build_packet.py', 'verify_packet.py', 'PACKET.md', 'REPLY-TEMPLATE.md', 'retained-source-records.json', 'private-source-map.json', 'CHECKPOINT.md']
write('manifest.json', dump({
    'version': 'human-packet-v1', 'sample_groups': 10, 'post_records': 12,
    'packet_sha256': sha(packet.encode('utf-8')), 'source_inputs': inputs,
    'files': {name: sha((OUT / name).read_bytes()) for name in files},
    'external_calls': 0, 'provider_spend': 0,
}))
print(dump({'packet_sha256': sha(packet.encode('utf-8')), 'groups': len(groups), 'posts': len(ids)}))
