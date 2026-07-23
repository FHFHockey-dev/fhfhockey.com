import re
from pathlib import Path
import sys
import unittest

sys.path.insert(0, str(Path(__file__).resolve().parent))

from generate_yahoo_identity_promotion import (
    REVIEW_ACTOR,
    build_manifest,
    manifest_sha256,
    render_migration,
    select_manifest_for_mode,
)


class YahooIdentityPromotionGeneratorTests(unittest.TestCase):
    def test_manifest_keeps_only_unique_candidates_passing_both_thresholds(self):
        rows = [
            self.row(1, "100", "Michael Smith", "Mike Smith"),
            self.row(2, "101", "Connor McDavid", "Conor McDavid"),
            self.row(3, "102", "Michael Smythe", "Michael Smith"),
            self.row(4, "103", "James Jones", "Jimmy Jones"),
            self.row(5, "104", "Robert Brown", "Bob Brown"),
            self.row(6, "104", "Robert Brown", "Bob Brown"),
        ]

        manifest, metrics = build_manifest(rows)

        self.assertEqual(
            [(row["nhl_player_id"], row["yahoo_player_id"]) for row in manifest],
            [(1, "100"), (2, "101"), (4, "103")],
        )
        self.assertEqual(metrics["single_candidate_qualified"], 3)
        self.assertEqual(metrics["single_candidate_failures"], 1)
        self.assertEqual(metrics["ambiguous_yahoo_ids"], 1)
        self.assertEqual(metrics["ambiguous_pairs"], 2)

    def test_rendered_migration_has_audited_actor_and_rerunnable_guards(self):
        manifest = [
            {
                "nhl_player_id": 1,
                "yahoo_player_id": "100",
                "last_name_score": 100,
                "first_name_score": 100,
                "match_kind": "nickname_equivalent",
            }
        ]
        metrics = {
            "single_candidate_failures": 1,
            "ambiguous_yahoo_ids": 1,
        }
        manifest_hash = manifest_sha256(manifest)
        sql = render_migration(manifest, metrics, manifest_hash)

        self.assertIn("verified_by_system", sql)
        self.assertIn("reviewed_by_system", sql)
        self.assertIn(REVIEW_ACTOR, sql)
        self.assertIn(manifest_hash, sql)
        self.assertIn("create temporary table if not exists", sql)
        self.assertIn("truncate table approved_yahoo_identity_matches", sql)
        self.assertIn("remaining pending review count drifted from 2", sql)
        self.assertNotIn("security definer", sql.lower())

    def test_incremental_mode_selects_only_new_or_changed_candidates(self):
        baseline = [
            self.manifest_row(1, "100", 100, 100, "exact_normalized"),
            self.manifest_row(2, "101", 100, 100, "exact_normalized"),
            self.manifest_row(3, "removed", 100, 100, "exact_normalized"),
        ]
        current = [
            baseline[0],
            self.manifest_row(2, "101", 100, 92, "fuzzy_qualified"),
            self.manifest_row(4, "102", 100, 100, "exact_normalized"),
        ]

        selected, metrics = select_manifest_for_mode(
            current,
            mode="incremental",
            baseline_manifest=baseline,
        )

        self.assertEqual(
            [row["yahoo_player_id"] for row in selected],
            ["101", "102"],
        )
        self.assertEqual(metrics["incremental_new_or_changed"], 2)
        self.assertEqual(metrics["incremental_unchanged"], 1)
        self.assertEqual(metrics["removed_requires_review"], 1)

    def test_recompute_all_mode_selects_the_complete_manifest(self):
        manifest = [
            self.manifest_row(1, "100", 100, 100, "exact_normalized"),
            self.manifest_row(2, "101", 100, 92, "fuzzy_qualified"),
        ]
        selected, metrics = select_manifest_for_mode(
            manifest,
            mode="recompute-all",
        )
        self.assertEqual(selected, manifest)
        self.assertEqual(metrics, {"recompute_rows": 2})

    def test_rendered_recompute_fails_closed_on_approved_mapping_conflicts(self):
        manifest = [
            self.manifest_row(1, "100", 100, 100, "exact_normalized"),
        ]
        sql = render_migration(
            manifest,
            {
                "single_candidate_failures": 0,
                "ambiguous_yahoo_ids": 0,
            },
            manifest_sha256(manifest),
        )
        self.assertIn("mapping.fhfh_player_id <> identity.id", sql)
        self.assertIn("mapping.verification_status = 'review_required'", sql)
        self.assertIn(
            "mapping.source_provenance->>'review_manifest_sha256'",
            sql,
        )
        self.assertIn(
            "mapping.verification_status = 'verified'\n"
            "                  and mapping.source_provenance->>"
            "'review_manifest_sha256'",
            sql,
        )

    @staticmethod
    def manifest_row(
        nhl_player_id: int,
        yahoo_player_id: str,
        last_name_score: int,
        first_name_score: int,
        match_kind: str,
    ) -> dict[str, int | str]:
        return {
            "nhl_player_id": nhl_player_id,
            "yahoo_player_id": yahoo_player_id,
            "last_name_score": last_name_score,
            "first_name_score": first_name_score,
            "match_kind": match_kind,
        }

    @staticmethod
    def row(
        nhl_player_id: int,
        yahoo_player_id: str,
        nhl_name: str,
        yahoo_name: str,
    ) -> dict[str, str]:
        return {
            "nhl_player_id": str(nhl_player_id),
            "yahoo_player_id": yahoo_player_id,
            "nhl_player_name": nhl_name,
            "yahoo_player_name": yahoo_name,
        }


