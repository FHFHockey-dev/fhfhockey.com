import copy
from fractions import Fraction as F
import json
import unittest
from record_core import Game
from sos_candidate import calculate, colley, faced_then, ranks

T0 = '2026-10-20T00:00:00Z'
METRICS = ('direct_sos', 'rpi_sos', 'colley_sos')

def game(gid, home, away, outcome='home_reg', day='10', available=None):
    return dict(id=gid, season='20262027', phase='regular', home=home, away=away,
                start=f'2026-10-{day}T18:00:00Z', end=f'2026-10-{day}T21:00:00Z',
                available_at=available or f'2026-10-{day}T21:01:00Z', outcome=outcome)

def fixture(gid, home, away, start='2026-10-21T18:00:00Z', status='scheduled'):
    return dict(id=gid, season='20262027', phase='regular', home=home, away=away,
                start=start, known_at='2026-09-01T00:00:00Z', status=status)

def payload(teams=('A','B','C','D'), results=(), fixtures=(), kind='future_as_of', kappa='2'):
    return dict(teams=list(teams), season=dict(id='20262027', start='2026-09-01T00:00:00Z', end='2027-07-01T00:00:00Z'),
        as_of=T0, horizon=dict(kind=kind, start=T0 if kind=='future_as_of' else '2026-09-01T00:00:00Z',
                              end='2026-11-17T00:00:00Z' if kind=='future_as_of' else T0),
        config=dict(mode='final_win', kappa=kappa, prior_mean='.5', prior_known_at='2026-08-01T00:00:00Z'),
        history=dict(as_of=T0, complete_teams=list(teams), results=list(results)),
        schedule=dict(observed_at='2026-10-19T23:00:00Z', start=T0, end='2026-11-17T00:00:00Z',
                      complete_teams=list(teams), fixtures=list(fixtures)))

def balanced():
    teams=tuple('ABCDEF')
    return payload(teams, [game(h+a,h,a) for h in teams for a in teams if h!=a],
                   [fixture('future-'+h+a,h,a) for h in teams for a in teams if h!=a])

def confounded():
    rows=[game(f'AH{i}','A','H','home_reg' if i<4 else 'away_reg') for i in range(10)]
    rows += [game(f'BL{i}','B','L','home_reg' if i<6 else 'away_reg') for i in range(10)]
    rows += [game(f'HL{i}','H','L','home_reg' if i<9 else 'away_reg') for i in range(10)]
    rows += [game('AB','A','B')]
    return payload(('A','B','H','L'),rows,[fixture('fAB','A','B'),fixture('fHL','H','L')])

