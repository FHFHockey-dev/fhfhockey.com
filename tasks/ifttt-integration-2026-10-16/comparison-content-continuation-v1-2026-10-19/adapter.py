"""Revised anchoring view only. Never reads benchmark labels or alters claims."""
import copy
import hashlib
import re
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
BASE = HERE.parent
sys.path.insert(0, str(BASE / 'comparison-adjudication-bridge-v1-2026-10-19'))
import bridge
p = bridge.p

VERSION = 'exact-subject-adjacent-parenthesis-v2'


def subject_parenthesis(source, claim):
    """Only the literal '<unique full subject><whitespace><exact (quote)>' form.

    No nearest-offset rule, fuzzy names, sentence guess, sibling output, desired
    truth, semantic value or numeric duration contributes to the positive proof.
    """
    p.require(claim['source_id'] == source['source_id'] and claim['source_author'] == source['author'], 'source identity mismatch')
    text, name, quote = source['text'], claim['player'], claim['evidence']['text']
    p.require(isinstance(name, str) and len(name.split()) >= 2 and text.count(name) == 1, 'unique literal full subject required')
    p.require(isinstance(quote, str) and re.fullmatch(r'\([^()\r\n]{1,80}\)', quote), 'not a bounded parenthetical descriptor')
    start = text.index(name); end = start + len(name)
    p.require(start == 0 or not (text[start-1].isalnum() or text[start-1] in "'-’"), 'subject boundary conflict')
    # Whitespace is only inspected between the exact subject and exact quote;
    # the quote itself is not normalized or expanded.
    match = re.match(r'\s+', text[end:])
    p.require(match is not None, 'descriptor must directly follow subject')
    position = end + match.end()
    p.require(text.startswith(quote, position), 'descriptor is not immediately subject-adjacent')
    candidate = copy.deepcopy(claim)
    candidate['evidence'] = {'start': len(text[:position].encode('utf-16-le')) // 2,
        'end': len(text[:position+len(quote)].encode('utf-16-le')) // 2, 'text': quote}
    p.require(not p.normalize(source, {'material': True, 'claims': [candidate], 'overflow': False})['errors'], 'strict revalidation failed')
    return candidate, {'policy': VERSION, 'source_text_sha256': hashlib.sha256(text.encode()).hexdigest(),
        'literal_subject': name, 'binding_quote': text[start:position+len(quote)],
        'original_evidence': copy.deepcopy(claim['evidence']), 'corrected_evidence': copy.deepcopy(candidate['evidence']),
        'fields_other_than_offsets_changed': False}


def normalize(envelope, body):
    original_hash = p.digest(body)
    revised = copy.deepcopy(body); audits = []; record_ids = [r['record_id'] for r in envelope['records']]
    if isinstance(revised, dict) and isinstance(revised.get('records'), list):
        for doc in revised['records']:
            if not isinstance(doc, dict) or doc.get('record_id') not in record_ids or set(doc) != {'record_id', 'material', 'overflow', 'claims'}: continue
            record = next(r for r in envelope['records'] if r['record_id'] == doc['record_id'])
            source = p.source(record)
            first = p.align_proposals(source, {k: doc[k] for k in ('material', 'overflow', 'claims')})
            doc.update(first['body'])
            for item in first['audit']:
                audit = dict(item, record_id=doc['record_id'], policy='unique-exact-quote-v1')
                if item['action'] == 'held' and item['reason'] == 'exact_quote_ambiguous':
                    try:
                        claim, proof = subject_parenthesis(source, doc['claims'][item['index']])
                        doc['claims'][item['index']] = claim
                        audit.update(action='reanchored', reason='exact_subject_adjacent_parenthetical', proof=proof)
                    except (ValueError, KeyError, TypeError):
                        audit['reason'] = 'repeated_quote_binding_unproved'
                audits.append(audit)
    normalized = p.normalize_family(envelope, revised)
    held = set(normalized['missing_records'])
    global_error = False
    for error in normalized['errors']:
        record = next((r for r in record_ids if error.startswith(r + ':')), None)
        if record: held.add(record)
        elif not error.startswith('revision:'): global_error = True
    if global_error: held.update(record_ids)
    eligible = {'claims': [c for c in normalized['claims'] if c['record_id'] not in held],
                'revisions': [r for r in normalized['revisions'] if r['from_record_id'] not in held and r['to_record_id'] not in held],
                'errors': []}
    p.require(p.digest(body) == original_hash, 'raw body mutated')
    return {'version': VERSION, 'original_body_unchanged': True,
            'revised_body': revised, 'normalization': normalized, 'verifier_set': eligible,
            'scored_record_ids': [r for r in record_ids if r not in held], 'held_record_ids': sorted(held),
            'anchor_audit': audits, 'content_held': bool(held or normalized['errors']),
            'assurance': 'Exact source anchoring only; no semantic, identity, game or publication proof.'}


def response_view(envelope, response):
    try:
        raw = p.parse_extraction(response)
        result = normalize(envelope, raw)
        result['raw_body'] = raw
        return result
    except (ValueError, KeyError, TypeError):
        return {'version': VERSION, 'raw_body': None, 'revised_body': None, 'content_held': True,
                'parse_status': 'content_unparseable_or_refused', 'anchor_audit': [],
                'held_record_ids': [r['record_id'] for r in envelope['records']], 'scored_record_ids': [],
                'verifier_set': {'claims': [], 'revisions': [], 'errors': []},
                'raw_response_preserved': True}
