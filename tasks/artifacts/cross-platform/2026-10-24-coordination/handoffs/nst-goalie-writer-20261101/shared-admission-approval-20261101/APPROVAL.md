# Next separate approval: shared NST admission

**Ready for approval; not executed.** A bounded read at18:38:55UTC confirms the approved default-privilege prerequisite remains effective, required PL/pgSQL/schema access exists, and there is no conflicting admission relation/RPC or matching admission history. The later caller/deployment gates do not block this passive database prerequisite.

> Approve applying only the shared-admission transaction to Supabase project **fyhftlxokyjtpndbkfse** (`fhfhockey.com`), primary database **postgres**, as **postgres**.
>
> Exact SQL: [PROPOSED-admission-install.sql](../rollout-approval-20261101/PROPOSED-admission-install.sql), SHA256 **`c262a45040d5e090a0f9a6640cad899a2c7da299eae12de1be42cbe908f038b0`**. It contains unchanged accepted source SHA256 **`aefd3c20f2ff76328ef8b27e19244e438ad69a22ea1f9b5ef3cc1d6068784dce`**, wrapped in BEGIN/COMMIT with5s lock and30s statement timeouts. Proposed managed migration name: `nst_shared_admission_v1`; record the tool-generated history version.
>
> It creates only **public.nst_request_admission_state**, one initial singleton row (`attempts=[]`, `last_spacing_ms=22000`), and **public.nst_admit_attempt_v1(boolean,integer)**. The table has RLS enabled. PUBLIC/anon/authenticated receive no table or RPC rights; service_role receives only table SELECT/UPDATE and RPC EXECUTE. The function is SECURITY INVOKER with fixed pg_catalog/public search_path. Other creator defaults and existing application tables/data remain unchanged.
>
> The RPC later serializes attempted provider calls through one row lock and shared rolling limits:39/minute,80/5minutes,100/15minutes,180/hour, with a1-second permit lifetime and22-second spacing for unknown/large plans. Only explicitly bounded burst plans can omit fixed spacing while still respecting every limit. Installing it invokes no RPC/provider request and changes no deployed code or schedule. An empty ledger does not account for pre-installation requests or establish caller clearance.
>
> Risks: DDL lock/name collisions, privilege drift, concurrent callers contending on the singleton, and unknown consumers using a newly available RPC. Recheck target/defaults/names immediately before applying. Verify object ownership, schema/RLS/ACLs, exact function body, seed row and migration history afterward **using SELECTs only**; do not call the admission RPC as a test because it charges a permit.
>
> On a failed or ambiguous apply, inspect before retry. Transaction failure should roll back its DDL. After successful installation, rollback needs separate approval: only if unused and dependency-free, remove the new RPC and table in that order, without CASCADE. Once used, preserve the attempt ledger and reconcile callers first; deleting/resetting it could bypass rolling limits. The already-approved default-privilege change is outside this rollback.
>
> Stop after verification. Checkpoint/lifecycle SQL, push/deployment, schedule changes, activation and any production NST execution remain separate approvals.

Evidence: `SQL-PINS.json`, `readiness.sql/json`. `POST-INSTALL-READBACK.sql` is a prepared, unexecuted read-only verification query. No migration or application code changed in this preparation; one authorized bounded SELECT was performed. All67 frozen writer source pins remain unchanged. No production provider/application request, RPC invocation, hosted mutation, push/deploy or schedule change.

Remaining technical/operational gates after this step: checkpoint migration approval and readback; exact release SHA and four-project build/ignore checks; named external/old-caller clearance; concrete bootstrap/time/date/attempt/write bounds and separate lifecycle/schedule/canary/ongoing-operation approvals; live coverage and alert delivery qualification. No current technical dependency blocks requesting this admission-only approval.
