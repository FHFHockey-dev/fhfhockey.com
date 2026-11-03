# Approved default-privilege prerequisite — applied and verified

Applied only `supabase/migrations/20261020224500_data_api_explicit_default_privileges.sql`, SHA256 `60e0ee8f6004d07182c6999fbe34534a2cceb9530cafbd1a0bb868b0fd5ff51c`, to Supabase project **fyhftlxokyjtpndbkfse** (`fhfhockey.com`, primary host `db.fyhftlxokyjtpndbkfse.supabase.co`), database **postgres**, with verified postgres execution/session role.

TJ's explicit yes authorized this prerequisite only. Preflight18:35:14UTC verified target, role, exact file hash and no matching applied history; captured default ACLs and existing public-object ACL fingerprint. The exact1934-byte file was submitted unchanged once through Supabase apply_migration, name `data_api_explicit_default_privileges`. It contains BEGIN/COMMIT, lock_timeout5s and statement_timeout30s. Tool result: success=true. No retry.

**Managed migration history version:20261101183548.** The tool generated this application timestamp; the original repository source filename/version remains20261020224500. No source rename or migration-history repair was performed. Future migration reconciliation must account for this mapping and avoid blindly replaying the old filename version.

Readback18:36:05UTC confirmed:

- postgres public defaults no longer auto-grant anon/authenticated/service_role privileges on future tables/sequences/functions.
- postgres global function defaults contain only postgres EXECUTE; PUBLIC EXECUTE is removed for future functions.
- Supabase_admin defaults remain byte-equivalent to the captured state.
- All2006existing public relation/routine ACLs have unchanged fingerprint `c87c3b8f92f2925a3ae871fdd98eb88f` and count.
- Matching migration history contains the one generated version above.
- `nst_request_admission_state`, `nst_goalie_control` and `nst_job_control` remain absent.

Evidence: `TARGET.json`, `AUTHORIZATION.json`, exact `approved-source.sql`, `read-defaults.sql`, `BEFORE.json`, `APPLY-RESULT.json`, `AFTER.json`, `VERIFICATION.json`.

This completes step1 of the earlier approval packet. **Stopped before step2.** Shared admission/checkpoint migrations, deploy/push, schedule/configuration changes, activation and production NST requests remain unapproved and were not performed. No production application/provider request or writer RPC was invoked. One approved migration call, two bounded catalog SELECTs and one project metadata read were performed. No denial, uncertain apply or retry. No application source changes or test rerun;67writer pins remain unchanged.

Next decision: separate approval for the exact shared-admission prerequisite/envelope, followed by its readback gate; later checkpoint/deployment/schedule/activation approvals remain separate. Rollback of defaults would require separate approval and would not change permissions of objects created meanwhile.
