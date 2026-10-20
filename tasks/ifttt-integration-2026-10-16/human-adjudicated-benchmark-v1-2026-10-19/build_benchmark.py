"""Create-only adjudicated development benchmark and UNEXECUTED comparison plan.

Reads retained sources/annotations and the budget ledger in read-only mode.
No HTTP, provider client, credential access or ledger mutation.
"""
import hashlib
import json
import sqlite3
from collections import Counter
from datetime import datetime, timezone
from fractions import Fraction
from pathlib import Path

OUT = Path(__file__).resolve().parent
BASE = OUT.parent
ROOT = BASE.parents[1]
PACKET = BASE / 'human-grading-packet-2026-10-19'
BUDGET = BASE / 'comparison-retry-execution-2026-10-19/aggregate-budget.sqlite'


def sha(data):
    return hashlib.sha256(data).hexdigest()


def canonical(value):
    return json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(',', ':'))


def write(name, value):
    with (OUT / name).open('x', encoding='utf-8', newline='') as f:
        f.write(value if isinstance(value, str) else json.dumps(value, ensure_ascii=False, indent=2) + '\n')


frozen = {str(f.relative_to(ROOT)): sha(f.read_bytes()) for f in PACKET.iterdir() if f.is_file()}
for d in sorted((PACKET / 'annotations').iterdir()):
    for f in d.iterdir():
        if f.is_file():
            frozen[str(f.relative_to(ROOT))] = sha(f.read_bytes())
packet_manifest = json.loads((PACKET / 'manifest.json').read_text())
packet_hash = packet_manifest['packet_sha256']
assert packet_hash == '55d2c5b3b9b3b09910928c2e801d26f6305d12316d82efeefbbfe046e5c131dd'
for name, digest in packet_manifest['files'].items():
    assert sha((PACKET / name).read_bytes()) == digest, name
for d in sorted((PACKET / 'annotations').iterdir()):
    receipt = json.loads((d / 'receipt.json').read_text())
    for name, digest in receipt['files'].items():
        assert sha((d / name).read_bytes()) == digest, name
sources = json.loads((PACKET / 'retained-source-records.json').read_text())
by_record = {r['sample_record_id']: r for g in sources for r in g['records']}
groups = []
for g in sources:
    groups.append({
        'sample_id': g['sample_id'], 'source_records': [r['sample_record_id'] for r in g['records']],
        'owner_annotation_records': ['0001-owner-S01-S03' if int(g['sample_id'][1:]) <= 3 else '0002-owner-S04-S06' if int(g['sample_id'][1:]) <= 6 else '0003-owner-S07-S10'],
        'observed_source_claims': [], 'hockey_parsing_conventions': [], 'analyst_inferences': [],
        'context_binding_prerequisites': [], 'independent_world_truth': None,
        'owner_publication_readiness': None, 'production_publishable': None,
    })
by_group = {g['sample_id']: g for g in groups}