class YahooIdentityPromotionMigrationTests(unittest.TestCase):
    ledger_dir = (
        Path(__file__).resolve().parents[5]
        / "supabase/migration-archive/pre-baseline-20260716/production-ledger"
    )
    migration_path = (
        ledger_dir / "20260715010036_promote_approved_yahoo_identity_matches.sql"
    )

    def test_canonical_contract_retains_scope_lineage_and_review_evidence(self):
        registry_sql = (
            self.ledger_dir
            / "20260714223013_create_fhfh_player_identity_registry.sql"
        ).read_text(encoding="utf-8")
        staging_sql = (
            self.ledger_dir
            / "20260714224513_stage_yahoo_identity_mapping_review.sql"
        ).read_text(encoding="utf-8")
        promotion_sql = self.migration_path.read_text(encoding="utf-8")
        combined = "\n".join((registry_sql, staging_sql, promotion_sql))

        for contract in (
            "context_key",
            "season_id",
            "match_method",
            "match_confidence",
            "verification_status",
            "source_provenance",
            "verified_at",
            "verified_by_system",
            "resolution_notes",
            "review_manifest_sha256",
            "merged_into_id",
            "'superseded'",
            "created_at",
            "updated_at",
        ):
            self.assertIn(contract, combined)

    def test_committed_manifest_is_complete_unique_and_hash_verified(self):
        sql = self.migration_path.read_text(encoding="utf-8")
        matches = re.findall(
            r"^\s+\((\d+), '(\d+)', (\d+), (\d+), "
            r"'(exact_normalized|nickname_equivalent|fuzzy_qualified)'\)[,;]$",
            sql,
            flags=re.MULTILINE,
        )
        self.assertEqual(len(matches), 1058)

        manifest = [
            {
                "nhl_player_id": int(nhl_id),
                "yahoo_player_id": yahoo_id,
                "last_name_score": int(last_score),
                "first_name_score": int(first_score),
                "match_kind": match_kind,
            }
            for nhl_id, yahoo_id, last_score, first_score, match_kind in matches
        ]
        self.assertEqual(len({row["yahoo_player_id"] for row in manifest}), 1058)
        self.assertTrue(all(row["last_name_score"] >= 90 for row in manifest))
        self.assertTrue(all(row["first_name_score"] >= 50 for row in manifest))
        self.assertEqual(
            sum(row["match_kind"] == "exact_normalized" for row in manifest),
            1048,
        )
        self.assertEqual(
            sum(row["match_kind"] == "nickname_equivalent" for row in manifest),
            3,
        )
        self.assertEqual(
            sum(row["match_kind"] == "fuzzy_qualified" for row in manifest),
            7,
        )

        expected_hash = manifest_sha256(manifest)
        self.assertIn(f"Manifest SHA-256: {expected_hash}", sql)


if __name__ == "__main__":
    unittest.main()
