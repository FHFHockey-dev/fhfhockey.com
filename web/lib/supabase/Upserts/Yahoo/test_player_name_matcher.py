import unittest
from pathlib import Path
import sys

sys.path.insert(0, str(Path(__file__).resolve().parent))

from player_name_matcher import (
    MIN_FIRST_NAME_SCORE,
    MIN_LAST_NAME_SCORE,
    best_qualified_name_match,
    normalize_given_names,
    score_name_parts,
)


class PlayerNameMatcherTests(unittest.TestCase):
    def test_required_thresholds_are_pinned(self):
        self.assertEqual(MIN_LAST_NAME_SCORE, 90)
        self.assertEqual(MIN_FIRST_NAME_SCORE, 50)

    def test_common_nicknames_are_canonicalized_before_scoring(self):
        self.assertEqual(score_name_parts("Michael Smith", "Mike Smith"), (100, 100))
        self.assertEqual(
            score_name_parts("James Robertson", "Jimmy Robertson"),
            (100, 100),
        )

    def test_compound_given_names_normalize_hyphen_and_space(self):
        self.assertEqual(
            normalize_given_names("Jean-Gabriel Pageau"),
            normalize_given_names("Jean Gabriel Pageau"),
        )

    def test_suffixes_do_not_replace_the_actual_last_name(self):
        self.assertEqual(
            score_name_parts("Michael Smith Jr.", "Mike Smith"),
            (100, 100),
        )

    def test_rejects_a_last_name_below_ninety_even_with_exact_first_name(self):
        candidate_id, last_score, first_score = best_qualified_name_match(
            "Michael Smythe",
            {"candidate": {"name": "Michael Smith"}},
        )
        self.assertLess(score_name_parts("Michael Smythe", "Michael Smith")[0], 90)
        self.assertEqual((candidate_id, last_score, first_score), (None, None, None))

    def test_rejects_a_first_name_below_fifty_even_with_exact_last_name(self):
        candidate_id, last_score, first_score = best_qualified_name_match(
            "Connor McDavid",
            {"candidate": {"name": "Cameron McDavid"}},
        )
        self.assertLess(score_name_parts("Connor McDavid", "Cameron McDavid")[1], 50)
        self.assertEqual((candidate_id, last_score, first_score), (None, None, None))

    def test_selects_the_best_candidate_that_passes_both_thresholds(self):
        self.assertEqual(
            best_qualified_name_match(
                "Mike Smith",
                {
                    "wrong-first": {"name": "Zbigniew Smith"},
                    "right": {"name": "Michael Smith"},
                    "wrong-last": {"name": "Mike Smythe"},
                },
            ),
            ("right", 100, 100),
        )

    def test_equal_best_candidates_remain_unresolved(self):
        self.assertEqual(
            best_qualified_name_match(
                "James Smith",
                {
                    "one": {"name": "Jimmy Smith"},
                    "two": {"name": "Jimmy Smith"},
                },
            ),
            (None, None, None),
        )

    def test_mapping_job_uses_only_the_thresholded_fuzzy_matcher(self):
        mapping_job = (
            Path(__file__).resolve().parent / "populate_yahoo_nhl_mapping.py"
        ).read_text(encoding="utf-8")
        self.assertEqual(mapping_job.count("best_qualified_name_match("), 3)
        self.assertNotIn("score_cutoff=", mapping_job)
        self.assertNotIn("process.extractOne", mapping_job)
        self.assertNotIn("best_last_name_match", mapping_job)


if __name__ == "__main__":
    unittest.main()
