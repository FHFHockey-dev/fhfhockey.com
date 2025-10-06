"""Sustainability model constants & enums (sub-tasks 2.7 & 2.8).

Provides:
  * Metric code canonical list & human-friendly labels.
  * Fallback fixed standard deviation constants (initial SD mode 'fixed').
  * Loader helper to fetch SD constants from DB if available, else fallback.

DB EXPECTATION (sustainability_sigma_constants):
  Columns: metric_code TEXT, position_code TEXT, sd_value NUMERIC
  Composite PK or unique(metric_code, position_code).

NOTE: Values here are placeholders; replace with empirically derived figures
once enough sample size accumulates and/or switch to 'empirical' mode.
"""

from __future__ import annotations

from typing import Dict, Any, Iterable


METRIC_CODES = [
    "sh_pct",
    "oish_pct",
    "oisv_pct",
    "ipp",
    "finish_res_rate",
    "finish_res_cnt",
    "ixg_per60",
    "icf_per60",
    "hdcf_per60",
]

HUMAN_LABELS: Dict[str, str] = {
    "sh_pct": "Shooting%",
    "oish_pct": "On-Ice Sh%",
    "oisv_pct": "On-Ice Sv%",
    "ipp": "IPP",
    "finish_res_rate": "Finishing Residual (Rate)",
    "finish_res_cnt": "Finishing Residual (Count)",
    "ixg_per60": "ixG/60",
    "icf_per60": "iCF/60",
    "hdcf_per60": "HDCF/60",
}

# Fallback fixed standard deviations per metric × position (F=forward, D=defense)
FALLBACK_SD_CONSTANTS: Dict[str, Dict[str, float]] = {
    "sh_pct": {"F": 0.045, "D": 0.040},
    "oish_pct": {"F": 0.035, "D": 0.032},
    "oisv_pct": {"F": 0.025, "D": 0.025},  # more stable
    "ipp": {"F": 0.12, "D": 0.10},
    "finish_res_rate": {"F": 0.20, "D": 0.18},
    "finish_res_cnt": {"F": 1.50, "D": 1.25},
    "ixg_per60": {"F": 0.70, "D": 0.40},
    "icf_per60": {"F": 2.20, "D": 1.10},
    "hdcf_per60": {"F": 0.90, "D": 0.55},
}


def load_sd_constants(db_client=None, fallback: Dict[str, Dict[str, float]] | None = None) -> Dict[str, Dict[str, float]]:
    """Load SD constants from DB or fallback.

    Returns mapping metric_code -> position_code -> sd_value.
    If db_client is None or query fails/returns empty, fallback is used.
    """
    if fallback is None:
        fallback = FALLBACK_SD_CONSTANTS

    if db_client is None:
        return fallback

    try:
        rows: Iterable[dict] = getattr(db_client, "fetch_sd_constants", lambda: [])()
        data: Dict[str, Dict[str, float]] = {}
        for r in rows or []:
            m = r.get("metric_code")
            p = r.get("position_code")
            v = r.get("sd_value")
            if m and p and v is not None:
                data.setdefault(m, {})[p] = float(v)
        # If nothing valid came back, use fallback
        if not data:
            return fallback
        # Ensure any missing metric or position key is filled with fallback to avoid KeyError downstream
        for m in METRIC_CODES:
            fb_positions = fallback.get(m, {})
            tgt = data.setdefault(m, {})
            for pos, fb_val in fb_positions.items():
                tgt.setdefault(pos, fb_val)
        return data
    except Exception:
        return fallback


__all__ = [
    "METRIC_CODES",
    "HUMAN_LABELS",
    "FALLBACK_SD_CONSTANTS",
    "load_sd_constants",
]
