# Migration 150 apply receipt: forge_pregame_capture_custody

- **Approval:** TJ's pop-up, D1, 2026-11-15: "Approve apply".
- **D2 (TJ):** the in-run verifier keeps the same service_role key with a separate client, plus Astra's post-hoc OpenSSL check.
- **File:** `supabase/migrations/20261115000000_forge_pregame_capture_custody.sql`, SHA-256 `4213b1104ac4c0c262800c94eb12710b27dcea5460da96c314abb908d0df98b9`, checked immediately before the apply.
- **Method:**
  - psql 15 to the IPv4 session pooler (`aws-0-us-east-1.pooler.supabase.com:5432`, sslmode=require), as `postgres` (not superuser); credentials read from `web/.env.local`, never printed.
  - One transaction: `lock_timeout 5s`, `statement_timeout 30s`, the exact file, then the ledger insert `('20261115000000', 'forge_pregame_capture_custody')`, then `commit`.
  - 120 s wall-clock alarm.

## Preflight (read-only, 14:03:27Z)
| check | result |
| --- | --- |
| Other active queries / longest | 0 / 0 s |
| Lock waits | 0 |
| pg_cron runs in progress (last 2 h) | 0 |
| Ledger row 20261115000000 | absent |
| Schema `forge_pregame_capture` | absent |
| Functions `forge_pregame_capture_*` | 0 |
| Ledger columns | version, statements, name, created_by, idempotency_key, rollback. Earlier rows set only version and name. |
| Referenced columns | `games` (id, date, startTime, homeTeamId, awayTeamId) and `roster_optimizer_team_games` (source_game_id, team_abbreviation, game_status, schedule_status, fetched_at) present |

## Apply
| | |
| --- | --- |
| Gate immediately before (14:06:00Z) | 1 other active query, longest 0 s, 0 lock waits, no ledger row |
| Applied at | **2026-11-15 14:06:02.186702Z** (database clock), `COMMIT`, exit 0; 10 functions created (8 public RPCs + `reject_mutation`, `lock_key`) |

## Readback (read-only, catalog plus counts)
| check | result |
| --- | --- |
| Ledger | `20261115000000 | forge_pregame_capture_custody` |
| Schema owner | postgres |
| Tables | artifacts, claims, outcomes, save_fences, witnesses |
| Immutability triggers | 10 of 10 `ENABLE ALWAYS` |
| Constraints | 36 |
| Public functions | 8, all SECURITY DEFINER, owner postgres, `search_path=""` |
| EXECUTE | service_role yes; anon, authenticated, public no |
| Direct table access / schema usage (service_role, anon, authenticated) | none / none |
| Rows | 0 in all five tables |
| `witnesses.tsa_token_sha256` | generated, stored |
| Existing objects | unchanged (`freeze_starter_board_pregame` still present; `games` intact) |

**After the apply:**
- Authority row 150 is set to `applied` with this receipt.
- Baseline test pins are 116 applied / 6 pending (21/21 pass).
- The super-goal sentence now reads 116 applied.

**Rollback:** `supabase/tests/forge_pregame_capture_custody_rollback.sql`. It is not run, and running it needs TJ's approval.
