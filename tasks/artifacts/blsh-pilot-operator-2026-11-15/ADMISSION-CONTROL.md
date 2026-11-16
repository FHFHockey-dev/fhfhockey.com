# BLSH pilot: admission and control evidence

Prepared 2026-11-15 ~02:15Z. Local files only; no database or ledger access.

## 1. What exists (historical, local)

| Evidence | Value | Status |
| --- | --- | --- |
| Post-burst migration `supabase/migrations/20261109015836_nst_admission_post_burst_gap.sql` | file SHA-256 `52c611205361d41a97c9cf06bee7ff7ee15488d7a72456bc3ad1948c7cd6f4aa` (unchanged since 11-12) | local |
| `nst_admit_attempt_budget_v1` body MD5 | **re-derived now: `5e8543085513e308b92ce55b0090557b`**. This is the text between the `$$` quotes in that file | Matches the **reported** deployed prefix `5e854308` |
| Deployed prefix `5e854308` | Chef diary, 11-09 ~15:40Z: "applied"; `CLAUDE-CHEF-FORGE-NST-PERSISTENCE-20261110-14`: live 11-09 ~14:45Z, NST crons succeeded afterwards | Owner reports; prefix only; **5 days old** |
| `nst_job_control.enforced = false`, `nst_goalie_control.enabled = false` | `CLAUDE-TO-CODEX.md:2082`, readback 2026-11-07 ~23:30Z | **8 days old** |
| ACL | Migration comment: `CREATE OR REPLACE` keeps owner/ACL (EXECUTE: postgres, service_role); anon/authenticated expected false | Expected, not read back |
| Later admission changes in repo | No migration after `20261109015836` touches `nst_admit_*`, `nst_job_control` or `nst_request_admission_state` (grep of `supabase/migrations`). Mailboxes after 11-10 contain only proposals ("separately approve … enforced=true") | Repo/mailbox only; out-of-band SQL is not visible |

## 2. How the legacy wrapper behaves (from `20261101161622_nst_goalie_catchup_v1.sql:486-492`)

```
perform 1 from nst_job_control where singleton for update;      -- row lock
if enforced then raise exception 'NST enclosing job token required';
update nst_job_control set last_untracked_at = clock_timestamp();
return nst_admit_attempt_budget_v1(p_burst, p_planned_requests);
```

**Correction to the 11-12 packet.**
- **If `enforced = true`:** the exception aborts the transaction, so **no write occurs**. The pilot still loses call 2 and the whole slot: the bootstrap stops with no retry, after one schedule GET and one refused POST.
- **If `enforced = false`:** `last_untracked_at` is written even when the budget then denies.
- **Lock waits:** a held row lock waits up to the client's 5 s admission timeout.

## 3. What is unknown, by impact

1. **Current `nst_job_control.enforced`.** This is the largest risk: `true` means a certain, wasted slot. It has been unread since 11-07.
2. **Current deployed `nst_admit_attempt_budget_v1` full MD5, `nst_admit_attempt_v1` body and ACL.** A different body could change caps or cooldown.
3. **Current `nst_request_admission_state`.** Recent attempts and post-burst cooldown determine whether calls 2 and 4 are admitted at 14:05Z. This is time-varying, so a reading now cannot predict 11-17. The admission RPC itself is the authority at run time, and a denial means stop.
4. **Whether any out-of-band change happened after 11-09.** No repo trace, but the repo cannot see it.

## 4. Smallest bounded read, if TJ wants (1) and (2) closed — **proposal only, not run**

- **Scope:**
  - one read-only transaction;
  - one SQL request;
  - project `fyhftlxokyjtpndbkfse`;
  - `SET TRANSACTION READ ONLY`;
  - `statement_timeout = '3s'`, `lock_timeout = '1s'`.
- **No row of application data, no function bodies, no secrets.**
- **Route:** the Supabase MCP `execute_sql` (read-only), or psql with verify-full against the official CA, as Codex step 5 did. Never print the connection string.
- **Timing:** once, at T−1 day. The result becomes `admissionReceipt`.

```sql
begin transaction read only;
set local statement_timeout = '3s'; set local lock_timeout = '1s';
select p.proname,
       md5(p.prosrc)                                   as body_md5,
       pg_get_function_identity_arguments(p.oid)       as args,
       p.proacl::text                                  as acl,
       p.proconfig                                     as config,
       p.prosecdef                                     as security_definer
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
 where n.nspname = 'public'
   and p.proname in ('nst_admit_attempt_v1','nst_admit_attempt_budget_v1','nst_admit_job_attempt_v1')
union all
select 'nst_job_control', null, null,
       (select enforced::text from public.nst_job_control where singleton), null, null;
commit;
```

**Expected output:**
- three function rows (budget body MD5 `5e8543085513e308b92ce55b0090557b`; ACL `{postgres=X/postgres,service_role=X/postgres}`);
- one control row `enforced = false`.

**Notes:**
- It reads one boolean from `nst_job_control`. It does not read `last_untracked_at` or the qualification fingerprint.
- It is **outside** the pilot's five calls.
- **Needs its own TJ approval.** It is not requested by this file.

**Stop rules after the read:**
- `enforced = true`, a body-hash mismatch or an ACL wider than service_role → no pilot; revise the packet.
- Read not approved → record "admission state unknown, accepted by TJ" in the approval, or no start (OPERATOR-ACCEPTANCE condition 10).

## 5. Admission receipt ID

`blsh-admission-20261116.<sha12 of the saved query output JSON>`. If no read is approved: `blsh-admission-historical-5e854308.unverified`. Both match `^[A-Za-z0-9._:-]{1,200}$`.
