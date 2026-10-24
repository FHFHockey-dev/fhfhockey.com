"""Reviewer-only exact oracles. No candidate test helpers or core arithmetic reused."""
import copy
from fractions import Fraction as Q
import random
import unittest

from sos_candidate import calculate, faced_then

T = '2026-10-20T00:00:00Z'
METRICS = ('direct_sos', 'rpi_sos', 'colley_sos')


def result(gid, home, away, outcome='home_reg', day=10):
    return dict(id=gid, home=home, away=away, outcome=outcome, season='test', phase='regular',
                start=f'2026-10-{day:02}T12:00:00Z', end=f'2026-10-{day:02}T15:00:00Z',
                available_at=f'2026-10-{day:02}T16:00:00Z')


def fixture(gid, home, away):
    return dict(id=gid, home=home, away=away, season='test', phase='regular',
                start='2026-10-21T12:00:00Z', known_at='2026-09-01T00:00:00Z', status='scheduled')


def envelope(teams, rows, fixtures, kappa=2, mode='final_win'):
    return dict(teams=list(teams), season=dict(id='test', start='2026-09-01T00:00:00Z', end='2027-07-01T00:00:00Z'),
                as_of=T, horizon=dict(kind='future_as_of', start=T, end='2026-10-28T00:00:00Z'),
                config=dict(mode=mode, kappa=str(kappa), prior_mean='.55' if mode=='points_credit' else '.5',
                            prior_known_at='2026-08-01T00:00:00Z', points_per_win=2),
                history=dict(as_of=T, complete_teams=list(teams), results=rows),
                schedule=dict(observed_at='2026-10-19T00:00:00Z', start=T, end='2026-10-28T00:00:00Z',
                              complete_teams=list(teams), fixtures=fixtures))


def credit(row, team, mode):
    side = 'home' if row['home'] == team else 'away'
    extra = not row['outcome'].endswith('_reg')
    won = row['outcome'].startswith(side+'_')
    if mode == 'regulation_equivalent' and extra:
        return Q(1, 2)
    if mode == 'points_credit':
        if side+'_points' in row:
            return Q(row[side+'_points'], 2)
        return Q(1) if won else Q(1, 2) if extra else Q(0)
    return Q(int(won))


def pairs(rows, team, excluded):
    return [(r, r['away'] if r['home'] == team else r['home']) for r in rows
            if team in (r['home'], r['away']) and not ({r['home'], r['away']} & set(excluded))]


def exact_record(rows, focal, opponents, kappa, mu, mode):
    def rate(team, excluded):
        eligible = pairs(rows, team, excluded)
        denominator = len(eligible) + kappa
        return (sum(credit(r, team, mode) for r, _ in eligible) + kappa*mu)/denominator if denominator else None
    def mean(values):
        return sum(values)/len(values) if values and all(v is not None for v in values) else None
    direct = mean([rate(j, {focal}) for j in opponents])
    indirect_terms = []
    for j in opponents:
        inner = pairs(rows, j, {focal})
        indirect_terms.append(mean([rate(k, {focal, j}) for _, k in inner]) if inner else mu)
    indirect = mean(indirect_terms)
    return direct, (2*direct+indirect)/3 if direct is not None and indirect is not None else None


def exact_colley(teams, rows, mode, excluded=()):
    """Fraction Gaussian elimination, independent of candidate's float Cholesky."""
    cohort = [t for t in teams if t not in excluded]
    matrix = [[Q(2*int(a==b)) for b in cohort]+[Q(1)] for a in cohort]
    for row in rows:
        h, a = row['home'], row['away']
        if h not in cohort or a not in cohort:
            continue
        i, j = cohort.index(h), cohort.index(a)
        matrix[i][i] += 1; matrix[j][j] += 1
        matrix[i][j] -= 1; matrix[j][i] -= 1
        matrix[i][-1] += credit(row, h, mode)-Q(1,2)
        matrix[j][-1] += credit(row, a, mode)-Q(1,2)
    for i in range(len(cohort)):
        pivot = matrix[i][i]
        matrix[i] = [v/pivot for v in matrix[i]]
        for j in range(len(cohort)):
            if j != i:
                scale = matrix[j][i]
                matrix[j] = [x-scale*y for x,y in zip(matrix[j],matrix[i])]
    return dict(zip(cohort, (r[-1] for r in matrix)))


