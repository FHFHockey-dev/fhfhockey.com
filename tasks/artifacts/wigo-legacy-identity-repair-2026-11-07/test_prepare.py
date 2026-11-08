import copy
import unittest
import prepare

class IdentityTests(unittest.TestCase):
    def setUp(self):
        self.row = dict(id=1,player_id=8475253,date='2019-03-09',season_id=20182019,game_id=None,team_abbrev=None,opponent_team_abbrev=None,home_road=None,games_played=1,goals=0,assists=0,points=0,shots=1,plus_minus=0,penalty_minutes=0,toi_per_game=546,before_md5='a'*32,preserved_md5='b'*32)
        self.game = dict(gameId=2018021041,gameDate='2019-03-09',teamAbbrev='PIT',opponentAbbrev='CBJ',homeRoadFlag='R',goals=0,assists=0,points=0,shots=1,plusMinus=0,pim=0,toi='9:06')
        self.source = dict(seasonId=20182019,gameTypeId=2,gameLog=[self.game])
    def test_exact_match_preserves_input(self):
        before=copy.deepcopy(self.row)
        result=prepare.match(self.row,self.source)
        self.assertEqual(self.row,before)
        self.assertEqual(result['game_id'],2018021041)
        self.assertEqual(set(result)-{'id','player_id','date','season_id','original_season_id','before_md5','preserved_md5'},set(prepare.IDENTITY))
    def test_no_date_match(self):
        self.game['gameDate']='2019-03-10'
        with self.assertRaisesRegex(ValueError,'Expected one'): prepare.match(self.row,self.source)
    def test_ambiguous_date(self):
        self.source['gameLog'].append(dict(self.game))
        with self.assertRaisesRegex(ValueError,'Expected one'): prepare.match(self.row,self.source)
    def test_source_season_or_type_mismatch(self):
        for field,value in [('seasonId',20192020),('gameTypeId',3)]:
            with self.subTest(field=field):
                source={**self.source,field:value}
                with self.assertRaisesRegex(ValueError,'Season/type'): prepare.match(self.row,source)
    def test_bad_game_id(self):
        for value in [None,'2018021041',2018031041,2019021041]:
            with self.subTest(value=value):
                self.game['gameId']=value
                with self.assertRaisesRegex(ValueError,'game ID'): prepare.match(self.row,self.source)
    def test_stats_conflict_is_not_overwritten(self):
        self.game['shots']=2
        with self.assertRaisesRegex(ValueError,'Stat mismatch'): prepare.match(self.row,self.source)
    def test_null_metric_is_not_zero(self):
        self.row['goals']=None
        with self.assertRaisesRegex(ValueError,'Stat mismatch'): prepare.match(self.row,self.source)
    def test_toi_conflict(self):
        self.game['toi']='9:07'
        with self.assertRaisesRegex(ValueError,'TOI mismatch'): prepare.match(self.row,self.source)
    def test_existing_identity_is_not_overwritten(self):
        for field in prepare.IDENTITY:
            with self.subTest(field=field):
                row={**self.row,field:'already set'}
                with self.assertRaisesRegex(ValueError,'all-null'): prepare.match(row,self.source)
    def test_explicit_authoritative_season_correction(self):
        self.row['season_id']=20242025
        with self.assertRaisesRegex(ValueError,'Season/type'): prepare.match(self.row,self.source)
        result=prepare.match(self.row,self.source,allow_season_correction=True)
        self.assertEqual(result['season_id'],20182019)
        self.assertEqual(result['original_season_id'],20242025)
    def test_official_summary_adapter(self):
        raw={**self.game,'playerId':8475253,'gamesPlayed':1,'timeOnIcePerGame':546,'penaltyMinutes':0,'opponentTeamAbbrev':'CBJ','homeRoad':'R'}
        source=prepare.normalize_summary({'data':[raw],'total':1},8475253,20182019)
        self.assertEqual(prepare.match(self.row,source)['game_id'],2018021041)
    def test_summary_rejects_truncation(self):
        with self.assertRaisesRegex(ValueError,'Incomplete'): prepare.normalize_summary({'data':[],'total':15},8475253,20182019)
    def test_summary_rejects_wrong_player(self):
        raw={**self.game,'playerId':999,'gamesPlayed':1,'timeOnIcePerGame':546}
        with self.assertRaisesRegex(ValueError,'player/season/type'): prepare.normalize_summary({'data':[raw],'total':1},8475253,20182019)
    def test_summary_rejects_wrong_season(self):
        raw={**self.game,'playerId':8475253,'gamesPlayed':1,'timeOnIcePerGame':546}
        with self.assertRaisesRegex(ValueError,'player/season/type'): prepare.normalize_summary({'data':[raw],'total':1},8475253,20242025)
    def test_bad_matchup(self):
        for field,value in [('teamAbbrev','X;DROP'),('opponentAbbrev','PIT'),('homeRoadFlag','A')]:
            with self.subTest(field=field):
                game={**self.game,field:value}
                with self.assertRaises(ValueError): prepare.match(self.row,{**self.source,'gameLog':[game]})

if __name__=='__main__': unittest.main()
