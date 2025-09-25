"""Helper utilities for feature contribution summarisation."""

from __future__ import annotations

from typing import Sequence

import numpy as np


def _validate_lengths(contributions: Sequence[float], feature_names: Sequence[str]) -> tuple[np.ndarray, list[str]]:
    contrib_array = np.asarray(contributions, dtype=float)
    names = list(feature_names)
    if contrib_array.ndim != 1:
        raise ValueError("Contribution vector must be 1-dimensional per prediction")
    if contrib_array.size == len(names) + 1:
        # Drop bias term if present (LightGBM/XGBoost append it as the final element)
        contrib_array = contrib_array[:-1]
    if contrib_array.size != len(names):
        raise ValueError(
            "Contribution vector length and feature names length do not match"
        )
    return contrib_array, names


def extract_top_feature_contributions(
    contributions: Sequence[float],
    feature_names: Sequence[str],
    *,
    top_n: int = 5,
    min_abs_contribution: float = 1e-3,
) -> list[dict[str, float]]:
    """Return the top-N feature contributions with absolute value filter.

    Parameters
    ----------
    contributions:
        Per-feature contribution values (optionally including a trailing bias term).
    feature_names:
        Names aligned with the contribution vector.
    top_n:
        Maximum number of records to return.
    min_abs_contribution:
        Minimum absolute contribution to keep a feature.
    """

    contrib_array, names = _validate_lengths(contributions, feature_names)
    abs_values = np.abs(contrib_array)
    order = np.argsort(abs_values)[::-1]

    results: list[dict[str, float]] = []
    for idx in order[:top_n]:
        value = float(contrib_array[idx])
        if abs(value) < min_abs_contribution:
            break
        results.append(
            {
                "feature": names[idx],
                "contribution": value,
                "abs_contribution": abs(value),
            }
        )
    return results


__all__ = ["extract_top_feature_contributions"]
