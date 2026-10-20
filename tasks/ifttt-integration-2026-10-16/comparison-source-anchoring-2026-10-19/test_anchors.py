import copy
import hashlib
import json
import socket
import unittest
from pathlib import Path
from unittest.mock import patch
from anchors import align_proposals
from comparison import normalize, qualify, utf16_slice
from evaluate import evaluate, ROOT


def source(text):
    return {'text':text,'source_id':'x:fixture','author':'Reporter','published_at':'2026-10-19T12:00:00Z',
            'attribution_status':'original','players':[{'fullName':'Goalie One'}]}


def proposal(quote,start=0,end=1,ident='one'):
    return {'id':ident,'player':'Goalie One','player_id':None,'team':None,'role':None,
            'event':'availability','value':'out','polarity':'negative','certainty':'asserted',
            'time':'tonight','condition':None,'source_id':'x:fixture','source_author':'Reporter',
            'evidence':{'start':start,'end':end,'text':quote}}


def body(*claims):return {'material':True,'overflow':False,'claims':list(claims)}


class ExactAnchors(unittest.TestCase):
    def setUp(self):
        p=patch.object(socket.socket,'connect',side_effect=AssertionError('offline only'))
        self.network=p.start();self.addCleanup(p.stop)

    def tearDown(self):self.network.assert_not_called()

    def test_real_output_only_two_numeric_spans_change_and_inputs_remain_intact(self):
        record=json.loads((ROOT/'comparison-certifi-execution-2026-10-19/run-01/attempt-0.json').read_text())
        profile=json.loads((ROOT/'comparison-pilot-rules-2026-10-19/pilot-rules.json').read_text())
        raw=json.loads(record['response']['output'][0]['content'][0]['text']);before=copy.deepcopy(raw)
        result=align_proposals(profile['source'],raw)
        self.assertEqual(raw,before);self.assertTrue(result['allAnchorsValid'])
        self.assertEqual([c['evidence'] for c in result['body']['claims']],
                         [dict(before['claims'][0]['evidence'],start=0,end=71),dict(before['claims'][1]['evidence'],start=72,end=137)])
        for old,new in zip(raw['claims'],result['body']['claims']):
            self.assertEqual({k:v for k,v in old.items() if k!='evidence'},{k:v for k,v in new.items() if k!='evidence'})
            self.assertEqual(old['evidence']['text'],new['evidence']['text'])
        self.assertEqual([a['action'] for a in result['audit']],['reanchored','reanchored'])
        self.assertFalse(result['nativeEligible'])

    def test_actual_four_arm_re_evaluation_keeps_original_grades_and_both_holds(self):
        ledger=ROOT/'comparison-retry-execution-2026-10-19/aggregate-budget.sqlite'
        before=hashlib.sha256(ledger.read_bytes()).hexdigest();result=evaluate()
        self.assertEqual(hashlib.sha256(ledger.read_bytes()).hexdigest(),before)
        self.assertTrue(result['diagnosis']['asciiOnly'])
        self.assertEqual((result['diagnosis']['unicodeCodepoints'],result['diagnosis']['utf16Units'],result['diagnosis']['utf8Bytes']),(137,137,137))
        extraction=result['arms']['extraction_only'];self.assertEqual(extraction['originalGrade']['tp'],0)
        self.assertEqual(extraction['correctedGrade']['tp'],2);self.assertEqual(extraction['correctedGrade']['accepted'],0)
        self.assertEqual(extraction['correctedGrade']['held'],2)
        self.assertEqual([r['holds'] for r in extraction['correctedQualification']],[['unresolved_time'],['single_subject_evidence_unproved']])
        self.assertEqual(result['arms']['rules_only']['correctedGrade'],result['arms']['rules_only']['originalGrade'])
        for arm in ['rules_decisions','extraction_decisions']:
            self.assertIsNone(result['arms'][arm]['grade']);self.assertFalse(result['arms'][arm]['authenticInput'])

    def test_emoji_prefix_converts_codepoint_location_to_exact_utf16(self):
        quote='Goalie One will not play tonight.';text='🦑 '+quote
        raw=body(proposal(quote,2,len(text)));result=align_proposals(source(text),raw)
        self.assertTrue(result['allAnchorsValid']);self.assertEqual(result['body']['claims'][0]['evidence']['start'],3)
        self.assertEqual(utf16_slice(text,result['body']['claims'][0]['evidence']),quote)

    def test_utf8_byte_guess_is_not_used_as_utf16_offset(self):
        quote='Goalie One will not play tonight.';text='é🏒\n'+quote
        start=len('é🏒\n'.encode());raw=body(proposal(quote,start,start+len(quote.encode())))
        result=align_proposals(source(text),raw)
        self.assertEqual(result['body']['claims'][0]['evidence']['start'],4)
        self.assertEqual(utf16_slice(text,result['body']['claims'][0]['evidence']),quote)

    def test_already_valid_utf16_anchor_is_unchanged(self):
        quote='Goalie One is out';text='🏒 '+quote
        raw=body(proposal(quote,3,3+len(quote)));result=align_proposals(source(text),raw)
        self.assertEqual(result['body'],raw);self.assertEqual(result['audit'][0]['action'],'unchanged')

    def test_canonically_equivalent_unicode_is_not_normalized(self):
        raw=body(proposal('Café'));result=align_proposals(source('Cafe\u0301'),raw)
        self.assertFalse(result['allAnchorsValid']);self.assertEqual(result['body'],raw)
        self.assertEqual(result['audit'][0]['reason'],'exact_quote_absent')

    def test_invalid_repeated_quote_never_chooses_closest_occurrence(self):
        raw=body(proposal('Goalie One',4,8));result=align_proposals(source('Goalie One / Goalie One'),raw)
        self.assertFalse(result['allAnchorsValid']);self.assertEqual(result['body'],raw)
        self.assertEqual(result['audit'][0]['reason'],'exact_quote_ambiguous')

    def test_overlapping_repetitions_are_ambiguous(self):
        result=align_proposals(source('aaaa'),body(proposal('aaa')))
        self.assertEqual(result['audit'][0]['reason'],'exact_quote_ambiguous')

    def test_repeated_text_with_existing_valid_explicit_anchor_stays_unchanged(self):
        raw=body(proposal('Goalie One',13,23));result=align_proposals(source('Goalie One / Goalie One'),raw)
        self.assertTrue(result['allAnchorsValid']);self.assertEqual(result['body'],raw)
        self.assertEqual(result['audit'][0]['action'],'unchanged')

    def test_missing_quote_stays_held(self):
        raw=body(proposal('Goalie One is out'));result=align_proposals(source('Goalie One is available'),raw)
        self.assertEqual(result['body'],raw);self.assertFalse(result['allAnchorsValid'])
        self.assertEqual(result['audit'][0]['reason'],'exact_quote_absent')

    def test_whitespace_and_case_mismatches_are_not_fuzzed(self):
        for quote in ['goalie one','Goalie  One','Goalie\nOne']:
            result=align_proposals(source('Goalie One'),body(proposal(quote)))
            self.assertEqual(result['audit'][0]['reason'],'exact_quote_absent')

    def test_empty_or_boolean_offsets_are_not_coerced(self):
        for claim in [proposal(''),proposal('Goalie One',False,8),proposal('Goalie One',0,True),proposal('Goalie One',-1,5)]:
            result=align_proposals(source('Goalie One'),body(claim))
            self.assertFalse(result['allAnchorsValid']);self.assertEqual(result['audit'][0]['reason'],'invalid_evidence_shape')

    def test_wrong_original_identity_is_not_repaired(self):
        for field in ['source_id','source_author']:
            c=proposal('Goalie One');c[field]='other';raw=body(c);result=align_proposals(source('Goalie One'),raw)
            self.assertFalse(result['allAnchorsValid']);self.assertEqual(result['body'],raw)
            self.assertEqual(result['audit'][0]['reason'],'non_anchor_validation_failed')

    def test_other_schema_errors_are_not_repaired(self):
        c=proposal('Goalie One');c['extra']='unapproved';raw=body(c);result=align_proposals(source('Goalie One'),raw)
        self.assertFalse(result['allAnchorsValid']);self.assertEqual(result['body'],raw)

    def test_duplicate_ids_keep_whole_batch_blocked(self):
        c=proposal('Goalie One');result=align_proposals(source('Goalie One'),body(c,copy.deepcopy(c)))
        self.assertFalse(result['allAnchorsValid']);self.assertIn('duplicate claim id',result['normalization']['errors'])

    def test_one_absent_quote_blocks_partial_batch(self):
        raw=body(proposal('Goalie One',ident='one'),proposal('absent',ident='two'))
        result=align_proposals(source('Goalie One'),raw)
        self.assertEqual(len(result['normalization']['claims']),1)
        self.assertFalse(result['allAnchorsValid']);self.assertEqual(result['audit'][1]['action'],'held')

    def test_overflow_and_malformed_body_do_not_enter_alignment(self):
        raw=dict(body(proposal('Goalie One')),overflow=True);result=align_proposals(source('Goalie One'),raw)
        self.assertFalse(result['allAnchorsValid']);self.assertEqual(result['body'],raw)
        self.assertEqual(result['normalization']['errors'],['claim_overflow'])
        self.assertFalse(align_proposals(source('Goalie One'),{'claims':[]})['allAnchorsValid'])

    def test_invalid_source_unicode_is_held(self):
        result=align_proposals(source('\ud800'),body(proposal('Goalie One')))
        self.assertFalse(result['allAnchorsValid']);self.assertEqual(result['normalization']['errors'],['invalid_source_unicode'])

    def test_pronoun_evidence_is_not_expanded_to_fabricate_subject_binding(self):
        quote='He will miss tonight.';s=source('Goalie One is injured. '+quote)
        raw=body(proposal(quote));result=align_proposals(s,raw)
        self.assertTrue(result['allAnchorsValid']);self.assertEqual(result['body']['claims'][0]['evidence']['text'],quote)
        self.assertIn('single_subject_evidence_unproved',qualify(s,result['normalization'])[0]['holds'])

    def test_negation_qualification_and_other_semantic_fields_are_immutable(self):
        quote='Goalie One will not play tonight if ill.';c=proposal(quote);c['condition']='if ill';c['certainty']='conditional'
        raw=body(c);result=align_proposals(source('Update: '+quote),raw)
        expected=copy.deepcopy(raw);expected['claims'][0]['evidence'].update(start=8,end=8+len(quote))
        self.assertEqual(result['body'],expected)
        self.assertIn('governing_qualification',qualify(source('Update: '+quote),result['normalization'])[0]['holds'])


if __name__=='__main__':unittest.main(verbosity=2)
