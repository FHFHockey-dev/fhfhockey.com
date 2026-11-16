# Migrations 153 and 154 (BLSH v6, inert): preflight, apply, readback

**Modelled on:** `tasks/artifacts/forge-pregame-capture-2026-11-14/MIGRATION-150-APPLY-RECEIPT.md` and the migration-152 operator script.

**Status:**
- Nothing here has been run against production.
- Every SQL file in `sql/` was rehearsed, unchanged, on a disposable PostgreSQL 15. It ran as a **non-superuser** owner, with the baseline's broad default privileges (the worst case), through the real `psql` 15 binary. See `proof/rehearse_apply.py` and `proof/REHEARSE-APPLY.log`: 17/17.

**Approval:**
- **Each migration is applied singly, 153 then 154, each only after TJ's own pop-up approval of that apply.**
- TJ's approval of the inert *release* does not cover applying either migration.
- Neither apply enables the kill switch, creates a schedule or calls a function.

| Order | File | SHA-256 | `begin;` / `commit;` lines | Body (lines) | Body SHA-256 |
| --- | --- | --- | --- | --- | --- |
| 153 | `supabase/migrations/20261116000000_blsh_native_capture_v6.sql` | `4e896a891d02543a5a500597c7ce97d745e6a724d1c5100de1a7a2e8c9250c70` | 14 / 269 | 15–268 | `d9634f0dc9dd43d09e4c52dc17333efb63fac8e894e25fc766e853f48bd13115` |
| 154 | `supabase/migrations/20261116000100_blsh_request_context_v1.sql` | `920e3430a89d1c91ac5899f52a2a606563d6e6f700f77e1750dbf5511089642b` | 15 / 64 | 16–63 | `e3f01306b995868f7cf572e280be2be9342c9203ce09fce8f772e320c6b70688` |

**Why only the body is applied:** both files carry their own `begin;` and `commit;`. Running a whole file inside a wrapper transaction would commit the migration **before** the ledger insert. So the apply runs only the body inside `sql/apply-15x.sql`: one transaction holding the body, the ledger insert, `notify pgrst` and `commit`. That keeps the migration and its ledger row atomic. The rehearsal proves this: when the ledger insert fails, nothing is left behind.

## Method (as for 150–152)

- psql 15 to the IPv4 session pooler (`aws-0-us-east-1.pooler.supabase.com:5432`, sslmode=require), as `postgres`, which is not a superuser.
- Credentials are read from `web/.env.local` and never printed. The migration-152 `pgpool.sh` wrapper does this.
- `lock_timeout 5s`, `statement_timeout 30s`, a 120 s wall-clock alarm, `-X`, `ON_ERROR_STOP`.
- **Window:** a quiet minute, for example minute 06 or 36, outside the 08:25–11:00Z NST/pipeline band, and not at :00/:20/:40 (`update-stats`) or the */5 and */10 jobs.
- **Outputs:** a private 0700 directory, for example `~/blsh-v6-migration-<UTC>`.

## Step 0: extract and verify the body (local, no network)

```bash
OUT=~/blsh-v6-migration-$(date -u +%Y%m%dT%H%M%SZ); mkdir -m 700 "$OUT"
F=supabase/migrations/20261116000000_blsh_native_capture_v6.sql
shasum -a 256 "$F"                                   # must be 4e896a89…0c70
sed -n '14p;269p' "$F"                               # must print: begin;  commit;
sed -n '15,268p' "$F" > "$OUT/body-153.sql"
{ sed -n '1,14p' "$F"; cat "$OUT/body-153.sql"; sed -n '269p' "$F"; } | shasum -a 256   # must be 4e896a89…0c70 again
```

For 154: `F=supabase/migrations/20261116000100_blsh_request_context_v1.sql`. Check lines `15p;64p`, extract `sed -n '16,63p'` to `body-154.sql`, reassemble with `1,15p` + body + `64p`, and expect `920e3430…642b` both times.

**Stop** if any hash or delimiter line differs.

## Step 1: preflight (read-only): `sql/preflight.sql`

```bash
pgpool.sh -X -At -F '|' -f tasks/artifacts/blsh-cron-v6-2026-11-15/release/sql/preflight.sql
```

**Fields:** active | longest_s | lock_waits | cron_running | ledger_153 | ledger_154 | blsh_tables | blsh_functions | request_context_fn | bucket | storage_bucket_cols | storage_object_cols | can_insert_bucket | can_read_objects | dependency_cols | roles | superuser | ledger_cols

| Before | Expected line (rehearsed) | Stop if |
| --- | --- | --- |
| 153 | `≤5|≤10|0|0|0|0|0|0|0|absent|5|3|t|t|54|3|f|name,version` | active > 5, longest > 10 s, any lock wait or running cron; ledger row present; any `blsh_capture_*` table or function; the bucket present with other settings; storage columns not 5/3; `can_insert_bucket` or `can_read_objects` false; dependency columns not 54; roles not 3; a superuser session |
| 154 | `≤5|≤10|0|0|1|0|3|11|0|false,2621440,{application/json,text/html}|5|3|t|t|54|3|f|name,version` | as above; and 153 not applied (ledger_153 ≠ 1, tables ≠ 3, functions ≠ 11), or the function already present |

