# 2026-11-22 · Claude · BLSH managed signer (proposal + isolated proof)

## Scope
Design and locally prove a managed, non-exportable Ed25519 signer for the BLSH v6 live pilot (two keys, request-context + official), so the pilot runs with no human-held key and no second computer. Proposal and disposable proof only. Reports to BLSH Chef local_f83c2634.

## Where
- Deliverables: tasks/artifacts/blsh-replay-2026-11-20/managed-signer-20261122/ (PROPOSAL.md, proof/, SHA256SUMS)
- Verifier read at Y 1efdfb4364dffa73a9c249f382dbfebe22ebbbd2 (read-only via git show; no checkout, no commits)
- Scratch: /private/tmp/claude-501/.../scratchpad

## State
- 23:40Z Sat 11-21 (17:40 CST): read CUSTODY.md, STEPS Part B, verify-approval-public-key.mjs, both handlers, official claim migration, context source fn, SCHEDULE-ONCE/ARM/INSTALL/CANCEL/DISARM.
- Verifier facts: pure Ed25519 (`verify(null, …)`), SPKI PEM ≤512 chars; signed bytes = UTF-8 JSON array, no newline:
  - RC: [ns, sourceDate, nativeRunId, nativeManifestSHA256, deploymentId, gitCommitSha]
  - Official: [ns, sourceDate, nativeRunId, nativeManifestSHA256, scheduleSHA256, deploymentId, gitCommitSha, gameIds]
  - No key-ID/fingerprint check in handlers; only env public key. deploymentId/SHA must equal VERCEL_DEPLOYMENT_ID / VERCEL_GIT_COMMIT_SHA.
  - scheduleSHA256 = native object ordinal 6 (schedule.raw.json) sha (claim fn src->objects->5). gameIds = completed games in schedule.raw.json for D, sorted.
- Vendor research subagent running (AWS KMS / GCP KMS / Vercel KMS / Supabase).

