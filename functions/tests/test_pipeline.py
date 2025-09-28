from lib.sustainability.pipeline import run_pre_scoring_pipeline
from lib.sustainability.config_loader import DEFAULT_CONFIG, SustainabilityConfig
from lib.sustainability.priors import LeaguePriorRow


def _fake_cfg():
    return SustainabilityConfig(
        model_version=DEFAULT_CONFIG['model_version'],
        weights=DEFAULT_CONFIG['weights_json'],
        toggles=DEFAULT_CONFIG['toggles_json'],
        constants=DEFAULT_CONFIG['constants_json'],
        sd_mode='fixed',
        freshness_days=DEFAULT_CONFIG['freshness_days'],
        config_hash='testhash',
        source='default',
    )


def test_run_pre_scoring_pipeline_minimal():
    # Minimal synthetic dataset for one player, 3 games
    games = [
        {'player_id':1,'season_id':2025,'position_code':'F','game_id':'G1','game_date':'2025-01-01','shots':4,'goals':1,'onice_goals_for':2,'onice_shots_for':12,'points':1,'ixg':0.6,'icf':5,'hdcf':2},
        {'player_id':1,'season_id':2025,'position_code':'F','game_id':'G2','game_date':'2025-01-05','shots':3,'goals':0,'onice_goals_for':1,'onice_shots_for':10,'points':0,'ixg':0.4,'icf':4,'hdcf':1},
        {'player_id':1,'season_id':2025,'position_code':'F','game_id':'G3','game_date':'2025-01-08','shots':5,'goals':1,'onice_goals_for':3,'onice_shots_for':15,'points':1,'ixg':0.8,'icf':6,'hdcf':2},
    ]
    # League priors (simple neutral-ish examples)
    league_priors = [
        LeaguePriorRow(season_id=2025, position_code='F', stat_code='sh_pct', alpha0=5, beta0=45, k=50, league_mu=0.10),
        LeaguePriorRow(season_id=2025, position_code='F', stat_code='oish_pct', alpha0=12, beta0=138, k=150, league_mu=0.08),
        LeaguePriorRow(season_id=2025, position_code='F', stat_code='ipp', alpha0=18, beta0=12, k=30, league_mu=0.60),
    ]
    cfg = _fake_cfg()
    result = run_pre_scoring_pipeline(
        season_id=2025,
        games=games,
        cfg=cfg,
        league_priors=league_priors,
        player_priors_rows=[
            {'player_id':1,'season_id':2025,'position_code':'F','stat_code':'sh_pct','successes_blend':2,'trials_blend':12,'post_mean':0.10,'rookie_status':False,'model_version':cfg.model_version},
            {'player_id':1,'season_id':2025,'position_code':'F','stat_code':'oish_pct','successes_blend':6,'trials_blend':37,'post_mean':0.081,'rookie_status':False,'model_version':cfg.model_version},
            {'player_id':1,'season_id':2025,'position_code':'F','stat_code':'ipp','successes_blend':2,'trials_blend':6,'post_mean':0.62,'rookie_status':False,'model_version':cfg.model_version},
        ],
    )
    assert 'windows_enriched' in result
    enriched = result['windows_enriched']
    # Each game -> 4 windows =>3*4=12
    assert len(enriched) == 12
    # Check presence of z_ and r_ fields for a sample row
    sample = enriched[-1]
    assert 'z_sh_pct' in sample and 'r_sh_pct' in sample
    assert sample['window_type'] in {'GAME','G5','G10','STD'}
