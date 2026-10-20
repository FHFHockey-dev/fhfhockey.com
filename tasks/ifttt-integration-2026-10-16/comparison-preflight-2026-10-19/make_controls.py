"""Author synthetic labels first, then deliberately construct mock arm replies.

This is a software oracle generator, NEVER independent empirical model grading.
Names, roster IDs and source metadata below are invented test context.
"""
import copy
import json
from comparison import ROOT, FIELDS, digest, request_input

PLAYERS = [dict(playerId=i+1, fullName=name, lastName=name.split()[-1], teamId=99,
                position='G' if 'Snow' in name else 'C', aliases=[name.split()[-1]])
           for i, name in enumerate(['Arden Vale','Bex Lark','Cato Reed','Daro Snow','Elo Moss'])]


def fixture(number, text, definitions, *, material=True, missing_clock=False, relay=False, strata=()):
    sid = f'synthetic-{number:02}'
    source = dict(family_id=f'family-{number:02}', source_id=sid, author='TestReporter',
                  text=text, url=f'https://example.invalid/TestReporter/status/{number}',
                  published_at=None if missing_clock else f'2026-10-{number:02}T18:00:00Z',
                  received_at=f'2026-10-{number:02}T18:01:00Z',
                  attribution_status='unresolved_relay' if relay else 'original',
                  players=copy.deepcopy(PLAYERS), aliases=[f'invented-original-{number}'],
                  context={'kind':'synthetic_roster_only','independent_world_evidence':None})
    claims = []
    for i, definition in enumerate(definitions):
        values = {k: None for k in FIELDS}
        values.update(source_id=sid, source_author=source['author'], polarity='positive', certainty='asserted')
        definition = dict(definition)
        actionable = definition.pop('actionable', True)
        quote = definition.pop('quote', text)
        values.update(definition)
        start = len(text[:text.index(quote)].encode('utf-16-le'))//2
        evidence = dict(start=start, end=start+len(quote.encode('utf-16-le'))//2, text=quote)
        # No synthetic roster ID is a real canonical player-ID truth label.
        gradable = [k for k in FIELDS if k != 'player_id']
        claims.append(dict(id=f'gold-{number}-{i}', expected=values, gradable=gradable,
                           evidence=evidence, actionable=actionable, external_truth=None))
    labels = dict(provenance={'kind':'synthetic_software_control','author':'assistant-authored test oracle',
                              'human_adjudication':False,'empirical_ground_truth':False,
                              'established_before_mock_outputs':True},
                  source_hash=digest(request_input(source)), complete=True, material=material,
                  claims=claims, ungradable_reasons=['independent real-world identity/team/game/time context absent'])
    # Explicitly synthetic oracle-shaped replies; not paid/model results.
    mock_claims = [dict(id=f'x-{number}-{i}', **copy.deepcopy(c['expected']), evidence=copy.deepcopy(c['evidence']))
                   for i, c in enumerate(claims)]
    decisions = {c['id']:dict(supported=True, confidence=0.99, wording='direct_assertion') for c in mock_claims}
    return dict(source=source, labels=labels, strata=list(strata), mock_extraction=dict(material=material, claims=mock_claims, overflow=False),
                mock_decisions_extraction=decisions, mock_decisions_rules={})


def build():
    fs = [
        fixture(1, 'Tickets and sponsor specials tonight. Go Harbor!', [], material=False, strata=['no_update','negative']),
        fixture(2, 'Harbor: Arden Vale will not play tonight.', [dict(player='Arden Vale',team='Harbor',event='availability',value='out',polarity='negative',time='tonight')], strata=['injury','negation']),
        fixture(3, 'Arden Vale is a GTD tonight; if he cannot go, Bex Lark will play.', [
            dict(player='Arden Vale',event='availability',value='uncertain',certainty='tentative',time='tonight',actionable=False,quote='Arden Vale is a GTD tonight'),
            dict(player='Bex Lark',event='availability',value='available',certainty='conditional',time='tonight',condition='if Arden Vale cannot go',actionable=False,quote='if he cannot go, Bex Lark will play.')], strata=['abbreviation','conditional','multi_person']),
        fixture(4, 'Arden Vale and Bex Lark will not play tonight.', [dict(player=p,event='availability',value='out',polarity='negative',time='tonight') for p in ['Arden Vale','Bex Lark']], strata=['multi_person','shared_clause']),
        fixture(5, 'Correction: Bex Lark will play tonight. My earlier report that Bex Lark would miss the game is retracted.', [
            dict(player='Bex Lark',event='availability',value='available',time='tonight',quote='Correction: Bex Lark will play tonight.'),
            dict(player='Bex Lark',event='correction',value='earlier_out_report_retracted',time='tonight',actionable=False,quote='My earlier report that Bex Lark would miss the game is retracted.')], strata=['correction','retraction']),
        fixture(6, 'Cato Reed might return Friday.', [dict(player='Cato Reed',event='availability',value='possible_return',certainty='tentative',time='Friday',actionable=False)], missing_clock=True,strata=['temporal_ambiguity','missing_clock']),
        fixture(7, 'Practice lines:\nVale - Lark - Reed', [dict(player=p,event='line',value='member',role='es_forward',time='practice',actionable=False) for p in ['Arden Vale','Bex Lark','Cato Reed']], strata=['line','multi_person']),
        fixture(8, 'PP1: Vale - Lark - Reed - Snow - Moss', [dict(player=p,event='pp',value='member',role='pp1',time=None,actionable=False) for p in [x['fullName'] for x in PLAYERS]], strata=['pp','multi_person']),
        fixture(9, 'Harbor confirms Daro Snow starts tonight.', [dict(player='Daro Snow',team='Harbor',event='starter',value='starter',role='goalie',time='tonight')], strata=['goalie','asserted']),
        fixture(10, 'Arden Vale skated at practice today; this does not confirm he will play tonight.', [dict(player='Arden Vale',event='attendance',value='skated',certainty='observation',time='today')], strata=['attendance_not_selection']),
        fixture(11, 'RT @Original: Bex Lark is out tonight.', [dict(player='Bex Lark',event='availability',value='out',time='tonight',actionable=False)], relay=True,strata=['attribution','relay']),
        fixture(12, 'Harbor practice: Daro Snow is skating as an extra forward today, not starting in goal.', [
            dict(player='Daro Snow',team='Harbor',event='attendance',value='skating',role='extra_forward',certainty='observation',time='today')], strata=['unusual_practice_role','health_attendance_selection'])
    ]
    return {'version':'synthetic-comparison-controls-v1','empirical_evaluation':False,'fixtures':fs}


if __name__ == '__main__':
    with (ROOT/'fixtures.json').open('x') as f:
        json.dump(build(), f, indent=2)
