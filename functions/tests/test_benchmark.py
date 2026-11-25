import random
from types import SimpleNamespace

from lib.sustainability import benchmark
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


def test_seeded_benchmark_repeats_synthetic_inputs_without_changing_global_rng(monkeypatch):
    generated = []

    def capture_run(*, games, **kwargs):
        generated.append(games)
        return SimpleNamespace(to_dict=lambda: {})

    monkeypatch.setattr(benchmark, "orchestrate_full_run", capture_run)
    initial_rng_state = random.getstate()

    for seed in (0, 0, 1):
        run_performance_benchmark(n_players=2, n_games=3, fast=True, seed=seed)

    assert len(generated[0]) == 6
    assert generated[0] == generated[1]
    assert generated[0] != generated[2]
    assert random.getstate() == initial_rng_state
