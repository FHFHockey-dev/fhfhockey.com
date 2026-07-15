"""Deterministic name normalization and thresholded fuzzy player matching."""

from __future__ import annotations

import json
import re
from pathlib import Path
from typing import Any, Hashable, Mapping

from fuzzywuzzy import fuzz


MIN_LAST_NAME_SCORE = 90
MIN_FIRST_NAME_SCORE = 50


def load_normalization_spec() -> dict[str, Any]:
    spec_path = Path(__file__).resolve().parent / "player_name_normalization_spec.json"
    with spec_path.open("r", encoding="utf-8") as file_handle:
        return json.load(file_handle)


NORM_SPEC = load_normalization_spec()


def _normalize_text(value: str) -> str:
    normalized = (value or "").lower().strip()
    punctuation = NORM_SPEC.get("punctuation_regex", "[.'`-]")
    normalized = re.sub(punctuation, "", normalized)
    for source, replacement in NORM_SPEC.get("replace_chars", {}).items():
        normalized = normalized.replace(source, replacement)
    return " ".join(normalized.split())


def normalize_name(name: str) -> str:
    """Normalize a full name without treating it as a unique identity key."""
    normalized = _normalize_text(name)
    for suffix in NORM_SPEC.get("strip_suffixes", []):
        normalized = re.sub(rf"\s+{re.escape(suffix)}$", "", normalized)
    return NORM_SPEC.get("alias_map", {}).get(normalized, normalized)


def split_name_first_last(name: str) -> tuple[str, str]:
    parts = re.sub(r"\s+", " ", (name or "").strip()).split(" ")
    if not parts or not parts[0]:
        return "", ""
    suffixes = {
        _normalize_text(suffix)
        for suffix in NORM_SPEC.get("strip_suffixes", [])
    }
    while len(parts) > 1 and _normalize_text(parts[-1]) in suffixes:
        parts.pop()
    if len(parts) == 1:
        return parts[0], parts[0]
    return " ".join(parts[:-1]), parts[-1]


def _build_nickname_lookup() -> dict[str, str]:
    lookup: dict[str, str] = {}
    for canonical, variants in NORM_SPEC.get("nickname_groups", {}).items():
        canonical_name = _normalize_text(canonical)
        for value in [canonical, *variants]:
            normalized = _normalize_text(value)
            previous = lookup.get(normalized)
            if previous is not None and previous != canonical_name:
                raise ValueError(
                    f"Nickname {value!r} belongs to both {previous!r} and "
                    f"{canonical_name!r}."
                )
            lookup[normalized] = canonical_name
    return lookup


NICKNAME_LOOKUP = _build_nickname_lookup()


def normalize_given_names(name: str) -> str:
    first_names, _ = split_name_first_last(name)
    tokens = [
        _normalize_text(token)
        for token in re.split(r"[\s-]+", first_names)
        if _normalize_text(token)
    ]
    return " ".join(NICKNAME_LOOKUP.get(token, token) for token in tokens)


def normalize_last_name(name: str) -> str:
    _, last_name = split_name_first_last(name)
    return _normalize_text(last_name)


def score_name_parts(source_name: str, candidate_name: str) -> tuple[int, int]:
    """Return independent ``(last_name_score, first_name_score)`` values."""
    source_last = normalize_last_name(source_name)
    candidate_last = normalize_last_name(candidate_name)
    source_first = normalize_given_names(source_name)
    candidate_first = normalize_given_names(candidate_name)

    if not source_last or not candidate_last or not source_first or not candidate_first:
        return 0, 0

    return (
        fuzz.ratio(source_last, candidate_last),
        fuzz.ratio(source_first, candidate_first),
    )


def best_qualified_name_match(
    source_name: str,
    candidates: Mapping[Hashable, Mapping[str, Any]],
    *,
    min_last_name_score: int = MIN_LAST_NAME_SCORE,
    min_first_name_score: int = MIN_FIRST_NAME_SCORE,
) -> tuple[Hashable | None, int | None, int | None]:
    """Return the unique best candidate satisfying both score thresholds.

    Candidate dictionaries must expose a ``name`` value. A score tie is left
    unresolved instead of depending on dictionary iteration order.
    """
    qualified: list[tuple[float, int, int, Hashable]] = []

    for candidate_id, candidate in candidates.items():
        candidate_name = str(candidate.get("name") or "")
        last_score, first_score = score_name_parts(source_name, candidate_name)
        if (
            last_score < min_last_name_score
            or first_score < min_first_name_score
        ):
            continue
        combined_score = (last_score * 0.7) + (first_score * 0.3)
        qualified.append(
            (combined_score, last_score, first_score, candidate_id)
        )

    if not qualified:
        return None, None, None

    qualified.sort(key=lambda match: match[:3], reverse=True)
    best = qualified[0]
    if len(qualified) > 1 and qualified[1][:3] == best[:3]:
        return None, None, None

    return best[3], best[1], best[2]
