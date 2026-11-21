# Rolling game-ID backfill · production receipt · 2026-11-20

- **Approval:** TJ approved the apply in a Nov 20 pop-up at about 03:24Z, with plan md5 `90ae6392aee0cae4028e307d4d95ce0e`.
- **Scripts:** taken from ref `refs/rc/forge-rolling-backfill-20261120` (`302b348d0`).

| Script | sha256 |
| --- | --- |
| `dry-run.sql` | `1be8260c…` |
| `apply.sql` | `29bc05c7…` |
| `rollback.sql` | `32f6229c…` |

- **Dry run (read-only, 03:23Z):** 66,797 rows in scope (game_id null, game_date ≥ 2023-11-20), 474 players, season 20232024.
  - Every row resolved; 0 unresolved and 0 sidecar rows.
  - By strength: all, ev and pp 16,714 each; pk 16,655.
- **Apply (03:24:23Z):** the server emitted "applied: 66797 rolling rows, 0 sidecar rows, plan 90ae6392…", and the transaction committed.
  - The local `timeout 200` then killed psql (exit 124) during the script's post-commit summary SELECT.
  - That orphaned read-only query was cancelled by `pg_cancel_backend` at 03:29Z on two pids of this session only.
- **Post-state (read-only, 03:29Z):**
  - The backup `forge_backfill_20261120.rolling_game_id_before` holds 66,797 rows.
  - 0 rows with null game_id and game_date ≥ 2023-11-20 remain.
  - The backup is not readable by service_role and has no anon usage.
- **Reader check:** `forge_latest_rolling_rows` for the current rosters of teams 54, 25, 55 and 23 at cutoff 2026-11-20 returns 112 rows inside the 1,095-day window, with 0 null game_id.
  - Tonight's failing players now resolve: 8482141 to 2023020637, 8483012 to 2023021250, 8480441 to 2023021278.
- **Rollback:** `rollback.sql` restores only the rows still holding a backfilled value.
