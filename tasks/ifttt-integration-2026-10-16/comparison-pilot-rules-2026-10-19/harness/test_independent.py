import copy,json,unittest
from pathlib import Path
from comparison import grade
class IndependentMasks(unittest.TestCase):
 def test_mixed_gradability_does_not_penalize_ungradable_predictions(self):
  f=copy.deepcopy(json.loads(Path(__file__).with_name('fixtures.json').read_text())['fixtures'][3])
  labels=f['labels'];labels['claims'][0]['gradable'].remove('team')
  labels['claims'][1]['expected']['team']='Harbor'
  claims=f['mock_extraction']['claims'];claims[0]['team']='unverified-context';claims[1]['team']='Harbor'
  result=grade(f['source'],labels,[dict(claim=c,accepted=False,holds=['independent-control']) for c in claims])
  Path(__file__).parents[1].joinpath('mixed-gradability-evidence.json').write_text(json.dumps(dict(labels=labels,claims=claims,actual=result,expected_team_precision=1.0),indent=2)+'\n')
  self.assertEqual(result['field_accuracy']['team']['correct_nonnull'],1)
  self.assertEqual(result['field_accuracy']['team']['precision'],1.0,'Ungradable matched fields must not enter precision denominator')
