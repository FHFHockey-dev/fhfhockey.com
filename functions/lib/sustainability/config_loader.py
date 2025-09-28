"""Configuration loader for Sustainability Barometer (sub-task 2.1).

Responsibilities:
  * Fetch active model configuration row (highest model_version where active=true).
  * Provide typed accessors for weights, toggles, constants, k_r, guardrails, etc.
  * Compute deterministic config_hash (JSON canonicalization + SHA256) for reproducibility.
  * Graceful fallback to embedded defaults if DB row missing (logged warning).

NOTE: DB access layer is abstracted; adapt `fetch_active_config_row` to your existing
database client (e.g., Supabase Python, psycopg2, or internal wrapper).
"""

from __future__ import annotations

import json
import hashlib
from dataclasses import dataclass, field
from typing import Any, Dict, Optional, Tuple


DEFAULT_CONFIG = {
    "model_version": 1,
    "weights_json": {
        "sh_pct": -1.2,
        "oish_pct": -1.0,
        "oisv_pct": -0.8,
        "ipp": -0.8,
        "finish_res_rate": -0.6,
        "finish_res_cnt": -0.4,
        "ixg_per60": 0.9,
        "icf_per60": 0.7,
        "hdcf_per60": 0.6,
    },
    "toggles_json": {
        "use_finishing_residuals": True,
        "cap_team_context": False,
        "split_strengths": False,
    },
    "constants_json": {
        "c": 3.0,
        "k_r": {"sh_pct": 50, "oish_pct": 150, "ipp": 30},
        "guardrails": {"upper_raw": 0.995, "lower_raw": 0.005},
        "quintiles": {"strategy": "dynamic"},
    },
    "sd_mode": "fixed",
    "freshness_days": 45,
}


REQUIRED_WEIGHT_KEYS = {
    "sh_pct",
    "oish_pct",
    "oisv_pct",
    "ipp",
    "ixg_per60",
    "icf_per60",
    "hdcf_per60",
}

REQUIRED_TOGGLE_KEYS = {
    "use_finishing_residuals",
    "cap_team_context",
    "split_strengths",
}

REQUIRED_CONSTANT_KEYS = {"c", "k_r", "guardrails", "quintiles"}

# Metrics requiring reliability k_r constants (subset of weights)
RELIABILITY_METRICS = {"sh_pct", "oish_pct", "ipp"}


@dataclass(frozen=True)
class SustainabilityConfig:
    model_version: int
    weights: Dict[str, float]
    toggles: Dict[str, Any]
    constants: Dict[str, Any]
    sd_mode: str
    freshness_days: int
    config_hash: str
    source: str = field(default="db")  # 'db' | 'default'

    @property
    def k_r(self) -> Dict[str, int]:
        return self.constants.get("k_r", {})

    @property
    def guardrails(self) -> Dict[str, float]:
        return self.constants.get("guardrails", {})

    @property
    def c(self) -> float:
        return float(self.constants.get("c", 3.0))


class ConfigLoadError(RuntimeError):
    pass


def canonical_json(value: Any) -> str:
    """Return a canonical JSON string (sorted keys, no whitespace) for hashing."""
    return json.dumps(value, sort_keys=True, separators=(",", ":"))


def compute_hash(payload: Dict[str, Any]) -> str:
    h = hashlib.sha256()
    h.update(canonical_json(payload).encode("utf-8"))
    return h.hexdigest()


def fetch_active_config_row(db_client) -> Optional[Dict[str, Any]]:
    """Fetch the active config row from DB.

    EXPECTED SCHEMA FIELDS:
        model_version, weights_json, toggles_json, constants_json, sd_mode, freshness_days

    Replace this placeholder with actual query logic. Return None if no rows.
    """
    # Placeholder implementation; integrate with actual DB layer.
    return None


