# Migrations 153 and 154 (BLSH v6, inert): apply receipt

## Authorization

- **Approval:** TJ, by pop-up, 2026-11-15: "Approve all 3 steps", covering push, PR and squash-merge, then preflight and apply 153 and 154 with receipts. The release scope was "Everything except mid-edit and artifacts".
- **Code release:** PR FHFHockey-dev/fhfhockey.com#453, squash-merged as master `89284e9c4` (tree `72a0cfe4`).
- **Build:** production deployment `dpl_23ZsbjhAhM1Eb4utVV9gSby6Xeqi` (`fhfhockey`) READY. The other three projects were CANCELED by their ignored-build steps. The chef branch push created no deployment.

## Files

| File | SHA-256 | Delimiters |
| --- | --- | --- |
| `supabase/migrations/20261116000000_blsh_native_capture_v6.sql` | `4e896a89…0c70` | body lines 15–268; `begin;` and `commit;` on lines 14 and 269 |
| `supabase/migrations/20261116000100_blsh_request_context_v1.sql` | `920e3430…642b` | body lines 16–63; delimiters on lines 15 and 64 |

Both bodies reassembled to the same hash before the apply.

## Method

- psql 15 to the IPv4 session pooler, `sslmode=require`, as `postgres` (not a superuser), with `application_name` `claude-blsh-v6-migration-153-154`.
- Credentials came from `web/.env.local` through `pgpool.sh`, a copy of the migration-152 wrapper with only the app name changed. They were never printed.
- Each apply was one transaction: the body, the ledger insert, `notify pgrst`, then `commit`. `lock_timeout` 5 s, `statement_timeout` 30 s, and a 120 s alarm.

## Preflight (read-only)

| When (UTC) | Result |
| --- | --- |
| 00:30:57 | `1\|1\|0\|0\|0\|0\|0\|0\|0\|absent\|5\|3\|t\|t\|54\|3\|f\|name,version`, as expected for the state before 153 |
| 00:36:36, immediately before 153 | identical |
| 00:37:28, before 154 | `0\|0\|0\|0\|1\|0\|3\|11\|0\|false,2621440,{application/json,text/html}\|5\|3\|t\|t\|54\|3\|f\|name,version`: OK |

**Storage policies on `storage.objects`:**
- the two `draft_pro_private_imports_deny_{anon,authenticated}` policies are **RESTRICTIVE**;
- the only **PERMISSIVE** policies are for `service_role`;
- row-level security is on.

So `anon` and `authenticated` have no access to `blsh-native-packets`. This was confirmed by an extra read-only catalog query, which ran in a read-only transaction and was rolled back.

## Apply

| Migration | Applied at (database clock) | Result |
| --- | --- | --- |
| 153 `blsh_native_capture_v6` | **2026-11-16 00:36:57.966571Z** | `COMMIT`, exit 0 |
| 154 `blsh_request_context_v1` | **2026-11-16 00:37:36.444985Z** | `COMMIT`, exit 0 |

## Readback (read-only): both match the expected lines exactly

**153:** `1|3|2|blsh_capture_control:SELECT,blsh_capture_objects:SELECT,blsh_capture_runs:SELECT|0|0|11|10|…8 service_role functions…|0|0|false,2621440,{application/json,text/html}|f|0`

That means:
- the ledger row is present;
- RLS is on for all 3 tables, and both guard triggers are enabled;
- `service_role` has SELECT only on the tables;
- there are 11 functions: 10 SECURITY DEFINER with `search_path=""`, plus the guard trigger function. `service_role` can EXECUTE exactly 8 of them; `anon`, `authenticated` and PUBLIC can EXECUTE none;
- the bucket is private (2.5 MiB, JSON and HTML only);
- **the kill switch is off**;
- runs and objects hold 0 rows.

**154:** `1|1|s|t|{"search_path=\"\""}|t|t|f|f|f`

That means:
- the ledger row is present;
- `blsh_request_context_v1(date,date)` is STABLE and SECURITY DEFINER, with `search_path=""`;
- it is owned by the applying role;
- EXECUTE is granted to `service_role` only.

## Not done (each needs its own approval)

The following were not done:
- enabling the kill switch;
- running `schedule/SCHEDULE.sql`;
- calling `blsh_request_context_v1`;
- smoke-testing the route;
- the deployment probe, including PROBE-LIST M1 (Fluid compute and function isolation).

**Rollback:** `supabase/tests/blsh_native_capture_v6_rollback.sql` and `blsh_request_context_v1_rollback.sql`. They were not run; running them needs TJ's approval.

**Private outputs:** `~/blsh-v6-migration-<UTC>/` (0700). It holds the bodies and the preflight, apply and readback outputs.
