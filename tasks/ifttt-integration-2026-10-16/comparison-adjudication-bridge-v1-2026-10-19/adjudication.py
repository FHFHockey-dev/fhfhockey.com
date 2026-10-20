"""Blinded source review, not a new semantic grader. No provider operations."""
import copy
import hashlib
import json
import math
import random
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
OLD = HERE.parent / 'comparison-offline-preflight-v1-2026-10-19'
sys.path.insert(0, str(OLD))
import preflight as p

CATEGORIES = ['duration_or_numeric_range', 'negation', 'uncertainty_or_condition',
              'subject_or_reference', 'role_or_eligibility', 'drill_context',
              'correction_or_retraction', 'unproved_context_binding', 'other']


def diagnostic_grade(group, normalized, **kwargs):
    return {'meaning': 'lexical_contract_diagnostic_only',
            'factual_quality_established': False, 'automatic_factual_winner': None,
            'legacy_diagnostic': p.grade_group(group, normalized, **kwargs),
            'source_adjudication': 'required_even_for_lexical_TP'}


def factual_winner(*args, **kwargs):
    raise ValueError('Automatic factual-quality ranking is prohibited; lexical scores are diagnostics only.')


def verifier_columns(review, *, human_supported=None):
    """A supplied human whole-set verdict, never a lexical-score derivative."""
    review = review or {'status': 'missing', 'probability': None}
    status = review.get('status', 'missing')
    probability = review.get('probability') if status == 'scored' else None
    valid = type(probability) in (int, float) and math.isfinite(probability) and 0 <= probability <= 1
    answer = probability >= .95 if valid else None
    if status == 'scored' and not valid: probability = None; status = 'invalid'
    if status == 'unknown': status = 'refused_or_unknown'
    return {'whole_set_status': status, 'probability_uncalibrated': probability,
            'threshold_supported': answer, 'human_source_supported_set': human_supported,
            'source_adjudicated_correctness': answer == human_supported if type(human_supported) is bool and answer is not None else None,
            'per_claim_confidence': None, 'independent_corroboration': False}


def blind_sheet(envelopes, bodies_by_arm, reviews, *, seed):
    arms = list(p.ARMS); random.Random(seed).shuffle(arms)
    codes = {arm: 'Arm-' + chr(65 + i) for i, arm in enumerate(arms)}
    rows, private = [], {'arm_mapping': codes, 'proposal_mapping': {}, 'raw_outputs': copy.deepcopy(bodies_by_arm)}
    for group_id, envelope in envelopes.items():
        seen = {}
        group_rows = []
        availability = {}
        for arm in p.ARMS:
            body = bodies_by_arm.get(arm, {}).get(group_id)
            availability[codes[arm]] = 'missing/not run' if body is None else 'retained output'
            if not isinstance(body, dict): continue
            # Show raw and aligned variants; do not hide invalid proposals just
            # because the normalizer rejects them. Never display lexical grades.
            variants = [('raw', copy.deepcopy(body))]
            aligned = p.normalize_family(envelope, body, aligned=True)
            if arm in ('extraction', 'extraction_decisions') and aligned['alignment_audit']:
                adjusted = copy.deepcopy(body)
                for doc in adjusted.get('records', []):
                    replacements = {c['id']: c for c in aligned['claims'] if c['record_id'] == doc.get('record_id')}
                    doc['claims'] = [{k: v for k, v in replacements[c['id']].items() if k != 'record_id'} if isinstance(c, dict) and c.get('id') in replacements else c for c in doc.get('claims', [])]
                variants.append(('aligned', adjusted))
            for variant, value in variants:
                items = []
                for doc in value.get('records', []):
                    for index, claim in enumerate(doc.get('claims', [])):
                        items.append(('claim', doc.get('record_id'), index, claim))
                for index, revision in enumerate(value.get('revisions', [])):
                    items.append(('revision', revision.get('to_record_id'), index, revision))
                for kind, record_id, index, item in items:
                    fields = copy.deepcopy(item)
                    original_id = fields.pop('id', None) if isinstance(fields, dict) else None
                    key = p.digest({'kind': kind, 'record_id': record_id, 'fields': fields})
                    if key not in seen:
                        neutral = group_id + '-P' + str(len(group_rows) + 1).zfill(3)
                        shown = {'proposal_id': neutral, 'kind': kind, 'record_id': record_id,
                                 'asserted_fields_exact': fields, 'appearances': [],
                                 'human_verdict': None, 'error_categories': [], 'source_quote': None, 'reason': None}
                        group_rows.append(shown); seen[key] = shown
                        private['proposal_mapping'][neutral] = []
                    shown = seen[key]
                    appearance = {'neutral_arm': codes[arm], 'variant': variant}
                    if appearance not in shown['appearances']: shown['appearances'].append(appearance)
                    private['proposal_mapping'][shown['proposal_id']].append({'arm': arm, 'variant': variant, 'original_id': original_id, 'record_id': record_id, 'index': index})
        rows.append({'group_id': group_id, 'full_source': copy.deepcopy(envelope),
                     'arm_output_availability': dict(sorted(availability.items())), 'proposals': group_rows,
                     'missing_source_updates': [], 'human_group_complete': False,
                     'whole_set_source_support': {codes[a]: None for a in p.ARMS}})
    public = {'version': 'blinded-source-adjudication-v1', 'groups': rows,
              'verdict_choices': ['equivalent_or_source_supported', 'factual_or_qualification_error', 'unresolved'],
              'error_categories': CATEGORIES, 'automatic_factual_winner': None,
              'lexical_scores_visible': False, 'benchmark_answers_visible': False}
    private['verifier_columns'] = {key: {arm: verifier_columns(reviews.get((key, arm))) for arm in ('rules_decisions', 'extraction_decisions')} for key in envelopes}
    return public, private


def render_sheet(public):
    parts = ['# Blinded source adjudication sheet\n\nRead PROTOCOL.md first. Review every proposal, including apparently exact matches. No model identities, lexical scores or benchmark answers are supplied. Missing arms remain missing.\n']
    for group in public['groups']:
        parts.append('\n## ' + group['group_id'] + '\n')
        for r in group['full_source']['records']:
            parts.append('\n**' + r['record_id'] + ' — ' + r['author'] + '**\n\n' + r['url'] + '\n\nPublication: ' + str(r['published_at']) + '; receipt: ' + str(r['received_at']) + '.\n\n```text\n' + r['text'] + '\n```\n')
        parts.append('\nAvailable context and retained relationships (unverified hints are not identity proof):\n\n```json\n' + json.dumps({'records': [{'record_id': r['record_id'], 'identity_hints': r['identity_hints']} for r in group['full_source']['records']], 'relations': group['full_source']['retained_relations'], 'context': group['full_source']['context']}, ensure_ascii=False, indent=2) + '\n```\n')
        parts.append('\nArm availability: ' + json.dumps(group['arm_output_availability']) + '\n')
        for row in group['proposals']:
            parts.append('\n### ' + row['proposal_id'] + '\n\n' + json.dumps(row['appearances']) + '\n\n```json\n' + json.dumps(row['asserted_fields_exact'], ensure_ascii=False, indent=2) + '\n```\n\nVerdict: ___; error categories: ___; exact source quotation: ___; reason/missing context: ___.\n')
        parts.append('\nMissing source-supported updates: ___. Whole-set source support per neutral arm: supported / unsupported / unresolved / missing. Group fully reviewed: yes / no.\n')
    return ''.join(parts)
