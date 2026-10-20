import copy
import json
import socket
import tempfile
import threading
import unittest
from pathlib import Path
from unittest.mock import patch

from comparison import (CAP, FIELDS, Ledger, ROOT, apply_decisions, digest, freeze_splits,
                        grade, match_claims, normalize, paired_intervals, qualify,
                        readiness, request_input, reservation, select_outcome, statement, utf16_slice, validate_labels)
from make_controls import build


def bundle(prefix, reserve=10_000_000, dynamic=False):
    return [dict(id=f'{prefix}-{i}', endpoint='responses' if i==0 else 'decisions',
                 request=None if dynamic and i==2 else {'input':f'{prefix}-{i}'}, reserve=reserve) for i in range(3)]


class OfflineOnly(unittest.TestCase):
    def setUp(self):
        self.network=patch.object(socket.socket,'connect',side_effect=AssertionError('network forbidden'))
        self.network.start()
        self.addCleanup(self.network.stop)


class BudgetTests(OfflineOnly):
    def setUp(self):
        super().setUp()
        self.temp=tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.path=Path(self.temp.name)/'ledger.sqlite'
        self.ledger=Ledger(self.path,'frozen-experiment')
        self.addCleanup(self.ledger.close)

    def test_conditional_exact_price_rounding_and_126_post_limit(self):
        cost=reservation('responses',4096,1024)+2*reservation('decisions',4096)
        self.assertEqual(cost,2_027_520)
        self.assertEqual(cost*126,255_467_520)
        self.assertLessEqual(cost*126,CAP)
        self.assertGreater(cost*129,CAP)
        self.assertEqual(reservation('decisions',1),110)

    def test_unproved_or_long_input_envelope_refused(self):
        for args in [('responses',4097,0),('responses',10,1025),('decisions',1,1),('responses',-1,1),('responses',True,1)]:
            with self.subTest(args=args),self.assertRaises(ValueError):reservation(*args)

    def test_entire_three_call_bundle_reserved_before_first_send(self):
        self.ledger.reserve_bundle('a',bundle('a'))
        self.assertEqual(self.ledger.snapshot()['exposure_nano_usd'],30_000_000)
        self.assertTrue(all(r[5]=='reserved' for r in self.ledger.snapshot()['attempts']))

    def test_failed_bundle_rolls_back_all_rows(self):
        b=bundle('a');b[2]['id']=b[0]['id']
        with self.assertRaises(Exception):self.ledger.reserve_bundle('a',b)
        self.assertEqual(self.ledger.snapshot()['attempts'],[])

    def test_cap_refusal_before_any_write(self):
        self.ledger.reserve_bundle('a',bundle('a',60_000_000))
        before=self.ledger.snapshot()
        with self.assertRaises(RuntimeError):self.ledger.reserve_bundle('b',bundle('b',60_000_000))
        self.assertEqual(before,self.ledger.snapshot())

    def test_atomic_reservation_with_two_real_connections(self):
        barrier=threading.Barrier(2);outcomes=[]
        def worker(name):
            ledger=Ledger(self.path,'frozen-experiment')
            try:
                barrier.wait(timeout=3)
                ledger.reserve_bundle(name,bundle(name,60_000_000))
                outcomes.append('reserved')
            except RuntimeError:outcomes.append('refused')
            finally:ledger.close()
        threads=[threading.Thread(target=worker,args=(n,)) for n in ['a','b']]
        for t in threads:t.start()
        for t in threads:t.join(timeout=5)
        self.assertEqual(sorted(outcomes),['refused','reserved'])
        self.assertEqual(len(self.ledger.snapshot()['attempts']),3)

    def test_dynamic_verification_request_binds_once_after_full_reservation(self):
        self.ledger.reserve_bundle('a',bundle('a',dynamic=True))
        with self.assertRaises(ValueError):self.ledger.begin('a-2',None)
        request={'extracted_claim':'later exact content'}
        self.ledger.bind('a-2',request)
        with self.assertRaises(RuntimeError):self.ledger.bind('a-2',{'changed':True})
        self.ledger.begin('a-2',request)

    def test_exact_request_mismatch_refused_without_dispatch(self):
        self.ledger.reserve_bundle('a',bundle('a'))
        with self.assertRaises(RuntimeError):self.ledger.begin('a-0',{'input':'changed'})
        self.assertEqual(self.ledger.snapshot()['attempts'][0][5],'reserved')

    def test_uncertain_timeout_retains_reserve_and_blocks_other_arms(self):
        self.ledger.reserve_bundle('a',bundle('a'))
        self.ledger.begin('a-0',bundle('a')[0]['request'])
        self.ledger.uncertain('a-0','timeout; provider may have billed')
        self.assertEqual(self.ledger.snapshot()['exposure_nano_usd'],30_000_000)
        with self.assertRaises(RuntimeError):self.ledger.begin('a-1',bundle('a')[1]['request'])
        with self.assertRaises(RuntimeError):self.ledger.reserve_bundle('b',bundle('b'))

    def test_crash_after_send_restart_cannot_resend(self):
        self.ledger.reserve_bundle('a',bundle('a'))
        self.ledger.begin('a-0',bundle('a')[0]['request'])
        other=Ledger(self.path,'frozen-experiment')
        try:
            with self.assertRaises(RuntimeError):other.begin('a-0',bundle('a')[0]['request'])
            self.assertIsNotNone(other.snapshot()['blocked'])
            self.assertEqual(other.snapshot()['exposure_nano_usd'],30_000_000)
        finally:other.close()

    def test_complete_usage_settlement_and_no_second_send(self):
        self.ledger.reserve_bundle('a',bundle('a'))
        request=bundle('a')[0]['request']
        self.ledger.begin('a-0',request)
        self.ledger.settle('a-0',{'usage':'fixture'},200)
        self.assertEqual(self.ledger.snapshot()['exposure_nano_usd'],20_000_200)
        with self.assertRaises(RuntimeError):self.ledger.begin('a-0',request)
        with self.assertRaises(RuntimeError):self.ledger.settle('a-0',{},200)

    def test_provider_bound_violation_never_underreports_known_charge(self):
        self.ledger.reserve_bundle('a',bundle('a'))
        self.ledger.begin('a-0',bundle('a')[0]['request'])
        with self.assertRaises(RuntimeError):self.ledger.settle('a-0',{},10_000_001)
        self.assertEqual(self.ledger.snapshot()['exposure_nano_usd'],30_000_001)
        self.assertIsNotNone(self.ledger.snapshot()['blocked'])

    def test_experiment_cannot_reset_budget_by_reopening_different_config(self):
        self.ledger.reserve_bundle('a',bundle('a'))
        with self.assertRaises(ValueError):Ledger(self.path,'different-experiment')
        self.assertEqual(self.ledger.snapshot()['exposure_nano_usd'],30_000_000)

    def test_automatic_retry_bundle_and_missing_pair_refused(self):
        self.ledger.reserve_bundle('a',bundle('a'))
        with self.assertRaises(RuntimeError):self.ledger.reserve_bundle('a',bundle('new-ids'))
        with self.assertRaises(ValueError):self.ledger.reserve_bundle('b',bundle('b')[:2])

    def test_finite_request_count_cap_even_with_negligible_reservations(self):
        for i in range(126):self.ledger.reserve_bundle(str(i),bundle(str(i),1))
        with self.assertRaises(RuntimeError):self.ledger.reserve_bundle('127',bundle('127',1))
        self.assertEqual(len(self.ledger.snapshot()['attempts']),378)


