# R-RECEIPTS — current auth migration dispositions

Chef reconciliation, 2026-10-19. Local source and retained dated receipts only; no new database, hosted, provider or credential access. This report does not authorize schema edits or deployment. All fenced files were read only. Earlier sprint completion statements are historical; the sprint remains active without a timed cutoff.

## Auth NEW 52 / imported C0209: satisfied by retained evidence

The October17 finding was correct for its snapshot. The active forward migration now exists at `supabase/migrations/20261019053348_restore_private_token_vault.sql`, SHA-256 `30fce724d3eedbd887126116226a1fa6b227fce2bfd4f1c16fd141478d4ba422`. It restores the private token table, the missing owner FK, three private routines and trigger; secret-id storage and the Vault-extension prerequisite remain explicit. Public wrappers can resolve their private dependencies on replay.

Evidence is separated by what it proves:

- `tasks/artifacts/security-audit-fixes-2026-10-18/token-vault-pg-result-v1.json`: retained disposable PostgreSQL17.11 receipt,20 passing cases. It uses a Vault stub, not a real Supabase Vault. Its pre-rename migration hash matches the current bytes above. This proves the bounded SQL contract, not a complete disaster-recovery exercise.
- `tasks/artifacts/super-goal-audit-2026-10-17/PROD-READS-2026-10-19.md`, G1-d1, lines30–45: retained catalog check explicitly reports `access_token_secret_id`, `refresh_token_secret_id`, no plaintext token columns, private schema present, and11 composite user FKs. No values were needed for this reconciliation.
- `tasks/sprint-2026-10-18/CHEF-REGISTER-2026-10-19.md`, approximately05:29–05:35Z entry, lines102–110: TJ approved and the other Chef applied migrations84/85. The private routines' bodies/arguments/defaults/grants and trigger/index/FK/schema usage matched before and after; migration85 was a semantic no-op against that hosted schema. This supersedes the earlier not-applied status, without asserting current hosted state.
- Current authority row85 records applied version20261019053348 and the same hash. The authority file is concurrently owned and was not changed here.
- Fresh Chef check from `web/`: `npm test -- lib/supabase/supportedBaselineMigration.test.ts -t 'leaves browser roles only owner-scoped reads of provider-linkage tables|restores the private token vault the baseline wrappers call'` — PASS,2 tests/19 excluded,exit0. This is a source-contract check; no SQL server was contacted. Its concurrently modified test file was read/executed only.

Disposition: close NEW52 and its exact master mirror with this dated evidence. No additional replay/hosted verification is claimed. Owner-policy and provider-storage approvals remain separate NEW53/54 gates.

## Auth NEW 55 / imported C0212: partial, stays open

`supabase/migrations/20261019052934_restrict_provider_linkage_browser_writes.sql`, SHA-256 `e3a90e1a3bfd45424c9714f2232fdc1880f6ec25e11196270beb0a1bb89148f7`, revokes PUBLIC/anon/authenticated privileges and restores authenticated SELECT only for exactly four tables: connected_accounts, external_leagues, external_teams, provider_sync_runs. Twelve browser write policies are dropped; service_role is preserved. The retained23-case disposable PostgreSQL receipt and the05:29–05:35Z apply/post-check establish that bounded repair at the dated checkpoint.

The open row names six tables. The migration deliberately leaves user_provider_preferences unchanged because AccountSettingsPage still selects/upserts owner preferences (`:1043`,`:1715`,`:1930`). It does not cover user_entitlements. Baseline SQL `:44642–44650` still grants SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE to anon/authenticated on those two tables. Bounded active-migration grant/revoke inspection found no later removal for them. This is a source gap; current hosted privileges and inherited-role behavior are not freshly observed. RLS does not constrain TRUNCATE.

### Proposed fenced change, not implemented

Schema owner should add a separately reviewed forward migration:

1. Revoke PUBLIC and anon privileges on both remaining tables. Remove authenticated TRUNCATE,TRIGGER,REFERENCES. Preserve service_role and existing owner/foreign-key constraints.
2. For user_provider_preferences, explicitly retain authenticated SELECT,INSERT,UPDATE,DELETE subject to existing owner RLS, so account preference upserts keep working. Do not reuse the four-table SELECT-only migration blindly.
3. For user_entitlements, prefer authenticated owner SELECT only after the schema owner confirms the bounded consumer inventory. Inspected browser components do not write it; Draft Pro ownerAccess/server and Patreon sync writes are server/service operations. Restrictive paid-entitlement policies remain in force. If another legitimate browser DML consumer exists, identify it before choosing its exact minimal grants; never preserve TRUNCATE/TRIGGER/REFERENCES merely for that consumer.
4. Validate effective grants (including PUBLIC/inheritance), owner reads/upserts, cross-owner denial, anonymous denial, service writes and no browser entitlement self-grant in an isolated fixture. Obtain the separately authorized read-only hosted effective-grant receipt before closing NEW55. No hosted probe or database fixture is run by this sprint.

This proposal requires edits under fenced `supabase/migrations/**`; dependent implementation stops here. TJ/schema owner must own that change or explicitly change the fence. NEW55 stays unchecked. The four-table identity-squatting repair must not be described as a six-table grant closure.

## Current security matrix

The July31 `tasks/TASKS/super-goal/security-boundary-reconciliation.md` is historical and contains account-linking-only/6.3 closure claims contradicted by later code. It is not edited because notes/reports must stay inside sprint lanes. [Current six-item addendum](R-SECURITY-MATRIX.md) records the broader NEW-028 state. Neither NEW-028 nor6.3 is closed by this auth reconciliation.

## Exact writes and limits

Created this report. Chef also changes only NEW52/55 dispositions and the corresponding exact imported mirrors/current roll-up in the two existing task lists; the register is Chef-only. No migration, authority JSON, test source, historical report or other owner's file is changed. The source/master diff and mechanical counts must be checked after those targeted edits. Historical hosted receipts are retained evidence, never fresh current-production proof.

Subsequent owner decisions in this same continuation resolved AuthNEW53/54 by explicitly keeping the current Patreon paid-feature mapping and approving ESPN/Fantrax storage under [the recorded policy](R-CREDENTIALS-PROPOSAL.md#current-owner-decision--accepted2026-10-19). The earlier paragraph identifying those as separate pending gates describes the initial receipt reconciliation; no schema/provider/hosted authority changed.
