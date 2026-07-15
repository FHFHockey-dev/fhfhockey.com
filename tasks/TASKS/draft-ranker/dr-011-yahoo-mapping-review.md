# DR-011 Yahoo Mapping Review

## Checkpoint status

Approved and completed on 2026-07-14. Migration `20260715010036_promote_approved_yahoo_identity_matches` is applied to the linked Supabase project.

## Why review is required

The legacy `public.yahoo_nhl_player_map` is useful evidence, but its historical rows were created while the ingestion script still included whole-name and last-name-only fuzzy fallbacks. The matcher is now corrected, but the frozen identity contract still permits `verified` status only for deterministic source identity equality or explicit review. Bulk-promoting the legacy table without re-evaluation would violate that contract and could silently merge real players who share or resemble names.

## Completed staging

- Backfilled 3,550 canonical NHL identities, verified NHL-ID mappings, and NHL aliases.
- Preserved 4,075 roster-history rows and 1,147 current-roster states.
- Staged 2,080 Yahoo player-key/season mappings as `review_required`.
- Created 1,068 deduplicated Yahoo review items.
- Kept all six Yahoo IDs with multiple FHFH candidates out of the external-mapping table.
- Verified that zero Yahoo mappings are marked `verified` and zero ambiguous Yahoo IDs were assigned.
- Replaced every non-exact fuzzy path in `populate_yahoo_nhl_mapping.py` with one matcher that requires last-name score >= 90 and first-name score >= 50.
- Added nickname canonicalization backed by `player_name_normalization_spec.json`, including Michael/Mike and James/Jimmy.
- Made score ties unresolved rather than dependent on candidate iteration order.
- Added nine focused matcher tests plus forward/reverse integration verification.

## Evidence groups

| Group | Review items | Recommended action |
| --- | ---: | --- |
| One FHFH candidate; passes last >= 90 and first >= 50 | 1,058 | Approve as one explicit bulk review; promote every staged key for these pairs to `verified`. |
| One FHFH candidate; fails one or both thresholds | 4 | Keep pending for individual review. |
| Yahoo ID has multiple FHFH candidates | 6 Yahoo IDs / 12 pairs | Keep pending regardless of score; disambiguate with birth date, team, and source evidence. |

The qualified single-candidate group contains 1,047 players with a 2025 Yahoo identity, comfortably above the 250-player seed requirement. Of the 1,058 qualifying pairs, 1,048 are exact normalized-name matches, three are nickname-equivalent, and seven are fuzzy-qualified. Approval is recorded in mapping provenance and review-queue resolution fields using manifest SHA-256 `1f34475fea9977c4f827a900e96fa9c031ac195f734811bab0a423ba3545e4f8` and system review actor `user_approved:dr_011_bulk_review_90_50_v1`. The four threshold failures and all six multi-candidate Yahoo IDs remain pending.

## Completed decision and verification

The user approved the threshold-qualified, single-candidate bulk review rule. DR-011 then:

1. Generated a deterministic 1,058-row manifest and a rerunnable promotion migration.
2. Executed the exact migration twice inside one rolled-back live transaction before apply; production returned to its original state with no residual columns or data.
3. Promoted 2,072 season-scoped mapping rows representing 1,058 distinct Yahoo player IDs and resolved exactly 1,058 review items.
4. Left eight season-scoped mappings as `review_required` and ten review items pending: four single-candidate threshold failures and six ambiguous Yahoo IDs.
5. Verified zero promoted rows below either score threshold and zero rows missing the approved actor attribution.
6. Reconciled 1,047 distinct verified 2025 players; 239 have positive preseason ADP, 313 have a positive scalar fallback, and 313 satisfy the launch seed contract.
7. Re-ran 12 Python matcher/promotion tests and 14 Vitest identity migration tests successfully.
8. Ran Supabase advisors: no identity-table security findings were reported; only expected unused-index informational notices remain for the newly introduced identity indexes.