class GradingTests(OfflineOnly):
    def setUp(self):
        super().setUp();self.fixtures=build();self.f=self.fixtures['fixtures'][1]

    def rows(self, fixture=None):
        f=fixture or self.f
        return qualify(f['source'],normalize(f['source'],f['mock_extraction']))

    def test_committed_synthetic_fixtures_are_reproducible_and_not_empirical_gold(self):
        self.assertEqual(json.loads((ROOT/'fixtures.json').read_text()),self.fixtures)
        for f in self.fixtures['fixtures']:
            validate_labels(f['source'],f['labels'])
            self.assertFalse(f['labels']['provenance']['human_adjudication'])

    def test_perfect_source_control_has_no_world_truth_credit(self):
        g=grade(self.f['source'],self.f['labels'],self.rows(),True)
        self.assertEqual((g['tp'],g['fp'],g['fn']),(1,0,0))
        self.assertEqual(g['usable_source_updates'],1)
        self.assertIsNone(g['usable_world_updates'])
        self.assertGreater(g['ungradable_fields'],0)

    def test_omitted_extraction_counts_as_miss_in_verification_only_arm(self):
        rows=apply_decisions([],{'invented':dict(supported=True,confidence=.99,wording='direct_assertion')})
        g=grade(self.f['source'],self.f['labels'],rows,None,['extraction_failed'])
        self.assertEqual((g['tp'],g['fn'],g['missed_actionable']),(0,1,1))
        self.assertIsNone(g['relevance_correct'])

    def test_wrong_player_and_negation_are_unsafe_not_partial_truth(self):
        rows=self.rows();rows[0]['claim'].update(player='Bex Lark',polarity='positive',value='available')
        g=grade(self.f['source'],self.f['labels'],rows,True)
        self.assertEqual((g['tp'],g['fp'],g['fn'],g['unsafe_acceptance']),(0,1,1,1))
        self.assertIn('player',g['taxonomy'][0]['fields'])
        self.assertIn('polarity',g['taxonomy'][0]['fields'])

    def test_hallucinated_event_counted_even_in_held_output(self):
        rows=self.rows();extra=copy.deepcopy(rows[0]);extra['claim']['id']='extra';extra['claim']['event']='starter';extra['accepted']=False
        g=grade(self.f['source'],self.f['labels'],rows+[extra],True)
        self.assertEqual((g['hallucinations'],g['fp']),(1,1))

    def test_duplicate_semantics_cannot_match_one_gold_twice(self):
        rows=self.rows();extra=copy.deepcopy(rows[0]);extra['claim']['id']='extra'
        g=grade(self.f['source'],self.f['labels'],rows+[extra],True)
        self.assertEqual((g['tp'],g['fp'],g['hallucinations']),(1,1,1))

    def test_held_unknown_is_not_a_correct_negative(self):
        rows=apply_decisions(self.rows(),{})
        g=grade(self.f['source'],self.f['labels'],rows,None)
        self.assertEqual((g['held'],g['usable_source_updates'],g['missed_actionable']),(1,0,1))
        self.assertIsNone(g['relevance_correct'])

    def test_qualifiers_missing_clock_relay_and_units_stay_held(self):
        for i in [2,5,6,7,10]:
            rows=self.rows(self.fixtures['fixtures'][i])
            self.assertTrue(rows)
            self.assertTrue(all(not r['accepted'] for r in rows))

    def test_common_qualification_never_grants_world_authority(self):
        self.assertTrue(all(r['world_authority'] is False for f in self.fixtures['fixtures'] for r in self.rows(f)))

    def test_fields_ungradable_for_missing_external_context_not_scored_as_correct(self):
        rows=self.rows();rows[0]['claim']['player_id']='invented-real-id'
        g=grade(self.f['source'],self.f['labels'],rows,True)
        self.assertNotIn('player_id',g['field_accuracy'])
        self.assertIsNone(g['usable_world_updates'])

    def test_mixed_gradability_excludes_ungradable_matched_field_from_precision(self):
        f=copy.deepcopy(self.fixtures['fixtures'][3])
        f['labels']['claims'][0]['gradable'].remove('team')
        f['labels']['claims'][1]['expected']['team']='Harbor'
        claims=f['mock_extraction']['claims']
        claims[0]['team']='unverified-context';claims[1]['team']='Harbor'
        g=grade(f['source'],f['labels'],[dict(claim=c,accepted=False) for c in claims])
        field=g['field_accuracy']['team']
        self.assertEqual((field['correct_nonnull'],field['predicted_nonnull'],field['precision']),(1,1,1))

    def test_unmatched_fields_are_separate_from_matched_precision_and_still_false_positives(self):
        rows=self.rows();extra=copy.deepcopy(rows[0]);extra['claim'].update(id='unsupported',event='starter')
        g=grade(self.f['source'],self.f['labels'],rows+[extra],True)
        field=g['field_accuracy']['player']
        self.assertEqual((field['precision'],field['predicted_nonnull'],field['unmatched_nonnull']),(1,1,1))
        self.assertEqual((g['fp'],g['hallucinations'],g['unsafe_acceptance']),(1,1,1))

    def test_support_filter_can_only_abstain_never_repair(self):
        rows=self.rows();rows[0]['holds']=['prior_hold'];rows[0]['accepted']=False
        out=apply_decisions(rows,{rows[0]['claim']['id']:dict(supported=True,confidence=1,wording='direct_assertion')})
        self.assertEqual(out,rows)
        self.assertFalse(out[0]['accepted'])

    def test_nan_wrong_type_refusal_missing_decision_all_unknown(self):
        for answer in [None,{},dict(supported=True,confidence=float('nan'),wording='direct_assertion'),dict(supported=1,confidence=1,wording='direct_assertion'),dict(supported=True,confidence=.94,wording='direct_assertion')]:
            rows=self.rows();out=apply_decisions(rows,{rows[0]['claim']['id']:answer})
            self.assertFalse(out[0]['accepted'])

    def test_strict_schema_wrong_original_bad_spans_and_overflow_visible(self):
        base=self.f['mock_extraction']
        variants=[]
        for field,value in [('source_id','other'),('source_author','Relay'),('certainty','confirmed')]:
            b=copy.deepcopy(base);b['claims'][0][field]=value;variants.append(b)
        b=copy.deepcopy(base);b['claims'][0]['evidence']['end']=999;variants.append(b)
        b=copy.deepcopy(base);b['claims'][0]['secret']='bad';variants.append(b)
        b=copy.deepcopy(base);b['claims']*=33;variants.append(b)
        for b in variants:
            n=normalize(self.f['source'],b);self.assertTrue(n['errors']);self.assertEqual(n['claims'],[])

    def test_unicode_utf16_end_and_surrogate_boundaries(self):
        self.assertEqual(utf16_slice('🏒 Vale',dict(start=3,end=7,text='Vale')),'Vale')
        for s in [dict(start=1,end=2,text='x'),dict(start=3,end=999,text='Vale'),dict(start=3,end=6,text='Vale')]:
            with self.assertRaises(ValueError):utf16_slice('🏒 Vale',s)

    def test_source_binding_prevents_regrading_changed_post(self):
        source=copy.deepcopy(self.f['source']);source['text']='will play'
        with self.assertRaises(ValueError):validate_labels(source,self.f['labels'])

    def test_request_allowlist_excludes_labels_and_prior_outputs(self):
        source=copy.deepcopy(self.f['source']);source.update(labels='SECRET GOLD',rules_output='SECRET CANDIDATE',api_key='SECRET')
        source['players'][0]['gold_label']='SECRET';source['context']['gold']='SECRET'
        self.assertNotIn('SECRET',json.dumps(request_input(source)))

    def test_explicit_overflow_and_omission_field_denominators(self):
        body=copy.deepcopy(self.f['mock_extraction']);body['overflow']=True;body['claims']=[]
        output=normalize(self.f['source'],body)
        self.assertEqual(output['errors'],['claim_overflow'])
        g=grade(self.f['source'],self.f['labels'],[],None,output['errors'])
        self.assertEqual(g['field_accuracy']['player']['total'],1)
        self.assertEqual(g['field_accuracy']['player']['recall'],0)

    def test_frozen_decision_rule_requires_adjudication_and_harm_free_coverage(self):
        def row(i):
            return dict(split='holdout',family_id=str(i),arms={
                'a':dict(usable_source_updates=0,unsafe_acceptance=0,missed_actionable=1),
                'b':dict(usable_source_updates=1,unsafe_acceptance=0,missed_actionable=0)})
        records=[row(i) for i in range(30)]
        self.assertEqual(select_outcome(records,'a','b')['verdict'],'inconclusive')
        self.assertEqual(select_outcome(records,'a','b',adjudicated=True,complete_cost=True)['verdict'],'bounded_source_fidelity_advantage')
        records[0]['arms']['b']['unsafe_acceptance']=1
        self.assertEqual(select_outcome(records,'a','b',adjudicated=True,complete_cost=True)['verdict'],'tradeoff_or_disqualified')

    def test_statement_preserves_every_declared_field(self):
        claim=self.f['mock_extraction']['claims'][0]
        encoded=json.loads(statement(claim).split('proposition: ')[1])
        self.assertEqual(encoded,{k:claim[k] for k in FIELDS})

    def test_family_links_and_exact_text_cannot_cross_split(self):
        sources=[f['source'] for f in self.fixtures['fixtures']]
        split=freeze_splits(sources)
        self.assertEqual(list(split.values()).count('development'),6)
        self.assertEqual(list(split.values()).count('calibration'),2)
        self.assertEqual(list(split.values()).count('holdout'),4)
        duplicate=copy.deepcopy(sources[0]);duplicate['source_id']='relay-id'
        self.assertEqual(freeze_splits(sources+[duplicate])[duplicate['family_id']],split[duplicate['family_id']])
        duplicate['family_id']='wrong-family'
        with self.assertRaises(ValueError):freeze_splits(sources+[duplicate])

    def test_family_intervals_are_paired_and_never_declare_synthetic_winner(self):
        records=[dict(split='holdout',family_id=f'family-{i}',arms={'a':{'m':0},'b':{'m':1}}) for i in range(4)]
        out=paired_intervals(records,'a','b','m',draws=200)
        self.assertEqual((out['families'],out['mean_difference'],out['ci95']),(4,1,[1,1]))
        self.assertEqual(out['verdict'],'inconclusive')
        self.assertEqual(paired_intervals([],'a','b','m')['families'],0)

    def test_no_paid_executor_or_readiness_override(self):
        r=readiness()
        self.assertFalse(r['paid_dispatch_enabled']);self.assertEqual(r['spent_usd'],'0.00')
        self.assertGreater(len(r['blockers']),0)


if __name__=='__main__':
    unittest.main(verbosity=2)