class IndependentReview(unittest.TestCase):
    def close(self, actual, expected):
        if expected is None:
            self.assertIsNone(actual)
        else:
            self.assertAlmostEqual(actual, float(expected), places=12)

    def test_exact_oracles_on_heterogeneous_multigraphs(self):
        rng = random.Random(2301026)
        teams = list('ABCDEF')
        for count in (0, 4, 17, 31):
            rows = []
            for i in range(count):
                h,a = rng.sample(teams, 2)
                r = result(str(i), h, a, rng.choice(('home_reg','away_reg','home_ot','away_so')))
                if i % 7 == 0:
                    r.update(home_points=0,away_points=0)
                rows.append(r)
            fs = [fixture('f'+str(i), *rng.sample(teams,2)) for i in range(11)]
            for mode in ('final_win','regulation_equivalent','points_credit'):
                for kappa in (0,2,8):
                    p = envelope(teams, rows, fs, kappa, mode)
                    got = calculate(p)
                    for t in teams:
                        opponents = [f['away'] if f['home']==t else f['home'] for f in fs if t in (f['home'],f['away'])]
                        expected = exact_record(rows,t,opponents,Q(kappa),Q(p['config']['prior_mean']),mode)
                        for metric, value in zip(METRICS,expected): self.close(got['teams'][t][metric],value)
                        if mode != 'points_credit':
                            fit = exact_colley(teams,rows,mode,{t})
                            self.close(got['teams'][t]['colley_sos'],sum(fit[o] for o in opponents)/len(opponents) if opponents else None)
                    if mode != 'points_credit':
                        fit = exact_colley(teams,rows,mode)
                        self.assertEqual(sum(fit.values())/len(fit),Q(1,2))
                        for t in teams: self.close(got['quality_colley']['ratings'][t],fit[t])

    def test_corrected_stability_by_exact_independent_solve(self):
        teams = list('ABCDEF')
        rows = [result(h+a,h,a) for h in teams for a in teams if h!=a]
        changed = copy.deepcopy(rows)
        next(r for r in changed if r['id']=='AB')['outcome']='away_reg'
        fs = [fixture('ac','A','C'),fixture('bd','B','D'),fixture('ef','E','F')]
        before,after = calculate(envelope(teams,rows,fs)),calculate(envelope(teams,changed,fs))
        for t in teams:
            o = next(f['away'] if f['home']==t else f['home'] for f in fs if t in (f['home'],f['away']))
            rec0,rec1 = exact_record(rows,t,[o],Q(2),Q(1,2),'final_win'),exact_record(changed,t,[o],Q(2),Q(1,2),'final_win')
            c0,c1 = exact_colley(teams,rows,'final_win',{t})[o],exact_colley(teams,changed,'final_win',{t})[o]
            sign = -1 if t=='C' else 1 if t=='D' else 0
            deltas = (rec1[0]-rec0[0],rec1[1]-rec0[1],c1-c0)
            self.assertEqual(deltas,tuple(sign*v for v in (Q(1,10),Q(1,15),Q(1,12))))
            for metric,delta in zip(METRICS,deltas):
                self.close(after['teams'][t][metric]-before['teams'][t][metric],delta)
                self.assertEqual(after['teams'][t][metric+'_rank'],6 if t=='C' else 1 if t=='D' else 2)

    def test_outer_fixture_weights_and_no_missing_renormalization(self):
        rows = [result('ax'+str(i),'A','X','home_reg' if i<4 else 'away_reg') for i in range(5)]
        rows += [result('by'+str(i),'B','Y','home_reg' if i==0 else 'away_reg') for i in range(10)]
        fs = [fixture(str(i),'I','A') for i in range(3)]+[fixture('b','I','B')]
        p = envelope('IABXYU',rows,fs,0)
        self.assertEqual(calculate(p)['teams']['I']['direct_sos'],float(Q(5,8)))
        p['schedule']['fixtures'].append(fixture('missing','I','U'))
        got = calculate(p)['teams']['I']
        self.assertEqual(got['fixture_count'],5)
        self.assertIsNone(got['direct_sos'])
        self.assertIsNone(got['rpi_sos'])

    def test_self_results_and_future_list_do_not_refit_quality(self):
        rows = [result('AB','A','B'),result('BC','B','C'),result('CD','C','D','away_ot'),result('DA','D','A')]
        p = envelope('ABCD',rows,[fixture('AC','A','C')])
        first = calculate(p)
        q = copy.deepcopy(p)
        for row in q['history']['results']:
            if 'A' in (row['home'],row['away']): row['outcome']='away_so'
        second = calculate(q)
        for metric in METRICS: self.assertEqual(first['teams']['A'][metric],second['teams']['A'][metric])
        q = copy.deepcopy(p);q['schedule']['fixtures'].append(fixture('AB','A','B'))
        # Use a separate future identity, so historic AB cannot masquerade as upcoming.
        q['schedule']['fixtures'][-1]['id']='futureAB'
        self.assertEqual(first['quality_colley'],calculate(q)['quality_colley'])

    def test_cutoff_boundaries_and_late_correction_are_excluded(self):
        p = envelope('ABCD',[result('BC','B','C')],[fixture('AB','A','B')])
        base = calculate(p)
        for published in (T,'2026-10-22T00:00:00Z'):
            q = copy.deepcopy(p)
            late = result('late','B','C','away_reg');late['available_at']=published
            q['history']['results'].append(late)
            self.assertEqual(base['teams'],calculate(q)['teams'])
        q = copy.deepcopy(p); q['schedule']['fixtures'][0]['known_at']=T
        with self.assertRaises(ValueError): calculate(q)
        q = copy.deepcopy(p); q['schedule']['fixtures'][0]['start']='2026-10-28T00:00:00Z'
        self.assertEqual(calculate(q)['teams']['A']['fixture_count'],0)

    def test_retrospective_and_faced_then_do_not_share_later_evidence(self):
        past = envelope('ABC',[result('AB','A','B'),result('BC','B','C',day=15)],[])
        past['horizon']=dict(kind='past_retrospective',start='2026-10-09T00:00:00Z',end='2026-10-11T00:00:00Z')
        early = envelope('ABC',[],[fixture('AB','A','B')])
        early['as_of']='2026-10-10T10:00:00Z';early['history']['as_of']=early['as_of']
        early['horizon'].update(start=early['as_of'],end='2026-10-11T00:00:00Z')
        early['schedule'].update(start=early['as_of'],observed_at='2026-10-10T09:00:00Z')
        early['schedule']['fixtures'][0]['start']=past['history']['results'][0]['start']
        retro = calculate(past)['teams']['A']['direct_sos']
        then = faced_then(past,[dict(fixture_id='AB',snapshot=early)])
        self.assertEqual(retro,float(Q(2,3)))
        self.assertEqual(then['teams']['A']['direct_sos'],.5)
        self.assertIsNone(faced_then(past,[])['teams']['A']['direct_sos'])
        poisoned = copy.deepcopy(early)
        poisoned['history']['results']=[past['history']['results'][1]]
        self.assertEqual(then,faced_then(past,[dict(fixture_id='AB',snapshot=poisoned)]))

    def test_partial_schedule_and_history_withhold_metrics(self):
        p = envelope('ABC',[result('BC','B','C')],[fixture('AB','A','B'),fixture('AC','A','C')])
        p['schedule']['fixtures'][1]['status']='unknown'
        got = calculate(p)
        self.assertEqual(got['teams']['A']['fixture_count'],1)
        self.assertEqual(got['teams']['A']['unresolved_fixture_ids'],['AC'])
        for m in METRICS: self.assertIsNone(got['teams']['A'][m])
        p['history']['complete_teams']=['A','B']
        got = calculate(p)
        self.assertIsNone(got['quality_colley'])
        for row in got['teams'].values():
            for m in METRICS: self.assertIsNone(row[m])


if __name__ == '__main__':
    unittest.main(verbosity=2)
