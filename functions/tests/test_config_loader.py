import copy
import pytest

from lib.sustainability.config_loader import (
    DEFAULT_CONFIG,
    compute_hash,
    build_config_hash_payload,
    load_config,
    SustainabilityConfig,
    cross_validate_weights_vs_toggles,
    ConfigUpsertError,
    upsert_new_config_version,
)
from lib.sustainability.constants import load_sd_constants, FALLBACK_SD_CONSTANTS


class DummyClient:
    def __init__(self, row):
        self._row = row


def test_hash_deterministic_key_order():
    row_a = copy.deepcopy(DEFAULT_CONFIG)
    # Reorder inner dict keys by constructing new dicts in different order
    row_b = copy.deepcopy(DEFAULT_CONFIG)
    row_b["weights_json"] = {k: row_b["weights_json"][k] for k in sorted(row_b["weights_json"].keys(), reverse=True)}
    row_b["toggles_json"] = {k: row_b["toggles_json"][k] for k in sorted(row_b["toggles_json"].keys(), reverse=True)}
    row_b["constants_json"] = {
        # intentionally shuffle order
        "quintiles": row_b["constants_json"]["quintiles"],
        "guardrails": row_b["constants_json"]["guardrails"],
        "k_r": row_b["constants_json"]["k_r"],
        "c": row_b["constants_json"]["c"],
    }

    hash_a = compute_hash(build_config_hash_payload(row_a))
    hash_b = compute_hash(build_config_hash_payload(row_b))
    assert hash_a == hash_b, "Config hash should be stable across key ordering differences"


def test_load_config_fallback(monkeypatch):
    # Simulate no DB row -> fallback to default
    class NoRowClient:
        pass

    cfg = load_config(db_client=NoRowClient(), allow_fallback=True)
    assert isinstance(cfg, SustainabilityConfig)
    assert cfg.source == "default"
    assert cfg.model_version == DEFAULT_CONFIG["model_version"]


def test_validation_failure_without_fallback(monkeypatch):
    bad_row = copy.deepcopy(DEFAULT_CONFIG)
    del bad_row["weights_json"]["sh_pct"]

    def fake_fetch(_):
        return bad_row

    from lib.sustainability import config_loader as cl
    monkeypatch.setattr(cl, "fetch_active_config_row", fake_fetch)

    with pytest.raises(Exception):
        load_config(db_client=None, allow_fallback=False)


def test_validation_failure_with_fallback(monkeypatch):
    bad_row = copy.deepcopy(DEFAULT_CONFIG)
    del bad_row["weights_json"]["sh_pct"]

    def fake_fetch(_):
        return bad_row

    from lib.sustainability import config_loader as cl
    monkeypatch.setattr(cl, "fetch_active_config_row", fake_fetch)

    cfg = load_config(db_client=None, allow_fallback=True)
    assert cfg.source == "default"


def test_cross_validate_weights_vs_toggles_pass():
    cfg = load_config(db_client=None, allow_fallback=True)
    cross_validate_weights_vs_toggles(cfg)  # should not raise


def test_cross_validate_weights_vs_toggles_missing_weight(monkeypatch):
    bad = copy.deepcopy(DEFAULT_CONFIG)
    # Toggle on finishing residuals but remove a residual weight
    bad["weights_json"].pop("finish_res_rate", None)

    def fake_fetch(_):
        return bad

    from lib.sustainability import config_loader as cl
    monkeypatch.setattr(cl, "fetch_active_config_row", fake_fetch)

    cfg = load_config(db_client=None, allow_fallback=False)
    with pytest.raises(Exception):
        cross_validate_weights_vs_toggles(cfg)


def test_sd_constants_loader_fallback():
    data = load_sd_constants(db_client=None)
    assert data["sh_pct"]["F"] == FALLBACK_SD_CONSTANTS["sh_pct"]["F"]


def test_upsert_stub_raises():
    with pytest.raises(ConfigUpsertError):
        upsert_new_config_version(None, {}, {}, {}, "fixed", 45)


if __name__ == "__main__":
    pytest.main([__file__])