**Notes:**
- `bucket` may be `false,2621440,{application/json,text/html}` before 153 only if a previous rollback kept it. The migration accepts exactly that.
- **Storage policies:** the second result set of `preflight.sql` lists `storage.objects` policies (review L6, PROBE-LIST 13). **Stop and report** any policy that could give `anon` or `authenticated` access to `blsh-native-packets`, meaning one whose expression does not exclude that bucket.

## Step 2: apply (one transaction): `sql/apply-153.sql`, then later `sql/apply-154.sql`

```bash
cp tasks/artifacts/blsh-cron-v6-2026-11-15/release/sql/apply-153.sql "$OUT/"
# re-run Step 1 and confirm its line immediately before this command
perl -e 'alarm shift; exec @ARGV' 120 pgpool.sh -X -v body="$OUT/body-153.sql" -f "$OUT/apply-153.sql" > "$OUT/apply-153.out" 2>&1; echo "exit=$?"
```

**`apply-153.sql`, verbatim:**

```sql
\set ON_ERROR_STOP on
begin;
set local lock_timeout = '5s';
set local statement_timeout = '30s';
\i :body
insert into supabase_migrations.schema_migrations (version, name) values ('20261116000000', 'blsh_native_capture_v6');
notify pgrst, 'reload schema';
select 'applied_at', clock_timestamp();
commit;
```

**`apply-154.sql`:** identical, except the ledger insert reads `('20261116000100', 'blsh_request_context_v1')`.

**Expected:** exit 0, an `applied_at` line, and `COMMIT` in the output. **Stop** on any other exit status, or if `COMMIT` is missing; the transaction then rolled back as a whole.

## Step 3: readback (read-only): `sql/readback-153.sql`, `sql/readback-154.sql`

**153.** Fields: ledger | rls_tables | guard_triggers | svc_table_privs | other_table_privs | public_table_grants | functions | secdef_empty_path | svc_execute | anon_auth_execute | public_execute | bucket | kill_switch | rows

```
1|3|2|blsh_capture_control:SELECT,blsh_capture_objects:SELECT,blsh_capture_runs:SELECT|0|0|11|10|blsh_capture_claim_v1,blsh_capture_close_v1,blsh_capture_enabled_v1,blsh_capture_intent_v1,blsh_capture_keep_v1,blsh_capture_object_v1,blsh_capture_watchdog_assert_v1,blsh_capture_watchdog_v1|0|0|false,2621440,{application/json,text/html}|f|0
```

What each part means:
- **Ledger:** the row for `20261116000000 / blsh_native_capture_v6`.
- **Tables:** RLS is on for all 3.
- **Triggers:** both guard triggers are enabled.
- **Table privileges:** `service_role` has **SELECT only** on the 3 tables. `anon` and `authenticated` have nothing, and there is no PUBLIC grant.
- **Functions:** there are 11 `blsh_capture_*` functions. 10 are SECURITY DEFINER with `search_path=""`; the 11th is the guard trigger function, which is not definer but also sets the empty path.
- **EXECUTE:**
  - `service_role` has exactly these 8: `claim`, `close`, `enabled`, `intent`, `keep`, `object`, `watchdog`, `watchdog_assert`;
  - `blsh_capture_retention_v1` and `blsh_capture_mark_pruned_v1` are owner-only, and so is the guard;
  - `anon`, `authenticated` and PUBLIC have none.
- **Bucket privacy assertion:** `blsh-native-packets` is `public = false`, 2621440 bytes, JSON and HTML only.
- **Kill switch:** **off** (`f`).
- **Rows:** 0 in runs and objects.

**154.** Fields: ledger | functions | volatility | secdef | config | owner_is_current_user | svc_execute | anon_execute | auth_execute | public_execute

```
1|1|s|t|{"search_path=\"\""}|t|t|f|f|f
```

That is: the ledger row; one `blsh_request_context_v1(date,date)`; STABLE; SECURITY DEFINER; `search_path=""`; owned by the applying role; EXECUTE for `service_role` only.

**Stop and report** (do not roll back on your own) if any line differs. Rolling back needs TJ's approval.

## After each apply

- Flip authority row 153 (then 154) to `applied`, with the stateEvidence in the style of 150–152: time from the database clock, the gate line, the readback line, the method.
- Update the baseline test pins: applied 118 → 119 → 120, pending 8 → 7 → 6. Update the super-goal sentence's applied count.
- **Do not:**
  - enable the kill switch;
  - run `schedule/SCHEDULE.sql`;
  - call `blsh_request_context_v1`, which would be a production read;
  - smoke the route.

  Each of those is a separate approval, gated by the deployment probe, PROBE-LIST item M1 included.

## Rollback (not run; needs TJ's approval)

**Order:** 154 first, then 153.
- `supabase/tests/blsh_request_context_v1_rollback.sql`;
- `supabase/tests/blsh_native_capture_v6_rollback.sql`. It keeps the empty private bucket, and refuses while packet bytes remain: delete those through the Storage API first.

Then delete the ledger rows for `20261116000100` and `20261116000000`.

**Proof:** `proof/rollback_roundtrip.py`, 15/15. It covers apply, rollback, a second rollback (a no-op), and re-apply to an identical catalog. It also checks the refusal while the bucket holds objects.