def validate_config(raw: Dict[str, Any]) -> Tuple[bool, str]:
    """Validate structural correctness of a raw config row.

    Returns (ok, message). If ok=False, message concatenates issues.
    Validation Layers:
      * Required top-level maps (weights, toggles, constants)
      * Required weight keys
      * Required toggles keys
      * Required constants keys
      * k_r coverage for reliability metrics
      * Guardrails structure (upper_raw > lower_raw in (0,1))
      * sd_mode enumeration
      * freshness_days presence & positive integer
    """
    missing = []
    weights = raw.get("weights_json", {})
    toggles = raw.get("toggles_json", {})
    constants = raw.get("constants_json", {})

    if not isinstance(weights, dict):
        missing.append("weights_json not dict")
    if not isinstance(toggles, dict):
        missing.append("toggles_json not dict")
    if not isinstance(constants, dict):
        missing.append("constants_json not dict")

    if not REQUIRED_WEIGHT_KEYS.issubset(weights.keys()):
        diff = REQUIRED_WEIGHT_KEYS - set(weights.keys())
        missing.append(f"weights_json missing: {sorted(diff)}")
    if not REQUIRED_TOGGLE_KEYS.issubset(toggles.keys()):
        diff = REQUIRED_TOGGLE_KEYS - set(toggles.keys())
        missing.append(f"toggles_json missing: {sorted(diff)}")
    if not REQUIRED_CONSTANT_KEYS.issubset(constants.keys()):
        diff = REQUIRED_CONSTANT_KEYS - set(constants.keys())
        missing.append(f"constants_json missing: {sorted(diff)}")

    # k_r coverage
    k_r = constants.get("k_r", {})
    if isinstance(k_r, dict):
        if not RELIABILITY_METRICS.issubset(k_r.keys()):
            diff = RELIABILITY_METRICS - set(k_r.keys())
            missing.append(f"k_r missing metrics: {sorted(diff)}")
    else:
        missing.append("k_r not dict")

    # Guardrails shape
    guardrails = constants.get("guardrails", {})
    if isinstance(guardrails, dict):
        upper = guardrails.get("upper_raw")
        lower = guardrails.get("lower_raw")
        if not (isinstance(upper, (int, float)) and isinstance(lower, (int, float))):
            missing.append("guardrails upper_raw/lower_raw must be numeric")
        else:
            if not (0 < lower < upper < 1):
                missing.append("guardrails bounds invalid (expect 0 < lower_raw < upper_raw < 1)")
    else:
        missing.append("guardrails not dict")

    # sd_mode
    if raw.get("sd_mode") not in {"fixed", "empirical"}:
        missing.append("sd_mode invalid (expected 'fixed' or 'empirical')")

    # freshness_days
    freshness = raw.get("freshness_days")
    if freshness is None:
        missing.append("freshness_days missing")
    else:
        try:
            if int(freshness) <= 0:
                missing.append("freshness_days must be > 0")
        except Exception:
            missing.append("freshness_days not integer")

    return (len(missing) == 0, "; ".join(missing))


def load_config(db_client=None, allow_fallback: bool = True) -> SustainabilityConfig:
    """Load active sustainability config with validation & hashing.

    If DB returns no active row and fallback allowed, returns DEFAULT_CONFIG (source='default').
    Raises ConfigLoadError if validation fails and fallback disabled.
    """
    row = fetch_active_config_row(db_client)
    source = "db"
    if row is None:
        if not allow_fallback:
            raise ConfigLoadError("No active configuration row found and fallback disabled.")
        row = DEFAULT_CONFIG.copy()
        source = "default"

    ok, issues = validate_config(row)
    if not ok:
        if allow_fallback and source == "db":
            # Attempt fallback to defaults
            df_ok, df_issues = validate_config(DEFAULT_CONFIG)
            if not df_ok:
                raise ConfigLoadError(
                    f"Active config invalid ({issues}) and default invalid ({df_issues})."
                )
            row = DEFAULT_CONFIG.copy()
            source = "default"
        else:
            raise ConfigLoadError(f"Configuration validation failed: {issues}")

    hash_payload = {
        "model_version": row.get("model_version"),
        "weights_json": row.get("weights_json"),
        "toggles_json": row.get("toggles_json"),
        "constants_json": row.get("constants_json"),
        "sd_mode": row.get("sd_mode"),
        "freshness_days": row.get("freshness_days"),
    }
    cfg_hash = compute_hash(hash_payload)

    return SustainabilityConfig(
        model_version=row["model_version"],
        weights=row["weights_json"],
        toggles=row["toggles_json"],
        constants=row["constants_json"],
        sd_mode=row["sd_mode"],
        freshness_days=row["freshness_days"],
        config_hash=cfg_hash,
        source=source,
    )


__all__ = [
    "SustainabilityConfig",
    "ConfigLoadError",
    "load_config",
    "compute_hash",
    "canonical_json",
]
