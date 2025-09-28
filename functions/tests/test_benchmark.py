from lib.sustainability.benchmark import run_performance_benchmark


def test_run_performance_benchmark_fast_mode():
    summary = run_performance_benchmark(n_players=800, n_games=20, fast=True)
    # Ensure structure
    assert 'duration_total_ms' in summary
    assert summary['players'] <= 800  # fast mode may cap
    pipe = summary['pipeline_summary']
    assert 'total_rows_scored' in pipe
    # Sanity: total_rows_scored should be > 0
    assert pipe['total_rows_scored'] > 0
