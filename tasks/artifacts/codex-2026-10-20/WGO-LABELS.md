# WGO season labels — local guard and repair choices

Historical counts (253,257 mislabeled rows plus 105 bad-date rows) are retained handoff evidence, not a fresh production read. No relabel, date fix, NHL lookup or historical recompute was executed.

The skater mapper already requires a game ID with matching season/type and checks source `gameDate` when present. Added a small guard in `update-wgo-skaters.ts`: the requested date's year must fall within the game's two season years even if source `gameDate` is absent. This catches the old-date/modern-game combination before any batch write. It deliberately does not invent a season start month: September 2020 playoffs remain valid for 2019–20. It is a necessary coarse check, not proof that a game occurred on that date.

| Repair choice | Required evidence | Tradeoff / gate |
| --- | --- | --- |
| NHL API game-log reconstruction (recommended first) | Pin original affected row keys; acquire approved bounded player/game/date identities; match exact season/type and team; reject ambiguous/unmatched rows | Restores identities required by existing constraints, with provider/runtime cost and uncertain historic coverage. Dry-run mapping and pre/post receipts before a separate write approval. |
| Constraint change | Exact constraint definitions, intended legacy-null policy, downstream date-bounded readers, assessed exposure | Can permit label-only repair for null-identity history, but expands accepted states. Claude owns any proposed migration; TJ must approve policy/application. Do not drop or bypass the checks to make an update pass. |
| 105 bad dates | Original row IDs and five proposed game lookups from the existing repair owner, exact old/new date/game/season map and uniqueness check | Separate date repair. Execute only after TJ's direct go in this session; no such go has been received. Count alone does not identify the rows. |

Keep unmatched and ambiguous identities explicit, preserve original rows/evidence, and check `(player_id,date)` conflicts before any correction. Historical recompute is separate from relabeling and release. Readers of this cohort must bound by date as well as season. A strict DB check remains a proposed policy in `sql-proposals/wgo-season-calendar.sql`, not a migration.

Verification: outbound-blocked Node 22.11.0 Vitest `__tests__/pages/api/v1/db/update-wgo-skaters.types.test.ts`: 9/9 passed, including four invalid-year dates and delayed 2020 playoffs. This proves local ingest behavior, not repaired production data or provider completeness.