def evidence(record_id, quote):
    text = by_record[record_id]['text']
    assert text.count(quote) == 1, (record_id, quote)
    start = text.index(quote)
    return {'record_id': record_id, 'quote': quote,
            'utf16_start': len(text[:start].encode('utf-16-le')) // 2,
            'utf16_end': len(text[:start + len(quote)].encode('utf-16-le')) // 2}


def fact(group, record, subject, event, value, quote, *, modality='reported', polarity='positive',
         timing=None, team=None, qualifiers=None, authority='assistant_adjudicated_from_source', **fields):
    rows = by_group[group]['observed_source_claims']
    row = {'id': group + '-C' + str(len(rows) + 1).zfill(2),
           'subject_literal': subject, 'event': event, 'value': value, 'polarity': polarity,
           'modality': modality, 'time_literal': timing, 'team_literal': team,
           'qualifiers': qualifiers or [], 'evidence': evidence(record, quote),
           'label_authority': authority, 'canonical_player_id': None, 'canonical_team_id': None,
           'canonical_game_id': None, 'canonical_season_id': None, **fields}
    rows.append(row)
    return row['id']


def convention(group, text, **fields):
    by_group[group]['hockey_parsing_conventions'].append({'rule': text, 'authority': 'owner_reviewed_assistant_adjudicated', **fields})


def inference(group, text, **fields):
    by_group[group]['analyst_inferences'].append({'text': text, 'explicit_source_fact': False, **fields})


fact('S01', 'S01', 'Ilya Sorokin', 'warmup_goaltender', 'leads_out_for_warmups',
     'Ilya Sorokin leads the Islanders out for warmups at Scotiabank Arena.', modality='observation', team='Islanders')
fact('S01', 'S01', 'Anthony Stolarz', 'warmup_goaltender', 'for_Leafs_in_warmup_context',
     'Anthony Stolarz for the Leafs.', modality='observation', team='Leafs',
     qualifiers=['Elliptical continuation of the preceding warmup sentence; retain full post context.'])
convention('S01', 'The owner classifies both qualifying warmup reports as confirmed starters. Preserve the warmup evidence basis; 100% is this category, never a calibrated probability.',
           semantic_projection={'category': 'confirmed_starter', 'subjects': ['Ilya Sorokin', 'Anthony Stolarz']})
by_group['S01']['context_binding_prerequisites'] += ['Canonical roster/team identities and the actual game remain unverified. Owner city/team expansions are supplied context, not independent verification.']

fact('S02', 'S02', 'Sanderson', 'practice_attendance', 'skated_before_main_practice',
     "Sanderson skated before main practice today but didn't join his teammates.", modality='observation', timing='today')
fact('S02', 'S02', 'Sanderson', 'practice_attendance', 'did_not_join_teammates',
     "Sanderson skated before main practice today but didn't join his teammates.", modality='observation', polarity='negative', timing='today')
fact('S02', 'S02', 'Sanderson', 'availability', 'organization_hopeful_he_will_play',
     'org is hopeful he will play this weekend.', modality='tentative', timing='this weekend',
     qualifiers=['Hope is not selection or medical clearance.', 'Subject uses the retained preceding Sanderson sentence, not an isolated pronoun.'])
fact('S02', 'S02', 'Burakovsky', 'return_availability', 'not_close_to_returning',
     "Burakovsky isn't close to returning (upper body).", polarity='negative',
     qualifiers=['upper body; retain the injury-related return context'])
fact('S02', 'S02', 'Foegele', 'practice_role', 'first_line_rushes',
     'Foegele took rushes on the 1st line for second consecutive day.', modality='observation',
     timing='second consecutive day')
fact('S02', 'S02', 'Foegele', 'availability', 'no_decision',
     'No decision has been made on his availability.', modality='unresolved',
     qualifiers=['Subject uses the preceding Foegele sentence; first-line practice is not game selection.'])
convention('S02', 'Owner questionable/potential-to-play is an availability category for Foegele; retain the explicit no-decision state and practice observation separately.')
inference('S02', 'Sanderson unlikely to return in the next 1–2 games.',
          authority='owner_estimate; approved_as_analyst_inference', expected_source_extraction=False,
          mandatory_context='The organization is also hopeful he will play this weekend.')
inference('S02', 'Sanderson still injured is owner-supplied health context; the supplied sentence explicitly establishes skating/absence and hope, not a diagnosed injury.',
          authority='owner_supplied_context', independently_verified=False, expected_source_extraction=False)
by_group['S02']['context_binding_prerequisites'] += ['Full-name expansions Jake/Andre/Warren are owner supplied. No source-time roster IDs, game count or confirmed return date is verified.']

fact('S03', 'S03', 'Leevi Meriläinen', 'goalie_start', 'will_start',
     'Leevi Meriläinen leads the #Canucks into the ice Saturday in Newark. He’ll get the start @ Devils.',
     timing='Saturday', team='#Canucks', qualifiers=['opponent literal: Devils; place literal: Newark'])
convention('S03', 'Explicit will-get-the-start supports the owner confirmed-starter category; 100% is categorical, not calibrated probability.')
by_group['S03']['context_binding_prerequisites'] += ['Vancouver is an owner-supplied team expansion; canonical player/team/game identities are not independently verified.']

for unit, names, line in [
    (1, ['Cagnoni', 'Celebrini', 'Smith', 'Chernyshov', 'Wennberg'], 'PP1: Cagnoni-Celebrini-Smith-Chernyshov-Wennberg '),
    (2, ['Orlov', 'Misa', 'Stenberg', 'Toffoli', 'Marchment'], 'PP2: Orlov-Misa-Stenberg-Toffoli-Marchment'),
]:
    for name in names:
        fact('S04', 'S04', name, 'pp_group_membership', 'PP' + str(unit), line,
             modality='observation', timing='same as yesterday', team='#SJSharks',
             qualifiers=['Observed/practice grouping; do not promote to a permanent role or confirmed game lineup.'])
fact('S04', 'S04', 'Misa', 'practice_role', 'some_net_front',
     'see Misa doing some net front, which he did last year...', modality='observation',
     qualifiers=['some; historical comparison last year; not permanent assignment'])
convention('S04', 'Owner confirmed practice lines means the reported practice PP groups, not confirmed game selection. Misa net-front remains a specific observed role within PP2.')
by_group['S04']['context_binding_prerequisites'] += ['No exact practice date, canonical player roster, game, PP positional slots or eligibility is authenticated from this post alone.']

fact('S05', 'S05A', 'Joonas Korpisalo', 'injury_availability', 'out',
     'Joonas Korpisalo (lower body) is out 4 weeks from today.', polarity='negative',
     timing='4 weeks from today', qualifiers=['lower body', 'No at-least strengthening or until-next-update endpoint.'])
fact('S05', 'S05A', 'Joe Veleno', 'injury_availability', 'out',
     'Joe Veleno (lower body) is out 3-3.5 months.', polarity='negative', timing='3-3.5 months', qualifiers=['lower body'])
fact('S05', 'S05B', 'Igor Shesterkin', 'injury_availability', 'out',
     'Igor Shesterkin will be out for the rest of the season with his lower body injury.',
     polarity='negative', timing='rest of the season', qualifiers=['lower body injury', 'Not a retroactive absence for the entire season.'])
inference('S05', 'Owner season label 2026-27 is contextual identification, not explicit source wording or an independently verified canonical season.',
          authority='owner_supplied_context', expected_source_extraction=False)
by_group['S05']['context_binding_prerequisites'] += ['Do not invent an exact return date, season ID, team, game or medical clearance. The publication clock anchors reported wording; it does not verify world truth.']

fact('S06', 'S06', 'Podkolzin', 'pp_replacement', 'takes_RNH_spot_on_first_unit',
     'Podkolzin will take RNH’s spot on the first unit powerplay… via Babcock.',
     qualifiers=['outgoing subject literal: RNH', 'first unit explicit', 'via Babcock source attribution'],
     related_subject_literal='RNH')
convention('S06', 'One replacement relation links incoming Podkolzin to outgoing RNH on PP1. Paired in/out projections are one update, not independent double credit.')
inference('S06', 'Vasily Podkolzin and Ryan Nugent Hopkins are human-supplied name expansions, not independent canonical identity validation.',
          authority='owner_supplied_context', expected_source_extraction=False)
by_group['S06']['context_binding_prerequisites'] += ['The exact previous PP positional slot requires a retained prior lineup. Source-attributed replacement support is product intent only; no implementation or dispatch is authorized.']

fact('S07', 'S07', 'Pierre-Luc Dubois', 'availability', 'too_early_to_tell_if_will_suit_up',
     'Carbery said it’s too early to tell whether Pierre-Luc Dubois will suit up tomorrow.',
     modality='unresolved', timing='tomorrow', qualifiers=['reported by Carbery; neither IN nor OUT is established'])
fact('S07', 'S07', 'Matt Roy', 'practice_attendance', 'skated_again',
     'Matt Roy skated again today and remains day-to-day.', modality='observation', timing='today')
fact('S07', 'S07', 'Matt Roy', 'injury_status', 'day_to_day',
     'Matt Roy skated again today and remains day-to-day.', modality='unresolved',
     qualifiers=['attendance is distinct from recovery, clearance and selection'])
fact('S07', 'S07', 'unspecified team', 'possible_recall_need', 'monitoring_if_needed',
     'Team monitoring if it needs a recall', modality='conditional',
     qualifiers=['team-only statement; not a completed recall or a named recalled player'])
convention('S07', 'Owner questionable for PLD preserves unresolved availability. DTD denotes the reported day-to-day injury status; it is not a specific diagnosed injury or game decision.')
by_group['S07']['context_binding_prerequisites'] += ['The source does not name the team. Do not infer Capitals identity or a game/recall transaction from names alone.']

forward_rows = [
    ['Carrier', 'Aho', 'Svechnikov'], ['Hall', 'Stankoven', 'Blake'],
    ['Ehlers', 'Staal', 'Martinook'], ['Robinson', 'Jankowski', 'Kotkaniemi'],
]
defense_rows = [['Slavin', 'Chatfield'], ['Miller', 'Walker'], ['Gostisbehere', 'Reilly']]
for index, names in enumerate(forward_rows + defense_rows, 1):
    quote = ' - '.join(names)
    for name in names:
        fact('S08', 'S08', name, 'lineup_row_membership', quote, quote,
             modality='listing', timing='tonight', team='#Canes', source_row_ordinal=index,
             qualifiers=['Source row membership; position/line numbering projection is a separate hockey convention.'])
fact('S08', 'S08', 'Bussi', 'lineup_name_listing', 'listed_after_skater_rows',
     'Bussi pic.twitter.com/iVLdaOV5Ir', modality='listing', timing='tonight', team='#Canes',
     qualifiers=['opponent literal: Blackhawks; no explicit starter confirmation in the supplied text'])
convention('S08', 'Rows 1–4 can be read as lines 1–4 with left-to-right LW/C/RW, rows 5–7 as pairs 1–3 with LD/RD. This is a parsing convention, not verified player eligibility.',
           forward_rows=forward_rows, defense_rows=defense_rows)
convention('S08', 'The owner projected-goalie category for Bussi remains projected. A one-hour clock threshold alone never promotes it to confirmed; require explicit starter or qualifying warmup evidence.',
           confirmation_rule={'timing_alone_sufficient': False, 'category_from_current_input': 'projected',
                              'new_evidence_required_for_confirmation': ['explicit_starter_report', 'qualifying_warmup_evidence']})
inference('S08', 'The owner one-hour cutoff is a proposed product policy; it is not evidence establishing confirmation.',
          authority='owner_product_rule_reclassified_by_approved_distinction', adopted_for_confirmation=False)
by_group['S08']['context_binding_prerequisites'] += ['No game start clock or date/game binding is supplied. No canonical player eligibility, goalie confirmation or independent Carolina identity verification is established.']

fact('S09', 'S09', 'Carter Hart', 'goalie_practice_observation', 'first_goaltender_off_ice',
     'Carter Hart is the first goaltender off the ice.', modality='observation')
convention('S09', 'First-off supports a projected-start category, with the observation basis retained. It does not support a confirmed-start category.',
           semantic_projection={'category': 'projected_starter', 'confirmed': False, 'game_binding_verified': False})
inference('S09', 'Vegas Golden Knights team membership and next-game target were human supplied; neither appears in the source.',
          authority='owner_supplied_context', expected_source_extraction=False)
by_group['S09']['context_binding_prerequisites'] += ['Source-time roster and schedule evidence is required before binding Vegas or the next game.']

fact('S10', 'S10A', 'Olofsson', 'reported_drill_reps', 'PP1_reps_with_Marner_up_top',
     'Might be much ado about nothing, but Olofsson is taking PP1 reps with Marner up top.',
     modality='tentative', qualifiers=['Might be much ado about nothing; retain predecessor as immutable evidence.'], related_subject_literal='Marner')
fact('S10', 'S10B', 'the drill referenced in S10A', 'clarification', '5_on_3_drill',
     'This was a 5-on-3 drill. At ease.', qualifiers=['B quotes A according to the retained browser record.'])
convention('S10', 'Final state is no regular-PP change. Retain the correction relationship and retract/supersede any regular-PP proposal derived from A; do not erase A or B.',
           final_state={'regular_pp_update': False, 'retain_both_sources': True, 'retract_or_supersede_A_regular_PP_proposal': True})
by_group['S10']['context_binding_prerequisites'] += ['No actual prior action is asserted. Retraction is a benchmark state transition, not authorization for live compensation.']

counts = {g['sample_id']: len(g['observed_source_claims']) for g in groups}
assert sum(counts.values()) == 50, counts
approval = {
    'parent_thread_id': '01a15411-3560-7632-8d31-1dd2447ba00e',
    'assistant_message_id': 'Sentinel_7dd4babe4f0c8191aed1034811af4af5',
    'assistant_text': 'That completes the ten groups. Two distinctions matter before we freeze the grading:\n\n- S08: the one-hour cutoff is a proposed product rule, not proof of confirmation. I recommend timing alone never promotes “projected” to “confirmed”; require an explicit starter report or qualifying warmup evidence. Ordered lineup columns can map to positions, but that is a parsing convention, not verified player eligibility.\n- S09: “first off the ice” supports a projected start. Vegas and “next game” need roster/schedule context because neither appears in the text.\n\nFor S10, no regular-PP change is the right outcome. But we should retain the correction and retract any proposal created from post A, rather than discard the whole exchange.\n\nMay I finalize the benchmark with those distinctions, keep Sanderson’s 1–2-game estimate as analyst inference, and apply the duration/season wording corrections from the previous batch?',
    'owner_message_id': 'Sentinel_784ced1e3bdc819187f41adb00ce063c',
    'owner_text': 'Yes, I like it.',
    'scope': 'Finalize source-fidelity benchmark and these distinctions; not authorization for a paid run, implementation, publication or production change.',
}
write('approval-evidence.json', approval)
benchmark = {
    'version': 'human-reviewed-assistant-adjudicated-development-v1', 'status': 'frozen',
    'packet_sha256': packet_hash, 'approval_evidence': 'approval-evidence.json',
    'label_provenance': 'Human reviewed ten source groups. Assistant supplied explicit source-unit inventory/evidence and applied approved distinctions. This does not mean the owner independently graded every derived field.',
    'split': 'previously_exposed_historical_development', 'untouched_holdout': False,
    'groups_count': 10, 'source_record_count': 12, 'source_claim_unit_count': 50,
    'claim_counts': counts, 'groups': groups,
    'source_records_file': 'evaluation-inputs.json',
    'global_masks': {'canonical_ids': 'ungraded', 'independent_world_truth': 'ungraded', 'owner_publication_readiness': 'ungraded', 'production_delivery': 'ungraded'},
    'calibrated_starter_probability': None,
    'source_coverage_limit': 'Purposeful small historical sample; no authentic future accuracy, world truth, complete media/thread evidence or production result claimed.',
}
write('benchmark.json', benchmark)
evaluation_inputs = []
for g in sources:
    evaluation_inputs.append({
        'sample_id': g['sample_id'],
        'records': [{'record_id': r['sample_record_id'], 'original_id': r['original_id'],
                     'text': r['text'], 'text_sha256': r['text_sha256'], 'author': r['author'],
                     'url': r['url'], 'published_at': r['publication'], 'publication_basis': r['publication_basis'],
                     'received_at': r['receipt'], 'receipt_basis': r['receipt_basis']} for r in g['records']],
        'retained_relations': [{'from': 'S10B', 'relation': 'quotes', 'to': 'S10A'}] if g['sample_id'] == 'S10' else [],
        'verified_external_context': [],
    })
write('evaluation-inputs.json', evaluation_inputs)
write('scoring-policy.json', {
    'version': 'matched-denominator-source-fidelity-v1',
    'denominators': {'groups': 10, 'source_records': 12, 'source_units': 50, 'by_group': counts},
    'rules': [
        'All four arms share exact group inputs, context, field masks and 50 source-unit denominator; preserve missing groups/units on refusal, schema error, overflow, budget stop or unsupported producer shape. Provider inputs contain sources/context/proposals only, never benchmark answers or raw owner annotations.',
        'Match by literal subject/relationship, predicate, state, modality, time/qualifiers and source/evidence. Freeze deterministic normalizations and composite-event matching before a run. Do not use string similarity or a paid judge to award semantic credit.',
        'A source row with multiple players may be expanded only by a frozen lossless projection; do not double count a PP replacement relation or duplicate relay.',
        'Observed evidence and approved hockey-category projections are separate score columns. A confirmed/projected projection must retain its qualifying evidence; do not treat source-independent inference as an observed fact.',
        'Count omitted facts, wrong predicates/subjects and boundary/schema/span failures separately from unsupported additions and strengthened certainty/duration.',
        'Report uncertainty/negation/conditions, injury causes, literal durations and source attribution retention. Canonical IDs/world truth are masked; unsupported asserted external bindings are counted separately as unproved additions, not validated false world facts.',
        'Report S10 predecessor evidence preservation, correction relation and final no-regular-PP/retraction state separately; no credit for deleting the exchange.',
        'Report raw model extraction and explicitly quote-aligned output separately. Exact-quote realignment may change anchors only, not meaning, uncertainty or fields.',
        'Decisions uses one whole-set source-support question per producer/group, threshold 0.95, holding the set on low/unknown/refusal. Empty sets use relevance, never vacuous support. It cannot invent missing claims, clear preexisting holds, certify identity or repair prose.',
        'Compute extraction TP/FP/FN on raw proposals and proposal precision/recall after held suppression separately. Withheld correct source claims remain extraction credit, but not usable/published updates.',
        'Always show source-supported, held, locally eligible and actually published separately. Owner publication/world-truth fields remain ungraded; actual publication is not performed. False-release/hold tests use explicit protocol prerequisites, not fabricated human readiness labels.',
        'Report per-group and micro totals; macro averaging across ten family groups prevents 19 lineup units from dominating. Do not present forty arm executions as forty independent examples.',
        'Report billed tokens including reasoning/cache details, usage-priced ceiling and actual HTTP latency per real call; local parser/normalization latency separately. Shared extraction charged once; reused responses get no new-call latency or new-charge attribution.',
    ],
    'world_truth_and_publication_scoring': None,
    'benchmark_peeking': 'Known development exposure. Freeze producer prompts/versions before scored execution; no answer-driven tuning, retries or selective reruns during it.',
    'implementation_status': 'Policy frozen; full ten-group multi-record projector and deterministic matcher are offline preflight work, not yet implemented or independently reviewed.',
})

budget_before = sha(BUDGET.read_bytes())
assert budget_before == '8b9574da4b587e756cb177360b97cb7af6d410e59686d0c5a2953d5bfa20db1a'
db = sqlite3.connect('file:' + str(BUDGET.resolve()) + '?mode=ro', uri=True)
experiment = db.execute('SELECT id,hash,cap,blocked FROM experiment').fetchone()
rows = db.execute('SELECT id,endpoint,reserve,state,actual FROM attempts ORDER BY rowid').fetchall()
exposure = db.execute("SELECT SUM(CASE WHEN state='settled' THEN actual ELSE MAX(reserve,COALESCE(actual,0)) END) FROM attempts").fetchone()[0]
db.close()
assert len(rows) == 5 and exposure == 254807878 and experiment[2] == 520000000
assert rows[0][0] == 'lindgren-0' and rows[0][3:] == ('uncertain', None) and rows[0][2] == 254394800
write('budget-readback.json', {
    'ledger_path': str(BUDGET.relative_to(ROOT)), 'sha256': budget_before,
    'read_mode': 'SQLite mode=ro; before/after file hash checked',
    'aggregate_cap_nano_usd': experiment[2], 'aggregate_exposure_nano_usd': exposure,
    'available_nano_usd': experiment[2] - exposure, 'blocked_state_preserved': experiment[3],
    'attempts': [dict(zip(['id', 'endpoint', 'reserve', 'state', 'actual'], r)) for r in rows],
})


def ceiling(value):
    return -(-value.numerator // value.denominator)


def cost(inputs, outputs, decisions_inputs):
    return ceiling((inputs * Fraction('.125') + outputs * Fraction('.50') + decisions_inputs * Fraction('.10')) * Fraction('1.10') * 1000)


# Full-context reservations include long-context/cache-write/regional premiums.
x_reserve = ceiling((922000 * Fraction('.25') + 8192 * Fraction('.75')) * Fraction('1.10') * 1000)
d_reserve = 231000000
assert x_reserve == 260308400
scenarios = [{'name': label, 'responses_input': i, 'responses_output': o, 'decisions_input': d,
              'estimated_nano_usd': cost(i, o, d)} for label, i, o, d in [
    ('lower illustrative', 15000, 12000, 60000),
    ('point illustrative', 20000, 20000, 80000),
    ('higher illustrative', 30000, 35000, 120000),
]]
pilot = json.loads((BASE / 'comparison-pilot-rules-2026-10-19/pilot-extraction-request.json').read_text())
saved_source = json.loads(pilot['input'])
assert all(saved_source['source_id'] != 'x:' + r['original_id'] for g in evaluation_inputs for r in g['records'])
producer_pins = {}
for relative in [
    'comparison-preflight-2026-10-19/rules-adapter.ts',
    'comparison-preflight-2026-10-19/claim-schema.json',
    'comparison-preflight-2026-10-19/extraction-prompt.txt',
    'comparison-source-anchoring-2026-10-19/anchors.py',
    'comparison-sequential-pilot-2026-10-19/pilot.py',
    'comparison-verifier-continuation-2026-10-19/verifier.py',
    'comparison-pilot-rules-2026-10-19/pilot-extraction-request.json',
]:
    producer_pins[str((BASE / relative).relative_to(ROOT))] = sha((BASE / relative).read_bytes())
plan = {
    'status': 'proposal_only_not_executable_or_authorized', 'model': 'gpt-6-luna',
    'arms': ['rules', 'rules+Decisions', 'Luna extraction', 'Luna extraction+Decisions'],
    'groups': [g['sample_id'] for g in evaluation_inputs], 'source_records': 12,
    'maximum_new_calls': {'responses': 10, 'decisions': 20, 'total_paid_provider_requests': 30,
                          'automatic_retries': 0, 'token_count_probes': 0, 'extra_judge_or_tuning_calls': 0},
    'order': 'One pass S01–S10: local rules, one extraction, one rules-set Decisions, one extraction-set Decisions; concurrency one. Whole paired group shares exact retained records/context, including both S05 posts and both S10 posts. No silent per-post fallback increasing call count.',
    'output': {'maximum_responses_output_including_reasoning': 8192, 'schema_refusal_or_incomplete': 'count and stop; never resend'},
    'reuse': {'eligible_saved_exact_matches': 0, 'scope': 'Accepted saved paid pilot outputs only; Lindgren family excluded and does not match any selected group.',
             'rule': 'Reuse requires exact complete input/context, prompt/schema, producer version/model settings, proposal bytes and postprocessing policy; Decisions also requires exact question and proposal set. Mark reused artifacts and old usage; never count original fee or latency twice.'},
    'budget': {'aggregate_cap_nano_usd': experiment[2], 'baseline_exposure_nano_usd': exposure,
               'original_unknown_reservation_nano_usd': rows[0][2], 'available_nano_usd': experiment[2] - exposure,
               'full_context_responses_reservation_nano_usd': x_reserve, 'one_question_decisions_reservation_nano_usd': d_reserve,
               'all_independent_maxima_nano_usd': 10 * x_reserve + 20 * d_reserve,
               'first_responses_peak_nano_usd': exposure + x_reserve,
               'remaining_charge_margin_before_full_context_responses_refuses_nano_usd': experiment[2] - exposure - x_reserve,
               'remaining_charge_margin_before_decisions_refuses_nano_usd': experiment[2] - exposure - d_reserve,
               'estimate_scenarios': scenarios,
               'estimate_not_enforcement': True,
               'enforcement_required': 'Reuse the persistent aggregate and transactionally reserve the next entire call ceiling against all settled ceilings plus every pending/unknown reservation. No state reset, no clearing the original unknown/block, no new independent $0.52 ledger. A reviewed scope-specific continuation is required. Record sent before HTTP; retain uncertain reservation and stop on uncertain outcome, TLS/HTTP/schema/refusal/truncation/missing usage/bound error. Settle only complete safely priced usage; no retries.',
               'full_pass_guaranteed': False,
               'limitation': 'Current full-context Responses reservation leaves only $0.004883722 of additional settled-charge margin before a later extraction refuses. Tight verified per-Responses input bounds are required for a credible ten-group completion at this cap. Decisions can retain its accepted whole-context bound, but a late stage may still refuse if prior charges exceed its margin. Do not replace a proved ceiling with estimated token counts.'},
    'pricing': {'verified_on': '2026-10-19', 'tier': 'standard/default', 'responses_short_input_or_cache_write_max_usd_per_million': '0.125', 'responses_short_output_usd_per_million': '0.50', 'decisions_input_usd_per_million': '0.10', 'regional_envelope': '1.10',
                'sources': ['https://developers.openai.com/api/docs/pricing', 'https://developers.openai.com/api/docs/models/gpt-6-luna', 'https://developers.openai.com/api/docs/guides/decisions#pricing-and-availability'],
                'ordinary_billing_assumptions': 'Existing accepted direct standard-tier/no-tools pricing assumptions only; account-specific premium/fee changes invalidate this budget.'},
    'offline_preflight_blockers': [
        'Freeze and verify a source-only multi-record input/projection and deterministic matched-field scorer for corrections, PP replacement and team-only claims. Current single-source pilot cannot be reused unchanged for all ten groups.',
        'Freeze the same available identity/context inputs for rules and Luna without leaking benchmark labels. Existing rules requires player context; no new authentic roster/schedule context is acquired by this task. Missing identity/slot/game fields must remain held and denominators retained.',
        'Prove tighter complete-input Responses reservations for exact sealed requests, or accept an explicitly partial pass; full-model maxima do not guarantee ten groups within the existing cap. No token counter request authorized here.',
        'Review a scope-specific continuation of the aggregate ledger without clearing original unknown state; freeze exact requests, prompts, schemas, source/consumer pins, no-network controls and all call limits before any proposed execution.',
    ],
    'non_offline_gate': 'Owner authorization of the exact source payloads/destination, bounded request set and aggregate budget is still required. This plan requests no execution.',
    'producer_reference_pins': producer_pins,
    'limitations': ['Ten purposively selected previously exposed development families, not independent random samples or future holdout.', 'Owner labels plus assistant source supplements do not authenticate identities, medical truth, full threads/media or actual game applicability.', 'Same Luna extracting/verifying is not independent corroboration. Whole-set support scores are uncalibrated and do not certify each field or repair omissions.', 'No production eligibility, delivery guarantee or calibrated accuracy conclusion; no prompt tuning against answers during the scored run.'],
}
write('run-plan.json', plan)
write('RUN-PROPOSAL.md', f"""# Proposed ten-group four-arm development comparison — NOT EXECUTED

Compare rules, rules + Decisions, Luna extraction and Luna + Decisions on the same 10 groups / 12 retained posts / 50 source units. This is the frozen human-reviewed, assistant-adjudicated development benchmark, with prior exposure; no untouched/future or independent factual-truth claim.

**Maximum: 30 paid requests: 10 Responses extractions + 20 one-question Decisions checks.** One sequential pass S01–S10; concurrency one; zero automatic retries, probes, judge calls or answer-driven prompt tuning. S05 and S10 each remain a two-post group; no silent 36-call per-post fallback. Saved Lindgren outputs do not match: **zero eligible saved reuse** in this accepted paid-pilot inventory. Future exact reuse must match full input/context, prompt/schema/settings, producer and postprocessing version; verifier reuse also matches proposal/question bytes. Label reuse and count original spend/latency only once.

Report raw extraction mistakes, unsupported additions, uncertainty/negation/duration preservation, approved hockey-category projections, and S10 correction/retraction separately. Keep source-supported, held, locally eligible and published counts separate. Owner publication readiness and independent truth remain ungraded. Keep 50 source units and all ten groups in denominators after errors, refusal, missing output or a budget stop; additionally show completed-pair coverage. Macro-average by family as well as micro totals. Do not count the 19 S08 lineup units or repeated relays as independent families.

Each Decisions call assesses its producer's whole proposal set at the frozen 0.95 threshold; low/unknown holds it, and an empty set receives a relevance question. It cannot fix extraction, clear existing holds or prove canonical identity. Report raw and exact-quote-aligned Luna output separately. Measure local parsing/normalization and actual HTTP latency separately; include all input/output/reasoning/cache usage and usage-priced charge ceilings. No paid judge.

## Cost and enforcement

Using current [official standard pricing](https://developers.openai.com/api/docs/pricing) and [Decisions pricing](https://developers.openai.com/api/docs/guides/decisions#pricing-and-availability), conservative short-context planning uses input/cache-write maximum $0.125/M and output $0.50/M for Responses, input-only $0.10/M for Decisions, plus a 10% envelope. Illustrative totals are **$0.0152625–$0.036575**, with a **$0.02255 point scenario** (20K extraction input, 20K extraction output and 80K verifier input tokens across the full run). These are explicit assumptions, not measured counts, reservations or an invoice.

The existing aggregate cap stays **$0.52**. Read-only verified exposure is **$0.254807878**, including the original **$0.2543948 unknown reservation** and $0.000413078 settled successful charge ceilings. Headroom is **$0.265192122**. The original blocked/unknown state stays intact; no ledger reset or independent new allowance.

At most 8192 extraction output tokens, including reasoning. Under full-model maxima, one extraction reserves **$0.2603084** and one one-question verifier **$0.231**. First-extraction peak would be **$0.515116278**. But later extractions refuse once newly settled charges exceed **$0.004883722**; verifiers refuse above **$0.034192122** of new prior charges. The independent sum of all maxima is $7.223084, so it cannot be pre-reserved or promised within $0.52. **Tighter verified complete-input extraction bounds are an offline preflight blocker to credible full completion.** A partial pass must stop before the first unaffordable call and retain all denominators; estimated short text is not a billing bound.

Before execution, the existing transactional aggregate mechanism needs a separately reviewed scope-specific continuation: reserve each next whole call before HTTP, mark it sent, settle only complete priced usage, retain uncertain reservations and stop on any uncertain/HTTP/schema/truncation/bound failure. No resend or automatic recovery mutation. This proposal does not claim the old single-family executor already supports or enforces the new pass.

## Remaining preflight and approval boundaries

1. Freeze/test the multi-record source-only formatter and deterministic matched scorer for all ten groups, including team-only claims, ordered rows, paired PP replacement and S10 predecessor/correction. Existing pilot is single-source; no run-ready adapter claim.
2. Freeze identical available identity/context for both producers without revealing benchmark answers. Missing source-time roster, schedule, prior slot and external IDs remain unverified/held. Do not silently use gold to build an advantage for one arm.
3. Establish the tighter input billing bounds, exact request/prompt/schema/version hashes, aggregate continuation and offline stop/mutation controls. Do not add token-count requests or enlarge 30 calls silently.
4. Obtain later owner authorization for the exact sealed payloads/destination and bounded execution. **Nothing in this plan executes or requests an API call now.** No prompt tuning or selective reruns during scored execution.

No provider request, secret read, production mutation, publication or new credential action occurred. Only official documentation was read. Budget/packet/raw annotation files remain byte-identical.
""")

rows_md = []
for g in groups:
    rows_md.append('| ' + g['sample_id'] + ' | ' + str(len(g['observed_source_claims'])) + ' | ' + {
        'S01': 'Warmup observations; owner confirmed-starter category, not numeric probability.',
        'S02': 'Skating/absence, weekend hope, return uncertainty, first-line practice; 1–2-game estimate stays analyst inference.',
        'S03': 'Explicit goalie-start report; canonical identity/game unverified.',
        'S04': 'Two practice PP groups and some Misa net-front; no permanent assignment.',
        'S05': 'Lower-body causes, reported 4 weeks / 3–3.5 months / rest of season; no at-least or entire-season strengthening.',
        'S06': 'Source-attributed first-unit replacement; exact old slot needs prior lineup.',
        'S07': 'Unresolved Dubois, Roy skating plus DTD, conditional team recall monitoring.',
        'S08': '18 row memberships and Bussi listing; positions are convention, projected stays projected without stronger evidence.',
        'S09': 'First-off observation supports projected category; Vegas/next game require context.',
        'S10': 'Tentative predecessor retained; 5-on-3 clarification means no regular-PP update, retract/supersede any A-derived proposal.',
    }[g['sample_id']] + ' |')
write('BENCHMARK.md', """# Human-reviewed, assistant-adjudicated development benchmark v1

Frozen from the ten-group packet and three append-only owner annotation records, with the owner's approval of the bundled distinctions (Sentinel_784ced1e3bdc819187f41adb00ce063c: “Yes, I like it.”). Original packet/raw answers/earlier provisional grades are not changed. The assistant created the explicit source-unit inventory/evidence and source supplements; not every field was independently owner graded.

**10 groups / 12 retained posts / 50 source units.** Observed source claims, hockey parsing conventions, analyst inference and contextual binding requirements are stored separately in benchmark.json. Canonical identity, independently verified world truth, owner publication readiness and actual production eligibility remain ungraded/null. No untouched holdout or authentic-future claim.

| Group | Source units | Adjudicated boundary |
| --- | ---: | --- |
""" + '\n'.join(rows_md) + """

Raw human statements remain available verbatim in the original annotations directory. Approved distinctions supersede their use as extraction expectations; they do not rewrite those answers. Source fidelity can be judged even while native applicability/publication is held. No model output has been rerun or rescored here.

The machine-readable scoring policy keeps common denominators and separate source/convention/error/hold columns. The run proposal remains unexecuted and lists concrete offline preflight blockers. The comparison cannot claim to establish an accurate factual hockey state or a production publishing decision from these sources alone.
""")
assert sha(BUDGET.read_bytes()) == budget_before
for name, digest in frozen.items():
    assert sha((ROOT / name).read_bytes()) == digest, name
for name, digest in producer_pins.items():
    assert sha((ROOT / name).read_bytes()) == digest, name
artifact_names = sorted(f.name for f in OUT.iterdir() if f.is_file())
write('manifest.json', {
    'version': 'human-adjudicated-benchmark-v1', 'created_at_utc': datetime.now(timezone.utc).isoformat(),
    'packet_sha256': packet_hash, 'benchmark_sha256': sha((OUT / 'benchmark.json').read_bytes()),
    'files': {name: sha((OUT / name).read_bytes()) for name in artifact_names},
    'preserved_prior_files': frozen, 'producer_reference_pins': producer_pins,
    'budget_ledger_sha256': budget_before, 'status': 'benchmark_frozen_run_proposed_not_executed',
    'provider_requests': 0, 'new_provider_spend_nano_usd': 0,
})
print(json.dumps({'status': 'created', 'groups': 10, 'source_records': 12, 'source_claims': 50,
                  'benchmark_sha256': sha((OUT / 'benchmark.json').read_bytes()),
                  'run_maximum_calls': 30, 'estimate_point_usd': scenarios[1]['estimated_nano_usd'] / 1e9,
                  'prior_files_preserved': len(frozen), 'ledger_unchanged': True}, indent=2))