- 23:5xZ research (subagent, official docs): AWS KMS ECC_NIST_EDWARDS25519 / ED25519_SHA_512 RAW = fit (~$2/mo); GCP EC_SIGN_ED25519 software = fit (~$0.12); Vercel KMS = no Ed25519 in REST enum, beta, project-level grant only; Supabase Vault exportable. Vercel OIDC has no deployment claim.
- Design: AWS KMS + Lambda signer (policy in TJ's AWS account), DB pushes evidence via pg_cron/pg_net (no Supabase credential in signer), DynamoDB one-shot, mandate in Lambda env, key-policy time fence. Verifier unchanged.
- 00:05Z Sun: proof green, 6/6 tests, 50 PASS lines. Y's real RC handler accepted envelope as jsonb::text; real official handler + real PG claim accepted grant; 12:45 command byte-identical to SCHEDULE-ONCE 33b1ead0.
- Deliverables written: PROPOSAL.md, proof/ (signer, harness, sql, out), SHA256SUMS (all OK). No private key material in folder.

- 00:25Z advisor review: added forged-evidence test (FINDING: bearer holder → DoS only; Y refuses) and in-window wrong-slate test; S7 made required (cron-owner privileges); §8 KMS-disable wording softened. Rerun 7/7, 54 PASS + 1 FINDING. SHA256SUMS c5c0ba4a…, PROPOSAL ae663300….
- Hand-over: side-session-notes/<chef>/blsh-managed-signer-HANDOVER.md.

## Next
TJ review of PROPOSAL §12 lines (S0 first). Then Chef: re-date lane for Nov 25 (fallback Nov 27) incl. AUTOMATE-ONCE/CANCEL-SIGNER-STEPS + proof rerun; CUSTODY/Part B rewrite.

## Blockers / approvals
TJ approval lines S0–S8 in PROPOSAL §12. No production reads or changes made.

## Gotchas
- Vite refuses imports outside the project root: run-proof.sh copies signer/harness/sql into the export.
- `\b` doesn't separate a date from a following `T`; date-shift regex uses lookarounds.
- psql does not expand :'vars' inside dollar quotes (AUTOMATE checks the URL with a table constraint instead).
- zsh: `$Y:web/...` is a history modifier; use `"${Y}:path"`.

## Task 2 (Chef relay, ~00:10Z Sun): TJ S0 re-answer — HOLD; no AWS/GCP; no-added-cost Supabase/Vercel design, Vault first
- Read TJ-INSTRUCTIONS "BLSH managed signer S0 (re-answered)".
- Built V1: same policy core, hosted as Supabase Edge Function (supabaseSigner.mjs + supabase-edge-index.ts), keys in Vault (generated in-Supabase by one-shot keygen, public only leaves), evidence PULLED (trigger body "{}"), ledger = PG table. SQL AUTOMATE-ONCE-SUPABASE.sql (J5 still byte-identical; preflight refuses if service_role/anon/authenticated can read Vault).
- Proof now 10/10, 82 PASS (Lambda suite + V1 suite). RESIDUAL asserted: postgres can read Vault keys.
- Local plan facts: Vercel Pro (rankings perf report: 1-day runtime log retention). Supabase tier not in local records → design sized to Free-plan limits.
- Gotchas: anon/authenticated are NOLOGIN in stubs → use `set role`; evidence pull takes real time so "early" test must be clearly early.
- Next: Supabase access-model research (subagent) → PROPOSAL-SUPABASE.md → SHA256SUMS → handover.
- 01:00Z research: service_role has default SELECT on Vault (Supabase source; grantor supabase_admin). Emulated: the owner's REVOKE is a no-op → V1 (Vault keys) out. Switched to V1b (postgres-owned private table).
- 01:10Z advisor: auth-before-DB-work defect fixed; /selfcheck added; keygen entry added. FOUND: Y grants service_role EXECUTE on public.execute_sql (SECURITY DEFINER, arbitrary SQL) → no Supabase option is independent of the app without E1. Proved escalation and E1 fix.
- 01:25Z: PROPOSAL-SUPABASE.md f21c5a72…, SHA256SUMS 6e5063fe… (23 files, OK); proof 11/11, 89 PASS. PROPOSAL.md has a superseded banner. Handover note updated.
- Next: Chef/TJ: R1 read-only (R1-READONLY.sql), then S0-V1b+E1. Diary kept (task paused for decisions).
- 02:20Z (Chef relay after production R1): execute_sql already revoked in production → E1 = repo reconciliation. Vault readable by service_role (confirmed) → V1 out. BLOCKER: POSTGRES_* owner creds in Vercel production → E2.
  - Inventoried names only: Vercel (6 projects), GitHub secrets, local env files → e2-inventory/.
  - Added the authenticator-role preflight check, R1B-READONLY.sql and proof cases; 11/11, 91 PASS.
  - Revised PROPOSAL-SUPABASE.md (0888d6fe…); SHA256SUMS 3941da93… (excludes Chef's r1-hosted folder).
- Next: TJ S0-V1b+E2; R1b read-only (Chef). Diary kept (paused for decisions).
- 00:50Z (real clock; earlier entries' "01–02Z" were ahead): TJ S0-V1b+E2 = validate only.
  - Read the R1b addendum (integration installed; authenticator → anon/authenticated/service_role).
  - Read-only names: deployments→SHAs, history grep (no POSTGRES_* readers ever).
  - Research: reset/sync/rollback semantics.
  - Proof +2 tests (E2 boundary over emulated production grants; TCP SCRAM rotation: held sessions survive) → 13/13, 101 PASS.
  - Wrote E2-PLAN.md (0b33bf47…), R2-READONLY.sql; SHA256SUMS d52128b8….
- Next: Chef R2 + R3 (read-only). Diary kept.
- 00:55Z: R2/R3 revision.
  - Research: pg_cron 1.4.2 source; Vercel integration-var removal.
  - Gotcha: the helper agent ran `vercel docs search` → CLI treated it as a deploy, which errored before upload; verified no new deployments in all 6 projects.
  - Upgraded the cron stub to 1.4.2 semantics and pg_net to definer stubs; +1 test (a–d + run_details) → 14/14, 106 PASS.
  - E2-PLAN rewritten (79e84267…); SHA256SUMS 2baeec88….
- Next: TJ E2-1. Diary kept.