class ContractTests(unittest.TestCase):
    def test_balanced_round_robin(self):
        r=calculate(balanced())
        for row in r['teams'].values():
            for m in METRICS:
                self.assertAlmostEqual(row[m],.5); self.assertEqual(row[m+'_rank'],1)
        self.assertLess(r['quality_colley']['residual_max'],1e-12)

    def test_colley_published_one_game_oracle(self):
        r=colley(('A','B'),[Game('1','A','B','home_reg')])['ratings']
        self.assertAlmostEqual(r['A'],5/8); self.assertAlmostEqual(r['B'],3/8)

    def test_colley_published_unbalanced_oracle(self):
        gs=[Game(h+a,h,a,'home_reg') for h,a in [('a','c'),('d','a'),('e','a'),('c','b'),('b','e'),('c','d'),('e','c')]]
        r=colley('abcde',gs)['ratings']
        for t,v in zip('abcde',[19,24,23,22,27]): self.assertAlmostEqual(r[t],v/46)

    def test_schedule_confounding_example(self):
        r=calculate(confounded())
        self.assertLess(r['teams']['A']['own_record']['value'],r['teams']['B']['own_record']['value'])
        self.assertGreater(r['quality_colley']['ratings']['A'],r['quality_colley']['ratings']['B'])

    def test_weighting_reuses_exact_checkpoint_oracle(self):
        rows=[game(f'AX{i}','A','X','home_reg' if i<4 else 'away_reg') for i in range(5)]
        rows += [game(f'BY{i}','B','Y','home_reg' if i==0 else 'away_reg') for i in range(10)]
        fs=[fixture(f'IA{i}','I','A') for i in range(3)]+[fixture('IB','I','B')]
        r=calculate(payload(('I','A','B','X','Y'),rows,fs,kappa='0'))['teams']['I']
        self.assertEqual(r['direct_sos'],.625); self.assertIsNone(r['rpi_sos'])
        self.assertEqual(r['rpi_sos_state'],'missing_required_component')

    def test_empty_horizon(self):
        r=calculate(payload())['teams']['A']; self.assertEqual(r['state'],'no_fixtures')
        for m in METRICS: self.assertIsNone(r[m])

    def test_zero_gp_known_prior_only(self):
        r=calculate(payload(fixtures=[fixture('AB','A','B')]))['teams']['A']
        self.assertEqual(r['direct_sos'],.5)
        self.assertEqual(r['record_components']['window'],'future_fixture_list')
        self.assertEqual(r['record_components']['direct_prior_only_fixture_weight'],1)
        self.assertEqual(r['colley_prior_only_fixture_share'],1)

    def test_zero_gp_no_shrink_unavailable(self):
        r=calculate(payload(fixtures=[fixture('AB','A','B')],kappa='0'))['teams']['A']
        self.assertIsNone(r['direct_sos']); self.assertIsNone(r['rpi_sos'])
        self.assertEqual(r['record_components']['oowp'],.5) # declared structural prior

    def test_valid_zero(self):
        r=calculate(payload(results=[game('BC','B','C','away_reg')],fixtures=[fixture('AB','A','B')],kappa='0'))
        self.assertEqual(r['teams']['A']['direct_sos'],0)

    def test_incomplete_history_withholds_cohort(self):
        p=balanced(); p['history']['complete_teams'].remove('F'); r=calculate(p)
        self.assertIsNone(r['quality_colley']); self.assertEqual(r['missing_history_teams'],['F'])
        self.assertTrue(all(t['direct_sos'] is None for t in r['teams'].values()))

    def test_incomplete_schedule_no_subset_average(self):
        p=balanced(); p['schedule']['complete_teams'].remove('A'); r=calculate(p)
        self.assertIsNone(r['teams']['A']['direct_sos']); self.assertEqual(r['teams']['B']['direct_sos'],.5)

    def test_postponed_unknown_blocks(self):
        p=payload(fixtures=[fixture('AB','A','B'),fixture('AC','A','C',status='postponed')])
        r=calculate(p)['teams']['A']; self.assertEqual(r['fixture_count'],1)
        self.assertEqual(r['unresolved_fixture_ids'],['AC']); self.assertIsNone(r['direct_sos'])

    def test_cancelled_excluded(self):
        r=calculate(payload(fixtures=[fixture('AB','A','B',status='cancelled')]))
        self.assertEqual(r['teams']['A']['state'],'no_fixtures')

    def test_duplicate_ids(self):
        for group,key in [('history','results'),('schedule','fixtures')]:
            p=balanced(); p[group][key].append(copy.deepcopy(p[group][key][0]))
            with self.assertRaisesRegex(ValueError,'Duplicate'): calculate(p)

    def test_repeated_opponents_distinct_fixtures(self):
        r=calculate(payload(fixtures=[fixture('1','A','B'),fixture('2','A','B')]))['teams']['A']
        self.assertEqual(r['fixture_count'],2); self.assertEqual(r['unique_opponents'],1)

    def test_unknown_team_and_self_game(self):
        for away in ('MISSING','A'):
            with self.assertRaises(ValueError): calculate(payload(fixtures=[fixture('1','A',away)]))

    def test_later_results_and_corrections_no_leakage(self):
        p=balanced(); base=calculate(p)
        for known in (T0,'2026-10-21T00:00:00Z'):
            q=copy.deepcopy(p); q['history']['results'].append(game('late','A','B',available=known))
            r=calculate(q); self.assertEqual(base['teams'],r['teams'])
            self.assertEqual(r['ignored_results']['not_known_before_cutoff'],1)
        p['history']['results'].append(game('future-final','A','B',day='25'))
        self.assertEqual(base['teams'],calculate(p)['teams'])

    def test_later_schedule_snapshot_rejected(self):
        p=balanced(); p['schedule']['observed_at']=T0
        with self.assertRaisesRegex(ValueError,'strictly before'): calculate(p)
        p=balanced(); p['schedule']['fixtures'][0]['known_at']=T0
        with self.assertRaisesRegex(ValueError,'newer than'): calculate(p)

    def test_cutoff_and_timezone_contract(self):
        p=balanced(); p['history']['as_of']='2026-10-21T00:00:00Z'
        with self.assertRaises(ValueError): calculate(p)
        p=balanced(); p['as_of']='2026-10-20'
        with self.assertRaisesRegex(ValueError,'Timezone'): calculate(p)

    def test_exclusive_end_and_timezone_equivalence(self):
        p=payload(fixtures=[fixture('1','A','B',start='2026-11-17T00:00:00Z'),fixture('2','A','C',start='2026-10-20T01:01:00+01:00')])
        self.assertEqual(calculate(p)['teams']['A']['fixture_ids'],['2'])

    def test_timeline_and_prior_validation(self):
        p=balanced(); p['history']['results'][0]['available_at']='2026-10-10T20:00:00Z'
        with self.assertRaises(ValueError): calculate(p)
        for field,val in [('kappa','-1'),('prior_mean','NaN'),('prior_known_at',T0)]:
            p=balanced(); p['config'][field]=val
            with self.assertRaises(ValueError): calculate(p)

    def test_season_crossing_and_historic_tie_rejected(self):
        p=balanced(); p['horizon']['end']='2027-07-02T00:00:00Z'
        with self.assertRaisesRegex(ValueError,'season'): calculate(p)
        p=balanced(); p['history']['results'][0]['season']='20252026'
        with self.assertRaisesRegex(ValueError,'seasons'): calculate(p)
        p=balanced(); p['history']['results'][0]['outcome']='tie'
        with self.assertRaisesRegex(ValueError,'historical ties'): calculate(p)

    def test_playoffs_excluded(self):
        p=balanced(); before=calculate(p); g=game('playoff','A','B'); g['phase']='playoff'
        p['history']['results'].append(g); self.assertEqual(before['teams'],calculate(p)['teams'])

    def test_points_ot_noncomplementary_and_no_colley(self):
        p=payload(results=[game('BC','B','C','home_ot')],fixtures=[fixture('AB','A','B')],kappa='0')
        p['config'].update(mode='points_credit',prior_mean='.55',points_per_win=2); r=calculate(p)
        self.assertEqual(r['teams']['B']['own_record']['value'],1)
        self.assertEqual(r['teams']['C']['own_record']['value'],.5)
        self.assertIsNone(r['quality_colley']); self.assertIsNone(r['teams']['A']['colley_sos'])
        with self.assertRaises(ValueError): colley(('B','C'),[],'points_credit')

    def test_explicit_points_ledger_and_unsupported_system(self):
        g=game('BC','B','C'); g.update(home_points=0,away_points=0)
        p=payload(results=[g],fixtures=[fixture('AB','A','B')],kappa='0')
        p['config'].update(mode='points_credit',prior_mean='.55',points_per_win=2)
        self.assertEqual(calculate(p)['teams']['A']['direct_sos'],0)
        p['config']['points_per_win']=3
        with self.assertRaises(ValueError): calculate(p)

    def test_regulation_tie_credit(self):
        p=payload(results=[game('BC','B','C','home_so')],fixtures=[fixture('AB','A','B')],kappa='0')
        p['config']['mode']='regulation_equivalent'; r=calculate(p)
        self.assertEqual(r['teams']['A']['direct_sos'],.5)
        self.assertAlmostEqual(r['quality_colley']['ratings']['B'],.5)

    def test_focal_self_influence_excluded_all_modes(self):
        p=balanced()
        for mode in ('final_win','regulation_equivalent','points_credit'):
            p['config'].update(mode=mode,points_per_win=2,prior_mean='.55' if mode=='points_credit' else '.5')
            q=copy.deepcopy(p)
            for g in q['history']['results']:
                if 'A' in (g['home'],g['away']):
                    g['outcome']='home_reg' if g['home']=='A' else 'away_reg'
            a,b=calculate(p)['teams']['A'],calculate(q)['teams']['A']
            for m in METRICS: self.assertEqual(a[m],b[m])
            self.assertNotEqual(a['own_record']['value'],b['own_record']['value'])

    def test_order_invariance(self):
        p=balanced(); q=copy.deepcopy(p)
        q['teams'].reverse(); q['history']['results'].reverse(); q['schedule']['fixtures'].reverse()
        self.assertEqual(calculate(p),calculate(q))

    def test_relabel_equivariance(self):
        p=balanced(); q=copy.deepcopy(p); mapping=dict(zip('ABCDEF','zyxwvu'))
        q['teams']=[mapping[t] for t in p['teams']]
        for group,key in [('history','results'),('schedule','fixtures')]:
            q[group]['complete_teams']=q['teams'][:]
            for g in q[group][key]: g['home'],g['away']=mapping[g['home']],mapping[g['away']]
        a,b=calculate(p),calculate(q)
        for t in p['teams']:
            for m in METRICS: self.assertAlmostEqual(a['teams'][t][m],b['teams'][mapping[t]][m])

    def test_disconnected_components_not_hidden(self):
        p=payload(results=[game('AB','A','B'),game('CD','C','D')],fixtures=[fixture('fAB','A','B'),fixture('fCD','C','D')])
        r=calculate(p); self.assertEqual(r['quality_colley']['components'],[['A','B'],['C','D']])
        self.assertEqual(r['teams']['A']['colley_excluding_focal']['components'],[['B'],['C','D']])

    def test_rank_ties_and_missing(self):
        self.assertEqual(ranks({'Z':.5,'A':.5,'B':.4,'X':None}),{'Z':1,'A':1,'B':3,'X':None})
        self.assertEqual(ranks({'A':.5,'B':.5+1e-12}),{'A':1,'B':1})

    def test_past_retrospective_selected_horizon(self):
        p=balanced(); p['horizon']=dict(kind='past_retrospective',start='2026-10-10T00:00:00Z',end=T0)
        r=calculate(p)['teams']['A']; self.assertEqual(r['fixture_count'],10)
        self.assertEqual(r['direct_sos'],.5); self.assertIsNone(r['record_components']['rpi_style'])
        self.assertEqual(r['record_components']['window'],'past_fixture_list')

    def test_future_outer_weights_only(self):
        p=confounded(); base=calculate(p)
        p['schedule']['fixtures'].append(fixture('fAH','A','H')); r=calculate(p)
        self.assertEqual(base['quality_colley'],r['quality_colley'])
        self.assertNotEqual(base['teams']['A']['direct_sos'],r['teams']['A']['direct_sos'])

    def test_no_volume_bonus_in_difficulty(self):
        p=confounded(); a=calculate(p)['teams']['A']
        p['schedule']['fixtures'].append(fixture('fAB2','A','B')); b=calculate(p)['teams']['A']
        self.assertEqual(b['fixture_count'],2*a['fixture_count'])
        for m in METRICS: self.assertAlmostEqual(a[m],b[m])

    def test_faced_then_separate_from_retrospective(self):
        rows=[game('AB','A','B'),game('BC','B','C',day='15')]
        p=payload(results=rows,kind='past_retrospective'); p['horizon']['end']='2026-10-11T00:00:00Z'
        snap=payload(fixtures=[fixture('AB','A','B',start=rows[0]['start'])])
        snap['as_of']='2026-10-10T17:00:00Z'; snap['history']['as_of']=snap['as_of']
        snap['horizon'].update(start=snap['as_of'],end='2026-10-11T00:00:00Z')
        snap['schedule'].update(start=snap['as_of'],observed_at='2026-10-10T16:00:00Z')
        r=faced_then(p,[{'fixture_id':'AB','snapshot':snap}])
        self.assertEqual(r['teams']['A']['direct_sos'],.5)
        self.assertGreater(calculate(p)['teams']['A']['direct_sos'],.5)
        self.assertIsNone(faced_then(p,[])['teams']['A']['direct_sos'])
        snap['as_of']='2026-10-10T19:00:00Z'
        with self.assertRaises(ValueError): faced_then(p,[{'fixture_id':'AB','snapshot':snap}])

    def test_colley_is_unbounded_index_not_probability(self):
        gs=[Game(f'{h}{a}{i}',h,a,'home_reg') for h,a in [('A','B'),('B','C'),('C','D')] for i in range(100)]
        r=colley('ABCD',gs)
        self.assertGreater(r['ratings']['A'],1); self.assertLess(r['ratings']['D'],0)
        self.assertAlmostEqual(sum(r['ratings'].values())/4,.5)

    def test_kickoff_at_cutoff_is_not_future(self):
        p=payload(fixtures=[fixture('AB','A','B',start=T0)])
        self.assertEqual(calculate(p)['teams']['A']['state'],'no_fixtures')

    def test_full_rpi_is_not_schedule_only(self):
        from record_core import RecordSOS
        games=[Game('AB','A','B','home_reg')]
        a=RecordSOS('AB',games).score('A'); b=RecordSOS('AB',games).score('B')
        self.assertEqual(a['sos'],b['sos'])
        self.assertGreater(a['rpi_style'],b['rpi_style'])

    def test_naive_owp_negative_control_does_leak(self):
        from record_core import RecordSOS
        games=[Game('AB','A','B','home_reg'),Game('BC','B','C','home_reg'),Game('CD','C','D','home_reg')]
        before=RecordSOS('ABCD',games)
        games[0]=Game('AB','A','B','away_reg'); after=RecordSOS('ABCD',games)
        self.assertNotEqual(before.rate('B')['value'],after.rate('B')['value'])
        self.assertEqual(before.score('A')['sos'],after.score('A')['sos'])

    def test_one_result_perturbation_exposes_rank_churn(self):
        p=balanced(); p['schedule']['fixtures']=[fixture('fAC','A','C'),fixture('fBD','B','D'),fixture('fEF','E','F')]
        from sos_candidate import LedgerRecordSOS
        original=copy.deepcopy(p)
        a=calculate(original)
        next(g for g in p['history']['results'] if g['id']=='AB')['outcome']='away_reg'
        b=calculate(p)
        before=LedgerRecordSOS(p['teams'],original['history']['results'],'final_win',F(2),F(1,2))
        after=LedgerRecordSOS(p['teams'],p['history']['results'],'final_win',F(2),F(1,2))
        # C faces A, whose eligible record loses one credit out of 8+2 games.
        # D faces B with the opposite change. The second-hop change cancels.
        # Each leave-out Colley graph is 2I + L(K5, edge weight 2): on the
        # zero-sum AB perturbation C acts as 12I, giving +/-1/12 exactly.
        magnitudes={'direct_sos':F(1,10),'rpi_sos':F(1,15),'colley_sos':F(1,12)}
        expected_ranks={'A':2,'B':2,'C':6,'D':1,'E':2,'F':2}
        for team in p['teams']:
            sign=-1 if team=='C' else 1 if team=='D' else 0
            opponents=b['teams'][team]['opponents']
            r0,r1=before.score(team,opponents),after.score(team,opponents)
            self.assertEqual(r1['owp']-r0['owp'],sign*F(1,10))
            self.assertEqual(r1['sos']-r0['sos'],sign*F(1,15))
            for metric,magnitude in magnitudes.items():
                self.assertAlmostEqual(b['teams'][team][metric]-a['teams'][team][metric],
                                       float(sign*magnitude),places=12)
                self.assertEqual(a['teams'][team][metric+'_rank'],1)
                self.assertEqual(b['teams'][team][metric+'_rank'],expected_ranks[team])
        # Hand-derived toy-league oracles, not an NHL stability guarantee.

    def test_pure_no_input_mutation(self):
        p=balanced(); before=json.dumps(p,sort_keys=True); calculate(p)
        self.assertEqual(json.dumps(p,sort_keys=True),before)

if __name__=='__main__': unittest.main()
